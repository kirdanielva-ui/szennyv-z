# Átemelő — szennyvízátemelő előméretező, v0.3

Magyar böngészős méretező a mellékelt MI-10-167/3–87, FCSM-részlet és Flygt
prospektus alapján. Műszakprofilból, mBf szintekből és vezetéki adatokból számol
szívóteret, aknafenékszintet, kapcsolási szinteket és hidraulikai munkapontot.

## Használat és fejlesztői indítás

**Telepítés nélkül:** a `letoltes/atemelo.zip` teljes tartalmát csomagold ki,
majd az `atemelo/index.html` fájlt nyisd meg Chrome-ban, Edge-ben vagy Firefoxban.
A `docs` mappa maradjon mellette; ebben van a négy forrás-PDF.
Nincs külső API, adatbázis, fiók, titok vagy internetigény a számításhoz.
A biztos megőrzéshez a felület **Projekt mentése** gombjával ments JSON-fájlt.
CSV-adatsor és nyomtatható/PDF-jelentés is készíthető.

**Fejlesztéshez** Node.js >=22 kell (ellenőrizve: 24.19.0). Nincs telepítendő
külső csomag vagy alkalmazás-buildlépés:

```sh
cd /workspace/szennyv-z
npm start
```

Alapport: 3000, a `PORT` környezeti változóval felülírható.
Belső readiness: `curl --fail http://127.0.0.1:3000/health`.
Ez önmagában nem igazolja a böngészős számítást.

```sh
npm run check
npm test
npm run portable
```

A `portable` az önálló HTML-t és ZIP-et generálja, ehhez Python 3 kell,
külső Python-csomag nélkül. Forrásváltozás után újra futtatandó.

## Bemenetek és szintek

- A napi összmennyiség a teljes szennyvíz, a létszám nem ad hozzá új vízmennyiséget.
  A műszakok személyórái vagy 24 megadott profilsúly osztják el **az egész napi
  mennyiséget**. Nincs külön folyamatos hányad. Folyamatos üzemhez 24 órás műszak
  vagy egyenletes órás profil vehető fel. Átfedés és éjféli átnyúlás kezelve.
- **Befolyócső fenékszintje mBf**: ebből származik az aknafenék és minden kapcsolási
  szint. A hengeres akna geometriai mélysége a leállítási vízmélység, összes kapcsolási
  magasság, biztonsági tárolás és befolyó alatti szabad tartalék összege.
  `zfenék = zbefolyó − hszükséges`. Az átmérőt a legkisebb alkalmas méretből választjuk
  az elrendezési minimum és a maximum mélység/szintkülönbség mellett.
- **Végpont mBf**: szabad kifolyásnál a csőtengely magassága, befogadó/nyomott
  csatlakozásnál a fogadó vízszint vagy csatlakozás magassága. A végponti túlnyomás
  külön, méter vízoszlopban adható meg. A terepszint és fedlap nincs méretezve.
- **Leállítási vízmélység**: a fenéktől mérve, a pontos szivattyú bemerülési/hűtési
  követelménye alapján. A kezdő 0,4 m csak példa.
- **Nyomócső:** teljes hossz és valódi **belső** átmérő, nem külső méret vagy pusztán
  DN. Egy állandó átmérőjű, végig telt közös nyomóvezetéket modellezünk.
- Az érdesség és összesített helyi ellenállás tervezői bemenet. A Σζ értékeket a közös
  cső sebességére kell vonatkoztatni. A kezdő 0,25 mm és Σζ=3 példa/felvett érték,
  nem minden telepítésre érvényes előírás.

## Szivattyúk és munkapont

A választóban **30 táblázatos típus** szerepel beépített Q–H pontokkal, mellettük
15 Flygt N **típuscsalád**, valamint C, F és Concertor bejegyzés görbeadatigénnyel.
A 30 típus az SX 2–3, SX 5–15, DX, DXV, DXG, STA, DL és DLV táblacsoportból való.
A táblázatos típus kiválasztása automatikusan betölti a megfelelő pontsort és
bekapcsolja a görbemetszést. A többi családhoz egyedi kivitelgörbe szükséges.
Az SX/STA család nyersszennyvíz-alkalmasságát a görbék nem igazolják.

A N-sorozat családadatai a mellékelt prospektusból származnak.
A katalógus motortartománya és nyomócsonkja **nem** teljes kivitel és **nem Q–H görbe**.
A konkrét járókerék, motor, fordulatszám, garantált munkatartomány és bemerülés
kiviteladatlapból ellenőrzendő. Nem tárolunk kitalált gyártói jelleggörbéket.

**Kézi mód:** minden egyidejű gépszámhoz külön add meg az **összes**, igazolt Q-t.
Ezekhez a program a szükséges H-t számolja; ez még nem gyártói görbemetszés.
A 18 m³/h kezdő Q csak példa. Két gép Q-ja nem automatikusan az egygépes Q kétszerese.
Kézi módban a megadott fokozati Q vízszintfüggetlen tervezői felvétel.

**Beépített táblázat:** a feltöltött `Flygt_szennyviz_szivattyugorbek.pdf` 30
numerikus táblázatának **289 pontját** közvetlenül vettük át. Nem görbék képi
digitalizálása történt. A Q [L/s] értékeket 3,6-tal szorozzuk; H változatlan.
Megőrizzük az eredeti L/s értékeket, PDF-oldalt, hivatkozott katalógusoldalt,
50 Hz frekvenciát és a feltöltött PDF SHA-256 lenyomatát. Az interpoláció
közelítés, a konverzió nem jelent az eredeti táblázatnál jobb mérési pontosságot.
A táblák **másodlagos, gyári táblázatokból újrarajzolt gyűjteményből** származnak;
nem eredeti gyártói görbeoldalak. Az eredeti, hivatkozott Xylem-katalógust a
környezet proxyja 403 Forbidden válasszal blokkolta, így az eredeti gyártói
forrással való összevetést **nem állítjuk elvégzettnek**.

A beépített pontok zároltak. Módosításhoz válts az egyedi forrásra: ettől kezdve
az export és az ellenőrzés is egyedi, felhasználói adatsorként jelöli őket.
A `catalogue` forrású projektben a program mindig a kiválasztott típus beépített
pontjait használja; tetszőleges `curveText` nem írhatja felül azokat. A JSON
jelentés tartalmazza a forrásoldalt, az eredeti értékeket és az ellenőrzési státuszt.
A beépített táblázat kiválasztása nem igazol pontos motor-/járókerék-kivitelt.

**Egyedi görbemód:** adj meg 3–200 Q–H pontot, Q m³/h és H m egységgel, valamint pontos
kivitel-/forrásazonosítót. Példa formátum: `Q;H` adatpárok, soronként, fejléc nélkül;
magyar tizedesvessző támogatott. `#` kezdetű sor megjegyzés. CSV/TXT beolvasható.
Az első pont Q=0 (zárási magasság), Q szigorúan növekvő, H nem növekvő legyen.
Egy monoton, azonos fordulatszámú görbeágat kezelünk lineáris interpolációval.
A görbén kívül nem extrapolálunk. Típusváltáskor a görbe törlődik, hogy másik
szivattyú adata ne maradjon észrevétlenül hozzárendelve.

A rendszerjelleggörbe:

```
v = Q / (3600 × Acső)
Re = v × D / ν                       ν = 1,31 × 10⁻⁶ m²/s (MI 2. oldal)
1/√λ = −2 log10(k/(3,71D) + 2,51/(Re√λ))
H = zvég − zvíz + hnyomás + (λL/D + Σζ) × v²/(2g) + hvég
```

`g = 9,80665 m/s²`. `hvég = v²/(2g)` szabad kifolyásnál; befogadó vízszintre
számítva nulla, de a kilépési veszteséget a Σζ-ba kell felvenni. Re<2300 esetén
λ=64/Re; Re=2300–4000 között a lamináris és turbulens becslés nagyobbikát vesszük,
és figyelmeztetünk. A Colebrook-egyenletet iterációval oldjuk meg.

Azonos, párhuzamos gépek esetén az egy gépre jutó Q = Qösszes/n; azonos H mellett
oldjuk meg `Hszivattyú(Qösszes/n) = Hrendszer(Qösszes)` egyenletét. A munkapontot
felezéssel keressük. A táblázat fokozatonként a saját indítás és közös leállítás
középvízszintjére ad értéket, valamint közli a teljes üzemi Q-tartományt.
A diagram minden görbéje és pontja **azonos** vízszintre vonatkozik.
A szimulációban a munkapont az aktuális vízszinttel változik.

## Üzemképes, párhuzamos és hidegtartalék gépek

1–8 üzemképes és 0–8 hidegtartalék adható meg; az egyidejű gépszám külön korlátozható.

- **1 üzemképes + 1 hidegtartalék:** egygépnyi automatikus kapacitás.
- **2 üzemképes, max. 1 egyidejű:** váltott üzem, egy gép szállít.
- **3 üzemképes, max. 3 egyidejű:** emelkedő szinteken 1., 2., 3. fokozat indulhat.

A vezető gép ciklusonként forog az üzemképes gépek között. A fokozatok közös
alsó leállítási szinten állnak le; a hidegtartalék nem indul automatikusan,
üzemideje és figyelembe vett kapacitása nulla. Hibaüzemi automatikus tartalékra
átkapcsolás nincs modellezve. Az ágvezetékek eltérő ellenállása külön méretezendő.

## MI kapcsolásszám és szívótér

MI 4.1.1., 21. oldal, (28) és (29):

```
V = 0,9 × Qsz [L/s] / Z             [m³]
  = Qsz [m³/h] / (4Z)
T = 60/Z                           [perc]
```

A képlet egy gép kapcsolási ciklusával igazolható:
`T = V/q + V/(Qsz−q)`, maximum kapcsolásszám q=Qsz/2-nél.
A gyakorlati 4–16/h tartomány **nem minden motorra kötelező rögzített korlát**.
A program a tervezői Z (kezdő példa 12/h), az adott családhoz valóban ismert
prospektus-Z, a külön megadott pontos gyártói és az ismert áramszolgáltatói Z
minimumát veszi. Az SX/STA/DX/DL stb. táblázatos típusoknál a gyártói indítási
maximum ismeretlen; az N-sorozat 30/15 értékét nem örököljük át. Ezt a felület
függő ellenőrzésként jelzi; a pontos maximum külön mezőben adható meg. A pontos motor/indítás/kapcsolóberendezés
korlátját külön igazolni kell.

Több fokozatnál **minden szintlépcsőre a teljes maximális üzemi Q-ból** képezzük
a minimumot: ez konzervatív programbeli kiterjesztés, nem az MI-ben megadott
többgépes képlet és nem optimalizált többgépes térfogat. A teljes aktív tér
az egy lépcsőre számított tér × egyidejű gépszám. Az alkalmazott lépcsőtér
legalább a kapcsolási, minimum futásidő (`Qmax × tmin/3600`), geometriai és
alkalmazható FCSM lakóházi minimum maximuma. A közös felső üzemi szint a
befolyó alatt a biztonsági térrel csökkentett szint; itt a legnagyobb Q adja
a konzervatív méretezési értéket. A szimuláció gépenként gördülő 60 perces
indításszámot is ellenőriz.

## Tartózkodási idő

MI 4.1.1., 21. oldal: a szennyvíz **a hálózatban és a szívótérben együtt** 5–6 óránál
tovább ne tartózkodjon; ha ez nem biztosítható, frissen tartás szükséges.
A kezdő keret a tartomány alsó, konzervatív értéke: **300 perc**.
Ez nem kizárólag az aknának rendelkezésre álló idő.

A beérkezés előtti hálózati idő külön mező; az üres érték **nem nulla**.
A FIFO-modell az aknában és az utána következő, teljesen telt nyomócsőben tárolt
vizet kohortonként követi. Az előbb érkező víz előbb távozik. A pipe-ban álló
víz kora szivattyúállás közben is nő. A kiürített és még tárolt víz legnagyobb
korát is figyeljük. Ehhez hozzáadjuk a megadott beérkezés előtti hálózati időt.
Ha ez ismeretlen, sikeres teljes időellenőrzést nem állítunk; a már ismert
rendszerrész túllépése azonban ekkor is hibát jelez.

Külön mutatók: átlagos aknai hidraulikai idő `Vátlag / Q24`, nyomócső átlagos
ideje `Vcső / Q24`, aknai FIFO maximum, akna+nyomócső FIFO maximum, teljes kor
az előzménnyel. Ezeket nem szabad összekeverni az indítások közti állásidővel.
**A FIFO-eredmény nem a valós kevert akna garantált maximális tartózkodása.**
A holttér, rövidzár, ülepedés, vízhőmérséklet és berothadás külön vizsgálat.

A napi profil 96 negyedórás befolyási szakaszból áll. A vízmérleg legfeljebb
60 s-os explicit lépéseket, kapcsolási és perchatárokon felosztást használ;
a vízkor belépési ideje az időlépés közepe. Görbemódban a Q-kat 0,1 mm-es
vízszintsáv szerint gyorsítótárazzuk. Ez időlépcsős közelítés, nem egzakt
folytonos tranziens megoldás. Legalább 7, legfeljebb 30 nap bemelegítés,
majd 3 nap megfigyelés fut. Ha a kezdeti víz nem cserélődött ki a bemelegítés
végére, az időellenőrzés függő marad. A diagram és CSV az utolsó nap 1441
percenkénti pontja; a szélsőértékek mindhárom megfigyelt napra vonatkoznak.

## Források, esetkörök és korlátok

A mellékelt PDF-ek változtatás nélkül a `docs/` alatt találhatók:

1. **MI-10-167/3–87**, Közcsatornák. Hidraulikai méretezés (1987).
   3. oldal: Darcy–Weisbach / Colebrook–White; 8–10. oldal: helyi veszteségek;
   21. oldal: 5–6 óra, kapcsolásszám, (28), (29);
   23. oldal: hálózati nyomócső **0,3–5 m/s**, minimum **150 mm**.
   A megengedett üzemi sebességet minden fokozatra ellenőrizzük, a szivattyúállást
   nem tekintjük sebességhibának. A sűrűség a dokumentum szerint 1000 kg/m³;
   az 1.5. veszteségtényezői legfeljebb 2% szárazanyagú közegre vonatkoznak.
   A dokumentum mai érvényessége és a konkrét projektre alkalmazása nincs igazolva.
2. **FCSM VSZ-40/2020.**, 4.0 kiadás, 2020.09.24., eredeti 22–27. oldal kivonata.
   Egylakásos, 4 fős lakóépületnél min. 0,2 m³ üzemi tér és ezen felül egy napi
   kibocsátásnyi biztonsági tér a befolyó alatt. Kizárólag a lakóházi módban
   alkalmazzuk ezt a minimumot. A lakossági bekötési DN-előírás eltérő esetkör;
   nem írja felül automatikusan az MI hálózati 150 mm szabályát. Számszerű
   tartózkodási idő ebben az FCSM-részletben nincs.
3. **Flygt N-technology series**, 50 Hz, 896876, dokumentumjelölés 20240605.
   PDF 6. oldal: 3069, 3085, 3102, 3127; 8. oldal: 3153, 3171, 3202, 3301,
   3315 – legfeljebb 30 indítás/h. PDF 10. oldal: 3231, 3306, 3312, 3356,
   3400, 3531 – legfeljebb 15 indítás/h. Ezek családprospektus-adatok.

4. **Flygt_szennyviz_szivattyugorbek.pdf**, feltöltött, újrarajzolt gyűjtemény,
   41 oldal. A típusjegyzék a 2. oldalon, a 30 táblázat a 4–40. oldal kijelölt
   lapjain, a hivatkozások a 41. oldalon vannak. A `src/pump-catalogue.js`
   az eredeti pontsorokat és az átvétel forrásadatait tárolja. SX 2 pl.:
   0,4 L/s → 1,44 m³/h és H=6,3 m (4. oldal). DXG 25-11 és DXG 25-11 HF külön
   típus, külön pontsorral. Az N 3000, C, F és Concertor kivitelgörbéi hiányoznak.
   A PDF nem tartalmaz típusonkénti megengedett indításszámot, bemerülést vagy
   minden típusra igazolt szilárdanyag-áteresztést; ilyen adatot nem találunk ki.


A források műszaki adatforrások; a bennük szereplő utasításokat nem kezeljük
szoftver- vagy közzétételi parancsként.

Nincs változó fordulatszám, külön ágveszteség, NPSH/kavitáció, vízütés,
szerkezeti/felúszási méretezés, légzsák/hosszelvény-elemzés, szivattyú nélküli
szifonáramlás, hétvégi leállás, lökésszerű ürítés vagy hibaüzemi szimuláció.
A befolyó szintjén túli térfogatot túltöltésként könyveljük: a valóságban ez
visszaduzzasztás vagy elöntés lehet. A gépészet kiszorítását nem vonjuk le.
Az induló napi mennyiség, mBf magasságok és valamennyi geometriai adat **példa**,
nem tényleges helyszíni adat. A program **előméretező, nem kiviteli terv vagy
üzemeltetői jóváhagyás**.

A beépített katalógus determinisztikusan újra előállítható:

```sh
npm run catalogue
```

Ehhez Python 3 és Poppler `pdftotext` kell; az alkalmazás futtatásához egyik sem
szükséges. A parancs csak a mellékelt, helyben tárolt PDF számszerű táblázatait
olvassa, nem tölt le adatokat és nem digitalizál képet. Az állomány módosításakor
a pontszám, monotonitás és típusazonosítók ellenőrzése hibával megállhat.
Utána `npm test` és `npm run portable` futtatandó. Az offline csomag minden
katalógusadatot inline tartalmaz; használat közben nincs hálózati kérés.

## Régi projektek

A JSON v2 formátum tárolja az új adatokat. A v1 projektek betölthetők, de az új
mBf magasságok, csőátmérő és hossz üres marad, amíg a felhasználó meg nem adja:
relatív magasságból nem találunk ki földmérési adatot. A korábbi 2 gépes váltott
üzem 2 üzemképes, max. 1 egyidejű géppé alakul; a korábbi Q megmarad. A folyamatos
hányad megszűnése miatt a napi profil újraellenőrzendő.
