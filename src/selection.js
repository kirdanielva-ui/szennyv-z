import {calculate} from './calculations.js';
import {pumps} from './pumps.js';

// Catalogue screening; nominal P₂ is available, efficiency and input power are not.
export function selectPumps(input){
  const candidates=[],excluded=[];
  for(const pump of pumps){
    if(!pump.curve){excluded.push({id:pump.id,name:pump.name,reason:'Ehhez a családhoz nincs beépített számítható modell.'});continue;}
    if(pump.usage==='drainage'){excluded.push({id:pump.id,name:pump.name,reason:'Szennyezettvíz-típus; az alapértelmezett szennyvíz-előválasztásból kizárva.'});continue;}
    try{
      // A manufacturer limit entered for the currently selected model is not transferable.
      const r=calculate({...input,pumpId:pump.id,curveModelId:pump.id,flowMode:'curve',curveSource:'catalogue',manufacturerStartsLimit:''});
      const duty=r.hydraulics.operating.at(-1),requiredFlow=Math.max(...r.profile);
      const reasons=r.checks.filter(c=>c.status==='fail').map(c=>`${c.title}: ${c.detail}`);
      candidates.push({id:pump.id,name:pump.name,estimated:Boolean(pump.curve.estimated),powerRange:pump.power,powerKw:pump.curve.powerKw,totalNominalKw:pump.curve.powerKw===null?null:pump.curve.powerKw*r.parameters.maxParallel,
        flow: duty.flow,head:duty.head,minFlow:duty.flowLow,requiredFlow,diameter:r.geometry.diameter,active:r.geometry.active,
        velocityRange:r.hydraulics.velocityRange,eligible:reasons.length===0,reasons,
        pending:r.checks.filter(c=>c.status==='pending').map(c=>c.title)});
    }catch(e){candidates.push({id:pump.id,name:pump.name,estimated:Boolean(pump.curve.estimated),powerRange:pump.power,powerKw:pump.curve.powerKw,eligible:false,reasons:[e.message],pending:[]});}
  }
  candidates.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||Number(a.estimated)-Number(b.estimated)||(a.estimated?(a.minFlow??Infinity)-(b.minFlow??Infinity):(a.totalNominalKw??Infinity)-(b.totalNominalKw??Infinity))||a.id.localeCompare(b.id));
  return {candidates,excluded,best:candidates.find(c=>c.eligible)??null,objective:'tabulated-models-by-total-P2; estimated-N-models-separately-by-flow',
    notice:'A táblázatos típusokat az összes névleges P₂ szerint rangsoroljuk. A becsült N-családmodelleket külön, a csúcshozamot teljesítő legkisebb üzemi Q szerint soroljuk; pontos motorteljesítményt nem rendelünk a családgörbéhez. Nem energia- vagy hatásfok-optimalizálás. A gépszámot és a csőátmérőt nem változtatjuk. A gyártói indítás, közegalkalmasság, bemerülés és eredeti kivitelgörbe külön igazolandó.'};
}
