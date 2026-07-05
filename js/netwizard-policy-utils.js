/* =========================================================
   NetWizard Policy Utils v3.18
   Políticas firewall/ACL derivadas de la intención por VLAN.
========================================================= */

/*
Mantenimiento:
- Las reglas generadas desde intención deben ser revisables y reversibles.
- No borrar reglas manuales; solo reemplazar reglas marcadas como generatedFromIntent.
- Mantener computePolicyApplyDiff() sincronizado con applyGeneratedRules().
*/
(function initNetWizardPolicyUtils(root){
  'use strict';
  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function clone(v){ return JSON.parse(JSON.stringify(v == null ? null : v)); }
  function clean(s, max){ return String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0, max || 240); }
  function lower(s){ return clean(s, 80).toLowerCase(); }
  function vlanLabel(v){ return `VLAN${v && v.vlanId ? v.vlanId : '?'}`; }
  function vlanName(v){ return clean((v && v.name) || vlanLabel(v), 80); }
  function normalizeIntent(vlan){
    const nwi = root.NetWizardVlanIntent;
    if(nwi && typeof nwi.normalizeIntent === 'function') return nwi.normalizeIntent(vlan && vlan.intent, vlan);
    const raw = obj(vlan && vlan.intent); const name = lower((vlan && vlan.name) || ''); let type = lower(raw.type || 'users');
    if(!raw.type){ if(/guest|invit/.test(name)) type='guests'; else if(/iot|sensor/.test(name)) type='iot'; else if(/mgmt|gest|admin/.test(name)) type='management'; else if(/server|srv/.test(name)) type='servers'; else if(/dmz/.test(name)) type='dmz'; else if(/cam|cctv/.test(name)) type='cameras'; else if(/voice|voz|voip/.test(name)) type='voice'; else if(/transit|tr[aá]nsito/.test(name)) type='transit'; }
    return { type, dhcp: raw.dhcp !== false, internet: raw.internet !== false, isolation: clean(raw.isolation || (['guests','iot','cameras','dmz'].includes(type) ? 'isolated' : ['management','servers'].includes(type) ? 'restricted' : 'standard'),40), criticality: clean(raw.criticality || 'normal',40) };
  }
  function subnetForVlan(project, vlan){ return arr(obj(project).subnets).find(s => s.vlanRef === vlan.id) || null; }
  function cidrForVlan(project, vlan){ const sn=subnetForVlan(project,vlan); return sn && sn.cidr ? clean(sn.cidr,80) : ''; }
  function endpointForVlan(project, vlan){ return cidrForVlan(project, vlan) || vlanLabel(vlan); }
  function internalCidrs(project){ return arr(obj(project).subnets).map(s=>clean(s.cidr,80)).filter(Boolean).filter(c=>!/\/3[01]$/.test(c)); }
  function mkRule(fields){ const r=Object.assign({id:'',name:'',action:'deny',src:'any',dst:'any',proto:'any',port:'any',dir:'out',prio:500,enabled:true,generatedFromIntent:true,source:'intent',code:'NW-POL-GEN'}, fields||{}); r.name=clean(r.name||`${r.action} ${r.src} ${r.dst}`,100); r.action=['allow','deny','log'].includes(lower(r.action))?lower(r.action):'deny'; r.src=clean(r.src||'any',120); r.dst=clean(r.dst||'any',120); r.proto=clean(r.proto||'any',20); r.port=clean(r.port||'any',80); r.dir=clean(r.dir||'out',20); r.prio=Math.max(1,Math.min(9999,parseInt(r.prio,10)||500)); r.enabled=r.enabled!==false; r.generatedFromIntent=true; return r; }
  function serviceRules(base, services, options){ const opts=options||{}; return arr(services).map((svc,idx)=>mkRule({name:`${opts.prefix||'Permitir'} ${svc.name||svc.port} desde ${base.label}`,action:'allow',src:base.src,dst:svc.dst||opts.dst||'any',proto:svc.proto||'tcp',port:svc.port||'any',dir:opts.dir||'out',prio:(opts.prio||500)+idx,code:opts.code||'NW-POL-ALLOW',reason:opts.reason||''})); }
  function denyInternalRules(project, base, prio, reason){ const cidrs=internalCidrs(project).filter(c=>c!==base.src); return cidrs.map((dst,idx)=>mkRule({name:`Bloquear ${base.label} hacia red interna ${idx+1}`,action:'deny',src:base.src,dst,proto:'any',port:'any',dir:'out',prio:(prio||100)+idx,code:'NW-POL-DENY-INTERNAL',reason:reason||'Aislamiento por intención de VLAN'})); }
  function buildRulesForVlan(project, vlan){ const intent=normalizeIntent(vlan); const type=intent.type; if(type==='transit') return []; const src=endpointForVlan(project,vlan); const base={vlanRef:vlan.id,vlanId:vlan.vlanId,label:vlanLabel(vlan),src}; const out=[]; const isolated=intent.isolation==='isolated'||['guests','iot','cameras','dmz'].includes(type); const restricted=intent.isolation==='restricted'||['management','servers'].includes(type); if(isolated) out.push(...denyInternalRules(project,base,100,`Aislamiento ${vlanName(vlan)}`)); if(type==='guests'){ out.push(...serviceRules(base,[{name:'DNS',proto:'udp',port:'53'},{name:'DHCP',proto:'udp',port:'67,68'}],{prio:210,code:'NW-POL-GUEST-SVC'})); if(intent.internet) out.push(mkRule({name:`Permitir Internet desde ${base.label} invitados`,action:'allow',src,dst:'any',proto:'tcp',port:'80,443',dir:'out',prio:230,code:'NW-POL-GUEST-INET'})); } else if(type==='iot'){ out.push(...serviceRules(base,[{name:'DNS',proto:'udp',port:'53'},{name:'NTP',proto:'udp',port:'123'},{name:'MQTT',proto:'tcp',port:'1883,8883'}],{prio:220,code:'NW-POL-IOT-SVC'})); if(intent.internet) out.push(mkRule({name:`Permitir salida controlada IoT ${base.label}`,action:'allow',src,dst:'any',proto:'tcp',port:'443',dir:'out',prio:260,code:'NW-POL-IOT-INET'})); } else if(type==='cameras'){ out.push(...serviceRules(base,[{name:'DNS',proto:'udp',port:'53'},{name:'NTP',proto:'udp',port:'123'},{name:'Vídeo/NVR',proto:'tcp',port:'554,8000,443'}],{prio:220,code:'NW-POL-CAM-SVC'})); } else if(type==='dmz'){ if(intent.internet) out.push(mkRule({name:`Permitir actualizaciones desde DMZ ${base.label}`,action:'allow',src,dst:'any',proto:'tcp',port:'80,443',dir:'out',prio:240,code:'NW-POL-DMZ-INET'})); out.push(mkRule({name:`Registrar tráfico DMZ ${base.label}`,action:'log',src,dst:'any',proto:'any',port:'any',dir:'out',prio:900,code:'NW-POL-DMZ-LOG'})); } else if(type==='management'){ out.push(...serviceRules(base,[{name:'SSH',proto:'tcp',port:'22'},{name:'HTTPS gestión',proto:'tcp',port:'443'},{name:'SNMP',proto:'udp',port:'161'}],{prio:180,code:'NW-POL-MGMT-SVC',prefix:'Permitir gestión'})); } else if(type==='servers'){ if(restricted) out.push(mkRule({name:`Registrar acceso a servidores ${base.label}`,action:'log',src:'any',dst:src,proto:'any',port:'any',dir:'in',prio:850,code:'NW-POL-SRV-LOG'})); } else if(type==='voice'){ out.push(...serviceRules(base,[{name:'SIP',proto:'udp',port:'5060'},{name:'RTP',proto:'udp',port:'16384-32767'}],{prio:250,code:'NW-POL-VOICE-SVC'})); } else if(restricted){ out.push(mkRule({name:`Registrar tráfico restringido ${base.label}`,action:'log',src,dst:'any',proto:'any',port:'any',dir:'out',prio:900,code:'NW-POL-RESTRICTED-LOG'})); } return out.map((r,idx)=>Object.assign(r,{id:r.id||`pol_${vlan.id}_${idx+1}`,vlanRef:vlan.id,vlanId:vlan.vlanId})); }
  function buildIntentPolicyRules(project){ const p=obj(project); return arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)).flatMap(v=>buildRulesForVlan(p,v)); }
  function manualRuleKey(r){ return [lower(r.action),lower(r.src),lower(r.dst),lower(r.proto),lower(r.port)].join('|'); }
  function ruleComparable(r){
    return {
      id: clean(r && r.id,80), name: clean(r && r.name,120), action: lower(r && r.action), src: clean(r && r.src,120), dst: clean(r && r.dst,120), proto: lower(r && r.proto), port: clean(r && r.port,80), dir: lower(r && r.dir), prio: parseInt(r && r.prio,10)||500, enabled: r && r.enabled!==false, vlanRef: clean(r && r.vlanRef,80), code: clean(r && r.code,80)
    };
  }
  function sameGeneratedRule(a,b){
    const aa=ruleComparable(a), bb=ruleComparable(b);
    return aa.name===bb.name && aa.action===bb.action && aa.src===bb.src && aa.dst===bb.dst && aa.proto===bb.proto && aa.port===bb.port && aa.dir===bb.dir && aa.prio===bb.prio && aa.enabled===bb.enabled && aa.vlanRef===bb.vlanRef && aa.code===bb.code;
  }
  function computePolicyApplyDiff(project, options){
    const opts=options||{}; const p=obj(project); const current=arr(p.fwRules);
    const manual=current.filter(r=>!r.generatedFromIntent);
    const currentGenerated=current.filter(r=>r.generatedFromIntent);
    const existingManualKeys=new Set(manual.filter(r=>r.enabled!==false).map(manualRuleKey));
    const proposed=buildIntentPolicyRules(p).filter(r=>opts.includeDuplicates||!existingManualKeys.has(manualRuleKey(r)));
    const currentByKey=new Map(currentGenerated.map(r=>[manualRuleKey(r),r]));
    const proposedByKey=new Map(proposed.map(r=>[manualRuleKey(r),r]));
    const add=[], update=[], unchanged=[], remove=[];
    for(const r of proposed){ const old=currentByKey.get(manualRuleKey(r)); if(!old)add.push(r); else if(sameGeneratedRule(old,r))unchanged.push(r); else if(opts.replaceExistingGenerated!==false)update.push({before:old,after:r}); else unchanged.push(old); }
    if(opts.replaceExistingGenerated!==false){ for(const r of currentGenerated){ if(!proposedByKey.has(manualRuleKey(r))) remove.push(r); } }
    return { add, update, unchanged, remove, proposed, manualCount:manual.length, currentGeneratedCount:currentGenerated.length, finalRuleCount: manual.length + proposed.length };
  }
  function summarizePolicyApplyDiff(diff){
    const d=diff||{}; const lines=[];
    lines.push('Vista previa de cambios en reglas firewall/ACL');
    lines.push(`+ Añadir: ${arr(d.add).length}`);
    lines.push(`~ Actualizar generadas: ${arr(d.update).length}`);
    lines.push(`= Sin cambios: ${arr(d.unchanged).length}`);
    lines.push(`- Retirar generadas obsoletas: ${arr(d.remove).length}`);
    lines.push(`Total final estimado: ${d.finalRuleCount||0} reglas (${d.manualCount||0} manuales + ${arr(d.proposed).length} generadas)`);
    function one(r){ return `${String(r.prio||500).padStart(4,'0')} ${String(r.action||'').toUpperCase().padEnd(5)} ${r.src} → ${r.dst} ${r.proto||'any'}:${r.port||'any'} · ${r.name||''}`; }
    if(arr(d.add).length){ lines.push('\nReglas a añadir:'); arr(d.add).slice(0,40).forEach(r=>lines.push('+ '+one(r))); if(arr(d.add).length>40)lines.push(`... ${arr(d.add).length-40} más`); }
    if(arr(d.update).length){ lines.push('\nReglas a actualizar:'); arr(d.update).slice(0,20).forEach(x=>lines.push('~ '+one(x.after))); if(arr(d.update).length>20)lines.push(`... ${arr(d.update).length-20} más`); }
    if(arr(d.remove).length){ lines.push('\nReglas generadas que se retirarían:'); arr(d.remove).slice(0,20).forEach(r=>lines.push('- '+one(r))); if(arr(d.remove).length>20)lines.push(`... ${arr(d.remove).length-20} más`); }
    return lines.join('\n');
  }
  function mergeWithManualRules(project, options){ const opts=options||{}; const manual=arr(obj(project).fwRules).filter(r=>r.enabled!==false); const seen=new Set(manual.map(manualRuleKey)); const generated=buildIntentPolicyRules(project).filter(r=>opts.includeDuplicates||!seen.has(manualRuleKey(r))); return manual.concat(generated); }
  function applyGeneratedRules(project, options){ const opts=options||{}; const p=clone(project||{}); const diff=computePolicyApplyDiff(p,opts); p.fwRules=arr(p.fwRules).filter(r=>opts.replaceExistingGenerated ? !r.generatedFromIntent : true); const existing=new Set(p.fwRules.map(manualRuleKey)); const add=buildIntentPolicyRules(p).filter(r=>opts.includeDuplicates||!existing.has(manualRuleKey(r))); p.fwRules=p.fwRules.concat(add.map((r,i)=>Object.assign({},r,{id:r.id||`fw_intent_${Date.now()}_${i}`}))); return {project:p,added:add.length,rules:add,diff}; }
  function validatePolicyForProject(project){ const NWA=root.NetWizardAudit; const create=NWA&&NWA.createIssue?NWA.createIssue:(x=>Object.assign({severity:'warning',blocking:false},x)); const p=obj(project); const issues=[]; const generated=buildIntentPolicyRules(p); const manual=arr(p.fwRules).filter(r=>r.enabled!==false); const all=manual.concat(generated); const bySrc=new Map(); for(const r of all){ const k=clean(r.src||'any',120); if(!bySrc.has(k)) bySrc.set(k,[]); bySrc.get(k).push(r); } for(const v of arr(p.vlans)){ const intent=normalizeIntent(v); if(intent.type==='transit') continue; const src=endpointForVlan(p,v); const rules=bySrc.get(src)||[]; const needsIsolation=intent.isolation==='isolated'||['guests','iot','cameras','dmz'].includes(intent.type); if(needsIsolation && !rules.some(r=>r.action==='deny'&&r.code==='NW-POL-DENY-INTERNAL')) issues.push(create({code:'NW-POL-001',severity:'warning',category:'policy',source:'policy',message:`${vlanLabel(v)} requiere aislamiento, pero no hay denegación interna propuesta o manual.`})); if(intent.internet && !rules.some(r=>r.action!=='deny'&&(r.dst==='any'||/0\.0\.0\.0/.test(r.dst)))) issues.push(create({code:'NW-POL-002',severity:'info',category:'policy',source:'policy',message:`${vlanLabel(v)} requiere Internet; revisa que exista regla/NAT de salida.`})); if(!cidrForVlan(p,v)) issues.push(create({code:'NW-POL-003',severity:'warning',category:'policy',source:'policy',message:`${vlanLabel(v)} no tiene subnet; las reglas se exportarán usando etiqueta VLAN en vez de CIDR.`})); } return {ok:!issues.some(i=>i.severity==='error'),issues,generatedRules:generated}; }
  function summarizeRules(rules){ const list=arr(rules); if(!list.length) return 'No hay reglas generadas desde intención.'; return list.map(r=>`${String(r.prio||500).padStart(4,'0')} ${String(r.action||'').toUpperCase().padEnd(5)} ${r.src} → ${r.dst}  ${r.proto||'any'}:${r.port||'any'}  · ${r.name}`).join('\n'); }


  function slug(s, fallback){
    const raw=clean(s || fallback || 'obj', 80).normalize ? clean(s || fallback || 'obj',80).normalize('NFD').replace(/[\u0300-\u036f]/g,'') : clean(s || fallback || 'obj',80);
    const out=raw.replace(/[^A-Za-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_').toUpperCase();
    return out || String(fallback || 'OBJ').toUpperCase();
  }
  function ip4s(n){ return [24,16,8,0].map(b=>(n>>>b)&255).join('.'); }
  function maskFromPrefix(prefix){ const p=Math.max(0,Math.min(32,parseInt(prefix,10)||0)); return ip4s(p===0?0:(0xFFFFFFFF << (32-p))>>>0); }
  function parseCidrLocal(cidr){
    const nwu=root.NetWizardNetworkUtils;
    if(nwu && typeof nwu.parseCidr==='function') return nwu.parseCidr(cidr);
    const m=String(cidr||'').trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d|[12]\d|3[0-2])$/); if(!m) return null;
    const ip=m[1].split('.').reduce((a,x)=>{ const n=parseInt(x,10); if(n<0||n>255||!Number.isFinite(n)) return NaN; return ((a<<8)>>>0)+n; },0)>>>0;
    if(!Number.isFinite(ip)) return null; const p=parseInt(m[2],10); const mask=p===0?0:(0xFFFFFFFF << (32-p))>>>0; const net=ip&mask;
    return {cidr:ip4s(net)+'/'+p,ip,net,mask,pfx:p,network:ip4s(net),maskString:maskFromPrefix(p)};
  }
  function zoneForIntent(intent){
    const t=lower(intent && intent.type || 'users');
    if(t==='guests') return 'guest'; if(t==='iot') return 'iot'; if(t==='cameras') return 'camera'; if(t==='dmz') return 'dmz'; if(t==='management') return 'mgmt'; if(t==='servers') return 'server'; if(t==='voice') return 'voice'; if(t==='transit') return 'transit'; return 'user';
  }
  function interfaceNameForVlan(vlan){ return `VLAN${vlan && vlan.vlanId ? vlan.vlanId : 'X'}`; }
  function addressObjectName(vlan){ return `NW_${slug(vlanLabel(vlan)+'_'+vlanName(vlan),'VLAN')}`.slice(0,60); }
  function buildPolicyContext(project){
    const p=obj(project); const vlans=arr(p.vlans); const subnets=arr(p.subnets); const byVlanRef=new Map(); const byCidr=new Map(); const zones=new Map();
    const vlanObjects=vlans.map(v=>{
      const intent=normalizeIntent(v); const sn=subnets.find(s=>s.vlanRef===v.id)||null; const parsed=sn&&sn.cidr?parseCidrLocal(sn.cidr):null; const zone=zoneForIntent(intent); const item={
        vlanRef:v.id,vlanId:v.vlanId,name:vlanName(v),label:vlanLabel(v),intent,zone,
        interfaceName:interfaceNameForVlan(v),objectName:addressObjectName(v),cidr:parsed?parsed.cidr:(sn&&sn.cidr?clean(sn.cidr,80):''),
        network:parsed?ip4s(parsed.net):'',mask:parsed?maskFromPrefix(parsed.pfx):'',gateway:sn&&sn.gateway?clean(sn.gateway,80):''
      };
      byVlanRef.set(v.id,item); if(item.cidr) byCidr.set(item.cidr,item); if(!zones.has(zone)) zones.set(zone,{name:`ZONE_${slug(zone)}`,zone,interfaces:[]}); zones.get(zone).interfaces.push(item.interfaceName); return item;
    });
    return {vlanObjects,byVlanRef,byCidr,zones:Array.from(zones.values()).map(z=>Object.assign(z,{interfaces:Array.from(new Set(z.interfaces))}))};
  }
  function resolveAddress(project, value){
    const val=clean(value||'any',120); if(!val || val==='any') return {raw:'any',kind:'any',label:'any',objectName:'all'};
    const ctx=buildPolicyContext(project); const parsed=parseCidrLocal(val); if(parsed && ctx.byCidr.has(parsed.cidr)){ const v=ctx.byCidr.get(parsed.cidr); return {raw:val,kind:'vlan',label:v.label,objectName:v.objectName,zone:v.zone,interfaceName:v.interfaceName,cidr:v.cidr}; }
    if(parsed) return {raw:val,kind:'cidr',label:parsed.cidr,objectName:`NW_NET_${slug(parsed.cidr.replace('/','_'),'NET')}`.slice(0,60),cidr:parsed.cidr,network:ip4s(parsed.net),mask:maskFromPrefix(parsed.pfx)};
    if(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(val)) return {raw:val,kind:'host',label:val,objectName:`NW_HOST_${slug(val.replace(/\./g,'_'),'HOST')}`.slice(0,60),ip:val};
    return {raw:val,kind:'label',label:val,objectName:`NW_LABEL_${slug(val,'LABEL')}`.slice(0,60)};
  }
  function serviceNamesForRule(rule){
    const r=obj(rule); const proto=lower(r.proto||'any'); const raw=clean(r.port||'any',80); if(proto==='any'||raw==='any'||!raw) return ['ALL'];
    const map={ 'tcp:80':'HTTP','tcp:443':'HTTPS','udp:53':'DNS','tcp:53':'DNS','udp:67':'DHCP','udp:68':'DHCP','udp:123':'NTP','tcp:22':'SSH','tcp:1883':'MQTT','tcp:8883':'MQTTS','udp:5060':'SIP','tcp:554':'RTSP','tcp:8000':'TCP_8000','udp:161':'SNMP' };
    const ports=raw.split(',').map(x=>x.trim()).filter(Boolean); const out=[];
    for(const port of ports){ out.push(map[`${proto}:${port}`] || `${proto.toUpperCase()}_${slug(port,'PORT')}`.slice(0,50)); }
    return out.length?Array.from(new Set(out)):['ALL'];
  }
  function enrichPolicyRules(project, rules){
    return arr(rules).map((r)=>{
      const src=resolveAddress(project,r.src); const dst=resolveAddress(project,r.dst); const vlanCtx=r.vlanRef?buildPolicyContext(project).byVlanRef.get(r.vlanRef):null;
      return Object.assign({},r,{srcResolved:src,dstResolved:dst,srcObject:src.objectName,dstObject:dst.objectName,srcZone:src.zone || (vlanCtx&&vlanCtx.zone) || 'any',dstZone:dst.zone || (dst.kind==='any'?'wan':'any'),srcInterface:src.interfaceName || (vlanCtx&&vlanCtx.interfaceName) || 'any',dstInterface:dst.interfaceName || (dst.kind==='any'?'outside':'any'),serviceNames:serviceNamesForRule(r)});
    });
  }
  function buildAddressObjects(project, rules){
    const ctx=buildPolicyContext(project); const byName=new Map();
    for(const v of ctx.vlanObjects){ if(v.cidr && v.network && v.mask) byName.set(v.objectName,{name:v.objectName,type:'subnet',subnet:v.network,mask:v.mask,cidr:v.cidr,zone:v.zone,interfaceName:v.interfaceName,label:v.label}); }
    for(const r of enrichPolicyRules(project,rules||[])){
      for(const a of [r.srcResolved,r.dstResolved]){
        if(!a||a.kind==='any'||byName.has(a.objectName)) continue;
        if(a.kind==='cidr') byName.set(a.objectName,{name:a.objectName,type:'subnet',subnet:a.network,mask:a.mask,cidr:a.cidr,label:a.label});
        else if(a.kind==='host') byName.set(a.objectName,{name:a.objectName,type:'host',ip:a.ip,label:a.label});
      }
    }
    return Array.from(byName.values()).sort((a,b)=>a.name.localeCompare(b.name));
  }
  function summarizePolicyContext(project){
    const ctx=buildPolicyContext(project); const lines=[];
    lines.push('Objetos VLAN/Zona detectados:');
    for(const v of ctx.vlanObjects) lines.push(`${v.objectName.padEnd(28)} ${String(v.cidr||'sin subnet').padEnd(18)} zone=${v.zone} intf=${v.interfaceName}`);
    if(ctx.zones.length){ lines.push('\nZonas lógicas:'); for(const z of ctx.zones) lines.push(`${z.name}: ${z.interfaces.join(', ')}`); }
    return lines.join('\n');
  }

  function bindBrowserUi(){ if(!root.document) return; const doc=root.document; const $=id=>doc.getElementById(id); function project(){ return root.NetWizardState&&root.NetWizardState.getSnapshot?root.NetWizardState.getSnapshot():{vlans:[],subnets:[],fwRules:[]}; } function ensureCard(){ const pg=$('fw-rules'); if(!pg||$('policyIntentOut')) return; const target=pg.querySelector('.g2 > div:last-child')||pg; const card=doc.createElement('div'); card.className='card'; const staticHtml='<div class="card-h"><div class="card-t">🎯 Políticas desde intención VLAN</div><span class="b bac" id="policyIntentCnt">0 reglas</span></div><div class="co co-ac">Genera una propuesta revisable de reglas firewall/ACL desde la intención de cada VLAN. No sustituye a una revisión de seguridad.</div><label class="chk"><input type="checkbox" id="policyReplaceGenerated" checked/> Reemplazar reglas generadas obsoletas</label><div class="brow"><button class="btn bs" id="btnPolicyPreview">Previsualizar reglas</button><button class="btn bs" id="btnPolicyDiff">Ver diff</button><button class="btn bp" id="btnPolicyApply">Aplicar como reglas editables</button></div><pre class="cfg" id="policyIntentOut" style="min-height:150px;white-space:pre-wrap;"></pre>'; card.appendChild(doc.createRange().createContextualFragment(staticHtml)); target.appendChild(card); $('btnPolicyPreview').onclick=preview; $('btnPolicyDiff').onclick=previewDiff; $('btnPolicyApply').onclick=apply; preview(); }
    function replaceGenerated(){ const el=$('policyReplaceGenerated'); return !el || el.checked; }
    function preview(){ const p=project(); const rules=buildIntentPolicyRules(p); const audit=validatePolicyForProject(p); if($('policyIntentCnt')) $('policyIntentCnt').textContent=`${rules.length} propuestas`; const issues=audit.issues&&audit.issues.length&&root.NetWizardAudit?'\n\n'+root.NetWizardAudit.summarizeIssues(audit.issues,{title:'Validación de políticas'}):''; if($('policyIntentOut')) $('policyIntentOut').textContent=summarizeRules(rules)+issues; }
    function previewDiff(){ const p=project(); const diff=computePolicyApplyDiff(p,{replaceExistingGenerated:replaceGenerated()}); if($('policyIntentOut')) $('policyIntentOut').textContent=summarizePolicyApplyDiff(diff); }
    function apply(){ const p=project(); const opts={replaceExistingGenerated:replaceGenerated()}; const diff=computePolicyApplyDiff(p,opts); if($('policyIntentOut')) $('policyIntentOut').textContent=summarizePolicyApplyDiff(diff); if(diff.remove.length && !confirm(`Se retirarán ${diff.remove.length} reglas generadas obsoletas. ¿Continuar?`)) return; const audit=validatePolicyForProject(p); if(root.NetWizardAudit&&root.NetWizardAudit.isProduction&&root.NetWizardAudit.isProduction()&&audit.issues&&audit.issues.some(i=>i.severity==='error'||i.blocking)){ alert('Modo producción: corrige los errores de políticas antes de aplicar.'); return; } const res=applyGeneratedRules(p,opts); if(root.NetWizardHistory&&root.NetWizardHistory.createSnapshot) root.NetWizardHistory.createSnapshot('Antes de aplicar políticas por intención',{silent:true}); root.NetWizardState.replaceProject(res.project,{save:true,silent:false}); if(root.refresh) try{root.refresh();}catch(_e){} previewDiff(); alert(`✓ ${res.added} reglas generadas desde intención añadidas/actualizadas.`); }
    function boot(){ if(!root.NetWizardState){ setTimeout(boot,50); return; } ensureCard(); } if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded',boot); else boot(); doc.addEventListener('nw:project:changed',()=>setTimeout(boot,0)); }
  const api={version:'netwizard-policy-utils-v3.18',normalizeIntent,buildRulesForVlan,buildIntentPolicyRules,mergeWithManualRules,applyGeneratedRules,validatePolicyForProject,summarizeRules,buildPolicyContext,resolveAddress,enrichPolicyRules,buildAddressObjects,summarizePolicyContext,serviceNamesForRule,computePolicyApplyDiff,summarizePolicyApplyDiff}; root.NetWizardPolicyUtils=api; if(typeof module!=='undefined'&&module.exports) module.exports=api; bindBrowserUi();
})(typeof window!=='undefined'?window:globalThis);
