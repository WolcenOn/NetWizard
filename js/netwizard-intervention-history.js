/* NetWizard Intervention History v1
 * Deriva un journal ligero de cierres usando snapshots + workflow.updatedFrom.
 */
(function initNetWizardInterventionHistory(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));

function historyApi(){return root.NetWizardHistory||null;}
function stateApi(){return root.NetWizardState||null;}

function projectFromSnapshot(snapshot){
  const payload=obj(snapshot&&snapshot.payload);
  const project=payload.project&&typeof payload.project==='object'?payload.project:(Object.keys(payload).length?payload:null);
  return project&&typeof project==='object'?project:null;
}
function entryFromProject(project,meta){
  const p=obj(project),w=obj(p.workflow),u=obj(w.updatedFrom);
  if(clean(u.type)!=='intervention-closeout')return null;
  const source=obj(meta);
  return{
    type:'intervention-closeout',
    closedAt:clean(u.closedAt),
    sourceInventorySnapshotId:clean(u.sourceInventorySnapshotId),
    sourceProjectName:clean(u.sourceProjectName),
    designSnapshotId:clean(u.designSnapshotId),
    designProjectName:clean(u.designProjectName),
    baselineCapturedAt:clean(u.baselineCapturedAt),
    interventionActionCount:Number.isFinite(Number(u.interventionActionCount))?Math.max(0,Math.round(Number(u.interventionActionCount))):0,
    resultingProjectName:clean(p.projName),
    snapshotId:clean(source.snapshotId),
    snapshotLabel:clean(source.snapshotLabel),
    snapshotTs:clean(source.snapshotTs),
    current:source.current===true
  };
}
function entryKey(entry){
  return clean(entry&&entry.designSnapshotId)
    || [clean(entry&&entry.sourceInventorySnapshotId),clean(entry&&entry.closedAt),clean(entry&&entry.resultingProjectName)].join('|');
}
function build(options){
  const opts=obj(options),H=opts.history||historyApi(),S=opts.state||stateApi();
  const current=opts.project||S&&S.getSnapshot&&S.getSnapshot()||{};
  const entries=[],seen=new Set();

  const add=entry=>{
    if(!entry)return;
    const key=entryKey(entry);
    if(!key||seen.has(key))return;
    seen.add(key);entries.push(entry);
  };

  add(entryFromProject(current,{current:true}));

  if(H&&typeof H.listSnapshots==='function'&&typeof H.getSnapshot==='function'){
    for(const item of arr(H.listSnapshots())){
      const snap=H.getSnapshot(item.id);
      const project=projectFromSnapshot(snap);
      add(entryFromProject(project,{
        snapshotId:item.id,
        snapshotLabel:item.label,
        snapshotTs:item.ts
      }));
    }
  }

  entries.sort((a,b)=>String(b.closedAt||b.snapshotTs||'').localeCompare(String(a.closedAt||a.snapshotTs||'')));
  return{
    version:'netwizard-intervention-history-v1',
    count:entries.length,
    entries:entries.map(clone)
  };
}

const api={version:'netwizard-intervention-history-v1',build,entryFromProject,projectFromSnapshot};
root.NetWizardInterventionHistory=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
