// ═══════════════════════════════════════════════════════
// VIDEO — Kling video generation, gallery, lightbox
// ═══════════════════════════════════════════════════════

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
  },
  kling_v3_t2v_pro: {
    name: 'Kling V3 Pro T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/pro/text-to-video',
    desc: 'T2V · Native audio · Up to 15s · Highest quality',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15,
  },
  kling_v3_i2v_std: {
    name: 'Kling V3 Standard I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/standard/image-to-video',
    desc: 'I2V · Start frame + optional end frame · Native audio · Up to 15s',
    refMode: 'single_end', maxRefs: 2,
    refLabel: 'Start frame (drag 2nd = end frame)',
    hasAudio: true, maxDur: 15,
  },
  kling_v3_i2v_pro: {
    name: 'Kling V3 Pro I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/pro/image-to-video',
    desc: 'I2V · Start frame + optional end frame · Native audio · Up to 15s',
    refMode: 'single_end', maxRefs: 2,
    refLabel: 'Start frame (add 2nd = end frame)',
    hasAudio: true, maxDur: 15,
  },
  kling_o3_t2v_std: {
    name: 'Kling O3 Standard T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o3/standard/text-to-video',
    desc: 'T2V · Native audio · Voice control · Up to 15s',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15,
  },
  kling_o3_t2v_pro: {
    name: 'Kling O3 Pro T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o3/pro/text-to-video',
    desc: 'T2V · Native audio · Voice control · Up to 15s · Highest quality',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 15,
  },
  kling_o3_i2v_std: {
    name: 'Kling O3 Standard I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o3/standard/image-to-video',
    desc: 'I2V · Up to 7 element refs · Voice clone · Native audio · Up to 15s',
    refMode: 'multi', maxRefs: 7,
    refLabel: 'Element refs (up to 7) · use @Element1 in prompt',
    imageField: 'image_url',
    hasAudio: true, maxDur: 15,
  },
  kling_o3_i2v_pro: {
    name: 'Kling O3 Pro I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o3/pro/image-to-video',
    desc: 'I2V · Up to 7 element refs · Voice clone · Native audio · Up to 15s',
    refMode: 'multi', maxRefs: 7,
    refLabel: 'Element refs (up to 7) · use @Element1 in prompt',
    imageField: 'image_url',
    hasAudio: true, maxDur: 15,
  },
  kling_o1_kf: {
    name: 'Kling O1 Dual Keyframe', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/o1/image-to-video',
    desc: 'Start + End frame interpolation · 5s or 10s',
    refMode: 'keyframe', maxRefs: 2,
    refLabel: 'Start frame + End frame (both required)',
    hasAudio: false, maxDur: 10,
  },
  kling_26_i2v_pro: {
    name: 'Kling 2.6 Pro I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    desc: 'I2V · Start frame · Native audio · Economy · $0.070/s',
    refMode: 'single', maxRefs: 1,
    refLabel: 'Start frame',
    hasAudio: true, maxDur: 10,
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
  },
  kling_v3_v2v_pro: {
    name: 'Kling V3 Pro · Motion Control', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v3/pro/motion-control',
    desc: 'V2V · Upload action video for motion + character image (both required) · Pro quality',
    refMode: 'video_ref', maxRefs: 1,
    refLabel: 'Character image (required)',
    hasAudio: false, maxDur: 10,
  },
  kling_26_v2v_pro: {
    name: 'Kling 2.6 Pro · Motion Control', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.6/pro/motion-control',
    desc: 'V2V · Upload action video for motion + character image (both required)',
    refMode: 'video_ref', maxRefs: 1,
    refLabel: 'Character image (required)',
    hasAudio: false, maxDur: 10,
  },

  // ── Older models — economy options ───────────────────────
  kling_25t_t2v: {
    name: 'Kling 2.1 Master T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.1/master/text-to-video',
    desc: 'T2V · Top-tier 2.1 · Cinematic visuals · 5s or 10s',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
  },
  kling_25t_i2v: {
    name: 'Kling 2.1 Master I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.1/master/image-to-video',
    desc: 'I2V · Start frame · Top-tier 2.1 · Cinematic visuals · 5s or 10s',
    refMode: 'single', maxRefs: 1,
    refLabel: 'Start frame',
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
    imageField: 'image_url',
  },
  kling_21_t2v: {
    name: 'Kling 2.1 Standard T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.1/standard/text-to-video',
    desc: 'T2V · Exceptional Value & Efficiency · 5s or 10s',
    refMode: 'none', maxRefs: 0,
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
  },
  kling_21_i2v: {
    name: 'Kling 2.1 Standard I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v2.1/standard/image-to-video',
    desc: 'I2V · Start frame · Exceptional Value & Efficiency · 5s or 10s',
    refMode: 'single', maxRefs: 1,
    refLabel: 'Start frame',
    hasAudio: true, maxDur: 10, durOptions: [5, 10],
    imageField: 'image_url',
  },
  kling_16_t2v: {
    name: 'Kling 1.6 T2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v1.6/standard/text-to-video',
    desc: 'T2V · Economy · 5s or 10s',
    refMode: 'none', maxRefs: 0,
    hasAudio: false, maxDur: 10, durOptions: [5, 10],
  },
  kling_16_i2v: {
    name: 'Kling 1.6 I2V', type: 'kling_video',
    endpoint: 'fal-ai/kling-video/v1.6/pro/image-to-video',
    desc: 'I2V · Start frame · Economy · 5s or 10s',
    refMode: 'single', maxRefs: 1,
    refLabel: 'Start frame',
    hasAudio: false, maxDur: 10, durOptions: [5, 10],
    imageField: 'image_url',
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
  },
  wan27e_v2v: {
    name: 'Wan 2.7 Video Edit', type: 'wan27e_video',
    falEndpoint: 'fal-ai/wan/v2.7/edit-video',
    refMode: 'single', maxRefs: 1, maxDur: 10, hasAudio: false,
    refLabel: 'Reference image (optional)',
    desc: 'V2V · Instruction edit · Style transfer · Any source video · Optional ref image · Up to 10s · fal.ai',
  },

  wan26_t2v: {
    name: 'Wan 2.6', type: 'wan_video',
    endpoint: 'wan/v2.6/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 15, hasAudio: false,
    durOptions: [5, 10, 15],
    desc: 'T2V · Multi-shot · Audio always on · Up to 15s · $0.10/s (720p) · Alibaba',
  },
  wan26_t2v_single: {
    name: 'Wan 2.6', type: 'wan_video',
    endpoint: 'wan/v2.6/text-to-video',
    refMode: 'none', maxRefs: 0, maxDur: 15, hasAudio: false,
    multiShots: false,
    durOptions: [5, 10, 15],
    desc: 'T2V · Single shot · Audio always on · Up to 15s · $0.10/s (720p) · Alibaba',
  },
  wan26_i2v: {
    name: 'Wan 2.6', type: 'wan_video',
    endpoint: 'wan/v2.6/image-to-video',
    refMode: 'single', maxRefs: 1, maxDur: 15, hasAudio: false,
    imageField: 'image_url',
    durOptions: [5, 10, 15],
    refLabel: 'Start frame',
    desc: 'I2V · Start frame · Multi-shot · Audio always on · Up to 15s · $0.10/s (720p) · Alibaba',
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
  },
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
};

// ── Topaz model definitions ─────────────────────────────
const TOPAZ_MODELS = {
  topaz_precise25: {
    name:        'Topaz Precise 2.5',
    type:        'topaz_video',
    apiModel:    'slp-2.5',
    desc:        'Best for AI-generated video. Reduces plastic artifacts, enhances faces, materials and text. Output: 1080p or 4K.',
    resolutions: ['1080p', '4k'],
    hasFactor:   false,  // no scale factor — uses fixed resolution
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
  topaz_astra1: {
    name:        'Topaz Astra 1',
    type:        'topaz_video',
    apiModel:    'astra-1',
    desc:        'Creative upscaling — reimagines and enhances video with added detail. Set creativity level. Output: 1080p or 4K. Slow motion up to 8×.',
    resolutions: ['1080p', '4k'],
    hasFactor:   false,
    hasCreativity: true,
    maxSlowmo:   8,
  },
};

const TOPAZ_GROUPS = {
  topaz: {
    default:  'topaz_precise25',
    variants: [
      { key: 'topaz_precise25', label: 'Precise 2.5 · 1080p/4K · GenAI video · best quality' },
      { key: 'topaz_precise2',  label: 'Precise 2 · 1×–4× upscale · balanced' },
      { key: 'topaz_astra1',    label: 'Astra 1 · Creative · subtle/medium/bold' },
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

// ── Global video state ───────────────────────────────────
let videoCurrentFolder = 'all';
let videoSelectedIds = new Set();
let videoSearchTimer = null;
let videoJobs = [];           // active generation jobs
let videoLbCurrentId = null;  // lightbox: current video id
let videoLbDuration = 0;
let videoRefs = [];           // [{data, mimeType, name}] — unified ref array per model
let videoMotionFile    = null;   // V2V: File object (from upload)
let videoMotionVideoId = null;   // V2V: gallery DB video ID (from gallery pick)
let topazSrcVideoId    = null;   // Topaz/Magnific: source video gallery ID
let wan27eSrcVideoId   = null;   // WAN 2.7 Video Edit: source video gallery ID
let wan27vSrcVideoId   = null;   // WAN 2.7 I2V: optional source video for extension

// ── WAN 2.7 I2V extend-video helpers ─────────────────────
function wan27vClearSource() {
  wan27vSrcVideoId = null;
  const info    = document.getElementById('wan27vSrcInfo');
  const thumbDiv = document.getElementById('wan27vSrcThumb');
  const clearBtn = document.getElementById('wan27vSrcClearBtn');
  const descBtn  = document.getElementById('wan27vSrcDescribeBtn');
  if (info)     info.textContent       = 'None selected';
  if (thumbDiv) thumbDiv.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
  if (descBtn)  descBtn.style.display  = 'none';
}

async function wan27vSetSource(videoId) {
  wan27vSrcVideoId = videoId;
  const meta   = await dbGet('video_meta', videoId).catch(() => null);
  const thumb  = await dbGet('video_thumbs', videoId).catch(() => null);
  const info    = document.getElementById('wan27vSrcInfo');
  const thumbDiv = document.getElementById('wan27vSrcThumb');
  const imgEl   = document.getElementById('wan27vSrcImg');
  const metaEl  = document.getElementById('wan27vSrcMeta');
  const clearBtn = document.getElementById('wan27vSrcClearBtn');
  const descBtn  = document.getElementById('wan27vSrcDescribeBtn');
  if (info && meta) {
    const mb = meta.fileSize ? `${(meta.fileSize/1024/1024).toFixed(1)}MB` : '';
    info.textContent = `${meta.duration || '?'}s · ${mb}`;
  }
  if (thumb?.data && imgEl && thumbDiv) { imgEl.src = thumb.data; thumbDiv.style.display = 'block'; }
  if (metaEl && meta) {
    const res = meta.outWidth && meta.outHeight ? `${meta.outWidth}x${meta.outHeight}` : (meta.params?.resolution || null);
    const chips = [res, meta.duration ? `${meta.duration}s` : null].filter(Boolean);
    metaEl.innerHTML = chips.map(c =>
      `<span style="background:var(--s2);border:1px solid var(--border);padding:2px 8px;font-size:10px;border-radius:2px;">${c}</span>`
    ).join('');
  }
  if (clearBtn) clearBtn.style.display = '';
  if (descBtn)  descBtn.style.display  = thumb?.data ? '' : 'none';
}

function wan27vPickFromGallery() {
  switchView('video');
  toast('Select a video in the gallery, then click ▷ Use', 'ok');
}

async function wan27vDescribeSource() {
  const img = document.getElementById('wan27vSrcImg');
  if (!img?.src || img.src === window.location.href) return;
  await _describeFromThumb(img.src);
}

// ── Shared: open describe modal with a thumbnail dataURL ──────
async function _describeFromThumb(thumbDataUrl) {
  const apiKey = localStorage.getItem('gis_apikey') || '';
  if (!apiKey) { toast('Enter Google API key in Setup', 'err'); return; }
  // Extract base64 (strip data:image/jpeg;base64, prefix)
  const comma = thumbDataUrl.indexOf(',');
  const b64   = comma >= 0 ? thumbDataUrl.slice(comma + 1) : thumbDataUrl;
  _describeSource = 'video';
  document.getElementById('dmPreview').src = thumbDataUrl;
  document.getElementById('dmResult').value = '';
  document.getElementById('dmStatus').textContent = '⟳ Generating…';
  document.getElementById('describeModal').classList.add('show');
  setDescribeTab('prompt');
  await _runDescribe(apiKey, b64, 'image/jpeg', 'prompt');
}

// ── V2V / Motion Control helpers ─────────────────────────
function _v2vSetPanel(thumbDataUrl, infoText) {
  const info    = document.getElementById('v2vSrcInfo');
  const thumbDiv = document.getElementById('v2vSrcThumb');
  const img     = document.getElementById('v2vSrcImg');
  const metaEl  = document.getElementById('v2vSrcMeta');
  const clearBtn = document.getElementById('v2vClearBtn');
  const descBtn  = document.getElementById('v2vDescribeBtn');
  if (info) info.textContent = infoText || '';
  if (thumbDataUrl && img && thumbDiv) {
    img.src = thumbDataUrl;
    thumbDiv.style.display = 'block';
  } else if (thumbDiv) {
    thumbDiv.style.display = 'none';
  }
  if (metaEl) metaEl.innerHTML = '';
  if (clearBtn) clearBtn.style.display = '';
  if (descBtn)  descBtn.style.display  = thumbDataUrl ? '' : 'none';
}

async function v2vVideoSelected(files) {
  const file = files?.[0];
  if (!file) return;
  videoMotionFile    = file;
  videoMotionVideoId = null;  // clear gallery selection
  const infoText = `${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`;
  _v2vSetPanel(null, infoText);  // show name immediately, then load thumb async
  try {
    const thumb = await generateVideoThumb(file);
    if (thumb) _v2vSetPanel(thumb, infoText);
  } catch(e) { /* thumb optional */ }
}

async function v2vSetFromGallery(videoId) {
  videoMotionFile    = null;
  videoMotionVideoId = videoId;
  const meta  = await dbGet('video_meta', videoId).catch(() => null);
  const thumb = await dbGet('video_thumbs', videoId).catch(() => null);
  const mb    = meta?.fileSize ? `${(meta.fileSize/1024/1024).toFixed(1)}MB` : '';
  const info  = `${meta?.duration || '?'}s · ${mb}`;
  _v2vSetPanel(thumb?.data || null, info);
}

function clearV2VVideo() {
  videoMotionFile    = null;
  videoMotionVideoId = null;
  const info     = document.getElementById('v2vSrcInfo');
  const thumbDiv = document.getElementById('v2vSrcThumb');
  const clearBtn = document.getElementById('v2vClearBtn');
  const descBtn  = document.getElementById('v2vDescribeBtn');
  const input    = document.getElementById('v2vVideoInput');
  if (info)     info.textContent      = 'No video selected';
  if (thumbDiv) thumbDiv.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
  if (descBtn)  descBtn.style.display  = 'none';
  if (input)    input.value            = '';
}

function v2vPickFromGallery() {
  switchView('video');
  toast('Select a video in the gallery, then click ▷ Use', 'ok');
}

async function v2vDescribeSource() {
  const img = document.getElementById('v2vSrcImg');
  if (!img?.src || img.src === window.location.href) return;
  await _describeFromThumb(img.src);
}

// ── Topaz: source video management ──────────────────────
function topazClearSource() {
  topazSrcVideoId = null;
  const info    = document.getElementById('topazSrcInfo');
  const thumb   = document.getElementById('topazSrcThumb');
  const btn     = document.getElementById('topazSrcClearBtn');
  const descBtn = document.getElementById('topazSrcDescribeBtn');
  const metaEl  = document.getElementById('topazSrcMeta');
  if (info)   info.textContent    = 'None selected';
  if (thumb)  thumb.style.display = 'none';
  if (btn)    btn.style.display   = 'none';
  if (descBtn) descBtn.style.display = 'none';
  if (metaEl) metaEl.innerHTML    = '';
}

async function topazSetSource(videoId) {
  topazSrcVideoId = videoId;
  const meta  = await dbGet('video_meta', videoId).catch(() => null);
  const thumb = await dbGet('video_thumbs', videoId).catch(() => null);
  const info     = document.getElementById('topazSrcInfo');
  const thumbDiv = document.getElementById('topazSrcThumb');
  const imgEl    = document.getElementById('topazSrcImg');
  const metaEl   = document.getElementById('topazSrcMeta');
  const btn      = document.getElementById('topazSrcClearBtn');
  const descBtn  = document.getElementById('topazSrcDescribeBtn');
  if (info && meta) {
    const mb = meta.fileSize ? `${(meta.fileSize/1024/1024).toFixed(1)}MB` : '';
    info.textContent = `${meta.duration || '?'}s · ${mb}`;
  }
  if (thumb?.data && imgEl && thumbDiv) {
    imgEl.src = thumb.data;
    thumbDiv.style.display = 'block';
  }
  // Show initial chips from stored meta
  if (metaEl && meta) {
    _renderTopazSrcMeta(metaEl, meta, null, null);
  }
  if (btn)     btn.style.display     = '';
  if (descBtn) descBtn.style.display = thumb?.data ? '' : 'none';

  // Async: load actual pixel dims + fps from video data (MP4 parser + video element)
  if (metaEl && meta) {
    const full = await dbGet('videos', videoId).catch(() => null);
    if (full?.videoData) {
      const blob = new Blob([full.videoData], { type: full.mimeType || 'video/mp4' });
      // FPS from MP4 atom parser (synchronous on ArrayBuffer)
      const fps = _parseMp4Fps(full.videoData)
               || meta.params?.fps
               || meta.params?.topaz?.fps
               || null;
      // Pixel dims from video element (async)
      const dims = await _topazGetDimsAndFps(blob).catch(() => null);
      _renderTopazSrcMeta(metaEl, meta, dims?.w || null, dims?.h || null, fps);
      // Auto-set FPS select to match source video
      if (fps) {
        const fpsSel = document.getElementById('topazFps');
        if (fpsSel) {
          const opts = [24, 25, 30, 60, 90, 120];
          const snapped = opts.reduce((a, b) => Math.abs(b - fps) < Math.abs(a - fps) ? b : a);
          fpsSel.value = String(snapped);
        }
      }
    }
  }
}

async function topazDescribeSource() {
  const img = document.getElementById('topazSrcImg');
  if (!img?.src || img.src === window.location.href) return;
  await _describeFromThumb(img.src);
}

function _renderTopazSrcMeta(metaEl, meta, w, h, detectedFps) {
  const resStr = w && h ? `${w}×${h}` : (meta.outWidth && meta.outHeight ? `${meta.outWidth}×${meta.outHeight}` : (meta.params?.resolution || null));
  const ar = meta.params?.aspectRatio || null;
  const dur = meta.duration ? `${meta.duration}s` : null;
  const fps = detectedFps || meta.params?.fps || meta.params?.topaz?.fps || null;
  const fpsStr = fps ? `${fps}fps` : null;
  const chips = [resStr, ar, dur, fpsStr].filter(Boolean);
  metaEl.innerHTML = chips.map(c =>
    `<span style="background:var(--s2);border:1px solid var(--border);padding:2px 8px;font-size:10px;border-radius:2px;">${c}</span>`
  ).join('');
  metaEl.style.display = chips.length ? 'flex' : 'none';
}

async function topazPickFromGallery() {
  switchView('video');
  toast('Select a video, then click ✦ Topaz on it', 'ok');
}

// ── WAN 2.7 Video Edit: source video management ──────────
function wan27eClearSource() {
  wan27eSrcVideoId = null;
  const info  = document.getElementById('wan27eSrcInfo');
  const thumb = document.getElementById('wan27eSrcThumb');
  const btn   = document.getElementById('wan27eSrcClearBtn');
  const desc  = document.getElementById('wan27eSrcDescribeBtn');
  if (info)  info.textContent    = 'None selected';
  if (thumb) thumb.style.display = 'none';
  if (btn)   btn.style.display   = 'none';
  if (desc)  desc.style.display  = 'none';
}

async function wan27eSetSource(videoId) {
  wan27eSrcVideoId = videoId;
  const meta  = await dbGet('video_meta', videoId).catch(() => null);
  const thumb = await dbGet('video_thumbs', videoId).catch(() => null);
  const info    = document.getElementById('wan27eSrcInfo');
  const thumbDiv = document.getElementById('wan27eSrcThumb');
  const imgEl   = document.getElementById('wan27eSrcImg');
  const metaEl  = document.getElementById('wan27eSrcMeta');
  const btn     = document.getElementById('wan27eSrcClearBtn');
  const desc    = document.getElementById('wan27eSrcDescribeBtn');
  if (info && meta) {
    const mb = meta.fileSize ? `${(meta.fileSize/1024/1024).toFixed(1)}MB` : '';
    info.textContent = `${meta.duration || '?'}s · ${mb}`;
  }
  if (thumb?.data && imgEl && thumbDiv) {
    imgEl.src = thumb.data;
    thumbDiv.style.display = 'block';
  }
  if (btn)  btn.style.display  = '';
  if (desc) desc.style.display = thumb?.data ? '' : 'none';
  if (metaEl && meta) {
    const res = meta.outWidth && meta.outHeight ? `${meta.outWidth}×${meta.outHeight}` : (meta.params?.resolution || null);
    const chips = [res, meta.duration ? `${meta.duration}s` : null].filter(Boolean);
    metaEl.innerHTML = chips.map(c =>
      `<span style="background:var(--s2);border:1px solid var(--border);padding:2px 8px;font-size:10px;border-radius:2px;">${c}</span>`
    ).join('');
  }
}

async function wan27eDescribeSource() {
  const img = document.getElementById('wan27eSrcImg');
  if (!img?.src || img.src === window.location.href) return;
  await _describeFromThumb(img.src);
}

async function wan27ePickFromGallery() {
  switchView('video');
  toast('Select a video, then click ▷ Use on it', 'ok');
}

// Called from ✦ Topaz card button — selects source + switches to Topaz model in panel
async function openTopazFromGallery(videoId) {
  switchView('gen');
  setGenMode('video');
  // If a Magnific video model is already active, just set the source without switching
  const currentKey = getActiveVideoModelKey();
  if (MAGNIFIC_VIDEO_MODELS[currentKey]) {
    await topazSetSource(videoId);
    toast('✦ Source video set for Magnific — configure and click ▶ Upscale Video', 'ok');
    return;
  }
  // Select the default Topaz model directly in main select
  const defaultTopaz = TOPAZ_GROUPS['topaz']?.default || 'topaz_precise25';
  const sel = document.getElementById('videoModelSelect');
  if (sel && sel.value !== defaultTopaz) {
    sel.value = defaultTopaz;
    onVideoModelChange(defaultTopaz);
  } else if (sel) {
    // Already on a Topaz model — re-apply to ensure rows are correct
    onVideoModelChange(sel.value);
  }
  await topazSetSource(videoId);
  toast('✦ Source video set — configure and click ▶ Upscale Video', 'ok');
}

// Called from ▷ Use card button — adds video to source slot of the currently active model
async function useVideoFromGallery(videoId) {
  switchView('gen');
  setGenMode('video');
  const activeKey = getActiveVideoModelKey();
  if (TOPAZ_MODELS[activeKey]) {
    await topazSetSource(videoId);
    toast('Source video set', 'ok');
  } else if (MAGNIFIC_VIDEO_MODELS[activeKey]) {
    await topazSetSource(videoId);  // reuses same source display
    toast('Source video set for Magnific upscale', 'ok');
  } else if (VIDEO_MODELS[activeKey]?.type === 'wan27e_video') {
    await wan27eSetSource(videoId);
    toast('Source video set for WAN 2.7 Edit', 'ok');
  } else if (VIDEO_MODELS[activeKey]?.refMode === 'video_ref') {
    await v2vSetFromGallery(videoId);
    toast('Motion reference video set', 'ok');
  } else if (VIDEO_MODELS[activeKey]?.type === 'wan27_video' && VIDEO_MODELS[activeKey]?.refMode === 'single_end') {
    await wan27vSetSource(videoId);
    toast('Extend source video set for WAN 2.7 I2V', 'ok');
  } else {
    toast('Switch to a model that uses a source video first', 'info');
  }
}

async function uploadVideoToFal(file, falKey) {
  // Upload via Worker R2 proxy — storage.fal.run is CORS-blocked from file:// protocol
  // falKey param kept for API compatibility but not used (R2 needs no external key)
  const proxyUrl = (localStorage.getItem('gis_proxy_url') || '').trim().replace(/\/$/, '');
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
function moveStyleTagsToVideo(isVideo) {
  // Move styleTags div to appear under videoPrompt when in video mode
  const styleTags = document.getElementById('styleTags');
  const videoStyleTarget = document.getElementById('videoStyleTagsSlot');
  const imgSection = document.getElementById('imgLeftContent');
  if (!styleTags) return;
  if (isVideo && videoStyleTarget) {
    videoStyleTarget.appendChild(styleTags);
  } else if (!isVideo && imgSection) {
    // Move back to image panel - after promptSection
    const promptSection = document.querySelector('#imgLeftContent .psec:nth-child(2)');
    if (promptSection) promptSection.after(styleTags);
  }
}

// ── Audio toggle (prominent ON/OFF button) ───────────────
function toggleVideoAudio() {
  const cb = document.getElementById('videoEnableAudio');
  if (cb) { cb.checked = !cb.checked; updateAudioToggleUI(); }
}

function updateAudioToggleUI() {
  const cb = document.getElementById('videoEnableAudio');
  const btn = document.getElementById('videoAudioToggle');
  const ctrl = document.getElementById('videoAudioCtrl');
  if (!cb || !btn) return;
  const on = cb.checked;
  if (on) {
    btn.textContent = '🔊 AUDIO ON';
    btn.style.borderColor = 'var(--accent)';
    btn.style.background = 'rgba(212,160,23,.12)';
    btn.style.color = 'var(--accent)';
  } else {
    btn.textContent = '🔇 AUDIO OFF';
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'none';
    btn.style.color = 'var(--dim)';
  }
}

function setGenMode(mode) {
  const isVideo = mode === 'video';
  // Swap content inside leftPanel — leftPanel itself stays visible always
  const imgContent = document.getElementById('imgLeftContent');
  const vidContent = document.getElementById('videoLeftContent');
  if (imgContent) imgContent.style.display = isVideo ? 'none' : 'contents';
  if (vidContent) {
    vidContent.style.display = isVideo ? 'flex' : 'none';
    if (isVideo) vidContent.style.flexDirection = 'column';
  }
  // Swap center output area
  const centerEl = document.getElementById('center');
  const videoCenterEl = document.getElementById('videoCenter');
  if (centerEl) centerEl.style.display = isVideo ? 'none' : '';
  if (videoCenterEl) {
    videoCenterEl.style.display = isVideo ? 'flex' : 'none';
    if (isVideo) videoCenterEl.style.flexDirection = 'column';
  }
  // Toggle buttons
  document.getElementById('genModeImgBtn').classList.toggle('active', !isVideo);
  document.getElementById('genModeVidBtn').classList.toggle('active', isVideo);
  window.aiPromptContext = isVideo ? 'video' : 'image';
  if (isVideo) { updateVideoFolderDropdown(); updateVideoResInfo(); initVideoCountHighlight(); moveStyleTagsToVideo(isVideo); updateAudioToggleUI(); }
}

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
    document.getElementById('videoModelDesc').textContent = tm.desc;
    // Show Topaz-specific rows, hide most normal ones
    _setRow('topazSrcRow',       true);
    _setRow('topazResRow',       true);
    _setRow('topazFactorRow',    !!tm.hasFactor);
    _setRow('topazFpsRow',       true);
    _setRow('topazSlowmoRow',    true);
    _setRow('topazCreativityRow',!!tm.hasCreativity);
    // Hide incompatible rows
    _setRow('videoResInfoRow',   false);
    _setRow('veoResRow',         false);
    _setRow('lumaResRow',        false);
    _setRow('wanResRow',         false);
    _setRow('wan27vParams',      false);
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
    _setRow('videoV2VSection',   false);
    _setRow('lumaVideoParams',   false);
    _setRow('veoRefModeRow',     false);
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
    document.getElementById('videoModelDesc').textContent = mvm.desc;
    // Reuse topazSrcRow for source video selection
    _setRow('topazSrcRow',        true);
    _setRow('magnificVidOpts',    true);
    _setRow('topazResRow',        false);
    _setRow('topazFactorRow',     false);
    _setRow('topazFpsRow',        false);
    _setRow('topazSlowmoRow',     false);
    _setRow('topazCreativityRow', false);
    _setRow('videoResInfoRow',    false);
    _setRow('veoResRow',          false);
    _setRow('lumaResRow',         false);
    _setRow('wanResRow',          false);
    _setRow('wan27vParams',       false);
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
    _setRow('videoV2VSection',    false);
    _setRow('lumaVideoParams',    false);
    _setRow('veoRefModeRow',      false);
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
  // Restore button label
  const lbl = document.getElementById('videoGenBtnLabel');
  if (lbl) lbl.textContent = '▶ Generate Video';
  const hint = document.getElementById('videoGenTimeHint');
  if (hint) hint.textContent = 'Generation takes 1–5 min';

  const m = VIDEO_MODELS[key];
  if (!m) return;
  document.getElementById('videoModelDesc').textContent = m.desc;

  // Resolution info
  const resEl = document.getElementById('videoResInfo');
  const resInfoRow = document.getElementById('videoResInfoRow');
  const hasResSwitcher = m.type === 'veo' || m.type === 'luma_video' || m.type === 'wan_video';
  if (resInfoRow) resInfoRow.style.display = hasResSwitcher ? 'none' : '';
  if (resEl && !hasResSwitcher) {
    const isPro = key.includes('_pro');
    resEl.textContent = isPro ? '1080p · ' + (m.refMode === 'none' ? 'T2V' : 'I2V') : '720p · ' + (m.refMode === 'none' ? 'T2V' : 'I2V');
  }

  // Ref panel — show/hide and configure based on refMode
  const refSec = document.getElementById('videoRefSection');
  const refLabel = document.getElementById('videoRefLabel');
  const refNote = document.getElementById('videoRefNote');
  const refCount = document.getElementById('videoRefCount');
  const hasRefs = m.refMode && m.refMode !== 'none';
  if (refSec) refSec.style.display = hasRefs ? 'block' : 'none';

  // V2V Motion Control section
  const v2vSec = document.getElementById('videoV2VSection');
  if (v2vSec) v2vSec.style.display = m.refMode === 'video_ref' ? 'block' : 'none';

  if (hasRefs) {
    if (refLabel) refLabel.childNodes[0].textContent = m.refLabel || 'Reference images';
    // Clip to new model's maxRefs (don't clear — preserve refs across model switch)
    if (videoRefs.length > m.maxRefs) videoRefs = videoRefs.slice(0, m.maxRefs);
    if (refCount) refCount.textContent = `${videoRefs.length} / ${m.maxRefs}`;
    if (refNote && m.refMode === 'keyframe') {
      refNote.textContent = 'Add start frame first, then end frame.';
      refNote.style.display = 'block';
    } else if (refNote && m.refMode === 'multi') {
      refNote.textContent = `Reference subjects as @Element1, @Element2... in your prompt.`;
      refNote.style.display = 'block';
    } else if (refNote && m.refMode === 'wan_r2v') {
      refNote.textContent = 'Add image/video refs. Reference them as Character1, Character2... in your prompt.';
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

  // Duration — slider for continuous, radio buttons for fixed options (older models)
  const durSlider = document.getElementById('videoDuration');
  const durRadioRow = document.getElementById('videoDurRadioRow');
  if (m.durOptions) {
    // Fixed options (e.g. 5s / 10s) — show radios, hide slider
    const sliderRow = document.getElementById('videoDurSliderRow');
    if (sliderRow) sliderRow.style.display = 'none';
    if (durRadioRow) {
      durRadioRow.style.display = '';
      durRadioRow.innerHTML = m.durOptions.map(d =>
        `<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;margin-right:10px;font-size:11px;color:var(--dim);">
          <input type="radio" name="videoDurFixed" value="${d}" ${d === (m.defaultDur !== undefined ? m.defaultDur : m.durOptions[0]) ? 'checked' : ''} onchange="document.getElementById('videoDuration').value=this.value;document.getElementById('videoDurVal').textContent=this.value+'s'">
          ${d}s
        </label>`
      ).join('');
      // Sync slider value to first option
      const defDur = m.defaultDur !== undefined ? m.defaultDur : m.durOptions[0];
      if (durSlider) { durSlider.value = defDur; durSlider.max = m.maxDur; }
      const durValEl = document.getElementById('videoDurVal');
      if (durValEl) durValEl.textContent = defDur + 's';
    }
  } else {
    // Continuous slider
    const sliderRow = document.getElementById('videoDurSliderRow');
    if (sliderRow) sliderRow.style.display = '';
    if (durRadioRow) durRadioRow.style.display = 'none';
    if (durSlider) {
      durSlider.max = m.maxDur;
      if (parseInt(durSlider.value) > m.maxDur) {
        durSlider.value = m.maxDur;
        const durValEl = document.getElementById('videoDurVal');
        if (durValEl) durValEl.textContent = m.maxDur + 's';
      }
    }
  }
  const durNote = document.getElementById('videoDurNote');
  if (durNote) durNote.textContent = m.durOptions ? `Fixed: ${m.durOptions.join('s / ')}s` : (m.maxDur < 15 ? `Max ${m.maxDur}s` : '');

  // Aspect ratio: hide for I2V single (inferred from image) — but show for Veo and Luma (T2V/I2V toggle)
  const arRow = document.getElementById('videoAspectRow');
  if (arRow) arRow.style.display = (m.refMode === 'single' || m.refMode === 'single_end') && m.type !== 'veo' && m.type !== 'luma_video' ? 'none' : '';

  // Veo resolution selector — show only for Veo models, rebuild options per model
  const veoResRow = document.getElementById('veoResRow');
  const veoResSel = document.getElementById('veoResolution');
  if (veoResRow) veoResRow.style.display = m.type === 'veo' ? '' : 'none';
  if (veoResSel && m.type === 'veo') {
    const resLabels = {
      '720p':  '720p — HD Standard',
      '1080p': '1080p — Full HD',
      '4k':    '4K — Ultra HD  ·  $$$$',
    };
    const curRes = veoResSel.value;
    veoResSel.innerHTML = (m.resolutions || ['720p', '1080p']).map(r =>
      `<option value="${r}">${resLabels[r] || r}</option>`
    ).join('');
    // Restore previous selection if still valid, else default to 1080p
    if (m.resolutions?.includes(curRes)) veoResSel.value = curRes;
    else veoResSel.value = '1080p';
  }

  // Veo ref mode selector
  const veoRefModeRow = document.getElementById('veoRefModeRow');
  if (veoRefModeRow) veoRefModeRow.style.display = m.type === 'veo' ? '' : 'none';
  if (m.type === 'veo') {
    onVeoRefModeChange(document.getElementById('veoRefMode')?.value || 't2v');
  }

  // Luma Ray3 controls — show/hide panel + configure
  // Ray2/Ray2-Flash: only resolution selector, no special panel
  // Ray3+: full controls (loop, colorMode, charRef)
  const isLumaRay3 = m.type === 'luma_video' && (m.modelId?.includes('ray-3') || m.modelId?.includes('ray-hdr'));
  const lumaPanel = document.getElementById('lumaVideoParams');
  if (lumaPanel) lumaPanel.style.display = isLumaRay3 ? '' : 'none';
  if (m.type === 'luma_video') {
    // Show ref panel for keyframes
    const refSec = document.getElementById('videoRefSection');
    const refLabel = document.getElementById('videoRefLabel');
    const refCount = document.getElementById('videoRefCount');
    if (refSec) refSec.style.display = 'block';
    if (refLabel) refLabel.childNodes[0].textContent = 'Keyframes (optional)';
    if (refCount) refCount.textContent = `${videoRefs.length} / 2`;
    // Rebuild resolution select
    const lumaResSel = document.getElementById('lumaResolution');
    if (lumaResSel) {
      const lumaResLabels = { '540p': '540p', '720p': '720p', '1080p': '1080p — native', '4k': '4K — upscaled' };
      lumaResSel.innerHTML = (m.resolutions || ['720p', '1080p']).map(r =>
        `<option value="${r}"${r === '1080p' ? ' selected' : ''}>${lumaResLabels[r] || r}</option>`
      ).join('');
    }
    // Show resolution row (always for luma)
    const lumaResRow = document.getElementById('lumaResRow');
    if (lumaResRow) lumaResRow.style.display = '';
    if (isLumaRay3) {
      // HDR row + char ref
      const hdrRow = document.getElementById('lumaHdrRow');
      if (hdrRow) hdrRow.style.display = m.supportsHdr ? '' : 'none';
      const charRow = document.getElementById('lumaCharRefRow');
      if (charRow) charRow.style.display = m.supportsCharRef ? '' : 'none';
    }
    renderVideoRefPanel();
  } else {
    const lumaResRow = document.getElementById('lumaResRow');
    if (lumaResRow) lumaResRow.style.display = 'none';
  }

  // WAN resolution row — shown for all wan_video models
  const wanResRow = document.getElementById('wanResRow');
  if (wanResRow) wanResRow.style.display = m.type === 'wan_video' ? '' : 'none';

  const wan27vParams = document.getElementById('wan27vParams');
  if (wan27vParams) wan27vParams.style.display = m.type === 'wan27_video' ? '' : 'none';
  // Extend video row: only I2V (single_end refMode)
  const wan27vExtendRow = document.getElementById('wan27vExtendRow');
  if (wan27vExtendRow) wan27vExtendRow.style.display = (m.type === 'wan27_video' && m.refMode === 'single_end') ? '' : 'none';

  // wan27_video has own params panel → hide generic duplicate rows
  if (m.type === 'wan27_video') {
    _setRow('videoResInfoRow', false);
    _setRow('videoDurRow',     false);
    _setRow('videoCfgRow',     false);
    _setRow('videoCountRow',   false);
  }

  const wan27eSrcRow  = document.getElementById('wan27eSrcRow');
  const wan27eParams  = document.getElementById('wan27eParams');
  const isWan27e = m.type === 'wan27e_video';
  if (wan27eSrcRow) wan27eSrcRow.style.display = isWan27e ? '' : 'none';
  if (wan27eParams) wan27eParams.style.display  = isWan27e ? '' : 'none';
  if (isWan27e) {
    _setRow('videoResInfoRow', false);
    _setRow('videoDurRow',     false);
    _setRow('videoCfgRow',     false);
    _setRow('videoCountRow',   false);
  }

  updateVideoResInfo();
}

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
  const sel = document.getElementById('veoResolution');
  const note = document.getElementById('veoResNote');
  if (note) note.style.display = sel?.value === '4k' ? 'block' : 'none';
  updateVideoResInfo();
}

function updateVideoResInfo() {
  const modelKey = getActiveVideoModelKey();
  const m = VIDEO_MODELS[modelKey];
  const resEl = document.getElementById('videoResInfo');
  const resInfoRow = document.getElementById('videoResInfoRow');
  if (!m) return;

  const hasResSwitcher = m.type === 'veo' || m.type === 'luma_video' || m.type === 'wan_video';
  const hasOwnPanel    = m.type === 'wan27_video' || m.type === 'wan27e_video';
  if (resInfoRow) resInfoRow.style.display = (hasResSwitcher || hasOwnPanel) ? 'none' : '';
  if (!resEl || hasResSwitcher || hasOwnPanel) return;

  if (m.type === 'veo') {
    const res = document.getElementById('veoResolution')?.value || '720p';
    const mode = videoRefs.length > 0 ? 'I2V' : 'T2V';
    resEl.textContent = `${res} · ${mode} · Google`;
  } else {
    const aspect = document.getElementById('videoAspectRatio')?.value || '16:9';
    const isPro = modelKey.includes('_pro');
    resEl.textContent = `${isPro ? '1080p' : '720p'} · ${aspect}`;
  }
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

// ── Video refs (unified: start frame, end frame, multi-ref) ──
function addVideoRef(asset) {
  const m = VIDEO_MODELS[getActiveVideoModelKey()] || {};
  const max = m.maxRefs || 0;
  const storageMax = max > 0 ? max : REF_GLOBAL_MAX;
  if (videoRefs.length >= storageMax) { toast(`Video reference limit reached (${storageMax})`, 'err'); return; }
  if (videoRefs.some(r => r.assetId === asset.id)) { toast(`${asset.autoName} is already a reference`, 'ok'); return; }
  videoRefs.push({
    assetId: asset.id,
    autoName: asset.autoName,
    userLabel: asset.userLabel || '',
    mimeType: asset.mimeType || 'image/png',
    thumb: asset.thumb || null,
    dims: asset.dims || null,
  });
  // Auto-switch Veo to I2V when first ref is added in T2V mode
  const veoRefModeEl = document.getElementById('veoRefMode');
  if (m.type === 'veo' && veoRefModeEl?.value === 't2v') {
    veoRefModeEl.value = 'i2v';
    onVeoRefModeChange('i2v');
    return; // onVeoRefModeChange calls renderVideoRefPanel
  }
  renderVideoRefPanel();
  if (max === 0) {
    toast(`${asset.autoName} added as video ref — switch model to use it`, 'ok');
  }
  renderAssets?.();  // update REF badge in asset library
}

function removeVideoRef(idx) {
  videoRefs.splice(idx, 1);
  renderVideoRefPanel();
  renderAssets?.();  // update REF badge in asset library
}

// ── Ref label helpers — model-specific naming rules ───────
// Returns the label shown in the thumbnail for a video ref
function getVideoRefDisplayLabel(r, idx, m) {
  const mode = m?.refMode || '';
  if (mode === 'keyframe' || mode === 'single_end') return idx === 0 ? 'Start' : 'End';
  if (mode === 'single')    return 'Start';
  if (mode === 'multi')     return `Element${idx + 1}`;   // Kling O3: fixed API name
  if (mode === 'wan_r2v')   return `Character${idx + 1}`; // Wan R2V: fixed API name
  if (mode === 'video_ref') return 'Character ref';
  return r.userLabel || r.autoName || `Ref ${idx + 1}`;
}

// Returns the text inserted into the prompt when user selects a ref mention
// (without prefix — prefix is added by getVideoRefMentionPrefix)
function getVideoRefMentionText(r, idx, m) {
  const mode = m?.refMode || '';
  if (mode === 'multi')   return `Element${idx + 1}`;
  if (mode === 'wan_r2v') return `Character${idx + 1}`;
  return (r.userLabel || r.autoName || `ref${idx + 1}`).replace(/\s+/g, '_');
}

// Returns the trigger prefix for the model — '@' for most, '' for Wan R2V (uses plain words)
function getVideoRefMentionPrefix(m) {
  return m?.refMode === 'wan_r2v' ? '' : '@';
}

// Returns true for refModes where the thumbnail label is model-fixed (not user-editable)
function isVideoRefLabelFixed(m) {
  const mode = m?.refMode || '';
  return ['keyframe', 'single_end', 'single', 'multi', 'wan_r2v', 'video_ref'].includes(mode);
}

function renderVideoRefPanel() {
  const panel = document.getElementById('videoRefPanelScroll');
  const countEl = document.getElementById('videoRefCount');
  const m = VIDEO_MODELS[getActiveVideoModelKey()] || {};
  const max = m.maxRefs || 0;
  if (!panel) return;
  if (countEl) countEl.textContent = `${videoRefs.length} / ${max}`;

  const tiles = videoRefs.map((r, i) => {
    const label = getVideoRefDisplayLabel(r, i, m);
    const fixedLabel = isVideoRefLabelFixed(m);
    const src = r.thumb ? `data:image/jpeg;base64,${r.thumb}` : '';
    const renameAttr = fixedLabel ? '' : `ondblclick="startVideoRefRename(${i}, this)"`;
    return `
    <div class="rth2" data-vidx="${i}">
      <img class="rth2-img" src="${src}" alt="${escHtml(label)}" title="Preview">
      <div class="del-ref2" onclick="event.stopPropagation();removeVideoRef(${i})" title="Remove">×</div>
      <div class="rth2-describe" onclick="event.stopPropagation();describeVideoRef(${i})" title="Describe image">✦ Describe</div>
      <div class="rth2-label" title="${escHtml(label)}" ${renameAttr}>${escHtml(label)}</div>
    </div>`;
  }).join('');

  const addTile = videoRefs.length < max ? `
    <div class="ref-add-tile" id="videoRefAddTile" onclick="document.getElementById('videoRefInput').click()" title="Add ref">
      <span>＋</span>
      <div style="font-size:9px;color:var(--dim2);text-align:center;line-height:1.4;margin-top:2px;">Add ref</div>
    </div>` : '';

  panel.innerHTML = tiles + addTile;

  // Init prev key on first render (so model switches know what to reverse from)
  if (_prevVideoModelKey === null) _prevVideoModelKey = getActiveVideoModelKey();

  // Re-apply model-specific @mention names when refs change (not during model switch)
  if (!_videoModelSwitching && typeof rewriteVideoPromptForModel === 'function') {
    rewriteVideoPromptForModel(m, m);  // same model, refs shifted → re-number
  }
}

// ── Inline rename video ref label (dblclick) ─────────────
function startVideoRefRename(idx, labelEl) {
  if (labelEl.querySelector('input')) return;
  const r = videoRefs[idx];
  const current = r.userLabel || r.autoName || `ref ${idx + 1}`;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.placeholder = 'Ref name…';
  input.style.cssText = 'width:84px;font-size:9px;padding:1px 2px;background:var(--s2);border:1px solid var(--accent);color:var(--text);outline:none;font-family:inherit;';
  labelEl.textContent = '';
  labelEl.appendChild(input);
  input.focus(); input.select();
  const commit = async () => {
    input.remove();
    const val = input.value.trim();
    videoRefs[idx].userLabel = val;
    // If ref came from asset — update asset in DB too (same as startAssetRename)
    if (r.assetId) {
      const asset = await dbGet('assets', r.assetId);
      if (asset) {
        asset.userLabel = val === asset.autoName ? '' : val;
        await dbPut('assets', asset);
        // Sync back to any image refs using the same asset
        refs?.forEach(imgRef => { if (imgRef.assetId === r.assetId) imgRef.userLabel = asset.userLabel; });
      }
    }
    renderVideoRefPanel();
    renderAssets?.();
    renderRefThumbs?.();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { videoRefs[idx].userLabel = r.userLabel; input.blur(); }
  });
}

function videoRefFileSelected(files) {
  if (!files || !files.length) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const mimeType = file.type || 'image/png';
    const b64 = e.target.result.split(',')[1];
    if (!b64) return;
    // Save to assets DB — video refs are asset links, same as image refs
    const asset = await createAsset(b64, mimeType, 'upload');
    addVideoRef(asset);
    // Refresh assets view if open
    if (document.getElementById('assetsView')?.classList.contains('show')) {
      renderAssets?.();
      renderAssetFolders?.();
    }
    toast(`${asset.autoName} added as video reference`, 'ok');
  };
  reader.readAsDataURL(file);
}

// ── Asset picker for video refs ─────────────────────────
// ── Luma character ref helpers (Ray3 only) ───────────────
async function lumaPickCharRef() {
  document.getElementById('lumaCharRefInput')?.click();
}

async function lumaCharRefFileSelected(files) {
  const file = files?.[0];
  if (!file) return;
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = () => rej(new Error('Read error'));
    r.readAsDataURL(file);
  });
  const b64 = dataUrl.split(',')[1];
  const mimeType = file.type || 'image/png';
  const asset = await createAsset(b64, mimeType, 'upload');
  _setLumaCharRef(asset);
  document.getElementById('lumaCharRefInput').value = '';
}

function lumaPickCharRefFromAssets() {
  window._lumaPickingCharRef = true;
  toast('Select an asset to use as character reference', 'ok');
  switchView('assets');
}

function lumaClearCharRef() {
  document.getElementById('lumaCharRefAssetId').value = '';
  document.getElementById('lumaCharRefName').textContent = 'None';
  const clearBtn = document.getElementById('lumaCharRefClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
}

function _setLumaCharRef(asset) {
  document.getElementById('lumaCharRefAssetId').value = asset.id;
  document.getElementById('lumaCharRefName').textContent = asset.userLabel || asset.autoName || 'ref';
  const clearBtn = document.getElementById('lumaCharRefClearBtn');
  if (clearBtn) clearBtn.style.display = '';
}

function videoPickFromAssets(slot) {
  window._videoAssetPickMode = true;
  window._videoAssetPickSlot = slot;
  toast('Select an asset to use as video reference', 'ok');
  switchView('assets');
}

function videoAssetPickConfirm(assetId) {
  // Luma character ref pick
  if (window._lumaPickingCharRef) {
    window._lumaPickingCharRef = false;
    dbGet('assets', assetId).then(asset => {
      if (!asset) return;
      _setLumaCharRef(asset);
      switchView('gen');
      setGenMode('video');
      toast('Character reference set ✓', 'ok');
    });
    return true;
  }
  if (!window._videoAssetPickMode) return false;
  dbGet('assets', assetId).then(asset => {
    if (!asset) return;
    addVideoRef(asset);
    window._videoAssetPickMode = false;
    window._videoAssetPickSlot = null;
    switchView('gen');
    setGenMode('video');
    toast('Reference added ✓', 'ok');
  });
  return true;
}

// ── Generate video ───────────────────────────────────────
async function generateVideo() {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    toast('Application integrity check failed. Please use the original GIS.', 'err');
    return;
  }
  const falKey = document.getElementById('fluxApiKey')?.value?.trim() || '';
  const googleKey = document.getElementById('apiKey')?.value?.trim() || localStorage.getItem('gis_apikey') || '';
  const lumaKey  = (localStorage.getItem('gis_luma_apikey') || '').trim();
  const proxyUrl = localStorage.getItem('gis_proxy_url')?.trim() || '';

  // ── Topaz dispatch ──────────────────────────────────────
  const activeKey = getActiveVideoModelKey();
  if (TOPAZ_MODELS[activeKey]) {
    await _generateTopazJob(activeKey, proxyUrl);
    return;
  }
  // ── Magnific Video dispatch ──────────────────────────────
  if (MAGNIFIC_VIDEO_MODELS[activeKey]) {
    const freepikKey = (localStorage.getItem('gis_freepik_apikey') || '').trim();
    if (!freepikKey) { showApiKeyWarning('Freepik API Key missing', 'Magnific Video requires a Freepik API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl)   { showApiKeyWarning('Proxy URL missing', 'Magnific Video requires the GIS proxy URL. Add it in the Setup tab.'); return; }
    await _generateMagnificVideoJob(activeKey, freepikKey, proxyUrl);
    return;
  }
  // ───────────────────────────────────────────────────────

  const modelKey = getActiveVideoModelKey();
  const model = VIDEO_MODELS[modelKey];
  if (!model) { toast('Select a video model', 'err'); return; }

  // Key validation per model type
  if (model.type === 'veo') {
    if (!googleKey) { showApiKeyWarning('Google API Key missing', 'Veo requires a Google AI API key. Add it in the Setup tab.'); return; }
  } else if (model.type === 'luma_video') {
    if (!lumaKey)  { showApiKeyWarning('Luma API Key missing', 'Ray3 / Ray3.14 requires a Luma API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'Luma video requires the GIS proxy URL. Add it in the Setup tab.'); return; }
  } else if (model.type === 'wan27_video') {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'WAN 2.7 requires a fal.ai API key. Add it in the Setup tab.'); return; }
  } else if (model.type === 'wan27e_video') {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'WAN 2.7 Video Edit requires a fal.ai API key. Add it in the Setup tab.'); return; }
    if (!wan27eSrcVideoId) { toast('Select a source video first — click ▷ Use on any video in the gallery', 'err'); return; }
  } else {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'Video generation requires a fal.ai API key. Add it in the Setup tab to start generating.'); return; }
  }

  const rawVideoPrompt = document.getElementById('videoPrompt')?.value?.trim();
  const refMode = model.refMode || 'none';
  // Most models with start/end frames support generation without prompt
  // EXCEPTIONS: Luma (API hard-requires prompt) and Kling via fal.ai (same)
  const veoFramesMode = model.type === 'veo' &&
    document.getElementById('veoRefMode')?.value === 'frames';
  const promptOptional = veoFramesMode ||
    (model.type !== 'luma_video' && model.type !== 'kling_video' &&
     (refMode === 'single_end' || refMode === 'single' || refMode === 'keyframe' ||
      refMode === 'wan_r2v' || refMode === 'multi'));
  if (!rawVideoPrompt && !promptOptional) { toast('Enter a prompt', 'err'); return; }
  // Append style + camera suffix
  const vStyleSuffix = buildStyleSuffix('flux');
  const vCameraSuffix = buildCameraSuffix();
  const vExtra = [vStyleSuffix, vCameraSuffix].filter(Boolean).join(', ');
  const prompt = vExtra ? (rawVideoPrompt ? rawVideoPrompt + ', ' + vExtra : vExtra) : rawVideoPrompt;

  // Validate refs based on refMode
  // (refMode already declared above)
  // Veo + Luma: refs are optional — 0 refs = T2V, 1+ refs = I2V/Keyframes automatically
  // wan27_r2v: refs optional (image_urls + video_urls)
  if ((refMode === 'single' || refMode === 'single_end') && videoRefs.length === 0 && model.type !== 'veo' && model.type !== 'luma_video' && model.type !== 'wan27e_video' && model.refMode !== 'wan_r2v') {
    toast('Start frame image required for I2V', 'err'); return;
  }
  if (refMode === 'keyframe' && videoRefs.length < 2) {
    toast(`Both start and end frames required (have ${videoRefs.length}/2)`, 'err'); return;
  }
  if (refMode === 'video_ref' && !videoMotionFile && !videoMotionVideoId) {
    toast('Upload or pick a motion reference video for Motion Control', 'err'); return;
  }

  // V2V: upload motion video to R2 before submitting jobs
  let motionVideoUrl = null;
  if (refMode === 'video_ref' && (videoMotionFile || videoMotionVideoId)) {
    toast('Uploading motion video…', 'ok');
    try {
      if (videoMotionFile) {
        motionVideoUrl = await uploadVideoToFal(videoMotionFile, falKey);
      } else {
        // Gallery pick — load binary from DB and upload to R2
        const full = await dbGet('videos', videoMotionVideoId);
        if (!full?.videoData) throw new Error('Video data not found in gallery');
        const blob = new Blob([full.videoData], { type: full.mimeType || 'video/mp4' });
        motionVideoUrl = await uploadVideoToFal(blob, falKey);
      }
    } catch(e) {
      toast(`Motion video upload failed: ${e.message}`, 'err'); return;
    }
  }

  const duration = parseInt(document.getElementById('videoDuration')?.value || '5');
  const aspectRatio = document.getElementById('videoAspectRatio')?.value || '16:9';
  const enableAudio = model.hasAudio && (document.getElementById('videoEnableAudio')?.checked ?? true);
  const targetFolder = document.getElementById('videoTargetFolder')?.value || 'all';
  const cfgScale = parseFloat(document.getElementById('videoCfgScale')?.value || '0.5');
  const count = parseInt(document.querySelector('input[name="videoCount"]:checked')?.value || '1');
  const veoResolution = document.getElementById('veoResolution')?.value || '720p';
  const veoRefMode = document.getElementById('veoRefMode')?.value || 't2v';
  const veoDuration = parseInt(document.getElementById('videoDuration')?.value || '8');

  // Luma-specific params
  const lumaResolution = document.getElementById('lumaResolution')?.value || '1080p';
  // Duration: prefer custom Luma panel (Ray3 models), fallback to standard radio (Ray2 models)
  const lumaDurCustom = document.querySelector('input[name="lumaDuration"]:checked')?.value;
  const lumaDurStandard = document.querySelector('input[name="videoDurFixed"]:checked')?.value
                       || document.getElementById('videoDuration')?.value || '5';
  const lumaDurationSel = lumaDurCustom || (lumaDurStandard + 's');
  const lumaLoop = document.getElementById('lumaLoop')?.checked || false;
  const lumaColorMode = document.getElementById('lumaColorMode')?.value || 'sdr';
  // Character ref for Ray3 (single asset ID stored in hidden input)
  const lumaCharRefAssetId = document.getElementById('lumaCharRefAssetId')?.value || null;

  // WAN 2.7 I2V/T2V snap (wan27_video type — covers T2V + I2V + R2V)
  const wan27vSnap = model.type === 'wan27_video' ? {
    resolution:   document.getElementById('wan27vResolution')?.value || '1080p',
    duration:     parseInt(document.getElementById('wan27vDuration')?.value || '5'),
    negPrompt:    document.getElementById('wan27vNegPrompt')?.value?.trim() || '',
    promptExpand: document.getElementById('wan27vPromptExpand')?.checked !== false,
    safety:       document.getElementById('wan27vSafety')?.checked !== false,
    seed:         document.getElementById('wan27vSeed')?.value?.trim() || null,
    audioUrl:     document.getElementById('wan27vAudioUrl')?.value?.trim() || null,
    extendVideoId: wan27vSrcVideoId || null,
  } : null;

  // WAN 2.7 Video Edit snap
  const wan27eSnap = model.type === 'wan27e_video' ? {
    srcVideoId:   wan27eSrcVideoId,
    resolution:   document.getElementById('wan27eResolution')?.value || '1080p',
    duration:     document.getElementById('wan27eDuration')?.value || '0',
    aspectRatio:  document.getElementById('wan27eAspect')?.value || 'auto',
    audioSetting: document.getElementById('wan27eAudio')?.value || 'auto',
    safety:       document.getElementById('wan27eSafety')?.checked !== false,
    seed:         document.getElementById('wan27eSeed')?.value?.trim() || null,
  } : null;

  // Submit count jobs (parallel)
  const jobs = [];
  // Snapshot current refs at submit time — include imageData for resilience against asset deletion
  const videoRefsAtSubmit = await Promise.all(videoRefs.map(async r => {
    const snap = {
      assetId: r.assetId || null,
      mimeType: r.mimeType,
      autoName: r.autoName,
      userLabel: r.userLabel || '',
    };
    // Store imageData so refs survive if asset is later deleted
    if (r.data) {
      snap.imageData = r.data;
    } else if (r.assetId) {
      const asset = await dbGet('assets', r.assetId).catch(() => null);
      if (asset?.imageData) snap.imageData = asset.imageData;
    }
    return snap;
  }));
  for (let i = 0; i < count; i++) {
    const jobId = `vid_${Date.now()}_${i}_${Math.random().toString(36).substr(2,4)}`;
    const job = {
      id: jobId, modelKey, model, prompt, duration, aspectRatio, enableAudio,
      cfgScale, targetFolder, falKey, googleKey, lumaKey, proxyUrl,
      veoResolution, veoRefMode, veoDuration,
      lumaResolution, lumaDurationSel, lumaLoop, lumaColorMode, lumaCharRefAssetId,
      wan27vSnap, wan27eSnap,
      status: 'pending', startedAt: Date.now(),
      motionVideoUrl,
      videoRefsSnapshot: videoRefsAtSubmit,
    };
    videoJobs.push(job);
    videoShowPlaceholder(job);
    jobs.push(job);
  }
  renderVideoQueue();

  // Run all jobs concurrently
  await Promise.allSettled(jobs.map(job =>
    runVideoJob(job).catch(e => videoJobError(job, e.message || 'Unknown error'))
  ));
}


// ── Compress image for upload (max 10MB limit on fal.ai) ─
async function compressImageForUpload(base64, mimeType) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 2560;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      // JPEG 100% quality — preserve detail for video render
      const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
      const compressed = dataUrl.split(',')[1];
      resolve({ data: compressed, mimeType: 'image/jpeg' });
    };
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// ── Google Veo video generation ──────────────────────────
// Uses Gemini API (same key as NB2/Imagen) — no proxy needed.
// IMPORTANT: generateAudio is NOT sent — Gemini API Veo generates audio
// automatically; the field is not supported and causes 400 errors.
// Pattern: POST :predictLongRunning → poll operations/xyz → download MP4
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
  const parameters = {
    aspectRatio,
    durationSeconds: veoDuration,
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
  const deadline = Date.now() + 15 * 60 * 1000;

  await new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) { reject(new Error('Veo timeout after 15 minutes')); return; }
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

  const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
  job.status = 'done'; job.elapsed = `${elapsed}s`;

  const blob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
  const thumbData = await generateVideoThumb(blob);
  const veoDims = await _topazGetDims(blob).catch(() => null);

  const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const veoFps = _parseMp4Fps(videoArrayBuffer);
  const videoRecord = {
    id: videoId, ts: Date.now(), model: model.name, modelKey: job.modelKey, prompt: job.prompt,
    params: { duration: veoDuration, aspectRatio: job.aspectRatio, resolution: veoResolution, veoRefMode, ...(veoFps ? { fps: veoFps } : {}) },
    videoData: videoArrayBuffer, mimeType: 'video/mp4', duration: veoDuration,
    fileSize: videoArrayBuffer.byteLength,
    ...(veoDims?.w ? { outWidth: veoDims.w, outHeight: veoDims.h } : {}),
    folder: job.targetFolder === 'all' ? '' : job.targetFolder,
    favorite: false, cdnUrl: videoUri, cdnExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
    usedVideoRefs: job.videoRefsSnapshot || [],
  };

  await dbPut('videos', videoRecord);
  const { videoData, ...metaOnly } = videoRecord;
  await dbPut('video_meta', metaOnly);
  if (thumbData) await dbPut('video_thumbs', { id: videoId, data: thumbData });
  trackSpend('google', model.modelId, 1, veoDuration);

  renderVideoQueue();
  removeVideoPlaceholder(job);
  toast(`Veo video generated · ${elapsed}s`, 'ok');
  renderVideoResultCard(videoRecord, thumbData);
}

// ── fal.ai async queue for video ─────────────────────────
async function runVideoJob(job) {
  const { model, prompt, duration, aspectRatio, enableAudio, cfgScale = 0.5, falKey, proxyUrl = '' } = job;
  job.status = 'submitting';
  renderVideoQueue();

  // Dispatch to model-specific handler
  if (model.type === 'veo')          return callVeoVideo(job);
  if (model.type === 'luma_video')   return callLumaVideo(job);
  if (model.type === 'wan27_video')  return callWan27Video(job);
  if (model.type === 'wan27e_video') return callWan27eVideo(job);
  // seedance_video uses the same fal.ai queue path below

  // ── Kling / fal.ai path ──────────────────────────────────
  // Load image data from assets DB and compress (fal.ai hard limit: 10MB per file)
  const videoRefsSnap = await Promise.all(
    videoRefs.map(async r => {
      let imgData, mimeType;
      if (r.assetId) {
        const asset = await dbGet('assets', r.assetId);
        if (!asset?.imageData) throw new Error(`Asset not found for video ref: ${r.autoName || r.assetId}`);
        imgData = asset.imageData;
        mimeType = asset.mimeType || r.mimeType;
      } else if (r.data) {
        // Old format (pre-v102) — inline data from reuseVideoJob
        imgData = r.data;
        mimeType = r.mimeType || 'image/png';
      } else {
        throw new Error(`Video ref has no image data: ${r.autoName || 'unknown'}`);
      }
      return compressImageForUpload(imgData, mimeType);
    })
  );
  const refModeJob = model.refMode || 'none';
  // MINIMAL payload — Kling API uses strict Pydantic validation (extra fields = 422)
  // duration: string for most models, integer for Vidu Q3 (durationInt flag)
  // duration: clamp to model minDur/maxDur, convert to string or int per model flag
  const durNum = Math.max(model.minDur || 1, Math.min(model.maxDur || 120, parseInt(duration)));
  const payload = {};
  if (prompt) payload.prompt = prompt;  // omit entirely if empty — APIs reject empty string
  payload.duration = model.durationInt ? durNum : String(durNum);
  // aspect_ratio only for T2V (I2V infers from start image)
  if (refModeJob === 'none') payload.aspect_ratio = aspectRatio;
  // audio: always explicit — models with audioField use that key; default is 'generate_audio'
  // (omitting audio field causes fal.ai to default to true = unexpected cost)
  if (model.hasAudio) {
    const audioField = model.audioField || 'generate_audio';
    payload[audioField] = !!enableAudio;
  }
  // cfg_scale only when explicitly changed from default — omit otherwise
  if (typeof cfgScale === 'number' && Math.abs(cfgScale - 0.5) > 0.01) payload.cfg_scale = cfgScale;
  // resolution — model-fixed (Seedance/Vidu: always 720p) OR UI-selected (Wan: 720p/1080p)
  if (model.resolution) {
    payload.resolution = model.resolution;
  } else if (model.type === 'wan_video') {
    payload.resolution = document.getElementById('wanResolution')?.value || '1080p';
  }
  // multi_shots — Wan 2.6: send false to force single continuous shot (default = true = multi-shot)
  if (model.multiShots === false) payload.multi_shots = false;

  // Ref fields depend on model refMode
  // imageField overrides the default start frame field name (e.g. Seedance/Vidu/Wan use image_url)
  const imgField = model.imageField || 'start_image_url';
  if (refModeJob === 'single' && videoRefsSnap[0]) {
    payload[imgField] = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
  } else if (refModeJob === 'single_end') {
    // imageField applies to start frame; end is always end_image_url
    if (videoRefsSnap[0]) payload[imgField] = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
    if (videoRefsSnap[1]) payload.end_image_url = `data:${videoRefsSnap[1].mimeType};base64,${videoRefsSnap[1].data}`;
  } else if (refModeJob === 'keyframe') {
    if (videoRefsSnap[0]) payload.start_frame_image_url = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
    if (videoRefsSnap[1]) payload.end_frame_image_url = `data:${videoRefsSnap[1].mimeType};base64,${videoRefsSnap[1].data}`;
  } else if (refModeJob === 'wan_r2v') {
    // Wan 2.6 R2V Flash: refs → image_urls[] + optional video_urls[]
    // Refs are GIS image assets → always sent as image_urls (base64 data URIs)
    // Reference in prompt as Character1, Character2, Character3...
    const imageRefs = videoRefsSnap.filter(r => r.mimeType?.startsWith('image/'));
    const videoRefs_ = videoRefsSnap.filter(r => r.mimeType?.startsWith('video/'));
    if (imageRefs.length > 0)
      payload.image_urls = imageRefs.map(r => `data:${r.mimeType};base64,${r.data}`);
    if (videoRefs_.length > 0)
      payload.video_urls = videoRefs_.map(r => `data:${r.mimeType};base64,${r.data}`);
  } else if (refModeJob === 'multi' && videoRefsSnap.length > 0) {
    // Pokud model vyžaduje base image field (Kling O3 I2V: image_url required + elements optional)
    if (model.imageField) {
      payload[model.imageField] = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
    }
    payload.elements = videoRefsSnap.map((r, i) => ({
      name: `Element${i+1}`,
      images: [`data:${r.mimeType};base64,${r.data}`],
    }));
  } else if (refModeJob === 'video_ref') {
    // V2V / Motion Control: motion reference video + character image
    // character_orientation REQUIRED by fal.ai motion-control API
    // image_url REQUIRED — motion is applied to this character image
    if (!videoRefsSnap[0]) {
      throw new Error('Motion Control requires a character image — add one in the Refs panel.');
    }
    payload.character_orientation = 'video';
    if (job.motionVideoUrl) {
      payload.video_url = job.motionVideoUrl;  // pre-uploaded R2 URL
    }
    payload.image_url = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
  }

  // Submit to queue
  const logPayload = {...payload};
  ['start_image_url','image_url','end_image_url','start_frame_image_url','end_frame_image_url'].forEach(k => {
    if (logPayload[k]) logPayload[k] = logPayload[k].slice(0, 40) + '…';
  });
  console.log('[GIS Video] Submitting payload:', JSON.stringify(logPayload));
  const queueUrl = `https://queue.fal.run/${model.endpoint}`;
  const submitRes = await fetch(queueUrl, {
    method: 'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!submitRes.ok) {
    let errText = '';
    try { errText = await submitRes.text(); } catch(e) {}
    throw new Error(`Submit ${submitRes.status}: ${errText.slice(0,300) || 'unknown error'}`);
  }
  const submitted = await submitRes.json();
  const requestId = submitted.request_id;
  if (!requestId) {
    const err = JSON.stringify(submitted).slice(0, 200);
    throw new Error(`No request_id. Response: ${err}`);
  }

  job.requestId = requestId;
  job.status = 'queued';
  renderVideoQueue();
  updateVideoPlaceholderStatus(job, 'IN QUEUE…');

  // Poll for completion — use URLs from submit response (most reliable)
  const statusUrl = submitted.status_url || `${queueUrl}/requests/${requestId}/status`;
  const resultUrl = submitted.response_url || `${queueUrl}/requests/${requestId}`;
  const POLL_INTERVAL = 5000;
  const TIMEOUT = 20 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT;

  await new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) { reject(new Error('Timeout after 20 minutes')); return; }
      if (job.cancelled) { reject(new Error('Cancelled')); return; }
      try {
        const statusRes = await fetch(statusUrl, {
          headers: { 'Authorization': `Key ${falKey}` },
        });
        if (!statusRes.ok) { setTimeout(poll, POLL_INTERVAL); return; }
        const statusData = await statusRes.json();
        const status = statusData.status;
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);

        if (status === 'IN_QUEUE') {
          updateVideoPlaceholderStatus(job, `IN QUEUE · ${elapsed}s`);
        } else if (status === 'IN_PROGRESS') {
          job.status = 'running';
          renderVideoQueue();
          updateVideoPlaceholderStatus(job, `GENERATING · ${elapsed}s`);
        } else if (status === 'COMPLETED') {
          resolve();
          return;
        } else if (status === 'FAILED') {
          reject(new Error(statusData.error || 'Generation failed'));
          return;
        }
        setTimeout(poll, POLL_INTERVAL);
      } catch(e) {
        setTimeout(poll, POLL_INTERVAL);
      }
    };
    setTimeout(poll, POLL_INTERVAL);
  });

  // Fetch result — check status response for embedded output first
  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');

  let videoUrl = null;
  // Try getting output from a fresh status check (COMPLETED status may include output)
  try {
    const finalStatusRes = await fetch(statusUrl, { headers: { 'Authorization': `Key ${falKey}` } });
    if (finalStatusRes.ok) {
      const finalStatus = await finalStatusRes.json();
      videoUrl = finalStatus.output?.video?.url || finalStatus.video?.url;
    }
  } catch(e) { /* fall through to result URL */ }

  // Fall back to result URL
  if (!videoUrl) {
    const resultRes = await fetch(resultUrl, { headers: { 'Authorization': `Key ${falKey}` } });
    if (!resultRes.ok) {
      // Try to get error details from response body
      let errBody = '';
      try { errBody = await resultRes.text(); } catch(e) {}
      const errDetail = errBody.slice(0, 600);
      const errMsg = `Result fetch failed (${resultRes.status}): ${errDetail || 'no details'}`;
      console.error(errMsg, '\nPayload:', JSON.stringify(payload));
      throw new Error(errMsg);
    }
    const result = await resultRes.json();
    videoUrl = result.video?.url || result.output?.video?.url;
  }

  if (!videoUrl) throw new Error('No video URL in fal.ai result');

  // Download video as ArrayBuffer
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Video download failed: ${videoRes.status}`);
  const videoArrayBuffer = await videoRes.arrayBuffer();

  const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
  job.status = 'done';
  job.elapsed = `${elapsed}s`;

  // Generate thumbnail from first frame
  const blob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
  const thumbData = await generateVideoThumb(blob);
  const dims = await _topazGetDims(blob).catch(() => null);

  // Save to DB
  const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
  const fileSize = videoArrayBuffer.byteLength;
  const detectedFps = _parseMp4Fps(videoArrayBuffer);
  const videoRecord = {
    id: videoId,
    ts: Date.now(),
    model: job.model.name,
    modelKey: job.modelKey,
    prompt: job.prompt,
    params: { duration: job.duration, aspectRatio: job.aspectRatio, enableAudio: job.enableAudio, cfgScale: job.cfgScale, ...(detectedFps ? { fps: detectedFps } : {}) },
    videoData: videoArrayBuffer,
    mimeType: 'video/mp4',
    duration: job.duration,
    fileSize,
    ...(dims?.w ? { outWidth: dims.w, outHeight: dims.h } : {}),
    folder: job.targetFolder === 'all' ? '' : job.targetFolder,
    favorite: false,
    cdnUrl: videoUrl,
    cdnExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
    usedVideoRefs: job.videoRefsSnapshot || [],  // snapshot from submit time, not live global
  };

  await dbPut('videos', videoRecord);
  const { videoData, ...metaOnly } = videoRecord;
  await dbPut('video_meta', metaOnly);
  if (thumbData) await dbPut('video_thumbs', { id: videoId, data: thumbData });
  trackSpend('fal', '_fal_video', 1, job.duration || 5);

  renderVideoQueue();
  removeVideoPlaceholder(job);
  toast(`Video generated · ${elapsed}s`, 'ok');

  // Render result card in video output area
  renderVideoResultCard(videoRecord, thumbData);
}

// ── Luma Ray3 / Ray3.14 video generation ─────────────────
// Flow: GIS → Worker POST /luma/video/submit (uploads keyframes) → { generation_id }
//       GIS polls → Worker POST /luma/video/status → { status, video_url?, exr_url? }
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

  // Poll for completion (GIS polls, Worker just does single status checks)
  const POLL_MS = 5000;
  const TIMEOUT = 20 * 60 * 1000; // 20 minutes
  const deadline = Date.now() + TIMEOUT;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_MS));

    const statusResp = await fetch(`${proxyUrl}/luma/video/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ luma_key: lumaKey, generation_id }),
    });
    if (!statusResp.ok) {
      const err = await statusResp.json().catch(() => ({}));
      throw new Error(`Luma status ${statusResp.status}: ${err.error || statusResp.statusText}`);
    }
    const status = await statusResp.json();

    if (status.status === 'failed') {
      throw new Error(`Luma generation failed: ${status.error || 'unknown'}`);
    }

    if (status.status === 'done') {
      if (!status.video_url) throw new Error('Luma: done but no video_url');

      job.status = 'fetching';
      updateVideoPlaceholderStatus(job, 'DOWNLOADING…');

      // Download MP4 directly from Luma CDN (Worker never downloads video)
      const videoRes = await fetch(status.video_url);
      if (!videoRes.ok) throw new Error(`Luma video download failed (${videoRes.status})`);
      const videoArrayBuffer = await videoRes.arrayBuffer();

      const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
      job.status = 'done';
      job.elapsed = `${elapsed}s`;

      const blob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
      const thumbData = await generateVideoThumb(blob);
      const lumaDims = await _topazGetDims(blob).catch(() => null);

      // Build duration numeric value for DB (strip 's' suffix)
      const durSec = parseInt(lumaDurationSel || '5');

      const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const lumaFps = _parseMp4Fps(videoArrayBuffer);
      const videoRecord = {
        id: videoId, ts: Date.now(),
        model: model.name, modelKey,
        prompt,
        params: {
          aspectRatio, resolution: lumaResolution, duration: lumaDurationSel,
          loop: lumaLoop, colorMode: lumaColorMode, ...(lumaFps ? { fps: lumaFps } : {}),
        },
        videoData: videoArrayBuffer, mimeType: 'video/mp4',
        duration: durSec, fileSize: videoArrayBuffer.byteLength,
        ...(lumaDims?.w ? { outWidth: lumaDims.w, outHeight: lumaDims.h } : {}),
        folder: targetFolder === 'all' ? '' : targetFolder,
        favorite: false,
        cdnUrl: status.video_url,
        cdnExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
        // EXR URL stored for later download (if HDR+EXR was requested)
        exrUrl: status.exr_url || null,
        usedVideoRefs: videoRefsSnapshot || [],
      };

      await dbPut('videos', videoRecord);
      const { videoData: _vd, ...metaOnly } = videoRecord;
      await dbPut('video_meta', metaOnly);
      if (thumbData) await dbPut('video_thumbs', { id: videoId, data: thumbData });
      trackSpend('luma', model.modelId, 1, durSec);

      renderVideoQueue();
      removeVideoPlaceholder(job);

      const exrNote = status.exr_url ? ' · EXR ↓' : '';
      toast(`Ray3 video generated · ${elapsed}s${exrNote}`, 'ok');
      renderVideoResultCard(videoRecord, thumbData);
      return;
    }
    // status === 'pending' → continue polling
  }

  throw new Error('Luma video timeout — generation did not complete within 20 minutes');
}

// ── Thumbnail generation ─────────────────────────────────
async function generateVideoThumb(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.onloadeddata = () => {
      video.currentTime = 0.1;
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 180;
        canvas.getContext('2d').drawImage(video, 0, 0, 320, 180);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch(e) { URL.revokeObjectURL(url); resolve(null); }
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    video.src = url;
  });
}

// ── Placeholder cards ────────────────────────────────────
function videoShowPlaceholder(job) {
  const area = document.getElementById('videoOutputArea');
  const emptyState = document.getElementById('videoEmptyState');
  if (emptyState) emptyState.style.display = 'none';

  const isTopaz  = !!job.isTopaz;
  const modelName = isTopaz
    ? `✦ Topaz ${TOPAZ_MODEL_NAMES[job.topazModel] || job.topazModel}`
    : job.model.name;
  const subtitle  = isTopaz
    ? `${job.srcDuration}s · ${job.out_width}×${job.out_height}`
    : escHtml((job.prompt || '').slice(0, 80)) + ((job.prompt || '').length > 80 ? '…' : '');
  const durationLabel = isTopaz ? `${job.srcDuration}s` : `${job.duration}s`;

  const div = document.createElement('div');
  div.className = 'img-card placeholder-card';
  div.id = `vphold_${job.id}`;
  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="ph-body" style="aspect-ratio:16/9;">
      <div class="ph-shimmer"></div>
      <div class="ph-overlay">
        <div class="ph-top">
          <span class="ph-model">${modelName}</span>
          <span class="ph-elapsed">⟳ <span class="vphold-status">queued…</span></span>
        </div>
        <div class="ph-prompt-txt">${subtitle}</div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill">Model: <b>${modelName}</b></div>
      <div class="meta-pill">Duration: <b>${durationLabel}</b></div>
      <div class="meta-pill" style="color:var(--dim2)">processing…</div>
    </div>`;
  area.prepend(div);
}

function updateVideoPlaceholderStatus(job, statusText) {
  const el = document.getElementById(`vphold_${job.id}`);
  if (el) {
    const statusEl = el.querySelector('.vphold-status');
    if (statusEl) statusEl.textContent = statusText;
  }
}

function removeVideoPlaceholder(job) {
  const el = document.getElementById(`vphold_${job.id}`);
  if (el) el.remove();
}

// ── Result card in generate output ───────────────────────
// ── Video info helpers ────────────────────────────────────
// Returns structured info string: "1920×1080 · 24fps · 5s · 10.8MB"
function _videoInfoLine(rec) {
  const parts = [];
  // Resolution — pixel dims preferred, fallback to string label
  const w = rec.outWidth, h = rec.outHeight;
  if (w && h)                         parts.push(`${w}×${h}`);
  else if (rec.params?.resolution)    parts.push(rec.params.resolution);
  // FPS
  const fps = rec.params?.fps || rec.params?.topaz?.fps;
  if (fps) parts.push(`${fps}fps`);
  // Duration + size
  if (rec.duration) parts.push(`${rec.duration}s`);
  if (rec.fileSize) parts.push(`${(rec.fileSize/1024/1024).toFixed(1)}MB`);
  return parts.join(' · ');
}

function _videoDateStr(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en');
}

function renderVideoResultCard(rec, thumbData) {
  const area = document.getElementById('videoOutputArea');
  const emptyState = document.getElementById('videoEmptyState');
  if (emptyState) emptyState.style.display = 'none';

  const div = document.createElement('div');
  div.className = 'img-card';
  const thumbSrc = thumbData || '';
  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="img-wrap" style="cursor:zoom-in;aspect-ratio:16/9;background:#000;position:relative;">
      ${thumbSrc ? `<img src="${thumbSrc}" alt="Video thumbnail" style="width:100%;height:100%;object-fit:cover;">` : '<div style="width:100%;height:100%;background:#111;"></div>'}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:20px;margin-left:3px;">▶</span>
        </div>
      </div>
      <div style="position:absolute;bottom:5px;right:6px;background:rgba(0,0,0,.75);color:#fff;font-size:10px;padding:2px 5px;font-family:'IBM Plex Mono',monospace;">${rec.duration}s</div>
      <div class="img-card-liked-badge">♥</div>
      <div class="img-overlay">
        <div class="img-overlay-top">
          <span class="ov-badge model">${rec.model}</span>
          <span class="ov-badge dims">${rec.duration}s · ${(rec.fileSize/1024/1024).toFixed(1)}MB</span>
        </div>
        <div class="img-overlay-bottom">
          <button class="ibtn-ov" onclick="openVideoLightboxById('${rec.id}')">▶ Play</button>
          <button class="ibtn-ov" onclick="videoDownloadById('${rec.id}')">↓ MP4</button>
          <button class="ibtn-ov" onclick="reuseVideoJob('${rec.id}')">↺ Reuse</button>
          <button class="ibtn-ov like-btn" data-vid="${rec.id}" onclick="videoLikeById('${rec.id}', this)">♡ Like</button>
        </div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill"><b>${rec.model}</b></div>
      <div class="meta-pill">${_videoInfoLine(rec)}</div>
      <div class="meta-pill" style="color:var(--dim2);">${_videoDateStr(rec.ts)}</div>
    </div>`;
  div.querySelector('.img-wrap').onclick = e => {
    if (e.target.closest('button')) return;
    openVideoLightboxById(rec.id);
  };
  area.prepend(div);
}

// ── Video error ──────────────────────────────────────────
// Builds friendly error message — video-specific + delegates to image friendlyError
function friendlyVideoError(raw) {
  if (!raw) return 'Video generation failed. Please try again.';
  const m = raw.toString();

  // Video-specific errors
  if (/no video url|no video in result/i.test(m))       return 'No video returned — server may have filtered it';
  if (/source video.*not found|video data not found/i.test(m)) return 'Source video missing — re-add it and try again';
  if (/no source video|select a source video/i.test(m)) return 'Source video required — use ▷ on a video in gallery';
  if (/start frame.*required|no.*start.*frame/i.test(m)) return 'Start frame image required for I2V';
  if (/prompt.*required|prompt.*must be provided/i.test(m)) return 'Prompt required for this model';
  if (/missing prompt/i.test(m))                        return 'Prompt required — enter a description';
  if (/audio.*cost|generate_audio/i.test(m))            return 'Audio setting error — try again';
  if (/result fetch failed.*422/i.test(m))              return 'Server rejected payload (422) — check model settings';
  if (/submit.*422/i.test(m))                           return 'Server rejected request (422) — check model settings';
  if (/luma submit 400/i.test(m))                       return m.replace(/^Luma submit \d+:\s*/, '');
  if (/download.*404|video.*404/i.test(m))              return 'Video download failed — result may have expired';
  if (/timeout.*25 min|timeout.*30 min|timeout.*10 min/i.test(m)) return 'No result after timeout — server is slow, try Rerun';
  if (/cancelled/i.test(m))                             return 'Cancelled';

  // Delegate to image friendlyError for generic API/network errors
  return friendlyError(raw);
}

function videoJobError(job, msg) {
  job.status = 'error';
  job.errorMsg = msg;
  renderVideoQueue();

  // Find placeholder card and convert to error card
  const cardEl = document.getElementById(`vphold_${job.id}`);
  if (cardEl) {
    const isTopaz = !!job.isTopaz;
    const modelName = isTopaz
      ? `✦ Topaz ${TOPAZ_MODEL_NAMES[job.topazModel] || job.topazModel}`
      : (job.model?.name || '?');

    const isTimeout = /timeout|deadline/i.test(msg || '');
    const icon = isTimeout ? '⏱' : '⚠';
    const friendlyMsg = escHtml(friendlyVideoError(msg));
    const fullPrompt = escHtml((job.prompt || '').trim());
    const cardKey = job.id;

    // Video ref thumbnails
    const vrefs = job.videoRefsSnapshot || [];
    const refsHtml = vrefs.length
      ? `<div class="err-refs">${vrefs.map(r => r.thumb
          ? `<img class="err-ref-thumb" src="data:image/jpeg;base64,${r.thumb}" title="${escHtml(r.userLabel || r.autoName || '')}">`
          : `<div class="err-ref-thumb err-ref-nothumb">?</div>`
        ).join('')}</div>`
      : '';

    // Param chips — duration + model-specific info
    const chips = [];
    if (job.duration)   chips.push(`${job.duration}s`);
    if (job.resolution) chips.push(job.resolution);
    const chipHtml = chips.map(c => `<span class="err-chip">${escHtml(c)}</span>`).join('');

    cardEl.classList.remove('placeholder-card');
    cardEl.classList.add('error-card');

    cardEl.innerHTML = `
      <div class="img-card-top-spacer"></div>
      <div class="err-detail">
        <div class="err-banner">
          <span class="err-banner-icon">${icon}</span>
          <span class="err-banner-msg">${friendlyMsg}</span>
        </div>
        <div class="err-content">
          <div class="err-meta-row">
            <span class="err-model-label">${escHtml(modelName)}</span>
            ${chipHtml}
          </div>
          ${fullPrompt ? `<div class="err-prompt">${fullPrompt}</div>` : ''}
          ${refsHtml}
          <div class="err-btns">
            <button class="ibtn" onclick="reuseVideoJob_err('${cardKey}')" title="Load params into form to review and re-generate">↺ Reuse</button>
            <button class="ibtn err-rerun-btn" onclick="rerunVideoJob('${cardKey}')" title="Re-run this video job immediately">▶ Rerun</button>
          </div>
        </div>
      </div>
      <div class="img-card-meta">
        <div class="meta-pill">Model: <b>${escHtml(modelName)}</b></div>
        <div class="meta-pill" style="color:#c08060;">${icon} ${friendlyMsg}</div>
      </div>`;
  } else {
    // No placeholder card (e.g. Topaz background jobs) — just toast
    toast(`Video failed: ${friendlyVideoError(msg).slice(0, 100)}`, 'err');
  }
  console.error('Video job error:', job.id, msg);
}

// ── Video error card actions ──────────────────────────────
function reuseVideoJob_err(jobId) {
  const card = document.getElementById(`vphold_${jobId}`);
  const job = videoJobs.find(j => j.id === jobId);
  if (!job) { toast('Cannot reuse — job data lost', 'err'); return; }
  if (card) card.remove();

  // Restore into form (best-effort — model + prompt)
  switchView('gen');
  setGenMode('video');
  const promptEl = document.getElementById('videoPrompt');
  if (promptEl && job.prompt) promptEl.value = job.prompt;
  if (job.modelKey) {
    const sel = document.getElementById('videoModelSelect');
    if (sel) { sel.value = job.modelKey; onVideoModelChange(job.modelKey); }
  }
  toast('Parameters restored — review and click Generate', 'ok');
}

function rerunVideoJob(jobId) {
  const card = document.getElementById(`vphold_${jobId}`);
  const job = videoJobs.find(j => j.id === jobId);
  if (!job) { toast('Cannot rerun — job data lost', 'err'); return; }
  if (card) card.remove();
  // Re-queue with same parameters, fresh ID
  const { id: _id, status: _s, startedAt: _st, elapsed: _e,
          requestId: _r, cancelled: _c, errorMsg: _em, ...jobData } = job;
  const newJob = { ...jobData,
    id: `vid_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
    status: 'queued' };
  videoJobs.push(newJob);
  videoShowPlaceholder(newJob);
  renderVideoQueue();
  runVideoJob(newJob).catch(e => videoJobError(newJob, e.message || 'Unknown error'));
}

// ── Video queue rendering ────────────────────────────────
function renderVideoQueue() {
  // Update inline queue panel (in video gen panel)
  const panel = document.getElementById('videoQueuePanel');
  const list = document.getElementById('videoQueueList');
  if (panel && list) {
    const active = videoJobs.filter(j => j.status !== 'done' && j.status !== 'error');
    panel.style.display = active.length ? 'block' : 'none';
    list.innerHTML = _videoQueueItemsHtml();
  }
  // Update overlay queue
  renderVideoQueueOverlay();
}

function _videoQueueItemsHtml() {
  return videoJobs.slice(-20).reverse().map(j => {
    const elapsed = j.startedAt ? Math.round((Date.now() - j.startedAt) / 1000) + 's' : '';
    const statusTxt =
      j.status === 'pending'   ? 'waiting' :
      j.status === 'submitting'? 'submitting…' :
      j.status === 'uploading' ? 'uploading video…' :
      j.status === 'queued'    ? `in queue · ${elapsed}` :
      j.status === 'running'   ? `generating · ${elapsed}` :
      j.status === 'fetching'  ? 'downloading…' :
      j.status === 'done'      ? `✓ done · ${j.elapsed}` :
      `⚠ ${j.errorMsg?.slice(0,60) || 'error'}`;
    const isActive = ['pending','submitting','uploading','queued','running','fetching'].includes(j.status);
    return `<div class="qo-item ${j.status}">
      <div class="qo-dot ${j.status}"></div>
      <div class="qo-main">
        <div class="qo-model ${j.status}" style="font-size:11px;font-weight:600;margin-bottom:2px;">${j.model.name}</div>
        <div class="qo-prompt" style="font-size:10px;color:var(--dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escHtml(j.prompt.slice(0,80))}</div>
        <div class="qo-meta ${isActive ? 'qo-elapsed' : ''}" style="font-size:10px;margin-top:3px;">${statusTxt}</div>
      </div>
      ${isActive ? `<button class="qo-cancel-btn" onclick="videoCancelJob('${j.id}')" title="Cancel">✕</button>` : ''}
    </div>`;
  }).join('') || '<div style="padding:20px;text-align:center;font-size:11px;color:var(--dim2);">No video jobs yet</div>';
}

function renderVideoQueueOverlay() {
  const overlayList = document.getElementById('videoQueueOverlayList');
  if (overlayList) overlayList.innerHTML = _videoQueueItemsHtml();

  // Update badge count and dot
  const activeCount = videoJobs.filter(j => ['pending','submitting','uploading','queued','running','fetching'].includes(j.status)).length;
  const badge = document.getElementById('videoQoBadge');
  if (badge) badge.textContent = activeCount > 0 ? activeCount + ' running' : videoJobs.length + ' total';
  const dot = document.getElementById('videoQueueDot');
  if (dot) dot.style.background = activeCount > 0 ? 'var(--accent)' : 'var(--dim2)';
  const toggleBtn = document.getElementById('videoQueueToggleBtn');
  if (toggleBtn) toggleBtn.style.borderColor = activeCount > 0 ? 'var(--accent)' : 'var(--border)';
}

let videoQueueOverlayOpen = false;
function toggleVideoQueueOverlay() {
  videoQueueOverlayOpen = !videoQueueOverlayOpen;
  const overlay = document.getElementById('videoQueueOverlay');
  if (overlay) {
    overlay.style.transform = videoQueueOverlayOpen ? 'translateX(0)' : 'translateX(100%)';
    overlay.style.pointerEvents = videoQueueOverlayOpen ? 'all' : 'none';
  }
  if (videoQueueOverlayOpen) renderVideoQueueOverlay();
}

function videoCancelJob(id) {
  const job = videoJobs.find(j => j.id === id);
  if (job) { job.cancelled = true; job.status = 'error'; job.errorMsg = 'Cancelled'; }
  renderVideoQueue();
}

function videoCancelAllPending() {
  videoJobs.forEach(j => {
    if (['pending','submitting','uploading','queued'].includes(j.status)) {
      j.cancelled = true; j.status = 'error'; j.errorMsg = 'Cancelled';
    }
  });
  renderVideoQueue();
}

// ── Video gallery ─────────────────────────────────────────
async function refreshVideoGalleryUI() {
  const [folders, items] = await Promise.all([
    dbGetAll('videoFolders'),
    dbGetAll('video_meta'),
  ]);
  renderVideoFolders(folders, items);
  await renderVideoGallery(items);
  updateVideoFolderDropdown(folders);
  setTimeout(initVideoRubberBand, 100);
  // Background: detect dims for old videos missing outWidth (non-blocking)
  _migrateVideoDimsBackground(items);
}

// Silently detect + store pixel dims for videos that don't have them yet.
// Runs in background after gallery render — doesn't block UI.
async function _migrateVideoDimsBackground(items) {
  const missing = (items || []).filter(m => !m.outWidth);
  if (!missing.length) return;
  for (const meta of missing) {
    try {
      const full = await dbGet('videos', meta.id).catch(() => null);
      if (!full?.videoData) continue;
      const blob = new Blob([full.videoData], { type: full.mimeType || 'video/mp4' });
      const dims = await _topazGetDims(blob).catch(() => null);
      const fps  = _parseMp4Fps(full.videoData);
      if (!dims?.w && !fps) continue;
      // Patch both stores
      if (dims?.w) { meta.outWidth = dims.w; meta.outHeight = dims.h; full.outWidth = dims.w; full.outHeight = dims.h; }
      if (fps && !meta.params?.fps) {
        meta.params = { ...(meta.params || {}), fps };
        full.params = { ...(full.params || {}), fps };
      }
      await dbPut('video_meta', meta);
      await dbPut('videos', full);
      // Patch any rendered card in the DOM
      const card = document.querySelector(`.video-card[data-id="${meta.id}"]`);
      if (card) {
        const infoEl = card.querySelector('.video-card-info');
        if (infoEl) infoEl.textContent = _videoInfoLine(meta);
      }
    } catch(_) {}
    // Small yield between items — don't hammer the CPU
    await new Promise(r => setTimeout(r, 50));
  }
}

function renderVideoFolders(folders, items) {
  const list = document.getElementById('videoFolderList');
  if (!list) return;
  const counts = {};
  (items || []).forEach(i => { const f = i.folder || ''; counts[f] = (counts[f]||0)+1; });
  const allCount = (items||[]).length;
  const dV = (fid) => `ondragover="videoFolderDragOver(event)" ondragenter="videoFolderDragEnter(event,this)" ondragleave="videoFolderDragLeave(event,this)" ondrop="videoFolderDrop(event,'${fid}')"`;

  list.innerHTML = `
    <div class="folder-item ${videoCurrentFolder==='all'?'active':''}" onclick="setVideoFolder('all')" ${dV('all')}>
      <span class="fi">◈</span><span>All videos</span><span class="fc">${allCount}</span>
    </div>
    <div class="folder-item ${videoCurrentFolder==='fav'?'active':''}" onclick="setVideoFolder('fav')">
      <span class="fi">♥</span><span>Favorites</span><span class="fc">${(items||[]).filter(i=>i.favorite).length}</span>
    </div>
    ${(folders||[]).map(f => `
    <div class="folder-item ${videoCurrentFolder===f.id?'active':''}" onclick="setVideoFolder('${f.id}')" ${dV(f.id)}>
      <span class="fi">▸</span><span>${escHtml(f.name)}</span>
      <span class="fc">${counts[f.id]||0}</span>
      <button class="folder-del" onclick="event.stopPropagation();deleteVideoFolder('${f.id}')">✕</button>
    </div>`).join('')}`;
}

async function renderVideoGallery(items) {
  if (!items) items = await dbGetAll('video_meta');
  const grid = document.getElementById('videoGrid');
  const countEl = document.getElementById('videoCount');
  if (!grid) return;

  // Folder filter
  let allFiltered = items || [];
  if (videoCurrentFolder === 'fav') allFiltered = allFiltered.filter(i => i.favorite);
  else if (videoCurrentFolder !== 'all') allFiltered = allFiltered.filter(i => i.folder === videoCurrentFolder);

  // Advanced filters (model, date, search)
  videoFilters.q = document.getElementById('videoSearch')?.value?.toLowerCase().trim() || '';
  let filtered = videoFilterItems(allFiltered);

  // Sort
  const sort = document.getElementById('videoSort')?.value || 'newest';
  filtered.sort((a,b) => sort === 'newest' ? b.ts - a.ts : a.ts - b.ts);

  if (countEl) countEl.textContent = `${filtered.length} video${filtered.length!==1?'s':''}`;
  videoUpdateFilterBanner(filtered.length, allFiltered.length);

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--dim);font-size:13px;">No videos yet</div>';
    return;
  }

  grid.innerHTML = '';
  for (const item of filtered) {
    const thumb = await dbGet('video_thumbs', item.id).catch(()=>null);
    const thumbSrc = thumb?.data || '';
    const isLiked = item.favorite;
    const isSel = videoSelectedIds.has(item.id);
    const card = document.createElement('div');
    card.className = `video-card${isSel?' selected':''}${isLiked?' favorited':''}${(videoCurrentFolder==='all' && item.folder && item.folder!=='all')?' in-folder':''}`;
    card.dataset.id = item.id;
    card.draggable = true;
    card.addEventListener('dragstart', e => videoDragStart(e, item.id));
    card.innerHTML = `
      <div class="video-thumb-wrap">
        ${thumbSrc ? `<img src="${thumbSrc}" alt="">` : '<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;color:#333;font-size:24px;">🎬</div>'}
        <span class="video-duration-badge">${item.duration || '?'}s</span>
        ${item.params?.enableAudio ? '<span class="video-audio-badge">🔊</span>' : ''}
        <span class="video-liked-badge ${isLiked ? 'on' : 'off'}" onclick="event.stopPropagation();videoToggleLike('${item.id}')">${isLiked ? '♥' : '♡'}</span>
        <span class="video-sel" onclick="event.stopPropagation();videoToggleSelect('${item.id}')">✓</span>
        <div class="video-card-overlay">
          <button class="video-ibtn" onclick="event.stopPropagation();openVideoLightboxById('${item.id}')">▶ Play</button>
          <button class="video-ibtn" onclick="event.stopPropagation();videoDownloadById('${item.id}')">↓ MP4</button>
          <button class="video-ibtn" onclick="event.stopPropagation();reuseVideoJob('${item.id}')">↺ Reuse</button>
          <button class="video-ibtn" onclick="event.stopPropagation();useVideoFromGallery('${item.id}')" style="border-color:rgba(255,255,255,.5);color:#fff;">▷ Use</button>
          <button class="video-ibtn" onclick="event.stopPropagation();openTopazFromGallery('${item.id}')" style="border-color:rgba(212,160,23,.5);color:var(--accent);">✦ Upscale</button>
        </div>
      </div>
      <div class="video-card-meta">
        <div class="video-card-model">${item.model}</div>
        <div class="video-card-info">${_videoInfoLine(item)}</div>
        <div class="video-card-date">${_videoDateStr(item.ts)}</div>
      </div>`;
    card.onclick = e => { if (e.target.closest('button,span.video-sel,span.video-liked-badge')) return; videoCardClick(e, item.id); };
    // Hover playback: 2s delay → play video mini in thumbnail
    if (item.cdnUrl) {
      let hoverTimer = null;
      card.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(() => {
          const wrap = card.querySelector('.video-thumb-wrap');
          if (!wrap || wrap.querySelector('video')) return;
          const vid = document.createElement('video');
          vid.src = item.cdnUrl;
          vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true;
          vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;';
          wrap.appendChild(vid);
        }, 2000);
      });
      card.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        const vid = card.querySelector('.video-thumb-wrap video');
        if (vid) { vid.pause(); vid.remove(); }
      });
    }
    grid.appendChild(card);
  }
}

function videoCardClick(e, id) {
  // Plain click = play lightbox; Shift/Alt = rubber-band in initVideoRubberBand
  openVideoLightboxById(id);
}

function videoToggleSelect(id) {
  if (videoSelectedIds.has(id)) videoSelectedIds.delete(id);
  else videoSelectedIds.add(id);
  const card = document.querySelector(`.video-card[data-id="${id}"]`);
  if (card) card.classList.toggle('selected', videoSelectedIds.has(id));
  updateVideoBulkBar();
}

function updateVideoBulkBar() {
  const bar = document.getElementById('videoBulkBar');
  const countEl = document.getElementById('videoSelCount');
  if (bar) bar.style.display = videoSelectedIds.size > 0 ? 'flex' : 'none';
  if (countEl) countEl.textContent = videoSelectedIds.size;
}

function videoClearSelection() { videoSelectedIds.clear(); updateVideoBulkBar(); refreshVideoGalleryUI(); }
function videoSelectAll() {
  document.querySelectorAll('.video-card[data-id]').forEach(c => videoSelectedIds.add(c.dataset.id));
  updateVideoBulkBar();
  document.querySelectorAll('.video-card').forEach(c => c.classList.add('selected'));
}

function videoSearchDebounced() {
  clearTimeout(videoSearchTimer);
  videoSearchTimer = setTimeout(() => renderVideoGallery(), 200);
}

// ── Folders ───────────────────────────────────────────────
async function setVideoFolder(id) {
  videoCurrentFolder = id;
  await refreshVideoGalleryUI();
}

async function addVideoFolder() {
  const name = prompt('Folder name:');
  if (!name?.trim()) return;
  await dbPut('videoFolders', { id: `vf_${Date.now()}`, name: name.trim() });
  await refreshVideoGalleryUI();
}

// ── Patch only video_meta — no touch of videos store ───────────────────────
// Used for lightweight metadata changes: folder, favorite.
async function dbPatchVideoMeta(id, patch) {
  const meta = await dbGet('video_meta', id).catch(() => null);
  if (!meta) return;
  Object.assign(meta, patch);
  await dbPut('video_meta', meta);
}

async function deleteVideoFolder(id) {

  // Immediately red-highlight the folder row
  const folderEls = document.querySelectorAll('#videoFolderList .folder-item, #videoFolderList [data-fid]');
  folderEls.forEach(el => {
    if (el.onclick?.toString().includes(id) || el.dataset?.fid === id) {
      el.style.background = 'rgba(200,60,60,.18)';
      el.style.color = '#e07070';
      el.style.pointerEvents = 'none';
    }
  });

  const items = await dbGetAll('video_meta');
  await Promise.all(
    items.filter(m => m.folder === id).map(m => dbPatchVideoMeta(m.id, { folder: '' }))
  );
  await dbDelete('videoFolders', id);
  if (videoCurrentFolder === id) videoCurrentFolder = 'all';
  await refreshVideoGalleryUI();
}

async function updateVideoFolderDropdown(folders) {
  const sel = document.getElementById('videoTargetFolder');
  if (!sel) return;
  if (!folders) folders = await dbGetAll('videoFolders');
  const cur = sel.value;
  sel.innerHTML = '<option value="all">◈ All (no folder)</option>' +
    (folders||[]).map(f => `<option value="${f.id}">${escHtml(f.name)}</option>`).join('');
  if (cur) sel.value = cur;
}

// ── Like / Favorite ──────────────────────────────────────
async function videoToggleLike(id) {
  const meta = await dbGet('video_meta', id).catch(()=>null);
  if (!meta) return;
  const newFav = !meta.favorite;
  await dbPatchVideoMeta(id, { favorite: newFav });

  // Update gallery card UI
  const card = document.querySelector(`.video-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle('favorited', newFav);
    const badge = card.querySelector('.video-liked-badge');
    if (badge) {
      badge.classList.toggle('on', newFav);
      badge.classList.toggle('off', !newFav);
      badge.textContent = newFav ? '♥' : '♡';
    }
  }
  // Update output card (vid-result-card)
  const outCard = document.querySelector(`.vid-result-card[data-vid="${id}"]`);
  if (outCard) {
    outCard.classList.toggle('is-liked', newFav);
    const likeBtn = outCard.querySelector('.like-btn');
    if (likeBtn) likeBtn.textContent = newFav ? '♥ Unlike' : '♡ Like';
  }
  return newFav;
}

async function videoLikeById(id, btn) {
  const newState = await videoToggleLike(id);
  if (btn) btn.textContent = newState ? '♥ Unlike' : '♡ Like';
}

// ── Download ─────────────────────────────────────────────
async function videoDownloadById(id) {
  const rec = await dbGet('videos', id).catch(()=>null);
  if (!rec?.videoData) { toast('Video not found', 'err'); return; }
  const blob = new Blob([rec.videoData], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `kling-${id}.mp4`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function videoDownloadSelected() {
  for (const id of videoSelectedIds) await videoDownloadById(id);
}

// ── Reuse video setup ─────────────────────────────────────
async function reuseVideoJob(id) {
  if (!id) return;
  // Load meta from video_meta (fast), but load full record for refs (has image data)
  const rec = await dbGet('video_meta', id).catch(() => null);
  const fullRec = await dbGet('videos', id).catch(() => null);
  if (!rec && !fullRec) { toast('Video record not found', 'err'); return;}

  // Switch to video generation page
  switchView('gen');
  setGenMode('video');
  const meta = rec || fullRec;

  // Set prompt
  const promptEl = document.getElementById('videoPrompt');
  if (promptEl) promptEl.value = meta.prompt || '';

  // Set model
  const modelSel = document.getElementById('videoModelSelect');
  if (modelSel && meta.modelKey && VIDEO_MODELS[meta.modelKey]) {
    // Find if this variant belongs to a Kling group
    const groupKey = Object.keys(KLING_GROUPS).find(gk =>
      KLING_GROUPS[gk].variants.some(v => v.key === meta.modelKey)
    );
    if (groupKey) {
      modelSel.value = groupKey;
      onVideoModelChange(groupKey);  // populates klingVersionSelect with group default
      const verSel = document.getElementById('klingVersionSelect');
      if (verSel) { verSel.value = meta.modelKey; _applyVideoModel(meta.modelKey); }
    } else {
      modelSel.value = meta.modelKey;
      onVideoModelChange(meta.modelKey);
    }
  }

  // Set duration
  const dur = meta.params?.duration || meta.duration || 5;
  const durEl = document.getElementById('videoDuration');
  if (durEl) { durEl.value = String(dur); if (typeof updateVideoDurationHighlight !== 'undefined') updateVideoDurationHighlight(); }

  // Set aspect ratio
  const arEl = document.getElementById('videoAspectRatio');
  if (arEl && meta.params?.aspectRatio) arEl.value = meta.params.aspectRatio;

  // Set CFG scale
  const cfgEl = document.getElementById('videoCfgScale');
  const cfgVal = document.getElementById('videoCfgVal');
  if (cfgEl && typeof meta.params?.cfgScale === 'number') {
    cfgEl.value = meta.params.cfgScale;
    if (cfgVal) cfgVal.textContent = meta.params.cfgScale.toFixed(1);
  }

  // Set audio toggle
  const audioEl = document.getElementById('videoEnableAudio');
  if (audioEl && typeof meta.params?.enableAudio === 'boolean') {
    audioEl.checked = meta.params.enableAudio;
    updateAudioToggleUI();
  }

  // Restore refs — supports both formats:
  //   v102+:    { assetId, mimeType, autoName, userLabel } → load from assets DB
  //   pre-v102: { data/imageData, mimeType, ... }         → use inline data directly
  const refsSource = fullRec?.usedVideoRefs || rec?.usedVideoRefs || [];
  if (refsSource.length) {
    videoRefs = [];
    const m = VIDEO_MODELS[meta.modelKey] || {};
    const max = m.maxRefs || 10;
    for (const snap of refsSource) {
      if (videoRefs.length >= max) break;

      let imgData = null, mimeType = snap.mimeType || 'image/png', assetId = snap.assetId || null;

      // 1. Try assetId lookup (preferred — gets latest version from DB)
      if (assetId) {
        const asset = await dbGet('assets', assetId).catch(() => null);
        if (asset?.imageData) { imgData = asset.imageData; mimeType = asset.mimeType || mimeType; }
      }
      // 2. Fallback to stored imageData in snapshot (survives asset deletion)
      if (!imgData) imgData = snap.imageData || snap.data || null;
      // 3. Last resort: search assets by autoName
      if (!imgData && snap.autoName) {
        const all = await dbGetAll('assets').catch(() => []);
        const found = all.find(a => a.autoName === snap.autoName || (snap.userLabel && a.userLabel === snap.userLabel));
        if (found?.imageData) { imgData = found.imageData; mimeType = found.mimeType || mimeType; assetId = found.id; }
      }

      if (!imgData) continue;

      // Ensure asset exists in DB (for future snapshot assetId lookups)
      if (!assetId) {
        const asset = await createAsset(imgData, mimeType, 'reuse').catch(() => null);
        if (asset) assetId = asset.id;
      }

      const thumb = await generateThumb(imgData, mimeType).catch(() => null);
      videoRefs.push({
        assetId,
        data: imgData,
        mimeType,
        autoName: snap.autoName || 'ref',
        userLabel: snap.userLabel || '',
        thumb: thumb || null,
      });
    }
    renderVideoRefPanel();
    renderAssets?.();
    if (videoRefs.length) toast(`Setup loaded · ${videoRefs.length} ref(s) restored ✓`, 'ok');
    else toast('Video setup loaded ✓', 'ok');
  } else {
    toast('Video setup loaded ✓', 'ok');
  }

  // Close lightbox if open
  closeVideoLightbox?.();
}


async function videoDeleteById(id) {
  await dbDelete('videos', id);
  await dbDelete('video_meta', id);
  await dbDelete('video_thumbs', id);
  videoSelectedIds.delete(id);
}

async function videoDeleteSelected() {
  if (!videoSelectedIds.size) return;
  if (!confirm(`Delete ${videoSelectedIds.size} video(s)? This cannot be undone.`)) return;
  for (const id of videoSelectedIds) await videoDeleteById(id);
  videoSelectedIds.clear();
  updateVideoBulkBar();
  await refreshVideoGalleryUI();
}

// ── Move selected ─────────────────────────────────────────
async function videoMoveSelected() {
  const folders = await dbGetAll('videoFolders');
  if (!folders.length) { toast('No folders — create one first', 'err'); return; }
  const folderId = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);padding:20px;min-width:280px;display:flex;flex-direction:column;gap:8px;">
      <div style="font-family:Syne,sans-serif;font-weight:700;font-size:14px;margin-bottom:4px;">▷ Move ${videoSelectedIds.size} video(s)</div>
      ${folders.map(f => `<button class="ibtn" data-fid="${f.id}" style="justify-content:flex-start;padding:8px 12px;">${escHtml(f.name)}</button>`).join('')}
      <button class="ibtn" data-fid="all" style="justify-content:flex-start;padding:8px 12px;opacity:.7;">◈ All (no folder)</button>
      <button class="ibtn" id="_cancelMoveVid" style="margin-top:4px;">Cancel</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-fid]').forEach(btn => btn.onclick = () => { document.body.removeChild(ov); resolve(btn.dataset.fid); });
    ov.querySelector('#_cancelMoveVid').onclick = () => { document.body.removeChild(ov); resolve(null); };
    ov.onclick = e => { if (e.target === ov) { document.body.removeChild(ov); resolve(null); } };
  });
  if (!folderId) return;
  await Promise.all([...videoSelectedIds].map(id => dbPatchVideoMeta(id, { folder: folderId })));
  videoSelectedIds.clear();
  updateVideoBulkBar();
  await refreshVideoGalleryUI();
}

// ── Video drag-to-folder ───────────────────────────────────
let videoDraggedIds = new Set();

function videoDragStart(e, id) {
  if (videoSelectedIds.has(id)) {
    videoDraggedIds = new Set(videoSelectedIds);
  } else {
    videoDraggedIds = new Set([id]);
  }
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', [...videoDraggedIds].join(','));
}

function videoFolderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function videoFolderDragEnter(e, el) { el.classList.add('drag-over'); }
function videoFolderDragLeave(e, el) { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over'); }

async function videoFolderDrop(e, folderId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!videoDraggedIds.size) return;
  await Promise.all([...videoDraggedIds].map(id => dbPatchVideoMeta(id, { folder: folderId })));
  if (videoDraggedIds.size > 1 || videoSelectedIds.has([...videoDraggedIds][0])) {
    videoSelectedIds.clear();
    updateVideoBulkBar();
  }
  videoDraggedIds = new Set();
  await refreshVideoGalleryUI();
  toast('Moved ✓', 'ok');
}


// ── Lightbox ─────────────────────────────────────────────
async function openVideoLightboxById(id) {
  const rec = await dbGet('videos', id).catch(()=>null);
  if (!rec?.videoData) { toast('Video data not found', 'err'); return; }

  videoLbCurrentId = id;
  videoLbDuration = rec.duration || 5;

  const lb = document.getElementById('videoLightbox');
  const player = document.getElementById('videoLbPlayer');
  const meta = document.getElementById('videoLbMeta');
  const likeBtn = document.getElementById('videoLbLikeBtn');
  const scrub = document.getElementById('videoFrameScrub');

  // Create blob URL
  const blob = new Blob([rec.videoData], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  player.src = url;
  player.onloadedmetadata = () => {
    const dur = player.duration;
    videoLbDuration = dur;
    if (scrub) { scrub.max = dur; scrub.value = 0; }
    document.getElementById('videoFrameTime').textContent = '0.0s';
  };

  // Meta line
  const dateFmt = _videoDateStr(rec.ts);
  const sizeMB = (rec.fileSize/1024/1024).toFixed(1);
  const infoLine = _videoInfoLine(rec);
  meta.textContent = `${rec.model} · ${sizeMB}MB · ${dateFmt} · ${infoLine}`;
  // Like button state
  if (likeBtn) likeBtn.textContent = rec.favorite ? '♥ Unlike' : '♡ Like';

  lb.classList.add('open');

  // Cleanup old blob URL when video changes
  player._blobUrl = url;
}

function closeVideoLightbox() {
  const lb = document.getElementById('videoLightbox');
  lb.classList.remove('open');
  const player = document.getElementById('videoLbPlayer');
  player.pause();
  if (player._blobUrl) { URL.revokeObjectURL(player._blobUrl); player._blobUrl = null; }
  player.src = '';
  videoLbCurrentId = null;
}

// Lightbox action wrappers — capture ID before closeVideoLightbox clears it
function videoLbTopaz() {
  const id = videoLbCurrentId;
  closeVideoLightbox();
  openTopazFromGallery(id);
}
function videoLbUse() {
  const id = videoLbCurrentId;
  closeVideoLightbox();
  useVideoFromGallery(id);
}

function videoLightboxBgClick(e) {
  if (e.target === document.getElementById('videoLightbox')) closeVideoLightbox();
}

function videoScrubFrame(val) {
  const player = document.getElementById('videoLbPlayer');
  if (player) { player.pause(); player.currentTime = parseFloat(val); }
  const timeEl = document.getElementById('videoFrameTime');
  if (timeEl) timeEl.textContent = parseFloat(val).toFixed(1) + 's';
}

async function videoSaveFrame(which) {
  const player = document.getElementById('videoLbPlayer');
  if (!player || !player.src) { toast('No video loaded', 'err'); return; }

  if (which === 'first') player.currentTime = 0;
  else if (which === 'last') player.currentTime = player.duration || videoLbDuration;

  // Wait for seek if needed
  if (which !== 'current') {
    await new Promise(resolve => {
      const s = () => { player.removeEventListener('seeked', s); resolve(); };
      player.addEventListener('seeked', s);
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = player.videoWidth || 1920;
  canvas.height = player.videoHeight || 1080;
  canvas.getContext('2d').drawImage(player, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const timeLabel = `${player.currentTime.toFixed(1)}s`;

  await createAsset(base64, 'image/png', 'video_frame', videoLbCurrentId);

  // Visual flash feedback on the button
  const btn = document.querySelector('#videoLightbox .vlb-btn[onclick*="saveFrame"]');
  if (btn) { btn.classList.add('flashed'); setTimeout(() => btn.classList.remove('flashed'), 600); }
  toast(`Frame ${timeLabel} saved to Assets ✓`, 'ok');
}

async function videoLbDownload() {
  if (!videoLbCurrentId) return;
  await videoDownloadById(videoLbCurrentId);
}

async function videoLbToggleLike() {
  if (!videoLbCurrentId) return;
  const meta = await dbGet('video_meta', videoLbCurrentId).catch(()=>null);
  if (!meta) return;
  const newState = await videoToggleLike(videoLbCurrentId);
  const btn = document.getElementById('videoLbLikeBtn');
  if (btn) btn.textContent = newState ? '♥ Unlike' : '♡ Like';
}

// ── Keyboard: Escape closes video lightbox ───────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('videoLightbox')?.classList.contains('open')) {
    closeVideoLightbox();
  }
});

// ── WAN 2.7 I2V — fal.ai queue (přímé, bez proxy) ────────
// T2V i I2V — sdílí stejnou funkci, falEndpoint rozlišuje
async function callWan27Video(job) {
  const { model, modelKey, prompt, targetFolder, falKey,
          videoRefsSnapshot, wan27vSnap } = job;

  if (!falKey) throw new Error('fal.ai API key missing. Add it in Setup tab.');

  const endpoint     = model.falEndpoint || 'fal-ai/wan/v2.7/image-to-video';
  const resolution   = wan27vSnap?.resolution    || '1080p';
  const duration     = wan27vSnap?.duration      || 5;
  const negPrompt    = wan27vSnap?.negPrompt     || '';
  const promptExpand = wan27vSnap?.promptExpand  !== false;
  const safety       = wan27vSnap?.safety        !== false;
  const seed         = wan27vSnap?.seed          ? parseInt(wan27vSnap.seed) : undefined;
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
        const extBytes = new Uint8Array(extFull.videoData);
        let extBin = '';
        for (let i = 0; i < extBytes.length; i += 8192)
          extBin += String.fromCharCode(...extBytes.subarray(i, i + 8192));
        payload.video_url = `data:video/mp4;base64,${btoa(extBin)}`;
      }
    }
  }

  // Submit to fal.ai queue (same as Kling, WAN 2.6)
  job.status = 'queued'; renderVideoQueue();
  const queueUrl = `https://queue.fal.run/${endpoint}`;
  console.log('[wan27] submit →', endpoint, '| resolution:', resolution, '| duration:', duration);
  const submitRes = await fetch(queueUrl, {
    method: 'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => '');
    throw new Error(`WAN 2.7 submit ${submitRes.status}: ${errText.slice(0,300)}`);
  }
  const submitted = await submitRes.json();
  const requestId = submitted.request_id;
  if (!requestId) throw new Error(`WAN 2.7: no request_id. Response: ${JSON.stringify(submitted).slice(0,200)}`);

  job.requestId = requestId;
  job.status = 'queued';
  renderVideoQueue();
  updateVideoPlaceholderStatus(job, 'IN QUEUE…');

  const statusUrl  = submitted.status_url  || `${queueUrl}/requests/${requestId}/status`;
  const responseUrl = submitted.response_url || null;
  const POLL_MS = 5000;
  const TIMEOUT = 25 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT;

  // Capture COMPLETED response directly — fal.ai includes output in the status response
  let completedData = null;

  await new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) { reject(new Error('WAN 2.7: timeout after 25 minutes')); return; }
      if (job.cancelled) { reject(new Error('Cancelled')); return; }
      try {
        const st = await fetch(statusUrl, { headers: { 'Authorization': `Key ${falKey}` } });
        if (!st.ok) { setTimeout(poll, POLL_MS); return; }
        const s = await st.json();
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
        if (s.status === 'IN_QUEUE')    { updateVideoPlaceholderStatus(job, `IN QUEUE · ${elapsed}s`); }
        else if (s.status === 'IN_PROGRESS') { job.status = 'running'; renderVideoQueue(); updateVideoPlaceholderStatus(job, `GENERATING · ${elapsed}s`); }
        else if (s.status === 'COMPLETED') { completedData = s; resolve(); return; }
        else if (s.status === 'FAILED')  { reject(new Error(s.error || 'Generation failed')); return; }
        setTimeout(poll, POLL_MS);
      } catch(e) { setTimeout(poll, POLL_MS); }
    };
    setTimeout(poll, POLL_MS);
  });

  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');

  // fal.ai output extraction — output is in the COMPLETED status response
  const _extractVideoUrl = (obj) =>
    obj?.output?.video?.url   // standard: {status:COMPLETED, output:{video:{url}}}
    || obj?.output?.url       // direct: {output:{url}}
    || obj?.video?.url        // top-level
    || obj?.data?.video?.url  // wrapped
    || null;

  // response_url returns 200+video on success, 422+error on job failure
  // (fal.ai WAN 2.7 returns result synchronously at response_url after COMPLETED)
  let videoUrl = _extractVideoUrl(completedData);

  if (!videoUrl && responseUrl) {
    try {
      const r = await fetch(responseUrl, { headers: { 'Authorization': `Key ${falKey}` } });
      if (r.ok) {
        videoUrl = _extractVideoUrl(await r.json());
      } else {
        const body = await r.text().catch(() => '');
        throw new Error(`WAN 2.7 result fetch ${r.status}: ${body.slice(0, 400)}`);
      }
    } catch(e) {
      if (e.message.startsWith('WAN 2.7 result fetch')) throw e;
    }
  }

  if (!videoUrl) throw new Error('WAN 2.7: no video URL in result. Job: ' + requestId);

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`WAN 2.7 video download ${videoRes.status}`);
  const videoArrayBuffer = await videoRes.arrayBuffer();

  const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
  job.status = 'done'; job.elapsed = `${elapsed}s`;

  const blob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
  const thumbData = await generateVideoThumb(blob);
  const dims = await _topazGetDims(blob).catch(() => null);
  const detectedFps = _parseMp4Fps(videoArrayBuffer);

  const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
  const videoRecord = {
    id: videoId, ts: Date.now(),
    model: model.name, modelKey,
    prompt: job.prompt,
    params: { duration, resolution, seed: seed || null, negPrompt, promptExpand,
              ...(detectedFps ? { fps: detectedFps } : {}) },
    videoData: videoArrayBuffer, mimeType: 'video/mp4',
    duration, fileSize: videoArrayBuffer.byteLength,
    ...(dims?.w ? { outWidth: dims.w, outHeight: dims.h } : {}),
    folder: targetFolder === 'all' ? '' : targetFolder,
    favorite: false,
    usedVideoRefs: job.videoRefsSnapshot || [],
  };
  await dbPut('videos', videoRecord);
  const { videoData, ...metaOnly } = videoRecord;
  await dbPut('video_meta', metaOnly);
  if (thumbData) await dbPut('video_thumbs', { id: videoId, data: thumbData });

  trackSpend('fal', resolution === '1080p' ? '_wan27_1080p' : '_wan27_720p', 1, duration);

  renderVideoQueue();
  removeVideoPlaceholder(job);
  toast(`WAN 2.7 done · ${elapsed}s`, 'ok');
  renderVideoResultCard(videoRecord, thumbData);
}

// ── WAN 2.7 Video Edit — fal.ai queue (přímé, bez proxy) ──
// fal-ai/wan/v2.7/edit-video
// Source video: ANY gallery video → base64 data URI (no CDN URL dependency)
// Ref image: optional, base64 data URI
async function callWan27eVideo(job) {
  const { model, modelKey, prompt, targetFolder, falKey,
          videoRefsSnapshot, wan27eSnap } = job;

  if (!falKey)               throw new Error('fal.ai API key missing. Add it in Setup tab.');
  if (!prompt)               throw new Error('Prompt required — describe the edit or style transfer.');
  if (!wan27eSnap?.srcVideoId) throw new Error('No source video selected.');

  const endpoint     = model.falEndpoint || 'fal-ai/wan/v2.7/edit-video';
  const resolution   = wan27eSnap.resolution   || '1080p';
  const duration     = wan27eSnap.duration;      // string enum: "0"|"2"..."10"
  const audioSetting = wan27eSnap.audioSetting  || 'auto';  // 'auto' | 'origin'
  const aspectRatio  = wan27eSnap.aspectRatio   || 'auto';
  const safety       = wan27eSnap.safety        !== false;
  const seed         = wan27eSnap.seed          ? parseInt(wan27eSnap.seed) : undefined;

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
  const srcBytes = new Uint8Array(srcFull.videoData);
  let srcBin = '';
  for (let i = 0; i < srcBytes.length; i += 8192)
    srcBin += String.fromCharCode(...srcBytes.subarray(i, i + 8192));
  const srcB64 = btoa(srcBin);
  const videoUri = `data:video/mp4;base64,${srcB64}`;

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

  // Submit to fal.ai queue
  job.status = 'queued'; renderVideoQueue();
  const queueUrl = `https://queue.fal.run/${endpoint}`;
  console.log('[wan27e] submit → fal.ai | resolution:', effectiveRes, '| duration:', duration, '| audio:', audioSetting);
  const submitRes = await fetch(queueUrl, {
    method: 'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => '');
    throw new Error(`WAN 2.7 Edit submit ${submitRes.status}: ${errText.slice(0,300)}`);
  }
  const submitted = await submitRes.json();
  const requestId = submitted.request_id;
  if (!requestId) throw new Error(`WAN 2.7 Edit: no request_id. Response: ${JSON.stringify(submitted).slice(0,200)}`);

  job.requestId = requestId;
  job.status = 'queued';
  renderVideoQueue();
  updateVideoPlaceholderStatus(job, 'IN QUEUE…');

  const statusUrl   = submitted.status_url   || `${queueUrl}/requests/${requestId}/status`;
  const responseUrl = submitted.response_url || null;
  const POLL_MS = 5000;
  const TIMEOUT = 30 * 60 * 1000; // Video Edit can be slow
  const deadline = Date.now() + TIMEOUT;

  let completedData = null;

  await new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) { reject(new Error('WAN 2.7 Edit: timeout after 30 minutes')); return; }
      if (job.cancelled) { reject(new Error('Cancelled')); return; }
      try {
        const st = await fetch(statusUrl, { headers: { 'Authorization': `Key ${falKey}` } });
        if (!st.ok) { setTimeout(poll, POLL_MS); return; }
        const s = await st.json();
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
        if (s.status === 'IN_QUEUE')         { updateVideoPlaceholderStatus(job, `IN QUEUE · ${elapsed}s`); }
        else if (s.status === 'IN_PROGRESS') { job.status = 'running'; renderVideoQueue(); updateVideoPlaceholderStatus(job, `EDITING · ${elapsed}s`); }
        else if (s.status === 'COMPLETED')   { completedData = s; resolve(); return; }
        else if (s.status === 'FAILED')      { reject(new Error(s.error || 'Edit failed')); return; }
        setTimeout(poll, POLL_MS);
      } catch(e) { setTimeout(poll, POLL_MS); }
    };
    setTimeout(poll, POLL_MS);
  });

  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');

  const _extractVidUrl = (obj) =>
    obj?.output?.video?.url || obj?.output?.url || obj?.video?.url || obj?.data?.video?.url || null;

  let videoUrl = _extractVidUrl(completedData);

  // Fallback: fetch result from response_url (same pattern as callWan27Video)
  if (!videoUrl && responseUrl) {
    try {
      const r = await fetch(responseUrl, { headers: { 'Authorization': `Key ${falKey}` } });
      if (r.ok) {
        videoUrl = _extractVidUrl(await r.json());
      } else {
        const body = await r.text().catch(() => '');
        throw new Error(`WAN 2.7 Edit result fetch ${r.status}: ${body.slice(0, 400)}`);
      }
    } catch(e) {
      if (e.message.startsWith('WAN 2.7 Edit result fetch')) throw e;
    }
  }

  if (!videoUrl) throw new Error('WAN 2.7 Edit: no video URL in result. Check fal.ai dashboard for job ' + requestId);

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`WAN 2.7 Edit video download ${videoRes.status}`);
  const videoArrayBuffer = await videoRes.arrayBuffer();

  const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
  job.status = 'done'; job.elapsed = `${elapsed}s`;

  const blob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
  const thumbData = await generateVideoThumb(blob);
  const dims = await _topazGetDims(blob).catch(() => null);
  const detectedFps = _parseMp4Fps(videoArrayBuffer);

  const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
  const videoRecord = {
    id: videoId, ts: Date.now(),
    model: model.name, modelKey,
    prompt: job.prompt,
    params: { resolution: effectiveRes, audioSetting, aspectRatio, seed: seed || null,
              srcVideoId: wan27eSnap.srcVideoId, ...(detectedFps ? { fps: detectedFps } : {}) },
    videoData: videoArrayBuffer, mimeType: 'video/mp4',
    duration: actualDuration, fileSize: videoArrayBuffer.byteLength,
    ...(dims?.w ? { outWidth: dims.w, outHeight: dims.h } : {}),
    folder: targetFolder === 'all' ? '' : targetFolder,
    favorite: false,
    usedVideoRefs: job.videoRefsSnapshot || [],
  };
  await dbPut('videos', videoRecord);
  const { videoData, ...metaOnly } = videoRecord;
  await dbPut('video_meta', metaOnly);
  if (thumbData) await dbPut('video_thumbs', { id: videoId, data: thumbData });

  trackSpend('fal', effectiveRes === '1080p' ? '_wan27e_1080p' : '_wan27e_720p', 1, actualDuration);

  renderVideoQueue();
  removeVideoPlaceholder(job);
  toast(`WAN 2.7 Edit done · ${elapsed}s`, 'ok');
  renderVideoResultCard(videoRecord, thumbData);
}

// ── Describe video ref image ──────────────────────────────
async function describeVideoRef(idx) {
  const ref = videoRefs[idx];
  if (!ref) return;

  const apiKey = document.getElementById('apiKey')?.value?.trim()
    || document.getElementById('hiddenApiKey')?.value?.trim()
    || localStorage.getItem('gis_apikey') || '';
  if (!apiKey) { toast('Enter Google API key in Setup', 'err'); return; }

  // Načíst plná data z assets DB (v102+ architektura — videoRefs nemají inline data)
  let imageData = null;
  let safeMime = 'image/jpeg';

  if (ref.assetId) {
    const asset = await dbGet('assets', ref.assetId);
    if (asset?.imageData) {
      imageData = asset.imageData;
      safeMime = asset.mimeType || 'image/jpeg';
    }
  }
  // Fallback: inline data (starší formát)
  if (!imageData && ref.data) {
    imageData = ref.data;
    safeMime = ref.mimeType || 'image/jpeg';
  }

  if (!imageData) {
    toast('Image data not available — try re-adding the reference', 'err');
    return;
  }

  _describeSource = 'video';
  document.getElementById('dmPreview').src = `data:${safeMime};base64,${imageData}`;
  document.getElementById('dmResult').value = '';
  document.getElementById('dmStatus').textContent = '⟳ Generating…';
  document.getElementById('describeModal').classList.add('show');
  setDescribeTab('prompt');
  await _runDescribe(apiKey, imageData, safeMime, 'prompt');
}

// ── Video gallery filter ──────────────────────────────────
const videoFilters = { q: '', models: new Set(), dateFrom: null, dateTo: null };

function toggleVideoFilterPanel() {
  const panel = document.getElementById('videoFilterPanel');
  const btn = document.getElementById('videoFilterBtn');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  if (btn) btn.classList.toggle('filter-on', open);
  if (open) buildVideoModelChips();
}

async function buildVideoModelChips() {
  const items = await dbGetAll('video_meta');
  const models = [...new Set(items.map(i => i.model).filter(Boolean))];
  const el = document.getElementById('videoFilterModels');
  if (!el) return;
  el.innerHTML = models.map(m => `
    <div class="gal-filter-chip ${videoFilters.models.has(m) ? 'on' : ''}"
         onclick="videoToggleModelChip(this,'${escHtml(m)}')">${escHtml(m)}</div>
  `).join('');
}

function videoToggleModelChip(el, model) {
  if (videoFilters.models.has(model)) { videoFilters.models.delete(model); el.classList.remove('on'); }
  else { videoFilters.models.add(model); el.classList.add('on'); }
  videoApplyFilters();
}

function videoApplyFilters() {
  videoFilters.q = document.getElementById('videoSearch')?.value?.toLowerCase().trim() || '';
  const dFrom = document.getElementById('videoFilterFrom')?.value;
  const dTo = document.getElementById('videoFilterTo')?.value;
  videoFilters.dateFrom = dFrom ? new Date(dFrom).getTime() : null;
  videoFilters.dateTo = dTo ? new Date(dTo + 'T23:59:59').getTime() : null;
  renderVideoGallery();
}

function videoClearFilters() {
  videoFilters.q = ''; videoFilters.models.clear();
  videoFilters.dateFrom = null; videoFilters.dateTo = null;
  const sf = document.getElementById('videoSearch'); if (sf) sf.value = '';
  const ff = document.getElementById('videoFilterFrom'); if (ff) ff.value = '';
  const ft = document.getElementById('videoFilterTo'); if (ft) ft.value = '';
  document.getElementById('videoFilterPanel')?.classList.remove('open');
  document.getElementById('videoFilterBtn')?.classList.remove('filter-on');
  renderVideoGallery();
}

function videoFilterItems(items) {
  let result = items;
  if (videoFilters.q) result = result.filter(i =>
    (i.prompt||'').toLowerCase().includes(videoFilters.q) ||
    (i.model||'').toLowerCase().includes(videoFilters.q)
  );
  if (videoFilters.models.size > 0) result = result.filter(i => videoFilters.models.has(i.model));
  if (videoFilters.dateFrom) result = result.filter(i => i.ts >= videoFilters.dateFrom);
  if (videoFilters.dateTo) result = result.filter(i => i.ts <= videoFilters.dateTo);
  return result;
}

function videoUpdateFilterBanner(filtered, total) {
  const banner = document.getElementById('videoFilterBanner');
  const label = document.getElementById('videoFilterBannerLabel');
  const active = videoFilters.q || videoFilters.models.size > 0 || videoFilters.dateFrom || videoFilters.dateTo;
  if (banner) banner.classList.toggle('show', active);
  if (label && active) label.textContent = `${filtered} / ${total} videos`;
}

// ── Video rubber-band selection ───────────────────────────
// ═══════════════════════════════════════════════════════
// @MENTION AUTOCOMPLETE V VIDEO PROMPTU
// (kopie systému z refs.js, pro #videoPrompt textarea)
// ═══════════════════════════════════════════════════════

let _prevVideoModelKey  = null;  // tracks last applied model key for rewrite
let _videoModelSwitching = false; // guard: prevents renderVideoRefPanel from firing rewrite during model switch
let videoMentionOpen = false;
let videoMentionFilter = '';
let videoMentionAssets = [];
let videoMentionActiveIdx = -1;

function initVideoMentionSystem() {
  const ta = document.getElementById('videoPrompt');
  if (!ta) return;
  ta.addEventListener('input', handleVideoMentionInput);
  ta.addEventListener('keydown', handleVideoMentionKeydown);
  document.addEventListener('click', e => {
    if (!e.target.closest('#mentionDropdown') && !e.target.closest('#videoPrompt')) closeVideoMention();
  });
}

async function handleVideoMentionInput(e) {
  const ta = e.target;
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const match = before.match(/@(\w*)$/);
  if (!match) { closeVideoMention(); return; }
  videoMentionFilter = match[1].toLowerCase();
  await showVideoMentionDropdown(ta, match.index, pos);
}

async function showVideoMentionDropdown(ta, atStart, curPos) {
  const m = VIDEO_MODELS[getActiveVideoModelKey()] || {};
  const prefix = getVideoRefMentionPrefix(m);
  // Filter refs by mention text matching the typed filter
  videoMentionAssets = videoRefs.filter((r, gi) => {
    const text = getVideoRefMentionText(r, gi, m).toLowerCase();
    return !videoMentionFilter || text.startsWith(videoMentionFilter) || text.includes(videoMentionFilter);
  });

  const dd = document.getElementById('mentionDropdown');
  if (!videoMentionAssets.length) {
    dd.innerHTML = '<div style="padding:10px 14px;font-size:11px;color:var(--dim2);font-style:italic;">No refs added — add reference images below the prompt first</div>';
  } else {
    dd.innerHTML = videoMentionAssets.map((r, i) => {
      const globalIdx = videoRefs.indexOf(r);
      const mentionText = getVideoRefMentionText(r, globalIdx, m);
      const displayLabel = getVideoRefDisplayLabel(r, globalIdx, m);
      const thumbSrc = r.thumb ? `data:image/jpeg;base64,${r.thumb}` : '';
      const insertPreview = prefix + mentionText;
      return `
      <div class="mention-item ${i === videoMentionActiveIdx ? 'mi-active' : ''}" data-idx="${i}" onmousedown="insertVideoMention(event,${i})">
        <img class="mi-thumb" src="${thumbSrc}" alt="${escHtml(displayLabel)}">
        <div class="mi-info">
          <div class="mi-name">${escHtml(insertPreview)}</div>
          <div class="mi-sub">${escHtml(r.autoName || '')}</div>
        </div>
        <span class="mi-insert">↵</span>
      </div>`;
    }).join('');
  }

  const taRect = ta.getBoundingClientRect();
  let x = taRect.left + 10;
  let y = taRect.top + ta.scrollTop + 18;
  const ddW = 320;
  if (x + ddW > window.innerWidth) x = window.innerWidth - ddW - 8;
  dd.style.left = x + 'px';
  dd.style.top = y + 'px';
  dd.classList.add('show');
  videoMentionOpen = true;
  videoMentionActiveIdx = -1;
}

function handleVideoMentionKeydown(e) {
  if (!videoMentionOpen) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    videoMentionActiveIdx = Math.min(videoMentionActiveIdx + 1, videoMentionAssets.length - 1);
    document.querySelectorAll('.mention-item').forEach((el, i) => el.classList.toggle('mi-active', i === videoMentionActiveIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    videoMentionActiveIdx = Math.max(videoMentionActiveIdx - 1, 0);
    document.querySelectorAll('.mention-item').forEach((el, i) => el.classList.toggle('mi-active', i === videoMentionActiveIdx));
  } else if (e.key === 'Enter' && videoMentionActiveIdx >= 0) {
    e.preventDefault();
    insertVideoMentionByIdx(videoMentionActiveIdx);
  } else if (e.key === 'Escape') {
    closeVideoMention();
  }
}

function insertVideoMention(e, idx) {
  e.preventDefault();
  insertVideoMentionByIdx(idx);
}

function insertVideoMentionByIdx(idx) {
  if (idx < 0 || idx >= videoMentionAssets.length) return;
  const r = videoMentionAssets[idx];
  const m = VIDEO_MODELS[getActiveVideoModelKey()] || {};
  const prefix = getVideoRefMentionPrefix(m);
  const globalIdx = videoRefs.indexOf(r);
  const mentionText = getVideoRefMentionText(r, globalIdx, m);
  const ta = document.getElementById('videoPrompt');
  const val = ta.value;
  const pos = ta.selectionStart;
  const before = val.slice(0, pos);
  const after = val.slice(pos);
  // Replace the @trigger + typed filter with prefix + mentionText
  // For Wan R2V (prefix=''), replace @word → CharacterN (no @ in result)
  const newBefore = before.replace(/@(\w*)$/, prefix + mentionText);
  ta.value = newBefore + after;
  ta.selectionStart = ta.selectionEnd = newBefore.length;
  ta.focus();
  closeVideoMention();
}

function closeVideoMention() {
  document.getElementById('mentionDropdown')?.classList.remove('show');
  videoMentionOpen = false;
  videoMentionActiveIdx = -1;
}

// ── Video prompt live rewriting ───────────────────────────
// Reverse-map model-specific names back to @UserLabel form
function videoPromptModelToUserLabels(prompt, activeRefs, prevM) {
  if (!prompt || !activeRefs.length || !prevM) return prompt;
  const mode = prevM.refMode || '';

  if (mode === 'multi') {
    // @Element1, @Element2 → @UserLabel
    return prompt.replace(/@Element(\d+)/gi, (full, n) => {
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
    // @UserLabel → @Element{N+1}
    return prompt.replace(/@([\w]+)/g, (full, mention) => {
      const idx = findIdx(mention);
      return idx >= 0 ? `@Element${idx + 1}` : full;
    });
  }

  if (mode === 'wan_r2v') {
    // @UserLabel → Character{N+1} (no @ prefix)
    return prompt.replace(/@([\w]+)/g, (full, mention) => {
      const idx = findIdx(mention);
      return idx >= 0 ? `Character${idx + 1}` : full;
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
  const mentionModes = ['multi', 'wan_r2v'];
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

function initVideoRubberBand() {
  const wrap = document.getElementById('videoGridWrap');
  if (!wrap || wrap._rbInit) return;
  wrap._rbInit = true;

  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target.classList.contains('video-sel') ||
        target.classList.contains('video-liked-badge') ||
        target.tagName === 'BUTTON' || target.tagName === 'INPUT' ||
        target.closest('.gal-bulk') || target.closest('.gal-toolbar') ||
        target.closest('.gal-filter-panel')) return;

    // Shift = rubber-band select; Alt = rubber-band deselect; plain = card click/drag
    if (!e.shiftKey && !e.altKey) return;

    e.preventDefault();
    const mode = e.altKey ? 'deselect' : 'select';
    _startRubberBand(e, 'videoRubberBand', mode, (selBox, m) => {
      document.querySelectorAll('.video-card[data-id]').forEach(el => {
        const r = el.getBoundingClientRect();
        const overlaps = r.left < selBox.right && r.right > selBox.left &&
                         r.top  < selBox.bottom && r.bottom > selBox.top;
        if (!overlaps) return;
        if (m === 'deselect') { videoSelectedIds.delete(el.dataset.id); el.classList.remove('selected'); }
        else { videoSelectedIds.add(el.dataset.id); el.classList.add('selected'); }
      });
      updateVideoBulkBar();
    });
  });
}


// ══════════════════════════════════════════════════════════
// TOPAZ VIDEO UPSCALE — Queue-based, non-blocking
// Topaz behaves like any other video model:
//   1. Select "Topaz Precise 2.5 / Precise 2 / Astra 1" in model select
//   2. Set source video via ✦ Topaz button or "Pick from gallery"
//   3. Configure resolution, fps, slowmo, creativity
//   4. Click ▶ Generate Video → job queued, returns immediately
//   5. Progress shown on placeholder card in output area
// ══════════════════════════════════════════════════════════

const TOPAZ_MODEL_NAMES = {
  'slp-2.5': 'Precise 2.5', 'slp-2': 'Precise 2', 'slp-1': 'Precise 1',
  'slhq': 'Starlight HQ', 'slm': 'Starlight Mini', 'astra-1': 'Astra 1',
};

// ══════════════════════════════════════════════════════════
// MAGNIFIC VIDEO UPSCALER
// ══════════════════════════════════════════════════════════
async function _generateMagnificVideoJob(modelKey, freepikKey, proxyUrl) {
  // Re-use topazSrcVideoId for source selection (same ✦ Topaz button flow)
  if (!topazSrcVideoId) { toast('Set a source video — click ✦ Topaz on a video in the gallery', 'err'); return; }

  const mvm = MAGNIFIC_VIDEO_MODELS[modelKey];
  if (!mvm) { toast('Unknown Magnific video model', 'err'); return; }

  const srcMeta = await dbGet('video_meta', topazSrcVideoId).catch(() => null);
  if (!srcMeta) { toast('Source video not found in gallery', 'err'); return; }

  const resolution   = document.querySelector('input[name="magnificVidRes"]:checked')?.value || '2k';
  const fpsBost      = document.getElementById('magnificVidFps')?.checked || false;
  const sharpen      = parseInt(document.getElementById('magnificVidSharpen')?.value || '0');
  const smartGrain   = parseInt(document.getElementById('magnificVidGrain')?.value || '0');
  const creativity   = parseInt(document.getElementById('magnificVidCreativity')?.value || '50');
  const flavor       = document.querySelector('input[name="magnificVidFlavor"]:checked')?.value || 'vivid';
  const strength     = parseInt(document.getElementById('magnificVidStrength')?.value || '60');
  const vidPrompt    = document.getElementById('magnificVidPrompt')?.value?.trim() || '';
  const targetFolder = document.getElementById('videoTargetFolder')?.value || '';

  const jobId = `mgvid_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  const resLabel = resolution.toUpperCase();
  const job = {
    id: jobId, isMagnificVideo: true,
    srcId: topazSrcVideoId,
    srcDuration: srcMeta.duration || 5,
    magnificMode: mvm.mode,
    resolution, fpsBost, sharpen, smartGrain, creativity, flavor, strength, vidPrompt,
    freepikKey, proxyUrl,
    targetFolder: targetFolder === 'all' ? '' : targetFolder,
    status: 'pending', startedAt: Date.now(),
    model: { name: `✦ Magnific ${mvm.name}` },
    prompt: `Magnific ${mvm.name} · ${resLabel}${fpsBost ? ' · FPS Boost' : ''}`,
    duration: srcMeta.duration || 5,
  };

  videoJobs.push(job);
  videoShowPlaceholder(job);
  renderVideoQueue();
  toast(`✦ Magnific Video queued — ${mvm.name} · ${resLabel}`, 'ok');
  runMagnificVideoUpscaleJob(job).catch(e => videoJobError(job, e.message || 'Magnific Video failed'));
}

async function runMagnificVideoUpscaleJob(job) {
  updateVideoPlaceholderStatus(job, 'loading…');
  renderVideoQueue();

  const rec = await dbGet('videos', job.srcId).catch(() => null);
  if (!rec?.videoData) throw new Error('Source video not found in gallery');

  // Base64 encode video
  updateVideoPlaceholderStatus(job, 'encoding…');
  const videoBytes = new Uint8Array(rec.videoData);
  let videoBin = '';
  const CHUNK = 8192;
  for (let i = 0; i < videoBytes.length; i += CHUNK)
    videoBin += String.fromCharCode(...videoBytes.subarray(i, i + CHUNK));
  const videoB64 = btoa(videoBin);

  // Submit to proxy
  updateVideoPlaceholderStatus(job, 'uploading…');
  const submitResp = await fetch(`${job.proxyUrl}/magnific/video-upscale`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      freepik_key:   job.freepikKey,
      replicate_key: (localStorage.getItem('gis_replicate_apikey') || '').trim(),
      video_b64:     videoB64,
      mode:          job.magnificMode,
      resolution:    job.resolution,
      fps_boost:     job.fpsBost,
      sharpen:       job.sharpen,
      smart_grain:   job.smartGrain,
      creativity:    job.creativity,
      flavor:        job.flavor,
      strength:      job.strength,
      prompt:        job.vidPrompt || '',
    }),
  });
  if (!submitResp.ok) throw new Error(`Magnific Video submit: ${submitResp.status} ${await submitResp.text()}`);
  const { task_id } = await submitResp.json();
  if (!task_id) throw new Error('Magnific Video: no task_id');

  // Poll
  job.status = 'running';
  const upscalerType = job.magnificMode === 'precision' ? 'video_upscale_prec' : 'video_upscale';
  const POLL  = 10_000;
  const LIMIT = 48 * 60_000;
  const stop  = Date.now() + LIMIT;
  let elapsed = 0;

  while (Date.now() < stop) {
    await new Promise(r => setTimeout(r, POLL));
    elapsed += POLL;
    updateVideoPlaceholderStatus(job, `processing… ${Math.round(elapsed / 1000)}s`);

    const pollResp = await fetch(`${job.proxyUrl}/magnific/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freepik_key: job.freepikKey, task_id, upscaler_type: upscalerType }),
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();

    if (pollData.status === 'failed') throw new Error(`Magnific Video failed: ${pollData.error}`);
    if (pollData.status === 'done') {
      updateVideoPlaceholderStatus(job, 'downloading…');
      const vidResp = await fetch(pollData.url);
      if (!vidResp.ok) throw new Error(`Download failed: ${vidResp.status}`);
      const videoArrayBuffer = await vidResp.arrayBuffer();

      // Save to gallery — same pattern as Topaz
      const thumbBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
      const thumbData = await generateVideoThumb(thumbBlob);
      const videoId   = `vid_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
      const resLabel  = job.resolution.toUpperCase();
      const modelLabel = job.model.name;
      const videoRecord = {
        id: videoId, ts: Date.now(), model: modelLabel,
        modelKey: `magnific_video_${job.magnificMode}`, prompt: job.prompt,
        params: { magnific: { mode: job.magnificMode, resolution: job.resolution, fps_boost: job.fpsBost, sharpen: job.sharpen, smart_grain: job.smartGrain }, srcId: job.srcId },
        videoData: videoArrayBuffer, mimeType: 'video/mp4',
        duration: job.srcDuration, fileSize: videoArrayBuffer.byteLength,
        folder: job.targetFolder || '', favorite: false,
      };
      await dbPut('videos', videoRecord);
      const { videoData: _, ...metaOnly } = videoRecord;
      await dbPut('video_meta', metaOnly);
      if (thumbData) await dbPut('video_thumbs', { id: videoId, data: thumbData });

      trackSpend('freepik', '_magnific_vid');
      job.status = 'done';
      removeVideoPlaceholder(job);
      renderVideoResultCard(videoRecord, thumbData);
      await refreshVideoGalleryUI();
      renderVideoQueue();
      toast(`✦ Magnific Video done · ${modelLabel} · ${(videoArrayBuffer.byteLength/1024/1024).toFixed(1)}MB`, 'ok');
      return;
    }
  }
  throw new Error('Magnific Video: timeout — did not complete within time limit.');
}

async function _generateTopazJob(modelKey, proxyUrl) {
  const topazKey = localStorage.getItem('gis_topaz_apikey') || '';
  if (!topazKey) { showApiKeyWarning('Topaz API Key missing', 'Add your Topaz Labs API key in Setup → Topaz Labs API Key.'); return; }
  if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'Check Setup.'); return; }
  if (!topazSrcVideoId) { toast('Set a source video — click ✦ Topaz on a video in the gallery', 'err'); return; }

  const tm = TOPAZ_MODELS[modelKey];
  if (!tm) { toast('Unknown Topaz model', 'err'); return; }

  const res        = document.getElementById('topazResolution')?.value   || '1080p';
  const factor     = parseFloat(document.getElementById('topazFactor')?.value || '2');
  const fps        = parseInt(document.getElementById('topazFps')?.value   || '24');
  const slowmo     = parseInt(document.getElementById('topazSlowmo')?.value || '0');
  const creativity = tm.hasCreativity ? (document.getElementById('topazCreativity')?.value || 'medium') : undefined;
  const targetFolder = document.getElementById('videoTargetFolder')?.value || '';

  // Load source meta to get dimensions
  const srcMeta = await dbGet('video_meta', topazSrcVideoId).catch(() => null);
  if (!srcMeta) { toast('Source video not found in gallery', 'err'); return; }

  // Always load source dimensions (needed for Topaz source.resolution)
  const full = await dbGet('videos', topazSrcVideoId).catch(() => null);
  let srcW = srcMeta.outWidth || 1920, srcH = srcMeta.outHeight || 1080;
  if (full?.videoData) {
    const blob = new Blob([full.videoData], { type: 'video/mp4' });
    const dims = await _topazGetDims(blob).catch(() => null);
    if (dims?.w) { srcW = dims.w; srcH = dims.h; }
  }

  // Compute output dimensions
  let outW, outH;
  if (tm.hasFactor) {
    outW = Math.round(srcW * factor);
    outH = Math.round(srcH * factor);
  } else {
    if (res === '4k') { outW = 3840; outH = 2160; }
    else              { outW = 1920; outH = 1080; }
  }

  const jobId = `tpz_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  const job = {
    id: jobId, isTopaz: true,
    srcId: topazSrcVideoId, srcDuration: srcMeta.duration || 5, srcFileSize: srcMeta.fileSize || 0,
    srcWidth: srcW, srcHeight: srcH,  // source dims for Topaz API
    topazModel: tm.apiModel, topazModelKey: modelKey,
    factor, fps, slowmo, creativity, out_width: outW, out_height: outH,
    resolution: res, topazKey, proxyUrl,
    targetFolder: targetFolder === 'all' ? '' : targetFolder,
    status: 'pending', startedAt: Date.now(),
    model: { name: `✦ Topaz ${TOPAZ_MODEL_NAMES[tm.apiModel] || tm.apiModel}` },
    prompt: `Topaz ${tm.name} · ${outW}×${outH} · ${fps}fps${slowmo ? ` · ${slowmo}× slow motion` : ''}`,
    duration: srcMeta.duration || 5,
  };

  videoJobs.push(job);
  videoShowPlaceholder(job);
  renderVideoQueue();
  toast(`✦ Topaz queued — ${tm.name} · ${outW}×${outH}`, 'ok');

  // Run in background — non-blocking
  runTopazQueueJob(job).catch(e => videoJobError(job, e.message || 'Topaz failed'));
}

// ── MP4 FPS parser — reads moov→trak→mdia→mdhd + stts atoms ─
// Synchronous, works on ArrayBuffer directly from IndexedDB.
// Returns fps as number (e.g. 24, 25, 29.97) or null if not found.
function _parseMp4Fps(buffer) {
  if (!buffer || buffer.byteLength < 8) return null;
  try {
    const v = new DataView(buffer);
    const u32 = o => v.getUint32(o);
    const u8  = o => v.getUint8(o);
    const str = o => String.fromCharCode(u8(o),u8(o+1),u8(o+2),u8(o+3));
    const sz  = buffer.byteLength;

    function findBox(type, start, end) {
      let p = start;
      while (p + 8 <= end) {
        const s = u32(p); if (s < 8) break;
        if (str(p+4) === type) return { start: p, ds: p+8, end: Math.min(p+s, end) };
        p += s;
      }
      return null;
    }

    const moov = findBox('moov', 0, sz);
    if (!moov) return null;

    // Iterate trak boxes — find the video track (has vmhd inside minf)
    let tp = moov.ds;
    while (tp + 8 <= moov.end) {
      const s = u32(tp); if (s < 8) break;
      if (str(tp+4) === 'trak') {
        const trak = { ds: tp+8, end: Math.min(tp+s, moov.end) };
        const mdia = findBox('mdia', trak.ds, trak.end);
        if (mdia) {
          const minf = findBox('minf', mdia.ds, mdia.end);
          if (minf && findBox('vmhd', minf.ds, minf.end)) {
            // Video track confirmed — read timescale from mdhd
            const mdhd = findBox('mdhd', mdia.ds, mdia.end);
            if (mdhd) {
              const ver = u8(mdhd.ds);
              const timescale = ver === 1 ? u32(mdhd.ds+20) : u32(mdhd.ds+12);
              // Read stts for sample duration
              const stbl = findBox('stbl', minf.ds, minf.end);
              if (stbl) {
                const stts = findBox('stts', stbl.ds, stbl.end);
                if (stts && u32(stts.ds+4) > 0) {
                  const dur = u32(stts.ds+12); // first entry sample_delta
                  if (dur > 0 && timescale > 0) {
                    const fps = timescale / dur;
                    // Snap to common frame rates
                    const common = [23.976,24,25,29.97,30,48,50,59.94,60];
                    const snapped = common.reduce((a,b) => Math.abs(b-fps)<Math.abs(a-fps)?b:a);
                    return Math.abs(snapped-fps) < 0.5 ? snapped : Math.round(fps*100)/100;
                  }
                }
              }
            }
          }
        }
      }
      tp += s;
    }
  } catch(_) {}
  return null;
}

function _topazGetDims(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const el  = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => { const w = el.videoWidth, h = el.videoHeight; URL.revokeObjectURL(url); el.src = ''; resolve({ w, h }); };
    el.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 0, h: 0 }); };
    el.src = url;
  });
}

// Extended dims helper — also tries to detect fps via requestVideoFrameCallback
function _topazGetDimsAndFps(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const el  = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => {
      const w = el.videoWidth, h = el.videoHeight;
      URL.revokeObjectURL(url);
      el.src = '';
      resolve({ w, h });
    };
    el.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 0, h: 0 }); };
    el.src = url;
  });
}

async function runTopazQueueJob(job) {
  updateVideoPlaceholderStatus(job, 'loading…');
  renderVideoQueue();

  const rec = await dbGet('videos', job.srcId).catch(() => null);
  if (!rec?.videoData) throw new Error('Source video not found in gallery');

  const videoBlob  = new Blob([rec.videoData], { type: rec.mimeType || 'video/mp4' });
  const videoBytes = new Uint8Array(await videoBlob.arrayBuffer());

  // Base64 encode in chunks (spread operator overflows for large arrays)
  updateVideoPlaceholderStatus(job, 'encoding…');
  let videoBin = '';
  const CHUNK = 8192;
  for (let i = 0; i < videoBytes.length; i += CHUNK) {
    videoBin += String.fromCharCode(...videoBytes.subarray(i, i + CHUNK));
  }
  const videoB64 = btoa(videoBin);

  updateVideoPlaceholderStatus(job, 'uploading…');
  renderVideoQueue();

  // Submit with retry — transient S3/502 errors are common on Topaz infra
  const SUBMIT_RETRIES = 3;
  const SUBMIT_DELAY   = 5_000;
  let submitData = null;
  for (let attempt = 1; attempt <= SUBMIT_RETRIES; attempt++) {
    if (attempt > 1) {
      updateVideoPlaceholderStatus(job, `uploading… retry ${attempt}/${SUBMIT_RETRIES}`);
      await new Promise(r => setTimeout(r, SUBMIT_DELAY));
    }
    const submitResp = await fetch(`${job.proxyUrl}/topaz/video/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topaz_key:   job.topazKey,
        model:       job.topazModel,
        slowmo:      job.slowmo || 0,
        fps:         job.fps || 24,
        creativity:  job.creativity,
        out_width:   job.out_width,
        out_height:  job.out_height,
        src_width:    job.srcWidth  || 1920,
        src_height:   job.srcHeight || 1080,
        src_size:     job.srcFileSize || 0,
        src_duration: job.srcDuration,
        video_b64:   videoB64,
      }),
    });
    if (submitResp.ok) {
      submitData = await submitResp.json();
      break;
    }
    const e = await submitResp.json().catch(() => ({}));
    const msg = e.error || submitResp.statusText;
    if (attempt === SUBMIT_RETRIES) throw new Error(`Topaz submit: ${msg}`);
    console.warn(`Topaz submit attempt ${attempt} failed (${msg}), retrying…`);
  }
  const { request_id } = submitData;
  if (!request_id) throw new Error('Topaz: no request_id in response');
  job.topazRequestId = request_id;

  // Poll
  job.status = 'running';
  const POLL   = 15_000;
  const LIMIT  = 30 * 60_000;
  const stop   = Date.now() + LIMIT;
  let   count  = 0;

  while (Date.now() < stop) {
    await new Promise(r => setTimeout(r, POLL));
    count++;

    const sr = await fetch(`${job.proxyUrl}/topaz/video/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topaz_key: job.topazKey, request_id }),
    });
    if (!sr.ok) { const e = await sr.json().catch(() => ({})); throw new Error(`Status error: ${e.error || sr.statusText}`); }
    const { status, raw_status, output_url, progress } = await sr.json();

    const isFailed = status === 'failed' || status === 'error' ||
      (raw_status && raw_status.toLowerCase().includes('fail'));
    if (isFailed) throw new Error(`Topaz failed [${raw_status || status}]`);

    const pct   = progress != null ? Math.min(Math.round(progress), 99) : null;
    const label = raw_status ? ` [${raw_status}]` : '';
    const pctLabel = pct != null ? ` ${pct}%` : '';
    updateVideoPlaceholderStatus(job, `${Math.round(count*15/60)}min${pctLabel}${label}`);
    renderVideoQueue();

    const done = !!output_url || ['done','complete','completed','success','finished'].includes(status);
    if (done && output_url) {
      // Download via Worker proxy (R2 output bucket blocks direct browser access)
      updateVideoPlaceholderStatus(job, 'downloading…');
      const dlResp = await fetch(`${job.proxyUrl}/topaz/video/download`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ output_url }),
      });
      if (!dlResp.ok) {
        const e = await dlResp.json().catch(() => ({}));
        throw new Error(`Download failed ${dlResp.status}: ${e.error || dlResp.statusText}`);
      }
      const totalBytes = parseInt(dlResp.headers.get('Content-Length') || '0');
      const reader = dlResp.body.getReader();
      const chunks = []; let received = 0;
      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        chunks.push(value); received += value.length;
        const mb  = (received/1024/1024).toFixed(1);
        const tot = totalBytes ? `/${(totalBytes/1024/1024).toFixed(0)}` : '';
        updateVideoPlaceholderStatus(job, `↓ ${mb}${tot}MB`);
      }
      const videoArrayBuffer = await new Blob(chunks).arrayBuffer();

      // Save
      const thumbBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
      const thumbData = await generateVideoThumb(thumbBlob);
      const videoId   = `vid_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
      const modelLabel = `✦ Topaz ${TOPAZ_MODEL_NAMES[job.topazModel] || job.topazModel}`;
      const videoRecord = {
        id: videoId, ts: Date.now(), model: modelLabel,
        modelKey: `topaz_${job.topazModel}`, prompt: job.prompt,
        params: { topaz: { model: job.topazModel, fps: job.fps, slowmo: job.slowmo, creativity: job.creativity, factor: job.factor }, srcId: job.srcId },
        videoData: videoArrayBuffer, mimeType: 'video/mp4',
        duration: job.srcDuration, fileSize: videoArrayBuffer.byteLength,
        folder: job.targetFolder || '', favorite: false,
        outWidth: job.out_width, outHeight: job.out_height,
      };
      await dbPut('videos', videoRecord);
      const { videoData: _, ...metaOnly } = videoRecord;
      await dbPut('video_meta', metaOnly);
      if (thumbData) await dbPut('video_thumbs', { id: videoId, data: thumbData });

      const spendKey = { 'slp-2.5':'_topaz_slp25','slp-2':'_topaz_slp2','slp-1':'_topaz_slp1','slhq':'_topaz_slhq','slm':'_topaz_slm' }[job.topazModel] || '_topaz_slp25';
      trackSpend('topaz', spendKey, 1, job.srcDuration);

      job.status = 'done';
      removeVideoPlaceholder(job);
      renderVideoResultCard(videoRecord, thumbData);
      await refreshVideoGalleryUI();
      renderVideoQueue();
      toast(`✦ Topaz done · ${modelLabel} · ${(videoArrayBuffer.byteLength/1024/1024).toFixed(1)}MB`, 'ok');
      return;
    }
  }
  throw new Error('Topaz timeout — exceeded 30 minutes');
}

