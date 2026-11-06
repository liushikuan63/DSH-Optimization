// A single required string survives providers that require every named field.
// Decoding never drops keys or substitutes defaults: the original action-specific
// validator and store remain responsible for rejecting unrelated/invalid input.
export function requestParameters(description) {
  return {
    type: 'object',
    properties: { request: { type: 'string', description: description + ' Maximum 32768 characters; runtime validation is mandatory.' } },
    required: ['request'],
    additionalProperties: false,
  }
}
export function decodeRequest(args, invalid) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || !Object.hasOwn(args, 'request')) return args
  if (Object.keys(args).length !== 1 || typeof args.request !== 'string' || args.request.length > 32768) throw invalid()
  try { return JSON.parse(args.request) } catch { throw invalid() }
}
