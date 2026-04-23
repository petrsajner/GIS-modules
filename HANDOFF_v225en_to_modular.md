# VIDEO PANEL — ARCHITEKTURA & MIGRAČNÍ PLÁN

**Dokument pro handoff do další session. Popis současného stavu (v225en) a cesta k plně modulární architektuře.**

---

## 1. VÝCHOZÍ STAV — v225en (co máš HOTOVÉ)

### Co bylo udělané v v225en a NEROZBÍJEJ TO

**Unified helpers — jediné čtení/zápis:**
- `getUnifiedResolution() / setUnifiedResolution(v)` — čte `#unifiedResButtons .seg-btn.active[data-val]`
- `getUnifiedDuration() / setUnifiedDuration(v)` — čte `#videoDuration.value`
- `getUnifiedDurationAuto() / setUnifiedDurationAuto(b)` — `#videoDurAuto`
- `getUnifiedDurationMatchSource() / setUnifiedDurationMatchSource(b)` — `#videoDurMatch`
- Negative prompt: **přímý read** `document.getElementById('vpNegPrompt').value`

**Odstraněno kompletně (neexistuje v DOM):**
- Legacy Resolution selects: `veoResolution`, `lumaResolution`, `wanResolution`, `wan27vResolution`, `wan27eResolution`, `pixverseQuality`, `sd2Res`, `grokVideoRes`
- Legacy Duration inputs: `lumaDuration` radios, `wan27vDuration`, `wan27eDuration`, `sd2Duration`, `sd2DurAuto`, `grokVideoDur`
- Legacy Neg prompt inputs: `wan27vNegPrompt`, `pixverseNegPrompt`
- Prázdné psec shells: `lumaVideoParams`, `pixverseParams`, `seedance2Params`
- Mirror systém: `_syncDurationToLegacy`, `_readLegacyDurationValue`, `_vpNegPromptTargetId`, `_vpInstallNegPromptMirror`

**Data mapy (jediný zdroj):**
- `RESOLUTION_CONFIG_BY_TYPE[type]` → `{ resolutions, labels }`
- `DURATION_CONFIG_BY_TYPE[type]` → `{ min, max, step, default, allowed?, autoCheckbox?, matchSource? }`
- `_lastResolutionByType[type]` — paměť poslední volby per rodina

**Build stav:**
- v225en: 24799 JS ř., 30043 total, HTML div balance 821 pairs OK
- Syntax OK, žádné legacy reads napříč 28 moduly (verified grepem)

---

## 2. SKUTEČNÝ AKTUÁLNÍ STAV (upřímně)

### Architektura: procedurální mutace DOM, NE deklarativní komponenty

**Jak to funguje:**

1. Template.html obsahuje všechny potenciální UI elementy, roztroušené v původních psec panelech
2. Při page load: `_vpEnsureDomMoves()` **jednou** přesune vybrané elementy do fixních slotů v `#vpParams`
3. Při každé změně modelu: `_applyVideoModel(key)` + `_vpApplyUnifiedLayer(key, m)` procedurálně nastavují `style.display` na konkrétních ID
4. Generate: každá rodina má vlastní submit handler + snap block ve video-queue.js
5. Reuse: každá rodina má vlastní `if (params.xxx && model.type === 'xxx_video')` block ve video-gallery.js

**Není to "component renders itself from spec". Je to "global DOM + procedurální visibility".**

### Duplikace KTERÉ JEŠTĚ EXISTUJÍ

| Modul | Duplikace | IDs v DOM |
|---|---|---|
| **Seed input** | 4× různý input element, jedna visible slot | `pixverseSeed`, `sd2Seed`, `wan27vSeed`, `wan27eSeed` |
| **Source video picker** | 4× samostatný UI | `wan27eSrcRow`, `wan27vExtendRow`, `grokVideoSrcRow`, `videoV2VSection` |
| **Character reference** | 1× vlastní panel | `lumaCharRefRow` (Luma only, stylisticky podobný ale jiný DOM než `videoRefSection`) |
| **Audio URL input** | 4× různý input | `wan27vAudioUrl`, `sd2AudioUrl1/2/3` |
| **Safety checkbox** | 2× identické UI | `wan27vSafety`, `wan27eSafety` |
| **R2V multi-modal panel** | Monolitický | `sd2R2VSection` (9img + 3vid + 3audio — nerozložitelné) |
| **Per-family generate** | 6+ funkcí s duplicitní payload logikou | `submitVeo`, `submitLuma`, `submitWan27`, `submitPixverse`, `submitSeedance2`, `submitGrok` |
| **Per-family reuse** | 6+ if-větví s duplicitní set logikou | video-gallery.js `_applyVideoMetaToLegacyUi` |

### Co JE sdílené (1× DOM, používáno všemi)

- Prompt section (`vpPromptSection`)
- Tags row (`videoTagsRow`)
- Negative prompt (`vpNegPromptSection` + `#vpNegPrompt`) — ale čte jen pro WAN 2.7 + PixVerse
- Hlavní Reference panel (`videoRefSection`) — většina I2V modelů
- Resolution switcher (`unifiedResButtons`)
- Aspect ratio (`videoAspectRatio`) — + WAN 2.7e má vlastní `wan27eAspect`
- Duration slider (`videoDuration` + `videoDurAuto` + `videoDurMatch`)
- Count, Audio, Config (Cfg)

---

## 3. OPTIMÁLNÍ MODULÁRNÍ STAV — kam směřovat

### Princip: "Model deklaruje features, panel se složí"

Každý model v `VIDEO_MODELS` mapě bude mít **feature spec** — deklarativní popis co potřebuje:

```javascript
VIDEO_MODELS['pixverse_c1_t2v'] = {
  displayName: 'PixVerse C1 — Text to Video',
  type: 'pixverse_video',          // rodina (generate path selector)
  endpoint: 'fal-ai/pixverse/v3/text-to-video',

  // ── FEATURES (deklarace co model používá) ──
  features: {
    prompt:       { required: true, maxChars: 2000 },
    negPrompt:    { enabled: true },
    tags:         { enabled: true },
    resolution:   { options: ['360p', '540p', '720p', '1080p'], default: '720p' },
    aspect:       { options: ['16:9', '9:16', '1:1'], default: '16:9' },
    duration:     { min: 1, max: 15, step: 1, default: 8 },
    refs:         null,                     // T2V — žádné refs
    seed:         { enabled: true },
    safety:       null,                     // PixVerse nemá safety
    sourceVideo:  null,                     // T2V nemá source
    audioUrl:     null,                     // PixVerse nemá audio URL
    charRef:      null,                     // jen Luma
    multiClip:    { enabled: true },        // PixVerse specific
    offPeak:      { enabled: true },        // PixVerse specific
  },
};

VIDEO_MODELS['seedance2_r2v_fast'] = {
  type: 'seedance2_video',
  features: {
    prompt:     { required: true },
    duration:   { min: 4, max: 15, step: 1, default: 5, autoCheckbox: true },
    resolution: { options: ['480p', '720p'], default: '720p' },  // Fast: no 1080p
    aspect:     { options: ['16:9', '9:16', '1:1', '4:3', '3:4'], default: '16:9' },
    refs:       { multiModal: true, maxImages: 9, maxVideos: 3, maxAudio: 3 },
    seed:       { enabled: true },
  },
};
```

### UI jako reusable moduly

Každý modul existuje **1× v DOM** (v template.html jako skrytá šablona), renderuje se podle spec:

```
<template id="mod-prompt">       <!-- 1× -->
<template id="mod-neg-prompt">   <!-- 1× -->
<template id="mod-refs">         <!-- 1× s podporou multi-modal přes flags -->
<template id="mod-seed">         <!-- 1× -->
<template id="mod-safety">       <!-- 1× -->
<template id="mod-source-video"> <!-- 1× -->
<template id="mod-audio-url">    <!-- 1× s podporou count (1..3) -->
<template id="mod-char-ref">     <!-- 1× -->
<template id="mod-multi-clip">   <!-- 1× -->
<template id="mod-off-peak">     <!-- 1× -->
<template id="mod-loop">         <!-- 1× -->
<template id="mod-color-mode">   <!-- 1× -->
<template id="mod-audio-mode">   <!-- 1× (WAN 2.7e) -->
```

### Render pipeline

```javascript
function renderVideoPanel(modelKey) {
  const m = VIDEO_MODELS[modelKey];
  const panel = document.getElementById('vpParams');
  panel.innerHTML = '';  // clear

  // Pořadí modulů je fixní (layout spec)
  const moduleOrder = [
    'modeFirst',    // refMode / mode-specific first
    'prompt',
    'tags',
    'negPrompt',
    'refs',
    'sourceVideo',
    'charRef',
    'audioUrl',
    // Parameters heading
    'resolution',
    'aspect',
    'cfg',
    'duration',
    'safety',
    'audioMode',
    'seed',
    // Bottom
    'count',
    'audio',
    'multiClip',
    'offPeak',
    'loop',
    'colorMode',
  ];

  for (const key of moduleOrder) {
    const spec = m.features[key];
    if (!spec) continue;          // model to nepoužívá
    const mod = renderModule(key, spec, m);
    panel.appendChild(mod);
  }
}
```

### Generate path jako universal builder

```javascript
function buildVideoPayload(model) {
  const p = { prompt: getPrompt() };

  // Každá feature čte z unified DOM podle spec, ne per-rodina
  if (model.features.negPrompt)    p.negativePrompt = document.getElementById('vpNegPrompt').value;
  if (model.features.resolution)   p.resolution     = getUnifiedResolution();
  if (model.features.duration)     p.duration       = getUnifiedDuration();
  if (model.features.aspect)       p.aspectRatio    = getUnifiedAspect();
  if (model.features.seed)         p.seed           = getUnifiedSeed();
  if (model.features.safety)       p.safety         = getUnifiedSafety();
  if (model.features.audioUrl)     p.audioUrl       = getUnifiedAudioUrls();
  if (model.features.multiClip)    p.multiClip      = getUnifiedMultiClip();
  if (model.features.offPeak)      p.offPeak        = getUnifiedOffPeak();
  // ...

  // Per-rodina jen endpoint + transformace (malé funkce)
  return FAMILY_HANDLERS[model.type].transform(p, model);
}
```

### Výhody cílového stavu

- **Nová rodina modelů** = ~50 řádků (spec + family handler), ne 300
- **Nová feature** (např. "batch size" pro nový model) = 1 template + 1 getter, automaticky k dispozici všem
- **Změna v Reference panelu** = 1 změna v `mod-refs` template, projeví se automaticky ve **všech** modelech co mají `features.refs`
- **Generate/reuse** = automaticky odvozené z feature spec — není potřeba ručně psát per-rodinu
- **Testovatelnost** = každý modul izolovaný, jde psát unit testy

---

## 4. MIGRAČNÍ PLÁN — cesta bez rozbití

**KRITICKÉ: Dělat po krocích, každý krok samostatně otestovat. NE velký big-bang refactor.**

### Fáze 1: Extrakce duplicitních inputů (LOW RISK)

**Cíl:** Jeden `#unifiedSeed` input použitý všemi. Žádný `pixverseSeed`, `sd2Seed`, `wan27vSeed`, `wan27eSeed`.

**Postup:**
1. Přidat `<input id="unifiedSeed">` do template.html do Seed slotu (sdílený)
2. Přidat helpers `getUnifiedSeed()` / `setUnifiedSeed(v)`
3. Generate path (video-queue.js + video-models.js): nahradit čtení `pixverseSeed.value` atd. za `getUnifiedSeed()`
4. Reuse path (video-gallery.js): nahradit `_setValue('pixverseSeed', ...)` atd. za `setUnifiedSeed(s.seed)`
5. Smazat z template.html legacy seed inputy
6. Smazat z `_vpExtractPerFamilyElements` extract logiku pro Seed (už není co extrakovat)

Build + syntax + smoke test (PixVerse seed, Seedance seed, WAN 2.7 seed, WAN 2.7e seed vygenerovat).

**Podobně pak:**
- `#unifiedSafety` checkbox (místo `wan27vSafety` + `wan27eSafety`)
- `#unifiedAudioUrl1/2/3` (místo `wan27vAudioUrl` + `sd2AudioUrl1/2/3`)

### Fáze 2: Source Video sjednocení (MEDIUM RISK)

**Cíl:** Jeden `#unifiedSrcVideo` picker se feature flags `{extend: bool, v2v: bool}`.

**Současný stav:**
- `wan27eSrcRow` (WAN 2.7e V2V)
- `wan27vExtendRow` (WAN 2.7 Extend)
- `grokVideoSrcRow` (Grok Edit/Extend)
- `videoV2VSection` (generic V2V)

Všechny 4 dělají zhruba totéž — pick video from gallery, show thumb, store ID. Lze sjednotit.

**Postup:**
1. Navrhnout `#unifiedSrcVideo` panel podporující módy (v2v/extend/edit)
2. Generate path: sjednotit čtení source video ID (global variable `activeSrcVideoId` místo per-family `wan27eSrcVideoId`, `wan27vSrcVideoId`, `grokSrcVideoId`)
3. Visibility řídit feature spec modelu
4. Smazat 4 starší panely + přesuny v `_vpEnsureDomMoves` STEP 3

### Fáze 3: Reference panel feature-based (HIGH RISK)

**Cíl:** `videoRefSection` podporuje všechny varianty přes spec:
- Single image (Veo I2V, Luma T2V)
- Multiple images (Kling up to 4, PixVerse fusion)
- Keyframes (Luma — first + last frame)
- Character reference (Luma Ray3)
- Multi-modal (Seedance 2.0 R2V — 9 img + 3 vid + 3 audio)

**Riziko:** Seedance R2V je zcela jiná interakce (3 sloty pro videa s popisy, 3 audio URLs). Spec musí podporovat `multiModal: {images, videos, audio}`.

**Postup:**
1. Extend `videoRefSection` aby podporoval nové módy
2. Migrovat `lumaCharRefRow` jako speciální případ refs (`charRef: true`)
3. Migrovat `sd2R2VSection` — buď jako rozšíření refs, nebo jako samostatný "multi-modal refs" modul
4. Aktualizovat všechny generate handlery aby četli z sjednocené source

### Fáze 4: Feature spec + declarative render (BIG REFACTOR)

**Teprve po Fázích 1-3, kdy všechny inputy jsou sjednocené:**
1. Definovat `VIDEO_MODEL_FEATURES` schema (všechny možné features)
2. Přidat `features: {...}` objekt na každý model v `VIDEO_MODELS`
3. Napsat `renderVideoPanel(modelKey)` který staví panel z templates + spec
4. Napsat `buildVideoPayload(model)` který univerzálně čte inputy
5. Přepsat `_applyVideoModel` na jediný call `renderVideoPanel(key)`
6. Smazat `_vpEnsureDomMoves`, `_vpApplyUnifiedLayer`, `_vpExtractPerFamilyElements` — už nejsou potřeba

### Fáze 5: Generate handlers jako pure transforms

```javascript
const FAMILY_HANDLERS = {
  'veo':             { endpoint: 'google/veo-3', transform: veoTransform, submit: veoSubmit },
  'luma_video':      { endpoint: 'luma/ray', transform: lumaTransform, submit: lumaSubmit },
  'wan27_video':     { endpoint: 'fal-ai/wan/v2.7/...', transform: wan27Transform, submit: wan27Submit },
  // ...
};
```

Každý handler jen endpoint + malá transform funkce (universal payload → API-specific body). Žádná DOM logika, žádné `getElementById` čtení.

---

## 5. PRAVIDLA PRO PŘÍŠTÍ SESSION

### Než budeš dělat velký refactor, zkontroluj:

1. **Aktuální build funguje** — `node build.js 225en`, syntax OK, HTML div balance 821 pairs
2. **`/mnt/project/` je ZASTARALÝ (v217en)** — používej `/home/claude/src/` jako canonical
3. **Zero legacy reads** — ověř grepem:
   ```
   grep -nE "getElementById\('(veoResolution|lumaResolution|wanResolution|wan27vResolution|wan27eResolution|pixverseQuality|sd2Res|grokVideoRes|lumaDuration|wan27vDuration|wan27eDuration|sd2Duration|grokVideoDur|wan27vNegPrompt|pixverseNegPrompt)'" *.js
   ```
   Musí být **prázdné**.

### DŮLEŽITÉ — NEROZBIJ

- **Unified helpers** (`getUnifiedResolution/Duration`, `setUnifiedResolution/Duration`) — generate/reuse na nich stojí
- **Config mapy** (`RESOLUTION_CONFIG_BY_TYPE`, `DURATION_CONFIG_BY_TYPE`) — používané configureResolutionSwitcher + configureDurationSlider
- **`_vpEnsureDomMoves` STEP 3** source slots reverse-stack — layout by se rozsypal
- **Per-family panely** `wan27vParams`, `wan27eParams`, `grokVideoParams` — drží zbývající non-unified elements
- **Seedance R2V panel** `sd2R2VSection` — complex multi-modal, nech zatím jako je

### Workflow pro další session

1. Petr uploadne aktuální soubory (video-models.js, video-queue.js, video-gallery.js, template.html, STAV.md)
2. Claude skopíruje do `/home/claude/src/`
3. Baseline build: `node build.js 225en` nebo nová verze
4. Začít Fází 1 (Seed sjednocení) — LOW RISK, malá změna, jasný scope
5. Každá fáze = vlastní version bump (v226en pro Seed, v227en pro Safety, atd.)
6. Po každé fázi: syntax OK + HTML balance + Petr smoke test aspoň jeden model z každé dotčené rodiny
7. Update STAV.md + migrační plán (škrtnout dokončenou fázi)

### Build module order (NEZMĚNIT)

```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini → output-render →
db → gallery → toast → paint → ai-prompt → video
```

### fal-inpaint.js, ne fal.js

Worker handler pro fal.ai se jmenuje `fal-inpaint.js`. Recurring zmatek.

---

## 6. RIZIKA A ZNÁMÁ PROBLÉMOVÁ MÍSTA

### Co se snadno rozbije

1. **Reverse-stacked source slots** — pořadí v `sourceSlots` array v `_vpEnsureDomMoves` STEP 3 určuje vizuální stacking pod refs. Přidání nového slotu doprostřed rozhodí layout.

2. **Model switch během otevřeného modal** — `_applyVideoModel` resetuje UI, ale některé modály (ref picker, video picker) si drží state v globálních proměnných. Rebuild může vést k race condition.

3. **`configureDurationSlider` initial value** — v v225en čte current slider value pokud je >0, jinak z cfg.default. Reuse path nastavuje `setUnifiedDuration` BEFORE `configureDurationSlider`. Pokud se pořadí obrátí, reuse ztratí duration.

4. **Seedance 2.0 Fast tier** — má jen `resolutions: ['480p', '720p']`. Pokud user byl na 1080p na Standard a přepne na Fast, `_lastResolutionByType['seedance2_video']` je `'1080p'`, ale to už není v options. `configureResolutionSwitcher` musí mít fallback na `m.resolutions[0]`.

5. **WAN 2.7e "Match source" = duration '0'** — String '0' v payload, ne number. Historie problém s JSON.stringify na number vs string.

### Místa kde pozornost při refaktorech

- `_vpEnsureDomMoves` je `_vpDomMovesDone` guarded — spustí se **jen jednou**. Nový refactor musí respektovat tenhle lifecycle, nebo ho nahradit.
- `videoRefSection` refs jsou sdílené ale `videoRefs` array je globální. Při přepínání modelů `videoRefs.length` drží refs z předchozího modelu — `_applyVideoModel` je nuluje? (Zkontrolovat.)
- `_applyResolutionSideEffects(m, value)` — má per-type logic (Veo force 8s pro 1080p/4K). Při refaktoru na feature-based nesmí se ztratit.

---

## 7. BACKLOG (po stabilizaci modularizace)

- **Style Library** integration
- **Claid.ai** provider
- **Hailuo 2.3** nový model
- **Use V2V** workflow (video → video s referencí)
- **Runway Gen-4** nová rodina
- Seedance 2.0 I2V block (kromě R2V)

---

## 8. REFERENCE — kde co hledat v kódu

| Co | Soubor | Přibližné řádky |
|---|---|---|
| Model definice | `video-models.js` | `VIDEO_MODELS = {...}` na začátku |
| Config mapy | `video-models.js` | `RESOLUTION_CONFIG_BY_TYPE`, `DURATION_CONFIG_BY_TYPE` |
| `_applyVideoModel` | `video-models.js` | ~1400-1800 |
| `_vpEnsureDomMoves` | `video-models.js` | ~2030-2170 |
| `_vpApplyUnifiedLayer` | `video-models.js` | ~1820-1950 |
| Unified helpers | `video-models.js` | ~2820-2900 (getUnifiedResolution atd.) |
| configureDurationSlider | `video-models.js` | ~2450-2500 |
| configureResolutionSwitcher | `video-models.js` | ~2630-2750 |
| Generate submit helpers | `video-models.js` | submitVeo, submitLuma, submitWan27, submitPixverse, submitSeedance2, submitGrok |
| Snap blocks | `video-queue.js` | ~290-400 (per-family snapshot into job) |
| Generate dispatch | `video-queue.js` | `generateVideo()` ~189+ |
| `_deriveNegPrompt` | `video-queue.js` | ~967 |
| Reuse path | `video-gallery.js` | `_applyVideoMetaToLegacyUi` ~1640+ |
| Template shared elements | `template.html` | `#vpParams` ~2820-2980 |
| Template per-family | `template.html` | wan27vParams ~3349, wan27eParams ~3413 |
| PixVerse extracted | `template.html` | `pixverseMultiClip`, `pixverseOffPeak`, `pixverseSeed` ~3470-3492 |
| Seedance R2V panel | `template.html` | `sd2R2VSection` ~3509+ |

---

## 9. CHECKLIST PRO ZAČÁTEK PŘÍŠTÍ SESSION

- [ ] Petr uploadne: video-models.js, video-queue.js, video-gallery.js, template.html, STAV.md z v225en
- [ ] Claude zkopíruje do `/home/claude/src/`
- [ ] Baseline build: `node build.js 225en` — očekávaný výsledek: 821 div pairs, 24799 JS ř., syntax OK
- [ ] Grep test: žádné legacy element reads (viz sekce 5)
- [ ] Přečíst tento dokument a STAV.md před jakoukoli změnou
- [ ] Diskuze s Petrem: kterou fází začneme (doporučeno: Fáze 1 Seed unification)
- [ ] Každá změna = nová version (v226en, v227en, ...)
- [ ] Po každé fázi: outputs copy + smoke test feedback

---

**Datum dokumentu:** 2026-04-23
**Poslední stabilní verze:** v225en
**Worker:** 2026-16 (beze změn, není potřeba redeploy pro UI refactor)
