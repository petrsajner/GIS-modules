// ══════════════════════════════════════════════════════════
// PROXY PROVIDERS — xAI + Luma (via Cloudflare Workers)
// ══════════════════════════════════════════════════════════

// Grok Imagine — xAI synchronous T2I via Worker proxy
// Worker endpoint: POST /xai/generate
// Response: { images: [{ b64_data, mime_type }] }
async function callProxyXaiMulti(apiKey, proxyUrl, prompt, model, refs, snap) {
  const count       = snap?.grokCount   || 1;
  const aspectRatio = snap?.aspectRatio || '16:9';
  const resolution  = snap?.grokRes     || '1k';
  const modelKey    = getModelKey(model);

  const payload = {
    xai_key:      apiKey,
    prompt,
    model:        model.id,
    aspect_ratio: aspectRatio,
    n:            count,
    resolution,
  };

  // I2I: first ref → image_url
  if (refs && refs.length > 0) {
    const apiRef = await getRefDataForApi(refs[0], 'setting');
    payload.image_url = `data:${apiRef.mimeType};base64,${apiRef.data}`;
  }

  const resp = await fetch(`${proxyUrl}/xai/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`API ${resp.status}: ${err.error || err.detail || resp.statusText}`);
  }

  const data = await resp.json();
  if (!data.images || !data.images.length) throw new Error('Proxy xAI: no image in result');

  return data.images.map(img => ({
    type:     'proxy_xai',
    images:   [img.b64_data],
    model:    model.name,
    modelKey,
    seed:     '—',
    size:     '—',
    ratio:    aspectRatio,
  }));
}

// Luma Photon / Photon Flash — via Worker proxy with reference upload
// Worker endpoints: POST /luma/generate (submit) + POST /luma/status (poll)
// Polling is done by GIS — Worker never waits, always returns in <5s.
async function callProxyLuma(apiKey, proxyUrl, prompt, model, refs, snap) {
  const LUMA_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9', '9:21', '21:9']);
  const rawRatio    = snap?.aspectRatio || document.getElementById('aspectRatio').value;
  const aspectRatio = LUMA_RATIOS.has(rawRatio) ? rawRatio : '16:9';

  const image_refs    = [];
  const style_refs    = [];
  let   character_ref = null;
  let   modify_ref    = null;

  const imgWeight    = snap?.imgWeight    ?? 0.85;
  const styleWeight  = snap?.styleWeight  ?? 0.80;
  const modifyWeight = snap?.modifyWeight ?? 1.00;

  const characterImages = [];

  for (const ref of (refs || [])) {
    const apiRef = await getRefDataForApi(ref, 'setting');
    const entry  = { b64_data: apiRef.data, mime_type: apiRef.mimeType };
    const tag    = (ref.userLabel || '').toLowerCase();

    if (tag.includes('[modify]') || tag.includes('[edit]')) {
      if (!modify_ref) modify_ref = { ...entry, weight: modifyWeight };
    } else if (tag.includes('[character]') || tag.includes('[char]')) {
      if (characterImages.length < 4) characterImages.push(entry);
    } else if (tag.includes('[style]')) {
      style_refs.push({ ...entry, weight: styleWeight });
    } else {
      if (image_refs.length < 4) image_refs.push({ ...entry, weight: imgWeight });
    }
  }

  if (characterImages.length > 0) character_ref = characterImages;

  const payload = {
    luma_key:     apiKey,
    prompt,
    model:        model.id,
    aspect_ratio: aspectRatio,
  };

  if (image_refs.length)  payload.image_refs    = image_refs;
  if (style_refs.length)  payload.style_refs    = style_refs;
  if (character_ref)      payload.character_ref = character_ref;
  if (modify_ref)         payload.modify_ref    = modify_ref;

  // Step 1: submit — Worker returns generation_id immediately after uploading refs
  const submitResp = await fetch(`${proxyUrl}/luma/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!submitResp.ok) {
    const err = await submitResp.json().catch(() => ({}));
    throw new Error(`Luma submit ${submitResp.status}: ${err.error || err.detail || submitResp.statusText}`);
  }
  const submitData = await submitResp.json();
  const generationId = submitData.generation_id;
  if (!generationId) throw new Error('Luma: no generation_id from Worker');

  // Step 2: poll /luma/status until done (GIS polls, Worker just checks once per call)
  const POLL_INTERVAL = 4000;
  const POLL_TIMEOUT  = 10 * 60 * 1000; // 10 minutes
  const deadline      = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const statusResp = await fetch(`${proxyUrl}/luma/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ luma_key: apiKey, generation_id: generationId }),
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
      const modelKey = getModelKey(model);
      return {
        type:     'proxy_luma',
        images:   [status.b64_data],
        model:    model.name,
        modelKey,
        seed:     '—',
        size:     '—',
        ratio:    snap?.aspectRatio || '1:1',
      };
    }
    // status === 'pending' → keep polling
  }

  throw new Error('Luma timeout — generation did not complete within 10 minutes');
}

// ═══════════════════════════════════════════════════════
// FREEPIK/MAGNIFIC — shared polling helper
// Polls /magnific/status and returns the result image URL
// upscalerType: 'mystic' | 'skin_enhancer' | 'relight' | 'style_transfer'
// ═══════════════════════════════════════════════════════
async function _pollFreepikTask(proxyUrl, freepikKey, taskId, upscalerType) {
  const POLL  = 4000;
  const LIMIT = 150;  // 10 min max
  for (let i = 0; i < LIMIT; i++) {
    await new Promise(r => setTimeout(r, POLL));
    const resp = await fetch(`${proxyUrl}/magnific/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ freepik_key: freepikKey, task_id: taskId, upscaler_type: upscalerType }),
    });
    if (!resp.ok) continue;
    const data = await resp.json();
    if (data.status === 'done')    return data.url;
    if (data.status === 'failed')  throw new Error(`Freepik ${upscalerType} failed: ${data.error || 'unknown'}`);
  }
  throw new Error(`Freepik ${upscalerType}: timeout`);
}

// Fetch a remote image URL → { imageData (base64), mimeType, width, height }
async function _fetchFreepikResult(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download result: ${resp.status}`);
  const blob    = await resp.blob();
  const mimeType = blob.type || 'image/png';
  const buf     = await blob.arrayBuffer();
  const bytes   = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  const imageData = btoa(bin);
  const dims = await new Promise(resolve => {
    const burl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload  = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(burl); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(burl); };
    img.src = burl;
  });
  return { imageData, mimeType, width: dims.w, height: dims.h };
}

// ═══════════════════════════════════════════════════════
// MYSTIC — image generation (Freepik/Magnific)
// ═══════════════════════════════════════════════════════
async function callProxyMystic(freepikKey, proxyUrl, prompt, model, refs, snap) {
  if (!freepikKey) throw new Error('Freepik API key missing');
  if (!proxyUrl)   throw new Error('Proxy URL missing');

  // Map GIS aspect ratio → Freepik string
  const ar = snap.aspectRatio || '1:1';
  const aspectRatio = MYSTIC_ASPECT_MAP[ar] || 'square_1_1';

  const payload = {
    freepik_key:        freepikKey,
    prompt,
    mystic_model:       model.mysticModel || 'realism',
    resolution:         snap.resolution    || '2k',
    aspect_ratio:       aspectRatio,
    creative_detailing: snap.creative_detailing ?? 33,
    engine:             snap.engine         || 'automatic',
    fixed_generation:   snap.fixed          || false,
    structure_strength: snap.structure_strength ?? 50,
    adherence:          snap.adherence      ?? 50,
  };

  // refs[0] → structure_reference, refs[1] → style_reference
  if (refs && refs.length > 0) {
    const r0 = await getRefDataForApi(refs[0], null);
    if (r0) payload.structure_ref_b64 = r0.data;
  }
  if (refs && refs.length > 1) {
    const r1 = await getRefDataForApi(refs[1], null);
    if (r1) payload.style_ref_b64 = r1.data;
  }

  // Submit
  const submitResp = await fetch(`${proxyUrl}/magnific/mystic`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!submitResp.ok) throw new Error(`Mystic submit: ${submitResp.status} ${await submitResp.text()}`);
  const submitData = await submitResp.json();
  const taskId = submitData.task_id;
  if (!taskId) throw new Error('Mystic: no task_id returned');

  // Poll
  const url = await _pollFreepikTask(proxyUrl, freepikKey, taskId, 'mystic');

  // Download result
  const { imageData, mimeType, width, height } = await _fetchFreepikResult(url);
  return {
    type:     'proxy_mystic',
    images:   [imageData],
    mimeType,
    model:    model.name,
    modelKey: getModelKey(model),
    seed:     '—',
    size:     width && height ? `${width}×${height}` : snap.resolution,
    ratio:    ar,
  };
}

// ═══════════════════════════════════════════════════════
// FREEPIK EDIT TOOLS — Relight, Style Transfer, Skin Enhancer
// Called from output-render.js (post-processing existing gallery images)
// Returns { imageData, mimeType }
// ═══════════════════════════════════════════════════════

async function callFreepikRelight(freepikKey, proxyUrl, imageB64, opts = {}) {
  const payload = {
    freepik_key: freepikKey,
    image_b64:   imageB64,
    prompt:             opts.prompt            || '',
    transfer_ref_b64:   opts.transfer_ref_b64  || undefined,
    light_transfer_strength: opts.light_transfer_strength ?? 100,
    change_background:  opts.change_background || false,
    style:              opts.style             || 'smooth',
    interpolate:        opts.interpolate       || false,
  };
  const resp = await fetch(`${proxyUrl}/magnific/relight`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Relight submit: ${resp.status} ${await resp.text()}`);
  const { task_id } = await resp.json();
  if (!task_id) throw new Error('Relight: no task_id');
  const url = await _pollFreepikTask(proxyUrl, freepikKey, task_id, 'relight');
  return _fetchFreepikResult(url);
}

async function callFreepikStyleTransfer(freepikKey, proxyUrl, imageB64, referenceB64, opts = {}) {
  const payload = {
    freepik_key:      freepikKey,
    image_b64:        imageB64,
    reference_b64:    referenceB64,
    is_portrait:      opts.is_portrait     || false,
    fixed_generation: opts.fixed           || false,
  };
  if (opts.is_portrait && opts.style) payload.style = opts.style;
  const resp = await fetch(`${proxyUrl}/magnific/style-transfer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Style Transfer submit: ${resp.status} ${await resp.text()}`);
  const { task_id } = await resp.json();
  if (!task_id) throw new Error('Style Transfer: no task_id');
  const url = await _pollFreepikTask(proxyUrl, freepikKey, task_id, 'style_transfer');
  return _fetchFreepikResult(url);
}

async function callFreepikSkinEnhancer(freepikKey, proxyUrl, imageB64, opts = {}) {
  const payload = {
    freepik_key: freepikKey,
    image_b64:   imageB64,
    variant:     opts.variant     || 'creative',
    sharpen:     opts.sharpen     ?? 0,
    smart_grain: opts.smart_grain ?? 2,
  };
  const resp = await fetch(`${proxyUrl}/magnific/skin-enhancer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Skin Enhancer submit: ${resp.status} ${await resp.text()}`);
  const { task_id } = await resp.json();
  if (!task_id) throw new Error('Skin Enhancer: no task_id');
  const url = await _pollFreepikTask(proxyUrl, freepikKey, task_id, 'skin_enhancer');
  return _fetchFreepikResult(url);
}

// ══════════════════════════════════════════════════════════
// SEGMIND — WAN 2.7 Image (via Segmind API)
// Worker endpoint: POST /segmind/image (sync passthrough)
// Segmind uses OpenAI-like messages format
// Image URLs in response expire after 24h — must download immediately
// ══════════════════════════════════════════════════════════

async function callSegmindWan27(segmindKey, proxyUrl, prompt, model, refs, snap, onStatus) {
  const isEdit = !!model.editModel;
  const modelId = model.id;  // wan2.7-image or wan2.7-image-pro

  // Build messages content array
  const content = [];
  content.push({ text: prompt, type: 'text' });

  // Edit mode: upload ref images to R2 → get public URLs → add to content
  if (isEdit && refs?.length) {
    onStatus?.('⟳ Uploading refs…');
    for (let i = 0; i < Math.min(refs.length, 9); i++) {
      const ref = refs[i];
      const apiRef = await getRefDataForApi(ref, REF_MAX_PX);
      // Convert base64 → Blob → upload to R2
      const binary = atob(apiRef.data);
      const bytes = new Uint8Array(binary.length);
      for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
      const blob = new Blob([bytes], { type: apiRef.mimeType });
      const uploadResp = await fetch(`${proxyUrl}/r2/upload`, {
        method: 'POST',
        headers: { 'Content-Type': apiRef.mimeType },
        body: blob,
      });
      if (!uploadResp.ok) throw new Error(`R2 upload failed for ref ${i + 1}: ${uploadResp.status}`);
      const { url } = await uploadResp.json();
      if (!url) throw new Error(`R2 upload: no URL for ref ${i + 1}`);
      content.push({ image: url, type: 'image' });
    }
  }

  // Build parameters — Segmind uses preset sizes ("1K", "2K", "4K"), not pixel strings
  // Segmind also requires top-level `prompt` field (messages alone not enough)
  const parameters = { watermark: false, prompt };
  if (!isEdit) {
    // Convert pixel string "2048*1152" → preset "1K"/"2K"/"4K"
    const sizeStr = snap.size || '2048*1152';
    const maxDim = Math.max(...sizeStr.split('*').map(Number));
    parameters.size = maxDim > 2048 ? '4K' : maxDim > 1280 ? '2K' : '1K';
    if (snap.negPrompt) parameters.negative_prompt = snap.negPrompt;
  }
  if (snap.seed) parameters.seed = parseInt(snap.seed);

  // Submit to Worker → Segmind
  onStatus?.('⟳ Generating…');
  const resp = await fetch(`${proxyUrl}/segmind/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: segmindKey,
      model: modelId,
      messages: [{ role: 'user', content }],
      parameters,
    }),
  });

  // Segmind returns raw image binary (PNG) on success, JSON on error
  const ct = resp.headers.get('content-type') || '';
  if (!resp.ok || ct.includes('application/json')) {
    const err = await resp.json().catch(() => ({}));
    const detail = err.message || err.output?.message || err.error || JSON.stringify(err).slice(0, 300);
    throw new Error(`Segmind ${resp.status}: ${detail}`);
  }

  // Read binary image response
  onStatus?.('⟳ Processing…');
  const blob = await resp.blob();
  const mimeType = blob.type || 'image/png';
  const base64 = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });

  // Detect actual dimensions
  const actualDims = await new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload  = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });

  const sizeStr = actualDims.w ? `${actualDims.w}×${actualDims.h}` : (snap.size || '2048×1152').replace('*', '×');
  function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
  const g = actualDims.w && actualDims.h ? gcd(actualDims.w, actualDims.h) : 1;
  const ratioStr = actualDims.w ? `${actualDims.w/g}:${actualDims.h/g}` : '—';

  return {
    type:     'wan27r',
    images:   [base64],
    mimeType,
    model:    model.name,
    modelKey: getModelKey(model),
    seed:     snap.seed ?? '—',
    size:     sizeStr,
    ratio:    ratioStr,
  };
}
