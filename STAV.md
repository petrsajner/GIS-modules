# STAV.md — Generative Image Studio

## Aktuální verze: v199en
## Příští verze: v200en
## Datum: 2026-04-14
## Worker verze: 2026-16 (+xAI Grok Video: 5 routes)

---

## Co je v199en (oproti v198en)

### 1. MaxRefs enforcement — 3 vrstvy kontroly
Problém: refs nebyly omezeny při přepnutí modelu → API 422 error. Reuse jobu s více refy než nový model podporuje obešel limit.

**Vrstva 1 — UI (refs.js + template.html):**
- `renderRefThumbs()` counter ukazuje `activeCount / max` (ne `refs.length / max`)
- Refs nad limitem dostanou třídu `.ref-dimmed` — šedivé, desaturované, červený border
- Dimmed refs si zachovávají ×-remove ale skrývají Describe button
- Title dimmed refs: "Over limit — not sent to model"

**Vrstva 2 — AI agent (ai-prompt.js):**
- Edit Tool system prompt používá `MODELS[_etmCurrentModel].maxRefs`
- `_etmRefreshRefPreviews()` ukazuje dimmed excess refs s "⊘ over limit"
- `_etmSend()`, `_etmAppendVariants()`, `ccRegeneratePrompts()` — capped na aktivní refs
- `_etmReadaptPrompt()` při přepnutí modelu s menším maxRefs přidá instrukci AI trimovat reference

**Vrstva 3 — API dispatch (generate.js):**
- `refsCopy = getActiveRefs().map(...)` — hard limit, přebytečné refs se nikdy nedostanou do API

**Nový helper (models.js):**
- `getActiveRefs()` → `refs.slice(0, getRefMax())`

### 2. Edit Tool model switch — ref dimming + prompt trim
- `etmSwitchModel()` nově volá `_etmRefreshRefPreviews()` → okamžitá aktualizace ref panelu
- `_etmReadaptPrompt()` detekuje `refs.length > newMax` → přidá CRITICAL instrukci AI aby odstranil reference nad limit

### 3. Grok Imagine Video — kompletní integrace
Model `grok-imagine-video`, 5 módů přes xAI přímé API (ne fal.ai), Worker proxy.

**Módy:**
| Mód | Worker route | xAI endpoint | Popis |
|-----|-------------|-------------|-------|
| T2V | `/xai/video/submit` | `/v1/videos/generations` | Prompt → video |
| I2V | `/xai/video/submit` | `/v1/videos/generations` | Start frame → video |
| Ref2V | `/xai/video/submit` | `/v1/videos/generations` | 1–7 ref obrázků (visual guide) |
| V2V Edit | `/xai/video/edit` | `/v1/videos/edits` | Editace existujícího videa |
| Extend | `/xai/video/extend` | `/v1/videos/extensions` | Prodloužení videa od posledního framu |

**Parametry:**
- Duration: 1–15s (Edit: nepodporováno, Extend: 2–10s, Ref2V: max 10s)
- Resolution: 480p, 720p
- Aspect ratio: 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3
- Reference images: max 7 (Ref2V mód)
- Native audio: automaticky součástí výstupu

**Worker (xai-video.js):** 5 exportovaných handlerů + download proxy
**Cena:** $0.05/s ($4.20/min)
**Async flow:** submit → request_id → poll → download přes proxy (xAI URL nemá CORS)
**V2V Edit/Extend:** Video z galerie → R2 upload → HTTPS URL → xAI

**Známý problém (xAI strana):** Extend mód je nestabilní — přijme job ale často vrátí "internal error". T2V, I2V, V2V Edit fungují spolehlivě.

---

## Změněné moduly

| Modul | Řádků | Popis změn |
|-------|-------|------------|
| models.js | ~597 | `getActiveRefs()` helper |
| refs.js | ~838 | `renderRefThumbs()` dimming, active count |
| generate.js | ~905 | `refsCopy` uses `getActiveRefs()` |
| ai-prompt.js | ~2139 | Edit Tool maxRefs per model, ref trim in readapt, `count` bug fix, ref preview dimming |
| template.html | ~5231 | `.ref-dimmed` CSS + Grok Video UI panel (mode/duration/resolution/src video) |
| video.js | ~5211 | `grok_video` model + `callGrokVideo()` + `onGrokVideoModeChange()` + `setGrokVideoSrc()` + `useVideoFromGallery()` grok case |
| spending.js | ~221 | `grok-imagine-video: 0.050` |

### Worker (separátní deploy)
| Soubor | Popis |
|--------|-------|
| xai-video.js | **NOVÝ** — 5 handlerů (submit/edit/extend/status/download) |
| worker-index.js | 6 nových routes `/xai/video/*` + import |

---

## TODO (prioritní pořadí)

1. Style Library "My Presets"
2. Claid.ai via proxy
3. GPT Image 1.5
4. Hailuo 2.3
5. Use button for V2V models
6. Runway Gen-4 Image + Video (výzkum hotový)
7. Recraft V4
8. Předělat systém zobrazení ovládacích panelů (image + video)
9. Blesk ikona (⚡) u assetů — odebrat

---

## Klíčové technické detaily

### xAI Video Worker handler (v2026-16)
```
# T2V / I2V / Ref2V
POST /xai/video/submit → Worker → POST https://api.x.ai/v1/videos/generations
Body: { xai_key, mode, prompt, duration, aspect_ratio, resolution, image_url?, reference_images? }
Response: { request_id }

# V2V Edit
POST /xai/video/edit → Worker → POST https://api.x.ai/v1/videos/edits
Body: { xai_key, prompt, video_url }  → Worker sends { model, prompt, video: {url} }

# Extend
POST /xai/video/extend → Worker → POST https://api.x.ai/v1/videos/extensions
Body: { xai_key, prompt, video_url, duration }  → Worker sends { model, prompt, duration, video: {url} }

# Poll
POST /xai/video/status → Worker → GET https://api.x.ai/v1/videos/{request_id}
Response: { status: "pending"|"done"|"failed"|"expired", video_url?, duration? }

# Download (CORS bypass)
POST /xai/video/download → Worker → GET {xai_temp_url} → stream binary MP4
```

### MaxRefs architecture (v199en)
```
getActiveRefs() = refs.slice(0, getRefMax())
renderRefThumbs():  i >= max → .ref-dimmed class
generate.js:        refsCopy = getActiveRefs().map(...)
Edit Tool:          etmMax = MODELS[_etmCurrentModel].maxRefs
                    _etmReadaptPrompt → refTrimNote when refs > newMax
```

### Edit Tool — model type system (v199en)
| Type | Element rules | Ref format | Neg prompt | Badge color |
|------|--------------|------------|------------|-------------|
| gemini | ETM_ELEMENT_GEMINI | `image N` | ❌ | Gold |
| flux | ETM_ELEMENT_FLUX | `@ImageN` | ✅ | Blue |
| seedream | ETM_ELEMENT_SEEDREAM | `Figure N` | ✅ | Green |
| kling | ETM_ELEMENT_KLING | `@ImageN` | ✅ | Purple |
| qwen2 | ETM_ELEMENT_QWEN | `image N` | ✅ | Cyan |
| grok | ETM_ELEMENT_GROK | `image N` | ❌ | Red |
| wan | ETM_ELEMENT_WAN | `image N` | ✅ | Orange |

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
- **xAI Video Edit payload:** `video: {url}` objekt, NE `video_url` flat string.
- **Rozhodnutí nedělat za Petra.**

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers na `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Google Gemini/Imagen, Luma, Kling, Replicate (WAN 2.7 Image), Freepik/Magnific, Topaz, PixVerse, xAI/Grok (Image + Video), OpenRouter
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
