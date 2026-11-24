import test from 'node:test';
import assert from 'node:assert/strict';
import {accountMail,adminAccountMail,matchMail} from '../src/mailTemplates.js';

test('Pending registrations notify applicant and include login link',()=>{
 const mail=accountMail({name:'Sample Farmer',role:'farmer',status:'pending'});
 assert.match(mail.subject,/Pending/);
 assert.match(mail.text,/pending administrator review/i);
 assert.match(mail.html,/\/login/);
});
test('Status emails distinguish approvals from rejections',()=>{
 assert.match(accountMail({name:'Farmer',role:'farmer',status:'verified'}).text,/verified/);
 assert.match(accountMail({name:'Buyer',role:'buyer',status:'rejected'}).text,/not approved/);
});
test('Admin notification includes account role and review status',()=>{
 const mail=adminAccountMail({name:'Test Buyer',email:'buyer@example.test',role:'buyer',status:'pending'});
 assert.match(mail.text,/buyer@example\.test/);
 assert.match(mail.subject,/pending/);
});
test('Pending match never discloses phone or email',()=>{
 const mail=matchMail({name:'Test Farmer',recipientRole:'farmer',event:'requested',crop:'Maize',otherName:'Sample Buyer',otherEmail:'private@example.test',otherPhone:'0999999999'});
 assert.doesNotMatch(mail.text,/private@example\.test|0999999999/);
 assert.doesNotMatch(mail.html,/private@example\.test|0999999999/);
});
test('Accepted match delivers counterpart contact details',()=>{
 const mail=matchMail({name:'Test Farmer',recipientRole:'farmer',event:'accepted',crop:'Maize',otherName:'Sample Buyer',otherEmail:'private@example.test',otherPhone:'0999999999'});
 assert.match(mail.text,/private@example\.test/);
 assert.match(mail.text,/0999999999/);
});
test('Declined match does not reveal counterpart contact',()=>{
 const mail=matchMail({name:'Test Buyer',recipientRole:'buyer',event:'rejected',crop:'Soya',otherName:'Sample Farmer',otherEmail:'private@example.test',otherPhone:'0999999999'});
 assert.doesNotMatch(mail.text,/private@example\.test|0999999999/);
});
test('Email templates escape user-supplied HTML',()=>{
 const mail=accountMail({name:'<img src=x onerror=alert(1)>',role:'farmer',status:'pending'});
 assert.doesNotMatch(mail.html,/<img src=x onerror/);
 assert.match(mail.html,/&lt;img/);
});
