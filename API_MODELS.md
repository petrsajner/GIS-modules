# GIS — API MODELS
*Aktualizace po v171en · 2. 4. 2026*

---

## AKTUALIZACE v164–v171en (2. 4. 2026)

---

### Z-Image Base I2I — ODSTRANĚN (v164)

`fal-ai/z-image/base` nemá `image_url` pole v OpenAPI schema. Endpoint vrací 404 s auth tokenem.
Z-Image I2I = výhradně Turbo: `fal-ai/z-image/turbo/image-to-image`.

---

### WAN 2.7 Image — Replicate API (v165–v168, v196en+)

**Endpoint:** `wan-video/wan-2.7-image` + `wan-video/wan-2.7-image-pro` na Replicate

**CORS:** Blokováno → přes GIS proxy Worker (`/replicate/wan27i/submit`, `/replicate/wan27i/status`)

**Auth:** `Authorization: Bearer {replicateKey}`

**Pattern:** Async polling
```
POST https://api.replicate.com/v1/models/wan-video/wan-2.7-image/predictions
→ { id, status }
GET  https://api.replicate.com/v1/predictions/{id}
→ { status, output[] }   ← output je ARRAY URL stringů
```

**Parametry (potvrzeno v196en):**
```javascript
{
  input: {
    prompt:           string,    // required
    images:           string[],  // optional — URLs pro edit mode (max 9, via R2 upload)
    size:             string,    // pixel string "2048*1152" NEBO preset "2K"
    num_outputs:      number,    // 1 (vždy 1 — paralelismus v GIS)
    thinking_mode:    boolean,   // default ON, T2I only
    negative_prompt:  string,    // optional, T2I only
    seed:             number,    // optional
  }
}
// output: array of URL strings
```

**Size whitelist (ověřený z Replicate playgroundu 12.4.2026):**
```
Presets:  "1K", "2K", "4K"
1:1  →  1024*1024,  2048*2048,  4096*4096
16:9 →  1280*720,   2048*1152,  4096*2304
9:16 →  720*1280,   1152*2048,  2304*4096
4:3  →  1024*768,   2048*1536,  4096*3072
3:4  →  768*1024,   1536*2048,  3072*4096
⚠ 3:2, 2:3, 21:9, 4:5, 1:4 — NEMAJÍ pixel stringy!
```

**Standard vs Pro:**
- Standard: max 2K, thinking_mode dostupný
- Pro: max 4K (T2I only), thinking_mode dostupný
- 4K NENÍ dostupné pro edit mode (Replicate omezení)

**Edit mode chování:**
- `size` parametr → tier preset ("1K"/"2K"), určuje výstupní plochu
- Aspect ratio přebírán z vstupního obrázku
- Příklad: input 1376×768 + size "2K" → output ~2741×1530
- Ref limit: 4096px (zvýšen z 2048px)

**Cena:** ~$0.030/image (per-second GPU billing)

**GIS typ:** `wan27r`, provider: `replicate`

**Modely:**
```
wan27_std      — T2I Standard (max 2K, 5 aspects)
wan27_pro      — T2I Pro (max 4K, thinking, 5 aspects)
wan27_edit     — Edit (images[] required, max 9 refs, aspect z input)
wan27_pro_edit — Edit Pro (max 2K edit, aspect z input)
```

**Pozor:**
- `size` používá hvězdičku (`2048*1152`), ne `×`
- Validace proti whitelistu — nepodporované hodnoty → 422
- `num_outputs: 1` vždy — paralelismus = N samostatných predictions
- Edit mode: 4K nedostupné, aspect z input image (ne ze selectu)

**Historie providerů:**
- v165–v168: Replicate (první integrace)
- v169–v194: fal.ai (nízké rozlišení)
- v195: Segmind (square only — žádný aspect ratio)
- v196+: zpět Replicate (5 aspect ratios, ověřený whitelist)

---


### WAN 2.7 I2V — Replicate API (v171)

**Endpoint:** `wan-video/wan-2.7-i2v` na Replicate

**CORS:** Blokováno → přes GIS proxy Worker

**Auth:** `Authorization: Bearer {replicateKey}`

**Pattern:** Async polling
```
POST https://api.replicate.com/v1/models/wan-video/wan-2.7-i2v/predictions
→ { id, status }
GET  https://api.replicate.com/v1/predictions/{id}
→ { status, output }   ← output je SINGLE URL STRING (ne array!)
```

**Parametry (potvrzeno z Replicate schema):**
```javascript
{
  input: {
    first_frame:              string,   // URI jpg/png/bmp/webp ≤20MB — required pro I2V
    last_frame:               string,   // URI optional — FLF2V mode (requires first_frame)
    first_clip:               string,   // URI mp4/mov 2-10s ≤100MB — clip continuation
    prompt:                   string,   // default ""
    negative_prompt:          string,   // default ""
    resolution:               string,   // "720p" | "1080p" (default "1080p")
    duration:                 number,   // integer 2-15 (default 5)
    enable_prompt_expansion:  boolean,  // default true
    audio:                    string,   // URI wav/mp3 3-30s ≤15MB — auto-generated pokud chybí
    seed:                     number,   // optional
  }
}
// output: single URL string (MP4)
```

**Cena:**
- 720p: $0.10/sekunda
- 1080p: $0.15/sekunda

**GIS typ:** `wan27_video`

**refMode:** `single_end` — ref[0]=first_frame (povinný), ref[1]=last_frame (optional FLF2V)

**Výjimečné funkce (nové v WAN 2.7):**
- `last_frame` — FLF2V: model interpoluje trajektorii mezi dvěma snímky
- `first_clip` — clip continuation: prodlouží existující video klip
- `audio` — vlastní audio synchronizace; bez tohoto pole model audio auto-generuje

---

### WAN 2.6 (fal.ai) — aktuální stav

Modely na fal.ai (CORS OK — přímé volání):
```
wan/v2.6/text-to-video          T2V, multi-shot, duration 5/10/15s
wan/v2.6/image-to-video         I2V, single start frame
wan/v2.6/reference-to-video/flash  R2V, image + video refs
```

**Audio:** Enable_audio parametr nefunguje přes fal.ai → skryté UI.

---

### Spending — přehled cen (aktuální)

**Google:**
```
gemini-2.0-flash:              ~$0.001/img (estimate)
imagen-4:                       $0.040/img
imagen-4-fast:                  $0.020/img
imagen-4-ultra:                 $0.080/img
```

**fal.ai (image):**
```
fal-ai/flux-2-pro:              $0.050/img
fal-ai/flux-2-max:              $0.060/img
fal-ai/flux-2-flex:             $0.040/img
fal-ai/bytedance/seedream/v4.5: $0.040/img
fal-ai/bytedance/seedream/v5/lite: $0.030/img
fal-ai/kling-image/v3:          $0.014/img
fal-ai/kling-image/o3:          $0.025/img
fal-ai/z-image/base:            $0.030/img
fal-ai/z-image/turbo:           $0.025/img
fal-ai/qwen-image-2/*:          $0.020–$0.035/img
```

**fal.ai (video, per second):**
```
_fal_video (generic):           $0.040/s
```

**xAI:**
```
grok-imagine-image:             $0.070/img
```

**Luma (image):**
```
photon-1:                       $0.032/img
photon-flash-1:                 $0.016/img
```

**Luma (video, per second):**
```
ray-2, ray-3:                   $0.071/s
ray-2-flash, ray-3-flash:       $0.036/s
```

**Topaz (video, per second):**
```
_topaz_slp25:                   $0.012/s
_topaz_slhq:                    $0.012/s
_topaz_slm:                     $0.008/s
_topaz_slp1:                    $0.030/s
_topaz_img:                     $0.005/img
```

**Replicate (image):**
```
wan-video/wan-2.7-image:        $0.030/img
```

**Replicate (video, per second):**
```
_replicate_wan27v_720p:         $0.10/s
_replicate_wan27v_1080p:        $0.15/s
```

---

## AKTUALIZACE v81 (26. 3. 2026) — historické

### Kling Image O3
```
T2I: fal-ai/kling-image/o3/text-to-image
I2I: fal-ai/kling-image/o3/image-to-image
```
Rozlišení: 1K / 2K / 4K. I2I s refs: `aspect_ratio: "auto"`.

### Clarity Upscaler — upscale_factor limit
```javascript
upscale_factor: 2 | 4   // ✓
upscale_factor: 8 | 16  // ✗ 422 — schema enum limit
```
Pro faktory 8×/16× nutné clarityai.co přímé API (CORS blok → proxy, neimplementováno).

### Fronta — paralelismus (v81)
```javascript
// Map s limitem per provider
runningModelCounts = new Map();  // Map<modelId, count>
// fal.ai: max 4 concurrent
// Gemini, Imagen, Replicate: 1 concurrent
```

---

## AKTUALIZACE v174en (3. 4. 2026)

### fal.ai image modely — queue endpoint (v174)

Všechny image modely přešly z synchronního na asynchronní queue endpoint.

```
Sync (starý):  POST https://fal.run/{model}         → wait → response
Queue (nový):  POST https://queue.fal.run/{model}   → request_id → poll → result
```

**Polling:** 200× 3s = max 10 min
**Status hodnoty:** `IN_QUEUE` → `IN_PROGRESS` → `COMPLETED` / `FAILED`
**Result format:** stejný jako sync response (`images[]`, `seed`, atd.)

### Kling image — ref size limit (v174)

**Limit:** Max 10.0MB per reference image (`image_url`, `image_urls[]`, `reference_image_urls[]`)
**Příčina 422:** 5K PNG z NB2 jako JPEG 100% = 15–30MB → nad limitem
**Fix:** `_refAsJpeg(r, 3840)` — resize na max UHD (3840×2160) + JPEG 100% = ~2–5MB

```javascript
// Kling V3 + O3 image-to-image
getRefDataForApi(r, 3840)     // resize na UHD
→ _compressRefToJpeg(apiRef)  // JPEG 100%, ~2–5MB raw
```

### fal.ai modely — JPEG komprese refs (v174)

Standard pro všechny fal.ai image modely: refs se re-enkódují jako JPEG 100% před odesláním.
Plné rozlišení zachováno (pouze změna formátu PNG→JPEG).

```
PNG ref 5504×3072 = 30–50MB raw → JPEG 100% = 3–6MB → base64 ~4–8MB
fal.ai 10MB limit: bezpečně splněn
```

---

## AKTUALIZACE v181en (5. 4. 2026)

---

### Magnific Precision — Freepik API (v181)

Freepik/Magnific má tři image upscale endpointy:

#### Upscaler Creative (původní, v160+)
```
POST /v1/ai/image-upscaler
Auth: x-freepik-api-key: {key}
Params: image (b64/URL), scale_factor (2x/4x/8x/16x), engine, optimized_for,
        creativity, hdr, resemblance, fractality, prompt
```

#### Upscaler Precision V1 (v181+)
```
POST /v1/ai/image-upscaler-precision
Auth: x-freepik-api-key: {key}
Params: image (base64 only), sharpen (0-100, def 50), smart_grain (0-100, def 7),
        ultra_detail (0-100, def 30), filter_nsfw
Poll: GET /v1/ai/image-upscaler-precision/{task_id}
CORS: blokováno → přes proxy (/magnific/precision s prec_version: 'v1')
```

#### Upscaler Precision V2 (v181+)
```
POST /v1/ai/image-upscaler-precision-v2
Auth: x-freepik-api-key: {key}
Params: image (b64/URL), scale_factor (int 2-16), flavor (sublime|photo|photo_denoiser),
        sharpen (0-100, def 7), smart_grain (0-100, def 7), ultra_detail (0-100, def 30),
        filter_nsfw
Poll: GET /v1/ai/image-upscaler-precision-v2/{task_id}
CORS: blokováno → přes proxy (/magnific/precision s prec_version: 'v2')
```

**Async pattern (stejný jako Creative):**
```
POST → { data: { task_id } }
GET  → { data: { status: CREATED|IN_PROGRESS|COMPLETED|FAILED, generated: [url] } }
```

**GIS UI mapping:**
```javascript
'v2_sublime'        → V2 endpoint, flavor: 'sublime'
'v2_photo'          → V2 endpoint, flavor: 'photo'
'v2_photo_denoiser' → V2 endpoint, flavor: 'photo_denoiser'
'v1_hdr'            → V1 endpoint (bez flavor, bez scale_factor)
```

**Proxy route:**
```
POST /magnific/precision    → handleMagnificPrecision (magnific.js)
  Body: { freepik_key, image_b64, prec_version, scale_factor, flavor,
          sharpen, smart_grain, ultra_detail }
POST /magnific/status       → handleMagnificStatus s upscaler_type
  upscaler_type: 'precision-v1' → /image-upscaler-precision/{id}
  upscaler_type: 'precision-v2' → /image-upscaler-precision-v2/{id}
  upscaler_type: 'creative'     → /image-upscaler/{id}  (původní)
```

---

## Runway Gen-4 Image + Video — VÝZKUM (11. 4. 2026, neimplementováno)

### Dostupné modely

**Image:**
| Model | Input | Cena |
|-------|-------|------|
| `gen4_image` | Text + až 3 ref obrázky | $0.05/720p, $0.08/1080p |
| `gen4_image_turbo` | Text + ref obrázky | $0.02/image (jakékoli rozlišení) |
| `gemini_2.5_flash` | Text + ref | $0.05/image |

**Video:**
| Model | Input | Cena/s |
|-------|-------|--------|
| `gen4.5` | Text nebo Image (T2V + I2V) | $0.12/s |
| `gen4_turbo` | Image | $0.05/s |
| `gen4_aleph` | Video + Text/Image (V2V) | $0.15/s |
| `veo3` | Text nebo Image | $0.40/s |
| `veo3.1` | Text nebo Image | $0.40/s (audio) / $0.20/s (bez) |
| `veo3.1_fast` | Text nebo Image | $0.15/s (audio) / $0.10/s (bez) |

### API architektura

**Endpoint base:** `https://api.dev.runwayml.com`
**Auth:** `Authorization: Bearer key_xxxxxxx` (klíče začínají `key_`, 128 hex znaků)
**Povinný header:** `X-Runway-Version: 2024-11-06`

**Async polling pattern (stejný jako Topaz/Luma):**
```
POST /v1/text_to_image      → { id: "task_xyz" }         # image
POST /v1/image_to_video     → { id: "task_xyz" }         # video I2V/T2V
POST /v1/video_to_video     → { id: "task_xyz" }         # Aleph V2V
GET  /v1/tasks/{id}         → { status, output: ["https://..."] }
```

**Status hodnoty:** `PENDING` → `RUNNING` → `SUCCEEDED` / `FAILED` / `THROTTLED`
- `THROTTLED` = job přijat ale čeká na kapacitu (tier limit) — poll dál

### Image — payload (gen4_image)

```javascript
POST /v1/text_to_image
{
  model: "gen4_image",                    // nebo "gen4_image_turbo"
  ratio: "1920:1080",                     // "1280:720" | "1920:1080" | atd.
  promptText: "@Karel stojí před @Budovou",
  referenceImages: [
    { uri: "data:image/png;base64,...", tag: "Karel" },
    { uri: "data:image/png;base64,...", tag: "Budova" }
  ]
}
→ { id } → poll GET /v1/tasks/{id} → { output: ["https://..."] }
```

**Reference syntaxe:** `@TagName` v promptu — reference se citují jménem tagu.
**Max refs:** 3 reference obrázky.
**Data URI limit:** 5 MB encoded (= ~3.3 MB binárního souboru).

### Video — payload (gen4.5)

```javascript
POST /v1/image_to_video
{
  model: "gen4.5",               // nebo "gen4_turbo"
  promptImage: "data:image/png;base64,...",  // optional pro T2V
  promptText: "string",
  ratio: "1280:720",             // "1280:720" | "720:1280" | "1104:832" | atd.
  duration: 5,                   // integer seconds
}
// T2V = vynech promptImage
→ { id } → poll GET /v1/tasks/{id} → { output: ["https://...video.mp4"] }
```

### Tier limity

| Tier | Concurrent jobs | Gens/day | Max spend/měs | Podmínka |
|------|-----------------|----------|---------------|---------|
| 1 | 1 | 50 | $100 | default |
| 2 | 3 | 500 | $500 | 1 den po $50 |
| 3 | 5 | 1000 | $2000 | 7 dní po $100 |
| 4 | 10 | 5000 | $20000 | 14 dní po $1000 |

Throttled joby se zařadí do fronty a spustí jakmile kapacita uvolní — nestihají 503.

### CORS — status

**Pravděpodobně BLOKOVÁNO.** Runway dokumentace říká: *„For Node.js and Python integrations, we strongly advise against integrating directly"* → doporučuje SDK. Chrome extension sample apps Runway fungují díky Chrome extension CORS bypass (manifest permissions), ne standardnímu browser CORS.

**Nutná proxy:** 2 nové Worker routes:
```
POST /runway/image/submit   → POST api.dev.runwayml.com/v1/text_to_image
POST /runway/video/submit   → POST api.dev.runwayml.com/v1/image_to_video
GET  /runway/tasks/:id      → GET  api.dev.runwayml.com/v1/tasks/:id     (passthrough poll)
```

Worker free tier 30s limit = passthrough polling → klient poluje client-side přes Worker.

### Klíčové gotchas

- Klíč musí mít formát `key_` + 128 hex znaků — jinak 401
- `X-Runway-Version: 2024-11-06` je povinný v každém requestu
- Credits (API) a kredity webové aplikace (app.runwayml.com) jsou **zcela oddělené** — nesdílí se
- Data URI image limit: 5 MB encoded — velké PNG refs nutno před odesláním zkomprimovat
- `THROTTLED` status není chyba — pokračuj v pollingu
- Gen-4.5 podporuje T2V (bez `promptImage`) i I2V (s `promptImage`)

### Srovnání s existujícími GIS providery

| Vlastnost | Runway Gen-4 Image | Gemini NB2 | Kling V3 Image |
|-----------|-------------------|------------|----------------|
| Ref konzistence | ⭐⭐⭐ (character-level) | ⭐⭐ | ⭐⭐ |
| Max refs | 3 | 14 | 6 |
| Ref syntaxe | @mention v promptu | inline | image_urls[] |
| Cena (standard) | $0.08/img | ~$0.045/img | $0.014/img |
| Cena (turbo) | $0.02/img | — | — |
| CORS | ❌ proxy | ✓ přímé | ✓ fal.ai |



**Provider:** PixVerse · `app-api.pixverse.ai`
**Model string:** `c1`
**Auth:** `API-KEY` header + `Ai-trace-id` header (unique UUID per request)
**CORS:** ❌ — needs proxy
**Proxy handler:** `handlers/pixverse.js` (passthrough design)

**Endpoints:**
```
POST /openapi/v2/video/text/generate         → T2V
POST /openapi/v2/video/img/generate          → I2V (NE /image/!)
POST /openapi/v2/video/transition/generate   → Transition (first+last frame)
POST /openapi/v2/video/fusion/generate       → Fusion (reference images)
POST /openapi/v2/image/upload                → multipart image upload → img_id
GET  /openapi/v2/video/result/{video_id}     → status poll
```

**T2V payload:** `{ model, prompt, duration, quality, aspect_ratio, negative_prompt, seed, generate_audio_switch, generate_multi_clip_switch, off_peak_mode }`

**I2V payload:** Same + `img_id` (from upload). No aspect_ratio.

**Transition payload:** `{ model, prompt, duration, quality, first_frame_img, last_frame_img, generate_audio_switch, seed, negative_prompt }`

**Fusion payload:**
```json
{
  "model": "c1",
  "prompt": "@cat plays at @park",
  "image_references": [
    { "type": "subject", "img_id": 12345, "ref_name": "cat" },
    { "type": "background", "img_id": 67890, "ref_name": "park" }
  ],
  "duration": 5, "quality": "720p", "aspect_ratio": "16:9",
  "generate_audio_switch": true
}
```
- type: "subject" or "background"
- ref_name: exact match required in prompt (@ref_name)
- C1: up to 7 refs (v4.5/v5: max 3)
- C1 extra ratios: 2:3, 3:2, 21:9

**Status codes:** 1=done (has url), 2=failed, 5=generating, 7=moderation fail, 8=failed, 9=queued

**Duration:** C1: 1–15s continuous. 1080p max 5s.

**Pricing (credits/s, $1=200cr):**
| Quality | No audio | With audio | ≈ USD/s |
|---------|----------|------------|---------|
| 360p    | 6        | 8          | $0.03   |
| 540p    | 8        | 10         | $0.04   |
| 720p    | 10       | 13         | $0.05   |
| 1080p   | 19       | 24         | $0.095  |

**Gotchas:**
- `Ai-trace-id` must be unique per request — reuse = no new video
- I2V endpoint is `/video/img/generate` not `/video/image/generate`
- `camera_movement` only v4/v4.5 for T2V, v4/v4.5/v5 for I2V — C1 returns 400017
- `generate_multi_clip_switch: false` ignored by T2V in C1 — workaround via neg prompt
- `generate_audio_switch` must be explicitly sent (default OFF)
- Upload returns non-JSON on some errors — Worker uses safeJson()
- Response wrapper: `{ ErrCode, ErrMsg, Resp: { video_id } }`

**Proxy routes (passthrough):**
```
POST /pixverse/t2v          → handlePixverseT2V
POST /pixverse/i2v          → handlePixverseI2V
POST /pixverse/transition   → handlePixverseTransition
POST /pixverse/fusion       → handlePixverseFusion
POST /pixverse/upload-image → handlePixverseUploadImage
POST /pixverse/status       → handlePixverseStatus
```
