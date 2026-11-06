[CmdletBinding()]
param(
  [string]$ScriptPath = (Join-Path $PSScriptRoot '../scripts/backup-file.ps1'),
  [switch]$IncludeMigrationApplyFixture
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$auditRoot = if ($env:SKILL_INDEX_TEST_TMPDIR) { $env:SKILL_INDEX_TEST_TMPDIR } else { [IO.Path]::GetTempPath() }
$scriptUnderTest = (Resolve-Path -LiteralPath $ScriptPath).ProviderPath
$fixtureRoot = Join-Path $auditRoot ('verification-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
$childPath = Join-Path $fixtureRoot 'invoke-backup.ps1'
$childSource = @'
param([Parameter(Mandatory=$true)][string]$RequestPath)
$ErrorActionPreference = 'Stop'
$request = Get-Content -LiteralPath $RequestPath -Raw | ConvertFrom-Json -AsHashtable
if ($request.ContainsKey('UserProfile')) { $env:USERPROFILE = $request.UserProfile }
if ($request.ContainsKey('FrozenDate')) {
  $global:FixtureFrozenDate = [DateTime]::Parse($request.FrozenDate, [Globalization.CultureInfo]::InvariantCulture)
  function global:Get-Date {
    param([string]$Format)
    if ($Format) { return $global:FixtureFrozenDate.ToString($Format) }
    return $global:FixtureFrozenDate
  }
}
$argumentsForScript = $request.Parameters
& $request.ScriptPath @argumentsForScript
exit $LASTEXITCODE
'@
[IO.File]::WriteAllText($childPath, $childSource, [Text.UTF8Encoding]::new($false))
$pwshPath = (Get-Command pwsh).Source
$results = [System.Collections.Generic.List[object]]::new()
$script:callNumber = 0
$frozenDate = [DateTime]'2026-11-05T12:00:00'

function Invoke-BackupFixture {
  param([hashtable]$Parameters, [string]$UserProfile)
  $script:callNumber++
  $request = @{ScriptPath=$scriptUnderTest; Parameters=$Parameters; FrozenDate=$frozenDate.ToString('o')}
  if ($UserProfile) { $request.UserProfile = $UserProfile }
  $requestPath = Join-Path $fixtureRoot ('request-' + $script:callNumber + '.json')
  $request | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $requestPath -Encoding utf8
  $captured = @(& $pwshPath -NoProfile -File $childPath -RequestPath $requestPath 2>&1)
  $code = $LASTEXITCODE
  $textOutput = @($captured | ForEach-Object ToString)
  $textOutput | Set-Content -LiteralPath (Join-Path $fixtureRoot ('output-' + $script:callNumber + '.txt')) -Encoding utf8
  return [pscustomobject]@{Exit=$code; Output=$textOutput}
}

function New-CaseDirectory {
  param([string]$Name)
  $pathForCase = Join-Path $fixtureRoot $Name
  New-Item -ItemType Directory -Path $pathForCase -Force | Out-Null
  return $pathForCase
}

function Get-BackupFiles {
  param([string]$BackupRoot)
  if (-not (Test-Path -LiteralPath $BackupRoot)) { return @() }
  return @(Get-ChildItem -LiteralPath $BackupRoot -Recurse -File | Where-Object { $_.Name -notmatch '\.lock$' })
}

function Save-CaseResult {
  param([string]$Name, [bool]$Passed, [object]$Evidence)
  $results.Add([pscustomobject]@{Name=$Name; Passed=$Passed; Evidence=$Evidence})
}

$collisionDirectory = New-CaseDirectory 'same-second'
$source = Join-Path $collisionDirectory 'source.txt'
$backups = Join-Path $collisionDirectory 'backups'
[IO.File]::WriteAllText($source, 'BEFORE-FIRST-EDIT')
$first = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Reason='repeat'}
[IO.File]::WriteAllText($source, 'BEFORE-SECOND-EDIT')
$second = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Reason='repeat'}
$files = @(Get-BackupFiles $backups)
$contents = @($files | ForEach-Object { [IO.File]::ReadAllText($_.FullName) })
Save-CaseResult 'frozen-same-second-distinct-snapshots' ($first.Exit -eq 0 -and $second.Exit -eq 0 -and $files.Count -eq 2 -and $contents -contains 'BEFORE-FIRST-EDIT' -and $contents -contains 'BEFORE-SECOND-EDIT') @{
  First=$first; Second=$second; Names=@($files.Name); Contents=$contents
}

$groupDirectory = New-CaseDirectory 'exact-source'
$sourceA = Join-Path $groupDirectory 'config.txt'
$sourceB = Join-Path $groupDirectory 'config.txt.bak-manual'
$backups = Join-Path $groupDirectory 'backups'
[IO.File]::WriteAllText($sourceA, 'SOURCE-A')
[IO.File]::WriteAllText($sourceB, 'SOURCE-B')
$backupBResult = Invoke-BackupFixture @{Path=$sourceB; BackupRoot=$backups; Reason='first'}
$backupB = @(Get-BackupFiles $backups)
if ($backupB.Count -eq 1) { [IO.File]::SetCreationTimeUtc($backupB[0].FullName, $frozenDate.ToUniversalTime().AddDays(-10)) }
$backupAResult = Invoke-BackupFixture @{Path=$sourceA; BackupRoot=$backups; Reason='second'}
$bStillPresent = $backupB.Count -eq 1 -and (Test-Path -LiteralPath $backupB[0].FullName)
Save-CaseResult 'similar-source-names-keep-independent-history' ($backupBResult.Exit -eq 0 -and $backupAResult.Exit -eq 0 -and $bStillPresent) @{
  First=$backupBResult; Second=$backupAResult; SourceBBackupRemains=$bStillPresent
}

$lockDirectory = New-CaseDirectory 'locked-delete'
$source = Join-Path $lockDirectory 'source.txt'
$backups = Join-Path $lockDirectory 'backups'
[IO.File]::WriteAllText($source, 'LOCKED-OLDER')
$oldResult = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Reason='older'}
$old = @(Get-BackupFiles $backups)[0]
[IO.File]::WriteAllText($source, 'NEWER')
$newResult = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Reason='newer'}
[IO.File]::SetCreationTimeUtc($old.FullName, $frozenDate.ToUniversalTime().AddDays(-10))
$heldStream = [IO.File]::Open($old.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
try {
  $lockedResult = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Sweep=$true; KeepCount=1}
  $oldExistsWhileLocked = Test-Path -LiteralPath $old.FullName
  Save-CaseResult 'failed-delete-returns-nonzero-and-keeps-file' ($oldResult.Exit -eq 0 -and $newResult.Exit -eq 0 -and $lockedResult.Exit -eq 1 -and $oldExistsWhileLocked) @{
    Result=$lockedResult; OldFileStillPresent=$oldExistsWhileLocked
  }
} finally { $heldStream.Dispose() }
$recoveryResult = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Sweep=$true; KeepCount=1}
Save-CaseResult 'released-lock-recovery-deletes-exactly-older-backup' ($recoveryResult.Exit -eq 0 -and -not (Test-Path -LiteralPath $old.FullName) -and @(Get-BackupFiles $backups).Count -eq 1) @{Result=$recoveryResult; Remaining=@((Get-BackupFiles $backups).Name)}

$ageDirectory = New-CaseDirectory 'keep-latest-aged'
$source = Join-Path $ageDirectory 'source.txt'
$backups = Join-Path $ageDirectory 'backups'
[IO.File]::WriteAllText($source, 'OLDER')
$oldResult = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Reason='older'}
$old = @(Get-BackupFiles $backups)[0]
[IO.File]::WriteAllText($source, 'LATEST-AGED')
$latestResult = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Reason='latest'}
$latest = @(Get-BackupFiles $backups | Where-Object FullName -ne $old.FullName)[0]
[IO.File]::SetCreationTimeUtc($old.FullName, $frozenDate.ToUniversalTime().AddDays(-20))
[IO.File]::SetCreationTimeUtc($latest.FullName, $frozenDate.ToUniversalTime().AddDays(-10))
$ageResult = Invoke-BackupFixture @{Path=$source; BackupRoot=$backups; Sweep=$true; MaxAgeDays=7}
Save-CaseResult 'latest-snapshot-protected-even-when-aged' ($oldResult.Exit -eq 0 -and $latestResult.Exit -eq 0 -and $ageResult.Exit -eq 0 -and (Test-Path -LiteralPath $latest.FullName) -and -not (Test-Path -LiteralPath $old.FullName)) @{Result=$ageResult; Remaining=@((Get-BackupFiles $backups).Name)}

$migrationDirectory = New-CaseDirectory 'migration-dry-run'
$fakeUserProfile = Join-Path $migrationDirectory 'fake-user'
$backups = Join-Path $fakeUserProfile '.dsh/backups'
$alreadyMirrored = Join-Path $backups 'E/fixture/already-mirrored.txt.bak-prior-20261101-000000'
$legacyBackup = Join-Path $fakeUserProfile '.dsh/legacy.txt.bak-prior-20261101-000000'
New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($alreadyMirrored)) -Force | Out-Null
[IO.File]::WriteAllText($alreadyMirrored, 'ALREADY-MIRRORED')
[IO.File]::WriteAllText($legacyBackup, 'LEGACY-FIXTURE')
$before = @(Get-ChildItem -LiteralPath $fakeUserProfile -Recurse -File | ForEach-Object { $_.FullName + ':' + (Get-FileHash -LiteralPath $_.FullName).Hash })
$dryResult = Invoke-BackupFixture @{Migrate=$true; DryRun=$true; BackupRoot=$backups} $fakeUserProfile
$after = @(Get-ChildItem -LiteralPath $fakeUserProfile -Recurse -File | ForEach-Object { $_.FullName + ':' + (Get-FileHash -LiteralPath $_.FullName).Hash })
$sameSnapshot = -not (Compare-Object $before $after)
$mentionsOwnMirror = ($dryResult.Output -join "`n").Contains('already-mirrored.txt')
Save-CaseResult 'migration-dry-run-excludes-output-root-and-writes-nothing' ($dryResult.Exit -eq 0 -and $sameSnapshot -and -not $mentionsOwnMirror -and ($dryResult.Output -join "`n").Contains('legacy.txt')) @{
  Result=$dryResult; FilesAndHashesUnchanged=$sameSnapshot; MentionedOwnMirror=$mentionsOwnMirror
}

if ($IncludeMigrationApplyFixture) {
  # This optional case moves only synthetic files inside the fresh verification directory.
  $migrationSource = $legacyBackup -replace '\.bak-.*$', ''
  $sourceDirectory = [IO.Path]::GetDirectoryName($migrationSource)
  $drive = $sourceDirectory.Substring(0,1)
  $tail = $sourceDirectory.Substring(2).TrimStart('\')
  $destination = Join-Path (Join-Path (Join-Path $backups $drive) $tail) ([IO.Path]::GetFileName($legacyBackup))
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($destination)) -Force | Out-Null
  [IO.File]::WriteAllText($destination, 'EXISTING-DESTINATION-MUST-REMAIN')
  $conflictResult = Invoke-BackupFixture @{Migrate=$true; BackupRoot=$backups} $fakeUserProfile
  Save-CaseResult 'migration-existing-destination-not-overwritten' ($conflictResult.Exit -eq 1 -and (Test-Path -LiteralPath $legacyBackup) -and [IO.File]::ReadAllText($destination) -eq 'EXISTING-DESTINATION-MUST-REMAIN') @{Result=$conflictResult; SourceRemains=(Test-Path -LiteralPath $legacyBackup)}
}

$failed = @($results | Where-Object { -not $_.Passed })
$summary = [pscustomobject]@{
  ScriptPath=$scriptUnderTest
  ScriptSha256=(Get-FileHash -LiteralPath $scriptUnderTest -Algorithm SHA256).Hash
  FixtureRoot=$fixtureRoot
  Passed=$failed.Count -eq 0
  Checks=$results.Count
  Failures=$failed.Count
  Results=@($results.ToArray())
}
$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $fixtureRoot 'result.json') -Encoding utf8
$summary | ConvertTo-Json -Depth 10
if ($failed.Count -gt 0) { exit 1 }
exit 0
