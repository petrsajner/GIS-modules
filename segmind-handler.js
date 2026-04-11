// handlers/segmind.js
// GIS Proxy — Segmind (WAN 2.7 Image generation & editing)
// Route: POST /segmind/image → WAN 2.7 T2I + Edit via Segmind API
//
// Design: passthrough — GIS sends { apiKey, model, messages, parameters }
// Worker forwards to Segmind REST API with x-api-key auth.
// Segmind returns raw image binary (PNG) directly — NOT JSON with URLs.
// Worker passes binary through to GIS client.

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

// POST /segmind/image
export async function handleSegmindImage(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, model, messages, parameters } = body;
  if (!apiKey) return jsonResp({ error: 'apiKey required' }, 400);
  if (!model)  return jsonResp({ error: 'model required' }, 400);

  // Build Segmind payload — parameters as top-level fields
  const sgPayload = { messages: messages || [] };
  if (parameters) Object.assign(sgPayload, parameters);

  const resp = await fetch(`https://api.segmind.com/v1/${model}`, {
    method: 'POST',
    headers: {
      'x-api-key':    apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sgPayload),
  });

  const ct = resp.headers.get('content-type') || '';

  // Success: binary image — pass through with CORS headers
  if (resp.ok && ct.startsWith('image/')) {
    return new Response(resp.body, {
      status: 200,
      headers: { 'Content-Type': ct, ...CORS },
    });
  }

  // Error or JSON response — parse and forward
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: `Segmind ${resp.status}: ${text.slice(0, 300)}` }; }
  return jsonResp(data, resp.ok ? 200 : resp.status);
}
