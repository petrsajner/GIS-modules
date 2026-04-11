// ══════════════════════════════════════════════════════════
// PLACEHOLDER KARTY
// ══════════════════════════════════════════════════════════

function createPlaceholderCard(job, idx) {
  const area = document.getElementById('outputArea');
  document.getElementById('emptyState').style.display = 'none';

  const div = document.createElement('div');
  div.className = 'img-card placeholder-card';
  const cardKey = job.id + '_' + idx;
  div.dataset.cardKey = cardKey;
  div._job = job;  // Store job reference for timeout reuse

  const modelName = job.isUpscale
    ? (job.upscaleMode === 'seedvr'          ? `SeedVR2 ${job.upscaleSeedvrRes}`
     : job.upscaleMode === 'clarity'         ? `Clarity ${job.upscaleFactor}×`
     : job.upscaleMode === 'magnific'        ? `Magnific ${job.magFactor}`
     : job.upscaleMode === 'topaz_gigapixel' ? `✦ Gigapixel ${job.tGigaFactor}×`
     : job.upscaleMode === 'topaz_bloom'     ? `✦ Bloom ${job.tBloomFactor}×`
     : 'Recraft Crisp')
    : (job.model?.name || '?');
  const promptSnip = escHtml(job.prompt.length > 70 ? job.prompt.slice(0, 70) + '…' : job.prompt);

  const isFlux = job.model?.type === 'flux';
  const showThink = job.model?.thinking || isFlux;
  const thinkHeader = isFlux ? '◈ API status…' : '◈ Thinking…';

  div.innerHTML = `
    <div class="img-card-top-spacer"></div>
    <div class="ph-body">
      <div class="ph-shimmer"></div>
      <div class="ph-overlay">
        <div class="ph-top">
          <span class="ph-model">${modelName}</span>
          <span class="ph-elapsed">⟳ <span class="ph-sec">0</span>s</span>
        </div>
        <div class="ph-prompt-txt">${promptSnip}</div>
        <div class="ph-think-wrap" ${showThink ? '' : 'style="display:none"'}>
          <div class="ph-think-hdr"><div class="think-pulse"></div>${thinkHeader}</div>
          <div class="ph-think-body"></div>
        </div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill">Model: <b>${modelName}</b></div>
      <div class="meta-pill" style="color:var(--dim2)">generating…</div>
    </div>`;

  area.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth' });

  // Elapsed time ticker
  const secEl = div.querySelector('.ph-sec');
  const t0 = Date.now();
  div._ticker = setInterval(() => {
    if (!document.contains(div)) { clearInterval(div._ticker); return; }
    secEl.textContent = Math.round((Date.now() - t0) / 1000);
  }, 1000);

  return div;
}

function updatePlaceholderThinking(cardEl, text) {
  if (!cardEl) return;
  const wrap = cardEl.querySelector('.ph-think-wrap');
  const body = cardEl.querySelector('.ph-think-body');
  if (!wrap || !body) return;
  wrap.classList.add('visible');
  body.textContent = text;
  body.scrollTop = body.scrollHeight;
}

// Nahradí placeholder skutečnou kartou výsledku
async function replacePlaceholder(cardEl, result, prompt, galId) {
  if (!cardEl) return;
  clearInterval(cardEl._ticker);
  const job = cardEl._job; // batch metadata source
  // Vyrenderuj do temp kontejneru
  const temp = document.createElement('div');
  if (result.type === 'gemini') {
    await renderGeminiOutput(temp, result, prompt, galId);
  } else if (result.type === 'flux' || result.type === 'seedream' || result.type === 'kling' || result.type === 'zimage') {
    await renderImagenOutput(temp, result, prompt, galId);
  } else {
    await renderImagenOutput(temp, result, prompt, galId);
  }
  const realCard = temp.firstElementChild;
  if (realCard && cardEl.parentNode) {
    // Inject batch info pill into img-card-meta if present
    if (job?.batchStyle || job?.batchCamera) {
      const meta = realCard.querySelector('.img-card-meta');
      if (meta) {
        const name = job.batchStyle?.name || job.batchCamera?.name;
        const icon = job.batchStyle ? '◈' : '⊙';
        const color = job.batchStyle ? '#4ecb8a' : '#4a90d9';
        const pill = document.createElement('div');
        pill.className = 'meta-pill';
        pill.style.cssText = `color:${color};font-weight:600;`;
        pill.textContent = `${icon} ${name}`;
        meta.insertBefore(pill, meta.firstChild);
      }
    }
    cardEl.parentNode.replaceChild(realCard, cardEl);
  }
}

function removePlaceholderWithError(cardEl, msg) {
  if (!cardEl) return;
  clearInterval(cardEl._ticker);
  if (cardEl.parentNode) {
    const errDiv = document.createElement('div');
    errDiv.className = 'err-box';
    errDiv.textContent = '⚠ ' + msg;
    cardEl.parentNode.replaceChild(errDiv, cardEl);
  }
}

// ── Error message translator — turns technical errors into readable messages ─
function friendlyError(raw) {
  if (!raw) return 'Generation failed. Please try again.';
  const m = raw.toString();

  // Timeout / deadline
  if (/timeout|timed out/i.test(m))              return 'No result within time limit — click Reuse to retry';
  if (/deadline expired/i.test(m))               return 'Server could not complete in time — click Reuse to retry';

  // Google API errors (prefix "API 5xx" or "API 4xx" = Google, not fal.ai)
  if (/^API 503/.test(m))                        return 'Google server overloaded — try again in a moment';
  if (/^API 429/.test(m))                        return 'Google API rate limit reached — wait a moment';
  if (/^API 400/.test(m))                        return 'Request rejected by Google — check your prompt';
  if (/^API 40[13]/.test(m))                     return 'Google API key error — check your key in Setup';
  if (/^API 5/.test(m))                          return 'Google server error — try again';

  // fal.ai queue errors
  if (/fal\.ai: submit failed \(503\)/i.test(m)) return 'fal.ai server overloaded — click Reuse to retry';
  if (/fal\.ai: submit failed \(429\)/i.test(m)) return 'fal.ai rate limit — wait a moment and retry';
  if (/fal\.ai: submit failed/i.test(m))         return `fal.ai: could not submit — ${m.replace(/.*submit failed[^:]*:\s*/,'').slice(0,80)}`;
  if (/fal\.ai: generation failed/i.test(m))     return 'fal.ai: generation failed — click Reuse to retry';
  if (/fal\.ai: timeout/i.test(m))               return 'fal.ai: no result within 10 min — click Reuse to retry';

  // Replicate / proxy errors
  if (/replicate.*503|replicate.*overload/i.test(m)) return 'Replicate server overloaded — click Reuse to retry';
  if (/replicate.*timeout/i.test(m))                 return 'Replicate: no result in time — click Reuse to retry';

  // Network
  if (/failed to fetch|networkerror|cors/i.test(m)) return 'Network error — check your connection';

  // Content / safety filters
  if (/safety|blocked|content.?polic/i.test(m))     return 'Request blocked by content filter — adjust your prompt';
  if (/no image in result|no image in response|no image url/i.test(m))
                                                      return 'No image generated — content may have been filtered';

  // API key / auth
  if (/api key|unauthorized|invalid.*key/i.test(m))  return 'API key error — check your key in Setup';

  // Fallback — show original but truncated
  return m.length > 120 ? m.slice(0, 120) + '…' : m;
}

// ── Error placeholder — static card for any failure, with REUSE button ─
function isTimeoutError(e) {
  if (!e) return false;
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true;
  return /timeout/i.test(e.message || '');
}

// ── Extract key params as chip labels for error card display ──
function _jobParamChips(job) {
  const chips = [];
  const snap = job.geminiSnap || job.fluxSnap || job.sdSnap || job.klingSnap
             || job.zimageSnap || job.qwen2Snap || job.imagenSnap || job.wan27Snap
             || job.xaiSnap || job.lumaSnap || job.mysticSnap || job.editSnap;

  const ar = snap?.aspectRatio || snap?.ratio;
  if (ar && ar !== 'auto') chips.push(ar);

  const res = snap?.imageSize || snap?.resolution || snap?.imgSize || snap?.size;
  if (res) chips.push(res);

  if (snap?.tier) chips.push(`tier ${snap.tier}`);

  if (snap?.thinkingLevel && snap.thinkingLevel !== 'none') chips.push(`think:${snap.thinkingLevel}`);

  const count = job.geminiCount || job.fluxCount || job.sdCount || job.klingCount
              || job.zimageCount || job.qwen2Count
              || snap?.sampleCount || snap?.count || snap?.grokCount;
  if (count && count > 1) chips.push(`×${count}`);

  const seed = snap?.seed;
  if (seed && seed !== '—' && seed !== '') chips.push(`seed:${seed}`);

  return chips;
}

function showErrorPlaceholder(cardEl, job, msg) {
  if (!cardEl || !document.contains(cardEl)) return;
  clearInterval(cardEl._ticker);

  const modelName = job.isUpscale
    ? (job.upscaleMode === 'seedvr'          ? `SeedVR2 ${job.upscaleSeedvrRes}`
     : job.upscaleMode === 'clarity'         ? `Clarity ${job.upscaleFactor}×`
     : job.upscaleMode === 'magnific'        ? `Magnific ${job.magFactor}`
     : job.upscaleMode === 'topaz_gigapixel' ? `✦ Gigapixel ${job.tGigaFactor}×`
     : job.upscaleMode === 'topaz_bloom'     ? `✦ Bloom ${job.tBloomFactor}×`
     : 'Recraft Crisp')
    : (job.model?.name || '?');

  const cardKey     = cardEl.dataset.cardKey || '';
  const isTimeout   = /timeout|deadline/i.test(msg || '');
  const icon        = isTimeout ? '⏱' : '⚠';
  const friendlyMsg = escHtml(friendlyError(msg));
  const fullPrompt  = escHtml((job.rawPrompt || job.prompt || '').trim());

  const chips    = _jobParamChips(job);
  const chipHtml = chips.map(c => `<span class="err-chip">${escHtml(c)}</span>`).join('');

  const refs = job.refsCopy || [];
  const refsHtml = refs.length
    ? `<div class="err-refs">${refs.map(r => r.thumb
        ? `<img class="err-ref-thumb" src="data:${r.mimeType||'image/jpeg'};base64,${r.thumb}" title="${escHtml(r.userLabel || r.autoName || '')}">`
        : `<div class="err-ref-thumb err-ref-nothumb" title="${escHtml(r.userLabel || r.autoName || '')}">?</div>`
      ).join('')}</div>`
    : '';

  cardEl.classList.remove('placeholder-card');
  cardEl.classList.add('error-card');
  cardEl._job = job;

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
        <div class="err-prompt">${fullPrompt}</div>
        ${refsHtml}
        <div class="err-btns">
          <button class="ibtn" onclick="reuseTimedOutJob('${cardKey}')" title="Load params into form to review and re-generate">↺ Reuse</button>
          <button class="ibtn err-rerun-btn" onclick="rerunJob('${cardKey}')" title="Re-run this job immediately with the same parameters">▶ Rerun</button>
        </div>
      </div>
    </div>
    <div class="img-card-meta">
      <div class="meta-pill">Model: <b>${escHtml(modelName)}</b></div>
      <div class="meta-pill" style="color:#c08060;">${icon} ${friendlyMsg}</div>
    </div>`;
}

// Immediately re-queues the failed job with identical parameters
function rerunJob(cardKey) {
  const card = document.querySelector(`[data-card-key="${cardKey}"]`);
  const job = card?._job;
  if (!job) { toast('Cannot rerun — job data lost', 'err'); return; }
  const { id, status, startedAt, elapsed, retryAttempt, retryTotal, pendingCards,
          requestId, cancelled, ...jobData } = job;
  addToQueue(jobData);
  // In-place: move new placeholder(s) to old error card's position, then remove old card
  const lastJob = jobQueue[jobQueue.length - 1];
  if (lastJob?.pendingCards?.length && card?.parentNode) {
    for (const newCard of lastJob.pendingCards) {
      card.parentNode.insertBefore(newCard, card);
    }
  }
  if (card?.parentNode) card.parentNode.removeChild(card);
}
// Re-loads job parameters into the form so the user can review and re-generate
async function loadJobParamsToForm(job) {
  if (!job) return;
  const type = job.model?.type;

  // Helper — set folder dropdown
  const _setFld = (val) => {
    if (!val) return;
    const el = document.getElementById('targetFolder');
    if (el) el.value = val;
  };
  // Helper — set radio by name+value
  const _setRadio = (name, value) => {
    if (!value) return;
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  };
  // Helper — set slider + display label
  const _setSlider = (inputId, labelId, value, fmt) => {
    if (value === undefined || value === null) return;
    const el = document.getElementById(inputId);
    if (el) el.value = value;
    const lbl = document.getElementById(labelId);
    if (lbl) lbl.textContent = fmt ? fmt(value) : value;
  };

  // ── 1. Prompt ──
  const promptEl = document.getElementById('prompt');
  if (promptEl) {
    promptEl.value = job.rawPrompt || job.prompt || '';
    promptEl.dispatchEvent(new Event('input'));
    if (typeof updateCharCount === 'function') updateCharCount();
  }

  // ── 2. Select model ──
  if (job.modelKey && typeof selectModel === 'function') selectModel(job.modelKey);

  // ── 3. Model-specific params ──

  if (type === 'gemini' && job.geminiSnap) {
    const s = job.geminiSnap;
    if (s.aspectRatio) setAspectRatioSafe(s.aspectRatio);
    _setRadio('nbRes', s.imageSize || '1K');
    _setRadio('thinking', s.thinkingLevel || 'minimal');
    const searchEl = document.getElementById('useSearch');
    if (searchEl) searchEl.checked = !!s.useSearch;
    _setFld(s.targetFolder);
  }

  if (type === 'imagen' && job.imagenSnap) {
    const s = job.imagenSnap;
    if (s.aspectRatio) setAspectRatioSafe(s.aspectRatio);
    _setRadio('imgSize', s.imageSize || '1K');
    _setRadio('imagenCount', String(s.sampleCount || 1));
    _setFld(s.targetFolder);
  }

  if (type === 'flux' && job.fluxSnap) {
    const s = job.fluxSnap;
    if (s.ratio) setAspectRatioSafe(s.ratio);
    if (s.tier) {
      _setRadio('fluxQuality', String(s.tier));
      if (typeof updateFluxQualityInfo === 'function') updateFluxQualityInfo();
    }
    const seedEl = document.getElementById('fluxSeed');
    if (seedEl) seedEl.value = (s.seed && s.seed !== '—') ? s.seed : '';
    _setSlider('fluxSteps',    'fluxStepsVal',    s.steps,            v => v);
    _setSlider('fluxGuidance', 'fluxGuidanceVal', s.guidance,         v => parseFloat(v).toFixed(1));
    const safeEl = document.getElementById('fluxSafety');
    if (safeEl && s.safetyTolerance !== undefined) safeEl.value = s.safetyTolerance;
    const upsEl = document.getElementById('fluxUpsampling');
    if (upsEl) upsEl.checked = !!s.promptUpsampling;
    const grndEl = document.getElementById('fluxGrounding');
    if (grndEl) grndEl.checked = !!s.groundingSearch;
    _setFld(s.targetFolder);
  }

  if (type === 'seedream' && job.sdSnap) {
    const s = job.sdSnap;
    if (s.aspectRatio) setAspectRatioSafe(s.aspectRatio);
    _setRadio('sdQuality', s.resolution || '2K');
    _setRadio('sdEnhance', s.enhanceMode || 'standard');
    const seedEl = document.getElementById('sdSeed');
    if (seedEl) seedEl.value = (s.seed && s.seed !== '—') ? s.seed : '';
    const safeEl = document.getElementById('sdSafety');
    if (safeEl) safeEl.checked = s.safety !== false;
    _setFld(s.targetFolder);
  }

  if (type === 'kling' && job.klingSnap) {
    const s = job.klingSnap;
    const kResMap = { '1K': 'kr_1k', '2K': 'kr_2k', '4K': 'kr_4k' };
    const resEl = document.getElementById(kResMap[s.resolution] || 'kr_1k');
    if (resEl) resEl.checked = true;
    _setFld(s.targetFolder);
  }

  if (type === 'zimage' && job.zimageSnap) {
    const s = job.zimageSnap;
    const mpMap = { '1': 'zr_1mp', '2': 'zr_2mp', '4': 'zr_4mp' };
    const mpEl = document.getElementById(mpMap[String(s.imageSize)] || 'zr_1mp');
    if (mpEl) mpEl.checked = true;
    const seedEl = document.getElementById('zimageSeed');
    if (seedEl) seedEl.value = (s.seed && s.seed !== '—') ? s.seed : '';
    _setSlider('zimageSteps',    'zimageStepsVal',    s.steps,    v => v);
    _setSlider('zimageGuidance', 'zimageGuidanceVal', s.guidance, v => parseFloat(v).toFixed(1));
    const negEl = document.getElementById('zimageNeg');
    if (negEl && s.negPrompt !== undefined) negEl.value = s.negPrompt;
    _setRadio('zimageAccel', s.acceleration || 'regular');
    const safeEl = document.getElementById('zimageSafety');
    if (safeEl) safeEl.checked = s.safety !== false;
    const strEl = document.getElementById('zimageStrength');
    if (strEl && s.strength !== undefined) strEl.value = s.strength;
    _setFld(s.targetFolder);
  }

  if (type === 'qwen2' && job.qwen2Snap) {
    const s = job.qwen2Snap;
    _setRadio('qwen2Res', s.resolution || '1K');
    const seedEl = document.getElementById('qwen2Seed');
    if (seedEl) seedEl.value = (s.seed && s.seed !== '—') ? s.seed : '';
    _setSlider('qwen2Steps',    'qwen2StepsVal',    s.steps,    v => v);
    _setSlider('qwen2Guidance', 'qwen2GuidanceVal', s.guidance, v => parseFloat(v).toFixed(1));
    const accMap = { none: 'qwa_none', regular: 'qwa_reg', high: 'qwa_high' };
    const accEl = document.getElementById(accMap[s.acceleration] || 'qwa_reg');
    if (accEl) accEl.checked = true;
    const expandEl = document.getElementById('qwen2Expand');
    if (expandEl) expandEl.checked = !!s.promptExpansion;
    const safeEl = document.getElementById('qwen2Safety');
    if (safeEl) safeEl.checked = s.safety !== false;
    _setFld(s.targetFolder);
  }

  if (type === 'wan27r' && job.wan27Snap) {
    const s = job.wan27Snap;
    const sizeEl = document.getElementById('wan27Size');
    if (sizeEl && s.size) sizeEl.value = s.size;
    if (s.count) _setRadio('wan27Count', String(s.count));
    const thinkEl = document.getElementById('wan27Thinking');
    if (thinkEl) thinkEl.checked = !!s.thinkingMode;
    const safeEl = document.getElementById('wan27Safety');
    if (safeEl) safeEl.checked = s.safety !== false;
    const seedEl = document.getElementById('wan27Seed');
    if (seedEl) seedEl.value = (s.seed && s.seed !== '—') ? s.seed : '';
    _setFld(s.targetFolder);
  }

  if (type === 'proxy_xai' && job.xaiSnap) {
    const s = job.xaiSnap;
    if (s.aspectRatio) setAspectRatioSafe(s.aspectRatio);
    _setRadio('grokRes', s.grokRes);
    if (s.grokCount) _setRadio('grokCount', String(s.grokCount));
    _setFld(s.targetFolder);
  }

  if (type === 'proxy_luma' && job.lumaSnap) {
    const s = job.lumaSnap;
    if (s.aspectRatio) setAspectRatioSafe(s.aspectRatio);
    const imgWEl = document.getElementById('lumaImgWeight');
    if (imgWEl && s.imgWeight !== undefined) imgWEl.value = s.imgWeight;
    const styleWEl = document.getElementById('lumaStyleWeight');
    if (styleWEl && s.styleWeight !== undefined) styleWEl.value = s.styleWeight;
    const modWEl = document.getElementById('lumaModifyWeight');
    if (modWEl && s.modifyWeight !== undefined) modWEl.value = s.modifyWeight;
    _setFld(s.targetFolder);
  }

  // ── 4. Restore reference images from job snapshot ──
  if (job.refsCopy?.length) {
    refs = [];
    for (const snap of job.refsCopy) {
      if (refs.length >= getRefMax()) break;
      // Load asset from DB — or re-create from inline imageData (older snapshots)
      let asset = null;
      if (snap.assetId) asset = await dbGet('assets', snap.assetId).catch(() => null);
      if (!asset && snap.imageData) asset = await createAsset(snap.imageData, snap.mimeType || 'image/png', 'generated');
      if (!asset?.imageData) continue;
      refs.push({
        assetId:   asset.id,
        autoName:  snap.autoName || asset.autoName || null,
        userLabel: snap.userLabel || '',
        mimeType:  asset.mimeType || snap.mimeType || 'image/png',
        thumb:     asset.thumb || null,
        dims:      asset.dims  || null,
      });
    }
    if (typeof renderRefThumbs === 'function') renderRefThumbs();
  }

  // ── 5. Switch to gen view and confirm ──
  switchView('gen');
  setGenMode('image');
  if (refs.length)
    toast(`Parameters loaded + ${refs.length} reference${refs.length > 1 ? 's' : ''} restored — review and generate`, 'ok');
  else
    toast('Parameters loaded — review and click Generate', 'ok');
}

// Remove error card and load its job params back into the form
function reuseTimedOutJob(cardKey) {
  const card = document.querySelector(`[data-card-key="${cardKey}"]`);
  const job = card?._job;
  if (!job) { toast('Cannot reuse — job data lost', 'err'); return; }

  // Remove the error card first
  if (card.parentNode) card.parentNode.removeChild(card);

  // Load all params into the form
  loadJobParamsToForm(job);
}

