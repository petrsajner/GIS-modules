# STAV.md — Generative Image Studio

## Aktuální verze: v198en
## Příští verze: v199en
## Datum: 2026-04-13
## Worker verze: 2026-15 (+xAI multi-image edit, b64_json response)

---

## Co je v198en (oproti v197en)

### 1. Grok Imagine — kompletní rozšíření
- **Grok Imagine Pro** (`grok-imagine-image-pro`): nový model, vyšší kvalita, $0.07/img, `maxRefs: 1` (API limit)
- **Grok Standard** (`grok-imagine-image`): cena opravena $0.02/img (z $0.07), `maxRefs: 5` (multi-image edit)
- **Multi-image editing**: Standard model podporuje až 5 ref obrázků, endpoint `/v1/images/edits` s `images[]` array
- **Count 1–10**: segmentovaná lišta (visual bar) místo radio buttonů 1–4
- **Resolution**: Pro default 2K, Standard default 1K
- **Aspect ratio filter**: Grok zobrazí jen 13 API-validních poměrů, `auto` poměr přidán

### 2. Worker xai.js — přepracován
- **Endpoint routing**: T2I → `/v1/images/generations`, Edit → `/v1/images/edits`
- **`response_format: b64_json`**: eliminuje Worker-side URL fetch — API vrátí base64 přímo
- **Multi-image edit**: `images: [{type: "image_url", url: ...}]` array (1–5 obrázků)
- **Count limit**: zvýšen na 10 (z 4)

### 3. Aspect ratia
- **Nové globální**: `2:1 — Banner wide`, `1:2 — Banner tall`, `auto — Model decides`
- **Grok filtr**: `_grokFilterAspects()` skrývá nevalidní poměry (`21:9`, `4:5`, `1:4`, `4:1`)

### 4. Edit Tool — kompletní rozšíření
- **7 modelových typů**: Gemini, Flux, Seedream, Kling, Qwen 2, Grok, WAN 2.7
- **Prompt šablony per model**: specifická struktura, ref formát, neg prompt pravidla
- **Dynamický ref preview**: scrollovatelný kontejner pro VŠECHNY refs (ne jen 2)
- **Klasifikace TYPE A/B**: camera+content = TYPE A, TYPE B = POUZE změna pohledu
- **Keep rules**: vždy preserve `camera angle, framing` (prevence reframe u Seedream aj.)
- **Clean prompt**: `_etmCleanPrompt()` stripuje reasoning řádky z AI výstupu
- **Multi-ref pravidla**: povinné per-image referencing, zákaz invence mood/grading
- **Badge barvy**: každý typ má vlastní barvu (Kling=fialová, Qwen=cyan, Grok=červená, WAN=oranžová)
- **Readapt prompt**: přepnutí modelu automaticky readaptuje prompt do nového formátu

### 5. Ref prefix — čistý prompt
- **Prefix**: `[Reference images: image 1, image 2, image 3]` — bez labelů (žádné "REF_055")
- **User labels**: zobrazeny v UI (mention dropdown), ale NE v promptu poslaném modelu
- **`proxy_xai` handler**: přidán do `preprocessPromptForModel` a `promptModelToUserLabels`

### 6. Error karty
- **✕ Dismiss button**: smaže error kartu a reflow grid
- **`dismissErrorCard()` funkce**

### 7. Concurrency limit
- **xAI**: snížen na 2 concurrent requesty (z globálních 4) — prevence 503 při batchi

### 8. Bug fixy
- **`RETRY_MAX is not defined`**: opraveno na `j.retryTotal` v renderQueue
- **fal.js debug logging**: 422 status logován s plným error body do console
- **Qwen 2 Edit maxRefs**: opraveno 4 → 3 (API error: "Maximum 3 reference images allowed")

---

## Změněné moduly

| Modul | Řádků | Popis změn |
|-------|-------|------------|
| models.js | ~591 | Grok Pro model, maxRefs: 5/1, Qwen maxRefs 4→3 |
| template.html | ~5225 | Grok Pro option, count segmented bar, 3 nové aspect ratia, Edit Tool: 5 nových modelů, dynamický ref container |
| model-select.js | ~434 | Grok descriptions, aspect filter, Pro auto-2K, Qwen info text 3 refs |
| generate.js | ~905 | grokCountVal hidden input, xAI concurrency 2, RETRY_MAX→j.retryTotal |
| proxy.js | ~441 | Multi-ref image_urls[] array |
| spending.js | ~220 | Standard $0.02, Pro $0.07 |
| ai-prompt.js | ~2100 | 7 model types, 4 nové prompt šablony, dynamický ref preview, clean prompt, TYPE A/B klasifikace, Keep camera rules, badge barvy, readapt pro všechny typy |
| output-placeholder.js | ~495 | Dismiss button + dismissErrorCard() |
| refs.js | ~842 | proxy_xai v preprocessPromptForModel/promptModelToUserLabels/_refModelLabel, čistý prefix bez labelů |
| fal.js | ~637 | Debug logging: 422 s plným error body, re-throw pro naše chyby |

### Worker (separátní deploy)
| Soubor | Popis |
|--------|-------|
| xai.js | Kompletní přepis: T2I/Edit routing, b64_json, multi-image, count 10 |

---

## Grok Imagine — ověřené limity

| Model | Max refs | Max n | Resolutions | Aspect ratios |
|-------|----------|-------|-------------|---------------|
| `grok-imagine-image` (Standard) | 5 | 10 | 1k, 2k | 13 (viz filtr) |
| `grok-imagine-image-pro` (Pro) | 1 | 10 | 1k, 2k | 13 (viz filtr) |

**Supported aspects:** 1:1, 3:4, 4:3, 9:16, 16:9, 2:3, 3:2, 9:19.5, 19.5:9, 9:20, 20:9, 1:2, 2:1, auto

**Pricing:** Standard $0.02/img, Pro $0.07/img, Edit: input + output charged

**API endpoints:**
- T2I: `POST https://api.x.ai/v1/images/generations`
- Edit: `POST https://api.x.ai/v1/images/edits`
- Edit payload: `{ images: [{type: "image_url", url: "data:..."}], prompt, model, n, resolution, response_format: "b64_json" }`

---

## Qwen Image 2 — opravené limity

| Constraint | Limit | Zdroj |
|------------|-------|-------|
| Input resolution | 4,194,304 px (4 MP) | API error |
| Ref count (Edit) | **3 obrázky** (ne 4!) | API error: "Maximum 3 reference images allowed" |
| File size | fal.ai standard (10 MB) | — |

---

## Známé problémy / TODO pro v199en

### Blesk ikona (⚡) u assetů — zbytečná
- `assets.js:278` — `srcTag` zobrazuje ⚡ pro generated, ↑ pro uploaded
- **Odebrat při příští editaci**

### Grok Video — výzkum hotový, implementace čeká
- `grok-imagine-video`: T2V, I2V, V2V, async, 5/10/15s, 720p, native audio, ~$4.20/min
- Čeká na otestování image editu

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
13. Runway Gen-4 Image + Video (výzkum hotový)
14. Grok Imagine Video (výzkum hotový)

---

## Klíčové technické detaily

### xAI Worker handler (v2026-15)
```
# T2I
POST /xai/generate → Worker → POST https://api.x.ai/v1/images/generations
Body: { model, prompt, n, aspect_ratio, resolution, response_format: "b64_json" }
Response: { data: [{ b64_json: "..." }] }

# Edit (1–5 images)
POST /xai/generate → Worker → POST https://api.x.ai/v1/images/edits
Body: { model, prompt, n, resolution, response_format: "b64_json",
        images: [{ type: "image_url", url: "data:..." }, ...] }
```

### Edit Tool — model type system
| Type | Element rules | Ref format | Neg prompt | Badge color |
|------|--------------|------------|------------|-------------|
| gemini | ETM_ELEMENT_GEMINI | `image N` | ❌ | Gold |
| flux | ETM_ELEMENT_FLUX | `@ImageN` | ✅ | Blue |
| seedream | ETM_ELEMENT_SEEDREAM | `Figure N` | ✅ | Green |
| kling | ETM_ELEMENT_KLING | `@ImageN` | ✅ | Purple |
| qwen2 | ETM_ELEMENT_QWEN | `image N` | ✅ | Cyan |
| grok | ETM_ELEMENT_GROK | `image N` | ❌ | Red |
| wan | ETM_ELEMENT_WAN | `image N` | ✅ | Orange |

### Ref prefix — čistý formát (v198en)
```
Prompt sent to model:
[Reference images: image 1, image 2, image 3] Keep lighting, scene...

NOT:
[Reference images: image 1 = "REF_055", image 2 = "REF_049"] ...
```

---

## Pravidla a principy

- **⚠ CRITICAL WORKFLOW — `/mnt/project/` je VŽDY stale. NIKDY ho nepoužívat.**
- **Session start:** (1) načíst `STAV.md` z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) build s `node build.js NNNen → dist/`.
- **Syntax check:** `awk '/<script>$/...' | node --input-type=module` → OK = "window is not defined"
- **NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele.**
- **Vždy důkladně prozkoumat** (web search, probe APIs) než prohlásit že něco nejde.
- **Research API maturity a regionální dostupnost** před integrací.
- **Research přesný API whitelist** (size, aspect, maxRefs) — VŽDY kontrolovat playground/docs.
- **fal.ai vs. direct APIs:** fal.ai ~15–30% dražší ale preferovaný pro nepravidelné použití.
- **Worker free tier:** 30s wall-clock limit — nikdy nepollovat uvnitř Workeru.
- **Snap count v `addToQueue`:** každý nový model musí mít svůj count field.
- **xAI concurrency limit:** max 2 concurrent requesty (prevent 503).
- **Qwen 2 Edit maxRefs:** 3 (ne 4!). Ověřeno API errorem.
- **Grok Pro maxRefs:** 1. Standard: 5. Ověřeno API errorem.
- **Ref prefix:** jen `image N` — žádné labely v promptu. Labely jen v UI.
- **OpenRouter (Claude Sonnet 4.6)** je PRIMARY agent pro všechny tool features.
- **Rozhodnutí nedělat za Petra.**

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers na `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Google Gemini/Imagen, Luma, Kling, Replicate (WAN 2.7 Image), Freepik/Magnific, Topaz, PixVerse, xAI/Grok, OpenRouter
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
