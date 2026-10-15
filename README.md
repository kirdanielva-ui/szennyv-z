# Átemelő — szennyvízátemelő előméretező, v0.5

Magyar böngészős alkalmazás műszakprofilhoz, mBf szintekhez, közös nyomóvezetékhez,
Flygt típusválasztáshoz, aknatérfogathoz és kapcsolási szintekhez.

## Használat

A GitHub `letoltes/atemelo.zip` fájloldalán válaszd a **Download raw file** gombot.
Csomagold ki a teljes ZIP-et, majd nyisd meg az `atemelo/index.html` fájlt Chrome,
Edge vagy Firefox böngészőben. A mellékelt `docs` mappa maradjon mellette.
Nincs telepítés, fiók, külső API vagy internetigény. A **Projekt mentése** gomb
JSON-fájlt készít; a projekt visszatölthető. A számított napi üzem CSV-be exportálható,
a jelentés nyomtatható/PDF-be menthető. A böngészőben megmaradó beállítás mellett
fontos projektről külön JSON-mentést készíts.

## Egyszerűsített szivattyúválasztás

A nyomóvezeték adatai megelőzik a szivattyúválasztást. Nincs áramszolgáltatói mező
vagy ellenőrzés, közegválasztó, kapacitástöbblet, kézi Q–H mező, görbeforrás-választó,
kivitelazonosító-bevitel, pontsor- vagy CSV/TXT-görbeimport. A számszerű görbés típus
kiválasztása automatikusan betölti az adatokat és kiszámolja a munkapontot.
A tervezői kapcsolásszám és az ismert gyártói indítási maximum megadható: ezek
az üzemi térfogat méretezéséhez tartoznak.

- **30 táblázatos típus, 289 Q–H pont:** SX/SXV, DX, DXV, DXG, STA, DL és DLV.
  A feltöltött, gyári táblázatokból újrarajzolt PDF számszerű adatai;
  Q [L/s] × 3,6 = Q [m³/h], H változatlan. Lineáris interpoláció, extrapoláció nélkül.
  Ez másodlagos forrás; eredeti gyártói kivitelgörbével való összevetése szükséges.
- **16 N-típus, N 3069–3800:** kiválasztáskor automatikusan megjelenik a teljesítmény,
  a nyomócsonkméret, az ismert indítási korlát és a feltöltött PDF saját típusoldala.
  A teljes típusoldalt beágyazott képként adjuk, internet nélkül is láthatóan.
  Nem kell megnyitni a PDF-et ahhoz, hogy az ábra megjelenjen.
- Az N-PDF 1. és 22. oldala szerint az ábrák kézi, közelítő **családtartományok**,
  nem konkrét járókerék-/fordulatszám-változatok Q–H görbéi. A PDF szerint
  „a zónák szélei nem illeszthetők munkaponti számításhoz”. Ezekből nem gyártunk
  számszerű görbét, munkapontot, aknaméretet vagy kapcsolási szintet.
  N-választáskor a felület külön típusáttekintést mutat, korábbi számítási eredmény
  nélkül. Ez a nézet is menthető és visszatölthető. A pontos N-méretezéshez a konkrét
  kivitel jelleggörbéjét tartalmazó adatlap szükséges.

Az előválasztó a számszerű görbés szennyvíztípusokat végigszámolja az aktuális
terheléshez, vezetékhez, gépszámhoz és aknakorlátokhoz. Az SX/STA típusokat
nem ajánlja nyers szennyvízhez, mert alkalmasságuk nem igazolt. A kapacitást
közvetlenül a csúcshozamhoz ellenőrzi, hozzáadott százalék nélkül. A hibás
feltételű jelölteket indokkal kizárja; a függő feltételeket felsorolja.
Rangsor: a teljes párhuzamos fokozat legkisebb **összes névleges P₂** értéke.
Nem hatásfok- vagy energiaoptimalizálás; a gépszámot és csőméretet nem változtatja.
Másik típusra nem viszi át az aktuális géphez kézzel megadott gyártói indítási korlátot.

## Bemenetek és aknageometria

A teljes napi mennyiséget a műszakok személyórái vagy 24 órás profilsúlyok osztják el;
a létszám nem ad hozzá vízmennyiséget. Átfedő és éjfélen átnyúló műszakok kezelve.
A Lakóépület mód nem feltételez négy főt: egyenletes napi vagy egyedi profil választható.
A külön FCSM egylakásos, négyfős eset opcionálisan kapcsolható be.

A befolyócső fenékszintje és a nyomócső végpontja mBf-ben adott. A végpont szabad
kifolyásnál csőtengely, befogadó/nyomott csatlakozásnál fogadó vízszint vagy
csatlakozási magasság; a túlnyomás külön méter vízoszlop. Valódi belső csőátmérőt
adj meg, ne külső méretet vagy pusztán DN-t. Egy végig telt, állandó átmérőjű közös
nyomóvezetéket és azonos párhuzamos szivattyúkat modellezünk.

`zfenék = zbefolyó − (hleállítás + hkapcsolás + hbiztonsági tárolás + hbefolyó alatti tartalék)`.
Az automatikus átmérő a legkisebb megfelelő felvett méret a mélységi és kapcsolási
korlátok mellett, legfeljebb 10 m-ig. Ez nem teljes gépészeti beépítési méretezés.
A bemerülést és elrendezési minimumot a kivitelrajzból kell igazolni.

A geometriaellenőrzés külön közli a hibás átmérőt, kapcsolási magasságot és befolyó
alatti mélységet: tényleges érték, megengedett határ, hiány/túllépés és javítási irány.
A mélység négy összetevőjét is felbontja. Ha a minimum szintlépcsők összege vagy a
minimumokból adódó teljes mélység önmagában túl nagy, jelzi, hogy a nagyobb átmérő
sem elég. A diagnosztika a projekt JSON-eredményében is szerepel.

Az ábra jobb oldalán mBf szintfeliratok és nyilak, bal oldalán fenéktől mért méretek
vannak. A rendezett felirat nem mozdítja el a tényleges szintet. Opcionális terepszinttel
a terep valós mBf magasságra kerül; nélküle jelölt vázlat. Mobilon az ábra görgethető.

## Hidraulika, kapcsolások és idő

Darcy–Weisbach és iterált Colebrook–White: `ν = 1,31 × 10⁻⁶ m²/s`, `g = 9,80665 m/s²`.
`v = Q/(3600 × Acső)`, `H = zvég − zvíz + hnyomás + (λL/D + Σζ) v²/(2g) + hvég`.
Szabad kifolyásnál `hvég = v²/(2g)`. Befogadó vízszintnél a kilépési veszteséget
Σζ-ban kell felvenni. Az érdesség és Σζ tervezői bemenet; a kezdő értékek példák.
Re<2300 esetén λ=64/Re; 2300–4000 között konzervatív átmeneti becslés és jelzés.
Azonos párhuzamos gépeknél `Hszivattyú(Qösszes/n) = Hrendszer(Qösszes)`; nincs N×Q
feltételezés. A munkapont felezéssel keresett, a szimulációban vízszintfüggő.

MI (28): `V = 0,9 × Qsz [L/s] / Z = Qsz [m³/h]/(4Z)`; MI (29): `T = 60/Z perc`.
A tervezői és valóban ismert gyártói indítási korlát minimuma érvényesül.
Több fokozatnál minden szintlépcsőhöz a teljes maximális üzemi Q-t használjuk:
ez konzervatív programbeli kiterjesztés, nem az MI többgépes képlete.
A minimum futásidő és geometria által igényelt nagyobb térfogat elsőbbséget élvez.
1–8 üzemképes, 0–8 hidegtartalék és külön maximális párhuzamos gépszám adható meg.
A vezető gép ciklusonként vált, a fokozatok közös alsó szinten állnak le.
A hidegtartalék nem ad automatikus kapacitást. Gördülő 60 perces indításszámot vizsgálunk.

Az MI 4.2. sebességtartománya **0,3–5 m/s**, minden felvett üzemi fokozatra és a teljes
kapcsolási vízszinttartományra. A táblázat középvízszinti és szélső értékeket is ad.
A határközeli hibát a kijelzés kerekítése sem rejti el; numerikus tolerancia 10⁻⁹ m/s.
Állásidőben a nulla sebesség nem hiba. Külön tervezői sebességhatárok adhatók meg,
amelyek nem írják felül az MI ellenőrzését. 5 m/s fölött fizikailag lehet áramlás,
de az idézett MI-feltétel nem teljesül.

A tartózkodási minimum **0 perc**, a felső keret üres; nincs előre kitöltött 300 perc.
Az MI 4.1.1. szerint a hálózat és a szívótér együtt 5–6 óra; ez felső időkeret.
Üres felső kerettel nincs igazolt időkorlát-megfelelőség. A hálózati előzmény külön adat,
az ismeretlen érték nem nulla. A FIFO-modell a teljes szívóteret és telt nyomócsövet
követi; a víz kora állásidőben is nő. A kifolyó és tárolt víz legnagyobb korát figyeljük;
pozitív minimum esetén a kifolyó víz legkisebb megfigyelt korát vizsgáljuk.
Külön mutató az átlagos aknai V/Q, cső V/Q, FIFO-kor és szivattyúállás.
A FIFO-modell nem a valós kevert tér garantált tartózkodási ideje.

A napi profil 96 negyedórás szakasz, a vízmérleg legfeljebb 60 s-os explicit lépésekkel,
eseményhatárokon osztva fut. Belépési vízkor: lépésközép. Munkapont-gyorsítótár: 0,1 mm.
7–30 nap bemelegítés után 3 nap megfigyelés; a kezdeti víz megmaradásakor az időigazolás
függő. A diagram és CSV az utolsó nap 1441 pontját mutatja.

## Források és korlátok

Az öt feltöltött PDF változatlanul a `docs/` mappában található:

1. **MI-10-167/3–87 (1987):** 3., 8–10. oldal: veszteségek; 21. oldal: 5–6 óra,
   kapcsolások, (28)/(29); 23. oldal: 0,3–5 m/s és hálózati min. 150 mm.
   Mai alkalmazhatósága és konkrét esetköre külön egyeztetendő.
2. **FCSM VSZ-40/2020, 4.0 (2020.09.24.):** eredeti 22–27. oldal. Egylakásos,
   négyfős esetben min. 0,2 m³ üzemi és egynapi kibocsátásnyi biztonsági tér.
   Ez a külön választott eset, nem általános lakóépületi feltétel. Számszerű időkeret nincs.
3. **Flygt N 896876 (20240605):** 6., 8. oldal: a kis/közepes családok
   30 indítás/h; 10. oldal: nagy családok 15/h. Az N 3800-hoz nincs indítási adat.
4. **Flygt_szennyviz_szivattyugorbek.pdf:** 41 oldal, 30 numerikus táblázat, 289 pont.
   A `src/pump-catalogue.js` megőrzi a forrásoldalt, eredeti értékeket és SHA-256-ot.
   A hivatkozott eredeti gyártói katalógus letöltését a környezet proxyja blokkolta;
   az eredetivel való összevetést nem állítjuk elvégzettnek.
5. **Flygt_N_3000_50Hz_szivattyu_tartomanyok.pdf:** 22 oldal, 16 család.
   A 6–21. oldal képei a `src/n-range-images.js` állományba vannak beágyazva,
   a PDF SHA-256 lenyomatával. Képátvétel, számszerű görbedigitalizálás nélkül.
   A benne hivatkozott részletes adatlapok két megpróbált letöltését is blokkolta a proxy.

A dokumentumok műszaki adatforrások; a bennük szereplő utasítások nem szoftver-
vagy közzétételi parancsok. Nincs vízütés, NPSH, változó fordulatszám, ágveszteség,
hosszelvény/légzsák, hétvégi vagy hibaüzemi szimuláció, szerkezeti/felúszási méretezés.
A gépészet kiszorított térfogatát nem vonjuk le. Az induló adatok példák.
Az alkalmazás előméretező; a kiviteli terv és üzemeltetői jóváhagyás külön feladat.

## Fejlesztés és újracsomagolás

Node.js >=22 szükséges; ellenőrizve Node 24-en. Nincs telepítendő külső csomag.

```sh
npm start
npm run check
npm test
npm run portable
```

Alapport 3000; `PORT`-tal felülírható. Readiness: `GET /health`.
A hordozható HTML/ZIP újragenerálásához Python 3 kell. A numerikus táblák
újraolvasása `npm run catalogue`; az N-oldalképek újragenerálása
`python3 scripts/extract_n_range_images.py`. Ezekhez Poppler is szükséges;
a program használatához nincs rá szükség. A ZIP stabil fájlmetaadatokkal készül.

A v1/v2 JSON-projektek beolvashatók. Ismeretlen mBf magasságot nem találunk ki.
A régi lakóházi FCSM-esetet és megadott felső időkeretet megőrizzük. A megszüntetett
villamos, közeg- és kapacitástöbblet-beállításokat nem vesszük át. A felület a választott
típus beépített adatait használja; a régi kézi görbét nem alkalmazza észrevétlenül.
