import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculate,defaults,migrateProject,formatVelocity} from '../src/calculations.js';
import {systemHead} from '../src/hydraulics.js';
import {selectPumps} from '../src/selection.js';
import {wellLayout,wellDiagram} from '../src/diagram.js';
import {pumps,catalogueCurve} from '../src/pumps.js';
const params=extra=>({...structuredClone(defaults),...extra});
const check=(r,id)=>r.checks.find(c=>c.id===id);
const flowFor=v=>v*Math.PI*(0.15**2)/4*3600;

test('A 0 minimum és az üres felső időkeret külön jelentésű; a 0 felső határ is megadható',()=>{
  const r=calculate(params());assert.equal(r.parameters.residenceMinimum,0);assert.equal(r.parameters.residenceLimit,'');
  assert.equal(check(r,'residence-minimum').status,'pass');assert.equal(check(r,'residence').status,'pending');
  assert.equal(check(calculate(params({residenceLimit:0,upstreamMinutes:0})),'residence').status,'fail');
  assert.throws(()=>calculate(params({residenceMinimum:20,residenceLimit:10})),/minimum tartózkodási/);
});
test('Pozitív minimum a kifolyó víz legkisebb FIFO-korára, ismert előzménnyel vizsgálandó',()=>{
  const p=params({profile:'custom',hourly:Array(24).fill(1),daily:120,upstreamMinutes:0}),r=calculate(p),min=r.simulation.systemFifoMinMinutes;
  assert.ok(min>0&&min<r.simulation.systemFifoMaxMinutes);
  assert.equal(check(calculate({...p,residenceMinimum:min/2}),'residence-minimum').status,'pass');
  assert.equal(check(calculate({...p,residenceMinimum:min+5}),'residence-minimum').status,'fail');
  assert.equal(check(calculate({...p,residenceMinimum:min+5,upstreamMinutes:''}),'residence-minimum').status,'pending');
});
test('Általános lakóépület nem feltételez négy főt vagy egynapi tartalékot; egyedi profilt is elfogad',()=>{
  const hourly=Array(24).fill(0);hourly[7]=1;
  const r=calculate(params({application:'house',daily:0.6,reserveHours:0,manualFlows:[2],profile:'custom',hourly,minRunSeconds:0,minDrawdown:0.01}));
  assert.equal(r.geometry.targetReserve,0);assert.ok(r.geometry.active<0.2);assert.equal(r.profile[0],0);assert.equal(r.profile[28],0.6);
  assert.equal(check(r,'fcsm').status,'pending');
  const old=migrateProject({version:2,parameters:{application:'house'}});assert.equal(old.parameters.fcsmSingleDwelling,'yes');
  const modern=migrateProject({version:2,parameters:{application:'house',fcsmSingleDwelling:'no',residenceLimit:''}});assert.equal(modern.parameters.fcsmSingleDwelling,'no');assert.equal(modern.parameters.residenceLimit,'');
});
test('0,3 és 0,5 m/s közötti üzemi sebesség megfelel; a pontos MI-határok is elfogadottak',()=>{
  for(const v of [0.3,0.35,0.5,5]){
    const r=calculate(params({manualFlows:[flowFor(v)]}));assert.equal(check(r,'velocity').status,'pass');assert.ok(Math.abs(r.hydraulics.velocityRange.min-v)<1e-12);
  }
});
test('Kerekítve 0,30 sebesség lehet határon kívül; több fokozatból az alacsonyat is megnevezzük',()=>{
  const r=calculate(params({workingCount:2,maxParallel:2,manualFlows:[flowFor(0.2995),flowFor(0.5)]}));
  assert.equal(check(r,'velocity').status,'fail');assert.match(check(r,'velocity').detail,/1 gép \(0,2995/);
  assert.ok(Math.abs(r.hydraulics.operating[1].velocityLow-0.5)<1e-12);
});
test('A négy tizedes mögé rejtőző MI-határsértés is látszik a feliraton',()=>{
  assert.ok(Number(formatVelocity(0.29999999).replace(',','.'))<0.3);assert.ok(Number(formatVelocity(5.00001).replace(',','.'))>5);
  assert.equal(formatVelocity(0.35),'0,3500');
});
test('Középvízszinten 0,3 fölötti automatikus munkapont mellett az alsó szint sértheti az MI-t',()=>{
  // Known geometry: a 0.4 m stage, fixed well diameter, no emergency volume beyond alarm minimum.
  const base=params({diameter:1.2,minDrawdown:0.4,minRunSeconds:0,startsLimit:100,reserveHours:0,pipeLength:0});
  const manual=calculate({...base,manualFlows:[flowFor(0.303)]}),g=manual.geometry;
  const q=flowFor(0.303),water=g.floorElevation+(g.stop+g.start)/2,h=systemHead(base,q,water).head;
  const r=calculate({...base,flowMode:'curve',curveLabel:'Synthetic regression, not a Flygt curve',curveText:`0;${h+2}\n${q};${h}\n${q*2};0`});
  assert.ok(r.hydraulics.operating[0].velocity>0.3);assert.ok(r.hydraulics.operating[0].velocityLow<0.3);assert.equal(check(r,'velocity').status,'fail');
});
test('A külön sebességkövetelmény nem írja felül az MI 5 m/s maximumát',()=>{
  const r=calculate(params({manualFlows:[flowFor(6)],projectVelocityMax:7}));
  assert.equal(check(r,'velocity').status,'fail');assert.equal(check(r,'project-velocity').status,'pass');
  const strict=calculate(params({manualFlows:[flowFor(0.4)],projectVelocityMin:0.7}));assert.equal(check(strict,'velocity').status,'pass');assert.equal(check(strict,'project-velocity').status,'fail');
});
test('Előválasztás valós görbékre, a névleges P₂ szerint; a legjobb alkalmazása ugyanazt a munkapontot adja',()=>{
  const p=params(),s=selectPumps(p),eligible=s.candidates.filter(c=>c.eligible&&!c.estimated);assert.ok(eligible.length>0);assert.equal(s.best,eligible[0]);
  assert.ok(eligible.every(c=>c.minFlow>=c.requiredFlow&&c.velocityRange.min>=0.3&&c.velocityRange.max<=5));
  for(let i=1;i<eligible.length;i++)assert.ok(eligible[i].totalNominalKw>=eligible[i-1].totalNominalKw);
  const r=calculate({...p,pumpId:s.best.id,curveModelId:s.best.id,flowMode:'curve',curveSource:'catalogue'});
  assert.ok(Math.abs(r.hydraulics.operating[0].flow-s.best.flow)<1e-8);assert.ok(s.best.pending.some(p=>/gyártói indítási/.test(p)));
  assert.ok(s.candidates.some(c=>c.id==='3800'&&c.estimated));assert.ok(s.excluded.some(c=>c.id==='sx-2'));
});
test('Nincs találat esetén indokok láthatók; a hidegtartalék nem javítja a rangsort',()=>{
  const p=params({daily:10000}),s=selectPumps(p);assert.equal(s.best,null);assert.ok(s.candidates.every(c=>!c.eligible&&c.reasons.length));
  const a=selectPumps(params({standbyCount:0})),b=selectPumps(params({standbyCount:8,manufacturerStartsLimit:1}));
  assert.equal(a.best.id,b.best.id);assert.equal(a.best.active,b.best.active); // model-specific limit never transfers to alternatives
});
test('N 3800 családadat: új forrás, pontos Q–H és igazolt indítási korlát nélkül',async()=>{
  const n=pumps.filter(p=>p.group==='n');assert.equal(n.length,16);
  const last=n.find(p=>p.id==='3800');assert.equal(last.rangePage,21);assert.equal(last.maxStarts,null);assert.equal(last.page,null);assert.equal(last.power,'225–550');
  for(const p of n){assert.equal(p.curve.estimated,true);assert.equal(catalogueCurve(p.id).provenance.manufacturerCurve,false);assert.equal(p.rangeVerification,'approximate-envelope-not-for-sizing');}
  const pdf=await readFile(new URL('../docs/flygt-n-3000-tartomanyok.pdf',import.meta.url));assert.ok(pdf.subarray(0,5).equals(Buffer.from('%PDF-')));
});
test('A mély, sokfokozatú akna szintfeliratai nem fedik egymást; mBf és fenéktől mért méretek',()=>{
  const p=params({workingCount:8,maxParallel:8,manualFlows:[20,25,30,35,40,45,50,55],diameter:2,reserveHours:40,maxDrawdown:10,maxDepthBelowInlet:20,groundElevation:104});
  const r=calculate(p),layout=wellLayout(r.geometry,r.parameters),svg=wellDiagram(r.geometry,r.parameters);
  for(let i=1;i<layout.levels.length;i++)assert.ok(layout.levels[i].labelY-layout.levels[i-1].labelY>=37.999);
  assert.ok(layout.levels[0].labelY>=30);assert.ok(layout.levels.at(-1).labelY<layout.height-40);
  assert.match(svg,/104,000 mBf/);assert.match(svg,/8\. fokozat indítása/);assert.match(svg,/floor-dimension/);assert.match(svg,/Magasságok a fenéktől/);assert.ok(!svg.includes('NaN'));
  assert.throws(()=>calculate(params({groundElevation:102})),/terepszint/i);
});
