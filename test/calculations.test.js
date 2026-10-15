import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProfile,calculate,defaults,migrateProject,validate} from '../src/calculations.js';
import {frictionFactor,systemHead,parseCurve,pumpHead,operatingPoint,GRAVITY} from '../src/hydraulics.js';
const params=overrides=>({...structuredClone(defaults),...overrides});
const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);
const check=(r,id)=>r.checks.find(c=>c.id===id);
const auto=overrides=>params({flowMode:'curve',curveText:'0;30\n20;20\n40;5\n60;0',curveLabel:'Synthetic mathematical fixture, NOT a Flygt curve',...overrides});
const uniform=overrides=>params({profile:'custom',hourly:Array(24).fill(1),...overrides});

test('Műszakok létszáma a teljes napi mennyiséget osztja el; nincs folyamatos hányad',()=>{
 const p=validate(params()),q=buildProfile(p);near(q.reduce((a,b)=>a+b,0)/4,12);near(q[24],0.9);near(q[56],0.6);near(q[1],0);assert.ok(!Object.hasOwn(defaults,'basePercent'));
});
test('Éjszakai, átfedő és tört órás műszakok pontos normálása',()=>{
 const q=buildProfile(validate(params({shifts:[{start:22.1,hours:7.3,people:10},{start:4.9,hours:8.4,people:5}]})));
 near(q.reduce((a,b)=>a+b,0)/4,12);assert.ok(q[0]>0);assert.equal(q[80],0);assert.ok(q[20]>q[24]);
});
test('Egyedi órás profil is a teljes napi mennyiségre normált',()=>{
 const hourly=Array(24).fill(0);hourly[7]=3;hourly[18]=1;const q=buildProfile(validate(params({profile:'custom',hourly})));
 near(q[0],0);near(q[28],9);near(q[72],3);near(q.reduce((a,b)=>a+b,0)/4,12);
});
test('Mindenütt nulla profil elutasítása',()=>assert.throws(()=>calculate(params({profile:'custom',hourly:Array(24).fill(0)})),/pozitív/));
test('Colebrook–White súrlódási tényező független numerikus értékkel',()=>{
 const f=frictionFactor(100000,0.001);near(f,0.02217,0.00002);near(1/Math.sqrt(f)+2*Math.log10(0.001/3.71+2.51/(100000*Math.sqrt(f))),0,1e-8);near(frictionFactor(1000,0),0.064);
});
test('Darcy–Weisbach veszteség és végponti sebességmagasság mértékegységei',()=>{
 const p=params({pipeDiameter:100,pipeLength:100,roughnessMm:0.1,minorLossK:2,outletElevation:110,backpressureHead:3});
 const h=systemHead(p,36,100),v=0.01/(Math.PI*0.1**2/4);
 near(h.velocity,v);near(h.staticHead,13);near(h.frictionLoss,h.friction*100/0.1*v*v/(2*GRAVITY));near(h.localLoss,2*v*v/(2*GRAVITY));near(h.exitVelocityHead,v*v/(2*GRAVITY));
 near(h.head,h.staticHead+h.frictionLoss+h.localLoss+h.exitVelocityHead);
 const reservoir=systemHead({...p,outletMode:'reservoir'},36,100);near(h.head-reservoir.head,h.exitVelocityHead);
});
test('Nyomócsőben tárolt térfogat valódi belső átmérőből',()=>near(systemHead(params({pipeDiameter:200,pipeLength:100}),0,100).pipeVolume,Math.PI,1e-9));
test('Q–H pontok: magyar tizedesvessző, pont, tab és CSV',()=>{
 const a=parseCurve('# source\n0;20\n10,5;15,2\n20;0');near(a[1].q,10.5);near(a[1].h,15.2);
 near(parseCurve('0,20\n10,15\n20,0')[1].q,10);near(parseCurve('0\t20\n10\t15\n20\t0')[1].h,15);
});
test('Hibás görbe és extrapoláció tiltása',()=>{
 for(const text of ['', '0;20\n10;15','1;20\n10;15\n20;0','0;20\n10;21\n20;0','0;20\n10;15\n10;0','0;20\n10;20\n20;20'])assert.throws(()=>parseCurve(text));
 assert.equal(pumpHead(parseCurve('0;20\n10;15\n20;0'),21),null);
 assert.throws(()=>operatingPoint(params({outletElevation:200}),parseCurve('0;20\n10;15\n20;0'),1,100),/zárási/);
 assert.throws(()=>operatingPoint(params({outletElevation:101}),parseCurve('0;20\n1;19\n2;18'),1,100),/kívülre/);
});
test('Analitikusan konstruált munkapont visszaadja az ismert Q-t',()=>{
 const p=params(),head=systemHead(p,20,100).head;
 const points=[{q:0,h:head+5},{q:20,h:head},{q:40,h:0}];
 const op=operatingPoint(p,points,1,100);near(op.flow,20,1e-8);near(op.head,head,1e-8);
});
test('Párhuzamos gépek közös csövön nem egyszerűen N×Q-t adnak',()=>{
 const p=params({pipeDiameter:80,pipeLength:1000}),points=parseCurve('0;30\n20;20\n40;5\n60;0');
 const one=operatingPoint(p,points,1,100),two=operatingPoint(p,points,2,100);
 assert.ok(two.flow>one.flow);assert.ok(two.flow<one.flow*2);near(pumpHead(points,two.perPump),two.head,1e-7);
});
test('Hosszabb vezeték és magasabb végpont csökkenti a munkaponti Q-t',()=>{
 const p=params(),points=parseCurve('0;30\n20;20\n40;5\n60;0'),one=operatingPoint(p,points,1,100);
 assert.ok(operatingPoint({...p,pipeLength:1000},points,1,100).flow<one.flow);
 assert.ok(operatingPoint({...p,outletElevation:112},points,1,100).flow<one.flow);
});
test('Fenékszint és mBf indítási szintek a befolyóból származnak',()=>{
 const r=calculate(params()),g=r.geometry;near(g.floorElevation+g.inletDepth,103);near(g.floorElevation+g.reserveTop+r.parameters.inletClearance,103);
 assert.ok(g.floorElevation+g.stop<g.floorElevation+g.start);assert.ok(g.floorElevation+g.alarm<103);
});
test('Azonos mBf eltolás minden pontnál változatlan hidraulikát eredményez',()=>{
 const a=calculate(auto()),b=calculate(auto({inletElevation:203,outletElevation:208}));
 near(b.geometry.floorElevation-a.geometry.floorElevation,100,1e-7);near(a.hydraulics.operating[0].flow,b.hydraulics.operating[0].flow,1e-7);near(a.hydraulics.operating[0].head,b.hydraulics.operating[0].head,1e-7);
});
test('MI (28) L/s átváltása és legkedvezőtlenebb kapcsolásszám',()=>{
 const r=calculate(params({startsLimit:16,manufacturerStartsLimit:8}));near(r.geometry.byStarts,0.9*(18/3.6)/8);near(r.geometry.limit,8);
 const large=calculate(params({pumpId:'3231',startsLimit:20}));near(large.geometry.limit,15);
});
test('Qsz/2 befolyásnál a ciklusidő az analitikus indítási maximumot adja',()=>{
 const r=calculate(uniform({daily:240,manualFlows:[20],workingCount:1,standbyCount:0,startsLimit:12,minRunSeconds:0,minDrawdown:0.01,reserveHours:0,pipeLength:0}));
 near(r.geometry.active,20/48);assert.equal(r.simulation.rollingStarts[0],12);assert.ok(Math.abs(r.simulation.balanceError)<1e-6);
});
test('Hidegtartalék hozzáadása nem változtat kapacitást, szívóteret vagy indításszámot',()=>{
 const a=calculate(params({standbyCount:0})),b=calculate(params({standbyCount:3}));
 near(a.geometry.active,b.geometry.active);near(a.hydraulics.operating[0].flow,b.hydraulics.operating[0].flow);assert.deepEqual(a.simulation.rollingStarts,b.simulation.rollingStarts);assert.equal(b.simulation.runningHours.length,1);
});
test('Váltott üzem két üzemképes géppel és legfeljebb egyidejűleg eggyel',()=>{
 const base=uniform({daily:240,manualFlows:[20],startsLimit:12,minRunSeconds:0,minDrawdown:0.01,reserveHours:0,pipeLength:0});
 const one=calculate(base),two=calculate({...base,workingCount:2,maxParallel:1});
 near(one.geometry.active,two.geometry.active);assert.deepEqual(two.simulation.rollingStarts,[6,6]);
});
test('Három üzemi fokozat elindulhat, a hidegtartalék nem',()=>{
 const r=calculate(uniform({daily:500,workingCount:3,standbyCount:2,maxParallel:3,manualFlows:[10,18,25],pipeLength:0,reserveHours:0}));
 assert.equal(r.geometry.startLevels.length,3);near(r.geometry.active,r.geometry.perStage*3);assert.ok(r.simulation.series.some(d=>d.on===3));assert.equal(r.simulation.rollingStarts.length,3);assert.ok(r.simulation.runningHours.every(h=>h>0));assert.equal(check(r,'capacity').status,'pass');assert.ok(Math.abs(r.simulation.balanceError)<1e-6);
});
test('Automatikus munkapont vízszintfüggő és minden fokozatra görbemetszés',()=>{
 const r=calculate(auto({workingCount:3,maxParallel:3,pipeDiameter:150}));
 for(const op of r.hydraulics.operating){assert.ok(op.flowHigh>op.flowLow);near(pumpHead(r.hydraulics.points,op.perPump),op.head,1e-7);}
 for(const op of r.hydraulics.chartOperating){near(op.waterElevation,r.hydraulics.referenceElevation);near(pumpHead(r.hydraulics.points,op.perPump),systemHead(r.parameters,op.flow,r.hydraulics.referenceElevation).head,1e-7);}
 assert.ok(Math.abs(r.simulation.balanceError)<1e-6);
});
test('Vízszintfüggő szimuláció 60 és 15 másodperces integrációval közel egyezik',()=>{
 const p=auto({profile:'custom',hourly:Array(24).fill(1),daily:120});const a=calculate(p),b=calculate(p,{stepSeconds:15});
 near(a.simulation.avgVolume,b.simulation.avgVolume,0.02);near(a.simulation.systemFifoMaxMinutes,b.simulation.systemFifoMaxMinutes,3);
});
test('Tömegmérleg, mBf szintek és napi összmennyiség',()=>{
 const r=calculate(params()),s=r.simulation,g=r.geometry;near(s.inflow,36);assert.ok(Math.abs(s.balanceError)<1e-6);assert.ok(s.minLevel>=g.floorElevation+g.stop-1e-7);assert.ok(s.maxLevel<=g.topElevation+1e-7);
});
test('Éjszakai befolyásmentes idő meghaladja az MI 5 órás keretét',()=>{
 const r=calculate(params({shiftCount:1,residenceLimit:300}));assert.ok(r.simulation.systemFifoMaxMinutes>16*60);assert.equal(check(r,'residence').status,'fail');
});
test('Átlagos és FIFO-idő a teljes szívóteret és a telt nyomócsövet figyeli',()=>{
 const r=calculate(uniform({manualFlows:[0.5]})),g=r.geometry,s=r.simulation;
 near(s.hydraulicMinutes,(g.dead+g.active)/0.5*60,0.01);near(s.systemFifoMaxMinutes,(g.dead+g.active+r.hydraulics.pipeVolume)/0.5*60,1);
});
test('Az ismeretlen hálózati előzmény nem nulla és nem ad sikeres teljes időellenőrzést',()=>{
 const r=calculate(uniform({daily:120,pipeLength:10,residenceLimit:300}));assert.equal(check(r,'residence').status,'pending');assert.equal(r.simulation.totalFifoMinutes,null);
 const known=calculate(uniform({daily:120,pipeLength:10,residenceLimit:300,upstreamMinutes:20}));near(known.simulation.totalFifoMinutes,known.simulation.systemFifoMaxMinutes+20);assert.equal(check(known,'residence').status,'pass');
});
test('A megmaradó kezdeti víz miatt a modell nem igazolhatja az időkorlátot',()=>{
 const r=calculate(params({daily:0.01,stopLevel:2,diameter:4,residenceLimit:10080}));assert.ok(r.simulation.initialAtObservation>0);assert.equal(check(r,'residence').status,'pending');
});
test('Elégtelen szivattyú és vezetékhatár ténylegesen hibát jelez',()=>{
 const r=calculate(uniform({daily:100,manualFlows:[0.5],diameter:1.2,reserveHours:0}));assert.ok(r.simulation.overflow>0);assert.equal(check(r,'overflow').status,'fail');assert.equal(check(r,'capacity').status,'fail');assert.ok(Math.abs(r.simulation.balanceError)<1e-6);
});
test('MI hálózati 150 mm minimum és 0,3–5 m/s ellenőrzése',()=>{
 const small=calculate(params({pipeDiameter:100}));assert.equal(check(small,'pipe-diameter').status,'fail');const slow=calculate(params());assert.equal(check(slow,'velocity').status,'fail');
});
test('FCSM lakóházi minimális tartalék nem kerül automatikusan telephelyre',()=>{
 const house=calculate(params({application:'house',fcsmSingleDwelling:'yes',daily:0.6,manualFlows:[2],reserveHours:0}));assert.ok(house.geometry.active>=0.2);near(house.geometry.targetReserve,0.6);assert.ok(house.geometry.reserve>=0.6);
 const site=calculate(params({daily:0.6,manualFlows:[2],reserveHours:0,minDrawdown:0.01,minRunSeconds:0}));assert.ok(site.geometry.active<0.2);near(site.geometry.targetReserve,0);
});
test('Elrendezési minimum, mélységi korlát és automatikus átmérőválasztás',()=>{
 assert.equal(calculate(params({diameter:0.8,minDiameter:1.2})).geometry.fits,false);assert.equal(calculate(params({diameter:1.2,maxDepthBelowInlet:0.8})).geometry.fits,false);
 const r=calculate(params({reserveHours:24}));assert.ok(r.geometry.diameter>1.2);assert.ok(r.geometry.fits);
});
test('60 másodperces napló 0:00–24:00 között, új mBf és fokozati adatokkal',()=>{
 const r=calculate(params()),s=r.simulation.series;assert.equal(s.length,1441);near(s[0].hour,0);near(s.at(-1).hour,24);for(let i=1;i<s.length;i++)near(s[i].hour-s[i-1].hour,1/60);assert.ok(s.every(d=>d.level>100&&d.on>=0&&d.on<=1&&d.pumpFlow>=0));
});
test('Hibás bemenet, hiányos többgépes Q, hibás görbekötés és darabszám elutasítása',()=>{
 for(const bad of[{daily:-1},{daily:''},{pipeDiameter:0},{workingCount:1.5},{maxParallel:2},{manualFlows:[]},{workingCount:3,maxParallel:3,manualFlows:[18]},{upstreamMinutes:-1},{manufacturerStartsLimit:0},{minDrawdown:1,maxDrawdown:0.5}])assert.throws(()=>calculate(params(bad)));
 assert.throws(()=>calculate(auto({curveModelId:'3153'})),/más típuscsalád/);assert.throws(()=>calculate(auto({curveLabel:''})),/hivatkozás/);
});
test('Régi JSON migrációja: nem talál ki mBf szintet, a váltott üzem megmarad',()=>{
 const old={version:1,parameters:{project:'Régi',pumpCount:2,pumpFlow:22,inletLevel:3,basePercent:10,residenceLimit:''}};
 const r=migrateProject(old);assert.equal(r.parameters.workingCount,2);assert.equal(r.parameters.maxParallel,1);assert.equal(r.parameters.standbyCount,0);assert.equal(r.parameters.manualFlows[0],22);assert.match(r.note,/mBf/);assert.ok(!Object.hasOwn(r.parameters,'basePercent'));assert.equal(r.parameters.inletElevation,'');assert.equal(r.parameters.outletElevation,'');assert.throws(()=>calculate(r.parameters),/Befolyó/);
});
