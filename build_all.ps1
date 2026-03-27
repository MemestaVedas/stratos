$ErrorActionPreference = "Stop"
$ProjectsRoot = "d:\Kushal\projects\stratos"

Write-Host "============================="
Write-Host "Building Stratos Platform"
Write-Host "============================="

# Function to install and build a Node project
function Build-NodeProject {
    param([string]$Path, [string]$Name)
    Write-Host "`n[$Name] Installing dependencies..." -ForegroundColor Cyan
    Push-Location $Path
    try {
        npm install
        if (Test-Path "tsconfig.json") {
            Write-Host "[$Name] Building Typescript..." -ForegroundColor Cyan
            npm run build
        } elseif (Test-Path "next.config.js" -or Test-Path "next.config.mjs") {
            Write-Host "[$Name] Building Next.js..." -ForegroundColor Cyan
            npm run build
        }
        Write-Host "[$Name] ✅ Success" -ForegroundColor Green
    } catch {
        Write-Host "[$Name] ❌ Failed: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

# Function to install Python project
function Build-PythonProject {
    param([string]$Path, [string]$Name)
    Write-Host "`n[$Name] Installing Python dependencies..." -ForegroundColor Cyan
    Push-Location $Path
    try {
        pip install -r requirements.txt
        Write-Host "[$Name] ✅ Success" -ForegroundColor Green
    } catch {
        Write-Host "[$Name] ❌ Failed: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

# Backends
Build-NodeProject "$ProjectsRoot\meridian\backend" "Meridian Backend"
Build-NodeProject "$ProjectsRoot\vektor\backend" "Vektor Backend"
Build-NodeProject "$ProjectsRoot\aurum\backend" "Aurum Backend"

# Workers
Build-NodeProject "$ProjectsRoot\meridian\workers" "Meridian Workers"

# Frontends
# Note: Next.js builds might take a while and fail if there are TS errors. 
# For now, we'll just run npm install and tsc --noEmit to check for typescript errors.
function TypeCheck-NodeProject {
    param([string]$Path, [string]$Name)
    Write-Host "`n[$Name] Installing dependencies & Typechecking..." -ForegroundColor Cyan
    Push-Location $Path
    try {
        npm install
        npx tsc --noEmit
        Write-Host "[$Name] ✅ Success" -ForegroundColor Green
    } catch {
        Write-Host "[$Name] ❌ Failed: $_" -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

TypeCheck-NodeProject "$ProjectsRoot\meridian\frontend" "Meridian Frontend"
TypeCheck-NodeProject "$ProjectsRoot\vektor\frontend" "Vektor Frontend"
TypeCheck-NodeProject "$ProjectsRoot\aurum\frontend" "Aurum Frontend"

# Python Services
Build-PythonProject "$ProjectsRoot\aurum\ml-service" "Aurum ML Service"
Build-PythonProject "$ProjectsRoot\vektor\ingestion-service" "Vektor Ingestion Service"

Write-Host "`n============================="
Write-Host "Build process completed."
Write-Host "============================="
