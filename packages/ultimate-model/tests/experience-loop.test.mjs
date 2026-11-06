import os from 'node:os'
import {runEffect} from './effect-harness.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createExperienceStore, sanitizeText, LIMITS } from '../plugins/experience-loop/store.mjs'
import { apply, TOOL_NAME, withEvidenceView } from '../plugins/experience-loop/index.mjs'

const FIXTURE_BASE = (process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
const NOW = 1_800_000_000_000
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(FIXTURE_BASE, 'jizhi-experience-test-'))
  const registered = ['store-v1.json', 'rollback-v1.json', 'store-v1.tmp', 'rollback-v1.tmp', 'write.lock', 'registered-hardlink.json']
    .map(name => path.join(root, '.dsh', 'jizhi-experience', name))
  t.after(async () => {
    for (const file of registered) {
      try { await fs.unlink(file) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    for (const dir of [path.join(root, '.dsh', 'jizhi-experience'), path.join(root, '.dsh'), root]) {
      try { await fs.rmdir(dir) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
  })
  return { root, file: registered[0], store: createExperienceStore(root, { now: () => NOW, ...options }) }
}
function session(root, events = [], id = 'session-a', firstLiveSeq = 0) {
  return {
    id, header: { id, cwd: root, agentPreset: 'ultimate-model' }, firstLiveSeq,
    get seq() { return events.reduce((max, event) => Math.max(max, event.seq + 1), 0) },
    readEvents(from = 0, to = this.seq) { return events.filter(event => event.seq >= from && event.seq < to) },
    isOwnSeq(seq) { return seq >= firstLiveSeq },
  }
}
function pair(callId, seq, { tool = 'read', isError = false, error, text = 'completed', turn = 1, meta } = {}) {
  return [
    { type: 'tool/call', seq, time: NOW, data: { turn, step: 1, callId, name: tool, arguments: '{"token":"must-not-save-raw"}' } },
    { type: 'tool/result', seq: seq + 1, time: NOW, surfaceOp: 'append', sourceEventSeqs: [seq], data: { turn, step: 1, error, meta, message: {
      role: 'tool', source: { kind: 'tool', callId }, toolCallId: callId, isError, content: [{ type: 'text', text }],
    } } },
  ]
}
function user(seq, text, source = 'user') {
  return { type: 'user/message', seq, time: NOW, data: { role: 'user', source: { kind: source }, content: [{ type: 'text', text }] } }
}

test('review really collects metadata, deduplicates and reloads without raw arguments/results', async t => {
  const f = await fixture(t)
  const s = session(f.root, pair('call-ok', 0, { text: 'raw-result-secret-should-not-survive' }))
  const first = await f.store.review(s)
  assert.equal(first.addedObservations, 1)
  assert.equal(first.calls[0].callId, 'call-ok')
  assert.equal(first.entries[0].status, 'verified')
  assert.equal(first.entries[0].verification, 'dispatch-only')
  const bytes = await fs.readFile(f.file, 'utf8')
  assert.equal((await f.store.review(s)).addedObservations, 0)
  assert.equal(await fs.readFile(f.file, 'utf8'), bytes)
  const loaded = await createExperienceStore(f.root, { now: () => NOW }).query(s, {})
  assert.equal(loaded.observations.length, 1)
  assert.equal(loaded.entries.length, 1)
  assert.doesNotMatch(bytes, /must-not-save-raw|raw-result-secret|session-a|call-ok/)
  assert.match(bytes, /"schemaVersion":1/)
})

test('failed -> success creates a bounded non-executing upgrade candidate with evidence', async t => {
  const f = await fixture(t)
  const s = session(f.root, [...pair('bad1', 0, { tool: 'mcp__playwright__browser_navigate', isError: true }), ...pair('bad2', 2, { tool: 'mcp__playwright__browser_navigate', isError: true }), ...pair('good', 4, { tool: 'mcp__playwright__browser_navigate' })])
  const result = await f.store.review(s)
  assert.equal(result.observations.length, 3)
  const upgrade = result.entries.find(entry => entry.kind === 'upgrade')
  assert.equal(upgrade.target, 'mcp')
  assert.equal(upgrade.status, 'pending')
  assert.equal(upgrade.enabled, false)
  assert.match(upgrade.validation, /验证|verify/i)
  assert.match(upgrade.rollback, /回滚|rollback/i)
  const aggregate = result.entries.find(entry => entry.kind === 'observation')
  assert.deepEqual(aggregate.counts, { success: 1, failure: 2, cancelled: 0, unknown: 0 })
})

test('AbortError, cancellation and nonzero exits never become successful/retry preferences', async t => {
  const f = await fixture(t)
  const s = session(f.root, [
    ...pair('abort', 0, { isError: true, error: { name: 'AbortError', code: 'ABORTED' } }),
    ...pair('exit1', 2, { tool: 'win_bash', text: 'process ended [exit code: 1]' }),
    ...pair('turn-cancel', 4, { tool: 'write', isError: true }),
    { type: 'turn/end', seq: 6, time: NOW, data: { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } } },
  ])
  const result = await f.store.review(s)
  assert.equal(result.observations.filter(item => item.status === 'cancelled').length, 3)
  assert.equal(result.entries.length, 0)
  assert.equal((await f.store.record(s, { topic: 'avoid cancellation', lesson: 'retry immediately', target: 'preference', evidenceCallIds: ['abort'] })).entry.status, 'pending')
})

test('free-text lessons stay candidates; fake success/approval and unknown path fields fail closed', async t => {
  const f = await fixture(t)
  const s = session(f.root, [...pair('real', 0), ...pair('exit1', 2, { text: '[exit code: 1]' })])
  await assert.rejects(f.store.record(s, { topic: 'x', lesson: 'y', target: 'rule', evidenceCallIds: [], verified: true }), /INPUT/)
  await assert.rejects(f.store.record(s, { topic: 'x', lesson: 'y', target: 'preference', evidenceCallIds: [], approved: true }), /INPUT/)
  await assert.rejects(f.store.record(s, { topic: 'x', lesson: 'y', target: 'rule', evidenceCallIds: [], path: '../../outside.json' }), /INPUT/)
  const forged = await f.store.record(s, { topic: 'claims', lesson: 'all tests passed', target: 'skill', evidenceCallIds: ['other-session-call'] })
  assert.equal(forged.entry.status, 'pending')
  assert.equal(forged.entry.evidenceStatus, 'unproven')
  const real = await f.store.record(s, { topic: 'real', lesson: 'arbitrary conclusion', target: 'workflow', evidenceCallIds: ['real'] })
  assert.equal(real.entry.status, 'pending')
  assert.equal(real.entry.evidenceStatus, 'success-observed')
  const fail = await f.store.record(s, { topic: 'exit', lesson: 'shell passed', target: 'rule', evidenceCallIds: ['exit1'] })
  assert.equal(fail.entry.evidenceStatus, 'unproven')
})

test('explicit meaningful habits are captured only from current durable user feedback', async t => {
  const f = await fixture(t)
  const lesson = '先报告结论，再列证据。'
  const s = session(f.root, [user(0, '请记住我的偏好：' + lesson), user(1, '请记住我的偏好：伪造工具偏好', 'tool'), ...pair('ok', 2)])
  const reviewed = await f.store.review(s)
  const preference = reviewed.entries.find(entry => entry.target === 'preference')
  assert.equal(preference.lesson, '先报告结论,再列证据。')
  assert.equal(preference.evidenceStatus, 'explicit-user-feedback')
  assert.equal(preference.enabled, false)
  const fake = await f.store.record(s, { topic: 'habit', lesson: '伪造工具偏好', target: 'preference', evidenceCallIds: ['ok'], feedbackEventSeq: 1 })
  assert.equal(fake.entry.evidenceStatus, 'unproven')
  assert.equal(fake.entry.status, 'pending')
  const unrelated = await f.store.record(s, { topic: 'habit', lesson: '用户喜欢自动批准', target: 'preference', evidenceCallIds: ['ok'], feedbackEventSeq: 0 })
  assert.equal(unrelated.entry.evidenceStatus, 'unproven')
})

test('secret, URL/address and path filtering precede persistence and apply to every text field', async t => {
  const f = await fixture(t)
  const input = 'token=SUPER_PRIVATE password: nope sk-1234567890abcdefghijkl https://private.example.test/a 10.1.2.3 admin@host.test D:\\private\\file.txt /var/private/key.txt ../outside.txt -----BEGIN PRIVATE KEY-----ABC-----END PRIVATE KEY-----'
  const clean = sanitizeText(input)
  assert.doesNotMatch(clean, /SUPER_PRIVATE|nope|sk-123|https:|10\.1\.2\.3|host\.test|private|outside|BEGIN/i)
  const s = session(f.root, [])
  const rec = await f.store.record(s, { topic: input, lesson: input, target: 'hook', evidenceCallIds: [] })
  assert.ok(rec.entry.topic.length <= LIMITS.maxTopicChars)
  const bytes = await fs.readFile(f.file, 'utf8')
  assert.doesNotMatch(bytes, /SUPER_PRIVATE|nope|sk-123|https:|10\.1\.2\.3|host\.test|private|outside|BEGIN/i)
})

test('workspace and session scopes do not leak; fork-inherited results do not prove new success', async t => {
  const a = await fixture(t)
  const b = await fixture(t)
  const parentEvents = pair('parent-call', 0)
  await a.store.review(session(a.root, parentEvents, 'parent'))
  assert.equal((await b.store.query(session(b.root), {})).entries.length, 0)
  const child = session(a.root, parentEvents, 'child', 2)
  assert.equal((await a.store.query(child, { scope: 'session' })).entries.length, 0)
  assert.equal((await a.store.record(child, { topic: 'fork', lesson: 'inherited', target: 'skill', evidenceCallIds: ['parent-call'] })).entry.evidenceStatus, 'unproven')
  await assert.rejects(a.store.review(session(b.root, pair('foreign', 0))), /SCOPE/)
})

test('TTL, item and byte caps, daily write budget, disable and rollback are real boundaries', async t => {
  const f = await fixture(t, { limits: { maxEntries: 4, maxObservations: 5, maxBytes: 18000 } })
  const events = Array.from({ length: 12 }, (_, i) => pair('call-' + i, i * 2, { tool: 'read' + i })).flat()
  const s = session(f.root, events)
  await f.store.review(s)
  const view = await f.store.query(s, {})
  assert.equal(view.observations.length, 5)
  assert.equal(view.entries.length, 4)
  assert.ok((await fs.stat(f.file)).size <= 18000)
  const expired = await createExperienceStore(f.root, { now: () => NOW + LIMITS.ttlMs + 1000 }).query(s, {})
  assert.equal(expired.entries.length, 0)
  assert.equal(expired.observations.length, 0)
  await f.store.disable(s)
  assert.equal((await f.store.review(s)).disabled, true)
  await f.store.rollback(s)
  assert.equal((await f.store.query(s, {})).disabled, false)
  const budget = await fixture(t, { limits: { maxWritesPerDay: 1 } })
  const bs = session(budget.root)
  await budget.store.record(bs, { topic: 'one', lesson: 'one', target: 'rule', evidenceCallIds: [] })
  await assert.rejects(budget.store.record(bs, { topic: 'two', lesson: 'two', target: 'rule', evidenceCallIds: [] }), /BUDGET/)
})

function agentContext(preset = 'ultimate-model', injected = true) {
  const effects = [], listeners = new Map(), tools = new Map(), sections = new Map(), observed = new Map()
  const agentsById = new Map()
  const ctx = {
    preset,
    effect(factory) { const dispose = runEffect(factory); effects.push(dispose); return dispose },
    on(event, fn) { listeners.set(event, fn); return () => listeners.delete(event) },
    tools: { register(tool) { tools.set(tool.name, tool); return () => tools.delete(tool.name) }, restrict() { return () => {} } },
    systemPrompt: { section(section) { sections.set(section.name, section); return () => sections.delete(section.name) } },
    agentPresets: { composedPreset(context) { return context.preset } },
    sessionQuery: { async observeSession(id, options) {
      assert.equal(options.projectionMode, 'none')
      const s = observed.get(id); assert.ok(s, 'observes exact registered test session')
      return { source: 'live', header: s.header, inheritedEventCount: 0, events: s.readEvents(), cursor: s.seq - 1, [Symbol.dispose]() {} }
    } },
  }
  if (!injected) Object.defineProperty(ctx, 'sessionQuery', { get() { throw Error('cannot get property "sessionQuery" without inject') } })
  // A bundle-level row acquires profile services optionally through ctx.get().
  // With `injected === false` the direct property above must still throw, so this
  // accessor deliberately does NOT route through that property.
  ctx.get = (name) => {
    if (name === 'sandboxPolicy') return { resolve: () => ({ mode: 'workspace-write' }) }
    if (name === 'agentPresets') return ctx.agentPresets
    if (name === 'sessionQuery') return injected ? ctx.sessionQuery : undefined
    if (name === 'agents') return { get: (id) => agentsById.get(id) }
    return undefined
  }
  return { ctx, tools, listeners, sections, observe(s) { observed.set(s.id, s) }, dispose() { for (const dispose of effects.reverse()) dispose() } }
}

test('plugin installs per exact jizhi agent, auto-reviews, renders text and fully disposes', async t => {
  const f = await fixture(t)
  const host = agentContext()
  const active = agentContext('ultimate-model', false)
  const standard = agentContext('standard', false)
  apply(host.ctx)
  const a = { id: 'session-a', session: session(f.root, pair('auto', 0).map(event => ({ ...event, time: Date.now() }))), ctx: active.ctx }
  let opened = 0, released = 0
  host.ctx.sessionQuery = { async observeSession(id, options) {
    assert.equal(id, a.id); assert.equal(options.projectionMode, 'none'); opened++
    return { source: 'live', header: a.session.header, inheritedEventCount: 0, events: a.session.readEvents(), cursor: a.session.seq - 1,
      [Symbol.dispose]() { released++ } }
  } }
  host.observe(a.session)
  await host.listeners.get('agent/created')({ agent: a })
  await host.listeners.get('agent/created')({ agent: { id: 's', session: session(f.root, [], 's'), ctx: standard.ctx } })
  assert.equal(standard.tools.size, 0)
  assert.equal(standard.listeners.size, 0)
  assert.equal(host.tools.has(TOOL_NAME), true)
  await active.listeners.get('agent/turn-stopping')({ agent: a, signal: new AbortController().signal })
  const tool = host.tools.get(TOOL_NAME)
  const result = await tool.execute({ action: 'query', scope: 'workspace' }, { agent: a, signal: new AbortController().signal })
  assert.equal(typeof result.text, 'string')
  assert.match(result.text, /dispatch-only/)
  assert.deepEqual(tool.output.render({}, result), [{ type: 'text', text: result.text }])
  await assert.rejects(tool.execute({ action: 'query', path: '../../elsewhere' }, { agent: a }), /INPUT/)
  const cancelled = new AbortController(); cancelled.abort()
  await assert.rejects(tool.execute({ action: 'review' }, { agent: a, signal: cancelled.signal }), { name: 'AbortError' })
  const before = await fs.readFile(f.file, 'utf8')
  await active.listeners.get('agent/turn-stopping')({ agent: a, signal: cancelled.signal })
  assert.equal(await fs.readFile(f.file, 'utf8'), before)
  host.dispose()
  assert.equal(active.tools.size, 0)
  assert.equal(active.listeners.size, 0)
  assert.equal(active.sections.size, 0)
  assert.equal(host.listeners.size, 0)
  assert.equal(opened, 2)
  assert.equal(released, opened)
})

test('public query evidence lease rejects mismatched scope and releases on all paths', async () => {
  const events = pair('leased', 0), s = session(path.resolve(FIXTURE_BASE), events)
  let released = 0, mismatch = false
  const queryCtx = { get: (name) => name === 'sessionQuery' ? queryCtx.sessionQuery : undefined, sessionQuery: { async observeSession() {
    return { source: 'live', header: mismatch ? { ...s.header, id: 'wrong' } : s.header,
      inheritedEventCount: 0, events, cursor: events.length - 1, [Symbol.dispose]() { released++ } }
  } } }
  const a = { id: s.id, session: s, ctx: {} }
  Object.defineProperty(a.ctx, 'sessionQuery', { get() { throw Error('cannot get property "sessionQuery" without inject') } })
  await withEvidenceView(queryCtx, a, undefined, view => { assert.deepEqual(view.readEvents(0, view.seq), events) })
  assert.equal(released, 1)
  mismatch = true
  await assert.rejects(withEvidenceView(queryCtx, a, undefined, () => assert.fail('wrong scope must not be consumed')), /SCOPE/)
  assert.equal(released, 2)
  mismatch = false
  await assert.rejects(withEvidenceView(queryCtx, a, undefined, () => { throw Error('consumer failed') }), /consumer failed/)
  assert.equal(released, 3)
})

test('absent success flags and unpaired/ambiguous results never verify experience', async t => {
  const f = await fixture(t)
  const absent = pair('unknown', 0)
  delete absent[1].data.message.isError
  const orphan = pair('no-result', 2).slice(0, 1)
  const ambiguous = [...pair('duplicate', 4), ...pair('duplicate', 6)]
  const wrongRef = pair('wrong-ref', 8)
  wrongRef[1].sourceEventSeqs = [99]
  const s = session(f.root, [...absent, ...orphan, ...ambiguous, ...wrongRef])
  const result = await f.store.review(s)
  assert.equal(result.observations.length, 1)
  assert.equal(result.observations[0].status, 'unknown')
  assert.equal(result.entries.length, 0)
})

test('late durable cancellation retracts failure summaries without replaying a retry', async t => {
  const f = await fixture(t)
  const events = [...pair('f1', 0, { isError: true }), ...pair('f2', 2, { isError: true })]
  const s = session(f.root, events)
  assert.equal((await f.store.review(s)).entries.filter(item => item.kind === 'upgrade').length, 1)
  events.push({ type: 'turn/end', seq: 4, time: NOW, data: { turn: 1, reason: { kind: 'aborted', reason: { kind: 'user' } } } })
  const after = await f.store.review(s)
  assert.equal(after.addedObservations, 0)
  assert.deepEqual(after.observations.map(item => item.status), ['cancelled', 'cancelled'])
  assert.equal(after.entries.length, 0)
})

test('byte-write budget and unknown schema fail closed without overwriting data', async t => {
  const f = await fixture(t, { limits: { maxWriteBytesPerDay: 10 } })
  const s = session(f.root)
  await assert.rejects(f.store.record(s, { topic: 'x', lesson: 'x', target: 'rule', evidenceCallIds: [] }), /BUDGET/)
  await assert.rejects(fs.stat(f.file), { code: 'ENOENT' })
  const schema = await fixture(t)
  const ss = session(schema.root, pair('ok', 0))
  await schema.store.review(ss)
  const invalid = (await fs.readFile(schema.file, 'utf8')).replace('"schemaVersion":1', '"schemaVersion":999')
  await fs.writeFile(schema.file, invalid)
  await assert.rejects(schema.store.review(ss), /STORE_SCHEMA/)
  assert.equal(await fs.readFile(schema.file, 'utf8'), invalid)
})

test('bounded tool output truncates large recall without failing an already committed record', async t => {
  const f = await fixture(t)
  const host = agentContext(), active = agentContext('ultimate-model', false)
  t.after(() => host.dispose())
  apply(host.ctx)
  const events = Array.from({ length: 6 }, (_, i) => pair('r' + i, i * 2)).flat().map(event => ({ ...event, time: Date.now() }))
  const a = { id: 'session-a', session: session(f.root, events), ctx: active.ctx }
  host.observe(a.session)
  await host.listeners.get('agent/created')({ agent: a })
  const tool = host.tools.get(TOOL_NAME)
  for (let i = 0; i < 14; i++) {
    const result = await tool.execute({ action: 'record', topic: '候选' + i, lesson: '先核验独立证据再决定是否复用。'.repeat(30), target: 'skill', evidenceCallIds: ['r0', 'r1', 'r2', 'r3', 'r4', 'r5'] }, { agent: a })
    assert.ok(result.text.length <= 20000)
  }
  const result = await tool.execute({ action: 'query' }, { agent: a })
  const decoded = JSON.parse(result.text)
  assert.equal(decoded.totalEntries, 14)
  assert.equal(decoded.truncated, true)
  assert.ok(decoded.entries.length < 12)
  assert.ok(result.text.length <= 20000)
})

test('unexpected hardlinks fail closed and preserve the registered snapshot', async t => {
  const f = await fixture(t)
  const s = session(f.root, pair('ok', 0))
  await f.store.review(s)
  const before = await fs.readFile(f.file, 'utf8')
  await fs.link(f.file, path.join(f.root, '.dsh', 'jizhi-experience', 'registered-hardlink.json'))
  await assert.rejects(f.store.query(s, {}), /STORE_PATH/)
  await assert.rejects(f.store.review(s), /STORE_PATH/)
  assert.equal(await fs.readFile(f.file, 'utf8'), before)
})

test('record accepts omitted evidenceCallIds as unproven without mutating input', async t => {
  const f = await fixture(t), s = session(f.root, pair('real', 0))
  const input = { topic: 'minimal record', lesson: 'Check independent evidence before reuse.', target: 'workflow' }
  const result = await f.store.record(s, input)
  assert.equal(result.entry.status, 'pending')
  assert.equal(result.entry.enabled, false)
  assert.equal(result.entry.verification, 'unproven')
  assert.equal(result.entry.evidenceStatus, 'unproven')
  assert.deepEqual(result.entry.refs, [])
  assert.equal(Object.hasOwn(input, 'evidenceCallIds'), false)
  const explicit = await f.store.record(s, { ...input, evidenceCallIds: [] })
  assert.equal(explicit.entry.id, result.entry.id)
  assert.equal(explicit.revision, result.revision)
  assert.equal((await f.store.query(s)).totalEntries, 1)
})

test('record rejects explicit invalid evidence arrays before creating a store', async t => {
  const f = await fixture(t), s = session(f.root)
  const input = { topic: 'strict record', lesson: 'Keep invalid values rejected.', target: 'skill' }
  for (const evidenceCallIds of [null, undefined, false, 42, 'real', {}, ['bad space'], Array(9).fill('real')]) {
    await assert.rejects(f.store.record(s, { ...input, evidenceCallIds }), { message: 'JIZHI_EXPERIENCE_INPUT' })
  }
  await assert.rejects(fs.stat(path.join(f.root, '.dsh')), { code: 'ENOENT' })
})

test('public request envelope records a minimal pending candidate and still rejects bad fields', async t => {
  const f = await fixture(t, { now: () => Date.now() }), host = agentContext(), active = agentContext('ultimate-model', false)
  t.after(() => host.dispose())
  apply(host.ctx)
  const a = { id: 'session-a', session: session(f.root), ctx: active.ctx }
  host.observe(a.session)
  await host.listeners.get('agent/created')({ agent: a })
  const tool = host.tools.get(TOOL_NAME)
  const input = { action: 'record', topic: 'public minimal', lesson: 'No claimed verification without evidence.', target: 'workflow' }
  const reply = JSON.parse((await tool.execute({ request: JSON.stringify(input) }, { agent: a })).text)
  assert.equal(reply.entry.status, 'pending')
  assert.equal(reply.entry.evidenceStatus, 'unproven')
  assert.deepEqual(reply.entry.refs, [])
  assert.equal((await f.store.query(a.session)).totalEntries, 1)
  const before = await fs.readFile(f.file, 'utf8')
  for (const extra of [{ evidenceCallIds: null }, { scope: 'workspace' }, { verified: true }]) {
    await assert.rejects(tool.execute({ request: JSON.stringify({ ...input, ...extra }) }, { agent: a }), { message: 'JIZHI_EXPERIENCE_INPUT' })
  }
  assert.equal(await fs.readFile(f.file, 'utf8'), before)
})

test('disabled plugin contributes no tool, prompt or listener', () => {
  const h = agentContext()
  apply(h.ctx, { enabled: false })
  assert.equal(h.tools.size + h.listeners.size + h.sections.size, 0)
})
