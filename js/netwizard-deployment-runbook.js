/* =========================================================
   NetWizard Deployment Runbook v3.50
   Ordena el despliegue por dependencias y genera un runbook reversible.
========================================================= */
(function initNetWizardDeploymentRunbook(root){
  'use strict';

  const VERSION='3.50.0';
  const PHASES={
    edge:{id:'edge',order:100,label:'Borde WAN y seguridad'},
    core:{id:'core',order:200,label:'Routing, core y distribución'},
    access:{id:'access',order:300,label:'Switching de acceso'},
    services:{id:'services',order:400,label:'Servicios y controladores'},
    wireless:{id:'wireless',order:500,label:'Acceso inalámbrico'},
    other:{id:'other',order:600,label:'Otros dispositivos gestionados'}
  };
  const VENDOR_GUIDANCE={
    cisco_ios:{backup:['Capturar `show running-config` y `show startup-config`.','Guardar una copia externa y confirmar acceso por consola/OOB.'],validate:['`show ip interface brief`','`show interfaces status`','`show spanning-tree summary`','`show ip route`'],rollback:['Usar el mecanismo aprobado `configure replace` o restaurar la copia conocida.','No guardar en startup hasta validar el cambio.']},
    cisco_asa:{backup:['Capturar `show running-config` y una copia externa del startup-config.'],validate:['`show interface ip brief`','`show route`','`show conn count`','`show failover` si aplica'],rollback:['Restaurar el backup mediante el procedimiento soportado para la versión ASA.']},
    fortinet:{backup:['Exportar un backup completo desde GUI/CLI a una ubicación externa segura.','Registrar estado HA y checksum/revisión del backup.'],validate:['`get system status`','`get system interface physical`','`get router info routing-table all`','`get system ha status` si aplica'],rollback:['Restaurar el backup validado con el procedimiento FortiOS aprobado.','Confirmar si la restauración requiere reinicio antes de comenzar.']},
    juniper_junos:{backup:['Guardar `show configuration | display set` y confirmar un commit conocido.'],validate:['`show interfaces terse`','`show route summary`','`show system alarms`'],rollback:['Ejecutar `rollback 1`, revisar el diff y hacer commit únicamente si corresponde al cambio actual.']},
    huawei_vrp:{backup:['Capturar `display current-configuration` y guardar la configuración actual externamente.'],validate:['`display ip interface brief`','`display interface brief`','`display ip routing-table`'],rollback:['Restaurar el fichero de configuración validado mediante el procedimiento VRP del modelo.']},
    mikrotik_routeros:{backup:['Crear export textual y backup binario compatibles con la versión RouterOS.'],validate:['`/system resource print`','`/interface print`','`/ip route print`'],rollback:['Restaurar el export/backup aprobado; verificar compatibilidad de versión y hardware.']},
    aruba_aoss:{backup:['Capturar running-config y startup-config; guardar copia externa.'],validate:['`show interfaces brief`','`show vlans`','`show spanning-tree`'],rollback:['Restaurar la configuración previa con el método soportado por AOS-Switch.']},
    pfsense:{backup:['Descargar `config.xml` desde Diagnostics > Backup & Restore.'],validate:['Comprobar interfaces, gateways, reglas y estados desde GUI/console.'],rollback:['Restaurar el `config.xml` previo y validar el reinicio de servicios afectados.']},
    ubiquiti_unifi:{backup:['Crear backup del controlador y exportar sus ajustes antes del cambio.'],validate:['Confirmar adopción, uplink, VLAN de gestión, SSIDs y clientes.'],rollback:['Restaurar el backup del controlador o revertir el perfil aplicado.']},
    tplink_omada:{backup:['Crear backup del controlador Omada y registrar versiones de firmware.'],validate:['Confirmar adopción, uplinks, perfiles VLAN, SSIDs y clientes.'],rollback:['Restaurar el backup del controlador o el perfil anterior.']},
    galgus_cloud:{backup:['Exportar la política/configuración desde la plataforma y registrar la versión activa.'],validate:['Confirmar APs online, SSIDs, VLANs, túneles y clientes.'],rollback:['Reasignar la política anterior validada desde el controlador cloud.']},
    windows:{backup:['Crear backup del sistema/configuración y exportar los roles afectados.'],validate:['Comprobar interfaces, rutas, servicios y Event Viewer.'],rollback:['Restaurar la configuración/backup aprobado y reiniciar solo los servicios necesarios.']},
    linux:{backup:['Guardar configuración de red y servicios, y crear snapshot si la plataforma lo permite.'],validate:['`ip -br address`','`ip route`','`systemctl --failed`'],rollback:['Restaurar los ficheros respaldados y recargar de forma controlada los servicios afectados.']}
  };

  function arr(value){return Array.isArray(value)?value:[];}
  function obj(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function clean(value,max){return String(value==null?'':value).replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,max||240);}
  function tr(key,params,locale,fallback){const i18n=root.NetWizardI18n;if(i18n&&typeof i18n.t==='function')return i18n.t(key,params||{},locale);return String(fallback||key).replace(/\{([A-Za-z0-9_.-]+)\}/g,(_m,k)=>Object.prototype.hasOwnProperty.call(params||{},k)?String(params[k]):'');}
  function phaseLabel(id,locale,fallback){return tr('deploy.runbook.phase.'+id,{},locale,fallback||id);}
  function localizeGuidance(vendor,section,items,locale){return arr(items).map((line,index)=>tr('deploy.runbook.vendor.'+vendor+'.'+section+'.'+index,{},locale,line));}
  function number(value,fallback){if(value===null||value===undefined||value==='')return fallback;const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
  function compareText(a,b){const left=clean(a,160),right=clean(b,160);return left<right?-1:(left>right?1:0);}
  function deviceKind(device){return clean(device&&device.kind||device&&device.type,40).toLowerCase();}
  function phaseFor(device,override){
    const explicit=clean(override&&override.phase||device&&device.deploymentPhase,40).toLowerCase(); if(PHASES[explicit])return PHASES[explicit];
    const kind=deviceKind(device),role=clean(`${device&&device.name||''} ${device&&device.role||''} ${device&&device.model||''} ${device&&device.notes||''}`,400).toLowerCase();
    if(device&&[true,'yes','true','1'].includes(device.internetEdge)||kind==='firewall')return PHASES.edge;
    if(kind==='router'||(kind==='switch'&&(device&&device.l3===true||device&&device.layer3===true||device&&device.routing===true||[true,'yes','true','1'].includes(device&&device.l3Capable)||/core|distribution|distribuci|layer ?3|\bl3\b/.test(role))))return PHASES.core;
    if(kind==='switch')return PHASES.access;
    if(kind==='wlan_controller'||kind==='server'||kind==='appliance')return PHASES.services;
    if(kind==='access_point')return PHASES.wireless;
    return PHASES.other;
  }
  function adjacency(project){
    const portDevice=new Map(arr(project.ports).map(port=>[port.id,port.deviceId])); const graph=new Map(arr(project.devices).map(device=>[device.id,new Set()]));
    for(const link of arr(project.links)){const a=portDevice.get(link.aPortId||link.a),b=portDevice.get(link.bPortId||link.b);if(!a||!b||a===b||!graph.has(a)||!graph.has(b))continue;graph.get(a).add(b);graph.get(b).add(a);}
    return graph;
  }
  function graphDistances(project,graph){
    const devices=arr(project.devices);let roots=devices.filter(device=>device&&[true,'yes','true','1'].includes(device.internetEdge)).map(device=>device.id);
    if(!roots.length)roots=devices.filter(device=>['firewall','router'].includes(deviceKind(device))).map(device=>device.id);
    if(!roots.length&&devices.length)roots=[devices.slice().sort((a,b)=>compareText(a.id,b.id))[0].id];
    const distances=new Map();const queue=[];for(const id of roots){distances.set(id,0);queue.push(id);}while(queue.length){const id=queue.shift(),next=(distances.get(id)||0)+1;for(const peer of graph.get(id)||[]){if(distances.has(peer))continue;distances.set(peer,next);queue.push(peer);}}
    return distances;
  }
  function guidanceFor(device,locale){
    const vendor=clean(device&&device.vendorOs,80).toLowerCase();const guidance=VENDOR_GUIDANCE[vendor]||{backup:['Exportar la configuración activa con el método soportado por el fabricante.'],validate:['Comprobar gestión, interfaces, rutas, VLANs y servicios afectados.'],rollback:['Restaurar el backup previo mediante el procedimiento aprobado por el fabricante.']};
    const key=VENDOR_GUIDANCE[vendor]?vendor:'generic';
    return {backup:localizeGuidance(key,'backup',guidance.backup,locale),validate:localizeGuidance(key,'validate',guidance.validate,locale),rollback:localizeGuidance(key,'rollback',guidance.rollback,locale)};
  }
  function riskFor(device,phase,project){
    const critical=clean(device&&device.criticality,40).toLowerCase();const inHa=arr(project.haGroups).some(group=>arr(group.memberDeviceIds).includes(device.id));
    if(device&&device.critical===true||critical==='critical'||phase.id==='edge')return'critical';
    if(critical==='high'||phase.id==='core'||inHa)return'high';
    if(phase.id==='access'||phase.id==='services')return'medium';return'low';
  }
  function configPathFor(device,index,options){
    const map=obj(options&&options.configPaths);if(map[device.id])return clean(map[device.id],240);
    const helper=options&&options.configPath;return typeof helper==='function'?helper(device,index):`configs/${String(index+1).padStart(2,'0')}-${clean(device.id,100)}.txt`;
  }
  function deviceDependencies(project,device,phase,graph,distances,overrides){
    const override=obj(overrides[device.id]);const dependencies=new Set([...arr(device.dependsOnDeviceRefs),...arr(override.dependsOnDeviceRefs)].map(clean).filter(Boolean));
    const distance=distances.get(device.id);if(distance>0){const candidates=Array.from(graph.get(device.id)||[]).filter(id=>distances.has(id)&&distances.get(id)<distance).sort((a,b)=>distances.get(b)-distances.get(a)||compareText(a,b));if(candidates[0])dependencies.add(candidates[0]);}
    if(['server','appliance','wlan_controller','access_point'].includes(deviceKind(device))){for(const peer of graph.get(device.id)||[]){const peerDevice=arr(project.devices).find(item=>item.id===peer);if(peerDevice&&phaseFor(peerDevice,obj(overrides[peer])).order<phase.order)dependencies.add(peer);}}
    const ap=arr(project.wifiAccessPoints).find(item=>item.deviceId===device.id);if(ap&&ap.controllerRef){const controller=arr(project.wifiControllers).find(item=>item.id===ap.controllerRef);if(controller&&controller.deviceId)dependencies.add(controller.deviceId);}
    dependencies.delete(device.id);return Array.from(dependencies).filter(id=>arr(project.devices).some(item=>item.id===id)).sort(compareText);
  }
  function serialGroups(project,deviceId){
    const groups=[];for(const group of arr(project.haGroups))if(arr(group.memberDeviceIds).includes(deviceId))groups.push({type:'ha',id:group.id,label:group.name||group.id,members:arr(group.memberDeviceIds)});for(const domain of arr(project.mlagDomains))if(arr(domain.peerDeviceIds).includes(deviceId))groups.push({type:'mlag',id:domain.id,label:domain.name||domain.id,members:arr(domain.peerDeviceIds)});return groups;
  }
  function topoSort(nodes){
    const byId=new Map(nodes.map(node=>[node.deviceId,node]));const indegree=new Map(nodes.map(node=>[node.deviceId,0]));const dependents=new Map(nodes.map(node=>[node.deviceId,[]]));
    for(const node of nodes)for(const dependency of node.dependsOn){if(!byId.has(dependency))continue;indegree.set(node.deviceId,indegree.get(node.deviceId)+1);dependents.get(dependency).push(node.deviceId);}
    const compare=(a,b)=>a.phaseOrder-b.phaseOrder||a.requestedOrder-b.requestedOrder||a.distance-b.distance||compareText(a.deviceName,b.deviceName)||compareText(a.deviceId,b.deviceId);
    const ready=nodes.filter(node=>indegree.get(node.deviceId)===0).sort(compare);const ordered=[];
    while(ready.length){const node=ready.shift();ordered.push(node);for(const id of dependents.get(node.deviceId)||[]){indegree.set(id,indegree.get(id)-1);if(indegree.get(id)===0){ready.push(byId.get(id));ready.sort(compare);}}}
    const unresolved=nodes.filter(node=>!ordered.includes(node)).sort(compare);return{ordered:ordered.concat(unresolved),cycles:unresolved.map(node=>node.deviceId)};
  }
  function buildDeploymentPlan(project,options){
    const p=obj(project),opts=obj(options),locale=opts.locale,deployment=obj(p.deployment),overrides=obj(deployment.devices),graph=adjacency(p),distances=graphDistances(p,graph),generatedAt=clean(opts.generatedAt,40)||new Date().toISOString();
    const changeSet=obj(opts.changeSet),changeByDevice=new Map(arr(changeSet.devices).map(change=>[change.deviceId,change]));
    const incrementalPlan=obj(opts.incrementalPlan),incrementalByDevice=new Map(arr(incrementalPlan.devices).map(item=>[item.deviceId,item]));
    const deviceIds=new Set(arr(p.devices).map(device=>device.id));const issues=[];
    for(const device of arr(p.devices)){const override=obj(overrides[device.id]);for(const dependency of [...arr(device.dependsOnDeviceRefs),...arr(override.dependsOnDeviceRefs)].map(clean).filter(Boolean)){if(dependency===device.id)issues.push({code:'NW-RUNBOOK-003',severity:'error',blocking:true,category:'deployment',deviceId:device.id,message:tr('deploy.runbook.issue.selfDependency',{device:device.name||device.id},locale,'{device}: no puede depender de sí mismo para el despliegue.')});else if(!deviceIds.has(dependency))issues.push({code:'NW-RUNBOOK-002',severity:'error',blocking:true,category:'deployment',deviceId:device.id,message:tr('deploy.runbook.issue.missingDependency',{device:device.name||device.id,dependency},locale,'{device}: dependencia de despliegue inexistente ({dependency}).')});}}
    const draft=arr(p.devices).map((device,index)=>{const override=obj(overrides[device.id]),phase=phaseFor(device,override),guide=guidanceFor(device,locale),change=obj(changeByDevice.get(device.id)),incremental=obj(incrementalByDevice.get(device.id));return{deviceId:device.id,deviceName:clean(device.name,100)||device.id,kind:deviceKind(device),vendor:clean(device.vendorOs,80)||'generic_network',phase:phase.id,phaseLabel:phaseLabel(phase.id,locale,phase.label),phaseOrder:phase.order,requestedOrder:number(override.order,number(device.deploymentOrder,9999)),distance:number(distances.get(device.id),9999),dependsOn:deviceDependencies(p,device,phase,graph,distances,overrides),risk:riskFor(device,phase,p),serialGroups:serialGroups(p,device.id),estimatedMinutes:Math.max(5,number(override.estimatedMinutes,number(device.deploymentMinutes,15))),configPath:configPathFor(device,index,opts),change:{status:change.status||'baseline-required',applyMode:change.applyMode||'full-target',patchPath:change.patchPath||null,rollbackPatchPath:change.rollbackPatchPath||null,capturedAt:change.capturedAt||null,stats:obj(change.stats)},incremental:{status:incremental.status||'full-target',adapterId:incremental.adapterId||null,applyPath:incremental.applyPath||null,rollbackPath:incremental.rollbackPath||null,instructions:arr(incremental.instructions),rollbackInstructions:arr(incremental.rollbackInstructions),commandCounts:obj(incremental.commandCounts)},backup:guide.backup,validation:guide.validate,rollback:guide.rollback};});
    const sorted=topoSort(draft);if(sorted.cycles.length)issues.push({code:'NW-RUNBOOK-001',severity:'error',blocking:true,category:'deployment',message:tr('deploy.runbook.issue.cycle',{devices:sorted.cycles.join(', ')},locale,'Dependencias de despliegue no resolubles (ciclo o cadena bloqueada): {devices}.'),deviceIds:sorted.cycles});
    const steps=sorted.ordered.map((node,index)=>Object.assign({},node,{order:index+1,id:`deploy-${String(index+1).padStart(2,'0')}`}));
    const phases=Object.values(PHASES).sort((a,b)=>a.order-b.order).map(phase=>({id:phase.id,label:phaseLabel(phase.id,locale,phase.label),order:phase.order,steps:steps.filter(step=>step.phase===phase.id).map(step=>step.id)})).filter(phase=>phase.steps.length);
    const serialWarnings=steps.filter(step=>step.serialGroups.length).map(step=>tr('deploy.runbook.warning.serialGroup',{device:step.deviceName,groups:step.serialGroups.map(group=>`${group.type.toUpperCase()} ${group.label}`).join(', ')},locale,'{device}: miembro de {groups}; validar el peer antes de continuar.'));
    if(!clean(deployment.changeTicket))serialWarnings.push(tr('deploy.runbook.warning.changeTicket',{},locale,'Falta asociar un ticket o identificador de cambio.'));
    if(!clean(deployment.maintenanceWindow))serialWarnings.push(tr('deploy.runbook.warning.maintenanceWindow',{},locale,'Falta documentar la ventana de mantenimiento.'));
    if(!clean(deployment.approvalOwner))serialWarnings.push(tr('deploy.runbook.warning.approvalOwner',{},locale,'Falta identificar al responsable de aprobación.'));
    const resilienceChecks=arr(p.failureScenarios).map(scenario=>({id:scenario.id,name:clean(scenario.name,120)||scenario.id,requireWan:scenario.requireWan!==false,mustSurvive:arr(scenario.mustSurvive).map(item=>`${clean(item.type,40)}:${clean(item.ref,120)||tr('deploy.runbook.connectivity',{},locale,'conectividad')}`)}));
    const criticalServices=arr(p.internalServices).filter(service=>service.critical===true||clean(service.criticality,40).toLowerCase()==='critical').map(service=>({id:service.id,name:clean(service.name,120)||service.id}));
    const validationTargets=arr(deployment.validationTargets).map(target=>clean(target,200)).filter(Boolean);
    const postchecks=[
      tr('deploy.runbook.postcheck.interfaces',{},locale,'Interfaces, trunks, VLANs, rutas y vecinos presentan el estado esperado.'),
      tr('deploy.runbook.postcheck.management',{},locale,'Gestión, NTP, DNS, AAA, syslog y SNMP funcionan desde sus orígenes autorizados.'),
      tr('deploy.runbook.postcheck.services',{},locale,'DHCP, navegación, políticas y servicios críticos pasan sus pruebas.'),
      tr('deploy.runbook.postcheck.alarms',{},locale,'No aparecen nuevas alarmas, errores de interfaz ni drift inesperado.'),
      tr('deploy.runbook.postcheck.observe',{},locale,'Mantener observación durante el periodo definido antes de cerrar el cambio.'),
      ...validationTargets.map(target=>tr('deploy.runbook.postcheck.target',{target},locale,'Validar objetivo declarado: {target}.')),
      ...criticalServices.map(service=>tr('deploy.runbook.postcheck.criticalService',{name:service.name,id:service.id},locale,'Validar servicio crítico {name} ({id}).')),
      ...resilienceChecks.map(scenario=>tr('deploy.runbook.postcheck.resilience',{name:scenario.name},locale,'Ejecutar escenario de resiliencia {name} y confirmar sus objetivos mustSurvive.'))
    ];
    return{
      ok:!issues.some(issue=>issue.blocking),version:VERSION,format:'netwizard-deployment-plan',generatedAt,projectName:clean(p.projName,160)||'NetWizard',strategy:clean(deployment.strategy,40)||'staged',changeTicket:clean(deployment.changeTicket,120),maintenanceWindow:clean(deployment.maintenanceWindow,160),approvalOwner:clean(deployment.approvalOwner,120),observationMinutes:Math.max(5,number(deployment.observationMinutes,15)),maxParallel:1,
      estimatedTotalMinutes:steps.reduce((total,step)=>total+step.estimatedMinutes,0)+Math.max(5,number(deployment.observationMinutes,15)),validationTargets,criticalServices,resilienceChecks,changeSet:{requestedMode:changeSet.requestedMode||'full',executionMode:changeSet.executionMode||'full-target',coverage:obj(changeSet.coverage)},incremental:{mode:incrementalPlan.mode||'full',requireExecutableIncremental:incrementalPlan.requireExecutableIncremental===true,counts:obj(incrementalPlan.counts)},
      issues,warnings:serialWarnings,prechecks:[
        tr('deploy.runbook.precheck.approval',{},locale,'Aprobación, ventana de cambio, responsables y canal de coordinación confirmados.'),
        tr('deploy.runbook.precheck.gate',{},locale,'Puerta estricta de producción superada y avisos revisados.'),
        tr('deploy.runbook.precheck.oob',{},locale,'Acceso fuera de banda o consola probado para los equipos críticos.'),
        tr('deploy.runbook.precheck.backup',{},locale,'Backup real de cada dispositivo exportado, legible y almacenado fuera del equipo.'),
        tr('deploy.runbook.precheck.lab',{},locale,'Configuraciones comparadas con el estado actual y probadas en laboratorio.'),
        tr('deploy.runbook.precheck.monitoring',{},locale,'Monitorización, sondas y contactos de escalado preparados.')
      ],stopCriteria:[
        tr('deploy.runbook.stop.management',{},locale,'Pérdida de acceso de gestión o consola durante más de 60 segundos.'),
        tr('deploy.runbook.stop.syntax',{},locale,'Error de sintaxis, commit fallido o reinicio no previsto.'),
        tr('deploy.runbook.stop.routing',{},locale,'Pérdida de ruta por defecto, adyacencia de routing o estado HA saludable.'),
        tr('deploy.runbook.stop.loss',{},locale,'Pérdida superior al 5% o latencia anómala en las sondas críticas.'),
        tr('deploy.runbook.stop.services',{},locale,'Fallo de DHCP, DNS, autenticación, conectividad inter-VLAN o servicios críticos.')
      ],postchecks,rollbackPlan:[
        tr('deploy.runbook.rollback.stop',{},locale,'Detener inmediatamente los pasos pendientes y registrar el criterio de parada.'),
        tr('deploy.runbook.rollback.isolate',{},locale,'Aislar el dispositivo afectado si evita propagar el impacto.'),
        tr('deploy.runbook.rollback.restore',{},locale,'Restaurar el backup REAL capturado antes del cambio mediante el método del fabricante.'),
        tr('deploy.runbook.rollback.validate',{},locale,'Validar gestión, routing, HA, VLANs y servicios antes de revertir otro equipo.'),
        tr('deploy.runbook.rollback.reverse',{},locale,'Revertir en orden inverso únicamente los dispositivos ya modificados.'),
        tr('deploy.runbook.rollback.evidence',{},locale,'Conservar evidencias y abrir revisión post-incidente antes de reintentar.')
      ],snapshotWarning:tr('deploy.runbook.snapshotWarning',{},locale,'El snapshot JSON de NetWizard conserva el diseño deseado, pero NO es un backup de la running-config de los dispositivos.'),phases,steps
    };
  }
  function markdownList(lines){return arr(lines).map(line=>`- [ ] ${line}`).join('\n');}
  function buildMarkdown(plan,options){
    const p=obj(plan),locale=obj(options).locale,pending=tr('deploy.runbook.pending',{},locale,'PENDIENTE');
    const lines=[
      tr('deploy.runbook.md.title',{project:p.projectName||'NetWizard'},locale,'# Runbook de despliegue — {project}'),'',
      tr('deploy.runbook.md.generated',{date:p.generatedAt||''},locale,'- Generado: {date}'),
      tr('deploy.runbook.md.strategy',{strategy:p.strategy||'staged'},locale,'- Estrategia: {strategy}'),
      tr('deploy.runbook.md.ticket',{ticket:p.changeTicket||pending},locale,'- Ticket: {ticket}'),
      tr('deploy.runbook.md.window',{window:p.maintenanceWindow||pending},locale,'- Ventana: {window}'),
      tr('deploy.runbook.md.approvalOwner',{owner:p.approvalOwner||pending},locale,'- Responsable de aprobación: {owner}'),
      tr('deploy.runbook.md.observation',{minutes:p.observationMinutes||15},locale,'- Observación final: {minutes} minutos'),
      tr('deploy.runbook.md.parallelism',{},locale,'- Paralelismo máximo: **1 dispositivo**'),'',
      tr('deploy.runbook.md.important',{warning:p.snapshotWarning||''},locale,'> **Importante:** {warning}'),'',
      tr('deploy.runbook.md.prechecks',{},locale,'## Prechecks'),'',
      markdownList(p.prechecks),''
    ];
    if(arr(p.issues).length){
      lines.push(tr('deploy.runbook.md.blockers',{},locale,'## Bloqueos del plan'),'');
      for(const issue of p.issues)lines.push(`- [${issue.code}] ${issue.message}`);
      lines.push('');
    }
    if(arr(p.warnings).length){
      lines.push(tr('deploy.runbook.md.haWarnings',{},locale,'## Precauciones HA/MLAG'),'');
      for(const warning of p.warnings)lines.push(`- ${warning}`);
      lines.push('');
    }
    lines.push(tr('deploy.runbook.md.sequence',{},locale,'## Secuencia de ejecución'),'');
    let currentPhase='';
    for(const step of arr(p.steps)){
      if(step.phase!==currentPhase){currentPhase=step.phase;lines.push(`### ${step.phaseLabel}`,'');}
      const change=obj(step.change),stats=obj(change.stats),incremental=obj(step.incremental),noChange=change.status==='no-change'||incremental.status==='no-change';
      let application;
      if(noChange)application=[
        tr('deploy.runbook.apply.noChange',{},locale,'No aplicar configuración: el objetivo normalizado coincide con el snapshot observado.'),
        tr('deploy.runbook.apply.validateOnly',{},locale,'Ejecutar únicamente las validaciones y conservar evidencia.')
      ];
      else if(incremental.status==='candidate-ready')application=[
        tr('deploy.runbook.apply.reviewCandidate',{path:incremental.applyPath},locale,'Revisar el candidato `{path}` y el diff de evidencia.'),
        ...arr(incremental.instructions),
        tr('deploy.runbook.apply.waitValidation',{},locale,'No continuar con el siguiente equipo hasta completar las validaciones.')
      ];
      else application=[
        tr('deploy.runbook.apply.compareTarget',{},locale,'Comparar el fichero objetivo y, si existe, el diff de revisión con la configuración activa.'),
        tr('deploy.runbook.apply.noCertifiedIncremental',{},locale,'No existe candidato incremental certificado para este equipo; no inferir comandos desde el diff.'),
        tr('deploy.runbook.apply.vendorSafe',{},locale,'Aplicar mediante el mecanismo transaccional/seguro del fabricante.'),
        tr('deploy.runbook.apply.waitValidation',{},locale,'No continuar con el siguiente equipo hasta completar las validaciones.')
      ];
      const localRollback=noChange?
        [tr('deploy.runbook.localRollback.none',{},locale,'No requiere rollback: no se aplica configuración.')]:
        incremental.status==='candidate-ready'?
          [tr('deploy.runbook.localRollback.candidate',{path:incremental.rollbackPath},locale,'Usar `{path}` solo tras compararlo con el backup real.'),...arr(incremental.rollbackInstructions),...arr(step.rollback)]:
          step.rollback;
      lines.push(
        `#### ${step.order}. ${step.deviceName} (${step.vendor})`,'',
        tr('deploy.runbook.md.risk',{risk:step.risk},locale,'- Riesgo: **{risk}**'),
        tr('deploy.runbook.md.config',{path:step.configPath},locale,'- Configuración: `{path}`'),
        tr('deploy.runbook.md.changeStatus',{status:change.status||'baseline-required',mode:change.applyMode||'full-target'},locale,'- Estado del cambio: **{status}** ({mode})'),
        tr('deploy.runbook.md.incremental',{status:incremental.status||'full-target',adapter:incremental.adapterId?` · ${incremental.adapterId}`:''},locale,'- Ejecución incremental: **{status}**{adapter}'),
        tr('deploy.runbook.md.candidate',{candidate:incremental.applyPath?`\`${incremental.applyPath}\``:tr('deploy.runbook.notGenerated',{},locale,'no generado')},locale,'- Candidato: {candidate}'),
        tr('deploy.runbook.md.delta',{added:stats.addedLines||0,removed:stats.removedLines||0},locale,'- Delta: +{added} / -{removed} líneas'),
        tr('deploy.runbook.md.reviewDiff',{diff:change.patchPath?`\`${change.patchPath}\``:tr('deploy.runbook.notAvailable',{},locale,'no disponible')},locale,'- Diff de revisión: {diff}'),
        tr('deploy.runbook.md.dependencies',{deps:step.dependsOn.length?step.dependsOn.join(', '):tr('deploy.runbook.none',{},locale,'ninguna')},locale,'- Dependencias: {deps}'),
        tr('deploy.runbook.md.estimated',{minutes:step.estimatedMinutes},locale,'- Tiempo estimado: {minutes} minutos'),'',
        tr('deploy.runbook.md.backup',{},locale,'Backup previo:'),markdownList(step.backup),'',
        tr('deploy.runbook.md.application',{},locale,'Aplicación:'),markdownList(application),'',
        tr('deploy.runbook.md.validation',{},locale,'Validación:'),markdownList(step.validation),'',
        tr('deploy.runbook.md.localRollback',{},locale,'Rollback local:'),markdownList(localRollback),''
      );
    }
    lines.push(
      tr('deploy.runbook.md.stopCriteria',{},locale,'## Criterios de parada'),'',
      markdownList(p.stopCriteria),'',
      tr('deploy.runbook.md.finalValidation',{},locale,'## Validación final'),'',
      markdownList(p.postchecks),'',
      tr('deploy.runbook.md.observeAtLeast',{minutes:p.observationMinutes||15},locale,'- [ ] Mantener observación al menos {minutes} minutos.'),''
    );
    if(arr(p.resilienceChecks).length){
      lines.push(tr('deploy.runbook.md.resilience',{},locale,'## Escenarios de resiliencia declarados'),'');
      for(const scenario of p.resilienceChecks){
        lines.push(tr('deploy.runbook.md.resilienceItem',{
          name:scenario.name,
          targets:scenario.mustSurvive.length?scenario.mustSurvive.join(', '):tr('deploy.runbook.confirmContinuity',{},locale,'confirmar continuidad esperada'),
          wan:scenario.requireWan?tr('deploy.runbook.wanRequired',{},locale,' · WAN requerida'):''
        },locale,'- [ ] {name}: {targets}{wan}.'));
      }
      lines.push('');
    }
    lines.push(tr('deploy.runbook.md.globalRollback',{},locale,'## Rollback global'),'',markdownList(p.rollbackPlan),'');
    return lines.join('\n')+'\n';
  }
  function buildRollbackMarkdown(plan,options){
    const p=obj(plan),locale=obj(options).locale;
    const lines=[
      tr('deploy.runbook.rollbackMd.title',{project:p.projectName||'NetWizard'},locale,'# Checklist de rollback — {project}'),'',
      `> ${p.snapshotWarning||''}`,'',
      tr('deploy.runbook.rollbackMd.preparation',{},locale,'## Preparación'),
      tr('deploy.runbook.rollbackMd.identifyChanged',{},locale,'- [ ] Identificar exactamente los dispositivos ya modificados.'),
      tr('deploy.runbook.rollbackMd.confirmBackup',{},locale,'- [ ] Confirmar el último backup real válido de cada uno.'),
      tr('deploy.runbook.rollbackMd.notify',{},locale,'- [ ] Notificar el rollback y congelar cambios adicionales.'),'',
      tr('deploy.runbook.rollbackMd.execution',{},locale,'## Ejecución'),'',
      markdownList(p.rollbackPlan),'',
      tr('deploy.runbook.rollbackMd.reverseOrder',{},locale,'## Orden inverso'),''
    ];
    for(const step of arr(p.steps).slice().reverse()){
      const change=obj(step.change),incremental=obj(step.incremental),reverse=change.rollbackPatchPath;
      if(change.status==='no-change'||incremental.status==='no-change')lines.push(tr('deploy.runbook.rollbackMd.noChange',{device:step.deviceName,vendor:step.vendor},locale,'- [ ] {device} — {vendor} — sin rollback; paso de validación únicamente.'));
      else lines.push(tr('deploy.runbook.rollbackMd.restore',{
        device:step.deviceName,
        vendor:step.vendor,
        suffix:incremental.rollbackPath?tr('deploy.runbook.rollbackMd.candidate',{path:incremental.rollbackPath},locale,' (candidato: `{path}`)'):reverse?tr('deploy.runbook.rollbackMd.reverseDiff',{path:reverse},locale,' (diff inverso de apoyo: `{path}`)'):'.'
      },locale,'- [ ] {device} — {vendor} — restaurar backup y ejecutar validaciones{suffix}'));
    }
    lines.push('',
      tr('deploy.runbook.rollbackMd.close',{},locale,'## Cierre'),
      tr('deploy.runbook.rollbackMd.recovery',{},locale,'- [ ] Confirmar recuperación de servicios y monitorización.'),
      tr('deploy.runbook.rollbackMd.logs',{},locale,'- [ ] Guardar logs, tiempos y causa del rollback.'),
      tr('deploy.runbook.rollbackMd.noRetry',{},locale,'- [ ] No reintentar hasta aprobar un plan corregido.'),''
    );
    return lines.join('\n');
  }

  const api={version:'netwizard-deployment-runbook-v3.50',phases:PHASES,buildDeploymentPlan,buildMarkdown,buildRollbackMarkdown,phaseFor,guidanceFor};
  root.NetWizardDeploymentRunbook=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
