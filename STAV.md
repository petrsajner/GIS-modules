# GIS — STAV PROJEKTU
*Aktualizováno konec session · 7. 4. 2026*

## Aktuální verze
| Soubor | Verze | Datum |
|--------|-------|-------|
| Kód EN | gis_v184en.html | 7. 4. 2026 |
| Worker | gis-proxy v2026-09 | 7. 4. 2026 |

**Příští verze:** v185en

> Build: `cd /home/claude && node build.js 185en`

---

## Session start — POVINNÝ první krok
```bash
echo "=== VERSION CHECK ===" && \
echo "model-select.js — switchView flex (NE block!):" && grep -c "'flex'" /mnt/project/model-select.js && \
echo "model-select.js — rewritePromptForModel:" && grep -c "rewritePromptForModel" /mnt/project/model-select.js && \
echo "refs.js — promptModelToUserLabels:" && grep -c "promptModelToUserLabels" /mnt/project/refs.js && \
echo "refs.js — OR_DESCRIBE_MODEL claude:" && grep -c "claude-sonnet" /mnt/project/refs.js && \
echo "video.js — rewriteVideoPromptForModel:" && grep -c "rewriteVideoPromptForModel" /mnt/project/video.js && \
echo "video.js — _prevVideoModelKey:" && grep -c "_prevVideoModelKey" /mnt/project/video.js && \
echo "video.js — friendlyVideoError:" && grep -c "friendlyVideoError" /mnt/project/video.js && \
echo "output-placeholder.js — rerunJob:" && grep -c "function rerunJob" /mnt/project/output-placeholder.js && \
echo "ai-prompt.js — claude-sonnet:" && grep -c "claude-sonnet" /mnt/project/ai-prompt.js && \
echo "gemini.js — streamAccepted:" && grep -c "streamAccepted" /mnt/project/gemini.js && \
echo "models.js — nb1:" && grep -c "nb1:" /mnt/project/models.js
```
Vše musí vrátit ≥ 1. Pokud `0` → zastav, informuj uživatele, požádej o re-upload modulu.

**Kritické — switchView musí mít 'flex' NE 'block':**
```bash
grep "setupView.*display" /mnt/project/model-select.js
# Musí obsahovat: 'flex' — NIKDY 'block'
```

---

## Kde jsme přestali — session ukončena čistě

v184en dokončen. Worker **NENÍ deployován** — obsahuje změnu v `handlers/luma.js` (Luma keyframe upload přes R2 místo deprecated /file_uploads). **Nutno deployovat před testem Luma I2V!**

**Stav modulů (po session 7. 4. 2026):**
- `ai-prompt.js` — Claude Sonnet 4.6 (OR) jako primární, Gemini 3.1 Pro jako fallback; reset po Use as prompt
- `refs.js` — Claude Sonnet 4.6 (OR) jako primární pro describe; live @mention rewriting (promptModelToUserLabels)
- `model-select.js` — rewritePromptForModel hook na přepnutí modelu
- `output-placeholder.js` — plný error card redesign (banner, chips, refs, Reuse + Rerun)
- `video.js` — video error karty; live video @mention rewriting; promptOptional pro vhodné modely; _prevVideoModelKey tracking
- `gemini.js` — streamAccepted flag + 10min stream timeout; odstraněn 20s AbortController
- `generate.js` — withRetry respektuje streamAccepted; _updatePendingCardsStatus; oprava toast typo
- `models.js` — NB1 (gemini-2.5-flash-image) přidán jako fallback model
- `spending.js` — NB1 pricing
- `template.html` — error card CSS; CF email fix; NB1 v dropdownu
- `gemini.js` — opraveny Luma keyframe upload (R2 místo /file_uploads)

**Worker deploy files (C:\Users\Petr\Documents\gis-proxy):**
- `handlers/luma.js` — ⚠ NOVÝ: keyframe upload přes R2 (uploadBase64ToLuma → R2 místo Luma CDN)
- `src/index.js` — handleLumaVideoSubmit nyní přijímá `env` parametr

---

## Opravy v184en — souhrn (7. 4. 2026)

### AI Prompt Tool — reset po Use as prompt
- `_resetAiModal()` — vymaže všechny output textareas, input textareas, chat history DOM
- `openAiPromptModal()` — při fresh open (aiBuffer prázdný) vyčistí stale output aktuálního tabu

### CF Email obfuscation fix
- 3 místa v template.html: CF-encoded `[email protected]` → `info.genimagestudio@gmail.com`
- Odstraněn CF decode script tag z template

### WAN 2.7 Video Edit — response_url fix
- `callWan27eVideo` nyní používá `submitted.response_url` jako fallback (stejný pattern jako T2V)

### WAN 2.7 R2V — správné field names
- `image_urls` → `reference_image_urls`, `video_urls` → `reference_video_urls`

### AI Chat system prompts — intent-based editing
- Chat pro image/video: "understand INTENT, integrate into prose" místo "only add what's asked"
- `thinkingBudget: -1` (auto thinking) pro chat multi-turn
- Describe: vyšší temperature (0.7), výraznější instrukce (evokativní, žádná klišé)

### NB1 — Nano Banana gen 1 přidán
- `nb1: { id: 'gemini-2.5-flash-image', name: 'NB', ... }` — fallback při výpadku NB2
- Max rozlišení 1K, bez thinking mode, stejná cena $0.039
- Deprecace 2. října 2026

### Gemini retry + timeout opravy
- Odstraněn 20s `AbortController` (způsoboval falešné timeouty)
- `streamAccepted = true` po úspěšném HTTP response → `withRetry` neretrykuje aktivní generování
- 10min stream deadline v `callGeminiStream` loop
- `_updatePendingCardsStatus()` zobrazí retry stav přímo na placeholder kartě

### Error karty — kompletní redesign (image + video)
- `showErrorPlaceholder()`: červený banner, model label, param chips, full prompt, ref thumbnails
- **▶ Rerun** — okamžitě znovu spustí job se stejnými parametry (nové ID)
- **↺ Reuse** — načte parametry do formuláře pro review
- `friendlyVideoError()` — video-specifická vrstva error překladů
- `videoJobError()` — přepíše video placeholder na stejný error card styl

### Live @mention rewriting — image modely
- `promptModelToUserLabels()` — reverzní mapping: `@Image1`→`@Ref_031`, `Figure 1`→`@Ref_031`
- `rewritePromptForModel(prevType, newType)` — přepisuje textarea při přepnutí modelu
- `renderRefThumbs()` — hook pro přečíslování při přidání/odebrání refu
- Mention dropdown ukazuje model-specific jméno jako primární (`@Image1`) + user label jako subtitle

### Live @mention rewriting — video modely
- `videoPromptModelToUserLabels()` + `videoPromptUserLabelsToModel()` — pro multi + wan_r2v refMode
- `_prevVideoModelKey` tracking — správné zachování prevM před přepnutím
- `_videoModelSwitching` guard — zabraňuje dvojitému rewrite z renderVideoRefPanel
- `onVideoModelChange` + `onKlingVersionChange` — správně volají rewrite PO přepnutí

### Video prompt bez textu
- `promptOptional = veoFramesMode || (model.type !== 'luma_video' && model.type !== 'kling_video' && refMode ∈ {single_end, single, keyframe, wan_r2v, multi})`
- Kling I2V payload: `prompt` pole vynecháno pokud prázdné (API odmítá empty string)

### Luma keyframe upload — R2 místo deprecated endpoint
- `uploadBase64ToLuma()` v `handlers/luma.js` přepsána — ukládá do R2 bucketu místo zrušeného `/dream-machine/v1/file_uploads` (404)
- `handleLumaVideoSubmit(request, env)` — přidán `env` parametr pro R2 přístup
- Nově používá `luma_kf_{ts}_{rand}.{ext}` klíče v R2

### AI Prompt & Describe — Claude Sonnet 4.6 primární
- **OR klíč vyplněn** → `anthropic/claude-sonnet-4-6` (text + vision přes OpenRouter)
- **OR klíč chybí** → `gemini-3.1-pro-preview` (fallback — výrazně lepší než Flash)
- Qwen 2.5 odstraněn jako fallback model

---

## Aktivní TODO (v pořadí priority)
- [ ] #1 Style Library "My Presets"
- [ ] #4 Clarity 8×/16×
- [ ] #5 Claid.ai
- [ ] #6 WAN audio (DashScope)
- [ ] #7 Vidu Q3 Turbo
- [ ] #9 Seedance 2.0
- [ ] #10 Ideogram V3
- [ ] #11 Recraft V4
- [ ] #12 GPT Image 1.5
- [ ] #13 Hailuo 2.3
- [ ] WAN 2.7 R2V — ověřit endpoint, otestovat

---

## Modulární struktura
### Build pořadí (NEMĚNIT)
```
models → styles → setup → spending → model-select → assets → refs →
generate → fal → output-placeholder → proxy → gemini →
output-render → db → gallery → toast → paint → ai-prompt → video
```
