/* =========================================================
   NetWizard Incremental Generators v3.50
   Registro conservador de adaptadores para cambios ejecutables.

   Solo genera comandos cuando el adaptador puede demostrar un formato
   determinista. El fallback siempre es revisión manual, nunca CLI inferida.
========================================================= */
(function initNetWizardIncrementalGenerators(root){
  'use strict';

  const FORMAT='netwizard-incremental-plan';
  const VERSION='3.50.0';
  const PLACEHOLDER=/\$\{[^}]+\}|\b(?:NEXT_HOP|CHANGEME|TODO|REPLACE_ME)\b/i;
  const SENSITIVE=/\b(?:secret|password|authentication-key|encrypted-password|private-key|community)\b/i;
  function arr(value){return Array.isArray(value)?value:[];}
  function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function clean(value,max){return String(value==null?'':value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim().slice(0,max||200);}
  function text(value){return String(value==null?'':value).replace(/\r\n?/g,'\n');}
  function safeName(value,fallback){const source=clean(value,120);const ascii=source.normalize?source.normalize('NFD').replace(/[\u0300-\u036f]/g,''):source;return ascii.replace(/[^A-Za-z0-9_.-]+/g,'-').replace(/^[.-]+|[.-]+$/g,'').slice(0,100)||fallback||'device';}
  function issue(code,message,blocking,extra){return Object.assign({code,severity:blocking?'error':'warning',blocking:!!blocking,category:'incremental-generator',source:'incremental-generator',message},extra||{});}
  function observedConfigMap(snapshot){const raw=snapshot&&snapshot.deviceConfigs,map=new Map();if(Array.isArray(raw)){for(const entry of raw){const id=clean(entry&&entry.deviceId,120);if(id)map.set(id,obj(entry));}}else for(const [id,entry] of Object.entries(obj(raw)))map.set(clean(id,120),typeof entry==='string'?{content:entry}:obj(entry));return map;}
  function desiredConfigMap(value){return value instanceof Map?value:new Map(Object.entries(obj(value)));}
  function parseJunosSet(value){
    const commands=[],invalid=[];
    for(const [index,raw] of text(value).split('\n').entries()){
      const line=raw.trim();if(!line||line.startsWith('#'))continue;
      if(/^set\s+\S/.test(line))commands.push(line);else invalid.push({line:index+1,content:line});
    }
    return{commands:Array.from(new Set(commands)),invalid};
  }
  function difference(left,right){const deny=new Set(right);return Array.from(new Set(left)).filter(line=>!deny.has(line)).sort();}
  function setToDelete(line){return line.replace(/^set\s+/,'delete ');}
  function renderSetFile(title,deletes,adds){const out=[`# ${title}`,'# Revisar con show | compare y ejecutar commit check antes de confirmar.'];for(const line of deletes)out.push(line);for(const line of adds)out.push(line);return out.join('\n')+'\n';}
  function junosAdapter(context){
    const before=parseJunosSet(context.observedConfig),after=parseJunosSet(context.desiredConfig);
    const invalid=before.invalid.map(item=>Object.assign({side:'observed'},item)).concat(after.invalid.map(item=>Object.assign({side:'desired'},item)));
    if(invalid.length)return{ready:false,reason:'La captura o el objetivo contiene líneas que no son comandos Junos set.',details:{invalid:invalid.slice(0,20)}};
    const additions=difference(after.commands,before.commands),removedSet=difference(before.commands,after.commands),deletions=removedSet.map(setToDelete);
    const sensitive=additions.concat(removedSet).filter(line=>PLACEHOLDER.test(line)||SENSITIVE.test(line));
    if(sensitive.length)return{ready:false,reason:'El delta toca secretos, credenciales o placeholders y requiere revisión manual.',details:{sensitiveLines:sensitive.map((_line,index)=>`sensitive-${index+1}`)}};
    if(!additions.length&&!deletions.length)return{ready:true,noChange:true,additions:[],deletions:[],applyContent:'',rollbackContent:''};
    const rollbackDeletes=additions.map(setToDelete),rollbackAdds=removedSet;
    return{ready:true,noChange:false,additions,deletions,applyContent:renderSetFile(`NetWizard Junos candidate — ${context.deviceName}`,deletions,additions),rollbackContent:renderSetFile(`NetWizard Junos rollback candidate — ${context.deviceName}`,rollbackDeletes,rollbackAdds),instructions:['Entrar en modo configuración y crear un rollback point/backup real.','Cargar el fichero con `load set <archivo>` en la configuración candidata.','Ejecutar `show | compare` y comprobar que coincide con el change set.','Ejecutar `commit check`.','Usar `commit confirmed` según la política del cambio; confirmar solo tras validar.'],rollbackInstructions:['Si el commit aún no se confirmó, dejar expirar `commit confirmed` o ejecutar rollback según procedimiento.','Si procede una reversión explícita, cargar el fichero rollback con `load set` y revisar `show | compare`.','Ejecutar `commit check`; el backup real sigue siendo la fuente autoritativa.']};
  }

  const IPV4='(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}';
  const IOS_ENVELOPE=new Set(['configure terminal','conf t','end','write memory','copy running-config startup-config']);
  function ipv4Number(value){const parts=String(value||'').split('.').map(Number);if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return null;return(((parts[0]<<24)>>>0)+(parts[1]<<16)+(parts[2]<<8)+parts[3])>>>0;}
  function validIpv4Mask(value){const mask=ipv4Number(value);if(mask==null)return false;const inverse=(~mask)>>>0;return (inverse&((inverse+1)>>>0))===0;}
  function validVlanList(value){const ids=String(value||'').split(',').map(Number);return ids.length>0&&ids.every(id=>Number.isInteger(id)&&id>=1&&id<=4094)&&new Set(ids).size===ids.length;}
  function iosSlot(type,line){
    let match;
    if(type==='vlan'){
      if((match=line.match(/^name\s+(.{1,32})$/)))return{key:'name',command:`name ${match[1]}`,undo:'no name'};
      return null;
    }
    if(type==='dhcp'){
      const network=line.match(new RegExp(`^network (${IPV4}) (${IPV4})$`));if(network)return validIpv4Mask(network[2])?{key:'network',command:line,undo:'no network'}:{invalid:true};
      const rules=[
        ['default-router',new RegExp(`^default-router (${IPV4})(?: (${IPV4})){0,7}$`),'no default-router'],
        ['dns-server',new RegExp(`^dns-server (${IPV4})(?: (${IPV4})){0,7}$`),'no dns-server'],
        ['domain-name',/^domain-name ([A-Za-z0-9](?:[A-Za-z0-9.-]{0,117}[A-Za-z0-9])?)$/,'no domain-name'],
        ['lease',/^lease (?:infinite|\d{1,3}(?: \d{1,2}(?: \d{1,2})?)?)$/,'no lease']
      ];
      for(const [key,re,undo] of rules)if(re.test(line))return{key,command:line,undo};
      return null;
    }
    if(type!=='interface')return null;
    const exact={
      'switchport': ['switchport-state','no switchport'],
      'no switchport': ['switchport-state','switchport'],
      'switchport nonegotiate': ['nonegotiate','no switchport nonegotiate'],
      'no switchport nonegotiate': ['nonegotiate','switchport nonegotiate'],
      'spanning-tree portfast': ['portfast','no spanning-tree portfast'],
      'spanning-tree bpduguard enable': ['bpduguard','no spanning-tree bpduguard enable'],
      'switchport port-security': ['port-security','no switchport port-security'],
      'switchport port-security mac-address sticky': ['port-security-sticky','no switchport port-security mac-address sticky'],
      'ip dhcp snooping trust': ['dhcp-snooping-trust','no ip dhcp snooping trust'],
      'no ip dhcp snooping trust': ['dhcp-snooping-trust','ip dhcp snooping trust'],
      'ip arp inspection trust': ['arp-inspection-trust','no ip arp inspection trust'],
      'no ip arp inspection trust': ['arp-inspection-trust','ip arp inspection trust'],
      'ip verify source': ['ip-source-guard','no ip verify source'],
      'no ip verify source': ['ip-source-guard','ip verify source'],
      'ip nat inside': ['nat-role','no ip nat inside'],
      'ip nat outside': ['nat-role','no ip nat outside'],
      'shutdown': ['admin-state','no shutdown'],
      'no shutdown': ['admin-state','shutdown'],
      'no ip address': ['ip-address','ip address']
    };
    if(exact[line])return{key:exact[line][0],command:line,undo:exact[line][1]};
    if((match=line.match(/^switchport access vlan (\d{1,4})$/)))return validVlanList(match[1])?{key:'access-vlan',command:line,undo:'no switchport access vlan'}:{invalid:true};
    if((match=line.match(/^switchport trunk native vlan (\d{1,4})$/)))return validVlanList(match[1])?{key:'native-vlan',command:line,undo:'no switchport trunk native vlan'}:{invalid:true};
    if((match=line.match(/^switchport trunk allowed vlan (\d{1,4}(?:,\d{1,4})*)$/)))return validVlanList(match[1])?{key:'allowed-vlans',command:line,undo:'no switchport trunk allowed vlan'}:{invalid:true};
    if((match=line.match(/^encapsulation dot1Q (\d{1,4})(?: native)?$/)))return validVlanList(match[1])?{key:'encapsulation',command:line,undo:'no encapsulation dot1Q'}:{invalid:true};
    if((match=line.match(new RegExp(`^ip address (${IPV4}) (${IPV4})$`))))return validIpv4Mask(match[2])?{key:'ip-address',command:line,undo:'no ip address'}:{invalid:true};
    const rules=[
      ['description',/^description (.{1,160})$/,'no description'],
      ['switchport-mode',/^switchport mode (access|trunk)$/,'no switchport mode'],
      ['port-security-maximum',/^switchport port-security maximum (\d{1,3})$/,'no switchport port-security maximum'],
      ['port-security-violation',/^switchport port-security violation (protect|restrict|shutdown)$/,'no switchport port-security violation']
    ];
    for(const [key,re,undo] of rules)if(re.test(line))return{key,command:line,undo};
    return null;
  }
  function parseIosRoute(line){
    const match=line.match(new RegExp(`^ip route (${IPV4}) (${IPV4}) (${IPV4})(?: (\d{1,3}))?$`));
    if(!match||!validIpv4Mask(match[2]))return null;const distance=match[4]==null?null:Number(match[4]);if(distance!=null&&(distance<1||distance>255))return null;
    return{key:`${match[1]} ${match[2]}`,command:line};
  }
  function parseCiscoIos(value){
    const blocks=[],blockByKey=new Map(),routes=[],excluded=[],opaqueRoots=[],invalid=[];let current=null;
    function addBlock(type,key,header,line){const mapKey=`${type}:${key}`;if(blockByKey.has(mapKey)){invalid.push({line,content:header,reason:'duplicate-block'});current=null;return;}current={type,key,header,slots:new Map(),unknown:[],line};blockByKey.set(mapKey,current);blocks.push(current);}
    for(const [index,rawValue] of text(value).split('\n').entries()){
      const lineNumber=index+1,raw=rawValue.replace(/[ \t]+$/,''),line=raw.trim();if(!line||line.startsWith('!'))continue;
      if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(raw)){invalid.push({line:lineNumber,content:line,reason:'control-character'});continue;}
      if(IOS_ENVELOPE.has(line.toLowerCase())){current=null;continue;}
      if(line.toLowerCase()==='exit'){current=null;continue;}
      const indented=/^[ \t]/.test(raw);
      if(!indented){
        current=null;let match;
        if((match=line.match(/^vlan (\d{1,4})$/))){const id=Number(match[1]);if(id<1||id>4094)invalid.push({line:lineNumber,content:line,reason:'invalid-vlan'});else addBlock('vlan',String(id),`vlan ${id}`,lineNumber);continue;}
        if((match=line.match(/^interface ([A-Za-z][A-Za-z0-9./:_-]{0,127})$/))){addBlock('interface',match[1],`interface ${match[1]}`,lineNumber);continue;}
        if((match=line.match(/^ip dhcp pool ([A-Za-z0-9_.-]{1,64})$/))){addBlock('dhcp',match[1],`ip dhcp pool ${match[1]}`,lineNumber);continue;}
        if(/^vlan\b|^interface\b|^ip dhcp pool\b/.test(line)){invalid.push({line:lineNumber,content:line,reason:'malformed-supported-block'});continue;}
        if(/^ip route\b/.test(line)){const route=parseIosRoute(line);if(route)routes.push(route);else invalid.push({line:lineNumber,content:line,reason:'unsupported-route-format'});continue;}
        if(/^ip dhcp excluded-address\b/.test(line)){
          const command=line.replace(/\s+!\s.*$/,''),match=command.match(new RegExp(`^ip dhcp excluded-address (${IPV4})(?: (${IPV4}))?$`));if(match&&(!match[2]||ipv4Number(match[1])<=ipv4Number(match[2])))excluded.push(command);else invalid.push({line:lineNumber,content:line,reason:'unsupported-exclusion-format'});continue;
        }
        current={type:'opaque',lines:[line],line:lineNumber};opaqueRoots.push(current);continue;
      }
      if(!current){invalid.push({line:lineNumber,content:line,reason:'orphan-subcommand'});continue;}
      if(current.type==='opaque'){current.lines.push(line);continue;}
      const slot=iosSlot(current.type,line);
      if(slot&&slot.invalid){invalid.push({line:lineNumber,content:line,reason:'invalid-supported-value'});continue;}
      if(!slot){current.unknown.push(line);continue;}
      const previous=current.slots.get(slot.key);if(previous&&previous.command!==slot.command)invalid.push({line:lineNumber,content:line,reason:`duplicate-slot:${slot.key}`});else current.slots.set(slot.key,slot);
    }
    return{blocks,blockByKey,routes,excluded:Array.from(new Set(excluded)),opaqueRoots:opaqueRoots.map(item=>item.lines.join('\n')),invalid};
  }
  function multisetContains(available,wanted){const counts=new Map();for(const item of available)counts.set(item,(counts.get(item)||0)+1);for(const item of wanted){const count=counts.get(item)||0;if(!count)return false;counts.set(item,count-1);}return true;}
  function renderIosBlock(header,commands){return commands.length?[header,...commands.map(command=>` ${command}`),' exit']:[];}
  function renderIosFile(title,commands){return[`! ${title}`,'! Candidato sin guardado automático. Revisar línea por línea antes de aplicar.','configure terminal',...commands,'end','! La persistencia queda fuera de este fichero.'].join('\n')+'\n';}
  function ciscoIosAdapter(context){
    const before=parseCiscoIos(context.observedConfig),after=parseCiscoIos(context.desiredConfig),invalid=before.invalid.map(item=>Object.assign({side:'observed'},item)).concat(after.invalid.map(item=>Object.assign({side:'desired'},item)));
    if(invalid.length)return{ready:false,reason:'La captura o el objetivo contiene sintaxis Cisco IOS ambigua dentro del alcance administrado.',details:{invalid:invalid.slice(0,20)}};
    if(!multisetContains(before.opaqueRoots,after.opaqueRoots))return{ready:false,reason:'El objetivo modifica bloques Cisco IOS fuera del alcance seguro (VLAN, interfaces, rutas estáticas y DHCP).'};
    const apply=[],rollback=[],additions=[],deletions=[];
    for(const target of after.blocks){
      const source=before.blockByKey.get(`${target.type}:${target.key}`)||null;
      if(!multisetContains(source?source.unknown:[],target.unknown))return{ready:false,reason:`${target.header}: cambia subcomandos fuera de la allowlist segura.`};
      const forward=[],reverse=[];
      for(const [slotKey,targetSlot] of target.slots){const sourceSlot=source&&source.slots.get(slotKey);if(sourceSlot&&sourceSlot.command===targetSlot.command)continue;forward.push(targetSlot.command);additions.push(`${target.header} :: ${targetSlot.command}`);if(sourceSlot){reverse.push(sourceSlot.command);deletions.push(`${target.header} :: ${sourceSlot.command}`);}else reverse.push(targetSlot.undo);}
      if(!source&&target.type==='vlan'){apply.push(target.header,...forward.map(command=>` ${command}`),' exit');rollback.push(`no ${target.header}`);additions.push(target.header);continue;}
      if(!source&&target.type==='dhcp'){apply.push(target.header,...forward.map(command=>` ${command}`),' exit');rollback.push(`no ${target.header}`);additions.push(target.header);continue;}
      if(forward.length){apply.push(...renderIosBlock(target.header,forward));rollback.push(...renderIosBlock(target.header,reverse));}
    }
    const beforeRoutes=new Map();for(const route of before.routes){const list=beforeRoutes.get(route.key)||[];if(!list.includes(route.command))list.push(route.command);beforeRoutes.set(route.key,list);}
    const desiredRoutes=new Map();for(const route of after.routes){const list=desiredRoutes.get(route.key)||[];if(!list.includes(route.command))list.push(route.command);desiredRoutes.set(route.key,list);}
    for(const [key,wanted] of desiredRoutes){if(wanted.length!==1)return{ready:false,reason:`Ruta ${key}: múltiples objetivos para el mismo prefijo requieren revisión manual.`};const command=wanted[0],existing=beforeRoutes.get(key)||[];if(existing.includes(command))continue;if(existing.length>1)return{ready:false,reason:`Ruta ${key}: existen múltiples rutas observadas y no se puede elegir una sustitución segura.`};if(existing.length===1){apply.push(`no ${existing[0]}`);rollback.unshift(existing[0]);deletions.push(existing[0]);}apply.push(command);rollback.unshift(`no ${command}`);additions.push(command);}
    const beforeExcluded=new Set(before.excluded);for(const command of after.excluded){if(beforeExcluded.has(command))continue;apply.push(command);rollback.unshift(`no ${command}`);additions.push(command);}
    const touched=additions.concat(deletions).filter(line=>PLACEHOLDER.test(line)||SENSITIVE.test(line));if(touched.length)return{ready:false,reason:'El delta Cisco IOS toca secretos, credenciales o placeholders y requiere revisión manual.',details:{sensitiveLines:touched.map((_line,index)=>`sensitive-${index+1}`)}};
    if(!apply.length)return{ready:true,noChange:true,additions:[],deletions:[],applyContent:'',rollbackContent:'',fileExtension:'cfg'};
    return{ready:true,noChange:false,additions,deletions,applyContent:renderIosFile(`NetWizard Cisco IOS candidate — ${context.deviceName}`,apply),rollbackContent:renderIosFile(`NetWizard Cisco IOS rollback candidate — ${context.deviceName}`,rollback),fileExtension:'cfg',instructions:['Capturar y custodiar `show running-config` y `show startup-config` antes del cambio.','Entrar en una sesión con consola/OOB disponible y revisar el candidato línea por línea.','Aplicar primero en ventana de cambio; el fichero entra y sale de modo configuración, pero no guarda.','Ejecutar las comprobaciones funcionales del runbook.','Guardar con `write memory` únicamente tras la aprobación explícita.'],rollbackInstructions:['Si no se guardó y la política lo permite, revertir mediante recarga controlada desde startup-config.','Para reversión explícita, aplicar el candidato rollback y validar el diff operativo.','Si el resultado difiere del esperado, restaurar el backup real; el candidato inverso no lo sustituye.']};
  }
  function createRegistry(){
    const adapters=[];
    function register(adapter){const item=obj(adapter),id=clean(item.id,100),vendors=arr(item.vendors).map(v=>clean(v,80)).filter(Boolean);if(!id||typeof item.generate!=='function'||!vendors.length)throw new Error('Adaptador incremental inválido.');if(adapters.some(existing=>existing.id===id))throw new Error(`Adaptador incremental duplicado: ${id}`);adapters.push({id,version:clean(item.version,40)||'1',vendors,priority:Number.isFinite(Number(item.priority))?Number(item.priority):100,generate:item.generate});adapters.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));return api;}
    function resolve(vendor){return adapters.find(adapter=>adapter.vendors.includes(clean(vendor,80)))||null;}
    function inspect(){return adapters.map(({id,version,vendors,priority})=>({id,version,vendors:vendors.slice(),priority}));}
    const api={register,resolve,inspect};return api;
  }
  const registry=createRegistry();registry.register({id:'cisco-ios.managed-delta',version:'1',vendors:['cisco_ios'],priority:320,generate:ciscoIosAdapter});registry.register({id:'junos.set-delta',version:'1',vendors:['juniper_junos'],priority:300,generate:junosAdapter});

  function buildPlan(project,options){
    const p=obj(project),opts=obj(options),changeSet=obj(opts.changeSet),desiredMap=desiredConfigMap(opts.desiredConfigs),observedMap=observedConfigMap(p.observedState),deployment=obj(p.deployment),incremental=changeSet.requestedMode==='incremental',requireExecutable=deployment.requireExecutableIncremental===true;
    const issues=[],devices=[],artifacts=[],generatedAt=clean(opts.generatedAt,80)||new Date().toISOString(),changeById=new Map(arr(changeSet.devices).map(change=>[change.deviceId,change]));
    if(!changeSet.format)issues.push(issue('NW-INCREMENTAL-001','No existe un change set válido para generar el plan incremental.',true));
    for(const [index,device] of arr(p.devices).entries()){
      const deviceId=clean(device&&device.id,120),deviceName=clean(device&&device.name,120)||deviceId,vendor=clean(device&&device.vendorOs,80)||'generic_network',change=obj(changeById.get(deviceId));
      const base={deviceId,deviceName,vendor,changeStatus:change.status||'baseline-required',adapterId:null,status:incremental?'manual-review':'full-target',applyPath:null,rollbackPath:null,instructions:[],rollbackInstructions:[],commandCounts:{additions:0,deletions:0}};
      if(!incremental){devices.push(base);continue;}
      if(change.status==='no-change'){devices.push(Object.assign(base,{status:'no-change'}));continue;}
      const observed=obj(observedMap.get(deviceId)).content,desired=desiredMap.get(deviceId);
      if(!clean(observed,1)||!clean(desired,1)){issues.push(issue('NW-INCREMENTAL-005',`${deviceName}: faltan la configuración observada o el objetivo requerido por el adaptador.`,true,{deviceId,vendor}));devices.push(base);continue;}
      const adapter=registry.resolve(vendor);if(!adapter){const blocking=requireExecutable;issues.push(issue('NW-INCREMENTAL-002',`${deviceName}: no existe adaptador incremental seguro para ${vendor}.`,blocking,{deviceId,vendor}));devices.push(base);continue;}
      let result;
      try{result=adapter.generate({project:p,device,deviceId,deviceName,vendor,change,observedConfig:observed,desiredConfig:desired});}catch(error){issues.push(issue('NW-INCREMENTAL-006',`${deviceName}: el adaptador ${adapter.id} falló: ${error&&error.message||error}`,true,{deviceId,vendor}));devices.push(base);continue;}
      if(!result||!result.ready){const blocking=requireExecutable;issues.push(issue('NW-INCREMENTAL-003',`${deviceName}: ${result&&result.reason||'el adaptador no pudo demostrar un delta seguro.'}`,blocking,{deviceId,vendor,details:result&&result.details||null}));devices.push(Object.assign(base,{adapterId:adapter.id}));continue;}
      if(result.noChange){devices.push(Object.assign(base,{adapterId:adapter.id,status:'no-change'}));continue;}
      const stem=`${String(index+1).padStart(2,'0')}-${safeName(deviceName,'device')}-${safeName(deviceId,'id')}`,extension=safeName(result.fileExtension||'set','set').replace(/^\.+/,'')||'set',applyPath=`incremental/commands/${stem}.${extension}`,rollbackPath=`incremental/rollback/${stem}.${extension}`;
      artifacts.push({path:applyPath,content:result.applyContent,mime:'text/plain;charset=utf-8'},{path:rollbackPath,content:result.rollbackContent,mime:'text/plain;charset=utf-8'});
      devices.push(Object.assign(base,{adapterId:adapter.id,status:'candidate-ready',applyPath,rollbackPath,instructions:arr(result.instructions),rollbackInstructions:arr(result.rollbackInstructions),commandCounts:{additions:arr(result.additions).length,deletions:arr(result.deletions).length}}));
    }
    const counts={devices:devices.length,candidateReady:devices.filter(item=>item.status==='candidate-ready').length,manualReview:devices.filter(item=>item.status==='manual-review').length,noChange:devices.filter(item=>item.status==='no-change').length,fullTarget:devices.filter(item=>item.status==='full-target').length};
    return{ok:!issues.some(item=>item.blocking),format:FORMAT,version:VERSION,generatedAt,projectName:clean(p.projName,160),mode:incremental?'incremental':'full',requireExecutableIncremental:requireExecutable,registry:registry.inspect(),counts,issues,devices,artifacts,warning:'Solo candidate-ready contiene comandos cargables. manual-review conserva el diff y la configuración objetivo, pero no inventa CLI.'};
  }
  function publicPlan(plan){const copy=JSON.parse(JSON.stringify(plan||{}));delete copy.artifacts;return copy;}
  function buildSummaryMarkdown(plan){const p=obj(plan),out=[`# Plan incremental — ${p.projectName||'NetWizard'}`,'',`- Modo: **${p.mode||'full'}**`,`- Candidatos seguros: ${obj(p.counts).candidateReady||0}`,`- Revisión manual: ${obj(p.counts).manualReview||0}`,`- Sin cambios: ${obj(p.counts).noChange||0}`,'',`> ${p.warning||''}`,'','## Dispositivos',''];for(const device of arr(p.devices)){out.push(`### ${device.deviceName} (${device.vendor})`,'',`- Estado: **${device.status}**`,`- Adaptador: ${device.adapterId||'ninguno'}`,`- Comandos: +${obj(device.commandCounts).additions||0} / -${obj(device.commandCounts).deletions||0}`,`- Candidato: ${device.applyPath?`\`${device.applyPath}\``:'no generado'}`,`- Rollback candidato: ${device.rollbackPath?`\`${device.rollbackPath}\``:'no generado'}`,'');}if(arr(p.issues).length)out.push('## Incidencias','',...p.issues.map(item=>`- [${item.code}] ${item.message}`),'');return out.join('\n')+'\n';}

  const api={version:'netwizard-incremental-generators-v3.50',format:FORMAT,registry,createRegistry,buildPlan,publicPlan,buildSummaryMarkdown,parseJunosSet,junosAdapter,parseCiscoIos,ciscoIosAdapter};
  root.NetWizardIncrementalGenerators=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
