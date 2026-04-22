# STAV.md — Generative Image Studio

## Aktuální verze: v206en
## Příští verze: v207en
## Datum: 2026-04-22
## Worker verze: 2026-16 (beze změny)

---

## Co je v v206en (oproti v205en)

### Video subsystem cleanup (8 items z CLEANUP_ANALYSIS.md)

Čistě interní refactoring — žádná funkční změna, žádný nový model, žádný API payload dotčený. Cíl: sjednotit chaos který vznikl postupným přidáváním modelů (11 video providerů + Topaz + Magnific), zredukovat duplicitu, vytvořit single-source-of-truth pro rekurentní koncepty (spend key, timeouty, source sloty, polling).

| # | Oblast | Impl | Modul(y) |
|---|---|---|---|
| 7 | Dead comment "rubber-band" | -1 ř | video-gallery |
| 4 | `videoMention*` globály → `videoMention` objekt (19 call-sites) | +1 ř | video-gallery |
| 11 | Error handling guideline + generalized timeout regex | +10 ř | video-utils, video-queue |
| 8 | Centrální `VIDEO_POLL` konstanty (10 timeout keys, 2 poll interval) | +25 ř | video-utils (všechny handlery) |
| 2 | `spendKey`/`spendKeyAudio` do 28 VIDEO_MODELS entries, funkce 28→7 ř | +15 ř | video-models |
| 1 | `VIDEO_SOURCE_SLOTS` registry (7 slotů) + generic API | +60 ř | video-gallery, video-topaz |
| 9 | `_loadAndEncodeSourceVideo` + `_downloadUpscaledVideo` helpery | +15 ř | video-topaz |
| 3 | `_videoPollLoop` — refactor Luma, Grok, PixVerse | +24 ř | video-queue, video-models |

**Předpokládané úspory dle CLEANUP_ANALYSIS byly ~530 ř, realita +150 ř.** Rozdíl není chyba analýzy — je to záměrné rozhodnutí zachovat existující wrappery jako 1-line forwardy místo přepisování všech 50 call-sites v template.html a video-*.js. Wrapper-preserving variant: nízké riziko, žádný HTML audit potřeba, architektonické wins stejné.

### Architektonické wins

1. **Adding new video model = 1 místo pro spend key**: přidat `spendKey: '_xyz'` (a volitelně `spendKeyAudio: '_xyz_audio'`) do entry. Žádný switch na úpravu.
2. **Central timeout tuning**: měnit poll interval nebo provider timeout = jedno místo (`VIDEO_POLL` v video-utils.js).
3. **Adding new source slot = 1 entry do registru**: `VIDEO_SOURCE_SLOTS.xyz = { ids, set, pickToast, setHook? }`.
4. **New provider s pollingem** = jen adapter s `poll()` callbackem, `_videoPollLoop` se postará o timeout + elapsed time + queued/running handling.
5. **Konzistentní error UX**: všechny handlery throw raw technical error, `videoJobError` je jediný entry-point pro friendly-ifikaci.
6. **Konzistentní upscale download**: Topaz i Magnific používají `_downloadUpscaledVideo` s chunked progress + error handling.

### Poznámky k implementaci

- `_getVideoSpendKey` teď čte `spendKey`/`spendKeyAudio` z VIDEO_MODELS entry. WAN 2.6 má funkční spendKey (resolution-dependent `'_wan26_1080p' | '_wan26_720p'`).
- Veo NENÍ v `_videoPollLoop` — používá rekurzivní `setTimeout` pattern s `operations/xyz` endpointem, refactor by byl throw-away před Session 2.
- `friendlyVideoError`: timeout regex generalizován z `25 min|30 min|10 min` na `\d+\s*(min|hour)` — pokrývá všechny varianty včetně PixVerse off-peak 2 hours.
- Build order beze změny — 25 modulů, stejné pořadí jako v205en.

### Build stats

- **25 modulů** (gpt-edit.js + 6 video-*.js + 18 core)
- **23 096 JS řádků** (v205en: 22 946 — Δ +150)
- **28 181 total lines** (HTML + JS + CSS)
- `✓ HTML div balance: OK (779 pairs)`
- Extracted script `node --check` → OK

---

## Kde jsme přestali

v206en je hotová cleanup session — všechny kandidáti z `CLEANUP_ANALYSIS.md` (items #1, #2, #3, #4, #7, #8, #9, #11) implementovány. Items #5, #6, #10 zůstávají pro **Session 2 (unified video panel)**, která je teď další v pořadí.

**Kritický bug TODO z v205en memory** (Seedance 2.0 I2V universal prompt block) zatím neadresován — vyžaduje F12 log + Network response od Petra, čeká na real session data.

---

## TODO (prioritní pořadí)

1. **Session 2 — Unified video panel** (analogicky v200en pro images). Scope: `_applyVideoModel` decomposition (#5), `generateVideo` decomposition (#6), prompt rewriting refactor (#10), template.html per-model panely → jeden unified panel.
2. **Seedance 2.0 I2V universal prompt block** — F12 log + Network response od Petra.
3. Style Library "My Presets".
4. Claid.ai via proxy.
5. Hailuo 2.3 upgrade.
6. Use V2V (Seedance R2V).
7. Runway Gen-4 (research only).
8. Recraft V4 / Z-Image LoRA / Ideogram V3.

---

## Změněné moduly (v206en)

| Modul | Status | Popis |
|---|---|---|
| `video-utils.js` | upraven | +VIDEO_POLL konstanty, friendlyVideoError guideline |
| `video-models.js` | upraven | +spendKey/spendKeyAudio do 28 entries, _getVideoSpendKey simplified, Luma/Grok/PixVerse přes _videoPollLoop |
| `video-queue.js` | upraven | +_videoPollLoop, VIDEO_POLL defaults, videoJobError komentář |
| `video-gallery.js` | upraven | +VIDEO_SOURCE_SLOTS registry + generic API, 6 slotů přes registry, videoMention encapsulated, dead comment removed |
| `video-topaz.js` | upraven | +Topaz registry entry s setHook, +shared upscale helpers |
| `build.js` | beze změny | (předchozí update v v205en — gpt-edit.js) |

**Ostatní moduly beze změny.**

---

## Pravidla a principy

- **⚠ CRITICAL — `/mnt/project/` je VŽDY stale. NIKDY ho nepoužívat.** Session start: (1) `STAV.md` z GitHubu, (2) fetch klíčové moduly, (3) editovat v `/home/claude/src/`, (4) `node build.js NNNen → dist/`.
- **Syntax check po buildu**: extract script z builtu → `node --check /tmp/check.mjs`. OK = žádný výstup. `node --input-type=module < /tmp/check.mjs 2>&1 | head -3` vypíše `ReferenceError: window is not defined`.
- **HTML validation** — build.js zobrazuje `✓ HTML div balance: OK (N pairs)`.
- **NIKDY neodstraňovat modely, endpointy ani funkce bez explicitního souhlasu uživatele.**
- **Video cleanup (v206en)** — wrappers preserved pattern: pokud refactor vyžaduje přepsání desítek call-sites v HTML+JS, udělej wrappers `function oldName() { newApi('key'); }` místo rename. Risk << savings.
- **VIDEO_MODELS entries** = single source of truth pro spend keys (`spendKey`, `spendKeyAudio`). WAN 2.6 má funkční spendKey (resolution-dependent).
- **VIDEO_POLL** v video-utils.js = central tuning pro všechny video timeouty + poll intervaly. Měnit tady, aplikuje se automaticky.
- **VIDEO_SOURCE_SLOTS** registry v video-gallery.js = single registry pro všechny source-video UI panely. Topaz entry v video-topaz.js (push pattern, protože setHook vyžaduje Topaz-specific FPS detection).
- **_videoPollLoop** v video-queue.js — generic polling adapter pro Luma/Grok/PixVerse. Veo + fal modely mají vlastní shape, nepoužívají ho.
- **Handler error guideline**: handlery throw RAW technické errory; `videoJobError` je single entry-point pro friendly-ifikaci přes `friendlyVideoError`. Viz guideline komentář nad funkcí.
- **Decisions belong to Petr** — u složitějších refactorů prezentovat options předem.
- **NE `/mnt/project/` stale** — nestěžovat si Petrovi, je to infrastructure problém. Řešení = upload do chatu/project files.

---

## Runtime Philosophy

Beze změny od v205en. Single-file HTML na file:// v Chrome, NO CDN pro libraries, local-first IndexedDB, Tauri migrace později.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu (synced to Claude project knowledge)
- **Proxy:** `gis-proxy.petr-gis.workers.dev`; R2 bucket `gis-magnific-videos`
- **AI provideři:** fal.ai, Segmind, Google, Replicate, Luma, Kling, PixVerse, Topaz, Magnific/Freepik, xAI, OpenRouter, OpenAI (přes fal)
- **Build modul order (v206en, 25 modulů)**: models → styles → setup → spending → model-select → assets → refs → generate → fal → gpt-edit → output-placeholder → proxy → gemini → output-render → db → gallery → toast → paint → ai-prompt → video-utils → video-models → video-queue → video-gallery → video-topaz → video-archive
- **Dev server**: `node build.js --dev` (port 7800)
- **Proxy deploy** (Windows): `cd C:\Users\Petr\Documents\gis-proxy` → `npm run deploy`
- **Kontakt**: info.genimagestudio@gmail.com
