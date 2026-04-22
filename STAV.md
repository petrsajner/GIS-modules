# STAV.md — Generative Image Studio

## Aktuální verze: v217en (stable — layout podle Petrovy spec)
## Příští verze: v218en (seed extrakce pro WAN 2.7/2.7e/Grok/Seedance)
## Datum: 2026-04-22
## Worker verze: 2026-16

---

## Co je v v217en (oproti v216en)

### ✅ Velká restrukturalizace dle původní Petrovy specifikace

**Opravené chyby proti v216en:**

1. **Negativní prompt** — nyní `prompt → tagy → NEG PROMPT → refs` (dřív jsem ho omylem dal pod prompt před tagy).

2. **"PARAMETERS" plabel — přesunut, NEskrývaný** — dřív jsem ho trvale skryl (display:none). Nyní:
   - Plabel je extrahován z legacy Parameters psec
   - Přesunut do vpParams **nad core params** (= labeluje "Resolution, Aspect, CFG, Duration" sekci)
   - Legacy Parameters psec zůstává visible (obsahuje Save to folder)

3. **Bottom toggles (multi-clip, off-peak)** pod audio — dřív byly před Count. Nyní:
   - `appendChild` na vpParams po Count + Audio → padají na samé dno
   - Výsledek: `... → Count → Audio → Multi-clip → Off-peak → (Save to folder vně vpParams)`

4. **PixVerse extrakce dokončená** — Quality, Camera Move, Seed, Multi-clip, Off-peak všechny přesunuty do unified slotů. `pixverseParams` (prázdný shell po extrakci) skryt.

5. **Negativní prompt sync** přes `vpNegPrompt` redirect pro PixVerse / WAN 2.7 / WAN 2.7e (z v215en).

6. **Luma character ref** trvale skryt (z v215en).

### Nové pořadí v vpParams (finálně podle spec)

```
vpParams:
├── STEP 1 — Sub-select (mode):
│   ├── vpModeSection           (Kling/PixVerse/Vidu/Seedance2/WAN27/WAN26 groups)
│   ├── veoRefModeRow           (Veo mode — mode-first insert)
│   └── grokVideoParams         (Grok panel — mode-first insert)
│
├── STEP 2 — Common header:
│   ├── vpPromptSection         (prompt + ✦ AI + 🎨 Styles + 📷 Camera + 📹 Model Camera [extract])
│   ├── videoTagsRow            (style + camera tagy)
│   ├── vpNegPromptSection      (neg prompt — TĚSNĚ POD TAGY, NAD REFS)
│   └── videoRefSection         (refs panel)
│
├── STEP 3 — Source slots:
│   ├── wan27eSrcRow            (WAN 2.7e source video)
│   └── videoV2VSection         (V2V motion source)
│
├── STEP 4 — "PARAMETERS" plabel (přesunut z legacy psec)
│
├── STEP 5 — Core params:
│   ├── videoResInfoRow         ← jeden z těchto 5 je vždy visible (Resolution slot)
│   ├── veoResRow
│   ├── lumaResRow
│   ├── wanResRow
│   ├── pixverseQualityRow      (extrakce z pixverseParams)
│   ├── videoAspectRow
│   ├── videoCfgRow
│   ├── videoDurRow
│   └── pixverseSeedRow         (extrakce z pixverseParams — Seed slot)
│
├── STEP 6 — Per-family advanced (hidden panels / just desc):
│   ├── lumaVideoParams         (Loop, HDR; char ref hidden; ref weight TODO)
│   ├── pixverseParams          (skryt — po extrakci prázdný)
│   ├── wan27vParams            (WAN 2.7 advanced)
│   ├── wan27eParams            (WAN 2.7e advanced)
│   └── seedance2Params         (audio URLs + seed uvnitř — extrakce TODO)
│
├── STEP 7 — Count
├── STEP 8 — Audio toggle
└── STEP 9 — Bottom toggles:
    ├── pixverseMultiClipRow    (extrakce z pixverseParams)
    └── pixverseOffPeakRow      (extrakce z pixverseParams)
```

Pod tím zůstává **mimo vpParams**:
```
videoParamsLegacy (psec, visible):
  ["Parameters" plabel byl přesunut pryč — tato psec má už jen]
  topazResRow, topazFactorRow, topazFpsRow, topazSlowmoRow, topazCreativityRow  (hidden pro non-Topaz)
  Save to folder (videoTargetFolder)

Generate Video button
```

### Topaz / Magnific — beze změny

- `vpParams` hidden → všechny přesunuté elementy nejsou viditelné
- `videoParamsLegacy` visible s Topaz rows (Topaz) nebo jen Save to folder (Magnific)

### Build stats (v217en)

- **25 modulů** (beze změny)
- **24 192 JS řádků** (+71 oproti v216en)
- **29 605 total lines** (+71)
- `✓ HTML div balance: OK (866 pairs)` (HTML netknuté)
- `node --check` → OK

### Změněné moduly

| Modul | Status | Popis |
|---|---|---|
| `video-models.js` | upraven | +71 ř.: Kompletní přepis `_vpEnsureDomMoves` (10 kroků) + `_vpExtractPerFamilyElements` + nový `_vpExtractBottomToggles` + oprava videoParamsLegacy visibility v Magnific a _vpApplyUnifiedLayer |

---

## Příklad: PixVerse C1 UI po v217en

```
[Sub-select: "V6 T2V" / "V6 I2V" / ...]         (vpModeSection)
[Prompt: "A tarot card coming to life..."]      (vpPromptSection)
[🎨 Styles] [📷 Camera]                         (přesunuté buttons)
[📹 Camera Movement dropdown (disabled C1)]     (pixverseCameraMove extrakce)
[Style tagy] [Camera tagy]                      (videoTagsRow)
[Negative Prompt ▸]                             (vpNegPromptSection - sync s pixverseNegPrompt)
[REFERENCE IMAGES 0/1]                          (videoRefSection)
[↑ Add ref tile]

PARAMETERS                                      (plabel přesunutý z legacy psec)
Quality: 720p                                   (pixverseQuality extrahovaný)
Aspect: 16:9 Landscape
CFG: 0.5
Duration: 5s
Seed: 42                                        (pixverseSeed extrahovaný)

Count: [1] 2 3 4
[🔊 AUDIO ON]
☐ Multi-clip (cuts & camera changes)            (pixverseMultiClip extrahovaný)
☐ Off-peak mode (~50% cheaper)                  (pixverseOffPeak extrahovaný)

Save to folder: ◈ All (no folder)

[▶ Generate Video]
```

---

## Co zbývá (další iterace)

### v218en — Seed extrakce pro ostatní rodiny
- `wan27vSeed` → unified Seed slot (po pixverseSeedRow)
- `wan27eSeed` → unified Seed slot
- `grokSeed` (uvnitř grokVideoParams)
- `sd2Seed` (uvnitř seedance2Params)

### v219en — WAN 2.7 resolution extrakce
- `wan27Resolution` → unified Resolution slot

### v220en — Seedance audio URLs jako source audio
- `sd2AudioUrl1`, `sd2AudioUrl2`, `sd2AudioUrl3` → source audio slot pod source video

### v221en — Luma ref weight sliders pod refs
- lumaVideoParams má ref weight sliders uvnitř → přesun pod refs

### Vrstva N — Cleanup
Po úspěšném testu: odstranění prázdných legacy shells z HTML (`videoPromptSec`, `pixverseParams`, atd.)

---

## Mimo Session 2

- Topaz/Magnific reuse support
- Seedance 2.0 I2V universal prompt block bug
- Style Library "My Presets"
- Claid.ai via proxy
- Hailuo 2.3 upgrade
- Use V2V (Seedance R2V)
- Runway Gen-4 (research)
