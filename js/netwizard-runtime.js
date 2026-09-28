/* NetWizard browser runtime verification v2 */
(function initNetWizardRuntime(root){
  'use strict';

  function manifest(){ return root.NetWizardBrowserModules || null; }

  function scriptPaths(){
    if(!root.document) return [];
    const out=[];
    for(const script of root.document.scripts){
      if(!script.src) continue;
      let pathname='';
      try { pathname=new URL(script.src, root.location && root.location.href || undefined).pathname; } catch { continue; }
      const marker='/js/';
      const at=pathname.lastIndexOf(marker);
      if(at>=0) out.push('js/'+pathname.slice(at+marker.length));
    }
    return out;
  }

  function duplicateScripts(paths){
    const counts=new Map();
    for(const path of paths) counts.set(path,(counts.get(path)||0)+1);
    return Array.from(counts.entries()).filter(([,count])=>count>1).map(([path])=>path);
  }

  function expectedPaths(M, actual){
    const all=M.paths();
    const production=M.paths({production:true});
    const privatePaths=all.filter(path=>!production.includes(path));
    const sourceProfile=privatePaths.some(path=>actual.includes(path));
    return {profile:sourceProfile?'source':'production',paths:sourceProfile?all:production};
  }

  function orderIssues(expected, actual){
    const index=new Map(actual.map((path,i)=>[path,i]));
    const issues=[];
    let previous=-1;
    for(const path of expected){
      if(!index.has(path)) continue;
      const current=index.get(path);
      if(current<previous) issues.push(path);
      previous=Math.max(previous,current);
    }
    return issues;
  }

  function verify(){
    const M=manifest();
    const actual=scriptPaths();
    const duplicates=duplicateScripts(actual);
    if(!M){
      return {
        ok:false,version:'3.50.0',profile:'unknown',
        missing:['NetWizardBrowserModules'],
        missingGlobals:['NetWizardBrowserModules'],
        missingModules:[],duplicateScripts:duplicates,invalidOrder:[],
        manifestErrors:['NetWizardBrowserModules no está disponible.'],
        missingPipelineStages:[],missingRegistryEntries:[],
        generatorReady:false,architectureReady:false,rackIntegrationReady:false
      };
    }

    const graph=M.validate();
    const expected=expectedPaths(M,actual);
    const missingModules=expected.paths.filter(path=>!actual.includes(path));
    const invalidOrder=orderIssues(expected.paths,actual);
    const required=M.requiredGlobals().filter(item=>expected.paths.includes(item.path));
    const missingGlobals=required.filter(item=>!root[item.global]).map(item=>item.global);

    const pipeline=root.NetWizardConfigPipeline;
    const registry=pipeline&&typeof pipeline.inspect==='function'?pipeline.inspect():{renderers:[],stages:[]};
    const sourceProfile=expected.profile==='source';
    const requiredRenderers=sourceProfile?['edge.firewall','device.switching','vendor.base']:[];
    const requiredStages=sourceProfile?['security.access','management.baseline','ha.services']:[];
    const registeredRenderers=registry.renderers.map(item=>item.id);
    const registeredStages=registry.stages.map(item=>item.id);
    const missingRegistryEntries=requiredRenderers.filter(id=>!registeredRenderers.includes(id))
      .concat(requiredStages.filter(id=>!registeredStages.includes(id)));
    const generatorReady=!!(pipeline&&root.genConfig===pipeline.generate&&root.genConfig.__netwizardConfigPipeline);
    const architectureReady=!!(root.NetWizardProductionGate&&root.NetWizardProductionGate.__architectureExtensionInstalled);
    const rackIntegrationReady=!!(
      root.NetWizardRackModel&&root.NetWizardStructuredCabling&&root.NetWizardRackUi&&
      root.NetWizardStructuredCablingUi&&root.NetWizardRackProductionIntegration&&
      root.NetWizardProductionGate&&root.NetWizardProductionGate.__rackExtensionInstalled
    );
    const pipelineFlags=sourceProfile?[
      '__netwizardFirewallEdgeInstalled',
      '__netwizardSwitchingInstalled',
      '__netwizardAccessSecurityInstalled',
      '__netwizardManagementInstalled',
      '__netwizardHaServicesInstalled'
    ]:[];
    const missingPipelineStages=pipelineFlags.filter(name=>!root[name]);

    return {
      ok:graph.ok&&!missingModules.length&&!duplicates.length&&!invalidOrder.length&&!missingGlobals.length&&
        !missingPipelineStages.length&&!missingRegistryEntries.length&&generatorReady&&architectureReady&&rackIntegrationReady,
      version:'3.50.0',
      profile:expected.profile,
      missing:missingGlobals.slice(),
      missingGlobals,
      missingModules,
      duplicateScripts:duplicates,
      invalidOrder,
      manifestErrors:graph.errors.slice(),
      missingPipelineStages,
      missingRegistryEntries,
      configPipeline:registry,
      generatorReady,
      architectureReady,
      rackIntegrationReady
    };
  }

  function verifyAndReport(){
    const status=verify();
    api.status=status;
    if(!status.ok&&root.console) root.console.error('NetWizard: runtime incompleto',status);
    return status;
  }

  const api={version:'netwizard-runtime-v2',verify,verifyAndReport,status:null};
  root.NetWizardRuntime=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(root.document){
    if(root.document.readyState==='complete') root.setTimeout(verifyAndReport,0);
    else if(root.addEventListener) root.addEventListener('load',()=>root.setTimeout(verifyAndReport,0),{once:true});
  }
})(typeof window!=='undefined'?window:globalThis);
