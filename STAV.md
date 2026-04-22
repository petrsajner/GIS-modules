# STAV.md — Generative Image Studio

## Aktuální verze: v205en
## Příští verze: v206en
## Datum: 2026-04-22
## Worker verze: 2026-16 (beze změny)

---

## Co je v v205en (oproti v204en)

### GPT Image 1.5 & 2 — OpenAI image rodina přes fal.ai

Fal.ai 21. 4. 2026 spustil `openai/gpt-image-2` + `/edit` endpointy (den po OpenAI release). GIS integruje kompletní rodinu: 4 nové modely (T2I + Edit × 2 generace). Modely sedí v normálním Generate flow (ne v inpaint modulu), mask se řeší přes existující annotation layer z paint toolu.

#### Změny

**1. Nový modul `gpt-edit.js`** (~380 řádků) — pozice v MODULES: hned po `fal.js`

Obsah:
- `callGptImage()` — main caller, kompatibilní signature s ostatními fal callery
- `_gpt2SizeFromAspect()` — vypočítá `{width, height}` honorující OpenAI constraints (násobky 16, max 3840px, 655k–8.29M pixelů, AR ≤ 3:1)
- `_gpt15SizeFromAspect()` — snap na 3 fixed sizes (1024², 1024×1536, 1536×1024)
- `_annotAssetToGptMask()` — konverze annotation asset (white bg + color strokes) → RGBA PNG s alpha=0 na painted pixelech (edit region) a alpha=255 na unpainted (keep)
- `_resizeGptMaskToMatch()` — nearest-neighbor resize masky na dimenzi target imageu
- `_partitionGptRefs()` — split refs podle `ref.role === 'mask'` na image refs + mask
- `_falStreamEdit()` — SSE stream handler (code retained pro budoucnost; aktuálně vypnuto)
- `_pickGptPriceKey()` — routing na 29 price keys dle model/quality/size/resolution
- Dual mask field handling: `mask_url` (GPT 2) vs `mask_image_url` (GPT 1.5)

**2. 4 nové modely v `models.js`** (pozice: hned pod `i4ultra`)

| Key | Endpoint | Refs | Quality tier | Resolutions |
|---|---|---|---|---|
| `gptimg2_t2i` | `openai/gpt-image-2` | — | low/med/high | 1K, 2K, 4K |
| `gptimg2_edit` | `openai/gpt-image-2/edit` | 1–8 | low/med/high | 1K, 2K, 4K |
| `gptimg15_t2i` | `fal-ai/gpt-image-1.5` | — | low/med/high | 1K |
| `gptimg15_edit` | `fal-ai/gpt-image-1.5/edit` | 1–8 | low/med/high | 1K |

Model UI flags: `upRes` (s custom dims), `upCount4` (1–4), **`upQuality`** (nový unified flag). `'gpt'` přidán do `_UNIFIED_TYPES`.

**3. Unified panel — nový flag `upQuality`**

Template.html: nový `#upQualityRow` s `.toggle-row` patternem (stejné stylování jako Resolution), 3 zlaté buttony Low / Medium / High, default Medium, pozice přímo nad Generate. Reusable — budoucí modely s quality tiers (FLUX.2-flex apod) dostanou zdarma.

**4. Maska přes annotation layer (workflow B)**

- User otevře paint na obrázku → anotace barevnými tahy → Export mode B → 2 assety do refs (orig + annotation)
- Druhý ref **automaticky dostane `role: 'mask'`** (paint.js)
- Thumbnail s mask role má růžový 🎭 MASK badge (refs.js + CSS)
- Hover nad thumbnailem (při aktivním GPT Edit modelu) zobrazí tlumený 🎭 → klik flipne roli manuálně (`toggleRefMaskRole`)
- Při Generate: ref s `role='mask'` se konvertuje přes `_annotAssetToGptMask()` a pošle jako `mask_url`/`mask_image_url`

**5. 1K = custom dims (ne preset enum)**

Původně jsem poslal preset `landscape_16_9` — fal vrací ~1088×608, **příliš malé pro produkci**. Přepsáno: 1K tier posílá `{width: 1536, height: calc}` jako custom dims, stejný mechanismus jako 2K/4K. Long side: 1K=1536, 2K=2048, 4K=3840. Vše s area cap 8.29M a min floor 655k pro extrémní AR. `updateUnifiedResInfo` (info text vpravo) používá totožný výpočet → co uživatel vidí = co model dostane.

**6. Pricing — 29 price keys ve spending.js**

GPT 2 per-quality × per-size (9) + tier-based 2K/4K (6) = 15 keys. GPT 1.5 per-quality × per-size (8). Low tier má collapsed key pro non-square GPT 1.5. `priceKey` atribut v result objektu → `trackSpend('fal', priceKey)` v runJob.

**7. Streaming — VYPNUTO (code ready)**

fal `/stream` endpoint aktuálně (duben 2026) pro GPT 1.5 i 2 edit **posílá jen 1 event s final data URI** (~3MB base64), žádné progressive frames. Stream = queue s víc komplexity, žádný reálný benefit. `streaming: false` na obou edit modelech → jedou přes `_falQueue` (stejně jako FLUX/SeeDream/atd).

Stream code (`_falStreamEdit`, `updatePlaceholderPartial`) zachován pro budoucnost — jakmile fal přidá progressive diffusion preview, flip `streaming: true`.

**8. UI detaily opravené během session**

- Quality selektor přepracován z hnusného `.chk-row` na `.toggle-row` pattern (3 zlaté buttony, stejný vzhled jako Resolution)
- Dropdown `#modelSelect` v template.html rozšířen o 4 nové `<option>` entry (hardcoded!) — gotcha potvrzena z memory
- "Max 2048px" hláška pro ref input skryta pro `m.type === 'gpt'` (GPT modely nemají velikostní limit, `_gptEditGetRefB64()` čte raw imageData bez volání `_refAsJpeg`)
- Resolution info text vpravo (yellow) pro GPT 2: exact `W×H` z aspect + tier, pro GPT 1.5: snap na 3 fixed sizes
- `updatePlaceholderPartial` přesunutý z `cardEl` do `.ph-body` (mělo overflow do `#center` = fullscreen bug)
- Output render/save podpora `result.type === 'gpt'` v `output-placeholder.js`, `db.js`, `gallery.js`

#### Build stats
- 27 972 řádků (JS 22 949 + HTML/CSS 5 074)
- 25 modulů (24 → 25 kvůli `gpt-edit.js`)
- HTML div balance OK (778 pairs)

---

## Otevřené TODO

**Prioritní:**

1. **Cleanup session video subsystému** (1–2 hodiny) — po splitu v203en. Viz `CLEANUP_ANALYSIS.md`.
2. **Session 2 — Unified video panel** (analogie v200en) — 13 video modelů má legacy HTML bloky.
3. **Style Library "My Presets"** — persisted user-defined style combos.
4. **Claid.ai integrace** — research + implementace.
5. **Hailuo 2.3** — upgrade z 2.0.
6. **Use V2V** — Seedance 2.0 R2V endpoint.
7. **Runway Gen-4** — research only zatím (CORS nejistý).

**Research-only (bez implementace):**

- Runway API rodina: `gen4_image`, `gen4_aleph`, `gen4_turbo`, `gen4.5`, `veo3/3.1`. CORS pravděpodobně blokuje browser calls → Worker proxy nutný.

**Monitorovat:**

- **GPT Image 2 stream progressive** — fal momentálně posílá jen final event. Jakmile zapnou progressive diffusion preview, flip `streaming: true` v `models.js` (code v `gpt-edit.js` už to handluje).
- **GPT Image 2 performance** — v den release byl občas overloaded. P50 medium = 3 s per obrázek dle fal blog. Pokud timeouty přetrvají týdny, přidat shortcut "skip queue, use sync endpoint".

---

## Zafixované bugy (v205en)

- **Dropdown v template.html je hardcoded** — při přidávání modelu musí se editovat 2 místa (models.js entry + `<option>` v template.html). Tato gotcha je zdokumentovaná v memory, ale v této session jsem na ni spadl při prvním buildu. Napraveno druhým buildem.
- **CSS absolute positioning escape** — `position:absolute; inset:0` v `.img-card` (který nemá `position:relative`) → overflow přes celý `#center` wrapper. Fix: injection do `.ph-body` (ta má `position:relative + aspect-ratio:16/9`).
- **Preset enum vs production quality** — fal `landscape_16_9` preset generuje ~1088×608, příliš malé. Fix: custom dims pro všechny tiers (1K/2K/4K).
- **Streaming SSE žádný progressive** — diagnóza z console logu ukázala, že fal posílá jen 1 event s finálním data URI pro oba modely. Fix: vypnout streaming, použít queue.

---

## Architektonické kontexty

### Build module order (v205en, 25 modulů)
```
models → styles → setup → spending → model-select → assets → refs
→ generate → fal → gpt-edit → output-placeholder → proxy → gemini
→ output-render → db → gallery → toast → paint → ai-prompt
→ video-utils → video-models → video-queue → video-gallery → video-topaz → video-archive
```

### Gallery layout — "two windows" pattern
Wrapper (flex column) → `.lib-toolbar` (flex-shrink:0) → `.lib-bulk.show` → scroll container (flex:1).

### Paint engine — 3 parallel canvases
```
eng.canvas (display)     = base + strokes composite
eng.history[0]           = clean original (invariant)
_annotateMaskCanvas      = white strokes for inpaint mask
_annotateAnnotCanvas     = color strokes, transparent bg
```

### Z-Image endpoints
| Model | Endpoint |
|---|---|
| `zimage_base` | `fal-ai/z-image/base` |
| `zimage_turbo` | `fal-ai/z-image/turbo` |
| `zimage_turbo_i2i` | `fal-ai/z-image/turbo/image-to-image` |

### GPT Image endpoints (v205en)
| Model | Endpoint | Mask field |
|---|---|---|
| `gptimg2_t2i` | `openai/gpt-image-2` | — |
| `gptimg2_edit` | `openai/gpt-image-2/edit` | `mask_url` |
| `gptimg15_t2i` | `fal-ai/gpt-image-1.5` | — |
| `gptimg15_edit` | `fal-ai/gpt-image-1.5/edit` | `mask_image_url` |

### Unified Image Panel (od v200en, rozšířen v v205en)
Pokrývá: Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok, **GPT** (nové). Element IDs: `upRes`, `upCount4/10`, `upSteps`, `upGuidance`, `upSeed`, `upNeg`, `upAccel`, `upSafetySlider/Chk`, `upStrength`, `upGrounding`, `upRetry`, `upThinkRadio/Chk`, **`upQuality`** (nové). Helper: `isUnifiedModel(m)`.

### WAN 2.7 Image routing (od v195en)
Přes Segmind (synchronous binary PNG). Size preset strings "1K"/"2K"/"4K" s asterisk notation.

### PixVerse C1 (od v192–v193)
T2V/I2V/Transition/Fusion. 4 VIDEO_MODELS, passthrough Worker. Gotchas: I2V endpoint `/video/img/generate` (ne `/image/`); `multi_clip_switch` API INVERTED; `ref_name` alphanumeric only.

### Inpainting (aktivní modely)
FLUX Pro Fill, FLUX General, FLUX Dev, FLUX Krea. Worker handler: `fal-inpaint.js` (NE `fal.js`).

**Pozn:** GPT Image Edit modely mají mask-based inpainting, ale NEJEDOU přes inpaint modul — jdou přes normální Generate flow s annotation layer assetem jako mask ref. Jde o "soft mask global regeneration", ne pixel-exact replacement.

### Performance: meta vs full data (v202en)
Pravidlo: pro listing/thumbnail/lookup operace vždy meta store. Plná data jen single-item akce.

### Video subsystem (od v203en)
6 submodulů. Cross-module calls povolené (globální scope). Build order kritický: utils → models → queue → gallery → topaz → archive.

---

## Pravidla a principy

- **⚠ `/mnt/project/` je VŽDY stale.** Session start: STAV.md z GitHubu → fetch moduly → edit v `/home/claude/src/` → `node build.js NNNen → dist/`
- **Syntax check po buildu**: extract script → `node --input-type=module`. OK = "window is not defined"
- **HTML validation**: `build.js` zobrazuje `✓ HTML div balance: OK (N pairs)`
- **NIKDY neodstraňovat modely/endpointy/funkce bez explicitního souhlasu**
- **⚠ Model dropdown je hardcoded v `template.html`** — při přidávání modelu EDITOVAT 2 MÍSTA: `models.js` entry + `<option>` v `#modelSelect` dropdown v template.html
- **REST API param names**: Vertex AI naming (`sampleImageSize`, `sampleCount`) pro Google REST
- **Worker free tier**: 30 s wall-clock — nikdy nepollovat v Workeru
- **Snap count v `addToQueue`**: každý nový model svůj count field. Rerun force=1 (od v202en)
- **xAI concurrency limit**: max 2 concurrent requesty
- **Ref prefix**: ODSTRANĚN v v200en
- **OpenRouter (Claude Sonnet 4.6)** = PRIMARY agent pro tool features. Gemini Flash jen fallback
- **Paint engine invariant**: `history[0]` = čistý originál, nikdy přepsán
- **Grid/Flex nesting gotcha**: `.gal-grid` (display:grid) MUSÍ být normal block child
- **Listing operace**: vždy meta store. Plná data jen single-item
- **Video subsystem (v203en+)**: cross-module calls OK, build order kritický
- **Seedance 2.0 pricing (v204en+)**: per-resolution keys, R2V video refs 0.6×, Fast nemá 1080p
- **GPT Image (v205en+)**:
  - 1K = custom dims (NE fal preset enum, ten generuje 1088×608)
  - Mask format: RGBA PNG, alpha=0 edit / alpha=255 keep
  - `mask_url` (GPT 2) vs `mask_image_url` (GPT 1.5) — pole se liší
  - Streaming fal zatím nedává progressive frames — queue preferovaný
  - Constraints: multiples of 16, max edge 3840, pixels 655k–8.29M, AR ≤ 3:1
- **CSS absolute positioning**: ALWAYS zkontrolovat že nejbližší `position:relative` předek je ten co má být (image-card NEMÁ, ph-body MÁ)
- **Rozhodnutí nedělat za Petra** — složitější věci prezentovat jako options

---

## Runtime Philosophy

- **Single-file HTML** na file:// v Chrome
- **NO CDN** pro libraries/code (inline). CDN pro UI fonts OK
- **User data vždy lokální** (IndexedDB)
- **No silent operations** — všechny async akce visible progress
- **File System Access API flaky na file://** → `_IS_FILE_PROTOCOL` bypass
- **Tauri migrace později** — až hard limit
- **Petr needituje kód přímo** — vše jako ready-to-deploy files
- **Dev/prod separation**: localhost:7800 prázdná DB, prod file:// žije dál

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Segmind, Google, Replicate, Luma, Kling, PixVerse, Topaz, Magnific/Freepik, xAI, OpenRouter, **OpenAI (přes fal)**
- **Build modul order (v205en, 25 modulů)**: models → styles → setup → spending → model-select → assets → refs → generate → fal → gpt-edit → output-placeholder → proxy → gemini → output-render → db → gallery → toast → paint → ai-prompt → video-utils → video-models → video-queue → video-gallery → video-topaz → video-archive
- **Dev server**: `node build.js --dev` (port 7800)
- **Proxy deploy** (Windows): `cd C:\Users\Petr\Documents\gis-proxy` → `npm run deploy`
- **Kontakt**: info.genimagestudio@gmail.com
