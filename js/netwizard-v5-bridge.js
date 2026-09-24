/* =========================================================
   NetWizard V5 Bridge v1
   Contrato estable para extensiones V5.
   Punto de integración estable para módulos y extensiones V5.
========================================================= */
(function(){
  'use strict';
  const CORE=window.NetWizardV5Core;
  const RENDERER=window.NetWizardV5Renderer;
  const INTERACTION=window.NetWizardV5Interaction;
  const SCENE=window.NetWizardV5Scene;
  const DRAG=window.NetWizardV5DragController;
  const COMMANDS=window.NetWizardV5Commands;
  const PANEL=window.NetWizardV5Panel;
  const LOCATION_TX=window.NetWizardV5LocationTransactions;
  const CONTROLS=window.NetWizardV5Controls;

  function project(){
    try{return window.NetWizardState?.getSnapshot?.()||window.S||{};}catch{return window.S||{};}
  }
  function visual(){
    const p=project();
    if(typeof window.vv==='function'){
      try{return window.vv();}catch{}
    }
    return CORE?CORE.ensureVisualState(p):(p.visual||{});
  }
  function metrics(){
    return window.V5S||CORE?.DEFAULT_METRICS||{locHead:36,devW:176,devH:62,hstW:158,hstH:42,colW:190};
  }
  function nodeBounds(kind,id){
    if(typeof window.visualNodeBounds==='function'){
      try{return window.visualNodeBounds(kind,id);}catch{}
    }
    return CORE?.nodeBounds(visual(),kind,id,metrics())||null;
  }
  function nodeCenter(kind,id){
    if(typeof window.nodeCenterById==='function'){
      try{return window.nodeCenterById(kind,id);}catch{}
    }
    return CORE?.nodeCenter(visual(),kind,id,metrics())||null;
  }
  function worldToScreen(x,y){
    if(typeof window.v2s==='function'){
      try{return window.v2s(x,y);}catch{}
    }
    return CORE?.worldToScreen(visual(),x,y)||{x,y};
  }
  function screenToWorld(x,y){
    if(typeof window.s2v==='function'){
      try{return window.s2v(x,y);}catch{}
    }
    return CORE?.screenToWorld(visual(),x,y)||{x,y};
  }
  function redraw(){
    if(typeof window.drawV5==='function')return window.drawV5();
  }
  function renderPanel(){
    if(typeof window.renderV5Panel==='function')return window.renderV5Panel();
  }
  function select(type,id){
    if(typeof window.selectV5==='function')return window.selectV5(type,id);
  }
  function locationItems(id){
    return{
      devices:typeof window.devsInVisualLoc==='function'?window.devsInVisualLoc(id):[],
      hosts:typeof window.hostsInVisualLoc==='function'?window.hostsInVisualLoc(id):[]
    };
  }

  window.NetWizardV5={
    version:'netwizard-v5-bridge-v1',
    core:CORE,
    renderer:RENDERER,
    interaction:INTERACTION,
    scene:SCENE,
    dragController:DRAG,
    commands:COMMANDS,
    panel:PANEL,
    locationTransactions:LOCATION_TX,
    controls:CONTROLS,
    project,visual,metrics,nodeBounds,nodeCenter,worldToScreen,screenToWorld,
    redraw,renderPanel,select,locationItems,
    locations:()=>CORE?.locations(visual())||[],
    locationById:id=>CORE?.locById(visual(),id)||null,
    locationRoots:()=>CORE?.locRoots(visual())||[],
    locationChildren:id=>CORE?.locChildren(visual(),id)||[],
    locationDepth:id=>CORE?.locDepth(visual(),id)||0,
    deviceVisualLocation:id=>CORE?.deviceVisualLoc(visual(),id)||'',
    hostVisualLocation:id=>CORE?.hostVisualLoc(visual(),id)||'',
    linkPortA:link=>CORE?.linkPortA(link)||null,
    linkPortB:link=>CORE?.linkPortB(link)||null,
    linkEndpoints:link=>CORE?.linkEndpoints(project(),link)||null,
    linkedDeviceIds:id=>CORE?.linkedDeviceIds(project(),id)||[]
  };
})();