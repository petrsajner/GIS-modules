# STAV.md — Generative Image Studio

## Aktuální verze: v195en
## Příští verze: v196en
## Datum: 2026-04-12
## Worker verze: 2026-13 (+Segmind, -Replicate)

---

## Co je v195en (oproti v194en)

### 1. Seedance 2.0 — 6 video modelů
- **Modely:** T2V/I2V/R2V × Standard + Fast (6 kombinací)
- **Endpointy:** `bytedance/seedance-2.0/{text-to-video|image-to-video|reference-to-video}` + `/fast/`
- **Multi-shot via prompt:** `[lens switch]`, timeline `[0-3s]...`, `Shot 1:...` (čistě prompt-driven, žádný API parametr)
- **R2V:** 9 image refs + 3 video slots (R2 upload → URLs) + 3 audio URL paste inputs
- **`callSeedance2Video()`** v video.js — T2V/I2V/R2V dispatch
- **`seedance2Params` panel:** duration slider 4–15s + Auto, resolution 480p/720p radio, seed, R2V sekce
- **Spending:** `_seedance2_std` ($0.303/s), `_seedance2_fast` ($0.242/s), `_seedance2_r2v_fast` ($0.181/s)

### 2. Video ref renaming systém
- **Seedance 2.0 R2V:** `[Image1]`, `[Video1]`, `[Audio1]` s prefixem `[` a live rewrite
- **PixVerse Fusion fix:** `@pic1` (bylo `@Element1`) — display label, mention text, bidirectional rewrite opraveny
- **Funkce upraveny:** `getVideoRefDisplayLabel`, `getVideoRefMentionText`, `getVideoRefMentionPrefix`, `isVideoRefLabelFixed`, `videoPromptModelToUserLabels`, `videoPromptUserLabelsToModel`, `rewriteVideoPromptForModel`

### 3. Filter layout fix
- `.gal-filter-models` — odstraněn `max-width:420px`
- `.gal-filter-group:first-child` — přidán `flex:1` → MODEL chipy zabírají celou šířku, DATE zůstává kompaktní vpravo

### 4. Video spending overhaul
- **Nahrazeno:** single `_fal_video: $0.040/s` → 25+ per-model cenových klíčů
- **`_getVideoSpendKey(modelKey, hasAudio)`** v video.js — mapuje model + audio flag → správný cenový tier
- **Kling V3:** Std $0.084/$0.126, Pro $0.112/$0.168; O3: Std $0.168/$0.224, Pro $0.224/$0.280
- **Seedance 1.5:** $0.052; Vidu Q3: $0.077; WAN 2.6: $0.050/$0.100
- **PixVerse spending fix:** `switchView('setup')` volá `initSpendingUI()` pro refresh

### 5. WAN 2.7 Image: migrace na Segmind
- **Provider:** Segmind API (`https://api.segmind.com/v1/{model}`)
- **Auth:** `x-api-key` header
- **Model IDs:** `wan2.7-image` (standard, 2K), `wan2.7-image-pro` (Pro, 4K)
- **API styl:** synchronní — vrací surový PNG binární soubor přímo (ne JSON s URL)
- **Payload formát:**
  ```json
  {
    "messages": [{"role": "user", "content": [{"type": "text", "text": "prompt"}]}],
    "prompt": "prompt text (top-level, required)",
    "size": "2K",
    "watermark": false,
    "negative_prompt": "...",
    "seed": 42
  }
  ```
- **Size parametr:** preset stringy "1K" / "2K" / "4K" (ne pixel hodnoty)
- **Response:** raw PNG binary (Content-Type: image/png)
- **Edit mode:** refs jako image URLs v messages content (upload přes R2)
- **`callSegmindWan27()`** v proxy.js — builds payload, R2 upload pro edit refs, reads binary blob → base64
- **Segmind API key** v Setup (localStorage: `gis_segmind_apikey`)
- **Registrace:** https://www.segmind.com/api-keys

### 6. Replicate kompletně odstraněn
- 0 referencí v celém GIS kódu
- Odstraněno z proxy.js: `callReplicateWan27()` (~100 řádků)
- Odstraněno ze setup.js: Replicate API key
- Odstraněno z template.html: Replicate key UI sekce
- Odstraněno ze spending.js: `replicate` z SPEND_PROVIDERS
- Worker: odstraněny 3 importy + 8 routes pro replicate-wan27/wan27v/wan27e handlery
- Worker: odstraněny 2 GET routes pro /replicate/video/ a /replicate/image/ serving

### 7. WAN 2.7 params panel fix
- **Bug:** `wan27Params` panel existoval v template.html ale `model-select.js` ho nikdy nezobrazoval
- **Fix:** přidán toggle `document.getElementById('wan27Params').style.display = m.type === 'wan27r' ? '' : 'none'`
- **T2I zobrazuje:** Resolution (1K/2K/4K optgroups), Thinking mode, Image count 1–4, Negative prompt, Seed, Safety
- **Edit mode:** skrývá T2I-only řádky (Resolution, Thinking, Count, Neg prompt)
- **Pro 4K options:** `data-pro` atribut na option elementech, skryté pro Standard modely
- **Resolution select:** organizován v optgroups (1K, 2K, 4K Pro only)

### 8. apiKeyWarning modal fix
- **Bug:** CSS pro `#apiKeyWarning` modal existovalo ale HTML element chyběl kompletně
- **Důsledek:** `showApiKeyWarning()` crashovala s TypeError (`null.textContent`), `generate()` tiše selhala
- **Fix:** přidán kompletní `<div id="apiKeyWarning">` modal s `akwTitle`, `akwMsg`, tlačítky "→ Go to Setup" a "Close"

### 9. fal.js WAN 2.7 Edit fix
- **Bug:** `callWan27` edit branch posílal `image_url` (string) ale fal.ai endpoint vyžaduje `image_urls` (array)
- **Fix:** změněno na array, podporuje 1–4 refs

---

## Změněné moduly

| Modul | Řádků | Popis změn |
|-------|-------|------------|
| video.js | 4921 | Seedance 2.0, spending key lookup, R2V slots |
| template.html | 5216 | Seedance 2 panel, filter CSS, WAN 2.7 params, apiKeyWarning modal, Segmind Setup, 4K options |
| spending.js | 218 | 25+ video spend keys, segmind provider |
| models.js | 576 | Seedance 2.0 modely, WAN 2.7 → Segmind (provider, IDs, maxRefs:9) |
| generate.js | 898 | Segmind key validation, callSegmindWan27 dispatch |
| setup.js | 311 | Segmind key init + handler, removed Replicate |
| model-select.js | 313 | wan27Params toggle, edit/Pro row visibility, spending refresh |
| proxy.js | 449 | callSegmindWan27 (binary response handling), removed callReplicateWan27 |
| fal.js | 677 | WAN 2.7 edit image_urls fix |

## Worker soubory

| Soubor | Řádků | Popis |
|--------|-------|-------|
| index.js | 243 | v2026-13, +Segmind route (1), -Replicate (8 routes + 3 imports) |
| handlers/segmind.js | 60 | NOVÝ — Segmind passthrough, binary image response |

### Worker deploy stav
- `handlers/segmind.js` — NOVÝ, nasazený
- `handlers/replicate-wan27.js` — SMAZAT (dead code)
- `handlers/replicate-wan27v.js` — SMAZAT (dead code)
- `handlers/replicate-wan27e.js` — SMAZAT (dead code)

---

## Známé problémy / TODO pro v196en

### Segmind parametry — vyžaduje další ladění
- **Ověřit Thinking mode:** parametr `thinking_mode` — potřeba zjistit zda Segmind ho podporuje a pod jakým názvem
- **Ověřit n (batch count):** Segmind pravděpodobně nepodporuje `n` parametr — aktuálně odstraněn, count řeší paralelní volání
- **Ověřit 4K resolution:** Pro model by měl podporovat "4K" preset — neotestováno
- **Ověřit Edit mode:** ref images přes R2 upload → URLs v messages content — neotestováno
- **Size mapping precision:** aktuálně `maxDim > 2048 → "4K"`, `> 1280 → "2K"`, else `"1K"` — ověřit zda Segmind akceptuje tyto presets
- **Seed v response:** Segmind vrací binary PNG, ne JSON — seed z response nedostupný, ukládáme pouze user-zadaný seed

### Template.html popisky — stále říkají "fal.ai"
- Řádky ~2119-2122: WAN 2.7 model options v image select stále mají popis "fal.ai"
- Změnit na "Segmind"

### Pending z v194en
1. Fix copyright to 2026 — `GIS_COPYRIGHT` a všechny výskyty "2025" v branding textech
2. Rename output HTML z `google-image-studio_vXXen.html` → `gis_vXXen.html` — fix v `build.js`

---

## TODO (prioritní pořadí)

1. **Doladění Segmind parametrů** (viz výše)
2. Style Library "My Presets"
3. Z-Image Edit (`fal-ai/z-image/edit`)
4. Clarity 8×/16× via proxy
5. Claid.ai via proxy
6. WAN audio (DashScope)
7. Vidu Q3 Turbo (`fal-ai/vidu/q3/turbo/*`)
8. Wan 2.6 R2V
9. Ideogram V3
10. Recraft V4
11. GPT Image 1.5
12. Hailuo 2.3
13. Use button for V2V models

---

## Klíčové technické detaily

### Segmind API formát (potvrzený a funkční)
```
POST https://api.segmind.com/v1/wan2.7-image-pro
Headers: x-api-key: KEY, Content-Type: application/json
Body: {
    "messages": [{"role": "user", "content": [{"type": "text", "text": "prompt"}]}],
    "prompt": "prompt text",
    "size": "2K",
    "watermark": false,
    "negative_prompt": "...",
    "seed": 42
}
Response: raw PNG binary (Content-Type: image/png)
```

### Segmind Worker handler (`handlers/segmind.js`)
- Přijímá `{ apiKey, model, messages, parameters }` z GIS
- Spreaduje `parameters` na top-level: `Object.assign(sgPayload, parameters)`
- Posílá na `https://api.segmind.com/v1/${model}` s `x-api-key` headerem
- Detekuje `Content-Type: image/*` → passthrough binary s CORS headers
- JSON responses (errory) parsuje a forwarduje normálně

### callSegmindWan27 v proxy.js
- Builds messages + top-level `prompt` (Segmind vyžaduje obojí)
- Edit mode: upload refs přes R2 (`POST /r2/upload`) → public URLs v messages content
- Konvertuje pixel strings na presets: `maxDim > 2048 → "4K"`, `> 1280 → "2K"`, else `"1K"`
- Čte binary response jako blob → base64
- Detekuje rozměry výsledného obrázku přes `new Image()` pro metadata

### Architektura providerů pro WAN 2.7
| Feature | Provider | Stav |
|---------|----------|------|
| WAN 2.7 Image T2I | Segmind (proxy) | ✅ Funkční |
| WAN 2.7 Image Edit | Segmind (proxy) | ⚠ Neotestováno |
| WAN 2.7 Video I2V | fal.ai (direct) | ✅ Funkční |
| WAN 2.7 Video T2V | fal.ai (direct) | ✅ Funkční |
| WAN 2.7 Video Edit | fal.ai (direct) | ✅ Funkční |

---

## Pravidla a principy

- **⚠ CRITICAL WORKFLOW — `/mnt/project/` je VŽDY stale. NIKDY ho nepoužívat.** Zdrojové moduly musí přijít z GitHubu (via `web_fetch` blob URLs) nebo přímým uploadem od Petra.
- **Session start:** (1) načíst `STAV.md` z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) build s `node build.js NNNen → dist/`.
- **Syntax check:** `awk '/<script>$/...' | node --input-type=module` → OK = "window is not defined"
- **NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele.**
- **Vždy důkladně prozkoumat** (web search, probe APIs) než prohlásit že něco nejde.
- **Research API maturity a regionální dostupnost** před integrací nových modelů.
- **fal.ai vs. direct APIs:** fal.ai je ~15–30 % dražší ale preferovaný pro nepravidelné použití. Přímé provider APIs preferovány když CORS-kompatibilní. Proxy (CF Worker) povinný když ani jedno nefunguje.
- **Worker free tier:** 30s wall-clock limit — nikdy nepollovat uvnitř Workeru.
- **Snap count v `addToQueue`:** každý nový model musí mít svůj count field v count expresi.
- **`_prevVideoModelKey`** vždy místo `getActiveVideoModelKey()` když je potřeba předchozí model.
- **Kling video:** nikdy neposílat `prompt: ""` — API rejectne s 422.
- **`inpaintQueue[]` results** ukládat jen do galerie, nikdy neaktualizovat paint canvas.
- **fal-inpaint.js** (NE `fal.js`) je Worker handler pro fal.ai queue. Import: `'./handlers/fal-inpaint.js'`.
- **PixVerse gotchas:** I2V endpoint je `/video/img/generate` (NE `/image/`). `multi_clip_switch` API je INVERTED.
- **Replicate auth:** `Bearer` token; fal.ai: `Key` token; Segmind: `x-api-key` header.
- **Segmind response:** raw binary image (PNG), ne JSON. Worker musí passthrough binary s CORS headers.
- **Segmind size:** preset stringy "1K"/"2K"/"4K", ne pixel hodnoty.
- **Segmind prompt:** vyžaduje top-level `prompt` pole navíc k messages formátu.
- **OpenRouter (Claude Sonnet 4.6)** je PRIMARY agent pro všechny tool features. Gemini Flash je POUZE fallback.
- **Rozhodnutí nedělat za Petra** — prezentovat možnosti a nechat ho rozhodnout.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers na `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Google Gemini/Imagen, Luma, Kling, Segmind (WAN 2.7 Image), Freepik/Magnific, Topaz, PixVerse, xAI/Grok, OpenRouter
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
