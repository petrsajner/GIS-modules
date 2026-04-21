# CLEANUP_ANALYSIS.md — video subsystém

*Po split session (v203en). Tento dokument = **analýza + instrukce** pro budoucí cleanup session, ne k okamžitému provedení.*

---

## Kontext

Po splitu `video.js` (5907 řádků) na 6 submodulů jsem při mapování narazil na vzory, které stojí za zdokumentování. Některé volají po sjednocení ještě **před** Session 2 (unified panel), protože zvětšují povrch, na kterém se unified panel bude projektovat. Jiné jsou spíš kosmetické a mohou počkat.

Cleanup by měl proběhnout **samostatnou session** — mechanická pravidla:

1. Každá změna = jeden logický kus (ne balíček všeho)
2. Po každém kusu: prod build test + interaktivní smoke test (minimálně: generate job + queue + gallery render + source pick)
3. Žádné změny v API payloadech nebo signatur — refactor je internal-only
4. Žádné ES6 `import`/`export` — moduly dál žijí v globálním scope

---

## Přehled oblastí (seřazeno podle přínos/riziko)

| # | Oblast | Modul | Přínos | Riziko | Velikost |
|---|---|---|---|---|---|
| 1 | Source slot registry | gallery | Vysoký | Nízké | Střední (~150 ř ušetřeno) |
| 2 | `_getVideoSpendKey` → VIDEO_MODELS field | models | Střední | Nízké | Malá (~30 ř ušetřeno + čistější add nového modelu) |
| 3 | Polling loops extrakce (Veo, Luma, Grok, PixVerse) | models | Vysoký | Střední | Velká (~200 ř ušetřeno) |
| 4 | Mention state encapsulation | gallery | Malý | Nízké | Malá |
| 5 | `_applyVideoModel` (364 ř switch) decomposition | models | Vysoký | **Vysoké** | Velká — závisí na Session 2 unified panel |
| 6 | `generateVideo` (223 ř switch) decomposition | queue | Vysoký | **Vysoké** | Velká — navazuje na #5 |
| 7 | Dead comment "rubber-band" nad mention sekcí | gallery | Kosmetika | Žádné | 1 řádek |
| 8 | Konstanty `TIMEOUT`/`POLL_MS` hardcoded v handlerech | models | Střední | Nízké | Malá |
| 9 | `runTopazQueueJob` vs `runMagnificVideoUpscaleJob` merge | topaz | Malý | Střední | Střední |
| 10 | Prompt rewriting pattern per-model | models | Střední | Střední | Střední |
| 11 | Error handling konzistence (`friendlyVideoError` usage) | models | Malý | Nízké | Malá |

**Doporučené pořadí pro cleanup session:** #1 → #2 → #7 → #4 → #8 → #11 → #9 → (SESSION 2 unified panel: #5 + #6 + #10)

---

## 1. Source slot registry

### Problém

V gallery.js je pět samostatných source-slot wrapper skupin (dále jen "slots"). Každá má stejnou anatomii: IDs objekt + 4 metody (`clearSource`, `setSource`, `pickFromGallery`, `describeSource`).

```javascript
// video-topaz.js
const _topazIds = { info:'topazSrcInfo', thumb:'topazSrcThumb', img:'topazSrcImg',
                    meta:'topazSrcMeta', clearBtn:'topazSrcClearBtn',
                    describeBtn:'topazSrcDescribeBtn' };
function topazClearSource() { topazSrcVideoId = null; _srcSlotClear(_topazIds); }
async function topazSetSource(videoId) { ... }
async function topazDescribeSource() { _srcSlotDescribe('topazSrcImg'); }
async function topazPickFromGallery() { ... }

// video-gallery.js (wan27v)
const _wan27vIds = { info:'wan27vSrcInfo', ... };
function wan27vClearSource() { wan27vSrcVideoId = null; _srcSlotClear(_wan27vIds); }
async function wan27vSetSource(videoId) { wan27vSrcVideoId = videoId; await _srcSlotSet(_wan27vIds, videoId); }
function wan27vPickFromGallery() { switchView('video'); toast(...); }
async function wan27vDescribeSource() { _srcSlotDescribe('wan27vSrcImg'); }

// A stejný pattern pro: _v2vIds (V2V), _wan27eIds (WAN 2.7 Edit),
//                       _sd2VidIds[0..2] (Seedance 2.0 R2V),
//                       _grokVideoSrcId (Grok — jen jedna proměnná, ale stejný interface)
```

Každý set má prakticky identickou strukturu. Změna konvence (např. nové ID schéma) = pět updates.

### Řešení

Jeden registry objekt + factory:

```javascript
// video-gallery.js (nebo nový malý video-slots.js)
const VIDEO_SOURCE_SLOTS = {
  topaz:    { ids: _topazIds,   onSet: (id) => { topazSrcVideoId = id; },    extraSet: topazSetSourceHook },
  wan27v:   { ids: _wan27vIds,  onSet: (id) => { wan27vSrcVideoId = id; } },
  wan27e:   { ids: _wan27eIds,  onSet: (id) => { wan27eSrcVideoId = id; } },
  v2v:      { ids: _v2vIds,     onSet: (id) => { videoMotionVideoId = id; videoMotionFile = null; } },
  sd2Vid_0: { ids: _sd2VidIds[0], onSet: (id) => { sd2VidSrc[0] = id; } },
  sd2Vid_1: { ids: _sd2VidIds[1], onSet: (id) => { sd2VidSrc[1] = id; } },
  sd2Vid_2: { ids: _sd2VidIds[2], onSet: (id) => { sd2VidSrc[2] = id; } },
  grokVid:  { ids: _grokVidIds, onSet: (id) => { _grokVideoSrcId = id; } },
};

function videoSlotClear(key) {
  const s = VIDEO_SOURCE_SLOTS[key]; if (!s) return;
  s.onSet(null); _srcSlotClear(s.ids);
}
async function videoSlotSet(key, videoId) {
  const s = VIDEO_SOURCE_SLOTS[key]; if (!s) return;
  s.onSet(videoId);
  await _srcSlotSet(s.ids, videoId);
  if (s.extraSet) await s.extraSet(videoId);
}
function videoSlotPickFromGallery(key) {
  switchView('video'); toast('Select a video, then click ▷ Use on it', 'ok');
}
async function videoSlotDescribe(key) {
  const s = VIDEO_SOURCE_SLOTS[key]; if (!s) return;
  _srcSlotDescribe(s.ids.img);
}
```

HTML přepsat: `onclick="topazClearSource()"` → `onclick="videoSlotClear('topaz')"`.

### Dopad

- **Ušetřeno:** ~150 ř. Eight `*ClearSource`/`*SetSource`/`*Pick*`/`*Describe*` funkcí × cca 4 ř × 4 metody → teď 1 registry + 4 generické funkce.
- **Nová funkce = jeden řádek do `VIDEO_SOURCE_SLOTS` registru** místo zkopírovat–vložit 4 wrappery
- **Pozor:** `topazSetSource` má extra logiku (auto-snap FPS, render meta). To je v `extraSet` hook. Ne-blokátor.

### Test plan
- Source pick pro všech 8 slotů (Topaz, wan27v, wan27e, v2v, 3× sd2Vid, grokVid)
- `topazSetSource` FPS detection stále funguje (auto-snap 24/25/30/60/90/120)
- Use-from-gallery dispatch (`useVideoFromGallery`) stále routing správně

---

## 2. `_getVideoSpendKey` → VIDEO_MODELS field

### Problém

V `video-models.js` je 28řádkový switch mapující modelKey → spending key:

```javascript
function _getVideoSpendKey(modelKey, hasAudio) {
  if (modelKey.startsWith('kling_v3_v2v')) return '_kling_mc';
  if (modelKey.startsWith('kling_v3') && modelKey.includes('_pro'))
    return hasAudio ? '_kling_v3_pro_audio' : '_kling_v3_pro';
  // … 20+ dalších větví
  return '_fal_video';
}
```

Každý nový model = úprava na dvou místech: `VIDEO_MODELS` entry + switch. Už teď vidět, že prefix matching je křehké (např. "kling_v3" matchuje i "kling_v3_v2v_*" pokud první if selže).

### Řešení

Přesunout spend key do VIDEO_MODELS entry:

```javascript
kling_v3_t2v_pro: {
  name: 'Kling V3 Pro T2V', type: 'kling_video',
  endpoint: 'fal-ai/kling-video/v3/pro/text-to-video',
  spendKey: '_kling_v3_pro',             // NEW
  spendKeyAudio: '_kling_v3_pro_audio',  // NEW, optional — používá se když hasAudio=true
  ...
},
```

`_getVideoSpendKey(modelKey, hasAudio)` → 4 řádky:

```javascript
function _getVideoSpendKey(modelKey, hasAudio) {
  const m = VIDEO_MODELS[modelKey];
  if (!m) return '_fal_video';
  return (hasAudio && m.spendKeyAudio) ? m.spendKeyAudio : (m.spendKey || '_fal_video');
}
```

WAN 2.6 resolution-dependent key (`_wan26_1080p` vs `_wan26_720p`) přenést do WAN 2.6 entry jako funkční `spendKey: (hasAudio) => ...`:

```javascript
wan26_t2v: {
  ...,
  spendKey: () => document.getElementById('wanResolution')?.value === '1080p'
    ? '_wan26_1080p' : '_wan26_720p',
},
```

A `_getVideoSpendKey`:

```javascript
function _getVideoSpendKey(modelKey, hasAudio) {
  const m = VIDEO_MODELS[modelKey];
  if (!m) return '_fal_video';
  const key = (hasAudio && m.spendKeyAudio) ? m.spendKeyAudio : m.spendKey;
  return typeof key === 'function' ? key() : (key || '_fal_video');
}
```

### Dopad

- **Ušetřeno:** ~25 ř
- **Konzistence s image models** — image VIDEO_MODELS by mohlo mít stejné pole
- **Nová funkce = nový model s spendKey ve své VIDEO_MODELS entry**, žádný centrální switch na úpravu

### Test plan
- Spusť po jednom jobu z každé model rodiny, zkontroluj že spending tracker počítá stejně jako před změnou
- Speciálně WAN 2.6 s 720p i 1080p (funkční spendKey)

---

## 3. Polling loops extrakce

### Problém

4 handlery (`callVeoVideo`, `callLumaVideo`, `callGrokVideo`, `callPixverseVideo`) mají vlastní polling loop. Každý:
1. Submit request → získat ID
2. Loop s setTimeout polling (5s, 15s, 30s… různé intervaly)
3. Timeout watchdog (10–30 min)
4. `job.cancelled` check
5. Status handling (IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED)
6. Download binary
7. `_saveVideoResult`

Jen fal.ai path (Kling, Seedance 1.5, Vidu, WAN) používá sdílené `_falVideoSubmitPollDownload`. Ostatní providery duplikují logiku.

Důsledek:
- Bug fix v jednom handleru (např. lepší timeout message) = nutno zopakovat 4×
- Nekonzistentní chování (Veo updatuje placeholder "IN QUEUE · 45s" ale Luma jen "Generating…")

### Řešení

Zobecnit `_falVideoSubmitPollDownload` do `_videoSubmitPollDownload` s pluggable adapters:

```javascript
/**
 * Generic submit → poll → download flow for any video API.
 * adapter = {
 *   submit: async (job) => ({ requestId, statusUrl, downloadUrl }),
 *   poll:   async (ctx)  => { status: 'queued'|'running'|'done'|'failed', progressText?, data? },
 *   download: async (ctx, data) => ArrayBuffer,
 *   timeoutMin, pollMs, label, progressLabel,
 * }
 */
async function _videoSubmitPollDownload(job, adapter) {
  job.status = 'submitting'; renderVideoQueue();
  const submitRes = await adapter.submit(job);
  job.requestId = submitRes.requestId;
  job.status = 'queued'; renderVideoQueue();
  updateVideoPlaceholderStatus(job, 'IN QUEUE…');

  const deadline = Date.now() + (adapter.timeoutMin * 60 * 1000);
  let result = null;
  await new Promise((resolve, reject) => {
    const tick = async () => {
      if (Date.now() > deadline) return reject(new Error(`${adapter.label}: timeout`));
      if (job.cancelled) return reject(new Error('Cancelled'));
      try {
        const r = await adapter.poll({ job, submitRes });
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
        if (r.status === 'queued')  updateVideoPlaceholderStatus(job, `IN QUEUE · ${elapsed}s`);
        if (r.status === 'running') { job.status = 'running'; renderVideoQueue();
                                       updateVideoPlaceholderStatus(job, r.progressText || `${adapter.progressLabel} · ${elapsed}s`); }
        if (r.status === 'done')    { result = r.data; return resolve(); }
        if (r.status === 'failed')  return reject(new Error(r.error || 'Generation failed'));
      } catch(_) {}
      setTimeout(tick, adapter.pollMs);
    };
    setTimeout(tick, adapter.pollMs);
  });

  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');
  return await adapter.download({ job, submitRes, result });
}
```

Každý handler se zkrátí na ~30–50 ř a používá sdílený flow. Např. `callLumaVideo`:

```javascript
async function callLumaVideo(job) {
  const adapter = {
    label: 'Ray',
    timeoutMin: 15,
    pollMs: 5000,
    progressLabel: 'GENERATING',
    submit: async (job) => {
      // 1. Build submit body, upload keyframes via proxy
      const r = await fetch(proxyUrl + '/luma/video/submit', { method: 'POST', body: JSON.stringify(submitBody) });
      const { generation_id } = await r.json();
      return { requestId: generation_id };
    },
    poll: async ({ job, submitRes }) => {
      const r = await fetch(proxyUrl + '/luma/video/status', { method: 'POST', body: JSON.stringify({ generation_id: submitRes.requestId, luma_key: lumaKey }) });
      const d = await r.json();
      if (d.status === 'completed') return { status: 'done', data: d };
      if (d.status === 'failed')    return { status: 'failed', error: d.failure_reason };
      if (d.status === 'queued')    return { status: 'queued' };
      return { status: 'running' };
    },
    download: async ({ result }) => {
      const r = await fetch(result.video_url);
      return await r.arrayBuffer();
    },
  };
  const buffer = await _videoSubmitPollDownload(job, adapter);
  await _saveVideoResult(buffer, {...}, job, ['luma', _getVideoSpendKey(job.modelKey), 1, job.duration]);
}
```

### Dopad

- **Ušetřeno:** ~200 ř across 4 handlery
- **Konzistentní UX** — všechny handlery vypadají stejně v queue UI
- **Cancelled + timeout handling jednou** — nová funkce = jen submit/poll/download adapter
- **Runway / Hailuo / Vidu Q3 Turbo** (budoucí plán) půjdou rovnou přes nový pattern

### Test plan
- Full job každého providera: Veo, Luma, Grok (Edit+Extend+T2V), PixVerse (C1+V6)
- Cancel během queued → running → fetching → ve všech 3 fázích
- Timeout smoke test (rate limit → simulace dlouhého running)

---

## 4. Mention state encapsulation

### Problém

```javascript
// video-gallery.js:5232
let videoMentionOpen = false;
let videoMentionFilter = '';
let videoMentionAssets = [];
let videoMentionActiveIdx = -1;
```

Čtyři globální `let` proměnné pro jeden autocomplete widget. Stejný pattern by pro asset mention v refs.js (vlastní sada globals). Typická odlišná pastička: state leak mezi widgets.

### Řešení

```javascript
const videoMention = { open: false, filter: '', assets: [], activeIdx: -1 };
// All usages:
videoMention.open = true;      // (dříve videoMentionOpen = true)
videoMention.filter = q;
...
```

### Dopad

- **Ušetřeno:** 4 řádky + čistší code scan
- **Zero risk** — change je mechanická find-replace
- **Budoucnost:** pokud refs.js má analogickou strukturu, lze unify

### Test plan
- `@` v video prompt → dropdown se otevře
- Šipky + Tab → selection
- Esc → zavřít

---

## 5. `_applyVideoModel` decomposition (VELKÝ, ČEKÁ NA SESSION 2)

### Problém

`_applyVideoModel(key)` = **364 řádků jednoho switche** na `model.type`. Každá větev dělá:
1. `document.getElementById('videoModelDesc').textContent = m.desc`
2. `_setRow('xxxRow', m.type === 'zzz')` × 15–25 rows
3. Další UI updates specifické pro typ modelu

To je jádro toho, co Session 2 vyřeší **unified video panel** (podobně jako v200en pro image modely). Dokud se Session 2 neudělá, refactoring `_applyVideoModel` by byl throw-away.

### Doporučení

**NEPROVÁDĚT v této cleanup session.** Počkat na Session 2, která kompletně nahradí jednotlivé HTML panely per model jedním unified template s UI flags v `VIDEO_MODELS` entries.

### Session 2 plan (sumář pro kontext)

Analogicky image unified panel v200en:
- `VIDEO_MODELS` entry dostane `ui: { showAudio, showCfg, showNegPrompt, showSeed, ...flags }`
- Jeden HTML panel s `id="vpParams"` pro všechny modely
- `_applyVideoModel` se zkrátí na `~30 řádků` — jen applies UI flags a skrývá model-specific overrides (Veo resolution, Topaz source, Magnific, atd.)

---

## 6. `generateVideo` decomposition (VELKÝ, ČEKÁ NA SESSION 2)

### Problém

`generateVideo()` v `video-queue.js` = **223 řádků**. Vytvaří `jobData` snapshot:
- Read UI (30+ `getElementById`)
- Switch on `model.type` — per-model build payload
- Validation (missing key, missing refs, …)
- `addToQueue(jobData)`

Stejně jako #5 — Session 2 unified panel redukuje switch na registry-based `m.buildPayload(uiState)`.

### Doporučení

**NEPROVÁDĚT** do Session 2. Částečný refactor by se smazal při unified panel.

---

## 7. Dead comment "rubber-band"

### Problém

```javascript
// video-gallery.js (v originálu L5224)
// ── Video rubber-band selection ───────────────────────────
// ═══════════════════════════════════════════════════════
// @MENTION AUTOCOMPLETE V VIDEO PROMPTU
```

První řádek se zmiňuje o rubber-band, ale followuje sekce mention autocomplete. Rubber-band je v `initVideoRubberBand` o 240 řádků dál. Zbytek po splitu.

### Řešení

```javascript
// ═══════════════════════════════════════════════════════
// @MENTION AUTOCOMPLETE V VIDEO PROMPTU
// (kopie systému z refs.js, pro #videoPrompt textarea)
// ═══════════════════════════════════════════════════════
```

Odstranit jeden řádek.

### Dopad

Žádný funkční. Čistší orientace v kódu.

---

## 8. Konstanty TIMEOUT/POLL_MS hardcoded

### Problém

V handlerech různé:
- `_falVideoSubmitPollDownload` default `pollMs: 5000, timeoutMin: 15`
- `callVeoVideo` — 5min timeout (z `pollOperation` flow)
- `callLumaVideo` — 5000 ms poll, 20 min timeout
- `callGrokVideo` — 5000 ms poll, 15 min timeout
- `runTopazQueueJob` — 30 min timeout, 5s poll

Žádný centrální tuning point. Ladění = editovat 5 míst.

### Řešení

```javascript
// video-models.js top
const VIDEO_POLL = {
  defaultMs: 5000,
  timeoutMin: {
    fal: 20, veo: 10, luma: 20, grok: 15, pixverse: 15, topaz: 30, magnific: 30,
  },
};
```

Každý handler pak `timeoutMin: VIDEO_POLL.timeoutMin.luma`.

### Dopad

- **Ušetřeno:** ~10 ř (symbolic)
- Centrální tuning pro případ API latency výkyvu

### Test plan
- Trivial — nezměňuje behavior, jen centralizuje konstanty

---

## 9. Topaz + Magnific merge

### Problém

`runTopazQueueJob` (124 ř) a `runMagnificVideoUpscaleJob` (76 ř) mají podobný flow:
1. Load source video from DB
2. Upload to R2
3. Submit job to proxy
4. Poll status
5. Download result
6. `_saveVideoResult` with appropriate spendKey

Různé payloady, ale stejná struktura.

### Řešení

Zobecněný `_videoUpscaleQueueJob(job, adapter)` podobně jako #3:

```javascript
async function _videoUpscaleQueueJob(job, adapter) {
  updateVideoPlaceholderStatus(job, 'LOADING…');
  const rec = await dbGet('videos', job.srcId).catch(() => null);
  if (!rec?.videoData) throw new Error('Source video not found in gallery');

  // R2 upload
  updateVideoPlaceholderStatus(job, 'UPLOADING TO R2…');
  const r2Resp = await fetch(job.proxyUrl + '/r2/upload', { method: 'POST', body: rec.videoData });
  const { publicUrl } = await r2Resp.json();

  // Submit
  const submitRes = await adapter.submit(job, publicUrl);

  // Poll + download
  const buffer = await _videoSubmitPollDownload(job, adapter);  // reuse from #3

  // Save
  await _saveVideoResult(buffer, adapter.recordFields(job), job, adapter.spendArgs(job));
}
```

Topaz adapter + Magnific adapter each ~20 ř. Net savings ~130 ř.

### Risk

Topaz má specifickou logiku pro dim detection, FPS auto-snap, creativity level. Musí být v adapter `recordFields` hook.

### Test plan
- Topaz: Precise 2.5 + Precise 2 (s factor) + creativity (Astra)
- Magnific: Creative + Precision
- Source video s unknown FPS (regression: FPS auto-snap)

---

## 10. Prompt rewriting per-model (VELKÝ, ČEKÁ NA SESSION 2)

### Problém

`videoPromptModelToUserLabels`, `videoPromptUserLabelsToModel`, `rewriteVideoPromptForModel` — 3 funkce pro převod mezi:
- `@UserLabel1` (user-editable)
- `image 1` (Gemini/xAI)
- `@Image1` (Flux/Kling)
- `Figure 1` (SeeDream)
- `@Element1` (Kling O3 multi-ref)

Každý model má svoje parsing rules, všechno v jednom switch.

### Řešení

V `VIDEO_MODELS` entry: `refLabelFormat: 'image' | 'element' | 'figure' | 'user'`. Pak:

```javascript
function renderRefMention(m, idx) {
  switch (m.refLabelFormat) {
    case 'element': return `@Element${idx+1}`;
    case 'figure':  return `Figure ${idx+1}`;
    case 'image':   return m.apiStyle === 'xai' ? `image ${idx+1}` : `@Image${idx+1}`;
    default:        return `@${refs[idx].userLabel || 'Ref'}${idx+1}`;
  }
}
```

### Doporučení

**Odložit do Session 2** — prompt rewriting je úzce spjaté s unified panel refactorem. Dělat to teď = dvojí práce.

---

## 11. Error handling konzistence

### Problém

`friendlyVideoError(msg)` přetváří API error na user-friendly zprávu. Někde je volaná v `videoJobError`, jinde ne:

```javascript
// callLumaVideo
catch(e) { throw new Error(e.message || 'Luma failed'); }  // raw

// callVeoVideo
catch(e) { throw e; }  // raw

// runTopazQueueJob
catch(e) { throw new Error(`Topaz failed: ${e.message}`); }  // raw
```

`videoJobError` friendly-ifies only při top-level catch. Nekonzistentní user experience.

### Řešení

Guideline: **handlery vždy throw-raw**, `videoJobError` vždy `friendlyVideoError`. Add ESLint rule/komentář.

### Dopad

- Menší (~10 ř update)
- Konzistentní toast messaging

---

## Metodologie pro cleanup session

1. **Start of session:** git checkout new branch `cleanup-video-v204`
2. Pro každé cleanup item (seřazené):
   - Implementovat v src modules
   - `node build.js --dev` → load localhost:7800 → interaktivní smoke test
   - Pokud OK → git commit `cleanup(#N): <popis>`
   - Pokud regrese → revert, log do DECISIONS.md
3. **End of session:** `node build.js 204en`, syntax check, update STAV.md + DECISIONS.md
4. **Mimo scope:** změny v API payloadech, template.html structure, IndexedDB schema

### Smoke test checklist po každém cleanup kroku

- [ ] Gallery view — karty se renderují (≥10 videos)
- [ ] Video generate — Kling Standard T2V, 5s, audio ON
- [ ] Source pick — Topaz button → gallery → Use from gallery → Topaz panel
- [ ] Queue progress — job viditelný v overlay + main queue
- [ ] Cancel — pending + running
- [ ] Archive — export + import 2-3 videi
- [ ] Mention — `@` v prompt → dropdown → select

---

## Odhadovaný rozsah cleanup session

**Cleanup-only (bez #5, #6, #10):** 1–2 hodiny
**Se Session 2 integrace (#5 + #6 + #10):** 4–6 hodin, rozdělit na 2 sessions

**Line savings odhad:**
| # | Ušetřeno ř |
|---|---|
| 1 | 150 |
| 2 | 25 |
| 3 | 200 |
| 4 | 4 |
| 7 | 1 |
| 8 | 10 |
| 9 | 130 |
| 11 | 10 |
| **Cleanup-only total** | **~530 ř** |
| 5 (Session 2) | ~300 |
| 6 (Session 2) | ~200 |
| 10 (Session 2) | ~80 |

Po cleanup video.js ekvivalent z ~5907 → ~5377 řádků.
Po Session 2: ~4800 řádků (8k → 4.8k je ~40% redukce).

---

## Známé non-problémy (analyzoval jsem, nepotřebuje akce)

- **Duplicate `_applyVideoModel` odkazy na `document.getElementById`** — mnoho per row toggle. Odstraní se při Session 2 unified panel.
- **`videoJobs` ve `video-queue.js`, ale čteno i z `video-gallery.js`** — globální scope, funguje. Refactor do encapsulated state bylo by ES6 module migrace = out of scope.
- **Magic numbers v download progress** (`500ms`, `30s timeout`, `8KB chunks`) — jsou empiricky vyladěné pro Chrome throttling + V8 string limits. Nemovit.
- **`_grokVideoSrcId` v video-models.js místo gallery** — per Petrovo rozhodnutí (Session start), logika je model-specific.

---

## Co není v této analýze

- **Template.html audit** — IDs mohou mít nekonzistentní naming (`topazSrcImg` vs `wan27vSrcImg` vs `sd2VidSrc1Img`). Cleanup by vyžadoval sync HTML + JS.
- **CSS `.video-*` classes konzistence** — mimo scope splitu.
- **IndexedDB schema optimization** — `videos` store s binary data + `video_meta` store bez = funguje, žádný problém performance.
- **Proxy Worker handlers** — ne v scope GIS client-side cleanup.

---

*Dokument připravený během split session v203en. Aktualizovat když se cleanup items provedou.*
