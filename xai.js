// ─────────────────────────────────────────────
// xAI Grok Imagine provider
// Models: grok-imagine-image, grok-imagine-image-pro
// T2I:    POST /v1/images/generations   (no refs)
// Edit:   POST /v1/images/edits         (1–5 refs)
// resolution: "1k" (default) | "2k"
// response_format: "b64_json" → base64 direct (no URL fetch)
// ─────────────────────────────────────────────

import { errorResponse, jsonResponse } from '../utils/cors.js';

// ── Payload GIS → Worker ──────────────────────────────────────
// {
//   xai_key:       string,
//   prompt:        string,
//   model?:        "grok-imagine-image" | "grok-imagine-image-pro",
//   aspect_ratio?: "16:9" | "1:1" | "auto" | ... (default "16:9")
//   n?:            1–10 (default 1)
//   resolution?:   "1k" | "2k" (default "1k")
//   image_urls?:   ["data:image/jpeg;base64,...", ...] — 1–5 images for Edit
// }
//
// ── Response Worker → GIS ─────────────────────────────────────
// { images: [{ b64_data: string, mime_type: "image/jpeg" }] }

export async function handleXai(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { xai_key, prompt, model, aspect_ratio, n, resolution, image_urls } = body;

  if (!xai_key) return errorResponse('Missing xai_key', 400);
  if (!prompt)  return errorResponse('Missing prompt', 400);

  const count   = Math.min(Math.max(parseInt(n) || 1, 1), 10);
  const aspectR = aspect_ratio || '16:9';
  const res     = resolution === '2k' ? '2k' : '1k';
  const mdl     = model || 'grok-imagine-image';

  // ── Decide endpoint: T2I vs Edit ────────────────────────
  const isEdit  = Array.isArray(image_urls) && image_urls.length > 0;
  const apiUrl  = isEdit
    ? 'https://api.x.ai/v1/images/edits'
    : 'https://api.x.ai/v1/images/generations';

  // ── Build payload ───────────────────────────────────────
  const payload = {
    model:           mdl,
    prompt,
    n:               count,
    response_format: 'b64_json',
    resolution:      res,
  };

  if (isEdit) {
    // Edit endpoint: images array [{type, url}, ...]
    payload.images = image_urls.map(url => ({ type: 'image_url', url }));
    // Aspect ratio for multi-image edits (single-image respects input)
    if (image_urls.length > 1) {
      payload.aspect_ratio = aspectR;
    }
  } else {
    // T2I: always send aspect_ratio
    payload.aspect_ratio = aspectR;
  }

  let xaiResp;
  try {
    xaiResp = await fetch(apiUrl, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${xai_key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return errorResponse(`xAI network error: ${e.message}`, 502);
  }

  if (!xaiResp.ok) {
    const errText = await xaiResp.text().catch(() => '');
    return errorResponse(`API ${xaiResp.status}: ${errText}`, xaiResp.status);
  }

  let xaiData;
  try {
    xaiData = await xaiResp.json();
  } catch {
    return errorResponse('xAI API returned invalid JSON', 502);
  }

  const items = xaiData.data;
  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse('xAI returned no images', 502, JSON.stringify(xaiData));
  }

  // ── Extract b64_json results ────────────────────────────
  const images = items.map(img => {
    if (img.b64_json) {
      return { b64_data: img.b64_json, mime_type: 'image/jpeg' };
    }
    // Fallback: should not happen with response_format=b64_json
    return null;
  }).filter(Boolean);

  if (images.length === 0) {
    return errorResponse('xAI returned no base64 data', 502);
  }

  return jsonResponse({ images });
}
