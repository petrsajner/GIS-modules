// ═══════════════════════════════════════════════════════
// VIDEO — job queue, submit entry, dispatch, placeholder/result cards
// ═══════════════════════════════════════════════════════

let videoJobs = [];           // active generation jobs
// ── Shared: save video result to DB + update UI ─────────────────────────────
// videoArrayBuffer: raw MP4 data
// recordFields: model-specific fields merged into the record
//   Required: model, modelKey, prompt, params, duration
//   Optional: cdnUrl, cdnExpiry, exrUrl, usedVideoRefs, outWidth, outHeight, folder
// job: the video job object (for UI updates)
// spendArgs: [provider, priceKey, count?, durationSec?] for trackSpend
async function _saveVideoResult(videoArrayBuffer, recordFields, job, spendArgs) {
  const blob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
  const thumbData = await generateVideoThumb(blob);
  const dims = await _topazGetDims(blob).catch(() => null);
  const detectedFps = _parseMp4Fps(videoArrayBuffer);

  const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
  job.status = 'done';
  job.elapsed = `${elapsed}s`;

  // Auto-merge fps into params if detected
  // Fáze 7: unified schema from job.params (set by buildVideoParams) is the
  // base; handler-supplied recordFields.params override any field.  This
  // guarantees reuse sees a complete params object regardless of whether
  // the handler has been individually refactored.
  const params = {
    ...(job.params || {}),
    ...(recordFields.params || {}),
  };
  if (detectedFps && !params.fps) params.fps = detectedFps;

  const videoRecord = {
    id: videoId,
    ts: Date.now(),
    model: recordFields.model,
    modelKey: recordFields.modelKey,
    prompt: recordFields.prompt || job.prompt,
    params,
    videoData: videoArrayBuffer,
    mimeType: 'video/mp4',
    duration: recordFields.duration,
    fileSize: videoArrayBuffer.byteLength,
    // Dims: explicit outWidth/outHeight override auto-detected
    ...(recordFields.outWidth ? { outWidth: recordFields.outWidth, outHeight: recordFields.outHeight }
      : dims?.w ? { outWidth: dims.w, outHeight: dims.h } : {}),
    folder: recordFields.folder ?? (job.targetFolder === 'all' ? '' : job.targetFolder),
    favorite: false,
    ...(recordFields.cdnUrl ? { cdnUrl: recordFields.cdnUrl, cdnExpiry: recordFields.cdnExpiry || (Date.now() + 7*24*60*60*1000) } : {}),
    ...(recordFields.exrUrl ? { exrUrl: recordFields.exrUrl } : {}),
    ...(recordFields.usedVideoRefs ? { usedVideoRefs: recordFields.usedVideoRefs } : { usedVideoRefs: job.videoRefsSnapshot || [] }),
  };

  await dbPut('videos', videoRecord);
  const { videoData, ...metaOnly } = videoRecord;
  await dbPut('video_meta', metaOnly);
  if (thumbData) await dbPut('video_thumbs', { id: videoId, data: thumbData });
  if (spendArgs) trackSpend(...spendArgs);

  renderVideoQueue();
  // Replace placeholder in-place (don't remove + prepend — keeps card position)
  const placeholderEl = document.getElementById(`vphold_${job.id}`);
  renderVideoResultCard(videoRecord, thumbData, placeholderEl);
  return { videoId, elapsed, thumbData };
}

// ── Shared: fal.ai video queue submit → poll → download ─────────────────────
// Submits payload to fal.ai queue, polls until complete, downloads video.
// Returns: videoArrayBuffer (ArrayBuffer)
// opts: { label, timeoutMin, pollMs, progressLabel }
async function _falVideoSubmitPollDownload(falKey, endpoint, payload, job, opts = {}) {
  const { label = 'Video', timeoutMin = VIDEO_POLL.timeoutMin.fal, pollMs = VIDEO_POLL.defaultMs, progressLabel = 'GENERATING' } = opts;
  const queueUrl = `https://queue.fal.run/${endpoint}`;

  // Submit
  job.status = 'queued'; renderVideoQueue();
  const submitRes = await fetch(queueUrl, {
    method: 'POST',
    headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => '');
    throw new Error(`${label} submit ${submitRes.status}: ${errText.slice(0, 300)}`);
  }
  const submitted = await submitRes.json();
  const requestId = submitted.request_id;
  if (!requestId) throw new Error(`${label}: no request_id. Response: ${JSON.stringify(submitted).slice(0, 200)}`);

  job.requestId = requestId;
  job.status = 'queued'; renderVideoQueue();
  updateVideoPlaceholderStatus(job, 'IN QUEUE…');

  const statusUrl   = submitted.status_url   || `${queueUrl}/requests/${requestId}/status`;
  const responseUrl = submitted.response_url || `${queueUrl}/requests/${requestId}`;
  const TIMEOUT = timeoutMin * 60 * 1000;
  const deadline = Date.now() + TIMEOUT;
  let completedData = null;

  // Poll
  await new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() > deadline) { reject(new Error(`${label}: timeout after ${timeoutMin} minutes`)); return; }
      if (job.cancelled) { reject(new Error('Cancelled')); return; }
      try {
        const st = await fetch(statusUrl, { headers: { 'Authorization': `Key ${falKey}` } });
        if (!st.ok) { setTimeout(poll, pollMs); return; }
        const s = await st.json();
        const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
        if (s.status === 'IN_QUEUE')         { updateVideoPlaceholderStatus(job, `IN QUEUE · ${elapsed}s`); }
        else if (s.status === 'IN_PROGRESS') { job.status = 'running'; renderVideoQueue(); updateVideoPlaceholderStatus(job, `${progressLabel} · ${elapsed}s`); }
        else if (s.status === 'COMPLETED')   { completedData = s; resolve(); return; }
        else if (s.status === 'FAILED')      { reject(new Error(s.error || 'Generation failed')); return; }
        setTimeout(poll, pollMs);
      } catch(e) { setTimeout(poll, pollMs); }
    };
    setTimeout(poll, pollMs);
  });

  // Extract video URL
  job.status = 'fetching';
  updateVideoPlaceholderStatus(job, 'DOWNLOADING…');
  let videoUrl = _extractFalVideoUrl(completedData);

  if (!videoUrl) {
    try {
      const r = await fetch(responseUrl, { headers: { 'Authorization': `Key ${falKey}` } });
      if (r.ok) videoUrl = _extractFalVideoUrl(await r.json());
      else {
        const body = await r.text().catch(() => '');
        throw new Error(`${label} result fetch ${r.status}: ${body.slice(0, 400)}`);
      }
    } catch(e) { if (e.message.includes('result fetch')) throw e; }
  }
  if (!videoUrl) throw new Error(`${label}: no video URL in result. Job: ${requestId}`);

  // Download
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`${label} video download ${videoRes.status}`);
  const buffer = await videoRes.arrayBuffer();
  return { buffer, cdnUrl: videoUrl };
}

// ═══════════════════════════════════════════════════════
// Generic video polling loop (v206en cleanup #3)
// Used by: callLumaVideo, callGrokVideo, callPixverseVideo
// (Veo + Kling/Seedance/WAN have different shapes — not used there.)
//
// adapter = {
//   label:          string              // error prefix, e.g. "Luma video"
//   timeoutMin:     number              // minutes until timeout
//   pollMs:         number              // interval between status checks
//   progressLabel?: string              // default "GENERATING"
//   poll:           async () => result
// }
//
// Poll result shape:
//   { status: 'queued' }                → placeholder: "IN QUEUE · Ns"
//   { status: 'running', progressText? }→ placeholder: progressText or "GENERATING · Ns"
//   { status: 'done',    data }         → returns data
//   { status: 'failed',  error? }       → throws
//
// Throws on timeout or job.cancelled.
// ═══════════════════════════════════════════════════════
async function _videoPollLoop(job, adapter) {
  const { label, timeoutMin, pollMs, progressLabel = 'GENERATING', poll } = adapter;
  const deadline = Date.now() + timeoutMin * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollMs));
    if (job.cancelled) throw new Error('Cancelled');
    const result = await poll();
    const elapsed = Math.round((Date.now() - job.startedAt) / 1000);
    if (result.status === 'done')    return result.data;
    if (result.status === 'failed')  throw new Error(result.error || `${label} failed`);
    if (result.status === 'queued')  updateVideoPlaceholderStatus(job, `IN QUEUE · ${elapsed}s`);
    else /* running */               updateVideoPlaceholderStatus(job, result.progressText || `${progressLabel} · ${elapsed}s`);
  }
  throw new Error(`${label} timeout — generation did not complete within ${timeoutMin} minutes`);
}

// ═══════════════════════════════════════════════════════
// VIDEO SOURCE SLOT — Generic helpers for source video panels
// Used by: Topaz, WAN 2.7 Edit, WAN 2.7 I2V extend, V2V Motion
// ═══════════════════════════════════════════════════════
// ids: { info, thumb, img, meta, clearBtn, describeBtn }
// ── Generate video ───────────────────────────────────────
async function generateVideo() {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    toast('Application integrity check failed. Please use the original GIS.', 'err');
    return;
  }
  const falKey = document.getElementById('fluxApiKey')?.value?.trim() || '';
  const googleKey = document.getElementById('apiKey')?.value?.trim() || localStorage.getItem('gis_apikey') || '';
  const lumaKey  = (localStorage.getItem('gis_luma_apikey') || '').trim();
  const proxyUrl = getProxyUrl();

  // ── Topaz dispatch ──────────────────────────────────────
  const activeKey = getActiveVideoModelKey();
  if (TOPAZ_MODELS[activeKey]) {
    await _generateTopazJob(activeKey, proxyUrl);
    return;
  }
  // ── Magnific Video dispatch ──────────────────────────────
  if (MAGNIFIC_VIDEO_MODELS[activeKey]) {
    const freepikKey = (localStorage.getItem('gis_freepik_apikey') || '').trim();
    if (!freepikKey) { showApiKeyWarning('Freepik API Key missing', 'Magnific Video requires a Freepik API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl)   { showApiKeyWarning('Proxy URL missing', 'Magnific Video requires the GIS proxy URL. Add it in the Setup tab.'); return; }
    await _generateMagnificVideoJob(activeKey, freepikKey, proxyUrl);
    return;
  }
  // ───────────────────────────────────────────────────────

  const modelKey = getActiveVideoModelKey();
  const model = VIDEO_MODELS[modelKey];
  if (!model) { toast('Select a video model', 'err'); return; }

  // Key validation per model type
  if (model.type === 'veo') {
    if (!googleKey) { showApiKeyWarning('Google API Key missing', 'Veo requires a Google AI API key. Add it in the Setup tab.'); return; }
  } else if (model.type === 'luma_video') {
    if (!lumaKey)  { showApiKeyWarning('Luma API Key missing', 'Ray3 / Ray3.14 requires a Luma API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'Luma video requires the GIS proxy URL. Add it in the Setup tab.'); return; }
  } else if (model.type === 'pixverse_video') {
    const pvKey = (localStorage.getItem('gis_pixverse_apikey') || '').trim();
    if (!pvKey)    { showApiKeyWarning('PixVerse API Key missing', 'PixVerse C1 requires a PixVerse API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'PixVerse C1 requires the GIS proxy URL. Add it in the Setup tab.'); return; }
  } else if (model.type === 'wan27_video') {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'WAN 2.7 requires a fal.ai API key. Add it in the Setup tab.'); return; }
  } else if (model.type === 'wan27e_video') {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'WAN 2.7 Video Edit requires a fal.ai API key. Add it in the Setup tab.'); return; }
    if (!wan27eSrcVideoId) { toast('Select a source video first — click ▷ Use on any video in the gallery', 'err'); return; }
  } else if (model.type === 'grok_video') {
    const xaiKey = (localStorage.getItem('gis_xai_apikey') || '').trim();
    if (!xaiKey)   { showApiKeyWarning('xAI API Key missing', 'Grok Video requires an xAI API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'Grok Video requires the GIS proxy URL. Add it in the Setup tab.'); return; }
  } else {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'Video generation requires a fal.ai API key. Add it in the Setup tab to start generating.'); return; }
  }

  const rawVideoPrompt = document.getElementById('videoPrompt')?.value?.trim();
  const refMode = model.refMode || 'none';
  // Most models with start/end frames support generation without prompt
  // EXCEPTIONS: Luma (API hard-requires prompt) and Kling via fal.ai (same)
  const veoFramesMode = model.type === 'veo' &&
    document.getElementById('veoRefMode')?.value === 'frames';
  const promptOptional = veoFramesMode ||
    (model.type !== 'luma_video' && model.type !== 'kling_video' && model.type !== 'pixverse_video' &&
     (refMode === 'single_end' || refMode === 'single' || refMode === 'keyframe' ||
      refMode === 'wan_r2v' || refMode === 'seedance2_r2v' || refMode === 'multi'));
  if (!rawVideoPrompt && !promptOptional) { toast('Enter a prompt', 'err'); return; }
  // Append style + camera suffix
  const vStyleSuffix = buildStyleSuffix('flux');
  const vCameraSuffix = buildCameraSuffix();
  const vExtra = [vStyleSuffix, vCameraSuffix].filter(Boolean).join(', ');
  const prompt = vExtra ? (rawVideoPrompt ? rawVideoPrompt + ', ' + vExtra : vExtra) : rawVideoPrompt;

  // Validate refs based on refMode
  // (refMode already declared above)
  // Veo + Luma: refs are optional — 0 refs = T2V, 1+ refs = I2V/Keyframes automatically
  // wan27_r2v: refs optional (image_urls + video_urls)
  if ((refMode === 'single' || refMode === 'single_end') && videoRefs.length === 0 && model.type !== 'veo' && model.type !== 'luma_video' && model.type !== 'wan27e_video' && model.refMode !== 'wan_r2v') {
    toast('Start frame image required for I2V', 'err'); return;
  }
  if (refMode === 'keyframe' && videoRefs.length < 2) {
    toast(`Both start and end frames required (have ${videoRefs.length}/2)`, 'err'); return;
  }
  if (refMode === 'video_ref' && !videoMotionFile && !videoMotionVideoId) {
    toast('Upload or pick a motion reference video for Motion Control', 'err'); return;
  }

  // V2V: upload motion video to R2 before submitting jobs
  let motionVideoUrl = null;
  if (refMode === 'video_ref' && (videoMotionFile || videoMotionVideoId)) {
    toast('Uploading motion video…', 'ok');
    try {
      if (videoMotionFile) {
        motionVideoUrl = await uploadVideoToFal(videoMotionFile, falKey);
      } else {
        // Gallery pick — load binary from DB and upload to R2
        const full = await dbGet('videos', videoMotionVideoId);
        if (!full?.videoData) throw new Error('Video data not found in gallery');
        const blob = new Blob([full.videoData], { type: full.mimeType || 'video/mp4' });
        motionVideoUrl = await uploadVideoToFal(blob, falKey);
      }
    } catch(e) {
      toast(`Motion video upload failed: ${e.message}`, 'err'); return;
    }
  }

  const duration = parseInt(document.getElementById('videoDuration')?.value || '5');
  const aspectRatio = document.getElementById('videoAspectRatio')?.value || '16:9';
  const enableAudio = model.hasAudio && (document.getElementById('videoEnableAudio')?.checked ?? true);
  const targetFolder = document.getElementById('videoTargetFolder')?.value || 'all';
  const cfgScale = parseFloat(document.getElementById('videoCfgScale')?.value || '0.5');
  const count = parseInt(document.querySelector('input[name="videoCount"]:checked')?.value || '1');
  const veoResolution = document.getElementById('veoResolution')?.value || '720p';
  const veoRefMode = document.getElementById('veoRefMode')?.value || 't2v';
  const veoDuration = parseInt(document.getElementById('videoDuration')?.value || '8');

  // Luma-specific params
  const lumaResolution = document.getElementById('lumaResolution')?.value || '1080p';
  // Duration: prefer custom Luma panel (Ray3 models), fallback to standard radio (Ray2 models)
  const lumaDurCustom = document.querySelector('input[name="lumaDuration"]:checked')?.value;
  const lumaDurStandard = document.querySelector('input[name="videoDurFixed"]:checked')?.value
                       || document.getElementById('videoDuration')?.value || '5';
  const lumaDurationSel = lumaDurCustom || (lumaDurStandard + 's');
  const lumaLoop = document.getElementById('lumaLoop')?.checked || false;
  const lumaColorMode = document.getElementById('lumaColorMode')?.value || 'sdr';
  // Character ref for Ray3 (single asset ID stored in hidden input)
  const lumaCharRefAssetId = document.getElementById('lumaCharRefAssetId')?.value || null;

  // WAN 2.7 I2V/T2V snap (wan27_video type — covers T2V + I2V + R2V)
  const wan27vSnap = model.type === 'wan27_video' ? {
    resolution:   document.getElementById('wan27vResolution')?.value || '1080p',
    duration:     parseInt(document.getElementById('wan27vDuration')?.value || '5'),
    negPrompt:    document.getElementById('wan27vNegPrompt')?.value?.trim() || '',
    promptExpand: document.getElementById('wan27vPromptExpand')?.checked !== false,
    safety:       document.getElementById('wan27vSafety')?.checked !== false,
    seed:         document.getElementById('wan27vSeed')?.value?.trim() || null,
    audioUrl:     document.getElementById('wan27vAudioUrl')?.value?.trim() || null,
    extendVideoId: wan27vSrcVideoId || null,
  } : null;

  // WAN 2.7 Video Edit snap
  const wan27eSnap = model.type === 'wan27e_video' ? {
    srcVideoId:   wan27eSrcVideoId,
    resolution:   document.getElementById('wan27eResolution')?.value || '1080p',
    duration:     document.getElementById('wan27eDuration')?.value || '0',
    aspectRatio:  document.getElementById('wan27eAspect')?.value || 'auto',
    audioSetting: document.getElementById('wan27eAudio')?.value || 'auto',
    safety:       document.getElementById('wan27eSafety')?.checked !== false,
    seed:         document.getElementById('wan27eSeed')?.value?.trim() || null,
  } : null;

  // Seedance 2.0 snap
  const sd2Snap = model.type === 'seedance2_video' ? {
    duration:      document.getElementById('sd2Duration')?.value || '5',
    autoDuration:  document.getElementById('sd2DurAuto')?.checked || false,
    resolution:    document.querySelector('input[name="sd2Res"]:checked')?.value || '720p',
    seed:          document.getElementById('sd2Seed')?.value?.trim() || null,
    // R2V: source video IDs + audio URLs
    vidSrcIds:     [...sd2VidSrc],
    audioUrls: [
      document.getElementById('sd2AudioUrl1')?.value?.trim() || '',
      document.getElementById('sd2AudioUrl2')?.value?.trim() || '',
      document.getElementById('sd2AudioUrl3')?.value?.trim() || '',
    ].filter(Boolean),
  } : null;

  // Grok Video snap
  const grokVideoSnap = model.type === 'grok_video' ? {
    mode:       document.getElementById('grokVideoMode')?.value || 't2v',
    duration:   parseInt(document.getElementById('grokVideoDur')?.value) || 8,
    resolution: document.querySelector('input[name="grokVideoRes"]:checked')?.value || '720p',
    // V2V Edit / Extend: source video gallery ID
    srcVideoId: _grokVideoSrcId || null,
  } : null;

  // Submit count jobs (parallel)
  const jobs = [];
  // Snapshot current refs at submit time — include imageData for resilience against asset deletion
  const videoRefsAtSubmit = await Promise.all(videoRefs.map(async r => {
    const snap = {
      assetId: r.assetId || null,
      mimeType: r.mimeType,
      autoName: r.autoName,
      userLabel: r.userLabel || '',
      thumb: r.thumb || null,
    };
    // Store imageData so refs survive if asset is later deleted
    if (r.data) {
      snap.imageData = r.data;
    } else if (r.assetId) {
      const asset = await dbGet('assets', r.assetId).catch(() => null);
      if (asset?.imageData) snap.imageData = asset.imageData;
      if (!snap.thumb && asset?.thumb) snap.thumb = asset.thumb;
    }
    return snap;
  }));
  for (let i = 0; i < count; i++) {
    const jobId = `vid_${Date.now()}_${i}_${Math.random().toString(36).substr(2,4)}`;
    const job = {
      id: jobId, modelKey, model, prompt, duration, aspectRatio, enableAudio,
      cfgScale, targetFolder, falKey, googleKey, lumaKey, proxyUrl,
      pixverseKey: (localStorage.getItem('gis_pixverse_apikey') || '').trim(),
      veoResolution, veoRefMode, veoDuration,
      lumaResolution, lumaDurationSel, lumaLoop, lumaColorMode, lumaCharRefAssetId,
      wan27vSnap, wan27eSnap, sd2Snap, grokVideoSnap,
      xaiKey: (localStorage.getItem('gis_xai_apikey') || '').trim(),
      status: 'pending', startedAt: Date.now(),
      motionVideoUrl,
      videoRefsSnapshot: videoRefsAtSubmit,
    };
    videoJobs.push(job);
    videoShowPlaceholder(job);
    jobs.push(job);
  }
  renderVideoQueue();

  // Run all jobs concurrently
  await Promise.allSettled(jobs.map(job =>
    runVideoJob(job).catch(e => videoJobError(job, e.message || 'Unknown error'))
  ));
}


// ── Compress image for upload (max 10MB limit on fal.ai) ─
// ── fal.ai async queue for video ─────────────────────────
async function runVideoJob(job) {
  const { model, prompt, duration, aspectRatio, enableAudio, cfgScale = 0.5, falKey, proxyUrl = '' } = job;
  job.status = 'submitting';
  renderVideoQueue();

  // Dispatch to model-specific handler
  if (model.type === 'veo')              return callVeoVideo(job);
  if (model.type === 'luma_video')       return callLumaVideo(job);
  if (model.type === 'wan27_video')      return callWan27Video(job);
  if (model.type === 'wan27e_video')     return callWan27eVideo(job);
  if (model.type === 'pixverse_video')   return callPixverseVideo(job);
  if (model.type === 'seedance2_video')  return callSeedance2Video(job);
  if (model.type === 'grok_video')       return callGrokVideo(job);
  // seedance_video uses the same fal.ai queue path below

  // ── Kling / fal.ai path ──────────────────────────────────
  // Load image data from assets DB and compress (fal.ai hard limit: 10MB per file)
  const videoRefsSnap = await Promise.all(
    videoRefs.map(async r => {
      let imgData, mimeType;
      if (r.assetId) {
        const asset = await dbGet('assets', r.assetId);
        if (!asset?.imageData) throw new Error(`Asset not found for video ref: ${r.autoName || r.assetId}`);
        imgData = asset.imageData;
        mimeType = asset.mimeType || r.mimeType;
      } else if (r.data) {
        // Old format (pre-v102) — inline data from reuseVideoJob
        imgData = r.data;
        mimeType = r.mimeType || 'image/png';
      } else {
        throw new Error(`Video ref has no image data: ${r.autoName || 'unknown'}`);
      }
      return compressImageForUpload(imgData, mimeType);
    })
  );
  const refModeJob = model.refMode || 'none';
  // MINIMAL payload — Kling API uses strict Pydantic validation (extra fields = 422)
  // duration: string for most models, integer for Vidu Q3 (durationInt flag)
  // duration: clamp to model minDur/maxDur, convert to string or int per model flag
  const durNum = Math.max(model.minDur || 1, Math.min(model.maxDur || 120, parseInt(duration)));
  const payload = {};
  if (prompt) payload.prompt = prompt;  // omit entirely if empty — APIs reject empty string
  payload.duration = model.durationInt ? durNum : String(durNum);
  // aspect_ratio only for T2V (I2V infers from start image)
  if (refModeJob === 'none') payload.aspect_ratio = aspectRatio;
  // audio: always explicit — models with audioField use that key; default is 'generate_audio'
  // (omitting audio field causes fal.ai to default to true = unexpected cost)
  if (model.hasAudio) {
    const audioField = model.audioField || 'generate_audio';
    payload[audioField] = !!enableAudio;
  }
  // cfg_scale only when explicitly changed from default — omit otherwise
  if (typeof cfgScale === 'number' && Math.abs(cfgScale - 0.5) > 0.01) payload.cfg_scale = cfgScale;
  // resolution — model-fixed (Seedance/Vidu: always 720p) OR UI-selected (Wan: 720p/1080p)
  if (model.resolution) {
    payload.resolution = model.resolution;
  } else if (model.type === 'wan_video') {
    payload.resolution = document.getElementById('wanResolution')?.value || '1080p';
  }
  // multi_shots — Wan 2.6: send false to force single continuous shot (default = true = multi-shot)
  if (model.multiShots === false) payload.multi_shots = false;

  // Ref fields depend on model refMode
  // imageField overrides the default start frame field name (e.g. Seedance/Vidu/Wan use image_url)
  const imgField = model.imageField || 'start_image_url';
  if (refModeJob === 'single' && videoRefsSnap[0]) {
    payload[imgField] = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
  } else if (refModeJob === 'single_end') {
    // imageField applies to start frame; end is always end_image_url
    if (videoRefsSnap[0]) payload[imgField] = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
    if (videoRefsSnap[1]) payload.end_image_url = `data:${videoRefsSnap[1].mimeType};base64,${videoRefsSnap[1].data}`;
  } else if (refModeJob === 'keyframe') {
    if (videoRefsSnap[0]) payload.start_frame_image_url = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
    if (videoRefsSnap[1]) payload.end_frame_image_url = `data:${videoRefsSnap[1].mimeType};base64,${videoRefsSnap[1].data}`;
  } else if (refModeJob === 'wan_r2v') {
    // Wan 2.6 R2V Flash: refs → image_urls[] + optional video_urls[]
    // Refs are GIS image assets → always sent as image_urls (base64 data URIs)
    // Reference in prompt as Character1, Character2, Character3...
    const imageRefs = videoRefsSnap.filter(r => r.mimeType?.startsWith('image/'));
    const videoRefs_ = videoRefsSnap.filter(r => r.mimeType?.startsWith('video/'));
    if (imageRefs.length > 0)
      payload.image_urls = imageRefs.map(r => `data:${r.mimeType};base64,${r.data}`);
    if (videoRefs_.length > 0)
      payload.video_urls = videoRefs_.map(r => `data:${r.mimeType};base64,${r.data}`);
  } else if (refModeJob === 'multi' && videoRefsSnap.length > 0) {
    // Pokud model vyžaduje base image field (Kling O3 I2V: image_url required + elements optional)
    if (model.imageField) {
      payload[model.imageField] = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
    }
    payload.elements = videoRefsSnap.map((r, i) => ({
      name: `Element${i+1}`,
      images: [`data:${r.mimeType};base64,${r.data}`],
    }));
  } else if (refModeJob === 'video_ref') {
    // V2V / Motion Control: motion reference video + character image
    // character_orientation REQUIRED by fal.ai motion-control API
    // image_url REQUIRED — motion is applied to this character image
    if (!videoRefsSnap[0]) {
      throw new Error('Motion Control requires a character image — add one in the Refs panel.');
    }
    payload.character_orientation = 'video';
    if (job.motionVideoUrl) {
      payload.video_url = job.motionVideoUrl;  // pre-uploaded R2 URL
    }
    payload.image_url = `data:${videoRefsSnap[0].mimeType};base64,${videoRefsSnap[0].data}`;
  }

  // Submit, poll, download via shared helper
  const logPayload = {...payload};
  ['start_image_url','image_url','end_image_url','start_frame_image_url','end_frame_image_url'].forEach(k => {
    if (logPayload[k]) logPayload[k] = logPayload[k].slice(0, 40) + '…';
  });
  console.log('[GIS Video] Submitting payload:', JSON.stringify(logPayload));
  const { buffer: videoArrayBuffer, cdnUrl: videoUrl } = await _falVideoSubmitPollDownload(falKey, model.endpoint, payload, job, { label: model.name });

  // Determine per-model spend key — no more generic $0.04 fallback
  const spendKey = _getVideoSpendKey(job.modelKey, !!job.enableAudio);

  const { elapsed } = await _saveVideoResult(videoArrayBuffer, {
    model: job.model.name, modelKey: job.modelKey, prompt: job.prompt,
    params: { duration: job.duration, aspectRatio: job.aspectRatio, enableAudio: job.enableAudio, cfgScale: job.cfgScale },
    duration: job.duration,
    cdnUrl: videoUrl,
  }, job, ['fal', spendKey, 1, job.duration || 5]);
  toast(`Video generated · ${elapsed}s`, 'ok');
}

// ── Luma Ray3 / Ray3.14 video generation ─────────────────
// Flow: GIS → Worker POST /luma/video/submit (uploads keyframes) → { generation_id }
//       GIS polls → Worker POST /luma/video/status → { status, video_url?, exr_url? }
// ── Placeholder cards ────────────────────────────────────
function videoShowPlaceholder(job) {
  const area = document.getElementById('videoOutputArea');
  const emptyState = document.getElementById('videoEmptyState');
  if (emptyState) emptyState.style.display = 'none';

  const isTopaz  = !!job.isTopaz;
  const modelName = isTopaz
    ? `✦ Topaz ${TOPAZ_MODEL_NAMES[job.topazModel] || job.topazModel}`
    : job.model.name;
  const subtitle  = isTopaz
    ? `${job.srcDuration}s · ${job.out_width}×${job.out_height}`
    : escHtml((job.prompt || '').slice(0, 80)) + ((job.prompt || '').length > 80 ? '…' : '');
  const durationLabel = isTopaz ? `${job.srcDuration}s` : `${job.duration}s`;

  const div = document.createElement('div');
  div.className = 'img-card placeholder-card';
  div.id = `vphold_${job.id}`;
  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="ph-body" style="aspect-ratio:16/9;">
      <div class="ph-shimmer"></div>
      <div class="ph-overlay">
        <div class="ph-top">
          <span class="ph-model">${modelName}</span>
          <span class="ph-elapsed">⟳ <span class="vphold-status">queued…</span></span>
        </div>
        <div class="ph-prompt-txt">${subtitle}</div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill">Model: <b>${modelName}</b></div>
      <div class="meta-pill">Duration: <b>${durationLabel}</b></div>
      <div class="meta-pill" style="color:var(--dim2)">processing…</div>
    </div>`;
  area.appendChild(div);
}

function updateVideoPlaceholderStatus(job, statusText) {
  const el = document.getElementById(`vphold_${job.id}`);
  if (el) {
    const statusEl = el.querySelector('.vphold-status');
    if (statusEl) statusEl.textContent = statusText;
  }
}

function removeVideoPlaceholder(job) {
  const el = document.getElementById(`vphold_${job.id}`);
  if (el) el.remove();
}

// ── Result card in generate output ───────────────────────
// ── Video info helpers ────────────────────────────────────
function renderVideoResultCard(rec, thumbData, placeholderEl) {
  const area = document.getElementById('videoOutputArea');
  const emptyState = document.getElementById('videoEmptyState');
  if (emptyState) emptyState.style.display = 'none';

  const div = document.createElement('div');
  div.className = 'img-card vid-result-card';
  div.dataset.vid = rec.id;
  const thumbSrc = thumbData || '';
  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="img-wrap" style="cursor:zoom-in;aspect-ratio:16/9;background:#000;position:relative;">
      ${thumbSrc ? `<img src="${thumbSrc}" alt="Video thumbnail" style="width:100%;height:100%;object-fit:cover;">` : '<div style="width:100%;height:100%;background:#111;"></div>'}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:20px;margin-left:3px;">▶</span>
        </div>
      </div>
      <div style="position:absolute;bottom:5px;right:6px;background:rgba(0,0,0,.75);color:#fff;font-size:10px;padding:2px 5px;font-family:'IBM Plex Mono',monospace;">${rec.duration}s</div>
      <div class="img-card-liked-badge">♥</div>
      <div class="img-overlay">
        <div class="img-overlay-top">
          <span class="ov-badge model">${rec.model}</span>
          <span class="ov-badge dims">${rec.duration}s · ${(rec.fileSize/1024/1024).toFixed(1)}MB</span>
        </div>
        <div class="img-overlay-bottom">
          <button class="ibtn-ov" onclick="openVideoLightboxById('${rec.id}')">▶ Play</button>
          <button class="ibtn-ov" onclick="videoDownloadById('${rec.id}')">↓ MP4</button>
          <button class="ibtn-ov" onclick="reuseVideoJob('${rec.id}')">↺ Reuse</button>
          <button class="ibtn-ov like-btn" data-vid="${rec.id}" onclick="videoLikeById('${rec.id}', this)">♡ Like</button>
        </div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill"><b>${rec.model}</b></div>
      <div class="meta-pill">${_videoInfoLine(rec)}</div>
      <div class="meta-pill" style="color:var(--dim2);">${_videoDateStr(rec.ts)}</div>
    </div>`;
  div.querySelector('.img-wrap').onclick = e => {
    if (e.target.closest('button')) return;
    openVideoLightboxById(rec.id);
  };
  // In-place replacement: swap placeholder with result card
  if (placeholderEl && placeholderEl.parentNode) {
    placeholderEl.parentNode.replaceChild(div, placeholderEl);
  } else {
    area.appendChild(div);
  }
}

// ── Video error ──────────────────────────────────────────
// Single entry point for all video job failures. Handlers throw RAW technical
// errors; this fn friendly-ifies via friendlyVideoError() and renders the
// error card + toast. See friendlyVideoError docstring for the guideline.
function videoJobError(job, msg) {
  job.status = 'error';
  job.errorMsg = msg;
  renderVideoQueue();

  // Find placeholder card and convert to error card
  const cardEl = document.getElementById(`vphold_${job.id}`);
  if (cardEl) {
    const isTopaz = !!job.isTopaz;
    const modelName = isTopaz
      ? `✦ Topaz ${TOPAZ_MODEL_NAMES[job.topazModel] || job.topazModel}`
      : (job.model?.name || '?');

    const isTimeout = /timeout|deadline/i.test(msg || '');
    const icon = isTimeout ? '⏱' : '⚠';
    const friendlyMsg = escHtml(friendlyVideoError(msg));
    const fullPrompt = escHtml((job.prompt || '').trim());
    const cardKey = job.id;

    // Video ref thumbnails
    const vrefs = job.videoRefsSnapshot || [];
    const refsHtml = vrefs.length
      ? `<div class="err-refs">${vrefs.map(r => r.thumb
          ? `<img class="err-ref-thumb" src="data:image/jpeg;base64,${r.thumb}" title="${escHtml(r.userLabel || r.autoName || '')}">`
          : `<div class="err-ref-thumb err-ref-nothumb">?</div>`
        ).join('')}</div>`
      : '';

    // Param chips — duration + model-specific info
    const chips = [];
    if (job.duration)   chips.push(`${job.duration}s`);
    if (job.resolution) chips.push(job.resolution);
    const chipHtml = chips.map(c => `<span class="err-chip">${escHtml(c)}</span>`).join('');

    cardEl.classList.remove('placeholder-card');
    cardEl.classList.add('error-card');

    cardEl.innerHTML = `
      <div class="img-card-top-spacer"></div>
      <div class="err-detail">
        <div class="err-banner">
          <span class="err-banner-icon">${icon}</span>
          <span class="err-banner-msg">${friendlyMsg}</span>
        </div>
        <div class="err-content">
          <div class="err-meta-row">
            <span class="err-model-label">${escHtml(modelName)}</span>
            ${chipHtml}
          </div>
          ${fullPrompt ? `<div class="err-prompt">${fullPrompt}</div>` : ''}
          ${refsHtml}
          <div class="err-btns">
            <button class="ibtn" onclick="reuseVideoJob_err('${cardKey}')" title="Load params into form to review and re-generate">↺ Reuse</button>
            <button class="ibtn err-rerun-btn" onclick="rerunVideoJob('${cardKey}')" title="Re-run this video job immediately">▶ Rerun</button>
          </div>
        </div>
      </div>
      <div class="img-card-meta">
        <div class="meta-pill">Model: <b>${escHtml(modelName)}</b></div>
        <div class="meta-pill" style="color:#c08060;">${icon} ${friendlyMsg}</div>
      </div>`;
  } else {
    // No placeholder card (e.g. Topaz background jobs) — just toast
    toast(`Video failed: ${friendlyVideoError(msg).slice(0, 100)}`, 'err');
  }
  console.error('Video job error:', job.id, msg);
}

// ── Video error card actions ──────────────────────────────
function reuseVideoJob_err(jobId) {
  const card = document.getElementById(`vphold_${jobId}`);
  const job = videoJobs.find(j => j.id === jobId);
  if (!job) { toast('Cannot reuse — job data lost', 'err'); return; }
  if (card) card.remove();

  // Restore into form (best-effort — model + prompt)
  switchView('gen');
  setGenMode('video');
  const promptEl = document.getElementById('videoPrompt');
  if (promptEl && job.prompt) promptEl.value = job.prompt;
  if (job.modelKey) {
    const sel = document.getElementById('videoModelSelect');
    if (sel) { sel.value = job.modelKey; onVideoModelChange(job.modelKey); }
  }
  toast('Parameters restored — review and click Generate', 'ok');
}

function rerunVideoJob(jobId) {
  const card = document.getElementById(`vphold_${jobId}`);
  const job = videoJobs.find(j => j.id === jobId);
  if (!job) { toast('Cannot rerun — job data lost', 'err'); return; }
  // Re-queue with same parameters, fresh ID
  const { id: _id, status: _s, startedAt: _st, elapsed: _e,
          requestId: _r, cancelled: _c, errorMsg: _em, ...jobData } = job;
  const newJob = { ...jobData,
    id: `vid_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
    status: 'queued', startedAt: Date.now() };
  videoJobs.push(newJob);
  // In-place rerun: insert new placeholder where the error card is, then remove error card
  if (card && card.parentNode) {
    const area = document.getElementById('videoOutputArea');
    const emptyState = document.getElementById('videoEmptyState');
    if (emptyState) emptyState.style.display = 'none';
    const isTopaz  = !!newJob.isTopaz;
    const mn = isTopaz ? `✦ Topaz ${TOPAZ_MODEL_NAMES[newJob.topazModel] || newJob.topazModel}` : newJob.model.name;
    const sub = isTopaz ? `${newJob.srcDuration}s · ${newJob.out_width}×${newJob.out_height}`
      : escHtml((newJob.prompt || '').slice(0, 80)) + ((newJob.prompt || '').length > 80 ? '…' : '');
    const dl = isTopaz ? `${newJob.srcDuration}s` : `${newJob.duration}s`;
    const div = document.createElement('div');
    div.className = 'img-card placeholder-card';
    div.id = `vphold_${newJob.id}`;
    div.innerHTML = `<div class="img-card-top-spacer"></div>
      <div class="ph-body" style="aspect-ratio:16/9;"><div class="ph-shimmer"></div>
      <div class="ph-overlay"><div class="ph-top"><span class="ph-model">${mn}</span>
      <span class="ph-elapsed">⟳ <span class="vphold-status">queued…</span></span></div>
      <div class="ph-prompt-txt">${sub}</div></div></div>
      <div class="img-card-meta"><div class="meta-pill">Model: <b>${mn}</b></div>
      <div class="meta-pill">Duration: <b>${dl}</b></div>
      <div class="meta-pill" style="color:var(--dim2)">processing…</div></div>`;
    card.parentNode.insertBefore(div, card);
    card.remove();
  } else {
    videoShowPlaceholder(newJob);
  }
  renderVideoQueue();
  runVideoJob(newJob).catch(e => videoJobError(newJob, e.message || 'Unknown error'));
}

// ── Video queue rendering ────────────────────────────────
function renderVideoQueue() {
  // Update inline queue panel (in video gen panel)
  const panel = document.getElementById('videoQueuePanel');
  const list = document.getElementById('videoQueueList');
  if (panel && list) {
    const active = videoJobs.filter(j => j.status !== 'done' && j.status !== 'error');
    panel.style.display = active.length ? 'block' : 'none';
    list.innerHTML = _videoQueueItemsHtml();
  }
  // Update overlay queue
  renderVideoQueueOverlay();
}

function _videoQueueItemsHtml() {
  return videoJobs.slice(-20).reverse().map(j => {
    const elapsed = j.startedAt ? Math.round((Date.now() - j.startedAt) / 1000) + 's' : '';
    const statusTxt =
      j.status === 'pending'   ? 'waiting' :
      j.status === 'submitting'? 'submitting…' :
      j.status === 'uploading' ? 'uploading video…' :
      j.status === 'queued'    ? `in queue · ${elapsed}` :
      j.status === 'running'   ? `generating · ${elapsed}` :
      j.status === 'fetching'  ? 'downloading…' :
      j.status === 'done'      ? `✓ done · ${j.elapsed}` :
      `⚠ ${j.errorMsg?.slice(0,60) || 'error'}`;
    const isActive = ['pending','submitting','uploading','queued','running','fetching'].includes(j.status);
    return `<div class="qo-item ${j.status}">
      <div class="qo-dot ${j.status}"></div>
      <div class="qo-main">
        <div class="qo-model ${j.status}" style="font-size:11px;font-weight:600;margin-bottom:2px;">${j.model.name}</div>
        <div class="qo-prompt" style="font-size:10px;color:var(--dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${escHtml(j.prompt.slice(0,80))}</div>
        <div class="qo-meta ${isActive ? 'qo-elapsed' : ''}" style="font-size:10px;margin-top:3px;">${statusTxt}</div>
      </div>
      ${isActive ? `<button class="qo-cancel-btn" onclick="videoCancelJob('${j.id}')" title="Cancel">✕</button>` : ''}
    </div>`;
  }).join('') || '<div style="padding:20px;text-align:center;font-size:11px;color:var(--dim2);">No video jobs yet</div>';
}

function renderVideoQueueOverlay() {
  const overlayList = document.getElementById('videoQueueOverlayList');
  if (overlayList) overlayList.innerHTML = _videoQueueItemsHtml();

  // Update badge count and dot
  const activeCount = videoJobs.filter(j => ['pending','submitting','uploading','queued','running','fetching'].includes(j.status)).length;
  const badge = document.getElementById('videoQoBadge');
  if (badge) badge.textContent = activeCount > 0 ? activeCount + ' running' : videoJobs.length + ' total';
  const dot = document.getElementById('videoQueueDot');
  if (dot) dot.style.background = activeCount > 0 ? 'var(--accent)' : 'var(--dim2)';
  const toggleBtn = document.getElementById('videoQueueToggleBtn');
  if (toggleBtn) toggleBtn.style.borderColor = activeCount > 0 ? 'var(--accent)' : 'var(--border)';
}

let videoQueueOverlayOpen = false;
function toggleVideoQueueOverlay() {
  videoQueueOverlayOpen = !videoQueueOverlayOpen;
  const overlay = document.getElementById('videoQueueOverlay');
  if (overlay) {
    overlay.style.transform = videoQueueOverlayOpen ? 'translateX(0)' : 'translateX(100%)';
    overlay.style.pointerEvents = videoQueueOverlayOpen ? 'all' : 'none';
  }
  if (videoQueueOverlayOpen) renderVideoQueueOverlay();
}

function videoCancelJob(id) {
  const job = videoJobs.find(j => j.id === id);
  if (job) { job.cancelled = true; job.status = 'error'; job.errorMsg = 'Cancelled'; }
  renderVideoQueue();
}

function videoCancelAllPending() {
  videoJobs.forEach(j => {
    if (['pending','submitting','uploading','queued'].includes(j.status)) {
      j.cancelled = true; j.status = 'error'; j.errorMsg = 'Cancelled';
    }
  });
  renderVideoQueue();
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION 2 · FÁZE 5 — buildVideoParams() + generateVideo refactor
// ---------------------------------------------------------------------------
// Generate now reads from #vpXxx IDs via buildVideoParams().  Handlers in
// Fáze 7 will consume `job.params` directly; for Fáze 5 we still construct
// legacy snap objects (wan27vSnap, sd2Snap, etc.) so runVideoJob keeps
// working unchanged until Fáze 7 refactors each handler.
// The new `generateVideo` below replaces the legacy implementation earlier
// in this file — last function definition wins at script load.
// ═══════════════════════════════════════════════════════════════════════════

// Read Resolution from unified panel (or advanced-group-specific widget).
function _readVpResolution(ui) {
  if (ui.advancedGroup === 'topaz')    return document.getElementById('vpTopazResolution')?.value || '4K';
  if (ui.advancedGroup === 'magnific') return document.getElementById('vpMagnificResolution')?.value || '2k';
  if (ui.advancedGroup === 'pixverse') return document.getElementById('vpPixverseQuality')?.value || '720p';
  return document.getElementById('vpResolution')?.value || '';
}

// Read Duration as number (seconds) from slider/select/radio.
function _readVpDuration(ui) {
  if (ui.durationType === 'select') {
    const sel = document.getElementById('vpDurationSelect');
    if (sel && sel.offsetParent !== null) {
      const n = parseInt(sel.value);
      if (!isNaN(n) && n > 0) return n;
    }
  } else if (ui.durationType === 'radio') {
    const r = document.querySelector('input[name="vpDurationRadio"]:checked');
    if (r) {
      const n = parseInt(r.value);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  const n = parseInt(document.getElementById('vpDuration')?.value);
  return (!isNaN(n) && n > 0) ? n : 5;
}

// Read seed (null = random).
function _readVpSeed() {
  const v = document.getElementById('vpSeed')?.value?.trim();
  if (!v) return null;
  const n = parseInt(v);
  return (!isNaN(n) && n >= 0) ? n : null;
}

// Read mode sub-select value (dependent on modeSelect type).
function _readVpMode(ui) {
  if (!ui.modeSelect) return null;
  return document.getElementById('vpModeSelect')?.value || null;
}

// Read source video asset ID for current slot (reads from legacy globals,
// which are still populated by delegated pick handlers).
function _readVpSourceVideoId(ui) {
  const slot = ui.sourceSlot;
  if (!slot) return null;
  if (slot === 'topaz'    && typeof topazSrcVideoId    !== 'undefined') return topazSrcVideoId    || null;
  if (slot === 'magnific' && typeof topazSrcVideoId    !== 'undefined') return topazSrcVideoId    || null; // reuses Topaz slot
  if (slot === 'wan27v'   && typeof wan27vSrcVideoId   !== 'undefined') return wan27vSrcVideoId   || null;
  if (slot === 'wan27e'   && typeof wan27eSrcVideoId   !== 'undefined') return wan27eSrcVideoId   || null;
  if (slot === 'v2v'      && typeof videoMotionVideoId !== 'undefined') return videoMotionVideoId || null;
  if (slot === 'grok'     && typeof _grokVideoSrcId    !== 'undefined') return _grokVideoSrcId    || null;
  if (slot === 'sd2Vid'   && typeof sd2VidSrc          !== 'undefined') return (sd2VidSrc && sd2VidSrc[0]) || null;
  return null;
}

// Read audio URLs (Seedance 2.0: up to 3).
function _readVpAudioUrls(ui) {
  if (!ui.showAudioSources) return [];
  return [
    document.getElementById('vpSourceAudio1')?.value?.trim() || '',
    document.getElementById('vpSourceAudio2')?.value?.trim() || '',
    document.getElementById('vpSourceAudio3')?.value?.trim() || '',
  ].filter(Boolean);
}

// Per-family advanced param readers.
function _readVpTopazParams() {
  return {
    resolution: document.getElementById('vpTopazResolution')?.value || '4K',
    factor:     parseInt(document.getElementById('vpTopazFactor')?.value || '2'),
    fps:        document.getElementById('vpTopazFps')?.value || '',
    slowmo:     parseInt(document.getElementById('vpTopazSlowmo')?.value || '1'),
    creativity: parseInt(document.getElementById('vpTopazCreativity')?.value || '2'),
  };
}
function _readVpMagnificParams() {
  const flavor = document.querySelector('input[name="vpMagnificFlavor"]:checked')?.value || 'vivid';
  return {
    resolution: document.getElementById('vpMagnificResolution')?.value || '2k',
    fpsBoost:   document.getElementById('vpMagnificFps')?.checked || false,
    sharpen:    parseInt(document.getElementById('vpMagnificSharpen')?.value || '0'),
    grain:      parseInt(document.getElementById('vpMagnificGrain')?.value || '0'),
    prompt:     document.getElementById('vpMagnificPrompt')?.value?.trim() || '',
    creativity: parseInt(document.getElementById('vpMagnificCreativity')?.value || '50'),
    flavor:     flavor,
    strength:   parseInt(document.getElementById('vpMagnificStrength')?.value || '60'),
  };
}
function _readVpPixverseParams() {
  return {
    quality:    document.getElementById('vpPixverseQuality')?.value || '720p',
    cameraMove: document.getElementById('vpCameraMove')?.value || '',
    multiClip:  document.getElementById('vpMultiClip')?.checked || false,
    offPeak:    document.getElementById('vpOffPeak')?.checked || false,
  };
}
function _readVpLumaParams() {
  // Per-ref weights (array aligned with videoRefs order).
  const refsLen = (typeof videoRefs !== 'undefined') ? videoRefs.length : 0;
  const refWeights = [];
  for (let i = 0; i < refsLen; i++) {
    const el = document.getElementById(`vpRefWeight${i}`);
    const v = el ? parseFloat(el.value) : 0.85;
    refWeights.push(isNaN(v) ? 0.85 : v);
  }
  return {
    loop:       document.getElementById('vpLumaLoop')?.checked || false,
    colorMode:  document.getElementById('vpLumaColorMode')?.value || 'sdr',
    refWeights: refWeights,
  };
}

// Main unified params reader.  Returns an object matching the Session 2
// metadata schema (see SESSION_2_HANDOFF.md § 3).
function buildVideoParams() {
  const modelKey = getActiveVideoModelKey();
  const ui = getVideoUi(modelKey);

  return {
    // Core (always present):
    resolution:     _readVpResolution(ui),
    aspectRatio:    document.getElementById('vpAspect')?.value || '16:9',
    duration:       _readVpDuration(ui),
    cfgScale:       parseFloat(document.getElementById('vpCfg')?.value || '0.5'),
    seed:           _readVpSeed(),
    enableAudio:    document.getElementById('vpAudio')?.checked ?? true,
    count:          Math.max(1, Math.min(4, parseInt(document.getElementById('vpCount')?.value || '1') || 1)),
    negativePrompt: document.getElementById('vpNegPrompt')?.value?.trim() || '',

    // Sub-select:
    modeValue:      _readVpMode(ui),
    variantKey:     modelKey,

    // Source:
    sourceVideoId:  _readVpSourceVideoId(ui),
    audioUrls:      _readVpAudioUrls(ui),

    // Per-family advanced (null when model not in family):
    topaz:    ui.advancedGroup === 'topaz'    ? _readVpTopazParams()    : null,
    magnific: ui.advancedGroup === 'magnific' ? _readVpMagnificParams() : null,
    pixverse: ui.advancedGroup === 'pixverse' ? _readVpPixverseParams() : null,
    luma:     ui.advancedGroup === 'luma'     ? _readVpLumaParams()     : null,
    wan:      (modelKey === 'wan26_t2v') ? { multiShots: document.getElementById('vpMultiShots')?.checked || false } : null,
    grok:     ui.modeSelect === 'grokMode'   ? { mode: _readVpMode(ui) || 't2v' } : null,
    veo:      ui.modeSelect === 'veoRefMode' ? { refMode: _readVpMode(ui) || 't2v' } : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Build legacy-shaped snap objects from unified params.  Bridge
// layer: keeps Fáze 7 handler refactor decoupled from Fáze 5.
// ─────────────────────────────────────────────────────────────
function _buildLegacySnaps(modelKey, model, params) {
  // Veo
  const veoResolution = (params.veo && params.resolution) ? params.resolution : (params.resolution || '720p');
  const veoRefMode    = params.veo?.refMode || 't2v';
  const veoDuration   = params.duration;

  // Luma
  const lumaResolution = (model.type === 'luma_video') ? (params.resolution || '1080p') : '1080p';
  const lumaDurationSel = (model.type === 'luma_video') ? `${params.duration}s` : null;
  const lumaLoop       = params.luma?.loop || false;
  const lumaColorMode  = params.luma?.colorMode || 'sdr';
  const lumaCharRefAssetId = null; // Deprecated in unified panel (integrated into refs)

  // WAN 2.7 video (T2V / I2V / R2V — type='wan27_video')
  const wan27vSnap = (model.type === 'wan27_video') ? {
    resolution:    params.resolution || '1080p',
    duration:      params.duration || 5,
    negPrompt:     params.negativePrompt || '',
    promptExpand:  true,   // default on — UI toggle removed in unified panel
    safety:        true,
    seed:          params.seed !== null ? String(params.seed) : null,
    audioUrl:      null,   // Removed from unified panel
    extendVideoId: (typeof wan27vSrcVideoId !== 'undefined' ? wan27vSrcVideoId : null) || null,
  } : null;

  // WAN 2.7 Video Edit
  const wan27eSnap = (model.type === 'wan27e_video') ? {
    srcVideoId:   (typeof wan27eSrcVideoId !== 'undefined' ? wan27eSrcVideoId : null),
    resolution:   params.resolution || '1080p',
    duration:     String(params.duration || 0),
    aspectRatio:  params.aspectRatio || 'auto',
    audioSetting: 'auto',
    safety:       true,
    seed:         params.seed !== null ? String(params.seed) : null,
  } : null;

  // Seedance 2.0
  const sd2Snap = (model.type === 'seedance2_video') ? {
    duration:     String(params.duration || 5),
    autoDuration: false,
    resolution:   params.resolution || '720p',
    seed:         params.seed !== null ? String(params.seed) : null,
    vidSrcIds:    (typeof sd2VidSrc !== 'undefined' && Array.isArray(sd2VidSrc)) ? [...sd2VidSrc] : [],
    audioUrls:    params.audioUrls || [],
  } : null;

  // Grok Video
  const grokVideoSnap = (model.type === 'grok_video') ? {
    mode:       params.grok?.mode || 't2v',
    duration:   params.duration || 8,
    resolution: params.resolution || '720p',
    srcVideoId: (typeof _grokVideoSrcId !== 'undefined' ? _grokVideoSrcId : null) || null,
  } : null;

  return {
    veoResolution, veoRefMode, veoDuration,
    lumaResolution, lumaDurationSel, lumaLoop, lumaColorMode, lumaCharRefAssetId,
    wan27vSnap, wan27eSnap, sd2Snap, grokVideoSnap,
  };
}

// ─────────────────────────────────────────────────────────────
// NEW generateVideo — reads from #vpXxx IDs via buildVideoParams.
// Keeps backward-compat legacy snap objects for handlers (Fáze 7).
// ─────────────────────────────────────────────────────────────
async function generateVideo() {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    toast('Application integrity check failed. Please use the original GIS.', 'err');
    return;
  }

  const activeKey = getActiveVideoModelKey();
  const proxyUrl = getProxyUrl();

  // Topaz / Magnific — keep legacy dispatch (Fáze 7 refactors these handlers).
  if (TOPAZ_MODELS[activeKey]) {
    _syncVpToLegacyTopaz();
    await _generateTopazJob(activeKey, proxyUrl);
    return;
  }
  if (MAGNIFIC_VIDEO_MODELS[activeKey]) {
    const freepikKey = (localStorage.getItem('gis_freepik_apikey') || '').trim();
    if (!freepikKey) { showApiKeyWarning('Freepik API Key missing', 'Magnific Video requires a Freepik API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl)   { showApiKeyWarning('Proxy URL missing', 'Magnific Video requires the GIS proxy URL. Add it in the Setup tab.'); return; }
    _syncVpToLegacyMagnific();
    await _generateMagnificVideoJob(activeKey, freepikKey, proxyUrl);
    return;
  }

  const modelKey = activeKey;
  const model = VIDEO_MODELS[modelKey];
  if (!model) { toast('Select a video model', 'err'); return; }

  const falKey    = document.getElementById('fluxApiKey')?.value?.trim() || '';
  const googleKey = document.getElementById('apiKey')?.value?.trim() || localStorage.getItem('gis_apikey') || '';
  const lumaKey   = (localStorage.getItem('gis_luma_apikey') || '').trim();

  // Key validation per model type
  if (model.type === 'veo') {
    if (!googleKey) { showApiKeyWarning('Google API Key missing', 'Veo requires a Google AI API key. Add it in the Setup tab.'); return; }
  } else if (model.type === 'luma_video') {
    if (!lumaKey)  { showApiKeyWarning('Luma API Key missing', 'Ray3 / Ray3.14 requires a Luma API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'Luma video requires the GIS proxy URL. Add it in the Setup tab.'); return; }
  } else if (model.type === 'pixverse_video') {
    const pvKey = (localStorage.getItem('gis_pixverse_apikey') || '').trim();
    if (!pvKey)    { showApiKeyWarning('PixVerse API Key missing', 'PixVerse requires a PixVerse API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'PixVerse requires the GIS proxy URL. Add it in the Setup tab.'); return; }
  } else if (model.type === 'wan27_video') {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'WAN 2.7 requires a fal.ai API key. Add it in the Setup tab.'); return; }
  } else if (model.type === 'wan27e_video') {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'WAN 2.7 Video Edit requires a fal.ai API key. Add it in the Setup tab.'); return; }
    if (typeof wan27eSrcVideoId === 'undefined' || !wan27eSrcVideoId) {
      toast('Select a source video first — click ▷ Use on any video in the gallery', 'err'); return;
    }
  } else if (model.type === 'grok_video') {
    const xaiKey = (localStorage.getItem('gis_xai_apikey') || '').trim();
    if (!xaiKey)   { showApiKeyWarning('xAI API Key missing', 'Grok Video requires an xAI API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl) { showApiKeyWarning('Proxy URL missing', 'Grok Video requires the GIS proxy URL. Add it in the Setup tab.'); return; }
  } else {
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'Video generation requires a fal.ai API key. Add it in the Setup tab.'); return; }
  }

  // Read unified params
  const params = buildVideoParams();
  const rawVideoPrompt = document.getElementById('vpPrompt')?.value?.trim() || '';

  // Prompt validation
  const refMode = model.refMode || 'none';
  const veoFramesMode = model.type === 'veo' && params.veo?.refMode === 'frames';
  const promptOptional = veoFramesMode ||
    (model.type !== 'luma_video' && model.type !== 'kling_video' && model.type !== 'pixverse_video' &&
     (refMode === 'single_end' || refMode === 'single' || refMode === 'keyframe' ||
      refMode === 'wan_r2v' || refMode === 'seedance2_r2v' || refMode === 'multi'));
  if (!rawVideoPrompt && !promptOptional) { toast('Enter a prompt', 'err'); return; }

  // Append style + camera suffix
  const vStyleSuffix  = buildStyleSuffix('flux');
  const vCameraSuffix = buildCameraSuffix();
  const vExtra = [vStyleSuffix, vCameraSuffix].filter(Boolean).join(', ');
  const prompt = vExtra ? (rawVideoPrompt ? rawVideoPrompt + ', ' + vExtra : vExtra) : rawVideoPrompt;

  // Ref validation
  if ((refMode === 'single' || refMode === 'single_end') && videoRefs.length === 0 &&
      model.type !== 'veo' && model.type !== 'luma_video' && model.type !== 'wan27e_video' &&
      model.refMode !== 'wan_r2v') {
    toast('Start frame image required for I2V', 'err'); return;
  }
  if (refMode === 'keyframe' && videoRefs.length < 2) {
    toast(`Both start and end frames required (have ${videoRefs.length}/2)`, 'err'); return;
  }
  if (refMode === 'video_ref' && !videoMotionFile && !videoMotionVideoId) {
    toast('Upload or pick a motion reference video for Motion Control', 'err'); return;
  }

  // V2V: upload motion video to R2 before submitting jobs
  let motionVideoUrl = null;
  if (refMode === 'video_ref' && (videoMotionFile || videoMotionVideoId)) {
    toast('Uploading motion video…', 'ok');
    try {
      if (videoMotionFile) {
        motionVideoUrl = await uploadVideoToFal(videoMotionFile, falKey);
      } else {
        const full = await dbGet('videos', videoMotionVideoId);
        if (!full?.videoData) throw new Error('Video data not found in gallery');
        const blob = new Blob([full.videoData], { type: full.mimeType || 'video/mp4' });
        motionVideoUrl = await uploadVideoToFal(blob, falKey);
      }
    } catch(e) {
      toast(`Motion video upload failed: ${e.message}`, 'err'); return;
    }
  }

  // Build legacy-shaped snaps for compatibility with existing handlers (Fáze 7).
  const snaps = _buildLegacySnaps(modelKey, model, params);

  // Target folder (unified panel doesn't have this yet — legacy field still in DOM).
  const targetFolder = document.getElementById('videoTargetFolder')?.value || 'all';

  // Apply audio toggle from unified panel (overrides model default).
  const enableAudio = model.hasAudio && (params.enableAudio ?? true);

  // Snapshot current refs at submit time (includes imageData for deletion resilience).
  const videoRefsAtSubmit = await Promise.all(videoRefs.map(async r => {
    const snap = {
      assetId: r.assetId || null,
      mimeType: r.mimeType,
      autoName: r.autoName,
      userLabel: r.userLabel || '',
      thumb: r.thumb || null,
    };
    if (r.data) {
      snap.imageData = r.data;
    } else if (r.assetId) {
      const asset = await dbGet('assets', r.assetId).catch(() => null);
      if (asset?.imageData) snap.imageData = asset.imageData;
      if (!snap.thumb && asset?.thumb) snap.thumb = asset.thumb;
    }
    return snap;
  }));

  // Submit count jobs (parallel)
  const count = params.count;
  const duration    = params.duration;
  const aspectRatio = params.aspectRatio;
  const cfgScale    = params.cfgScale;

  const jobs = [];
  for (let i = 0; i < count; i++) {
    const jobId = `vid_${Date.now()}_${i}_${Math.random().toString(36).substr(2,4)}`;
    const job = {
      id: jobId, modelKey, model, prompt,
      duration, aspectRatio, enableAudio, cfgScale, targetFolder,
      falKey, googleKey, lumaKey, proxyUrl,
      pixverseKey: (localStorage.getItem('gis_pixverse_apikey') || '').trim(),
      xaiKey:      (localStorage.getItem('gis_xai_apikey')      || '').trim(),
      // Legacy-shape (bridge for current handlers — Fáze 7 will drop these):
      veoResolution:    snaps.veoResolution,
      veoRefMode:       snaps.veoRefMode,
      veoDuration:      snaps.veoDuration,
      lumaResolution:   snaps.lumaResolution,
      lumaDurationSel:  snaps.lumaDurationSel,
      lumaLoop:         snaps.lumaLoop,
      lumaColorMode:    snaps.lumaColorMode,
      lumaCharRefAssetId: snaps.lumaCharRefAssetId,
      wan27vSnap:       snaps.wan27vSnap,
      wan27eSnap:       snaps.wan27eSnap,
      sd2Snap:          snaps.sd2Snap,
      grokVideoSnap:    snaps.grokVideoSnap,
      // New unified params (Fáze 7 handlers will prefer this):
      params,
      status: 'pending', startedAt: Date.now(),
      motionVideoUrl,
      videoRefsSnapshot: videoRefsAtSubmit,
    };
    videoJobs.push(job);
    videoShowPlaceholder(job);
    jobs.push(job);
  }
  renderVideoQueue();

  // Run all jobs concurrently
  await Promise.allSettled(jobs.map(job =>
    runVideoJob(job).catch(e => videoJobError(job, e.message || 'Unknown error'))
  ));
}

// ─────────────────────────────────────────────────────────────
// Sync vpXxx values → legacy Topaz/Magnific IDs.  Required because
// the Topaz / Magnific video handlers (video-topaz.js) still read
// from legacy DOM IDs — Fáze 7 will refactor them to use params.
// Called just before `_generateTopazJob` / `_generateMagnificVideoJob`.
// ─────────────────────────────────────────────────────────────
function _syncVpToLegacyTopaz() {
  const m = {
    vpTopazResolution: 'topazResolution',
    vpTopazFactor:     'topazFactor',
    vpTopazFps:        'topazFps',
    vpTopazSlowmo:     'topazSlowmo',
    vpTopazCreativity: 'topazCreativity',
  };
  for (const [vpId, legacyId] of Object.entries(m)) {
    const vpEl = document.getElementById(vpId);
    const lgEl = document.getElementById(legacyId);
    if (vpEl && lgEl && 'value' in lgEl) lgEl.value = vpEl.value;
  }
}

function _syncVpToLegacyMagnific() {
  const sel = {
    vpMagnificResolution: 'magnificVidResolution',
  };
  for (const [vpId, legacyId] of Object.entries(sel)) {
    const vpEl = document.getElementById(vpId);
    const lgEl = document.getElementById(legacyId);
    if (vpEl && lgEl && 'value' in lgEl) lgEl.value = vpEl.value;
  }
  const vpFps = document.getElementById('vpMagnificFps');
  const lgFps = document.getElementById('magnificVidFps');
  if (vpFps && lgFps && 'checked' in lgFps) lgFps.checked = !!vpFps.checked;
  const sliderMap = {
    vpMagnificSharpen:    'magnificVidSharpen',
    vpMagnificGrain:      'magnificVidGrain',
    vpMagnificCreativity: 'magnificVidCreativity',
    vpMagnificStrength:   'magnificVidStrength',
  };
  for (const [vpId, legacyId] of Object.entries(sliderMap)) {
    const vpEl = document.getElementById(vpId);
    const lgEl = document.getElementById(legacyId);
    if (vpEl && lgEl && 'value' in lgEl) lgEl.value = vpEl.value;
  }
  const vpP = document.getElementById('vpMagnificPrompt');
  const lgP = document.getElementById('magnificVidPrompt');
  if (vpP && lgP && 'value' in lgP) lgP.value = vpP.value;
  const vpFlavor = document.querySelector('input[name="vpMagnificFlavor"]:checked');
  if (vpFlavor) {
    const lgFlavor = document.querySelector(`input[name="magnificVidFlavor"][value="${vpFlavor.value}"]`);
    if (lgFlavor) lgFlavor.checked = true;
  }
}
