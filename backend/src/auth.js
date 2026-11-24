import jwt from 'jsonwebtoken';
import {query} from './db.js';
import {bad, safe} from './common.js';
const secret = () => {let s=process.env.JWT_ACCESS_SECRET||process.env.JWT_SECRET;if(!s||s.includes('REPLACE_WITH')||s.length<32)throw bad('JWT_ACCESS_SECRET (or JWT_SECRET) must be a strong secret of at least 32 characters.',503);return s;};
export const sign = u => jwt.sign({uid:u.user_id},secret(),{expiresIn:process.env.JWT_ACCESS_EXPIRY||'8h'});
export const auth = safe(async(req,res,next)=>{
 const token=(req.get('Authorization')||'').replace(/^Bearer\s+/i,'');if(!token)throw bad('Please log in.',401);
 let payload;try{payload=jwt.verify(token,secret());}catch{throw bad('Session expired. Please log in again.',401);}
 const {rows}=await query('SELECT user_id,full_name,email,phone,role,status,created_at FROM users WHERE user_id=$1',[payload.uid]);
 if(!rows.length||rows[0].status==='rejected')throw bad('Account not permitted.',403);
 req.user=rows[0];next();
});
export const role = (...roles)=>(req,res,next)=>roles.includes(req.user?.role)?next():next(bad('You do not have permission for this action.',403));
export const verified=(req,res,next)=>(req.user.status==='verified'||req.user.role==='admin')?next():next(bad('Your account is pending administrator verification.',403));
