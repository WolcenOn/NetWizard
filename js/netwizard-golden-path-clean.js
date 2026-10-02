/* NetWizard Clean Multisite Golden Path loader */
(function initNetWizardGoldenPathClean(root){
'use strict';

const SAMPLE_URL='./samples/golden-path-multisite-clean.json';

async function fetchPayload(){
  const response=await root.fetch(SAMPLE_URL,{cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo cargar Golden Multisede ('+response.status+').');
  return response.json();
}
async function preparedProject(){
  const payload=await fetchPayload();
  const Schema=root.NetWizardProjectSchema;
  if(!Schema||typeof Schema.prepareImport!=='function')throw new Error('NetWizardProjectSchema no está disponible.');
  const prepared=Schema.prepareImport(payload);
  if(!prepared.ok)throw new Error('Golden Multisede inválido: '+prepared.errors.join(' · '));
  return prepared.project;
}
async function loadIntoProject(){
  const project=await preparedProject();
  if(!root.NetWizardState||typeof root.NetWizardState.replaceProject!=='function')throw new Error('NetWizardState no está disponible.');
  root.NetWizardState.replaceProject(project,{source:'golden-path-multisite-clean'});
  if(typeof root.navTo==='function')root.navTo('dash');
  return project;
}
let lastLoadPromise=null;
function beginLoad(){
  lastLoadPromise=loadIntoProject();
  api.lastLoadPromise=lastLoadPromise;
  return lastLoadPromise;
}
async function download(){
  const a=root.document.createElement('a');
  a.href=SAMPLE_URL;
  a.download='netwizard-golden-path-multisite-clean.json';
  root.document.body.appendChild(a);a.click();a.remove();
  return true;
}
function inject(){
  if(!root.document||root.document.getElementById('btnGoldenPathClean'))return;
  const anchor=root.document.getElementById('btnGoldenPathEnterprise')||
    root.document.getElementById('btnFourSitesSampleDownload')||
    root.document.getElementById('impJsonFile')||
    root.document.getElementById('impJson');
  if(!anchor)return;

  const load=root.document.createElement('button');
  load.id='btnGoldenPathClean';load.type='button';load.className='btn bp';
  load.textContent='✅ Cargar Golden Multisede limpio';
  load.title='Referencia production-ready: 4 sedes, 4 routers en anillo OSPF, LACP, segmentación, Wi-Fi y seguridad L2';
  load.onclick=async()=>{
    if(root.confirm&&!root.confirm('Sustituir el proyecto actual por el Golden Multisede limpio?'))return;
    try{await beginLoad();}
    catch(error){root.alert?root.alert(error.message):root.console?.error(error);}
  };

  const dl=root.document.createElement('button');
  dl.id='btnGoldenPathCleanDownload';dl.type='button';dl.className='btn bs';
  dl.textContent='⬇ JSON Golden limpio';
  dl.onclick=async()=>{try{await download();}catch(error){root.alert?root.alert(error.message):root.console?.error(error);}};

  anchor.insertAdjacentElement('afterend',dl);
  anchor.insertAdjacentElement('afterend',load);
}
const api={
  version:'netwizard-golden-path-clean-v1',url:SAMPLE_URL,
  fetchPayload,preparedProject,loadIntoProject,beginLoad,lastLoadPromise,download,inject
};
root.NetWizardGoldenPathClean=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,0));
  else root.setTimeout(inject,0);
}
})(typeof window!=='undefined'?window:globalThis);
