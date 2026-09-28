/* NetWizard Global Device Catalog v1 */
(function initNetWizardGlobalDeviceCatalog(root){
'use strict';

const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
function slug(v){return clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);}
function globalId(model){
  const m=model||{};
  return ['global',slug(m.manufacturer),slug(m.model),slug(m.sku),slug(m.revision)].filter(Boolean).join('-').slice(0,160);
}
function authState(){
  const A=root.NetWizardAuth;
  return A&&typeof A.state==='function'?A.state():{authenticated:false,user:null,capabilities:{}};
}
function canPromote(){
  const s=authState();
  return !!(s.authenticated&&s.user&&s.user.isAdmin&&s.capabilities&&s.capabilities.globalDeviceCatalog);
}
async function request(url,init){
  if(!root.fetch)throw new Error('fetch unavailable');
  const res=await root.fetch(url,Object.assign({credentials:'same-origin'},init||{}));
  let body=null;try{body=await res.json();}catch{}
  if(!res.ok){const err=new Error((body&&body.error)||('catalog request failed: '+res.status));err.status=res.status;throw err;}
  return body;
}
async function list(){
  const body=await request('/api/device-models/global');
  return Array.isArray(body&&body.models)?body.models.map(clone):[];
}
async function promote(model){
  if(!canPromote())throw new Error('global catalog admin required');
  const s=authState(),id=globalId(model);
  if(!id||id==='global')throw new Error('manufacturer and model are required');
  const definition=clone(model||{});
  delete definition.id;
  const item=await request('/api/device-models/global/'+encodeURIComponent(id),{
    method:'PUT',
    headers:{'Content-Type':'application/json','X-NetWizard-CSRF':s.user.csrfToken},
    body:JSON.stringify({definition})
  });
  return item;
}
const api={version:'netwizard-global-device-catalog-v1',globalId,canPromote,list,promote};
root.NetWizardGlobalDeviceCatalog=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
