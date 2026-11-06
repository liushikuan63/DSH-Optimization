# Bundle self-check; -DshHome is retained as a compatibility parameter but never written.
[CmdletBinding()]
param([string]$DshHome='', [switch]$SelfTest)
$args_ = @((Join-Path $PSScriptRoot 'scripts/selfcheck.mjs'))
if ($SelfTest) { $args_ += '--tests' }
& node @args_
exit $LASTEXITCODE
