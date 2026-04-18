# GIS Stav projektu

## Aktuální verze: v202en
## Next: v203en

## Soubor: `gis_v202en.html`
## Worker: `gis-proxy v2026-16` (beze změny)

---

## Changelog v202en

### Queue + Rerun fixy (4 regresní bugy)
- `RETRY_MAX` crash fix v output-render.js (použít job.retryTotal)
- Cancel button pro running jobs (v overlay i queue panelu), soft-cancel via job.cancelled + job.abort
- Rerun z gallery: force count=1 pro všechny model types (drive spawned N karet)
- Reuse z gallery: saveToGallery ukládá všechny UI params per-type, reuseJobFromGallery kompletní rewrite

### Download overhaul
- Prefs store v IDB (v8) pro FileSystemDirectoryHandle persistence
- Inline ZIP writer (zero CDN, ~80 lines APPNOTE-compliant)
- dlProgShow/Update/Hide progress overlay helpery
- `_IS_FILE_PROTOCOL` + `_HAS_FS_API` detekce → na file:// bypass FS API (a.click only)
- videoDownloadSelected: directory picker s persistencí na http(s)://, sekvenční a.click na file://

### UI unification (3 knihovny: Gallery, Video, Assets)
- Sjednocené CSS: `.lib-toolbar`, `.lib-bulk`, `.lib-bulk-label`, `.lib-bulk-spacer`, `.lib-right`
- Delete tlačítko trvale červený outline + úplně vpravo
- Cancel tlačítko nalevo od Delete (neutral styling)
- Unified wording: "Download" pro files, "Archive" pro JSON backup, "Cancel" všude
- Bulk bar pozice: POD toolbarem ve všech knihovnách
- Label: "✦ Selected: N items" stejné ve všech

### Gallery layout refactor
- Nová struktura: `.gal-main` wrapper kolem menu + `#galleryGrid`
- Menu (toolbar, bulk, filter) je **sibling** `#galleryGrid` (ne child) → nescrolluje s gridem
- `#galleryGrid` je čistý scroll container (bez display:grid, bez flex role)
- `.gal-grid` uvnitř je normal block child s display:grid → predictable width calculation
- Grid neselhává ani ve flex-column nested kontextu

### Video library: přidaná Archive / Load archive
- `exportVideoArchive()` v video.js — JSON s base64 MP4 data (chunked 8KB aby neprisel stack overflow)
- `importVideoArchive()` — parse, převést base64 → Uint8Array → dbPut
- Progress overlay během obou operací
- Paritní funkcionalita s Gallery archive
- Skipuje existující ID při importu (safe re-import)

### Performance: plná data v thumb/listing operacích
Odstraněno čtení plných imageData kde stačí metadata:
- `importGallery` existingIds check → `dbGetAllMeta()`
- `openInpaintRefPicker` (paint.js) → `dbGetAllMeta()`, full až při kliknuti
- `reuseVideoJob` fallback autoName search → `dbGetAllAssetMeta()`
- `findAssetByFingerprint` → assets_meta s precomputed fingerprint field
- `ctxSaveAsset` single findByFingerprint call (drive volano 2x)

### Fingerprint migrace pro legacy assety
- `migrateAssetFingerprints()` v assets.js — backfill fingerprint field pro pre-v202en assety
- Spouští se 500ms po initDB (setup.js), bezi na pozadi s setTimeout(0) yield každých 10 assetů
- Trade-off: během prvních ~30s po startu duplicate detection muze selhat pro legacy data

---

## TODO Priority

1. Style Library "My Presets"
2. Claid.ai via proxy
3. GPT Image 1.5
4. Hailuo 2.3
5. Use button for V2V models
6. Runway Gen-4 Image + Video (research done)
7. Recraft V4
8. Unified panel pro video modely (phase 2, jako v200en pro obrazky)
9. Z-Image LoRA generation
10. Z-Image LoRA trainer
11. Ideogram V3
12. Seedance 2.0 1080p — **čeka se až fal.ai přidá** (aktualně jen 720p tam)

---

## Runtime Philosophy

- Single-file HTML na file:// v Chrome
- NO CDN pro libraries/code (inline instead). CDN pro UI fonts (Google Fonts) OK.
- User data vzdy lokální (IndexedDB)
- Tauri migrace **později** — až narazíme na hard limit (native dialogs, calling external programs, robust SQLite)
