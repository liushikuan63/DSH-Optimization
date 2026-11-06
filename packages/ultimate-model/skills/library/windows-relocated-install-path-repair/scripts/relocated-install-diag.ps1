param(
  [string]$AppName = '',          # process / service name fragment, e.g. wetype
  [string]$Vendor = '',           # registry vendor key, e.g. Tencent
  [string]$OldPath = '',          # stale path to hunt, e.g. C:\Program Files\Tencent\WeType
  [string]$NewPath = '',          # where the files actually live now
  [int]$Days = 14,
  [int]$Max = 12
)
$ErrorActionPreference = 'SilentlyContinue'
function Sec($t) { Write-Output ''; Write-Output "===== $t =====" }

# Extract the executable a registry value refers to WITHOUT splitting on spaces.
# Splitting on space turns "D:\Program Files\x.exe" into "D:\Program" and fakes thousands of misses.
function Get-ExeRef([string]$v) {
  if (-not $v) { return '' }
  $v = $v.Trim()
  $m = [regex]::Match($v, '^"([^"]+)"')
  if ($m.Success) { return $m.Groups[1].Value }
  $m = [regex]::Match($v, '^(.*?\.(exe|com))(\s|$)', 'IgnoreCase')
  if ($m.Success) { return $m.Groups[1].Value }
  return $v
}

$appPat = if ($AppName) { $AppName } elseif ($Vendor) { $Vendor } else { '' }
$vendorPat = if ($Vendor) { $Vendor } elseif ($AppName) { $AppName } else { '' }
# An empty pattern makes -like "**" match EVERYTHING, so needle-driven sections are skipped
# outright instead of reporting a plausible-looking number.
$needle = if ($OldPath) { $OldPath } elseif ($vendorPat) { $vendorPat } else { '' }
$namePat = if ($appPat) { $appPat } else { 'ZZZNOMATCHZZZ' }
$filtered = [bool]($appPat -or $needle)

# ---------- 1. which pieces are running, and in which session ----------
Sec 'PROCESSES (engine in session 1 vs service in session 0 is the tell)'
$procs = @(Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -like "*$namePat*") -or ($needle -and $_.CommandLine -like "*$needle*") })
Write-Output ("PROC_MATCHES=" + $procs.Count)
foreach ($p in ($procs | Select-Object -First $Max)) {
  $ip = [string]$p.ExecutablePath
  $ok = if ($ip -and (Test-Path -LiteralPath $ip)) { 'OK' } elseif (-not $ip) { 'n/a' } else { 'MISSING' }
  Write-Output ($p.Name + ' | pid=' + $p.ProcessId + ' | sess=' + $p.SessionId + ' | ' + $ok + ' | ' + $ip)
}

# ---------- 2. services whose ImagePath file is gone ----------
Sec 'SERVICES WITH IMAGEPATH POINTING AT A MISSING FILE'
$svcAll = @(Get-CimInstance Win32_Service)
$bad = @($svcAll | ForEach-Object {
    $e = Get-ExeRef $_.PathName
    if ($e -match '^[a-zA-Z]:\\' -and $e -match '\.(exe|com)$' -and -not (Test-Path -LiteralPath $e)) {
      [pscustomobject]@{ N = $_.Name; S = $_.State; M = $_.StartMode; P = $e; Q = ($_.PathName -match '^"') }
    }
  })
Write-Output ("BROKEN_SERVICE_IMAGEPATH=" + $bad.Count + '  (of ' + $svcAll.Count + ' services)')
foreach ($b in ($bad | Select-Object -First $Max)) {
  Write-Output ($b.N + ' | ' + $b.S + '/' + $b.M + ' | quoted=' + $b.Q + ' | ' + $b.P)
}
Write-Output '--- services matching this app ---'
$svcHit = @($svcAll | Where-Object {
    $_.Name -like "*$namePat*" -or $_.DisplayName -like "*$namePat*" -or ($needle -and $_.PathName -like "*$needle*") })
Write-Output ('SVC_ROWS=' + $svcHit.Count)
foreach ($s in ($svcHit | Select-Object -First $Max)) {
  $e = Get-ExeRef $s.PathName
  $ok = if (-not $e) { 'no-imagepath' } elseif (Test-Path -LiteralPath $e) { 'exists' } else { 'MISSING' }
  Write-Output ($s.Name + ' | ' + $s.State + '/' + $s.StartMode + ' | target=' + $ok + ' | quoted=' + ($s.PathName -match '^"'))
  Write-Output ('    ' + $s.PathName)
}

# ---------- 3. SCM failure events, provider filter cross-checked ----------
Sec 'SERVICE CONTROL MANAGER EVENTS'
$since = (Get-Date).AddDays(-$Days)
$ids = 7000, 7001, 7009, 7023, 7034, 1068
$withP = @(Get-WinEvent -FilterHashtable @{LogName = 'System'; ProviderName = 'Service Control Manager'; Id = $ids; StartTime = $since} -MaxEvents 500)
$noP = @(Get-WinEvent -FilterHashtable @{LogName = 'System'; Id = $ids; StartTime = $since} -MaxEvents 500)
Write-Output ("SCM_WITH_PROVIDER_FILTER=" + $withP.Count + ' | SCM_WITHOUT=' + $noP.Count)
if ($withP.Count -eq 0 -and $noP.Count -gt 0) {
  Write-Output 'WARN: provider-name filter gave a false negative - match on message text instead'
}
$rows = @($noP | Where-Object { ($needle -and $_.Message -like "*$needle*") -or ($appPat -and $_.Message -like "*$appPat*") })
if ($filtered) { Write-Output ('SCM_EVENTS_MATCHING_APP=' + $rows.Count) }
else { Write-Output 'SCM_EVENTS_MATCHING_APP=SKIPPED-NO-PATTERN (pass -AppName or -OldPath)' }
foreach ($e in ($rows | Select-Object -First $Max)) {
  Write-Output ($e.TimeCreated.ToString('yyyy-MM-dd HH:mm') + ' | id=' + $e.Id)
}
Write-Output '--- id=7000 in window, any service (context, message truncated) ---'
foreach ($e in @($noP | Where-Object { $_.Id -eq 7000 } | Select-Object -First $Max)) {
  $m = ($e.Message -replace '\s+', ' ')
  if ($m.Length -gt 110) { $m = $m.Substring(0, 110) }
  Write-Output ($e.TimeCreated.ToString('yyyy-MM-dd HH:mm') + ' | ' + $m)
}

# ---------- 4. registry values still naming the stale path ----------
Sec 'REGISTRY VALUES NAMING THE STALE PATH'
$roots = @('HKLM:\SYSTEM\CurrentControlSet\Services',
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')
foreach ($v in (@($vendorPat, $appPat) | Where-Object { $_ -and $_ -ne 'ZZZNOMATCHZZZ' } | Select-Object -Unique)) {
  $roots += @(('HKLM:\SOFTWARE\' + $v), ('HKLM:\SOFTWARE\WOW6432Node\' + $v), ('HKCU:\SOFTWARE\' + $v))
}
$hits = New-Object System.Collections.ArrayList
if (-not $needle) {
  $regLine = 'REG_VALUES_NAMING_STALE_PATH=SKIPPED-NO-NEEDLE (pass -OldPath or -Vendor)'
} else {
  foreach ($base in ($roots | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $base)) { continue }
    foreach ($k in @(Get-ChildItem -LiteralPath $base -Recurse)) {
      $p = Get-ItemProperty -LiteralPath $k.PSPath
      foreach ($n in $p.PSObject.Properties.Name) {
        if ($n -like 'PS_*') { continue }
        $val = [string]$p.$n
        if ($val -like "*$needle*") {
          [void]$hits.Add([pscustomobject]@{
              K = ($k.Name -replace '^HKEY_LOCAL_MACHINE', 'HKLM' -replace '^HKEY_CURRENT_USER', 'HKCU')
              V = $n; D = $val })
        }
      }
    }
  }
  $regLine = ('REG_VALUES_NAMING_STALE_PATH=' + $hits.Count + ' | needle=' + $needle)
}
Write-Output $regLine
foreach ($h in ($hits | Select-Object -First $Max)) {
  $d = ($h.D -replace '\s+', ' ')
  if ($d.Length -gt 120) { $d = $d.Substring(0, 120) }
  Write-Output ($h.K + ' || ' + $h.V + ' || ' + $d)
}

# ---------- 5. where the files actually are ----------
if ($NewPath) {
  Sec 'THE NEW LOCATION'
  foreach ($cand in @($NewPath, (Split-Path -Parent $NewPath))) {
    if (Test-Path -LiteralPath $cand) {
      $exe = @(Get-ChildItem -LiteralPath $cand -Filter '*.exe' -File)
      Write-Output ('EXISTS ' + $cand + ' | exe=' + $exe.Count)
      foreach ($x in ($exe | Select-Object -First $Max)) { Write-Output ('  ' + $x.Name + ' | ' + $x.LastWriteTime.ToString('yyyy-MM-dd')) }
    } else { Write-Output ('ABSENT ' + $cand) }
  }
}

# ---------- 6. uninstall entries whose recorded paths are gone ----------
Sec 'UNINSTALL ENTRIES WITH MISSING PATHS'
$uhits = New-Object System.Collections.ArrayList
foreach ($r in ($roots | Where-Object { $_ -like '*\Uninstall' })) {
  foreach ($k in Get-ChildItem -LiteralPath $r) {
    $p = Get-ItemProperty -LiteralPath $k.PSPath
    $checks = @()
    $il = [string]$p.InstallLocation
    if ($il -and $il -match '^[a-zA-Z]:\\') { $checks += , @{ F = 'InstallLocation'; V = $il.Trim('"') } }
    foreach ($f in 'UninstallString', 'DisplayIcon') {
      $v = Get-ExeRef ([string]$p.$f)
      if ($v -match '^[a-zA-Z]:\\' -and $v -match '\.(exe|com|ico)$') { $checks += , @{ F = $f; V = $v } }
    }
    foreach ($c in $checks) {
      if (-not (Test-Path -LiteralPath $c.V)) { [void]$uhits.Add([pscustomobject]@{ N = $p.DisplayName; F = $c.F; V = $c.V }) }
    }
  }
}
Write-Output ("MISSING_UNINSTALL_PATHS=" + $uhits.Count + '  (a triple-digit number means the extractor is broken, not the machine)')
foreach ($u in ($uhits | Where-Object { -not $filtered -or ($appPat -and $_.N -like "*$appPat*") -or ($vendorPat -and $_.N -like "*$vendorPat*") } | Select-Object -First $Max)) {
  Write-Output ($u.N + ' || ' + $u.F + ' || ' + $u.V)
}

# ---------- 7. junctions: why some relocated apps survived ----------
Sec 'REPARSE POINTS (a surviving junction is why the neighbour app still works)'
foreach ($root in @('C:\Program Files', 'C:\Program Files (x86)', $env:APPDATA, ($env:LOCALAPPDATA + '\Programs'))) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  $links = @(Get-ChildItem -LiteralPath $root -Force -Directory -Depth 1 |
      Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
  Write-Output ('ROOT ' + $root + ' | links=' + $links.Count)
  foreach ($l in ($links | Select-Object -First $Max)) {
    $t = (Get-Item -LiteralPath $l.FullName).Target
    Write-Output ('  LINK ' + $l.FullName + ' -> ' + ($t -join ';'))
  }
}

Sec 'VERDICT'
Write-Output ("BROKEN_SERVICE_IMAGEPATH=" + $bad.Count)
if ($filtered) { Write-Output ('SCM_EVENTS_MATCHING_APP=' + $rows.Count) }
Write-Output $regLine
Write-Output ("PROC_MATCHES=" + $procs.Count)
Write-Output ("MISSING_UNINSTALL_PATHS=" + $uhits.Count)
