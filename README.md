# Átemelő — szennyvízátemelő előméretező

Magyar nyelvű, böngészős számítás műszakos szennyvízterheléshez. A projekt napi
összmennyiségből, műszakrendből, munkaponti szivattyú-vízhozamból és tervezői
korlátokból javasol hengeres aknageometriát és kapcsolási szinteket.

## Indítás és ellenőrzés

**Telepítés nélküli használat:** a `letoltes/atemelo.zip` csomagot csomagold ki,
majd nyisd meg az `atemelo/index.html` fájlt Chrome, Edge vagy Firefox böngészőben.
Ehhez nem kell Node.js vagy internet. A `docs` mappa maradjon a HTML mellett.
A biztos projektmegőrzéshez használd a felület JSON-mentését.
A letölthető változat a források módosítása után `npm run portable` paranccsal
generálható újra (ehhez Python 3 szükséges, külső csomag nélkül).

**Fejlesztői indítás:**

Node.js **22 vagy újabb** szükséges; ellenőrizve Node.js 24.19.0-val.
Nincs külső futásidejű vagy telepítendő csomag, adatbázis, kulcs vagy külső API.

```sh
cd /workspace/szennyv-z
npm start
```

Alapértelmezett port: **3000**, a `PORT` környezeti változóval felülírható.
Állapotellenőrzés: `curl --fail http://127.0.0.1:3000/health`.
Az alkalmazás statikus fájljait a mellékelt Node HTTP-kiszolgáló szolgálja ki;
a `/health` önmagában nem igazolja a böngészős számítást.

```sh
npm run check
npm test
```

A tesztek a napi mennyiség megtartását, műszakátfedést és éjféli átnyúlást,
analitikusan ismert kapcsolási gyakoriságot, váltott üzemet, FCSM-esetkört,
vízkorra érzékeny éjszakai állást, túltöltést és tömegmérleget ellenőrzik.
Az alkalmazásnak nincs buildlépése. A böngésző natív ES-modulokat használ.

## Használat

- A napi mennyiség az összes szennyvíz: a létszám nem ad hozzá újabb vízfogyasztást.
  A műszakok személyórái a változó hányad elosztását határozzák meg.
- A folyamatos hányad a nap mind a 24 órájában érkezik; a fennmaradó mennyiség
  műszakok vagy 24 egyedi órás súly szerint oszlik el. Az átfedő létszámok összeadódnak.
- A **15 Flygt N típuscsalád** adatai a csatolt prospektusból származnak.
  A munkaponti Q-t külön kell megadni: a prospektus nem ad kivitelre bontott Q–H görbéket.
  A motor-kW és a vízhozam nem felcserélhető.
- Egy szivattyú vagy két váltott üzemű, azonos gép választható. Párhuzamos
  szivattyúzás és második üzemi indítási szint nincs modellezve.
- Automatikus átmérőnél a program az elrendezési minimumtól induló méretsorból
  a legkisebb, geometriailag megfelelő méretet választja. A gépészet kiszorított
  térfogata és a tényleges beépíthetőség külön ellenőrzendő.
- A szintek az akna belső fenekéhez viszonyított értékek. A leállítási szint
  tervezői bemenet, amelyet a pontos szivattyú minimális bemerülése alapján kell felvenni.
- A biztonsági tárolási idő az átlagos napi hozam óráiban értendő. Nem garantál
  ugyanennyi hibaáthidalást a napi csúcsban.
- Mentés/betöltés: JSON; napi diagram adatai: magyar Excelhez illő CSV;
  nyomtatás/PDF: a böngésző nyomtatási funkciója. A beállítások a böngésző
  helyi tárolójában maradnak. Nincs szerveroldali projektmentés vagy felhasználókezelés.

## Számítás

Állandó, `0 < q < Qsz` befolyás és egy szivattyú esetén:

```
T = V/q + V/(Qsz-q)                  [óra]
z = q × (Qsz-q) / (V × Qsz)          [1/óra]
zmax = Qsz/(4V), amikor q = Qsz/2
V_indítás ≥ Qsz/(4 × Zmegengedett)   [m³]
V_futás ≥ Qsz × tmin/3600            [m³; tmin másodpercben]
```

A kapcsolási tér az indítási, futásidő-, minimum szintkülönbségi és az alkalmazható
lakóházi minimum maximuma. A váltott üzem kedvező hatásával a térfogat nem csökken.
A szimuláció külön ellenőrzi a **gépenkénti gördülő 60 perces indításszámot**.

A henger területe `A = πD²/4`; indítási szint `hleállítás + Vüzemi/A`;
riasztási szint `hindítás + Δhriasztás`. A biztonsági tér indítás fölött van,
legalább a felvett igény vagy a riasztásig szükséges tér maximuma. A felső szint
maradjon a befolyó alatt a megadott tartalékkal.

Egy nap 96 negyedórás befolyási szakaszra oszlik. A műszakhatárokat a program
átfedési aránnyal integrálja. A vízmérleg legfeljebb 60 másodperces lépésekkel,
a kapcsolási és negyedórás határokon pontos felosztással fut. A bemelegítés legalább
7, legfeljebb 30 nap, a megfigyelés 3 nap. A diagram az utolsó napot mutatja;
a jelentett szélsőértékek a teljes megfigyelési időre vonatkoznak.

A vízkorhoz ideális **FIFO** feltételezés tartozik: az előbb beérkező víz távozik
előbb. A leállítási szint alatti víz is része a modellnek. Az új befolyó víz korát
az egyes időlépések közepétől számítjuk; a vízkor időbeli közelítése kb. 1 perces.
A legnagyobb vízkor az elszállított és a még bent lévő vízből adódik. A kezdeti
víz bemelegítés alatti ki nem cserélődése függő ellenőrzést eredményez.

Az átlagos hidraulikai idő: `τ = Vátlag / (Qnapi/24)`.
**Egyik mutató sem bizonyítja a valós kevert akna garantált maximális tartózkodását.**
A program mindkettőt összeveti a külön megadott tervezői időkorláttal, de annak
értelmezését és alkalmazhatóságát az üzemeltetővel egyeztetni kell.

## Források és korlátok

A feltöltött PDF-ek változtatás nélkül a `docs/` alatt találhatók.

1. `docs/fcsm-2020.pdf`: FCSM VSZ-40/2020. üzletszabályzat, 4.0 kiadás,
   2020.09.24., az eredeti **22–27. oldal** kivonata.
   - 22. oldal: egylakásos, 4 fős lakóépületnél min. **0,2 m³ üzemi tér** és
     ezen felül min. **1 napi kibocsátásnyi biztonsági tér**, a befolyó alatt.
   - 24. oldal: az ülepedés és berothadás kockázatának csökkentése a szintekkel;
     külön vészszintjelzés.
   - A részlet **nem közöl számszerű maximális tartózkodási időt**, és
     lakossági házi beemelőkre vonatkozik. A telephelyi alkalmazás és a 2020-as
     dokumentum jelenlegi érvényessége nincs igazolva.
2. `docs/flygt-n-896876.pdf`: Flygt N-technology series, 50 Hz,
   896876, dokumentumjelölés **20240605**.
   - PDF 6. oldal: 3069, 3085, 3102, 3127, legfeljebb **30 indítás/óra**.
   - PDF 8. oldal: 3153, 3171, 3202, 3301, 3315, legfeljebb **30 indítás/óra**.
   - PDF 10. oldal: 3231, 3306, 3312, 3356, 3400, 3531, legfeljebb **15 indítás/óra**.
   - Ezek prospektusadatok, a pontos kivitel motor- és telepítési adatlapja az irányadó.

Az induló 12 m³/nap, 18 m³/h, 0,4 m leállítás, 20/h tervezett indítás,
30 s minimum futás, 2 átlaghozam-óra tartalék és a többi geometriai érték
**példa / tervezői felvétel**, nem igazolt projektadat vagy FCSM/Flygt-előírás.
A tartózkodásiidő-korlát kezdetben üres.

Nincs nyomócső-méretezés, változó emelőmagasság és Q–H munkapontmetszés,
CFD/keveredési modell, ülepedési/berothadási modell, hétvégi leállás,
lökésszerű technológiai ürítés vagy hibaüzemi szimuláció. A befolyó szintjét
elérő térfogatot a modell túltöltésként könyveli; ez a valóságban visszaduzzasztás
vagy elöntés lehet. A teljes aknamélység, fedlap, szerkezet, felúszásvédelem,
villamos kivitel és valamennyi FCSM-követelmény megfelelősége nincs méretezve.

Ez az alkalmazás **előméretező**, nem kiviteli terv és nem üzemeltetői jóváhagyás.
