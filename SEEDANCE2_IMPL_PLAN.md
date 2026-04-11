# SEEDANCE 2.0 — Implementační plán pro v195en

## 1. Přehled funkcionality

Seedance 2.0 od ByteDance na fal.ai — 6 endpointů, plná feature parita.

### Endpointy

| Key v GIS | Endpoint | Typ | Cena 720p/s | Refs |
|-----------|----------|-----|-------------|------|
| `seedance2_t2v` | `bytedance/seedance-2.0/text-to-video` | T2V | $0.30 | 0 |
| `seedance2_i2v` | `bytedance/seedance-2.0/image-to-video` | I2V | $0.30 | 1–2 (start + end frame) |
| `seedance2_r2v` | `bytedance/seedance-2.0/reference-to-video` | R2V | $0.30 | 1–9 imgs + 3 vids + 3 audio |
| `seedance2f_t2v` | `bytedance/seedance-2.0/fast/text-to-video` | T2V Fast | $0.24 | 0 |
| `seedance2f_i2v` | `bytedance/seedance-2.0/fast/image-to-video` | I2V Fast | $0.24 | 1–2 |
| `seedance2f_r2v` | `bytedance/seedance-2.0/fast/reference-to-video` | R2V Fast | $0.18 | 1–9 + 3 + 3 |

### Společné parametry (všechny endpointy)

```
prompt:         string (required)
duration:       "4"|"5"|"6"|"7"|"8"|"9"|"10"|"11"|"12"|"13"|"14"|"15"|"auto"
resolution:     "480p"|"720p"
aspect_ratio:   "21:9"|"16:9"|"4:3"|"1:1"|"3:4"|"9:16"|"auto"
generate_audio: boolean
seed:           integer (optional)
multi_shot:     boolean — OVĚŘIT přesný název parametru! (multishot / multi_shot / enable_multi_shot)
```

⚠ **Multi-shot parametr**: Přesný název v API NENÍ ověřen z dokumentace. Před implementací:
- Zkusit `multi_shot: true` a sledovat response
- Nebo najít v fal.ai schema stránce přesný klíč

### I2V-specifické parametry

```
image_url:      string (start frame — URL nebo base64 data URI)
end_image_url:  string (optional end frame)
```

### R2V-specifické parametry

```
image_urls:     string[] (max 9 — URL nebo base64 data URI)
video_urls:     string[] (max 3)
audio_urls:     string[] (max 3)
```

V promptu se reference odkazují jako: `[Image1]`, `[Video1]`, `[Audio1]`

### Output schema

```json
{
  "video": {
    "url": "https://v3b.fal.media/files/.../video.mp4",
    "content_type": "video/mp4",
    "file_name": "video.mp4",
    "file_size": 3393408
  },
  "seed": 1632191255
}
```

---

## 2. Existující infrastruktura (co můžeme reuse)

### fal.ai queue systém
Seedance 2.0 běží přes standardní fal.ai queue — identický s existujícími modely:
- Submit: `POST ${proxyUrl}/fal/submit` s endpointem
- Poll: `GET ${proxyUrl}/fal/submit?id=${requestId}&endpoint=${endpoint}`
- Download: `fetch(videoUrl)` → ArrayBuffer
- Sdílený helper: `_falVideoSubmitPollDownload(falKey, endpoint, payload, job, opts)`

### Image refs
Existující `videoRefs[]` systém — assets v IndexedDB, lazy-loaded přes `getRefDataForApi()`.
- I2V: ref 1 = start frame, ref 2 = end frame
- R2V: refs 1–9 = image_urls (komprimované přes `compressImageForUpload`)

### Video refs z galerie
Existující pattern z WAN 2.7:
- `dbGet('videos', videoId)` → `videoData` (ArrayBuffer) → `data:video/mp4;base64,...`
- Source video slot UI: `_srcSlotSet()` / `_srcSlotClear()` — thumbnail, metadata, clear button
- Pro R2V potřebujeme 3 sloty (viz WAN 2.7 Edit jako vzor: `wan27eSrcRow`)

### Audio refs
⚠ **NOVÁ FUNKČNOST** — GIS nemá žádný audio management.
Řešení: 3× URL paste pole v seedance2 params panelu. Uživatel vloží URL audia.
Alternativně: file picker + R2 upload (ale to je nový endpoint na proxy).

### R2 upload
`uploadVideoToFal(file, falKey)` → `POST ${proxyUrl}/r2/upload` → vrátí public URL.
Používá se pro Magnific video, PixVerse upload. Přijímá binary body s Content-Type header.
Lze použít i pro audio upload pokud bude potřeba.

---

## 3. Co implementovat — per modul

### models.js
Nic — VIDEO_MODELS jsou definovány přímo v `video.js`.

### video.js — VIDEO_MODELS
Přidat 6 nových modelů do `VIDEO_MODELS` objektu:

```javascript
seedance2_t2v: {
  name: 'Seedance 2.0', type: 'seedance2_video',
  endpoint: 'bytedance/seedance-2.0/text-to-video',
  refMode: 'none', maxRefs: 0,
  desc: 'T2V · Native audio · Multi-shot · Up to 15s · ByteDance via fal.ai',
},
seedance2_i2v: {
  name: 'Seedance 2.0', type: 'seedance2_video',
  endpoint: 'bytedance/seedance-2.0/image-to-video',
  refMode: 'single_end', maxRefs: 2,  // ref1=start, ref2=end (optional)
  desc: 'I2V · Start + end frame · Native audio · Up to 15s',
},
seedance2_r2v: {
  name: 'Seedance 2.0', type: 'seedance2_video',
  endpoint: 'bytedance/seedance-2.0/reference-to-video',
  refMode: 'wan_r2v', maxRefs: 9,  // images; video+audio via separate slots
  desc: 'R2V · 9 imgs + 3 videos + 3 audio · Multi-modal refs',
},
// + 3× Fast varianty se stejnou strukturou, jen fast/ v endpoint
```

### video.js — MODEL_GROUPS
Přidat skupinu `seedance2`:

```javascript
seedance2: {
  default: 'seedance2_t2v',
  variants: [
    { key: 'seedance2_t2v',  label: 'T2V · Text to Video · $0.30/s' },
    { key: 'seedance2_i2v',  label: 'I2V · Start + End frame · $0.30/s' },
    { key: 'seedance2_r2v',  label: 'R2V · Multi-modal refs · $0.30/s' },
    { key: 'seedance2f_t2v', label: 'T2V Fast · $0.24/s' },
    { key: 'seedance2f_i2v', label: 'I2V Fast · $0.24/s' },
    { key: 'seedance2f_r2v', label: 'R2V Fast · $0.18/s' },
  ],
},
```

### video.js — callSeedance2Video()
Nová dispatch funkce. Vzor: `callWan27Video()` (3686+) — nejbližší analogie.

Logika:
1. Rozlišit T2V / I2V / R2V podle endpointu
2. T2V: jen prompt + params
3. I2V: ref 1 → `image_url`, ref 2 → `end_image_url`
4. R2V: refs → `image_urls[]`, source video sloty → `video_urls[]`, audio URL pole → `audio_urls[]`
5. Submit přes `_falVideoSubmitPollDownload()`

### video.js — UI panel management
V `updateVideoParamsPanel()` přidat sekci pro `seedance2_video`:
- Zobrazit `seedance2Params` panel
- Řídit viditelnost ref sekcí (I2V: refs, R2V: refs + video slots + audio fields)

Pro R2V: 3× source video slot (vzor: `wan27eSrcRow`):
- `seedance2VidSrc1Row`, `seedance2VidSrc2Row`, `seedance2VidSrc3Row`
- Každý s thumbnail, info, clear, describe tlačítkem
- `seedance2VidSrc1Id`, `seedance2VidSrc2Id`, `seedance2VidSrc3Id` globální proměnné

Pro R2V audio: 3× text input pole pro URL paste

### video.js — videoLbUse dispatch
V `videoLbUse()` přidat handling pro `seedance2_video` — nastavení source video do správného slotu.

### video.js — runVideoJob dispatch
Přidat `if (model.type === 'seedance2_video') return callSeedance2Video(job);`

### template.html — CSS
Reuse existující `.ctrl`, `.toggle-row`, `.chk-row` třídy. Žádné nové CSS potřeba.

### template.html — video model selector
Přidat `<optgroup label="━━ Seedance 2.0 ━━">` s 6 modely do video select.

### template.html — seedance2Params panel
Nový `<div id="seedance2Params" style="display:none">`:

```
┌─ Duration: slider 4–15s + checkbox "Auto" (disabluje slider) ──────┐
├─ Resolution: radio 480p / 720p ────────────────────────────────────┤
├─ Generate Audio: checkbox ─────────────────────────────────────────┤
├─ Multi-shot: checkbox (checked = multi-shot, unchecked = single) ──┤
├─ Seed: text input ─────────────────────────────────────────────────┤
├─ [R2V only] Video Reference 1: source slot ────────────────────────┤
├─ [R2V only] Video Reference 2: source slot ────────────────────────┤
├─ [R2V only] Video Reference 3: source slot ────────────────────────┤
├─ [R2V only] Audio URL 1: text input ──────────────────────────────┤
├─ [R2V only] Audio URL 2: text input ──────────────────────────────┤
├─ [R2V only] Audio URL 3: text input ──────────────────────────────┤
└────────────────────────────────────────────────────────────────────┘
```

### spending.js
Přidat cenové záznamy:

```javascript
_seedance2_video_std:  (dur) => dur * 0.30,  // standard T2V/I2V/R2V
_seedance2_video_fast: (dur) => dur * 0.24,  // fast T2V/I2V
_seedance2_video_r2v_fast: (dur) => dur * 0.18,  // fast R2V
```

---

## 4. Klíčové implementační gotchas

### Endpoint formát — ZMĚNA oproti Seedance 1.5!
```
Seedance 1.5: fal-ai/bytedance/seedance/v1.5/pro/text-to-video
Seedance 2.0: bytedance/seedance-2.0/text-to-video       ← BEZ fal-ai/ prefixu!
```
⚠ Ověřit zda `_falVideoSubmitPollDownload` a proxy `/fal/submit` správně handlují endpoint bez `fal-ai/` prefixu.

### Ref mention formát v promptu
Seedance 2.0 R2V používá `[Image1]`, `[Video1]`, `[Audio1]` — hranatý závorky.
To je JINÝ formát než GIS standardní `@Image1`.
V `preprocessPromptForModel()` v refs.js bude potřeba přidat nový branch pro `seedance2_video`.

### Duration jako string
fal.ai Seedance 2.0 přijímá duration jako string: `"5"`, `"10"`, `"auto"`.
Slider value (number) musí být převeden na string v payloadu.

### generate_audio default
Seedance 1.5 defaultuje na audio=ON. Pravděpodobně stejné pro 2.0.
Explicitně posílat `generate_audio: !!checkboxValue`.

### Multi-shot parametr
⚠ NEZNÁMÝ přesný API klíč. Pravděpodobné varianty:
- `multi_shot: true`
- `enable_multi_shot: true`  
- `multi_shot_mode: true`
Nutno ověřit v playground schema na fal.ai PŘED implementací.

### Video refs — base64 velikost
Videa z galerie se načítají jako ArrayBuffer → base64 data URI.
Pro krátká videa (5–10s 720p ≈ 2–5 MB) je to OK.
Pro delší/větší videa zvážit R2 upload (uploadVideoToFal) pro public URL.

### I2V end frame
`end_image_url` je volitelný. Ref 2 je optional — UI musí umožnit I2V i s jedním refem.
`refMode: 'single_end'` — existující mód, zkontrolovat zda funguje s optional ref 2.

---

## 5. Pořadí implementace (doporučené)

1. **VIDEO_MODELS + MODEL_GROUPS** — definice 6 modelů
2. **template.html** — optgroup v selectoru + seedance2Params panel
3. **video.js — updateVideoParamsPanel()** — zobrazování panelu
4. **video.js — callSeedance2Video()** — hlavní dispatch funkce
5. **video.js — R2V source video sloty** (3× slot, globální proměnné, set/clear)  
6. **video.js — runVideoJob dispatch** — přidání nového typu
7. **spending.js** — cenové záznamy
8. **Testování T2V → I2V → R2V**

---

## 6. Soubory ke stažení na začátku session

Potřebné moduly (stáhnout z /mnt/project/):
- `video.js` — hlavní změny (VIDEO_MODELS, callSeedance2Video, UI management)
- `template.html` — params panel, model selector
- `spending.js` — ceny
- `refs.js` — preprocessPromptForModel (pokud budeme přidávat R2V prompt format)
- `build.js` — build
- Všechny ostatní moduly pro build (beze změn)

---

## 7. Otevřené otázky pro uživatele

1. **Multi-shot API klíč**: Ověřit přesný název parametru na fal.ai schema stránce
2. **Audio input**: Stačí URL paste, nebo chceme i file upload + R2?
3. **Seedance 1.5**: Ponechat v selectoru, nebo nahradit 2.0?
4. **Video refs loading**: Base64 data URI (inline, limit ~5MB) nebo R2 upload (žádný limit)?
