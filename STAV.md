# STAV.md — Generative Image Studio

## Aktuální verze: v207en (WIP — Session 2 Fáze 1-3 hotové)
## Příští verze: v208en (Session 2 Fáze 4-8: aktivace unified panelu)
## Datum: 2026-04-22
## Worker verze: 2026-16 (beze změny)

---

## 🔴 STARTING SESSION 2 — ČTI NEJDŘÍV

Pokud jsi Claude začínající novou chat session a pokračuješ Session 2:

1. **`SESSION_2_HANDOFF.md`** v GitHub repo `petrsajner/GIS-modules` obsahuje **KOMPLETNÍ BRIEFING** — rozhodnutí, specifikace, plán Fáze 4-8, gotchas, odhady, moduly k fetch. Stáhni přes `web_fetch` raw URL.
2. **Tento STAV.md** je jen shrnutí — detaily jsou v HANDOFF.
3. Stáhni moduly z GitHubu (NE `/mnt/project/` — **VŽDY stale**): `template.html`, `video-models.js`, `video-queue.js`, `video-gallery.js`, `video-topaz.js`, `video-utils.js`, `build.js`.
4. Edit v `/home/claude/src/`, build v `/home/claude/`, output v `/mnt/user-data/outputs/`.

---

## ⚠ v207en je WORK-IN-PROGRESS

v207en obsahuje **skrytou infrastrukturu** pro unified video panel (Session 2), ale **neaktivuje** ji. Produkce funguje jako v v206en — stará per-model UI je beze změny. Unified panel je `display:none`, čeká na Fázi 4-8 v další session.

**Bezpečné nasazení:** v207en lze nasadit okamžitě — nic se nerozbije. Jen o ~700 řádků HTML/JS větší soubor (skrytá infrastruktura).

---

## Co je v v207en (oproti v206en) — Session 2 Fáze 1-3

### ✅ Fáze 1: Reorder modelů

**Status: Už hotové.** Petrovo požadované pořadí (Veo → Kling → PixVerse → Seedance → Grok → Luma → Vidu → WAN → Topaz → Magnific) v `videoModelSelect` HTML options už přesně odpovídalo. Pouze ověřeno. Žádná změna.

### ✅ Fáze 2: `getVideoUi(modelKey)` helper (central UI flags)

**Modul:** video-models.js (+200 ř, za MAGNIFIC_VIDEO_MODELS).

Místo injekce `ui: {...}` do ~60 entries (duplikát, chyba-prone), **jeden central helper** derivuje UI flags z:
1. Model type (`veo`, `kling`, `luma_video`, `seedance`, `vidu`, `wan27`, `wan26`, `pixverse`, `grok`)
2. Varianta (T2V, I2V, R2V, V2V, Keyframe, Transition, Fusion)
3. Family-specific override pro edge case

**Vrací frozen objekt se všemi UI flags:** core visibility, refs, source slot, sub-select, advanced group, camera move, bottom toggles (Multiclip/Multi-shots/Off-peak/Audio).

**Princip:** Kling group "parent" entries (`kling_v3`, `seedance2` apod.) delegují na svůj default variant. To znamená `getVideoUi('seedance2')` vrátí UI pro `seedance2_t2v`.

### ✅ Fáze 3: Unified HTML panel `#vpParams`

**Modul:** template.html (+321 ř, hned za videoModelDesc, před klingVersionRow).

**Uspořádání podle Petrova pořadí:**
1. Mode sub-select
2. Prompt + styles/camera tags + **Model camera move menu** + **Negative prompt** (collapsible)
3. Reference images + dynamicky zobrazené per-ref weight slidery (Luma)
4. Source video (hned pod refs) → Source audio (Seedance 2.0)
5. Core: Resolution, Aspect, CFG, Duration, Seed
6. Individual advanced (Luma/PixVerse/Topaz/Magnific — zachováno jak jsou)
7. Count
8. Bottom toggles: Multiclip, Multi-shots, Off-peak, Audio

**Všechny IDs pattern `vpXxx`** (analogicky `upXxx` pro images). ID počet v #vpParams: ~60 unikátních.

**⚠ Panel je `display:none`.** Nikdo ho neaktivuje — čeká na `_applyVideoModel` rewrite.

### Build stats (v207en)

- **25 modulů** (beze změny)
- **23 497 JS řádků** (+401 vs. v206en — getVideoUi helper)
- **28 910 total lines** (+729 vs. v206en — unified HTML panel)
- `✓ HTML div balance: OK (866 pairs)` (+87 pairs)
- Extracted script `node --check` → OK

---

## Kde jsme přestali — Session 2 Fáze 4-8 (další session)

### Fáze 4: Refactor `_applyVideoModel(modelKey)` — flag-driven

Z 364 řádků switche → ~40 ř helperu. Čte `getVideoUi(modelKey)` a aplikuje flags přes `_setRow(id, show)` pattern.

### Fáze 5: `buildVideoParams()` + `generateVideo` refactor

Jedna fce čte všechny `vpXxx` IDs → `params` objekt (unified schema). `generateVideo` přestane mít 30× `getElementById`.

### Fáze 6: `loadVideoJobParamsToForm()` + reuseVideoJob refactor

Jedna fce píše `params.*` do `vpXxx` IDs. Opravuje bug: Seedance 2.0 reuse (aktuálně prázdné model pole). Backward compat pro stará videa.

### Fáze 7: Handler refactor

10+ video handlerů akceptuje `params` obj místo syrových IDs. Uloží konzistentní `params` shape do video_meta.

### Fáze 8: Testování + odstranění starých panelů

Smoke test per model. Odstranit z template.html: `lumaVideoParams`, `grokVideoParams`, `topazSrcRow`, `pixverseParams`, `magnificVidOpts`, `veoRefModeRow`, `lumaHdrRow`, `lumaCharRefRow`, `lumaResRow`, `veoResRow`, `wanResRow`, `topazResRow`, `topazFactorRow`, `topazFpsRow`, `topazSlowmoRow`, `topazCreativityRow`, `videoAspectRow`, `videoCfgRow`, `videoDurRow`, `videoAudioCtrl`, `videoCountRow`, `videoResInfoRow`, `videoRefSection`.

---

## Unified metadata schema (designováno, implementace Fáze 6-7)

```js
params: {
  // Core (všechny modely):
  resolution, aspectRatio, duration, cfgScale, seed, enableAudio, count, negativePrompt,
  // Mode sub-select:
  modeValue,    // pro Grok/Veo/PixVerse
  variantKey,   // pro Kling groups (pomáhá restore v reuse)
  // Source video slot:
  sourceVideoId,
  // Source audio (Seedance 2.0):
  audioUrls: [],
  // Per-family advanced (jen pokud model patří):
  topaz:    { factor, fps, slowmo, creativity } | null,
  magnific: { mode, resolution, fps_boost, sharpen, grain, prompt, creativity, flavor, strength } | null,
  pixverse: { quality, cameraMove, multiClip, offPeak } | null,
  luma:     { loop, colorMode, refWeights: [] } | null,
  wan:      { multiShots } | null,
  grok:     { mode } | null,
  veo:      { refMode } | null,
}
```

Po Fázi 6-7 bude KAŽDÉ video ukládat plný schema. Stará videa se budou reuse-ovat přes backward compat mapping.

---

## Ostatní TODO

1. **Session 2 Fáze 4-8** ← **NEXT**
2. Seedance 2.0 I2V universal prompt block (vyžaduje F12 log)
3. Style Library "My Presets"
4. Claid.ai via proxy
5. Hailuo 2.3 upgrade
6. Use V2V (Seedance R2V)
7. Runway Gen-4 (research only)

---

## Změněné moduly (v207en vs. v206en)

| Modul | Status | Popis |
|---|---|---|
| `video-models.js` | upraven | +getVideoUi() helper (+200 ř) |
| `template.html` | upraven | +#vpParams unified panel (+321 ř, hidden) |
| **Ostatní** | beze změny | |

---

## Runtime Philosophy

Beze změny od v206en.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** `gis-proxy.petr-gis.workers.dev`
- **Build modul order (v207en, 25 modulů, beze změny)**
- **Dev server**: `node build.js --dev` (port 7800)
- **Kontakt**: info.genimagestudio@gmail.com
