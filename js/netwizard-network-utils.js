/* =========================================================
   NetWizard Network Utils v1.0
   Funciones puras y testeables para IP/CIDR y validaciones de subredes.
   Cargable tanto en navegador clásico como en Node.js.
========================================================= */
(function initNetWizardNetworkUtils(root){
  'use strict';

  function parseIp(ip){
    const p=(ip||'').trim().split('.');
    if(p.length!==4)return null;
    let n=0;
    for(const x of p){
      if(!/^\d+$/.test(x))return null;
      const v=+x;
      if(v<0||v>255)return null;
      n=(n<<8)|v;
    }
    return n>>>0;
  }

  function ip4s(n){
    n=n>>>0;
    return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
  }

  function parseCidr(cidr){
    const m=(cidr||'').trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
    if(!m)return null;
    const ip=parseIp(m[1]);
    const pfx=+m[2];
    if(ip===null||pfx>32)return null;
    const mask=pfx===0?0:(0xFFFFFFFF<<(32-pfx))>>>0;
    const net=(ip&mask)>>>0;
    const bc=(net|(~mask>>>0))>>>0;
    return{ip,pfx,mask,net,bc,fh:pfx>=31?null:(net+1)>>>0,lh:pfx>=31?null:(bc-1)>>>0,cidr:`${ip4s(net)}/${pfx}`};
  }

  function ipInSn(ipStr,cidr){
    const ip=parseIp(ipStr);
    const c=parseCidr(cidr);
    if(ip===null||!c)return false;
    return ip>=c.net&&ip<=c.bc;
  }

  function cidrOverlaps(a,b){
    const ca=parseCidr(a);
    const cb=parseCidr(b);
    if(!ca||!cb)return false;
    return ca.net<=cb.bc && cb.net<=ca.bc;
  }

  function findSubnetOverlap(candidateCidr, subnets, options){
    const opts=options||{};
    const ignoreSubnetId=opts.ignoreSubnetId||'';
    const ignoreVlanRef=opts.ignoreVlanRef||'';
    const cc=parseCidr(candidateCidr);
    if(!cc)return null;
    for(const sn of Array.isArray(subnets)?subnets:[]){
      if(!sn||!sn.cidr)continue;
      if(ignoreSubnetId && sn.id===ignoreSubnetId)continue;
      if(ignoreVlanRef && sn.vlanRef===ignoreVlanRef)continue;
      const sc=parseCidr(sn.cidr);
      if(!sc)continue;
      if(cc.net<=sc.bc && sc.net<=cc.bc){
        return {subnet:sn,candidate:cc,existing:sc};
      }
    }
    return null;
  }

  function validateSubnetAssignment(input, subnets){
    const data=input||{};
    const vlanRef=data.vlanRef||'';
    const cidr=(data.cidr||'').trim();
    const gateway=(data.gateway||'').trim();
    const existingSubnetId=data.existingSubnetId||'';
    if(!vlanRef)return {ok:false,code:'missing_vlan',msg:'Selecciona una VLAN.'};
    const ci=parseCidr(cidr);
    if(!ci)return {ok:false,code:'invalid_cidr',msg:'CIDR inválido. Usa formato tipo 10.10.10.0/24.'};
    const normalized=`${ip4s(ci.net)}/${ci.pfx}`;
    if(gateway){
      if(parseIp(gateway)===null)return {ok:false,code:'invalid_gateway',msg:'Gateway inválido.'};
      if(!ipInSn(gateway,normalized))return {ok:false,code:'gateway_outside_subnet',msg:'El gateway no pertenece a la subnet indicada.'};
      if(ci.pfx<31 && (parseIp(gateway)===ci.net || parseIp(gateway)===ci.bc)){
        return {ok:false,code:'gateway_reserved',msg:'El gateway no puede ser la dirección de red ni broadcast.'};
      }
    }
    const overlap=findSubnetOverlap(normalized,subnets,{ignoreSubnetId:existingSubnetId,ignoreVlanRef:vlanRef});
    if(overlap){
      return {ok:false,code:'subnet_overlap',msg:`La subnet ${normalized} se solapa con ${overlap.subnet.cidr}.`,overlap};
    }
    return {ok:true,cidr:normalized,ci,gateway:gateway||null,msg:normalized!==cidr?`CIDR normalizado a ${normalized}.`:''};
  }

  const api={version:'netwizard-network-utils-v1',parseIp,ip4s,parseCidr,ipInSn,cidrOverlaps,findSubnetOverlap,validateSubnetAssignment};
  root.NetWizardNetworkUtils=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
