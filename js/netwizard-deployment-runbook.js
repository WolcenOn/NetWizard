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
  function guidanceFor(device){
    const vendor=clean(device&&device.vendorOs,80).toLowerCase();const guidance=VENDOR_GUIDANCE[vendor]||{backup:['Exportar la configuración activa con el método soportado por el fabricante.'],validate:['Comprobar gestión, interfaces, rutas, VLANs y servicios afectados.'],rollback:['Restaurar el backup previo mediante el procedimiento aprobado por el fabricante.']};
    return {backup:guidance.backup.slice(),validate:guidance.validate.slice(),rollback:guidance.rollback.slice()};
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
    const p=obj(project),opts=obj(options),deployment=obj(p.deployment),overrides=obj(deployment.devices),graph=adjacency(p),distances=graphDistances(p,graph),generatedAt=clean(opts.generatedAt,40)||new Date().toISOString();
    const changeSet=obj(opts.changeSet),changeByDevice=new Map(arr(changeSet.devices).map(change=>[change.deviceId,change]));
    const incrementalPlan=obj(opts.incrementalPlan),incrementalByDevice=new Map(arr(incrementalPlan.devices).map(item=>[item.deviceId,item]));
    const deviceIds=new Set(arr(p.devices).map(device=>device.id));const issues=[];
    for(const device of arr(p.devices)){const override=obj(overrides[device.id]);for(const dependency of [...arr(device.dependsOnDeviceRefs),...arr(override.dependsOnDeviceRefs)].map(clean).filter(Boolean)){if(dependency===device.id)issues.push({code:'NW-RUNBOOK-003',severity:'error',blocking:true,category:'deployment',deviceId:device.id,message:`${device.name||device.id}: no puede depender de sí mismo para el despliegue.`});else if(!deviceIds.has(dependency))issues.push({code:'NW-RUNBOOK-002',severity:'error',blocking:true,category:'deployment',deviceId:device.id,message:`${device.name||device.id}: dependencia de despliegue inexistente (${dependency}).`});}}
    const draft=arr(p.devices).map((device,index)=>{const override=obj(overrides[device.id]),phase=phaseFor(device,override),guide=guidanceFor(device),change=obj(changeByDevice.get(device.id)),incremental=obj(incrementalByDevice.get(device.id));return{deviceId:device.id,deviceName:clean(device.name,100)||device.id,kind:deviceKind(device),vendor:clean(device.vendorOs,80)||'generic_network',phase:phase.id,phaseLabel:phase.label,phaseOrder:phase.order,requestedOrder:number(override.order,number(device.deploymentOrder,9999)),distance:number(distances.get(device.id),9999),dependsOn:deviceDependencies(p,device,phase,graph,distances,overrides),risk:riskFor(device,phase,p),serialGroups:serialGroups(p,device.id),estimatedMinutes:Math.max(5,number(override.estimatedMinutes,number(device.deploymentMinutes,15))),configPath:configPathFor(device,index,opts),change:{status:change.status||'baseline-required',applyMode:change.applyMode||'full-target',patchPath:change.patchPath||null,rollbackPatchPath:change.rollbackPatchPath||null,capturedAt:change.capturedAt||null,stats:obj(change.stats)},incremental:{status:incremental.status||'full-target',adapterId:incremental.adapterId||null,applyPath:incremental.applyPath||null,rollbackPath:incremental.rollbackPath||null,instructions:arr(incremental.instructions),rollbackInstructions:arr(incremental.rollbackInstructions),commandCounts:obj(incremental.commandCounts)},backup:guide.backup,validation:guide.validate,rollback:guide.rollback};});
    const sorted=topoSort(draft);if(sorted.cycles.length)issues.push({code:'NW-RUNBOOK-001',severity:'error',blocking:true,category:'deployment',message:`Dependencias de despliegue no resolubles (ciclo o cadena bloqueada): ${sorted.cycles.join(', ')}.`,deviceIds:sorted.cycles});
    const steps=sorted.ordered.map((node,index)=>Object.assign({},node,{order:index+1,id:`deploy-${String(index+1).padStart(2,'0')}`}));
    const phases=Object.values(PHASES).sort((a,b)=>a.order-b.order).map(phase=>({id:phase.id,label:phase.label,order:phase.order,steps:steps.filter(step=>step.phase===phase.id).map(step=>step.id)})).filter(phase=>phase.steps.length);
    const serialWarnings=steps.filter(step=>step.serialGroups.length).map(step=>`${step.deviceName}: miembro de ${step.serialGroups.map(group=>`${group.type.toUpperCase()} ${group.label}`).join(', ')}; validar el peer antes de continuar.`);
    if(!clean(deployment.changeTicket))serialWarnings.push('Falta asociar un ticket o identificador de cambio.');
    if(!clean(deployment.maintenanceWindow))serialWarnings.push('Falta documentar la ventana de mantenimiento.');
    if(!clean(deployment.approvalOwner))serialWarnings.push('Falta identificar al responsable de aprobación.');
    const resilienceChecks=arr(p.failureScenarios).map(scenario=>({id:scenario.id,name:clean(scenario.name,120)||scenario.id,requireWan:scenario.requireWan!==false,mustSurvive:arr(scenario.mustSurvive).map(item=>`${clean(item.type,40)}:${clean(item.ref,120)||'conectividad'}`)}));
    const criticalServices=arr(p.internalServices).filter(service=>service.critical===true||clean(service.criticality,40).toLowerCase()==='critical').map(service=>({id:service.id,name:clean(service.name,120)||service.id}));
    const validationTargets=arr(deployment.validationTargets).map(target=>clean(target,200)).filter(Boolean);
    const postchecks=[
      'Interfaces, trunks, VLANs, rutas y vecinos presentan el estado esperado.',
      'Gestión, NTP, DNS, AAA, syslog y SNMP funcionan desde sus orígenes autorizados.',
      'DHCP, navegación, políticas y servicios críticos pasan sus pruebas.',
      'No aparecen nuevas alarmas, errores de interfaz ni drift inesperado.',
      'Mantener observación durante el periodo definido antes de cerrar el cambio.',
      ...validationTargets.map(target=>`Validar objetivo declarado: ${target}.`),
      ...criticalServices.map(service=>`Validar servicio crítico ${service.name} (${service.id}).`),
      ...resilienceChecks.map(scenario=>`Ejecutar escenario de resiliencia ${scenario.name} y confirmar sus objetivos mustSurvive.`)
    ];
    return{
      ok:!issues.some(issue=>issue.blocking),version:VERSION,format:'netwizard-deployment-plan',generatedAt,projectName:clean(p.projName,160)||'NetWizard',strategy:clean(deployment.strategy,40)||'staged',changeTicket:clean(deployment.changeTicket,120),maintenanceWindow:clean(deployment.maintenanceWindow,160),approvalOwner:clean(deployment.approvalOwner,120),observationMinutes:Math.max(5,number(deployment.observationMinutes,15)),maxParallel:1,
      estimatedTotalMinutes:steps.reduce((total,step)=>total+step.estimatedMinutes,0)+Math.max(5,number(deployment.observationMinutes,15)),validationTargets,criticalServices,resilienceChecks,changeSet:{requestedMode:changeSet.requestedMode||'full',executionMode:changeSet.executionMode||'full-target',coverage:obj(changeSet.coverage)},incremental:{mode:incrementalPlan.mode||'full',requireExecutableIncremental:incrementalPlan.requireExecutableIncremental===true,counts:obj(incrementalPlan.counts)},
      issues,warnings:serialWarnings,prechecks:[
        'Aprobación, ventana de cambio, responsables y canal de coordinación confirmados.',
        'Puerta estricta de producción superada y avisos revisados.',
        'Acceso fuera de banda o consola probado para los equipos críticos.',
        'Backup real de cada dispositivo exportado, legible y almacenado fuera del equipo.',
        'Configuraciones comparadas con el estado actual y probadas en laboratorio.',
        'Monitorización, sondas y contactos de escalado preparados.'
      ],stopCriteria:[
        'Pérdida de acceso de gestión o consola durante más de 60 segundos.',
        'Error de sintaxis, commit fallido o reinicio no previsto.',
        'Pérdida de ruta por defecto, adyacencia de routing o estado HA saludable.',
        'Pérdida superior al 5% o latencia anómala en las sondas críticas.',
        'Fallo de DHCP, DNS, autenticación, conectividad inter-VLAN o servicios críticos.'
      ],postchecks,rollbackPlan:[
        'Detener inmediatamente los pasos pendientes y registrar el criterio de parada.',
        'Aislar el dispositivo afectado si evita propagar el impacto.',
        'Restaurar el backup REAL capturado antes del cambio mediante el método del fabricante.',
        'Validar gestión, routing, HA, VLANs y servicios antes de revertir otro equipo.',
        'Revertir en orden inverso únicamente los dispositivos ya modificados.',
        'Conservar evidencias y abrir revisión post-incidente antes de reintentar.'
      ],snapshotWarning:'El snapshot JSON de NetWizard conserva el diseño deseado, pero NO es un backup de la running-config de los dispositivos.',phases,steps
    };
  }
  function markdownList(lines){return arr(lines).map(line=>`- [ ] ${line}`).join('\n');}
  function buildMarkdown(plan){
    const p=obj(plan),lines=[`# Runbook de despliegue — ${p.projectName||'NetWizard'}`,'',`- Generado: ${p.generatedAt||''}`,`- Estrategia: ${p.strategy||'staged'}`,`- Ticket: ${p.changeTicket||'PENDIENTE'}`,`- Ventana: ${p.maintenanceWindow||'PENDIENTE'}`,`- Responsable de aprobación: ${p.approvalOwner||'PENDIENTE'}`,`- Observación final: ${p.observationMinutes||15} minutos`,`- Paralelismo máximo: **1 dispositivo**`,'',`> **Importante:** ${p.snapshotWarning||''}`,'','## Prechecks','',markdownList(p.prechecks),''];
    if(arr(p.issues).length){lines.push('## Bloqueos del plan','');for(const issue of p.issues)lines.push(`- [${issue.code}] ${issue.message}`);lines.push('');}
    if(arr(p.warnings).length){lines.push('## Precauciones HA/MLAG','');for(const warning of p.warnings)lines.push(`- ${warning}`);lines.push('');}
    lines.push('## Secuencia de ejecución','');
    let currentPhase='';for(const step of arr(p.steps)){if(step.phase!==currentPhase){currentPhase=step.phase;lines.push(`### ${step.phaseLabel}`,'');}const change=obj(step.change),stats=obj(change.stats),incremental=obj(step.incremental),noChange=change.status==='no-change'||incremental.status==='no-change';let application;if(noChange)application=['No aplicar configuración: el objetivo normalizado coincide con el snapshot observado.','Ejecutar únicamente las validaciones y conservar evidencia.'];else if(incremental.status==='candidate-ready')application=[`Revisar el candidato \`${incremental.applyPath}\` y el diff de evidencia.`,...arr(incremental.instructions),'No continuar con el siguiente equipo hasta completar las validaciones.'];else application=['Comparar el fichero objetivo y, si existe, el diff de revisión con la configuración activa.','No existe candidato incremental certificado para este equipo; no inferir comandos desde el diff.','Aplicar mediante el mecanismo transaccional/seguro del fabricante.','No continuar con el siguiente equipo hasta completar las validaciones.'];const localRollback=noChange?['No requiere rollback: no se aplica configuración.']:incremental.status==='candidate-ready'?[`Usar \`${incremental.rollbackPath}\` solo tras compararlo con el backup real.`,...arr(incremental.rollbackInstructions),...arr(step.rollback)]:step.rollback;lines.push(`#### ${step.order}. ${step.deviceName} (${step.vendor})`,'',`- Riesgo: **${step.risk}**`,`- Configuración: \`${step.configPath}\``,`- Estado del cambio: **${change.status||'baseline-required'}** (${change.applyMode||'full-target'})`,`- Ejecución incremental: **${incremental.status||'full-target'}**${incremental.adapterId?` · ${incremental.adapterId}`:''}`,`- Candidato: ${incremental.applyPath?`\`${incremental.applyPath}\``:'no generado'}`,`- Delta: +${stats.addedLines||0} / -${stats.removedLines||0} líneas`,`- Diff de revisión: ${change.patchPath?`\`${change.patchPath}\``:'no disponible'}`,`- Dependencias: ${step.dependsOn.length?step.dependsOn.join(', '):'ninguna'}`,`- Tiempo estimado: ${step.estimatedMinutes} minutos`,'','Backup previo:',markdownList(step.backup),'','Aplicación:',markdownList(application),'','Validación:',markdownList(step.validation),'','Rollback local:',markdownList(localRollback),'');}
    lines.push('## Criterios de parada','',markdownList(p.stopCriteria),'','## Validación final','',markdownList(p.postchecks),'',`- [ ] Mantener observación al menos ${p.observationMinutes||15} minutos.`,'');if(arr(p.resilienceChecks).length){lines.push('## Escenarios de resiliencia declarados','');for(const scenario of p.resilienceChecks)lines.push(`- [ ] ${scenario.name}: ${scenario.mustSurvive.length?scenario.mustSurvive.join(', '):'confirmar continuidad esperada'}${scenario.requireWan?' · WAN requerida':''}.`);lines.push('');}lines.push('## Rollback global','',markdownList(p.rollbackPlan),'');return lines.join('\n')+'\n';
  }
  function buildRollbackMarkdown(plan){const p=obj(plan),lines=[`# Checklist de rollback — ${p.projectName||'NetWizard'}`,'',`> ${p.snapshotWarning||''}`,'','## Preparación','- [ ] Identificar exactamente los dispositivos ya modificados.','- [ ] Confirmar el último backup real válido de cada uno.','- [ ] Notificar el rollback y congelar cambios adicionales.','','## Ejecución','',markdownList(p.rollbackPlan),'','## Orden inverso',''];for(const step of arr(p.steps).slice().reverse()){const change=obj(step.change),incremental=obj(step.incremental),reverse=change.rollbackPatchPath;if(change.status==='no-change'||incremental.status==='no-change')lines.push(`- [ ] ${step.deviceName} — ${step.vendor} — sin rollback; paso de validación únicamente.`);else lines.push(`- [ ] ${step.deviceName} — ${step.vendor} — restaurar backup y ejecutar validaciones${incremental.rollbackPath?` (candidato: \`${incremental.rollbackPath}\`)`:reverse?` (diff inverso de apoyo: \`${reverse}\`)`:'.'}`);}lines.push('','## Cierre','- [ ] Confirmar recuperación de servicios y monitorización.','- [ ] Guardar logs, tiempos y causa del rollback.','- [ ] No reintentar hasta aprobar un plan corregido.','');return lines.join('\n');}

  const api={version:'netwizard-deployment-runbook-v3.50',phases:PHASES,buildDeploymentPlan,buildMarkdown,buildRollbackMarkdown,phaseFor,guidanceFor};
  root.NetWizardDeploymentRunbook=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
