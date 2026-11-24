/** Port of matching/match_engine.php. Crop matches exactly; location is not a filter.
 * Weight units are converted to kilograms; crates never mix with weight units.
 * Contact info must not be supplied to candidate functions before acceptance.
 */
import {bad,num} from './common.js';
const FACTOR={kg:1,tonnes:1000,bags_50kg:50,bags_90kg:90,crates:1};
export const unitFamily = u => u==='crates'?'crates':'weight';
export const toBase = (q,u) => Number(q)*FACTOR[u];
export const fromBase = (q,u) => q/FACTOR[u];
export function evaluateCoverage(demand,candidates,accepted=[]){
 const required=toBase(demand.min_quantity,demand.unit);
 const acceptedBase=accepted.filter(r=>unitFamily(r.unit)===unitFamily(demand.unit)).reduce((s,r)=>s+toBase(r.quantity,r.unit),0);
 const remaining=Math.max(0,required-acceptedBase);
 const compatible=candidates.filter(r=>unitFamily(r.unit)===unitFamily(demand.unit)).map(r=>({...r,base_qty:toBase(r.quantity,r.unit)}));
 const pool=compatible.filter(r=>r.match_status!=='rejected').sort((a,b)=>b.base_qty-a.base_qty);
 const poolBase=pool.reduce((s,r)=>s+r.base_qty,0);
 const bundle=new Set();let gathered=0;
 for(const item of pool){if(gathered+0.0001>=remaining)break;bundle.add(Number(item.listing_id));gathered+=item.base_qty;}
 const listings=compatible.map(r=>({...r,in_bundle:bundle.has(Number(r.listing_id))})).sort((a,b)=>
   Number(a.match_status==='rejected')-Number(b.match_status==='rejected') || Number(b.in_bundle)-Number(a.in_bundle) || b.base_qty-a.base_qty);
 return {demand,unit:demand.unit,required:fromBase(required,demand.unit),accepted_qty:fromBase(acceptedBase,demand.unit),pool_qty:fromBase(poolBase,demand.unit),
  shortfall:fromBase(Math.max(0,required-acceptedBase-poolBase),demand.unit),fulfillable:acceptedBase+poolBase+0.0001>=required,
  fully_accepted:acceptedBase+0.0001>=required,accepted_pct:required?Math.min(100,acceptedBase/required*100):0,
  potential_pct:required?Math.min(100,(acceptedBase+poolBase)/required*100):0,bundle_count:bundle.size,listings};
}
export async function coverage(client,demandId){
 const dr=await client.query('SELECT * FROM demands WHERE demand_id=$1',[demandId]);if(!dr.rows.length)return null;
 const demand=dr.rows[0];
 const [ar,cr]=await Promise.all([
  client.query("SELECT p.quantity,p.unit FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id WHERE m.demand_id=$1 AND m.status='accepted'",[demandId]),
  client.query(`SELECT p.listing_id,p.crop_type,p.variety,p.quantity,p.unit,p.price_per_unit,p.quality_grade,p.harvest_date,p.available_from,p.available_until,p.location,p.description,p.photo,p.status,p.date_posted,
      u.full_name AS farmer_name,m.match_id,m.status AS match_status,m.requested_by
      FROM produce_listings p JOIN farmer_details f ON f.farmer_id=p.farmer_id JOIN users u ON u.user_id=f.user_id AND u.status='verified'
      LEFT JOIN matches m ON m.listing_id=p.listing_id AND m.demand_id=$1
      WHERE p.status='available' AND LOWER(p.crop_type)=LOWER($2)`,[demandId,demand.crop_type])
 ]);
 return evaluateCoverage(demand,cr.rows,ar.rows);
}
export async function acceptedForDemand(client,id){
 const r=await client.query(`SELECT m.match_id,p.listing_id,p.crop_type,p.variety,p.quantity,p.unit,p.quality_grade,p.price_per_unit,p.location,p.photo,p.description,
  u.full_name AS farmer_name,u.phone AS farmer_phone,u.email AS farmer_email
  FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id JOIN farmer_details f ON f.farmer_id=p.farmer_id JOIN users u ON u.user_id=f.user_id
  WHERE m.demand_id=$1 AND m.status='accepted' ORDER BY m.match_date DESC`,[id]);return r.rows;
}
export async function acceptedForFarmer(client,id){
 const r=await client.query(`SELECT m.match_id,m.match_date,p.crop_type,p.variety,p.quantity AS listing_quantity,p.unit AS listing_unit,
  d.min_quantity,d.unit AS demand_unit,d.preferred_location,d.needed_by,d.frequency,
  u.full_name AS buyer_name,u.phone AS buyer_phone,u.email AS buyer_email,b.physical_address AS buyer_address,b.organization_type AS buyer_org_type
  FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id JOIN demands d ON d.demand_id=m.demand_id
  JOIN buyer_details b ON b.buyer_id=d.buyer_id JOIN users u ON u.user_id=b.user_id
  WHERE p.farmer_id=$1 AND m.status='accepted' ORDER BY m.match_date DESC`,[id]);return r.rows;
}
export async function acceptedBase(client,demand){
 const {rows}=await client.query("SELECT p.quantity,p.unit FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id WHERE m.demand_id=$1 AND m.status='accepted'",[demand.demand_id]);
 return rows.filter(r=>unitFamily(r.unit)===unitFamily(demand.unit)).reduce((s,r)=>s+toBase(r.quantity,r.unit),0);
}
export async function refreshDemand(client,id){
 const d=(await client.query('SELECT * FROM demands WHERE demand_id=$1',[id])).rows[0];
 if(!d||!['open','matched'].includes(d.status))return;
 const qty=await acceptedBase(client,d);
 const status=qty+0.0001>=toBase(d.min_quantity,d.unit)?'matched':'open';
 await client.query('UPDATE demands SET status=$1 WHERE demand_id=$2',[status,id]);
 return status;
}
export async function makeRequest(c,listingId,demandId,actor){
 const p=(await c.query(`SELECT p.*,f.user_id AS farmer_user_id FROM produce_listings p JOIN farmer_details f ON f.farmer_id=p.farmer_id WHERE p.listing_id=$1`,[listingId])).rows[0];
 const d=(await c.query(`SELECT d.*,b.user_id AS buyer_user_id FROM demands d JOIN buyer_details b ON b.buyer_id=d.buyer_id WHERE d.demand_id=$1`,[demandId])).rows[0];
 if(!p||!d)throw bad('This listing or demand no longer exists.',404);
 if(actor.role==='farmer'&&Number(p.farmer_user_id)!==Number(actor.user_id))throw bad('You may request matches only for your own produce.',403);
 if(actor.role==='buyer'&&Number(d.buyer_user_id)!==Number(actor.user_id))throw bad('You may request matches only for your own demand.',403);
 const active=(await c.query('SELECT user_id,status FROM users WHERE user_id IN ($1,$2)',[p.farmer_user_id,d.buyer_user_id])).rows;
 if(active.length!==2||active.some(u=>u.status!=='verified'))throw bad('Both accounts must be verified before matching.');
 if(p.status!=='available'||d.status!=='open')throw bad('Only available produce and open demands can be matched.');
 if(p.crop_type.toLowerCase()!==d.crop_type.toLowerCase()||unitFamily(p.unit)!==unitFamily(d.unit))throw bad('The crops or measurement units are not compatible.');
 const r=await c.query("INSERT INTO matches(listing_id,demand_id,requested_by) VALUES ($1,$2,$3) ON CONFLICT (listing_id,demand_id) DO NOTHING RETURNING match_id",[listingId,demandId,actor.role]);
 if(!r.rowCount)throw bad('A request already exists for this pair of produce and demand.',409);
 return r.rows[0];
}
export async function answerRequest(c,matchId,action,actor){
 if(!['accept','reject'].includes(action))throw bad('Choose accept or reject.');
 const r=await c.query(`SELECT m.*,p.farmer_id,p.status AS produce_status,d.buyer_id,d.status AS demand_status,
 f.user_id AS farmer_user_id,b.user_id AS buyer_user_id
 FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id JOIN demands d ON d.demand_id=m.demand_id
 JOIN farmer_details f ON f.farmer_id=p.farmer_id JOIN buyer_details b ON b.buyer_id=d.buyer_id
 WHERE m.match_id=$1 FOR UPDATE OF m,p,d`,[matchId]);
 const m=r.rows[0];if(!m)throw bad('Match not found.',404);
 if(m.status!=='proposed')throw bad('This request has already been answered.',409);
 if(actor.role===m.requested_by)throw bad('You cannot answer a match you initiated.',403);
 const belongs=actor.role==='farmer'?Number(m.farmer_user_id)===Number(actor.user_id):Number(m.buyer_user_id)===Number(actor.user_id);
 if(!belongs)throw bad('This match does not belong to you.',403);
 if(action==='accept'&&(m.produce_status!=='available'||m.demand_status!=='open'))throw bad('The produce or demand is no longer available.',409);
 await c.query('UPDATE matches SET status=$1 WHERE match_id=$2',[action==='accept'?'accepted':'rejected',matchId]);
 if(action==='accept'){
  await c.query("UPDATE produce_listings SET status='matched' WHERE listing_id=$1",[m.listing_id]);
  await c.query("UPDATE matches SET status='rejected' WHERE listing_id=$1 AND match_id<>$2 AND status='proposed'",[m.listing_id,matchId]);
  await refreshDemand(c,m.demand_id);
 }
 return {status:action==='accept'?'accepted':'rejected',listing_id:m.listing_id,demand_id:m.demand_id};
}
export async function farmerDiscovery(c,farmerId){
 const available=(await c.query("SELECT * FROM produce_listings WHERE farmer_id=$1 AND status='available' ORDER BY date_posted DESC",[farmerId])).rows;
 for(const listing of available){
  const {rows}=await c.query(`SELECT d.*,u.full_name AS buyer_name,b.organization_type AS buyer_org_type,m.match_id,m.status AS match_status,m.requested_by
    FROM demands d JOIN buyer_details b ON b.buyer_id=d.buyer_id JOIN users u ON u.user_id=b.user_id AND u.status='verified'
    LEFT JOIN matches m ON m.demand_id=d.demand_id AND m.listing_id=$1 WHERE d.status='open' AND LOWER(d.crop_type)=LOWER($2)`,[listing.listing_id,listing.crop_type]);
  const list=[];
  for(const d of rows){if(unitFamily(d.unit)!==unitFamily(listing.unit))continue;
   const accepted=await acceptedBase(c,d);const remaining=Math.max(0,toBase(d.min_quantity,d.unit)-accepted);if(remaining<=0.0001)continue;
   list.push({...d,remaining_qty:fromBase(remaining,d.unit),accepted_qty:fromBase(accepted,d.unit),accepted_pct:Math.min(100,100*accepted/toBase(d.min_quantity,d.unit)),covers_pct:Math.min(100,100*toBase(listing.quantity,listing.unit)/remaining)});
  }
  listing.candidates=list.sort((a,b)=>Number(a.match_status==='rejected')-Number(b.match_status==='rejected')||num(b.remaining_qty)-num(a.remaining_qty));
 }
 const incoming=(await c.query(`SELECT m.match_id,m.match_date,p.listing_id,p.crop_type,p.quantity,p.unit,d.demand_id,d.min_quantity,d.unit AS demand_unit,d.preferred_location,
 u.full_name AS buyer_name
 FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id JOIN demands d ON d.demand_id=m.demand_id
 JOIN buyer_details b ON b.buyer_id=d.buyer_id JOIN users u ON u.user_id=b.user_id
 WHERE p.farmer_id=$1 AND m.status='proposed' AND m.requested_by='buyer' AND p.status='available' AND d.status='open' ORDER BY m.match_date DESC`,[farmerId])).rows;
 return {listings:available,incoming,accepted:await acceptedForFarmer(c,farmerId)};
}
export async function buyerDiscovery(c,buyerId){
 const demands=(await c.query("SELECT * FROM demands WHERE buyer_id=$1 AND status IN ('open','matched') ORDER BY date_posted DESC",[buyerId])).rows;
 for(const d of demands){d.coverage=await coverage(c,d.demand_id);d.accepted=await acceptedForDemand(c,d.demand_id);}
 const incoming=(await c.query(`SELECT m.match_id,m.match_date,p.listing_id,p.crop_type,p.quantity,p.unit,d.demand_id,d.min_quantity,d.unit AS demand_unit,
 u.full_name AS farmer_name
 FROM matches m JOIN produce_listings p ON p.listing_id=m.listing_id JOIN farmer_details f ON f.farmer_id=p.farmer_id JOIN users u ON u.user_id=f.user_id
 JOIN demands d ON d.demand_id=m.demand_id WHERE d.buyer_id=$1 AND m.status='proposed' AND m.requested_by='farmer' AND d.status='open' AND p.status='available' ORDER BY m.match_date DESC`,[buyerId])).rows;
 return {demands,incoming};
}
