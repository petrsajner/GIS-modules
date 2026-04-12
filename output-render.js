// ══════════════════════════════════════════════════════════
// QUEUE OVERLAY
// ══════════════════════════════════════════════════════════

let queueOverlayOpen = false;
let _overlayElapsedTicker = null;

function toggleQueueOverlay() {
  queueOverlayOpen = !queueOverlayOpen;
  document.getElementById('queueOverlay').classList.toggle('open', queueOverlayOpen);
  document.getElementById('queueToggleBtn').classList.toggle('active', queueOverlayOpen);
  if (queueOverlayOpen) {
    renderQueueOverlay();
    // Spustit ticker pro elapsed time
    if (!_overlayElapsedTicker) {
      _overlayElapsedTicker = setInterval(() => {
        if (!queueOverlayOpen) { clearInterval(_overlayElapsedTicker); _overlayElapsedTicker = null; return; }
        // Aktualizovat jen .qo-meta elementy běžících jobů bez překreslení celého listu
        document.querySelectorAll('#queueOverlayList .qo-item.running').forEach(el => {
          const jobId = el.closest('[data-jid]')?.dataset.jid;
          if (!jobId) return;
          const job = jobQueue.find(j => j.id === jobId);
          if (!job || !job.startedAt) return;
          const metaEl = el.querySelector('.qo-meta');
          if (metaEl) {
            const elapsed = ((Date.now() - job.startedAt) / 1000).toFixed(0) + 's';
            metaEl.textContent = job.retryAttempt > 0 ? `retry ${job.retryAttempt}/${RETRY_MAX}…` : `generating… ${elapsed}`;
          }
        });
      }, 1000);
    }
  } else {
    clearInterval(_overlayElapsedTicker);
    _overlayElapsedTicker = null;
  }
}

function renderQueueOverlay() {
  if (!queueOverlayOpen) return;

  const list = document.getElementById('queueOverlayList');
  const badge = document.getElementById('qoCountBadge');
  const dot = document.getElementById('queueToggleDot');

  const running = jobQueue.filter(j => j.status === 'running').length;
  const pending = jobQueue.filter(j => j.status === 'pending').length;

  if (badge) {
    const parts = [];
    if (running > 0) parts.push(`${running} running`);
    if (pending > 0) parts.push(`${pending} waiting`);
    badge.textContent = parts.join(', ') || '';
    badge.style.display = parts.length ? '' : 'none';
  }
  if (dot) dot.style.background = running > 0 ? '' : 'var(--dim2)';

  if (!list) return;
  if (!jobQueue.length) {
    list.innerHTML = '<div style="padding:24px 14px;text-align:center;font-size:11px;color:var(--dim2)">Queue is empty</div>';
    return;
  }

  list.innerHTML = jobQueue.map(j => {
    const modelName = j.isUpscale
      ? (j.upscaleMode === 'seedvr'          ? `SeedVR2 ${j.upscaleSeedvrRes}`
       : j.upscaleMode === 'clarity'         ? `Clarity ${j.upscaleFactor}×`
       : j.upscaleMode === 'magnific'        ? (j.magMode === 'precision' ? `Magnific Prec ${j.magPrecVersion || ''}` : `Magnific ${j.magFactor}`)
       : j.upscaleMode === 'topaz_gigapixel' ? `✦ Gigapixel ${j.tGigaFactor}×`
       : j.upscaleMode === 'topaz_bloom'     ? `✦ Bloom ${j.tBloomFactor}×`
       : 'Recraft Crisp')
      : (j.model?.name || j.modelKey || '?');
    const elapsed = j.startedAt ? ((Date.now() - j.startedAt) / 1000).toFixed(0) + 's' : null;
    const statusTxt =
      j.status === 'pending' ? 'waiting to start' :
      j.status === 'running' ? (j.retryAttempt > 0 ? `retry ${j.retryAttempt}/${RETRY_MAX}…` : `generating… ${elapsed ? elapsed : ''}`) :
      j.status === 'done'    ? `✓ done · ${j.elapsed}` :
      `⚠ ${j.errorMsg?.slice(0, 60) || 'error'}`;

    return `
      <div class="qo-item ${j.status}" data-jid="${j.id}">
        <div class="qo-dot ${j.status}"></div>
        <div class="qo-main">
          <div class="qo-model ${j.status}">${modelName}</div>
          <div class="qo-prompt">${escHtml(j.prompt)}</div>
          <div class="qo-meta ${j.status === 'running' ? 'qo-elapsed' : ''}">${statusTxt}</div>
        </div>
        ${j.status === 'pending'
          ? `<button class="qo-cancel-btn" onclick="cancelJob('${j.id}')" title="Cancel">✕</button>`
          : ''}
      </div>`;
  }).join('');
}

// ── Lightbox pro obrázky ve výstupu generování ──
function openOutputLightbox(src) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:400;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:95vw;max-height:95vh;object-fit:contain;display:block;box-shadow:0 0 60px rgba(0,0,0,.9);';
  ov.appendChild(img);
  const close = () => { if (document.body.contains(ov)) document.body.removeChild(ov); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  ov.onclick = close; // klik kdekoliv (i na obrázek) zavírá
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
}

// ── Like button pro výstupní karty ──
function setupLikeBtn(btn, galId) {
  if (!btn) return;
  if (!galId) { btn.style.display = 'none'; return; }
  // Read initial state from metaCache (in-memory, no DB call)
  const meta = (typeof metaCache !== 'undefined' && metaCache)
    ? metaCache.find(m => m.id === galId) : null;
  const initFav = !!(meta?.favorite);
  btn.textContent = initFav ? '♥ Liked' : '♡ Like';
  btn.classList.toggle('liked', initFav);
  const card = btn.closest('.img-card');
  if (card) card.classList.toggle('is-liked', initFav);
  // Toggle — toggleFavoriteItem handles ALL UI sync (gallery card, output card, modal)
  btn.onclick = () => toggleFavoriteItem(galId);
}

// ── Dispatch output rendering based on result type ─────
async function renderOutput(result, prompt, galId) {
  const area = document.getElementById('outputArea');
  document.getElementById('emptyState').style.display = 'none';
  if (result.type === 'gemini') {
    await renderGeminiOutput(area, result, prompt, galId);
  } else {
    await renderImagenOutput(area, result, prompt, galId);
  }
}

async function renderGeminiOutput(area, result, prompt, galId) {
  const ts = new Date().toLocaleTimeString('cs');
  const isHighMode = result.thinkingLevel === 'high';
  const hasThoughtText = result.thoughtText && result.thoughtText.trim().length > 0;

  const div = document.createElement('div');
  div.className = 'img-card';

  const dims = await getImageDimensions(result.finalImage);
  const dimsStr = fmtDims(dims);
  const finalSrc = `data:image/png;base64,${result.finalImage}`;
  const dlName = `${result.model}-${Date.now()}.png`;

  // Thinking log (text only, no images) — nebo spacer pro zarovnání
  let thinkHtml = '';
  if (isHighMode) {
    if (hasThoughtText) {
      thinkHtml = `
        <div class="think-log" id="tl_${Date.now()}">
          <div class="think-log-hdr" onclick="this.closest('.think-log').classList.toggle('open')">
            <div class="think-pulse"></div>
            ◈ Thinking log
            <span class="think-toggle">▼</span>
          </div>
          <div class="think-log-body">${escHtml(result.thoughtText)}</div>
        </div>`;
    } else {
      thinkHtml = `<div class="think-warn">◈ Thinking: High · model didn't provide a text log for this generation</div>`;
    }
  } else {
    // Spacer pro zarovnání s kartami, které mají think-log / think-warn
    thinkHtml = `<div class="img-card-top-spacer"></div>`;
  }

  div.innerHTML = `
    ${thinkHtml}
    <div class="img-wrap" style="cursor:zoom-in">
      <img src="${finalSrc}" alt="Generated">
      <div class="img-card-liked-badge">♥</div>
      <div class="img-overlay">
        <div class="img-overlay-top">
          <span class="ov-badge model">${result.model}</span>
          <span class="ov-badge dims">${dimsStr} · ${result.imageSize || '1K'}</span>
          <span class="ov-badge time">${ts}</span>
          ${result.refs > 0 ? `<span class="ov-badge">${result.refs} ref</span>` : ''}
        </div>
        <div class="img-overlay-bottom">
          <a class="ibtn-ov" href="${finalSrc}" download="${dlName}">↓ PNG</a>
          <button class="ibtn-ov upscale">⬆ Upscale</button>
          <button class="ibtn-ov edit-btn">✦ Edit</button>
          <button class="ibtn-ov addref">⊕ Ref &amp; Assets</button>
          <button class="ibtn-ov annotate">✏ Annotate</button>
          <button class="ibtn-ov reuse">↺ Reuse</button>
          <button class="ibtn-ov like-btn" data-galid="${galId || ''}">♡ Like</button>
      ${result.thoughtImages?.length > 0 ? `<div class="meta-pill">Thought imgs: <b>${result.thoughtImages.length}</b></div>` : ''}
      <div class="meta-pill">Refs: <b>${result.refs}</b></div>
    </div>
  `;

  div.querySelector('.upscale').onclick = () => upscaleWithFactor(result.finalImage, dims);
  div.querySelector('.edit-btn').onclick = () => openEditOverlay(result.finalImage, dims, galId);
  div.querySelector('.addref').onclick = () => addRefFromBase64(result.finalImage, `${result.model}-${Date.now()}.png`);
  div.querySelector('.annotate').onclick = () => openAnnotateModal(result.finalImage, result.model);
  div.querySelector('.reuse').onclick = () => reuseJobById(galId);
  setupLikeBtn(div.querySelector('.like-btn'), galId);
  div.querySelector('.img-wrap').onclick = e => {
    if (e.target.closest('button,a')) return;
    openOutputLightbox(finalSrc);
  };
  if (area) {
    area.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
  }
  return div;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function renderImagenOutput(area, result, prompt, galId) {
  const ts = new Date().toLocaleTimeString('cs');
  const imgData = result.images[0];
  const dims = await getImageDimensions(imgData);
  const dimsStr = fmtDims(dims);
  const src = `data:image/png;base64,${imgData}`;
  const varLabel = result.totalVariants > 1 ? ` #${result.variantNum}/${result.totalVariants}` : '';
  const dlName = `${result.model}${varLabel.replace(/\s/g,'')}-${Date.now()}.png`;

  const div = document.createElement('div');
  div.className = 'img-card';
  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="img-wrap" style="cursor:zoom-in">
      <img src="${src}" alt="Generated">
      <div class="img-card-liked-badge">♥</div>
      <div class="img-overlay">
        <div class="img-overlay-top">
          <span class="ov-badge model">${result.model}${varLabel}</span>
          <span class="ov-badge dims">${dimsStr} · ${result.size}</span>
          <span class="ov-badge time">${ts}</span>
          ${result.seed !== '—' ? `<span class="ov-badge">seed: ${result.seed}</span>` : ''}
        </div>
        <div class="img-overlay-bottom">
          <a class="ibtn-ov" href="${src}" download="${dlName}">↓ PNG</a>
          <button class="ibtn-ov upscale">⬆ Upscale</button>
          <button class="ibtn-ov edit-btn">✦ Edit</button>
          <button class="ibtn-ov addref">⊕ Ref &amp; Assets</button>
          <button class="ibtn-ov annotate">✏ Annotate</button>
          <button class="ibtn-ov reuse">↺ Reuse</button>
          <button class="ibtn-ov like-btn" data-galid="${galId || ''}">♡ Like</button>
        </div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill">Resolution: <b>${dimsStr}</b></div>
      <div class="meta-pill">API size: <b>${result.size}</b></div>
      <div class="meta-pill">Ratio: <b>${result.ratio}</b></div>
      <div class="meta-pill">Seed: <b>${result.seed}</b></div>
    </div>
  `;
  div.querySelector('.upscale').onclick = () => upscaleWithFactor(imgData, dims);
  div.querySelector('.edit-btn').onclick = () => openEditOverlay(imgData, dims, galId);
  div.querySelector('.addref').onclick = () => addRefFromBase64(imgData, `${result.model}-${Date.now()}.png`);
  div.querySelector('.annotate').onclick = () => openAnnotateModal(imgData, result.model);
  div.querySelector('.reuse').onclick = () => reuseJobById(galId);
  setupLikeBtn(div.querySelector('.like-btn'), galId);
  div.querySelector('.img-wrap').onclick = e => {
    if (e.target.closest('button,a')) return;
    openOutputLightbox(src);
  };
  if (area) {
    area.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
  }
  return div;
}

// ── Get image dimensions from base64 ──
function getImageDimensions(b64data) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = `data:image/png;base64,${b64data}`;
  });
}

function fmtDims(dims) {
  if (!dims) return '?×?';
  return `${dims.w}×${dims.h}`;
}

// Parsuje "1024×768" zpět na {w, h}
function parseDimsStr(str) {
  if (!str) return { w: 0, h: 0 };
  const m = str.match(/(\d+)[×x](\d+)/);
  return m ? { w: parseInt(m[1]), h: parseInt(m[2]) } : { w: 0, h: 0 };
}

// Upscale — shows mode+factor dialog then adds to queue
async function upscaleWithFactor(b64data, currentDims) {
  // fal.ai upscalers have no hard resolution cap — but warn if already very large
  const MAX_LONG_SIDE = 8000;
  const longSide = currentDims ? Math.max(currentDims.w, currentDims.h) : 0;
  if (longSide >= MAX_LONG_SIDE) {
    toast(`Image is already high resolution (${fmtDims(currentDims)}), upscale not recommended.`, 'err');
    return;
  }

  const result = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:400;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--s1);border:1px solid var(--border);padding:22px;min-width:360px;max-width:440px;">
        <div style="font-family:Syne,sans-serif;font-weight:700;font-size:15px;margin-bottom:14px;color:var(--purple)">⬆ Upscale</div>

        <div style="font-size:11px;color:var(--dim);margin-bottom:16px;line-height:1.8;">
          Zdroj: <b style="color:var(--text)">${fmtDims(currentDims)}</b>
        </div>

        <!-- Mode selector -->
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:8px;">Mode</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);transition:border-color .15s;" id="upMode_crisp_lbl">
            <input type="radio" name="upMode" value="crisp" checked style="margin-top:2px;accent-color:var(--purple);">
            <div>
              <div style="font-weight:600;color:var(--text);margin-bottom:2px;">Recraft Crisp <span style="color:var(--dim2);font-weight:400;">— $0.004 / obrázek</span></div>
              <div style="color:var(--dim2);">Faithful upscale without hallucinations. Photos, portraits, products, text.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);transition:border-color .15s;" id="upMode_seedvr_lbl">
            <input type="radio" name="upMode" value="seedvr" style="margin-top:2px;accent-color:var(--purple);">
            <div>
              <div style="font-weight:600;color:var(--text);margin-bottom:2px;">SeedVR2 <span style="color:var(--dim2);font-weight:400;">— $0.001 / MP</span></div>
              <div style="color:var(--dim2);">Diffusion-enhanced, top-quality portraits and textures. Target resolution selector.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);transition:border-color .15s;" id="upMode_clarity_lbl">
            <input type="radio" name="upMode" value="clarity" style="margin-top:2px;accent-color:var(--purple);">
            <div>
              <div style="font-weight:600;color:var(--text);margin-bottom:2px;">Clarity Upscaler <span style="color:var(--dim2);font-weight:400;">— compute</span></div>
              <div style="color:var(--dim2);">Creative, adds detail. AI art, illustrations. Prompt control.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);transition:border-color .15s;" id="upMode_magnific_lbl">
            <input type="radio" name="upMode" value="magnific" style="margin-top:2px;accent-color:var(--purple);">
            <div>
              <div style="font-weight:600;color:var(--text);margin-bottom:2px;">Magnific <span style="color:var(--dim2);font-weight:400;">— €0.10–0.50 / img · proxy ✦</span></div>
              <div style="color:var(--dim2);">Industry-leading quality. 3 engines: Sparkle, Sharpy, Illusio. Up to 16×.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);transition:border-color .15s;" id="upMode_tgigapixel_lbl">
            <input type="radio" name="upMode" value="topaz_gigapixel" style="margin-top:2px;accent-color:var(--purple);">
            <div>
              <div style="font-weight:600;color:var(--text);margin-bottom:2px;">✦ Topaz Gigapixel <span style="color:var(--dim2);font-weight:400;">— 1 credit / 24MP · proxy</span></div>
              <div style="color:var(--dim2);">Precision upscaling. Photos, AI art, faces. Very low cost. Same Topaz key.</div>
            </div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);transition:border-color .15s;" id="upMode_tbloom_lbl">
            <input type="radio" name="upMode" value="topaz_bloom" style="margin-top:2px;accent-color:var(--purple);">
            <div>
              <div style="font-weight:600;color:var(--text);margin-bottom:2px;">✦ Topaz Bloom <span style="color:var(--dim2);font-weight:400;">— 1 credit / 2MP · proxy</span></div>
              <div style="color:var(--dim2);">Creative upscaling for AI art. Up to 8×. Adds texture and detail. Optional prompt.</div>
            </div>
          </label>
        </div>

        <!-- SeedVR2 options (hidden by default) -->
        <div id="upSeedvrOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Target resolution</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${[['720p','HD'],['1080p','FHD'],['1440p','2K'],['2160p','4K']].map(([v,l],i) => `<label style="flex:1;text-align:center;padding:5px 2px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);" id="upSvRes_${v}">
              <input type="radio" name="upSvRes" value="${v}" ${i===1?'checked':''} style="display:none;">
              <span style="pointer-events:none;display:block;font-weight:600;">${l}</span><span style="pointer-events:none;font-size:9px;color:var(--dim2);">${v}</span>
            </label>`).join('')}
          </div>
          <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Noise scale <span id="upNoiseVal" style="color:var(--accent);">0.10</span> <span style="color:var(--dim2);">(0 = max věrnost, vyšší = více rekonstrukce)</span></div>
          <input type="range" id="upNoise" min="0" max="0.5" step="0.05" value="0.1" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upNoiseVal').textContent=parseFloat(this.value).toFixed(2)">
        </div>

        <!-- Clarity options (hidden by default) -->
        <div id="upClarityOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Upscale faktor <span style="color:var(--dim2);text-transform:none;letter-spacing:0;font-weight:400;">(max 4× — fal.ai limit)</span></div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${['2','4'].map(f => `<label style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);">
              <input type="radio" name="upFactor" value="${f}" ${f==='2'?'checked':''} style="display:none;">
              <span style="pointer-events:none;">${f}×</span>
            </label>`).join('')}
          </div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Prompt <span style="color:var(--dim2);text-transform:none;letter-spacing:0;">(optional)</span></div>
          <input type="text" id="upClarityPrompt" placeholder="masterpiece, best quality, highres" style="width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 9px;outline:none;margin-bottom:10px;">
          <div style="display:flex;gap:12px;">
            <div style="flex:1;">
              <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Creativity <span id="upCreativityVal" style="color:var(--accent);">0.35</span></div>
              <input type="range" id="upCreativity" min="0" max="1" step="0.05" value="0.35" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upCreativityVal').textContent=parseFloat(this.value).toFixed(2)">
            </div>
            <div style="flex:1;">
              <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Resemblance <span id="upResemblanceVal" style="color:var(--accent);">0.6</span></div>
              <input type="range" id="upResemblance" min="0" max="1" step="0.05" value="0.6" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upResemblanceVal').textContent=parseFloat(this.value).toFixed(2)">
            </div>
          </div>
          <div style="margin-top:10px;">
            <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Steps <span id="upStepsVal" style="color:var(--accent);">18</span></div>
            <input type="range" id="upSteps" min="10" max="50" step="1" value="18" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upStepsVal').textContent=this.value">
          </div>
        </div>

        <!-- Magnific options (hidden by default) -->
        <div id="upMagnificOpts" style="display:none;margin-bottom:16px;">
          <!-- Creative / Precision toggle -->
          <div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border);overflow:hidden;">
            <button type="button" id="upMagModeCreative" style="flex:1;padding:8px 0;background:var(--purple);color:#fff;border:none;cursor:pointer;font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:.03em;">Creative</button>
            <button type="button" id="upMagModePrecision" style="flex:1;padding:8px 0;background:var(--s2);color:var(--dim);border:none;border-left:1px solid var(--border);cursor:pointer;font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:.03em;">Precision</button>
          </div>
          <input type="hidden" id="upMagMode" value="creative">

          <!-- Creative panel -->
          <div id="upMagCreativePanel">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Scale factor</div>
            <div style="display:flex;gap:6px;margin-bottom:12px;">
              ${['2x','4x','8x','16x'].map((f,i) => `<label style="flex:1;text-align:center;padding:5px 0;border:1px solid ${i===1?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===1?'var(--purple)':'var(--dim)'};" id="upMagFactor_${f}">
                <input type="radio" name="upMagFactor" value="${f}" ${i===1?'checked':''} style="display:none;">${f}
              </label>`).join('')}
            </div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Engine</div>
            <div style="display:flex;gap:6px;margin-bottom:12px;">
              ${[['magnific_sparkle','Sparkle'],['magnific_sharpy','Sharpy'],['magnific_illusio','Illusio']].map(([v,l],i) => `<label style="flex:1;text-align:center;padding:5px 2px;border:1px solid ${i===0?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===0?'var(--purple)':'var(--dim)'};" id="upMagEngine_${i}">
                <input type="radio" name="upMagEngine" value="${v}" ${i===0?'checked':''} style="display:none;">${l}
              </label>`).join('')}
            </div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Optimized for</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">
              ${[['standard','Standard'],['portrait','Portrait'],['3d','3D'],['game-assets','Games'],['illustration','Illust']].map(([v,l],i) => `<label style="padding:5px 8px;border:1px solid ${i===0?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===0?'var(--purple)':'var(--dim)'};" id="upMagOptFor_${i}">
                <input type="radio" name="upMagOptFor" value="${v}" ${i===0?'checked':''} style="display:none;">${l}
              </label>`).join('')}
            </div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Prompt <span style="color:var(--dim2);text-transform:none;letter-spacing:0;">(optional)</span></div>
            <input type="text" id="upMagPrompt" placeholder="e.g. detailed skin texture, sharp eyes" style="width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 9px;outline:none;margin-bottom:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Creativity <span id="upMagCreativityVal" style="color:var(--accent);">2</span></div>
                <input type="range" id="upMagCreativity" min="-3" max="3" step="1" value="2" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upMagCreativityVal').textContent=this.value">
              </div>
              <div>
                <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">HDR <span id="upMagHdrVal" style="color:var(--accent);">0</span></div>
                <input type="range" id="upMagHdr" min="-3" max="3" step="1" value="0" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upMagHdrVal').textContent=this.value">
              </div>
              <div>
                <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Resemblance <span id="upMagResemblanceVal" style="color:var(--accent);">0</span></div>
                <input type="range" id="upMagResemblance" min="-3" max="3" step="1" value="0" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upMagResemblanceVal').textContent=this.value">
              </div>
              <div>
                <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Fractality <span id="upMagFractalityVal" style="color:var(--accent);">-1</span></div>
                <input type="range" id="upMagFractality" min="-3" max="3" step="1" value="-1" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upMagFractalityVal').textContent=this.value">
              </div>
            </div>
          </div>

          <!-- Precision panel -->
          <div id="upMagPrecisionPanel" style="display:none;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Version</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">
              ${[['v2_sublime','v2 (sublime)'],['v2_photo','v2 (photo)'],['v2_photo_denoiser','v2 (photo denoiser)'],['v1_hdr','v1 (high HDR)']].map(([v,l],i) => `<label style="padding:5px 8px;border:1px solid ${i===0?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===0?'var(--purple)':'var(--dim)'};white-space:nowrap;" id="upMagPrecVer_${i}">
                <input type="radio" name="upMagPrecVersion" value="${v}" ${i===0?'checked':''} style="display:none;">${l}
              </label>`).join('')}
            </div>
            <div id="upMagPrecScaleRow" style="margin-bottom:12px;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Scale factor</div>
              <div style="display:flex;gap:6px;">
                ${['2','4','8','16'].map((f,i) => `<label style="flex:1;text-align:center;padding:5px 0;border:1px solid ${i===0?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===0?'var(--purple)':'var(--dim)'};" id="upMagPrecFactor_${f}">
                  <input type="radio" name="upMagPrecFactor" value="${f}" ${i===0?'checked':''} style="display:none;">${f}×
                </label>`).join('')}
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
              <div>
                <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Sharpen <span id="upMagPrecSharpenVal" style="color:var(--purple);">7</span></div>
                <input type="range" id="upMagPrecSharpen" min="0" max="100" step="1" value="7" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upMagPrecSharpenVal').textContent=this.value">
              </div>
              <div>
                <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Smart grain <span id="upMagPrecGrainVal" style="color:var(--purple);">7</span></div>
                <input type="range" id="upMagPrecGrain" min="0" max="100" step="1" value="7" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upMagPrecGrainVal').textContent=this.value">
              </div>
              <div>
                <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Ultra detail <span id="upMagPrecDetailVal" style="color:var(--purple);">30</span></div>
                <input type="range" id="upMagPrecDetail" min="0" max="100" step="1" value="30" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upMagPrecDetailVal').textContent=this.value">
              </div>
            </div>
          </div>
        </div>

        <!-- Topaz Gigapixel options (hidden by default) -->
        <div id="upTopazGigaOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Model</div>
          <select id="upTGigaModel" style="width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 9px;outline:none;margin-bottom:10px;">
            <option value="Upscale Standard" selected>Standard — photos, balanced</option>
            <option value="Upscale High Fidelity">High Fidelity — max fidelity</option>
            <option value="Upscale Low Resolution">Low Resolution — blurry/low-res inputs</option>
            <option value="Upscale CGI">CGI — AI art, illustrations</option>
            <option value="Face Recovery Natural">Face Recovery — generative face recovery</option>
            <option value="Text Recovery">Text & Shapes — text, graphics</option>
          </select>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Scale factor</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${['2','4','6'].map((f,i) => `<label style="flex:1;text-align:center;padding:5px 0;border:1px solid ${i===0?'var(--accent)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===0?'var(--accent)':'var(--dim)'};" id="upTGigaFactor_${f}">
              <input type="radio" name="upTGigaFactor" value="${f}" ${i===0?'checked':''} style="display:none;">${f}×
            </label>`).join('')}
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dim);cursor:pointer;margin-bottom:6px;">
            <input type="checkbox" id="upTGigaFace" style="accent-color:var(--accent);">
            Face enhancement (generative)
          </label>
        </div>

        <!-- Topaz Bloom options (hidden by default) -->
        <div id="upTopazBloomOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Model</div>
          <select id="upTBloomModel" style="width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 9px;outline:none;margin-bottom:10px;">
            <option value="Bloom" selected>Bloom — AI art, prompt-guided detail</option>
            <option value="Bloom Realism">Bloom Realism — realistic faces, skin detail</option>
            <option value="Wonder 2">Wonder 2 — advanced generative realism</option>
          </select>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Scale factor</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${['1','2','4','6','8'].map((f,i) => `<label style="flex:1;text-align:center;padding:5px 0;border:1px solid ${i===1?'var(--accent)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===1?'var(--accent)':'var(--dim)'};" id="upTBloomFactor_${f}">
              <input type="radio" name="upTBloomFactor" value="${f}" ${i===1?'checked':''} style="display:none;">${f}×
            </label>`).join('')}
          </div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Creativity</div>
          <select id="upTBloomCreativity" style="width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 9px;outline:none;margin-bottom:10px;">
            <option value="2">Subtle (2)</option>
            <option value="3" selected>Low (3)</option>
            <option value="5">Medium (5)</option>
            <option value="7">High (7)</option>
            <option value="9">Max (9)</option>
          </select>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:4px;">Prompt <span style="color:var(--dim2);text-transform:none;letter-spacing:0;">(optional, Bloom only)</span></div>
          <input type="text" id="upTBloomPrompt" placeholder="e.g. detailed skin texture, sharp eyes" style="width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 9px;outline:none;">
        </div>

        <div style="display:flex;gap:8px;">
          <button class="ibtn" id="confirmUpscale" style="flex:1;justify-content:center;padding:10px;border-color:var(--purple);color:var(--purple);">▶ Run upscale</button>
          <button class="ibtn" id="cancelUpscale" style="justify-content:center;padding:10px;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Mode radio — toggle options visibility + label borders
    const modeRadios = overlay.querySelectorAll('input[name="upMode"]');
    const clarityOpts = overlay.querySelector('#upClarityOpts');
    const seedvrOpts = overlay.querySelector('#upSeedvrOpts');
    const magnificOpts = overlay.querySelector('#upMagnificOpts');
    const topazGigaOpts = overlay.querySelector('#upTopazGigaOpts');
    const topazBloomOpts = overlay.querySelector('#upTopazBloomOpts');
    const updateModeBorders = () => {
      const sel = overlay.querySelector('input[name="upMode"]:checked')?.value;
      overlay.querySelector('#upMode_crisp_lbl').style.borderColor    = sel === 'crisp'           ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_seedvr_lbl').style.borderColor   = sel === 'seedvr'          ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_clarity_lbl').style.borderColor  = sel === 'clarity'         ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_magnific_lbl').style.borderColor = sel === 'magnific'        ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_tgigapixel_lbl').style.borderColor = sel === 'topaz_gigapixel' ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_tbloom_lbl').style.borderColor   = sel === 'topaz_bloom'     ? 'var(--purple)' : 'var(--border)';
      seedvrOpts.style.display       = sel === 'seedvr'          ? 'block' : 'none';
      clarityOpts.style.display      = sel === 'clarity'         ? 'block' : 'none';
      magnificOpts.style.display     = sel === 'magnific'        ? 'block' : 'none';
      topazGigaOpts.style.display    = sel === 'topaz_gigapixel' ? 'block' : 'none';
      topazBloomOpts.style.display   = sel === 'topaz_bloom'     ? 'block' : 'none';
    };
    modeRadios.forEach(r => r.addEventListener('change', updateModeBorders));
    // Factor labels — highlight selected
    overlay.querySelectorAll('input[name="upFactor"]').forEach(r => r.addEventListener('change', () => {
      overlay.querySelectorAll('label:has(input[name="upFactor"])').forEach(l => {
        l.style.borderColor = l.querySelector('input').checked ? 'var(--purple)' : 'var(--border)';
        l.style.color = l.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)';
      });
    }));
    // SeedVR resolution labels — highlight selected
    overlay.querySelectorAll('input[name="upSvRes"]').forEach(r => r.addEventListener('change', () => {
      ['720p','1080p','1440p','2160p'].forEach(v => {
        const lbl = overlay.querySelector(`#upSvRes_${v}`);
        if (lbl) {
          lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)';
          lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)';
        }
      });
    }));
    // Magnific factor labels — highlight selected
    overlay.querySelectorAll('input[name="upMagFactor"]').forEach(r => r.addEventListener('change', () => {
      ['2x','4x','8x','16x'].forEach(f => {
        const lbl = overlay.querySelector(`#upMagFactor_${f}`);
        if (lbl) {
          lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)';
          lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)';
        }
      });
    }));
    // Magnific engine labels — highlight selected
    overlay.querySelectorAll('input[name="upMagEngine"]').forEach(r => r.addEventListener('change', () => {
      [0,1,2].forEach(i => {
        const lbl = overlay.querySelector(`#upMagEngine_${i}`);
        if (lbl) {
          lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)';
          lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)';
        }
      });
    }));
    // Magnific optimized-for radio labels
    overlay.querySelectorAll('input[name="upMagOptFor"]').forEach(r => r.addEventListener('change', () => {
      [0,1,2,3,4].forEach(i => {
        const lbl = overlay.querySelector(`#upMagOptFor_${i}`);
        if (lbl) {
          lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)';
          lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)';
        }
      });
    }));
    // Magnific Creative/Precision toggle
    const magModeInput = overlay.querySelector('#upMagMode');
    const magCreativePanel = overlay.querySelector('#upMagCreativePanel');
    const magPrecisionPanel = overlay.querySelector('#upMagPrecisionPanel');
    const updateMagMode = (mode) => {
      magModeInput.value = mode;
      const isCreative = mode === 'creative';
      overlay.querySelector('#upMagModeCreative').style.background = isCreative ? 'var(--purple)' : 'var(--s2)';
      overlay.querySelector('#upMagModeCreative').style.color = isCreative ? '#fff' : 'var(--dim)';
      overlay.querySelector('#upMagModePrecision').style.background = !isCreative ? 'var(--purple)' : 'var(--s2)';
      overlay.querySelector('#upMagModePrecision').style.color = !isCreative ? '#fff' : 'var(--dim)';
      magCreativePanel.style.display = isCreative ? 'block' : 'none';
      magPrecisionPanel.style.display = !isCreative ? 'block' : 'none';
    };
    overlay.querySelector('#upMagModeCreative').onclick = () => updateMagMode('creative');
    overlay.querySelector('#upMagModePrecision').onclick = () => updateMagMode('precision');
    // Magnific Precision version — toggle scale row visibility for v1_hdr
    const updatePrecVersion = () => {
      const ver = overlay.querySelector('input[name="upMagPrecVersion"]:checked')?.value || 'v2_sublime';
      const scaleRow = overlay.querySelector('#upMagPrecScaleRow');
      if (scaleRow) scaleRow.style.display = ver === 'v1_hdr' ? 'none' : 'block';
      [0,1,2,3].forEach(i => {
        const lbl = overlay.querySelector(`#upMagPrecVer_${i}`);
        if (lbl) {
          lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)';
          lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)';
        }
      });
    };
    overlay.querySelectorAll('input[name="upMagPrecVersion"]').forEach(r => r.addEventListener('change', updatePrecVersion));
    // Magnific Precision factor labels
    overlay.querySelectorAll('input[name="upMagPrecFactor"]').forEach(r => r.addEventListener('change', () => {
      ['2','4','8','16'].forEach(f => {
        const lbl = overlay.querySelector(`#upMagPrecFactor_${f}`);
        if (lbl) {
          lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)';
          lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)';
        }
      });
    }));
    // Topaz Gigapixel factor labels — highlight selected
    overlay.querySelectorAll('input[name="upTGigaFactor"]').forEach(r => r.addEventListener('change', () => {
      ['2','4','6'].forEach(f => {
        const lbl = overlay.querySelector(`#upTGigaFactor_${f}`);
        if (lbl) {
          lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--accent)' : 'var(--border)';
          lbl.style.color = lbl.querySelector('input').checked ? 'var(--accent)' : 'var(--dim)';
        }
      });
    }));
    // Topaz Bloom factor labels — highlight selected
    overlay.querySelectorAll('input[name="upTBloomFactor"]').forEach(r => r.addEventListener('change', () => {
      ['1','2','4','6','8'].forEach(f => {
        const lbl = overlay.querySelector(`#upTBloomFactor_${f}`);
        if (lbl) {
          lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--accent)' : 'var(--border)';
          lbl.style.color = lbl.querySelector('input').checked ? 'var(--accent)' : 'var(--dim)';
        }
      });
    }));
    // Init borders
    updateModeBorders();
    // Init 1080p border for seedvr
    const initSvRes = overlay.querySelector('#upSvRes_1080p');
    if (initSvRes) initSvRes.style.borderColor = 'var(--purple)';
    // Init 2x border for Clarity factor
    const initFactor = overlay.querySelector('input[name="upFactor"][value="2"]');
    if (initFactor) {
      const lbl = initFactor.closest('label');
      if (lbl) { lbl.style.borderColor = 'var(--purple)'; lbl.style.color = 'var(--purple)'; }
    }

    overlay.querySelector('#confirmUpscale').onclick = () => {
      const mode = overlay.querySelector('input[name="upMode"]:checked')?.value || 'crisp';
      const factor = overlay.querySelector('input[name="upFactor"]:checked')?.value || '2';
      const clarityPrompt = overlay.querySelector('#upClarityPrompt')?.value?.trim() || '';
      const creativity = parseFloat(overlay.querySelector('#upCreativity')?.value || '0.35');
      const resemblance = parseFloat(overlay.querySelector('#upResemblance')?.value || '0.6');
      const seedvrRes = overlay.querySelector('input[name="upSvRes"]:checked')?.value || '1080p';
      const noiseScale = parseFloat(overlay.querySelector('#upNoise')?.value || '0.1');
      const claritySteps = parseInt(overlay.querySelector('#upSteps')?.value || '18');
      // Magnific params
      const magMode = overlay.querySelector('#upMagMode')?.value || 'creative';
      const magFactor = overlay.querySelector('input[name="upMagFactor"]:checked')?.value || '2x';
      const magEngine = overlay.querySelector('input[name="upMagEngine"]:checked')?.value || 'magnific_sparkle';
      const magOptFor = overlay.querySelector('input[name="upMagOptFor"]:checked')?.value || 'standard';
      const magPrompt = overlay.querySelector('#upMagPrompt')?.value?.trim() || '';
      const magCreativity = parseInt(overlay.querySelector('#upMagCreativity')?.value || '2');
      const magHdr = parseInt(overlay.querySelector('#upMagHdr')?.value || '0');
      const magResemblance = parseInt(overlay.querySelector('#upMagResemblance')?.value || '0');
      const magFractality = parseInt(overlay.querySelector('#upMagFractality')?.value || '-1');
      // Magnific Precision params
      const magPrecVersion = overlay.querySelector('input[name="upMagPrecVersion"]:checked')?.value || 'v2_sublime';
      const magPrecFactor  = parseInt(overlay.querySelector('input[name="upMagPrecFactor"]:checked')?.value || '2');
      const magPrecSharpen = parseInt(overlay.querySelector('#upMagPrecSharpen')?.value || '7');
      const magPrecGrain   = parseInt(overlay.querySelector('#upMagPrecGrain')?.value || '7');
      const magPrecDetail  = parseInt(overlay.querySelector('#upMagPrecDetail')?.value || '30');
      // Topaz image params
      const tGigaModel  = overlay.querySelector('#upTGigaModel')?.value || 'Upscale Standard';
      const tGigaFactor = parseInt(overlay.querySelector('input[name="upTGigaFactor"]:checked')?.value || '2');
      const tGigaFace   = overlay.querySelector('#upTGigaFace')?.checked || false;
      const tBloomModel      = overlay.querySelector('#upTBloomModel')?.value || 'Bloom';
      const tBloomFactor     = parseInt(overlay.querySelector('input[name="upTBloomFactor"]:checked')?.value || '2');
      const tBloomPrompt     = overlay.querySelector('#upTBloomPrompt')?.value?.trim() || '';
      const tBloomCreativity = parseInt(overlay.querySelector('#upTBloomCreativity')?.value || '3');
      document.body.removeChild(overlay);
      resolve({ confirmed: true, mode, factor: parseInt(factor), clarityPrompt, creativity, resemblance, seedvrRes, noiseScale, claritySteps,
        magMode, magFactor, magEngine, magOptFor, magPrompt, magCreativity, magHdr, magResemblance, magFractality,
        magPrecVersion, magPrecFactor, magPrecSharpen, magPrecGrain, magPrecDetail,
        tGigaModel, tGigaFactor, tGigaFace, tBloomModel, tBloomFactor, tBloomPrompt, tBloomCreativity });
    };
    overlay.querySelector('#cancelUpscale').onclick = () => { document.body.removeChild(overlay); resolve({ confirmed: false }); };
    overlay.onclick = e => { if (e.target === overlay) { document.body.removeChild(overlay); resolve({ confirmed: false }); } };
  });

  if (!result.confirmed) return;

  const falKey = document.getElementById('fluxApiKey')?.value?.trim() || '';
  const freepikKey = (localStorage.getItem('gis_freepik_apikey') || '').trim();
  const topazKey   = (localStorage.getItem('gis_topaz_apikey') || '').trim();
  const proxyUrl = getProxyUrl();

  if (result.mode === 'magnific') {
    if (!freepikKey) { toast('Freepik API key missing — enter it in Setup tab', 'err'); return; }
    if (!proxyUrl)   { toast('Proxy URL missing — enter it in Setup tab', 'err'); return; }
  } else if (result.mode === 'topaz_gigapixel' || result.mode === 'topaz_bloom') {
    if (!topazKey) { toast('Topaz API key missing — enter it in Setup tab', 'err'); return; }
    if (!proxyUrl) { toast('Proxy URL missing — enter it in Setup tab', 'err'); return; }
  } else {
    if (!falKey) { toast('fal.ai key missing — enter it in the header', 'err'); return; }
  }

  const { mode, factor, clarityPrompt, creativity, resemblance, seedvrRes, noiseScale, claritySteps,
    magMode, magFactor, magEngine, magOptFor, magPrompt, magCreativity, magHdr, magResemblance, magFractality,
    magPrecVersion, magPrecFactor, magPrecSharpen, magPrecGrain, magPrecDetail,
    tGigaModel, tGigaFactor, tGigaFace, tBloomModel, tBloomFactor, tBloomPrompt, tBloomCreativity } = result;
  const magPrecLabel = magPrecVersion === 'v1_hdr' ? 'Prec v1' : `Prec ${magPrecVersion.replace('v2_','').replace('_',' ')} ${magPrecFactor}×`;
  const modeLabel = mode === 'crisp' ? 'Recraft Crisp'
    : mode === 'seedvr'          ? `SeedVR2 ${seedvrRes}`
    : mode === 'magnific'        ? (magMode === 'precision' ? `Magnific ${magPrecLabel}` : `Magnific ${magFactor}`)
    : mode === 'topaz_gigapixel' ? `✦ Gigapixel ${tGigaFactor}× (${tGigaModel.split(' ')[0]})`
    : mode === 'topaz_bloom'     ? `✦ Bloom ${tBloomFactor}× (${tBloomModel.split(' ')[1] || 'Creative'})`
    : `Clarity ${factor}×`;
  const upscaleLabel = `[Upscale ${modeLabel}] ${fmtDims(currentDims)}`;
  const job = {
    id: Date.now() + '_up_' + Math.random().toString(36).substr(2,4),
    status: 'pending',
    label: upscaleLabel,
    modelId: 'fal_upscale',
    isUpscale: true,
    upscaleMode: mode,
    upscaleFactor: factor,
    upscalePrompt: clarityPrompt,
    upscaleCreativity: creativity,
    upscaleResemblance: resemblance,
    upscaleSeedvrRes: seedvrRes,
    upscaleNoiseScale: noiseScale,
    upscaleSteps: claritySteps,
    // Magnific Creative
    magMode, magFactor, magEngine, magOptFor, magPrompt, magCreativity, magHdr, magResemblance, magFractality,
    // Magnific Precision
    magPrecVersion, magPrecFactor, magPrecSharpen, magPrecGrain, magPrecDetail,
    freepikKey, proxyUrl,
    // Topaz image
    tGigaModel, tGigaFactor, tGigaFace, tBloomModel, tBloomFactor, tBloomPrompt, tBloomCreativity, topazKey,
    b64data,
    currentDims,
    falKey,
    prompt: upscaleLabel,
  };
  jobQueue.push(job);
  renderQueue();
  tryStartJobs();
}

// Upscale job handler — dispatches to fal.ai upscalers or proxy upscalers
async function runUpscaleJob(job, placeholderEl = null) {
  if (job.upscaleMode === 'magnific' && job.magMode === 'precision') {
    await runMagnificPrecisionJob(job, placeholderEl);
  } else if (job.upscaleMode === 'magnific') {
    await runMagnificUpscaleJob(job, placeholderEl);
  } else if (job.upscaleMode === 'topaz_gigapixel' || job.upscaleMode === 'topaz_bloom') {
    await runTopazImageUpscaleJob(job, placeholderEl);
  } else {
    await runFalUpscaleJob(job, placeholderEl);
  }
}

// fal.ai upscale — Recraft Crisp, SeedVR2, or Clarity Upscaler
async function runFalUpscaleJob(job, placeholderEl = null) {
  const { b64data, currentDims, falKey, upscaleMode, upscaleFactor, upscalePrompt, upscaleCreativity, upscaleResemblance, upscaleSeedvrRes, upscaleNoiseScale, upscaleSteps } = job;

  const isCrisp = upscaleMode === 'crisp';
  const isSeedvr = upscaleMode === 'seedvr';
  // else: clarity

  const endpoint = isCrisp
    ? 'https://fal.run/fal-ai/recraft/upscale/crisp'
    : isSeedvr
      ? 'https://fal.run/fal-ai/seedvr/upscale/image'
      : 'https://fal.run/fal-ai/clarity-upscaler';

  const dataUri = `data:image/png;base64,${b64data}`;

  let payload;
  if (isCrisp) {
    payload = { image_url: dataUri };
  } else if (isSeedvr) {
    payload = {
      image_url: dataUri,
      upscale_mode: 'target',
      target_resolution: upscaleSeedvrRes || '1080p',
      noise_scale: upscaleNoiseScale ?? 0.1,
      output_format: 'png',
      sync_mode: true,
    };
  } else {
    payload = {
      image_url: dataUri,
      upscale_factor: upscaleFactor || 2,
      prompt: upscalePrompt || 'masterpiece, best quality, highres',
      creativity: upscaleCreativity ?? 0.35,
      resemblance: upscaleResemblance ?? 0.6,
      guidance_scale: 4,
      num_inference_steps: upscaleSteps || 18,
      enable_safety_checker: false,
    };
  }

  // Submit to fal.ai queue
  const submitResp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!submitResp.ok) {
    const err = await submitResp.json().catch(() => ({}));
    let errMsg;
    if (Array.isArray(err.detail)) {
      // fal.ai validation errors: [{loc: [...], msg: "...", type: "..."}]
      errMsg = err.detail.map(e => {
        const field = Array.isArray(e.loc) ? e.loc.slice(-1)[0] : '';
        return field ? `${field}: ${e.msg}` : e.msg;
      }).join('; ');
    } else {
      errMsg = err.detail || err.message || (typeof err === 'string' ? err : JSON.stringify(err));
    }
    throw new Error(`fal.ai ${submitResp.status}: ${errMsg}`);
  }

  const result = await submitResp.json();

  // fal.run sync endpoint returns result directly
  // Debug: log response structure to help diagnose failures
  console.log('[Upscale] fal.run response keys:', Object.keys(result), 'status:', result.status);

  // If fal.ai returned a queue response instead of sync result, error out clearly
  if (result.request_id && !result.image && !result.images) {
    throw new Error(`fal.ai upscale: got queue response (status: ${result.status || 'unknown'}) instead of sync result. request_id: ${result.request_id}`);
  }

  const imageObj = result?.image || result?.images?.[0];
  if (!imageObj?.url) throw new Error('fal.ai upscale: no output image URL in response: ' + JSON.stringify(result).slice(0, 200));

  // Fetch result image as base64 (with 60s timeout)
  const fetchCtrl = new AbortController();
  const fetchTimeout = setTimeout(() => fetchCtrl.abort(), 60000);
  let imgResp;
  try {
    imgResp = await fetch(imageObj.url, { signal: fetchCtrl.signal });
  } catch (fetchErr) {
    throw new Error(`fal.ai upscale: image download failed — ${fetchErr.message} (URL: ${imageObj.url.slice(0, 100)})`);
  } finally {
    clearTimeout(fetchTimeout);
  }
  if (!imgResp.ok) throw new Error(`fal.ai upscale: image download HTTP ${imgResp.status}`);
  const imgBlob = await imgResp.blob();
  const imgData = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(imgBlob);
  });

  const newDims = { w: imageObj.width || 0, h: imageObj.height || 0 };
  if (!newDims.w) {
    const detected = await getImageDimensions(imgData);
    newDims.w = detected.w; newDims.h = detected.h;
  }
  const dimsStr = fmtDims(newDims);
  const actuallyUpscaled = newDims.w > (currentDims?.w || 0);
  const modeLabel = isCrisp ? 'Recraft Crisp' : isSeedvr ? `SeedVR2 ${upscaleSeedvrRes}` : `Clarity ${upscaleFactor}×`;
  const src = `data:image/png;base64,${imgData}`;
  const dlName = `upscale-${isCrisp ? 'crisp' : isSeedvr ? `seedvr-${upscaleSeedvrRes}` : `clarity-${upscaleFactor}x`}-${Date.now()}.png`;

  // Render card
  const area = document.getElementById('outputArea');
  document.getElementById('emptyState').style.display = 'none';
  const div = document.createElement('div');
  div.className = 'img-card';
  const upGalId = Date.now() + '_' + Math.random().toString(36).substr(2,6);

  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="img-wrap" style="cursor:zoom-in">
      <img src="${src}" alt="Upscaled">
      <div class="img-card-liked-badge">♥</div>
      <div class="img-overlay">
        <div class="img-overlay-top">
          <span class="ov-badge model" style="color:#bb88ff;border-color:rgba(187,136,255,.4)">⬆ ${modeLabel.toUpperCase()}</span>
          <span class="ov-badge dims">${dimsStr}</span>
          ${!actuallyUpscaled ? `<span class="ov-badge" style="color:#cc9;border-color:rgba(200,200,100,.3)">⚠ same size</span>` : ''}
        </div>
        <div class="img-overlay-bottom">
          <a class="ibtn-ov" href="${src}" download="${dlName}">↓ PNG</a>
          <button class="ibtn-ov addref">⊕ Ref &amp; Assets</button>
          <button class="ibtn-ov annotate">✏ Annotate</button>
          <button class="ibtn-ov upscale">⬆ Upscale again</button>
          <button class="ibtn-ov like-btn">♡ Like</button>
        </div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill">Model: <b>${modeLabel}</b></div>
      <div class="meta-pill">Output: <b>${dimsStr}</b></div>
      <div class="meta-pill">Zdroj: <b>${fmtDims(currentDims)}</b></div>
    </div>
  `;
  div.querySelector('.addref').onclick = () => addRefFromBase64(imgData, `upscale-${Date.now()}.png`);
  div.querySelector('.annotate').onclick = () => openAnnotateModal(imgData, 'Upscale');
  div.querySelector('.upscale').onclick = () => upscaleWithFactor(imgData, newDims);
  setupLikeBtn(div.querySelector('.like-btn'), upGalId);
  div.querySelector('.img-wrap').onclick = e => {
    if (e.target.closest('button,a')) return;
    openOutputLightbox(src);
  };

  if (placeholderEl && placeholderEl.parentNode) {
    placeholderEl.parentNode.replaceChild(div, placeholderEl);
    clearInterval(placeholderEl._ticker);
  } else {
    area.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
  }

  const upscaleRec = {
    id: upGalId,
    ts: Date.now(),
    model: `Upscale ${modeLabel}`,
    modelKey: 'fal_upscale',
    prompt: `[UPSCALE ${modeLabel}] ${fmtDims(currentDims)} → ${dimsStr}`,
    params: { mode: upscaleMode, factor: upscaleFactor, sourceDims: fmtDims(currentDims), resultDims: dimsStr },
    imageData: imgData,
    folder: 'all',
    dims: dimsStr,
  };
  await dbPut('images', upscaleRec);
  await dbPutMeta(upscaleRec);
  generateThumb(imgData, 'image/png').then(thumb => {
    if (thumb) {
      const tx = db.transaction('thumbs', 'readwrite');
      tx.objectStore('thumbs').put({ id: upGalId, data: thumb });
      thumbMemCache.set(upGalId, thumb);
    }
  });
  const _upscaleKey = upscaleMode === 'clarity' ? '_upscale_clarity'
                    : upscaleMode === 'seedvr'  ? '_upscale_seedvr'
                    : '_upscale_crisp';
  trackSpend('fal', _upscaleKey);
  refreshGalleryUI();
}

// Magnific upscale — via Cloudflare Worker proxy → Freepik API
// Worker routes: POST /magnific/upscale (submit) + POST /magnific/status (poll)
// Polling is done by GIS — Worker never waits, always returns in <2s.
async function runMagnificUpscaleJob(job, placeholderEl = null) {
  const { b64data, currentDims, freepikKey, proxyUrl,
    magFactor, magEngine, magOptFor, magPrompt,
    magCreativity, magHdr, magResemblance, magFractality } = job;

  const payload = {
    freepik_key: freepikKey,
    image_b64:   b64data,           // base64 without data URI prefix
    scale_factor: magFactor || '2x',
    engine:       magEngine || 'magnific_sparkle',
    optimized_for: magOptFor || 'standard',
    creativity:   magCreativity ?? 2,
    hdr:          magHdr ?? 0,
    resemblance:  magResemblance ?? 0,
    fractality:   magFractality ?? -1,
  };
  if (magPrompt) payload.prompt = magPrompt;

  // Step 1: submit — Worker returns task_id immediately
  const submitResp = await fetch(`${proxyUrl}/magnific/upscale`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!submitResp.ok) {
    const err = await submitResp.json().catch(() => ({}));
    throw new Error(`Magnific ${submitResp.status}: ${err.error || err.detail || submitResp.statusText}`);
  }
  const submitData = await submitResp.json();
  const taskId = submitData.task_id;
  if (!taskId) throw new Error('Magnific: no task_id from Worker');

  // Step 2: poll /magnific/status until done (GIS polls, Worker just checks once per call)
  const POLL_INTERVAL = 4000;
  const POLL_TIMEOUT  = 10 * 60 * 1000; // 10 minutes
  const deadline      = Date.now() + POLL_TIMEOUT;
  let imgData = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const statusResp = await fetch(`${proxyUrl}/magnific/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ freepik_key: freepikKey, task_id: taskId, upscaler_type: 'creative' }),
    });
    if (!statusResp.ok) {
      const err = await statusResp.json().catch(() => ({}));
      throw new Error(`Magnific status ${statusResp.status}: ${err.error || statusResp.statusText}`);
    }

    const status = await statusResp.json();

    if (status.status === 'failed') {
      throw new Error(`Magnific upscale failed: ${status.error || 'unknown'}`);
    }

    if (status.status === 'done') {
      // GIS fetches image directly from Freepik CDN — Worker never touches the large file
      const imgResp = await fetch(status.url);
      if (!imgResp.ok) throw new Error(`Magnific result download ${imgResp.status}`);
      const imgBlob = await imgResp.blob();
      imgData = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(imgBlob);
      });
      break;
    }
    // status === 'pending' → keep polling
  }

  if (!imgData) throw new Error('Magnific timeout — upscale did not complete within 5 minutes');
  const newDims = { w: 0, h: 0 };
  if (!newDims.w) {
    const detected = await getImageDimensions(imgData);
    newDims.w = detected.w; newDims.h = detected.h;
  }
  const dimsStr = fmtDims(newDims);
  const modeLabel = `Magnific ${magFactor || '2x'}`;
  const src = `data:image/png;base64,${imgData}`;
  const dlName = `upscale-magnific-${magFactor || '2x'}-${Date.now()}.png`;

  // Render card
  const area = document.getElementById('outputArea');
  document.getElementById('emptyState').style.display = 'none';
  const div = document.createElement('div');
  div.className = 'img-card';
  const upGalId = Date.now() + '_' + Math.random().toString(36).substr(2,6);

  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="img-wrap" style="cursor:zoom-in">
      <img src="${src}" alt="Upscaled">
      <div class="img-card-liked-badge">♥</div>
      <div class="img-overlay">
        <div class="img-overlay-top">
          <span class="ov-badge model" style="color:#bb88ff;border-color:rgba(187,136,255,.4)">⬆ MAGNIFIC ${(magFactor || '2x').toUpperCase()}</span>
          <span class="ov-badge dims">${dimsStr}</span>
        </div>
        <div class="img-overlay-bottom">
          <a class="ibtn-ov" href="${src}" download="${dlName}">↓ PNG</a>
          <button class="ibtn-ov addref">⊕ Ref &amp; Assets</button>
          <button class="ibtn-ov annotate">✏ Annotate</button>
          <button class="ibtn-ov upscale">⬆ Upscale again</button>
          <button class="ibtn-ov like-btn">♡ Like</button>
        </div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill">Model: <b>${modeLabel}</b></div>
      <div class="meta-pill">Engine: <b>${(magEngine || 'sparkle').replace('magnific_','')}</b></div>
      <div class="meta-pill">Output: <b>${dimsStr}</b></div>
      <div class="meta-pill">Source: <b>${fmtDims(currentDims)}</b></div>
    </div>
  `;
  div.querySelector('.addref').onclick = () => addRefFromBase64(imgData, `upscale-magnific-${Date.now()}.png`);
  div.querySelector('.annotate').onclick = () => openAnnotateModal(imgData, 'Magnific Upscale');
  div.querySelector('.upscale').onclick = () => upscaleWithFactor(imgData, newDims);
  setupLikeBtn(div.querySelector('.like-btn'), upGalId);
  div.querySelector('.img-wrap').onclick = e => {
    if (e.target.closest('button,a')) return;
    openOutputLightbox(src);
  };

  if (placeholderEl && placeholderEl.parentNode) {
    placeholderEl.parentNode.replaceChild(div, placeholderEl);
    clearInterval(placeholderEl._ticker);
  } else {
    area.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
  }

  const upscaleRec = {
    id: upGalId,
    ts: Date.now(),
    model: `Upscale ${modeLabel}`,
    modelKey: 'magnific_upscale',
    prompt: `[UPSCALE ${modeLabel}] ${fmtDims(currentDims)} → ${dimsStr}`,
    params: { mode: 'magnific', factor: magFactor, engine: magEngine, sourceDims: fmtDims(currentDims), resultDims: dimsStr },
    imageData: imgData,
    folder: 'all',
    dims: dimsStr,
  };
  await dbPut('images', upscaleRec);
  await dbPutMeta(upscaleRec);
  generateThumb(imgData, 'image/png').then(thumb => {
    if (thumb) {
      const tx = db.transaction('thumbs', 'readwrite');
      tx.objectStore('thumbs').put({ id: upGalId, data: thumb });
      thumbMemCache.set(upGalId, thumb);
    }
  });
  trackSpend('freepik', '_magnific');
  refreshGalleryUI();
}

// Magnific Precision upscale — Precision V1 (/image-upscaler-precision) or V2 (/image-upscaler-precision-v2)
// V1: v1_hdr — no scale_factor, no flavor
// V2: sublime/photo/photo_denoiser — scale_factor 2-16, flavor param
async function runMagnificPrecisionJob(job, placeholderEl = null) {
  const { b64data, currentDims, freepikKey, proxyUrl,
    magPrecVersion, magPrecFactor, magPrecSharpen, magPrecGrain, magPrecDetail } = job;

  const isV1 = magPrecVersion === 'v1_hdr';
  const payload = {
    freepik_key: freepikKey,
    image_b64:   b64data,
    sharpen:     magPrecSharpen ?? 7,
    smart_grain: magPrecGrain   ?? 7,
    ultra_detail: magPrecDetail ?? 30,
    prec_version: isV1 ? 'v1' : 'v2',
  };
  if (!isV1) {
    payload.scale_factor = magPrecFactor || 2;
    const flavorMap = { v2_sublime: 'sublime', v2_photo: 'photo', v2_photo_denoiser: 'photo_denoiser' };
    payload.flavor = flavorMap[magPrecVersion] || 'sublime';
  }

  // Step 1: submit
  const submitResp = await fetch(`${proxyUrl}/magnific/precision`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!submitResp.ok) {
    const err = await submitResp.json().catch(() => ({}));
    throw new Error(`Magnific Precision ${submitResp.status}: ${err.error || submitResp.statusText}`);
  }
  const submitData = await submitResp.json();
  const taskId = submitData.task_id;
  if (!taskId) throw new Error('Magnific Precision: no task_id from Worker');

  // Step 2: poll
  const POLL_INTERVAL = 4000;
  const POLL_TIMEOUT  = 10 * 60 * 1000; // 10 minutes
  const deadline      = Date.now() + POLL_TIMEOUT;
  let imgData = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    const statusResp = await fetch(`${proxyUrl}/magnific/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ freepik_key: freepikKey, task_id: taskId, upscaler_type: isV1 ? 'precision-v1' : 'precision-v2' }),
    });
    if (!statusResp.ok) {
      const err = await statusResp.json().catch(() => ({}));
      throw new Error(`Magnific Precision status ${statusResp.status}: ${err.error || statusResp.statusText}`);
    }
    const statusData = await statusResp.json();

    if (statusData.status === 'failed') throw new Error(`Magnific Precision failed: ${statusData.error}`);
    if (statusData.status === 'done') {
      // fetch image from CDN URL
      const imgResp = await fetch(statusData.url);
      if (!imgResp.ok) throw new Error(`Magnific Precision CDN fetch ${imgResp.status}`);
      const imgBlob = await imgResp.blob();
      imgData = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(imgBlob);
      });
      break;
    }
  }

  if (!imgData) throw new Error('Magnific Precision: timed out');

  // Same save logic as creative upscale
  const upGalId = job.id;
  const upscaledDims = await new Promise(res => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res(currentDims);
    img.src = imgData;
  });

  const dbRecord = {
    id: upGalId,
    imageData: imgData,
    prompt: job.label,
    modelId: 'fal_upscale',
    timestamp: Date.now(),
    width: upscaledDims.w,
    height: upscaledDims.h,
    upscaleMode: 'magnific',
    magMode: 'precision',
    magPrecVersion, magPrecFactor, magPrecSharpen, magPrecGrain, magPrecDetail,
  };

  await dbSave(dbRecord);

  if (placeholderEl) {
    renderFinishedCard(placeholderEl, dbRecord);
  } else {
    refreshGalleryUI();
  }

  const thumb = await generateThumb(imgData);
  if (thumb) {
    const db = await openDB();
    const tx = db.transaction('thumbs', 'readwrite');
    tx.objectStore('thumbs').put({ id: upGalId, data: thumb });
    thumbMemCache.set(upGalId, thumb);
  }
  trackSpend('freepik', '_magnific');
  refreshGalleryUI();
}
// Routes: POST /topaz/image/submit → process_id
//         POST /topaz/image/status → { status, download_url }
//         POST /topaz/image/download → streams result image
async function runTopazImageUpscaleJob(job, placeholderEl = null) {
  const { b64data, currentDims, topazKey, proxyUrl, upscaleMode,
    tGigaModel, tGigaFactor, tGigaFace,
    tBloomModel, tBloomFactor, tBloomPrompt, tBloomCreativity } = job;

  const isBloom     = upscaleMode === 'topaz_bloom';
  const modelName   = isBloom ? tBloomModel  : tGigaModel;
  const scaleFactor = isBloom ? tBloomFactor : tGigaFactor;
  const srcW = currentDims?.w || 0;
  const srcH = currentDims?.h || 0;

  // Step 1: Submit — Worker computes output_width/height from src dims × scale
  const submitPayload = {
    topaz_key:     topazKey,
    model:         modelName,
    is_gen:        isBloom,              // tells Worker which endpoint to use
    src_width:     srcW,
    src_height:    srcH,
    output_scale:  scaleFactor,          // Worker calculates actual px from this
    output_format: 'jpeg',
    image_b64:     b64data,
    ...(isBloom && tBloomPrompt ? { prompt: tBloomPrompt } : {}),
    ...(isBloom ? { creativity: tBloomCreativity || 3 } : {}),
    ...(!isBloom && tGigaFace ? { face_enhancement: true, face_enhancement_strength: 0.5, face_enhancement_creativity: 0.3 } : {}),
  };

  const submitResp = await fetch(`${proxyUrl}/topaz/image/submit`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(submitPayload),
  });
  if (!submitResp.ok) {
    const e = await submitResp.json().catch(() => ({}));
    throw new Error(`Topaz image submit ${submitResp.status}: ${e.error || submitResp.statusText}`);
  }
  const { process_id } = await submitResp.json();
  if (!process_id) throw new Error('Topaz image: no process_id from Worker');

  // Step 2: Poll status
  const POLL = 3_000;
  const LIMIT = 10 * 60_000; // 10 min
  const stop = Date.now() + LIMIT;
  let download_url = null;
  let pollCount = 0;

  while (Date.now() < stop) {
    await new Promise(r => setTimeout(r, POLL));
    pollCount++;

    const sr = await fetch(`${proxyUrl}/topaz/image/status`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ topaz_key: topazKey, process_id }),
    });
    if (!sr.ok) { const e = await sr.json().catch(() => ({})); throw new Error(`Topaz status: ${e.error || sr.statusText}`); }
    const statusData = await sr.json();
    const { status, download_url: url } = statusData;

    if (status === 'Failed' || status === 'Cancelled') throw new Error(`Topaz image ${status}`);

    // Update placeholder with elapsed time + status
    if (placeholderEl) {
      const secEl = placeholderEl.querySelector('.ph-sec');
      if (secEl) secEl.textContent = Math.round(pollCount * POLL / 1000);
      const metaPills = placeholderEl.querySelectorAll('.meta-pill');
      if (metaPills[1]) metaPills[1].textContent = `${status?.toLowerCase() || 'processing'}…`;
    }

    if (status === 'Completed') {
      if (!url) throw new Error('Topaz image completed but no download URL');
      download_url = url;
      break;
    }
  }

  if (!download_url) throw new Error('Topaz image timeout — did not complete within 10 minutes');

  // Step 3: Download via proxy (result URL is CORS-blocked from file://)
  const dlResp = await fetch(`${proxyUrl}/topaz/image/download`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ topaz_key: topazKey, process_id, download_url }),
  });
  if (!dlResp.ok) throw new Error(`Topaz image download ${dlResp.status}`);

  const imgBlob = await dlResp.blob();
  const imgData = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(imgBlob);
  });

  const newDims = await getImageDimensions(imgData).catch(() => ({ w: 0, h: 0 }));
  const dimsStr = fmtDims(newDims);
  const shortName = isBloom ? `Bloom ${tBloomFactor}×` : `Gigapixel ${tGigaFactor}×`;
  const modeLabel = `✦ ${shortName} (${modelName})`;
  const src = `data:image/jpeg;base64,${imgData}`;
  const dlName = `upscale-topaz-${isBloom ? 'bloom' : 'gigapixel'}-${tGigaFactor || tBloomFactor}x-${Date.now()}.jpg`;

  // Render card
  const area = document.getElementById('outputArea');
  document.getElementById('emptyState').style.display = 'none';
  const div = document.createElement('div');
  div.className = 'img-card';
  const upGalId = Date.now() + '_' + Math.random().toString(36).substr(2, 6);

  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="img-wrap" style="cursor:zoom-in">
      <img src="${src}" alt="Upscaled">
      <div class="img-card-liked-badge">♥</div>
      <div class="img-overlay">
        <div class="img-overlay-top">
          <span class="ov-badge model" style="color:var(--accent);border-color:rgba(212,160,23,.4)">✦ TOPAZ ${shortName.toUpperCase()}</span>
          <span class="ov-badge dims">${dimsStr}</span>
        </div>
        <div class="img-overlay-bottom">
          <a class="ibtn-ov" href="${src}" download="${dlName}">↓ JPEG</a>
          <button class="ibtn-ov addref">⊕ Ref &amp; Assets</button>
          <button class="ibtn-ov annotate">✏ Annotate</button>
          <button class="ibtn-ov upscale">⬆ Upscale again</button>
          <button class="ibtn-ov like-btn">♡ Like</button>
        </div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill"><b>${modeLabel}</b></div>
      <div class="meta-pill">Output: <b>${dimsStr}</b></div>
      <div class="meta-pill">Source: <b>${fmtDims(currentDims)}</b></div>
    </div>
  `;
  div.querySelector('.addref').onclick = () => addRefFromBase64(imgData, dlName);
  div.querySelector('.annotate').onclick = () => openAnnotateModal(imgData, modeLabel);
  div.querySelector('.upscale').onclick = () => upscaleWithFactor(imgData, newDims);
  setupLikeBtn(div.querySelector('.like-btn'), upGalId);
  div.querySelector('.img-wrap').onclick = e => {
    if (e.target.closest('button,a')) return;
    openOutputLightbox(src);
  };

  if (placeholderEl && placeholderEl.parentNode) {
    placeholderEl.parentNode.replaceChild(div, placeholderEl);
    clearInterval(placeholderEl._ticker);
  } else {
    area.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
  }

  const mimeType = 'image/jpeg';
  const upscaleRec = {
    id: upGalId, ts: Date.now(),
    model: `Upscale ${shortName}`, modelKey: `topaz_${isBloom ? 'bloom' : 'gigapixel'}`,
    prompt: `[UPSCALE ${modeLabel}] ${fmtDims(currentDims)} → ${dimsStr}`,
    params: { mode: upscaleMode, model: modelName, factor: scaleFactor, sourceDims: fmtDims(currentDims), resultDims: dimsStr },
    imageData: imgData, folder: 'all', dims: dimsStr,
  };
  await dbPut('images', upscaleRec);
  await dbPutMeta(upscaleRec);
  generateThumb(imgData, mimeType).then(thumb => {
    if (thumb) {
      const tx = db.transaction('thumbs', 'readwrite');
      tx.objectStore('thumbs').put({ id: upGalId, data: thumb });
      thumbMemCache.set(upGalId, thumb);
    }
  });
  trackSpend('topaz', '_topaz_img');
  refreshGalleryUI();
}

// ═══════════════════════════════════════════════════════
// LOADING / UI
// ═══════════════════════════════════════════════════════

function clearOutput() {
  const area = document.getElementById('outputArea');
  Array.from(area.children).forEach(c => {
    if (c.id !== 'emptyState') c.remove();
  });
  document.getElementById('emptyState').style.display = 'flex';
}

function showErr(msg) {
  const area = document.getElementById('outputArea');
  const d = document.createElement('div');
  d.className = 'err-box';
  d.textContent = '⚠ ' + msg;
  area.appendChild(d);
}


// ═══════════════════════════════════════════════════════
// ✦ EDIT OVERLAY — Relight · Style Transfer · Skin Enhancer
// ═══════════════════════════════════════════════════════
async function openEditOverlay(b64data, currentDims, sourceGalId) {
  const freepikKey = (localStorage.getItem('gis_freepik_apikey') || '').trim();
  const proxyUrl   = getProxyUrl();
  if (!freepikKey) { toast('Freepik API key missing — enter it in Setup tab', 'err'); return; }
  if (!proxyUrl)   { toast('Proxy URL missing — enter it in Setup tab', 'err'); return; }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9900;display:flex;align-items:center;justify-content:center;padding:20px;';

  overlay.innerHTML = `
  <div style="background:var(--s1);border:1px solid var(--border);width:100%;max-width:420px;max-height:92vh;overflow-y:auto;font-family:Syne,sans-serif;">
    <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
      <div style="font-weight:700;font-size:15px;color:var(--purple);">✦ Edit Image</div>
      <button id="editClose" style="background:none;border:none;color:var(--dim);cursor:pointer;font-size:18px;line-height:1;">×</button>
    </div>

    <!-- Tabs -->
    <div style="display:flex;border-bottom:1px solid var(--border);">
      ${[['relight','⚡ Relight'],['style','◈ Style Transfer'],['skin','✦ Skin Enhancer']].map(([id,label],i)=>`
        <button data-tab="${id}" style="flex:1;padding:9px 4px;background:${i===0?'var(--s2)':'none'};border:none;border-bottom:${i===0?'2px solid var(--purple)':'2px solid transparent'};color:${i===0?'var(--purple)':'var(--dim)'};cursor:pointer;font-size:11px;font-family:Syne,sans-serif;font-weight:${i===0?'700':'400'};">${label}</button>
      `).join('')}
    </div>

    <!-- Relight panel -->
    <div id="editTab_relight" style="padding:14px 16px;">
      <div style="font-size:10px;color:var(--dim2);margin-bottom:10px;line-height:1.5;">
        Transform lighting in the image. Use a prompt to describe the desired light, or add a ref image to transfer its lighting.
      </div>
      <!-- Prompt -->
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:4px;">Lighting prompt</div>
        <textarea id="relightPrompt" placeholder="e.g. golden hour sunlight, dramatic side lighting, neon glow..." style="width:100%;box-sizing:border-box;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:8px;resize:vertical;min-height:60px;outline:none;"></textarea>
      </div>
      <!-- Ref image (first ref from panel) -->
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;color:var(--dim2);">Optionally add a ref image (in the Refs panel) to transfer its lighting.</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
          <div style="font-size:11px;color:var(--dim);">Light transfer strength <span class="cv" id="relightStrVal">100</span></div>
        </div>
        <input type="range" id="relightStr" min="0" max="100" value="100" step="5"
          oninput="document.getElementById('relightStrVal').textContent=this.value"
          style="-webkit-appearance:none;width:100%;height:3px;background:var(--border2);outline:none;cursor:pointer;margin-top:4px;">
      </div>
      <!-- Change background -->
      <div style="margin-bottom:12px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="relightChangeBg" style="accent-color:var(--purple);">
          <span style="font-size:11px;color:var(--dim);">Change background (portraits &amp; products)</span>
        </label>
      </div>
      <button id="runRelight" style="width:100%;padding:10px;background:none;border:1px solid var(--purple);color:var(--purple);cursor:pointer;font-family:Syne,sans-serif;font-size:13px;font-weight:700;">▶ Run Relight</button>
    </div>

    <!-- Style Transfer panel -->
    <div id="editTab_style" style="display:none;padding:14px 16px;">
      <div style="font-size:10px;color:var(--dim2);margin-bottom:10px;line-height:1.5;">
        Transfer the visual style of a reference image onto this image.<br>
        <strong style="color:var(--accent);">Add a ref image in the Refs panel first</strong> — it will be used as the style source.
      </div>
      <!-- Portrait mode -->
      <div style="margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="stylePotrait" style="accent-color:var(--purple);">
          <span style="font-size:11px;color:var(--dim);">Portrait mode (enables portrait-specific enhancements)</span>
        </label>
      </div>
      <!-- Fixed generation -->
      <div style="margin-bottom:14px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="styleFixed" style="accent-color:var(--purple);">
          <span style="font-size:11px;color:var(--dim);">Fixed generation (reproducible)</span>
        </label>
      </div>
      <button id="runStyleTransfer" style="width:100%;padding:10px;background:none;border:1px solid var(--purple);color:var(--purple);cursor:pointer;font-family:Syne,sans-serif;font-size:13px;font-weight:700;">▶ Run Style Transfer</button>
    </div>

    <!-- Skin Enhancer panel -->
    <div id="editTab_skin" style="display:none;padding:14px 16px;">
      <div style="font-size:10px;color:var(--dim2);margin-bottom:10px;line-height:1.5;">
        Enhance skin texture naturally — removes "plastic skin" from AI portraits while preserving pores, fine lines, and natural detail.
      </div>
      <!-- Variant -->
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin-bottom:4px;">Mode</div>
        <div style="display:flex;gap:6px;">
          ${[['creative','Creative'],['faithful','Faithful'],['flexible','Flexible']].map(([v,l],i)=>`
            <label style="flex:1;text-align:center;padding:6px 2px;border:1px solid ${i===0?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===0?'var(--purple)':'var(--dim)'};" id="skinVariant_lbl_${v}">
              <input type="radio" name="skinVariant" value="${v}" ${i===0?'checked':''} style="display:none"
                onchange="document.querySelectorAll('[id^=skinVariant_lbl_]').forEach(el=>{el.style.borderColor='var(--border)';el.style.color='var(--dim)'});this.parentElement.style.borderColor='var(--purple)';this.parentElement.style.color='var(--purple)'">${l}
            </label>`).join('')}
        </div>
      </div>
      <!-- Sharpen -->
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Sharpen <span class="cv" id="skinSharpenVal">0</span></div>
        <input type="range" id="skinSharpen" min="0" max="100" value="0" step="1"
          oninput="document.getElementById('skinSharpenVal').textContent=this.value"
          style="-webkit-appearance:none;width:100%;height:3px;background:var(--border2);outline:none;cursor:pointer;">
      </div>
      <!-- Smart grain -->
      <div style="margin-bottom:14px;">
        <div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Smart grain <span class="cv" id="skinGrainVal">2</span></div>
        <input type="range" id="skinGrain" min="0" max="100" value="2" step="1"
          oninput="document.getElementById('skinGrainVal').textContent=this.value"
          style="-webkit-appearance:none;width:100%;height:3px;background:var(--border2);outline:none;cursor:pointer;">
      </div>
      <button id="runSkinEnhancer" style="width:100%;padding:10px;background:none;border:1px solid var(--purple);color:var(--purple);cursor:pointer;font-family:Syne,sans-serif;font-size:13px;font-weight:700;">▶ Run Skin Enhancer</button>
    </div>

    <!-- Status line -->
    <div id="editStatus" style="padding:8px 16px;font-size:11px;color:var(--dim);display:none;border-top:1px solid var(--border);"></div>
  </div>`;

  document.body.appendChild(overlay);

  // ── Tab switching ────────────────────────────────
  const tabs = ['relight','style','skin'];
  overlay.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = () => {
      const t = btn.dataset.tab;
      tabs.forEach(id => {
        const panel = overlay.querySelector(`#editTab_${id}`);
        const tabBtn = overlay.querySelector(`[data-tab="${id}"]`);
        const active = id === t;
        panel.style.display = active ? 'block' : 'none';
        tabBtn.style.background = active ? 'var(--s2)' : 'none';
        tabBtn.style.borderBottom = active ? '2px solid var(--purple)' : '2px solid transparent';
        tabBtn.style.color = active ? 'var(--purple)' : 'var(--dim)';
        tabBtn.style.fontWeight = active ? '700' : '400';
      });
    };
  });

  overlay.querySelector('#editClose').onclick = () => document.body.removeChild(overlay);
  overlay.onclick = e => { if (e.target === overlay) document.body.removeChild(overlay); };

  // ── Status helper ────────────────────────────────
  function setStatus(msg, color = 'var(--dim)') {
    const el = overlay.querySelector('#editStatus');
    el.textContent = msg;
    el.style.color = color;
    el.style.display = msg ? 'block' : 'none';
  }

  // ── Helper: disable/re-enable all run buttons ───
  function setBusy(busy) {
    ['runRelight','runStyleTransfer','runSkinEnhancer','editClose'].forEach(id => {
      const el = overlay.querySelector(`#${id}`);
      if (el) el.disabled = busy;
    });
  }

  // ── RELIGHT ──────────────────────────────────────
  overlay.querySelector('#runRelight').onclick = async () => {
    setBusy(true);
    setStatus('Submitting to Magnific Relight…');
    try {
      const prompt    = overlay.querySelector('#relightPrompt').value.trim();
      const str       = parseInt(overlay.querySelector('#relightStr').value);
      const changeBg  = overlay.querySelector('#relightChangeBg').checked;

      // Optional: first ref → light reference image
      let transferRef = undefined;
      if (refs && refs.length > 0) {
        const r = await getRefDataForApi(refs[0], null);
        if (r) transferRef = r.data;
      }

      setStatus('Processing… this may take 30–60s');
      const result = await callFreepikRelight(freepikKey, proxyUrl, b64data, {
        prompt,
        transfer_ref_b64: transferRef,
        light_transfer_strength: str,
        change_background: changeBg,
      });
      await _saveEditResult(result, 'Relight', sourceGalId);
      setStatus('✓ Done — saved to gallery', 'var(--accent)');
      trackSpend('freepik', '_magnific');
    } catch(e) {
      setStatus('Error: ' + e.message, '#e55');
    } finally { setBusy(false); }
  };

  // ── STYLE TRANSFER ───────────────────────────────
  overlay.querySelector('#runStyleTransfer').onclick = async () => {
    if (!refs || refs.length === 0) {
      toast('Add a ref image in the Refs panel — it will be the style source', 'err');
      return;
    }
    setBusy(true);
    setStatus('Loading style reference…');
    try {
      const r = await getRefDataForApi(refs[0], null);
      if (!r) throw new Error('Could not load ref image');
      const referenceB64 = r.data;
      const isPortrait   = overlay.querySelector('#stylePotrait').checked;
      const fixed        = overlay.querySelector('#styleFixed').checked;

      setStatus('Processing… this may take 30–60s');
      const result = await callFreepikStyleTransfer(freepikKey, proxyUrl, b64data, referenceB64, {
        is_portrait: isPortrait, fixed,
      });
      await _saveEditResult(result, 'Style Transfer', sourceGalId);
      setStatus('✓ Done — saved to gallery', 'var(--accent)');
      trackSpend('freepik', '_magnific');
    } catch(e) {
      setStatus('Error: ' + e.message, '#e55');
    } finally { setBusy(false); }
  };

  // ── SKIN ENHANCER ────────────────────────────────
  overlay.querySelector('#runSkinEnhancer').onclick = async () => {
    setBusy(true);
    setStatus('Submitting to Magnific Skin Enhancer…');
    try {
      const variant    = overlay.querySelector('input[name="skinVariant"]:checked')?.value || 'creative';
      const sharpen    = parseInt(overlay.querySelector('#skinSharpen').value);
      const smartGrain = parseInt(overlay.querySelector('#skinGrain').value);

      setStatus('Processing… this may take 20–40s');
      const result = await callFreepikSkinEnhancer(freepikKey, proxyUrl, b64data, {
        variant, sharpen, smart_grain: smartGrain,
      });
      await _saveEditResult(result, 'Skin Enhancer', sourceGalId);
      setStatus('✓ Done — saved to gallery', 'var(--accent)');
      trackSpend('freepik', '_magnific');
    } catch(e) {
      setStatus('Error: ' + e.message, '#e55');
    } finally { setBusy(false); }
  };
}

// Save Freepik edit result to gallery and render card
async function _saveEditResult(result, toolName, sourceGalId) {
  const { imageData, mimeType, width, height } = result;
  const prompt    = `[${toolName}]`;
  const dims      = { w: width || 0, h: height || 0 };
  const size      = dims.w ? `${dims.w}×${dims.h}` : '?';
  const timestamp = Date.now();

  const galResult = {
    type:     'proxy_mystic',
    images:   [imageData],
    mimeType: mimeType || 'image/png',
    model:    `Magnific ${toolName}`,
    modelKey: 'magnific_edit',
    seed:     '—',
    size,
    ratio:    '—',
  };

  // Find target folder from current UI
  const folder = document.getElementById('targetFolder')?.value || 'all';
  const galId  = await saveToGallery(galResult, prompt, folder, [], prompt, null);
  const area   = document.getElementById('imageArea');
  if (area) await renderImagenOutput(area, galResult, prompt, galId);
}
