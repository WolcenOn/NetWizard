/* NetWizard Golden Sample: empresa con cuatro sedes */
(function(root){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
const siteDefs=[
 {id:'s1',name:'Sede Central',code:'CENTRAL',oct3:0,base:0,vbase:100,wan:0},
 {id:'s2',name:'Sede Norte',code:'NORTE',oct3:0,base:128,vbase:200,wan:4},
 {id:'s3',name:'Sede Levante',code:'LEVANTE',oct3:1,base:0,vbase:300,wan:8},
 {id:'s4',name:'Sede Sur',code:'SUR',oct3:1,base:128,vbase:400,wan:12}
];
function ip(s,offset){return `10.64.${s.oct3}.${s.base+offset}`;}
function cidr(s,offset,prefix){return `${ip(s,offset)}/${prefix}`;}
function emptyProject(){return{
 _schemaVersion:'3.50.0',step:'dash',projName:'Empresa 4 sedes - golden production VLSM',
 devices:[],ports:[],vlans:[],subnets:[],hosts:[],links:[],fwRules:[],dhcp:{},vlanMatrix:{},
 security:{bpdu:'yes',ps:'yes',ds:'yes',dsV:'999',dai:'yes',ipsg:'yes',qV:'999'},roas:{},
 vtp:{domain:'CORP-GLOBAL',password:'',version:'3',pruning:'yes',roles:{}},topo:{pos:{}},
 physicalLocations:[],hostPhysicalLocations:[],uiSort:{},racks:[],rackItems:[],patchPanels:[],
 telecomOutlets:[],cableRuns:[],patchConnections:[],hostOutletConnections:[],pdus:[],powerConnections:[],
 iot:{accessNodes:[],devices:[],map:{show:{network:true,port:false,access:true,iot:true,wifi:true,lora:true,zigbee:true,thread:true,mqtt:true},scale:1,panX:0,panY:0}},
 visual:{locs:[],assign:{devices:{},hosts:{}},pos:{},view:{px:60,py:50,zoom:1},sel:null}
};}
function addSite(p,s){
 const siteLoc=`${s.id}_site`,cpd=`${s.id}_cpd`,office=`${s.id}_office`,rack=`${s.id}_rack01`;
 p.physicalLocations.push(
  {id:siteLoc,name:s.name,type:'site'},
  {id:cpd,name:`${s.name} · CPD`,type:'room',parentId:siteLoc},
  {id:office,name:`${s.name} · Oficina`,type:'room',parentId:siteLoc}
 );
 const siteIndex=siteDefs.findIndex(x=>x.id===s.id),col=siteIndex%2,row=Math.floor(siteIndex/2);
 const cpdVisual=`${s.id}_vloc_cpd`,officeVisual=`${s.id}_vloc_office`;
 p.visual.locs.push(
  {id:cpdVisual,name:`${s.name} · CPD`,color:'#10233c',x:80+col*760,y:80+row*560,type:'room',physicalLocationId:cpd},
  {id:officeVisual,name:`${s.name} · Oficina`,color:'#14263b',x:430+col*760,y:80+row*560,type:'room',physicalLocationId:office}
 );
 p.racks.push({id:rack,name:`RACK-${s.code}-01`,locationId:cpd,rackUnits:24,widthMm:600,depthMm:1000,maxLoadKg:700,powerCapacityWatts:5000,coolingCapacityWatts:3500});
 const vids={users:s.vbase+10,wifi:s.vbase+20,voice:s.vbase+30,servers:s.vbase+40,mgmt:s.vbase+99};
 const refs=Object.fromEntries(Object.entries(vids).map(([k,v])=>[k,`${s.id}_v${v}`]));
 const nets={
  users:{off:0,pfx:27,gw:1,start:10,end:30,name:'Usuarios'},
  wifi:{off:32,pfx:27,gw:33,start:40,end:62,name:'WiFi Corporativa'},
  voice:{off:64,pfx:28,gw:65,start:68,end:78,name:'VoIP'},
  servers:{off:80,pfx:29,gw:81,name:'Servidores'},
  mgmt:{off:88,pfx:29,gw:89,name:'Gestión'}
 };
 for(const k of Object.keys(nets)){const n=nets[k];p.vlans.push({id:refs[k],vlanId:vids[k],name:`${s.code}-${n.name}`});p.subnets.push({id:`${s.id}_sn_${k}`,vlanRef:refs[k],cidr:cidr(s,n.off,n.pfx),gateway:ip(s,n.gw),gatewayDeviceRef:`${s.id}_fw`});}
 for(const k of ['users','wifi','voice']){const n=nets[k];p.dhcp[String(vids[k])]={enabled:true,start:ip(s,n.start),end:ip(s,n.end),dns:'1.1.1.1,8.8.8.8',domain:'corp.example',lease:k==='users'?7:3,exclusions:[],reservations:[]};}
 const fw=`${s.id}_fw`,core=`${s.id}_core`,access=`${s.id}_access`,voiceSrv=`${s.id}_srv_voice`,inetSrv=`${s.id}_srv_inet`;
 p.devices.push(
  {id:fw,name:`FW-${s.code}-01`,type:'firewall',kind:'firewall',vendorOs:'pfsense',model:'Netgate 6100',mgmtIp:ip(s,90),internetEdge:'yes',wanIf:'wan0',rackId:rack,rackUnit:20,rackUnits:1,powerDrawWatts:80,locationId:cpd,physicalLocation:`${s.name} · CPD`},
  {id:core,name:`SW-CORE-${s.code}-01`,type:'switch',kind:'switch',vendorOs:'cisco_ios',model:'Cisco Catalyst 9300',mgmtIp:ip(s,91),rackId:rack,rackUnit:18,rackUnits:1,powerDrawWatts:90,poeBudgetW:0,locationId:cpd,physicalLocation:`${s.name} · CPD`},
  {id:access,name:`SW-ACCESS-${s.code}-01`,type:'switch',kind:'switch',vendorOs:'cisco_ios',model:'Cisco Catalyst 9200L PoE+',mgmtIp:ip(s,92),rackId:rack,rackUnit:16,rackUnits:1,powerDrawWatts:120,poeBudgetW:370,locationId:cpd,physicalLocation:`${s.name} · CPD`},
  {id:voiceSrv,name:`SRV-VOICE-${s.code}-01`,type:'server',kind:'server',vendorOs:'linux',model:'1U Voice Server',rackId:rack,rackUnit:12,rackUnits:2,powerDrawWatts:180,locationId:cpd,physicalLocation:`${s.name} · CPD`},
  {id:inetSrv,name:`SRV-INET-${s.code}-01`,type:'server',kind:'server',vendorOs:'linux',model:'1U Internet Services',rackId:rack,rackUnit:9,rackUnits:2,powerDrawWatts:160,locationId:cpd,physicalLocation:`${s.name} · CPD`}
 );
 for(const id of [fw,core,access,voiceSrv,inetSrv])p.visual.assign.devices[id]=cpdVisual;
 const allowed=[vids.users,vids.wifi,vids.voice,vids.servers,vids.mgmt],native=refs.mgmt;
 const fwWan=`${s.id}_fw_wan`,fwLan=`${s.id}_fw_lan`,coreFw=`${s.id}_core_fw`,coreAcc=`${s.id}_core_acc`,accUp=`${s.id}_acc_up`;
 p.ports.push(
  {id:fwWan,deviceId:fw,name:'wan0',mode:'routed',role:'wan',media:'GE',l3Ip:`198.51.100.${s.wan+2}`,l3Cidr:`198.51.100.${s.wan}/30`,desc:'WAN ISP'},
  {id:fwLan,deviceId:fw,name:'lan0',mode:'trunk',media:'10GE',nativeVlanRef:native,allowedVlans:allowed,uplink:true,desc:'Trunk a core'},
  {id:coreFw,deviceId:core,name:'TenGigabitEthernet1/1/1',mode:'trunk',media:'10GE',nativeVlanRef:native,allowedVlans:allowed,uplink:true,desc:'Trunk a firewall'},
  {id:coreAcc,deviceId:core,name:'TenGigabitEthernet1/1/2',mode:'trunk',media:'10GE',nativeVlanRef:native,allowedVlans:allowed,uplink:true,desc:'Trunk a acceso'},
  {id:accUp,deviceId:access,name:'TenGigabitEthernet1/1/1',mode:'trunk',media:'10GE',nativeVlanRef:native,allowedVlans:allowed,uplink:true,desc:'Uplink a core'}
 );
 p.links.push(
  {id:`${s.id}_link_fw_core`,name:`${s.code} FW-CORE`,aPortId:fwLan,bPortId:coreFw,medium:'fiber',cableType:'DAC',lengthM:3,speed:'10G',capacityMbps:10000,physicalPath:`${rack} interior`},
  {id:`${s.id}_link_core_access`,name:`${s.code} CORE-ACCESS`,aPortId:coreAcc,bPortId:accUp,medium:'fiber',cableType:'DAC',lengthM:3,speed:'10G',capacityMbps:10000,physicalPath:`${rack} interior`}
 );
 const endpoints=[];for(let i=1;i<=4;i++)endpoints.push(['pc',i,'users',false,0]);for(let i=1;i<=2;i++)endpoints.push(['ap',i,'wifi',true,18]);for(let i=1;i<=2;i++)endpoints.push(['phone',i,'voice',true,7]);
 let portNo=1;const structured=[];
 for(const [type,n,vlan,poe,watts] of endpoints){
  const portId=`${s.id}_acc_${type}${n}`;const row={id:portId,deviceId:access,name:`GigabitEthernet1/0/${portNo}`,mode:'access',media:'GE',accessVlanRef:refs[vlan],portFast:true,bpduGuard:true,desc:`${type.toUpperCase()} ${n}`};
  if(poe){row.poeMode=type==='ap'?'at':'af';row.poeWattsMax=type==='ap'?30:15.4;}p.ports.push(row);
  const hostId=`${s.id}_${type}${n}`,prefix={pc:'PC',ap:'AP',phone:'PHONE'}[type];const host={id:hostId,name:`${prefix}-${s.code}-${String(n).padStart(2,'0')}`,type,vlanRef:refs[vlan],portRef:portId,ipMode:'dhcp',locationId:office,physicalLocation:`${s.name} · Oficina`};if(poe){host.poeRequired=true;host.poeWatts=watts;}p.hosts.push(host);p.visual.assign.hosts[hostId]=officeVisual;structured.push([portNo,portId,hostId,type,n]);portNo++;
 }
 for(const [role,deviceId,hostId,name,offset] of [['voice',voiceSrv,`${s.id}_voice_host`,`PBX-${s.code}-01`,82],['internet',inetSrv,`${s.id}_inet_host`,`INET-${s.code}-01`,83]]){
  const portId=`${s.id}_acc_srv_${role}`;p.ports.push({id:portId,deviceId:access,name:`GigabitEthernet1/0/${portNo}`,mode:'access',media:'GE',accessVlanRef:refs.servers,portFast:true,bpduGuard:true,desc:`Servidor ${role}`});
  p.hosts.push({id:hostId,name,type:'server',deviceRef:deviceId,vlanRef:refs.servers,portRef:portId,ipMode:'static',staticIp:ip(s,offset),locationId:cpd,physicalLocation:`${s.name} · CPD`});p.visual.assign.hosts[hostId]=cpdVisual;portNo++;
 }
 const panel=`${s.id}_patch01`;p.patchPanels.push({id:panel,rackId:rack,name:`PP-${s.code}-01`,portCount:24,category:'Cat6A',rackUnit:23});
 p.rackItems.push({id:`rackitem_${panel}`,rackId:rack,type:'patch-panel',patchPanelId:panel,label:`PP-${s.code}-01`,startUnit:23,heightUnits:1,face:'front'},{id:`${s.id}_cm01`,rackId:rack,type:'cable-manager',label:`Pasacables ${s.code}`,startUnit:22,heightUnits:1,face:'front'});
 for(const [patchPort,portId,hostId,type,n] of structured){
  const outlet=`${s.id}_to_${type}${n}`,kind={pc:'USR',ap:'AP',phone:'VOZ'}[type];
  p.telecomOutlets.push({id:outlet,locationId:office,name:`TO-${s.code}-${kind}-${String(n).padStart(2,'0')}`,portCount:1,category:'Cat6A'});
  p.cableRuns.push({id:`${s.id}_run_${type}${n}`,label:`${s.code} ${kind} ${String(n).padStart(2,'0')}`,patchPanelId:panel,patchPort,outletId:outlet,outletPort:1,cableType:'Cat6A',lengthM:30+patchPort*2,route:`${s.name} CPD → bandeja principal → oficina`});
  p.patchConnections.push({id:`${s.id}_patch_${type}${n}`,patchPanelId:panel,patchPort,switchPortId:portId,patchCordLengthM:1});
  p.hostOutletConnections.push({id:`${s.id}_hostcord_${type}${n}`,hostId,outletId:outlet,outletPort:1,patchCordLengthM:2});
 }
 const pduA=`${s.id}_pdu_a`,pduB=`${s.id}_pdu_b`;p.pdus.push({id:pduA,rackId:rack,name:`PDU-${s.code}-A`,feed:'A',mounting:'vertical-rear',voltage:230,maxCurrentAmps:16,maxPowerWatts:3680,outletCount:12},{id:pduB,rackId:rack,name:`PDU-${s.code}-B`,feed:'B',mounting:'vertical-rear',voltage:230,maxCurrentAmps:16,maxPowerWatts:3680,outletCount:12});
 p.powerConnections.push(
  {id:`${s.id}_pwr_fw`,deviceId:fw,powerSupplyIndex:0,pduId:pduA,outlet:1,feed:'A'},{id:`${s.id}_pwr_core`,deviceId:core,powerSupplyIndex:0,pduId:pduA,outlet:2,feed:'A'},{id:`${s.id}_pwr_acc`,deviceId:access,powerSupplyIndex:0,pduId:pduB,outlet:1,feed:'B'},
  {id:`${s.id}_pwr_voice_a`,deviceId:voiceSrv,powerSupplyIndex:0,pduId:pduA,outlet:3,feed:'A'},{id:`${s.id}_pwr_voice_b`,deviceId:voiceSrv,powerSupplyIndex:1,pduId:pduB,outlet:2,feed:'B'},
  {id:`${s.id}_pwr_inet_a`,deviceId:inetSrv,powerSupplyIndex:0,pduId:pduA,outlet:4,feed:'A'},{id:`${s.id}_pwr_inet_b`,deviceId:inetSrv,powerSupplyIndex:1,pduId:pduB,outlet:3,feed:'B'}
 );
 p.vtp.roles[core]='server';p.vtp.roles[access]='client';
}
function buildProject(){const p=emptyProject();p.fwRules=[
 {id:'fw_dns',name:'Permitir DNS corporativo',src:'10.64.0.0/16',dst:'any',proto:'udp',port:'53',action:'allow',dir:'out',prio:10,reviewed:true,source:'manual'},
 {id:'fw_https',name:'Permitir HTTPS corporativo',src:'10.64.0.0/16',dst:'any',proto:'tcp',port:'443',action:'allow',dir:'out',prio:20,reviewed:true,source:'manual'},
 {id:'fw_sip',name:'Permitir SIP saliente',src:'10.64.0.0/16',dst:'any',proto:'udp',port:'5060',action:'allow',dir:'out',prio:30,reviewed:true,source:'manual'},
 {id:'fw_deny_in',name:'Denegar resto entrante',src:'any',dst:'10.64.0.0/16',proto:'any',port:'any',action:'deny',dir:'in',prio:9999,reviewed:true,source:'manual'}
 ];siteDefs.forEach(s=>addSite(p,s));return p;}
function buildPayload(){return{format:'netwizard-project',schemaVersion:'3.50.0',exportedAt:'2026-09-22T20:30:00.000Z',project:buildProject()};}
function json(pretty){return JSON.stringify(buildPayload(),null,pretty===false?0:2);}
function download(){if(!root.document)return null;const blob=new Blob([json(true)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=root.document.createElement('a');a.href=url;a.download='netwizard-empresa-4-sedes-production.json';root.document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);return true;}
function loadIntoProject(){if(!root.NetWizardState)return false;root.NetWizardState.replaceProject(buildProject(),{source:'sample-four-sites'});return true;}
function inject(){if(!root.document||root.document.getElementById('btnFourSitesSample'))return;const anchor=root.document.getElementById('impJsonFile')||root.document.getElementById('impJson');if(!anchor)return;const load=root.document.createElement('button');load.id='btnFourSitesSample';load.type='button';load.className='btn bs';load.textContent='🏢 Cargar ejemplo 4 sedes';load.onclick=()=>{if(root.confirm&&!root.confirm('Sustituir el proyecto actual por el ejemplo completo de cuatro sedes?'))return;loadIntoProject();};const dl=root.document.createElement('button');dl.id='btnFourSitesSampleDownload';dl.type='button';dl.className='btn bs';dl.textContent='⬇ JSON 4 sedes';dl.onclick=download;anchor.insertAdjacentElement('afterend',dl);anchor.insertAdjacentElement('afterend',load);}
const api={version:'netwizard-four-sites-sample-v2',siteDefs:clone(siteDefs),buildProject,buildPayload,json,download,loadIntoProject,inject};
root.NetWizardFourSitesSample=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,0));else setTimeout(inject,0);}
})(typeof window!=='undefined'?window:globalThis);
