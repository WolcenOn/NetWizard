/* NetWizard Field Intervention Package v1
 * Deriva checklist, before/after y BOM diferencial desde As-Built -> To-Be.
 */
(function initNetWizardFieldInterventionPackage(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
function planner(){
  if(root.NetWizardPhysicalInterventionPlan)return root.NetWizardPhysicalInterventionPlan;
  if(typeof require==='function'){try{return require('./netwizard-physical-intervention-plan.js');}catch(_e){}}
  return null;
}
function byId(list,id){return arr(list).find(x=>x&&x.id===id)||null;}
function baselineMap(list){return new Map(arr(list).filter(x=>x&&x.id).map(x=>[x.id,x]));}
function currentMap(list){
  const map=new Map();
  for(const item of arr(list)){
    const key=clean(item&&item.originRef)||clean(item&&item.id);
    if(key)map.set(key,item);
  }
  return map;
}
function material(kind,description,quantity,disposition,extra){
  return Object.assign({kind,description:clean(description)||kind,quantity:Number(quantity)||1,disposition},extra||{});
}
function deviceDescription(d){
  return [clean(d&&d.manufacturer),clean(d&&d.model),clean(d&&d.name)].filter(Boolean).join(' · ')||clean(d&&d.id)||'Equipo';
}
function rackDescription(r){return `${clean(r&&r.name)||clean(r&&r.id)||'Rack'} · ${r&&r.rackUnits||'—'}U`;}
function pduDescription(p){return [clean(p&&p.name)||clean(p&&p.id)||'PDU',p&&p.outletCount?`${p.outletCount} tomas`:null,clean(p&&p.feed)?`feed ${p.feed}`:null].filter(Boolean).join(' · ');}
function cableDescription(c){return [clean(c&&c.label)||clean(c&&c.id)||'Cable',clean(c&&c.cableType)||'Cableado',c&&c.lengthM!=null?`${c.lengthM} m`:null,clean(c&&c.route)||null].filter(Boolean).join(' · ');}
function patchDescription(p,kind){
  if(kind==='host')return `Toma ${clean(p&&p.outletId)||'—'} P${p&&p.outletPort||1} ↔ host ${clean(p&&p.hostId)||'—'}`;
  return `Patch panel ${clean(p&&p.patchPanelId)||'—'} P${p&&p.patchPort||'—'} ↔ puerto ${clean(p&&p.switchPortId)||'—'}`;
}
function diffMaterials(project){
  const p=project||{},workflow=obj(p.workflow),base=obj(workflow.interventionBaseline);
  const additions=[],removals=[],reuse=[],review=[];

  const baseDevices=baselineMap(base.devices),curDevices=arr(p.devices);
  const currentOrigins=new Set(curDevices.map(d=>clean(d.originRef)).filter(Boolean));
  for(const d of curDevices){
    const origin=clean(d.originRef),disp=clean(d.designDisposition)||(origin?'keep':'add');
    if(!origin||disp==='add'){
      additions.push(material('Equipo',deviceDescription(d),1,'add',{deviceId:d.id}));
      continue;
    }
    const before=baseDevices.get(origin);
    if(disp==='retire'){
      removals.push(material('Equipo',deviceDescription(before||d),1,'remove',{originRef:origin}));
    }else if(disp==='replace'){
      removals.push(material('Equipo',deviceDescription(before||d),1,'replace-old',{originRef:origin}));
      const replacement=clean(d.replacementDeviceRef)?byId(p.devices,d.replacementDeviceRef):null;
      if(replacement)additions.push(material('Equipo',deviceDescription(replacement),1,'replace-new',{deviceId:replacement.id,originRef:origin}));
      else review.push(material('Equipo',clean(d.replacementNote)||`Reemplazo pendiente para ${deviceDescription(d)}`,1,'replacement-required',{originRef:origin}));
    }else{
      reuse.push(material('Equipo',deviceDescription(d),1,'reuse',{deviceId:d.id,originRef:origin}));
    }
  }
  for(const [id,b] of baseDevices){
    if(!currentOrigins.has(id)&&!curDevices.some(d=>d&&d.id===id))removals.push(material('Equipo',deviceDescription(b),1,'remove',{originRef:id,implicit:true}));
  }

  function diffSimple(baseList,currentList,kind,describe){
    const baseM=baselineMap(baseList),curM=currentMap(currentList),origins=new Set();
    for(const cur of arr(currentList)){
      const origin=clean(cur&&cur.originRef);if(origin)origins.add(origin);
      const key=origin||clean(cur&&cur.id);
      if(!origin&&!baseM.has(key))additions.push(material(kind,describe(cur),1,'add',{currentId:cur.id}));
      else if(origin||baseM.has(key))reuse.push(material(kind,describe(cur),1,'reuse',{currentId:cur.id,originRef:key}));
    }
    for(const [id,b] of baseM)if(!curM.has(id))removals.push(material(kind,describe(b),1,'remove',{originRef:id}));
  }
  diffSimple(base.racks,p.racks,'Rack',rackDescription);
  diffSimple(base.pdus,p.pdus,'PDU',pduDescription);

  const baseCables=baselineMap(base.cableRuns),curCableMap=currentMap(p.cableRuns);
  for(const c of arr(p.cableRuns)){
    const origin=clean(c.originRef),key=origin||clean(c.id),before=baseCables.get(key);
    if(!origin&&!before){
      additions.push(material('Cableado',cableDescription(c),1,'add',{currentId:c.id}));
      continue;
    }
    if(before){
      const typeChanged=clean(before.cableType)!==clean(c.cableType);
      const lengthChanged=String(before.lengthM??'')!==String(c.lengthM??'');
      const routeChanged=clean(before.route)!==clean(c.route);
      if(typeChanged||lengthChanged){
        removals.push(material('Cableado',cableDescription(before),1,'replace-old',{originRef:key}));
        additions.push(material('Cableado',cableDescription(c),1,'replace-new',{currentId:c.id,originRef:key}));
      }else if(routeChanged){
        review.push(material('Cableado',`Reencaminar ${cableDescription(c)}`,1,'reroute',{currentId:c.id,originRef:key}));
      }else reuse.push(material('Cableado',cableDescription(c),1,'reuse',{currentId:c.id,originRef:key}));
    }
  }
  for(const [id,b] of baseCables)if(!curCableMap.has(id))removals.push(material('Cableado',cableDescription(b),1,'remove',{originRef:id}));

  function diffPatch(baseList,currentList,kind,labelKind){
    const baseM=baselineMap(baseList),curM=currentMap(currentList);
    for(const c of arr(currentList)){
      const origin=clean(c.originRef),key=origin||clean(c.id),before=baseM.get(key);
      if(!origin&&!before)additions.push(material(kind,patchDescription(c,labelKind),1,'add',{currentId:c.id}));
      else if(before){
        const keys=labelKind==='host'?['hostId','outletId','outletPort','patchCordLengthM']:['patchPanelId','patchPort','switchPortId','patchCordLengthM'];
        const changed=keys.some(k=>String(before[k]??'')!==String(c[k]??''));
        if(changed)review.push(material(kind,patchDescription(c,labelKind),1,'repatch',{currentId:c.id,originRef:key}));
        else reuse.push(material(kind,patchDescription(c,labelKind),1,'reuse',{currentId:c.id,originRef:key}));
      }
    }
    for(const [id,b] of baseM)if(!curM.has(id))removals.push(material(kind,patchDescription(b,labelKind),1,'remove',{originRef:id}));
  }
  diffPatch(base.patchConnections,p.patchConnections,'Latiguillo rack','rack');
  diffPatch(base.hostOutletConnections,p.hostOutletConnections,'Latiguillo usuario','host');

  return{additions,removals,reuse,review};
}
function beforeAfterRows(plan){
  return arr(plan&&plan.actions).map((a,index)=>({
    order:index+1,
    category:a.category,
    type:a.type,
    title:a.title,
    before:a.before||null,
    after:a.after||null,
    details:a.details||''
  }));
}
function build(project){
  const P=planner();
  const checklist=P&&P.buildChecklist?P.buildChecklist(project):null;
  if(!checklist||!checklist.ok){
    return{ok:false,version:'netwizard-field-intervention-package-v1',code:checklist&&checklist.code||'planner_unavailable',message:checklist&&checklist.message||'No se puede construir el paquete de intervención.',checklist:[],beforeAfter:[],bom:{additions:[],removals:[],reuse:[],review:[]}};
  }
  const bom=diffMaterials(project);
  return{
    ok:true,
    version:'netwizard-field-intervention-package-v1',
    projectName:clean(project&&project.projName)||'NetWizard',
    source:clone(checklist.source||{}),
    baselineCapturedAt:checklist.baselineCapturedAt||null,
    counts:{
      actions:arr(checklist.actions).length,
      addMaterials:bom.additions.length,
      removeMaterials:bom.removals.length,
      reuseMaterials:bom.reuse.length,
      reviewMaterials:bom.review.length
    },
    checklist:arr(checklist.actions).map((a,index)=>Object.assign({order:index+1,done:false},clone(a))),
    beforeAfter:beforeAfterRows(checklist),
    bom
  };
}
function mdList(items,render){return arr(items).length?arr(items).map((x,i)=>render(x,i)).join('\n'):'- Sin elementos.';}
function buildMarkdown(project){
  const pkg=build(project);if(!pkg.ok)return `# Paquete de intervención\n\nNo disponible: ${pkg.message}\n`;
  const lines=[
    `# Paquete de intervención — ${pkg.projectName}`,'',
    `- Línea base As-Built: ${pkg.baselineCapturedAt||'no documentada'}`,
    `- Acciones físicas: ${pkg.counts.actions}`,
    `- Material a añadir: ${pkg.counts.addMaterials}`,
    `- Material a retirar: ${pkg.counts.removeMaterials}`,'',
    '## Checklist de trabajo','',
    mdList(pkg.checklist,a=>`- [ ] ${a.order}. ${a.title}${a.details?` — ${a.details}`:''}`),'',
    '## Comparativa As-Built -> To-Be','',
    mdList(pkg.beforeAfter,r=>`- ${r.order}. **${r.title}**${r.details?` — ${r.details}`:''}`),'',
    '## BOM diferencial — añadir','',
    mdList(pkg.bom.additions,x=>`- +${x.quantity} ${x.kind}: ${x.description}`),'',
    '## BOM diferencial — retirar','',
    mdList(pkg.bom.removals,x=>`- -${x.quantity} ${x.kind}: ${x.description}`),'',
    '## Reutilización','',
    mdList(pkg.bom.reuse,x=>`- =${x.quantity} ${x.kind}: ${x.description}`),'',
    '## Revisión manual','',
    mdList(pkg.bom.review,x=>`- [ ] ${x.kind}: ${x.description}`),'',
    '## Cierre','',
    '- [ ] Verificar estado físico y alimentación de todos los equipos intervenidos.',
    '- [ ] Validar enlaces, patching y etiquetado final.',
    '- [ ] Actualizar el As-Built con el estado real tras la intervención.',
    '- [ ] Registrar incidencias, material no utilizado y desviaciones del plan.',''
  ];
  return lines.join('\n');
}
const api={version:'netwizard-field-intervention-package-v1',build,buildMarkdown,diffMaterials};
root.NetWizardFieldInterventionPackage=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
