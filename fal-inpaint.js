// ═══════════════════════════════════════════════════════
// handlers/fal.js  —  Worker fal.ai CORS proxy
// Cesta v projektu: src/handlers/fal-inpaint.js
// POZOR: GIS build modul se také jmenuje fal.js — to je jiný soubor!
//
// Poskytuje CORS-safe přístup k fal.ai queue pro modely
// které blokují file:// origin (flux-pro/v1/fill, flux-general/inpainting, ...)
//
// Rozhraní (všechny POST, header: X-Fal-Key: <api_key>):
//   /fal/submit  — body: { endpoint: string, payload: object }
//   /fal/status  — body: { status_url: string }
//   /fal/result  — body: { response_url: string }
// ═══════════════════════════════════════════════════════

export async function handleFalSubmit(request) {
  let body;
  try { body = await request.json(); } catch { return jsonErr('Invalid JSON', 400); }

  const falKey   = request.headers.get('X-Fal-Key') || '';
  const endpoint = body.endpoint;
  const payload  = body.payload || {};

  if (!falKey)   return jsonErr('Missing X-Fal-Key header', 400);
  if (!endpoint) return jsonErr('Missing endpoint in body', 400);

  const res = await fetch(`https://queue.fal.run/${endpoint}`, {
    method:  'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  return new Response(await res.text(), {
    status:  res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleFalStatus(request) {
  let body;
  try { body = await request.json(); } catch { return jsonErr('Invalid JSON', 400); }

  const falKey    = request.headers.get('X-Fal-Key') || '';
  const statusUrl = body.status_url;

  if (!falKey)    return jsonErr('Missing X-Fal-Key header', 400);
  if (!statusUrl) return jsonErr('Missing status_url in body', 400);

  const res = await fetch(statusUrl, {
    headers: { 'Authorization': `Key ${falKey}` },
  });

  return new Response(await res.text(), {
    status:  res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleFalResult(request) {
  let body;
  try { body = await request.json(); } catch { return jsonErr('Invalid JSON', 400); }

  const falKey      = request.headers.get('X-Fal-Key') || '';
  const responseUrl = body.response_url;

  if (!falKey)      return jsonErr('Missing X-Fal-Key header', 400);
  if (!responseUrl) return jsonErr('Missing response_url in body', 400);

  const res = await fetch(responseUrl, {
    headers: { 'Authorization': `Key ${falKey}` },
  });

  return new Response(await res.text(), {
    status:  res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonErr(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
