import test from 'node:test'
import assert from 'node:assert/strict'
import { checkClarification, checkDirectActionAllowed, ClarificationContractError } from '../plugins/intent-clarification-contract.mjs'

const options = [
  { label: '按字面理解', tradeoff: '最贴合原话，但可能漏掉你真正的意图' },
  { label: '按上下文理解', tradeoff: '更可能命中目的，但偏离了字面表述' },
]

const good = {
  restatedIntent: '你要我优化这套规则',
  options,
  recommended: '按上下文理解',
  reason: '你前一句在讲模式装载，上下文更相关',
  pending: true,
  actionTaken: false,
}

test('a well-formed clarifying reply passes and reports its shape', () => {
  const result = checkClarification(good, {})
  assert.equal(result.ok, true)
  assert.equal(result.optionCount, 2)
  assert.equal(result.pending, true)
})

test('the restatement is required: a reply that silently reinterpreted fails', () => {
  assert.throws(() => checkClarification({ ...good, restatedIntent: '   ' }), (error) => error instanceof ClarificationContractError && error.message === 'RESTATE_MISSING')
})

test('option count is bounded to 2-4', () => {
  assert.throws(() => checkClarification({ ...good, options: [options[0]] }), /OPTIONS_COUNT/)
  assert.throws(() => checkClarification({ ...good, options: [...options, ...options, ...options] }), /OPTIONS_COUNT/)
})

test('every option must state a tradeoff, not just a label', () => {
  assert.throws(() => checkClarification({ ...good, options: [options[0], { label: 'B', tradeoff: '' }] }), /OPTION_TRADEOFF/)
})

test('a recommendation must be one of the offered options and carry a reason', () => {
  assert.throws(() => checkClarification({ ...good, recommended: '第三种' }), /RECOMMEND_NOT_AN_OPTION/)
  assert.throws(() => checkClarification({ ...good, reason: '' }), /REASON_MISSING/)
})

test('acting before confirmation is refused', () => {
  assert.throws(() => checkClarification({ ...good, actionTaken: true }), /EXECUTED_BEFORE_CONFIRMATION/)
})

test('a timeout, an automatic answer, or accepting the recommendation is NOT human confirmation', () => {
  const resolved = { ...good, pending: false, answeredBy: 'human' }
  assert.equal(checkClarification(resolved, {}).ok, true, 'a real human answer resolves it')

  for (const context of [{ timeout: true }, { autoAnswer: true }, { recommendationAccepted: true }]) {
    assert.throws(() => checkClarification(resolved, context), /NON_HUMAN_CONFIRMATION/)
  }
})

test('resolving without naming a human source fails', () => {
  assert.throws(() => checkClarification({ ...good, pending: false, answeredBy: 'system' }), /CONFIRMATION_SOURCE/)
})

test('an explicit unambiguous request proceeds without a clarification', () => {
  assert.deepEqual(checkDirectActionAllowed({ explicit: true }, { ambiguous: false }), { ok: true, proceeded: true })
})

test('an ambiguous request must carry a valid clarification instead of acting', () => {
  assert.throws(() => checkDirectActionAllowed({ candidate: { ...good, actionTaken: true } }, { ambiguous: true }), /EXECUTED_BEFORE_CONFIRMATION/)
  assert.equal(checkDirectActionAllowed({ candidate: good }, { ambiguous: true }).ok, true)
})
