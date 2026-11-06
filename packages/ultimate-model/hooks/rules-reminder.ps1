# UserPromptSubmit: derive the stable summary from the sole rule source.
. (Join-Path $PSScriptRoot 'lib.ps1')
try {
    $input_ = Get-HookInput
    $event = Get-Field $input_ 'hook_event_name'
    if ([string]::IsNullOrWhiteSpace($event)) { $event = 'UserPromptSubmit' }
    Write-HookHeartbeat -Name 'rules-reminder' -Payload $input_
    if (Test-HookFlag -Name 'rules-reminder.off') { exit 0 }
    $body = Get-HookRuleReminder -RulesPath (Join-Path (Get-DshHome) 'AGENTS.md')
    Write-HookContext -EventName $event -Text ("<每轮纪律：来自用户级 AGENTS.md，不覆盖系统/开发者授权边界>`n" + $body + "`n</每轮纪律>")
    exit 0
} catch {
    Write-HookCrash -Name 'rules-reminder' -Error $_
    exit 0
}
