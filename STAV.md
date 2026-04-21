# STAV.md — Generative Image Studio

## Aktuální verze: v203en
## Příští verze: v204en
## Datum: 2026-04-21
## Worker verze: 2026-16 (beze změny)

---

## Co je v v203en (oproti v202en)

### Video.js split (Session 1 ze 2 pro video panel unification)

Rozdělení monolitu `video.js` (5907 řádků) na 6 submodulů. **Žádná funkční změna** — pouze fyzické oddělení a snížení kontextové zátěže pro další práci. Session 2 = unified video panel (analogicky k image v v200en) přijde příště.

| Submodul | Source řádků | Obsah |
|---|---:|---|
| `video-utils.js`   |  180 | Pure helpers: `_extractFalVideoUrl`, `bytesToBase64`, `generateVideoThumb`, `_videoInfoLine`, `_videoDateStr`, `friendlyVideoError`, `_parseMp4Fps`, `_topazGetDims`, `compressImageForUpload` |
| `video-models.js`  | 2419 | `VIDEO_MODELS`, `KLING_GROUPS`, `TOPAZ_MODELS`, `TOPAZ_GROUPS`, `MAGNIFIC_VIDEO_MODELS`, `_getVideoSpendKey`, per-model handlery (Veo, Luma, WAN 2.7/2.7e, PixVerse C1/V6, Seedance 2.0, Grok), `uploadVideoToFal`, model UI switching (`onVideoModelChange`, `onKlingVersionChange`, `_applyVideoModel`, `onVeoRefModeChange`, `onVeoResolutionChange`, `updateVideoResInfo`, `initVideoCountHighlight`, `updateVideoCountHighlight`), Grok source management, prompt rewriting (`_prevVideoModelKey`, `_videoModelSwitching`, `videoPromptModelToUserLabels`, `videoPromptUserLabelsToModel`, `rewriteVideoPromptForModel`), `getActiveVideoModelKey` |
| `video-queue.js`   |  804 | `videoJobs` state, `_saveVideoResult`, `_falVideoSubmitPollDownload`, `generateVideo` (submit entry), `runVideoJob` (dispatch), placeholder/result cards, error handlers (`videoJobError`, `reuseVideoJob_err`, `rerunVideoJob`), queue render/overlay/cancel |
| `video-gallery.js` | 1544 | State (`videoCurrentFolder`, `videoSelectedIds`, `videoRefs`, `videoMotionFile/Id`, `wan27eSrcVideoId`, `wan27vSrcVideoId`, `sd2VidSrc[]`, `videoLbCurrentId`, `videoLbDuration`), source slot system (`_srcSlotClear/Set/Describe`), per-model source wrappers (wan27v, wan27e, v2v, sd2Vid, luma char ref), `useVideoFromGallery`, UI: `setGenMode`, `toggleVideoAudio`, `updateAudioToggleUI`, `moveStyleTagsToVideo`; refs: `addVideoRef`, `removeVideoRef`, ref label helpers, `renderVideoRefPanel`, `startVideoRefRename`, `videoRefFileSelected`, asset picker; gallery render + filters + lightbox + mention system + rubber-band; `describeVideoRef`, `reuseVideoJob`, delete/move selected |
| `video-topaz.js`   |  405 | `topazSrcVideoId` state, Topaz source management (`_topazIds`, `topazSetSource`, `topazClearSource`, `topazPickFromGallery`, `topazDescribeSource`, `_renderTopazSrcMeta`), `openTopazFromGallery`, `TOPAZ_MODEL_NAMES`, Topaz dispatch (`_generateTopazJob`, `runTopazQueueJob`), Magnific video upscale (`_generateMagnificVideoJob`, `runMagnificVideoUpscaleJob`) |
| `video-archive.js` |  555 | `exportVideoArchive` (streaming + chunked fallback + legacy), `importVideoArchive`, `_regenerateThumbsInBackground`, `regenerateMissingVideoThumbs` (globally exposed for F12) |
| **Celkem** | **5907** | přesně odpovídá originálu |

### Build system update (v203en)

- **`build.js`** — `MODULES` array rozšířen z 19 na 24 položek. `video.js` odstraněno, nahrazeno 6 novými v pořadí `video-utils → video-models → video-queue → video-gallery → video-topaz → video-archive`.
- **Build order je kritický** kvůli cross-module voláním v globálním scope:
  - `video-utils` první (žádné závislosti na jiných video modulech)
  - `video-models` druhý (dispatch do utils přes `_extractFalVideoUrl`, definuje `VIDEO_MODELS` které queue potřebuje)
  - `video-queue` třetí (volá modely přes `VIDEO_HANDLERS` dispatch v `runVideoJob`)
  - `video-gallery` čtvrtý (čte `videoJobs` z queue, volá `VIDEO_MODELS` lookup, používá `getActiveVideoModelKey`)
  - `video-topaz` předposlední (volá `_saveVideoResult` z queue, `refreshVideoGalleryUI` z gallery)
  - `video-archive` poslední (volá render funkce gallery a `generateVideoThumb` z utils)

### Split methodology

- Použit Python skript (`split_video.py`) s explicit line-range mapping (~36 rozsahů, každý pokrývá souvislý blok funkcí + předcházející komentáře/blank lines)
- 100% line coverage verified — každý řádek originálu přiřazen právě jednomu modulu, žádné duplicity, žádné mezery
- Multiset compare: joined(modules) == original video.js → PASS
- Per-module content exact match: pro každý modul `module_lines == [orig[i] for i in assigned_ranges]` → PASS (všech 6 modulů)
- Syntax check `node --check` pro každý modul individuálně + concatenated v build order → PASS
- Mock prod build s 18 placeholder modules + 6 reálných video-*.js → SUCCESS (vyprodukoval validní HTML, div balance OK)

### Expected prod build size

Baseline v202en: ~27 200 řádků. Delta z splitu: +26 řádků (6 × 4-řádkové hlavičkové komentáře s blank separators).
**Očekávaný v203en prod build: ~27 226 řádků** — v toleranci ±50 ✓

### Split — decision points

1. **Model-switch UI handlery** (`onVideoModelChange`, `_applyVideoModel`, `_setRow`, `onVeoRefModeChange`, ...) → `video-models.js` (závisí na `VIDEO_MODELS`/`TOPAZ_MODELS`/`MAGNIFIC_VIDEO_MODELS`/`KLING_GROUPS`)
2. **`_saveVideoResult` + `_falVideoSubmitPollDownload`** → `video-queue.js` (sdílí `videoJobs` state, volá `renderVideoQueue`)
3. **Magnific Video upscale** → `video-topaz.js` (sdílí `topazSrcVideoId` + stejný background-job pattern)
4. **`useVideoFromGallery`** → `video-gallery.js` (UI entry z gallery grid karty `▷ Use`)
5. **`topazSrcVideoId` state** → `video-topaz.js`

### Cleanup analysis (bonus)

Dokument `CLEANUP_ANALYSIS.md` obsahuje 11 identifikovaných oblastí pro snížení duplikace a zvýšení konzistence:

| # | Oblast | Přínos | Riziko | Kdy |
|---|---|---|---|---|
| 1 | Source slot registry | Vysoký | Nízké | Cleanup session |
| 2 | `_getVideoSpendKey` → field do VIDEO_MODELS | Střední | Nízké | Cleanup session |
| 3 | Polling loop extrakce (Veo/Luma/Grok/PixVerse) | Vysoký | Střední | Cleanup session |
| 4 | Mention state encapsulation | Malý | Nízké | Cleanup session |
| 5 | `_applyVideoModel` (364 ř) decomposition | **Vysoký** | **Vysoké** | **Session 2** |
| 6 | `generateVideo` (223 ř) decomposition | **Vysoký** | **Vysoké** | **Session 2** |
| 7 | Dead comment "rubber-band" | Kosmetika | Žádné | Cleanup session |
| 8 | TIMEOUT/POLL_MS konstanty centralizace | Střední | Nízké | Cleanup session |
| 9 | Topaz + Magnific merge | Malý | Střední | Cleanup session |
| 10 | Prompt rewriting refactor | Střední | Střední | **Session 2** |
| 11 | Error handling konzistence | Malý | Nízké | Cleanup session |

**Cleanup session-only** (#1, #2, #4, #7, #8, #9, #11): 1–2 hod, ~530 ř úspory.
**Session 2** s items #5, #6, #10: 4–6 hod, ~1100 ř úspory (~40% video code reduction).

---

## Co bylo v v202en (oproti v201en)

### 1. Queue + Rerun bugy (4 regresní bugy vyřešené)

**RETRY_MAX crash fix** — `output-render.js` používal nedefinovanou konstantu `RETRY_MAX` v queue overlay template literálu, což házelo ReferenceError uvnitř `.map()` a rozbilo celý queue overlay render (3 running → prázdný list). Fix: `job.retryTotal || '?'` matching pattern z generate.js.

**Cancel button pro running jobs** — queue overlay i main queue panel mají nyní ✕ pro running jobs. `cancelJob` přepsán jako soft-cancel:
- `job.cancelled=true` flag
- `job.abort.abort()` signal (AbortController inicializován v `runJob`)
- success + catch paths respektují `job.cancelled` (neukládají do gallery, nezobrazí error placeholder)
- `runJobAndContinue` odstraňuje cancelled z queue

Pozn: API request běží na pozadí dál (peníze utracené). Hard abort by vyžadoval refactor všech call* handlerů s AbortSignal do fetch — AbortController pro budoucnost připravený.

**Rerun spawnul N karet místo 1** — `rerunJob` (output-placeholder.js) volal `addToQueue(jobData)` který četl count fields. Fix: force count=1 pro všechny model types (geminiCount, fluxCount, sdCount, klingCount, zimageCount, qwen2Count, xaiSnap.grokCount, imagenSnap.sampleCount, wan27Snap.count, mysticSnap.count) — se spread klony aby se nemutovaly originály.

**Reuse z gallery nenastavil params** — dvouvrstvý fix:
- **Layer A**: `saveToGallery` (db.js) ukládá všechny UI params per-type pro 10 model types. Source of truth = `batchMeta.*Snap` (job.*Snap má kompletní UI state při submit), ne result fields.
- **Layer B**: `reuseJobFromGallery` (gallery.js) kompletní rewrite — paritní s `loadJobParamsToForm` (output-placeholder.js), čte z `item.params`. Pokrývá všechny unified modely.

### 2. Download overhaul (zero CDN, file:// friendly)

**Prefs store v IDB** (v8 migrace) — persistence pro FileSystemDirectoryHandle. Pomocné API: `prefsGet/Put/Delete`, `pickDownloadDir(kind)`, `writeFileToDir`, `ensurePermission`.

**Inline ZIP writer** (~80 lines, APPNOTE-compliant) — `_GIS_CRC_TABLE` + `_gisCrc32` + `buildStoreOnlyZip`. LFH + CDFH + EOCD, store-only method=0, UTF-8 flag. Nahrazuje JSZip z CDN (kterou `file://` nemělo spolehlivě).

**Progress overlay helpery** — `dlProgShow/Update/Hide` (title + body + progress bar). Použity všude kde probíhá binary operace.

**Protocol detection** — `_IS_FILE_PROTOCOL` + `_HAS_FS_API` konstanty. Na `file://` bypass FS API, pouze `a.click()` + 250ms delay (Chrome bulk download throttling).

**Gallery ZIP export** — dřív přes CDN JSZip (porušuje no-CDN rule), teď inline. Progress stages ("Preparing images… 12/12", "Assembling ZIP… 45.2MB", "Saving…").

**Bulk download Gallery** — dřív N dialogů pro N obrázků. Teď: directory picker s persistence klíčem `downloadDir_images` na http(s)://, sekvenční `a.click()` na file://.

**Video library download** — `videoDownloadSelected` rewrite. Directory picker s persistencí (klíč `downloadDir_videos`) na http(s)://, sekvenční `a.click()` na file://.

### 3. UI unifikace 3 knihoven (Gallery / Video / Assets)

**Společné CSS třídy** v template.html:
- `.lib-toolbar` — horní menu řádek (search, sort, filter, count, right-aligned library actions)
- `.lib-bulk` — bulk selection bar (objevuje se při select)
- `.lib-bulk-label`, `.lib-bulk-spacer`, `.lib-right` — podpůrné

**Unified bulk bar layout:**
```
✦ Selected: N items  [▷ Move] [type-specific] [↓ Download]   [Cancel] [✕ Delete]
                                                              ^neutral  ^ červené vpravo
```

**Unified main toolbar layout:**
```
[🔍 Search] [Sort▼] [⚙ Filter]  count     | [☑ Select all] [↑ Upload*] [↓ Archive] [↑ Load archive]
```
*Upload: Gallery má, Assets má, Video nemá (videa nelze libovolně nahrát — musí se generovat)*

**Delete button** trvale červený outline + červený text (`.ibtn.danger`). Úplně vpravo napříč všemi třemi knihovnami.
**Cancel button** nalevo od Delete, neutral styling.
**Video library** gained Archive + Load archive (dříve chybělo).

### 4. Gallery layout refactor (DVA OKNA pattern)

Před: `#galleryGrid` byl scroll container s toolbarem + bulk + gridem jako siblings uvnitř. Vše scrollovalo dohromady (menu rolovalo s obrázky).

Po: nová struktura:
```
#galleryView (flex column)
  .gallery-layout (flex row)
    #folderPanel (sidebar)
    .gal-main (flex column, flex:1, overflow:hidden)  ← NOVÝ wrapper
      ├ .lib-toolbar             flex-shrink:0  ← horní okno, vždy fixed
      ├ .lib-bulk                flex-shrink:0  ← zvětšení při select
      ├ .gal-filter-panel        flex-shrink:0  (když open)
      ├ .gal-filter-active       flex-shrink:0  (když show)
      └ #galleryGrid             flex:1, overflow-y:auto  ← spodní okno, scroll
          └ .gal-grid            display:grid, normální block child
```

**Klíč stability**: `.gal-grid` uvnitř `#galleryGrid` je **normální block child** (ne flex item). Grid engine dostane predictable width → grid-template-columns funguje spolehlivě. Flex-item s display:grid v nested kontextu selhává a karty kolabují. Video library + Assets používají stejný pattern (už dříve měly `#videoGridWrap` / `#assetGridWrap` jako flex column wrappery).

### 5. Video library — Archive / Load archive

`exportVideoArchive()` a `importVideoArchive()` nové funkce ve video.js, paritní s Gallery archive. JSON s:
- header (version, type=video-archive, exportedAt, videoCount, folders)
- videos[] — každé s binary `videoData` jako **base64 chunks** (8 KB po 8 KB, abychom nepřetekli stack při `String.fromCharCode.apply`)

Progress overlay během export/import. Import skipuje existující ID (safe re-import).

### 6. Performance audit — plná data v thumb/listing operacích

Odstraněno čtení plných imageData tam kde stačí metadata:

| Místo | Před | Po |
|---|---|---|
| `gallery.js` importGallery existingIds check | `dbGetAll('images')` | `dbGetAllMeta()` |
| `paint.js` openInpaintRefPicker | `dbGetAll('images')` | `dbGetAllMeta()`, full až při kliku |
| `video.js` reuseVideoJob fallback autoName | `dbGetAll('assets')` | `dbGetAllAssetMeta()` + lazy dbGet |
| `assets.js` findAssetByFingerprint | `dbGetAll('assets')` scan s plnými daty | `dbGetAllAssetMeta()` s precomputed fingerprint |
| `gallery.js` ctxSaveAsset | dvojitý findAssetByFingerprint | single call |

**Fingerprint migrace pro legacy assety**: `migrateAssetFingerprints()` v assets.js backfilluje `fingerprint` field pro pre-v202en assety. Spouští se 500ms po initDB, yield `setTimeout(0)` každých 10 assetů. Trade-off: během migrace (první ~30s) duplicate detection může selhat pro legacy data, ale je to přijatelnější než 5s UI freeze.

**Nová feature v `createAsset`**: při insertu ukládá `fingerprint` do asset i assets_meta → budoucí findByFingerprint = O(n) string compare (dříve O(n × imageData read)).

**Save to Assets z galerie**: dříve ~5s (2× scan plných dat), teď ~100ms po migraci.

---

## Dev server infrastructure (20. 4. 2026)

Monolit 26 354 řádků v jednom HTML začal blokovat dev ergonomii. Rozšířen `build.js` o `--dev` flag pro lokální HTTP server, který každý modul servíruje samostatně. Prod build zůstává nezměněný — `node build.js 203en` produkuje single-file HTML jako dnes. `gis_v202en.html` zůstává produkčním artefaktem (verze GIS aplikace se nemění, jde o infrastrukturní změnu buildu).

### `build.js --dev`
- Regenererace `<script>// __GIS_JS__</script>` bloku v template.html za 24 `<script src="./src/NAME.js"></script>` tagů (v přesném pořadí z `MODULES` array — od v203en nyní 24 modulů místo 19)
- Zapíše `dev/index.html` (gitignored runtime artefakt)
- **Fixní port 7800** — při obsazenosti server padne s jasnou chybovou hláškou (IndexedDB je per-origin, switching portu by ztratil knihovnu)
- Mini HTTP server, Node built-ins only (žádné dependencies): `http`, `net`, `fs`, `path`, `child_process`
- Routes: `GET /` → `dev/index.html`; `GET /src/*` → `src/` s MIME types; ostatní → 404
- `Cache-Control: no-store` na všech response → Ctrl+R vždy re-fetch
- Path traversal guard: `safeResolve` odmítá `../` úniky
- Auto-otevírá Chrome (Windows/macOS/Linux); při chybějícím Chrome v PATH server běží dál + vypíše URL k ručnímu otevření

### `start_dev.bat` — Windows dvojklik launcher
- `cd /d "%~dp0"` → spustí se ze svého adresáře nezávisle na CWD
- `node build.js --dev`
- `pause` na konci aby se okno nezavřelo při erroru

### Dopad v203en na dev server
Žádný breaking change. Dev server transparentně injectuje všech 24 modulů (místo 19) — `video-utils.js` + `video-models.js` + `video-queue.js` + `video-gallery.js` + `video-topaz.js` + `video-archive.js` jsou viditelné v DevTools Sources panelu každý zvlášť.

### Struktura repa
```
gis-dev/
├── build.js                ← --dev flag (280 ř)
├── start_dev.bat           ← Windows launcher
├── template.html
├── src/                    ← 24 modulů (od v203en, byl 19)
├── dist/                   ← prod buildy (gis_v203en.html)
└── dev/                    ← runtime-generovaný dev HTML (GITIGNORE)
```

`.gitignore` obsahuje `dev/`.

---

## Co bylo v v201en (oproti v200en)

- Paint annotCanvas + crop bugs
- Inpaint fix (FLUX Pro Fill stability)
- Z-Image T2I/I2I split (samostatné `zimage_turbo_i2i`)
- Segmind cleanup (pouze WAN 2.7 Image zůstává)

---

## Co bylo v v200en — Unified Image Panel

Místo 9 separátních HTML panelů (`nbParams`, `imagenParams`, `fluxParams`, ...) zaveden jeden generický `upParams` panel s 14 prvky. Každý model v `MODELS` deklaruje UI flags (resolutions, maxCount, steps, guidance, seed, safetyTolerance, safetyChecker, grounding, etc.). `selectModel()` zobrazuje/skrývá prvky podle flagů. `generate()` čte z jedné sady elementů, mapuje na per-type snap formáty.

**Scope:** Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok.
**Legacy panely zůstávají** pro Luma Photon (`proxy_luma`), Mystic (`proxy_mystic`), Freepik Edit (`proxy_freepik_edit`) — unikátní parametry.

Element IDs: `upRes`, `upCount4/10`, `upSteps`, `upGuidance`, `upSeed`, `upNeg`, `upAccel`, `upSafetySlider/Chk`, `upStrength`, `upGrounding`, `upRetry`, `upThinkRadio/Chk`.
Helper: `isUnifiedModel(m)`.

**Přidání nového unified image modelu = jen přidat objekt do MODELS s UI flags.** Žádný nový HTML.

---

## TODO (prioritní pořadí)

1. **Cleanup session video subsystému** — viz CLEANUP_ANALYSIS.md, odhad 1–2 hod
2. **Session 2 — Unified video panel** — analogicky k v200en image unified
3. **Style Library "My Presets"**
4. **Claid.ai via proxy**
5. **GPT Image 1.5**
6. **Hailuo 2.3**
7. **Use button for V2V models**
8. **Runway Gen-4 Image + Video** (výzkum hotový, viz research-ready sekce)
9. **Recraft V4**
10. **Z-Image LoRA generation** (`fal-ai/z-image/turbo/lora` + `fal-ai/z-image/base/lora`) — UI pro až 3 LoRA modely s váhou 0.6–1.0
11. **Z-Image LoRA trainer** (`fal-ai/z-image-trainer`) — kompletně jiný UX (ZIP upload, polling trénování)
12. **Ideogram V3**
13. **Seedance 2.0 1080p** — čeká se až fal.ai přidá (aktuálně 480p/720p; Freepik + Replicate už mají, ale integrace je přes fal.ai)

### Dokončené v v202en
- ✅ Queue + Rerun 4 bugy (RETRY_MAX crash, cancel for running, rerun N cards, reuse params)
- ✅ Download overhaul (inline ZIP, FS API + file:// bypass, persistent directory)
- ✅ UI unifikace 3 knihoven (unified toolbars, bulk bars, Delete vpravo červené, Cancel neutral)
- ✅ Gallery layout refactor (dva okna — `.gal-main` wrapper)
- ✅ Video library Archive / Load archive
- ✅ Performance audit plných dat (5 míst fixnutých, fingerprint migrace)
- ✅ Dev server infrastructure (build.js --dev, fixní port 7800)
- ✅ Streaming + chunked archive export (320+ image OOM crash + video JSON truncation fixes)
- ✅ Video thumbnail fix v archivaci (thumbData v archive + background regen pro staré archivy)
- ✅ Gallery upload progress + duplicate detection (fingerprint dedup konzistentní napříč GIS)

### Dokončené v v203en
- ✅ Video.js split na 6 submodulů (video-utils / -models / -queue / -gallery / -topaz / -archive)

### Odepsané / vyřešené
- ~~Z-Image Edit (`fal-ai/z-image/edit`)~~ — endpoint neexistuje (Z-Image rodina má jen T2I/I2I/LoRA/trainer)
- ~~Recraft Crisp upscale bug~~ — vyřešen
- ~~Seedance 2.0~~ — přidáno (čeká se jen na 1080p na fal.ai)
- ~~WAN 2.6 R2V~~ — neřešíme
- ~~Vidu Q3 Turbo~~ — neřešíme
- ~~Clarity 8×/16× via proxy~~ — neřešíme
- ~~Segmind Worker handler cleanup~~ — nízká priorita, neblokuje

### Research ready (pro budoucí implementaci)
- **Runway API**: `gen4_image`, `gen4_image_turbo`, `gen4.5` video. Async polling `/v1/tasks/{id}`. Header `X-Runway-Version: 2024-11-06`. @mention syntax až 3 refs. CORS block → potřeba Worker proxy.
- **Claid.ai**: CORS + base64 input incompatibility. Viable via proxy + Upload API multipart flow. Unique: combined upscale + denoise + HDR + sharpen v jednom requestu.
- **NB2 reliability**: `serviceTier: "PRIORITY"` (75–100% price premium, degrades gracefully). Navrhnut exponential backoff profil (5s→10s→20s→30s→60s×5).
- **FLUX.2 inpainting**: NE mask-based, jen natural language. Nevhodné pro VFX pipelines s EXR alpha z Nuke.
- **fal.ai inpainting models**: FLUX.1 [pro/dev], SDXL, Turbo variants zdokumentované. Qwen inpaint vyloučen (vracel original unchanged nebo repainted wrong region).
- **Seedance 2.0 1080p**: Freepik má `/seedance-pro-1080p` endpoint, Replicate ByteDance collection nabízí 1080p Pro. fal.ai zatím jen 480p/720p. **Rozhodnutí: čekat na fal.ai** (máme tam handler integrovaný, update bude trivialní).

---

## Klíčové technické detaily

### Unified library toolbars (v202en)
Všechny 3 knihovny (Gallery, Video, Assets) sdílejí strukturu:
```
wrapper (flex column, overflow:hidden, min-height:0)
  ├ .lib-toolbar     flex-shrink:0  ← search/sort/filter + right-aligned actions
  ├ .lib-bulk.show   flex-shrink:0  ← Move/[type-specific]/Download | Cancel | Delete
  ├ .gal-filter-*    flex-shrink:0  ← volitelné filtry
  └ scroll container flex:1, overflow-y:auto
```
Wrapper: `.gal-main` (Gallery), `#videoGridWrap` (Video), `#assetGridWrap` (Assets).

### Paint engine — 3 parallel canvases (od v201en, beze změny)
```
eng.canvas (display)     = base + strokes composite (viewing)
eng.history[0]           = clean original image (invariant, never touched by strokes)
_annotateMaskCanvas      = white strokes for inpaint mask
_annotateAnnotCanvas     = color strokes, transparent bg (Method B)

Draw op (pen/shape/text/bucket):
  1. Draw on state.ctx (display)
  2. Draw on state.maskCtx (monochrome)
  3. Draw on state.annotCtx (color)
  4. saveHistory() pushes all 3 snapshots

Method A save: eng.canvas.toDataURL()                  // composite
Method B save: { history[0], whiteBg + annotCanvas }   // no diff
```

### Z-Image endpoints (od v201en)
| Model | Endpoint | Type |
|---|---|---|
| `zimage_base` | `fal-ai/z-image/base` | T2I standard (28 steps, CFG, neg prompt) |
| `zimage_turbo` | `fal-ai/z-image/turbo` | T2I ultra-fast (8 steps, acceleration) |
| `zimage_turbo_i2i` | `fal-ai/z-image/turbo/image-to-image` | I2I (ref required, strength slider) |

### Unified Image Panel (od v200en)
Pokrývá: Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok. Element IDs: `upRes`, `upCount4/10`, `upSteps`, `upGuidance`, `upSeed`, `upNeg`, `upAccel`, `upSafetySlider/Chk`, `upStrength`, `upGrounding`, `upRetry`, `upThinkRadio/Chk`. Legacy panely zůstavají pro Luma Photon (`proxy_luma`), Mystic (`proxy_mystic`), Freepik Edit (`proxy_freepik_edit`). Přidání nového modelu = jen `MODELS` entry s UI flags. Helper: `isUnifiedModel(m)`.

### WAN 2.7 Image routing (od v195en)
Přes Segmind (synchronous binary PNG response). Size jako preset strings "1K"/"2K"/"4K" s asterisk notation (`2048*1152`). Replicate handler v197+ odstraněn.

### PixVerse C1 (od v192–v193)
T2V/I2V/Transition/Fusion. 4 VIDEO_MODELS, passthrough Worker, `_pixverseUpload` helper, off-peak mode, multi-clip toggle.
Gotchas: I2V endpoint `/video/img/generate` (ne `/image/`); `camera_movement` jen v4/v4.5 (C1=400017); `multi_clip_switch` API INVERTED (true=single); `ref_name` alphanumeric only pro Fusion; `generate_audio_switch` must be explicit.

### Inpainting (aktivní modely)
FLUX Pro Fill, FLUX General, FLUX Dev, FLUX Krea. Worker handler: `fal-inpaint.js` (NE `fal.js` — recurring bug, vždy ověřit). Import: `'./handlers/fal-inpaint.js'`. Výsledky se ukládají jen do gallery (ne update paint canvas) aby zůstal mask pro iterativní práci.

### Performance: meta vs full data (v202en)
| Store | Plný (s imageData) | Meta (lightweight) |
|---|---|---|
| `images` | `dbGetAll('images')` | `dbGetAllMeta()` |
| `assets` | `dbGetAll('assets')` | `dbGetAllAssetMeta()` |
| `video_meta` | `dbGetAll('videos')` | `dbGetAll('video_meta')` |

Pravidlo: pro listing/thumbnail/lookup operace vždy meta. Plná data načítat jen při single-item akci (open, edit, download).

### Video subsystem (od v203en)
Viz oddíl "Co je v v203en". 6 submodulů s jasným ownership. Cross-module calls povolené (globální scope), ale build order musí respektovat závislosti (utils → models → queue → gallery → topaz → archive).

**Pro přidání nového video modelu** v rámci pre-Session-2 světa:
1. Nový `VIDEO_MODELS` entry do `video-models.js`
2. Nový `call<Name>Video(job)` handler do `video-models.js`
3. Dispatch v `runVideoJob` (`video-queue.js`)
4. UI switching logic v `_applyVideoModel` (`video-models.js`)
5. HTML panel v `template.html`
6. Spend key v `_getVideoSpendKey` (`video-models.js`)

Po Session 2 (unified video panel) bude #4 + #5 výrazně redukované na UI flags.

---

## Změněné moduly (v203en)

| Modul | Status | Popis |
|---|---|---|
| `video.js` | **ODSTRANĚN** | Rozdělen na 6 submodulů (viz níže) |
| `video-utils.js` | **NOVÝ** | 180 ř — pure helpers |
| `video-models.js` | **NOVÝ** | 2419 ř — model defs + handlery + UI switching |
| `video-queue.js` | **NOVÝ** | 804 ř — job state + runners + cards |
| `video-gallery.js` | **NOVÝ** | 1544 ř — UI gallery + filters + refs + lightbox |
| `video-topaz.js` | **NOVÝ** | 405 ř — Topaz + Magnific upscale |
| `video-archive.js` | **NOVÝ** | 555 ř — export/import + thumb regen |
| `build.js` | upraven | MODULES array 19 → 24 modulů |

**Jiné moduly beze změny.**

---

## Pravidla a principy

- **⚠ CRITICAL — `/mnt/project/` je VŽDY stale. NIKDY ho nepoužívat.** Session start: (1) `STAV.md` z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) `node build.js NNNen → dist/`.
- **Syntax check po buildu**: extract script z builtu → `node --input-type=module`. OK = "window is not defined".
- **HTML validation** — build.js zobrazuje `✓ HTML div balance: OK (N pairs)`.
- **NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele.**
- **Vždy důkladně prozkoumat** (web search, probe APIs) než prohlásit že něco nejde.
- **Research API maturity + regionální dostupnost** před integrací. WAN 2.7 Video Edit selhal kvůli Singapore vs čínský endpoint — step 1 check.
- **REST API parameter names**: Vertex AI naming pro Google REST (sampleImageSize, sampleCount), SDK naming v dokumentaci.
- **Worker free tier**: 30s wall-clock limit — nikdy nepollovat uvnitř Workeru.
- **Snap count v `addToQueue`**: každý nový model musí mít svůj count field. Rerun force=1 pro všechny (od v202en).
- **xAI concurrency limit**: max 2 concurrent requesty.
- **Qwen 2 Edit maxRefs**: 3. **Grok Pro maxRefs**: 1. **Standard**: 5.
- **Ref prefix**: ODSTRANĚN ve v200en. Styles/camera prefix pro Gemini nedotčený.
- **OpenRouter (Claude Sonnet 4.6)** je PRIMARY agent pro všechny tool features. Gemini Flash jen fallback.
- **xAI Video Edit payload**: `video: {url}` objekt.
- **Dedicated I2I/Edit model flag `strength: true`** → slider zobrazit vždy (nezávisí na refs.length).
- **Paint engine invariant**: `history[0]` = čistý originál, nikdy přepsán aktuálním ctx. `annotCanvas` = klon anotací, nezávislý na base.
- **Grid/Flex nesting gotcha (v202en lesson)**: `.gal-grid` s `display:grid` MUSÍ být normal block child, ne flex item. Flex-item s display:grid v nested flex-column selhává na width calculation → karty kolabují.
- **UI library pattern**: wrapper flex column, menu items `flex-shrink:0`, scroll container `flex:1 + overflow-y:auto + min-height:0`. Žádný `position:sticky` na nested elements — nespolehlivé.
- **Listing/thumbnail operace**: vždy meta store (`dbGetAllMeta`, `dbGetAllAssetMeta`). Plná data jen při single-item akci.
- **Rozhodnutí nedělat za Petra** — u složitějších funkcí prezentovat options.
- **NE `/mnt/project/` stale** — nestěžovat si na to Petrovi, je to infrastructure problém Anthropicu. Řešení = upload do chatu.
- **Video subsystem cross-module (od v203en)**: všechny funkce dál v globálním scope. Build order utils → models → queue → gallery → topaz → archive je kritický. Pokud nová funkce potřebuje cross-call opačným směrem (e.g. utils → gallery), je to signál že je ve špatném modulu.

---

## Runtime Philosophy

- **Single-file HTML** na file:// v Chrome
- **NO CDN** pro libraries/code (inline instead). CDN pro UI fonts (Google Fonts) OK.
- **User data vždy lokální** (IndexedDB)
- **No silent operations** — všechny async akce potřebují visible progress feedback
- **Local-first** — žádné server-side storage
- **File System Access API flaky na file://** → `_IS_FILE_PROTOCOL` detekce → bypass na `a.click()` s `dlProgShow/Update/Hide` overlay
- **Tauri migrace později** — až narazíme na hard limit (native dialogs, calling external programs, robust SQLite)
- **Petr nikdy needituje kód přímo** — všechny změny jako ready-to-deploy files
- **Dev/prod separation (dev server)**: localhost:7800 má prázdnou DB pro testy, prod data žijí dál v `gis_v202en.html` na file://

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu (napojený jako Claude project knowledge, Sync after push)
- **Proxy:** Cloudflare Workers `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos` (binding `VIDEOS`)
- **AI provideři:** fal.ai, Segmind (WAN 2.7 Image), Google (Gemini + Imagen), Replicate, Luma, Kling, PixVerse, Topaz Labs, Magnific/Freepik, xAI/Grok (Image + Video), OpenRouter (Claude Sonnet 4.6)
- **Auth formáty**: fal.ai `Authorization: Key {key}`; Replicate `Authorization: Bearer {token}`
- **Build system**: `node build.js NNNen` z `/home/claude/`; modul order (v203en, 24 modulů): models → styles → setup → spending → model-select → assets → refs → generate → fal → output-placeholder → proxy → gemini → output-render → db → gallery → toast → paint → ai-prompt → **video-utils → video-models → video-queue → video-gallery → video-topaz → video-archive**
- **Dev server**: `node build.js --dev` (port 7800, auto-Chrome) nebo Windows dvojklik `start_dev.bat`
- **Proxy deploy** (Windows): `cd C:\Users\Petr\Documents\gis-proxy` → `npm run deploy`
- **GitHub modules fetch**: primárně přes `project_knowledge_search` (synced from repo), fallback `https://github.com/petrsajner/GIS-modules/blob/main/[filename]` přes `web_fetch`
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`, `CLEANUP_ANALYSIS.md` (od v203en)
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
