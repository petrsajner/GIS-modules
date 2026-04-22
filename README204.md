# v204en — Seedance 2.0 1080p support — deployment balíček

**Datum:** 21. 4. 2026
**Session:** Seedance 2.0 1080p + pricing refactor + bonusy

---

## Obsah balíčku

```
src/
  video-models.js    2443 ř  — 6 Seedance entries + callSeedance2Video pricing logic + _applyVideoModel 1080p toggle
  spending.js         233 ř  — 3 staré keys → 10 nových per-resolution
  template.html      5068 ř  — 1080p radio option + lip-sync/multi-shot hint box

docs/
  STAV.md                    — kompletní sloučený dokument s v204en sekcí nahoře
  DECISIONS.md               — kompletní sloučený dokument s v204en decision nahoře
```

**Moduly beze změny** (v203en zůstává v platnosti): `video-utils.js`, `video-queue.js`, `video-gallery.js`, `video-topaz.js`, `video-archive.js`.

---

## Co se změnilo

### 1. Seedance 2.0 resolution schema

6 entries v `video-models.js` přepnuto z `resolution: '720p'` → `resolutions: [array]`:

| Endpoint | Resolutions |
|---|---|
| `seedance2_t2v`, `seedance2_i2v`, `seedance2_r2v` | `['480p', '720p', '1080p']` |
| `seedance2f_t2v`, `seedance2f_i2v`, `seedance2f_r2v` | `['480p', '720p']` (fast nemá 1080p) |

### 2. Pricing refactor (spending.js)

Před: 3 keys. Po: 10 keys pokrývajících **tier × resolution × R2V-multiplier**.

Hodnoty matematicky odvozené z fal token formule:
```
tokens_per_second = (height × width × 24) / 1024
standard_cost = tokens/s × $0.014 / 1000
fast_cost     = tokens/s × $0.0112 / 1000
```

Validace vs oficiální:
- 720p std: spočteno $0.3024 ≈ publikováno $0.3034 (0.3% rounding)
- 720p fast: spočteno $0.2419 = publikováno $0.2419 ✓

**Oprava bugu**: `_seedance2_r2v_fast` bylo 0.181, publikovaná fal hodnota je $0.14515/s. Opraveno na 0.1452.

### 3. Pricing routing (callSeedance2Video)

```javascript
const isFast     = endpoint.includes('/fast/');
const hasVidRefs = isR2V && (sd2Snap?.vidSrcIds || []).some(Boolean);
const tier       = isFast ? 'fast' : 'std';
const prefix     = hasVidRefs ? '_seedance2_r2v_' : '_seedance2_';
const priceKey   = `${prefix}${tier}_${resolution}`;
```

### 4. UI — 1080p radio + toggle logika

Template: přidána 1080p volba s wrapperem `sd2Res1080Wrap`.
_applyVideoModel: `has1080p` → `style.display` + fallback 1080p→720p při přepnutí na Fast.

### 5. Bonus — prompt hint v UI

Info box pod Resolution v Seedance panelu: Dialogue lip-sync + Multi-shot syntax.

### 6. Bonus — R2V desc upgrade

`R2V · 9 imgs + 3 videos + 3 audio · 1080p · Video edit/extend (video refs 0.6×)`

---

## Deployment postup

### 1. Commit do GitHub repa

```bash
cd path/to/GIS-modules
cp <balíček>/src/video-models.js .
cp <balíček>/src/spending.js .
cp <balíček>/src/template.html .

git add -A
git commit -m "v204en: Seedance 2.0 1080p support + pricing refactor"
git push
```

### 2. Prod build test

```bash
node build.js 204en
```

Očekávaný výstup:
- `dist/gis_v204en.html`
- 24 modulů v logu
- ~27 270 řádků (baseline 27 226 + 44)
- Syntax check: `ReferenceError: window is not defined` = OK
- `✓ HTML div balance: OK (N pairs)`

### 3. Smoke test checklist

- [ ] Video model `Seedance 2.0 · T2V` → Resolution 3 volby (480p / 720p / 1080p)
- [ ] Přepnout na `Seedance 2.0 Fast · T2V` → 1080p volba zmizí, selected padne na 720p
- [ ] Pod Resolution viditelný prompt hint box
- [ ] Generate 5s 1080p T2V → spending +$3.40 (5s × $0.6804)
- [ ] Generate 5s 720p Fast R2V s video refem → +$0.726 (5s × $0.1452)
- [ ] Přepnout na Veo / Kling → hint box + Resolution se správně skryjí

---

## Co tato session NEřeší

- Cleanup session video subsystému (viz v203en CLEANUP_ANALYSIS.md, 11 oblastí)
- Session 2 — unified video panel
- Fast tier 1080p — až fal doplní, pak stačí přidat `1080p` do 3 fast entries + 2 nové spend keys
- Ostatní video modely refaktor pricing (součást Session 2)
