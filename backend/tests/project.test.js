import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../../database/schema.sql',import.meta.url),'utf8');
const api=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
test('Schema retains all seven original business tables',()=>{for(const t of ['users','farmer_details','farmer_crops','buyer_details','produce_listings','demands','matches'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`))});
test('Database enforces unique accepted matches per listing',()=>assert.match(sql,/one_accepted_demand_per_listing[\s\S]+?WHERE status='accepted'/));
test('Produce and identity documents use persistent PostgreSQL file storage',()=>{assert.match(sql,/CREATE TABLE IF NOT EXISTS stored_files/);assert.match(api,/putFile\(/)});
test('Matching candidate query does not reveal contacts',()=>{const m=readFileSync(new URL('../src/matching.js',import.meta.url),'utf8');const start=m.indexOf('export async function coverage');const end=m.indexOf('export async function acceptedForDemand');assert.ok(start>=0&&end>start);assert.doesNotMatch(m.slice(start,end),/farmer_phone|farmer_email/)});
