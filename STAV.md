# STAV.md — Generative Image Studio

## Aktuální verze: v229en (F1+F2 — Unified Audio URL + Source Video)
## Příští verze: v230en (cleanup — orphan IDs + wan27eParams migrace)
## Datum: 2026-04-24
## Worker verze: 2026-16 (beze změn)

---

## Co je v v229en (oproti v225en)

### Fáze 1 kompletní — Unified sloty (seed, safety, audio, src video)

Postupné sjednocení napříč 4 verzemi (v226 → v229):
- **v226en:** unified **Seed** (1 input pro 4+ rodin)
- **v227en:** unified **Safety** (1 checkbox pro 2 rodiny)
- **v228en:** Seed cleanup + rozšíření (WAN 2.6, Seedance 1.5, Vidu Q3)
- **v229en:** unified **Audio URL** (3-slot) + unified **Source Video** (1-slot, 4 modely)

Po v229en je v `vpParams` jeden panel pro 4 rodiny source videa (WAN 2.7 Edit, WAN 2.7 I2V
Extend, Grok V2V/Edit/Extend, Kling Motion Control) a jeden panel pro 2 rodiny audio URLs
(WAN 2.7 R2V = 1 slot, Seedance 2.0 R2V = 3 slots). Per-family panely a state vars jsou pryč.

---

## Historie verzí

### v225en (2026-04-23) — FULL CLEANUP (bez legacy zbytků)

Kompletní přechod na unified systém. Žádné legacy zbytky, žádná kompatibilita se starým
schematem. Petr's explicit directive: *"Ted vycistit. Zrusit vse co nepatri do noveho
systemu. (...) Nenechavej zadny stary kod jen kvuli kompatibilite."*

**Fáze A — JS refactor (unified = single source of truth):**

Odstraněno:
- `_syncDurationToLegacy(modelType)` + všechna volání (4 místa)
- `_readLegacyDurationValue(modelType)` (nepoužívané po A)
- `_vpNegPromptTargetId` + `_vpInstallNegPromptMirror` mirror system — `vpNegPrompt` je
  jediný zdroj pro generate/reuse
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

Změněno:
- `configureDurationSlider`: initial value z `cfg.default` (ne z legacy), zachovává
  current slider value pokud je validní (pro reuse path co nastavuje `setUnifiedDuration`
  před configure)
- `_onUnifiedDurChange/_onUnifiedDurAutoChange/_onUnifiedDurMatchChange`: nevolá
  `_syncDurationToLegacy`
- `_vpUpdateNegPromptTarget`: jen show/hide `vpNegPromptSection` + clear `vpNeg.value`
  při přechodu na nepodporovaný model
- `_vpEnsureNegPromptRedirect`: no-op (zachován jako symbol pro backwards-compat v build
  orderu)
- `_deriveNegPrompt(model)` v video-queue.js: pro WAN 2.7 + PixVerse čte unified
  `#vpNegPrompt`
- Reuse path video-gallery.js: `_setValue('vpNegPrompt', ...)` místo per-family mirror

**Fáze B — HTML cleanup:**

Odstraněno z template.html:
- `<div class="psec" id="pixverseParams">` shell (obsah přesunut na top-level)
- `<div class="psec" id="lumaVideoParams">` shell
- `<div class="psec" id="seedance2Params">` shell
- Legacy `<select>` elementy: veoResolution, lumaResolution, wanResolution,
  wan27vResolution, wan27eResolution, pixverseQuality, sd2Res, grokVideoRes
- Legacy duration inputs: lumaDuration radios, wan27vDuration, wan27eDuration,
  sd2Duration, sd2DurAuto, grokVideoDur
- Legacy neg prompt inputs: wan27vNegPrompt, pixverseNegPrompt

**Build v225en:** 24799 JS ř., 30043 total, HTML div balance 821 pairs OK. Syntax OK,
žádné legacy reads napříč 28 moduly (verified grepem).

---

### v226en (2026-04-24) — Unified Seed

- Přidán `#unifiedSeedRow` s `#unifiedSeed` input za `videoDurRow`
- Smazány 4 legacy elementy: `wan27vSeed`, `wan27eSeed`, `pixverseSeed`, `sd2Seed`
- Helpers `getUnifiedSeed()` / `setUnifiedSeed(val)` v video-models.js
- Bug fixy po smoke testu:
  - Seed pozice (STEP 5b `insertAdjacentElement('afterend')` po videoDurRow)
  - Panel shift při přepnutí video modelu (CSS `#vpParams > :not(.psec) { padding:0 14px }`)
  - Toggles pod promptem při prvním otevření video tabu (setGenMode volá `_applyVideoModel`)
  - Black video thumbnail v gallery (timeout 8→15s, 4 seek pokusy, threshold <12)

---

### v227en (2026-04-24) — Unified Safety

- Přidán `#unifiedSafetyRow` s `#unifiedSafety` checkbox (default checked)
- Smazány `wan27vSafety` + `wan27eSafety`
- Helpers `getUnifiedSafety()` / `setUnifiedSafety(val)` (sémantika `!== false`)
- Visibility via `supportsSafety(model)` pure helper v video-utils.js

---

### v228en (2026-04-24) — Seed finální cleanup + rozšíření

**API verifikace (fal.ai docs fetched):**

Seed podporují (aktivní v GIS):
- PixVerse C1/V6 · WAN 2.7 T2V/I2V/R2V/Extend · WAN 2.7 Edit
- Seedance 2.0 Std/Fast · **WAN 2.6 T2V/I2V/R2V Flash (nově)**
- **Seedance 1.5 Pro T2V/I2V (nově)** · **Vidu Q3 T2V/I2V/R2V (nově)**

Seed NEpodporují (skryto, ověřeno):
- Kling (všechny V3/O3/V2.6/V2.5/V2.1/V1.6/Motion Control)
- Luma Ray2/Ray3 (direct Luma REST API) · Veo 3.1 (Gemini direct) · Grok (xAI direct)

**Refactor (cleanup):**
- Duplicitní whitelist v video-models.js `_supportsSeed` → 1 řádek:
  `_setRow('unifiedSeedRow', supportsSeed(model))`
- PixVerse handler čte `params.seed` místo inline `getUnifiedSeed()` (sjednocení
  s wan27/seedance2)
- Generic fal payload volá `_deriveSeed(model)` (single source of truth)
- Top-level `if (params.seed != null) setUnifiedSeed(params.seed)` v reuse path pokrývá
  všechny modely
- `supportsSeed(model)` pure helper v video-utils.js je **jediné** místo whitelist logiky

**Build:** 24847 JS ř. (−56 vs v227en). Dead-code audit: smazáno 56 ř., přidáno 0.

---

### v229en (2026-04-24) — Fáze 1+2 sjednocení (Audio + Source Video)

**Fáze 1 dokončena — Audio URL (3-slot unified):**
- `#unifiedAudioUrlRow` se 3 inputs; per-model slot count via `audioSlots(model)`
- WAN 2.7 R2V → 1 slot (BG audio)
- Seedance 2.0 R2V → 3 slots (audio references)
- Getters/setters: `getUnifiedAudioUrl(idx)` / `setUnifiedAudioUrl(idx, val)`
- Payload derive: `_deriveAudioUrls(model)` → array
- Smazány: `wan27vAudioUrl`, `sd2AudioUrl1/2/3`

**Fáze 2 dokončena — Source Video (1-slot unified):**
- `#unifiedSrcVideoRow` — jeden panel pro všechny 4 modely:
  - WAN 2.7 Edit (required) · WAN 2.7 I2V Extend (optional) ·
    Grok V2V/Edit/Extend (required per mode) · Kling Motion Control (required, +Upload button)
- Per-model label via `sourceVideoLabel(model)`: "Source Video" / "Motion Video" / "Extend Video"
- Upload button visibility via `sourceVideoSupportsUpload(model)` — Kling motion only
- 4 state vars (`wan27vSrcVideoId` + `wan27eSrcVideoId` + `_grokVideoSrcId` +
  `videoMotionFile/VideoId`) → **1** (`unifiedSrcVideoId` + `unifiedSrcVideoFile`)
- 3 slot entries (`VIDEO_SOURCE_SLOTS.wan27v/wan27e/v2v`) → **1** (`unifiedSrc`)
- Smazány handlery: `wan27v/wan27e/v2v*PickFromGallery/ClearSource/DescribeSource/SetSource`,
  `setGrokVideoSrc`, `v2vVideoSelected`, `v2vSetFromGallery`, `clearV2VVideo`, `_v2vSetPanel`
- Smazány DOM rows: `wan27eSrcRow`, `wan27vExtendRow`, `grokVideoSrcRow`, `videoV2VSection`
- Smazán shell: `wan27vParams` (prázdný po odebrání audio + extend)

**Nové pure helpers v video-utils.js (single source of truth):**
- `audioSlots(model)` — 0/1/3
- `supportsSourceVideo(model)` — 4 typy
- `sourceVideoLabel(model)` — UI label per model
- `sourceVideoSupportsUpload(model)` — Kling motion only

**Top-level reuse v video-gallery.js:**
- `if (Array.isArray(params.audioUrls)) for (i<3) setUnifiedAudioUrl(i, ...)` — pokrývá
  všechny audio modely
- `if (params.srcVideoId) unifiedSrcSetSource(params.srcVideoId)` — pokrývá všechny src
  video modely

**Bug fixes post-smoke (v229en hotfix):**
- `supportsSourceVideo`: WAN 2.7 I2V refMode je `'single_end'`, ne `'i2v'`
- Rezidualní `if (model.type !== 'grok_video') _setRow('unifiedSrcVideoRow', false)`
  aktivně skrýval slot pro Kling/WAN — smazáno, visibility řídí jen unified helper

**Smoke test (Petr: "Vše funguje"):**
- Kling V3 Motion Control → unified src video slot + Upload + Gallery tlačítka ✓
- WAN 2.7 I2V Extend → "Extend Video" (optional) ✓
- WAN 2.7 Edit → "Source Video" (required) ✓
- Grok V2V/Edit/Extend → src slot per mode ✓
- Seedance 2.0 R2V → 3 audio URL inputs ✓
- WAN 2.7 R2V → 1 audio URL input ✓

**Build:** 24848 JS ř. (+1 vs v228en). Total output 30029 (**−53 vs v228en**).
Dead-code audit: smazáno ~170 ř., přidáno ~120 ř., net **−53 ř.**

---

## Přehled modulů

| Modul | Řádky | Poslední změna |
|-------|-------|-----|
| template.html | 5206 | v229en (−54: 4 src rows + audio inputs + wan27vParams shell), ⚠ PŘES LIMIT 4000 |
| video-models.js | 3892 | v229en (unified src video visibility + Grok gate + audio slots) |
| video-queue.js | 993 | v229en (_deriveAudioUrls + state reads migrated to unified) |
| video-gallery.js | 1682 | v229en (−46: VIDEO_SOURCE_SLOTS 3→1, handlers cleanup) |
| video-utils.js | 300 | v229en (+4 pure helpers: audioSlots, supportsSourceVideo, sourceVideoLabel, sourceVideoSupportsUpload) |

---

## Dead code registry

> Povinná sekce od v210en+ dle updated `gis-edit-workflow` skillu.
> Každý DLUH má cílovou cleanup verzi (sudou). Max 5 aktivních dluhů.

### Aktivní dluhy (čekají na cleanup verzi)

- **DLUH #1: template.html 5206 ř. > hard limit 4000** — cílová cleanup v230en
  - Po v229en: −54 ř. (4 source rows + audio inputs + wan27vParams shell)
  - Zbývá: wan27eParams (aspect + audio select) + orphan IDs + starý inpaint UI

- **DLUH #2: wan27eParams shell** — cílová cleanup v230en
  - Zbývá aspect + audio select (2 fields) — zvážit zda je migrovat na unified
    aspect/audio infrastruktury, nebo nechat per-family pro nízkou prioritu
  - Ostatní shells (`wan27vParams`, `videoV2VSection`, `wan27eSrcRow`,
    `wan27vExtendRow`, `grokVideoSrcRow`) smazány v v229en ✓

- **DLUH #3: Orphan HTML IDs (~15 kandidátů)** — cílová cleanup v230en
  - Po v229en audit: `cameraBtn`, `ctxFolderLabel`, `editBtn`, `fepRelightStrVal`,
    `fepSkinGrainVal`, `fepSkinSharpenVal`, `folderPanel`, `genModeBarInner`,
    `gisWatermark`, `inpaintCanvasPreviewCol`, `inpaintCtrlScaleVal`,
    `inpaintMaskBlurVal`, `inpaintParamsCol`, `inpaintPreviewCol`, `inpaintQueueArea`
  - Pozůstatek z předchozích refaktorů. Smazat po verifikaci (`git blame`)
    kontextu každého IDu.

### Vyřešené dluhy (historie)

- ✅ v226en: Per-family seed elementy (wan27vSeed, wan27eSeed, pixverseSeed, sd2Seed)
- ✅ v227en: Per-family safety elementy (wan27vSafety, wan27eSafety)
- ✅ v228en: Duplicitní seed whitelisty (4 místa sjednocena na 1 pure helper)
- ✅ v229en: Per-family source video rows (4 → 1 unified)
- ✅ v229en: Per-family audio URL inputs (4 → 3 unified)
- ✅ v229en: `wan27vParams` shell (po odebrání audio+extend byl prázdný)
- ✅ v229en: 4 per-family slot state vars (wan27vSrc/wan27eSrc/grokSrc/videoMotion*) → 1 unified
- ✅ v229en: 3 per-family slot entries v VIDEO_SOURCE_SLOTS → 1 (unifiedSrc)

---

## Aktivní TODO

### Nejbližší priority

- **v230en (cleanup)** — vyčistit DLUH #1–#3:
  - orphan HTML IDs (15+ kandidátů)
  - wan27eParams shell migrace (aspect na unified aspect row / audio select ponechat)
  - redukce template.html pod 4000 ř.
- **v231en (feature)** — určí Petr
- **Fáze 3** — Reference panel feature-based (HIGH RISK, bigger refactor).
  Cíl: `videoRefSection` podporuje všechny varianty přes spec (single/multi/keyframes/
  char ref/multi-modal Seedance R2V)

### Backlog (po stabilizaci)

- Seedance 2.0 I2V block
- Style Library
- Claid.ai integration
- Hailuo 2.3
- Use V2V workflow
- Runway Gen-4

---

## Reference — kde co hledat v kódu

| Co | Soubor | Přibližné řádky |
|---|---|---|
| Model definice | `video-models.js` | `VIDEO_MODELS = {...}` na začátku |
| Config mapy | `video-models.js` | `RESOLUTION_CONFIG_BY_TYPE`, `DURATION_CONFIG_BY_TYPE` |
| `_applyVideoModel` | `video-models.js` | ~1400-1800 |
| `_vpEnsureDomMoves` | `video-models.js` | ~2030-2170 |
| `_vpApplyUnifiedLayer` | `video-models.js` | ~1820-1950 |
| Unified helpers | `video-models.js` | ~2820-2900 (getUnifiedResolution/Duration/Seed/Safety/AudioUrl) |
| Pure feature helpers | `video-utils.js` | supportsSeed, supportsSafety, audioSlots, supportsSourceVideo, sourceVideoLabel, sourceVideoSupportsUpload |
| Generate submit handlery | `video-models.js` | submitVeo, submitLuma, submitWan27, submitPixverse, submitSeedance2, submitGrok |
| Generate dispatch | `video-queue.js` | `generateVideo()` ~189+ |
| Unified derive functions | `video-queue.js` | _deriveSeed, _deriveSafety, _deriveNegPrompt, _deriveAudioUrls, _deriveSourceVideoId |
| `_buildUnifiedVideoParams` | `video-queue.js` | top-level params (srcVideoId, audioUrls, seed, safety, negPrompt) |
| Reuse path | `video-gallery.js` | `_applyVideoMetaToLegacyUi` ~1640+ |
| Source video slots | `video-gallery.js` | `VIDEO_SOURCE_SLOTS` (unifiedSrc only) |
| Template shared elements | `template.html` | `#vpParams` ~2820-2980 |
| Unified rows | `template.html` | unifiedSeedRow, unifiedSafetyRow, unifiedAudioUrlRow, unifiedSrcVideoRow |
| Seedance R2V panel | `template.html` | `sd2R2VSection` (9 img + 3 vid refs; audio přes unified) |

---

## Rizika a známá problémová místa

### Co se snadno rozbije

1. **Reverse-stacked source slots** — pořadí v `sourceSlots` array v `_vpEnsureDomMoves`
   STEP 3 určuje vizuální stacking pod refs. Přidání nového slotu doprostřed rozhodí layout.

2. **Model switch během otevřeného modal** — `_applyVideoModel` resetuje UI, ale některé
   modály (ref picker, video picker) si drží state v globálních proměnných. Rebuild může
   vést k race condition.

3. **`configureDurationSlider` initial value** — čte current slider value pokud je >0,
   jinak z cfg.default. Reuse path nastavuje `setUnifiedDuration` BEFORE
   `configureDurationSlider`. Pokud se pořadí obrátí, reuse ztratí duration.

4. **Seedance 2.0 Fast tier** — má jen `resolutions: ['480p', '720p']`. Pokud user byl
   na 1080p na Standard a přepne na Fast, `_lastResolutionByType['seedance2_video']` je
   `'1080p'`, ale to už není v options. `configureResolutionSwitcher` musí mít fallback
   na `m.resolutions[0]`.

5. **WAN 2.7e "Match source" = duration '0'** — String '0' v payload, ne number. Historie
   problém s JSON.stringify na number vs string.

6. **WAN 2.7 refMode je `'single_end'`, ne `'i2v'`** — I2V Extend modalita. Check v
   helperech musí používat `'single_end'`, nikdy ne `'i2v'`.

### Build module order (NEZMĚNIT)

```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini → output-render →
db → gallery → toast → paint → ai-prompt → video
```

### fal-inpaint.js, ne fal.js

Worker handler pro fal.ai se jmenuje `fal-inpaint.js`. Recurring zmatek.

---

## Checklist pro začátek příští session (v230en cleanup)

- [ ] Petr uploadne: video-models.js, video-queue.js, video-gallery.js, video-utils.js,
  template.html, STAV.md z v229en
- [ ] Claude zkopíruje do `/home/claude/src/`
- [ ] Baseline build: `node build.js 229en` — očekávaný výsledek: 796 div pairs,
  24848 JS ř., syntax OK
- [ ] Grep test: žádné references na smazané v229en elementy:
  ```
  grep -nE "wan27vSrcVideoId|wan27eSrcVideoId|_grokVideoSrcId|videoMotion(File|VideoId)|wan27vAudioUrl|sd2AudioUrl[0-9]|videoV2VSection|wan27eSrcRow|wan27vExtendRow|grokVideoSrcRow" src/*.js src/template.html
  ```
  Musí být prázdné (kromě historických komentářů).
- [ ] Přečíst tento dokument + gis-edit-workflow skill (PRAVIDLO 5 + sekce 2.5)
- [ ] Diskuze s Petrem: priorita orphan IDs vs wan27eParams migrace

---

**Datum dokumentu:** 2026-04-24
**Poslední stabilní verze:** v229en
**Worker:** 2026-16 (beze změn)
