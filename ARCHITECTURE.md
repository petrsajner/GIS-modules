# GIS — ARCHITEKTURA
*Aktuální pro v198en · 13. 4. 2026*

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
├── models.js              ← MODELS, MODEL_DESCS, FAL_PRESETS, helpers, GIS_COPYRIGHT
├── styles.js              ← STYLES systém, 80+ stylů
├── setup.js               ← API klíče, getProxyUrl(), _arrayBufferToBase64() utilities
├── spending.js            ← SPEND_PRICES, trackSpend, spending UI
├── model-select.js        ← selectModel(), switchView(), setGenMode(), rewritePromptForModel()
├── assets.js              ← asset library, pillarbox thumbs, assetFilters
├── refs.js                ← refs management, @mention (live rewriting), describe modal
├── generate.js            ← generate(), queue, runJob dispatch, withRetry
├── fal.js                 ← FLUX/Kling Image/SeeDream/ZImage/Qwen2, _runSimpleInpaint, inpaint, _refAsJpeg(maxArea)
├── output-placeholder.js  ← placeholder karty, error karty (Reuse + Rerun)
├── proxy.js               ← xAI + Luma Photon + Replicate WAN 2.7 image
├── gemini.js              ← Gemini SSE streaming, Imagen, streamAccepted timeout
├── output-render.js       ← renderOutput(), result renderers, upscale dialog (Creative + Precision), _toJpeg(), pre-flight checks
├── db.js                  ← IndexedDB (obrazky + videa + assets)
├── gallery.js             ← image gallery, filtry, rubber band, drag-to-folder
├── toast.js               ← notifikace
├── paint.js               ← Paint + Annotate + Inpaint (queue, models, composite)
├── ai-prompt.js           ← AI Prompt Tool — Claude Sonnet (OR) primární, Gemini 3.1 Pro fallback
└── video.js               ← Video modely, fronta, galerie, Topaz, Magnific, @mention rewriting
```

Build: `node build.js 190en` → `dist/gis_v190en.html`

---

## Sdílené utility (setup.js, v190+)

```javascript
getProxyUrl()                      // → proxy base URL (z localStorage, s fallback)
_arrayBufferToBase64(buffer)       // → base64 string (chunk-safe pro velká videa)
```

Používáno napříč: fal.js, video.js, output-render.js — nahrazuje 6× opakovanou proxy konstrukci a 4× chunk-encoding pattern.

---

## API klíče

Ukládány do localStorage, načítány v setup.js při `window.onload`:

```javascript
localStorage.getItem('gis_apikey')             // Google API key
localStorage.getItem('gis_flux_apikey')        // fal.ai key
localStorage.getItem('gis_xai_apikey')         // xAI key
localStorage.getItem('gis_luma_apikey')        // Luma key
localStorage.getItem('gis_freepik_apikey')     // Freepik key
localStorage.getItem('gis_topaz_apikey')       // Topaz key
localStorage.getItem('gis_replicate_apikey')   // Replicate key
localStorage.getItem('gis_openrouter_apikey')  // OpenRouter key — Claude Sonnet 4.6
localStorage.getItem('gis_proxy_url')          // Cloudflare Worker URL (accessed via getProxyUrl())
```

---

## ⚠ AI Agent Architecture — FUNDAMENTAL RULE (v184+)

**OpenRouter (Claude Sonnet 4.6) is the PRIMARY AI agent for ALL tool features.**
Gemini Flash/Pro is ONLY a fallback when OpenRouter API key is missing.

This applies to: Edit Tool, Describe, AI Prompt, Special Tools (Character Sheet, etc.).

**Never default to Gemini when implementing new agent features.** Always use `_callOpenRouterVision` / `_callOpenRouterText` as primary, with Gemini as `else` fallback.

```
OR klíč přítomen → anthropic/claude-sonnet-4-6 (OpenRouter) — PRIMÁRNÍ
OR klíč chybí   → gemini-3.1-pro-preview (Google API)        — fallback
```

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
else if (model.type === 'proxy_mystic')  → callProxyMystic()      // Freepik Mystic přes Worker
else if (model.type === 'proxy_freepik_edit') → callProxyFreepikEdit() // Freepik Edit přes Worker
```

### Upscale dispatch (output-render.js)
```javascript
if (mode === 'magnific' && magMode === 'precision') → runMagnificPrecisionJob()
else if (mode === 'magnific')                       → runMagnificUpscaleJob()
else if (mode === 'topaz_gigapixel'/'topaz_bloom')  → runTopazImageUpscaleJob()
else                                                → runFalUpscaleJob()  // Crisp/SeedVR2/Clarity
```

### Upscale pre-flight checks (output-render.js, v197+)
```javascript
// Pre-flight před vytvořením jobu — modální dialog, ne error karta
if (mode === 'crisp')   → w*h > 4194304 (4 MP)        → showApiKeyWarning(⬆)
if (mode === 'clarity') → outMP > 25                    → showApiKeyWarning(⬆)
if (mode === 'seedvr')  → inputMP > 64                  → showApiKeyWarning(⬆)
```

### _toJpeg helper (output-render.js, v197+)
```javascript
// Canvas-based PNG→JPEG konverze pro Recraft Crisp (file size limit 5 MB)
function _toJpeg(b64png, quality = 1.0) → Promise<base64_jpeg_string>
// Progresivní kvalita: [0.92, 0.85, 0.75] — první pod 5 MB se použije
```

### _compressRefToJpeg — maxArea parametr (fal.js, v197+)
```javascript
// Area-based downscale pro Qwen 2 Edit (4 MP limit)
async function _compressRefToJpeg(apiRef, maxDim = null, maxArea = null)
// maxDim: longest side cap (e.g. 3840 pro Kling)
// maxArea: total pixel area cap (e.g. 4194304 pro Qwen 2)
// Scale: sqrt(maxArea / (w*h)) — zachovává aspect ratio

async function _refAsJpeg(ref, maxPx, maxDim = null, maxArea = null)
// Drop-in replacement s JPEG + dimension + area limiting
```

### renderOutput dispatch (output-render.js, v190+)
```javascript
// Přesunut z fal.js do output-render.js v v190en
if (result.type === 'gemini') → renderGeminiOutput()
else                          → renderImagenOutput()
```

---

## Video generation — dispatch

```javascript
// video.js: generateVideo() → runVideoJob(job)

if (TOPAZ_MODELS[activeKey])    → _generateTopazJob()      → runTopazQueueJob()
if (MAGNIFIC_VIDEO_MODELS[key]) → _generateMagnificVideoJob() → runMagnificVideoUpscaleJob()
model.type === 'veo'            → callVeoVideo()            // Google API polling
model.type === 'luma_video'     → callLumaVideo()           // Worker proxy polling
model.type === 'wan27_video'    → callWan27Video()          // fal.ai queue via _falVideoSubmitPollDownload
model.type === 'wan27e_video'   → callWan27eVideo()         // fal.ai queue via _falVideoSubmitPollDownload
model.type === 'kling_video'    → runVideoJob() inline      // fal.ai queue via _falVideoSubmitPollDownload
model.type === 'seedance_video' → runVideoJob() inline      // fal.ai queue via _falVideoSubmitPollDownload
model.type === 'vidu_video'     → runVideoJob() inline      // fal.ai queue via _falVideoSubmitPollDownload
model.type === 'wan_video'      → runVideoJob() inline      // fal.ai queue via _falVideoSubmitPollDownload
model.type === 'topaz_video'    → runTopazQueueJob()        // Topaz via proxy polling
```

---

## Video shared helpers (v190+)

### _falVideoSubmitPollDownload (video.js)
```javascript
// Sdílený submit→poll→download pro fal.ai video queue
// Používáno: runVideoJob, callWan27Video, callWan27eVideo
async function _falVideoSubmitPollDownload(falKey, endpoint, payload, job, opts)
// opts: { label, timeoutMin, pollMs, progressLabel }
// Returns: videoArrayBuffer (ArrayBuffer)
```

### _saveVideoResult (video.js)
```javascript
// Sdílený save-to-DB + UI cleanup pro všechny video handlery
// Používáno: callVeoVideo, runVideoJob, callLumaVideo, callWan27Video,
//            callWan27eVideo, runMagnificVideoUpscaleJob, runTopazQueueJob
async function _saveVideoResult(videoArrayBuffer, recordFields, job, spendArgs)
// Automaticky: generateVideoThumb, _topazGetDims, _parseMp4Fps
//              dbPut(videos + video_meta + video_thumbs), trackSpend
//              renderVideoQueue, removeVideoPlaceholder, renderVideoResultCard
// Returns: { videoId, elapsed, thumbData }
```

### _extractFalVideoUrl (video.js)
```javascript
// Extrahuje video URL z různých fal.ai response formátů
function _extractFalVideoUrl(obj)
// Zkouší: obj.output.video.url, obj.output.url, obj.video.url, obj.data.video.url
```

### Video source slot system (video.js, v190+)
```javascript
// Generické helpery pro source video panely (Topaz, WAN27e, WAN27v, V2V)
_srcSlotClear(ids)                    // Reset panel — hide thumb/buttons, set "None selected"
_srcSlotSet(ids, videoId)             // Load meta+thumb from DB, show info+chips+buttons
_srcSlotDescribe(imgId)               // Open describe modal from thumbnail

// ID config objekty (DOM element ID mapy):
_topazIds  = { info, thumb, img, meta, clearBtn, describeBtn }
_wan27eIds = { ... }
_wan27vIds = { ... }
_v2vIds    = { ... }

// Pojmenované funkce = thin wrappers (voláno z template.html onclick):
topazClearSource() → _srcSlotClear(_topazIds)
topazSetSource(id) → _srcSlotSet(_topazIds, id) + FPS detekce
wan27eClearSource() → _srcSlotClear(_wan27eIds)
// ... atd.
```

---

## Inpaint architektura (v190+)

### Aktivní modely + dispatch (paint.js)
```javascript
// paint.js: addToInpaintQueue() → _processInpaintQueue()
if (modelSel === 'flux_fill')    → callFluxFill()              // fal.js — unique signature
else if (modelSel === 'flux_dev')  → callFluxDevInpaint()      // fal.js → _runSimpleInpaint wrapper
else if (modelSel === 'flux_krea') → callFluxKreaInpaint()     // fal.js → _runSimpleInpaint wrapper
else                               → callFluxGeneralInpaint()  // fal.js — ControlNet/ref, via proxy
```

### _runSimpleInpaint (fal.js, v190+)
```javascript
// Generická inpaint funkce — sdílená logika pro jednoduché modely
async function _runSimpleInpaint(apiKey, endpoint, label, params, onStatus, signal, extraPayload)
// Vstup: image_url + mask_url + prompt + steps/guidance/strength/seed
// Výstup: { base64, mimeType, width, height }
// callFluxDevInpaint a callFluxKreaInpaint jsou 1-řádkové wrappery
```

---

## @Mention live rewriting architektura (v184+)

### Image modely (refs.js + model-select.js)
```javascript
preprocessPromptForModel(prompt, refs, modelType)    // canonical → model
promptModelToUserLabels(prompt, refs, modelType)     // model → canonical
rewritePromptForModel(prevType, newType)             // přepíše textarea
```

### Video modely (video.js)
```javascript
videoPromptModelToUserLabels(prompt, refs, prevM)    // model → canonical
videoPromptUserLabelsToModel(prompt, refs, newM)     // canonical → model
rewriteVideoPromptForModel(prevM, newM)              // přepíše textarea
```

---

## Error karty architektura (v184+)

### Image error karty (output-placeholder.js)
```javascript
showErrorPlaceholder(cardEl, job, msg)
rerunJob(cardKey)         // okamžitě re-queue
reuseTimedOutJob(cardKey) // loadJobParamsToForm()
friendlyError(raw)        // přeloží technické chyby
```

### Video error karty (video.js)
```javascript
videoJobError(job, msg)
rerunVideoJob(jobId)       // okamžitý rerun
reuseVideoJob_err(jobId)   // obnoví prompt + model
friendlyVideoError(msg)    // video-specifické překlady + deleguje na friendlyError
```

---

## Proxy architektura

```
GIS (browser, file://) → Cloudflare Worker (gis-proxy.petr-gis.workers.dev) → Provider API
```

### Proxy routes (v2026-10)

| Route | Provider | Flow |
|-------|----------|------|
| POST /xai/generate | xAI Grok | sync |
| POST /luma/generate + /status | Luma Photon image | submit+poll |
| POST /luma/video/submit + /status | Luma Ray video — keyframes přes R2 | submit+poll |
| POST /magnific/upscale + /status | Magnific Creative | submit+poll |
| POST /magnific/precision + /status | Magnific Precision V1/V2 | submit+poll |
| POST /magnific/video-upscale + /status | Magnific Video | submit+poll |
| POST /fal/submit + /status + /result | fal.ai queue | CORS bypass |
| POST /topaz/video/submit + /status + /download | Topaz video | stream |
| POST /topaz/image/submit + /status + /download | Topaz image | stream |
| POST /replicate/wan27i/submit + /status | Replicate WAN 2.7 image | submit+poll |
| POST /r2/upload | R2 binary storage | store+return URL |
| GET /r2/serve/{key} | R2 binary serving | stream |
| POST /magnific/video-cleanup | R2 full cleanup | fire-and-forget |
| POST /depth | Depth Anything v2 via fal.ai | CORS bypass |

---

## R2 Bucket Architecture

**Bucket:** `gis-magnific-videos` · Binding: `VIDEOS`

**Kdo používá:**
| Model | Upload flow |
|-------|------------|
| Magnific Video Upscale | GIS base64 → JSON → Worker Buffer.from() → R2 |
| Kling V2V Motion Control | GIS File object → raw binary → R2 |
| Luma Ray video keyframes | Worker base64 → R2 |

---

## Storage architektura

### IndexedDB (DB v5)
```
images       — full image data + metadata
images_meta  — metadata only (for fast gallery listing)
thumbs       — image thumbnails (separate store for memory efficiency)
assets       — ref images (full resolution)
videos       — full video data (ArrayBuffer) + metadata
video_meta   — video metadata only (fast listing)
video_thumbs — video first-frame thumbnails
videoFolders — video folder definitions
```

### Refs architektura (v102+)
```javascript
// refs[] a videoRefs[] — asset linky, žádná inline data
{ assetId, autoName, userLabel, mimeType, thumb, dims }

// getRefDataForApi(ref, maxPx) — načte imageData on-demand z IndexedDB
```

---

## Spending Tracker

```javascript
trackSpend(provider, priceKey, count = 1, durationSeconds = null)
// provider: 'google' | 'fal' | 'xai' | 'luma' | 'freepik' | 'topaz' | 'replicate'
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

// Proxy URL — vždy přes getProxyUrl() (v190+)
const proxyUrl = getProxyUrl();  // ✓ (ne localStorage.getItem přímo)

// ArrayBuffer → base64 — vždy přes _arrayBufferToBase64() (v190+)
const b64 = _arrayBufferToBase64(buffer);  // ✓ (ne manuální chunk loop)

// Kling video — prázdný prompt VYNECHAT (ne poslat "")
if (prompt) payload.prompt = prompt;  // ✓

// addToQueue count — VŽDY přidat nový snap count
job.wan27Snap?.count  // ← nutno přidat pro každý nový model

// Upscale pendingCards — MUSÍ být nastaveno (v197+ fix)
if (!job.pendingCards) job.pendingCards = [cardEl];  // ✓ (jinak error karta se nezobrazí)

// Nový inpaint model — použij _runSimpleInpaint (v190+)
callMyNewInpaint = (k, p, s, sig) => _runSimpleInpaint(k, 'fal-ai/new-model/inpainting', 'New Model', p, s, sig);

// Video save — vždy přes _saveVideoResult (v190+)
await _saveVideoResult(videoArrayBuffer, { model, modelKey, prompt, params, duration, ... }, job, spendArgs);

// fal.ai video queue — vždy přes _falVideoSubmitPollDownload (v190+)
const buf = await _falVideoSubmitPollDownload(falKey, endpoint, payload, job, { label, timeoutMin });

// Video source slot — vždy přes _srcSlotClear/_srcSlotSet (v190+)
// Nový source slot: definuj ID config objekt a 1-line wrappery

// Proxy — Worker wall-clock limit
// Worker free tier má ~30s limit. Polling NIKDY neběží uvnitř Workeru.
```
