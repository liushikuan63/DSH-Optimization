param([string]$PackRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
. (Join-Path $PackRoot 'hooks/queue-scope.ps1')
function Assert-Equal($Expected, $Actual, [string]$Name) {
    if ($Expected -cne $Actual) { throw "$Name expected=[$Expected] actual=[$Actual]" }
    Write-Output "PASS $Name"
}
$lines = @('# Queue', '- [ ] UNBOUND', '## A', '<!-- scope-session: A; scope-cwd: C:\Repo -->', '- [ ] ACTION_A', '- [ ] [阻塞] WAIT_A', '## B', '<!-- scope-session: B; scope-cwd: C:\Repo -->', '- [ ] ACTION_B')
$a = @(Get-ScopedContinuationItems -Lines $lines -SessionId 'A' -Cwd 'c:/repo/')
$b = @(Get-ScopedContinuationItems -Lines $lines -SessionId 'B' -Cwd 'C:\Repo')
Assert-Equal 2 $a.Count 'only A items'
Assert-Equal '- [ ] ACTION_A' $a[0].Text 'A context'
Assert-Equal $true $a[1].IsBlocked 'blocked excluded from continuation'
Assert-Equal 1 $b.Count 'only B items'
Assert-Equal 0 @(Get-ScopedContinuationItems -Lines $lines -SessionId 'A' -Cwd 'C:\Other').Count 'AND scope'
Assert-Equal 0 @(Get-ScopedContinuationItems -Lines @('- [ ] UNBOUND') -SessionId 'A' -Cwd 'C:\Repo').Count 'unscoped is not global authority'
Assert-Equal 0 @(Get-ScopedContinuationItems -Lines @('## X','<!-- scope-session: -->','- [ ] BAD') -SessionId 'A' -Cwd 'C:\Repo').Count 'malformed scope is not global'
$stampA = Get-ContinuationStamp -Items $a
$changedB = @($lines | ForEach-Object { $_.Replace('ACTION_B','B_CHANGED') })
Assert-Equal $stampA (Get-ContinuationStamp -Items @(Get-ScopedContinuationItems -Lines $changedB -SessionId 'A' -Cwd 'C:\Repo')) 'B edit cannot refresh A stall'
if ($stampA -eq (Get-ContinuationStamp -Items @($a | Select-Object -Skip 1))) { throw 'A state change must change stamp' }
Write-Output 'PASS A progress changes stamp'
# Wiring is a static assertion in addition to parser execution; not a claim of live hook delivery.
foreach ($name in @('session-start','stop-gate')) {
    $source = [IO.File]::ReadAllText((Join-Path $PackRoot "hooks/$name.ps1"))
    if (-not $source.Contains('Get-ScopedContinuationItems')) { throw "$name does not use shared parser" }
}
Write-Output 'PASS both hooks share parser'
$rules = Join-Path $PackRoot 'rules/AGENTS.md'
$body = Get-HookRuleReminder -RulesPath $rules
if ($body -notmatch '持续推进' -or $body -match '显式传 timeout') { throw 'reminder does not match current rule contract' }
Write-Output 'PASS rule reminder is extracted from truth source'
