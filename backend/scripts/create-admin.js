import readline from 'node:readline/promises';
import bcrypt from 'bcryptjs';
import {stdin as input,stdout as output} from 'node:process';
import {pool} from '../src/db.js';
const rl=readline.createInterface({input,output});
try{
 const name=(await rl.question('Administrator full name: ')).trim();
 const email=(await rl.question('Administrator email: ')).trim().toLowerCase();
 const phone=(await rl.question('Administrator phone: ')).trim();
 const password=(await rl.question('Administrator password (min 12 characters, input visible): '));
 if(!name||!email.includes('@')||!phone||password.length<12)throw Error('Provide name, valid email, phone and a password of at least 12 characters.');
 const hash=await bcrypt.hash(password,12);
 await pool.query("INSERT INTO users(role,full_name,email,phone,password,status) VALUES ('admin',$1,$2,$3,$4,'verified')",[name,email,phone,hash]);
 console.log('Administrator created. Keep the password private.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{rl.close();await pool.end();}
