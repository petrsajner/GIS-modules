// ═══════════════════════════════════════════════════════
// MODEL DEFINITIONS
// ═══════════════════════════════════════════════════════

// ── Application identity ──────────────────────────────
const GIS_COPYRIGHT = 'Generative Image Studio \u00a9 2026 Petr Sajner. All rights reserved.';
const _GIS_SIG = btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20);

// ── Default negative prompt (shared across models that support it) ──
const _DEFAULT_NEG_PROMPT = 'low quality, blurry, distorted, deformed, ugly, watermark, text, logo, bad anatomy, extra fingers, extra limbs, disfigured, poorly drawn, mutation, duplicate, out of frame, worst quality, jpeg artifacts';

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
    resolutions: ['1K', '2K', '4K'],
    maxCount: 4,
    grounding: true,
    persistRetry: true,
  },
  nb1: {
    id: 'gemini-2.5-flash-image',
    name: 'NB',
    type: 'gemini',
    thinking: false,
    refs: true,
    maxRefs: 14,
    seed: false,
    resolutions: ['1K'],
    maxCount: 4,
    grounding: true,
    persistRetry: true,
  },
  nbpro: {
    id: 'gemini-3-pro-image-preview',
    name: 'NB Pro',
    type: 'gemini',
    thinking: false,
    refs: true,
    maxRefs: 14,
    seed: false,
    resolutions: ['1K', '2K', '4K'],
    maxCount: 4,
    grounding: true,
    persistRetry: true,
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
    maxCount: 4,
    persistRetry: true,
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
    maxCount: 4,
    persistRetry: true,
  },
  i4ultra: {
    id: 'imagen-4.0-ultra-generate-001',
    name: 'Imagen 4 Ultra',
    type: 'imagen',
    thinking: false,
    refs: false,
    maxRefs: 0,
    seed: true,
    resolutions: ['1K', '2K'],
    maxCount: 1,      // Ultra: API returns max 1 image per call
    persistRetry: true,
  },

  // ── FLUX.2 family — fal.ai ──
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
    safetyTolerance: true,
    resolutions: ['1K', '2K', '4MP'],
    resValues: { '1K': 1024, '2K': 1440, '4MP': 2048 },
    maxCount: 4,
  },
  flux2_flex: {
    id: 'fal-ai/flux-2-flex',
    name: 'FLUX.2 Flex',
    type: 'flux',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,
    seed: true,
    steps: true,
    guidance: true,
    safetyTolerance: true,
    resolutions: ['1K', '2K', '4MP'],
    resValues: { '1K': 1024, '2K': 1440, '4MP': 2048 },
    maxCount: 4,
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
    safetyTolerance: true,
    resolutions: ['1K', '2K', '4MP'],
    resValues: { '1K': 1024, '2K': 1440, '4MP': 2048 },
    maxCount: 4,
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
    safetyTolerance: false,
    resolutions: ['1K', '2K', '4MP'],
    resValues: { '1K': 1024, '2K': 1440, '4MP': 2048 },
    maxCount: 4,
  },

  // ── SeeDream family — ByteDance via fal.ai ──
  seedream45: {
    id: 'fal-ai/bytedance/seedream/v4.5',
    name: 'SeeDream 4.5',
    type: 'seedream',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,
    seed: true,
    safetyChecker: true,
    resolutions: ['2K', '4K'],
    maxCount: 4,
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
    safetyChecker: true,
    resolutions: ['2K', '3K'],
    maxCount: 4,
  },

  // ── Kling Image — Kuaishou via fal.ai ──
  kling_v3: {
    id: 'fal-ai/kling-image/v3',
    name: 'Kling Image V3',
    type: 'kling',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,
    seed: false,
    resolutions: ['1K', '2K'],
    maxCount: 4,
  },
  kling_o3: {
    id: 'fal-ai/kling-image/o3',
    name: 'Kling Image O3',
    type: 'kling',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 10,
    seed: false,
    resolutions: ['1K', '2K', '4K'],
    maxCount: 4,
  },

  // ── Z-Image family — Tongyi-MAI (Alibaba) via fal.ai ──
  zimage_base: {
    id: 'fal-ai/z-image/base',
    name: 'Z-Image Base',
    type: 'zimage',
    provider: 'fal',
    thinking: false,
    refs: false,
    maxRefs: 0,
    seed: true,
    steps: true,
    guidance: true,
    negPrompt: true,
    safetyChecker: true,
    resolutions: ['1K', '2K'],
    resValues: { '1K': '1', '2K': '2' },
    maxCount: 4,
  },
  zimage_turbo: {
    id: 'fal-ai/z-image/turbo',
    name: 'Z-Image Turbo',
    type: 'zimage',
    provider: 'fal',
    thinking: false,
    refs: false,
    maxRefs: 0,
    seed: true,
    steps: true,
    guidance: false,
    negPrompt: false,
    safetyChecker: true,
    acceleration: true,
    resolutions: ['1K', '2K'],
    resValues: { '1K': '1', '2K': '2' },
    maxCount: 4,
  },
  zimage_turbo_i2i: {
    id: 'fal-ai/z-image/turbo/image-to-image',
    name: 'Z-Image Turbo I2I',
    type: 'zimage',
    provider: 'fal',
    thinking: false,
    refs: true,
    maxRefs: 1,
    i2iModel: true,
    seed: true,
    steps: true,
    guidance: false,
    negPrompt: false,
    safetyChecker: true,
    acceleration: true,
    strength: true,
    resolutions: ['1K', '2K'],
    resValues: { '1K': '1', '2K': '2' },
    maxCount: 4,
  },

  // ── WAN 2.7 — Replicate via proxy ──
  wan27_std: {
    id: 'wan-video/wan-2.7-image',
    name: 'WAN 2.7',
    type: 'wan27r',
    provider: 'replicate',
    refs: false,
    maxRefs: 0,
    editModel: false,
    seed: true,
    aspectFilter: 'wan27',
    resolutions: ['1K', '2K'],
    maxCount: 4,
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
    thinkingCheckbox: true,
    aspectFilter: 'wan27',
    resolutions: ['1K', '2K', '4K'],
    maxCount: 4,
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
    resolutions: ['1K', '2K'],
    maxCount: 1,
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
    resolutions: ['1K', '2K', '4K'],
    maxCount: 1,
  },

  // ── Qwen Image 2 — Alibaba via fal.ai ──
  qwen2_std: {
    id: 'fal-ai/qwen-image-2/text-to-image',
    name: 'Qwen Image 2',
    type: 'qwen2',
    provider: 'fal',
    refs: false,
    maxRefs: 0,
    seed: true,
    steps: true,
    guidance: true,
    negPrompt: true,
    acceleration: true,
    safetyChecker: true,
    editModel: false,
    resolutions: ['1K', '2K'],
    maxCount: 4,
  },
  qwen2_pro: {
    id: 'fal-ai/qwen-image-2/pro/text-to-image',
    name: 'Qwen Image 2 Pro',
    type: 'qwen2',
    provider: 'fal',
    refs: false,
    maxRefs: 0,
    seed: true,
    steps: true,
    guidance: true,
    negPrompt: true,
    acceleration: true,
    safetyChecker: true,
    editModel: false,
    resolutions: ['1K', '2K'],
    maxCount: 4,
  },
  qwen2_edit: {
    id: 'fal-ai/qwen-image-2/edit',
    name: 'Qwen Image 2 Edit',
    type: 'qwen2',
    provider: 'fal',
    refs: true,
    maxRefs: 3,
    editModel: true,
    seed: true,
    steps: true,
    guidance: true,
    negPrompt: true,
    safetyChecker: true,
    acceleration: false,
    resolutions: ['1K', '2K'],
    maxCount: 1,
  },
  qwen2_pro_edit: {
    id: 'fal-ai/qwen-image-2/pro/edit',
    name: 'Qwen Image 2 Pro Edit',
    type: 'qwen2',
    provider: 'fal',
    refs: true,
    maxRefs: 3,
    editModel: true,
    seed: true,
    steps: true,
    guidance: true,
    negPrompt: true,
    safetyChecker: true,
    acceleration: false,
    resolutions: ['1K', '2K'],
    maxCount: 1,
  },
  grok_imagine: {
    id: 'grok-imagine-image',
    name: 'Grok Imagine',
    type: 'proxy_xai',
    refs: true,
    maxRefs: 5,
    editModel: false,
    seed: false,
    i2iModel: true,
    aspectFilter: 'grok',
    resolutions: ['1K', '2K'],
    maxCount: 10,
  },
  grok_imagine_pro: {
    id: 'grok-imagine-image-pro',
    name: 'Grok Imagine Pro',
    type: 'proxy_xai',
    refs: true,
    maxRefs: 1,
    editModel: false,
    seed: false,
    i2iModel: true,
    aspectFilter: 'grok',
    resolutions: ['1K', '2K'],
    maxCount: 10,
    defaultRes: '2K',
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
    refs: true,    maxRefs: 2,    seed: false,
  },
  mystic_fluid: {
    id: 'mystic-fluid',
    name: 'Mystic Fluid',
    type: 'proxy_mystic',
    mysticModel: 'fluid',
    refs: true,    maxRefs: 2,    seed: false,
  },
  mystic_zen: {
    id: 'mystic-zen',
    name: 'Mystic Zen',
    type: 'proxy_mystic',
    mysticModel: 'zen',
    refs: true,    maxRefs: 2,    seed: false,
  },
  mystic_flexible: {
    id: 'mystic-flexible',
    name: 'Mystic Flexible',
    type: 'proxy_mystic',
    mysticModel: 'flexible',
    refs: true,    maxRefs: 2,    seed: false,
  },
  mystic_super_real: {
    id: 'mystic-super-real',
    name: 'Mystic Super Real',
    type: 'proxy_mystic',
    mysticModel: 'super_real',
    refs: true,    maxRefs: 2,    seed: false,
  },
  mystic_editorial: {
    id: 'mystic-editorial',
    name: 'Mystic Editorial',
    type: 'proxy_mystic',
    mysticModel: 'editorial_portraits',
    refs: true,    maxRefs: 2,    seed: false,
  },
  // ── Freepik/Magnific Edit Tools ─────────────────────────
  freepik_relight: {
    id: 'freepik-relight',
    name: 'Magnific Relight',
    type: 'proxy_freepik_edit',
    freepikTool: 'relight',
    refs: true,    maxRefs: 2,    editModel: true,    seed: false,
  },
  freepik_style: {
    id: 'freepik-style-transfer',
    name: 'Magnific Style Transfer',
    type: 'proxy_freepik_edit',
    freepikTool: 'style_transfer',
    refs: true,    maxRefs: 2,    editModel: true,    seed: false,
  },
  freepik_skin: {
    id: 'freepik-skin-enhancer',
    name: 'Magnific Skin Enhancer',
    type: 'proxy_freepik_edit',
    freepikTool: 'skin_enhancer',
    refs: true,    maxRefs: 1,    editModel: true,    seed: false,
  },
};

// ── Unified panel types — models using the unified control panel ──
const _UNIFIED_TYPES = new Set(['gemini','imagen','flux','seedream','kling','zimage','wan27r','qwen2','proxy_xai']);
function isUnifiedModel(m) { return _UNIFIED_TYPES.has(m?.type); }

// ── Helper: model key z model objektu ──
function getModelKey(model) {
  return Object.keys(MODELS).find(k => MODELS[k].id === model.id) || 'nb2';
}

// ── Helper: max počet referencí pro aktuální model ──
function getRefMax() {
  return MODELS[currentModel]?.maxRefs ?? 14;
}

// Active refs = first N refs up to model's maxRefs limit.
function getActiveRefs() {
  return refs.slice(0, getRefMax());
}

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
function calcFluxDims(aspectRatioStr, longSide) {
  const parts = aspectRatioStr.split(':').map(Number);
  const [aw, ah] = parts.length === 2 ? parts : [1, 1];
  const snap64 = v => Math.max(64, Math.round(v / 64) * 64);
  const ls = snap64(longSide);
  let w, h;
  if (aw >= ah) { w = ls; h = snap64(ls * ah / aw); }
  else          { h = ls; w = snap64(ls * aw / ah); }
  w = Math.max(512, Math.min(4096, w));
  h = Math.max(512, Math.min(4096, h));
  return { w, h };
}

// ── Helper: fal.ai image_size hodnota ──
const FAL_PRESETS = {
  '1:1':  { 512: 'square',       1024: 'square_hd'      },
  '16:9': { 512: 'landscape_16_9', 1024: 'landscape_16_9' },
  '9:16': { 512: 'portrait_16_9',  1024: 'portrait_16_9'  },
  '4:3':  { 512: 'landscape_4_3',  1024: 'landscape_4_3'  },
  '3:4':  { 512: 'portrait_4_3',   1024: 'portrait_4_3'   },
};

function falImageSize(aspectRatioStr, tier) {
  const preset = FAL_PRESETS[aspectRatioStr]?.[tier];
  if (preset) return preset;
  const { w, h } = calcFluxDims(aspectRatioStr, tier);
  return { width: w, height: h };
}

// ── Helper: Z-Image MP-based dimensions ──
function calcZImageDims(ratioStr, mpTarget) {
  const parts = ratioStr.split(':').map(Number);
  const [aw, ah] = parts.length === 2 ? parts : [16, 9];
  const snap64 = v => Math.max(64, Math.round(v / 64) * 64);
  const MAX = 2048;
  const totalPx = mpTarget * 1_000_000;
  let w = snap64(Math.sqrt(totalPx * aw / ah));
  let h = snap64(w * ah / aw);
  if (w > MAX) { w = snap64(MAX); h = snap64(w * ah / aw); }
  if (h > MAX) { h = snap64(MAX); w = snap64(h * aw / ah); }
  return { width: w, height: h };
}

// ── WAN 2.7 pixel whitelist ──
const _WAN27_PIXELS = {
  '16:9': { '1K': '1280*720',  '2K': '2048*1152', '4K': '4096*2304' },
  '9:16': { '1K': '720*1280',  '2K': '1152*2048', '4K': '2304*4096' },
  '1:1':  { '1K': '1024*1024', '2K': '2048*2048', '4K': '4096*4096' },
  '4:3':  { '1K': '1024*768',  '2K': '2048*1536', '4K': '4096*3072' },
  '3:4':  { '1K': '768*1024',  '2K': '1536*2048', '4K': '3072*4096' },
};

// ── Grok aspect whitelist ──
const _GROK_ASPECTS = new Set(['1:1','3:4','4:3','9:16','16:9','2:3','3:2','9:19.5','19.5:9','9:20','20:9','1:2','2:1','auto']);

// ── Empirical long-side values per tier (measured from actual API output at 16:9) ──
const _MODEL_LONG_SIDES = {
  // Gemini: multiply by ratio (nb2/pro: 1376 base, nb1: 1344 base)
  nb2:   { '1K': 1376, '2K': 2752, '4K': 5504 },
  nb1:   { '1K': 1344 },
  nbpro: { '1K': 1376, '2K': 2752, '4K': 5504 },
  // Imagen: only 1K works via REST API
  i4:      { '1K': 1408, '2K': 2816 },
  i4fast:  { '1K': 1408 },
  i4ultra: { '1K': 1408, '2K': 2816 },
  // SeeDream
  seedream45:    { '2K': 2560, '4K': 3840 },
  seedream5lite: { '2K': 3136, '3K': 4704 },
  // Kling
  kling_v3: { '1K': 1360, '2K': 2720, '4K': 5440 },
  kling_o3: { '1K': 1360, '2K': 2720, '4K': 5440 },
  // Qwen
  qwen2_std:      { '1K': 1664, '2K': 2048 },
  qwen2_pro:      { '1K': 1664, '2K': 2048 },
  qwen2_edit:     { '1K': 1664, '2K': 2048 },
  qwen2_pro_edit: { '1K': 1664, '2K': 2048 },
  // Grok
  grok_imagine:     { '1K': 1408, '2K': 2816 },
  grok_imagine_pro: { '1K': 1408, '2K': 2816 },
  // WAN 2.7 — uses pixel whitelist (handled separately)
};

// Helper: compute approx W×H from empirical long side + aspect ratio
function _approxDims(longSide, aspect) {
  const parts = aspect.split(':').map(Number);
  const [aw, ah] = parts.length === 2 ? parts : [16, 9];
  let w, h;
  if (aw >= ah) { w = longSide; h = Math.round(longSide * ah / aw); }
  else          { h = longSide; w = Math.round(longSide * aw / ah); }
  return w + '\u00d7' + h;
}

// ── Unified resolution info — computes pixel dimensions per model type ──
function updateUnifiedResInfo() {
  const infoEl = document.getElementById('upResInfo');
  if (!infoEl) return;
  const m = MODELS[currentModel];
  if (!m || !isUnifiedModel(m)) return;
  const sel = document.querySelector('input[name="upRes"]:checked');
  if (!sel) { infoEl.textContent = ''; return; }
  const label = sel.value;
  const apiVal = m.resValues?.[label] ?? label;
  const aspect = document.getElementById('aspectRatio')?.value || '16:9';

  // FLUX and Z-Image: use calculated dims (already accurate)
  if (m.type === 'flux') {
    const { w, h } = calcFluxDims(aspect, typeof apiVal === 'number' ? apiVal : parseInt(apiVal));
    infoEl.textContent = w + '\u00d7' + h;
  } else if (m.type === 'zimage') {
    const { width, height } = calcZImageDims(aspect, parseInt(apiVal));
    infoEl.textContent = width + '\u00d7' + height;
  } else if (m.type === 'wan27r') {
    // WAN 2.7: pixel whitelist lookup
    const px = _WAN27_PIXELS[aspect]?.[label];
    if (m.editModel) infoEl.textContent = label + ' (from input)';
    else if (px) infoEl.textContent = px.replace('*', '\u00d7');
    else infoEl.textContent = label + ' (square \u2014 ' + aspect + ' n/a)';
  } else {
    // All other models: use empirical long-side lookup
    const ls = _MODEL_LONG_SIDES[currentModel]?.[label];
    if (ls) {
      infoEl.textContent = _approxDims(ls, aspect);
    } else {
      infoEl.textContent = '';
    }
  }
}

let currentModel = 'nb2';
let refs = [];
