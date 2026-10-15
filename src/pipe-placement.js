// User-confirmed project requirement: 1 m from ground to inlet invert and
// local pressure pipe centerline, independently of the remote terminal elevation.
export const MINIMUM_PIPE_DEPTH=1;
export function pipePlacement(p,g){
  const groundKnown=p.groundElevation!=='';
  const floor=g?.floorElevation??0;
  const inletLevel=g?.inletDepth??p.inletElevation;
  const ground=groundKnown?Number(p.groundElevation)-floor:inletLevel+1.2;
  const pressureDepth=Number(p.pressureExitDepth??1);
  const pressureCenter=ground-pressureDepth;
  return {groundKnown,ground,pressureDepth,pressureCenter,
    inletDepthBelowGround:groundKnown?Number(p.groundElevation)-p.inletElevation:null,
    pressureCenterElevation:groundKnown?Number(p.groundElevation)-pressureDepth:null};
}
export function pipePlacementChecks(p,g){
  const f=n=>Number(n).toLocaleString('hu-HU',{minimumFractionDigits:3,maximumFractionDigits:6});
  const placement=pipePlacement(p,g),knownGround=placement.groundKnown;
  const inletTooHigh=knownGround&&placement.inletDepthBelowGround<MINIMUM_PIPE_DEPTH-1e-9;
  const checks=[{id:'inlet-depth',status:!knownGround?'pending':inletTooHigh?'fail':'pass',
    title:'Befolyó fenékszintje: legalább 1 m-rel a terep alatt',
    detail:!knownGround?'A terepszint nincs megadva. Az 1 m szintkülönbség ellenőrzéséhez add meg a meglévő terep mBf szintjét.':`Terep ${f(p.groundElevation)} − befolyó fenékszint ${f(p.inletElevation)} = ${f(placement.inletDepthBelowGround)} m. ${inletTooHigh?`Hiány: ${f(MINIMUM_PIPE_DEPTH-placement.inletDepthBelowGround)} m. A befolyó szintjét vagy a terepadatot vizsgáld felül; a program nem módosítja a megadott fenékszintet.`:'A megadott legalább 1 m feltétel teljesül.'}`}];
  const insufficientDepth=placement.pressureDepth<MINIMUM_PIPE_DEPTH-1e-9;
  const belowFloor=Boolean(g)&&placement.pressureCenter<=0;
  const noRoomForPipe=Boolean(g)&&placement.pressureCenter-p.pipeDiameter/2000<-1e-9;
  const depthDetail=insufficientDepth?`A tengelymélység hiánya ${f(MINIMUM_PIPE_DEPTH-placement.pressureDepth)} m.`:'A megadott 1 m tengelymélység teljesül.';
  const floorDetail=belowFloor?' A felvett csőtengely az aknafenéken vagy alatta van; vizsgáld felül az elrendezést.':noRoomForPipe?' A kilépésnél még a belső sugárnak megfelelő csőmagasság sem fér el a tengely és az aknafenék között; vizsgáld felül az elrendezést.':'';
  checks.push({id:'pressure-depth',status:insufficientDepth||knownGround&&noRoomForPipe?'fail':knownGround?'pass':'pending',
    title:'Nyomócső tengelye az aknafalnál: legalább 1 m-rel a terep alatt',
    detail:!knownGround?`A kilépési csőtengely felvett mélysége ${f(placement.pressureDepth)} m a terep alatt. ${insufficientDepth?depthDetail+' ':''}Megadott terepszint nélkül a tengely mBf szintje nem igazolható.`:`Terep ${f(p.groundElevation)} − tengelymélység ${f(placement.pressureDepth)} = csőtengely ${f(placement.pressureCenterElevation)} mBf az aknafalnál. ${depthDetail}${floorDetail} Ez a helyi falátvezetés, nem a nyomóvezeték távoli végpontjának szintje.`});
  return checks;
}
