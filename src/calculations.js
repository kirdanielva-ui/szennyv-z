import {pipePlacementChecks} from './pipe-placement.js';
import {pumps,catalogueCurve} from './pumps.js';
import {systemHead,parseCurve,operatingPoint,pumpHead} from './hydraulics.js';

export const defaults={
  project:'Új szennyvízátemelő',application:'workplace',daily:12,shiftCount:2,
  shifts:[{start:6,hours:8,people:60},{start:14,hours:8,people:40},{start:22,hours:8,people:40}],
  profile:'shift',hourly:Array(24).fill(1),pumpId:'3085',workingCount:1,standbyCount:1,maxParallel:1,
  flowMode:'manual',manualFlows:[18,'','','','','','',''],curveText:'',curveLabel:'',curveModelId:'3085',curveSource:'manual',
  startsLimit:12,manufacturerStartsLimit:'',minRunSeconds:30,
  inletElevation:103,outletElevation:108,pipeDiameter:150,pipeLength:100,
  roughnessMm:0.25,minorLossK:3,outletMode:'free',backpressureHead:0,
  diameter:'auto',minDiameter:1.2,stopLevel:0.4,maxDepthBelowInlet:3,
  maxDrawdown:0.8,minDrawdown:0.15,alarmGap:0.15,inletClearance:0.15,reserveHours:2,
  residenceMinimum:0,residenceLimit:'',upstreamMinutes:'',groundElevation:'',pressureExitDepth:1,fcsmSingleDwelling:'no',
  projectVelocityMin:'',projectVelocityMax:'',
};
function number(value,name,min,max){
  if(value===''||value===null||value===undefined||!Number.isFinite(Number(value)))throw new Error(`${name}: adj meg egy számot.`);
  const n=Number(value);if(n<min||n>max)throw new Error(`${name}: ${min} és ${max} közötti érték szükséges.`);return n;
}
export function migrateProject(data){
  if(!data||![1,2].includes(data.version)||!data.parameters)throw new Error('Nem támogatott projektformátum.');
  const old=data.parameters,p=structuredClone(defaults);
  for(const key of Object.keys(defaults))if(Object.hasOwn(old,key))p[key]=structuredClone(old[key]);
  let note='';
  if(data.version===1){
    p.workingCount=Number(old.pumpCount)===2?2:1;p.standbyCount=0;p.maxParallel=1;
    p.manualFlows=[old.pumpFlow??18,'','','','','','',''];
    for(const key of ['inletElevation','outletElevation','pipeDiameter','pipeLength'])p[key]='';
    note='Korábbi projekt: a relatív szintekből mBf magasság nem határozható meg. Az új magasságokat és vezetékadatokat ezért üresen hagytuk: add meg őket. A megszüntetett folyamatos hányad helyett a teljes napi mennyiséget a profil osztja el. A régi kétgépes váltott üzem két üzemképes, legfeljebb egyidejűleg egy működő gép maradt.';
    if(old.residenceLimit==='')p.residenceLimit='';
  }
  if(old.application==='house'&&!Object.hasOwn(old,'fcsmSingleDwelling')){p.fcsmSingleDwelling='yes';note+=' A régi lakóházi projekt egylakásos FCSM-esetét megtartottuk; általános lakóépülethez válaszd a tervezői tárolást.';}
  if(Object.hasOwn(old,'pressureExitCover')&&!Object.hasOwn(old,'pressureExitDepth')){
    const diameter=Number(old.pipeDiameter),cover=Number(old.pressureExitCover);
    if(old.pipeDiameter!==''&&Number.isFinite(diameter)&&diameter>0&&old.pressureExitCover!==''&&Number.isFinite(cover)){
      p.pressureExitDepth=cover+diameter/2000;
      note+=' A korábbi felsőpalást-mélységet tengelymélységre váltottuk a korábbi rajz belső csőátmérőjével; a tengelyszint megmaradt. Az 1 m feltételt most a befolyó fenekéig és a nyomócső tengelyéig ellenőrizzük.';
    }else{p.pressureExitDepth='';note+=' A korábbi falátvezetés tengelymélysége nem határozható meg a hiányos csőadatokból; add meg külön.';}
  }
  return {parameters:p,note};
}
export function validate(input,{requireCurve=true}={}){
  const p=structuredClone(input);
  for(const [key,name,min,max] of [
    ['daily','Napi mennyiség',0.01,100000],['startsLimit','Tervezői kapcsolásszám',1,100],
    ['minRunSeconds','Minimum futásidő',0,3600],['minDiameter','Minimum átmérő',0.5,10],
    ['stopLevel','Leállítási vízmélység',0.01,10],['maxDepthBelowInlet','Max. mélység a befolyó alatt',0.2,20],
    ['maxDrawdown','Max. teljes kapcsolási szintkülönbség',0.05,10],['minDrawdown','Min. szintlépcső',0.01,2],
    ['alarmGap','Riasztási szintkülönbség',0.01,2],['inletClearance','Befolyó alatti tartalék',0.01,2],
    ['reserveHours','Biztonsági tárolási idő',0,168],['inletElevation','Befolyó mBf szint',-100,3000],
    ['outletElevation','Végponti mBf szint',-100,3000],['pipeDiameter','Nyomócső belső átmérő',15,2000],
    ['pipeLength','Nyomócsőhossz',0,100000],['roughnessMm','Üzemi érdesség',0,10],
    ['minorLossK','Helyi veszteségtényezők összege',0,1000],['backpressureHead','Ellennyomás',0,1000],
    ['residenceMinimum','Minimum tartózkodási idő',0,10080],['pressureExitDepth','Nyomócső kilépési tengelymélysége',0,20],
  ])p[key]=number(p[key],name,min,max);
  for(const [key,name,min,max] of [['shiftCount','Műszakszám',1,3],['workingCount','Üzemképes szivattyúk száma',1,8],['standbyCount','Hidegtartalékok száma',0,8],['maxParallel','Max. egyidejű gépszám',1,p.workingCount]]){
    p[key]=number(p[key],name,min,max);if(!Number.isInteger(p[key]))throw new Error(`${name}: egész szám szükséges.`);
  }
  for(const [key,name,max] of [['manufacturerStartsLimit','Pontos gyártói kapcsolásszám',100],['upstreamMinutes','Befolyás előtti hálózati idő',10080]])if(p[key]!=='')p[key]=number(p[key],name,0,max);
  for(const [key,name,min,max] of [['residenceLimit','Felső tartózkodásiidő-keret',0,10080],['groundElevation','Terepszint',-100,3000],['projectVelocityMin','Tervezői minimum sebesség',0,20],['projectVelocityMax','Tervezői maximum sebesség',0,20]])if(p[key]!=='')p[key]=number(p[key],name,min,max);
  if(p.residenceLimit!==''&&p.residenceMinimum>p.residenceLimit)throw new Error('A minimum tartózkodási idő nem haladhatja meg a felső keretet.');
  if(p.projectVelocityMin!==''&&p.projectVelocityMax!==''&&p.projectVelocityMin>p.projectVelocityMax)throw new Error('A minimum sebesség nem haladhatja meg a maximumot.');
  for(const key of ['fcsmSingleDwelling'])if(!['yes','no'].includes(p[key]))throw new Error('Ismeretlen választási beállítás.');
  if(p.groundElevation!==''&&p.groundElevation<p.inletElevation)throw new Error('A terepszint nem lehet a befolyócső fenékszintje alatt.');
  if(p.manufacturerStartsLimit===0)throw new Error('A pontos gyártói kapcsolásszám legyen pozitív vagy hagyd üresen.');
  if(!['workplace','house'].includes(p.application))throw new Error('Ismeretlen felhasználási mód.');
  if(!['shift','custom'].includes(p.profile))throw new Error('Ismeretlen befolyási profil.');
  if(!['manual','curve'].includes(p.flowMode))throw new Error('Ismeretlen munkapont-meghatározás.');
  if(!['manual','catalogue'].includes(p.curveSource))throw new Error('Ismeretlen görbeadatforrás.');
  if(!['free','reservoir'].includes(p.outletMode))throw new Error('Ismeretlen végponttípus.');
  if(!pumps.some(x=>x.id===p.pumpId))throw new Error('Válassz ismert Flygt típuscsaládot.');
  if(p.diameter!=='auto')p.diameter=number(p.diameter,'Belső aknaátmérő',0.5,10);
  if(p.minDrawdown>p.maxDrawdown)throw new Error('A minimum szintlépcső nem lehet nagyobb a teljes maximum szintkülönbségnél.');
  if(!Array.isArray(p.shifts)||p.shifts.length<p.shiftCount)throw new Error('Hiányos műszakadatok.');
  p.shifts=p.shifts.slice(0,p.shiftCount).map((s,i)=>({start:number(s.start,`${i+1}. műszak kezdete`,0,23.99),hours:number(s.hours,`${i+1}. műszak hossza`,0.01,24),people:number(s.people,`${i+1}. műszak létszáma`,0,100000)}));
  if(!Array.isArray(p.hourly)||p.hourly.length!==24)throw new Error('Pontosan 24 órás profilsúly szükséges.');
  p.hourly=p.hourly.map((v,i)=>number(v,`${i}. óra profilsúlya`,0,100000));
  if(p.flowMode==='manual'){
    if(!Array.isArray(p.manualFlows))throw new Error('Hiányzó fokozatonkénti vízhozamok.');
    p.manualFlows=Array.from({length:p.maxParallel},(_,i)=>number(p.manualFlows[i],`${i+1} egyidejű gép összes Q-ja`,0.01,10000));
    for(let i=1;i<p.manualFlows.length;i++)if(p.manualFlows[i]<p.manualFlows[i-1])throw new Error('Több működő gép együttes Q-ja nem lehet kisebb az előző fokozaténál.');
  }else if(requireCurve){
    if(p.curveModelId!==p.pumpId)throw new Error('A Q–H görbe más típuscsaládhoz tartozik. Adj meg az aktuális kivitelhez tartozó görbét.');
    if(p.curveSource==='catalogue'){
      const preset=catalogueCurve(p.pumpId);
      if(!preset)throw new Error('Ehhez a típushoz nincs beépített Q–H pontsor. Egyedi kiviteladat szükséges.');
      p.curveText=preset.text;p.curveLabel=preset.label;
    }
    if(!String(p.curveLabel).trim())throw new Error('Add meg a Q–H görbe pontos szivattyúkivitelét és adatlap-hivatkozását.');
    parseCurve(p.curveText);
  }
  return p;
}
export function buildProfile(p){
  const weights=Array.from({length:96},(_,i)=>{
    if(p.application==='house'&&p.profile!=='custom')return 1;
    if(p.profile==='custom')return p.hourly[Math.floor(i/4)];
    return p.shifts.reduce((sum,s)=>{
      let overlap=0;for(const d of [-24,0,24])overlap+=Math.max(0,Math.min((i+1)/4,s.start+s.hours+d)-Math.max(i/4,s.start+d));
      return sum+s.people*overlap*4;
    },0);
  });
  const weightHours=weights.reduce((a,b)=>a+b,0)/4;
  if(weightHours===0)throw new Error('Legalább egy pozitív műszaklétszám vagy órás profilsúly szükséges.');
  return weights.map(w=>p.daily*w/weightHours);
}
export function geometry(p,pump,points=null){
  const limits=[p.startsLimit,pump.maxStarts,p.manufacturerStartsLimit].filter(v=>typeof v==='number'&&v>0);
  const limit=Math.min(...limits);
  const targetReserve=p.daily*(p.application==='house'&&p.fcsmSingleDwelling==='yes'?24:p.reserveHours)/24;
  const candidate=diameter=>{
    const area=Math.PI*diameter**2/4,reserve=Math.max(targetReserve,area*p.alarmGap);
    const topElevation=p.inletElevation-p.inletClearance-reserve/area;
    const maxFlow=p.flowMode==='curve'?operatingPoint(p,points,p.maxParallel,topElevation).flow:p.manualFlows.at(-1);
    // MI (28) gives 0.9*Q[l/s]/Z = Q[m³/h]/(4Z). Conservatively use
    // full station flow for EACH stage; this extension is not an MI multipump rule.
    const byStarts=0.9*(maxFlow/3.6)/limit,byRun=maxFlow*p.minRunSeconds/3600;
    const perStage=Math.max(byStarts,byRun,area*p.minDrawdown,p.application==='house'&&p.fcsmSingleDwelling==='yes'?0.2:0);
    const active=perStage*p.maxParallel,drawdown=active/area,start=p.stopLevel+drawdown;
    const reserveTop=start+reserve/area,inletDepth=reserveTop+p.inletClearance,floorElevation=p.inletElevation-inletDepth;
    const startLevels=Array.from({length:p.maxParallel},(_,i)=>p.stopLevel+(i+1)*perStage/area);
    const fits=diameter>=p.minDiameter-1e-9&&drawdown<=p.maxDrawdown+1e-9&&inletDepth<=p.maxDepthBelowInlet+1e-9;
    return {diameter,area,active,perStage,drawdown,stop:p.stopLevel,start,startLevels,alarm:start+p.alarmGap,
      reserve,reserveTop,inletDepth,floorElevation,topElevation,dead:area*p.stopLevel,belowInlet:area*inletDepth,
      byStarts,byRun,maxFlow,limit,targetReserve,fits,theoreticalMaxStarts:maxFlow/(4*perStage),worstRunSeconds:3600*perStage/maxFlow};
  };
  const sizes=[...new Set([p.minDiameter,...[0.8,1,1.2,1.5,1.8,2,2.5,3,4,5,6,8,10].filter(x=>x>=p.minDiameter)])].sort((a,b)=>a-b);
  let last=null,lastError=null;
  for(const size of(p.diameter==='auto'?sizes:[p.diameter])){try{last=candidate(size);if(last.fits)return last;}catch(e){lastError=e;}}
  if(last)return last;throw lastError||new Error('Nincs számítható aknageometria.');
}
export function geometryDiagnostics(p,g){
  const m=n=>Number(n).toLocaleString('hu-HU',{minimumFractionDigits:3,maximumFractionDigits:8});
  const stageMin=p.maxParallel*p.minDrawdown;
  const minimumDepth=p.stopLevel+stageMin+p.alarmGap+p.inletClearance;
  return [
    {id:'diameter',pass:g.diameter>=p.minDiameter-1e-9,actual:g.diameter,limit:p.minDiameter,
      detail:g.diameter>=p.minDiameter-1e-9?`Az aknaátmérő ${m(g.diameter)} m ≥ ${m(p.minDiameter)} m minimum.`:`Az akna belső átmérője ${m(g.diameter)} m, az elrendezési minimum ${m(p.minDiameter)} m; a hiány ${m(p.minDiameter-g.diameter)} m. Válassz legalább a minimumot elérő átmérőt, vagy automatikus átmérőválasztást.`},
    {id:'drawdown',pass:g.drawdown<=p.maxDrawdown+1e-9,actual:g.drawdown,limit:p.maxDrawdown,
      detail:g.drawdown<=p.maxDrawdown+1e-9?`A kapcsolási magasság ${m(g.drawdown)} m ≤ ${m(p.maxDrawdown)} m maximum.`:`A teljes kapcsolási szintkülönbség ${m(g.drawdown)} m, a megengedett maximum ${m(p.maxDrawdown)} m; a túllépés ${m(g.drawdown-p.maxDrawdown)} m. ${stageMin>p.maxDrawdown+1e-9?`Már a minimum szintlépcsők összege is ${p.maxParallel} × ${m(p.minDrawdown)} = ${m(stageMin)} m, ezért pusztán nagyobb átmérő sem elég; a fokozatszámot vagy a megadott szintkorlátokat vizsgáld felül.`:`Az üzemi tér ${m(g.active)} m³ / az alapterület ${m(g.area)} m² adja ezt a magasságot. Nagyobb aknaátmérő csökkentheti, ha a minimum szintlépcső nem a meghatározó.`}`},
    {id:'depth',pass:g.inletDepth<=p.maxDepthBelowInlet+1e-9,actual:g.inletDepth,limit:p.maxDepthBelowInlet,
      detail:g.inletDepth<=p.maxDepthBelowInlet+1e-9?`A befolyó alatti mélység ${m(g.inletDepth)} m ≤ ${m(p.maxDepthBelowInlet)} m maximum.`:`A szükséges mélység a befolyó alatt ${m(g.inletDepth)} m, a megadott maximum ${m(p.maxDepthBelowInlet)} m; a túllépés ${m(g.inletDepth-p.maxDepthBelowInlet)} m. Összetevők: leállítási vízmélység ${m(g.stop)} + kapcsolási magasság ${m(g.drawdown)} + biztonsági tárolás ${m(g.reserve/g.area)} + befolyó alatti tartalék ${m(p.inletClearance)} m. ${minimumDepth>p.maxDepthBelowInlet+1e-9?`A megadott minimumokból adódó legkisebb mélység is ${m(minimumDepth)} m; ezért nagyobb átmérő sem elég a ${m(p.maxDepthBelowInlet)} m mélységi korláthoz.`:'Nagyobb átmérő vagy felülvizsgált mélységi/tárolási feltétel szükséges.'} Az előírt bemerülést és tartalékot tartsd meg.`},
  ];
}
function fifoQueue(initialVolume){
  const parts=initialVolume>0?[{v:initialVolume,t:0,initial:true}]:[];let head=0,initial=initialVolume;
  return {
    add(part){if(part.v>1e-12)parts.push({...part});},oldest(){return parts[head]?.t??null;},initial(){return Math.max(0,initial);},
    take(amount){const removed=[];
      while(amount>1e-10&&head<parts.length){const part=parts[head],v=Math.min(amount,part.v);removed.push({v,t:part.t,initial:part.initial});if(part.initial)initial-=v;part.v-=v;amount-=v;if(part.v<1e-10)head++;}
      if(head>1000){parts.splice(0,head);head=0;}return removed;
    },
  };
}
export function simulate(p,g,profile,flowAt,pipeVolume,{stepSeconds=60}={}){
  const warmupDays=Math.min(30,Math.max(7,Math.ceil((g.dead+g.active+pipeVolume)/p.daily)+2));
  const observationDays=3,begin=warmupDays*24,end=begin+observationDays*24;
  const wet=fifoQueue(g.dead),pipe=fifoQueue(pipeVolume);
  const starts=Array.from({length:p.workingCount},()=>[]),observedStarts=Array(p.workingCount).fill(0),runningHours=Array(p.workingCount).fill(0);
  let t=0,volume=g.dead,running=[],lead=0,initialVolume=volume,initialAtObservation=g.dead+pipeVolume;
  let inflow=0,pumped=0,overflow=0,integral=0,wetMaxAge=0,systemMaxAge=0,systemMinAge=Infinity,maxObservedVolume=volume,minObservedVolume=Infinity,events=0;
  let offSince=0,maxOff=0;const series=[];
  while(t<end-1e-9){
    if(++events>400000)throw new Error('Túl sok kapcsolási esemény. Növeld a kapcsolási térfogatot.');
    const observed=t>=begin-1e-9;
    if(running.length&&volume<=g.dead+1e-9){running=[];offSince=t;lead=(lead+1)%p.workingCount;}
    while(running.length<p.maxParallel&&volume>=g.dead+(running.length+1)*g.perStage-1e-9){
      const device=(lead+running.length)%p.workingCount;running.push(device);starts[device].push(t);
      if(observed){observedStarts[device]++;if(running.length===1)maxOff=Math.max(maxOff,t-Math.max(offSince,begin));}
    }
    const bin=Math.floor((t+1e-8)*4)%96,q=profile[bin];
    const out=running.length?flowAt(running.length,g.floorElevation+volume/g.area):0,net=q-out;
    let dt=Math.min(stepSeconds/3600,(Math.floor((t+1e-8)*60)+1)/60-t,(Math.floor((t+1e-8)*4)+1)/4-t,end-t);
    if(t<begin-1e-9)dt=Math.min(dt,begin-t);
    if(running.length<p.maxParallel&&net>0)dt=Math.min(dt,Math.max(1e-9,(g.dead+(running.length+1)*g.perStage-volume)/net));
    if(running.length&&net<0)dt=Math.min(dt,Math.max(1e-9,(volume-g.dead)/(-net)));
    const previous=volume,add=q*dt,remove=out*dt;
    wet.add({v:add,t:t+dt/2,initial:false});
    const pumpedParts=wet.take(remove);
    for(const part of pumpedParts){if(observed)wetMaxAge=Math.max(wetMaxAge,t+dt-part.t);if(pipeVolume>0)pipe.add(part);}
    const delivered=pipeVolume>0?pipe.take(remove):pumpedParts;
    if(observed)for(const part of delivered){systemMaxAge=Math.max(systemMaxAge,t+dt-part.t);if(!part.initial)systemMinAge=Math.min(systemMinAge,t+dt-part.t);}
    volume=Math.max(0,volume+add-remove);const spill=Math.max(0,volume-g.belowInlet);
    if(spill>0){wet.take(spill);volume-=spill;}
    if(observed){
      inflow+=add;pumped+=remove;overflow+=spill;integral+=(previous+volume)/2*dt;
      for(const device of running)runningHours[device]+=dt;
      maxObservedVolume=Math.max(maxObservedVolume,volume);minObservedVolume=Math.min(minObservedVolume,volume);
      if(wet.oldest()!==null)wetMaxAge=Math.max(wetMaxAge,t+dt-wet.oldest());
      systemMaxAge=Math.max(systemMaxAge,wetMaxAge);
      if(pipeVolume>0&&pipe.oldest()!==null)systemMaxAge=Math.max(systemMaxAge,t+dt-pipe.oldest());
      if(!running.length)maxOff=Math.max(maxOff,t+dt-Math.max(offSince,begin));
    }
    t+=dt;
    if(Math.abs(t-begin)<1e-7){initialVolume=volume;maxObservedVolume=volume;initialAtObservation=wet.initial()+pipe.initial();}
    if(t>=end-24-1e-8&&Math.abs(t*60-Math.round(t*60))<1e-6&&(!series.length||t-series.at(-1).absolute>1e-7))series.push({absolute:t,hour:t-(end-24),inflow:q,level:g.floorElevation+volume/g.area,on:running.length,pumpFlow:out});
  }
  const rollingStarts=starts.map(times=>{let left=0,max=0;for(let right=0;right<times.length;right++){while(times[right]-times[left]>=1-1e-9)left++;if(times[right]>=begin)max=Math.max(max,right-left+1);}return max;});
  const avgVolume=integral/(24*observationDays);
  return {series,observationDays,warmupDays,rollingStarts,observedStarts,runningHours,avgVolume,
    hydraulicMinutes:avgVolume/(p.daily/24)*60,pipeHydraulicMinutes:pipeVolume/(p.daily/24)*60,
    systemFifoMinMinutes:Number.isFinite(systemMinAge)?systemMinAge*60:null,
    fifoMaxMinutes:wetMaxAge*60,systemFifoMaxMinutes:systemMaxAge*60,totalFifoMinutes:p.upstreamMinutes===''?null:systemMaxAge*60+p.upstreamMinutes,
    maxOffMinutes:maxOff*60,initialAtObservation,inflow,pumped,overflow,initialVolume,finalVolume:volume,
    maxLevel:g.floorElevation+maxObservedVolume/g.area,minLevel:g.floorElevation+minObservedVolume/g.area,
    balanceError:initialVolume+inflow-pumped-overflow-volume};
}
// Keep a rounded display from hiding a genuine MI boundary violation.
export function formatVelocity(value){
  const rounded=Number(value.toFixed(4));
  const hidesLower=value<0.3-1e-9&&rounded>=0.3;
  const hidesUpper=value>5+1e-9&&rounded<=5;
  return (hidesLower||hidesUpper?value.toPrecision(10):value.toFixed(4)).replace('.',',');
}
export function calculate(input,simulationOptions={}){
  const p=validate(input),pump=pumps.find(x=>x.id===p.pumpId),profile=buildProfile(p);
  const points=p.flowMode==='curve'?parseCurve(p.curveText):null,g=geometry(p,pump,points),cache=new Map();
  const flowAt=(count,elevation)=>{
    if(p.flowMode==='manual')return p.manualFlows[count-1];
    const key=`${count}:${Math.round(elevation*10000)}`;
    if(!cache.has(key))cache.set(key,operatingPoint(p,points,count,elevation).flow);
    return cache.get(key);
  };
  const operating=Array.from({length:p.maxParallel},(_,i)=>{
    const count=i+1,waterElevation=g.floorElevation+(g.stop+g.startLevels[i])/2;
    const nominal=p.flowMode==='curve'?operatingPoint(p,points,count,waterElevation):{count,flow:p.manualFlows[i],perPump:p.manualFlows[i]/count,waterElevation,...systemHead(p,p.manualFlows[i],waterElevation)};
    const flowLow=flowAt(count,g.floorElevation+g.stop),flowHigh=flowAt(count,g.topElevation);
    return {...nominal,flowLow,flowHigh,velocityLow:systemHead(p,flowLow,g.floorElevation+g.stop).velocity,velocityHigh:systemHead(p,flowHigh,g.topElevation).velocity};
  });
  const pipeVolume=systemHead(p,0,p.inletElevation).pipeVolume,sim=simulate(p,g,profile,flowAt,pipeVolume,simulationOptions),checks=[];
  const add=(id,status,title,detail)=>checks.push({id,status,title,detail});
  checks.push(...pipePlacementChecks(p,g));
  const geometryChecks=geometryDiagnostics(p,g);
  add('geometry',g.fits?'pass':'fail','Akna és mBf fenékszint',geometryChecks.filter(c=>!c.pass).map(c=>c.detail).join('\n')||'Az átmérő, a teljes kapcsolási szintkülönbség és a befolyó alatti mélység is a megadott korláton belül van.');
  add('overflow',sim.overflow<1e-7?'pass':'fail','Visszaduzzasztás a modellben',sim.overflow<1e-7?'A szimuláció nem érte el a befolyó fenékszintjét.':'A víz elérte a befolyó szintjét; a túltöltés visszaduzzasztást vagy elöntést jelenthet.');
  add('capacity',operating.at(-1).flowLow>Math.max(...profile)?'pass':'fail','Kapacitás a csúcshozamhoz','MI 4.1.1.: az összes rendelkezésre álló kapacitás a legalsó üzemi vízszintnél is haladja meg a felvett csúcshozamot. Hidegtartalék nélkül számolva.');
  add('starts',Math.max(...sim.rollingStarts)<=g.limit?'pass':'fail','Kapcsolásszám gépenként',`Alkalmazott korlát: ${g.limit}/h; a tervezői és ismert gyártói érték minimuma. MI 21. oldal: a gyakorlati tartomány 4–16/h, nem minden gépre kötelező rögzített korlát.`);
  if(pump.maxStarts===null&&p.manufacturerStartsLimit==='')add('manufacturer-starts','pending','A típus gyártói indítási korlátja hiányzik','A mellékletek nem adnak ehhez a típushoz indítási korlátot. Az N-sorozat 30/15 indítás/h adata nem vihető át erre a típusra. A számítás a megadott tervezői értékre készül, a pontos gyártói maximum külön megadandó.');
  const knownAge=sim.systemFifoMaxMinutes;
  if(p.residenceLimit==='')add('residence','pending','Felső tartózkodásiidő-keret nincs megadva','A FIFO-idő számított eredmény; felső keret nélkül nincs időkorlát-megfelelőség. MI 4.1.1., 21. oldal: a hálózat és a szívótér együtt 5–6 óra; túllépésnél frissen tartás vizsgálandó.');
  else if(sim.initialAtObservation>1e-7)add('residence','pending','Tartózkodási idő: nem beállt modell','A bemelegítés végére a kezdeti víz nem cserélődött ki teljesen; hosszabb vizsgálat szükséges.');
  else if(knownAge>p.residenceLimit||(sim.totalFifoMinutes!==null&&sim.totalFifoMinutes>p.residenceLimit))add('residence','fail','A felvett felső időkeret túllépése',`A megadott felső keret ${p.residenceLimit} perc. MI 4.1.1.: a hálózat és a szívótér együtt 5–6 óra; frissen tartás vagy más kialakítás vizsgálandó.`);
  else if(p.upstreamMinutes==='')add('residence','pending','Tartózkodási idő: hiányzó előzmény','A szívótér és a telt nyomócső modellezett ideje a kereten belül van, de a beérkezés előtti hálózati idő nélkül az összes idő nem igazolható.');
  else add('residence','pass','A felvett felső időkeret a FIFO-modellben','A megadott hálózati idő és az akna + telt nyomócső FIFO-kora együtt a tervezői kereten belül van. Ez önmagában nem igazolja az MI alkalmazhatóságát vagy teljesítését.');
  const minimumAge=sim.systemFifoMinMinutes===null?null:sim.systemFifoMinMinutes+(p.upstreamMinutes===''?0:p.upstreamMinutes);
  add('residence-minimum',p.residenceMinimum===0?'pass':sim.initialAtObservation>1e-7||minimumAge===null?'pending':minimumAge>=p.residenceMinimum-1e-9?'pass':p.upstreamMinutes===''?'pending':'fail',`Tervezői minimum tartózkodás: ${p.residenceMinimum} perc`,p.residenceMinimum===0?'Nincs alsó időkövetelmény. Az MI-ben szereplő 5–6 óra felső időkeret, nem minimum.':`A kifolyó víz legkisebb megfigyelt FIFO-korát vizsgáljuk, a megadott hálózati előzménnyel. Ismeretlen előzményből nem állapítunk meg alsó határ alatti hibát. A felső keret külön ellenőrzés.`);
  const velocityRange={min:Math.min(...operating.map(o=>o.velocityLow)),max:Math.max(...operating.map(o=>o.velocityHigh))};
  const speedText=formatVelocity;
  const failedStages=operating.filter(o=>o.velocityLow<0.3-1e-9||o.velocityHigh>5+1e-9);
  add('velocity',failedStages.length?'fail':'pass','MI nyomócsősebesség: 0,3–5 m/s',`Összes üzemi fokozat tartománya: ${speedText(velocityRange.min)}–${speedText(velocityRange.max)} m/s. ${failedStages.length?'Határon kívül: '+failedStages.map(o=>`${o.count} gép (${speedText(o.velocityLow)}–${speedText(o.velocityHigh)} m/s)`).join('; ')+'. ':''}MI 4.2., 23. oldal: minden felvett fokozat, a leállítás és az utolsó indítás közötti vízszinteken; a középvízszinti érték önmagában nem elég. Állásidőben a sebesség nulla, ezt nem vizsgáljuk a minimumhoz.`);
  if(p.projectVelocityMin!==''||p.projectVelocityMax!=='')add('project-velocity',(p.projectVelocityMin===''||velocityRange.min>=p.projectVelocityMin-1e-9)&&(p.projectVelocityMax===''||velocityRange.max<=p.projectVelocityMax+1e-9)?'pass':'fail','Külön tervezői sebességkövetelmény',`Felvett alsó / felső határ: ${p.projectVelocityMin===''?'nincs':p.projectVelocityMin} / ${p.projectVelocityMax===''?'nincs':p.projectVelocityMax} m/s. Az MI külön 0,3–5 m/s ellenőrzését ez nem módosítja. Az 5 m/s feletti sebesség fizikailag lehetséges, az idézett MI-határt viszont túllépi.`);
  if(p.application==='workplace')add('pipe-diameter',p.pipeDiameter>=150?'pass':'fail','MI hálózati nyomócső: legalább 150 mm','MI 4.2. hálózati előírás. Az FCSM lakossági bekötési szabálya eltérő esetkör; a konkrét telephelyre való alkalmazás egyeztetendő.');
  if(p.flowMode==='manual')add('duty','pending','Kézzel megadott fokozati vízhozamok','Ezekhez szükséges H-t és rendszerjelleggörbét számolunk. Automatikus munkapont csak pontos Q–H görbével adható; több gépnél sem feltételezünk N×Q szállítást.');
  else add('duty','pass','Q–H és rendszerjelleggörbe metszése','A megadott monoton Q–H görbe interpolációja és Colebrook–White veszteségszámítás. Azonos gépek közös nyomóvezetéken; az eltérő ágveszteségek nincsenek modellezve. A görbe eredetét a felhasználó igazolja.');
  if(p.flowMode==='curve'&&p.curveSource==='catalogue')add('curve-source','pending','Újrarajzolt görbe: táblázatos másodlagos forrás','A feltöltött PDF numerikus Q–H táblázataiból, képi digitalizálás nélkül. 50 Hz; lineáris interpoláció. Nem eredeti gyártói görbeoldal és nem igazolt járókerék-/motorkivitel. A hivatkozott eredeti katalógus adataival külön összevetendő.');
  if(pump.usage==='drainage')add('pump-application','pending','Szennyezettvíz-típus: szennyvízalkalmasság ellenőrizendő','Az SX/STA család alkalmazhatósága nyers, darabos szennyvízre a gyűjteményből nem igazolható. Ellenőrizd az átömlő keresztmetszetet, megengedett közeget és a gyártói alkalmazási korlátokat.');
  if(operating.some(o=>o.transition))add('transition','pending','Átmeneti Reynolds-tartomány','Re 2300–4000 között a lamináris és Colebrook-becslés közül a nagyobb ellenállást vesszük. Részletesebb ellenőrzés szükséges.');
  if(p.outletElevation+p.backpressureHead<=g.topElevation)add('siphon','pending','Gravitációs vagy szifonhatás lehetősége','A végpont piezometrikus szintje nem magasabb a felső üzemi vízszintnél. Hosszelvény és légtelenítés külön vizsgálandó; szivattyú nélküli szifonáramlást nem modellezünk.');
  add('installation','pending','Minimális bemerülés és beépíthetőség','A leállítási vízmélységet és az elrendezési minimumátmérőt a pontos kivitel rajza és hűtési követelménye igazolja. A gépészet kiszorított térfogatát nem vonjuk le.');
  if(p.application==='house'&&p.fcsmSingleDwelling==='yes')add('fcsm',g.active>=0.2&&g.reserve>=p.daily?'pass':'fail','FCSM: egylakásos, 4 fős eset','A 2020-as részlet: min. 0,2 m³ üzemi tér és 1 napi kibocsátásnyi biztonsági tér a befolyó alatt.');
  if(p.application==='house'&&p.fcsmSingleDwelling!=='yes')add('fcsm','pending','Lakóépület: üzemeltetői tárolási követelmény','Általános lakóépület, a megadott napi mennyiséggel és profillal. Az egylakásos, 4 fős esetre megadott 0,2 m³ és egynapi tartalék nem általánosítható automatikusan; a megfelelő FCSM-feltétel külön igazolandó.');
  const chartMax=points?points.at(-1).q*p.maxParallel:Math.max(...p.manualFlows)*1.3;
  const systemCurve=Array.from({length:81},(_,i)=>{const flow=chartMax*i/80;return {flow,head:systemHead(p,flow,operating[0].waterElevation).head};});
  const chartOperating=points?Array.from({length:p.maxParallel},(_,i)=>operatingPoint(p,points,i+1,operating[0].waterElevation)):[];
  const curveProvenance=p.flowMode!=='curve'?null:p.curveSource==='catalogue'?catalogueCurve(p.pumpId).provenance:{verification:'user-entered',model:pump.name,label:p.curveLabel,originalCatalogueVerified:false,method:'user-supplied numeric points; piecewise-linear interpolation'};
  return {parameters:p,pump,profile,geometry:g,simulation:sim,checks,geometryChecks,hydraulics:{operating,velocityRange,pipeVolume,points,systemCurve,curveProvenance,
    chartOperating,pumpCurves:points?Array.from({length:p.maxParallel},(_,i)=>points.map(point=>({flow:point.q*(i+1),head:pumpHead(points,point.q)}))):[],referenceElevation:operating[0].waterElevation}};
}
