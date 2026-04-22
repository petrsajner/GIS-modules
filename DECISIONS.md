# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 22. 4. 2026 · v206en video cleanup session*

---

## Video cleanup — wrappers preserved pattern (22. 4. 2026)

**Kontext:** CLEANUP_ANALYSIS.md doporučil pro #1 (source slot registry) nahradit per-slot wrapper funkce (`topazClearSource`, `wan27vSetSource`, atd.) voláním generického API přes klíč (`videoSlotClear('topaz')`). Odhadované úspory ~150 řádků.

**Problém:** Wrapper funkce jsou volány z ~50 míst (19 v template.html přes `onclick="xxx()"`, 31 v video-*.js). Plná rename by znamenala synchronizovanou změnu v HTML + JS, což by:
- Rozhodlo o tom jestli registry klíč (`'topaz'`, `'wan27v'`) je public API nebo implementation detail
- Požadovalo regression test pro každý slot ve všech interakcích (pick, clear, set, describe)
- Otevřelo riziko missed reference při batch rename

**Rozhodnutí:** Wrapper funkce zachovány jako 1-line forwards:

```javascript
// Original (4 lines):
function topazClearSource() { topazSrcVideoId = null; _srcSlotClear(_topazIds); }
async function topazSetSource(videoId) { ... 24 lines ... }
async function topazDescribeSource() { _srcSlotDescribe('topazSrcImg'); }
async function topazPickFromGallery() { switchView('video'); toast('...', 'ok'); }

// Now (4 lines):
function topazClearSource()        { videoSlotClear('topaz'); }
async function topazSetSource(id)  { return videoSlotSet('topaz', id); }
async function topazDescribeSource() { await videoSlotDescribe('topaz'); }
async function topazPickFromGallery() { videoSlotPick('topaz'); }
```

**Důvod:**
1. HTML/JS call-sites beze změny → nulové riziko že něco selhalo
2. Architektonické wins (registry, `setHook`, `clearHook`) stejné jako v "full refactor" variantě
3. Adding a new slot = 1 registry entry + 4 wrapper forwards, stále výhra oproti original 4 explicit funkcí
4. Řádková úspora neuspokojivá (+60 ř netto), ale cleanup je o klaritě kódu, ne o počtu řádků

**Trade-off:** Registry nemá `push` API pro third-party moduly elegantně. Topaz musí do svého modulu (`video-topaz.js`) přidat `VIDEO_SOURCE_SLOTS.topaz = {...}` přímo jako top-level statement. To funguje protože build order garantuje že `video-gallery.js` (kde je registry declarovaná) je před `video-topaz.js`.

**Revisit:** Pokud v budoucí session přijde refactor HTML (třeba Session 2 — unified video panel), zvážit full rename při té příležitosti.

---

## Video cleanup — _videoPollLoop scope (22. 4. 2026)

**Kontext:** 4 video handlery (Veo, Luma, Grok, PixVerse) měly vlastní polling loop s ~40-60 řádky každý. CLEANUP_ANALYSIS odhadl 200 ř úspor extrakcí do sdílené funkce.

**Rozhodnutí:** Extrakce `_videoPollLoop(job, adapter)` — aplikována na Luma, Grok, PixVerse (3 ze 4). **Veo vynecháno.**

**Důvod pro Veo vynechání:**
- Veo používá rekurzivní `setTimeout` pattern s `operations/xyz` endpointem (ne while loop)
- `callVeoVideo` má inline `await new Promise((resolve, reject) => { const poll = ... })` místo standard loop
- Refactor by vyžadoval změnu submit shape z `predictLongRunning` → `operations/fetchPredictOperation` což je specific Veo API pattern
- Veo Long-Running Operations = Google pattern, bude potenciálně migrovat na jiný endpoint; refactor = throw-away

**Zachovaný adapter shape:**
```javascript
{
  label: 'Luma video' | 'Grok Video' | 'PixVerse video',
  timeoutMin: number,
  pollMs: number,
  progressLabel?: 'GENERATING' | 'EDITING',
  poll: async () => ({ status: 'queued'|'running'|'done'|'failed', data?, error?, progressText? })
}
```

**Pozorování:** PixVerse měl numerické status kódy (1=done, 2/8=failed, 3/5=processing, 7=moderation, 9=queued). Adapter přemapoval na text statusy pro sdílený loop. Je to čistší — PixVerse quirk izolovaný v poll() callbacku.

---

## Video cleanup — spendKey migration (22. 4. 2026)

**Kontext:** `_getVideoSpendKey(modelKey, hasAudio)` byl 28-line switch s `startsWith(...)` matchingem, fragile při přidávání modelu (Kling V3 V2V musel být PŘED Kling V3 matching).

**Rozhodnutí:** `spendKey` + volitelný `spendKeyAudio` field do VIDEO_MODELS entry. Funkce zredukována na 7 řádků. WAN 2.6 používá funkční `spendKey: () => {...}` kvůli resolution-dependent pricing.

**Důvod pro neodstranění funkce:**
- Handler code volá `_getVideoSpendKey(modelKey, hasAudio)` 1 místo
- Kdyby kód volal VIDEO_MODELS přímo, musel by opakovat `typeof key === 'function' ? key() : (key || '_fal_video')` fallback
- Jedna funkce = jedna strategie fallback + function-or-string resolution

**Pozorování:** 28 entries bylo přidáno automaticky přes Python skript (`add_spendkey.py`) s precizním line-range mapováním. Manual str_replace by byl 28× fragile.

---

## Video cleanup — VIDEO_POLL location (22. 4. 2026)

**Kontext:** 6 různých timeout konstant v handlerech, žádný central tuning point.

**Rozhodnutí:** `VIDEO_POLL` objekt do `video-utils.js` (top of file, freezes), s 10 per-provider timeout keys + 2 poll interval variants (default 5s, off-peak 15s pro PixVerse).

**Důvod pro video-utils:**
- Už obsahuje `friendlyVideoError` (error handling) — `VIDEO_POLL` je stejná kategorie (tuning)
- Build order kritický: `video-utils` = první video modul, všechny ostatní ho mohou reference
- `Object.freeze(VIDEO_POLL.timeoutMin)` = prevencs accidental mutation v handlerech

**Bug fix in passing:** Magnific video timeout měl v kódu `48 * 60_000` (48 min) hardcoded, ale v mé první draft verzi konstanty jsem napsal `magnific: 30`. Po kontrole kódu jsem updatoval konstantu na 48. **Vždy ověřit real code value před konstantou tunningem.**

---

## Historické záznamy (pre-v206en)

*Pro historii předchozích rozhodnutí viz GitHub repo history DECISIONS.md.*

---

## Video.js split — Session 1 ze 2 (21. 4. 2026, v203en)

[Zkrácený záznam — viz v203en STAV.md pro detail]

Split na 6 submodulů podle ownership/concern. Čistě mechanický, bez funkční změny. Každý řádek originálu verifikován proti cílovému modulu přes multiset compare. Build order: utils → models → queue → gallery → topaz → archive.

---

## GPT Image family via fal.ai (21. 4. 2026, v205en)

[Zkrácený záznam — viz v205en STAV.md pro detail]

Fal.ai spustil `openai/gpt-image-2` + `/edit` endpointy den po OpenAI release. GIS integroval kompletní rodinu: 4 modely (T2I + Edit × 2 generace) via nový `gpt-edit.js` modul. Mask handling přes annotation layer (role: 'mask'). Quality flag `upQuality` (low/medium/high) přidán do unified panelu. Streaming vypnutý — fal posílá jen final event.
