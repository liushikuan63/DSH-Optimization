import { hostModules } from './host-modules.mjs'
import { selectPagingContract } from './executor-paging.mjs'

export const name = 'ultimate-model-list-agents-compat'
export const inject = ['tools', 'systemPrompt']

export async function apply(ctx) {
  // Newer Hosts include list_agents in the complete subagent-control plugin
  // above this row. Older Hosts need their separate official registration.
  if (selectPagingContract(ctx.tools, ctx.systemPrompt) !== 'legacy') return
  const legacy = await hostModules(ctx).import('@deepseek-ai/dsh-tool-subagent-control/list-agents')
  await ctx.plugin({ name: legacy.name, inject: legacy.inject, apply: legacy.apply })
}
