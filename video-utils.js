// ═══════════════════════════════════════════════════════
// VIDEO — utilities (pure helpers, no state, no DOM)
// ═══════════════════════════════════════════════════════

// Central polling & timeout constants (v206en cleanup #8).
// Used by all video handlers — central place for tuning API latency response.
const VIDEO_POLL = Object.freeze({
  // Default poll interval (ms) between status checks
  defaultMs:  5000,
  // Off-peak slow mode (PixVerse off-peak processing)
  offPeakMs:  15000,
  // Total timeout per provider, in minutes
  timeoutMin: Object.freeze({
    fal:              20,   // Default fal video (Kling, Vidu, Hailuo)
    falLong:          25,   // Longer-format fal (WAN 2.7, Seedance 2.0 — up to 15s)
    falEdit:          30,   // Edit/V2V fal (WAN 2.7 Edit — longer processing)
    veo:              15,   // Google Veo (predictLongRunning)
    luma:             20,   // Luma Ray
    grok:             15,   // xAI Grok Video
    pixverse:         20,   // PixVerse C1 (standard)
    pixverseOffPeak:  120,  // PixVerse off-peak = 2 hours
    topaz:            30,   // Topaz video upscale
    magnific:         48,   // Magnific video upscale (slower — high-res refinement)
  }),
});

// ── Shared: extract video URL from fal.ai response object ──
function _extractFalVideoUrl(obj) {
  return obj?.output?.video?.url || obj?.output?.url || obj?.video?.url || obj?.data?.video?.url || null;
}

// Delegates to _compressRefToJpeg (fal.js) — same logic, single implementation
async function compressImageForUpload(base64, mimeType) {
  return _compressRefToJpeg({ data: base64, mimeType }, 2560);
}

// ── Google Veo video generation ──────────────────────────
// Uses Gemini API (same key as NB2/Imagen) — no proxy needed.
// IMPORTANT: generateAudio is NOT sent — Gemini API Veo generates audio
// automatically; the field is not supported and causes 400 errors.
// Pattern: POST :predictLongRunning → poll operations/xyz → download MP4
// ── Thumbnail generation ─────────────────────────────────
async function generateVideoThumb(blob) {
  return new Promise(resolve => {
    // v226en: overall safety timeout raised from 8s → 15s.  Complex videos
    // (1080p, 15s+, 5MB+) can take longer than 8s to fully load metadata
    // and reach a seek point, especially on slower systems or while the UI
    // is mid-generation.  A null thumb from premature timeout showed up as
    // a "broken video" clapperboard icon in the library.
    const TIMEOUT = 15000;
    const timer = setTimeout(() => { cleanup(); resolve(null); }, TIMEOUT);
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    let seekAttempt = 0;
    let seekedFired = false;
    let captureDone = false;
    // v226en: widened seek points (4 instead of 3) to better cover videos with
    // long fade-ins or dark openings.  0.5s catches fast-start clips, 1.0s and
    // 2.0s catch typical scene starts, 0.2s is a last-ditch early frame.
    const seekTimes = [0.5, 1.0, 2.0, 0.2];

    function cleanup() {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }

    function captureFrame() {
      if (captureDone) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320; canvas.height = 180;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 320, 180);
        // Black-frame detection: sample center pixels
        const sample = ctx.getImageData(140, 70, 40, 40).data;
        let bright = 0;
        for (let i = 0; i < sample.length; i += 4) bright += sample[i] + sample[i+1] + sample[i+2];
        const avgBright = bright / (sample.length / 4 * 3);
        // v226en: threshold raised from 8 to 12 — avg brightness <8 treated
        // genuinely dark source as black.  12 still catches near-black frames
        // while giving legitimately-dark content (e.g., night scenes) a chance.
        if (avgBright < 12 && seekAttempt < seekTimes.length - 1) {
          // Too dark — try next seek point
          seekAttempt++;
          video.currentTime = Math.min(seekTimes[seekAttempt], video.duration * 0.5);
          return; // onseeked will fire again
        }
        captureDone = true;
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch(e) { captureDone = true; cleanup(); resolve(null); }
    }

    video.onloadeddata = () => {
      video.currentTime = Math.min(seekTimes[0], video.duration * 0.5);
      // v226en: safety fallback — some browsers/codecs never fire 'seeked' for
      // certain videos (happens with some MP4 profiles).  After 3s waiting for
      // seeked, capture whatever's currently on the video element.  If even
      // that is black, at least we return something rather than null.
      setTimeout(() => {
        if (seekedFired || captureDone) return;
        captureFrame();
      }, 3000);
    };
    // v226en: small delay after seek before capturing — some browsers fire
    // 'seeked' before the frame is actually painted, yielding a black canvas
    // for the first attempt.  50ms is imperceptible but covers the gap.
    video.onseeked = () => { seekedFired = true; setTimeout(captureFrame, 50); };
    video.onerror = () => { captureDone = true; cleanup(); resolve(null); };
    video.src = url;
  });
}

// Returns structured info string: "1920×1080 · 24fps · 5s · 10.8MB"
function _videoInfoLine(rec) {
  const parts = [];
  // Resolution — pixel dims preferred, fallback to string label
  const w = rec.outWidth, h = rec.outHeight;
  if (w && h)                         parts.push(`${w}×${h}`);
  else if (rec.params?.resolution)    parts.push(rec.params.resolution);
  // FPS
  const fps = rec.params?.fps || rec.params?.topaz?.fps;
  if (fps) parts.push(`${fps}fps`);
  // Duration + size
  if (rec.duration) parts.push(`${rec.duration}s`);
  if (rec.fileSize) parts.push(`${(rec.fileSize/1024/1024).toFixed(1)}MB`);
  return parts.join(' · ');
}

function _videoDateStr(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en');
}

// Builds friendly error message — video-specific + delegates to image friendlyError.
//
// Guideline (v206en cleanup #11):
//   - Handlery (callVeoVideo, callLumaVideo, ...) throw RAW technical errors
//     (e.g. "Luma submit 400: bad request", "Veo result fetch failed: 500").
//   - videoJobError() is the single entry point that friendly-ifies via this fn.
//   - Do NOT pre-format friendly messages in handlers — that defeats the mapping.
function friendlyVideoError(raw) {
  if (!raw) return 'Video generation failed. Please try again.';
  const m = raw.toString();

  // Video-specific errors
  if (/no video url|no video in result/i.test(m))       return 'No video returned — server may have filtered it';
  if (/source video.*not found|video data not found/i.test(m)) return 'Source video missing — re-add it and try again';
  if (/no source video|select a source video/i.test(m)) return 'Source video required — use ▷ on a video in gallery';
  if (/start frame.*required|no.*start.*frame/i.test(m)) return 'Start frame image required for I2V';
  if (/prompt.*required|prompt.*must be provided/i.test(m)) return 'Prompt required for this model';
  if (/missing prompt/i.test(m))                        return 'Prompt required — enter a description';
  if (/audio.*cost|generate_audio/i.test(m))            return 'Audio setting error — try again';
  if (/result fetch failed.*422/i.test(m))              return 'Server rejected payload (422) — check model settings';
  if (/submit.*422/i.test(m))                           return 'Server rejected request (422) — check model settings';
  if (/luma submit 400/i.test(m))                       return m.replace(/^Luma submit \d+:\s*/, '');
  if (/download.*404|video.*404/i.test(m))              return 'Video download failed — result may have expired';
  // Generic timeout matcher — covers 10/15/20/25/30 min + "2 hours" (PixVerse off-peak)
  if (/timeout.*\d+\s*(min|hour)|deadline/i.test(m))    return 'No result after timeout — server is slow, try Rerun';
  if (/cancelled/i.test(m))                             return 'Cancelled';

  // Delegate to image friendlyError for generic API/network errors
  return friendlyError(raw);
}

function _parseMp4Fps(buffer) {
  if (!buffer || buffer.byteLength < 8) return null;
  try {
    const v = new DataView(buffer);
    const u32 = o => v.getUint32(o);
    const u8  = o => v.getUint8(o);
    const str = o => String.fromCharCode(u8(o),u8(o+1),u8(o+2),u8(o+3));
    const sz  = buffer.byteLength;

    function findBox(type, start, end) {
      let p = start;
      while (p + 8 <= end) {
        const s = u32(p); if (s < 8) break;
        if (str(p+4) === type) return { start: p, ds: p+8, end: Math.min(p+s, end) };
        p += s;
      }
      return null;
    }

    const moov = findBox('moov', 0, sz);
    if (!moov) return null;

    // Iterate trak boxes — find the video track (has vmhd inside minf)
    let tp = moov.ds;
    while (tp + 8 <= moov.end) {
      const s = u32(tp); if (s < 8) break;
      if (str(tp+4) === 'trak') {
        const trak = { ds: tp+8, end: Math.min(tp+s, moov.end) };
        const mdia = findBox('mdia', trak.ds, trak.end);
        if (mdia) {
          const minf = findBox('minf', mdia.ds, mdia.end);
          if (minf && findBox('vmhd', minf.ds, minf.end)) {
            // Video track confirmed — read timescale from mdhd
            const mdhd = findBox('mdhd', mdia.ds, mdia.end);
            if (mdhd) {
              const ver = u8(mdhd.ds);
              const timescale = ver === 1 ? u32(mdhd.ds+20) : u32(mdhd.ds+12);
              // Read stts for sample duration
              const stbl = findBox('stbl', minf.ds, minf.end);
              if (stbl) {
                const stts = findBox('stts', stbl.ds, stbl.end);
                if (stts && u32(stts.ds+4) > 0) {
                  const dur = u32(stts.ds+12); // first entry sample_delta
                  if (dur > 0 && timescale > 0) {
                    const fps = timescale / dur;
                    // Snap to common frame rates
                    const common = [23.976,24,25,29.97,30,48,50,59.94,60];
                    const snapped = common.reduce((a,b) => Math.abs(b-fps)<Math.abs(a-fps)?b:a);
                    return Math.abs(snapped-fps) < 0.5 ? snapped : Math.round(fps*100)/100;
                  }
                }
              }
            }
          }
        }
      }
      tp += s;
    }
  } catch(_) {}
  return null;
}

function _topazGetDims(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const el  = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => { const w = el.videoWidth, h = el.videoHeight; URL.revokeObjectURL(url); el.src = ''; resolve({ w, h }); };
    el.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 0, h: 0 }); };
    el.src = url;
  });
}

// Does this model's provider API accept a `seed` parameter?
// Verified against fal.ai / provider docs.  Single source — used by UI
// visibility (video-models), generate payloads (video-queue), and reuse
// (video-gallery).
function supportsSeed(model) {
  if (!model) return false;
  const t = model.type;
  return t === 'pixverse_video'
      || t === 'wan27_video'
      || t === 'wan27e_video'
      || t === 'seedance2_video'
      || t === 'wan_video'
      || t === 'seedance_video'
      || t === 'vidu_video';
}

// Does this model's provider API accept a safety-checker flag?
// Currently WAN 2.6 + 2.7 + 2.7-Edit; Kling/Luma/Veo/Grok/Seedance/Vidu don't
// expose it.  (WAN 2.6 accepts it per fal docs but GIS doesn't wire UI yet.)
function supportsSafety(model) {
  if (!model) return false;
  const t = model.type;
  return t === 'wan27_video'
      || t === 'wan27e_video';
}

// Number of audio URL slots to show for this model (0 = hide row).
// WAN 2.7 R2V: 1 BG audio.  Seedance 2.0 R2V: 3 audio refs.
function audioSlots(model) {
  if (!model) return 0;
  const t = model.type;
  if (t === 'wan27_video'     && model.refMode === 'wan_r2v')       return 1;
  if (t === 'seedance2_video' && model.refMode === 'seedance2_r2v') return 3;
  return 0;
}

// Does this model type ever accept a source/motion video input?
// Grok runtime mode gating happens in _vpApplyUnifiedLayer, not here.
function supportsSourceVideo(model) {
  if (!model) return false;
  const t = model.type;
  if (t === 'wan27e_video')                                  return true;  // Edit
  if (t === 'wan27_video'  && model.refMode === 'single_end') return true; // I2V extend
  if (t === 'grok_video')                                    return true;  // V2V/Edit/Extend
  if (t === 'kling_video'  && model.refMode === 'video_ref') return true;  // Motion Control
  return false;
}

function sourceVideoLabel(model) {
  if (!model) return 'Source Video';
  const t = model.type;
  if (t === 'kling_video' && model.refMode === 'video_ref') return 'Motion Video';
  if (t === 'wan27_video') return 'Extend Video';
  return 'Source Video';
}

// Kling motion control is the only model accepting file upload of motion video.
function sourceVideoSupportsUpload(model) {
  return !!(model && model.type === 'kling_video' && model.refMode === 'video_ref');
}
