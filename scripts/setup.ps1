$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$ApiDir = Join-Path $RepoRoot "apps\api"
$VenvDir = Join-Path $ApiDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$RequirementsPath = Join-Path $ApiDir "python\requirements.txt"
$RequirementsMarker = Join-Path $VenvDir ".requirements.sha256"
$SmokeMarker = Join-Path $VenvDir ".model-smoke.sha256"
$EnvPath = Join-Path $RepoRoot ".env"
$ModelPath = Join-Path $RepoRoot "model-artifacts\best_model_auc.keras"
$SmokeScript = Join-Path $ApiDir "python\smoke_model.py"
$PreprocessingScript = Join-Path $ApiDir "python\preprocessing.py"
$GradcamScript = Join-Path $ApiDir "python\gradcam.py"
$PnpmVersion = "11.7.0"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-PythonCandidate {
  $candidates = @(
    @{ Command = "py"; Args = @("-3.12") },
    @{ Command = "py"; Args = @("-3.11") },
    @{ Command = "py"; Args = @("-3.10") },
    @{ Command = "python"; Args = @() }
  )

  foreach ($candidate in $candidates) {
    $commandInfo = Get-Command $candidate.Command -ErrorAction SilentlyContinue
    if ($null -eq $commandInfo) {
      continue
    }

    $versionScript = "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
    $pythonCommand = $candidate.Command
    $pythonArgs = @($candidate.Args)
    try {
      $output = & $pythonCommand @pythonArgs -c $versionScript 2>$null
    } catch {
      continue
    }

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($output)) {
      continue
    }

    $parts = "$output".Trim().Split(".")
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    if ($major -eq 3 -and $minor -ge 10 -and $minor -le 12) {
      return @{
        Command = $candidate.Command
        Args = $candidate.Args
        Version = "$output".Trim()
      }
    }
  }

  throw "Python 3.10, 3.11, or 3.12 was not found. Install Python 3.11 and rerun setup."
}

function Ensure-Node {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) {
    throw "Node.js was not found. Install Node.js 20+ and rerun setup."
  }

  $versionText = (& node --version).Trim().TrimStart("v")
  $major = [int]$versionText.Split(".")[0]
  if ($major -lt 20) {
    throw "Node.js 20+ is required. Found $versionText."
  }

  Write-Host "Node.js $versionText"
}

function Ensure-Pnpm {
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($null -ne $pnpm) {
    Write-Host "pnpm $((& pnpm --version).Trim())"
    return $pnpm.Source
  }

  $corepack = Get-Command corepack -ErrorAction SilentlyContinue
  if ($null -eq $corepack) {
    throw "pnpm was not found and Corepack is unavailable. Install pnpm $PnpmVersion and rerun setup."
  }

  Write-Host "pnpm not found; enabling Corepack and preparing pnpm $PnpmVersion"
  & corepack enable
  if ($LASTEXITCODE -ne 0) {
    throw "corepack enable failed."
  }

  & corepack prepare "pnpm@$PnpmVersion" --activate
  if ($LASTEXITCODE -ne 0) {
    throw "corepack prepare pnpm@$PnpmVersion failed."
  }

  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($null -eq $pnpm) {
    throw "pnpm is still unavailable after Corepack setup."
  }

  return $pnpm.Source
}

function Set-EnvValue($Path, $Key, $Value) {
  $line = "$Key=$Value"
  if (!(Test-Path -Path $Path)) {
    Set-Content -Path $Path -Value $line -Encoding UTF8
    return
  }

  $lines = @(Get-Content -Path $Path)
  $updated = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^$([regex]::Escape($Key))=") {
      $lines[$i] = $line
      $updated = $true
    }
  }

  if (!$updated) {
    $lines += $line
  }

  Set-Content -Path $Path -Value $lines -Encoding UTF8
}

function Test-PythonPackagesInstalled {
  & $VenvPython -m pip show tensorflow keras numpy pillow opencv-python-headless *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Python dependency packages are present."
    return $true
  }
  return $false
}

Set-Location -Path $RepoRoot

Write-Step "Checking system tools"
Ensure-Node
$PnpmPath = Ensure-Pnpm
$Python = Get-PythonCandidate
Write-Host "Python $($Python.Version)"

Write-Step "Installing JavaScript dependencies"
& $PnpmPath install
if ($LASTEXITCODE -ne 0) {
  throw "pnpm install failed."
}

Write-Step "Preparing Python virtual environment"
if (!(Test-Path -Path $VenvPython)) {
  $pythonCommand = $Python.Command
  $pythonArgs = @($Python.Args)
  & $pythonCommand @pythonArgs -m venv $VenvDir
  if ($LASTEXITCODE -ne 0) {
    throw "Python virtual environment creation failed."
  }
  Write-Host "Created $VenvDir"
} else {
  Write-Host "Using existing virtual environment at $VenvDir"
}

$requirementsHash = (Get-FileHash -Algorithm SHA256 -Path $RequirementsPath).Hash
$markerHash = if (Test-Path -Path $RequirementsMarker) { (Get-Content -Path $RequirementsMarker -Raw).Trim() } else { "" }
$packagesOk = $false
if (Test-Path -Path $VenvPython) {
  $packagesOk = Test-PythonPackagesInstalled
}

if ($requirementsHash -ne $markerHash -or !$packagesOk) {
  Write-Step "Installing Python dependencies"
  & $VenvPython -m pip install --upgrade pip
  if ($LASTEXITCODE -ne 0) {
    throw "pip upgrade failed."
  }

  & $VenvPython -m pip install -r $RequirementsPath
  if ($LASTEXITCODE -ne 0) {
    throw "Python dependency installation failed."
  }

  Set-Content -Path $RequirementsMarker -Value $requirementsHash -Encoding ASCII
} else {
  Write-Host "Python dependencies are already installed for the current requirements."
}

Write-Step "Writing local environment configuration"
Set-EnvValue $EnvPath "API_PORT" "4100"
Set-EnvValue $EnvPath "WEB_PORT" "5173"
Set-EnvValue $EnvPath "MODEL_PATH" "model-artifacts/best_model_auc.keras"
Set-EnvValue $EnvPath "PYTHON_BIN" "apps/api/.venv/Scripts/python.exe"
Set-EnvValue $EnvPath "MAX_UPLOAD_BYTES" "10485760"
Write-Host "Updated $EnvPath"

Write-Step "Checking private model weights"
if (!(Test-Path -Path $ModelPath)) {
  throw "Model weights are missing. Place the private best_model_auc.keras file at model-artifacts\best_model_auc.keras and rerun setup."
}
Write-Host "Found model weights at $ModelPath"

$modelItem = Get-Item -Path $ModelPath
$modelFingerprint = "$($modelItem.Length):$($modelItem.LastWriteTimeUtc.Ticks)"
$smokeHash = (Get-FileHash -Algorithm SHA256 -Path $SmokeScript).Hash
$preprocessingHash = (Get-FileHash -Algorithm SHA256 -Path $PreprocessingScript).Hash
$gradcamHash = (Get-FileHash -Algorithm SHA256 -Path $GradcamScript).Hash
$smokeFingerprint = "$requirementsHash`n$modelFingerprint`n$smokeHash`n$preprocessingHash`n$gradcamHash"
$previousSmokeFingerprint = if (Test-Path -Path $SmokeMarker) { (Get-Content -Path $SmokeMarker -Raw).Trim() } else { "" }

if ($smokeFingerprint -eq $previousSmokeFingerprint) {
  Write-Host "Model smoke test already passed for the current model and code."
} else {
  Write-Step "Running model smoke test"
  & $VenvPython $SmokeScript --model $ModelPath
  if ($LASTEXITCODE -ne 0) {
    throw "Model smoke test failed."
  }
  Set-Content -Path $SmokeMarker -Value $smokeFingerprint -Encoding ASCII
}

Write-Step "Setup complete"
Write-Host "Run pnpm dev and open http://localhost:5173"
