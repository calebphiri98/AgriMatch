$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$path = Join-Path $PSScriptRoot 'backend\.env'
if (-not (Test-Path $path)) {
    Copy-Item (Join-Path $PSScriptRoot 'backend\.env.example') $path
}
Write-Host 'AgriMatch Gmail SMTP setup (password entry is hidden).' -ForegroundColor Green
$secure = Read-Host 'Paste your Gmail App Password' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Replace(' ', '')
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $password) { throw 'No app password entered. Settings have not changed.' }
$content = [System.IO.File]::ReadAllText($path)
$changes = [ordered]@{
    'SMTP_HOST' = 'smtp.gmail.com'
    'SMTP_PORT' = '587'
    'GMAIL_USER' = 'attachmenttracking738@gmail.com'
    'GMAIL_APP_PASSWORD' = $password
    'SMTP_FROM' = 'attachmenttracking738@gmail.com'
}
foreach ($name in $changes.Keys) {
    $value = $changes[$name]
    $pattern = '(?m)^' + [regex]::Escape($name) + '=.*$'
    if ([regex]::IsMatch($content, $pattern)) {
        $content = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) "$name=$value" })
    } else {
        $content += "`r`n$name=$value"
    }
}
[System.IO.File]::WriteAllText($path, $content.TrimEnd() + "`r`n", [System.Text.UTF8Encoding]::new($false))
Write-Host 'Gmail SMTP values saved to backend\.env. Keep that file private.' -ForegroundColor Green
Write-Host 'Run npm run email:test --prefix backend to check delivery.' -ForegroundColor Cyan
