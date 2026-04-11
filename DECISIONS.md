# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 9. 4. 2026 · v190en*

---

## Claude Sonnet jako primární AI Prompt model (7. 4. 2026)

**Problém:** Gemini Flash produkuje mechanický, strojový text pro AI Prompt Tool a Describe. Uživatel s OR klíčem má přístup k výrazně lepším modelům.

**Rozhodnutí:** Invertovat prioritu — OR (Claude Sonnet 4.6) primární, Gemini 3.1 Pro fallback.

**Důvod volby Claude:** Ze všech dostupných modelů má nejpřirozenější styl — nepíše seznamy, vyhýbá se klišé ("cinematic lighting"), tíhne k precizním konkrétním popisům. Ideální pro filmovou produkci.

**Fallback volba:** Gemini 3.1 Pro místo Flash — výrazně lepší kreativní psaní, cena není kritická (prompt je zanedbatelná část nákladů oproti generování obrazů).

**Platí pro:** AI Prompt Tool (všechny tahy) + Describe (vision přes OR).

---

## Live @mention rewriting (7. 4. 2026)

**Problém:** Uživatel píše `@Ref_031` do promptu, ale model (Kling, SeeDream) vyžaduje `@Image1` nebo `Figure 1`. Preprocessing proběhl pouze při generování — bez vizuální zpětné vazby.

**Rozhodnutí:** Textarea se přepisuje živě při přepnutí modelu a při změně refs.

**Architektura:**
- Canonical forma: `@UserLabel` (autoName nebo userLabel)
- Konverze forward: `preprocessPromptForModel()` — existující funkce
- Konverze backward: nová `promptModelToUserLabels()` — reverzní mapping
- Hook v `selectModel()` — přepisuje při každém přepnutí
- Hook v `renderRefThumbs()` — přečísluje při přidání/odebrání refu

**Klíčový bug při implementaci:** `getActiveVideoModelKey()` vrátí nový model klíč (select se updateuje před `onchange`). Řešení: `_prevVideoModelKey` persistent proměnná + `_videoModelSwitching` guard.

**Veo ingredients:** Nepotřebuje @mentions — refs se posílají jako `reference_images[]` přímo.

---

## Error karty jako standardní error management (7. 4. 2026)

**Problém:** Video chyby se zobrazovaly pouze jako toast zpráva (mizí za 5s) + console.error. Placeholder karta zmizela. Žádná možnost retry.

**Rozhodnutí:** Unifikovat error management — video i image chyby zobrazit jako perzistentní error kartu stejného stylu s Reuse + Rerun tlačítky.

**Rerun vs Reuse:**
- Rerun: okamžitý re-queue se stejnými parametry, nové job ID, žádná interakce uživatele
- Reuse: načte parametry do formuláře — uživatel může upravit před odesláním

**Fallback:** Pokud placeholder karta neexistuje (Topaz background jobs) → toast.

---

## Luma keyframe upload přes R2 (7. 4. 2026)

**Problém:** Luma `/dream-machine/v1/file_uploads` endpoint vrátí 404 — byl zrušen.

**Rozhodnutí:** Použít stávající R2 bucket infrastructure pro keyframe image upload.

**Flow:** Worker přijme base64 → uloží do R2 → vrátí `https://gis-proxy.../r2/serve/{key}` → tato URL předána Luma API jako keyframe URL.

**Proč R2 funguje:** Luma potřebuje veřejnou HTTPS URL dostupnou z jejich serverů. R2 přes Worker to zajistí bez CORS problémů.

---

## Video prompt bez textu — selektivní povolení (7. 4. 2026)

**Problém:** Modely s start+end frame umožňují generovat bez popisu, ale GIS to blokoval.

**Rozhodnutí:** Selektivní `promptOptional` — povoleno pro všechny refMode modely KROMĚ `luma_video` a `kling_video` (oba vždy vyžadují prompt, Kling navíc odmítne prázdný string s 422).

**Testováno:** WAN 2.7, Seedance, Vidu — fungují bez promptu. Luma 400, Kling 422.

---

## GitHub jako zdroj modulů (5. 4. 2026)

**Problém:** `/mnt/project/` na Claude.ai platformě má cache bug.

**Rozhodnutí:** Zdrojové moduly přesunuty na GitHub: https://github.com/petrsajner/GIS-modules

**Workflow:**
- Konec session → Petr nahraje nové moduly na GitHub
- Začátek session → Claude fetchne moduly z GitHub blob URL

---

## R2 jako univerzální video storage v proxy (6. 4. 2026)

**Problém:** Více video modelů potřebuje předat binární video třetí straně přes HTTPS URL.

**Rozhodnutí:** Cloudflare R2 bucket jako universal binary storage.

**Bucket:** `gis-magnific-videos`, Binding: `VIDEOS` v wrangler.toml

---

## WAN 2.7 — migrace z Replicate na fal.ai (6. 4. 2026)

**Problém:** WAN 2.7 Video Edit přes Replicate — CDN URL expirovala, `/v1/uploads` vrátí 404.

**Rozhodnutí:** Všechny WAN 2.7 video modely přesunout na fal.ai queue.

---

## Freepik Edit Tools jako image modely (5. 4. 2026)

**Rozhodnutí:** Relight/Style Transfer/Skin Enhancer přidány jako regulérní image modely (`proxy_freepik_edit`).

---

## switchView display:flex (opakovaná regrese)

**Bug:** `model-select.js` `switchView()` nastavoval `'block'` místo `'flex'`.

**Fix:** `'flex'` — přidán do session-start check listu. Nesmí se nikdy změnit.

---

## Dynamický params systém — odloženo

**Rozhodnutí:** Neimplementovat — příliš velké riziko regresí. Hybridní přístup pro nové modely.

---

## Tauri distribuce — odloženo

**Spustit kdy:** GIS je stabilní a feature-complete. Odhad: ~3-4 sessions.

---

## Proxy architektura — verze history

| Verze | Datum | Změny |
|-------|-------|-------|
| 2026-09 | 6. 4. 2026 | R2 generic upload/serve, Kling V2V fix |
| 2026-08 | dříve | Magnific video, Mystic, Relight, Style Transfer, Skin Enhancer |
| luma fix | 7. 4. 2026 | handleLumaVideoSubmit přijímá env, keyframes přes R2 |

---

## Code cleanup & deduplication (9. 4. 2026)

**Problém:** 24k řádků kódu s masivní duplikací — video save pattern 8×, source slot management 4× copy-paste, fal.ai polling 3×, inpaint funkce 7× téměř identické, mrtvý kód po odstraněných modelech.

**Rozhodnutí:** Systematický refaktor v jedné verzi (v190en) se syntax checkpointy po každé fázi.

**Přístup:**
1. Mrtvý kód odstraněn nejdříve (nízké riziko)
2. Utility helpery extrahovány do setup.js (getProxyUrl, _arrayBufferToBase64)
3. Generické funkce vytvořeny pro opakované patterny (_saveVideoResult, _falVideoSubmitPollDownload, _srcSlotClear/Set/Describe, _runSimpleInpaint)
4. Existující pojmenované funkce zachovány jako thin wrappers (API kompatibilita s template.html onclick handlery)

**Co NEBYLO refaktorováno (záměrně):**
- Image model call funkce (callFlux, callSeedream, callKling...) — každá má dostatečně specifické parametry, unifikace by byla křehká
- Mystic modely — aktivně používané
- Veo/Luma polling — odlišné API (ne fal.ai), vlastní auth pattern

**Výsledek:** 17533 → 16897 JS řádků (−636, −3.6%). Žádná změna funkcionality.

---

## Edit Tool — Unified Agent Architecture (10. 4. 2026)

**Problém:** Uživatel potřebuje generovat editační prompty optimalizované pro různé modely (NB2, NB Pro, Flux 2, Seedream). Každý model má jiné požadavky na formát promptu. Navíc je potřeba rozlišit editaci elementu vs. změnu kamery.

**Rozhodnutí:** Jeden unified AI agent s automatickou klasifikací (TYPE A element edit / TYPE B camera reframe) místo separátních per-model systémů.

**Architektura:**
- System prompt se buduje dynamicky v `_etmGetSystemPrompt()` na základě: aktuální model, počet refs, analýzy všech refs.
- `_etmRefAnalyses[]` — pole analýz pro libovolný počet referencí. Ref 1 = detailní popis scény. Ref 2+ = krátká analýza role (barva? maska? úhel?).
- Agent rozhoduje typ editace sám z uživatelova zadání — nikdy se neptá "edit nebo reframe?" pokud je záměr jasný.

**Alternativy zvážené:**
- 3 separátní system prompty per model → duplicitní, neflexibilní při přidávání nových modelů
- Pre-classification v JS před odesláním → uživatel musí volit typ, přidává UI krok

---

## Camera Reframe — Strategie a výsledky výzkumu (10. 4. 2026)

**Problém:** Jak přesvědčit generativní AI modely aby změnily úhel kamery při zachování scény?

**Klíčový poznatek:** Generativní modely nechápou instrukce o pohybu kamery ("rotate 90°", "move camera 5m right"). Rozumí popisu NOVÉHO ZÁBĚRU jako fotografie.

**Testované a zamítnuté přístupy:**
1. ❌ **Floor plan jako reference** — modely diagramy ignorují nebo vizuálně zapracovávají
2. ❌ **Dlouhé prostorové popisy** (>80 slov) — model se zmate, přeuspořádá objekty místo otočení kamery
3. ❌ **Numerické úhly** ("rotate 90°") — ignorováno
4. ❌ **Kompasové směry** ("face north") — ignorováno

**Přijaté strategie (seřazené dle účinnosti):**
1. ⭐⭐⭐ **Physical Position** — "from the view of camera standing [location]"
2. ⭐⭐⭐ **Character POV** — "from the perspective of [person at location]"  
3. ⭐⭐ **Landmark-to-Target** — "from [object A] looking toward [object B]"
4. ⭐⭐ **Subject Reframe** — "close-up profile shot of [subject] from [side]"
5. ⭐⭐⭐ **Multi-Reference** — "scene from image 1 in the view of image 2"
6. ⭐ **Temporal Orbit** — "camera orbiting, show me X seconds later"

**Rozhodnutí: Variant approach.** Agent generuje 4 různé varianty (různé strategie) a uživatel zkouší postupně. Žádná strategie nefunguje 100% — ale jedna ze 4 variant obvykle dá přijatelný výsledek.

**Model doporučení:** NB Pro je nejspolehlivější pro camera reframe. Ostatní modely fungují hůře.

---

## Druhá reference jako interní kontext (10. 4. 2026)

**Problém:** Druhá reference (jiný úhel scény) dramaticky zlepšuje kvalitu agentova prostorového popisu, ale pokud ji pošleme generativnímu modelu spolu s promptem který na ni neodkazuje, model je zmatený a výsledek se zhorší.

**Rozhodnutí:** REFS tagging systém.
- Agent taguje každou variantu `[REFS:1]` nebo `[REFS:1,2]`
- Parser tag extrahuje a odstraní z promptu
- UI zobrazuje badge "ref 1 only" / "refs 1+2" na kartě varianty
- Footer varuje při přebytečných referencích

**Princip:** Druhá reference slouží AGENTOVI k pochopení prostoru. Generativnímu MODELU ji posíláme JEN když na ni prompt explicitně odkazuje (Strategy E).

---

## Multi-ref awareness pro element edits (10. 4. 2026)

**Problém:** Uživatel může přidat barvu jako ref 2, masku jako ref 3, texturu jako ref 4. Agent musí vědět co každá reference obsahuje a jak na ni odkazovat v promptu.

**Rozhodnutí:** 
- `_etmAnalyzeRefAt(idx)` — pro ref 2+ se ptá AI: "Is this a different angle? Color palette? Sketch/mask? Close-up detail?"
- System prompt obsahuje `MULTI-REFERENCE AWARENESS` sekci s instrukcemi pro odkazování ("image 2", "image 3")
- Regex check na výstupu: pokud prompt neobsahuje "image 2" ale refs > 1 → varování v footeru

