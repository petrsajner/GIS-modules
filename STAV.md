# STAV.md — Generative Image Studio

## Aktuální verze: v200en
## Příští verze: v201en
## Datum: 2026-04-14
## Worker verze: 2026-16 (beze změny)

---

## Co je v v200en (oproti v199en)

### 1. Unified Image Panel — dynamická šablona pro všechny image modely
9 separátních per-model HTML panelů → 1 generický panel (`upParams`) s 14 prvky, zobrazovanými podle UI flags v MODELS definici.

**Scope (unified):** Gemini (NB2/NB1/NBPro), Imagen (4/4Fast/4Ultra), FLUX (Pro/Flex/Max/Dev), SeeDream (4.5/5Lite), Kling (V3/O3), Z-Image (Base/Turbo), WAN 2.7 (Std/Pro/Edit/ProEdit), Qwen 2 (Std/Pro/Edit/ProEdit), Grok (Std/Pro)

**Stranou (legacy panely):** Luma Photon, Mystic, Freepik Edit — mají unikátní parametry

**14 unified controls:** Resolution toggle · Steps slider · Guidance slider · Seed input · Thinking Min/High (NB2) · Thinking checkbox (WAN 2.7) · Image count 4 buttons · Image count 10 buttons (Grok) · Acceleration · Safety tolerance slider (FLUX) · Safety checker checkbox · Strength slider (Z-Image Turbo) · Grounding: Google Search · Persistent retry

### 2. Bugs vyřešené ve v200en

**⚠ Orphan `</div>` tag** — po odstranění `wan27CountRow` zůstal 1 vnější zavírací div → layout rozbitý. Fixed.

**⚠ Nechrání proti rozbité HTML struktuře** — Přidána automatická `<div>` balance validace do `build.js`. Při buildu zobrazí `✓ HTML div balance: OK (773 pairs)` nebo `⚠ WARNING: HTML div balance = N`.

**⚠ WAN 2.7 negative_prompt error** — Replicate API `wan-video/wan-2.7-image` tento parametr nepodporuje. Odstraněn ze všech 4 WAN modelů. `thinkingCheckbox` ponechán jen na `wan27_pro`. "Replicate" odstraněno z názvů modelů v dropdownu.

**⚠ Imagen 4 2K resolution — vyřešeno po 5. pokusu!** REST API parametr je `sampleImageSize` (Vertex AI naming), NIKOLI `imageSize` (SDK naming). Google SDK to interně mapuje, REST volání musí použít Vertex název. Platí jen pro Standard a Ultra (ne Fast).

```js
if (!model.id.includes('fast') && imageSize !== '1K') params.sampleImageSize = imageSize;
```

**⚠ Imagen 4 Ultra maxCount:** API vrací max 1 obrázek per call. `maxCount: 1` u Ultra je správně (UI count buttons se nezobrazí). Standard + Fast `maxCount: 4`.

**⚠ Edit Tool Agent paměť** — v `callGeminiTextMultiTurn` se při OpenRouter path posílala jen poslední user message, ne celá historie. Nová funkce `_callOpenRouterMultiTurn()` konvertuje Gemini history formát → OpenAI messages format a posílá celou konverzaci.

### 3. Resolution pixel info — empirické hodnoty

Nová lookup tabulka `_MODEL_LONG_SIDES` s naměřenými long-side hodnotami. `_approxDims(longSide, aspect)` počítá W×H z aspect ratio. FLUX a Z-Image zůstávají na přesných kalkulátorech (`calcFluxDims`, `calcZImageDims`). WAN 2.7 používá pixel whitelist `_WAN27_PIXELS`.

**Naměřené hodnoty (16:9):**

| Model | 1K | 2K | 3K | 4K |
|-------|-----|-----|-----|-----|
| NB2/Pro | 1376 | 2752 | — | 5504 |
| NB1 | 1344 | — | — | — |
| Imagen 4/Ultra | 1408 | **2816** | — | — |
| Imagen Fast | 1408 | — | — | — |
| SeeDream 4.5 | — | 2560 | — | 3840 |
| SeeDream 5 Lite | — | 3136 | 4704 | — |
| Kling V3/O3 | 1360 | 2720 | — | 5440 |
| Qwen 2 | 1664 | 2048 | — | — |
| Grok | 1408 | 2816 | — | — |

### 4. Prefix `[Reference images: ...]` — odstraněn
Úplně odstraněn z `preprocessPromptForModel` (Gemini/xAI). Legacy prefix se stripuje vždy (i když žádné refs). `rewritePromptForModel` cleanup při každém přepnutí modelu. Styles a camera prefix pro Gemini **je nedotčený** — funguje beze změny.

### 5. Crop tool v Annotate modálu
Nový **✂ Crop** button v annotate toolbaru. DOM overlay nad canvasem s tmavou maskou okolo crop rectu.
- **8 handlů**: 4 rohy (NW/NE/SW/SE) + 4 strany (N/E/S/W)
- **Lock ratio** checkbox — zachovat aspect ratio při resize
- **✓ Apply** / **✗ Cancel** tlačítka
- Keyboard: **Enter** = apply, **Esc** = cancel
- Min size: 20px, živý label s rozměry
- Apply: canvas se resize, mask canvas také, history se resetuje
- Architektura podporuje oba prefixy ('p' paint + 'a' annotate), v UI je jen v annotate

### 6. Ostatní
- Prompt upsampling/expansion/enhance zakázáno (FLUX/SeeDream/Qwen2)
- Resolution 512 odstraněna u NB2 a FLUX
- Checkbox `.chk-box` border zesílen z 1px na 1.5px s `var(--dim2)`
- ⚡ ikona u assetů odstraněna (bod 9 z TODO)
- `callImagen` přidán seed parametr
- `grok_imagine_pro` default res: 2K

---

## Klíčové technické detaily

### Unified panel architecture
```
models.js:   MODELS[key].resolutions  → labels for toggle
             MODELS[key].resValues    → label→apiValue mapping
             MODELS[key].maxCount     → which count row (4 or 10)
             isUnifiedModel(m)        → true for 9 types
             updateUnifiedResInfo()   → pixel info per model
             _MODEL_LONG_SIDES        → empirical long-side table
             _approxDims(ls, aspect)  → computes W×H

model-select.js: selectModel(key) shows/hides by flags
                 _buildResToggle, _setStepsDefaults, _setGuidanceDefaults

generate.js: reads upRes, upSteps, upGuidance, upSeed, upNeg, upCount4/10,
             upThinkRadio/Chk, upAccel, upSafetySlider/Chk, upStrength,
             upGrounding, upRetry → same snap formats as before
```

### Element ID mapping (old → new)
```
nbRes/fluxQuality/sdQuality/klingRes/zimageRes/qwen2Res/grokRes/wan27Tier → upRes
nbCount/fluxCount/sdCount/klingCount/zimageCount/qwen2Count → upCount4
grokCount → upCount10
fluxSteps/zimageSteps/qwen2Steps → upSteps
fluxGuidance/zimageGuidance/qwen2Guidance → upGuidance
fluxSeed/sdSeed/zimageSeed/qwen2Seed/wan27Seed → upSeed
wan27Neg/zimageNeg/qwen2Neg → upNeg
fluxSafety → upSafetySlider
sdSafety/zimageSafety/qwen2Safety → upSafetyChk
zimageAccel/qwen2Accel → upAccel
zimageStrength → upStrength
useSearch → upGrounding
persistentRetry → upRetry
thinking → upThinkRadio
wan27Thinking → upThinkChk
```

### Imagen 4 REST API — 2K breakthrough
```js
// REST API: sampleImageSize (Vertex naming) for Standard+Ultra
const params = { sampleCount, aspectRatio };
if (!model.id.includes('fast') && imageSize !== '1K')
  params.sampleImageSize = imageSize;  // "2K"

// Ultra returns max 1 image per call → sampleCount forced to 1
const sampleCount = model.id.includes('ultra') ? 1 : (snap?.sampleCount || 1);
```

### Edit Tool chat memory — OpenRouter multi-turn
```js
async function _callOpenRouterMultiTurn(systemPrompt, history, ...) {
  const messages = [{role: 'system', content: systemPrompt}];
  for (const turn of history) {
    const role = turn.role === 'model' ? 'assistant' : 'user';
    const content = (turn.parts || []).map(p => p.text || '').join('\n').trim();
    if (content) messages.push({ role, content });
  }
  // POST to OpenRouter with full messages array
}
```

### Crop tool architecture
```
DOM overlay (aCropOverlay) over annotate canvas:
  - pcrop-rect with 8 handles (.nw .n .ne .e .se .s .sw .w)
  - pcrop-size-lbl showing "W × H"
  - box-shadow: 0 0 0 99999px rgba(0,0,0,.55) creates dark mask

_pCropState: { prefix, x, y, w, h, lockAspect, aspectRatio, dragMode, dragStart }

pCropApply():
  1. const cropped = ctx.getImageData(x, y, w, h)
  2. canvas.width = w; canvas.height = h
  3. ctx.putImageData(cropped, 0, 0)
  4. Same for maskCtx if exists
  5. Reset history (no undo across crop boundary)
```

---

## TODO (prioritní pořadí)

1. Style Library "My Presets"
2. Claid.ai via proxy
3. GPT Image 1.5
4. Hailuo 2.3
5. Use button for V2V models
6. Runway Gen-4 Image + Video (research hotový)
7. Recraft V4
8. ~~Unified panel refactor (images)~~ ✅ v200en
9. ~~⚡ ikona u assetů~~ ✅ v200en
10. Unified panel for video models (phase 2)
11. Z-Image Edit (`fal-ai/z-image/edit`)
12. Clarity 8×/16× via proxy
13. Vidu Q3 Turbo
14. Wan 2.6 R2V
15. Seedance 2.0
16. Ideogram V3
17. Recraft V4
18. GPT Image 1.5
19. Hailuo 2.3

---

## Pending pro v201en

Petr zmínil že bude mít ještě jeden problém — popsaný v příštím chatu.

---

## Pravidla a principy

- **⚠ CRITICAL — `/mnt/project/` je VŽDY stale. NIKDY ho nepoužívat.**
- **Session start:** (1) načíst STAV.md z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) `node build.js NNNen → dist/`
- **Syntax check po každém buildu:** `sed -n 'SCRIPT_START,SCRIPT_ENDp' dist/gis_vNNNen.html > /tmp/check.mjs && node --input-type=module < /tmp/check.mjs` → OK = "window is not defined"
- **HTML validation** — build.js nyní zobrazuje `✓ HTML div balance: OK (N pairs)`. Pokud unbalanced, layout se rozbije.
- **NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele.**
- **Vždy důkladně prozkoumat** (web search, probe APIs) než prohlásit že něco nejde. Imagen 2K to jasně ukázal — "nešlo to" 4×, pak 5. pokus s `sampleImageSize` fungoval napoprvé.
- **REST API parameter names**: dokumentace obvykle ukazuje SDK jména (Python/JS). Při REST volání musí být Vertex AI konvence (např. `sampleImageSize` místo `imageSize`, `sampleCount` místo `numberOfImages`).
- **Research API maturity + regional dostupnost** před integrací.
- **Research přesný API whitelist** (size, aspect, maxRefs) — vždy kontrolovat playground/docs.
- **fal.ai vs. direct APIs:** fal.ai ~15–30% dražší ale preferovaný pro nepravidelné použití.
- **Worker free tier:** 30s wall-clock limit — nikdy nepollovat uvnitř Workeru.
- **Snap count v `addToQueue`:** každý nový model musí mít svůj count field.
- **xAI concurrency limit:** max 2 concurrent requesty.
- **Qwen 2 Edit maxRefs:** 3 (ne 4!). Ověřeno API errorem.
- **Grok Pro maxRefs:** 1. Standard: 5.
- **Ref prefix:** ODSTRANĚN ve v200en. Žádný `[Reference images: ...]`. Styles/camera prefix pro Gemini nedotčený.
- **OpenRouter (Claude Sonnet 4.6)** je PRIMARY agent pro všechny tool features.
- **xAI Video Edit payload:** `video: {url}` objekt, NE `video_url` flat string.
- **Rozhodnutí nedělat za Petra** — u složitějších funkcí prezentovat options.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Google Gemini/Imagen, Luma, Kling, Replicate (WAN 2.7 Image), Freepik/Magnific, Topaz, PixVerse, xAI/Grok (Image + Video), OpenRouter (Claude Sonnet 4.6)
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
