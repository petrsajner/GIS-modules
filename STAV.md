# STAV.md — Generative Image Studio

## Aktuální verze: v201en
## Příští verze: v202en
## Datum: 2026-04-16
## Worker verze: 2026-16 (beze změny)

---

## Co je v v201en (oproti v200en)

### 1. Paint Engine — paralelní annotation layer
Přidán `_annotateAnnotCanvas` jako paralelní offscreen canvas vedle `_annotateMaskCanvas`. Tahy se nadále kreslí do hlavního display ctx (pro okamžitou vizibilitu) a zároveň do dedikovaného annotation canvasu (barevně, transparentní pozadí). Method B už nepoužívá diff rekonstrukci — čte přímo z `_annotateAnnotCanvas`.

**Architektura:**
- `eng.canvas` (display) — composite obrázku + tahů (pro viewing)
- `eng.history[0]` — čistý originální obrázek (nikdy se nemění tahy)
- `_annotateMaskCanvas` — bílé tahy pro inpaint masku (beze změny od před)
- `_annotateAnnotCanvas` — **nové** — barevné tahy na transparentním pozadí

Draw operace (pen, shape, text, flood fill) kreslí do všech 3 ctx: display ctx + maskCtx + annotCtx. Undo / clear / crop synchronně resetují všechny tři.

**Co se tím vyřešilo:**
- "Anotuj → crop → Save B" už nevrací bílou plochu jako layer 2 (byl to diff(ctx - history[0]) = 0 po cropu, který přepisoval history[0] aktuálním ctx)
- Čistý annotation layer bez závislosti na stavu obrázku
- Odstraněna diff rekonstrukce — robustnější chování

### 2. Crop bugs vyřešené
Tři bugy v crop flow, postupně odkryté:

**(a) Method B Layer 2 prázdný po anotace→crop→save:**
`pCropApply` přepisoval `history[0]` aktuálním ctx (= obrázek + anotace). Diff s current=orig = 0 → bílá plocha. Fixed přes nový annotCanvas (bod 1).

**(b) Method B Layer 1 obsahoval anotace po anotace→crop→save:**
`history[0]` je "clean originál" invarianta. Po cropu byl přepsaný aktuálním ctx (obrázek + anotace). Fix: v `pCropApply` se history[0] vyrobí cropováním pristinního původního `history[0]` (přes drawImage s clip), ne přepsáním aktuálního ctx.

**(c) Inpaint source z levého horního rohu po anotace→crop→inpaint:**
`_annotateBaseB64` se nastavuje v `openAnnotateModal` a po cropu zůstával na původním plnorozměrném obrázku. Inpaint crop přes `drawImage(_annotateBaseB64, cropX, cropY, cropW, cropH, ...)` byl ze starých souřadnic aplikovaných na pre-crop obrázek → vzalo levý horní roh. Fix: `pCropApply` aktualizuje `_annotateBaseB64` cropnutým čistým base (stejný canvas co se používá pro history[0]).

### 3. Inpaint soft-blend composite — posun/zmenšení výsledku
V `_compositeAndSaveQueueJob` soft-blend path (aktivní při `maskBlur > 0`):
```js
rc.drawImage(ri, 0, 0);    // 3-param — natural size
rc.drawImage(mi, 0, 0);    // 3-param — natural size
cc.drawImage(resultCrop, cropX, cropY);
```
Pokud model vrátil výsledek v menším rozlišení než `cropW×cropH` (častý případ pro nečtverce), content se nakreslil jen do levého horního rohu `resultCrop` canvasu a zbytek zůstal transparentní. Composite back pak vložil obsah posunutý nahoru-doleva vůči target oblasti.

Fix: force 5-param drawImage s cílovými rozměry `cropW × cropH` pro `ri` i `mi`. Hard-blend path už 5-param měl.

### 4. Z-Image Turbo — split T2I / I2I
Dřív `zimage_turbo` byl hybrid: `refs: true, maxRefs: 1, i2iModel: true, strength: true`. Přepínal endpoint podle toho jestli má uživatel ref:
- bez refu → `fal-ai/z-image/turbo` (T2I)
- s refem → `fal-ai/z-image/turbo/image-to-image` (I2I)

**Problém:** strength slider se zobrazil vždy, i v T2I módu kde je irelevantní. Kromě toho slider se navíc skrýval/zobrazoval podle `refs.length > 0` ve dvou místech (`model-select.js` + `refs.js`).

**Rozdělení:**
- `zimage_turbo` — čistě T2I, endpoint `fal-ai/z-image/turbo`, bez refs/strength
- `zimage_turbo_i2i` — čistě I2I, endpoint `fal-ai/z-image/turbo/image-to-image`, ref required, strength slider aktivní vždy

Dropdown separator mezi Z-Image a WAN skupinami přidán (dříve sdíleli společnou skupinu).

### 5. Drobné UI fixy
- **`\u25b8` bug** v negative prompt label (collapsible šipka): HTML text obsahoval JS escape `\u25b8` — HTML nezná JS escape, zobrazilo se literálně. Fix: přímé Unicode znaky `▸` / `▾` (funguje v HTML i JS kontextu).
- **Strength slider visibility** — dvě redundantní podmínky (`model-select.js` + `refs.js`) používaly `refs.length > 0`. Druhá byla zastaralá z hybrid éry. Odstraněna; nyní řídí jediný bod v `model-select.js` podle `m.strength` flag.

### 6. Segmind cleanup
Segmind API klíč odstraněn z:
- `template.html` — celý SEGMIND API KEY block
- `setup.js` — localStorage load, `onSetupSegmindKey` handler, `API_KEY_FIELDS` entry
- `spending.js` — `'segmind'` ze `SPEND_PROVIDERS`

Důvod: Segmind WAN 2.7 implementace je opuštěná (square-only output, v196en byl nahrazen Replicate s full aspect ratio whitelist). Odstranění rozbilo střídání pruhů v setup UI (Segmind byl mezi PIXVERSE a REPLICATE).

Worker handler pro Segmind ponechán — cleanup Workeru v následující session.

---

## Změněné moduly

| Modul | Řádků | Popis změn |
|-------|-------|------------|
| paint.js | ~2080 | +80: annotCtx, annotSnapshot, annotHistory + všechny mirror operace v draw/undo/clear/crop/inpaint-resize. Method B přepsán bez diffu. pCropApply aktualizuje `_annotateBaseB64`. Soft-blend composite 5-param drawImage. |
| models.js | ~638 | zimage_turbo split — T2I + I2I jako dva modely |
| model-select.js | ~348 | Strength slider unconditional podle `m.strength`. zimage_turbo descriptions. I2I note "Input image required" (místo "No image = T2I"). |
| refs.js | ~838 | Odstraněna zastaralá strength toggle logika (dvojí řízení) |
| template.html | ~4940 | Z-Image dropdown split (3 options), separator k WAN, `\u25b8` → `▸` v neg prompt, Segmind block odstraněn |
| setup.js | ~285 | Segmind load/handler/export odstraněn |
| spending.js | ~285 | `'segmind'` ze SPEND_PROVIDERS |

---

## TODO (prioritní pořadí)

1. **Style Library "My Presets"**
2. **Claid.ai via proxy**
3. **GPT Image 1.5**
4. **Hailuo 2.3**
5. **Use button for V2V models**
6. **Runway Gen-4 Image + Video** (výzkum hotový)
7. **Recraft V4**
8. **Unified panel pro video modely** (fáze 2, analogicky k image unified v v200en)
9. **Z-Image LoRA generation** (`fal-ai/z-image/turbo/lora` + `fal-ai/z-image/base/lora`) — UI pro až 3 LoRA modely s váhou 0.6–1.0
10. **Z-Image LoRA trainer** (`fal-ai/z-image-trainer`) — kompletně jiný UX (ZIP upload, polling trénování)
11. **Ideogram V3**

### Dokončené v v201en
- ✅ Paint layer refactor + 3 crop bugs + inpaint soft-blend fix
- ✅ Z-Image Turbo T2I/I2I split + dropdown separator
- ✅ Segmind cleanup

### Odepsané
- ~~Z-Image Edit (`fal-ai/z-image/edit`)~~ — endpoint v Z-Image rodině neexistuje (jen T2I `base`/`turbo`, I2I `turbo/image-to-image`, LoRA endpointy, trainer)
- ~~Recraft Crisp upscale bug~~ — vyřešen (posílal se moc velký upscale; limity + kontroly přidány)
- ~~Seedance 2.0~~ — přidáno
- ~~WAN 2.6 R2V~~ — nebudeme řešit
- ~~Vidu Q3 Turbo~~ — nebudeme řešit
- ~~Clarity 8×/16× via proxy~~ — neřešíme

---

## Klíčové technické detaily

### Paint engine — 3 parallel canvases (v201en)
```
eng.canvas (display)     = base + strokes composite (viewing)
eng.history[0]           = clean original image (invariant, never touched by strokes)
_annotateMaskCanvas      = white strokes for inpaint mask (since v100)
_annotateAnnotCanvas     = color strokes, transparent bg (NEW, for Method B export)

Draw op (pen/shape/text/bucket):
  1. Draw on state.ctx (display)        — user sees it immediately
  2. Draw on state.maskCtx (monochrome) — inpaint mask updated
  3. Draw on state.annotCtx (color)     — clean annotation layer
  4. saveHistory() pushes all 3 snapshots

Undo: pop from all 3 histories, putImageData back
Clear: reset display to history[0], clear maskCtx + annotCtx
Crop: getImageData(x,y,w,h) from all 3, resize canvases, reset histories
      + history[0] regenerated from pristine full history[0] (drawImage clip)
      + _annotateBaseB64 updated from new history[0]

Method A save: eng.canvas.toDataURL()                  // already composite
Method B save: { history[0], whiteBg + annotCanvas }   // no diff needed
```

### Z-Image endpoints (v201en)
| Model | Endpoint | Type |
|-------|----------|------|
| `zimage_base` | `fal-ai/z-image/base` | T2I standard (28 steps, CFG, neg prompt) |
| `zimage_turbo` | `fal-ai/z-image/turbo` | T2I ultra-fast (8 steps, acceleration) |
| `zimage_turbo_i2i` | `fal-ai/z-image/turbo/image-to-image` | I2I (ref required, strength slider) |

Dispatch v `callZImage`: `model.id` přímo jako endpoint path (žádná dynamika přepínání už není potřeba, ale legacy logika `i2iModel && refs.length > 0 → turbo/image-to-image` ponechána jako fallback pro případný refactor).

### Inpaint composite (v201en)
```js
// Hard-blend (maskBlur = 0) — už byl OK
cc.drawImage(ri, cropX, cropY, cropW, cropH);  // 5-param → force resize

// Soft-blend (maskBlur > 0) — fix v v201en
rc.drawImage(ri, 0, 0, cropW, cropH);  // force cropW×cropH
rc.drawImage(mi, 0, 0, cropW, cropH);  // force cropW×cropH
cc.drawImage(resultCrop, cropX, cropY);
```

---

## Pravidla a principy

- **⚠ CRITICAL — `/mnt/project/` je VŽDY stale. NIKDY ho nepoužívat.**
- **Session start:** (1) načíst `STAV.md` z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) `node build.js NNNen → dist/`
- **Syntax check po buildu:** `sed -n 'SCRIPT_START,SCRIPT_ENDp' dist/gis_vNNNen.html > /tmp/check.mjs && node --input-type=module < /tmp/check.mjs` → OK = "window is not defined"
- **HTML validation** — build.js zobrazuje `✓ HTML div balance: OK (N pairs)`
- **NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele.**
- **Vždy důkladně prozkoumat** (web search, probe APIs) než prohlásit že něco nejde.
- **Research API maturity + regionální dostupnost** před integrací. Z-Image Edit je typický případ — endpoint v TODO, ale neexistuje. Research potvrdil že Z-Image rodina má jen T2I/I2I/LoRA/trainer.
- **REST API parameter names**: Vertex AI naming pro Google REST (sampleImageSize, sampleCount), SDK naming v dokumentaci.
- **Worker free tier:** 30s wall-clock limit — nikdy nepollovat uvnitř Workeru.
- **Snap count v `addToQueue`:** každý nový model musí mít svůj count field.
- **xAI concurrency limit:** max 2 concurrent requesty.
- **Qwen 2 Edit maxRefs:** 3. **Grok Pro maxRefs:** 1. **Standard:** 5.
- **Ref prefix:** ODSTRANĚN ve v200en. Styles/camera prefix pro Gemini nedotčený.
- **OpenRouter (Claude Sonnet 4.6)** je PRIMARY agent pro všechny tool features.
- **xAI Video Edit payload:** `video: {url}` objekt.
- **Dedicated I2I/Edit model flag `strength: true`** → slider zobrazit vždy (nezávisí na refs.length).
- **Paint engine invariant:** `history[0]` = čistý originál, nikdy přepsán aktuálním ctx. `annotCanvas` = klon anotací, nezávislý na base.
- **Rozhodnutí nedělat za Petra** — u složitějších funkcí prezentovat options.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Google Gemini/Imagen, Luma, Kling, Replicate (WAN 2.7 Image), Freepik/Magnific, Topaz, PixVerse, xAI/Grok (Image + Video), OpenRouter (Claude Sonnet 4.6)
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
