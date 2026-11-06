// 原生守卫（Cordis 插件）：把 hooks/pre-tool-guard.ps1 的硬拦判据改写成 JS。
//
// 为什么需要它（2026-09-20 实测，详见 ~/.dsh/scripts/hooks-bridge-defect-report.md）：
//   @deepseek-ai/dsh-hooks-claude-code 在 Windows + pwsh 下**每个钩子都超时**
//   （真实会话日志里 6/6 条 hook/result 都是 exitCode=1 + durationMs≈30000），
//   且桥把超时映射为 decision:pass —— 于是安全红线**静默 fail-open**。
//   根因是调用形态与 PowerShell 不兼容：不关子进程 stdin 时 pwsh 自身挂住；
//   关闭 stdin 时载荷被 pwsh 当作源码解析（ParserError）。脚本侧无法修复。
//   本插件走 tools.guard 单调拒绝机制，在进程内直接看**已解析好的参数**，不经 pwsh。
//
// 与 PowerShell 版的判据逐条对齐，并保持一致的行为：
//   * 原生判定异常拒绝本次调用，不让失效守卫变成许可；旧 PowerShell 仅作历史回归。
//   * 只拦后果严重且误报率低的项，不做"劝"（PreToolUse 语义只能拦）。
//   * 2026-10-01 增第五类：电脑操作不得抢占前台或搬动真实鼠标指针（见下方 ⑤ 段）。
//   * 2026-10-13 增第六/七/八类（DSH ↔ Qoder 5.4.2 对齐，批 3）：按匹配做的风险操作
//     必须先只读预览、shell 不得直调 Win32/SendInput 绕开 CUA 驱动、一次吃掉一大块
//     上下文的整读/整读式命令（来源与判据见下方 ⑥⑦⑧ 段）。
//
// 拦截与加载都写 ~/.dsh/logs/hook-guards-native.log：插件 JS 改动不热加载，
// 「loaded:」行是重启后确认本守卫（含 CUA 护栏）确实在新代码上跑的唯一凭据。

import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { destructiveSqlRisk } from './sql-risk.mjs'
import { createForegroundAuthorizer } from './foreground-policy.mjs'

const foregroundAuthorizer = createForegroundAuthorizer({
  policyPath: join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'hooks', 'cua-foreground-grants.json'),
  onGrant: grant => log('allow-foreground grant=' + grant.id + ' tool=' + grant.action + ' pid=' + grant.pid + ' window=' + grant.windowId + ' use=' + grant.use),
})

const CREDENTIAL_WRITE = /(\.credentials\.ya?ml$|(^|[\\/])\.env(\.|$)|(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)$|\.(pem|pfx|p12|jks|keystore)$|(^|[\\/])secrets?[\\/]|CREDENTIALS)/i
const CREDENTIAL_READ = /(\.credentials\.ya?ml$|(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)$|\.(pfx|p12|jks|keystore)$|(^|[\\/])mcp-router\.json$)/i

// Recognize explicit commands and literal shell-wrapper payloads only. This is
// not a full shell interpreter: variable-built commands, arbitrary scripts and
// language-level filesystem APIs remain outside this lexical preflight.
function shellCommandInvocations(command, shell, depth = 0) {
  if (depth > 4) return []
  const segments = []; let words = [], word = '', quote = '', quoted = false, invoked = false
  const pushWord = () => { if (word || quoted) words.push({ value: word, quoted }); word = ''; quoted = false }
  const pushSegment = () => { pushWord(); if (words.length) segments.push({ words, invoked }); words = []; invoked = false }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === quote) {
        if (quote === "'" && command[i + 1] === "'") { word += c; i++; continue }
        quote = ''; continue
      }
      if (quote === '"' && c === '\\' && ['"', '\\'].includes(command[i + 1])) { word += command[++i]; continue }
      word += c; continue
    }
    if (c === '"' || c === "'") { quote = c; quoted = true; continue }
    if (c === '#' && !word) { while (i < command.length && command[i] !== '\n') i++; pushSegment(); continue }
    if (';|&\n'.includes(c)) { pushSegment(); if (c === '&') invoked = true; continue }
    if (/\s/.test(c)) { pushWord(); continue }
    word += c
  }
  pushSegment()
  const result = []
  for (const segment of segments) {
    const tokens = [...segment.words]
    while (tokens[0] && /^[A-Za-z_][\w]*=/.test(tokens[0].value)) tokens.shift()
    if (!tokens.length || (shell === 'pwsh' && tokens[0].quoted && !segment.invoked)) continue
    const values = tokens.map(t => t.value)
    const program = values[0].replaceAll('\\', '/').split('/').at(-1).replace(/\.exe$/i, '').toLowerCase()
    if (['echo', 'printf', 'write-output', 'write-host'].includes(program)) continue
    if (['bash', 'sh', 'zsh', 'pwsh', 'powershell', 'cmd'].includes(program)) {
      const at = values.findIndex((value, index) => index > 0 && ['-c', '-lc', '-command', '/c'].includes(value.toLowerCase()))
      if (at > 0 && values[at + 1]) {
        result.push(...shellCommandInvocations(values.slice(at + 1).join(' '), ['pwsh', 'powershell'].includes(program) ? 'pwsh' : program, depth + 1))
        continue
      }
    }
    result.push({ program, args: values.slice(1), shell, text: values.join(' ') })
  }
  return result
}

export function recursiveDeleteRisk(toolName, command) {
  for (const call of shellCommandInvocations(command, toolName)) {
    const args = call.args.slice(0, call.args.indexOf('--') < 0 ? undefined : call.args.indexOf('--'))
    const psRemove = call.program === 'remove-item' || (call.shell === 'pwsh' && ['ri', 'rm', 'del', 'erase', 'rd', 'rmdir'].includes(call.program))
    if (psRemove && args.some(arg => /^-(?:r|rec|recurse)(?::(?!\$false$).*)?$/i.test(arg))) return 'PowerShell recursive removal'
    if (call.program === 'rm' && args.some(arg => arg === '--recursive' || /^-[A-Za-z]*[rR][A-Za-z]*$/.test(arg))) return 'recursive rm'
    if (['rd', 'rmdir', 'del', 'erase'].includes(call.program) && args.some(arg => /^\/s$/i.test(arg))) return 'recursive command removal'
  }
  return null
}

// ── ⑥ 按匹配做的风险操作：先只读预览命中范围（2026-10-13）──────────────────
// 来源：~/.dsh/_ref-qoder542/.../scripts/risky-match-guard.js 的 checkBash()（判据行 :36-37、:41、:45）
// 与 checkSql() 的 alwaysTrue 判据（:58）。
// 判据刻意"宁窄勿宽"（上游注释里的实测教训：真机上拦下过自己的一条 `rm -f *.tar.gz`，
// 说明判据偏宽 ⇒ 于是 ① 收窄成"**递归**删除 + 通配"两个条件同时成立才拦）。
// ④ 只补"WHERE 恒真"，且要求命令里确有 DELETE/UPDATE —— 上游 checkSql 对 SELECT 也拦，
// 但只读语句没有后果；不要求 SQL 上下文则 `grep "where true"` 这种文本会被误拦。
const RISKY_PREVIEW =
  '先只读预览命中范围：列出会被影响的清单（`ls` / `pgrep -af` / `SELECT`），核对数量与边界——' +
  '再带一条**负对照**（本该不被命中的样例确实不在清单里），确认无误后才执行。'

const RISKY_MATCH = [
  {
    re: /\brm\b[^|;&]*\s-[a-zA-Z]*[rR][a-zA-Z]*\b[^|;&]*[*?]/,
    why: '递归 `rm -r/-rf` 带通配，匹配范围可能远超预期',
    fix: '先 `ls <通配>` 看清单 → 再把命令换成显式路径列表（或先 mkdir 出待删目录再按目录删）',
  },
  {
    re: /\bfind\b[^|;&]*(?:-delete|-exec\s+rm\b)/,
    why: '`find … -delete` / `-exec rm` 按匹配删，删前连命中清单都没看',
    fix: '先跑**不带** `-delete` 的同一条 find 看命中数与样例，再把结果落成显式清单执行',
  },
  {
    re: /\b(pkill|killall)\b|\btaskkill\b[^|;&]*\/IM\b/i,
    why: '按模式 / 镜像名杀进程，模式一宽会连正常服务一起杀',
    fix: '先 `pgrep -af <模式>`（或 `tasklist | findstr`）看命中 PID 与命令行，再按**精确 PID** 逐个 kill；涉及共享服务先给用户确认',
  },
  {
    re: /\b(DELETE|UPDATE)\b[\s\S]*\bWHERE\b\s*\(?\s*(?:1\s*=\s*1|TRUE)\b/i,
    why: 'WHERE 恒真，等价于没有 WHERE',
    fix: '先把同条件的 `SELECT count(*)` / `SELECT *` 跑一遍核对影响面（含"应不在范围内"的负例），再带**明确的 WHERE 或主键列表**执行',
  },
]

// ── ⑦ shell 直调 Win32 输入原语（2026-10-13 加；2026-10-21 拆分三类）────────
// 来源：.../scripts/cua-cursor-guard.js:153 的 GUI_BYPASS。
// 2026-10-21 修正：原判据把「键盘注入」与「搬指针 / 抢前台」混成一类硬拦，
// 而技能 windows-desktop-keyboard-automation / windows-ui-forensics-powershell
// 教的正是 SendInput / keybd_event —— 技能自设"不受 §一·再 约束"的豁免，机制不认，
// 于是那类合法任务被 deny 到底、怎么换手段都做不完（技能还声明 CUA 到不了那些场景，
// deny 文案却建议"改走 CUA 驱动"，两头堵死）。
// 当前后台规则：Shell 不直调指针、前台或前台键盘注入；改走精确目标的后台工具。
// 环境变量不是本轮真人授权，旧豁免不再放宽此规则。
// 只对 shell 类工具的 command 判定：这些名字出现在别处（例如写进源码文件的内容）不构成绕道。
const SHELL_TOOLS = new Set(['pwsh', 'bash', 'win_bash'])

const GUI_POINTER = /SetCursorPos|mouse_event|nircmd\s+(sendmouse|clickkey|smash)|pyautogui/i
const GUI_FOREGROUND = /SetForegroundWindow|AttachThreadInput/i

/**
 * 前台键盘注入同样不能通过 Shell 绕过后台约束；后台键盘能力走精确目标工具。
 */
export const GUI_KEYBOARD = /SendInput|keybd_event/i

// ── ⑧ 大输出守卫（2026-10-13）────────────────────────────────────────────
// 来源：.../scripts/huge-output-guard.js（阈值 :33-34，read 判据 :102-114，shell 判据 :119-172）。
// 上游实测依据（不是推测）：单条 >20KB 的返回共 81 条 / 3 MB，最大的几条正是 Read 整读大文件；
// 大会话随后 9 次被传输层按 60s 掐断（Model stream timed out / The model service rejected this request），
// 用户看到的"任务老中断"就是它。
const HOG_READ_BYTES = 40 * 1024
const HOG_READ_LINES = 600

// 限流标志：出现任何一个就不拦。**判据是命令文本**，一眼可判、不依赖输出内容。
// `|` 与重定向放在里面是上游原文的行为，也是本守卫自己推荐的改法（`… > /tmp/x.log; tail -30 /tmp/x.log`）——
// 少了它们，推荐改法本身会被拦下。
const HOG_LIMITERS = [
  /\|/,
  />\s*\S/,
  /\b(head|tail)\b/i,
  /--oneline|--stat|--name-only|--porcelain|--quiet|--short|--numstat|--max-depth/i,
  /Select-Object\s+[^\n|;&]*-First/i,
  /-TotalCount\b/i,
  /-(Tail|Head)\b/,
  /\bwc\b/,
  /\bgrep\b[^\n|;&]*\s-[A-Za-z]*[lcm]/i,
  /-m\s*\d+/,
  // find 的过滤标志。上游 hint 自己写的是"不加 -name 过滤就是整棵目录树"，
  // 而它的正则只有 `\bfind\b` ⇒ `find . -name '*.log'` 这种**已被过滤**的常规写法也会被拦。
  // 判据按 hint 的语义落地（带过滤的放行），不要让"推荐写法"本身变成噪声。
  /(?:^|\s)-(name|iname|maxdepth|mindepth|type|path)\b/,
]

const HOG_VERBOSE = [
  { re: /^\s*(cat|type|more|less)\s+\S/i, hint: '`cat`/`type`/`more` 整读一个文件 ≈ 一次上下文炸弹' },
  { re: /\bGet-Content\b/i, hint: '`Get-Content` 不带 -TotalCount 会整读' },
  { re: /\bgit\s+(log|diff|show|blame)\b/i, hint: '`git log/diff/show` 不加限流就是全史 / 全 diff' },
  { re: /\b(grep|rg)\b/i, hint: '`grep` 不加 -l/-c/-m 或管道就是把所有命中铺开' },
  { re: /\bfind\b/i, hint: '`find` 不加 -max-depth / 过滤就是整棵目录树' },
]

const HOG_FIX =
  '改法：`<命令> > <日志文件> 2>&1; tail -30 <日志文件>`（或 `| head -50`、`| grep -c 关键词`、`-TotalCount`）。'

/**
 * Split a command into shell segments.
 *
 * Splitting on the separators (not on whitespace) is what keeps quoted text
 * such as `git commit -m "fix; then drop"` from leaking into another segment's
 * verdict.
 */
function segmentsOf(cmd) {
  return cmd.split(/[;&|]/).map((segment) => segment.trim()).filter(Boolean)
}

/** Flags and operands of one `git <subcommand>` occurrence, or an empty list. */
function argsAfter(cmd, subcommand) {
  for (const segment of segmentsOf(cmd)) {
    const tokens = segment.split(/\s+/)
    const at = tokens.findIndex((token, index) => token === 'git' && tokens[index + 1] === subcommand)
    if (at >= 0) return tokens.slice(at + 2)
  }
  return []
}

/**
 * Whether these git operands sweep every tracked path.
 *
 * `-a`, `--all`, and bundled short forms like `-am` all stage or commit
 * everything that changed, which is exactly what the rules forbid. A regex
 * over the raw command misses `-am`: after matching `-a`, `\b` fails because
 * `m` is still a word character. Git lets short flags bundle, so the short
 * option has to be inspected as a set.
 */
function sweepsEverything(operands) {
  for (const operand of operands) {
    if (operand === '--all' || operand.startsWith('--all=')) return true
    if (operand === '.') return true
    if (/^--[A-Za-z]/.test(operand)) continue // some other long option
    if (/^-[A-Za-z][A-Za-z0-9]*$/.test(operand) && operand.slice(1).toLowerCase().includes('a')) return true
  }
  return false
}

// ── 电脑操作（Cua Driver）前台护栏（2026-10-01）────────────────────────────
// 现象：用户体感「CUA 抢占鼠标」，实测是**真实指针被搬到点击位置**。
// 根因在 Cua Driver 的投递路径，共三条（SDK reference「Typed desktop methods」）：
//   ① delivery_mode=foreground 走 SendInput(MOUSEEVENTF_ABSOLUTE)，真实指针被搬过去；
//   ② desktop target 的语义就是「screen 坐标 + foreground delivery」，同上；
//   ③ bring_to_front 直接 SetForegroundWindow。
// window scope + background 实测不碰前台：WinEvent 监听器
// (~/.dsh/scripts/cua-foreground-watch.ps1) 在一次 background click 前后没有记录到
// 任何 FOREGROUND 事件，驱动自己也回报 "(background, no foreground swap)"。
// 所以拦的是上面三条，不是「CUA 这个能力」本身。

const CUA_PREFIX = 'cua_driver_native__'

/** 只有这些动作会投递输入或搬指针；只读类（截图 / 列表 / zoom）不在内。 */
const CUA_INPUT_ACTIONS = new Set([
  'click', 'double_click', 'right_click', 'drag',
  'scroll', 'press_key', 'hotkey', 'type_text',
  'move_cursor',
])

const CUA_GUARD_HINT =
  '先用精确 window 目标和 background。后台失败本身不是授权；仅真人明确授权后，' +
  '由固定配置绑定真实会话、cwd、Host、driver session、窗口、动作、有效期和次数。' +
  '没有有效许可时拒绝前台；不得用环境变量、工具自填 approved 或 Shell 绕过。'

/** 当前后台规则不接受环境变量作为放宽授权。 */
export function cuaGuardEnabled() { return true }

/**
 * 这条 CUA 调用是否会触碰真实指针或前台窗口。
 * 返回 { action, why }，安全则返回 null。导出便于单测。
 */
export function cuaForegroundRisk(toolName, args) {
  if (typeof toolName !== 'string' || !toolName.startsWith(CUA_PREFIX)) return null
  const action = toolName.slice(CUA_PREFIX.length)
  if (action === 'bring_to_front') {
    return { action, why: '它会用 SetForegroundWindow 把目标窗口抢到前台' }
  }
  if (!CUA_INPUT_ACTIONS.has(action)) return null
  const a = args && typeof args === 'object' ? args : {}
  if (a.scope === 'desktop' || a.target?.kind === 'desktop') {
    return { action, why: 'desktop 目标的语义是「屏幕绝对坐标 + 强制前台投递」，会搬动真实指针并切走当前前台窗口' }
  }
  if (a.delivery_mode === 'foreground' || a.deliveryMode === 'foreground') {
    return { action, why: 'delivery_mode=foreground 可能切换前台；是否移动指针取决于具体动作' }
  }
  return null
}

/** ⑥ 命中一条"按匹配做的风险操作"就返回该条判据，否则 null。导出便于单测。 */
export function riskyMatchRisk(cmd, options = {}) {
  for (const rule of RISKY_MATCH) {
    if (options.skipSql && rule.why.startsWith('WHERE')) continue
    if (rule.re.test(cmd)) return rule
  }
  return null
}

/**
 * 后台纪律始终开启，历史环境开关不等价于本轮真人裁决。
 */
export function shellGuiGuardEnabled() { return true }

/**
 * ⑦ 返回命中的 Win32 输入原语（用于拒绝文案），不构成绕道返回 null。
 * 指针、抢前台及前台键盘注入均需拒绝；不把历史技能豁免当授权。
 * 导出便于单测。
 */
export function guiBypassRisk(toolName, cmd) {
  if (!SHELL_TOOLS.has(toolName)) return null
  if (!shellGuiGuardEnabled()) return null
  const hit = cmd.match(GUI_POINTER) || cmd.match(GUI_FOREGROUND) || cmd.match(GUI_KEYBOARD)
  return hit ? hit[0] : null
}

/** ⑧ shell 整读式命令且无任何限流标志时返回该形态的 hint，否则 null。导出便于单测。 */
export function hugeShellOutputRisk(toolName, cmd) {
  if (!SHELL_TOOLS.has(toolName)) return null
  if (HOG_LIMITERS.some((re) => re.test(cmd))) return null
  for (const v of HOG_VERBOSE) {
    if (v.re.test(cmd)) return v.hint
  }
  return null
}

/**
 * ⑧ read 整读大文件。判据要看真实体积 / 行数，所以这里有一次**有界**读取：
 * 超过字节阈值直接判（不再读内容），阈值以内才读进来数行数（≤40KB，代价有界）。
 * 读不到（不存在 / 无权限）一律放行 —— 真不存在时 read 自己会报错，比守卫猜错好。
 * 返回 { bytes, lines }（lines 为 null 表示"已知超字节阈值、没再数行"）或 null。导出便于单测。
 */
export function hugeReadTarget(filePath) {
  try {
    const st = statSync(filePath)
    if (!st.isFile()) return null
    if (st.size > HOG_READ_BYTES) return { bytes: st.size, lines: null }
    const text = readFileSync(filePath, 'utf8')
    let lines = 0
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) lines++
    }
    return lines > HOG_READ_LINES ? { bytes: st.size, lines } : null
  } catch {
    return null
  }
}

export function decide(toolName, args, execution) {
  const name = typeof toolName === 'string' ? toolName : ''
  const a = args && typeof args === 'object' ? args : {}
  const editor = name === 'str_replace_editor'
  const rawPath = editor ? a.path : a.file_path
  const fp = typeof rawPath === 'string' ? rawPath : ''
  const fileRead = name === 'read' || (editor && a.command === 'view')
  const fileWrite = name === 'write' || name === 'edit' || (editor && a.command !== 'view')
  const cmd = typeof a.command === 'string' ? a.command : ''

  // ⑤ 电脑操作不得抢占前台或搬动真实鼠标指针（2026-10-01）
  if (cuaGuardEnabled()) {
    const risk = cuaForegroundRisk(name, a)
    if (risk && !(execution?.name === name && execution.arguments === a && foregroundAuthorizer(execution))) {
      return `拒绝会抢占前台或移动真实鼠标的 CUA 调用：${name}（${risk.why}）\n` +
        `规则：电脑操作默认走 background，不打断你正在用的窗口。${CUA_GUARD_HINT}`
    }
  }
  if (fileWrite && fp && CREDENTIAL_WRITE.test(fp)) {
    return '拒绝写入凭据类文件：' + fp +
      '（口令 / token / 证书 / 内网地址不入源码、日志与汇报；需要留存的写进版本库之外的本机凭据文件）'
  }
  if (fileRead && fp && CREDENTIAL_READ.test(fp)) {
    return '拒绝读取高价值凭据文件：' + fp + '（内容一旦进入上下文即等于外泄；确需核对请让用户本人查看）'
  }
  // ⑧ read 整读大文件（未带 offset/limit —— 带了就是"我知道自己在读什么"的信号）
  const range = a.view_range
  const boundedEditorView = Array.isArray(range) && range.length === 2 && range.every(Number.isSafeInteger)
    && range[0] >= 1 && range[1] >= range[0] && range[1] - range[0] + 1 <= 200
  if (fileRead && fp && (editor ? !boundedEditorView : a.offset === undefined && a.limit === undefined)) {
    const hog = hugeReadTarget(fp)
    if (hog) {
      const size = `${Math.round(hog.bytes / 1024)} KB` + (hog.lines === null ? '（已超 40KB 阈值）' : ` / ${hog.lines} 行`)
      return `拒绝 read 整读大文件：${fp}（${size} 会一次性灌进上下文；实测单条 >20KB 的返回在本项目共 81 条，` +
        `最大的几条正是这类整读，而大会话会被传输层按时掐断）。\n` +
        `改法：先 grep 定位（\`grep -n "关键词" <文件>\` 或 grep 工具），再 read 带 offset/limit 只读那一段；` +
        `确实要通读就分段读，每次 ≤200 行。`
    }
  }

  const sqlRisk = destructiveSqlRisk(name, a)
  if (sqlRisk) return `拒绝危险 SQL（${sqlRisk}）；先查影响范围并按授权规则复核备份与回滚。`

  if (cmd) {
    if (recursiveDeleteRisk(name, cmd)) {
      return '拒绝执行递归删除（含递归强制删除）：' + cmd + '。' + RISKY_PREVIEW +
        '使用获准的逐文件操作，不通过改写命令绕过边界。'
    }
    if (sweepsEverything(argsAfter(cmd, 'add'))) {
      return '拒绝整目录批量暂存：' + cmd + '（只加明确路径，提交前复核未混入敏感文件与构建产物）'
    }
    if (sweepsEverything(argsAfter(cmd, 'commit'))) {
      return '拒绝 git commit -a：' + cmd + '（只提交明确路径；-a / --all / -am 会把工作区里不属于本会话的改动一并带上）'
    }
    // ⑥ 按匹配做的风险操作：先只读预览命中范围
    const risky = shellCommandInvocations(cmd, name)
      .filter(call => ['rm', 'find', 'pkill', 'killall', 'taskkill'].includes(call.program))
      .map(call => riskyMatchRisk(call.text, { skipSql: true })).find(Boolean)
    if (risky) {
      return `拒绝「按匹配做的风险操作」：${cmd}\n命中：${risky.why}。${RISKY_PREVIEW}改法：${risky.fix}。`
    }
    // ⑦ shell 直调 Win32 输入原语：搬真实光标 / 抢前台，且绕开第五类 CUA 护栏
    const gui = guiBypassRisk(name, cmd)
    if (gui) {
      return `拒绝在 shell 里直调 Win32 输入原语（${gui}）：${cmd}\n` +
        `这些原语会搬走用户的真实光标或抢前台，而且**完全绕过** CUA 驱动的前台护栏（那条只认 cua_driver_native__ 前缀）。\n` +
        `改法：仅使用已授权、精确目标的后台 cua_driver_native__* 或 browser_* 工具；工具不可达时说明缺口，等待真人裁决。` +
        `拒绝不授权前台或其他通道重试，不用环境变量或 Shell 绕过；前台键盘注入也不例外。`
    }
    // ⑧ shell 整读式命令 + 零限流
    const huge = hugeShellOutputRisk(name, cmd)
    if (huge) {
      return `拒绝无限流的整读式命令：${cmd}\n${huge}，且这条命令没有任何输出限流（管道 / 重定向 / head / tail / ` +
        `-TotalCount / --oneline 都没有）。\n${HOG_FIX}`
    }
  }
  return null
}

export const name = 'hook-guards-native'

// Denials are the only thing worth a durable trail: every allowed call would
// bury the signal, and "the guard fired" is the fact a restart has to prove.
const LOG_MAX_BYTES = 512 * 1024
const logPath = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'logs', 'hook-guards-native.log')

function log(line) {
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    try {
      if (statSync(logPath).size > LOG_MAX_BYTES) writeFileSync(logPath, '')
    } catch { /* first write: nothing to truncate */ }
    appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`)
  } catch { /* diagnostics must never break the run */ }
}

// Safety is a monotonic post-waterfall guard. No listener can force allow.
export const inject = ['tools']
export function apply(ctx) {
  ctx.effect(() => {
    const dispose = ctx.tools.guard((exec) => {
      try {
        const reason = decide(exec.name, exec.arguments, exec)
        if (reason) { log('deny tool=' + exec.name); return reason }
        return undefined
      } catch {
        log('guard-evaluation-failed')
        return '安全守卫判定异常：本次调用未执行；请先排查守卫，不得换通道绕过。'
      }
    })
    log('loaded: monotonic guard revision=20261107-editor-recursive-fg-auth-v1')
    return dispose
  })
}
