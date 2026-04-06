# GIS — ROZHODNUTÍ & ARCHITEKTURA

*Aktualizováno 6. 4. 2026 · v183en*

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

## R2 jako univerzální video storage v proxy (6. 4. 2026)

**Problém:** Více video modelů potřebuje předat binární video třetí straně přes HTTPS URL. Přímé přístupy selhávají:
- `storage.fal.run` — 530 DNS Error z CF Workers; blokuje CF datacenter IPs
- Replicate `/v1/uploads` — 404; endpoint není dostupný pro všechny plány
- Replicate Files `/v1/files` — upload OK, ale serving vždy vrátí JSON metadata, ne binary
- Přímé base64 pro video — Freepik API odmítá (validuje jako URL)
- Přímé base64 pro motion video — blob URL selhává na `file://` (`blob:null/...`)

**Rozhodnutí:** Cloudflare R2 bucket jako universal binary storage v proxy.

**Architektura:**
```
GIS → POST {proxyUrl}/r2/upload (raw binary body)
    → Worker ukládá do R2: upload_{ts}_{rand}.{ext}
    → Worker vrací: { url: "https://gis-proxy.../r2/serve/{key}" }
GIS posílá tuto URL do API (Freepik, fal.ai atd.)
API → GET https://gis-proxy.../r2/serve/{key}
    → Worker streamuje z R2 jako raw binary
```

**Konfigurace:**
- Bucket: `gis-magnific-videos` (jméno historické, slouží pro vše)
- Binding: `VIDEOS` v wrangler.toml
- Vytvořit jednou: `wrangler r2 bucket create gis-magnific-videos`
- Free tier: 10GB, 1M reads/month

**Cleanup:** `POST /magnific/video-cleanup` smaže vše z bucketu (batch delete 1000/call). Voláno fire-and-forget při každém startu GIS v `setup.js`.

**Použití:**
- Magnific Video Upscaler: GIS → base64 v JSON → Worker dekóduje (Buffer.from) → R2 → URL → Freepik
- Kling V2V Motion Control: GIS → File objekt jako raw binary → Worker → R2 → URL → fal.ai queue

**Zobecnění:** Kdykoli Worker potřebuje:
1. Dočasně uložit binární data (video, velký obrázek)
2. Dostat zpět veřejnou HTTPS URL
→ použij `/r2/upload` endpoint. Žádná závislost na externích službách.


---

## WAN 2.7 — migrace z Replicate na fal.ai (6. 4. 2026)

**Problém:** WAN 2.7 Video Edit byl implementován přes Replicate s podmínkou `cdnUrl.includes('replicate.delivery')` — tj. fungoval POUZE s videi generovanými přes WAN 2.7 I2V přes Replicate. Prakticky nefunkční.

**Hlavní issues:**
- `cdnUrl` expirovalo za 7 dní (a 20h limit byl v kódu)
- Replicate `/v1/uploads` endpoint vrací 404 (není dostupný pro všechny plány)
- Ref image upload přes `/replicate/upload/video` → stejný 404

**fal.ai API zjištění:**
- `fal-ai/wan/v2.7/edit-video` akceptuje `video_url` jako **base64 data URI** (!)
- `fal-ai/wan/v2.7/image-to-video` — standardní fal.ai queue, stejný vzor jako WAN 2.6
- `fal-ai/wan/v2.7/text-to-video` — nový T2V model
- `fal-ai/wan/v2.7/reference-to-video` — R2V s character refs
- Audio `audio_setting`: pouze `auto` | `origin` (ne `add_bgm`/`none` jak jsme měli)

**Rozhodnutí:** Všechny WAN 2.7 video modely přesunout na fal.ai queue.
- Video Edit: zdrojové video = base64 data URI načtené z IndexedDB → přímý JSON payload
- I2V/T2V/R2V: standardní fal.ai queue (falKey, ne replicateKey)
- Žádná CDN URL závislost, žádná proxy potřeba pro video

**Removed:** WAN 2.7 Replicate proxy kód, `replicateModel` field v model definicích, CDN URL checks


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

**Verze:** 2026-09 (6. 4. 2026)

**Nové routes v 2026-09:**
- `POST /r2/upload` — generický R2 binary upload (Kling V2V, jakákoliv binární data)
- `GET /r2/serve/{key}` — serving z R2 s CORS hlavičkami

**Nové routes v 2026-08:**
- `POST /magnific/mystic` — Mystic generation
- `POST /magnific/skin-enhancer` — Skin Enhancer
- `POST /magnific/relight` — Relight
- `POST /magnific/style-transfer` — Style Transfer
- `POST /magnific/video-upscale` — Video Upscaler (Creative + Precision)

**Status handler** rozšířen na 9 typů: creative, precision-v1, precision-v2, mystic, skin_enhancer, relight, style_transfer, video_upscale, video_upscale_prec.

