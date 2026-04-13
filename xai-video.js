// ─────────────────────────────────────────────
// xAI Grok Imagine Video provider
// Model: grok-imagine-video
//
// 5 modes (one model, different endpoints/fields):
//   T2V:      POST /v1/videos/generations         (prompt only)
//   I2V:      POST /v1/videos/generations         (prompt + image)
//   Ref2V:    POST /v1/videos/generations         (prompt + reference_images, max 7)
//   V2V Edit: POST /v1/videos/edits               (prompt + video_url)
//   Extend:   POST /v1/videos/extensions           (prompt + video.url + duration)
//
// All async: submit → request_id → poll GET /v1/videos/{id} → done/pending/failed/expired
// Video URLs are temporary — must download promptly.
// ─────────────────────────────────────────────

import { errorResponse, jsonResponse } from '../utils/cors.js';

const XAI_BASE = 'https://api.x.ai/v1';

// ── Submit: T2V / I2V / Ref2V ──────────────────────────────
// POST /xai/video/submit
// Payload from GIS:
// {
//   xai_key:          string,
//   mode:             "t2v" | "i2v" | "ref2v",
//   prompt:           string,
//   duration?:        1–15 (default 8),
//   aspect_ratio?:    "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3",
//   resolution?:      "480p" | "720p" (default "480p"),
//   image_url?:       string (data URI or HTTPS — for I2V),
//   reference_images?: string[] (data URIs or HTTPS — for Ref2V, max 7),
// }
// Response: { request_id: string }
export async function handleXaiVideoSubmit(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { xai_key, mode, prompt, duration, aspect_ratio, resolution, image_url, reference_images } = body;

  if (!xai_key) return errorResponse('Missing xai_key', 400);
  if (!prompt)  return errorResponse('Missing prompt', 400);

  const payload = {
    model:  'grok-imagine-video',
    prompt,
  };

  // Duration — T2V/I2V: 1–15, Ref2V: max 10
  const maxDur = mode === 'ref2v' ? 10 : 15;
  const dur = Math.max(1, Math.min(maxDur, parseInt(duration) || 8));
  payload.duration = dur;

  // Aspect ratio + resolution — only for T2V/I2V/Ref2V (not Edit/Extend)
  if (aspect_ratio) payload.aspect_ratio = aspect_ratio;
  if (resolution)   payload.resolution = resolution;

  // Mode-specific fields
  if (mode === 'i2v' && image_url) {
    payload.image = { url: image_url };
  } else if (mode === 'ref2v' && Array.isArray(reference_images) && reference_images.length > 0) {
    payload.reference_images = reference_images.slice(0, 7).map(url => ({ url }));
  }

  let resp;
  try {
    resp = await fetch(`${XAI_BASE}/videos/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xai_key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return errorResponse(`xAI network error: ${e.message}`, 502);
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    return errorResponse(`xAI video submit ${resp.status}: ${t}`, resp.status);
  }

  let data;
  try { data = await resp.json(); } catch { return errorResponse('xAI returned invalid JSON', 502); }

  if (!data.request_id) return errorResponse('xAI: no request_id returned', 502, JSON.stringify(data));

  return jsonResponse({ request_id: data.request_id });
}

// ── Submit: V2V Edit ─────────────────────────────────────────
// POST /xai/video/edit
// { xai_key, prompt, video_url }
// Note: duration/aspect_ratio/resolution NOT supported — output matches input (capped 720p)
export async function handleXaiVideoEdit(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { xai_key, prompt, video_url } = body;

  if (!xai_key)   return errorResponse('Missing xai_key', 400);
  if (!prompt)     return errorResponse('Missing prompt', 400);
  if (!video_url)  return errorResponse('Missing video_url', 400);

  const payload = {
    model:     'grok-imagine-video',
    prompt,
    video:     { url: video_url },
  };

  let resp;
  try {
    resp = await fetch(`${XAI_BASE}/videos/edits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xai_key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return errorResponse(`xAI network error: ${e.message}`, 502);
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    return errorResponse(`xAI video edit ${resp.status}: ${t}`, resp.status);
  }

  let data;
  try { data = await resp.json(); } catch { return errorResponse('xAI returned invalid JSON', 502); }

  if (!data.request_id) return errorResponse('xAI: no request_id returned', 502, JSON.stringify(data));

  return jsonResponse({ request_id: data.request_id });
}

// ── Submit: Extend ───────────────────────────────────────────
// POST /xai/video/extend
// { xai_key, prompt, video_url, duration (2–10, extension length only) }
// Note: aspect_ratio/resolution NOT supported — matches input (capped 720p)
export async function handleXaiVideoExtend(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { xai_key, prompt, video_url, duration } = body;

  if (!xai_key)   return errorResponse('Missing xai_key', 400);
  if (!prompt)     return errorResponse('Missing prompt', 400);
  if (!video_url)  return errorResponse('Missing video_url', 400);

  const dur = Math.max(2, Math.min(10, parseInt(duration) || 6));

  const payload = {
    model:  'grok-imagine-video',
    prompt,
    duration: dur,
    video:  { url: video_url },
  };

  let resp;
  try {
    resp = await fetch(`${XAI_BASE}/videos/extensions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${xai_key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return errorResponse(`xAI network error: ${e.message}`, 502);
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    return errorResponse(`xAI video extend ${resp.status}: ${t}`, resp.status);
  }

  let data;
  try { data = await resp.json(); } catch { return errorResponse('xAI returned invalid JSON', 502); }

  if (!data.request_id) return errorResponse('xAI: no request_id returned', 502, JSON.stringify(data));

  return jsonResponse({ request_id: data.request_id });
}

// ── Poll status ──────────────────────────────────────────────
// POST /xai/video/status
// { xai_key, request_id }
// Response: { status: "pending"|"done"|"failed"|"expired", video_url?, duration? }
export async function handleXaiVideoStatus(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { xai_key, request_id } = body;

  if (!xai_key)    return errorResponse('Missing xai_key', 400);
  if (!request_id) return errorResponse('Missing request_id', 400);

  let resp;
  try {
    resp = await fetch(`${XAI_BASE}/videos/${request_id}`, {
      headers: { 'Authorization': `Bearer ${xai_key}` },
    });
  } catch (e) {
    return errorResponse(`xAI status network error: ${e.message}`, 502);
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    return errorResponse(`xAI video status ${resp.status}: ${t}`, resp.status);
  }

  let data;
  try { data = await resp.json(); } catch { return errorResponse('xAI returned invalid JSON', 502); }

  if (data.status === 'done') {
    return jsonResponse({
      status:    'done',
      video_url: data.video?.url || null,
      duration:  data.video?.duration || null,
    });
  }

  if (data.status === 'failed') {
    return jsonResponse({ status: 'failed', error: data.error?.message || 'Generation failed' });
  }

  if (data.status === 'expired') {
    return jsonResponse({ status: 'expired', error: 'Request expired' });
  }

  return jsonResponse({ status: 'pending' });
}

// ── Download proxy ───────────────────────────────────────────
// POST /xai/video/download
// { video_url }
// Fetches temporary xAI video URL and streams binary back to GIS (CORS bypass)
export async function handleXaiVideoDownload(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { video_url } = body;
  if (!video_url) return errorResponse('Missing video_url', 400);

  // Validate URL — only allow xAI video domains
  try {
    const u = new URL(video_url);
    if (!u.hostname.endsWith('.x.ai') && !u.hostname.endsWith('xai.com')) {
      return errorResponse('Invalid video URL domain', 400);
    }
  } catch {
    return errorResponse('Invalid video URL', 400);
  }

  let resp;
  try {
    resp = await fetch(video_url);
  } catch (e) {
    return errorResponse(`Video download network error: ${e.message}`, 502);
  }

  if (!resp.ok) {
    return errorResponse(`Video download failed: ${resp.status}`, resp.status);
  }

  // Stream binary directly to client
  return new Response(resp.body, {
    status: 200,
    headers: {
      'Content-Type': resp.headers.get('Content-Type') || 'video/mp4',
      'Content-Length': resp.headers.get('Content-Length') || '',
    },
  });
}
