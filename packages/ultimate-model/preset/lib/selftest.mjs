// 分页命名空间纯函数自测：退出码 0 = 全过；1 = 至少一条断言失败。
// 这是本地补丁（扁平工具族按前缀归组）的可失败判据，selfcheck 会调用。
import { namespaceOf, partitionWireTools, validatePagedToolPatterns } from './paging.mjs'

const patterns = validatePagedToolPatterns('selftest', [
  'cua_driver_*',
  'mcp__playwright__*',
  'task_board_*',
  'agent_teams_*',
  'team_task_*',
  'browser_*',
])
const cases = [
  ['mcp__playwright__browser_click', 'mcp__playwright'],
  ['cua_driver_native__click', 'native'],
  ['task_board_list', 'task_board'],
  ['agent_teams_create', 'agent_teams'],
  ['team_task_create', 'team_task'],
  ['browser_click', 'browser'],
  ['mcp__memory__search_nodes', undefined],
]
let bad = 0
for (const [name, expected] of cases) {
  const got = namespaceOf(name, patterns)
  if (got !== expected) {
    console.log(`FAIL ${name}: expected ${expected}, got ${got}`)
    bad++
  }
}
const tools = [
  { name: 'read' },
  { name: 'mcp__playwright__browser_click' },
  { name: 'task_board_list' },
  { name: 'browser_click' },
  { name: 'cua_driver_native__click' },
  { name: 'mcp__memory__search_nodes' },
]
const part = partitionWireTools(tools, patterns, new Set())
const resident = part.resident.map((t) => t.name)
const inactive = [...part.inactive.keys()]
if (resident.join(',') !== 'read,mcp__memory__search_nodes') {
  console.log('FAIL resident: ' + resident.join(',')); bad++
}
if (inactive.join(',') !== 'browser,mcp__playwright,native,task_board') {
  console.log('FAIL inactive: ' + inactive.join(',')); bad++
}
console.log(bad === 0 ? 'OK: paging selftest passed' : `FAIL: ${bad} case(s)`)
process.exit(bad === 0 ? 0 : 1)
