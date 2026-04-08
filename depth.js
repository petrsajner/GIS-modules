// ═══════════════════════════════════════════════════════
// handlers/depth.js  —  Worker depth-anything CORS proxy
// Cesta v projektu: src/handlers/depth.js
// DŮLEŽITÉ: fal-ai/depth-anything neexistuje na fal.run
// Správný endpoint je fal-ai/imageutils/depth (vrací 401 bez klíče = existuje)
//
// fal.run/fal-ai/depth-anything je synchronní model —
// přímé volání z file:// je CORS-blokované, proto proxy.
//
// Route: POST /depth
// Header: X-Fal-Key: <api_key>
// Body:   { image_url: "data:image/jpeg;base64,..." }
// ═══════════════════════════════════════════════════════

export async function handleDepth(request) {
  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const falKey = request.headers.get('X-Fal-Key') || '';
  if (!falKey) {
    return new Response(JSON.stringify({ error: 'Missing X-Fal-Key header' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const res = await fetch('https://fal.run/fal-ai/imageutils/depth', {
    method:  'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  return new Response(await res.text(), {
    status:  res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
