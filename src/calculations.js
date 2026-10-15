import {pumps} from './pumps.js';

export const defaults = {
  project: 'Új szennyvízátemelő', application: 'workplace', daily: 12,
  shiftCount: 2,
  shifts: [{start: 6, hours: 8, people: 60}, {start: 14, hours: 8, people: 40}, {start: 22, hours: 8, people: 40}],
  basePercent: 10, profile: 'shift', hourly: Array(24).fill(1),
  pumpId: '3085', pumpFlow: 18, dutyReference: '', pumpCount: 2,
  startsLimit: 20, minRunSeconds: 30,
  diameter: 'auto', minDiameter: 1.2, stopLevel: 0.4,
  inletLevel: 3, maxDrawdown: 0.8, minDrawdown: 0.15,
  alarmGap: 0.15, inletClearance: 0.15, reserveHours: 2,
  residenceLimit: '',
};

function number(value, name, min, max) {
  if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) throw new Error(`${name}: adj meg egy számot.`);
  const n = Number(value);
  if (n < min || n > max) throw new Error(`${name}: ${min} és ${max} közötti érték szükséges.`);
  return n;
}

export function validate(input) {
  const p = structuredClone(input);
  for (const [key, name, min, max] of [
    ['daily','Napi mennyiség',0.01,100000], ['basePercent','Folyamatos hányad',0,100],
    ['pumpFlow','Munkaponti vízhozam',0.01,10000], ['startsLimit','Indítási korlát',1,100],
    ['minRunSeconds','Minimum futásidő',0,3600], ['minDiameter','Minimum átmérő',0.5,10],
    ['stopLevel','Leállítási szint',0.01,10], ['inletLevel','Befolyó fenékszint',0.1,20],
    ['maxDrawdown','Maximum kapcsolási szintkülönbség',0.05,5], ['minDrawdown','Minimum kapcsolási szintkülönbség',0.01,2],
    ['alarmGap','Riasztási szintkülönbség',0.01,2], ['inletClearance','Befolyó alatti tartalék',0.01,2],
    ['reserveHours','Biztonsági tárolási idő',0,168],
  ]) p[key] = number(p[key],name,min,max);
  if (!['workplace','house'].includes(p.application)) throw new Error('Ismeretlen felhasználási mód.');
  if (!['shift','custom'].includes(p.profile)) throw new Error('Ismeretlen befolyási profil.');
  p.shiftCount = number(p.shiftCount, 'Műszakok száma',1,3);
  p.pumpCount = number(p.pumpCount,'Szivattyúk száma',1,2);
  if (!Number.isInteger(p.shiftCount) || !Number.isInteger(p.pumpCount)) throw new Error('A darabszám és a műszakszám egész szám legyen.');
  if (!pumps.some(x => x.id === p.pumpId)) throw new Error('Válassz ismert Flygt típuscsaládot.');
  if (p.residenceLimit !== '') p.residenceLimit = number(p.residenceLimit,'Tartózkodásiidő-korlát',1,10080);
  if (p.diameter !== 'auto') p.diameter = number(p.diameter,'Belső átmérő',0.5,10);
  if (p.minDrawdown > p.maxDrawdown) throw new Error('A minimum szintkülönbség nem lehet nagyobb a maximumnál.');
  if (p.inletLevel <= p.stopLevel + p.inletClearance) throw new Error('A befolyó szintje legyen a leállítási szint és a szabad tartalék fölött.');
  if (!Array.isArray(p.shifts) || p.shifts.length < p.shiftCount) throw new Error('Hiányos műszakadatok.');
  p.shifts = p.shifts.slice(0,p.shiftCount).map((s,i) => ({
    start: number(s.start,`${i+1}. műszak kezdete`,0,23.75),
    hours: number(s.hours,`${i+1}. műszak hossza`,0.25,24),
    people: number(s.people,`${i+1}. műszak létszáma`,0,100000),
  }));
  if (!Array.isArray(p.hourly) || p.hourly.length !== 24) throw new Error('Pontosan 24 órás profilsúly szükséges.');
  p.hourly = p.hourly.map((v,i) => number(v,`${i}. óra profilsúlya`,0,100000));
  return p;
}

// 96 quarter-hour bins. Person-hours determine relative weights, never add
// another per-person water allowance to the user-specified daily total.
export function buildProfile(p) {
  const weights = Array.from({length:96},(_,i) => {
    if (p.application === 'house') return 1;
    if (p.profile === 'custom') return p.hourly[Math.floor(i/4)];
    const t = (i+0.5)/4;
    return p.shifts.reduce((sum,s) => sum + (((t-s.start+24)%24)<s.hours ? s.people : 0),0);
  });
  // Exact overlap for non-quarter-hour shift boundaries (including midnight).
  if (p.application !== 'house' && p.profile === 'shift') {
    for (let i=0;i<96;i++) weights[i] = p.shifts.reduce((sum,s) => {
      let overlap=0;
      for (const d of [-24,0,24]) overlap += Math.max(0,Math.min((i+1)/4,s.start+s.hours+d)-Math.max(i/4,s.start+d));
      return sum + s.people*overlap*4;
    },0);
  }
  const weightHours = weights.reduce((a,b)=>a+b,0)/4;
  const baseFraction = p.application === 'house' ? 0 : p.basePercent/100;
  if (weightHours === 0 && baseFraction < 1) throw new Error('A változó befolyáshoz legalább egy pozitív létszám vagy profilsúly kell.');
  return weights.map(w => p.daily*baseFraction/24 + (weightHours ? p.daily*(1-baseFraction)*w/weightHours : 0));
}

export function geometry(p, pump) {
  const limit = Math.min(p.startsLimit,pump.maxStarts);
  const byStarts = p.pumpFlow/(4*limit);
  const byRun = p.pumpFlow*p.minRunSeconds/3600;
  const domesticMin = p.application === 'house' ? 0.2 : 0;
  const targetReserve = p.daily*(p.application === 'house' ? 24 : p.reserveHours)/24;
  const candidate = diameter => {
    const area = Math.PI*diameter**2/4;
    const active = Math.max(byStarts,byRun,area*p.minDrawdown,domesticMin);
    const stop = p.stopLevel;
    const start = stop+active/area;
    const alarm = start+p.alarmGap;
    const reserve = Math.max(targetReserve,area*p.alarmGap);
    const reserveTop = start+reserve/area;
    const fits = diameter>=p.minDiameter-1e-9 && reserveTop <= p.inletLevel-p.inletClearance+1e-9 && active/area<=p.maxDrawdown+1e-9;
    return {diameter,area,active,stop,start,alarm,reserve,reserveTop,fits,
      dead: area*stop, belowInlet:area*p.inletLevel, drawdown:active/area};
  };
  const sizes = [...new Set([p.minDiameter,...[0.8,1,1.2,1.5,1.8,2,2.5,3,4,5,6,8,10].filter(x=>x>=p.minDiameter)])].sort((a,b)=>a-b);
  const options = (p.diameter === 'auto' ? sizes : [p.diameter]).map(candidate);
  const g = options.find(x=>x.fits) || options.at(-1);
  return {...g,byStarts,byRun,limit,targetReserve, theoreticalMaxStarts:p.pumpFlow/(4*g.active),
    worstRunSeconds:3600*g.active/p.pumpFlow};
}

// Event-split 60 s integration. FIFO is an ideal plug-flow assumption, NOT a
// guarantee of maximum water age in a real mixed/short-circuiting sump.
export function simulate(p, g, profile) {
  const warmupDays = Math.min(30,Math.max(7,Math.ceil((g.dead+g.active)/p.daily)+2));
  const observationDays=3, begin=warmupDays*24, end=begin+observationDays*24;
  let t=0, volume=g.dead, on=false, duty=0, nextDuty=0, head=0;
  const parcels=[{v:volume,t:0,initial:true}];
  const starts=Array.from({length:p.pumpCount},()=>[]);
  const observedStarts=Array(p.pumpCount).fill(0), runningHours=Array(p.pumpCount).fill(0);
  let initialVolume=volume, inflow=0,pumped=0,overflow=0,integral=0,maxAge=0,initialRemaining=volume, initialAtObservation=volume;
  let maxObservedVolume=volume, minObservedVolume=Infinity, events=0;
  let offSince=0,maxOff=0;
  const series=[];
  function take(amount, time, observed, effluent) {
    while (amount>1e-10 && head<parcels.length) {
      const part=parcels[head], used=Math.min(amount,part.v);
      if (observed && effluent && used>1e-10) maxAge=Math.max(maxAge,time-part.t);
      if (part.initial) initialRemaining=Math.max(0,initialRemaining-used);
      part.v-=used; amount-=used;
      if (part.v<1e-10) head++;
    }
    if (head>1000) {parcels.splice(0,head); head=0;}
  }
  while (t<end-1e-9) {
    if (++events>300000) throw new Error('Túl sok kapcsolási esemény. Növeld az üzemi térfogatot vagy csökkentsd a szivattyú vízhozamát.');
    const observed=t>=begin-1e-9;
    if (!on && volume>=g.dead+g.active-1e-9) {
      on=true; duty=nextDuty; nextDuty=(nextDuty+1)%p.pumpCount;
      starts[duty].push(t);
      if (observed) {observedStarts[duty]++; maxOff=Math.max(maxOff,t-Math.max(offSince,begin));}
    } else if (on && volume<=g.dead+1e-9) {on=false; offSince=t;}
    const bin=Math.floor((t+1e-8)*4)%96, q=profile[bin], out=on?p.pumpFlow:0, net=q-out;
    const nextMinute=(Math.floor((t+1e-8)*60)+1)/60;
    let dt=Math.min(1/60,nextMinute-t,(Math.floor((t+1e-8)*4)+1)/4-t,end-t);
    if (t<begin-1e-9) dt=Math.min(dt,begin-t);
    if (!on && q>0) dt=Math.min(dt,Math.max(1e-9,(g.dead+g.active-volume)/q));
    if (on && net<0) dt=Math.min(dt,Math.max(1e-9,(volume-g.dead)/(-net)));
    const previous=volume, add=q*dt, remove=out*dt;
    if (add>1e-12) parcels.push({v:add,t:t+dt/2,initial:false});
    take(remove,t+dt,observed,true);
    volume=Math.max(0,volume+add-remove);
    const spill=Math.max(0,volume-g.belowInlet);
    if (spill>0) {take(spill,t+dt,observed,false); volume-=spill;}
    if (observed) {
      inflow+=add; pumped+=remove; overflow+=spill; integral+=(previous+volume)/2*dt;
      if (on) runningHours[duty]+=dt;
      maxObservedVolume=Math.max(maxObservedVolume,volume); minObservedVolume=Math.min(minObservedVolume,volume);
      if (parcels[head]) maxAge=Math.max(maxAge,t+dt-parcels[head].t);
      if (!on) maxOff=Math.max(maxOff,t+dt-Math.max(offSince,begin));
    }
    t+=dt;
    if (Math.abs(t-begin)<1e-7) {initialVolume=volume; maxObservedVolume=volume; initialAtObservation=initialRemaining;}
    if (t>=end-24-1e-8 && Math.abs(t*60-Math.round(t*60))<1e-6) {
      series.push({absolute:t,hour:t-(end-24),inflow:q,level:volume/g.area,on:on?duty+1:0});
    }
  }
  const rollingStarts=starts.map(times=>{
    let left=0,max=0;
    for (let right=0;right<times.length;right++) {
      while(times[right]-times[left]>=1-1e-9) left++;
      if(times[right]>=begin) max=Math.max(max,right-left+1);
    }
    return max;
  });
  return {series,observationDays,warmupDays,rollingStarts,observedStarts,runningHours,
    avgVolume:integral/(24*observationDays),
    hydraulicMinutes:(integral/(24*observationDays))/(p.daily/24)*60,
    fifoMaxMinutes:maxAge*60, maxOffMinutes:maxOff*60,
    initialRemaining, initialAtObservation, inflow,pumped,overflow,initialVolume,finalVolume:volume,
    maxLevel:maxObservedVolume/g.area,minLevel:minObservedVolume/g.area,
    balanceError:initialVolume+inflow-pumped-overflow-volume};
}

export function calculate(input) {
  const p=validate(input), pump=pumps.find(x=>x.id===p.pumpId), profile=buildProfile(p);
  const g=geometry(p,pump), sim=simulate(p,g,profile), checks=[];
  const add=(status,title,detail)=>checks.push({status,title,detail});
  add(g.fits?'pass':'fail','Akna és tárolótér',g.fits?'Az üzemi és a biztonsági tér elfér a befolyó alatt, a megadott tartalékkal.':'A szükséges tér vagy kapcsolási szintkülönbség nem fér el, illetve az átmérő kisebb az elrendezési minimumnál.');
  add(sim.overflow<1e-7?'pass':'fail','Visszaduzzasztás a modellben',sim.overflow<1e-7?'A vízszint nem érte el a befolyó fenékszintjét a három vizsgált napon.':'A számítás elérte a befolyó szintjét. A túlfolyásként könyvelt térfogat valójában visszaduzzasztást vagy elöntést jelenthet.');
  add(Math.max(...sim.rollingStarts)<=g.limit?'pass':'fail','Indítások szivattyúnként',`Gördülő 60 percben legfeljebb ${Math.max(...sim.rollingStarts)} indítás; alkalmazott korlát: ${g.limit}/h. A prospektus felső értéke ${pump.maxStarts}/h, a pontos motorra ellenőrizendő.`);
  if (p.residenceLimit==='') add('pending','Tartózkodási idő: hiányzó határérték','A mellékelt FCSM-részlet nem közöl számszerű időkorlátot. Adj meg a projektre egyeztetett tervezői értéket.');
  else if (sim.initialAtObservation>1e-7) add('pending','Tartózkodási idő: nem beállt modell','A kezdeti víz egy része a bemelegítés végén is megmaradt; hosszabb vizsgálat szükséges.');
  else add(sim.fifoMaxMinutes<=p.residenceLimit && sim.hydraulicMinutes<=p.residenceLimit?'pass':'fail','Tartózkodási idő a felvett modellben','Az átlagos hidraulikai és az ideális FIFO szerinti legnagyobb érték összevetése a tervezői korláttal. A valós keveredés és holtterek külön vizsgálatot igényelnek.');
  add('pending','Munkapont és minimális bemerülés','A típuscsalád prospektusa nem igazolja a megadott Q értéket, leállítási szintet vagy a beépíthetőséget. Pontos kivitel, Q–H jelleggörbe és telepítési adatlap szükséges.');
  if(p.application==='workplace') add('pending','FCSM: műszakos telephely','A 2020-as részlet lakossági házi beemelőkről szól. A telephely tárolási idejét, tartalékát és alkalmazhatóságát külön egyeztetni kell.');
  else add(g.active>=0.2 && g.reserve>=p.daily?'pass':'fail','FCSM: egylakásos, 4 fős eset','Legalább 0,2 m³ üzemi tér + legalább 1 napi kibocsátásnyi biztonsági tér a befolyó alatt. Kizárólag erre az esetre alkalmazva.');
  return {parameters:p,pump,profile,geometry:g,simulation:sim,checks};
}
