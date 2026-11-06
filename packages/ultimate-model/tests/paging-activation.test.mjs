import assert from 'node:assert/strict'
import test from 'node:test'
import { apply as catalog } from '../preset/lib/tool-catalog.mjs'
import { apply as activate } from '../preset/lib/tool-activate.mjs'

function productionHarness(presentation = 'ptc') {
  const handlers = new Map(), registered = new Map(), effects = [], agents = []
  const inherited = [
    { name: 'read', parameters: {} },
    { name: 'browser_click', description: 'Click in browser', parameters: {} },
    { name: 'plugin_manager', description: 'Manage plugins', parameters: {} },
    { name: 'secret_open', description: 'Restricted external tool', parameters: {} },
  ]
  const ownEffects = factory => {
    const result = factory(), removers = []
    if (typeof result === 'function') removers.push(result)
    else if (result?.[Symbol.iterator]) for (const value of result) if (typeof value === 'function') removers.push(value)
    const dispose = () => { for (const remove of removers.splice(0).reverse()) remove() }
    effects.push(dispose); return dispose
  }
  const parentTools = {
    register(tool) { registered.set(tool.name, tool); return () => registered.delete(tool.name) },
    // Even the parent API projects the calling agent's effective view.
    schemas(agent) { return agent.ctx.tools.schemas(agent) },
  }
  const ctx = {
    tools: parentTools, effect: ownEffects,
    on(name, fn) { const bucket = handlers.get(name) ?? new Set(); bucket.add(fn); handlers.set(name, bucket); return () => bucket.delete(fn) },
    get(name) { return name === 'tools' ? parentTools : name === 'ptcRuntime' ? {} : undefined },
    logger: { warn() {} },
  }
  const config = { presentation, pagedToolPatterns: ['browser_*', 'plugin_*', 'secret_*'], maxActiveNamespaces: 1 }
  catalog(ctx, config); activate(ctx, config)
  const createAgent = id => {
    const masks = new Set(), external = { deny: ['secret_open'] }, events = [], declarations = new Set()
    masks.add(external)
    const scoped = {
      schemas() { return [...inherited.filter(tool => ![...masks].some(filter => filter.deny.includes(tool.name))), ...registered.values()] },
      restrict(filter) { masks.add(filter); return () => masks.delete(filter) },
      presentAs(mode) { declarations.add(mode); return () => declarations.delete(mode) },
    }
    const agent = { id, ctx: { tools: scoped }, session: { id, events, surface: { nodes: [] } } }
    const value = { agent, masks, external, events, declarations, names: () => scoped.schemas().map(tool => tool.name) }
    agents.push(value); return value
  }
  const emit = async (name, ...args) => { for (const fn of [...(handlers.get(name) ?? [])]) await fn(...args) }
  const assemble = async scoped => {
    const input = { tools: presentation === 'ptc' ? [{ name: 'run_code' }] : scoped.agent.ctx.tools.schemas() }
    const [fn] = handlers.get('system-prompt/assemble')
    return fn(input, { agent: scoped.agent }, async () => input)
  }
  const invoke = (scoped, namespace, callId = 'current') => registered.get('tool_activate').execute({ namespace }, { agent: scoped.agent, callId })
  const complete = async (scoped, namespace, callId, failed = false) => {
    scoped.events.push({ type: 'tool/call', data: { callId, name: 'tool_activate', arguments: { namespace } } })
    scoped.events.push({ type: 'tool/result', data: { callId, message: { isError: failed } } })
    await emit('tools/post-execute', { agent: scoped.agent }, {}, async () => {})
  }
  const dispose = () => { for (const fn of effects.toReversed()) fn(); handlers.clear(); registered.clear() }
  return { ctx, createAgent, emit, assemble, invoke, complete, dispose }
}

test('PTC activation keeps external policy, session isolation and cleanup intact; native stays compatible', async () => {
const ptc = productionHarness('ptc'), a = ptc.createAgent('a'), b = ptc.createAgent('b')
await ptc.emit('agent/created', { agent: a.agent }); await ptc.emit('agent/created', { agent: b.agent })
assert.deepEqual(a.names(), ['read', 'tool_activate'])
assert.deepEqual(b.names(), ['read', 'tool_activate'])
await assert.rejects(ptc.invoke(a, 'secret'), /unknown paged namespace/, 'catalog cache may not include an external-policy-hidden namespace')
const activated = await ptc.invoke(a, 'browser')
assert.match(activated.text, /Activated namespace "browser"/)
await ptc.complete(a, 'browser', 'browser-a')
assert.ok(a.names().includes('browser_click'), 'post-execute after a durable successful result exposes only agent a')
assert.equal(b.names().includes('browser_click'), false)
assert.equal(a.names().includes('secret_open'), false)
await assert.rejects(ptc.invoke(a, 'browser'), /already active/)
await ptc.invoke(a, 'plugin')
await ptc.complete(a, 'plugin', 'plugin-failed-a', true)
assert.ok(a.names().includes('browser_click'), 'failed activation must preserve the active page')
assert.equal(a.names().includes('plugin_manager'), false)
await ptc.invoke(a, 'plugin')
await ptc.complete(a, 'plugin', 'plugin-a')
assert.equal(a.names().includes('browser_click'), false, 'capacity one evicts the old namespace')
assert.ok(a.names().includes('plugin_manager'))
await ptc.invoke(b, 'browser')
await ptc.complete(b, 'browser', 'browser-b')
assert.ok(b.names().includes('browser_click'))
assert.ok(a.names().includes('plugin_manager'), 'agent b activation cannot replace agent a page')
assert.equal(b.names().includes('secret_open'), false)
await ptc.emit('agent/disposed', { agent: a.agent })
assert.deepEqual([...a.masks], [a.external], 'agent disposal removes only catalog-owned restrictions')
ptc.dispose()
assert.deepEqual([...b.masks], [b.external], 'plugin unload removes remaining catalog-owned restrictions')

const native = productionHarness('native'), n = native.createAgent('native')
await native.emit('agent/created', { agent: n.agent })
assert.deepEqual([...n.masks], [n.external], 'native mode installs no paging registry filter')
const firstWire = await native.assemble(n)
assert.deepEqual(firstWire.tools.map(tool => tool.name), ['read', 'tool_activate'])
await assert.rejects(native.invoke(n, 'secret'), /unknown paged namespace/)
await native.invoke(n, 'browser')
await native.complete(n, 'browser', 'native-browser')
const nextWire = await native.assemble(n)
assert.deepEqual(nextWire.tools.map(tool => tool.name), ['read', 'browser_click', 'tool_activate'])
native.dispose()
})
