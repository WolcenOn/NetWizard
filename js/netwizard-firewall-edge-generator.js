/* =========================================================
   NetWizard Firewall Edge Generator v0.2
   Traduce el proyecto y el plan neutral a configuraciones de borde.
   FortiGate: CLI ejecutable prudente. pfSense: script PHP de aprovisionamiento revisable.
========================================================= */
(function initNetWizardFirewallEdgeGenerator(root){
  'use strict';

  function arr(v){ return Array.isArray(v) ? v : []; }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function token(v, fallback){ return (clean(v || fallback).replace(/[^A-Za-z0-9_.-]/g,'_').replace(/_+/g,'_').slice(0,63) || fallback); }
  function tryRequire(p){ try { return require(p); } catch { return null; } }
  function networkUtils(){ return root.NetWizardNetworkUtils || (typeof require === 'function' ? tryRequire('./netwizard-network-utils.js') : null); }
  function routingPlan(){ return root.NetWizardRoutingPlan || (typeof require === 'function' ? tryRequire('./netwizard-routing-plan.js') : null); }

  function parse(cidr){ const n=networkUtils(); return n&&n.parseCidr?n.parseCidr(cidr):null; }
  function ip4(n){ const u=networkUtils(); return u&&u.ip4s?u.ip4s(n>>>0):[n>>>24&255,n>>>16&255,n>>>8&255,n&255].join('.'); }
  function mask(cidr){ const p=parse(cidr); return p?ip4(p.mask):''; }
  function net(cidr){ const p=parse(cidr); return p?ip4(p.net):''; }
  function device(project,id){ return arr(project&&project.devices).find(d=>d.id===id)||null; }
  function ports(project,id){ return arr(project&&project.ports).filter(p=>p.deviceId===id); }
  function subnet(project,ref){ return arr(project&&project.subnets).find(s=>s.vlanRef===ref)||null; }
  function planFor(project,id,supplied){ const plan=supplied||(routingPlan()&&routingPlan().build?routingPlan().build(project||{}):null); return plan&&arr(plan.devices).find(p=>p.deviceId===id)||null; }

  function localVlans(project,dev){
    const vlans=arr(project&&project.vlans),subs=arr(project&&project.subnets);
    const explicit=new Set(subs.filter(sn=>clean(sn.gatewayDeviceRef)===dev.id).map(sn=>sn.vlanRef));
    if(explicit.size) return vlans.filter(v=>explicit.has(v.id));
    const tags=new Set(),refs=new Set();
    for(const p of ports(project,dev.id).filter(p=>clean(p.mode).toLowerCase()==='trunk')){
      for(const value of arr(p.allowedVlans)){
        const raw=clean(value); if(!raw) continue;
        refs.add(raw); const n=Number(raw); if(Number.isFinite(n)) tags.add(n);
      }
      if(p.nativeVlanRef) refs.add(clean(p.nativeVlanRef));
    }
    if(tags.size||refs.size) return vlans.filter(v=>refs.has(clean(v.id))||tags.has(Number(v.vlanId)));
    const sitePrefix=clean(dev.id).includes('_')?clean(dev.id).split('_')[0]+'_':'';
    const byPrefix=sitePrefix?vlans.filter(v=>clean(v.id).startsWith(sitePrefix)):[];
    return byPrefix.length?byPrefix:vlans;
  }
  function pfx(cidr){ const p=parse(cidr); return p?Number(p.pfx):null; }
  function phpString(value){ return JSON.stringify(String(value==null?'':value)).replace(/\\u2028|\\u2029/g,' '); }

  function interfaceRole(port){
    const text=`${clean(port&&port.role)} ${clean(port&&port.desc)} ${clean(port&&port.name)}`.toLowerCase();
    if(/wan|outside|internet|isp/.test(text)) return 'wan';
    if(/dmz/.test(text)) return 'dmz';
    return 'lan';
  }

  function fortiInterfaces(project,dev){
    const lines=['config system interface'];
    for(const p of ports(project,dev.id)){
      if(clean(p.mode).toLowerCase()!=='routed') continue;
      const ip=clean(p.l3Ip||p.routedIp||(p.l3Cidr||p.routedCidr||'').split('/')[0]);
      const cidr=clean(p.l3Cidr||p.routedCidr);
      if(!ip||!cidr||!mask(cidr)) continue;
      lines.push(` edit "${clean(p.name||p.id)}"`,`  set ip ${ip} ${mask(cidr)}`,'  set allowaccess ping https ssh','  set role '+(interfaceRole(p)==='wan'?'wan':'lan'),' next');
    }
    for(const v of localVlans(project,dev)){
      const sn=subnet(project,v.id); if(!sn||!sn.gateway||!sn.cidr) continue;
      const parent=clean((project.roas||{}).lanIf)||clean(ports(project,dev.id).find(p=>clean(p.mode)==='trunk')?.name);
      if(!parent) continue;
      lines.push(` edit "VLAN${v.vlanId}_${token(v.name,'VLAN')}"`,`  set interface "${parent}"`,`  set vlanid ${Number(v.vlanId)}` ,`  set ip ${sn.gateway} ${mask(sn.cidr)}`,'  set allowaccess ping','  set role lan',' next');
    }
    lines.push('end');
    return lines;
  }

  function fortiAddresses(project,dev){
    const lines=['config firewall address'];
    for(const v of localVlans(project,dev)){
      const sn=subnet(project,v.id); if(!sn||!sn.cidr||!mask(sn.cidr)) continue;
      lines.push(` edit "NET_${token(v.name,'VLAN'+v.vlanId)}"`,`  set subnet ${net(sn.cidr)} ${mask(sn.cidr)}`,' next');
    }
    lines.push('end'); return lines;
  }

  function fortiRouting(project,dev,plan){
    const lines=[];
    const staticRoutes=plan&&plan.strategy==='static'?arr(plan.staticRoutes):[];
    const defaultNextHop=clean((project.roas||{}).wanNh||dev.defaultGateway||dev.wanGateway);
    const isInternetEdge=clean(dev.internetEdge).toLowerCase()==='yes'||dev.internetEdge===true;

    if((plan&&plan.strategy==='static')&&(staticRoutes.length||(isInternetEdge&&defaultNextHop))){
      lines.push('config router static'); let seq=10;
      for(const r of staticRoutes){
        const destination=clean(r.destination||r.destinationCidr||r.cidr);
        const nextHop=clean(r.nextHop||r.gateway);
        if(!destination||!nextHop) continue;
        lines.push(` edit ${seq}`,`  set dst ${destination}`,`  set gateway ${nextHop}`,' next'); seq+=10;
      }
      if(isInternetEdge&&defaultNextHop){
        lines.push(` edit ${seq}`,'  set dst 0.0.0.0/0',`  set gateway ${defaultNextHop}`,' next');
      }
      lines.push('end');
    } else if(plan&&plan.strategy==='ospf'&&plan.ospf){
      lines.push('config router ospf');
      if(clean(plan.ospf.routerId)) lines.push(` set router-id ${plan.ospf.routerId}`);
      lines.push(' config area','  edit 0.0.0.0','  next',' end',' config network'); let i=1;
      for(const n of arr(plan.ospf.networks)){ lines.push(`  edit ${i}`,`   set prefix ${n.cidr}`,'   set area 0.0.0.0','  next'); i++; }
      lines.push(' end','end');
    }
    return lines;
  }

  function fortiPolicies(project,dev){
    const wan=ports(project,dev.id).find(p=>interfaceRole(p)==='wan');
    const lines=['config firewall policy']; let id=10;
    for(const v of localVlans(project,dev)){
      const sn=subnet(project,v.id); if(!sn||!sn.cidr) continue;
      const intf=`VLAN${v.vlanId}_${token(v.name,'VLAN')}`;
      if(wan){
        lines.push(` edit ${id}`,`  set name "${token(v.name,'VLAN')}_to_Internet"`,`  set srcintf "${intf}"`,`  set dstintf "${clean(wan.name||wan.id)}"`,`  set srcaddr "NET_${token(v.name,'VLAN'+v.vlanId)}"`,'  set dstaddr "all"','  set action accept','  set schedule "always"','  set service "ALL"','  set nat enable','  set logtraffic all',' next'); id+=10;
      }
    }
    for(const rule of arr(project&&project.fwRules).filter(r=>r.enabled!==false)){
      lines.push(` edit ${id}`,`  set name "${token(rule.name||rule.id,'policy')}"`,'  set srcintf "any"','  set dstintf "any"','  set srcaddr "all"','  set dstaddr "all"',`  set action ${clean(rule.action).toLowerCase()==='deny'?'deny':'accept'}`,'  set schedule "always"','  set service "ALL"','  set logtraffic all',' next'); id+=10;
    }
    lines.push('end'); return lines;
  }

  function renderFortiGate(project,deviceId,suppliedPlan,options){
    const dev=device(project,deviceId); if(!dev) return '';
    const plan=planFor(project,deviceId,suppliedPlan);
    const lines=['# NetWizard FortiGate edge configuration','# '+pick(options,'Revisa nombres físicos, versión FortiOS y orden de políticas: estos valores determinan interfaces, sintaxis y precedencia efectiva antes de aplicar.','Review physical interface names, FortiOS version, and policy order: they determine interfaces, syntax, and effective precedence before applying.'),`config system global`,` set hostname "${token(dev.name,'FortiGate')}"`,'end','',...fortiInterfaces(project,dev),'',...fortiAddresses(project,dev),'',...fortiRouting(project,dev,plan),'',...fortiPolicies(project,dev)];
    return lines.join('\n').replace(/\n{3,}/g,'\n\n')+'\n';
  }

  function renderPfsenseScript(project,deviceId,suppliedPlan,options){
    const dev=device(project,deviceId); if(!dev) return '';
    const plan=planFor(project,deviceId,suppliedPlan),local=localVlans(project,dev);
    const wan=ports(project,dev.id).find(p=>interfaceRole(p)==='wan');
    const wanCidr=clean(wan&&(wan.l3Cidr||wan.routedCidr));
    const wanIp=clean(wan&&(wan.l3Ip||wan.routedIp||(wanCidr||'').split('/')[0]));
    const lines=[
      '<?php',
      '/*',
      ' * NetWizard pfSense provisioning candidate',
      ' * Revisar en laboratorio y conservar backup de config.xml antes de ejecutar.',
      ' * Uso orientativo: pfSsh.php < este-archivo.php',
      ' * Usa APIs/config internas de pfSense; pueden variar entre versiones.',
      ' */',
      'require_once("config.inc");',
      'require_once("interfaces.inc");',
      'require_once("filter.inc");',
      '',
      '$nw_note = '+phpString('NetWizard '+clean(dev.name||dev.id)+' generated candidate')+';',
      '$config["system"]["hostname"] = '+phpString(token(dev.name||dev.id,'pfsense').toLowerCase())+';',
      '$parent = $config["interfaces"]["lan"]["if"] ?? "";',
      'if (!$parent) { fwrite(STDERR, "NetWizard: no se pudo resolver la interfaz física LAN\\n"); exit(2); }',
      ''
    ];
    if(wanIp&&wanCidr&&pfx(wanCidr)!=null){
      lines.push(
        '// WAN IPv4',
        '$config["interfaces"]["wan"]["ipaddr"] = '+phpString(wanIp)+';',
        '$config["interfaces"]["wan"]["subnet"] = '+phpString(String(pfx(wanCidr)))+';',
        ''
      );
    }
    lines.push(
      '$config["vlans"]["vlan"] = $config["vlans"]["vlan"] ?? [];',
      '$config["filter"]["rule"] = array_values(array_filter($config["filter"]["rule"] ?? [], function($r){ return strpos($r["descr"] ?? "", "NetWizard:") !== 0; }));',
      '',
      'function nw_alias($name,$address,$descr){',
      '  global $config;',
      '  $config["aliases"]["alias"] = $config["aliases"]["alias"] ?? [];',
      '  foreach ($config["aliases"]["alias"] as $i=>$a) if (($a["name"] ?? "") === $name) unset($config["aliases"]["alias"][$i]);',
      '  $config["aliases"]["alias"] = array_values($config["aliases"]["alias"]);',
      '  $config["aliases"]["alias"][] = ["name"=>$name,"type"=>"network","address"=>$address,"descr"=>$descr];',
      '}',
      'function nw_opt_for_if($ifname,$descr){',
      '  global $config;',
      '  foreach (($config["interfaces"] ?? []) as $key=>$entry) if (($entry["if"] ?? "") === $ifname) return $key;',
      '  for($n=1;$n<100;$n++){ $key="opt".$n; if(!isset($config["interfaces"][$key])){ $config["interfaces"][$key]=["if"=>$ifname,"descr"=>$descr,"enable"=>""]; return $key; } }',
      '  throw new Exception("No hay interfaces OPT libres");',
      '}',
      'function nw_rule($interface,$action,$proto,$src,$dst,$dstPort,$descr){',
      '  global $config;',
      '  $rule=["type"=>$action,"interface"=>$interface,"ipprotocol"=>"inet","descr"=>"NetWizard: ".$descr,"source"=>[],"destination"=>[]];',
      '  if($proto && $proto!=="any") $rule["protocol"]=$proto;',
      '  $rule["source"] = $src==="any" ? ["any"=>""] : ["address"=>$src];',
      '  $rule["destination"] = $dst==="any" ? ["any"=>""] : ["address"=>$dst];',
      '  if($dstPort && $dstPort!=="any") $rule["destination"]["port"]=$dstPort;',
      '  $config["filter"]["rule"][]=$rule;',
      '}',
      '',
      '$nw_ifaces=[];'
    );
    const localAliases={};
    for(const v of local){
      const sn=subnet(project,v.id); if(!sn||!sn.cidr||!sn.gateway||pfx(sn.cidr)==null) continue;
      const tag=Number(v.vlanId),descr=token(v.name,'VLAN'+tag),alias='NET_'+token(v.name,'VLAN'+tag);
      localAliases[v.id]=alias;
      lines.push(
        '',
        '// VLAN '+tag+' '+clean(v.name),
        '$vlanif = $parent.".'+tag+'";',
        '$found=false;',
        'foreach ($config["vlans"]["vlan"] as &$existing) { if ((string)($existing["tag"] ?? "") === '+phpString(String(tag))+' && ($existing["if"] ?? "") === $parent) { $existing["descr"]='+phpString(descr)+'; $existing["vlanif"]=$vlanif; $found=true; break; } } unset($existing);',
        'if(!$found) $config["vlans"]["vlan"][]=["if"=>$parent,"tag"=>'+phpString(String(tag))+',"descr"=>'+phpString(descr)+',"vlanif"=>$vlanif];',
        '$ifkey=nw_opt_for_if($vlanif,'+phpString(descr)+');',
        '$config["interfaces"][$ifkey]["enable"]="";',
        '$config["interfaces"][$ifkey]["descr"]='+phpString(descr)+';',
        '$config["interfaces"][$ifkey]["ipaddr"]='+phpString(sn.gateway)+';',
        '$config["interfaces"][$ifkey]["subnet"]='+phpString(String(pfx(sn.cidr)))+';',
        '$nw_ifaces['+phpString(v.id)+']=$ifkey;',
        'nw_alias('+phpString(alias)+','+phpString(net(sn.cidr)+'/'+pfx(sn.cidr))+','+phpString(clean(v.name))+');'
      );
    }
    lines.push(
      '',
      '// Outbound NAT automático para las redes internas.',
      '$config["nat"]["outbound"]["mode"]="automatic";',
      ''
    );
    for(const rule of arr(project&&project.fwRules).filter(r=>r.enabled!==false)){
      const dir=clean(rule.dir||rule.direction).toLowerCase(),action=clean(rule.action).toLowerCase()==='deny'?'block':'pass';
      const proto=clean(rule.proto||rule.protocol||'any').toLowerCase();
      const port=clean(rule.port||rule.dstPort||'any');
      const src=clean(rule.src||rule.source||'any'),dst=clean(rule.dst||rule.destination||'any');
      if(dir==='out'||dir==='both'||!dir){
        for(const v of local){
          const sn=subnet(project,v.id); if(!sn||!localAliases[v.id]) continue;
          lines.push('nw_rule($nw_ifaces['+phpString(v.id)+'] ?? "lan",'+phpString(action)+','+phpString(proto)+','+phpString(localAliases[v.id])+','+phpString(dst)+','+phpString(port)+','+phpString(clean(rule.name||rule.id||'policy'))+');');
        }
      }else if(dir==='in'){
        lines.push('nw_rule("wan",'+phpString(action)+','+phpString(proto)+','+phpString(src)+','+phpString(dst)+','+phpString(port)+','+phpString(clean(rule.name||rule.id||'policy'))+');');
      }
    }
    if(plan&&plan.strategy==='static'){
      lines.push('','// '+pick(options,'Rutas estáticas candidatas: cada entrada dirige una red concreta al next-hop calculado; revisa gateway e interfaz antes de activarla.','Candidate static routes: each entry sends a specific network to the calculated next hop; review gateway and interface before enabling it.'));
      for(const r of arr(plan.staticRoutes)) lines.push('// '+clean(r.destination||r.destinationCidr)+' via '+clean(r.nextHop));
    } else if(plan&&plan.strategy==='ospf'){
      lines.push('','// '+pick(options,'OSPF requiere FRR en pfSense; instala y valida el paquete antes de trasladar el plan de routing a FRR.','OSPF requires FRR on pfSense; install and validate the package before translating the routing plan into FRR.'));
    }
    lines.push(
      '',
      'write_config($nw_note);',
      'interfaces_configure();',
      'filter_configure();',
      'echo "'+pick(options,'NetWizard: configuración candidata escrita. Revisa GUI, reglas, NAT y conectividad antes de producción.','NetWizard: candidate configuration written. Review GUI, rules, NAT, and connectivity before production.')+'\\n";',
      '?>',
      ''
    );
    return lines.join('\\n');
  }

  function renderPfsensePlan(project,deviceId,suppliedPlan,options){ return renderPfsenseScript(project,deviceId,suppliedPlan,options); }

  function render(project,deviceId,vendor,suppliedPlan,options){
    const v=clean(vendor||device(project,deviceId)?.vendorOs).toLowerCase();
    if(v==='fortinet') return renderFortiGate(project,deviceId,suppliedPlan,options);
    if(v==='pfsense') return renderPfsensePlan(project,deviceId,suppliedPlan,options);
    return '';
  }

  const api={version:'netwizard-firewall-edge-generator-v3',render,renderFortiGate,renderPfsensePlan,renderPfsenseScript,localVlans,fortiInterfaces,fortiAddresses,fortiRouting,fortiPolicies};
  root.NetWizardFirewallEdgeGenerator=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
