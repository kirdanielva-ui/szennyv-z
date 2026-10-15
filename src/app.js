import {calculate,defaults,migrateProject} from './calculations.js';
import {pumps,catalogueCurve} from './pumps.js';
import {systemHead} from './hydraulics.js';

const $=s=>document.querySelector(s),form=$('#parameters'),storageKey='atemelo-project-v2';
const fmt=(n,d=2)=>Number(n).toLocaleString('hu-HU',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let result=null,timer,curveModelId=defaults.pumpId;
$('#pump-select').innerHTML=[['catalogue','30 táblázatos típus · beépített Q–H görbe, 50 Hz'],['n','N 3000 típuscsaládok · egyedi görbe szükséges'],['missing','További családok · görbeadat szükséges']].map(([group,label])=>`<optgroup label="${label}">${pumps.filter(p=>p.group===group).map(p=>`<option value="${p.id}">${p.name}${p.power?` · ${p.power} kW`:''}${p.curve?' · Q–H':' · adat szükséges'}</option>`).join('')}</optgroup>`).join('');
$('#shift-rows').innerHTML=defaults.shifts.map((_,i)=>`<div class="shift-row" data-shift="${i}"><span>${String(i+1).padStart(2,'0')}</span>${['start','hours','people'].map((key,j)=>`<label><span class="sr-only">${i+1}. műszak ${['kezdete, óra','hossza, óra','létszáma'][j]}</span><input name="shift-${i}-${key}" type="number" min="0" step="${key==='people'?1:0.25}" aria-label="${i+1}. műszak ${['kezdete, óra','hossza, óra','létszáma'][j]}"></label>`).join('')}</div>`).join('');
$('#hourly-fields').innerHTML=defaults.hourly.map((_,h)=>`<label>${String(h).padStart(2,'0')}:00<input name="hour-${h}" type="number" min="0" max="100000" step="0.1" aria-label="${h}. óra befolyási súlya"></label>`).join('');
$('#manual-flow-fields').innerHTML=Array.from({length:8},(_,i)=>`<label data-flow="${i}">${i+1} egyidejű gép összes vízhozama<div class="unit-field"><input name="manualFlow-${i}" type="number" min="0.01" max="10000" step="0.1" placeholder="Igazolt fokozati Q"><span>m³/h</span></div></label>`).join('')+'<p class="hint emphasis">A 18 m³/h kezdő érték példa, nem igazolt Flygt-munkapont. Minden fokozat összes Q-ját külön add meg: közös csövön két gép nem feltétlenül szállít kétszer annyit. Kézi módban a megadott Q a vízszinttől független felvett érték.</p>';
function fill(p){
  for(const [key,value]of Object.entries(p))if(!Array.isArray(value)&&form.elements.namedItem(key))form.elements.namedItem(key).value=value;
  for(let i=0;i<3;i++)for(const key of ['start','hours','people'])form.elements.namedItem(`shift-${i}-${key}`).value=p.shifts[i]?.[key]??defaults.shifts[i][key];
  p.hourly.forEach((v,h)=>form.elements.namedItem(`hour-${h}`).value=v);
  for(let i=0;i<8;i++)form.elements.namedItem(`manualFlow-${i}`).value=p.manualFlows[i]??'';
  curveModelId=p.curveModelId;
  if(p.curveSource==='catalogue'){
    const preset=catalogueCurve(p.pumpId);
    if(preset){form.elements.curveText.value=preset.text;form.elements.curveLabel.value=preset.label;}
  }
  sync();
}
function useCatalogueCurve(){
  const preset=catalogueCurve(form.elements.pumpId.value);if(!preset)return false;
  form.elements.flowMode.value='curve';form.elements.curveSource.value='catalogue';
  form.elements.curveText.value=preset.text;form.elements.curveLabel.value=preset.label;curveModelId=form.elements.pumpId.value;
  return true;
}
function read(){
  const p={};
  for(const [key,value]of Object.entries(defaults)){
    if(Array.isArray(value))continue;
    const raw=form.elements.namedItem(key)?.value??value;
    p[key]=typeof value==='number'?(raw===''?'':Number(raw)):raw;
  }
  p.curveModelId=curveModelId;
  p.shifts=Array.from({length:3},(_,i)=>Object.fromEntries(['start','hours','people'].map(key=>[key,form.elements.namedItem(`shift-${i}-${key}`).value])));
  p.hourly=Array.from({length:24},(_,h)=>form.elements.namedItem(`hour-${h}`).value);
  p.manualFlows=Array.from({length:8},(_,i)=>form.elements.namedItem(`manualFlow-${i}`).value);
  return p;
}
function sync(){
  const house=form.elements.application.value==='house',custom=form.elements.profile.value==='custom',curve=form.elements.flowMode.value==='curve';
  $('#workplace-options').hidden=house;$('#house-note').hidden=!house;$('#shift-options').hidden=custom;$('#custom-profile').hidden=!custom;
  document.querySelectorAll('[data-shift]').forEach((row,i)=>row.hidden=i>=Number(form.elements.shiftCount.value));
  $('#manual-flow-fields').hidden=curve;$('#curve-fields').hidden=!curve;
  document.querySelectorAll('[data-flow]').forEach((row,i)=>row.hidden=i>=Number(form.elements.maxParallel.value));
  form.elements.reserveHours.disabled=house;
  form.elements.maxParallel.max=form.elements.workingCount.value;
  $('#pump-arrangement').textContent=`${form.elements.workingCount.value} üzemképes + ${form.elements.standbyCount.value} hidegtartalék; legfeljebb ${form.elements.maxParallel.value} gép egyszerre. A hidegtartalék nem vesz részt a szimulációban.`;
  $('#reserve-hint').textContent=house?'FCSM, 22. oldal: legalább 1 napi kibocsátásnyi biztonsági tér az üzemi tér fölött.':'Tervezői tartalék: Qnapi / 24 × óra. Nem az MI által előírt tartózkodási idő, és csúcsterhelésnél nem garantál ugyanennyi hibaáthidalást.';
  const pump=pumps.find(p=>p.id===form.elements.pumpId.value);
  if(!pump){$('#pump-info').textContent='Válassz szivattyútípust.';$('#catalogue-info').textContent='';return;}
  $('#pump-info').innerHTML=`<div><small>${pump.curve?'P₂ a gyűjteményben':'Motortartomány'}</small><strong>${pump.power?`${pump.power} kW`:'Adat szükséges'}</strong></div><div><small>Nyomócsonk</small><strong>${pump.discharge?`${pump.discharge} mm`:'Adatlap kell'}</strong></div><div><small>Gyártói indítás</small><strong>${pump.maxStarts?`≤ ${pump.maxStarts} ind./h`:'Nincs megadva'}</strong>${pump.page?`<br><a href="/docs/flygt-n-896876.pdf#page=${pump.page}" target="_blank" rel="noopener">PDF ${pump.page}. oldal ↗</a>`:''}</div>`;
  const preset=catalogueCurve(pump.id),builtIn=preset&&form.elements.curveSource.value==='catalogue';
  form.elements.curveSource.querySelector('[value="catalogue"]').disabled=!preset;
  form.elements.curveText.readOnly=Boolean(builtIn);form.elements.curveLabel.readOnly=Boolean(builtIn);
  if(preset){
    const c=pump.curve;
    $('#catalogue-info').innerHTML=`<strong>Beépített táblázatos görbe · 50 Hz</strong><p>${c.points.length} eredeti táblázatpont · Q: ${fmt(c.points[0].q)}–${fmt(c.points.at(-1).q)} m³/h · H: ${fmt(c.headM.at(-1),1)}–${fmt(c.headM[0],1)} m.</p><p>Gyári táblázatokból újrarajzolt, másodlagos forrás. Numerikus pontok átvétele, képi digitalizálás nélkül; a pontok között lineáris közelítés. Az eredeti gyári katalógussal külön ellenőrizendő.</p><a href="/docs/flygt-szennyviz-szivattyugorbek.pdf#page=${c.pdfPage}" target="_blank" rel="noopener">Feltöltött PDF ${c.pdfPage}. oldal ↗</a>${!curve||!builtIn?'<button type="button" data-use-curve>Beépített görbe használata</button>':''}${pump.usage==='drainage'?'<p class="hint emphasis">Szennyezettvíz-típus: nyers szennyvízre való alkalmassága külön ellenőrizendő.</p>':''}`;
  }else $('#catalogue-info').innerHTML='<strong>Görbeadat szükséges</strong><p>Az N 3000, C, F és Concertor családok pontos járókerék-/motorváltozataihoz a melléklet nem ad pontsort. Egyedi görbét vagy igazolt fokozati Q-t adj meg.</p>';
}
function well(g){
  const top=g.inletDepth*1.12,y=h=>272-h/top*235;
  const line=(h,label,color)=>`<line x1="63" x2="238" y1="${y(h)}" y2="${y(h)}" stroke="${color}" stroke-dasharray="4 3"/><text x="243" y="${y(h)+3}" fill="${color}" font-size="9">${label}</text>`;
  return `<svg viewBox="0 0 330 314" role="img" aria-label="Akna és lépcsőzetes kapcsolási szintek"><defs><pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="#c2d4bc" stroke-width="2"/></pattern></defs><rect x="52" y="23" width="182" height="261" rx="4" fill="#eef2e9"/><rect x="64" y="28" width="158" height="244" fill="white"/><rect x="64" y="${y(g.reserveTop)}" width="158" height="${y(g.start)-y(g.reserveTop)}" fill="url(#hatch)"/><rect x="64" y="${y(g.start)}" width="158" height="${y(g.stop)-y(g.start)}" fill="#bee2d7"/><rect x="64" y="${y(g.stop)}" width="158" height="${272-y(g.stop)}" fill="#dae7df"/><path d="M58 28V278H228V28" fill="none" stroke="#6b8272" stroke-width="2"/><path d="M15 ${y(g.inletDepth)}H64" stroke="#526e5c" stroke-width="7"/>${line(g.inletDepth,'Befolyó','#607763')}${line(g.reserveTop,'Tartalék','#8c986f')}${line(g.alarm,'Vészjelzés','#ac7e28')}${g.startLevels.map((h,i)=>line(h,`${i+1}. indítás`,'#087c72')).join('')}${line(g.stop,'Leállítás','#547e6b')}<path d="M97 265v-14a14 14 0 0 1 28 0v14Z" fill="#476b60"/><rect x="104" y="228" width="16" height="17" rx="3" fill="#718d7b"/><path d="M125 253h21V37h25" stroke="#7a9282" stroke-width="6" fill="none"/><line x1="64" x2="222" y1="295" y2="295" stroke="#7a9282"/><text x="143" y="309" text-anchor="middle" fill="#607563" font-size="10">belső Ø ${fmt(g.diameter)} m</text></svg>`;
}
function timeChart(data,key,{height=160,color='#087c72',references=[],min=0,unit}){
  const width=680,left=48,right=12,top=13,bottom=27,w=width-left-right,h=height-top-bottom;
  const values=data.map(d=>d[key]),lo=min,hi=Math.max(...values,...references,lo+0.01),max=lo+(hi-lo)*1.12;
  const x=t=>left+t/24*w,y=v=>top+h-(v-lo)/(max-lo)*h;
  const path=data.map((d,i)=>`${i?'L':'M'}${x(d.hour).toFixed(2)},${y(d[key]).toFixed(2)}`).join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${unit}: napi diagram"><g>${[0,0.5,1].map(v=>{const n=lo+(max-lo)*v;return `<line x1="${left}" x2="${width-right}" y1="${y(n)}" y2="${y(n)}" stroke="#e7ede4"/><text x="${left-8}" y="${y(n)+3}" text-anchor="end" font-size="9" fill="#7c897a">${fmt(n,2)}</text>`;}).join('')}</g><path d="${path} L${x(24)},${top+h} L${x(0)},${top+h}Z" fill="${color}" opacity="0.09"/><path d="${path}" fill="none" stroke="${color}" stroke-width="1.6"/>${references.map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#9baa99" stroke-dasharray="5 4"/>`).join('')}${[0,4,8,12,16,20,24].map(t=>`<text x="${x(t)}" y="${height-7}" text-anchor="middle" font-size="9" fill="#7c897a">${String(t).padStart(2,'0')}:00</text>`).join('')}</svg>`;
}
function hydraulicChart(r){
  const {hydraulics:h,parameters:p}=r,reference=h.referenceElevation;
  const maxQ=h.systemCurve.at(-1).flow,maxH=Math.max(...h.systemCurve.map(d=>d.head),...(h.points??[]).map(d=>d.h),1)*1.08;
  const minH=Math.min(0,...h.systemCurve.map(d=>d.head)),x=q=>49+q/maxQ*615,y=head=>195-(head-minH)/(maxH-minH)*175;
  const path=points=>points.map((d,i)=>`${i?'L':'M'}${x(d.flow).toFixed(2)},${y(d.head).toFixed(2)}`).join(' ');
  // All curves and dots in this diagram share ONE suction-water elevation.
  const dots=h.operating.map(o=>({count:o.count,flow:o.flow,head:systemHead(p,o.flow,reference).head}));
  // Auto multipump dots must be actual intersections at the displayed reference.
  if(p.flowMode==='curve')for(const dot of dots){const source=h.chartOperating.find(o=>o.count===dot.count);Object.assign(dot,source);}
  return `<svg viewBox="0 0 680 225" role="img" aria-label="Rendszer- és szivattyújelleggörbék, Q m³/h és H méter">${[0,0.5,1].map(f=>{const value=minH+(maxH-minH)*f;return `<line x1="49" x2="664" y1="${y(value)}" y2="${y(value)}" stroke="#e7ede4"/><text x="40" y="${y(value)+3}" text-anchor="end" font-size="9" fill="#7c897a">${fmt(value,1)}</text>`;}).join('')}<text x="10" y="12" fill="#647777" font-size="9">H [m]</text><path d="${path(h.systemCurve)}" fill="none" stroke="#087c72" stroke-width="2"/>${h.pumpCurves.map((curve,i)=>`<path d="${path(curve)}" fill="none" stroke="${['#7c9dab','#a486b3','#b4995e'][i%3]}" stroke-width="1.5" stroke-dasharray="${i?'5 3':''}"/>`).join('')}${dots.map(d=>`<circle cx="${x(d.flow)}" cy="${y(d.head)}" r="4" fill="#17383b"/><text x="${x(d.flow)+6}" y="${y(d.head)-5}" fill="#17383b" font-size="9">${d.count} gép</text>`).join('')}${[0,0.25,0.5,0.75,1].map(f=>`<text x="${x(maxQ*f)}" y="212" text-anchor="middle" font-size="9" fill="#7c897a">${fmt(maxQ*f,1)}</text>`).join('')}<text x="610" y="224" fill="#647777" font-size="9">Q [m³/h]</text></svg>`;
}
function render(r){
  const {parameters:p,geometry:g,simulation:s,checks,hydraulics:h}=r;
  $('#result-title').textContent=p.project||'Névtelen projekt';
  const fails=checks.filter(c=>c.status==='fail').length,pending=checks.filter(c=>c.status==='pending').length;
  $('#result-summary').className=`result-summary${fails?' fail':''}`;
  $('#result-summary').innerHTML=`<div class="summary-icon" aria-hidden="true">${fails?'!':'≋'}</div><div><strong>${fails?`${fails} számítási feltétel nem teljesül`:'Előméretezés elkészült'}</strong><p>${p.workingCount} üzemképes + ${p.standbyCount} hidegtartalék · max. ${p.maxParallel} párhuzamos gép. ${pending} feltétel egyeztetésre vagy adatlapra vár.</p></div>`;
  $('#metrics').innerHTML=[['Számított aknafenékszint',fmt(g.floorElevation,3),'mBf','Befolyó – szükséges tárolási mélység'],['Belső aknaátmérő',fmt(g.diameter),'m',`Befolyó alatti mélység: ${fmt(g.inletDepth)} m`],['Teljes hasznos szívótér',fmt(g.active,3),'m³',`${p.maxParallel} szintlépcső × ${fmt(g.perStage,3)} m³`]].map(([label,value,unit,sub])=>`<div class="metric"><span class="metric-label">${label}</span><div class="metric-value">${value}<small>${unit}</small></div><div class="metric-sub">${sub}</div></div>`).join('');
  $('#well-diagram').innerHTML=well(g);
  $('#level-table').innerHTML=[['Befolyócső fenékszintje',p.inletElevation,''],['Biztonsági tárolás felső szintje',g.floorElevation+g.reserveTop,''],['Vészvízszintjelzés',g.floorElevation+g.alarm,'alert'],...g.startLevels.map((level,i)=>[`${i+1}. fokozat indítása`,g.floorElevation+level,'accent']).reverse(),['Közös leállítás',g.floorElevation+g.stop,''],['Számított aknafenék',g.floorElevation,'accent']].map(([label,value,cls])=>`<div class="level-row ${cls}"><span>${label}</span><strong>${fmt(value,3)} mBf</strong></div>`).join('')+`<div class="mini-volumes"><div><span>Leállítás alatti maradó víz</span><strong>${fmt(g.dead,3)} m³</strong></div><div><span>Biztonsági tárolótér</span><strong>${fmt(g.reserve,3)} m³</strong></div></div>`;
  $('#hydraulic-caption').textContent=p.flowMode==='curve'?`Automatikus görbemetszés · ${p.curveLabel}`:'Kézzel megadott Q-hoz számított H-igény; gyártói görbe nélkül nem automatikus munkapont.';
  $('#hydraulic-summary').innerHTML=[['Végponti magasság',`${fmt(p.outletElevation,3)} mBf`],['Nyomócső',`${fmt(p.pipeLength,0)} m / belső Ø ${fmt(p.pipeDiameter,0)} mm`],['Telt vezeték térfogata',`${fmt(h.pipeVolume,3)} m³`]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
  $('#duty-table').innerHTML=`<table><thead><tr><th>Fokozat</th><th>Összes Q</th><th>H-igény</th><th>Sebesség</th><th>Q-tartomány</th></tr></thead><tbody>${h.operating.map(o=>`<tr><td>${o.count} gép</td><td>${fmt(o.flow)} m³/h</td><td>${fmt(o.head)} m</td><td>${fmt(o.velocity)} m/s</td><td>${fmt(o.flowLow)}–${fmt(o.flowHigh)} m³/h</td></tr>`).join('')}</tbody></table>`;
  $('#hydraulic-chart').innerHTML=hydraulicChart(r);
  $('#hydraulic-note').textContent=`A diagram minden görbéje azonos, ${fmt(h.referenceElevation,3)} mBf szívóoldali vízszintre vonatkozik. A táblázat fokozatonként a saját indítás és leállítás középvízszintjén számol; a Q-tartomány a közös leállítás és az utolsó indítás között értendő. ${p.flowMode==='manual'?'Kézi módban a pontok csak a szükséges H-t jelölik, nem igazolt gyártói görbemetszések.':'A szimuláció a vízszinttel változó munkapontot számolja, azonos fordulatszámú és jelleggörbéjű gépekre.'}`;
  if(h.curveProvenance?.pdfPage)$('#hydraulic-note').textContent+=` Forrás: újrarajzolt táblázatos gyűjtemény, ${h.curveProvenance.pdfPage}. oldal; eredeti katalógus-ellenőrzés szükséges. A táblázat közölt tartományán kívül nem extrapolálunk.`;
  $('#level-chart').innerHTML=timeChart(s.series,'level',{height:185,references:g.startLevels.map(l=>g.floorElevation+l),min:g.floorElevation+g.stop-0.05,unit:'Vízszint mBf'});
  $('#flow-chart').innerHTML=timeChart(s.series,'inflow',{height:115,color:'#7c9dab',unit:'Befolyás m³/h'});
  $('#operation-stats').innerHTML=[['Max. indítás / üzemképes gép',`${Math.max(...s.rollingStarts)} /h`,`Gépenként: ${s.rollingStarts.join(' / ')} · korlát ${fmt(g.limit,0)}/h`],['Akna + nyomócső max. FIFO-kor',`${fmt(s.systemFifoMaxMinutes,0)} perc`,'A telt vezetékben álló víz idejével együtt'],['Teljes modellezett idő',s.totalFifoMinutes===null?'Előzmény hiányzik':`${fmt(s.totalFifoMinutes,0)} perc`,`Felvett MI-időkeret: ${fmt(p.residenceLimit,0)} perc`]].map(([label,value,sub])=>`<div class="operation-stat"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');
  $('#checks').innerHTML=checks.map(c=>`<div class="check ${c.status}" data-check="${c.id}"><span class="check-icon" aria-label="${{pass:'Teljesül',fail:'Nem teljesül',pending:'Egyeztetendő'}[c.status]}">${{pass:'✓',fail:'×',pending:'i'}[c.status]}</span><div><strong>${esc(c.title)}</strong><p>${esc(c.detail)}</p></div></div>`).join('');
  $('#formula-output').innerHTML=[['MI (28): Vlépcső ≥ 0,9 × Qmax [L/s] / Z',`${fmt(g.byStarts,3)} m³`],['Futásidő minimum: Qmax × tmin / 3600',`${fmt(g.byRun,3)} m³`],['Egy szintlépcső / teljes hasznos tér',`${fmt(g.perStage,3)} / ${fmt(g.active,3)} m³`],['MI (29): periódusidő = 60 / Z',`${fmt(60/g.limit)} perc`],['Számított alsó aknaszint',`${fmt(p.inletElevation,3)} − ${fmt(g.inletDepth,3)} = ${fmt(g.floorElevation,3)} mBf`],['Teljes geometriai tér a befolyó alatt',`${fmt(g.belowInlet,3)} m³`],['Átlagos / legnagyobb befolyás',`${fmt(p.daily/24)} / ${fmt(Math.max(...r.profile))} m³/h`],['Átlagos hidraulikai idő a szívótérben',`${fmt(s.hydraulicMinutes,1)} perc`],['Nyomócső átlagos Vcső / Q24 ideje',`${fmt(s.pipeHydraulicMinutes,1)} perc`],['Legnagyobb FIFO-kor csak az aknában',`${fmt(s.fifoMaxMinutes,0)} perc`],['Leghosszabb megfigyelt teljes szivattyúállás',`${fmt(s.maxOffMinutes,0)} perc`],['Üzemképes gépek napi átlagos üzemideje',s.runningHours.map(v=>`${fmt(v/s.observationDays)} h`).join(' / ')],['Hidegtartalék gépek automatikus üzemideje','0 h'],['Túltöltés a megfigyelés alatt',`${fmt(s.overflow,3)} m³`],['Tömegmérleg eltérése',`${s.balanceError.toExponential(1)} m³`]].map(([label,value])=>`<div class="formula-row"><span>${label}</span><strong>${value}</strong></div>`).join('')+`<p class="model-note">${s.warmupDays} nap bemelegítés + ${s.observationDays} nap megfigyelés. Legfeljebb 60 másodperces, eseményhatárokon osztott explicit vízmérleg; FIFO-belépés az időlépés közepén. Görbemódban a Q a vízszinttel változik (0,1 mm-es vízszintsávra gyorsítótárazva). A többfokozatú térfogatválasztás konzervatív programbeli kiterjesztés, nem az MI-ben szereplő többgépes képlet. Az átmérő és a fenékszint az adott geometriai feltételekhez tartozó javaslat, nem teljes kiviteli méretezés.</p>`;
}
function update(){
  sync();try{const p=read();result=calculate(p);render(result);$('#error').hidden=true;$('#result-content').hidden=false;$('#calc-state').innerHTML='<span class="dot"></span> Számítás frissítve';try{localStorage.setItem(storageKey,JSON.stringify({version:2,parameters:p}));}catch{}}
  catch(e){result=null;$('#error').textContent=e.message;$('#error').hidden=false;$('#result-content').hidden=true;$('#calc-state').textContent='Adatok ellenőrzése szükséges';}
}
form.addEventListener('submit',e=>e.preventDefault());
form.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(update,220);});
form.addEventListener('change',e=>{
  clearTimeout(timer);
  if(e.target.name==='workingCount')form.elements.maxParallel.value=form.elements.workingCount.value;
  if(e.target.name==='pumpId'){
    curveModelId=e.target.value;form.elements.manufacturerStartsLimit.value='';
    if(!useCatalogueCurve()){form.elements.curveSource.value='manual';form.elements.curveText.value='';form.elements.curveLabel.value='';form.elements.flowMode.value='curve';}
  }
  if(e.target.name==='curveSource'&&e.target.value==='catalogue')useCatalogueCurve();
  update();
});
$('#catalogue-info').addEventListener('click',e=>{if(e.target.closest('[data-use-curve]')){useCatalogueCurve();update();}});
$('#reset').addEventListener('click',()=>{fill(structuredClone(defaults));update();});
$('#print').addEventListener('click',()=>window.print());
let printDetails=[];window.addEventListener('beforeprint',()=>{printDetails=[...document.querySelectorAll('details')].map(element=>({element,open:element.open}));printDetails.forEach(({element})=>element.open=true);});
window.addEventListener('afterprint',()=>printDetails.forEach(({element,open})=>element.open=open));
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export-json').addEventListener('click',()=>{
  if(!result)return;const {parameters,simulation,...summary}=result;const {series,...simulationSummary}=simulation;
  download('atemelo-projekt.json',JSON.stringify({version:2,createdAt:new Date().toISOString(),parameters,summary:{...summary,simulation:simulationSummary},sources:['MI-10-167/3–87, pp.3,8–10,21,23','FCSM VSZ-40/2020, 4.0, pp.22–27','Flygt 896876, 20240605, PDF pp.6,8,10','Flygt_szennyviz_szivattyugorbek.pdf — feltöltött, újrarajzolt táblázatos gyűjtemény'],notice:'Előméretezés: a gyártói görbe, bemerülés és az irányelv alkalmazhatósága külön igazolandó. A beépített táblázatok nem eredeti gyártói görbeoldalak.'},null,2),'application/json');
});
$('#export-csv').addEventListener('click',()=>{
  if(!result)return;const rows=['Idő [óra];Befolyás [m3/h];Vízszint [mBf];Működő gépek száma;Összes szivattyú-Q [m3/h]',...result.simulation.series.map(d=>[d.hour,d.inflow,d.level,d.on,d.pumpFlow].map((v,i)=>i===3?v:Number(v).toFixed(4).replace('.',',')).join(';'))];
  download('atemelo-napi-uzem.csv','\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8');
});
$('#import-json').addEventListener('change',async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw new Error('Legfeljebb 1 MB méretű projekt tölthető be.');
    const data=JSON.parse(await file.text()),{parameters,note}=migrateProject(data);
    const validationParameters=structuredClone(parameters);
    if(data.version===1)for(const key of ['inletElevation','outletElevation','pipeDiameter','pipeLength'])validationParameters[key]=defaults[key];
    calculate(validationParameters);fill(parameters);update();$('#file-status').textContent=note||'A projekt betöltve és újraszámolva.';
  }catch(e){$('#file-status').textContent=`A projekt nem tölthető be: ${e.message}`;}finally{e.target.value='';}
});
$('#import-curve').addEventListener('change',async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>50000)throw new Error('Legfeljebb 50 kB-os görbefájl tölthető be.');form.elements.curveSource.value='manual';form.elements.curveText.value=await file.text();curveModelId=form.elements.pumpId.value;update();}
  catch(e){$('#file-status').textContent=e.message;}finally{e.target.value='';}
});
let initial=structuredClone(defaults);
try{const saved=JSON.parse(localStorage.getItem(storageKey)||localStorage.getItem('atemelo-project-v1'));if(saved){const migrated=migrateProject(saved);initial=migrated.parameters;$('#file-status').textContent=migrated.note;}}catch{}
fill(initial);update();
