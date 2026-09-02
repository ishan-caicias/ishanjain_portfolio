# run-gaia-pipeline.ps1 — PF-10 C0: local runner for the Gaia dataset conversion pipeline.
#
# Purpose: run larger batches of gaia-dataset-pipeline.mjs from a local PowerShell session
# instead of through chat/agent tool calls — bulk decode/inspect work doesn't need to spend
# session tokens rendering hundreds of rows back into the conversation.
#
# Examples:
#   .\scripts\run-gaia-pipeline.ps1 -Dataset mwsc -Sample 10
#   .\scripts\run-gaia-pipeline.ps1 -Dataset mwsc -Names "Melotte_22,NGC_1912,NGC_2632"
#   .\scripts\run-gaia-pipeline.ps1 -Dataset hunt-reffert-2023 -Sample 20

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("mwsc", "hunt-reffert-2023")]
    [string]$Dataset,

    [string]$Names,

    [int]$Sample,

    [string]$Out
)

if (-not $Names -and -not $Sample) {
    Write-Error "Provide -Names `"Name1,Name2`" or -Sample N."
    exit 1
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    $nodeArgs = @("scripts/gaia-dataset-pipeline.mjs", "--dataset", $Dataset)
    if ($Names) { $nodeArgs += @("--names", $Names) }
    if ($Sample) { $nodeArgs += @("--sample", $Sample) }
    if ($Out) { $nodeArgs += @("--out", $Out) }

    node @nodeArgs
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

exit $exitCode
