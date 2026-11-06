# Compatibility wrapper: preview only, never silently installs into home.
[CmdletBinding()]
param([string]$DshHome='', [switch]$DryRun, [switch]$WithMcp, [switch]$Force, [switch]$ForceRules)
if ($WithMcp -or $Force -or $ForceRules) { Write-Error 'Legacy overwrite/MCP flags are disabled; use the official plugin manager and explicit MCP setup.'; exit 2 }
& node (Join-Path $PSScriptRoot 'install.mjs') --dry-run
exit $LASTEXITCODE
