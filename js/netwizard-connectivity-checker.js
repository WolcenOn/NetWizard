/* =========================================================
   NetWizard Connectivity Checker v1
   UI de diagnóstico sobre NetWizardConnectivityModel.
   No envía tráfico real.
========================================================= */
(function ensureVendorSelectorCompatibility(){
  'use strict';
  if(typeof window==='undefined')return;
  if(!Array.isArray(window.ALL_VENDORS))window.ALL_VENDORS=[];
})();

(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const MODEL=window.NetWizardConnectivityModel;

  function safeS(){try{return S;}catch{return null;}}
  function options(){
    let iotState=null;
    try{iotState=window.NetWizardIoTEmbedded?.getState?.()||safeS()?.iot||{};}catch{iotState=safeS()?.iot||{};}
    return{
      iotState,
      resolveHostIp:host=>{
        try{return typeof effectiveHostIp==='function'?effectiveHostIp(host):host.staticIp||'';}
        catch{return host.staticIp||'';}
      }
    };
  }

  function endpointList(){
    const project=safeS();
    return MODEL&&project?MODEL.endpointList(project,options()):[];
  }

  function simulate(aId,bId,serviceId){
    const project=safeS();
    if(!MODEL||!project)return{ok:false,partial:false,steps:[{ok:false,msg:'Modelo de conectividad no disponible.'}],path:[]};
    return MODEL.simulate(project,aId,bId,serviceId||'icmp',options());
  }

  function clear(el){if(el)el.textContent='';}
  function opt(select,value,label){
    const o=document.createElement('option');
    o.value=String(value||'');
    o.textContent=String(label||'');
    select.appendChild(o);
  }
  function field(labelText,control){
    const wrap=document.createElement('div');
    const label=document.createElement('label');
    label.className='fl';
    label.textContent=labelText;
    wrap.append(label,control);
    return wrap;
  }

  function render(){
    const root=$('nwConnectivityChecker');
    if(!root)return;
    const eps=endpointList();
    if(!root.dataset.ready){
      root.textContent='';
      const head=document.createElement('div');head.className='card-h';
      const title=document.createElement('div');title.className='card-t';title.textContent='🧪 Diagnóstico de conectividad';
      const refresh=document.createElement('button');refresh.className='btn bs bsm';refresh.id='nwConnRefresh';refresh.type='button';refresh.textContent='↻ Actualizar';
      head.append(title,refresh);root.appendChild(head);

      const intro=document.createElement('div');
      intro.className='co co-ac';
      intro.textContent='Reconstruye el camino lógico/físico y simula ICMP, DNS, HTTPS, MQTT o RTSP usando puertos, links, VLAN/subnet, gateways, matriz inter-VLAN y reglas firewall. No envía tráfico real.';
      root.appendChild(intro);

      const grid=document.createElement('div');grid.className='g3';
      const src=document.createElement('select');src.id='nwConnSrc';
      const dst=document.createElement('select');dst.id='nwConnDst';
      const service=document.createElement('select');service.id='nwConnService';
      const profiles=MODEL&&MODEL.SERVICES||{};
      Object.keys(profiles).forEach(id=>opt(service,id,profiles[id].label));
      grid.append(field('Origen',src),field('Destino',dst),field('Prueba',service));
      root.appendChild(grid);

      const brow=document.createElement('div');brow.className='brow';
      const runBtn=document.createElement('button');runBtn.className='btn bp';runBtn.id='nwConnRun';runBtn.type='button';runBtn.textContent='▶ Analizar ruta';
      brow.appendChild(runBtn);root.appendChild(brow);

      const out=document.createElement('div');out.id='nwConnResult';out.style.marginTop='10px';root.appendChild(out);
      root.dataset.ready='1';
      runBtn.onclick=()=>run();
      refresh.onclick=()=>render();
    }

    const src=$('nwConnSrc'),dst=$('nwConnDst');
    const prevSrc=src&&src.value,prevDst=dst&&dst.value;
    clear(src);clear(dst);
    eps.forEach(e=>{
      const label=`${e.name} · ${e.type} · ${e.vlanLabel} · ${e.ipText}`;
      opt(src,e.id,label);opt(dst,e.id,label);
    });
    if(prevSrc&&eps.some(e=>e.id===prevSrc))src.value=prevSrc;
    if(prevDst&&eps.some(e=>e.id===prevDst))dst.value=prevDst;
    else if(eps[1])dst.selectedIndex=1;
  }

  function renderPath(out,path){
    const title=document.createElement('div');
    title.style.cssText='margin:12px 0 6px;font-size:11px;font-weight:800;color:var(--t2);text-transform:uppercase;letter-spacing:.04em';
    title.textContent='Camino reconstruido';
    out.appendChild(title);

    const wrap=document.createElement('div');
    wrap.className='nw-conn-path';
    wrap.style.cssText='display:flex;gap:6px;align-items:stretch;overflow-x:auto;padding:4px 0 10px';

    (path||[]).forEach((hop,index)=>{
      if(index){
        const arrow=document.createElement('div');
        arrow.textContent='→';
        arrow.style.cssText='display:grid;place-items:center;color:var(--t3);font-weight:900;min-width:16px';
        wrap.appendChild(arrow);
      }
      const card=document.createElement('div');
      card.dataset.kind=hop.kind||'hop';
      card.style.cssText='min-width:125px;max-width:190px;padding:8px;border:1px solid var(--bd);border-radius:9px;background:var(--c2);display:grid;gap:3px';
      const kind=document.createElement('small');
      kind.style.cssText='text-transform:uppercase;color:var(--t3);font-size:9px;font-weight:800';
      kind.textContent=String(hop.kind||'salto').replace('-',' ');
      const label=document.createElement('b');label.style.fontSize='11px';label.textContent=hop.label||'—';
      const detail=document.createElement('span');detail.style.cssText='font-size:9.5px;color:var(--t2)';detail.textContent=hop.detail||'';
      card.append(kind,label,detail);wrap.appendChild(card);
    });
    out.appendChild(wrap);
  }

  function run(){
    const res=simulate($('nwConnSrc')?.value,$('nwConnDst')?.value,$('nwConnService')?.value);
    const out=$('nwConnResult');if(!out)return;
    out.textContent='';

    const cls=res.ok?(res.partial?'co-yw':'co-gn'):'co-rd';
    const summary=document.createElement('div');summary.className='co '+cls;
    const b=document.createElement('b');
    b.textContent=res.ok?(res.partial?'CONECTIVIDAD POSIBLE · VALIDACIÓN PARCIAL':'CONECTIVIDAD POSIBLE'):'CONECTIVIDAD NO GARANTIZADA / BLOQUEADA';
    summary.appendChild(b);
    if(res.source){
      summary.appendChild(document.createElement('br'));
      summary.appendChild(document.createTextNode(`${res.service?.label||'Prueba'} · ${res.source.name} → ${res.target.name}`));
    }
    out.appendChild(summary);

    if(res.path&&res.path.length)renderPath(out,res.path);

    (res.steps||[]).forEach(step=>{
      const d=document.createElement('div');
      d.className='co '+(step.ok===true?'co-gn':step.ok===false?'co-rd':'co-yw');
      d.textContent=(step.ok===true?'✓':step.ok===false?'✗':'•')+' '+String(step.msg||'');
      out.appendChild(d);
    });

    window.NetWizardConnectivityTrace=res;
    try{document.dispatchEvent(new CustomEvent('netwizard:connectivity-trace',{detail:{ok:res.ok,partial:res.partial,path:res.path||[],sourceId:res.source?.id||null,targetId:res.target?.id||null,serviceId:res.service?.id||null}}));}catch{}
    return res;
  }

  function inject(){
    const cfg=document.getElementById('pg-cfg');
    if(!cfg||$('nwConnectivityChecker'))return;
    const card=document.createElement('div');card.className='card';card.id='nwConnectivityChecker';
    const first=cfg.querySelector('.g2');if(first)cfg.insertBefore(card,first);else cfg.appendChild(card);
    render();
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,100));
  document.addEventListener('click',e=>{if(e.target.closest('[data-step="cfg"]'))setTimeout(()=>{inject();render();},150);});
  window.NetWizardConnectivityChecker={version:'netwizard-connectivity-checker-v1',render,run,simulate,endpointList};
})();