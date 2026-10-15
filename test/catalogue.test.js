import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pumps,catalogueCurve} from '../src/pumps.js';
import {catalogueSource,catalogueTables} from '../src/pump-catalogue.js';
import {calculate,defaults} from '../src/calculations.js';
import {operatingPoint,systemHead,pumpHead} from '../src/hydraulics.js';

const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
const preset=(id,overrides={})=>({...structuredClone(defaults),pumpId:id,curveModelId:id,flowMode:'curve',curveSource:'catalogue',...overrides});

test('A 30 numerikus táblázat azonosítható PDF-forráshoz és egyedi típushoz kötött',async()=>{
  const source=await readFile(new URL('../docs/flygt-szennyviz-szivattyugorbek.pdf',import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),catalogueSource.sha256);
  assert.equal(catalogueTables.length,30);assert.equal(new Set(catalogueTables.map(c=>c.id)).size,30);
  assert.equal(new Set(catalogueTables.map(c=>c.family)).size,8);
  assert.equal(catalogueTables.reduce((n,c)=>n+c.qLps.length,0),289);
  assert.equal(catalogueSource.originalCatalogueVerified,false);
});
test('Mind a 289 Q pont helyes L/s → m³/h átváltással és változatlan H-val kerül át',()=>{
  for(const table of catalogueTables){
    const pump=pumps.find(p=>p.id===table.id);
    assert.equal(pump.curve.points.length,table.qLps.length);assert.equal(table.qLps.length,table.headM.length);
    for(let i=0;i<table.qLps.length;i++){near(pump.curve.points[i].q,table.qLps[i]*3.6);near(pump.curve.points[i].h,table.headM[i]);}
    assert.equal(pump.maxStarts,null);assert.equal(pump.discharge,null);
  }
});
test('A PDF kritikus szélsőpontjai és a HF-változat nem keverednek',()=>{
  const sx=pumps.find(p=>p.id==='sx-2').curve;
  near(sx.points[1].q,1.44);near(sx.points[1].h,6.3);near(sx.points.at(-1).q,7.92);near(sx.points.at(-1).h,2);
  const normal=pumps.find(p=>p.id==='dxg-25-11').curve,hf=pumps.find(p=>p.id==='dxg-25-11-hf').curve;
  near(normal.headM[0],25);near(hf.headM[0],16.7);near(normal.points.at(-1).q,6.12);near(hf.points.at(-1).q,10.8);
  assert.equal(normal.pdfPage,23);assert.equal(hf.pdfPage,24);
  const last=pumps.find(p=>p.id==='dlv-50-15').curve;near(last.points.at(-1).q,36);near(last.points.at(-1).h,4);assert.equal(last.pdfPage,40);
});
test('Mind a 30 görbén visszakapjuk a dokumentum közölt Q–H pontját illesztett rendszerrel',()=>{
  for(const pump of pumps.filter(p=>p.curve)){
    const target=pump.curve.points[Math.floor(pump.curve.points.length/2)],water=100;
    const p={...structuredClone(defaults),outletElevation:water};
    const losses=systemHead(p,target.q,water).head;
    p.outletElevation=water+target.h-losses;
    const op=operatingPoint(p,pump.curve.points,1,water);
    near(op.flow,target.q,1e-6);near(op.head,target.h,1e-6);
  }
});
test('Katalógusválasztás önálló automatikus munkapontot és forrást ad',()=>{
  const r=calculate(preset('dx-50-11'));
  assert.ok(r.hydraulics.operating[0].flow>0);
  near(pumpHead(r.hydraulics.points,r.hydraulics.operating[0].perPump),r.hydraulics.operating[0].head);
  assert.equal(r.hydraulics.curveProvenance.pdfPage,15);assert.equal(r.hydraulics.curveProvenance.cataloguePage,25);
  assert.equal(r.hydraulics.curveProvenance.verification,'uploaded-numeric-tables-only');
  assert.equal(r.checks.find(c=>c.id==='curve-source').status,'pending');
});
test('A beépített adatsort nem hamisítja át a projekt szabad szövegű curveText mezője',()=>{
  const r=calculate(preset('dx-50-11',{curveText:'0;999\n100;998\n200;997',curveLabel:'Forged label'}));
  assert.notEqual(r.parameters.curveLabel,'Forged label');near(r.hydraulics.points[0].h,12.7);
  assert.equal(r.hydraulics.curveProvenance.model,'DX 50-11');
});
test('A családok indítási korlátja nem öröklődik át; a külön megadott gyártói korlát érvényesül',()=>{
  const unknown=calculate(preset('dx-50-11',{startsLimit:25}));near(unknown.geometry.limit,25);
  assert.equal(unknown.checks.find(c=>c.id==='manufacturer-starts').status,'pending');
  const known=calculate(preset('dx-50-11',{startsLimit:25,manufacturerStartsLimit:8,utilityStartsLimit:6}));near(known.geometry.limit,6);
  assert.ok(!known.checks.some(c=>c.id==='manufacturer-starts'));
});
test('A hiányzó N/C/F/Concertor görbe nem helyettesíthető kisebb családéval',()=>{
  for(const id of ['3085','3531','c-series','f-series','concertor']){
    assert.equal(catalogueCurve(id),null);assert.throws(()=>calculate(preset(id)),/nincs beépített/);
  }
});
test('Táblázatos tartományon kívül nincs extrapoláció',()=>{
  assert.throws(()=>calculate(preset('dxg-25-15')),/kívülre/);
  const pump=pumps.find(p=>p.id==='dx-50-11');
  assert.throws(()=>operatingPoint({...defaults,outletElevation:150},pump.curve.points,1,100),/zárási/);
});
test('Az SX/STA kiválasztása nem igazolja automatikusan a nyersszennyvíz-alkalmasságot',()=>{
  const r=calculate(preset('sx-3'));assert.equal(r.checks.find(c=>c.id==='pump-application').status,'pending');
});
test('Egyedi szerkesztés forrásjelölése elkülönül a beépített, zárolt táblázattól',()=>{
  const c=catalogueCurve('dx-50-11');const r=calculate(preset('dx-50-11',{curveSource:'manual',curveText:c.text,curveLabel:'Egyedi módosított adatsor'}));
  assert.equal(r.hydraulics.curveProvenance.verification,'user-entered');assert.ok(!r.checks.some(c=>c.id==='curve-source'));
});
