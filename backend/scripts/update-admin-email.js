import {pool} from '../src/db.js';

const newEmail='comfortolesi@gmail.com';
const client=await pool.connect();
try {
  await client.query('BEGIN');
  const admins=await client.query("SELECT user_id, email FROM users WHERE role='admin' FOR UPDATE");
  if(admins.rows.length!==1){
    throw new Error(`Expected exactly one administrator, found ${admins.rows.length}. No changes made.`);
  }
  const existing=await client.query('SELECT user_id FROM users WHERE LOWER(email)=LOWER($1) AND user_id<>$2',[newEmail,admins.rows[0].user_id]);
  if(existing.rowCount){throw new Error('The new email already belongs to another account. No changes made.');}
  const result=await client.query('UPDATE users SET email=$1 WHERE user_id=$2 RETURNING user_id, full_name, email, role, status',[newEmail,admins.rows[0].user_id]);
  await client.query('COMMIT');
  console.log('Administrator email updated successfully (password unchanged):');
  console.table(result.rows);
} catch(error){
  await client.query('ROLLBACK');
  console.error('Administrator email was not changed:',error.message);
  process.exitCode=1;
} finally {
  client.release();
  await pool.end();
}
