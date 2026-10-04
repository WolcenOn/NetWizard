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

  function validateSubnetAssignment(input, subnets, options){
    const data=input||{};
    const vlanRef=data.vlanRef||'';
    const cidr=(data.cidr||'').trim();
    const gateway=(data.gateway||'').trim();
    const existingSubnetId=data.existingSubnetId||'';
    const locale=options&&options.locale;
    if(!vlanRef)return result(false,'missing_vlan','subnet.validation.selectVlan',{},'Selecciona una VLAN.',{},locale);
    const ci=parseCidr(cidr);
    if(!ci)return result(false,'invalid_cidr','subnet.validation.invalidCidr',{},'CIDR inválido. Usa formato tipo 10.10.10.0/24.',{},locale);
    const normalized=`${ip4s(ci.net)}/${ci.pfx}`;
    if(gateway){
      if(parseIp(gateway)===null)return result(false,'invalid_gateway','subnet.validation.invalidGateway',{},'Gateway inválido.',{},locale);
      if(!ipInSn(gateway,normalized))return result(false,'gateway_outside_subnet','subnet.validation.gatewayOutside',{},'El gateway no pertenece a la subnet indicada.',{},locale);
      if(ci.pfx<31 && (parseIp(gateway)===ci.net || parseIp(gateway)===ci.bc)){
        return result(false,'gateway_reserved','subnet.validation.gatewayReserved',{},'El gateway no puede ser la dirección de red ni broadcast.',{},locale);
      }
    }
    const overlap=findSubnetOverlap(normalized,subnets,{ignoreSubnetId:existingSubnetId,ignoreVlanRef:vlanRef});
    if(overlap){
      return result(false,'subnet_overlap','subnet.validation.overlap',{cidr:normalized,existing:overlap.subnet.cidr},'La subnet {cidr} se solapa con {existing}.',{overlap},locale);
    }
    if(normalized!==cidr)return result(true,'normalized','subnet.validation.normalized',{cidr:normalized},'CIDR normalizado a {cidr}.',{cidr:normalized,ci,gateway:gateway||null},locale);
    return {ok:true,code:'ok',cidr:normalized,ci,gateway:gateway||null,msg:'',messageKey:'',messageParams:{}};
  }

  const api={version:'netwizard-network-utils-v2',parseIp,ip4s,parseCidr,ipInSn,cidrOverlaps,findSubnetOverlap,validateSubnetAssignment};
  root.NetWizardNetworkUtils=api;
  if(typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
