import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const pack = fileURLToPath(new URL('..', import.meta.url))
const { apply } = await import(pathToFileURL(path.join(pack, 'plugins/experience-loop/index.mjs')))
const { runEffect } = await import(pathToFileURL(path.join(pack, 'tests/effect-harness.mjs')))
function fixture() {
  const effects = [], listeners = new Map(), scoped = new Map(), tools = new Map(), masks = new Set()
  const on = (map, name, fn) => { const set = map.get(name) || new Set(); map.set(name, set); set.add(fn); return () => { set.delete(fn); if (!set.size) map.delete(name) } }
  const scope = { preset: 'standard', tools: { restrict(filter) { assert.deepEqual(filter, { deny: ['jizhi_experience'] }); const lease = {}; masks.add(lease); return () => masks.delete(lease) } }, systemPrompt: { section: () => () => {} }, on: (name, fn) => on(scoped, name, fn) }
  const agent = { id: 'standard-a', session: { id: 'standard-a', header: { id: 'standard-a', cwd: 'D:/synthetic-unused-policy-fixture' } }, ctx: scope }
  const ctx = {
    tools: { register(tool) { tools.set(tool.name, tool); return () => tools.delete(tool.name) } }, systemPrompt: {},
    get(name) { if (name === 'agentPresets') return { composedPreset: value => value.preset }; if (name === 'agents') return { get: id => id === agent.id ? agent : undefined }; throw Error('unexpected service read: ' + name) },
    effect(fn) { const dispose = runEffect(fn); effects.push(dispose); return dispose }, on: (name, fn) => on(listeners, name, fn),
  }
  apply(ctx)
  const emit = async (name, ...args) => { for (const fn of [...(listeners.get(name) || [])]) await fn(...args) }
  return { masks, tools, scoped, scope, async created() { await emit('agent/created', { agent }) }, async select(preset) { scope.preset = preset; await emit('agent-preset/selected', agent.id, preset) }, dispose() { for (const fn of effects.toReversed()) fn() } }
}
test('unload releases standard-agent tool-visibility leases, not only tools/listeners', async () => {
  const f = fixture(); await f.created()
  assert.equal(f.masks.size, 1)
  f.dispose()
  assert.equal(f.masks.size, 0)
  assert.equal(f.tools.size, 0)
})
test('mode switches and unload do not leave a deny masking a later plugin instance', async () => {
  const f = fixture(); await f.created()
  assert.equal(f.masks.size, 1)
  await f.select('ultimate-model'); assert.equal(f.masks.size, 0)
  await f.select('standard'); assert.equal(f.masks.size, 1)
  f.dispose()
  assert.equal(f.masks.size, 0)
  assert.equal(f.scoped.size, 0)
})
