# GIS — STAV PROJEKTU
*Aktualizováno konec session · 5. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v182en.html | 5. 4. 2026 |
| Worker | gis-proxy v2026-08 | 5. 4. 2026 |

**Příští verze:** v183en

> Build: `cd /home/claude && node build.js 183en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "model-select.js — switchView flex (NE block!):" && grep -c "'flex'" /mnt/project/model-select.js && \
echo "model-select.js — freepikEditParams:" && grep -c "freepikEditParams" /mnt/project/model-select.js && \
echo "models.js — freepik_relight:" && grep -c "freepik_relight" /mnt/project/models.js && \
echo "models.js — copyright 2026:" && grep -c "2026" /mnt/project/models.js && \
echo "generate.js — proxy_freepik_edit:" && grep -c "proxy_freepik_edit" /mnt/project/generate.js && \
echo "template.html — freepikEditParams:" && grep -c "freepikEditParams" /mnt/project/template.html && \
echo "video.js — MAGNIFIC_VIDEO_MODELS[currentKey]:" && grep -c "MAGNIFIC_VIDEO_MODELS\[currentKey\]" /mnt/project/video.js && \
echo "gallery.js — magnific_prec:" && grep -c "magnific_prec" /mnt/project/gallery.js && \
echo "proxy.js — callProxyMystic:" && grep -c "callProxyMystic" /mnt/project/proxy.js && \
echo "output-render.js — 10 \* 60:" && grep -c "10 \* 60" /mnt/project/output-render.js && \
echo "magnific.js — handleMagnificMystic:" && grep -c "handleMagnificMystic" /mnt/project/magnific.js && \
echo "index.js — 2026-08:" && grep -c "2026-08" /mnt/project/index.js
```
Vše musí vrátit ≥ 1. Pokud `0` → zastav, informuj uživatele, požádej o re-upload modulu.

**Kritické — switchView musí mít 'flex' NE 'block':**
```bash
grep "setupView.*display" /mnt/project/model-select.js
# Musí obsahovat: 'flex' — NIKDY 'block'
```

---

## Kde jsme přestali — session ukončena čistě

v182en dokončen a ověřen. Opravena regrese: switchView('setup') → display:block místo display:flex.

**Proxy soubory k deployi (C:\Users\Petr\Documents\gis-proxy):**
- `handlers/magnific.js` — 5 nových handlerů + rozšířený status, `video_url` místo `video_b64`
- `index.js` — 5 nových routes, verze → 2026-08

Po nakopírování: `npm run deploy`

---

## Opravy v182en — souhrn celé série (5. 4. 2026)

### Mystic image generation
- 6 modelů (realism/fluid/zen/flexible/super_real/editorial_portraits), type `proxy_mystic`
- `MYSTIC_ASPECT_MAP`, resolution 1K/2K/4K, engine, count 1–4, structure/style refs
- Parallelní generace přes `Promise.allSettled`

### Freepik Edit Tools jako regulérní image modely
- `freepik_relight`, `freepik_style`, `freepik_skin` — type `proxy_freepik_edit`
- Relight: prompt+style(smooth/detailed)+change_background+interpolate+strength
- Style Transfer: ref[0]=source, ref[1]=style (required 2 refs)
- Skin Enhancer: creative/faithful/flexible, sharpen, smart_grain
- `freepikEditParams` div v template.html s 3 sub-panely

### Magnific Video Upscaler
- 2 módy: Creative (creativity/flavor), Precision (strength)
- Video se uploaduje přes fal.ai storage → HTTPS URL → Freepik (oprava 400 chyby)
- Sdílí `topazSrcVideoId`, `openTopazFromGallery` + `useVideoFromGallery` rozšířeny
- ✦ Topaz → ✦ Upscale na kartách videí

### Batch upscale (gallery.js)
- Přidány: Magnific Precision, Topaz Gigapixel, Topaz Bloom (4 nové módy)

### Timeouts
- Magnific Creative + Precision: 5 min → 10 min

### Copyright 2026
- models.js + template.html (3×) + model-select.js switchView `display:flex` opraven

### Proxy (v2026-08)
- 5 nových routes, rozšířený status handler (9 typů), `video_url` parameter

---

## Aktivní TODO (v pořadí priority)
- [ ] #1 Style Library "My Presets"
- [ ] #4 Clarity 8×/16×
- [ ] #5 Claid.ai
- [ ] #6 WAN audio (DashScope)
- [ ] #7 Vidu Q3 Turbo
- [ ] #8 Wan 2.6 R2V
- [ ] #9 Seedance 2.0
- [ ] #10 Ideogram V3
- [ ] #11 Recraft V4
- [ ] #12 GPT Image 1.5
- [ ] #13 Hailuo 2.3

---

## Modulární struktura
### Build pořadí (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```
