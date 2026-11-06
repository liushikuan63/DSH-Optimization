import os from 'node:os'
// Regression: the cross-session restore must not rewrite this session's state.
// This is the shipped-test-compatible form of probe A1/A2/S2. It fails on 1.4.2
// (unconditional update) and passes after the scope guard is restored.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { runEffect } from './effect-harness.mjs'
import { apply, TOOL_NAME } from '../plugins/context-checkpoint/index.mjs'
import { createContextStore as createStore } from '../plugins/context-checkpoint/store.mjs'

const BASE = (process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
const sha = value => createHash('sha256').update(value).digest('hex')

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(BASE, 'jizhi-scope-test-'))
  const files = new Set(), dirs = new Set([root])
  const reg = id => {
    const base = path.join(root, '.dsh', 'jizhi-context'), dir = path.join(base, sha(id))
    for (const d of [path.join(root, '.dsh'), base, dir]) dirs.add(d)
    files.add(path.join(base, 'write.lock'))
    for (const n of ['checkpoint-v1.json', 'previous-v1.json']) files.add(path.join(dir, n))
    return { dir, file: path.join(dir, 'checkpoint-v1.json') }
  }
  t.after(async () => {
    for (const f of files) { try { await fs.unlink(f) } catch (e) { if (e.code !== 'ENOENT') throw e } }
    for (const d of [...dirs].sort((a, b) => b.length - a.length)) { try { await fs.rmdir(d) } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTEMPTY') throw e } }
  })
  return { root, ...reg('session-a'), registerScope: reg }
}
function session(root, id = 'session-a') {
  const events = []
  return {
    id, header: { id, cwd: root, isSeeded: false }, inheritedEventCount: 0, firstLiveSeq: 0,
    surface: { replaceGeneration: 0, contentGeneration: 0, nodes: [] },
    get seq() { return events.length },
    snapshotEvents(from = 0, to = Infinity) { return events.filter(e => e.seq >= from && e.seq < to) },
    isOwnSeq: seq => seq >= 0,
    push(text) { events.push({ type: 'user/message', seq: events.length, time: Date.now(), surfaceOp: 'append', data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } }) },
  }
}
const note = (objective, status = 'active') => ({ objective, acceptance: ['a'], constraints: [], decisions: [], rejectedApproaches: [], evidence: [], changedFiles: [], openItems: [], nextSteps: [], status })

const MODES = { 'agent/created': 'serial', 'agent/turn-stopping': 'serial', 'session/event': 'emit', 'agent-preset/selected': 'emit' }
function context(preset = 'ultimate-model') {
  const effects = [], listeners = new Map(), tools = new Map(), sections = new Map(), guards = new Set()
  const sessions = new Map(), identities = new Map()
  const ctx = {
    preset,
    effect(f) { const d = runEffect(f); effects.push(d); return d },
    on(n, fn) { const b = listeners.get(n) ?? new Set(); b.add(fn); listeners.set(n, b); return () => { b.delete(fn); if (!b.size) listeners.delete(n) } },
    tools: { register(v) { tools.set(v.name, v); return () => tools.delete(v.name) }, guard(fn) { guards.add(fn); return () => guards.delete(fn) }, restrict() { return () => {} } },
    systemPrompt: { section(v) { sections.set(v.name, v); return () => sections.delete(v.name) } },
    agentPresets: { composedPreset(o) { return o.preset } },
    sessionQuery: { async observeSession(id) {
      const s = sessions.get(id); assert.ok(s)
      return { source: 'live', header: s.header, inheritedEventCount: s.inheritedEventCount, events: s.snapshotEvents(), cursor: s.seq - 1, [Symbol.dispose]() {} }
    } },
  }
  ctx.get = function get(n) {
    if (n === 'sandboxPolicy') return { resolve: () => ({ mode: 'workspace-write' }) }
    if (n === 'agentPresets') return { composedPreset: s => s.preset }
    if (n === 'sessionQuery') return this.sessionQuery
    if (n === 'agents') return { get: id => identities.get(id) }
    return undefined
  }
  return { ctx, tools, guards, sections,
    async dispatch(name, ...args) {
      if (name === 'agent/created') { const a = args[0].agent; identities.set(a.id, a); sessions.set(a.id, a.session) }
      for (const l of listeners.get(name) ?? []) { const r = l(...args); if (MODES[name] === 'serial') await r }
    },
    prompt() { return [...sections.values()].map(x => typeof x.text === 'function' ? x.text({}) : x.text).join('\n') },
    pointer() { return /checkpoint=([a-f0-9:]+)/.exec(this.prompt())?.[1] },
    status() { return /status=([a-z]+)/.exec(this.prompt())?.[1] },
    dispose() { for (const d of effects.toReversed()) d() },
  }
}
const denied = (host, agent, name = 'write') => [...host.guards].map(fn => fn({ agent, name, arguments: {} })).find(Boolean)

async function boot(root, s) {
  const host = context(), active = context()
  apply(host.ctx)
  const a = { id: s.id, session: s, ctx: active.ctx }
  await host.dispatch('agent/created', { agent: a, source: 'startup' })
  await new Promise(r => setTimeout(r, 30))
  return { host, active, a, tool: host.tools.get(TOOL_NAME) }
}

test('cross-session restore never rewrites this session marker, status, disabled or gate', async t => {
  const f = await fixture(t)
  const mine = session(f.root, 'session-a'); mine.push('request A')
  const { host, active, a, tool } = await boot(f.root, mine)
  t.after(() => host.dispose())
  await tool.execute({ request: JSON.stringify({ action: 'save', note: note('mine', 'active') }) }, { agent: a })
  const own = active.pointer()
  assert.ok(own, 'the session owns a checkpoint marker')

  const other = session(f.root, 'session-b'); other.push('request B')
  await createStore(f.root, { readEvents: async (x, from, to) => x.snapshotEvents(from, to) }).save(other, note('foreign', 'blocked'))
  const list = JSON.parse((await tool.execute({ request: '{"action":"inspect","scope":"workspace"}' }, { agent: a })).text)
  const foreignRow = list.checkpoints.find(c => c.scope === 'other-session')
  assert.ok(foreignRow, 'the foreign row is visible for explicit selection')

  const copied = JSON.parse((await tool.execute({ request: JSON.stringify({ action: 'restore', checkpoint: foreignRow.checkpoint }) }, { agent: a })).text)
  assert.equal(copied.scope, 'explicit-cross-session')
  assert.equal(copied.note.objective, 'foreign', 'the read still returns the foreign note')

  assert.equal(active.pointer(), own, 'MARKER must stay this session own')
  assert.equal(active.status(), 'active', 'STATUS must not inherit the foreign blocked phase')

  // A session with no checkpoint of its own must not acquire one from a foreign read.
  const clean = session(f.root, 'session-c'); clean.push('request C')
  const fresh = await boot(f.root, clean)
  t.after(() => fresh.host.dispose())
  assert.equal(fresh.active.pointer(), undefined)
  await fresh.tool.execute({ request: JSON.stringify({ action: 'restore', checkpoint: foreignRow.checkpoint }) }, { agent: fresh.a })
  assert.equal(fresh.active.pointer(), undefined, 'NO foreign marker on a session that never saved')
  clean.surface.replaceGeneration++
  assert.equal(denied(fresh.host, fresh.a), undefined, 'a foreign id can never arm this session gate')
})
