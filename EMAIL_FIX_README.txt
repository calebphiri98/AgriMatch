AGRIMATCH EMAIL AUTHENTICATION FIX (does not change the React UI or database)

WHAT WAS WRONG
AgriMatch selected Gmail SMTP whenever GMAIL_USER and GMAIL_APP_PASSWORD existed.
Your Gmail SMTP test returned 535 EAUTH, so the original module stopped and never
tried its configured Brevo/Resend alternatives.

WHAT CHANGED
backend/src/mail.js now supports EMAIL_PROVIDER=auto|smtp|brevo|resend.
Auto mode falls back after definitively unsuccessful SMTP authentication.
Set EMAIL_PROVIDER=brevo to avoid Gmail entirely.
The patch never includes secrets or overwrites backend/.env.

QUICKEST OPTION: BREVO
1. Confirm in your Brevo account that the sender email is VERIFIED.
2. Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\configure-brevo.ps1
3. Enter the Brevo API key privately and the verified sender address.
4. Run: npm run email:test --prefix backend

You can instead use EMAIL_PROVIDER=resend and set RESEND_API_KEY and MAIL_FROM,
but Resend requires an authorized/verified sending domain.

EMAIL TEST ACCEPTED does not mean recipient inbox delivery is guaranteed.
Check the message and provider's sending logs.

SECURITY
Previously shared credentials should be revoked and replaced before public hosting.
Do not commit backend/.env to GitHub.
