# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 16. 4. 2026 · v201en*

---

## Paint Engine — Parallel Annotation Layer (16. 4. 2026)

**Problém:** Method B (Layers) save v annotate modálu používal **diff rekonstrukci** místo skutečného layer systému. Logika: `history[0]` = čistý originál (snapshot ctx po `openAnnotateModal`), aktuální `ctx` = obrázek + tahy. Diff pixel-by-pixel rekonstruoval tahy.

**3 bugy odkryté postupně v jedné testovací session:**

1. **Anotuj → crop → save B → bílý Layer 2:**
   `pCropApply` přepisoval `history[0]` aktuálním ctx (cropnutá verze obrázku + anotace). Diff(current, history[0]) = 0 → všechno bílé pozadí → Layer 2 je bílá plocha.

2. **Anotuj → crop → save B → špinavý Layer 1:**
   Stejná příčina — `history[0]` obsahoval anotace. Layer 1 by měl být čistý orig, ale byl = obrázek + anotace.

3. **Anotuj → crop → inpaint → source je levý horní roh:**
   `_annotateBaseB64` (global, používaný inpaint crop preview) se nastavuje v `openAnnotateModal` a `pCropApply` ho neaktualizoval. Inpaint `drawImage(bi, cropX, cropY, ...)` kreslil z nových souřadnic na pre-crop obrázek.

**Diskuse variant:**
- **Varianta A: Opravit diff flow** (~30 řádků) — zachovat diff rekonstrukci, fix v pCropApply aby history[0] zůstal čistý originál.
- **Varianta B: Refactor na skutečný separate annotation canvas** (~250 řádků) — diff pryč, Method B čte ze samostatného canvasu.

Petr zvolil **variantu B** s odůvodněním "žádný diff — anotace má být samostatný layer".

**Rozhodnutí: Paralelní annotation canvas (minimálně invazivní verze variant B):**
Místo full render pipeline refactoru (display canvas by flatnoval base + annot při každém draw) přidán **paralelní `_annotateAnnotCanvas`** vedle existujícího `_annotateMaskCanvas`. Tahy se kreslí do 3 ctx zároveň:
1. `state.ctx` (display) — user vidí okamžitě
2. `state.maskCtx` — bílé tahy pro inpaint (legacy)
3. `state.annotCtx` — **barevné tahy na transparentním pozadí (nové)**

`history[0]` zůstává autoritativní "clean original" invariant. Po cropu se rekonstruuje cropováním pristinního `history[0]` přes drawImage s clip (ne přepsáním aktuálního ctx). `_annotateBaseB64` se aktualizuje ze stejného cropnutého canvasu.

Method B export:
- Layer 1 = `history[0]` PNG (čistý orig, automatically cropped when canvas was cropped)
- Layer 2 = white fillRect + drawImage(annotCanvas) PNG (čisté tahy na bílém pozadí)

**Rozsah:** ~80 řádků v paint.js (vs. odhad 250). Důvod: místo full render pipeline refactoru paralelní mirror. Žádné riziko regrese paint tabu, undo, inpaint integrace.

**Soft-blend composite bonus fix:**
V `_compositeAndSaveQueueJob` soft-blend path (`maskBlur > 0`) byly `rc.drawImage(ri, 0, 0)` a `rc.drawImage(mi, 0, 0)` 3-param → kreslí v přirozené velikosti. Pokud model vrátil výsledek v menším rozlišení než `cropW×cropH`, content byl v levém horním rohu resultCrop a composite back vložil posun. Fix: 5-param s cílovými rozměry `cropW × cropH`. Hard-blend už OK měl.

---

## Z-Image Turbo — Split T2I / I2I (16. 4. 2026)

**Kontext:** `zimage_turbo` byl **hybrid model** — jeden dropdown option s dynamickým přepínáním endpointu:
- bez refu → `fal-ai/z-image/turbo` (T2I)
- s refem → `fal-ai/z-image/turbo/image-to-image` (I2I)

UI flags: `refs: true, maxRefs: 1, i2iModel: true, strength: true`.

**Problém:** Strength slider se zobrazil vždy (model má `strength: true`), i v T2I módu kdy je irelevantní. Navíc byl řízený dvěma nezávislými body:
- `model-select.js` — `(m.strength && refs.length > 0)` při select modelu
- `refs.js` — stejná podmínka při ref-change (zastaralé z hybrid éry)

Při přepínání modelů nebo ref-change se slider objevoval/mizel nekonzistentně.

**Rozhodnutí: Rozdělit na dva samostatné modely.**
- `zimage_turbo` — čistě T2I, endpoint `fal-ai/z-image/turbo`, bez refs/strength/i2iModel
- `zimage_turbo_i2i` — čistě I2I, endpoint `fal-ai/z-image/turbo/image-to-image`, `refs: true, maxRefs: 1, strength: true, i2iModel: true`, ref required

Kombinovaný s čistším řízením strength slideru (jen v `model-select.js` podle `m.strength` flag, bez vazby na refs.length).

**Alternativy zvážené a zamítnuté:**
- Dynamicky skrývat strength podle stavu refs v jednom hybrid modelu — složitější logika, stále UX nejasné
- Zachovat hybrid s upozorněním "strength works only with ref" — neřeší UX nekonzistenci

**Ref upload label aktualizace:** "No image = T2I" (legacy z hybrid éry) → "Input image required". Odpovídá dedicated I2I sémantice.

**Dropdown separator:** Z-Image a WAN byly ve stejné "skupině" (mezi dvěma `<option disabled>` separatory, bez mezi). Přidán separator → vizuálně oddělené sekce.

---

## Z-Image Edit — TODO odepsán (16. 4. 2026)

**Kontext:** TODO položka "Z-Image Edit (`fal-ai/z-image/edit`)" byla v seznamu od paměťového snapshotu.

**Research:** Z-Image rodina na fal.ai obsahuje:
- `fal-ai/z-image/base` — T2I standard (6B params, 28 steps, CFG)
- `fal-ai/z-image/turbo` — T2I ultra-fast (8 steps, acceleration)
- `fal-ai/z-image/base/lora` — T2I base + LoRA array
- `fal-ai/z-image/turbo/lora` — T2I turbo + LoRA array
- `fal-ai/z-image/turbo/image-to-image` — strength-based I2I
- `fal-ai/z-image-trainer` — LoRA training (ZIP dataset)

**Žádný instruction-based edit endpoint** existuje (typu Qwen Edit / WAN Edit / FLUX Kontext). TODO položka založena na mylném předpokladu.

**Rozhodnutí:** Odepsat z TODO. Místo toho:
- Nahrazeno Z-Image Turbo T2I/I2I split (bod výše)
- Přidáno nové TODO: **Z-Image LoRA generation** (fal-ai/z-image/{base,turbo}/lora) + **Z-Image LoRA trainer**

---

## Segmind — Odstraněn z klientu (16. 4. 2026)

**Kontext:** Segmind API klíč byl v setup UI pro WAN 2.7 image generation & editing. V v196en WAN 2.7 přešel na Replicate (full aspect ratio whitelist vs. Segmind square-only). Segmind se nikde nepoužívá, klíč v setupu zůstal orphan.

**Akutní motivace:** Přidáním PixVerse klíče do setupu bylo porušené střídání světlých/tmavých pruhů mezi Topaz/PixVerse/Segmind/Replicate/OpenRouter. Nejrychlejší oprava = odstranit nepoužívaný Segmind.

**Rozhodnutí:** Odstranit z klientu:
- `template.html` — celý SEGMIND API KEY block (11 řádků)
- `setup.js` — localStorage load, `onSetupSegmindKey` handler, `API_KEY_FIELDS` entry
- `spending.js` — `'segmind'` ze `SPEND_PROVIDERS`

**Ponecháno (do příštího cleanupu):**
- Worker `handlers/segmind.js` — mrtvý kód ve Workeru, neovlivňuje klient
- `gis_segmind_apikey` klíč v localStorage uživatelů — orphan, ale neškodný

**Výsledek:** Sekvence pruhů obnovena (TOPAZ → A, PIXVERSE → B, REPLICATE → A, OPENROUTER → B).

---

## MaxRefs enforcement — třívrstvá kontrola (14. 4. 2026)

**Problém:** Přepnutí modelu (např. NB2 s 14 refy → Qwen Edit s max 3) neomezovalo reference. Tři nezávislé kontroly chyběly: UI, AI agent, API dispatch. Job se poslal se všemi refy → 422 error.

**Scénář:** Uživatel nahraje 4 refs pro NB2 → generuje → Reuse → přepne na Qwen Edit → API vrátí "Maximum 3 reference images allowed". Navíc Edit Tool agent generuje prompt odkazující na image 4 i když model ji nepřijme.

**Rozhodnutí: 3 nezávislé vrstvy:**
1. **UI** — `renderRefThumbs()` dimuje refs nad limitem (`.ref-dimmed` class). Counter ukazuje active/max. Refs nejsou SMAZÁNY (zachovány pro přepnutí zpět).
2. **AI agent** — Edit Tool system prompt, ref preview, `_etmSend()`, `_etmAppendVariants()` — vše capped na model maxRefs. `_etmReadaptPrompt()` přidá CRITICAL instrukci pro ořezání referencí v promptu.
3. **API dispatch** — `refsCopy = getActiveRefs().map(...)` v generate.js — definitivní hard limit.

**Alternativy zvážené a zamítnuté:**
- Smazat přebytečné refs při přepnutí modelu → destruktivní, uživatel by je musel znovu nahrát
- Blokovat přepnutí modelu pokud má moc refs → přílišné omezení workflow

---

## Edit Tool model switch — ref-aware readapt (14. 4. 2026)

**Problém:** `etmSwitchModel()` nevolal `_etmRefreshRefPreviews()` a `_etmReadaptPrompt()` nezohledňoval změnu ref limitu.

**Rozhodnutí:**
- `etmSwitchModel()` nově volá `_etmRefreshRefPreviews()` → okamžitý dimming update
- `_etmReadaptPrompt()` přidá `refTrimNote` když `refs.length > newMax`:
  "CRITICAL: The target model only accepts N reference images. Remove ALL references to images beyond image N."

---

## Grok Imagine Video — přímé xAI API přes proxy (14. 4. 2026)

**Kontext:** xAI nabízí `grok-imagine-video` s 5 módy: T2V, I2V, Reference-to-Video (max 7 obrázků), V2V Edit, Extend. Dostupné přes přímé xAI API i fal.ai.

**Rozhodnutí: Přímé xAI API (ne fal.ai):**
- ✅ Plný přístup ke všem 5 módům (fal.ai nemá Extend a Reference-to-Video jako jeden)
- ✅ Levnější: $0.05/s vs fal.ai ~$0.06/s
- ✅ Jeden model string pro vše
- ⚠ Vyžaduje Worker handler (xai-video.js)

**Rozhodnutí architektura:**
- Worker jen submituje a vrací `request_id`. GIS polluje client-side (Worker 30s limit).
- xAI video URL je dočasná a nemá CORS → download proxy route (`/xai/video/download`)
- Reference images: base64 data URIs přímo v payloadu (xAI akceptuje, žádný upload potřeba)
- V2V Edit / Extend: source video z galerie → R2 upload → HTTPS URL → xAI (xAI potřebuje URL, ne base64)

**Rozhodnutí UI:**
- Jeden model `grok_video` s mode selectorem (T2V/I2V/Ref2V/Edit/Extend) — odpovídá tomu jak xAI sám model prezentuje
- Duration/resolution/aspect se skrývají pro Edit (output = input)

**xAI Video Edit payload gotcha:**
- xAI chce `video: {url: "..."}` (objekt), NE `video_url: "..."` (flat string)
- Extend: `video: {url}` + `duration` (délka přidané části, ne celkového výstupu)
- Zjištěno z 422 deserializační chyby

**Extend nestabilita:**
- xAI Extend mód přijme job ale často vrátí "internal error"
- Potvrzeno komunitou (březen 2026) + xAI acknowledged bugy v audio extensions
- T2V, I2V, V2V Edit fungují spolehlivě

---

## Grok Imagine — kompletní integrace (13. 4. 2026)

**Kontext:** xAI Grok Imagine API nabízí řadu features které GIS neměl implementované: multi-image editing (5 refs), Grok Pro model, count až 10, `response_format: b64_json`.

**Rozhodnutí Worker:**
- T2I → `/v1/images/generations`, Edit → `/v1/images/edits` — dva různé endpointy
- `response_format: b64_json` eliminuje Worker-side URL fetch. API vrátí base64 přímo.
- Multi-image: `images: [{type: "image_url", url: "data:..."}]` array

**Rozhodnutí Pro vs Standard:**
- Pro (`grok-imagine-image-pro`): maxRefs 1 (API limit potvrzený errorem), default 2K, $0.07/img
- Standard (`grok-imagine-image`): maxRefs 5, default 1K, $0.02/img

**Rozhodnutí aspect ratio:**
- Grok podporuje 13 poměrů. `_grokFilterAspects()` filtruje.
- Nepodporované (21:9, 4:5, 1:4, 4:1) se skryjí.

**Rozhodnutí concurrency:**
- xAI limit snížen na 2 concurrent requesty (z globálních 4). 503 při batchi.

---

## Edit Tool — 7 modelových typů (13. 4. 2026)

**Rozhodnutí:**
- Rozšířit type systém na 7 typů: gemini, flux, seedream, kling, qwen2, grok, wan
- Každý typ má vlastní ETM_ELEMENT_* template
- Badge má unikátní barvu per typ
- `_etmReadaptPrompt` automaticky konvertuje prompt při přepnutí modelu

---

## Edit Tool — TYPE A/B klasifikace (13. 4. 2026)

**Rozhodnutí:**
1. TYPE B = POUZE změna pohledu, ŽÁDNÁ změna obsahu
2. Multi-ref TYPE A: prompt MUSÍ explicitně referencovat KAŽDÝ obrázek by number
3. Keep section VŽDY obsahuje "camera angle, framing"
4. Zákaz invence mood/grading z jiných referencí

---

## Ref prefix — čistý prompt bez labelů (13. 4. 2026)

**Rozhodnutí:**
- Prompt posílaný modelu: `[Reference images: image 1, image 2, image 3]` — jen čísla
- User labels viditelné v UI ale NE v API promptu

---

## Qwen 2 Edit — maxRefs opraveno (13. 4. 2026)

**Rozhodnutí:** maxRefs 4 → 3. API limit je 3.

---

## Error karty — Dismiss button (13. 4. 2026)

**Rozhodnutí:** ✕ Dismiss button. Smaže error kartu a reflow grid.

---

## Recraft Crisp upscale — PNG→JPEG + 4 MP pre-flight (12. 4. 2026)

**Rozhodnutí file size:** PNG→JPEG konverze (q92→q85→q75)
**Rozhodnutí pixel resolution:** Pre-flight check `w * h > 4194304` → modální dialog
**Rozhodnutí error visibility:** `job.pendingCards = [cardEl]` fix + console.error

---

## Qwen Image 2 — negative_prompt + multi-ref edit (12. 4. 2026)

**Rozhodnutí:** `negative_prompt` + `maxRefs: 4 → 3` (API limit) + area-based 4 MP cap

---

## Dead code cleanup — callWan27 (12. 4. 2026)

**Rozhodnutí:** Odstranit dead code. `callWan27eVideo` ve video.js ZŮSTÁVÁ.

---

## Clarity upscale — empirický limit 25 MP output (12. 4. 2026)

**Rozhodnutí:** Pre-flight check na output > 25 MP.

---

## Runway Gen-4 — výzkum proveden, čeká na rozhodnutí (12. 4. 2026)

**Stav:** Kompletní API výzkum. Implementační odhad ~2-3 sessions.
**Rozhodnutí:** Odloženo.

---

## WAN 2.7 Image: Segmind → Replicate (12. 4. 2026)

**Rozhodnutí:** Replicate s 5 aspect ratios, ověřený whitelist. Standard max 2K, Pro max 4K.

---

## Dynamický params systém — odloženo

**Rozhodnutí:** Neimplementovat — příliš velké riziko regresí. Hybridní přístup pro nové modely.

---

## Tauri distribuce — odloženo

**Spustit kdy:** GIS je stabilní a feature-complete.

---

## Proxy architektura — verze history

| Verze | Datum | Změny |
|-------|-------|-------|
| 2026-16 | 14. 4. 2026 | xAI Video: 6 routes (submit/edit/extend/status/download) |
| 2026-15 | 13. 4. 2026 | xAI image: b64_json, multi-image edit |
| 2026-12 | 11. 4. 2026 | PixVerse C1: 6 routes |
| 2026-09 | 6. 4. 2026 | R2 generic upload/serve, Kling V2V fix |

---

## Code cleanup & deduplication (9. 4. 2026)

**Rozhodnutí:** Systematický refaktor v jedné verzi (v190en).
**Výsledek:** 17533 → 16897 JS řádků (−636, −3.6%).

---

## Edit Tool — Unified Agent Architecture (10. 4. 2026)

**Rozhodnutí:** Jeden unified AI agent s automatickou klasifikací (TYPE A/B).

---

## Camera Reframe — Strategie (10. 4. 2026)

**Rozhodnutí: Variant approach.** Agent generuje 4 varianty, uživatel zkouší postupně.

---

## Druhá reference jako interní kontext (10. 4. 2026)

**Rozhodnutí:** REFS tagging systém `[REFS:1]` / `[REFS:1,2]`.

---

## PixVerse C1 integration via proxy (11. 4. 2026)

**Rozhodnutí:** Passthrough Worker architektura. 4 režimy: T2V, I2V, Transition, Fusion.

---

## Setup UI redesign — střídavé pozadí + Get Key linky (11. 4. 2026)

**Rozhodnutí:** Střídavé pozadí, accent labels, Get key → linky.

---

## Unified Image Panel — jedna dynamická šablona (14. 4. 2026)

**Problém:** 9 separátních HTML panelů (nbParams, imagenParams, fluxParams, seedreamParams, klingParams, zimageParams, wan27Params, qwen2Params, grokParams) — každý nový model = nový HTML blok + nový JS wiring. Duplikované prvky (count, resolution, seed) v každém panelu. model-select.js: 300+ řádků show/hide logiky.

**Rozhodnutí: Jeden generický panel (`upParams`) s 14 prvky:**
- Každý model v models.js deklaruje UI flags (resolutions, maxCount, steps, guidance, seed, safetyTolerance, safetyChecker, grounding, etc.)
- `selectModel()` zobrazuje/skrývá prvky podle flagů
- `generate()` čte z jedné sady elementů, mapuje na per-type snap formáty
- Resolution: 3 tlačítka, labely z `model.resolutions[]`, pixel info dynamicky per type
- Count: 4-button (většina) nebo 10-button (Grok) varianta
- Safety: slider (FLUX) nebo checkbox (SeeDream/Z-Image/Qwen2) varianta
- Thinking: radio Min/High (NB2) nebo checkbox (WAN 2.7) varianta

**Scope:** Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok
**Stranou:** Luma Photon, Mystic, Freepik Edit (unikátní parametry, zůstávají jako legacy panely)

**Doplňková rozhodnutí:**
- Resolution 512 odstraněna (NB2, FLUX) — generuje 1K i s 512 nastavením
- Prompt upsampling/expansion/enhance zakázáno v UI, posíláno jako false
- Neg prompt: jeden sdílený prvek, prefilled s `_DEFAULT_NEG_PROMPT`
- Checkbox `.chk-box` border: 1px→1.5px s `var(--dim2)` pro viditelnost

**Výsledek:** template.html −330 řádků, model-select.js −85 řádků. Přidání nového image modelu = jen přidat objekt do MODELS s UI flags.

---

## Imagen 4 REST API — sampleImageSize (15. 4. 2026)

**Problém:** 5. pokus o aktivaci 2K resolution u Imagen 4 Standard/Ultra přes REST API. Předchozí 4 pokusy byly neúspěšné — všechny renderovaly jen 1K.

**Root cause:** REST API Gemini endpointu `:predict` používá **Vertex AI naming convention** pro parametry: `sampleImageSize`, ne `imageSize` (což je SDK name). Google SDK to interně mapuje, ale při REST volání musí být Vertex název.

**Dokumentace to nezmiňovala jasně:**
- Gemini API REST sekce ukazuje jen `sampleCount` v REST curl příkladu
- SDK docs zmiňují `imageSize` ale s poznámkou "Note: Naming conventions of parameters vary by programming language"
- Pravdu ukazovala až Vertex AI doc `set-output-resolution`: `sampleImageSize` v JSON body

**Fix:**
```js
if (!model.id.includes('fast') && imageSize !== '1K')
  params.sampleImageSize = imageSize;  // "2K"
```

**Ověřeno:** 2K u Imagen 4 Ultra na 16:9 = 2816×1536. Aktualizována paměť uživatele.

**Lessons learned:**
- Při REST volání Google API: hledat Vertex AI doc (ne jen Gemini API doc)
- `imageSize` (SDK) = `sampleImageSize` (REST)
- `numberOfImages` (SDK) = `sampleCount` (REST)
- Uvolit parametr konzervativně — default 1K se bez parametru generuje spolehlivě

---

## Unified Image Panel (14. 4. 2026)

**Problém:** 9 separátních HTML panelů (nbParams, imagenParams, fluxParams, seedreamParams, klingParams, zimageParams, wan27Params, qwen2Params, grokParams) — každý nový model = nový HTML blok + nový JS wiring. Duplikované prvky.

**Rozhodnutí: Jeden generický panel `upParams` s 14 prvky:**
- Každý model v models.js deklaruje UI flags (resolutions, maxCount, steps, guidance, seed, safetyTolerance, safetyChecker, grounding, etc.)
- `selectModel()` zobrazuje/skrývá prvky podle flagů
- `generate()` čte z jedné sady elementů, mapuje na per-type snap formáty
- Handlers nedotčené — stejné snap formáty

**Scope:** Gemini, Imagen, FLUX, SeeDream, Kling, Z-Image, WAN 2.7, Qwen 2, Grok
**Stranou:** Luma Photon, Mystic, Freepik Edit (unikátní parametry, zůstávají legacy)

**Výsledek:** template.html −330 řádků, model-select.js −85 řádků. Přidání nového image modelu = jen přidat objekt do MODELS s UI flags.

---

## HTML Build Validation (14. 4. 2026)

**Problém:** Při refactoru byl omylem ponechán orphan `</div>` tag (po odstranění `wan27CountRow`). Layout se rozbil — Save To, Generate, Queue vypadly z levého panelu. Bez chyby. Stejný typ chyby se už v historii projektu opakoval.

**Rozhodnutí:** Automatická HTML div balance validace v `build.js`:
```js
const divOpens = (htmlOnly.match(/<div[\s>]/g) || []).length;
const divCloses = (htmlOnly.match(/<\/div>/g) || []).length;
if (divOpens !== divCloses) console.error(`⚠ WARNING: HTML div balance = ${divOpens - divCloses}`);
else console.log(`✓ HTML div balance: OK (${divOpens} pairs)`);
```

Při každém buildu zobrazí balanci. Pokud nesedí, build projde ale zobrazí warning.

---

## Reference prefix `[Reference images: ...]` — odstraněn (14. 4. 2026)

**Problém:** Prefix `[Reference images: image 1, image 2]` se přidával do textarea při přepnutí modelu na Gemini/xAI. Funkčně neškodil (neduplikoval se), ale byl redundantní — Gemini vidí obrázky v `parts` array. Petrovi to vadilo vizuálně.

**Rozhodnutí:** Úplně odstraněno. `preprocessPromptForModel` pro Gemini/xAI už prefix nepřidává. Legacy prefix se stripuje vždy (i bez refs). `rewritePromptForModel` cleanup při každém přepnutí modelu.

**Co zůstává:** Styles a camera prefix pro Gemini — ty jsou na začátku promptu ve formátu "Visual style instructions: ... . Camera: ... .\n\n[prompt]" a jsou zachovány.

---

## Edit Tool Agent — chat memory fix (14. 4. 2026)

**Problém:** V Edit Tool si agent nepamatoval předchozí konverzaci. Modal se otevřel, chat byl viditelný, ale agent reagoval jako by neviděl nic než analyzované refs.

**Root cause:** `callGeminiTextMultiTurn()` při OpenRouter path (primární agent) posílala jen poslední user message, ne celou historii:
```js
const lastUserMsg = [...history].reverse().find(m => m.role === 'user')?.parts?.[0]?.text || '';
const result = await _callOpenRouterText(systemPrompt, lastUserMsg, 0.85, 2048);
```

**Fix:** Nová funkce `_callOpenRouterMultiTurn()` která:
1. Konvertuje Gemini history `[{role,parts:[{text}]}]` na OpenAI `[{role,content}]`
2. Mapuje role 'model' → 'assistant'
3. Posílá celé messages array na OpenRouter

**Agent si teď pamatuje celou konverzaci** — persistent dokud uživatel nedá reset nebo nezavře modal.

---

## Crop Tool (15. 4. 2026)

**Problém:** Petr potřebuje oříznout obrázek. Dělá to mimo GIS (export → crop → import zpět). V paint tabu je to k ničemu (start s prázdným canvasem), ale v annotate modálu už obrázek je.

**Rozhodnutí:** Crop tool v annotate modálu.
- 8 handlů (4 rohy + 4 strany)
- Lock ratio checkbox
- Apply/Cancel tlačítka + Enter/Esc shortcuts
- DOM overlay (ne canvas drawing) — čistší, snadnější UI
- Architektura podporuje oba prefixy ('p' + 'a'), v UI je jen 'a' (annotate)

**Implementace:**
- `_pCropState` holding prefix + geometry + drag state
- Apply: `ctx.getImageData(x,y,w,h)` → resize canvas → `putImageData`
- Mask canvas se resize spolu (pokud existuje)
- History se resetuje (no undo across crop boundary)

