---
name: gis-edit-workflow
description: >
  Povinný pracovní postup pro každou editaci projektu Google Image Studio (GIS).
  Použij tento skill VŽDY když uživatel chce upravit, opravit, přidat funkci nebo
  jinak změnit soubor google-image-studio_vXX.html nebo proxy Worker. Zahrnuje:
  načtení aktuálního stavu, bezpečné stavění z nejnovější verze, syntax check,
  bump verze a aktualizaci STAV.md. Také obsahuje kritické implementační gotchas
  které zabraňují nejčastějším bugům, přehled architektury a pravidlo pro přidávání
  nových komponentů. Vždy použij tento skill před zahájením jakékoli práce na GIS.
---

# GIS Edit Workflow (v161en+)

## ⚠️ ABSOLUTNÍ PRAVIDLA — NIKDY NEPORUŠIT

### PRAVIDLO 0: Vždy ověř verzi modulů PŘED zahájením práce
Uživatel uploaduje aktuální moduly do project files po každé session.
`/mnt/project/` MŮŽE být zastaralý kvůli cache nebo timing — **nikdy nepředpokládej že je aktuální**.

**Povinný první krok každé session** — spusť tento check:
```bash
echo "=== VERSION CHECK ===" && \
echo "refs.js — describeRefImage:" && grep -c "describeRefImage" /mnt/project/refs.js && \
echo "refs.js — _runDescribe:" && grep -c "_runDescribe" /mnt/project/refs.js && \
echo "video.js — topaz_video:" && grep -c "topaz_video" /mnt/project/video.js && \
echo "fal.js — _falQueue:" && grep -c "_falQueue" /mnt/project/fal.js && \
echo "gallery.js — dbPatchMeta:" && grep -c "dbPatchMeta" /mnt/project/gallery.js && \
echo "db.js — dbPatchMeta def:" && grep -c "function dbPatchMeta" /mnt/project/db.js && \
echo "models.js — GIS_COPYRIGHT:" && grep -c "GIS_COPYRIGHT" /mnt/project/models.js && \
echo "ai-prompt.js — AI_OUTPUT_IDS:" && grep -c "AI_OUTPUT_IDS" /mnt/project/ai-prompt.js
```

**Očekávané výsledky — vše musí být `1` nebo vyšší:**
| Soubor | Signatura | Min |
|--------|-----------|-----|
| refs.js | `describeRefImage` | 1 |
| refs.js | `_runDescribe` | 1 |
| video.js | `topaz_video` | 1 |
| fal.js | `_falQueue` | 1 |
| gallery.js | `dbPatchMeta` | 1 |
| db.js | `function dbPatchMeta` | 1 |
| models.js | `GIS_COPYRIGHT` | 1 |
| ai-prompt.js | `AI_OUTPUT_IDS` | 1 |

**Pokud jakýkoliv check vrátí `0`:**
→ Modul je stale. **ZASTAV.** Řekni uživateli: "Modul X je stará verze — chybí funkce Y. Prosím re-uploaduj aktuální X.js do project files."
→ **Nezačínej kódovat** dokud check neprojde.

**Pokud check projde:** Pokračuj normálně — moduly jsou aktuální.

### PRAVIDLO 1: Nikdy needitovat built HTML přímo
**Vždy edituj moduly v `src/`, nikdy hotový `dist/` nebo `outputs/` HTML.**

Porušení způsobí, že změny existují pouze v HTML ale NE v modulech.
Při příštím chatu se načtou staré moduly → změny se ztratí → bugy se vrátí.

```
✓ SPRÁVNĚ: edituj /home/claude/src/video.js → node build.js → dist/
✗ CHYBA:   edituj /home/claude/google-image-studio_v161en.html přímo
```

### PRAVIDLO 2: Na konci každé session výstup VŠECH změněných modulů
Nestačí jen HTML. Každý změněný modul musí jít do `/mnt/user-data/outputs/`.

```bash
# Po každé session — výstup HTML + všechny změněné moduly:
cp /home/claude/dist/google-image-studio_v162en.html /mnt/user-data/outputs/
cp /home/claude/src/video.js      /mnt/user-data/outputs/   # pokud byl změněn
cp /home/claude/src/fal.js        /mnt/user-data/outputs/   # pokud byl změněn
# ... atd. pro každý změněný modul
```

### PRAVIDLO 3: Na začátku session ověř konzistenci modulů
Projekt moduly v `/mnt/project/` nemusí být aktuální. Viz sekce 4.

### PRAVIDLO 4: Nikdy neodstraňovat modely ani funkce bez explicitního souhlasu
Ani při refaktoringu nesmíš odstranit model, endpoint nebo UI funkci, pokud to
uživatel výslovně nenavrhl. Při pochybnostech se ptej.

---

## 1. Zahájení každého chatu / edit session

### Krok 1: Version check (viz PRAVIDLO 0 výše) — POVINNÝ
Spusť check před čímkoliv jiným. Pokud selže → zastav a informuj uživatele.

### Krok 2: Načti aktuální stav
```bash
# STAV.md říká aktuální verzi, co je hotové, a co je příští verze
cat /mnt/project/STAV.md
```

### Build workflow
```bash
# 1. Připrav pracovní adresář
mkdir -p /home/claude/src /home/claude/dist

# 2. Zkopíruj VŠECHNY moduly (pořadí build.js — viz sekce 7)
for f in models styles setup spending model-select assets refs generate fal \
          output-placeholder proxy gemini output-render db gallery toast paint \
          ai-prompt video; do
  cp /mnt/project/${f}.js /home/claude/src/${f}.js
done
cp /mnt/project/template.html /home/claude/src/template.html
cp /mnt/project/build.js      /home/claude/build.js

# 3. Edituj moduly v /home/claude/src/

# 4. Build (číslo verze = příští verze z STAV.md)
cd /home/claude && node build.js 162en

# 5. Syntax check
awk '/^<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' \
  /home/claude/dist/google-image-studio_v162en.html > /tmp/check.mjs
node --input-type=module < /tmp/check.mjs 2>&1 | head -5
# OK výstup: "ReferenceError: window is not defined"

# 6. Výstup HTML + VŠECHNY změněné moduly
cp /home/claude/dist/google-image-studio_v162en.html /mnt/user-data/outputs/
# + každý změněný .js a template.html
```

### Ověř co je hotovo
Viz sekce "Kde jsme přestali" v STAV.md. Nekóduj znovu věci které jsou hotové.

---

## 2. Přidávání nových komponentů — POVINNÁ analýza

Před implementací jakéhokoli nového modelu, providera nebo UI prvku:

### 1. Analyzuj existující analogický komponent
Najdi nejpodobnější existující implementaci a přečti ji celou:
```bash
# Příklad: přidáváš nový fal.ai video model → přečti Seedance nebo Vidu implementaci
grep -n "seedance\|vidu" /home/claude/src/video.js
# pak view s view_range pro celou implementaci
```

### 2. Přepiš všechna relevantní funkční nastavení
Každý nový komponent musí podporovat stejné obecné funkce jako ostatní stejného typu:
- **Image model:** refs (getRefDataForApi), snap parametry, počet výstupů, folder, seed, safety
- **Video model:** refMode, duration, aspect ratio, audio toggle, folder, spending log
- **Upscale:** upscaleMode řetězec, display v output label, dispatch v runUpscaleJob

### 3. Použij stejné ovládací prvky a grafické zobrazení
- Nový image model: stejná struktura modelu v `IMAGE_MODELS`, stejný dispatch v `runJob`
- Nový video model: stejná struktura v `VIDEO_MODELS`, stejný dispatch v `runVideoJob`
- Nové UI params: stejný styl jako existující params stejného modelu (radio, select, checkbox)
- Nový provider klíč: stejný pattern v setup.js a spending.js jako ostatní klíče

### 4. Zapojení musí být organické
Po přidání nového komponentu projdi všechna místa kde se zpracovávají ostatní modely
stejného typu a přidej nový typ tam, kde to logicky patří:
```bash
# Příklad: přidáváš nový video typ
grep -n "wan_video\|seedance_video\|vidu_video" /home/claude/src/video.js
# → zkontroluj každý výskyt, zda nový typ potřebuje analogické zacházení
```

---

## 3. Před každou úpravou modulu

### Přečti relevantní části kódu
Modul má stovky až tisíce řádků. Před úpravou vždy zobraz funkci:
```bash
grep -n "functionName" /home/claude/src/video.js
# pak view s view_range pro dané řádky
```

### Syntax check po každé úpravě
```bash
cd /home/claude && node build.js 162en 2>&1 | tail -3
awk '/^<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' \
  /home/claude/dist/google-image-studio_v162en.html > /tmp/check.mjs
node --input-type=module < /tmp/check.mjs 2>&1 | head -5
```

---

## 4. Konzistence modulů — detekce stale verzí

**Uživatelův workflow je správný:** Uživatel uploaduje každý výstupní modul okamžitě zpět do project files a maže starý. `/mnt/project/` by tedy měl být aktuální — ale kvůli možnému caching nebo timing problému na straně Claudea **vždy ověřuj přes PRAVIDLO 0** na začátku session, ne slepou důvěrou.

**Pokud check selže:** Nepokoušej se problém obejít nebo odhadnout co v modulu je. Přímočaře řekni uživateli který konkrétní soubor je stale a požádej o re-upload. Uživatel soubor má vždy k dispozici v Downloads z předchozí session.

### Klíčové signatury pro rychlý check (v161en)

```bash
# video.js — Topaz video modely (v147en+)
grep -c "topaz_video" /mnt/project/video.js           # musí být > 0

# video.js — Seedance + Vidu (v140+)
grep -c "seedance_video" /mnt/project/video.js        # musí být > 0
grep -c "vidu_video" /mnt/project/video.js            # musí být > 0

# video.js — WAN 2.7 video + WAN 2.6 (v147+)
grep -c "wan27_video" /mnt/project/video.js           # musí být > 0
grep -c "wan_video" /mnt/project/video.js             # musí být > 0

# fal.js — callWan27 pro image (v159+)
grep -c "callWan27" /mnt/project/fal.js               # musí být > 0

# models.js — wan27r image modely + proxy_xai + proxy_luma (v159+)
grep -c "wan27r" /mnt/project/models.js               # musí být > 0
grep -c "proxy_xai" /mnt/project/models.js            # musí být > 0

# spending.js — existuje jako samostatný modul (v140+)
ls /mnt/project/spending.js                           # musí existovat

# model-select.js — existuje jako samostatný modul (v140+)
ls /mnt/project/model-select.js                       # musí existovat

# refs.js — describe funkce (v161en)
grep -c "describeRefImage" /mnt/project/refs.js       # musí být > 0
grep -c "_runDescribe" /mnt/project/refs.js           # musí být > 0

# refs.js — refs jsou asset linky, ne inline data (v102+)
grep -c "aiPromptContext" /mnt/project/refs.js        # musí být > 0

# gallery.js — selectedGalItems (v102+)
grep -c "let selectedGalItems" /mnt/project/gallery.js # musí být 1
```

Pokud kontrola selže → modul je stale → **aktualizuj ho z posledního built HTML**
(extrahuj sekci nebo přepiš celý modul) před zahájením nové práce.

---

## 5. Bump verze a aktualizace STAV.md

Každá session = nová verze:
```bash
node build.js 162en  # → dist/google-image-studio_v162en.html
```

Po dokončení chatu aktualizuj STAV.md:
- Sekce "Aktuální verze" — nový soubor a datum
- Sekce "Historie verzí" — co bylo uděláno
- Sekce "Kde jsme přestali" — detailní popis změn
- Sekce "Aktivní TODO" — odpiš hotové, přidej nové
- Sekce "Přehled modulů" — updatuj poslední změnu pro každý změněný modul

---

## 6. Kdy aktualizovat další dokumenty

| Dokument | Kdy aktualizovat |
|----------|-----------------|
| `STAV.md` | Po každém chatu |
| `ARCHITECTURE.md` | Nová funkce, změna globálního state, nový dispatch |
| `DECISIONS.md` | Netriviální design decision s alternativami |
| `API_MODELS.md` | Nový model, nový endpoint, nový gotcha |
| `GIS_Manual_*.html` | Nová user-facing funkce |

---

## 7. Přehled architektury (rychlá reference)

### Build pořadí modulů (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```

> ⚠ Proxy soubory (`xai.js`, `luma.js`, `magnific.js`, `topaz.js`, `topaz-image.js`,
> `replicate-wan27.js`, `index.js`) jsou Cloudflare Worker soubory — **NEJSOU** build moduly.
> Patří do separátního projektu `gis-proxy`. Deploy: `cd C:\Users\Petr\Documents\gis-proxy → npm run deploy`

### Image model types (models.js → generate.js → runJob)
| type | handler | provider |
|------|---------|---------|
| `gemini` | `callGeminiStream()` | Google Gemini |
| `imagen` | `callImagen()` | Google Imagen |
| `flux` | `callFlux()` | fal.ai |
| `seedream` | `callSeedream()` | fal.ai |
| `kling` | `callKling()` | fal.ai |
| `zimage` | `callZImage()` | fal.ai |
| `wan27r` | `callWan27()` | fal.ai / Replicate via proxy |
| `qwen2` | `callQwen2()` | fal.ai |
| `proxy_xai` | proxy `/xai/generate` | xAI Grok |
| `proxy_luma` | proxy `/luma/generate` | Luma Photon |
| `isUpscale: true` | `runUpscaleJob()` | fal.ai / Topaz via proxy |

### Video model types (VIDEO_MODELS → video.js → runVideoJob)
| type | handler | provider |
|------|---------|---------|
| `veo` | `callVeoVideo()` | Google Gemini predictLongRunning |
| `luma_video` | `callLumaVideo()` | Luma Ray via proxy |
| `kling_video` | `runVideoJob()` → fal.ai queue | fal.ai |
| `seedance_video` | `runVideoJob()` → fal.ai queue | fal.ai |
| `vidu_video` | `runVideoJob()` → fal.ai queue | fal.ai |
| `wan27_video` | `callWan27Video()` | fal.ai queue |
| `wan_video` | `runVideoJob()` → fal.ai queue | fal.ai |
| `topaz_video` | `runTopazQueueJob()` | Topaz Labs via proxy |

### Upscale modes (output-render.js → runUpscaleJob in fal.js)
| upscaleMode | handler | provider |
|-------------|---------|---------|
| `clarity` | fal.ai clarity-upscaler | fal.ai |
| `seedvr` | fal.ai SeedVR2 | fal.ai |
| `magnific` | proxy `/magnific/upscale` | Magnific |
| `topaz_gigapixel` | proxy `/topaz/image/gigapixel` | Topaz Gigapixel |
| `topaz_bloom` | proxy `/topaz/image/bloom` | Topaz Bloom/Wonder2 |

### Proxy architektura (gis-proxy Worker)
| Route | Provider |
|-------|----------|
| POST /xai/generate | xAI Grok Imagine |
| POST /luma/generate | Luma Photon image |
| POST /luma/video/submit | Luma Ray video |
| POST /magnific/upscale | Magnific upscale |
| POST /fal/submit | fal.ai queue CORS bypass |
| POST /topaz/video/submit | Topaz video (async polling) |
| POST /topaz/image/gigapixel | Topaz Gigapixel (async) |
| POST /topaz/image/bloom | Topaz Bloom + Wonder2 (async) |
| POST /replicate/wan27/submit | Replicate WAN 2.7 image |
| POST /replicate/wan27/status | Replicate WAN 2.7 poll |

### Storage architektura (v102+)
- Refs a assets = originál v plném rozlišení v assets DB
- `refs[]` a `videoRefs[]` = asset linky `{assetId, thumb, dims}` — NO inline data
- `getRefDataForApi(ref, maxPx)` → načte `imageData` z DB on-demand (async, vždy await)
- `usedRefs` / `usedVideoRefs` v galerii = jen `{assetId, autoName, userLabel, mimeType}`

---

## 8. Kritické implementační gotchas

### generateThumb — mimeType POVINNÝ
```javascript
// ✓ SPRÁVNĚ
generateThumb(imageData, 'image/png')
generateThumb(imageData, mimeType)
// ✗ CHYBA — JPEG selže na file:// protokolu
generateThumb(imageData)
```

### setAspectRatioSafe — VŽDY místo přímého .value
```javascript
// ✓ SPRÁVNĚ
setAspectRatioSafe('16:9')
// ✗ CHYBA — pixel ratia nechají select prázdný
document.getElementById('aspectRatio').value = '1472:832'
```

### fal.ai API klíč — správné ID elementu
```javascript
// ✓ SPRÁVNĚ (historické pojmenování)
document.getElementById('fluxApiKey').value
// ✗ CHYBA — vrátí null, tichý fail
document.getElementById('falApiKey').value
```

### fal.ai auth header
```javascript
// ✓ SPRÁVNĚ
'Authorization': `Key ${falKey}`
// ✗ CHYBA
'Authorization': `Bearer ${falKey}`
```

### runJob dispatch — explicitní else if, žádný catch-all
```javascript
// ✓ SPRÁVNĚ — každá větev explicitní
if      (job.isUpscale)               → runUpscaleJob()
else if (model.type === 'gemini')     → callGeminiStream()
else if (model.type === 'wan27r')     → callWan27()
// ✗ CHYBA — nikdy přidávat catch-all else {}
```

### getRefDataForApi — async, vždy await
```javascript
// ✓ SPRÁVNĚ
const apiRef = await getRefDataForApi(r, 'setting')
// ✗ CHYBA — vrátí Promise, ne data
const apiRef = getRefDataForApi(r, 'setting')
```

### Refs architektura (v102+) — refs jsou asset linky
```javascript
// ✓ SPRÁVNĚ — ref neobsahuje data, jen odkaz na asset
refs.push({ assetId: asset.id, autoName, userLabel, mimeType, thumb, dims })
videoRefs.push({ assetId: asset.id, autoName, userLabel, mimeType, thumb, dims })

// ✗ CHYBA — data inline v ref (starý formát)
refs.push({ data: b64, url: dataUrl, mimeType, ... })

// ✓ addVideoRef bere celý asset objekt (v102+)
addVideoRef(asset)
// ✗ CHYBA — starý podpis
addVideoRef(data, mimeType, name, userLabel, assetId)
```

### Veo — generateAudio se NEPOSÍLÁ
```javascript
// ✓ SPRÁVNĚ — Gemini Veo generuje audio automaticky
const parameters = { aspectRatio, durationSeconds, resolution, sampleCount }
// ✗ CHYBA — způsobí 400 INVALID_ARGUMENT
parameters.generateAudio = true
```

### fal.ai generate_audio — musí být explicitní
```javascript
// ✓ SPRÁVNĚ — jinak fal.ai defaultuje na audio=ON (extra cost)
generate_audio: !!enableAudio
// ✗ CHYBA — opomenutí způsobí nechtěné audio poplatky
```

### Kling video — kritické payload detaily
```javascript
// ✓ SPRÁVNĚ
{ duration: "5",            // STRING, ne integer
  start_image_url: url,     // ne image_url
  generate_audio: false }   // ne enable_audio
// aspect_ratio: posílat JEN pro T2V, ne pro I2V
```

### WAN 2.7 image — resolution jako pixel string
```javascript
// ✓ SPRÁVNĚ — "1280×720" se parsuje na { width, height }
// Select element: wan27Res, hodnoty jako "1280×720"
// ✗ CHYBA — imageSize: "1K" nebo "2K" (staré radio, odstraněno)
```

### Describe funkce — 4-arg signature (v161en)
```javascript
// ✓ SPRÁVNĚ — kompatibilní s refs.js i video.js
_runDescribe(apiKey, imageData, mimeType, mode)
// Refs: describeRefImage(idx) → načte data přes dbGet('assets', ref.assetId)
// Video: describeVideoRef(idx) → načte data přes dbGet('videos', id)
```

### Z-Image — acceleration jen pro Turbo
```javascript
// ✓ SPRÁVNĚ — Base endpoint ho nepodporuje
if (isTurbo) payload.acceleration = accelerationValue
// ✗ CHYBA — posílání acceleration pro Base způsobuje 4xx
```

### Gemini image — candidateCount nefunguje
```javascript
// ✓ SPRÁVNĚ — paralelní Promise.allSettled batches
// ✗ CHYBA — candidateCount vrátí 400 error
// responseModalities musí být ["TEXT","IMAGE"]
// thinkingConfig nepodporován na Nano/Pro
```

### Proxy — Worker wall-clock limit
Worker free tier má ~30s limit. Polling NIKDY neběží uvnitř Workeru.
Worker jen submituje job a vrátí ID → klient provádí veškerý polling.
