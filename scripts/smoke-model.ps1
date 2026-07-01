$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$VenvPython = Join-Path $RepoRoot "apps\api\.venv\Scripts\python.exe"
$ModelPath = Join-Path $RepoRoot "model-artifacts\best_model_auc.keras"
$SmokeScript = Join-Path $RepoRoot "apps\api\python\smoke_model.py"

if (!(Test-Path -Path $VenvPython)) {
  throw "Python virtual environment was not found. Run .\scripts\setup.ps1 first."
}

if (!(Test-Path -Path $ModelPath)) {
  throw "Model weights were not found at model-artifacts\best_model_auc.keras."
}

& $VenvPython $SmokeScript --model $ModelPath --heatmap
if ($LASTEXITCODE -ne 0) {
  throw "Model smoke test failed."
}
