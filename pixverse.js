// handlers/pixverse.js
// GIS Proxy — PixVerse C1 Video
// Routes: POST /pixverse/t2v           → submit T2V generation
//         POST /pixverse/i2v           → submit I2V generation
//         POST /pixverse/upload-image  → upload image → img_id
//         POST /pixverse/status        → poll video status
//
// Design: passthrough — GIS sends complete payload including apiKey,
// Worker strips apiKey and forwards everything else to PixVerse API.
// This avoids updating Worker for every new PixVerse parameter.

const PIXVERSE_BASE = 'https://app-api.pixverse.ai';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function uuid() { return crypto.randomUUID(); }

async function safeJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ErrCode: resp.status, ErrMsg: `Non-JSON response (${resp.status}): ${text.slice(0, 200)}` };
  }
}

// Strip apiKey from body, return { apiKey, payload }
function splitBody(body) {
  const { apiKey, ...payload } = body;
  return { apiKey, payload };
}

// POST /pixverse/t2v — passthrough to /openapi/v2/video/text/generate
export async function handlePixverseT2V(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, payload } = splitBody(body);
  if (!apiKey)         return jsonResp({ error: 'apiKey required' }, 400);
  if (!payload.prompt) return jsonResp({ error: 'prompt required' }, 400);
  if (!payload.model)  payload.model = 'c1';

  const resp = await fetch(`${PIXVERSE_BASE}/openapi/v2/video/text/generate`, {
    method: 'POST',
    headers: { 'API-KEY': apiKey, 'Ai-trace-id': uuid(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return jsonResp(await safeJson(resp), resp.ok ? 200 : resp.status);
}

// POST /pixverse/i2v — passthrough to /openapi/v2/video/img/generate
export async function handlePixverseI2V(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, payload } = splitBody(body);
  if (!apiKey)         return jsonResp({ error: 'apiKey required' }, 400);
  if (!payload.prompt) return jsonResp({ error: 'prompt required' }, 400);
  if (!payload.img_id) return jsonResp({ error: 'img_id required' }, 400);
  if (!payload.model)  payload.model = 'c1';

  const resp = await fetch(`${PIXVERSE_BASE}/openapi/v2/video/img/generate`, {
    method: 'POST',
    headers: { 'API-KEY': apiKey, 'Ai-trace-id': uuid(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return jsonResp(await safeJson(resp), resp.ok ? 200 : resp.status);
}

// POST /pixverse/transition — passthrough to /openapi/v2/video/transition/generate
export async function handlePixverseTransition(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, payload } = splitBody(body);
  if (!apiKey)                  return jsonResp({ error: 'apiKey required' }, 400);
  if (!payload.prompt)          return jsonResp({ error: 'prompt required' }, 400);
  if (!payload.first_frame_img) return jsonResp({ error: 'first_frame_img required' }, 400);
  if (!payload.last_frame_img)  return jsonResp({ error: 'last_frame_img required' }, 400);
  if (!payload.model) payload.model = 'c1';

  const resp = await fetch(`${PIXVERSE_BASE}/openapi/v2/video/transition/generate`, {
    method: 'POST',
    headers: { 'API-KEY': apiKey, 'Ai-trace-id': uuid(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return jsonResp(await safeJson(resp), resp.ok ? 200 : resp.status);
}

// POST /pixverse/fusion — passthrough to /openapi/v2/video/fusion/generate
export async function handlePixverseFusion(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, payload } = splitBody(body);
  if (!apiKey)                    return jsonResp({ error: 'apiKey required' }, 400);
  if (!payload.prompt)            return jsonResp({ error: 'prompt required' }, 400);
  if (!payload.image_references)  return jsonResp({ error: 'image_references required' }, 400);
  if (!payload.model) payload.model = 'c1';

  const resp = await fetch(`${PIXVERSE_BASE}/openapi/v2/video/fusion/generate`, {
    method: 'POST',
    headers: { 'API-KEY': apiKey, 'Ai-trace-id': uuid(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return jsonResp(await safeJson(resp), resp.ok ? 200 : resp.status);
}

// POST /pixverse/upload-image
export async function handlePixverseUploadImage(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, image_base64, mime_type } = body;
  if (!apiKey)       return jsonResp({ error: 'apiKey required' }, 400);
  if (!image_base64) return jsonResp({ error: 'image_base64 required' }, 400);

  const mimeType = mime_type || 'image/png';
  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
  const raw = image_base64.includes(',') ? image_base64.split(',')[1] : image_base64;

  const binaryStr = atob(raw);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

  const formData = new FormData();
  formData.append('image', new Blob([bytes], { type: mimeType }), `upload.${ext}`);

  const resp = await fetch(`${PIXVERSE_BASE}/openapi/v2/image/upload`, {
    method: 'POST',
    headers: { 'API-KEY': apiKey, 'Ai-trace-id': uuid() },
    body: formData,
  });
  return jsonResp(await safeJson(resp), resp.ok ? 200 : resp.status);
}

// POST /pixverse/status
export async function handlePixverseStatus(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, video_id } = body;
  if (!apiKey)   return jsonResp({ error: 'apiKey required' }, 400);
  if (!video_id) return jsonResp({ error: 'video_id required' }, 400);

  const resp = await fetch(`${PIXVERSE_BASE}/openapi/v2/video/result/${video_id}`, {
    headers: { 'API-KEY': apiKey },
  });
  return jsonResp(await safeJson(resp), resp.ok ? 200 : resp.status);
}
