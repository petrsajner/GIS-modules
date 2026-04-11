# GIS — STAV PROJEKTU
*Aktualizováno konec session · 9. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v191en.html | 9. 4. 2026 |
| Worker | gis-proxy v2026-11 | 9. 4. 2026 |

**Příští verze:** v192en

> Build: `cd /home/claude && node build.js 192en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "paint.js — inpaintQueue:" && grep -c "inpaintQueue" /mnt/project/paint.js && \
echo "paint.js — openInpaintFromNav:" && grep -c "openInpaintFromNav" /mnt/project/paint.js && \
echo "paint.js — qo-item:" && grep -c "qo-item" /mnt/project/paint.js && \
echo "paint.js — maskBlur:" && grep -c "maskBlur" /mnt/project/paint.js && \
echo "fal.js — _runSimpleInpaint:" && grep -c "_runSimpleInpaint" /mnt/project/fal.js && \
echo "fal.js — callFluxFill.*opts:" && grep -c "opts = {}" /mnt/project/fal.js && \
echo "gallery.js — _mzScale:" && grep -c "_mzScale" /mnt/project/gallery.js && \
echo "gallery.js — mInpaintRefBtn:" && grep -c "mInpaintRefBtn" /mnt/project/gallery.js && \
echo "template.html — inpaintNavTab:" && grep -c "inpaintNavTab" /mnt/project/template.html && \
echo "template.html — src-chip:" && grep -c "src-chip" /mnt/project/template.html && \
echo "template.html — inpaintQueueList:" && grep -c "inpaintQueueList" /mnt/project/template.html && \
echo "model-select.js — setup:6:" && grep -c "setup: 6" /mnt/project/model-select.js && \
echo "setup.js — getProxyUrl:" && grep -c "getProxyUrl" /mnt/project/setup.js && \
echo "setup.js — _arrayBufferToBase64:" && grep -c "_arrayBufferToBase64" /mnt/project/setup.js && \
echo "video.js — _saveVideoResult:" && grep -c "_saveVideoResult" /mnt/project/video.js && \
echo "video.js — _falVideoSubmitPollDownload:" && grep -c "_falVideoSubmitPollDownload" /mnt/project/video.js && \
echo "video.js — _srcSlotClear:" && grep -c "_srcSlotClear" /mnt/project/video.js && \
echo "db.js — assets_meta:" && grep -c "assets_meta" /mnt/project/db.js && \
echo "spending.js — openrouter:" && grep -c "openrouter" /mnt/project/spending.js
```
Vše musí vrátit ≥ 1.

> **Syntax check:**
> ```bash
> awk '/<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' \
>   /home/claude/dist/gis_v192en.html > /tmp/check.mjs
> node --input-type=module < /tmp/check.mjs 2>&1 | head -3
> # OK = "window is not defined"
> ```
> Pozor: template.html má `<script>` na konci řádku s Cloudflare tagy → `/<script>$/` ne `/^<script>$/`

---

## Kde jsme přestali

v191en dokončen. Session ukončena čistě 9. 4. 2026.

**v191en = bug fixes + assets performance** — 6 oprav, žádné nové funkce.

---

## Co bylo uděláno dnes (9. 4. 2026)

### v191en — Bug fixes & assets performance

**Fix: OpenRouter spending tracker (spending.js + ai-prompt.js + refs.js):**
- OpenRouter přidán do `SPEND_PROVIDERS` → spend block v setup nyní zobrazuje útratu.
- Nové cenové klíče: `_or_prompt` (~$0.003), `_or_describe` (~$0.010).
- `trackSpend('openrouter', ...)` volán po úspěšných AI Prompt a Describe voláních.

**Fix: Inpaint select readability (template.html):**
- Přidáno `#inpaintResolution option, #inpaintMargin option, #inpaintSafetyTol option { background:#fff; color:#111; }` — dropdown options nyní čitelné.

**Fix: Video like sync (video.js):**
- `openVideoLightboxById` nyní čte `favorite` z `video_meta` store (source of truth), ne z `videos` store (stale).
- Důvod: `videoToggleLike` patchoval jen `video_meta`, ale lightbox četl z `videos` → like se nezobrazoval po přepnutí.

**Fix: Veo 4s/6s duration at 720p (video.js):**
- `onVeoResolutionChange()` nyní voláno po nastavení Veo rozlišení při přepnutí modelu.
- Dříve: model switch defaultoval na 1080p ale NEvolal `onVeoResolutionChange()` → 4s/6s zůstaly disabled navždy.
- Nyní: při 720p jsou 4s/6s enabled, při 1080p/4K jsou disabled + forced 8s.

**Fix: Video thumbnail generator (video.js):**
- `generateVideoThumb` přepsán: seek na 0.5s (místo 0.1s), black-frame detekce, 3 seek pokusy (0.5s → 1.0s → 0.1s), 8s timeout.
- Řeší: Kling 1.6 černý thumbnail (timing), Topaz Astra prázdný thumbnail (codec/loading).

**Perf: Assets page — `assets_meta` store (db.js + assets.js):**
- DB verze 6 → 7: nový `assets_meta` store (bez `imageData`, jen metadata + thumb).
- Automatická migrace z existujících assets při prvním spuštění.
- `renderAssets()`, `renderAssetFolders()`, `selectAllAssets()`, `nextRefAutoName()`, `deleteAssetFolder()` nyní čtou z `assets_meta` (rychlé).
- `createAsset`, `toggleAssetFavorite`, rename, delete — zapisují do obou stores.
- `dbPatchAssetMeta` aktualizován: patchuje `assets` + `assets_meta` v jedné transakci.
- `dbGetAllAssetMeta()` s cache, `dbPutAssetMeta()`, `dbDeleteAssetMeta()` nové helpery.
- Výsledek: asset galerie nenačítá plné imageData (MB) jen pro zobrazení thumbnailů.

**Fix: Image gallery lightbox like/unlike (gallery.js + db.js + output-render.js):**
- `toggleFavoriteItem` nyní centrálně synkuje VŠECHNA UI místa: gallery card, output/render card, gallery modal.
- `toggleFavorite` (heart click) a `setupLikeBtn` (output card) zjednodušeny — jen volají `toggleFavoriteItem`.
- `openGalleryModal` čte `favorite` z `metaCache` (source of truth), ne z `images` store (stale).

**Fix: Save frame flash nefungoval (video.js):**
- CSS selector `[onclick*="saveFrame"]` neodpovídal `videoSaveFrame` (case mismatch).
- Opraveno na `#videoFrameScrubWrap .vlb-btn` — spolehlivý selektor.

**Fix: Depth endpoint 404 (Worker index.js):**
- `/depth` route chyběla v `index.js` — handler `depth.js` existoval ale nebyl importován/routován.
- Přidán import + route `POST /depth` → `handleDepth(request)`. Worker verze: gis-proxy v2026-11.

**Fix: Video like/unlike styling (template.html + video.js):**
- Unlike stav (`.liked` class) nyní trvale červený — ne jen on hover.
- Nové CSS: `.vlb-btn.liked { border-color:#ff4d6d; color:#ff4d6d; }`.
- `videoLbToggleLike`, `videoLikeById`, `openVideoLightboxById` togglují `.liked` class.
- Konzistentní chování mezi output card detail a video lightbox z knihovny.

**Fix: Save frame flash retrigger (video.js):**
- `void btn.offsetWidth` force-reflow → animace se retriggeruje při opakovaném kliknutí.
- CSS selector oprava: `[onclick*="saveFrame"]` → `#videoFrameScrubWrap .vlb-btn` (case mismatch).

**Fix: Topaz modely — Astra odstraněna, 3 nové Starlight modely (video.js):**
- `topaz_astra1` (`aion-1`) odstraněn — Aion je frame interpolation model, NE upscaler → proto černé video.
- Přidáno: `topaz_precise1` (`slp-1`), `topaz_hq` (`slhq`), `topaz_mini` (`slm`).
- Nyní 5 Topaz modelů: Precise 2.5, Precise 2, Precise 1, Starlight HQ, Starlight Mini.

**Fix: Video hover playback v knihovně (video.js):**
- Přidána kontrola `cdnExpiry` — expired CDN URL se nehraje (místo tichého selhání).
- Přidán `vid.onerror` handler — pokud se video nepodaří načíst, element se odstraní.

### v190en — Code cleanup & deduplication

**Odstraněný mrtvý kód (fal.js + paint.js):**
- `callQwenInpaint`, `callFastSdxlInpaint`, `callPlaygroundV25Inpaint`, `callFluxKontextInpaint` — 4 neaktivní inpaint funkce
- `_invertMaskB64` — nikde nevolaná utility
- `_topazGetDimsAndFps` — duplikát `_topazGetDims`
- Mrtvé dispatch větve v `paint.js` (fast_sdxl, playground_v25, qwen_inpaint)
- `fullImageMode` job property + branch v `_compositeAndSaveQueueJob`
- Mrtvé label mapy v paint.js

**Nové sdílené helpery (setup.js):**
- `getProxyUrl()` — nahrazuje 6× opakovanou proxy URL konstrukci
- `_arrayBufferToBase64(buffer)` — nahrazuje 4× chunk-encoding pattern ve video.js

**Inpaint unifikace (fal.js):**
- `_runSimpleInpaint(apiKey, endpoint, label, params, onStatus, signal, extraPayload)` — generická funkce
- `callFluxDevInpaint` + `callFluxKreaInpaint` = thin wrappers over `_runSimpleInpaint`
- `renderOutput` přesunut z `fal.js` do `output-render.js` (kde logicky patří)

**Video save-to-DB unifikace (video.js):**
- `_saveVideoResult(videoArrayBuffer, recordFields, job, spendArgs)` — nahrazuje 7× opakovaný save pattern
- Automaticky: generateVideoThumb, _topazGetDims, _parseMp4Fps, dbPut×3, trackSpend, UI cleanup
- Použito v: callVeoVideo, runVideoJob, callLumaVideo, callWan27Video, callWan27eVideo, runMagnificVideoUpscaleJob, runTopazQueueJob

**fal.ai queue polling unifikace (video.js):**
- `_falVideoSubmitPollDownload(falKey, endpoint, payload, job, opts)` — submit→poll→download
- Nahrazuje 3× duplicitní polling loop (runVideoJob, callWan27Video, callWan27eVideo)
- Parametrizovatelné: label, timeoutMin, pollMs, progressLabel

**Video source slot unifikace (video.js):**
- `_srcSlotClear(ids)`, `_srcSlotSet(ids, videoId)`, `_srcSlotDescribe(imgId)` — generické helpers
- ID config objekty: `_topazIds`, `_wan27eIds`, `_wan27vIds`, `_v2vIds`
- 4 sady clear/set/describe/pick funkcí zredukované na 1-řádkové wrappery
- `_extractFalVideoUrl(obj)` — sdílená top-level funkce (dříve 2× lokální definice)

**Deduplikace compressImageForUpload (video.js):**
- Nyní thin wrapper over `_compressRefToJpeg` z fal.js

**CSS (template.html):**
- `.src-chip` class nahrazuje 3× identický inline style pro meta chipy

**Bug fix (refs.js):**
- `addRefFromBase64` — v video módu prázdný `if` blok propadl do image refs. Fix: ve video módu se ref přidá do `videoRefs[]` přes `addVideoRef(asset)` místo do image `refs[]`
- View switch po přidání refu respektuje aktuální mód (`setGenMode('video')` vs `'image'`)

**Bug fix (video.js — refaktor regrese):**
- `_falVideoSubmitPollDownload` vracel jen ArrayBuffer → `videoUrl is not defined` v Kling/Seedance/Vidu/Wan26. Fix: vrací `{buffer, cdnUrl}`, callers destructurují.

**Bug fix (video.js — Veo):**
- 1080p a 4K vyžadují 8s duration. Přidán `effectiveDuration` enforcement.

**Bug fix (video.js — Topaz Astra):**
- `astra-1` přejmenováno na `aion-1` v Topaz API. Aktualizován `apiModel` + display name map.

**Bug fix (video.js — Kling 2.6):**
- Chyběl `durOptions: [5, 10]` → slider posílal "4" → API 422. Přidán.

**Bug fix (video.js — Veo UI):**
- `onVeoResolutionChange` nyní disabluje/ztmaví 4s/6s radio buttony při 1080p/4K a vynutí 8s.

**Bug fix (video.js — like/unlike sync + heart badge):**
- `renderVideoResultCard` vytvářel `div.className='img-card'` bez `vid-result-card` class a `data-vid` atributu → `videoToggleLike` nenašel output kartu → nesynkoval. Fix: `div.className='img-card vid-result-card'` + `div.dataset.vid = rec.id`.

**Bug fix (template.html — inpaint select readability):**
- `select.inpaint-num option { background:#fff; color:#111; }` — dropdown options nyní čitelné.

**Bug fix (template.html — OpenRouter setup):**
- Aktualizován popis: "Primary for AI Prompt & Describe — Claude Sonnet 4.6 · ~$0.003/prompt · ~$0.01/describe"
- Přidán `spendBlock_openrouter` div.

**Bug fix (Worker — Luma video):**
- `index.js` nepředával `env` do `handleLumaVideoSubmit` → R2 binding nedostupný → 502. Fix: `handleLumaVideoSubmit(request, env)`.
- `luma.js` aktualizováno: `uploadBase64ToR2` nahrazuje mrtvý `uploadBase64ToLuma` (Luma `/file_uploads` vrací 404).
- Import path: `fal.js` → `fal-inpaint.js` (správný název Worker handleru).

**v191en JS řádky: 17068 (z v190en 16920, +148)**

**Celková úspora: 17533 → 16920 JS řádků (−613 řádků, −3.5%)**

---

## Stav inpaint systému (k 9. 4. 2026)

### ✅ Funguje (beze změn)
- Paint modal, bucket fill, race condition fix, maska, crop, depth mapa
- Gallery ref picker, inpaint fronta, queue UI, nav tab, mask blur, soft composite
- Model-specific parametry

### Aktivní inpaint modely
| Klíč | Endpoint | Cena | Poznámka |
|------|----------|------|---------|
| `flux_fill` | `fal-ai/flux-pro/v1/fill` | $0.05/MP | FLUX Pro Fill, safety_tolerance param |
| `flux_general` | `fal-ai/flux-general/inpainting` | ~$0.025 | ControlNet (Canny/Depth) + Ref image, via proxy |
| `flux_dev` | `fal-ai/flux-lora/inpainting` | ~$0.025 | FLUX Dev, rychlý — wrapper over `_runSimpleInpaint` |
| `flux_krea` | `fal-ai/flux-krea-lora/inpainting` | $0.035/MP | Krea fine-tune — wrapper over `_runSimpleInpaint` |

### Odstraněné modely (v190en cleanup)
- ~~`fast_sdxl`~~ — výsledky slabé, kód odstraněn
- ~~`playground_v25`~~ — výsledky slabé, kód odstraněn
- ~~`qwen_inpaint`~~ — nefunkční, kód odstraněn
- ~~`kontext_inpaint`~~ — streaming-only, 422 chyby, kód odstraněn

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

### Změněné moduly v v191en (oproti v190en)
| Modul | Změny |
|-------|-------|
| `spending.js` | +OpenRouter v SPEND_PROVIDERS + `_or_prompt`/`_or_describe` cenové klíče |
| `ai-prompt.js` | +`trackSpend('openrouter', '_or_prompt')` po úspěšných AI Prompt voláních |
| `refs.js` | +`trackSpend('openrouter', '_or_describe')` po Describe, +`dbPutAssetMeta` při rename |
| `template.html` | +CSS `#inpaintResolution/Margin/SafetyTol option` readability, +`.vlb-btn.liked` trvale červená |
| `video.js` | Lightbox like z `video_meta` + `.liked` class, `onVeoResolutionChange()` po model switch, nový `generateVideoThumb` s retry, `videoLikeById`/`videoToggleLike` + `.liked` toggle, save frame flash retrigger |
| `gallery.js` | `openGalleryModal` čte favorite z `metaCache`, inline like toggle + gallery card sync |
| `db.js` | DB v7, +`assets_meta` store, migrace, +`dbGetAllAssetMeta`/`dbPutAssetMeta`/`dbDeleteAssetMeta`, `dbPatchAssetMeta` patchuje oba stores |
| `assets.js` | Rendering/listing přes `dbGetAllAssetMeta`, dual-write do obou stores, thumb-only fallback |

### Změněné moduly v v190en (oproti v189en)
| Modul | Změny |
|-------|-------|
| `setup.js` | +`getProxyUrl()`, +`_arrayBufferToBase64()` utility helpers |
| `fal.js` | −4 mrtvé inpaint funkce, −`_invertMaskB64`, −`renderOutput`, +`_runSimpleInpaint`, callFluxDevInpaint/Krea = wrappers, getProxyUrl |
| `output-render.js` | +`renderOutput` (přesunut z fal.js), getProxyUrl |
| `paint.js` | −mrtvé dispatch větve (fast_sdxl, playground_v25, qwen_inpaint), −fullImageMode |
| `video.js` | +`_saveVideoResult`, +`_falVideoSubmitPollDownload`, +`_extractFalVideoUrl`, +`_srcSlotClear/_srcSlotSet/_srcSlotDescribe`, −duplicitní save/poll/source patterns, `compressImageForUpload` → wrapper, `_arrayBufferToBase64` usage, getProxyUrl |
| `refs.js` | Fix: `addRefFromBase64` ve video módu přidává do videoRefs (ne image refs) |
| `template.html` | +`.src-chip` CSS class |

### Worker struktura (gis-proxy v2026-11)
```
src/
  index.js
  handlers/
    xai.js luma.js magnific.js topaz.js topaz-image.js
    replicate-wan27.js replicate-wan27v.js replicate-wan27e.js
    fal-inpaint.js   — /fal/submit|status|result
    depth.js         — /depth (fal-ai/imageutils/depth)
```
