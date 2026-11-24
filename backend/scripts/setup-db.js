import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {pool} from '../src/db.js';
const path=fileURLToPath(new URL('../../database/schema.sql',import.meta.url));
try {await pool.query(await fs.readFile(path,'utf8')); console.log('AgriMatch PostgreSQL schema is ready. Existing records were preserved.');}
catch(e){console.error('Database setup failed:',e.message);process.exitCode=1;}
finally{await pool.end();}
