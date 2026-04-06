// handlers/replicate-wan27v.js
// GIS Proxy — Replicate WAN 2.7 Image-to-Video
// Routes: POST /replicate/wan27v/submit   → submit prediction
//         POST /replicate/wan27v/status   → poll prediction status
//
// Integration in index.js:
//   import { handleReplicateWan27vSubmit, handleReplicateWan27vStatus } from './handlers/replicate-wan27v.js';
//   if (path === '/replicate/wan27v/submit') return withCors(await handleReplicateWan27vSubmit(request));
//   if (path === '/replicate/wan27v/status') return withCors(await handleReplicateWan27vStatus(request));

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

// POST /replicate/wan27v/submit
// Body: { replicateKey, input: { prompt, first_frame, last_frame?, resolution, duration, ... } }
// Returns: Replicate prediction object { id, status, ... }
export async function handleReplicateWan27vSubmit(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { replicateKey, input } = body;
  if (!replicateKey)    return jsonResp({ error: 'replicateKey required' }, 400);
  if (!input?.prompt && !input?.first_frame)
                        return jsonResp({ error: 'input.first_frame required for I2V' }, 400);

  const resp = await fetch('https://api.replicate.com/v1/models/wan-video/wan-2.7-i2v/predictions', {
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

// POST /replicate/wan27v/status
// Body: { replicateKey, predictionId }
// Returns: Replicate prediction object { id, status, output?, error? }
// output is a single URL string when status === 'succeeded'
export async function handleReplicateWan27vStatus(request) {
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
