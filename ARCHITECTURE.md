# GIS — ARCHITEKTURA
*Aktuální pro v181en · 5. 4. 2026*

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
- **Modularizace:** 19 modulů + `build.js` → single-file HTML výstup

---

## Build struktura (v90+)

```
src/
├── template.html          ← HTML + CSS + placeholder // __GIS_JS__
├── models.js              ← MODELS, MODEL_DESCS, FAL_PRESETS, helpers
├── styles.js              ← STYLES systém, 80+ stylů
├── setup.js               ← API klíče (Google/fal/xAI/Luma/Freepik/Topaz/Replicate)
├── spending.js            ← SPEND_PRICES, trackSpend, spending UI
├── model-select.js        ← selectModel(), switchView(), setGenMode(), onWan27SizeChange()
├── assets.js              ← asset library, pillarbox thumbs, assetFilters
├── refs.js                ← refs management, @mention, describe modal
├── generate.js            ← generate(), queue, runJob dispatch
├── fal.js                 ← FLUX/Kling Image/SeeDream/ZImage/Qwen2
├── output-placeholder.js  ← placeholder karty při generování
├── proxy.js               ← xAI + Luma Photon + Replicate WAN 2.7 image
├── gemini.js              ← Gemini SSE streaming, Imagen
├── output-render.js       ← result renderers, upscale dialog (Creative + Precision)
├── db.js                  ← IndexedDB (obrazky + videa + assets)
├── gallery.js             ← image gallery, filtry, rubber band, drag-to-folder
├── toast.js               ← notifikace
├── paint.js               ← Paint + Annotate
├── ai-prompt.js           ← AI Prompt Tool (5 tabů, aiBuffer)
└── video.js               ← Video modely, fronta, galerie, Topaz, WAN 2.7 I2V
```

Build: `node build.js 181en` → `dist/gis_v181en.html`

---

## API klíče

Ukládány do localStorage, načítány v setup.js při `window.onload`:

```javascript
localStorage.getItem('gis_apikey')           // Google API key — NB2, NB Pro, Imagen, Veo, Describe
localStorage.getItem('gis_flux_apikey')      // fal.ai key — FLUX, Kling, SeeDream, Z-Image, Qwen2, Seedance, Vidu, Wan 2.6
localStorage.getItem('gis_xai_apikey')       // xAI key — Grok Imagine (přes proxy)
localStorage.getItem('gis_luma_apikey')      // Luma key — Photon, Photon Flash, Ray video (přes proxy)
localStorage.getItem('gis_freepik_apikey')   // Freepik key — Magnific Creative + Precision (přes proxy)
localStorage.getItem('gis_topaz_apikey')     // Topaz key — Starlight video/image upscale (přes proxy)
localStorage.getItem('gis_replicate_apikey') // Replicate key — WAN 2.7 image + I2V (přes proxy)
localStorage.getItem('gis_proxy_url')        // Cloudflare Worker URL (default: gis-proxy.petr-gis.workers.dev)
```

---

## Image generation — runJob dispatch

```javascript
// generate.js: addToQueue() → tryStartJobs() → runJob(job)

if      (job.isUpscale)                  → runUpscaleJob()        // fal.ai + Magnific + Topaz
else if (model.type === 'gemini')        → callGeminiStream()     // NB2, NB Pro
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
// runUpscaleJob(job)
if (mode === 'magnific' && magMode === 'precision') → runMagnificPrecisionJob()
else if (mode === 'magnific')                       → runMagnificUpscaleJob()   // Creative
else if (mode === 'topaz_gigapixel'/'topaz_bloom')  → runTopazImageUpscaleJob()
else                                                → runFalUpscaleJob()        // Crisp/SeedVR2/Clarity
```

Paralelismus: fal.ai = max 4 concurrent. Gemini/Imagen/Replicate = 1 concurrent.

addToQueue count expression (VŠECHNY model snap count fields musí být přidány):
```javascript
const count = job.geminiCount || job.fluxCount || job.sdCount || job.klingCount
            || job.zimageCount || job.qwen2Count
            || job.wan27Snap?.count          // ← WAN 2.7 image
            || job.xaiSnap?.grokCount
            || job.imagenSnap?.sampleCount || 1;
```

---

## Video generation — dispatch

```javascript
// video.js: generateVideo() → runVideoJob(job)

if (TOPAZ_MODELS[activeKey])
  → _generateTopazJob()     // Topaz video upscale

// Pro normální video modely: runVideoJob(job)
model.type === 'veo'          → callVeoVideo()     // Gemini predictLongRunning
model.type === 'luma_video'   → callLumaVideo()    // přes proxy
model.type === 'wan27_video'  → callWan27Video()   // Replicate přes proxy (WAN 2.7 I2V)
model.type === 'kling_video'  → fal.ai queue submit + poll
model.type === 'seedance_video' → fal.ai queue
model.type === 'vidu_video'   → fal.ai queue
model.type === 'wan_video'    → fal.ai queue       // WAN 2.6
model.type === 'topaz_video'  → runTopazQueueJob() // background, non-blocking
```

---

## Proxy architektura

```
GIS (browser, file://) → Cloudflare Worker (gis-proxy.petr-gis.workers.dev) → Provider API
```

**Pravidlo CF Worker (30s wall-clock limit):**
- Worker nikdy nepolluje. Vždy odpoví do 5s.
- Submit endpoint: pošle job → vrátí ID
- Status endpoint: jeden GET → vrátí stav
- Polling loop běží v GIS (browser, žádný limit)

**Výjimka — Topaz download:** Worker streamuje video z R2 zpět na browser.

### Proxy routes (v2026-07)

| Route | Provider | Flow |
|-------|----------|------|
| POST /xai/generate | xAI Grok | sync |
| POST /luma/generate + /status | Luma Photon image | submit+poll |
| POST /luma/video/submit + /status | Luma Ray video | submit+poll |
| POST /magnific/upscale + /status | Magnific Creative | submit+poll |
| POST /magnific/precision + /status | Magnific Precision V1/V2 | submit+poll |
| POST /fal/submit + /status + /result | fal.ai queue | CORS bypass |
| POST /topaz/video/submit + /status + /download | Topaz video | stream |
| POST /topaz/image/submit + /status + /download | Topaz image | stream |
| POST /replicate/wan27/submit + /status | Replicate WAN 2.7 image | submit+poll |
| POST /replicate/wan27v/submit + /status | Replicate WAN 2.7 I2V | submit+poll |

### Magnific status — upscaler_type routing
```javascript
// handleMagnificStatus (magnific.js)
// Body: { freepik_key, task_id, upscaler_type }
upscaler_type === 'creative'      → /v1/ai/image-upscaler/{task_id}
upscaler_type === 'precision-v1'  → /v1/ai/image-upscaler-precision/{task_id}
upscaler_type === 'precision-v2'  → /v1/ai/image-upscaler-precision-v2/{task_id}
```

### Replicate API pattern
```javascript
// Auth: Authorization: Bearer {token}
// Submit: POST https://api.replicate.com/v1/models/{owner}/{model}/predictions
// Poll:   GET  https://api.replicate.com/v1/predictions/{id}
// Output (image): output[] array of URLs
// Output (I2V):   output single URL string
// CORS: blokováno → vždy přes proxy
```

---

## Magnific Upscale architektura (v181+)

### Creative mode (původní)
- Endpoint: `/v1/ai/image-upscaler`
- Engine: magnific_sparkle / magnific_sharpy / magnific_illusio
- Scale: 2x / 4x / 8x / 16x
- Params: optimized_for, prompt, creativity, hdr, resemblance, fractality

### Precision mode (v181+)
- **V2 versions** (v2_sublime / v2_photo / v2_photo_denoiser):
  - Endpoint: `/v1/ai/image-upscaler-precision-v2`
  - flavor: `sublime` | `photo` | `photo_denoiser`
  - scale_factor: integer 2–16
  - Params: sharpen (0–100, def 7), smart_grain (0–100, def 7), ultra_detail (0–100, def 30)
- **V1** (v1_hdr):
  - Endpoint: `/v1/ai/image-upscaler-precision`
  - Bez scale_factor, bez flavor
  - Params: sharpen (0–100, def 50), smart_grain (0–100, def 7), ultra_detail (0–100, def 30)

### UI (output-render.js)
```
[Creative]  [Precision]     ← toggle tabs
Creative panel:  Scale + Engine + Optimized for (radio) + Prompt + sliders
Precision panel: Version (4 radio) + Scale (skryto pro V1) + Sharpen/Grain/Detail
```

---

## Spending Tracker

```javascript
// spending.js
trackSpend(provider, priceKey, count = 1, durationSeconds = null)
// provider: 'google' | 'fal' | 'xai' | 'luma' | 'freepik' | 'topaz' | 'replicate'
// Ukládá do localStorage: { amount, periodStart }

// Replicate ceny:
'wan-video/wan-2.7-image':   0.030   // per image
'_replicate_wan27v_720p':    0.10    // per second (720p I2V)
'_replicate_wan27v_1080p':   0.15    // per second (1080p I2V)
```

---

## Refs architektura (v102+)

```javascript
// refs[] a videoRefs[] — asset linky, žádná inline data
{ assetId, autoName, userLabel, mimeType, thumb, dims }

// getRefDataForApi(ref, maxPx) — načte imageData on-demand z IndexedDB
// maxPx: 'setting' = dle checkboxu | číslo = hard limit | null = bez omezení

// usedVideoRefs v videos store — s imageData pro odolnost
{ assetId, mimeType, autoName, userLabel, imageData }
```

---

## Kritické gotchas (implementační)

```javascript
// generateThumb — mimeType POVINNÝ
generateThumb(imageData, mimeType)  // ✓
generateThumb(imageData)            // ✗ JPEG selhání na file://

// setAspectRatioSafe — VŽDY místo přímého .value
setAspectRatioSafe('16:9')          // ✓

// fal.ai API klíč — správné ID elementu
document.getElementById('fluxApiKey').value  // ✓
document.getElementById('falApiKey').value   // ✗ null → tichý fail

// fal.ai auth header
'Authorization': `Key ${falKey}`    // ✓
'Authorization': `Bearer ${falKey}` // ✗

// Replicate auth header
'Authorization': `Bearer ${replicateKey}`  // ✓

// WAN 2.7 I2V output — single string, ne array
const videoUrl = typeof output === 'string' ? output : output?.[0]; // safe

// Veo — generateAudio se NEPOSÍLÁ (způsobí 400)

// Topaz: requestId (malé d), download.url (nested)

// addToQueue count — VŽDY přidat nový snap count
job.wan27Snap?.count   // ← nutno přidat pro každý nový model

// Magnific Precision — magMode='precision' musí být v job objektu
// runUpscaleJob() testuje job.magMode === 'precision' před dispatch

// Magnific status — vždy posílat upscaler_type ('creative'/'precision-v1'/'precision-v2')
// handleMagnificStatus v proxy routuje podle tohoto pole
```
