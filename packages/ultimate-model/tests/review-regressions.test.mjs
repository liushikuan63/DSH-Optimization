import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { runEffect } from './effect-harness.mjs'
import { distributionFiles } from '../scripts/distribution.mjs'
import * as context from '../plugins/context-checkpoint/index.mjs'
import * as experience from '../plugins/experience-loop/index.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
// Exercise the identity actually selected by the shipped composition.
const patch = JSON.parse(fs.readFileSync(path.join(root, 'cordis.patch.template.yml'), 'utf8'))
const preset = patch[0].insert.find(row => row.id === 'preset-ultimate-model').config.id

function scope(preset) {
  const tools = new Map(), sections = new Map(), listeners = new Map(), masks = new Set(), effects = [], sessions = new Map()
  const ctx = {
    preset,
    effect(fn) { const dispose = runEffect(fn); effects.push(dispose); return dispose },
    on(name, fn) { const bucket = listeners.get(name) ?? new Set(); bucket.add(fn); listeners.set(name, bucket); return () => bucket.delete(fn) },
    tools: {
      register(tool) { tools.set(tool.name, tool); return () => tools.delete(tool.name) },
      guard() { return () => {} },
      restrict(filter) { masks.add(filter); return () => masks.delete(filter) },
    },
    systemPrompt: { section(value) { sections.set(value.name, value); return () => sections.delete(value.name) } },
    get(name) {
      if (name === 'agentPresets') return { composedPreset: other => other.preset }
      if (name === 'sessionQuery') return { async observeSession(id) {
        const session = sessions.get(id)
        return { source: 'live', header: session.header, inheritedEventCount: 0, events: [], cursor: -1, [Symbol.dispose]() {} }
      } }
      return undefined
    },
  }
  return { ctx, tools, sections, listeners, masks, sessions,
    async emit(name, ...args) { for (const fn of [...(listeners.get(name) ?? [])]) await fn(...args) },
    dispose() { for (const fn of effects.toReversed()) fn() },
  }
}

test('a cancelled question never becomes an automatic answer after a stale timeout', async t => {
  const previous = process.env.DSH_ASK_USER_AUTO_PICK
  const previousHome = process.env.DSH_HOME
  const testHome = fs.mkdtempSync(path.join(process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir(), 'ultimate-autopick-home-'))
  process.env.DSH_HOME = testHome
  process.env.DSH_ASK_USER_AUTO_PICK = '1'
  t.after(() => {
    if (previous === undefined) delete process.env.DSH_ASK_USER_AUTO_PICK; else process.env.DSH_ASK_USER_AUTO_PICK = previous
    if (previousHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previousHome
    const log = path.join(testHome, 'logs', 'ask-user-auto-pick.log')
    if (fs.existsSync(log)) { const stat = fs.lstatSync(log); assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1); fs.unlinkSync(log) }
    if (fs.existsSync(path.join(testHome, 'logs'))) fs.rmdirSync(path.join(testHome, 'logs'))
    fs.rmdirSync(testHome)
  })
  // The plugin fixes its log path at module load, so isolate before importing.
  const { apply: applyAutoPick } = await import('../plugins/ask-user-auto-pick/index.js')
  const host = scope('host')
  applyAutoPick(host.ctx)
  t.after(() => host.dispose())
  const [listener] = host.listeners.get('user-questions/request')
  const controller = new AbortController()
  const request = { wait: { timed: true }, signal: controller.signal,
    questions: [{ id: 'format', options: [{ label: 'Compact (Recommended)' }, { label: 'Detailed' }] }] }
  const timeout = Object.assign(new Error('late timeout'), { code: 'ASK_TIMED_OUT' })
  await assert.rejects(listener(request, async () => {
    controller.abort(new DOMException('user cancelled', 'AbortError'))
    throw timeout
  }), error => error === timeout)
  const answered = { answers: [{ id: 'format', selected: ['Detailed'] }] }
  assert.equal(await listener({ ...request, signal: new AbortController().signal }, async () => answered), answered)
  const automatic = await listener({ ...request, signal: new AbortController().signal }, async () => { throw timeout })
  assert.deepEqual(automatic.answers[0].selected, ['Compact (Recommended)'])
  const deadline = new AbortController()
  deadline.abort(timeout) // The host's deadline contract is ASK_TIMED_OUT.
  assert.deepEqual((await listener({ ...request, signal: deadline.signal }, async () => { throw timeout })).answers[0].selected, ['Compact (Recommended)'])
})

test('default materialization updates the loaded patch and preserves manifest coverage after relocation', t => {
  const directory = fs.mkdtempSync(path.join(process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir(), 'ultimate relocation-'))
  const pack = path.join(directory, 'copy with spaces'), files = [], dirs = new Set([directory])
  const mkdir = full => { if (dirs.has(full)) return; mkdir(path.dirname(full)); fs.mkdirSync(full); dirs.add(full) }
  mkdir(pack)
  for (const name of [...distributionFiles(root), 'FILES.sha256']) {
    const target = path.join(pack, name)
    mkdir(path.dirname(target)); fs.copyFileSync(path.join(root, name), target); files.push(target)
  }
  // This legacy output is registered only for cleanup if a regression creates it.
  files.push(path.join(pack, 'cordis.patch.local.yml'))
  t.after(() => {
    for (const file of files) if (fs.existsSync(file)) { const stat = fs.lstatSync(file); assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1); fs.unlinkSync(file) }
    for (const dir of [...dirs].sort((a, b) => b.length - a.length)) fs.rmdirSync(dir)
  })
  const run = (...args) => {
    const result = spawnSync(process.execPath, args, { cwd: pack, encoding: 'utf8', windowsHide: true, timeout: 30000 })
    assert.equal(result.error, undefined)
    assert.equal(result.status, 0, result.stderr)
    return result
  }
  const before = fs.readFileSync(path.join(pack, 'cordis.patch.yml'), 'utf8')
  run('materialize.mjs', '--check')
  assert.equal(fs.readFileSync(path.join(pack, 'cordis.patch.yml'), 'utf8'), before)
  const result = JSON.parse(run('materialize.mjs').stdout)
  assert.equal(result.out, path.join(pack, 'cordis.patch.yml'))
  assert.ok(result.rewritten > 0)
  assert.equal(fs.existsSync(path.join(pack, 'cordis.patch.local.yml')), false)
  run('scripts/build-manifest.mjs', '--check')
})

for (const plugin of [context, experience]) {
  test(`${plugin.TOOL_NAME} follows the shipped preset identity and releases old-mode visibility`, async t => {
    const temporary = fs.mkdtempSync(path.join(process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir(), 'ultimate-identity-'))
    t.after(() => fs.rmdirSync(temporary))
    const host = scope('host'), active = scope('standard')
    plugin.apply(host.ctx)
    t.after(() => host.dispose())
    const session = { id: 'identity-fixture', header: { id: 'identity-fixture', cwd: temporary }, seq: 0,
      firstLiveSeq: 0, inheritedEventCount: 0, surface: { replaceGeneration: 0 }, isOwnSeq: () => true }
    const agent = { id: session.id, session, ctx: active.ctx }
    host.sessions.set(session.id, session)
    await host.emit('agent/created', { agent, source: 'startup' })
    const call = () => host.tools.get(plugin.TOOL_NAME).execute({ request: JSON.stringify({ action: plugin === context ? 'inspect' : 'query' }) }, { agent })
    for (const selected of ['standard', preset, 'jizhi', preset, 'standard']) {
      active.ctx.preset = selected
      await host.emit('agent-preset/selected', agent.id, selected)
      const enabled = selected === preset
      assert.equal(active.sections.size, enabled ? 1 : 0, `prompt ownership in ${selected}`)
      assert.equal(active.masks.size, enabled ? 0 : 1, `tool visibility in ${selected}`)
      assert.equal(active.listeners.get('agent/turn-stopping')?.size ?? 0, enabled ? 1 : 0, `automatic listener in ${selected}`)
      if (enabled) assert.equal(typeof (await call()).text, 'string')
      else await assert.rejects(call(), /_SCOPE$/)
    }
    host.dispose()
    assert.equal(active.sections.size, 0)
    assert.equal(active.masks.size, 0)
  })
}
