# GIS — STAV PROJEKTU
*Aktualizováno konec session · 8. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v186en.html | 8. 4. 2026 |
| Worker | gis-proxy v2026-10 | 8. 4. 2026 |

**Příští verze:** v187en

> Build: `cd /home/claude && node build.js 187en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "paint.js — _annotateMaskCanvas:" && grep -c "_annotateMaskCanvas" /mnt/project/paint.js && \
echo "paint.js — stale guard:" && grep -c "paintEngines\[prefix\] !== state" /mnt/project/paint.js && \
echo "paint.js — cancelInpaint:" && grep -c "cancelInpaint" /mnt/project/paint.js && \
echo "paint.js — _inpaintAbort:" && grep -c "_inpaintAbort" /mnt/project/paint.js && \
echo "paint.js — openInpaintRefPicker:" && grep -c "openInpaintRefPicker" /mnt/project/paint.js && \
echo "fal.js — _falQueueViaProxy:" && grep -c "_falQueueViaProxy" /mnt/project/fal.js && \
echo "fal.js — callFluxFill:" && grep -c "callFluxFill" /mnt/project/fal.js && \
echo "template.html — inpaintCanvasPreviewCol:" && grep -c "inpaintCanvasPreviewCol" /mnt/project/template.html && \
echo "template.html — inpaintCancelBtn:" && grep -c "inpaintCancelBtn" /mnt/project/template.html && \
echo "model-select.js — switchView flex:" && grep -c "'flex'" /mnt/project/model-select.js && \
echo "models.js — nb1:" && grep -c "nb1:" /mnt/project/models.js && \
echo "gemini.js — streamAccepted:" && grep -c "streamAccepted" /mnt/project/gemini.js
```
Vše musí vrátit ≥ 1.

---

## Kde jsme přestali

v186en + Worker v2026-10 nasazen. Session ukončena čistě.

### Stav inpaint funkce (k 8. 4. 2026):

**✅ FUNGUJE:**
- Paint modal (3-sloupcový layout): levý panel parametrů, střední canvas preview, pravý panel inputů
- Bucket fill (flood fill) — správně vyplňuje masku, ne původní obrázek
- Race condition fix — stale guard v engine event handlerech, `paintEngines['a'] = null` před načítáním
- Maska — offscreen `_annotateMaskCanvas`, správně oddělená od display canvas
- Crop logika — bounding box + margin + downscale warning
- Inpaint panel UI — Back/Canny/Depth/Generate tlačítka, Cancel button (AbortController)
- Depth mapa — ✅ funguje přes Worker proxy (`/depth` → `fal.run/fal-ai/imageutils/depth`)
- Gallery picker pro reference image — `dbGetAll('images')` + thumbnails
- Reference image — upload + library + resize na max 2K

**❌ NEFUNGUJE — PRIORITA PRO v187en:**
- **FLUX Pro Fill** (`flux-pro/v1/fill`) — visí na "Submitting", žádný výsledek
- **FLUX General Inpaint** (`flux-general/inpainting`) — Worker /fal/submit vrací 502
- **Root cause**: `queue.fal.run/fal-ai/flux-pro/v1/fill` i `queue.fal.run/fal-ai/flux-general/inpainting` vracejí nginx 502 bez auth — endpointy pravděpodobně neexistují na queue.fal.run, nebo vyžadují jiný base URL
- **Potřeba zjistit**: správný endpoint pro fal.ai inpaint modely (možná `fal.run` sync, nebo jiná queue URL)

### Worker v2026-10 stav:
- `src/handlers/depth.js` — ✅ nasazen a funkční (fal-ai/imageutils/depth)
- `src/handlers/fal-inpaint.js` — nasazen, ale 502 z upstream queue.fal.run
- `src/index.js` — aktualizován s `/depth` a `/fal/submit|status|result` routes

---

## Co bylo uděláno v v186en (8. 4. 2026)

### Inpaint systém — kompletní implementace (v185→v186)
- Two-layer architecture: `_annotateMaskCanvas` (offscreen) + `annotateCanvas` (display)
- Bucket tool (flood fill) — mask-based pro annotate mode, color-based pro paint tab
- Stale guard — `paintEngines[prefix] !== state` ve všech event handlerech
- `_annotateBaseB64` — čistý originál bez tahů, crop pro API vždy z tohoto
- 3-sloupcový inpaint panel (levý/střed/pravý)
- AbortController + Cancel button + auto-cancel při Close
- Gallery ref picker (`dbGetAll('images')`)
- `_resizeToMaxPx` — reference na max 2K
- ControlNet: Canny (client-side Sobel) + Depth (proxy)
- `_falQueueViaProxy` — inpaint modely přes Worker proxy (CORS fix)

### Worker v2026-09→v2026-10
- Přidán `/depth` route → `fal-ai/imageutils/depth` (sync, CORS proxy)
- Přidán `src/handlers/depth.js` (nový soubor)
- `src/handlers/fal-inpaint.js` (přejmenováno z fal.js aby nedošlo ke konfliktu)
- Interface: `/fal/submit` body `{endpoint, payload}`, `/fal/status` body `{status_url}`, `/fal/result` body `{response_url}`

---

## Aktivní TODO (v pořadí priority)
- [ ] **#0 KRITICKÉ** — Opravit inpaint generate: zjistit správné fal.ai endpointy pro flux-pro/v1/fill a flux-general/inpainting (queue.fal.run vrací 502)
- [ ] #1 Style Library "My Presets"
- [ ] #3 Přidat více inpaint modelů po opravě základu
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

## INPAINT — RESEARCH potřeba před v187en
```
Otázka: Který URL funguje pro fal-ai/flux-pro/v1/fill a fal-ai/flux-general/inpainting?
Zjistit:
1. Zkusit fal.run (sync) místo queue.fal.run
2. Zkusit s platným API klíčem z Petra
3. Zkontrolovat fal.ai playground URL pro tyto modely
```

---

## Modulární struktura
### Build pořadí (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```

### Worker struktura (gis-proxy)
```
src/
  index.js              — main entry (v2026-10)
  handlers/
    xai.js luma.js magnific.js topaz.js topaz-image.js
    replicate-wan27.js replicate-wan27v.js replicate-wan27e.js
    fal-inpaint.js      — /fal/submit|status|result (CORS proxy pro inpaint)
    depth.js            — /depth (fal-ai/imageutils/depth)
```
