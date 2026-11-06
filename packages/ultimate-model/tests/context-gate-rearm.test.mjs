import os from 'node:os'
// Regression: a successful restore must stay valid across ordinary request progress.
// The gate compared `replaceGeneration !== acknowledged`, so any counter advance re-armed
// it and one restore bought exactly one request. The re-arm test is now `>`.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { runEffect } from './effect-harness.mjs'

import { apply, TOOL_NAME } from '../plugins/context-checkpoint/index.mjs'

const BASE = (process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
const sha = v => createHash('sha256').update(v).digest('hex')

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(BASE, 'jizhi-rearm-reg-'))
  const files = new Set(), dirs = new Set([root])
  const base = path.join(root, '.dsh', 'jizhi-context'), dir = path.join(base, sha('session-a'))
  for (const d of [path.join(root, '.dsh'), base, dir]) dirs.add(d)
  files.add(path.join(base, 'write.lock'))
  for (const n of ['checkpoint-v1.json', 'previous-v1.json']) files.add(path.join(dir, n))
  t.after(async () => {
    for (const f of files) { try { await fs.unlink(f) } catch (e) { if (e.code !== 'ENOENT') throw e } }
    for (const d of [...dirs].sort((a, b) => b.length - a.length)) { try { await fs.rmdir(d) } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTEMPTY') throw e } }
  })
  return { root, file: path.join(dir, 'checkpoint-v1.json') }
}
function session(root) {
  const events = []
  return {
    id: 'session-a', header: { id: 'session-a', cwd: root, isSeeded: false }, inheritedEventCount: 0, firstLiveSeq: 0,
    surface: { replaceGeneration: 0, contentGeneration: 0, nodes: [] },
    get seq() { return events.length },
    snapshotEvents(from = 0, to = Infinity) { return events.filter(e => e.seq >= from && e.seq < to) },
    isOwnSeq: seq => seq >= 0,
    push(text) { events.push({ type: 'user/message', seq: events.length, time: Date.now(), surfaceOp: 'append', data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } }) },
  }
}
const note = o => ({ objective: o, acceptance: ['a'], constraints: [], decisions: [], rejectedApproaches: [], evidence: [], changedFiles: [], openItems: [], nextSteps: [], status: 'active' })

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
    dispose() { for (const d of effects.toReversed()) d() },
  }
}
const denied = (h, a, n = 'write') => [...h.guards].map(fn => fn({ agent: a, name: n, arguments: {} })).find(Boolean)

async function boot(f) {
  const host = context(), active = context()
  apply(host.ctx)
  const s = session(f.root); s.push('req')
  const a = { id: s.id, session: s, ctx: active.ctx }
  await host.dispatch('agent/created', { agent: a, source: 'startup' })
  await new Promise(r => setTimeout(r, 30))
  return { host, active, s, a, tool: host.tools.get(TOOL_NAME) }
}

test('one restore survives ordinary request progress', async t => {
  const f = await fixture(t)
  const { host, active, s, a, tool } = await boot(f)
  t.after(() => host.dispose())
  await tool.execute({ request: JSON.stringify({ action: 'save', note: note('milestone') }) }, { agent: a })

  s.surface.replaceGeneration++                     // a real replacement arms the gate
  assert.match(denied(host, a) ?? '', /RESTORE_REQUIRED/, 'a replacement must arm it')

  await tool.execute({ request: '{"action":"restore"}' }, { agent: a })
  assert.equal(denied(host, a), undefined, 'restore releases it')

  // Ordinary progress: turns, messages and prompt renders must not re-arm it.
  for (let i = 0; i < 3; i++) {
    s.push('next request ' + i)
    active.prompt()
    assert.equal(denied(host, a), undefined, 'ORDINARY_PROGRESS_MUST_NOT_REARM_' + i)
  }
})

test('a later replacement still re-arms, and a fresh restore releases it again', async t => {
  const f = await fixture(t)
  const { host, active, s, a, tool } = await boot(f)
  t.after(() => host.dispose())
  await tool.execute({ request: JSON.stringify({ action: 'save', note: note('milestone') }) }, { agent: a })

  s.surface.replaceGeneration++
  await tool.execute({ request: '{"action":"restore"}' }, { agent: a })
  assert.equal(denied(host, a), undefined)

  s.surface.replaceGeneration++                     // a second real replacement
  active.prompt()
  assert.match(denied(host, a) ?? '', /RESTORE_REQUIRED/, 'a new replacement must re-arm')

  await tool.execute({ request: '{"action":"restore"}' }, { agent: a })
  assert.equal(denied(host, a), undefined, 'and a fresh restore must clear it')
  active.prompt()
  assert.equal(denied(host, a), undefined)
})

test('no checkpoint means no gate, regardless of replacements', async t => {
  const f = await fixture(t)
  const { host, active, s, a } = await boot(f)
  t.after(() => host.dispose())
  s.surface.replaceGeneration += 5
  active.prompt()
  assert.equal(denied(host, a), undefined, 'a session that never saved has nothing to restore')
})
