export const CROPS=['Maize','Groundnuts','Beans','Soya','Rice','Tobacco','Vegetables','Fruits'];
export const UNITS=['kg','tonnes','bags_50kg','bags_90kg','crates'];
export const QUALITIES=['grade_a','grade_b','grade_c','ungraded'];
export const ORGS=['school','hotel','manufacturing_company','hospital','retailer','wholesaler','exporter','other'];
export const FREQUENCIES=['one_time','weekly','monthly','ongoing'];
export const compact = (s,max=255) => String(s||'').trim().slice(0,max);
export const posNum = n => {const x=Number(n);return Number.isFinite(x)&&x>0&&x<=1000000000 ? x : null;};
export const optionalNum = n => (n===''||n===null||n===undefined)? null : Number(n);
export const dateOrNull = s => (!s ? null : /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null);
export function bad(msg,status=400){const e=new Error(msg);e.status=status;return e;}
export const safe = fn => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export const num = n=>Number(n||0);
