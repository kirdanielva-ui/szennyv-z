// MI-10-167/3–87 pp. 2–3, 8–10, 23. SI internally, Q input in m³/h.
export const GRAVITY=9.80665;
export const VISCOSITY=1.31e-6;

export function frictionFactor(reynolds,relativeRoughness) {
  if(reynolds<=0)return 0;
  if(reynolds<2300)return 64/reynolds;
  let x=7;
  for(let i=0;i<40;i++) {
    const next=-2*Math.log10(relativeRoughness/3.71+2.51*x/reynolds);
    if(Math.abs(next-x)<1e-10){x=next;break;}x=next;
  }
  const turbulent=1/(x*x);
  return reynolds<4000?Math.max(64/reynolds,turbulent):turbulent;
}
export function systemHead(p,flow,waterElevation) {
  const diameter=p.pipeDiameter/1000,area=Math.PI*diameter**2/4;
  const velocity=flow/3600/area,reynolds=Math.abs(velocity)*diameter/VISCOSITY;
  const friction=frictionFactor(reynolds,p.roughnessMm/1000/diameter);
  const velocityHead=velocity**2/(2*GRAVITY),staticHead=p.outletElevation-waterElevation+p.backpressureHead;
  const frictionLoss=friction*p.pipeLength/diameter*velocityHead,localLoss=p.minorLossK*velocityHead;
  const exitVelocityHead=p.outletMode==='free'?velocityHead:0;
  return {head:staticHead+frictionLoss+localLoss+exitVelocityHead,staticHead,frictionLoss,localLoss,exitVelocityHead,
    velocity,reynolds,friction,transition:reynolds>=2300&&reynolds<4000,pipeVolume:area*p.pipeLength};
}
export function parseCurve(text) {
  const rows=String(text).trim().split(/\r?\n/).filter(s=>s.trim()&&!s.trim().startsWith('#'));
  const points=rows.map((line,index)=>{
    const columns=/[;\t ]/.test(line.trim())?line.trim().split(/[;\t ]+/):line.trim().split(',');
    if(columns.length!==2)throw new Error(`Q–H görbe, ${index+1}. sor: két oszlop kell (Q m³/h; H m).`);
    const [q,h]=columns.map(v=>Number(v.replace(',','.')));
    if(!Number.isFinite(q)||!Number.isFinite(h)||q<0||h<0||q>10000||h>1000)throw new Error(`Q–H görbe, ${index+1}. sor: hibás vagy tartományon kívüli adat.`);
    return {q,h};
  });
  if(points.length<3||points.length>200)throw new Error('A Q–H görbéhez 3–200 adatpont szükséges.');
  if(points[0].q!==0)throw new Error('A Q–H görbe első pontja Q = 0 legyen (zárási emelőmagasság).');
  for(let i=1;i<points.length;i++)if(points[i].q<=points[i-1].q||points[i].h>points[i-1].h)throw new Error('Növekvő Q és nem növekvő H szükséges; a modell egy monoton jelleggörbeágat kezel.');
  if(points[0].h===points.at(-1).h)throw new Error('A Q–H görbe ne legyen teljesen vízszintes.');
  return points;
}
export function pumpHead(points,flowPerPump) {
  if(flowPerPump<points[0].q||flowPerPump>points.at(-1).q)return null;
  for(let i=1;i<points.length;i++)if(flowPerPump<=points[i].q){const a=points[i-1],b=points[i];return a.h+(b.h-a.h)*(flowPerPump-a.q)/(b.q-a.q);}
  return points.at(-1).h;
}
export function operatingPoint(p,points,count,waterElevation) {
  const high=points.at(-1).q*count;
  const residual=q=>pumpHead(points,q/count)-systemHead(p,q,waterElevation).head;
  if(residual(0)<=0)throw new Error(`${count} üzemi gép: a zárási emelőmagasság nem haladja meg a statikus igényt (${waterElevation.toFixed(3)} mBf vízszintnél).`);
  if(residual(high)>0)throw new Error(`${count} üzemi gép: a munkapont a megadott Q–H görbén kívülre esik. Bővebb gyártói görbe kell; extrapolációt nem végzünk.`);
  let a=0,b=high;
  for(let i=0;i<48;i++){const m=(a+b)/2;if(residual(m)>0)a=m;else b=m;}
  const flow=(a+b)/2;
  return {count,flow,perPump:flow/count,waterElevation,...systemHead(p,flow,waterElevation)};
}
