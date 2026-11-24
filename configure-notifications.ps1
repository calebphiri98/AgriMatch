param(
    [string]$SourceEnv = (Join-Path $HOME 'Downloads\AttachTrack-main\backend\.env')
)
$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot 'backend\.env'
$template = Join-Path $PSScriptRoot 'backend\.env.example'
if (-not (Test-Path -LiteralPath $target)) {
    Copy-Item -LiteralPath $template -Destination $target
    Write-Host 'Created backend\.env. Set your Neon DATABASE_URL if this is a fresh installation.' -ForegroundColor Yellow
}

function Read-EnvValue([string]$path, [string]$key) {
    if (-not (Test-Path -LiteralPath $path)) { return '' }
    $pattern = '^\s*' + [regex]::Escape($key) + '\s*=\s*(.*)$'
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
        $m = [regex]::Match($line, $pattern)
        if (-not $m.Success) { continue }
        $value = $m.Groups[1].Value.Trim()
        if ($value.Length -ge 2) {
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        if ($value -match '^(YOUR_|REPLACE_WITH|<a different)') { return '' }
        return $value
    }
    return ''
}

function Set-EnvValue([string]$path, [string]$key, [string]$value) {
    $lines = [System.Collections.Generic.List[string]]::new()
    $pattern = '^\s*' + [regex]::Escape($key) + '\s*='
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
        if ($line -notmatch $pattern) { $lines.Add($line) }
    }
    $lines.Add($key + '=' + $value)
    [System.IO.File]::WriteAllLines($path, $lines, [System.Text.UTF8Encoding]::new($false))
}

# Do NOT copy an unrelated application's JWT/session keys, database URL or cron key.
# Only missing EMAIL-related settings are imported from a local existing project.
$copyKeys = @('BREVO_API_KEY','RESEND_API_KEY','GMAIL_USER','GMAIL_APP_PASSWORD')
if (Test-Path -LiteralPath $SourceEnv) {
    foreach ($key in $copyKeys) {
        $existing = Read-EnvValue $target $key
        $incoming = Read-EnvValue $SourceEnv $key
        if ([string]::IsNullOrWhiteSpace($existing) -and -not [string]::IsNullOrWhiteSpace($incoming)) {
            Set-EnvValue $target $key $incoming
            Write-Host ('Imported local ' + $key + ' from AttachTrack environment (value hidden).') -ForegroundColor Green
        }
    }
} else {
    Write-Host 'AttachTrack .env was not found at the default location. Keeping existing AgriMatch settings.' -ForegroundColor Yellow
}

if (-not (Read-EnvValue $target 'GMAIL_USER')) {
    Set-EnvValue $target 'GMAIL_USER' 'attachmenttracking738@gmail.com'
}
if (-not (Read-EnvValue $target 'SMTP_FROM')) {
    Set-EnvValue $target 'SMTP_FROM' (Read-EnvValue $target 'GMAIL_USER')
}
if (-not (Read-EnvValue $target 'SMTP_HOST')) { Set-EnvValue $target 'SMTP_HOST' 'smtp.gmail.com' }
if (-not (Read-EnvValue $target 'SMTP_PORT')) { Set-EnvValue $target 'SMTP_PORT' '587' }
if (-not (Read-EnvValue $target 'JWT_ACCESS_EXPIRY')) { Set-EnvValue $target 'JWT_ACCESS_EXPIRY' '20m' }

if (-not (Read-EnvValue $target 'MAIL_FROM')) {
    $sender = ''
    foreach ($key in @('MAIL_FROM','BREVO_SENDER_EMAIL','RESEND_FROM','EMAIL_FROM','SMTP_FROM')) {
        $sender = Read-EnvValue $SourceEnv $key
        if ($sender) { break }
    }
    if (-not $sender) { $sender = Read-EnvValue $target 'SMTP_FROM' }
    Set-EnvValue $target 'MAIL_FROM' $sender
}

$hasBrevo = -not [string]::IsNullOrWhiteSpace((Read-EnvValue $target 'BREVO_API_KEY'))
$hasResend = -not [string]::IsNullOrWhiteSpace((Read-EnvValue $target 'RESEND_API_KEY'))
$hasGmail = -not [string]::IsNullOrWhiteSpace((Read-EnvValue $target 'GMAIL_APP_PASSWORD'))
if ($hasBrevo -or $hasResend) {
    # Prefer verified API providers, then Gmail, without changing the UI or Neon.
    Set-EnvValue $target 'EMAIL_PROVIDER' 'auto'
} elseif (-not (Read-EnvValue $target 'EMAIL_PROVIDER')) {
    Set-EnvValue $target 'EMAIL_PROVIDER' 'smtp'
}

Write-Host ''
Write-Host 'AgriMatch notification configuration:' -ForegroundColor Cyan
Write-Host ('Brevo configured: ' + $hasBrevo)
Write-Host ('Resend configured: ' + $hasResend)
Write-Host ('Gmail password configured: ' + $hasGmail)
Write-Host ('Email provider mode: ' + (Read-EnvValue $target 'EMAIL_PROVIDER'))
Write-Host 'Existing Neon DATABASE_URL and JWT secrets were NOT changed.'
Write-Host 'Important: the MAIL_FROM sender must be verified with Brevo/Resend.' -ForegroundColor Yellow
Write-Host 'Test: npm run email:test --prefix backend' -ForegroundColor Green
