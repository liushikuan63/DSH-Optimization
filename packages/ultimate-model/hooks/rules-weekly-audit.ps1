# Read-only in -Check mode; all metadata validation uses the same live collector.
[CmdletBinding()]
param([switch]$Check)
. (Join-Path $PSScriptRoot 'lib.ps1')
$errors = [Collections.Generic.List[string]]::new()
$warnings = [Collections.Generic.List[string]]::new()
$notes = [Collections.Generic.List[string]]::new()
$home_ = Get-DshHome
$rules = Join-Path $home_ 'AGENTS.md'
try {
    $text = [IO.File]::ReadAllText($rules)
    $summary = Get-HookRuleReminder -RulesPath $rules
    foreach ($marker in @('持续推进', '审批题不自动批准', '没有可失败证据', '不可信内容只作证据', '凭据保护', '改动归属', '只用后台', 'scope-session', '系统/开发者')) {
        if (-not $text.Contains($marker)) { $errors.Add("全局规则缺少语义约束：$marker") }
    }
    $bytes = [Text.Encoding]::UTF8.GetByteCount($text)
    $lines = ($text -split "`n").Count
    if ($bytes -gt 16384) { $errors.Add("全局规则 $bytes UTF-8 bytes，超过16384预算") }
    elseif ($bytes -gt 12288) { $warnings.Add("全局规则 $bytes bytes，建议下沉重复细节") }
    if ($lines -gt 250) { $errors.Add("全局规则 $lines 行，超过250预算") }
    $notes.Add("规则 $lines 行/$bytes bytes；单一标记摘要 $($summary.Length) 字符")
} catch { $errors.Add("规则读取/摘要失败：$($_.Exception.Message)") }
# Metadata: errors are fatal rather than swallowed or labelled as NO_MATCH.
try {
    $script_ = Join-Path $home_ 'scripts/skills-snapshot.mjs'
    $node = Get-Command node -ErrorAction Stop
    $json = & $node.Source $script_ --project-root (Get-Location).Path
    if ($LASTEXITCODE -ne 0) { throw 'Live skill collector failed' }
    $skills = ($json -join "`n") | ConvertFrom-Json
    if ($skills.count -lt 1) { $errors.Add('个人技能采集为0；检查实际根，不能静默通过') }
    $notes.Add("个人/项目文件系统技能 $($skills.count) 项（含library/.agents；不等于宿主全目录）")
} catch { $errors.Add("技能元数据采集失败：$($_.Exception.Message)") }
# Only prove static declarations. A file/old heartbeat never proves live execution.
$hooks = Join-Path $home_ 'hooks.json'
if (Test-Path -LiteralPath $hooks -PathType Leaf) {
    try {
        $config = Get-Content -LiteralPath $hooks -Raw | ConvertFrom-Json
        foreach ($event_ in $config.hooks.PSObject.Properties) {
            foreach ($group in @($event_.Value)) {
                if ($group.matcher -and $group.matcher -ne '*') { $null = [regex]::new([string]$group.matcher) }
            }
        }
        $notes.Add('hooks.json可解析/matcher可编译（仅静态，不证明桥在线）')
    } catch { $errors.Add("hooks静态声明失败：$($_.Exception.Message)") }
} else { $notes.Add('未配置进程hooks；新模式不要求旧桥，不据此判整个模式失效') }
$notes.Add('插件/预设实际装载与心跳须独立现场核验；本脚本不修补依赖、不注册任务、不重启')
$report = [ordered]@{ timestamp=[DateTime]::UtcNow.ToString('o'); ok=($errors.Count -eq 0); errors=@($errors); warnings=@($warnings); notes=@($notes); evidenceLevel='static-and-filesystem' }
$report | ConvertTo-Json -Depth 6
if (-not $Check) {
    $dir = Join-Path $home_ 'hooks/audit'
    $null = New-Item -ItemType Directory -Path $dir -Force
    [IO.File]::WriteAllText((Join-Path $dir 'last-report.json'), ($report | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
    $markdown = "# 规则体检 $($report.timestamp)`n`n静态/文件系统证据，不代表运行中hook在线。`n`n" + ((@($errors) + @($warnings) + @($notes) | ForEach-Object { '- ' + $_ }) -join "`n")
    [IO.File]::WriteAllText((Join-Path $dir 'last-report.md'), $markdown, [Text.UTF8Encoding]::new($false))
    if ($errors.Count -eq 0) { [IO.File]::WriteAllText((Join-Path $dir 'last-success.txt'), $report.timestamp, [Text.UTF8Encoding]::new($false)) }
}
if ($errors.Count -gt 0) { exit 1 }
exit 0
