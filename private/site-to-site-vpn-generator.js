'use strict';

const Vpn=require('../js/netwizard-site-to-site-vpn.js');
const Network=require('../js/netwizard-network-utils.js');

function arr(v){return Array.isArray(v)?v:[];}
function clean(v){return String(v==null?'':v).trim();}
function token(v,fallback){
  const out=clean(v||fallback||'VPN').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,24);
  return out||'VPN';
}
function secret(alias){return '$'+'{SECRET:'+clean(alias)+'}';}
function parsed(cidr){return Network.parseCidr(cidr);}
function networkFor(cidr){const p=parsed(cidr);return p?Network.ip4s(p.net):'';}
function maskFor(cidr){const p=parsed(cidr);return p?Network.ip4s(p.mask):'';}
function wildcardFor(cidr){const p=parsed(cidr);return p?Network.ip4s((~p.mask)>>>0):'';}

function validTunnels(project,deviceId){
  const plan=Vpn.buildDevicePlan(project,deviceId);
  const blocked=new Set(arr(plan.issues).filter(x=>x.blocking).map(x=>x.tunnelId));
  return arr(plan.tunnels).filter(t=>t.enabled!==false&&!blocked.has(t.id));
}
function renderCisco(project,deviceId){
  const tunnels=validTunnels(project,deviceId);
  if(!tunnels.length)return'';
  const lines=['!','! VPN site-to-site generada desde plan neutral'];
  const boundInterfaces=new Set();
  tunnels.forEach((t,index)=>{
    const n=token(t.name||t.id,'VPN'+String(index+1)),seq=(index+1)*10;
    const proposal='NW_IKE2_PROP_'+n,policy='NW_IKE2_POL_'+n,keyring='NW_IKE2_KR_'+n,profile='NW_IKE2_PROF_'+n,transform='NW_IPSEC_TS_'+n,acl='NW_VPN_ACL_'+n;
    lines.push(
      '!','! '+clean(t.name||t.id)+' · '+t.localEndpoint+' ↔ '+t.remoteEndpoint,
      'crypto ikev2 proposal '+proposal,
      ' encryption aes-cbc-256',
      ' integrity sha256',
      ' group 14',
      ' exit',
      'crypto ikev2 policy '+policy,
      ' proposal '+proposal,
      ' exit',
      'crypto ikev2 keyring '+keyring,
      ' peer '+n+'_PEER',
      '  address '+t.remoteEndpoint,
      '  pre-shared-key '+secret(t.secretAlias),
      ' exit',
      'crypto ikev2 profile '+profile,
      ' match identity remote address '+t.remoteEndpoint+' 255.255.255.255',
      ' identity local address '+t.localEndpoint,
      ' authentication remote pre-share',
      ' authentication local pre-share',
      ' keyring local '+keyring,
      ' lifetime '+t.ikeLifetimeSeconds,
      ' exit',
      'crypto ipsec transform-set '+transform+' esp-aes 256 esp-sha256-hmac',
      ' mode tunnel',
      ' exit',
      'ip access-list extended '+acl
    );
    for(const local of arr(t.localPrefixes)){
      for(const remote of arr(t.remotePrefixes)){
        const ln=networkFor(local),lw=wildcardFor(local),rn=networkFor(remote),rw=wildcardFor(remote);
        if(ln&&lw&&rn&&rw)lines.push(' permit ip '+ln+' '+lw+' '+rn+' '+rw);
      }
    }
    lines.push(
      ' exit',
      'crypto map NW_S2S_MAP '+seq+' ipsec-isakmp',
      ' set peer '+t.remoteEndpoint,
      ' set transform-set '+transform,
      ' set ikev2-profile '+profile,
      ' set security-association lifetime seconds '+t.ipsecLifetimeSeconds,
      ' match address '+acl,
      ' exit'
    );
    if(t.localWanPortName)boundInterfaces.add(t.localWanPortName);
  });
  for(const name of boundInterfaces){
    lines.push('!','interface '+name,' crypto map NW_S2S_MAP',' exit');
  }
  return lines.join('\n');
}
function renderFortinet(project,deviceId){
  const tunnels=validTunnels(project,deviceId);
  if(!tunnels.length)return'';
  const lines=['# VPN site-to-site generada desde plan neutral','config vpn ipsec phase1-interface'];
  tunnels.forEach((t,index)=>{
    const n=('NW_'+token(t.name||t.id,'VPN'+String(index+1))).slice(0,30);
    lines.push(
      ' edit "'+n+'"',
      '  set interface "'+clean(t.localWanPortName)+'"',
      '  set type static',
      '  set ike-version 2',
      '  set local-gw '+t.localEndpoint,
      '  set remote-gw '+t.remoteEndpoint,
      '  set proposal aes256-sha256',
      '  set dhgrp 14',
      '  set keylife '+t.ikeLifetimeSeconds,
      '  set authmethod psk',
      '  set psksecret '+secret(t.secretAlias),
      ' next'
    );
  });
  lines.push('end','config vpn ipsec phase2-interface');
  tunnels.forEach((t,index)=>{
    const n=('NW_'+token(t.name||t.id,'VPN'+String(index+1))).slice(0,30);
    let pair=0;
    for(const local of arr(t.localPrefixes)){
      for(const remote of arr(t.remotePrefixes)){
        pair++;
        const ln=networkFor(local),lm=maskFor(local),rn=networkFor(remote),rm=maskFor(remote);
        if(!ln||!lm||!rn||!rm)continue;
        const p2=(n+'_P2_'+pair).slice(0,35);
        lines.push(
          ' edit "'+p2+'"',
          '  set phase1name "'+n+'"',
          '  set proposal aes256-sha256',
          '  set pfs enable',
          '  set dhgrp 14',
          '  set keylife-type seconds',
          '  set keylifeseconds '+t.ipsecLifetimeSeconds,
          '  set src-subnet '+ln+' '+lm,
          '  set dst-subnet '+rn+' '+rm,
          ' next'
        );
      }
    }
  });
  lines.push('end','# Añadir rutas/políticas hacia la interfaz IPsec según la política de seguridad del proyecto.');
  return lines.join('\n');
}
function render(project,deviceId,vendor){
  const v=clean(vendor).toLowerCase();
  if(v==='cisco_ios')return renderCisco(project,deviceId);
  if(v==='fortinet')return renderFortinet(project,deviceId);
  return'';
}
function marker(vendor){return clean(vendor).toLowerCase()==='fortinet'?'# VPN site-to-site generada desde plan neutral':'! VPN site-to-site generada desde plan neutral';}
function append(config,project,deviceId,vendor){
  const block=render(project,deviceId,vendor);
  if(!block)return String(config||'');
  const text=String(config||'');
  if(text.includes(marker(vendor)))return text;
  return text.replace(/\s*$/,'')+'\n'+block+'\n';
}

module.exports={render,renderCisco,renderFortinet,append,validTunnels,secret,networkFor,maskFor,wildcardFor};
