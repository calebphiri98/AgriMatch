import nodemailer from 'nodemailer';
import {accountMail,adminAccountMail,matchMail} from './mailTemplates.js';
export {accountMail,adminAccountMail,matchMail} from './mailTemplates.js';

// Credentials remain in backend/.env or the hosting service's environment variables.
const clean = value => String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
const cleanPassword = value => clean(value).replace(/\s+/g, '');
const providerLabel = name => ({brevo:'Brevo',resend:'Resend',smtp:'Gmail SMTP'})[name];

function config() {
  const user = clean(process.env.GMAIL_USER || process.env.SMTP_USER);
  const pass = cleanPassword(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD);
  const from = clean(process.env.MAIL_FROM || process.env.SMTP_FROM || user);
  const brevoKey = clean(process.env.BREVO_API_KEY);
  const resendKey = clean(process.env.RESEND_API_KEY);
  const mode = clean(process.env.EMAIL_PROVIDER || 'auto').toLowerCase();
  if (!['auto','brevo','resend','smtp','gmail'].includes(mode)) {
    throw new Error('EMAIL_PROVIDER must be auto, brevo, resend or smtp.');
  }
  const available = {
    brevo: Boolean(brevoKey && from),
    resend: Boolean(resendKey && from),
    smtp: Boolean(user && pass),
  };
  // Prefer API providers if configured. A Gmail 535 will not prevent other providers
  // being attempted when EMAIL_PROVIDER=auto.
  const order = mode === 'auto' ? ['brevo','resend','smtp'] : [mode === 'gmail' ? 'smtp' : mode];
  return {user,pass,from,brevoKey,resendKey,available,order};
}

async function sendSmtp(to, message, cfg) {
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: clean(process.env.SMTP_HOST) || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {user:cfg.user,pass:cfg.pass},
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
  try {
    await transporter.sendMail({
      from:{name:'AgriMatch',address:cfg.from},to,
      subject:message.subject,text:message.text,html:message.html,
    });
  } finally {
    transporter.close();
  }
}

async function sendBrevo(to, message, cfg) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:'POST',
    headers:{'api-key':cfg.brevoKey,'Content-Type':'application/json'},
    body:JSON.stringify({
      sender:{name:'AgriMatch',email:cfg.from},to:[{email:to}],
      subject:message.subject,htmlContent:message.html,textContent:message.text,
    }),
    signal:AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const error = new Error(`Brevo rejected the email (HTTP ${response.status}). Verify the API key and sender address.`);
    error.definitelyRejected = response.status >= 400 && response.status < 500;
    throw error;
  }
}

async function sendResend(to, message, cfg) {
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{Authorization:`Bearer ${cfg.resendKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:`AgriMatch <${cfg.from}>`,to:[to],subject:message.subject,
      html:message.html,text:message.text,
    }),
    signal:AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const error = new Error(`Resend rejected the email (HTTP ${response.status}). Verify the API key and sending domain.`);
    error.definitelyRejected = response.status >= 400 && response.status < 500;
    throw error;
  }
}

const definitelyUnsent = error => error?.code === 'EAUTH' ||
  error?.responseCode === 535 || error?.responseCode === 534 ||
  error?.definitelyRejected === true ||
  (error?.code === 'ECONNECTION' && error?.command === 'CONN');

export async function sendMail(to, message) {
  if (!to) return false;
  let cfg;
  try { cfg = config(); }
  catch (error) { console.error('AgriMatch email configuration:',error.message); return false; }
  let attempted = false;
  for (const provider of cfg.order) {
    if (!cfg.available[provider]) continue;
    attempted = true;
    try {
      if (provider === 'brevo') await sendBrevo(to,message,cfg);
      else if (provider === 'resend') await sendResend(to,message,cfg);
      else await sendSmtp(to,message,cfg);
      console.info(`AgriMatch email accepted by ${providerLabel(provider)} (delivery not yet confirmed).`);
      return true;
    } catch (error) {
      console.warn(`AgriMatch ${providerLabel(provider)} failed: ${error?.message || 'unknown error'}`);
      // Only retry on a clearly rejected message to avoid accidental duplicates.
      if (!definitelyUnsent(error) || cfg.order.length === 1) return false;
    }
  }
  if (!attempted) console.warn('AgriMatch email skipped: configure Gmail, Brevo or Resend in backend/.env.');
  return false;
}

const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const notify = (to,subject,text) => sendMail(to,{
  subject,text,
  html:`<div style="font-family:Arial,sans-serif;padding:20px"><h2>AgriMatch</h2><p>${escapeHTML(text).replace(/\n/g,'<br>')}</p></div>`,
});
