# STAV.md — Generative Image Studio

## Aktuální verze: v197en
## Příští verze: v198en
## Datum: 2026-04-12
## Worker verze: 2026-14 (+Replicate WAN 2.7 Image, zachován Segmind legacy)

---

## Co je v197en (oproti v196en)

### 1. Upscale pre-flight resolution checks
- **Recraft Crisp:** pre-flight na 4,194,304 pixelů (4 MP) — potvrzeno API errorem `max_resolution: 4194304`
- **Clarity:** pre-flight na 25 MP output (testováno: 16.7 MP OK, 67 MP FAIL)
- **SeedVR2:** safety net 64 MP input
- **Modální dialog:** ikona ⬆, bez "Go to Setup" tlačítka, `pre-line` pro víceřádkový text
- **Odstraněn:** starý catch-all 8000px check (blokoval i Topaz/Magnific)

### 2. Recraft Crisp: PNG → JPEG konverze
- **Problém:** Recraft API má hard limit 5,242,880 B (5 MB) file size. PNG obrázky (i menší rozlišení) tento limit snadno překročí.
- **Řešení:** `_toJpeg()` helper — canvas-based konverze s progresivní kvalitou: q92 → q85 → q75. Pokud i q75 > 5 MB → throw Error.
- **Console log:** `[GIS Upscale] Recraft Crisp: PNG 8.2 MB → JPEG q92 1.4 MB`
- **Vizuální kvalita:** JPEG q92 je pro upscaler vstup nerozlišitelný od PNG — model stejně rekonstruuje detaily.

### 3. Upscale error visibility fix
- **Problém:** `job.pendingCards` nebylo nastaveno pro upscale joby → catch blok v `runJob` iteroval přes `[]` → `showErrorPlaceholder` se nezavolal → placeholder karta visela do nekonečna s "generating" statusem.
- **Fix:** `if (!job.pendingCards) job.pendingCards = [cardEl];` v generate.js
- **Console.error:** Plná neoříznutá chybová hláška + raw JSON response v konzoli pro debugging: `[GIS] Job error:` a `[GIS Upscale]`
- **422 hint:** fal.ai 422 chyby doplněny o hint `"image may be too large (WxH). Try Topaz Gigapixel or Magnific."`

### 4. showApiKeyWarning rozšíření
- **Nové `opts` parametr:** `{ icon, hideSetup }` — pro upscale warningy: ikona ⬆ místo 🔑, skryté "Go to Setup" tlačítko
- **`white-space: pre-line`** — respektuje `\n` v textu zprávy

### 5. Qwen Image 2 — negative prompt
- **Nový parametr:** `negative_prompt` v API payloadu (T2I + Edit)
- **UI:** Collapsible textarea (▸/▾ toggle), defaultně zavřená, s "(prefilled)" indikátorem
- **Default:** `blurry, low quality, distorted, deformed, oversaturated, watermark, ugly, bad anatomy, extra fingers, extra limbs, disfigured, poorly drawn face, duplicate, out of frame, worst quality, jpeg artifacts`
- **Rerun:** negPrompt se obnovuje z gallery metadata
- **Return object:** `negPrompt` přidán do `callQwen2` return

### 6. Qwen Image 2 Edit — multi-ref compositing
- **maxRefs:** zvýšen z 1 na 4 (Qwen 2.0 Edit podporuje až 4 vstupních obrázků)
- **Ref downscale:** area-based 4 MP cap (`maxArea: 4194304`) místo starého 2048px checkboxu
- **Ref label:** "Input images (edit · compositing)"
- **Info text:** "Max 4 MP · Auto-resized · up to 4 images · Instructions in prompt"
- **Nový parametr `maxArea`** v `_compressRefToJpeg` a `_refAsJpeg` — `Math.sqrt(maxArea / (w*h))` scale, zachovává aspect ratio

### 7. Pre-filled negative prompts pro všechny modely
- **Z-Image Base:** `blurry, low quality, distorted, deformed, ugly, watermark, text, signature, logo, extra fingers, extra limbs, fused fingers, missing fingers, deformed hands, bad anatomy, disfigured, poorly drawn face, mutation, extra head, duplicate, out of frame, worst quality, jpeg artifacts, grainy`
- **WAN 2.7 T2I:** `low quality, blurry, distorted, deformed, ugly, watermark, text, logo, bad anatomy, extra fingers, extra limbs, disfigured, poorly drawn, mutation, duplicate, out of frame, worst quality, jpeg artifacts`
- **Qwen Image 2 (all):** viz bod 5 výše
- **Všechny collapsible** (▸/▾ toggle, defaultně zavřené, "(prefilled)" badge)

### 8. Dead code cleanup
- **Odstraněno:** `callWan27()` z fal.js (59 řádků) — WAN 2.7 Image je kompletně na Replicate (`callReplicateWan27` v proxy.js). `callWan27eVideo` v video.js zůstává (video edit přes fal.ai, jiná funkce).

---

## Změněné moduly

| Modul | Řádků | Popis změn |
|-------|-------|------------|
| models.js | ~576 | Qwen 2: `negPrompt: true` (všechny 4 modely), `maxRefs: 4` (edit modely) |
| template.html | ~5210 | Collapsible `qwen2NegRow` textarea, updated edit descriptions "up to 4 refs" |
| model-select.js | ~408 | Pre-fill neg prompt defaults pro Z-Image/WAN/Qwen; show/hide qwen2NegRow; Qwen 2 Edit ref label+info text "4 MP"; ref info per-type dispatch |
| generate.js | ~902 | `pendingCards` fix pro upscale, `console.error` v catch bloku |
| fal.js | ~634 | Qwen 2: `negative_prompt` v payloadu, multi-ref `image_urls` (up to 4), `_refAsJpeg` s `maxArea` param, `_compressRefToJpeg` s `maxArea` support, dead `callWan27` odstraněn |
| gallery.js | ~2000 | Qwen 2 rerun: obnoví `negPrompt` do `qwen2Neg` textarea |
| output-render.js | ~1776 | Recraft Crisp: PNG→JPEG konverze (`_toJpeg` helper, progresivní kvalita), 4 MP pre-flight check, Clarity 25 MP pre-flight, SeedVR2 64 MP safety net, `console.error` pro debugging, 422 hint |
| styles.js | ~810 | `showApiKeyWarning(title, msg, opts)` — volitelný icon, hideSetup, pre-line |

---

## Recraft Crisp — ověřené limity (z testů 12. 4. 2026)

| Constraint | Limit | Zdroj |
|------------|-------|-------|
| File size | 5,242,880 B (5 MB) | API error: `file_too_large`, `max_size: 5242880` |
| Pixel resolution | 4,194,304 px (4 MP) | API error: `image_too_large`, `max_resolution: 4194304` |
| Max dimension | ~2048 px per side (vyplývá z 4 MP) | — |

**Flow:** PNG → JPEG q92 (→q85→q75 fallback) → 4 MP area check → submit

---

## Clarity — ověřené limity

| Test | Input | Factor | Output MP | Výsledek |
|------|-------|--------|-----------|----------|
| OK | 2741×1530 | 2× | 16.7 MP | ✅ Succeeded |
| FAIL | 5480×3056 | 2× | 67 MP | ❌ 422: image too large |

**Pre-flight:** output MP > 25 → modální dialog

---

## Qwen Image 2 — ověřené limity

| Constraint | Limit | Zdroj |
|------------|-------|-------|
| Input resolution | 4,194,304 px (4 MP) | API error (stejný jako Recraft) |
| Ref count (Edit) | 4 obrázky | API docs |
| File size | fal.ai standard (10 MB) | — |

**Ref downscale:** `_refAsJpeg(r, null, null, 4194304)` — area-based, zachovává aspect ratio

---

## Runway Gen-4 — VÝZKUM PROVEDEN (12. 4. 2026, neimplementováno)

**Shrnutí:** Runway Gen-4 API výzkum kompletní. Image (gen4_image, gen4_image_turbo) + Video (gen4.5, gen4_turbo, gen4_aleph V2V). Vyžaduje proxy (žádný CORS). @tag reference systém pro character consistency. Cenově konkurenceschopný (gen4_turbo video $0.25/5s vs Kling Pro $0.28). Implementační odhad: ~2-3 sessions. Čeká na rozhodnutí.

Detaily v `API_MODELS.md` a `DECISIONS.md`.

---

## Známé problémy / TODO pro v198en

### Blesk ikona (⚡) u assetů — zbytečná
- `assets.js:278` — `srcTag` zobrazuje ⚡ pro generated, ↑ pro uploaded
- Většina obrázků v GIS je AI generovaná → indikátor nepřináší info
- **Odebrat při příští editaci** — nechat vizuální prostor pro důležitější informace

### Pending z v194en — HOTOVO
1. ~~Fix copyright to 2026~~ — HOTOVO v v196en
2. ~~Rename output HTML~~ — HOTOVO v v196en

---

## TODO (prioritní pořadí)

1. Style Library "My Presets"
2. Z-Image Edit (`fal-ai/z-image/edit`)
3. Clarity 8×/16× via proxy
4. Claid.ai via proxy
5. WAN audio (DashScope)
6. Vidu Q3 Turbo (`fal-ai/vidu/q3/turbo/*`)
7. Wan 2.6 R2V
8. Ideogram V3
9. Recraft V4
10. GPT Image 1.5
11. Hailuo 2.3
12. Use button for V2V models
13. Runway Gen-4 Image + Video (výzkum hotový, čeká na rozhodnutí)

---

## Klíčové technické detaily

### Replicate API formát (potvrzený a funkční)
```
# Submit prediction
POST https://api.replicate.com/v1/models/wan-video/wan-2.7-image/predictions
Headers: Authorization: Bearer TOKEN, Content-Type: application/json
Body: {
    "input": {
        "prompt": "...",
        "size": "2048*1152",     // pixel string z whitelistu NEBO preset "2K"
        "thinking_mode": true,    // default ON pro Pro
        "negative_prompt": "...",
        "seed": 42,
        "images": ["url1", ...]  // pouze pro edit mode
    }
}
Response: { "id": "xxx", "status": "starting" }

# Poll status
GET https://api.replicate.com/v1/predictions/{id}
Headers: Authorization: Bearer TOKEN
Response (done): { "status": "succeeded", "output": ["https://...url1.png"] }
Response (fail): { "status": "failed", "error": "..." }
```

### Replicate WAN 2.7 size whitelist
```
Presets: "1K", "2K", "4K"
1:1  → 1024*1024, 2048*2048, 4096*4096
16:9 → 1280*720,  2048*1152, 4096*2304
9:16 → 720*1280,  1152*2048, 2304*4096
4:3  → 1024*768,  2048*1536, 4096*3072
3:4  → 768*1024,  1536*2048, 3072*4096
⚠ 3:2, 2:3, 21:9, 4:5, 1:4 — NEMAJÍ pixel stringy, pouze preset (→ square)
```

### Replicate WAN 2.7 Edit chování
- `size` parametr určuje výstupní **plochu** (v pixelech²), aspect ratio přebírá z **vstupního obrázku**
- Příklad: input 1376×768 (16:9), size "2K" (~4.2M px) → output ~2741×1530
- 4K resolution nedostupné pro edit (Replicate omezení)
- Refs upload přes R2 → public HTTPS URLs → `input.images` array

### Worker handler (`handlers/replicate-wan27i.js`)
- POST `/replicate/wan27i/submit` — přijímá `{ apiKey, model, input }`, forwarduje na Replicate `/v1/models/{model}/predictions`
- POST `/replicate/wan27i/status` — přijímá `{ apiKey, id }`, forwarduje na Replicate `/v1/predictions/{id}`
- Vrací `{ id, status }` resp. `{ status, output, error }`
- Error passthrough: `data.detail || data.title || JSON.stringify(data)`

### Architektura providerů pro WAN 2.7
| Feature | Provider | Stav |
|---------|----------|------|
| WAN 2.7 Image T2I | Replicate (proxy) | ✅ Funkční, 5 aspect ratios |
| WAN 2.7 Image Edit | Replicate (proxy) | ✅ Funkční, aspect z input image |
| WAN 2.7 Video I2V | fal.ai (direct) | ✅ Funkční |
| WAN 2.7 Video T2V | fal.ai (direct) | ✅ Funkční |
| WAN 2.7 Video Edit | fal.ai (direct) | ✅ Funkční |

---

## Pravidla a principy

- **⚠ CRITICAL WORKFLOW — `/mnt/project/` je VŽDY stale. NIKDY ho nepoužívat.** Zdrojové moduly musí přijít z GitHubu (via `web_fetch` blob URLs) nebo přímým uploadem od Petra.
- **Session start:** (1) načíst `STAV.md` z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) build s `node build.js NNNen → dist/`.
- **Syntax check:** `awk '/<script>$/...' | node --input-type=module` → OK = "window is not defined"
- **NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele.**
- **Vždy důkladně prozkoumat** (web search, probe APIs, check Replicate playground) než prohlásit že něco nejde.
- **Research API maturity a regionální dostupnost** před integrací nových modelů.
- **Research přesný API whitelist** (size, aspect) — VŽDY kontrolovat playground/docs, ne předpokládat z README.
- **fal.ai vs. direct APIs:** fal.ai je ~15–30 % dražší ale preferovaný pro nepravidelné použití. Přímé provider APIs preferovány když CORS-kompatibilní. Proxy (CF Worker) povinný když ani jedno nefunguje.
- **Worker free tier:** 30s wall-clock limit — nikdy nepollovat uvnitř Workeru.
- **Snap count v `addToQueue`:** každý nový model musí mít svůj count field v count expresi.
- **`_prevVideoModelKey`** vždy místo `getActiveVideoModelKey()` když je potřeba předchozí model.
- **Kling video:** nikdy neposílat `prompt: ""` — API rejectne s 422.
- **`inpaintQueue[]` results** ukládat jen do galerie, nikdy neaktualizovat paint canvas.
- **fal-inpaint.js** (NE `fal.js`) je Worker handler pro fal.ai queue. Import: `'./handlers/fal-inpaint.js'`.
- **PixVerse gotchas:** I2V endpoint je `/video/img/generate` (NE `/image/`). `multi_clip_switch` API je INVERTED.
- **Replicate auth:** `Bearer` token; fal.ai: `Key` token; Segmind: `x-api-key` header.
- **Replicate WAN 2.7 size:** whitelist pixel stringů, ne libovolné rozměry. Viz sekce výše.
- **OpenRouter (Claude Sonnet 4.6)** je PRIMARY agent pro všechny tool features. Gemini Flash je POUZE fallback.
- **Rozhodnutí nedělat za Petra** — prezentovat možnosti a nechat ho rozhodnout. Neuspěchat implementaci — nechat uživatele zadat práci po výzkumu.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers na `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Google Gemini/Imagen, Luma, Kling, Replicate (WAN 2.7 Image), Freepik/Magnific, Topaz, PixVerse, xAI/Grok, OpenRouter
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
