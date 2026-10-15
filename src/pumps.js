import {nRangeTables,nRangeTableSource} from './n-range-tables.js';
import {nRangeImages,nRangeSource} from './n-range-images.js';
import {catalogueSource,catalogueTables} from './pump-catalogue.js';
// Source: user-supplied Flygt brochure 896876, 2024-06-05, PDF pp. 6, 8, 10.
// These are model families, not complete hydraulic/motor variants or Q-H curves.
const nPumps = [
  ['3069', '1,5–2,4', '50 / 65 / 80', 30, 6],
  ['3085', '1,3–2,4', '80', 30, 6],
  ['3102', '3,1–4,5', '80 / 100 / 150', 30, 6],
  ['3127', '4,7–8,5', '80 / 100 / 150', 30, 6],
  ['3153', '7,5–15', '80 / 100 / 150 / 200 / 250', 30, 8],
  ['3171', '15–22', '100 / 150 / 250', 30, 8],
  ['3202', '22–47', '100 / 150 / 200 / 300', 30, 8],
  ['3301', '37–70', '150 / 250 / 300 / 350', 30, 8],
  ['3315', '48–105', '150 / 250 / 300 / 350', 30, 8],
  ['3231', '70–215', '200', 15, 10],
  ['3306', '58–100', '300', 15, 10],
  ['3312', '55–250', '300', 15, 10],
  ['3356', '45–140', '350', 15, 10],
  ['3400', '40–310', '400', 15, 10],
  ['3531', '40–680', '500', 15, 10],
  ['3800', '225–550', '800', null, null],
].map(([id,power,discharge,maxStarts,page])=>({id,name:`Flygt N ${id}`,family:'N 3000',group:'n',power,discharge,maxStarts,page,curve:null,rangePage:6+['3069','3085','3102','3127','3153','3171','3202','3301','3315','3231','3306','3312','3356','3400','3531','3800'].indexOf(id),rangeSource:'flygt-n-3000-tartomanyok.pdf',rangeTable:nRangeTables.find(table=>table.id===id),rangeTableProvenance:nRangeTableSource,rangeImage:nRangeImages[id],rangeProvenance:nRangeSource,rangeVerification:'approximate-envelope-not-for-sizing'}));

const tablePumps=catalogueTables.map(table=>({
  id:table.id,name:`Flygt ${table.model}`,family:table.family,group:'catalogue',
  power:String(table.powerKw).replace('.',','),discharge:null,maxStarts:null,page:null,
  usage:/^(SX|STA)/.test(table.model)?'drainage':'check-wastewater-application',
  curve:{...table,points:table.qLps.map((q,i)=>({q:Number((q*3.6).toFixed(6)),h:table.headM[i]}))},
}));
const missingPumps=[['c-series','C'],['f-series','F'],['concertor','Concertor']].map(([id,family])=>({
  id,name:`Flygt ${family} · pontos kivitel szükséges`,family,group:'missing',
  power:null,discharge:null,maxStarts:null,page:null,curve:null,
}));
export const pumps=[...nPumps,...tablePumps,...missingPumps];
export function catalogueCurve(pumpId){
  const pump=pumps.find(p=>p.id===pumpId);if(!pump?.curve)return null;
  return {
    text:pump.curve.points.map(p=>`${p.q};${p.h}`).join('\n'),
    label:`${pump.name} · 50 Hz · újrarajzolt táblázat, PDF ${pump.curve.pdfPage}. oldal / hivatkozott gyári katalógus ${pump.curve.cataloguePage}. oldal`,
    provenance:{...catalogueSource,model:pump.curve.model,pdfPage:pump.curve.pdfPage,
      cataloguePage:pump.curve.cataloguePage,originalQLps:[...pump.curve.qLps],originalHeadM:[...pump.curve.headM]},
  };
}
