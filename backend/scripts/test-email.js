import 'dotenv/config';
import {sendMail,accountMail} from '../src/mail.js';
const to=process.env.GMAIL_USER||process.env.SMTP_USER;
if(!to){console.error('Configure GMAIL_USER or SMTP_USER in backend/.env first.');process.exit(1);}
const ok=await sendMail(to,accountMail({name:'AgriMatch Administrator',role:'farmer',status:'pending'}));
if(ok)console.log('Test email handed to the configured provider. Check the inbox (including spam).');
else{console.error('Email delivery test unsuccessful. Verify credentials and network access.');process.exitCode=1;}
