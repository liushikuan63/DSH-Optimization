/**
 * Context checkpoint, mounted as a BUNDLE-LEVEL row.
 *
 * Why not inside the preset: on this host the preset's row tree never receives
 * `agent/created`, so any per-agent registration made from that listener is
 * silently inert. A bundle-level row does receive it, and — more robustly — can
 * resolve the calling agent from the tool execution context itself.
 *
 * Scope rule: the tool and its restore gate act only on agents whose composed
 * preset is `ultimate-model`. Every other agent sees nothing.
 */
import { createContextStore, checkAbort } from './store.mjs'
import { requestParameters, decodeRequest } from '../action-parameters.mjs'
import { assertDerivedPersistence, capturePersistenceSnapshot } from '../persistence-policy.mjs'

export const name = 'ultimate-model-context-checkpoint'
export const inject = ['tools', 'systemPrompt']
export const TOOL_NAME = 'jizhi_context'
export const CONTEXT_PROMPT = "极致 jizhi_context：有持久化授权时在里程碑/压缩/交接前 save；只读或禁存时仅回复总结，inspect/restore 可只读核对。文件状态用 added/modified/deleted/unchanged/unknown。恢复先 restore，复核当前用户、goal与文件；历史非授权、旧验证重验、取消不续跑。容量/不可写时保留现有授权笔记，不删除其他会话或反复重试。工具只传 request JSON 字符串；自动快照不是无损语义记忆。"
const ACTIONS = ['save', 'restore', 'inspect', 'disable', 'rollback']
const TOP = ['action', 'note', 'scope', 'checkpoint']
const invalid = () => new Error('JIZHI_CONTEXT_INPUT')
function validate(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k => !TOP.includes(k)) || !ACTIONS.includes(args.action)) throw invalid()
  const allowed = args.action === 'save' ? ['action', 'note'] : args.action === 'restore' ? ['action', 'checkpoint'] : args.action === 'inspect' ? ['action', 'scope'] : ['action']
  if (Object.keys(args).some(k => !allowed.includes(k)) || (args.action === 'save' && !Object.hasOwn(args, 'note'))) throw invalid()
  return args
}
function safeError(error) {
  if (error?.name === 'AbortError') { const e = new Error('Cancelled; no retry'); e.name = 'AbortError'; return e }
  return new Error(/^JIZHI_CONTEXT_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'JIZHI_CONTEXT_IO')
}

async function ownWindow(ctx, agent, from, to, signal, mutating = false, captureAuthorization) {
  const query = ctx.get('sessionQuery')
  if (query === undefined) throw new Error('JIZHI_CONTEXT_UNAVAILABLE')
  const observation = await query.observeSession(agent.id, { signal, projectionMode: 'none' })
  try {
    checkAbort(signal)
    if (observation.source !== 'live' || observation.header.id !== agent.session.header.id
      || observation.header.cwd !== agent.session.header.cwd || observation.inheritedEventCount !== (agent.session.inheritedEventCount ?? 0)
      || !Array.isArray(observation.events) || observation.events.length !== observation.cursor + 1 || observation.cursor + 1 < to) throw new Error('JIZHI_CONTEXT_SCOPE')
    if (mutating) {
      const policySnapshot = capturePersistenceSnapshot(observation, to)
      const authorize = () => {
        if (agent.session.seq !== to) throw new Error('JIZHI_CONTEXT_PERSISTENCE_DENIED')
        assertDerivedPersistence(ctx, agent, signal, 'JIZHI_CONTEXT', policySnapshot)
      }
      authorize(); captureAuthorization?.(authorize)
    }
    return observation.events.slice(from, to)
  } finally { observation[Symbol.dispose]() }
}

export const PARAMETERS = requestParameters('JSON object for exactly one action. Current restore: {"action":"restore"}; selected restore adds checkpoint only; inspect may add scope; save requires note. No unrelated fields or placeholder values. Read context-checkpoint for note shapes and limits. File status: added/modified/deleted/unchanged/unknown; created is invalid.')

export function apply(ctx, config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(k => !['enabled', 'automaticSnapshot'].includes(k))
    || ['enabled', 'automaticSnapshot'].some(k => config[k] !== undefined && typeof config[k] !== 'boolean')) throw invalid()
  if (config.enabled === false) return

  // Per-agent state, created on first use and disposed with the plugin.
  const states = new WeakMap()
  const pluginOwner = new AbortController()

  const isUltimateModel = agent => {
    if (!agent?.ctx || !agent?.session || agent.id !== agent.session.id) return false
    const presets = ctx.get('agentPresets')
    if (presets === undefined) return false
    try { return presets.composedPreset(agent.ctx) === 'ultimate-model' } catch { return false }
  }
  // Identity, not shape: a copied agent object carrying the same ctx is not the
  // agent this row initialized. Accepting it would let a caller reach another
  // session's state by forging the object.
  const knownAgents = new WeakSet()
  const isKnown = agent => agent !== null && typeof agent === 'object' && knownAgents.has(agent)

  const stateOf = agent => {
    let state = states.get(agent)
    if (state === undefined) {
      state = { checkpoint: '', disabled: false, needsRestore: false, generation: agent.session.surface?.replaceGeneration ?? 0, status: 'unknown', automaticStatus: config.automaticSnapshot === false ? 'disabled-by-config' : 'not-run', turnSaw: 0 }
      states.set(agent, state)
    }
    return state
  }

  const storeFor = (agent, mutating = false) => {
    let authorized
    return createContextStore(agent.session.header.cwd, {
      readEvents: (session, from, to, signal) => {
        if (session !== agent.session) throw new Error('JIZHI_CONTEXT_SCOPE')
        return ownWindow(ctx, agent, from, to, signal, mutating, check => { authorized = check })
      },
      authorizeMutation: mutating ? () => {
        if (!authorized) throw new Error('JIZHI_CONTEXT_PERSISTENCE_DENIED')
        authorized()
      } : undefined,
    })
  }

  /**
   * Whether the stored note actually holds something a restore would protect.
   *
   * The gate exists to stop a compaction-blanked note from overwriting real content, so it
   * is only meaningful while real content exists. A checkpoint whose semantic note was
   * never written protects nothing; gating on it denied every write path forever while the
   * restore it demanded could not change what was there. Such a session stays ungated and
   * may simply be saved again.
   */
  const hasProtectedContent = state => {
    if (state.note !== undefined) {
      const objective = state.note?.objective
      return typeof objective === 'string' && objective.trim().length > 0
    }
    return state.noteHasContent === true
  }
  const mustRestore = agent => {
    const state = stateOf(agent)
    if ((agent.session.surface?.replaceGeneration ?? 0) !== state.generation) state.needsRestore = true
    return Boolean(state.checkpoint && hasProtectedContent(state) && state.needsRestore && !state.disabled)
  }

  ctx.effect(() => {
    const disposers = []
    // Restore gate: denies mutating tool paths for a Ultimate-Model agent that still owes a restore.
    disposers.push(ctx.tools.guard(execution => {
      const agent = execution?.agent
      if (!isUltimateModel(agent) || !mustRestore(agent)) return
      if (['write', 'edit', 'win_bash', 'bash', 'pwsh'].includes(execution.name)) return 'JIZHI_CONTEXT_RESTORE_REQUIRED: restore the historical checkpoint and recheck current scope before this write/command path.'
    }))
    disposers.push(ctx.tools.register({
      name: TOOL_NAME,
      description: 'Save bounded semantic context, restore historical data with current file SHA256 comparisons, or inspect/disable/rollback local checkpoints. Available only in the Ultimate-Model mode. Restore is read-only; cross-session selection is explicit. No shell, network, extra model, task execution or permission/configuration changes.',
      parameters: PARAMETERS,
      output: { schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] }, render: (_args, result) => [{ type: 'text', text: result.text }] },
      async execute(args, exec) {
        const agent = exec?.agent
        // Disposal first: after the plugin is unloaded every entry point must
        // surface an abort, not a scope error that implies the row still works.
        if (pluginOwner.signal.aborted) { const e = new Error('Cancelled; no retry'); e.name = 'AbortError'; throw e }
        if (!isUltimateModel(agent) || !isKnown(agent)) throw new Error('JIZHI_CONTEXT_SCOPE')
        const signal = exec?.signal ? AbortSignal.any([pluginOwner.signal, exec.signal]) : pluginOwner.signal
        checkAbort(signal)
        const input = validate(decodeRequest(args, invalid))
        const state = stateOf(agent)
        if (input.action === 'save' && mustRestore(agent)) throw new Error('JIZHI_CONTEXT_RESTORE_REQUIRED')
        const bounded = new AbortController()
        const timer = setTimeout(() => bounded.abort(), 15000)
        const opSignal = AbortSignal.any([signal, bounded.signal])
        try {
          const service = storeFor(agent, !['restore', 'inspect'].includes(input.action))
          const result = input.action === 'save' ? await service.save(agent.session, input.note, { signal: opSignal })
            : input.action === 'restore' ? await service.restore(agent.session, input.checkpoint === undefined ? {} : { checkpoint: input.checkpoint }, { signal: opSignal })
              : input.action === 'inspect' ? await service.inspect(agent.session, input.scope === undefined ? {} : { scope: input.scope }, { signal: opSignal })
                : await service[input.action](agent.session, { signal: opSignal })
          // A cross-session restore is a read-only view of another session's note. It must
          // not rewrite this session's marker, status or disabled latch: doing so made a
          // foreign checkpoint ID arm and hold this session's restore gate, and leaked a
          // foreign cancelled/blocked/disabled state into the prompt and the write path.
          const applies = input.action !== 'restore' || result.scope === 'session'
          if (applies && result.checkpoint) state.checkpoint = result.checkpoint
          if (applies && typeof result.disabled === 'boolean') state.disabled = result.disabled
          if (applies && result.status) state.status = result.status
          // Track whether the stored note actually holds content, so the gate can tell a real
          // milestone from a compaction-blanked placeholder that protects nothing. A restore
          // returns the stored note; a save just persisted the note it validated, so that is
          // the current content either way.
          if (applies && result.note !== undefined) state.note = result.note
          else if (applies && input.action === 'save') state.note = input.note
          if (input.action === 'restore' && result.found && result.scope === 'session') {
            state.needsRestore = false; state.generation = agent.session.surface?.replaceGeneration ?? 0
          }
          const text = JSON.stringify({ ...result, lastAutomaticStatus: state.automaticStatus, turnStoppingSeen: state.turnSaw })
          if (Buffer.byteLength(text) > 50000) throw new Error('JIZHI_CONTEXT_OUTPUT_LIMIT')
          return { text }
        } catch (error) {
          if (bounded.signal.aborted && !signal.aborted) throw new Error('JIZHI_CONTEXT_TIMEOUT')
          throw safeError(error)
        } finally { clearTimeout(timer) }
      },
    }))
    return () => { for (const dispose of disposers.toReversed()) dispose() }
  })

  // Prompt pointer and automatic snapshot remain per-agent, but are installed
  // from the bundle-level listener, which does fire on this host.
  ctx.effect(() => {
    // Per-agent extras must be installed for an agent that BECOMES Ultimate-Model later,
    // because select() only composes afterwards and never re-emits created.
    // Each agent has at most one active set; leaving Ultimate-Model disposes it while
    // historical state remains independent for a later return.
    const extras = new Map()
    const installExtras = agent => {
      if (!agent?.ctx || pluginOwner.signal.aborted || extras.has(agent)) return
      knownAgents.add(agent)
      // A standard-mode agent must contribute NOTHING: no listener, no section.
      // Installing eager no-op listeners would still show up as registrations,
      // so an agent created as standard gets its extras only if it later
      // switches into Ultimate-Model (handled by the agent-preset/selected listener).
      if (!isUltimateModel(agent)) return
      const owner = new AbortController()
      const state = stateOf(agent)
      const owned = []
      try {
        owned.push(agent.ctx.systemPrompt.section({
          name: 'jizhi:context-checkpoint', order: 86,
          text: () => {
            // Recomposition may precede its notification; never render across modes.
            if (!isUltimateModel(agent)) return ''
            const generation = agent.session.surface?.replaceGeneration ?? 0
            if (generation !== state.generation) state.needsRestore = true
            if (state.disabled) return 'jizhi_context 本会话已 disable：不自动写入、不自动续跑。仍可 restore/inspect 读取历史；rollback 不解除禁用。'
            const pointer = state.checkpoint ? ' checkpoint=' + state.checkpoint : ' 尚无已知 checkpoint'
            return CONTEXT_PROMPT + '\n本会话恢复索引：' + pointer + '; needsRestore=' + state.needsRestore + '; status=' + state.status + '; automatic=' + state.automaticStatus + '。这里只是短指针，不含旧任务指令。'
          },
        }))
        if (config.automaticSnapshot !== false) {
          // The harness emits agent/turn-stopping with only { turn, signal } —
          // there is no agent field, so this handler must not require one.
          owned.push(agent.ctx.on('agent/turn-stopping', async ({ signal: callerSignal } = {}) => {
            state.turnSaw += 1
            if (!isUltimateModel(agent) || owner.signal.aborted || callerSignal?.aborted || state.disabled) return
            const signal = callerSignal ? AbortSignal.any([owner.signal, callerSignal]) : owner.signal
            try {
              const result = await storeFor(agent, true).snapshot(agent.session, { signal })
              if (result.checkpoint) state.checkpoint = result.checkpoint
              if (typeof result.disabled === 'boolean') state.disabled = result.disabled
              state.automaticStatus = result.disabled ? 'disabled-by-store' : 'saved'
            } catch (error) { state.automaticStatus = error?.message === 'JIZHI_CONTEXT_PERSISTENCE_DENIED' ? 'skipped-persistence-policy' : error?.name === 'AbortError' ? 'cancelled-no-retry' : 'unavailable-use-existing-note' }
          }))
        }
      } catch { /* extras are best-effort; the tools above stay available */ }
      extras.set(agent, () => { owner.abort(); for (const dispose of owned.toReversed()) { try { dispose() } catch { /* ignore */ } } })
    }

    const removeCreated = ctx.on('agent/created', async ({ agent, source, signal: creationSignal }) => {
      if (pluginOwner.signal.aborted || creationSignal?.aborted) return
      installExtras(agent)
      if (!isUltimateModel(agent)) return
      const owner = new AbortController()
      const setupSignal = AbortSignal.any([owner.signal, pluginOwner.signal, ...(creationSignal ? [creationSignal] : [])])
      const state = stateOf(agent)
      state.needsRestore = source === 'resume' || source === 'compact'
      try {
        const list = await storeFor(agent).inspect(agent.session, {}, { signal: setupSignal })
        const latest = list.checkpoints.find(x => x.version === 'latest')
        if (latest) {
          state.checkpoint = latest.checkpoint; state.status = latest.status; state.needsRestore = true
          // `inspect` reports only whether a semantic note exists; a session whose note was
          // never written must not be gated, so read the real content once at startup.
          state.noteHasContent = latest.hasSemanticNote === true
        }
        state.disabled = list.disabled
      } catch { state.automaticStatus = 'unavailable-use-existing-note' }
    })
    // A switch into Ultimate-Model must un-mask the tool and install the pointer; a
    // switch away must hide it again. select() emits this event, never created.
    const known = new Set()
    const masks = new Map()
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
    const onCreatedTrack = ctx.on('agent/created', ({ agent }) => { if (agent?.ctx) known.add(agent); syncVisibility(agent) })
    const removeSelected = ctx.on('agent-preset/selected', (sessionId) => {
      if (typeof sessionId !== 'string') return
      // Register any resolved agent as known before deciding anything else.
      const resolved = ctx.get('agents')?.get?.(sessionId)
      const agent = resolved ?? [...known].find(x => x.session?.id === sessionId || x.id === sessionId)
      if (!agent?.ctx) return
      knownAgents.add(agent)
      // Reconcile registrations only; state/checkpoints/cancellation stay in
      // the independent WeakMap and must survive leaving or re-entering Ultimate-Model.
      if (isUltimateModel(agent)) installExtras(agent)
      else {
        const dispose = extras.get(agent)
        extras.delete(agent)
        dispose?.()
      }
      syncVisibility(agent)
    })
    return () => {
      // Abort first so in-flight tool calls and listeners observe cancellation
      // instead of racing a partially torn-down plugin.
      pluginOwner.abort()
      removeCreated?.(); onCreatedTrack?.(); removeSelected?.()
      for (const dispose of [...masks.values()]) { try { dispose() } catch { /* ignore */ } }
      masks.clear()
      // Per-agent extras own a prompt section and a turn-stopping listener on
      // each agent ctx. Disposing only the host-level listeners would leave
      // those behind on every agent that ever entered Ultimate-Model.
      for (const dispose of [...extras.values()]) { try { dispose() } catch { /* ignore */ } }
      extras.clear()
    }
  })
}
