$ErrorActionPreference = "Continue"

Write-Host "Installing missing TypeScript definitions..." -ForegroundColor Cyan

Push-Location "d:\Kushal\projects\stratos\aurum\backend"
npm install --save-dev @types/express @types/node @types/uuid @types/cors @types/pg
Pop-Location

Push-Location "d:\Kushal\projects\stratos\meridian\backend"
npm install --save-dev @types/express @types/node @types/uuid @types/cors @types/pg
Pop-Location

Push-Location "d:\Kushal\projects\stratos\vektor\backend"
npm install --save-dev @types/express @types/node @types/uuid @types/cors @types/pg
Pop-Location

Push-Location "d:\Kushal\projects\stratos\meridian\workers"
npm install --save-dev @types/express @types/node @types/uuid @types/cors @types/ioredis
Pop-Location

Write-Host "Done! You can now start the services." -ForegroundColor Green
