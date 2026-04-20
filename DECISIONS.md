# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 20. 4. 2026 · Session 3 upload dedup + port fix*

---

## Gallery upload — progress + fingerprint dedup (20. 4. 2026, Session 3)

**Problém 1 (progress):** `uploadImagesToGallery` v `db.js` neměla žádný progress overlay. User viděl jen hluchou minutu, pak se obrázky objevily. Main thread byl nonstop-busy (`await FileReader`, `dbPut`, `generateThumb`).

Sjednávalo se to komplikovaně — prvně jsem omylem opravoval `uploadAssetsFromFile` v `assets.js` (tlačítko ve Assets library), až jsem si uvědomil že Petr uploaduje přes jiné tlačítko ve Gallery toolbaru. Tlačítka nesou oba label `↑ Upload` a volají jinou funkci v jiném modulu.

**Rozhodnutí progress:** Identický pattern jako `exportGallery` — custom local progressEl, inline CSS, getElementById update. `dlProgShow`/`dlProgUpdate` helpery z db.js v tomto kontextu z neznámého důvodu nefungovaly (overlay se nezobrazil), proto návrat k ověřenému patternu. Investigace proč `dlProgShow` selhal zvlášť v uploadu se zatím neudělala — nepotřebujeme ji, jelikož custom pattern je prokazatelně funkční.

**Problém 2 (dedup):** Gallery upload nedetekoval duplikáty, ale assets upload a archive import ano. Inkonzistence napříč GIS. User mohl uploadnout stejný obrázek vícekrát.

**Zvažované varianty řešení dedup:**

| Varianta | Plus | Minus |
|----------|------|-------|
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
|----------|------|-------|
| A) **Include thumbs v archivu + fallback regeneration** | Future archives = okamžité thumby; backward compat pro staré | Archiv ~1% větší (10-30 KB × videos) |
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
- Update každých 3-5 itemů + `setTimeout(0)` yield
- Trigger threshold: 10+ obrázků, 5+ videí (videa jsou dražší), 10+ assetů. Pod threshold se overlay neukáže (operace je rychlá, bliknutí by bylo rušivější než žádný progress).

Move operace (`moveSelectedGalleryToFolder`, `videoMoveSelected`, `moveSelectedAssetsToFolder`) progress nepotřebují — `Promise.all` dokončí typickou operaci pod 100 ms.

---

## Streaming + chunked archive export (20. 4. 2026 — Session 1+2)

**Problém:** `exportGallery()` padal při >320 obrázcích (OOM crash tabu), `exportVideoArchive()` u velkých video knihoven tiše produkoval syntakticky nevalidní JSON (archivace "proběhla" bez erroru, ale soubor nešel naimportovat). Oba exporty držely celou knihovnu v RAM najednou (~640 MB pole JSON stringů × 320 obrázků, plus ~640 MB při konstrukci Blobu). V8 má softlimit ~512 MB na jeden string, Chrome na Windows někdy tiše truncatuje Blob write >500 MB.

**Zvažované varianty:**

| Varianta | Plus | Minus |
|----------|------|-------|
| A) **Streaming write** přes `FileSystemWritableFileStream`, per-item | Memory peak ~1 item; minimální změna kódu; reusable v Tauri | Vyžaduje FS API (localhost/https), na file:// nefunguje |
| B) **Chunked archive** (auto-split do multi-file) | Funguje všude i na file://; resilience (corrupt part neruší zbytek) | Víc souborů pro uživatele; komplexnější import |
| C) ZIP formát s binary daty | 30% menší archiv, standardní formát | Custom JS ZIP reader ~150 řádků; v Tauri nahrazen Rust crate → throw-away kód |

**Rozhodnutí: A+B kombinovaně, implementováno v jedné session.**

Session 1 = cesta A (streaming JSON, jeden soubor). Session 2 = cesta B (chunked multi-file pro file:// fallback). **Kritická pro distribuci single-file HTML buildu** — Petr provozuje `gis_vNNNen.html` na `file://`, kde FS API není dostupné. Bez chunked cesty by archivace velkých knihoven z file:// nefungovala vůbec.

**ZIP (varianta C) zamítnut** po analýze Tauri migrace:
- JS ZIP reader = throw-away (Rust `zip` crate je lepší ve všem po přechodu)
- Streaming JSON serialization logika je naopak reusable (v Tauri se jen změní target writer z `WritableStream` na `writeBinaryFile`)
- Celá archive feature v Tauri bude pravděpodobně přepsaná na folder-based backup (manifest.json + originální `images/*.png`, `videos/*.mp4` přímo) — žádný archive wrapper potřeba

**Formát:**
- **Streaming cesta (FS API):** původní JSON schema beze změny (single-file `gis-archive-2026-04-20-248img.json`)
- **Chunked cesta (file:// fallback):** rozšířené schema s `archiveId`, `partNumber`, `totalParts`, `imageCountTotal`. Filename pattern `gis-archive-2026-04-20-part1of3-100img.json`

**Auto-split thresholdy:**
- Gallery: > 100 obrázků (100 × 2 MB ≈ 200 MB per part, bezpečně pod V8 limit)
- Video: > 5 videí (5 × 30 MB ≈ 150 MB per part)

**Chrome multi-download UX:**
- User uvidí jednou dialog "Allow multiple downloads from this site" a potvrdí
- Mezi `a.click()` pauza 500ms (gallery) / 700ms (video) aby Chrome throttling nepřeskakoval
- Všech N parts stáhne postupně do Downloads

**Implementace:**
- `gallery.js` — `exportGallery()` (3 cesty: streaming / chunked / legacy), `importGallery()` přepsán na multi-file awareness
- `video.js` — `exportVideoArchive()` (3 cesty), `importVideoArchive()` multi-file
- `template.html` — přidán `multiple` atribut na oba `<input type="file">` pro archive import

**Multi-file import architektura:**
- Files sorted podle `part{N}of{M}` v názvu (alphabetic fallback)
- Pre-scan: první 64 KB každého souboru se zparsuje jako header, validuje se `archiveId` konzistence a `totalParts` pokrytí
- Varování pokud chunked archive má chybějící parts (`missing N of M parts, proceed?`)
- Single confirm dialog pro celý archiv (ne per-file)
- Agregovaný progress napříč soubory (`file 2 / 3 — 145 / 248 images`)

**Resilience:**
- Pokud `dbGet()` vrátí null pro některý item při exportu (corrupt record), exportér ho skipne + pokračuje + toast zobrazí `(N skipped)`
- Folders jsou v každém chunked partu (duplicitně) — pokud jeden part chybí, folder struktura se neztratí
- Multi-file import dokáže sjet i neúplnou chunked sadu (user potvrdí warning)

**Důsledky:**
- 320-obrázkový crash vyřešen na localhost (streaming) i file:// (chunked)
- Corrupt video JSON vyřešen — streaming write je deterministic, chunked parts jsou každý pod V8 string limitem
- Archivace single-file distribuce (file://) funguje pro libovolně velké knihovny

---

## Dev server — lokální HTTP mode pro vývoj (20. 4. 2026)

**Problém:** Single-file HTML build dosáhl 26 354 řádků (v202en). Dev ergonomie se zhoršila na třech úrovních:
1. Context window pro Claude při edit tasks neúnosně velký — slepená `<script>` značka v browseru nejde rozumně inspectovat
2. Globální scope napříč 19 moduly (`window.*` implicitně) znamená, že změna v jednom modulu snadno rozbije jiný bez compile-time signálu
3. Chrome DevTools Sources panel je na 26k řádků `<script>` blok prakticky nepoužitelný (breakpointy, stack traces, scrolling)

**Zvažované varianty:**

| Varianta | Plus | Minus |
|----------|------|-------|
| A) Satelitní HTML (2–3 files) na `file://` | Žádná změna distribuce, zůstáváme na `file://` | IndexedDB origin isolation — rozdělená galerie mezi Core/Video/Paint, export/import overhead jako permanent pain |
| B) **Lokální HTTP server + moduly jako samostatné JS soubory** | Pravá modularita, sdílená IndexedDB, plné DevTools, Ctrl+R hot reload | Vyžaduje spuštěný server (Node), jiný origin než prod file:// |
| C) Tauri migrace nyní | Vyřeší vše najednou (modularita + distribuce + no CORS + user install) | 3–4 sessions Rust setup, blokuje current feature work, předčasné bez hard-limit triggeru |

**Rozhodnutí: B.**

**Implementace (bez refaktorizace modulů):**
- `build.js` rozšířen o `--dev` flag (104 → 280 řádků). Prod režim (concat do single-file HTML) zachován identicky.
- Dev režim generuje `dev/index.html` nahrazením `<script>// __GIS_JS__</script>` bloku v `template.html` za 19 `<script src="./src/NAME.js"></script>` tagů (přesně v `MODULES` order).
- Mini HTTP server na Node built-ins (zero dependencies): `http`, `net`, `fs`, `path`, `child_process`
- Port auto-detect 7800–7810 (vyhýbáme se dev portům 3000/5000/8000/8080)
- `Cache-Control: no-store` → Ctrl+R vždy re-fetch; edit-refresh cyklus bez restart serveru
- Path traversal guard (`safeResolve`) na `/src/*` endpointu
- `start_dev.bat` pro Windows dvojklik-spuštění

**Důsledky:**
- `localhost:7800` je jiný origin než `file://gis_v202en.html` → nová IndexedDB instance. **Dev/prod separation záměrný** — Petrova reálná data žijí dál v prod verzi na file://, dev localhost má prázdnou DB pro testy.
- Proxy Worker (`gis-proxy.petr-gis.workers.dev`) zůstává — localhost ≠ Tauri, CORS stále platí pro xAI/Luma/Magnific/Topaz/Replicate
- Žádné změny v modulech, žádná ES6 `import`/`export` migrace. Moduly zůstávají globální scope jako dnes.
- Tauri migrace zůstává v TODO jako budoucí krok; tento dev server nezavírá ani neotevírá žádné dveře k Tauri.

**Co tento krok ZÁMĚRNĚ NEŘEŠÍ:**
- ES6 modularizace (`import`/`export`)
- Rozdělení monstr `video.js` (5211) a `paint.js` (2110) na submoduly
- Watch mode / auto-reload (Ctrl+R je záměrně manuální — spolehlivější při chybách)
- Distribuce pro non-tech uživatele (Tauri)
- Sdílení dat mezi `file://` prod a `localhost` dev instancemi

**Dilema řešené předem:** IndexedDB separation mezi file:// a localhost = jednorázová bolest, že testovací data dev instance nemá přístup k produkčním. Petr vědomě zvolil dev/prod separation místo jednorázové export/import migrace. Pokud se to v budoucnu ukáže jako překážka, přidáme export/import UI (samostatný krok).

---

## Paint Engine — Parallel Annotation Layer (16. 4. 2026)

**Problém:** Method B (Layers) save v annotate modálu používal **diff rekonstrukci** místo skutečného layer systému. Logika: `history[0]` = čistý originál (snapshot ctx po `openAnnotateModal`), aktuální `ctx` = obrázek + tahy. Diff pixel-by-pixel rekonstruoval tahy.

**3 bugy odkryté postupně v jedné testovací session:**

1. **Anotuj → crop → save B → bílý Layer 2:**
   `pCropApply` přepisoval `history[0]` aktuálním ctx (cropnutá verze obrázku + anotace). Diff(current, history[0]) = 0 → všechno bílé pozadí → Layer 2 je bílá plocha.

2. **Anotuj → crop → save B → špinavý Layer 1:**
   Stejná příčina — `history[0]` obsahoval anotace. Layer 1 by měl být čistý orig, ale byl = obrázek + anotace.

3. **Anotuj → crop → inpaint → source je levý horní roh:**
   `_annotateBaseB64` (global, používaný inpaint crop preview) se nastavuje v `openAnnotateModal` a `pCropApply` ho neaktualizoval. Inpaint `drawImage(bi, cropX, cropY, ...)` kreslil z nových souřadnic na pre-crop obrázek.

**Diskuse variant:**
- **Varianta A: Opravit diff flow** (~30 řádků) — zachovat diff rekonstrukci, fix v pCropApply aby history[0] zůstal čistý originál.
- **Varianta B: Refactor na skutečný separate annotation canvas** (~250 řádků) — diff pryč, Method B čte ze samostatného canvasu.

Petr zvolil **variantu B** s odůvodněním "žádný diff — anotace má být samostatný layer".

**Rozhodnutí: Paralelní annotation canvas (minimálně invazivní verze variant B):**
Místo full render pipeline refactoru (display canvas by flatnoval base + annot při každém draw) přidán **paralelní `_annotateAnnotCanvas`** vedle existujícího `_annotateMaskCanvas`. Tahy se kreslí do 3 ctx zároveň:
1. `state.ctx` (display) — user vidí okamžitě
2. `state.maskCtx` — bílé tahy pro inpaint (legacy)
3. `state.annotCtx` — **barevné tahy na transparentním pozadí (nové)**

`history[0]` zůstává autoritativní "clean original" invariant. Po cropu se rekonstruuje cropováním pristinního `history[0]` přes drawImage s clip (ne přepsáním aktuálního ctx). `_annotateBaseB64` se aktualizuje ze stejného cropnutého canvasu.

Method B export:
- Layer 1 = `history[0]` PNG (čistý orig, automatically cropped when canvas was cropped)
- Layer 2 = white fillRect + drawImage(annotCanvas) PNG (čisté tahy na bílém pozadí)

**Rozsah:** ~80 řádků v paint.js (vs. odhad 250). Důvod: místo full render pipeline refactoru paralelní mirror. Žádné riziko regrese paint tabu, undo, inpaint integrace.

**Soft-blend composite bonus fix:**
V `_compositeAndSaveQueueJob` soft-blend path (`maskBlur > 0`) byly `rc.drawImage(ri, 0, 0)` a `rc.drawImage(mi, 0, 0)` 3-param → kreslí v přirozené velikosti. Pokud model vrátil výsledek v menším rozlišení než `cropW×cropH`, content byl v levém horním rohu resultCrop a composite back vložil posun. Fix: 5-param s cílovými rozměry `cropW × cropH`. Hard-blend už OK měl.

---

## Z-Image Turbo — Split T2I / I2I (16. 4. 2026)

**Kontext:** `zimage_turbo` byl **hybrid model** — jeden dropdown option s dynamickým přepínáním endpointu:
- bez refu → `fal-ai/z-image/turbo` (T2I)
- s refem → `fal-ai/z-image/turbo/image-to-image` (I2I)

UI flags: `refs: true, maxRefs: 1, i2iModel: true, strength: true`.

**Problém:** Strength slider se zobrazil vždy (model má `strength: true`), i v T2I módu kdy je irelevantní. Navíc byl řízený dvěma nezávislými body:
- `model-select.js` — `(m.strength && refs.length > 0)` při select modelu
- `refs.js` — stejná podmínka při ref-change (zastaralé z hybrid éry)

Při přepínání modelů nebo ref-change se slider objevoval/mizel nekonzistentně.

**Rozhodnutí: Rozdělit na dva samostatné modely.**
- `zimage_turbo` — čistě T2I, endpoint `fal-ai/z-image/turbo`, bez refs/strength/i2iModel
- `zimage_turbo_i2i` — čistě I2I, endpoint `fal-ai/z-image/turbo/image-to-image`, `refs: true, maxRefs: 1, strength: true, i2iModel: true`, ref required

Kombinovaný s čistším řízením strength slideru (jen v `model-select.js` podle `m.strength` flag, bez vazby na refs.length).

**Alternativy zvážené a zamítnuté:**
- Dynamicky skrývat strength podle stavu refs v jednom hybrid modelu — složitější logika, stále UX nejasné
- Zachovat hybrid s upozorněním "strength works only with ref" — neřeší UX nekonzistenci

**Ref upload label aktualizace:** "No image = T2I" (legacy z hybrid éry) → "Input image required". Odpovídá dedicated I2I sémantice.

**Dropdown separator:** Z-Image a WAN byly ve stejné "skupině" (mezi dvěma `<option disabled>` separatory, bez mezi). Přidán separator → vizuálně oddělené sekce.

---

## Z-Image Edit — TODO odepsán (16. 4. 2026)

**Kontext:** TODO položka "Z-Image Edit (`fal-ai/z-image/edit`)" byla v seznamu od paměťového snapshotu.

**Research:** Z-Image rodina na fal.ai obsahuje:
- `fal-ai/z-image/base` — T2I standard (6B params, 28 steps, CFG)
- `fal-ai/z-image/turbo` — T2I ultra-fast (8 steps, acceleration)
- `fal-ai/z-image/base/lora` — T2I base + LoRA array
- `fal-ai/z-image/turbo/lora` — T2I turbo + LoRA array
- `fal-ai/z-image/turbo/image-to-image` — strength-based I2I
- `fal-ai/z-image-trainer` — LoRA training (ZIP dataset)

**Žádný instruction-based edit endpoint** existuje (typu Qwen Edit / WAN Edit / FLUX Kontext). TODO položka založena na mylném předpokladu.

**Rozhodnutí:** Odepsat z TODO. Místo toho:
- Nahrazeno Z-Image Turbo T2I/I2I split (bod výše)
- Přidáno nové TODO: **Z-Image LoRA generation** (fal-ai/z-image/{base,turbo}/lora) + **Z-Image LoRA trainer**

---

## Segmind — Odstraněn z klientu (16. 4. 2026)

**Kontext:** Segmind API klíč byl v setup UI pro WAN 2.7 image generation & editing. V v196en WAN 2.7 přešel na Replicate (full aspect ratio whitelist vs. Segmind square-only). Segmind se nikde nepoužívá, klíč v setupu zůstal orphan.

**Akutní motivace:** Přidáním PixVerse klíče do setupu bylo porušené střídání světlých/tmavých pruhů mezi Topaz/PixVerse/Segmind/Replicate/OpenRouter. Nejrychlejší oprava = odstranit nepoužívaný Segmind.

**Rozhodnutí:** Odstranit z klientu:
- `template.html` — celý SEGMIND API KEY block (11 řádků)
- `setup.js` — localStorage load, `onSetupSegmindKey` handler, `API_KEY_FIELDS` entry
- `spending.js` — `'segmind'` ze `SPEND_PROVIDERS`

**Ponecháno (do příštího cleanupu):**
- Worker `handlers/segmind.js` — mrtvý kód ve Workeru, neovlivňuje klient
- `gis_segmind_apikey` klíč v localStorage uživatelů — orphan, ale neškodný

**Výsledek:** Sekvence pruhů obnovena (TOPAZ → A, PIXVERSE → B, REPLICATE → A, OPENROUTER → B).

---

## MaxRefs enforcement — třívrstvá kontrola (14. 4. 2026)

**Problém:** Přepnutí modelu (např. NB2 s 14 refy → Qwen Edit s max 3) neomezovalo reference. Tři nezávislé kontroly chyběly: UI, AI agent, API dispatch. Job se poslal se všemi refy → 422 error.

**Scénář:** Uživatel nahraje 4 refs pro NB2 → generuje → Reuse → přepne na Qwen Edit → API vrátí "Maximum 3 reference images allowed". Navíc Edit Tool agent generuje prompt odkazující na image 4 i když model ji nepřijme.

**Rozhodnutí: 3 nezávislé vrstvy:**
1. **UI** — `renderRefThumbs()` dimuje refs nad limitem (`.ref-dimmed` class). Counter ukazuje active/max. Refs nejsou SMAZÁNY (zachovány pro přepnutí zpět).
2. **AI agent** — Edit Tool system prompt, ref preview, `_etmSend()`, `_etmAppendVariants()` — vše capped na model maxRefs. `_etmReadaptPrompt()` přidá CRITICAL instrukci pro ořezání referencí v promptu.
3. **API dispatch** — `refsCopy = getActiveRefs().map(...)` v generate.js — definitivní hard limit.

**Alternativy zvážené a zamítnuté:**
- Smazat přebytečné refs při přepnutí modelu → destruktivní, uživatel by je musel znovu nahrát
- Blokovat přepnutí modelu pokud má moc refs → přílišné omezení workflow

---

## Edit Tool model switch — ref-aware readapt (14. 4. 2026)

**Problém:** `etmSwitchModel()` nevolal `_etmRefreshRefPreviews()` a `_etmReadaptPrompt()` nezohledňoval změnu ref limitu.

**Rozhodnutí:**
- `etmSwitchModel()` nově volá `_etmRefreshRefPreviews()` → okamžitý dimming update
- `_etmReadaptPrompt()` přidá `refTrimNote` když `refs.length > newMax`:
  "CRITICAL: The target model only accepts N reference images. Remove ALL references to images beyond image N."

---

## Grok Imagine Video — přímé xAI API přes proxy (14. 4. 2026)

**Kontext:** xAI nabízí `grok-imagine-video` s 5 módy: T2V, I2V, Reference-to-Video (max 7 obrázků), V2V Edit, Extend. Dostupné přes přímé xAI API i fal.ai.

**Rozhodnutí: Přímé xAI API (ne fal.ai):**
- ✅ Plný přístup ke všem 5 módům (fal.ai nemá Extend a Reference-to-Video jako jeden)
- ✅ Levnější: $0.05/s vs fal.ai ~$0.06/s
- ✅ Jeden model string pro vše
- ⚠ Vyžaduje Worker handler (xai-video.js)

**Rozhodnutí architektura:**
- Worker jen submituje a vrací `request_id`. GIS polluje client-side (Worker 30s limit).
- xAI video URL je dočasná a nemá CORS → download proxy route (`/xai/video/download`)
- Reference images: base64 data URIs přímo v payloadu (xAI akceptuje, žádný upload potřeba)
- V2V Edit / Extend: source video z galerie → R2 upload → HTTPS URL → xAI (xAI potřebuje URL, ne base64)

**Rozhodnutí UI:**
- Jeden model `grok_video` s mode selectorem (T2V/I2V/Ref2V/Edit/Extend) — odpovídá tomu jak xAI sám model prezentuje
- Duration/resolution/aspect se skrývají pro Edit (output = input)

**xAI Video Edit payload gotcha:**
- xAI chce `video: {url: "..."}` (objekt), NE `video_url: "..."` (flat string)
- Extend: `video: {url}` + `duration` (délka přidané části, ne celkového výstupu)
- Zjištěno z 422 deserializační chyby

**Extend nestabilita:**
- xAI Extend mód přijme job ale často vrátí "internal error"
- Potvrzeno komunitou (březen 2026) + xAI acknowledged bugy v audio extensions
- T2V, I2V, V2V Edit fungují spolehlivě

---

## Grok Imagine — kompletní integrace (13. 4. 2026)

**Kontext:** xAI Grok Imagine API nabízí řadu features které GIS neměl implementované: multi-image editing (5 refs), Grok Pro model, count až 10, `response_format: b64_json`.

**Rozhodnutí Worker:**
- T2I → `/v1/images/generations`, Edit → `/v1/images/edits` — dva různé endpointy
- `response_format: b64_json` eliminuje Worker-side URL fetch. API vrátí base64 přímo.
- Multi-image: `images: [{type: "image_url", url: "data:..."}]` array

**Rozhodnutí Pro vs Standard:**
- Pro (`grok-imagine-image-pro`): maxRefs 1 (API limit potvrzený errorem), default 2K, $0.07/img
- Standard (`grok-imagine-image`): maxRefs 5, default 1K, $0.02/img

**Rozhodnutí aspect ratio:**
- Grok podporuje 13 poměrů. `_grokFilterAspects()` filtruje.
- Nepodporované (21:9, 4:5, 1:4, 4:1) se skryjí.

**Rozhodnutí concurrency:**
- xAI limit snížen na 2 concurrent requesty (z globálních 4). 503 při batchi.

---

## Edit Tool — 7 modelových typů (13. 4. 2026)

**Rozhodnutí:**
- Rozšířit type systém na 7 typů: gemini, flux, seedream, kling, qwen2, grok, wan
- Každý typ má vlastní ETM_ELEMENT_* template
- Badge má unikátní barvu per typ
- `_etmReadaptPrompt` automaticky konvertuje prompt při přepnutí modelu

---

## Edit Tool — TYPE A/B klasifikace (13. 4. 2026)

**Rozhodnutí:**
1. TYPE B = POUZE změna pohledu, ŽÁDNÁ změna obsahu
2. Multi-ref TYPE A: prompt MUSÍ explicitně referencovat KAŽDÝ obrázek by number
3. Keep section VŽDY obsahuje "camera angle, framing"
4. Zákaz invence mood/grading z jiných referencí

---

## Ref prefix — čistý prompt bez labelů (13. 4. 2026)

**Rozhodnutí:**
- Prompt posílaný modelu: `[Reference images: image 1, image 2, image 3]` — jen čísla
- User labels viditelné v UI ale NE v API promptu

---

## Qwen 2 Edit — maxRefs opraveno (13. 4. 2026)

**Rozhodnutí:** maxRefs 4 → 3. API limit je 3.

---

## Error karty — Dismiss button (13. 4. 2026)

**Rozhodnutí:** ✕ Dismiss button. Smaže error kartu a reflow grid.

---

## Recraft Crisp upscale — PNG→JPEG + 4 MP pre-flight (12. 4. 2026)

**Rozhodnutí file size:** PNG→JPEG konverze (q92→q85→q75)
**Rozhodnutí pixel resolution:** Pre-flight check `w * h > 4194304` → modální dialog
**Rozhodnutí error visibility:** `job.pendingCards = [cardEl]` fix + console.error

---

## Qwen Image 2 — negative_prompt + multi-ref edit (12. 4. 2026)

**Rozhodnutí:** `negative_prompt` + `maxRefs: 4 → 3` (API limit) + area-based 4 MP cap

---

## Dead code cleanup — callWan27 (12. 4. 2026)

**Rozhodnutí:** Odstranit dead code. `callWan27eVideo` ve video.js ZŮSTÁVÁ.

---

## Clarity upscale — empirický limit 25 MP output (12. 4. 2026)

**Rozhodnutí:** Pre-flight check na output > 25 MP.

---

## Runway Gen-4 — výzkum proveden, čeká na rozhodnutí (12. 4. 2026)

**Stav:** Kompletní API výzkum. Implementační odhad ~2-3 sessions.
**Rozhodnutí:** Odloženo.

---

## WAN 2.7 Image: Segmind → Replicate (12. 4. 2026)

**Rozhodnutí:** Replicate s 5 aspect ratios, ověřený whitelist. Standard max 2K, Pro max 4K.

---

## Dynamický params systém — odloženo

**Rozhodnutí:** Neimplementovat — příliš velké riziko regresí. Hybridní přístup pro nové modely.

---

## Tauri distribuce — odloženo

**Spustit kdy:** GIS je stabilní a feature-complete.

---

## Proxy architektura — verze history

| Verze | Datum | Změny |
|-------|-------|-------|
| 2026-16 | 14. 4. 2026 | xAI Video: 6 routes (submit/edit/extend/status/download) |
| 2026-15 | 13. 4. 2026 | xAI image: b64_json, multi-image edit |
| 2026-12 | 11. 4. 2026 | PixVerse C1: 6 routes |
| 2026-09 | 6. 4. 2026 | R2 generic upload/serve, Kling V2V fix |

---

## Code cleanup & deduplication (9. 4. 2026)

**Rozhodnutí:** Systematický refaktor v jedné verzi (v190en).
**Výsledek:** 17533 → 16897 JS řádků (−636, −3.6%).

---

## Edit Tool — Unified Agent Architecture (10. 4. 2026)

**Rozhodnutí:** Jeden unified AI agent s automatickou klasifikací (TYPE A/B).

---

## Camera Reframe — Strategie (10. 4. 2026)

**Rozhodnutí: Variant approach.** Agent generuje 4 varianty, uživatel zkouší postupně.

---

## Druhá reference jako interní kontext (10. 4. 2026)

**Rozhodnutí:** REFS tagging systém `[REFS:1]` / `[REFS:1,2]`.

---

## PixVerse C1 integration via proxy (11. 4. 2026)

**Rozhodnutí:** Passthrough Worker architektura. 4 režimy: T2V, I2V, Transition, Fusion.

---

## Setup UI redesign — střídavé pozadí + Get Key linky (11. 4. 2026)

**Rozhodnutí:** Střídavé pozadí, accent labels, Get key → linky.

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

## Unified Image Panel (14. 4. 2026)

**Problém:** 9 separátních HTML panelů (nbParams, imagenParams, fluxParams, seedreamParams, klingParams, zimageParams, wan27Params, qwen2Params, grokParams) — každý nový model = nový HTML blok + nový JS wiring. Duplikované prvky.

**Rozhodnutí: Jeden generický panel `upParams` s 14 prvky:**
- Každý model v models.js deklaruje UI flags (resolutions, maxCount, steps, guidance, seed, safetyTolerance, safetyChecker, grounding, etc.)
- `selectModel()` zobrazuje/skrývá prvky podle flagů
- `generate()` čte z jedné sady elementů, mapuje na per-type snap formáty
- Handlers nedotčené — stejné snap formáty

**Scope:** Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok
**Stranou:** Luma Photon, Mystic, Freepik Edit (unikátní parametry, zůstávají legacy)

**Výsledek:** template.html −330 řádků, model-select.js −85 řádků. Přidání nového image modelu = jen přidat objekt do MODELS s UI flags.

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

## Reference prefix `[Reference images: ...]` — odstraněn (14. 4. 2026)

**Problém:** Prefix `[Reference images: image 1, image 2]` se přidával do textarea při přepnutí modelu na Gemini/xAI. Funkčně neškodil (neduplikoval se), ale byl redundantní — Gemini vidí obrázky v `parts` array. Petrovi to vadilo vizuálně.

**Rozhodnutí:** Úplně odstraněno. `preprocessPromptForModel` pro Gemini/xAI už prefix nepřidává. Legacy prefix se stripuje vždy (i bez refs). `rewritePromptForModel` cleanup při každém přepnutí modelu.

**Co zůstává:** Styles a camera prefix pro Gemini — ty jsou na začátku promptu ve formátu "Visual style instructions: ... . Camera: ... .\n\n[prompt]" a jsou zachovány.

---

## Edit Tool Agent — chat memory fix (14. 4. 2026)

**Problém:** V Edit Tool si agent nepamatoval předchozí konverzaci. Modal se otevřel, chat byl viditelný, ale agent reagoval jako by neviděl nic než analyzované refs.

**Root cause:** `callGeminiTextMultiTurn()` při OpenRouter path (primární agent) posílala jen poslední user message, ne celou historii:
```js
const lastUserMsg = [...history].reverse().find(m => m.role === 'user')?.parts?.[0]?.text || '';
const result = await _callOpenRouterText(systemPrompt, lastUserMsg, 0.85, 2048);
```

**Fix:** Nová funkce `_callOpenRouterMultiTurn()` která:
1. Konvertuje Gemini history `[{role,parts:[{text}]}]` na OpenAI `[{role,content}]`
2. Mapuje role 'model' → 'assistant'
3. Posílá celé messages array na OpenRouter

**Agent si teď pamatuje celou konverzaci** — persistent dokud uživatel nedá reset nebo nezavře modal.

---

## Crop Tool (15. 4. 2026)

**Problém:** Petr potřebuje oříznout obrázek. Dělá to mimo GIS (export → crop → import zpět). V paint tabu je to k ničemu (start s prázdným canvasem), ale v annotate modálu už obrázek je.

**Rozhodnutí:** Crop tool v annotate modálu.
- 8 handlů (4 rohy + 4 strany)
- Lock ratio checkbox
- Apply/Cancel tlačítka + Enter/Esc shortcuts
- DOM overlay (ne canvas drawing) — čistší, snadnější UI
- Architektura podporuje oba prefixy ('p' + 'a'), v UI je jen 'a' (annotate)

**Implementace:**
- `_pCropState` holding prefix + geometry + drag state
- Apply: `ctx.getImageData(x,y,w,h)` → resize canvas → `putImageData`
- Mask canvas se resize spolu (pokud existuje)
- History se resetuje (no undo across crop boundary)

