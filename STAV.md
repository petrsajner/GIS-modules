# GIS — STAV PROJEKTU
*Aktualizováno konec session · 11. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v194en.html | 11. 4. 2026 |
| Worker | gis-proxy v2026-12 | 11. 4. 2026 |

**Příští verze:** v195en

> Build: `cd /home/claude && node build.js 195en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "paint.js — inpaintQueue:" && grep -c "inpaintQueue" /mnt/project/paint.js && \
echo "paint.js — openInpaintFromNav:" && grep -c "openInpaintFromNav" /mnt/project/paint.js && \
echo "paint.js — qo-item:" && grep -c "qo-item" /mnt/project/paint.js && \
echo "paint.js — maskBlur:" && grep -c "maskBlur" /mnt/project/paint.js && \
echo "fal.js — _runSimpleInpaint:" && grep -c "_runSimpleInpaint" /mnt/project/fal.js && \
echo "fal.js — callFluxFill opts:" && grep -c "opts = {}" /mnt/project/fal.js && \
echo "gallery.js — _mzScale:" && grep -c "_mzScale" /mnt/project/gallery.js && \
echo "gallery.js — mInpaintRefBtn:" && grep -c "mInpaintRefBtn" /mnt/project/gallery.js && \
echo "template.html — inpaintNavTab:" && grep -c "inpaintNavTab" /mnt/project/template.html && \
echo "template.html — src-chip:" && grep -c "src-chip" /mnt/project/template.html && \
echo "template.html — inpaintQueueList:" && grep -c "inpaintQueueList" /mnt/project/template.html && \
echo "model-select.js — setup:6:" && grep -c "setup: 6" /mnt/project/model-select.js && \
echo "setup.js — getProxyUrl:" && grep -c "getProxyUrl" /mnt/project/setup.js && \
echo "setup.js — onSetupPixverseKey:" && grep -c "onSetupPixverseKey" /mnt/project/setup.js && \
echo "video.js — _saveVideoResult:" && grep -c "_saveVideoResult" /mnt/project/video.js && \
echo "video.js — _pixverseUpload:" && grep -c "_pixverseUpload" /mnt/project/video.js && \
echo "video.js — pixverse_c1_fusion:" && grep -c "pixverse_c1_fusion" /mnt/project/video.js && \
echo "video.js — pixverse_v6_t2v:" && grep -c "pixverse_v6_t2v" /mnt/project/video.js && \
echo "video.js — fusionPrompt:" && grep -c "fusionPrompt" /mnt/project/video.js && \
echo "output-placeholder.js — insertBefore:" && grep -c "insertBefore" /mnt/project/output-placeholder.js && \
echo "output-placeholder.js — _suppressPlaceholderScroll:" && grep -c "_suppressPlaceholderScroll" /mnt/project/output-placeholder.js && \
echo "db.js — assets_meta:" && grep -c "assets_meta" /mnt/project/db.js && \
echo "spending.js — pixverse:" && grep -c "pixverse" /mnt/project/spending.js && \
echo "ai-prompt.js — ETM_REFRAME_KNOWLEDGE:" && grep -c "ETM_REFRAME_KNOWLEDGE" /mnt/project/ai-prompt.js && \
echo "ai-prompt.js — openCharacterSheet:" && grep -c "openCharacterSheet" /mnt/project/ai-prompt.js && \
echo "ai-prompt.js — openCharacterCoverage:" && grep -c "openCharacterCoverage" /mnt/project/ai-prompt.js && \
echo "ai-prompt.js — openEnvCoverage:" && grep -c "openEnvCoverage" /mnt/project/ai-prompt.js && \
echo "ai-prompt.js — _ccRefLabel:" && grep -c "_ccRefLabel" /mnt/project/ai-prompt.js && \
echo "template.html — pixverseParams:" && grep -c "pixverseParams" /mnt/project/template.html && \
echo "template.html — pixverseOffPeak:" && grep -c "pixverseOffPeak" /mnt/project/template.html && \
echo "template.html — cs-view:" && grep -c "cs-view" /mnt/project/template.html && \
echo "template.html — cc-view:" && grep -c "cc-view" /mnt/project/template.html && \
echo "template.html — ecView:" && grep -c "ecView" /mnt/project/template.html
```
Vše musí vrátit ≥ 1.

> **Syntax check:**
> ```bash
> awk '/<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' \
>   /home/claude/dist/gis_v195en.html > /tmp/check.mjs
> node --input-type=module < /tmp/check.mjs 2>&1 | head -3
> # OK = "window is not defined"
> ```

---

## Kde jsme přestali

v194en dokončen a otestován. Session ukončena čistě 11. 4. 2026.

**v194en = Special Tools (all 3) + Setup stripe fix + Rerun scroll fix**

---

## Co bylo uděláno (11. 4. 2026)

### v194en — Special Tools Complete + UX Fixes

**Setup stripe visibility fix:**
- Alternating section background `.03` → `.06` (doubled opacity, 5 sections)

**Rerun scroll fix (output-placeholder.js):**
- `_suppressPlaceholderScroll` flag prevents `scrollIntoView` during rerunJob
- New renders still scroll to card; reruns stay in place

**Special Tool #1 — Character Sheet:**
- Sub-view with blue info box explaining Method A (with ref) vs Method B (description only)
- AI analyzes ref via OpenRouter (primary) / Gemini (fallback)
- Two prompt cards: green (A, with ref) + red (B, no ref)
- Golden "↗ Use as Prompt" buttons
- Session persists across close/reopen
- "↻ New analysis" button resets and re-analyzes

**Special Tool #2 — Character Coverage (10 shots):**
- 10 hardcoded camera positions (frontal, profiles, 3/4 views, back, low/high angle, overhead)
- AI analyzes character appearance from ref
- Checkbox "Include character description in prompts" — regenerates on toggle
- `_ccRefLabel(idx)` — model-aware ref mentions (`@Image1` for flux, `Figure 1` for seedream, `image 1` for gemini)
- Prompts refresh on reopen (after model switch) — mentions + batch info update
- Individual "↗ Use" per shot + "▶ Batch render all 10" with current settings display
- Batch calls `generate()` 10× sequentially → queue handles concurrency

**Special Tool #3 — Environment Coverage (10 views, AI-generated):**
- TWO-STEP AI workflow: vision analysis → text prompt generation
- Step 1: Vision call analyzes space (objects, positions, lighting, entry points, dimensions)
- Step 2: Text call generates 10 camera positions following coverage rules:
  - Shots 1↔2, 3↔4, 5↔6 are counter-views (opposite directions)
  - Shot 7: center, dominant feature
  - Shot 8: low angle from floor
  - Shot 9: overhead/bird's-eye
  - Shot 10: exterior peek (through window/doorway)
- `_ecParseShots()` parses `=== SHOT N: label ===` format from AI output
- Same UI pattern: cards, individual Use, batch render
- `EC_SYSTEM_PROMPT` enforces cinematographer rules, counter-view pairs, no compass directions

**Shared Special Tools infrastructure:**
- `resetActiveSpmTool()` dispatches to cs/cc/ec based on `_ccActiveTool`
- All 3 sub-views properly hidden when switching between tools
- Modal: 860px wide, 88vh, 18px title
- Reusable `.cc-` CSS classes shared between Character Coverage and Environment Coverage

**v194en JS řádky: 18869 (z v193en 18175, +694)**

### v193en — PixVerse C1+V6 Video + UX Improvements

**Worker (gis-proxy v2026-12):**
- Nový handler `handlers/pixverse.js` — passthrough architektura, 6 routes:
  - `POST /pixverse/t2v` → `/openapi/v2/video/text/generate`
  - `POST /pixverse/i2v` → `/openapi/v2/video/img/generate` (NE /image/)
  - `POST /pixverse/transition` → `/openapi/v2/video/transition/generate`
  - `POST /pixverse/fusion` → `/openapi/v2/video/fusion/generate`
  - `POST /pixverse/upload-image` → `/openapi/v2/image/upload` (multipart)
  - `POST /pixverse/status` → `/openapi/v2/video/result/{video_id}`
- `safeJson()` — bezpečný JSON parse
- `splitBody()` — strip apiKey, forwarduj vše (žádné budoucí Worker updaty pro nové params)

**GIS client — 7 video modelů (4× C1, 3× V6):**

| Model key | Režim | Refs | Endpoint | Multi-clip |
|-----------|-------|------|----------|------------|
| `pixverse_c1_t2v` | T2V | 0 | t2v | ❌ (neg prompt workaround) |
| `pixverse_c1_i2v` | I2V | 1 | upload → i2v | ❌ |
| `pixverse_c1_transition` | Transition | 2 | upload 2× → transition | ✅ (inverted API) |
| `pixverse_c1_fusion` | Fusion | 1–7 | upload N× → fusion | ❌ |
| `pixverse_v6_t2v` | T2V | 0 | t2v | ✅ |
| `pixverse_v6_i2v` | I2V | 1 | upload → i2v | ✅ |
| `pixverse_v6_transition` | Transition | 2 | upload 2× → transition | ✅ |

**Klíčové implementační detaily:**
- `_pixverseUpload()` helper — reusable upload → img_id
- `callPixverseVideo()` — dispatch 4 režimů (T2V/I2V/Transition/Fusion)
- `modelId` field ('c1' nebo 'v6') → `pvModelId` v API payloadu
- `supportsMultiClip` flag → řídí zobrazení checkboxu + odesílání
- Multi-clip API je INVERTED: `true` = single shot, `false` = multi. GIS posílá `!multiClip`.
- C1 T2V/I2V nepodporují `generate_multi_clip_switch` (400017) → workaround: neg prompt inject
- `generate_audio_switch` explicitně ve všech payloadech
- Fusion: `ref_name` = `pic1`, `pic2`... (PixVerse vyžaduje čistě alfanumerické)
- Fusion prompt auto-rewrite: `@Element3` → `@pic3`, `@Ref_031` → `@pic1`, `@Image2` → `@pic2`
- Camera Movement: disabled (v4/v4.5 only, C1 vrací 400017). Kód + UI select připraveny.
- Off-peak mode: `off_peak_mode: true`, 15s poll, 2h timeout
- Duration: 1–15s slider
- Status kódy: 1=done, 2/8=failed, 5=generating, 7=moderation, 9=queued

**Card ordering fix (video + image):**
- Video: `videoShowPlaceholder` změněno z `prepend` na `appendChild` — nové karty na konec
- Video: `renderVideoResultCard` nyní `replaceChild` in-place místo remove+prepend
- Video: `rerunVideoJob` — `insertBefore` + `remove` (in-place)
- Image: `rerunJob` (output-placeholder.js) — `addToQueue` → `insertBefore` staré karty → remove
- Ref thumbnaily nyní viditelné na error kartách (`thumb` přidáno do videoRefsAtSubmit snapshotu)

**Setup UI redesign:**
- Střídavé `rgba(255,255,255,.03)` pozadí API key sekcí (v194: zvýšeno na .06)
- Accent-colored labels (font-weight:600)
- Žlutý "Get key →" link u VŠECH providerů (Google, fal.ai, xAI, Luma, Freepik, Topaz, Replicate, PixVerse, OpenRouter)
- PixVerse key input + spendBlock_pixverse
- Proxy URL popis: "+PixVerse"

**v193en JS řádky: 18175 (z v192en 17785, +390)**

---

## Stav inpaint systému (k 10. 4. 2026)

Beze změn oproti v191en.

---

## Aktivní TODO (v pořadí priority)
- [ ] **#0** Otestovat FLUX Krea inpaint s platným klíčem
- [ ] **#1** Style Library "My Presets"
- [ ] #4 Clarity 8×/16×
- [ ] #5 Claid.ai
- [ ] #6 WAN audio (DashScope)
- [ ] #7 Vidu Q3 Turbo
- [ ] #9 Seedance 2.0
- [ ] #10 Ideogram V3
- [ ] #11 Recraft V4
- [ ] #12 GPT Image 1.5
- [ ] #13 Hailuo 2.3
- [ ] WAN 2.7 R2V — ověřit endpoint
- [ ] MuAPI klíč do Setup

---

## Modulární struktura
### Build pořadí (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```

### Změněné moduly v v194en (oproti v193en)
| Modul | Změny |
|-------|-------|
| `template.html` | Setup stripes .03→.06; Special Tools complete (3 tools CSS+HTML); specialToolModal 860px/88vh; golden Use buttons |
| `ai-prompt.js` | +Character Sheet (openCharacterSheet, _csRunAnalysis, _csGeneratePrompts, csUsePrompt); +Character Coverage (CC_SHOTS, _ccRefLabel, ccRegeneratePrompts, ccBatchRender); +Environment Coverage (EC_SYSTEM_PROMPT, _ecRunAnalysis, _ecParseShots, ecBatchRender); resetActiveSpmTool dispatcher |
| `output-placeholder.js` | +_suppressPlaceholderScroll flag; rerunJob no-scroll fix |

### Změněné moduly v v193en (oproti v192en)
| Modul | Změny |
|-------|-------|
| `video.js` | +PixVerse C1+V6: 7 modelů, _pixverseUpload, callPixverseVideo (4 režimy), fusion prompt auto-rewrite, multi-clip inverted logic, card ordering fix (appendChild + replaceChild), ref thumb v snapshotu, aspect ratio restore |
| `output-placeholder.js` | rerunJob in-place (insertBefore + remove) |
| `setup.js` | +gis_pixverse_apikey, +onSetupPixverseKey, +API_KEY_FIELDS |
| `spending.js` | +_pixverse_video $0.05/s, +pixverse provider |
| `template.html` | +PixVerse C1+V6 optgroups, +pixverseParams panel (quality/camera disabled/neg prompt/multi-clip/off-peak/seed), setup redesign (alternating bg, accent labels, Get Key links) |

### Worker struktura (gis-proxy v2026-12)
| Handler | Routes |
|---------|--------|
| `pixverse.js` (NEW) | 6 routes: t2v, i2v, transition, fusion, upload-image, status |
| `index.js` | +PixVerse imports + 6 routes, version 2026-12 |
