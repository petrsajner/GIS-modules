# GIS — STAV PROJEKTU
*Aktualizováno konec session · 8. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v189en.html | 8. 4. 2026 |
| Worker | gis-proxy v2026-10 | 8. 4. 2026 |

**Příští verze:** v190en

> Build: `cd /home/claude && node build.js 190en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "paint.js — inpaintQueue:" && grep -c "inpaintQueue" /mnt/project/paint.js && \
echo "paint.js — openInpaintFromNav:" && grep -c "openInpaintFromNav" /mnt/project/paint.js && \
echo "paint.js — qo-item:" && grep -c "qo-item" /mnt/project/paint.js && \
echo "paint.js — maskBlur:" && grep -c "maskBlur" /mnt/project/paint.js && \
echo "fal.js — callFluxKreaInpaint:" && grep -c "callFluxKreaInpaint" /mnt/project/fal.js && \
echo "fal.js — callFluxFill.*opts:" && grep -c "opts = {}" /mnt/project/fal.js && \
echo "gallery.js — _mzScale:" && grep -c "_mzScale" /mnt/project/gallery.js && \
echo "gallery.js — mInpaintRefBtn:" && grep -c "mInpaintRefBtn" /mnt/project/gallery.js && \
echo "template.html — inpaintNavTab:" && grep -c "inpaintNavTab" /mnt/project/template.html && \
echo "template.html — modalImgViewport:" && grep -c "modalImgViewport" /mnt/project/template.html && \
echo "template.html — inpaintQueueList:" && grep -c "inpaintQueueList" /mnt/project/template.html && \
echo "model-select.js — setup:6:" && grep -c "setup: 6" /mnt/project/model-select.js
```
Vše musí vrátit ≥ 1.

> **Syntax check:**
> ```bash
> awk '/<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' \
>   /home/claude/dist/gis_v189en.html > /tmp/check.mjs
> node --input-type=module < /tmp/check.mjs 2>&1 | head -3
> # OK = "window is not defined"
> ```
> Pozor: template.html má `<script>` na konci řádku s Cloudflare tagy → `/<script>$/` ne `/^<script>$/`

---

## Kde jsme přestali

v189en dokončen. Session ukončena čistě 8. 4. 2026.

---

## Stav inpaint systému (k 8. 4. 2026)

### ✅ Funguje
- Paint modal (3-sloupcový layout), bucket fill, race condition fix (stale guard)
- Maska — offscreen `_annotateMaskCanvas`, oddělená od display canvas
- Crop logika + downscale warning
- Depth mapa přes Worker proxy (`/depth` → `fal-ai/imageutils/depth`)
- **Gallery ref picker**: `📷 Library` → gallery view + floating banner "Inpaint ref pick mode" s `← Return to Inpaint` + `⊕ Inpaint Ref` button v gallery modal
- **Inpaint fronta** (`inpaintQueue[]`): background processing, auto-save do galerie, non-blocking
- **Queue UI**: pravý sloupec inpaint panelu, qo-* CSS třídy (jako video queue), scrollable, `cancelInpaintJob(id)`
- **⊛ Inpaint nav tab**: vždy přístupný v navigaci (za ✏ Paint, před ⚙ Setup), badge s počtem aktivních jobů, otevírá přímo inpaint panel (ne canvas)
- **Mask blur slider** (0–30px): Gaussian blur masky před API + soft blend při compositing
- **Soft composite**: výsledek blendován přes rozmazanou masku (feathered edges)
- **Model-specific parametry**: sections show/hide dle modelu (strength, ControlNet, ref, negPrompt, safety)
- **Gallery modal zoom**: wheel zoom ke kurzoru, drag pan, ⊞ Fit + 100% tlačítka, dblclick toggle, min 0.1× max 12×
- **Gallery modal velikost**: near-fullscreen (min(1820px,98vw) × 97vh)

### Aktivní inpaint modely
| Klíč | Endpoint | Cena | Poznámka |
|------|----------|------|---------|
| `flux_fill` | `fal-ai/flux-pro/v1/fill` | $0.05/MP | FLUX Pro Fill, safety_tolerance param |
| `flux_general` | `fal-ai/flux-general/inpainting` | ~$0.025 | ControlNet (Canny/Depth) + Ref image |
| `flux_dev` | `fal-ai/flux-lora/inpainting` | ~$0.025 | FLUX Dev, rychlý |
| `flux_krea` | `fal-ai/flux-krea-lora/inpainting` | $0.035/MP | Krea fine-tune, esteticky silný |

### Odstraněné / nefunkční modely
- ~~`fast_sdxl`~~ — výsledky slabé, odstraněno
- ~~`playground_v25`~~ — výsledky slabé, odstraněno
- ~~`qwen_inpaint`~~ — vždy vrátil originál nebo přemaloval okolí, odstraněno
- ~~`kontext_inpaint`~~ — streaming-only endpoint, 422 na queue result URL

### ⚠️ Čeká na ověření
- FLUX Krea první testy (přidáno dnes, netestováno)
- Inpaint modely s platným fal.ai klíčem (uživatel testoval FLUX Pro Fill + FLUX Dev)

---

## Co bylo uděláno dnes (8. 4. 2026)

### v186en — Inpaint systém (základ)
- Two-layer architecture (`_annotateMaskCanvas` offscreen + `annotateCanvas` display)
- Bucket fill (flood fill), stale guard race condition fix
- 3-sloupcový layout, AbortController + Cancel
- Depth mapa přes Worker proxy, Gallery ref picker, ControlNet Canny/Depth

### v187en — Opravy
- `callFluxFill` + `callFluxGeneralInpaint`: `_falQueueViaProxy` → `_falQueue`
- template.html: `inpaintCancelBtn` + `flux_fill` option doplněny zpět do template zdroje
- Syntax check pattern: `/<script>$/` místo `/^<script>$/`

### v188en — Inpaint UX + fronta + nové modely
- Gallery ref picker s floating bannerem + `⊕ Inpaint Ref` v gallery modal
- `addToInpaintQueue()` + `_processInpaintQueue()` — background queue, auto-save
- Queue UI v pravém sloupci (qo-* CSS)
- `⊛ Inpaint` nav tab s badge, přímé otevření inpaint panelu
- `cancelInpaintJob(id)`, `clearInpaintQueueDone()`
- 3 nové modely přidány: FLUX Dev, FLUX Krea (plus Qwen/SDXL/Playground — později odstraněny)
- `onInpaintModelChange()` — show/hide sekcí dle modelu

### v189en — Finální opravy + gallery modal zoom
- Nav pořadí: Inpaint před Setup, `model-select.js` `setup: 6`
- `openInpaintFromNav()` → přímo do inpaint panelu (ne canvas)
- Výsledky se neukládají zpět do paint canvasu — maska zachována pro iterace
- Mask blur (0–30px): Gaussian blur masky + soft blend při compositing (`destination-in`)
- Qwen: zkoušeno full-image přístup — stále nefungoval → odstraněn
- SDXL Fast + Playground v2.5 přidány a odstraněny (slabé výsledky)
- `callFluxFill` přepracován: přijímá `opts` {steps, guidance, seed, safetyTolerance}
- Model-specific parametry: negative_prompt (SDXL/Playground), safety_tolerance (flux_fill)
- **Gallery modal**: near-fullscreen resize + wheel zoom + drag pan + ⊞ Fit / 100% tlačítka
- Model select text: `option { color: #111; background: #fff }` — čitelné na bílém pozadí

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

### Změněné moduly v v186–v189en (oproti v185en)
| Modul | Změny |
|-------|-------|
| `paint.js` | Celý inpaint systém, queue, gallery ref, nav, mask blur, soft blend |
| `fal.js` | callFluxFill opts, callFluxDevInpaint, callFluxKreaInpaint, callQwenInpaint (neaktivní), callFastSdxlInpaint (neaktivní), callPlaygroundV25Inpaint (neaktivní), _invertMaskB64 |
| `gallery.js` | mInpaintRefBtn v modal, zoom logika (_mzScale, wheel, drag, dblclick) |
| `template.html` | Inpaint panel (3 sloupce, queue, modely, blur, neg prompt, safety), nav Inpaint tab, modal zoom toolbar + viewport wrapper, modal near-fullscreen CSS |
| `model-select.js` | viewMap `setup: 6` |
| `spending.js` | Ceny inpaint modelů |

### Worker struktura (gis-proxy v2026-10, NEZMĚNĚN)
```
src/
  index.js
  handlers/
    xai.js luma.js magnific.js topaz.js topaz-image.js
    replicate-wan27.js replicate-wan27v.js replicate-wan27e.js
    fal-inpaint.js   — /fal/submit|status|result
    depth.js         — /depth (fal-ai/imageutils/depth)
```
