/* NetWizard BOM & Budget v1
 * BOM is Derived from canonical inventory. Economic intent lives under project.budget.
 */
(function initNetWizardBudget(root){
'use strict';

const VERSION='netwizard-budget-v1';
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
const round=v=>Math.round((Number(v)||0)*100)/100;
function tryRequire(path){try{return require(path);}catch{return null;}}
function fieldPackage(){return root.NetWizardFieldInterventionPackage||(typeof require==='function'?tryRequire('./netwizard-field-intervention-package.js'):null);}
function xlsx(){return root.NetWizardXlsxWriter||(typeof require==='function'?tryRequire('./netwizard-xlsx-writer.js'):null);}

function refKey(kind,id){return clean(kind)+':'+clean(id);}
function parseRef(key){const pos=clean(key).indexOf(':');return pos<0?{kind:'',id:''}:{kind:key.slice(0,pos),id:key.slice(pos+1)};}
function modelKey(project,device){
  const d=device||{},source=clean(d.modelSource||'manual').toLowerCase(),ref=clean(d.modelRef);
  if(ref)return source+':'+ref;
  const custom=arr(project&&project.customDeviceModels).find(x=>x&&x.id===ref);
  const manufacturer=clean(d.manufacturer||custom&&custom.manufacturer).toLowerCase();
  const model=clean(d.model||custom&&custom.model).toLowerCase();
  const sku=clean(d.sku||d.partNumber||custom&&custom.sku).toLowerCase();
  if(!manufacturer&&!model&&!sku)return'';
  return 'manual:'+manufacturer+'|'+model+'|'+sku;
}
function normalizePrice(raw,defaults){
  const x=obj(raw),d=obj(defaults),hasCost=Object.prototype.hasOwnProperty.call(x,'unitCost')&&n(x.unitCost)!=null;
  const hasPrice=Object.prototype.hasOwnProperty.call(x,'unitPrice')&&n(x.unitPrice)!=null;
  const margin=n(x.targetMarginPct)!=null?n(x.targetMarginPct):n(d.defaultMarginPct);
  let cost=hasCost?Math.max(0,n(x.unitCost)):0,price=hasPrice?Math.max(0,n(x.unitPrice)):0;
  if(!hasPrice&&hasCost&&margin!=null&&margin>0&&margin<100)price=cost/(1-margin/100);
  const chargeType=['one-time','recurring'].includes(clean(x.chargeType))?clean(x.chargeType):(clean(d.chargeType)||'one-time');
  const capexOpex=['capex','opex'].includes(clean(x.capexOpex))?clean(x.capexOpex):(clean(d.capexOpex)||'capex');
  const months=Math.max(1,Math.round(n(x.billingPeriodMonths)||n(d.billingPeriodMonths)||1));
  return{
    unitCost:round(cost),unitPrice:round(price),chargeType,capexOpex,billingPeriodMonths:months,
    targetMarginPct:margin==null?null:round(margin),
    supplier:clean(x.supplier),quoteRef:clean(x.quoteRef),validUntil:clean(x.validUntil),note:clean(x.note),
    explicit:hasCost||hasPrice
  };
}
function config(project){
  const b=obj(project&&project.budget);
  return{
    version:VERSION,
    currency:(clean(b.currency)||'EUR').toUpperCase(),
    taxRatePct:Math.min(100,Math.max(0,n(b.taxRatePct)||0)),
    defaultMarginPct:Math.min(99.99,Math.max(0,n(b.defaultMarginPct)||0)),
    scope:['full','intervention'].includes(clean(b.scope))?clean(b.scope):'full',
    resourcePricing:obj(b.resourcePricing),
    modelPricing:obj(b.modelPricing),
    serviceLines:arr(b.serviceLines)
  };
}
function line(kind,id,description,quantity,unit,category,extra){
  return Object.assign({
    lineId:refKey(kind,id),resourceKind:kind,resourceId:id,resourceRef:refKey(kind,id),
    description:clean(description)||refKey(kind,id),quantity:Math.max(0,n(quantity)==null?1:n(quantity)),unit:clean(unit)||'ud',
    category:clean(category)||'Material',defaultChargeType:'one-time',defaultCapexOpex:'capex',modelKey:'',source:'inventory'
  },extra||{});
}
function deviceDescription(d){return [clean(d&&d.manufacturer),clean(d&&d.model),clean(d&&d.name)].filter(Boolean).join(' · ')||clean(d&&d.id)||'Equipo';}
function inventoryLines(project){
  const p=project||{},out=[];
  for(const d of arr(p.devices))out.push(line('device',d.id,deviceDescription(d),1,'ud','Equipos',{modelKey:modelKey(p,d),deviceKind:clean(d.kind||d.type)}));
  for(const r of arr(p.racks))out.push(line('rack',r.id,(r.name||r.id)+' · '+(r.rackUnits||42)+'U',1,'ud','Racks'));
  for(const x of arr(p.pdus))out.push(line('pdu',x.id,(x.name||x.id)+' · '+(x.outletCount||0)+' tomas',1,'ud','Alimentación'));
  for(const x of arr(p.patchPanels))out.push(line('patchPanel',x.id,(x.name||x.id)+' · '+(x.portCount||0)+' puertos '+clean(x.category),1,'ud','Patching'));
  for(const x of arr(p.telecomOutlets))out.push(line('telecomOutlet',x.id,(x.name||x.id)+' · '+(x.portCount||1)+' toma(s) '+clean(x.category),1,'ud','Patching'));
  for(const x of arr(p.cableRuns)){
    const qty=n(x.lengthM)!=null&&n(x.lengthM)>0?n(x.lengthM):1;
    out.push(line('cableRun',x.id,(x.cableType||'Cableado')+' · '+(x.label||x.id),qty,n(x.lengthM)>0?'m':'ud','Cableado'));
  }
  for(const x of arr(p.patchConnections))out.push(line('patchConnection',x.id,'Latiguillo rack · '+(x.patchPanelId||'—')+' ↔ '+(x.switchPortId||'—'),1,'ud','Patching'));
  for(const x of arr(p.hostOutletConnections))out.push(line('hostOutletConnection',x.id,'Latiguillo usuario · '+(x.outletId||'—')+' ↔ '+(x.hostId||'—'),1,'ud','Patching'));
  for(const x of arr(p.rackItems).filter(x=>x&&x.type!=='device'&&!x.patchPanelId)){
    out.push(line('rackItem',x.id,x.label||x.name||x.id,1,'ud','Rack'));
  }
  for(const pt of arr(p.ports)){
    if(!clean(pt.transceiver))continue;
    out.push(line('port',pt.id,'Óptica / transceiver · '+clean(pt.transceiver)+' · '+clean(pt.name||pt.id),1,'ud','Ópticas',{parentDeviceId:pt.deviceId,subtype:'transceiver'}));
  }
  for(const l of arr(p.links)){
    const media=clean(l.media||l.medium||l.cableType).toLowerCase();
    if(!media.includes('dac'))continue;
    out.push(line('link',l.id,'DAC · '+clean(l.name||l.label||l.id),1,'ud','Ópticas',{subtype:'dac'}));
  }
  for(const c of arr(p.wanCircuits)){
    out.push(line('wanCircuit',c.id,(c.name||c.id)+' · '+clean(c.provider),1,'mes','WAN',{
      defaultChargeType:'recurring',defaultCapexOpex:'opex',billingPeriodMonths:1
    }));
  }
  return out.filter(x=>x.resourceId);
}
function interventionRefs(project){
  const P=fieldPackage();if(!P||typeof P.diffMaterials!=='function')return null;
  const diff=P.diffMaterials(project),set=new Set(),newDevices=new Set();
  const kindMap={'Rack':'rack','PDU':'pdu','Cableado':'cableRun','Latiguillo rack':'patchConnection','Latiguillo usuario':'hostOutletConnection'};
  for(const x of arr(diff.additions)){
    if(x.deviceId){set.add(refKey('device',x.deviceId));newDevices.add(x.deviceId);}
    const kind=kindMap[x.kind],id=x.currentId;if(kind&&id)set.add(refKey(kind,id));
  }
  for(const pt of arr(project&&project.ports))if(newDevices.has(pt.deviceId)&&clean(pt.transceiver))set.add(refKey('port',pt.id));
  for(const l of arr(project&&project.links)){
    const media=clean(l.media||l.medium||l.cableType).toLowerCase();
    if(media.includes('dac'))set.add(refKey('link',l.id));
  }
  return set;
}
function serviceLines(project){
  const cfg=config(project);
  return cfg.serviceLines.map((raw,index)=>{
    const x=obj(raw),id=clean(x.id)||'service-'+String(index+1),quantity=Math.max(0,n(x.quantity)==null?1:n(x.quantity));
    return Object.assign(line('service',id,clean(x.description)||'Servicio',quantity,clean(x.unit)||'ud',clean(x.category)||'Servicios',{
      resourceRef:clean(x.resourceRef),source:'service',defaultChargeType:clean(x.chargeType)||'one-time',defaultCapexOpex:clean(x.capexOpex)||'opex'
    }),{service:x});
  });
}
function pricingFor(project,base){
  const cfg=config(project),resource=obj(cfg.resourcePricing[base.resourceRef]),model=base.modelKey?obj(cfg.modelPricing[base.modelKey]):{};
  let source='none',raw={};
  if(Object.keys(resource).length){raw=resource;source='resource';}
  else if(Object.keys(model).length){raw=model;source='model';}
  else if(base.source==='service'){raw=obj(base.service);source='service';}
  const price=normalizePrice(raw,{
    defaultMarginPct:cfg.defaultMarginPct,
    chargeType:base.defaultChargeType,
    capexOpex:base.defaultCapexOpex,
    billingPeriodMonths:base.billingPeriodMonths||1
  });
  return Object.assign(price,{pricingSource:source,priced:price.explicit});
}
function enrich(project,base){
  const p=pricingFor(project,base),qty=Number(base.quantity)||0;
  const periodCost=p.unitCost*qty,periodPrice=p.unitPrice*qty;
  const monthlyCost=p.chargeType==='recurring'?periodCost/p.billingPeriodMonths:0;
  const monthlyPrice=p.chargeType==='recurring'?periodPrice/p.billingPeriodMonths:0;
  const oneTimeCost=p.chargeType==='one-time'?periodCost:0,oneTimePrice=p.chargeType==='one-time'?periodPrice:0;
  return Object.assign({},base,p,{
    totalCost:round(periodCost),totalPrice:round(periodPrice),
    oneTimeCost:round(oneTimeCost),oneTimePrice:round(oneTimePrice),
    monthlyRecurringCost:round(monthlyCost),monthlyRecurringPrice:round(monthlyPrice),
    grossProfit:round(periodPrice-periodCost),
    grossMarginPct:periodPrice>0?round((periodPrice-periodCost)*100/periodPrice):0
  });
}
function build(project,options){
  const cfg=config(project),opts=obj(options),scope=['full','intervention'].includes(clean(opts.scope))?clean(opts.scope):cfg.scope;
  let lines=inventoryLines(project),scopeRefs=scope==='intervention'?interventionRefs(project):null;
  if(scopeRefs){
    lines=lines.filter(x=>scopeRefs.has(x.resourceRef)||x.resourceKind==='wanCircuit');
  }
  lines=lines.concat(serviceLines(project)).map(x=>enrich(project,x));
  lines.sort((a,b)=>(a.category+'|'+a.description+'|'+a.resourceRef).localeCompare(b.category+'|'+b.description+'|'+b.resourceRef));
  const priced=lines.filter(x=>x.priced),unpriced=lines.filter(x=>!x.priced);
  const sum=key=>round(lines.reduce((s,x)=>s+(Number(x[key])||0),0));
  const oneTimeCost=sum('oneTimeCost'),oneTimePrice=sum('oneTimePrice');
  const monthlyRecurringCost=sum('monthlyRecurringCost'),monthlyRecurringPrice=sum('monthlyRecurringPrice');
  const annualRecurringCost=round(monthlyRecurringCost*12),annualRecurringPrice=round(monthlyRecurringPrice*12);
  const year1Cost=round(oneTimeCost+annualRecurringCost),year1Price=round(oneTimePrice+annualRecurringPrice);
  const grossProfitYear1=round(year1Price-year1Cost),grossMarginPct=year1Price>0?round(grossProfitYear1*100/year1Price):0;
  const taxAmountYear1=round(year1Price*cfg.taxRatePct/100);
  const capexCost=round(lines.filter(x=>x.capexOpex==='capex').reduce((s,x)=>s+x.oneTimeCost+x.monthlyRecurringCost*12,0));
  const capexPrice=round(lines.filter(x=>x.capexOpex==='capex').reduce((s,x)=>s+x.oneTimePrice+x.monthlyRecurringPrice*12,0));
  const opexYear1Cost=round(year1Cost-capexCost),opexYear1Price=round(year1Price-capexPrice);
  return{
    version:'netwizard-budget-report-v1',scope,currency:cfg.currency,taxRatePct:cfg.taxRatePct,defaultMarginPct:cfg.defaultMarginPct,
    lines,priced,unpriced,
    counts:{lines:lines.length,priced:priced.length,unpriced:unpriced.length},
    totals:{
      oneTimeCost,oneTimePrice,monthlyRecurringCost,monthlyRecurringPrice,annualRecurringCost,annualRecurringPrice,
      capexCost,capexPrice,opexYear1Cost,opexYear1Price,year1Cost,year1Price,grossProfitYear1,grossMarginPct,
      taxAmountYear1,year1CustomerTotal:round(year1Price+taxAmountYear1)
    }
  };
}
function validateProject(project){
  const cfg=config(project),issues=[],known=new Set(inventoryLines(project).map(x=>x.resourceRef));
  if(!/^[A-Z]{3}$/.test(cfg.currency))issues.push({code:'NW-BUDGET-001',blocking:true,severity:'error',message:'La moneda debe usar código ISO de 3 letras.'});
  if(cfg.defaultMarginPct<0||cfg.defaultMarginPct>=100)issues.push({code:'NW-BUDGET-002',blocking:true,severity:'error',message:'El margen objetivo debe estar entre 0 y 99,99%.'});
  for(const [key,raw] of Object.entries(cfg.resourcePricing)){
    if(!known.has(key))issues.push({code:'NW-BUDGET-003',blocking:false,severity:'warning',resourceRef:key,message:'Precio referencia un recurso inexistente: '+key+'.'});
    const p=normalizePrice(raw,{defaultMarginPct:cfg.defaultMarginPct});
    if(p.unitPrice>0&&p.unitPrice<p.unitCost)issues.push({code:'NW-BUDGET-004',blocking:false,severity:'warning',resourceRef:key,message:key+': precio de venta inferior al coste.'});
    if(p.chargeType==='recurring'&&p.capexOpex==='capex')issues.push({code:'NW-BUDGET-005',blocking:false,severity:'warning',resourceRef:key,message:key+': concepto recurrente clasificado como CAPEX; revisar.'});
  }
  const ids=new Set();
  for(const raw of cfg.serviceLines){
    const x=obj(raw),id=clean(x.id);
    if(!id)issues.push({code:'NW-BUDGET-006',blocking:true,severity:'error',message:'Línea de servicio sin id.'});
    else if(ids.has(id))issues.push({code:'NW-BUDGET-007',blocking:true,severity:'error',message:'Línea de servicio duplicada: '+id+'.'});
    ids.add(id);
    if(!(n(x.quantity)>0))issues.push({code:'NW-BUDGET-008',blocking:true,severity:'error',message:(x.description||id)+': cantidad debe ser mayor que 0.'});
    const p=normalizePrice(x,{defaultMarginPct:cfg.defaultMarginPct,chargeType:x.chargeType,capexOpex:x.capexOpex});
    if(p.unitPrice>0&&p.unitPrice<p.unitCost)issues.push({code:'NW-BUDGET-009',blocking:false,severity:'warning',message:(x.description||id)+': precio de venta inferior al coste.'});
  }
  const report=build(project);
  return{
    version:'netwizard-budget-validation-v1',ok:!issues.some(x=>x.blocking),issues,
    counts:{blocking:issues.filter(x=>x.blocking).length,warnings:issues.filter(x=>!x.blocking).length,unpriced:report.counts.unpriced}
  };
}
function toRows(project,options){
  const report=build(project,options);
  return report.lines.map(x=>({
    category:x.category,description:x.description,resourceRef:x.resourceRef,modelKey:x.modelKey||'',
    quantity:x.quantity,unit:x.unit,currency:report.currency,pricingSource:x.pricingSource,priced:x.priced?'yes':'no',
    unitCost:x.unitCost,unitPrice:x.unitPrice,chargeType:x.chargeType,billingPeriodMonths:x.billingPeriodMonths,
    capexOpex:x.capexOpex,totalCost:x.totalCost,totalPrice:x.totalPrice,
    monthlyRecurringCost:x.monthlyRecurringCost,monthlyRecurringPrice:x.monthlyRecurringPrice,
    grossProfit:x.grossProfit,grossMarginPct:x.grossMarginPct,supplier:x.supplier,quoteRef:x.quoteRef,validUntil:x.validUntil,note:x.note
  }));
}
function toCsv(project,options){
  const rows=toRows(project,options),cols=rows[0]?Object.keys(rows[0]):[];
  const q=v=>{const s=String(v==null?'':v);return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  return [cols.join(','),...rows.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n');
}
function buildXlsx(project,options){
  const X=xlsx();if(!X||typeof X.buildWorkbook!=='function')throw new Error('NetWizardXlsxWriter no está disponible.');
  const report=build(project,options),summary=[
    {metric:'Scope',value:report.scope},{metric:'Currency',value:report.currency},
    {metric:'Priced lines',value:report.counts.priced},{metric:'Unpriced lines',value:report.counts.unpriced},
    ...Object.entries(report.totals).map(([metric,value])=>({metric,value}))
  ];
  return X.buildWorkbook([{name:'Presupuesto',rows:toRows(project,options)},{name:'Resumen',rows:summary}]);
}
function markdown(project,options){
  const report=build(project,options),t=report.totals,c=report.currency;
  const money=v=>Number(v||0).toFixed(2)+' '+c;
  const lines=[
    '# BOM & Presupuesto — '+(clean(project&&project.projName)||'NetWizard'),'',
    '- Alcance: '+report.scope,
    '- Líneas: '+report.counts.lines+' · con precio '+report.counts.priced+' · sin precio '+report.counts.unpriced,
    '- Moneda: '+c,'',
    '## Resumen económico','',
    '- Coste one-time: '+money(t.oneTimeCost),
    '- Venta one-time: '+money(t.oneTimePrice),
    '- OPEX mensual: '+money(t.monthlyRecurringPrice),
    '- Venta año 1: '+money(t.year1Price),
    '- Coste año 1: '+money(t.year1Cost),
    '- Margen bruto año 1: '+money(t.grossProfitYear1)+' ('+t.grossMarginPct+'%)',
    '- Impuesto año 1: '+money(t.taxAmountYear1),
    '- Total cliente año 1: '+money(t.year1CustomerTotal),'',
    '## Líneas',''
  ];
  for(const x of report.lines)lines.push('- '+x.quantity+' '+x.unit+' · '+x.category+' · '+x.description+' · '+(x.priced?money(x.totalPrice):'SIN PRECIO'));
  return lines.join('\n')+'\n';
}
const api={
  VERSION,version:VERSION,refKey,parseRef,modelKey,config,normalizePrice,inventoryLines,interventionRefs,serviceLines,
  pricingFor,build,validateProject,toRows,toCsv,buildXlsx,markdown
};
root.NetWizardBudget=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
