# Deploy AgriMatch using Vercel + Render + Neon

## 1. Neon

1. Create a new PostgreSQL database at https://console.neon.tech.
2. Copy the PostgreSQL `postgresql://` connection string from Neon. Keep it private.
3. Locally, place it in `backend/.env` as `DATABASE_URL`, then run `npm run db:setup --prefix backend` to create the tables.
4. Create your administrator via `npm run admin:create --prefix backend`.
5. Never push `backend/.env` to GitHub.

## 2. GitHub

Create a **private** repository and push this folder. `.gitignore` excludes the secret `.env` file and dependencies. Never push identity documents.

## 3. Render — Express API

- Create a Render **Web Service** from the GitHub repository.
- Root Directory: `backend`
- Language: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment: `DATABASE_URL` (same Neon database URL), `JWT_ACCESS_SECRET` (or the existing `JWT_SECRET`, same as local) and `NODE_ENV=production`.
- Environment: `CLIENT_URL=https://YOUR-PROJECT.vercel.app` (set after Vercel URL is known).
- `PORT` is provided by Render automatically.
- Email variables: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_FROM`, or `SMTP_USER`/`SMTP_PASSWORD` for existing configurations. To enable automatic email-provider fallback set `EMAIL_PROVIDER=auto`, `BREVO_API_KEY` and/or `RESEND_API_KEY`, plus `MAIL_FROM` verified with your chosen provider. Auto prefers Brevo, then Resend, then Gmail SMTP. See `NOTIFICATION_FIX.md`.

Check `https://YOUR-RENDER-SERVICE.onrender.com/api/health` for `database: connected`.

## 4. Vercel — React app

- Import the **same** GitHub repository.
- Framework Preset: **Vite**
- **Root Directory**: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Environment variable `VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api` (must include `/api`).
- Deploy again **after** setting/changing `VITE_API_URL`, since Vite embeds it at build time.

`frontend/vercel.json` provides SPA navigation fallback, preventing 404 errors on page refresh.

## 5. Connect domains

Set Render's `CLIENT_URL` to the exact Vercel production domain. If you have multiple frontend domains (preview and production), separate their origins with commas. Do **not** add `/api` to `CLIENT_URL`.

## 6. Test all three roles

- Register farmer / buyer; confirm initial status is **pending**.
- Approve them with administrator account, then sign in again.
- Farmer posts produce; buyer posts compatible demand; send a request; the other party accepts; check accepted contacts.
- Verify that the demand reaches `matched` only once combined accepted quantities cover demand.
- Verify uploaded PDF/photo retrieval, dashboard updates, admin reports and browser refresh on Vercel.

**Note:** The uploaded original PHP archive did not include MySQL rows. The new Neon database starts empty except for the administrator you create manually. Core workflows can operate without an email provider, but notifications are not delivered until SMTP or another supported provider is configured. Never commit provider secrets.
