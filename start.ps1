$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path '.\backend\.env')) { throw 'backend\.env missing. Run setup.ps1 and enter your Neon database connection.' }
if (-not (Test-Path '.\backend\node_modules') -or -not (Test-Path '.\frontend\node_modules')) { throw 'Dependencies are missing. Run setup.ps1 first.' }
Write-Host 'Starting AgriMatch backend and frontend in separate PowerShell windows...'
Start-Process -FilePath 'powershell.exe' -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -ArgumentList '-NoExit','-Command','npm run dev'
Start-Process -FilePath 'powershell.exe' -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -ArgumentList '-NoExit','-Command','npm run dev'
Write-Host 'React: http://localhost:5173'
Write-Host 'API health: http://localhost:5000/api/health'
