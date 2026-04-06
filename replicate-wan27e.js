// handlers/replicate-wan27e.js
// GIS Proxy — Replicate WAN 2.7 Video Edit + File serving
// Routes:
//   POST /replicate/wan27e/submit   → submit prediction
//   POST /replicate/wan27e/status   → poll prediction status
//   POST /replicate/files/upload    → upload video to Replicate Files API
//   GET  /replicate/video/{id}/source.mp4?k={key} → serve file with .mp4 URL (DashScope compat)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// POST /replicate/wan27e/submit
export async function handleReplicateWan27eSubmit(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { replicateKey, input } = body;
  if (!replicateKey)  return jsonResp({ error: 'replicateKey required' }, 400);
  if (!input?.video)  return jsonResp({ error: 'input.video required' }, 400);

  const resp = await fetch('https://api.replicate.com/v1/models/wan-video/wan-2.7-videoedit/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${replicateKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ input }),
  });

  const data = await resp.json();
  return jsonResp(data, resp.status);
}

// POST /replicate/wan27e/status
export async function handleReplicateWan27eStatus(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { replicateKey, predictionId } = body;
  if (!replicateKey)  return jsonResp({ error: 'replicateKey required' }, 400);
  if (!predictionId)  return jsonResp({ error: 'predictionId required' }, 400);

  const resp = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { 'Authorization': `Bearer ${replicateKey}` },
  });

  const data = await resp.json();
  return jsonResp(data, resp.status);
}

// POST /replicate/files/upload
// Body: { replicateKey, data: base64, mimeType }
// Returns: { id, urls: { get } }
export async function handleReplicateFilesUpload(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { replicateKey, data, mimeType } = body;
  if (!replicateKey) return jsonResp({ error: 'replicateKey required' }, 400);
  if (!data)         return jsonResp({ error: 'data required' }, 400);

  const binary = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const blob = new Blob([binary], { type: mimeType || 'video/mp4' });

  const formData = new FormData();
  formData.append('content', blob, 'source.mp4');

  const resp = await fetch('https://api.replicate.com/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${replicateKey}` },
    body: formData,
  });

  const fileData = await resp.json();
  return jsonResp(fileData, resp.status);
}

// GET /replicate/video/{id}/source.mp4?k={key}  → serve video content
// GET /replicate/image/{id}/ref.jpg?k={key}      → serve image content
// DashScope detects format from URL extension → URL MUST end in .mp4 or .jpg
export async function handleReplicateVideoServe(request, fileId) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(request.url);
  const replicateKey = url.searchParams.get('k');
  if (!replicateKey) return jsonResp({ error: 'k param required' }, 400);
  if (!fileId)       return jsonResp({ error: 'fileId required' }, 400);

  // Step 1: Get file metadata to find urls.get
  const metaResp = await fetch(`https://api.replicate.com/v1/files/${fileId}`, {
    headers: { 'Authorization': `Bearer ${replicateKey}` },
  });
  if (!metaResp.ok) {
    return jsonResp({ error: `File metadata error ${metaResp.status}` }, metaResp.status);
  }
  const meta = await metaResp.json();
  const downloadUrl = meta?.urls?.get;
  const contentType = meta?.content_type || 'video/mp4';
  if (!downloadUrl) {
    return jsonResp({ error: `No download URL in metadata: ${JSON.stringify(meta).slice(0,200)}` }, 500);
  }

  // Step 2: Fetch file content — use redirect: 'manual' to detect S3 redirect.
  // If Replicate redirects to S3 presigned URL, fetch WITHOUT auth header
  // (sending Bearer to S3 presigned URL causes 403 signature mismatch).
  const step2 = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${replicateKey}` },
    redirect: 'manual',
  });

  let fileResp;
  if (step2.status >= 300 && step2.status < 400) {
    // Redirected — likely to S3 presigned URL, fetch without auth
    const redirectUrl = step2.headers.get('Location');
    if (!redirectUrl) return jsonResp({ error: 'Redirect with no Location header' }, 502);
    fileResp = await fetch(redirectUrl);
  } else {
    // No redirect — response IS the file content
    fileResp = step2;
  }

  if (!fileResp.ok) {
    return jsonResp({ error: `File download error ${fileResp.status}` }, fileResp.status);
  }

  const isImage = contentType.startsWith('image/');
  return new Response(fileResp.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${isImage ? 'ref.jpg' : 'source.mp4'}"`,
      ...CORS,
    },
  });
}

// POST /replicate/upload/video
// Body: raw binary video/image
// Headers: X-Replicate-Key, Content-Type, X-Content-Length, X-Filename
// Uses POST /v1/uploads (JSON body) → upload_url + serving_url (replicate.delivery CDN)
export async function handleReplicateUploadVideo(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const replicateKey  = request.headers.get('X-Replicate-Key');
  const contentType   = request.headers.get('Content-Type') || 'video/mp4';
  const contentLength = parseInt(request.headers.get('X-Content-Length') || '0', 10);
  const filename      = request.headers.get('X-Filename') || 'source.mp4';

  if (!replicateKey) return jsonResp({ error: 'X-Replicate-Key required' }, 400);

  // Step 1: Create upload URL — POST /v1/uploads with JSON body
  const initResp = await fetch('https://api.replicate.com/v1/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${replicateKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content_type: contentType, path: filename }),
  });
  if (!initResp.ok) {
    const err = await initResp.text().catch(() => String(initResp.status));
    return jsonResp({ error: `Upload init failed (${initResp.status}): ${String(err).slice(0,300)}` }, initResp.status);
  }
  const { upload_url, serving_url } = await initResp.json();
  if (!upload_url || !serving_url) {
    return jsonResp({ error: 'No upload_url/serving_url in response' }, 500);
  }

  // Step 2: PUT binary to presigned URL (no auth — presigned URL has embedded auth)
  const putResp = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: request.body,
  });
  if (!putResp.ok) return jsonResp({ error: `S3 upload failed (${putResp.status})` }, putResp.status);

  // serving_url = https://replicate.delivery/.../source.mp4 — public CDN with .mp4 extension
  return jsonResp({ url: serving_url });
}
