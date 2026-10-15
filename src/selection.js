import {calculate} from './calculations.js';
import {pumps} from './pumps.js';

// Catalogue screening; nominal P₂ is available, efficiency and input power are not.
export function selectPumps(input){
  const margin=Number(input.selectionMargin);
  if(input.selectionMargin===''||!Number.isFinite(margin)||margin<0||margin>200)throw new Error('A kapacitástöbblet 0 és 200% közötti szám legyen.');
  const candidates=[],excluded=[];
  for(const pump of pumps){
    if(!pump.curve){excluded.push({id:pump.id,name:pump.name,reason:'Pontos Q–H pontsor hiányzik; tartományábrából nem számolunk munkapontot.'});continue;}
    if(pump.usage==='drainage'&&input.selectionDrainage!=='yes'){excluded.push({id:pump.id,name:pump.name,reason:'Szennyezettvíz-típus; az alapértelmezett szennyvíz-előválasztásból kizárva.'});continue;}
    try{
      // A manufacturer limit entered for the currently selected model is not transferable.
      const r=calculate({...input,pumpId:pump.id,curveModelId:pump.id,flowMode:'curve',curveSource:'catalogue',manufacturerStartsLimit:''});
      const duty=r.hydraulics.operating.at(-1),requiredFlow=Math.max(...r.profile)*(1+margin/100);
      const reasons=r.checks.filter(c=>c.status==='fail').map(c=>c.title);
      if(duty.flowLow<requiredFlow-1e-9)reasons.push(`A ${margin}% kapacitástöbblet nem teljesül.`);
      candidates.push({id:pump.id,name:pump.name,powerKw:pump.curve.powerKw,totalNominalKw:pump.curve.powerKw*r.parameters.maxParallel,
        flow: duty.flow,head:duty.head,minFlow:duty.flowLow,requiredFlow,diameter:r.geometry.diameter,active:r.geometry.active,
        velocityRange:r.hydraulics.velocityRange,eligible:reasons.length===0,reasons,
        pending:r.checks.filter(c=>c.status==='pending').map(c=>c.title)});
    }catch(e){candidates.push({id:pump.id,name:pump.name,powerKw:pump.curve.powerKw,eligible:false,reasons:[e.message],pending:[]});}
  }
  candidates.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(a.totalNominalKw??Infinity)-(b.totalNominalKw??Infinity)||a.powerKw-b.powerKw||a.id.localeCompare(b.id));
  return {candidates,excluded,best:candidates.find(c=>c.eligible)??null,margin,objective:'minimum-total-nominal-P2',
    notice:'Az adott gépszámhoz, vezetékhez, terheléshez és aknakorlátokhoz rangsorolunk; a teljes párhuzamos fokozat névleges P₂-összege szerint. Nem energia- vagy hatásfok-optimalizálás. A gépszámot és a csőátmérőt nem változtatjuk. A gyártói indítás, közegalkalmasság, bemerülés és eredeti kivitelgörbe külön igazolandó.'};
}
