/* NetWizard Cabling Utils v3.20
   Utilidades prudentes para modelar cableado físico: medio, categoría, longitud y PoE.
*/
(function(root){
  'use strict';

  function arr(x){ return Array.isArray(x) ? x : []; }
  function clean(s){ return String(s == null ? '' : s).trim(); }
  function num(x){ const n = Number(x); return Number.isFinite(n) ? n : null; }
  function lower(s){ return clean(s).toLowerCase(); }
  function portById(p,id){ return arr(p && p.ports).find(x => x && x.id === id) || null; }
  function devById(p,id){ return arr(p && p.devices).find(x => x && x.id === id) || null; }
  function labelPort(project, port){
    if(!port) return '?';
    const d = devById(project, port.deviceId);
    return (d ? d.name : '?') + ' ' + (port.name || port.id || '?');
  }

  const COPPER_MEDIA = new Set(['utp','stp','copper','rj45','cat5e','cat6','cat6a','cat7','cat8']);
  const FIBER_MEDIA = new Set(['fiber','fibra','sfp','sfp+','qsfp','smf','mmf','om3','om4','os2']);
  const WIRELESS_MEDIA = new Set(['wifi','wi-fi','wireless','lora','zigbee','thread','ble']);

  function normalizeMedium(v){
    const m = lower(v || 'auto').replace(/\s+/g,'');
    if(!m || m === 'auto') return 'auto';
    if(['utp','stp','copper','cobre','rj45','cat5e','cat6','cat6a','cat7','cat8'].includes(m)) return 'copper';
    if(['fiber','fibra','fibraoptica','fiberoptic','sfp','sfp+','sfpplus','qsfp','smf','mmf','om3','om4','os2'].includes(m)) return 'fiber';
    if(['dac','twinax','directattach'].includes(m)) return 'dac';
    if(['wifi','wi-fi','wireless','lora','zigbee','thread','ble'].includes(m)) return 'wireless';
    return m;
  }

  function inferPortMedium(port){
    const txt = lower([port && port.media, port && port.name, port && port.desc, port && port.role].filter(Boolean).join(' '));
    if(/sfp|qsfp|fiber|fibra|ten.?gig|10g/.test(txt)) return 'fiber';
    if(/wifi|wi-?fi|lora|zigbee|thread|ble/.test(txt)) return 'wireless';
    if(/dac|twinax/.test(txt)) return 'dac';
    return 'copper';
  }

  function normalizeCableType(v){
    const t = lower(v).replace(/\s+/g,'');
    if(!t || t === 'auto') return 'auto';
    const aliases = {cat5:'cat5e',cat5e:'cat5e',cat6:'cat6',cat6a:'cat6a',cat7:'cat7',cat8:'cat8',om3:'om3',om4:'om4',os2:'os2',smf:'os2',mmf:'om4',dac:'dac'};
    return aliases[t] || t;
  }

  function speedMbps(v){
    const s = lower(v || 'auto');
    if(!s || s === 'auto') return null;
    if(/400\s*g/.test(s)) return 400000;
    if(/100\s*g/.test(s)) return 100000;
    if(/40\s*g/.test(s)) return 40000;
    if(/25\s*g/.test(s)) return 25000;
    if(/10\s*g/.test(s)) return 10000;
    if(/5\s*g/.test(s)) return 5000;
    if(/2\.5\s*g|2500/.test(s)) return 2500;
    if(/1\s*g|1000|gigabit|ge/.test(s)) return 1000;
    if(/100\s*m|fast|fe/.test(s)) return 100;
    if(/10\s*m/.test(s)) return 10;
    const n = Number(s.replace(/[^0-9.]/g,''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function inferSpeedMbps(port){
    const txt = [port && port.speed, port && port.media, port && port.name, port && port.desc].filter(Boolean).join(' ');
    return speedMbps(txt);
  }

  function maxLengthM(opts){
    const medium = normalizeMedium(opts && opts.medium);
    const cableType = normalizeCableType(opts && opts.cableType);
    const speed = speedMbps(opts && opts.speedMbps) || speedMbps(opts && opts.speed) || null;
    if(medium === 'wireless') return null;
    if(medium === 'dac') return 7;
    if(medium === 'fiber'){
      if(cableType === 'os2') return speed && speed >= 100000 ? 2000 : 10000;
      if(cableType === 'om3') return speed && speed >= 40000 ? 100 : 300;
      if(cableType === 'om4') return speed && speed >= 100000 ? 100 : 400;
      return speed && speed >= 10000 ? 300 : 550;
    }
    // Cobre Ethernet estructurado: límite práctico estándar de canal 100 m.
    if(medium === 'copper' || medium === 'auto'){
      if(cableType === 'cat8' && speed && speed >= 25000) return 30;
      if(cableType === 'cat6' && speed && speed >= 10000) return 55;
      return 100;
    }
    return null;
  }

  function issue(code, severity, message, link){
    return { code, severity, category:'cabling', message, blocking: severity === 'error', source:'cabling', linkId: link && link.id };
  }

  function linkMedium(link, aPort, bPort){
    if(link && link.medium && link.medium !== 'auto') return normalizeMedium(link.medium);
    const a = inferPortMedium(aPort), b = inferPortMedium(bPort);
    if(a === b) return a;
    if(a === 'fiber' || b === 'fiber') return 'fiber';
    if(a === 'wireless' || b === 'wireless') return 'wireless';
    return 'copper';
  }

  function validateCabling(project){
    const errors = [], warnings = [], info = [], issues = [];
    for(const link of arr(project && project.links)){
      const a = portById(project, link.aPortId || link.a);
      const b = portById(project, link.bPortId || link.b);
      if(!a || !b) continue;
      const medium = linkMedium(link, a, b);
      const cableType = normalizeCableType(link.cableType || link.category || link.mediumDetail || 'auto');
      const length = num(link.lengthM != null ? link.lengthM : link.lengthMeters);
      const speed = speedMbps(link.speed) || Math.max(inferSpeedMbps(a) || 0, inferSpeedMbps(b) || 0) || null;
      const maxLen = maxLengthM({medium, cableType, speedMbps:speed});
      const label = `${labelPort(project,a)} ↔ ${labelPort(project,b)}`;
      if(length !== null && length < 0){
        const msg = `${label}: longitud de cable negativa (${length} m).`;
        errors.push(msg); issues.push(issue('NW-CAB-001','error',msg,link));
      }
      if(length !== null && maxLen !== null && length > maxLen){
        const msg = `${label}: longitud ${length} m supera el máximo recomendado para ${medium}${cableType && cableType !== 'auto' ? ' '+cableType : ''}${speed ? ' a '+speed+' Mbps' : ''} (${maxLen} m).`;
        warnings.push(msg); issues.push(issue('NW-CAB-002','warning',msg,link));
      }
      const pa = inferPortMedium(a), pb = inferPortMedium(b);
      if(medium === 'fiber' && (pa === 'copper' || pb === 'copper')){
        const msg = `${label}: el enlace está marcado como fibra pero al menos un puerto parece RJ45/cobre.`;
        warnings.push(msg); issues.push(issue('NW-CAB-003','warning',msg,link));
      }
      if(medium === 'copper' && (pa === 'fiber' || pb === 'fiber')){
        const msg = `${label}: el enlace está marcado como cobre pero al menos un puerto parece SFP/fibra.`;
        warnings.push(msg); issues.push(issue('NW-CAB-004','warning',msg,link));
      }
      const poeNeeded = lower(link.poe || link.poeRequired || '').includes('yes') || link.poeRequired === true;
      if(poeNeeded && medium !== 'copper'){
        const msg = `${label}: PoE solo es esperable sobre cobre/RJ45; revisa el medio configurado.`;
        warnings.push(msg); issues.push(issue('NW-CAB-005','warning',msg,link));
      }
      if(length === null){
        info.push(`${label}: longitud no definida; no se puede comprobar el límite del medio.`);
      }
    }
    if(!errors.length && !warnings.length && !info.length) info.push('Cableado físico: sin datos de cableado que auditar o sin incompatibilidades evidentes.');
    return {ok:errors.length===0, errors, warnings, info, issues};
  }

  const api = {version:'netwizard-cabling-utils-v3.20', normalizeMedium, normalizeCableType, speedMbps, maxLengthM, inferPortMedium, validateCabling};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.NetWizardCablingUtils = api;
})(typeof window !== 'undefined' ? window : globalThis);
