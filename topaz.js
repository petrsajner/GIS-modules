// ══════════════════════════════════════════════════════════
// Topaz Labs API Handler — GIS Proxy
// Uses /video/express endpoint (single-URL upload, no accept/complete-upload steps)
//
// Routes:
//   POST /topaz/video/submit  — express submit: send video b64, get request_id
//   POST /topaz/video/status  — poll status, returns download.url when done
// ══════════════════════════════════════════════════════════

const TOPAZ_API = 'https://api.topazlabs.com';

async function topazFetch(path, method, apiKey, body = null) {
  const opts = {
    method,
    headers: { 'X-API-Key': apiKey, 'accept': 'application/json' },
  };
  if (body) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res  = await fetch(`${TOPAZ_API}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`Topaz ${res.status} ${path}: ${JSON.stringify(data)}`);
  return data;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function err(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── POST /topaz/video/submit ─────────────────────────────
// Uses /video/express — single-URL upload, no accept/complete-upload needed.
// GIS sends: { topaz_key, model, slowmo?, fps?, creativity?,
//              out_width, out_height, src_duration,
//              video_b64 }
// Returns: { request_id }
export async function handleTopazVideoSubmit(request) {
  let body;
  try { body = await request.json(); }
  catch { return err('Invalid JSON body'); }

  const {
    topaz_key,
    model      = 'slp-2.5',
    slowmo     = 0,
    fps        = 24,
    creativity,
    out_width,
    out_height,
    src_width,    // source video width (for express source.resolution)
    src_height,   // source video height
    src_duration,
    src_size,     // source file size in bytes
    video_b64,
  } = body;

  if (!topaz_key)  return err('topaz_key required');
  if (!out_width)  return err('out_width required');
  if (!out_height) return err('out_height required');
  if (!video_b64)  return err('video_b64 required');

  // Build filters array
  const filters = [{ model }];
  if (creativity) filters[0].creativity = creativity;

  // Add slow motion via frame interpolation if requested
  if (slowmo && slowmo > 1) {
    filters.push({ model: 'apo-8', slowmo: parseInt(slowmo), fps: parseInt(fps) });
  }

  // All source fields must be positive integers — Starlight is strict about this
  const srcFps    = Math.max(1, parseInt(fps)    || 24);
  const srcDur    = Math.max(1, parseFloat(src_duration) || 5);
  const srcFrames = Math.max(1, Math.round(srcDur * srcFps));
  const srcW      = Math.max(1, parseInt(src_width  || out_width  || 1920));
  const srcH      = Math.max(1, parseInt(src_height || out_height || 1080));
  const outW      = Math.max(1, parseInt(out_width  || 1920));
  const outH      = Math.max(1, parseInt(out_height || 1080));

  const expressBody = {
    source: {
      container:   'mp4',
      size:        Math.max(1, parseInt(src_size) || Math.round(video_b64.length * 0.75)),
      duration:    srcDur,
      frameCount:  srcFrames,
      frameRate:   srcFps,
      resolution:  { width: srcW, height: srcH },
    },
    filters,
    output: {
      resolution:              { width: outW, height: outH },
      frameRate:               srcFps,
      audioCodec:              'AAC',
      audioTransfer:           'Copy',
      dynamicCompressionLevel: 'High',
    },
  };

  // POST /video/express → { requestId, uploadId, uploadUrls }
  const expressed = await topazFetch('/video/express', 'POST', topaz_key, expressBody);
  const requestId  = expressed.requestId || expressed.requestID || expressed.id;
  const uploadUrls = expressed.uploadUrls || expressed.urls || [];
  const uploadUrl  = uploadUrls[0] || expressed.url || expressed.uploadUrl;

  if (!requestId)  throw new Error(`Topaz express: no requestId — ${JSON.stringify(expressed)}`);
  if (!uploadUrl)  throw new Error(`Topaz express: no uploadUrl — ${JSON.stringify(expressed)}`);

  // PUT video bytes to S3 (Worker→S3, no CORS issue)
  const videoBytes = Uint8Array.from(atob(video_b64), c => c.charCodeAt(0));
  const s3Resp = await fetch(uploadUrl, {
    method:  'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body:    videoBytes,
  });
  if (!s3Resp.ok) {
    const s3Err = await s3Resp.text().catch(() => s3Resp.statusText);
    throw new Error(`S3 upload failed ${s3Resp.status}: ${s3Err}`);
  }

  return json({ request_id: requestId, out_width, out_height });
}

// Backward compat alias
export const handleTopazVideoInit     = handleTopazVideoSubmit;
export const handleTopazVideoComplete = () => json({ ok: true }); // no-op, not needed with express

// ── POST /topaz/video/status ─────────────────────────────
// Returns: { status, raw_status, output_url?, progress? }
// CRITICAL: Topaz puts download URL in data.download.url (NOT top-level)
export async function handleTopazVideoStatus(request) {
  let body;
  try { body = await request.json(); }
  catch { return err('Invalid JSON body'); }

  const { topaz_key, request_id } = body;
  if (!topaz_key)  return err('topaz_key required');
  if (!request_id) return err('request_id required');

  const data = await topazFetch(`/video/${request_id}/status`, 'GET', topaz_key);

  // Download URL is in data.download.url per OpenAPI spec
  const outputUrl = data.download?.url
    || data.url || data.output_url || data.outputUrl
    || data.outputLocation || data.downloadUrl
    || data.output?.url || data.result?.url;

  const rawStatus  = data.status || data.state || '';
  const normStatus = rawStatus.toLowerCase().replace(/[_\s]/g, '');

  return json({
    raw_status: rawStatus,
    status:     normStatus || 'processing',
    output_url: outputUrl || null,
    progress:   data.progress ?? null,
    // Pass through for debugging
    estimates:  data.estimates || null,
    request_id,
  });
}

// ── POST /topaz/video/download ───────────────────────────
// Proxies the output video from R2 through the Worker to bypass CORS.
// The R2 output bucket (videocloud-prod-main-output.*.r2.cloudflarestorage.com)
// blocks direct browser downloads from null origin.
// Worker→R2 is server-to-server — no CORS restriction.
// Body: { output_url }
// Returns: video/mp4 stream with CORS headers
export async function handleTopazVideoDownload(request) {
  let body;
  try { body = await request.json(); }
  catch { return err('Invalid JSON body'); }

  const { output_url } = body;
  if (!output_url) return err('output_url required');

  // Fetch from R2 (no CORS restriction server-side)
  const r2Resp = await fetch(output_url);
  if (!r2Resp.ok) {
    throw new Error(`R2 download failed: ${r2Resp.status} ${r2Resp.statusText}`);
  }

  // Stream the response back — Workers handle large files efficiently
  return new Response(r2Resp.body, {
    status: 200,
    headers: {
      'Content-Type':   r2Resp.headers.get('Content-Type')   || 'video/mp4',
      'Content-Length': r2Resp.headers.get('Content-Length') || '',
    },
  });
}
