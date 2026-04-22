# GIS Session Handoff — v217en → další chat

**Datum:** 2026-04-22
**Aktuální verze:** v217en (stable)
**Worker:** gis-proxy v2026-16 (beze změny po celou Session 2)
**Build:** 24 192 JS řádků, 29 605 total, HTML netknuté (866 div pairs)

---

## 1. Kontext & Petrova specifikace layoutu

Projekt: **Generative Image Studio (GIS)** — single-file HTML aplikace pro AI image/video generování. Session 2 cíl: **unifikovat video panel UI** — všechny modely (Kling, Veo, PixVerse, Seedance, WAN, Grok, Luma, Vidu) mají stejné UI prvky na stejných místech, jen hodnoty se mění podle aktivního modelu.

### Petrova spec (platí jako zdroj pravdy)

**Pořadí sekcí v unified video panelu (shora dolů):**

1. **Sub-select / Mode** (Kling version, Veo refMode, Grok mode, PixVerse mode)
2. **Common header:**
   - Prompt
   - 🎨 Styles + 📷 Camera buttons (+ 📹 Model Camera Movement vedle)
   - Style + Camera tagy
   - **Negativní prompt** (rozbalovací 1 řádek, **těsně pod tagy, nad refs**)
   - Reference images
3. **Source slot** (pod refs — je to v podstatě další reference):
   - Source video (WAN 2.7e, V2V motion, Grok src, Topaz src)
   - Source audio (Seedance 2.0 audio URLs)
4. **"PARAMETERS"** plabel — *neskrývaný*, nadepisuje core params zone
5. **Core params** (stejný slot napříč modely, jen aktivní jeden visible):
   - Resolution (videoResInfoRow / veoResRow / lumaResRow / wanResRow / pixverseQualityRow / wan27Resolution)
   - Aspect ratio
   - CFG Scale
   - Duration
   - **Seed**
6. **Per-family advanced** (co zbyde po extrakci — minimálně viditelné)
7. **Count (videos)** — 1/2/3/4 radios
8. **Audio toggle** (🔊 ON/OFF)
9. **Bottom toggles** (pod Audio, nad Save to folder):
   - Multi-clip (pixverse)
   - Off-peak (pixverse)
   - (Multi-shots je to samé co multi-clip — WAN 2.6 má to jako separátní model variant)
10. **Save to folder** (videoTargetFolder) — mimo vpParams, v legacy psec
11. **Generate button**

**Důležité principy:**
- **Topaz & Magnific** — **NIKDY v unified**. Používají svoje vlastní legacy UI. `vpParams` je pro ně hidden.
- **Luma character ref** — trvale skryté (není funkční feature, ref weight sliders mají jít pod refs).
- **Camera move "Model camera"** — Petr chce jako další tlačítko vedle Styles/Camera; aktuálně je to přesunutý dropdown pod buttony (zatím pragmaticky).

---

## 2. Aktuální stav v217en

### Session 2 chronologie (pro kontext)

| Verze | Vrstva | Popis |
|---|---|---|
| v209en | 1 | Metadata unification v DB (reuseVideoJob restore) |
| v210en | 2 | Minimal unified prompt + mode sub-select (Kling/PixVerse/Vidu groups) |
| v211en | 3 | DOM přesun tags + refs + Styles/Camera buttons do vpParams |
| v212en | 4 | DOM přesun core params (aspect, CFG, duration, audio, count) |
| v213en | 5 | DOM přesun všech per-family advanced panelů |
| v214en | 5.1 | Veo/Grok mode panel nahoru (mode-first insert před prompt) |
| v215en | 5.2 | Neg prompt section + source slots + luma char ref skryt |
| v216en | 5.3 | Per-model resolution switchers → core params (ne per-family) |
| **v217en** | **5.4** | **Velká oprava layoutu dle spec** (neg prompt pozice, PARAMETERS label nad core, PixVerse extrakce, bottom toggles pod audio) |

### Strukturální přístup (důležité pro pochopení)

**Všechny změny jsou runtime JS — HTML je 100% netknutý.** Elementy se nepřejmenovávají ani nenahrazují, jen se **fyzicky přesouvají v DOM** přes `appendChild` / `insertAdjacentElement` / `insertBefore`. Zachování IDs znamená, že všechny existující handlery (onclick, onchange), render pipeliny (renderVideoRefPanel → videoRefPanelScroll) a value read/write v `generateVideo` fungují beze změny.

**Klíčové helpery v `video-models.js`:**

- `_vpEnsureDomMoves()` — one-time hlavní orchestrátor (flag `_vpDomMovesDone`). Provádí 10 kroků layout:
  1. Styles/Camera + AI button z videoPromptSec → vpPromptSection
  2. Common header: prompt → tagy → neg prompt → refs
  3. Source slots (wan27eSrcRow, videoV2VSection) po refs
  4. "Parameters" plabel přesun z legacy psec → vpParams nad core
  5. Core params (videoResInfoRow, veoResRow, lumaResRow, wanResRow, videoAspectRow, videoCfgRow, videoDurRow)
  6. Per-family panely (lumaVideoParams, pixverseParams, wan27vParams, wan27eParams, seedance2Params)
  6b. Mode-first (veoRefModeRow, grokVideoParams) insertBefore vpPromptSec
  7. `_vpExtractPerFamilyElements()` — extrakce PixVerse Quality/Camera/Seed
  8. Count appendChild
  9. Audio appendChild
  10. `_vpExtractBottomToggles()` — Multi-clip + Off-peak appendChild (na úplný konec)

- `_vpExtractPerFamilyElements()` — extrahuje per-family wrappers do unified slotů. Pattern: `moveWrapper(elId, newWrapperId, targetId, position)` kde position je `'after'` / `'before'` / `'appendChild'`. Najde element → jeho `.ctrl` wrapper → dá mu stable ID → přesune.

- `_vpExtractBottomToggles()` — appendChild per-family toggles na úplný konec vpParams.

- `_vpApplyUnifiedLayer(key, model)` — voláno na konci `_applyVideoModel` pro non-Topaz/Magnific. Ukáže vpParams, skryje legacy videoPromptSec, aplikuje mode sub-select pro KLING_GROUPS, volá `_vpUpdateNegPromptTarget()`, skryje lumaCharRefRow.

- `_vpEnsurePromptRedirect()` / `_vpEnsureNegPromptRedirect()` — Object.defineProperty / addEventListener pro sync mezi unified vpPrompt / vpNegPrompt a legacy fields (videoPrompt, pixverseNegPrompt, wan27vNegPrompt, wan27eNegPrompt).

- `_vpUpdateNegPromptTarget(key, model)` — mapuje aktivní model → cílový legacy neg prompt field ID; show/hide vpNegPromptSection.

### Aktuální pořadí elementů v vpParams (v217en)

```
vpParams:
├── SUB-SELECT
│   ├── vpModeSection           [groups: Kling/PixVerse/Vidu/Seedance2/WAN27/WAN26]
│   ├── veoRefModeRow           [Veo mode]
│   └── grokVideoParams         [Grok panel with mode-first]
│
├── COMMON HEADER
│   ├── vpPromptSection         [prompt + ✦ AI + Styles + Camera + pixverseCameraRow]
│   ├── videoTagsRow            [style + camera tagy]
│   ├── vpNegPromptSection      [collapsible neg prompt — sync PixVerse/WAN27/WAN27e]
│   └── videoRefSection         [refs panel]
│
├── SOURCE SLOTS
│   ├── wan27eSrcRow            [WAN 2.7e source video]
│   └── videoV2VSection         [V2V motion]
│
├── [PARAMETERS] plabel         [přesunutý z legacy psec, nadepisuje core]
│
├── CORE PARAMS
│   ├── videoResInfoRow         ← one of these 5 visible as Resolution
│   ├── veoResRow
│   ├── lumaResRow
│   ├── wanResRow
│   ├── pixverseQualityRow      [extrahováno z pixverseParams]
│   ├── videoAspectRow
│   ├── videoCfgRow
│   ├── videoDurRow
│   └── pixverseSeedRow         [extrahováno z pixverseParams]
│
├── PER-FAMILY ADVANCED
│   ├── lumaVideoParams         [Loop, HDR; charRef hidden]
│   ├── pixverseParams          [HIDDEN — extrahováno]
│   ├── wan27vParams            [neg prompt uvnitř synced; seed/res uvnitř — TODO extract]
│   ├── wan27eParams            [neg prompt uvnitř synced; seed/res/aspect uvnitř — TODO]
│   └── seedance2Params         [seed + audio URLs uvnitř — TODO extract]
│
├── COUNT               [videoCountRow]
├── AUDIO               [videoAudioCtrl 🔊]
└── BOTTOM TOGGLES
    ├── pixverseMultiClipRow
    └── pixverseOffPeakRow

MIMO vpParams (stále ve videoParamsLegacy psec):
  - [Topaz rows — hidden pro non-Topaz]
  - Save to folder (videoTargetFolder)

Generate Video button
```

---

## 3. Co zbývá udělat (prioritizovaný TODO)

### v218en — Seed extrakce pro ostatní rodiny

Stejný pattern jako PixVerse seed. Všechny přesunout do unified Seed slotu (po `videoDurRow`, nebo po `pixverseSeedRow`):

```js
// V _vpExtractPerFamilyElements přidat:
moveWrapper('wan27vSeed',   'wan27vSeedRow',   'videoDurRow', 'after');
moveWrapper('wan27eSeed',   'wan27eSeedRow',   'videoDurRow', 'after');
moveWrapper('grokSeed',     'grokSeedRow',     'videoDurRow', 'after');
moveWrapper('sd2Seed',      'sd2SeedRow',      'videoDurRow', 'after');
```

**Ověř IDs:** `grep 'id="grokSeed"\|id="wan27vSeed"\|id="wan27eSeed"\|id="sd2Seed"' /home/claude/src/template.html` — pokud některé ID neexistuje, model má vlastní ID (např. `sd2Seed` může být `seedance2Seed` atd.).

### v219en — Resolution extrakce pro WAN 2.7 / 2.7e / Grok

- **WAN 2.7**: najít resolution select/radio uvnitř wan27vParams. ID pravděpodobně `wan27Resolution` nebo `wan27vResolution`.
- **WAN 2.7e**: obdobně uvnitř wan27eParams.
- **Grok**: `grokVideoParams` má vlastní resolution select (uvnitř mode-first panelu). Pokud chceš Resolution nahoru do core, musíš Grok rozdělit (mode + source stay mode-first, resolution se přesune do core).

Přesunout do core Resolution slotu (`after pixverseQualityRow`).

### v220en — Seedance audio URLs jako source audio

- Seedance 2.0 má `sd2AudioUrl1`, `sd2AudioUrl2`, `sd2AudioUrl3` uvnitř seedance2Params (R2V section)
- Source audio má být **pod source video** (per spec "Totez source audio - hned pod video")
- Pattern: extrahovat 3 wrapper elementy → append po `videoV2VSection` (po source video slotu)

### v221en — Luma ref weight sliders pod refs

- lumaVideoParams obsahuje ref weight sliders (Luma Ray3 — charRef weight, atd.)
- Per spec: "Ref weight je slider ktery patri pod reference (nad parametry)"
- Extrahovat wrappers sliderů → append po `videoRefSection`

### v222en — Camera Movement jako tlačítko

Aktuálně je `pixverseCameraMove` jako dropdown pod Styles/Camera buttons. Petrova spec: "Muze se tam pridat dalsi menu 'Model camera move'" — znamená **tlačítko** vedle Styles/Camera, které otevírá overlay s výběrem camera moves (jako `toggleStylesOverlay`, `toggleCameraOverlay`).

**Implementace:**
1. Přidat button `📹 Model Camera` do buttons row vedle Styles/Camera (v `_vpEnsureDomMoves` manipulací DOM)
2. Vytvořit overlay modal s camera move options (podobně jako styles/camera overlays v styles.js)
3. Click → overlay; selection → set `pixverseCameraMove.value` + close

### v223en+ — WAN 2.7 negative prompt je už sync přes vpNegPrompt redirect

Ověřeno: `_vpUpdateNegPromptTarget` mapuje wan27_video → `wan27vNegPrompt` a wan27e_video → `wan27eNegPrompt`. Fungovat by mělo automaticky. Pokud ne, debug přes console.log aktivního target ID.

### Vrstva N — HTML Cleanup (po úspěšném smoke testu všech modelů)

Po ověření že všechno funguje → odstranit prázdné legacy shells z `template.html`:
- `#videoPromptSec` — už jen textarea uvnitř, vše extrahováno
- `#vpTagsRow`, `#vpNegPromptSection` shell (původní prázdné placeholdery — možná zachovat pokud jsou využívané, ověřit)
- `#vpCoreParams`, `#vpLumaAdvanced`, `#vpPixverseAdvanced`, `#vpTopazAdvanced`, `#vpMagnificAdvanced` — původní placeholdery, nevyužívané
- `#pixverseParams` — prázdný shell po extrakci, hidden

### Mimo Session 2 — rozvojový roadmap

- **Topaz / Magnific reuse** (přidání params do jejich job objektů — aktuálně nepodporují reuse)
- **Seedance 2.0 I2V universal prompt block** — bug kde všechny prompty selhávají (pravděpodobně base64 data URI nesupportováno pro I2V → nutný fal storage upload)
- **Style Library "My Presets"** — user-defined style combos
- **Claid.ai** — nová AI enhancement služba přes proxy
- **Hailuo 2.3** — upgrade z 2.2
- **Use V2V** — Seedance R2V workflow
- **Runway Gen-4** — research only (gen4_image, gen4.5, gen4_turbo, gen4_aleph, veo3/3.1)

---

## 4. Workflow pro další chat

### Při startu session

```bash
# 1. Načti STAV.md (aktuální stav + TODO)
cat /mnt/project/STAV.md  # nebo poslední verze z uploads

# 2. Ověř konzistenci /mnt/project/
head -10 /mnt/project/STAV.md  # datum + version
grep "v217en\|v216en" /mnt/project/video-models.js | head

# 3. Pokud /mnt/project/ je aktuální (v217en), zkopíruj moduly do workspace
mkdir -p /home/claude/src
cp /mnt/project/*.js /home/claude/src/
cp /mnt/project/template.html /home/claude/src/
cp /mnt/project/build.js /home/claude/
```

### Build + syntax check (opakovat po každé změně)

```bash
cd /home/claude && node build.js NNNen 2>&1 | tail -6
awk '/^<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' \
  /home/claude/dist/gis_vNNNen.html > /tmp/check.mjs && \
node --check /tmp/check.mjs 2>&1 | head -5
# OK = "exit: 0" + "✓ HTML div balance: OK"
```

### Output + handoff

```bash
rm -f /mnt/user-data/outputs/*
cp /home/claude/dist/gis_vNNNen.html /mnt/user-data/outputs/
cp /home/claude/src/video-models.js  /mnt/user-data/outputs/
# + STAV.md update
# + present_files s paths
```

### Critical rule

**MEZI FÁZEMI session volej `present_files` — workspace `/home/claude/` persistuje jen v rámci jedné chat session, ale ne mezi chat sessions.** Petr potřebuje stažení souborů, takže po každé logické změně: build → save outputs → present_files → commit vědomé „hotovo, next step?".

---

## 5. Klíčové gotchas & lessons learned

### DOM move pattern
- `insertAdjacentElement('afterend', X)` vloží X HNED za target (takže cykly s tím pattern vkládají v reverzním pořadí)
- `appendChild(X)` posouvá X na konec — i když už je dítě, přesune se na konec (ne clone!)
- Po DOM move `elementA.closest('.ctrl')` stále funguje protože wrapper se neodstranil
- Po DOM move `_applyVideoModel`-style `_setRow(id, show)` funguje (ID zůstává)

### Object.defineProperty redirect
- `videoPrompt.value` redirect na `vpPrompt.value` funguje pro all read/write sites
- Funguje i pro AI prompt generation (setters), style tag inserts, rewriteVideoPromptForModel
- **NEPOUŽÍVÁT** pro per-family fields (např. pixverseNegPrompt) — tam je lepší addEventListener input listener s dynamic target switch

### Per-family wrapper extrakce
```js
const el = document.getElementById('pixverseQuality');  // core element
const wrapper = el.closest('.ctrl');                    // its .ctrl parent
if (!wrapper.id) wrapper.id = 'pixverseQualityRow';     // stable ID
target.insertAdjacentElement('afterend', wrapper);      // move
```

### _vpDomMovesDone flag
- Volán v Topaz/Magnific branchích `_applyVideoModel` na začátku (aby se přesuny provedly i když user startuje s Topaz modelem)
- Aby nedošlo k opakovanému přesunu

### videoParamsLegacy psec
- Runtime pojmenování přes `veoResRowEl.closest('.psec').id = 'videoParamsLegacy'` (musí proběhnout PŘED přesunem veoResRow)
- Psec musí zůstat **visible** pro všechny modely (obsahuje Save to folder)
- Plabel "Parameters" z této psec se přesouvá do vpParams (nad core) — ne skrývá!

### Topaz & Magnific
- **NIKDY** v unified. vpParams pro ně hidden. videoPromptSec taky hidden (nemají prompt).
- videoParamsLegacy **visible** (Topaz rows + Save to folder).
- topazSrcRow je reused pro Magnific (source video picker).

### Build integrity
- `node build.js NNNen` validuje HTML div balance (866 pairs v v217en)
- Pokud fail → `✗ HTML div balance: X open vs Y close` — něco je rozbité
- Extracted script `node --check` chytá JS syntax errors
- Test "exit: 0" + "window is not defined" → script OK (window je reference na globál, který v Node neexistuje, to je OK)

### Co NEFUNGUJE
- `pixverseCameraMove` select je v HTML `disabled` pro C1 (C1 pending). User vidí ale nemůže použít. Odstranit `disabled` v HTML až bude API ready.
- Camera Movement select/button rozdíl — zatím dropdown pod Styles/Camera; budoucí button s overlay.
- Extrahovaný `pixverseCameraMove` je visible i když model není PixVerse — per spec by měl být visible pro všechny (jako unified "Model Camera" slot), ale option "None" default je vždy bezpečná.

---

## 6. Kontext navázání

### Struktura modulů (25)

```
src/
├── models.js
├── styles.js
├── setup.js
├── spending.js
├── model-select.js
├── assets.js
├── refs.js
├── generate.js
├── fal.js
├── output-placeholder.js
├── proxy.js
├── gemini.js
├── output-render.js
├── db.js
├── gallery.js
├── toast.js
├── paint.js
├── ai-prompt.js
├── gpt-edit.js
├── xai-video.js
├── video-models.js      ← Session 2 modifications here
├── video-queue.js        ← Session 2 (v209en metadata merge)
├── video-gallery.js      ← Session 2 (v209en reuseVideoJob restore)
├── video-topaz.js
├── video-utils.js
├── video-archive.js
└── template.html
```

### Build konfigurace

```
module order (fixed):
  models → styles → setup → spending → model-select → assets → refs →
  generate → fal → output-placeholder → proxy → gemini → output-render →
  db → gallery → toast → paint → ai-prompt → video-{models,queue,gallery,topaz,utils,archive}
```

`build.js` concat všechny + inline do template.html → `dist/gis_vNNNen.html`. Také validuje HTML div balance za běhu.

### Worker (beze změny)

Cloudflare Workers gis-proxy v2026-16. Deploy z Petrova PC: `cd C:\Users\Petr\Documents\gis-proxy && npm run deploy`. Handler pro fal.ai video je `handlers/fal-inpaint.js` (NE fal.js — tradiční source of confusion).

---

## 7. Citace z Petrových zpráv (zdroj pravdy)

> Poradi sekci:
> * sub select
> * Common header - sem se presune i negativni prompt (pod styles/camera, nad reference). Pouzij vzor z images 1 radek rozbalovaci. Pouziva se malo ale musi byt u promptu.
> * Source video - hned pod reference je to v podstate take reference. Totez source audio - hned pod video.
> * Core params - Poradi Resolution, Aspect, CFG, Duration, seed
> * Individualni parametry:
> * veci jako camera move patri pod prompt - mame tam nasi Cameru. Muze se tam pridat dalsi menu "Model camera move"
> * charakter ref je obycejna reference - ani to u lumy nemame zobrazene. Ref weight je slider ktery patri pod reference (nad parametry)
> * Multiclip a off peak jsou prepinace dole pod poctem generovanych videi hned nad save to folder
> * Multi shots je to same co multiclip
> * Topaz a Magnific nechej jak jsou - to jsou uplne jine modely

> negativni prompt tesne pod tagy, nad reference

> napis parameters neskryt. Jen nama byt dole ale pod referencemi - nadepisuje oblast parametru

> off peak mode u pixverse je dole na konci parametru - nad save to folder - pod audio on

> Tenhle panel ma byt unifikovany. To znamena stejne veci budou na stejnych mistech u vsech modelu.

---

## 8. Verifikační checklist (při testování další verze)

Per model-family, zkontroluj:

- [ ] **Kling V3 / O3 / 2.5 / 1.6 / 16** — mode select nahoře, prompt/tagy/refs, CFG + Duration + aspect, Count + Audio
- [ ] **Veo 3.1 / Fast** — refMode nahoře (T2V/I2V/Frames/Ingredients), Resolution 720/1080/4K v core
- [ ] **PixVerse C1 / V6** — mode select nahoře, Quality v core (ne dole), Camera Movement pod Styles/Camera, Neg prompt pod tagy, Seed v core, Multi-clip + Off-peak dole pod audio
- [ ] **Vidu Q3** — mode select (T2V/I2V/Frames), základní params
- [ ] **Seedance 2.0 Std / Fast** — mode select, seedance2Params (audio URLs + seed uvnitř — zatím TODO extract)
- [ ] **WAN 2.7 T2V/I2V/R2V** — mode select, neg prompt synced, seed uvnitř (TODO extract)
- [ ] **WAN 2.7e Video Edit** — wan27eSrcRow source, neg prompt, seed uvnitř (TODO)
- [ ] **WAN 2.6** — mode select, wanResRow v core, multi-shots volen přes separátní model variant (nepotřebuje toggle)
- [ ] **Grok** — grokVideoParams nahoře (mode + dur + res + src), zbytek core/count/audio
- [ ] **Luma Ray2 / Ray3 / Ray3.14** — lumaResRow v core, lumaVideoParams (loop/HDR; charRef hidden), ref weight sliders (TODO přesun pod refs)
- [ ] **V2V modely** (Kling V2V, Seedance V2V, WAN 2.7 V2V) — videoV2VSection source pod refs
- [ ] **Topaz** — UI beze změny (vpParams hidden, topaz rows visible)
- [ ] **Magnific** — UI beze změny (vpParams hidden, magnificVidOpts visible)

Verifikační akce pro každý model:
1. Přepnout na model v dropdownu
2. Ověřit visible sekce jsou na správných místech (Resolution pod aspect? Seed po duration? Audio dole? Multi-clip pod audio?)
3. Ověřit funkčnost (prompt input, AI prompt, Styles/Camera click, tagy click insert, refs upload, generate click → submitted)
4. Reuse video z gallery → parametry se obnoví

---

**Konec handoff. Další chat: začít od STAV.md v217en a pokračovat s v218en (seed extrakce pro WAN 2.7/2.7e/Grok/Seedance).**
