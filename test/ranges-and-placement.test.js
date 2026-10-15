import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nRangeTables,nRangeTableSource} from '../src/n-range-tables.js';
import {pumps,catalogueCurve} from '../src/pumps.js';
import {calculate,defaults} from '../src/calculations.js';
import {pipePlacement,pipePlacementChecks} from '../src/pipe-placement.js';
import {wellDiagram,wellLayout} from '../src/diagram.js';
const p=extra=>({...structuredClone(defaults),...extra});
const check=(r,id)=>r.checks.find(c=>c.id===id);

test('16 N-család 96 tartománypontja azonosítható PDF-forrásból, alsó és felső H-val',async()=>{
 const pdf=await readFile(new URL('../docs/flygt-n-3000-tartomanyok.pdf',import.meta.url));
 assert.equal(createHash('sha256').update(pdf).digest('hex'),nRangeTableSource.sha256);
 assert.equal(nRangeTables.length,16);assert.equal(nRangeTables.reduce((sum,t)=>sum+t.rows.length,0),96);
 assert.equal(nRangeTableSource.allowedForDutyCalculation,false);
 for(const table of nRangeTables){
  assert.equal(table.rows.length,6);assert.ok(table.rows[0].qLps>0);
  table.rows.forEach((row,i)=>{assert.ok(row.hMaxM>=row.hMinM);assert.ok(Math.abs(row.qM3h-row.qLps*3.6)<1e-8);if(i)assert.ok(row.qLps>table.rows[i-1].qLps);});
  const pump=pumps.find(p=>p.id===table.id);assert.equal(pump.rangeTable,table);assert.equal(pump.curve,null);assert.equal(catalogueCurve(pump.id),null);
 }
});
test('N 3085: ugyanahhoz a Q-hoz két eltérő határmagasság tartozik, nem egy gyártói görbepont',()=>{
 const table=nRangeTables.find(t=>t.id==='3085');assert.equal(table.pdfPage,7);
 assert.deepEqual(table.rows[1],{qLps:7.6,qM3h:27.36,hMinM:4.8,hMaxM:17});
 assert.deepEqual(table.rows.at(-1),{qLps:45,qM3h:162,hMinM:3,hMaxM:4.8});
});
test('Befolyó: pontosan 1 m felsőpalást-takarás megfelel, a kisebb nem; a fenékszint változatlan',()=>{
 const base=p({groundElevation:104.2,inletElevation:103,inletCrownElevation:103.2});
 const valid=calculate(base);assert.equal(check(valid,'inlet-cover').status,'pass');assert.equal(valid.parameters.inletElevation,103);
 const failed=calculate({...base,groundElevation:104.1999});assert.equal(check(failed,'inlet-cover').status,'fail');assert.match(check(failed,'inlet-cover').detail,/Hiány/);
});
test('Befolyó: az ismeretlen felső palást nem nulla átmérő, a túl magas fenékszint önmagában hibát bizonyít',()=>{
 assert.equal(check(calculate(p({groundElevation:104.2})),'inlet-cover').status,'pending');
 assert.equal(check(calculate(p({groundElevation:103.9})),'inlet-cover').status,'fail');
 assert.equal(check(calculate(p()),'inlet-cover').status,'pending');
 assert.throws(()=>calculate(p({inletCrownElevation:102.9})),/felső palást/);
});
test('A helyi nyomócső-kilépés és a távoli végpont magassága különböző adat; az 1 m követelmény ellenőrzött',()=>{
 const base=p({groundElevation:104.2,inletCrownElevation:103.2}),r=calculate(base),g=r.geometry;
 const location=pipePlacement(r.parameters,g);assert.ok(Math.abs(location.pressureCrownElevation-103.2)<1e-10);assert.equal(check(r,'pressure-cover').status,'pass');
 assert.equal(check(calculate({...base,pressureExitCover:0.9}),'pressure-cover').status,'fail');
 const changed=calculate({...base,outletElevation:109});assert.equal(pipePlacement(changed.parameters,changed.geometry).pressureCrownElevation,location.pressureCrownElevation);
 const lower=calculate({...base,pressureExitCover:1.1});assert.equal(r.hydraulics.operating[0].head,lower.hydraulics.operating[0].head);
 const cramped=calculate({...base,pressureExitCover:base.groundElevation-g.floorElevation-0.05});assert.equal(check(cramped,'pressure-cover').status,'fail');assert.match(check(cramped,'pressure-cover').detail,/csőmagasság sem fér el/);
 const invalid=calculate({...base,pressureExitCover:20});assert.equal(check(invalid,'pressure-cover').status,'fail');assert.match(check(invalid,'pressure-cover').detail,/aknafenéken vagy alatta/);
});
test('A terep nélküli rajz nem állít valós kilépési mBf szintet; a terep egyenes és a nyomócső átér a falon',()=>{
 const r=calculate(p()),svg=wellDiagram(r.geometry,r.parameters);
 assert.match(svg,/Terepszint nélkül vázlatos/);assert.match(svg,/class="terrain-line" d="M[\d. -]+H[\d.]+M[\d. -]+H[\d.]+"/);
 assert.match(svg,/class="pressure-pipe"[^>]+H618/);assert.ok(!svg.includes('NaN'));
 assert.equal(pipePlacementChecks(r.parameters,null).find(c=>c.id==='pressure-cover').status,'pending');
});
test('Nyolc fokozat és két csőszint mellett is rendezett szintfeliratok, a méretvonalak az akna bal oldalán maradnak',()=>{
 const r=calculate(p({workingCount:8,maxParallel:8,manualFlows:[20,25,30,35,40,45,50,55],diameter:2,reserveHours:40,maxDrawdown:10,maxDepthBelowInlet:20,groundElevation:104.2,inletCrownElevation:103.2}));
 const layout=wellLayout(r.geometry,r.parameters),svg=wellDiagram(r.geometry,r.parameters);
 for(let i=1;i<layout.levels.length;i++)assert.ok(layout.levels[i].labelY-layout.levels[i-1].labelY>=37.999);
 for(const match of svg.matchAll(/class="floor-dimension"[^>]+><path d="M([\d.]+)/g))assert.ok(Number(match[1])<300);
 assert.match(svg,/Nyomócső kilépés · felső palást/);assert.match(svg,/Befolyócső felső palástja/);
});
