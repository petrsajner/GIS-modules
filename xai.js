// ─────────────────────────────────────────────
// xAI Grok Imagine provider
// Model: grok-imagine-image
// T2I:  POST /v1/images/generations
// I2I:  totéž + image: { url: "data:..." }
// resolution: "1k" (default) | "2k" (vyšší kvalita, extra_body parametr)
// ─────────────────────────────────────────────

import { errorResponse, jsonResponse } from '../utils/cors.js';

async function urlToBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Image fetch ${resp.status}: ${resp.statusText}`);
  const buf   = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary  = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── Payload GIS → Worker ──────────────────────────────────────
// {
//   xai_key:      string,
//   prompt:       string,
//   model?:       "grok-imagine-image",
//   aspect_ratio?: "16:9" | "1:1" | ... (default "16:9")
//   n?:           1–4 (default 1)
//   resolution?:  "1k" | "2k" (default "1k")
//   image_url?:   "data:image/jpeg;base64,..." — I2I editace
// }
//
// ── Response Worker → GIS ─────────────────────────────────────
// { images: [{ b64_data: string, mime_type: "image/jpeg" }] }

export async function handleXai(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const { xai_key, prompt, model, aspect_ratio, n, resolution, image_url } = body;

  if (!xai_key) return errorResponse('Chybí xai_key', 400);
  if (!prompt)  return errorResponse('Chybí prompt', 400);

  const count   = Math.min(Math.max(parseInt(n) || 1, 1), 10);
  const aspectR = aspect_ratio || '16:9';
  const res     = resolution === '2k' ? '2k' : '1k';

  const payload = {
    model:        model || 'grok-imagine-image',
    prompt,
    n:            count,
    aspect_ratio: aspectR,
    resolution:   res,   // vždy explicitně — "1k" nebo "2k"
  };

  // I2I editace — přidat zdrojový obrázek
  if (image_url) {
    payload.image = { url: image_url };
  }

  let xaiResp;
  try {
    xaiResp = await fetch('https://api.x.ai/v1/images/generations', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${xai_key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return errorResponse(`xAI network error: ${e.message}`, 502);
  }

  if (!xaiResp.ok) {
    const errText = await xaiResp.text().catch(() => '');
    return errorResponse(`API ${xaiResp.status}: ${errText}`, xaiResp.status);
  }

  let xaiData;
  try {
    xaiData = await xaiResp.json();
  } catch {
    return errorResponse('xAI API vrátilo neplatné JSON', 502);
  }

  const items = xaiData.data;
  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse('xAI nevrátilo žádné obrázky', 502, JSON.stringify(xaiData));
  }

  let images;
  try {
    images = await Promise.all(items.map(async img => {
      if (!img.url) throw new Error('xAI: chybí url v položce výsledku');
      const b64 = await urlToBase64(img.url);
      return { b64_data: b64, mime_type: 'image/jpeg' };
    }));
  } catch (e) {
    return errorResponse(`Fetch výsledku selhal: ${e.message}`, 502);
  }

  return jsonResponse({ images });
}
