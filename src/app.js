import {calculate, defaults, validate} from './calculations.js';
import {pumps} from './pumps.js';

const $=selector=>document.querySelector(selector);
const form=$('#parameters'), storageKey='atemelo-project-v1';
const fmt=(n,d=2)=>Number(n).toLocaleString('hu-HU',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let result=null, timer;
$('#pump-select').innerHTML=pumps.map(p=>`<option value="${p.id}">${p.name} · ${p.power} kW</option>`).join('');
$('#shift-rows').innerHTML=defaults.shifts.map((_,i)=>`<div class="shift-row" data-shift="${i}"><span>${String(i+1).padStart(2,'0')}</span><label><span class="sr-only">${i+1}. műszak kezdete, óra</span><input type="number" name="shift-${i}-start" min="0" max="23.75" step="0.25" aria-label="${i+1}. műszak kezdete, óra"></label><label><span class="sr-only">${i+1}. műszak hossza, óra</span><input type="number" name="shift-${i}-hours" min="0.25" max="24" step="0.25" aria-label="${i+1}. műszak hossza, óra"></label><label><span class="sr-only">${i+1}. műszak létszáma</span><input type="number" name="shift-${i}-people" min="0" max="100000" step="1" aria-label="${i+1}. műszak létszáma"></label></div>`).join('');
$('#hourly-fields').innerHTML=defaults.hourly.map((_,h)=>`<label>${String(h).padStart(2,'0')}:00<input name="hour-${h}" type="number" min="0" max="100000" step="0.1" aria-label="${h}. óra relatív befolyási súlya"></label>`).join('');

function fill(p) {
  for(const [key,value] of Object.entries(p)) if(form.elements.namedItem(key)) form.elements.namedItem(key).value=value;
  for(let i=0;i<3;i++) for(const key of ['start','hours','people']) form.elements.namedItem(`shift-${i}-${key}`).value=p.shifts[i]?.[key] ?? defaults.shifts[i][key];
  p.hourly.forEach((v,h)=>form.elements.namedItem(`hour-${h}`).value=v);
  sync();
}
function read() {
  const data=Object.fromEntries(new FormData(form));
  const p={};
  for(const [key,value] of Object.entries(defaults)) {
    if(key==='shifts' || key==='hourly') continue;
    const raw=form.elements.namedItem(key)?.value ?? data[key] ?? value;
    p[key]=typeof value==='number' ? (raw===''?'':Number(raw)) : raw;
  }
  p.shifts=Array.from({length:3},(_,i)=>Object.fromEntries(['start','hours','people'].map(key=>[key,data[`shift-${i}-${key}`]===''?'':Number(data[`shift-${i}-${key}`])])));
  p.hourly=Array.from({length:24},(_,h)=>data[`hour-${h}`]===''?'':Number(data[`hour-${h}`]));
  return p;
}
function sync() {
  const house=form.elements.application.value==='house';
  const custom=form.elements.profile.value==='custom';
  $('#workplace-options').hidden=house; $('#house-note').hidden=!house;
  $('#shift-options').hidden=custom; $('#custom-profile').hidden=!custom;
  document.querySelectorAll('[data-shift]').forEach((row,i)=>row.hidden=i>=Number(form.elements.shiftCount.value));
  form.elements.reserveHours.disabled=house;
  form.elements.basePercent.disabled=house;
  $('#reserve-hint').textContent=house?'FCSM-részlet, eredeti 22. oldal: ebben az esetben legalább 1 napi kibocsátásnyi biztonsági térrel számolunk, az üzemi téren felül.':'Tervezői felvétel: Qnapi / 24 × óra. A 2 óra nem FCSM-előírás, és nem igazolja a csúcsterhelés melletti hibaáthidalást.';
  const pump=pumps.find(p=>p.id===form.elements.pumpId.value);
  $('#pump-info').innerHTML=`<div><small>Motortartomány</small><strong>${pump.power} kW</strong></div><div><small>Nyomócsonk</small><strong>${pump.discharge} mm</strong></div><div><small>Prospektuskorlát</small><strong>≤ ${pump.maxStarts} ind./h</strong><br><a href="/docs/flygt-n-896876.pdf#page=${pump.page}" target="_blank" rel="noopener">PDF ${pump.page}. oldal ↗</a></div>`;
}

function well(g) {
  const top=Math.max(g.reserveTop,g.alarm,g.start,g.stop,g.belowInlet/g.area)*1.1;
  const y=h=>270-h/top*235;
  const line=(h,label,color,dash='')=>`<line x1="66" x2="244" y1="${y(h)}" y2="${y(h)}" stroke="${color}" stroke-width="1.4" ${dash?'stroke-dasharray="4 3"':''}/><text x="251" y="${y(h)+4}" fill="${color}" font-size="10">${label}</text>`;
  return `<svg viewBox="0 0 330 310" role="img" aria-label="Akna vázlata: leállítás, indítás, vészjelzés és biztonsági tárolószint"><defs><pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="#c2d4bc" stroke-width="2"/></pattern></defs>
    <rect x="52" y="23" width="189" height="259" rx="4" fill="#eef2e9"/>
    <rect x="64" y="28" width="165" height="242" fill="#fff"/>
    <rect x="64" y="${y(g.reserveTop)}" width="165" height="${Math.max(0,y(g.start)-y(g.reserveTop))}" fill="url(#hatch)"/>
    <rect x="64" y="${y(g.start)}" width="165" height="${y(g.stop)-y(g.start)}" fill="#bee2d7"/>
    <rect x="64" y="${y(g.stop)}" width="165" height="${270-y(g.stop)}" fill="#dae7df"/>
    <path d="M58 28V276H236V28" fill="none" stroke="#6b8272" stroke-width="2"/>
    <path d="M15 ${y(g.belowInlet/g.area)}H64" fill="none" stroke="#526e5c" stroke-width="7"/>
    ${line(g.belowInlet/g.area,'Befolyó','#607763')}${line(g.reserveTop,'Tartalék','#8c986f','dash')}${line(g.alarm,'Vészjelzés','#ac7e28','dash')}${line(g.start,'Indítás','#087c72','dash')}${line(g.stop,'Leállítás','#547e6b','dash')}
    <path d="M103 262v-14a15 15 0 0 1 30 0v14Z" fill="#476b60"/><rect x="109" y="225" width="18" height="17" rx="3" fill="#718d7b"/><path d="M133 252h18V38h25" stroke="#7a9282" stroke-width="6" fill="none"/>
    <line x1="64" x2="229" y1="294" y2="294" stroke="#7a9282"/><path d="m69 291-5 3 5 3m155-6 5 3-5 3" fill="none" stroke="#7a9282"/><text x="146" y="307" text-anchor="middle" fill="#607563" font-size="10">belső Ø ${fmt(g.diameter)} m</text></svg>`;
}
function chart(data,key,{height=160,color='#087c72',max,reference,unit}) {
  const width=680,left=43,right=12,top=13,bottom=27,w=width-left-right,h=height-top-bottom;
  max=Math.max(max||0,...data.map(d=>d[key]),reference||0,0.01)*1.12;
  const x=t=>left+t/24*w,y=v=>top+h-v/max*h;
  const path=data.map((d,i)=>`${i?'L':'M'}${x(Math.min(24,Math.max(0,d.hour))).toFixed(2)},${y(d[key]).toFixed(2)}`).join(' ');
  const area=`${path} L${x(24)},${top+h} L${x(0)},${top+h} Z`;
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${unit}: napi diagram 0 és 24 óra között">
    ${[0,0.5,1].map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(max*v)}" y2="${y(max*v)}" stroke="#e7ede4"/><text x="${left-9}" y="${y(max*v)+3}" text-anchor="end" font-size="9" fill="#7c897a">${fmt(max*v,1)}</text>`).join('')}
    <path d="${area}" fill="${color}" opacity="0.09"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>
    ${reference===undefined?'':`<line x1="${left}" x2="${width-right}" y1="${y(reference)}" y2="${y(reference)}" stroke="#9baa99" stroke-dasharray="5 4"/>`}
    ${[0,4,8,12,16,20,24].map(t=>`<text x="${x(t)}" y="${height-7}" text-anchor="middle" font-size="9" fill="#7c897a">${String(t).padStart(2,'0')}:00</text>`).join('')}
  </svg>`;
}
function render(r) {
  const {parameters:p,geometry:g,simulation:s,checks}=r;
  $('#result-title').textContent=p.project || 'Névtelen projekt';
  const fails=checks.filter(c=>c.status==='fail').length, pending=checks.filter(c=>c.status==='pending').length;
  $('#result-summary').className=`result-summary${fails?' fail':''}`;
  $('#result-summary').innerHTML=`<div class="summary-icon" aria-hidden="true">${fails?'!':'≋'}</div><div><strong>${fails?`${fails} számítási feltétel nem teljesül`:'Előméretezés elkészült'}</strong><p>${fails?'A javaslatot a jelzett korlátok miatt módosítani kell.':`A felvett modellben ${checks.filter(c=>c.status==='pass').length} ellenőrzés teljesül.`} ${pending} feltétel egyeztetésre vagy adatlapra vár. Ez nem végleges megfelelőségi igazolás.</p></div>`;
  $('#metrics').innerHTML=[
    ['Belső aknaátmérő',fmt(g.diameter),'m',p.diameter==='auto'?'Geometriai javaslat':'Rögzített átmérő'],
    ['Hasznos kapcsolási tér',fmt(g.active),'m³',`Szintkülönbség: ${fmt(g.drawdown)} m`],
    ['Biztonsági tárolótér',fmt(g.reserve),'m³',p.application==='house'?'FCSM · 1 napi mennyiség':`Tervezői igény: ${fmt(p.reserveHours,1)} átlaghozam-óra`],
  ].map(([label,value,unit,sub])=>`<div class="metric"><span class="metric-label">${label}</span><div class="metric-value">${value}<small>${unit}</small></div><div class="metric-sub">${sub}</div></div>`).join('');
  $('#well-diagram').innerHTML=well(g);
  $('#level-table').innerHTML=[
    ['Befolyócső fenékszintje',p.inletLevel,''],['Biztonsági tárolás felső szintje',g.reserveTop,''],
    ['Vészvízszintjelzés',g.alarm,'alert'],['Üzemi indítás',g.start,'accent'],['Közös leállítás',g.stop,''],
  ].map(([label,value,cls])=>`<div class="level-row ${cls}"><span>${label}</span><strong>+${fmt(value,3)} m</strong></div>`).join('')+`<div class="mini-volumes"><div><span>Leállítás alatti maradó víz</span><strong>${fmt(g.dead,3)} m³</strong></div><div><span>Befolyó alatti teljes aknatér</span><strong>${fmt(g.belowInlet,3)} m³</strong></div></div>`;
  $('#level-chart').innerHTML=chart(s.series,'level',{height:185,max:g.start,reference:g.start,unit:'Vízszint, m a fenéktől'});
  $('#flow-chart').innerHTML=chart(s.series,'inflow',{height:115,color:'#7c9dab',unit:'Befolyó vízhozam, m³/h'});
  $('#operation-stats').innerHTML=[
    ['Max. indítás / gép',`${fmt(Math.max(...s.rollingStarts),0)} /h`,`Gördülő 60 perc · korlát ${fmt(g.limit,0)}/h`],
    ['Átlagos hidraulikai idő',`${fmt(s.hydraulicMinutes,0)} perc`,'τ = átlagos víztér / átlaghozam'],
    ['Legnagyobb FIFO vízkor',`${fmt(s.fifoMaxMinutes,0)} perc`,p.residenceLimit===''?'Időkorlát még nincs megadva':`Tervezői korlát: ${fmt(p.residenceLimit,0)} perc`],
  ].map(([label,value,sub])=>`<div class="operation-stat"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');
  $('#checks').innerHTML=checks.map(c=>`<div class="check ${c.status}"><span class="check-icon" aria-label="${{pass:'Teljesül',fail:'Nem teljesül',pending:'Egyeztetendő'}[c.status]}">${{pass:'✓',fail:'×',pending:'i'}[c.status]}</span><div><strong>${esc(c.title)}</strong><p>${esc(c.detail)}</p></div></div>`).join('');
  $('#formula-output').innerHTML=[
    ['Indítási minimum: V ≥ Qsz / (4 × Zmax)',`${fmt(g.byStarts,3)} m³`],
    ['Futásidő minimum: V ≥ Qsz × tmin / 3600',`${fmt(g.byRun,3)} m³`],
    ['Kapcsolási tér: a fenti és geometriai minimumok maximuma',`${fmt(g.active,3)} m³`],
    ['Elméleti max. kapcsolási gyakoriság, egy gépre',`${fmt(g.theoreticalMaxStarts,1)} /h`],
    ['Legrövidebb futás a térfogatból, nulla befolyásnál',`${fmt(g.worstRunSeconds,1)} s`],
    ['Napi átlagos / legnagyobb befolyás',`${fmt(p.daily/24)} / ${fmt(Math.max(...r.profile))} m³/h`],
    ['Napi átlagos szivattyúzott mennyiség a modellben',`${fmt(s.pumped/s.observationDays)} m³/nap`],
    ['Vízszint minimuma / maximuma a vizsgált időben',`${fmt(s.minLevel)} / ${fmt(s.maxLevel)} m`],
    ['Leghosszabb megfigyelt állásidő',`${fmt(s.maxOffMinutes,0)} perc`],
    ['Beépített szivattyúk napi átlagos üzemideje',s.runningHours.map(h=>`${fmt(h/s.observationDays)} h`).join(' / ')],
    ['Befolyószinten elszámolt túltöltés (3 nap)',`${fmt(s.overflow,3)} m³`],
    ['Tömegmérleg eltérése (3 nap)',`${s.balanceError.toExponential(1)} m³`],
  ].map(([label,value])=>`<div class="formula-row"><span>${label}</span><strong>${value}</strong></div>`).join('')+`<p class="model-note">${s.warmupDays} nap bemelegítés + ${s.observationDays} nap vizsgálat, naponta ismételt befolyással. A kapcsolási minimumot egyetlen üzemi gépre méretezzük; a váltott üzem indításszám-csökkentését nem használjuk térfogatcsökkentésre. A geometriai térfogatok a gépészet kiszorítását nem tartalmazzák. A modell időbeli közelítése a vízkorban legfeljebb kb. 1 perces lépésből eredő eltérést okozhat.</p>`;
}

function update() {
  sync();
  try {
    const p=read(); result=calculate(p); render(result);
    $('#error').hidden=true; $('#result-content').hidden=false;
    $('#calc-state').innerHTML='<span class="dot"></span> Számítás frissítve';
    try{localStorage.setItem(storageKey,JSON.stringify({version:1,parameters:p}));}catch{}
  } catch(e) {
    result=null; $('#error').textContent=e.message; $('#error').hidden=false;
    $('#result-content').hidden=true; $('#calc-state').textContent='Adatok ellenőrzése szükséges';
  }
}
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(update,180);});
form.addEventListener('change',()=>{clearTimeout(timer);update();});
$('#reset').addEventListener('click',()=>{fill(structuredClone(defaults));update();});
$('#print').addEventListener('click',()=>window.print());
let printDetails=[];
window.addEventListener('beforeprint',()=>{
  printDetails=[...document.querySelectorAll('details')].map(element=>({element,open:element.open}));
  printDetails.forEach(({element})=>element.open=true);
});
window.addEventListener('afterprint',()=>printDetails.forEach(({element,open})=>element.open=open));
function download(name,body,type) {
  const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');
  a.href=url; a.download=name; a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('#export-json').addEventListener('click',()=>{
  if(!result)return;
  const {parameters,simulation,...summary}=result;
  const {series,...simulationSummary}=simulation;
  download('atemelo-projekt.json',JSON.stringify({version:1,createdAt:new Date().toISOString(),parameters,summary:{...summary,simulation:simulationSummary},sources:['FCSM VSZ-40/2020, 4.0, 2020.09.24., pp.22–27','Flygt 896876, 20240605, PDF pp.6,8,10'],notice:'Előméretezés. A munkapont, bemerülés és FCSM-alkalmazhatóság egyeztetendő.'},null,2),'application/json');
});
$('#export-csv').addEventListener('click',()=>{
  if(!result)return;
  const rows=['Idő [óra];Befolyás [m3/h];Vízszint [m];Működő szivattyú',...result.simulation.series.map(d=>[d.hour,d.inflow,d.level,d.on].map((v,i)=>i<3?Number(v).toFixed(4).replace('.',','):v).join(';'))];
  download('atemelo-napi-uzem.csv','\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8');
});
$('#import-json').addEventListener('change',async e=>{
  try {
    const file=e.target.files[0];if(!file)return;
    if(file.size>1000000)throw new Error('Legfeljebb 1 MB méretű projektfájl tölthető be.');
    const data=JSON.parse(await file.text());
    if(data.version!==1 || !data.parameters)throw new Error('Nem támogatott projektformátum.');
    const candidate={...structuredClone(defaults),...data.parameters};
    calculate(candidate); // Validate the complete calculation before replacing the current project.
    fill(candidate);update();$('#file-status').textContent='A projekt betöltve; az eredményt újraszámoltuk.';
  }catch(e){$('#file-status').textContent=`A projekt nem tölthető be: ${e.message}`;}
  finally{e.target.value='';}
});
let initial=structuredClone(defaults);
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.version===1){const candidate={...initial,...saved.parameters};validate(candidate);initial=candidate;}}catch{}
fill(initial);update();
