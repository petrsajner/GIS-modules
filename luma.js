// ─────────────────────────────────────────────
// Luma AI provider — images (Photon) + videos (Ray3 / Ray3.14)
//
// Image flow:  GIS → POST /luma/generate       → { generation_id }
//              GIS → POST /luma/status          → { status, b64_data? }
//
// Video flow:  GIS → POST /luma/video/submit    → { generation_id }
//              GIS → POST /luma/video/status    → { status, video_url?, exr_url? }
//
// Key rules:
//  - Worker NEVER downloads video (too large; 10–200 MB)
//  - Worker uploads keyframe images to Luma CDN (required — API rejects base64)
//  - Polling loop runs in GIS browser, not here
// ─────────────────────────────────────────────

import { errorResponse, jsonResponse } from '../utils/cors.js';

const LUMA_BASE = 'https://api.lumalabs.ai/dream-machine/v1';

// ── Shared helper: upload base64 image to Luma CDN, return CDN URL ──
async function uploadBase64ToLuma(b64, mimeType, lumaKey) {
  const initResp = await fetch(`${LUMA_BASE}/file_uploads`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${lumaKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_type: 'image', content_type: mimeType }),
  });
  if (!initResp.ok) {
    const t = await initResp.text().catch(() => '');
    throw new Error(`Luma file_uploads ${initResp.status}: ${t}`);
  }
  const { url: cdnUrl, upload_url: uploadUrl } = await initResp.json();
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const putResp = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: bytes });
  if (!putResp.ok) throw new Error(`Luma PUT upload ${putResp.status}`);
  return cdnUrl;
}

// ── Shared helper: fetch URL → base64 (images only, not video!) ──
async function urlToBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Image fetch ${resp.status}`);
  const buf   = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary  = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ════════════════════════════════════════════════════════════
// IMAGE: POST /luma/generate
// ════════════════════════════════════════════════════════════
export async function handleLuma(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { luma_key, prompt, model, aspect_ratio, image_refs, style_refs, character_ref, modify_ref } = body;
  if (!luma_key) return errorResponse('Missing luma_key', 400);
  if (!prompt)   return errorResponse('Missing prompt', 400);

  const modelId = model || 'photon-flash-1';
  const aspectR = aspect_ratio || '1:1';

  let lumaImageRefs, lumaStyleRefs, lumaCharacterRef, lumaModifyRef;
  try {
    if (Array.isArray(image_refs) && image_refs.length > 0) {
      const urls = await Promise.all(image_refs.map(r => uploadBase64ToLuma(r.b64_data, r.mime_type || 'image/jpeg', luma_key)));
      lumaImageRefs = urls.map((url, i) => ({ url, weight: image_refs[i].weight ?? 0.85 }));
    }
    if (Array.isArray(style_refs) && style_refs.length > 0) {
      const urls = await Promise.all(style_refs.map(r => uploadBase64ToLuma(r.b64_data, r.mime_type || 'image/jpeg', luma_key)));
      lumaStyleRefs = urls.map((url, i) => ({ url, weight: style_refs[i].weight ?? 0.8 }));
    }
    if (Array.isArray(character_ref) && character_ref.length > 0) {
      const urls = await Promise.all(character_ref.slice(0, 4).map(r => uploadBase64ToLuma(r.b64_data, r.mime_type || 'image/jpeg', luma_key)));
      lumaCharacterRef = { identity0: { images: urls } };
    } else if (character_ref?.b64_data) {
      const url = await uploadBase64ToLuma(character_ref.b64_data, character_ref.mime_type || 'image/jpeg', luma_key);
      lumaCharacterRef = { identity0: { images: [url] } };
    }
    if (modify_ref?.b64_data) {
      const url = await uploadBase64ToLuma(modify_ref.b64_data, modify_ref.mime_type || 'image/jpeg', luma_key);
      lumaModifyRef = { url, weight: modify_ref.weight ?? 1.0 };
    }
  } catch (e) {
    return errorResponse(`Ref upload failed: ${e.message}`, 502);
  }

  const lumaPayload = { model: modelId, prompt, aspect_ratio: aspectR };
  if (lumaImageRefs)    lumaPayload.image_ref       = lumaImageRefs;
  if (lumaStyleRefs)    lumaPayload.style_ref        = lumaStyleRefs;
  if (lumaCharacterRef) lumaPayload.character_ref    = lumaCharacterRef;
  if (lumaModifyRef)    lumaPayload.modify_image_ref = lumaModifyRef;

  let generationId;
  try {
    const genResp = await fetch(`${LUMA_BASE}/generations/image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${luma_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(lumaPayload),
    });
    if (!genResp.ok) {
      const t = await genResp.text().catch(() => '');
      return errorResponse(`Luma API ${genResp.status}`, genResp.status, t);
    }
    const genData = await genResp.json();
    generationId  = genData.id;
    if (!generationId) return errorResponse('Luma: no generation_id in response', 502, JSON.stringify(genData));
  } catch (e) {
    return errorResponse(`Luma network error: ${e.message}`, 502);
  }

  return jsonResponse({ generation_id: generationId });
}

// ════════════════════════════════════════════════════════════
// IMAGE: POST /luma/status
// ════════════════════════════════════════════════════════════
export async function handleLumaStatus(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { luma_key, generation_id } = body;
  if (!luma_key)      return errorResponse('Missing luma_key', 400);
  if (!generation_id) return errorResponse('Missing generation_id', 400);

  let gen;
  try {
    const resp = await fetch(`${LUMA_BASE}/generations/${generation_id}`, {
      headers: { 'Authorization': `Bearer ${luma_key}` },
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return errorResponse(`Luma status ${resp.status}: ${t}`, resp.status);
    }
    gen = await resp.json();
  } catch (e) {
    return errorResponse(`Luma status network error: ${e.message}`, 502);
  }

  if (gen.state === 'failed') {
    return jsonResponse({ status: 'failed', error: gen.failure_reason || 'unknown' });
  }

  if (gen.state === 'completed') {
    const imageUrl = gen.assets?.image;
    if (!imageUrl) return errorResponse('Luma: completed but no assets.image', 502);
    let b64Data, mimeType = 'image/jpeg';
    try {
      b64Data = await urlToBase64(imageUrl);
      if (imageUrl.includes('.png')) mimeType = 'image/png';
    } catch (e) {
      return errorResponse(`Result download failed: ${e.message}`, 502);
    }
    return jsonResponse({ status: 'done', b64_data: b64Data, mime_type: mimeType });
  }

  return jsonResponse({ status: 'pending', state: gen.state });
}

// ════════════════════════════════════════════════════════════
// VIDEO: POST /luma/video/submit
//
// Body:
//  luma_key       — Luma API key
//  model          — "ray-3-14" | "ray-3"
//  prompt         — text prompt
//  aspect_ratio   — "16:9" | "9:16" | "1:1" | "3:4" | "4:3" | "21:9"
//  resolution     — "draft" | "540p" | "720p" | "1080p"
//  duration       — "5s" | "10s"
//  loop           — boolean
//  color_mode     — "sdr" | "hdr" | "hdr_exr" (Ray3 only, optional)
//  frame0_b64     — base64 start frame image (optional)
//  frame0_mime    — MIME type of start frame
//  frame1_b64     — base64 end frame image (optional)
//  frame1_mime    — MIME type of end frame
//  char_ref_b64   — base64 character reference image (Ray3 only, optional)
//  char_ref_mime  — MIME type of character ref
//
// Returns: { generation_id }
// ════════════════════════════════════════════════════════════
export async function handleLumaVideoSubmit(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    luma_key, model, prompt, aspect_ratio, resolution, duration,
    loop, color_mode,
    frame0_b64, frame0_mime, frame1_b64, frame1_mime,
    char_ref_b64, char_ref_mime,
  } = body;

  if (!luma_key) return errorResponse('Missing luma_key', 400);
  if (!prompt)   return errorResponse('Missing prompt', 400);

  // Build keyframes — upload images to Luma CDN first (API rejects base64 directly)
  const keyframes = {};
  try {
    if (frame0_b64) {
      const url = await uploadBase64ToLuma(frame0_b64, frame0_mime || 'image/jpeg', luma_key);
      keyframes.frame0 = { type: 'image', url };
    }
    if (frame1_b64) {
      const url = await uploadBase64ToLuma(frame1_b64, frame1_mime || 'image/jpeg', luma_key);
      keyframes.frame1 = { type: 'image', url };
    }
  } catch (e) {
    return errorResponse(`Keyframe upload failed: ${e.message}`, 502);
  }

  // Build character_ref (Ray3 only)
  let charRefPayload;
  if (char_ref_b64) {
    try {
      const url = await uploadBase64ToLuma(char_ref_b64, char_ref_mime || 'image/jpeg', luma_key);
      charRefPayload = { identity0: { images: [url] } };
    } catch (e) {
      return errorResponse(`Character ref upload failed: ${e.message}`, 502);
    }
  }

  // Build generation payload
  const payload = {
    model:        model || 'ray-3-14',
    prompt,
    aspect_ratio: aspect_ratio || '16:9',
  };
  if (resolution && resolution !== 'default') {
    payload.resolution = resolution;  // Luma API: '540p', '720p', '1080p', '4k'
  }
  if (duration)    payload.duration      = duration;
  if (loop)        payload.loop          = !!loop;
  if (Object.keys(keyframes).length > 0) payload.keyframes = keyframes;
  if (charRefPayload) payload.character_ref = charRefPayload;
  // color_mode: "hdr" or "hdr_exr" for Ray3 HDR/EXR output
  // NOTE: exact parameter name may need verification — Luma docs don't yet document Ray3 HDR API
  if (color_mode && color_mode !== 'sdr') payload.color_mode = color_mode;

  let generationId;
  try {
    const genResp = await fetch(`${LUMA_BASE}/generations/video`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${luma_key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!genResp.ok) {
      const t = await genResp.text().catch(() => '');
      // Pass full Luma error text so GIS can show it
      return errorResponse(`Luma video API ${genResp.status}`, genResp.status, t);
    }
    const data   = await genResp.json();
    generationId = data.id;
    if (!generationId) return errorResponse('Luma video: no id in response', 502, JSON.stringify(data));
  } catch (e) {
    return errorResponse(`Luma video network error: ${e.message}`, 502);
  }

  return jsonResponse({ generation_id: generationId });
}

// ════════════════════════════════════════════════════════════
// VIDEO: POST /luma/video/status
//
// Body: { luma_key, generation_id }
// Returns:
//   { status: "pending", state: "dreaming" }
//   { status: "done",    video_url: "...", exr_url?: "..." }
//   { status: "failed",  error: "..." }
//
// Worker NEVER downloads video — returns CDN URLs only.
// GIS fetches video directly from CDN.
// ════════════════════════════════════════════════════════════
export async function handleLumaVideoStatus(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { luma_key, generation_id } = body;
  if (!luma_key)      return errorResponse('Missing luma_key', 400);
  if (!generation_id) return errorResponse('Missing generation_id', 400);

  let gen;
  try {
    const resp = await fetch(`${LUMA_BASE}/generations/${generation_id}`, {
      headers: { 'Authorization': `Bearer ${luma_key}` },
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return errorResponse(`Luma video status ${resp.status}: ${t}`, resp.status);
    }
    gen = await resp.json();
  } catch (e) {
    return errorResponse(`Luma video status network error: ${e.message}`, 502);
  }

  if (gen.state === 'failed') {
    return jsonResponse({ status: 'failed', error: gen.failure_reason || 'Generation failed' });
  }

  if (gen.state === 'completed') {
    const videoUrl = gen.assets?.video;
    if (!videoUrl) return errorResponse('Luma video: completed but no assets.video', 502);
    // EXR frames URL — may be assets.frames or assets.exr_frames (verify with actual API response)
    const exrUrl = gen.assets?.frames || gen.assets?.exr_frames || null;
    return jsonResponse({ status: 'done', video_url: videoUrl, exr_url: exrUrl });
  }

  return jsonResponse({ status: 'pending', state: gen.state || 'dreaming' });
}
