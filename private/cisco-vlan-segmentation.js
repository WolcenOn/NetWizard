'use strict';

const Network=require('../js/netwizard-network-utils.js');

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();

function vlanById(project,id){return arr(project&&project.vlans).find(x=>x&&x.id===id)||null;}
function subnetByVlan(project,ref){return arr(project&&project.subnets).find(x=>x&&x.vlanRef===ref)||null;}
function ownerForSubnet(sn){return clean(sn&&(sn.gatewayDeviceRef||sn.gatewayDeviceId||sn.ownerDeviceRef||sn.routingDeviceRef));}
function wildcard(cidr){
  const parsed=Network.parseCidr(cidr);if(!parsed)return null;
  return{network:Network.ip4s(parsed.net),wildcard:Network.ip4s((~parsed.mask)>>>0)};
}
function lanInterface(project,deviceId){
  const d=arr(project&&project.devices).find(x=>x&&x.id===deviceId)||{};
  if(clean(d.lanIf))return clean(d.lanIf);
  const ports=arr(project&&project.ports).filter(x=>x&&x.deviceId===deviceId);
  const byRole=ports.find(x=>clean(x.mode).toLowerCase()==='trunk'&&/lan|inside/i.test(clean(x.role||x.desc||x.name)));
  if(byRole)return clean(byRole.name);
  const trunk=ports.find(x=>clean(x.mode).toLowerCase()==='trunk');
  return trunk?clean(trunk.name):'';
}
function sourcePolicies(project,deviceId){
  const p=project||{},matrix=obj(p.vlanMatrix),rows=[];
  for(const sn of arr(p.subnets)){
    if(ownerForSubnet(sn)!==deviceId)continue;
    const vlan=vlanById(p,sn.vlanRef);if(!vlan||clean(obj(vlan.intent).type).toLowerCase()==='transit')continue;
    const src=wildcard(sn.cidr);if(!src)continue;
    const blocked=[];
    for(const target of arr(p.subnets)){
      if(!target||target.vlanRef===sn.vlanRef||matrix[sn.vlanRef+'_'+target.vlanRef]!==false)continue;
      const tv=vlanById(p,target.vlanRef),dst=wildcard(target.cidr);
      if(!tv||!dst)continue;
      blocked.push({vlanRef:target.vlanRef,vlanId:Number(tv.vlanId)||0,cidr:target.cidr,network:dst.network,wildcard:dst.wildcard});
    }
    if(!blocked.length)continue;
    blocked.sort((a,b)=>a.vlanId-b.vlanId||a.cidr.localeCompare(b.cidr));
    rows.push({
      sourceVlanRef:sn.vlanRef,sourceVlanId:Number(vlan.vlanId)||0,sourceCidr:sn.cidr,
      sourceNetwork:src.network,sourceWildcard:src.wildcard,blocked
    });
  }
  return rows.sort((a,b)=>a.sourceVlanId-b.sourceVlanId);
}
function validateDevice(project,deviceId){
  const policies=sourcePolicies(project,deviceId),issues=[],parent=lanInterface(project,deviceId);
  if(policies.length&&!parent)issues.push({code:'NW-SEG-001',blocking:true,message:'Hay segmentación inter-VLAN declarada pero no se puede determinar la interfaz LAN RoaS.',deviceId});
  for(const policy of policies){
    if(!policy.sourceVlanId)issues.push({code:'NW-SEG-002',blocking:true,message:'La VLAN origen de una política de segmentación no tiene vlanId válido.',deviceId,vlanRef:policy.sourceVlanRef});
    if(!policy.blocked.length)issues.push({code:'NW-SEG-003',blocking:true,message:'Política de segmentación sin destinos bloqueados.',deviceId,vlanRef:policy.sourceVlanRef});
  }
  return{version:'netwizard-cisco-vlan-segmentation-v1',deviceId,parentInterface:parent,policies,issues,ok:!issues.some(x=>x.blocking)};
}
function render(project,deviceId){
  const report=validateDevice(project,deviceId);
  if(!report.ok||!report.policies.length)return'';
  const L=['!','! Segmentación inter-VLAN derivada de vlanMatrix'];
  for(const policy of report.policies){
    const name='NW_SEG_V'+policy.sourceVlanId;
    L.push('ip access-list extended '+name);
    for(const dst of policy.blocked){
      L.push(' deny ip '+policy.sourceNetwork+' '+policy.sourceWildcard+' '+dst.network+' '+dst.wildcard);
    }
    L.push(' permit ip '+policy.sourceNetwork+' '+policy.sourceWildcard+' any',' exit');
    L.push('interface '+report.parentInterface+'.'+policy.sourceVlanId,' ip access-group '+name+' in',' exit');
  }
  return L.join('\n');
}
function append(config,project,deviceId){
  const block=render(project,deviceId);if(!block)return String(config||'');
  const marker='Segmentación inter-VLAN derivada de vlanMatrix';
  if(String(config||'').includes(marker))return String(config||'');
  return String(config||'').replace(/\s*$/,'')+'\n'+block+'\n';
}
module.exports={sourcePolicies,validateDevice,render,append,lanInterface,wildcard};
