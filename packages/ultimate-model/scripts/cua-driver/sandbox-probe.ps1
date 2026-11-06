# cua-sandbox-probe：判断 CUA 能不能在"沙箱"里跑，以及什么时候必须回落真桌面
#
# 为什么存在（2026-10-02 用户定："CUA 可以操作沙箱；除非用户明确要求不用沙箱、
# 或必须真机测试，否则沙箱静默运行，不前台弹窗干扰用户其它操作"）：
#   这条要求要落地成机制，就先得能回答"CUA 当前有没有沙箱可用"。答不上来就只能
#   默默在用户真实桌面上操作——正好是用户要避免的那件事。
#
# **硬事实边界（别把这里当愿望清单读）**：
#   Cua Driver 是**宿主进程**，靠窗口句柄（pid/HWND）寻址，目标必须是它自己所在
#   Windows 会话里的窗口。所以它**看不到** Windows 沙盒 / 虚拟机 / 容器里跑的程序。
#   要在沙箱里做 CUA，必须在**沙箱内部**再起一套 DSH + Cua Driver，那是另一条重路径。
#   本探针因此只回答三件可验证的事：
#     ① 本机 Windows 沙盒功能装没装；
#     ② 宿主侧有没有可用的沙箱入口（可执行 / 已配置的 .wsb）；
#     ③ 结论：沙箱路径可用？不可用时回落真桌面的**理由**写清楚，别默默回落。
#
# 退出码：0 = 沙箱路径可用；2 = 不可用（必须回落真桌面静默路径）；其它非零 = 探针自身抛错。
# 输出：一行 JSON（便于被规则、脚本、agent 直接读）。

[CmdletBinding()]
param(
    # 自测注入点：把 InstallState 当成外部给定值，避免自测必须真的启用系统功能。
    # 生产运行不要传这个参数——那时它读的就是真值。
    [int]$OverrideInstallState,
    # 自测注入点：假装沙箱可执行文件存在。
    [switch]$AssumeExecutable
)

$ErrorActionPreference = 'Stop'

function Write-Verdict {
    param([hashtable]$Data)
    $Data | ConvertTo-Json -Depth 5 -Compress
    if ($Data.usable) { exit 0 } else { exit 2 }
}

# ── ① Windows 沙盒功能状态 ──────────────────────────────────────────────
# 为什么不直接用 Get-WindowsOptionalFeature：它要管理员权限（实测报
# "请求的操作需要提升"），而体检/探针必须能在普通权限下跑完。
# Win32_OptionalFeature 的 InstallState 不需要提权：
#   1 = Enabled，2 = Disabled，3 = Absent，4 = Unknown。
$installState = $null
$featureSource = 'cim:Win32_OptionalFeature'
if ($PSBoundParameters.ContainsKey('OverrideInstallState')) {
    $installState = [int]$OverrideInstallState
    $featureSource = 'override:-OverrideInstallState'
} else {
    try {
        $f = Get-CimInstance -ClassName Win32_OptionalFeature -Filter "Name='Containers-DisposableClientVM'" -ErrorAction Stop
        if ($null -ne $f) { $installState = [int]$f.InstallState }
    } catch {
        $featureSource = "cim-failed: $($_.Exception.Message)"
    }
}

# ── ② 宿主侧沙箱入口 ────────────────────────────────────────────────────
$exe = Join-Path $env:SystemRoot 'System32\WindowsSandbox.exe'
$exeExists = (Test-Path -LiteralPath $exe -PathType Leaf)
if ($AssumeExecutable) { $exeExists = $true }

$wsbFiles = @()
try {
    $wsbFiles = @(Get-ChildItem -LiteralPath $env:USERPROFILE -Filter '*.wsb' -File -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName)
} catch { }

# ── ③ 结论 ──────────────────────────────────────────────────────────────
# 判据（两条都满足才算"沙箱路径可用"）：
#   功能已启用（InstallState = 1）**且** 宿主侧有可执行入口。
#   只满足一条都不算：装了功能没有入口进不去，有入口没功能跑不起来。
$featureEnabled = ($installState -eq 1)
$usable = ($featureEnabled -and $exeExists)

$reason = $null
if ($featureEnabled -and -not $exeExists) {
    $reason = '功能状态为已启用，但宿主找不到 WindowsSandbox.exe —— 入口缺失，按不可用处理'
} elseif ($installState -eq 2) {
    $reason = 'Windows 沙盒功能未启用（InstallState=2）。启用需管理员权限并重启，属系统级改动，必须先经用户确认'
} elseif ($null -eq $installState) {
    $reason = "读不到沙盒功能状态（$featureSource）—— 判不出就按不可用处理，不猜"
} elseif ($installState -eq 3) {
    $reason = '当前 Windows 版本不含 Windows 沙盒（InstallState=3），本机无法走沙箱路径'
} elseif (-not $usable) {
    $reason = '沙箱路径不可用'
}

Write-Verdict -Data @{
    schema        = 'cua-sandbox-probe/1'
    probedAt      = (Get-Date).ToString('o')
    # 关键边界：即使沙箱功能可用，宿主 Cua Driver 也**到不了**沙箱里的程序。
    # 真正要在沙箱内做 CUA，必须在沙箱内部另起一套 DSH + Cua Driver。
    driverReachability = 'host-only'
    featureInstallState = $installState
    featureSource     = $featureSource
    sandboxExecutable  = $exe
    sandboxExecutableExists = $exeExists
    wsbConfigs        = $wsbFiles
    usable            = $usable
    fallback          = $(if ($usable) { $null } else { 'real-desktop-silent' })
    fallbackReason    = $reason
    silentPathRules   = @(
        'window 目标（pid + window_id 或 target:{kind:"window",...}）',
        'delivery_mode 保持默认 background',
        '禁止 desktop 目标 / bring_to_front / foreground 投递（宿主 hook-guards-native 会 deny）',
        '起应用默认 start_minimized，避免抢用户当前窗口'
    )
}