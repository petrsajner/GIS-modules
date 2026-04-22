// ═══════════════════════════════════════════════════════
// GPT IMAGE 1.5 & GPT IMAGE 2 — text-to-image + edit (fal.ai)
// ═══════════════════════════════════════════════════════
// Endpoints (fal-managed, no BYOK):
//   openai/gpt-image-2          — T2I
//   openai/gpt-image-2/edit     — I2I (+ optional mask)
//   fal-ai/gpt-image-1.5        — T2I
//   fal-ai/gpt-image-1.5/edit   — I2I (+ optional mask)
//
// Key differences:
//   GPT 2 edit mask field: mask_url
//   GPT 1.5 edit mask field: mask_image_url
//   GPT 1.5 supports background=transparent, input_fidelity (we hardcode high)
//   GPT 2 resolution: 6 presets + custom (up to 4K)
//   GPT 1.5 resolution: 3 presets only (1024x1024, 1024x1536, 1536x1024)
//
// Mask format (both models): PNG with alpha channel
//   alpha=0   → edit this region
//   alpha=255 → keep unchanged
//   Mask MUST match input image dimensions
//
// Auth: Authorization: Key {falKey} (same pattern as other fal endpoints)
// Submit + poll via fal queue — reuses _falQueue helper from fal.js
// Streaming is available on /edit endpoints — supported separately below.

// ── FAL image_size presets supported by GPT Image 2 ─────────────────────
// (aliases match existing FAL_PRESETS in models.js)
const _GPT2_SIZE_ENUM = new Set([
  'square_hd', 'square',
  'portrait_4_3', 'portrait_16_9',
  'landscape_4_3', 'landscape_16_9',
]);

// GPT 1.5 accepts only pixel-string sizes: 1024x1024, 1024x1536, 1536x1024
// We map aspect ratio → one of these 3 strings.
function _gpt15SizeFromAspect(aspectRatioStr) {
  // portrait-ish: height > width → 1024x1536
  // landscape-ish: width > height → 1536x1024
  // square-ish: 1024x1024
  const parts = (aspectRatioStr || '1:1').split(':').map(Number);
  const [aw, ah] = parts.length === 2 ? parts : [1, 1];
  const r = aw / ah;
  if (r > 1.15) return '1536x1024';
  if (r < 0.85) return '1024x1536';
  return '1024x1024';
}

// GPT 2: map aspect ratio + resolution tier → size (always custom dims for productable output)
// OpenAI preset enum values (landscape_16_9 etc) produce ~1088×608 which is too small
// for production. We always send explicit {width, height} honoring these constraints:
//   - multiples of 16
//   - max edge 3840px
//   - pixel count 655k–8.29M
//   - aspect ratio ≤ 3:1
function _gpt2SizeFromAspect(aspectRatioStr, resolution) {
  const tier = resolution || '1K';
  const longSide = (tier === '4K') ? 3840 : (tier === '2K') ? 2048 : 1536;
  const parts = (aspectRatioStr || '16:9').split(':').map(Number);
  const [aw, ah] = parts.length === 2 ? parts : [16, 9];
  let w, h;
  if (aw >= ah) { w = longSide; h = Math.round(longSide * ah / aw); }
  else          { h = longSide; w = Math.round(longSide * aw / ah); }
  w = Math.round(w / 16) * 16;
  h = Math.round(h / 16) * 16;
  // Minimum pixel floor (655k) — if undercut (extreme AR at 1K), bump long side up
  if (w * h < 655000) {
    const k = Math.sqrt(655000 / (w * h));
    w = Math.ceil(w * k / 16) * 16;
    h = Math.ceil(h * k / 16) * 16;
  }
  // Area cap (8.29M)
  const area = w * h;
  if (area > 8290000) {
    const k = Math.sqrt(8290000 / area);
    w = Math.floor(w * k / 16) * 16;
    h = Math.floor(h * k / 16) * 16;
  }
  return { width: w, height: h };
}

// ── Annotation asset → GPT alpha-channel mask ─────────────────────────────
// Input: base64 PNG of annotation layer (white background + color strokes)
//        as saved by paint.js mode 'B' export.
// Output: base64 PNG, same dims, RGBA where painted pixels have alpha=0
//         (transparent = edit region) and unpainted white pixels have alpha=255
//         (opaque = keep region).
// This is what OpenAI/GPT image models expect as mask input.
async function _annotAssetToGptMask(annotB64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        // Walk pixels: near-white (all channels >= 245) = unpainted → alpha=255 (keep)
        //              anything else = painted → alpha=0 (edit)
        // 245 threshold (not 255) forgives JPEG-like compression noise on annotation assets.
        for (let i = 0; i < d.length; i += 4) {
          const isWhite = d[i] >= 245 && d[i+1] >= 245 && d[i+2] >= 245;
          if (isWhite) {
            d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 255;
          } else {
            d[i+3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
        const out = canvas.toDataURL('image/png').split(',')[1];
        resolve(out);
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Mask source image failed to load'));
    img.src = `data:image/png;base64,${annotB64}`;
  });
}

// ── Resize mask to match target image dimensions ─────────────────────────
// If user annotated a differently-sized asset than the target image ref,
// the mask must still match target dims. Nearest-neighbour keeps alpha sharp.
async function _resizeGptMaskToMatch(maskB64, targetW, targetH) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth === targetW && img.naturalHeight === targetH) {
        resolve(maskB64);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = targetW; canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => reject(new Error('Mask resize: source load failed'));
    img.src = `data:image/png;base64,${maskB64}`;
  });
}

// ── Get image dims from base64 ──────────────────────────────────────────
async function _getImageDims(b64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('Dim probe: load failed'));
    img.src = `data:image/png;base64,${b64}`;
  });
}

// ── Partition refs by role: image (target + contexts) vs mask ─────────────
// First image ref = edit target. Rest of image refs = context (passed in image_urls tail).
// First mask ref (if any) = mask (applied to image #1 per OpenAI docs).
function _partitionGptRefs(refs) {
  const imageRefs = [];
  let maskRef = null;
  for (const r of refs) {
    if (r.role === 'mask' && !maskRef) maskRef = r;
    else imageRefs.push(r);
  }
  return { imageRefs, maskRef };
}

// ── SSE streaming via fetch() — used for /edit endpoints ──────────────────
// fal.ai streaming endpoints accept POST with body, respond with SSE events.
// Each event may carry `images[]` (partial or final) or metadata.
// Returns final result object (same shape as queue result).
async function _falStreamEdit(falKey, endpointPath, payload, onStatus, signal, onPartial) {
  // fal.ai streaming convention: fal.stream() SDK auto-appends /stream to the endpoint ID.
  // REST equivalent: POST https://fal.run/{path}/stream with Accept: text/event-stream.
  // Without the /stream suffix, fal returns a normal sync JSON (no partial previews).
  const streamUrl = `https://fal.run/${endpointPath}/stream`;
  onStatus?.('⟳ Connecting stream…');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');

  const res = await fetch(streamUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`fal.ai stream: submit failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastEvent = null;
  let partialCount = 0;
  let loggedFirst = false;
  const startTime = Date.now();

  while (true) {
    if (signal?.aborted) {
      try { reader.cancel(); } catch (_) {}
      throw new DOMException('Cancelled', 'AbortError');
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE events separated by "\n\n"
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      // An SSE event may have multiple data: lines. Join them.
      const dataLines = chunk.split('\n').filter(l => l.startsWith('data: '));
      if (!dataLines.length) continue;
      const dataStr = dataLines.map(l => l.slice(6)).join('\n').trim();
      if (!dataStr || dataStr === '[DONE]') continue;
      try {
        const evt = JSON.parse(dataStr);
        // Log first event shape to console for debug (trimmed)
        if (!loggedFirst) {
          loggedFirst = true;
          const preview = JSON.stringify(evt, (k, v) =>
            (typeof v === 'string' && v.length > 200) ? v.slice(0, 120) + '…[' + v.length + 'c]' : v
          ).slice(0, 500);
          console.log('[GIS gpt-edit] first stream event:', preview);
        }
        lastEvent = evt;
        // Partial image preview: event has images[] with url or data URI
        if (evt.images && Array.isArray(evt.images) && evt.images.length && onPartial) {
          partialCount++;
          try { onPartial(evt); } catch (_) {}
        }
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const hasPreview = partialCount > 0 && (!evt.images[0]?.url?.startsWith('data:') || evt.images[0].url.length <= 400_000);
        onStatus?.(hasPreview
          ? `⟳ Streaming… (${elapsed}s, ${partialCount} preview frames)`
          : `⟳ Streaming final… (${elapsed}s)`);
      } catch (e) {
        // Non-JSON keep-alive line or malformed — log once to help diagnose
        if (!loggedFirst) console.warn('[GIS gpt-edit] non-JSON stream data:', dataStr.slice(0, 200));
      }
    }
  }
  if (!lastEvent || !lastEvent.images) {
    console.warn('[GIS gpt-edit] stream closed without images. lastEvent keys:',
      lastEvent ? Object.keys(lastEvent) : '(null)');
    throw new Error('fal.ai stream: no images in response');
  }
  return lastEvent;
}

// ── Build payload for a GPT model call ───────────────────────────────────
// Returns { endpointPath, payload } ready for _falQueue / _falStreamEdit.
async function _buildGptPayload(model, prompt, imageRefs, maskRef, snap) {
  const isGpt2 = model.id.includes('gpt-image-2');
  const isEdit = model.id.endsWith('/edit');

  // Size selection
  let image_size;
  if (isEdit && !snap.resolution) {
    image_size = 'auto'; // legacy default: infer from input
  } else if (isGpt2) {
    image_size = _gpt2SizeFromAspect(snap.aspectRatio, snap.resolution || '1K');
  } else {
    image_size = _gpt15SizeFromAspect(snap.aspectRatio);
  }

  const payload = {
    prompt,
    image_size,
    quality: snap.quality || 'medium',
    num_images: 1,   // GIS parallelises at the job layer (N cards = N separate calls)
    output_format: 'png',
  };

  if (isEdit) {
    // image_urls: first = edit target, rest = context references
    const imageUrls = [];
    for (const ref of imageRefs) {
      // Prefer inline base64 (refs carry cached assets as base64 or blob)
      const b64 = await _gptEditGetRefB64(ref);
      imageUrls.push(`data:${ref.mimeType || 'image/png'};base64,${b64}`);
    }
    payload.image_urls = imageUrls;

    // Mask — alpha-channel PNG matching first image dims
    if (maskRef) {
      const annotB64 = await _gptEditGetRefB64(maskRef);
      let maskB64 = await _annotAssetToGptMask(annotB64);
      // Resize to match first image if dims differ
      if (imageUrls.length) {
        const firstImgB64 = await _gptEditGetRefB64(imageRefs[0]);
        const { w, h } = await _getImageDims(firstImgB64);
        maskB64 = await _resizeGptMaskToMatch(maskB64, w, h);
      }
      const maskField = isGpt2 ? 'mask_url' : 'mask_image_url';
      payload[maskField] = `data:image/png;base64,${maskB64}`;
    }

    // GPT 1.5 only: input_fidelity=high (hardcoded per product spec)
    if (!isGpt2) payload.input_fidelity = 'high';
  }

  const endpointPath = model.id;
  return { endpointPath, payload };
}

// ── Ref asset → base64 PNG (reads from IndexedDB via dbGet) ─────────────
async function _gptEditGetRefB64(ref) {
  if (!ref || !ref.assetId) throw new Error('Ref has no assetId');
  const asset = await dbGet('assets', ref.assetId).catch(() => null);
  if (!asset || !asset.imageData) throw new Error(`Ref asset ${ref.assetId} not found`);
  return asset.imageData; // already base64 string
}

// ── Pick SPEND_PRICES key based on model / quality / chosen image_size ───
function _pickGptPriceKey(model, payloadImageSize, quality, resolution) {
  const isGpt2 = model.id.includes('gpt-image-2');
  const q = (quality || 'medium');
  const qTag = q === 'low' ? 'low' : (q === 'high' ? 'high' : 'med');

  // GPT 2 with 2K/4K tier uses flat tier-based pricing
  if (isGpt2 && (resolution === '2K' || resolution === '4K')) {
    return `_gptimg2_${qTag}_${resolution}`;
  }

  // Map preset → size-tag used in SPEND_PRICES keys
  let sizeTag;
  if (typeof payloadImageSize === 'string') {
    const s = payloadImageSize;
    // GPT 2 presets
    if (s === 'square_hd' || s === 'square')                        sizeTag = '1024sq';
    else if (s === 'portrait_16_9' || s === 'portrait_4_3')         sizeTag = '1024x1536';
    else if (s === 'landscape_16_9' || s === 'landscape_4_3')       sizeTag = '1536x1024';
    // GPT 1.5 explicit sizes
    else if (s === '1024x1024')                                     sizeTag = '1024sq';
    else if (s === '1024x1536')                                     sizeTag = '1024x1536';
    else if (s === '1536x1024')                                     sizeTag = '1536x1024';
    // Auto (edit) — pricing depends on output dims, which we don't know upfront.
    // Assume 1024sq (most common for edit outputs). Updated post-hoc if fal returns usage.
    else                                                             sizeTag = '1024sq';
  } else {
    // Custom {width, height} object → approximate by aspect
    const { width: w = 1024, height: h = 1024 } = payloadImageSize || {};
    if (w === h)       sizeTag = '1024sq';
    else if (w > h)    sizeTag = '1536x1024';
    else               sizeTag = '1024x1536';
  }

  if (isGpt2) {
    return `_gptimg2_${qTag}_${sizeTag}`;
  }
  // GPT 1.5: low has special collapsed key for non-square
  if (qTag === 'low') {
    return sizeTag === '1024sq' ? '_gptimg15_low_1024sq' : '_gptimg15_low_other';
  }
  return `_gptimg15_${qTag}_${sizeTag}`;
}
// Signature matches other fal callers (callFlux, callSeedream, …).
async function callGptImage(falKey, prompt, model, refsCopy, snap, onStatus, onPartial) {
  const refs = Array.isArray(refsCopy) ? refsCopy : [];
  const { imageRefs, maskRef } = _partitionGptRefs(refs);
  const isEdit = model.id.endsWith('/edit');

  if (isEdit && imageRefs.length === 0) {
    throw new Error(`${model.name} requires at least one image reference.`);
  }

  const { endpointPath, payload } = await _buildGptPayload(model, prompt, imageRefs, maskRef, snap);

  // Streaming only on /edit (fal supports it there); queue for T2I
  let result;
  if (isEdit && snap.stream !== false) {
    try {
      result = await _falStreamEdit(falKey, endpointPath, payload, onStatus, null, onPartial);
    } catch (e) {
      // Stream failure: fall back to queue. Keeps job alive on transient SSE issues.
      if (e.name === 'AbortError') throw e;
      console.warn('[GIS gpt-edit] stream fallback to queue:', e.message);
      onStatus?.('⟳ Falling back to queue…');
      result = await _falQueue(falKey, endpointPath, payload, onStatus, null);
    }
  } else {
    result = await _falQueue(falKey, endpointPath, payload, onStatus, null);
  }

  // Fetch first image bytes
  if (!result.images || !result.images.length) {
    throw new Error('fal.ai: GPT response has no images');
  }
  const imageUrl = result.images[0].url;
  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`GPT image fetch failed (${resp.status})`);
  const blob = await resp.blob();
  const b64 = await new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.readAsDataURL(blob);
  });

  // Return shape compatible with output-render.js / saveToGallery
  // Matches fal-model pattern: { type, images:[b64], mimeType, model, modelKey, ... }
  const imgW = result.images[0].width || null;
  const imgH = result.images[0].height || null;
  return {
    type:      'gpt',
    images:    [b64],
    mimeType:  'image/png',
    model:     model.name,
    modelKey:  getModelKey(model),
    size:      (imgW && imgH) ? `${imgW}×${imgH}` : '—',
    ratio:     (imgW && imgH) ? `${imgW}:${imgH}` : '—',
    quality:   snap.quality || 'medium',
    usage:     result.usage || null,
    priceKey:  _pickGptPriceKey(model, payload.image_size, snap.quality, snap.resolution),
  };
}
