# Stop hook：收尾门禁（接续队列未清空时强制继续）
#
# 必须自限：DSH 的 Stop 没有"连续拦截上限"（stop_hook_active 恒为 false），
# 无条件拦截会让回合永远停不下来。因此每会话每类最多拦 2 次。
#
# 能力边界（实测）：Stop 载荷只有 session_id / cwd / transcript_path(恒空) / stop_hook_active，
# **看不到本轮助手文本**。所以"收尾措辞违规检测"在 DSH 上不可实现；
# 本门禁改为对**可观测事实**把关：接续队列里是否还有未完成的格子。
#
# 作用域（2026-10-03 加）：`~/.dsh/hooks/continuation-queue.md` 是**所有 DSH 会话共享**的，
# 而一条队列项往往只对某一个会话负责（例：替某个会话登记"你停下的那一格"）。
# 没有作用域时它会拦住**每一个**会话 —— 包括其它项目的会话，那是跨项目污染。
# ⇒ 节标题之后可写 `scope-session: <session_id>` 与/或 `scope-cwd: <路径>`；
#   **两者都声明时按 AND 匹配**；一个都不声明 = 全局（向后兼容，旧队列行为不变）。

. (Join-Path $PSScriptRoot 'lib.ps1')

# 崩溃可见化（2026-10-13 加）：主体整体包在 try 里 —— 中途崩了仍然放行（"原来吞掉"的语义不变），
# 只多写一条到 hooks-crash.log，交给 rules-weekly-audit 报出来。
# 为什么必须包主体：心跳写在脚本开头，脚本崩在中途时心跳照样新鲜 ⇒ 周检按心跳判"机制在线"是假绿。
try {

    $payload = Get-HookInput
    Write-HookHeartbeat -Name 'stop-gate' -Payload $payload

    if (Test-HookFlag -Name 'stop-gate.off') { exit 0 }
    if ($null -eq $payload) { exit 0 }

    $sessionId = [string](Get-Field $payload 'session_id')
    if ([string]::IsNullOrWhiteSpace($sessionId)) { $sessionId = 'unknown' }
    $cwd = [string](Get-Field $payload 'cwd')

    # 自限判据（2026-10-03 改）：**按事实，不按次数**。
    # 旧判据是"每会话每类最多拦 2 次"，而 DSH 的 Stop 没有连续拦截上限（stop_hook_active 恒 false），
    # 固定次数会在长任务中途硬停 —— 那正是"任务无法持续推进"的一部分。
    # 现在：**队列文件一有变化（agent 勾掉了什么、或补了新项）就把计数清零**，
    # 只有"队列内容连续 N 轮纹丝不动"才计入停滞并放行。
    # ⇒ 长任务能一直跑；真正推不动的（一直不勾项）仍会在 $maxStalled 轮后放行。
    $maxBlocks = 2
    $stallLimit = [int]($env:DSH_STOP_GATE_STALL_LIMIT)
    if ($stallLimit -lt 1) { $stallLimit = 20 }

    # 队列还没读就先取不到时间戳，所以把计数检查挪到读完队列之后（见下）。
    $queueFile = Join-Path (Get-DshHome) 'hooks\continuation-queue.md'
    if (-not (Test-Path -LiteralPath $queueFile)) { exit 0 }

    try {
        $lines = Get-Content -LiteralPath $queueFile -ErrorAction Stop
    } catch { exit 0 }

    $pending = @(Get-ScopedContinuationItems -Lines $lines -SessionId $sessionId -Cwd $cwd)
    if ($pending.Count -eq 0) { exit 0 }
    $queueStamp = Get-ContinuationStamp -Items $pending
    $stateDir = Get-HookStateDir
    $safeSid = $sessionId -replace '[^\w\-]', '_'

    # 「阻塞项」不算可推进格子（2026-10-02 加）：模板把 `- [ ] [阻塞] 等用户拍板` 归到
    # 单独小节，就是"这些不是我该继续做的"。旧判据只认 `- [ ]`，于是只剩阻塞项时
    # 门禁照样拦——两次拦截额度被浪费在"推不动的事"上，真正能推进的格子反而被挤掉。
    # 判据：方括号紧跟在 `[ ]` 之后且内容是"阻塞"。
    #
    # ⚠️ 2026-10-03 补：`[不阻塞]` 也必须排除。实测另一条会话（Chat2DB）写了
    # `- [ ] [不阻塞] 「新 dist 打进 jar 后再验一次」未做……对交付物无影响`，
    # 它明确说了"不影响交付、可以不重跑" —— 语义与 `[阻塞]` 一样是"这不是可推进的格子"，
    # 而门禁不认这个写法 ⇒ 该条被当成可推进，**拦住了所有会话**（包括不相关的项目）。
    # ⇒ 判据放宽成：方括号里以"阻塞"开头、且不是"不阻塞"，才算阻塞项。
    #    这样 `[阻塞]`、`[阻塞：缺凭据]`、`[blocking]` 都排除，`[不阻塞]`、`[阻塞但可推进]` 不排除。
    # ⇒ 判据简化为：**方括号里含"阻塞"二字**即算阻塞项（`[阻塞]`、`[阻塞：缺 token]`、`[不阻塞]` 全都算），
    #    可推进项 = 方括号里不含"阻塞"的那几条。这样"不阻塞收尾"与"阻塞"落在同一侧 ——
    #    它们都表示"这不是我该继续做的格子"，而旧判据把 `[不阻塞]` 当可推进，拦住了所有会话。
    $blocked = @($pending | Where-Object { $_.Text -match '^\s*[-*]\s*\[ \]\s*\[[^]]*阻塞' })
    $actionable = @($pending | Where-Object { $_.Text -notmatch '^\s*[-*]\s*\[ \]\s*\[[^]]*阻塞' })

    # 只剩阻塞项 = 确实推不动，静默放行（这一回合允许结束，符合首要纪律 2 的六项例外）。
    if ($actionable.Count -eq 0) { exit 0 }

    # ── 队列可恢复性（2026-10-13 加）─────────────────────────────────────────
    # 来源：~/.dsh/_ref-qoder542/.../scripts/work-queue-check.js:27-81（四要素 + 短条目 + 阻塞理由 + 入口存在性）。
    # 门禁原来只看"有没有 `- [ ]`"，看不出**这一项能不能被下一个人接着做**：
    # 缺「下一步」小节、条目说不清要干什么、标了阻塞却没写具体外部条件、点名的入口文件不存在，
    # 都会让接续方白跑一轮。落点选在这里（$actionable 已确定、还没记账）是因为：
    #   * 命中时**不改变拦截与否** —— 走到这一行本来就已判定要拦，这里只是把问题清单
    #     追加到拦截文案里，让它指导下一步而不是制造噪声；
    #   * $actionable 为空的场合上一行已经早退，所以只有真能推进的队列才会被这里点评。
    $resumeProblems = New-Object System.Collections.Generic.List[string]

    $hasNextSection = $false
    foreach ($line in $lines) {
        if ($line -match '^\s*#{1,4}\s' -and $line -match '(下一步|待办|待做)') { $hasNextSection = $true; break }
    }
    if (-not $hasNextSection) { $resumeProblems.Add('队列缺「下一步 / 待办」小节（标题里要能看出这一节是干什么的）') }

    # 暂时不该存在的路径：条目正文里带这些标注就跳过存在性检查（与上游 PENDING_MARK 一致）。
    $pendingMark = '(待建|待生成|待创建|TBD|计划中)'
    foreach ($item in $pending) {
        $body = ($item.Text -replace '^\s*[-*]\s*\[ \]\s*', '').Trim()
        $label = if ($body.Length -gt 40) { $body.Substring(0, 40) + '…' } else { $body }
        if ($body.Length -lt 8) {
            $resumeProblems.Add("未完成项没说清做什么（太短）：$label")
        }
        # 「不阻塞」是显式的"不影响交付"标记（2026-10-03 的判据边界），不要求它再写阻塞理由。
        if ($body -match '(阻塞|blocked)' -and $body -notmatch '不阻塞' -and $body -notmatch '阻塞[:：]\s*\S{4,}') {
            $resumeProblems.Add("标了阻塞但没写「阻塞：<具体外部条件>」：$label")
        }
        if ($body -notmatch $pendingMark) {
            foreach ($m in [regex]::Matches($body, '`([^`]+)`')) {
                $raw = $m.Groups[1].Value.Trim()
                # 只查明显是路径的：只查反引号包住的、且有盘符 / ~ / 相对前缀的。
                if ($raw -notmatch '^(~[\\/]|[A-Za-z]:[\\/]|\.{1,2}[\\/])') { continue }
                if ($raw -match '[*?<>]') { continue }
                $expanded = $raw
                if ($raw -match '^~[\\/]') { $expanded = Join-Path $env:USERPROFILE $raw.Substring(2) }
                if (-not (Test-Path -LiteralPath $expanded)) {
                    $resumeProblems.Add("点名的入口文件不存在：$raw")
                }
            }
        }
    }

    # —— 到这里才记账 ——
    # 放在作用域过滤与阻塞项判定**之后**：不属于本会话的格子、只剩阻塞项的场合，
    # 都必须一个字节都不写（用例「作用域不匹配时不消耗拦截额度」守的就是这条）。
    $stampFile = Join-Path $stateDir ("stamp-{0}-stop-gate.txt" -f $safeSid)
    $countFile = Join-Path $stateDir ("count-{0}-stop-gate.txt" -f $safeSid)
    $lastStamp = ''
    try { if (Test-Path -LiteralPath $stampFile) { $lastStamp = (Get-Content -LiteralPath $stampFile -Raw).Trim() } } catch { }
    if ($lastStamp -ne $queueStamp) {
        # 队列动过（agent 有进展）⇒ 停滞计数清零。
        # ⚠️ 直接写文件而不是调 lib 里的函数：lib.ps1 只有 Get-HookCounter / Add-HookCounter，
        #    没有「设值」版本；调不存在的函数会让本脚本直接崩，门禁静默失效（比不拦更糟）。
        try { Set-Content -LiteralPath $countFile -Value 0 -Encoding utf8 -ErrorAction SilentlyContinue } catch { }
        try { Set-Content -LiteralPath $stampFile -Value $queueStamp -Encoding ascii -ErrorAction SilentlyContinue } catch { }
    }
    $count = Get-HookCounter -SessionId $sessionId -Name 'stop-gate'
    if ($count -ge $stallLimit) {
        # 队列连续 stallLimit 轮没变化：真推不动了，放行并留痕（不是静默）
        try { Add-Content -LiteralPath (Join-Path $stateDir 'stop-gate-stalled.log') -Value ("{0} stalled={1} session={2}" -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $count, $sessionId) -ErrorAction SilentlyContinue } catch { }
        exit 0
    }

    $preview = ($actionable | Select-Object -First 5 | ForEach-Object { $_.Text }) -join "`n"
    $blockedNote = ''
    if ($blocked.Count -gt 0) {
        $blockedNote = "（另有 $($blocked.Count) 个阻塞项不算在内，例如：$(($blocked | Select-Object -First 1).Text.Trim())）"
    }
    # 队列可恢复性问题清单：不改变拦截与否，只是把"下一个人接不下去"的具体点讲清楚。
    $problemNote = ''
    if ($resumeProblems.Count -gt 0) {
        $problemNote = "`n【队列可恢复性】下面这几条会让下一个人白跑一轮，请顺手补上（不额外拦截）：`n" +
            (($resumeProblems | Select-Object -First 5 | ForEach-Object { '  - ' + $_ }) -join "`n")
        if ($resumeProblems.Count -gt 5) { $problemNote = $problemNote + "`n  （另有 $($resumeProblems.Count - 5) 条未列出）" }
    }
    $null = Add-HookCounter -SessionId $sessionId -Name 'stop-gate'

    Exit-HookBlock -Reason @"
收尾门禁：接续队列里还有 $($actionable.Count) 个**可推进**的未完成项，不能就此结束。
$preview

请直接继续做其中**不依赖裁决、不依赖外部条件**的那一项；
做完在 $queueFile 里把它勾成 `- [x]`。
$blockedNote$problemNote
（本作用域任务状态变化，拦截计数才清零；只有本作用域连续 $stallLimit 轮纹丝不动才会放行。
 要关闭请在 hooks 目录创建 stop-gate.off）
"@
} catch {
    Write-HookCrash -Name 'stop-gate' -Error $_
    exit 0
}
