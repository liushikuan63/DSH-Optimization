import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL, fileURLToPath } from 'node:url'
const file = fileURLToPath(new URL('../../plugins/persistence-policy.mjs', import.meta.url))
const { assertDerivedPersistence } = await import(pathToFileURL(file))
const id = 'domain-pure-fixture', cwd = 'D:/metadata-only-no-io'
const events = [{ type: 'user/message', seq: 0, data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '允许保存本任务状态' }] } }]
const agent = { id, session: { id, header: { id, cwd }, inheritedEventCount: 0, seq: 1, isOwnSeq: seq => seq === 0 } }
const observation = { source: 'live', header: { id, cwd }, inheritedEventCount: 0, events, cursor: 0 }
const ctx = mode => ({ get: name => name === 'sandboxPolicy' ? { resolve: request => { assert.equal(request.session, agent.session); return { mode, workspaceRoot: cwd } } } : undefined })
test('LOCAL_MEMORY is an explicit domain with the same Host authorization boundary', () => {
  assert.doesNotThrow(() => assertDerivedPersistence(ctx('workspace-write'), agent, undefined, 'LOCAL_MEMORY', observation))
})
test('LOCAL_MEMORY read-only denial retains its own domain error and never grants a mode override', () => {
  assert.throws(() => assertDerivedPersistence(ctx('read-only'), agent, undefined, 'LOCAL_MEMORY', observation), /LOCAL_MEMORY_PERSISTENCE_DENIED/)
})
test('existing domains and unknown-domain rejection remain distinct', () => {
  for (const prefix of ['JIZHI_CONTEXT', 'JIZHI_EXPERIENCE']) assert.doesNotThrow(() => assertDerivedPersistence(ctx('workspace-write'), agent, undefined, prefix, observation))
  assert.throws(() => assertDerivedPersistence(ctx('workspace-write'), agent, undefined, 'MADE_UP_DOMAIN', observation), /PERSISTENCE_DENIED/)
})
