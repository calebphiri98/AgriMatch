$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'Running AgriMatch matching tests...' -ForegroundColor Cyan
npm test --prefix backend
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
Write-Host 'Building React for production...' -ForegroundColor Cyan
npm run build --prefix frontend
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
Write-Host 'Checks complete. Output: frontend\dist' -ForegroundColor Green
