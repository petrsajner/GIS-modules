# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 14. 4. 2026 · v199en*

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
