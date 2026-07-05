/* =========================================================
   NetWizard Core Utils v1.0
   Helpers puros y testeables que no dependen del DOM ni del estado S.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */
(function initNetWizardCoreUtils(root){
  'use strict';

  function escapeHtml(value){
    return (value ?? '').toString().replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
  }

  function cleanStr(value){
    return (value ?? '').toString().trim();
  }


  function safeCliText(value, maxLen){
    const max = Number.isFinite(maxLen) ? maxLen : 160;
    return cleanStr(value)
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, max);
  }

  function safeCliToken(value, fallback, maxLen){
    const max = Number.isFinite(maxLen) ? maxLen : 64;
    const cleaned = safeCliText(value || fallback || 'item', max)
      .replace(/[^A-Za-z0-9_.-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[-.]+/, '')
      .slice(0, max);
    return cleaned || cleanStr(fallback || 'item');
  }

  function safeQuotedCli(value, maxLen){
    return safeCliText(value, maxLen).replace(/"/g, "'");
  }

  function uid(prefix){
    return String(prefix || 'id') + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function cmpMixed(a,b,locale){
    const na=parseFloat(a), nb=parseFloat(b);
    if(!Number.isNaN(na) && !Number.isNaN(nb)) return na-nb;
    return cleanStr(a).localeCompare(cleanStr(b), locale || 'es', {numeric:true, sensitivity:'base'});
  }

  function parseAllowed(value){
    return Array.from(new Set((value || '')
      .split(',')
      .map(x => parseInt(String(x).trim(), 10))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 4094)))
      .sort((a,b)=>a-b);
  }

  function maskToString(mask, ip4s){
    if(typeof ip4s !== 'function') throw new Error('maskToString requiere una función ip4s');
    return ip4s(mask >>> 0);
  }

  function buildPortName(vendorOs, media, pos, base){
    const b=(base || '').trim();
    if(vendorOs==='cisco_ios' || vendorOs==='cisco_asa'){
      const sfx=b ? `${b}${pos}` : `0/${pos}`;
      return media==='FE' ? `FastEthernet${sfx}` : `GigabitEthernet${sfx}`;
    }
    if(vendorOs==='juniper_junos'){
      const sfx=b ? `${b}${pos-1}` : `0/0/${pos-1}`;
      return `ge-${sfx}`;
    }
    if(vendorOs==='aruba_aoss') return b ? `${b}${pos}` : `1/1/${pos}`;
    return `${media}${pos}`;
  }

  function normalizeProjectShape(project, defaults){
    const def = typeof defaults === 'function' ? defaults() : (defaults || {});
    const next = { ...def, ...(project || {}) };
    if(!next.vtp) next.vtp={domain:'',password:'',version:'2',pruning:'no',roles:{}};
    if(!next.vtp.roles) next.vtp.roles={};
    if(!next.visual) next.visual={locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null};
    if(!Array.isArray(next.visual.locs)) next.visual.locs=[];
    if(!next.visual.assign) next.visual.assign={devices:{},hosts:{}};
    if(!next.visual.assign.devices) next.visual.assign.devices={};
    if(!next.visual.assign.hosts) next.visual.assign.hosts={};
    if(!next.visual.pos) next.visual.pos={};
    if(!next.visual.view) next.visual.view={px:60,py:50,zoom:1};
    if(!Array.isArray(next.hostPhysicalLocations)) next.hostPhysicalLocations=[];
    if(!Array.isArray(next.physicalLocations)) next.physicalLocations=[];
    if(!next.uiSort) next.uiSort={};
    if(!next.iot) next.iot=(def && def.iot) ? JSON.parse(JSON.stringify(def.iot)) : {accessNodes:[],devices:[],map:{}};
    if(!Array.isArray(next.iot.accessNodes)) next.iot.accessNodes=[];
    if(!Array.isArray(next.iot.devices)) next.iot.devices=[];
    if(!next.iot.map) next.iot.map=(def && def.iot && def.iot.map) ? JSON.parse(JSON.stringify(def.iot.map)) : {show:{network:true,port:false,access:true,iot:true,wifi:true,lora:true,zigbee:true,thread:true,mqtt:true},scale:1,panX:0,panY:0};
    if(!next.iot.map.show) next.iot.map.show=(def && def.iot && def.iot.map && def.iot.map.show) ? JSON.parse(JSON.stringify(def.iot.map.show)) : {network:true,port:false,access:true,iot:true,wifi:true,lora:true,zigbee:true,thread:true,mqtt:true};
    return next;
  }

  const api={
    version:'netwizard-core-utils-v1',
    escapeHtml,
    cleanStr,
    uid,
    safeCliText,
    safeCliToken,
    safeQuotedCli,
    cmpMixed,
    parseAllowed,
    maskToString,
    buildPortName,
    normalizeProjectShape
  };
  root.NetWizardCoreUtils=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
