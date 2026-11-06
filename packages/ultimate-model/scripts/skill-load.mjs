// 实时、只读检索技能；绝不读取旧 index 或自动 build。
// node skill-load.mjs [--home <dir>] [--agents-home <.agents-dir>]
//   [--project | --project-root <dir>] [--bundle-root <dir>] "<关键词…>"
// 退出码：0=命中，3=当前扫描范围无命中，2=输入/元数据/IO 失败。
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collect, parseCli } from './build-skills-index.mjs'

export function search(query, options = {}) {
  if (typeof query !== 'string' || !query.trim()) throw new Error('用法: node skill-load.mjs [选项] "<关键词…>"')
  const full = query.trim().toLowerCase()
  const tokens = full.split(/[\s,，、/|]+/).filter(Boolean)
  if (!tokens.length) throw new Error('关键词不能仅由分隔符组成')
  // Validate every discovered skill before returning even the first matching one.
  return collect(options).map((e) => {
    const n = e.name.toLowerCase()
    const d = e.description.toLowerCase()
    let s = 0
    if (n === full) s += 20
    if (n.includes(full.replace(/\s+/g, '-'))) s += 6
    if (d.includes(full)) s += 5
    for (const token of tokens) {
      if (n.includes(token)) s += 4
      if (d.includes(token)) s += 1
    }
    return { e, s }
  }).filter((item) => item.s > 0).sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name) || a.e.path.localeCompare(b.e.path)).slice(0, 6)
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isMain) {
  try {
    const { options, terms } = parseCli(process.argv.slice(2), { query: true })
    const scored = search(terms.join(' '), options)
    if (!scored.length) {
      if (!options.quiet) {
        console.log('NO_MATCH')
        console.log('当前扫描文件系统根未命中；可换同义词或显式补充根，不代表宿主全量 catalog 无此技能。')
      }
      process.exitCode = 3
    } else {
      if (!options.quiet) {
        const reported = new Set()
        scored.forEach(({ e, s }, i) => {
          console.log(`${i + 1}. ${e.name}   [${e.tier}] source=${e.source} score=${s}`)
          console.log(`   ${e.path}`)
          console.log(`   ${e.description.slice(0, 110)}`)
          if (e.conflicts && !reported.has(e.name)) {
            reported.add(e.name)
            console.log(`   CONFLICT ${e.name}: ${e.conflicts.map((c) => `${c.source} [${c.tier}] ${c.path}`).join(' ; ')}`)
          }
        })
        console.log('\n下一步：read 命中的 SKILL.md；未读之前不要声称已加载。扫描结果不等于当前会话装载目录。')
      }
      process.exitCode = 0
    }
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    process.exitCode = 2
  }
}
