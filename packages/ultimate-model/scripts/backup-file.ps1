<#
显式文件备份与保留：默认根为 USERPROFILE/.dsh/backups，可用 -BackupRoot 指定。
同源最多 3 份、超过 7 天的旧备份可清理，最近一份始终保留；仅处理可确认
归属的受支持备份名。未知历史文件保留，不因前缀相同就认作本源备份。
新备份名带独立 GUID，不覆盖旧回滚点。-Migrate 先快照并排除输出根，目标
已存在时保留两端并报错，不强制覆盖。迁移不自动触发，需要当前任务授权。
退出码：0 完成/预演；1 复制、删除或迁移失败；2 参数或不支持的路径。
#>
[CmdletBinding()]
param(
  [string]$Path,
  [string]$Reason = '',
  [switch]$Sweep,
  [switch]$Migrate,
  [switch]$DryRun,
  [string]$BackupRoot = (Join-Path $env:USERPROFILE '.dsh\backups'),
  [int]$KeepCount = 3,
  [int]$MaxAgeDays = 7
)
$ErrorActionPreference = 'Stop'
$script:Failures = 0

function Stop-Usage([string]$Message) { Write-Host ('[backup-file] ' + $Message); exit 2 }
if ($Sweep -and $Migrate) { Stop-Usage '-Sweep 与 -Migrate 不可同时使用' }
if ($KeepCount -lt 1 -or $MaxAgeDays -lt 0) { Stop-Usage 'KeepCount 至少 1，MaxAgeDays 不可为负' }
if ($Reason.Length -gt 64 -or $Reason -notmatch '^[\p{L}\p{N}_-]*$') { Stop-Usage 'Reason 仅支持最多64个字母、数字、汉字、下划线或连字符' }
try { $BackupRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($BackupRoot) }
catch { Stop-Usage 'BackupRoot 必须为有效文件系统路径' }

# Restrict the public path contract to Windows drive paths. UNC needs a
# separate share identity scheme and is refused before mkdir/copy/move.
function Get-MirrorDir([string]$SourceFile) {
  $full = [IO.Path]::GetFullPath($SourceFile)
  $volume = [IO.Path]::GetPathRoot($full)
  if ($volume -notmatch '^[A-Za-z]:[\\/]$') { throw '仅支持 Windows 盘符路径，UNC 未支持' }
  $directory = [IO.Path]::GetDirectoryName($full)
  $remainder = $directory.Substring($volume.Length)
  return Join-Path (Join-Path $BackupRoot $volume.Substring(0, 1)) $remainder
}
function Test-Inside([string]$Child, [string]$Parent) {
  $a = [IO.Path]::GetFullPath($Child).TrimEnd([IO.Path]::DirectorySeparatorChar)
  $b = [IO.Path]::GetFullPath($Parent).TrimEnd([IO.Path]::DirectorySeparatorChar)
  return $a.Equals($b, [StringComparison]::OrdinalIgnoreCase) -or $a.StartsWith($b + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)
}
# Anchoring the ENTIRE suffix prevents config.txt.bak-manual's backups from
# being treated as config.txt's. Legacy supported timestamp names still work;
# ambiguous/unknown suffixes are deliberately retained.
$suffixPattern = '(?:[\p{L}\p{N}_-]+-)?[0-9]{8}-[0-9]{6}(?:-[a-fA-F0-9]{32})?'
function Get-BackupGroup([string]$SourceFile) {
  $directory = Get-MirrorDir $SourceFile
  if (-not (Test-Path -LiteralPath $directory)) { return @() }
  $leaf = [IO.Path]::GetFileName($SourceFile)
  $pattern = '^' + [regex]::Escape($leaf) + '\.bak-' + $suffixPattern + '$'
  @(Get-ChildItem -LiteralPath $directory -File | Where-Object {
    $_.Name -match $pattern -and -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)
  } | Sort-Object @{Expression='CreationTimeUtc';Descending=$true}, @{Expression='Name';Descending=$true})
}
function Invoke-Retention([string]$SourceFile) {
  $all = @(Get-BackupGroup $SourceFile)
  if ($all.Count -eq 0) { return 0 }
  $cutoff = (Get-Date).AddDays(-$MaxAgeDays)
  $count = 0
  for ($index = 1; $index -lt $all.Count; $index++) {
    $backup = $all[$index]
    if ($index -lt $KeepCount -and $backup.CreationTime -ge $cutoff) { continue }
    if ($DryRun) { Write-Host ('  [dry] 会删除 ' + $backup.Name); $count++; continue }
    try {
      Remove-Item -LiteralPath $backup.FullName -Force
      Write-Host ('  删除 ' + $backup.Name)
      $count++
    } catch {
      $script:Failures++
      Write-Host ('  删除失败 ' + $backup.Name + '：' + $_.Exception.Message) -ForegroundColor Yellow
    }
  }
  return $count
}

try {
  if ($Migrate) {
    $roots = if ($Path) { @($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)) } else {
      @((Join-Path $env:USERPROFILE '.dsh'), (Join-Path $env:USERPROFILE 'Documents\deepseek-harness'))
    }
    # Discover once BEFORE moving. Never discover newly moved files on a
    # recursive streaming enumeration, and never migrate the mirror into itself.
    $candidates = @(
      foreach ($scanRoot in $roots) {
        if (-not (Test-Path -LiteralPath $scanRoot)) { continue }
        Get-ChildItem -LiteralPath $scanRoot -Recurse -File | Where-Object {
          -not (Test-Inside $_.FullName $BackupRoot) -and
          $_.Name -match ('^.+\.bak-' + $suffixPattern + '$') -and
          -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)
        }
      }
    )
    $moved = 0
    foreach ($backup in $candidates) {
      $sourceLeaf = [regex]::Match($backup.Name, '^(.+)\.bak-' + $suffixPattern + '$').Groups[1].Value
      $source = Join-Path $backup.DirectoryName $sourceLeaf
      $destinationDirectory = Get-MirrorDir $source
      $destination = Join-Path $destinationDirectory $backup.Name
      if ($DryRun) { Write-Host ('  [dry] ' + $backup.FullName + ' → ' + $destination); $moved++; continue }
      try {
        if (Test-Path -LiteralPath $destination) { throw '迁移目标已存在，保留源与目标' }
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        [IO.File]::Move($backup.FullName, $destination)
        $moved++
      } catch {
        $script:Failures++
        Write-Host ('  迁移失败：' + $backup.FullName + ' —— ' + $_.Exception.Message) -ForegroundColor Yellow
      }
    }
    if ($DryRun) { Write-Host "[dry] 合计会搬 $moved 份（镜像输出根已排除）" }
    else { Write-Host "合计搬入 $moved 份，失败 $script:Failures 份（根：$BackupRoot）" }
    if ($script:Failures) { exit 1 }; exit 0
  }
  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { Stop-Usage '需要存在的 -Path（或显式选择 -Migrate）' }
  $item = Get-Item -LiteralPath $Path
  if ($item.PSProvider.Name -ne 'FileSystem') { Stop-Usage '仅支持文件系统路径' }
  if ($item.PSIsContainer -and -not $Sweep) { Stop-Usage '目录只支持 -Sweep' }
  $Path = $item.FullName
  try { $destinationDirectory = Get-MirrorDir $Path } catch { Stop-Usage $_.Exception.Message }
  if (-not $Sweep) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $suffix = if ($Reason) { ".bak-$Reason-$stamp" } else { ".bak-$stamp" }
    $destination = Join-Path $destinationDirectory ($item.Name + $suffix + '-' + [guid]::NewGuid().ToString('N'))
    if ($DryRun) { Write-Host "[dry] 会建备份 → $destination" }
    else {
      New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
      [IO.File]::Copy($Path, $destination, $false)
      [IO.File]::SetCreationTimeUtc($destination, [DateTime]::UtcNow)
      Write-Host "已备份 → $destination"
    }
  }
  Write-Host "保留策略：同源最多 $KeepCount 份 / 删超 $MaxAgeDays 天 / 最近1份永不删（根：$BackupRoot）"
  $total = 0
  if ($item.PSIsContainer) {
    $sources = @(Get-ChildItem -LiteralPath $Path -Recurse -File | Where-Object { $_.Name -notmatch '\.bak-' })
    foreach ($source in $sources) { $total += Invoke-Retention $source.FullName }
  } else { $total = Invoke-Retention $Path }
  if ($DryRun) { Write-Host "[dry] 合计会删 $total 份" }
  else { Write-Host "合计删除 $total 份，失败 $script:Failures 份" }
  if ($script:Failures) { exit 1 }; exit 0
} catch {
  Write-Host ('[backup-file] 操作失败：' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
