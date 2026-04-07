# GIS — ARCHITEKTURA
*Aktuální pro v184en · 7. 4. 2026*

---

## Přehled aplikace

Standalone HTML single-file app. Žádný server, žádná instalace. Otevírá se přímo v Chrome (`file://`). Veškerá data lokálně v IndexedDB.

**Technický stack:**
- Čistý HTML/CSS/JS (žádný framework)
- IndexedDB pro galerii, assets, thumbnaily a videa
- SSE streaming pro Gemini image generation
- fal.ai queue endpoint pro Kling Video a ostatní async modely
- fal.ai synchronní endpoint pro image modely a upscale
- Cloudflare Workers proxy pro xAI, Luma, Magnific, Topaz, Replicate — CORS bloky obejity
- **Modularizace:** 20 modulů + `build.js` → single-file HTML výstup

---

## Build struktura (v90+)

```
src/
├── template.html          ← HTML + CSS + placeholder // __GIS_JS__
├── models.js              ← MODELS, MODEL_DESCS, FAL_PRESETS, helpers
├── styles.js              ← STYLES systém, 80+ stylů
├── setup.js               ← API klíče (Google/fal/xAI/Luma/Freepik/Topaz/Replicate/OpenRouter)
├── spending.js            ← SPEND_PRICES, trackSpend, spending UI
├── model-select.js        ← selectModel(), switchView(), setGenMode(), rewritePromptForModel()
├── assets.js              ← asset library, pillarbox thumbs, assetFilters
├── refs.js                ← refs management, @mention (live rewriting), describe modal
├── generate.js            ← generate(), queue, runJob dispatch, withRetry
├── fal.js                 ← FLUX/Kling Image/SeeDream/ZImage/Qwen2
├── output-placeholder.js  ← placeholder karty, error karty (Reuse + Rerun)
├── proxy.js               ← xAI + Luma Photon + Replicate WAN 2.7 image
├── gemini.js              ← Gemini SSE streaming, Imagen, streamAccepted timeout
├── output-render.js       ← result renderers, upscale dialog (Creative + Precision)
├── db.js                  ← IndexedDB (obrazky + videa + assets)
├── gallery.js             ← image gallery, filtry, rubber band, drag-to-folder
├── toast.js               ← notifikace
├── paint.js               ← Paint + Annotate
├── ai-prompt.js           ← AI Prompt Tool — Claude Sonnet (OR) primární, Gemini 3.1 Pro fallback
└── video.js               ← Video modely, fronta, galerie, Topaz, video @mention rewriting
```

Build: `node build.js 184en` → `dist/gis_v184en.html`

---

## API klíče

Ukládány do localStorage, načítány v setup.js při `window.onload`:

```javascript
localStorage.getItem('gis_apikey')             // Google API key — NB2/NB1/NB Pro, Imagen, Veo
localStorage.getItem('gis_flux_apikey')        // fal.ai key — FLUX, Kling, SeeDream, Z-Image, Qwen2, Seedance, Vidu, Wan
localStorage.getItem('gis_xai_apikey')         // xAI key — Grok Imagine (přes proxy)
localStorage.getItem('gis_luma_apikey')        // Luma key — Photon, Photon Flash, Ray video (přes proxy)
localStorage.getItem('gis_freepik_apikey')     // Freepik key — Magnific Creative + Precision (přes proxy)
localStorage.getItem('gis_topaz_apikey')       // Topaz key — Starlight video/image upscale (přes proxy)
localStorage.getItem('gis_replicate_apikey')   // Replicate key — WAN 2.7 image (přes proxy)
localStorage.getItem('gis_openrouter_apikey')  // OpenRouter key — AI Prompt + Describe (Claude Sonnet 4.6)
localStorage.getItem('gis_proxy_url')          // Cloudflare Worker URL (default: gis-proxy.petr-gis.workers.dev)
```

---

## AI Prompt & Describe — model priorita (v184+)

```
OR klíč přítomen → anthropic/claude-sonnet-4-6 (OpenRouter) — primární
OR klíč chybí   → gemini-3.1-pro-preview (Google API)        — fallback
```

- **AI Prompt Tool** (Enhance, Chat, Variants, Random, Translate): `callGeminiText()` / `callGeminiTextMultiTurn()`
- **Describe** (✦ na referenci): `callGeminiDescribe()` + `_callOpenRouterVision()` — Claude podporuje vision

---

## Image generation — runJob dispatch

```javascript
// generate.js: addToQueue() → tryStartJobs() → runJob(job)

if      (job.isUpscale)                  → runUpscaleJob()        // fal.ai + Magnific + Topaz
else if (model.type === 'gemini')        → callGeminiStream()     // NB2/NB1/NB Pro
else if (model.type === 'imagen')        → callImagen()           // Imagen 4/Fast/Ultra
else if (model.type === 'flux')          → callFlux()             // FLUX.2 Pro/Flex/Max/Dev
else if (model.type === 'seedream')      → callSeedream()         // SeeDream 4.5/5 Lite
else if (model.type === 'kling')         → callKling()            // Kling Image V3/O3
else if (model.type === 'zimage')        → callZImage()           // Z-Image Base/Turbo
else if (model.type === 'qwen2')         → callQwen2()            // Qwen2 T2I/Edit
else if (model.type === 'wan27r')        → callReplicateWan27()   // WAN 2.7 image přes Replicate proxy
else if (model.type === 'proxy_xai')     → callProxyXaiMulti()    // Grok Imagine přes Worker
else if (model.type === 'proxy_luma')    → callProxyLuma()        // Luma Photon přes Worker
```

### Upscale dispatch (output-render.js)
```javascript
if (mode === 'magnific' && magMode === 'precision') → runMagnificPrecisionJob()
else if (mode === 'magnific')                       → runMagnificUpscaleJob()
else if (mode === 'topaz_gigapixel'/'topaz_bloom')  → runTopazImageUpscaleJob()
else                                                → runFalUpscaleJob()        // Crisp/SeedVR2/Clarity
```

### Gemini retry logika (v184+)
```javascript
// withRetry: 3× pro 503/529/429, 3s delay
// job.streamAccepted = true → po přijetí HTTP response → neretrykuje
// 10min stream deadline v callGeminiStream while loop
// _updatePendingCardsStatus() — zobrazí retry stav na placeholder kartě
```

---

## Video generation — dispatch

```javascript
// video.js: generateVideo() → runVideoJob(job)

if (TOPAZ_MODELS[activeKey])  → _generateTopazJob()
model.type === 'veo'          → callVeoVideo()
model.type === 'luma_video'   → callLumaVideo()         // přes proxy
model.type === 'wan27_video'  → callWan27Video()        // fal.ai queue
model.type === 'wan27e_video' → callWan27eVideo()       // fal.ai queue (Video Edit)
model.type === 'kling_video'  → fal.ai queue submit + poll
model.type === 'seedance_video' → fal.ai queue
model.type === 'vidu_video'   → fal.ai queue
model.type === 'wan_video'    → fal.ai queue            // WAN 2.6
model.type === 'topaz_video'  → runTopazQueueJob()
```

### Video prompt optional (v184+)
```javascript
// promptOptional = true pokud:
veoFramesMode  // Veo v "frames" módu
|| (model.type !== 'luma_video' && model.type !== 'kling_video' &&
    refMode ∈ {single_end, single, keyframe, wan_r2v, multi})
// Luma a Kling vždy vyžadují prompt
// Kling payload: prompt field vynechán pokud prázdný (API odmítá "" empty string)
```

---

## @Mention live rewriting architektura (v184+)

### Image modely (refs.js + model-select.js)
```javascript
// Canonical forma: @UserLabel (@Ref_031, @Ref_030)
// Model-specific forma: @Image1 (Kling/FLUX), Figure 1 (SeeDream), image 1 (Gemini)

preprocessPromptForModel(prompt, refs, modelType)    // canonical → model
promptModelToUserLabels(prompt, refs, modelType)     // model → canonical (reverzní)
rewritePromptForModel(prevType, newType)             // přepíše textarea při přepnutí

// Hooky:
// - selectModel() → rewritePromptForModel(prevType, newType)
// - renderRefThumbs() → rewritePromptForModel(m.type, m.type) [re-číslování]

// Mention dropdown: model-specific jméno jako primární, user label jako subtitle
```

### Video modely (video.js)
```javascript
// refModes s @mentions: 'multi' (@Element1, @Element2) | 'wan_r2v' (Character1, bez @)
videoPromptModelToUserLabels(prompt, refs, prevM)
videoPromptUserLabelsToModel(prompt, refs, newM)
rewriteVideoPromptForModel(prevM, newM)

// _prevVideoModelKey — ukládá key před přepnutím (onchange vrátí nový)
// _videoModelSwitching — guard zabraňuje dvojitému rewrite z renderVideoRefPanel

// Hooky:
// - onVideoModelChange() → rewriteVideoPromptForModel(prevM, newM)
// - onKlingVersionChange() → rewriteVideoPromptForModel(prevM, newM)
// - renderVideoRefPanel() → rewriteVideoPromptForModel(m, m) [re-číslování, pouze !_videoModelSwitching]
```

---

## Error karty architektura (v184+)

### Image error karty (output-placeholder.js)
```javascript
showErrorPlaceholder(cardEl, job, msg)
// → přepíše placeholder na error kartu:
//    - červený banner: icon + friendlyError(msg)
//    - err-meta-row: modelName + param chips (AR, resolution, tier, count, seed)
//    - err-prompt: job.rawPrompt || job.prompt (plný text)
//    - err-refs: ref thumbnails (data:mimeType;base64,thumb)
//    - err-btns: [↺ Reuse] + [▶ Rerun]

rerunJob(cardKey)         // okamžitě re-queue se stejnými parametry, nové ID
reuseTimedOutJob(cardKey) // loadJobParamsToForm() → formulář pro review

friendlyError(raw)        // přeloží technické chyby na čitelné zprávy
```

### Video error karty (video.js)
```javascript
videoJobError(job, msg)
// → přepíše video placeholder na error kartu (stejný styl)
//    - friendlyVideoError(msg) — video-specifické překlady + deleguje na friendlyError
//    - chips: duration + resolution
//    - ref thumbnails z job.videoRefsSnapshot

rerunVideoJob(jobId)       // okamžitý rerun
reuseVideoJob_err(jobId)   // obnoví prompt + model do formuláře
```

---

## Proxy architektura

```
GIS (browser, file://) → Cloudflare Worker (gis-proxy.petr-gis.workers.dev) → Provider API
```

### Proxy routes (v2026-09 + luma fix)

| Route | Provider | Flow |
|-------|----------|------|
| POST /xai/generate | xAI Grok | sync |
| POST /luma/generate + /status | Luma Photon image | submit+poll |
| POST /luma/video/submit + /status | Luma Ray video — **keyframes přes R2** | submit+poll |
| POST /magnific/upscale + /status | Magnific Creative | submit+poll |
| POST /magnific/precision + /status | Magnific Precision V1/V2 | submit+poll |
| POST /fal/submit + /status + /result | fal.ai queue | CORS bypass |
| POST /topaz/video/submit + /status + /download | Topaz video | stream |
| POST /topaz/image/submit + /status + /download | Topaz image | stream |
| POST /replicate/wan27/submit + /status | Replicate WAN 2.7 image | submit+poll |
| POST /r2/upload | R2 binary storage | store+return URL |
| GET /r2/serve/{key} | R2 binary serving | stream |
| POST /magnific/video-cleanup | R2 full cleanup | fire-and-forget |

### Luma keyframe upload (v184+)
```
Starý flow (nefunkční — /file_uploads vrátí 404):
  GIS base64 → Worker → POST /dream-machine/v1/file_uploads → Luma CDN URL → generation API

Nový flow:
  GIS base64 → Worker → R2 bucket (luma_kf_{ts}_{rand}.jpg) → /r2/serve/{key} URL → generation API
```

---

## R2 Bucket Architecture

**Bucket:** `gis-magnific-videos` · Binding: `VIDEOS`

**Kdo používá:**
| Model | Upload flow |
|-------|------------|
| Magnific Video Upscale | GIS base64 → JSON → Worker Buffer.from() → R2 |
| Kling V2V Motion Control | GIS File object → raw binary → R2 |
| Luma Ray video keyframes | Worker base64 → R2 (nový v184) |

---

## Magnific Upscale architektura

### Creative mode
- Endpoint: `/v1/ai/image-upscaler`
- Engine: magnific_sparkle / magnific_sharpy / magnific_illusio

### Precision mode (v181+)
- **V2**: `/v1/ai/image-upscaler-precision-v2` — flavor + scale_factor + sharpen/grain/detail
- **V1**: `/v1/ai/image-upscaler-precision` — bez scale_factor/flavor

---

## Spending Tracker

```javascript
trackSpend(provider, priceKey, count = 1, durationSeconds = null)
// provider: 'google' | 'fal' | 'xai' | 'luma' | 'freepik' | 'topaz' | 'replicate'
```

---

## Refs architektura

```javascript
// refs[] a videoRefs[] — asset linky, žádná inline data
{ assetId, autoName, userLabel, mimeType, thumb, dims }

// getRefDataForApi(ref, maxPx) — načte imageData on-demand z IndexedDB
```

---

## Kritické gotchas (implementační)

```javascript
// generateThumb — mimeType POVINNÝ
generateThumb(imageData, mimeType)  // ✓

// setAspectRatioSafe — VŽDY místo přímého .value
setAspectRatioSafe('16:9')  // ✓

// fal.ai API klíč — správné ID elementu
document.getElementById('fluxApiKey').value  // ✓ (ne 'falApiKey')

// fal.ai auth header
'Authorization': `Key ${falKey}`  // ✓ (ne Bearer)

// Kling video — prázdný prompt VYNECHAT (ne poslat "")
if (prompt) payload.prompt = prompt;  // ✓

// addToQueue count — VŽDY přidat nový snap count
job.wan27Snap?.count  // ← nutno přidat pro každý nový model

// Gemini streamAccepted — nesmí se resetovat v retryi po přijetí response
// Video @mention prevM — VŽDY číst _prevVideoModelKey, ne getActiveVideoModelKey() (ten vrátí nový)

// Luma keyframe upload — /file_uploads endpoint je 404 → použít R2 přes Worker
```
