import { namespaceOf, partitionWireTools, resultIsError, TOOL_ACTIVATE_NAME } from './paging.mjs'

const reserved = new Set([TOOL_ACTIVATE_NAME, 'run_code'])
const methods = (object, ...keys) => keys.every(key => typeof object?.[key] === 'function')

export function selectPagingContract(tools, prompt) {
  if (typeof tools?.setExecutor === 'function' || typeof tools?.resolve === 'function') {
    if (methods(tools, 'setExecutor', 'resolve', 'definitions') && methods(prompt, 'variable')) return 'executor'
  } else if (methods(tools, 'presentAs') && (methods(tools, 'schemas') || methods(tools, 'sdkSchemas'))) {
    return 'legacy'
  }
  throw new Error('Ultimate Model: unsupported tool paging interface; choose another preset and check the Host compatibility report')
}

export function emptyPagingState() {
  return { active: [], step: null, catalog: null }
}

function argumentsOf(value) {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return undefined }
}

function refresh(active, call, { patterns, capacity }) {
  const activating = call.name === TOOL_ACTIVATE_NAME
  const namespace = activating ? argumentsOf(call.arguments)?.namespace : namespaceOf(call.name, patterns)
  if (typeof namespace !== 'string' || namespace === '' || (!activating && !active.includes(namespace))) return active
  return [...active.filter(entry => entry !== namespace), namespace].slice(-capacity)
}

// The Host owns history and replay. Keep only the current step's relevant tool
// calls, then publish its successful results in model order at step/end.
export function foldPagingEvent(state, event, options) {
  const data = event?.data
  if (event?.type === 'user/message') {
    const text = options.catalogText?.(data)
    return typeof text === 'string' ? { ...state, catalog: { seq: event.seq, text } } : state
  }
  if (event?.type === 'step/start') {
    return { ...state, step: { turn: data.turn, index: data.step, calls: [] } }
  }
  const step = state.step
  if (step === null) return state
  if (event?.type === 'turn/end' && data?.turn === step.turn) return { ...state, step: null }
  const nested = event?.type === 'tool/ptc-dispatch'
  if (!nested && (data?.turn !== step.turn || data?.step !== step.index)) return state
  if (event?.type === 'step/end') {
    let active = state.active
    for (const call of step.calls) {
      if (!call.success) continue
      active = refresh(active, call, options)
      for (const inner of call.nested) active = refresh(active, inner, options)
    }
    return { ...state, active, step: null }
  }
  let calls
  if (event?.type === 'tool/call') {
    const { callId: id, name } = data
    if (typeof id !== 'string' || typeof name !== 'string') return state
    if (name !== TOOL_ACTIVATE_NAME && name !== 'run_code' && namespaceOf(name, options.patterns) === undefined) return state
    calls = [...step.calls, { id, name, arguments: data.arguments ?? null, success: false, nested: [] }]
  } else if (event?.type === 'tool/result' || nested) {
    const id = nested ? data?.rootCallId : data.message?.source?.callId
    const index = step.calls.findIndex(call => call.id === id)
    if (index < 0) return state
    const call = step.calls[index]
    if (nested && (call.name !== 'run_code' || data.isError !== false || typeof data.name !== 'string'
      || (data.name !== TOOL_ACTIVATE_NAME && namespaceOf(data.name, options.patterns) === undefined))) return state
    const next = nested
      ? { ...call, nested: [...call.nested, { name: data.name, arguments: data.arguments ?? null }] }
      : { ...call, success: !resultIsError(data) }
    calls = step.calls.map((entry, position) => position === index ? next : entry)
  } else {
    return state
  }
  return { ...state, step: { ...step, calls } }
}

// A per-Agent executor owns presentation, not registration or dispatch. In
// particular, its filtered view never outlives or widens the Host's ToolSet.
export function createExecutorPage({ agent, delegate, patterns, onExecute }) {
  const pages = new WeakMap()
  let rendering
  const isResident = name => reserved.has(name) || namespaceOf(name, patterns) === undefined
  const allowed = (page, name, definition) => page ? page.allowed.get(name) === definition : isResident(name)
  const renderDefinitions = definitions => definitions.filter(definition => allowed(rendering, definition.name, definition))

  return {
    prepare(toolSet, active) {
      rendering = undefined
      if (typeof toolSet?.view !== 'function') return undefined
      let page = pages.get(toolSet)
      if (page === undefined) {
        const full = [...toolSet.view(agent).values()]
        const { resident, inactive } = partitionWireTools(full.filter(tool => !reserved.has(tool.name)), patterns, active)
        const names = new Set(resident.map(tool => tool.name))
        const visible = full.filter(tool => reserved.has(tool.name) || names.has(tool.name))
        page = { full, visible, inactive, active, allowed: new Map(visible.map(tool => [tool.name, tool])) }
        pages.set(toolSet, page)
      }
      return rendering = page
    },
    executor: {
      sections: delegate.sections?.map(section => {
        const text = section.text
        return typeof text === 'function' ? { ...section, text: definitions => text(renderDefinitions(definitions)) } : section
      }),
      describe(definitions) {
        return delegate.describe(renderDefinitions(definitions))
      },
      execute(input) {
        if (input.toolSet === undefined) return delegate.execute(input)
        const base = input.toolSet
        const page = input.agent === agent ? pages.get(base) : undefined
        const toolSet = {
          // The step, not this adapter, owns ToolSet disposal.
          dispose() {},
          view(scope) {
            return new Map([...base.view(scope)].filter(([name, definition]) => allowed(page, name, definition)))
          },
        }
        if (page !== undefined) onExecute?.(toolSet, page)
        return delegate.execute({ ...input, toolSet })
      },
    },
  }
}
