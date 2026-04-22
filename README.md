# v203en — video.js split — deployment balíček

**Datum:** 21. 4. 2026
**Session:** Split session (Session 1 ze 2 pro video panel unification)
**Funkční změny:** ŽÁDNÉ. Pouze fyzické rozdělení `video.js` (5907 ř) na 6 submodulů.

---

## Obsah balíčku

```
src/
  video-utils.js     180 source lines — pure helpers
  video-models.js   2419 source lines — model defs + handlery + model UI switching
  video-queue.js     804 source lines — job state + runners + cards + queue UI
  video-gallery.js  1544 source lines — UI: gallery, refs, mention, lightbox, source slots
  video-topaz.js     405 source lines — Topaz + Magnific upscale
  video-archive.js   555 source lines — archive export/import + thumb regen

build.js  — aktualizovaný MODULES array (19 → 24 modulů)

docs/
  STAV.md                — sekce pro v203en (přepiš vrchol existujícího souboru)
  DECISIONS.md           — sekce pro video split (prepend na vrchol)
  CLEANUP_ANALYSIS.md    — BONUS: detailní analýza cleanup/optimalizací (NE k okamžité implementaci)
```

---

## Deployment postup

### 1. Commit do GitHub repa

```bash
cd path/to/GIS-modules
# Remove old monolith
git rm src/video.js

# Add new modules
cp <balíček>/src/video-*.js src/

# Replace build.js
cp <balíček>/build.js .

# Commit
git add -A
git commit -m "v203en: split video.js into 6 submodules (utils/models/queue/gallery/topaz/archive)"
git push
```

### 2. Test build lokálně

```bash
# Prod build
node build.js 203en
```

**Očekávaný výstup:**
- `dist/gis_v203en.html` vznikne
- 24 modulů v logu (místo 19)
- Celkem ~27 226 řádků (baseline 27 200 + 26 z hlaviček) — v toleranci ±50
- Syntax check: `awk '/<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' dist/gis_v203en.html > /tmp/check.mjs && node --input-type=module < /tmp/check.mjs 2>&1 | head -3` → očekávaný `ReferenceError: window is not defined` = OK

### 3. Test dev server

```bash
node build.js --dev
# nebo na Windows dvojklik na start_dev.bat
```

Chrome se otevře na `http://localhost:7800/`. **Sources panel** v DevTools → zkontroluj že vidíš 24 samostatných modulů (mělo by tam být `video-utils.js`, `video-models.js`, atd.)

### 4. Interaktivní smoke test

**Minimum před akceptací:**
- [ ] Video generation — Kling Standard T2V, 5s, audio ON → job přes queue, video v gallery
- [ ] Queue overlay — badge se aktualizuje, cancel ✕ funguje na running job
- [ ] Video gallery — karty renderují, thumbnails viditelné
- [ ] Topaz dialog — ✦ Topaz na gallery kartě → source set, panel přepne
- [ ] Source slots — ▷ Use na video kartě při aktivním V2V/WAN27e modelu → slot se naplní
- [ ] Archive export + import — 2-3 videa, reálně uložit a naimportovat zpět

**Pokud problém:** revertuj commit, otevři novou session s konkrétní chybou.

### 5. Aktualizovat dokumentaci

```bash
# STAV.md — přepiš vrchol svou novou sekcí z docs/STAV.md
# DECISIONS.md — prepend novou sekci z docs/DECISIONS.md na vrchol
# CLEANUP_ANALYSIS.md — nový soubor, nahrát do repa
```

---

## Verifikace splitu (co jsem udělal)

- ✅ **Line coverage:** 5907/5907 řádků přiřazeno právě jednomu modulu, žádné duplicity, žádné mezery
- ✅ **Per-module content check:** každý modul obsahuje přesně ty řádky originálu, které mu byly přiřazeny (multiset compare)
- ✅ **Syntax:** `node --check` všech 6 modulů individuálně PASS
- ✅ **Concatenated syntax:** spojeno v build order, `node --check` PASS
- ✅ **Mock prod build:** 18 placeholder modulů + 6 reálných video-*.js → HTML vyprodukován, HTML div balance OK

**Co zbývá otestovat na tvojí straně:** kompletní interaktivní flow v browseru (běžný dev cyklus).

---

## Build order rationale

```
video-utils    ← žádné závislosti na ostatních video modulech (pure helpers)
video-models   ← používá utils (už načteno)
video-queue    ← dispatch do models (už načteno), sdílí utils
video-gallery  ← používá queue/models/utils, definuje vlastní state
video-topaz    ← volá _saveVideoResult z queue, refreshVideoGalleryUI z gallery
video-archive  ← volá render funkce z gallery, thumb z utils
```

Pokud v budoucnu vznikne cross-dependency opačným směrem (e.g. `video-utils` by potřebovala něco z `video-gallery`), je to signál, že něco je ve špatném modulu. V takovém případě: revize split mapping + přestěhovat funkci.

---

## Co dál

1. **Commit + test** (viz výše)
2. Pokud všechno OK → otevřít **cleanup session** (`CLEANUP_ANALYSIS.md` obsahuje seřazený plán, 1–2 hod)
3. Potom **Session 2** — unified video panel (analogicky image v200en)

---

## Poznámky k `CLEANUP_ANALYSIS.md`

Dokument obsahuje **11 oblastí** identifikovaných během split session, seřazených podle přínos/riziko:

| Oblast | Přínos | Risk | Kdy |
|---|---|---|---|
| 1. Source slot registry | Vysoký | Nízké | Cleanup session |
| 2. spendKey do VIDEO_MODELS | Střední | Nízké | Cleanup session |
| 3. Polling loop extrakce | Vysoký | Střední | Cleanup session |
| 4. Mention state encapsulation | Malý | Nízké | Cleanup session |
| 5. `_applyVideoModel` decomp | **Vysoký** | **Vysoké** | **Session 2** |
| 6. `generateVideo` decomp | **Vysoký** | **Vysoké** | **Session 2** |
| 7. Dead comment removal | Kosmetika | Žádné | Cleanup session |
| 8. TIMEOUT/POLL_MS konstanty | Střední | Nízké | Cleanup session |
| 9. Topaz+Magnific merge | Malý | Střední | Cleanup session |
| 10. Prompt rewriting refactor | Střední | Střední | **Session 2** |
| 11. Error handling konzistence | Malý | Nízké | Cleanup session |

**Cleanup session-only (items #1, #2, #4, #7, #8, #9, #11) — odhad 1–2 hod, ~530 ř úspory.**
**Session 2 s items #5, #6, #10 navíc — 4–6 hodin, ~1100 ř úspory (~40% video code reduction).**

Detailní kód-návrhy pro každou oblast + smoke test checklist v samotném dokumentu.
