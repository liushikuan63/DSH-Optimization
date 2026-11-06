import {runEffect} from './effect-harness.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { createContextStore as createStore, LIMITS, validateReference } from '../plugins/context-checkpoint/store.mjs'
// Deprecated synchronous reads are used ONLY by these bounded test fixtures.
function createContextStore(root, options = {}) {
  return createStore(root, { readEvents: async (s, from, to) => s.snapshotEvents(from, to), ...options })
}
import { apply, TOOL_NAME, CONTEXT_PROMPT } from '../plugins/context-checkpoint/index.mjs'

const BASE = (process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
const NOW = 1_800_000_000_000
const sha = value => createHash('sha256').update(value).digest('hex')
const clone = value => JSON.parse(JSON.stringify(value))
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(BASE, 'jizhi-context-test-'))
  assert.equal(path.relative(os.homedir(), root).startsWith('..') || path.isAbsolute(path.relative(os.homedir(), root)), true)
  const files = new Set(), dirs = new Set([root])
  const registerScope = id => {
    const base = path.join(root, '.dsh', 'jizhi-context'), dir = path.join(base, sha(id))
    for (const d of [path.join(root, '.dsh'), base, dir]) dirs.add(d)
    files.add(path.join(base, 'write.lock'))
    for (const name of ['checkpoint-v1.json', 'previous-v1.json', 'checkpoint-v1.tmp', 'previous-v1.tmp']) files.add(path.join(dir, name))
    return { dir, file: path.join(dir, 'checkpoint-v1.json'), previous: path.join(dir, 'previous-v1.json') }
  }
  t.after(async () => {
    // Only exact, registered fixture entries; never recursive cleanup, never home.
    for (const file of files) { try { await fs.unlink(file) } catch (e) { if (e.code !== 'ENOENT') throw e } }
    for (const dir of [...dirs].sort((a, b) => b.length - a.length)) { try { await fs.rmdir(dir) } catch (e) { if (e.code !== 'ENOENT') throw e } }
  })
  const scope = registerScope('session-a')
  return {
    root, ...scope, registerScope,
    registerFile(file) { files.add(file) }, registerDir(dir) { dirs.add(dir) },
    async source(name, text = 'original\n') { const file = path.join(root, name); files.add(file); await fs.writeFile(file, text); return file },
    store: createContextStore(root, { now: () => NOW, ...options }),
  }
}
// Public Session contract checked with Inspect: seq is exclusive, firstLiveSeq is
// NOT the fork boundary; isOwnSeq excludes inherited history even after restart.
function session(root, events = [], id = 'session-a', { inherited = 0, firstLive = 0 } = {}) {
  return {
    id, header: { id, cwd: root, isSeeded: inherited > 0 }, inheritedEventCount: inherited, firstLiveSeq: firstLive,
    surface: { replaceGeneration: 0, contentGeneration: 0, nodes: [] },
    get seq() { return events.reduce((n, e) => Math.max(n, e.seq + 1), 0) },
    snapshotEvents(from = 0, to = this.seq) { return events.filter(e => e.seq >= from && e.seq < to) },
    isOwnSeq(seq) { return seq >= inherited },
  }
}
function user(seq, text, source = 'user') {
  return { type: 'user/message', seq, time: NOW, surfaceOp: 'append', data: { role: 'user', source: { kind: source }, content: [{ type: 'text', text }] } }
}
function pair(id, seq, options = {}) {
  return [
    { type: 'tool/call', seq, time: NOW, data: { turn: 1, step: 1, callId: id, name: options.tool ?? 'read', arguments: '{"token":"RAW_ARGUMENT_SECRET"}' } },
    { type: 'tool/result', seq: seq + 1, time: NOW, surfaceOp: 'append', sourceEventSeqs: [seq], data: { turn: 1, step: 1, ...(options.error ? { error: options.error } : {}), message: { role: 'tool', source: { kind: 'tool', callId: id }, toolCallId: id, isError: options.isError ?? false, content: [{ type: 'text', text: options.text ?? 'RAW_RESULT_SECRET' }] } } },
  ]
}
const note = (objective = '保留关键约束') => ({ objective, acceptance: ['正反测试通过'], constraints: ['只写独占文件'], decisions: ['使用本地快照'], rejectedApproaches: ['不声称无损日志'], evidence: [], changedFiles: [], openItems: ['复核当前状态'], nextSteps: ['先 restore 再核对'], status: 'active' })
async function envelope(file, mutate) {
  const raw = JSON.parse(await fs.readFile(file, 'utf8'))
  mutate(raw)
  await fs.writeFile(file, JSON.stringify(raw))
}
function reseal(raw) { raw.checksum = sha(JSON.stringify(raw.payload)) }

test('save/read/restart is read-only on restore; actual file readback SHA survives', async t => {
  const f = await fixture(t), s = session(f.root, [user(0, '保留目标'), ...pair('read-one', 1)])
  await f.source('work.mjs')
  const saved = await f.store.save(s, { ...note(), changedFiles: [{ path: 'work.mjs', owner: 'captain', status: 'modified' }], evidence: [{ summary: '工具派发完成，不代表测试通过', callId: 'read-one' }] })
  assert.match(saved.checkpoint, /^[a-f0-9]{64}:1$/)
  const before = await fs.readFile(f.file, 'utf8')
  const restored = await createContextStore(f.root, { now: () => NOW }).restore(s)
  assert.equal(restored.note.objective, note().objective)
  assert.equal(restored.note.changedFiles[0].readback.sha256, sha('original\n'))
  assert.equal(restored.files[0].comparison, 'unchanged')
  assert.equal(restored.currentVerification, 'unverified')
  assert.equal(restored.historicalOnly, true)
  assert.match(restored.boundary, /非指令|not instructions/)
  assert.equal(await fs.readFile(f.file, 'utf8'), before)
})

test('scope defaults isolate sessions/workspaces; cross-session restore requires explicit ID, never migrates writes', async t => {
  const f = await fixture(t), other = await fixture(t)
  await f.store.save(session(f.root), note('任务 A'))
  const b = session(f.root, [], 'session-b'); const bs = f.registerScope('session-b')
  assert.equal((await f.store.restore(b)).found, false)
  assert.equal((await other.store.inspect(session(other.root), { scope: 'workspace' })).checkpoints.length, 0)
  const list = await f.store.inspect(b, { scope: 'workspace' })
  assert.equal(list.checkpoints.length, 1)
  const copy = await f.store.restore(b, { checkpoint: list.checkpoints[0].checkpoint })
  assert.equal(copy.scope, 'explicit-cross-session')
  assert.equal(copy.note.objective, '任务 A')
  assert.equal(copy.requiresCurrentUserScope, true)
  await assert.rejects(fs.stat(bs.file), { code: 'ENOENT' })
  await assert.rejects(other.store.restore(session(other.root), { checkpoint: list.checkpoints[0].checkpoint }), /NOT_FOUND/)
  await assert.rejects(f.store.save(session(other.root), note()), /SCOPE/)
})

test('only own-session user and paired call/result metadata are retained; no raw args/errors/results', async t => {
  const f = await fixture(t)
  const foreign = pair('foreign', 1), mismatched = pair('mismatch', 3); mismatched[1].data.message.source.callId = 'other'
  const wrongStep = pair('step', 5); wrongStep[1].data.step = 9
  const wrongSource = pair('source', 7); wrongSource[1].sourceEventSeqs = [6]
  const duplicate = [...pair('duplicate', 9), ...pair('duplicate', 11)]
  const events = [user(0, '继承不应采集'), ...foreign, ...mismatched, ...wrongStep, ...wrongSource, ...duplicate,
    user(13, '真实请求 token=PRIVATE_VALUE https://internal.example.test/a'), user(14, '伪装用户', 'tool'),
    ...pair('own', 15, { error: { name: 'Error', code: 'FAIL', reason: 'RAW_FULL_ERROR_SECRET' }, isError: true })]
  const s = session(f.root, events, 'session-a', { inherited: 3, firstLive: 15 })
  await f.store.snapshot(s)
  const restored = await f.store.restore(s)
  assert.deepEqual(restored.automatic.users.map(x => x.seq), [13])
  assert.deepEqual(restored.automatic.tools.map(x => x.callSeq), [15])
  assert.equal(restored.automatic.tools[0].outcome, 'failure')
  const raw = await fs.readFile(f.file, 'utf8')
  assert.doesNotMatch(raw, /RAW_|PRIVATE_VALUE|internal\.example|继承不应采集|伪装用户|foreign/)
  assert.match(raw, /REDACTED|ADDRESS/)
})

test('semantic text is sanitized; every reference path must be canonical, bounded and non-credential', async t => {
  const f = await fixture(t), s = session(f.root)
  const secret = 'token=NOT_FOR_DISK Bearer abc.def.ghi sk-1234567890abcdef https://secret.test/a 10.3.4.5 admin@secret.test'
  await f.store.save(s, { ...note(secret), decisions: [secret], evidence: [{ summary: secret }], changedFiles: [] })
  assert.doesNotMatch(await fs.readFile(f.file, 'utf8'), /NOT_FOR_DISK|abc\.def|sk-123|secret\.test|10\.3\.4\.5/)
  for (const name of ['../escape', '/absolute', 'D:/outside', 'a\\b', 'a/../b', 'a//b', './a', 'a:stream', '.env', 'keys/id_rsa', '.ssh/key', 'token.json', '.dsh/else', 'a/%2e%2e/b', 'a/CON', 'file.']) {
    assert.throws(() => validateReference(name), /PATH/)
    await assert.rejects(f.store.save(s, { ...note(), changedFiles: [{ path: name, owner: 'me', status: 'modified' }] }), /PATH/)
  }
  assert.equal(validateReference('src/main.mjs'), 'src/main.mjs')
})

test('restore compares added/changed/missing/unknown and never upgrades old test evidence', async t => {
  const f = await fixture(t), s = session(f.root)
  const changed = await f.source('changed.mjs'), missing = await f.source('missing.mjs'), large = await f.source('large.mjs', 'x'.repeat(LIMITS.maxFileBytes + 1))
  f.registerFile(path.join(f.root, 'new.mjs'))
  await f.store.save(s, { ...note(), changedFiles: ['changed.mjs', 'missing.mjs', 'new.mjs', 'large.mjs'].map(p => ({ path: p, owner: 'me', status: 'unknown' })), evidence: [{ summary: '以前通过，不是当前结果' }] })
  await fs.writeFile(changed, 'changed\n'); await fs.unlink(missing); await fs.writeFile(path.join(f.root, 'new.mjs'), 'added')
  const result = await f.store.restore(s)
  assert.deepEqual(result.files.map(x => x.comparison), ['changed', 'missing', 'added', 'unknown'])
  assert.equal(result.needsRevalidation, true)
  assert.equal(result.currentVerification, 'unverified')
  assert.equal(result.note.evidence[0].basis, 'model-note-unverified')
  assert.equal((await fs.stat(large)).size, LIMITS.maxFileBytes + 1)
})

test('source and store symlinks, ancestor junctions and hardlinks fail closed', async t => {
  const f = await fixture(t), s = session(f.root)
  const target = await f.source('target.mjs'), hard = path.join(f.root, 'hard.mjs'); f.registerFile(hard)
  await fs.link(target, hard)
  await assert.rejects(f.store.save(s, { ...note(), changedFiles: [{ path: 'hard.mjs', owner: 'me', status: 'modified' }] }), /LINK/)
  await fs.unlink(hard)
  const linkedDir = path.join(f.root, 'linked'); f.registerFile(linkedDir)
  await fs.symlink(f.root, linkedDir, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(f.store.save(s, { ...note(), changedFiles: [{ path: 'linked/target.mjs', owner: 'me', status: 'modified' }] }), /LINK/)
  await fs.unlink(linkedDir)
  await f.store.save(s, note())
  const alias = path.join(f.root, 'store-alias.json'); f.registerFile(alias); await fs.link(f.file, alias)
  await assert.rejects(f.store.restore(s), /LINK/)
  await fs.unlink(alias)
  // Separate fixture proves a store ancestor link without moving a populated directory.
  const g = await fixture(t), elsewhere = path.join(g.root, 'elsewhere'); g.registerDir(elsewhere); await fs.mkdir(elsewhere)
  const dsh = path.join(g.root, '.dsh'); g.registerFile(dsh)
  await fs.symlink(elsewhere, dsh, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(g.store.save(session(g.root), note()), /LINK/)
  await fs.unlink(dsh)
})

test('malformed, future, truncated and checksum-mismatched checkpoints fail closed; explicit previous still readable', async t => {
  const f = await fixture(t), s = session(f.root)
  await f.store.save(s, note('previous')); await f.store.save(s, note('latest'))
  const valid = await fs.readFile(f.file, 'utf8'), previousId = sha(s.id) + ':1'
  for (const bad of ['{', valid.slice(0, 80), JSON.stringify({ schemaVersion: 99 }), valid.replace('latest', 'tampered')]) {
    await fs.writeFile(f.file, bad)
    await assert.rejects(f.store.restore(s), /SCHEMA|CORRUPT/)
    assert.equal((await f.store.restore(s, { checkpoint: previousId })).note.objective, 'previous')
  }
  await fs.writeFile(f.file, valid)
  await envelope(f.file, raw => { raw.payload.note.unexpected = true; reseal(raw) })
  await assert.rejects(f.store.restore(s), /SCHEMA/)
  await fs.writeFile(f.file, valid)
  await envelope(f.file, raw => { raw.payload.note.changedFiles = [{ path: '../escape', owner: 'x', status: 'modified', readback: { kind: 'missing', sha256: null } }]; reseal(raw) })
  await assert.rejects(f.store.restore(s), /PATH|SCHEMA/)
})

test('cancelled/blocked remains historical and rollback does not resurrect; signals never retry', async t => {
  const f = await fixture(t), events = [], s = session(f.root, events)
  await f.store.save(s, note('before cancellation'))
  events.push({ type: 'turn/end', seq: 0, time: NOW, data: { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } } })
  await f.store.snapshot(s)
  const restored = await f.store.restore(s)
  assert.equal(restored.status, 'cancelled'); assert.equal(restored.mayResumeAutomatically, false)
  await f.store.rollback(s)
  assert.equal((await f.store.restore(s)).status, 'cancelled')
  const bytes = await fs.readFile(f.file, 'utf8'), abort = new AbortController(); abort.abort()
  await assert.rejects(f.store.save(s, note(), { signal: abort.signal }), { name: 'AbortError' })
  assert.equal(await fs.readFile(f.file, 'utf8'), bytes)
  const b = await fixture(t), bs = session(b.root)
  await b.store.save(bs, { ...note(), status: 'blocked' }); await b.store.snapshot(bs)
  assert.equal((await b.store.restore(bs)).status, 'blocked')
})

test('disable persists and retains read-only restore; rollback keeps disabled latch', async t => {
  const f = await fixture(t), s = session(f.root)
  await f.store.save(s, note()); await f.store.disable(s)
  const before = await fs.readFile(f.file, 'utf8')
  assert.equal((await f.store.snapshot(s)).disabled, true)
  assert.equal((await f.store.save(s, note('ignored'))).disabled, true)
  assert.equal(await fs.readFile(f.file, 'utf8'), before)
  assert.equal((await f.store.restore(s)).note.objective, note().objective)
  await f.store.rollback(s)
  assert.equal((await createContextStore(f.root, { now: () => NOW }).inspect(s)).disabled, true)
})

test('bytes, cardinality, TTL and durable budgets bound growth, including after restart', async t => {
  const f = await fixture(t, { limits: { maxWritesPerDay: 3 } }), s = session(f.root)
  for (const objective of ['one', 'two', 'three']) await f.store.save(s, note(objective))
  await assert.rejects(createContextStore(f.root, { now: () => NOW, limits: { maxWritesPerDay: 3 } }).save(s, note('four')), /BUDGET/)
  assert.equal((await fs.readdir(f.dir)).length, 2)
  assert.ok((await fs.stat(f.file)).size <= LIMITS.maxBytes)
  assert.equal((await createContextStore(f.root, { now: () => NOW + LIMITS.ttlMs + 1000 }).restore(s)).found, false)
  const g = await fixture(t, { limits: { maxSessions: 2 } })
  for (const id of ['session-a', 'session-b']) { g.registerScope(id); await g.store.save(session(g.root, [], id), note(id)) }
  const beforeFull = await Promise.all(['session-a', 'session-b'].map(id => fs.readFile(g.registerScope(id).file, 'utf8')))
  const denied = g.registerScope('session-c')
  await assert.rejects(g.store.save(session(g.root, [], 'session-c'), note()), { message: 'JIZHI_CONTEXT_CAPACITY' })
  await assert.rejects(fs.stat(denied.dir), { code: 'ENOENT' })
  assert.deepEqual(await Promise.all(['session-a', 'session-b'].map(id => fs.readFile(g.registerScope(id).file, 'utf8'))), beforeFull)
  await g.store.save(session(g.root), note('existing session still writable at capacity'))
  assert.equal((await g.store.restore(session(g.root))).note.objective, 'existing session still writable at capacity')
  const events = Array.from({ length: 40 }, (_, i) => user(i, '请求 ' + i))
  const h = await fixture(t); await h.store.snapshot(session(h.root, events))
  assert.equal((await h.store.restore(session(h.root, events))).automatic.users.length, LIMITS.maxUsers)
  await assert.rejects(h.store.save(session(h.root), { ...note(), constraints: Array(40).fill('x') }), /INPUT/)
})

test('no writes on inspect/empty restore; exclusive lock refuses concurrent/stale writers without deleting it', async t => {
  const f = await fixture(t), s = session(f.root)
  assert.equal((await f.store.inspect(s)).checkpoints.length, 0)
  assert.equal((await f.store.restore(s)).found, false)
  await assert.rejects(fs.stat(path.join(f.root, '.dsh')), { code: 'ENOENT' })
  await f.store.save(s, note())
  const lock = path.join(f.root, '.dsh', 'jizhi-context', 'write.lock'); await fs.writeFile(lock, 'owned elsewhere')
  await assert.rejects(f.store.save(s, note('blocked by lock')), /LOCKED/)
  assert.equal(await fs.readFile(lock, 'utf8'), 'owned elsewhere')
  await fs.unlink(lock)
  await Promise.all([f.store.save(s, note('serialized one')), f.store.save(s, note('serialized two'))])
  assert.equal((await f.store.restore(s)).note.objective, 'serialized two')
})

// These are ONLY real inspected extension points, not a synthetic compaction API.
// `agent-preset/selected` is the SDK's switch notification: select() recomposes
// and emits it without re-emitting agent/created, which is why the plugin
// installs per-agent extras from both events.
const MODES = { 'agent/created': 'serial', 'agent/turn-stopping': 'serial', 'session/event': 'emit', 'agent-preset/selected': 'emit' }
const contextStates = new WeakMap()
function context(preset = 'ultimate-model') {
  const effects = [], listeners = new Map(), tools = new Map(), sections = new Map(), sessions = new Map(), guards = new Set(), identities = new Map()
  const leases = { opened: 0, disposed: 0 }
  const ctx = {
    preset,
    effect(factory) { const dispose = runEffect(factory); effects.push(dispose); return dispose },
    on(name, fn) { assert.ok(MODES[name], 'event must exist in inspected Host contract'); const bucket = listeners.get(name) ?? new Set(); bucket.add(fn); listeners.set(name, bucket); return () => { bucket.delete(fn); if (!bucket.size) listeners.delete(name) } },
    tools: { register(value) { assert.equal(tools.has(value.name), false); tools.set(value.name, value); return () => tools.delete(value.name) }, guard(fn) { guards.add(fn); return () => guards.delete(fn) } },
    systemPrompt: { section(value) { sections.set(value.name, value); return () => sections.delete(value.name) } },
    agentPresets: { composedPreset(other) { return other.preset } },
    sessionQuery: { async observeSession(id, options) {
      assert.equal(options.projectionMode, 'none')
      const s = sessions.get(id); assert.ok(s, 'query only a registered exact session')
      leases.opened++
      let disposed = false
      return { source: 'live', header: s.header, inheritedEventCount: s.inheritedEventCount, events: s.snapshotEvents(), cursor: s.seq - 1,
        [Symbol.dispose]() { assert.equal(disposed, false); disposed = true; leases.disposed++ } }
    } },
  }
  // The plugin acquires profile services the way a bundle row must: optionally,
  // through ctx.get(), never by touching a possibly-absent property.
  const restricted = []
  ctx.get = function get(name) {
    if (name === 'sandboxPolicy') return { resolve: () => ({ mode: 'workspace-write' }) }
    if (name === 'agentPresets') return { composedPreset: (scope) => scope.preset }
    if (name === 'sessionQuery') return this.sessionQuery
    if (name === 'agents') return { get: id => identities.get(id) }
    return undefined
  }
  ctx.tools.restrict = (filter) => { restricted.push(filter); return () => { const i = restricted.indexOf(filter); if (i >= 0) restricted.splice(i, 1) } }
  contextStates.set(ctx, sessions)
  return { ctx, listeners, tools, sections, leases, guards, restricted,
    async dispatch(name, ...args) {
      if (name === 'agent/created') { const a = args[0].agent; identities.set(a.id, a); contextStates.get(a.ctx)?.set(a.id, a.session); sessions.set(a.id, a.session); Object.defineProperty(a.ctx, 'sessionQuery', { configurable: true, get() { throw Error('cannot get property "sessionQuery" without inject') } }) }
      for (const listener of listeners.get(name) ?? []) { const result = listener(...args); if (MODES[name] === 'serial') await result }
    },
    prompt() { return [...sections.values()].map(x => typeof x.text === 'function' ? x.text({}) : x.text).join('\n') },
    dispose() { for (const remove of effects.toReversed()) remove() },
  }
}

test('audited real event wiring is agent-owned, serial stop saves, standard contributes nothing, dispose removes all', async t => {
  const f = await fixture(t, { now: () => Date.now() }), host = context(), active = context(), standard = context('standard')
  apply(host.ctx)
  // Two host-level listeners are correct: creation, and the SDK's switch
  // notification (select() never re-emits creation). Nothing agent-scoped may
  // exist yet, and no tool/section may be registered before an agent appears.
  assert.deepEqual([...host.listeners.keys()].sort(), ['agent-preset/selected', 'agent/created'])
  // The tool and its restore gate live on the HOST ctx: the plugin is a
  // bundle-level row, and a preset-scope row never receives agent/created on
  // this host. What must stay empty before an agent appears is the agent side.
  assert.equal(host.tools.size, 1, 'the tool is registered once, on the host ctx')
  assert.equal(host.sections.size, 0)
  const events = [{ ...user(0, '真实请求'), time: Date.now() }], s = session(f.root, events), a = { id: s.id, session: s, ctx: active.ctx }
  await host.dispatch('agent/created', { agent: a, source: 'startup' })
  await host.dispatch('agent/created', { agent: { id: 'std', session: session(f.root, [], 'std'), ctx: standard.ctx }, source: 'startup' })
  assert.equal(standard.tools.size, 0); assert.equal(standard.sections.size, 0); assert.equal(standard.listeners.size, 0, "standard listeners: " + JSON.stringify([...standard.listeners.keys()]))
  const tool = host.tools.get(TOOL_NAME); assert.ok(tool)
  assert.equal(tool.parameters.additionalProperties, false)
  assert.deepEqual(tool.parameters.required, ['request'])
  assert.deepEqual(Object.keys(tool.parameters.properties), ['request'])
  assert.equal(tool.parameters.properties.path, undefined); assert.equal(tool.parameters.properties.approved, undefined)
  assert.equal(tool.parameters.properties.permissions, undefined)
  await active.dispatch('agent/turn-stopping', { agent: a, turn: 1, signal: new AbortController().signal })
  const result = await tool.execute({ request: '{"action":"restore"}' }, { agent: a, signal: new AbortController().signal })
  assert.equal(JSON.parse(result.text).automatic.users[0].seq, 0)
  // One awaited stop snapshot + one restore, each opens/releases exactly one real-contract lease.
  assert.equal(host.leases.opened, 2)
  assert.equal(host.leases.disposed, 2)
  assert.deepEqual(tool.output.render({}, result), [{ type: 'text', text: result.text }])
  assert.match(active.prompt(), /jizhi_context/); assert.match(CONTEXT_PROMPT, /save/)
  for (const args of [{ action: 'restore', path: '../out' }, { action: 'save', note: note(), approved: true }, { action: 'disable', permission: 'full' }, { action: 'rollback', checkpoint: 'fake' }]) {
    await assert.rejects(tool.execute(args, { agent: a }), /INPUT/)
  }
  await assert.rejects(tool.execute({ action: 'inspect' }, { agent: { ...a } }), /SCOPE/)
  const bytes = await fs.readFile(f.file, 'utf8'), abort = new AbortController(); abort.abort()
  await active.dispatch('agent/turn-stopping', { agent: a, turn: 1, signal: abort.signal })
  assert.equal(await fs.readFile(f.file, 'utf8'), bytes)
  host.dispose()
  assert.equal(active.tools.size, 0); assert.equal(active.sections.size, 0); assert.equal(active.listeners.size, 0); assert.equal(host.listeners.size, 0)
  await assert.rejects(tool.execute({ action: 'inspect' }, { agent: a }), { name: 'AbortError' })
})

test('restore reminder follows real surface generation/resume, rejects foreign events, never steers or wakes', async t => {
  const f = await fixture(t, { now: () => Date.now() }), host = context(), c = context(), s = session(f.root), a = { id: s.id, session: s, ctx: c.ctx }
  await f.store.save(s, note())
  apply(host.ctx); await host.dispatch('agent/created', { agent: a, source: 'resume' })
  assert.match(c.prompt(), /restore/)
  const tool = host.tools.get(TOOL_NAME)
  await tool.execute({ action: 'restore' }, { agent: a })
  const foreign = session(f.root, [], 'foreign')
  await c.dispatch('session/event', foreign, { type: 'turn/end', seq: 0, data: { reason: { kind: 'aborted' } } })
  assert.doesNotMatch(c.prompt(), /status=cancelled/)
  s.surface.replaceGeneration++
  await c.dispatch('session/event', s, { type: 'user/message', seq: 0, data: {} })
  assert.match(c.prompt(), /needsRestore=true/)
  assert.ok(c.prompt().length < 1500)
  host.dispose()
})

test('disposing while agent initialization awaits disk cannot leak later registrations', async t => {
  const f = await fixture(t), host = context(), c = context(), s = session(f.root), a = { id: s.id, session: s, ctx: c.ctx }
  apply(host.ctx)
  const starting = host.dispatch('agent/created', { agent: a, source: 'startup' })
  host.dispose()
  await starting
  assert.equal(c.tools.size, 0)
  assert.equal(c.sections.size, 0)
  assert.equal(c.listeners.size, 0)
})

test('oversized semantic snapshot preserves last good bytes; automatic metadata has independent caps', async t => {
  const f = await fixture(t, { limits: { maxBytes: 2400 } }), s = session(f.root)
  await f.store.save(s, note('small'))
  const before = await fs.readFile(f.file, 'utf8')
  const huge = { ...note('huge'), decisions: Array(8).fill('一'.repeat(512)), constraints: Array(8).fill('二'.repeat(512)) }
  await assert.rejects(f.store.save(s, huge), /SIZE/)
  assert.equal(await fs.readFile(f.file, 'utf8'), before)
  const g = await fixture(t), events = Array.from({ length: 40 }, (_, i) => pair('bounded-' + i, i * 2)).flat()
  for (let i = 0; i < 10; i++) events.push({ type: 'request/header', seq: 80 + i, time: NOW, data: { reason: 'series', header: { token: 'HEADER_MUST_NOT_SURVIVE' } } })
  await g.store.snapshot(session(g.root, events))
  const restored = await g.store.restore(session(g.root, events))
  assert.equal(restored.automatic.tools.length, LIMITS.maxTools)
  assert.equal(restored.automatic.requests.length, LIMITS.maxRequests)
  assert.doesNotMatch(await fs.readFile(g.file, 'utf8'), /HEADER_MUST_NOT_SURVIVE|RAW_ARGUMENT_SECRET|RAW_RESULT_SECRET/)
})


test('recovery gate requires restore before semantic overwrite and critical writes', async t => {
  const f = await fixture(t), host = context(), active = context()
  t.after(() => host.dispose())
  apply(host.ctx)
  const s = session(f.root, [{ ...user(0, 'current request'), time: Date.now() }]), a = { id: s.id, session: s, ctx: active.ctx }
  await host.dispatch('agent/created', { agent: a, source: 'startup' })
  const tool = host.tools.get(TOOL_NAME)
  await tool.execute({ action: 'save', note: note('durable milestone') }, { agent: a })
  assert.equal(host.guards.size, 1)
  const denied = (name, agent = a) => [...host.guards].map(fn => fn({ agent, name, arguments: {} })).find(Boolean)
  assert.equal(denied('write'), undefined)
  s.surface.replaceGeneration++
  for (const name of ['write', 'edit', 'win_bash', 'bash', 'pwsh']) assert.match(denied(name) ?? '', /RESTORE_REQUIRED/)
  assert.equal(denied('read'), undefined)
  assert.equal(denied('write', {}), undefined)
  const before = await fs.readFile(f.file, 'utf8')
  await assert.rejects(tool.execute({ action: 'save', note: note('forgotten replacement') }, { agent: a }), /RESTORE_REQUIRED/)
  assert.equal(await fs.readFile(f.file, 'utf8'), before)
  for (const input of [{ action: 'restore', scope: 'session' }, { action: 'restore', note: {} }]) {
    await assert.rejects(tool.execute({ request: JSON.stringify(input) }, { agent: a }), /INPUT/)
    assert.match(denied('write') ?? '', /RESTORE_REQUIRED/)
  }
  const restored = JSON.parse((await tool.execute({ request: '{"action":"restore"}' }, { agent: a })).text)
  assert.equal(restored.currentVerification, 'unverified')
  assert.equal(denied('write'), undefined)
  host.dispose(); assert.equal(host.guards.size, 0)
})

test('mode switch removes context prompt and listener, preserves state, and reinstalls once', async t => {
  const f = await fixture(t, { now: () => Date.now() }), host = context(), active = context()
  t.after(() => host.dispose())
  apply(host.ctx)
  const s = session(f.root), a = { id: s.id, session: s, ctx: active.ctx }
  await host.dispatch('agent/created', { agent: a, source: 'startup' })
  const tool = host.tools.get(TOOL_NAME)
  const saved = JSON.parse((await tool.execute({ request: JSON.stringify({ action: 'save', note: note('preserve across mode switch') }) }, { agent: a })).text)
  const before = await fs.readFile(f.file, 'utf8')
  active.ctx.preset = 'standard'
  assert.equal(active.prompt(), '', 'MODE_BOUNDARY_PROMPT_MUST_NOT_WAIT_FOR_SELECTION_NOTIFICATION')
  await host.dispatch('agent-preset/selected', a.id, 'standard')
  assert.equal(active.sections.size, 0, 'MODE_SWITCH_MUST_DISPOSE_CONTEXT_SECTION')
  assert.equal(active.listeners.size, 0, 'MODE_SWITCH_MUST_DISPOSE_AUTOMATIC_LISTENER')
  assert.ok(active.restricted.some(filter => filter.deny?.includes(TOOL_NAME)))
  await active.dispatch('agent/turn-stopping', { signal: new AbortController().signal })
  assert.equal(await fs.readFile(f.file, 'utf8'), before)
  active.ctx.preset = 'ultimate-model'
  await host.dispatch('agent-preset/selected', a.id, 'ultimate-model')
  await host.dispatch('agent-preset/selected', a.id, 'ultimate-model')
  assert.equal(active.sections.size, 1)
  assert.equal(active.listeners.get('agent/turn-stopping').size, 1)
  assert.equal(active.restricted.length, 0)
  assert.ok(active.prompt().includes(saved.checkpoint))
  const restored = JSON.parse((await tool.execute({ request: '{"action":"restore"}' }, { agent: a })).text)
  assert.equal(restored.note.objective, 'preserve across mode switch')
  await active.dispatch('agent/turn-stopping', { signal: new AbortController().signal })
  const status = JSON.parse((await tool.execute({ request: '{"action":"inspect"}' }, { agent: a })).text)
  assert.equal(status.turnStoppingSeen, 1)
})
