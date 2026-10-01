/* NetWizard Complete Enterprise Golden Path loader */
(function initNetWizardGoldenPathEnterprise(root){
'use strict';

const SAMPLE_URL='./samples/golden-path-enterprise-complete.json';

async function fetchPayload(){
  const response=await root.fetch(SAMPLE_URL,{cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo cargar Golden Path ('+response.status+').');
  return response.json();
}
async function preparedProject(){
  const payload=await fetchPayload();
  const Schema=root.NetWizardProjectSchema;
  if(!Schema||typeof Schema.prepareImport!=='function')throw new Error('NetWizardProjectSchema no está disponible.');
  const prepared=Schema.prepareImport(payload);
  if(!prepared.ok)throw new Error('Golden Path inválido: '+prepared.errors.join(' · '));
  return prepared.project;
}
async function loadIntoProject(){
  const project=await preparedProject();
  if(!root.NetWizardState||typeof root.NetWizardState.replaceProject!=='function')throw new Error('NetWizardState no está disponible.');
  root.NetWizardState.replaceProject(project,{source:'golden-path-enterprise'});
  if(typeof root.navTo==='function')root.navTo('dash');
  return project;
}
async function download(){
  const a=root.document.createElement('a');
  a.href=SAMPLE_URL;
  a.download='netwizard-golden-path-enterprise-complete.json';
  root.document.body.appendChild(a);a.click();a.remove();
  return true;
}
function inject(){
  if(!root.document||root.document.getElementById('btnGoldenPathEnterprise'))return;
  const anchor=root.document.getElementById('btnFourSitesSampleDownload')||root.document.getElementById('impJsonFile')||root.document.getElementById('impJson');
  if(!anchor)return;
  const load=root.document.createElement('button');
  load.id='btnGoldenPathEnterprise';load.type='button';load.className='btn bp';
  load.textContent='⭐ Cargar Golden Path completo';
  load.title='Demo production-clean de 4 sedes: anillo OSPF, ACLs inter-VLAN, seguridad L2, Wi-Fi, físico y presupuesto';
  load.onclick=async()=>{
    if(root.confirm&&!root.confirm('Sustituir el proyecto actual por el Golden Path Enterprise completo?'))return;
    try{await loadIntoProject();}
    catch(error){root.alert?root.alert(error.message):root.console?.error(error);}
  };
  const dl=root.document.createElement('button');
  dl.id='btnGoldenPathEnterpriseDownload';dl.type='button';dl.className='btn bs';dl.textContent='⬇ JSON Golden Path';
  dl.onclick=async()=>{try{await download();}catch(error){root.alert?root.alert(error.message):root.console?.error(error);}};
  anchor.insertAdjacentElement('afterend',dl);
  anchor.insertAdjacentElement('afterend',load);
}
const api={version:'netwizard-golden-path-enterprise-v1',url:SAMPLE_URL,fetchPayload,preparedProject,loadIntoProject,download,inject};
root.NetWizardGoldenPathEnterprise=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,0));
  else root.setTimeout(inject,0);
}
})(typeof window!=='undefined'?window:globalThis);
