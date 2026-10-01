/* NetWizard BOM & Budget UI v1 */
(function initNetWizardBudgetUi(root){
'use strict';

const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const clean=v=>String(v==null?'':v).trim();
const clone=v=>JSON.parse(JSON.stringify(v==null?{}:v));
const doc=()=>root.document||null;
const state=()=>root.NetWizardState||null;
const engine=()=>root.NetWizardBudget||null;

function el(tag,cls,text){
  const n=doc().createElement(tag);
  if(cls)n.className=cls;
  if(text!=null)n.textContent=String(text);
  return n;
}
function field(label,control){
  const w=el('div'),l=el('label','fl',label);w.append(l,control);return w;
}
function input(type,placeholder){
  const x=el('input');x.type=type||'text';if(placeholder)x.placeholder=placeholder;return x;
}
function select(options){
  const s=el('select');
  for(const [value,label] of options){const o=el('option','',label);o.value=value;s.append(o);}
  return s;
}
function snapshot(){return state()?.getSnapshot?.()||{};}
function persist(mutator,source){
  const S=state();if(!S||typeof S.replaceProject!=='function')return false;
  const p=clone(snapshot()),B=engine(),cfg=B.config(p);
  p.budget=Object.assign({},cfg,clone(obj(p.budget)));
  p.budget.version=B.VERSION;
  p.budget.resourcePricing=obj(p.budget.resourcePricing);
  p.budget.modelPricing=obj(p.budget.modelPricing);
  p.budget.serviceLines=arr(p.budget.serviceLines);
  mutator(p.budget,p);
  S.replaceProject(p,{source:source||'budget-ui'});
  return true;
}
function money(value,currency){
  try{return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'EUR'}).format(Number(value)||0);}
  catch{return (Number(value)||0).toFixed(2)+' '+(currency||'EUR');}
}
function download(name,data,mime){
  const bytes=data instanceof Uint8Array?data:new TextEncoder().encode(String(data==null?'':data));
  const blob=new Blob([bytes],{type:mime||'application/octet-stream'}),url=URL.createObjectURL(blob),a=doc().createElement('a');
  a.href=url;a.download=name;doc().body.append(a);a.click();
  root.setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},500);
}
function safeName(value){return clean(value||'netwizard').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_.-]+/g,'-').replace(/^-+|-+$/g,'')||'netwizard';}
function priceRaw(project,line,scope){
  const b=obj(project.budget);
  if(scope==='model'&&line.modelKey)return obj(obj(b.modelPricing)[line.modelKey]);
  return obj(obj(b.resourcePricing)[line.resourceRef]);
}
function render(project){
  const B=engine(),report=B.build(project),validation=B.validateProject(project),cfg=B.config(project);
  const card=el('div','card nw-card-wide'),head=el('div','card-h');
  head.append(el('div','card-t','💶 BOM & Presupuesto'),el('span','b '+(validation.ok?'bgr':'brd'),validation.ok?'Válido':'Revisar'));card.append(head);
  card.append(el('p','hint','La BOM se deriva del inventario. Los precios solo referencian recursos/modelos existentes; las líneas manuales se reservan para licencias, suscripciones, mano de obra, desplazamientos y servicios.'));

  const settings=el('div','g2'),currency=input('text','EUR'),tax=input('number','0'),margin=input('number','0'),scope=select([['full','Proyecto completo'],['intervention','Intervención / diferencial']]);
  currency.id='budgetCurrency';tax.id='budgetTax';margin.id='budgetMargin';scope.id='budgetScope';
  currency.value=cfg.currency;currency.maxLength=3;tax.value=cfg.taxRatePct;margin.value=cfg.defaultMarginPct;scope.value=cfg.scope;
  settings.append(field('Moneda',currency),field('Impuesto %',tax),field('Margen objetivo %',margin),field('Alcance',scope));
  const saveSettings=el('button','btn bs','💾 Guardar parámetros');saveSettings.id='budgetSaveSettings';saveSettings.type='button';
  saveSettings.onclick=()=>persist(b=>{
    b.currency=clean(currency.value).toUpperCase()||'EUR';
    b.taxRatePct=Math.max(0,Math.min(100,Number(tax.value)||0));
    b.defaultMarginPct=Math.max(0,Math.min(99.99,Number(margin.value)||0));
    b.scope=scope.value;
  },'budget-settings');
  card.append(settings,saveSettings);

  const t=report.totals,stats=el('div','stats');
  for(const [value,label] of [
    [report.counts.lines,'Líneas BOM'],[report.counts.unpriced,'Sin precio'],
    [money(t.year1Cost,report.currency),'Coste año 1'],[money(t.year1Price,report.currency),'Venta año 1'],
    [t.grossMarginPct+'%','Margen bruto'],[money(t.monthlyRecurringPrice,report.currency),'OPEX/mes']
  ]){const x=el('div');x.append(el('b','',value),el('span','',label));stats.append(x);}
  card.append(stats);
  card.append(el('div','co '+(report.counts.unpriced?'co-ac':'co-gn'),
    report.counts.unpriced?report.counts.unpriced+' línea(s) derivadas todavía sin precio.':'Toda la BOM incluida tiene precio.'));

  if(validation.issues.length){
    const issues=el('div');issues.style.marginTop='8px';
    validation.issues.slice(0,12).forEach(i=>issues.append(el('div','hint',(i.blocking?'✗ ':'⚠ ')+i.message)));
    card.append(issues);
  }

  const pricing=el('div','card');pricing.style.marginTop='12px';pricing.append(el('div','card-t','Precios por recurso / modelo'));
  const lineSelect=select(report.lines.map(x=>[x.resourceRef,(x.priced?'✓ ':'○ ')+x.category+' · '+x.description+' · '+x.resourceRef]));lineSelect.id='budgetLineSelect';
  if(!report.lines.length){const o=el('option','','Sin recursos presupuestables');o.value='';lineSelect.append(o);}
  const priceScope=select([['resource','Solo este recurso'],['model','Mismo modelo']]);priceScope.id='budgetPriceScope';
  const unitCost=input('number','0.00'),unitPrice=input('number','0.00'),charge=select([['one-time','One-time'],['recurring','Recurrente']]),period=input('number','1'),classif=select([['capex','CAPEX'],['opex','OPEX']]);
  const supplier=input('text','Proveedor'),quote=input('text','Oferta / referencia'),valid=input('date'),note=input('text','Nota');
  unitCost.id='budgetUnitCost';unitPrice.id='budgetUnitPrice';charge.id='budgetChargeType';period.id='budgetBillingPeriod';classif.id='budgetCapexOpex';
  supplier.id='budgetSupplier';quote.id='budgetQuoteRef';valid.id='budgetValidUntil';note.id='budgetPriceNote';
  const grid=el('div','g2');
  grid.append(field('Recurso',lineSelect),field('Aplicar precio a',priceScope),field('Coste unitario',unitCost),field('Venta unitaria (vacío = margen objetivo)',unitPrice),field('Tipo de cargo',charge),field('Periodo meses',period),field('Clasificación',classif),field('Proveedor',supplier),field('Oferta / referencia',quote),field('Válido hasta',valid),field('Nota',note));
  pricing.append(grid);
  function selectedLine(){return report.lines.find(x=>x.resourceRef===lineSelect.value)||null;}
  function loadSelected(){
    const line=selectedLine();if(!line)return;
    priceScope.disabled=!line.modelKey;
    priceScope.value=line.pricingSource==='model'&&line.modelKey?'model':'resource';
    const raw=priceRaw(project,line,priceScope.value),resolved=B.pricingFor(project,line);
    unitCost.value=raw.unitCost!=null?raw.unitCost:resolved.unitCost||'';
    unitPrice.value=raw.unitPrice!=null?raw.unitPrice:resolved.unitPrice||'';
    charge.value=clean(raw.chargeType)||resolved.chargeType||line.defaultChargeType||'one-time';
    period.value=raw.billingPeriodMonths||resolved.billingPeriodMonths||1;
    classif.value=clean(raw.capexOpex)||resolved.capexOpex||line.defaultCapexOpex||'capex';
    supplier.value=clean(raw.supplier||resolved.supplier);quote.value=clean(raw.quoteRef||resolved.quoteRef);valid.value=clean(raw.validUntil||resolved.validUntil);note.value=clean(raw.note||resolved.note);
  }
  lineSelect.onchange=loadSelected;priceScope.onchange=loadSelected;loadSelected();
  const row=el('div','brow'),savePrice=el('button','btn bp','💾 Guardar precio'),clearPrice=el('button','btn bs','🗑 Quitar precio');
  savePrice.id='budgetSavePrice';clearPrice.id='budgetClearPrice';savePrice.type=clearPrice.type='button';
  savePrice.onclick=()=>{
    const line=selectedLine();if(!line)return;
    const payload={
      chargeType:charge.value,billingPeriodMonths:Math.max(1,Math.round(Number(period.value)||1)),capexOpex:classif.value,
      supplier:clean(supplier.value),quoteRef:clean(quote.value),validUntil:clean(valid.value),note:clean(note.value)
    };
    if(clean(unitCost.value)!=='')payload.unitCost=Math.max(0,Number(unitCost.value)||0);
    if(clean(unitPrice.value)!=='')payload.unitPrice=Math.max(0,Number(unitPrice.value)||0);
    persist(b=>{
      b.resourcePricing=obj(b.resourcePricing);b.modelPricing=obj(b.modelPricing);
      if(priceScope.value==='model'&&line.modelKey){
        b.modelPricing[line.modelKey]=payload;
        delete b.resourcePricing[line.resourceRef];
      }else b.resourcePricing[line.resourceRef]=payload;
    },'budget-price');
  };
  clearPrice.onclick=()=>{
    const line=selectedLine();if(!line)return;
    persist(b=>{
      b.resourcePricing=obj(b.resourcePricing);b.modelPricing=obj(b.modelPricing);
      if(priceScope.value==='model'&&line.modelKey)delete b.modelPricing[line.modelKey];
      else delete b.resourcePricing[line.resourceRef];
    },'budget-price-clear');
  };
  row.append(savePrice,clearPrice);pricing.append(row);card.append(pricing);

  const services=el('div','card');services.style.marginTop='12px';services.append(el('div','card-t','Licencias, servicios, mano de obra y desplazamientos'));
  const sCategory=select([['Licencia','Licencia'],['Suscripción','Suscripción'],['Mano de obra','Mano de obra'],['Desplazamiento','Desplazamiento'],['Servicio','Servicio'],['Otro','Otro']]);sCategory.id='budgetServiceCategory';
  const sDesc=input('text','Descripción'),sQty=input('number','1'),sUnit=input('text','h / ud / día / año'),sCost=input('number','0'),sPrice=input('number','0');
  sDesc.id='budgetServiceDescription';sQty.id='budgetServiceQuantity';sUnit.id='budgetServiceUnit';sCost.id='budgetServiceCost';sPrice.id='budgetServicePrice';
  const sCharge=select([['one-time','One-time'],['recurring','Recurrente']]),sPeriod=input('number','1'),sClass=select([['capex','CAPEX'],['opex','OPEX']]);
  const sRef=select([['','— sin vínculo —'],...report.lines.filter(x=>x.resourceKind!=='service').map(x=>[x.resourceRef,x.description+' · '+x.resourceRef])]);
  sCharge.id='budgetServiceChargeType';sPeriod.id='budgetServicePeriod';sClass.id='budgetServiceCapexOpex';sRef.id='budgetServiceResourceRef';
  const sGrid=el('div','g2');sQty.value='1';sPeriod.value='1';sClass.value='opex';
  sGrid.append(field('Categoría',sCategory),field('Descripción',sDesc),field('Cantidad',sQty),field('Unidad',sUnit),field('Coste unitario',sCost),field('Venta unitaria',sPrice),field('Tipo de cargo',sCharge),field('Periodo meses',sPeriod),field('CAPEX/OPEX',sClass),field('Vincular a recurso',sRef));
  services.append(sGrid);
  const addService=el('button','btn bp','＋ Añadir línea');addService.id='budgetAddService';addService.type='button';
  addService.onclick=()=>{
    if(!clean(sDesc.value))return root.alert&&root.alert('Describe la línea de servicio.');
    persist(b=>{
      b.serviceLines=arr(b.serviceLines);
      b.serviceLines.push({
        id:'svc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
        category:sCategory.value,description:clean(sDesc.value),quantity:Math.max(0.01,Number(sQty.value)||1),unit:clean(sUnit.value)||'ud',
        unitCost:Math.max(0,Number(sCost.value)||0),unitPrice:Math.max(0,Number(sPrice.value)||0),
        chargeType:sCharge.value,billingPeriodMonths:Math.max(1,Math.round(Number(sPeriod.value)||1)),capexOpex:sClass.value,resourceRef:sRef.value
      });
    },'budget-service-add');
  };
  services.append(addService);
  const list=el('div');list.style.marginTop='8px';
  for(const svc of cfg.serviceLines){
    const r=el('div','row');r.style.cssText='padding:6px 0;border-top:1px solid rgba(127,127,127,.2)';
    r.append(el('span','',clean(svc.description)||svc.id));
    const del=el('button','btn bs bsm','Eliminar');del.type='button';del.onclick=()=>persist(b=>{b.serviceLines=arr(b.serviceLines).filter(x=>x&&x.id!==svc.id);},'budget-service-delete');r.append(del);list.append(r);
  }
  services.append(list);card.append(services);

  const tableWrap=el('div','tw'),table=el('table'),thead=el('thead'),hr=el('tr');
  ['Categoría','Descripción','Cant.','Coste','Venta','Tipo','CAPEX/OPEX','Margen'].forEach(x=>hr.append(el('th','',x)));thead.append(hr);table.append(thead);
  const tbody=el('tbody');
  for(const x of report.lines.slice(0,300)){
    const tr=el('tr');
    [x.category,x.description,x.quantity+' '+x.unit,x.priced?money(x.totalCost,report.currency):'—',x.priced?money(x.totalPrice,report.currency):'SIN PRECIO',x.chargeType,x.capexOpex,x.priced?x.grossMarginPct+'%':'—'].forEach(v=>tr.append(el('td','',v)));
    tbody.append(tr);
  }
  table.append(tbody);tableWrap.append(table);card.append(tableWrap);

  const exports=el('div','brow'),base=safeName(project&&project.projName);
  const csv=el('button','btn bs','⬇ Presupuesto CSV'),xlsxBtn=el('button','btn bp','⬇ Presupuesto XLSX'),md=el('button','btn bs','⬇ Resumen Markdown');
  csv.type=xlsxBtn.type=md.type='button';
  csv.onclick=()=>download(base+'-presupuesto.csv',B.toCsv(snapshot()),'text/csv;charset=utf-8');
  xlsxBtn.onclick=()=>download(base+'-presupuesto.xlsx',B.buildXlsx(snapshot()),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  md.onclick=()=>download(base+'-presupuesto.md',B.markdown(snapshot()),'text/markdown;charset=utf-8');
  exports.append(csv,xlsxBtn,md);card.append(exports);
  return card;
}
function inject(){
  const d=doc();if(!d||!engine())return;
  const host=d.getElementById('pg-physical');if(!host)return;
  let mount=d.getElementById('budgetMount');
  if(!mount){mount=d.createElement('div');mount.id='budgetMount';host.append(mount);}
  mount.textContent='';mount.append(render(snapshot()));
}
const api={version:'netwizard-budget-ui-v1',render,inject,persist};
root.NetWizardBudgetUi=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(inject,0));else root.setTimeout(inject,0);
  root.document.addEventListener('nw:project:changed',()=>root.setTimeout(inject,0));
}
})(typeof window!=='undefined'?window:globalThis);
