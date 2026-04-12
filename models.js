// ═══════════════════════════════════════════════════════
// MODEL DEFINITIONS
// ═══════════════════════════════════════════════════════

// ── Application identity ──────────────────────────────
const GIS_COPYRIGHT = 'Generative Image Studio \u00a9 2026 Petr Sajner. All rights reserved.';
const _GIS_SIG = btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20);
// ─────────────────────────────────────────────────────
const MODELS = {
  nb2: {
    id: 'gemini-3.1-flash-image-preview',
    name: 'NB2',
    type: 'gemini',
    thinking: true,
    refs: true,
    maxRefs: 14,
    seed: false,
    resolutions: ['512', '1K', '2K', '4K'],
  },
  nb1: {
    id: 'gemini-2.5-flash-image',
    name: 'NB',
    type: 'gemini',
    thinking: false,
    refs: true,
    maxRefs: 14,
    seed: false,
    resolutions: ['1K'],   // NB1 max resolution is 1K
  },
  nbpro: {
    id: 'gemini-3-pro-image-preview',
    name: 'NB Pro',
    type: 'gemini',
    thinking: false,   // API: "Thinking level is not supported for this model"
    refs: true,
    maxRefs: 14,
    seed: false,
    resolutions: ['1K', '2K', '4K'],
  },
  i4: {
    id: 'imagen-4.0-generate-001',
    name: 'Imagen 4',
    type: 'imagen',
    thinking: false,
    refs: false,
    maxRefs: 0,
    seed: true,
    resolutions: ['1K', '2K'],
  },
  i4fast: {
    id: 'imagen-4.0-fast-generate-001',
    name: 'Imagen 4 Fast',
    type: 'imagen',
    thinking: false,
    refs: false,
    maxRefs: 0,
    seed: true,
    resolutions: ['1K'],
  },
  i4ultra: {
    id: 'imagen-4.0-ultra-generate-001',
    name: 'Imagen 4 Ultra',
    type: 'imagen',
    thinking: false,
    refs: false,
    maxRefs: 0,
    seed: true,
    resolutions: ['1K'],  // Ultra returns 1K (2K not supported via REST API key)
  },

  // ── FLUX.2 family — fal.ai (browser-compatible CORS, base64 data URIs podporovány) ──
  flux2_pro: {
    id: 'fal-ai/flux-2-pro',
    name: 'FLUX.2 Pro',
    type: 'flux',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 8,
    seed: true,
    steps: false,
    guidance: false,
    groundingSearch: false,
    safetyTolerance: true,
    promptUpsampling: true,
    resolutions: ['512', '1K', '2K wide', '4MP'],
  },
  flux2_flex: {
    id: 'fal-ai/flux-2-flex',
    name: 'FLUX.2 Flex',
    type: 'flux',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,              // fal flex/edit: až 10 referencí
    seed: true,
    steps: true,              // num_inference_steps
    guidance: true,           // guidance_scale
    groundingSearch: false,
    safetyTolerance: true,
    promptUpsampling: true,
    resolutions: ['512', '1K', '2K wide', '4MP'],
  },
  flux2_max: {
    id: 'fal-ai/flux-2-max',
    name: 'FLUX.2 Max',
    type: 'flux',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 8,
    seed: true,
    steps: false,
    guidance: false,
    groundingSearch: false,   // fal.ai Max nemá grounding search
    safetyTolerance: true,
    promptUpsampling: true,
    resolutions: ['512', '1K', '2K wide', '4MP'],
  },
  flux2_dev: {
    id: 'fal-ai/flux-2',
    name: 'FLUX.2 Dev',
    type: 'flux',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 6,
    seed: true,
    steps: true,
    guidance: true,
    groundingSearch: false,
    safetyTolerance: false,
    promptUpsampling: true,
    resolutions: ['512', '1K', '2K wide', '4MP'],
  },

  // ── SeeDream family — ByteDance via fal.ai ──
  // Flat $0.04/img bez ohledu na rozlišení, až 4K, max 10 refs
  // image_size: auto_2K/auto_4K nebo {width,height} — NE fal.ai flux presety
  seedream45: {
    id: 'fal-ai/bytedance/seedream/v4.5',
    name: 'SeeDream 4.5',
    type: 'seedream',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,
    seed: true,
    enhancePrompt: true,
    resolutions: ['2K', '4K'],
  },
  seedream5lite: {
    id: 'fal-ai/bytedance/seedream/v5/lite',
    name: 'SeeDream 5.0 Lite',
    type: 'seedream',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,
    seed: true,
    enhancePrompt: true,
    resolutions: ['2K', '4K'],
  },

  // ── Kling Image — Kuaishou via fal.ai ──
  // Refs přes @Image1,@Image2 syntax (nativní pro model i náš preprocessor)
  // T2I: fal-ai/kling-image/v3/text-to-image, I2I (s refs): fal-ai/kling-image/v3/image-to-image
  kling_v3: {
    id: 'fal-ai/kling-image/v3',
    name: 'Kling Image V3',
    type: 'kling',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,
    seed: false,
    steps: false,
    guidance: false,
    negPrompt: false,
    resolutions: ['1K', '2K'],
  },

  // T2I: fal-ai/kling-image/o3/text-to-image, I2I: fal-ai/kling-image/o3/image-to-image
  // Nejnovější model (únor 2026) — 1K/2K/4K, aspect_ratio "auto" pro I2I
  kling_o3: {
    id: 'fal-ai/kling-image/o3',
    name: 'Kling Image O3',
    type: 'kling',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,
    seed: false,
    steps: false,
    guidance: false,
    negPrompt: false,
    resolutions: ['1K', '2K', '4K'],
  },

  // ── Z-Image family — Tongyi-MAI (Alibaba) via fal.ai ──
  // Base: 28 steps, CFG, negative prompt — plná kontrola (T2I)
  // Base I2I: stejné parametry + image_url + strength (endpoint /base/image-to-image)
  // Turbo: 8 steps, no CFG — T2I + I2I (endpoint /turbo + /turbo/image-to-image)
  zimage_base: {
    id: 'fal-ai/z-image/base',
    name: 'Z-Image Base',
    type: 'zimage',
    provider: 'fal',
    thinking: false,
    refs: false,
    maxRefs: 0,
    seed: true,
    steps: true,        // num_inference_steps default 28
    guidance: true,     // guidance_scale default 4
    negPrompt: true,    // plný negative prompt
    resolutions: ['1K', '2K'],
  },
  // Poznámka: fal-ai/z-image/base nepodporuje image_url (Base I2I endpoint neexistuje)
  // Z-Image I2I je dostupné jen přes zimage_turbo → fal-ai/z-image/turbo/image-to-image
  zimage_turbo: {
    id: 'fal-ai/z-image/turbo',
    name: 'Z-Image Turbo',
    type: 'zimage',
    provider: 'fal',
    thinking: false,
    refs: true,           // 1 vstupní obrázek pro I2I (optional)
    maxRefs: 1,           // max 1 — Z-Image Turbo I2I endpoint
    i2iModel: true,       // označení: ref sekce = I2I vstup, ne multi-ref
    seed: true,
    steps: true,          // 1–16 steps
    guidance: false,      // Turbo: no CFG
    negPrompt: false,     // Turbo: no negative prompt
    resolutions: ['1K', '2K'],
  },

  // ── WAN 2.7 — Segmind API via proxy ────────────────────
  // T2I: up to 2K (std) / 4K (Pro), thinking mode, neg prompt
  // Edit: up to 9 refs, instruction-based editing
  // Auth: x-api-key header, sync response
  wan27_std: {
    id: 'wan-video/wan-2.7-image',
    name: 'WAN 2.7',
    type: 'wan27r',
    provider: 'replicate',
    refs: false,
    maxRefs: 0,
    editModel: false,
    seed: true,
    negPrompt: true,
  },
  wan27_pro: {
    id: 'wan-video/wan-2.7-image-pro',
    name: 'WAN 2.7 Pro',
    type: 'wan27r',
    provider: 'replicate',
    refs: false,
    maxRefs: 0,
    editModel: false,
    seed: true,
    negPrompt: true,
  },
  wan27_edit: {
    id: 'wan-video/wan-2.7-image',
    name: 'WAN 2.7 Edit',
    type: 'wan27r',
    provider: 'replicate',
    refs: true,
    maxRefs: 9,
    editModel: true,
    seed: true,
    negPrompt: false,
  },
  wan27_pro_edit: {
    id: 'wan-video/wan-2.7-image-pro',
    name: 'WAN 2.7 Pro Edit',
    type: 'wan27r',
    provider: 'replicate',
    refs: true,
    maxRefs: 9,
    editModel: true,
    seed: true,
    negPrompt: false,
  },

  // ── Qwen Image 2 — Alibaba Tongyi via fal.ai ──
  // T2I Standard + Pro, Edit Standard + Pro
  // Edit endpointy: editModel:true — ref panel = vstupní obrázek pro instrukční editaci
  qwen2_std: {
    id: 'fal-ai/qwen-image-2/text-to-image',
    name: 'Qwen Image 2',
    type: 'qwen2',
    provider: 'fal',
    refs: false,
    maxRefs: 0,
    seed: true,
    steps: true,      // default 25, range 1–50
    guidance: true,   // default 5.0
    negPrompt: true,
    acceleration: true,
    promptExpansion: true,
    editModel: false,
  },
  qwen2_pro: {
    id: 'fal-ai/qwen-image-2/pro/text-to-image',
    name: 'Qwen Image 2 Pro',
    type: 'qwen2',
    provider: 'fal',
    refs: false,
    maxRefs: 0,
    seed: true,
    steps: true,      // default 35, range 1–50
    guidance: true,   // default 7.0
    negPrompt: true,
    acceleration: true,
    promptExpansion: true,
    editModel: false,
  },
  qwen2_edit: {
    id: 'fal-ai/qwen-image-2/edit',
    name: 'Qwen Image 2 Edit',
    type: 'qwen2',
    provider: 'fal',
    refs: true,
    maxRefs: 4,       // multi-image compositing (up to 4 refs)
    editModel: true,  // ref panel = vstupní obrázky pro instrukční editaci
    seed: true,
    steps: true,      // default 25
    guidance: true,   // default 4.5
    negPrompt: true,
    acceleration: false,
    promptExpansion: false,
  },
  qwen2_pro_edit: {
    id: 'fal-ai/qwen-image-2/pro/edit',
    name: 'Qwen Image 2 Pro Edit',
    type: 'qwen2',
    provider: 'fal',
    refs: true,
    maxRefs: 4,       // multi-image compositing (up to 4 refs)
    editModel: true,
    seed: true,
    steps: true,      // default 35
    guidance: true,   // default 5.0
    negPrompt: true,
    acceleration: false,
    promptExpansion: false,
  },
  grok_imagine: {
    id: 'grok-imagine-image',
    name: 'Grok Imagine',
    type: 'proxy_xai',
    refs: true,
    maxRefs: 1,
    editModel: false,
    seed: false,
    i2iModel: true,
  },
  photon_flash: {
    id: 'photon-flash-1',
    name: 'Photon Flash',
    type: 'proxy_luma',
    refs: true,
    maxRefs: 14,
    editModel: false,
    seed: false,
    i2iModel: false,
  },
  photon: {
    id: 'photon-1',
    name: 'Photon',
    type: 'proxy_luma',
    refs: true,
    maxRefs: 14,
    editModel: false,
    seed: false,
    i2iModel: false,
  },
  // ── Mystic (Freepik/Magnific) ──────────────────────────────
  mystic_realism: {
    id: 'mystic-realism',
    name: 'Mystic Realism',
    type: 'proxy_mystic',
    mysticModel: 'realism',
    refs: true,    // refs[0] = structure ref, refs[1] = style ref
    maxRefs: 2,
    seed: false,
  },
  mystic_fluid: {
    id: 'mystic-fluid',
    name: 'Mystic Fluid',
    type: 'proxy_mystic',
    mysticModel: 'fluid',
    refs: true,
    maxRefs: 2,
    seed: false,
  },
  mystic_zen: {
    id: 'mystic-zen',
    name: 'Mystic Zen',
    type: 'proxy_mystic',
    mysticModel: 'zen',
    refs: true,
    maxRefs: 2,
    seed: false,
  },
  mystic_flexible: {
    id: 'mystic-flexible',
    name: 'Mystic Flexible',
    type: 'proxy_mystic',
    mysticModel: 'flexible',
    refs: true,
    maxRefs: 2,
    seed: false,
  },
  mystic_super_real: {
    id: 'mystic-super-real',
    name: 'Mystic Super Real',
    type: 'proxy_mystic',
    mysticModel: 'super_real',
    refs: true,
    maxRefs: 2,
    seed: false,
  },
  mystic_editorial: {
    id: 'mystic-editorial',
    name: 'Mystic Editorial',
    type: 'proxy_mystic',
    mysticModel: 'editorial_portraits',
    refs: true,
    maxRefs: 2,
    seed: false,
  },
  // ── Freepik/Magnific Edit Tools ─────────────────────────
  freepik_relight: {
    id: 'freepik-relight',
    name: 'Magnific Relight',
    type: 'proxy_freepik_edit',
    freepikTool: 'relight',
    refs: true,
    maxRefs: 2,    // ref[0] = source image (required), ref[1] = lighting ref (optional)
    editModel: true,
    seed: false,
  },
  freepik_style: {
    id: 'freepik-style-transfer',
    name: 'Magnific Style Transfer',
    type: 'proxy_freepik_edit',
    freepikTool: 'style_transfer',
    refs: true,
    maxRefs: 2,    // ref[0] = source (required), ref[1] = style source (required)
    editModel: true,
    seed: false,
  },
  freepik_skin: {
    id: 'freepik-skin-enhancer',
    name: 'Magnific Skin Enhancer',
    type: 'proxy_freepik_edit',
    freepikTool: 'skin_enhancer',
    refs: true,
    maxRefs: 1,    // ref[0] = source image (required)
    editModel: true,
    seed: false,
  },
};

// ── Helper: model key z model objektu ──
function getModelKey(model) {
  return Object.keys(MODELS).find(k => MODELS[k].id === model.id) || 'nb2';
}

// ── Helper: max počet referencí pro aktuální model ──
function getRefMax() {
  return MODELS[currentModel]?.maxRefs ?? 14;
}

// Maximum refs storable regardless of current model — allows adding refs
// even when active model doesn't support them (they stay hidden until model switch)
const REF_GLOBAL_MAX = 14;

// ── Mystic: aspect ratio mapping (GIS → Freepik API strings) ──────────────
const MYSTIC_ASPECT_MAP = {
  '1:1':  'square_1_1',
  '4:3':  'classic_4_3',
  '3:4':  'traditional_3_4',
  '16:9': 'widescreen_16_9',
  '9:16': 'social_story_9_16',
  '3:2':  'standard_3_2',
  '2:3':  'portrait_2_3',
  '2:1':  'horizontal_2_1',
  '1:2':  'vertical_1_2',
  '5:4':  'social_5_4',
  '4:5':  'social_post_4_5',
};

// ── Helper: výpočet pixel rozměrů pro FLUX z aspect ratio + quality tier ──
// ── Helper: výpočet pixel rozměrů pro FLUX z aspect ratio + quality tier ──
// Vždy zaokrouhluje na násobky 64 (fal.ai požadavek pro FLUX.2)
function calcFluxDims(aspectRatioStr, longSide) {
  const parts = aspectRatioStr.split(':').map(Number);
  const [aw, ah] = parts.length === 2 ? parts : [1, 1];
  const snap64 = v => Math.max(64, Math.round(v / 64) * 64);
  const ls = snap64(longSide);   // snap i samotný longSide
  let w, h;
  if (aw >= ah) {
    w = ls;
    h = snap64(ls * ah / aw);
  } else {
    h = ls;
    w = snap64(ls * aw / ah);
  }
  // fal.ai: min 512px na každé straně pro FLUX.2
  w = Math.max(512, Math.min(4096, w));
  h = Math.max(512, Math.min(4096, h));
  return { w, h };
}

// ── Helper: fal.ai image_size hodnota ──
// Pro 1K + standardní ratio → preset string (garantovaně funguje)
// Pro 2K/4MP nebo nestandardní ratio → custom {width, height} (snap64)
const FAL_PRESETS = {
  '1:1':  { 512: 'square',       1024: 'square_hd'      },
  '16:9': { 512: 'landscape_16_9', 1024: 'landscape_16_9' },
  '9:16': { 512: 'portrait_16_9',  1024: 'portrait_16_9'  },
  '4:3':  { 512: 'landscape_4_3',  1024: 'landscape_4_3'  },
  '3:4':  { 512: 'portrait_4_3',   1024: 'portrait_4_3'   },
};

function falImageSize(aspectRatioStr, tier) {
  const preset = FAL_PRESETS[aspectRatioStr]?.[tier];
  if (preset) return preset;                          // preset string
  const { w, h } = calcFluxDims(aspectRatioStr, tier);
  return { width: w, height: h };                     // custom objekt
}

// ── Helper: Z-Image MP-based dimensions ──
// mpTarget: 1 = 1MP, 2 = 2MP, 4 = 4MP (tier label, ne nutně přesný počet MP)
// Z-Image max: 2048px per side — při překročení přepočítá druhou stranu
function calcZImageDims(ratioStr, mpTarget) {
  const parts = ratioStr.split(':').map(Number);
  const [aw, ah] = parts.length === 2 ? parts : [16, 9];
  const snap64 = v => Math.max(64, Math.round(v / 64) * 64);
  const MAX = 2048;
  const totalPx = mpTarget * 1_000_000;
  let w = snap64(Math.sqrt(totalPx * aw / ah));
  let h = snap64(w * ah / aw);
  // Cap na 2048px per side, zachovat aspect ratio
  if (w > MAX) { w = snap64(MAX); h = snap64(w * ah / aw); }
  if (h > MAX) { h = snap64(MAX); w = snap64(h * aw / ah); }
  return { width: w, height: h };
}

// ── Helper: aktualizuj info label u quality tieru ──
function updateFluxQualityInfo() {
  const tier = parseInt(document.querySelector('input[name="fluxQuality"]:checked')?.value || '1024');
  const ratio = document.getElementById('aspectRatio')?.value || '16:9';
  const size = falImageSize(ratio, tier);
  let label;
  if (typeof size === 'string') {
    // preset — zobraz přibližné dims v závorce
    const { w, h } = calcFluxDims(ratio, tier);
    label = `${size} (~${w}×${h})`;
  } else {
    label = `${size.width}×${size.height} px`;
  }
  const infoEl = document.getElementById('fluxQualityInfo');
  if (infoEl) infoEl.textContent = label;
}

// ── Helper: aktualizuj info label u Z-Image quality tieru ──
function updateZImageQualityInfo() {
  const mpVal = document.querySelector('input[name="zimageRes"]:checked')?.value || '1';
  const ratio = document.getElementById('aspectRatio')?.value || '16:9';
  const { width, height } = calcZImageDims(ratio, parseInt(mpVal));
  const infoEl = document.getElementById('zimageQualityInfo');
  if (infoEl) infoEl.textContent = `${width}×${height} px`;
}

let currentModel = 'nb2';
let refs = []; // [{name, mimeType, data}]

