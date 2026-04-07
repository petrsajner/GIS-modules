# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 7. 4. 2026 · v184en*

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
