import {pipePlacement} from './pipe-placement.js';
const diagramFormat=(n,d=3)=>Number(n).toLocaleString('hu-HU',{minimumFractionDigits:d,maximumFractionDigits:d});
export function wellLayout(g,p){
  const placement=pipePlacement(p,g),{groundKnown,ground}=placement;
  const levels=[
    {key:'inlet',label:'Befolyócső fenékszintje',h:g.inletDepth,color:'#526e5c'},
    {key:'reserve',label:'Biztonsági tárolás felső szintje',h:g.reserveTop,color:'#7b895b'},
    {key:'alarm',label:'Vészvízszintjelzés',h:g.alarm,color:'#a66b1b'},
    ...g.startLevels.map((h,i)=>({key:`start-${i+1}`,label:`${i+1}. fokozat indítása`,h,color:'#087c72'})),
    {key:'stop',label:'Közös leállítás',h:g.stop,color:'#527465'},
    {key:'floor',label:'Számított aknafenék',h:0,color:'#17383b'},
  ];
  levels.push({key:'pressure-center',label:'Nyomócső kilépés · csőtengely',h:placement.pressureCenter,color:'#466b79'});
  if(groundKnown)levels.push({key:'ground',label:'Terepszint',h:ground,color:'#6d7754'});
  levels.sort((a,b)=>b.h-a.h);
  const height=Math.max(540,levels.length*41+110);
  const lowest=Math.min(0,placement.pressureCenter-p.pipeDiameter/2000);
  const highest=ground;
  const y=h=>height-70-(h-lowest)/(highest-lowest)*(height-132);
  const floorY=y(0);
  for(let i=0;i<levels.length;i++)levels[i].labelY=Math.max(44,i?levels[i-1].labelY+38:44,y(levels[i].h)-9);
  const overflow=levels.at(-1).labelY-(height-55);
  if(overflow>0){levels.at(-1).labelY-=overflow;for(let i=levels.length-2;i>=0;i--)levels[i].labelY=Math.min(levels[i].labelY,levels[i+1].labelY-38);}
  return {levels,height,floorY,y,ground,groundKnown,placement};
}
export function wellDiagram(g,p){
  const {levels,height,floorY,y,ground,groundKnown,placement}=wellLayout(g,p),left=350,right=590;
  const dimensionLevels=levels.filter(l=>l.h>0),spacing=Math.min(23,226/Math.max(1,dimensionLevels.length-1));
  const dimensions=dimensionLevels.map((l,i)=>{
    const x=44+i*spacing,top=y(l.h);
    return `<g class="floor-dimension" data-level="${l.key}"><path d="M${x-5} ${top}H${left-12}M${x-5} ${floorY}H${left-12}" stroke="#cbd7cb"/><path d="M${x} ${top}V${floorY}" stroke="#839986" marker-start="url(#dimension-arrow)" marker-end="url(#dimension-arrow)"/><text transform="translate(${x-5} ${(top+floorY)/2}) rotate(-90)" text-anchor="middle" fill="#536c5b" font-size="11" stroke="white" stroke-width="4" paint-order="stroke">${diagramFormat(l.h)} m</text></g>`;
  }).join('');
  const levelMarks=levels.map(l=>`<g data-level="${l.key}"><line x1="${left}" x2="${right}" y1="${y(l.h)}" y2="${y(l.h)}" stroke="${l.color}" stroke-dasharray="5 4"/><path d="M697 ${l.labelY+7}H678L638 ${y(l.h)}H${right+2}" fill="none" stroke="${l.color}" marker-end="url(#level-arrow)"/><text x="708" y="${l.labelY}" fill="${l.color}" font-size="12">${l.label}</text><text x="708" y="${l.labelY+17}" fill="${l.color}" font-weight="600" font-size="14">${l.key==='pressure-center'&&!groundKnown?'Terepszint nélkül vázlatos':`${diagramFormat(g.floorElevation+l.h)} mBf`}</text></g>`).join('');
  const pressureStroke=Math.max(4,Math.min(18,y(placement.pressureCenter-p.pipeDiameter/2000)-y(placement.pressureCenter+p.pipeDiameter/2000)));
  const pressureY=y(placement.pressureCenter);
  const inletHeight=8;
  const inletTop=y(g.inletDepth)-inletHeight;
  const depthDimension=(x,top,label)=>`<g class="depth-dimension"><path d="M${x} ${y(ground)}V${top}" stroke="#7e8f74" marker-start="url(#dimension-arrow)" marker-end="url(#dimension-arrow)"/><path d="M${x-5} ${y(ground)}h10M${x-5} ${top}h10" stroke="#7e8f74"/><text transform="translate(${x-7} ${(top+y(ground))/2}) rotate(-90)" text-anchor="middle" fill="#526e5c" font-size="11" stroke="white" stroke-width="4" paint-order="stroke">${label}</text></g>`;
  const depthMarks=depthDimension(631,pressureY,`${diagramFormat(placement.pressureDepth,2)} m`)+depthDimension(311,y(g.inletDepth),`${diagramFormat(ground-g.inletDepth,2)} m`);
  return `<svg viewBox="0 0 1000 ${height}" role="img" aria-label="Akna: jobb oldalon mBf szintek, bal oldalon fenéktől mért magasságok"><defs><pattern id="well-hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line y2="8" stroke="#c2d4bc" stroke-width="2"/></pattern><marker id="level-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#718879"/></marker><marker id="dimension-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M8 0L0 4L8 8Z" fill="#839986"/></marker></defs><text x="35" y="22" font-size="12" fill="#647777">Magasságok a fenéktől</text><text x="708" y="22" font-size="12" fill="#647777">Szintek · mBf</text>${dimensions}<path d="M338 ${y(ground)-15}V${floorY+10}H602V${y(ground)-15}" fill="#f1f4ed" stroke="#7c9180" stroke-width="3"/><rect x="350" y="${y(ground)-10}" width="240" height="${floorY-y(ground)+10}" fill="white"/><rect x="350" y="${y(g.reserveTop)}" width="240" height="${y(g.start)-y(g.reserveTop)}" fill="url(#well-hatch)"/><rect x="350" y="${y(g.start)}" width="240" height="${y(g.stop)-y(g.start)}" fill="#bee2d7"/><rect x="350" y="${y(g.stop)}" width="240" height="${floorY-y(g.stop)}" fill="#dae7df"/><path d="M350 ${y(ground)-10}V${floorY}H590V${y(ground)-10}" fill="none" stroke="#6b8272" stroke-width="2"/><rect class="inlet-pipe" x="320" y="${inletTop}" width="30" height="${inletHeight}" fill="#526e5c"/><path class="terrain-line" d="M290 ${y(ground)}H338M602 ${y(ground)}H663" fill="none" stroke="#87976b" stroke-width="2"/>${!groundKnown?`<text x="415" y="${y(ground)-22}" font-size="11" fill="#647777">Terep: vázlatos, szint nincs megadva</text>`:''}<path d="M420 ${floorY-6}v-22a18 18 0 0 1 36 0v22Z" fill="#476b60"/><rect x="430" y="${floorY-54}" width="17" height="20" rx="3" fill="#718d7b"/><path class="pressure-pipe" data-center-h="${placement.pressureCenter}" d="M456 ${floorY-21}H493V${pressureY}H618" stroke="#6a8790" stroke-width="${pressureStroke}" fill="none"/>${depthMarks}${levelMarks}<path d="M350 ${height-37}H590m-240-5v10m240-10v10" stroke="#7a9282"/><text x="470" y="${height-15}" text-anchor="middle" fill="#607563" font-size="13">Belső Ø ${diagramFormat(g.diameter,2)} m</text></svg>`;
}
