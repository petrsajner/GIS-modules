# STAV.md — Generative Image Studio

## Aktuální verze: v208en (WIP — Session 2 Fáze 4-7 hotové, Fáze 8 cleanup pending)
## Příští verze: v209en (cleanup + smoke test result fixes)
## Datum: 2026-04-22
## Worker verze: 2026-16 (beze změny)

---

## ⚠ v208en STATUS

v208en obsahuje **aktivovaný unified video panel**. Stará per-model UI je skrytá přes `_hideLegacyVideoPanels()`. Generate + Reuse teď jedou přes unified params schema. **Generate videa by mělo fungovat** (Fáze 4+5+6+7 kompletní), ale **není smoke-tested** — teprve Fáze 8 ověří každou model-family.

Bezpečné nasazení: ⚠ TESTOVAT PŘED PRODUKČNÍM NASAZENÍM. Velké struktury změn (bridge layer + runtime DOM redirect) — potřeba smoke test per model family.

---

## Co je v v208en (oproti v207en)

### ✅ Fáze 4: `_applyVideoModel` refactor (flag-driven)

**Modul:** video-models.js (+544 ř., na konci souboru).

- Nový **flag-driven** `_applyVideoModel(key)` čte `getVideoUi(key)` a aplikuje flags přes `_setRow` pattern — z 374 ř. switche na ~100 ř. deklarativního kódu.
- **Stará `_applyVideoModel` (ř. 1293-1666) zůstává jako dead code** — přepsána druhou deklarací (JS vítězí poslední). Odstraní se v Fázi 8.
- **Helpers** (8): `_hideLegacyVideoPanels`, `_vpApplyModeSelect`, `_populateVpCameraMove`, `_updateVpRefsLabel`, `_vpRenderRefWeights`, `_populateVpResolution`, `_populateVpAspect`, `_configureVpDuration`, `_vpResLabel`.
- **Onclick handlery** (7): `onVpModeChange`, `vpToggleNegPrompt`, `vpAiPrompt`, `vpRefsFileSelected`, `vpPickSourceVideo`, `vpDescribeSourceVideo`, `vpClearSourceVideo` — delegují na existující legacy fce podle `ui.sourceSlot`.
- **Výstup `updateVpResInfo()`** — pixel rozlišení derived z `vpResolution` + `vpAspect`.

### ✅ Fáze 5: `buildVideoParams()` + `generateVideo` refactor

**Modul:** video-queue.js (+464 ř., na konci souboru).

- **`buildVideoParams()`** — čte VŠECHNA `vpXxx` IDs → unified `params` schema (viz SESSION_2_HANDOFF § 3).
- **11 reader helperů**: `_readVpResolution`, `_readVpDuration`, `_readVpSeed`, `_readVpMode`, `_readVpSourceVideoId`, `_readVpAudioUrls`, `_readVpTopazParams`, `_readVpMagnificParams`, `_readVpPixverseParams`, `_readVpLumaParams`.
- **`_buildLegacySnaps(modelKey, model, params)`** — bridge layer vytvoří legacy-shape objekty (`wan27vSnap`, `wan27eSnap`, `sd2Snap`, `grokVideoSnap`, `veoResolution` atd.) z `params`. **Handlery zůstávají beze změny ve Fázi 5+6** — čtou je z job.*.
- **Nový `generateVideo()`** — čte z vpXxx, validuje, sestavuje jobs obsahující JAK legacy bridge fields (kompat s handlery), TAK nové `job.params` (Fáze 7+ bude preferred).
- **🔑 BONUS:** Runtime `Object.defineProperty` redirect `#videoPrompt.value ↔ #vpPrompt.value` (v `_ensureVideoPromptRedirect`, volán v `_applyVideoModel`). Zachovává VŠECHNY callsites (AI prompt, style/camera tags, `rewriteVideoPromptForModel`) bez refactoringu.
- **`_syncVpToLegacyTopaz()`** + **`_syncVpToLegacyMagnific()`** — volané před `_generateTopazJob`/`_generateMagnificVideoJob` (handlery čtou přímo z legacy DOM IDs v `magnificVidOpts`/`topazSrcRow` panelech, které jsou hidden; sync zajistí že obsahují aktuální user-set values z `vpTopaz*`/`vpMagnific*`).

### ✅ Fáze 6: `loadVideoJobParamsToForm()` + `reuseVideoJob` refactor

**Modul:** video-gallery.js (+195 ř., na konci souboru + přepsaná `reuseVideoJob`).

- **`_isOldVideoParamsShape(params)`** — detekuje pre-v208en meta shape (chybí `variantKey`).
- **`_migrateOldVideoParams(meta, modelKey)`** — best-effort mapping starých meta polí → nový schema (fallback na model defaults).
- **`loadVideoJobParamsToForm(params, modelKey)`** — jedna funkce píše **všechny** `vpXxx` IDs z params (inverzní k buildVideoParams). Včetně duration sync přes slider/select/radio, negative prompt collapsible state, per-family advanced (Topaz, Magnific, Pixverse, Luma), source audio URLs, Kling sub-variant selection.
- **Helpers** (6): `_vpSetValue`, `_vpSetChecked`, `_applyVpTopazParams`, `_applyVpMagnificParams`, `_applyVpPixverseParams`, `_applyVpLumaParams`, `_applyVpLumaRefWeights` (deferred — spustí se po render refs).
- **Přepsaná `reuseVideoJob(id)`** — detekuje shape, migruje pokud staré, nastaví model (Kling groups handled), zavolá `loadVideoJobParamsToForm`. **Oprava Seedance 2.0 reuse bug jako systémový side effect.**

### ✅ Fáze 7 CORE PATCH: `_saveVideoResult` params merge

**Modul:** video-queue.js (surgical 5-řádkový patch v `_saveVideoResult`).

```js
const params = {
  ...(job.params || {}),      // unified schema z buildVideoParams
  ...(recordFields.params || {}),  // handler-specific overrides
};
```

**Důsledek:** Každý video save teď ukládá plný unified `params` do DB meta (`video_meta` store). Tím:
1. Reuse v208en+ videí obnoví kompletní stav (Fáze 6 detekuje new shape, nesahá na migrace)
2. Handlery NEMUSÍ být individually refactorovány — bridge snaps + job.params coexist
3. Staré meta (pre-v208en) stále fungují přes `_migrateOldVideoParams`

### Build stats (v208en)

- **25 modulů** (beze změny oproti v207en)
- **24 710 JS řádků** (+1 213 vs. v207en: Fáze 4 +544 + Fáze 5 +464 + Fáze 6 +195 + Fáze 7 +7 v video-queue.js, ale dual-write jen +7 efektivních)
- **30 123 total lines** (+1 213 vs. v207en)
- `✓ HTML div balance: OK (866 pairs)` (beze změny — Fáze 4 nic neprotidělala HTML)
- Extracted script `node --check` → OK

### Změněné moduly (v208en vs. v207en)

| Modul | Status | Popis |
|---|---|---|
| `video-models.js` | upraven | +544 ř.: 8 helpers, 7 onclick handlers, nové flag-driven `_applyVideoModel`, `_ensureVideoPromptRedirect` (stará funkce zůstává jako dead code) |
| `video-queue.js` | upraven | +464 ř.: `buildVideoParams`, 11 readerů, `_buildLegacySnaps`, nové `generateVideo`, `_syncVpToLegacyTopaz/Magnific`, `_saveVideoResult` patch |
| `video-gallery.js` | upraven | +195 ř.: `loadVideoJobParamsToForm`, shape detect + migrate, 6 per-family apply helpers, nová `reuseVideoJob` |
| **Ostatní** | beze změny | Včetně `template.html`, `video-topaz.js`, `xai-video.js`, `video-utils.js`, `video-models` (beyond the append) |

---

## ⚠ Fáze 8 — DO NEXT SESSION

### Smoke test per model family (z handoff § 8.1)

- [ ] **Veo 3.1** — T2V / I2V (1 ref) / Frames / Ingredients (3 refs)
- [ ] **Kling V3 Pro** — T2V / I2V / V2V (source video)
- [ ] **Kling O3 Pro** — I2V s 7 refs
- [ ] **Seedance 2.0** — T2V / I2V / R2V (4 refs) / Fast; **audio URLs** (3 inputy); **⚠ explicit test reuse** (pův. bug)
- [ ] **Grok Video** — T2V / I2V / Ref2V / Edit / Extend
- [ ] **Luma Ray2/3** — T2V / I2V / loop / HDR modes; 1/2/3 refs → 1/2/3 weight sliders dynamicky
- [ ] **Vidu Q3** — T2V / I2V / Frames
- [ ] **WAN 2.7** — T2V / I2V / R2V / V2V
- [ ] **WAN 2.6** — T2V Multi-shot / I2V / R2V Flash
- [ ] **PixVerse C1** — T2V / I2V / Transition / Fusion (7 refs)
- [ ] **PixVerse V6** — Multi-clip / Off-peak
- [ ] **Topaz Precise 2.5** — source video / factor / fps / slowmo / creativity
- [ ] **Magnific Creative** — source video / sharpen / grain / prompt / creativity / flavor
- [ ] **Magnific Precision** — source video / strength

### Reuse test (per family)
- Vygenerovat 1 video z každé family → Gallery → Reuse → **VŠECHNY params obnoveny** vč. model selection
- **Explicitní test Seedance 2.0 reuse** (původní bug — model pole musí populate se Seedance 2.0 + správná varianta)

### Cleanup po úspěšném testování
1. **Odstranit starou `_applyVideoModel`** z `video-models.js` ř. 1293-1666 (~374 ř. dead code)
2. **Odstranit starý `generateVideo`** z `video-queue.js` ř. 182-400 (~220 ř. dead code)
3. **Odstranit legacy panely** z `template.html`:
   - `lumaVideoParams`, `grokVideoParams`, `topazSrcRow`, `pixverseParams`, `magnificVidOpts`, `veoRefModeRow`, `lumaHdrRow`, `lumaCharRefRow`, `lumaResRow`, `veoResRow`, `wanResRow`, `topazResRow`, `topazFactorRow`, `topazFpsRow`, `topazSlowmoRow`, `topazCreativityRow`, `videoAspectRow`, `videoCfgRow`, `videoDurRow`, `videoAudioCtrl`, `videoCountRow`, `videoResInfoRow`, `videoRefSection`, `videoTagsRow`, `videoPromptSec`, `klingVersionRow`, `wan27vParams`, `wan27vExtendRow`, `wan27eSrcRow`, `wan27eParams`, `seedance2Params`, `sd2R2VSection`, `sd2Res1080Wrap`, `videoV2VSection`, `magnificVidCreativeOpts`, `magnificVidPrecisionOpts`
   - Odhad ~2000+ ř. odstraněných
4. **Odstranit sync layers** po handler refactoru (pokud uděláno): `_syncVpToLegacyTopaz`, `_syncVpToLegacyMagnific`, `_buildLegacySnaps`, redirect `_ensureVideoPromptRedirect` (pokud všichni píšou přímo do vpPrompt)
5. **Upravit handlery** v `video-topaz.js`/`xai-video.js`/`video-models.js` aby četli přímo z `job.params.*` místo legacy bridge fields — finální cleanup

### Známé limitace v208en (pre-test)

1. **Source video pick/clear handlers** — delegují na legacy funkce (`pickTopazSourceVideo`, `pickWan27SrcVideo`, atd.) přes `window[fn]` lookup. Pokud některá neexistuje, padne na `toast('not wired for slot: X')`. Ve smoke testu dořešit skutečné názvy funkcí.
2. **Luma per-ref weight sliders** — renderují se přes `_vpRenderRefWeights(ui)` v `_applyVideoModel`. Při reuse se apply-ujou deferred (setTimeout 50ms po `renderVideoRefPanel`). Při prvním kliknutí na ref upload se zobrazí správně? TESTOVAT.
3. **Video target folder** — legacy field `videoTargetFolder` je stále v DOM (mimo legacy panely), generate to čte přímo. ✓ funkční.
4. **Veo mode sub-select** — `_vpApplyModeSelect('veoRefMode', modelKey)` nastaví 4 options (t2v/i2v/frames/ingredients), sync s legacy `veoRefMode` select přes `onVpModeChange`.

---

## Runtime Philosophy

Beze změny. Browser sandbox přes file://, no CDN for JS libs, full local user data.

---

## Nástroje a resources

- **Kódová báze:** `petrsajner/GIS-modules` na GitHubu
- **Proxy:** `gis-proxy.petr-gis.workers.dev` (v2026-16, beze změny)
- **Build modul order (v208en, 25 modulů, beze změny):** models → styles → setup → spending → model-select → assets → refs → generate → fal → output-placeholder → proxy → gemini → output-render → db → gallery → toast → paint → ai-prompt → gpt-edit → video-utils → video-models → video-queue → video-gallery → video-topaz → video-archive + xai-video
- **Dev server**: `node build.js --dev` (port 7800)
- **Kontakt**: info.genimagestudio@gmail.com
