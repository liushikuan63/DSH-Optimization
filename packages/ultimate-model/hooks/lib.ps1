# DSH hook 共用库（被各 hook 脚本 dot-source，不直接注册为 hook）
#
# 契约（已实测确认）：
#   hook 命令是 PowerShell 源码，由 pwsh 执行器以
#   pwsh -NoLogo -NoProfile -NonInteractive -Command "<utf8预置><命令>" 运行；
#   事件载荷以 JSON 经 stdin 传入；使用有界读取，不等待永久 EOF。
#   注意：hook 进程**看不到** DSH_* 与 *KEY/*TOKEN/*SECRET/*PASSWORD 环境变量，
#   会话 id 与工作目录只能从载荷里取。
#
# 输出契约：
#   退出 0            = 放行；stdout 以 { 开头时按结构化 JSON 解析
#   退出 2            = 拦截（stderr 文本成为模型可见的原因）
#   其他退出码        = 非阻塞失败，动作照常进行
#   注入上下文必须写成 hookSpecificOutput.hookEventName **精确等于**当前事件名，
#   否则 additionalContext 会被静默丢弃。

. (Join-Path $PSScriptRoot 'queue-scope.ps1')

function Get-HookInput {
    # 读取并解析 stdin 载荷；空/非 JSON 时返回 $null（不抛错）。
    #
    # 为什么不能用 [Console]::In.ReadToEnd()（2026-09-20 实测确认的严重缺陷）：
    #   桥给子进程写入 payload 后**不关闭子进程 stdin**，ReadToEnd() 等 EOF 永远等不到，
    #   脚本一直挂到桥的超时才被杀。生产证据：某会话 6 次 hook/result 全部
    #   `exitCode=1` 且 `durationMs≈30000`（正好是 defaultTimeoutMs）——注入失效、
    #   高危拦截失效（超时→pass）、收尾门禁失效，且每轮白耗 30s × 钩子数。
    #   隔离实验（同一脚本，唯一变量"父进程关不关 stdin"）：关=1427ms 正常返回并输出
    #   additionalContext；不关=12s 仍不退出。心跳为空也由此解释：写心跳在读 stdin 之后。
    #
    # 因此改为：只读**已到达**的字节（DataAvailable，绝不等待 EOF），并以
    #   "JSON 能解析成功" 作为载荷完整的判据，兼顾分片写入与"无 EOF"两种情形。
    param([int]$WaitMs = 2000)
    try {
        if (-not [Console]::IsInputRedirected) { return $null }
        $stdin = [Console]::OpenStandardInput()
        $buffer = New-Object byte[] 65536
        $ms = New-Object System.IO.MemoryStream
        $deadline = (Get-Date).AddMilliseconds($WaitMs)
        while ((Get-Date) -lt $deadline) {
            # 用 ReadAsync，不要用 DataAvailable：WindowsConsoleStream（[Console]::OpenStandardInput()
            # 的真实类型）的 DataAvailable **恒为空**，写成 `if ($stdin.DataAvailable)` 会永远读不到字节——
            # 2026-09-20 实测踩到，当时让 3 条守卫用例变红（守卫拿到 $null 就不拦了）。
            # ReadAsync 在有数据时立即完成（不等 EOF），因此对"父进程关不关 stdin"两种形态都成立：
            #   管道+`-Command`：会送 EOF，正常完成；
            #   桥的形态：不送 EOF，但首次 ReadAsync 仍返回已到达的字节，靠"JSON 解析成功"收口。
            $remaining = [int][Math]::Max(50, ($deadline - (Get-Date)).TotalMilliseconds)
            $task = $stdin.ReadAsync($buffer, 0, $buffer.Length)
            if (-not $task.Wait($remaining)) { break }
            $n = $task.Result
            if ($n -le 0) { break }
            $ms.Write($buffer, 0, $n)
            $probe = [System.Text.Encoding]::UTF8.GetString($ms.ToArray()).Trim()
            try { [void]($probe | ConvertFrom-Json); break } catch { }
        }
        if ($ms.Length -eq 0) { return $null }
        $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray()).Trim()
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
        try { return $raw | ConvertFrom-Json } catch { return $null }
    } catch { return $null }
}

function Get-Field {
    # 安全取属性：属性不存在返回 $null，不触发严格模式错误。
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

function Write-HookContext {
    # 注入上下文。事件名必须与触发事件完全一致，否则字段被丢弃。
    param([string]$EventName, [string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return }
    $payload = @{
        hookSpecificOutput = @{
            hookEventName     = $EventName
            additionalContext = $Text
        }
    }
    [Console]::Out.Write(($payload | ConvertTo-Json -Depth 5 -Compress))
}

function Exit-HookBlock {
    # 拦截：退出码 2，stderr 成为模型可见原因。
    #
    # 必须用 [Environment]::Exit 而不是 `exit 2`——实测（本目录 tests/run-tests.ps1）：
    # 执行器以 `pwsh -Command "<预置>& '脚本.ps1'"` 形态调用时，脚本里的 `exit N`
    # 不会把 N 传给宿主进程，一律变成 1；而 DSH 只把 **2** 当作拦截，
    # 其余非零码都算"非阻塞失败、动作照常进行"——用 exit 2 会让所有守卫静默失效。
    # [Environment]::Exit 在 -Command 与 -File 两种形态下都如实返回 2。
    # （`exit 0` 在本形态下正常返回 0，故放行路径无需改动。）
    param([string]$Reason)
    if ([string]::IsNullOrWhiteSpace($Reason)) { $Reason = '被 hook 拦截' }
    [Console]::Error.Write($Reason)
    [Console]::Error.Flush()
    [Environment]::Exit(2)
}

function Get-HookStateDir {
    # 可写状态目录。hook 以部署级 sandbox 策略运行（workspace-write），
    # 工作区之外的写法可能被拒，因此统一放临时目录并全程容错。
    $dir = Join-Path $env:TEMP 'dsh-hooks'
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force -ErrorAction SilentlyContinue | Out-Null
    }
    return $dir
}

function Get-HookCounter {
    # 读某会话某类计数（用于"每类每会话限 N 次"的防死循环）。
    param([string]$SessionId, [string]$Name)
    try {
        $file = Join-Path (Get-HookStateDir) ("count-{0}-{1}.txt" -f ($SessionId -replace '[^\w\-]', '_'), $Name)
        if (Test-Path -LiteralPath $file) { return [int](Get-Content -LiteralPath $file -Raw) }
    } catch { }
    return 0
}

function Add-HookCounter {
    param([string]$SessionId, [string]$Name)
    try {
        $file = Join-Path (Get-HookStateDir) ("count-{0}-{1}.txt" -f ($SessionId -replace '[^\w\-]', '_'), $Name)
        $next = (Get-HookCounter -SessionId $SessionId -Name $Name) + 1
        Set-Content -LiteralPath $file -Value $next -Encoding utf8 -ErrorAction Stop
        return $next
    } catch { return 0 }
}

function Get-HeartbeatCandidates {
    # 心跳日志的候选位置，按优先级排列。
    # 为什么两个：hook 以**部署级** sandbox 策略运行（workspace-write，workspaceRoot=进程 cwd），
    # 工作区之外与临时目录之外的写法可能被拒；但审计/开台体检是**非沙箱**进程，
    # 只有 DSH home 下那份它才一定读得到。因此两处都尝试，读取时取先命中的那份。
    $list = New-Object System.Collections.Generic.List[string]
    $list.Add((Join-Path (Get-DshHome) 'hooks\heartbeat.log'))
    try { $list.Add((Join-Path (Get-HookStateDir) 'heartbeat.log')) } catch { }
    return $list
}

function Write-HookHeartbeat {
    # 机制心跳：每次触发追加一行时间戳，使"规则到底有没有在跑"可查。
    # 尽力而为，任何失败都不影响 hook 主逻辑（也绝不因此让 hook 非零退出）。
    #
    # 行格式：时间戳 钩子名 会话id cwd
    #
    # **为什么要有会话 id**：第三段原来写 $env:CLAUDE_PROJECT_DIR，而它在真实会话里
    # 也是空的（session-start 自己都要退回 (Get-Location)）—— 于是"真实会话"与
    # 自测进程（tests\run-tests.ps1 用字面量 session_id='test-session'）留下的行**长得一模一样**。
    # rules-weekly-audit 的判据本来就是按"有没有第三段"区分两者的，而它永远不成立 ⇒
    # 每一次深检都必然报「心跳里只有自测进程留下的时间戳」这条假错（2026-09-30 实测）。
    # 写会话 id 之后这个区分才是真的：自测的 id 是字面量 test-session。
    #
    # `$Payload` **不能声明成 [string]**：调用方传进来的是 ConvertFrom-Json 的 PSObject，
    # 声明成 [string] 会被强转成 "@{session_id=...}" 那种字符串，Get-Field 再也取不到字段
    # （第一版就是这么写的，心跳里的会话 id 一直是空的）。
    param([string]$Name, $Payload = $null)
    $sessionId = ''
    try {
        if ($null -ne $Payload) {
            $sessionId = [string](Get-Field $Payload 'session_id')
        }
    } catch { }
    $line = '{0} {1} {2} {3}' -f (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz'), $Name, $sessionId, $env:CLAUDE_PROJECT_DIR
    foreach ($path in (Get-HeartbeatCandidates)) {
        try {
            $dir = Split-Path -Parent $path
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Path $dir -Force -ErrorAction Stop | Out-Null
            }
            Add-Content -LiteralPath $path -Value $line -Encoding utf8 -ErrorAction Stop
        } catch { }
    }
}

function Get-HookCrashCandidates {
    # 崩溃日志的候选位置，与心跳同一套理由：hook 以**部署级** sandbox 策略运行
    # （workspace-write），$DSH_HOME 之外的写法可能被拒；而周检是**非沙箱**进程，
    # 只有 DSH home 下那份它一定读得到。因此两处都尝试，写入时两处都写。
    $list = New-Object System.Collections.Generic.List[string]
    $list.Add((Join-Path (Get-DshHome) 'hooks\hooks-crash.log'))
    try { $list.Add((Join-Path (Get-HookStateDir) 'hooks-crash.log')) } catch { }
    return $list
}

function Write-HookCrash {
    # hook 崩溃可见化（2026-10-13 加；来源 ~/.dsh/_ref-qoder542/.../scripts/hook-crash-guard.js）。
    #
    # 为什么需要它：心跳写在**脚本开头**，脚本中途崩了心跳照样新鲜 ——
    # 周检按心跳判"机制在线"就是**假绿**（"脚本崩了"与"机制没跑"分不开）。
    # 语义不变：崩溃**仍然放行**（原来各处的 catch { } 继续吞），这里只多留一条痕，
    # 交给 rules-weekly-audit 报出来。
    #
    # 必须 fail-safe：自身任何失败都不得抛出（否则"记录崩溃"本身变成一次崩溃）。
    param([string]$Name, $Error = $null)
    try {
        $msg = ''
        try {
            if ($null -ne $Error) {
                if ($Error -is [System.Management.Automation.ErrorRecord]) {
                    $msg = [string]$Error.Exception.Message
                    try { $msg = $msg + ' @ ' + [string]$Error.ScriptStackTrace } catch { }
                } else {
                    $msg = [string]$Error
                }
            }
        } catch { $msg = 'unprintable error' }
        $msg = ($msg -replace '\s+', ' ')
        if ($msg.Length -gt 600) { $msg = $msg.Substring(0, 600) }
        # JSON 行：周检用 ConvertFrom-Json 读回来，字段名与上游 hook-crash-guard 对齐（t/hook/kind/msg）。
        $line = (@{ t = (Get-Date).ToString('o'); hook = $Name; kind = 'crash'; msg = $msg } | ConvertTo-Json -Compress)
        foreach ($path in (Get-HookCrashCandidates)) {
            try {
                $dir = Split-Path -Parent $path
                if (-not (Test-Path -LiteralPath $dir)) {
                    New-Item -ItemType Directory -Path $dir -Force -ErrorAction Stop | Out-Null
                }
                Add-Content -LiteralPath $path -Value $line -Encoding utf8 -ErrorAction Stop
            } catch { }
        }
    } catch { }
}

function Get-HookCrashRecords {
    # 读近 N 天的崩溃记录（周检用）。两份候选都读，**同一行只算一次**（否则两边都写成功时计数翻倍）。
    # 解析不了的行走跳过（不是崩溃记录就当它不存在），读不到日志返回空数组。
    param([int]$Days = 7)
    $seen = @{}
    $out = New-Object System.Collections.Generic.List[object]
    $since = (Get-Date).AddDays(-1 * $Days)
    foreach ($path in (Get-HookCrashCandidates)) {
        try {
            if (-not (Test-Path -LiteralPath $path)) { continue }
            foreach ($line in @(Get-Content -LiteralPath $path -Encoding UTF8 -ErrorAction Stop)) {
                if ([string]::IsNullOrWhiteSpace($line)) { continue }
                if ($seen.ContainsKey($line)) { continue }
                $seen[$line] = $true
                $obj = $null
                try { $obj = $line | ConvertFrom-Json } catch { continue }
                try { if ([datetime]::Parse([string]$obj.t) -lt $since) { continue } } catch { }
                $out.Add($obj)
            }
        } catch { }
    }
    return $out.ToArray()
}

function Get-HeartbeatTail {
    # 取**最新**的那份心跳日志的最后 N 行；都不存在时返回 $null。
    #
    # 2026-09-30 修：原实现取"第一份存在的"，而候选顺序是
    #   ① $DSH_HOME\hooks\heartbeat.log（真实会话写不到那里 —— 部署级 sandbox 只允许写 workspace 与 TEMP）
    #   ② $env:TEMP\dsh-hooks\heartbeat.log（真实会话实际写在这里）
    # 于是它永远读到 ① 那份 2026-09-20 的陈旧文件，报出"心跳最后一行 9.5 天前"与
    # "只有自测进程的时间戳"两条假错 —— 而当时钩子明明在跑。
    # 读"最新"才是这个函数要回答的问题（"机制最后活动是什么时候"），
    # 而逐份比较 LastWriteTime 就够，不必假定哪一份是权威。
    param([int]$Count = 400)
    $best = $null
    $bestStamp = $null
    foreach ($path in (Get-HeartbeatCandidates)) {
        try {
            if (-not (Test-Path -LiteralPath $path)) { continue }
            $stamp = (Get-Item -LiteralPath $path -ErrorAction Stop).LastWriteTimeUtc
            if ($null -eq $bestStamp -or $stamp -gt $bestStamp) {
                $best = [pscustomobject]@{ Path = $path; Lines = @(Get-Content -LiteralPath $path -Tail $Count -ErrorAction Stop) }
                $bestStamp = $stamp
            }
        } catch { }
    }
    return $best
}

function Test-HookFlag {
    # 开关文件：存在则返回 $true。用于提供"怎么关"的出口。
    param([string]$Name)
    try {
        $file = Join-Path (Split-Path -Parent $PSCommandPath) $Name
        if (Test-Path -LiteralPath $file) { return $true }
    } catch { }
    try {
        $alt = Join-Path (Join-Path $env:USERPROFILE '.dsh\hooks') $Name
        if (Test-Path -LiteralPath $alt) { return $true }
    } catch { }
    return $false
}

function Get-DshHome {
    # 从 HOME 派生，不写死用户名；DSH 未导出 DSH_HOME 给 hook。
    if (-not [string]::IsNullOrWhiteSpace($env:DSH_HOME)) { return $env:DSH_HOME }
    return (Join-Path $env:USERPROFILE '.dsh')
}
