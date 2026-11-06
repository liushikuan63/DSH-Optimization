import { fileURLToPath } from 'node:url'
import { search } from './scripts/skill-load.mjs'
import { resolveOfficialResults } from './scripts/official-skills.mjs'
const bundleRoot = fileURLToPath(new URL('.', import.meta.url))
export const inject = ['tools']
export function apply(ctx) {
  ctx.effect(() => ctx.tools.register({
    name: 'jizhi_skill_search',
    description: 'Search this mode’s on-demand skill metadata. Returns actual SKILL.md paths; matching Cordis library routes locate the official source through Host Inspect. Read a result before following it. Bodies, references and templates are not preloaded; this is not the host’s full catalog.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Nonempty domain, action, error or skill-name keywords.' } }, required: ['query'], additionalProperties: false },
    output: { schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }, render: (_args, value) => [{ type: 'text', text: value.text }] },
    isConcurrencySafe: () => true,
    async execute({ query }, execution) {
      const results = await resolveOfficialResults(search(query, { bundleRoot }), ctx, execution)
      return { text: results.length ? results.map(({ e }) => `${e.name} [${e.tier}] source=${e.source}\n${e.path}\n${e.description}${e.routePath ? '\nThin route: ' + e.routePath : ''}${e.resolution ? '\nResolution: ' + e.resolution : ''}${e.conflicts ? '\nCONFLICT: ' + e.conflicts.map(c => c.path).join('; ') : ''}`).join('\n\n') + '\n\nMetadata only. Read the matching SKILL.md, then only its relevant references/templates. Results are not loaded instructions.' : 'NO_MATCH: no matching skill in this bundle; this does not mean the host has no suitable skill.' }
    },
  }))
}
