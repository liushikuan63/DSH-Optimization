import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { assertDerivedPersistence } from '../../plugins/local-memory/policy.mjs'
const source = await fs.readFile(new URL('../../plugins/local-memory/index.mjs', import.meta.url), 'utf8')
const plain = source.replace(/^import .*\n/gm, '').replace(/^export /gm, '')
function fixture({ mode = 'workspace-write', text = '允许保存本任务状态', origin, noPolicy = false, releaseFailure = false } = {}) {
  const effects = [], listeners = new Map(), tools = new Map(), prompts = new Map(), calls = [], counters = { observed: 0, released: 0, committed: 0 }
  const events = [{ type: 'user/message', seq: 0, data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } }]
  const session = { id: 'current-a', header: { id: 'current-a', cwd: 'D:/metadata-only-facade-test', ...(origin ? { origin } : {}) }, inheritedEventCount: 0, get seq() { return events.length }, isOwnSeq: i => i >= 0 }
  const agent = { id: session.id, session, ctx: {} }, live = new Map([[agent.id, agent]])
  const hooks = { afterObservation: undefined, transaction: undefined, commit: undefined }
  let currentMode = mode
  const services = {
    agents: { get: id => live.get(id) },
    sandboxPolicy: noPolicy ? undefined : { resolve: request => { assert.equal(request.session, session); return { mode: currentMode, workspaceRoot: session.header.cwd } } },
    sessionQuery: { async observeSession(id, options) {
      counters.observed++; assert.equal(id, agent.id); assert.equal(options.projectionMode, 'none')
      await hooks.afterObservation?.()
      return { source: 'live', header: { ...session.header }, inheritedEventCount: 0, events: events.slice(), cursor: events.length - 1, [Symbol.dispose]() { counters.released++; if (releaseFailure) throw new Error('private-unstructured-service-error') } }
    } },
  }
  const createLocalMemoryStore = (root, options = {}) => ({ async execute(input, actor) {
    calls.push({ root, options, input, actor })
    if (['remember', 'forget'].includes(input.action)) {
      assert.equal(typeof options.authorizeMutation, 'function')
      assert.match(actor.sourceSessionHash, /^[a-f0-9]{64}$/)
      await hooks.transaction?.()
      options.authorizeMutation('transaction')
      await hooks.commit?.()
      options.authorizeMutation('commit')
      counters.committed++
    }
    return { action: input.action, status: 'fixture-only', trust: 'unverified-submitter-claim' }
  } })
  const ctx = { get: key => services[key], tools: { register(tool) { assert.equal(tools.has(tool.name), false); tools.set(tool.name, tool); return () => tools.delete(tool.name) } }, systemPrompt: { section(section) { assert.equal(prompts.has(section.name), false); prompts.set(section.name, section); return () => prompts.delete(section.name) } }, on(event, fn) { const set = listeners.get(event) || new Set(); listeners.set(event, set); set.add(fn); return () => { set.delete(fn); if (!set.size) listeners.delete(event) } }, effect(fn) { const dispose = fn(); effects.push(dispose); return dispose } }
  const module = vm.runInNewContext(plain + '\n;({ apply, TOOL_NAME, PROMPT })', { crypto, createLocalMemoryStore, assertDerivedPersistence, AbortController, AbortSignal, Symbol }, { timeout: 1000 })
  module.apply(ctx)
  const invoke = (input, { caller = agent, signal = new AbortController().signal } = {}) => tools.get('local_memory').execute({ request: JSON.stringify(input) }, { agent: caller, signal })
  return { tools, prompts, counters, calls, hooks, agent, events, live, invoke, services, setMode(value) { currentMode = value }, dispose() { for (const fn of effects.toReversed()) fn() }, async disposed() { for (const fn of [...(listeners.get('agent/disposed') || [])]) await fn({ agent }) }, module, ctx }
}
test('one actual tool/prompt registration is removed on unload; no background collector', () => {
  const f = fixture(); assert.equal(f.tools.size, 1); assert.equal(f.prompts.size, 1); assert.equal(f.counters.observed, 0)
  f.dispose(); assert.equal(f.tools.size, 0); assert.equal(f.prompts.size, 0)
})
test('all read actions avoid authorization observation and pass no write callback', async () => {
  const f = fixture({ mode: 'read-only' })
  for (const input of [{ action: 'health' }, { action: 'list' }, { action: 'search', query: '取消' }, { action: 'read', id: 'page-id' }]) await f.invoke(input)
  assert.equal(f.calls.length, 4); assert.equal(f.counters.observed, 0); assert.ok(f.calls.every(c => c.options.authorizeMutation === undefined)); assert.equal(f.counters.committed, 0); f.dispose()
})
test('authorized real caller writes with scoped cwd, hashed provenance and one released lease', async () => {
  const f = fixture(); await f.invoke({ action: 'remember', title: 'fixture', body: 'fixture', kind: 'note' })
  assert.equal(f.counters.committed, 1); assert.equal(f.counters.observed, 1); assert.equal(f.counters.released, 1); assert.equal(f.calls[0].root, f.agent.session.header.cwd); f.dispose()
})
for (const action of ['remember', 'forget']) test(action + ' cannot bypass native read-only policy', async () => {
  const f = fixture({ mode: 'read-only' }); await assert.rejects(f.invoke({ action }), /LOCAL_MEMORY_PERSISTENCE_DENIED/)
  assert.equal(f.calls.length, 0); assert.equal(f.counters.released, 1); f.dispose()
})
test('missing policy fails closed without entering storage', async () => {
  const f = fixture({ noPolicy: true }); await assert.rejects(f.invoke({ action: 'remember' }), /PERSISTENCE_DENIED/); assert.equal(f.calls.length, 0); f.dispose()
})
test('ordinary human read-only scope narrows Full', async () => {
  const f = fixture({ mode: 'danger-full-access', text: '请只读审查配置' }); await assert.rejects(f.invoke({ action: 'remember' }), /PERSISTENCE_DENIED/); assert.equal(f.counters.committed, 0); f.dispose()
})
test('copied actor with same id cannot select the real workspace', async () => {
  const f = fixture(); await assert.rejects(f.invoke({ action: 'health' }, { caller: { ...f.agent } }), /SCOPE/); assert.equal(f.calls.length, 0); f.dispose()
})
test('delegated child with no own explicit human grant cannot inherit Full for knowledge writes', async () => {
  const f = fixture({ mode: 'danger-full-access', origin: 'subagent', text: '分析并返回结论' }); await assert.rejects(f.invoke({ action: 'remember' }), /PERSISTENCE_DENIED/); assert.equal(f.counters.committed, 0); f.dispose()
})
test('policy revocation between initial check and transaction prevents commit', async () => {
  const f = fixture(); f.hooks.transaction = () => f.setMode('read-only'); await assert.rejects(f.invoke({ action: 'remember' }), /PERSISTENCE_DENIED/); assert.equal(f.counters.committed, 0); f.dispose()
})
test('new session events invalidate the captured authorization before commit', async () => {
  const f = fixture(); f.hooks.commit = () => f.events.push({ type: 'step/end', seq: 1, data: {} }); await assert.rejects(f.invoke({ action: 'remember' }), /PERSISTENCE_DENIED/); assert.equal(f.counters.committed, 0); f.dispose()
})
test('abort while observing cannot enter a storage transaction', async () => {
  const f = fixture(), waiting = Promise.withResolvers(), started = Promise.withResolvers(), controller = new AbortController()
  f.hooks.afterObservation = async () => { started.resolve(); await waiting.promise }
  const pending = f.invoke({ action: 'remember' }, { signal: controller.signal }), rejected = assert.rejects(pending, { name: 'AbortError' })
  await started.promise; controller.abort(); waiting.resolve(); await rejected; assert.equal(f.calls.length, 0); assert.equal(f.counters.released, 1); f.dispose()
})
test('unload cancels a pending lease and unregisters owned resources', async () => {
  const f = fixture(), waiting = Promise.withResolvers(), started = Promise.withResolvers()
  f.hooks.afterObservation = async () => { started.resolve(); await waiting.promise }
  const pending = f.invoke({ action: 'remember' }), rejected = assert.rejects(pending, { name: 'AbortError' })
  await started.promise; f.dispose(); waiting.resolve(); await rejected; assert.equal(f.counters.committed, 0); assert.equal(f.counters.released, 1); assert.equal(f.tools.size, 0)
})
test('agent disposal cancels only its pending transaction', async () => {
  const f = fixture(), waiting = Promise.withResolvers(), started = Promise.withResolvers()
  f.hooks.commit = async () => { started.resolve(); await waiting.promise }
  const pending = f.invoke({ action: 'remember' }), rejected = assert.rejects(pending, { name: 'AbortError' })
  await started.promise; await f.disposed(); waiting.resolve(); await rejected; assert.equal(f.counters.committed, 0); f.dispose()
})
test('disabled configuration registers nothing and invalid config is rejected', () => {
  const f = fixture(); f.dispose(); f.module.apply(f.ctx, { enabled: false }); assert.equal(f.tools.size, 0); assert.throws(() => f.module.apply(f.ctx, { unexpected: true }), /LOCAL_MEMORY_CONFIG/)
})
test('malformed request never enters storage and scheduling remains fail closed', async () => {
  const f = fixture(), tool = f.tools.get('local_memory')
  await assert.rejects(tool.execute({ request: '{' }, { agent: f.agent, signal: new AbortController().signal }), /INPUT/)
  assert.equal(tool.isConcurrencySafe({ request: '{' }), false); assert.equal(tool.isConcurrencySafe({ request: '{"action":"search"}' }), true); assert.equal(tool.isConcurrencySafe({ request: '{"action":"remember"}' }), false); assert.equal(f.calls.length, 0); f.dispose()
})
test('late unload between settled read and facade continuation suppresses the read result', async () => {
  const f = fixture()
  const pending = f.invoke({ action: 'read', id: 'page-id' })
  f.dispose()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(f.calls.length, 1); assert.equal(f.counters.committed, 0)
})
test('late live-registry actor replacement suppresses the settled read result', async () => {
  const f = fixture()
  const pending = f.invoke({ action: 'read', id: 'page-id' })
  f.live.set(f.agent.id, { ...f.agent })
  await assert.rejects(pending, /LOCAL_MEMORY_SCOPE/)
  assert.equal(f.counters.committed, 0); f.dispose()
})
test('lease release failure cannot override the primary policy denial', async () => {
  const f = fixture({ mode: 'read-only', releaseFailure: true })
  await assert.rejects(f.invoke({ action: 'remember' }), /LOCAL_MEMORY_PERSISTENCE_DENIED/)
  assert.equal(f.counters.committed, 0); assert.equal(f.counters.released, 1); f.dispose()
})
test('release failure after admitted storage reports uncertainty, not a fictitious rollback', async () => {
  const f = fixture({ releaseFailure: true })
  await assert.rejects(f.invoke({ action: 'remember' }), /LOCAL_MEMORY_LEASE_RELEASE_FAILED_STATUS_UNCERTAIN/)
  assert.equal(f.counters.committed, 1); assert.equal(f.counters.released, 1); f.dispose()
})
