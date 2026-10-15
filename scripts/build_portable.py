"""Create a dependency-free, file:// compatible browser distribution."""
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "letoltes"
APP = OUT / "atemelo"
APP.mkdir(parents=True, exist_ok=True)

css = (ROOT / "styles.css").read_text(encoding="utf-8")
modules = []
for name in ("n-range-images.js", "n-range-tables.js", "pump-catalogue.js", "pumps.js", "hydraulics.js", "pipe-placement.js", "calculations.js", "diagram.js", "selection.js", "app.js"):
    source = (ROOT / "src" / name).read_text(encoding="utf-8")
    source = re.sub(r"^import [^\n]+\n", "", source, flags=re.MULTILINE)
    source = re.sub(r"^export ", "", source, flags=re.MULTILINE)
    modules.append(source)
js = "\n".join(modules).replace("/docs/", "./docs/")
js = re.sub(r"</script", r"<\\/script", js, flags=re.IGNORECASE)
html = (ROOT / "index.html").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="/styles.css">', f"<style>\n{css}\n</style>")
html = html.replace('  <script type="module" src="/src/app.js"></script>\n', "")
html = html.replace('href="/docs/', 'href="./docs/')
html = html.replace("</body>", f'<script type="module">\n{js}\n</script>\n</body>')
(APP / "index.html").write_text(html, encoding="utf-8")

instructions = """ÁTEMELŐ – HASZNÁLATI ÚTMUTATÓ

1. A teljes ZIP-fájlt csomagold ki egy mappába.
2. Az atemelo mappában nyisd meg az index.html fájlt Chrome, Edge vagy Firefox böngészővel.
3. Add meg a napi szennyvízmennyiséget, a műszakok kezdetét, hosszát és létszámát.
4. Add meg a befolyó és a nyomócső végpontjának mBf magasságát, a nyomócső belső
   átmérőjét és hosszát. A program származtatja az akna fenékszintjét.
   A befolyócső fenékszintje és a nyomócső tengelye az aknafalnál egyaránt
   legalább 1 m-rel legyen a meglévő terep alatt. Add meg a terepszintet is;
   a helyi nyomócsőtengely mélysége alapértéken 1 m a terep alatt. A nyomóvezeték
   távoli végpontja külön adat. A befolyó felső palástját nem kell külön megadni.
5. A Szivattyúk összehasonlítása gomb a számszerű görbés típusokat rangsorolja
   a teljes párhuzamos fokozat névleges P₂-összege szerint (nem energiaoptimalizálás).
   Az N-sorozat új tartományábrái tájékoztatók, nem munkaponti görbék.
   Válaszd ki a Flygt típust és az üzemképes/hidegtartalék gépek számát.
   A 30 táblázatos típus kiválasztása automatikusan betölti a Q–H adatokat.
   Ezek a mellékelt, gyári táblázatokból újrarajzolt gyűjtemény számszerű pontjai;
   az eredeti gyártói kiviteladatokkal még összevetendők. Az N 3000, C, F és
   Concertor pontos kivitelgörbéi nincsenek ebben a mellékletben. Az N-családok
   kiválasztásakor az eredeti típusoldal és a rendelkezésre álló adatok jelennek
   meg, számított munkapont vagy aknaméret nélkül. A 16 N-család ábráiból kiolvasott,
   közelítő alsó/felső H-határt tartalmazó táblázatok is láthatók és CSV-be menthetők.
   Ezek nem konkrét szivattyúkivitel jelleggörbéi. Kézi görbeadat-bevitel nincs.
   A hidegtartalék nem indul automatikusan. A több üzemképes gép váltott és
   párhuzamos üzemben is modellezhető, az egyidejű gépszám megadásával.
6. A Projekt mentése gombbal JSON-fájlba menthetsz; ezt később visszatöltheted.
   Biztos megőrzéshez használd ezt a mentést, mert a helyi böngészőtároló kezelése
   fájlból nyitott oldalaknál böngészőnként eltérhet.
7. A Nyomtatás / PDF gombbal jelentést készíthetsz. A napi diagramok óránként
   feliratozottak, félórás osztásokkal; szűk képernyőn oldalra görgethetők.

Nincs telepítés, szerver vagy internetkapcsolat a használathoz. A docs mappát
tartsd az index.html mellett: ebben van az öt hivatkozott forrás-PDF.

Előméretező változat: a munkapont és a minimális bemerülés a pontos kivitel
adatlapjából igazolandó. Az MI-10-167/3–87 a hálózat és a szívótér együttes
idejére 5–6 órát ad. A minimum idő alapértéke 0 perc, a felső keret üres. A hálózati előzményt külön add meg.
Felső keret nélkül a program nem igazol időkorlát-megfelelőséget.
Az irányelv mai alkalmazhatóságát egyeztetni kell.
A FIFO-vízkor ideális modell, a kiviteli tervezést és üzemeltetői egyeztetést
nem helyettesíti.
"""
(APP / "HASZNALAT.txt").write_text(instructions, encoding="utf-8")
files = [APP / "index.html", APP / "HASZNALAT.txt"]
for name in ("fcsm-2020.pdf", "flygt-n-896876.pdf", "mi-10-167-3-1987.pdf", "flygt-szennyviz-szivattyugorbek.pdf", "flygt-n-3000-tartomanyok.pdf"):
    target = APP / "docs" / name
    target.parent.mkdir(exist_ok=True)
    target.write_bytes((ROOT / "docs" / name).read_bytes())
    files.append(target)

archive = OUT / "atemelo.zip"
with ZipFile(archive, "w", compression=ZIP_DEFLATED) as z:
    for file in files:
        # Stable metadata: rebuilding unchanged sources must not dirty the ZIP.
        info = ZipInfo(str(file.relative_to(OUT)), date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, file.read_bytes())
print(f"Elkészült: {archive} ({archive.stat().st_size:,} bájt)")
