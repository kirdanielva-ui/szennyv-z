import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProfile,calculate,defaults,geometry,simulate,validate} from '../src/calculations.js';
import {pumps} from '../src/pumps.js';

const params=overrides=>({...structuredClone(defaults),...overrides});
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≠ ${expected}`);

test('Műszakok létszáma osztja el a napi mennyiséget, duplázás nélkül',()=>{
  const p=validate(params({basePercent:0})),q=buildProfile(p);
  near(q.reduce((a,b)=>a+b,0)/4,12);
  near(q[6*4],0.9); near(q[14*4],0.6); near(q[1],0);
});
test('Éjszakai, átfedő és nem negyedórás műszakok is pontosan normáltak',()=>{
  const p=validate(params({basePercent:0,shifts:[{start:22.1,hours:7.3,people:10},{start:4.9,hours:8.4,people:5}]}));
  const q=buildProfile(p);
  near(q.reduce((a,b)=>a+b,0)/4,12);
  assert.ok(q[0]>0); assert.equal(q[80],0);
  assert.ok(q[20]>q[24]);
});
test('Egyedi órás súlyok és folyamatos rész együtt adják a napi mennyiséget',()=>{
  const hourly=Array(24).fill(0);hourly[7]=3;hourly[18]=1;
  const q=buildProfile(validate(params({profile:'custom',hourly,basePercent:20})));
  near(q[0],0.1);near(q[28],7.3);near(q[72],2.5);
  near(q.reduce((a,b)=>a+b,0)/4,12);
});
test('Nulla profilsúly csak 100% folyamatos befolyással engedett',()=>{
  assert.throws(()=>buildProfile(validate(params({profile:'custom',hourly:Array(24).fill(0)}))),/pozitív/);
  const q=buildProfile(validate(params({basePercent:100,profile:'custom',hourly:Array(24).fill(0)})));
  near(q[0],0.5);
});
test('Qsz/2 befolyásnál a ciklusidőből számolt elméleti maximum adódik',()=>{
  const p=validate(params({daily:240,pumpFlow:20,pumpCount:1,basePercent:100,startsLimit:20,minRunSeconds:0,minDrawdown:0.01,reserveHours:0}));
  const g=geometry(p,pumps[1]),s=simulate(p,g,buildProfile(p));
  near(g.active,0.25);near(g.theoreticalMaxStarts,20);
  assert.equal(s.rollingStarts[0],20); assert.ok(Math.abs(s.balanceError)<1e-6);
});
test('Váltott üzemben a kapcsolási tér nem csökken, a gépenkénti indításszám feleződik',()=>{
  const overrides={daily:240,pumpFlow:20,basePercent:100,startsLimit:20,minRunSeconds:0,minDrawdown:0.01,reserveHours:0};
  const one=calculate(params({...overrides,pumpCount:1})),two=calculate(params({...overrides,pumpCount:2}));
  near(one.geometry.active,two.geometry.active); assert.deepEqual(two.simulation.rollingStarts,[10,10]);
});
test('Nagy Flygt gépek prospektus szerinti 15/h korlátja felülírja a lazább tervezői értéket',()=>{
  const r=calculate(params({pumpId:'3231',startsLimit:30}));
  assert.equal(r.geometry.limit,15);near(r.geometry.byStarts,18/60);
});
test('Futásidő-minimum nulla befolyásnál konzervatív kapcsolási térhez vezet',()=>{
  const r=calculate(params({minRunSeconds:120}));
  near(r.geometry.byRun,0.6);assert.ok(r.geometry.worstRunSeconds>=120-1e-7);
});
test('FCSM 0,2 m³ és egy napi biztonsági tér csak a 4 fős lakóházi esetben érvényesül',()=>{
  const r=calculate(params({application:'house',daily:0.6,pumpFlow:2,reserveHours:0}));
  assert.ok(r.geometry.active>=0.2);near(r.geometry.targetReserve,0.6);assert.ok(r.geometry.reserve>=0.6);
  const workplace=calculate(params({daily:0.6,pumpFlow:2,reserveHours:0,minDrawdown:0.01,minRunSeconds:0}));
  assert.ok(workplace.geometry.active<0.2);near(workplace.geometry.targetReserve,0);
});
test('Tömegmérleg, pozitív térfogatok és határon tartott vízszintek',()=>{
  const r=calculate(params()),s=r.simulation,g=r.geometry;
  near(s.inflow,36);assert.ok(Math.abs(s.balanceError)<1e-6);
  assert.ok(s.minLevel>=g.stop-1e-7);assert.ok(s.maxLevel<=g.start+1e-7);
  assert.ok(s.initialAtObservation<1e-7);assert.ok(s.fifoMaxMinutes>s.hydraulicMinutes);
});
test('A hosszú befolyásmentes éjszaka vízkora hibát jelez a rövid tervezői korláthoz',()=>{
  const r=calculate(params({basePercent:0,shiftCount:1,residenceLimit:120}));
  assert.ok(r.simulation.fifoMaxMinutes>16*60);
  assert.equal(r.checks.find(x=>x.title==='Tartózkodási idő a felvett modellben').status,'fail');
});
test('Nincs kitalált FCSM-időkorlát, az üres mező függő feltétel',()=>{
  const r=calculate(params());
  assert.equal(r.parameters.residenceLimit,'');assert.equal(r.checks.find(x=>x.title.includes('hiányzó határérték')).status,'pending');
});
test('Elégtelen szivattyúkapacitásnál a töltődést és túltöltést valóban kimutatja',()=>{
  const r=calculate(params({daily:100,pumpFlow:0.5,basePercent:100,diameter:1.2,reserveHours:0}));
  assert.ok(r.simulation.overflow>0);assert.ok(Math.abs(r.simulation.balanceError)<1e-6);
  assert.equal(r.checks.find(x=>x.title==='Visszaduzzasztás a modellben').status,'fail');
});
test('Rögzített átmérő nem lépheti át az elrendezési minimumot és a tárolási határt',()=>{
  const small=calculate(params({diameter:0.8,minDiameter:1.2}));assert.equal(small.geometry.fits,false);
  const shallow=calculate(params({diameter:1.2,inletLevel:0.8}));assert.equal(shallow.geometry.fits,false);
});
test('Automatikus átmérőnövelés elhelyezi a szükséges biztonsági tárolást',()=>{
  const r=calculate(params({daily:12,reserveHours:24}));assert.ok(r.geometry.diameter>1.2);
  assert.ok(r.geometry.fits);assert.ok(r.geometry.reserveTop<=r.parameters.inletLevel-r.parameters.inletClearance+1e-7);
});
test('Hibás, hiányos és nem véges számítási bemenetek elutasítása',()=>{
  for(const bad of [{daily:-1},{daily:''},{pumpFlow:NaN},{residenceLimit:Infinity},{pumpCount:1.5},{hourly:[1]},{stopLevel:4},{minDrawdown:1,maxDrawdown:0.5},{pumpId:'unknown'}]) assert.throws(()=>calculate(params(bad)));
});
test('Az átlagos hidraulikai idő a teljes vízteret, nem csak a kapcsolási térfogatot használja',()=>{
  const a=calculate(params({basePercent:100,stopLevel:0.2})),b=calculate(params({basePercent:100,stopLevel:0.8}));
  near(b.simulation.hydraulicMinutes-a.simulation.hydraulicMinutes,(b.geometry.dead-a.geometry.dead)/(12/24)*60,0.1);
});
test('Állandó, a szivattyúéval egyező befolyásnál a FIFO-idő az analitikus V/Q értéket követi',()=>{
  const r=calculate(params({basePercent:100,pumpFlow:0.5}));
  const exact=(r.geometry.dead+r.geometry.active)/0.5*60;
  near(r.simulation.hydraulicMinutes,exact,0.01);
  near(r.simulation.fifoMaxMinutes,exact,1);
});
test('A megmaradó kezdeti víz nem adhat sikeres tartózkodásiidő-ellenőrzést',()=>{
  const r=calculate(params({daily:0.01,stopLevel:2,diameter:4,residenceLimit:10080}));
  assert.ok(r.simulation.initialAtObservation>0);
  assert.equal(r.checks.find(x=>x.title==='Tartózkodási idő: nem beállt modell').status,'pending');
});
test('A napi diagram és CSV pontosan percenként mintavételez 0:00 és 24:00 között',()=>{
  const series=calculate(params()).simulation.series;
  assert.equal(series.length,1441);near(series[0].hour,0);near(series.at(-1).hour,24);
  for(let i=1;i<series.length;i++) near(series[i].hour-series[i-1].hour,1/60);
});
