'use strict';

const assert=require('assert');
const Journal=require('../js/netwizard-intervention-history.js');

const current={
  projName:'Sede · As-Built actualizado',
  workflow:{
    mode:'inventory',
    updatedFrom:{
      type:'intervention-closeout',
      sourceInventorySnapshotId:'snap-b',
      sourceProjectName:'Sede · As-Built actualizado',
      designSnapshotId:'snap-design-b',
      designProjectName:'Sede · Diseño To-Be',
      baselineCapturedAt:'2026-09-27T11:00:00Z',
      closedAt:'2026-09-27T12:00:00Z',
      interventionActionCount:4
    }
  }
};

const snapshots={
  'snap-current-copy':{
    id:'snap-current-copy',
    ts:'2026-09-27T12:05:00Z',
    label:'Copia del As-Built C',
    payload:{format:'netwizard-project',project:JSON.parse(JSON.stringify(current))}
  },
  'snap-asbuilt-b':{
    id:'snap-asbuilt-b',
    ts:'2026-09-27T10:05:00Z',
    label:'As-Built B',
    payload:{
      format:'netwizard-project',
      project:{
        projName:'Sede · As-Built actualizado',
        workflow:{
          mode:'inventory',
          updatedFrom:{
            type:'intervention-closeout',
            sourceInventorySnapshotId:'snap-a',
            sourceProjectName:'Sede · As-Built',
            designSnapshotId:'snap-design-a',
            designProjectName:'Sede · Diseño To-Be',
            baselineCapturedAt:'2026-09-27T09:00:00Z',
            closedAt:'2026-09-27T10:00:00Z',
            interventionActionCount:7
          }
        }
      }
    }
  },
  'snap-design':{
    id:'snap-design',
    ts:'2026-09-27T09:30:00Z',
    label:'Diseño sin cierre',
    payload:{project:{projName:'Sede · Diseño To-Be',workflow:{mode:'design'}}}
  }
};

const fakeHistory={
  listSnapshots(){
    return Object.values(snapshots).map(s=>({id:s.id,ts:s.ts,label:s.label,source:'test'}));
  },
  getSnapshot(id){return snapshots[id]||null;}
};

const result=Journal.build({project:current,history:fakeHistory});
assert.strictEqual(result.version,'netwizard-intervention-history-v1');
assert.strictEqual(result.count,2,'Debe deduplicar el cierre actual aunque exista también como snapshot');
assert.deepStrictEqual(result.entries.map(x=>x.designSnapshotId),['snap-design-b','snap-design-a']);
assert.strictEqual(result.entries[0].current,true);
assert.strictEqual(result.entries[0].interventionActionCount,4);
assert.strictEqual(result.entries[1].current,false);
assert.strictEqual(result.entries[1].snapshotId,'snap-asbuilt-b');
assert.strictEqual(result.entries[1].interventionActionCount,7);
assert.strictEqual(result.entries.some(x=>x.designSnapshotId==='snap-design'),false);

const wrapper=Journal.projectFromSnapshot({payload:{format:'netwizard-project',project:{projName:'Wrapped'}}});
assert.strictEqual(wrapper.projName,'Wrapped');

const raw=Journal.projectFromSnapshot({payload:{projName:'Raw payload',workflow:{mode:'inventory'}}});
assert.strictEqual(raw.projName,'Raw payload');

console.log('✓ Intervention History deriva un journal ligero, ordenado y sin duplicados');
