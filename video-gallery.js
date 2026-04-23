// ═══════════════════════════════════════════════════════
// VIDEO — gallery UI, filters, refs, mentions, lightbox, source slots
// ═══════════════════════════════════════════════════════

let videoCurrentFolder = 'all';
let videoSelectedIds = new Set();
let videoSearchTimer = null;
let videoLbCurrentId = null;  // lightbox: current video id
let videoLbDuration = 0;
let videoRefs = [];           // [{data, mimeType, name}] — unified ref array per model
let videoMotionFile    = null;   // V2V: File object (from upload)
let videoMotionVideoId = null;   // V2V: gallery DB video ID (from gallery pick)
let wan27eSrcVideoId   = null;   // WAN 2.7 Video Edit: source video gallery ID
let wan27vSrcVideoId   = null;   // WAN 2.7 I2V: optional source video for extension
// Seedance 2.0 R2V: 3 source video slots (uploaded to R2 → URLs sent as video_urls[])
let sd2VidSrc = [null, null, null]; // [videoId1, videoId2, videoId3]

function _srcSlotClear(ids) {
  const el = id => document.getElementById(id);
  if (ids.info)        el(ids.info).textContent = 'None selected';
  if (ids.thumb)       el(ids.thumb).style.display = 'none';
  if (ids.clearBtn)    el(ids.clearBtn).style.display = 'none';
  if (ids.describeBtn) el(ids.describeBtn).style.display = 'none';
  if (ids.meta)        { const m = el(ids.meta); if (m) m.innerHTML = ''; }
}

async function _srcSlotSet(ids, videoId) {
  const meta  = await dbGet('video_meta', videoId).catch(() => null);
  const thumb = await dbGet('video_thumbs', videoId).catch(() => null);
  const el = id => document.getElementById(id);
  if (ids.info && meta) {
    const mb = meta.fileSize ? `${(meta.fileSize/1024/1024).toFixed(1)}MB` : '';
    el(ids.info).textContent = `${meta.duration || '?'}s · ${mb}`;
  }
  if (thumb?.data && ids.img && ids.thumb) {
    el(ids.img).src = thumb.data;
    el(ids.thumb).style.display = 'block';
  }
  if (ids.meta && meta) {
    const res = meta.outWidth && meta.outHeight ? `${meta.outWidth}×${meta.outHeight}` : (meta.params?.resolution || null);
    const chips = [res, meta.duration ? `${meta.duration}s` : null].filter(Boolean);
    el(ids.meta).innerHTML = chips.map(c =>
      `<span class="src-chip">${c}</span>`
    ).join('');
  }
  if (ids.clearBtn)    el(ids.clearBtn).style.display = '';
  if (ids.describeBtn) el(ids.describeBtn).style.display = thumb?.data ? '' : 'none';
  return { meta, thumb };
}

function _srcSlotDescribe(imgId) {
  const img = document.getElementById(imgId);
  if (!img?.src || img.src === window.location.href) return;
  _describeFromThumb(img.src);
}

// ═══════════════════════════════════════════════════════
// Video source-slot registry (v206en cleanup #1).
// Each entry describes DOM IDs + state hooks for one slot.
// Models that extend it (Topaz in video-topaz.js) push their own entries
// at load time — see `VIDEO_SOURCE_SLOTS.topaz = {...}` in video-topaz.js.
// Fields:
//   ids         — { info, thumb, img, meta, clearBtn, describeBtn }
//   set(id)     — store the videoId in the module-level state variable
//   pickToast   — text shown when user clicks a "pick from gallery" button
//   setHook?    — async optional post-_srcSlotSet callback, receives {meta,thumb}
//   clearHook?  — optional post-_srcSlotClear callback (e.g. resetting <input>)
// ═══════════════════════════════════════════════════════
const VIDEO_SOURCE_SLOTS = Object.create(null);

function videoSlotClear(key) {
  const slot = VIDEO_SOURCE_SLOTS[key];
  if (!slot) return;
  slot.set(null);
  _srcSlotClear(slot.ids);
  if (slot.clearHook) slot.clearHook();
}

async function videoSlotSet(key, videoId) {
  const slot = VIDEO_SOURCE_SLOTS[key];
  if (!slot) return null;
  slot.set(videoId);
  const result = await _srcSlotSet(slot.ids, videoId);
  if (slot.setHook) await slot.setHook(videoId, result);
  return result;
}

async function videoSlotDescribe(key) {
  const slot = VIDEO_SOURCE_SLOTS[key];
  if (!slot) return;
  _srcSlotDescribe(slot.ids.img);
}

function videoSlotPick(key) {
  const slot = VIDEO_SOURCE_SLOTS[key];
  if (!slot) return;
  switchView('video');
  toast(slot.pickToast || 'Select a video, then click ▷ Use on it', 'ok');
}

// ── WAN 2.7 I2V extend-video helpers ─────────────────────
const _wan27vIds = { info:'wan27vSrcInfo', thumb:'wan27vSrcThumb', img:'wan27vSrcImg', meta:'wan27vSrcMeta', clearBtn:'wan27vSrcClearBtn', describeBtn:'wan27vSrcDescribeBtn' };
VIDEO_SOURCE_SLOTS.wan27v = {
  ids: _wan27vIds,
  set: (id) => { wan27vSrcVideoId = id; },
  pickToast: 'Select a video in the gallery, then click ▷ Use',
};
function wan27vClearSource()        { videoSlotClear('wan27v'); }
async function wan27vSetSource(id)  { return videoSlotSet('wan27v', id); }
function wan27vPickFromGallery()    { videoSlotPick('wan27v'); }
async function wan27vDescribeSource() { await videoSlotDescribe('wan27v'); }

// ── Shared: open describe modal with a thumbnail dataURL ──────
async function _describeFromThumb(thumbDataUrl) {
  const apiKey = localStorage.getItem('gis_apikey') || '';
  if (!apiKey) { toast('Enter Google API key in Setup', 'err'); return; }
  // Extract base64 (strip data:image/jpeg;base64, prefix)
  const comma = thumbDataUrl.indexOf(',');
  const b64   = comma >= 0 ? thumbDataUrl.slice(comma + 1) : thumbDataUrl;
  _describeSource = 'video';
  document.getElementById('dmPreview').src = thumbDataUrl;
  document.getElementById('dmResult').value = '';
  document.getElementById('dmStatus').textContent = '⟳ Generating…';
  document.getElementById('describeModal').classList.add('show');
  setDescribeTab('prompt');
  await _runDescribe(apiKey, b64, 'image/jpeg', 'prompt');
}

// ── V2V / Motion Control helpers ─────────────────────────
const _v2vIds = { info:'v2vSrcInfo', thumb:'v2vSrcThumb', img:'v2vSrcImg', meta:'v2vSrcMeta', clearBtn:'v2vClearBtn', describeBtn:'v2vDescribeBtn' };
// V2V has two input paths (gallery pick + file upload). Registry handles the
// gallery-pick path; file-upload path uses _v2vSetPanel directly.
VIDEO_SOURCE_SLOTS.v2v = {
  ids: _v2vIds,
  set: (id) => { videoMotionFile = null; videoMotionVideoId = id; },
  pickToast: 'Select a video in the gallery, then click ▷ Use',
  clearHook: () => {
    videoMotionFile = null; videoMotionVideoId = null;
    const input = document.getElementById('v2vVideoInput');
    if (input) input.value = '';
  },
};

function _v2vSetPanel(thumbDataUrl, infoText) {
  const el = id => document.getElementById(id);
  if (_v2vIds.info) el(_v2vIds.info).textContent = infoText || '';
  if (thumbDataUrl && el(_v2vIds.img) && el(_v2vIds.thumb)) {
    el(_v2vIds.img).src = thumbDataUrl;
    el(_v2vIds.thumb).style.display = 'block';
  } else if (el(_v2vIds.thumb)) {
    el(_v2vIds.thumb).style.display = 'none';
  }
  if (el(_v2vIds.meta)) el(_v2vIds.meta).innerHTML = '';
  if (el(_v2vIds.clearBtn)) el(_v2vIds.clearBtn).style.display = '';
  if (el(_v2vIds.describeBtn)) el(_v2vIds.describeBtn).style.display = thumbDataUrl ? '' : 'none';
}

async function v2vVideoSelected(files) {
  const file = files?.[0];
  if (!file) return;
  videoMotionFile    = file;
  videoMotionVideoId = null;
  const infoText = `${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`;
  _v2vSetPanel(null, infoText);
  try {
    const thumb = await generateVideoThumb(file);
    if (thumb) _v2vSetPanel(thumb, infoText);
  } catch(e) { /* thumb optional */ }
}

async function v2vSetFromGallery(videoId) {
  videoMotionFile = null;
  videoMotionVideoId = videoId;
  const meta  = await dbGet('video_meta', videoId).catch(() => null);
  const thumb = await dbGet('video_thumbs', videoId).catch(() => null);
  const mb    = meta?.fileSize ? `${(meta.fileSize/1024/1024).toFixed(1)}MB` : '';
  _v2vSetPanel(thumb?.data || null, `${meta?.duration || '?'}s · ${mb}`);
}

function clearV2VVideo() {
  videoSlotClear('v2v');
}

function v2vPickFromGallery()       { videoSlotPick('v2v'); }
async function v2vDescribeSource()  { await videoSlotDescribe('v2v'); }

const _wan27eIds = { info:'wan27eSrcInfo', thumb:'wan27eSrcThumb', img:'wan27eSrcImg', meta:'wan27eSrcMeta', clearBtn:'wan27eSrcClearBtn', describeBtn:'wan27eSrcDescribeBtn' };
VIDEO_SOURCE_SLOTS.wan27e = {
  ids: _wan27eIds,
  set: (id) => { wan27eSrcVideoId = id; },
  pickToast: 'Select a video, then click ▷ Use on it',
};
function wan27eClearSource()        { videoSlotClear('wan27e'); }
async function wan27eSetSource(id)  { return videoSlotSet('wan27e', id); }
async function wan27eDescribeSource() { await videoSlotDescribe('wan27e'); }
async function wan27ePickFromGallery() { videoSlotPick('wan27e'); }

// ── Seedance 2.0 R2V: 3 source video slots ──────────────
const _sd2VidIds = [
  { info:'sd2VidSrc1Info', thumb:'sd2VidSrc1Thumb', img:'sd2VidSrc1Img', meta:'sd2VidSrc1Meta', clearBtn:'sd2VidSrc1ClearBtn', describeBtn:'sd2VidSrc1DescribeBtn' },
  { info:'sd2VidSrc2Info', thumb:'sd2VidSrc2Thumb', img:'sd2VidSrc2Img', meta:'sd2VidSrc2Meta', clearBtn:'sd2VidSrc2ClearBtn', describeBtn:'sd2VidSrc2DescribeBtn' },
  { info:'sd2VidSrc3Info', thumb:'sd2VidSrc3Thumb', img:'sd2VidSrc3Img', meta:'sd2VidSrc3Meta', clearBtn:'sd2VidSrc3ClearBtn', describeBtn:'sd2VidSrc3DescribeBtn' },
];
// Register 3 indexed slots — keys sd2Vid_0..2
for (let i = 0; i < 3; i++) {
  VIDEO_SOURCE_SLOTS[`sd2Vid_${i}`] = {
    ids: _sd2VidIds[i],
    set: ((idx) => (id) => { sd2VidSrc[idx] = id; })(i),
    pickToast: 'Select a video, then click ▷ Use on it',
  };
}
function sd2VidClear(i)               { videoSlotClear(`sd2Vid_${i}`); }
async function sd2VidSet(i, videoId)  { return videoSlotSet(`sd2Vid_${i}`, videoId); }
async function sd2VidDescribe(i)      { await videoSlotDescribe(`sd2Vid_${i}`); }
function sd2VidPick()                 { videoSlotPick('sd2Vid_0'); }
// Routes "▷ Use" from gallery → next empty R2V slot
async function sd2VidUseFromGallery(videoId) {
  const slot = sd2VidSrc.indexOf(null);
  if (slot === -1) { toast('All 3 video slots full — clear one first', 'err'); return; }
  await sd2VidSet(slot, videoId);
  toast(`Video ref ${slot + 1} set`, 'ok');
}

// Called from ▷ Use card button — adds video to source slot of the currently active model
async function useVideoFromGallery(videoId) {
  switchView('gen');
  setGenMode('video');
  const activeKey = getActiveVideoModelKey();
  if (TOPAZ_MODELS[activeKey]) {
    await topazSetSource(videoId);
    toast('Source video set', 'ok');
  } else if (MAGNIFIC_VIDEO_MODELS[activeKey]) {
    await topazSetSource(videoId);  // reuses same source display
    toast('Source video set for Magnific upscale', 'ok');
  } else if (VIDEO_MODELS[activeKey]?.type === 'wan27e_video') {
    await wan27eSetSource(videoId);
    toast('Source video set for WAN 2.7 Edit', 'ok');
  } else if (VIDEO_MODELS[activeKey]?.type === 'grok_video') {
    const grokMode = document.getElementById('grokVideoMode')?.value;
    if (grokMode === 'edit' || grokMode === 'extend') {
      await setGrokVideoSrc(videoId);
      toast(`Source video set for Grok ${grokMode === 'edit' ? 'Edit' : 'Extend'}`, 'ok');
    } else {
      toast('Switch Grok Video mode to Edit or Extend to use a source video', 'info');
    }
  } else if (VIDEO_MODELS[activeKey]?.refMode === 'seedance2_r2v') {
    await sd2VidUseFromGallery(videoId);
  } else if (VIDEO_MODELS[activeKey]?.refMode === 'video_ref') {
    await v2vSetFromGallery(videoId);
    toast('Motion reference video set', 'ok');
  } else if (VIDEO_MODELS[activeKey]?.type === 'wan27_video' && VIDEO_MODELS[activeKey]?.refMode === 'single_end') {
    await wan27vSetSource(videoId);
    toast('Extend source video set for WAN 2.7 I2V', 'ok');
  } else {
    toast('Switch to a model that uses a source video first', 'info');
  }
}
function moveStyleTagsToVideo(isVideo) {
  // Move styleTags div to appear under videoPrompt when in video mode
  const styleTags = document.getElementById('styleTags');
  const videoStyleTarget = document.getElementById('videoStyleTagsSlot');
  const imgSection = document.getElementById('imgLeftContent');
  if (!styleTags) return;
  if (isVideo && videoStyleTarget) {
    videoStyleTarget.appendChild(styleTags);
  } else if (!isVideo && imgSection) {
    // Move back to image panel - after promptSection
    const promptSection = document.querySelector('#imgLeftContent .psec:nth-child(2)');
    if (promptSection) promptSection.after(styleTags);
  }
}

// ── Audio toggle (prominent ON/OFF button) ───────────────
function toggleVideoAudio() {
  const cb = document.getElementById('videoEnableAudio');
  if (cb) { cb.checked = !cb.checked; updateAudioToggleUI(); }
}

function updateAudioToggleUI() {
  const cb = document.getElementById('videoEnableAudio');
  const btn = document.getElementById('videoAudioToggle');
  const ctrl = document.getElementById('videoAudioCtrl');
  if (!cb || !btn) return;
  const on = cb.checked;
  if (on) {
    btn.textContent = '🔊 AUDIO ON';
    btn.style.borderColor = 'var(--accent)';
    btn.style.background = 'rgba(212,160,23,.12)';
    btn.style.color = 'var(--accent)';
  } else {
    btn.textContent = '🔇 AUDIO OFF';
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'none';
    btn.style.color = 'var(--dim)';
  }
}

function setGenMode(mode) {
  const isVideo = mode === 'video';
  // Swap content inside leftPanel — leftPanel itself stays visible always
  const imgContent = document.getElementById('imgLeftContent');
  const vidContent = document.getElementById('videoLeftContent');
  if (imgContent) imgContent.style.display = isVideo ? 'none' : 'contents';
  if (vidContent) {
    vidContent.style.display = isVideo ? 'flex' : 'none';
    if (isVideo) vidContent.style.flexDirection = 'column';
  }
  // Swap center output area
  const centerEl = document.getElementById('center');
  const videoCenterEl = document.getElementById('videoCenter');
  if (centerEl) centerEl.style.display = isVideo ? 'none' : '';
  if (videoCenterEl) {
    videoCenterEl.style.display = isVideo ? 'flex' : 'none';
    if (isVideo) videoCenterEl.style.flexDirection = 'column';
  }
  // Toggle buttons
  document.getElementById('genModeImgBtn').classList.toggle('active', !isVideo);
  document.getElementById('genModeVidBtn').classList.toggle('active', isVideo);
  window.aiPromptContext = isVideo ? 'video' : 'image';
  if (isVideo) { updateVideoFolderDropdown(); updateVideoResInfo(); initVideoCountHighlight(); moveStyleTagsToVideo(isVideo); updateAudioToggleUI(); }
}

// ── Video refs (unified: start frame, end frame, multi-ref) ──
function addVideoRef(asset) {
  const m = VIDEO_MODELS[getActiveVideoModelKey()] || {};
  const max = m.maxRefs || 0;
  const storageMax = max > 0 ? max : REF_GLOBAL_MAX;
  if (videoRefs.length >= storageMax) { toast(`Video reference limit reached (${storageMax})`, 'err'); return; }
  if (videoRefs.some(r => r.assetId === asset.id)) { toast(`${asset.autoName} is already a reference`, 'ok'); return; }
  videoRefs.push({
    assetId: asset.id,
    autoName: asset.autoName,
    userLabel: asset.userLabel || '',
    mimeType: asset.mimeType || 'image/png',
    thumb: asset.thumb || null,
    dims: asset.dims || null,
  });
  // Auto-switch Veo to I2V when first ref is added in T2V mode
  const veoRefModeEl = document.getElementById('veoRefMode');
  if (m.type === 'veo' && veoRefModeEl?.value === 't2v') {
    veoRefModeEl.value = 'i2v';
    onVeoRefModeChange('i2v');
    return; // onVeoRefModeChange calls renderVideoRefPanel
  }
  renderVideoRefPanel();
  if (max === 0) {
    toast(`${asset.autoName} added as video ref — switch model to use it`, 'ok');
  }
  renderAssets?.();  // update REF badge in asset library
}

function removeVideoRef(idx) {
  videoRefs.splice(idx, 1);
  renderVideoRefPanel();
  renderAssets?.();  // update REF badge in asset library
}

// ── Ref label helpers — model-specific naming rules ───────
// Returns the label shown in the thumbnail for a video ref
function getVideoRefDisplayLabel(r, idx, m) {
  const mode = m?.refMode || '';
  if (mode === 'keyframe' || mode === 'single_end') return idx === 0 ? 'Start' : 'End';
  if (mode === 'single')    return 'Start';
  if (mode === 'multi') {
    if (m?.pixverseMode === 'fusion') return `@pic${idx + 1}`;
    return `Element${idx + 1}`;
  }
  if (mode === 'wan_r2v')   return `Character${idx + 1}`; // Wan R2V: fixed API name
  if (mode === 'seedance2_r2v') return `[Image${idx + 1}]`; // Seedance 2.0 R2V
  if (mode === 'video_ref') return 'Character ref';
  return r.userLabel || r.autoName || `Ref ${idx + 1}`;
}

// Returns the text inserted into the prompt when user selects a ref mention
// (without prefix — prefix is added by getVideoRefMentionPrefix)
function getVideoRefMentionText(r, idx, m) {
  const mode = m?.refMode || '';
  if (mode === 'multi') {
    // PixVerse Fusion: @pic1 format; Kling Elements: @Element1
    if (m?.pixverseMode === 'fusion') return `pic${idx + 1}`;
    return `Element${idx + 1}`;
  }
  if (mode === 'wan_r2v') return `Character${idx + 1}`;
  if (mode === 'seedance2_r2v') return `Image${idx + 1}]`; // closing ] — prefix adds [
  return (r.userLabel || r.autoName || `ref${idx + 1}`).replace(/\s+/g, '_');
}

// Returns the trigger prefix for the model — '@' for most, '' for Wan R2V (uses plain words)
function getVideoRefMentionPrefix(m) {
  if (m?.refMode === 'wan_r2v') return '';
  if (m?.refMode === 'seedance2_r2v') return '[';
  return '@';
}

// Returns true for refModes where the thumbnail label is model-fixed (not user-editable)
function isVideoRefLabelFixed(m) {
  const mode = m?.refMode || '';
  return ['keyframe', 'single_end', 'single', 'multi', 'wan_r2v', 'seedance2_r2v', 'video_ref'].includes(mode);
}

function renderVideoRefPanel() {
  const panel = document.getElementById('videoRefPanelScroll');
  const countEl = document.getElementById('videoRefCount');
  const m = VIDEO_MODELS[getActiveVideoModelKey()] || {};
  const max = m.maxRefs || 0;
  if (!panel) return;
  if (countEl) countEl.textContent = `${videoRefs.length} / ${max}`;

  const tiles = videoRefs.map((r, i) => {
    const label = getVideoRefDisplayLabel(r, i, m);
    const fixedLabel = isVideoRefLabelFixed(m);
    const src = r.thumb ? `data:image/jpeg;base64,${r.thumb}` : '';
    const renameAttr = fixedLabel ? '' : `ondblclick="startVideoRefRename(${i}, this)"`;
    return `
    <div class="rth2" data-vidx="${i}">
      <img class="rth2-img" src="${src}" alt="${escHtml(label)}" title="Preview">
      <div class="del-ref2" onclick="event.stopPropagation();removeVideoRef(${i})" title="Remove">×</div>
      <div class="rth2-describe" onclick="event.stopPropagation();describeVideoRef(${i})" title="Describe image">✦ Describe</div>
      <div class="rth2-label" title="${escHtml(label)}" ${renameAttr}>${escHtml(label)}</div>
    </div>`;
  }).join('');

  const addTile = videoRefs.length < max ? `
    <div class="ref-add-tile" id="videoRefAddTile" onclick="document.getElementById('videoRefInput').click()" title="Add ref">
      <span>＋</span>
      <div style="font-size:9px;color:var(--dim2);text-align:center;line-height:1.4;margin-top:2px;">Add ref</div>
    </div>` : '';

  panel.innerHTML = tiles + addTile;

  // Init prev key on first render (so model switches know what to reverse from)
  if (_prevVideoModelKey === null) _prevVideoModelKey = getActiveVideoModelKey();

  // Re-apply model-specific @mention names when refs change (not during model switch)
  if (!_videoModelSwitching && typeof rewriteVideoPromptForModel === 'function') {
    rewriteVideoPromptForModel(m, m);  // same model, refs shifted → re-number
  }
}

// ── Inline rename video ref label (dblclick) ─────────────
function startVideoRefRename(idx, labelEl) {
  if (labelEl.querySelector('input')) return;
  const r = videoRefs[idx];
  const current = r.userLabel || r.autoName || `ref ${idx + 1}`;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.placeholder = 'Ref name…';
  input.style.cssText = 'width:84px;font-size:9px;padding:1px 2px;background:var(--s2);border:1px solid var(--accent);color:var(--text);outline:none;font-family:inherit;';
  labelEl.textContent = '';
  labelEl.appendChild(input);
  input.focus(); input.select();
  const commit = async () => {
    input.remove();
    const val = input.value.trim();
    videoRefs[idx].userLabel = val;
    // If ref came from asset — update asset in DB too (same as startAssetRename)
    if (r.assetId) {
      const asset = await dbGet('assets', r.assetId);
      if (asset) {
        asset.userLabel = val === asset.autoName ? '' : val;
        await dbPut('assets', asset);
        await dbPutAssetMeta(asset);
        // Sync back to any image refs using the same asset
        refs?.forEach(imgRef => { if (imgRef.assetId === r.assetId) imgRef.userLabel = asset.userLabel; });
      }
    }
    renderVideoRefPanel();
    renderAssets?.();
    renderRefThumbs?.();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { videoRefs[idx].userLabel = r.userLabel; input.blur(); }
  });
}

function videoRefFileSelected(files) {
  if (!files || !files.length) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = async e => {
    const mimeType = file.type || 'image/png';
    const b64 = e.target.result.split(',')[1];
    if (!b64) return;
    // Save to assets DB — video refs are asset links, same as image refs
    const asset = await createAsset(b64, mimeType, 'upload');
    addVideoRef(asset);
    // Refresh assets view if open
    if (document.getElementById('assetsView')?.classList.contains('show')) {
      renderAssets?.();
      renderAssetFolders?.();
    }
    toast(`${asset.autoName} added as video reference`, 'ok');
  };
  reader.readAsDataURL(file);
}

// ── Asset picker for video refs ─────────────────────────
// ── Luma character ref helpers (Ray3 only) ───────────────
async function lumaPickCharRef() {
  document.getElementById('lumaCharRefInput')?.click();
}

async function lumaCharRefFileSelected(files) {
  const file = files?.[0];
  if (!file) return;
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = () => rej(new Error('Read error'));
    r.readAsDataURL(file);
  });
  const b64 = dataUrl.split(',')[1];
  const mimeType = file.type || 'image/png';
  const asset = await createAsset(b64, mimeType, 'upload');
  _setLumaCharRef(asset);
  document.getElementById('lumaCharRefInput').value = '';
}

function lumaPickCharRefFromAssets() {
  window._lumaPickingCharRef = true;
  toast('Select an asset to use as character reference', 'ok');
  switchView('assets');
}

function lumaClearCharRef() {
  document.getElementById('lumaCharRefAssetId').value = '';
  document.getElementById('lumaCharRefName').textContent = 'None';
  const clearBtn = document.getElementById('lumaCharRefClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
}

function _setLumaCharRef(asset) {
  document.getElementById('lumaCharRefAssetId').value = asset.id;
  document.getElementById('lumaCharRefName').textContent = asset.userLabel || asset.autoName || 'ref';
  const clearBtn = document.getElementById('lumaCharRefClearBtn');
  if (clearBtn) clearBtn.style.display = '';
}

function videoPickFromAssets(slot) {
  window._videoAssetPickMode = true;
  window._videoAssetPickSlot = slot;
  toast('Select an asset to use as video reference', 'ok');
  switchView('assets');
}

function videoAssetPickConfirm(assetId) {
  // Luma character ref pick
  if (window._lumaPickingCharRef) {
    window._lumaPickingCharRef = false;
    dbGet('assets', assetId).then(asset => {
      if (!asset) return;
      _setLumaCharRef(asset);
      switchView('gen');
      setGenMode('video');
      toast('Character reference set ✓', 'ok');
    });
    return true;
  }
  if (!window._videoAssetPickMode) return false;
  dbGet('assets', assetId).then(asset => {
    if (!asset) return;
    addVideoRef(asset);
    window._videoAssetPickMode = false;
    window._videoAssetPickSlot = null;
    switchView('gen');
    setGenMode('video');
    toast('Reference added ✓', 'ok');
  });
  return true;
}

// ── Video gallery ─────────────────────────────────────────
async function refreshVideoGalleryUI() {
  const [folders, items] = await Promise.all([
    dbGetAll('videoFolders'),
    dbGetAll('video_meta'),
  ]);
  renderVideoFolders(folders, items);
  await renderVideoGallery(items);
  updateVideoFolderDropdown(folders);
  setTimeout(initVideoRubberBand, 100);
  // Background: detect dims for old videos missing outWidth (non-blocking)
  _migrateVideoDimsBackground(items);
}

// Silently detect + store pixel dims for videos that don't have them yet.
// Runs in background after gallery render — doesn't block UI.
async function _migrateVideoDimsBackground(items) {
  const missing = (items || []).filter(m => !m.outWidth);
  if (!missing.length) return;
  for (const meta of missing) {
    try {
      const full = await dbGet('videos', meta.id).catch(() => null);
      if (!full?.videoData) continue;
      const blob = new Blob([full.videoData], { type: full.mimeType || 'video/mp4' });
      const dims = await _topazGetDims(blob).catch(() => null);
      const fps  = _parseMp4Fps(full.videoData);
      if (!dims?.w && !fps) continue;
      // Patch both stores
      if (dims?.w) { meta.outWidth = dims.w; meta.outHeight = dims.h; full.outWidth = dims.w; full.outHeight = dims.h; }
      if (fps && !meta.params?.fps) {
        meta.params = { ...(meta.params || {}), fps };
        full.params = { ...(full.params || {}), fps };
      }
      await dbPut('video_meta', meta);
      await dbPut('videos', full);
      // Patch any rendered card in the DOM
      const card = document.querySelector(`.video-card[data-id="${meta.id}"]`);
      if (card) {
        const infoEl = card.querySelector('.video-card-info');
        if (infoEl) infoEl.textContent = _videoInfoLine(meta);
      }
    } catch(_) {}
    // Small yield between items — don't hammer the CPU
    await new Promise(r => setTimeout(r, 50));
  }
}

function renderVideoFolders(folders, items) {
  const list = document.getElementById('videoFolderList');
  if (!list) return;
  const counts = {};
  (items || []).forEach(i => { const f = i.folder || ''; counts[f] = (counts[f]||0)+1; });
  const allCount = (items||[]).length;
  const dV = (fid) => `ondragover="videoFolderDragOver(event)" ondragenter="videoFolderDragEnter(event,this)" ondragleave="videoFolderDragLeave(event,this)" ondrop="videoFolderDrop(event,'${fid}')"`;

  list.innerHTML = `
    <div class="folder-item ${videoCurrentFolder==='all'?'active':''}" onclick="setVideoFolder('all')" ${dV('all')}>
      <span class="fi">◈</span><span>All videos</span><span class="fc">${allCount}</span>
    </div>
    <div class="folder-item ${videoCurrentFolder==='fav'?'active':''}" onclick="setVideoFolder('fav')">
      <span class="fi">♥</span><span>Favorites</span><span class="fc">${(items||[]).filter(i=>i.favorite).length}</span>
    </div>
    ${(folders||[]).map(f => `
    <div class="folder-item ${videoCurrentFolder===f.id?'active':''}" onclick="setVideoFolder('${f.id}')" ${dV(f.id)}>
      <span class="fi">▸</span><span>${escHtml(f.name)}</span>
      <span class="fc">${counts[f.id]||0}</span>
      <button class="folder-del" onclick="event.stopPropagation();deleteVideoFolder('${f.id}')">✕</button>
    </div>`).join('')}`;
}

async function renderVideoGallery(items) {
  if (!items) items = await dbGetAll('video_meta');
  const grid = document.getElementById('videoGrid');
  const countEl = document.getElementById('videoCount');
  if (!grid) return;

  // Folder filter
  let allFiltered = items || [];
  if (videoCurrentFolder === 'fav') allFiltered = allFiltered.filter(i => i.favorite);
  else if (videoCurrentFolder !== 'all') allFiltered = allFiltered.filter(i => i.folder === videoCurrentFolder);

  // Advanced filters (model, date, search)
  videoFilters.q = document.getElementById('videoSearch')?.value?.toLowerCase().trim() || '';
  let filtered = videoFilterItems(allFiltered);

  // Sort
  const sort = document.getElementById('videoSort')?.value || 'newest';
  filtered.sort((a,b) => sort === 'newest' ? b.ts - a.ts : a.ts - b.ts);

  if (countEl) countEl.textContent = `${filtered.length} video${filtered.length!==1?'s':''}`;
  videoUpdateFilterBanner(filtered.length, allFiltered.length);

  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--dim);font-size:13px;">No videos yet</div>';
    return;
  }

  grid.innerHTML = '';
  for (const item of filtered) {
    const thumb = await dbGet('video_thumbs', item.id).catch(()=>null);
    const thumbSrc = thumb?.data || '';
    const isLiked = item.favorite;
    const isSel = videoSelectedIds.has(item.id);
    const card = document.createElement('div');
    card.className = `video-card${isSel?' selected':''}${isLiked?' favorited':''}${(videoCurrentFolder==='all' && item.folder && item.folder!=='all')?' in-folder':''}`;
    card.dataset.id = item.id;
    card.draggable = true;
    card.addEventListener('dragstart', e => videoDragStart(e, item.id));
    card.innerHTML = `
      <div class="video-thumb-wrap">
        ${thumbSrc ? `<img src="${thumbSrc}" alt="">` : '<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;color:#333;font-size:24px;">🎬</div>'}
        <span class="video-duration-badge">${item.duration || '?'}s</span>
        ${item.params?.enableAudio ? '<span class="video-audio-badge">🔊</span>' : ''}
        <span class="video-liked-badge ${isLiked ? 'on' : 'off'}" onclick="event.stopPropagation();videoToggleLike('${item.id}')">${isLiked ? '♥' : '♡'}</span>
        <span class="video-sel" onclick="event.stopPropagation();videoToggleSelect('${item.id}')">✓</span>
        <div class="video-card-overlay">
          <button class="video-ibtn" onclick="event.stopPropagation();openVideoLightboxById('${item.id}')">▶ Play</button>
          <button class="video-ibtn" onclick="event.stopPropagation();videoDownloadById('${item.id}')">↓ MP4</button>
          <button class="video-ibtn" onclick="event.stopPropagation();reuseVideoJob('${item.id}')">↺ Reuse</button>
          <button class="video-ibtn" onclick="event.stopPropagation();useVideoFromGallery('${item.id}')" style="border-color:rgba(255,255,255,.5);color:#fff;">▷ Use</button>
          <button class="video-ibtn" onclick="event.stopPropagation();openTopazFromGallery('${item.id}')" style="border-color:rgba(212,160,23,.5);color:var(--accent);">✦ Upscale</button>
        </div>
      </div>
      <div class="video-card-meta">
        <div class="video-card-model">${item.model}</div>
        <div class="video-card-info">${_videoInfoLine(item)}</div>
        <div class="video-card-date">${_videoDateStr(item.ts)}</div>
      </div>`;
    card.onclick = e => { if (e.target.closest('button,span.video-sel,span.video-liked-badge')) return; videoCardClick(e, item.id); };
    // Hover playback: 2s delay → play video mini in thumbnail
    // Hover playback — always from local DB data (no CDN dependency)
    {
      let hoverTimer = null;
      card.addEventListener('mouseenter', () => {
        hoverTimer = setTimeout(async () => {
          const wrap = card.querySelector('.video-thumb-wrap');
          if (!wrap || wrap.querySelector('video')) return;
          try {
            const rec = await dbGet('videos', item.id);
            if (!rec?.videoData) return;
            const blob = new Blob([rec.videoData], { type: 'video/mp4' });
            const blobUrl = URL.createObjectURL(blob);
            // Check card is still hovered (user may have left during DB load)
            if (!card.matches(':hover')) { URL.revokeObjectURL(blobUrl); return; }
            const vid = document.createElement('video');
            vid.src = blobUrl;
            vid._blobUrl = blobUrl;
            vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true;
            vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;';
            vid.onerror = () => { URL.revokeObjectURL(blobUrl); vid.remove(); };
            wrap.appendChild(vid);
          } catch { /* DB error — skip hover */ }
        }, 2000);
      });
      card.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        const vid = card.querySelector('.video-thumb-wrap video');
        if (vid) {
          vid.pause();
          if (vid._blobUrl) URL.revokeObjectURL(vid._blobUrl);
          vid.remove();
        }
      });
    }
    grid.appendChild(card);
  }
}

function videoCardClick(e, id) {
  // Plain click = play lightbox; Shift/Alt = rubber-band in initVideoRubberBand
  openVideoLightboxById(id);
}

function videoToggleSelect(id) {
  if (videoSelectedIds.has(id)) videoSelectedIds.delete(id);
  else videoSelectedIds.add(id);
  const card = document.querySelector(`.video-card[data-id="${id}"]`);
  if (card) card.classList.toggle('selected', videoSelectedIds.has(id));
  updateVideoBulkBar();
}

function updateVideoBulkBar() {
  const bar = document.getElementById('videoBulkBar');
  const countEl = document.getElementById('videoSelCount');
  // Unified bulk bar pattern: .lib-bulk.show — viz template.html CSS sekce
  // "UNIFIED LIBRARY TOOLBARS". Ne pouzivat style.display — prepsalo by display:flex
  // nastavene v show class, a bar by se objevil i kdyz nema byt.
  if (bar) bar.classList.toggle('show', videoSelectedIds.size > 0);
  if (countEl) countEl.textContent = videoSelectedIds.size;
}

function videoClearSelection() { videoSelectedIds.clear(); updateVideoBulkBar(); refreshVideoGalleryUI(); }
function videoSelectAll() {
  document.querySelectorAll('.video-card[data-id]').forEach(c => videoSelectedIds.add(c.dataset.id));
  updateVideoBulkBar();
  document.querySelectorAll('.video-card').forEach(c => c.classList.add('selected'));
}

function videoSearchDebounced() {
  clearTimeout(videoSearchTimer);
  videoSearchTimer = setTimeout(() => renderVideoGallery(), 200);
}

// ── Folders ───────────────────────────────────────────────
async function setVideoFolder(id) {
  videoCurrentFolder = id;
  await refreshVideoGalleryUI();
}

async function addVideoFolder() {
  const name = prompt('Folder name:');
  if (!name?.trim()) return;
  await dbPut('videoFolders', { id: `vf_${Date.now()}`, name: name.trim() });
  await refreshVideoGalleryUI();
}

// ── Patch only video_meta — no touch of videos store ───────────────────────
// Used for lightweight metadata changes: folder, favorite.
async function dbPatchVideoMeta(id, patch) {
  const meta = await dbGet('video_meta', id).catch(() => null);
  if (!meta) return;
  Object.assign(meta, patch);
  await dbPut('video_meta', meta);
}

async function deleteVideoFolder(id) {

  // Immediately red-highlight the folder row
  const folderEls = document.querySelectorAll('#videoFolderList .folder-item, #videoFolderList [data-fid]');
  folderEls.forEach(el => {
    if (el.onclick?.toString().includes(id) || el.dataset?.fid === id) {
      el.style.background = 'rgba(200,60,60,.18)';
      el.style.color = '#e07070';
      el.style.pointerEvents = 'none';
    }
  });

  const items = await dbGetAll('video_meta');
  await Promise.all(
    items.filter(m => m.folder === id).map(m => dbPatchVideoMeta(m.id, { folder: '' }))
  );
  await dbDelete('videoFolders', id);
  if (videoCurrentFolder === id) videoCurrentFolder = 'all';
  await refreshVideoGalleryUI();
}

async function updateVideoFolderDropdown(folders) {
  const sel = document.getElementById('videoTargetFolder');
  if (!sel) return;
  if (!folders) folders = await dbGetAll('videoFolders');
  const cur = sel.value;
  sel.innerHTML = '<option value="all">◈ All (no folder)</option>' +
    (folders||[]).map(f => `<option value="${f.id}">${escHtml(f.name)}</option>`).join('');
  if (cur) sel.value = cur;
}

// ── Like / Favorite ──────────────────────────────────────
async function videoToggleLike(id) {
  const meta = await dbGet('video_meta', id).catch(()=>null);
  if (!meta) return;
  const newFav = !meta.favorite;
  await dbPatchVideoMeta(id, { favorite: newFav });

  // Update gallery card UI
  const card = document.querySelector(`.video-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle('favorited', newFav);
    const badge = card.querySelector('.video-liked-badge');
    if (badge) {
      badge.classList.toggle('on', newFav);
      badge.classList.toggle('off', !newFav);
      badge.textContent = newFav ? '♥' : '♡';
    }
  }
  // Update output card (vid-result-card)
  const outCard = document.querySelector(`.vid-result-card[data-vid="${id}"]`);
  if (outCard) {
    outCard.classList.toggle('is-liked', newFav);
    const likeBtn = outCard.querySelector('.like-btn');
    if (likeBtn) {
      likeBtn.textContent = newFav ? '♥ Unlike' : '♡ Like';
      likeBtn.classList.toggle('liked', newFav);
    }
  }
  return newFav;
}

async function videoLikeById(id, btn) {
  const newState = await videoToggleLike(id);
  if (btn) {
    btn.textContent = newState ? '♥ Unlike' : '♡ Like';
    btn.classList.toggle('liked', newState);
  }
}

// ── Download ─────────────────────────────────────────────
async function videoDownloadById(id) {
  const rec = await dbGet('videos', id).catch(()=>null);
  if (!rec?.videoData) { toast('Video not found', 'err'); return; }
  const blob = new Blob([rec.videoData], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `kling-${id}.mp4`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Bulk video download — viditelný progress overlay + file:// protocol awareness.
// Flow:
//   - Na http(s)://: directory picker (FS API) s persistencí downloadDir_videos → silent bulk write
//   - Na file://: sekvenční a.click() do Chrome Downloads (FS API je tam nespolehlivé)
// V obou případech progress overlay během celé operace + toast s jasným výsledkem.
async function videoDownloadSelected() {
  if (!videoSelectedIds.size) return;
  const ids = [...videoSelectedIds];

  // Načíst všechna videa pod progress overlay
  dlProgShow(`↓ Download ${ids.length} video${ids.length > 1 ? 's' : ''}`, 'Loading videos from library…');
  dlProgUpdate('Loading videos from library…', 0, 100);
  await new Promise(r => setTimeout(r, 30));

  const records = [];
  for (let i = 0; i < ids.length; i++) {
    const rec = await dbGet('videos', ids[i]).catch(() => null);
    if (rec?.videoData) records.push(rec);
    if (i % 2 === 1 || i === ids.length - 1) {
      dlProgUpdate(`Loading… ${i + 1} / ${ids.length}`, i + 1, ids.length);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  if (!records.length) {
    dlProgHide();
    toast('No videos to download', 'err');
    return;
  }

  const makeName = (rec) => `${(rec.modelKey || 'video').replace(/[^\w-]/g, '_')}-${new Date(rec.ts).toISOString().slice(0,10)}-${rec.id.slice(-6)}.mp4`;

  try {
    // Primární cesta: directory picker (jen mimo file://)
    if (_HAS_FS_API) {
      let dir = null;
      dlProgHide(); // skryj během picker dialogu
      try {
        dir = await pickDownloadDir('videos', { forceDialog: true });
      } catch (e) {
        console.warn('[GIS] pickDownloadDir(videos) failed:', e);
      }
      if (dir) {
        dlProgShow(`🎬 Saving to "${dir.name}"`, `0 / ${records.length}`);
        let saved = 0, failed = 0;
        const failures = [];
        for (let i = 0; i < records.length; i++) {
          const rec = records[i];
          try {
            const blob = new Blob([rec.videoData], { type: 'video/mp4' });
            await writeFileToDir(dir, makeName(rec), blob);
            saved++;
          } catch (e) {
            failed++;
            failures.push(makeName(rec) + ': ' + e.message);
          }
          dlProgUpdate(`${saved + failed} / ${records.length}`, saved + failed, records.length);
        }
        dlProgHide();
        if (failed === 0) {
          console.log(`[GIS] Saved ${saved} videos to folder "${dir.name}"`);
          toast(`✓ Saved ${saved} video${saved > 1 ? 's' : ''} to "${dir.name}"`, 'ok');
        } else {
          console.error('[GIS] Video save failures:', failures);
          toast(`Saved ${saved}, ${failed} failed — see console`, 'err');
        }
        return;
      }
      // Picker cancelled/failed → pokračovat na fallback
    }

    // Fallback: sekvenční a.click() do Chrome Downloads (funguje i na file://)
    dlProgShow(`🎬 Downloading videos`, `0 / ${records.length} — files go to Chrome Downloads`);
    let saved = 0;
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      try {
        const blob = new Blob([rec.videoData], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = makeName(rec);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        saved++;
      } catch (e) {
        console.error('[GIS] Video download failed:', e);
      }
      dlProgUpdate(`${saved} / ${records.length} — files go to Chrome Downloads`, saved, records.length);
      // Delay je kritický — Chrome blokuje rychlé dávkové downloads
      await new Promise(r => setTimeout(r, 300));
    }
    dlProgHide();
    console.log(`[GIS] Downloaded ${saved} videos to Chrome Downloads`);
    toast(`✓ Downloaded ${saved} video${saved > 1 ? 's' : ''} to Chrome Downloads`, 'ok');
  } catch (e) {
    dlProgHide();
    console.error('[GIS] Video bulk download failed:', e);
    toast('Download failed: ' + e.message, 'err');
  }
}

// ── Video library archive — JSON export/import ──────────────────────
// Analogicky k exportGallery() / importGallery() v gallery.js.
// Ukládá: všechna videa z IDB store 'videos' (s binary videoData jako
// base64) + všechny folders z 'videoFolders'. Binary data jsou Uint8Array
// ── Reuse video setup ─────────────────────────────────────
async function reuseVideoJob(id) {
  if (!id) return;
  // Load meta from video_meta (fast), but load full record for refs (has image data)
  const rec = await dbGet('video_meta', id).catch(() => null);
  const fullRec = await dbGet('videos', id).catch(() => null);
  if (!rec && !fullRec) { toast('Video record not found', 'err'); return;}

  // Switch to video generation page
  switchView('gen');
  setGenMode('video');
  const meta = rec || fullRec;

  // Set prompt
  const promptEl = document.getElementById('videoPrompt');
  if (promptEl) promptEl.value = meta.prompt || '';

  // Set model
  const modelSel = document.getElementById('videoModelSelect');
  if (modelSel && meta.modelKey && VIDEO_MODELS[meta.modelKey]) {
    // Find if this variant belongs to a Kling group
    const groupKey = Object.keys(KLING_GROUPS).find(gk =>
      KLING_GROUPS[gk].variants.some(v => v.key === meta.modelKey)
    );
    if (groupKey) {
      modelSel.value = groupKey;
      onVideoModelChange(groupKey);  // populates klingVersionSelect with group default
      const verSel = document.getElementById('klingVersionSelect');
      if (verSel) { verSel.value = meta.modelKey; _applyVideoModel(meta.modelKey); }
    } else {
      modelSel.value = meta.modelKey;
      onVideoModelChange(meta.modelKey);
    }
  }

  // Set duration
  const dur = meta.params?.duration || meta.duration || 5;
  const durEl = document.getElementById('videoDuration');
  if (durEl) { durEl.value = String(dur); if (typeof updateVideoDurationHighlight !== 'undefined') updateVideoDurationHighlight(); }

  // Set aspect ratio
  const arEl = document.getElementById('videoAspectRatio');
  if (arEl && meta.params?.aspectRatio) arEl.value = meta.params.aspectRatio;

  // Set CFG scale
  const cfgEl = document.getElementById('videoCfgScale');
  const cfgVal = document.getElementById('videoCfgVal');
  if (cfgEl && typeof meta.params?.cfgScale === 'number') {
    cfgEl.value = meta.params.cfgScale;
    if (cfgVal) cfgVal.textContent = meta.params.cfgScale.toFixed(1);
  }

  // Set audio toggle
  const audioEl = document.getElementById('videoEnableAudio');
  if (audioEl && typeof meta.params?.enableAudio === 'boolean') {
    audioEl.checked = meta.params.enableAudio;
    updateAudioToggleUI();
  }

  // ─── v209en metadata unification — apply per-family saved params ──────
  // These write to LEGACY DOM IDs (UI unchanged).  Schema is optional —
  // older meta records skip silently; newer ones fully restore UI state.
  if (meta.params) _applyVideoMetaToLegacyUi(meta.params, meta.modelKey);
  // v223en: after legacy Resolution values are set, refresh the unified
  // segmented-buttons switcher so the active button reflects the reused
  // resolution.  Also refresh the "WxH · aspect" info line.
  {
    const m2 = VIDEO_MODELS[meta.modelKey];
    if (m2 && typeof configureResolutionSwitcher === 'function') {
      configureResolutionSwitcher(m2);
    }
    if (typeof updateResolutionInfo === 'function') updateResolutionInfo();
  }
  // ──────────────────────────────────────────────────────────────────────

  // Restore refs — supports both formats:
  //   v102+:    { assetId, mimeType, autoName, userLabel } → load from assets DB
  //   pre-v102: { data/imageData, mimeType, ... }         → use inline data directly
  const refsSource = fullRec?.usedVideoRefs || rec?.usedVideoRefs || [];
  if (refsSource.length) {
    videoRefs = [];
    const m = VIDEO_MODELS[meta.modelKey] || {};
    const max = m.maxRefs || 10;
    for (const snap of refsSource) {
      if (videoRefs.length >= max) break;

      let imgData = null, mimeType = snap.mimeType || 'image/png', assetId = snap.assetId || null;

      // 1. Try assetId lookup (preferred — gets latest version from DB)
      if (assetId) {
        const asset = await dbGet('assets', assetId).catch(() => null);
        if (asset?.imageData) { imgData = asset.imageData; mimeType = asset.mimeType || mimeType; }
      }
      // 2. Fallback to stored imageData in snapshot (survives asset deletion)
      if (!imgData) imgData = snap.imageData || snap.data || null;
      // 3. Last resort: search assets by autoName — hledame pres meta (bez imageData),
      // az pri shode nacteme plny asset.
      if (!imgData && snap.autoName) {
        const allMeta = await dbGetAllAssetMeta().catch(() => []);
        const foundMeta = allMeta.find(a => a.autoName === snap.autoName || (snap.userLabel && a.userLabel === snap.userLabel));
        if (foundMeta) {
          const found = await dbGet('assets', foundMeta.id).catch(() => null);
          if (found?.imageData) { imgData = found.imageData; mimeType = found.mimeType || mimeType; assetId = found.id; }
        }
      }

      if (!imgData) continue;

      // Ensure asset exists in DB (for future snapshot assetId lookups)
      if (!assetId) {
        const asset = await createAsset(imgData, mimeType, 'reuse').catch(() => null);
        if (asset) assetId = asset.id;
      }

      const thumb = await generateThumb(imgData, mimeType).catch(() => null);
      videoRefs.push({
        assetId,
        data: imgData,
        mimeType,
        autoName: snap.autoName || 'ref',
        userLabel: snap.userLabel || '',
        thumb: thumb || null,
      });
    }
    renderVideoRefPanel();
    renderAssets?.();
    if (videoRefs.length) toast(`Setup loaded · ${videoRefs.length} ref(s) restored ✓`, 'ok');
    else toast('Video setup loaded ✓', 'ok');
  } else {
    toast('Video setup loaded ✓', 'ok');
  }

  // Close lightbox if open
  closeVideoLightbox?.();
}


async function videoDeleteById(id) {
  await dbDelete('videos', id);
  await dbDelete('video_meta', id);
  await dbDelete('video_thumbs', id);
  videoSelectedIds.delete(id);
}

async function videoDeleteSelected() {
  if (!videoSelectedIds.size) return;
  const count = videoSelectedIds.size;
  if (!confirm(`Delete ${count} video(s)? This cannot be undone.`)) return;

  // Progress overlay (videa jsou větší — spouštíme už od 5)
  const showProgress = count >= 5;
  let progressEl = null;
  function setProgress(done) {
    if (!showProgress) return;
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
      progressEl.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);padding:32px 48px;text-align:center;min-width:320px;">
        <div style="font-family:Syne,sans-serif;font-size:22px;font-weight:700;color:#ff6b6b;margin-bottom:12px;">✕ Deleting videos</div>
        <div id="_vdelL2" style="font-size:28px;font-weight:700;font-family:Syne,sans-serif;color:var(--text);"></div>
      </div>`;
      document.body.appendChild(progressEl);
    }
    const el = document.getElementById('_vdelL2');
    if (el) el.textContent = `${done} / ${count}`;
  }
  function hideProgress() { if (progressEl) { document.body.removeChild(progressEl); progressEl = null; } }

  setProgress(0);
  let done = 0;
  for (const id of videoSelectedIds) {
    await videoDeleteById(id);
    done++;
    if (done % 3 === 0 || done === count) {
      setProgress(done);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  hideProgress();
  videoSelectedIds.clear();
  updateVideoBulkBar();
  await refreshVideoGalleryUI();
  toast(`${count} video(s) deleted`, 'ok');
}

// ── Move selected ─────────────────────────────────────────
async function videoMoveSelected() {
  const folders = await dbGetAll('videoFolders');
  if (!folders.length) { toast('No folders — create one first', 'err'); return; }
  const folderId = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);padding:20px;min-width:280px;display:flex;flex-direction:column;gap:8px;">
      <div style="font-family:Syne,sans-serif;font-weight:700;font-size:14px;margin-bottom:4px;">▷ Move ${videoSelectedIds.size} video(s)</div>
      ${folders.map(f => `<button class="ibtn" data-fid="${f.id}" style="justify-content:flex-start;padding:8px 12px;">${escHtml(f.name)}</button>`).join('')}
      <button class="ibtn" data-fid="all" style="justify-content:flex-start;padding:8px 12px;opacity:.7;">◈ All (no folder)</button>
      <button class="ibtn" id="_cancelMoveVid" style="margin-top:4px;">Cancel</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-fid]').forEach(btn => btn.onclick = () => { document.body.removeChild(ov); resolve(btn.dataset.fid); });
    ov.querySelector('#_cancelMoveVid').onclick = () => { document.body.removeChild(ov); resolve(null); };
    ov.onclick = e => { if (e.target === ov) { document.body.removeChild(ov); resolve(null); } };
  });
  if (!folderId) return;
  await Promise.all([...videoSelectedIds].map(id => dbPatchVideoMeta(id, { folder: folderId })));
  videoSelectedIds.clear();
  updateVideoBulkBar();
  await refreshVideoGalleryUI();
}

// ── Video drag-to-folder ───────────────────────────────────
let videoDraggedIds = new Set();

function videoDragStart(e, id) {
  if (videoSelectedIds.has(id)) {
    videoDraggedIds = new Set(videoSelectedIds);
  } else {
    videoDraggedIds = new Set([id]);
  }
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', [...videoDraggedIds].join(','));
}

function videoFolderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function videoFolderDragEnter(e, el) { el.classList.add('drag-over'); }
function videoFolderDragLeave(e, el) { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over'); }

async function videoFolderDrop(e, folderId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!videoDraggedIds.size) return;
  await Promise.all([...videoDraggedIds].map(id => dbPatchVideoMeta(id, { folder: folderId })));
  if (videoDraggedIds.size > 1 || videoSelectedIds.has([...videoDraggedIds][0])) {
    videoSelectedIds.clear();
    updateVideoBulkBar();
  }
  videoDraggedIds = new Set();
  await refreshVideoGalleryUI();
  toast('Moved ✓', 'ok');
}


// ── Lightbox ─────────────────────────────────────────────
async function openVideoLightboxById(id) {
  const rec = await dbGet('videos', id).catch(()=>null);
  if (!rec?.videoData) { toast('Video data not found', 'err'); return; }

  videoLbCurrentId = id;
  videoLbDuration = rec.duration || 5;

  const lb = document.getElementById('videoLightbox');
  const player = document.getElementById('videoLbPlayer');
  const meta = document.getElementById('videoLbMeta');
  const likeBtn = document.getElementById('videoLbLikeBtn');
  const scrub = document.getElementById('videoFrameScrub');

  // Create blob URL
  const blob = new Blob([rec.videoData], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  player.src = url;
  player.onloadedmetadata = () => {
    const dur = player.duration;
    videoLbDuration = dur;
    if (scrub) { scrub.max = dur; scrub.value = 0; }
    document.getElementById('videoFrameTime').textContent = '0.0s';
  };

  // Meta line
  const dateFmt = _videoDateStr(rec.ts);
  const sizeMB = (rec.fileSize/1024/1024).toFixed(1);
  const infoLine = _videoInfoLine(rec);
  meta.textContent = `${rec.model} · ${sizeMB}MB · ${dateFmt} · ${infoLine}`;
  // Like button state — read from video_meta (source of truth for favorite)
  const metaRec = await dbGet('video_meta', id).catch(()=>null);
  const isLiked = !!(metaRec?.favorite);
  if (likeBtn) {
    likeBtn.textContent = isLiked ? '♥ Unlike' : '♡ Like';
    likeBtn.classList.toggle('liked', isLiked);
  }

  lb.classList.add('open');

  // Cleanup old blob URL when video changes
  player._blobUrl = url;
}

function closeVideoLightbox() {
  const lb = document.getElementById('videoLightbox');
  lb.classList.remove('open');
  const player = document.getElementById('videoLbPlayer');
  player.pause();
  if (player._blobUrl) { URL.revokeObjectURL(player._blobUrl); player._blobUrl = null; }
  player.src = '';
  videoLbCurrentId = null;
}

// Lightbox action wrappers — capture ID before closeVideoLightbox clears it
function videoLbTopaz() {
  const id = videoLbCurrentId;
  closeVideoLightbox();
  openTopazFromGallery(id);
}
function videoLbUse() {
  const id = videoLbCurrentId;
  closeVideoLightbox();
  useVideoFromGallery(id);
}

function videoLightboxBgClick(e) {
  if (e.target === document.getElementById('videoLightbox')) closeVideoLightbox();
}

function videoScrubFrame(val) {
  const player = document.getElementById('videoLbPlayer');
  if (player) { player.pause(); player.currentTime = parseFloat(val); }
  const timeEl = document.getElementById('videoFrameTime');
  if (timeEl) timeEl.textContent = parseFloat(val).toFixed(1) + 's';
}

async function videoSaveFrame(which) {
  const player = document.getElementById('videoLbPlayer');
  if (!player || !player.src) { toast('No video loaded', 'err'); return; }

  if (which === 'first') player.currentTime = 0;
  else if (which === 'last') player.currentTime = player.duration || videoLbDuration;

  // Wait for seek if needed
  if (which !== 'current') {
    await new Promise(resolve => {
      const s = () => { player.removeEventListener('seeked', s); resolve(); };
      player.addEventListener('seeked', s);
    });
  }

  const canvas = document.createElement('canvas');
  canvas.width = player.videoWidth || 1920;
  canvas.height = player.videoHeight || 1080;
  canvas.getContext('2d').drawImage(player, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const timeLabel = `${player.currentTime.toFixed(1)}s`;

  await createAsset(base64, 'image/png', 'video_frame', videoLbCurrentId);

  // Visual flash feedback on the button
  const btn = document.querySelector('#videoFrameScrubWrap .vlb-btn');
  if (btn) { btn.classList.remove('flashed'); void btn.offsetWidth; btn.classList.add('flashed'); setTimeout(() => btn.classList.remove('flashed'), 600); }
  toast(`Frame ${timeLabel} saved to Assets ✓`, 'ok');
}

async function videoLbDownload() {
  if (!videoLbCurrentId) return;
  await videoDownloadById(videoLbCurrentId);
}

async function videoLbToggleLike() {
  if (!videoLbCurrentId) return;
  const meta = await dbGet('video_meta', videoLbCurrentId).catch(()=>null);
  if (!meta) return;
  const newState = await videoToggleLike(videoLbCurrentId);
  const btn = document.getElementById('videoLbLikeBtn');
  if (btn) {
    btn.textContent = newState ? '♥ Unlike' : '♡ Like';
    btn.classList.toggle('liked', newState);
  }
}

// ── Keyboard: Escape closes video lightbox ───────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('videoLightbox')?.classList.contains('open')) {
    closeVideoLightbox();
  }
});

// ── WAN 2.7 I2V — fal.ai queue (přímé, bez proxy) ────────
// ── Describe video ref image ──────────────────────────────
async function describeVideoRef(idx) {
  const ref = videoRefs[idx];
  if (!ref) return;

  const apiKey = document.getElementById('apiKey')?.value?.trim()
    || document.getElementById('hiddenApiKey')?.value?.trim()
    || localStorage.getItem('gis_apikey') || '';
  if (!apiKey) { toast('Enter Google API key in Setup', 'err'); return; }

  // Načíst plná data z assets DB (v102+ architektura — videoRefs nemají inline data)
  let imageData = null;
  let safeMime = 'image/jpeg';

  if (ref.assetId) {
    const asset = await dbGet('assets', ref.assetId);
    if (asset?.imageData) {
      imageData = asset.imageData;
      safeMime = asset.mimeType || 'image/jpeg';
    }
  }
  // Fallback: inline data (starší formát)
  if (!imageData && ref.data) {
    imageData = ref.data;
    safeMime = ref.mimeType || 'image/jpeg';
  }

  if (!imageData) {
    toast('Image data not available — try re-adding the reference', 'err');
    return;
  }

  _describeSource = 'video';
  document.getElementById('dmPreview').src = `data:${safeMime};base64,${imageData}`;
  document.getElementById('dmResult').value = '';
  document.getElementById('dmStatus').textContent = '⟳ Generating…';
  document.getElementById('describeModal').classList.add('show');
  setDescribeTab('prompt');
  await _runDescribe(apiKey, imageData, safeMime, 'prompt');
}

// ── Video gallery filter ──────────────────────────────────
const videoFilters = { q: '', models: new Set(), dateFrom: null, dateTo: null };

function toggleVideoFilterPanel() {
  const panel = document.getElementById('videoFilterPanel');
  const btn = document.getElementById('videoFilterBtn');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  if (btn) btn.classList.toggle('filter-on', open);
  if (open) buildVideoModelChips();
}

async function buildVideoModelChips() {
  const items = await dbGetAll('video_meta');
  const models = [...new Set(items.map(i => i.model).filter(Boolean))];
  const el = document.getElementById('videoFilterModels');
  if (!el) return;
  el.innerHTML = models.map(m => `
    <div class="gal-filter-chip ${videoFilters.models.has(m) ? 'on' : ''}"
         onclick="videoToggleModelChip(this,'${escHtml(m)}')">${escHtml(m)}</div>
  `).join('');
}

function videoToggleModelChip(el, model) {
  if (videoFilters.models.has(model)) { videoFilters.models.delete(model); el.classList.remove('on'); }
  else { videoFilters.models.add(model); el.classList.add('on'); }
  videoApplyFilters();
}

function videoApplyFilters() {
  videoFilters.q = document.getElementById('videoSearch')?.value?.toLowerCase().trim() || '';
  const dFrom = document.getElementById('videoFilterFrom')?.value;
  const dTo = document.getElementById('videoFilterTo')?.value;
  videoFilters.dateFrom = dFrom ? new Date(dFrom).getTime() : null;
  videoFilters.dateTo = dTo ? new Date(dTo + 'T23:59:59').getTime() : null;
  renderVideoGallery();
}

function videoClearFilters() {
  videoFilters.q = ''; videoFilters.models.clear();
  videoFilters.dateFrom = null; videoFilters.dateTo = null;
  const sf = document.getElementById('videoSearch'); if (sf) sf.value = '';
  const ff = document.getElementById('videoFilterFrom'); if (ff) ff.value = '';
  const ft = document.getElementById('videoFilterTo'); if (ft) ft.value = '';
  document.getElementById('videoFilterPanel')?.classList.remove('open');
  document.getElementById('videoFilterBtn')?.classList.remove('filter-on');
  renderVideoGallery();
}

function videoFilterItems(items) {
  let result = items;
  if (videoFilters.q) result = result.filter(i =>
    (i.prompt||'').toLowerCase().includes(videoFilters.q) ||
    (i.model||'').toLowerCase().includes(videoFilters.q)
  );
  if (videoFilters.models.size > 0) result = result.filter(i => videoFilters.models.has(i.model));
  if (videoFilters.dateFrom) result = result.filter(i => i.ts >= videoFilters.dateFrom);
  if (videoFilters.dateTo) result = result.filter(i => i.ts <= videoFilters.dateTo);
  return result;
}

function videoUpdateFilterBanner(filtered, total) {
  const banner = document.getElementById('videoFilterBanner');
  const label = document.getElementById('videoFilterBannerLabel');
  const active = videoFilters.q || videoFilters.models.size > 0 || videoFilters.dateFrom || videoFilters.dateTo;
  if (banner) banner.classList.toggle('show', active);
  if (label && active) label.textContent = `${filtered} / ${total} videos`;
}

// ═══════════════════════════════════════════════════════
// @MENTION AUTOCOMPLETE V VIDEO PROMPTU
// (kopie systému z refs.js, pro #videoPrompt textarea)
// ═══════════════════════════════════════════════════════

// Encapsulated mention state (v206en cleanup #4)
const videoMention = { open: false, filter: '', assets: [], activeIdx: -1 };

function initVideoMentionSystem() {
  const ta = document.getElementById('videoPrompt');
  if (!ta) return;
  ta.addEventListener('input', handleVideoMentionInput);
  ta.addEventListener('keydown', handleVideoMentionKeydown);
  document.addEventListener('click', e => {
    if (!e.target.closest('#mentionDropdown') && !e.target.closest('#videoPrompt')) closeVideoMention();
  });
}

async function handleVideoMentionInput(e) {
  const ta = e.target;
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const match = before.match(/@(\w*)$/);
  if (!match) { closeVideoMention(); return; }
  videoMention.filter = match[1].toLowerCase();
  await showVideoMentionDropdown(ta, match.index, pos);
}

async function showVideoMentionDropdown(ta, atStart, curPos) {
  const m = VIDEO_MODELS[getActiveVideoModelKey()] || {};
  const prefix = getVideoRefMentionPrefix(m);
  // Filter refs by mention text matching the typed filter
  videoMention.assets = videoRefs.filter((r, gi) => {
    const text = getVideoRefMentionText(r, gi, m).toLowerCase();
    return !videoMention.filter || text.startsWith(videoMention.filter) || text.includes(videoMention.filter);
  });

  const dd = document.getElementById('mentionDropdown');
  if (!videoMention.assets.length) {
    dd.innerHTML = '<div style="padding:10px 14px;font-size:11px;color:var(--dim2);font-style:italic;">No refs added — add reference images below the prompt first</div>';
  } else {
    dd.innerHTML = videoMention.assets.map((r, i) => {
      const globalIdx = videoRefs.indexOf(r);
      const mentionText = getVideoRefMentionText(r, globalIdx, m);
      const displayLabel = getVideoRefDisplayLabel(r, globalIdx, m);
      const thumbSrc = r.thumb ? `data:image/jpeg;base64,${r.thumb}` : '';
      const insertPreview = prefix + mentionText;
      return `
      <div class="mention-item ${i === videoMention.activeIdx ? 'mi-active' : ''}" data-idx="${i}" onmousedown="insertVideoMention(event,${i})">
        <img class="mi-thumb" src="${thumbSrc}" alt="${escHtml(displayLabel)}">
        <div class="mi-info">
          <div class="mi-name">${escHtml(insertPreview)}</div>
          <div class="mi-sub">${escHtml(r.autoName || '')}</div>
        </div>
        <span class="mi-insert">↵</span>
      </div>`;
    }).join('');
  }

  const taRect = ta.getBoundingClientRect();
  let x = taRect.left + 10;
  let y = taRect.top + ta.scrollTop + 18;
  const ddW = 320;
  if (x + ddW > window.innerWidth) x = window.innerWidth - ddW - 8;
  dd.style.left = x + 'px';
  dd.style.top = y + 'px';
  dd.classList.add('show');
  videoMention.open = true;
  videoMention.activeIdx = -1;
}

function handleVideoMentionKeydown(e) {
  if (!videoMention.open) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    videoMention.activeIdx = Math.min(videoMention.activeIdx + 1, videoMention.assets.length - 1);
    document.querySelectorAll('.mention-item').forEach((el, i) => el.classList.toggle('mi-active', i === videoMention.activeIdx));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    videoMention.activeIdx = Math.max(videoMention.activeIdx - 1, 0);
    document.querySelectorAll('.mention-item').forEach((el, i) => el.classList.toggle('mi-active', i === videoMention.activeIdx));
  } else if (e.key === 'Enter' && videoMention.activeIdx >= 0) {
    e.preventDefault();
    insertVideoMentionByIdx(videoMention.activeIdx);
  } else if (e.key === 'Escape') {
    closeVideoMention();
  }
}

function insertVideoMention(e, idx) {
  e.preventDefault();
  insertVideoMentionByIdx(idx);
}

function insertVideoMentionByIdx(idx) {
  if (idx < 0 || idx >= videoMention.assets.length) return;
  const r = videoMention.assets[idx];
  const m = VIDEO_MODELS[getActiveVideoModelKey()] || {};
  const prefix = getVideoRefMentionPrefix(m);
  const globalIdx = videoRefs.indexOf(r);
  const mentionText = getVideoRefMentionText(r, globalIdx, m);
  const ta = document.getElementById('videoPrompt');
  const val = ta.value;
  const pos = ta.selectionStart;
  const before = val.slice(0, pos);
  const after = val.slice(pos);
  // Replace the @trigger + typed filter with prefix + mentionText
  // For Wan R2V (prefix=''), replace @word → CharacterN (no @ in result)
  const newBefore = before.replace(/@(\w*)$/, prefix + mentionText);
  ta.value = newBefore + after;
  ta.selectionStart = ta.selectionEnd = newBefore.length;
  ta.focus();
  closeVideoMention();
}

function closeVideoMention() {
  document.getElementById('mentionDropdown')?.classList.remove('show');
  videoMention.open = false;
  videoMention.activeIdx = -1;
}

// ── Video prompt live rewriting ───────────────────────────

function initVideoRubberBand() {
  const wrap = document.getElementById('videoGridWrap');
  if (!wrap || wrap._rbInit) return;
  wrap._rbInit = true;

  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target.classList.contains('video-sel') ||
        target.classList.contains('video-liked-badge') ||
        target.tagName === 'BUTTON' || target.tagName === 'INPUT' ||
        target.closest('.gal-bulk') || target.closest('.gal-toolbar') ||
        target.closest('.gal-filter-panel')) return;

    // Shift = rubber-band select; Alt = rubber-band deselect; plain = card click/drag
    if (!e.shiftKey && !e.altKey) return;

    e.preventDefault();
    const mode = e.altKey ? 'deselect' : 'select';
    _startRubberBand(e, 'videoRubberBand', mode, (selBox, m) => {
      document.querySelectorAll('.video-card[data-id]').forEach(el => {
        const r = el.getBoundingClientRect();
        const overlaps = r.left < selBox.right && r.right > selBox.left &&
                         r.top  < selBox.bottom && r.bottom > selBox.top;
        if (!overlaps) return;
        if (m === 'deselect') { videoSelectedIds.delete(el.dataset.id); el.classList.remove('selected'); }
        else { videoSelectedIds.add(el.dataset.id); el.classList.add('selected'); }
      });
      updateVideoBulkBar();
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// v209en metadata unification — write saved per-family params back to the
// original (legacy) UI IDs.  No visual panel changes — we simply populate
// the already-visible per-model controls from the unified schema.
// ═══════════════════════════════════════════════════════════════════════════
function _applyVideoMetaToLegacyUi(params, modelKey) {
  if (!params) return;
  const model = VIDEO_MODELS[modelKey];
  if (!model) return;

  // Negative prompt — v225en: unified vpNegPrompt is the single source.
  if (typeof params.negativePrompt === 'string' &&
      (model.type === 'wan27_video' || model.type === 'pixverse_video')) {
    _setValue('vpNegPrompt', params.negativePrompt);
  }

  // Veo
  // v225en: Resolution via unified helper; duration via unified slider.
  if (params.veo && model.type === 'veo') {
    _setValue('veoRefMode',   params.veo.refMode);
    if (params.veo.resolution) setUnifiedResolution(params.veo.resolution);
    if (typeof onVeoRefModeChange === 'function') onVeoRefModeChange(params.veo.refMode);
  }

  // Luma
  // v225en: Resolution via unified helper; Luma duration was stored as "5s"/"9s"
  //   format — strip 's' suffix and use as number on unified slider.
  if (params.luma && model.type === 'luma_video') {
    if (params.luma.resolution) setUnifiedResolution(params.luma.resolution);
    _setChecked('lumaLoop',     params.luma.loop);
    _setValue('lumaColorMode',  params.luma.colorMode);
  }

  // WAN 2.7 (T2V / I2V / R2V)
  // v225en: resolution/duration via unified helpers.  Prompt expansion and
  //   legacy negative prompt removed — not part of new system.
  if (params.wan27v && model.type === 'wan27_video') {
    const s = params.wan27v;
    if (s.resolution) setUnifiedResolution(s.resolution);
    if (s.duration)   setUnifiedDuration(s.duration);
    _setChecked('wan27vSafety',    s.safety !== false);
    _setValue('wan27vSeed',        s.seed);
    _setValue('wan27vAudioUrl',    s.audioUrl);
  }

  // WAN 2.7 Video Edit
  // v225en: duration='0' means "match source" → unified checkbox, else numeric.
  if (params.wan27e && model.type === 'wan27e_video') {
    const s = params.wan27e;
    if (s.resolution) setUnifiedResolution(s.resolution);
    const matchSrc = (String(s.duration) === '0' || s.duration === 0);
    setUnifiedDurationMatchSource(matchSrc);
    if (!matchSrc && s.duration) setUnifiedDuration(s.duration);
    _setValue('wan27eAspect',     s.aspectRatio);
    _setValue('wan27eAudio',      s.audioSetting);
    _setChecked('wan27eSafety',    s.safety !== false);
    _setValue('wan27eSeed',        s.seed);
  }

  // Seedance 2.0
  // v225en: unified duration slider + Auto checkbox; resolution via helper.
  if (params.seedance2 && model.type === 'seedance2_video') {
    const s = params.seedance2;
    if (s.duration) setUnifiedDuration(s.duration);
    setUnifiedDurationAuto(!!s.autoDuration);
    if (s.resolution) setUnifiedResolution(s.resolution);
    _setValue('sd2Seed',        s.seed);
    // Audio URLs (up to 3)
    if (Array.isArray(s.audioUrls)) {
      _setValue('sd2AudioUrl1', s.audioUrls[0] || '');
      _setValue('sd2AudioUrl2', s.audioUrls[1] || '');
      _setValue('sd2AudioUrl3', s.audioUrls[2] || '');
    }
  }

  // PixVerse
  // v225en: quality (resolution) via unified helper.
  if (params.pixverse && model.type === 'pixverse_video') {
    const s = params.pixverse;
    if (s.quality) setUnifiedResolution(s.quality);
    _setChecked('pixverseMultiClip', s.multiClip);
    _setChecked('pixverseOffPeak',   s.offPeak);
  }

  // Grok Video
  // v225en: mode select stays (mode-first panel above prompt);
  //   resolution/duration via unified helpers.
  if (params.grok && model.type === 'grok_video') {
    const s = params.grok;
    _setValue('grokVideoMode',  s.mode);
    if (typeof onGrokVideoModeChange === 'function' && s.mode) onGrokVideoModeChange(s.mode);
    // setUnified* must come AFTER onGrokVideoModeChange — it applies per-mode
    //   constraints (min/max, allowed values) to the unified slider/buttons.
    if (s.duration)   setUnifiedDuration(s.duration);
    if (s.resolution) setUnifiedResolution(s.resolution);
  }

  // WAN 2.6
  if (params.wan26 && model.type === 'wan_video') {
    if (params.wan26.resolution) setUnifiedResolution(params.wan26.resolution);
  }
}

// Helpers (local to this section — do not collide with other modules)
function _setValue(id, val) {
  if (val === undefined || val === null) return;
  const el = document.getElementById(id);
  if (el && 'value' in el) el.value = val;
}
function _setChecked(id, val) {
  if (val === undefined || val === null) return;
  const el = document.getElementById(id);
  if (el && 'checked' in el) el.checked = !!val;
}
