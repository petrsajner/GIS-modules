# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 21. 4. 2026 · v203en video.js split*

---

## Video.js split — Session 1 ze 2 (21. 4. 2026)

**Kontext:** Po v202en byl `video.js` 5907 řádků v jednom souboru. Kombinace (1) rostoucí komplexity, (2) Session 2 plánu na unified video panel (analogicky k image v v200en), (3) dev ergonomie pro Petra + Claude context window → rozdělit na logické submoduly.

**Rozhodnutí:** Split na 6 submodulů podle ownership/concern. Čistě mechanický, bez funkční změny.

### Split methodology

**Zvažované varianty:**

| Varianta | Plus | Minus |
|---|---|---|
| A) **Split na 6 moduly s line-range mapping + verifikační skript** | Přesné, auditovatelné, verifikovatelné (multiset compare); žádná funkční změna | Jednorázová práce na mapping table + verifikace |
| B) Inline re-work při Session 2 (split = part of unified panel) | Jedna session místo dvou | Velký risk — miss některé cross-module dependencies; těžko reviewable; "big bang" |
| C) ES6 `import`/`export` migrace při splitu | Čistější module boundaries | Mimo Petrovo pracovní pattern (globals), risk při dev server / file:// differences, throw-away před Tauri |

**Rozhodnutí: A.** Primárně pro bezpečnost — každý řádek originálu verifikován proti cílovému modulu přes multiset compare. Kompletní regression-free záruka nad rámec "should work".

### Module boundaries — decision points

Některá funkcionalita mohla jít do víc modulů. Zde logika:

**1. Model-switch UI handlery (`onVideoModelChange`, `_applyVideoModel`, `_setRow`, `onVeoRefModeChange`, `updateVideoResInfo`, ...) → `video-models.js`**

Varianty:
- (a) `video-gallery.js` — jako UI nad DOM
- (b) `video-models.js` — protože logika závisí na `VIDEO_MODELS`/`TOPAZ_MODELS`/`MAGNIFIC_VIDEO_MODELS`/`KLING_GROUPS`

Zvoleno **(b)**. Důvod: při změně modelu změny se explicitně týkají `model.type` switche a `m.refMode` + `m.hasAudio` + `m.durOptions` dispatch. Model-specific UI smoothly souvisí s model-specific defs. Patří ke stejnému concernu.

**2. `_saveVideoResult` + `_falVideoSubmitPollDownload` → `video-queue.js`**

Varianty:
- (a) `video-queue.js` — patří k job runners
- (b) `video-models.js` — infrastruktura pro handlery

Zvoleno **(a)**. Důvod: `_saveVideoResult` updatuje `videoJobs` state, volá `renderVideoQueue`, `refreshVideoGalleryUI`. To je queue concern. Handlery v `video-models.js` volají do queue přes shared helper — čistý upstream/downstream.

**3. Magnific Video upscale → `video-topaz.js`**

Varianty:
- (a) Samostatný `video-magnific.js`
- (b) `video-topaz.js` (sdílí `topazSrcVideoId`, stejný background-job pattern)

Zvoleno **(b)**. Důvod: Magnific a Topaz používají stejný source slot (`topazSrcVideoId`), stejný výpis v UI (✦ tlačítko v gallery), stejný non-blocking queue pattern. Samostatný modul by byl přes-fragmentace pro ~40 řádků logiky. Komentář v headeru topaz modulu vysvětluje, že obsahuje "Topaz + Magnific".

**4. `useVideoFromGallery(videoId)` → `video-gallery.js`**

Dispatch entry — volá se z gallery grid karta `▷ Use`, rozhoduje který slot dostane video (Topaz/Magnific, Grok, Seedance R2V, V2V, WAN27). Je to UI entry bod z gallery view. Cross-calls do topaz module je OK (globální scope). Gallery "dispatch" je lepší než topaz "entry" — entity je gallery.

**5. `topazSrcVideoId` state → `video-topaz.js`**

State pro Topaz ownership. Gallery volá `topazSetSource(id)` z `useVideoFromGallery` — žádný přímý read/write proměnné cross-module.

### Cross-module call patterns (expected, OK)

Všechno běží v globálním scope (žádné `import`/`export`), takže cross-calls jsou legitimní. Dokumentuji vzorce pro budoucí reference:

```
video-queue   calls video-models   (via runVideoJob dispatch → callVeoVideo, callLumaVideo, ...)
video-queue   calls video-utils    (_extractFalVideoUrl, _topazGetDims in _saveVideoResult)
video-queue   calls video-gallery  (refreshVideoGalleryUI after _saveVideoResult)
video-gallery calls video-models   (getActiveVideoModelKey, VIDEO_MODELS entries, onVideoModelChange)
video-gallery calls video-queue    (generateVideo on submit)
video-gallery calls video-topaz    (topazSetSource from useVideoFromGallery)
video-topaz   calls video-queue    (_saveVideoResult, updateVideoPlaceholderStatus, videoJobError, renderVideoQueue)
video-topaz   calls video-gallery  (refreshVideoGalleryUI)
video-topaz   calls video-utils    (_topazGetDims, _parseMp4Fps)
video-archive calls video-utils    (generateVideoThumb)
video-archive calls video-gallery  (renderVideoGallery, renderVideoFolders)
```

**Build order je z tohoto odvozený:**
```
utils → models → queue → gallery → topaz → archive
```

### Verification

1. **Line coverage:** 5907/5907 řádků přiřazeno právě jednomu modulu (Python skript s explicit ranges, conflict detection)
2. **Multiset compare:** `joined(modules) == original video.js` jako multiset — PASS
3. **Per-module content:** pro každý modul `module_lines == [orig[i] for i in assigned_ranges]` — PASS (všech 6 modulů)
4. **Syntax:** `node --check` každý modul + concatenated v build order — PASS
5. **Mock prod build:** `node build.js 203en` s 18 placeholder modules + 6 reálných video-*.js — SUCCESS (vyprodukuje validní HTML)
6. **Expected prod size:** baseline 27 200 + delta 26 (z 6 hlavičkových komentářů) = ~27 226 ± small — v toleranci ±50

### Co tato session NEřeší (čeká na další kroky)

- Unified video panel (Session 2) — viz `CLEANUP_ANALYSIS.md` body #5, #6, #10
- Cleanup oblastí identifikovaných během analýzy — viz `CLEANUP_ANALYSIS.md`
- ES6 module migrace — mimo scope, čeká na Tauri
- Optimalizace handler logiky — mimo scope mechanického splitu

### Důsledky

- **Build system:** 19 → 24 modulů v `MODULES` array. Dev server injectuje 24 `<script>` tagů místo 19.
- **GitHub repo:** `src/video.js` odstraněn, `src/video-*.js` (6 souborů) přidán. Commit message: `v203en: split video.js into 6 submodules — utils/models/queue/gallery/topaz/archive`
- **Dokumentace:** Každý modul má 3-line hlavičkový komentář popisující scope. Žádné další komentáře se nezměnily (jsou to řádky z originálu, 1:1).
- **Context window:** Claude může nyní pracovat s 400–2400 řádkovými moduly místo 5900 řádkové monolitu. Při Session 2 bude práce rychlejší.

### Souvislost se Session 2 (pro kontext budoucí práce)

Session 2 = **unified video generation panel**. Cíl: místo N HTML panelů per model-family použít jeden template s UI flags v `VIDEO_MODELS` entries. Analogicky k image v v200en (`isUnifiedModel()`, `upParams` element IDs).

Session 2 bude těžit z tohoto splitu: refactor `_applyVideoModel` (364 ř switch) a `generateVideo` (223 ř) bude izolovaný v `video-models.js` / `video-queue.js`, bez dotčení gallery/archive/topaz modulů.

**Poznámka pro Session 2:** přidat `ui: { ... flags }` do každé `VIDEO_MODELS` entry. Viz `CLEANUP_ANALYSIS.md` #5 pro plnou specifikaci.

---

## Gallery upload — progress + fingerprint dedup (20. 4. 2026, Session 3)

**Problém 1 (progress):** `uploadImagesToGallery` v `db.js` neměla žádný progress overlay. User viděl jen hluchou minutu, pak se obrázky objevily. Main thread byl nonstop-busy (`await FileReader`, `dbPut`, `generateThumb`).

Sjednávalo se to komplikovaně — prvně jsem omylem opravoval `uploadAssetsFromFile` v `assets.js` (tlačítko ve Assets library), až jsem si uvědomil že Petr uploaduje přes jiné tlačítko ve Gallery toolbaru. Tlačítka nesou oba label `↑ Upload` a volají jinou funkci v jiném modulu.

**Rozhodnutí progress:** Identický pattern jako `exportGallery` — custom local progressEl, inline CSS, getElementById update. `dlProgShow`/`dlProgUpdate` helpery z db.js v tomto kontextu z neznámého důvodu nefungovaly (overlay se nezobrazil), proto návrat k ověřenému patternu.

**Problém 2 (dedup):** Gallery upload nedetekoval duplikáty, ale assets upload a archive import ano. Inkonzistence napříč GIS. User mohl uploadnout stejný obrázek vícekrát.

**Zvažované varianty řešení dedup:**

| Varianta | Plus | Minus |
|---|---|---|
| A) **Fingerprint system stejný jako assets** | Konzistentní napříč GIS; efficient (string compare v meta cache) | Vyžaduje fingerprint field v images (migrace pro legacy data) |
| B) Per-upload scan všech images | Žádná schema změna | O(N×M) blow-up paměti pro velké knihovny; `dbGetAll('images')` načte stovky MB |
| C) Filename + size hash | Levné | Ne-spolehlivé (stejný obsah může mít jiný filename, stejný filename může mít jiný obsah) |

**Rozhodnutí: A.** Assets už má tuhle infrastrukturu léta, stejný pattern přenáší do images. Sdílí se `assetFingerprint()` čistá funkce z `assets.js`.

**Implementace:**
- `findImageByFingerprint(imageData)` v db.js — mirror of `findAssetByFingerprint`, používá `dbGetAllMeta()` (cachovaná)
- `migrateImageFingerprints()` — background migrace pro legacy images bez fingerprint field. Batch 10 + yield. Spouští ze setup.js 1500ms po init, staggered po asset migraci.
- `saveToGallery` přidává fingerprint do nových records — generated images budou mít fingerprint rovnou, žádný retroactive backfill pro ně nebude potřeba
- `uploadImagesToGallery` dedup flow: `findImageByFingerprint(b64)` před `dbPut`. Match → `duplicates++` + continue. Final toast: `↑ Gallery: 12 new, 3 duplicates skipped`

**Sjednocení architektury:**

| Místo | Dedup metoda |
|---|---|
| Assets upload | `findAssetByFingerprint` (assets_meta) |
| Gallery archive import | `existingIds.has(img.id)` (ID match — logický pro re-import generated records s jejich ID) |
| Gallery upload | `findImageByFingerprint` (images_meta) |

Dvě různé metody (fingerprint vs ID) jsou **záměrné**: archive import dostává GIS records s ID, takže re-import stejného archivu = stejná ID = skip. Upload z filesystému nemá ID, musí fingerprint.

**Edge case:** upload během běžící migrace — legacy images bez fingerprintu projdou jako new. Jednorázové (vyřeší se po dokončení migrace), zatím zachováno jako acceptable. Pokud se v praxi ukáže jako časté, přidá se `await migrateImageFingerprints()` přímo do uploadu.

---

## Dev server — fixní port 7800 (20. 4. 2026)

**Problém:** Původní `build.js --dev` měl port range 7800–7810. Pokud byl 7800 obsazený, server spustil na 7801 — ale tím se **změnil origin** (`localhost:7801` ≠ `localhost:7800`), a IndexedDB je per-origin. User přišel o přístup ke své knihovně bez jakéhokoliv varování.

**Rozhodnutí:** Port je fixní na 7800. Při obsazenosti server ihned padne s jasnou error message a instrukcemi:
- Windows: `netstat -ano | findstr :7800`
- macOS: `lsof -i :7800`
- Ukončit blokující proces a zkusit znovu

**Proč ne prompt na auto-fix:** user nemá žádný způsob jak migrovat data mezi origins (localhost:7800 → localhost:7801) v rámci dev serveru. Jediná cesta by byla full export+import přes archive, což je hodně práce. Lepší blokovat start než tiše "ztratit" knihovnu.

---

## Video thumbnail fix — Session 2.1 (20. 4. 2026)

**Problém reportovaný po Session 2:** po importu video archivu se videa zobrazila s clapperboard placeholdery. Videa se přehrávala (videoData byl importovaný korektně), ale `video_thumbs` store byl prázdný.

**Příčina:** Video thumbnails jsou v GIS samostatný IndexedDB store (`video_thumbs`, ne součást `videos` recordu), generované z binárního videa při vzniku přes `generateVideoThumb(blob)`. **Export i import v Session 1+2 je nikdy nezahrnoval** — archivovaly se jen `videos` + `video_meta` stores.

**Zvažované varianty:**

| Varianta | Plus | Minus |
|---|---|---|
| A) **Include thumbs v archivu + fallback regeneration** | Future archives = okamžité thumby; backward compat pro staré | Archiv ~1% větší (10–30 KB × videos) |
| B) Vždy regenerovat thumby po importu | Archivy menší | Pomalé při 50+ videech (~2 sec per video); thumbnail quality nemusí být stejná jako originální |
| C) Zcela oddělit thumby od archivace | Jednoduché | User by musel regenerovat ručně u každého importu |

**Rozhodnutí: A.** Marginální overhead za robustní import. Nová archivace bude rychlejší (thumb z archive, ne regeneration), stará archivace funguje s grace degradation (background regeneration).

**Implementace:**
- **Export (všechny 3 cesty — streaming, chunked, legacy):** per-video `dbGet('video_thumbs', id)` → include do archive entry jako pole `thumbData`
- **Import:** detekce:
  - `v.thumbData` v archive → `dbPut('video_thumbs', {id, data: thumbData})` přímo
  - Chybí → zařadit do `thumbRegenQueue`, po dokončení importu spustit `_regenerateThumbsInBackground(queue)`
- **`_regenerateThumbsInBackground`:** non-modal mini-indikátor v pravém dolním rohu, neblokuje UI. In-place DOM update karet (replace `<div>🎬</div>` placeholder s `<img src>`). Plus final `renderVideoGallery()` jako safety-net.
- **`regenerateMissingVideoThumbs()`:** globálně exposed utility pro F12 konzoli. Pro retroaktivní opravu existujícího importu (Petrových 52 videí naimportovaných před fixem).

**Důsledky:**
- Nové archivy (export z verze s fixem) — import bude okamžitý, thumby rovnou z archive
- Staré archivy (export z v202en nebo Session 2 před fixem) — import funguje, background regeneration (~2 sec per video) běží po dokončení
- Pro immediate retroactive fix: user spustí `regenerateMissingVideoThumbs()` z F12 konzole

---

## Progress counter pro bulk delete (20. 4. 2026)

**Problém:** `deleteSelected` (gallery), `videoDeleteSelected`, `deleteSelectedAssets` neměly žádný visible progress. Při 50+ itemech operace zdánlivě "visela" — UI neukazovalo že se něco děje.

**Řešení:** Přidán centered modal overlay konzistentní s export/import dialogy:
- Červený nadpis `✕ Deleting {images|videos|assets}` — vizuální signál destruktivní operace
- Large counter `N / TOTAL` v Syne fontu (vypadá a chová se jako export progress)
- Update každých 3–5 itemů + `setTimeout(0)` yield
- Trigger threshold: 10+ obrázků, 5+ videí (videa jsou dražší), 10+ assetů. Pod threshold se overlay neukáže (operace je rychlá, bliknutí by bylo rušivější než žádný progress).

Move operace (`moveSelectedGalleryToFolder`, `videoMoveSelected`, `moveSelectedAssetsToFolder`) progress nepotřebují — `Promise.all` dokončí typickou operaci pod 100 ms.

---

## Streaming + chunked archive export (20. 4. 2026 — Session 1+2)

**Problém:** `exportGallery()` padal při >320 obrázcích (OOM crash tabu), `exportVideoArchive()` u velkých video knihoven tiše produkoval syntakticky nevalidní JSON (archivace "proběhla" bez erroru, ale soubor nešel naimportovat). Oba exporty držely celou knihovnu v RAM najednou (~640 MB pole JSON stringů × 320 obrázků, plus ~640 MB při konstrukci Blobu). V8 má softlimit ~512 MB na jeden string, Chrome na Windows někdy tiše truncatuje Blob write >500 MB. U videí selhávalo dřív kvůli větším itemům (5–50 MB base64 per video).

**Zvažované varianty:**

| Varianta | Plus | Minus |
|---|---|---|
| A) **Streaming write** přes `FileSystemWritableFileStream`, per-item | Memory peak ~1 item; minimální změna kódu; reusable v Tauri | Vyžaduje FS API (localhost/https), na file:// nefunguje |
| B) **Chunked archive** (auto-split do multi-file) | Funguje všude i na file://; resilience (corrupt part neruší zbytek) | Víc souborů pro uživatele; komplexnější import |
| C) ZIP formát s binary daty | 30 % menší archiv, standardní formát | Custom JS ZIP reader ~150 řádků; v Tauri nahrazen Rust crate → throw-away kód |

**Rozhodnutí: A+B kombinovaně, implementováno ve dvou session.**

Session 1 = cesta A (streaming JSON, jeden soubor). Session 2 = cesta B (chunked multi-file pro file:// fallback). **Kritická pro distribuci single-file HTML buildu** — Petr provozuje `gis_vNNNen.html` na `file://`, kde FS API není dostupné. Bez chunked cesty by archivace velkých knihoven z file:// nefungovala vůbec.

ZIP (varianta C) zamítnut — custom JS ZIP reader by byl throw-away kód po přechodu na Tauri (Rust `zip` crate je lepší ve všem). Streaming JSON serialization logika je naopak reusable v Tauri.

**Auto-split thresholdy:**
- Gallery: > 100 obrázků (100 × 2 MB ≈ 200 MB per part, bezpečně pod V8 limit)
- Video: > 5 videí (5 × 30 MB ≈ 150 MB per part — videa jsou větší než obrázky)

**Filename convention:** `gis-archive-2026-04-20-part1of3-100img.json` (+ suffix s počtem itemů)

**Chrome multi-download UX:**
- User uvidí jednou dialog "Allow multiple downloads from this site" a potvrdí
- Mezi `a.click()` pauza 500 ms (gallery) / 700 ms (video) aby Chrome throttling nepřeskakoval
- Všech N parts stáhne postupně do Downloads

**Multi-file import architektura:**
- Files sorted podle `part{N}of{M}` v názvu (alphabetic fallback)
- Pre-scan: první 64 KB každého souboru se zparsuje jako header, validuje se `archiveId` konzistence a `totalParts` pokrytí
- Varování pokud chunked archive má chybějící parts (`missing N of M parts, proceed?`)
- Single confirm dialog pro celý archiv (ne per-file)
- Agregovaný progress napříč soubory (`file 2 / 3 — 145 / 248 images`)

**Memory profile:**
| Scenario | Pre-Session 1 | Post-Session 1+2 |
|---|---|---|
| 320 obrázků × 2 MB, localhost | ~640 MB peak → OOM | ~2 MB peak (streaming) |
| 500 obrázků × 2 MB, file:// | OOM | ~200 MB peak per part (chunked, 5 parts × 100) |
| 100 videí × 30 MB, file:// | ~3 GB → corrupt JSON | ~150 MB per part (20 parts × 5) |

**Cesty rozhodování v exportu:**
```
if (FS API dostupné) → streaming (1 soubor, unlimited)
else if (items > threshold) → chunked multi-file
else → legacy single-file (small libraries OK)
```

**Resilience:**
- Pokud `dbGet()` vrátí null pro některý item při exportu (corrupt record), exportér ho skipne + pokračuje + toast zobrazí `(N skipped)`
- Folders jsou v každém chunked partu (duplicitně) — pokud jeden part chybí, folder struktura se neztratí
- Multi-file import dokáže sjet i neúplnou chunked sadu (user potvrdí warning)

---

## Dev server — lokální HTTP mode pro vývoj (20. 4. 2026)

**Problém:** Single-file HTML build dosáhl 26 354 řádků (v202en). Dev ergonomie se zhoršila na třech úrovních:
1. Context window pro Claude při edit tasks neúnosně velký — slepená `<script>` značka v browseru nejde rozumně inspectovat
2. Globální scope napříč 19 moduly (`window.*` implicitně) znamená, že změna v jednom modulu snadno rozbije jiný bez compile-time signálu
3. Chrome DevTools Sources panel je na 26k řádků `<script>` blok prakticky nepoužitelný (breakpointy, stack traces, scrolling)

**Zvažované varianty:**

| Varianta | Plus | Minus |
|---|---|---|
| A) Satelitní HTML (2–3 files) na `file://` | Žádná změna distribuce, zůstáváme na `file://` | IndexedDB origin isolation — rozdělená galerie mezi Core/Video/Paint, export/import overhead jako permanent pain |
| B) **Lokální HTTP server + moduly jako samostatné JS soubory** | Pravá modularita, sdílená IndexedDB, plné DevTools, Ctrl+R hot reload | Vyžaduje spuštěný server (Node), jiný origin než prod file:// |
| C) Tauri migrace nyní | Vyřeší vše najednou (modularita + distribuce + no CORS + user install) | 3–4 sessions Rust setup, blokuje current feature work, předčasné bez hard-limit triggeru |

**Rozhodnutí: B.**

**Implementace (bez refaktorizace modulů):**
- `build.js` rozšířen o `--dev` flag (104 → 280 řádků). Prod režim (concat do single-file HTML) zachován identicky.
- Dev režim generuje `dev/index.html` nahrazením `<script>// __GIS_JS__</script>` bloku v `template.html` za `<script src="./src/NAME.js"></script>` tagů (přesně v `MODULES` order).
- Mini HTTP server na Node built-ins (zero dependencies): `http`, `net`, `fs`, `path`, `child_process`
- Fixní port 7800 (viz samostatný záznam o port fix)
- `Cache-Control: no-store` → Ctrl+R vždy re-fetch; edit-refresh cyklus bez restart serveru
- Path traversal guard (`safeResolve`) na `/src/*` endpointu
- `start_dev.bat` pro Windows dvojklik-spuštění

**Důsledky:**
- `localhost:7800` je jiný origin než `file://gis_vNNNen.html` → nová IndexedDB instance. **Dev/prod separation záměrný** — Petrova reálná data žijí dál v prod verzi na file://, dev localhost má prázdnou DB pro testy.
- Proxy Worker (`gis-proxy.petr-gis.workers.dev`) zůstává — localhost ≠ Tauri, CORS stále platí pro xAI/Luma/Magnific/Topaz/Replicate
- Žádné změny v modulech, žádná ES6 `import`/`export` migrace. Moduly zůstávají globální scope jako dnes.
- Tauri migrace zůstává v TODO jako budoucí krok; tento dev server nezavírá ani neotevírá žádné dveře k Tauri.

---

## HTML Build Validation (14. 4. 2026)

**Problém:** Při refactoru byl omylem ponechán orphan `</div>` tag (po odstranění `wan27CountRow`). Layout se rozbil — Save To, Generate, Queue vypadly z levého panelu. Bez chyby. Stejný typ chyby se už v historii projektu opakoval.

**Rozhodnutí:** Automatická HTML div balance validace v `build.js`:
```js
const divOpens = (htmlOnly.match(/<div[\s>]/g) || []).length;
const divCloses = (htmlOnly.match(/<\/div>/g) || []).length;
if (divOpens !== divCloses) console.error(`⚠ WARNING: HTML div balance = ${divOpens - divCloses}`);
else console.log(`✓ HTML div balance: OK (${divOpens} pairs)`);
```

Při každém buildu zobrazí balanci. Pokud nesedí, build projde ale zobrazí warning.

---

## Imagen 4 REST API — sampleImageSize (15. 4. 2026)

**Problém:** 5. pokus o aktivaci 2K resolution u Imagen 4 Standard/Ultra přes REST API. Předchozí 4 pokusy byly neúspěšné — všechny renderovaly jen 1K.

**Root cause:** REST API Gemini endpointu `:predict` používá **Vertex AI naming convention** pro parametry: `sampleImageSize`, ne `imageSize` (což je SDK name). Google SDK to interně mapuje, ale při REST volání musí být Vertex název.

**Dokumentace to nezmiňovala jasně:**
- Gemini API REST sekce ukazuje jen `sampleCount` v REST curl příkladu
- SDK docs zmiňují `imageSize` ale s poznámkou "Note: Naming conventions of parameters vary by programming language"
- Pravdu ukazovala až Vertex AI doc `set-output-resolution`: `sampleImageSize` v JSON body

**Fix:**
```js
if (!model.id.includes('fast') && imageSize !== '1K')
  params.sampleImageSize = imageSize;  // "2K"
```

**Ověřeno:** 2K u Imagen 4 Ultra na 16:9 = 2816×1536. Aktualizována paměť uživatele.

**Lessons learned:**
- Při REST volání Google API: hledat Vertex AI doc (ne jen Gemini API doc)
- `imageSize` (SDK) = `sampleImageSize` (REST)
- `numberOfImages` (SDK) = `sampleCount` (REST)
- Uvolit parametr konzervativně — default 1K se bez parametru generuje spolehlivě

---

## Unified Image Panel — jedna dynamická šablona (14. 4. 2026)

**Problém:** 9 separátních HTML panelů (nbParams, imagenParams, fluxParams, seedreamParams, klingParams, zimageParams, wan27Params, qwen2Params, grokParams) — každý nový model = nový HTML blok + nový JS wiring. Duplikované prvky (count, resolution, seed) v každém panelu. model-select.js: 300+ řádků show/hide logiky.

**Rozhodnutí: Jeden generický panel (`upParams`) s 14 prvky:**
- Každý model v models.js deklaruje UI flags (resolutions, maxCount, steps, guidance, seed, safetyTolerance, safetyChecker, grounding, etc.)
- `selectModel()` zobrazuje/skrývá prvky podle flagů
- `generate()` čte z jedné sady elementů, mapuje na per-type snap formáty
- Resolution: 3 tlačítka, labely z `model.resolutions[]`, pixel info dynamicky per type
- Count: 4-button (většina) nebo 10-button (Grok) varianta
- Safety: slider (FLUX) nebo checkbox (SeeDream/Z-Image/Qwen2) varianta
- Thinking: radio Min/High (NB2) nebo checkbox (WAN 2.7) varianta

**Scope:** Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok
**Stranou:** Luma Photon, Mystic, Freepik Edit (unikátní parametry, zůstávají jako legacy panely)

**Doplňková rozhodnutí:**
- Resolution 512 odstraněna (NB2, FLUX) — generuje 1K i s 512 nastavením
- Prompt upsampling/expansion/enhance zakázáno v UI, posíláno jako false
- Neg prompt: jeden sdílený prvek, prefilled s `_DEFAULT_NEG_PROMPT`
- Checkbox `.chk-box` border: 1px→1.5px s `var(--dim2)` pro viditelnost

**Výsledek:** template.html −330 řádků, model-select.js −85 řádků. Přidání nového image modelu = jen přidat objekt do MODELS s UI flags.

---

## Setup UI redesign — střídavé pozadí + Get Key linky (11. 4. 2026)

**Rozhodnutí:** Střídavé pozadí, accent labels, Get key → linky.

---

## PixVerse C1 integration via proxy (11. 4. 2026)

**Rozhodnutí:** Passthrough Worker architektura. 4 režimy: T2V, I2V, Transition, Fusion.

---

## Druhá reference jako interní kontext (10. 4. 2026)

**Rozhodnutí:** REFS tagging systém `[REFS:1]` / `[REFS:1,2]`.

---

## Camera Reframe — Strategie (10. 4. 2026)

**Rozhodnutí: Variant approach.** Agent generuje 4 varianty, uživatel zkouší postupně.

---

## Edit Tool — Unified Agent Architecture (10. 4. 2026)

**Rozhodnutí:** Jeden unified AI agent s automatickou klasifikací (TYPE A/B).

---

## Code cleanup & deduplication (9. 4. 2026)

**Rozhodnutí:** Systematický refaktor v jedné verzi (v190en).
**Výsledek:** 17 533 → 16 897 JS řádků (−636, −3.6 %).

---

## Worker release tag history

| Tag | Datum | Změna |
|---|---|---|
| 2026-16 | 18. 4. 2026 | Session 3 / Session 2.1 — no Worker change |
| 2026-15 | 13. 4. 2026 | xAI image: b64_json, multi-image edit |
| 2026-14 | … | xAI Video: 6 routes (submit/edit/extend/status/download) |
| 2026-12 | 11. 4. 2026 | PixVerse C1: 6 routes |
| 2026-09 | 6. 4. 2026 | R2 generic upload/serve, Kling V2V fix |

---

## Dlouhodobé principy (kodifikovaná pravidla)

### Ne-dotknutelnost existujících modelů a endpointů
NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele. Pokud je něco "zastaralé" nebo "podle dokumentace deprecated" — vždy nejdřív potvrdit s Petrem, ne tiše odstranit.

### Výzkum před integrací
Před přidáním nového modelu/API: web_search, probe endpoints, check regionální dostupnost. WAN 2.7 Video Edit selhal kvůli Singapore vs čínský endpoint — step 1 check.

### REST vs SDK naming
Google API: REST používá Vertex AI naming (`sampleImageSize`, `sampleCount`), SDK používá SDK naming (`imageSize`, `numberOfImages`). Při REST volání vždy hledat Vertex AI doc.

### Worker free tier limit
Cloudflare Workers free tier: 30 s wall-clock limit. **Nikdy nepollovat uvnitř Workeru** (timeout = failed request). Vždy return hned s request_id, polling ze strany klienta.

### Snap count v addToQueue
Každý model má svůj count field v snap objektu (geminiCount, fluxCount, sdCount, klingCount, zimageCount, qwen2Count, xaiSnap.grokCount, imagenSnap.sampleCount, wan27Snap.count, mysticSnap.count). Rerun force=1 pro všechny (od v202en).

### Ref prefix (od v200en)
Prefix `[Reference images:]` ODSTRANĚN. Styles/camera prefix pro Gemini nedotčený. @mentions převáděné na model-specific format (`image N` pro Gemini/xAI, `@ImageN` pro Flux/Kling, `Figure N` pro SeeDream).

### Listing operations = meta only
Pro listing/thumbnail/lookup operace VŽDY použít meta store (`dbGetAllMeta`, `dbGetAllAssetMeta`). Plná data (s imageData/videoData) načítat jen při single-item akci (open, edit, download).

### Grid/Flex nesting gotcha (v202en lesson)
`.gal-grid` s `display:grid` MUSÍ být normal block child, ne flex item. Flex-item s display:grid v nested flex-column selhává na width calculation → karty kolabují. Pattern: wrapper (flex column) → `.lib-toolbar` (flex-shrink:0) → scroll container (flex:1 + overflow-y:auto + min-height:0) → `.gal-grid` uvnitř.

### Paint engine invariant
`history[0]` = čistý originál, nikdy přepsán aktuálním ctx. `annotCanvas` = klon anotací, nezávislý na base.

### `/mnt/project/` je VŽDY stale
Infrastructure problém Anthropicu, ne Petrovy zodpovědnost. Session start: (1) STAV.md z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) build → dist.

### Video subsystem (od v203en)
6 submodulů s jasným ownership. Cross-module calls povolené (globální scope). Build order kritický: utils → models → queue → gallery → topaz → archive. Pokud nová funkce potřebuje cross-call opačným směrem, je to signál že je ve špatném modulu.
