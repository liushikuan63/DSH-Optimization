import os from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const pack = fileURLToPath(new URL('..', import.meta.url))
const { apply: contextApply } = await import(pathToFileURL(path.join(pack, 'plugins/context-checkpoint/index.mjs')))
const { apply: experienceApply } = await import(pathToFileURL(path.join(pack, 'plugins/experience-loop/index.mjs')))
const { runEffect } = await import(pathToFileURL(path.join(pack, 'tests/effect-harness.mjs')))

async function fixture(t, apply, { mode = 'read-only', text = '请实施本任务修复并保存工作状态', policyThrows = false, origin } = {}) {
  const root = await fs.mkdtemp(path.join((process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir()), 'dsh-persistence-repair-'))
  const id = 'session-policy-test'
  const events = [
    { type: 'user/message', seq: 0, time: Date.now(), data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } },
    { type: 'tool/call', seq: 1, time: Date.now(), data: { turn: 1, step: 1, callId: 'fixture-read', name: 'read', arguments: '{}' } },
    { type: 'tool/result', seq: 2, time: Date.now(), surfaceOp: 'append', sourceEventSeqs: [1], data: { turn: 1, step: 1, message: { role: 'tool', source: { kind: 'tool', callId: 'fixture-read' }, toolCallId: 'fixture-read', isError: false, content: [{ type: 'text', text: 'fixture read completed' }] } } },
  ]
  const session = { id, header: { id, cwd: root, isSeeded: false, ...(origin ? { origin } : {}) }, inheritedEventCount: 0, firstLiveSeq: 0, get seq() { return events.length }, isOwnSeq: () => true, surface: { replaceGeneration: 0, nodes: [] } }
  const tools = new Map(), guards = new Set(), rootEvents = new Map(), scopedEvents = new Map(), effects = []
  const add = (map, name, handler) => { const set = map.get(name) || new Set(); map.set(name, set); set.add(handler); return () => { set.delete(handler); if (!set.size) map.delete(name) } }
  const emit = async (map, name, ...args) => { for (const f of [...(map.get(name) || [])]) await f(...args) }
  const toolService = { register: tool => { tools.set(tool.name, tool); return () => tools.delete(tool.name) }, guard: guard => { guards.add(guard); return () => guards.delete(guard) }, restrict: () => () => {} }
  const prompt = { section: () => () => {} }
  const scoped = { tools: toolService, systemPrompt: prompt, on: (name, handler) => add(scopedEvents, name, handler) }
  const agent = { id, session, ctx: scoped }
  const services = {
    agentPresets: { composedPreset: () => 'ultimate-model' },
    agents: { get: key => key === id ? agent : undefined },
    sandboxPolicy: { resolve: ({ session: supplied }) => { assert.equal(supplied, session); if (policyThrows) throw Error('policy unavailable'); return { mode, workspaceRoot: root, sessionId: id } } },
    sessionQuery: { observeSession: async key => { assert.equal(key, id); return { source: 'live', header: session.header, inheritedEventCount: 0, events: events.slice(), cursor: events.length - 1, [Symbol.dispose]() {} } } },
  }
  scoped.get = name => services[name]
  const ctx = { tools: toolService, systemPrompt: prompt, get: name => services[name], on: (name, handler) => add(rootEvents, name, handler), effect: fn => { const dispose = runEffect(fn); effects.push(dispose); return dispose } }
  apply(ctx)
  await emit(rootEvents, 'agent/created', { agent, source: 'startup', signal: new AbortController().signal })
  const exists = async () => { try { return (await fs.readdir(root)).includes('.dsh') } catch { return false } }
  t.after(async () => {
    for (const dispose of effects.toReversed()) dispose()
    // Remove only named files inside this registered, isolated fixture; never recursive delete.
    const sha = (await import('node:crypto')).createHash('sha256').update(id).digest('hex')
    const dirs = [path.join(root, '.dsh', 'jizhi-context', sha), path.join(root, '.dsh', 'jizhi-context'), path.join(root, '.dsh', 'jizhi-experience'), path.join(root, '.dsh'), root]
    for (const dir of dirs) {
      for (const leaf of ['checkpoint-v1.json', 'previous-v1.json', 'checkpoint-v1.tmp', 'previous-v1.tmp', 'store-v1.json', 'rollback-v1.json', 'store-v1.tmp', 'rollback-v1.tmp', 'write.lock']) {
        try { await fs.unlink(path.join(dir, leaf)) } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e }
      }
      try { await fs.rmdir(dir) } catch (e) { if (e.code !== 'ENOENT') throw e }
    }
  })
  return { tools, agent, exists, events, services, dispose() { for (const dispose of effects.toReversed()) dispose() }, async stop() { await emit(scopedEvents, 'agent/turn-stopping', { turn: 1, signal: new AbortController().signal }) }, async call(name, action) { return tools.get(name).execute({ request: JSON.stringify(action) }, { agent, signal: new AbortController().signal }) } }
}
for (const [name, apply] of [['jizhi_context', contextApply], ['jizhi_experience', experienceApply]]) {
  test(name + ': host read-only prevents automatic derived directories and files', async t => {
    const f = await fixture(t, apply)
    assert.equal(await f.exists(), false)
    await f.stop()
    assert.equal(await f.exists(), false, 'turn-stopping may not bypass the host read-only policy')
  })
  test(name + ': explicit mutation is refused before creating any store in read-only mode', async t => {
    const f = await fixture(t, apply)
    const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
    await assert.rejects(f.call(name, action), /READ_ONLY|PERSISTENCE_DENIED/)
    assert.equal(await f.exists(), false)
  })
  test(name + ': mutation control actions cannot bypass read-only policy', async t => {
    const f = await fixture(t, apply)
    for (const action of ['disable', 'rollback']) await assert.rejects(f.call(name, { action }), /READ_ONLY|PERSISTENCE_DENIED/)
    assert.equal(await f.exists(), false)
  })
  test(name + ': inspect/restore/query remain pure reads without a store', async t => {
    const f = await fixture(t, apply)
    for (const action of (name === 'jizhi_context' ? ['inspect', 'restore'] : ['query'])) await f.call(name, { action })
    assert.equal(await f.exists(), false)
  })
  test(name + ': unavailable host policy fails closed for automatic persistence', async t => {
    const f = await fixture(t, apply, { policyThrows: true })
    await f.stop()
    assert.equal(await f.exists(), false)
  })
  test(name + ': explicit read-only audit scope also inhibits writes under Full', async t => {
    const f = await fixture(t, apply, { mode: 'danger-full-access', text: '此次仅做只读审阅与提出建议，不执行修改；不创建或更新派生存储。' })
    await f.stop()
    assert.equal(await f.exists(), false)
  })
  for (const text of ['只读审阅配置', '请只读审查插件配置', '只读检查，不执行任何修改', 'Read-only inspection of plugin config', '本次只看代码，不落盘', '不要落盘', '不写盘', '不得写盘', 'do not write to disk']) test(name + ': Full does not override ordinary human read-only wording: ' + text, async t => {
    const f = await fixture(t, apply, { mode: 'danger-full-access', text })
    await f.stop()
    assert.equal(await f.exists(), false)
  })
  test(name + ': delegated child does not treat inherited Full as permission for private derived storage', async t => {
    const f = await fixture(t, apply, { mode: 'danger-full-access', origin: 'subagent', text: '分析当前任务并返回结论' })
    await f.stop()
    assert.equal(await f.exists(), false)
  })
  test(name + ': a direct human may explicitly authorize child derived storage without changing host policy', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write', origin: 'subagent', text: '允许保存本任务状态' })
    await f.stop()
    assert.equal(await f.exists(), true)
  })
  test(name + ': changing to read-only after the initial policy check is rejected before store creation', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write' })
    let readOnly = false, checks = 0
    f.services.sandboxPolicy.resolve = () => { checks++; if (checks === 1) queueMicrotask(() => { readOnly = true }); return { mode: readOnly ? 'read-only' : 'workspace-write' } }
    const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
    await assert.rejects(f.call(name, action), /PERSISTENCE_DENIED/)
    assert.equal(readOnly, true)
    assert.ok(checks >= 2, 'policy must be rechecked inside the write transaction')
    assert.equal(await f.exists(), false)
  })
  test(name + ': a new human read-only scope invalidates the earlier evidence lease before any write', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write' })
    let checks = 0
    f.services.sandboxPolicy.resolve = () => { checks++; if (checks === 1) queueMicrotask(() => f.events.push({ type: 'user/message', seq: f.events.length, time: Date.now(), data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '此次仅做只读审阅，不创建派生存储' }] } })); return { mode: 'workspace-write' } }
    const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
    await assert.rejects(f.call(name, action), /PERSISTENCE_DENIED/)
    assert.equal(await f.exists(), false)
  })
  test(name + ': unloading while an explicit mutation waits for a lease aborts before any store write', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write' })
    const waiting = Promise.withResolvers(), started = Promise.withResolvers()
    const original = f.services.sessionQuery.observeSession
    f.services.sessionQuery.observeSession = async (...args) => { started.resolve(); await waiting.promise; return original(...args) }
    const action = name === 'jizhi_context' ? { action: 'save', note: { objective: '本轮工作', status: 'active' } } : { action: 'review' }
    const pending = f.call(name, action)
    const rejected = assert.rejects(pending, { name: 'AbortError' })
    await started.promise
    f.dispose()
    waiting.resolve()
    await rejected
    assert.equal(await f.exists(), false)
  })
  test(name + ': authorized writable task still records derived state', async t => {
    const f = await fixture(t, apply, { mode: 'workspace-write' })
    await f.stop()
    assert.equal(await f.exists(), true)
  })
}
