import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {calculate,defaults,migrateProject,validate} from '../src/calculations.js';
import {selectPumps} from '../src/selection.js';
import {pumps} from '../src/pumps.js';
import {nRangeImages,nRangeSource} from '../src/n-range-images.js';
const params=p=>({...structuredClone(defaults),...p});
const geometryCheck=r=>r.checks.find(c=>c.id==='geometry');
test('Külön átmérőhiba: megadott és szükséges méret, a hiány és a javítás látható',()=>{
  const r=calculate(params({diameter:0.8,minDiameter:1.2,reserveHours:0,maxDepthBelowInlet:20,maxDrawdown:5}));
  assert.deepEqual(r.geometryChecks.filter(c=>!c.pass).map(c=>c.id),['diameter']);
  assert.match(geometryCheck(r).detail,/0,800 m/);assert.match(geometryCheck(r).detail,/1,200 m/);assert.match(geometryCheck(r).detail,/hiány 0,400 m/);assert.match(geometryCheck(r).detail,/automatikus/);
});
test('Kapcsolási magasság hibájánál a tényleges túllépés és térfogat/alapterület indok szerepel',()=>{
  const r=calculate(params({diameter:1.2,manualFlows:[60],maxDrawdown:0.2,maxDepthBelowInlet:20,reserveHours:0}));
  assert.deepEqual(r.geometryChecks.filter(c=>!c.pass).map(c=>c.id),['drawdown']);
  const c=r.geometryChecks.find(c=>c.id==='drawdown');assert.equal(c.actual,r.geometry.drawdown);assert.equal(c.limit,0.2);assert.match(c.detail,/túllépés/);assert.match(c.detail,/alapterület/);assert.match(c.detail,/Nagyobb aknaátmérő/);
});
test('Befolyó alatti mélység hibája a négy mélységi összetevőt is felbontja',()=>{
  const r=calculate(params({diameter:1.2,maxDepthBelowInlet:0.8}));
  assert.deepEqual(r.geometryChecks.filter(c=>!c.pass).map(c=>c.id),['depth']);
  const c=r.geometryChecks.find(c=>c.id==='depth');assert.equal(c.actual,r.geometry.inletDepth);assert.match(c.detail,/maximum 0,800 m/);assert.match(c.detail,/leállítási vízmélység/);assert.match(c.detail,/biztonsági tárolás/);assert.match(c.detail,/túllépés/);assert.match(c.detail,/legkisebb mélység is 0,850 m/);assert.match(c.detail,/nagyobb átmérő sem elég/);
});
test('Minden hibát felsorolunk; az önmagában lehetetlen szintlépcső-igényt külön indokoljuk',()=>{
  const r=calculate(params({diameter:0.8,minDiameter:1.2,workingCount:2,maxParallel:2,manualFlows:[18,30],minDrawdown:0.5,maxDrawdown:0.8,maxDepthBelowInlet:0.8}));
  assert.deepEqual(r.geometryChecks.filter(c=>!c.pass).map(c=>c.id),['diameter','drawdown','depth']);
  assert.match(geometryCheck(r).detail,/minimum szintlépcsők összege is 2/);assert.match(geometryCheck(r).detail,/pusztán nagyobb átmérő sem elég/);assert.equal(geometryCheck(r).detail.split('\n').length,3);
});
test('Az eltávolított villamos beállítás nem befolyásolja a kapcsolási térfogatot és nem öröklődik importból',()=>{
  const a=calculate(params()),b=calculate(params({utilityStartsLimit:1}));
  assert.equal(a.geometry.active,b.geometry.active);assert.ok(!b.checks.some(c=>c.id==='utility'));
  const imported=migrateProject({version:2,parameters:{utilityStartsLimit:1,selectionMargin:200,selectionDrainage:'yes'}}).parameters;
  for(const key of ['utilityStartsLimit','selectionMargin','selectionDrainage'])assert.ok(!Object.hasOwn(imported,key));
});
test('Az előválasztásnak nincs rejtett kapacitástöbblete vagy korábbi közegválasztója',()=>{
  const s=selectPumps(params({selectionMargin:200,selectionDrainage:'yes'}));
  assert.ok(s.best);for(const c of s.candidates.filter(c=>c.eligible))assert.equal(c.requiredFlow,0.9);
  assert.ok(s.excluded.some(c=>c.id==='sx-2'));assert.ok(!Object.hasOwn(s,'margin'));
});
test('Mind a 16 N-típus eredeti PDF-oldala beágyazott PNG-ként, azonosítható forrással rendelkezik',async()=>{
  const pdf=await readFile(new URL('../docs/flygt-n-3000-tartomanyok.pdf',import.meta.url));assert.equal(createHash('sha256').update(pdf).digest('hex'),nRangeSource.sha256);
  assert.equal(Object.keys(nRangeImages).length,16);
  for(const pump of pumps.filter(p=>p.group==='n')){
    assert.equal(pump.rangeImage,nRangeImages[pump.id]);const bytes=Buffer.from(pump.rangeImage.split(',')[1],'base64');
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(pump.rangeProvenance.sha256,nRangeSource.sha256);assert.equal(pump.curve,null);
  }
});
test('Az N-típusnézet bemenetei görbe nélkül validálhatók, de pontos munkapontot nem gyártunk',()=>{
  const p=params({pumpId:'3085',flowMode:'curve',curveSource:'catalogue',curveModelId:'3085'});
  assert.equal(validate(p,{requireCurve:false}).pumpId,'3085');assert.throws(()=>calculate(p),/nincs beépített/);
});
