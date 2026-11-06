# Pure shared parser: no IO, hooks and tests use the same scope rules.
function Get-ScopedContinuationItems {
    param([string[]]$Lines, [string]$SessionId, [string]$Cwd)
    $scopeSession = ''; $scopeCwd = ''; $invalidScope = $false
    foreach ($line in $Lines) {
        if ($line -match '^\s*#{1,6}\s') {
            $scopeSession = ''; $scopeCwd = ''; $invalidScope = $false
        }
        # Metadata only, never parse a task's prose as authorization/scope.
        if ($line -match '^\s*(?:<!--\s*)?scope-(?:session|cwd):') {
            foreach ($match in [regex]::Matches($line, 'scope-(session|cwd):\s*(.*?)(?=;\s*scope-|-->|$)')) {
                $value = $match.Groups[2].Value.Trim().Trim('`', '"')
                if ([string]::IsNullOrWhiteSpace($value)) { $invalidScope = $true }
                if ($match.Groups[1].Value -eq 'session') { $scopeSession = $value } else { $scopeCwd = $value }
            }
        }
        if ($line -notmatch '^\s*[-*]\s*\[ \]\s*\S') { continue }
        # An unscoped shared item is not authority to continue every session.
        if ($invalidScope -or ($scopeSession -eq '' -and $scopeCwd -eq '')) { continue }
        if ($scopeSession -ne '' -and $scopeSession -ne $SessionId) { continue }
        if ($scopeCwd -ne '') {
            $want = $scopeCwd.Replace('\', '/').TrimEnd('/').ToLowerInvariant()
            $actual = $Cwd.Replace('\', '/').TrimEnd('/').ToLowerInvariant()
            if ($want -ne $actual) { continue }
        }
        [pscustomobject]@{
            Text = $line; Session = $scopeSession; Cwd = $scopeCwd
            IsBlocked = ($line -match '^\s*[-*]\s*\[ \]\s*\[[^\]]*阻塞[^\]]*\]')
        }
    }
}
function Get-ContinuationStamp {
    param([object[]]$Items)
    # Only this scope's remaining state is progress; touching another section is not.
    $text = (@($Items | ForEach-Object { $_.Text }) -join "`n")
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text))).ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Get-HookRuleReminder {
    param([string]$RulesPath)
    $text = [IO.File]::ReadAllText($RulesPath, [Text.Encoding]::UTF8)
    $matches = [regex]::Matches($text, '(?s)<!-- dsh:reminder:start -->\s*(.*?)\s*<!-- dsh:reminder:end -->')
    if ($matches.Count -ne 1) { throw 'Rules must contain exactly one reminder block' }
    $body = $matches[0].Groups[1].Value.Trim()
    if ([string]::IsNullOrWhiteSpace($body)) { throw 'Empty rule reminder block' }
    return $body
}
