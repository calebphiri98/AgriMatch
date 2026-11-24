const base=(import.meta.env.VITE_API_URL || '/api').replace(/\/+$/,'');
export const apiBase=base;
export const getToken=()=>localStorage.getItem('agrimatch_token');
export const saveToken=t=>localStorage.setItem('agrimatch_token',t);
export const clearToken=()=>localStorage.removeItem('agrimatch_token');
export async function api(path,{method='GET',body,...opts}={}){
 const headers={...(opts.headers||{})};const token=getToken();if(token)headers.Authorization=`Bearer ${token}`;
 if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
 let r;
 try{r=await fetch(base+path,{method,body,headers,...opts});}
 catch{throw new Error('Cannot connect to the backend. Check that Express is running and VITE_API_URL points to /api.');}
 const data=await r.json().catch(()=>({}));
 if(!r.ok){if(r.status===401){clearToken();window.dispatchEvent(new Event('agrimatch-expired'));}
 throw new Error(data.error||`Request failed (${r.status})`);}
 return data;
}
export async function openFile(id){
 if(!id)return;
 // Open the preview synchronously from the click to avoid browser popup blocking.
 const preview=window.open('about:blank','_blank');
 if(preview)preview.opener=null;
 try {
  const r=await fetch(`${base}/files/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${getToken()}`}});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||'Cannot open the document.');}
  const url=URL.createObjectURL(await r.blob());
  if(preview)preview.location.href=url;
  else{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.download='agrimatch-document';a.click();}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){if(preview)preview.close();throw e;}
}
export async function blobFile(id){
 if(!id)return null;
 const r=await fetch(`${base}/files/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${getToken()}`}});
 if(!r.ok)throw Error('Photo cannot be loaded.');return URL.createObjectURL(await r.blob());
}
export const pretty = s=>String(s??'—').replaceAll('_',' ').replace(/\b\w/g,t=>t.toUpperCase());
export const fmtDate=s=>s?new Date(s).toLocaleDateString('en-MW',{day:'numeric',month:'short',year:'numeric'}):'—';
export const fmtNum=n=>Number(n||0).toLocaleString('en-MW',{maximumFractionDigits:2});
export const mwk=n=>(n===null||n===undefined||n==='')?'—':`MWK ${fmtNum(n)}`;
export const labelUnit=u=>({kg:'kg',tonnes:'tonnes',bags_50kg:'50kg bags',bags_90kg:'90kg bags',crates:'crates'})[u]||u;
export const today=()=>new Date().toISOString().slice(0,10);
export function toForm(obj,files={}){const data=new FormData();for(const [key,value] of Object.entries(obj)){
 if(value===undefined||value===null)continue;data.append(key,Array.isArray(value)?JSON.stringify(value):String(value));}
 for(const [key,v] of Object.entries(files))if(v)data.append(key,v);return data;
}
