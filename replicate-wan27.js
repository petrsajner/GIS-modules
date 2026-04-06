// handlers/replicate-wan27.js
// GIS Proxy — Replicate WAN 2.7 Image
// Routes: POST /replicate/wan27/submit   → submit prediction
//         POST /replicate/wan27/status   → poll prediction status
//
// Integration in index.js:
//   import { handleReplicateWan27Submit, handleReplicateWan27Status } from './handlers/replicate-wan27.js';
//   ...
//   if (path === '/replicate/wan27/submit') return handleReplicateWan27Submit(request);
//   if (path === '/replicate/wan27/status') return handleReplicateWan27Status(request);

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

// POST /replicate/wan27/submit
// Body: { replicateKey: string, input: { prompt, size, num_outputs, images?, thinking_mode?, seed? } }
// Returns: Replicate prediction object { id, status, ... }
export async function handleReplicateWan27Submit(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { replicateKey, input } = body;
  if (!replicateKey) return jsonResp({ error: 'replicateKey required' }, 400);
  if (!input?.prompt) return jsonResp({ error: 'input.prompt required' }, 400);

  const resp = await fetch('https://api.replicate.com/v1/models/wan-video/wan-2.7-image/predictions', {
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

// POST /replicate/wan27/status
// Body: { replicateKey: string, predictionId: string }
// Returns: Replicate prediction object { id, status, output?, error? }
export async function handleReplicateWan27Status(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await request.json(); } catch { return jsonResp({ error: 'Invalid JSON' }, 400); }

  const { replicateKey, predictionId } = body;
  if (!replicateKey)   return jsonResp({ error: 'replicateKey required' }, 400);
  if (!predictionId)   return jsonResp({ error: 'predictionId required' }, 400);

  const resp = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { 'Authorization': `Bearer ${replicateKey}` },
  });

  const data = await resp.json();
  return jsonResp(data, resp.status);
}
