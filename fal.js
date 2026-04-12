// ═══════════════════════════════════════════════════════
// FAL.AI IMAGE ADAPTERS — async queue endpoint
// ═══════════════════════════════════════════════════════
// All image models now use queue.fal.run (async) instead of fal.run (sync).
// This eliminates "503 Deadline expired" errors caused by sync endpoint timeouts.
//
// Pattern: POST queue.fal.run/{model} → request_id → poll status → fetch result
// Auth: Authorization: Key {key}   ← NE Bearer
// Same payload structure as before — only the transport changes.

const FAL_QUEUE_BASE = 'https://queue.fal.run';

// ── Shared queue helper ───────────────────────────────────────────────────────
// Submits job to fal.ai queue, polls until complete, returns result data object.
// endpointPath: model path WITHOUT base URL, e.g. "fal-ai/flux-2-pro/edit"
async function _falQueue(falKey, endpointPath, payload, onStatus, signal) {
  const queueUrl = `${FAL_QUEUE_BASE}/${endpointPath}`;

  // 1. Submit job
  onStatus?.('⟳ Submitting…');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const submitRes = await fetch(queueUrl, {
    method:  'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
    signal,
  });
  if (!submitRes.ok) {
    const errData = await submitRes.json().catch(() => ({}));
    const detail  = errData.message || errData.detail?.[0]?.msg || JSON.stringify(errData).slice(0, 200);
    throw new Error(`fal.ai: submit failed (${submitRes.status}): ${detail}`);
  }
  const submitted = await submitRes.json();
  const requestId = submitted.request_id;
  if (!requestId) throw new Error('fal.ai: no request_id in queue response.');

  const statusUrl = submitted.status_url || `${queueUrl}/requests/${requestId}/status`;
  const resultUrl = submitted.response_url || `${queueUrl}/requests/${requestId}`;

  // 2. Poll until complete (max 10 min = 200 × 3s)
  const MAX_POLLS = 200;
  const POLL_MS   = 3000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_MS));
    const elapsed = ((i + 1) * POLL_MS / 1000).toFixed(0);

    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    let statusData;
    try {
      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
        signal,
      });
      if (!statusRes.ok) continue;
      statusData = await statusRes.json();
    } catch (_) { continue; }

    const status = statusData.status;
    if (status === 'IN_QUEUE')    { onStatus?.(`⟳ In queue… (${elapsed}s)`);     continue; }
    if (status === 'IN_PROGRESS') { onStatus?.(`⟳ Generating… (${elapsed}s)`);   continue; }
    if (status === 'FAILED') {
      const detail = statusData.error || statusData.detail || 'unknown error';
      throw new Error(`fal.ai: generation failed — ${detail}`);
    }
    if (status === 'COMPLETED') {
      onStatus?.('⟳ Downloading…');
      const resultRes = await fetch(resultUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
        signal,
      });
      if (!resultRes.ok) {
        const errBody = await resultRes.text().catch(() => '');
        throw new Error(`fal.ai: result fetch failed (${resultRes.status}): ${errBody.slice(0, 200)}`);
      }
      return await resultRes.json();
    }
  }
  throw new Error('fal.ai: timeout — generation did not complete within 10 minutes.');
}

// ── fal.ai queue via GIS proxy (CORS bypass for flux-pro and other restricted models) ──
// Uses Worker routes: /fal/submit → /fal/status → /fal/result
async function _falQueueViaProxy(falKey, endpointPath, payload, onStatus, signal) {
  const proxyBase = getProxyUrl();
  const headers   = { 'X-Fal-Key': falKey, 'Content-Type': 'application/json' };

  // 1. Submit
  onStatus?.('⟳ Submitting…');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const submitRes = await fetch(`${proxyBase}/fal/submit`, {
    method: 'POST', headers,
    body: JSON.stringify({ endpoint: endpointPath, payload }),
    signal,
  });
  if (!submitRes.ok) {
    const errData = await submitRes.json().catch(() => ({}));
    const detail  = errData.message || errData.detail?.[0]?.msg || JSON.stringify(errData).slice(0, 200);
    throw new Error(`fal.ai proxy: submit failed (${submitRes.status}): ${detail}`);
  }
  const submitted = await submitRes.json();
  const requestId  = submitted.request_id;
  const statusUrl  = submitted.status_url  || `https://queue.fal.run/${endpointPath}/requests/${requestId}/status`;
  const responseUrl = submitted.response_url || `https://queue.fal.run/${endpointPath}/requests/${requestId}`;
  if (!requestId) throw new Error('fal.ai proxy: no request_id in queue response.');

  // 2. Poll status via proxy
  const MAX_POLLS = 200, POLL_MS = 3000;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_MS));
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const elapsed = ((i + 1) * POLL_MS / 1000).toFixed(0);

    let statusData;
    try {
      const sr = await fetch(`${proxyBase}/fal/status`, {
        method: 'POST', headers,
        body: JSON.stringify({ status_url: statusUrl }),
        signal,
      });
      if (!sr.ok) continue;
      statusData = await sr.json();
    } catch (_) { continue; }

    const status = statusData.status;
    if (status === 'IN_QUEUE')    { onStatus?.(`⟳ In queue… (${elapsed}s)`);    continue; }
    if (status === 'IN_PROGRESS') { onStatus?.(`⟳ Generating… (${elapsed}s)`);  continue; }
    if (status === 'FAILED') {
      const detail = statusData.error || statusData.detail || 'unknown error';
      throw new Error(`fal.ai: generation failed — ${detail}`);
    }
    if (status === 'COMPLETED') {
      onStatus?.('⟳ Downloading…');
      const rr = await fetch(`${proxyBase}/fal/result`, {
        method: 'POST', headers,
        body: JSON.stringify({ response_url: responseUrl }),
        signal,
      });
      if (!rr.ok) throw new Error(`fal.ai proxy: result fetch failed (${rr.status})`);
      return await rr.json();
    }
  }
  throw new Error('fal.ai: timeout — generation did not complete within 10 minutes.');
}

// ── Compress ref image to JPEG 100% quality before sending ───────────────────
// Keeps full resolution by default — just re-encodes to JPEG to reduce payload.
// Optional maxDim: downscale longest side to this value (e.g. 3840 for UHD).
// Optional maxArea: downscale total pixel area (e.g. 4194304 for 4 MP Qwen2 limit).
// A 5K PNG can be 30–50MB raw; same pixels as JPEG 100% = 3–6MB, safely under
// fal.ai's 10MB per-image limit. For Kling, additionally cap at UHD (3840px).
async function _compressRefToJpeg(apiRef, maxDim = null, maxArea = null) {
  if (!apiRef?.data) return apiRef;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      // Downscale if maxDim set and image exceeds it (maintains aspect ratio)
      if (maxDim && (w > maxDim || h > maxDim)) {
        if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
        else        { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      // Downscale if maxArea set and pixel count exceeds it (maintains aspect ratio)
      if (maxArea && (w * h > maxArea)) {
        const scale = Math.sqrt(maxArea / (w * h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 1.0);  // 100% quality
      resolve({ data: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = () => resolve(apiRef);  // fallback: return original unchanged
    img.src = `data:${apiRef.mimeType};base64,${apiRef.data}`;
  });
}

// Drop-in replacement for getRefDataForApi that also JPEG-compresses the result.
// maxDim: optional cap on longest side (e.g. 3840 for Kling UHD limit)
// maxArea: optional cap on total pixels (e.g. 4194304 for Qwen2 4 MP limit)
async function _refAsJpeg(ref, maxPx, maxDim = null, maxArea = null) {
  const apiRef = await getRefDataForApi(ref, maxPx);
  return _compressRefToJpeg(apiRef, maxDim, maxArea);
}
async function _downloadFalImage(url, onStatus, sizeHint) {
  onStatus?.(`⟳ Downloading image${sizeHint ? ` ${sizeHint}` : ''}…`);
  const imgResp = await fetch(url);
  if (!imgResp.ok) throw new Error(`fal.ai: image download failed (${imgResp.status})`);
  const blob = await imgResp.blob();
  const mimeType = blob.type || 'image/jpeg';
  const base64 = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
  return { base64, mimeType };
}

// ═══════════════════════════════════════════════════════
// FLUX.2 — fal.ai queue
// ═══════════════════════════════════════════════════════
async function callFlux(apiKey, prompt, model, refs, snap, onStatus) {
  const hasRefs      = refs && refs.length > 0;
  const endpointPath = hasRefs ? `${model.id}/edit` : model.id;

  const ratio = snap.ratio || `${snap.width}:${snap.height}`;
  const tier  = snap.tier  || snap.width || 1024;

  const payload = {
    prompt,
    image_size:    falImageSize(ratio, tier),
    output_format: 'jpeg',
  };
  if (model.steps)                                     payload.num_inference_steps = snap.steps;
  if (model.guidance)                                  payload.guidance_scale      = snap.guidance;
  if (model.safetyTolerance)                           payload.safety_tolerance    = String(snap.safetyTolerance);
  if (model.promptUpsampling && snap.promptUpsampling) payload.enable_prompt_expansion = true;
  if (snap.seed)                                       payload.seed = parseInt(snap.seed);

  if (hasRefs) {
    const limited = refs.slice(0, model.maxRefs || 8);
    const apiRefs = await Promise.all(limited.map(r => _refAsJpeg(r, 'setting')));
    payload.image_urls = apiRefs.map(r => `data:${r.mimeType};base64,${r.data}`);
  }

  const data = await _falQueue(apiKey, endpointPath, payload, onStatus);

  const imageObj   = data.images?.[0];
  if (!imageObj?.url) throw new Error('fal.ai FLUX: no image in result.');
  const actualW    = imageObj.width  || snap.width  || 1024;
  const actualH    = imageObj.height || snap.height || 1024;
  const actualSeed = data.seed ?? snap.seed ?? '—';

  const { base64, mimeType } = await _downloadFalImage(imageObj.url, onStatus, `${actualW}×${actualH}`);

  return {
    type:     'flux',
    images:   [base64],
    mimeType,
    model:    model.name,
    modelKey: getModelKey(model),
    seed:     actualSeed,
    size:     `${actualW}×${actualH}`,
    steps:    model.steps ? snap.steps : '—',
    ratio:    `${actualW}:${actualH}`,
  };
}

// ═══════════════════════════════════════════════════════
// SEEDREAM — ByteDance via fal.ai queue
// ═══════════════════════════════════════════════════════
async function callSeedream(apiKey, prompt, model, refs, snap, onStatus) {
  const hasRefs      = refs && refs.length > 0;
  const endpointPath = hasRefs ? `${model.id}/edit` : `${model.id}/text-to-image`;

  const ratio = snap.aspectRatio || document.getElementById('aspectRatio')?.value || '16:9';
  const isSD5 = model.id.includes('/v5/');
  let imageSize;
  if (isSD5) {
    imageSize = snap.resolution === '3K' ? 'auto_3K' : 'auto_2K';
  } else if (snap.resolution === '4K') {
    const { w, h } = calcFluxDims(ratio, 3840);
    imageSize = { width: w, height: h };
  } else {
    const { w, h } = calcFluxDims(ratio, 2560);
    imageSize = { width: w, height: h };
  }

  const payload = {
    prompt,
    image_size:            imageSize,
    num_images:            1,
    max_images:            1,
    enhance_prompt_mode:   snap.enhanceMode || 'standard',
    enable_safety_checker: snap.safety !== false,
  };
  if (snap.seed) payload.seed = parseInt(snap.seed);

  if (hasRefs) {
    const limited = refs.slice(0, model.maxRefs || 10);
    const apiRefs = await Promise.all(limited.map(r => _refAsJpeg(r, 'setting')));
    payload.image_urls = apiRefs.map(r => `data:${r.mimeType};base64,${r.data}`);
  }

  const data = await _falQueue(apiKey, endpointPath, payload, onStatus);

  const imageObj   = data.images?.[0];
  if (!imageObj?.url) throw new Error('fal.ai SeeDream: no image in result.');
  const actualW    = imageObj.width  || 0;
  const actualH    = imageObj.height || 0;
  const actualSeed = data.seed ?? snap.seed ?? '—';
  const sizeLabel  = (actualW && actualH) ? `${actualW}×${actualH}` : snap.imageSize;

  const { base64, mimeType } = await _downloadFalImage(imageObj.url, onStatus, sizeLabel);

  return {
    type:     'seedream',
    images:   [base64],
    mimeType,
    model:    model.name,
    modelKey: getModelKey(model),
    seed:     actualSeed,
    size:     sizeLabel,
    ratio:    (actualW && actualH) ? `${actualW}:${actualH}` : snap.imageSize,
  };
}

// ═══════════════════════════════════════════════════════
// KLING IMAGE — Kuaishou via fal.ai queue
// ═══════════════════════════════════════════════════════
async function callKling(apiKey, prompt, model, refs, snap, onStatus) {
  const hasRefs      = refs && refs.length > 0;
  const endpointPath = `${model.id}${hasRefs ? '/image-to-image' : '/text-to-image'}`;

  const resKey      = snap.resolution || '1K';
  const KLING_RATIOS = new Set(['16:9','9:16','1:1','4:3','3:4','3:2','2:3','21:9']);
  const rawRatio    = document.getElementById('aspectRatio')?.value || '16:9';
  const isO3        = model.id.includes('/o3');
  const aspectRatio = (isO3 && hasRefs) ? 'auto'
                    : KLING_RATIOS.has(rawRatio) ? rawRatio : '16:9';

  const payload = {
    prompt,
    resolution:   resKey,
    aspect_ratio: aspectRatio,
    num_images:   1,
  };

  if (hasRefs) {
    const limited = refs.slice(0, model.maxRefs || 10);
    // Kling API limit: 10MB per ref, max generation UHD (3840px) — cap + JPEG compress
    const apiRefs = await Promise.all(limited.map(r => _refAsJpeg(r, 3840)));
    payload.image_urls = apiRefs.map(r => `data:${r.mimeType};base64,${r.data}`);
    payload.image_url  = payload.image_urls[0];
    if (limited.length > 1) payload.reference_image_urls = payload.image_urls.slice(1);
  }

  const data = await _falQueue(apiKey, endpointPath, payload, onStatus);

  const imageObj = data.images?.[0] || data.image;
  if (!imageObj?.url) throw new Error('fal.ai Kling: no image in result.');
  const actualW = imageObj.width  || 1024;
  const actualH = imageObj.height || 1024;

  const { base64, mimeType } = await _downloadFalImage(imageObj.url, onStatus, `${actualW}×${actualH}`);

  return {
    type:            'kling',
    images:          [base64],
    mimeType,
    model:           model.name,
    modelKey:        getModelKey(model),
    seed:            '—',
    size:            `${actualW}×${actualH}`,
    ratio:           `${actualW}:${actualH}`,
    klingResolution: snap.resolution || '1K',
  };
}

// ═══════════════════════════════════════════════════════
// Z-IMAGE — Tongyi-MAI via fal.ai queue
// ═══════════════════════════════════════════════════════
async function callZImage(apiKey, prompt, model, refs, snap, onStatus) {
  const isTurbo      = model.id.includes('turbo');
  const i2iRef       = (model.i2iModel && refs && refs.length > 0) ? refs[0] : null;
  const hasI2I       = !!i2iRef;
  const endpointPath = (hasI2I && isTurbo) ? 'fal-ai/z-image/turbo/image-to-image' : model.id;

  const aspectRatio = document.getElementById('aspectRatio')?.value || '16:9';
  const mpTarget    = parseInt(snap.imageSize) || 1;

  const payload = {
    prompt,
    image_size:            calcZImageDims(aspectRatio, mpTarget),
    num_images:            1,
    num_inference_steps:   snap.steps || (isTurbo ? 8 : 28),
    enable_safety_checker: snap.safety !== false,
    output_format:         'png',
  };
  if (isTurbo)                         payload.acceleration    = snap.acceleration || 'regular';
  if (model.guidance && snap.guidance) payload.guidance_scale  = snap.guidance;
  if (model.negPrompt && snap.negPrompt) payload.negative_prompt = snap.negPrompt;
  if (snap.seed)                       payload.seed            = parseInt(snap.seed);
  if (hasI2I) {
    const apiRef = await _refAsJpeg(i2iRef, REF_MAX_PX);
    payload.image_url = `data:${apiRef.mimeType};base64,${apiRef.data}`;
    payload.strength  = snap.strength ?? (isTurbo ? 0.85 : 0.5);
  }

  const data = await _falQueue(apiKey, endpointPath, payload, onStatus);

  const imageObj   = data.images?.[0];
  if (!imageObj?.url) throw new Error('fal.ai Z-Image: no image in result.');
  const actualW    = imageObj.width  || 1024;
  const actualH    = imageObj.height || 1024;
  const actualSeed = data.seed ?? snap.seed ?? '—';

  const { base64, mimeType } = await _downloadFalImage(imageObj.url, onStatus, `${actualW}×${actualH}`);

  return {
    type:         'zimage',
    images:       [base64],
    mimeType,
    model:        model.name,
    modelKey:     getModelKey(model),
    seed:         actualSeed,
    size:         `${actualW}×${actualH}`,
    ratio:        `${actualW}:${actualH}`,
    imageSize:    snap.imageSize,
    steps:        snap.steps,
    guidance:     snap.guidance,
    negPrompt:    snap.negPrompt,
    acceleration: snap.acceleration,
  };
}

// ═══════════════════════════════════════════════════════
// QWEN IMAGE 2 — Alibaba Tongyi via fal.ai queue
// ═══════════════════════════════════════════════════════
async function callQwen2(apiKey, prompt, model, refs, snap, onStatus) {
  const isEdit       = !!model.editModel;
  const endpointPath = model.id;
  let payload;

  if (isEdit) {
    if (!refs || refs.length === 0) throw new Error('Qwen2 Edit: upload at least one image to the ref panel.');
    // Multi-ref: convert all refs to JPEG data URIs (up to 4), max 4 MP each
    const limited = refs.slice(0, 4);
    const apiRefs = await Promise.all(limited.map(r => _refAsJpeg(r, null, null, 4194304)));
    const imageUrls = apiRefs.map(r => `data:${r.mimeType};base64,${r.data}`);
    // Use first ref's dimensions for output size
    const inputDims = await new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = imageUrls[0];
    });
    payload = {
      prompt,
      image_urls:            imageUrls,
      num_inference_steps:   snap.steps || 25,
      guidance_scale:        snap.guidance ?? 5.0,
      num_images:            1,
      enable_safety_checker: snap.safety !== false,
      output_format:         'png',
    };
    if (inputDims) payload.image_size = { width: inputDims.width, height: inputDims.height };
    if (snap.seed) payload.seed = parseInt(snap.seed);
    if (snap.negPrompt) payload.negative_prompt = snap.negPrompt;
  } else {
    const qwTier = snap.resolution === '2K' ? 2048 : 1664;
    payload = {
      prompt,
      image_size:            falImageSize(document.getElementById('aspectRatio')?.value || '16:9', qwTier),
      num_inference_steps:   snap.steps || 25,
      guidance_scale:        snap.guidance ?? 5.0,
      num_images:            1,
      acceleration:          snap.acceleration || 'regular',
      enable_safety_checker: snap.safety !== false,
      output_format:         'png',
    };
    if (snap.seed)            payload.seed = parseInt(snap.seed);
    if (snap.promptExpansion) payload.enable_prompt_expansion = true;
    if (snap.negPrompt)       payload.negative_prompt = snap.negPrompt;
  }

  const data = await _falQueue(apiKey, endpointPath, payload, onStatus);

  const imageObj   = data.images?.[0];
  if (!imageObj?.url) throw new Error('fal.ai Qwen2: no image in result.');
  const actualW    = imageObj.width  || 1024;
  const actualH    = imageObj.height || 1024;
  const actualSeed = data.seed ?? snap.seed ?? '—';

  const { base64, mimeType } = await _downloadFalImage(imageObj.url, onStatus, `${actualW}×${actualH}`);

  return {
    type:         'qwen2',
    images:       [base64],
    mimeType,
    model:        model.name,
    modelKey:     getModelKey(model),
    seed:         actualSeed,
    size:         `${actualW}×${actualH}`,
    ratio:        `${actualW}:${actualH}`,
    steps:        snap.steps,
    guidance:     snap.guidance,
    negPrompt:    snap.negPrompt,
    acceleration: snap.acceleration,
  };
}

// ── FLUX Pro Fill — inpainting (used by paint.js runInpaint) ──
async function callFluxFill(apiKey, imageB64, maskB64, prompt, width, height, onStatus, signal, opts = {}) {
  const { steps = 28, guidance = 3.5, seed = null, safetyTolerance = '2' } = opts;
  const payload = {
    image_url: `data:image/jpeg;base64,${imageB64}`,
    mask_url:  `data:image/png;base64,${maskB64}`,
    prompt:    prompt || '',
    num_inference_steps: steps,
    guidance_scale: guidance,
    safety_tolerance: safetyTolerance,
  };
  if (seed !== null) payload.seed = seed;

  const data = await _falQueue(apiKey, 'fal-ai/flux-pro/v1/fill', payload, onStatus, signal);

  const imageObj = data.images?.[0];
  if (!imageObj?.url) throw new Error('FLUX Fill: no image in result.');
  const actualW = imageObj.width  || width;
  const actualH = imageObj.height || height;

  const { base64, mimeType } = await _downloadFalImage(imageObj.url, onStatus, `${actualW}×${actualH}`);
  return { base64, mimeType, width: actualW, height: actualH };
}

// ── FLUX General Inpainting (fal-ai/flux-general/inpainting) ──
async function callFluxGeneralInpaint(apiKey, params, onStatus, signal) {
  const {
    imageB64, maskB64, prompt, width, height,
    steps = 28, guidance = 3.5, strength = 0.85, seed = null,
    controlNetB64 = null, controlNetType = null, ctrlScale = 0.5,
    refB64 = null, refStrength = 0.65,
  } = params;

  const payload = {
    image_url:          `data:image/jpeg;base64,${imageB64}`,
    mask_url:           `data:image/png;base64,${maskB64}`,
    prompt:             prompt || '',
    image_size:         { width, height },
    num_inference_steps: steps,
    guidance_scale:     guidance,
    strength,
    num_images:         1,
  };
  if (seed !== null)   payload.seed = seed;

  // ControlNet
  if (controlNetB64 && controlNetType) {
    const cnPath = controlNetType === 'depth'
      ? 'jasperai/Flux.1-dev-Controlnet-Depth'
      : 'InstantX/FLUX.1-dev-Controlnet-Canny';
    payload.controlnets = [{
      path:               cnPath,
      control_image_url:  `data:image/png;base64,${controlNetB64}`,
      conditioning_scale: ctrlScale,
      start_percentage:   0,
      end_percentage:     1,
    }];
  }

  // Reference image
  if (refB64) {
    payload.reference_image_url = `data:image/jpeg;base64,${refB64}`;
    payload.reference_strength  = refStrength;
  }

  const data = await _falQueueViaProxy(apiKey, 'fal-ai/flux-general/inpainting', payload, onStatus, signal);

  const imageObj = data.images?.[0];
  if (!imageObj?.url) throw new Error('FLUX Inpaint: no image in result.');
  const actualW = imageObj.width  || width;
  const actualH = imageObj.height || height;
  const { base64, mimeType } = await _downloadFalImage(imageObj.url, onStatus, `${actualW}×${actualH}`);
  return { base64, mimeType, width: actualW, height: actualH };
}

// ── Depth Anything v2 — for ControlNet depth maps ──
async function callDepthAnything(apiKey, imageB64, onStatus, signal) {
  // depth-anything is sync → routed through GIS proxy (CORS bypass)
  if (onStatus) onStatus('⏳ Generating depth map…');
  const proxyBase = getProxyUrl();
  const res = await fetch(`${proxyBase}/depth`, {
    method: 'POST',
    headers: { 'X-Fal-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: `data:image/jpeg;base64,${imageB64}` }),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Depth: ${res.status} ${txt.slice(0,120)}`);
  }
  const data = await res.json();
  const depthUrl = data.image?.url || data.depth_map_url || data.images?.[0]?.url;
  if (!depthUrl) throw new Error('DepthAnything: no depth URL in result.');
  if (onStatus) onStatus('⬇ Downloading depth map…');
  const { base64, mimeType } = await _downloadFalImage(depthUrl, onStatus, 'depth');
  return { base64, mimeType };
}

// ── Generic simple fal.ai inpaint helper ─────────────────────────────────────
// Used by FLUX Dev, FLUX Krea, and any future simple inpaint model.
// endpoint: fal.ai model path, label: error label, extraPayload: model-specific fields
async function _runSimpleInpaint(apiKey, endpoint, label, params, onStatus, signal, extraPayload = {}) {
  const { imageB64, maskB64, prompt, width, height,
          steps = 28, guidance = 3.5, strength = 0.85, seed = null } = params;
  const payload = {
    image_url:           `data:image/jpeg;base64,${imageB64}`,
    mask_url:            `data:image/png;base64,${maskB64}`,
    prompt:              prompt || '',
    num_inference_steps: steps,
    guidance_scale:      guidance,
    strength,
    num_images:          1,
    output_format:       'jpeg',
    ...extraPayload,
  };
  if (seed !== null) payload.seed = seed;
  const data = await _falQueue(apiKey, endpoint, payload, onStatus, signal);
  const imageObj = data.images?.[0];
  if (!imageObj?.url) throw new Error(`${label}: no image in result.`);
  const actualW = imageObj.width || width, actualH = imageObj.height || height;
  const { base64, mimeType } = await _downloadFalImage(imageObj.url, onStatus, `${actualW}×${actualH}`);
  return { base64, mimeType, width: actualW, height: actualH };
}

// ── FLUX Dev Inpaint ─────────────────────────────────────────────────────────
async function callFluxDevInpaint(apiKey, params, onStatus, signal) {
  return _runSimpleInpaint(apiKey, 'fal-ai/flux-lora/inpainting', 'FLUX Dev Inpaint', params, onStatus, signal);
}

// ── FLUX Krea Inpaint ────────────────────────────────────────────────────────
async function callFluxKreaInpaint(apiKey, params, onStatus, signal) {
  return _runSimpleInpaint(apiKey, 'fal-ai/flux-krea-lora/inpainting', 'FLUX Krea Inpaint', params, onStatus, signal);
}


