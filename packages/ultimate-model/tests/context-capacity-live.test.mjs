// Regression: capacity must count LIVE checkpoints, not directory names.
// Before the fix, expired directories kept reserving slots while inspect() hid them,
// so the workspace reported zero checkpoints and still refused every save forever.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { createContextStore as createStore, LIMITS } from '../plugins/context-checkpoint/store.mjs'

const BASE = (process.env.SKILL_INDEX_TEST_TMPDIR || os.tmpdir())
const NOW = 1_800_000_000_000
const sha = value => createHash('sha256').update(value).digest('hex')

function createContextStore(root, options = {}) {
  return createStore(root, { readEvents: async (s, from, to) => s.snapshotEvents(from, to), ...options })
}
const note = (objective = 'recorded') => ({ objective, acceptance: ['a'], constraints: [], decisions: [], rejectedApproaches: [], evidence: [], changedFiles: [], openItems: [], nextSteps: [], status: 'active' })

function session(root, id = 'session-a') {
  const events = [{ type: 'user/message', seq: 0, time: NOW, surfaceOp: 'append', data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'request' }] } }]
  return {
    id, header: { id, cwd: root, isSeeded: false }, inheritedEventCount: 0, firstLiveSeq: 0,
    surface: { replaceGeneration: 0, contentGeneration: 0, nodes: [] },
    get seq() { return events.length },
    snapshotEvents: (from = 0, to = Infinity) => events.filter(e => e.seq >= from && e.seq < to),
    isOwnSeq: seq => seq >= 0,
  }
}

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(BASE, 'jizhi-capacity-test-'))
  const files = new Set(), dirs = new Set([root])
  const registerScope = id => {
    const base = path.join(root, '.dsh', 'jizhi-context'), dir = path.join(base, sha(id))
    for (const d of [path.join(root, '.dsh'), base, dir]) dirs.add(d)
    files.add(path.join(base, 'write.lock'))
    for (const n of ['checkpoint-v1.json', 'previous-v1.json']) files.add(path.join(dir, n))
    return { dir, file: path.join(dir, 'checkpoint-v1.json') }
  }
  t.after(async () => {
    for (const file of files) { try { await fs.unlink(file) } catch (e) { if (e.code !== 'ENOENT') throw e } }
    for (const dir of [...dirs].sort((a, b) => b.length - a.length)) { try { await fs.rmdir(dir) } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTEMPTY') throw e } }
  })
  return { root, registerScope, store: createContextStore(root, { now: () => NOW, ...options }) }
}

/** Rewrite the sealed envelope so the store sees a genuinely expired record. */
async function expire(file) {
  const raw = JSON.parse(await fs.readFile(file, 'utf8'))
  raw.payload.updatedAt = NOW - LIMITS.ttlMs - 1000
  raw.payload.createdAt = Math.min(raw.payload.createdAt, raw.payload.updatedAt)
  raw.checksum = sha(JSON.stringify(raw.payload))
  await fs.writeFile(file, JSON.stringify(raw))
}

test('expired session directories stop reserving capacity slots', async t => {
  const f = await fixture(t, { limits: { maxSessions: 2 } })
  const ids = ['session-a', 'session-b']
  for (const id of ids) { f.registerScope(id); await f.store.save(session(f.root, id), note(id)) }

  // Full with live records: a third session is refused and no directory is created.
  const denied = f.registerScope('session-c')
  await assert.rejects(f.store.save(session(f.root, 'session-c'), note('c')), { message: 'JIZHI_CONTEXT_CAPACITY' })
  await assert.rejects(fs.stat(denied.dir), { code: 'ENOENT' })

  // Age both records past the TTL. They are now invisible to inspect and restore.
  for (const id of ids) await expire(f.registerScope(id).file)
  const listed = await f.store.inspect(session(f.root, 'session-c'), { scope: 'workspace' })
  assert.equal(listed.checkpoints.length, 0, 'expired records are not disclosed')

  // The wall must release: a new session may now write, and the expired bytes stay put.
  await f.store.save(session(f.root, 'session-c'), note('c'))
  assert.equal((await f.store.restore(session(f.root, 'session-c'))).note.objective, 'c')
  const kept = await Promise.all(ids.map(id => fs.stat(f.registerScope(id).file).then(() => true, () => false)))
  assert.deepEqual(kept, [true, true], 'expired files are not deleted to make room')

  // With the new live record the workspace is full again at the cap.
  await assert.rejects(f.store.save(session(f.root, 'session-d'), note('d')), { message: 'JIZHI_CONTEXT_CAPACITY' })
})

test('a corrupted record still holds its slot so damage cannot release capacity', async t => {
  const f = await fixture(t, { limits: { maxSessions: 1 } })
  f.registerScope('session-a')
  await f.store.save(session(f.root, 'session-a'), note('a'))

  const target = f.registerScope('session-a').file
  const raw = JSON.parse(await fs.readFile(target, 'utf8'))
  raw.payload.note.objective = 'tampered'
  await fs.writeFile(target, JSON.stringify(raw))

  await assert.rejects(f.store.save(session(f.root, 'session-b'), note('b')), { message: 'JIZHI_CONTEXT_CAPACITY' })
})
