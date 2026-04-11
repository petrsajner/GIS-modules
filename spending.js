// ═══════════════════════════════════════════════════════
// SPENDING TRACKER
// Tracks estimated API spend per provider in localStorage.
// Values are APPROXIMATE — based on known public pricing.
// Reset period manually when a billing invoice arrives.
// ═══════════════════════════════════════════════════════

// Estimated prices in USD
// Images: price per image. Video: price per second.
// Upscale: price per operation.
const SPEND_PRICES = {
  // ── Google — image (per image) ──────────────────────
  'gemini-3.1-flash-image-preview': 0.039,   // NB2
  'gemini-2.5-flash-image':         0.039,   // NB (gen 1) — same price as NB2
  'gemini-3-pro-image-preview':     0.039,   // NB Pro (same token rate, ~1290 output tokens)
  'imagen-4.0-generate-001':        0.040,   // Imagen 4
  'imagen-4.0-fast-generate-001':   0.020,   // Imagen 4 Fast
  'imagen-4.0-ultra-generate-001':  0.120,   // Imagen 4 Ultra

  // ── Google — video (per SECOND) ─────────────────────
  'veo-3.1-generate-preview':       0.400,   // Veo 3.1 Standard
  'veo-3.1-fast-generate-preview':  0.150,   // Veo 3.1 Fast

  // ── fal.ai — image (per image) ──────────────────────
  'fal-ai/flux-2-pro':              0.050,
  'fal-ai/flux-pro/v1/fill':        0.050,   // FLUX Pro Fill inpainting $0.05/MP
  'fal-ai/flux-general/inpainting':   0.025,   // FLUX General Inpaint ~$0.025/img
  'fal-ai/flux-lora/inpainting':      0.025,   // FLUX Dev Inpaint ~$0.025/img
  'fal-ai/flux-krea-lora/inpainting': 0.035,   // FLUX Krea Inpaint $0.035/MP
  'fal-ai/fast-sdxl/inpainting':      0.003,   // SDXL Fast ~$0.003/img
  'fal-ai/playground-v25/inpainting': 0.005,   // Playground v2.5 ~$0.005/img
  'fal-ai/qwen-image-edit/inpaint':   0.020,   // Qwen Edit Inpaint ~$0.02/img
  'fal-ai/flux-kontext-lora/inpaint': 0.030,   // FLUX Kontext Inpaint ~$0.03/img
  'fal-ai/depth-anything/v2':         0.003,   // Depth map generation
  'fal-ai/flux-2-flex':             0.040,
  'fal-ai/flux-2-max':              0.060,
  'fal-ai/flux-2':                  0.025,   // FLUX.2 Dev
  'fal-ai/bytedance/seedream/v4.5': 0.040,   // SeeDream 4.5
  'fal-ai/bytedance/seedream/v5/lite': 0.030, // SeeDream 5 Lite
  'fal-ai/kling-image/v3':          0.014,   // Kling Image V3
  'fal-ai/kling-image/o3':          0.025,   // Kling Image O3
  'fal-ai/z-image/base':            0.030,   // Z-Image Base
  'fal-ai/z-image/turbo':           0.025,   // Z-Image Turbo
  'fal-ai/qwen-image-2/text-to-image':     0.020,
  'fal-ai/qwen-image-2/pro/text-to-image': 0.035,
  'fal-ai/qwen-image-2/edit':              0.020,
  'fal-ai/qwen-image-2/pro/edit':          0.035,

  // ── fal.ai — upscale (per operation) ────────────────
  '_upscale_clarity':   0.040,   // Clarity Upscaler (rough)
  '_upscale_seedvr':    0.030,   // SeedVR2
  '_upscale_crisp':     0.025,   // Recraft Crisp

  // ── fal.ai — video (per SECOND, rough estimates) ────
  '_fal_video':         0.040,   // Generic fal.ai video fallback

  // ── xAI (per image) ─────────────────────────────────
  'grok-imagine-image': 0.070,

  // ── Luma — image (per image) ────────────────────────
  'photon-1':           0.032,   // Luma Photon
  'photon-flash-1':     0.016,   // Luma Photon Flash

  // ── Luma — video (per SECOND) ───────────────────────
  'ray-2':              0.071,   // Luma Ray 2 (~$0.355/5s)
  'ray-flash-2':        0.036,   // Luma Ray Flash 2

  // ── Freepik / Magnific — upscale (per operation) ────
  '_magnific':          0.100,
  '_mystic_1k':         0.010,   // Mystic 1K — estimated
  '_mystic_2k':         0.025,   // Mystic 2K — estimated
  '_mystic_4k':         0.060,   // Mystic 4K — estimated
  '_mystic':            0.025,   // Mystic default (2K)
  '_magnific_vid':      0.050,   // Magnific video upscaler per job — estimated

  // ── Topaz Labs — video upscale (per second of OUTPUT) ──
  // Pricing: ~12 frames/credit at 1080p; 1 credit ≈ $0.01
  // slp-2.5: 26 frames/credit @ 1080p → ~1.15 credits/s → ~$0.012/s
  // Rough per-second estimates for 1080p output:
  '_topaz_slp25':  0.012,  // Starlight Precise 2.5
  '_topaz_slp2':   0.012,  // Starlight Precise 2
  '_topaz_img':    0.005,  // Topaz image upscale (est. ~1 credit = $0.005 for typical 8MP output)
  '_topaz_slp1':   0.030,  // Starlight Precise 1 (more expensive)
  '_topaz_slhq':   0.012,  // Starlight HQ
  '_topaz_slm':    0.008,  // Starlight Mini

  // ── Replicate (per image) ────────────────────────────
  'wan-video/wan-2.7-image': 0.030,  // WAN 2.7 image
  '_replicate_wan27v_720p':  0.10,   // WAN 2.7 I2V 720p via Replicate (legacy)
  '_replicate_wan27v_1080p': 0.15,   // WAN 2.7 I2V 1080p via Replicate (legacy)
  '_replicate_wan27e_720p':  0.10,   // WAN 2.7 Edit 720p via Replicate (legacy)
  '_replicate_wan27e_1080p': 0.15,   // WAN 2.7 Edit 1080p via Replicate (legacy)

  // ── OpenRouter — Claude Sonnet 4.6 (per call) ──────
  '_or_prompt':   0.003,   // AI Prompt text (~500 in + 500 out tokens)
  '_or_describe': 0.010,   // Describe image (~1000 in + 500 out tokens)

  // WAN 2.7 via fal.ai (current) — pricing TBD, estimated ~same as WAN 2.6
  '_wan27_720p':   0.10,   // WAN 2.7 I2V/T2V 720p via fal.ai (estimate)
  '_wan27_1080p':  0.15,   // WAN 2.7 I2V/T2V 1080p via fal.ai (estimate)
  '_wan27e_720p':  0.10,   // WAN 2.7 Video Edit 720p via fal.ai (estimate)
  '_wan27e_1080p': 0.15,   // WAN 2.7 Video Edit 1080p via fal.ai (estimate)

  // ── PixVerse — video (per SECOND) ─────────────────────
  // C1 pricing: 720p no audio = 10 credits/s, $1 = 200 credits → $0.05/s
  '_pixverse_video': 0.050, // PixVerse C1 720p (default estimate)
};

const SPEND_PROVIDERS = ['google', 'fal', 'xai', 'luma', 'freepik', 'topaz', 'replicate', 'openrouter', 'pixverse'];

function _spendKey(provider) {
  return `gis_spend_${provider}`;
}

function getSpend(provider) {
  try {
    const raw = localStorage.getItem(_spendKey(provider));
    if (!raw) return { amount: 0, periodStart: null };
    return JSON.parse(raw);
  } catch(e) {
    return { amount: 0, periodStart: null };
  }
}

// Main tracking function.
// priceKey: model ID string, or a '_special' key from SPEND_PRICES
// count: number of images (default 1)
// durationSeconds: for video — price per second × duration; if set, count is ignored
function trackSpend(provider, priceKey, count = 1, durationSeconds = null) {
  const rate = SPEND_PRICES[priceKey];
  if (!rate) return; // unknown model — skip silently

  const amount = durationSeconds !== null
    ? rate * durationSeconds
    : rate * count;

  const current = getSpend(provider);
  const today = new Date().toISOString().slice(0, 10);
  const updated = {
    amount: (current.amount || 0) + amount,
    periodStart: current.periodStart || today,
  };
  localStorage.setItem(_spendKey(provider), JSON.stringify(updated));

  // Refresh UI if setup view is visible
  const setupView = document.getElementById('setupView');
  if (setupView && setupView.style.display !== 'none') {
    _renderSpendBlock(provider);
  }
}

function resetSpendPeriod(provider) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(_spendKey(provider), JSON.stringify({ amount: 0, periodStart: today }));
  _renderSpendBlock(provider);
}

function _renderSpendBlock(provider) {
  const el = document.getElementById(`spendBlock_${provider}`);
  if (!el) return;

  const { amount, periodStart } = getSpend(provider);
  const amountStr = (amount || 0).toFixed(3);
  const since = periodStart
    ? new Date(periodStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  el.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
      <div style="display:flex; align-items:baseline; gap:6px;">
        <span style="font-size:13px; font-weight:700; color:var(--fg); font-family:'IBM Plex Mono',monospace;">~$${amountStr}</span>
        <span style="font-size:10px; color:var(--dim); font-family:'IBM Plex Mono',monospace;">USD</span>
        <span style="font-size:10px; color:var(--dim2);">est. since ${since}</span>
      </div>
      <button onclick="resetSpendPeriod('${provider}')"
        style="font-size:10px; color:var(--dim); background:none; border:1px solid var(--border); padding:2px 9px; cursor:pointer; font-family:'IBM Plex Mono',monospace; letter-spacing:.04em; white-space:nowrap;"
        onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--dim)'">↺ Reset period</button>
    </div>
  `;
}

function initSpendingUI() {
  SPEND_PROVIDERS.forEach(p => _renderSpendBlock(p));
}
