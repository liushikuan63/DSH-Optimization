// ask-user-auto-pick -- DSH host plugin: when a *timed* ask_user_question
// runs out of time, answer it with the recommended option instead of leaving
// the call pending.
//
// Why it exists (2026-10-01, user request): "问题弹窗 90s 无操作，自动选择推荐选项".
// DSH already ships half of that: with `tool-ask-user` configured
// `mode: timed, timeout: 90` the question card owns a countdown, a first option
// labelled "(Recommended)"/"（推荐）" starts as a preselected draft, and when the
// countdown ends the Client rejects with `ASK_TIMED_OUT` -- which the host maps
// to `{pending: true}` and the agent walks away with the question still open.
// The missing half is the submit. This plugin supplies it.
//
// Seam: `user-questions/request` is a Cordis **waterfall** event
// (dsh-api-remotes/lib/types/remote-events.js). The Client answerer is one
// listener on it (`ctx.remote.$on`), the user-questions service calls it from
// `ask()`. A listener may call `next()` to reach the downstream answerers, so
// this plugin sits in front, lets the real UI answer normally, and only
// substitutes an answer when the request settles as "timed out".
//
// Policy pinned by the user (2026-10-01, see README.md):
//   * only the FIRST option carrying the recommendation marker counts;
//   * all-or-nothing per batch: every question needs one, else stay pending;
//   * auto answers carry a trace in `custom` and a log line;
//   * multi-select questions stay pending (conservative default, knob to allow);
//   * only timed requests are eligible; blocking calls are never answered here.
//
// Builtins-only imports: a plugin loaded from ~/.dsh/plugins cannot resolve
// @deepseek-ai/* (they live inside the app asar).

import { appendFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'ask-user-auto-pick'

const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ''
  ? process.env.DSH_HOME
  : join(homedir(), '.dsh')
const logPath = join(dshHome, 'logs', 'ask-user-auto-pick.log')
const LOG_MAX_BYTES = 256 * 1024

/** Same rule as the Client card (dsh-client-ui-user-questions/lib/client.js). */
export const RECOMMENDED_SUFFIX = /\s*(?:\((?:recommended|推荐)\)|（(?:recommended|推荐)）)\s*$/i

/** Trace written into `custom` so both the model and the card can tell it apart. */
export const AUTO_TRACE = '无操作超时，系统已自动选择推荐项（ask-user-auto-pick）'

function log(line) {
  try {
    mkdirSync(join(dshHome, 'logs'), { recursive: true })
    try {
      if (statSync(logPath).size > LOG_MAX_BYTES) writeFileSync(logPath, '')
    } catch { /* first write */ }
    appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`)
  } catch { /* diagnostics must never break the run */ }
}

/** Recommended label of a question, or undefined when its first option lacks the marker. */
export function recommendedLabel(question) {
  const label = question?.options?.[0]?.label
  return typeof label === 'string' && RECOMMENDED_SUFFIX.test(label) ? label : undefined
}

/**
 * Build the answer batch this plugin would submit, or null to stay out of the way.
 * Null means "call next() and let the real answerer decide".
 * @param request - The `user-questions/request` payload.
 * @param options - { skipIntent, allowMultiSelect, trace }.
 * @returns `{ answers }` ready for the waterfall, or null.
 */
export function pickAnswers(request, options = {}) {
  const trace = options.trace ?? AUTO_TRACE
  // Only a timed call has a deadline to run out of; blocking calls wait forever.
  if (request?.wait?.timed !== true) return null
  const questions = request?.questions
  if (!Array.isArray(questions) || questions.length === 0) return null
  const answers = []
  for (const question of questions) {
    // Intent-bearing questions carry authorization semantics, not preferences.
    // No configuration or recommendation label may turn silence into approval.
    if (question?.intent !== undefined && question?.intent !== null) return null
    // A multi-select batch is a set, not a choice; guessing one member of it is
    // not the "pick the recommendation" behaviour this plugin promises.
    if (options.allowMultiSelect !== true && question?.multiSelect === true) return null
    const label = recommendedLabel(question)
    if (label === undefined) return null
    answers.push({ id: question.id, selected: [label], custom: trace })
  }
  return { answers }
}

/** Stable code from whatever shape a waterfall rejection arrives in. */
export function errorCode(error) {
  if (error === undefined || error === null) return undefined
  if (typeof error === 'string') return error
  if (typeof error.code === 'string') return error.code
  if (typeof error.name === 'string' && error.name !== 'Error') return error.name
  if (typeof error.message === 'string') return error.message
  return undefined
}

/** Whether a rejection is the client/host countdown expiring. */
export function isAskTimedOut(error) {
  const code = errorCode(error)
  if (typeof code !== 'string') return false
  // The code is what the service and the remote layer carry; the message text is
  // the belt-and-braces form of the same business error.
  return code.includes('ASK_TIMED_OUT') || code.includes('timed out before the user answered')
}

/**
 * Whether the request signal settled because its timed wait expired.
 * Only `ASK_TIMED_OUT` counts; a cancelled turn or a disposed session must not
 * be mistaken for a deadline, or a stopped run would answer itself.
 * @param signal - The request signal (the TimedQuestionWait's signal when timed).
 * @returns true when the deadline fired.
 */
export function timedOutBySignal(signal) {
  return signal !== undefined && signal.aborted === true && isAskTimedOut(signal.reason)
}

/** Wait until the wait signal settles, then report whether it was the deadline. */
export function awaitWaitOutcome(signal) {
  if (signal === undefined) return Promise.resolve(false)
  if (signal.aborted === true) return Promise.resolve(timedOutBySignal(signal))
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(timedOutBySignal(signal)), { once: true })
  })
}

/** Environment knobs, read once per host load. */
export function readOptions(env = process.env) {
  return {
    enabled: env.DSH_ASK_USER_AUTO_PICK === '1',
    skipIntent: true,
    allowMultiSelect: env.DSH_ASK_USER_AUTO_PICK_ALLOW_MULTI === '1',
    trace: AUTO_TRACE,
  }
}

/**
 * Register the waterfall listener in front of the Client answerer.
 * @param ctx - Host-plane Cordis context.
 */
export function apply(ctx) {
  const options = readOptions()
  log(`loaded: enabled=${options.enabled} skipIntent=${options.skipIntent} allowMultiSelect=${options.allowMultiSelect}`)
  if (!options.enabled) return

  ctx.effect(function* () {
    ctx.on('user-questions/request', async function (request, next) {
      const answers = pickAnswers(request, options)
      if (answers === null) return next()
      const ids = answers.answers.map((item) => item.id).join(',')
      try {
        return await next()
      } catch (error) {
        // A late timeout must never turn a user cancellation into an answer.
        if (request?.signal?.aborted && !timedOutBySignal(request.signal)) throw error
        if (isAskTimedOut(error)) {
          log(`auto-picked after ASK_TIMED_OUT questions=${ids}`)
          return answers
        }
        // No answerer is attached (headless run, closed client): the service
        // waits out the same host deadline, so mirror it here.
        const code = errorCode(error)
        if (typeof code === 'string' && code.includes('NO_PROVIDER')) {
          if (await awaitWaitOutcome(request?.signal)) {
            log(`auto-picked after host deadline (no answerer) questions=${ids}`)
            return answers
          }
        }
        throw error
      }
    })

    yield () => { /* the listener is disposed with this effect's scope */ }
  })
}
