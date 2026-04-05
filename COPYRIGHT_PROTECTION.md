# GIS — COPYRIGHT & INTEGRITY PROTECTION
*Dokument vytvořen v181en · 5. 4. 2026*

Tento dokument přesně popisuje kde a jak je copyright v kódu implementován,
aby mohl být správně zachován při architektonických refaktorech.

> **Důležité:** Žádný z níže popsaných bloků nemá vliv na funkčnost programu.
> Jsou to čistě ochranné a identifikační prvky. Při přepisu modulů je nutné
> je aktivně přenést — nedojde k žádné chybě, pokud chybí, ale program přestane
> správně identifikovat autora a integrity checky přestanou fungovat.

---

## 1. Definice identity — `src/models.js`

**Umístění:** Řádky 6–7, hned za hlavičkovým komentářem, před `const MODELS`.

```javascript
// ── Application identity ──────────────────────────────
const GIS_COPYRIGHT = 'Generative Image Studio \u00a9 2026 Petr Sajner. All rights reserved.';
const _GIS_SIG = btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20);
// ─────────────────────────────────────────────────────
```

**Vysvětlení:**
- `GIS_COPYRIGHT` — čitelný řetězec s celým autorstvím. Rok aktualizovat každý rok.
- `_GIS_SIG` — hash: base64 UTF-8 encode celého stringu, prvních 20 znaků. Výsledek je deterministický: `R2VuZXJhdGl2ZSBJ`. Nikdy se nemění pokud se nemění text GIS_COPYRIGHT.
- Obě konstanty jsou globální (bez `let`/`var` = window scope) → dostupné ze všech dalších modulů.
- `models.js` je **první modul** v build pořadí — definice musí být vždy zde.

**Aktuální hodnota `_GIS_SIG`** (pro ověření):
```
btoa(unescape(encodeURIComponent('Generative Image Studio © 2026 Petr Sajner. All rights reserved.'))).slice(0, 20)
// = "R2VuZXJhdGl2ZSBJ..."  (prvních 20 znaků base64)
```

---

## 2. Integrity checks — 4 klíčové funkce

Každý check má tuto přesnou strukturu:

```javascript
if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
    _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
  // ... akce při selhání
}
```

**Co check dělá:**
1. Ověří, že obě konstanty existují (`typeof ... === 'undefined'` chrání i před smazáním)
2. Přepočítá hash z `GIS_COPYRIGHT` a porovná ho s `_GIS_SIG`
3. Pokud se neshodují (nebo chybí), zablokuje akci

---

### 2a. `src/generate.js` — funkce `addToQueue()`

**Umístění:** Začátek funkce `addToQueue`, přibližně řádek 201.

```javascript
function addToQueue(jobData) {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    throw new Error('Application integrity check failed. Please use the original GIS.');
  }
  // ... zbytek funkce
```

**Efekt při selhání:** `throw` — generování se nespustí, chyba se vypíše do konzole.
**Proč zde:** `addToQueue()` je centrální vstupní bod pro všechna generování obrazků. Každý klik na Generate projde touto funkcí.

---

### 2b. `src/db.js` — funkce `saveToGallery()`

**Umístění:** Začátek funkce `saveToGallery`, přibližně řádek 195.

```javascript
async function saveToGallery(result, prompt, targetFolder, refsCopy, rawPrompt, batchMeta) {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    throw new Error('Application integrity check failed. Please use the original GIS.');
  }
  // ... zbytek funkce
```

**Efekt při selhání:** `throw` — vygenerovaný obrázek se neuloží do galerie.
**Proč zde:** Každý výsledný obrázek (bez ohledu na model) prochází `saveToGallery()` před uložením do IndexedDB.

---

### 2c. `src/gallery.js` — funkce `renderGallery()`

**Umístění:** Začátek funkce `renderGallery`, přibližně řádek 154.

```javascript
async function renderGallery() {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    document.getElementById('galGrid')?.insertAdjacentHTML('afterbegin',
      '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#c05050;font-family:\'IBM Plex Mono\',monospace;font-size:11px;">Application integrity check failed. Please use the original GIS.</div>');
    return;
  }
  // ... zbytek funkce
```

**Efekt při selhání:** Galerie se nezobrazí, místo toho červená chybová zpráva v `#galGrid`.
**Proč zde:** `renderGallery()` je voláno při každém otevření galerie a při startu aplikace. Jde o nejviditelnější místo pro uživatele.

---

### 2d. `src/video.js` — funkce `generateVideo()`

**Umístění:** Začátek funkce `generateVideo`, přibližně řádek 1410.

```javascript
async function generateVideo() {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    toast('Application integrity check failed. Please use the original GIS.', 'err');
    return;
  }
  // ... zbytek funkce
```

**Efekt při selhání:** `toast` (červená notifikace) + `return` — video generování se nespustí.
**Proč zde:** Symetrický pendant k `addToQueue()` pro video větev.

---

## 3. Viditelný copyright v UI — `src/template.html`

### 3a. Watermark — Image Output Area (řádek ~2771)

```html
<!-- Copyright watermark — bottom-right corner -->
<div id="gisWatermark" style="position:absolute;bottom:14px;right:18px;pointer-events:none;z-index:1;text-align:right;line-height:1.55;">
  <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(255,255,255,.60);letter-spacing:.04em;">Generative Image Studio</div>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(255,255,255,.50);letter-spacing:.03em;">© 2026 Petr Sajner · info.genimagestudio@gmail.com</div>
</div>
```

**Umístění v DOM:** Uvnitř `#center` (hlavní output area), absolutně pozicovaný vpravo dole.
**Viditelnost:** Trvale viditelný v output oblasti, zprůhledněný ale čitelný.

---

### 3b. Watermark — Video Output Area (řádek ~2787)

```html
<!-- Copyright watermark — bottom-right corner -->
<div style="position:absolute;bottom:14px;right:18px;pointer-events:none;z-index:1;text-align:right;line-height:1.55;">
  <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(255,255,255,.60);letter-spacing:.04em;">Generative Image Studio</div>
  <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:rgba(255,255,255,.50);letter-spacing:.03em;">© 2026 Petr Sajner · info.genimagestudio@gmail.com</div>
</div>
```

**Umístění v DOM:** Uvnitř `#videoCenter` (video output area), absolutně pozicovaný vpravo dole.
**Poznámka:** Identický obsah jako 3a, jiný parent container.

---

### 3c. Copyright karta — Setup tab (řádek ~3180)

Kompletní karta v pravém panelu Setup tabu:

```html
<!-- Right: copyright card — floats centered in remaining black space -->
<div style="flex:1; display:flex; align-items:center; justify-content:center; padding:32px; pointer-events:none;">
  <div style="pointer-events:all; width:100%; max-width:340px;">
    <div style="border:1px solid rgba(212,160,23,.22); background:linear-gradient(135deg,rgba(212,160,23,.05) 0%,rgba(0,0,0,0) 60%); padding:24px 26px; position:relative; overflow:hidden;">
      <!-- decorative corner glyph -->
      <div style="position:absolute;top:14px;right:18px;font-size:32px;opacity:.08;font-family:'Syne',sans-serif;font-weight:700;pointer-events:none;">◈</div>
      <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;color:var(--accent);letter-spacing:.04em;margin-bottom:3px;">Generative Image Studio</div>
      <div style="font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:16px;">AI Image & Video Production Tool</div>
      <div style="font-size:12px;color:var(--text);font-weight:500;margin-bottom:12px;">Petr Sajner</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <a href="mailto:info.genimagestudio@gmail.com" ...>✉ info.genimagestudio@gmail.com</a>
        <a href="https://www.linkedin.com/in/sajner/" ...>in linkedin.com/in/sajner</a>
      </div>
      <div style="margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.1);font-size:11px;color:rgba(255,255,255,.45);font-family:'IBM Plex Mono',monospace;letter-spacing:.03em;">
        © 2026 Petr Sajner · All rights reserved
      </div>
    </div>
  </div>
</div>
```

**Umístění v DOM:** Druhý sloupec (flex:1) uvnitř `#setupView` layoutu.
**Layout:** Setup je `display:flex; flex-direction:row`. Levý sloupec = API keys (680px), pravý sloupec = tato karta (flex:1). Karta je vertikálně a horizontálně centrována v pravé části.

---

## 4. Přehled všech výskytů

| # | Soubor | Řádek (approx.) | Typ | Akce při selhání |
|---|--------|-----------------|-----|-----------------|
| 1 | `src/models.js` | 6–7 | Definice konstant | — (definice, ne check) |
| 2 | `src/generate.js` | ~201–203 | Integrity check | `throw` — generování se nespustí |
| 3 | `src/db.js` | ~195–197 | Integrity check | `throw` — obrázek se neuloží |
| 4 | `src/gallery.js` | ~154–157 | Integrity check | Červená hláška, gallery prázdná |
| 5 | `src/video.js` | ~1410–1412 | Integrity check | `toast` error, video se nespustí |
| 6 | `src/template.html` | ~2771–2776 | UI watermark | Viditelný v Image output area |
| 7 | `src/template.html` | ~2787–2792 | UI watermark | Viditelný ve Video output area |
| 8 | `src/template.html` | ~3180–3210 | UI karta | Zobrazena v Setup tabu |

---

## 5. Rok v copyrightu — kdy aktualizovat

Všechna místa kde se rok mění **ručně**:

| Soubor | Řádek | Co změnit |
|--------|-------|-----------|
| `src/models.js` | 6 | `'Generative Image Studio © 2026 Petr Sajner...'` → změnit rok |
| `src/template.html` | ~2774 | `© 2026 Petr Sajner` (image watermark) |
| `src/template.html` | ~2790 | `© 2026 Petr Sajner` (video watermark) |
| `src/template.html` | ~3203 | `© 2026 Petr Sajner` (Setup karta) |

**Poznámka:** `_GIS_SIG` se přepočítá automaticky, protože závisí na `GIS_COPYRIGHT`. Stačí změnit rok v `GIS_COPYRIGHT` a hash se automaticky aktualizuje. Integrity checky v ostatních modulech neobsahují rok — pouze porovnávají hash.

---

## 6. Checklist pro architektonický refaktor

Při přepisu nebo přesunutí modulů ověřit:

- [ ] `models.js` je stále **první** v build pořadí
- [ ] `GIS_COPYRIGHT` a `_GIS_SIG` jsou stále na řádcích 6–7 v `models.js`
- [ ] Integrity check v `generate.js` → `addToQueue()` — na začátku funkce, před jakoukoli logikou
- [ ] Integrity check v `db.js` → `saveToGallery()` — na začátku funkce, před `const params`
- [ ] Integrity check v `gallery.js` → `renderGallery()` — na začátku funkce
- [ ] Integrity check v `video.js` → `generateVideo()` — na začátku funkce
- [ ] Oba watermark divy v `template.html` — v `#center` a v `#videoCenter`
- [ ] Copyright karta v Setup tabu — pravý flex sloupec `#setupView`

---

## 7. Rozhodnutí o designu ochrany

**Proč 4 místa, ne jedno:**
Každé místo blokuje jinou cestu: generování obrazků, ukládání výsledků, zobrazení galerie, video generování. Smazání jediného modulu nestačí k obejití všech čtyř.

**Proč hash místo plain string porovnání:**
`_GIS_SIG !== GIS_COPYRIGHT` by bylo triviálně obejitelné změnou jedné konstanty. Hash přes btoa/encodeURIComponent přidává jeden krok navíc.

**Proč `typeof === 'undefined'` místo `!_GIS_SIG`:**
Pokud konstanta neexistuje, JavaScript vyhodí `ReferenceError` při přímém přístupu. `typeof` test je bezpečný i pro nedefinované proměnné.

**Proč ne obfuskace:**
Záměrně čitelný kód. Cílem není technicky znemožnit obejití, ale vytvořit jasnou identifikaci vlastnictví a deterenci pro případ redistribuce bez souhlasu.
