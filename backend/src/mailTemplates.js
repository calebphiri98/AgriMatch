const escapeHTML = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const origin = () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/,'');
const htmlPage = (title, paragraphs, href, linkText) => `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7f5ed;padding:24px;color:#17352a"><main style="max-width:580px;margin:auto;border:1px solid #dae6d9;border-top:5px solid #176b45;border-radius:8px;padding:26px;background:#fff"><h2 style="color:#176b45">${escapeHTML(title)}</h2>${paragraphs.map(p=>`<p style="line-height:1.6">${escapeHTML(p)}</p>`).join('')}${href?`<p><a href="${escapeHTML(href)}" style="display:inline-block;padding:11px 18px;background:#176b45;color:#fff;border-radius:6px;text-decoration:none">${escapeHTML(linkText||'Open AgriMatch')}</a></p>`:''}<p style="margin-top:24px;font-size:12px;color:#71827a">AgriMatch • Connecting farmers and buyers in Malawi</p></main></body></html>`;

export function accountMail({name,role,status}) {
 const word=role==='buyer'?'buyer':'farmer';
 const message={
  pending:`Thank you for registering as a ${word}. Your documents are pending administrator review. We will email you after a decision is made.`,
  verified:`Congratulations! Your ${word} account has been verified. You can now use AgriMatch to find and manage agricultural connections.`,
  rejected:`Your ${word} registration was not approved after document review. Please contact the administrator if you require assistance.`
 }[status];
 if(!message)throw new Error('Unsupported account status email.');
 const subject=`AgriMatch Account ${status[0].toUpperCase()+status.slice(1)}`;
 const paragraphs=[`Hello ${name},`,message];
 return {subject,text:paragraphs.join('\n\n')+`\n\nOpen AgriMatch: ${origin()}/login`,html:htmlPage(subject,paragraphs,`${origin()}/login`,'Log in to AgriMatch')};
}
export function adminAccountMail({name,role,email,status}){
 const action=status==='pending'?'registered and is awaiting your review':status==='verified'?'was approved': 'was rejected';
 const subject=`AgriMatch: ${role} account ${status} — ${name}`;
 const paragraphs=[`${name} (${email}) has ${action}.`,'You can review registration and document information in the administrator dashboard.'];
 return {subject,text:paragraphs.join('\n\n')+`\n\n${origin()}/dashboard`,html:htmlPage(subject,paragraphs,`${origin()}/dashboard`,'Open admin dashboard')};
}
export function matchMail({name,recipientRole,event,crop,otherName,otherPhone,otherEmail}) {
 if(!['requested','accepted','rejected'].includes(event))throw new Error('Unsupported match notification event.');
 const otherRole=recipientRole==='farmer'?'buyer':'farmer';
 const who=otherName||`A ${otherRole}`;
 let body;
 if(event==='requested')body=`${who} has requested a match for ${crop}. Log in to review and accept or decline it. Contact details are only shared after acceptance.`;
 else if(event==='rejected')body=`Your match request for ${crop} was declined by the ${otherRole}. You may explore other matching opportunities.`;
 else body=`Your match for ${crop} has been accepted. You can now contact ${who}. Phone: ${otherPhone||'not provided'}. Email: ${otherEmail||'not provided'}.`;
 const subject=`AgriMatch: Match ${event[0].toUpperCase()+event.slice(1)} — ${crop}`;
 const link=recipientRole==='farmer'?`${origin()}/farmer/matches`:`${origin()}/buyer/matches`;
 const paragraphs=[`Hello ${name},`,body];
 return {subject,text:paragraphs.join('\n\n')+`\n\n${link}`,html:htmlPage(subject,paragraphs,link,'View your matches')};
}

