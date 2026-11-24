# AgriMatch — React + Node.js/Express + Neon PostgreSQL

This is an original-layout-focused React rebuild of the uploaded **AgriMatch PHP final-year project** using a React (Vite) frontend, Express API and Neon-compatible PostgreSQL schema. The original forest green `#176B45`, cream `#F7F5ED` and harvest yellow `#F2BD4B` palette, original two-card homepage, simple login page and green app navigation are preserved in responsive React.

## What is included

| Original PHP | New page | API |
|---|---|---|
| index.php | `/` | — |
| auth/register.php | `/register` | POST `/api/auth/register` |
| auth/login.php | `/login` | POST `/api/auth/login` |
| dashboard.php | `/dashboard` (role-aware) | GET `/api/dashboard` |
| farmer/add_produce.php | `/farmer/add-produce` | POST `/api/produce` |
| farmer/my_produce.php | `/farmer/my-produce` | GET/PATCH `/api/produce` |
| farmer/matches.php | `/farmer/matches` | GET/POST `/api/matches` |
| farmer/profile.php | `/profile` (farmer) | GET/PUT `/api/profile` |
| buyer/post_demand.php | `/buyer/post-demand` | POST `/api/demands` |
| buyer/my_demands.php | `/buyer/my-demands` | GET/PATCH `/api/demands` |
| buyer/matched_farmers.php | `/buyer/matches` | GET/POST `/api/matches` |
| buyer/profile.php | `/profile` (buyer) | GET/PUT `/api/profile` |
| admin/manage_farmers.php | `/admin/farmers` | GET/PATCH `/api/admin/users` |
| admin/manage_buyers.php | `/admin/buyers` | GET/PATCH `/api/admin/users` |
| admin/manage_produce.php | `/admin/produce` | GET/PATCH `/api/admin/produce` |
| admin/manage_matches.php | `/admin/matches` | GET/POST `/api/admin/matches` |
| admin/reports.php | `/admin/reports` | GET `/api/admin/reports` |

### Original matching rules preserved

- Matching uses **the same crop** and combines quantities from several farmers toward one demand. The location is **not** a matching filter.
- 1 tonne = 1000 kg, one 50 kg bag = 50 kg, one 90 kg bag = 90 kg. Crates cannot be combined with weight units.
- Buyer and farmer can request a match; only the other party can accept or decline. Buyer may request a recommended bundle.
- Contact email/phone is only shown to the two parties after a match is accepted. Admins can review all records.
- Farmers and buyers must be approved by the administrator before posting and matching.
- Accepted matches update listing and demand statuses; acceptance uses a PostgreSQL transaction.

### Requirements

- Windows PowerShell or macOS/Linux shell
- Node.js **20+** and npm
- Neon PostgreSQL database and its **PostgreSQL connection string**

## Windows quick start — fresh extraction

Put the ZIP in Downloads. Open Windows PowerShell and run these **in order**:

```powershell
cd "$HOME\Downloads"
Expand-Archive -Path '.\AgriMatch_React_Neon.zip' -DestinationPath '.' -Force
cd '.\AgriMatch_React_Neon'
powershell -NoProfile -ExecutionPolicy Bypass -File '.\setup.ps1'
```

1. Open `backend\.env` (created automatically) and **replace the example `DATABASE_URL`** with your real Neon connection string. Do not append `/api` or use the Neon dashboard webpage URL; it must start `postgresql://`.
2. `setup.ps1` generates `JWT_ACCESS_SECRET` automatically on first setup; existing `JWT_SECRET` is supported for earlier installations. Example generator in PowerShell:

```powershell
-join ((1..48) | ForEach-Object { 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[(Get-Random -Maximum 62)] })
```

3. After saving `.env`, initialize tables **one time**:

```powershell
npm run db:setup --prefix backend
npm run admin:create --prefix backend
```

`admin:create` prompts you for the administrator name, email, phone and a new password (minimum 12 characters). **No universal admin password is built in.**

4. Start both servers:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File '.\start.ps1'
```

Then open **http://localhost:5173**. The API can be checked at **http://localhost:5000/api/health**.

### Prefer to run in two VS Code terminals?

Terminal 1:

```powershell
cd "$HOME\Downloads\AgriMatch_React_Neon\backend"
npm run dev
```

Terminal 2:

```powershell
cd "$HOME\Downloads\AgriMatch_React_Neon\frontend"
npm run dev
```

The React app uses `/api` locally through the Vite proxy (see `frontend/vite.config.js`), so you do not need `VITE_API_URL` in local development.

### Tests and production build

```powershell
npm test --prefix backend
npm run build --prefix frontend
```

There are native Node tests of the matching rules, quantity conversion, constraints and privacy approach. A complete browser/Neon workflow test must be run on your configured machine.

## What was NOT included from the original archive

The original PHP project creates its schema in `config/db.php` but contains **no SQL backup or database records**. New empty PostgreSQL tables can be created, but existing MySQL accounts, passwords, produce and demand records cannot be recovered from PHP source alone. You will need a separate **MySQL SQL export** if you want old data migrated. The original archive also contains **real-looking identity and business document uploads**, which have been excluded from this distribution to protect privacy. Fresh uploads are stored privately as PostgreSQL `BYTEA` and require authentication to retrieve.

## Security / prototype notes

This is a final-year-project prototype, **not a certified production marketplace**. It includes password hashing, JWT authentication, role authorization, per-request account status checks, SQL parameters, transactional match acceptance, login rate limiting and private documents. Passwords and Neon credentials should never be committed to a public repository. Store private files in an appropriately configured storage system for larger-scale deployments. Email notifications require working Gmail SMTP, Brevo or Resend credentials; see `NOTIFICATION_FIX.md`.

## Hosting

See [DEPLOYMENT.md](DEPLOYMENT.md) for React-on-Vercel, Express-on-Render and Neon instructions.

## Original appearance and email update

See [UPDATE_NOTES.md](UPDATE_NOTES.md) for exact PowerShell commands, original-look changes, email notification parity, and the list of credentials deliberately kept out of the ZIP.


## Notification configuration (combined update)

This project supports Gmail SMTP, Brevo and Resend via `backend/.env`; the app tries Brevo, then Resend, then Gmail when `EMAIL_PROVIDER=auto`. No live passwords or API keys are included in the ZIP. To reuse missing notification settings from `Downloads/AttachTrack-main/backend/.env` **without retyping secrets**, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\configure-notifications.ps1`, then `npm run email:test --prefix backend`. This does **not** modify `DATABASE_URL`, JWT keys or any frontend files. The sender address must be authorized by Brevo or Resend. See [NOTIFICATION_FIX.md](NOTIFICATION_FIX.md) for full details.

## One-file follow-up update

This consolidated release also includes `NOTIFICATION_FIX.md`, the corrected `backend/src/mail.js`, and `configure-notifications.ps1` to use locally existing Brevo/Resend settings. See those files instead of older Gmail-only configuration instructions.
