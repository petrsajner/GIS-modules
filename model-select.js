// ═══════════════════════════════════════════════════════
// MODEL SWITCHING — Unified Panel (v200en)
// ═══════════════════════════════════════════════════════
const MODEL_DESCS = {
  nb2:        'Flash · Thinking ✦ · Refs ✦ max 14 · 1K/2K/4K · Grounding ✦',
  nb1:        'Nano Banana gen 1 · stable · Refs ✦ max 14 · 1K max · fallback for NB2',
  nbpro:      'Pro · Refs ✦ max 14 · 1K/2K/4K · Best quality',
  i4:         'Imagen 4 · 1K/2K · seed · 1–4 images',
  i4fast:     'Imagen 4 Fast · 1K · faster · 1–4 images',
  i4ultra:    'Imagen 4 Ultra · 1K · highest quality · max 1 image',
  flux2_pro:  'fal.ai · $0.03/MP · 8 refs · seed · safety',
  flux2_flex: 'fal.ai · $0.06/MP · 10 refs · steps ✦ · guidance ✦ · best for typography',
  flux2_max:  'fal.ai · $0.07/MP · 8 refs · highest quality',
  flux2_dev:       'fal.ai · $0.012/MP · 6 refs · steps · guidance · open-weight',
  seedream45:      'fal.ai · $0.04/img · 10 refs · 2K/4K · flat pricing · ByteDance',
  seedream5lite:   'fal.ai · $0.04/img · 10 refs · 2K/3K · web search · reasoning',
  kling_v3:        'fal.ai · 10 refs · 1K/2K · @Image1 refs · Kuaishou · best consistency',
  kling_o3:        'fal.ai · 10 refs · 1K/2K/4K · @Image1 refs · Kuaishou · latest (Feb 2026)',
  zimage_base:     'fal.ai · $0.005/MP · T2I · steps · CFG · negative prompt · best quality',
  zimage_turbo:    'fal.ai · $0.005/MP · T2I · ultra-fast · 1–16 steps · default 8 · acceleration',
  zimage_turbo_i2i:'fal.ai · $0.005/MP · I2I · ref + strength · 1–16 steps · ref required',
  qwen2_std:       'fal.ai · $0.035/img · T2I · 25 steps · guidance · #1 AI Arena · typografie ✦',
  qwen2_pro:       'fal.ai · $0.075/img · T2I Pro · 35 steps · highest quality · production',
  qwen2_edit:      'fal.ai · $0.035/img · instruction edit · no masks · natural language',
  qwen2_pro_edit:  'fal.ai · $0.075/img · Pro instruction edit · highest faithfulness',
  grok_imagine:    'xAI · $0.02/img · T2I + Edit · up to 5 refs · Aurora engine · 1K/2K · proxy ✦',
  grok_imagine_pro:'xAI · $0.07/img · T2I + Edit · up to 5 refs · higher quality · 1K/2K · proxy ✦',
  photon_flash:    'Luma · $0.002/img · refs ✦ max 14 · style_ref ✦ · character_ref ✦ · cheapest · proxy ✦',
  photon:          'Luma · $0.015/img · refs ✦ max 14 · style_ref ✦ · character_ref ✦ · highest quality · proxy ✦',
  mystic_realism:    'Mystic · Freepik/Magnific · realistic color palette · "less AI look" · 1K/2K/4K · proxy ✦',
  mystic_fluid:      'Mystic · Freepik/Magnific · best prompt adherence · Google Imagen 3 base · 1K/2K/4K · proxy ✦',
  mystic_zen:        'Mystic · Freepik/Magnific · soft/clean · fewer objects · less detail · 1K/2K/4K · proxy ✦',
  mystic_flexible:   'Mystic · Freepik/Magnific · illustrations · fantasy · HDR look · 1K/2K/4K · proxy ✦',
  mystic_super_real: 'Mystic · Freepik/Magnific · max realism · versatile · medium shots · 1K/2K/4K · proxy ✦',
  mystic_editorial:  'Mystic · Freepik/Magnific · editorial portraits · hyperrealistic close-ups · 1K/2K/4K · proxy ✦',
  freepik_relight:   'Magnific Relight · ref[0]=source · ref[1]=light ref (opt) · prompt=lighting desc · proxy ✦',
  freepik_style:     'Magnific Style Transfer · ref[0]=source (req) · ref[1]=style source (req) · proxy ✦',
  freepik_skin:      'Magnific Skin Enhancer · ref[0]=source portrait (req) · 3 modes · no plastic skin · proxy ✦',
  wan27_std:   'T2I · seed · Alibaba',
  wan27_pro:   'T2I · 4K · thinking ✦ · seed · highest quality · Alibaba',
  wan27_edit:  'instruction edit · up to 9 refs · seed · Alibaba',
  wan27_pro_edit: 'instruction edit · 4K · up to 9 refs · seed · highest quality · Alibaba',
};

function selectModel(key) {
  const prevType = MODELS[currentModel]?.type;
  currentModel = key;
  document.getElementById('modelSelect').value = key;
  document.getElementById('modelDesc').textContent = MODEL_DESCS[key] || '';
  const m = MODELS[key];
  const unified = isUnifiedModel(m);
  const isEdit = !!(m.editModel);
  const isI2I = !!(m.i2iModel || m.editModel);

  // ── Show/hide panel groups ──
  document.getElementById('upParams').style.display            = unified ? '' : 'none';
  document.getElementById('lumaParams').style.display          = m.type === 'proxy_luma'  ? '' : 'none';
  document.getElementById('mysticParams').style.display        = m.type === 'proxy_mystic' ? '' : 'none';
  document.getElementById('freepikEditParams').style.display   = m.type === 'proxy_freepik_edit' ? '' : 'none';

  // Freepik edit: show/hide tool-specific sub-panels
  if (m.type === 'proxy_freepik_edit') {
    const tool = m.freepikTool;
    document.getElementById('fepRelightPanel').style.display      = tool === 'relight'       ? '' : 'none';
    document.getElementById('fepStylePanel').style.display        = tool === 'style_transfer' ? '' : 'none';
    document.getElementById('fepSkinPanel').style.display         = tool === 'skin_enhancer'  ? '' : 'none';
  }

  // ── Negative prompt ──
  const negRow = document.getElementById('upNegRow');
  if (negRow) {
    negRow.style.display = (unified && m.negPrompt) ? '' : 'none';
    if (m.negPrompt) {
      const negEl = document.getElementById('upNeg');
      if (negEl) negEl.value = _DEFAULT_NEG_PROMPT;
    }
  }

  // ── Aspect ratio ──
  const aspectCtrl = document.getElementById('aspectRatioCtrl');
  if (aspectCtrl) {
    aspectCtrl.style.display = (m.type === 'wan27r' && isEdit) ? 'none' : '';
  }
  // Reset all aspect options, then apply model-specific filter
  _resetAspectFilter();
  if (m.aspectFilter === 'wan27') _wan27FilterAspects(true);
  else if (m.aspectFilter === 'grok') _grokFilterAspects(true);

  // ── Unified panel controls ──
  if (unified) {
    // Resolution toggle
    _buildResToggle(m);

    // Steps
    const stepsRow = document.getElementById('upStepsRow');
    stepsRow.style.display = m.steps ? '' : 'none';
    if (m.steps) _setStepsDefaults(m);

    // Guidance
    const guidRow = document.getElementById('upGuidanceRow');
    guidRow.style.display = m.guidance ? '' : 'none';
    if (m.guidance) _setGuidanceDefaults(m);

    // Seed
    document.getElementById('upSeedRow').style.display = m.seed ? '' : 'none';

    // Thinking radio (NB2: Min/High)
    document.getElementById('upThinkRadioRow').style.display = m.thinking ? '' : 'none';

    // Thinking checkbox (WAN 2.7 T2I)
    document.getElementById('upThinkChkRow').style.display = m.thinkingCheckbox ? '' : 'none';

    // Image count
    const mc = m.maxCount || 0;
    document.getElementById('upCount4Row').style.display  = (mc > 1 && mc <= 4) ? '' : 'none';
    document.getElementById('upCount10Row').style.display = (mc > 4) ? '' : 'none';
    // Reset count to 1
    const c4_1 = document.getElementById('upc4_1');
    if (c4_1) { c4_1.checked = true; document.getElementById('upCount4Val').textContent = '1'; }
    const c10_1 = document.getElementById('upc10_1');
    if (c10_1) { c10_1.checked = true; document.getElementById('upCount10Val').textContent = '1'; }

    // Acceleration
    document.getElementById('upAccelRow').style.display = m.acceleration ? '' : 'none';
    if (m.acceleration) { const ar = document.getElementById('upa_reg'); if (ar) ar.checked = true; }

    // Safety tolerance slider (FLUX)
    document.getElementById('upSafetySliderRow').style.display = m.safetyTolerance ? '' : 'none';

    // Safety checker checkbox (SeeDream, Z-Image, Qwen2)
    document.getElementById('upSafetyChkRow').style.display = m.safetyChecker ? '' : 'none';

    // Strength slider (dedicated I2I/edit models with strength flag)
    document.getElementById('upStrengthRow').style.display = m.strength ? '' : 'none';

    // Grounding (Google)
    document.getElementById('upGroundingRow').style.display = m.grounding ? '' : 'none';

    // Persistent retry (Google)
    document.getElementById('upRetryRow').style.display = m.persistRetry ? '' : 'none';

    // GPT quality tier (low / medium / high) — GPT Image 1.5 & 2
    const qRow = document.getElementById('upQualityRow');
    if (qRow) {
      qRow.style.display = m.quality ? '' : 'none';
      if (m.quality) {
        const qMed = document.getElementById('upQ-med');
        if (qMed) qMed.checked = true; // reset to medium on model switch
      }
    }
  }

  // ── Reference section ──
  document.getElementById('refSection').style.display = m.refs ? '' : 'none';
  const refLabel = document.getElementById('refSectionLabel');
  const refI2INote = document.getElementById('refI2INote');
  const refResRow = document.getElementById('refResRow');
  if (refLabel) refLabel.textContent = isEdit
    ? (m.type === 'proxy_freepik_edit'
        ? (m.freepikTool === 'style_transfer'
            ? 'Refs: [0] Source · [1] Style (both required)'
            : m.freepikTool === 'relight'
            ? 'Refs: [0] Source · [1] Lighting ref (opt)'
            : 'Input image (required)')
        : m.type === 'qwen2' ? 'Input images (edit · compositing)'
        : 'Input image (edit)')
    : isI2I ? (m.type === 'proxy_xai' ? 'Input images (edit · up to ' + (m.maxRefs || 5) + ')' : 'Input image (I2I)')
    : m.type === 'proxy_mystic' ? 'Refs: [0] Structure · [1] Style'
    : 'Reference images';
  if (refI2INote) {
    if (isEdit) {
      if (m.type === 'gpt') {
        // GPT modely nemají velikostní omezení referenci (žádný auto-resize)
        refI2INote.style.display = 'none';
      } else {
        const info = m.type === 'qwen2'  ? 'Max 4 MP · Auto-resized · up to ' + (m.maxRefs||3) + ' images · Instructions in prompt'
                   : m.type === 'wan27r' ? 'Max 4096px · Larger images auto-resized · Instructions in prompt'
                   :                       'Max 2048px · Larger images auto-resized · Instructions in prompt';
        refI2INote.textContent = info;
        refI2INote.style.display = '';
      }
    } else if (isI2I) {
      const info = m.type === 'proxy_xai'
        ? 'Add ref images for editing (up to ' + (m.maxRefs||5) + ').\nSingle ref = aspect from input · Multi-ref = aspect from setting · auto ratio lets model decide.'
        : 'Max 2048px · Larger images auto-resized · Input image required';
      refI2INote.textContent = info;
      refI2INote.style.display = '';
    } else {
      refI2INote.style.display = 'none';
    }
  }
  if (refResRow) refResRow.style.display = isI2I ? 'none' : '';

  // Update ref count display
  if (m.refs) {
    const max = m.maxRefs ?? 14;
    const refCountEl = document.getElementById('refCount');
    const refMaxEl = document.getElementById('refMax');
    if (refCountEl) refCountEl.textContent = refs.length;
    if (refMaxEl) refMaxEl.textContent = max;
    renderRefThumbs();
  }

  // fal.ai API key field visibility
  const falTypes = new Set(['flux','seedream','kling','zimage','qwen2']);
  const fluxKeyField = document.getElementById('fluxKeyField');
  if (fluxKeyField) fluxKeyField.style.display = falTypes.has(m.type) ? '' : 'none';

  // Live-rewrite @mentions in prompt textarea
  if (typeof rewritePromptForModel === 'function') {
    rewritePromptForModel(prevType, MODELS[key]?.type);
  }
}

// ── Resolution toggle builder ──
function _buildResToggle(m) {
  const res = m.resolutions || ['1K'];
  const defaultRes = m.defaultRes || res[0];
  for (let i = 0; i < 3; i++) {
    const radio = document.getElementById('upRes' + (i + 1));
    const label = document.getElementById('upRes' + (i + 1) + 'L');
    if (!radio || !label) continue;
    if (i < res.length) {
      radio.value = res[i];
      radio.disabled = false;
      label.textContent = res[i];
      label.style.opacity = '';
      label.style.pointerEvents = '';
      radio.checked = (res[i] === defaultRes);
    } else {
      radio.value = '';
      radio.disabled = true;
      label.textContent = '';
      label.style.opacity = '0.25';
      label.style.pointerEvents = 'none';
      radio.checked = false;
    }
  }
  // Attach change listeners for res info + count val updates
  document.querySelectorAll('input[name="upRes"]').forEach(r => {
    r.onchange = () => updateUnifiedResInfo();
  });
  document.querySelectorAll('input[name="upCount4"]').forEach(r => {
    r.onchange = () => { document.getElementById('upCount4Val').textContent = r.value; };
  });
  document.querySelectorAll('input[name="upCount10"]').forEach(r => {
    r.onchange = () => { document.getElementById('upCount10Val').textContent = r.value; };
  });
  updateUnifiedResInfo();
}

// ── Steps defaults per model ──
function _setStepsDefaults(m) {
  const el = document.getElementById('upSteps');
  const val = document.getElementById('upStepsVal');
  if (!el) return;
  if (m.type === 'zimage') {
    const isTurbo = m.id.includes('turbo');
    el.max = isTurbo ? '16' : '50';
    el.value = isTurbo ? '8' : '28';
  } else if (m.type === 'qwen2') {
    el.max = '50';
    el.value = m.id.includes('pro') ? '35' : '25';
  } else if (m.type === 'flux') {
    el.max = '50';
    el.value = '28';
  } else {
    el.max = '50';
    el.value = '28';
  }
  if (val) val.textContent = el.value;
}

// ── Guidance defaults per model ──
function _setGuidanceDefaults(m) {
  const el = document.getElementById('upGuidance');
  const val = document.getElementById('upGuidanceVal');
  if (!el) return;
  if (m.type === 'qwen2') {
    const isPro = m.id.includes('pro');
    const isEdit = !!m.editModel;
    const gDef = isPro && isEdit ? 5 : isEdit ? 4.5 : isPro ? 7 : 5;
    el.value = gDef;
  } else if (m.type === 'zimage') {
    el.value = 7.5;
  } else if (m.type === 'flux') {
    el.value = 3.5;
  } else {
    el.value = 3.5;
  }
  if (val) val.textContent = parseFloat(el.value).toFixed(1);
}

// ── Aspect ratio filtering ──
function _resetAspectFilter() {
  const sel = document.getElementById('aspectRatio');
  if (!sel) return;
  for (const opt of sel.options) opt.style.display = '';
}

function _wan27FilterAspects(restrict) {
  const sel = document.getElementById('aspectRatio');
  if (!sel) return;
  for (const opt of sel.options) {
    if (restrict) opt.style.display = _WAN27_PIXELS[opt.value] ? '' : 'none';
  }
  if (restrict && !_WAN27_PIXELS[sel.value]) sel.value = '16:9';
}

function _grokFilterAspects(restrict) {
  if (!restrict) return;
  const sel = document.getElementById('aspectRatio');
  if (!sel) return;
  for (const opt of sel.options) {
    opt.style.display = _GROK_ASPECTS.has(opt.value) ? '' : 'none';
  }
  if (!_GROK_ASPECTS.has(sel.value)) sel.value = '16:9';
}

// Listen for aspect ratio changes → update resolution pixel info
document.getElementById('aspectRatio')?.addEventListener('change', () => {
  if (isUnifiedModel(MODELS[currentModel])) updateUnifiedResInfo();
});

// ═══════════════════════════════════════════════════════
// VIEW SWITCHING
// ═══════════════════════════════════════════════════════
function switchView(v) {
  const tabs = document.querySelectorAll('.nav-tab');
  const viewMap = { gen: 0, gallery: 1, video: 2, assets: 3, paint: 4, setup: 6 };
  tabs.forEach((t, i) => t.classList.toggle('active', i === viewMap[v]));
  document.getElementById('genView').classList.toggle('hide', v !== 'gen');
  document.getElementById('galleryView').classList.toggle('show', v === 'gallery');
  document.getElementById('assetsView').classList.toggle('show', v === 'assets');
  document.getElementById('paintView').classList.toggle('show', v === 'paint');
  document.getElementById('setupView').style.display = v === 'setup' ? 'flex' : 'none';
  if (v === 'setup') initSpendingUI();
  const videoView = document.getElementById('videoView');
  if (videoView) videoView.classList.toggle('show', v === 'video');
  if (v === 'gallery') {
    Promise.all([dbGetAll('folders'), dbGetAllMeta()]).then(([folders, items]) => {
      renderFoldersSync(folders, items);
      renderGalleryWithItems(items);
    });
    setTimeout(initRubberBand, 100);
  }
  if (v === 'assets') { renderAssets(); renderAssetFolders(); setTimeout(initAssetRubberBand, 100); }
  if (v === 'video') { refreshVideoGalleryUI(); }
}

// ── WAN 2.7 helpers (for generate.js API calls) ──
function _wan27GetTier() {
  return document.querySelector('input[name="upRes"]:checked')?.value || '2K';
}

function _wan27GetSize() {
  const tier = _wan27GetTier();
  const aspect = document.getElementById('aspectRatio')?.value || '16:9';
  const px = _WAN27_PIXELS[aspect]?.[tier];
  return px || tier;
}
