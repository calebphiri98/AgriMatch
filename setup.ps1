$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host "`nAgriMatch React + Express + Neon setup" -ForegroundColor Green
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20 or newer is required. Install it from https://nodejs.org/' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is required.' }
if (-not (Test-Path '.\backend\.env')) {
    Copy-Item '.\backend\.env.example' '.\backend\.env'
    Write-Host 'Created backend\.env from template. Your real Neon URL has NOT been entered yet.' -ForegroundColor Yellow
}
# Generate a private access-token signing key on first setup. Existing real secrets
# are preserved; .env is never included in the distributable ZIP.
$envPath = Join-Path $PSScriptRoot 'backend\.env'
$envText = [System.IO.File]::ReadAllText($envPath)
if ($envText -match '(?m)^JWT_ACCESS_SECRET=REPLACE_WITH_.*$') {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $newSecret = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    $envText = [regex]::Replace($envText, '(?m)^JWT_ACCESS_SECRET=REPLACE_WITH_.*$', 'JWT_ACCESS_SECRET=' + $newSecret)
    [System.IO.File]::WriteAllText($envPath, $envText, [System.Text.UTF8Encoding]::new($false))
    Write-Host 'Generated a private JWT access secret in backend\.env.' -ForegroundColor Green
}
Write-Host 'Installing backend dependencies...'
npm install --prefix backend
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
Write-Host 'Installing frontend dependencies...'
npm install --prefix frontend
if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
$envText = Get-Content '.\backend\.env' -Raw
if ([System.IO.File]::ReadAllText($envPath) -match 'YOUR_|REPLACE_WITH') {
    Write-Host "`nNEXT: Edit backend\.env and replace DATABASE_URL with your real Neon connection string. For notifications: run .\configure-notifications.ps1 (optional)." -ForegroundColor Yellow
    Write-Host 'Then run: npm run db:setup --prefix backend'
    Write-Host 'Then run: npm run admin:create --prefix backend'
} else {
    Write-Host 'Setting up PostgreSQL tables...'
    npm run db:setup --prefix backend
    if ($LASTEXITCODE -ne 0) { throw 'Schema initialization failed. Check the Neon URL in backend\.env.' }
    Write-Host 'Database tables created. Run: npm run admin:create --prefix backend (first time only).'
}
Write-Host "`nTo start both servers: powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1" -ForegroundColor Green
