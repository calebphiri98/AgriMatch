# Saves a Brevo API key in the existing backend/.env without touching database settings.
$ErrorActionPreference = 'Stop'
$envPath = Join-Path $PSScriptRoot 'backend\.env'
if (!(Test-Path $envPath)) { throw 'backend\.env not found. Run setup.ps1 first.' }
Write-Host 'AgriMatch Brevo setup. Your API key will not be shown on screen.'
$secure = Read-Host 'Paste your Brevo API key' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if (!$apiKey -or !$apiKey.StartsWith('xkeysib-')) { throw 'That does not look like a Brevo API key; no files were changed.' }
$sender = Read-Host 'Enter the sender email VERIFIED in your Brevo account'
if ($sender -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Invalid sender email; no files were changed.' }
$lines = @(Get-Content -LiteralPath $envPath)
$changes = [ordered]@{ 'BREVO_API_KEY' = $apiKey; 'MAIL_FROM' = $sender; 'EMAIL_PROVIDER' = 'brevo' }
foreach($key in $changes.Keys) {
  $replacement = $key + '=' + $changes[$key]
  $matching = @($lines | Where-Object { $_ -match ('^\s*' + [regex]::Escape($key) + '\s*=') })
  if($matching.Count -gt 0) { $lines = @($lines | Where-Object { $_ -notmatch ('^\s*' + [regex]::Escape($key) + '\s*=') }) }
  $lines += $replacement
}
Set-Content -LiteralPath $envPath -Value $lines -Encoding UTF8
Write-Host 'Brevo configured as AgriMatch email provider. Existing Neon and JWT values were preserved.'
Write-Host 'Test now: npm run email:test --prefix backend'
