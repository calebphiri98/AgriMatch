#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ -f backend/.env ] || cp backend/.env.example backend/.env
npm install --prefix backend
npm install --prefix frontend
if grep -Eq 'YOUR_|REPLACE_WITH' backend/.env; then
  echo 'Edit backend/.env with your Neon DATABASE_URL and a secure JWT_SECRET.'
  echo 'Then run npm run db:setup --prefix backend and npm run admin:create --prefix backend.'
else
  npm run db:setup --prefix backend
  echo 'Run npm run admin:create --prefix backend to create your first administrator.'
fi
echo 'Start Express and Vite in two terminals: npm run dev --prefix backend / frontend'
