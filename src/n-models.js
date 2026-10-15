// User-requested scenario curves derived from approximate family envelopes.
// These are mathematical assumptions, NOT Flygt impeller/motor performance data.
export function createNModel(table){
  const midpoints=table.rows.map(row=>({q:row.qM3h,h:Number(((row.hMinM+row.hMaxM)/2).toFixed(6))}));
  const peak=midpoints.reduce((best,point,i)=>point.h>midpoints[best].h?i:best,0);
  const points=midpoints.slice(peak);
  if(points.length<3||points.some((point,i)=>i&&point.h>points[i-1].h))throw new Error('Az N-család középvonalának nincs megfelelő csökkenő ága.');
  return {model:table.id,pdfPage:table.pdfPage,estimated:true,bounded:true,powerKw:null,
    points,headM:points.map(p=>p.h),qLps:points.map(p=>p.q/3.6),
    method:'At each tabulated Q: Hmodel=(Hlower+Hupper)/2. Use only the descending branch starting at the midpoint maximum. Linear interpolation within this branch; no extension to Q=0 and no extrapolation.',
    excludedLowFlowPoints:peak,range:{minQ:points[0].q,maxQ:points.at(-1).q},
  };
}
