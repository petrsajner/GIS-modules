// ─────────────────────────────────────────────
// Magnific (Freepik API) upscale provider
// Flow: GIS → Worker POST /magnific/upscale → { task_id }  (returns immediately)
//       GIS → Worker POST /magnific/status  → { status, url? } (GIS downloads image directly)
//
// Worker never downloads the result image — it just returns the CDN URL.
// GIS fetches the image directly from Freepik CDN to avoid Worker memory/timeout issues.
// ─────────────────────────────────────────────

import { errorResponse, jsonResponse } from '../utils/cors.js';

const FREEPIK_BASE = 'https://api.freepik.com/v1/ai';

// POST /magnific/upscale — submits job, returns { task_id } immediately
export async function handleMagnific(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    freepik_key,
    image_b64,
    scale_factor  = '2x',
    engine        = 'magnific_sparkle',
    optimized_for = 'standard',
    prompt,
    creativity    = 2,
    hdr           = 0,
    resemblance   = 0,
    fractality    = -1,
  } = body;

  if (!freepik_key) return errorResponse('Missing freepik_key', 400);
  if (!image_b64)   return errorResponse('Missing image_b64', 400);

  const freepikPayload = { image: image_b64, scale_factor, engine, optimized_for, creativity, hdr, resemblance, fractality };
  if (prompt) freepikPayload.prompt = prompt;

  let taskId;
  try {
    const submitResp = await fetch(`${FREEPIK_BASE}/image-upscaler`, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body: JSON.stringify(freepikPayload),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Freepik API ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id;
    if (!taskId) return errorResponse('Freepik: no task_id in response', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`Freepik submit error: ${e.message}`, 502);
  }

  return jsonResponse({ task_id: taskId });
}

// POST /magnific/status — single status check, returns URL (not image data)
// Body: { freepik_key, task_id, upscaler_type }
// upscaler_type values:
//   'creative'           → /v1/ai/image-upscaler/{id}
//   'precision-v1'       → /v1/ai/image-upscaler-precision/{id}
//   'precision-v2'       → /v1/ai/image-upscaler-precision-v2/{id}
//   'mystic'             → /v1/ai/mystic/{id}
//   'skin_enhancer'      → /v1/ai/skin-enhancer/{id}
//   'relight'            → /v1/ai/image-relight/{id}
//   'style_transfer'     → /v1/ai/image-style-transfer/{id}
//   'video_upscale'      → /v1/ai/video-upscaler/{id}
//   'video_upscale_prec' → /v1/ai/video-upscaler-precision/{id}
// Response:
//   { status: 'pending' }
//   { status: 'done', url: string }
//   { status: 'failed', error: string }
export async function handleMagnificStatus(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { freepik_key, task_id, upscaler_type } = body;
  if (!freepik_key) return errorResponse('Missing freepik_key', 400);
  if (!task_id)     return errorResponse('Missing task_id', 400);

  // Route to correct status endpoint based on type
  let statusPath;
  if      (upscaler_type === 'precision-v1')       statusPath = `${FREEPIK_BASE}/image-upscaler-precision/${task_id}`;
  else if (upscaler_type === 'precision-v2')        statusPath = `${FREEPIK_BASE}/image-upscaler-precision-v2/${task_id}`;
  else if (upscaler_type === 'mystic')              statusPath = `${FREEPIK_BASE}/mystic/${task_id}`;
  else if (upscaler_type === 'skin_enhancer')       statusPath = `${FREEPIK_BASE}/skin-enhancer/${task_id}`;
  else if (upscaler_type === 'relight')             statusPath = `${FREEPIK_BASE}/image-relight/${task_id}`;
  else if (upscaler_type === 'style_transfer')      statusPath = `${FREEPIK_BASE}/image-style-transfer/${task_id}`;
  else if (upscaler_type === 'video_upscale')       statusPath = `${FREEPIK_BASE}/video-upscaler/${task_id}`;
  else if (upscaler_type === 'video_upscale_prec')  statusPath = `${FREEPIK_BASE}/video-upscaler-precision/${task_id}`;
  else                                              statusPath = `${FREEPIK_BASE}/image-upscaler/${task_id}`; // creative (default)

  let data;
  try {
    const resp = await fetch(statusPath, {
      headers: { 'x-freepik-api-key': freepik_key },
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return errorResponse(`Freepik poll ${resp.status}: ${t}`, resp.status);
    }
    data = await resp.json();
  } catch (e) {
    return errorResponse(`Freepik status network error: ${e.message}`, 502);
  }

  const status = data?.data?.status;

  // API statuses: CREATED → IN_PROGRESS → COMPLETED / FAILED / ERROR
  if (status === 'FAILED' || status === 'ERROR') {
    return jsonResponse({ status: 'failed', error: JSON.stringify(data?.data) });
  }

  if (status === 'COMPLETED') {
    // generated[] is an array of URL strings (not objects)
    const url = data?.data?.generated?.[0];
    if (!url) return errorResponse('Magnific: COMPLETED but no result URL', 502);
    // Return URL only — GIS fetches the image directly, Worker doesn't touch the large file
    return jsonResponse({ status: 'done', url });
  }

  return jsonResponse({ status: 'pending', task_status: status });
}

// POST /magnific/precision — submits Precision V1 or V2 job, returns { task_id }
// Body: { freepik_key, image_b64, prec_version ('v1'|'v2'), scale_factor, flavor, sharpen, smart_grain, ultra_detail }
export async function handleMagnificPrecision(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    freepik_key,
    image_b64,
    prec_version  = 'v2',
    scale_factor  = 2,
    flavor        = 'sublime',
    sharpen       = 7,
    smart_grain   = 7,
    ultra_detail  = 30,
  } = body;

  if (!freepik_key) return errorResponse('Missing freepik_key', 400);
  if (!image_b64)   return errorResponse('Missing image_b64', 400);

  const isV1 = prec_version === 'v1';
  const endpoint = isV1
    ? `${FREEPIK_BASE}/image-upscaler-precision`
    : `${FREEPIK_BASE}/image-upscaler-precision-v2`;

  const freepikPayload = { image: image_b64, sharpen, smart_grain, ultra_detail };
  if (!isV1) {
    freepikPayload.scale_factor = scale_factor;
    freepikPayload.flavor = flavor;
  }

  let taskId;
  try {
    const submitResp = await fetch(endpoint, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body: JSON.stringify(freepikPayload),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Freepik Precision API ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id;
    if (!taskId) return errorResponse('Freepik Precision: no task_id in response', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`Freepik Precision submit error: ${e.message}`, 502);
  }

  return jsonResponse({ task_id: taskId });
}

// ─────────────────────────────────────────────
// POST /magnific/mystic — Mystic image generation
// Body: { freepik_key, prompt, mystic_model, resolution, aspect_ratio, creative_detailing,
//         engine, fixed_generation, structure_ref_b64, structure_strength,
//         style_ref_b64, adherence, hdr }
// Response: { task_id }
// ─────────────────────────────────────────────
export async function handleMagnificMystic(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    freepik_key,
    prompt            = '',
    mystic_model      = 'realism',
    resolution        = '2k',
    aspect_ratio      = 'square_1_1',
    creative_detailing = 33,
    engine            = 'automatic',
    fixed_generation  = false,
    structure_ref_b64,
    structure_strength = 50,
    style_ref_b64,
    adherence         = 50,
    hdr               = 50,
  } = body;

  if (!freepik_key) return errorResponse('Missing freepik_key', 400);

  const freepikPayload = { prompt, resolution, aspect_ratio, creative_detailing, engine, fixed_generation, filter_nsfw: true };
  if (mystic_model !== 'realism') freepikPayload.model = mystic_model;
  if (structure_ref_b64) {
    freepikPayload.structure_reference = structure_ref_b64;
    freepikPayload.structure_strength  = structure_strength;
  }
  if (style_ref_b64) {
    freepikPayload.style_reference = style_ref_b64;
    freepikPayload.adherence       = adherence;
    freepikPayload.hdr             = hdr;
  }

  let taskId;
  try {
    const submitResp = await fetch(`${FREEPIK_BASE}/mystic`, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body:    JSON.stringify(freepikPayload),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Freepik Mystic ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id;
    if (!taskId) return errorResponse('Mystic: no task_id', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`Mystic submit error: ${e.message}`, 502);
  }
  return jsonResponse({ task_id: taskId });
}

// ─────────────────────────────────────────────
// POST /magnific/skin-enhancer — Skin Enhancer
// Body: { freepik_key, image_b64, variant, sharpen, smart_grain }
// variant: 'creative' | 'faithful' | 'flexible'
// ─────────────────────────────────────────────
export async function handleMagnificSkinEnhancer(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const { freepik_key, image_b64, variant = 'creative', sharpen = 0, smart_grain = 2 } = body;
  if (!freepik_key) return errorResponse('Missing freepik_key', 400);
  if (!image_b64)   return errorResponse('Missing image_b64', 400);

  const allowed = ['creative', 'faithful', 'flexible'];
  const v = allowed.includes(variant) ? variant : 'creative';

  let taskId;
  try {
    const submitResp = await fetch(`${FREEPIK_BASE}/skin-enhancer/${v}`, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image: image_b64, sharpen, smart_grain }),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Skin Enhancer ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id || submitData?.task_id;
    if (!taskId) return errorResponse('SkinEnhancer: no task_id', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`SkinEnhancer submit error: ${e.message}`, 502);
  }
  return jsonResponse({ task_id: taskId });
}

// ─────────────────────────────────────────────
// POST /magnific/relight — Image Relight
// Body: { freepik_key, image_b64, prompt, transfer_ref_b64, light_transfer_strength,
//         change_background, style, interpolate_from_original }
// ─────────────────────────────────────────────
export async function handleMagnificRelight(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    freepik_key,
    image_b64,
    prompt,
    transfer_ref_b64,
    light_transfer_strength = 100,
    change_background       = false,
    style                   = 'smooth',
    interpolate_from_original = false,
  } = body;

  if (!freepik_key) return errorResponse('Missing freepik_key', 400);
  if (!image_b64)   return errorResponse('Missing image_b64', 400);

  const freepikPayload = { image: image_b64, change_background, style, interpolate_from_original };
  if (prompt)           freepikPayload.prompt = prompt;
  if (transfer_ref_b64) {
    freepikPayload.transfer_light_from_reference_image = transfer_ref_b64;
    freepikPayload.light_transfer_strength             = light_transfer_strength;
  }

  let taskId;
  try {
    const submitResp = await fetch(`${FREEPIK_BASE}/image-relight`, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body:    JSON.stringify(freepikPayload),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Relight ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id || submitData?.task_id;
    if (!taskId) return errorResponse('Relight: no task_id', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`Relight submit error: ${e.message}`, 502);
  }
  return jsonResponse({ task_id: taskId });
}

// ─────────────────────────────────────────────
// POST /magnific/style-transfer — Style Transfer
// Body: { freepik_key, image_b64, reference_b64, is_portrait, style, beautification, fixed_generation }
// ─────────────────────────────────────────────
export async function handleMagnificStyleTransfer(request) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    freepik_key,
    image_b64,
    reference_b64,
    is_portrait       = false,
    style,
    beautification,
    fixed_generation  = false,
  } = body;

  if (!freepik_key)   return errorResponse('Missing freepik_key', 400);
  if (!image_b64)     return errorResponse('Missing image_b64', 400);
  if (!reference_b64) return errorResponse('Missing reference_b64', 400);

  const freepikPayload = { image: image_b64, reference_image: reference_b64, is_portrait, fixed_generation };
  if (is_portrait && style)        freepikPayload.style = style;
  if (is_portrait && beautification) freepikPayload.beautification = beautification;

  let taskId;
  try {
    const submitResp = await fetch(`${FREEPIK_BASE}/image-style-transfer`, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body:    JSON.stringify(freepikPayload),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Style Transfer ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id || submitData?.task_id;
    if (!taskId) return errorResponse('StyleTransfer: no task_id', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`StyleTransfer submit error: ${e.message}`, 502);
  }
  return jsonResponse({ task_id: taskId });
}

// ─────────────────────────────────────────────
// POST /magnific/video-upscale — Video Upscaler (Creative or Precision)
// Body: { freepik_key, video_b64, mode, resolution, creativity, flavor,
//         fps_boost, sharpen, smart_grain, strength }
// mode: 'creative' | 'precision'
// ─────────────────────────────────────────────
export async function handleMagnificVideoUpscale(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body', 400); }

  const {
    freepik_key,
    replicate_key,
    fal_key,
    video_b64,
    video_url,
    mode        = 'creative',
    resolution  = '2k',
    creativity  = 50,
    flavor      = 'vivid',
    fps_boost   = false,
    sharpen     = 0,
    smart_grain = 0,
    strength    = 60,
    prompt      = '',
  } = body;

  if (!freepik_key)              return errorResponse('Missing freepik_key', 400);
  if (!video_url && !video_b64)  return errorResponse('Missing video_url or video_b64', 400);

  // Store video in Cloudflare R2, serve via Worker GET endpoint → HTTPS URL for Freepik
  let videoInput = video_url;
  if (!videoInput && video_b64) {
    if (!env?.VIDEOS) return errorResponse('R2 VIDEOS binding missing — check wrangler.toml', 500);
    try {
      // Buffer.from is fast base64 decode (nodejs_compat enabled)
      const bytes = Buffer.from(video_b64, 'base64');
      const key = `vid_${Date.now()}_${Math.random().toString(36).substr(2,6)}.mp4`;
      await env.VIDEOS.put(key, bytes, {
        httpMetadata: { contentType: 'video/mp4' },
      });
      const workerOrigin = new URL(request.url).origin;
      videoInput = `${workerOrigin}/magnific/video-file/${encodeURIComponent(key)}`;
    } catch (e) {
      return errorResponse(`R2 upload error: ${e.message}`, 502);
    }
  }
  if (!videoInput) return errorResponse('video_url or video_b64 required', 400);

  let endpoint, freepikPayload;
  if (mode === 'precision') {
    endpoint      = `${FREEPIK_BASE}/video-upscaler-precision`;
    freepikPayload = { video: videoInput, resolution, strength, fps_boost, sharpen, smart_grain };
  } else {
    endpoint      = `${FREEPIK_BASE}/video-upscaler`;
    freepikPayload = { video: videoInput, resolution, creativity, flavor, fps_boost, sharpen, smart_grain };
    if (prompt) freepikPayload.prompt = prompt;
  }

  let taskId;
  try {
    const submitResp = await fetch(endpoint, {
      method:  'POST',
      headers: { 'x-freepik-api-key': freepik_key, 'Content-Type': 'application/json' },
      body:    JSON.stringify(freepikPayload),
    });
    if (!submitResp.ok) {
      const t = await submitResp.text().catch(() => '');
      return errorResponse(`Video Upscaler ${submitResp.status}`, submitResp.status, t);
    }
    const submitData = await submitResp.json();
    taskId = submitData?.data?.task_id || submitData?.task_id;
    if (!taskId) return errorResponse('VideoUpscaler: no task_id', 502, JSON.stringify(submitData));
  } catch (e) {
    return errorResponse(`VideoUpscaler submit error: ${e.message}`, 502);
  }
  return jsonResponse({ task_id: taskId });
}

// ─────────────────────────────────────────────
// GET /magnific/video-file?id={fileId}&k={replicateKey}
// Proxy endpoint — serves a Replicate Files video as public HTTPS for Freepik
// Strategy: GET /v1/files/{id} with Accept: application/octet-stream triggers
// Replicate to redirect to a presigned S3 URL. We follow the S3 URL without auth.
// ─────────────────────────────────────────────
export async function handleMagnificVideoFile(request, env) {
  // Serve a video stored in R2 — called by Freepik when it downloads the source video
  if (!env?.VIDEOS) return errorResponse('R2 VIDEOS binding missing', 500);

  const url  = new URL(request.url);
  const key  = decodeURIComponent(url.pathname.replace('/magnific/video-file/', ''));
  if (!key)  return errorResponse('Missing video key', 400);

  try {
    const obj = await env.VIDEOS.get(key);
    if (!obj)  return errorResponse('Video not found in R2', 404);

    return new Response(obj.body, {
      status: 200,
      headers: {
        'Content-Type':                'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'no-store',
      },
    });
  } catch (e) {
    return errorResponse(`R2 get error: ${e.message}`, 502);
  }
}

// ─────────────────────────────────────────────
// POST /magnific/video-cleanup
// Deletes all temporary video files from R2 bucket.
// Called on GIS startup — fire and forget, no auth needed
// (files are ephemeral, nothing sensitive)
// ─────────────────────────────────────────────
export async function handleMagnificVideoCleanup(request, env) {
  if (!env?.VIDEOS) return errorResponse('R2 VIDEOS binding missing', 500);
  try {
    let deleted = 0;
    let cursor;
    do {
      const listed = await env.VIDEOS.list({ cursor, limit: 1000 });
      const keys = listed.objects.map(o => o.key);
      if (keys.length > 0) {
        await env.VIDEOS.delete(keys);
        deleted += keys.length;
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    return jsonResponse({ ok: true, deleted });
  } catch (e) {
    return errorResponse(`Cleanup error: ${e.message}`, 502);
  }
}

// ─────────────────────────────────────────────
// POST /r2/upload — Generic R2 binary upload
// Accepts raw binary body (video/image), stores in VIDEOS bucket, returns URL
// Used by: Kling V2V motion video, any future binary upload need
// ─────────────────────────────────────────────
export async function handleR2Upload(request, env) {
  if (!env?.VIDEOS) return errorResponse('R2 VIDEOS binding missing', 500);
  try {
    const body = await request.arrayBuffer();
    if (!body.byteLength) return errorResponse('Empty body', 400);

    const ct  = request.headers.get('Content-Type') || 'video/mp4';
    const ext = ct.includes('webm') ? 'webm' : ct.includes('png') ? 'png'
              : ct.includes('jpeg') || ct.includes('jpg') ? 'jpg' : 'mp4';
    const key = `upload_${Date.now()}_${Math.random().toString(36).substr(2,6)}.${ext}`;

    await env.VIDEOS.put(key, body, { httpMetadata: { contentType: ct } });

    const origin = new URL(request.url).origin;
    return jsonResponse({ url: `${origin}/r2/serve/${encodeURIComponent(key)}` });
  } catch (e) {
    return errorResponse(`R2 upload error: ${e.message}`, 502);
  }
}

// ─────────────────────────────────────────────
// GET /r2/serve/{key} — Serve a file from R2
// Returns raw binary with correct Content-Type
// ─────────────────────────────────────────────
export async function handleR2Serve(request, env) {
  if (!env?.VIDEOS) return errorResponse('R2 VIDEOS binding missing', 500);

  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace('/r2/serve/', ''));
  if (!key) return errorResponse('Missing key', 400);

  try {
    const obj = await env.VIDEOS.get(key);
    if (!obj) return errorResponse('Not found', 404);

    return new Response(obj.body, {
      status: 200,
      headers: {
        'Content-Type':                obj.httpMetadata?.contentType || 'video/mp4',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'no-store',
      },
    });
  } catch (e) {
    return errorResponse(`R2 serve error: ${e.message}`, 502);
  }
}
