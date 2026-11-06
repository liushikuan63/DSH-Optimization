import os from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import sync from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'
const pack = fileURLToPath(new URL('..', import.meta.url))
const { createContextStore } = await import(pathToFileURL(path.join(pack, 'plugins/context-checkpoint/store.mjs')))
const { createExperienceStore } = await import(pathToFileURL(path.join(pack, 'plugins/experience-loop/store.mjs')))
async function fixture(t, kind) {
  const root = await fs.mkdtemp(path.join((process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir()), 'dsh-persistence-ownership-'))
  const id = 'owned-session', hash = createHash('sha256').update(id).digest('hex')
  const base = path.join(root, '.dsh', kind === 'context' ? 'jizhi-context' : 'jizhi-experience')
  const dir = kind === 'context' ? path.join(base, hash) : base
  const file = path.join(dir, kind === 'context' ? 'checkpoint-v1.json' : 'store-v1.json')
  const temp = path.join(dir, kind === 'context' ? 'previous-v1.tmp' : 'rollback-v1.tmp')
  const lock = path.join(base, 'write.lock')
  const movedTemp = path.join(dir, 'ours-moved.tmp'), movedLock = path.join(base, 'ours-lock-moved.tmp')
  const events = [
    { type: 'tool/call', seq: 0, time: Date.now(), data: { turn: 1, step: 1, callId: 'one', name: 'read', arguments: '{}' } },
    { type: 'tool/result', seq: 1, time: Date.now(), surfaceOp: 'append', sourceEventSeqs: [0], data: { turn: 1, step: 1, message: { role: 'tool', source: { kind: 'tool', callId: 'one' }, toolCallId: 'one', isError: false, content: [{ type: 'text', text: 'fixture completed' }] } } },
  ]
  const session = { id, header: { id, cwd: root }, seq: events.length, firstLiveSeq: 0, inheritedEventCount: 0, surface: { replaceGeneration: 0 }, isOwnSeq: () => true, readEvents: (from = 0, to = events.length) => events.slice(from, to) }
  const store = authorization => kind === 'context'
    ? createContextStore(root, { readEvents: (_session, from, to) => events.slice(from, to), authorizeMutation: authorization })
    : createExperienceStore(root, { authorizeMutation: authorization })
  const mutate = authorization => kind === 'context'
    ? store(authorization).save(session, { objective: 'changed fixture', status: 'active' })
    : store(authorization).record(session, { topic: 'changed', lesson: 'fixture lesson', target: 'skill' })
  if (kind === 'context') await store().save(session, { objective: 'baseline fixture', status: 'active' })
  else await store().review(session)
  const old = await fs.readFile(file)
  t.after(async () => {
    const files = new Set([file, temp, lock, movedTemp, movedLock,
      path.join(dir, 'previous-v1.json'), path.join(dir, 'checkpoint-v1.tmp'),
      path.join(dir, 'rollback-v1.json'), path.join(dir, 'store-v1.tmp')])
    for (const entry of files) { try { await fs.unlink(entry) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    for (const entry of [...new Set([dir, base, path.join(root, '.dsh'), root])]) { try { await fs.rmdir(entry) } catch (error) { if (error.code !== 'ENOENT') throw error } }
  })
  return { file, temp, lock, movedTemp, movedLock, old, mutate }
}
for (const kind of ['context', 'experience']) {
  test(kind + ': refusal must not unlink a foreign replacement for our temporary file', async t => {
    const f = await fixture(t, kind)
    let attacked = false
    await assert.rejects(f.mutate(phase => {
      if (phase === 'write' && !attacked) {
        attacked = true
        sync.renameSync(f.temp, f.movedTemp)
        sync.writeFileSync(f.temp, 'FOREIGN-REPLACEMENT', { flag: 'wx' })
        throw new Error('JIZHI_' + kind.toUpperCase() + '_PERSISTENCE_DENIED')
      }
    }))
    assert.equal(attacked, true, 'negative fixture must execute at the real write gate')
    assert.equal(await fs.readFile(f.temp, 'utf8'), 'FOREIGN-REPLACEMENT')
    assert.deepEqual(await fs.readFile(f.file), f.old)
  })
  test(kind + ': refusal must not unlink a foreign replacement for our lock', async t => {
    const f = await fixture(t, kind)
    let attacked = false
    await assert.rejects(f.mutate(phase => {
      if (phase === 'commit' && !attacked) {
        attacked = true
        sync.renameSync(f.lock, f.movedLock)
        sync.writeFileSync(f.lock, 'FOREIGN-REPLACEMENT', { flag: 'wx' })
        throw new Error('JIZHI_' + kind.toUpperCase() + '_PERSISTENCE_DENIED')
      }
    }))
    assert.equal(attacked, true)
    assert.equal(await fs.readFile(f.lock, 'utf8'), 'FOREIGN-REPLACEMENT')
    assert.deepEqual(await fs.readFile(f.file), f.old)
  })
  test(kind + ': normal refusal removes only its own temporary and lock, preserving current bytes', async t => {
    const f = await fixture(t, kind)
    await assert.rejects(f.mutate(phase => { if (phase === 'write') throw new Error('JIZHI_' + kind.toUpperCase() + '_PERSISTENCE_DENIED') }), /PERSISTENCE_DENIED/)
    await assert.rejects(fs.stat(f.temp), { code: 'ENOENT' })
    await assert.rejects(fs.stat(f.lock), { code: 'ENOENT' })
    assert.deepEqual(await fs.readFile(f.file), f.old)
  })
  test(kind + ': authorized commit still changes current bytes and invokes final commit/rename checks', async t => {
    const f = await fixture(t, kind), phases = []
    await f.mutate(phase => { phases.push(phase) })
    assert.ok(phases.includes('commit'))
    assert.ok(phases.includes('rename'))
    assert.notDeepEqual(await fs.readFile(f.file), f.old)
    await assert.rejects(fs.stat(f.lock), { code: 'ENOENT' })
  })
}
