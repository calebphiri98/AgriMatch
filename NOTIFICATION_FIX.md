# AgriMatch notification correction (original UI preserved)

This version combines the original-look React UI update with the subsequent email-provider fix. It changes **no React screens, CSS, colour palette, forms, database tables or matching behaviour** compared with the Original Style update.

## Why the previous email test returned Gmail 535

Nodemailer successfully contacted Google's SMTP server but Google rejected the credentials it received. A password being 16 characters long does not prove that Google will accept it. The original Node mail module stopped trying further providers whenever Gmail was configured, even if Brevo or Resend keys were available.

The replacement `backend/src/mail.js` supports `EMAIL_PROVIDER=auto` (Brevo, then Resend, then Gmail), or explicit `brevo`, `resend`, `smtp`. It will try another provider only when the failure clearly establishes that the message was not accepted, avoiding possible duplicate notifications from ambiguous timeouts.

## Windows upgrade over your existing project

Download the ZIP to Downloads. **Make a local backup of the application before extracting**.

```powershell
cd "$HOME\Downloads"
Copy-Item '.\AgriMatch_React_Neon' '.\AgriMatch_React_Neon_backup' -Recurse -Force
Expand-Archive -Path '.\AgriMatch_Complete_Original_UI_Email_Update.zip' -DestinationPath '.' -Force
cd '.\AgriMatch_React_Neon'
powershell -NoProfile -ExecutionPolicy Bypass -File '.\configure-notifications.ps1'
npm run email:test --prefix backend
powershell -NoProfile -ExecutionPolicy Bypass -File '.\start.ps1'
```

`backend\.env` is **not packaged**, so extraction preserves the working local connection. If you have the AttachTrack project at `Downloads\AttachTrack-main\backend\.env`, the configuration script reads ONLY missing email-provider values from that local file (Brevo, Resend or Gmail), without copying the database credentials, JWT tokens or cron secrets. Existing AgriMatch email values are not overwritten. If the AttachTrack file is somewhere else, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File '.\configure-notifications.ps1' -SourceEnv 'D:\path\to\AttachTrack-main\backend\.env'
```

If provider credentials are only configured in an online hosting dashboard, they are **not** present in the local AttachTrack `.env` and must be configured in AgriMatch's local `.env` or its own hosting dashboard.

## Key settings

- `JWT_ACCESS_EXPIRY=20m` — supported.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — Gmail SMTP.
- `BREVO_API_KEY` — Brevo API.
- `RESEND_API_KEY` — Resend API.
- `MAIL_FROM` — must be a sender verified in the selected provider's account.
- `EMAIL_PROVIDER=auto` — Brevo, then Resend, then Gmail; use `brevo` / `resend` / `smtp` to select one.
- `DATABASE_URL` — your existing Neon connection remains unchanged.
- `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRY_DAYS`, `VERIFICATION_CODE_EXPIRY_MINUTES`, `CRON_SECRET` — **not active features** in this project. They are not copied from other apps.

**Do not put live API keys/passwords into a shareable ZIP or GitHub repository.** Credentials previously pasted into chat should be rotated before hosting publicly.

## Verify

```powershell
npm test --prefix backend
npm run email:test --prefix backend
npm run build --prefix frontend
```

A successful email API response means the provider accepted the message, not necessarily that the recipient inbox delivered it. Verify the recipient inbox and spam. Live provider, Neon and browser tests require running on the configured computer.
