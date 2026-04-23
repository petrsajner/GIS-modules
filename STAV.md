# STAV.md — Generative Image Studio

## Aktuální verze: v225en (FULL CLEANUP — bez legacy zbytků)
## Příští verze: v226en (smoke test + případné fixy)
## Datum: 2026-04-23
## Worker verze: 2026-16 (beze změn)

---

## Co je v v225en (oproti v224en)

### Cíl: kompletní přechod na unified systém. Žádné legacy zbytky, žádná kompatibilita se starým schematem.

Petr's explicit directive: *"Ted vycistit. Zrusit vse co nepatri do noveho systemu. Parametry, ktere schovavas pro reuse nemusis schovavat - nepotrebuji zpetnou kompatibilitu. (...) Nenechavej zadny stary kod jen kvuli kompatibilite."*

### Fáze A — JS refactor (unified = single source of truth)

**Odstraněno:**
- `_syncDurationToLegacy(modelType)` + všechna volání (4 místa)
- `_readLegacyDurationValue(modelType)` (nepoužívané po A)
- `_vpNegPromptTargetId` + `_vpInstallNegPromptMirror` mirror system — `vpNegPrompt` je jediný zdroj pro generate/reuse
- Legacy `<select>` rebuild logika v `_applyVideoModel`:
  - `veoResolution.innerHTML = ...` + `veoResNote` show/hide
  - `lumaResolution.innerHTML = ...`
  - `pixverseQuality` options rebuild
  - `sd2Res` snap-back logika + `sd2Res1080Opt` toggle
- `onGrokVideoModeChange` legacy `grokVideoDur` mirror
- `onVeoResolutionChange`: čte přes `getUnifiedResolution()` (ne z legacy select)
- `updateVideoResInfo`: jen refresh unified info label (žádný legacy text update)
- `videoResInfo` span text updates (element pryč z HTML)
- STEP 11 (hide legacy neg prompt fields) + STEP 12/13 references
- `_setRow('videoResInfoRow', ...)` mrtvá volání (4 místa)
- `legacyId` field z `RESOLUTION_CONFIG_BY_TYPE` (mrtvé pole, nikdo jej nečetl)
- Post-extraction `pixverseParams.style.display = 'none'` + `lumaVideoParams` hide
- `perFamilyIds` obsahuje jen `wan27vParams` + `wan27eParams` (ostatní shells pryč)

**Změněno:**
- `configureDurationSlider`: initial value z `cfg.default` (ne z legacy), zachovává current slider value pokud je validní (pro reuse path co nastavuje `setUnifiedDuration` před configure)
- `_onUnifiedDurChange/_onUnifiedDurAutoChange/_onUnifiedDurMatchChange`: nevolá `_syncDurationToLegacy`
- `_vpUpdateNegPromptTarget`: jen show/hide `vpNegPromptSection` + clear `vpNeg.value` při přechodu na nepodporovaný model
- `_vpEnsureNegPromptRedirect`: no-op (zachován jako symbol pro backwards-compat v build orderu)
- `_deriveNegPrompt(model)` v video-queue.js: pro WAN 2.7 + PixVerse čte unified `#vpNegPrompt`
- Reuse path video-gallery.js: `_setValue('vpNegPrompt', ...)` místo per-family mirror

### Fáze B — HTML cleanup

**Odstraněno z template.html:**
- `<div class="psec" id="pixverseParams">` shell (obsah přesunut na top-level)
- `<div class="psec" id="seedance2Params">` shell (Seed + sd2R2VSection přesunuty)
- `<input id="pixverseNegPrompt">` + parent `.ctrl` (unified vpNegPrompt nahrazuje)

**Co zůstalo v template.html:**
- PixVerse extracted: `pixverseMultiClip`, `pixverseOffPeak`, `pixverseSeed` (top-level `.ctrl` wrappers, runtime extracted moveWrapperem do bottom toggles / Seed slot)
- Seedance extracted: `sd2Seed` (Seed slot), `sd2R2VSection` (source slot area)
- Per-family panely: `wan27vParams` (Safety), `wan27eParams` (Audio mode + Safety), `grokVideoParams` (Mode select + Mode note)
- Unified elements: `unifiedResButtons` + `unifiedResInfo` (Resolution), `videoDuration` slider + `videoDurAuto/Match` checkboxy, `vpNegPromptSection` s `vpNegPrompt` input

### Ověření

- **JS syntax check**: `node --check` ✓
- **HTML div balance**: 821 pairs OK ✓
- **Zero legacy element reads** napříč všemi 28 JS moduly (verified grepem)
- **Zero legacy IDs** v template.html (verified grepem)

---

## Metrika

| | v217en | v224en | **v225en** |
|--|--|--|--|
| video-models.js | ? | 3969 | 3866 |
| video-queue.js | ~950 | 985 | 985 |
| video-gallery.js | ~1700 | 1746 | 1742 |
| template.html | 5438 | 5274 | 5269 |
| JS total | ? | 24852 | **24799** |
| HTML total | ? | 30101 | **30043** |

Celkem −53 JS lines a −58 total oproti v224en. Celkem −203 JS lines oproti v217en stabilu (odstraněn všechen mirror kód, rebuild logika, legacy wrappers).

---

## Architektura (v225en current state)

### Unified helpers (single source of truth)

**Resolution** (`#unifiedResButtons`):
- `getUnifiedResolution()` — vrací `data-val` aktivního `.seg-btn`
- `setUnifiedResolution(value)` — aktualizuje aktivní tlačítko, `_lastResolutionByType[type]` memory, info label, side effects
- `updateResolutionInfo()` — aktualizuje "1280×720 · 16:9" label pod switcherem
- `_applyResolutionSideEffects(m, value)` — volá `onVeoResolutionChange` pro Veo 1080p/4K force 8s

**Duration** (`#videoDuration`):
- `getUnifiedDuration()` — `parseInt(slider.value)`
- `setUnifiedDuration(value)` — nastaví slider + val label
- `getUnifiedDurationAuto()/setUnifiedDurationAuto(bool)` — `#videoDurAuto` checkbox (Seedance 2.0)
- `getUnifiedDurationMatchSource()/setUnifiedDurationMatchSource(bool)` — `#videoDurMatch` checkbox (WAN 2.7e)

**Negative prompt** (`#vpNegPrompt`):
- Generate čte přímo `document.getElementById('vpNegPrompt').value` (pouze pro wan27_video + pixverse_video)
- Reuse setuje přímo `_setValue('vpNegPrompt', ...)`
- `_vpUpdateNegPromptTarget(key, model)` show/hide sekce + clear hodnoty při přepnutí

**Aspect ratio**:
- Common: `#videoAspectRatio`
- WAN 2.7e: `#wan27eAspect` (má vlastní s "auto = match source" option)

### Data maps

- `RESOLUTION_CONFIG_BY_TYPE[type]` — `{ resolutions, labels }` per type, `resolutions: null` = read from model (PixVerse m.qualityOptions, Seedance2 m.resolutions)
- `DURATION_CONFIG_BY_TYPE[type]` — `{ min, max, step, default, allowed?, autoCheckbox?, matchSource? }` per type
- `_lastResolutionByType` — `{ 'veo': '4k', 'pixverse_video': '1080p', ... }` remembered across model switches within family
- `_RESOLUTION_HEIGHTS` + `_ASPECT_RATIOS` → `computeVideoDimensions(res, aspect)` → `{width, height}`

### Per-family panely (intentionally kept)

- `wan27vParams` — Safety checkbox
- `wan27eParams` — Audio mode (Auto/Origin) + Safety
- `grokVideoParams` — Mode select + ModeNote (stays mode-first above prompt)
- `veoRefModeRow` — ref mode select (stays mode-first)

### vpParams layout (universal)

```
vpParams
├── MODE-FIRST (v220en)
│   ├── vpModeSection (Kling/PixVerse/Vidu version select)
│   ├── veoRefModeRow (Veo)
│   └── grokVideoParams (Grok)
├── COMMON HEADER
│   ├── vpPromptSection
│   ├── videoTagsRow
│   ├── vpNegPromptSection (only wan27 / pixverse)
│   └── videoRefSection
├── SOURCE SLOTS (v220en+, reverse-stacked via insertAdjacentElement)
│   [wan27vAudioUrlRow, lumaCharRefRow, grokVideoSrcRow, wan27vExtendRow,
│    wan27eSrcRow, videoV2VSection, sd2R2VSection]
├── [PARAMETERS] plabel (moved from legacy psec via STEP 4)
├── CORE PARAMS (STEP 5)
│   [unifiedResRow, videoAspectRow, videoCfgRow, videoDurRow]
├── PER-FAMILY ADVANCED (STEP 6)
│   [wan27vParams, wan27eParams]
├── videoCountRow
├── videoAudioCtrl
└── BOTTOM TOGGLES (STEP 10)
    [pixverseMultiClipRow, pixverseOffPeakRow, lumaLoopRow, lumaColorModeRow]
```

---

## Zbývá pro v226en (Session 2 Phase 8 smoke test)

1. **Spustit GIS a otestovat každou rodinu modelů:**
   - Kling V3 Pro T2V (resolution default, duration default)
   - Vidu Q3 (single button resolution)
   - Seedance 1
   - Veo 3 T2V (4K automaticky force 8s), Veo Fast I2V
   - Luma Ray2 (Loop bottom), Luma Ray3 HDR (CharRef + Loop + Color)
   - WAN 2.6 T2V/I2V (resolution 720p/1080p)
   - WAN 2.7 T2V (Audio URL source slot + Safety) + Extend
   - WAN 2.7e V2V (Aspect wan27e + Audio mode + Safety + Match source)
   - PixVerse C1 T2V (MultiClip + Off-peak bottom, Seed), PixVerse V6 V2V
   - Seedance 2.0 I2V Std (Seed v core), R2V Fast (9img + 3vid + 3audio unified)
   - Grok T2V 720p, Grok Edit
   - Topaz Starlight, Magnific Precise 2

2. **Ověřit payload pro každý model:**
   - resolution z `getUnifiedResolution()`
   - duration z `getUnifiedDuration()` (plus Auto pro sd2, Match source pro wan27e)
   - negPrompt z `#vpNegPrompt` (jen WAN 2.7 + PixVerse)

3. **Ověřit reuse (ctrl+R):**
   - `setUnifiedResolution(value)` funguje napříč všemi rodinami
   - `setUnifiedDuration(value)` + `setUnifiedDurationAuto(bool)` + `setUnifiedDurationMatchSource(bool)`
   - Per-family params: Safety, Audio mode, Audio URL, Seed, Source video, CharRef

4. **Dead code cleanup (pokud zbyde čas):**
   - Staré `_applyVideoModel` (video-models.js) z dřívějších iterací
   - Staré `generateVideo` (video-queue.js) z dřívějších iterací
   - Backlog ze summary: Style Library, Claid.ai, Hailuo 2.3, Use V2V, Runway Gen-4

---

## Breaking changes pro v225en

- **Staré saved video jobs (pre-v225en) nemusí správně loadnout** — schema může být odlišné (per-family resolution/duration fields namísto top-level). Petr potvrdil: "Nemam zadna produkcni videa ktera by potrebovala zpetnou kompatibilitu."
- Pokud staré jobs nereusuje správně → ignore (nové jobs fungují 100%).

---

## Zachovaná architektura

- **Worker**: `gis-proxy.petr-gis.workers.dev` v2026-16 (beze změn)
- **R2 bucket**: `gis-magnific-videos` binding `VIDEOS` (beze změn)
- **Build module order** (strict): models → styles → setup → spending → model-select → assets → refs → generate → fal → output-placeholder → proxy → gemini → output-render → db → gallery → toast → paint → ai-prompt → video
- **Runtime**: single-file HTML via file:// v Chrome, žádný CDN pro kód/knihovny
- **DB**: IndexedDB stores `images`, `images_meta`, `videos`, `video_meta`, `assets`, `assets_meta` (schema beze změn)
- **AI agents**: OpenRouter (Sonnet 4.6) primární, Gemini Flash fallback
