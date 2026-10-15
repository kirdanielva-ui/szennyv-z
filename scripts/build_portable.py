"""Create a dependency-free, file:// compatible browser distribution."""
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "letoltes"
APP = OUT / "atemelo"
APP.mkdir(parents=True, exist_ok=True)

css = (ROOT / "styles.css").read_text(encoding="utf-8")
modules = []
for name in ("pumps.js", "calculations.js", "app.js"):
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
4. Válaszd ki a Flygt típuscsaládot, és add meg a pontos munkaponti vízhozamot.
5. Állítsd be az akna és a kapcsolás tervezői adatait. Az eredmény automatikusan frissül.
6. A Projekt mentése gombbal JSON-fájlba menthetsz; ezt később visszatöltheted.
   Biztos megőrzéshez használd ezt a mentést, mert a helyi böngészőtároló kezelése
   fájlból nyitott oldalaknál böngészőnként eltérhet.
7. A Nyomtatás / PDF gombbal jelentést készíthetsz.

Nincs telepítés, szerver vagy internetkapcsolat a használathoz. A docs mappát
tartsd az index.html mellett: ebben van a két hivatkozott forrás-PDF.

Előméretező változat: a munkapont és a minimális bemerülés a pontos kivitel
adatlapjából igazolandó. A mellékelt 2020-as FCSM-részlet nem közöl számszerű
tartózkodásiidő-korlátot; a projektre egyeztetett értéket kell megadni.
A FIFO-vízkor ideális modell, a kiviteli tervezést és üzemeltetői egyeztetést
nem helyettesíti.
"""
(APP / "HASZNALAT.txt").write_text(instructions, encoding="utf-8")
files = [APP / "index.html", APP / "HASZNALAT.txt"]
for name in ("fcsm-2020.pdf", "flygt-n-896876.pdf"):
    target = APP / "docs" / name
    target.parent.mkdir(exist_ok=True)
    target.write_bytes((ROOT / "docs" / name).read_bytes())
    files.append(target)

archive = OUT / "atemelo.zip"
with ZipFile(archive, "w", compression=ZIP_DEFLATED) as z:
    for file in files:
        z.write(file, file.relative_to(OUT))
print(f"Elkészült: {archive} ({archive.stat().st_size:,} bájt)")
