/**
 * Structural contract for a clarification message.
 *
 * The `intent-clarification` skill is prose, so nothing in the runtime forces a
 * clarifying reply to actually contain what the skill promises. This module is
 * the missing check: given a candidate reply and the flags describing how it was
 * produced, decide whether it honours the contract.
 *
 * It is deliberately narrow. It judges STRUCTURE, not wording quality:
 *   - the user's intent is restated (not silently reinterpreted)
 *   - 2-4 concrete options are offered, each with a stated tradeoff
 *   - one option is recommended AND the reason is given
 *   - the action stays pending until a human answers
 *   - a timeout, a recommended badge, or an automatic answer never counts as
 *     that human answer
 */
export class ClarificationContractError extends Error {
  constructor(code) { super(code); this.name = 'ClarificationContractError' }
}

const fail = (code) => { throw new ClarificationContractError(code) }

/** Options are the concrete readings the user may pick from. */
function checkOptions(options) {
  if (!Array.isArray(options)) fail('OPTIONS_MISSING')
  if (options.length < 2 || options.length > 4) fail('OPTIONS_COUNT')
  for (const option of options) {
    if (option === null || typeof option !== 'object') fail('OPTION_SHAPE')
    if (typeof option.label !== 'string' || option.label.trim() === '') fail('OPTION_LABEL')
    if (typeof option.tradeoff !== 'string' || option.tradeoff.trim() === '') fail('OPTION_TRADEOFF')
  }
}

/**
 * @param candidate the reply under test
 * @param context how it was produced and whether a human actually answered
 */
export function checkClarification(candidate, context = {}) {
  if (candidate === null || typeof candidate !== 'object') fail('REPLY_SHAPE')

  // Restating the original intent is what keeps a clarification from becoming a
  // silent reinterpretation.
  if (typeof candidate.restatedIntent !== 'string' || candidate.restatedIntent.trim() === '') fail('RESTATE_MISSING')
  checkOptions(candidate.options)

  if (typeof candidate.recommended !== 'string' || candidate.recommended.trim() === '') fail('RECOMMEND_MISSING')
  if (!candidate.options.some((option) => option.label === candidate.recommended)) fail('RECOMMEND_NOT_AN_OPTION')
  if (typeof candidate.reason !== 'string' || candidate.reason.trim() === '') fail('REASON_MISSING')

  // The action must not have been taken while the ambiguity is unresolved.
  if (candidate.actionTaken === true) fail('EXECUTED_BEFORE_CONFIRMATION')

  const answeredBy = candidate.answeredBy
  if (candidate.pending !== true && answeredBy === undefined) fail('PENDING_STATE_UNCLEAR')

  // Only a human turn can resolve the pending state. A recommendation, a
  // timeout, or an automatically produced answer is explicitly not consent.
  const forgeable = context.timeout === true || context.autoAnswer === true || context.recommendationAccepted === true
  if (candidate.pending === false && forgeable) fail('NON_HUMAN_CONFIRMATION')
  if (candidate.pending === false && answeredBy !== 'human') fail('CONFIRMATION_SOURCE')

  return { ok: true, optionCount: candidate.options.length, recommended: candidate.recommended, pending: candidate.pending === true }
}

/** A reply that never asked and simply acted is the failure this guards against. */
export function checkDirectActionAllowed(request, context = {}) {
  if (request?.explicit === true && context.ambiguous !== true) return { ok: true, proceeded: true }
  if (context.ambiguous === true) return checkClarification(request?.candidate, context)
  fail('CLARIFY_OR_PROCEED_UNDECIDED')
}
