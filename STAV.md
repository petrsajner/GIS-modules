# GIS — STAV PROJEKTU
*Aktualizováno konec session · 6. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v183en.html | 6. 4. 2026 |
| Worker | gis-proxy v2026-09 | 6. 4. 2026 |

**Příští verze:** v184en

> Build: `cd /home/claude && node build.js 184en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "model-select.js — switchView flex (NE block!):" && grep -c "'flex'" /mnt/project/model-select.js && \
echo "model-select.js — freepikEditParams:" && grep -c "freepikEditParams" /mnt/project/model-select.js && \
echo "models.js — freepik_relight:" && grep -c "freepik_relight" /mnt/project/models.js && \
echo "models.js — copyright 2026:" && grep -c "2026" /mnt/project/models.js && \
echo "generate.js — proxy_freepik_edit:" && grep -c "proxy_freepik_edit" /mnt/project/generate.js && \
echo "template.html — wan27vParams:" && grep -c "wan27vParams" /mnt/project/template.html && \
echo "video.js — wan27_t2v:" && grep -c "wan27_t2v" /mnt/project/video.js && \
echo "video.js — callWan27Video.*falEndpoint:" && grep -c "falEndpoint" /mnt/project/video.js && \
echo "gallery.js — magnific_prec:" && grep -c "magnific_prec" /mnt/project/gallery.js && \
echo "magnific.js — handleR2Upload:" && grep -c "handleR2Upload" /mnt/project/magnific.js && \
echo "index.js — 2026-09:" && grep -c "2026-09" /mnt/project/index.js
```
Vše musí vrátit ≥ 1. Pokud `0` → zastav, informuj uživatele, požádej o re-upload modulu.

**Kritické — switchView musí mít 'flex' NE 'block':**
```bash
grep "setupView.*display" /mnt/project/model-select.js
# Musí obsahovat: 'flex' — NIKDY 'block'
```

---

## Kde jsme přestali — session ukončena čistě

v183en dokončen a ověřen. Worker v2026-09 deployován.

**Stav modulů (po session 6. 4. 2026):**
- `video.js` — velké změny (R2 upload, WAN 2.7 fal.ai migrace, unified video input, Kling V2V)
- `template.html` — wan27vParams přesunuto do videoLeftContent (bug fix), nové panely
- `magnific.js` — R2 bucket, generic upload/serve endpoints
- `index.js` — verze 2026-09, R2 routes, Kling V2V fix
- `setup.js` — R2 cleanup při startu
- `gallery.js` — batch upscale modal unifikace
- `spending.js` — WAN 2.7 fal.ai pricing

**Worker deploy files (C:\Users\Petr\Documents\gis-proxy):**
- `handlers/magnific.js` — R2 bucket, video upload/serve, cleanup
- `src/index.js` — R2 routes (upload, serve, cleanup), video-file route
- `wrangler.toml` — R2 binding `[[r2_buckets]] binding="VIDEOS" bucket_name="gis-magnific-videos"`

**R2 bucket (jednou):** `wrangler r2 bucket create gis-magnific-videos`

---

## Opravy v183en — souhrn (6. 4. 2026)

### Cloudflare R2 — universal video storage
- Bucket: `gis-magnific-videos`, binding: `VIDEOS`
- `POST /r2/upload` — přijme raw binary, uloží do R2, vrátí HTTPS URL
- `GET /r2/serve/{key}` — streamuje z R2
- `POST /magnific/video-cleanup` — smaže vše (volá se při startu GIS fire-and-forget)
- Nahrazuje: fal.ai storage (CORS), Replicate /v1/uploads (404), Replicate Files (JSON místo binary)

### Magnific Video Upscaler — fix
- Videa uploadována přes R2 (ne fal.ai/Replicate)
- Kling V2V: stejné R2 upload (`uploadVideoToFal` přesměrována na `/r2/upload`)
- `handleMagnificVideoFile` → `handleMagnificVideoFile` (přes R2, ne Replicate proxy)

### Kling V2V Motion Control — kompletní fix
- Endpointy opraveny: `video-to-video` → `motion-control` (V3 Std/Pro + V2.6 Pro)
- `character_orientation: 'video'` přidán (povinné)
- `image_url` je REQUIRED — validace přidána
- Motion video: uploaduje přes R2 (ne storage.fal.run)
- Gallery pick: `v2vSetFromGallery()` + `useVideoFromGallery` rozšířen

### Unified Video Input UI
- **Kling V2V**: ↑ Upload + ☰ Gallery + thumbnail + ✦ Describe + ✕ Clear
- **Topaz/Magnific**: ✦ Describe přidán
- **WAN 2.7 Video Edit**: kompletní HTML panel přidán (byl zcela chybějící!)
  - `wan27eSrcRow` + `wan27eParams` (Resolution/Duration/Aspect/Audio/Seed/Safety)
- **WAN 2.7 I2V**: `wan27vExtendRow` — Extend video sekce (gallery pick)
- `_describeFromThumb()` — sdílená describe funkce pro všechna vstupní videa

### WAN 2.7 — kompletní migrace na fal.ai
- **T2V** (`fal-ai/wan/v2.7/text-to-video`) — nový model
- **I2V** (`fal-ai/wan/v2.7/image-to-video`) — bylo Replicate (nefunkční CDN URL), teď fal.ai
- **R2V** (`fal-ai/wan/v2.7/reference-to-video`) — nový model
- **Video Edit** (`fal-ai/wan/v2.7/edit-video`) — bylo Replicate (nefunkční), teď fal.ai
  - Zdrojové video: base64 data URI z IndexedDB (žádná CDN URL závislost)
  - Audio: `auto` | `origin` (opraveny správné hodnoty)
- Nové params: Resolution, Duration (select 2-15s), Neg prompt, Prompt expansion, Safety checker, Seed, Audio URL, Extend video (I2V)
- Bug fix: `wan27vParams` byl uvnitř `imgLeftContent` → přesunut do `videoLeftContent`

---

## Aktivní TODO (v pořadí priority)
- [ ] #1 Style Library "My Presets"
- [ ] #4 Clarity 8×/16×
- [ ] #5 Claid.ai
- [ ] #6 WAN audio (DashScope)
- [ ] #7 Vidu Q3 Turbo
- [ ] #9 Seedance 2.0
- [ ] #10 Ideogram V3
- [ ] #11 Recraft V4
- [ ] #12 GPT Image 1.5
- [ ] #13 Hailuo 2.3
- [ ] WAN 2.7 Video Edit — ref image upload přes R2 (místo /replicate/upload/video)
- [ ] WAN 2.7 R2V — ověřit endpoint, otestovat

---

## Modulární struktura
### Build pořadí (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```
