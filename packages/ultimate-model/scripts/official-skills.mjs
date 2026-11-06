import fs from 'node:fs'
import path from 'node:path'
export const OFFICIAL_PACKAGE = '@deepseek-ai/dsh-agent-preset'
export const OFFICIAL_SKILLS = Object.freeze([
  'agent-experience', 'cordis-plugin-development',
  'editing-cordis-compositions', 'cordis-composition-reference',
])
export function officialSkillPath(packageDir, name) {
  if (!OFFICIAL_SKILLS.includes(name) || typeof packageDir !== 'string' || !path.isAbsolute(packageDir)) throw new Error('JIZHI_OFFICIAL_SOURCE_INVALID')
  const root = fs.realpathSync(packageDir)
  const file = fs.realpathSync(path.join(root, 'skills', name, 'SKILL.md'))
  const relative = path.relative(root, file)
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(file).isFile()) throw new Error('JIZHI_OFFICIAL_SOURCE_OUTSIDE_PACKAGE')
  return file.split(path.sep).join('/')
}
// Only a matching low-frequency route queries the Host's existing read-only registry.
// No Host provider registration, guessed install paths, body reads or prompt sections.
export async function resolveOfficialResults(results, ctx, execution = {}) {
  if (!results.some(({ e }) => e.source === 'bundle.library' && OFFICIAL_SKILLS.includes(e.name))) return results
  const signal = execution.signal ?? new AbortController().signal
  signal.throwIfAborted()
  const inspect = ctx.get?.('cordisInspect')
  const provider = inspect?.list().find(p => p.platform === 'host' && p.id === 'Config')
  const method = provider?.methods.find(m => m.name === 'listConfigs')
  if (!method || !execution.agent) return results.map(item => OFFICIAL_SKILLS.includes(item.e.name) ? { ...item, e: { ...item.e, resolution: 'unresolved; read the thin route, then use the available Host Inspect source' } } : item)
  let packageDir, offset = 0
  for (let page = 0; page < 8 && packageDir === undefined; page++) {
    const directory = await inspect.query(provider.platform, provider.id, method.name, { name: OFFICIAL_PACKAGE, offset, limit: 100 }, execution.agent, signal)
    if (!Array.isArray(directory.entries)) throw new Error('JIZHI_OFFICIAL_DIRECTORY_INVALID')
    for (const entry of directory.entries) {
      if (entry.name !== OFFICIAL_PACKAGE || entry.status === 'inactive') continue
      const detail = await inspect.query(provider.platform, provider.id, method.name, { entry: entry.id }, execution.agent, signal)
      if (typeof detail.packageDir === 'string') { packageDir = detail.packageDir; break }
    }
    if (directory.nextOffset === null) break
    if (!Number.isSafeInteger(directory.nextOffset) || directory.nextOffset <= offset) throw new Error('JIZHI_OFFICIAL_DIRECTORY_INVALID')
    offset = directory.nextOffset
  }
  if (packageDir === undefined) throw new Error('JIZHI_OFFICIAL_PACKAGE_UNRESOLVED: Host Config did not resolve the official capability source')
  return results.map(item => item.e.source === 'bundle.library' && OFFICIAL_SKILLS.includes(item.e.name)
    ? { ...item, e: { ...item.e, routePath: item.e.path, path: officialSkillPath(packageDir, item.e.name), source: 'host.official', resolution: 'Host Inspect packageDir; body not read' } }
    : item)
}
