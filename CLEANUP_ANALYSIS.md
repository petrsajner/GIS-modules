# CLEANUP_ANALYSIS.md — video subsystém

*Původně připraveno při split session v203en. **Aktualizováno v206en** — 8 cleanup items implementováno. Items #5, #6, #10 zůstávají pro Session 2 (unified video panel).*

---

## Kontext

Po splitu `video.js` (5907 řádků) na 6 submodulů v v203en jsem při mapování narazil na vzory, které stojí za zdokumentování. Cleanup session proběhla v v206en (8 items implementováno, wrappers-preserved variant). Zbylé items (#5, #6, #10) čekají na Session 2.

Pravidla cleanup session:
1. Každá změna = jeden logický kus (ne balíček všeho) ✓
2. Po každém kusu: syntax check per modul + full build ✓
3. Žádné změny v API payloadech nebo signatur — refactor je internal-only ✓
4. Žádné ES6 `import`/`export` — moduly dál žijí v globálním scope ✓

---

## Status přehled (v206en)

| # | Oblast | Status | Realita |
|---|---|---|---|
| 1 | Source slot registry | ✅ **DONE v206en** | +60 ř (wrappers preserved) |
| 2 | `_getVideoSpendKey` → VIDEO_MODELS field | ✅ **DONE v206en** | +15 ř |
| 3 | Polling loops extrakce (Luma/Grok/PixVerse) | ✅ **DONE v206en** (Veo vynechán) | +24 ř |
| 4 | Mention state encapsulation | ✅ **DONE v206en** | +1 ř |
| 5 | `_applyVideoModel` decomposition | 🕒 **Session 2** | — |
| 6 | `generateVideo` decomposition | 🕒 **Session 2** | — |
| 7 | Dead comment "rubber-band" | ✅ **DONE v206en** | -1 ř |
| 8 | Konstanty TIMEOUT/POLL_MS hardcoded | ✅ **DONE v206en** | +25 ř |
| 9 | Topaz + Magnific upscale helpers | ✅ **DONE v206en** (konzervativnější než plán) | +15 ř |
| 10 | Prompt rewriting pattern per-model | 🕒 **Session 2** | — |
| 11 | Error handling konzistence | ✅ **DONE v206en** | +10 ř |

**Celkový line-count impact:** +150 ř (ne -530 ř jako originál odhad).

Rozdíl je **očekávaný a záměrný**:
- Zachovány wrapper funkce (wrappers-preserved pattern — viz DECISIONS.md)
- Registry + helpers + VIDEO_POLL konstanty přidávají ~60 ř komentářů a scaffolding
- `_videoPollLoop` adapter pattern přidává closures (~24 ř) místo eliminace 200 ř
- `#9` pivotoval z plného merge (~130 ř úspor) na extrakci 2 reálně sdílených helperů (~15 ř addition)

**Architektonické wins zůstávají intakt:**
1. Single source of truth pro spendKey (v VIDEO_MODELS entries)
2. Central timeout tuning (VIDEO_POLL)
3. Central source slot registry (VIDEO_SOURCE_SLOTS)
4. Shared polling loop (_videoPollLoop)
5. Shared upscale helpers (_loadAndEncodeSourceVideo, _downloadUpscaledVideo)
6. Konzistentní error handling guideline

---

## Implementace v206en — detaily per item

### ✅ #7 Dead comment "rubber-band"

Řádek `// ── Video rubber-band selection ───────────────` nad sekcí `@MENTION AUTOCOMPLETE` — rubber-band je vlastně o 240 řádků dál v `initVideoRubberBand`. Zbytek po splitu v203en. Odstraněno.

### ✅ #4 Mention state encapsulation

`videoMentionOpen`/`Filter`/`Assets`/`ActiveIdx` globální `let` proměnné sjednoceny do jednoho `const videoMention = { open, filter, assets, activeIdx }`. Sed-based find-replace, 19 call-sites updateno. Zero risk, čistší code scan.

### ✅ #11 Error handling konzistence

- `friendlyVideoError` timeout regex generalizován z `/25 min|30 min|10 min/` na `/\d+\s*(min|hour)/` — pokrývá Luma 20 min (bug fix — předtím neconvertoval) + PixVerse 2 hours.
- Přidán JSDoc guideline nad `friendlyVideoError` a `videoJobError`: "Handlery throw RAW technické errory; `videoJobError` je single entry-point pro friendly-ifikaci."

### ✅ #8 VIDEO_POLL konstanty

```javascript
const VIDEO_POLL = Object.freeze({
  defaultMs:  5000,
  offPeakMs:  15000,
  timeoutMin: Object.freeze({
    fal: 20, falLong: 25, falEdit: 30,
    veo: 15, luma: 20, grok: 15,
    pixverse: 20, pixverseOffPeak: 120,
    topaz: 30, magnific: 48,  // real value 48 min (bug spotted during plan review)
  }),
});
```

Aplikováno na všech 6 handlerů + default v `_falVideoSubmitPollDownload`. Timeout error messages reference konstanty, takže změna timeout = update textu zároveň.

### ✅ #2 _getVideoSpendKey → VIDEO_MODELS field

28 entries (Kling V3, O3, O1, 2.6, 2.5t, 2.1, 1.6 + Seedance 1.5 + Vidu Q3 + WAN 2.6) dostaly `spendKey` field (9 i `spendKeyAudio`). WAN 2.6 má funkční spendKey: `() => document.getElementById('wanResolution')?.value === '1080p' ? '_wan26_1080p' : '_wan26_720p'`.

`_getVideoSpendKey` zredukována z 28 ř switche na 7 ř:
```javascript
function _getVideoSpendKey(modelKey, hasAudio) {
  const m = VIDEO_MODELS[modelKey];
  if (!m) return '_fal_video';
  const key = (hasAudio && m.spendKeyAudio) ? m.spendKeyAudio : m.spendKey;
  if (!key) return '_fal_video';
  return typeof key === 'function' ? key() : key;
}
```

Implementováno přes Python skript (`add_spendkey.py` v `/home/claude/`). Manual str_replace by byl 28× fragile.

### ✅ #1 Source slot registry

`VIDEO_SOURCE_SLOTS` objekt v video-gallery.js + 4 generické funkce (`videoSlotClear`, `videoSlotSet`, `videoSlotDescribe`, `videoSlotPick`). 6 slotů registrovaných v gallery (wan27v, wan27e, v2v, 3× sd2Vid), 1 slot v topaz modulu (Topaz s FPS-detection `setHook`). V2V má `clearHook` pro reset inputu.

Per-slot wrappery zachovány jako 1-line forwardy — viz DECISIONS.md (wrappers-preserved pattern).

Grok video vynechán z registry — má úplně jiný pattern (`grokVideoSrcLabel` + `grokVideoSrcRow`, 6-ID shape slotu se nepoužije).

### ✅ #9 Upscale shared helpers

Místo plného `_videoUpscaleQueueJob(job, adapter)` (130 ř úspor, ale rigidní), extrakce 2 reálně sdílených patternů:

- `_loadAndEncodeSourceVideo(job)` — `dbGet('videos', srcId)` + `_arrayBufferToBase64`
- `_downloadUpscaledVideo(dlResp, job)` — chunked download s progress

Topaz i Magnific teď používají `_loadAndEncodeSourceVideo`. Topaz používá `_downloadUpscaledVideo` (Magnific má jednořádkový `arrayBuffer()` — helper tam zbytečný).

Důvod pro pivot: Topaz poll response `{status, raw_status, output_url, progress}` vs Magnific `{status, url, error}` jsou dost odlišné že plný adapter merge by přidal víc komplexity než savings. Real shared patterns = source load + chunked download.

### ✅ #3 Polling loop extrakce (Luma, Grok, PixVerse)

`_videoPollLoop(job, adapter)` v video-queue.js:
```javascript
async function _videoPollLoop(job, adapter) {
  const { label, timeoutMin, pollMs, progressLabel = 'GENERATING', poll } = adapter;
  const deadline = Date.now() + timeoutMin * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollMs));
    if (job.cancelled) throw new Error('Cancelled');
    const result = await poll();
    const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
    if (result.status === 'done')    return result.data;
    if (result.status === 'failed')  throw new Error(result.error || `${label} failed`);
    if (result.status === 'queued')  updateVideoPlaceholderStatus(job, `IN QUEUE · ${elapsed}s`);
    else                             updateVideoPlaceholderStatus(job, result.progressText || `${progressLabel} · ${elapsed}s`);
  }
  throw new Error(`${label} timeout — generation did not complete within ${timeoutMin} minutes`);
}
```

Luma, Grok, PixVerse refactored. Veo vynechán (rekurzivní setTimeout pattern, specific operations/ endpoint — viz DECISIONS.md).

**Bonus:** Automatický `job.cancelled` check v loopu. Předtím byl implementován v každém handleru zvlášť (inkonzistentně).

---

## 🕒 Session 2 — items čekající

### 5. `_applyVideoModel` decomposition

364 řádků jednoho switche na `model.type`. Každá větev dělá:
1. `document.getElementById('videoModelDesc').textContent = m.desc`
2. `_setRow('xxxRow', m.type === 'zzz')` × 15–25 rows
3. Další UI updates specifické pro typ modelu

Session 2 unified panel: `VIDEO_MODELS` entry dostane `ui: { showAudio, showCfg, showNegPrompt, showSeed, ...flags }`. Jeden HTML panel s `id="vpParams"`. `_applyVideoModel` se zkrátí na ~30 ř.

### 6. `generateVideo` decomposition

223 řádků. Vytvaří `jobData` snapshot: read UI (30+ `getElementById`), switch on `model.type` — per-model build payload, validation, `addToQueue`. Session 2 unified panel redukuje switch na registry-based `m.buildPayload(uiState)`.

### 10. Prompt rewriting per-model

3 funkce pro převod mezi `@UserLabel` / `image N` / `@ImageN` / `Figure N` / `@ElementN`. Session 2: VIDEO_MODELS entry získá `refLabelFormat: 'image' | 'element' | 'figure' | 'user'`.

---

## Metodologie pro cleanup session (aplikováno v v206en)

1. ✅ Pracovní adresář `/home/claude/src/` + `/home/claude/dist/`
2. ✅ Pro každé cleanup item: implementovat → `node --check per-module` → pokud OK → pokračovat na další item
3. ✅ Po všech items: full `node build.js 206en` → extract script → `node --check /tmp/check.mjs`
4. ✅ Mimo scope dodrženo: žádné změny v API payloadech, template.html structure, IndexedDB schema

### Smoke test checklist (Petr lokálně)

Po deployi v206en doporučený test:
- [ ] Gallery view — karty se renderují (≥10 videos)
- [ ] Video generate — Kling V3 Standard T2V, 5s, audio ON
- [ ] Source pick — Topaz button → gallery → Use → Topaz panel, FPS auto-snap funguje
- [ ] Queue progress — job viditelný v overlay + main queue
- [ ] Cancel — pending + running (`job.cancelled` teď kontrolováno v `_videoPollLoop`)
- [ ] Archive — export + import 2-3 videi
- [ ] Mention — `@` v prompt → dropdown → select
- [ ] Luma/Grok/PixVerse — jakýkoli poll cyklus (nahlédnout placeholder labels)
- [ ] Seedance 2.0 — pricing tracking správně podle resolution (per-resolution keys v spending panel)
- [ ] WAN 2.6 — spending key podle resolution (1080p vs 720p)

---

## Známé non-problémy (zachováno z v203en analýzy)

- **Duplicate `_applyVideoModel` odkazy na `document.getElementById`** — odstraní se v Session 2.
- **`videoJobs` ve `video-queue.js`, čteno i z `video-gallery.js`** — globální scope, funguje. ES6 module migrace je out of scope (Petr workflow).
- **Magic numbers v download progress** (`500ms`, `30s timeout`, `8KB chunks`) — empiricky vyladěné pro Chrome throttling + V8 string limits. Nemovit.
- **`_grokVideoSrcId` v video-models.js místo gallery** — per Petrovo rozhodnutí (session 203en start), logika je model-specific.

---

## Co nebude v Session 2 cleanup

- **Template.html audit** — IDs mohou mít nekonzistentní naming (`topazSrcImg` vs `wan27vSrcImg` vs `sd2VidSrc1Img`). Unified panel může vyřešit tím že je všem dá stejný naming scheme. Ale cleanup by vyžadoval sync HTML + JS.
- **CSS `.video-*` classes konzistence** — mimo scope Session 2 (Session 2 primárně logic + HTML, ne CSS).
- **IndexedDB schema optimization** — `videos` store s binary data + `video_meta` store bez = funguje, žádný performance problém.
- **Proxy Worker handlers** — ne v scope GIS client-side cleanup.

---

*Dokument aktualizovaný během cleanup session v206en. Session 2 (unified video panel) začíná hned po v206en — viz Petrův plán v chat history.*
