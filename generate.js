// ═══════════════════════════════════════════════════════
// GENERATE
// ═══════════════════════════════════════════════════════

async function generate() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const rawPrompt = document.getElementById('prompt').value.trim();
  if (!apiKey) { showApiKeyWarning('Google API Key missing', 'This model requires a Google API key. Add it in the Setup tab to start generating.'); return; }
  if (!rawPrompt && selectedStyles.size === 0) { toast('Enter a prompt or select a style', 'err'); return; }

  const m = MODELS[currentModel];
  // Preprocessing: @mentions → model-specific format
  const promptText = preprocessPromptForModel(rawPrompt, refs, m.type);

  // Přidat style suffix + camera suffix
  const styleSuffix = buildStyleSuffix(m.type);
  const cameraSuffix = buildCameraSuffix();
  const extraSuffix = [styleSuffix, cameraSuffix].filter(Boolean).join(', ');
  let styledPrompt;
  if (extraSuffix && m.type === 'gemini') {
    styledPrompt = (styleSuffix ? 'Visual style instructions: ' + styleSuffix + '.' : '') +
                   (styleSuffix && cameraSuffix ? ' ' : '') +
                   (cameraSuffix ? 'Camera: ' + cameraSuffix + '.' : '') +
                   '\n\n' + promptText;
  } else if (extraSuffix) {
    styledPrompt = promptText + ', ' + extraSuffix;
  } else {
    styledPrompt = promptText;
  }
  // Snapshot refs pro job (zahrnuje assetId pro Reuse)
  const refsCopy = refs.map(r => ({ ...r }));

  if (m.type === 'gemini') {
    const nbResEl = document.querySelector('input[name="nbRes"]:checked');
    const thinkEl = document.querySelector('input[name="thinking"]:checked');
    const geminiSnap = {
      imageSize: nbResEl ? nbResEl.value : '1K',
      thinkingLevel: thinkEl ? thinkEl.value : 'minimal',
      useSearch: document.getElementById('useSearch').checked,
      persistentRetry: document.getElementById('persistentRetry').checked,
      aspectRatio: document.getElementById('aspectRatio').value,
      targetFolder: document.getElementById('targetFolder').value,
    };
    const count = parseInt(document.querySelector('input[name="nbCount"]:checked').value);
    addToQueue({ apiKey, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, geminiSnap, geminiCount: count });
  } else if (m.type === 'seedream') {
    const falKey = document.getElementById('fluxApiKey').value.trim();
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'This model requires a fal.ai API key. Add it in the Setup tab to start generating.'); return; }
    const sdSnap = {
      resolution:  document.querySelector('input[name="sdQuality"]:checked')?.value || '2K',
      enhanceMode: document.querySelector('input[name="sdEnhance"]:checked')?.value || 'standard',
      seed:        document.getElementById('sdSeed').value.trim() || null,
      safety:      document.getElementById('sdSafety').checked,
      aspectRatio: document.getElementById('aspectRatio').value,
      targetFolder: document.getElementById('targetFolder').value,
    };
    const sdCount = parseInt(document.querySelector('input[name="sdCount"]:checked')?.value || '1');
    addToQueue({ apiKey: falKey, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, sdSnap, sdCount });
  } else if (m.type === 'flux') {
    const fluxKey = document.getElementById('fluxApiKey').value.trim();
    if (!fluxKey) { showApiKeyWarning('fal.ai API Key missing', 'This model requires a fal.ai API key. Add it in the Setup tab to start generating.'); return; }
    const tier = parseInt(document.querySelector('input[name="fluxQuality"]:checked')?.value || '1024');
    const ratio = document.getElementById('aspectRatio').value;
    const { w: fw, h: fh } = calcFluxDims(ratio, tier);
    const fluxCount = parseInt(document.querySelector('input[name="fluxCount"]:checked')?.value || '1');

    const fluxSnap = {
      width:            fw,
      height:           fh,
      ratio,                              // pro falImageSize v callFlux
      tier,                               // pro falImageSize v callFlux
      steps:            parseInt(document.getElementById('fluxSteps').value),
      guidance:         parseFloat(document.getElementById('fluxGuidance').value),
      seed:             document.getElementById('fluxSeed').value.trim() || null,
      safetyTolerance:  parseInt(document.getElementById('fluxSafety').value),
      promptUpsampling: document.getElementById('fluxUpsampling').checked,
      groundingSearch:  document.getElementById('fluxGrounding').checked,
      targetFolder:     document.getElementById('targetFolder').value,
    };

    addToQueue({
      apiKey: fluxKey,
      prompt: styledPrompt,
      rawPrompt,
      model: m,
      modelKey: currentModel,
      refsCopy,
      fluxSnap,
      fluxCount,
    });
  } else if (m.type === 'imagen') {
    // Snapshot Imagen params now
    const nImgEl = document.querySelector('input[name="nImg"]:checked');
    const szEl = document.querySelector('input[name="imgSize"]:checked');
    const icEl = document.querySelector('input[name="imagenCount"]:checked');
    const imagenSnap = {
      nImg: nImgEl ? parseInt(nImgEl.value) : 1,
      imageSize: szEl ? szEl.value : '1K',
      sampleCount: icEl ? parseInt(icEl.value) : 1,
      aspectRatio: document.getElementById('aspectRatio').value,
      targetFolder: document.getElementById('targetFolder').value,
    };
    addToQueue({ apiKey, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy: [], imagenSnap });
  } else if (m.type === 'kling') {
    const falKey = document.getElementById('fluxApiKey').value.trim();
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'This model requires a fal.ai API key. Add it in the Setup tab to start generating.'); return; }
    const klingSnap = {
      resolution: document.querySelector('input[name="klingRes"]:checked')?.value || '1K',
      targetFolder: document.getElementById('targetFolder').value,
    };
    const klingCount = parseInt(document.querySelector('input[name="klingCount"]:checked')?.value || '1');
    addToQueue({ apiKey: falKey, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, klingSnap, klingCount });
  } else if (m.type === 'zimage') {
    const falKey = document.getElementById('fluxApiKey').value.trim();
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'This model requires a fal.ai API key. Add it in the Setup tab to start generating.'); return; }
    const stepsEl = document.getElementById('zimageSteps');
    const zimageSnap = {
      imageSize:    document.querySelector('input[name="zimageRes"]:checked')?.value || '1',
      steps:        parseInt(stepsEl?.value || (m.id.includes('turbo') ? '8' : '28')),
      guidance:     m.guidance ? parseFloat(document.getElementById('zimageGuidance').value) : null,
      negPrompt:    m.negPrompt ? (document.getElementById('zimageNeg').value.trim() || '') : '',
      acceleration: document.querySelector('input[name="zimageAccel"]:checked')?.value || 'regular',
      safety:       document.getElementById('zimageSafety').checked,
      seed:         document.getElementById('zimageSeed').value.trim() || null,
      targetFolder: document.getElementById('targetFolder').value,
      strength:     parseFloat(document.getElementById('zimageStrength')?.value || '0.85'),
    };
    const zimageCount = parseInt(document.querySelector('input[name="zimageCount"]:checked')?.value || '1');
    addToQueue({ apiKey: falKey, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, zimageSnap, zimageCount });
  } else if (m.type === 'qwen2') {
    const falKey = document.getElementById('fluxApiKey').value.trim();
    if (!falKey) { showApiKeyWarning('fal.ai API Key missing', 'This model requires a fal.ai API key. Add it in the Setup tab to start generating.'); return; }
    const qwen2Snap = {
      resolution:      document.querySelector('input[name="qwen2Res"]:checked')?.value || '1K',
      steps:           parseInt(document.getElementById('qwen2Steps')?.value || '25'),
      guidance:        parseFloat(document.getElementById('qwen2Guidance')?.value || '5'),
      acceleration:    document.querySelector('input[name="qwen2Accel"]:checked')?.value || 'regular',
      promptExpansion: document.getElementById('qwen2Expand')?.checked || false,
      safety:          document.getElementById('qwen2Safety')?.checked !== false,
      seed:            document.getElementById('qwen2Seed')?.value.trim() || null,
      targetFolder:    document.getElementById('targetFolder').value,
    };
    const qwen2Count = m.editModel ? 1 : parseInt(document.querySelector('input[name="qwen2Count"]:checked')?.value || '1');
    addToQueue({ apiKey: falKey, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, qwen2Snap, qwen2Count });

  } else if (m.type === 'wan27r') {
    const replicateKey = (localStorage.getItem('gis_replicate_apikey') || '').trim();
    const proxyUrl     = (localStorage.getItem('gis_proxy_url') || '').trim().replace(/\/$/, '');
    if (!replicateKey) { showApiKeyWarning('Replicate API Key missing', 'This model requires a Replicate API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl)     { toast('Enter Proxy URL in Setup tab', 'err'); return; }
    const wan27Snap = {
      size:         document.getElementById('wan27Size')?.value || '2048*1152',
      count:        m.editModel ? 1 : parseInt(document.querySelector('input[name="wan27Count"]:checked')?.value || '1'),
      thinkingMode: !m.editModel && (document.getElementById('wan27Thinking')?.checked || false),
      safety:       document.getElementById('wan27Safety')?.checked !== false,
      seed:         document.getElementById('wan27Seed')?.value.trim() || null,
      targetFolder: document.getElementById('targetFolder').value,
    };
    addToQueue({ replicateKey, proxyUrl, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, wan27Snap });

  } else if (m.type === 'proxy_xai') {
    const xaiKey   = (localStorage.getItem('gis_xai_apikey') || '').trim();
    const proxyUrl = (localStorage.getItem('gis_proxy_url') || '').trim().replace(/\/$/, '');
    if (!xaiKey) { showApiKeyWarning('xAI API Key missing', 'This model requires an xAI API key. Add it in the Setup tab to start generating.'); return; }
    if (!proxyUrl) { toast('Enter Proxy URL in Setup tab', 'err'); return; }
    const xaiSnap = {
      aspectRatio:  document.getElementById('aspectRatio').value || '16:9',
      grokRes:      document.querySelector('input[name="grokRes"]:checked')?.value || '1k',
      grokCount:    parseInt(document.querySelector('input[name="grokCount"]:checked')?.value || '1'),
      targetFolder: document.getElementById('targetFolder').value,
    };
    addToQueue({ apiKey: xaiKey, proxyUrl, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, xaiSnap });

  } else if (m.type === 'proxy_luma') {
    const lumaKey  = (localStorage.getItem('gis_luma_apikey') || '').trim();
    const proxyUrl = (localStorage.getItem('gis_proxy_url') || '').trim().replace(/\/$/, '');
    if (!lumaKey) { showApiKeyWarning('Luma API Key missing', 'This model requires a Luma API key. Add it in the Setup tab to start generating.'); return; }
    if (!proxyUrl) { toast('Enter Proxy URL in Setup tab', 'err'); return; }
    const lumaSnap = {
      aspectRatio:   document.getElementById('aspectRatio').value,
      targetFolder:  document.getElementById('targetFolder').value,
      imgWeight:     parseFloat(document.getElementById('lumaImgWeight')?.value   || '0.85'),
      styleWeight:   parseFloat(document.getElementById('lumaStyleWeight')?.value || '0.80'),
      modifyWeight:  parseFloat(document.getElementById('lumaModifyWeight')?.value || '1.00'),
    };
    addToQueue({ apiKey: lumaKey, proxyUrl, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, lumaSnap });

  } else if (m.type === 'proxy_mystic') {
    const freepikKey = (localStorage.getItem('gis_freepik_apikey') || '').trim();
    const proxyUrl   = (localStorage.getItem('gis_proxy_url') || '').trim().replace(/\/$/, '');
    if (!freepikKey) { showApiKeyWarning('Freepik API Key missing', 'This model requires a Freepik API key. Add it in the Setup tab to start generating.'); return; }
    if (!proxyUrl)   { toast('Enter Proxy URL in Setup tab', 'err'); return; }
    const mysticSnap = {
      count:             parseInt(document.querySelector('input[name="mysticCount"]:checked')?.value || '1'),
      resolution:        document.querySelector('input[name="mysticRes"]:checked')?.value || '2k',
      creative_detailing:parseInt(document.getElementById('mysticDetail')?.value || '33'),
      engine:            document.querySelector('input[name="mysticEngine"]:checked')?.value || 'automatic',
      fixed:             document.getElementById('mysticFixed')?.checked || false,
      structure_strength:parseInt(document.getElementById('mysticStructStr')?.value || '50'),
      adherence:         parseInt(document.getElementById('mysticAdherence')?.value || '50'),
      aspectRatio:       document.getElementById('aspectRatio').value,
      targetFolder:      document.getElementById('targetFolder').value,
    };
    addToQueue({ freepikKey, proxyUrl, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, mysticSnap });

  } else if (m.type === 'proxy_freepik_edit') {
    const freepikKey = (localStorage.getItem('gis_freepik_apikey') || '').trim();
    const proxyUrl   = (localStorage.getItem('gis_proxy_url') || '').trim().replace(/\/$/, '');
    if (!freepikKey) { showApiKeyWarning('Freepik API Key missing', 'This model requires a Freepik API key. Add it in the Setup tab.'); return; }
    if (!proxyUrl)   { toast('Enter Proxy URL in Setup tab', 'err'); return; }
    const editSnap = {
      tool:            m.freepikTool,
      targetFolder:    document.getElementById('targetFolder').value,
      // Relight
      relightStr:      parseInt(document.getElementById('fepRelightStr')?.value || '100'),
      relightChangeBg: document.getElementById('fepRelightChangeBg')?.checked || false,
      relightStyle:    document.querySelector('input[name="fepRelightStyle"]:checked')?.value || 'smooth',
      relightInterpolate: document.getElementById('fepRelightInterpolate')?.checked || false,
      // Style Transfer
      stylePortrait:   document.getElementById('fepStylePortrait')?.checked || false,
      styleFixed:      document.getElementById('fepStyleFixed')?.checked || false,
      // Skin Enhancer
      skinVariant:     document.querySelector('input[name="fepSkinVariant"]:checked')?.value || 'creative',
      skinSharpen:     parseInt(document.getElementById('fepSkinSharpen')?.value || '0'),
      skinGrain:       parseInt(document.getElementById('fepSkinGrain')?.value || '2'),
    };
    addToQueue({ freepikKey, proxyUrl, prompt: styledPrompt, rawPrompt, model: m, modelKey: currentModel, refsCopy, editSnap });
  }
}

// ═══════════════════════════════════════════════════════
// RENDER QUEUE
// ═══════════════════════════════════════════════════════
let jobQueue = [];
// Počet aktivně běžících jobů per modelId — max 4 paralelně pro všechny modely
const runningModelCounts = new Map();

function getModelConcurrencyLimit(modelId) {
  return 4; // jednotný limit pro fal.ai i Google modely
}

function addToQueue(jobData) {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    throw new Error('Application integrity check failed. Please use the original GIS.');
  }

  // Batch mode: force snap=1 and attach batch metadata
  if (_batchForceSnap) {
    jobData.geminiCount = 1;
    jobData.fluxCount   = 1;
    jobData.sdCount     = 1;
    jobData.klingCount  = 1;
    jobData.zimageCount = 1;
    jobData.qwen2Count  = 1;
    if (jobData.xaiSnap)    jobData.xaiSnap.grokCount      = 1;
    if (jobData.imagenSnap) jobData.imagenSnap.sampleCount  = 1;
    if (jobData.wan27Snap)  jobData.wan27Snap.count         = 1;
    if (jobData.mysticSnap) jobData.mysticSnap.count        = 1;
    if (_batchCurrentStyle) jobData.batchStyle = {
      num: _batchCurrentStyle.num, id: _batchCurrentStyle.id, name: _batchCurrentStyle.name, mode: styleMode
    };
    if (_batchCurrentCamera) jobData.batchCamera = {
      num: _batchCurrentCamera.num, id: _batchCurrentCamera.id, name: _batchCurrentCamera.name
    };
  }

  const job = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2,4),
    status: 'pending',   // pending | running | done | error
    label: jobData.prompt.substring(0, 40) + (jobData.prompt.length > 40 ? '…' : ''),
    modelId: jobData.model?.id || 'upscale', // pro dedup
    ...jobData,
  };
  jobQueue.push(job);

  // Okamžitě vytvoř placeholder karty — i pro joby waitingcí ve frontě
  if (!job.isUpscale) {
    const count = job.geminiCount || job.fluxCount || job.sdCount || job.klingCount
                || job.zimageCount || job.qwen2Count
                || job.wan27Snap?.count
                || job.mysticSnap?.count
                || job.xaiSnap?.grokCount
                || job.imagenSnap?.sampleCount || 1;
    job.pendingCards = Array.from({ length: count }, (_, i) => createPlaceholderCard(job, i));
  } else {
    job.pendingCards = [createPlaceholderCard(job, 0)];
  }

  renderQueue();
  tryStartJobs(); // okamžitě spustit pokud je model volný
}

// Projde pending joby a spustí ty, jejichž model má volný slot
function tryStartJobs() {
  for (const job of jobQueue) {
    if (job.status !== 'pending') continue;
    const limit = getModelConcurrencyLimit(job.modelId);
    const running = runningModelCounts.get(job.modelId) || 0;
    if (running >= limit) continue;
    runningModelCounts.set(job.modelId, running + 1);
    runJobAndContinue(job); // fire-and-forget
  }
  // Aktualizovat stav tlačítka
  const anyActive = jobQueue.some(j => j.status === 'pending' || j.status === 'running');
  setGenBtnState(anyActive);
}

// Spustí job, po dokončení uvolní slot a zkusí spustit další
async function runJobAndContinue(job) {
  await runJob(job);
  const count = runningModelCounts.get(job.modelId) || 1;
  if (count <= 1) runningModelCounts.delete(job.modelId);
  else runningModelCounts.set(job.modelId, count - 1);
  tryStartJobs(); // okamžitě spustit další waitingcí job pro tento model
}

// ── Update all pending placeholder cards with a status line ──
function _updatePendingCardsStatus(job, text) {
  for (const card of (job.pendingCards || [])) {
    if (!card || !document.contains(card)) continue;
    let el = card.querySelector('.ph-retry-status');
    if (!el) {
      el = document.createElement('div');
      el.className = 'ph-retry-status';
      const overlay = card.querySelector('.ph-overlay');
      if (overlay) overlay.appendChild(el);
    }
    el.textContent = text;
    el.style.display = text ? '' : 'none';
  }
}

// ── Retry helper: standard 3×3s OR persistent 10× exponential backoff ──
// Neretry-uje pokud job.streamAccepted (model přijal, generuje) — timeout řeší callGeminiStream
const RETRY_CODES = ['503', '529', '429'];

// Standard profile (default)
const RETRY_STD_DELAYS = [3000, 3000, 3000]; // 3× 3s = 9s total

// Persistent profile: 5→10→20→30→60×6 = ~10 min total
const RETRY_PERSISTENT_DELAYS = [5000, 10000, 20000, 30000, 60000, 60000, 60000, 60000, 60000, 60000];

async function withRetry(fn, job) {
  const persistent = job.geminiSnap?.persistentRetry;
  const delays = persistent ? RETRY_PERSISTENT_DELAYS : RETRY_STD_DELAYS;
  const maxAttempts = delays.length + 1; // first attempt + retries

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      job.streamAccepted = false; // reset před každým pokusem
      return await fn();
    } catch(e) {
      const isSubmitError = RETRY_CODES.some(code => e.message.startsWith(`API ${code}`));
      const isRetryable = isSubmitError && !job.streamAccepted;
      if (!isRetryable || attempt === maxAttempts) throw e;
      job.retryAttempt = attempt;
      job.retryTotal = maxAttempts - 1;
      renderQueue();
      const errCode = RETRY_CODES.find(code => e.message.startsWith(`API ${code}`)) || '';
      const delaySec = Math.round(delays[attempt - 1] / 1000);

      // Countdown on placeholder cards
      const t0 = Date.now();
      const target = t0 + delays[attempt - 1];
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
        _updatePendingCardsStatus(job, `⟳ ${errCode} — retry ${attempt}/${maxAttempts - 1} — waiting ${delaySec}s (${remaining}s)`);
      };
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      toast(`${errCode} — retrying in ${delaySec}s (attempt ${attempt}/${maxAttempts - 1})`, 'err');
      await new Promise(r => setTimeout(r, delays[attempt - 1]));
      clearInterval(interval);
      _updatePendingCardsStatus(job, '');
    }
  }
}

// Spustí jeden job a vrátí Promise (nikdy nehodí — chyby zaznamenává do jobu)
// POZOR: nevolat přímo — používat runJobAndContinue() pro správné uvolnění slotu
async function runJob(job) {
  job.status = 'running';
  job.startedAt = Date.now();
  job.retryAttempt = 0;
  renderQueue();
  try {
    if (job.isUpscale) {
      // Upscale: placeholder + waitingní na výsledek
      const cardEl = job.pendingCards?.[0] || createPlaceholderCard(job, 0);
      await withRetry(() => runUpscaleJob(job, cardEl), job);

    } else if (job.model.type === 'gemini') {
      const count = job.geminiCount || 1;
      document.getElementById('emptyState').style.display = 'none';

      if (count === 1) {
        // Jeden obrázek — placeholder + SSE stream
        const cardEl = job.pendingCards?.[0] || createPlaceholderCard(job, 0);
        const result = await withRetry(async () => {
          // Reset thinking log při každém pokusu
          const tw = cardEl.querySelector('.ph-think-wrap');
          const tb = cardEl.querySelector('.ph-think-body');
          if (tw) tw.classList.remove('visible');
          if (tb) tb.textContent = '';
          return callGeminiStream(
            job.apiKey, job.prompt, job.model, job.refsCopy, job.geminiSnap,
            (txt) => updatePlaceholderThinking(cardEl, txt),
            job
          );
        }, job);
        const galId = await saveToGallery(result, job.prompt, job.geminiSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
        await replacePlaceholder(cardEl, result, job.prompt, galId);
        trackSpend('google', job.model.id);

      } else {
        // Více obrázků — N placeholderů, paralelně max 4
        const PARALLEL = 4;
        const indices = Array.from({length: count}, (_, i) => i);
        // Předem vytvoř všechny placeholder karty
        const cards = job.pendingCards || indices.map(i => createPlaceholderCard(job, i));

        for (let i = 0; i < indices.length; i += PARALLEL) {
          const batchIdx = indices.slice(i, i + PARALLEL);
          const settled = await Promise.allSettled(
            batchIdx.map((_, bi) => {
              const cardEl = cards[i + bi];
              return withRetry(async () => {
                const tw = cardEl.querySelector('.ph-think-wrap');
                const tb = cardEl.querySelector('.ph-think-body');
                if (tw) tw.classList.remove('visible');
                if (tb) tb.textContent = '';
                return callGeminiStream(
                  job.apiKey, job.prompt, job.model, job.refsCopy, job.geminiSnap,
                  (txt) => updatePlaceholderThinking(cardEl, txt),
                  job
                );
              }, job);
            })
          );
          for (let j = 0; j < settled.length; j++) {
            const r = settled[j];
            const cardEl = cards[i + j];
            if (r.status === 'fulfilled') {
              const galId = await saveToGallery(r.value, job.prompt, job.geminiSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
              await replacePlaceholder(cardEl, r.value, job.prompt, galId);
              trackSpend('google', job.model.id);
            } else {
              showErrorPlaceholder(cardEl, job, r.reason?.message || String(r.reason));
            }
          }
          if (i + PARALLEL < indices.length) await new Promise(r => setTimeout(r, 1000));
        }
      }

    } else if (job.model.type === 'flux') {
      // FLUX.2 — N paralelních callů, každý dostane vlastní placeholder kartu
      document.getElementById('emptyState').style.display = 'none';
      const count = job.fluxCount || 1;
      const cards = job.pendingCards || [createPlaceholderCard(job, 0)];

      // Paralelně spusť všechny — Together AI sync endpoint zvládne bez problémů
      const settled = await Promise.allSettled(
        cards.map((cardEl, i) => withRetry(async () => {
          // Reset status při každém retry
          const tw = cardEl.querySelector('.ph-think-wrap');
          const tb = cardEl.querySelector('.ph-think-body');
          if (tw) tw.classList.remove('visible');
          if (tb) tb.textContent = '';
          // Seed: pokud je nastaven, každý obrázek dostane baseSeed + index (reprodukovatelné varianty)
          const snapForCall = { ...job.fluxSnap };
          if (snapForCall.seed) snapForCall.seed = String(parseInt(snapForCall.seed) + i);
          return callFlux(
            job.apiKey, job.prompt, job.model, job.refsCopy, snapForCall,
            (status) => updatePlaceholderThinking(cardEl, status)
          );
        }, job))
      );

      // Zpracuj výsledky — úspěch → galerie, chyba → chybová karta
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const cardEl = cards[i];
        if (r.status === 'fulfilled') {
          const galId = await saveToGallery(r.value, job.prompt, job.fluxSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
          await replacePlaceholder(cardEl, r.value, job.prompt, galId);
          trackSpend('fal', job.model.id);
        } else {
          showErrorPlaceholder(cardEl, job, r.reason?.message || String(r.reason));
        }
      }

    } else if (job.model.type === 'seedream') {
      // SeeDream — N paralelních callů, každý vlastní placeholder karta
      document.getElementById('emptyState').style.display = 'none';
      const count = job.sdCount || 1;
      const cards = job.pendingCards || [createPlaceholderCard(job, 0)];

      const settled = await Promise.allSettled(
        cards.map((cardEl, i) => withRetry(async () => {
          const tw = cardEl.querySelector('.ph-think-wrap');
          const tb = cardEl.querySelector('.ph-think-body');
          if (tw) tw.classList.remove('visible');
          if (tb) tb.textContent = '';
          // Seed derivace: base + index
          const snapForCall = { ...job.sdSnap };
          if (snapForCall.seed) snapForCall.seed = String(parseInt(snapForCall.seed) + i);
          return callSeedream(
            job.apiKey, job.prompt, job.model, job.refsCopy, snapForCall,
            (status) => updatePlaceholderThinking(cardEl, status)
          );
        }, job))
      );

      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const cardEl = cards[i];
        if (r.status === 'fulfilled') {
          const galId = await saveToGallery(r.value, job.prompt, job.sdSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
          await replacePlaceholder(cardEl, r.value, job.prompt, galId);
          trackSpend('fal', job.model.id);
        } else {
          showErrorPlaceholder(cardEl, job, r.reason?.message || String(r.reason));
        }
      }

    } else if (job.model.type === 'kling') {
      document.getElementById('emptyState').style.display = 'none';
      const count = job.klingCount || 1;
      const cards = job.pendingCards || [createPlaceholderCard(job, 0)];
      const settled = await Promise.allSettled(
        cards.map((cardEl) => withRetry(async () => {
          const tw = cardEl.querySelector('.ph-think-wrap');
          const tb = cardEl.querySelector('.ph-think-body');
          if (tw) tw.classList.remove('visible');
          if (tb) tb.textContent = '';
          return callKling(job.apiKey, job.prompt, job.model, job.refsCopy, job.klingSnap,
            (s) => updatePlaceholderThinking(cardEl, s));
        }, job))
      );
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const cardEl = cards[i];
        if (r.status === 'fulfilled') {
          const galId = await saveToGallery(r.value, job.prompt, job.klingSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
          await replacePlaceholder(cardEl, r.value, job.prompt, galId);
          trackSpend('fal', job.model.id);
        } else {
          showErrorPlaceholder(cardEl, job, r.reason?.message || String(r.reason));
        }
      }

    } else if (job.model.type === 'zimage') {
      document.getElementById('emptyState').style.display = 'none';
      const count = job.zimageCount || 1;
      const cards = job.pendingCards || [createPlaceholderCard(job, 0)];
      const settled = await Promise.allSettled(
        cards.map((cardEl, i) => withRetry(async () => {
          const tw = cardEl.querySelector('.ph-think-wrap');
          const tb = cardEl.querySelector('.ph-think-body');
          if (tw) tw.classList.remove('visible');
          if (tb) tb.textContent = '';
          const snapForCall = { ...job.zimageSnap };
          if (snapForCall.seed) snapForCall.seed = String(parseInt(snapForCall.seed) + i);
          return callZImage(job.apiKey, job.prompt, job.model, job.refsCopy, snapForCall,
            (s) => updatePlaceholderThinking(cardEl, s));
        }, job))
      );
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const cardEl = cards[i];
        if (r.status === 'fulfilled') {
          const galId = await saveToGallery(r.value, job.prompt, job.zimageSnap?.targetFolder, [], job.rawPrompt, job);
          await replacePlaceholder(cardEl, r.value, job.prompt, galId);
          trackSpend('fal', job.model.id);
        } else {
          showErrorPlaceholder(cardEl, job, r.reason?.message || String(r.reason));
        }
      }

    } else if (job.model.type === 'qwen2') {
      document.getElementById('emptyState').style.display = 'none';
      const count = job.qwen2Count || 1;
      const cards = job.pendingCards || [createPlaceholderCard(job, 0)];
      const settled = await Promise.allSettled(
        cards.map((cardEl, i) => withRetry(async () => {
          const tw = cardEl.querySelector('.ph-think-wrap');
          const tb = cardEl.querySelector('.ph-think-body');
          if (tw) tw.classList.remove('visible');
          if (tb) tb.textContent = '';
          const snapForCall = { ...job.qwen2Snap };
          if (snapForCall.seed) snapForCall.seed = String(parseInt(snapForCall.seed) + i);
          return callQwen2(job.apiKey, job.prompt, job.model, job.refsCopy, snapForCall,
            (s) => updatePlaceholderThinking(cardEl, s));
        }, job))
      );
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const cardEl = cards[i];
        if (r.status === 'fulfilled') {
          const galId = await saveToGallery(r.value, job.prompt, job.qwen2Snap?.targetFolder, job.refsCopy, job.rawPrompt, job);
          await replacePlaceholder(cardEl, r.value, job.prompt, galId);
          trackSpend('fal', job.model.id);
        } else {
          showErrorPlaceholder(cardEl, job, r.reason?.message || String(r.reason));
        }
      }

    } else if (job.model.type === 'wan27r') {
      document.getElementById('emptyState').style.display = 'none';
      const count = job.wan27Snap?.count || 1;
      const cards = job.pendingCards || Array.from({ length: count }, (_, i) => createPlaceholderCard(job, i));
      const settled = await Promise.allSettled(
        cards.map((cardEl, i) => withRetry(async () => {
          const tw = cardEl.querySelector('.ph-think-wrap');
          const tb = cardEl.querySelector('.ph-think-body');
          if (tw) tw.classList.remove('visible');
          if (tb) tb.textContent = '';
          const snapForCall = { ...job.wan27Snap };
          if (snapForCall.seed) snapForCall.seed = String(parseInt(snapForCall.seed) + i);
          return callReplicateWan27(job.replicateKey, job.proxyUrl, job.prompt, job.model, job.refsCopy, snapForCall,
            (s) => updatePlaceholderThinking(cardEl, s));
        }, job))
      );
      for (let i = 0; i < settled.length; i++) {
        const r = settled[i];
        const cardEl = cards[i];
        if (r.status === 'fulfilled') {
          const galId = await saveToGallery(r.value, job.prompt, job.wan27Snap?.targetFolder, job.refsCopy, job.rawPrompt, job);
          await replacePlaceholder(cardEl, r.value, job.prompt, galId);
          trackSpend('replicate', job.model.id);
        } else {
          showErrorPlaceholder(cardEl, job, r.reason?.message || String(r.reason));
        }
      }

    } else if (job.model.type === 'imagen') {
      document.getElementById('emptyState').style.display = 'none';
      const sampleCount = job.imagenSnap?.sampleCount || 1;
      const cards = job.pendingCards || [createPlaceholderCard(job, 0)];
      const results = await withRetry(() => callImagen(job.apiKey, job.prompt, job.model, job.imagenSnap), job);
      for (let i = 0; i < results.length; i++) {
        const galId = await saveToGallery(results[i], job.prompt, job.imagenSnap?.targetFolder, [], job.rawPrompt, job);
        trackSpend('google', job.model.id);
        if (i < cards.length) {
          await replacePlaceholder(cards[i], results[i], job.prompt, galId);
        } else {
          await renderOutput(results[i], job.prompt, galId);
        }
      }
      // Pokud přišlo méně výsledků než placeholderů, odeber přebytečné
      for (let i = results.length; i < cards.length; i++) {
        if (cards[i].parentNode) cards[i].parentNode.removeChild(cards[i]);
      }

    } else if (job.model.type === 'proxy_xai') {
      document.getElementById('emptyState').style.display = 'none';
      const results = await withRetry(() => callProxyXaiMulti(job.apiKey, job.proxyUrl, job.prompt, job.model, job.refsCopy, job.xaiSnap), job);
      const cards = job.pendingCards || results.map((_, i) => createPlaceholderCard(job, i));
      for (let i = 0; i < results.length; i++) {
        const galId = await saveToGallery(results[i], job.prompt, job.xaiSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
        trackSpend('xai', job.model.id);
        if (i < cards.length) await replacePlaceholder(cards[i], results[i], job.prompt, galId);
        else await renderOutput(results[i], job.prompt, galId);
      }
      for (let i = results.length; i < cards.length; i++) {
        if (cards[i].parentNode) cards[i].parentNode.removeChild(cards[i]);
      }

    } else if (job.model.type === 'proxy_luma') {
      document.getElementById('emptyState').style.display = 'none';
      const cardEl = job.pendingCards?.[0] || createPlaceholderCard(job, 0);
      const result = await withRetry(() => callProxyLuma(job.apiKey, job.proxyUrl, job.prompt, job.model, job.refsCopy, job.lumaSnap), job);
      const galId  = await saveToGallery(result, job.prompt, job.lumaSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
      trackSpend('luma', job.model.id);
      await replacePlaceholder(cardEl, result, job.prompt, galId);

    } else if (job.model.type === 'proxy_mystic') {
      document.getElementById('emptyState').style.display = 'none';
      const count = job.mysticSnap?.count || 1;
      // Run multiple images in parallel
      const tasks = Array.from({ length: count }, (_, i) => ({
        cardEl: job.pendingCards?.[i] || createPlaceholderCard(job, i),
        idx: i,
      }));
      await Promise.allSettled(tasks.map(async ({ cardEl, idx }) => {
        const result = await callProxyMystic(job.freepikKey, job.proxyUrl, job.prompt, job.model, job.refsCopy, job.mysticSnap);
        const galId  = await saveToGallery(result, job.prompt, job.mysticSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
        trackSpend('freepik', '_mystic');
        await replacePlaceholder(cardEl, result, job.prompt, galId);
      }));

    } else if (job.model.type === 'proxy_freepik_edit') {
      document.getElementById('emptyState').style.display = 'none';
      if (!job.refsCopy || job.refsCopy.length === 0)
        throw new Error('Source image required — add it in the Refs panel (ref[0])');
      const cardEl = job.pendingCards?.[0] || createPlaceholderCard(job, 0);

      const srcRef = await getRefDataForApi(job.refsCopy[0], null);
      if (!srcRef) throw new Error('Could not load source image from Refs');
      const srcB64 = srcRef.data;

      let resultData;
      const { tool, relightStr, relightChangeBg, relightStyle, relightInterpolate,
              stylePortrait, styleFixed, skinVariant, skinSharpen, skinGrain } = job.editSnap;

      if (tool === 'relight') {
        let transferRef = null;
        if (job.refsCopy.length > 1) {
          const r1 = await getRefDataForApi(job.refsCopy[1], null);
          if (r1) transferRef = r1.data;
        }
        resultData = await callFreepikRelight(job.freepikKey, job.proxyUrl, srcB64, {
          prompt: job.rawPrompt || '',
          transfer_ref_b64: transferRef,
          light_transfer_strength: relightStr,
          change_background: relightChangeBg,
          style:    relightStyle    || 'smooth',
          interpolate: relightInterpolate || false,
        });
      } else if (tool === 'style_transfer') {
        if (job.refsCopy.length < 2)
          throw new Error('Style Transfer needs 2 refs: ref[0] = source, ref[1] = style reference');
        const r1 = await getRefDataForApi(job.refsCopy[1], null);
        if (!r1) throw new Error('Could not load style reference (ref[1])');
        resultData = await callFreepikStyleTransfer(job.freepikKey, job.proxyUrl, srcB64, r1.data, {
          is_portrait: stylePortrait, fixed: styleFixed,
        });
      } else if (tool === 'skin_enhancer') {
        resultData = await callFreepikSkinEnhancer(job.freepikKey, job.proxyUrl, srcB64, {
          variant: skinVariant, sharpen: skinSharpen, smart_grain: skinGrain,
        });
      } else {
        throw new Error(`Unknown Freepik edit tool: ${tool}`);
      }

      const result = {
        type:     'proxy_mystic',
        images:   [resultData.imageData],
        mimeType: resultData.mimeType || 'image/png',
        model:    job.model.name,
        modelKey: getModelKey(job.model),
        seed:     '—',
        size:     resultData.width ? `${resultData.width}×${resultData.height}` : '—',
        ratio:    '—',
      };
      const galId = await saveToGallery(result, job.prompt, job.editSnap?.targetFolder, job.refsCopy, job.rawPrompt, job);
      trackSpend('freepik', '_magnific');
      await replacePlaceholder(cardEl, result, job.prompt, galId);
    }
    job.status = 'done';
    job.retryAttempt = 0;
    job.elapsed = ((Date.now() - job.startedAt) / 1000).toFixed(1) + 's';
    renderQueue();
  } catch(e) {
    job.status = 'error';
    job.errorMsg = e.message;
    renderQueue();
    // Show static error card for any remaining placeholder cards — no err-box
    (job.pendingCards || []).forEach(card => {
      if (!document.contains(card)) return; // already replaced by a successful result
      showErrorPlaceholder(card, job, e.message);
    });
  }
}

// processQueue odstraněna — nahrazena tryStartJobs() + runJobAndContinue()

function setGenBtnState(busy) {
  const btn = document.getElementById('genBtn');
  btn.classList.toggle('loading', busy);
  // Don't disable — allow adding more to queue while running
}

function renderQueue() {
  const panel = document.getElementById('queuePanel');
  const list = document.getElementById('queueList');

  // Auto-mazat hotové (done + error) pokud nejsou pending ani running
  const hasActive = jobQueue.some(j => j.status === 'pending' || j.status === 'running');
  if (!hasActive) {
    // Všechno hotové — vyčistit po 3s
    if (!window._queueClearTimer) {
      window._queueClearTimer = setTimeout(() => {
        jobQueue = [];
        window._queueClearTimer = null;
        renderQueue();
      }, 3000);
    }
  } else {
    clearTimeout(window._queueClearTimer);
    window._queueClearTimer = null;
  }

  if (!jobQueue.length) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';

  // Počítadlo waitingcích
  const pendingCount = jobQueue.filter(j => j.status === 'pending').length;
  const runningCount = jobQueue.filter(j => j.status === 'running').length;
  const cntEl = document.getElementById('queuePendingCount');
  if (cntEl) {
    const parts = [];
    if (runningCount > 1) parts.push(`${runningCount}× parallel`);
    if (pendingCount > 0) parts.push(`${pendingCount} waiting`);
    cntEl.textContent = parts.length ? '· ' + parts.join(', ') : '';
  }

  list.innerHTML = jobQueue.map(j => {
    const modelName = j.isUpscale
      ? (j.upscaleMode === 'seedvr'          ? `SeedVR2 ${j.upscaleSeedvrRes}`
       : j.upscaleMode === 'clarity'         ? `Clarity ${j.upscaleFactor}×`
       : j.upscaleMode === 'magnific'        ? `Magnific ${j.magFactor}`
       : j.upscaleMode === 'topaz_gigapixel' ? `✦ Gigapixel ${j.tGigaFactor}×`
       : j.upscaleMode === 'topaz_bloom'     ? `✦ Bloom ${j.tBloomFactor}×`
       : 'Recraft Crisp')
      : (j.model?.name || j.modelKey || '?');
    const promptSnippet = j.label || '';
    const statusHtml =
      j.status === 'pending'
        ? `<span>waiting</span><button onclick="cancelJob('${j.id}')" style="background:none;border:none;color:var(--dim);cursor:pointer;font-size:11px;padding:0;line-height:1;" title="Cancel">✕</button>`
        : j.status === 'running' && j.retryAttempt > 0
          ? `<span>retry ${j.retryAttempt}/${RETRY_MAX}…</span>`
          : j.status === 'running'
            ? '<span>⟳ generating…</span>'
            : j.status === 'done'
              ? `<span>✓ ${j.elapsed}</span>`
              : '<span>⚠ error</span>';
    return `
      <div class="q-item ${j.status}">
        <div class="q-dot ${j.status}"></div>
        <div class="q-main">
          <div class="q-model ${j.status}">${modelName}</div>
          <div class="q-prompt">${promptSnippet}</div>
        </div>
        <div class="q-status" style="display:flex;align-items:center;gap:6px;">${statusHtml}</div>
      </div>`;
  }).join('');

  // Sync overlay pokud je otevřený + pulzující dot na toggle tlačítku
  renderQueueOverlay();
  const anyRunning = jobQueue.some(j => j.status === 'running');
  const dot = document.getElementById('queueToggleDot');
  if (dot) dot.style.background = anyRunning ? 'var(--accent)' : 'var(--dim2)';
}

function clearDoneJobs() {
  jobQueue = jobQueue.filter(j => j.status === 'pending' || j.status === 'running');
  renderQueue();
}

function cancelJob(id) {
  jobQueue = jobQueue.filter(j => j.id !== id || j.status !== 'pending');
  renderQueue();
}

function cancelAllPending() {
  jobQueue = jobQueue.filter(j => j.status !== 'pending');
  renderQueue();
}

// ── Imagen 4 ──// ── Imagen 4 ──
async function callImagen(apiKey, prompt, model, snap) {
  const aspectRatio = snap?.aspectRatio || document.getElementById('aspectRatio').value;
  const safeRatio = ['1:1','3:4','4:3','9:16','16:9'].includes(aspectRatio) ? aspectRatio : '16:9';
  // sampleCount: ze snapu nebo z UI, Ultra max 1
  const sampleCount = model.id.includes('ultra') ? 1 : (snap?.sampleCount || 1);

  // REST API: sampleCount funguje (1-4), imageSize ignorováno (SDK-only)
  const params = {
    sampleCount,
    aspectRatio: safeRatio,
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:predict?key=${apiKey}`;
  const body = { instances: [{ prompt }], parameters: params };
  const resp = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`API ${resp.status}: ${data.error?.message || JSON.stringify(data.error)}`);

  const images = (data.predictions || []).map(p => p.bytesBase64Encoded).filter(Boolean);
  if (!images.length) throw new Error('Imagen returned no image.');

  // Vrátit každý obrázek jako samostatný result objekt
  const modelKey = getModelKey(model);
  return images.map((imgData, idx) => ({
    type: 'imagen',
    images: [imgData],
    model: model.name,
    modelKey,
    seed: '—',
    size: '1K',
    ratio: safeRatio,
    variantNum: idx + 1,
    totalVariants: images.length,
  }));
}

