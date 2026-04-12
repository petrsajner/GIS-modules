# STAV.md — Generative Image Studio

## Aktuální verze: v196en
## Příští verze: v197en
## Datum: 2026-04-12
## Worker verze: 2026-14 (+Replicate WAN 2.7 Image, zachován Segmind legacy)

---

## Co je v196en (oproti v195en)

### 1. WAN 2.7 Image: migrace ze Segmind zpět na Replicate
- **Důvod:** Segmind WAN 2.7 Image endpoint nepodporuje aspect ratio ani custom pixel rozměry — pouze square presety (1K/2K/4K). Replicate (`wan-video/wan-2.7-image`) podporuje 15 specifických pixel stringů pro 5 aspect ratios × 3 tiers.
- **Provider:** Replicate API (async prediction → poll)
- **Auth:** `Bearer` token (localStorage: `gis_replicate_apikey`)
- **Model IDs:** `wan-video/wan-2.7-image` (standard, max 2K), `wan-video/wan-2.7-image-pro` (Pro, max 4K)
- **API flow:** GIS → Worker POST `/replicate/wan27i/submit` → Replicate creates prediction → GIS polls POST `/replicate/wan27i/status` → output = array of image URLs → GIS fetches image → base64 → gallery
- **Size parametr:** pixel string z whitelistu (např. `"2048*1152"`) pro T2I, nebo tier preset (`"2K"`) pro Edit mode a unsupported aspects (fallback → square)
- **Replicate size whitelist (ověřený z playgroundu):**
  ```
  Presets: "1K", "2K", "4K"
  1:1  → 1024*1024, 2048*2048, 4096*4096
  16:9 → 1280*720,  2048*1152, 4096*2304
  9:16 → 720*1280,  1152*2048, 2304*4096
  4:3  → 1024*768,  2048*1536, 4096*3072
  3:4  → 768*1024,  1536*2048, 3072*4096
  ```
  Aspect ratios 3:2, 2:3, 21:9, 4:5, 1:4 NEJSOU v whitelistu.
- **Edit mode:** posílá `input.size = tier preset` (model bere aspect z input image, tier určuje výstupní plochu)
- **Edit mode 4K:** nedostupný (Replicate: "4K only for text-to-image")
- **Ref limit:** zvýšen z 2048px na 4096px pro WAN 2.7 edit refs
- **`callReplicateWan27()`** v proxy.js — submit → poll → fetch image → base64

### 2. UI čištění WAN 2.7 params panel
- **Resolution:** 1K/2K/4K toggle (jako NB Pro) + žlutý info text s přesnými pixely
- **Pixel info:** automaticky se aktualizuje při změně tier i hlavního aspect selectu
- **Aspect ratio:** hlavní sdílený select, neduplicuje se v params panelu
- **Aspect filtrování:** WAN 2.7 T2I zobrazí pouze 5 podporovaných aspects (1:1, 16:9, 9:16, 4:3, 3:4). Nepodporované (3:2, 2:3, 21:9, 4:5, 1:4) skryté. Při přepnutí na jiný model se všechny vrátí.
- **Aspect pro edit:** celý `aspectRatioCtrl` schovaný pro WAN 2.7 edit (model bere aspect z input)
- **4K Pro:** viditelný pouze pro Pro T2I modely (ne edit)
- **Negative prompt:** přesunut pod hlavní prompt textarea (mimo Parameters sekci), auto-resize (1 řádek → roste), `min-height:0` override globálního CSS
- **Image count:** přesunut nad Save To (mimo Parameters sekci)
- **Thinking mode:** default checked (Replicate default je ON)
- **Odebrány:** Safety checker checkbox, wan27Aspect select, wan27Pixels select, API info label
- **Ref limit info:** WAN 2.7 edit zobrazuje "Max 4096px" (ostatní modely "Max 2048px")

### 3. Replicate API key zpět v Setup
- **Nová sekce:** "Replicate API Key" s popisem "WAN 2.7 Image (custom aspect ratios, 4K Pro)"
- **localStorage:** `gis_replicate_apikey` (zachovaný z předchozích verzí)
- **Export/Import:** přidán do API Keys Backup
- **Spending:** `replicate` provider přidán do SPEND_PROVIDERS

### 4. Worker v2026-14
- **Nový handler:** `handlers/replicate-wan27i.js` (2 routes: submit + status)
  - POST `/replicate/wan27i/submit` → `{ apiKey, model, input }` → Replicate API → `{ id, status }`
  - POST `/replicate/wan27i/status` → `{ apiKey, id }` → Replicate API → `{ status, output, error }`
- **Zachováno:** Segmind `/segmind/image` route (legacy compat)
- **Odstraněno:** staré Replicate routes (wan27/wan27v/wan27e — 8 routes + 3 imports + 2 GET routes)
- **Verze:** 2026-14

### 5. Empty prompt warning
- **Změna:** `toast('Enter a prompt')` → `showApiKeyWarning('Prompt empty', ...)` — velký modální dialog místo malého toastu v rohu

### 6. Recraft Crisp upscale diagnostika
- **Problém:** upscale proces doběhl ve frontě ale karta zůstala "generating", výsledek se neobjevil v galerii
- **Přidáno:** `console.log` s response keys, detekce queue response (vs sync), 60s timeout na image download (`AbortController`), detailní error messages s URL a response snippet
- **Status:** diagnostický kód přidán, root cause zatím neidentifikován — čeká na reprodukci s novým logováním

---

## Změněné moduly

| Modul | Řádků | Popis změn |
|-------|-------|------------|
| models.js | 576 | WAN 2.7 provider: segmind → replicate, IDs: wan-video/wan-2.7-image(-pro) |
| template.html | ~5200 | WAN 2.7 params panel přestavěn, neg prompt pod prompt, image count nad Save To, Replicate key v Setup, model descriptions "Replicate", aspect options filtrování |
| model-select.js | ~395 | _WAN27_PIXELS whitelist (5 aspects), _wan27FilterAspects(), _wan27UpdateRes() s edit/T2I info, aspect ctrl hide pro edit, ref limit text "4096px" |
| generate.js | ~900 | replicateKey místo segmindKey, sizeTier + size ve snap, callReplicateWan27 dispatch, empty prompt modal |
| proxy.js | ~435 | callReplicateWan27() (submit → poll → fetch), ref limit 4096, nahradil callSegmindWan27 |
| setup.js | ~315 | Replicate key init + handler + export/import |
| spending.js | ~218 | 'replicate' v SPEND_PROVIDERS |
| output-render.js | ~1700 | Recraft Crisp diagnostika: console.log, queue detection, AbortController timeout, error detail |

## Worker soubory

| Soubor | Řádků | Popis |
|--------|-------|-------|
| index.js | ~250 | v2026-14, +Replicate WAN 2.7 Image (2 routes), -old Replicate (8 routes), zachován Segmind |
| handlers/replicate-wan27i.js | ~77 | NOVÝ — Replicate WAN 2.7 Image submit + status |

### Worker deploy stav
- `handlers/replicate-wan27i.js` — NOVÝ, nasazený
- `handlers/segmind.js` — zachován (legacy compat)
- `handlers/replicate-wan27.js` — SMAZAT (dead code)
- `handlers/replicate-wan27v.js` — SMAZAT (dead code)
- `handlers/replicate-wan27e.js` — SMAZAT (dead code)

---

## Známé problémy / TODO pro v197en

### Recraft Crisp upscale — nefunkční (diagnostika přidána)
- Upscale přes Recraft Crisp doběhne ve frontě ale karta zůstane "generating"
- Diagnostický kód přidán v v196en — čeká na reprodukci s F12 konzolí
- Topaz upscale funguje správně (na stejném obrázku)
- Možné příčiny: fal.run endpoint vrací queue response místo sync, CORS na CDN URL, timeout na stahování

### Pending z v194en
1. Fix copyright to 2026 — `GIS_COPYRIGHT` a všechny výskyty "2025" v branding textech
2. Rename output HTML z `google-image-studio_vXXen.html` → `gis_vXXen.html` — fix v `build.js`

---

## TODO (prioritní pořadí)

1. **Recraft Crisp upscale fix** (diagnostika přidána, čeká na reprodukci)
2. Style Library "My Presets"
3. Z-Image Edit (`fal-ai/z-image/edit`)
4. Clarity 8×/16× via proxy
5. Claid.ai via proxy
6. WAN audio (DashScope)
7. Vidu Q3 Turbo (`fal-ai/vidu/q3/turbo/*`)
8. Wan 2.6 R2V
9. Seedance 2.0 (HOTOVO v v195en)
10. Ideogram V3
11. Recraft V4
12. GPT Image 1.5
13. Hailuo 2.3
14. Use button for V2V models

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
- **Rozhodnutí nedělat za Petra** — prezentovat možnosti a nechat ho rozhodnout.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers na `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Google Gemini/Imagen, Luma, Kling, Replicate (WAN 2.7 Image), Freepik/Magnific, Topaz, PixVerse, xAI/Grok, OpenRouter
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
