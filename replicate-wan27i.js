// handlers/replicate-wan27i.js
// GIS Proxy — Replicate WAN 2.7 Image (T2I + Edit)
// Routes:
//   POST /replicate/wan27i/submit  → create prediction
//   GET  /replicate/wan27i/status/:id → poll status

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// POST /replicate/wan27i/submit
// body: { apiKey, model (e.g. "wan-video/wan-2.7-image"), input: { prompt, size, ... } }
export async function handleReplicateWan27iSubmit(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, model, input } = body;
  if (!apiKey) return jsonResp({ error: 'apiKey required' }, 400);
  if (!model)  return jsonResp({ error: 'model required' }, 400);

  // Create prediction using model slug (uses latest version automatically)
  const resp = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ input: input || {} }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    return jsonResp({ error: data.detail || data.title || JSON.stringify(data).slice(0, 300) }, resp.status);
  }

  return jsonResp({ id: data.id, status: data.status });
}

// POST /replicate/wan27i/status
// body: { apiKey, id }
export async function handleReplicateWan27iStatus(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { apiKey, id } = body;
  if (!apiKey) return jsonResp({ error: 'apiKey required' }, 400);
  if (!id)     return jsonResp({ error: 'id required' }, 400);

  const resp = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  const data = await resp.json();
  if (!resp.ok) {
    return jsonResp({ error: data.detail || JSON.stringify(data).slice(0, 300) }, resp.status);
  }

  return jsonResp({
    status: data.status,
    output: data.output || null,
    error:  data.error || null,
  });
}
