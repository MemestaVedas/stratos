$ErrorActionPreference = "Stop"
$ProjectsRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "============================="
Write-Host "Validating Stratos Platform"
Write-Host "============================="

function Invoke-NpmInstall {
    if (Test-Path "package-lock.json") {
        npm ci
    } else {
        npm install
    }
}

function Invoke-NpmScriptIfPresent {
    param([string]$ScriptName)

    $package = Get-Content -Raw "package.json" | ConvertFrom-Json
    if ($null -ne $package.scripts.$ScriptName) {
        npm run $ScriptName
    }
}

function Validate-NodeProject {
    param([string]$Path, [string]$Name)

    Write-Host "`n[$Name] Installing dependencies and running checks..." -ForegroundColor Cyan
    Push-Location $Path
    try {
        Invoke-NpmInstall
        Invoke-NpmScriptIfPresent "lint"
        Invoke-NpmScriptIfPresent "typecheck"
        $package = Get-Content -Raw "package.json" | ConvertFrom-Json
        if ($null -ne $package.scripts.test) {
            npm run test -- --passWithNoTests
        }
        Invoke-NpmScriptIfPresent "build"
        Write-Host "[$Name] Success" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Validate-PythonProject {
    param([string]$Path, [string]$Name)

    Write-Host "`n[$Name] Installing dependencies and running checks..." -ForegroundColor Cyan
    Push-Location $Path
    try {
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        python -m py_compile main.py
        Write-Host "[$Name] Success" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

$nodeProjects = @(
    @{ Path = "$ProjectsRoot\aurum\backend"; Name = "Aurum Backend" },
    @{ Path = "$ProjectsRoot\aurum\frontend"; Name = "Aurum Frontend" },
    @{ Path = "$ProjectsRoot\meridian\backend"; Name = "Meridian Backend" },
    @{ Path = "$ProjectsRoot\meridian\frontend"; Name = "Meridian Frontend" },
    @{ Path = "$ProjectsRoot\meridian\workers"; Name = "Meridian Workers" },
    @{ Path = "$ProjectsRoot\vektor\backend"; Name = "Vektor Backend" },
    @{ Path = "$ProjectsRoot\vektor\frontend"; Name = "Vektor Frontend" }
)

$pythonProjects = @(
    @{ Path = "$ProjectsRoot\aurum\ml-service"; Name = "Aurum ML Service" },
    @{ Path = "$ProjectsRoot\vektor\ingestion-service"; Name = "Vektor Ingestion Service" }
)

foreach ($project in $nodeProjects) {
    Validate-NodeProject $project.Path $project.Name
}

foreach ($project in $pythonProjects) {
    Validate-PythonProject $project.Path $project.Name
}

Write-Host "`n============================="
Write-Host "Validation completed successfully."
Write-Host "============================="
