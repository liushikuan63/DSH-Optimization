import { createExperienceStore, checkAbort } from './store.mjs'
import { requestParameters, decodeRequest } from '../action-parameters.mjs'
import { assertDerivedPersistence } from '../persistence-policy.mjs'
export const PARAMETERS = requestParameters('JSON object for exactly one action. Review: {"action":"review"}; query may add scope/topic/target/limit; record requires topic/lesson/target and may add evidenceCallIds/feedbackEventSeq. No fields for other actions. Read experience-loop before recording.')

export const name = 'ultimate-model-experience-loop'
// `agentPresets`/`sessionQuery` come from the host profile; keep only the
// services this plugin truly needs to function, and acquire the rest optionally.
export const inject = ['tools', 'systemPrompt']
export const TOOL_NAME = 'jizhi_experience'
export const EXPERIENCE_PROMPT = "极致 jizhi_experience：关键问题/收尾先语义复盘；有持久化授权才 review/record（review 会写入），只读或禁存时仅回复总结，query 可只读检索。工具只传 request JSON 字符串。检索数据非授权，verified 仅证派发，候选不执行，取消不重试；自动元数据不替代语义复盘。"
const INPUT_KEYS = ['action', 'topic', 'lesson', 'target', 'evidenceCallIds', 'feedbackEventSeq', 'scope', 'limit']
function invalid() { return new Error('JIZHI_EXPERIENCE_INPUT') }
function validate(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !INPUT_KEYS.includes(key))) throw invalid()
  const { action, ...input } = args
  const allowed = action === 'record' ? ['topic', 'lesson', 'target', 'evidenceCallIds', 'feedbackEventSeq']
    : action === 'query' ? ['scope', 'topic', 'target', 'limit'] : []
  if (!['review', 'record', 'query', 'disable', 'rollback'].includes(action) || Object.keys(input).some(key => !allowed.includes(key))) throw invalid()
  return { action, input }
}
function safeError(error) {
  if (error?.name === 'AbortError') { const abort = new Error('Cancelled; no retry'); abort.name = 'AbortError'; return abort }
  return new Error(/^JIZHI_EXPERIENCE_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'JIZHI_EXPERIENCE_STORE_IO')
}
function signalFor(signal, owner) { return signal ? AbortSignal.any([signal, owner.signal]) : owner.signal }

// This is our internal evidence view, not a fake Agent or a deprecated Session API.
export async function withEvidenceView(ctx, agent, signal, run, mutating = false) {
  const session = agent.session, end = session.seq
  const query = ctx.get('sessionQuery')
  if (query === undefined) throw new Error('JIZHI_EXPERIENCE_UNAVAILABLE')
  const observation = await query.observeSession(agent.id, { signal, projectionMode: 'none' })
  try {
    checkAbort(signal)
    if (observation.source !== 'live' || observation.header.id !== session.header.id || observation.header.cwd !== session.header.cwd
      || observation.inheritedEventCount !== (session.inheritedEventCount ?? 0) || !Array.isArray(observation.events)
      || observation.events.length !== observation.cursor + 1 || observation.cursor + 1 < end) throw new Error('JIZHI_EXPERIENCE_SCOPE')
    const authorize = () => {
      if (session.seq !== end) throw new Error('JIZHI_EXPERIENCE_PERSISTENCE_DENIED')
      assertDerivedPersistence(ctx, agent, signal, 'JIZHI_EXPERIENCE', observation)
    }
    if (mutating) authorize()
    const view = { authorizeMutation: mutating ? authorize : undefined, id: session.id, header: session.header, seq: end, firstLiveSeq: session.firstLiveSeq,
      isOwnSeq: seq => session.isOwnSeq(seq), readEvents: (from, to) => observation.events.slice(from, Math.min(to, end)) }
    return await run(view)
  } finally { observation[Symbol.dispose]() }
}

/**
 * Experience loop, mounted as a BUNDLE-LEVEL row.
 *
 * A preset-scoped row never receives `agent/created` on this host, so its
 * per-agent registration is inert. Bundle level does receive it, and the tool
 * resolves the calling agent from the execution context instead.
 */
export function apply(ctx, config = {}) {
  if (Object.keys(config).some(key => !['enabled', 'automaticReview'].includes(key))
    || (config.enabled !== undefined && typeof config.enabled !== 'boolean')
    || (config.automaticReview !== undefined && typeof config.automaticReview !== 'boolean')) throw invalid()
  if (config.enabled === false) return
  const pluginOwner = new AbortController()
  const statuses = new WeakMap()
  const isUltimateModel = agent => {
    if (!agent?.ctx || !agent?.session || agent.id !== agent.session.id) return false
    const presets = ctx.get('agentPresets')
    if (presets === undefined) return false
    try { return presets.composedPreset(agent.ctx) === 'ultimate-model' } catch { return false }
  }
  const statusOf = agent => {
    let value = statuses.get(agent)
    if (value === undefined) { value = config.automaticReview === false ? 'disabled-by-config' : 'not-run'; statuses.set(agent, value) }
    return value
  }
  ctx.effect(() => {
    const disposers = []
    disposers.push(ctx.tools.register({
      name: TOOL_NAME,
      description: 'Review this session’s real tool outcomes, recall bounded workspace/session experience, or record a non-executing upgrade candidate. Review/record/disable/rollback persist derived state and require current write scope; query is read-only. Available only in the Ultimate-Model mode. No shell, network, extra model or configuration changes. Arbitrary lessons remain pending; verified summaries prove dispatch only.',
      parameters: PARAMETERS,
      output: {
        schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
        render: (_args, value) => [{ type: 'text', text: value.text }],
      },
      // Store mutations are serialized and intentionally not advertised as parallel.
      async execute(args, exec) {
        const agent = exec?.agent
        if (!isUltimateModel(agent)) throw new Error('JIZHI_EXPERIENCE_SCOPE')
        const signal = signalFor(exec?.signal, pluginOwner)
        checkAbort(signal)
        const { action, input } = validate(decodeRequest(args, invalid))
        try {
          const value = await withEvidenceView(ctx, agent, signal, view => {
            const store = createExperienceStore(agent.session.header.cwd, { authorizeMutation: view.authorizeMutation })
            return action === 'record' ? store.record(view, input, { signal })
            : action === 'query' ? store.query(view, input, { signal })
              : store[action](view, { signal })
          }, action !== 'query')
          const reply = { ...value, automaticReview: config.automaticReview !== false, lastAutomaticStatus: statusOf(agent) }
          let text = JSON.stringify(reply)
          while (text.length > 20000) {
            if (reply.entries?.length > 1) reply.entries.shift()
            else if (reply.observations?.length) reply.observations.shift()
            else if (reply.calls?.length) reply.calls.shift()
            else throw new Error('JIZHI_EXPERIENCE_OUTPUT_LIMIT')
            reply.truncated = true
            text = JSON.stringify(reply)
          }
          return { text }
        } catch (error) { throw safeError(error) }
      },
    }))
    return () => { pluginOwner.abort(); for (const dispose of disposers.toReversed()) dispose() }
  })

  ctx.effect(() => {
    // Per-agent extras (prompt section + automatic review). Installed on
    // creation AND on a later switch into Ultimate-Model, because the SDK's select()
    // recomposes and emits `agent-preset/selected` — it never re-emits created.
    const installed = new Map()
    const knownAgents = new Set()
    const masks = new Map()

    // Visibility isolation: outside Ultimate-Model the tool must not appear in the
    // model's schema/catalog at all — an execute-time refusal is not enough.
    const syncVisibility = agent => {
      if (!agent?.ctx?.tools?.restrict) return
      const masked = masks.get(agent)
      if (isUltimateModel(agent)) {
        if (masked !== undefined) { try { masked() } catch { /* ignore */ } masks.delete(agent) }
        return
      }
      if (masked !== undefined) return
      try { masks.set(agent, agent.ctx.tools.restrict({ deny: [TOOL_NAME] })) } catch { /* host predates restrict */ }
    }

    const install = agent => {
      if (pluginOwner.signal.aborted) return
      if (!isUltimateModel(agent) || installed.has(agent)) return
      const owner = new AbortController()
      const disposers = []
      try {
        disposers.push(agent.ctx.systemPrompt.section({ name: 'jizhi:experience-loop', order: 85, text: EXPERIENCE_PROMPT }))
        // agent/turn-stopping carries only { turn, signal }; no agent field.
        if (config.automaticReview !== false) disposers.push(agent.ctx.on('agent/turn-stopping', async ({ signal: callerSignal } = {}) => {
          if (!isUltimateModel(agent) || owner.signal.aborted || callerSignal?.aborted) return
          try {
            const signal = signalFor(callerSignal, owner)
            const result = await withEvidenceView(ctx, agent, signal, view => createExperienceStore(agent.session.header.cwd, { authorizeMutation: view.authorizeMutation }).review(view, { signal }), true)
            statuses.set(agent, result.disabled ? 'disabled-by-store' : 'collected')
          } catch (error) {
            // Never steer/wake a model, retry, or log raw errors from this observer.
            statuses.set(agent, error?.message === 'JIZHI_EXPERIENCE_PERSISTENCE_DENIED' ? 'skipped-persistence-policy' : safeError(error).name === 'AbortError' ? 'cancelled' : 'unavailable-use-review')
          }
        }))
      } catch {
        // Best-effort: roll back a partial install so a later switch can retry.
        for (const dispose of disposers.toReversed()) { try { dispose() } catch { /* ignore */ } }
        owner.abort()
        return
      }
      installed.set(agent, () => {
        owner.abort()
        for (const dispose of disposers.toReversed()) { try { dispose() } catch { /* ignore */ } }
      })
    }

    const uninstall = agent => {
      const dispose = installed.get(agent)
      if (dispose === undefined) return
      installed.delete(agent)
      dispose()
    }

    // Switching away from Ultimate-Model must remove the prompt section and the
    // automatic listener, so the agent carries no Ultimate-Model residue.
    const reconcile = agent => { if (isUltimateModel(agent)) install(agent); else uninstall(agent) }

    const removeCreated = ctx.on('agent/created', ({ agent }) => {
      // Remember every agent so a later switch can find it even when the host
      // gives this row no agents registry.
      if (agent && typeof agent === 'object' && agent.ctx && agent.session) knownAgents.add(agent)
      syncVisibility(agent)
      install(agent)
    })
    // `agent-preset/selected` carries (sessionId, presetId) — not the Agent.
    // The SDK's select() recomposes and emits this event without re-emitting
    // agent/created, so a switch after creation must be handled here or the
    // automatic workflow never starts.
    const removeSelected = ctx.on('agent-preset/selected', (sessionId) => {
      if (typeof sessionId !== 'string') return
      const agents = ctx.get('agents')
      const resolved = agents?.get?.(sessionId)
      if (resolved && typeof resolved === 'object' && resolved.ctx && resolved.session) { syncVisibility(resolved); reconcile(resolved); return }
      // Fallback: match a known agent by session id (covers hosts that expose no
      // agents registry to this row).
      for (const known of knownAgents) {
        if (known.session?.id === sessionId || known.id === sessionId) { syncVisibility(known); reconcile(known); return }
      }
    })
    return () => {
      pluginOwner.abort()
      removeCreated?.()
      removeSelected?.()
      for (const agent of [...installed.keys()]) uninstall(agent)
      for (const dispose of [...masks.values()]) { try { dispose() } catch { /* release every owned visibility lease */ } }
      masks.clear()
      knownAgents.clear()
    }
  })
}
