import {runEffect} from './effect-harness.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'

const PACK = fileURLToPath(new URL('..', import.meta.url))
const fixture = fs.mkdtempSync(path.join(process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir(), 'jizhi-regression-'))
process.env.DSH_HOME = fixture
process.env.DSH_AUTO_CONTINUE_BACKOFF_MS = '0'
process.env.DSH_AUTO_CONTINUE_MAX = '1'
const require = createRequire(import.meta.url)
const yaml = require(path.join(PACK, 'vendor/js-yaml.js'))
const paging = await import(pathToFileURL(path.join(PACK, 'preset/lib/paging.mjs')))
const pick = await import(pathToFileURL(path.join(PACK, 'plugins/ask-user-auto-pick/index.js')))
const continuation = await import(pathToFileURL(path.join(PACK, 'plugins/auto-continue-native/index.js')))
const guards = await import(pathToFileURL(path.join(PACK, 'plugins/hook-guards-native/index.js')))
const patterns = ['cua_driver_*', 'mcp__playwright__*', 'task_board_*', 'agent_teams_*', 'team_task_*', 'browser_*']
const call = (id, namespace) => ({ type: 'tool/call', data: { name: 'tool_activate', callId: id, arguments: { namespace } } })
const result = (id, error = false) => ({ type: 'tool/result', data: { message: { source: { callId: id }, isError: error, content: [{ type: 'text', text: error ? 'error' : 'ok' }] } } })

test('paging: unfinished calls do not consume activation capacity', () => {
  assert.deepEqual(paging.replayActivations([call('unfinished', 'browser')], 3, patterns).active, [])
})
test('paging: success, failure and independent sessions', () => {
  const events = [call('a', 'browser'), result('a'), call('b', 'task_board'), result('b', true)]
  assert.deepEqual(paging.replayActivations(events, 3, patterns).active, ['browser'])
  assert.deepEqual(paging.replayActivations([], 3, patterns).active, [])
})
test('paging: activation and catalog config agree', () => {
  const source = fs.readFileSync(path.join(PACK, 'preset/agent.cordis.yml.tpl'), 'utf8')
  const rows = yaml.load(source)
  const a = rows.find(r => r.id === 'tool-activate')?.config
  const c = rows.find(r => r.id === 'tool-catalog')?.config
  assert.deepEqual(a?.pagedToolPatterns, c?.pagedToolPatterns)
  assert.equal(a?.maxActiveNamespaces, c?.maxActiveNamespaces)
})
test('autopick: plan approval is never synthesized, even with legacy skipIntent=false', () => {
  const request = { wait: { timed: true }, questions: [{ id: 'approval', intent: { kind: 'plan-review', approve: 'Execute (Recommended)' }, options: [{ label: 'Execute (Recommended)' }, { label: 'Revise' }] }] }
  assert.equal(pick.pickAnswers(request, { skipIntent: false }), null)
})
test('autopick: ordinary reversible recommendation remains available; blocking and multi stay pending', () => {
  const request = { wait: { timed: true }, questions: [{ id: 'format', options: [{ label: 'Compact (Recommended)' }, { label: 'Detailed' }] }] }
  assert.equal(pick.pickAnswers(request)?.answers[0].selected[0], 'Compact (Recommended)')
  assert.equal(pick.pickAnswers({ ...request, wait: { timed: false } }), null)
  assert.equal(pick.pickAnswers({ ...request, questions: [{ ...request.questions[0], multiSelect: true }] }), null)
})
test('autopick: cancelled signal cannot become an automatic answer', () => {
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  assert.equal(pick.timedOutBySignal(controller.signal), false)
})
test('guards: shell GUI protection includes the active win_bash route', () => {
  const command = 'SetForegroundWindow(1)'
  assert.ok(guards.guiBypassRisk('bash', command))
  assert.ok(guards.guiBypassRisk('win_bash', command))
  assert.equal(guards.guiBypassRisk('win_bash', 'node --version'), null)
})
test('continuation: error names identify cancellation', () => {
  assert.equal(continuation.shouldContinue({ name: 'AbortError', message: '' }), false)
  assert.equal(continuation.shouldContinue({ code: 'ECONNRESET', message: 'connection reset' }), true)
})
function harness() {
  const handlers = new Map()
  const disposers = []
  const ctx = { on(name, fn) { handlers.set(name, fn) }, get() { return undefined }, effect(fn) { const dispose = runEffect(fn); disposers.push(dispose); return dispose } }
  const messages = []
  const agent = { id: 'isolated-fixture', status: 'idle', inbox: { nextTurn: [], nextStep: [] }, followup: msg => messages.push(msg) }
  continuation.apply(ctx)
  return { messages, agent, emit: (name, value) => handlers.get(name)?.(value), dispose: () => disposers.forEach(fn => fn()) }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 25))
test('continuation: cancellation after scheduling revokes the pending retry', async () => {
  const h = harness()
  try {
    h.emit('agent/error', { agent: h.agent, error: { code: 'ECONNRESET' } })
    h.emit('agent/status', { agent: h.agent, status: 'idle' })
    h.emit('agent/error', { agent: h.agent, error: { code: 'CANCELLED' } })
    await flush()
    assert.equal(h.messages.length, 0)
  } finally { h.dispose() }
})
test('continuation: configured one-retry budget is respected', async () => {
  const h = harness()
  try {
    for (let i = 0; i < 2; i++) {
      h.emit('agent/error', { agent: h.agent, error: { code: 'ECONNRESET' } })
      h.emit('agent/status', { agent: h.agent, status: 'idle' })
      await flush()
    }
    assert.equal(h.messages.length, 1)
  } finally { h.dispose() }
})

test('continuation: manually delivered stale timer cannot revive a cancelled/new epoch', () => {
  const originalSet=globalThis.setTimeout, originalClear=globalThis.clearTimeout
  const callbacks=[]
  globalThis.setTimeout=fn=>{callbacks.push(fn);return {unref(){}}}
  globalThis.clearTimeout=()=>{} // deliberately model an already-dispatched callback
  const h=harness()
  try {
    h.emit('agent/error',{agent:h.agent,error:{code:'ECONNRESET'}})
    h.emit('agent/status',{agent:h.agent,status:'idle'})
    assert.equal(callbacks.length,1)
    h.emit('agent/error',{agent:h.agent,error:{name:'AbortError'}})
    callbacks[0]()
    assert.equal(h.messages.length,0)
    h.emit('agent/inbox/inserted',{agent:h.agent,message:{source:{kind:'user'}}})
    callbacks[0]()
    assert.equal(h.messages.length,0,'old callback is stale even after a human resets exhaustion')
    h.emit('agent/error',{agent:h.agent,error:{code:'ECONNRESET'}})
    h.emit('agent/status',{agent:h.agent,status:'idle'})
    assert.equal(callbacks.length,2)
    callbacks[1]()
    assert.equal(h.messages.length,1,'fresh current epoch still works')
    h.emit('agent/disposed',{agent:h.agent})
    callbacks[1]()
    assert.equal(h.messages.length,1,'disposal revokes even a captured callback')
  } finally {h.dispose();globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear}
})
