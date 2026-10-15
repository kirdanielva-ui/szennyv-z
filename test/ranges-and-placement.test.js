import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nRangeTables,nRangeTableSource} from '../src/n-range-tables.js';
import {pumps,catalogueCurve} from '../src/pumps.js';
import {calculate,defaults,migrateProject} from '../src/calculations.js';
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
test('Befolyó fenékszintje: pontosan 1 m megfelel, kisebb mélység hibás; külön palástadat nem kell',()=>{
 const base=p({groundElevation:104,inletElevation:103});
 const valid=calculate(base);assert.equal(check(valid,'inlet-depth').status,'pass');assert.equal(valid.parameters.inletElevation,103);
 const failed=calculate({...base,groundElevation:103.9999});assert.equal(check(failed,'inlet-depth').status,'fail');assert.match(check(failed,'inlet-depth').detail,/Hiány/);
 assert.equal(check(calculate({...base,inletCrownElevation:103.5}),'inlet-depth').status,'pass');
});
test('Terepszint nélkül a tényleges szintkülönbség nem igazolható; ismert 0,9 m hiba',()=>{
 assert.equal(check(calculate(p({groundElevation:103.9})),'inlet-depth').status,'fail');
 assert.equal(check(calculate(p()),'inlet-depth').status,'pending');
 assert.equal(check(calculate(p()),'pressure-depth').status,'pending');
});
test('A helyi nyomócsőtengely és a távoli végpont külön adat; az 1 m tengelymélység ellenőrzött',()=>{
 const base=p({groundElevation:104}),r=calculate(base),g=r.geometry;
 const location=pipePlacement(r.parameters,g);assert.equal(location.pressureCenterElevation,103);assert.equal(check(r,'pressure-depth').status,'pass');
 assert.equal(check(calculate({...base,pressureExitDepth:0.9999}),'pressure-depth').status,'fail');
 const changed=calculate({...base,outletElevation:109});assert.equal(pipePlacement(changed.parameters,changed.geometry).pressureCenterElevation,location.pressureCenterElevation);
 const lower=calculate({...base,pressureExitDepth:1.1});assert.equal(r.hydraulics.operating[0].head,lower.hydraulics.operating[0].head);
 const cramped=calculate({...base,pressureExitDepth:base.groundElevation-g.floorElevation-0.05});assert.equal(check(cramped,'pressure-depth').status,'fail');assert.match(check(cramped,'pressure-depth').detail,/csőmagasság sem fér el/);
 const invalid=calculate({...base,pressureExitDepth:20});assert.equal(check(invalid,'pressure-depth').status,'fail');assert.match(check(invalid,'pressure-depth').detail,/aknafenéken vagy alatta/);
});
test('A terep nélküli rajz nem állít valós kilépési mBf szintet; a nyomócső rajza a tengelyszinthez igazodik',()=>{
 const r=calculate(p()),svg=wellDiagram(r.geometry,r.parameters),layout=wellLayout(r.geometry,r.parameters);
 assert.match(svg,/Terepszint nélkül vázlatos/);assert.match(svg,/class="terrain-line" d="M[\d. -]+H[\d.]+M[\d. -]+H[\d.]+"/);
 assert.match(svg,/class="pressure-pipe"[^>]+H618/);assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('palást'));
 assert.ok(svg.includes(`V${layout.y(layout.placement.pressureCenter)}H618`));
 assert.equal(pipePlacementChecks(r.parameters,null).find(c=>c.id==='pressure-depth').status,'pending');
});
test('Nyolc fokozat mellett rendezett feliratok és bal oldali méretvonalak; a nyomócső tengelye feliratozott',()=>{
 const r=calculate(p({workingCount:8,maxParallel:8,manualFlows:[20,25,30,35,40,45,50,55],diameter:2,reserveHours:40,maxDrawdown:10,maxDepthBelowInlet:20,groundElevation:104.2}));
 const layout=wellLayout(r.geometry,r.parameters),svg=wellDiagram(r.geometry,r.parameters);
 for(let i=1;i<layout.levels.length;i++)assert.ok(layout.levels[i].labelY-layout.levels[i-1].labelY>=37.999);
 for(const match of svg.matchAll(/class="floor-dimension"[^>]+><path d="M([\d.]+)/g))assert.ok(Number(match[1])<300);
 assert.match(svg,/Nyomócső kilépés · csőtengely/);assert.match(svg,/Befolyócső fenékszintje/);
});
test('Régi felsőpalást-mélység importja megőrzi a korábbi tengelyszintet, és nem kéri a törölt befolyópalást-adatot',()=>{
 const old={...structuredClone(defaults),pressureExitCover:1,pipeDiameter:150,inletCrownElevation:103.2};delete old.pressureExitDepth;
 const {parameters,note}=migrateProject({version:2,parameters:old});
 assert.equal(parameters.pressureExitDepth,1.075);assert.ok(!Object.hasOwn(parameters,'inletCrownElevation'));assert.ok(!Object.hasOwn(parameters,'pressureExitCover'));assert.match(note,/tengelyszint megmaradt/);
 const modern=migrateProject({version:2,parameters:{pressureExitDepth:1,pressureExitCover:1.2}});assert.equal(modern.parameters.pressureExitDepth,1);
});
test('Hiányos korábbi csőadatból nem találunk ki tengelymélységet',()=>{
 const {parameters,note}=migrateProject({version:2,parameters:{pressureExitCover:1,pipeDiameter:''}});
 assert.equal(parameters.pressureExitDepth,'');assert.match(note,/hiányos csőadatok/);
});
