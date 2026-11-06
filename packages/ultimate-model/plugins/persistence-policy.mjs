// Common narrowing gate for local derived persistence. This is not an authorization service.
// Host policy remains authoritative. Only own durable human messages can change a task restriction;
// model/tool/plugin messages, inherited records, quoted examples and request parameters cannot grant access.
const MODES = new Set(['read-only', 'workspace-write', 'danger-full-access'])
const MAX_SCAN_EVENTS = 5000
const MAX_MESSAGE_CHARS = 32768
function abort(signal) {
  if (signal?.aborted) { const error = new Error('Cancelled; no retry'); error.name = 'AbortError'; throw error }
}
function failure(prefix) { return new Error(prefix + '_PERSISTENCE_DENIED') }

export function taskPersistenceDirective(message) {
  if (message?.role !== 'user' || message?.source?.kind !== 'user' || !Array.isArray(message.content)) return null
  const raw = message.content.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n')
  if (raw.length > MAX_MESSAGE_CHARS) return 'deny'
  // Examples and harness reminders are data, not a new human task policy.
  const text = raw.replace(/```[\s\S]*?```/g, '').replace(/<([a-z][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/gi, '').split('\n').filter(line => !/^\s*>/.test(line)).join('\n').replace(/`[^`\n]*`/g, '').trim()
  if (!text) return null
  // Explicit disk-write denials also cover derived observers. Match only a
  // narrow negative vocabulary; this gate never infers a grant from prose.
  if (/(?:不(?:要|得)?|禁止)(?:落盘|写盘|持久化)|\b(?:do not|don't)\s+(?:write|save)\s+to\s+disk\b/i.test(text)) return 'deny'
  // Treat ordinary unqualified read-only wording as a restriction too; no doubled prefix is required.
  if (/(?:只读|\bread[-_\s]*only\b|不执行(?:任何)?(?:修改|操作|写入))/i.test(text)) return 'deny'
  const deny = /(?:仅|只|全程|本次|此次|这次)[^。；;\n]{0,40}(?:只读|read[- ]only)|(?:不|禁止)[^。；;\n]{0,12}(?:创建|保存|更新|写入)[^。；;\n]{0,24}(?:派生存储|经验|检查点|台账)|禁止(?:持久化|写盘)|\b(?:read[- ]only\s+(?:audit|review)|do not (?:persist|save (?:memory|checkpoints?)))\b/i
  if (deny.test(text)) return 'deny'
  // Negation, a proposal or a conditional sentence can never release an existing restriction.
  if (/(?:不允许|不同意|未授权|不授权|禁止|不要|不得)[^。；;\n]{0,24}(?:持久化|保存|写入|修改|实施|实现|修复)|(?:只|仅)(?:讨论|提出建议|出方案)|\b(?:do not|not allowed|do not consent|don't)\b/i.test(text)) return 'deny'
  // Only a small, whole-message command vocabulary can clear this extra restriction.
  // This is deliberately NOT an open-ended natural-language authorization classifier.
  // Anything uncertain preserves the prior restriction; host policy still applies afterwards.
  const command = text.replace(/[。.!！]+$/, '').trim().toLowerCase()
  const explicitCommands = new Set(['按顺序修复', '开始修复', '继续修复', '请开始修复', '请实施修复', '允许持久化', '允许保存本任务状态', '允许保存经验和检查点', 'please implement', 'please fix', 'proceed with implementation', 'proceed with repairs', 'allow persistence', 'allow saving'])
  return explicitCommands.has(command) ? 'inherit' : null
}

// Reuse the producer's already-open read-only evidence lease. No second query or IO is started here.
export function assertDerivedPersistence(ctx, agent, signal, prefix, observation) {
  abort(signal)
  if (!['JIZHI_CONTEXT', 'JIZHI_EXPERIENCE', 'LOCAL_MEMORY'].includes(prefix) || !agent?.session || agent.id !== agent.session.id) throw failure('JIZHI_CONTEXT')
  try {
    const policy = ctx.get('sandboxPolicy')?.resolve({ session: agent.session })
    if (!policy || !MODES.has(policy.mode) || policy.mode === 'read-only') throw failure(prefix)
    const session = agent.session, end = session.seq
    if (observation?.source !== 'live' || observation.header?.id !== session.header.id || observation.header?.cwd !== session.header.cwd
      || observation.inheritedEventCount !== (session.inheritedEventCount ?? 0) || !Array.isArray(observation.events)
      || observation.events.length !== observation.cursor + 1 || observation.cursor + 1 < end) throw failure(prefix)
    const begin = Math.max(0, end - MAX_SCAN_EVENTS)
    for (let i = end - 1; i >= begin; i--) {
      const event = observation.events[i]
      if (event?.type !== 'user/message' || event.seq !== i || !session.isOwnSeq(i)) continue
      const directive = taskPersistenceDirective(event.data)
      if (directive === 'deny') throw failure(prefix)
      if (directive === 'inherit') return
    }
    // A truncated task-policy history is not proof that an earlier deny ceased to apply.
    if (begin > 0) throw failure(prefix)
    // Delegation does not itself grant private memory writes. A child without its own
    // explicit human directive skips derived persistence, not its authorized primary work.
    if (session.header.origin === 'subagent') throw failure(prefix)
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw failure(prefix)
  }
  abort(signal)
}

// Preserve only policy-relevant immutable data, not a disposed observation object or tool payloads.
export function capturePersistenceSnapshot(observation, end) {
  if (!Number.isSafeInteger(end) || end < 0 || !Array.isArray(observation?.events) || observation.events.length < end) throw new Error('JIZHI_CONTEXT_SCOPE')
  const events = new Array(end)
  for (let i = Math.max(0, end - MAX_SCAN_EVENTS); i < end; i++) {
    const event = observation.events[i]
    if (event?.type === 'user/message') {
      const content = Array.isArray(event.data?.content) ? event.data.content.filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => Object.freeze({ type: 'text', text: b.text })) : []
      const data = Object.freeze({ role: event.data?.role, source: Object.freeze({ kind: event.data?.source?.kind }), content: Object.freeze(content) })
      events[i] = Object.freeze({ type: event.type, seq: event.seq, data })
    } else events[i] = Object.freeze({ type: event?.type, seq: event?.seq })
  }
  return Object.freeze({ source: observation.source, header: Object.freeze({ id: observation.header?.id, cwd: observation.header?.cwd }), inheritedEventCount: observation.inheritedEventCount, events: Object.freeze(events), cursor: end - 1 })
}
