/* =========================================================
   NetWizard Connectivity Checker v0.1
   Simulación de reachability tipo ping: IP, VLAN, puerto access,
   gateway/subnet y matriz inter-VLAN. No envía tráfico real.
========================================================= */
(function ensureVendorSelectorCompatibility(){
  'use strict';
  if(typeof window === 'undefined') return;
  if(!Array.isArray(window.ALL_VENDORS)){
    window.ALL_VENDORS=[
      {id:'cisco_ios',l:'Cisco IOS'},
      {id:'cisco_asa',l:'Cisco ASA'},
      {id:'fortinet',l:'Fortinet FortiGate'},
      {id:'pfsense',l:'pfSense'},
      {id:'mikrotik_routeros',l:'MikroTik RouterOS'},
      {id:'huawei_vrp',l:'Huawei VRP'},
      {id:'juniper_junos',l:'Juniper Junos'},
      {id:'aruba_aoss',l:'Aruba AOS-Switch'},
      {id:'ubiquiti_unifi',l:'Ubiquiti UniFi'},
      {id:'tplink_omada',l:'TP-Link Omada'},
      {id:'galgus_cloud',l:'Galgus Cloud'},
      {id:'windows',l:'Windows'},
      {id:'linux',l:'Linux'}
    ];
  }
})();

(function loadVendorGeneratorsIfNeeded(){
  'use strict';
  if(typeof window === 'undefined' || window.NetWizardVendorConfigGenerators) return;
  const script = document.createElement('script');
  script.src = './js/netwizard-vendor-config-generators.js';
  script.defer = false;
  document.head.appendChild(script);
})();

(function loadArchitectureValidation(){
  'use strict';
  if(typeof window === 'undefined') return;
  function load(src, ready){
    const script = document.createElement('script');
    script.src = src;
    script.defer = false;
    script.onload = ready || null;
    document.head.appendChild(script);
  }
  function loadGateExtension(){
    if(window.NetWizardProductionGateArchitecture) return;
    load('./js/netwizard-production-gate-architecture.js');
  }
  if(window.NetWizardArchitectureValidator) loadGateExtension();
  else load('./js/netwizard-architecture-validator.js', loadGateExtension);
})();

(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  function safeS(){try{return S;}catch{return null;}}
  function ipOnly(v){const s=String(v||'').trim();const m=s.match(/(?:DHCP\s*·\s*)?(\d{1,3}(?:\.\d{1,3}){3})/);return m?m[1]:'';}
  function endpointList(){
    const S=safeS(); if(!S)return [];
    const eps=[];
    for(const h of (S.hosts||[])){
      const vlan=(S.vlans||[]).find(v=>v.id===h.vlanRef)||null;
      const ip=(typeof effectiveHostIp==='function')?effectiveHostIp(h):(h.staticIp||'');
      eps.push({kind:'host',id:'host:'+h.id,name:h.name||h.id,type:h.type||'host',vlanRef:h.vlanRef,vlanLabel:vlan?`VLAN ${vlan.vlanId} ${vlan.name}`:'sin VLAN',ipText:ip,ip:ipOnly(ip),raw:h});
    }
    try{
      const st=window.NetWizardIoTEmbedded?.getState?.();
      for(const d of (st?.devices||[])){
        const vlan=(S.vlans||[]).find(v=>v.id===d.vlanRef)||null;
        const idip=ipOnly(d.identifier||'');
        eps.push({kind:'iot',id:'iot:'+d.id,name:d.name||d.id,type:d.tech||d.type||'iot',vlanRef:d.vlanRef,vlanLabel:vlan?`VLAN ${vlan.vlanId} ${vlan.name}`:'sin VLAN',ipText:d.identifier||'sin IP',ip:idip,raw:d});
      }
    }catch{}
    return eps;
  }
  function vlan(ref){const S=safeS();return (S?.vlans||[]).find(v=>v.id===ref)||null;}
  function subnet(ref){const S=safeS();return (S?.subnets||[]).find(s=>s.vlanRef===ref)||null;}
  function portForEndpoint(ep){
    const S=safeS(); if(!S||ep.kind!=='host')return null;
    const h=ep.raw; const p=(S.ports||[]).find(x=>x.id===h.portRef)||null;
    const d=p?(S.devices||[]).find(x=>x.id===p.deviceId):null;
    return {port:p,device:d};
  }
  function portVlanOk(ep){
    if(ep.kind!=='host')return {ok:true,msg:'Dispositivo no cableado o IoT: se valida por VLAN lógica/acceso IoT.'};
    const pp=portForEndpoint(ep);
    if(!pp?.port)return {ok:false,msg:'Host sin puerto físico asignado.'};
    const p=pp.port;
    if(p.mode!=='access')return {ok:false,msg:`El puerto ${p.name} no está en modo access.`};
    if(p.accessVlanRef!==ep.vlanRef)return {ok:false,msg:`El puerto ${p.name} no tiene la VLAN del host.`};
    return {ok:true,msg:`Puerto OK: ${pp.device?.name||'?'} / ${p.name} en access.`};
  }
  function sameSubnet(a,b){
    if(!a.ip||!b.ip)return false;
    const sn=subnet(a.vlanRef); if(!sn||typeof parseCidr!=='function'||typeof ipInSn!=='function')return false;
    return ipInSn(a.ip,sn.cidr)&&ipInSn(b.ip,sn.cidr);
  }
  function hasGateway(ep){const sn=subnet(ep.vlanRef);return !!(sn&&sn.gateway&&sn.cidr);}
  function matrixAllows(a,b){
    const S=safeS(); if(!S)return true;
    const key=`${a.vlanRef}_${b.vlanRef}`;
    return S.vlanMatrix?.[key]!==false;
  }
  function icmpRuleAllows(a,b){
    const S=safeS(); if(!S)return true;
    const rules=(S.fwRules||[]).filter(r=>r.enabled!==false).sort((x,y)=>(x.prio||100)-(y.prio||100));
    if(!rules.length)return true;
    const va=vlan(a.vlanRef), vb=vlan(b.vlanRef);
    for(const r of rules){
      const proto=String(r.proto||'any').toLowerCase();
      if(proto!=='any'&&proto!=='icmp')continue;
      const src=String(r.src||'any').toLowerCase(), dst=String(r.dst||'any').toLowerCase();
      const srcOk=src==='any'||src===(va?.name||'').toLowerCase()||src===String(va?.vlanId||'')||src===`vlan ${va?.vlanId}`.toLowerCase();
      const dstOk=dst==='any'||dst===(vb?.name||'').toLowerCase()||dst===String(vb?.vlanId||'')||dst===`vlan ${vb?.vlanId}`.toLowerCase();
      if(srcOk&&dstOk)return r.action!=='deny';
    }
    return true;
  }
  function simulate(aId,bId){
    const eps=endpointList(); const a=eps.find(e=>e.id===aId), b=eps.find(e=>e.id===bId);
    const steps=[]; let ok=true;
    if(!a||!b)return {ok:false,steps:[{ok:false,msg:'Selecciona origen y destino.'}]};
    if(a.id===b.id)return {ok:false,steps:[{ok:false,msg:'Origen y destino no pueden ser el mismo.'}]};
    if(!a.vlanRef||!b.vlanRef){ok=false;steps.push({ok:false,msg:'Falta VLAN en origen o destino.'});}
    for(const ep of [a,b]){
      const pv=portVlanOk(ep); if(!pv.ok)ok=false; steps.push({ok:pv.ok,msg:`${ep.name}: ${pv.msg}`});
      if(!ep.ip){steps.push({ok:null,msg:`${ep.name}: no hay IP concreta; se valida parcialmente por VLAN/subnet.`});}
    }
    if(a.vlanRef===b.vlanRef){
      if(sameSubnet(a,b)||(!a.ip||!b.ip)){steps.push({ok:true,msg:'Misma VLAN/subnet: debería haber conectividad L2 si ambos puertos/accesos están bien.'});}
      else {ok=false;steps.push({ok:false,msg:'Misma VLAN pero las IP no parecen pertenecer a la misma subnet.'});}
    }else{
      if(!hasGateway(a)||!hasGateway(b)){ok=false;steps.push({ok:false,msg:'Inter-VLAN requiere gateway/subnet en ambas VLANs.'});}
      else steps.push({ok:true,msg:'Gateways de VLAN presentes para routing inter-VLAN.'});
      if(!matrixAllows(a,b)){ok=false;steps.push({ok:false,msg:'La matriz inter-VLAN bloquea este flujo.'});}
      else steps.push({ok:true,msg:'La matriz inter-VLAN permite este flujo.'});
      if(!icmpRuleAllows(a,b)){ok=false;steps.push({ok:false,msg:'Reglas firewall: ICMP aparece bloqueado por una regla deny.'});}
      else steps.push({ok:true,msg:'Reglas firewall: no se detecta bloqueo ICMP explícito.'});
    }
    return {ok,source:a,target:b,steps};
  }
  function clear(el){ if(el) el.textContent=''; }
  function opt(select, value, label){ const o=document.createElement('option'); o.value=String(value||''); o.textContent=String(label||''); select.appendChild(o); }
  function render(){
    const root=$('nwConnectivityChecker'); if(!root)return;
    const eps=endpointList();
    if(!root.dataset.ready){
      root.textContent='';
      const head=document.createElement('div'); head.className='card-h';
      const title=document.createElement('div'); title.className='card-t'; title.textContent='🧪 Verificador de conectividad';
      const refresh=document.createElement('button'); refresh.className='btn bs bsm'; refresh.id='nwConnRefresh'; refresh.type='button'; refresh.textContent='↻ Actualizar';
      head.append(title, refresh); root.appendChild(head);
      const intro=document.createElement('div'); intro.className='co co-ac'; intro.textContent='Simula un ping lógico entre dos endpoints usando IP/subnet, VLAN, puerto access, matriz inter-VLAN y reglas ICMP/firewall. No envía tráfico real.'; root.appendChild(intro);
      const g=document.createElement('div'); g.className='g2';
      const a=document.createElement('div'); const la=document.createElement('label'); la.className='fl'; la.textContent='Origen'; const src=document.createElement('select'); src.id='nwConnSrc'; a.append(la,src);
      const b=document.createElement('div'); const lb=document.createElement('label'); lb.className='fl'; lb.textContent='Destino'; const dst=document.createElement('select'); dst.id='nwConnDst'; b.append(lb,dst);
      g.append(a,b); root.appendChild(g);
      const brow=document.createElement('div'); brow.className='brow'; const runBtn=document.createElement('button'); runBtn.className='btn bp'; runBtn.id='nwConnRun'; runBtn.type='button'; runBtn.textContent='▶ Simular ping'; brow.appendChild(runBtn); root.appendChild(brow);
      const out=document.createElement('div'); out.id='nwConnResult'; out.style.marginTop='10px'; root.appendChild(out);
      root.dataset.ready='1';
      runBtn.onclick=()=>run(); refresh.onclick=()=>render();
    }
    const src=$('nwConnSrc'), dst=$('nwConnDst'); clear(src); clear(dst);
    eps.forEach(e=>{ const label=`${e.name} · ${e.type} · ${e.vlanLabel} · ${e.ipText}`; opt(src,e.id,label); opt(dst,e.id,label); });
    if(eps[1])dst.selectedIndex=1;
  }
  function run(){
    const res=simulate($('nwConnSrc')?.value,$('nwConnDst')?.value);
    const out=$('nwConnResult'); if(!out)return; out.textContent='';
    const cls=res.ok?'co-gn':'co-rd';
    const summary=document.createElement('div'); summary.className='co '+cls;
    const b=document.createElement('b'); b.textContent=res.ok?'PING POSIBLE':'PING NO GARANTIZADO / BLOQUEADO'; summary.appendChild(b);
    if(res.source){ summary.appendChild(document.createElement('br')); summary.appendChild(document.createTextNode(`${res.source.name} → ${res.target.name}`)); }
    out.appendChild(summary);
    (res.steps||[]).forEach(s=>{ const d=document.createElement('div'); d.className='co '+(s.ok===true?'co-gn':s.ok===false?'co-rd':'co-yw'); d.textContent=(s.ok===true?'✓':s.ok===false?'✗':'•')+' '+String(s.msg||''); out.appendChild(d); });
  }
  function inject(){
    const cfg=document.getElementById('pg-cfg'); if(!cfg||$('nwConnectivityChecker'))return;
    const card=document.createElement('div');card.className='card';card.id='nwConnectivityChecker';
    const first=cfg.querySelector('.g2'); if(first)cfg.insertBefore(card,first); else cfg.appendChild(card);
    render();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,100));
  document.addEventListener('click',e=>{if(e.target.closest('[data-step="cfg"]'))setTimeout(()=>{inject();render();},150);});
  window.NetWizardConnectivityChecker={render,simulate,endpointList};
})();
