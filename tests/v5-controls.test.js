'use strict';

const assert=require('assert');
const FACTORY=require('../js/netwizard-v5-controls.js');

function classList(){
  const s=new Set();
  return{
    add:v=>s.add(v),remove:v=>s.delete(v),contains:v=>s.has(v),
    toggle(v,on){if(on===undefined){if(s.has(v))s.delete(v);else s.add(v);}else if(on)s.add(v);else s.delete(v);},
    values:s
  };
}
function emitter(extra={}){
  const handlers={};
  return Object.assign({
    handlers,
    addEventListener(name,fn){(handlers[name]||(handlers[name]=new Set())).add(fn);},
    removeEventListener(name,fn){handlers[name]&&handlers[name].delete(fn);},
    emit(name,event={}){for(const fn of handlers[name]||[])fn(event);}
  },extra);
}

const layout=emitter({classList:classList()});
const fsButton=emitter({textContent:''});
const autoButton=emitter(),addButton=emitter(),fitButton=emitter();
const filter=emitter({checked:true,dataset:{v5Filter:'hosts'},closest(){return this;}});
const body={classList:classList()};
const doc=emitter({
  fullscreenElement:null,body,
  getElementById(id){return({v5Layout:layout,v5Fs:fsButton,v5AutoLoc:autoButton,v5AddLoc:addButton,v5Fit:fitButton})[id]||null;},
  querySelectorAll(sel){return sel==='[data-v5-filter]'?[filter]:[];}
});
const win=emitter();
const state={fs:false};
let auto=0,added=0,fitted=0,resized=0,filterChange=null,after=0;
const ctl=FACTORY.create({
  document:doc,window:win,schedule:fn=>fn(),
  filterValue:key=>key==='hosts',
  setFilter:(key,on)=>{filterChange={key,on};},
  autoLocate:()=>auto++,addLocation:()=>added++,fit:()=>fitted++,
  setFullscreenState:on=>{state.fs=on;},
  afterFullscreenSync:()=>after++,
  isActive:()=>true,onResize:()=>resized++
});

assert.strictEqual(FACTORY.version,'netwizard-v5-controls-factory-v1');
assert.strictEqual(ctl.version,'netwizard-v5-controls-v1');
ctl.bind();
assert.strictEqual(ctl.isBound(),true);
assert.strictEqual(filter.checked,true);
autoButton.emit('click');addButton.emit('click');fitButton.emit('click');
assert.strictEqual(auto,1);assert.strictEqual(added,1);assert.strictEqual(fitted,1);

filter.checked=false;
doc.emit('change',{target:filter});
assert.deepStrictEqual(filterChange,{key:'hosts',on:false});
win.emit('resize');
assert.strictEqual(resized,1);

(async()=>{
  await ctl.toggleFullscreen(true);
  assert.strictEqual(layout.classList.contains('fs'),true);
  assert.strictEqual(body.classList.contains('v5-fs-lock'),true);
  assert.strictEqual(state.fs,true);
  assert.strictEqual(fsButton.textContent,'🗗 Salir pantalla completa');
  await ctl.toggleFullscreen(false);
  assert.strictEqual(layout.classList.contains('fs'),false);
  assert.strictEqual(state.fs,false);
  assert.strictEqual(fsButton.textContent,'⛶ Pantalla completa');
  assert.ok(after>=2);
  ctl.destroy();
  assert.strictEqual(ctl.isBound(),false);
  console.log('✓ V5 controls encapsula toolbar, filtros, fullscreen y resize');
})().catch(err=>{console.error(err);process.exitCode=1;});