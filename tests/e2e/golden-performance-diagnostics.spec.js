const { test, expect } = require('@playwright/test');

test('diagnostica listeners de cambio de proyecto: normal vs Golden', async ({page})=>{
  await page.addInitScript(()=>{
    const original=EventTarget.prototype.addEventListener;
    const timings=[];
    window.__nwProjectListenerTimings=timings;
    EventTarget.prototype.addEventListener=function(type,listener,options){
      if(type!=='nw:project:changed'||typeof listener!=='function'){
        return original.call(this,type,listener,options);
      }
      const registration=(new Error()).stack||'';
      const wrapped=function(...args){
        const started=performance.now();
        try{return listener.apply(this,args);}
        finally{timings.push({registration,ms:performance.now()-started});}
      };
      return original.call(this,type,wrapped,options);
    };
  });

  await page.goto('/index.html');
  await page.waitForLoadState('load');

  const report=await page.evaluate(async()=>{
    const summarize=(label)=>{
      const rows=window.__nwProjectListenerTimings.splice(0);
      const bySource=new Map();
      for(const row of rows){
        const matches=[...String(row.registration||'').matchAll(/(js\/[^\s:)]+\.js):(\d+):(\d+)/g)];
        const hit=matches[matches.length-1];
        const source=hit?hit[1]:'unknown';
        const item=bySource.get(source)||{source,count:0,totalMs:0,maxMs:0};
        item.count++;item.totalMs+=row.ms;item.maxMs=Math.max(item.maxMs,row.ms);bySource.set(source,item);
      }
      return{
        label,
        totalMs:rows.reduce((s,x)=>s+x.ms,0),
        listeners:rows.length,
        top:[...bySource.values()].sort((a,b)=>b.totalMs-a.totalMs).slice(0,12)
      };
    };
    const measureDispatch=label=>{
      window.__nwProjectListenerTimings.length=0;
      const started=performance.now();
      document.dispatchEvent(new CustomEvent('nw:project:changed',{detail:{source:'e2e-perf-diagnostic'}}));
      const wallMs=performance.now()-started;
      return{wallMs,...summarize(label)};
    };

    const normal=window.NetWizardFourSitesSample.buildProject();
    window.NetWizardState.replaceProject(normal,{source:'e2e-normal-perf'});
    const normalReport=measureDispatch('normal-four-sites');

    const golden=await window.NetWizardGoldenPathClean.preparedProject();
    window.NetWizardState.replaceProject(golden,{source:'e2e-golden-perf'});
    const goldenReport=measureDispatch('golden-clean');

    return{
      normalBytes:JSON.stringify(normal).length,
      goldenBytes:JSON.stringify(golden).length,
      normal:normalReport,
      golden:goldenReport
    };
  });

  console.log('NW_PERF_DIAGNOSTIC '+JSON.stringify(report));
  expect(report.normal.listeners).toBeGreaterThan(0);
  expect(report.golden.listeners).toBeGreaterThan(0);
});
