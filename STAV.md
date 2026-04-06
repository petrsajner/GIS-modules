# GIS — STAV PROJEKTU
*Aktualizováno konec session · 6. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v183en.html | 6. 4. 2026 |
| Worker | gis-proxy v2026-09 | 6. 4. 2026 |

**Příští verze:** v184en

> Build: `cd /home/claude && node build.js 184en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "video.js — wan27_t2v:" && grep -c "wan27_t2v" /mnt/project/video.js && \
echo "video.js — falEndpoint:" && grep -c "falEndpoint" /mnt/project/video.js && \
echo "video.js — duration.*integer (ne string):" && grep -c "requires integer" /mnt/project/video.js && \
echo "video.js — responseUrl (result fetch):" && grep -c "responseUrl" /mnt/project/video.js && \
echo "template.html — wan27vParams v videoLeftContent:" && grep -c "wan27vParams" /mnt/project/template.html && \
echo "magnific.js — handleR2Upload:" && grep -c "handleR2Upload" /mnt/project/magnific.js && \
echo "index.js — 2026-09:" && grep -c "2026-09" /mnt/project/index.js
```
Vše musí vrátit ≥ 1.

**Kritické — wan27vParams musí být v videoLeftContent (ne imgLeftContent):**
```bash
python3 -c "
c=open('/mnt/project/template.html').read()
v=c.find('id=\"wan27vParams\"')
img=c.find('/imgLeftContent')
vid=c.find('id=\"videoLeftContent\"')
print('OK' if v>vid else 'CHYBA - wan27vParams je v img panelu!')
"
```

---

## Kde jsme přestali — session ukončena čistě

v183en dokončen a ověřen. WAN 2.7 I2V funguje přes fal.ai.

**Otestováno:**
- ✅ Kling V2V Motion Control (R2 upload, correct endpoints)
- ✅ Magnific Video Upscale (R2 bucket)
- ✅ WAN 2.7 I2V přes fal.ai
- ⏳ WAN 2.7 T2V — nezkoušeno
- ⏳ WAN 2.7 R2V — nezkoušeno  
- ⏳ WAN 2.7 Video Edit — nezkoušeno

---

## Klíčové opravy v183en (6. 4. 2026)

### WAN 2.7 fal.ai — kritické gotchas

**`duration` musí být INTEGER, ne string:**
```js
// ✓ WAN 2.7 (integer)
payload.duration = duration;       // 5

// ✗ ŠPATNĚ — způsobí okamžitý job failure s 422
payload.duration = String(duration);  // "5"
```

**`response_url` je výsledkový endpoint:**
- `GET response_url` → 200 + video = úspěch
- `GET response_url` → 422 = job selhal (body obsahuje Pydantic validation error)
- fal.ai COMPLETED status neobsahuje `output` field — vždy nutno fetcovat `response_url`

**R2V nemá `duration` field** — neposlat vůbec.

**Params panely:**
- `wan27vParams` musí být v `videoLeftContent` — byl omylem v `imgLeftContent`
- `wan27eDuration` je `<select>` s hodnotami "0"|"2"..."10" (string enum pro edit-video)
- `wan27vDuration` je `<select>` s hodnotami 2-15 (integer pro I2V/T2V)

### R2 bucket
- Bucket: `gis-magnific-videos`, binding `VIDEOS`
- `POST /r2/upload` → raw binary → R2 → HTTPS URL
- `GET /r2/serve/{key}` → stream z R2
- Cleanup při startu GIS (fire-and-forget)

### Kling V2V
- Endpoint: `motion-control` (ne `video-to-video`)
- `character_orientation: 'video'` povinné
- `image_url` (character image) REQUIRED
- Upload přes R2

---

## Aktivní TODO (v pořadí priority)
- [ ] #1 Style Library "My Presets"
- [ ] #4 Clarity 8×/16×
- [ ] #5 Claid.ai
- [ ] #6 WAN audio (DashScope)
- [ ] #7 Vidu Q3 Turbo
- [ ] #9 Seedance 2.0
- [ ] #10 Ideogram V3
- [ ] Otestovat WAN 2.7 T2V + R2V + Video Edit

---

## Modulární struktura
### Build pořadí (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```
