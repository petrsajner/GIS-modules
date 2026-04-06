// ══════════════════════════════════════════════════════════
// Topaz Labs Image API Handler — GIS Proxy
// Gigapixel + Bloom + Wonder 2 image upscale
//
// Two different endpoints:
//   Gigapixel models → POST /image/v1/enhance/async
//   Bloom / Wonder models → POST /image/v1/enhance-gen/async
//
// Scale is specified via output_width + output_height (not output_scale)
//
// Routes:
//   POST /topaz/image/submit   — build multipart → correct endpoint → process_id
//   POST /topaz/image/status   — poll; if Completed, also fetch presigned URL
//   POST /topaz/image/download — stream presigned URL → browser
// ══════════════════════════════════════════════════════════

const TOPAZ_IMAGE_API = 'https://api.topazlabs.com/image/v1';

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
function errResp(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// ── POST /topaz/image/submit ─────────────────────────────
// Body (JSON): {
//   topaz_key, model, is_gen,
//   src_width, src_height, output_scale,
//   output_format, image_b64,
//   prompt?, creativity?,
//   face_enhancement?, face_enhancement_strength?, face_enhancement_creativity?
// }
// Returns: { process_id }
export async function handleTopazImageSubmit(request) {
  let body;
  try { body = await request.json(); } catch { return errResp('Invalid JSON body'); }

  const {
    topaz_key, model, is_gen,
    src_width, src_height, output_scale,
    output_format = 'jpeg',
    image_b64,
    prompt, creativity,
    face_enhancement, face_enhancement_strength, face_enhancement_creativity,
  } = body;

  if (!topaz_key)  return errResp('Missing topaz_key');
  if (!model)      return errResp('Missing model');
  if (!image_b64)  return errResp('Missing image_b64');

  // Convert base64 → Uint8Array
  let bytes;
  try {
    const binary = atob(image_b64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch (e) {
    return errResp(`base64 decode failed: ${e.message}`);
  }

  // Compute output dimensions from source × scale
  // If src dims unknown, omit output_width/height (API will use its defaults)
  const scale = parseInt(output_scale) || 2;
  const outW = src_width  ? Math.round(src_width  * scale) : null;
  const outH = src_height ? Math.round(src_height * scale) : null;

  // Choose endpoint based on model type
  // is_gen=true → enhance-gen (Bloom, Wonder, Reimagine)
  // is_gen=false → enhance (Gigapixel precision models)
  const endpoint = is_gen
    ? `${TOPAZ_IMAGE_API}/enhance-gen/async`
    : `${TOPAZ_IMAGE_API}/enhance/async`;

  // Build multipart/form-data
  const formData = new FormData();
  formData.append('model', model);
  formData.append('output_format', output_format);
  if (outW) formData.append('output_width',  String(outW));
  if (outH) formData.append('output_height', String(outH));

  // Bloom/Wonder-specific params
  if (is_gen) {
    if (creativity)  formData.append('creativity', String(parseInt(creativity)));
    if (prompt)      formData.append('prompt', prompt);
  }

  // Gigapixel-specific params
  if (!is_gen) {
    if (face_enhancement) {
      formData.append('face_enhancement', 'true');
      if (face_enhancement_strength  != null) formData.append('face_enhancement_strength',  String(face_enhancement_strength));
      if (face_enhancement_creativity != null) formData.append('face_enhancement_creativity', String(face_enhancement_creativity));
    }
  }

  // Detect mime from first bytes (JPEG: FF D8 | PNG: 89 50)
  const mime = (bytes[0] === 0xFF && bytes[1] === 0xD8) ? 'image/jpeg'
             : (bytes[0] === 0x89 && bytes[1] === 0x50) ? 'image/png'
             : 'image/jpeg';
  formData.append('image', new Blob([bytes], { type: mime }), mime === 'image/png' ? 'input.png' : 'input.jpg');

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'X-API-KEY': topaz_key },
      body: formData,
    });
  } catch (e) {
    return errResp(`Topaz API unreachable: ${e.message}`, 502);
  }

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) return errResp(`Topaz image submit ${res.status}: ${JSON.stringify(data)}`, res.status);

  return jsonResp({ process_id: data.process_id });
}

// ── POST /topaz/image/status ─────────────────────────────
// Body: { topaz_key, process_id }
// Returns: { status } or { status: 'Completed', download_url }
export async function handleTopazImageStatus(request) {
  let body;
  try { body = await request.json(); } catch { return errResp('Invalid JSON body'); }
  const { topaz_key, process_id } = body;
  if (!topaz_key || !process_id) return errResp('Missing topaz_key or process_id');

  let statusRes;
  try {
    statusRes = await fetch(`${TOPAZ_IMAGE_API}/status/${process_id}`, {
      headers: { 'X-API-KEY': topaz_key },
    });
  } catch (e) {
    return errResp(`Topaz status fetch failed: ${e.message}`, 502);
  }

  const statusText = await statusRes.text();
  let statusData;
  try { statusData = JSON.parse(statusText); } catch { statusData = { raw: statusText }; }
  if (!statusRes.ok) return errResp(`Topaz image status ${statusRes.status}: ${JSON.stringify(statusData)}`, statusRes.status);

  const status = statusData.status;

  // When completed: fetch presigned download URL
  if (status === 'Completed') {
    try {
      const dlRes = await fetch(`${TOPAZ_IMAGE_API}/download/${process_id}`, {
        headers: { 'X-API-KEY': topaz_key },
      });
      if (dlRes.ok) {
        const dlData = await dlRes.json();
        return jsonResp({ status, download_url: dlData.download_url });
      }
    } catch (_) {}
    return jsonResp({ status, download_url: null });
  }

  return jsonResp({ status });
}

// ── POST /topaz/image/download ───────────────────────────
// Body: { download_url } — presigned S3 URL
// Streams image to browser (CORS bypass)
export async function handleTopazImageDownload(request) {
  let body;
  try { body = await request.json(); } catch { return errResp('Invalid JSON body'); }
  const { download_url } = body;
  if (!download_url) return errResp('Missing download_url');

  let res;
  try {
    res = await fetch(download_url);
  } catch (e) {
    return errResp(`Topaz image download failed: ${e.message}`, 502);
  }

  if (!res.ok) return errResp(`Topaz image download ${res.status}`, res.status);

  const contentType = res.headers.get('Content-Type') || 'image/jpeg';
  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}
