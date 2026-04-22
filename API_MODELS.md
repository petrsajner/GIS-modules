# GIS — API MODELS
*Aktualizace po v205en · 22. 4. 2026*

---

## AKTUALIZACE v205en (22. 4. 2026)

---

### GPT Image 1.5 & 2 — OpenAI rodina přes fal.ai

OpenAI 21. 4. 2026 vydal **ChatGPT Images 2.0** (GPT Image 2), fal.ai spustil endpointy ve stejný den. Integrováno 4 modely do GIS.

| Endpoint | Type | GIS key | Status |
|----------|------|---------|--------|
| `openai/gpt-image-2` | T2I | `gptimg2_t2i` | ✅ |
| `openai/gpt-image-2/edit` | I2I + mask | `gptimg2_edit` | ✅ |
| `fal-ai/gpt-image-1.5` | T2I | `gptimg15_t2i` | ✅ |
| `fal-ai/gpt-image-1.5/edit` | I2I + mask | `gptimg15_edit` | ✅ |

**Auth:** `Authorization: Key {falKey}` (stejný pattern jako ostatní fal). NE BYOK — fal účtuje přímo. (Alternativní namespace `fal-ai/gpt-image-2` vyžaduje `openai_api_key` v payloadu = BYOK, nezvoleno.)

**Queue URL:** `https://queue.fal.run/{endpoint}` — stejný path jako FLUX, SeeDream, atd.

#### Schema srovnání

| Param | GPT 2 T2I | GPT 2 Edit | GPT 1.5 T2I | GPT 1.5 Edit |
|---|---|---|---|---|
| `prompt` | ✅ required | ✅ | ✅ | ✅ |
| `image_urls` | — | ✅ required (plural) | — | ✅ required |
| `mask_url` | — | ✅ optional | — | — |
| `mask_image_url` | — | — | — | ✅ optional |
| `image_size` | preset/custom | auto/preset/custom | 3 fixed | auto/fixed |
| `quality` | low/med/high | low/med/high | low/med/high | low/med/high |
| `num_images` | 1–4 | 1–4 | 1–4 | 1–4 |
| `output_format` | png/jpg/webp | png/jpg/webp | png/jpg/webp | png/jpg/webp |
| `input_fidelity` | — | — | — | low/high (default high) |
| `background` | — | — | auto/transparent/opaque | — |
| `sync_mode` | bool | bool | bool | bool |

#### Size constraints (GPT 2)

OpenAI enforcement:
- Multiples of 16
- Max edge 3840 px
- Pixel count 655 000 – 8 290 000
- Aspect ratio ≤ 3:1

**GIS implementace:** vždy custom `{width, height}` (NE preset enum — ten vrací ~1088×608). Long side per tier:
- 1K → 1536
- 2K → 2048
- 4K → 3840

Auto-scaledown pokud area > 8.29M. Auto-scaleup pokud area < 655k (extrémní AR).

#### Size constraints (GPT 1.5)

**Jen 3 fixed sizes:** `1024x1024`, `1024x1536`, `1536x1024`. Žádné custom dims ani tiers.

Snap logic podle aspect ratio v GIS:
- r > 1.15 → `1536x1024` (landscape)
- r < 0.85 → `1024x1536` (portrait)
- else → `1024x1024` (square)

#### Mask format (kritický)

**Oba modely — PNG s alpha channel:**
- `alpha = 0` → **edit this region**
- `alpha = 255` → **keep unchanged**
- Musí match input image dimensions
- RGB kanály irelevantní — model čte jen alpha
- < 50 MB

**GIS converter `_annotAssetToGptMask()`:**
- Input: annotation asset (color strokes on white bg, z paint.js Export mode B)
- Output: RGBA PNG kde painted=alpha0 (edit), unpainted=alpha255 (keep)
- Near-white threshold 245 (forgives JPEG compression noise)

**GPT "soft mask" chování:** Na rozdíl od FLUX Fill (pixel-exact replacement) GPT **regeneruje celý obrázek s mask guidance**. V praxi: i při malé označené ploše se barvy/světla okolo mohou mírně změnit. Inherent model behavior, nelze obejít.

#### Pricing (fal, per-image)

**GPT Image 2 — 1K presets:**

| Size | Low | Medium | High |
|------|-----|--------|------|
| 1024×1024 | $0.006 | $0.053 | $0.211 |
| 1024×1536 | $0.005 | $0.041 | $0.165 |
| 1536×1024 | $0.005 | $0.041 | $0.165 |

**GPT Image 2 — 2K/4K tier (ballpark z extremes):**

| Tier | Low | Medium | High |
|------|-----|--------|------|
| 2K | $0.012 | $0.100 | $0.300 |
| 4K | $0.025 | $0.200 | $0.410 |

**GPT Image 1.5:**

| Size | Low | Medium | High |
|------|-----|--------|------|
| 1024×1024 | $0.009 | $0.034 | $0.133 |
| 1024×1536 | $0.013 | $0.051 | $0.200 |
| 1536×1024 | $0.013 | $0.050 | $0.199 |

**Base token rates (pro reference):**
- Text: $5/M input, $10/M output, $1.25/M cached
- Image: $8/M input, $30/M output, $2/M cached

**Cost spread:** 1K low → 1K high = ~35×. 1K → 4K high = ~2×. Plán cenové strategie: user volí explicitně.

#### Limitations (GA v1, duben 2026)

- ❌ Transparent backgrounds (GPT 2) — není v GA. GPT 1.5 má.
- ❌ `input_fidelity` parametr (GPT 2) — disabled, vždy auto high.
- ❌ Seed — neexponováno
- ❌ Negative prompt, steps, guidance — neexistuje koncept
- ❌ Streaming progressive frames — fal momentálně posílá jen 1 final event, žádné postupné. (Code ready, flip `streaming: true` jakmile fal aktivuje.)

#### Performance

Z fal blog (21. 4. 2026):
- **GPT 2 medium quality:** p50 ~3 s per image
- **GPT 2 high quality 4K:** 8–12 s per image
- Den po release občas overloaded → timeouty. Queue polling robustnější než SSE stream.

#### Worker requirement

**Žádný.** fal endpointy mají CORS otevřené pro browser calls. `Authorization: Key` header jde přímo z `file://` protocol.

---

*Aktualizace po v201en · 16. 4. 2026*

---

## AKTUALIZACE v201en (16. 4. 2026)

---

### Z-Image family — kompletní mapa endpointů

Po researchu v v201en potvrzeny následující endpointy v Z-Image rodině na fal.ai (Tongyi-MAI / Alibaba, 6B params):

| Endpoint | Type | GIS model key | Status |
|----------|------|---------------|--------|
| `fal-ai/z-image/base` | T2I standard (28 steps, CFG, neg prompt) | `zimage_base` | ✅ integrated |
| `fal-ai/z-image/turbo` | T2I ultra-fast (8 steps, acceleration) | `zimage_turbo` | ✅ integrated (v201en split) |
| `fal-ai/z-image/turbo/image-to-image` | I2I (strength-based) | `zimage_turbo_i2i` | ✅ integrated (v201en nový) |
| `fal-ai/z-image/base/lora` | T2I base + LoRA array (max 3) | — | 🟡 TODO |
| `fal-ai/z-image/turbo/lora` | T2I turbo + LoRA array (max 3) | — | 🟡 TODO |
| `fal-ai/z-image-trainer` | LoRA training (ZIP dataset, polling) | — | 🟡 TODO |

**Žádný instruction-based edit endpoint v Z-Image rodině neexistuje** (není ekvivalent Qwen Edit / WAN Edit / FLUX Kontext). Z-Image I2I je strength-based (podobně jako SDXL I2I) — uživatel nastavuje jak moc se výstup liší od vstupu, ne "změň tohle".

**Pricing:** $0.005/MP pro base i turbo.

**Cena LoRA trainer:** $0.226 per 100 training steps (default 1000 = $2.26).

**Z-Image Turbo I2I — detail integrace (v201en):**

```js
// callZImage v fal.js — endpoint rozhodnut přes model.id
// zimage_turbo_i2i: model.id = 'fal-ai/z-image/turbo/image-to-image'
// Legacy fallback: if (i2iModel && refs.length > 0 && isTurbo) → force I2I endpoint
// Kombinace bezpečná — model.id přímo odpovídá cíli

payload = {
  prompt,
  image_url: 'data:image/jpeg;base64,...',  // single ref, REF_MAX_PX = 2048
  image_size: calcZImageDims(aspect, mpTarget),  // pixel dims
  num_images: 1,
  num_inference_steps: 8,  // default turbo
  enable_safety_checker: true,
  output_format: 'png',
  acceleration: 'regular',  // 'none' | 'regular' | 'high'
  seed: ...,
  strength: 0.85,  // 0.1-1.0 — UI slider vždy viditelný pro i2i model
}
```

**UI flags (`models.js`):**
```js
zimage_turbo_i2i: {
  id: 'fal-ai/z-image/turbo/image-to-image',
  refs: true, maxRefs: 1, i2iModel: true,
  strength: true,
  steps: true, acceleration: true,
  seed: true, safetyChecker: true,
  resolutions: ['1K', '2K'], maxCount: 4,
}
```

**Gotchas:**
- Bez reference endpoint vrátí 422 (`image_url is required`). UI by měl varovat, ale zatím se nekontroluje — user dostane error při generate.
- `strength` slider se zobrazí okamžitě při select modelu (dřív byl vázaný na `refs.length > 0`).

---

## AKTUALIZACE v199en (14. 4. 2026)

---

### Grok Imagine Video — kompletní integrace

**Model:** `grok-imagine-video`
**Provider:** xAI (přímé API přes Worker proxy)
**CORS:** ❌ — přes proxy
**Auth:** `Authorization: Bearer {xai_key}`
**Cena:** $0.05/s ($4.20/min)

**5 módů (jeden model, různé endpointy):**

| Mód | xAI endpoint | Worker route | Popis |
|-----|-------------|-------------|-------|
| T2V | POST /v1/videos/generations | /xai/video/submit | prompt only |
| I2V | POST /v1/videos/generations | /xai/video/submit | prompt + `image: {url}` |
| Ref2V | POST /v1/videos/generations | /xai/video/submit | prompt + `reference_images: [{url}]` (max 7) |
| V2V Edit | POST /v1/videos/edits | /xai/video/edit | prompt + `video: {url}` (max 8.7s input) |
| Extend | POST /v1/videos/extensions | /xai/video/extend | prompt + `video: {url}` + duration (2–10s extension) |

**Async pattern:**
```
POST endpoint → { request_id }
GET /v1/videos/{request_id} → { status: "pending"|"done"|"failed"|"expired", video: { url, duration } }
```

**Status poll:** Worker route `POST /xai/video/status` → single GET, vrátí stav okamžitě.
**Video download:** Worker route `POST /xai/video/download` → CORS bypass fetch + stream binary.

**Parametry:**
| Param | Hodnoty | Poznámky |
|-------|---------|----------|
| duration | 1–15 | Edit: nepodporováno. Extend: 2–10 (délka přidané části). Ref2V: max 10 |
| aspect_ratio | 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3 | Default 16:9. Edit/Extend: nepodporováno |
| resolution | 480p, 720p | Default 480p. Edit/Extend: nepodporováno (capped 720p) |
| reference_images | [{url}] max 7 | Ref2V mód. base64 data URIs OK |
| image | {url} | I2V mód. base64 data URI OK |
| video | {url} | Edit/Extend mód. MUSÍ být HTTPS URL (ne base64) |

**Payload příklady:**

T2V:
```json
{ "model": "grok-imagine-video", "prompt": "...", "duration": 10, "aspect_ratio": "16:9", "resolution": "720p" }
```

I2V:
```json
{ "model": "grok-imagine-video", "prompt": "...", "image": {"url": "data:image/jpeg;base64,..."}, "duration": 8 }
```

Ref2V:
```json
{ "model": "grok-imagine-video", "prompt": "...from <IMAGE_1>...wear shirt from <IMAGE_2>...",
  "reference_images": [{"url": "..."}, {"url": "..."}], "duration": 10, "resolution": "720p" }
```

V2V Edit:
```json
{ "model": "grok-imagine-video", "prompt": "Add a red hat", "video": {"url": "https://..."} }
```

Extend:
```json
{ "model": "grok-imagine-video", "prompt": "Camera pans right...", "duration": 6, "video": {"url": "https://..."} }
```

**Gotchas:**
- Edit payload: `video: {url}` objekt, NE `video_url` string → 422 deserializační error
- Extend: `duration` = délka přidané části, ne celkového výstupu
- Video URLs jsou dočasné → stáhnout ihned
- Extend mód je nestabilní (březen 2026, potvrzeno komunitou + xAI acknowledged)
- Nelze kombinovat `image` + `reference_images` → 400
- Reference images: max 7, max duration 10s
- Edit input video: max 8.7s, output matches input aspect/resolution (capped 720p)

**GIS typ:** `grok_video`
**GIS VIDEO_MODELS key:** `grok_video`
**Spending:** `trackSpend('xai', 'grok-imagine-video', 1, durationSec)` — per second

---

## AKTUALIZACE v198en (13. 4. 2026)

---

### Grok Imagine — kompletní image integrace

**Modely:**
| Model | ID | Price | Max refs | Resolution |
|-------|-----|-------|----------|------------|
| Grok Standard | `grok-imagine-image` | $0.02/img | 5 | 1k, 2k |
| Grok Pro | `grok-imagine-image-pro` | $0.07/img | 1 | 1k, 2k |

**API:**
- T2I: `POST https://api.x.ai/v1/images/generations`
- Edit: `POST https://api.x.ai/v1/images/edits`
- Auth: `Authorization: Bearer {key}`
- Max n per request: 10
- `response_format: "b64_json"` → přímý base64 output

**Edit payload:**
```json
{
  "model": "grok-imagine-image",
  "prompt": "...",
  "n": 1,
  "resolution": "2k",
  "response_format": "b64_json",
  "images": [
    { "type": "image_url", "url": "data:image/jpeg;base64,..." }
  ]
}
```

**Aspect ratios (13 validních):**
`1:1, 3:4, 4:3, 9:16, 16:9, 2:3, 3:2, 9:19.5, 19.5:9, 9:20, 20:9, 1:2, 2:1, auto`

**Nepodporované (422):** `21:9, 4:5, 1:4, 4:1`

---

### Qwen Image 2 Edit — opravený maxRefs

**Oprava:** maxRefs 4 → **3** (API error: "Maximum 3 reference images allowed")

---

### Qwen Image 2 — negative_prompt + multi-ref edit

**Nový parametr:** `negative_prompt` (string)
**Multi-ref Edit:** `image_urls` array — až 3 obrázky pro compositing
**Ref downscale:** Area-based 4 MP cap (`maxArea: 4194304`)

---

### Recraft Crisp Upscale — ověřené limity

**File size:** 5,242,880 B (5 MB) → řešeno PNG→JPEG konverzí
**Pixel resolution:** 4,194,304 px (4 MP) → pre-flight modální dialog

---

### Clarity Upscale — ověřený limit

**Praktický output limit:** ~25 MP
**Pre-flight:** `inputMP * factor² > 25` → modální dialog

---

## AKTUALIZACE v164–v196en (historické)

---

### WAN 2.7 Image — Replicate API (v196en+)

**Endpoint:** `wan-video/wan-2.7-image` + `wan-video/wan-2.7-image-pro` na Replicate
**CORS:** Blokováno → přes GIS proxy Worker
**Auth:** `Authorization: Bearer {replicateKey}`
**Pattern:** Async polling

**Parametry:**
```javascript
{
  input: {
    prompt, images, size, num_outputs, thinking_mode, negative_prompt, seed
  }
}
```

**Size whitelist:**
```
Presets:  "1K", "2K", "4K"
1:1  →  1024*1024,  2048*2048,  4096*4096
16:9 →  1280*720,   2048*1152,  4096*2304
9:16 →  720*1280,   1152*2048,  2304*4096
4:3  →  1024*768,   2048*1536,  4096*3072
3:4  →  768*1024,   1536*2048,  3072*4096
```

**GIS typ:** `wan27r`, provider: `replicate`

---

### WAN 2.7 I2V — Replicate API (v171)

**Endpoint:** `wan-video/wan-2.7-i2v` na Replicate
**Pattern:** Async polling
**Output:** SINGLE URL STRING (ne array!)
**refMode:** `single_end` — ref[0]=first_frame, ref[1]=last_frame (optional)
**Cena:** 720p $0.10/s, 1080p $0.15/s

---

### PixVerse C1 + V6 — video (v192+)

**Provider:** PixVerse · `app-api.pixverse.ai`
**Auth:** `API-KEY` header + `Ai-trace-id` header (unique UUID per request)
**CORS:** ❌ — proxy passthrough
**Proxy handler:** `handlers/pixverse.js`

**Endpoints:**
```
POST /openapi/v2/video/text/generate         → T2V
POST /openapi/v2/video/img/generate          → I2V (NE /image/!)
POST /openapi/v2/video/transition/generate   → Transition
POST /openapi/v2/video/fusion/generate       → Fusion
POST /openapi/v2/image/upload                → multipart upload → img_id
GET  /openapi/v2/video/result/{video_id}     → status poll
```

**Gotchas:**
- I2V endpoint: `/video/img/generate` NOT `/video/image/generate`
- `camera_movement` only v4/v4.5 — C1 returns 400017
- `generate_audio_switch` must be explicitly sent
- Upload returns non-JSON on some errors

---

### Runway Gen-4 Image + Video — VÝZKUM (12. 4. 2026, neimplementováno)

**Image:** gen4_image $0.05–0.08, turbo $0.02, max 3 refs s @tag syntaxí
**Video:** gen4.5 $0.12/s, gen4_turbo $0.05/s, Aleph V2V $0.15/s
**CORS:** Blokováno → nutný proxy
**Auth:** `Authorization: Bearer key_xxx` + `X-Runway-Version: 2024-11-06`
**Stav:** Odloženo

---

### Magnific Precision V1/V2 (v181+)

**V1:** POST /v1/ai/image-upscaler-precision/{task_id}
**V2:** POST /v1/ai/image-upscaler-precision-v2
**V2 params:** scale_factor (2-16), flavor (sublime|photo|photo_denoiser), sharpen, smart_grain, ultra_detail

**Async pattern:**
```
POST → { data: { task_id } }
GET  → { data: { status: CREATED|IN_PROGRESS|COMPLETED|FAILED, generated: [url] } }
```
