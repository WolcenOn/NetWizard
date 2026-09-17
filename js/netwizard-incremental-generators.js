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
  const SENSITIVE=/\b(?:secret|password|auth-pwd|priv-pwd|authentication-key|encrypted-password|private-key|community|pre-shared-key|psk)\b/i;
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
    function addBlock(type,key,header,line){const mapKey=`${type}:${key}`,existing=blockByKey.get(mapKey);if(existing){current=existing;return;}current={type,key,header,slots:new Map(),unknown:[],line};blockByKey.set(mapKey,current);blocks.push(current);}
    function addOpaque(line,lineNumber){current={type:'opaque',lines:[line],line:lineNumber};opaqueRoots.push(current);}
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
        if(/^ip route\b/.test(line)){const route=parseIosRoute(line);if(route)routes.push(route);else addOpaque(line,lineNumber);continue;}
        if(/^ip dhcp excluded-address\b/.test(line)){
          const command=line.replace(/\s+!\s.*$/,''),match=command.match(new RegExp(`^ip dhcp excluded-address (${IPV4})(?: (${IPV4}))?$`));if(match&&(!match[2]||ipv4Number(match[1])<=ipv4Number(match[2])))excluded.push(command);else invalid.push({line:lineNumber,content:line,reason:'unsupported-exclusion-format'});continue;
        }
        addOpaque(line,lineNumber);continue;
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
  function removableLogicalInterface(name){return /\.\d+$|^(?:Vlan|Loopback|Tunnel|Port-channel)\d+$/i.test(String(name||''));}
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
      if(!source&&target.type==='interface'){if(!removableLogicalInterface(target.key))return{ready:false,reason:`${target.header}: una interfaz física sin stanza observada no tiene rollback exacto demostrable.`};apply.push(target.header,...forward.map(command=>` ${command}`),' exit');rollback.push(`no ${target.header}`);additions.push(target.header);continue;}
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

  const FORTI_FIXED_SECTIONS=new Set(['system global','system interface','firewall address','system zone','router static','firewall policy','system dhcp server','system dns','system ntp','user radius','system snmp user']);
  function fortiSupportedSection(path){return FORTI_FIXED_SECTIONS.has(path)||/^log syslogd\d* setting$/.test(path);}
  function fortiNode(name){return{name,direct:new Map(),entries:new Map()};}
  function fortiEntry(key,display){return{key,display,fields:new Map(),configs:new Map()};}
  function fortiEditKey(value){const raw=String(value||'').trim();let match;if((match=raw.match(/^"([^"\r\n]{1,128})"$/)))return{key:match[1],display:raw};if(/^[A-Za-z0-9_.:/-]{1,128}$/.test(raw))return{key:raw,display:raw};return null;}
  function fortiSlot(line){let match;if((match=line.match(/^set ([A-Za-z0-9_-]{1,80}) (.{1,512})$/)))return{field:match[1],verb:'set',value:match[2],command:line};if((match=line.match(/^unset ([A-Za-z0-9_-]{1,80})$/)))return{field:match[1],verb:'unset',value:'',command:line};return null;}
  function fortiMergeSlots(target,source,invalid,location){for(const [field,slot] of source){const previous=target.get(field);if(previous&&previous.command!==slot.command)invalid.push({location,content:slot.command,reason:`duplicate-slot:${field}`});else target.set(field,slot);}}
  function fortiMergeEntry(target,source,invalid,location){fortiMergeSlots(target.fields,source.fields,invalid,location);for(const [name,node] of source.configs){const previous=target.configs.get(name);if(!previous)target.configs.set(name,node);else fortiMergeNode(previous,node,invalid,`${location}/config ${name}`);}}
  function fortiMergeNode(target,source,invalid,location){fortiMergeSlots(target.direct,source.direct,invalid,location);for(const [key,entry] of source.entries){const previous=target.entries.get(key);if(!previous)target.entries.set(key,entry);else fortiMergeEntry(previous,entry,invalid,`${location}/edit ${entry.display}`);}}
  function parseFortiStructured(lines,path,invalid,blockLine){
    const rootNode=fortiNode(path),stack=[{kind:'config',node:rootNode,root:true}];
    for(let offset=1;offset<lines.length-1;offset++){
      const line=lines[offset].trim(),lineNumber=blockLine+offset;if(!line||line.startsWith('#'))continue;const current=stack[stack.length-1];let match;
      if((match=line.match(/^config ([A-Za-z0-9 _.-]{1,120})$/))){if(current.kind!=='edit'){invalid.push({line:lineNumber,content:line,reason:'nested-config-outside-edit'});continue;}const name=match[1].trim(),node=current.node.configs.get(name)||fortiNode(name);current.node.configs.set(name,node);stack.push({kind:'config',node});continue;}
      if((match=line.match(/^edit (.+)$/))){if(current.kind!=='config'){invalid.push({line:lineNumber,content:line,reason:'nested-edit'});continue;}const parsed=fortiEditKey(match[1]);if(!parsed){invalid.push({line:lineNumber,content:line,reason:'invalid-edit-key'});continue;}const entry=current.node.entries.get(parsed.key)||fortiEntry(parsed.key,parsed.display);current.node.entries.set(parsed.key,entry);stack.push({kind:'edit',node:entry});continue;}
      if(line==='next'){if(current.kind!=='edit')invalid.push({line:lineNumber,content:line,reason:'orphan-next'});else stack.pop();continue;}
      if(line==='end'){if(current.kind!=='config'||current.root)invalid.push({line:lineNumber,content:line,reason:'orphan-end'});else stack.pop();continue;}
      const slot=fortiSlot(line);if(slot){const fields=current.kind==='config'?current.node.direct:current.node.fields,previous=fields.get(slot.field);if(previous&&previous.command!==slot.command)invalid.push({line:lineNumber,content:line,reason:`duplicate-slot:${slot.field}`});else fields.set(slot.field,slot);continue;}
      invalid.push({line:lineNumber,content:line,reason:'unsupported-statement'});
    }
    if(stack.length!==1)invalid.push({line:blockLine,content:`config ${path}`,reason:'unclosed-nested-block'});return rootNode;
  }
  function parseFortiOs(value){
    const rawLines=text(value).split('\n'),blocks=[],invalid=[];let current=null,depth=0,start=0;
    for(const [index,rawValue] of rawLines.entries()){
      const raw=rawValue.replace(/[ \t]+$/,''),line=raw.trim();if(!line||line.startsWith('#')){if(current)current.push(line);continue;}
      if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(raw)){invalid.push({line:index+1,content:line,reason:'control-character'});continue;}
      if(!current){if(!/^config\s+/.test(line)){invalid.push({line:index+1,content:line,reason:'outside-config'});continue;}current=[line];depth=1;start=index+1;continue;}
      current.push(line);if(/^config\s+/.test(line))depth++;else if(line==='end')depth--;
      if(depth===0){blocks.push({lines:current,start});current=null;}
    }
    if(current)invalid.push({line:start,content:current[0],reason:'unclosed-config'});
    const sections=new Map(),opaque=[];
    for(const block of blocks){const match=block.lines[0].match(/^config ([A-Za-z0-9 _.-]{1,120})$/);if(!match||block.lines.at(-1)!=='end'){invalid.push({line:block.start,content:block.lines[0],reason:'malformed-config'});continue;}const path=match[1].trim();if(!fortiSupportedSection(path)){opaque.push(block.lines.filter(Boolean).join('\n'));continue;}const node=parseFortiStructured(block.lines,path,invalid,block.start),previous=sections.get(path);if(!previous)sections.set(path,node);else fortiMergeNode(previous,node,invalid,`config ${path}`);}
    return{sections,opaque,invalid};
  }
  function fortiUnquote(value){const raw=String(value||'').trim(),match=raw.match(/^"([^"\r\n]*)"$/);return match?match[1]:raw;}
  function fortiToken(value){return /^(?:"[^"\r\n]{1,160}"|[A-Za-z0-9_.:/-]{1,160})$/.test(String(value||'').trim());}
  function fortiTokenList(value){const raw=String(value||'').trim(),tokens=raw.match(/"[^"\r\n]+"|[^\s]+/g)||[];return tokens.length>0&&tokens.join(' ')===raw&&tokens.every(fortiToken);}
  function fortiIp(value){return ipv4Number(fortiUnquote(value))!=null;}
  function fortiIpMask(value){const parts=String(value||'').trim().split(/\s+/);return parts.length===2&&fortiIp(parts[0])&&validIpv4Mask(fortiUnquote(parts[1]));}
  function fortiDestination(value){const raw=String(value||'').trim(),cidr=raw.match(new RegExp(`^(${IPV4})\\/(\\d|[12]\\d|3[0-2])$`));return!!cidr||fortiIpMask(raw);}
  function fortiField(path,field,slot,nested){
    const unset=slot&&slot.verb==='unset',value=slot&&slot.value||'';if(unset)return{managed:true,valid:true};let valid=null;
    if(nested==='ip-range'&&['start-ip','end-ip'].includes(field))valid=fortiIp(value);
    else if(path==='system global'&&field==='hostname')valid=fortiToken(value);
    else if(path==='system interface'){
      if(['vdom','interface','description'].includes(field))valid=fortiToken(value);else if(field==='type')valid=/^(?:vlan|physical|aggregate|redundant|tunnel)$/.test(value);else if(field==='vlanid')valid=/^\d{1,4}$/.test(value)&&Number(value)>=1&&Number(value)<=4094;else if(field==='mode')valid=/^(?:static|dhcp|pppoe)$/.test(value);else if(field==='ip')valid=fortiIpMask(value);else if(field==='allowaccess')valid=/^(?:(?:ping|https|ssh|snmp|http|fgfm|fabric)(?:\s+|$))+$/.test(value);else if(field==='role')valid=/^(?:lan|wan|dmz|undefined)$/.test(value);else if(field==='dhcp-relay-service')valid=/^(?:enable|disable)$/.test(value);else if(field==='dhcp-relay-ip')valid=fortiUnquote(value).split(/\s+/).every(fortiIp);
    }else if(path==='firewall address'){
      if(field==='subnet')valid=fortiIpMask(value);else if(['comment','associated-interface'].includes(field))valid=fortiToken(value);else if(field==='type')valid=/^(?:ipmask|iprange|fqdn)$/.test(value);
    }else if(path==='system zone'&&field==='interface')valid=fortiTokenList(value);
    else if(path==='router static'){
      if(field==='dst')valid=fortiDestination(value);else if(field==='gateway')valid=fortiIp(value);else if(field==='distance')valid=/^\d{1,3}$/.test(value)&&Number(value)>=1&&Number(value)<=255;else if(['device','comment'].includes(field))valid=fortiToken(value);
    }else if(path==='firewall policy'){
      if(['name','schedule'].includes(field))valid=fortiToken(value);else if(['srcintf','dstintf','srcaddr','dstaddr','service'].includes(field))valid=fortiTokenList(value);else if(field==='action')valid=/^(?:accept|deny)$/.test(value);else if(field==='nat')valid=/^(?:enable|disable)$/.test(value);else if(field==='logtraffic')valid=/^(?:all|utm|disable)$/.test(value);
    }else if(path==='system dhcp server'){
      if(field==='interface')valid=fortiToken(value);else if(['default-gateway','dns-server1','dns-server2'].includes(field))valid=fortiIp(value);else if(field==='netmask')valid=validIpv4Mask(fortiUnquote(value));else if(field==='lease-time')valid=/^\d{1,9}$/.test(value)&&Number(value)>=60;
    }else if(path==='system dns'&&['primary','secondary'].includes(field))valid=fortiIp(value);
    else if(path==='system ntp'){
      if(field==='ntpsync')valid=/^(?:enable|disable)$/.test(value);else if(/^server\d+$/.test(field))valid=fortiToken(value);
    }else if(/^log syslogd\d* setting$/.test(path)){
      if(field==='status')valid=/^(?:enable|disable)$/.test(value);else if(field==='server')valid=fortiToken(value);
    }else if(path==='user radius'){
      if(['server','secret'].includes(field))valid=fortiToken(value);
    }else if(path==='system snmp user'){
      if(['security-level','auth-proto','auth-pwd','priv-proto','priv-pwd'].includes(field))valid=fortiToken(value);
    }
    return valid==null?{managed:false,valid:false}:{managed:true,valid:!!valid};
  }
  function fortiNodeSignature(node){const direct=Array.from(node.direct.values()).map(slot=>slot.command).sort(),entries=Array.from(node.entries.values()).map(entry=>fortiEntrySignature(entry)).sort();return JSON.stringify({direct,entries});}
  function fortiEntrySignature(entry){return{key:entry.key,fields:Array.from(entry.fields.values()).map(slot=>slot.command).sort(),configs:Array.from(entry.configs.values()).map(node=>[node.name,fortiNodeSignature(node)]).sort()};}
  function fortiEntryCommands(entry){const commands=Array.from(entry.fields.values()).map(slot=>slot.command);for(const node of entry.configs.values())for(const child of node.entries.values())commands.push(...fortiEntryCommands(child));return commands;}
  function fortiValidateNew(path,entry,nested){for(const slot of entry.fields.values()){const rule=fortiField(path,slot.field,slot,nested);if(!rule.managed||!rule.valid)return`${nested?`config ${nested} / `:''}edit ${entry.display}: ${slot.command} no pertenece a la allowlist segura.`;}for(const node of entry.configs.values()){if(path!=='system dhcp server'||node.name!=='ip-range')return`edit ${entry.display}: config ${node.name} requiere revisión manual.`;for(const child of node.entries.values()){const problem=fortiValidateNew(path,child,'ip-range');if(problem)return problem;}}return null;}
  function fortiDiffFields(path,target,source,location,nested){const apply=[],rollback=[],additions=[],deletions=[];for(const [field,targetSlot] of target){const sourceSlot=source&&source.get(field),rule=fortiField(path,field,targetSlot,nested);if(!rule.managed){if(!sourceSlot||sourceSlot.command!==targetSlot.command)return{error:`${location}: cambia ${targetSlot.command}, fuera de la allowlist segura.`};continue;}if(!rule.valid)return{error:`${location}: valor no válido en ${targetSlot.command}.`};if(sourceSlot&&sourceSlot.command===targetSlot.command)continue;if(sourceSlot){const sourceRule=fortiField(path,field,sourceSlot,nested);if(!sourceRule.managed||!sourceRule.valid)return{error:`${location}: el valor observado de ${field} no tiene rollback seguro.`};rollback.push(sourceSlot.command);deletions.push(`${location} :: ${sourceSlot.command}`);}else rollback.push(`unset ${field}`);apply.push(targetSlot.command);additions.push(`${location} :: ${targetSlot.command}`);}return{apply,rollback,additions,deletions};}
  function fortiIndent(lines,count){const prefix=' '.repeat(count);return lines.map(line=>prefix+line);}
  function fortiRenderFullEntry(entry,indent){const lines=[`edit ${entry.display}`];for(const slot of entry.fields.values())lines.push(` ${slot.command}`);for(const node of entry.configs.values()){lines.push(` config ${node.name}`);for(const child of node.entries.values()){lines.push(`  edit ${child.display}`);for(const slot of child.fields.values())lines.push(`   ${slot.command}`);lines.push('  next');}lines.push(' end');}lines.push('next');return fortiIndent(lines,indent||1);}
  function fortiDiffNested(path,targetNode,sourceNode,location){const apply=[],rollback=[],additions=[],deletions=[];if(path!=='system dhcp server'||targetNode.name!=='ip-range'){if(!sourceNode||fortiNodeSignature(targetNode)!==fortiNodeSignature(sourceNode))return{error:`${location}: config ${targetNode.name} requiere revisión manual.`};return{apply,rollback,additions,deletions};}for(const targetEntry of targetNode.entries.values()){const sourceEntry=sourceNode&&sourceNode.entries.get(targetEntry.key);if(!sourceEntry){const problem=fortiValidateNew(path,targetEntry,'ip-range');if(problem)return{error:`${location}: ${problem}`};apply.push(...fortiRenderFullEntry(targetEntry,1));rollback.push(` delete ${targetEntry.display}`);additions.push(`${location}/config ip-range/edit ${targetEntry.display}`,...fortiEntryCommands(targetEntry));continue;}const fields=fortiDiffFields(path,targetEntry.fields,sourceEntry.fields,`${location}/config ip-range/edit ${targetEntry.display}`,'ip-range');if(fields.error)return fields;if(fields.apply.length){apply.push(` edit ${targetEntry.display}`,...fortiIndent(fields.apply,2),' next');rollback.push(` edit ${targetEntry.display}`,...fortiIndent(fields.rollback,2),' next');}additions.push(...fields.additions);deletions.push(...fields.deletions);}return{apply,rollback,additions,deletions};}
  function fortiRenderFile(title,fragments){return[`# ${title}`,'# Candidato FortiOS sin acciones de backup ni ejecución automática.',...fragments,'# Validar con diagnose/debug y comprobaciones del runbook antes de cerrar el cambio.'].join('\n')+'\n';}
  function fortiOsAdapter(context){
    const before=parseFortiOs(context.observedConfig),after=parseFortiOs(context.desiredConfig),invalid=before.invalid.map(item=>Object.assign({side:'observed'},item)).concat(after.invalid.map(item=>Object.assign({side:'desired'},item)));if(invalid.length)return{ready:false,reason:'La captura o el objetivo contiene una jerarquía FortiOS ambigua o incompleta.',details:{invalid:invalid.slice(0,20)}};
    if(!multisetContains(before.opaque,after.opaque))return{ready:false,reason:'El objetivo modifica secciones FortiOS fuera del alcance seguro (interfaces, objetos, zonas, rutas, políticas, DHCP y gestión básica).'};
    const apply=[],rollback=[],additions=[],deletions=[];
    for(const [path,targetNode] of after.sections){const sourceNode=before.sections.get(path)||null;
      if(targetNode.direct.size){if(targetNode.entries.size)return{ready:false,reason:`config ${path}: mezcla propiedades directas y edit entries de forma ambigua.`};if(!sourceNode)return{ready:false,reason:`config ${path}: falta la sección observada necesaria para un rollback exacto.`};const fields=fortiDiffFields(path,targetNode.direct,sourceNode.direct,`config ${path}`,null);if(fields.error)return{ready:false,reason:fields.error};if(fields.apply.length){apply.push(`config ${path}`,...fortiIndent(fields.apply,1),'end');rollback.push(`config ${path}`,...fortiIndent(fields.rollback,1),'end');additions.push(...fields.additions);deletions.push(...fields.deletions);}continue;}
      if(targetNode.entries.size&&!sourceNode)return{ready:false,reason:`config ${path}: la captura no demuestra que la tabla observada exista y esté completa.`};
      for(const targetEntry of targetNode.entries.values()){const sourceEntry=sourceNode&&sourceNode.entries.get(targetEntry.key),location=`config ${path}/edit ${targetEntry.display}`;
        if(!sourceEntry){const problem=fortiValidateNew(path,targetEntry,null);if(problem)return{ready:false,reason:`${location}: ${problem}`};apply.push(`config ${path}`,...fortiRenderFullEntry(targetEntry,1),'end');rollback.push(`config ${path}`,` delete ${targetEntry.display}`,'end');additions.push(location,...fortiEntryCommands(targetEntry));continue;}
        const fields=fortiDiffFields(path,targetEntry.fields,sourceEntry.fields,location,null);if(fields.error)return{ready:false,reason:fields.error};const entryApply=[...fields.apply],entryRollback=[...fields.rollback];additions.push(...fields.additions);deletions.push(...fields.deletions);
        for(const targetNested of targetEntry.configs.values()){const nested=fortiDiffNested(path,targetNested,sourceEntry.configs.get(targetNested.name),location);if(nested.error)return{ready:false,reason:nested.error};if(nested.apply.length){entryApply.push(`config ${targetNested.name}`,...fortiIndent(nested.apply,1),'end');entryRollback.push(`config ${targetNested.name}`,...fortiIndent(nested.rollback,1),'end');}additions.push(...nested.additions);deletions.push(...nested.deletions);}
        if(entryApply.length){apply.push(`config ${path}`,` edit ${targetEntry.display}`,...fortiIndent(entryApply,2),' next','end');rollback.push(`config ${path}`,` edit ${targetEntry.display}`,...fortiIndent(entryRollback,2),' next','end');}
      }
    }
    const touched=additions.concat(deletions).filter(line=>PLACEHOLDER.test(line)||SENSITIVE.test(line));if(touched.length)return{ready:false,reason:'El delta FortiOS toca secretos, credenciales o placeholders y requiere revisión manual.',details:{sensitiveLines:touched.map((_line,index)=>`sensitive-${index+1}`)}};
    if(!apply.length)return{ready:true,noChange:true,additions:[],deletions:[],applyContent:'',rollbackContent:'',fileExtension:'conf'};
    return{ready:true,noChange:false,additions,deletions,applyContent:fortiRenderFile(`NetWizard FortiOS candidate — ${context.deviceName}`,apply),rollbackContent:fortiRenderFile(`NetWizard FortiOS rollback candidate — ${context.deviceName}`,rollback),fileExtension:'conf',instructions:['Capturar y custodiar un backup de configuración FortiGate antes del cambio.','Revisar el candidato línea por línea y confirmar VDOM, interfaces, IDs y orden de políticas.','Aplicar únicamente en ventana de cambio con acceso de recuperación disponible.','Ejecutar los postchecks de routing, sesiones, NAT, políticas, DHCP y gestión.'],rollbackInstructions:['Aplicar el candidato inverso solo si coincide con el estado esperado y la ventana sigue controlada.','Validar de nuevo políticas, rutas y sesiones después de revertir.','Si existe cualquier divergencia, restaurar el backup real; el candidato inverso no lo sustituye.']};
  }
  function createRegistry(){
    const adapters=[];
    function register(adapter){const item=obj(adapter),id=clean(item.id,100),vendors=arr(item.vendors).map(v=>clean(v,80)).filter(Boolean);if(!id||typeof item.generate!=='function'||!vendors.length)throw new Error('Adaptador incremental inválido.');if(adapters.some(existing=>existing.id===id))throw new Error(`Adaptador incremental duplicado: ${id}`);adapters.push({id,version:clean(item.version,40)||'1',vendors,priority:Number.isFinite(Number(item.priority))?Number(item.priority):100,generate:item.generate});adapters.sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));return api;}
    function resolve(vendor){return adapters.find(adapter=>adapter.vendors.includes(clean(vendor,80)))||null;}
    function inspect(){return adapters.map(({id,version,vendors,priority})=>({id,version,vendors:vendors.slice(),priority}));}
    const api={register,resolve,inspect};return api;
  }
  const registry=createRegistry();registry.register({id:'cisco-ios.managed-delta',version:'1',vendors:['cisco_ios'],priority:320,generate:ciscoIosAdapter});registry.register({id:'fortios.managed-delta',version:'1',vendors:['fortinet'],priority:310,generate:fortiOsAdapter});registry.register({id:'junos.set-delta',version:'1',vendors:['juniper_junos'],priority:300,generate:junosAdapter});

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

  const api={version:'netwizard-incremental-generators-v3.50',format:FORMAT,registry,createRegistry,buildPlan,publicPlan,buildSummaryMarkdown,parseJunosSet,junosAdapter,parseCiscoIos,ciscoIosAdapter,parseFortiOs,fortiOsAdapter};
  root.NetWizardIncrementalGenerators=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
