# STAV.md — Generative Image Studio

## Aktuální verze: v202en
## Příští verze: v203en
## Datum: 2026-04-18
## Worker verze: 2026-16 (beze změny)

---

## Co je v v202en (oproti v201en)

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

**Video library download** — `videoDownloadSelected` rewrite. Directory picker s persistencí (klíč `downloadDir_videos`) na http(s)://, sekvenční a.click na file://.

### 3. UI unifikace 3 knihoven (Gallery / Video / Assets)

**Společný CSS** — nové třídy v template.html:
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

**Delete button**: trvale červený outline + červený text (`.ibtn.danger` přepracováno). Drive jen hover-červené. Úplně vpravo napříč všemi třemi knihovnami.

**Cancel button**: nalevo od Delete, neutral styling (žádná barevná signalizace).

**Konzistentní wording**: "Download" pro files, "Archive" pro JSON backup, "Cancel" všude.

**Video library gained** Archive + Load archive (dříve chybělo).

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

**Klíč stability**: `.gal-grid` uvnitř `#galleryGrid` je **normální block child** (ne flex item). Grid engine dostane predictable width → grid-template-columns funguje spolehlivě. Flex-item s display:grid jsem zkoušel dříve, ale width calculation v nested kontextu selhává a karty kolabují.

Video library + Assets používají stejný pattern (už předtím měly `#videoGridWrap` / `#assetGridWrap` jako flex column wrappery).

### 5. Video library — Archive / Load archive

`exportVideoArchive()` a `importVideoArchive()` nové funkce ve video.js, paritní s Gallery archive. JSON s:
- header (version, type=video-archive, exportedAt, videoCount, folders)
- videos[] — každé s binary `videoData` jako **base64 chunks** (8KB po 8KB, abychom nepřetekli stack při String.fromCharCode.apply)

Progress overlay během export/import. Import skipuje existující ID (safe re-import).

### 6. Performance audit — plná data v thumb/listing operacích

Odstraněno čtení plných imageData tam kde stačí metadata:

| Místo | Před | Po |
|---|---|---|
| `gallery.js:1689` importGallery existingIds check | `dbGetAll('images')` | `dbGetAllMeta()` |
| `paint.js:1439` openInpaintRefPicker | `dbGetAll('images')` | `dbGetAllMeta()`, full až při kliku |
| `video.js:3967` reuseVideoJob fallback autoName | `dbGetAll('assets')` | `dbGetAllAssetMeta()` + lazy dbGet |
| `assets.js` findAssetByFingerprint | `dbGetAll('assets')` scan s plnými daty | `dbGetAllAssetMeta()` s precomputed fingerprint |
| `gallery.js:867` ctxSaveAsset | dvojitý findAssetByFingerprint | single call |

**Fingerprint migrace pro legacy assety**: `migrateAssetFingerprints()` v assets.js backfilluje `fingerprint` field pro pre-v202en assety. Spouští se 500ms po initDB, yield `setTimeout(0)` každých 10 assetů. Trade-off: během migrace (první ~30s) duplicate detection může selhat pro legacy data, ale je to přijatelnější než 5s UI freeze.

**Nová feature v `createAsset`**: při insertu ukládá `fingerprint` do asset i assets_meta → budoucí findByFingerprint = O(n) string compare (dříve O(n × imageData read)).

**Save to Assets z galerie**: dříve ~5s (2× scan plných dat), teď ~100ms po migraci.

---

## Změněné moduly (v202en)

| Modul | Řádků | Popis změn |
|---|---|---|
| template.html | ~5060 | +50: `.lib-toolbar`, `.lib-bulk`, `.lib-right` unified CSS; `.gal-main` wrapper; permanent red `.ibtn.danger`; Gallery/Video/Assets markup přepsané |
| db.js | ~1155 | +370: prefs store (IDB v8), `pickDownloadDir`, `writeFileToDir`, `ensurePermission`, inline ZIP writer, `dlProgShow/Update/Hide`, exportSelected rewrite, saveToGallery snap-first pro 10 types |
| video.js | ~5520 | `videoDownloadSelected` s directory picker + progress; `exportVideoArchive` + `importVideoArchive` nové; `updateVideoBulkBar` přes `classList.toggle('show')`; fallback autoName search via meta |
| generate.js | ~940 | `cancelJob` rewrite (soft-cancel via job.cancelled + abort); runJob.abort init; job.cancelled respektován v success + catch; running cancel v statusHtml |
| output-placeholder.js | ~530 | `rerunJob` force count=1; `_reuseCount` defensive (radio set i pro count=1); `updateUnifiedResInfo` trigger |
| output-render.js | ~1800 | `RETRY_MAX` → `job.retryTotal`; running cancel v queue overlay |
| gallery.js | ~2065 | `reuseJobFromGallery` kompletní rewrite (paritní s loadJobParamsToForm); `ctxSaveAsset` single find; `importGallery` existingIds via dbGetAllMeta |
| assets.js | ~665 | `findAssetByFingerprint` fast path only (meta + precomputed); `migrateAssetFingerprints` background fn; `createAsset` ukládá fingerprint do obou stores |
| paint.js | ~2110 | `openInpaintRefPicker` používá dbGetAllMeta |
| setup.js | ~290 | `migrateAssetFingerprints` volaná 500ms po initDB |

---

## TODO (prioritní pořadí)

1. **Style Library "My Presets"**
2. **Claid.ai via proxy**
3. **GPT Image 1.5**
4. **Hailuo 2.3**
5. **Use button for V2V models**
6. **Runway Gen-4 Image + Video** (výzkum hotový, viz RESEARCH_REFS)
7. **Recraft V4**
8. **Unified panel pro video modely** (fáze 2, analogicky k image unified v v200en)
9. **Z-Image LoRA generation** (`fal-ai/z-image/turbo/lora` + `fal-ai/z-image/base/lora`) — UI pro až 3 LoRA modely s váhou 0.6–1.0
10. **Z-Image LoRA trainer** (`fal-ai/z-image-trainer`) — kompletně jiný UX (ZIP upload, polling trénování)
11. **Ideogram V3**
12. **Seedance 2.0 1080p** — **čeká se až fal.ai přidá** (aktuálně tam jen 480p/720p; Freepik + Replicate už mají, ale máme integraci přes fal.ai)

### Dokončené v v202en
- ✅ Queue + Rerun 4 bugy (RETRY_MAX crash, cancel for running, rerun N cards, reuse params)
- ✅ Download overhaul (inline ZIP, FS API + file:// bypass, persistent directory)
- ✅ UI unifikace 3 knihoven (unified toolbars, bulk bars, Delete vpravo červené, Cancel neutral)
- ✅ Gallery layout refactor (dva okna — `.gal-main` wrapper)
- ✅ Video library Archive / Load archive
- ✅ Performance audit plných dat (5 míst fixnutých, fingerprint migrace)

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

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos` (binding `VIDEOS`)
- **AI provideři:** fal.ai, Segmind (WAN 2.7 Image), Google (Gemini + Imagen), Replicate, Luma, Kling, PixVerse, Topaz Labs, Magnific/Freepik, xAI/Grok (Image + Video), OpenRouter (Claude Sonnet 4.6)
- **Auth formáty**: fal.ai `Authorization: Key {key}`; Replicate `Authorization: Bearer {token}`
- **Build system**: `node build.js NNNen` z `/home/claude/`; modul order: models → styles → setup → spending → model-select → assets → refs → generate → fal → output-placeholder → proxy → gemini → output-render → db → gallery → toast → paint → ai-prompt → video
- **Proxy deploy** (Windows): `cd C:\Users\Petr\Documents\gis-proxy` → `npm run deploy`
- **GitHub modules fetch**: `https://github.com/petrsajner/GIS-modules/blob/main/[filename]` přes `web_fetch` s blob URL
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
