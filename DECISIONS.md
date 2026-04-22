# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 22. 4. 2026 · v205en GPT Image 1.5 & 2 integrace*

---

## GPT Image 1.5 & 2 — OpenAI rodina přes fal.ai (22. 4. 2026, v205en)

**Kontext:** 21. 4. 2026 fal.ai (den po OpenAI release) spustil `openai/gpt-image-2` + `/edit` endpointy. Current (15+ models in dropdown) + rozsah schopností (pixel-perfect text rendering, až 4K, mask-based edits) → nutná integrace **hned**. Spolu s tím nabídka pro GPT Image 1.5 (`fal-ai/gpt-image-1.5`) — prior gen s `input_fidelity` a `background=transparent` supportem (neintegrováno).

### Rozhodnutí 1: Integrovat oba modely (1.5 + 2) paralelně

Technicky pro GPT 2 je uvedeno že nahrazuje 1.5, ale 1.5 má dvě capabilities co 2.0 nemá: `background=transparent` support a `input_fidelity` parametr. Pro budoucí use cases (produktové compositing s alpha transparency) je užitečné mít oba. Navíc marginal cost: GPT 1.5 přidává jen variantu v `models.js` + 8 price keys, vše ostatní sdílí s GPT 2 (unified panel, mask handling, streaming infrastruktura).

### Rozhodnutí 2: Split T2I / Edit jako separátní modely (4 entries)

Zvažované varianty:
- **A1. Two separate modely** (T2I + Edit jako samostatné záznamy) ✅ zvoleno
- **A2. One model, auto-switch** (routing podle přítomnosti ref images)

Zvoleno A1 protože:
- Z-Image už má stejný pattern (Turbo vs Turbo I2I)
- Explicit user intent — vybere "GPT Image 2 Edit" když chce edit, ne když omylem necháš ref v refs
- Pricing se liší (edit má image input tokens)
- Edit endpoint používá `image_urls[]` (plural) — jiný UX model než GIS single-ref I2I

### Rozhodnutí 3: Unified panel + nový `upQuality` flag

Varianty:
- **B1. Unified flag `upQuality`** (radio low/med/high) ✅ zvoleno
- **B2. Custom legacy panel** (jako Mystic/Photon)

Zvoleno B1 protože:
- V v200en právě probíhal refactor z 9 legacy panelů na unified
- Quality tier není GPT-specific — FLUX.2-flex, potenciálně další budou mít taky. Reusable flag = rozšíření zdarma
- Jen +1 flag v unified template, +1 toggle v `model-select.js`

Styling: **`.toggle-row` pattern** (stejný jako Resolution) — 3 zlaté buttony, 30× cost spread mezi tiers. Pozice: **přímo nad Generate tlačítkem** (UX flow: nastavuj → generuj).

### Rozhodnutí 4: Mask přes annotation layer (varianta B)

Zvažované varianty:
- **A. Mask button na každém thumbnail** (paint modal per-ref)
- **B. Auto z annotation layer assetu** ✅ zvoleno
- **C. Pre-made mask upload se speciálním tagem** (odmítnuto — pracné)

Zvoleno B protože:
- Využívá existující "annotate → save asset" flow z paint toolu
- Zero new UI concepts — jen annotation tool dostane druhou funkci
- Paint.js už generuje `_annotateAnnotCanvas` s color strokes + transparent bg — přesně to co potřebujeme
- User workflow: paint obrázku → anotace → Export mode B → GIS vloží 2 refs (orig + annotation), druhý automaticky dostane `role: 'mask'`

Technické detaily:
- OpenAI mask format: **RGBA PNG s alpha channel** (alpha=0 edit, alpha=255 keep), musí match input image dims
- Converter `_annotAssetToGptMask()`: detekce near-white pixelů (threshold 245) → alpha=255, ostatní → alpha=0
- Resize `_resizeGptMaskToMatch()`: pokud user anotoval na jiný resolution než target → nearest-neighbor resize (alpha sharp)
- Thumbnail UI: růžový 🎭 MASK badge + `.ref-is-mask` border tint. Hover na non-mask refs (při aktivním GPT Edit modelu) zobrazí tlumený 🎭 → manual toggle
- Dual field name: `mask_url` (GPT 2) vs `mask_image_url` (GPT 1.5) — routing v `_buildGptPayload`

### Rozhodnutí 5: 1K = custom dims, NE preset enum (kritický fix)

**První implementace** posílala pro 1K tier fal preset enum (`landscape_16_9`, `square_hd` apod). Výsledek: user dostal 1088×608 — fal "economy preset", **příliš malé pro produkci**.

**Oprava:** vždy posílat custom `{width, height}` objekt. Long side podle tier:
- 1K → **1536** (square 1536², 16:9 = 1536×864)
- 2K → 2048
- 4K → 3840

Constraints enforced v `_gpt2SizeFromAspect()`:
- Multiples of 16
- Max edge 3840 px
- Pixel count 655k–8.29M (area cap s auto-scaledown)
- Min floor 655k s auto-scaleup pro extrémní AR

**Důsledek pro `updateUnifiedResInfo`** (info text vpravo): totožný výpočet jako payload builder → co user vidí yellow text = co model dostane. Jediný source of truth.

### Rozhodnutí 6: Streaming VYPNUTO (code retained)

**Pokus:** zapnout SSE streaming pro `/edit` endpointy (fal blog tvrdí "progressive diffusion preview").

**Diagnóza z user testů:**
- GPT 2 edit: 1 event, data URI 2.7MB = finální obrázek
- GPT 1.5 edit: 1 event, data URI 3MB = finální obrázek
- Žádné progressive frames pro ani jeden model

**Závěr:** fal aktuálně (duben 2026) implementuje `/stream` endpoint pro GPT modely jako **"stream end = final event"** — funkčně identické s queue, jen přes SSE místo pollingu. Žádný user-visible benefit, naopak víc komplexity (SSE parsing, data URI detection, fallback logic).

**Rozhodnutí:** `streaming: false` na obou edit modelech. Použít `_falQueue` (stejný path jako FLUX/SeeDream/etc). Stream code (`_falStreamEdit`, `updatePlaceholderPartial`) zachován — flip 1 boolean na `true` až fal přidá progressive.

**Gotcha pro budoucí stream re-enable:** preview overlay MUSÍ jít do `.ph-body` (má `position:relative + aspect-ratio`), ne do `.img-card` (bez positioning → overflow do `#center` wrapperu = fullscreen bug).

### Rozhodnutí 7: `ref.role = 'mask'` jako první role metadata

Na rozdíl od `role: 'style' / 'character'` (které fungují per-model jinak v existing code), `role: 'mask'` je **structural** — nejen tag, ale mění *jak se ref sends to API*. Partition function `_partitionGptRefs()` to rozděluje:
- `role === 'mask'` → mask field
- ostatní → `image_urls[]` (plural)

Pouze jeden mask na refs v daném momentě (OpenAI aplikuje mask na image #1). Toggle handling: když user flipne role na nový ref, starý mask role se clear.

### Pricing architecture

29 price keys celkem:
- GPT 2: 9 per-size (low/med/high × 1024sq/1024×1536/1536×1024) + 6 tier-based (low/med/high × 2K/4K)
- GPT 1.5: 8 (low má collapsed `_gptimg15_low_other` pro non-square)

`_pickGptPriceKey()` picker routes podle model/quality/size/resolution. Result objekt carry `priceKey` → `trackSpend('fal', priceKey)` v runJob.

**Ballpark pro 2K/4K:** fal nepublikuje explicit ceny; odvozeno z published extremes (4K high = $0.41/img, 1K high = $0.211/img → ~2× scaling per tier step).

### Naučené gotchas (do memory)

1. **Model dropdown je hardcoded v `template.html`** — v této session jsem na to spadl při prvním buildu. Přidávání modelu = EDIT 2 MÍSTA: `models.js` entry + `<option>` v `#modelSelect`.
2. **CSS absolute escape** — `position:absolute` se váže na nejbližší `position:relative` předka. V GIS je to `#center` pro elementy přímo v `.img-card`. Preview element MUSÍ jít do `.ph-body`.
3. **Fal preset enum ≠ production quality** — preset enum jsou "economy" sizes pro GPT (~1088×608). Custom dims vždy pro produkci.
4. **Fal streaming for GPT (duben 2026)** — neprodukuje progressive frames. Používat queue.

---

*Aktualizováno 21. 4. 2026 · v204en Seedance 2.0 1080p + pricing refactor*

---

## Seedance 2.0 — 1080p support + pricing architektura (21. 4. 2026, v204en)

**Kontext:** fal.ai přidal 21. 4. 2026 v 1:06 AM (Discord announcement + playground dropdown) rozlišení **1080p** pro Seedance 2.0 na 3 standard endpointech. Fast endpointy 1080p nemají. Potřeba promptní integrace do GIS + příležitost na úklid pricing logiky.

### Zjištění ceny (fal pricing text chybí)

fal v UI ani v docs aktuálně nepublikoval explicitní 1080p cenu — teprve doplní. Ale **token formule je transparentní**:

```
tokens_per_second = (height × width × 24) / 1024
standard_cost = tokens/s × $0.014 / 1000
fast_cost     = tokens/s × $0.0112 / 1000
```

Validace vs publikované ceny pro 720p 16:9 (1280×720):
- tokens/s = 21 600
- Standard: 21 600 × 0.014/1000 = **$0.3024/s** (publikováno $0.3034/s, rozdíl 0.3 % rounding)
- Fast: 21 600 × 0.0112/1000 = **$0.2419/s** (exact match ✓)

Formule sedí → stejně aplikovatelná pro 1080p (1920×1080):
- tokens/s = 48 600
- Standard 1080p: **$0.6804/s**

### Zvažované varianty

**A) Jeden generický pricing handler funkce** v `spending.js`
```javascript
_seedance2_std:  (dur, res, hasVidRefs) => _sd2Price(dur, res, 0.014, hasVidRefs),
_seedance2_fast: (dur, res, hasVidRefs) => _sd2Price(dur, res, 0.0112, hasVidRefs),
```
+ Elegantní: 2 keys místo 10, nová resolution = řádek v `dims` mapě
− Rozbíjí `trackSpend()` signaturu — současné API bere číslo jako rate, ne funkci. Vyžadovalo by refaktor v celém `trackSpend()` flow a v mnoha dalších call sites. Risk kaskádového rozbití.

**B) 10 hardcoded pricing keys** v per-resolution × tier × R2V-multiplier struktuře
+ Minimální blast radius (pouze přidám keys, zbytek trackSpend beze změny)
+ Všechny hodnoty vidět na jednom místě ke kontrole
− Při budoucím přidání 1440p/4K = +4 keys ručně

**Rozhodnutí: B.** Pragmaticky vyhraje — GIS rarely přidává nové resolutions u existujícího modelu. Refaktor `trackSpend()` signatury pro jediný model je nepřiměřený risk/value. Varianta A byla atraktivní architektonicky, ale stejný pattern by pak tlačil k refaktorování 30+ ostatních modelů, což Session 2 (unified video panel) bude řešit systematicky.

### 1080p visibility logika

**Problém:** Fast endpointy 1080p nemají. User může přepnout z `seedance2_t2v` (std) s vybraným 1080p na `seedance2f_t2v` (fast) — UI musí:
1. Skrýt 1080p volbu
2. Změnit výběr na platnou hodnotu (nejpřirozenější: 720p)

**Řešení:** Wrapper `sd2Res1080Wrap` kolem 1080p `<label>` + JS logika v `_applyVideoModel`:
```javascript
const has1080p = (m.resolutions || []).includes('1080p');
sd2Res1080Wrap.style.display = has1080p ? '' : 'none';
const curRes = document.querySelector('input[name="sd2Res"]:checked');
if (curRes?.value === '1080p' && !has1080p) {
  document.querySelector('input[name="sd2Res"][value="720p"]').checked = true;
}
```

Alternativa: disabled radio místo hidden. Zamítnuto — vizuální šum, matoucí UX ("proč to nejde kliknout?").

### R2V 0.6× multiplier detection (bonus)

**Problém:** Historicky GIS netrackoval `0.6×` multiplier pro R2V s video inputs. User platil fal reálně méně. Dříve jsme se zaměřovali jen na Fast R2V (`_seedance2_r2v_fast`), Standard R2V s video refs nebyl trackovaný.

**Řešení:** Detekce `hasVidRefs = isR2V && (sd2Snap?.vidSrcIds || []).some(Boolean)` → routing do správného klíče. 10 keys × 3 resolutions × 2 tiers × 2 ref-modes.

### Oprava starého bugu

Původní `_seedance2_r2v_fast: 0.181` (v195en) byla chybná. Podle fal dokumentace `/fast/reference-to-video`: *"With video inputs and 720p resolution the price is $0.14515 per second."* Opraveno na `0.1452`.

### UI bonusy

**Prompt hint box** pod Resolution v Seedance panelu:
```
💡 Dialogue: wrap spoken lines in "double quotes" for lip-synced audio
💡 Multi-shot: Shot 1: / Shot 2: syntax for camera cuts in one clip
```

Schema fal explicitně zmiňuje oba pattern, GIS UI to neukazovalo. Zero riziko.

**R2V desc upgrade**:
- Před: `R2V · 9 imgs + 3 videos + 3 audio · Multi-modal · $0.30/s`
- Po: `R2V · 9 imgs + 3 videos + 3 audio · 1080p · Video edit/extend (video refs 0.6×)`

### Schema změna VIDEO_MODELS

Z `resolution: '720p'` (string) na `resolutions: [array]`. Zatím pouze Seedance 2.0. Session 2 tenhle pattern rozšíří systematicky.

### Důsledky

- **Spending tracker accuracy**: Seedance spending teď odpovídá reálné fal faktuře (dříve R2V std s video refs nadhodnoceno 40 %, Fast R2V bug −25 %)
- **User expense visibility**: 1080p je 2.24× dražší než 720p — rozdíl $0.377/s
- **Build system beze změny** — modul count zůstává 24

---

## Video.js split — Session 1 ze 2 (21. 4. 2026, v203en)

**Kontext:** Po v202en byl `video.js` 5907 řádků. Kombinace (1) rostoucí komplexity, (2) Session 2 plánu na unified video panel, (3) dev ergonomie → rozdělit na logické submoduly.

**Rozhodnutí:** Split na 6 submodulů. Čistě mechanický, bez funkční změny.

### Zvažované varianty

| Varianta | Plus | Minus |
|---|---|---|
| A) **Split s line-range mapping + verifikační skript** | Přesné, auditovatelné; žádná funkční změna | Jednorázová práce |
| B) Inline re-work při Session 2 | Jedna session | Velký risk — miss dependencies |
| C) ES6 import/export migrace | Čistší boundaries | Mimo Petrovo pattern; throw-away před Tauri |

**Rozhodnutí: A.** Multiset compare, regression-free záruka.

### Module boundaries

- **Model-switch UI** → `video-models.js`
- **`_saveVideoResult` + `_falVideoSubmitPollDownload`** → `video-queue.js`
- **Magnific Video upscale** → `video-topaz.js`
- **`useVideoFromGallery`** → `video-gallery.js`
- **`topazSrcVideoId` state** → `video-topaz.js`

Build order: `utils → models → queue → gallery → topaz → archive`

### Verification
- Line coverage 5907/5907 ✓
- Multiset compare joined == original ✓
- Syntax `node --check` každý modul + concatenated ✓
- Mock prod build SUCCESS ✓

---

## Gallery upload — progress + fingerprint dedup (20. 4. 2026, Session 3)

**Problém 1 (progress):** `uploadImagesToGallery` neměla progress overlay.
**Problém 2 (dedup):** Gallery upload nedetekoval duplikáty, ale assets ano.

### Zvažované varianty dedup

| Varianta | Plus | Minus |
|---|---|---|
| A) **Fingerprint system stejný jako assets** | Konzistentní; efficient | Vyžaduje migraci |
| B) Per-upload scan všech images | Žádná schema změna | O(N×M) blow-up |
| C) Filename + size hash | Levné | Ne-spolehlivé |

**Rozhodnutí: A.** Sdílení `assetFingerprint()` z `assets.js`.

### Sjednocená architektura

| Místo | Dedup metoda |
|---|---|
| Assets upload | `findAssetByFingerprint` (assets_meta) |
| Gallery archive import | `existingIds.has(img.id)` (ID match) |
| Gallery upload | `findImageByFingerprint` (images_meta) |

---

## Dev server — fixní port 7800 (20. 4. 2026)

**Problém:** Port range 7800–7810. Když byl 7800 obsazený, server spustil na 7801 → změnil origin → IndexedDB per-origin → user přišel o přístup ke knihovně.

**Rozhodnutí:** Port fixní 7800. Při obsazenosti server padne s instrukcemi (Windows: `netstat`, macOS: `lsof`). Lepší blokovat start než tiše "ztratit" knihovnu.

---

## Video thumbnail fix — Session 2.1 (20. 4. 2026)

**Problém:** Po importu archivu clapperboard placeholdery. `video_thumbs` store prázdný.

**Rozhodnutí:** Include thumbs v archivu + fallback regeneration. Per-video `dbGet('video_thumbs')` → `thumbData` v archive entry. `_regenerateThumbsInBackground` non-modal indikátor. `regenerateMissingVideoThumbs()` F12 utility.

---

## Progress counter pro bulk delete (20. 4. 2026)

Centered modal overlay: červený nadpis `✕ Deleting`, large counter v Syne fontu, update každých 3–5 itemů + `setTimeout(0)` yield. Threshold: 10+ obrázků, 5+ videí, 10+ assetů.

---

## Streaming + chunked archive export (20. 4. 2026)

**Problém:** `exportGallery()` padal při >320 obrázcích (OOM). V8 softlimit ~512 MB.

### Zvažované varianty

| Varianta | Plus | Minus |
|---|---|---|
| A) **Streaming write** (FileSystemWritableFileStream) | Memory peak ~1 item | Vyžaduje FS API |
| B) **Chunked archive** (auto-split) | Funguje na file:// | Víc souborů |
| C) ZIP formát | Menší | Throw-away před Tauri |

**Rozhodnutí: A+B kombinovaně.** Session 1 streaming, Session 2 chunked multi-file.

Thresholds: Gallery >100 obrázků, Video >5 videí.

---

## Dev server — lokální HTTP mode (20. 4. 2026)

**Problém:** Single-file HTML build 26 354 řádků — dev ergonomie zhoršena.

### Zvažované varianty

| Varianta | Plus | Minus |
|---|---|---|
| A) Satelitní HTML na file:// | Žádná změna distribuce | IDB origin isolation |
| B) **Lokální HTTP server** | Pravá modularita, sdílená IDB | Vyžaduje server |
| C) Tauri migrace | Vyřeší vše najednou | 3–4 sessions Rust |

**Rozhodnutí: B.** `build.js --dev` flag, mini HTTP server na Node built-ins.

---

## HTML Build Validation (14. 4. 2026)

**Problém:** Orphan `</div>` tag rozbil layout bez chyby.

**Rozhodnutí:** Auto div balance validace v `build.js`. `✓ HTML div balance: OK (N pairs)` nebo `⚠ WARNING`.

---

## Imagen 4 REST API — sampleImageSize (15. 4. 2026)

**Root cause:** REST API `:predict` endpoint používá **Vertex AI naming**: `sampleImageSize`, ne `imageSize` (SDK name).

**Lessons:**
- Google API REST → hledat Vertex AI doc
- `imageSize` (SDK) = `sampleImageSize` (REST)
- `numberOfImages` (SDK) = `sampleCount` (REST)

---

## Unified Image Panel (14. 4. 2026)

**Rozhodnutí:** Jeden generický panel (`upParams`) s 14 prvky. Každý model deklaruje UI flags. `selectModel()` show/hide podle flagů.

**Scope:** Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok.
**Legacy:** Luma Photon, Mystic, Freepik Edit.

Výsledek: template.html −330 ř, model-select.js −85 ř.

---

## Dlouhodobé principy (kodifikovaná pravidla)

### Ne-dotknutelnost modelů a endpointů
NIKDY neodstraňovat bez explicitního souhlasu.

### Výzkum před integrací
Web_search, probe endpoints, check regionální dostupnost.

### REST vs SDK naming
Google API REST: Vertex AI naming. SDK: SDK naming.

### Worker free tier
30 s wall-clock limit. Nikdy nepollovat v Workeru.

### Snap count v addToQueue
Každý model má svůj count field. Rerun force=1 (od v202en).

### Ref prefix
ODSTRANĚN v v200en.

### Listing operations = meta only
Plná data jen single-item akce.

### Grid/Flex nesting gotcha (v202en)
`.gal-grid` MUSÍ být normal block child, ne flex item.

### Paint engine invariant
`history[0]` = čistý originál, nikdy přepsán.

### `/mnt/project/` je VŽDY stale
Infrastructure problém Anthropicu.

### Video subsystem (od v203en)
6 submodulů. Build order kritický: utils → models → queue → gallery → topaz → archive.

### Seedance 2.0 pricing (od v204en)
Per-resolution × tier × R2V-multiplier spending keys. Fast nemá 1080p. Token formula `(h×w×24)/1024 × rate/1000` je source of truth.

### fal endpoint format (od v195en)
Seedance 2.0 BEZ `fal-ai/` prefixu: `bytedance/seedance-2.0/text-to-video`. Ostatní fal modely mají `fal-ai/` prefix.
