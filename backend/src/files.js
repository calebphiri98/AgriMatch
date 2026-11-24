import multer from 'multer';
import crypto from 'node:crypto';
import {bad} from './common.js';
const limits={fileSize:5*1024*1024,files:3};
export const upload=multer({storage:multer.memoryStorage(),limits});
export function validateFile(file,photo=false){
 if(!file)return null;
 const b=file.buffer;
 const pdf=b.slice(0,5).toString()==='%PDF-';
 const png=b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=b.length>3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
 if(!(png||jpeg||(!photo&&pdf)))throw bad('Only genuine PDF, PNG and JPEG files are allowed (photos: PNG/JPEG).');
 if(b.length>5242880)throw bad('Maximum file size is 5 MB.');
 return {mime:pdf?'application/pdf':png?'image/png':'image/jpeg'};
}
export async function putFile(client,userId,purpose,file){
 if(!file)return null;const {mime}=validateFile(file,purpose==='produce_photo');const id=crypto.randomUUID();
 await client.query('INSERT INTO stored_files(id,owner_user_id,purpose,original_name,mime_type,bytes,size_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7)',[id,userId,purpose,file.originalname.slice(0,200),mime,file.buffer,file.size]);return id;
}
export function picker(req,key){return req.files?.[key]?.[0]??null;}
