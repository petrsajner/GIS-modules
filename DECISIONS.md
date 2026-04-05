# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 5. 4. 2026 · v182en*

---

## GitHub jako zdroj modulů (5. 4. 2026)

**Problém:** `/mnt/project/` na Claude.ai platformě má cache bug — může vracet stale verze souborů i po re-uploadu. To způsobovalo opakované regrese (switchView block/flex, copyright 2025/2026).

**Rozhodnutí:** Zdrojové moduly přesunuty na GitHub: https://github.com/petrsajner/GIS-modules

**Workflow:**
- Konec session → Petr nahraje nové moduly na GitHub
- Začátek session → Claude fetchne moduly z GitHub blob URL (web_fetch)
- /mnt/project/ zůstává jako záloha pro syntax check

**Odmítnuto:** Google Drive — connector funguje ale čte pouze Google Docs (.js soubory nelze)

---

## Magnific Video — fal.ai storage upload (5. 4. 2026)

**Problém:** Freepik Video Upscaler vracel 400 "HTTP video URL not allowed" při posílání raw base64.

**Analýza:** Freepik API přijímá HTTPS URL nebo base64, ale base64 řetězec velký soubor může začínat znaky podobnými URL — nebo jde o limit velikosti Cloudflare Worker requestu.

**Rozhodnutí:** Video se před odesláním Freepiku uploaduje na fal.ai storage (`https://storage.fal.run/files`) → vrátí HTTPS URL → ta se pošle proxy. Vyžaduje fal.ai klíč v job objektu.

**Proxy:** `handleMagnificVideoUpscale` přijímá `video_url` (preferovaný) i `video_b64` (fallback).

---

## Freepik Edit Tools jako image modely (5. 4. 2026)

**Problém:** Relight/Style Transfer/Skin Enhancer byly v Edit modalu na kartách — špatné UX, špatná dostupnost.

**Rozhodnutí:** Přidány jako regulérní image modely (`proxy_freepik_edit`) do hlavního selectu.

**Architektura:**
- Ref[0] = source image (required pro všechny 3)
- Ref[1] = style/lighting reference (optional u Relight, required u Style Transfer)
- Prompt = lighting description (pouze Relight)
- `editModel: true` → speciální ref label v UI

---

## switchView display:flex (opakovaná regrese)

**Bug:** `model-select.js` `switchView()` nastavoval `setupView.style.display = 'block'` místo `'flex'`. Způsobovalo zmizení copyright karty v Setup (flex layout se neuplatnil).

**Původ:** Stale modul z `/mnt/project/` cache obsahoval starší verzi před opravou.

**Fix:** `'flex'` + přidán do session-start check listu.

**Poznámka:** Tento bug byl opravován vícekrát. Přidán do regrese watch-listu v STAV.md.

---

## Dynamický params systém — odloženo

**Analýza (4. 4. 2026):** 665 řádků statického HTML pro params, 20× opakující se radio patterns.

**Rozhodnutí:** Neimplementovat globální refaktor — příliš velké riziko regresí. Místo toho hybridní přístup: nové modely používají `params[]` array kde to dává smysl, staré ponechat.

---

## Tauri distribuce — odloženo

**Důvod odkládání:** Řeší CORS proxy problém, ale GIS není feature-complete.

**Odhad:** ~3-4 sessions implementace. Dokumentováno v TAURI_DISTRIBUTION.md.

**Spustit kdy:** GIS je stabilní a feature-complete.

---

## Proxy architektura (Cloudflare Workers)

**Důvod existence:** CORS blokuje přímé volání z `file://` pro: xAI, Luma, Freepik/Magnific, Topaz, Replicate.

**Verze:** 2026-08 (5. 4. 2026)

**Nové routes v 2026-08:**
- `POST /magnific/mystic` — Mystic generation
- `POST /magnific/skin-enhancer` — Skin Enhancer
- `POST /magnific/relight` — Relight
- `POST /magnific/style-transfer` — Style Transfer
- `POST /magnific/video-upscale` — Video Upscaler (Creative + Precision)

**Status handler** rozšířen na 9 typů: creative, precision-v1, precision-v2, mystic, skin_enhancer, relight, style_transfer, video_upscale, video_upscale_prec.

