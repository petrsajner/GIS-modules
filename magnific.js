// ─────────────────────────────────────────────
// Magnific (Freepik API) upscale provider
// Flow: GIS → Worker POST /magnific/upscale → { task_id }  (returns immediately)
//       GIS → Worker POST /magnific/status  → { status, url? } (GIS downloads image directly)
//
// Worker never downloads the result image — it just returns the CDN URL.
// GIS fetches the image directly from Freepik CDN to avoid Worker memory/timeout issues.
// ─────────────────────────────────────────────

import { errorResponse, jsonResponse } from '../utils/cors.js';

const FREEPIK_BASE = 'https://api.freepik.com/v1/ai';

// POST /magnific/upscale — submits job, returns { task_id } immediately
export async function handleMagnific(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    freepik_key,
    image_b64,
    scale_factor  = '2x',
    engine        = 'magnific_sparkle',
    optimized_for = 'standard',
    prompt,
    creativity    = 2,
    hdr           = 0,
    resemblance   = 0,
    fractality    = -1,
  } = body;

  if (!freepik_key) return errorResponse('Missing freepik_key', 400);
  if (!image_b64)   return errorResponse('Missing image_b64', 400);

  const freepikPayload = { image: image_b64, scale_factor, engine, optimized_for, creativity, hdr, resemblance, fractality };
  if (prompt) freepikPayload.prompt = prompt;

  let taskId;
  try {
    const submitResp = await fetch(`${FREEPIK_BASE}/image-upscaler`, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body: JSON.stringify(freepikPayload),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Freepik API ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id;
    if (!taskId) return errorResponse('Freepik: no task_id in response', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`Freepik submit error: ${e.message}`, 502);
  }

  return jsonResponse({ task_id: taskId });
}

// POST /magnific/status — single status check, returns URL (not image data)
// Body: { freepik_key, task_id }
// Response:
//   { status: 'pending' }
//   { status: 'done', url: string }   ← GIS downloads image directly from this URL
//   { status: 'failed', error: string }
export async function handleMagnificStatus(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { freepik_key, task_id, upscaler_type } = body;
  if (!freepik_key) return errorResponse('Missing freepik_key', 400);
  if (!task_id)     return errorResponse('Missing task_id', 400);

  // Route to correct status endpoint based on upscaler type
  let statusPath;
  if (upscaler_type === 'precision-v1') {
    statusPath = `${FREEPIK_BASE}/image-upscaler-precision/${task_id}`;
  } else if (upscaler_type === 'precision-v2') {
    statusPath = `${FREEPIK_BASE}/image-upscaler-precision-v2/${task_id}`;
  } else {
    statusPath = `${FREEPIK_BASE}/image-upscaler/${task_id}`; // creative (default)
  }

  let data;
  try {
    const resp = await fetch(statusPath, {
      headers: { 'x-freepik-api-key': freepik_key },
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return errorResponse(`Freepik poll ${resp.status}: ${t}`, resp.status);
    }
    data = await resp.json();
  } catch (e) {
    return errorResponse(`Freepik status network error: ${e.message}`, 502);
  }

  const status = data?.data?.status;

  // API statuses: CREATED → IN_PROGRESS → COMPLETED / FAILED / ERROR
  if (status === 'FAILED' || status === 'ERROR') {
    return jsonResponse({ status: 'failed', error: JSON.stringify(data?.data) });
  }

  if (status === 'COMPLETED') {
    // generated[] is an array of URL strings (not objects)
    const url = data?.data?.generated?.[0];
    if (!url) return errorResponse('Magnific: COMPLETED but no result URL', 502);
    // Return URL only — GIS fetches the image directly, Worker doesn't touch the large file
    return jsonResponse({ status: 'done', url });
  }

  return jsonResponse({ status: 'pending', task_status: status });
}

// POST /magnific/precision — submits Precision V1 or V2 job, returns { task_id }
// Body: { freepik_key, image_b64, prec_version ('v1'|'v2'), scale_factor, flavor, sharpen, smart_grain, ultra_detail }
export async function handleMagnificPrecision(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    freepik_key,
    image_b64,
    prec_version  = 'v2',
    scale_factor  = 2,
    flavor        = 'sublime',
    sharpen       = 7,
    smart_grain   = 7,
    ultra_detail  = 30,
  } = body;

  if (!freepik_key) return errorResponse('Missing freepik_key', 400);
  if (!image_b64)   return errorResponse('Missing image_b64', 400);

  const isV1 = prec_version === 'v1';
  const endpoint = isV1
    ? `${FREEPIK_BASE}/image-upscaler-precision`
    : `${FREEPIK_BASE}/image-upscaler-precision-v2`;

  const freepikPayload = { image: image_b64, sharpen, smart_grain, ultra_detail };
  if (!isV1) {
    freepikPayload.scale_factor = scale_factor;
    freepikPayload.flavor = flavor;
  }

  let taskId;
  try {
    const submitResp = await fetch(endpoint, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body: JSON.stringify(freepikPayload),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Freepik Precision API ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id;
    if (!taskId) return errorResponse('Freepik Precision: no task_id in response', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`Freepik Precision submit error: ${e.message}`, 502);
  }

  return jsonResponse({ task_id: taskId });
}
