# STAV.md — Generative Image Studio

## Aktuální verze: v202en
## Příští verze: v203en
## Datum: 2026-04-17
## Worker verze: 2026-16 (beze změny)

---

## Co je v v202en (oproti v201en)

Čtyři fixy regresí po refaktoringu na Unified Image Panel + kompletní přepracování download flow (gallery + video library).

### 1. `RETRY_MAX is not defined` — crash při persistent retry (#4)
`output-render.js` na dvou místech (řádky 27 a 75 pre-fix) používalo neexistující konstantu `RETRY_MAX`. `generate.js` ji správně nahradil `job.retryTotal` už dříve, ale output-render.js zůstal. Crash vyhazoval `runJob`:

```
Uncaught (in promise) ReferenceError: RETRY_MAX is not defined
    at renderQueueOverlay → runJob → runJobAndContinue
```

**Fix:** `RETRY_MAX` → `job.retryTotal || '?'` (line 27, elapsed ticker) a `j.retryTotal || '?'` (line 75, main overlay map).

### 2. Queue overlay „3 running, nic v listu" — sekundární efekt (#3)
`renderQueueOverlay` updatovala badge (`3 running`) **před** `.map()` renderem. Crash na `RETRY_MAX` uvnitř template literálu v mapu → `list.innerHTML = ...` se nikdy nevykonalo → badge ukazuje aktivitu, list je prázdný. Opravou #4 zmizelo.

### 3. Cancel pro running joby — abort mechanismus (#3 navíc)
`cancelJob(id)` v generate.js byl filter `j.id !== id || j.status !== 'pending'` — pro running job no-op. V overlay byl ✕ button taky jen u pending. User neměl jak zastavit běžící generaci.

**Soft-cancel implementace:**
- `cancelJob` pro running: `job.cancelled = true`, `job.status = 'error'`, `job.errorMsg = 'Cancelled by user'`, `job.abort.abort()`, odstranění placeholderů, render.
- `runJob` init: `if (!job.abort) job.abort = new AbortController();`
- `runJob` success path: `if (job.cancelled) return;` před `status = 'done'`.
- `runJob` catch path: `if (job.cancelled) return;` před zobrazením error placeholderu.
- `runJobAndContinue`: pokud `job.cancelled` → odstranit z fronty a spustit další pending.
- Cancel button v overlay **i v main queue panelu** pro running jobs, nejen pending.

**Trade-off:** API request se dokončí na pozadí (peníze se spotřebují), výsledek se zahodí. Handlery nepředávají `signal` do fetch calls — to by byl full refactor všech call* funkcí. `AbortController` je připraven pro budoucí rozšíření.

### 4. Rerun spustil celý job místo 1 karty (#2)
`rerunJob` v output-placeholder.js destructoval job a předával zbytek do `addToQueue(jobData)`. `addToQueue` čte `count` z `geminiCount/fluxCount/sdCount/klingCount/zimageCount/qwen2Count/wan27Snap.count/xaiSnap.grokCount/imagenSnap.sampleCount` a vytvoří N placeholderů. Pokud původní job měl 4, rerun vytvořil 4 nové — místo 1 obnovy chybujícího tile.

**Fix:** Před `addToQueue(jobData)` přepsat všechny count fields na 1 (obdoba `_batchForceSnap` větve). Snaps se klonují spread operátorem, aby se neměnil originál v paměti.

### 5. Reuse z gallery neobnovila parametry — saveToGallery + reuseJobFromGallery (#1)

**Vrstva A — `saveToGallery` (db.js) ukládala minimum:**
- gemini: thinking, refs, ratio, size
- flux/seedream/wan27r/xai/luma/imagen: seed, size, ratio (nic víc)
- další typy: částečně

Po refaktoringu na Unified Panel je potřeba uložit všechny parametry které panel ovládá.

**Fix:** Rozšířena na per-type save se všemi UI parametry (imageSize, aspectRatio, steps, guidance, safetyTolerance, negPrompt, acceleration, strength, persistentRetry, useSearch, thinking, grokRes, tier, sizeTier, resolution, klingResolution, imgWeight, styleWeight, modifyWeight). Zdroj pravdy = `snap` z `batchMeta` (= job objektu), kde má generate.js kompletní UI state při submitu. `result` objekty z handlerů obsahují jen returned fields (seed/size/ratio) — snap má zbytek.

**Vrstva B — `reuseJobFromGallery` (gallery.js) znala okleštěný subset:**
- Nevolala setAspectRatioSafe pro aspectRatio, jen pro ratio (identické ale ne vždy)
- upRes jen pro kling a zimage — gemini/flux/seedream/qwen2/wan27/xai/imagen vynecháno
- upCount4/10 vůbec nenastavovala
- Chybělo: upSafetyChk, upSafetySlider, upStrength, upRetry, upGrounding, upThinkChk, sizeTier pro wan, grokRes pro xai, imageSize pro gemini/imagen
- thinking používal neexistující `upTr-high`/`upTr-min` IDs (ve v200en přejmenováno na `upThinkRadio`)

**Fix:** Kompletní přepis — teď paralelní s `loadJobParamsToForm` (output-placeholder.js), ale čte z `item.params` místo z `job.*Snap`. Pokrývá všechny unified modely (gemini, imagen, flux, seedream, kling, zimage, qwen2, wan27r, proxy_xai) a Luma.

### 6. Bonus — `loadJobParamsToForm` defensive fix
Reuse z error karty nevždy obnovoval `upCount4/10`. Příčina: `_reuseCount` měla early return pro `count <= 1` → neodpálilo `_setRadio`. Nic se nezobrazilo. Také chyběl `updateUnifiedResInfo()` call na konci.

**Fix:** `_reuseCount` vždy nastaví radio (i pro 1). Přidán `updateUnifiedResInfo()` volání před `switchView('gen')`.

### 7. Gallery + Video download — kompletní overhaul

**Problémy před v202en:**
- **Gallery ZIP:** `exportSelected` loadovala JSZip z `cdnjs.cloudflare.com` (CDN závislost!). Na `file://` protokolu občas selže network load bez viditelné chyby → user nic neviděl, ZIP se nestáhl.
- **Gallery Individual PNG:** `showSaveFilePicker` v loopu = dialog pro **každý** soubor zvlášť. Pro dávku 10 obrázků = 10 dialogů.
- **Video library:** `for (id of ids) videoDownloadById(id)` = každý blob `a.click()` → Chrome default Downloads folder. Bez možnosti volby a žádná paměť.
- **Obojí:** neukládala se cesta → po restartu aplikace user musel znovu vybírat.

**Petr requirement:** "Vše (obrazky i videa) ma byt na mem lokalnim pocitaci. Nechci nic mit na CDN."

**Fix (3 vrstvy):**

**(a) IndexedDB v8 — nová `prefs` store** pro perzistenci `FileSystemDirectoryHandle`. Chrome podporuje structured clone FileSystemDirectoryHandle do IDB — handle přežívá restart aplikace.

**(b) Helper API v db.js:**
- `prefsGet(key)` / `prefsPut(key, value)` / `prefsDelete(key)` — generic key/value access
- `ensurePermission(handle, mode)` — queryPermission → requestPermission flow (handles 'granted' | 'prompt' | 'denied')
- `pickDownloadDir(kind, {forceDialog})` — otevře `showDirectoryPicker({startIn: lastHandle, id: 'gis-<kind>'})` → user vybere folder (default = last used) → handle se uloží do prefs. `forceDialog: false` použije silent reuse pokud granted.
- `writeFileToDir(dir, name, blob)` — `dir.getFileHandle(name, {create:true})` + `createWritable()` + write + close

**(c) Inline ZIP writer (žádné CDN!):**
- `_GIS_CRC_TABLE` — pre-generated CRC32 lookup table (Uint32Array, 256 entries)
- `_gisCrc32(bytes)` — standard CRC32
- `buildStoreOnlyZip(files)` — postaví ZIP blob podle [APPNOTE 4.4.x](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT):
  - Local File Header (30B + name) + raw file data per entry
  - Central Directory File Header (46B + name) per entry
  - End of Central Directory Record (22B)
  - Method = 0 (store, no compression — optimal pro PNG/MP4)
  - UTF-8 flag bit 11 set pro Unicode filenames
  - ~80 řádků celkem

**Flow v praxi (gallery Download):**
1. User vybere N obrázků, klikne Download
2. Dialog: "Individual PNG files" nebo "ZIP archive"
3. **PNG flow:** `pickDownloadDir('images')` → Chrome otevře directory picker (startIn = last used folder, nebo Downloads pro first run). User OK/změní → handle uložen do `prefs.downloadDir_images`. Silent zápis všech obrázků do folderu.
4. **ZIP flow:** `showSaveFilePicker({id:'gis-zip', startIn: lastImagesDir})` — Chrome respektuje `id` pro vlastní persistence. Build ZIP inline (žádný JSZip), write.

**Video library Download:** analogicky — `pickDownloadDir('videos')` → persist v `prefs.downloadDir_videos`. Silent bulk zápis.

**Fallback pro prohlížeče bez directory picker** (Firefox, Safari < TBD): starý flow — `a.click()` pro každý soubor do default Downloads. Neutrhne to funkčnost, jen tam chybí folder selection.

**Google Fonts (`fonts.googleapis.com`) v template.html** je jediný zbývající externí resource. Používá se pro Syne + IBM Plex Mono UI fonty. Není to user data (obrázky/videa) takže by mohlo zůstat, ale pro úplnou offline-first aplikaci by šlo nahradit embedded @font-face blocks s base64 woff2. **Decision: pending user confirmation.**

---

## Změněné moduly

| Modul | Řádků | Popis změn |
|-------|-------|------------|
| output-render.js | ~1794 | RETRY_MAX → job.retryTotal (2 místa); cancel button pro running jobs v queue overlay |
| generate.js | ~937 | cancelJob full rewrite (abort pro running); runJob.abort init; runJob respektuje job.cancelled v success + catch; runJobAndContinue odklízí cancelled z fronty; statusHtml s cancel i pro running |
| output-placeholder.js | ~530 | rerunJob force count=1 (všechna count pole + snap clones); loadJobParamsToForm._reuseCount defensive (vždy nastaví i pro 1); updateUnifiedResInfo() trigger |
| db.js | ~1150 | **+370**: saveToGallery snap-first params pro 10 typů modelů; IDB v8 + prefs store; prefsGet/Put/Delete helpers; pickDownloadDir + writeFileToDir + ensurePermission (File System Access API persistence); inline store-only ZIP writer (CRC32 + LFH + CDFH + EOCD) bez JSZip/CDN; exportSelected přepsána (directory picker flow pro PNG, inline ZIP pro archive) |
| gallery.js | ~2057 | reuseJobFromGallery kompletní rewrite paralelní s loadJobParamsToForm; pokrývá všechny unified modely + Luma |
| video.js | ~5265 | videoDownloadSelected přepsána — directory picker s persistencí (downloadDir_videos) + bulk silent write; fallback na a.click loop pro nekompatibilní prohlížeče |

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
9. **Z-Image LoRA generation** (`fal-ai/z-image/turbo/lora` + `fal-ai/z-image/base/lora`)
10. **Z-Image LoRA trainer** (`fal-ai/z-image-trainer`)
11. **Ideogram V3**

### Dokončené v v202en
- ✅ RETRY_MAX crash + queue overlay desync (#4 + #3)
- ✅ Cancel pro running joby (abort mechanismus)
- ✅ Rerun single-card fix (#2)
- ✅ Reuse z gallery kompletní restore (#1)
- ✅ loadJobParamsToForm defensive count + resInfo refresh
- ✅ Gallery + Video download overhaul — directory picker + persistence + inline ZIP (zero CDN)

### Známá omezení přenášená do v203en+
- **Hard abort API requestů:** cancelJob nastavuje `job.abort.abort()` ale call* handlery (callGemini, callFlux, callImagen, atd.) nepředávají `signal` do fetch. Full hard-abort vyžaduje refactor všech handlerů — pro teď soft-cancel (request dokončí, výsledek se zahodí).
- **Segmind Worker handler cleanup** — stále pending (non-critical).
- **Google Fonts** (template.html, fonts.googleapis.com) — jediný zbývající CDN resource. Decision: zda embedded @font-face s woff2 base64, nebo ponechat. Závisí na preferencích uživatele.

---

## Klíčové technické detaily

### Queue cancel flow (v202en)
```
User klikne ✕ na running job
  ↓
cancelJob(id)
  ↓ job.status = 'running'?
  ├─ job.cancelled = true
  ├─ job.status    = 'error'
  ├─ job.errorMsg  = 'Cancelled by user'
  ├─ job.abort.abort()          ← AbortController signál
  ├─ placeholder cards removed
  └─ renderQueue()              ← UI reaguje okamžitě
  
API request běží dál (ztracené peníze)
  ↓
runJob success path:
  if (job.cancelled) return;    ← výsledek se zahodí
                                   saveToGallery se NEvolá
runJob catch path:
  if (job.cancelled) return;    ← showErrorPlaceholder se NEvolá
  
runJobAndContinue:
  dekrement runningModelCounts
  if (job.cancelled) jobQueue.filter(out)
  tryStartJobs()                ← další pending spustí
```

### Reuse params flow (v202en)
```
saveToGallery(result, prompt, folder, refsCopy, rawPrompt, job)
  ↓
snap = job.{gemini|imagen|flux|sd|kling|zimage|qwen2|wan27|xai|luma}Snap
  ↓
params = { …result fields, …snap fields }
  ↓
dbPut('images', { …, params, … })

─── later ───

reuseJobFromGallery(item)
  ↓
selectModel(item.modelKey)      ← resetuje panel na defaults
  ↓
setAspectRatioSafe(p.aspectRatio || p.ratio)
  ↓
per-type restore (parallel to loadJobParamsToForm):
  upRes, upSeed, upSteps, upGuidance, upNeg, upAccel,
  upSafetyChk, upSafetySlider, upStrength, upThinkRadio,
  upThinkChk, upGrounding, upRetry, upCount4/10
  ↓
updateUnifiedResInfo()
```

### Rerun single-card (v202en)
```
rerunJob(cardKey)
  ↓
jobData = job - {id, status, startedAt, elapsed, retryAttempt, retryTotal,
                 pendingCards, requestId, cancelled, abort}
  ↓
OVERRIDE: všechna count pole = 1
  geminiCount, fluxCount, sdCount, klingCount, zimageCount, qwen2Count = 1
  xaiSnap.grokCount, imagenSnap.sampleCount, wan27Snap.count, mysticSnap.count = 1
  (snap clones via spread — originál v jobu se nezmění)
  ↓
addToQueue(jobData)  →  1 placeholder card
  ↓
insertBefore(new, oldErrorCard) + removeChild(oldErrorCard)
```

---

## Pravidla a principy

### Runtime boundaries & distribution philosophy
GIS běží jako **single-file HTML přes `file://` v Chromu**. To je sandboxed browser environment, ne desktop aplikace. Plně akceptujeme jeho limity pro současnou fázi vývoje:

- **No CDN for libraries/code** — žádný JSZip, lodash, ani jiná utility knihovna z cdnjs/jsdelivr/unpkg. Pokud knihovna potřeba → inline nebo napsat vlastní minimální implementaci. CDN resources mají "omezenou dobu uložení" a závislost na externím serveru narušuje offline deterministický běh.
- **CDN for UI styling OK** — Google Fonts (Syne, IBM Plex Mono) zůstává. GIS musí být vždy online (AI API calls), a fonty nejsou user data. Font caching Chrome řeší sám.
- **User data vždy lokálně** — obrázky, videa, reference, API klíče, nastavení. Nic se neukládá na externí servery (vyjma dočasných uploadů k AI providerům během generování).
- **File System Access API na file:// je flaky** — `showSaveFilePicker` a `showDirectoryPicker` občas tiše selhávají na file:// protokolu. Detekce `_IS_FILE_PROTOCOL` → bypass FS API → spolehlivý `a.click()` fallback s viditelným progress overlayem.

### Desktop app (Tauri) — later, not now
Přechod do Tauri přijde až budou **konkrétní hard-limity vyzkoušené, ne spekulativní**. Triggery pro migraci:
- Native OS dialogy místo Chrome verze
- Volání jiných programů (ffmpeg, Photoshop, DaVinci — open/export integrace)
- Robustní lokální databáze (SQLite) — IndexedDB quota limity začnou vadit u velkých galerií
- Absolutní file paths, file watching, shell integration
- Zrušení Cloudflare Worker proxy (Tauri HTTP client nemá CORS restrikce)

Aktuální zaměření: **vycítit všechny hranice prohlížeče v GIS, dotáhnout maximum funkčnosti single-file HTML, pak migrovat s konkrétním seznamem potřebných systémových integrací.**

### Technical rules
- **⚠ CRITICAL — `/mnt/project/` je VŽDY stale. NIKDY ho nepoužívat.**
- **Session start:** (1) načíst `STAV.md` z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) `node build.js NNNen → dist/`
- **Syntax check po buildu:** build produkuje HTML s `<script data-cfasync>` injection mimo naši kontrolu — awk `/^<script>$/` nezachytí. Použij Node extraction: `const idx = html.lastIndexOf('<script>'); const end = html.indexOf('</script>', idx); ...`. OK výstup = `ReferenceError: window is not defined`.
- **HTML validation** — build.js zobrazuje `✓ HTML div balance: OK (N pairs)`
- **NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele.**
- **Vždy důkladně prozkoumat** (web search, probe APIs) než prohlásit že něco nejde.
- **Worker free tier:** 30s wall-clock limit — nikdy nepollovat uvnitř Workeru.
- **Snap count v `addToQueue`:** každý nový model musí mít svůj count field.
- **xAI concurrency limit:** max 2 concurrent requesty.
- **Qwen 2 Edit maxRefs:** 3. **Grok Pro maxRefs:** 1. **Standard:** 5.
- **Ref prefix:** ODSTRANĚN ve v200en. Styles/camera prefix pro Gemini nedotčený.
- **OpenRouter (Claude Sonnet 4.6)** je PRIMARY agent pro všechny tool features.
- **xAI Video Edit payload:** `video: {url}` objekt.
- **Dedicated I2I/Edit model flag `strength: true`** → slider zobrazit vždy (nezávisí na refs.length).
- **Paint engine invariant:** `history[0]` = čistý originál, nikdy přepsán aktuálním ctx. `annotCanvas` = klon anotací, nezávislý na base.
- **Queue cancel invariant:** `cancelJob` nastavuje `job.cancelled` ale NEdekrementuje runningModelCounts — to dělá `runJobAndContinue` po return z runJob (deterministic slot release).
- **saveToGallery snap fallback:** result objekty z call* handlerů obsahují jen returned fields. Pro kompletní params persistence čti ze `batchMeta.*Snap` (= job.*Snap).
- **Download UX na file://:** vždy viditelný `dlProgShow/Update/Hide` overlay. Žádné tiché operace — normální user bez feedbacku usoudí že aplikace nefunguje.
- **Rozhodnutí nedělat za Petra** — u složitějších funkcí prezentovat options.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** Cloudflare Workers `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Google Gemini/Imagen, Luma, Kling, Replicate (WAN 2.7 Image), Freepik/Magnific, Topaz, PixVerse, xAI/Grok (Image + Video), OpenRouter (Claude Sonnet 4.6)
- **Dokumenty:** `STAV.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `API_MODELS.md`, `COPYRIGHT_PROTECTION.md`
- **Kontakt:** info.genimagestudio@gmail.com; LinkedIn: linkedin.com/in/sajner
