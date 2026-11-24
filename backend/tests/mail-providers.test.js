import test from 'node:test';
import assert from 'node:assert/strict';
import {sendMail} from '../src/mail.js';

const keys = ['EMAIL_PROVIDER','BREVO_API_KEY','RESEND_API_KEY','MAIL_FROM','GMAIL_USER','GMAIL_APP_PASSWORD'];
const original = Object.fromEntries(keys.map(key=>[key,process.env[key]]));
const initialFetch = globalThis.fetch;
function reset() {
  for(const key of keys) {
    if(original[key]===undefined)delete process.env[key];
    else process.env[key]=original[key];
  }
  globalThis.fetch=initialFetch;
}
function configure(){
  process.env.EMAIL_PROVIDER='auto';
  process.env.BREVO_API_KEY='example_brevo';
  process.env.RESEND_API_KEY='example_resend';
  process.env.MAIL_FROM='verified@example.test';
  process.env.GMAIL_USER='sender@example.test';
  process.env.GMAIL_APP_PASSWORD='fakepassword';
}
const mail={subject:'AgriMatch test',text:'Hello farmer',html:'<p>Hello farmer</p>'};

test('Auto mode prefers Brevo API over Gmail SMTP when both exist', {concurrency:false}, async t=>{
  t.after(reset);configure();
  let calls=[];
  globalThis.fetch=async url=>{calls.push(url);return {ok:true,status:201};};
  assert.equal(await sendMail('recipient@example.test',mail),true);
  assert.deepEqual(calls,['https://api.brevo.com/v3/smtp/email']);
});

test('Auto mode falls back from confirmed Brevo rejection to Resend', {concurrency:false}, async t=>{
  t.after(reset);configure();
  let calls=[];
  globalThis.fetch=async url=>{
    calls.push(url);
    return url.includes('brevo.com')?{ok:false,status:401}:{ok:true,status:200};
  };
  assert.equal(await sendMail('recipient@example.test',mail),true);
  assert.equal(calls.length,2);
  assert.match(calls[1],/api\.resend\.com/);
});

test('Ambiguous provider failure does not retry and risk duplicate mail', {concurrency:false}, async t=>{
  t.after(reset);configure();
  let calls=[];
  globalThis.fetch=async url=>{calls.push(url);return {ok:false,status:500};};
  assert.equal(await sendMail('recipient@example.test',mail),false);
  assert.equal(calls.length,1);
});

test('Explicit provider mode sends through Resend only', {concurrency:false}, async t=>{
  t.after(reset);configure();process.env.EMAIL_PROVIDER='resend';
  let calls=[];
  globalThis.fetch=async url=>{calls.push(url);return {ok:true,status:200};};
  assert.equal(await sendMail('recipient@example.test',mail),true);
  assert.deepEqual(calls,['https://api.resend.com/emails']);
});
