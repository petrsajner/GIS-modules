// ═══════════════════════════════════════════════════════
// VIDEO — Topaz / Magnific video upscale (source mgmt + queue jobs)
// ═══════════════════════════════════════════════════════

let topazSrcVideoId    = null;   // Topaz/Magnific: source video gallery ID
// ── Topaz: source video management ──────────────────────
const _topazIds = { info:'topazSrcInfo', thumb:'topazSrcThumb', img:'topazSrcImg', meta:'topazSrcMeta', clearBtn:'topazSrcClearBtn', describeBtn:'topazSrcDescribeBtn' };
function topazClearSource() { topazSrcVideoId = null; _srcSlotClear(_topazIds); }
async function topazDescribeSource() { _srcSlotDescribe('topazSrcImg'); }

async function topazSetSource(videoId) {
  topazSrcVideoId = videoId;
  const { meta } = await _srcSlotSet(_topazIds, videoId);
  const metaEl = document.getElementById('topazSrcMeta');
  // Initial chips
  if (metaEl && meta) _renderTopazSrcMeta(metaEl, meta, null, null);
  // Async: load actual pixel dims + fps from video data
  if (metaEl && meta) {
    const full = await dbGet('videos', videoId).catch(() => null);
    if (full?.videoData) {
      const blob = new Blob([full.videoData], { type: full.mimeType || 'video/mp4' });
      const fps = _parseMp4Fps(full.videoData) || meta.params?.fps || meta.params?.topaz?.fps || null;
      const dims = await _topazGetDims(blob).catch(() => null);
      _renderTopazSrcMeta(metaEl, meta, dims?.w || null, dims?.h || null, fps);
      if (fps) {
        const fpsSel = document.getElementById('topazFps');
        if (fpsSel) {
          const opts = [24, 25, 30, 60, 90, 120];
          const snapped = opts.reduce((a, b) => Math.abs(b - fps) < Math.abs(a - fps) ? b : a);
          fpsSel.value = String(snapped);
        }
      }
    }
  }
}

function _renderTopazSrcMeta(metaEl, meta, w, h, detectedFps) {
  const resStr = w && h ? `${w}×${h}` : (meta.outWidth && meta.outHeight ? `${meta.outWidth}×${meta.outHeight}` : (meta.params?.resolution || null));
  const ar = meta.params?.aspectRatio || null;
  const dur = meta.duration ? `${meta.duration}s` : null;
  const fps = detectedFps || meta.params?.fps || meta.params?.topaz?.fps || null;
  const fpsStr = fps ? `${fps}fps` : null;
  const chips = [resStr, ar, dur, fpsStr].filter(Boolean);
  metaEl.innerHTML = chips.map(c =>
    `<span class="src-chip">${c}</span>`
  ).join('');
  metaEl.style.display = chips.length ? 'flex' : 'none';
}

async function topazPickFromGallery() {
  switchView('video');
  toast('Select a video, then click ✦ Topaz on it', 'ok');
}

// ── WAN 2.7 Video Edit: source video management ──────────
// Called from ✦ Topaz card button — selects source + switches to Topaz model in panel
async function openTopazFromGallery(videoId) {
  switchView('gen');
  setGenMode('video');
  // If a Magnific video model is already active, just set the source without switching
  const currentKey = getActiveVideoModelKey();
  if (MAGNIFIC_VIDEO_MODELS[currentKey]) {
    await topazSetSource(videoId);
    toast('✦ Source video set for Magnific — configure and click ▶ Upscale Video', 'ok');
    return;
  }
  // Select the default Topaz model directly in main select
  const defaultTopaz = TOPAZ_GROUPS['topaz']?.default || 'topaz_precise25';
  const sel = document.getElementById('videoModelSelect');
  if (sel && sel.value !== defaultTopaz) {
    sel.value = defaultTopaz;
    onVideoModelChange(defaultTopaz);
  } else if (sel) {
    // Already on a Topaz model — re-apply to ensure rows are correct
    onVideoModelChange(sel.value);
  }
  await topazSetSource(videoId);
  toast('✦ Source video set — configure and click ▶ Upscale Video', 'ok');
}


// ══════════════════════════════════════════════════════════
// TOPAZ VIDEO UPSCALE — Queue-based, non-blocking
// Topaz behaves like any other video model:
//   1. Select "Topaz Precise 2.5 / Precise 2 / Astra 1" in model select
//   2. Set source video via ✦ Topaz button or "Pick from gallery"
//   3. Configure resolution, fps, slowmo, creativity
//   4. Click ▶ Generate Video → job queued, returns immediately
//   5. Progress shown on placeholder card in output area
// ══════════════════════════════════════════════════════════

const TOPAZ_MODEL_NAMES = {
  'slp-2.5': 'Precise 2.5', 'slp-2': 'Precise 2', 'slp-1': 'Precise 1',
  'slhq': 'Starlight HQ', 'slm': 'Starlight Mini',
};

// ══════════════════════════════════════════════════════════
// MAGNIFIC VIDEO UPSCALER
// ══════════════════════════════════════════════════════════
async function _generateMagnificVideoJob(modelKey, freepikKey, proxyUrl) {
  // Re-use topazSrcVideoId for source selection (same ✦ Topaz button flow)
  if (!topazSrcVideoId) { toast('Set a source video — click ✦ Topaz on a video in the gallery', 'err'); return; }

  const mvm = MAGNIFIC_VIDEO_MODELS[modelKey];
  if (!mvm) { toast('Unknown Magnific video model', 'err'); return; }

  const srcMeta = await dbGet('video_meta', topazSrcVideoId).catch(() => null);
  if (!srcMeta) { toast('Source video not found in gallery', 'err'); return; }

  const resolution   = document.querySelector('input[name="magnificVidRes"]:checked')?.value || '2k';
  const fpsBost      = document.getElementById('magnificVidFps')?.checked || false;
  const sharpen      = parseInt(document.getElementById('magnificVidSharpen')?.value || '0');
  const smartGrain   = parseInt(document.getElementById('magnificVidGrain')?.value || '0');
  const creativity   = parseInt(document.getElementById('magnificVidCreativity')?.value || '50');
  const flavor       = document.querySelector('input[name="magnificVidFlavor"]:checked')?.value || 'vivid';
  const strength     = parseInt(document.getElementById('magnificVidStrength')?.value || '60');
  const vidPrompt    = document.getElementById('magnificVidPrompt')?.value?.trim() || '';
  const targetFolder = document.getElementById('videoTargetFolder')?.value || '';

  const jobId = `mgvid_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  const resLabel = resolution.toUpperCase();
  const job = {
    id: jobId, isMagnificVideo: true,
    srcId: topazSrcVideoId,
    srcDuration: srcMeta.duration || 5,
    magnificMode: mvm.mode,
    resolution, fpsBost, sharpen, smartGrain, creativity, flavor, strength, vidPrompt,
    freepikKey, proxyUrl,
    targetFolder: targetFolder === 'all' ? '' : targetFolder,
    status: 'pending', startedAt: Date.now(),
    model: { name: `✦ Magnific ${mvm.name}` },
    prompt: `Magnific ${mvm.name} · ${resLabel}${fpsBost ? ' · FPS Boost' : ''}`,
    duration: srcMeta.duration || 5,
  };

  videoJobs.push(job);
  videoShowPlaceholder(job);
  renderVideoQueue();
  toast(`✦ Magnific Video queued — ${mvm.name} · ${resLabel}`, 'ok');
  runMagnificVideoUpscaleJob(job).catch(e => videoJobError(job, e.message || 'Magnific Video failed'));
}

async function runMagnificVideoUpscaleJob(job) {
  updateVideoPlaceholderStatus(job, 'loading…');
  renderVideoQueue();

  const rec = await dbGet('videos', job.srcId).catch(() => null);
  if (!rec?.videoData) throw new Error('Source video not found in gallery');

  // Base64 encode video
  updateVideoPlaceholderStatus(job, 'encoding…');
  const videoB64 = _arrayBufferToBase64(rec.videoData);

  // Submit to proxy
  updateVideoPlaceholderStatus(job, 'uploading…');
  const submitResp = await fetch(`${job.proxyUrl}/magnific/video-upscale`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      freepik_key:   job.freepikKey,
      replicate_key: (localStorage.getItem('gis_replicate_apikey') || '').trim(),
      video_b64:     videoB64,
      mode:          job.magnificMode,
      resolution:    job.resolution,
      fps_boost:     job.fpsBost,
      sharpen:       job.sharpen,
      smart_grain:   job.smartGrain,
      creativity:    job.creativity,
      flavor:        job.flavor,
      strength:      job.strength,
      prompt:        job.vidPrompt || '',
    }),
  });
  if (!submitResp.ok) throw new Error(`Magnific Video submit: ${submitResp.status} ${await submitResp.text()}`);
  const { task_id } = await submitResp.json();
  if (!task_id) throw new Error('Magnific Video: no task_id');

  // Poll
  job.status = 'running';
  const upscalerType = job.magnificMode === 'precision' ? 'video_upscale_prec' : 'video_upscale';
  const POLL  = 10_000;
  const LIMIT = 48 * 60_000;
  const stop  = Date.now() + LIMIT;
  let elapsed = 0;

  while (Date.now() < stop) {
    await new Promise(r => setTimeout(r, POLL));
    elapsed += POLL;
    updateVideoPlaceholderStatus(job, `processing… ${Math.round(elapsed / 1000)}s`);

    const pollResp = await fetch(`${job.proxyUrl}/magnific/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freepik_key: job.freepikKey, task_id, upscaler_type: upscalerType }),
    });
    if (!pollResp.ok) continue;
    const pollData = await pollResp.json();

    if (pollData.status === 'failed') throw new Error(`Magnific Video failed: ${pollData.error}`);
    if (pollData.status === 'done') {
      updateVideoPlaceholderStatus(job, 'downloading…');
      const vidResp = await fetch(pollData.url);
      if (!vidResp.ok) throw new Error(`Download failed: ${vidResp.status}`);
      const videoArrayBuffer = await vidResp.arrayBuffer();
      const modelLabel = job.model.name;

      await _saveVideoResult(videoArrayBuffer, {
        model: modelLabel, modelKey: `magnific_video_${job.magnificMode}`, prompt: job.prompt,
        params: { magnific: { mode: job.magnificMode, resolution: job.resolution, fps_boost: job.fpsBost, sharpen: job.sharpen, smart_grain: job.smartGrain }, srcId: job.srcId },
        duration: job.srcDuration,
        folder: job.targetFolder || '',
      }, job, ['freepik', '_magnific_vid']);
      await refreshVideoGalleryUI();
      toast(`✦ Magnific Video done · ${modelLabel} · ${(videoArrayBuffer.byteLength/1024/1024).toFixed(1)}MB`, 'ok');
      return;
    }
  }
  throw new Error('Magnific Video: timeout — did not complete within time limit.');
}

async function _generateTopazJob(modelKey, proxyUrl) {
  const topazKey = localStorage.getItem('gis_topaz_apikey') || '';
  if (!topazKey) { showApiKeyWarning('Topaz API Key missing', 'Add your Topaz Labs API key in Setup → Topaz Labs API Key.'); return; }
  if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'Check Setup.'); return; }
  if (!topazSrcVideoId) { toast('Set a source video — click ✦ Topaz on a video in the gallery', 'err'); return; }

  const tm = TOPAZ_MODELS[modelKey];
  if (!tm) { toast('Unknown Topaz model', 'err'); return; }

  const res        = document.getElementById('topazResolution')?.value   || '1080p';
  const factor     = parseFloat(document.getElementById('topazFactor')?.value || '2');
  const fps        = parseInt(document.getElementById('topazFps')?.value   || '24');
  const slowmo     = parseInt(document.getElementById('topazSlowmo')?.value || '0');
  const creativity = tm.hasCreativity ? (document.getElementById('topazCreativity')?.value || 'medium') : undefined;
  const targetFolder = document.getElementById('videoTargetFolder')?.value || '';

  // Load source meta to get dimensions
  const srcMeta = await dbGet('video_meta', topazSrcVideoId).catch(() => null);
  if (!srcMeta) { toast('Source video not found in gallery', 'err'); return; }

  // Always load source dimensions (needed for Topaz source.resolution)
  const full = await dbGet('videos', topazSrcVideoId).catch(() => null);
  let srcW = srcMeta.outWidth || 1920, srcH = srcMeta.outHeight || 1080;
  if (full?.videoData) {
    const blob = new Blob([full.videoData], { type: 'video/mp4' });
    const dims = await _topazGetDims(blob).catch(() => null);
    if (dims?.w) { srcW = dims.w; srcH = dims.h; }
  }

  // Compute output dimensions
  let outW, outH;
  if (tm.hasFactor) {
    outW = Math.round(srcW * factor);
    outH = Math.round(srcH * factor);
  } else {
    if (res === '4k') { outW = 3840; outH = 2160; }
    else              { outW = 1920; outH = 1080; }
  }

  const jobId = `tpz_${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  const job = {
    id: jobId, isTopaz: true,
    srcId: topazSrcVideoId, srcDuration: srcMeta.duration || 5, srcFileSize: srcMeta.fileSize || 0,
    srcWidth: srcW, srcHeight: srcH,  // source dims for Topaz API
    topazModel: tm.apiModel, topazModelKey: modelKey,
    factor, fps, slowmo, creativity, out_width: outW, out_height: outH,
    resolution: res, topazKey, proxyUrl,
    targetFolder: targetFolder === 'all' ? '' : targetFolder,
    status: 'pending', startedAt: Date.now(),
    model: { name: `✦ Topaz ${TOPAZ_MODEL_NAMES[tm.apiModel] || tm.apiModel}` },
    prompt: `Topaz ${tm.name} · ${outW}×${outH} · ${fps}fps${slowmo ? ` · ${slowmo}× slow motion` : ''}`,
    duration: srcMeta.duration || 5,
  };

  videoJobs.push(job);
  videoShowPlaceholder(job);
  renderVideoQueue();
  toast(`✦ Topaz queued — ${tm.name} · ${outW}×${outH}`, 'ok');

  // Run in background — non-blocking
  runTopazQueueJob(job).catch(e => videoJobError(job, e.message || 'Topaz failed'));
}

// ── MP4 FPS parser — reads moov→trak→mdia→mdhd + stts atoms ─
// Synchronous, works on ArrayBuffer directly from IndexedDB.
// Returns fps as number (e.g. 24, 25, 29.97) or null if not found.

async function runTopazQueueJob(job) {
  updateVideoPlaceholderStatus(job, 'loading…');
  renderVideoQueue();

  const rec = await dbGet('videos', job.srcId).catch(() => null);
  if (!rec?.videoData) throw new Error('Source video not found in gallery');

  // Base64 encode video
  updateVideoPlaceholderStatus(job, 'encoding…');
  const videoB64 = _arrayBufferToBase64(rec.videoData);

  updateVideoPlaceholderStatus(job, 'uploading…');
  renderVideoQueue();

  // Submit with retry — transient S3/502 errors are common on Topaz infra
  const SUBMIT_RETRIES = 3;
  const SUBMIT_DELAY   = 5_000;
  let submitData = null;
  for (let attempt = 1; attempt <= SUBMIT_RETRIES; attempt++) {
    if (attempt > 1) {
      updateVideoPlaceholderStatus(job, `uploading… retry ${attempt}/${SUBMIT_RETRIES}`);
      await new Promise(r => setTimeout(r, SUBMIT_DELAY));
    }
    const submitResp = await fetch(`${job.proxyUrl}/topaz/video/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topaz_key:   job.topazKey,
        model:       job.topazModel,
        slowmo:      job.slowmo || 0,
        fps:         job.fps || 24,
        creativity:  job.creativity,
        out_width:   job.out_width,
        out_height:  job.out_height,
        src_width:    job.srcWidth  || 1920,
        src_height:   job.srcHeight || 1080,
        src_size:     job.srcFileSize || 0,
        src_duration: job.srcDuration,
        video_b64:   videoB64,
      }),
    });
    if (submitResp.ok) {
      submitData = await submitResp.json();
      break;
    }
    const e = await submitResp.json().catch(() => ({}));
    const msg = e.error || submitResp.statusText;
    if (attempt === SUBMIT_RETRIES) throw new Error(`Topaz submit: ${msg}`);
    console.warn(`Topaz submit attempt ${attempt} failed (${msg}), retrying…`);
  }
  const { request_id } = submitData;
  if (!request_id) throw new Error('Topaz: no request_id in response');
  job.topazRequestId = request_id;

  // Poll
  job.status = 'running';
  const POLL   = 15_000;
  const LIMIT  = 30 * 60_000;
  const stop   = Date.now() + LIMIT;
  let   count  = 0;

  while (Date.now() < stop) {
    await new Promise(r => setTimeout(r, POLL));
    count++;

    const sr = await fetch(`${job.proxyUrl}/topaz/video/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topaz_key: job.topazKey, request_id }),
    });
    if (!sr.ok) { const e = await sr.json().catch(() => ({})); throw new Error(`Status error: ${e.error || sr.statusText}`); }
    const { status, raw_status, output_url, progress } = await sr.json();

    const isFailed = status === 'failed' || status === 'error' ||
      (raw_status && raw_status.toLowerCase().includes('fail'));
    if (isFailed) throw new Error(`Topaz failed [${raw_status || status}]`);

    const pct   = progress != null ? Math.min(Math.round(progress), 99) : null;
    const label = raw_status ? ` [${raw_status}]` : '';
    const pctLabel = pct != null ? ` ${pct}%` : '';
    updateVideoPlaceholderStatus(job, `${Math.round(count*15/60)}min${pctLabel}${label}`);
    renderVideoQueue();

    const done = !!output_url || ['done','complete','completed','success','finished'].includes(status);
    if (done && output_url) {
      // Download via Worker proxy (R2 output bucket blocks direct browser access)
      updateVideoPlaceholderStatus(job, 'downloading…');
      const dlResp = await fetch(`${job.proxyUrl}/topaz/video/download`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ output_url }),
      });
      if (!dlResp.ok) {
        const e = await dlResp.json().catch(() => ({}));
        throw new Error(`Download failed ${dlResp.status}: ${e.error || dlResp.statusText}`);
      }
      const totalBytes = parseInt(dlResp.headers.get('Content-Length') || '0');
      const reader = dlResp.body.getReader();
      const chunks = []; let received = 0;
      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        chunks.push(value); received += value.length;
        const mb  = (received/1024/1024).toFixed(1);
        const tot = totalBytes ? `/${(totalBytes/1024/1024).toFixed(0)}` : '';
        updateVideoPlaceholderStatus(job, `↓ ${mb}${tot}MB`);
      }
      const videoArrayBuffer = await new Blob(chunks).arrayBuffer();
      const modelLabel = `✦ Topaz ${TOPAZ_MODEL_NAMES[job.topazModel] || job.topazModel}`;
      const spendKey = { 'slp-2.5':'_topaz_slp25','slp-2':'_topaz_slp2','slp-1':'_topaz_slp1','slhq':'_topaz_slhq','slm':'_topaz_slm' }[job.topazModel] || '_topaz_slp25';

      await _saveVideoResult(videoArrayBuffer, {
        model: modelLabel, modelKey: `topaz_${job.topazModel}`, prompt: job.prompt,
        params: { topaz: { model: job.topazModel, fps: job.fps, slowmo: job.slowmo, creativity: job.creativity, factor: job.factor }, srcId: job.srcId },
        duration: job.srcDuration,
        outWidth: job.out_width, outHeight: job.out_height,
        folder: job.targetFolder || '',
      }, job, ['topaz', spendKey, 1, job.srcDuration]);
      await refreshVideoGalleryUI();
      toast(`✦ Topaz done · ${modelLabel} · ${(videoArrayBuffer.byteLength/1024/1024).toFixed(1)}MB`, 'ok');
      return;
    }
  }
  throw new Error('Topaz timeout — exceeded 30 minutes');
}
