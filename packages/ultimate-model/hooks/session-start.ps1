# SessionStart hook：开台体检
#
# 两条硬认识（来自规则文档）：
#   ① 健康时必须**零输出**——"静默通过"和"失败"必须可区分；
#   ② 谁看住看门的人——周期深检自己失效没人知道，所以每次开台查它上次成功是多久前。
#
# 能力边界：SessionStart 的输出是 detached 投递的（research 确认可能赶不上第一轮请求），
# 因此这里只报"不回话就没人知道"的问题，不承担强约束。

. (Join-Path $PSScriptRoot 'lib.ps1')

# 崩溃可见化（2026-10-13 加）：主体整体包在 try 里 —— 中途崩了仍然放行（"原来吞掉"的语义不变），
# 只多写一条到 hooks-crash.log，交给 rules-weekly-audit 报出来。
# 为什么必须包主体：心跳写在脚本开头，脚本崩在中途时心跳照样新鲜 ⇒ 周检按心跳判"机制在线"是假绿。
try {

    $payload = Get-HookInput
    Write-HookHeartbeat -Name 'session-start' -Payload $payload

    if (Test-HookFlag -Name 'session-start.off') { exit 0 }

    $event = 'SessionStart'
    $dshHome = Get-DshHome
    $cwd = [string](Get-Field $payload 'cwd')
    if ([string]::IsNullOrWhiteSpace($cwd)) { $cwd = $env:CLAUDE_PROJECT_DIR }
    if ([string]::IsNullOrWhiteSpace($cwd)) { $cwd = (Get-Location).Path }

    $issues = New-Object System.Collections.Generic.List[string]

    function Get-LineCount {
        param([string]$Path)
        try { return @(Get-Content -LiteralPath $Path -ErrorAction Stop).Count } catch { return -1 }
    }

    # 项目规则是否属于"本分支的责任"。只对我们在维护的规则文件执行体积闸门：
    # 从上游继承下来、超限的规则文件本轮没有参与，体检不该反复为它报警；
    # 一旦本分支改过它（或它压根是我们新增的），体积就是我们的责任，照常告警。
    #
    # 判据是"文件内容是否与上游默认分支逐字节一致"，而不是"哪些提交碰过它"：
    # 后者会把 rebase / merge 带进来的上游提交误算成本分支的改动。
    # 基准优先取 upstream/<默认分支>——fork 的 main 往往落后于真正的上游，
    # 用它会把上游改过而本分支未碰的文件误判成我们的。
    function Test-RulesTouchedByBranch {
        param([string]$Path, [string]$RepoRoot)
        try {
            if (-not (Get-Command git -ErrorAction Stop)) { return $true }   # 判不出归属时从严
            Push-Location $RepoRoot -ErrorAction Stop
            try {
                # 必须是 POSIX 风格的仓库相对路径：Resolve-Path -Relative 会给出 ".\AGENTS.md"，
                # 而 git 的 "HEAD:<path>" 语义不接受反斜杠与前导 ".\"（会退化成退出码 128）。
                $rel = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
                $rel = $rel.Substring($RepoRoot.Length).TrimStart('\', '/') -replace '\\', '/'
                $base = $null
                foreach ($candidate in @('upstream/main', 'upstream/master', 'origin/main', 'origin/master', 'main', 'master')) {
                    & git rev-parse --verify --quiet $candidate *> $null
                    if ($LASTEXITCODE -eq 0) { $base = $candidate; break }
                }
                if (-not $base) { return $true }                            # 找不到基准时从严
                & git cat-file -e "$base`:$rel" *> $null
                if ($LASTEXITCODE -ne 0) { return $true }                   # 基准上没有：新增文件，算我们的
                # 工作树里正被编辑（包括已 staged 但未提交）：体积膨胀是我们此刻的责任，
                # 不能等提交后才管。HEAD 未纳入版本控制时同样按"我们的"处理。
                & git cat-file -e "HEAD:$rel" *> $null
                if ($LASTEXITCODE -ne 0) { return $true }
                & git diff --quiet HEAD -- $rel *> $null
                if ($LASTEXITCODE -ne 0) { return $true }                   # 未提交的改动
                & git diff --quiet $base HEAD -- $rel *> $null
                return ($LASTEXITCODE -ne 0)                                 # 已提交但与上游不同＝本分支改过
            } finally { Pop-Location }
        } catch { return $true }
    }

    # ── ① 规则文件就位且不臃肿 ───────────────────────────────────────────────
    $globalRules = Join-Path $dshHome 'AGENTS.md'
    if (-not (Test-Path -LiteralPath $globalRules)) {
        $issues.Add("全局规则缺失：$globalRules（首要纪律与安全红线不再被注入）")
    } else {
        $n = Get-LineCount -Path $globalRules
        if ($n -gt 250) { $issues.Add("全局规则已 $n 行，超过 250 行上限——长文会稀释单条约束，请外置到技能") }
    }

    $projectRules = Join-Path $cwd 'AGENTS.md'
    if (-not (Test-Path -LiteralPath $projectRules)) {
        $issues.Add("项目规则缺失：$projectRules（本仓技术栈约定不再被注入）")
    } else {
        $n = Get-LineCount -Path $projectRules
        # 与上游相同、且未被本分支改动的规则文件：本轮没有参与，体积不是我们的责任，
        # 静默放过（不写 note——健康时必须零输出）。一旦本分支改过它，闸门照常生效。
        if ($n -gt 300 -and (Test-RulesTouchedByBranch -Path $projectRules -RepoRoot $cwd)) {
            $issues.Add("项目规则已 $n 行，超过 300 行——细节应外置到 .qoder/repowiki 或技能")
        }
    }

    # ── ② hook 配置可解析（配置读不了会让**全部** hook 静默失效）────────────
    $hooksJson = Join-Path $dshHome 'hooks.json'
    if (-not (Test-Path -LiteralPath $hooksJson)) {
        $issues.Add("hook 配置缺失：$hooksJson")
    } else {
        try {
            $cfg = Get-Content -LiteralPath $hooksJson -Raw -ErrorAction Stop | ConvertFrom-Json
            $hookCount = 0
            foreach ($evt in $cfg.hooks.PSObject.Properties) {
                foreach ($group in $evt.Value) {
                    foreach ($h in $group.hooks) {
                        if ($h.type -eq 'command' -or $null -eq $h.type) { $hookCount++ }
                    }
                }
            }
            if ($hookCount -eq 0) { $issues.Add("hook 配置里没有任何 command hook（$hooksJson）") }
        } catch {
            $issues.Add("hook 配置无法解析（会导致全部 hook 失效）：$($_.Exception.Message)")
        }
    }

    # ── ③ 技能目录与 frontmatter 有效性 ─────────────────────────────────────
    # 目录包 <name>/SKILL.md 与扁平 <name>.md 都合法；name 必须 kebab-case，且必须有 description。
    $skillRoots = @(
        (Join-Path $dshHome 'skills'),
        (Join-Path $cwd '.dsh\skills')
    )
    $skillCount = 0
    foreach ($root in $skillRoots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $entries = @(Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)
        foreach ($entry in $entries) {
            $file = $null
            if ($entry.PSIsContainer) {
                $candidate = Join-Path $entry.FullName 'SKILL.md'
                if (Test-Path -LiteralPath $candidate) { $file = $candidate }
            } elseif ($entry.Name -like '*.md') {
                $file = $entry.FullName
            }
            if ($null -eq $file) { continue }
            $skillCount++
            try {
                $raw = Get-Content -LiteralPath $file -Raw -ErrorAction Stop
                $m = [regex]::Match($raw, '(?s)\A---\r?\n(.*?)\r?\n---')
                if (-not $m.Success) { $issues.Add("技能缺 frontmatter 被静默忽略：$file"); continue }
                $fm = $m.Groups[1].Value
                $nameMatch = [regex]::Match($fm, '(?m)^name:\s*(\S+)\s*$')
                if (-not $nameMatch.Success) { $issues.Add("技能缺 name 被静默忽略：$file"); continue }
                if ($nameMatch.Groups[1].Value -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') {
                    $issues.Add("技能 name 非 kebab-case 被静默忽略：$file -> $($nameMatch.Groups[1].Value)")
                }
                if (-not [regex]::IsMatch($fm, '(?m)^description:\s*\S')) { $issues.Add("技能缺 description 被静默忽略：$file") }
            } catch { }
        }
    }
    if ($skillCount -eq 0) { $issues.Add("未发现任何技能（$($skillRoots -join ' ; ')）") }

    # ── ④ 周期深检（不同节奏的独立通道）：**过期即自愈** ────────────────────
    #
    # 2026-09-30 裁决（三案 A 注册计划任务 / B 开台自愈 / C 只记录）：本机**没有任何调度器**
    # 在跑它（`Get-ScheduledTask` 无相关项），深检因此从未成功运行过，而"过期"这件事
    # 只有开台体检会报 —— 报完还是没人跑。选了 B：**过期就当场跑一次全量**。
    #
    # 四条边界（少一条就会变成新的噪音源）：
    #   ① **只在过期时跑**：`last-success` 新鲜时一次都不跑，不给每次开台加固定开销；
    #   ② 跑的是**全量**（不带 `-Check`）：只有全量才刷新时间戳，那才叫自愈；
    #      `-Check` 是给人手动看漂移用的，跑了不刷新，自愈会变成"每次开台都跑一次"；
    #   ③ **成功不输出**："健康时零输出"这条不变 —— 自愈跑通就是把不健康变健康，
    #      此时的静默与"什么都没做"在语义上一致（证据在 audit\last-report.md 与心跳里）；
    #   ④ **失败必须报**：把深检自己的 ERROR 摘要抬上来，否则自愈失败会静默重演。
    # 关掉它的出口：`session-start.no-selfheal` 开关文件（与其它开关同一套机制）。
    $auditStamp = Join-Path $dshHome 'hooks\audit\last-success.txt'
    $auditScript = Join-Path $dshHome 'hooks\rules-weekly-audit.ps1'
    $stale = $true
    $staleReason = "从未成功运行过（$auditStamp 不存在）"
    if (Test-Path -LiteralPath $auditStamp) {
        try {
            $last = [datetime]::Parse((Get-Content -LiteralPath $auditStamp -Raw).Trim())
            $days = [math]::Round(((Get-Date) - $last).TotalDays, 1)
            if ($days -le 8) { $stale = $false } else { $staleReason = "已 $days 天未成功运行（阈值 8 天）" }
        } catch { $staleReason = "时间戳无法解析：$auditStamp" }
    }

    if ($stale -and -not (Test-HookFlag -Name 'session-start.no-selfheal')) {
        if (-not (Test-Path -LiteralPath $auditScript)) {
            $issues.Add("周期深检过期（$staleReason）且脚本不存在，无法自愈：$auditScript")
        } else {
            $auditCode = -1
            $auditOut = ''
            $watch = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                # 深检里有一项按"当前目录的项目规则"核对，所以要在会话的工作目录里跑
                Push-Location -LiteralPath $cwd -ErrorAction SilentlyContinue
                $auditOut = (& pwsh -NoLogo -NoProfile -NonInteractive -File $auditScript 2>&1 | Out-String)
                $auditCode = $LASTEXITCODE
            } catch {
                $auditOut = "自愈运行深检时抛错：$($_.Exception.Message)"
            } finally {
                Pop-Location -ErrorAction SilentlyContinue
                $watch.Stop()
            }
            if ($auditCode -ne 0) {
                $head = @(($auditOut -split "`r?`n") | Where-Object { $_ -match '^- ' } | Select-Object -First 4) -join ' ; '
                $reportPath = Join-Path $dshHome 'hooks\audit\last-report.md'
                # 必须写成**一行**：方法调用参数表里"字符串 + 换行 + `+`"不会续行（实测），
                # 拆行会让整段变成语法错误。这一条是踩出来的，别照"惯例"美化它。
                $issues.Add("周期深检自愈运行失败（原过期原因：$staleReason；退出码 $auditCode；耗时 $([math]::Round($watch.Elapsed.TotalSeconds, 1))s）：$head（报告：$reportPath）")
            }
            # 成功：时间戳已被深检自己刷新，按"健康零输出"静默通过
        }
    }

    # Session startup is diagnostic, never an implicit dependency patcher.
    $cuaPluginEntry = Join-Path $dshHome 'profiles\desktop\node_modules\@deepseek-ai\dsh-experimental-computer-use-cua-driver-native\lib\index.js'
    if (Test-Path -LiteralPath $cuaPluginEntry) {
        try {
            $cuaSrc = Get-Content -LiteralPath $cuaPluginEntry -Raw -ErrorAction Stop
            if ($cuaSrc -notmatch 'CUA_SESSION_KEEPALIVE_PATCH') {
                $issues.Add('CUA 未发现历史保活标记；仅作诊断。先核验当前版本是否仍需补丁，未经显式授权不修补依赖、不重启。')
            }
        } catch { $issues.Add('CUA 标记只读检查失败；未修改插件。') }
    }

    # ── ⑥ 未完成的接续队列 ─────────────────────────────────────────────────
    $queueSummary = ''
    $queueFile = Join-Path $dshHome 'hooks\continuation-queue.md'
    if (Test-Path -LiteralPath $queueFile) {
        try {
            $sid = [string](Get-Field $payload 'session_id')
            $pending = @(Get-ScopedContinuationItems -Lines @(Get-Content -LiteralPath $queueFile -ErrorAction Stop) -SessionId $sid -Cwd $cwd | Where-Object { -not $_.IsBlocked } | ForEach-Object { $_.Text })
            if ($pending.Count -gt 0) { $queueSummary = ($pending | Select-Object -First 8) -join "`n" }
        } catch { }
    }

    # ── ⑦ preset persona 的 prompt 变量白名单（2026-10-20 加）────────────────
    # 事故：persona.suffix 写了 `{{cwd}}`，而 dsh-system-prompt 的 interpolate() 对
    # **未注册的变量直接抛错**（不是留空、不是忽略）⇒ 每轮运行全红，报
    # 「unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"」。
    # 可插值变量只有 dsh-agent-loop 注册的 provider / model；工作目录由
    # dsh-working-directory 作为 prompt context 注入，**不该由 persona 自己插**。
    #
    # 为什么放在开台体检而不是只写规则：这条判据的失效模式是"每轮都炸"，
    # 而开台体检每次会话都跑（周期深检是周级节奏，太慢）。
    # 判据要能失败：把 {{cwd}} 写回 persona 的 prefix/suffix，下面必须报。
    $allowedPromptVars = @('provider', 'model')
    $personaSources = @(
        (Join-Path $dshHome '.agent-presets\_shared\base.yml'),
        (Join-Path $dshHome '.agent-presets\hiatmp-dev\overlay.yml'),
        (Join-Path $dshHome '.agent-presets\hiatmp-standard\overlay.yml'),
        (Join-Path $dshHome 'cordis.patch.yml')
    )
    foreach ($src in $personaSources) {
        if (-not (Test-Path -LiteralPath $src)) { continue }
        $srcLines = @()
        try { $srcLines = @(Get-Content -LiteralPath $src -ErrorAction Stop) } catch { continue }
        $inPersona = $false
        for ($i = 0; $i -lt $srcLines.Count; $i++) {
            $line = $srcLines[$i]
            if ($line -match '^\s*-\s*id:\s*persona\s*$') { $inPersona = $true; continue }
            # 下一个插件条目 ⇒ persona 段结束（persona 的 prefix 是 block scalar，缩进更深，不会误切）
            if ($inPersona -and $line -match '^\s*-\s*id:\s*\S+') { $inPersona = $false }
            if (-not $inPersona) { continue }
            $trimmed = $line.Trim()
            if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }   # 注释里会写判据本身，不算
            foreach ($m in [regex]::Matches($line, '\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}')) {
                $v = $m.Groups[1].Value
                if ($allowedPromptVars -notcontains $v) {
                    $issues.Add("preset persona 里出现未注册的 prompt 变量 {{$v}}（$src 第 $($i + 1) 行）—— dsh-system-prompt 对未注册变量直接抛错，会让**每轮运行**失败；只准用 $($allowedPromptVars -join ' / ')，工作目录由 dsh-working-directory 注入")
                }
            }
        }
    }

    if ($issues.Count -eq 0 -and [string]::IsNullOrWhiteSpace($queueSummary)) { exit 0 }   # 健康：零输出

    $parts = New-Object System.Collections.Generic.List[string]
    if ($issues.Count -gt 0) {
        $parts.Add("<开台体检发现 $($issues.Count) 项问题>`n" + (($issues | ForEach-Object { "- $_" }) -join "`n"))
    }
    if (-not [string]::IsNullOrWhiteSpace($queueSummary)) {
        $parts.Add("<接续队列：以下仅匹配本作用域；核对原始任务授权后推进，队列本身不新增授权>`n$queueSummary")
    }

    Write-HookContext -EventName $event -Text (($parts -join "`n`n") + "`n</开台体检>")
    exit 0
} catch {
    Write-HookCrash -Name 'session-start' -Error $_
    exit 0
}
