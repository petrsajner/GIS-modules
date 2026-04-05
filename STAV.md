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

## GitHub — zdrojové moduly
**Repozitář:** https://github.com/petrsajner/GIS-modules

Na začátku každé session načíst klíčové moduly přímo z GitHubu (místo /mnt/project/):
```
https://github.com/petrsajner/GIS-modules/blob/main/models.js
https://github.com/petrsajner/GIS-modules/blob/main/model-select.js
https://github.com/petrsajner/GIS-modules/blob/main/generate.js
https://github.com/petrsajner/GIS-modules/blob/main/proxy.js
https://github.com/petrsajner/GIS-modules/blob/main/output-render.js
https://github.com/petrsajner/GIS-modules/blob/main/video.js
https://github.com/petrsajner/GIS-modules/blob/main/gallery.js
https://github.com/petrsajner/GIS-modules/blob/main/template.html
https://github.com/petrsajner/GIS-modules/blob/main/STAV.md
```
GitHub je autoritativní zdroj — vždy aktuálnější než /mnt/project/ cache.

---

## Session start — POVINNÝ první krok

### 1. Načíst STAV.md z GitHubu
```
https://github.com/petrsajner/GIS-modules/blob/main/STAV.md
```

### 2. Version check (záloha pokud GitHub nedostupný)
```bash
echo "model-select.js — switchView MUSÍ být 'flex' NE 'block':" && \
  grep "setupView.*display" /mnt/project/model-select.js && \
echo "models.js — copyright 2026:" && grep -c "2026" /mnt/project/models.js && \
echo "models.js — freepik_relight:" && grep -c "freepik_relight" /mnt/project/models.js && \
echo "generate.js — proxy_freepik_edit:" && grep -c "proxy_freepik_edit" /mnt/project/generate.js && \
echo "template.html — freepikEditParams:" && grep -c "freepikEditParams" /mnt/project/template.html && \
echo "video.js — MAGNIFIC_VIDEO_MODELS[currentKey]:" && grep -c "MAGNIFIC_VIDEO_MODELS\[currentKey\]" /mnt/project/video.js && \
echo "gallery.js — magnific_prec:" && grep -c "magnific_prec" /mnt/project/gallery.js && \
echo "output-render.js — 10 * 60:" && grep -c "10 \* 60" /mnt/project/output-render.js && \
echo "magnific.js — handleMagnificMystic:" && grep -c "handleMagnificMystic" /mnt/project/magnific.js && \
echo "index.js — 2026-08:" && grep -c "2026-08" /mnt/project/index.js
```
Vše musí vrátit ≥ 1. `switchView` musí mít `'flex'` — NIKDY `'block'`.

---

## Kde jsme přestali

v182en dokončen, otestován, soubory na GitHubu. Session ukončena čistě.

**Proxy Worker k deployi** (pokud ještě nebylo):
```
C:\Users\Petr\Documents\gis-proxy\handlers\magnific.js
C:\Users\Petr\Documents\gis-proxy\index.js
→ npm run deploy
```
Worker verze musí být **2026-08**.

---

## Co bylo implementováno v182en — souhrn

### Mystic image generation (nové modely)
- 6 modelů: `mystic_realism`, `mystic_fluid`, `mystic_zen`, `mystic_flexible`, `mystic_super_real`, `mystic_editorial`
- type `proxy_mystic`, Freepik API klíč, proxy `/magnific/mystic`
- MYSTIC_ASPECT_MAP, resolution 1K/2K/4K, engine (Auto/Illusio/Sharpy/Sparkle), count 1–4
- Ref[0] → structure reference, Ref[1] → style reference
- Parallelní generace přes Promise.allSettled

### Freepik Edit Tools jako regulérní image modely
- `freepik_relight`, `freepik_style`, `freepik_skin` — type `proxy_freepik_edit`, `editModel: true`
- Relight: prompt (osvětlení) + style (smooth/detailed) + change_background + interpolate + light_transfer_strength
- Style Transfer: ref[0]=source (req), ref[1]=style source (req), is_portrait, fixed_generation
- Skin Enhancer: creative/faithful/flexible, sharpen, smart_grain
- `freepikEditParams` div v template.html s 3 sub-panely

### Magnific Video Upscaler — opravy
- Video uploadováno přes fal.ai storage → HTTPS URL → Freepik (fix 400 chyby "HTTP URL not allowed")
- `openTopazFromGallery` + `useVideoFromGallery` rozšířeny pro Magnific video
- ✦ Topaz → ✦ Upscale přejmenováno na kartách videí

### Batch upscale — nové módy
- Přidány: Magnific Precision, Topaz Gigapixel, Topaz Bloom (+4 módy celkem)

### Timeouts
- Magnific Creative + Precision: 5 min → 10 min

### Copyright 2026 — opraveno
- `models.js`: `GIS_COPYRIGHT © 2026`
- `template.html`: 3× © 2026
- `model-select.js`: `switchView` `display:'flex'` (bylo `'block'` — regrese opravena)

### Proxy v2026-08
- 5 nových routes: `/magnific/mystic`, `/magnific/skin-enhancer`, `/magnific/relight`, `/magnific/style-transfer`, `/magnific/video-upscale`
- `handleMagnificStatus` rozšířen na 9 typů
- `handleMagnificVideoUpscale` přijímá `video_url` (HTTPS) i `video_b64`

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

## Systémové poznámky

### GitHub workflow (nový od 5. 4. 2026)
- Zdrojové moduly jsou na https://github.com/petrsajner/GIS-modules
- Na konci každé session: Petr nahraje nové moduly na GitHub (Add file → Upload files → přepsat stávající)
- Na začátku každé session: Claude načte moduly přes web_fetch z GitHub blob URL
- Tím se obchází problém se zastaralými /mnt/project/ soubory (cache bug na straně platformy)

### Regrese watch-list
Tyto bugy se opakovaně vracely — kontrolovat vždy:
- `switchView`: `display:'flex'` NE `'block'` (model-select.js)
- `GIS_COPYRIGHT`: rok 2026 (models.js)
- Timeout Magnific: 10 min (output-render.js)

### Proxy deploy (Windows)
```
cd C:\Users\Petr\Documents\gis-proxy
npm run deploy
```

---

## Modulární struktura
### Build pořadí (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```
### Worker soubory
```
index.js                    — hlavní router, verze 2026-08
handlers/magnific.js        — Magnific/Freepik handlery
handlers/topaz-image.js     — Topaz image upscale
luma.js                     — Luma handlery
fal.js                      — fal.ai handlery
replicate-wan27.js          — WAN 2.7 image
replicate-wan27v.js         — WAN 2.7 video I2V
replicate-wan27e.js         — WAN 2.7 edit
```
