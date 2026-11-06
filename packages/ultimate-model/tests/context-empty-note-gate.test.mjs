import os from 'node:os'
// Regression: a checkpoint whose semantic note was never written must not gate writes.
//
// The gate exists to stop a compaction-blanked note from overwriting real content. When the
// note is empty there is nothing to protect, yet the old predicate still armed the gate on
// every replacement and demanded a restore that could never change the empty note, so the
// write paths stayed refused. The reported symptom was exactly this: objective "" plus
// semanticNoteMissing true, restore returning found:true, and the next command refused.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { runEffect } from './effect-harness.mjs'
import { apply, TOOL_NAME } from '../plugins/context-checkpoint/index.mjs'

const BASE = (process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
const sha = value => createHash('sha256').update(value).digest('hex')

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(BASE, 'jizhi-emptynote-'))
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

const note = objective => ({ objective, acceptance: ['a'], constraints: [], decisions: [], rejectedApproaches: [], evidence: [], changedFiles: [], openItems: [], nextSteps: [], status: 'active' })

/** Rewrite the stored note to the empty placeholder a compaction-blanked session carries. */
async function blank(file) {
  const raw = JSON.parse(await fs.readFile(file, 'utf8'))
  raw.payload.note = { objective: '', acceptance: [], constraints: [], decisions: [], rejectedApproaches: [], evidence: [], changedFiles: [], openItems: [], nextSteps: [], status: 'cancelled' }
  raw.payload.semanticSeq = null
  raw.checksum = sha(JSON.stringify(raw.payload))
  await fs.writeFile(file, JSON.stringify(raw))
}

const MODES = { 'agent/created': 'serial', 'agent/turn-stopping': 'serial', 'session/event': 'emit', 'agent-preset/selected': 'emit' }

function context(preset = 'ultimate-model') {
  const effects = [], listeners = new Map(), tools = new Map(), sections = new Map(), guards = new Set()
  const sessions = new Map(), identities = new Map()
  const ctx = {
    preset,
    effect(f) { const d = runEffect(f); effects.push(d); return d },
    on(n, fn) { const b = listeners.get(n) ?? new Set(); b.add(fn); listeners.set(n, b); return () => { b.delete(fn); if (!b.size) listeners.delete(n) } },
    tools: {
      register(v) { tools.set(v.name, v); return () => tools.delete(v.name) },
      guard(fn) { guards.add(fn); return () => guards.delete(fn) },
      restrict() { return () => {} },
    },
    systemPrompt: { section(v) { sections.set(v.name, v); return () => sections.delete(v.name) } },
    agentPresets: { composedPreset(o) { return o.preset } },
    sessionQuery: { async observeSession(id) {
      const s = sessions.get(id); assert.ok(s, 'only a registered exact session is observed')
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

const denied = (host, agent, name = 'write') => [...host.guards].map(fn => fn({ agent, name, arguments: {} })).find(Boolean)

/** Boot one agent for the session; returns the bundle context plus its tool handle. */
async function boot(f, s, source) {
  const host = context(), active = context()
  apply(host.ctx)
  const a = { id: s.id, session: s, ctx: active.ctx }
  await host.dispatch('agent/created', { agent: a, source })
  await new Promise(r => setTimeout(r, 30))
  return { host, active, a, tool: host.tools.get(TOOL_NAME) }
}

test('an empty-note checkpoint never gates a write path', async t => {
  const f = await fixture(t)

  // Write a real checkpoint, then blank its semantic note on disk.
  const seedSession = session(f.root); seedSession.push('seed request')
  const seed = await boot(f, seedSession, 'startup')
  await seed.tool.execute({ request: JSON.stringify({ action: 'save', note: note('real milestone') }) }, { agent: seed.a })
  seed.host.dispose()
  await blank(f.file)

  // A resumed session sees that checkpoint and names it as owed.
  const s = session(f.root); s.push('resume request')
  const { host, active, a, tool } = await boot(f, s, 'resume')
  t.after(() => host.dispose())

  const restored = JSON.parse((await tool.execute({ request: '{"action":"restore"}' }, { agent: a })).text)
  assert.equal(restored.semanticNoteMissing, true, 'the fixture must really be an unwritten note')
  assert.equal(restored.note.objective, '', 'the note carries no objective')

  // Any replacement, plus a prompt render, used to arm the gate on this empty note.
  s.surface.replaceGeneration++
  active.prompt()
  assert.equal(denied(host, a), undefined, 'EMPTY_NOTE_MUST_NOT_GATE')

  // It must stay ungated for later turns too, not merely for the first one.
  s.push('another request')
  s.surface.replaceGeneration++
  active.prompt()
  assert.equal(denied(host, a), undefined, 'EMPTY_NOTE_MUST_STAY_UNGATED')
})

test('a note WITH content still gates after a replacement', async t => {
  const f = await fixture(t)
  const s = session(f.root); s.push('request')
  const { host, active, a, tool } = await boot(f, s, 'resume')
  t.after(() => host.dispose())

  await tool.execute({ request: JSON.stringify({ action: 'save', note: note('milestone worth protecting') }) }, { agent: a })
  s.surface.replaceGeneration++
  active.prompt()
  assert.match(denied(host, a) ?? '', /RESTORE_REQUIRED/, 'REAL_CONTENT_MUST_STILL_GATE')

  await tool.execute({ request: '{"action":"restore"}' }, { agent: a })
  assert.equal(denied(host, a), undefined, 'a restore still releases it')
})
