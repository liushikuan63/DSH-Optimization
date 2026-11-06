import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import { apply } from '../../plugins/local-memory/index.mjs'
import { fixture } from './store-fixtures.mjs'
function host(root, { mode = 'workspace-write', text = '允许保存本任务状态', id = 'local-memory-integration-a' } = {}) {
  const tools = new Map(), listeners = new Map(), effects = [], counters = { observed: 0, released: 0 }
  const events = [{ type: 'user/message', seq: 0, data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } }]
  const session = { id, header: { id, cwd: root }, inheritedEventCount: 0, get seq() { return events.length }, isOwnSeq: i => i >= 0 }
  const agent = { id, ctx: {}, session }, live = new Map([[id, agent]])
  let currentMode = mode, policyChecks = 0, onPolicy
  const services = {
    agents: { get: key => live.get(key) },
    sandboxPolicy: { resolve() { policyChecks++; onPolicy?.(policyChecks); return { mode: currentMode, workspaceRoot: root } } },
    sessionQuery: {
      async observeSession(key) {
        assert.equal(key, id); counters.observed++
        return { source: 'live', header: { ...session.header }, inheritedEventCount: 0, events: events.slice(), cursor: events.length - 1, [Symbol.dispose]() { counters.released++ } }
      },
    },
  }
  const ctx = { get: key => services[key], tools: { register(tool) { tools.set(tool.name, tool); return () => tools.delete(tool.name) } }, systemPrompt: { section: () => () => {} }, on(name, fn) { const set = listeners.get(name) || new Set(); set.add(fn); listeners.set(name, set); return () => set.delete(fn) }, effect(fn) { const dispose = fn(); effects.push(dispose); return dispose } }
  apply(ctx)
  return { agent, counters, events, setMode(value) { currentMode = value }, setPolicyHook(fn) { onPolicy = fn }, dispose() { for (const d of effects.toReversed()) d() }, call(input) { return tools.get('local_memory').execute({ request: JSON.stringify(input) }, { agent, signal: new AbortController().signal }) } }
}
const page = { action: 'remember', title: '取消机制（示例数据）', body: '这是隔离验收页。用户取消后不自动恢复；当前授权与现场事实优先。', kind: 'decision', tags: ['示例数据'] }
test('actual registered tool + actual store knowledge/restart-shaped calls/correction/forget round trip', async t => {
  const f = await fixture(t), h = host(f.root); t.after(() => h.dispose())
  assert.equal((await h.call({ action: 'health' })).exists, false)
  const first = await h.call(page); await f.capture(first); assert.equal(first.revision, 1)
  assert.equal((await h.call({ action: 'search', query: '取消' })).items[0].id, first.id)
  const read = await h.call({ action: 'read', id: first.id }); assert.equal(read.page.body, page.body); assert.equal(read.trust, 'unverified-submitter-claim')
  assert.equal(read.page.sourceSessionHash, crypto.createHash('sha256').update(h.agent.id).digest('hex'))
  const updated = await h.call({ ...page, id: first.id, expectedRevision: 1, body: '这是隔离纠错页。旧结论仅作历史，不授予恢复权限。' }); await f.capture(updated); assert.equal(updated.revision, 2)
  await assert.rejects(h.call({ ...page, id: first.id, expectedRevision: 1 }), /LOCAL_MEMORY_VERSION_CONFLICT/)
  const deleted = await h.call({ action: 'forget', id: first.id, expectedRevision: 2 }); await f.capture(deleted); assert.equal(deleted.revision, 3)
  assert.equal((await h.call({ action: 'read', id: first.id })).tombstone, true); assert.equal((await h.call({ action: 'list' })).items.length, 0)
  assert.equal(h.counters.observed, h.counters.released)
})
test('read-only actual tools keep an absent store absent and refuse explicit mutations', async t => {
  const f = await fixture(t), h = host(f.root, { mode: 'read-only' }); t.after(() => h.dispose())
  for (const input of [{ action: 'health' }, { action: 'list' }, { action: 'search', query: '取消' }, { action: 'read', id: 'missing' }]) await h.call(input)
  await assert.rejects(h.call(page), /LOCAL_MEMORY_PERSISTENCE_DENIED/)
  assert.equal(await f.exists(path.join(f.root, '.dsh')), false)
})
test('read-only actual reads preserve an existing store identity and bytes', async t => {
  const f = await fixture(t), h = host(f.root); t.after(() => h.dispose())
  const saved = await h.call(page); await f.capture(saved); const before = await fs.readFile(f.store), id = await fs.lstat(f.store, { bigint: true })
  h.setMode('read-only')
  for (const input of [{ action: 'health' }, { action: 'list' }, { action: 'search', query: '取消' }, { action: 'read', id: saved.id }]) await h.call(input)
  await assert.rejects(h.call({ action: 'forget', id: saved.id, expectedRevision: 1 }), /LOCAL_MEMORY_PERSISTENCE_DENIED/)
  const after = await fs.lstat(f.store, { bigint: true }); assert.equal(after.ino, id.ino); assert.equal(after.dev, id.dev); assert.deepEqual(await fs.readFile(f.store), before)
})
test('actual backend write hooks recheck a late native read-only revocation', async t => {
  const f = await fixture(t), h = host(f.root); t.after(() => h.dispose())
  h.setPolicyHook(count => { if (count === 1) queueMicrotask(() => h.setMode('read-only')) })
  await assert.rejects(h.call(page), /LOCAL_MEMORY_POLICY_DENIED/)
  assert.equal(await f.exists(path.join(f.root, '.dsh')), false)
})
test('actual backend write hooks reject a new committed event after lease capture', async t => {
  const f = await fixture(t), h = host(f.root); t.after(() => h.dispose())
  h.setPolicyHook(count => { if (count === 1) queueMicrotask(() => h.events.push({ type: 'step/end', seq: 1, data: {} })) })
  await assert.rejects(h.call(page), /LOCAL_MEMORY_POLICY_DENIED/)
  assert.equal(await f.exists(path.join(f.root, '.dsh')), false)
})
test('actual backend observes plugin unload before a not-yet-started write', async t => {
  const f = await fixture(t), h = host(f.root); t.after(() => h.dispose())
  h.setPolicyHook(count => { if (count === 1) queueMicrotask(() => h.dispose()) })
  await assert.rejects(h.call(page), { name: 'AbortError' })
  assert.equal(await f.exists(path.join(f.root, '.dsh')), false)
})
test('actual registered tools cannot recall another original workspace', async t => {
  const a = await fixture(t), b = await fixture(t), ha = host(a.root), hb = host(b.root, { id: 'local-memory-integration-b' }); t.after(() => { ha.dispose(); hb.dispose() })
  const saved = await ha.call(page); await a.capture(saved)
  assert.deepEqual((await hb.call({ action: 'search', query: '取消' })).items, [])
  assert.equal((await hb.call({ action: 'read', id: saved.id })).found, false)
  assert.equal(await b.exists(path.join(b.root, '.dsh')), false)
})
