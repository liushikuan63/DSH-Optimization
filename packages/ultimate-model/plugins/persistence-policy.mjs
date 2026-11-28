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
  if (/(?:本次|此次|这次|本轮|全程|当前(?:任务|回合)?|本任务)[^。.!！?？；;\n]{0,18}(?:仅|只)(?:做|进行)?(?:回答(?:问题)?|说明|解释|审阅|审查|检查|阅读|分析)/i.test(text)
    || /\b(?:for[ \t]+)?this[ \t]+(?:round|turn|task)\b(?:[^.!?;\n]{0,24}[.!?;\n][ \t]*){0,2}[^.!?;\n]{0,24}\bonly\b[^.!?;\n]{0,16}\b(?:answer(?:ing)?|explain(?:ing)?|describe|discuss|review|audit|inspect)\b/i.test(text)
    || /\bonly\b[^.!?;\n]{0,16}\b(?:answer(?:ing)?|explain(?:ing)?|describe|discuss|review|audit|inspect)\b[\s\S]{0,80}?\b(?:for|during|in)\s+(?:this|the current)\s+(?:round|turn|task)\b/i.test(text)
    // Bare postposed scope belongs to a clause-initial command, not a historical mention.
    || /(?:^|[.!?;\n])[ \t]*(?:please[ \t]+)?only[ \t]+(?:answer(?:ing)?|explain(?:ing)?|describe|discuss|review|audit|inspect)\b[^.!?;\n]{0,48}\bthis[ \t]+(?:round|turn|task)\b(?=[ \t]*(?:[,;.!?\n]|$))/i.test(text)) return 'deny'
  // Explicit disk-write denials also cover derived observers. Match only a
  // narrow negative vocabulary; this gate never infers a grant from prose.
  if (/(?:不(?:要|得)?|禁止)(?:落盘|写盘|持久化)|\b(?:do not|don't)\s+(?:write|save)\s+to\s+disk\b/i.test(text)) return 'deny'
  // Remove only descriptive tokens in clause-initial explanations or complete property statements.
  // Scope qualifiers and other clauses stay intact; the original text still controls denials and grants.
  const descriptiveReadOnly = (phrase, boundary, offset, source) => {
    const before = source.slice(0, offset) + boundary
    if (/(?:仅|只(?!读)|全程|本次|此次|这次|本轮|\bthis[ \t]+(?:round|turn|task)\b)[^。.!！?？；;\n]*$/i.test(before)) return phrase
    return phrase.replace(/只读|\bread[-_ \t]*only\b/i, '')
  }
  const restrictionText = text
    .replace(/(^|[。.!！?？；;，,\n])[ \t]*(?:请?(?:解释|说明|介绍)[ \t]*|(?:please[ \t]+)?(?:describe|explain)[ \t]+(?:the[ \t]+)?)(?:只读|read[-_ \t]*only\b)[ \t]*(?:API\b|接口|字段|属性|interfaces?\b|fields?\b|propert(?:y|ies)\b)/gi, descriptiveReadOnly)
    .replace(/(^|[。.!！?？；;，,\n])[ \t]*(?:接口|字段|(?:the[ \t]+)?(?:API|interfaces?|fields?)\b)[ \t]*(?:(?:采用|具有)[ \t]*(?:只读[ \t]*属性|read[-_ \t]*only[ \t]+propert(?:y|ies)\b)|is[ \t]+read[-_ \t]*only\b|has[ \t]+read[-_ \t]*only[ \t]+propert(?:y|ies)\b)(?=[ \t]*(?:$|[。.!！?？；;，,\n]))/gi, descriptiveReadOnly)
  // Treat ordinary unqualified read-only wording as a restriction too; no doubled prefix is required.
  if (/(?:只读|\bread[-_\s]*only\b|不执行(?:任何)?(?:修改|操作|写入))/i.test(restrictionText)) return 'deny'
  const readOnlyScope = /(?:仅|只|全程|本次|此次|这次)[^。；;\n]{0,40}(?:只读|read[- ]only)|\bread[- ]only\s+(?:audit|review)\b/i
  const deny = /(?:不|禁止)[^。；;\n]{0,12}(?:创建|保存|更新|写入)[^。；;\n]{0,24}(?:派生存储|经验|检查点|台账)|禁止(?:持久化|写盘)|\bdo not (?:persist|save (?:memory|checkpoints?))\b/i
  if (readOnlyScope.test(restrictionText) || deny.test(text)) return 'deny'
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
