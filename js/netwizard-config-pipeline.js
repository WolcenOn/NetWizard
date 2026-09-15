/* =========================================================
   NetWizard Config Pipeline v3.50
   Registro único y determinista de renderers y etapas de configuración.

   Un renderer crea la configuración base. Las etapas la enriquecen en orden.
   El global genConfig se instala una sola vez y deja de encadenarse por wrappers.
========================================================= */
(function initNetWizardConfigPipeline(root){
  'use strict';

  function asFunction(value){ return typeof value === 'function' ? value : null; }
  function asNumber(value, fallback){ const n=Number(value); return Number.isFinite(n) ? n : fallback; }
  function cloneEntry(entry){
    return { id:entry.id, priority:entry.priority, order:entry.order, description:entry.description || '' };
  }

  function createPipeline(options){
    const opts=options || {};
    const baseGenerator=asFunction(opts.baseGenerator) || (() => '');
    const getProject=asFunction(opts.getProject) || (() => ({}));
    const renderers=new Map();
    const stages=new Map();

    function normalizeEntry(kind, descriptor){
      const item=descriptor || {};
      const id=String(item.id || '').trim();
      if(!id) throw new Error(`NetWizard Config Pipeline: ${kind} sin id.`);
      const fn=kind === 'renderer' ? item.render : item.apply;
      if(typeof fn !== 'function') throw new Error(`NetWizard Config Pipeline: ${kind} ${id} no es ejecutable.`);
      return {
        id,
        description:String(item.description || ''),
        priority:asNumber(item.priority, 0),
        order:asNumber(item.order, 0),
        supports:asFunction(item.supports) || (() => true),
        run:fn
      };
    }

    function registerRenderer(descriptor){
      const entry=normalizeEntry('renderer', descriptor);
      renderers.set(entry.id, entry);
      return () => renderers.delete(entry.id);
    }

    function registerStage(descriptor){
      const entry=normalizeEntry('stage', descriptor);
      stages.set(entry.id, entry);
      return () => stages.delete(entry.id);
    }

    function rendererEntries(){
      return Array.from(renderers.values()).sort((a,b) => b.priority-a.priority || a.id.localeCompare(b.id));
    }

    function stageEntries(){
      return Array.from(stages.values()).sort((a,b) => a.order-b.order || a.id.localeCompare(b.id));
    }

    function context(deviceId, format){
      const project=getProject() || {};
      const device=(Array.isArray(project.devices) ? project.devices : []).find(item => item && item.id === deviceId) || null;
      const vendor=String(format || (device && device.vendorOs) || '').trim();
      return { deviceId, format, vendor, project, device, pipeline:api };
    }

    function generate(deviceId, format){
      const ctx=context(deviceId, format);
      let output;
      for(const renderer of rendererEntries()){
        if(!renderer.supports(ctx)) continue;
        const candidate=renderer.run(ctx);
        if(candidate !== undefined && candidate !== null && String(candidate).length){
          output=String(candidate);
          break;
        }
      }
      if(output === undefined) output=String(baseGenerator(deviceId, format) || '');
      for(const stage of stageEntries()){
        if(!stage.supports(ctx)) continue;
        const next=stage.run(output, ctx);
        if(next !== undefined && next !== null) output=String(next);
      }
      return output;
    }

    generate.__netwizardConfigPipeline=true;

    function inspect(){
      return {
        version:'3.50.0',
        renderers:rendererEntries().map(cloneEntry),
        stages:stageEntries().map(cloneEntry)
      };
    }

    const api={
      version:'netwizard-config-pipeline-v3.50',
      registerRenderer,
      registerStage,
      generate,
      inspect,
      getBaseGenerator:() => baseGenerator,
      getProject:() => getProject()
    };
    return api;
  }

  function browserProject(){
    if(root.NetWizardState && typeof root.NetWizardState.getSnapshot === 'function') return root.NetWizardState.getSnapshot();
    try { return S; } catch { return {}; }
  }

  const current=asFunction(root.genConfig) || (typeof genConfig === 'function' ? genConfig : null);
  const api=createPipeline({ baseGenerator:current, getProject:browserProject });
  api.createPipeline=createPipeline;
  api.install=function install(){
    try { if(typeof genConfig === 'function') genConfig=api.generate; } catch {}
    root.genConfig=api.generate;
    return api.generate;
  };

  root.NetWizardConfigPipeline=api;
  if(typeof module !== 'undefined' && module.exports) module.exports={ createPipeline };
  if(root.document && current) api.install();
})(typeof window !== 'undefined' ? window : globalThis);
