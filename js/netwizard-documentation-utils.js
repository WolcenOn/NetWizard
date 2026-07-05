/* =========================================================
   NetWizard Documentation Utils v3.48
   Inventario exportable y matriz de conectividad entre VLANs.
========================================================= */
(function initNetWizardDocumentationUtils(root){
  'use strict';

  function i18n(){ return root.NetWizardI18n || null; }
  function localeForReport(options){ return (options && options.locale) || (i18n() && i18n().getReportLocale && i18n().getReportLocale()) || (i18n() && i18n().getLocale && i18n().getLocale()) || 'es'; }
  const FALLBACK_LABELS={
    'docs.matrix.empty':'No hay VLANs suficientes para generar matriz.',
    'docs.matrix.title':'Matriz de conectividad entre VLANs',
    'docs.matrix.more':'... {count} filas más. Descarga CSV para ver todo.',
    'doc.title':'Documentación NetWizard — {project}',
    'doc.exported':'Exportado: {date}',
    'doc.summary':'Resumen','doc.devices':'Dispositivos','doc.vlans':'VLANs','doc.ports':'Puertos','doc.links':'Enlaces','doc.hosts':'Hosts','doc.dhcp':'DHCP','doc.firewall':'Firewall','doc.connectivityMatrix':'Matriz de conectividad','doc.notes':'Notas',
    'doc.note.design':'Esta documentación es una ayuda de diseño y debe revisarse antes de producción.',
    'doc.note.review':'Las filas marcadas como `REVIEW`, `ALLOW/REVIEW` o `DENY/REVIEW` requieren validación técnica.',
    'matrix.destination.internet':'Internet/WAN',
    'matrix.service.internet':'DNS, HTTP, HTTPS según política',
    'matrix.service.none':'—',
    'matrix.service.local':'local',
    'matrix.service.review':'según necesidad',
    'matrix.reason.internet.allow':'Intención VLAN permite Internet',
    'matrix.reason.internet.deny':'Intención VLAN no declara Internet',
    'matrix.reason.local':'Tráfico dentro de la misma VLAN',
    'matrix.reason.blocked':'Matriz inter-VLAN marcada como bloqueada',
    'matrix.reason.explicit':'Regla firewall explícita',
    'matrix.reason.isolation':'Intención {type} recomienda aislamiento lateral',
    'matrix.reason.management':'VLAN de gestión; confirmar alcance administrativo',
    'matrix.reason.default':'Sin regla explícita; revisar antes de producción'
  };
  function tr(key, params, locale){
    if(i18n() && i18n().t) return i18n().t(key, params||{}, locale||localeForReport());
    const tpl=FALLBACK_LABELS[key]||key;
    return String(tpl).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_,k)=>params&&Object.prototype.hasOwnProperty.call(params,k)?String(params[k]):'');
  }
  function arr(v){ return Array.isArray(v) ? v : []; }
  function obj(v){ return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function clean(s, max){ return String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0, max || 500); }
  function lower(s){ return clean(s,80).toLowerCase(); }
  function escMd(s){ return clean(s,1000).replace(/\|/g,'\\|').replace(/\n/g,'<br>'); }
  function csvCell(v){ const s=String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
  function toCsv(rows, columns){
    const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
    return [cols.join(','), ...arr(rows).map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\n');
  }
  function downloadText(filename, text, mime){
    if(!root.document) return false;
    const blob = new Blob([text], {type: mime || 'text/plain;charset=utf-8'});
    const a = root.document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    root.document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return true;
  }
  function deviceById(p,id){ return arr(obj(p).devices).find(d=>d.id===id)||null; }
  function portById(p,id){ return arr(obj(p).ports).find(x=>x.id===id)||null; }
  function vlanByRef(p,id){ return arr(obj(p).vlans).find(v=>v.id===id)||null; }
  function vlanByNum(p,num){ return arr(obj(p).vlans).find(v=>String(v.vlanId)===String(num))||null; }
  function subnetByVlanRef(p,id){ return arr(obj(p).subnets).find(s=>s.vlanRef===id)||null; }
  function hostPort(p,h){ return h && h.portId ? portById(p,h.portId) : null; }
  function portLabel(p,port){ if(!port) return ''; const d=deviceById(p,port.deviceId); return `${d?d.name:'?'} ${port.name||port.id||''}`.trim(); }
  function vlanLabel(v){ return v ? `VLAN ${v.vlanId} ${v.name||''}`.trim() : ''; }
  function intentOf(v){
    const nwi=root.NetWizardVlanIntent; if(nwi&&typeof nwi.normalizeIntent==='function') return nwi.normalizeIntent(v&&v.intent, v);
    const raw=obj(v&&v.intent); return {type:raw.type||'users',expectedHosts:raw.expectedHosts||'',growth:raw.growth||'',dhcp:raw.dhcp!==false,internet:raw.internet!==false,isolation:raw.isolation||''};
  }
  function dhcpForVlan(p,v){ const dh=obj(p.dhcp); return dh[String(v.vlanId)] || dh[v.id] || null; }
  function buildInventoryRows(project){
    const p=obj(project); const rows=[];
    for(const d of arr(p.devices)) rows.push({section:'Dispositivos',key:d.id||'',name:d.name||'',type:d.type||'',vlan:'',device:d.name||'',port:'',ip:d.mgmtIp||'',cidr:'',gateway:'',mode:d.vendorOs||'',action:'',source:'',destination:'',service:'',notes:d.notes||'',extra:d.poeBudgetW?`PoE budget ${d.poeBudgetW} W`:''});
    for(const pt of arr(p.ports)){ const d=deviceById(p,pt.deviceId); const v=vlanByRef(p,pt.vlanRef); rows.push({section:'Puertos',key:pt.id||'',name:pt.name||'',type:pt.type||'',vlan:vlanLabel(v)||pt.vlanRef||'',device:d?d.name:'',port:pt.name||'',ip:pt.l3Ip||pt.routedIp||'',cidr:pt.l3Cidr||pt.routedCidr||'',gateway:'',mode:pt.mode||'',action:'',source:'',destination:'',service:'',notes:pt.notes||'',extra:[pt.allowedVlans?`allowed=${pt.allowedVlans}`:'',pt.poeMode?`poe=${pt.poeMode}`:'',pt.poeWattsMax?`poeMax=${pt.poeWattsMax}W`:''].filter(Boolean).join(' · ')}); }
    for(const l of arr(p.links)){ const a=portById(p,l.aPortId||l.a), b=portById(p,l.bPortId||l.b); const tv=vlanByRef(p,l.transitVlanRef||l.l3VlanRef||l.vlanRef); rows.push({section:'Enlaces',key:l.id||'',name:`${portLabel(p,a)} ↔ ${portLabel(p,b)}`,type:l.medium||'',vlan:vlanLabel(tv),device:'',port:'',ip:'',cidr:'',gateway:'',mode:l.speed||'',action:'',source:portLabel(p,a),destination:portLabel(p,b),service:'',notes:l.notes||'',extra:[l.cableType||'',l.lengthM!==undefined&&l.lengthM!==''?`${l.lengthM} m`:''].filter(Boolean).join(' · ')}); }
    for(const v of arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0))){ const sn=subnetByVlanRef(p,v.id); const it=intentOf(v); rows.push({section:'VLANs',key:v.id||'',name:v.name||'',type:it.type||'',vlan:String(v.vlanId||''),device:'',port:'',ip:'',cidr:sn&&sn.cidr||'',gateway:sn&&sn.gateway||'',mode:it.isolation||'',action:'',source:'',destination:'',service:'',notes:v.notes||it.notes||'',extra:[it.expectedHosts?`hosts=${it.expectedHosts}`:'',it.growth?`growth=${it.growth}`:'',`dhcp=${it.dhcp?'sí':'no'}`,`internet=${it.internet?'sí':'no'}`].filter(Boolean).join(' · ')}); }
    for(const h of arr(p.hosts)){ const v=vlanByRef(p,h.vlanRef); const pt=hostPort(p,h); const d=pt?deviceById(p,pt.deviceId):null; rows.push({section:'Hosts',key:h.id||'',name:h.name||'',type:h.type||'',vlan:vlanLabel(v),device:d?d.name:'',port:pt?pt.name:'',ip:h.ipMode==='static'?(h.staticIp||''):'DHCP',cidr:'',gateway:'',mode:h.ipMode||'',action:'',source:'',destination:'',service:'',notes:h.notes||'',extra:[h.mac?`mac=${h.mac}`:'',h.poeRequired?`PoE ${h.poeWatts||'?'} W`:''].filter(Boolean).join(' · ')}); }
    for(const v of arr(p.vlans)){ const dh=dhcpForVlan(p,v); if(!dh) continue; rows.push({section:'DHCP',key:String(v.vlanId||v.id||''),name:`DHCP ${vlanLabel(v)}`,type:'scope',vlan:vlanLabel(v),device:'',port:'',ip:'',cidr:(subnetByVlanRef(p,v.id)||{}).cidr||'',gateway:(subnetByVlanRef(p,v.id)||{}).gateway||'',mode:dh.enabled?'enabled':'disabled',action:'',source:dh.start||'',destination:dh.end||'',service:arr(dh.dns).join('; ')||dh.dns||'',notes:dh.domain||'',extra:[dh.leaseDays?`lease=${dh.leaseDays}d`:'',arr(dh.exclusions).length?`exclusions=${arr(dh.exclusions).length}`:'',arr(dh.reservations).length?`reservations=${arr(dh.reservations).length}`:''].filter(Boolean).join(' · ')}); }
    for(const r of arr(p.fwRules)){ rows.push({section:'Firewall',key:r.id||'',name:r.name||'',type:r.generatedFromIntent?'generada':'manual',vlan:r.vlanId||r.vlanRef||'',device:'',port:'',ip:'',cidr:'',gateway:'',mode:r.enabled===false?'disabled':'enabled',action:r.action||'',source:r.src||'',destination:r.dst||'',service:`${r.proto||'any'}:${r.port||'any'}`,notes:r.code||'',extra:`prio=${r.prio||''}`}); }
    return rows;
  }
  const INVENTORY_COLUMNS=['section','key','name','type','vlan','device','port','ip','cidr','gateway','mode','action','source','destination','service','notes','extra'];
  function buildConnectivityMatrix(project, options){
    const p=obj(project); const loc=localeForReport(options); const vlans=arr(p.vlans).slice().sort((a,b)=>(a.vlanId||0)-(b.vlanId||0)); const rows=[]; const fws=arr(p.fwRules).filter(r=>r.enabled!==false);
    function endpoint(v){ const sn=subnetByVlanRef(p,v.id); return sn&&sn.cidr ? sn.cidr : `VLAN${v.vlanId}`; }
    function explicitRule(src,dst){ const se=endpoint(src), de=endpoint(dst); return fws.find(r=>{ const rs=clean(r.src,120), rd=clean(r.dst,120); return (rs===se||rs===`VLAN${src.vlanId}`||rs===String(src.vlanId)) && (rd===de||rd===`VLAN${dst.vlanId}`||rd===String(dst.vlanId)||rd==='any'); }); }
    function internetRow(v){ const it=intentOf(v); return {source:vlanLabel(v),destination:tr('matrix.destination.internet',{},loc),action:it.internet?'ALLOW':'DENY/REVIEW',services:it.internet?tr('matrix.service.internet',{},loc):tr('matrix.service.none',{},loc),reason:it.internet?tr('matrix.reason.internet.allow',{},loc):tr('matrix.reason.internet.deny',{},loc),sourceType:'intent'}; }
    for(const s of vlans){ rows.push(internetRow(s)); for(const d of vlans){ if(s.id===d.id){ rows.push({source:vlanLabel(s),destination:vlanLabel(d),action:'ALLOW',services:tr('matrix.service.local',{},loc),reason:tr('matrix.reason.local',{},loc),sourceType:'local'}); continue; }
        const key=`${s.id}_${d.id}`; const blocked=p.vlanMatrix && p.vlanMatrix[key]===false; const srci=intentOf(s); const rule=explicitRule(s,d);
        if(blocked){ rows.push({source:vlanLabel(s),destination:vlanLabel(d),action:'DENY',services:'any',reason:tr('matrix.reason.blocked',{},loc),sourceType:'matrix'}); }
        else if(rule){ rows.push({source:vlanLabel(s),destination:vlanLabel(d),action:upperAction(rule.action),services:`${rule.proto||'any'}:${rule.port||'any'}`,reason:rule.name||tr('matrix.reason.explicit',{},loc),sourceType:rule.generatedFromIntent?'generated-policy':'manual-fw'}); }
        else if(['guests','iot','cameras','dmz'].includes(srci.type) || srci.isolation==='isolated'){ rows.push({source:vlanLabel(s),destination:vlanLabel(d),action:'DENY/REVIEW',services:'any',reason:tr('matrix.reason.isolation',{type:srci.type||'aislada'},loc),sourceType:'intent'}); }
        else if(srci.type==='management'){ rows.push({source:vlanLabel(s),destination:vlanLabel(d),action:'ALLOW/REVIEW',services:'SSH, HTTPS, SNMP',reason:tr('matrix.reason.management',{},loc),sourceType:'intent'}); }
        else { rows.push({source:vlanLabel(s),destination:vlanLabel(d),action:'REVIEW',services:tr('matrix.service.review',{},loc),reason:tr('matrix.reason.default',{},loc),sourceType:'default'}); }
    }}
    return rows;
  }
  function upperAction(a){ const x=lower(a); return x==='allow'?'ALLOW':x==='deny'?'DENY':x==='log'?'LOG':'REVIEW'; }
  function markdownTable(rows, cols){ if(!arr(rows).length) return '_Sin datos._\n'; const head='| '+cols.join(' | ')+' |'; const sep='| '+cols.map(()=> '---').join(' | ')+' |'; const body=rows.map(r=>'| '+cols.map(c=>escMd(r[c])).join(' | ')+' |'); return [head,sep,...body].join('\n')+'\n'; }
  function buildMarkdownDocument(project, options){
    const p=obj(project); const now=new Date().toISOString(); const inv=buildInventoryRows(p); const lines=[]; const loc=localeForReport(options); const matrix=buildConnectivityMatrix(p, {locale:loc});
    const projectName=clean(p.projName||(loc==='en'?'Untitled project':'Proyecto sin título'),120);
    lines.push('# '+tr('doc.title',{project:projectName},loc)); lines.push(''); lines.push(tr('doc.exported',{date:now},loc)); lines.push('');
    lines.push('## '+tr('doc.summary',{},loc)); lines.push(''); lines.push(markdownTable([{devices:arr(p.devices).length,vlans:arr(p.vlans).length,subnets:arr(p.subnets).length,hosts:arr(p.hosts).length,links:arr(p.links).length,rules:arr(p.fwRules).length}], ['devices','vlans','subnets','hosts','links','rules']));
    const sectionMap=[['Dispositivos','doc.devices'],['VLANs','doc.vlans'],['Puertos','doc.ports'],['Enlaces','doc.links'],['Hosts','doc.hosts'],['DHCP','doc.dhcp'],['Firewall','doc.firewall']];
    for(const pair of sectionMap){ const section=pair[0], key=pair[1]; const rows=inv.filter(r=>r.section===section).slice(0,500); lines.push('## '+tr(key,{},loc)); lines.push(''); lines.push(markdownTable(rows, ['name','type','vlan','device','port','ip','cidr','gateway','mode','extra'])); }
    lines.push('## '+tr('doc.connectivityMatrix',{},loc)); lines.push(''); lines.push(markdownTable(matrix.slice(0,1000), ['source','destination','action','services','reason','sourceType']));
    lines.push('## '+tr('doc.notes',{},loc)); lines.push(''); lines.push('- '+tr('doc.note.design',{},loc)); lines.push('- '+tr('doc.note.review',{},loc));
    return lines.join('\n');
  }
  function projectSnapshot(){ return root.NetWizardState&&root.NetWizardState.getSnapshot ? root.NetWizardState.getSnapshot() : {}; }
  function bindBrowserUi(){ if(!root.document) return; const doc=root.document; const $=id=>doc.getElementById(id); function ensureCard(){ const pg=$('pg-dash'); if(!pg||$('nwDocCard')) return; const card=doc.createElement('div'); card.className='card'; card.id='nwDocCard'; const staticHtml='<div class="card-h"><div class="card-t" data-i18n="docs.card.title">📑 Inventario, documentación y matriz</div><span class="b bac" id="nwDocCnt" data-i18n="docs.card.badge">v3.48 i18n</span></div><div class="co co-ac" data-i18n="docs.card.desc">Exporta un inventario operativo del proyecto y revisa una matriz de conectividad entre VLANs antes de producción.</div><div class="brow"><button class="btn bs" id="btnDocMatrix" data-i18n="docs.viewMatrix">Ver matriz</button><button class="btn bs" id="btnDocCsv" data-i18n="docs.downloadInventory">Descargar inventario CSV</button><button class="btn bs" id="btnDocMatrixCsv" data-i18n="docs.downloadMatrix">Descargar matriz CSV</button><button class="btn bp" id="btnDocMd" data-i18n="docs.downloadMarkdown">Descargar documentación Markdown</button></div><pre class="cfg" id="nwDocOut" style="min-height:140px;white-space:pre-wrap;"></pre>'; card.appendChild(doc.createRange().createContextualFragment(staticHtml)); if(root.NetWizardI18n&&root.NetWizardI18n.applyI18n) root.NetWizardI18n.applyI18n(card); pg.appendChild(card); $('btnDocMatrix').onclick=()=>{ const p=projectSnapshot(); const rows=buildConnectivityMatrix(p); $('nwDocOut').textContent=summarizeConnectivityMatrix(rows); }; $('btnDocCsv').onclick=()=>{ const p=projectSnapshot(); downloadText(safeFileName(p,'inventario')+'.csv', toCsv(buildInventoryRows(p), INVENTORY_COLUMNS), 'text/csv;charset=utf-8'); }; $('btnDocMatrixCsv').onclick=()=>{ const p=projectSnapshot(); downloadText(safeFileName(p,'matriz-conectividad')+'.csv', toCsv(buildConnectivityMatrix(p), ['source','destination','action','services','reason','sourceType']), 'text/csv;charset=utf-8'); }; $('btnDocMd').onclick=()=>{ const p=projectSnapshot(); downloadText(safeFileName(p,'documentacion')+'.md', buildMarkdownDocument(p), 'text/markdown;charset=utf-8'); }; }
    if(doc.readyState==='loading') doc.addEventListener('DOMContentLoaded', ensureCard); else setTimeout(ensureCard,0);
  }
  function safeFileName(project, suffix){ const base=clean(obj(project).projName||'netwizard',80).normalize ? clean(obj(project).projName||'netwizard',80).normalize('NFD').replace(/[\u0300-\u036f]/g,'') : clean(obj(project).projName||'netwizard',80); return (base.replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'netwizard')+'_'+suffix; }
  function summarizeConnectivityMatrix(rows, options){ const list=arr(rows); const loc=localeForReport(options); if(!list.length) return tr('docs.matrix.empty',{},loc); const counts=list.reduce((a,r)=>{ const k=r.action||'REVIEW'; a[k]=(a[k]||0)+1; return a; },{}); const lines=[tr('docs.matrix.title',{},loc), Object.keys(counts).sort().map(k=>`${k}: ${counts[k]}`).join(' · '), '']; list.slice(0,80).forEach(r=>lines.push(`${r.action.padEnd(12)} ${r.source} → ${r.destination} · ${r.services} · ${r.reason}`)); if(list.length>80) lines.push(tr('docs.matrix.more',{count:list.length-80},loc)); return lines.join('\n'); }
  const api={version:'netwizard-documentation-utils-v3.48',buildInventoryRows,toCsv,buildConnectivityMatrix,buildMarkdownDocument,summarizeConnectivityMatrix,downloadText,INVENTORY_COLUMNS}; root.NetWizardDocumentationUtils=api; if(typeof module!=='undefined'&&module.exports) module.exports=api; bindBrowserUi();
})(typeof window !== 'undefined' ? window : globalThis);
