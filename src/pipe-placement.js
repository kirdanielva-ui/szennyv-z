// Project requirement supplied by the user: at least 1 m cover above both pipes.
// This is independent of the pressure main's remote terminal elevation.
export const MINIMUM_PIPE_COVER=1;
export function pipePlacement(p,g){
  const groundKnown=p.groundElevation!=='';
  const floor=g?.floorElevation??0;
  const inletDepth=g?.inletDepth??p.inletElevation;
  const pressureCover=Number(p.pressureExitCover??1);
  const inletCrownKnown=p.inletCrownElevation!==''&&p.inletCrownElevation!==undefined;
  const inletCrown=inletCrownKnown?Number(p.inletCrownElevation)-floor:null;
  const ground=groundKnown?Number(p.groundElevation)-floor:Math.max(inletDepth,inletCrown??inletDepth)+1.2;
  const pressureCrown=ground-pressureCover;
  return {groundKnown,ground,inletCrownKnown,inletCrown,pressureCrown,pressureCover,
    inletCover:groundKnown&&inletCrownKnown?Number(p.groundElevation)-Number(p.inletCrownElevation):null,
    pressureCrownElevation:groundKnown?Number(p.groundElevation)-pressureCover:null,
    // Centerline here is schematic; the required cover is to the outside crown.
    pressureCenter:pressureCrown-p.pipeDiameter/2000,
  };
}
export function pipePlacementChecks(p,g){
  const f=n=>Number(n).toLocaleString('hu-HU',{minimumFractionDigits:3,maximumFractionDigits:6});
  const placement=pipePlacement(p,g),knownGround=p.groundElevation!=='';
  const coverToInvert=knownGround?Number(p.groundElevation)-p.inletElevation:null;
  const checks=[];
  if(!knownGround)checks.push({id:'inlet-cover',status:'pending',title:'Befolyócső: legalább 1 m földtakarás',detail:'A terepszint nincs megadva. A vázlat nem igazol földtakarási megfelelést; add meg a terepszintet és a befolyócső felső palástjának mBf szintjét.'});
  else if(placement.inletCrownKnown)checks.push({id:'inlet-cover',status:placement.inletCover>=MINIMUM_PIPE_COVER-1e-9?'pass':'fail',title:'Befolyócső: legalább 1 m földtakarás',detail:`Terep ${f(p.groundElevation)} − felső palást ${f(p.inletCrownElevation)} = ${f(placement.inletCover)} m földtakarás. ${placement.inletCover<MINIMUM_PIPE_COVER-1e-9?`Hiány: ${f(MINIMUM_PIPE_COVER-placement.inletCover)} m. A befolyó szintjét vagy a terepadatot vizsgáld felül; a program nem módosítja a megadott fenékszintet.`:'A megadott legalább 1 m feltétel teljesül.'}`});
  else checks.push({id:'inlet-cover',status:coverToInvert<MINIMUM_PIPE_COVER-1e-9?'fail':'pending',title:'Befolyócső: legalább 1 m földtakarás',detail:`A terep és a befolyó fenékszintje közti különbség ${f(coverToInvert)} m. ${coverToInvert<MINIMUM_PIPE_COVER-1e-9?'Már a fenékszint is 1 m-nél közelebb van a terephez, ezért a felső palástnál sem teljesülhet az 1 m.':'A fenékszint önmagában nem elég: a tényleges földtakarás igazolásához add meg a cső felső palástjának szintjét.'}`});
  const belowFloor=Boolean(g)&&placement.pressureCrown<=0;
  const noRoomForPipe=Boolean(g)&&placement.pressureCrown-p.pipeDiameter/1000<-1e-9;
  checks.push({id:'pressure-cover',status:placement.pressureCover<MINIMUM_PIPE_COVER-1e-9||knownGround&&noRoomForPipe?'fail':knownGround?'pass':'pending',title:'Nyomócső az aknafalnál: legalább 1 m földtakarás',detail:!knownGround?`A kilépés felvett földtakarása ${f(placement.pressureCover)} m. Megadott terepszint nélkül a kilépési mBf szint és a valós földtakarás nem igazolható.`:`Terep ${f(p.groundElevation)} − földtakarás ${f(placement.pressureCover)} = felső palást ${f(placement.pressureCrownElevation)} mBf az aknafalnál. ${placement.pressureCover<MINIMUM_PIPE_COVER-1e-9?`A takarás hiánya ${f(MINIMUM_PIPE_COVER-placement.pressureCover)} m.`:'A megadott 1 m földtakarás teljesül.'}${belowFloor?' A felvett kilépési szint az aknafenéken vagy alatta van; csökkentsd a mélységet az 1 m minimum megtartásával, vagy vizsgáld felül az elrendezést.':noRoomForPipe?' A kilépésnél még a belső átmérőnek megfelelő csőmagasság sem fér el az aknafenék fölött; vizsgáld felül az elrendezést.':''} Ez a helyi falátvezetés, nem a nyomóvezeték távoli végpontjának szintje.`});
  return checks;
}
