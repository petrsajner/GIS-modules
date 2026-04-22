# Session 2 — Handoff dokument

**Určeno pro:** Příští Claude který pokračuje Session 2 Fáze 4-8.
**Vytvořeno:** 2026-04-22 (po Fázi 1-3 v v207en).
**Scope:** Unified video panel + unified metadata schema + reuse fix.

---

## 0. Kontext v 60 sekundách

Petr (sole dev) chce sjednotit UI panel pro všechny video modely — analogicky v200en udělal pro images (9 modelů → 1 unified panel). Důvod **NENÍ primárně redukce řádků**, ale **sjednocení vzhledu a funkčnosti**. Omezení míst kde se vytváří panel = sekundární bonus.

Plus druhý cíl: uklidit metadata — každé video musí ukládat VŠECHNA nastavení do konzistentního `params` schema, aby reuse korektně obnovil celou konfiguraci. Aktuálně **Seedance 2.0 reuse → prázdné model pole** (bug), protože `reuseVideoJob` neumí všechny edge cases.

---

## 1. Co už je hotové (v207en, Fáze 1-3)

### Fáze 1: Pořadí modelů
Požadované pořadí (Veo → Kling → PixVerse → Seedance → Grok → Luma → Vidu → WAN → Topaz → Magnific) **už je v HTML** v `#videoModelSelect`. **Žádná změna nebyla potřeba.**

### Fáze 2: `getVideoUi(modelKey)` helper
V `video-models.js` za MAGNIFIC_VIDEO_MODELS.

**Strategie:** Místo injektování `ui: {...}` do ~60 entries (duplicitní, chyba-prone) je **jeden central helper** pattern-based:
1. Model type (veo/kling/luma_video/seedance/vidu/wan27/wan26/pixverse/grok)
2. Varianta (_t2v / _i2v / _r2v / _v2v / _kf / _transition / _fusion)
3. Family defaults + per-model overrides

**Vrací Object.freeze()** se všemi flags. Consumer může bez existence-check destructurovat.

**KRITICKÉ:** Kling group parent entries (`kling_v3`, `seedance2`, `wan27`, `pixverse_c1`, atd.) v `KLING_GROUPS` delegují na `getVideoUi(kg.default)`. Tj. `getVideoUi('seedance2')` vrací UI pro `seedance2_t2v` (first variant v group).

**Full flag list:**
```js
{
  // Core visibility:
  showResolution: bool, resolutions: [],
  showAspect: bool, aspectRatios: [],
  showDuration: bool, durationType: 'slider'|'select'|'radio',
    durationMin, durationMax, durationOptions: [],
  showCfg: bool, cfgMin, cfgMax,
  showSeed: bool, showAudio: bool, showNegPrompt: bool, showCount: bool,
  // Refs:
  showRefs: bool, refMaxCount: number, showRefWeights: bool,
  // Source:
  sourceSlot: null|'topaz'|'wan27v'|'wan27e'|'v2v'|'sd2Vid'|'grok'|'magnific',
  showAudioSources: bool, audioSourceCount: number,
  // Sub-select:
  modeSelect: null|'klingVersion'|'veoRefMode'|'grokMode'|'pixverseMode',
  // Family-specific advanced groups (zachováno as-is — too model-specific):
  advancedGroup: null|'topaz'|'magnific'|'pixverse'|'luma',
  // Camera move submenu:
  showCameraMove: bool,
  // Bottom toggles:
  showMultiClip: bool, showMultiShots: bool, showOffPeak: bool,
}
```

### Fáze 3: Unified HTML panel `#vpParams`
V `template.html` hned za `#videoModelDesc` (řádek ~2842), před `#klingVersionRow`.

**Struktura (podle Petrova pořadí):**
1. `#vpModeSection` — mode sub-select (Kling version / Veo refMode / Grok mode / PixVerse mode)
2. `#vpPromptSection` — textarea `#vpPrompt` + ✦ AI button
3. `#vpTagsRow` — `#vpStyleTags`, `#vpCameraTags`, `#vpCameraMoveRow` (model camera move menu `#vpCameraMove`)
4. `#vpNegPromptSection` — **1-řádkové collapsible** (upNeg pattern): toggle přes `#vpNegPromptCaret`, body `#vpNegPromptBody` s `#vpNegPrompt` input
5. `#vpRefsSection` — `#vpRefsPanelScroll` s `#vpRefsAddTile`, `#vpRefsInput` (file), `#vpRefsCount`. Uvnitř `#vpRefWeights` — per-ref weight slidery (pro Luma, populated dynamicky)
6. `#vpSourceVideoSection` — source video slot (vpSourceVideoInfo, vpSourceVideoThumb, vpSourceVideoImg, vpSourceVideoMeta, vpSourceVideoPickBtn/DescribeBtn/ClearBtn). Z hlediska UX = pokračování reference section (Petr explicitně: "hned pod reference je to v podstate take reference")
7. `#vpSourceAudioSection` — `#vpSourceAudio1/2/3` (URL inputs pro Seedance 2.0)
8. `#vpCoreParams`:
   - `#vpResolutionRow` — select `#vpResolution` + `#vpResolutionNote`
   - `#vpAspectRow` — select `#vpAspect`
   - `#vpCfgRow` — slider `#vpCfg` + `#vpCfgVal` display
   - `#vpDurationRow` — tří režimů: `#vpDuration` (slider), `#vpDurationSelect` (select), `#vpDurationRadios` (radio group). Per `ui.durationType` se ukáže jeden z nich. `#vpDurationVal` pro slider display
   - `#vpSeedRow` — number input `#vpSeed`
9. Individual advanced (kept separate — "Topaz a Magnific jsou uplne jine modely"):
   - `#vpLumaAdvanced` — `#vpLumaLoop`, `#vpLumaHdrRow` + `#vpLumaColorMode`
   - `#vpPixverseAdvanced` — `#vpPixverseQuality`
   - `#vpTopazAdvanced` — `#vpTopazResolution`, `#vpTopazFactor`, `#vpTopazFps`, `#vpTopazSlowmo`, `#vpTopazCreativity`
   - `#vpMagnificAdvanced` — `#vpMagnificResolution`, `#vpMagnificFps`, `#vpMagnificSharpen`, `#vpMagnificGrain`, `#vpMagnificCreativeOpts`, `#vpMagnificPrecisionOpts`, `#vpMagnificPrompt`, `#vpMagnificCreativity`, `#vpMagnificFlavor_vivid/natural`, `#vpMagnificStrength`
10. `#vpCountRow` — slider `#vpCount` + `#vpCountVal`
11. `#vpBottomToggles`:
    - `#vpMultiClipRow` → checkbox `#vpMultiClip`
    - `#vpMultiShotsRow` → checkbox `#vpMultiShots`
    - `#vpOffPeakRow` → checkbox `#vpOffPeak`
    - `#vpAudioRow` → checkbox `#vpAudio` (checked by default — Petr explicitně: audio patří k bottom toggles)

**Panel je `display:none;flex-direction:column;`**. Dokud `_applyVideoModel` neukáže (Fáze 4), zůstává skrytý. Produkce funguje jako v v206en.

**Onclick handlers referencované v HTML (ještě neexistují — Fáze 4 je vytvoří):**
- `onVpModeChange(value)`
- `vpAiPrompt()` (může reuse `aiGeneratePromptForVideo`)
- `vpToggleNegPrompt()`
- `vpRefsFileSelected(files)`
- `vpPickSourceVideo()` / `vpDescribeSourceVideo()` / `vpClearSourceVideo()`
- `updateVpResInfo()`

---

## 2. Klíčová Petrova rozhodnutí z této session

### 2.1 Sekce pořadí (explicitní spec od Petra)
- **Sub-select první**
- **Common header:** prompt, tags, **NEG PROMPT** (jako upNeg pattern z images, 1-řádek collapsible), reference images
- **Source video** hned pod reference ("je to v podstate take reference"), **source audio** hned pod source video
- **Core params POŘADÍ (fixní):** Resolution, Aspect, CFG, Duration, Seed
- **Camera move** jako "Model camera move" menu **pod prompt** (vedle GIS Camera tagů) — nepatří do core params
- **Character ref** (Luma) = "obycejna reference — ani to u lumy nemame zobrazene" → zrušit separátní UI, integrovat do videoRefs
- **Luma ref weights** = 3 separátní slidery, **zobrazované postupně podle počtu refs** (1 ref = 1 slider, 2 refs = 2 slidery, 3 refs = 3 slidery). Aktuálně **vůbec se nezobrazují** (bug, nevíme proč — Fáze 4 opraví)
- **Multiclip / Multi-shots / Off-peak / Audio** = všechno **spodní přepínače** nad Save to folder (Multi-shots je to samé co Multiclip, jen jiný model)
- **Topaz a Magnific** advanced sekce **nechat jak jsou** — "to jsou uplne jine modely"

### 2.2 Architektonická rozhodnutí
- **Big bang migration** (Petrova volba): unified panel + metadata + reuse vše najednou, NE incremental, NE dual-panel
- **`getVideoUi()` helper místo `ui: {...}` per entry** (Claude doporučil, Petr neodmítl): centralizace logic, pattern-based
- **Wrappers-preserved pattern z v206en pokračuje:** neměnit HTML IDs masivně, staré funkce zůstanou jako 1-line forwards, nové unified panel má `vpXxx` IDs pro čistý start

### 2.3 Bug k opravě jako side effect
**Seedance 2.0 reuse → prázdné model pole.** V `reuseVideoJob` (video-gallery.js:990) je logika:
```js
if (groupKey) {
  modelSel.value = groupKey;              // 'seedance2'
  onVideoModelChange(groupKey);           // populuje klingVersionSelect s group
  const verSel = document.getElementById('klingVersionSelect');
  if (verSel) { verSel.value = meta.modelKey; _applyVideoModel(meta.modelKey); }
}
```
Timing issue / option populace nefunguje správně pro Seedance. Fix = Fáze 6 přepíše celý flow přes `loadVideoJobParamsToForm` — nebude to lokální patch, ale systémové řešení.

---

## 3. Unified metadata schema (DEFINITIVNÍ spec)

```js
params: {
  // Core (VŽDY, všechny modely):
  resolution:     string,    // '480p' | '720p' | '1080p' | '4k' | ...
  aspectRatio:    string,    // '16:9' | '9:16' | '1:1' | ...
  duration:       number,    // sekundy
  cfgScale:       number,    // 0-1 (Kling) nebo model-specific range
  seed:           number|null,  // null = random
  enableAudio:    boolean,
  count:          number,    // 1-4
  negativePrompt: string,

  // Sub-select:
  modeValue:    string|null,  // Grok mode, Veo refMode, PixVerse mode
  variantKey:   string,       // 'kling_v3_t2v_pro' atd. — pro Kling group restore

  // Source video slot:
  sourceVideoId: string|null,

  // Source audio (Seedance 2.0):
  audioUrls: string[],  // max 3

  // Per-family advanced (null pokud model do family nepatří):
  topaz: {
    factor:     1|2|4,
    fps:        string,       // '', '24', '30', '48', '60', '120'
    slowmo:     1|2|4|8,
    creativity: 0|1|2|3|4,
  } | null,
  magnific: {
    mode:       'creative'|'precision',
    resolution: '1k'|'2k'|'4k',
    fpsBoost:   boolean,
    sharpen:    0-100,
    grain:      0-100,
    prompt:     string,        // creative only
    creativity: 0-100,         // creative only
    flavor:     'vivid'|'natural',  // creative only
    strength:   0-100,         // precision only
  } | null,
  pixverse: {
    quality:     '360p'|'540p'|'720p'|'1080p',
    cameraMove:  string,
    multiClip:   boolean,
    offPeak:     boolean,
  } | null,
  luma: {
    loop:         boolean,
    colorMode:    'sdr'|'hdr'|'exr',
    refWeights:   number[],    // per-ref weights v pořadí refs
  } | null,
  wan: {
    multiShots: boolean,
  } | null,
  grok: {
    mode: 't2v'|'i2v'|'ref2v'|'edit'|'extend',
  } | null,
  veo: {
    refMode: 't2v'|'i2v'|'frames'|'ingredients',
  } | null,
}
```

**Implementace bude dvě funkce:**

```js
// Fáze 5: Read UI → params
function buildVideoParams() {
  const modelKey = getActiveVideoModelKey();
  const ui = getVideoUi(modelKey);
  const p = {
    resolution: _readResolution(ui),  // handles vpResolution OR model-specific (Topaz/Magnific/Pixverse)
    aspectRatio: document.getElementById('vpAspect').value,
    duration: _readDuration(ui),       // slider/select/radio based
    cfgScale: parseFloat(document.getElementById('vpCfg').value),
    seed: _parseSeed(document.getElementById('vpSeed').value),
    enableAudio: document.getElementById('vpAudio').checked,
    count: parseInt(document.getElementById('vpCount').value) || 1,
    negativePrompt: document.getElementById('vpNegPrompt').value.trim(),
    modeValue: _readMode(ui),
    variantKey: modelKey,
    sourceVideoId: _readSourceVideoId(ui),
    audioUrls: _readAudioUrls(ui),
    topaz:    ui.advancedGroup === 'topaz'    ? _readTopazParams()    : null,
    magnific: ui.advancedGroup === 'magnific' ? _readMagnificParams() : null,
    pixverse: ui.advancedGroup === 'pixverse' ? _readPixverseParams() : null,
    luma:     ui.advancedGroup === 'luma'     ? _readLumaParams()     : null,
    wan:      modelKey.startsWith('wan26_t2v')? { multiShots: document.getElementById('vpMultiShots').checked } : null,
    grok:     ui.modeSelect === 'grokMode'    ? { mode: _readGrokMode() } : null,
    veo:      ui.modeSelect === 'veoRefMode'  ? { refMode: _readVeoRefMode() } : null,
  };
  return p;
}

// Fáze 6: Params → UI (reuse)
function loadVideoJobParamsToForm(params, modelKey) {
  // 1. Set model select (+ sub-select for Kling group)
  _setVideoModelFromParams(params, modelKey);
  // 2. _applyVideoModel(modelKey) — configures UI visibility (Fáze 4 už zajistí)
  // 3. Apply all vpXxx values
  _setIfExists('vpPrompt', params.prompt);
  _setIfExists('vpResolution', params.resolution);
  _setIfExists('vpAspect', params.aspectRatio);
  // ... atd.
  // 4. Advanced groups:
  if (params.topaz) _applyTopazParams(params.topaz);
  if (params.magnific) _applyMagnificParams(params.magnific);
  // atd.
  // 5. Refs (existující logic pro asset lookup + thumbnail generation)
  _loadVideoRefs(params.refs || []);
}
```

### Backward compatibility pro stará videa
Stará videa v DB mají ad-hoc params shape. Při reuse detekovat old shape:
```js
function _isOldParamsShape(params) {
  // New shape má vždy aspectRatio + resolution + count (nikdy undefined)
  return !params.variantKey;  // New shape has variantKey; old doesn't
}

function _migrateOldParams(params, modelKey) {
  // Best-effort mapping: known fields → new shape, missing → defaults
  const m = VIDEO_MODELS[modelKey];
  return {
    resolution:     params.resolution  || m?.resolutions?.[0] || '720p',
    aspectRatio:    params.aspectRatio || m?.aspectRatios?.[0] || '16:9',
    duration:       params.duration    || m?.defaultDur || 5,
    cfgScale:       params.cfgScale    ?? 0.5,
    seed:           params.seed        || null,
    enableAudio:    params.enableAudio ?? true,
    count:          1,
    negativePrompt: params.negativePrompt || '',
    modeValue:      params.mode   || null,
    variantKey:     modelKey,
    sourceVideoId:  params.srcVideoUrl ? /* lookup gallery */ : null,
    audioUrls:      params.vidSrcIds?.filter(Boolean) || [],
    // Per-family: migrate známe fields, zbytek defaults
    luma:     params.loop !== undefined ? { loop: params.loop, colorMode: params.colorMode || 'sdr', refWeights: [] } : null,
    pixverse: params.quality ? { quality: params.quality, cameraMove: '', multiClip: !!params.multiClip, offPeak: !!params.offPeak } : null,
    // ... atd.
  };
}
```

---

## 4. Fáze 4 — Detailní implementační plán

### 4.1 `_applyVideoModel(modelKey)` refactor

**Aktuální stav:** 364 řádků switch v `video-models.js`. Každý `case` type volá `_setRow('xxxRow', show)` × 15-25 a další UI updates.

**Nový stav:** ~40 řádků flag-driven.

```js
function _applyVideoModel(modelKey) {
  const ui = getVideoUi(modelKey);
  const m  = VIDEO_MODELS[modelKey] || TOPAZ_MODELS[modelKey] || MAGNIFIC_VIDEO_MODELS[modelKey];
  if (!m) return;

  // Aktivovat unified panel, skrýt staré per-model panely
  document.getElementById('vpParams').style.display = 'flex';
  _hideLegacyVideoPanels();  // helper — skryje všechny staré ID

  // Popis modelu
  document.getElementById('videoModelDesc').textContent = m.desc || '';

  // Mode sub-select
  _vpApplyModeSelect(ui.modeSelect, modelKey);

  // Tags visibility
  _setRow('vpCameraMoveRow', ui.showCameraMove);
  _populateVpCameraMove(ui);  // options per model

  // Negative prompt
  _setRow('vpNegPromptSection', ui.showNegPrompt);

  // Refs section
  _setRow('vpRefsSection', ui.showRefs);
  _updateVpRefsLabel(ui);  // "Reference images (0 / N)"
  _setRow('vpRefWeights', ui.showRefWeights);
  _vpRenderRefWeights(ui); // per-ref weight sliders (Luma only)

  // Source video
  _setRow('vpSourceVideoSection', !!ui.sourceSlot);

  // Source audio (Seedance 2.0)
  _setRow('vpSourceAudioSection', ui.showAudioSources);

  // Core params
  _setRow('vpResolutionRow', ui.showResolution);
  _populateVpResolution(ui);
  _setRow('vpAspectRow', ui.showAspect);
  _populateVpAspect(ui);
  _setRow('vpCfgRow', ui.showCfg);
  _setRow('vpDurationRow', ui.showDuration);
  _configureVpDuration(ui);  // handles slider/select/radio mode
  _setRow('vpSeedRow', ui.showSeed);

  // Advanced groups (jen jedna aktivní)
  _setRow('vpLumaAdvanced',     ui.advancedGroup === 'luma');
  _setRow('vpPixverseAdvanced', ui.advancedGroup === 'pixverse');
  _setRow('vpTopazAdvanced',    ui.advancedGroup === 'topaz');
  _setRow('vpMagnificAdvanced', ui.advancedGroup === 'magnific');

  // Count
  _setRow('vpCountRow', ui.showCount);

  // Bottom toggles
  _setRow('vpMultiClipRow',  ui.showMultiClip);
  _setRow('vpMultiShotsRow', ui.showMultiShots);
  _setRow('vpOffPeakRow',    ui.showOffPeak);
  _setRow('vpAudioRow',      ui.showAudio);

  // Update res info (1080p note, etc.)
  updateVpResInfo();
}
```

**Helper funkce k napsání:**
- `_hideLegacyVideoPanels()` — skryje všechny staré panely (lumaVideoParams, pixverseParams, magnificVidOpts, ...)
- `_vpApplyModeSelect(modeSelectKey, modelKey)` — setup vpModeSelect options + value podle modeSelectKey
- `_populateVpCameraMove(ui)` — Pixverse v4/v4.5 camera moves options
- `_updateVpRefsLabel(ui)` — "Reference images · N / max"
- `_vpRenderRefWeights(ui)` — pro Luma per-ref weight slidery
- `_populateVpResolution(ui)` — `<option>` z ui.resolutions
- `_populateVpAspect(ui)` — `<option>` z ui.aspectRatios
- `_configureVpDuration(ui)` — handle slider/select/radio per ui.durationType
- `updateVpResInfo()` — pixel resolution display ("1920×1080 · 5s")

### 4.2 Aktivace panelu

**Na konci Fáze 4:**
- v `_applyVideoModel` je `document.getElementById('vpParams').style.display = 'flex'`
- Staré panely skryté přes `_hideLegacyVideoPanels()` 
- **Testování:** nastavit různé modely, ověřit že unified panel správně reaguje

**Staré panely POZOR — zatím JE NEODSTRAŇOVAT.** Ve Fázi 4 jen skrýt. Odstraní se až ve Fázi 8 po úplném testování Fáze 5-7.

### 4.3 Legacy panels k skrytí v `_hideLegacyVideoPanels()`

```js
function _hideLegacyVideoPanels() {
  const ids = [
    'lumaParams', 'grokVideoParams', 'lumaVideoParams', 
    'topazSrcRow', 'pixverseParams', 'magnificVidOpts',
    'veoRefModeRow', 'klingVersionRow',  // klingVersionRow → vpModeSection převzato
    'lumaHdrRow', 'lumaCharRefRow', 'lumaResRow',
    'veoResRow', 'wanResRow', 'topazResRow',
    'topazFactorRow', 'topazFpsRow', 'topazSlowmoRow', 'topazCreativityRow',
    'videoAspectRow', 'videoCfgRow', 'videoDurRow',
    'videoAudioCtrl', 'videoCountRow', 'videoResInfoRow',
    'videoRefSection',  // → vpRefsSection převzato
    'videoTagsRow',     // → vpTagsRow převzato
    'videoPromptSec',   // → vpPromptSection převzato
  ];
  for (const id of ids) _setRow(id, false);
}
```

---

## 5. Fáze 5 — `buildVideoParams()` + generateVideo refactor

### 5.1 `buildVideoParams()` — spec

Viz § 3 výše.

**Dodatek — source video lookup:**
`sourceVideoId` může být potřeba lookup-ovat v různých slot globalech:
- Topaz: `topazSrcVideoId` (globální v video-topaz.js)
- WAN 2.7: `wan27SrcVideoId`, `wan27eSrcVideoId`
- V2V: `v2vSrcVideoId` (z video-gallery.js)
- Seedance 2.0 vid src: `sd2VidSrc1Id`, `sd2VidSrc2Id`, `sd2VidSrc3Id` (3 sloty)
- Grok: `grokVideoSrcId` (local v video-models.js)

V Fázi 5 udělat `_readSourceVideoId(ui)` který přečte správnou globální podle `ui.sourceSlot`.

### 5.2 `generateVideo` refactor

Aktuální `generateVideo` má 223 řádků: sbírá UI state přes 30+ `getElementById`, pak switch na `model.type` → per-model validation → addToQueue. 

**Nová struktura:**
```js
async function generateVideo() {
  const modelKey = getActiveVideoModelKey();
  const model = VIDEO_MODELS[modelKey] || TOPAZ_MODELS[modelKey] || MAGNIFIC_VIDEO_MODELS[modelKey];
  if (!model) { toast('Select a video model', 'err'); return; }

  // API key validation (beze změny)
  if (!_validateVideoKeys(model)) return;

  // Build params from UI (Fáze 5)
  const params = buildVideoParams();
  const prompt = document.getElementById('vpPrompt').value.trim();

  // Validation per model type (Fáze 7 přesune do VIDEO_MODELS entries)
  const validation = _validateVideoParams(modelKey, params, prompt);
  if (!validation.ok) { toast(validation.error, 'err'); return; }

  // Count × jobs enqueue
  for (let i = 0; i < params.count; i++) {
    const job = _createVideoJob(modelKey, params, prompt);
    addToQueue(job);
  }
  startVideoQueue();
}
```

**`_createVideoJob`** — extrahuje snapshots (videoRefsSnapshot, sourceVideoSnap, atd.) do jobu. Beze změny api.

**Handlery v `VIDEO_MODELS` entries** (type-specific) čtou z `job.params` místo `job.xxx`. V Fázi 7.

### 5.3 Fáze 5 gotchas

- **Veo `refMode`** vs. modelKey: Veo má jen 2 modely (veo_31, veo_31_fast), ale 4 refModes (t2v/i2v/frames/ingredients). RefMode je v `params.veo.refMode`, NE v `modelKey`.
- **Grok `mode`** podobně: 1 model (grok_video), 5 modes. Mode je v `params.grok.mode`.
- **Kling version sub-select**: je to pro výběr variant v groupu (kling_v3_t2v_std vs _pro atd.). `params.variantKey` obsahuje specifický variant key.
- **PixVerse `modeSelect`**: pixverse_c1 má 4 varianty (t2v/i2v/transition/fusion), pixverse_v6 má 3. Sub-select určuje variantKey.
- **Seedance 2.0 source audio URLs**: `params.audioUrls` je array max 3 strings. Prázdný = žádná audio reference. V handleru `_seedance2Call` (nebo wherever) se konvertuje do payloadu.
- **Luma `refWeights`**: array aligned s order v `videoRefs`. Default 0.85 (pokud nezměněný).

---

## 6. Fáze 6 — `loadVideoJobParamsToForm()` + reuseVideoJob refactor

Viz § 3.1 spec funkce. Klíč: všechno přes `params`, ne ad-hoc `meta.duration`, `meta.params.aspectRatio` atd.

**Kroky v nové `reuseVideoJob(id)`:**
1. Load `meta = await dbGet('video_meta', id)` + `fullRec = await dbGet('videos', id)` (pro refs)
2. Switch view: `switchView('gen'); setGenMode('video')`
3. Detect params shape: `_isOldParamsShape(meta.params)` → pokud ano, `params = _migrateOldParams(meta.params, meta.modelKey)`; jinak `params = meta.params`
4. Set model:
   ```js
   const modelSel = document.getElementById('videoModelSelect');
   const groupKey = Object.keys(KLING_GROUPS).find(gk =>
     KLING_GROUPS[gk].variants.some(v => v.key === meta.modelKey)
   );
   if (groupKey) {
     modelSel.value = groupKey;
     onVideoModelChange(groupKey);  // populuje vpModeSelect přes _vpApplyModeSelect
     document.getElementById('vpModeSelect').value = meta.modelKey;
     _applyVideoModel(meta.modelKey);
   } else {
     modelSel.value = meta.modelKey;
     onVideoModelChange(meta.modelKey);
   }
   ```
5. Apply params to UI: `loadVideoJobParamsToForm(params, meta.modelKey)`
6. Load refs (existing logic)
7. Toast "Video setup loaded"

**Seedance bug fix** je automatický side effect — nový flow je konzistentní, nezávislý na ad-hoc field list.

---

## 7. Fáze 7 — Handler refactor

10+ handlerů v `video-models.js` + `video-queue.js`:
- `callVeoVideo` (veo.js embedded v video-models.js)
- `callLumaVideo`
- `callKlingVideo`
- `callSeedanceVideo`, `callSeedance2Video`
- `callViduVideo`
- `callWan27Video`, `callWan26Video`
- `callPixverseVideo`
- `callGrokVideo`
- `runTopazQueueJob` (video-topaz.js)
- `runMagnificVideoUpscaleJob` (video-topaz.js)

**Každý handler aktuálně:**
1. Čte 10-30 `getElementById` z UI (třeba `lumaResolution`, `lumaLoop`, `lumaColorMode`)
2. Sestavuje payload pro API
3. Submituje, polluje, stahuje, ukládá

**Po refactoru:**
1. Dostává `job.params` (unified shape)
2. Sestavuje payload z `params.xxx` (ne z UI)
3. Zbytek beze změny

**Ukládání** — v `_saveVideoResult` volání:
```js
await _saveVideoResult(videoArrayBuffer, {
  model: model.name, modelKey, prompt,
  params: job.params,          // ← unified shape, zjednodušený call
  duration: params.duration,
  cdnUrl: ..., usedVideoRefs: ...,
}, job, spendArgs);
```

**KRITICKÉ u Kling:** handler používá `job.durationInt` (parsed) místo string — unified `params.duration` už je number.

**KRITICKÉ u WAN 2.7:** `duration` musí být integer (ne string). `params.duration` to garantuje.

**KRITICKÉ u Kling Video:** NIKDY `prompt: ""` — validovat před submit.

---

## 8. Fáze 8 — Testování + cleanup

### 8.1 Smoke test checklist (per model)

- [ ] **Veo 3.1** — T2V (no refs), I2V (1 ref start frame), Frames (start+end), Ingredients (3 refs)
- [ ] **Kling V3 Pro** — T2V, I2V, V2V (source video)
- [ ] **Kling O3 Pro** — I2V s 7 refs
- [ ] **Seedance 2.0** — T2V, I2V (start+end), R2V (multi-modal 4 refs), Fast
- [ ] **Seedance 2.0** audio URLs — 3 URL inputy funkční
- [ ] **Grok Video** — T2V, I2V, Ref2V (7 refs), Edit (source video), Extend
- [ ] **Luma Ray2/3** — T2V, I2V, loop, HDR modes
- [ ] **Luma** — 1 ref → 1 weight slider, 2 refs → 2 slidery, 3 refs → 3 slidery
- [ ] **Vidu Q3** — T2V, I2V, Frames
- [ ] **WAN 2.7** — T2V, I2V (source video), R2V, V2V (source video)
- [ ] **WAN 2.6** — T2V Multi-shot checkbox, I2V, R2V Flash
- [ ] **PixVerse C1** — T2V, I2V, Transition, Fusion (7 refs)
- [ ] **PixVerse V6** — Multi-clip, Off-peak
- [ ] **Topaz Precise 2.5** — source video, factor, fps, slowmo, creativity
- [ ] **Magnific Creative** — source video, sharpen, grain, prompt, creativity, flavor
- [ ] **Magnific Precision** — source video, strength

### 8.2 Reuse test (per model)
- Vygenerovat 1 video každou rodinou → `gallery` → reuse → **VŠECHNY** params musí být obnovené včetně model selection
- Explicitní test na **Seedance 2.0 reuse** (původní bug) — model pole musí být populate se Seedance 2.0 a správná varianta

### 8.3 Odstranění starých panelů
Teprve po úspěšném testování. Z `template.html` odstranit:
- lumaVideoParams, grokVideoParams, topazSrcRow, pixverseParams, magnificVidOpts, veoRefModeRow
- lumaHdrRow, lumaCharRefRow, lumaResRow, veoResRow, wanResRow, topazResRow
- topazFactorRow, topazFpsRow, topazSlowmoRow, topazCreativityRow
- videoAspectRow, videoCfgRow, videoDurRow, videoAudioCtrl, videoCountRow
- videoResInfoRow, videoRefSection, videoTagsRow, videoPromptSec
- klingVersionRow (už nahrazeno vpModeSection)

Odhad ~2000+ řádků odstraněných z template.html. Pak rebuild + final smoke test.

---

## 9. Moduly k fetch z GitHubu při startu session

**Vždy přes `web_fetch` raw URL, ne project_knowledge_search** (stale).

Base URL: `https://raw.githubusercontent.com/petrsajner/GIS-modules/main/`

**Povinné:**
- `STAV.md` — current state
- `SESSION_2_HANDOFF.md` — tento dokument
- `template.html` — unified panel + staré panely
- `video-models.js` — getVideoUi, VIDEO_MODELS, KLING_GROUPS, _applyVideoModel
- `video-queue.js` — generateVideo, _saveVideoResult, _videoPollLoop
- `video-gallery.js` — reuseVideoJob, VIDEO_SOURCE_SLOTS registry
- `video-topaz.js` — Topaz + Magnific handlers, shared helpers
- `video-utils.js` — _setRow, VIDEO_POLL, error helpers
- `build.js` — pro rebuild

**Volitelné (pokud potřeba):**
- `assets.js` — videoRefs, createAsset, dbGetAllAssetMeta
- `db.js` — dbGet/Put, schema
- `spending.js` — trackSpend

---

## 10. Session workflow recap

1. **Nejdřív přečíst STAV.md + SESSION_2_HANDOFF.md** (přes web_fetch blob URLs z GitHubu, NE `/mnt/project/`)
2. Stáhnout povinné moduly do `/home/claude/src/`
3. **Build ověření:** `cd /home/claude && node build.js 208en → dist/gis_v208en.html`, extract script, `node --check`
4. **Implementace Fáze 4 → syntax check → Fáze 5 → syntax check → ...**
5. Po každé Fázi: **full rebuild**, ověřit že `✓ HTML div balance` projde
6. Po Fázi 8: cleanup docs (STAV, DECISIONS, TODOs, CLEANUP_ANALYSIS)
7. Výstupy do `/mnt/user-data/outputs/`

**KRITICKÉ:**
- `/mnt/project/` je **VŽDY stale** — NIKDY nepoužívat, ani se nediv Petrovi
- Syntax check = **extracted script z HTML** (ne .js soubor zvlášť)
- Full build po každé větší změně (catch HTML div imbalances)

---

## 11. Gotchas z předchozích sessions (relevantní pro Session 2)

### Build + syntax
- `build.js` validuje HTML div balance — pokud chybí div, build hlásí error
- Syntax check extracted script: `awk '/<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' dist/gis_vNNNen.html > /tmp/check.mjs && node --check /tmp/check.mjs`

### HTML + CSS
- `display:none` na nested flex item + display:grid → fails (collapsing). Použít normální block.
- `position:absolute` váže se na nejbližší `position:relative` předka — zkontrolovat parent

### fal.ai / API
- fal.ai auth: `Key ${falKey}`, NE `Bearer`
- Kling Video: NIKDY prompt=""  (API vrací 422)
- WAN 2.7: duration integer, ne string
- GPT Image: mask field `mask_url` (GPT 2) vs `mask_image_url` (GPT 1.5)

### Database
- `video_meta` store = meta bez binary data (pro fast listing)
- `videos` store = full record s `videoData` ArrayBuffer
- Při reuse = load meta, ale refs potřebují full record (`usedVideoRefs` field)

### Globální stav
- `videoJobs` v video-queue.js, čteno i z video-gallery.js (globální scope funguje)
- Source video globals: `topazSrcVideoId`, `wan27SrcVideoId`, atd. (per-slot)
- `_grokVideoSrcId` v video-models.js (Petrovo rozhodnutí — model-specific)

### Audio
- Kling V3/V2 hasAudio: true → `generate_audio` field (NE `enable_audio`)
- Veo hasAudio: false v VIDEO_MODELS, ale audio se generuje AUTOMATICKY (Gemini API quirk)
- Pixverse: `generate_audio_switch` explicit bool

### Error handling (v206en guideline)
- Handlery throw RAW technické errory
- `videoJobError` → single entry-point pro friendly-ifikaci přes `friendlyVideoError`
- `_videoPollLoop` automaticky kontroluje `job.cancelled`

---

## 12. Realistický odhad Fáze 4-8

| Fáze | Odhad | Riziko |
|------|-------|--------|
| 4: `_applyVideoModel` refactor | 1.5-2 h | Střední (legacy panels + unified panel coexistence) |
| 5: buildVideoParams + generateVideo | 1-1.5 h | Nízké (jasná spec) |
| 6: loadVideoJobParamsToForm + reuseVideoJob | 1-1.5 h | Střední (backward compat logic) |
| 7: Handler refactor (10+ handlerů) | 2-3 h | Střední-vysoké (každý handler má quirks) |
| 8: Testování + cleanup | 1-2 h | Nízké |

**Celkem 6.5-10 hodin** / **10-15 turnů v jedné chat session**. Realistické očekávání: dvě chat sessions.

Pokud cítíš že se do jedné session nevejdeš, udělej checkpoint po Fázi 4 (panel aktivovaný, panel reaguje na modely, generate ještě nefunguje). To je bezpečný rollback bod: produkce nefunguje, ale build projde, Petr má feedback jak panel vypadá.

---

## 13. Co NEDĚLAT

- **NEodstraňovat** staré panely před úplným testováním Fáze 5-7
- **NEměnit** API payloady handlerů (ty jsou fine, jen refactor vstupu z `job.xxx` → `job.params.xxx`)
- **NEpřejmenovávat** HTML IDs mimo `vpXxx` pattern (zbytečný risk, wrappers-preserved pattern zůstává)
- **NEpřidávat** nové features (Style Library, Claid.ai, atd.) — to je po Session 2
- **NEzapomenout** na Veo audio quirk (hasAudio: false v model def, ale audio je auto-generated)

---

**Konec handoff dokumentu.** Když něco nejasného — Petr je tu a rád odpoví. Lepší zeptat se než špatně interpretovat.
