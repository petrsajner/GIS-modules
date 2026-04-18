# Research: Nové modely a Proxy architektura
*Datum: 26. března 2026*

---

## 1. Luma UNI-1

### Co to je
Uni-1 je unified model od Luma Labs — porozumění obrázkům a jejich generování sdílí stejnou architekturu (autoregressive transformer, ne diffusion). Model "přemýšlí" před i během generování.

**Vydán:** 23. března 2026

### Výkon
- Vede v human preference Elo pro: Overall, Style & Editing, Reference-Based Generation
- Druhý v Text-to-Image
- První na RISEBench (reasoning-based image editing)
- Skoro srovnatelný s Gemini 3 Pro na object detection (ODinW-13)

### Cena (až bude API)
- Input text: $0.50 / 1M tokenů
- Input image: $1.20 / 1M tokenů
- Output image: $45.45 / 1M tokenů
- Přibližně **~$0.09 / 2K obrázek** — levnější než Google Nano Banana 2 ($0.101)

### API stav
**⏳ NEDOSTUPNÉ** — otevřen pouze waitlist na lumalabs.ai/uni-1. Luma potvrdila, že API přijde, ale termín neznámý.

### Integrace do GIS
Zatím nelze. Až API otevře — přidat do Luma proxy handleru jako nový model string. Architektura proxy na to bude připravena.

---

## 2. Luma Photon + Photon Flash

### Co to je
Photon rodina image generation modelů od Luma Labs. Universal Transformer architektura, navržená pro kreativní workflow.

**Vydán:** Q4 2024, API dostupné od prosince 2024

### Modely
| Model | Cena | Charakteristika |
|---|---|---|
| `photon-1` | ~$0.015 / 1080p img | Maximální kvalita |
| `photon-flash-1` | ~$0.002 / 1080p img | Rychlý, nejlevnější |

### Silné stránky
- Přirozený jazyk bez prompt engineeringu
- Multi-turn iterativní workflow
- **Character reference** — konzistentní postava z jedné fotky
- 76+ art stylů
- Silné text rendering

### API — přímé Luma API
- Endpoint: `POST https://api.lumalabs.ai/dream-machine/v1/generations/image`
- Auth: `Authorization: Bearer {luma_key}`
- **Asynchronní flow** — vrátí `generation_id`, nutno pollovat
- Reference: `image_ref[]`, `style_ref[]`, `character_ref`, `modify_image_ref`
- **Omezení pro browser:** CORS není povoleno → nutná proxy

### API — přes fal.ai
- Endpoint IDs: `fal-ai/luma-photon`, `fal-ai/luma-photon/flash`
- I2I: `fal-ai/luma-photon/modify`, `fal-ai/luma-photon/flash/modify`
- Auth: stejný fal.ai Key jako FLUX
- Base64 data URI: ✅
- CORS: ✅
- **Omezení:** fal.ai wrapper nepodporuje multi-ref (image_ref[], style_ref[], character_ref) — jen `image_url` + `strength` v modify endpointu

### Závěr pro GIS
- **Přes fal.ai:** lze přidat ihned, ale bez plných referencí (refs: false nebo jen 1 ref modify)
- **Přes proxy (Luma nativní API):** plné reference, character ref, style ref, až 14 image_ref — silnější integrace

---

## 3. Grok Imagine Image (xAI / Aurora)

### Co to je
xAI's vlastní image generation model. Aurora engine — autoregressive mixture-of-experts. Grok Imagine jako standalone produkt vydán v létě 2025.

**Aktuální model strings:**
- `grok-2-image` — původní Aurora T2I (od března 2025)
- `grok-imagine-image` — novější Imagine model (leden 2026)

### Výkon
- Silná fotorealita, přesné text rendering
- Permisivnější content policy než DALL-E nebo Midjourney
- ⚠️ **Reputační kontext:** prosinec 2025 — skandál s generováním sexualizovaného obsahu z fotek reálných lidí včetně nezletilých. Vedlo ke kritice zákonodárců a právním krokům. Stojí za zvážení při integraci.

### Cena
- **Grok Imagine přes fal.ai:** $0.02 / img (T2I), $0.022 / img (I2I edit)
- **Grok Imagine přímý xAI API:** $0.07 / img

### API — přímé xAI API
- Endpoint: `POST https://api.x.ai/v1/images/generations`
- Auth: `Authorization: Bearer {xai_key}`
- OpenAI SDK kompatibilní (`base_url = "https://api.x.ai/v1"`)
- **Synchronní** response
- Base64 data URI: ✅ (pro image editing)
- Multi-image merge: ✅ (pole `images[]`)
- **CORS: ❌** — community build proxy workaroundy specificky kvůli chybějícímu CORS

### API — přes fal.ai
- T2I endpoint: `xai/grok-imagine-image`
- I2I endpoint: `xai/grok-imagine-image/edit`
- Auth: stejný fal.ai Key jako FLUX
- CORS: ✅
- Base64: ✅
- **Omezení:** edit bere jen jeden `image_url`, ne multi-ref pole

### Input schema (fal.ai T2I)
```json
{
  "prompt": "...",
  "num_images": 1,
  "aspect_ratio": "1:1",
  "output_format": "jpeg"
}
```
Aspect ratios: `2:1, 20:9, 19.5:9, 16:9, 4:3, 3:2, 1:1, 2:3, 3:4, 9:16, 9:19.5, 9:20, 1:2`

### Závěr pro GIS
- **Přes fal.ai:** lze přidat ihned, refs: false, cena $0.02/img
- **Přes proxy (xAI přímé API):** levnější ($0.07 vs $0.02 — pozor, fal.ai je levnější!), plný multi-image merge

---

## 4. CORS analýza — proč GIS nemůže volat většinu API přímo

GIS je single HTML file bez backendu. Browser enforceuje CORS — každý cross-origin fetch musí mít `Access-Control-Allow-Origin` v response.

| Provider | CORS browser přístup |
|---|---|
| fal.ai (`fal.run`) | ✅ — navrženo pro browser |
| Google AI API | ✅ — podporuje browser volání |
| `api.x.ai` | ❌ — CORS chybí, proxy workaroundy v komunitě |
| `api.lumalabs.ai` | ❌ — async polling API, není browser-friendly |
| Replicate | ❌ |
| Vertex AI | ❌ + OAuth2 |

---

## 5. Architektura řešení: Cloudflare Workers Proxy

### Princip
Hybridní přístup — stávající providery beze změny, nové přes proxy.

```
Google (NB, Imagen)  →  přímý fetch z browseru     ← beze změny
fal.ai (FLUX, atd.)  →  přímý fetch z browseru     ← beze změny
xAI Grok Imagine     →  Cloudflare Worker proxy     ← nové
Luma Photon          →  Cloudflare Worker proxy     ← nové
Replicate / další    →  Cloudflare Worker proxy     ← fáze 2
```

### Proč Cloudflare Workers
- Free tier: 100 000 requestů/den
- Žádný server k správě
- Globální edge network, běží 24/7 bez PC
- Custom domain nebo `*.workers.dev` zdarma
- HTTPS always
- Stateless — klíče se nepermanentně neukládají

### Bezpečnost klíčů
Worker je **passthrough** — klíč přijde v request body od GIS, Worker ho použije pro provider API call, zahodí. Klíče zůstávají u uživatele (localStorage), Worker je neukládá do KV ani environment variables. Přenos přes HTTPS.

### Struktura projektu
```
gis-proxy/
├── wrangler.toml
├── src/
│   ├── index.js              ← router
│   ├── providers/
│   │   ├── xai.js            ← Grok Imagine (sync)
│   │   ├── luma.js           ← Luma Photon (async + polling)
│   │   └── replicate.js      ← fáze 2
│   └── utils/
│       ├── cors.js
│       └── errors.js
```

### URL routing
```
POST /xai/generate    → xai.js handler
POST /luma/generate   → luma.js handler (s polling loopem)
```

### xAI handler (synchronní)
1. Přijme `{ prompt, aspect_ratio, model, xai_key }` od GIS
2. POST na `api.x.ai/v1/images/generations` s `Authorization: Bearer {xai_key}`
3. Vrátí `{ images: [{ url }] }` s CORS hlavičkami

### Luma handler (asynchronní + polling)
1. Přijme payload s `luma_key` + volitelné reference pole
2. POST na Luma API → dostane `generation_id`
3. Polling loop každé 2s: GET `/generations/{id}`
4. Dokud `state === "completed"` nebo timeout
5. Vrátí `{ image_url }` s CORS hlavičkami
6. **Velká výhoda:** přes nativní Luma API jsou dostupné `image_ref[]` (až 14), `style_ref[]`, `character_ref`, `modify_image_ref` — co fal.ai wrapper nemá

### Cloudflare Workers timeout
Free tier: 30s CPU time per request. Luma generace typicky 8–20s — v pořádku. Fallback: Worker vrátí `generation_id` a GIS dopolluje sám.

### Změny v GIS kódu
Minimální — přidání do `MODEL_CONFIGS` a dva nové provider adaptery (~150 řádků):

```javascript
// Nový provider switch v generateImage():
case 'proxy_xai':  return proxyXaiAdapter(...);
case 'proxy_luma': return proxyLumaAdapter(...);

// Nové MODEL_CONFIGS záznamy:
{ key: 'grok_imagine', provider: 'proxy_xai', refs: false, ... }
{ key: 'photon',       provider: 'proxy_luma', refs: true, maxRefs: 14, ... }
{ key: 'photon_flash', provider: 'proxy_luma', refs: true, maxRefs: 14, ... }
```

Nová UI pole pro API klíče: xAI Key, Luma Key (zobrazí se jen při výběru příslušného modelu).

---

## 6. Fáze implementace

### Fáze 1 — Core proxy (1 den)
- [ ] Cloudflare účet + Wrangler CLI setup
- [ ] Worker kostra: router, CORS utils, error handling
- [ ] xAI handler (nejjednodušší — synchronní)
- [ ] Test Grok Imagine přes GIS

### Fáze 2 — Luma Photon (1 den)
- [ ] Luma handler s polling loopem
- [ ] Mapování GIS reference systému na Luma formáty
- [ ] Test: T2I, image_ref, style_ref, character_ref, modify
- [ ] Přidat Photon + Photon Flash do GIS MODEL_CONFIGS

### Fáze 3 — GIS UI (půl dne)
- [ ] Nová API key pole (xAI key, Luma key)
- [ ] PROXY_BASE konstanta v konfiguraci
- [ ] End-to-end test

### Fáze 4 — Rozšíření (dle potřeby)
- [ ] Replicate adapter
- [ ] Uni-1 (až API otevře — jen nový model string do Luma handleru)
- [ ] Vertex AI / Imagen (složitější: OAuth2 service account)

---

## 7. Srovnávací tabulka nových modelů

| | Grok Imagine (fal) | Grok Imagine (proxy) | Photon (fal) | Photon (proxy) | Uni-1 |
|---|---|---|---|---|---|
| Dostupnost | ✅ ihned | ✅ ihned | ✅ ihned | ✅ ihned | ⏳ waitlist |
| CORS | ✅ | ✅ (proxy) | ✅ | ✅ (proxy) | — |
| Cena / img | $0.02 | $0.07 | $0.002–0.015 | $0.002–0.015 | ~$0.09 |
| Multi-ref | ❌ | ✅ | ❌ | ✅ (až 14) | — |
| Character ref | ❌ | ❌ | ❌ | ✅ | — |
| Style ref | ❌ | ❌ | ❌ | ✅ | — |
| Seed | ❌ | ❌ | ❌ | ❌ | — |
| Nový klíč potřeba | Ne (fal key) | Ano (xAI key) | Ne (fal key) | Ano (Luma key) | — |

**Doporučení první implementace:**
1. **Photon Flash přes fal.ai** — ihned, nulová změna infrastruktury, nejlevnější model ($0.002/img)
2. **Photon přes proxy** — plné reference včetně character_ref
3. **Grok Imagine přes fal.ai** — ihned, jiný estetický charakter než FLUX

---

## 8. HappyHorse 1.0 (Alibaba ATH)
*Research: 18. dubna 2026*

### Co to je
Video generation model od **Alibaba ATH** (Alibaba Token Hub AI Innovation Unit). 15B parametrů, unified 40-layer Transformer architektura generující video + audio v jediném forward passu (no cross-attention modules). Claimed inference: ~38 sekund pro 1080p clip na jednom NVIDIA H100.

**Vydán:** Anonymně na Artificial Analysis Video Arena začátkem dubna 2026. Alibaba ATH se přihlásila k autorství 10. dubna 2026. Vývojový team vede Zhang Di (bývalý VP Kuaishou, architekt Kling AI).

### Výkon (Artificial Analysis Video Arena, duben 2026)
- **#1 T2V bez audia**: Elo 1389 (Seedance 2.0 druhá s ~1273 — 115 bodů rozdíl)
- **#1 I2V bez audia**: Elo 1402 (Seedance 2.0 druhá s 1355)
- **#2 T2V s audiem**: těsně za Seedance 2.0
- **#2 I2V s audiem**: 1 bod za Seedance 2.0

Elo gap ~60 bodů znamená ~58–59% win rate v blind head-to-head. 60% testovacích samples v Areně byly portréty nebo talking-head clipy — faktor který podpořil top rank.

### Modality — ⚠ DŮLEŽITÉ PRO VFX/VIDEO EDIT USE CASE

Podle oficiálních materiálů Alibaba ATH a fal.ai announcement podporuje **4 modality**:
- Text-to-Video (s/bez nativního audia)
- Image-to-Video (s/bez nativního audia)

**Video-to-Video edit / reference-to-video / motion transfer / extend / inpaint — NENÍ mezi deklarovanými modalities.** Žádný z ověřených zdrojů (fal.ai announcement, Alibaba ATH Twitter `@HappyHorseATH`, TechNode, GIGAZINE) video edit mode nezmiňuje. To je výrazný rozdíl oproti Seedance 2.0, který má dedikovaný reference-to-video endpoint pro motion transfer + video extension.

Pokud tým video edit připraví později (verze 1.5/2.0), budeme vědět. Aktuálně **HappyHorse není řešení pro video edit use case**.

### API stav

**⏳ NEDOSTUPNÉ v produkci.** K 18. dubnu 2026:
- Model je v **closed/private beta** (interní testování Alibaba ATH)
- **Public API launch plánován na 30. duben 2026**
- **fal.ai bude jeden z exclusive official API providerů při launchi** (late April 2026, announcement na `fal.ai/happyhorse-1.0`)
- Žádné downloadable weights, žádný oficiální GitHub repo, žádný HuggingFace model card

### Cena
**Neznámá.** Žádný oficiální pricing zatím nebyl publikován. Fake sites (viz níže) uvádějí $19.90–$59.90/měsíc ale to jsou neověřené agregátor plány.

### ⚠ KRITICKÁ VAROVÁNÍ — fake sites a phishing

Alibaba ATH **oficiálně varovala 10. dubna 2026** přes `@HappyHorseATH` na X/Twitter:
> *"Zatím jsme nespustili žádnou oficiální stránku. Web který jsi viděl, není náš. Jsme součástí Alibaba's ATH AI Innovation Unit, a až budeme připraveni, dozvíte se."*

**Jediný ověřený oficiální kanál k dnešnímu dni:** Twitter/X účet `@HappyHorseATH`.

**Následující weby NEJSOU oficiální — nepoužívat, nevkládat API klíče, nesdílet credit card:**
- `happyhorse.me`, `happyhorse.video`, `happyhorse.mobi`
- `happyhorsesai.com`, `ai-happyhorse.github.io`
- Všechny třetí-strana weby co už nabízejí "HappyHorse API" s měsíčními tarify ($19.90/$39.90/$59.90)
- GitHub repos nalezené pod jménem — jsou fan/community forky, nikoli oficiální Alibaba repo

Toto zrcadlí pattern jiných čínských AI launch (Xiaomi "Hunter Alpha", Zhipu "Pony Alpha") — SEO operace third-party stran co vytvářejí neoficiální presence a phishing stránky před oficiálním release.

### Open-source status
Deklarováno jako "fully open-source with commercial licensing" na press materiálech 9. dubna. Nezávisle NEOVĚŘENO k 18. dubnu. Alibaba ATH řeklo CNBC jen že "API access to open soon", bez commitmentu k open-source timeline.

### Integrace do GIS

**Krátkodobě (do 30. dubna 2026):** NIC. API neexistuje. Jakýkoli "HappyHorse API" aktuálně prezentovaný = fake nebo neoficiální proxy, riziko phishingu a platby za přístup který nemusí fungovat.

**Po 30. dubnu 2026 — pokud launch proběhne přes fal.ai:**
- Integrace jako další standardní **T2V + I2V** provider přes fal.ai handler (už máme infrastrukturu)
- 4 VIDEO_MODELS entries: `happyhorse_t2v`, `happyhorse_t2v_audio`, `happyhorse_i2v`, `happyhorse_i2v_audio` (pokud fal.ai rozdělí endpointy podle audio flag, jinak 2 + toggle)
- **Nepoužívat pro video edit** — model tu modalitu nepodporuje

**Kritéria pro integraci po launchi (checklist):**
- [ ] Oficiální announcement na `fal.ai/happyhorse-1.0` že endpoint je live (ne "coming soon")
- [ ] API dokumentace s konkrétním model ID (`bytedance/seedance-2.0/...` style)
- [ ] Známé pricing (tokens per 1080p second)
- [ ] Aspect ratios a duration range potvrzeno
- [ ] Test přes fal.ai playground před kódem
- [ ] Žádný upload credentials do stránek mimo `fal.ai` a `@HappyHorseATH` oficiální communication

### Alternativy pro video edit use case (v mezidobí)

Pro VFX / video-to-video edit workflows, které HappyHorse nepokrývá, zůstávají:
- **Runway Gen-4.5 Video Edit** (výzkum hotový — viz RESEARCH_REFS, CORS proxy potřeba)
- **Kling V2V** (integrováno v GIS)
- **Seedance 2.0 reference-to-video** (integrováno přes fal.ai)
- **WAN 2.7 V2V** (integrováno)
- **Luma Modify / Extend** (přes proxy)
- **xAI Grok Video Edit** (integrováno přes fal.ai)

### Shrnutí: rozhodnutí

**Počkat do ~začátku května 2026.** Zkontrolovat fal.ai launch. Pokud bude T2V+I2V live s dokumentovanou cenou a stability → integrovat jako další standardní provider. Video edit mode v plánu není — pro tuhle funkci modelovat jinou cestu.

**Do té doby:** nereagovat na žádné "HappyHorse API available now!" nabídky — jsou fake.

