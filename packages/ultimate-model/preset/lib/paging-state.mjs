// Share metadata hidden by OUR paging mask, never an unrestricted global view.
// The durable event log still owns activation; this cache only answers which
// namespaces the exact scope may request after our own mask is lifted.
const surfaces = new WeakMap()

export function publishPagingSurface(owner, agent, schemas) {
  if (!owner.active || !agent?.ctx) return
  surfaces.set(agent, { owner, scope: agent.ctx, schemas: Object.freeze(schemas.filter(schema => typeof schema?.name === 'string').map(schema => Object.freeze({ name: schema.name }))) })
}
export function pagingSurface(agent) {
  const value = agent && surfaces.get(agent)
  return value?.owner.active && value.scope === agent.ctx ? value.schemas : undefined
}
export function clearPagingSurface(owner, agent) {
  if (agent && surfaces.get(agent)?.owner === owner) surfaces.delete(agent)
}
