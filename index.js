// ══════════════════════════════════════════════════════════
// GIS Proxy — Cloudflare Worker
// Verze: 2026-09 (R2 bucket: Magnific video + generický /r2/upload pro Kling V2V a další)
//
// Slouží jako CORS proxy pro providery, kteří blokují přímé
// browser requesty z file:// origin.
//
// Architektura:
//  - Worker NIKDY nečeká na dlouhé operace (polling loop běží v GIS)
//  - Worker NIKDY nestahuje velké soubory (videa, velké obrázky)
//    → vrací pouze CDN URL, GIS stahuje přímo
//  - Submit endpointy vrátí ID okamžitě (<5s)
//  - Status endpointy dělají jeden GET a vrátí stav okamžitě
//
// Routes:
//   POST /xai/generate           → xAI Grok Imagine (sync)
//   POST /luma/generate          → Luma Photon image submit
//   POST /luma/status            → Luma Photon image status
//   POST /luma/video/submit      → Luma Ray3/3.14 video submit
//   POST /luma/video/status      → Luma Ray3/3.14 video status
//   POST /magnific/upscale       → Magnific Creative upscale submit
//   POST /magnific/precision     → Magnific Precision V1/V2 upscale submit
//   POST /magnific/status        → Magnific status (all types)
//   POST /magnific/mystic        → Mystic image generation
//   POST /magnific/relight       → Image Relight
//   POST /magnific/style-transfer → Style Transfer
//   POST /magnific/skin-enhancer → Skin Enhancer
//   POST /magnific/video-upscale → Video Upscaler (Creative + Precision)
//   POST /fal/submit             → fal.ai queue submit (CORS bypass pro Kling 2.5-turbo)
//   POST /fal/status             → fal.ai queue status
//   POST /fal/result             → fal.ai queue result
//   POST /topaz/video/submit     → Topaz video: express submit → request_id
//   POST /topaz/video/init       → Topaz video: init request + accept
//   POST /topaz/video/complete   → Topaz video: potvrdit upload
//   POST /topaz/video/status     → Topaz video: status check
//   POST /topaz/video/download   → Topaz video: stream R2→browser
//   POST /topaz/image/submit     → Topaz image: multipart submit → process_id
//   POST /topaz/image/status     → Topaz image: status check
//   POST /topaz/image/download   → Topaz image: stream result→browser
//   POST /replicate/wan27/submit → Replicate WAN 2.7 prediction submit
//   POST /replicate/wan27/status → Replicate WAN 2.7 prediction status
//   GET  /health                 → health check
// ══════════════════════════════════════════════════════════

import { handleXai }                              from './handlers/xai.js';
import { handleLuma, handleLumaStatus,
         handleLumaVideoSubmit,
         handleLumaVideoStatus }                  from './handlers/luma.js';
import { handleMagnific, handleMagnificStatus,
         handleMagnificPrecision,
         handleMagnificMystic,
         handleMagnificRelight,
         handleMagnificStyleTransfer,
         handleMagnificSkinEnhancer,
         handleMagnificVideoUpscale,
         handleMagnificVideoFile,
         handleMagnificVideoCleanup,
         handleR2Upload,
         handleR2Serve }                       from './handlers/magnific.js';
import { handleFalSubmit, handleFalStatus,
         handleFalResult }                        from './handlers/fal.js';
import { handleTopazVideoSubmit,
         handleTopazVideoInit,
         handleTopazVideoComplete,
         handleTopazVideoStatus,
         handleTopazVideoDownload }               from './handlers/topaz.js';
import { handleTopazImageSubmit,
         handleTopazImageStatus,
         handleTopazImageDownload }               from './handlers/topaz-image.js';
import { handleReplicateWan27Submit,
         handleReplicateWan27Status }             from './handlers/replicate-wan27.js';
import { handleReplicateWan27vSubmit,
         handleReplicateWan27vStatus }            from './handlers/replicate-wan27v.js';
import { handleReplicateWan27eSubmit,
         handleReplicateWan27eStatus,
         handleReplicateFilesUpload,
         handleReplicateVideoServe,
         handleReplicateUploadVideo }             from './handlers/replicate-wan27e.js';

// ── CORS hlavičky — povoleno pro file:// a všechny origins ──
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key, X-Fal-Key, X-Replicate-Key, X-Content-Length, X-Filename',
};

function corsResponse(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra },
  });
}

// ── Main handler ──────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // Preflight OPTIONS — odpovědět okamžitě
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // ── Health check ────────────────────────────────────
    if (path === '/health' || path === '/') {
      return corsResponse(JSON.stringify({
        status: 'ok',
        version: '2026-08',
        routes: [
          'POST /xai/generate',
          'POST /luma/generate',
          'POST /luma/status',
          'POST /luma/video/submit',
          'POST /luma/video/status',
          'POST /magnific/upscale',
          'POST /magnific/precision',
          'POST /magnific/status',
          'POST /magnific/mystic',
          'POST /magnific/relight',
          'POST /magnific/style-transfer',
          'POST /magnific/skin-enhancer',
          'POST /magnific/video-upscale',
          'GET  /magnific/video-file/{key}  (R2 video serve)',
          'POST /magnific/video-cleanup       (R2 cleanup)',
          'POST /r2/upload                    (generic R2 binary upload)',
          'GET  /r2/serve/{key}              (serve R2 file)',
          'POST /fal/submit',
          'POST /fal/status',
          'POST /fal/result',
          'POST /topaz/video/submit',
          'POST /topaz/video/init',
          'POST /topaz/video/complete',
          'POST /topaz/video/status',
          'POST /topaz/video/download',
          'POST /topaz/image/submit',
          'POST /topaz/image/status',
          'POST /topaz/image/download',
          'POST /replicate/wan27/submit',
          'POST /replicate/wan27/status',
          'POST /replicate/wan27v/submit',
          'POST /replicate/wan27v/status',
          'POST /replicate/wan27e/submit',
          'POST /replicate/wan27e/status',
        ],
      }));
    }

    // ── GET routes (before POST-only check) ─────────────
    // DashScope fetches video/image URLs via GET — must allow before POST check
    if (request.method === 'GET' && path.startsWith('/replicate/video/') && path.endsWith('/source.mp4')) {
      const fileId = path.split('/')[3];
      return handleReplicateVideoServe(request, fileId);
    }
    if (request.method === 'GET' && path.startsWith('/replicate/image/') && path.endsWith('/ref.jpg')) {
      const fileId = path.split('/')[3];
      return handleReplicateVideoServe(request, fileId);
    }
    // Magnific video file — serves R2 video as public HTTPS for Freepik
    if (request.method === 'GET' && path.startsWith('/magnific/video-file/')) {
      return withCors(await handleMagnificVideoFile(request, env));
    }
    // Generic R2 file serving — Kling V2V motion video + any future binary
    if (request.method === 'GET' && path.startsWith('/r2/serve/')) {
      return withCors(await handleR2Serve(request, env));
    }

    // ── Require POST for all action routes ──────────────
    if (request.method !== 'POST') {
      return corsResponse(JSON.stringify({ error: 'Method not allowed' }), 405);
    }

    try {
      // ── xAI ───────────────────────────────────────────
      if (path === '/xai/generate')             return withCors(await handleXai(request));

      // ── Luma image (Photon) ───────────────────────────
      if (path === '/luma/generate')            return withCors(await handleLuma(request));
      if (path === '/luma/status')              return withCors(await handleLumaStatus(request));

      // ── Luma video (Ray3 / Ray3.14) ───────────────────
      if (path === '/luma/video/submit')        return withCors(await handleLumaVideoSubmit(request, env));
      if (path === '/luma/video/status')        return withCors(await handleLumaVideoStatus(request));

      // ── Magnific / Freepik upscale ────────────────────
      if (path === '/magnific/upscale')         return withCors(await handleMagnific(request));
      if (path === '/magnific/precision')       return withCors(await handleMagnificPrecision(request));
      if (path === '/magnific/status')          return withCors(await handleMagnificStatus(request));
      if (path === '/magnific/mystic')          return withCors(await handleMagnificMystic(request));
      if (path === '/magnific/relight')         return withCors(await handleMagnificRelight(request));
      if (path === '/magnific/style-transfer')  return withCors(await handleMagnificStyleTransfer(request));
      if (path === '/magnific/skin-enhancer')   return withCors(await handleMagnificSkinEnhancer(request));
      if (path === '/magnific/video-upscale')   return withCors(await handleMagnificVideoUpscale(request, env));
      if (path === '/magnific/video-cleanup')   return withCors(await handleMagnificVideoCleanup(request, env));
      if (path === '/r2/upload')                return withCors(await handleR2Upload(request, env));

      // ── fal.ai queue (CORS bypass pro Kling 2.5-turbo) ─
      if (path === '/fal/submit')               return withCors(await handleFalSubmit(request));
      if (path === '/fal/status')               return withCors(await handleFalStatus(request));
      if (path === '/fal/result')               return withCors(await handleFalResult(request));

      // ── Topaz Labs video upscale ──────────────────────
      if (path === '/topaz/video/submit')       return withCors(await handleTopazVideoSubmit(request));
      if (path === '/topaz/video/init')         return withCors(await handleTopazVideoInit(request));
      if (path === '/topaz/video/complete')     return withCors(await handleTopazVideoComplete(request));
      if (path === '/topaz/video/status')       return withCors(await handleTopazVideoStatus(request));
      if (path === '/topaz/video/download')     return withCors(await handleTopazVideoDownload(request));

      // ── Topaz Labs image upscale (Gigapixel / Bloom) ──
      if (path === '/topaz/image/submit')       return withCors(await handleTopazImageSubmit(request));
      if (path === '/topaz/image/status')       return withCors(await handleTopazImageStatus(request));
      if (path === '/topaz/image/download')     return withCors(await handleTopazImageDownload(request));

      // ── Replicate WAN 2.7 image ────────────────────────
      if (path === '/replicate/wan27/submit')    return withCors(await handleReplicateWan27Submit(request));
      if (path === '/replicate/wan27/status')    return withCors(await handleReplicateWan27Status(request));

      // ── Replicate WAN 2.7 I2V ─────────────────────────────
      if (path === '/replicate/wan27v/submit')   return withCors(await handleReplicateWan27vSubmit(request));
      if (path === '/replicate/wan27v/status')   return withCors(await handleReplicateWan27vStatus(request));
      if (path === '/replicate/wan27e/submit')   return withCors(await handleReplicateWan27eSubmit(request));
      if (path === '/replicate/wan27e/status')   return withCors(await handleReplicateWan27eStatus(request));
      if (path === '/replicate/files/upload')    return withCors(await handleReplicateFilesUpload(request));
      if (path === '/replicate/upload/video')    return withCors(await handleReplicateUploadVideo(request));

    } catch (err) {
      console.error(`[GIS Proxy] Uncaught error on ${path}:`, err);
      return corsResponse(JSON.stringify({ error: `Internal error: ${err.message}` }), 500);
    }

    return corsResponse(JSON.stringify({ error: `Unknown route: ${path}` }), 404);
  },
};

// ── Přidá CORS hlavičky k response z handleru ────────────
function withCors(response) {
  const newHeaders = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(k, v);
  }
  return new Response(response.body, {
    status:  response.status,
    headers: newHeaders,
  });
}
