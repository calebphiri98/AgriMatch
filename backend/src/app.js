import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import {query,transaction,pool} from './db.js';
import {sign,auth,role,verified} from './auth.js';
import {upload,putFile,picker,validateFile} from './files.js';
import {notify,sendMail,accountMail,adminAccountMail,matchMail} from './mail.js';
import {CROPS,UNITS,QUALITIES,ORGS,FREQUENCIES,compact,posNum,optionalNum,dateOrNull,bad,safe} from './common.js';
import {coverage,makeRequest,answerRequest,farmerDiscovery,buyerDiscovery,refreshDemand,toBase} from './matching.js';

export const app=express();
app.disable('x-powered-by');
app.use(helmet());
const origins=(process.env.CLIENT_URL||'http://localhost:5173').split(',').map(x=>x.trim()).filter(Boolean);
app.use(cors({origin(origin,cb){if(!origin||origins.includes(origin))return cb(null,true);cb(bad('Origin not allowed by CORS.',403));}}));
app.use(express.json({limit:'128kb'}));
app.use('/api/auth/login',rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false}));
app.use('/api/auth/register',rateLimit({windowMs:60*60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false}));
app.get('/api/health',safe(async(req,res)=>{await query('SELECT 1');res.json({status:'ok',database:'connected'});}));
app.get('/api/meta',(req,res)=>res.json({crops:CROPS,units:UNITS,qualities:QUALITIES,orgs:ORGS,frequencies:FREQUENCIES}));

const registrationUploads=upload.fields([{name:'id_document',maxCount:1},{name:'map_document',maxCount:1},{name:'business_certificate',maxCount:1}]);
async function notifyAdmins(subject,message,template=null){
 const admins=(await query("SELECT email FROM users WHERE role='admin' AND status='verified'")).rows;
 const recipients=new Set(admins.map(a=>a.email));
 if(process.env.ADMIN_EMAIL)recipients.add(process.env.ADMIN_EMAIL);
 for(const email of recipients)await (template?sendMail(email,template):notify(email,subject,message));
}
async function notifyAccount({email,name,role,status}){
 await sendMail(email,accountMail({name,role,status}));
 const admin=adminAccountMail({name,role,email,status});
 await notifyAdmins(admin.subject,admin.text,admin);
}
async function notifyMatch(matchId,kind){
 const r=await query(`SELECT m.match_id,m.requested_by,m.status,p.crop_type,
 uf.full_name AS farmer_name,uf.email AS farmer_email,uf.phone AS farmer_phone,
 ub.full_name AS buyer_name,ub.email AS buyer_email,ub.phone AS buyer_phone
 FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id
 JOIN farmer_details f ON f.farmer_id=p.farmer_id JOIN users uf ON uf.user_id=f.user_id
 JOIN demands d ON d.demand_id=m.demand_id JOIN buyer_details b ON b.buyer_id=d.buyer_id
 JOIN users ub ON ub.user_id=b.user_id WHERE m.match_id=$1`,[matchId]);
 const m=r.rows[0];if(!m)return;
 async function send(recipient,event){
  const other=recipient==='farmer'?'buyer':'farmer';
  const email=m[recipient+'_email'];
  await sendMail(email,matchMail({name:m[recipient+'_name'],recipientRole:recipient,event,crop:m.crop_type,
   otherName:m[other+'_name'],otherPhone:event==='accepted'?m[other+'_phone']:null,otherEmail:event==='accepted'?m[other+'_email']:null}));
 }
 if(kind==='request')await send(m.requested_by==='farmer'?'buyer':'farmer','requested');
 else if(m.status==='accepted'){await send('farmer','accepted');await send('buyer','accepted');}
 else if(m.status==='rejected')await send(m.requested_by,'rejected');
}

app.post('/api/auth/register',registrationUploads,safe(async(req,res)=>{
 const b=req.body, r=b.role, name=compact(r==='buyer'?b.company_name:b.full_name,150),email=compact(b.email,150).toLowerCase(),phone=compact(b.phone,30),password=String(b.password||'');
 if(!['farmer','buyer'].includes(r)||!name||!email.includes('@')||!phone||password.length<8)throw bad('Enter a valid role, name, email, phone and password (minimum 8 characters).');
 if(password!==String(b.confirm_password||''))throw bad('Passwords do not match.');
 let id=null,map=null,cert=null;
 if(r==='farmer'){
  if(!compact(b.location,150))throw bad('Your farming location is required.');
  const crops=JSON.parse(b.crop_types||'[]');
  if(!Array.isArray(crops)||!crops.length||crops.length>30)throw bad('Select at least one crop.');
  id=picker(req,'id_document');map=picker(req,'map_document');if(!id||!map)throw bad('National ID and farm map documents are required.');
  validateFile(id);validateFile(map);
 } else {
  if(!compact(b.physical_address,255)||!ORGS.includes(b.organization_type))throw bad('Business address and organisation type are required.');
  cert=picker(req,'business_certificate');if(!cert)throw bad('Business certificate is required.');validateFile(cert);
 }
 const hash=await bcrypt.hash(password,12);
 const result=await transaction(async c=>{
  const u=(await c.query("INSERT INTO users(role,full_name,email,phone,password,status) VALUES ($1,$2,$3,$4,$5,'pending') RETURNING user_id",[r,name,email,phone,hash])).rows[0];
  if(r==='farmer'){
   const [idPath,mapPath]=[await putFile(c,u.user_id,'id_document',id),await putFile(c,u.user_id,'map_document',map)];
   const f=(await c.query('INSERT INTO farmer_details(user_id,location,id_document,map_document) VALUES ($1,$2,$3,$4) RETURNING farmer_id',[u.user_id,compact(b.location,150),idPath,mapPath])).rows[0];
   const crops=[...new Set(JSON.parse(b.crop_types).map(x=>compact(x,100)).filter(Boolean))];
   for(const crop of crops)await c.query('INSERT INTO farmer_crops(farmer_id,crop_type) VALUES ($1,$2)',[f.farmer_id,crop]);
  } else {
   const fileId=await putFile(c,u.user_id,'business_certificate',cert);
   await c.query('INSERT INTO buyer_details(user_id,physical_address,organization_type,business_certificate) VALUES ($1,$2,$3,$4)',[u.user_id,compact(b.physical_address,255),b.organization_type,fileId]);
  }
  return u;
 });
 await notifyAccount({email,name,role:r,status:'pending'});
 res.status(201).json({message:'Registration received. An administrator will review your account.',user_id:result.user_id});
}));
app.post('/api/auth/login',safe(async(req,res)=>{
 const email=compact(req.body.email,150).toLowerCase(),pass=String(req.body.password||'');
 const row=(await query('SELECT * FROM users WHERE LOWER(email)=$1',[email])).rows[0];
 if(!row||!(await bcrypt.compare(pass,row.password)))throw bad('Incorrect email or password.',401);
 if(row.status==='rejected')throw bad('Your account was rejected. Contact the administrator.',403);
 res.json({token:sign(row),user:publicUser(row)});
}));
const publicUser = u => ({user_id:u.user_id,role:u.role,full_name:u.full_name,email:u.email,phone:u.phone,status:u.status,created_at:u.created_at});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));

async function profile(user){
 if(user.role==='farmer'){
  const f=(await query('SELECT * FROM farmer_details WHERE user_id=$1',[user.user_id])).rows[0];
  if(!f)return {user,crops:[]};
  const crops=(await query('SELECT crop_type FROM farmer_crops WHERE farmer_id=$1 ORDER BY crop_type',[f.farmer_id])).rows.map(x=>x.crop_type);
  return {user,details:f,crops};
 }
 if(user.role==='buyer')return {user,details:(await query('SELECT * FROM buyer_details WHERE user_id=$1',[user.user_id])).rows[0]};
 return {user};
}
app.get('/api/profile',auth,safe(async(req,res)=>res.json(await profile(req.user))));
app.put('/api/profile',auth,registrationUploads,safe(async(req,res)=>{
 const u=req.user,b=req.body,phone=compact(b.phone,30);if(!phone)throw bad('Phone is required.');
 const pass=String(b.new_password||'');if(pass&&pass.length<8)throw bad('New password must be at least 8 characters.');
 if(pass&&pass!==b.confirm_password)throw bad('Passwords do not match.');
 if(u.role==='farmer'&&(!compact(b.location,150)||!JSON.parse(b.crop_types||'[]').length))throw bad('Location and crop types are required.');
 if(u.role==='buyer'&&(!compact(b.physical_address,255)||!ORGS.includes(b.organization_type)))throw bad('Business address and organisation type required.');
 const id=picker(req,'id_document'),map=picker(req,'map_document'),cert=picker(req,'business_certificate');
 for(const f of [id,map,cert])if(f)validateFile(f);
 const hash=pass?await bcrypt.hash(pass,12):null;
 await transaction(async c=>{
  await c.query('UPDATE users SET phone=$1,password=COALESCE($2,password) WHERE user_id=$3',[phone,hash,u.user_id]);
  if(u.role==='farmer'){
   const idPath=await putFile(c,u.user_id,'id_document',id),mapPath=await putFile(c,u.user_id,'map_document',map);
   const f=(await c.query(`UPDATE farmer_details SET location=$1,id_document=COALESCE($2,id_document),map_document=COALESCE($3,map_document) WHERE user_id=$4 RETURNING farmer_id`,[compact(b.location,150),idPath,mapPath,u.user_id])).rows[0];
   await c.query('DELETE FROM farmer_crops WHERE farmer_id=$1',[f.farmer_id]);
   const crops=[...new Set(JSON.parse(b.crop_types).map(x=>compact(x,100)).filter(Boolean))];
   for(const crop of crops)await c.query('INSERT INTO farmer_crops(farmer_id,crop_type) VALUES ($1,$2)',[f.farmer_id,crop]);
  }else if(u.role==='buyer'){
   const fileId=await putFile(c,u.user_id,'business_certificate',cert);
   await c.query('UPDATE buyer_details SET physical_address=$1,organization_type=$2,business_certificate=COALESCE($3,business_certificate) WHERE user_id=$4',[compact(b.physical_address,255),b.organization_type,fileId,u.user_id]);
  }
  if(id||map||cert)await c.query("UPDATE users SET status='pending' WHERE user_id=$1 AND role<>'admin'",[u.user_id]);
 });
 if(id||map||cert)await notifyAccount({email:u.email,name:u.full_name,role:u.role,status:'pending'});
 res.json({message:(id||map||cert)?'Profile updated. Documents will be reviewed again.':'Profile updated successfully.'});
}));

async function getProfileId(user,c=pool){
 const table=user.role==='farmer'?'farmer_details':'buyer_details',id=user.role==='farmer'?'farmer_id':'buyer_id';
 const r=await c.query(`SELECT ${id} AS id FROM ${table} WHERE user_id=$1`,[user.user_id]);
 if(!r.rows.length)throw bad('Please complete your account profile.',404);return r.rows[0].id;
}

app.get('/api/dashboard',auth,safe(async(req,res)=>{
 const u=req.user;
 if(u.role==='admin'){
  const r=await query(`SELECT
 (SELECT COUNT(*) FROM users WHERE role='farmer') AS farmers,
 (SELECT COUNT(*) FROM users WHERE role='buyer') AS buyers,
 (SELECT COUNT(*) FROM users WHERE role='farmer' AND status='pending') AS pending_farmers,
 (SELECT COUNT(*) FROM users WHERE role='buyer' AND status='pending') AS pending_buyers,
 (SELECT COUNT(*) FROM users WHERE status='verified' AND role='farmer') AS verified_farmers,
 (SELECT COUNT(*) FROM users WHERE status='verified' AND role='buyer') AS verified_buyers,
 (SELECT COUNT(*) FROM produce_listings) AS listings,
 (SELECT COUNT(*) FROM demands) AS demands,
 (SELECT COUNT(*) FROM matches WHERE status='accepted') AS accepted_matches`);
  return res.json({stats:r.rows[0],recent:(await query("SELECT full_name,role,status,created_at FROM users WHERE role<>'admin' ORDER BY created_at DESC LIMIT 8")).rows});
 }
 if(u.role==='farmer'){
  const id=await getProfileId(u);const [p,m,c]=await Promise.all([
   query('SELECT status,COUNT(*)::int AS n FROM produce_listings WHERE farmer_id=$1 GROUP BY status',[id]),
   query("SELECT COUNT(*)::int AS n FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id WHERE p.farmer_id=$1 AND m.status='accepted'",[id]),
   query('SELECT crop_type FROM farmer_crops WHERE farmer_id=$1',[id])]);
  return res.json({stats:{listings:p.rows.reduce((s,r)=>s+r.n,0),available:p.rows.find(r=>r.status==='available')?.n||0,matches:Number(m.rows[0].n),crops:c.rows.length},crops:c.rows.map(r=>r.crop_type),recent:(await query('SELECT crop_type,quantity,unit,status,date_posted FROM produce_listings WHERE farmer_id=$1 ORDER BY date_posted DESC LIMIT 5',[id])).rows});
 }
 const id=await getProfileId(u);
 const stats=(await query(`SELECT (SELECT COUNT(*) FROM demands WHERE buyer_id=$1) AS demands,
 (SELECT COUNT(*) FROM demands WHERE buyer_id=$1 AND status='open') AS open_demands,
 (SELECT COUNT(*) FROM demands WHERE buyer_id=$1 AND status='matched') AS matched_demands,
 (SELECT COUNT(*) FROM matches m JOIN demands d ON d.demand_id=m.demand_id WHERE d.buyer_id=$1 AND m.status='accepted') AS matches`,[id])).rows[0];
 res.json({stats,recent:(await query('SELECT crop_type,min_quantity,unit,status,date_posted FROM demands WHERE buyer_id=$1 ORDER BY date_posted DESC LIMIT 5',[id])).rows});
}));

app.get('/api/produce/mine',auth,role('farmer'),safe(async(req,res)=>{
 const id=await getProfileId(req.user);
 res.json({listings:(await query(`SELECT * FROM produce_listings WHERE farmer_id=$1 ORDER BY CASE status WHEN 'available' THEN 0 WHEN 'matched' THEN 1 WHEN 'sold' THEN 2 ELSE 3 END,date_posted DESC`,[id])).rows});
}));
app.post('/api/produce',auth,role('farmer'),verified,upload.fields([{name:'photo',maxCount:1}]),safe(async(req,res)=>{
 const b=req.body,quantity=posNum(b.quantity),price=optionalNum(b.price_per_unit),today=new Date().toISOString().slice(0,10);
 if(!compact(b.crop_type,100)||!quantity||!UNITS.includes(b.unit)||!QUALITIES.includes(b.quality_grade||'ungraded')||!compact(b.location,150)||!dateOrNull(b.available_from))throw bad('Complete the required crop, quantity, unit, grade, location and availability fields.');
 if(price!==null&&(!Number.isFinite(price)||price<0))throw bad('Price must be zero or positive.');
 if(b.harvest_date&&(!dateOrNull(b.harvest_date)||b.harvest_date>today))throw bad('Harvest date cannot be in the future.');
 if(b.available_until&&(!dateOrNull(b.available_until)||b.available_until<b.available_from))throw bad('End date must be after the start date.');
 const file=picker(req,'photo');if(file)validateFile(file,true);
 const id=await getProfileId(req.user);
 const listing=await transaction(async c=>{
  const photo=await putFile(c,req.user.user_id,'produce_photo',file);
  return (await c.query(`INSERT INTO produce_listings(farmer_id,crop_type,variety,quantity,unit,price_per_unit,quality_grade,harvest_date,available_from,available_until,location,description,photo)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[id,compact(b.crop_type,100),compact(b.variety,100)||null,quantity,b.unit,price,b.quality_grade||'ungraded',dateOrNull(b.harvest_date),b.available_from,dateOrNull(b.available_until),compact(b.location,150),compact(b.description,4000)||null,photo])).rows[0];
 });res.status(201).json({message:'Produce listed successfully.',listing});
}));
app.patch('/api/produce/:id/status',auth,role('farmer'),safe(async(req,res)=>{
 const id=await getProfileId(req.user),action=req.body.action;
 const values={mark_sold:'sold',withdraw:'withdrawn',relist:'available'};
 if(!values[action]&&!['delete'].includes(action))throw bad('Invalid listing action.');
 await transaction(async c=>{
  const r=await c.query('SELECT * FROM produce_listings WHERE listing_id=$1 AND farmer_id=$2 FOR UPDATE',[req.params.id,id]);
  if(!r.rows.length)throw bad('Listing not found.',404);
  if(r.rows[0].status==='matched')throw bad('Accepted matches must be cancelled by an administrator before changing this listing.',409);
  if(action==='delete')await c.query('DELETE FROM produce_listings WHERE listing_id=$1',[req.params.id]);
  else await c.query('UPDATE produce_listings SET status=$1 WHERE listing_id=$2',[values[action],req.params.id]);
 });res.json({message:'Produce updated.'});
}));

app.get('/api/demands/mine',auth,role('buyer'),safe(async(req,res)=>{
 const id=await getProfileId(req.user);
 res.json({demands:(await query(`SELECT * FROM demands WHERE buyer_id=$1 ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'matched' THEN 1 WHEN 'fulfilled' THEN 2 ELSE 3 END,date_posted DESC`,[id])).rows});
}));
app.post('/api/demands',auth,role('buyer'),verified,safe(async(req,res)=>{
 const b=req.body,q=posNum(b.min_quantity),price=optionalNum(b.max_price_per_unit);
 if(!compact(b.crop_type,100)||!q||!UNITS.includes(b.unit)||!['any',...QUALITIES.filter(x=>x!=='ungraded')].includes(b.preferred_quality||'any')||!compact(b.preferred_location,150)||!FREQUENCIES.includes(b.frequency||'one_time'))throw bad('Complete the required demand fields.');
 if(price!==null&&(!Number.isFinite(price)||price<0))throw bad('Maximum price is invalid.');
 if(b.needed_by&&!dateOrNull(b.needed_by))throw bad('Invalid needed-by date.');
 const id=await getProfileId(req.user);
 const r=await query(`INSERT INTO demands(buyer_id,crop_type,min_quantity,unit,preferred_quality,max_price_per_unit,preferred_location,needed_by,frequency,description)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[id,compact(b.crop_type,100),q,b.unit,b.preferred_quality||'any',price,compact(b.preferred_location,150),dateOrNull(b.needed_by),b.frequency||'one_time',compact(b.description,4000)||null]);
 res.status(201).json({message:'Demand posted successfully.',demand:r.rows[0]});
}));
app.patch('/api/demands/:id/status',auth,role('buyer'),safe(async(req,res)=>{
 const id=await getProfileId(req.user),action=req.body.action;
 const states={mark_fulfilled:'fulfilled',close:'closed',reopen:'open'};
 if(!states[action]&&action!=='delete')throw bad('Invalid demand action.');
 await transaction(async c=>{
  const r=await c.query('SELECT * FROM demands WHERE demand_id=$1 AND buyer_id=$2 FOR UPDATE',[req.params.id,id]);
  if(!r.rows.length)throw bad('Demand not found.',404);
  if(action==='delete'){
   if(r.rows[0].status==='matched')throw bad('Ask the administrator to cancel accepted matches before deleting this demand.',409);
   await c.query('DELETE FROM demands WHERE demand_id=$1',[req.params.id]);
  }else{
   if(action==='reopen'&&r.rows[0].status==='matched')throw bad('Matched demand cannot be reopened.');
   await c.query('UPDATE demands SET status=$1 WHERE demand_id=$2',[states[action],req.params.id]);
   if(action==='reopen')await refreshDemand(c,req.params.id);
  }
 });res.json({message:'Demand updated.'});
}));

app.get('/api/matches/farmer',auth,role('farmer'),verified,safe(async(req,res)=>res.json(await farmerDiscovery(pool,await getProfileId(req.user)))));
app.get('/api/matches/buyer',auth,role('buyer'),verified,safe(async(req,res)=>res.json(await buyerDiscovery(pool,await getProfileId(req.user)))));
app.post('/api/matches/request',auth,role('farmer','buyer'),verified,safe(async(req,res)=>{
 const b=req.body;const r=await transaction(c=>makeRequest(c,Number(b.listing_id),Number(b.demand_id),req.user));
 await notifyMatch(r.match_id,'request');
 res.status(201).json({message:'Match request sent. Contact details will be shared when accepted.',match:r});
}));
app.post('/api/matches/request-bundle',auth,role('buyer'),verified,safe(async(req,res)=>{
 const demandId=Number(req.body.demand_id),buyerId=await getProfileId(req.user);
 const d=(await query('SELECT * FROM demands WHERE demand_id=$1 AND buyer_id=$2',[demandId,buyerId])).rows[0];
 if(!d)throw bad('Demand not found.',404);
 const cov=await coverage(pool,demandId);if(d.status!=='open')throw bad('Demand is not open.');
 let sent=0;const ids=[];
 for(const l of cov.listings.filter(x=>x.in_bundle&&!x.match_status)){
  try{const added=await transaction(c=>makeRequest(c,l.listing_id,demandId,req.user));ids.push(added.match_id);sent++;}catch(e){if(e.status!==409&&e.status!==400)throw e;}
 }
 for(const id of ids)await notifyMatch(id,'request');
 res.json({message:`Match requests sent to ${sent} farmer(s).`,sent});
}));
app.post('/api/matches/:id/respond',auth,role('farmer','buyer'),verified,safe(async(req,res)=>{
 const info=await transaction(c=>answerRequest(c,Number(req.params.id),req.body.action,req.user));
 await notifyMatch(Number(req.params.id),'response');
 res.json({message:info.status==='accepted'?'Match accepted. Contact details are now available.':'Match request declined.',match:info});
}));

app.get('/api/files/:id',auth,safe(async(req,res)=>{
 const file=(await query('SELECT id,owner_user_id,purpose,original_name,mime_type,bytes FROM stored_files WHERE id=$1',[req.params.id])).rows[0];
 if(!file)throw bad('File not found.',404);
 if(Number(file.owner_user_id)!==Number(req.user.user_id)&&req.user.role!=='admin'&&!(file.purpose==='produce_photo'&&req.user.status==='verified'))throw bad('You are not allowed to view this file.',403);
 res.set({'Content-Type':file.mime_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename="${file.original_name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`});res.send(file.bytes);
}));

app.get('/api/admin/users',auth,role('admin'),safe(async(req,res)=>{
 const r=req.query.role;if(!['farmer','buyer'].includes(r))throw bad('Choose farmer or buyer.');
 const sql=r==='farmer'?`SELECT u.user_id,u.full_name,u.email,u.phone,u.status,u.created_at,f.farmer_id,f.location,f.id_document,f.map_document,
  (SELECT string_agg(crop_type,', ' ORDER BY crop_type) FROM farmer_crops WHERE farmer_id=f.farmer_id) AS crops FROM users u JOIN farmer_details f ON f.user_id=u.user_id WHERE u.role='farmer' ORDER BY u.created_at DESC`:
  `SELECT u.user_id,u.full_name,u.email,u.phone,u.status,u.created_at,b.buyer_id,b.organization_type,b.physical_address,b.business_certificate FROM users u JOIN buyer_details b ON b.user_id=u.user_id WHERE u.role='buyer' ORDER BY u.created_at DESC`;
 res.json({users:(await query(sql)).rows});
}));
app.patch('/api/admin/users/:id/status',auth,role('admin'),safe(async(req,res)=>{
 const action=req.body.action;if(!['approve','reject'].includes(action))throw bad('Select approve or reject.');
 const r=await query("UPDATE users SET status=$1 WHERE user_id=$2 AND role IN ('farmer','buyer') RETURNING email,full_name,status,role",[action==='approve'?'verified':'rejected',req.params.id]);
 if(!r.rowCount)throw bad('Account not found.',404);
 const u=r.rows[0];await notifyAccount({email:u.email,name:u.full_name,role:u.role,status:u.status});
 res.json({message:`Account ${u.status}.`});
}));
app.get('/api/admin/produce',auth,role('admin'),safe(async(req,res)=>{
 const params=[],where=[];
 if(req.query.status){params.push(req.query.status);where.push(`p.status=$${params.length}`);}
 if(req.query.crop){params.push(req.query.crop);where.push(`p.crop_type=$${params.length}`);}
 const r=await query(`SELECT p.*,u.full_name AS farmer_name,u.phone AS farmer_phone,u.email AS farmer_email FROM produce_listings p JOIN farmer_details f ON f.farmer_id=p.farmer_id JOIN users u ON u.user_id=f.user_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY p.date_posted DESC`,params);
 res.json({listings:r.rows});
}));
app.patch('/api/admin/produce/:id/status',auth,role('admin'),safe(async(req,res)=>{
 const action=req.body.action;if(!['withdraw','delete'].includes(action))throw bad('Invalid action.');
 await transaction(async c=>{
  const p=(await c.query('SELECT * FROM produce_listings WHERE listing_id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!p)throw bad('Listing not found.',404);
  if(p.status==='matched')throw bad('Cancel any accepted match before removing this listing.',409);
  await c.query(action==='delete'?'DELETE FROM produce_listings WHERE listing_id=$1':"UPDATE produce_listings SET status='withdrawn' WHERE listing_id=$1",[req.params.id]);
 });res.json({message:'Listing updated.'});
}));
app.get('/api/admin/matches',auth,role('admin'),safe(async(req,res)=>{
 const p=[],where=[];if(req.query.status){p.push(req.query.status);where.push(`m.status=$${p.length}`);}
 const r=await query(`SELECT m.*,p.crop_type,p.quantity,p.unit,p.location AS farmer_location,uf.full_name AS farmer_name,uf.phone AS farmer_phone,
  d.min_quantity,d.unit AS demand_unit,d.preferred_location,ub.full_name AS buyer_name,ub.phone AS buyer_phone
  FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id JOIN farmer_details f ON f.farmer_id=p.farmer_id JOIN users uf ON uf.user_id=f.user_id
  JOIN demands d ON d.demand_id=m.demand_id JOIN buyer_details b ON b.buyer_id=d.buyer_id JOIN users ub ON ub.user_id=b.user_id
  ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY m.match_date DESC`,p);res.json({matches:r.rows});
}));
app.post('/api/admin/matches/:id/cancel',auth,role('admin'),safe(async(req,res)=>{
 await transaction(async c=>{
  const m=(await c.query('SELECT * FROM matches WHERE match_id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!m)throw bad('Match not found.',404);
  if(m.status==='rejected')throw bad('This match is already declined.',409);
  await c.query("UPDATE matches SET status='rejected' WHERE match_id=$1",[m.match_id]);
  if(m.status==='accepted'){
   await c.query("UPDATE produce_listings SET status='available' WHERE listing_id=$1 AND status='matched'",[m.listing_id]);
   await refreshDemand(c,m.demand_id);
  }
 });res.json({message:'Match cancelled.'});
}));
app.get('/api/admin/reports',auth,role('admin'),safe(async(req,res)=>{
 const [users,produce,demands,matches,supply,need,recent]=await Promise.all([
  query("SELECT role,status,COUNT(*)::int AS n FROM users WHERE role IN ('farmer','buyer') GROUP BY role,status"),
  query('SELECT status,COUNT(*)::int AS n FROM produce_listings GROUP BY status'),
  query('SELECT status,COUNT(*)::int AS n FROM demands GROUP BY status'),
  query('SELECT status,COUNT(*)::int AS n FROM matches GROUP BY status'),
  query(`SELECT crop_type, CASE WHEN unit='crates' THEN 'crates' ELSE 'kg' END AS unit,
    SUM(quantity * CASE unit WHEN 'tonnes' THEN 1000 WHEN 'bags_50kg' THEN 50 WHEN 'bags_90kg' THEN 90 ELSE 1 END)::numeric AS quantity,
    COUNT(*)::int AS listings FROM produce_listings GROUP BY crop_type, CASE WHEN unit='crates' THEN 'crates' ELSE 'kg' END ORDER BY quantity DESC LIMIT 5`),
  query(`SELECT crop_type, CASE WHEN unit='crates' THEN 'crates' ELSE 'kg' END AS unit,
    SUM(min_quantity * CASE unit WHEN 'tonnes' THEN 1000 WHEN 'bags_50kg' THEN 50 WHEN 'bags_90kg' THEN 90 ELSE 1 END)::numeric AS quantity,
    COUNT(*)::int AS demands FROM demands GROUP BY crop_type, CASE WHEN unit='crates' THEN 'crates' ELSE 'kg' END ORDER BY quantity DESC LIMIT 5`),
  query(`SELECT m.match_date,m.status,p.crop_type,uf.full_name AS farmer_name,ub.full_name AS buyer_name
   FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id JOIN farmer_details f ON f.farmer_id=p.farmer_id JOIN users uf ON uf.user_id=f.user_id
   JOIN demands d ON d.demand_id=m.demand_id JOIN buyer_details b ON b.buyer_id=d.buyer_id JOIN users ub ON ub.user_id=b.user_id
   ORDER BY m.match_date DESC LIMIT 10`)
 ]);
 res.json({users:users.rows,produce:produce.rows,demands:demands.rows,matches:matches.rows,top_supply:supply.rows,top_demand:need.rows,recent:recent.rows});
}));
app.use('/api',(req,res)=>res.status(404).json({error:'API route not found.'}));
app.use((err,req,res,next)=>{
 if(err?.code==='23505')return res.status(409).json({error:err.constraint==='users_email_lower_idx'?'Email already registered.':'Record already exists.'});
 if(err?.code==='23503')return res.status(409).json({error:'This item is linked to another record.'});
 if(err instanceof SyntaxError&&err.message.includes('JSON'))return res.status(400).json({error:'Invalid request format.'});
 if(err?.name==='MulterError')return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'File must be 5 MB or less.':'Invalid file upload.'});
 console.error('Request error:',err.message);
 res.status(err.status||500).json({error:err.status?err.message:'Unexpected server error. Please check backend logs.'});
});
