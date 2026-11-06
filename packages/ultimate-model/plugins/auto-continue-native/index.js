// auto-continue-native -- DSH host plugin: keep an unattended run going when a
// turn dies of a transport/provider failure instead of stopping until the user
// types again.
//
// Layer split (why both this and a retryPolicy exist):
//   * dsh-llm-retry + llm-deepseek retryPolicy re-run the FAILED MODEL REQUEST
//     inside the same open turn (>=5 attempts, configured in ~/.dsh/cordis.patch.yml).
//   * This plugin handles what that cannot: the turn itself ends in error
//     (budget exhausted, provider down for minutes, host-level failure). It
//     queues one continuation prompt per failure, bounded by DSH_AUTO_CONTINUE_MAX
//     (default 8), with growing backoff.
//
// Deliberate refusals (a wrong auto-resume is worse than a stopped run):
//   * user cancellation / aborts are never resumed;
//   * credential, quota, invalid-request and context-overflow failures are not
//     recoverable by retrying, so they stop and stay stopped;
//   * while an active armed goal exists, dsh-goal-round-driver owns continuation
//     and this plugin yields;
//   * a new human message resets the whole counter.
//
// The plugin imports node builtins only: a plugin loaded from
// ~/.dsh/plugins cannot resolve @deepseek-ai/* (those live inside the app asar),
// so the continuation message is constructed here rather than via
// createUserMessage. A message id is an opaque branded string (brandString does
// no validation), so a UUID is a valid identity.
//
// `source.kind` must be the namespaced `plugin:<name>` producer, not the retired
// `{ kind: 'plugin', plugin }` wrapper: Agent.followup() passes the source through
// unnormalized, and session-format v4 admission rejects `kind === 'plugin'`, which
// fails the turn it was meant to rescue. Keep it distinct from 'user' so the
// human-input reset below still tells a real prompt from a continuation.

import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'auto-continue-native'

const DEFAULT_MAX = 8
const DEFAULT_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000, 180_000, 300_000, 300_000, 300_000, 300_000, 300_000]
const LOG_MAX_BYTES = 512 * 1024

/**
 * Non-recoverable failure families: retrying cannot change the outcome.
 *
 * `FORMAT|SCHEMA|PRODUCER-OWNED` 是 2026-10-13 补的：宿主抛出
 * `format v4 message requires a producer-owned source kind` 时，这条消息里
 * **没有任何**旧关键词，于是被判成可重试 —— 实测 2026-10-03 起三天里
 * `session-b7a6aaf5` 因此重排了 233 条日志（8/8 用尽后，下一条人类输入又把
 * 计数器清零重来）。同一条消息反复格式化结果永远一样，重试不改变结果。
 *
 * 已知边界（本次未改，避免顺手改宽）：`AUTH` 是前缀匹配，
 * `AUTH_TIMEOUT` 这种**暂时性**错误也会被判成不可恢复。要精确化需要把
 * `AUTH` 拆成 `AUTH_(FAIL|FAILED|DENIED)`，属于独立的一次改动。
 */
const NON_RECOVERABLE = /(ABORT|CANCEL|MISSING_CREDENTIAL|INVALID_CREDENTIAL|AUTH|QUOTA|CONTEXT_WINDOW|INVALID_REQUEST|REQUEST_EXTENSION|UNSUPPORTED|FORMAT|SCHEMA|PRODUCER-OWNED)/i

const dshHome = process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ''
  ? process.env.DSH_HOME
  : join(homedir(), '.dsh')
const logPath = join(dshHome, 'logs', 'auto-continue-native.log')

/** Positive integer from the environment, clamped to a sane range. */
function readMax() {
  const raw = Number(process.env.DSH_AUTO_CONTINUE_MAX)
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MAX
  return Math.min(Math.floor(raw), 200)
}

/**
 * Backoff ladder from the environment (`15000,30000,...`) or the default.
 * Exported for tests; the last entry repeats once the ladder is exhausted.
 */
export function readBackoff() {
  const raw = process.env.DSH_AUTO_CONTINUE_BACKOFF_MS
  if (raw === undefined || raw.trim() === '') return DEFAULT_BACKOFF_MS
  const values = raw.split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0)
  return values.length > 0 ? values : DEFAULT_BACKOFF_MS
}

/** One-time log hygiene: truncate instead of rotating, this is a diagnostic tail. */
function log(line) {
  try {
    mkdirSync(join(dshHome, 'logs'), { recursive: true })
    try {
      if (statSync(logPath).size > LOG_MAX_BYTES) writeFileSync(logPath, '')
    } catch { /* first write: nothing to truncate */ }
    appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`)
  } catch { /* diagnostics must never break the run */ }
}

/** Flatten an unknown thrown value into a searchable string. */
export function describeError(error) {
  if (error === null || error === undefined) return ''
  if (typeof error === 'string') return error
  if (typeof error !== 'object') return String(error)
  const code = typeof error.code === 'string' ? error.code : ''
  const errorName = typeof error.name === 'string' ? error.name : ''
  const message = typeof error.message === 'string' ? error.message : ''
  return `${code} ${errorName} ${message}`.trim()
}

/**
 * Whether a failed turn should be continued automatically.
 * Exported so the decision is testable without a live agent.
 */
export function shouldContinue(error) {
  const text = describeError(error)
  if (text === '') return true // unknown failure: the bounded counter still applies
  return !NON_RECOVERABLE.test(text)
}

/** One continuation prompt per failed turn. */
export function renderContinuationPrompt(attempt, max, reason) {
  return [
    '<auto_continue>',
    `The previous turn ended with an error (continuation ${attempt}/${max}).`,
    reason ? `Reported failure: ${reason}` : 'No failure detail was reported.',
    '',
    'Resume the work you were doing in this same session, without redoing finished steps:',
    '1. Inspect the actual current state (files, git status, tool output) instead of trusting earlier narration.',
    '2. Locate the first unfinished or broken step and continue from there.',
    '3. If the failure was a network/provider problem that has passed, simply retry the interrupted operation.',
    '4. If you are truly blocked after investigating, say exactly what blocks you and what the user must provide.',
    '</auto_continue>',
  ].join('\n')
}

/** Install bounded automatic continuation for failed turns. */
export function apply(ctx) {
  const max = readMax()
  const states = new Map()
  log(`loaded: continuation budget=${max} backoff=${readBackoff().join(',')} home=${dshHome}`)

  function stateFor(agent) {
    let state = states.get(agent)
    if (state === undefined) {
      state = { agent, failures: 0, pending: false, timer: undefined, reason: undefined, exhausted: false }
      states.set(agent, state)
    }
    return state
  }

  function clearTimer(state) {
    state.generation = (state.generation ?? 0) + 1
    if (state.timer !== undefined) {
      clearTimeout(state.timer)
      state.timer = undefined
    }
  }

  function forget(agent) {
    const state = states.get(agent)
    if (state !== undefined) clearTimer(state)
    states.delete(agent)
  }

  /**
   * Run plugin work behind a hard no-escape boundary.
   *
   * Everything this plugin does is best-effort bookkeeping or a follow-up the
   * agent may refuse. An exception escaping a callback here surfaces as
   * `dsh: fatal uncaught exception` and takes the whole host process down
   * (see crash-2026-10-01T06-34-18-456Z-host.log), so a failure is logged and
   * swallowed instead — one lost continuation is always cheaper than a dead app.
   */
  function guard(label, fn) {
    try {
      return fn()
    } catch (error) {
      log(`${label} failed: ${describeError(error)}`)
      return undefined
    }
  }

  /**
   * Look up a host service without ever throwing.
   *
   * `ctx.<name>` is a Cordis *property* access: unless the plugin declared that
   * dependency through `ctx.inject([name], ...)`, the context proxy raises
   * `cannot get property "<name>" without inject`. The plugin surface DSH ships
   * documents is `ctx.get(name): unknown | undefined` ("prefer ctx.get(name)
   * with an undefined check"), which is what the goal lookup uses.
   */
  function serviceOf(name) {
    try {
      return ctx.get?.(name) ?? null
    } catch {
      return null
    }
  }

  /** dsh-goal-round-driver owns continuation while an armed goal is active. */
  function goalOwnsContinuation(agent) {
    try {
      const goal = serviceOf('goals')?.get?.(agent)
      return goal?.phase === 'active' && goal?.activation === 'armed'
    } catch {
      return false
    }
  }

  /** True when this exact agent is still live and quiet enough to be queued onto. */
  function queueable(agent) {
    // A missing registry is not a reason to queue blindly. When `agents` is
    // unavailable the liveness signal is whatever the event payload carries;
    // when it is available but unreadable, refuse the continuation and say so.
    const agents = serviceOf('agents')
    if (agents !== null) {
      let current
      try {
        current = agents.get?.(agent.id)
      } catch (error) {
        log(`agent=${agent.id} agent registry unreadable: ${describeError(error)}`)
        return false
      }
      if (current !== agent) return false
    }
    if (agent.status !== 'idle') return false
    try {
      return agent.inbox.nextTurn.length === 0 && agent.inbox.nextStep.length === 0
    } catch {
      return true
    }
  }

  function queueContinuation(state, reason) {
    const agent = state.agent
    if (goalOwnsContinuation(agent)) {
      log(`agent=${agent.id} skip: active goal owns continuation`)
      return
    }
    if (!queueable(agent)) {
      log(`agent=${agent.id} skip: agent busy again`)
      return
    }
    const message = {
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text: renderContinuationPrompt(state.failures + 1, max, reason) }],
      source: { kind: `plugin:${name}` },
    }
    try {
      agent.followup(message)
      state.failures += 1
      log(`agent=${agent.id} queued continuation ${state.failures}/${max}`)
    } catch (error) {
      log(`agent=${agent.id} followup failed: ${describeError(error)}`)
    }
  }

  /** Register a listener whose body can never throw back into the host. */
  function onGuarded(event, handler) {
    ctx.on(event, (payload) => guard(`${event} handler`, () => handler(payload ?? {})))
  }

  ctx.effect(function* () {
    onGuarded('agent/error', ({ agent, error }) => {
      const state = stateFor(agent)
      // A later cancellation revokes earlier work, even while a retry is queued.
      const reason = describeError(error)
      if (!shouldContinue(error)) {
        clearTimer(state)
        state.pending = false
        state.reason = undefined
        state.exhausted = true
        state.failures = 0
        log(`agent=${agent.id} stop: non-recoverable failure "${reason}"`)
        return
      }
      if (state.pending || state.timer !== undefined || state.exhausted) return
      if (state.failures >= max) {
        // Latch the exhaustion: without it the next healthy idle would reset the
        // counter and hand the run an unbounded supply of fresh continuation
        // budgets. Only a human message clears this.
        state.exhausted = true
        log(`agent=${agent.id} stop: continuation limit ${max} reached ("${reason}")`)
        return
      }
      state.pending = true
      state.reason = reason
      log(`agent=${agent.id} failure recorded ("${reason}"), awaiting idle`)
    })

    onGuarded('agent/status', ({ agent, status }) => {
      const state = stateFor(agent)
      if (status === 'running') return
      if (status !== 'idle') return
      if (!state.pending) {
        // A turn that reached idle without a recorded failure completed; the
        // counter exists to bound one failing streak, not a session lifetime.
        if (state.exhausted) return
        if (state.failures !== 0) log(`agent=${agent.id} healthy idle: counter reset`)
        state.failures = 0
        return
      }
      state.pending = false
      const ladder = readBackoff()
      const delay = ladder[Math.min(state.failures, ladder.length - 1)]
      const reason = state.reason
      state.reason = undefined
      clearTimer(state)
      const generation = state.generation
      state.timer = setTimeout(() => {
        if (state.generation !== generation || state.exhausted || states.get(agent) !== state) return
        state.timer = undefined
        guard(`agent=${agent.id} queue continuation`, () => queueContinuation(state, reason))
      }, delay)
      state.timer.unref?.()
      log(`agent=${agent.id} continuation scheduled in ${delay}ms`)
    })

    onGuarded('agent/inbox/inserted', ({ agent, message }) => {
      if (message?.source?.kind !== 'user') return
      const state = stateFor(agent)
      clearTimer(state)
      state.pending = false
      state.reason = undefined
      state.exhausted = false
      if (state.failures !== 0) log(`agent=${agent.id} human input: counter reset`)
      state.failures = 0
    })

    onGuarded('agent/disposed', ({ agent }) => forget(agent))

    yield () => {
      for (const state of states.values()) clearTimer(state)
      states.clear()
    }
  })
}
