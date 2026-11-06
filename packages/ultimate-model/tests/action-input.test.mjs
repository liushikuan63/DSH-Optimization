import test from 'node:test'
import assert from 'node:assert/strict'
import { PARAMETERS as context } from '../plugins/context-checkpoint/index.mjs'
import * as experience from '../plugins/experience-loop/index.mjs'
import { decodeRequest } from '../plugins/action-parameters.mjs'
const invalid = () => new Error('INVALID_REQUEST')
function providerSafe(schema) {
  assert.equal(schema.type, 'object')
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual(schema.required, ['request'])
  assert.deepEqual(Object.keys(schema.properties), ['request'], 'NO_ACTION_PLACEHOLDERS')
  assert.equal(schema.properties.request.type, 'string')
}
test('context and experience expose one required JSON request, not optional action fields', () => {
  providerSafe(context)
  providerSafe(experience.PARAMETERS)
})
test('minimal restore and review decode without adding unrelated fields', () => {
  assert.deepEqual(decodeRequest({ request: '{"action":"restore"}' }, invalid), { action: 'restore' })
  assert.deepEqual(decodeRequest({ request: '{"action":"review"}' }, invalid), { action: 'review' })
  assert.deepEqual(decodeRequest({ request: '{"action":"restore","scope":"session"}' }, invalid), { action: 'restore', scope: 'session' }, 'decoder must not discard a field to fool the action validator')
})
test('envelope rejects extra fields, malformed JSON and oversize strings', () => {
  for (const args of [{ request: '{}', action: 'restore' }, { request: {} }, { request: '{' }, { request: ' '.repeat(32769) }]) assert.throws(() => decodeRequest(args, invalid), /INVALID_REQUEST/)
  // Strict legacy executor compatibility is retained; the action validator still rejects its bad keys.
  const legacy = { action: 'restore', note: {}, scope: 'session' }
  assert.equal(decodeRequest(legacy, invalid), legacy)
})
