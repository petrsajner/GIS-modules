# Příští session — Video.js split (krok 1 ze 2)

**AKTUALIZOVÁNO po napojení GitHub integration.** `project_knowledge_search` teď čte z repa `petrsajner/GIS-modules` přímo, žádné manuální uploady nepotřeba.

## Kontext

Dokončili jsme architektonické úklidové práce po v202en (dev server, chunked archive, upload dedup). Teď jdeme na **restructuring video subsystému**, abychom mohli pak sjednotit video generation panel podobně jako jsme udělali pro image v v200en.

Plán je rozdělený na dvě samostatné sessions:
- **Session 1 (tato):** clean split `video.js` na 6 submodulů. Žádná funkční změna, jen fyzické oddělení.
- **Session 2 (příští):** unified panel pro video modely.

## Před startem nové session

1. Petr pushne cokoli nového do `github.com/petrsajner/GIS-modules` (`git push`)
2. V Claude projectu klikne **Sync now** na GitHub repo tile v Files sekci
3. Pak spustí nový chat

## Startovací zpráva (zkopíruj do nového chatu)

```
Pokračujeme s plánem z minulé session: split video.js na 6 submodulů.

GitHub integration je aktivní, repo petrsajner/GIS-modules je napojený jako
project knowledge. Všechen kontext (kód i dokumenty) si načítej přes
project_knowledge_search, ne přes uploady.

Plán splitu (potvrdíme si ho znovu než začneš):

  video-utils.js     ← generateVideoThumb, bytesToBase64, dims, fmtDims
  video-models.js    ← VIDEO_MODELS, VIDEO_HANDLERS map, per-model handler funkce
                       (Kling, PixVerse, Veo, Luma, Seedance, Grok, WAN, atd.)
  video-queue.js     ← videoQueue, runVideoJob, progress, cancel, retry
  video-gallery.js   ← grid render, karty, selection, filters, lightbox, drag
  video-topaz.js     ← Topaz Astra/Precise upscale (T2V + I2V flow)
  video-archive.js   ← exportVideoArchive, importVideoArchive, regenerateMissingVideoThumbs

Build order v MODULES v build.js:
  ...existing... → video-utils → video-models → video-queue → video-gallery →
  video-topaz → video-archive

Stará reference "video.js" se z MODULES odstraní.

Postup:
  1. project_knowledge_search — najdi si všechny funkce/state/handlery ve video.js
  2. Sestav table mapping "funkce → cílový modul" a ukaž mi k odsouhlasení
     PŘED tím než začneš splitovat
  3. Proveď split (mechanický, žádná funkční změna)
  4. Update build.js (MODULES array + dev mode výpis script tagů)
  5. Prod build test — musí dát ~27 200 ± 50 řádků
  6. Syntax check
  7. Update STAV.md + DECISIONS.md + README

Finální balíček: všech 6 nových modulů + build.js + STAV.md + DECISIONS.md + README.
Já to pushnu do repa a kliknu Sync.
```

## Přístup k aktuálnímu kódu přes project_knowledge_search

**Místo fetchování z GitHub blob URL** nebo čekání na upload — teď `project_knowledge_search` vrací přímo obsah z repa.

Dotazy které budu volat:

```
project_knowledge_search('video.js')
  → vrátí relevantní snippets ze všech kontextů kde video.js figuruje

project_knowledge_search('VIDEO_MODELS')
  → kde jsou definovány všechny video modely

project_knowledge_search('generateVideoThumb')
  → kde je funkce definována + kde se volá

project_knowledge_search('VIDEO_HANDLERS mapa')
project_knowledge_search('videoQueue state')
project_knowledge_search('renderVideoGallery')
project_knowledge_search('Topaz upscale')
project_knowledge_search('exportVideoArchive')
```

Pomocí 8–10 takových dotazů dokážu zmapovat celou strukturu `video.js` bez nutnosti mít na stole celý 6000řádkový soubor.

**Omezení:** `project_knowledge_search` vrací **relevant chunks**, ne kompletní file. Pokud bych potřeboval úplný seznam všech funkcí v pořadí (pro line-range mapping), buď požádám Petra o upload čistého `video.js`, nebo si ho poskládám z více searches + očíslím.

## Vytvoření split plánu PŘED provedením

Tohle je kritická část.

Výstup: **tabulka mapping** ve tvaru:
```
video.js řádek → cílový modul → funkce/proměnná
120-145    video-utils.js    generateVideoThumb
150-200    video-utils.js    bytesToBase64
205-850    video-models.js   VIDEO_MODELS + VIDEO_HANDLERS
...
```

**Poslat Petrovi k odsouhlasení PŘED provedením.** Může mít připomínky (např. "Topaz spíš do video-models, ne zvlášť") a je lepší to vyřešit teď než později.

## Křížové závislosti — na co si dát pozor

Video modul dnes volá sám sebe hodně napříč. Předvídat kde budou cross-module calls:

- `video-queue.js` volá handlery z `video-models.js` (přes `VIDEO_HANDLERS` mapu)
- `video-gallery.js` volá `videoDeleteById` — který je v `video-gallery.js` samotném
- `video-topaz.js` volá `_saveVideoResult` — který je pravděpodobně v `video-queue.js`
- `video-archive.js` volá `renderVideoGallery`, `generateVideoThumb` — cross-module
- Lightbox modal kódy (`openVideoLightboxById`, atd.) mají hodně cross-callů

Všechny zůstanou globální (window-scope), takže žádné `import`/`export` nepotřeba. Jen pozor na **build order** — `video-queue.js` musí být v MODULES PO `video-models.js`.

## Po splitu — ověření

Prod build `node build.js 203en` musí produkovat HTML velikosti ~27 200 řádků ± 50 (díky hlavičkovým komentářům nových souborů).

Syntax check:
```bash
awk '/<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' dist/gis_v203en.html > /tmp/check.mjs
node --input-type=module < /tmp/check.mjs 2>&1 | head -3
```
Očekávaný output: `ReferenceError: window is not defined`.

Pro reálný test Petr musí restartovat dev server (zavřít tab, otevřít znovu localhost:7800) a ověřit:
- Video generation funguje (spustit Kling test job)
- Queue progress funguje
- Video library zobrazuje karty
- Topaz dialog jde otevřít
- Archive export + import funguje (malé — několik videí)

## Dokumentace po dokončení

Update:
- **STAV.md:** přidat sekci "Video.js split (Session 1 ze 2 pro video panel unification)"
- **DECISIONS.md:** záznam "Video subsystem restructure" s tabulkou mapování modul → obsah
- **README.md:** instrukce pro nasazení + test checklist

## Čeho se DRŽET a čeho NE

### Držet:
- Čistý refactor — žádná funkční změna
- Stejný globální scope (žádná ES6 modularizace)
- Kompletní testing před ukončením session
- Commit na GitHub všech souborů najednou s jasnou commit message

### Nedělat:
- ES6 `import`/`export` migrace (samostatný krok jindy, nebo rovnou Tauri)
- Změny v logice (fixy bugů, refaktor algoritmů) — to je Session 2 nebo separate
- Přejmenování funkcí (ledaže by bylo nezbytné kvůli kolizi — pak warning)
- Rozšiřování scope na gallery.js, paint.js ani jiné velké moduly

## Co se pak stane v Session 2 (pro kontext)

Po splitu:
- Audit všech video modelů → katalog společných parametrů (prompt, duration, aspect ratio, audio, camera movement, seed, negPrompt)
- Návrh unified template s UI flags (analogicky `isUnifiedModel()` z image v v200en)
- Implementace do nového `video-ui.js` nebo rozšíření `video-models.js`
- Element IDs: `vpParams` namespace podobně jako `upParams` pro image
- Testing per-model

Ale to je příští sessiony. Teď jen split.

## Timeline odhad

- Split plan + table: ~10 min (project_knowledge_search urychluje)
- Mechanický split: ~30 min
- Build test + fixes: ~15 min
- Dokumentace: ~10 min
- **Total: ~1 hod**, reálně 1.5 hodiny s diskuzí

Pokud by to začalo přetékat, rozdělit na 2 sessions (split provedení + dokumentace).

## Důležité o GitHub integration

**Každá nová session začíná:**
1. Petr potvrdí že pushnul všechny změny z předchozí session (`git push`)
2. V Claude projectu klikne **Sync now** na repo tile v Files sekci
3. Potom dám `project_knowledge_search` a vidím aktuální stav

**Pokud by Sync selhal nebo vypadalo že vidím stale data:** `project_knowledge_search('STAV.md Session')` — měl bych vidět nejnovější sekci. Pokud ne, Petr musí znovu kliknout Sync nebo manuálně nahrát soubor.
