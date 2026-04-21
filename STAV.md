# STAV.md — Generative Image Studio

## Aktuální verze: v204en
## Příští verze: v205en
## Datum: 2026-04-21
## Worker verze: 2026-16 (beze změny)

---

## Co je v v204en (oproti v203en)

### Seedance 2.0 — 1080p support + pricing refactor + bonusy

Fal.ai přidal 21. 4. 2026 v 1:06 AM (Discord announcement + playground dropdown) rozlišení **1080p** pro Seedance 2.0 na 3 standard endpointech (T2V / I2V / R2V). Fast varianty 1080p zatím nepodporují.

#### Změny

**1. Přidáno 1080p pro standard endpointy** (3 modely)
- `seedance2_t2v`, `seedance2_i2v`, `seedance2_r2v`: nové pole `resolutions: ['480p', '720p', '1080p']`
- `seedance2f_*` (3 fast varianty): `resolutions: ['480p', '720p']` — 1080p Fast zatím není
- Schema změna: `resolution: '720p'` (string) → `resolutions: [...]` (array)

**2. UI — template.html**
- Resolution radio rozšířen o 1080p variantu s wrapperem `sd2Res1080Wrap` (toggle-able)
- `_applyVideoModel` pro Seedance: `has1080p = m.resolutions.includes('1080p')` → `style.display` na wrapper
- Fallback: když user přepne na Fast model se zvoleným 1080p → automatický reset na 720p
- Přidán prompt hint box pod Resolution: `💡 Dialogue: "double quotes" for lip-sync` + `💡 Multi-shot: Shot 1: / Shot 2: syntax`

**3. Pricing architektura — spending.js**

Matematicky přesný pricing odvozený z fal token formule:
```
tokens_per_second = (height × width × 24) / 1024
standard_rate = $0.014 / 1000 tokens
fast_rate     = $0.0112 / 1000 tokens
```

Validace: 720p 16:9 × standard = 21600 tokens × $0.014/1k = **$0.3024/s** ≈ publikovaných $0.3034/s ✓
Validace: 720p 16:9 × fast = 21600 × $0.0112/1k = **$0.2419/s** = exact match ✓

Nové spend keys (nahrazují původní 3):
```
'_seedance2_std_480p':      0.1405
'_seedance2_std_720p':      0.3034
'_seedance2_std_1080p':     0.6804  ← nové
'_seedance2_fast_480p':     0.1124
'_seedance2_fast_720p':     0.2419
'_seedance2_r2v_std_480p':  0.0843  ← R2V s video refs (0.6× multiplier)
'_seedance2_r2v_std_720p':  0.1820
'_seedance2_r2v_std_1080p': 0.4082
'_seedance2_r2v_fast_480p': 0.0674
'_seedance2_r2v_fast_720p': 0.1452  ← bylo 0.181 (bug; published fal value je $0.14515)
```

**4. Pricing routing — video-models.js `callSeedance2Video`**

```javascript
const isFast     = endpoint.includes('/fast/');
const hasVidRefs = isR2V && (sd2Snap?.vidSrcIds || []).some(Boolean);
const tier       = isFast ? 'fast' : 'std';
const prefix     = hasVidRefs ? '_seedance2_r2v_' : '_seedance2_';
const priceKey   = `${prefix}${tier}_${resolution}`;
```

Jednotný pattern pro všechny kombinace std/fast × 480p/720p/1080p × with-video-refs / without.

**5. Bonus: R2V video-refs multiplier detection**

Historicky GIS netrackoval 0.6× multiplier pro R2V s video inputs — user platil fal reálně méně než GIS spending tracker ukazoval. Nyní detekce `hasVidRefs` explicitně routuje na správný price key.

**6. Bonus: oprava starého bugu v `_seedance2_r2v_fast`**

Původní hodnota `0.181` (v v195en při Seedance 2.0 integraci) byla chybná. Podle fal dokumentace `/fast/reference-to-video` s video inputs: *"With video inputs and 720p resolution the price is $0.14515 per second."* Opraveno na `0.1452`.

**7. Bonus: R2V desc upgrade**

```
Před: R2V · 9 imgs + 3 videos + 3 audio · Multi-modal · $0.30/s
Po:   R2V · 9 imgs + 3 videos + 3 audio · 1080p · Video edit/extend (video refs 0.6×)
```

### Změněné moduly (v204en)

| Modul | Řádků | Popis změn |
|---|---:|---|
| `video-models.js` | 2443 | 6 Seedance entries + `callSeedance2Video` pricing logic + `_applyVideoModel` 1080p toggle (+20 ř) |
| `spending.js` | 233 | 3 staré keys → 10 nových + oprava fast R2V bug (+13 ř) |
| `template.html` | 5068 | 1080p radio + wrapper + lip-sync hint box (+10 ř) |
| `video-queue.js` | 807 | beze změny (sd2Snap.resolution už čten správně) |

### Expected prod build size

Baseline v203en: ~27 226 řádků. Delta ~+45 ř.
**Očekávaný v204en prod build: ~27 271 řádků** — v toleranci ±50 ✓

### Test plan po deploy

- [ ] Resolution radio ukazuje 3 volby pro standard modely, 2 pro fast
- [ ] Přepnutí T2V std (s vybraným 1080p) → T2V Fast → 1080p wrapper se skryje, selected value padne na 720p
- [ ] Generate 5s 1080p T2V → spending tracker přičte $3.40 (5s × $0.6804)
- [ ] Generate 5s 720p Fast R2V s video ref → $0.726 (5s × $0.1452)
- [ ] Prompt hint box je viditelný pod Resolution, pouze pro Seedance modely

---

## Co bylo v v203en (oproti v202en)

### Video.js split (Session 1 ze 2 pro video panel unification)

Rozdělení monolitu `video.js` (5907 řádků) na 6 submodulů. Žádná funkční změna.

| Submodul | Source řádků | Obsah |
|---|---:|---|
| `video-utils.js`   |  180 | Pure helpers |
| `video-models.js`  | 2419 | `VIDEO_MODELS`, handlery, model UI switching |
| `video-queue.js`   |  804 | `videoJobs`, `_saveVideoResult`, `generateVideo`, queue render |
| `video-gallery.js` | 1544 | Gallery UI, refs, source slots, lightbox, mention, rubber-band |
| `video-topaz.js`   |  405 | Topaz + Magnific upscale |
| `video-archive.js` |  555 | Export/import + thumb regen |

Build order: `utils → models → queue → gallery → topaz → archive`. 100% line coverage verified.

---

## Co bylo v v202en (oproti v201en)

### 1. Queue + Rerun bugy
- **RETRY_MAX crash fix**, **Cancel for running jobs**, **Rerun spawnul N karet**, **Reuse z gallery nenastavil params**

### 2. Download overhaul (zero CDN, file:// friendly)
- Prefs store v IDB, inline ZIP writer (~80 ř), progress overlay helpery, protocol detection → `a.click()` fallback

### 3. UI unifikace 3 knihoven (Gallery / Video / Assets)
- Společné CSS: `.lib-toolbar`, `.lib-bulk`, `.lib-right`
- Unified bulk bar: `[Move] [type-specific] [Download]  [Cancel] [Delete]` (Delete vpravo červené)
- Video library gained Archive + Load archive

### 4. Gallery layout refactor (DVA OKNA pattern)
- `.gal-main` wrapper → `.gal-grid` jako normální block child

### 5. Video library Archive / Load archive
- `exportVideoArchive()` + `importVideoArchive()` s base64 chunked (8 KB)

### 6. Performance audit plných dat
- 5 míst switched na `dbGetAllMeta()`, fingerprint migrace pro legacy

---

## Dev server infrastructure

`build.js --dev` flag pro lokální HTTP server (fixní port 7800, zero dependencies). `start_dev.bat` launcher. Prod build beze změny. Od v203en injectuje 24 modulů.

---

## TODO (prioritní pořadí)

1. **Cleanup session video subsystému** — viz CLEANUP_ANALYSIS.md (Session 3 po v203en), 1–2 hod
2. **Session 2 — Unified video panel** — analogicky k v200en image unified
3. **Style Library "My Presets"**
4. **Claid.ai via proxy**
5. **GPT Image 1.5**
6. **Hailuo 2.3**
7. **Use button for V2V models**
8. **Runway Gen-4 Image + Video**
9. **Recraft V4**
10. **Z-Image LoRA generation + trainer**
11. **Ideogram V3**
12. **Fast tier 1080p pro Seedance 2.0** — až fal doplní

### Dokončené v v204en
- ✅ Seedance 2.0 1080p podpora (3 standard endpointy)
- ✅ Pricing architektura → per-resolution × R2V multiplier
- ✅ Oprava bugu v `_seedance2_r2v_fast` (0.181 → 0.1452)
- ✅ Lip-sync / multi-shot prompt hint v UI
- ✅ R2V desc rozšíření (video edit/extend)

### Dokončené v v203en
- ✅ Video.js split na 6 submodulů

### Dokončené v v202en
- ✅ Queue + Rerun 4 bugy
- ✅ Download overhaul
- ✅ UI unifikace 3 knihoven
- ✅ Gallery layout refactor
- ✅ Video library Archive
- ✅ Performance audit
- ✅ Dev server infrastructure
- ✅ Streaming + chunked archive export
- ✅ Video thumbnail fix v archivaci
- ✅ Gallery upload progress + dedup

### Research ready
- **Runway API**: `gen4_image`, async polling `/v1/tasks/{id}`. CORS block → Worker proxy.
- **Claid.ai**: via proxy + Upload API multipart
- **NB2 reliability**: `serviceTier: "PRIORITY"` + exponential backoff
- **FLUX.2 inpainting**: NE mask-based, jen natural language

---

## Klíčové technické detaily

### Seedance 2.0 pricing (od v204en)

| Endpoint family | 480p | 720p | 1080p |
|---|---:|---:|---:|
| `seedance2_{t2v,i2v,r2v}` standard | $0.141/s | $0.303/s | **$0.680/s** |
| `seedance2_r2v` std (video refs 0.6×) | $0.084/s | $0.182/s | $0.408/s |
| `seedance2f_{t2v,i2v}` fast | $0.112/s | $0.242/s | — |
| `seedance2f_r2v` fast (video refs 0.6×) | $0.067/s | $0.145/s | — |

Token formula (source of truth, 16:9):
```
tokens/s = (width × height × 24) / 1024
cost     = tokens/s × rate × dur
rate_std = $0.014/1k
rate_fast= $0.0112/1k
```

### Unified library toolbars (v202en)
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

### Unified Image Panel (od v200en)
Pokrývá: Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok. Element IDs: `upRes`, `upCount4/10`, `upSteps`, `upGuidance`, `upSeed`, `upNeg`, `upAccel`, `upSafetySlider/Chk`, `upStrength`, `upGrounding`, `upRetry`, `upThinkRadio/Chk`. Helper: `isUnifiedModel(m)`.

### WAN 2.7 Image routing (od v195en)
Přes Segmind (synchronous binary PNG). Size preset strings "1K"/"2K"/"4K" s asterisk notation.

### PixVerse C1 (od v192–v193)
T2V/I2V/Transition/Fusion. 4 VIDEO_MODELS, passthrough Worker. Gotchas: I2V endpoint `/video/img/generate` (ne `/image/`); `multi_clip_switch` API INVERTED; `ref_name` alphanumeric only.

### Inpainting (aktivní modely)
FLUX Pro Fill, FLUX General, FLUX Dev, FLUX Krea. Worker handler: `fal-inpaint.js` (NE `fal.js`).

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
- **AI provideři:** fal.ai, Segmind, Google, Replicate, Luma, Kling, PixVerse, Topaz, Magnific/Freepik, xAI, OpenRouter
- **Build modul order (v204en, 24 modulů)**: models → styles → setup → spending → model-select → assets → refs → generate → fal → output-placeholder → proxy → gemini → output-render → db → gallery → toast → paint → ai-prompt → video-utils → video-models → video-queue → video-gallery → video-topaz → video-archive
- **Dev server**: `node build.js --dev` (port 7800)
- **Proxy deploy** (Windows): `cd C:\Users\Petr\Documents\gis-proxy` → `npm run deploy`
- **Kontakt**: info.genimagestudio@gmail.com
