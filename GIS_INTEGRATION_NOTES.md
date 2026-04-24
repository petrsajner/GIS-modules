# GIS Integration Notes — Video Prompt Generator research

**Source:** Tři research sessions:
- Session 1 (předchozí): Luma, Grok, PixVerse C1+V6, WAN 2.6+2.7, Vidu Q3, Runway Gen-4/4.5
- Session 2 (předchozí): doplnění prvních šesti modelů
- Session 3 (2026-04-24): Kling V3 + O3, Seedance 2.0, Veo 3.1

**Purpose:** Zachytit všechny findings z prompt-generator research, které přesahují scope generátoru samotného a vyžadují změny / doplnění v GIS kódu, UI nebo API integraci. Tento dokument existuje, abychom znovu nemuseli zkoumat to, co už bylo zjištěno.

**Struktura:** Findings jsou organizované podle typu zásahu (co je chybné, co chybí, co je nice-to-have). Každý záznam obsahuje kontext, dopad, a doporučení.

---

## Legend

- 🔴 **BUG** — něco v GIS je funkčně špatně (špatný endpoint, deprecated field, nesedící chování)
- 🟡 **MISSING** — funkce existuje v modelu, ale v GIS není integrovaná (feature gap)
- 🟢 **ENHANCEMENT** — nice-to-have zlepšení UX nebo code quality
- 🔵 **VERIFY** — potřeba ověřit v reálném testu / kódu

---

## 1. Kritické chyby (🔴 BUG)

### 1.1 PixVerse V6/C1 — `camera_movement` API field je deprecated

**Kontext:** PixVerse camera presets (dropdown s móvies jako orbit, dolly, crane, push-in) fungovaly naposledy v modelu V5. Ve V6 ani v C1 už nefungují. Ověřeno přímo na PixVerse webu během research session.

**Dopad:** GIS aktuálně má `cameraMove: 'pixverse_v4'` dropdown aktivní pro `pixverse_video` type (line 88 v `video-models.js`). Uživatel nastavuje camera preset → GIS ho pošle v payload → PixVerse ho ignoruje → výsledné video neodpovídá očekávání uživatele.

**Doporučení:**
- Skrýt `cameraMove` dropdown pro V6 a C1 modely
- Alternativně: odstranit dropdown úplně (camera jde přes prose v promptu pro oba modely)
- Camera direction je plně v kompetenci prompt generátoru (píše "camera pans left" do promptu)

**Lokace v kódu:** `video-models.js` uiOverrides sekce pro pixverse_video a c1_video

---

### 1.2 PixVerse C1 Transition — `generate_multi_clip_switch` je INVERTOVANÝ

**Kontext:** Pro PixVerse C1 Transition mode je chování switche obrácené oproti V6:
- `true` = single shot
- `false` = multi shot

V ostatních módech a modelech je logika opačná (`true` = multi).

**Dopad:** Pokud uživatel klikne "multi-shot ON" v GIS UI a systém předá `true` na C1 Transition endpoint, dostane single shot místo multi. Uživatel neví, že endpoint má invertovanou sémantiku.

**Status:** Zdokumentováno v userMemories jako "CRITICAL GOTCHA". Ověřit, že GIS kód invertuje hodnotu pro C1 Transition mode (nejspíš v `video-queue.js` nebo `video-models.js`).

**Doporučení:** Explicitní test s logováním finálního payload hodnoty. Pokud není invertováno → fix v handler layer.

---

### 1.3 fal.ai Worker handler je `fal-inpaint.js`, ne `fal.js`

**Kontext:** Z userMemories: *"fal.ai Worker handler je **`fal-inpaint.js`** (NOT `fal.js`). Import: `'./handlers/fal-inpaint.js'`. Recurring bug — always verify."*

**Dopad:** Při přidávání nového fal.ai endpointu (pro WAN 2.7, Vidu Q3, Luma via fal.ai, Kling voice/element endpoints) je triviálně snadné importovat neexistující `fal.js`. Kód projde build, ale runtime fail.

**Doporučení:** Přidat build-time check do `build.js` — pokud se někde importuje `'./handlers/fal.js'`, warning nebo error. Ukotvit v `gis-edit-workflow` skill jako mandatory check.

---

### 1.4 Kling `prompt` nesmí být empty string ⭐ NEW (session 3)

**Kontext:** Z userMemories: *"Kling Video: never send `prompt: ""`; `duration` must be a string."*

Když uživatel vygeneruje I2V nebo Start/End generaci bez textového promptu (pouze s referencemi), GIS může poslat `prompt: ""`. Kling API to odmítne.

**Dopad:** Generator by měl vždy vygenerovat alespoň minimální prompt z reference vision-pass (např. "Continuing from reference frame"). Pokud generator selže a payload builder dostane `""`, musí payload builder doplnit fallback non-empty string nebo throw error.

**Doporučení:** Validace v payload builder pro `kling_*` types — pokud `prompt.trim().length === 0`, buď fallback na "animate the scene naturally" nebo explicit error message k uživateli "Kling vyžaduje alespoň krátký prompt popisující pohyb".

**Lokace v kódu:** `_buildUnifiedVideoParams` nebo Kling-specific handler. Grep `kling` a `prompt:` v `video-models.js` / `video-queue.js`.

---

### 1.5 Veo 3.1 reference_to_video docs/API mismatch ⭐ NEW (session 3)

**Kontext:** Google AI developer forum dokumentuje případy, kdy Veo 3.1 `reference_to_video` endpoint vrací 400 "use case not supported" navzdory tomu, že docs ho popisují jako dostupný. Reference docs: https://discuss.ai.google.dev/t/veo-3-1-reference-images-docs-say-available-api-says-not-supported/111853

**Dopad:** Pokud uživatel selektuje Veo 3.1 Reference-to-Video s 1-3 referenčními obrázky a API vrátí 400, bez fallbacku generace selže bez užitečné error message.

**Doporučení:** GIS fallback chain:
1. Attempt reference-to-video s všemi refs
2. Na 400 → retry s jen 1 referencí jako I2V start frame
3. Warn user: "Veo reference endpoint odmítl; fallback na I2V s první referencí."
4. Log incident pro pattern tracking (pokud se opakuje, možná je to jen Petrova region/account issue)

**Lokace v kódu:** Veo handler (cesta v proxy nebo fal.ai wrapper) + error handling layer.

---

## 2. Chybějící integrace modelů a módů (🟡 MISSING)

### 2.1 Vidu Q3 Reference-to-Video Mix — největší potential addition

**Kontext:** Vidu Q3 Reference-to-Video Mix je **signature feature** Shengshu platformy:
- 1-4 reference images
- **U-ViT (Universal Vision Transformer)** architecture engineered specifically pro multi-entity consistency
- Produces 16s, 1080p video s native synchronized audio
- Marketovaný jako "solving the consistency paradox" v AI video

**Dopad:** GIS má jen T2V, I2V, Start/End frames pro Vidu Q3. R2V Mix není integrovaný. Je to ztracený potential — jeden z nejlepších multi-entity consistency modelů na trhu, dostupný přes fal.ai (`fal-ai/vidu/q3/reference-to-video` nebo přes WaveSpeedAI wrapper).

**API endpoint (fal.ai):** ověřit přesný slug, kandidáti:
- `fal-ai/vidu/q3/reference-to-video`
- `fal-ai/vidu/q3-mix-reference`

**Prompt guidance:** Viz PART C.8 ve `VIDEO_PROMPT_GENERATOR.md` — implicit binding, natural language subject descriptions, no positional tags.

**Doporučení:** Priorita HIGH. Největší value-add z Vidu rodiny.

---

### 2.2 Runway (celá rodina) — GIS nemá nic

**Kontext:** Runway je etablovaný hráč v AI video od Gen-2 a má unikátní features, které žádný jiný model v GIS nemá:
- **Motion Brush 3.0** — paint areas to direct movement (vector-based)
- **Director Mode** — node-based dynamic camera choreography
- **Lip Sync & Audio Integration** — sync video s uploaded audio
- **Minimalist prompting philosophy** — fundamentálně odlišný od ostatních modelů

**Recommended integration priority:**
1. **Gen-4.5** (T2V + I2V, 2-10s) — primary, state-of-the-art motion quality
2. **Gen-4 Aleph** (V2V Edit) — relight, reframe, scene modification
3. **Gen-4 Turbo** (I2V fast tier) — optional, pokud cost-per-clip je limiting

**Možné integrační cesty:**
- Official Runway API: `docs.dev.runwayml.com` (primary)
- Replicate wrapper: `runwayml/gen4-image`, `runwayml/gen4_turbo`
- Scenario API
- ComfyUI integration

**Audio handling poznámka:** Runway video modely **negenerují audio**. Runway má separate "Audio" tab (post-process). GIS UI pro Runway **by neměl ukazovat audio on/off toggle** — místo toho info message nebo link na separate audio generation.

**Aspect ratios (Gen-4.5):** Landscape 1280:720, 1584:672, 1104:832; Portrait 720:1280, 832:1104, 672:1584; Square 960:960. To je nejširší nabídka aspect ratios v této rodině.

**Doporučení:** Priorita MEDIUM. Runway má hodně unique features, ale velká integrace s novým API a minimalistická prompt filosofie jsou netrivial.

---

### 2.3 Luma Ray 2 Modify Video — V2V editing endpoint

**Kontext:** Luma API podporuje V2V editing přes Ray 2 / Ray Flash 2 Modify Video endpoint:
- Modes: `adhere_1..3`, `flex_1..3`, `reimagine_1..3` (spektrum od subtle adjustment po dramatic reinterpretation)
- Prompt register = **end-state description**, NOT commands (opak Grok/PixVerse/Runway Edit)

**Příklad:**
```
❌ "Change the lighting to sunset"
✅ "The scene is bathed in orange-red sunset light, long shadows cast forward"
```

**Dopad:** GIS nemá V2V editing pro Luma. V2V je jen pro Wan 2.7e, Grok Edit, PixVerse modify. Luma Modify by přidal další tier kvality.

**API endpoint:** pravděpodobně `api.lumalabs.ai/dream-machine/v1/generations` s `type: "modify"` nebo separate `/modify` endpoint. **Ověřit v Luma docs.**

**Doporučení:** Priorita LOW. Nice-to-have, ne blocker.

---

### 2.4 WAN 2.7 — 9-grid multi-image input

**Kontext:** Oficiálně: *"Wan 2.7 introduces native 1080p output, extended 15-second duration, first-and-last-frame video generation, **9-grid multi-image input**, instruction-based video editing, combined subject and voice referencing..."*

Fungování: uživatel uploadne grid 3×3 = 9 obrázků, model to interpretuje jako sekvenční storyboard — generuje video procházející všemi 9 beats postupně.

**Dopad:** GIS má `wan27_r2v` s max 5 refs. 9-grid je separate input mode, nikoli jen rozšíření ref count.

**Doporučení:** Priorita LOW. Niche feature pro storyboarding workflows. Pokud zájem, ověřit existenci endpointu na fal.ai nebo přímé Alibaba API.

---

### 2.5 Vidu Q3 — Pro / Turbo / Spicy / Extend / One-Click MV

**Kontext:** Vidu Q3 má víc variant než GIS integruje:

| Varianta | Funkce | GIS status |
|---|---|---|
| Q3 Pro | High-fidelity tier | ❌ |
| Q3 Turbo | Fast/cheap tier | ❌ |
| Q3 Image-to-Video Spicy | Enhanced motion ("bold movement, rich color") | ❌ |
| Q3 Extend | Video extension | ❌ |
| Q3 One-Click V2 MV | One-click music video generation | ❌ |

**Dopad:** GIS má jen 3 základní Q3 varianty (T2V, I2V, Frames). Pro/Turbo jsou tier split podobně jako Seedance Pro/Fast.

**Doporučení:** Priorita LOW-MEDIUM. Pro/Turbo tiers jsou standard multi-tier pattern. Pokud uživatelé narazí na quality/cost trade-off, Pro tier ano, Turbo ano. Spicy a MV jsou niche.

---

### 2.6 Grok — Audio generation from video

**Kontext:** xAI má samostatný endpoint `/v1/videos/{id}/audio` (kandidátní cesta) pro audio extraction / generation. Je to dále než jen "native audio-visual v generaci" — generuje audio post-hoc z existujícího videa.

**Dopad:** GIS nevyužívá. Pokud uživatel má muted video a chce dodat Grok-generated audio, musí jít manuálně přes xAI web.

**Doporučení:** Priorita LOW. Ověřit existenci endpointu před prioritizací.

---

### 2.7 WAN 2.7 — Extend endpoint (Video Extend)

**Kontext:** WaveSpeedAI sidebar docs ukazují samostatný `alibaba-wan-2.7-video-extend` endpoint pro rozšíření existujícího WAN videa.

**Dopad:** GIS má Extend jen pro Veo 3.1 a Kling. WAN extend by zvětšil pokrytí.

**Doporučení:** Priorita LOW. Pokud je extend functionality už pokrytá přes Veo/Kling, není urgent. Pro WAN-centric workflows ale relevant.

---

### 2.8 Kling Lipsync — standalone task type ⭐ NEW (session 3)

**Kontext:** Kling má samostatný Lipsync endpoint pro aplikaci audio (nebo text+voice_id) na existující video. Jiný než native audio v generaci — Lipsync se aplikuje POST-generaci na hotové video. Ověřit přesný fal.ai slug (kandidáti: `fal-ai/kling-video/v1/lipsync`, `fal-ai/kling-video/lipsync`).

**Dva módy:**
- **Audio-driven:** uživatel nahraje audio file (mp3/wav/m4a, 2-60s, max 5MB)
- **Text-driven:** uživatel napíše text + vybere voice_id z Voice Library → Kling generuje audio a syncuje

**Pre-processing kroky (GIS-side):**
- **`identify_face` endpoint call** před submit pokud video má multi-face — získá face_ids s bounding boxes
- Pokud jedna tvář → auto-select, žádný UI
- Pokud víc tváří → UI picker modal s thumbnails → user vybere target face
- Pokud tvář <15% frame height nebo heavy motion blur → warn user o nízké úspěšnosti

**Dopad:** GIS nemá Lipsync jako separate task flow. Pro filmový workflow v cizím jazyce (Petrův primary use case: český dialog) je to blokátor — Seedance/Kling native audio překládají do EN/ZH, takže český dialog vyžaduje Lipsync path s českým voice assetem.

**Doporučení:** Priorita HIGH pro Petrův workflow.

**Implementační dopad:** 
- Nový task type v `video-queue.js` (nebo nový `lipsync-queue.js`)
- Nové UI: "Lipsync existing video" flow, face picker modal, audio/text path selector
- Integrace s Voice Library (sekce 4)
- Payload má zcela jinou strukturu (žádný prompt, žádný negative — jen video_url + audio/text+voice_id + face_id)

---

### 2.9 Kling Voice Library — create-voice endpoint integration ⭐ NEW (session 3)

**Kontext:** Kling má `fal-ai/kling-video/create-voice` endpoint (ověřit přesný slug). Vstup: audio sample 10-30s čistého hlasu. Výstup: `voice_id` s cross-session persistence.

**Dopad:** Bez voice assetů musí uživatel při každé generaci s dialogem znovu nahrávat audio sample. S asset libraryí: vytvoříš voice jednou, pojmenuješ, znovu používáš napříč generacemi a klipy.

**Doporučení:** Priorita HIGH. Součást širší Character Library (sekce 4) — voice je často bindnutý ke konkrétnímu charakteru.

**Per user directive:** *"Hlas musíme bindovat s charakterem"* — voice je atribut Character Library entry, ne standalone asset. Ale má vlastní ID v Kling systému, takže technicky dva stores propojené foreign keyem.

---

### 2.10 Kling Elements (Character Library) — create-element endpoint ⭐ NEW (session 3)

**Kontext:** Kling má Elements mechanism pro persistent named characters:
- Input: 1-4 multi-angle images **nebo** 8s video
- Output: `element_id` + description
- V promptu volatelné jako `@Character1`, `@Character2`
- Cross-session persistence v Kling cloudu
- V3 podporuje max 3 elements v start-frame I2V generation, O3 více

**Endpoint ověřit:** Různé wrappers možná exposují pod různými URL (fal.ai, WaveSpeedAI). Pokud fal.ai neexposuje `create-element` přímo, je třeba alternativní cesta nebo direct Kling API.

**Dopad:** GIS nemá žádnou persistent character storage pro žádný model. Pro multi-clip workflow (storytelling, série scén se stejnými postavami) je to fundamentální limitace. Uživatel musí při každé generaci znovu uploadovat charakter refs.

**Doporučení:** Priorita HIGH. Součást Character Library (sekce 4).

**Rozdíl oproti existujícímu stavu:** GIS může mít "persistent refs" v Asset Library, ale to nejsou Kling Elements — Elements jsou server-side named entities se stabilním `element_id`. Bez nich GIS používá ad-hoc image_url refs per generation.

---

### 2.11 Seedance Frame-guided vs Omni exclusion ⭐ NEW (session 3)

**Kontext:** Seedance 2.0 má dva **vzájemně vylučující** módy vizuálního vstupu:
- **Frame-guided:** start_image + end_image (přes image-to-video endpoint s `end_image_url`)
- **Omni reference:** multiple images/videos/audio (přes reference-to-video endpoint)

Nelze kombinovat v jedné generaci.

**Dopad:** GIS UI pravděpodobně neforsuje toto omezení. Pokud uživatel nastaví start + end obrázky A zároveň multi-reference, payload selže nebo Seedance použije jen jednu kategorii (nejasně).

**Doporučení:** Middle priority. UI validation:
- Pokud start + end obrázky jsou nastavené → disable multi-reference slots (nebo vice versa)
- Nebo explicit mode selector: "Mode: Frame-guided | Omni reference" → UI adaptuje podle volby
- V hybrid módu generator může upozornit: "Seedance nedokáže kombinovat start/end s multi-reference. Která cesta?"

**Lokace v kódu:** `video-models.js` Seedance entries + UI validation layer.

---

### 2.12 Seedance R2V s video refs — 0.6× price multiplier ⭐ NEW (session 3)

**Kontext:** Z userMemories: *"Seedance 2.0 pricing: ... R2V with video refs ×0.6 multiplier"*.

R2V endpoint Seedance dostává 0.6× slevu, pokud mezi refs je video (motion transfer, video editing use cases).

**Dopad:** Pokud GIS `spending.js` nemá multiplier logic pro tento case, odhad ceny bude overcharge × 1.67 vůči reálné ceně. Uživatel vidí falešnou cenu.

**Status:** Z userMemories není jasné, zda už je toto v `spending.js` implementováno. Ověřit v kódu.

**Doporučení:** Verify + fix pokud chybí. Medium priority.

---

### 2.13 Veo 3.1 — constraints that limit GIS features ⭐ NEW (session 3)

**Kontext:** Veo 3.1 má několik constraintů, které omezují feature parity s ostatními modely:

1. **Max 3 reference images** (hard cap)
2. **Žádný style reference support** v 3.1 — `referenceImages.style` je jen `veo-2.0-generate-exp`; Veo 3.1 akceptuje jen `referenceType: "asset"` (character/product/scene)
3. **Žádný V2V mode** — jen Extend
4. **Žádný standalone Lipsync** — lip-sync je native v každé Veo generaci (ne separate endpoint)
5. **Clip durations jen 4, 6, 8 sekund** — ne 10s, 15s jako jinde
6. **Extend možná jen na Veo-generovaných videích** — verify at implementation; některé API wrappers to relaxují

**Dopad:** Uživatel očekává feature parity napříč modely. Když selektuje Veo pro V2V nebo style reference, dostane silent error nebo wrong behavior.

**Doporučení:** GIS UI musí být model-aware:
- Veo active → hide/disable V2V toggle, hide style reference role, hide Lipsync task button, limit duration selector na 4/6/8
- Veo active + uživatel attachne 4+ refs → warn a ask pick 3
- Veo active + uživatel selektuje Extend na ne-Veo videu → warn, offer I2V s last frame

**Lokace v kódu:** `model-select.js` + `video-models.js` uiOverrides pro `veo_3_1_*` types.

---

### 2.14 Veo text overlay hallucination — auto-negative default ⭐ NEW (session 3)

**Kontext:** Veo 3.1 občas halucinuje titulky a text overlays v dialogových klipech (watermarks, captions). Google oficiální prompt guide to explicitně zmiňuje.

**Dopad:** Bez explicit negative prompt může Veo output obsahovat nežádoucí text v obraze.

**Doporučení:** GIS pro Veo model typy by měl mít default negative prompt seed:
```
subtitles, captions, watermark, text overlays
```

Buď jako default hodnota negative prompt fieldu pro Veo, nebo injection při payload build.

**Lokace v kódu:** Veo handler / `video-models.js` default negative prompt field pro Veo entries.

---

## 3. UI a UX integrace (🟢 ENHANCEMENT)

### 3.1 Dialogue language warnings pro Chinese-origin modely

**Kontext:** WAN 2.6, Vidu Q3, Kling V3+O3, Seedance 2.0 — všechny auto-translate non-EN/ZH dialog:
- WAN 2.6: *"Supports both Chinese and English, with a minimum of 2 characters and a maximum of 5,000 characters."* — non-EN/ZH auto-translated
- Vidu Q3: Chinese-origin (Shengshu), EN/ZH native, other languages translated
- Kling: best s EN/ZH, other languages varied
- Seedance: explicitly stated — EN/ZH native, other languages translated to EN internally

**Dopad:** Český uživatel napíše dialog: *"Konečně jsi tady."* → model to auto-přeloží do EN/ZH → lip-sync sync na překlad, ne původní český text. Výstupní video má anglický dialog s českým promptem jinak.

**Doporučení:** UI warning když user píše dialog v `"quotes"` na modelech WAN 2.6, Vidu Q3, Kling, Seedance:
> ⚠️ *"Dialog bude automaticky přeložen do EN/ZH pro lip-sync. Pro český dialog použij Kling Lipsync s nahraným českým voice trackem."*

Nebo hybrid-mode poznámka generátoru (už obsaženo v PART C.7.1 a C.8 rules).

---

### 3.2 WAN 2.7 R2V voice extraction — UI tooltip

**Kontext:** Když uživatel nahrává reference VIDEO (ne image) do `wan27_r2v`, model **extrahuje voice timbre** z toho videa a aplikuje ho na generated dialog v output videu. Je to unique feature — žádný jiný model v GIS takto nefunguje.

**Dopad:** Uživatel nahraje video s hlasem a píše v promptu nový dialog → dostane nový dialog v hlase z reference videa. Pokud chtěl jiný hlas, nečeká toto chování.

**Doporučení:** Tooltip / info popup u reference upload slotu pro `wan27_r2v`:
> ℹ️ *"Pokud nahraješ video (ne image), Wan 2.7 R2V extrahuje hlas z videa a aplikuje ho na dialog v generovaném výstupu. Pro jiný hlas, nahraj jen image refs."*

---

### 3.3 Luma — no audio indicator

**Kontext:** Všechny Luma varianty (Ray 2, 2 Flash, 3, 3 HDR, 3.14, 3.14 HDR) generují **silent video**. Žádná z nich nemá native audio.

**Dopad:** Uživatel si toho nemusí být vědom. Pokud píše dialog nebo zadává audio expectations v promptu, dostane silent video.

**Doporučení:** Badge / label "No audio" u Luma modelů v modelselect. Alternativně info banner při selectu Luma modelu.

---

### 3.4 Runway — no in-generation audio indicator (pokud integrace proběhne)

**Kontext:** Runway video modely (Gen-4, Gen-4.5, Gen-4 Turbo, Gen-4 Aleph) negenerují audio. Runway má **separate** "Audio" tab pro post-process generování SFX/ambient z text descriptions.

**Dopad:** Pokud bude integrace, uživatel zvyklý na Kling/Veo/Seedance native audio čeká stejné chování u Runway → dostane silent video.

**Doporučení:** Při select Runway modelu:
- Audio on/off toggle skrýt nebo replace s info message: *"Runway video modely negenerují audio. Audio lze vytvořit separate Audio tool v Runway nebo v post-produkci."*
- Link na Runway audio docs nebo workflow example

---

### 3.5 Vidu Q3 duration slider — artificial cap

**Kontext:** GIS má duration slider config pro `vidu_video`:
```
{ min: 4, max: 8, step: 4, default: 4 }
```

Ale **Vidu Q3 nativně podporuje až 16s**. Většina modelů to nemá (Kling max 10s, Veo max 8s, Luma 10s, Grok 15s, PixVerse 15s, WAN 15s, Seedance 10s). **Vidu 16s je nejdelší v rodině.**

**Dopad:** Uživatel je limitován na 8s, když model umí 16s. Ztracená value proposition.

**Doporučení:** Rozšířit slider na `min: 4, max: 16, step: 4` nebo `step: 2`. Ověřit, že pricing škáluje lineárně ($0.154/s × 16 = $2.46 per clip).

**Lokace v kódu:** `video-models.js` řádek 847 (viz grep výstup):
```javascript
'vidu_video': { min: 4, max: 8, step: 4, default: 4 },
```

---

### 3.6 `enable_prompt_expansion` flag — set to false at submit

**Kontext:** WAN 2.6 a WAN 2.7 mají flag `enable_prompt_expansion`. Když `true`, model auto-rozšiřuje krátké prompty o cinematic details. Podobný flag existuje také ve Vidu ("built-in Prompt Enhancer").

**Dopad:** Prompt generátor už dělá plnou expansion (30+ slov minimum pro většinu modelů, 100+ slov pro Luma, Kling atd.). Pokud GIS pošle `enable_prompt_expansion: true`, dojde k **dvojí expanzi** — generátor × model. To může vést k:
- Rozchodové prompty (model expanduje proti našemu záměru)
- Nepredictable output
- Degraded quality

**Doporučení:** Při submit vždy set `enable_prompt_expansion: false` v payload pro WAN 2.6, WAN 2.7 a Vidu Q3 (pokud má equivalent flag).

**Lokace v kódu:** Payload assembly v `_buildUnifiedVideoParams` nebo per-model handler. Ověřit aktuální stav.

---

### 3.7 xAI Grok reference syntax — ověřit `<IMAGE_N>`

**Kontext:** Z userMemories: *"Reference prefix `[Reference images:...]`: REMOVED in v200en. `@mentions` still convert: `image N` for Gemini/xAI..."*

Ale xAI oficiální docs ukazují syntax `<IMAGE_1>`, `<IMAGE_2>` (angle brackets, uppercase).

**Dopad:** Pokud GIS aktuálně konvertuje `@mention` na `image N` pro xAI (lowercase, no brackets), může to fungovat — Grok Aurora může parsovat obě varianty. Ale oficiální syntax je `<IMAGE_N>`, tj. bezpečnější.

**Doporučení:** 
1. Test: submit Ref2V prompt s `<IMAGE_1>` vs `image 1` na stejný input, porovnat quality výsledku
2. Pokud `<IMAGE_N>` lepší, změnit GIS konverzi

**Lokace v kódu:** Vyhledat `image N` nebo `@mention` conversion logic v GIS pro xai_video type. Pravděpodobně v `video-queue.js` nebo `generate.js` při prompt assembly.

---

### 3.8 Runway Reference Library — integrace s GIS ref systémem

**Kontext (pokud Runway integrace proběhne):** Runway má "Reference Library" — user může uložit ref s jménem a v promptu volat přes `@name`. GIS má vlastní ref systém s interním jménem (`@ref101`) + user-renamed visual label.

**Dopad:** Dva různé ref naming systémy potřebují sjednocení:
- GIS interní ID: `@ref101`
- GIS user-renamed: `@hero` (visual label)
- Runway saved ref: `@hero` (v Runway library)

**Doporučení:** Při integraci Runway:
- User-renamed GIS label → `@name` v Runway prompt
- Unnamed / default GIS ref → `image_1`, `image_2`, `image_3` positional
- NE sync s Runway Reference Library (storage je v GIS, ne v Runway)

---

### 3.9 Style preset konflikt — silent adaptation pattern

**Kontext:** PixVerse V6 má 5 style presets (anime, 3d_animation, clay, comic, cyberpunk). Jeden preset je user UI choice. Konflikt nastane, když user má preset `anime` aktivní a napíše prompt *"anime style girl in photorealistic detail"* — "photorealistic" je v konfliktu s "anime".

**Dopad:** Bez resolution může výstup být chaotický nebo preset bude ignorován.

**Doporučení:** Prompt generator silent-adapts (odstraní "photorealistic" před odesláním). User vidí výsledný prompt v UI a může vetovat. Bez explicit warning — výsledek je transparentní ve viditelném promptu.

**Status:** Je to generator rule, ale vyžaduje GIS support pro zobrazení finálního promptu užívateli **před** submit (user může editovat). Ověřit, že GIS UI tento flow má.

---

### 3.10 "Add background audio/mood" toggle — Rule 2 control ⭐ NEW (session 3)

**Kontext:** Per user directive ze session 3: *"mood/zvukový podkres. Nikdy nepoužívat pokud si ho uživatel nevyžádá. Znehodnotí to hlasy herců."*

Prompt generator má hard rule **nevkládat audio mood** do promptů bez explicit user request. Pro filmovou tvorbu je kritické mít clean voice tracks bez unremovable scoringu (není možné po generaci oddělit hudbu od dialogu).

**Dopad:** Všechny modely s native audio (Kling, Veo, Seedance, Vidu, Grok, WAN 2.6, PixVerse) defaultně vloží mood audio, pokud v promptu generator naznačí náladu. GIS musí mít explicit UI control.

**Doporučení:** UI toggle "Add background audio/mood" per generation:
- **Default: OFF** (strict — žádné mood audio)
- **ON:** generator může vkládat mood-matched audio per model rules

**Placement:** per-generation toggle vedle model selektoru. Sticky mezi generacemi volitelný.

**Behavior when OFF:**
- Generator nepíše `Audio: mood descriptor` bloky do promptu
- Dialog (když user napíše) zůstává
- Diegetické zvuky (kroky z běhu, bouchnutí dveří) OK pokud plynou z akce
- Žádný underscore, žádná hudba, žádné atmosferické drony

**Lokace v kódu:** Nový UI element v `template.html` + payload flag `audio_mood_enabled` který prompt generator respektuje.

---

### 3.11 Typed reference slots — role assignment ⭐ NEW (session 3)

**Kontext:** Reference obrázky mají role (subject, style, environment, material, motion, audio). Aktuálně GIS `refs.js` pravděpodobně zachází se všemi uniformně. Generator potřebuje role vědět, aby napsal správné prompty:
- Veo vyžaduje explicit "Reference priority" block s role každé reference
- Seedance R2V potřebuje role assignment v prose
- Kling Elements roles matter méně (character je character), ale style/env refs potřebují rozlišení

**Dopad:** Bez typed refs generator neví, co má s každou referencí dělat. Automaticky hádá → chyby (character bleed into environment, atd.).

**Doporučení:** Reference slot UI rozšířit o role dropdown:
- Subject (character identity) — default pokud nejasné
- Style (mood, color, lighting plate)
- Environment (location, spatial)
- Material (texture, wardrobe detail)
- Motion (video reference pro kinetic style)
- Audio (audio reference pro rhythm)

Backward compat: existující refs bez role → default "Subject".

Model-aware filtering:
- Veo 3.1 active → "Style" role disabled (není supported)
- Kling active → všechny role available
- Seedance active → všechny role available

**Lokace v kódu:** `refs.js` + UI v `template.html` (ref slot markup).

---

### 3.12 Model capability matrix UI ⭐ NEW (session 3)

**Kontext:** Uživatelé přepínající mezi modely narážejí na feature inconsistencies (Veo bez V2V, Seedance bez formal characters, Luma bez audio). Bez visible matrix je to frustrující.

**Obsah matrix:**

| Feature | Kling V3/O3 | Seedance 2.0 | Veo 3.1 | Luma Ray | Grok | PixVerse | WAN 2.6/2.7 | Vidu Q3 |
|---|---|---|---|---|---|---|---|---|
| T2V | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| I2V | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Start/End Frame | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |
| Multi-reference | 4 Elements | 9+3+3 | 3 asset only | 1 (Ray 3) | 7 (Ref2V) | N (Fusion) | 5 | 4 (R2V) |
| V2V | O3 | ✅ | — | 2 Modify | ✅ Edit | Modify | 2.7e | — |
| Extend | ✅ | ✅ | ✅ Veo-only | — | — | — | 2.7 | Future |
| Lipsync (standalone) | ✅ | — | — | — | — | — | — | — |
| Style reference | ✅ | ✅ | — | ✅ | ✅ | presets | ✅ | ✅ |
| Character element (persistent) | ✅ | — | — | Ray 3 ref | — | Fusion | — | — |
| Voice binding | ✅ | — | — | — | — | — | 2.7 R2V | — |
| Native audio | ✅ | ✅ | ✅ | — | ✅ | ✅ | 2.6 only | ✅ |

**Placement:** Settings page nebo info overlay přístupné z model selectoru (ikonka "i").

**Priorita:** Medium. Nice-to-have pro onboarding, ale core users to budou znát.

---

### 3.13 Face picker modal pro Kling Lipsync ⭐ NEW (session 3)

**Kontext:** Kling Lipsync s multi-face videy vyžaduje `face_id` selection. Bez něj Kling auto-vybere první/největší tvář (často špatně) nebo selže.

**Workflow:**
1. User nahraje video pro Lipsync
2. GIS call `identify_face` endpoint → dostane array face_ids s bounding boxes + thumbnail frames
3. Single face → auto-select silently
4. Multi-face → modal s face thumbnails → user click target face
5. `face_id` jde do Lipsync payload
6. Edge case: pokud jedna tvář covering >40% detected face area, auto-select + log

**Dopad:** Bez UI je Lipsync unreliable pro multi-person scény.

**Doporučení:** High priority, součást Lipsync task integration (sekce 2.8).

**Lokace v kódu:** Nový modal komponent, face_id state management, integrace s Lipsync task flow.

---

### 3.14 Duration selector per-model awareness ⭐ NEW (session 3)

**Kontext:** Různé modely mají různé duration ranges:
- Veo 3.1: jen 4, 6, 8 sekund (discrete)
- Kling: 5, 10 (některé varianty 15)
- Seedance: continuous do 10s
- Luma: continuous do 10s
- Grok: do 15s
- PixVerse: do 15s
- WAN: do 15s
- Vidu Q3: do 16s (po fix sekce 3.5)

**Dopad:** Sekce 3.5 už toto zmiňuje pro Vidu. Širší pattern: GIS duration selector by měl adapter per selected model.

**Doporučení:** Per-model duration config object v `video-models.js`. UI selector čte config a renderuje slider/picker podle typu (continuous slider vs discrete options).

**Specific Veo change:** Pro Veo duration musí být discrete picker (4/6/8), ne continuous slider (nebude fungovat 5s, 7s atd.).

---

### 3.15 Video source tagging — pro Extend task validace ⭐ NEW (session 3)

**Kontext:** Některé Extend endpoints mají constraint na zdrojové video:
- Veo 3.1 Extend: možná vyžaduje Veo-generated source (verify)
- Kling Extend: probably OK s jakýmkoli zdrojem, ověřit

**Dopad:** Uživatel může selektovat Extend task a dostane cross-model error.

**Doporučení:** Tag každé generated video v GIS Video Library s `source_model: "veo-3.1" | "kling-v3" | "seedance-2.0" | ... | "external_upload"`. Generator a/nebo payload builder check tag před Extend task submit.

**Lokace v kódu:** `video-gallery.js` + IndexedDB video store schema (viz sekce 4 — schema migrations).

---

### 3.16 Dialogue input UX — deferred optimization ⭐ NEW (session 3)

**Kontext:** Uživatelé píší dialog v prose promptech inconsistently ("character says: '...'", "'...' he replied", quotes bez attribution). Generator detection funguje, ale explicitní input by byl cleaner.

**Dopad:** Občasný miss detection → generator neví, že má dialogue přidat voice binding / physiological coating.

**Doporučení:** Optional UX enhancement — separate "Dialogue" multi-line field v composer. Každá řádka attributed to character (dropdown ze Character Library). Generator composes finální prompt s correct syntaxí per model.

**Priorita:** Deferred. Nice-to-have optimization. Current prose-with-detection works, jen občas miss.

---

## 4. Character Library pro Kling (a další modely)

**Kontext:** Kling V3 + O3 mají **Elements** mode (až 4 ref slotů) + **voice library** (`create-voice` endpoint). Uživatel může:
1. Vytvořit "Element" = pojmenovaná character reference uložená v Kling cloud
2. Vytvořit voice asset z audio sample
3. Ve more generacích volat `@Element1`, `@Element2` pro consistent character

**GIS status:** Z userMemories *"kling_video / pixverse_video / vidu_video all use KLING_GROUPS"*. Aktuálně **GIS nemá persistent character library napříč sessions** — ověřit v kódu, ale z interakcí je zřejmé, že uživatel musí pokaždé znova uploadovat ref image.

**Dopad:** Pokud nemá, uživatel pracující na multi-clip storytelling workflow musí pokaždé znovu uploadovat stejné character refs. Kling umí consistent character přes Elements — využili bychom to jen zčásti.

**Obecnější princip:** Tento character library pattern by měl fungovat i pro:
- Grok Ref2V (`<IMAGE_N>` = positional, ale local storage může přejmenovat)
- PixVerse C1 Fusion (`@ref_name` free-form, sanitized)
- WAN 2.6 R2V Flash (`Character1, Character2` inline)
- WAN 2.7 R2V (positional `Video 1, Image 1`)
- Vidu Q3 R2V Mix (implicit, ale cached via GIS naming)
- Runway (`@name` saved refs)

Každý model má jinou syntax, ale princip je stejný: **user-facing character = GIS persistent asset**, per-model syntax conversion je generator's job.

---

### 4.1 Character Library schema ⭐ NEW (session 3 — detail rozšíření)

**Purpose:** Persistent storage pro reusable character assets napříč sessions a generations.

**Schema (follows GIS meta + data split pattern):**

```
characters_meta (lightweight, always loaded pro listing):
  - character_id (PK, local GIS ID)
  - kling_element_id (nullable — present pokud bylo uploadnuto do Kling)
  - name (user-provided)
  - source_type: "images" | "video"
  - thumbnail_url (první reference image nebo video frame)
  - bound_voice_id (nullable FK → voices)
  - supported_models: ["kling-v3", "kling-o1", "seedance-2.0", "grok", ...]
  - created_at
  - last_used_at

characters_data (heavy, loaded on demand):
  - character_id (FK)
  - description (auto-generated from vision pass)
  - reference_urls[] (1-4 image URLs nebo 1 video URL — local asset URLs)
  - vision_metadata (structured extraction results pro generator context)
```

**Split rationale:** Match existing GIS pattern (`images_meta` + heavy image data split). Character listing v UI by nemělo loadovat full descriptions a all reference URLs — only thumbnails.

**Operations needed:**
- Create from image upload (1-4 multi-angle) → optional call to Kling `create-element` endpoint pro `kling_element_id`
- Create from video upload (8s clip) → optional call to Kling `create-element`
- List all characters s thumbnails
- Edit name, delete character (handle dangling voice reference)
- Mark "used in generation" (update `last_used_at`)
- Check model compatibility před injection do prompt

**Known constraint:** Kling V3 podporuje max 3 elements v start-frame I2V generation, O3 více. GIS by měl warn před generation pokud user selected 4+ elements pro V3 task.

---

### 4.2 Voice Library schema ⭐ NEW (session 3 — detail rozšíření)

**Purpose:** Persistent storage pro voice_ids vytvořené z audio samples.

**Schema:**

```
voices_meta:
  - voice_id (PK, local GIS ID)
  - kling_voice_id (nullable — present pokud uploadnuto do Kling)
  - name (user-provided)
  - language: "en" | "cs" | "zh" | ...
  - source_audio_thumbnail_url (waveform thumbnail nebo link)
  - bound_to_character_id (nullable FK → characters)
  - created_at

voices_data:
  - voice_id (FK)
  - source_audio_url (original audio sample, local)
  - sample_duration_ms
```

**Operations needed:**
- Create voice z uploaded audio (10-30s recommended) → call Kling `create-voice`
- List voices s language tag
- Bind voice to existing character (update `bound_to_character_id`)
- Unbind voice
- Delete voice (handle dangling character reference)

**Known constraint:** Max 2 voice_ids per task v Kling generation. GIS musí enforce před payload submission — pokud scéna má 3+ charakterů s dialogem, block a prompt user to narrow nebo split.

---

### 4.3 Cross-model compatibility decision ⭐ NEW (session 3)

**Open question:** Má Character Library a Voice Library fungovat jen pro Kling (který má formal element_id/voice_id systém), nebo má GIS vytvořit unified "Character" assets které mapují per-model references (Seedance @Image refs, Veo asset refs)?

**Dvě opce:**

*Option A — Separate per-model:* Character Library je Kling-only. Pro Seedance/Veo uživatel vybírá individual images z Asset Library jako ad-hoc references. Cleaner architecturally, more fragmented UX.

*Option B — Unified characters:* Single "Character" asset s per-model mapping. Vytvoří Kling element, ukládá Seedance-compatible images, mapuje na Veo asset references. Cleaner UX, more engineering.

**Doporučení:** Start with **Option B** (unified). Schema v sekci 4.1 to už podporuje přes `supported_models[]` field. Při generation:
- Kling: použij `kling_element_id` pokud present, jinak upload refs jako ad-hoc
- Seedance: použij `reference_urls[]` jako @Image N refs
- Veo: použij `reference_urls[]` jako asset references (max 3)
- Ostatní modely: per-model reference conversion

Důvod pro Option B: Petrův workflow je **multi-clip cross-model filmmaking** — stejná postava přes různé scény různých modelů. Option A by znamenala duplicate assets per model, frustrating UX.

**Alternative:** Pokud Option B engineering cost too high, phased rollout:
- Phase 1: Kling-only (Option A)
- Phase 2: Rozšíření na Seedance (přidá reference_urls handling)
- Phase 3: Veo + ostatní

---

## 5. Code-level verification checklist (🔵 VERIFY)

### 5.1 Endpoint URLs — spot checks

| Model | Expected endpoint | Lokace v kódu |
|---|---|---|
| PixVerse C1 Fusion | `/video/fusion/generate` | `video-models.js` c1_fusion entry |
| PixVerse C1 I2V | `/video/img/generate` (ne `/video/image/generate`) | c1_i2v entry |
| WAN 2.6 R2V Flash | `wan/v2.6/reference-to-video/flash` | wan26_r2v_flash entry |
| WAN 2.7 I2V | `fal-ai/wan/v2.7/image-to-video` | wan27_i2v entry |
| Vidu Q3 T2V | `fal-ai/vidu/q3/text-to-video` | vidu_q3_t2v entry |
| Luma všechny | `api.lumalabs.ai/dream-machine/v1/generations` (single endpoint) | all ray_* entries |
| Grok | `api.x.ai/v1/videos/generations` | xai_video handler |
| **Kling V3 Standard T2V** ⭐ | `fal-ai/kling-video/v3/standard/text-to-video` | kling_* entries |
| **Kling V3 Standard I2V** ⭐ | `fal-ai/kling-video/v3/standard/image-to-video` | kling_* entries |
| **Kling V3 Pro I2V** ⭐ | `fal-ai/kling-video/v3/pro/image-to-video` | kling_* entries |
| **Kling O1/O3** ⭐ | `fal-ai/kling-video/o1/*` (Omni endpoints) | kling_o* entries |
| **Kling create-voice** ⭐ | `fal-ai/kling-video/create-voice` (ověřit slug) | — nový |
| **Kling create-element** ⭐ | ověřit zda exposed na fal.ai | — nový |
| **Kling Lipsync** ⭐ | ověřit slug (`fal-ai/kling-video/v1/lipsync` kandidát) | — nový |
| **Seedance T2V** ⭐ | `bytedance/seedance-2.0/text-to-video` (+`/fast`) | seedance_* entries |
| **Seedance I2V** ⭐ | `bytedance/seedance-2.0/image-to-video` (+`/fast`) | seedance_* entries |
| **Seedance R2V** ⭐ | `bytedance/seedance-2.0/reference-to-video` (+`/fast`) | seedance_* entries |
| **Veo T2V + I2V** ⭐ | `veo-3.1-generate-preview` | veo_* entries |
| **Veo First/Last** ⭐ | `veo-3.1-first-last-image-to-video` | veo_* entries |
| **Veo Reference** ⭐ | `veo-3.1-reference-to-video` | veo_* entries |
| **Veo Extend** ⭐ | `veo-3.1-extend-video` | veo_* entries |

**Doporučení:** Grep každý endpoint v kódu, ověřit, že zkripty odpovídají. Aktuálně ověřené jen visually během research.

---

### 5.2 Audio field naming consistency

Různé modely používají různé audio field názvy:

| Model | Audio field | Hodnota |
|---|---|---|
| Kling, Veo, Seedance | `generate_audio` | boolean |
| PixVerse V6/C1 | `generate_audio_switch` | boolean |
| WAN 2.6 | `enable_audio` | boolean |
| WAN 2.7 | n/a (no native audio T2V/I2V) | — |
| Vidu Q3 | `audio` | boolean (default true) |
| Grok | always on (Aurora), no toggle | — |
| Luma | n/a (no audio) | — |
| Runway | n/a (separate tool) | — |

**Doporučení:** Ověřit GIS `audioField` override per model entry v `video-models.js`. Model entries mají custom field names (např. Vidu má `audioField: 'audio'`, WAN 2.6 R2V Flash má `audioField: 'enable_audio'`).

**⭐ NEW (session 3) — Rule 2 interaction:** Bez ohledu na field name, Rule 2 control ("Add background audio/mood" toggle, sekce 3.10) rozhoduje, jestli generator vkládá audio content. GIS UI toggle řídí flag v payload separate od native `generate_audio`.

---

### 5.3 Duration field type per model

| Model | Type | Example |
|---|---|---|
| Kling | **string** ⭐ (z userMemories) | `"5"`, `"10"` |
| Veo, Seedance, Luma, Grok | integer | `duration: 10` |
| WAN 2.6 | string | `"5"`, `"10"`, `"15"` |
| WAN 2.7 | integer | `5, 10, 15` |
| Vidu Q3 | integer (`durationInt: true`) | `8, 16` |

**⭐ NEW note (session 3):** Ověřen konflikt — Kling vyžaduje string, Seedance vyžaduje integer. Payload builder musí správně konvertovat per-model.

**Doporučení:** Ověřit, že payload builder správně konvertuje type per model. `durationInt: true` flag v model entry řídí integer vs string — správně funguje? Je Kling označený jako string (opak většiny)?

---

### 5.4 Extend mode — WAN 2.7 Extend exists (ne v GIS)

WaveSpeed sidebar zobrazuje `alibaba-wan-2.7-video-extend` endpoint. Ověřit jeho dostupnost na fal.ai, pokud potřeba.

---

### 5.5 Reference syntax per model ⭐ NEW (session 3)

Jednotná tabulka reference mention syntaxí napříč všemi modely:

| Model | Reference syntax | Notes |
|---|---|---|
| Kling V3/O3 Elements | `@Character1`, `@Character2` | generator uses `@` |
| Kling V3/O3 voice binding | `@Character1 says: "..."` | voice bindnutý v elementu |
| Kling voice_ids (without binding) | `<<<voice_1>>>` markers | max 2 per task |
| Seedance R2V omni | `@Image1`, `@Video1`, `@Audio1` | primary per fal.ai GitHub; some docs show `[Image1]` — verify |
| Veo 3.1 | Reference priority block v prose | no mention tags, uses "Reference 1:" labels |
| Grok Ref2V | `<IMAGE_1>`, `<IMAGE_2>` | uppercase, angle brackets per xAI docs |
| PixVerse C1 Fusion | `@ref_name` (alphanumeric sanitized) | free-form user-renamed |
| WAN 2.6 R2V | `Character1, Character2` inline | no @ prefix |
| WAN 2.7 R2V | `Video 1, Image 1` positional | no @ prefix |
| Vidu Q3 R2V | natural language subject descriptions | no positional tags |

**Doporučení:** GIS generator má per-model reference syntax conversion — ověřit, že conversion je correct pro všech 10+ modelů. Reference conversion pravděpodobně v `ai-video-prompt.js` (new module) nebo v prompt assembly layer.

---

### 5.6 Pricing / spending verification ⭐ NEW (session 3)

**Needs audit:**

1. **Veo 3.1 pricing keys** — per-resolution a per-duration. Verify current rates (likely updated since last GIS sync).
2. **Veo 3.1 Fast pricing** — separate keys.
3. **Kling voice creation pricing** — pokud separately priced beyond base call.
4. **Kling element creation pricing** — pokud separately priced.
5. **Kling Lipsync pricing** — duration-based.
6. **Seedance R2V s video refs** — 0.6× multiplier logic v spending estimation (viz sekce 2.12).
7. **Seedance fast tier** — separate per-resolution keys (už v place per userMemories v204en+, verify).
8. **Vidu 16s duration pricing** — pokud se fixne sekce 3.5, verify $0.154/s × 16 scaling.

**Action item:** Audit `spending.js` against current provider pricing pages. Update keys. Test s dry-run generations to verify estimates match actual billing.

---

## 6. Dokumentační a skill updates

### 6.1 userMemories update — po implementaci nebo refaktoru

Jakmile proběhne fix `camera_movement` dropdownu pro PixVerse V6/C1, aktualizovat userMemories:
> "PixVerse V6/C1 `camera_movement` field je legacy V5-only, deprecated — GIS dropdown skrytý pro V6/C1 (v210en+)"

Podobně pro každý fix / addition.

**⭐ Session 3 additions k userMemories po implementaci:**
> "Character Library implemented v vXXXen — unified cross-model character assets with Kling element_id binding. Voice Library with bind to character. Rule 2 audio control toggle (default OFF) for filmmaker-clean voice tracks."
> "Video prompt generator module ai-video-prompt.js — per-model system prompts, vision pass via OpenRouter."
> "Lipsync task as separate flow (Kling-only) with identify_face pre-call."

---

### 6.2 gis-edit-workflow skill — přidat runtime checks

Do povinného workflow přidat:
1. Before build: grep `./handlers/fal.js` → error (má být `fal-inpaint.js`)
2. Before build: grep non-inline endpoints — ověřit, že každý endpoint je documentovaný
3. After build: automated test že model selection zobrazuje camera dropdown jen pro modely, které ho skutečně mají (PixVerse V5, Kling motion_control...)
4. ⭐ Session 3: Grep `prompt: ""` nebo empty prompt in Kling payload paths → warn
5. ⭐ Session 3: Grep audio mood descriptors v generator output testy (Rule 2 leak detection)

---

### 6.3 Per-model quick reference tabulka

Pro rychlou orientaci při implementaci nového modelu — tato tabulka by mohla jít do `ARCHITECTURE.md`:

| Model | Positive-only | Native audio | Max refs | Duration cap | Endpoint auth |
|---|---|---|---|---|---|
| Kling V3/O3 | ❌ | ✅ | 4 (Elements) | 10-15s | fal.ai |
| Seedance 2.0 | ❌ | ✅ | 9 | 10s | fal.ai |
| Veo 3.1 | ❌ (reformulated) | ✅ | 3 asset only | 8s | Google/fal.ai wrapper |
| Luma Ray (all) | ✅ | ❌ | 1 char (Ray 3) + keyframes | 10s | Luma direct |
| Grok Imagine | ✅ | ✅ | 7 (Ref2V) | 15s (8.7s V2V) | xAI direct |
| PixVerse C1 | ❌ | ✅ | N (Fusion) | 15s | PixVerse direct |
| PixVerse V6 | ❌ | ✅ | 1 (I2V) + 2 (Transition) | 15s | PixVerse direct |
| WAN 2.6 | ❌ | ✅ | 5 (R2V Flash) | 15s | GIS proxy |
| WAN 2.7 / 2.7e | ❌ | ❌ (R2V extracts) | 5 (mixed video+image) | 15s | fal.ai |
| Vidu Q3 | ❌ | ✅ (audio-first) | 1 (I2V) / 2 (Frames) / 4 (R2V future) | 16s | fal.ai |
| Runway Gen-4.5 (future) | ✅ | ❌ (separate) | 3 | 10s | Runway direct |

---

### 6.4 Documentation updates ⭐ NEW (session 3)

**STAV.md additions** (po implementaci prompt generator):
- Version bump
- New modules: ai-video-prompt.js, character-library.js, voice-library.js
- New UI: Character Library, Voice Library, audio mood toggle, typed ref slots
- Database schema bump + migration

**ARCHITECTURE.md additions:**
- Asset architecture expansion: characters a voices jako first-class assets
- Vision pass integration flow (OpenRouter primary, Gemini Flash fallback)
- Generator → Payload transformation pipeline

**API_MODELS.md additions:**
- Kling element_id lifecycle a endpoints
- Kling voice_id lifecycle a endpoints
- Seedance omni endpoint full parameter map
- Veo reference types a constraints
- Cross-reference to VIDEO_PROMPT_GENERATOR.md pro prompt-side rules

**User-facing manual (GIS_Manual):**
- New section: "Character Library" — how to create, use, bind voices
- New section: "Voice Library" — how to create, language support
- New section: "Video Generation Guide" — per-model task matrix, co co může
- Audio toggle explanation pro filmmakers (why default OFF)
- Typed reference slots explanation

---

## 7. Error handling / fallback chains ⭐ NEW section (session 3)

Unified error handling table pro video generator integration:

| Condition | GIS handling |
|---|---|
| Vision pass (OpenRouter) unreachable | Fallback to Gemini Flash. Warn: "AI analysis degraded." |
| All LLM APIs down | Use raw user prompt, skip transformation. Warn: "AI prompt enhancement unavailable." |
| Veo reference-to-video vrací 400 | Retry as I2V s první reference. Warn user (sekce 1.5). |
| User attaches style ref pro Veo 3.1 | Translate to prompt text via vision pass. Warn user (sekce 2.13). |
| User attaches 4+ refs pro Veo | Use first 3. Prompt user to pick which to drop. |
| User attaches 5+ refs pro Kling Elements | Use first 4. Prompt user. |
| Seedance frame-guided + omni mix | Block. Prompt user to pick mode (sekce 2.11). |
| Kling Lipsync: >1 face, no face_id | Call identify_face, show picker UI (sekce 3.13). |
| Kling Lipsync: 0 faces detected | Error. Video not suitable for lipsync. |
| Kling max 2 voices exceeded | Prompt user to narrow speakers nebo split generation. |
| Kling `prompt: ""` edge case | Fallback to "animate the scene naturally" nebo error (sekce 1.4). |
| Non-EN/ZH dialogue pro Seedance/Kling/Vidu/WAN | Warn. Offer Lipsync path pro native language (sekce 3.1). |
| Veo Extend: non-Veo source | Warn. Offer I2V s last frame instead. |
| Element not found (expired/invalid) | Mark invalid v library. Prompt user to recreate. |
| Voice not found | Mark invalid. Prompt user to recreate nebo rebind. |
| Seedance R2V s video refs — pricing multiplier missing | Apply 0.6× v spending estimate (sekce 2.12). |

---

## 8. Implementation phase ordering ⭐ NEW section (session 3)

Suggested phase breakdown pro prompt generator + asset stores integration:

**Phase 1 — Foundation (no UI changes)**
- ai-video-prompt.js module (per-model system prompts)
- Vision pass integration via OpenRouter
- System prompt assembly layer
- Task classification logic
- Hook do existing video generation flow (silent, žádná UI)

**Phase 2 — Backend asset stores**
- Character Library schema + CRUD (sekce 4.1)
- Voice Library schema + CRUD (sekce 4.2)
- Migration logic
- Endpoint integrace pro create-element, create-voice
- Cross-model reference conversion logic (sekce 5.5)

**Phase 3 — UI additions**
- Character Library section v Assets
- Voice Library section v Assets
- "Add background audio/mood" toggle (sekce 3.10)
- Typed reference slots (sekce 3.11)
- Duration selector per-model awareness (sekce 3.14)

**Phase 4 — Advanced features**
- Face picker pro Lipsync (sekce 3.13)
- Model capability matrix UI (sekce 3.12)
- Source model tagging pro videa (sekce 3.15)
- Dialogue input UX (sekce 3.16) — deferred, optional

**Phase 5 — Bug fixes a missing integrations**
- Všechny 🔴 BUG items ze sekce 1
- Vybrané 🟡 MISSING items (Vidu R2V Mix, Kling Lipsync)
- Spending.js audit (sekce 5.6)
- Smoke tests per Phase
- Documentation updates per sekce 6.4

**Phase 6 — Remaining model integrations**
- Handoff per `HANDOFF_remaining_video_models.md`
- Runway Gen-4.5, Luma Modify, WAN 2.7 Extend, Vidu Pro/Turbo
- Nové modely added over time

Každá phase může být multiple GIS version bumps. Phase 1 sama je probably full session.

---

## 9. Testing requirements ⭐ NEW section (session 3)

### 9.1 Smoke tests per model

Po integration, per-model smoke tests:
- T2V se simple promptem
- I2V s reference (test continuity anchor)
- Start/End frame s dramatic delta
- Multi-reference (where supported) s typed roles
- Extend z existing generation
- Lipsync (Kling only): audio-driven + text-driven paths

### 9.2 Generator-specific tests

- Vision pass extrahuje correct metadata z diverse references
- Reference role assignment propaguje do prompt correctly
- Žádná audio mood injection když toggle OFF (Rule 2 verification)
- Žádné technical parameter suggestions (Rule 1 verification)
- Hybrid mode asks ≤1 question per response (Rule 4 verification)
- Dialogue detection correctly triggers physiological coating
- Czech/non-EN dialogue triggers language warning

### 9.3 Asset library tests

- Character creation z images
- Character creation z video
- Voice creation z audio
- Voice binding to character
- Character with bound voice → dialogue generation produces correct payload
- Library persistence across sessions
- Library migration z schema v1 to v2 (pokud applicable)

### 9.4 Error path tests

Exercise každý row v sekci 7 error table. Verify fallbacks se chovají as documented.

### 9.5 Session 2 Phase 8 smoke test (from userMemories)

Per userMemories v210en TODO: *"Session 2 Phase 8 smoke test per model family: Veo / Kling / Seedance 2.0 / Grok / Luma / Vidu / WAN / PixVerse / Topaz / Magnific — with explicit Seedance 2.0 reuse test (bug fixed in v209en)."*

Toto zahrnuje aktuální codebase stav + nové integrace sessions 1-3. Priority HIGH před merge do main.

---

## 10. Priority summary

| Priority | Item | Section |
|---|---|---|
| 🔴 HIGH | PixVerse `camera_movement` dropdown fix | 1.1 |
| 🔴 HIGH | PixVerse C1 Transition inverted switch verification | 1.2 |
| 🔴 HIGH | Kling `prompt: ""` fallback | 1.4 ⭐ |
| 🔴 HIGH | Veo reference_to_video fallback chain | 1.5 ⭐ |
| 🟡 HIGH | **Character Library + Voice Library** (cross-model) | 4.1 / 4.2 / 4.3 ⭐ |
| 🟡 HIGH | Kling Lipsync task integration (Petrův CZ dialog workflow) | 2.8 ⭐ |
| 🟡 HIGH | Kling create-voice + create-element endpoint integration | 2.9 / 2.10 ⭐ |
| 🟢 HIGH | **"Add background audio/mood" toggle** (Rule 2 control) | 3.10 ⭐ |
| 🟢 HIGH | Typed reference slots (role assignment) | 3.11 ⭐ |
| 🟡 HIGH | Vidu Q3 R2V Mix integration (signature feature) | 2.1 |
| 🟡 HIGH | Veo 3.1 constraints enforcement v UI (duration/V2V/style refs) | 2.13 ⭐ |
| 🟡 MEDIUM | Runway Gen-4.5 + Aleph integration | 2.2 |
| 🟡 MEDIUM | Seedance frame-guided ↔ omni mode exclusion UI | 2.11 ⭐ |
| 🟡 MEDIUM | Seedance 0.6× pricing multiplier audit | 2.12 ⭐ |
| 🟢 MEDIUM | Vidu duration slider cap fix (8→16s) | 3.5 |
| 🟢 MEDIUM | `enable_prompt_expansion: false` at submit | 3.6 |
| 🟢 MEDIUM | Dialogue language warnings (Kling + Seedance added) | 3.1 ⭐ |
| 🟢 MEDIUM | Duration selector per-model awareness (Veo discrete 4/6/8) | 3.14 ⭐ |
| 🟢 MEDIUM | Veo default negative prompt seed (text overlay) | 2.14 ⭐ |
| 🟢 MEDIUM | Face picker modal pro Kling Lipsync | 3.13 ⭐ |
| 🟢 MEDIUM | Video source tagging (pro Extend validation) | 3.15 ⭐ |
| 🟢 LOW | Model capability matrix UI | 3.12 ⭐ |
| 🟢 LOW | xAI `<IMAGE_N>` vs `image N` verification | 3.7 |
| 🟢 LOW | WAN 2.7 voice extraction tooltip | 3.2 |
| 🟢 LOW | Luma "no audio" badge | 3.3 |
| 🟡 LOW | Luma Modify Video (V2V) integration | 2.3 |
| 🟡 LOW | WAN 2.7 9-grid multi-image | 2.4 |
| 🟡 LOW | Vidu Pro/Turbo tier variants | 2.5 |
| 🟢 LOW | Dialogue input UX separate field | 3.16 ⭐ |

⭐ = session 3 new items (Kling V3+O3, Seedance 2.0, Veo 3.1 research)

---

## 11. Zdroje

- **userMemories** (v225en era) — kritické kontext gotchas z předchozí dev sessions
- **VIDEO_PROMPT_GENERATOR.md** — PART C obsahuje detailní prompting rules per model pro všechny research sessions
- **HANDOFF_remaining_video_models.md** — priority list z předchozích research sessions, plán pro další modely
- Per-model official docs:
  - Luma: `lumalabs.ai/api/v1/docs`
  - xAI Grok: `docs.x.ai/docs/models/grok-imagine-video`
  - PixVerse: `app-api.pixverse.ai/docs`
  - Alibaba WAN: Alibaba Cloud Model Studio + fal.ai wan-2.7 / wan-2.6 model pages
  - Shengshu Vidu: WaveSpeedAI docs + replicate.com/vidu/q3-pro
  - Runway: `docs.dev.runwayml.com`, `help.runwayml.com`
  - **Kling ⭐:** fal.ai kling-video model pages, replicate.com/kwaivgi/kling-*, official kling.ai
  - **Seedance ⭐:** fal.ai bytedance/seedance-2.0 pages, official bytedance seedance docs
  - **Veo ⭐:** ai.google.dev/gemini-api/docs/video, cloud.google.com Vertex AI docs, replicate.com/google/veo-3.1
- Wrapper platforms: fal.ai, WaveSpeedAI, Replicate, Scenario
- Google AI dev forum (Veo reference_to_video mismatch): discuss.ai.google.dev/t/veo-3-1-reference-images-docs-say-available-api-says-not-supported/111853
