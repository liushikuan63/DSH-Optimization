import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createExecutorPage,
  emptyPagingState,
  foldPagingEvent,
  selectPagingContract,
} from '../preset/lib/executor-paging.mjs'

const patterns = ['ppt_*', 'minimax_*', 'mcp__*']
const options = { patterns, capacity: 2 }
const step = { turn: 1, step: 1 }
const event = (type, data) => ({ type, data: { ...step, ...data } })
const call = (callId, namespace) => event('tool/call', { callId, name: 'tool_activate', arguments: JSON.stringify({ namespace }) })
const result = (callId, isError = false) => event('tool/result', { message: { source: { callId }, isError } })

test('selects by API shape and rejects an unknown or partially available executor interface', () => {
  const fn = () => {}
  assert.equal(selectPagingContract({ presentAs: fn, schemas: fn }, {}), 'legacy')
  const tools = { setExecutor: fn, resolve: fn, definitions: fn }
  const prompt = { variable: fn }
  assert.equal(selectPagingContract(tools, prompt), 'executor')
  assert.throws(() => selectPagingContract({ ...tools, definitions: null, presentAs: fn, schemas: fn }, prompt), /unsupported tool paging interface/)
  assert.throws(() => selectPagingContract({ schemas: fn }, prompt), /unsupported tool paging interface/)
})

test('only settled successful calls change the next page, in original call order', () => {
  const initial = emptyPagingState()
  const events = [event('step/start'), call('first', 'ppt'), call('failed', 'minimax'),
    call('later', 'playwright'), call('pending', 'ignored'), result('later'), result('failed', true), result('first')]
  const fold = (state, entry) => foldPagingEvent(state, entry, options)
  const pending = events.reduce(fold, initial)
  assert.deepEqual(pending.active, [])
  const settled = fold(pending, event('step/end'))
  assert.deepEqual(settled.active, ['ppt', 'playwright'])
  assert.deepEqual([...events, event('step/end')].reduce(fold, emptyPagingState()), settled)
  assert.deepEqual(initial.active, [])
})

test('PTC nested activation waits for its root result and the concluding step', () => {
  const run = event('tool/call', { callId: 'code', name: 'run_code', arguments: '{}' })
  const dispatch = event('tool/ptc-dispatch', { rootCallId: 'code', subCallId: 'inner', name: 'tool_activate', arguments: { namespace: 'ppt' }, isError: false })
  const fold = (state, entry) => foldPagingEvent(state, entry, options)
  const before = [event('step/start'), run, dispatch].reduce(fold, emptyPagingState())
  assert.deepEqual(before.active, [])
  assert.deepEqual([result('code', true), event('step/end')].reduce(fold, before).active, [])
  assert.deepEqual([result('code'), event('step/end')].reduce(fold, before).active, ['ppt'])
})

test('description, SDK, and execution share the exact page; execution rechecks the original admission', async () => {
  const agent = { id: 'first' }
  const ppt = { name: 'ppt_create' }
  const minimax = { name: 'minimax_generate_video' }
  const activate = { name: 'tool_activate' }
  const resident = { name: 'read_file' }
  const definitions = [ppt, minimax, activate, resident]
  let tools = new Map(definitions.map(tool => [tool.name, tool]))
  let disposals = 0
  const admission = Object.freeze({ view: scope => scope === agent ? tools : new Map(), dispose: () => { disposals += 1 } })
  const nextAdmission = Object.freeze({ ...admission })
  const names = values => values.map(definition => definition.name)
  const delegate = {
    sections: [{ name: 'tools:sdk', text: definitions => names(definitions).join(' ') }],
    describe: definitions => ({ schemas: definitions }),
    async execute(input) {
      assert.equal(input.agent, agent)
      const before = [...input.toolSet.view(agent).values()]
      assert.equal(input.toolSet.view({}).size, 0)
      return before
    },
  }
  const page = createExecutorPage({ agent, delegate, patterns })
  const first = page.prepare(admission, [])
  assert.deepEqual([...first.inactive.keys()], ['minimax', 'ppt'])
  assert.deepEqual(names(page.executor.describe(definitions).schemas), ['tool_activate', 'read_file'])
  assert.equal(page.executor.sections[0].text(definitions), 'tool_activate read_file')
  page.prepare(nextAdmission, ['ppt'])
  assert.deepEqual(names(page.executor.describe(definitions).schemas), ['ppt_create', 'tool_activate', 'read_file'])
  assert.deepEqual(await page.executor.execute({ agent, toolSet: admission }), [activate, resident])
  tools = new Map([['ppt_create', { name: 'ppt_create' }], ['tool_activate', activate]])
  assert.deepEqual(await page.executor.execute({ agent, toolSet: nextAdmission }), [activate])
  assert.equal(disposals, 0)
})
