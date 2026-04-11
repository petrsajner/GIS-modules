# GIS — STAV PROJEKTU
*Aktualizováno konec session · 10. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v192en.html | 10. 4. 2026 |
| Worker | gis-proxy v2026-11 | 9. 4. 2026 |

**Příští verze:** v193en

> Build: `cd /home/claude && node build.js 193en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "paint.js — inpaintQueue:" && grep -c "inpaintQueue" /mnt/project/paint.js && \
echo "paint.js — openInpaintFromNav:" && grep -c "openInpaintFromNav" /mnt/project/paint.js && \
echo "paint.js — qo-item:" && grep -c "qo-item" /mnt/project/paint.js && \
echo "paint.js — maskBlur:" && grep -c "maskBlur" /mnt/project/paint.js && \
echo "fal.js — _runSimpleInpaint:" && grep -c "_runSimpleInpaint" /mnt/project/fal.js && \
echo "fal.js — callFluxFill opts:" && grep -c "opts = {}" /mnt/project/fal.js && \
echo "gallery.js — _mzScale:" && grep -c "_mzScale" /mnt/project/gallery.js && \
echo "gallery.js — mInpaintRefBtn:" && grep -c "mInpaintRefBtn" /mnt/project/gallery.js && \
echo "template.html — inpaintNavTab:" && grep -c "inpaintNavTab" /mnt/project/template.html && \
echo "template.html — src-chip:" && grep -c "src-chip" /mnt/project/template.html && \
echo "template.html — inpaintQueueList:" && grep -c "inpaintQueueList" /mnt/project/template.html && \
echo "model-select.js — setup:6:" && grep -c "setup: 6" /mnt/project/model-select.js && \
echo "setup.js — getProxyUrl:" && grep -c "getProxyUrl" /mnt/project/setup.js && \
echo "setup.js — _arrayBufferToBase64:" && grep -c "_arrayBufferToBase64" /mnt/project/setup.js && \
echo "video.js — _saveVideoResult:" && grep -c "_saveVideoResult" /mnt/project/video.js && \
echo "video.js — _falVideoSubmitPollDownload:" && grep -c "_falVideoSubmitPollDownload" /mnt/project/video.js && \
echo "video.js — _srcSlotClear:" && grep -c "_srcSlotClear" /mnt/project/video.js && \
echo "db.js — assets_meta:" && grep -c "assets_meta" /mnt/project/db.js && \
echo "spending.js — openrouter:" && grep -c "openrouter" /mnt/project/spending.js && \
echo "ai-prompt.js — ETM_REFRAME_KNOWLEDGE:" && grep -c "ETM_REFRAME_KNOWLEDGE" /mnt/project/ai-prompt.js && \
echo "ai-prompt.js — _etmRefAnalyses:" && grep -c "_etmRefAnalyses" /mnt/project/ai-prompt.js && \
echo "ai-prompt.js — _etmParseVariants:" && grep -c "_etmParseVariants" /mnt/project/ai-prompt.js && \
echo "template.html — editToolModal:" && grep -c "editToolModal" /mnt/project/template.html && \
echo "template.html — specialToolModal:" && grep -c "specialToolModal" /mnt/project/template.html
```
Vše musí vrátit ≥ 1.

> **Syntax check:**
> ```bash
> awk '/<script>$/{found=1;next} found && /^<\/script>/{exit} found{print}' \
>   /home/claude/dist/gis_v193en.html > /tmp/check.mjs
> node --input-type=module < /tmp/check.mjs 2>&1 | head -3
> # OK = "window is not defined"
> ```

---

## Kde jsme přestali

v192en dokončen. Session ukončena čistě 10. 4. 2026.

**v192en = Edit Tool + Special Tool + Camera Reframe Research**

---

## Co bylo uděláno dnes (10. 4. 2026)

### v192en — Edit Tool, Special Tool, Camera Reframe

**Nové UI prvky:**
- **◆ Special** tlačítko (červenofialové) + **✎ Edit** tlačítko (tmavě zelené) přidány do řádku Prompt vedle AI Prompt — v image i video mode.
- Oba buttony mají CSS classes `.btn-special` a `.btn-edit` s hover/active stavy.

**◆ Special Tools Modal (`#specialToolModal`):**
- Placeholder modal s 3 budoucími tooly:
  1. 👤 Character Sheet — multi-angle identity sheet (disabled)
  2. 🎬 Character Coverage — 10 shots, all angles (disabled)
  3. 🏛 Environment Coverage — 10 views, 360° (disabled)
- Tyto tooly budou založeny na výzkumu camera reframe z této session.

**✎ Edit Tool Modal (`#editToolModal`):**
- Plně funkční AI agent pro generování editačních promptů.
- Design konzistentní s AI Prompt modalem (`.etm-*` CSS prefix).
- Header: název + model selector (NB2, NB Pro, Flux 2 Pro/Dev, Seedream 5/4.5) + model badge.
- Chat oblast + reference preview vpravo.
- Status line: `analyzing` (red blink) → `READY` (green) → `thinking` (red blink).
- "↺ New chat" pro tvrdý reset (re-analyzuje reference).
- "↗ Use as Prompt" odešle vybraný prompt do hlavního textarea.
- Session persistence — zavření a znovuotevření zachová konverzaci.

**Edit Tool — AI Agent architektura:**

*Unified intelligent agent* s automatickou klasifikací editací:

**TYPE A — Element Edit:**
- Agent mění jen to co uživatel řekl. Žádné vymýšlení detailů.
- Keep section: neutrální jména elementů ("lighting", ne "golden hour lighting").
- Model-specific prompt struktury (Gemini krátký <60 slov, Flux verbose, Seedream stručný).
- Multi-reference awareness: agent ví co je v každé referenci (barva, maska, úhel...) a umí na ně odkazovat v promptu.

**TYPE B — Camera Reframe:**
- Agent generuje **4 varianty** s různými strategiemi (viz DECISIONS.md).
- Varianty zobrazeny jako klikací karty se zeleným border a badge.
- Každá varianta tagována `[REFS:1]` nebo `[REFS:1,2]` — UI varuje při přebytečných referencích.
- Pokud existuje druhá reference, agent ji analyzuje pro lepší prostorové pochopení, ale doporučuje ji odeslat generativnímu modelu jen když na ni prompt explicitně odkazuje.

**Reference system:**
- `_etmRefAnalyses[]` — pole analýz pro libovolný počet referencí.
- `_etmAnalyzeRefAt(idx)` — ref 1 dostane detailní analýzu scény (150-250 slov), ref 2+ dostane krátkou analýzu role (barva? maska? úhel? 80 slov).
- `_etmRefreshRefPreviews()` — voláno při open, send, new chat — detekuje nové refs, spustí analýzu, zobrazí preview.
- System prompt dynamicky buildí sekci `REFERENCE IMAGE ANALYSES` pro N referencí.
- Změna ref count mid-conversation → system note injected do chat history.

**Bug fix: Double reference prefix (refs.js):**
- `preprocessPromptForModel` pro gemini stripuje existující `[Reference images:...]` prefix přes regex před přidáním nového.

**v192en JS řádky: 17785 (z v191en 17068, +717)**

---

## Výzkum: Camera Reframe pro AI Image Models (10. 4. 2026)

### Testované přístupy a výsledky

**❌ Floor plan jako druhá reference NEFUNGUJE:**
- Generativní modely ignorují diagramy/náčrtky jako prostorové instrukce.
- Snaží se je vizuálně zapracovat nebo úplně ignorují.
- Testováno s NB2, NB Pro, Seedream 4.5.

**❌ Dlouhé prostorové popisy NEFUNGUJÍ:**
- "Camera now stands along the right wall where the spectators were, shooting across the width..." → model se zmate, přeuspořádá objekty.
- Čím delší popis, tím horší výsledky.

**❌ Numerické úhly a kompasové směry NEFUNGUJÍ:**
- "Rotate camera 90° left" → ignorováno nebo špatně interpretováno.
- "Camera facing north" → ignorováno.

**✅ Cinematic shot language FUNGUJE:**
- "over-the-shoulder shot from behind [character]"
- "profile shot from the left side"
- "wide shot from the opposite end of the room"

**✅ Krátké prompty FUNGUJÍ lépe:**
- Pod 40 slov = nejlepší výsledky pro reframe.
- Pod 60 slov = akceptovatelné pro Gemini.

### Seřazení strategií podle úspěšnosti (z testování):

| # | Strategie | Příklad | Účinnost |
|---|-----------|---------|----------|
| A | **Physical Position** | "from the view of camera standing between benches" | ⭐⭐⭐ Nejspolehlivější |
| B | **Character POV** | "from the perspective of the man sitting on the right bench" | ⭐⭐⭐ Velmi spolehlivé |
| C | **Landmark-to-Target** | "from doors in the right wall — across the court desk" | ⭐⭐ Spolehlivé |
| D | **Subject Reframe** | "close-up profile shot of the man from his left side" | ⭐⭐ Střední |
| E | **Multi-Reference** | "scene from image 1 in the view and camera angle of image 2" | ⭐⭐⭐ S 2 refs |
| F | **Temporal Orbit** | "camera orbiting, show me 20 seconds later" | ⭐ Kreativní fallback |

### Klíčové poznatky:

1. **NB Pro je nejlepší model pro camera reframe.** Jediný který spolehlivě otočil kameru o 90°.
2. **Nejlepší výsledky dává strategie "popsat kde kamera stojí"** — ne kam se posunula.
3. **Druhá reference (z jiného úhlu) dramaticky zlepšuje výsledky** — ale NE posíláním k modelu. Slouží agentovi k pochopení prostoru. K modelu se posílá jen hlavní ref + prompt.
4. **Multi-ref strategy E** je velmi účinná ale vyžaduje obě reference v API callu.
5. **Generované prompty by měly znít jako popis nové fotografie** — ne jako instrukce pro kameru.

### Úspěšné prompty z testů:
```
[Ref_044] Show me this scene from the view of camera standing between benches
[Ref_031] Show me this scene from the perspective of the man sitting on the right bench
Same courtroom, close-up profile shot of the man in grey from his left side
[Ref_031, Ref_045] Show me the scene from image 1 in the view and camera angle of image 2
[Ref_031] camera is orbiting around the room. Show me this scene 20 second later
```

### Aplikace pro budoucí moduly (Character Coverage, Environment Coverage):
- Character Coverage (10 záběrů postavy) → primárně strategie B (Character POV) + D (Subject Reframe)
- Environment Coverage (10 záběrů prostředí) → primárně strategie A (Physical Position) + C (Landmark-to-Target)
- Obě budou těžit z multi-ref approach kde první generovaný záběr slouží jako reference pro další

---

## Stav inpaint systému (k 10. 4. 2026)

Beze změn oproti v191en.

---

## Aktivní TODO (v pořadí priority)
- [ ] **#0** Otestovat FLUX Krea inpaint s platným klíčem
- [ ] **#1** Style Library "My Presets"
- [ ] #4 Clarity 8×/16×
- [ ] #5 Claid.ai
- [ ] #6 WAN audio (DashScope)
- [ ] #7 Vidu Q3 Turbo
- [ ] #9 Seedance 2.0
- [ ] #10 Ideogram V3
- [ ] #11 Recraft V4
- [ ] #12 GPT Image 1.5
- [ ] #13 Hailuo 2.3
- [ ] WAN 2.7 R2V — ověřit endpoint
- [ ] MuAPI klíč do Setup

---

## Modulární struktura
### Build pořadí (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```

### Změněné moduly v v192en (oproti v191en)
| Modul | Změny |
|-------|-------|
| `ai-prompt.js` | +Edit Tool (chat, unified agent, TYPE A element edit + TYPE B camera reframe, 6 strategií, variant parsing+display, REFS tagging, multi-ref analysis array), +Special Tool placeholder, +resetEditTool, +session persistence |
| `template.html` | +Edit Tool modal (`#editToolModal`), +Special Tool modal (`#specialToolModal`), +`.btn-special`/`.btn-edit` CSS, +`.etm-*` CSS (modal, chat, variants, status line, ref preview), tlačítka v plabel řadě |
| `refs.js` | Fix: `preprocessPromptForModel` stripuje existující `[Reference images:...]` prefix před přidáním nového (fix double prefix bug) |

### Worker struktura (gis-proxy v2026-11)
Beze změn oproti v191en.
