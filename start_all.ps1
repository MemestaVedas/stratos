$ErrorActionPreference = "Stop"
$ProjectsRoot = "d:\Kushal\projects\stratos"

Write-Host "============================="
Write-Host "Starting Stratos Platform"
Write-Host "============================="

# 1. Start Infrastructure (Background)
Write-Host "Starting PostgreSQL and Redis via Docker Compose..."
Start-Process "docker-compose" -ArgumentList "up -d" -NoNewWindow -Wait

Start-Sleep -Seconds 2

# 2. Start Services (each in a new PowerShell window)
Write-Host "Booting up services in separate terminal windows..."

# Function to launch a Node service
function Start-NodeService {
    param([string]$Path, [string]$Title)
    Start-Process "powershell" -ArgumentList "-NoExit -Command `"Set-Location '$Path'; `$host.ui.RawUI.WindowTitle = '$Title'; npm run dev`""
}

# Function to launch a Python service
function Start-PythonService {
    param([string]$Path, [string]$Title)
    Start-Process "powershell" -ArgumentList "-NoExit -Command `"Set-Location '$Path'; `$host.ui.RawUI.WindowTitle = '$Title'; python main.py`""
}

# Backends
Start-NodeService "$ProjectsRoot\meridian\backend" "Meridian API (Port 3000)"
Start-NodeService "$ProjectsRoot\vektor\backend" "Vektor API (Port 3001)"
Start-NodeService "$ProjectsRoot\aurum\backend" "Aurum API (Port 3002)"

# Python ML & Ingestion Services
Start-PythonService "$ProjectsRoot\aurum\ml-service" "Aurum ML (Port 8001)"
Start-PythonService "$ProjectsRoot\vektor\ingestion-service" "Vektor Ingestion (Port 8002)"

# Workers
Start-NodeService "$ProjectsRoot\meridian\workers" "Meridian Workers"

# Frontends
Start-NodeService "$ProjectsRoot\meridian\frontend" "Meridian Dashboard"
Start-NodeService "$ProjectsRoot\vektor\frontend" "Vektor Dashboard"
Start-NodeService "$ProjectsRoot\aurum\frontend" "Aurum Dashboard"

Write-Host "`nAll 9 services have been launched! Look for 9 new PowerShell windows."
Write-Host "To shut down everything later, you can close those windows and run 'docker-compose down'."
