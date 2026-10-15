import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pumps,catalogueCurve} from '../src/pumps.js';
import {nRangeTableSource} from '../src/n-range-tables.js';
import {calculate,defaults,migrateProject} from '../src/calculations.js';
import {parseCurve,pumpHead,operatingPoint,systemHead} from '../src/hydraulics.js';
import {selectPumps} from '../src/selection.js';
const params=(id,extra={})=>({...structuredClone(defaults),pumpId:id,curveModelId:id,flowMode:'curve',curveSource:'catalogue',...extra});
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const nPumps=pumps.filter(p=>p.group==='n');
function fixture(pump){
 const points=pump.curve.points,q=points[2].q;
 return params(pump.id,{pipeDiameter:Math.sqrt(q/3600/1.5*4/Math.PI)*1000,pipeLength:20,
  outletElevation:103+(points[0].h+points.at(-1).h)/2,diameter:10,minRunSeconds:0,minDrawdown:0.01,
  maxDepthBelowInlet:20,maxDrawdown:10,reserveHours:0,profile:'custom',hourly:Array(24).fill(1),daily:q*2});
}
test('Mind a 16 N-modell középvonalból készül, becsültként azonosított és nem tartalmaz kitalált Q=0 pontot',()=>{
 assert.equal(nPumps.length,16);
 for(const pump of nPumps){
  assert.equal(pump.curve.estimated,true);assert.equal(pump.curve.powerKw,null);assert.equal(pump.curve.points.length,5);
  const preset=catalogueCurve(pump.id);assert.match(preset.label,/BECSÜLT/);assert.equal(preset.provenance.manufacturerCurve,false);assert.equal(preset.provenance.estimated,true);assert.equal(preset.provenance.sha256,nRangeTableSource.sha256);
  const points=parseCurve(preset.text,{allowBounded:true});assert.ok(points[0].q>0);assert.throws(()=>parseCurve(preset.text),/Q = 0/);
  for(const point of points){const row=pump.rangeTable.rows.find(row=>row.qM3h===point.q);near(point.h,(row.hMinM+row.hMaxM)/2);}
  assert.equal(pumpHead(points,0),null);assert.equal(pumpHead(points,points.at(-1).q+1),null);
 }
});
test('N 3085 ismert modellpontjai: ténylegesen a csökkenő középág, a felmenő rész elhagyva',()=>{
 const points=pumps.find(p=>p.id==='3085').curve.points;
 assert.deepEqual(points[0],{q:27.36,h:10.9});assert.deepEqual(points[2],{q:104.976,h:7.9});assert.deepEqual(points.at(-1),{q:162,h:3.9});
});
test('Mind a 16 N-család teljes számítása: Q–H metszés, akna, kapcsolási szint, FIFO és vízmérleg',()=>{
 for(const pump of nPumps){
  const r=calculate(fixture(pump));assert.equal(r.hydraulics.estimated,true);
  const op=r.hydraulics.operating[0];near(pumpHead(r.hydraulics.points,op.perPump),op.head);assert.ok(op.flow>=pump.curve.range.minQ&&op.flow<=pump.curve.range.maxQ);
  assert.ok(r.geometry.active>0);assert.equal(r.geometry.startLevels.length,1);near(r.geometry.floorElevation+r.geometry.inletDepth,r.parameters.inletElevation);
  assert.equal(r.simulation.series.length,1441);assert.ok(r.simulation.series.some(d=>d.on===1));assert.ok(Math.abs(r.simulation.balanceError)<1e-6);
  assert.equal(r.checks.find(c=>c.id==='duty').status,'pending');assert.match(r.checks.find(c=>c.id==='curve-source').title,/Becsült/);
 }
});
test('Automatikus átmérő mind a 16 N-modellnél a teljes kapcsolási tartományban számítható munkapontot választ',()=>{
 for(const pump of nPumps){
  const r=calculate({...fixture(pump),diameter:'auto'});assert.ok(r.geometry.fits,pump.id);
  for(const stage of r.hydraulics.operating){assert.ok(stage.flowLow>=pump.curve.range.minQ);assert.ok(stage.flowHigh<=pump.curve.range.maxQ);}
  assert.ok(Math.abs(r.simulation.balanceError)<1e-6);
 }
 // The first small N3153 well meets the geometric limits but its lower water
 // level would push the root below the model's lower Q bound. A larger well works.
 const pump=nPumps.find(p=>p.id==='3153'),input=fixture(pump);
 assert.throws(()=>calculate({...input,diameter:1.2}),/alsó Q-határ/);
 assert.ok(calculate({...input,diameter:'auto'}).geometry.diameter>1.2);
});
test('Analitikusan beállított munkapont 1–8 párhuzamos N-gépre a megadott tartományon belül visszakapható',()=>{
 const points=pumps.find(p=>p.id==='3085').curve.points,target=points[2];
 for(let count=1;count<=8;count++){
  const flow=target.q*count,water=100,p=params('3085',{pipeDiameter:Math.sqrt(flow/3600/1.5*4/Math.PI)*1000,pipeLength:20,outletElevation:water});
  p.outletElevation=water+target.h-systemHead(p,flow,water).head;
  const op=operatingPoint(p,points,count,water);near(op.flow,flow);near(op.head,target.h);
 }
});
test('Pozitív Q-tartomány végponti metszései lebegőpontos kerekítés mellett is érvényesek',()=>{
 const points=pumps.find(p=>p.id==='3085').curve.points;
 for(const target of [points[0],points.at(-1)]){
  const p=params('3085',{pipeDiameter:1000,pipeLength:20,outletElevation:100}),water=100,count=7,flow=target.q*count;
  p.outletElevation=water+target.h-systemHead(p,flow,water).head;
  const op=operatingPoint(p,points,count,water);near(op.flow,flow,1e-6);near(op.perPump,target.q,1e-6);
 }
});
test('N-modellnél az alsó/felső Q-határon túli metszést nem extrapoláljuk',()=>{
 const pump=pumps.find(p=>p.id==='3085'),points=pump.curve.points;
 assert.throws(()=>operatingPoint(params('3085',{pipeDiameter:1000,outletElevation:200}),points,1,100),/alsó Q-határ/);
 assert.throws(()=>operatingPoint(params('3085',{pipeDiameter:1000,pipeLength:0,roughnessMm:0,minorLossK:0,outletMode:'reservoir',outletElevation:100}),points,1,100),/kívülre/);
 // A narrow pressure main can make a large family model's bounded branch inaccessible.
 assert.throws(()=>calculate(params('3800')),/alsó Q-határ/);
});
test('N-párhuzamos fokozatok ténylegesen indulnak; a hidegtartalék nem változtatja a számítást',()=>{
 const base=params('3085',{workingCount:3,maxParallel:3,pipeDiameter:250,pipeLength:20,reserveHours:0,profile:'custom',hourly:Array(24).fill(1)});
 const seed=calculate(base),q=(seed.hydraulics.operating[1].flowHigh+seed.hydraulics.operating[2].flowLow)/2;
 const a=calculate({...base,daily:q*24,standbyCount:0}),b=calculate({...base,daily:q*24,standbyCount:2});
 assert.ok(a.simulation.series.some(d=>d.on===3));assert.equal(a.geometry.startLevels.length,3);assert.ok(a.hydraulics.operating[2].flow<3*a.hydraulics.operating[0].flow);
 near(a.geometry.active,b.geometry.active);assert.deepEqual(a.simulation.rollingStarts,b.simulation.rollingStarts);assert.ok(Math.abs(a.simulation.balanceError)<1e-6);
});
test('N-katalógus import és export a modell eredetét megőrzi; szabad JSON-szöveggel nem hamisítható gyári görbévé',()=>{
 const project=migrateProject({version:2,parameters:params('3085',{curveText:'0;999\n100;998\n200;0',curveLabel:'Hamis gyári címke'})});
 const r=calculate(project.parameters);assert.match(r.parameters.curveLabel,/BECSÜLT/);assert.equal(r.hydraulics.points[0].q,27.36);
 const exported=JSON.parse(JSON.stringify(r));assert.equal(exported.hydraulics.curveProvenance.verification,'estimated-family-midline-scenario');assert.equal(exported.hydraulics.curveProvenance.manufacturerCurve,false);
});
test('Az N-családmodellek részt vesznek az előválasztásban, pontos motorteljesítmény állítása nélkül',()=>{
 const s=selectPumps(params('3085')),n=s.candidates.filter(c=>c.estimated);assert.equal(n.length,16);assert.ok(n.some(c=>c.eligible));
 const eligible=n.filter(c=>c.eligible);for(const c of eligible){assert.equal(c.powerKw,null);assert.equal(c.totalNominalKw,null);assert.ok(c.powerRange);assert.ok(c.pending.some(p=>/Becsült/.test(p)));}
 for(let i=1;i<eligible.length;i++)assert.ok(eligible[i].minFlow>=eligible[i-1].minFlow);
 assert.ok(s.candidates.some(c=>!c.estimated&&c.eligible));
});
