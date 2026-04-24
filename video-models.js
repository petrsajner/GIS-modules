// ═══════════════════════════════════════════════════════
// VIDEO — model definitions, per-model API handlers, model UI switching
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// VIDEO — Kling video generation, gallery, lightbox
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// UNIFIED PANEL — UI flags defaults per model type (Session 2, v207en)
// Every video model's UI is described by flags declaring which controls to show.
// Per-entry `uiOverrides: {...}` merges on top of these type defaults.
//
// The unified panel (#vpParams) reads these flags via `_getVideoUi(modelKey)`
// to show/hide sections: resolution, aspect, CFG, duration, seed, audio,
// negative prompt, count, source slots, ref weights, advanced toggles etc.
//
// Flag semantics:
//   resolutions    — array of allowed values for <select id="vpResolution">; null = hidden
//   aspectRatios   — array of allowed values for <select id="vpAspect">; null = hidden
//   durationType   — 'slider' | 'select' | 'radio' | 'none'
//   showCfg, showSeed, showAudio, showCount, showNegPrompt — boolean controls in core params
//   modeSelect     — sub-select under model dropdown (null | 'klingVersion' | 'veoRefMode' | 'grokMode' | 'pixverseMode')
//   sourceSlot     — VIDEO_SOURCE_SLOTS key placed directly under refs (null | 'topaz' | 'wan27v' | 'wan27e' | 'v2v' | 'sd2Vid' | 'grok')
//   sourceAudio    — 3 audio URL inputs directly under source video (only Seedance 2.0)
//   refWeights     — 'luma3' = 3 progressive sliders shown per ref count; false = hidden
//   cameraMove     — 'pixverse_v4' = model camera move dropdown under prompt tags
//   advancedGroup  — 'topaz' | 'magnific' | null — keeps separate advanced section
//   supportsMultiClip, supportsMultiShots, supportsOffPeak — bottom toggle checkboxes
// ═══════════════════════════════════════════════════════
const VIDEO_UI_DEFAULTS = {
  // Default: full-featured video generator
  _base: {
    resolutions:      null,    aspectRatios: ['16:9','9:16','1:1'],
    showCfg:          false,   cfgMin: 0, cfgMax: 1, cfgDefault: 0.5, cfgStep: 0.05,
    durationType:     'slider', durationMin: 3, durationMax: 15, durationDefault: 5, durationOptions: null,
    showSeed:         false,   showNegPrompt: false, showCount: true, countMax: 4,
    showAudio:        false,
    modeSelect:       null,    sourceSlot: null, sourceAudio: false,
    refWeights:       false,   cameraMove: null, advancedGroup: null,
    supportsMultiClip: false,  supportsMultiShots: false, supportsOffPeak: false,
  },
  veo: {
    resolutions: ['720p','1080p'], aspectRatios: ['16:9','9:16'],
    durationType: 'select', durationOptions: [4,6,8], durationDefault: 8,
    showAudio: true, modeSelect: 'veoRefMode',
  },
  luma_video: {
    resolutions: ['540p','720p','1080p'], aspectRatios: ['16:9','9:16','1:1','4:3','3:4','21:9','9:21'],
    durationType: 'select', durationOptions: [5,9], durationDefault: 5,
    refWeights: 'luma3',
  },
  kling_video: {
    resolutions: ['720p','1080p'], aspectRatios: ['16:9','9:16','1:1'],
    durationType: 'select', durationOptions: [5,10], durationDefault: 5,
    showSeed: true, showAudio: true, modeSelect: 'klingVersion',
    showCfg: true, cfgMin: 0, cfgMax: 1, cfgDefault: 0.5,
  },
  seedance2_video: {
    resolutions: ['480p','720p','1080p'], aspectRatios: ['16:9','9:16','1:1','4:3','3:4','21:9','9:21'],
    durationType: 'select', durationOptions: [4,5,6,7,8,9,10,11,12], durationDefault: 5,
    showSeed: true, showAudio: true, showNegPrompt: false,
    modeSelect: 'klingVersion',  // group-based (std/fast × t2v/i2v/r2v)
    sourceAudio: true,           // 3× audio URL inputs under source video
  },
  seedance_video: {
    resolutions: ['480p','720p','1080p'], aspectRatios: ['16:9','9:16','1:1'],
    durationType: 'select', durationOptions: [5,10], durationDefault: 5,
    showSeed: true, showAudio: false, modeSelect: 'klingVersion',
  },
  vidu_video: {
    resolutions: ['360p','720p','1080p'], aspectRatios: ['16:9','9:16','1:1'],
    durationType: 'select', durationOptions: [4,8], durationDefault: 4,
    showSeed: true, modeSelect: 'klingVersion',
  },
  wan27_video: {
    resolutions: ['720p','1080p'], aspectRatios: ['16:9','9:16','1:1'],
    durationType: 'select', durationOptions: [5,8], durationDefault: 5,
    showSeed: true, showAudio: true, showNegPrompt: true,
    modeSelect: 'klingVersion',
  },
  wan26_video: {
    resolutions: ['480p','720p','1080p'], aspectRatios: ['16:9','9:16','1:1'],
    durationType: 'select', durationOptions: [5,10], durationDefault: 5,
    showSeed: true, showAudio: true, modeSelect: 'klingVersion',
    supportsMultiShots: true,
  },
  pixverse_video: {
    resolutions: ['540p','720p','1080p'], aspectRatios: ['16:9','9:16','1:1','4:3','3:4'],
    durationType: 'select', durationOptions: [5,8], durationDefault: 5,
    showSeed: true, showAudio: true, showNegPrompt: true,
    modeSelect: 'pixverseMode', cameraMove: 'pixverse_v4',
    supportsMultiClip: true, supportsOffPeak: true,
  },
  grok_video: {
    resolutions: ['720p','1080p'], aspectRatios: ['16:9','9:16'],
    durationType: 'select', durationOptions: [5,6,7,8,9,10], durationDefault: 6,
    showAudio: true, modeSelect: 'grokMode', sourceSlot: 'grok',
  },
  topaz_upscaler: {
    resolutions: null, aspectRatios: null, durationType: 'none',
    showCount: false, advancedGroup: 'topaz', sourceSlot: 'topaz',
  },
  magnific_video: {
    resolutions: null, aspectRatios: null, durationType: 'none',
    showCount: false, advancedGroup: 'magnific', sourceSlot: 'topaz',  // magnific reuses Topaz source slot UI
  },
};

// Merge type defaults + entry uiOverrides into final UI flags for a model.
// Entry-level fields (resolutions, aspectRatios, maxDur, minDur) override type defaults
// for legacy compatibility — these already exist on entries.
// Returns `null` if model not found.
function _getVideoUi(modelKey) {
  const m = VIDEO_MODELS[modelKey]
         || (typeof TOPAZ_MODELS !== 'undefined' && TOPAZ_MODELS[modelKey])
         || (typeof MAGNIFIC_VIDEO_MODELS !== 'undefined' && MAGNIFIC_VIDEO_MODELS[modelKey])
         || null;
  if (!m) return null;
  const ui = {
    ...VIDEO_UI_DEFAULTS._base,
    ...(VIDEO_UI_DEFAULTS[m.type] || {}),
    ...(m.uiOverrides || {}),
  };
  // Entry-level fields take precedence over type defaults (legacy)
  if (m.resolutions)  ui.resolutions  = m.resolutions;
  if (m.aspectRatios) ui.aspectRatios = m.aspectRatios;
  if (typeof m.maxDur === 'number') ui.durationMax = m.maxDur;
  if (typeof m.minDur === 'number') ui.durationMin = m.minDur;
  if (m.hasAudio === false) ui.showAudio = false;   // explicit disable
  return ui;
}

// ── Video model definitions ──────────────────────────────
const VIDEO_MODELS = {
  // refMode: 'none' | 'single' | 'single_end' | 'keyframe' | 'multi'
  // 'single'    = 1 start frame (start_image_url)
  // 'single_end'= start frame + optional end frame (start_image_url + end_image_url)
  // 'keyframe'  = start + end, both required (start_frame_image_url + end_frame_image_url)
  // 'multi'     = up to maxRefs element refs (elements[] array)

  // ── Google Veo — Gemini API (same key as NB2/Imagen, no proxy needed) ──
  // Pattern: POST :predictLongRunning → poll operations → download MP4 from URI
  // generateAudio: NOT sent — Gemini API Veo generates audio automatically, field unsupported
  // refModes: 'none' (T2V), 'single' (start frame I2V), 'single_end' (first+last frame), 'veo_ingredients' (up to 3 ref images)
  veo_31: {
    name: 'Veo 3.1', type: 'veo',
    modelId: 'veo-3.1-generate-preview',
    desc: 'T2V · I2V · Ingredients (3 refs) · First+Last frame · Audio · 8s · 720p/1080p/4K · Google',
    refMode: 'none', maxRefs: 0,
    hasAudio: false, maxDur: 8, durOptions: [8], defaultDur: 8,
    resolutions: ['720p', '1080p', '4k'],
    aspectRatios: ['16:9', '9:16'],
    veoRefModes: ['t2v', 'i2v', 'frames', 'ingredients'],
  },
  veo_31_fast: {
    name: 'Veo 3.1 Fast', type: 'veo',
    modelId: 'veo-3.1-fast-generate-preview',
    desc: 'T2V · I2V · Ingredients (3 refs) · First+Last frame · Audio · 4–8s · 720p/1080p/4K · Faster · Google',
    refMode: 'none', maxRefs: 0,
    hasAudio: false, maxDur: 8, durOptions: [4, 6, 8], defaultDur: 4,
    resolutions: ['720p', '1080p', '4k'],
    aspectRatios: ['16:9', '9:16'],
    veoRefModes: ['t2v', 'i2v', 'frames', 'ingredients'],
  },
  luma_ray2: {
    name: 'Ray2', type: 'luma_video',
    modelId: 'ray-2',
    desc: 'T2V · I2V · Keyframes · 720p–4K · $0.71/5s · Luma',
    refMode: 'single_end', maxRefs: 2,
    hasAudio: false, durOptions: [5, 9], defaultDur: 5,
    resolutions: ['540p', '720p', '1080p', '4k'],
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'],
    supportsHdr: false, supportsLoop: true, supportsCharRef: false, lumaKey: true,
  },
  luma_ray2_flash: {
    name: 'Ray2 Flash', type: 'luma_video',
    modelId: 'ray-flash-2',
    desc: 'T2V · I2V · Keyframes · 720p–4K · $0.24/5s · Fast · Luma',
    refMode: 'single_end', maxRefs: 2,
    hasAudio: false, durOptions: [5, 9], defaultDur: 5,
    resolutions: ['540p', '720p', '1080p', '4k'],
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'],
    supportsHdr: false, supportsLoop: true, supportsCharRef: false, lumaKey: true,
  },
  luma_ray314: {
    name: 'Ray3.14', type: 'luma_video',
    modelId: 'ray-3-14',
    desc: 'T2V · I2V · Keyframes · Native 1080p · 4× faster · 3× cheaper · No audio · Luma',
    supportsHdr: false,
    refMode: 'single_end', maxRefs: 2,
    hasAudio: false, durOptions: [5, 10], defaultDur: 5,
    resolutions: ['540p', '720p', '1080p', '4k'],
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'],
    supportsHdr: false,
    supportsLoop: true,
    supportsCharRef: false,
    lumaKey: true,
  },
  luma_ray3: {
    name: 'Ray3', type: 'luma_video',
    modelId: 'ray-3',
    desc: 'T2V · I2V · Keyframes · Character ref · No audio · Luma',
    refMode: 'single_end', maxRefs: 2,
    hasAudio: false, durOptions: [5, 10], defaultDur: 5,
    resolutions: ['540p', '720p', '1080p', '4k'],
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'],
    supportsHdr: false,
    supportsLoop: true,
    supportsCharRef: true,
    lumaKey: true,
  },
  luma_ray3_hdr: {
    name: 'Ray3 HDR', type: 'luma_video',
    modelId: 'ray-hdr-3',
    desc: 'T2V · I2V · Native 16-bit HDR · EXR export · Character ref · No audio · Luma',
    refMode: 'single_end', maxRefs: 2,
    hasAudio: false, durOptions: [5, 10], defaultDur: 5,
    resolutions: ['540p', '720p', '1080p'],
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'],
    supportsHdr: true, supportsLoop: true, supportsCharRef: true, lumaKey: true,
  },
  luma_ray314_hdr: {
    name: 'Ray3.14 HDR', type: 'luma_video',
    modelId: 'ray-hdr-3-14',
    desc: 'T2V · I2V · Native 16-bit HDR · EXR export · 4× faster · No audio · Luma',
    refMode: 'single_end', maxRefs: 2,
    hasAudio: false, durOptions: [5, 10], defaultDur: 5,
    resolutions: ['540p', '720p'],
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'],
    supportsHdr: true, supportsLoop: true, supportsCharRef: false, lumaKey: true,
  },
  kling_v3_t2v_std: {
    name: 'Kling V3 Standard T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/standard/text-to-video',
    desc: 'T2V · Native audio · Up to 15s · Fast iteration',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15,
    spendKey: '_kling_v3_std',
    spendKeyAudio: '_kling_v3_std_audio',
  },
  kling_v3_t2v_pro: {
    name: 'Kling V3 Pro T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/pro/text-to-video',
    desc: 'T2V · Native audio · Up to 15s · Highest quality',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15,
    spendKey: '_kling_v3_pro',
    spendKeyAudio: '_kling_v3_pro_audio',
  },
  kling_v3_i2v_std: {
    name: 'Kling V3 Standard I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/standard/image-to-video',
    desc: 'I2V · Start frame + optional end frame · Native audio · Up to 15s',
    refMode: 'single_end', maxRefs: 2,
    refLabel: 'Start frame (drag 2nd = end frame)',
    hasAudio: true, maxDur: 15,
    spendKey: '_kling_v3_std',
    spendKeyAudio: '_kling_v3_std_audio',
  },
  kling_v3_i2v_pro: {
    name: 'Kling V3 Pro I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/pro/image-to-video',
    desc: 'I2V · Start frame + optional end frame · Native audio · Up to 15s',
    refMode: 'single_end', maxRefs: 2,
    refLabel: 'Start frame (add 2nd = end frame)',
    hasAudio: true, maxDur: 15,
    spendKey: '_kling_v3_pro',
    spendKeyAudio: '_kling_v3_pro_audio',
  },
  kling_o3_t2v_std: {
    name: 'Kling O3 Standard T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o3/standard/text-to-video',
    desc: 'T2V · Native audio · Voice control · Up to 15s',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15,
    spendKey: '_kling_o3_std',
    spendKeyAudio: '_kling_o3_std_audio',
  },
  kling_o3_t2v_pro: {
    name: 'Kling O3 Pro T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o3/pro/text-to-video',
    desc: 'T2V · Native audio · Voice control · Up to 15s · Highest quality',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15,
    spendKey: '_kling_o3_pro',
    spendKeyAudio: '_kling_o3_pro_audio',
  },
  kling_o3_i2v_std: {
    name: 'Kling O3 Standard I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o3/standard/image-to-video',
    desc: 'I2V · Up to 7 element refs · Voice clone · Native audio · Up to 15s',
    refMode: 'multi', maxRefs: 7,
    refLabel: 'Element refs (up to 7) · use @Element1 in prompt',
    imageField: 'image_url',
    hasAudio: true, maxDur: 15,
    spendKey: '_kling_o3_std',
    spendKeyAudio: '_kling_o3_std_audio',
  },
  kling_o3_i2v_pro: {
    name: 'Kling O3 Pro I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o3/pro/image-to-video',
    desc: 'I2V · Up to 7 element refs · Voice clone · Native audio · Up to 15s',
    refMode: 'multi', maxRefs: 7,
    refLabel: 'Element refs (up to 7) · use @Element1 in prompt',
    imageField: 'image_url',
    hasAudio: true, maxDur: 15,
    spendKey: '_kling_o3_pro',
    spendKeyAudio: '_kling_o3_pro_audio',
  },
  kling_o1_kf: {
    name: 'Kling O1 Dual Keyframe', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o1/image-to-video',
    desc: 'Start + End frame interpolation · 5s or 10s',
    refMode: 'keyframe', maxRefs: 2,
    refLabel: 'Start frame + End frame (both required)',
    hasAudio: false, maxDur: 10,
    spendKey: '_kling_o1',
  },
  kling_26_i2v_pro: {
    name: 'Kling 2.6 Pro I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    desc: 'I2V · Start frame · Native audio · Economy · $0.070/s',
    refMode: 'single', maxRefs: 1,
    refLabel: 'Start frame',
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
    spendKey: '_kling_26',
    spendKeyAudio: '_kling_26_audio',
  },

  // ── V2V / Motion Control (V3 + V2.6) ─────────────────────
  // refMode: 'video_ref' — requires video file upload as motion reference
  // Optional: character image ref (1st image ref)
  kling_v3_v2v_std: {
    name: 'Kling V3 Std · Motion Control', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/standard/motion-control',
    desc: 'V2V · Upload action video for motion + character image (both required)',
    refMode: 'video_ref', maxRefs: 1,
    refLabel: 'Character image (required)',
    hasAudio: false, maxDur: 10,
    spendKey: '_kling_mc',
    uiOverrides: { sourceSlot: 'v2v' },
  },
  kling_v3_v2v_pro: {
    name: 'Kling V3 Pro · Motion Control', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/pro/motion-control',
    desc: 'V2V · Upload action video for motion + character image (both required) · Pro quality',
    refMode: 'video_ref', maxRefs: 1,
    refLabel: 'Character image (required)',
    hasAudio: false, maxDur: 10,
    spendKey: '_kling_mc',
    uiOverrides: { sourceSlot: 'v2v' },
  },
  kling_26_v2v_pro: {
    name: 'Kling 2.6 Pro · Motion Control', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.6/pro/motion-control',
    desc: 'V2V · Upload action video for motion + character image (both required)',
    refMode: 'video_ref', maxRefs: 1,
    refLabel: 'Character image (required)',
    hasAudio: false, maxDur: 10,
    spendKey: '_kling_26',
    uiOverrides: { sourceSlot: 'v2v' },
  },

  // ── Older models — economy options ───────────────────────
  kling_25t_t2v: {
    name: 'Kling 2.1 Master T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.1/master/text-to-video',
    desc: 'T2V · Top-tier 2.1 · Cinematic visuals · 5s or 10s',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
    spendKey: '_kling_25t',
  },
  kling_25t_i2v: {
    name: 'Kling 2.1 Master I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.1/master/image-to-video',
    desc: 'I2V · Start frame · Top-tier 2.1 · Cinematic visuals · 5s or 10s',
    refMode: 'single', maxRefs: 1,
    refLabel: 'Start frame',
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
    imageField: 'image_url',
    spendKey: '_kling_25t',
  },
  kling_21_t2v: {
    name: 'Kling 2.1 Standard T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.1/standard/text-to-video',
    desc: 'T2V · Exceptional Value & Efficiency · 5s or 10s',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
    spendKey: '_kling_21_std',
  },
  kling_21_i2v: {
    name: 'Kling 2.1 Standard I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.1/standard/image-to-video',
    desc: 'I2V · Start frame · Exceptional Value & Efficiency · 5s or 10s',
    refMode: 'single', maxRefs: 1,
    refLabel: 'Start frame',
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
    imageField: 'image_url',
    spendKey: '_kling_21_std',
  },
  kling_16_t2v: {
    name: 'Kling 1.6 T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v1.6/standard/text-to-video',
    desc: 'T2V · Economy · 5s or 10s',
    refMode: 'none', maxRefs: 0,
    hasAudio: false, maxDur: 10, durOptions: [5, 10],
    spendKey: '_kling_16',
  },
  kling_16_i2v: {
    name: 'Kling 1.6 I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v1.6/pro/image-to-video',
    desc: 'I2V · Start frame · Economy · 5s or 10s',
    refMode: 'single', maxRefs: 1,
    refLabel: 'Start frame',
    hasAudio: false, maxDur: 10, durOptions: [5, 10],
    imageField: 'image_url',
    spendKey: '_kling_16',
  },

  // ── Seedance 1.5 Pro — ByteDance via fal.ai ──────────────
  // Native audio+video joint generation · max 720p · max 12s
  // I2V uses image_url (start) + end_image_url (optional end)
  seedance15_t2v: {
    name: 'Seedance 1.5 Pro', type: 'seedance_video',
    endpoint: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 12, minDur: 4, hasAudio: true,
    resolution: '720p',
    desc: 'T2V · Native audio · Up to 12s · $0.26/5s · ByteDance',
    spendKey: '_seedance15',
  },
  seedance15_i2v: {
    name: 'Seedance 1.5 Pro', type: 'seedance_video',
    endpoint: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
    refMode: 'single_end', maxRefs: 2, maxDur: 12, minDur: 4, hasAudio: true,
    resolution: '720p',
    imageField: 'image_url',        // Seedance: image_url (not start_image_url)
    audioField: 'generate_audio',
    refLabel: 'Keyframes',
    desc: 'I2V · Start + End frame · Native audio · Up to 12s · $0.26/5s · ByteDance',
    spendKey: '_seedance15',
  },

  // ── Seedance 2.0 — ByteDance via fal.ai ─────────────────
  // Unified multimodal architecture: text + image + video + audio inputs
  // Multi-shot via prompt: [lens switch], timeline [0-3s]..., or "Shot 1: ... Shot 2: ..."
  // R2V refs in prompt: [Image1], [Video1], [Audio1]
  // generate_audio: always explicit (default ON = unexpected cost)
  // duration: STRING ("4"–"15" or "auto"), resolution: "480p"|"720p"|"1080p"
  // 1080p: only STANDARD endpoints (not Fast). Added on fal 21.4.2026.
  // Pricing per token formula: tokens = (w × h × 24) / 1024, std $0.014/1k, fast $0.0112/1k
  //   Standard 1080p ≈ $0.6804/s, 720p = $0.3034/s, 480p ≈ $0.1405/s
  //   Fast 720p = $0.2419/s, 480p ≈ $0.1124/s (no 1080p)
  //   R2V with video refs: × 0.6 multiplier (fal docs)
  seedance2_t2v: {
    name: 'Seedance 2.0', type: 'seedance2_video',
    endpoint: 'bytedance/seedance-2.0/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 15, minDur: 4, hasAudio: true,
    resolutions: ['480p', '720p', '1080p'], imageField: 'image_url',
    desc: 'T2V · Multi-shot · Native audio · Up to 15s · 1080p · ByteDance',
  },
  seedance2_i2v: {
    name: 'Seedance 2.0', type: 'seedance2_video',
    endpoint: 'bytedance/seedance-2.0/image-to-video',
    refMode: 'single_end', maxRefs: 2, maxDur: 15, minDur: 4, hasAudio: true,
    resolutions: ['480p', '720p', '1080p'], imageField: 'image_url',
    refLabel: 'Keyframes',
    desc: 'I2V · Start + End frame · Native audio · Up to 15s · 1080p',
  },
  seedance2_r2v: {
    name: 'Seedance 2.0', type: 'seedance2_video',
    endpoint: 'bytedance/seedance-2.0/reference-to-video',
    refMode: 'seedance2_r2v', maxRefs: 9, maxDur: 15, minDur: 4, hasAudio: true,
    resolutions: ['480p', '720p', '1080p'], imageField: 'image_url',
    refLabel: 'Image refs (up to 9)',
    desc: 'R2V · 9 imgs + 3 videos + 3 audio · 1080p · Video edit/extend (video refs 0.6×)',
    uiOverrides: { sourceSlot: 'sd2Vid' },
  },
  seedance2f_t2v: {
    name: 'Seedance 2.0 Fast', type: 'seedance2_video',
    endpoint: 'bytedance/seedance-2.0/fast/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 15, minDur: 4, hasAudio: true,
    resolutions: ['480p', '720p'], imageField: 'image_url',
    desc: 'T2V Fast · Multi-shot · Lower latency · $0.24/s',
  },
  seedance2f_i2v: {
    name: 'Seedance 2.0 Fast', type: 'seedance2_video',
    endpoint: 'bytedance/seedance-2.0/fast/image-to-video',
    refMode: 'single_end', maxRefs: 2, maxDur: 15, minDur: 4, hasAudio: true,
    resolutions: ['480p', '720p'], imageField: 'image_url',
    refLabel: 'Keyframes',
    desc: 'I2V Fast · Start + End frame · $0.24/s',
  },
  seedance2f_r2v: {
    name: 'Seedance 2.0 Fast', type: 'seedance2_video',
    endpoint: 'bytedance/seedance-2.0/fast/reference-to-video',
    refMode: 'seedance2_r2v', maxRefs: 9, maxDur: 15, minDur: 4, hasAudio: true,
    resolutions: ['480p', '720p'], imageField: 'image_url',
    refLabel: 'Image refs (up to 9)',
    desc: 'R2V Fast · 9 imgs + 3 videos + 3 audio · Video refs 0.6× · $0.18/s',
    uiOverrides: { sourceSlot: 'sd2Vid' },
  },

  // ── Vidu Q3 — Shengshu via fal.ai ───────────────────────
  // duration: INTEGER (not string!) · audio field: 'audio' (not generate_audio)
  // I2V: image_url (start) + optional end_image_url → same endpoint
  vidu_q3_t2v: {
    name: 'Vidu Q3', type: 'vidu_video',
    endpoint: 'fal-ai/vidu/q3/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 16, hasAudio: true,
    resolution: '720p',
    audioField: 'audio',
    durationInt: true,
    desc: 'T2V · Native audio · Up to 16s · $0.154/s (720p) · Shengshu',
    spendKey: '_vidu_q3',
  },
  vidu_q3_i2v: {
    name: 'Vidu Q3', type: 'vidu_video',
    endpoint: 'fal-ai/vidu/q3/image-to-video',
    refMode: 'single', maxRefs: 1, maxDur: 16, hasAudio: true,
    resolution: '720p',
    imageField: 'image_url',
    audioField: 'audio',
    durationInt: true,
    refLabel: 'Start frame',
    desc: 'I2V · Start frame · Native audio · Up to 16s · $0.154/s (720p) · Shengshu',
    spendKey: '_vidu_q3',
  },
  vidu_q3_frames: {
    name: 'Vidu Q3', type: 'vidu_video',
    endpoint: 'fal-ai/vidu/q3/image-to-video',
    refMode: 'single_end', maxRefs: 2, maxDur: 16, hasAudio: true,
    resolution: '720p',
    imageField: 'image_url',
    audioField: 'audio',
    durationInt: true,
    refLabel: 'Keyframes',
    desc: 'Start + End frame · Native audio · Up to 16s · $0.154/s (720p) · Shengshu',
    spendKey: '_vidu_q3',
  },

  // ── Wan 2.6 — Alibaba via fal.ai ────────────────────────
  // duration: string "5"/"10"/"15" · fixed options · audio field: 'audio'
  // multi_shots: boolean — false = single continuous shot (default true = multi-shot)
  // ── Wan 2.7 I2V — přes Replicate API (CORS-blocked → proxy) ─────────────────
  // Replicate model: wan-video/wan-2.7-i2v
  // first_frame = start (required), last_frame = end (optional, FLF2V mode)
  // Output: single URL string (not array)
  // Audio: auto-generated if no audio URI provided
  // ── WAN 2.7 — fal.ai (direct queue, no proxy) ────────────
  wan27_t2v: {
    name: 'Wan 2.7', type: 'wan27_video',
    falEndpoint: 'fal-ai/wan/v2.7/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 15, hasAudio: false,
    desc: 'T2V · Enhanced motion + coherence · Up to 15s · Audio URL · Alibaba via fal.ai',
  },
  wan27_i2v: {
    name: 'Wan 2.7', type: 'wan27_video',
    falEndpoint: 'fal-ai/wan/v2.7/image-to-video',
    refMode: 'single_end', maxRefs: 2, maxDur: 15, hasAudio: false,
    refLabel: 'Start frame',
    refLabelEnd: 'End frame (optional · FLF2V)',
    desc: 'I2V · Start + optional end frame (FLF2V) · Extend video · Up to 15s · Alibaba via fal.ai',
  },
  wan27_r2v: {
    name: 'Wan 2.7 R2V', type: 'wan27_video',
    falEndpoint: 'fal-ai/wan/v2.7/reference-to-video',
    refMode: 'wan_r2v', maxRefs: 5, maxDur: 10, hasAudio: false,
    refLabel: 'Character refs (image or video)',
    desc: 'R2V · Character consistency · Image/video refs · Up to 10s · Alibaba via fal.ai',
    uiOverrides: { sourceSlot: 'wan27v' },
  },
  wan27e_v2v: {
    name: 'Wan 2.7 Video Edit', type: 'wan27e_video',
    falEndpoint: 'fal-ai/wan/v2.7/edit-video',
    refMode: 'single', maxRefs: 1, maxDur: 10, hasAudio: false,
    refLabel: 'Reference image (optional)',
    desc: 'V2V · Instruction edit · Style transfer · Any source video · Optional ref image · Up to 10s · fal.ai',
    uiOverrides: { sourceSlot: 'wan27e' },
  },

  wan26_t2v: {
    name: 'Wan 2.6', type: 'wan_video',
    endpoint: 'wan/v2.6/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 15, hasAudio: false,
    durOptions: [5, 10, 15],
    desc: 'T2V · Multi-shot · Audio always on · Up to 15s · $0.10/s (720p) · Alibaba',
    spendKey: () => getUnifiedResolution() === '1080p' ? '_wan26_1080p' : '_wan26_720p',
  },
  wan26_t2v_single: {
    name: 'Wan 2.6', type: 'wan_video',
    endpoint: 'wan/v2.6/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 15, hasAudio: false,
    multiShots: false,
    durOptions: [5, 10, 15],
    desc: 'T2V · Single shot · Audio always on · Up to 15s · $0.10/s (720p) · Alibaba',
    spendKey: () => getUnifiedResolution() === '1080p' ? '_wan26_1080p' : '_wan26_720p',
  },
  wan26_i2v: {
    name: 'Wan 2.6', type: 'wan_video',
    endpoint: 'wan/v2.6/image-to-video',
    refMode: 'single', maxRefs: 1, maxDur: 15, hasAudio: false,
    imageField: 'image_url',
    durOptions: [5, 10, 15],
    refLabel: 'Start frame',
    desc: 'I2V · Start frame · Multi-shot · Audio always on · Up to 15s · $0.10/s (720p) · Alibaba',
    spendKey: () => getUnifiedResolution() === '1080p' ? '_wan26_1080p' : '_wan26_720p',
  },

  // ── Wan 2.6 R2V Flash — character consistency via image refs ─
  // Flash accepts image_urls[] (0-5 images) + video_urls[] (0-3 videos), total ≤ 5
  // References: Character1, Character2... in prompt (NOT @Video1)
  // audio field: enable_audio (all Wan 2.6 models use enable_audio)
  // Duration: max 10s (no 15s support)
  wan26_r2v_flash: {
    name: 'Wan 2.6 R2V Flash', type: 'wan_video',
    endpoint: 'wan/v2.6/reference-to-video/flash',
    refMode: 'wan_r2v', maxRefs: 5, maxDur: 10, hasAudio: true,
    audioField: 'enable_audio',
    durOptions: [5, 10],
    refLabel: 'Character refs (image or video)',
    desc: 'R2V Flash · Character consistency · 1-5 refs · Up to 10s · $0.05/s · Alibaba',
    spendKey: () => getUnifiedResolution() === '1080p' ? '_wan26_1080p' : '_wan26_720p',
  },
  // ── PixVerse C1 — via proxy (async submit → poll → download) ──
  // Camera movements: disabled for C1 (v4/v4.5 only)
  // Duration: 1–15s continuous (1080p max 5s)
  // generate_multi_clip_switch: NOT supported for C1 T2V/I2V (400017), inverted for Transition
  // generate_audio_switch: must be explicit
  // off_peak_mode: slower, ~50% cheaper
  pixverse_c1_t2v: {
    name: 'PixVerse C1 T2V', type: 'pixverse_video', modelId: 'c1',
    desc: 'T2V · Audio · 1–15s · 1080p · Action &amp; combat · PixVerse',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15, minDur: 1,
    qualityOptions: ['360p', '540p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    pixverseKey: true,
  },
  pixverse_c1_i2v: {
    name: 'PixVerse C1 I2V', type: 'pixverse_video', modelId: 'c1',
    desc: 'I2V · Audio · 1–15s · 1080p · Start frame → video · PixVerse',
    refMode: 'single', maxRefs: 1,
    hasAudio: true, maxDur: 15, minDur: 1,
    qualityOptions: ['360p', '540p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    pixverseKey: true,
  },
  pixverse_c1_transition: {
    name: 'PixVerse C1 Transition', type: 'pixverse_video', modelId: 'c1', pixverseMode: 'transition',
    desc: 'First + Last frame · Audio · 1–15s · Smooth morph · PixVerse',
    refMode: 'keyframe', maxRefs: 2,
    hasAudio: true, maxDur: 15, minDur: 1, supportsMultiClip: true,
    qualityOptions: ['360p', '540p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    pixverseKey: true,
  },
  pixverse_c1_fusion: {
    name: 'PixVerse C1 Fusion', type: 'pixverse_video', modelId: 'c1', pixverseMode: 'fusion',
    desc: 'Reference images (1–7) → Video · Use @name in prompt · PixVerse',
    refMode: 'multi', maxRefs: 7,
    hasAudio: true, maxDur: 15, minDur: 1,
    qualityOptions: ['360p', '540p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '2:3', '3:2', '21:9'],
    pixverseKey: true,
  },
  // ── PixVerse V6 — multi-clip supported ──
  pixverse_v6_t2v: {
    name: 'PixVerse V6 T2V', type: 'pixverse_video', modelId: 'v6',
    desc: 'T2V · Audio · Multi-clip · 1–15s · 1080p · PixVerse',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15, minDur: 1, supportsMultiClip: true,
    qualityOptions: ['360p', '540p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    pixverseKey: true,
  },
  pixverse_v6_i2v: {
    name: 'PixVerse V6 I2V', type: 'pixverse_video', modelId: 'v6',
    desc: 'I2V · Audio · Multi-clip · 1–15s · 1080p · PixVerse',
    refMode: 'single', maxRefs: 1,
    hasAudio: true, maxDur: 15, minDur: 1, supportsMultiClip: true,
    qualityOptions: ['360p', '540p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    pixverseKey: true,
  },
  pixverse_v6_transition: {
    name: 'PixVerse V6 Transition', type: 'pixverse_video', modelId: 'v6', pixverseMode: 'transition',
    desc: 'First + Last frame · Audio · Multi-clip · 1–15s · PixVerse',
    refMode: 'keyframe', maxRefs: 2,
    hasAudio: true, maxDur: 15, minDur: 1, supportsMultiClip: true,
    qualityOptions: ['360p', '540p', '720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    pixverseKey: true,
  },

  // ── xAI Grok Imagine Video ─────────────────────────────
  // One model, 5 modes via grokVideoMode selector:
  //   t2v     = Text-to-Video (prompt only)
  //   i2v     = Image-to-Video (1 start frame)
  //   ref2v   = Reference-to-Video (1–7 ref images, NOT start frame)
  //   edit    = V2V Edit (video_url, max 8.7s input)
  //   extend  = Video Extend (video_url, adds 2–10s)
  // Async: submit → poll request_id → download temporary URL
  // Native audio generation (automatic, no toggle)
  grok_video: {
    name: 'Grok Imagine Video', type: 'grok_video',
    modelId: 'grok-imagine-video',
    desc: 'T2V · I2V · 7-Ref · V2V Edit · Extend · Audio · 1–15s · 720p · xAI · $0.05/s',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15, minDur: 1, defaultDur: 8,
    durOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
    resolutions: ['480p', '720p'],
    grokVideoModes: ['t2v', 'i2v', 'ref2v', 'edit', 'extend'],
    xaiKey: true,
  },
};

// ── Per-family info text (shown below model description, above parameters) ──
// v220en: info text was previously hardcoded inside each per-family psec
// container (e.g. "C1 · 1–15s · 1080p..." inside pixverseParams).  That made
// it sit UNDER "PARAMETERS" where it didn't belong — this is metadata about
// the model itself, not a parameter.  Now it's data, rendered in #videoModelInfo
// directly below #videoModelDesc.  Only families with useful capability info
// have entries; others leave the info line hidden.
const VIDEO_MODEL_FAMILY_INFO = {
  'pixverse_video':  'PixVerse C1 · 1–15s · up to 1080p · Native audio · 20+ camera moves · from $0.05/s',
  'seedance2_video': 'Seedance 2.0 · 4–15s · 480p/720p/1080p · Native audio · $0.30/s std · $0.24/s fast · ByteDance',
};

// ── Per-family prompt placeholder ──────────────────────────
// v220en: Seedance had a "Dialogue / Multi-shot" hint box inside seedance2Params
// and a longer "Multi-shot & Camera Control" guide at the bottom.  Both were
// reference-type info that belongs in the empty prompt (same spirit as the
// default "Describe the scene, camera movement, lighting…" placeholder that
// vanishes when the user starts typing).  Now it's data; placeholder is swapped
// per-model in _applyVideoModel.  Fallback is the default placeholder defined
// in template.html.
const VIDEO_DEFAULT_PROMPT_PLACEHOLDER = 'Describe the scene, camera movement, lighting…';
const VIDEO_MODEL_PROMPT_PLACEHOLDER = {
  'seedance2_video':
    'Describe the scene, camera movement, lighting…\n\n' +
    '💡 Dialogue: wrap spoken lines in "double quotes" for lip-synced audio\n' +
    '💡 Multi-shot: Shot 1: … Shot 2: … (or [lens switch]) for camera cuts\n' +
    '💡 Timeline: [0-3s] wide shot… [4-7s] close-up…\n' +
    '💡 Camera: dolly zoom, tracking shot, Dutch angle, crane up, worm\'s eye',
};

// ── Per-family duration slider config (v221en) ─────────────
// Unified Duration slider (`videoDurRow`) reads config from this map by
// model.type and sets min/max/step/default, optional snap-to-allowed
// (for Grok's discrete [3,5,8,10,12,15]), and shows/hides Auto
// (Seedance 2.0) or Match-source (WAN 2.7e) checkboxes.
//
// Legacy per-family inputs (#lumaDuration radios, #wan27vDuration select,
// #wan27eDuration select with "Auto (match source)", #sd2Duration range
// with Auto checkbox, #grokVideoDur select) are kept hidden in the DOM
// so existing generate/reuse code reading them keeps working.  The
// unified slider mirrors its value into the active legacy input on every
// change; _applyVideoModel mirrors legacy value → unified slider on model
// switch (so "Reuse job" continues to work).
// ── Per-family resolution config (v223en) ──────────────────
// Unified Resolution switcher (`unifiedResRow`) reads config from this map
// by model.type.  Each entry declares:
//   legacyId    : ID of the hidden <select>/<input> that actual generate/reuse
//                 code reads.  Click on a segmented button mirrors value here
//                 and dispatches 'change' so existing onchange handlers fire.
//   resolutions : array of option values (for static models).  For models
//                 where resolutions depend on variant (e.g. PixVerse qualityOptions,
//                 Seedance 2.0 Fast tier has no 1080p), configureResolutionSwitcher
//                 reads from the active model's own field.
//   labels      : optional {value: "short label"} overrides for button text
//                 (default is just the raw value like "720p" or "4K").
//
// v225en: Legacy per-family Resolution <select> elements removed from DOM.
// Unified `#unifiedResButtons` is the single source of truth; generate/reuse
// read/write via getUnifiedResolution/setUnifiedResolution helpers.
const RESOLUTION_CONFIG_BY_TYPE = {
  'veo': {
    resolutions: ['720p', '1080p', '4k'],
    labels:      { '720p': '720p', '1080p': '1080p', '4k': '4K' },
  },
  'luma_video': {
    resolutions: ['540p', '720p', '1080p', '4k'],
    labels:      { '540p': '540p', '720p': '720p', '1080p': '1080p', '4k': '4K' },
  },
  'wan_video': {
    resolutions: ['720p', '1080p'],
  },
  'wan27_video': {
    resolutions: ['720p', '1080p'],
  },
  'wan27e_video': {
    resolutions: ['720p', '1080p'],
  },
  'pixverse_video': {
    // resolutions read from m.qualityOptions at configure time
    resolutions: null,
    labels:      { '360p': '360p', '540p': '540p', '720p': '720p', '1080p': '1080p' },
  },
  'seedance2_video': {
    // resolutions read from m.resolutions at configure time (Fast tier has no 1080p)
    resolutions: null,
  },
  'grok_video': {
    resolutions: ['480p', '720p'],
  },
  // kling_video / vidu_video / seedance_video: no user-chosen Resolution
  // (fixed per-variant).  Info line shown only ("720p · T2V · Kling Pro").
};

// Resolution → base height map (for computing WIDTH×HEIGHT info).
const _RESOLUTION_HEIGHTS = {
  '240p': 240, '360p': 360, '480p': 480, '540p': 540,
  '720p': 720, '1080p': 1080, '4k': 2160, '2k': 1440,
};

// Aspect ratio → [width, height] unit pair for WxH computation.
const _ASPECT_RATIOS = {
  '16:9': [16, 9], '9:16': [9, 16],
  '4:3':  [4, 3],  '3:4':  [3, 4],
  '1:1':  [1, 1],
  '21:9': [21, 9], '9:21': [9, 21],
  '3:2':  [3, 2],  '2:3':  [2, 3],
  '5:4':  [5, 4],  '4:5':  [4, 5],
};

function computeVideoDimensions(resolution, aspectRatio) {
  const h = _RESOLUTION_HEIGHTS[resolution] || parseInt(resolution) || 720;
  const [aw, ah] = _ASPECT_RATIOS[aspectRatio] || [16, 9];
  // Width = height * (aw/ah), rounded to a multiple of 8 (typical API constraint).
  const w = Math.round((h * aw / ah) / 8) * 8;
  return { width: w, height: h };
}

const DURATION_CONFIG_BY_TYPE = {
  'kling_video':     { min: 3,  max: 15, step: 1, default: 5 },
  'veo':             { min: 4,  max: 8,  step: 1, default: 8 },
  'luma_video':      { min: 5,  max: 10, step: 5, default: 5 },
  'wan_video':       { min: 5,  max: 10, step: 5, default: 5 },
  'wan27_video':     { min: 2,  max: 15, step: 1, default: 5 },
  'wan27e_video':    { min: 2,  max: 10, step: 1, default: 5, matchSource: true },
  'pixverse_video':  { min: 1,  max: 15, step: 1, default: 8 },
  'seedance_video':  { min: 5,  max: 10, step: 5, default: 5 },
  'seedance2_video': { min: 4,  max: 15, step: 1, default: 5, autoCheckbox: true },
  'grok_video':      { min: 3,  max: 15, step: 1, default: 8, allowed: [3, 5, 8, 10, 12, 15] },
  'vidu_video':      { min: 4,  max: 8,  step: 4, default: 4 },
};

// ── Kling model groups (main key → variants list) ────────
// Group keys are NOT in VIDEO_MODELS — used only for main selector dispatch
const KLING_GROUPS = {
  kling_v3: {
    default: 'kling_v3_t2v_pro',
    variants: [
      { key: 'kling_v3_t2v_std', label: 'Standard · T2V · $0.168/s' },
      { key: 'kling_v3_t2v_pro', label: 'Pro · T2V · $0.224/s' },
      { key: 'kling_v3_i2v_std', label: 'Standard · I2V · $0.196/s' },
      { key: 'kling_v3_i2v_pro', label: 'Pro · I2V · $0.280/s' },
      { key: 'kling_v3_v2v_std', label: 'Standard · Motion Control (V2V)' },
      { key: 'kling_v3_v2v_pro', label: 'Pro · Motion Control (V2V)' },
    ],
  },
  kling_o3: {
    default: 'kling_o3_t2v_pro',
    variants: [
      { key: 'kling_o3_t2v_std', label: 'Standard · T2V · $0.224/s' },
      { key: 'kling_o3_t2v_pro', label: 'Pro · T2V · $0.392/s' },
      { key: 'kling_o3_i2v_std', label: 'Standard · I2V · 7 refs · $0.280/s' },
      { key: 'kling_o3_i2v_pro', label: 'Pro · I2V · 7 refs · $0.392/s' },
    ],
  },
  kling_o1: {
    default: 'kling_o1_kf',
    variants: [
      { key: 'kling_o1_kf', label: 'Dual Keyframe · $0.112/s' },
    ],
  },
  kling_26: {
    default: 'kling_26_i2v_pro',
    variants: [
      { key: 'kling_26_i2v_pro', label: 'Pro · I2V · $0.070/s' },
      { key: 'kling_26_v2v_pro', label: 'Pro · Motion Control (V2V)' },
    ],
  },
  kling_25t: {
    default: 'kling_25t_t2v',
    variants: [
      { key: 'kling_25t_t2v', label: 'T2V' },
      { key: 'kling_25t_i2v', label: 'I2V' },
    ],
  },
  kling_21: {
    default: 'kling_21_t2v',
    variants: [
      { key: 'kling_21_t2v', label: 'Standard · T2V' },
      { key: 'kling_21_i2v', label: 'Standard · I2V' },
    ],
  },
  kling_16: {
    default: 'kling_16_t2v',
    variants: [
      { key: 'kling_16_t2v', label: 'T2V' },
      { key: 'kling_16_i2v', label: 'I2V' },
    ],
  },
  seedance15: {
    default: 'seedance15_t2v',
    variants: [
      { key: 'seedance15_t2v', label: 'T2V · Text to Video · $0.26/5s' },
      { key: 'seedance15_i2v', label: 'I2V · Start + End frame · $0.26/5s' },
    ],
  },
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
  vidu_q3: {
    default: 'vidu_q3_t2v',
    variants: [
      { key: 'vidu_q3_t2v',    label: 'T2V · Text to Video · $0.154/s' },
      { key: 'vidu_q3_i2v',    label: 'I2V · Start frame · $0.154/s' },
      { key: 'vidu_q3_frames', label: 'Start + End frame · $0.154/s' },
    ],
  },
  wan27: {
    default: 'wan27_i2v',
    variants: [
      { key: 'wan27_t2v',  label: 'T2V · Text to Video' },
      { key: 'wan27_i2v',  label: 'I2V · Start frame · Optional end (FLF2V) · Extend' },
      { key: 'wan27_r2v',  label: 'R2V · Character refs · Image/video' },
      { key: 'wan27e_v2v', label: 'Video Edit · Instruction / Style transfer' },
    ],
  },
  wan26: {
    default: 'wan26_t2v',
    variants: [
      { key: 'wan26_t2v',        label: 'T2V · Multi-shot · $0.10/s (720p)' },
      { key: 'wan26_t2v_single', label: 'T2V · Single shot · $0.10/s (720p)' },
      { key: 'wan26_i2v',        label: 'I2V · Start frame · $0.10/s (720p)' },
      { key: 'wan26_r2v_flash',  label: 'R2V Flash · Character refs · $0.05/s' },
    ],
  },
  pixverse_c1: {
    default: 'pixverse_c1_t2v',
    variants: [
      { key: 'pixverse_c1_t2v',        label: 'T2V · Text to Video' },
      { key: 'pixverse_c1_i2v',        label: 'I2V · Start frame → Video' },
      { key: 'pixverse_c1_transition', label: 'Transition · First + Last frame' },
      { key: 'pixverse_c1_fusion',     label: 'Fusion · Reference images (1-7)' },
    ],
  },
  pixverse_v6: {
    default: 'pixverse_v6_t2v',
    variants: [
      { key: 'pixverse_v6_t2v',        label: 'T2V · Multi-clip support' },
      { key: 'pixverse_v6_i2v',        label: 'I2V · Multi-clip support' },
      { key: 'pixverse_v6_transition', label: 'Transition · First + Last frame' },
    ],
  },
};

// ── Topaz model definitions ─────────────────────────────
const TOPAZ_MODELS = {
  topaz_precise25: {
    name:        'Topaz Precise 2.5',
    type:        'topaz_video',
    apiModel:    'slp-2.5',
    desc:        'Best for AI-generated video. Reduces plastic artifacts, enhances faces, materials and text. Output: 1080p or 4K.',
    resolutions: ['1080p', '4k'],
    hasFactor:   false,
    maxSlowmo:   16,
  },
  topaz_precise2: {
    name:        'Topaz Precise 2',
    type:        'topaz_video',
    apiModel:    'slp-2',
    desc:        'Balanced quality/cost. Supports scale factors 1×–4× or fixed 1080p/4K.',
    resolutions: ['1080p', '4k'],
    hasFactor:   true,
    maxSlowmo:   16,
  },
  topaz_precise1: {
    name:        'Topaz Precise 1',
    type:        'topaz_video',
    apiModel:    'slp-1',
    desc:        'Original Starlight model. Highest detail but slower and more expensive. Output: 1080p or 4K.',
    resolutions: ['1080p', '4k'],
    hasFactor:   false,
    maxSlowmo:   16,
  },
  topaz_hq: {
    name:        'Topaz Starlight HQ',
    type:        'topaz_video',
    apiModel:    'slhq',
    desc:        'High-quality diffusion upscaler. Natural detail, strong face restoration. Output: 1080p or 4K.',
    resolutions: ['1080p', '4k'],
    hasFactor:   false,
    maxSlowmo:   16,
  },
  topaz_mini: {
    name:        'Topaz Starlight Mini',
    type:        'topaz_video',
    apiModel:    'slm',
    desc:        'Efficient local-class model. Fast, good for archival and motion-heavy footage. Output: 1080p or 4K.',
    resolutions: ['1080p', '4k'],
    hasFactor:   false,
    maxSlowmo:   16,
  },
};

const TOPAZ_GROUPS = {
  topaz: {
    default:  'topaz_precise25',
    variants: [
      { key: 'topaz_precise25', label: 'Precise 2.5 · GenAI video · best quality' },
      { key: 'topaz_precise2',  label: 'Precise 2 · 1×–4× upscale · balanced' },
      { key: 'topaz_precise1',  label: 'Precise 1 · highest detail · slower' },
      { key: 'topaz_hq',        label: 'Starlight HQ · natural detail · faces' },
      { key: 'topaz_mini',      label: 'Starlight Mini · fast · archival' },
    ],
  },
};

// ── Magnific Video Upscaler models ───────────────────────
const MAGNIFIC_VIDEO_MODELS = {
  magnific_vid_creative: {
    name:  'Magnific Creative',
    mode:  'creative',
    desc:  'Prompt-guided video upscaling with creativity controls. Add detail and stylize via prompt. Output: 1K/2K/4K.',
  },
  magnific_vid_precision: {
    name:  'Magnific Precision',
    mode:  'precision',
    desc:  'Faithful upscaling — no AI-generated content added. Blend original with upscaled via strength. Output: 1K/2K/4K.',
  },
};

// ═══════════════════════════════════════════════════════
// Unified Video Panel — UI flags per model (Session 2)
// ═══════════════════════════════════════════════════════
// Central source of truth for "which UI controls does THIS model need".
// Read from `_applyVideoModel` to show/hide sections in the unified panel
// (analogous to how image models use inline ui flags).
//
// Rather than injecting a per-entry `ui: {...}` into every one of ~60
// VIDEO_MODELS / KLING_GROUPS / TOPAZ_MODELS / MAGNIFIC_VIDEO_MODELS entries
// (which would be massively duplicated across variants), we derive UI flags
// from type + model key patterns, with family-level defaults and
// variant-level overrides. This is the same strategy as `_getVideoSpendKey`
// from v206en #2.
//
// Returns a FROZEN object with all UI flags set. Consumer can safely
// destructure and use any flag without existence-checking.
// ═══════════════════════════════════════════════════════
function getVideoUi(modelKey) {
  if (!modelKey) return _videoUiEmpty();

  // Look up in any of the 4 registries.
  const vm    = VIDEO_MODELS[modelKey];
  const kg    = KLING_GROUPS[modelKey];
  const tm    = TOPAZ_MODELS[modelKey];
  const mm    = MAGNIFIC_VIDEO_MODELS[modelKey];
  const any   = vm || tm || mm;

  // Kling group "parent" entries (e.g. 'kling_v3', 'seedance2') — UI is that
  // of their default variant (the actual model that will run).
  if (kg) return getVideoUi(kg.default);

  if (!any) return _videoUiEmpty();

  // Group detection helpers based on modelKey prefix.
  const isKling     = !!vm && vm.type === 'kling';
  const isLuma      = !!vm && vm.type === 'luma_video';
  const isSeedance  = !!vm && vm.type === 'seedance';
  const isSeedance2 = modelKey.startsWith('seedance2_') || modelKey.startsWith('seedance2f_');
  const isVidu      = !!vm && vm.type === 'vidu';
  const isWan27     = !!vm && vm.type === 'wan27';
  const isWan26     = !!vm && vm.type === 'wan26';
  const isPixverse  = !!vm && vm.type === 'pixverse';
  const isPixverseV6 = modelKey.startsWith('pixverse_v6_');
  const isPixverseC1 = modelKey.startsWith('pixverse_c1_');
  const isVeo       = !!vm && vm.type === 'veo';
  const isGrok      = !!vm && vm.type === 'grok';
  const isTopaz     = !!tm;
  const isMagnific  = !!mm;

  // Variant suffix (T2V, I2V, R2V, V2V, KF, Transition, Fusion, Extend)
  const isT2V        = modelKey.endsWith('_t2v') || modelKey.endsWith('_t2v_std') || modelKey.endsWith('_t2v_pro') || modelKey.endsWith('_t2v_single');
  const isI2V        = modelKey.endsWith('_i2v') || modelKey.endsWith('_i2v_std') || modelKey.endsWith('_i2v_pro');
  const isR2V        = modelKey.endsWith('_r2v') || modelKey.endsWith('_r2v_flash');
  const isV2V        = modelKey.endsWith('_v2v') || modelKey.endsWith('_v2v_std') || modelKey.endsWith('_v2v_pro');
  const isKeyframe   = modelKey.endsWith('_kf') || modelKey.endsWith('_frames');
  const isTransition = modelKey.endsWith('_transition');
  const isFusion     = modelKey.endsWith('_fusion');

  // Start with family defaults.
  const ui = _videoUiEmpty();

  // ── Family-level defaults ─────────────────────────────

  if (isVeo) {
    Object.assign(ui, {
      showResolution:   true,
      resolutions:      vm.resolutions || ['720p', '1080p', '4k'],
      showAspect:       true,
      aspectRatios:     vm.aspectRatios || ['16:9', '9:16'],
      showDuration:     true, durationType: 'slider',
      durationMin:      vm.minDur || 4, durationMax: vm.maxDur || 8,
      durationOptions:  vm.durOptions || [],
      showAudio:        true,
      showCount:        true,
      modeSelect:       'veoRefMode',   // sub-select: t2v / i2v / frames / ingredients
      showRefs:         true, refMaxCount: 3,  // Ingredients up to 3
    });
  }

  if (isKling) {
    Object.assign(ui, {
      showResolution:   !!vm.resolutions,
      resolutions:      vm.resolutions || [],
      showAspect:       !!vm.aspectRatios,
      aspectRatios:     vm.aspectRatios || ['16:9', '9:16', '1:1'],
      showDuration:     true, durationType: (vm.durOptions && vm.durOptions.length <= 3) ? 'radio' : 'slider',
      durationMin:      5, durationMax: vm.maxDur || 10, durationOptions: vm.durOptions || [5, 10],
      showCfg:          true, cfgMin: 0, cfgMax: 1,
      showSeed:         true,
      showNegPrompt:    true,
      showAudio:        !!vm.hasAudio,
      showCount:        true,
      modeSelect:       'klingVersion',  // Kling version variant sub-select
      showRefs:         isI2V || isKeyframe,
      refMaxCount:      isKeyframe ? 2 : (vm.maxRefs || 1),
      sourceSlot:       isV2V ? 'v2v' : null,
    });
  }

  if (isLuma) {
    Object.assign(ui, {
      showResolution:   true,
      resolutions:      vm.resolutions || ['540p', '720p', '1080p', '4k'],
      showAspect:       true,
      aspectRatios:     vm.aspectRatios || ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
      showDuration:     true, durationType: 'select',
      durationOptions:  vm.durOptions || [5, 9],
      showAudio:        !!vm.hasAudio,
      showCount:        true,
      showRefs:         true,
      refMaxCount:      vm.maxRefs || 3,
      showRefWeights:   true,        // Per-ref weight sliders
      advancedGroup:    'luma',      // Loop, HDR color mode
    });
  }

  if (isSeedance) {
    Object.assign(ui, {
      showResolution:   true,
      resolutions:      vm.resolutions || (isSeedance2 ? ['480p', '720p', '1080p'] : ['720p', '1080p']),
      showAspect:       false,       // Seedance uses resolution for aspect
      showDuration:     true, durationType: 'slider',
      durationMin:      vm.minDur || 3, durationMax: vm.maxDur || 12,
      showSeed:         true,
      showAudio:        !!vm.hasAudio,
      showCount:        true,
      showRefs:         isI2V || isR2V,
      refMaxCount:      isR2V ? (vm.maxRefs || 4) : (isI2V ? 2 : 0),
      showAudioSources: isSeedance2,      // 3× audio URL inputs for Seedance 2.0
      audioSourceCount: isSeedance2 ? 3 : 0,
      sourceSlot:       isSeedance2 ? (isR2V ? null : 'sd2Vid') : null,
    });
  }

  if (isVidu) {
    Object.assign(ui, {
      showResolution:   true, resolutions: vm.resolutions || ['360p', '720p', '1080p'],
      showAspect:       true, aspectRatios: vm.aspectRatios || ['16:9', '9:16', '1:1'],
      showDuration:     true, durationType: 'select', durationOptions: vm.durOptions || [4, 6, 8],
      showSeed:         true,
      showAudio:        !!vm.hasAudio,
      showCount:        true,
      showRefs:         isI2V || isKeyframe,
      refMaxCount:      isKeyframe ? 2 : (vm.maxRefs || 1),
    });
  }

  if (isWan27) {
    Object.assign(ui, {
      showResolution:   true, resolutions: vm.resolutions || ['480p', '720p', '1080p'],
      showAspect:       true, aspectRatios: vm.aspectRatios || ['16:9', '9:16', '1:1'],
      showDuration:     !isR2V, durationType: 'slider',  // R2V has no duration
      durationMin:      vm.minDur || 5, durationMax: vm.maxDur || 10,
      showSeed:         true,
      showNegPrompt:    true,
      showAudio:        !!vm.hasAudio,
      showCount:        true,
      showRefs:         isI2V || isR2V,
      refMaxCount:      isR2V ? (vm.maxRefs || 4) : 1,
      sourceSlot:       isV2V ? 'wan27e' : (isI2V && modelKey === 'wan27_i2v' ? 'wan27v' : null),
    });
  }

  if (isWan26) {
    Object.assign(ui, {
      showResolution:   true, resolutions: vm.resolutions || ['720p', '1080p'],
      showAspect:       true, aspectRatios: vm.aspectRatios || ['16:9', '9:16'],
      showDuration:     true, durationType: 'slider',
      durationMin:      vm.minDur || 5, durationMax: vm.maxDur || 10,
      showSeed:         true,
      showAudio:        !!vm.hasAudio,
      showCount:        true,
      showRefs:         isI2V || isR2V,
      refMaxCount:      isR2V ? (vm.maxRefs || 4) : 1,
      showMultiShots:   modelKey === 'wan26_t2v',  // Multi-shot toggle only for T2V multi
    });
  }

  if (isPixverse) {
    Object.assign(ui, {
      showResolution:   false,       // Pixverse uses quality select instead
      showAspect:       true, aspectRatios: vm.aspectRatios || ['16:9', '9:16', '1:1', '4:3', '3:4'],
      showDuration:     true, durationType: 'select', durationOptions: vm.durOptions || [5, 8],
      showSeed:         true,
      showNegPrompt:    true,
      showAudio:        !!vm.hasAudio,
      showCount:        true,
      showRefs:         isI2V || isTransition || isFusion,
      refMaxCount:      isFusion ? (vm.maxRefs || 7) : (isTransition ? 2 : 1),
      modeSelect:       'pixverseMode',   // C1 vs V6 sub-variants
      advancedGroup:    'pixverse',        // Quality select, camera movement
      showCameraMove:   isPixverseV6 && (isT2V || isI2V),  // v4/v4.5 (V6 exposed) only
      showMultiClip:    isPixverseV6 || isTransition,       // V6 multi-clip, C1 transition
      showOffPeak:      true,               // All Pixverse supports off-peak
    });
  }

  if (isGrok) {
    Object.assign(ui, {
      showResolution:   true, resolutions: vm.resolutions || ['720p', '1080p'],
      showAspect:       true, aspectRatios: vm.aspectRatios || ['16:9', '9:16'],
      showDuration:     true, durationType: 'select', durationOptions: vm.durOptions || [6, 10],
      showAudio:        !!vm.hasAudio,
      showCount:        true,
      modeSelect:       'grokMode',    // t2v / i2v / ref2v / edit / extend
      showRefs:         true,          // Varies by mode, resolved at runtime
      refMaxCount:      7,             // Ref2V supports up to 7
      sourceSlot:       'grok',        // Edit/Extend use source video
    });
  }

  if (isTopaz) {
    Object.assign(ui, {
      showResolution:   false,  // Derived from input
      showAspect:       false,
      showDuration:     false,
      showCount:        false,
      advancedGroup:    'topaz',
      sourceSlot:       'topaz',
      showAudio:        false,
    });
  }

  if (isMagnific) {
    Object.assign(ui, {
      showResolution:   false,
      showAspect:       false,
      showDuration:     false,
      showCount:        false,
      advancedGroup:    'magnific',
      sourceSlot:       'magnific',
      showAudio:        false,
    });
  }

  return Object.freeze(ui);
}

function _videoUiEmpty() {
  return {
    // Core visibility flags (common defaults):
    showResolution:   false, resolutions: [],
    showAspect:       false, aspectRatios: [],
    showDuration:     false, durationType: 'slider',  // 'slider' | 'select' | 'radio'
    durationMin:      3, durationMax: 15, durationOptions: [],
    showCfg:          false, cfgMin: 0, cfgMax: 1,
    showSeed:         false,
    showAudio:        false,
    showNegPrompt:    false,
    showCount:        false,
    // References:
    showRefs:         false, refMaxCount: 0,
    showRefWeights:   false,
    // Source video / audio:
    sourceSlot:       null,   // 'topaz' | 'wan27v' | 'wan27e' | 'v2v' | 'sd2Vid' | 'grok' | 'magnific'
    showAudioSources: false, audioSourceCount: 0,
    // Sub-select (mode):
    modeSelect:       null,   // 'klingVersion' | 'veoRefMode' | 'grokMode' | 'pixverseMode'
    // Individual params group (kept as-is — too model-specific to decompose):
    advancedGroup:    null,   // 'topaz' | 'magnific' | 'pixverse' | 'luma'
    // Camera move sub-menu (under prompt):
    showCameraMove:   false,
    // Bottom toggles (above Save to folder):
    showMultiClip:    false,
    showMultiShots:   false,
    showOffPeak:      false,
  };
}

// ── Global video state ───────────────────────────────────

// Per-model spend key lookup (v206en cleanup #2).
// Reads spendKey / spendKeyAudio fields from the VIDEO_MODELS entry — single
// source of truth. WAN 2.6 uses a function (resolution-dependent pricing).
// Adding a new model: just set `spendKey` (and optional `spendKeyAudio`) in
// its VIDEO_MODELS entry. No switch to edit here.
function _getVideoSpendKey(modelKey, hasAudio) {
  const m = VIDEO_MODELS[modelKey];
  if (!m) return '_fal_video';
  const key = (hasAudio && m.spendKeyAudio) ? m.spendKeyAudio : m.spendKey;
  if (!key) return '_fal_video';
  return typeof key === 'function' ? key() : key;
}

async function uploadVideoToFal(file, falKey) {
  // Upload via Worker R2 proxy — storage.fal.run is CORS-blocked from file:// protocol
  // falKey param kept for API compatibility but not used (R2 needs no external key)
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) throw new Error('Proxy URL missing. Add it in Setup tab.');
  const res = await fetch(`${proxyUrl}/r2/upload`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'video/mp4' },
    body: file,
  });
  if (!res.ok) throw new Error(`Video upload failed: ${res.status} ${await res.text().catch(() => '')}`);
  const data = await res.json();
  if (!data.url) throw new Error('No URL in R2 upload response');
  return data.url;
}

// ── Mode toggle ───────────────────────────────────────────
// ── Active model key helper ───────────────────────────────
function getActiveVideoModelKey() {
  const mainVal = document.getElementById('videoModelSelect')?.value || '';
  // Topaz models are direct values — no group/sub-select
  if (TOPAZ_MODELS[mainVal]) return mainVal;
  // Magnific video models are direct values
  if (MAGNIFIC_VIDEO_MODELS[mainVal]) return mainVal;
  // Kling group — variants in klingVersionSelect
  if (KLING_GROUPS[mainVal]) {
    return document.getElementById('klingVersionSelect')?.value || KLING_GROUPS[mainVal].default;
  }
  return mainVal;
}

// ── Model change ─────────────────────────────────────────
function onVideoModelChange(value) {
  const prevM = VIDEO_MODELS[_prevVideoModelKey] || null;
  _videoModelSwitching = true;
  // Topaz models are selected directly from main select — no sub-select needed
  if (TOPAZ_MODELS[value]) {
    const row = document.getElementById('klingVersionRow');
    if (row) row.style.display = 'none';
    _applyVideoModel(value);
    _prevVideoModelKey = value;
    _videoModelSwitching = false;
    return;
  }
  // Magnific video models — direct, no sub-select
  if (MAGNIFIC_VIDEO_MODELS[value]) {
    const row = document.getElementById('klingVersionRow');
    if (row) row.style.display = 'none';
    _applyVideoModel(value);
    _prevVideoModelKey = value;
    _videoModelSwitching = false;
    return;
  }
  // Kling group
  if (KLING_GROUPS[value]) {
    const group = KLING_GROUPS[value];
    const sel = document.getElementById('klingVersionSelect');
    if (sel) {
      sel.innerHTML = group.variants.map(v =>
        `<option value="${v.key}">${v.label}</option>`
      ).join('');
      sel.value = group.default;
    }
    const row = document.getElementById('klingVersionRow');
    if (row) row.style.display = '';
    _applyVideoModel(group.default);
    _prevVideoModelKey = group.default;
    _videoModelSwitching = false;
    rewriteVideoPromptForModel(prevM, VIDEO_MODELS[group.default] || null);
    return;
  }
  const row = document.getElementById('klingVersionRow');
  if (row) row.style.display = 'none';
  _applyVideoModel(value);
  _prevVideoModelKey = value;
  _videoModelSwitching = false;
  rewriteVideoPromptForModel(prevM, VIDEO_MODELS[value] || null);
}

function onKlingVersionChange(variantKey) {
  const prevM = VIDEO_MODELS[_prevVideoModelKey] || null;
  _videoModelSwitching = true;
  _applyVideoModel(variantKey);
  _prevVideoModelKey = variantKey;
  _videoModelSwitching = false;
  rewriteVideoPromptForModel(prevM, VIDEO_MODELS[variantKey] || null);
}


function _setRow(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

function _applyVideoModel(key) {
  // ── Topaz models — separate parameter set ───────────────
  const tm = TOPAZ_MODELS[key];
  if (tm) {
    // Ensure legacy "Parameters" psec has its ID (for the visibility toggle
    // below) — this runs the one-time DOM moves even for Topaz so the ID
    // assignment happens regardless of which model user selects first.
    _vpEnsureDomMoves();
    // Hide unified layer — Topaz uses its own legacy panels unchanged.
    const vpEl = document.getElementById('vpParams');
    if (vpEl) vpEl.style.display = 'none';
    const legacyPrompt = document.getElementById('videoPromptSec');
    if (legacyPrompt) legacyPrompt.style.display = 'none';  // Topaz has no prompt UI
    // Show the legacy Parameters psec — it still contains all the Topaz rows
    // (topazResRow, topazFactorRow, topazFpsRow, topazSlowmoRow, topazCreativityRow).
    _setRow('videoParamsLegacy', true);
    document.getElementById('videoModelDesc').textContent = tm.desc;
    // Show Topaz-specific rows, hide most normal ones
    _setRow('topazSrcRow',       true);
    _setRow('topazResRow',       true);
    _setRow('topazFactorRow',    !!tm.hasFactor);
    _setRow('topazFpsRow',       true);
    _setRow('topazSlowmoRow',    true);
    _setRow('topazCreativityRow',!!tm.hasCreativity);
    // Hide incompatible rows
    _setRow('veoResRow',         false);
    _setRow('lumaResRow',        false);
    _setRow('wanResRow',         false);
    _setRow('unifiedResRow',     false);  // v223en: Topaz uses own topazResRow
    _setRow('pixverseParams',    false);
    _setRow('videoAspectRow',    false);
    _setRow('videoAudioCtrl',    false);
    _setRow('videoDurSliderRow', false);
    _setRow('videoDurRadioRow',  false);
    _setRow('videoDurRow',       false);
    _setRow('videoCfgRow',       false);
    _setRow('videoCountRow',     false);
    // Hide prompt, styles, camera — not used for upscale
    _setRow('videoPromptSec',    false);
    _setRow('videoTagsRow',      false);
    // Hide ref section — Topaz uses its own source video slot
    _setRow('videoRefSection',   false);
    _setRow('unifiedSrcVideoRow', false);
    _setRow('lumaVideoParams',   false);
    _setRow('veoRefModeRow',     false);
    _setRow('grokVideoParams',   false);
    _setRow('klingVersionRow',   false); // Topaz models are directly in main select
    // Limit slowmo options for Astra (max 8x)
    const slowmoSel = document.getElementById('topazSlowmo');
    if (slowmoSel) {
      Array.from(slowmoSel.options).forEach(opt => {
        const v = parseInt(opt.value);
        opt.disabled = v > (tm.maxSlowmo || 16);
        if (opt.disabled && opt.selected) { slowmoSel.value = '0'; }
      });
    }
    // Update button label + time hint
    const lbl = document.getElementById('videoGenBtnLabel');
    if (lbl) lbl.textContent = '▶ Upscale Video';
    const hint = document.getElementById('videoGenTimeHint');
    if (hint) hint.textContent = 'Upscale takes 5–15 min';
    return;
  }
  // ── Magnific Video models ────────────────────────────────
  const mvm = MAGNIFIC_VIDEO_MODELS[key];
  if (mvm) {
    _vpEnsureDomMoves();
    // Hide unified layer — Magnific uses its own legacy panels unchanged.
    const vpEl = document.getElementById('vpParams');
    if (vpEl) vpEl.style.display = 'none';
    const legacyPrompt = document.getElementById('videoPromptSec');
    if (legacyPrompt) legacyPrompt.style.display = 'none';  // Magnific has no prompt UI
    // videoParamsLegacy stays visible — contains Save to folder.  Topaz-only
    // rows inside are hidden by the explicit _setRow calls below.
    _setRow('videoParamsLegacy', true);
    document.getElementById('videoModelDesc').textContent = mvm.desc;
    // Reuse topazSrcRow for source video selection
    _setRow('topazSrcRow',        true);
    _setRow('magnificVidOpts',    true);
    _setRow('topazResRow',        false);
    _setRow('topazFactorRow',     false);
    _setRow('topazFpsRow',        false);
    _setRow('topazSlowmoRow',     false);
    _setRow('topazCreativityRow', false);
    _setRow('veoResRow',          false);
    _setRow('lumaResRow',         false);
    _setRow('wanResRow',          false);
    _setRow('unifiedResRow',      false);  // v223en: Magnific uses magnificVidOpts

    _setRow('pixverseParams',    false);
    _setRow('videoAspectRow',     false);
    _setRow('videoAudioCtrl',     false);
    _setRow('videoDurSliderRow',  false);
    _setRow('videoDurRadioRow',   false);
    _setRow('videoDurRow',        false);
    _setRow('videoCfgRow',        false);
    _setRow('videoCountRow',      false);
    _setRow('videoPromptSec',     false);
    _setRow('videoTagsRow',       false);
    _setRow('videoRefSection',    false);
    _setRow('unifiedSrcVideoRow', false);
    _setRow('lumaVideoParams',    false);
    _setRow('veoRefModeRow',      false);
    _setRow('grokVideoParams',    false);
    _setRow('klingVersionRow',    false);
    // Show/hide mode-specific controls
    const isCreative = mvm.mode === 'creative';
    _setRow('magnificVidCreativeOpts', isCreative);
    _setRow('magnificVidPrecisionOpts', !isCreative);
    const lbl = document.getElementById('videoGenBtnLabel');
    if (lbl) lbl.textContent = '▶ Upscale Video';
    const hint = document.getElementById('videoGenTimeHint');
    if (hint) hint.textContent = 'Upscale takes 2–8 min';
    return;
  }

  // ── Hide Magnific video rows for non-Magnific models ────
  _setRow('magnificVidOpts', false);

  // ── Hide all Topaz rows for normal models ────────────────
  _setRow('topazSrcRow',       false);
  _setRow('topazResRow',       false);
  _setRow('topazFactorRow',    false);
  _setRow('topazFpsRow',       false);
  _setRow('topazSlowmoRow',    false);
  _setRow('topazCreativityRow',false);
  // Restore normal rows that Topaz hides
  _setRow('videoPromptSec',    true);
  _setRow('videoTagsRow',      true);
  _setRow('videoDurRow',       true);
  _setRow('videoCfgRow',       true);
  _setRow('videoCountRow',     true);
  _setRow('videoAspectRow',    true);
  // Restore button label
  const lbl = document.getElementById('videoGenBtnLabel');
  if (lbl) lbl.textContent = '▶ Generate Video';
  const hint = document.getElementById('videoGenTimeHint');
  if (hint) hint.textContent = 'Generation takes 1–5 min';

  const m = VIDEO_MODELS[key];
  if (!m) return;
  document.getElementById('videoModelDesc').textContent = m.desc;

  // v220en: Family info line below videoModelDesc (was hardcoded inside
  // per-family psec containers).  Shown only when the family has an entry.
  const infoEl = document.getElementById('videoModelInfo');
  if (infoEl) {
    const info = VIDEO_MODEL_FAMILY_INFO[m.type];
    infoEl.textContent = info || '';
    infoEl.style.display = info ? '' : 'none';
  }

  // v220en: Per-family prompt placeholder (was hardcoded hint boxes inside
  // seedance2Params).  Uses default when family has no entry.
  const promptEl = document.getElementById('vpPrompt');
  if (promptEl) {
    promptEl.placeholder = VIDEO_MODEL_PROMPT_PLACEHOLDER[m.type] || VIDEO_DEFAULT_PROMPT_PLACEHOLDER;
  }

  // v221en: Configure unified Duration slider per model type.
  configureDurationSlider(m);

  // v223en: Unified Resolution switcher configured at END of this function
  // (after all per-model tweaks like Seedance Fast-tier 1080p snap-back).
  // See call after _vpApplyUnifiedLayer below.

  // v225en: videoResInfoRow + videoResInfo span removed from DOM.  Unified
  // switcher's info label ("1280×720 · 16:9") is the single Resolution display.

  // Ref panel — show/hide and configure based on refMode
  const refSec = document.getElementById('videoRefSection');
  const refLabel = document.getElementById('videoRefLabel');
  const refNote = document.getElementById('videoRefNote');
  const refCount = document.getElementById('videoRefCount');
  const hasRefs = m.refMode && m.refMode !== 'none';
  if (refSec) refSec.style.display = hasRefs ? 'block' : 'none';

  // V2V Motion Control — visibility now managed by _vpApplyUnifiedLayer
  // via supportsSourceVideo(model) + sourceVideoLabel(model).

  if (hasRefs) {
    if (refLabel) refLabel.childNodes[0].textContent = m.refLabel || 'Reference images';
    // Clip to new model's maxRefs (don't clear — preserve refs across model switch)
    if (videoRefs.length > m.maxRefs) videoRefs = videoRefs.slice(0, m.maxRefs);
    if (refCount) refCount.textContent = `${videoRefs.length} / ${m.maxRefs}`;
    if (refNote && m.refMode === 'keyframe') {
      refNote.textContent = m.type === 'pixverse_video' ? 'Add first frame, then last frame. Video morphs between them.' : 'Add start frame first, then end frame.';
      refNote.style.display = 'block';
    } else if (refNote && m.refMode === 'multi' && m.pixverseMode === 'fusion') {
      refNote.innerHTML = 'Use <b>@pic1</b>, <b>@pic2</b>... in prompt to reference each image. Tag label with [bg] for backgrounds.';
      refNote.style.display = 'block';
    } else if (refNote && m.refMode === 'multi') {
      refNote.textContent = `Reference subjects as @Element1, @Element2... in your prompt.`;
      refNote.style.display = 'block';
    } else if (refNote && m.refMode === 'wan_r2v') {
      refNote.textContent = 'Add image/video refs. Reference them as Character1, Character2... in your prompt.';
      refNote.style.display = 'block';
    } else if (refNote && m.refMode === 'seedance2_r2v') {
      refNote.innerHTML = 'Image refs → <b>[Image1]</b>, <b>[Image2]</b>... in prompt. Videos &amp; audio via panel above.';
      refNote.style.display = 'block';
    } else if (refNote && m.refMode === 'video_ref') {
      refNote.textContent = 'Upload action video above for motion reference. Character image below is optional.';
      refNote.style.display = 'block';
    } else if (refNote) {
      refNote.style.display = 'none';
    }
    renderVideoRefPanel();
  }

  // Audio checkbox
  // Audio toggle — show only for models with audio support
  const audioCtrl = document.getElementById('videoAudioCtrl');
  const audioEl = document.getElementById('videoEnableAudio');
  if (audioCtrl) audioCtrl.style.display = m.hasAudio ? '' : 'none';
  if (audioEl) {
    if (!m.hasAudio) audioEl.checked = false;
  }
  updateAudioToggleUI();

  // v221en: Duration is now configured by configureDurationSlider(m.type) earlier
  // in this function (unified slider in videoDurRow).  Legacy radio/slider
  // switching logic based on m.durOptions / m.maxDur removed; those fields
  // are now consumed by configureDurationSlider as per-model overrides.

  // Aspect ratio: hide for I2V single (inferred from image) — but show for Veo and Luma (T2V/I2V toggle)
  const arRow = document.getElementById('videoAspectRow');
  if (arRow) arRow.style.display = (m.refMode === 'single' || m.refMode === 'single_end') && m.type !== 'veo' && m.type !== 'luma_video' ? 'none' : '';

  // v225en: Veo legacy veoResolution select removed from DOM — unified
  // Resolution switcher renders buttons from m.resolutions directly.
  // onVeoResolutionChange side effects (force 8s for 1080p/4K) now fire
  // from _onUnifiedResClick via _applyResolutionSideEffects.
  if (m.type === 'veo') {
    // Trigger side-effects for initial resolution state on model switch.
    if (typeof onVeoResolutionChange === 'function') onVeoResolutionChange();
  }

  // Veo ref mode selector
  const veoRefModeRow = document.getElementById('veoRefModeRow');
  if (veoRefModeRow) veoRefModeRow.style.display = m.type === 'veo' ? '' : 'none';
  if (m.type === 'veo') {
    onVeoRefModeChange(document.getElementById('veoRefMode')?.value || 't2v');
  }

  // Grok Video params
  const grokVideoParams = document.getElementById('grokVideoParams');
  if (grokVideoParams) grokVideoParams.style.display = m.type === 'grok_video' ? '' : 'none';
  if (m.type === 'grok_video') {
    onGrokVideoModeChange(document.getElementById('grokVideoMode')?.value || 't2v');
  }

  // Luma controls — v224en: Loop + Color mode + CharRef are now managed
  //   by block 2i (_vpApplyUnifiedLayer) via supportsLoop/supportsHdr/
  //   supportsCharRef flags.  The legacy lumaVideoParams panel is hidden
  //   always (extracted elements moved to bottom toggles / source slots).
  // v225en: lumaResolution legacy select removed from DOM — unified
  //   Resolution switcher renders buttons from m.resolutions directly.
  if (m.type === 'luma_video') {
    // Show ref panel for keyframes
    const refSec = document.getElementById('videoRefSection');
    const refLabel = document.getElementById('videoRefLabel');
    const refCount = document.getElementById('videoRefCount');
    if (refSec) refSec.style.display = 'block';
    if (refLabel) refLabel.childNodes[0].textContent = 'Keyframes (optional)';
    if (refCount) refCount.textContent = `${videoRefs.length} / 2`;
    renderVideoRefPanel();
  }

  // wan27_video: hide generic duplicate rows (own params are unified now).
  // v222en: videoDurRow removed from hide list — unified Duration slider
  // is now the single Duration UI for wan27_video too.
  if (m.type === 'wan27_video') {
    _setRow('videoCfgRow',     false);
    _setRow('videoCountRow',   false);
  }

  const wan27eParams  = document.getElementById('wan27eParams');
  const isWan27e = m.type === 'wan27e_video';
  if (wan27eParams) wan27eParams.style.display  = isWan27e ? '' : 'none';
  // v222en: videoDurRow removed from hide list (same reason as wan27_video).
  if (isWan27e) {
    _setRow('videoCfgRow',     false);
    _setRow('videoCountRow',   false);
  }

  // PixVerse — v225en: pixverseParams shell removed from template.html.
  //   All .ctrl children (MultiClip/OffPeak/Seed) are extracted to their
  //   unified slots.  No shell to hide.
  const isPixverse = m.type === 'pixverse_video';
  if (isPixverse) {
    _setRow('videoCfgRow',     false);
  }

  // Seedance 2.0 — v225en: seedance2Params shell removed from template.html.
  //   sd2R2VSection (R2V panel) extracted to source slot area pod videoRefSection.
  //   Other controls (Seed) extracted to unified Seed slot.
  const isSd2 = m.type === 'seedance2_video';

  // v224.1: sd2R2VSection visibility MUST be managed unconditionally
  //   (outside isSd2 branch) — otherwise when user switches from Seedance
  //   R2V (visible) to another model (e.g. WAN 2.6), isSd2 is false so
  //   the branch is skipped, and the section stays visible bleeding into
  //   unrelated models' UI.  Move to top-level per-model check.
  const isR2V = isSd2 && m.refMode === 'seedance2_r2v';
  const sd2R2VSection = document.getElementById('sd2R2VSection');
  if (sd2R2VSection) sd2R2VSection.style.display = isR2V ? '' : 'none';

  if (isSd2) {
    _setRow('videoCfgRow',     false);
    _setRow('videoCountRow',   false);
    // v225en: Fast-tier 1080p snap-back handled by configureResolutionSwitcher
    //   reading m.resolutions (Fast: ['480p','720p'], 1080p not rendered).
  }

  updateVideoResInfo();

  // ═════════════════════════════════════════════════════════
  // UNIFIED LAYER (v210en) — prompt + mode sub-select only.
  // Everything else stays in its legacy panel (refs, tags, core
  // params, per-family advanced).  Called for every non-Topaz/
  // Magnific model (those return early above).
  // ═════════════════════════════════════════════════════════
  _vpApplyUnifiedLayer(key, m);

  // v223en: Configure unified Resolution switcher — called LAST so it
  // reads the final post-tweak value from the legacy element (e.g. for
  // Seedance Fast-tier where 1080p snaps back to 720p during above).
  configureResolutionSwitcher(m);
}

// Install one-time redirect #videoPrompt.value → #vpPrompt.value so all
// existing callsites (AI prompt, style/camera tags, rewriteVideoPromptForModel)
// keep working unchanged — they read/write videoPrompt which proxies to vpPrompt.
let _vpPromptRedirectDone = false;
function _vpEnsurePromptRedirect() {
  if (_vpPromptRedirectDone) return;
  const legacyEl  = document.getElementById('videoPrompt');
  const unifiedEl = document.getElementById('vpPrompt');
  if (!legacyEl || !unifiedEl) return;
  try {
    if (legacyEl.value && !unifiedEl.value) unifiedEl.value = legacyEl.value;
    Object.defineProperty(legacyEl, 'value', {
      get() { return unifiedEl.value; },
      set(val) { unifiedEl.value = val; },
      configurable: true,
    });
    _vpPromptRedirectDone = true;
  } catch (e) {
    console.warn('[GIS] videoPrompt redirect failed:', e);
  }
}

// Negative prompt: each family has its own legacy element (pixverseNegPrompt,
// v225en: unified `vpNegPrompt` is the single authoritative input.  Legacy
// per-family inputs (wan27vNegPrompt, pixverseNegPrompt) removed from DOM.
// Generate path reads vpNegPrompt directly (_deriveNegPrompt in video-queue.js).
let _vpNegPromptHooked = false;  // kept for backwards-compat symbol
function _vpEnsureNegPromptRedirect() {
  // No-op after v225en — vpNegPrompt is read directly, no mirror needed.
}

// Show/hide vpNegPromptSection based on whether active model supports neg prompt.
function _vpUpdateNegPromptTarget(key, model) {
  const vpNegSec = document.getElementById('vpNegPromptSection');
  if (!vpNegSec) return;
  // Kling/Vidu/Seedance/Veo/Grok/Luma/WAN 2.6/2.7e don't expose negative prompt.
  const supportsNeg = model.type === 'pixverse_video' || model.type === 'wan27_video';
  vpNegSec.style.display = supportsNeg ? '' : 'none';
  // Clear vpNegPrompt when switching to a model that doesn't support it — no
  // accidental leak of previous model's neg prompt into generate payload.
  if (!supportsNeg) {
    const vpNeg = document.getElementById('vpNegPrompt');
    if (vpNeg) vpNeg.value = '';
  }
}

// Activate vpParams container with only prompt + mode-select visible;
// hide the legacy videoPromptSec and klingVersionRow; keep everything
// else in the panel (refs, core params, advanced) hidden.
function _vpApplyUnifiedLayer(key, model) {
  if (!model) return;
  _vpEnsurePromptRedirect();
  _vpEnsureNegPromptRedirect();
  _vpEnsureDomMoves();

  // 1. Show vpParams container (as flex column).
  const vp = document.getElementById('vpParams');
  if (vp) vp.style.display = 'flex';

  // 2. Show vpPromptSection, hide the legacy one.
  _setRow('vpPromptSection', true);
  _setRow('videoPromptSec',  false);

  // 2b. Negative prompt: sync to active model's legacy target + show/hide
  //     section based on whether the model supports neg prompt.
  _vpUpdateNegPromptTarget(key, model);

  // v224en: Luma character ref visibility moved to block 2i (per-model
  // supportsCharRef check).  Previously always hidden.

  // Seed visibility — single source: supportsSeed() in video-utils.
  _setRow('unifiedSeedRow', supportsSeed(model));

  // Safety visibility — single source: supportsSafety() in video-utils.
  _setRow('unifiedSafetyRow', supportsSafety(model));

  // Audio URL slots — audioSlots() returns 0/1/3.
  const _audioN = audioSlots(model);
  _setRow('unifiedAudioUrlRow', _audioN > 0);
  if (_audioN > 0) {
    for (let i = 0; i < 3; i++) {
      const el = document.getElementById('unifiedAudioUrl' + (i + 1));
      if (el) el.style.display = i < _audioN ? '' : 'none';
    }
    const hint = document.getElementById('unifiedAudioUrlHint');
    if (hint) hint.textContent = _audioN === 1
      ? '(optional · MP3/WAV · background audio)'
      : '(max 3 · paste URL · use [Audio1] in prompt)';
  }

  // Source/Motion/Extend Video slot — Grok mode gates actual visibility.
  let _showSrcVid = supportsSourceVideo(model);
  if (_showSrcVid && model.type === 'grok_video') {
    const grokMode = document.getElementById('grokVideoMode')?.value || 't2v';
    _showSrcVid = (grokMode === 'edit' || grokMode === 'extend' || grokMode === 'v2v');
  }
  _setRow('unifiedSrcVideoRow', _showSrcVid);
  if (_showSrcVid) {
    const lbl = document.getElementById('unifiedSrcVideoLabel');
    if (lbl) lbl.textContent = sourceVideoLabel(model);
    const uploadBtn = document.getElementById('unifiedSrcUploadBtn');
    if (uploadBtn) uploadBtn.style.display = sourceVideoSupportsUpload(model) ? '' : 'none';
    const footer = document.getElementById('unifiedSrcFooter');
    if (footer) footer.textContent = _UNIFIED_SRC_NOTES[model.type] || '';
  }

  // 2e. PixVerse extracts (v219en) — elements moved from pixverseParams
  //     into unified slots.  Without per-model visibility, these stayed
  //     visible for every model (e.g. "QUALITY: 720p" showing on Seedance
  //     or Kling).  Now: shown only when PixVerse is the active model.
  //     v223en: pixverseCameraRow removed — Camera Movement feature deleted.
  //     v225en: pixverseQuality row removed from DOM — unified switcher
  //     handles PixVerse resolution.
  //     v224en: pixverseOffPeakRow visibility simplified — supportsOffPeak
  //     was only on pixverse_video TYPE, not on individual variants (c1_*,
  //     v6_*).  fal.ai's off-peak mode is available for all PixVerse
  //     endpoints universally, so we show it whenever PixVerse is active.
  const _isPixverse = model.type === 'pixverse_video';
  _setRow('pixverseMultiClipRow', _isPixverse && !!model.supportsMultiClip);
  _setRow('pixverseOffPeakRow',   _isPixverse);

  // 2i. Luma extracts (v224en) — Loop + Color mode in bottom toggles,
  //     Character reference in source slot area.  Per-model visibility:
  //     Ray2/Ray2-Flash: Loop only (supportsLoop:true, rest false).
  //     Ray3/Ray3.14:    CharRef only (supportsCharRef:true for Ray3).
  //     Ray3 HDR:        Loop + HDR + CharRef (all true).
  //     Ray3.14 HDR:     Loop + HDR.
  const _isLuma = model.type === 'luma_video';
  _setRow('lumaLoopRow',      _isLuma && !!model.supportsLoop);
  _setRow('lumaColorModeRow', _isLuma && !!model.supportsHdr);
  _setRow('lumaCharRefRow',   _isLuma && !!model.supportsCharRef);

  // v225en: Resolution slot — unified #unifiedResButtons is the single UI
  //   for all models.  All legacy Resolution rows removed from DOM.
  //   configureResolutionSwitcher() below renders buttons from model data.

  // 2g. Aspect slot (v220en) — WAN 2.7e has its own Aspect switcher
  //     (Auto/16:9/9:16/1:1/4:3/3:4 with "auto = match source" option)
  //     extracted to a slot next to the common Aspect row.  Only one
  //     visible at a time.
  const _isWan27e = model.type === 'wan27e_video';
  _setRow('wan27eAspectRow', _isWan27e);
  // Common Aspect slot (videoAspectRow) is managed elsewhere; when WAN 2.7e
  // is active the common one should hide.  Add that coupling:
  const _commonAspectRow = document.getElementById('videoAspectRow');
  if (_commonAspectRow && _isWan27e) _commonAspectRow.style.display = 'none';

  // 2h. Unified source video row visibility is handled by the earlier block
  //     (supportsSourceVideo + Grok mode gate) — no per-type override here.

  // 3. Hide the (still empty) vp* placeholder sections — legacy elements
  //    videoTagsRow / videoRefSection have been moved INTO vpParams by
  //    _vpEnsureDomMoves and continue to manage their own visibility via
  //    the normal _applyVideoModel switch logic.
  _setRow('vpTagsRow',           false);
  _setRow('vpNegPromptSection',  false);
  _setRow('vpRefsSection',       false);
  _setRow('vpSourceVideoSection', false);
  _setRow('vpSourceAudioSection', false);
  _setRow('vpResolutionRow', false);
  _setRow('vpAspectRow',     false);
  _setRow('vpCfgRow',        false);
  _setRow('vpDurationRow',   false);
  _setRow('vpSeedRow',       false);
  _setRow('vpLumaAdvanced',     false);
  _setRow('vpPixverseAdvanced', false);
  _setRow('vpTopazAdvanced',    false);
  _setRow('vpMagnificAdvanced', false);
  _setRow('vpCountRow',      false);
  _setRow('vpMultiClipRow',  false);
  _setRow('vpMultiShotsRow', false);
  _setRow('vpOffPeakRow',    false);
  _setRow('vpAudioRow',      false);

  // videoParamsLegacy psec stays VISIBLE — it contains Save to folder.
  // Its "Parameters" plabel has been moved into vpParams (step 4 of DOM moves).
  // Topaz rows inside videoParamsLegacy are still controlled per-model by
  // the legacy _applyVideoModel logic.

  // 4. Mode sub-select — show for groups that already had a klingVersionRow.
  //    kling_video, pixverse_video, vidu_video all use KLING_GROUPS.
  const gk = Object.keys(KLING_GROUPS).find(g =>
    KLING_GROUPS[g].variants.some(v => v.key === key)
  );
  if (gk) {
    const group = KLING_GROUPS[gk];
    const lbl = document.getElementById('vpModeLabel');
    const sel = document.getElementById('vpModeSelect');
    if (lbl) lbl.textContent = gk.startsWith('pixverse') ? 'Mode' : 'Version';
    if (sel) {
      sel.innerHTML = group.variants.map(v =>
        `<option value="${v.key}">${v.label}</option>`
      ).join('');
      sel.value = key;
    }
    _setRow('vpModeSection',  true);
    _setRow('klingVersionRow', false);
  } else {
    _setRow('vpModeSection',   false);
    // klingVersionRow stays controlled by onVideoModelChange (it was
    // already hidden above for non-group models).
  }
}

// One-time DOM moves that bring legacy video panels into vpParams so the
// user sees a single coherent panel: prompt → tags → refs → (legacy advanced).
// We don't duplicate or rewrite any content — just re-parent existing nodes.
// Handlers (onclick, change) and render targets (videoStyleTags, videoRefPanelScroll)
// keep working because they reference elements by ID, not by DOM position.
let _vpDomMovesDone = false;
function _vpEnsureDomMoves() {
  if (_vpDomMovesDone) return;
  const vpParams      = document.getElementById('vpParams');
  const vpPromptSec   = document.getElementById('vpPromptSection');
  const videoPromptSec = document.getElementById('videoPromptSec');
  const videoTagsRow  = document.getElementById('videoTagsRow');
  const videoRefSec   = document.getElementById('videoRefSection');
  if (!vpParams || !vpPromptSec) return;

  try {
    // ════════════════════════════════════════════════════════
    // STRUCTURE PER PETR SPEC (2026-04-22):
    //   1. Sub-select (mode)
    //   2. Common header: prompt → tagy → NEG PROMPT → refs
    //   3. Source slots: source video, source audio (pod refs)
    //   4. "PARAMETERS" plabel (nadepisuje core params zone)
    //   5. Core params: Resolution, Aspect, CFG, Duration, Seed
    //   6. Per-family advanced (co zbyde po extrakci)
    //   7. Count
    //   8. Audio toggle
    //   9. Bottom toggles: multi-clip, off-peak
    //  10. Save to folder (mimo vpParams, zůstává v legacy psec)
    //  11. Generate button
    // ════════════════════════════════════════════════════════

    // STEP 1: Styles/Camera buttons + legacy ✦ AI button from videoPromptSec
    //         into vpPromptSection.  (vpPrompt textarea already exists in vpPromptSec.)
    if (videoPromptSec) {
      const stylesBtn = videoPromptSec.querySelector('.btn-styles');
      const buttonsDiv = stylesBtn?.parentElement;
      if (buttonsDiv && buttonsDiv.parentNode === videoPromptSec) {
        vpPromptSec.appendChild(buttonsDiv);
      }
      const legacyAiBtn = videoPromptSec.querySelector('.plabel button[onclick*="openAiPromptModal"]');
      if (legacyAiBtn) {
        const vpPlabel = vpPromptSec.querySelector('.plabel');
        if (vpPlabel) {
          const vpAiBtn = vpPlabel.querySelector('button[onclick*="vpAiPrompt"]');
          if (vpAiBtn) vpAiBtn.remove();
          vpPlabel.appendChild(legacyAiBtn);
        }
      }
    }

    // STEP 2: Common header order → prompt → tagy → NEG PROMPT → refs
    //         (per Petr: "negativni prompt tesne pod tagy, nad reference")
    const vpNegSec = document.getElementById('vpNegPromptSection');
    // 2a: tagy after prompt
    if (videoTagsRow) {
      vpPromptSec.insertAdjacentElement('afterend', videoTagsRow);
    }
    // 2b: neg prompt after tagy
    if (vpNegSec && videoTagsRow) {
      videoTagsRow.insertAdjacentElement('afterend', vpNegSec);
    }
    // 2c: refs after neg prompt (or after tagy if no neg sec)
    if (videoRefSec) {
      const anchor = vpNegSec || videoTagsRow || vpPromptSec;
      anchor.insertAdjacentElement('afterend', videoRefSec);
    }

    // STEP 3: Source slots after refs (source video, then source audio eventually).
    //         Reverse order because 'afterend' stacks in reverse.
    //         v229en: wan27v / wan27e / v2v / grok source rows merged into
    //         unifiedSrcVideoRow.  wan27vAudioUrl + sd2AudioUrl1/2/3 merged
    //         into unifiedAudioUrlRow.  wan27vParams shell removed entirely.
    const sourceSlots = [
      // Audio sources (placed last in loop → end up at BOTTOM of stack):
      'unifiedAudioUrlRow',
      // v224en: Luma Character reference — image source (Ray3 char_ref_b64
      // payload field, separate from standard keyframe refs).  Placed
      // between audio and video sources so it visually sits between
      // videoRefSection and video sources.
      'lumaCharRefRow',
      // Video sources — single unified row covers WAN 2.7 Edit,
      // WAN 2.7 R2V Extend, Grok V2V/Edit/Extend, Kling Motion Control.
      'unifiedSrcVideoRow',
      // v224en: Seedance 2.0 R2V section (3 video refs + 3 audio URLs).
      // Per Petr spec: "rozšířit videoRefSection: umí 9 image + 3 video +
      // 3 audio — vše dohromady".  Placed LAST in array = closest to
      // videoRefSec (insertAdjacentElement stacks in reverse).  So for
      // seedance2_r2v: [ videoRefSec (9 imgs) → sd2R2VSection (3 vid + 3
      // audio) → <video sources if any> → <audio sources if any> ].
      'sd2R2VSection',
    ];
    for (const id of sourceSlots) {
      const el = document.getElementById(id);
      if (el && videoRefSec && videoRefSec.parentNode === vpParams) {
        videoRefSec.insertAdjacentElement('afterend', el);
      }
    }

    // STEP 4: "PARAMETERS" plabel — MOVE (not hide) from legacy psec into vpParams
    //         so it labels the core params section.  Per Petr: "napis parameters
    //         neskryt. Jen nama byt dole ale pod referencemi - nadepisuje oblast parametru"
    // v225en: veoResRow removed; use topazResRow as anchor (first .ctrl still in
    //   the legacy Parameters psec after cleanup).
    const anchorForParamsPsec = document.getElementById('topazResRow')
                             || document.getElementById('topazFactorRow')
                             || document.getElementById('topazFpsRow');
    let paramsPsec = null;
    if (anchorForParamsPsec) {
      paramsPsec = anchorForParamsPsec.closest('.psec');
      if (paramsPsec && !paramsPsec.id) paramsPsec.id = 'videoParamsLegacy';
    }
    // Move the "Parameters" plabel to vpParams (right after source slots,
    // before core params).  The legacy psec keeps Save to folder + Topaz rows.
    if (paramsPsec) {
      const paramsLabel = paramsPsec.querySelector('.plabel');
      if (paramsLabel && paramsLabel.textContent.trim().toLowerCase().startsWith('parameters')) {
        // Insertion anchor: bottom-most source/audio slot, or refs fallback.
        const lastSource = document.getElementById('unifiedAudioUrlRow')
                       || document.getElementById('unifiedSrcVideoRow')
                       || videoRefSec;
        if (lastSource) {
          lastSource.insertAdjacentElement('afterend', paramsLabel);
        }
      }
    }

    // STEP 5: Core params — appended in order after the PARAMETERS plabel.
    //         v223.1: unifiedResRow added BEFORE videoAspectRow so the new
    //         segmented-buttons Resolution sits above Aspect (Petr's spec:
    //         "Resolution nad aspect ratio - u vsech modelu").
    const coreIds = [
      'unifiedResRow',    // v223.1: unified segmented-buttons Resolution switcher
      'videoAspectRow',
      'videoCfgRow',
      'videoDurRow',
      // Extracted: seed wrappers (step 7)
      // v225en: legacy per-family Resolution rows removed from DOM entirely.
    ];
    for (const id of coreIds) {
      const el = document.getElementById(id);
      if (el && el.parentNode !== vpParams) {
        vpParams.appendChild(el);
      }
    }

    // STEP 5b: Unified Seed + Safety slots — placed right after videoDurRow.
    //   Without this, unifiedSeedRow/SafetyRow stay at their static template
    //   positions and the subsequent appendChild calls in STEP 8/9/10 (count,
    //   audio, bottom toggles) end up before them, pushing them visually to
    //   the bottom.  Safety must sit right after Seed (same pattern).
    //   v226en added seed; v227en extends with safety.
    const _unifiedSeedRow   = document.getElementById('unifiedSeedRow');
    const _unifiedSafetyRow = document.getElementById('unifiedSafetyRow');
    const _videoDurRow      = document.getElementById('videoDurRow');
    if (_unifiedSeedRow && _videoDurRow) {
      _videoDurRow.insertAdjacentElement('afterend', _unifiedSeedRow);
    }
    if (_unifiedSafetyRow && _unifiedSeedRow) {
      // Insert after seed so final order is: Duration → Seed → Safety → (rest)
      _unifiedSeedRow.insertAdjacentElement('afterend', _unifiedSafetyRow);
    }

    // STEP 6: Per-family advanced panels (source already moved in step 3).
    // v229en: wan27vParams shell deleted (audio + extend were its only content,
    //   both unified now).  Only wan27eParams remains (aspect + audio select).
    const perFamilyIds = [
      'wan27eParams',
    ];
    for (const id of perFamilyIds) {
      const el = document.getElementById(id);
      if (el && el.parentNode !== vpParams) {
        vpParams.appendChild(el);
      }
    }

    // STEP 6b: Mode-first panels — Veo refMode + Grok (with mode select) must
    //          appear at the TOP, right after vpModeSection, BEFORE vpPromptSection.
    const modeFirstIds = [
      'veoRefModeRow',    // Veo: reference mode (t2v / i2v / frames / ingredients)
      'grokVideoParams',  // Grok: mode + per-mode sub-controls
    ];
    for (const id of modeFirstIds) {
      const el = document.getElementById(id);
      if (el && vpPromptSec.parentNode === vpParams) {
        vpParams.insertBefore(el, vpPromptSec);
      }
    }

    // STEP 7: Extract per-family elements → unified slots.
    _vpExtractPerFamilyElements();

    // STEP 8: Count at the end (after all advanced sections).
    const countRow = document.getElementById('videoCountRow');
    if (countRow) vpParams.appendChild(countRow);

    // STEP 9: Audio toggle after Count.
    const audioCtrl = document.getElementById('videoAudioCtrl');
    if (audioCtrl) vpParams.appendChild(audioCtrl);

    // STEP 10: Bottom toggles AFTER audio (per spec: "off-peak mode je dole na
    //          konci parametru - nad save to folder - pod audio on").
    _vpExtractBottomToggles();

    // v225en: STEP 11/12/13 all removed.  Legacy Duration (wan27vDuration,
    //   wan27eDuration, sd2Duration, grokVideoDur, lumaDuration radios,
    //   wan27vPromptExpand), legacy Resolution rows (videoResInfoRow,
    //   veoResRow, lumaResRow, wanResRow, pixverseQualityRow,
    //   wan27vResolutionRow, wan27eResolutionRow, sd2ResolutionRow,
    //   grokResolutionRow), and legacy negative prompt fields
    //   (pixverseNegPrompt, wan27vNegPrompt) are all gone from template.html.
    //   Generate/reuse reads/writes go exclusively through unified helpers
    //   (getUnifiedResolution/Duration, #vpNegPrompt, #videoDuration).

    _vpDomMovesDone = true;
  } catch (e) {
    console.warn('[GIS] DOM moves failed:', e);
  }
}

// Extract per-family ctrl wrappers that belong in CORE / COMMON HEADER slots
// (Resolution, Seed, Camera move).  Bottom toggles are handled separately
// AFTER Count+Audio are appended, by _vpExtractBottomToggles().
function _vpExtractPerFamilyElements() {
  const vpParams    = document.getElementById('vpParams');
  const vpPromptSec = document.getElementById('vpPromptSection');
  if (!vpParams || !vpPromptSec) return;

  function moveWrapper(elId, newWrapperId, targetId, position) {
    const el = document.getElementById(elId);
    let wrapper;
    if (el) {
      wrapper = el.closest('.ctrl');
    }
    // v220en: fallback for wrappers with pre-assigned IDs in template
    // (e.g. radio groups where we can't uniquely target by input id).
    if (!wrapper) wrapper = document.getElementById(newWrapperId);
    if (!wrapper) return;
    if (!wrapper.id) wrapper.id = newWrapperId;
    const target = document.getElementById(targetId);
    if (!target) return;
    if (position === 'after') {
      target.insertAdjacentElement('afterend', wrapper);
    } else if (position === 'before') {
      target.insertAdjacentElement('beforebegin', wrapper);
    } else if (position === 'appendChild') {
      target.appendChild(wrapper);
    }
  }

  // ── PixVerse: Quality → Resolution slot ──
  moveWrapper('pixverseQuality',    'pixverseQualityRow',   'wanResRow',       'after');

  // ── Resolution extracts: models whose Resolution was hidden inside a
  //    per-family psec container (or inside grokVideoParams mode-first block)
  //    extract to the unified Resolution slot at `wanResRow`.  After this
  //    block the core Resolution slot order is:
  //      videoResInfoRow → veoResRow → lumaResRow → wanResRow
  //      → pixverseQualityRow → grokResolutionRow
  //      → sd2ResolutionRow → wan27eResolutionRow → wan27vResolutionRow
  //    Only one is visible at a time; show/hide in _vpApplyUnifiedLayer.
  moveWrapper('wan27vResolution',   'wan27vResolutionRow',  'wanResRow',       'after');
  moveWrapper('wan27eResolution',   'wan27eResolutionRow',  'wanResRow',       'after');
  moveWrapper(null,                 'sd2ResolutionRow',     'wanResRow',       'after');
  moveWrapper(null,                 'grokResolutionRow',    'wanResRow',       'after');

  // ── WAN 2.7e Aspect ratio → common Aspect slot ──
  // WAN 2.7e has its own aspect switcher (Auto/16:9/9:16/1:1/4:3/3:4) while
  // other models share videoAspectRatio.  Extract to sit right after the
  // common Aspect row; visibility in _vpApplyUnifiedLayer.
  moveWrapper('wan27eAspect',       'wan27eAspectRow',      'videoAspectRow',  'after');
}

// Extract bottom toggles (multi-clip, off-peak) and append them to vpParams.
// Called AFTER Count + Audio are already at the bottom, so these land even
// lower — right above Save to folder (per Petr spec).
function _vpExtractBottomToggles() {
  const vpParams = document.getElementById('vpParams');
  if (!vpParams) return;

  function appendWrapperAtEnd(elId, newWrapperId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const wrapper = el.closest('.ctrl');
    if (!wrapper) return;
    if (!wrapper.id) wrapper.id = newWrapperId;
    vpParams.appendChild(wrapper);  // to the very bottom
  }

  // PixVerse multi-clip + off-peak → bottom (order: multi-clip first, then off-peak)
  appendWrapperAtEnd('pixverseMultiClip', 'pixverseMultiClipRow');
  appendWrapperAtEnd('pixverseOffPeak',   'pixverseOffPeakRow');

  // v224en: Luma Loop + Color mode → bottom toggles.
  //   Previously inside lumaVideoParams which was hidden for Ray2/Ray2-Flash
  //   (only Ray3+ showed the panel), so Loop — supported by Ray2 — never
  //   appeared.  Per Petr: "Loop a color mod bych nechal dole".
  //   Visibility is per-model: lumaLoopRow for m.supportsLoop,
  //   lumaColorModeRow for m.supportsHdr (see _vpApplyUnifiedLayer block 2i).
  appendWrapperAtEnd('lumaLoop',      'lumaLoopRow');
  appendWrapperAtEnd('lumaColorMode', 'lumaColorModeRow');

  // v225en: pixverseParams + lumaVideoParams + seedance2Params shells removed
  //   from template.html.  No post-extraction hide needed.
}

// Handler for the unified mode select — routes to the existing
// onKlingVersionChange() which handles Kling/PixVerse/Vidu groups uniformly.
function onVpModeChange(value) {
  const klingSel = document.getElementById('klingVersionSelect');
  if (klingSel) klingSel.value = value;
  if (typeof onKlingVersionChange === 'function') onKlingVersionChange(value);
}

// AI prompt button in the unified panel — the legacy ✦ AI Prompt button
// has been moved into vpPromptSection's plabel by _vpEnsureDomMoves (it
// opens the full openAiPromptModal).  This function stays as a fallback
// in case DOM moves fail.
function vpAiPrompt() {
  if (typeof openAiPromptModal === 'function') openAiPromptModal();
  else if (typeof toast === 'function') toast('AI prompt not available', 'err');
}

// Negative prompt toggle for the unified panel — for minimal layer the section
// is hidden, but the onclick is still referenced from HTML; keep it as a noop
// that logs nothing (safe if clicked).
function vpToggleNegPrompt() {
  const body  = document.getElementById('vpNegPromptBody');
  const caret = document.getElementById('vpNegPromptCaret');
  if (!body || !caret) return;
  const open = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  caret.textContent  = open ? '▾' : '▸';
}

// Stubs for vp* handlers referenced in the HTML but not active in minimal layer —
// keep them defined so onclick attributes don't throw ReferenceError.
function vpRefsFileSelected(_files)   { /* not active in minimal layer */ }
function vpPickSourceVideo()           { /* not active in minimal layer */ }
function vpDescribeSourceVideo()       { /* not active in minimal layer */ }
function vpClearSourceVideo()          { /* not active in minimal layer */ }
function updateVpResInfo()             { /* not active in minimal layer */ }


// ── Veo ref mode change — update ref panel accordingly ───
function onVeoRefModeChange(mode) {
  const refSec = document.getElementById('videoRefSection');
  const refLabel = document.getElementById('videoRefLabel');
  const refCount = document.getElementById('videoRefCount');
  const refNote = document.getElementById('veoRefNote');
  const needsRefs = mode !== 't2v';
  if (refSec) refSec.style.display = needsRefs ? 'block' : 'none';

  const maxRefs = mode === 'frames' ? 2 : mode === 'ingredients' ? 3 : 1;
  // Clip refs to new mode's maxRefs (don't clear — preserve refs when switching modes)
  if (videoRefs.length > maxRefs) videoRefs = videoRefs.slice(0, maxRefs);
  if (refLabel) refLabel.childNodes[0].textContent =
    mode === 'i2v'          ? 'Start frame' :
    mode === 'frames'       ? 'Start frame + End frame' :
    mode === 'ingredients'  ? 'Reference images (up to 3)' : '';
  if (refCount) refCount.textContent = `${videoRefs.length} / ${maxRefs}`;

  const noteText =
    mode === 'frames'      ? 'Add start frame first, then end frame.' :
    mode === 'ingredients' ? 'Up to 3 asset images — character, object, or style.' : '';
  if (refNote) { refNote.textContent = noteText; refNote.style.display = noteText ? 'block' : 'none'; }

  // Patch VIDEO_MODELS entry so ref panel uses correct maxRefs
  const modelKey = getActiveVideoModelKey();
  const m = VIDEO_MODELS[modelKey];
  if (m?.type === 'veo') {
    m.refMode = needsRefs ? 'single' : 'none';
    m.maxRefs = maxRefs;
  }
  renderVideoRefPanel();
  updateVideoResInfo();
}

function onVeoResolutionChange() {
  // v225en: reads unified via getUnifiedResolution; legacy veoResolution
  // select + veoResNote removed from DOM.  Called from:
  //   - _applyVideoModel on Veo model switch (to apply initial side effects)
  //   - _applyResolutionSideEffects when user clicks a unified Resolution button
  const res = (typeof getUnifiedResolution === 'function' ? getUnifiedResolution() : null) || '720p';
  // 1080p and 4K require 8s duration — force slider to 8 and disable it.
  const needsForce8 = (res === '1080p' || res === '4k');
  const slider = document.getElementById('videoDuration');
  const valLbl = document.getElementById('videoDurVal');
  if (slider) {
    if (needsForce8) {
      slider.value = 8;
      slider.disabled = true;
      if (valLbl) valLbl.textContent = '8s';
    } else {
      slider.disabled = false;
    }
  }
  updateVideoResInfo();
}

function updateVideoResInfo() {
  // v225en: videoResInfo span removed from DOM.  All Resolution display
  // handled by unified switcher's info label.  This function remains as
  // a public entry point for external onchange handlers (e.g. aspect
  // select calls it) — simply refreshes the unified info.
  if (typeof updateResolutionInfo === 'function') updateResolutionInfo();
}

// ═══════════════════════════════════════════════════════════
// UNIFIED DURATION SLIDER (v221en)
// ═══════════════════════════════════════════════════════════
// videoDurRow is the single Duration UI for all video models.  Per-model
// slider range/step/default and optional Auto (Seedance 2.0) / Match source
// (WAN 2.7e) checkboxes come from DURATION_CONFIG_BY_TYPE.  Legacy per-family
// inputs (#lumaDuration radios, #wan27vDuration, #wan27eDuration, #sd2Duration,
// #grokVideoDur) are kept hidden in DOM and mirrored on slider change so
// existing generate/reuse code continues to work without any rewrites.

function configureDurationSlider(model) {
  const modelType = model?.type;
  const baseCfg = DURATION_CONFIG_BY_TYPE[modelType];
  if (!baseCfg || !model) return;
  // Merge per-model overrides (m.maxDur/m.minDur/m.durOptions/m.defaultDur)
  // onto the per-type base config.  Keeps pre-v221en model data working.
  const cfg = {
    min:     (typeof model.minDur === 'number') ? model.minDur : baseCfg.min,
    max:     (typeof model.maxDur === 'number') ? model.maxDur : baseCfg.max,
    step:    baseCfg.step,
    default: (typeof model.defaultDur === 'number') ? model.defaultDur : baseCfg.default,
    allowed: (Array.isArray(model.durOptions) && model.durOptions.length > 0)
             ? model.durOptions : baseCfg.allowed,
    autoCheckbox: baseCfg.autoCheckbox,
    matchSource:  baseCfg.matchSource,
  };
  const slider   = document.getElementById('videoDuration');
  const valLbl   = document.getElementById('videoDurVal');
  const minLbl   = document.getElementById('videoDurMinLbl');
  const maxLbl   = document.getElementById('videoDurMaxLbl');
  const autoLbl  = document.getElementById('videoDurAutoLbl');
  const matchLbl = document.getElementById('videoDurMatchLbl');
  const autoCb   = document.getElementById('videoDurAuto');
  const matchCb  = document.getElementById('videoDurMatch');
  const durNote  = document.getElementById('videoDurNote');
  if (!slider) return;

  slider.min  = cfg.min;
  slider.max  = cfg.max;
  // Compute step: if allowed values are uniform spacing (e.g. [5, 10], [5, 9]),
  // use that spacing so slider has exactly N positions.  Non-uniform (e.g. Grok
  // [3,5,8,10,12,15]) falls back to step 1 + snap-on-release.
  let effectiveStep = cfg.step;
  if (cfg.allowed && cfg.allowed.length >= 2) {
    const diffs = [];
    for (let i = 1; i < cfg.allowed.length; i++) diffs.push(cfg.allowed[i] - cfg.allowed[i - 1]);
    const uniform = diffs.every(d => d === diffs[0]);
    if (uniform) effectiveStep = diffs[0];
  }
  slider.step = effectiveStep;

  // v225en: Initial value from config default (legacy per-family inputs removed).
  //   Reuse path calls setUnifiedDuration BEFORE configureDurationSlider, so
  //   slider value is set to the reused value before we read it here.  If
  //   slider already has a value (set by reuse or prior user interaction),
  //   preserve it within valid range; else use cfg.default.
  const currentSliderVal = parseInt(slider.value);
  let initialVal = !isNaN(currentSliderVal) && currentSliderVal > 0
    ? currentSliderVal
    : cfg.default;

  // Snap to allowed values (discrete durOptions or Grok [3,5,8,10,12,15]).
  if (cfg.allowed) initialVal = _snapToAllowed(initialVal, cfg.allowed);
  // Clamp to range.
  initialVal = Math.max(cfg.min, Math.min(cfg.max, initialVal));

  slider.value = initialVal;
  slider.disabled = false;
  if (minLbl) minLbl.textContent = cfg.min + 's';
  if (maxLbl) maxLbl.textContent = cfg.max + 's';

  // Auto checkbox visibility — Seedance 2.0 only.
  if (autoLbl) autoLbl.style.display = cfg.autoCheckbox ? 'inline-flex' : 'none';
  // Match-source checkbox visibility — WAN 2.7e only.
  if (matchLbl) matchLbl.style.display = cfg.matchSource ? 'inline-flex' : 'none';

  // Initial checkbox state: reset to off on model switch (reuse path sets
  // them back if needed via setUnifiedDurationAuto / setUnifiedDurationMatchSource).
  if (autoCb)  autoCb.checked = false;
  if (matchCb) matchCb.checked = false;

  // Update value label.
  if (valLbl) {
    valLbl.textContent = initialVal + 's';
  }

  // v222en: Note element was showing "Allowed: 1s / 2s / ..." which was
  // inaccurate for snap-based configs (e.g. Grok shows wrong values because
  // merged durOptions came from elsewhere) and redundant for continuous ones
  // (min/max labels already convey range).  Keep element empty.
  if (durNote) durNote.textContent = '';
}

function _snapToAllowed(val, allowed) {
  let best = allowed[0];
  let bestDiff = Math.abs(best - val);
  for (const a of allowed) {
    const d = Math.abs(a - val);
    if (d < bestDiff) { best = a; bestDiff = d; }
  }
  return best;
}

// v225en: legacy per-family Duration inputs removed from DOM.  Unified slider
// (#videoDuration) is the single source of truth.  configureDurationSlider
// reads initial value from DURATION_CONFIG_BY_TYPE[type].default (or model
// override m.defaultDur).  Generate reads getUnifiedDuration().

// onchange handler for unified slider.
function _onUnifiedDurChange() {
  const slider = document.getElementById('videoDuration');
  const valLbl = document.getElementById('videoDurVal');
  const key = getActiveVideoModelKey();
  const m = VIDEO_MODELS[key];
  if (!slider || !m) return;

  // Snap to allowed (Grok) on user input.
  const cfg = DURATION_CONFIG_BY_TYPE[m.type];
  if (cfg?.allowed) {
    const snapped = _snapToAllowed(parseInt(slider.value) || cfg.default, cfg.allowed);
    if (slider.value != snapped) slider.value = snapped;
  }

  const autoCb  = document.getElementById('videoDurAuto');
  const matchCb = document.getElementById('videoDurMatch');
  const showAuto  = cfg?.autoCheckbox && autoCb?.checked;
  const showMatch = cfg?.matchSource  && matchCb?.checked;
  if (valLbl) valLbl.textContent = showAuto ? 'auto' : (showMatch ? 'match source' : slider.value + 's');

  updateVideoResInfo();
}

// onchange for Auto checkbox (Seedance 2.0).
function _onUnifiedDurAutoChange() {
  const slider = document.getElementById('videoDuration');
  const autoCb = document.getElementById('videoDurAuto');
  const valLbl = document.getElementById('videoDurVal');
  if (!slider || !autoCb) return;
  slider.disabled = autoCb.checked;
  if (valLbl) valLbl.textContent = autoCb.checked ? 'auto' : slider.value + 's';
}

// onchange for Match source checkbox (WAN 2.7e).
function _onUnifiedDurMatchChange() {
  const slider  = document.getElementById('videoDuration');
  const matchCb = document.getElementById('videoDurMatch');
  const valLbl  = document.getElementById('videoDurVal');
  if (!slider || !matchCb) return;
  slider.disabled = matchCb.checked;
  if (valLbl) valLbl.textContent = matchCb.checked ? 'match source' : slider.value + 's';
}

// ═══════════════════════════════════════════════════════════
// UNIFIED RESOLUTION SWITCHER (v223en, v225en: legacy mirror removed)
// ═══════════════════════════════════════════════════════════
// Single segmented-buttons component for all video models with resolution
// choice.  Source of truth: the button with `.active` class (its data-val
// attribute).  v225en: legacy <select>/<input> elements deleted from DOM;
// generate/reuse code reads via getUnifiedResolution() / setUnifiedResolution().
// Per-model remembered value stored in _lastResolutionByType — survives
// model switches within the same family (e.g. switching between Veo variants
// keeps your 4K selection).

const _lastResolutionByType = {};  // { 'veo': '4k', 'pixverse_video': '1080p', ... }

// Footer hints for the unified source-video slot (shown under buttons).
const _UNIFIED_SRC_NOTES = {
  wan27e_video: 'Source video required · Must be <10s · Optional ref image below for style guidance',
  wan27_video:  'Optional — continue from last frame of this video',
  grok_video:   'Click ▷ Use on any video in the gallery to set it here',
  kling_video:  'Motion will be transferred to the character image in Refs below',
};

function configureResolutionSwitcher(m) {
  const row       = document.getElementById('unifiedResRow');
  const buttonsEl = document.getElementById('unifiedResButtons');
  const infoEl    = document.getElementById('unifiedResInfo');
  if (!row || !buttonsEl) return;

  if (!m) {
    row.style.display = 'none';
    return;
  }

  const cfg = RESOLUTION_CONFIG_BY_TYPE[m.type];
  if (!cfg) {
    // No user-chosen Resolution for this family (Kling, Vidu, Seedance 1.5).
    // Show a read-only info line with the fixed resolution.
    row.style.display = '';
    // Priority: explicit m.resolution field (Seedance 1.5 Pro, Vidu Q3 have
    // `resolution: '720p'`); Kling variants don't have the field but their
    // key contains `_pro` (1080p) or `_std` (720p).  Fallback: 720p.
    let fixed = m.resolution || m.fixedResolution;
    if (!fixed) {
      const key = getActiveVideoModelKey();
      if (key.includes('_pro') || /master|o3/i.test(key)) {
        fixed = '1080p';
      } else {
        fixed = '720p';
      }
    }
    // Render fixed label as single disabled-looking button (data-val for read).
    buttonsEl.innerHTML = `<div class="seg-btn active" data-val="${fixed}" style="cursor:default;">${fixed}</div>`;
    updateResolutionInfo();
    return;
  }

  // Resolutions list: prefer cfg.resolutions, fallback to per-model fields.
  let resolutions = cfg.resolutions;
  if (!resolutions) {
    if (m.type === 'pixverse_video' && Array.isArray(m.qualityOptions)) {
      resolutions = m.qualityOptions;
    } else if (Array.isArray(m.resolutions)) {
      resolutions = m.resolutions;
    }
  }
  if (!resolutions || resolutions.length === 0) {
    row.style.display = 'none';
    return;
  }

  // Current value: prefer per-type remembered value, fallback to default.
  let currentVal = _lastResolutionByType[m.type];
  if (!currentVal || !resolutions.includes(currentVal)) {
    // Prefer 1080p if available (matches old default for Veo/WAN/etc),
    // else 720p, else first option.
    currentVal = resolutions.includes('1080p') ? '1080p'
               : resolutions.includes('720p')  ? '720p'
               : resolutions[0];
  }
  _lastResolutionByType[m.type] = currentVal;

  // Render buttons.
  buttonsEl.innerHTML = resolutions.map(val => {
    const label = (cfg.labels && cfg.labels[val]) || val;
    const isActive = val === currentVal ? ' active' : '';
    return `<button type="button" class="seg-btn${isActive}" data-val="${val}" onclick="_onUnifiedResClick('${val}')">${label}</button>`;
  }).join('');

  row.style.display = '';
  updateResolutionInfo();

  // Apply side effects for initial value (e.g. Veo 4K → force duration 8s).
  _applyResolutionSideEffects(m, currentVal);
}

// Click handler for segmented Resolution buttons.
function _onUnifiedResClick(value) {
  const key = getActiveVideoModelKey();
  const m = VIDEO_MODELS[key];
  if (!m) return;
  // Remember per-type selection.
  _lastResolutionByType[m.type] = value;
  // Update active class on buttons.
  const buttonsEl = document.getElementById('unifiedResButtons');
  if (buttonsEl) {
    buttonsEl.querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === value);
    });
  }
  updateResolutionInfo();
  _applyResolutionSideEffects(m, value);
}

// Per-model side effects triggered by resolution change.  Replaces the
// legacy dispatch-change-on-legacy-select pattern.
function _applyResolutionSideEffects(m, value) {
  if (m.type === 'veo') {
    // Veo: 1080p and 4K require 8s duration — force slider + disable.
    const needsForce8 = (value === '1080p' || value === '4k');
    const slider = document.getElementById('videoDuration');
    const valLbl = document.getElementById('videoDurVal');
    if (slider) {
      if (needsForce8) {
        slider.value = 8;
        slider.disabled = true;
        if (valLbl) valLbl.textContent = '8s';
      } else {
        slider.disabled = false;
      }
    }
  } else if (m.type === 'seedance2_video') {
    // Seedance Fast tier doesn't support 1080p — snap back to 720p if needed.
    // (Only matters when switching from Std to Fast while 1080p was selected.
    // Guarded by the Fast-tier variant having no '1080p' in m.resolutions.)
    const allowed = m.resolutions || ['720p'];
    if (!allowed.includes(value)) {
      _lastResolutionByType[m.type] = allowed.includes('720p') ? '720p' : allowed[0];
    }
  }
}

// ─── Public API: getUnifiedResolution / setUnifiedResolution ───────
// Read the currently selected resolution (string like '720p', '1080p', '4k').
// Returns null if no model active or no selection.
function getUnifiedResolution() {
  const btn = document.querySelector('#unifiedResButtons .seg-btn.active');
  return btn?.dataset.val || null;
}

// Programmatically set resolution (e.g. during reuse).  Updates button state,
// remembered value, info label, and applies side effects.
function setUnifiedResolution(value) {
  if (!value) return;
  const key = getActiveVideoModelKey();
  const m = VIDEO_MODELS[key];
  if (!m) return;
  _lastResolutionByType[m.type] = value;
  const buttonsEl = document.getElementById('unifiedResButtons');
  if (buttonsEl) {
    let found = false;
    buttonsEl.querySelectorAll('.seg-btn').forEach(btn => {
      const match = btn.dataset.val === value;
      btn.classList.toggle('active', match);
      if (match) found = true;
    });
    if (!found) return;  // value not valid for current model
  }
  updateResolutionInfo();
  _applyResolutionSideEffects(m, value);
}

// Update the "1280×720 · 16:9" info line based on active button + aspect.
function updateResolutionInfo() {
  const infoEl = document.getElementById('unifiedResInfo');
  if (!infoEl) return;
  const key = getActiveVideoModelKey();
  const m = VIDEO_MODELS[key];
  if (!m) { infoEl.textContent = ''; return; }
  const res = getUnifiedResolution()
           || m.resolution
           || m.fixedResolution
           || (key.includes('_pro') || /master|o3/i.test(key) ? '1080p' : '720p');
  if (!res) { infoEl.textContent = ''; return; }
  // Aspect: WAN 2.7e uses its own dropdown; others use common videoAspectRatio.
  let aspect;
  if (m.type === 'wan27e_video') {
    const a = document.getElementById('wan27eAspect')?.value;
    aspect = (a && a !== 'auto') ? a : '16:9';
  } else {
    aspect = document.getElementById('videoAspectRatio')?.value || '16:9';
  }
  const { width, height } = computeVideoDimensions(res, aspect);
  infoEl.textContent = `${width}×${height} · ${aspect}`;
}

// ─── Public API: getUnifiedDuration / setUnifiedDuration ───────────
// Source of truth: #videoDuration slider (+ Auto checkbox for Seedance 2.0,
// Match source checkbox for WAN 2.7e).  Generate/reuse use these helpers.
function getUnifiedDuration() {
  const slider = document.getElementById('videoDuration');
  return parseInt(slider?.value || '5');
}

function setUnifiedDuration(value) {
  const n = parseInt(value);
  if (isNaN(n)) return;
  const slider = document.getElementById('videoDuration');
  const valLbl = document.getElementById('videoDurVal');
  if (slider) {
    slider.value = String(n);
    if (valLbl) valLbl.textContent = n + 's';
  }
}

// Auto checkbox (Seedance 2.0) — true when unified slider shows "auto".
function getUnifiedDurationAuto() {
  return !!document.getElementById('videoDurAuto')?.checked;
}
function setUnifiedDurationAuto(val) {
  const cb = document.getElementById('videoDurAuto');
  if (cb) cb.checked = !!val;
}

// Match source checkbox (WAN 2.7e).
function getUnifiedDurationMatchSource() {
  return !!document.getElementById('videoDurMatch')?.checked;
}
function setUnifiedDurationMatchSource(val) {
  const cb = document.getElementById('videoDurMatch');
  if (cb) cb.checked = !!val;
}

// ── Seed (v226en) — single #unifiedSeed for wan27 / wan27e / pixverse / seedance2.
// Returns trimmed string value ('' → null) so callers can do parseInt() or pass as-is.
function getUnifiedSeed() {
  const raw = document.getElementById('unifiedSeed')?.value?.trim();
  return raw || null;
}
function setUnifiedSeed(val) {
  const el = document.getElementById('unifiedSeed');
  if (!el) return;
  // Accept null/undefined/number/string; write empty for null-ish, else string.
  el.value = (val === null || val === undefined || val === '') ? '' : String(val);
}

// ── Safety (v227en) — single #unifiedSafety checkbox for wan27 / wan27e.
// fal.ai "safety checker" flag, defaults to true.  Returns boolean; semantics
// match legacy `!== false` reads (missing/undefined → treated as true).
function getUnifiedSafety() {
  const el = document.getElementById('unifiedSafety');
  if (!el) return true;  // default if DOM not ready
  return el.checked !== false;
}
function setUnifiedSafety(val) {
  const el = document.getElementById('unifiedSafety');
  if (!el) return;
  // Match legacy semantics: any falsy value except explicit false keeps checked.
  // null/undefined = default true, explicit false = uncheck, truthy = check.
  el.checked = (val !== false);
}

// ── Audio URLs — up to 3 slots (per-model count via audioSlots()).
// getUnifiedAudioUrl(idx)  → string or '' for empty
// setUnifiedAudioUrl(idx, v) → write to input
function getUnifiedAudioUrl(idx) {
  const el = document.getElementById('unifiedAudioUrl' + (idx + 1));
  return el?.value?.trim() || '';
}
function setUnifiedAudioUrl(idx, val) {
  const el = document.getElementById('unifiedAudioUrl' + (idx + 1));
  if (el) el.value = val || '';
}

function initVideoCountHighlight() {
  document.querySelectorAll('input[name="videoCount"]').forEach(r => {
    r.addEventListener('change', updateVideoCountHighlight);
  });
  updateVideoCountHighlight();
}

function updateVideoCountHighlight() {
  document.querySelectorAll('input[name="videoCount"]').forEach(r => {
    const lbl = r.closest('label');
    if (lbl) {
      lbl.style.borderColor = r.checked ? 'var(--accent)' : 'var(--border)';
      lbl.style.color = r.checked ? 'var(--accent)' : 'var(--dim)';
    }
  });
}

async function callVeoVideo(job) {
  const { model, prompt, aspectRatio, googleKey, veoResolution = '720p',
          veoRefMode = 't2v', veoDuration = 8 } = job;

  const BASE = 'https://generativelanguage.googleapis.com/v1beta';
  const headers = { 'x-goog-api-key': googleKey, 'Content-Type': 'application/json' };

  // Build instance based on veoRefMode
  const instance = { prompt };

  if (veoRefMode === 'i2v' && videoRefs.length > 0) {
    const r0 = videoRefs[0];
    const asset = r0.assetId ? await dbGet('assets', r0.assetId) : null;
    const imgData = asset?.imageData || r0.data;
    const mime = asset?.mimeType || r0.mimeType || 'image/jpeg';
    if (imgData) instance.image = { bytesBase64Encoded: imgData, mimeType: mime };
  } else if (veoRefMode === 'frames') {
    if (videoRefs[0]) {
      const r0 = videoRefs[0];
      const a0 = r0.assetId ? await dbGet('assets', r0.assetId) : null;
      const d0 = a0?.imageData || r0.data;
      if (d0) instance.image = { bytesBase64Encoded: d0, mimeType: a0?.mimeType || r0.mimeType || 'image/jpeg' };
    }
    if (videoRefs[1]) {
      const r1 = videoRefs[1];
      const a1 = r1.assetId ? await dbGet('assets', r1.assetId) : null;
      const d1 = a1?.imageData || r1.data;
      if (d1) instance.lastFrame = { bytesBase64Encoded: d1, mimeType: a1?.mimeType || r1.mimeType || 'image/jpeg' };
    }
  } else if (veoRefMode === 'ingredients' && videoRefs.length > 0) {
    const loaded = await Promise.all(videoRefs.slice(0, 3).map(async r => {
      if (r.assetId) return dbGet('assets', r.assetId);
      if (r.data) return { imageData: r.data, mimeType: r.mimeType || 'image/jpeg' };
      return null;
    }));
    instance.referenceImages = loaded
      .filter(a => a?.imageData)
      .map(a => ({
        image: { inlineData: { mimeType: a.mimeType || 'image/jpeg', data: a.imageData } },
        referenceType: 'asset',
      }));
  }

  // Parameters — NO generateAudio (unsupported, Veo always generates audio automatically)
  // Constraint: 1080p and 4K require 8s duration (API returns 400 otherwise)
  const effectiveDuration = (veoResolution === '1080p' || veoResolution === '4k') ? 8 : veoDuration;
  const parameters = {
    aspectRatio,
    durationSeconds: effectiveDuration,
    resolution: veoResolution,
    sampleCount: 1,
  };

  updateVideoPlaceholderStatus(job, 'SUBMITTING…');

  const submitRes = await fetch(`${BASE}/models/${model.modelId}:predictLongRunning`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ instances: [instance], parameters }),
  });
  if (!submitRes.ok) {
    let errText = '';
    try { errText = await submitRes.text(); } catch(e) {}
    throw new Error(`Veo submit ${submitRes.status}: ${errText.slice(0, 300)}`);
  }
  const submitData = await submitRes.json();
  const operationName = submitData.name;
  if (!operationName) throw new Error(`No operation name: ${JSON.stringify(submitData).slice(0, 200)}`);

  job.status = 'queued';
  renderVideoQueue();
  updateVideoPlaceholderStatus(job, 'IN QUEUE…');

  const POLL_INTERVAL = 10000;
  const deadline = Date.now() + VIDEO_POLL.timeoutMin.veo * 60 * 1000;

  await new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) { reject(new Error(`Veo timeout after ${VIDEO_POLL.timeoutMin.veo} minutes`)); return; }
      if (job.cancelled) { reject(new Error('Cancelled')); return; }
      try {
        const pollRes = await fetch(`${BASE}/${operationName}`, { headers: { 'x-goog-api-key': googleKey } });
        if (!pollRes.ok) { setTimeout(poll, POLL_INTERVAL); return; }
        const pollData = await pollRes.json();
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
        if (pollData.done) {
          if (pollData.error) { reject(new Error(pollData.error.message || 'Veo generation failed')); return; }
          resolve(); return;
        }
        job.status = 'running';
        renderVideoQueue();
        updateVideoPlaceholderStatus(job, `GENERATING · ${elapsed}s`);
        setTimeout(poll, POLL_INTERVAL);
      } catch(e) { setTimeout(poll, POLL_INTERVAL); }
    };
    setTimeout(poll, POLL_INTERVAL);
  });

  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');

  const finalRes = await fetch(`${BASE}/${operationName}`, { headers: { 'x-goog-api-key': googleKey } });
  if (!finalRes.ok) throw new Error(`Veo result fetch failed: ${finalRes.status}`);
  const finalData = await finalRes.json();

  const videoUri = finalData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!videoUri) throw new Error(`No video URI in Veo result: ${JSON.stringify(finalData).slice(0, 300)}`);

  const videoRes = await fetch(videoUri, { headers: { 'x-goog-api-key': googleKey } });
  if (!videoRes.ok) throw new Error(`Veo video download failed: ${videoRes.status}`);
  const videoArrayBuffer = await videoRes.arrayBuffer();

  const { elapsed } = await _saveVideoResult(videoArrayBuffer, {
    model: model.name, modelKey: job.modelKey, prompt: job.prompt,
    params: { duration: effectiveDuration, aspectRatio: job.aspectRatio, resolution: veoResolution, veoRefMode },
    duration: effectiveDuration,
    cdnUrl: videoUri,
  }, job, ['google', model.modelId, 1, effectiveDuration]);
  toast(`Veo video generated · ${elapsed}s`, 'ok');
}

//       GIS downloads MP4 directly from Luma CDN
async function callLumaVideo(job) {
  const {
    model, modelKey, prompt, aspectRatio, lumaKey, proxyUrl, targetFolder,
    lumaResolution, lumaDurationSel, lumaLoop, lumaColorMode, lumaCharRefAssetId,
    videoRefsSnapshot,
  } = job;

  if (!lumaKey)  throw new Error('Missing Luma API key');
  if (!proxyUrl) throw new Error('Missing proxy URL');

  job.status = 'submitting';
  updateVideoPlaceholderStatus(job, 'UPLOADING REFS…');

  // Load keyframe images from assets DB
  const refs = videoRefs; // live refs at time of submit
  const frame0Asset = refs[0]?.assetId ? await dbGet('assets', refs[0].assetId) : null;
  const frame1Asset = refs[1]?.assetId ? await dbGet('assets', refs[1].assetId) : null;
  const charAsset   = lumaCharRefAssetId ? await dbGet('assets', lumaCharRefAssetId) : null;

  // Build submit payload
  const submitBody = {
    luma_key:     lumaKey,
    model:        model.modelId,
    prompt,
    aspect_ratio: aspectRatio,
    resolution:   lumaResolution || '1080p',
    duration:     lumaDurationSel || '5s',
    loop:         !!lumaLoop,
  };
  if (frame0Asset?.imageData) {
    submitBody.frame0_b64  = frame0Asset.imageData;
    submitBody.frame0_mime = frame0Asset.mimeType || 'image/jpeg';
  }
  if (frame1Asset?.imageData) {
    submitBody.frame1_b64  = frame1Asset.imageData;
    submitBody.frame1_mime = frame1Asset.mimeType || 'image/jpeg';
  }
  if (charAsset?.imageData) {
    submitBody.char_ref_b64  = charAsset.imageData;
    submitBody.char_ref_mime = charAsset.mimeType || 'image/jpeg';
  }
  // HDR / EXR — Ray3 only, T2V and I2V only (not if Modify)
  if (model.supportsHdr && lumaColorMode && lumaColorMode !== 'sdr') {
    submitBody.color_mode = lumaColorMode;
  }

  // Submit to Worker
  const submitResp = await fetch(`${proxyUrl}/luma/video/submit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(submitBody),
  });
  if (!submitResp.ok) {
    const err = await submitResp.json().catch(() => ({}));
    throw new Error(`Luma submit ${submitResp.status}: ${err.detail || err.error || submitResp.statusText}`);
  }
  const { generation_id } = await submitResp.json();
  if (!generation_id) throw new Error('Luma: no generation_id from Worker');

  job.status = 'generating';
  updateVideoPlaceholderStatus(job, 'GENERATING…');

  // Poll for completion via shared helper (v206en cleanup #3)
  const status = await _videoPollLoop(job, {
    label:      'Luma video',
    timeoutMin: VIDEO_POLL.timeoutMin.luma,
    pollMs:     VIDEO_POLL.defaultMs,
    poll: async () => {
      const statusResp = await fetch(`${proxyUrl}/luma/video/status`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ luma_key: lumaKey, generation_id }),
      });
      if (!statusResp.ok) {
        const err = await statusResp.json().catch(() => ({}));
        throw new Error(`Luma status ${statusResp.status}: ${err.error || statusResp.statusText}`);
      }
      const s = await statusResp.json();
      if (s.status === 'failed') return { status: 'failed', error: `Luma generation failed: ${s.error || 'unknown'}` };
      if (s.status === 'done')   return { status: 'done', data: s };
      return { status: 'running' };
    },
  });

  if (!status.video_url) throw new Error('Luma: done but no video_url');

  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');

  // Download MP4 directly from Luma CDN (Worker never downloads video)
  const videoRes = await fetch(status.video_url);
  if (!videoRes.ok) throw new Error(`Luma video download failed (${videoRes.status})`);
  const videoArrayBuffer = await videoRes.arrayBuffer();
  const durSec = parseInt(lumaDurationSel || '5');

  const { elapsed } = await _saveVideoResult(videoArrayBuffer, {
    model: model.name, modelKey, prompt,
    params: { aspectRatio, resolution: lumaResolution, duration: lumaDurationSel, loop: lumaLoop, colorMode: lumaColorMode },
    duration: durSec,
    cdnUrl: status.video_url,
    exrUrl: status.exr_url || null,
    usedVideoRefs: videoRefsSnapshot || [],
  }, job, ['luma', model.modelId, 1, durSec]);
  const exrNote = status.exr_url ? ' · EXR ↓' : '';
  toast(`Ray3 video generated · ${elapsed}s${exrNote}`, 'ok');
}

// ── PixVerse C1 video generation ─────────────────────────
// Flow: (I2V: GIS → Worker POST /pixverse/upload-image → img_id)
//       GIS → Worker POST /pixverse/t2v or /pixverse/i2v → { video_id }
//       GIS polls → Worker POST /pixverse/status → { status, video_url }
//       GIS downloads MP4 directly from PixVerse CDN
// Helper: upload a single image to PixVerse, returns img_id
async function _pixverseUpload(proxyUrl, pixverseKey, imgData, mimeType) {
  const resp = await fetch(`${proxyUrl}/pixverse/upload-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: pixverseKey, image_base64: imgData, mime_type: mimeType }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`PixVerse upload ${resp.status}: ${err.ErrMsg || err.error || resp.statusText}`);
  }
  const data = await resp.json();
  const imgId = data.Resp?.img_id;
  if (!imgId) throw new Error('PixVerse: no img_id — ' + JSON.stringify(data));
  return imgId;
}

async function callPixverseVideo(job) {
  const { model, modelKey, prompt, duration, aspectRatio, enableAudio, pixverseKey, proxyUrl, params } = job;

  if (!pixverseKey) throw new Error('Missing PixVerse API key');
  if (!proxyUrl)    throw new Error('Missing proxy URL');

  const quality   = getUnifiedResolution() || '720p';
  const negPrompt = document.getElementById('videoNegPrompt')?.value?.trim() || '';
  const seed      = (params?.seed != null) ? params.seed : undefined;
  const multiClip = document.getElementById('pixverseMultiClip')?.checked || false;
  const offPeak   = document.getElementById('pixverseOffPeak')?.checked || false;
  const durNum    = Math.max(model.minDur || 1, Math.min(model.maxDur || 15, parseInt(duration)));
  const pvMode    = model.pixverseMode || (model.refMode === 'single' ? 'i2v' : 't2v');
  const pvModelId = model.modelId || 'c1';

  // Build negative prompt — inject anti-cut phrase when multi-clip OFF and model doesn't support the switch
  let finalNeg = negPrompt;
  if (!multiClip && !model.supportsMultiClip && pvMode === 't2v' && !negPrompt.includes('no cuts')) {
    finalNeg = finalNeg ? finalNeg + ', single continuous shot, no cuts, no transitions' : 'single continuous shot, no cuts, no transitions';
  }

  // Shared fields for all modes
  const shared = {};
  if (finalNeg) shared.negative_prompt = finalNeg;
  if (seed != null) shared.seed = seed;
  // Multi-clip: only send for models that support it. API is INVERTED: true=single, false=multi
  if (model.supportsMultiClip) {
    shared.generate_multi_clip_switch = !multiClip; // invert: checkbox ON (want multi) → send false (API: multi)
  }
  shared.generate_audio_switch = !!enableAudio;
  if (offPeak) shared.off_peak_mode = true;

  job.status = 'submitting';
  updateVideoPlaceholderStatus(job, 'SUBMITTING…');

  let video_id;
  let endpoint;

  // ── Load ref image data from assets DB ──
  async function loadRefData(refIdx) {
    const ref = videoRefs[refIdx];
    if (!ref?.assetId) throw new Error(`PixVerse: ref ${refIdx + 1} missing`);
    const asset = await dbGet('assets', ref.assetId);
    if (!asset?.imageData) throw new Error(`Asset not found for ref ${refIdx + 1}`);
    return { imgData: asset.imageData, mimeType: asset.mimeType || ref.mimeType || 'image/png', label: ref.userLabel || ref.autoName || `ref${refIdx + 1}` };
  }

  if (pvMode === 'transition') {
    // ── Transition: upload 2 images → first_frame_img + last_frame_img ──
    if (videoRefs.length < 2) throw new Error('Transition requires 2 images (start + end frame)');
    updateVideoPlaceholderStatus(job, 'UPLOADING FRAMES…');
    const r0 = await loadRefData(0);
    const r1 = await loadRefData(1);
    const imgId0 = await _pixverseUpload(proxyUrl, pixverseKey, r0.imgData, r0.mimeType);
    const imgId1 = await _pixverseUpload(proxyUrl, pixverseKey, r1.imgData, r1.mimeType);

    endpoint = '/pixverse/transition';
    const payload = { apiKey: pixverseKey, prompt, model: pvModelId, duration: durNum, quality, first_frame_img: imgId0, last_frame_img: imgId1, ...shared };
    updateVideoPlaceholderStatus(job, 'SUBMITTING TRANSITION…');
    const resp = await fetch(`${proxyUrl}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(`PixVerse transition ${resp.status}: ${e.ErrMsg || e.error || resp.statusText}`); }
    const d = await resp.json();
    video_id = d.Resp?.video_id;
    if (!video_id) throw new Error('PixVerse: no video_id — ' + JSON.stringify(d));

  } else if (pvMode === 'fusion') {
    // ── Fusion: upload N images → image_references array ──
    if (videoRefs.length === 0) throw new Error('Fusion requires at least 1 reference image');
    updateVideoPlaceholderStatus(job, 'UPLOADING REFS…');
    const imageRefs = [];
    for (let i = 0; i < videoRefs.length; i++) {
      const r = await loadRefData(i);
      const imgId = await _pixverseUpload(proxyUrl, pixverseKey, r.imgData, r.mimeType);
      const label = r.label.toLowerCase();
      const type = (label.includes('[bg]') || label.includes('background') || label.includes('scene')) ? 'background' : 'subject';
      // PixVerse ref_name: simple alphanumeric only — use pic1, pic2... for reliability
      const refName = `pic${i + 1}`;
      imageRefs.push({ type, img_id: imgId, ref_name: refName });
    }

    // Auto-rewrite prompt: replace @RefLabel, @autoName, @ElementN with @picN
    let fusionPrompt = prompt;
    for (let i = 0; i < videoRefs.length; i++) {
      const ref = videoRefs[i];
      const picTag = `@pic${i + 1}`;
      // Replace known GIS mention patterns: @Ref_XXX, @UserLabel, @ElementN
      if (ref.userLabel) fusionPrompt = fusionPrompt.replace(new RegExp('@' + ref.userLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\// __GIS_JS__'), 'gi'), picTag);
      if (ref.autoName)  fusionPrompt = fusionPrompt.replace(new RegExp('@' + ref.autoName.replace(/[.*+?^${}()|[\]\\]/g, '\\// __GIS_JS__'), 'gi'), picTag);
      fusionPrompt = fusionPrompt.replace(new RegExp(`@Element${i + 1}\\b`, 'gi'), picTag);
      fusionPrompt = fusionPrompt.replace(new RegExp(`@Image${i + 1}\\b`, 'gi'), picTag);
    }
    // If no @picN found in prompt at all, append generic references
    if (!fusionPrompt.includes('@pic')) {
      const refTags = imageRefs.map(r => `@${r.ref_name}`).join(' and ');
      fusionPrompt = fusionPrompt + ` featuring ${refTags}`;
    }

    endpoint = '/pixverse/fusion';
    const payload = { apiKey: pixverseKey, image_references: imageRefs, prompt: fusionPrompt, model: pvModelId, duration: durNum, quality, aspect_ratio: aspectRatio, ...shared };
    updateVideoPlaceholderStatus(job, 'SUBMITTING FUSION…');
    const resp = await fetch(`${proxyUrl}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(`PixVerse fusion ${resp.status}: ${e.ErrMsg || e.error || resp.statusText}`); }
    const d = await resp.json();
    video_id = d.Resp?.video_id;
    if (!video_id) throw new Error('PixVerse: no video_id — ' + JSON.stringify(d));

  } else if (pvMode === 'i2v' && videoRefs.length > 0) {
    // ── I2V: upload 1 image → img_id ──
    updateVideoPlaceholderStatus(job, 'UPLOADING IMAGE…');
    const r0 = await loadRefData(0);
    const imgId = await _pixverseUpload(proxyUrl, pixverseKey, r0.imgData, r0.mimeType);

    endpoint = '/pixverse/i2v';
    const payload = { apiKey: pixverseKey, prompt, img_id: imgId, model: pvModelId, duration: durNum, quality, ...shared };
    updateVideoPlaceholderStatus(job, 'SUBMITTING I2V…');
    const resp = await fetch(`${proxyUrl}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(`PixVerse I2V ${resp.status}: ${e.ErrMsg || e.error || resp.statusText}`); }
    const d = await resp.json();
    video_id = d.Resp?.video_id;
    if (!video_id) throw new Error('PixVerse: no video_id — ' + JSON.stringify(d));

  } else {
    // ── T2V ──
    endpoint = '/pixverse/t2v';
    const payload = { apiKey: pixverseKey, prompt, model: pvModelId, duration: durNum, quality, aspect_ratio: aspectRatio, ...shared };
    const resp = await fetch(`${proxyUrl}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(`PixVerse T2V ${resp.status}: ${e.ErrMsg || e.error || resp.statusText}`); }
    const d = await resp.json();
    video_id = d.Resp?.video_id;
    if (!video_id) throw new Error('PixVerse: no video_id — ' + JSON.stringify(d));
  }

  // ── Poll for completion ──
  job.status = 'generating';
  updateVideoPlaceholderStatus(job, offPeak ? 'GENERATING (off-peak)…' : 'GENERATING…');

  // Poll via shared helper (v206en cleanup #3). PixVerse uses numeric status codes.
  const resp = await _videoPollLoop(job, {
    label:      `PixVerse video${offPeak ? ' (off-peak)' : ''}`,
    timeoutMin: offPeak ? VIDEO_POLL.timeoutMin.pixverseOffPeak : VIDEO_POLL.timeoutMin.pixverse,
    pollMs:     offPeak ? VIDEO_POLL.offPeakMs : VIDEO_POLL.defaultMs,
    poll: async () => {
      const statusResp = await fetch(`${proxyUrl}/pixverse/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: pixverseKey, video_id }),
      });
      if (!statusResp.ok) {
        const err = await statusResp.json().catch(() => ({}));
        throw new Error(`PixVerse status ${statusResp.status}: ${err.error || statusResp.statusText}`);
      }
      const sData = await statusResp.json();
      const r = sData.Resp || sData;
      const st = r.status;
      // PixVerse statuses: 1=done, 2/8=failed, 3/5=processing, 7=moderation, 9=queued
      if (st === 2 || st === 8) return { status: 'failed', error: `PixVerse generation failed: ${r.error_message || r.err_msg || 'unknown'}` };
      if (st === 7)             return { status: 'failed', error: 'PixVerse: content moderation failed — modify your prompt and retry' };
      if (st === 1)             return { status: 'done',   data: r };
      if (st === 9)             return { status: 'queued' };
      return { status: 'running' };
    },
  });

  const videoUrl = resp.url || resp.video_url;
  if (!videoUrl) throw new Error('PixVerse: done but no video URL');

  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`PixVerse video download failed (${videoRes.status})`);
  const videoArrayBuffer = await videoRes.arrayBuffer();

  const { elapsed } = await _saveVideoResult(videoArrayBuffer, {
    model: model.name, modelKey, prompt,
    params: { duration: durNum, aspectRatio, quality, enableAudio, multiClip, offPeak, negativePrompt: finalNeg, mode: pvMode },
    duration: durNum,
    cdnUrl: videoUrl,
    usedVideoRefs: job.videoRefsSnapshot || [],
  }, job, ['pixverse', '_pixverse_video', 1, durNum]);
  toast(`PixVerse C1 ${pvMode.toUpperCase()} generated · ${elapsed}s`, 'ok');
}

// T2V i I2V — sdílí stejnou funkci, falEndpoint rozlišuje
async function callWan27Video(job) {
  const { model, modelKey, prompt, targetFolder, falKey,
          videoRefsSnapshot, wan27vSnap, params } = job;

  if (!falKey) throw new Error('fal.ai API key missing. Add it in Setup tab.');

  const endpoint     = model.falEndpoint || 'fal-ai/wan/v2.7/image-to-video';
  const resolution   = wan27vSnap?.resolution    || '1080p';
  const duration     = wan27vSnap?.duration      || 5;
  const negPrompt    = params?.negativePrompt    || '';
  const promptExpand = true;
  const safety       = params?.safety !== false;
  const seed         = (params?.seed != null) ? params.seed : undefined;
  const audioUrl     = wan27vSnap?.audioUrl      || null;
  const extendVideoId = wan27vSnap?.extendVideoId || null;
  const isT2V        = model.refMode === 'none';
  const isR2V        = model.refMode === 'wan_r2v';

  const payload = {
    prompt:                   prompt || '',
    resolution,
    enable_prompt_expansion:  promptExpand,
    enable_safety_checker:    safety,
  };
  // R2V has no duration field — only T2V and I2V accept duration
  if (!isR2V) payload.duration = duration; // WAN 2.7 requires integer (not string like WAN 2.6)
  if (negPrompt)          payload.negative_prompt = negPrompt;
  if (seed !== undefined) payload.seed = seed;
  if (audioUrl)           payload.audio_url = audioUrl;

  if (isR2V) {
    // R2V: load character refs → reference_image_urls[] / reference_video_urls[]
    // videoRefsSnapshot contains image assets (pre-loaded with imageData)
    const imageRefs = [], videoRefs_ = [];
    for (const snap of (videoRefsSnapshot || [])) {
      if (snap.mimeType?.startsWith('video/')) {
        // Video ref — encode as data URI
        if (snap.imageData) videoRefs_.push(`data:${snap.mimeType};base64,${snap.imageData}`);
      } else {
        // Image ref
        let imgData = snap.imageData;
        if (!imgData && snap.assetId) {
          const asset = await dbGet('assets', snap.assetId);
          imgData = asset?.imageData;
        }
        if (imgData) {
          const compressed = await compressImageForUpload(imgData, snap.mimeType || 'image/jpeg');
          imageRefs.push(`data:${compressed.mimeType};base64,${compressed.data}`);
        }
      }
    }
    if (imageRefs.length > 0) payload.reference_image_urls = imageRefs;
    if (videoRefs_.length > 0) payload.reference_video_urls = videoRefs_;

  } else if (!isT2V) {
    // I2V: load refs as data URI
    const loadRef = async (snap) => {
      if (!snap) return null;
      let imgData = snap.imageData;
      if (!imgData && snap.assetId) {
        const asset = await dbGet('assets', snap.assetId);
        imgData = asset?.imageData;
      }
      if (!imgData) return null;
      const compressed = await compressImageForUpload(imgData, snap.mimeType || 'image/jpeg');
      return `data:${compressed.mimeType};base64,${compressed.data}`;
    };
    const firstFrameUri = await loadRef(videoRefsSnapshot?.[0]);
    const lastFrameUri  = await loadRef(videoRefsSnapshot?.[1]);
    if (!firstFrameUri) throw new Error('Start frame (first ref) required for WAN 2.7 I2V.');
    payload.image_url = firstFrameUri;
    if (lastFrameUri) payload.end_image_url = lastFrameUri;

    // Extend video — optional source video to continue (encodes as data URI)
    if (extendVideoId) {
      const extFull = await dbGet('videos', extendVideoId).catch(() => null);
      if (extFull?.videoData) {
        payload.video_url = `data:video/mp4;base64,${_arrayBufferToBase64(extFull.videoData)}`;
      }
    }
  }

  // Submit, poll, download via shared helper
  console.log('[wan27] submit →', endpoint, '| resolution:', resolution, '| duration:', duration);
  const { buffer: videoArrayBuffer } = await _falVideoSubmitPollDownload(falKey, endpoint, payload, job, { label: 'WAN 2.7', timeoutMin: VIDEO_POLL.timeoutMin.falLong });

  const { elapsed } = await _saveVideoResult(videoArrayBuffer, {
    model: model.name, modelKey, prompt: job.prompt,
    params: { duration, resolution, negPrompt, promptExpand },
    duration,
  }, job, ['fal', resolution === '1080p' ? '_wan27_1080p' : '_wan27_720p', 1, duration]);
  toast(`WAN 2.7 done · ${elapsed}s`, 'ok');
}

// ── WAN 2.7 Video Edit — fal.ai queue (přímé, bez proxy) ──
// fal-ai/wan/v2.7/edit-video
// Source video: ANY gallery video → base64 data URI (no CDN URL dependency)
// Ref image: optional, base64 data URI
async function callWan27eVideo(job) {
  const { model, modelKey, prompt, targetFolder, falKey,
          videoRefsSnapshot, wan27eSnap, params } = job;

  if (!falKey)               throw new Error('fal.ai API key missing. Add it in Setup tab.');
  if (!prompt)               throw new Error('Prompt required — describe the edit or style transfer.');
  if (!wan27eSnap?.srcVideoId) throw new Error('No source video selected.');

  const endpoint     = model.falEndpoint || 'fal-ai/wan/v2.7/edit-video';
  const resolution   = wan27eSnap.resolution   || '1080p';
  const duration     = wan27eSnap.duration;      // string enum: "0"|"2"..."10"
  const audioSetting = wan27eSnap.audioSetting  || 'auto';  // 'auto' | 'origin'
  const aspectRatio  = wan27eSnap.aspectRatio   || 'auto';
  const safety       = params?.safety !== false;
  const seed         = (params?.seed != null) ? params.seed : undefined;

  // Load source video from DB → base64 data URI
  job.status = 'submitting'; renderVideoQueue();
  const srcFull = await dbGet('videos', wan27eSnap.srcVideoId).catch(() => null);
  if (!srcFull?.videoData) throw new Error('Source video data not found in gallery. Try re-adding it.');
  const srcMeta = await dbGet('video_meta', wan27eSnap.srcVideoId).catch(() => null);

  // Auto-match resolution to source video to avoid quality downgrade
  let effectiveRes = resolution;
  if (srcMeta?.outHeight && srcMeta.outHeight <= 720 && resolution === '1080p') {
    effectiveRes = '720p';
  }
  const actualDuration = srcMeta?.duration || 5;

  // Encode source video as base64 data URI (fal.ai accepts data URIs natively)
  const videoUri = `data:video/mp4;base64,${_arrayBufferToBase64(srcFull.videoData)}`;

  const payload = {
    prompt,
    video_url:              videoUri,
    resolution:             effectiveRes,
    audio_setting:          audioSetting,
    enable_safety_checker:  safety,
  };
  if (aspectRatio && aspectRatio !== 'auto') payload.aspect_ratio = aspectRatio;
  if (duration && duration !== '0')          payload.duration     = duration;
  if (seed !== undefined)                    payload.seed         = seed;

  // Optional reference image for style guidance
  const refSnap = videoRefsSnapshot?.[0];
  if (refSnap) {
    let imgData = refSnap.imageData;
    if (!imgData && refSnap.assetId) {
      const asset = await dbGet('assets', refSnap.assetId);
      imgData = asset?.imageData;
    }
    if (imgData) {
      const compressed = await compressImageForUpload(imgData, refSnap.mimeType || 'image/jpeg');
      payload.reference_image_url = `data:${compressed.mimeType};base64,${compressed.data}`;
    }
  }

  // Submit, poll, download via shared helper
  console.log('[wan27e] submit → fal.ai | resolution:', effectiveRes, '| duration:', duration, '| audio:', audioSetting);
  const { buffer: videoArrayBuffer } = await _falVideoSubmitPollDownload(falKey, endpoint, payload, job, { label: 'WAN 2.7 Edit', timeoutMin: VIDEO_POLL.timeoutMin.falEdit, progressLabel: 'EDITING' });

  const { elapsed } = await _saveVideoResult(videoArrayBuffer, {
    model: model.name, modelKey, prompt: job.prompt,
    params: { resolution: effectiveRes, audioSetting, aspectRatio, srcVideoId: wan27eSnap.srcVideoId },
    duration: actualDuration,
  }, job, ['fal', effectiveRes === '1080p' ? '_wan27e_1080p' : '_wan27e_720p', 1, actualDuration]);
  toast(`WAN 2.7 Edit done · ${elapsed}s`, 'ok');
}

// ── Seedance 2.0 — fal.ai queue (direct, no proxy) ──────
// Handles T2V, I2V (start+end frame), R2V (images + videos + audio)
// Multi-shot: controlled via prompt ([lens switch], timeline [0-3s]..., Shot 1:...)
// R2V refs in prompt: [Image1], [Video1], [Audio1]
async function callSeedance2Video(job) {
  const { model, modelKey, prompt, aspectRatio, enableAudio, falKey,
          videoRefsSnapshot, sd2Snap, params } = job;

  if (!falKey) throw new Error('fal.ai API key missing. Add it in Setup tab.');

  const endpoint   = model.endpoint;
  const durVal     = sd2Snap?.autoDuration ? 'auto' : (sd2Snap?.duration || '5');
  const resolution = sd2Snap?.resolution || '720p';
  const seed       = (params?.seed != null) ? params.seed : undefined;
  const isI2V      = model.refMode === 'single_end';
  const isR2V      = model.refMode === 'seedance2_r2v';

  const payload = {
    prompt:         prompt || '',
    duration:       durVal,   // STRING — "4"–"15" or "auto"
    resolution,
    generate_audio: !!enableAudio,
  };
  // aspect_ratio: T2V always, I2V/R2V only if not auto
  if (!isI2V || aspectRatio !== 'auto') payload.aspect_ratio = aspectRatio;
  if (seed !== undefined) payload.seed = seed;

  // ── I2V: start + optional end frame ──
  if (isI2V) {
    const loadRef = async (snap) => {
      if (!snap) return null;
      let imgData = snap.imageData;
      if (!imgData && snap.assetId) {
        const asset = await dbGet('assets', snap.assetId);
        imgData = asset?.imageData;
      }
      if (!imgData) return null;
      const compressed = await compressImageForUpload(imgData, snap.mimeType || 'image/jpeg');
      return `data:${compressed.mimeType};base64,${compressed.data}`;
    };
    const startUri = await loadRef(videoRefsSnapshot?.[0]);
    const endUri   = await loadRef(videoRefsSnapshot?.[1]);
    if (!startUri) throw new Error('Start frame (first ref) required for Seedance 2.0 I2V.');
    payload.image_url = startUri;
    if (endUri) payload.end_image_url = endUri;
  }

  // ── R2V: image refs + video refs + audio URLs ──
  if (isR2V) {
    // Image refs from videoRefs (standard GIS image assets)
    const imageUrls = [];
    for (const snap of (videoRefsSnapshot || [])) {
      let imgData = snap.imageData;
      if (!imgData && snap.assetId) {
        const asset = await dbGet('assets', snap.assetId);
        imgData = asset?.imageData;
      }
      if (imgData) {
        const compressed = await compressImageForUpload(imgData, snap.mimeType || 'image/jpeg');
        imageUrls.push(`data:${compressed.mimeType};base64,${compressed.data}`);
      }
    }
    if (imageUrls.length > 0) payload.image_urls = imageUrls;

    // Video refs — load from gallery DB, upload to R2 for public URLs
    const videoUrls = [];
    const proxyUrl = job.proxyUrl || getProxyUrl();
    for (const vidId of (sd2Snap?.vidSrcIds || [])) {
      if (!vidId) continue;
      const full = await dbGet('videos', vidId).catch(() => null);
      if (!full?.videoData) continue;
      updateVideoPlaceholderStatus(job, `UPLOADING VIDEO REF…`);
      const blob = new Blob([full.videoData], { type: full.mimeType || 'video/mp4' });
      const url = await uploadVideoToFal(blob, falKey);
      videoUrls.push(url);
    }
    if (videoUrls.length > 0) payload.video_urls = videoUrls;

    // Audio URLs — direct paste from user
    const audioUrls = (sd2Snap?.audioUrls || []).filter(Boolean);
    if (audioUrls.length > 0) payload.audio_urls = audioUrls;
  }

  // Submit, poll, download via shared helper
  const logPayload = {...payload};
  ['image_url','end_image_url'].forEach(k => { if (logPayload[k]) logPayload[k] = logPayload[k].slice(0, 40) + '…'; });
  if (logPayload.image_urls) logPayload.image_urls = logPayload.image_urls.map(u => u.slice(0, 40) + '…');
  console.log('[Seedance2] submit →', endpoint, JSON.stringify(logPayload));

  const { buffer: videoArrayBuffer, cdnUrl: videoUrl } = await _falVideoSubmitPollDownload(
    falKey, endpoint, payload, job, { label: model.name, timeoutMin: VIDEO_POLL.timeoutMin.falLong }
  );

  // Price key: tier × resolution, with R2V video-refs 0.6× multiplier
  // Formula source: fal token pricing (h × w × 24) / 1024 × rate/1000
  //   Standard rate: $0.014/1k tokens → 480p ≈ $0.140/s, 720p = $0.303/s, 1080p ≈ $0.680/s
  //   Fast rate:     $0.0112/1k       → 480p ≈ $0.112/s, 720p = $0.242/s (no 1080p)
  //   R2V with video refs → × 0.6 (fal docs)
  const isFast = endpoint.includes('/fast/');
  const hasVidRefs = isR2V && (sd2Snap?.vidSrcIds || []).some(Boolean);
  const tier = isFast ? 'fast' : 'std';
  const prefix = hasVidRefs ? '_seedance2_r2v_' : '_seedance2_';
  const priceKey = `${prefix}${tier}_${resolution}`;
  const durNum = parseInt(durVal) || 5;

  const { elapsed } = await _saveVideoResult(videoArrayBuffer, {
    model: model.name, modelKey, prompt: job.prompt,
    params: { duration: durVal, resolution, enableAudio },
    duration: durNum,
    cdnUrl: videoUrl,
  }, job, ['fal', priceKey, 1, durNum]);
  toast(`Seedance 2.0 done · ${elapsed}s`, 'ok');
}

// ── xAI Grok Imagine Video ──────────────────────────────────
// Flow: GIS → Worker POST /xai/video/submit|edit|extend → { request_id }
//       GIS polls → Worker POST /xai/video/status → { status, video_url }
//       GIS downloads → Worker POST /xai/video/download → binary MP4
async function callGrokVideo(job) {
  const { model, modelKey, prompt, proxyUrl, xaiKey, grokVideoSnap, videoRefsSnapshot, targetFolder } = job;

  if (!xaiKey)   throw new Error('Missing xAI API key');
  if (!proxyUrl)  throw new Error('Missing proxy URL');
  if (!grokVideoSnap) throw new Error('Missing Grok Video parameters');

  const mode = grokVideoSnap.mode || 't2v';
  const duration = grokVideoSnap.duration || 8;
  const resolution = grokVideoSnap.resolution || '720p';
  const aspectRatio = job.aspectRatio || '16:9';

  job.status = 'submitting';
  updateVideoPlaceholderStatus(job, 'SUBMITTING…');

  // ── Build submit payload based on mode ──────────────────
  let submitUrl, submitBody;

  if (mode === 'edit') {
    // V2V Edit — load video from DB, upload to R2 for HTTPS URL
    if (!grokVideoSnap.srcVideoId) throw new Error('V2V Edit requires a source video — click ▷ Use on a gallery video');
    job.status = 'uploading';
    updateVideoPlaceholderStatus(job, 'UPLOADING VIDEO…');
    const srcFull = await dbGet('videos', grokVideoSnap.srcVideoId).catch(() => null);
    if (!srcFull?.videoData) throw new Error('Source video data not found in gallery');
    const blob = new Blob([srcFull.videoData], { type: 'video/mp4' });
    const r2Resp = await fetch(`${proxyUrl}/r2/upload`, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: blob });
    if (!r2Resp.ok) throw new Error(`R2 upload failed: ${r2Resp.status}`);
    const { url: r2Url } = await r2Resp.json();
    submitUrl = `${proxyUrl}/xai/video/edit`;
    submitBody = { xai_key: xaiKey, prompt, video_url: r2Url };

  } else if (mode === 'extend') {
    // Extend — load video from DB, upload to R2
    if (!grokVideoSnap.srcVideoId) throw new Error('Extend requires a source video — click ▷ Use on a gallery video');
    job.status = 'uploading';
    updateVideoPlaceholderStatus(job, 'UPLOADING VIDEO…');
    const srcFull = await dbGet('videos', grokVideoSnap.srcVideoId).catch(() => null);
    if (!srcFull?.videoData) throw new Error('Source video data not found in gallery');
    const blob = new Blob([srcFull.videoData], { type: 'video/mp4' });
    const r2Resp = await fetch(`${proxyUrl}/r2/upload`, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: blob });
    if (!r2Resp.ok) throw new Error(`R2 upload failed: ${r2Resp.status}`);
    const { url: r2Url } = await r2Resp.json();
    submitUrl = `${proxyUrl}/xai/video/extend`;
    submitBody = { xai_key: xaiKey, prompt, video_url: r2Url, duration };

  } else {
    // T2V / I2V / Ref2V — all go to /xai/video/submit
    submitUrl = `${proxyUrl}/xai/video/submit`;
    submitBody = {
      xai_key: xaiKey, mode, prompt,
      duration, aspect_ratio: aspectRatio, resolution,
    };

    if (mode === 'i2v') {
      // I2V: first videoRef as start frame (base64 data URI)
      const refs = videoRefsSnapshot || [];
      if (!refs.length) throw new Error('I2V requires a start frame — add a video reference');
      job.status = 'uploading';
      updateVideoPlaceholderStatus(job, 'PREPARING IMAGE…');
      const asset = refs[0].assetId ? await dbGet('assets', refs[0].assetId).catch(() => null) : null;
      const imgData = asset?.imageData || refs[0].imageData;
      if (!imgData) throw new Error('Cannot load start frame image data');
      const mime = asset?.mimeType || refs[0].mimeType || 'image/jpeg';
      submitBody.image_url = `data:${mime};base64,${imgData}`;

    } else if (mode === 'ref2v') {
      // Ref2V: up to 7 ref images as data URIs
      const refs = videoRefsSnapshot || [];
      if (!refs.length) throw new Error('Ref-to-Video requires at least 1 reference image');
      job.status = 'uploading';
      updateVideoPlaceholderStatus(job, 'PREPARING REFS…');
      const refUrls = [];
      for (const r of refs.slice(0, 7)) {
        const asset = r.assetId ? await dbGet('assets', r.assetId).catch(() => null) : null;
        const imgData = asset?.imageData || r.imageData;
        if (!imgData) continue;
        const mime = asset?.mimeType || r.mimeType || 'image/jpeg';
        refUrls.push(`data:${mime};base64,${imgData}`);
      }
      if (!refUrls.length) throw new Error('Could not load any reference image data');
      submitBody.reference_images = refUrls;
    }
  }

  // ── Submit to Worker ────────────────────────────────────
  job.status = 'submitting';
  updateVideoPlaceholderStatus(job, 'SUBMITTING…');

  const submitResp = await fetch(submitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submitBody),
  });
  if (!submitResp.ok) {
    const err = await submitResp.json().catch(() => ({}));
    throw new Error(`Grok Video submit ${submitResp.status}: ${err.error || err.detail || submitResp.statusText}`);
  }
  const { request_id } = await submitResp.json();
  if (!request_id) throw new Error('Grok Video: no request_id from Worker');

  // ── Poll for completion ─────────────────────────────────
  job.status = 'generating';
  updateVideoPlaceholderStatus(job, 'GENERATING…');

  // Poll via shared helper (v206en cleanup #3)
  const status = await _videoPollLoop(job, {
    label:      'Grok Video',
    timeoutMin: VIDEO_POLL.timeoutMin.grok,
    pollMs:     VIDEO_POLL.defaultMs,
    poll: async () => {
      const statusResp = await fetch(`${proxyUrl}/xai/video/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xai_key: xaiKey, request_id }),
      });
      if (!statusResp.ok) {
        const err = await statusResp.json().catch(() => ({}));
        throw new Error(`Grok Video status ${statusResp.status}: ${err.error || statusResp.statusText}`);
      }
      const s = await statusResp.json();
      if (s.status === 'failed')  return { status: 'failed', error: `Grok Video failed: ${s.error || 'unknown'}` };
      if (s.status === 'expired') return { status: 'failed', error: 'Grok Video: request expired' };
      if (s.status === 'done')    return { status: 'done', data: s };
      return { status: 'running' };
    },
  });

  if (!status.video_url) throw new Error('Grok Video: done but no video_url');

  // ── Download via proxy (xAI URLs lack CORS) ───────
  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');

  const dlResp = await fetch(`${proxyUrl}/xai/video/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: status.video_url }),
  });
  if (!dlResp.ok) throw new Error(`Grok Video download failed (${dlResp.status})`);
  const videoArrayBuffer = await dlResp.arrayBuffer();

  const actualDur = status.duration || duration;
  const { elapsed } = await _saveVideoResult(videoArrayBuffer, {
    model: model.name, modelKey, prompt,
    params: { mode, duration: actualDur, aspectRatio, resolution, srcVideoUrl: grokVideoSnap.srcVideoUrl || null },
    duration: actualDur,
    cdnUrl: status.video_url,
    usedVideoRefs: videoRefsSnapshot || [],
  }, job, ['xai', 'grok-imagine-video', 1, actualDur]);
  toast(`Grok Video done · ${elapsed}s · ${mode.toUpperCase()}`, 'ok');
}

// ── Grok Video — mode change handler ────────────────────────
// Source video gallery ID lives in unifiedSrcVideoId (video-gallery.js).

function onGrokVideoModeChange(mode) {
  const notes = {
    t2v:    'Prompt-only generation with native audio',
    i2v:    'Upload a start frame as video reference → animated into video',
    ref2v:  'Up to 7 reference images as visual guide (not start frame) · Max 10s',
    edit:   'Edit an existing video — add/remove/restyle · Max 8.7s input · No duration/aspect/resolution control',
    extend: 'Continue a video from its last frame · Adds 2–10s',
  };
  const noteEl = document.getElementById('grokVideoModeNote');
  if (noteEl) noteEl.textContent = notes[mode] || '';

  // Duration + resolution — visibility per mode (edit has no duration/res,
  // extend has no resolution).
  // v222en: was manipulating legacy #grokVideoDur/#grokVideoRes .ctrl
  // wrappers which fought with STEP 12's permanent hide.
  // v223.1: grokResolutionRow permanently hidden by STEP 13 (unified
  // switcher owns Resolution).  Toggle unifiedResRow here for edit/extend
  // modes.  Duration slot (videoDurRow) remains toggled for 'edit'.
  const unifiedDurRow   = document.getElementById('videoDurRow');
  const unifiedResRow   = document.getElementById('unifiedResRow');
  if (unifiedDurRow) unifiedDurRow.style.display = mode === 'edit' ? 'none' : '';
  if (unifiedResRow) unifiedResRow.style.display = (mode === 'edit' || mode === 'extend') ? 'none' : '';

  // Duration constraints per mode — applied to unified slider (v222en).
  const slider   = document.getElementById('videoDuration');
  const valLbl   = document.getElementById('videoDurVal');
  const minLbl   = document.getElementById('videoDurMinLbl');
  const maxLbl   = document.getElementById('videoDurMaxLbl');
  if (slider && mode !== 'edit') {
    const maxDur = mode === 'ref2v' ? 10 : (mode === 'extend' ? 10 : 15);
    const minDur = mode === 'extend' ? 2 : 3;
    slider.min = minDur;
    slider.max = maxDur;
    if (minLbl) minLbl.textContent = minDur + 's';
    if (maxLbl) maxLbl.textContent = maxDur + 's';
    let v = parseInt(slider.value) || 8;
    if (v > maxDur) v = maxDur;
    if (v < minDur) v = minDur;
    // Snap to Grok's allowed discrete values (filtered by current range).
    const allowed = [3, 5, 8, 10, 12, 15].filter(a => a >= minDur && a <= maxDur);
    if (allowed.length > 0) {
      let best = allowed[0], bestDiff = Math.abs(best - v);
      for (const a of allowed) {
        const d = Math.abs(a - v);
        if (d < bestDiff) { best = a; bestDiff = d; }
      }
      v = best;
    }
    slider.value = v;
    if (valLbl) valLbl.textContent = v + 's';
    // v225en: legacy #grokVideoDur removed; unified slider is authoritative.
  }

  // Source video row — visibility + label delegated to _vpApplyUnifiedLayer.
  // Re-apply it when Grok mode changes so the unified slot updates live.
  if (typeof _vpApplyUnifiedLayer === 'function') {
    const key = getActiveVideoModelKey();
    const m   = VIDEO_MODELS[key];
    if (m) _vpApplyUnifiedLayer(key, m);
  }

  // Video ref section — show for I2V and Ref2V
  const refSec = document.getElementById('videoRefSection');
  const refLabel = document.getElementById('videoRefLabel');
  const refCount = document.getElementById('videoRefCount');
  if (mode === 'i2v') {
    if (refSec) refSec.style.display = 'block';
    if (refLabel) refLabel.childNodes[0].textContent = 'Start frame';
    if (refCount) refCount.textContent = `${videoRefs.length} / 1`;
  } else if (mode === 'ref2v') {
    if (refSec) refSec.style.display = 'block';
    if (refLabel) refLabel.childNodes[0].textContent = 'Reference images (visual guide)';
    if (refCount) refCount.textContent = `${videoRefs.length} / 7`;
  } else {
    // T2V, Edit, Extend — hide ref section
    if (refSec) refSec.style.display = (mode === 't2v' || mode === 'edit' || mode === 'extend') ? 'none' : '';
  }
}

let _prevVideoModelKey  = null;  // tracks last applied model key for rewrite
let _videoModelSwitching = false; // guard: prevents renderVideoRefPanel from firing rewrite during model switch
// Reverse-map model-specific names back to @UserLabel form
function videoPromptModelToUserLabels(prompt, activeRefs, prevM) {
  if (!prompt || !activeRefs.length || !prevM) return prompt;
  const mode = prevM.refMode || '';

  if (mode === 'multi') {
    // PixVerse Fusion: @pic1 → @UserLabel; Kling: @Element1 → @UserLabel
    const pattern = prevM?.pixverseMode === 'fusion'
      ? /@pic(\d+)\b/gi
      : /@Element(\d+)/gi;
    return prompt.replace(pattern, (full, n) => {
      const idx = parseInt(n) - 1;
      const ref = activeRefs[idx];
      if (!ref) return full;
      const label = (ref.userLabel || ref.autoName || `Ref_${idx + 1}`).replace(/\s+/g, '_');
      return '@' + label;
    });
  }

  if (mode === 'wan_r2v') {
    // Character1, Character2 → @UserLabel (no @ prefix in WAN R2V)
    return prompt.replace(/\bCharacter(\d+)\b/gi, (full, n) => {
      const idx = parseInt(n) - 1;
      const ref = activeRefs[idx];
      if (!ref) return full;
      const label = (ref.userLabel || ref.autoName || `Ref_${idx + 1}`).replace(/\s+/g, '_');
      return '@' + label;
    });
  }

  if (mode === 'seedance2_r2v') {
    // [Image1], [Image2] → @UserLabel
    return prompt.replace(/\[Image(\d+)\]/gi, (full, n) => {
      const idx = parseInt(n) - 1;
      const ref = activeRefs[idx];
      if (!ref) return full;
      const label = (ref.userLabel || ref.autoName || `Ref_${idx + 1}`).replace(/\s+/g, '_');
      return '@' + label;
    });
  }

  return prompt;
}

// Apply model-specific names to canonical @UserLabel prompt
function videoPromptUserLabelsToModel(prompt, activeRefs, newM) {
  if (!prompt || !activeRefs.length || !newM) return prompt;
  const mode = newM.refMode || '';

  // Build label → index map
  const labelMap = new Map();
  activeRefs.forEach((r, i) => {
    const key = (r.userLabel || r.autoName || '').replace(/_/g, ' ').toLowerCase();
    if (key) labelMap.set(key, i);
    const keyU = (r.userLabel || r.autoName || '').toLowerCase();
    if (keyU) labelMap.set(keyU, i);
    const an = (r.autoName || '').toLowerCase();
    if (an) labelMap.set(an, i);
  });

  function findIdx(mention) {
    const m = mention.replace(/_/g, ' ').toLowerCase();
    if (labelMap.has(m)) return labelMap.get(m);
    return labelMap.get(mention.toLowerCase()) ?? -1;
  }

  if (mode === 'multi') {
    // PixVerse Fusion: @UserLabel → @pic{N+1}; Kling: @UserLabel → @Element{N+1}
    const isFusion = newM?.pixverseMode === 'fusion';
    return prompt.replace(/@([\w]+)/g, (full, mention) => {
      const idx = findIdx(mention);
      return idx >= 0 ? (isFusion ? `@pic${idx + 1}` : `@Element${idx + 1}`) : full;
    });
  }

  if (mode === 'wan_r2v') {
    // @UserLabel → Character{N+1} (no @ prefix)
    return prompt.replace(/@([\w]+)/g, (full, mention) => {
      const idx = findIdx(mention);
      return idx >= 0 ? `Character${idx + 1}` : full;
    });
  }

  if (mode === 'seedance2_r2v') {
    // @UserLabel → [Image{N+1}]
    return prompt.replace(/@([\w]+)/g, (full, mention) => {
      const idx = findIdx(mention);
      return idx >= 0 ? `[Image${idx + 1}]` : full;
    });
  }

  return prompt;
}

// Rewrite videoPrompt textarea when video model or refs change
// prevM: previous VIDEO_MODELS model object (null = first load)
// newM: new VIDEO_MODELS model object
function rewriteVideoPromptForModel(prevM, newM) {
  const ta = document.getElementById('videoPrompt');
  if (!ta || !ta.value.trim()) return;
  if (!videoRefs.length) return;

  // Modes that use @mention naming
  const mentionModes = ['multi', 'wan_r2v', 'seedance2_r2v'];
  const prevMode = prevM?.refMode || '';
  const newMode  = newM?.refMode  || '';
  if (!mentionModes.includes(prevMode) && !mentionModes.includes(newMode)) return;

  // Step 1: convert from prev model format → canonical @UserLabels
  const canonical = prevM
    ? videoPromptModelToUserLabels(ta.value, videoRefs, prevM)
    : ta.value;

  // Step 2: apply new model format
  const newPrompt = videoPromptUserLabelsToModel(canonical, videoRefs, newM);

  if (newPrompt !== ta.value) {
    const pos = ta.selectionStart;
    ta.value = newPrompt;
    ta.selectionStart = ta.selectionEnd = Math.min(pos, newPrompt.length);
  }
}
