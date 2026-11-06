# Optional legacy PreToolUse bridge. Not enabled by this bundle.
# The authoritative decision code is shared with the native monotonic guard.
. (Join-Path $PSScriptRoot 'lib.ps1')
try {
    $payload = Get-HookInput
    if ($null -eq $payload) { exit 0 }
    Write-HookHeartbeat -Name 'pre-tool-guard' -Payload $payload
    $check = Join-Path (Get-DshHome) 'plugins/hook-guards-native/check.mjs'
    $node = Get-Command node -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $check -PathType Leaf)) { throw 'Shared guard checker missing' }
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $node.Source
    $info.ArgumentList.Add($check)
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        $null = $process.Start()
        $process.StandardInput.Write(($payload | ConvertTo-Json -Compress -Depth 30))
        $process.StandardInput.Close()
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(3000)) { $process.Kill(); throw 'Shared guard timed out' }
        if ($process.ExitCode -ne 0) { throw 'Shared guard failed; invocation denied' }
        $result = $output.GetAwaiter().GetResult() | ConvertFrom-Json
        if ($null -ne $result.reason -and -not [string]::IsNullOrWhiteSpace([string]$result.reason)) {
            Exit-HookBlock -Reason ([string]$result.reason)
        }
    } finally { $process.Dispose() }
    exit 0
} catch {
    Write-HookCrash -Name 'pre-tool-guard' -Error $_
    Exit-HookBlock -Reason '兼容守卫异常；本次调用未执行。先修复守卫，不得换通道绕过。'
}
