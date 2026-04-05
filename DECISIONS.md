# GIS — DESIGN DECISIONS
*Proč bylo co jak navrženo. Přidávat po každém rozhodnutí které nebylo triviální.*
*Formát: Kontext → Rozhodnutí → Důvod → Alternativy které neprošly*

---

## Architektura — základní rozhodnutí

### Single-file HTML app
**Rozhodnutí:** Distribuce jako jeden `.html` soubor. Od v90: build z 19 modulů → single file.
**Důvod:** Nulová instalace. Funguje z `file://` v Chrome. Jednoduché sdílení a verzování.

### IndexedDB pro galerii a assets
**Rozhodnutí:** Veškerá data v IndexedDB (ne localStorage, ne server).
**Důvod:** localStorage limit ~5MB. IndexedDB pojme stovky MB obrázků a videa.

### Proxy jen pro CORS-blokované endpointy
**Rozhodnutí:** Worker proxy jen pro: xAI, Luma, Magnific, fal.ai queue, Topaz, Replicate.
**Důvod:** CF Worker free tier 100K req/den. Zbytečné proxování plýtvá limitem.
**Pravidlo:** Vždy ověřit CORS kompatibilitu před implementací — drahá chyba.

### CF Worker free tier — polling NIKDY uvnitř Workeru
**Rozhodnutí:** Worker = submit → okamžitá odpověď s job ID. Polling loop vždy v GIS (browser).
**Důvod:** CF Worker free tier má ~30s wall-clock limit. Async generace trvá minuty.
**Pravidlo:** Worker vždy odpoví do 5s. Nikdy nečeká na výsledek.

---

## v102en — Refs architektura refactor

### refs[] jako asset linky (ne inline data)
**Kontext:** Refs ukládaly imageData přímo. Galerie záznamy měly MB navíc za každý ref.
**Rozhodnutí:** `refs[]` = `{assetId, thumb, dims}`. `getRefDataForApi()` načítá data on-demand z DB.
**Důvod:** Galerie záznamy ~50 bytů místo MB. Eliminace duplicit.

### usedVideoRefs — ukládá imageData (v132)
**Kontext:** Video ref systém v102+ ukládal jen assetId. Smazáním assetu se ref ztratil.
**Rozhodnutí:** `videoRefsAtSubmit` je async a ukládá `imageData` přímo do snapshotu.
**Důvod:** Video je archivní médium — jeho setup musí být self-contained.

---

## v107–v115en — Video model systém

### KLING_GROUPS — generický group systém pro varianty
**Kontext:** Kling má 7+ variant. Všechny v hlavním selectu = chaos.
**Rozhodnutí:** Group key → sub-select s variantami. `getActiveVideoModelKey()` vrátí konkrétní klíč.

### audioField / durationInt / multiShots flags
**Problém:** Různé modely používají různé pole (`generate_audio` vs `audio`; string vs int duration).
**Rozhodnutí:** Model flags v VIDEO_MODELS definici. Payload builder čte flag.
**Příklady:**
```javascript
duration: "5"         // Kling — STRING
duration: 5           // ostatní — INTEGER
start_image_url: url  // Kling — ne image_url
generate_audio: !!f   // VŽDY explicitně — omission = audio ON
```

---

## v174en — fal.ai queue + error cards

### fal.ai image → queue.fal.run (v174)
**Problém:** `fal.run` (sync) vrací 503 "Deadline expired" při přetížení.
**Rozhodnutí:** Všechny fal.ai image modely přešly na `queue.fal.run` async pattern přes `_falQueue()` helper.
**Důvod:** Queue endpoint odolný vůči timeoutům. Retry zdarma.

### Error karty místo odstraněných placeholderů (v174)
**Rozhodnutí:** Při chybě se placeholder transformuje na statickou error kartu s `↺ Reuse` tlačítkem.
**Důvod:** Uživatel neztratí parametry. Může opravit prompt a zkusit znovu jedním klikem.

### Ref komprese na JPEG před odesláním (v174)
**Rozhodnutí:** `_compressRefToJpeg()` — canvas re-encode všech refů na JPEG 100% před API call.
**Důvod:** PNG z NB2 (5K+) překračuje Kling API limit 10MB. JPEG drasticky zmenší velikost.
**Kling specificky:** cap na UHD (3840px) + JPEG.

---

## v175en — Branding, UX polish, Describe restore (4. 4. 2026)

### Generative Image Studio — nový název (v175)
Přejmenování z "Google Image Studio". Zkratka GIS zachována. Integrity checks přidány do 5 modulů pro deterenci triviálního odstranění copyrightu.

### Copyright karta v Setup — plovoucí layout (v175)
Setup je flex row. Karta floatuje uprostřed pravé černé části — vždy viditelná bez scrollování, responzivní.

### Folder/favorite — meta-only operace (v175)
`dbPatchMeta` a `dbPatchVideoMeta` — folder a favorite nikdy nenačítají imageData/videoData. Výkon: 10–15s → < 0.5s pro smazání složky. Bezpečné: `images` store se pro metadata operace nedotýká.

### Folder delete bez confirm (v175)
Uživatel záměrně kliká na × vedle názvu složky. Data se nemažou — jen přesun do All. Confirm je zbytečný friction. Vizuální feedback (červení) dostatečný.

### dbPatchMeta — proč ne dbPut('images') (v175)
`images` store = meta + imageData (2–5MB). Pro změnu `folder` nebo `favorite` není důvod načítat binární data. `images_meta` store má stejná metadata bez imageData (~300B). Architektura v102+ toto umožňuje.

### AI Prompt per-tab output (v175)
Původní sdílený `aiBufferOutput` byl matoucí — jeden textarea pro všechny taby. Nová architektura: každý tab má vlastní zelený input + červený output. Přepnutí tabu vymaže output → uživatel vždy vidí výsledek aktuálního tabu.

### Chat — context bublina vs systémový kontext (v175)
Varianta 2 (viditelná bublina) zvolena nad variantou 1 (skrytý systémový kontext) — transparentnost > estetika. Uživatel musí vědět s čím chat pracuje.

### Describe modal — AbortController (v175)
Tab přepnutí bez abort způsoboval race condition: starší generování (Description) dokončilo po novějším (AI Prompt) a přepsalo výsledek. AbortController garantuje že se zobrazí vždy výsledek aktuálně aktivního tabu.

### Describe funkce — umístění v refs.js (v175)
Funkce patří do refs.js (za PROMPT PREPROCESSING sekci). Video.js volá _runDescribe a setDescribeTab jako sdílené funkce — nevlastní je. Pokud se refs.js kopíruje ze stale projektu, funkce zmizí. Version check v SKILL.md to zachytí.

---

## v177–v179en — Unified selection + drag-to-folder (5. 4. 2026)

### Rubber band selekce — shared helper (v177)
**Kontext:** Gallery, assets i video potřebovaly rubber band. Tři separátní implementace = chaos.
**Rozhodnutí:** Sdílený `_startRubberBand(e, rbId, mode, onRect)` v gallery.js. Shift+drag = výběr, Alt+drag = deselect.
**Alternativa:** Každý pohled vlastní implementace — zamítnuto (duplicita kódu, rozbitelnost).

### Drag-to-folder místo Move dialogu (v177)
**Kontext:** Move dialog (`prompt()`) byl primitivní a native dialogy jsou stylisticky nekonzistentní.
**Rozhodnutí:** HTML5 drag na kartě + drop zóna na folder divech. Native feel, bez extra kliku.
**Zachováno:** Move overlay dialog pro video (komplexnější UX, víc složek).

### dbPatchAssetMeta — meta-only pro assets (v177)
Stejný pattern jako dbPatchMeta pro galerii. Assets mají vlastní `assets_meta` store oddělený od binárních dat.

### Video in-folder pruh — fialová (v177)
Červená barva pruhu splývala s error stavy. Fialová `#9b59b6` je vizuálně neutrální a konzistentní s Precision color scheme.

---

## v180en — Camera active, Favorites live, Branding (5. 4. 2026)

### Favorites live update — renderFolders po toggle (v180)
**Kontext:** Unlike ve Favorites složce nezpůsoboval okamžité zmizení karty — refresh byl nutný.
**Rozhodnutí:** `toggleFavorite` / `videoToggleLike` / `toggleAssetFavorite` volají renderFolders() po změně.
**Alternativa:** Full re-render celé gallery — zamítnuto (výkon). DOM removal bez re-renderu byl složitý.
**Pattern:** Toggle → DB patch → renderFolders → pokud aktivní složka = Favorites a unlike, karta zmizí.

### build.js výstup — gis_vXXen.html (v180)
**Kontext:** Původní jméno `google-image-studio_vXXen.html` bylo zbytečně dlouhé a obsahovalo "google".
**Rozhodnutí:** Přejmenovat na `gis_vXXen.html` — zkráceno, consistent se zkratkou projektu.

### Copyright 2026 (v180)
Tři výskyty `© 2025` → `© 2026` + `GIS_COPYRIGHT` konstanta. Žádný funkční dopad.

---

## v181en — Magnific Precision + Select fix (5. 4. 2026)

### Magnific Precision — dvě oddělená API (V1 + V2)
**Kontext:** Freepik/Magnific má tři různé upscale endpointy: Creative, Precision V1, Precision V2.
**Rozhodnutí:** Jeden GIS toggle "Creative / Precision". Precision panel pokrývá V1 i V2 — výběr přes "Version" radio.
**V1 vs V2:** V2 přidává `flavor` (sublime/photo/photo_denoiser) a `scale_factor`. V1 = "high HDR" algoritmus bez flavoru.
**Alternativa:** Tři separátní radio pro všechny tři endpointy — zamítnuto (UI příliš složité).

### Magnific status — sdílený endpoint s upscaler_type routing (v181)
**Kontext:** Tři endpointy mají tři různé poll URLs. Tři separátní status routy by zduplikovaly kód.
**Rozhodnutí:** Jeden `/magnific/status` přijme `upscaler_type` v těle a interně routuje na správnou URL.
**Backward compatibility:** `upscaler_type` je optional — bez něj (nebo `'creative'`) → původní chování.

### Optimized for — select → radio buttons (v181)
**Problém:** `<select>` v dark mode UI — text optionů světlý na světlém systémovém pozadí. Zcela nečitelné.
**Rozhodnutí:** Nahradit custom radio label buttons (stejný vzor jako Engine / Scale Factor).
**Proč ne CSS fix:** `<option>` elementy v nativním dropdown jsou renderované OS, CSS color je ignorováno ve většině prohlížečů.
