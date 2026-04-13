// ═══════════════════════════════════════════════════════
// MODEL SWITCHING
// ═══════════════════════════════════════════════════════
const MODEL_DESCS = {
  nb2:        'Flash · Thinking ✦ · Refs ✦ max 14 · 512/1K/2K/4K · Grounding ✦',
  nb1:        'Nano Banana gen 1 · stable · Refs ✦ max 14 · 1K max · fallback for NB2',
  nbpro:      'Pro · Refs ✦ max 14 · 1K/2K/4K · Best quality',
  i4:         'Imagen 4 · 1K · 1–4 images',
  i4fast:     'Imagen 4 Fast · 1K · faster · 1–4 images',
  i4ultra:    'Imagen 4 Ultra · 1K · highest quality · max 1 image',
  flux2_pro:  'fal.ai · $0.03/MP · 8 refs · seed · safety',
  flux2_flex: 'fal.ai · $0.06/MP · 10 refs · steps ✦ · guidance ✦ · best for typography',
  flux2_max:  'fal.ai · $0.07/MP · 8 refs · highest quality',
  flux2_dev:       'fal.ai · $0.012/MP · 6 refs · steps · guidance · open-weight',
  seedream45:      'fal.ai · $0.04/img · 10 refs · 2K/4K · flat pricing · ByteDance',
  seedream5lite:   'fal.ai · $0.04/img · 10 refs · 2K/4K · web search · reasoning',
  kling_v3:        'fal.ai · 10 refs · 1K/2K · @Image1 refs · Kuaishou · best consistency',
  kling_o3:        'fal.ai · 10 refs · 1K/2K/4K · @Image1 refs · Kuaishou · latest (Feb 2026)',
  zimage_base:     'fal.ai · $0.005/MP · T2I · 28 steps · CFG · negative prompt · best quality',
  zimage_turbo:    'fal.ai · $0.005/MP · T2I + I2I · 1–16 steps · default 8 · input img → I2I',
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
};

function selectModel(key) {
  const prevType = MODELS[currentModel]?.type;  // save before switching
  currentModel = key;
  document.getElementById('modelSelect').value = key;
  document.getElementById('modelDesc').textContent = MODEL_DESCS[key] || '';
  const m = MODELS[key];

  // Zobrazit správnou params sekci
  document.getElementById('nbParams').style.display       = m.type === 'gemini'   ? '' : 'none';
  document.getElementById('imagenParams').style.display   = m.type === 'imagen'   ? '' : 'none';
  document.getElementById('fluxParams').style.display     = m.type === 'flux'     ? '' : 'none';
  document.getElementById('seedreamParams').style.display = m.type === 'seedream' ? '' : 'none';
  document.getElementById('klingParams').style.display    = m.type === 'kling'    ? '' : 'none';
  document.getElementById('zimageParams').style.display   = m.type === 'zimage'   ? '' : 'none';
  document.getElementById('grokParams').style.display     = m.type === 'proxy_xai'   ? '' : 'none';
  // Grok: default 2K for Pro
  if (m.type === 'proxy_xai') {
    const isPro = key === 'grok_imagine_pro';
    document.getElementById(isPro ? 'gkr2k' : 'gkr1k').checked = true;
  }
  document.getElementById('lumaParams').style.display     = m.type === 'proxy_luma'  ? '' : 'none';
  document.getElementById('qwen2Params').style.display    = m.type === 'qwen2'       ? '' : 'none';
  document.getElementById('wan27Params').style.display    = m.type === 'wan27r'      ? '' : 'none';
  // WAN 2.7: hide T2I-only rows in Edit mode, show Pro-only options
  if (m.type === 'wan27r') {
    const isEdit = !!m.editModel;
    const isPro  = m.id?.includes('-pro');
    document.getElementById('wan27ThinkingRow').style.display = isEdit ? 'none' : '';
    document.getElementById('wan27CountRow').style.display    = isEdit ? 'none' : '';
    document.getElementById('wan27NegRow').style.display      = (!isEdit && m.negPrompt) ? '' : 'none';
    // Pre-fill negative prompt (research-backed defaults)
    const negEl = document.getElementById('wan27Neg');
    if (negEl && m.negPrompt && !isEdit) negEl.value = 'low quality, blurry, distorted, deformed, ugly, watermark, text, logo, bad anatomy, extra fingers, extra limbs, disfigured, poorly drawn, mutation, duplicate, out of frame, worst quality, jpeg artifacts';
    document.getElementById('wan27SizeRow').style.display     = '';
    // Hide aspect ratio for edit (model takes aspect from input image)
    document.getElementById('aspectRatioCtrl').style.display  = isEdit ? 'none' : '';
    // Pro: show 4K only for T2I
    const t4k = document.getElementById('w27t4k');
    const t4kL = document.getElementById('w27t4kLabel');
    const show4K = isPro && !isEdit;
    if (t4k) { t4k.style.display = show4K ? '' : 'none'; if (t4kL) t4kL.style.display = show4K ? '' : 'none'; }
    if (!show4K && t4k?.checked) { document.getElementById('w27t2k').checked = true; }
    // Filter aspect options to only show supported ratios
    if (!isEdit) _wan27FilterAspects(true);
    _wan27UpdateRes();
  } else {
    // Restore all aspects + show aspect ctrl for other models
    _wan27FilterAspects(false);
    document.getElementById('aspectRatioCtrl').style.display = '';
    const negRow = document.getElementById('wan27NegRow');
    if (negRow) negRow.style.display = 'none';
    const cntRow = document.getElementById('wan27CountRow');
    if (cntRow) cntRow.style.display = 'none';
  }
  // Grok: filter aspect ratios to only xAI-supported values
  _grokFilterAspects(m.type === 'proxy_xai');
  document.getElementById('mysticParams').style.display      = m.type === 'proxy_mystic'      ? '' : 'none';
  document.getElementById('freepikEditParams').style.display = m.type === 'proxy_freepik_edit' ? '' : 'none';

  // Freepik edit: show/hide tool-specific sub-panels
  if (m.type === 'proxy_freepik_edit') {
    const tool = m.freepikTool;
    document.getElementById('fepRelightPanel').style.display      = tool === 'relight'       ? '' : 'none';
    document.getElementById('fepStylePanel').style.display        = tool === 'style_transfer' ? '' : 'none';
    document.getElementById('fepSkinPanel').style.display         = tool === 'skin_enhancer'  ? '' : 'none';
  }

  // Ref sekce — zobrazit pokud model podporuje refs
  document.getElementById('refSection').style.display = m.refs ? '' : 'none';
  // Nadpis ref sekce + I2I note + res toggle
  const refLabel = document.getElementById('refSectionLabel');
  const refI2INote = document.getElementById('refI2INote');
  const refResRow = document.getElementById('refResRow');
  const isI2IModel = !!(m.i2iModel || m.editModel);
  if (refLabel) refLabel.textContent = m.editModel
    ? (m.type === 'proxy_freepik_edit'
        ? (m.freepikTool === 'style_transfer'
            ? 'Refs: [0] Source · [1] Style (both required)'
            : m.freepikTool === 'relight'
            ? 'Refs: [0] Source · [1] Lighting ref (opt)'
            : 'Input image (required)')
        : m.type === 'qwen2' ? 'Input images (edit · compositing)'
        : 'Input image (edit)')
    : isI2IModel ? (m.type === 'proxy_xai' ? 'Input images (edit · up to 5)' : 'Input image (I2I)')
    : m.type === 'proxy_mystic' ? 'Refs: [0] Structure · [1] Style'
    : 'Reference images';
  if (refI2INote) {
    if (m.editModel) {
      const info = m.type === 'qwen2'  ? 'Max 4 MP · Auto-resized · up to 3 images · Instructions in prompt'
                 : m.type === 'wan27r' ? 'Max 4096px · Larger images auto-resized · Instructions in prompt'
                 :                       'Max 2048px · Larger images auto-resized · Instructions in prompt';
      refI2INote.textContent = info;
      refI2INote.style.display = '';
    } else if (m.i2iModel) {
      const info = m.type === 'proxy_xai'
        ? 'Up to 5 images · Single ref = output matches input aspect · Multi-ref = aspect from setting'
        : 'Max 2048px · Larger images auto-resized · No image = T2I';
      refI2INote.textContent = info;
      refI2INote.style.display = '';
    } else {
      refI2INote.style.display = 'none';
    }
  }
  if (refResRow) refResRow.style.display = isI2IModel ? 'none' : '';

  // Aktualizovat limit referencí v UI
  if (m.refs) {
    const max = m.maxRefs ?? 14;
    const refCountEl = document.getElementById('refCount');
    const refMaxEl = document.getElementById('refMax');
    if (refCountEl) refCountEl.textContent = refs.length;
    if (refMaxEl) refMaxEl.textContent = max;
    renderRefThumbs();
  }

  // fal.ai API key v headeru — zobrazit pro FLUX, SeeDream, Kling, Z-Image
  const fluxKeyField = document.getElementById('fluxKeyField');
  if (fluxKeyField) fluxKeyField.style.display =
    (m.type === 'flux' || m.type === 'seedream' || m.type === 'kling' || m.type === 'zimage' || m.type === 'qwen2') ? '' : 'none';

  // Proxy models — keys managed via Setup tab

  // Thinking: NB2 only
  const thinkSec = document.getElementById('thinkingSection');
  if (thinkSec) thinkSec.style.display = m.thinking ? '' : 'none';

  // ── FLUX: enable/disable controls podle capability flags ──
  if (m.type === 'flux') {
    const guidanceRow = document.getElementById('fluxGuidanceRow');
    const guidanceInput = document.getElementById('fluxGuidance');
    if (guidanceRow) guidanceRow.style.opacity = m.guidance ? '1' : '0.35';
    if (guidanceInput) guidanceInput.disabled = !m.guidance;
    const safetyRow = document.getElementById('fluxSafetyRow');
    const safetyInput = document.getElementById('fluxSafety');
    if (safetyRow) safetyRow.style.opacity = m.safetyTolerance ? '1' : '0.35';
    if (safetyInput) safetyInput.disabled = !m.safetyTolerance;
    const groundingRow = document.getElementById('fluxGroundingRow');
    if (groundingRow) groundingRow.style.display = m.groundingSearch ? '' : 'none';
    const refMaxInfo = document.getElementById('fluxRefMaxInfo');
    if (refMaxInfo) refMaxInfo.textContent = `max ${m.maxRefs} ref. images`;
    updateFluxQualityInfo();
  }

  if (m.type === 'seedream') {
    const refMaxInfo = document.getElementById('sdRefMaxInfo');
    if (refMaxInfo) refMaxInfo.textContent = `max ${m.maxRefs} ref. images`;
    // v5/lite: max 3K; v4.5: max 4K — aktualizuj label a value
    const is5 = m.id.includes('/v5/');
    const hiresLbl = document.getElementById('sdq_hires_lbl');
    const hiresInp = document.getElementById('sdq_hires');
    if (hiresLbl) hiresLbl.textContent = is5 ? '3K' : '4K';
    if (hiresInp) hiresInp.value = is5 ? '3K' : '4K';
  }

  // ── Kling: skrýt 4K radio pokud model nepodporuje ──
  if (m.type === 'kling') {
    const sup4K = m.resolutions?.includes('4K');
    const kr4k  = document.getElementById('kr_4k');
    const kr4kL = document.querySelector('label[for="kr_4k"]');
    if (kr4k)  { kr4k.style.display  = sup4K ? '' : 'none'; if (!sup4K && kr4k.checked) document.getElementById('kr_2k').checked = true; }
    if (kr4kL) kr4kL.style.display = sup4K ? '' : 'none';
  }

  // ── Z-Image: nastavit doporučené defaults + enable/disable controls ──
  if (m.type === 'zimage') {
    const isTurbo = m.id.includes('turbo');
    const guidRow = document.getElementById('zimageGuidanceRow');
    const negRow  = document.getElementById('zimageNegRow');
    const stepsEl = document.getElementById('zimageSteps');
    const guidEl  = document.getElementById('zimageGuidance');

    if (guidRow) guidRow.style.display = m.guidance  ? '' : 'none';
    if (negRow)  negRow.style.display  = m.negPrompt ? '' : 'none';
    // Pre-fill negative prompt for Base (research-backed defaults)
    const negEl = document.getElementById('zimageNeg');
    if (negEl && m.negPrompt) negEl.value = 'blurry, low quality, distorted, deformed, ugly, watermark, text, signature, logo, extra fingers, extra limbs, fused fingers, missing fingers, deformed hands, bad anatomy, disfigured, poorly drawn face, mutation, extra head, duplicate, out of frame, worst quality, jpeg artifacts, grainy';

    // Vždy resetovat na doporučené defaulty při přepnutí modelu
    if (stepsEl) {
      stepsEl.max   = isTurbo ? '16' : '50';
      stepsEl.value = isTurbo ? '8'  : '28';
      document.getElementById('zimageStepsVal').textContent = stepsEl.value;
    }
    if (guidEl && m.guidance) {
      guidEl.value = '7.5';  // doporučeno: 7–7.5 pro Base bez reference
      document.getElementById('zimageGuidanceVal').textContent = '7.5';
    }
    // Reset acceleration na regular
    const accelReg = document.getElementById('za_reg');
    if (accelReg) accelReg.checked = true;
    // Reset strength slider
    const strengthEl = document.getElementById('zimageStrength');
    const strengthRow = document.getElementById('zimageStrengthRow');
    if (strengthEl) strengthEl.value = '0.85';
    const strengthValEl = document.getElementById('zimageStrengthVal');
    if (strengthValEl) strengthValEl.textContent = '0.85';
    if (strengthRow) strengthRow.style.display = 'none'; // zobrazí se až při nahráni ref
    updateZImageQualityInfo();
  }

  // ── Qwen Image 2: doporučené defaults při přepnutí modelu ──
  if (m.type === 'qwen2') {
    const isPro  = key.includes('pro');
    const isEdit = !!m.editModel;
    const stepsEl = document.getElementById('qwen2Steps');
    const guidEl  = document.getElementById('qwen2Guidance');
    // Steps: Std=25, Pro=35
    if (stepsEl) {
      stepsEl.value = isPro ? '35' : '25';
      document.getElementById('qwen2StepsVal').textContent = stepsEl.value;
    }
    // Guidance: Edit=4.5, Pro edit=5.0, Std=5.0, Pro=7.0
    if (guidEl) {
      const gDef = isPro && isEdit ? '5' : isEdit ? '4.5' : isPro ? '7' : '5';
      guidEl.value = gDef;
      document.getElementById('qwen2GuidanceVal').textContent = parseFloat(gDef).toFixed(1);
    }
    // Acceleration + Expand: jen pro T2I, schovat pro Edit
    const accelRow  = document.getElementById('qwen2AccelRow');
    const expandRow = document.getElementById('qwen2ExpandRow');
    const countRow  = document.getElementById('qwen2CountRow');
    if (accelRow)  accelRow.style.display  = isEdit ? 'none' : '';
    if (expandRow) expandRow.style.display = isEdit ? 'none' : '';
    if (countRow)  countRow.style.display  = isEdit ? 'none' : '';
    // Reset acceleration na regular
    const accelReg = document.getElementById('qwa_reg');
    if (accelReg) accelReg.checked = true;
    // Reset expand
    const expandEl = document.getElementById('qwen2Expand');
    if (expandEl) expandEl.checked = false;
    // Reset seed
    const seedEl = document.getElementById('qwen2Seed');
    if (seedEl) seedEl.value = '';
    // Negative prompt: show + set default
    const negRow = document.getElementById('qwen2NegRow');
    const negEl  = document.getElementById('qwen2Neg');
    if (negRow) negRow.style.display = m.negPrompt ? '' : 'none';
    if (negEl && m.negPrompt) negEl.value = 'blurry, low quality, distorted, deformed, oversaturated, watermark, ugly, bad anatomy, extra fingers, extra limbs, disfigured, poorly drawn face, duplicate, out of frame, worst quality, jpeg artifacts';
  }

  // ── Kling: počítadlo listeners ──
  if (m.type === 'kling') {
    document.querySelectorAll('input[name="klingCount"]').forEach(r => r.addEventListener('change', () => {
      document.getElementById('klingCountVal').textContent = r.value;
    }));
  }

  // Rebuild resolution toggle pro Gemini modely
  if (m.type === 'gemini') {
    const resWrap = document.getElementById('nbResWrap');
    if (resWrap) {
      const toggleEl = resWrap.querySelector('.toggle-row');
      if (toggleEl) {
        toggleEl.innerHTML = m.resolutions.map((r, i) =>
          `<input type="radio" name="nbRes" id="nbr_${r}" value="${r}" ${i === 0 ? 'checked' : ''}>
           <label for="nbr_${r}">${r}</label>`
        ).join('');
        const valEl = document.getElementById('nbrVal');
        if (valEl) valEl.textContent = m.resolutions[0];
        toggleEl.querySelectorAll('input').forEach(inp =>
          inp.addEventListener('change', () => { if (valEl) valEl.textContent = inp.value; })
        );
      }
    }
  }

  // Imagen Ultra: force 1 image
  // Ultra: max 1 obrázek (nejdražší model, sampleCount > 1 nedoporučeno)
  const imagenCountRow = document.getElementById('imagenCountRow');
  if (key === 'i4ultra') {
    document.querySelectorAll('input[name="nImg"]').forEach(r => r.disabled = true);
    document.querySelectorAll('input[name="imagenCount"]').forEach(r => { r.disabled = true; });
    const ic1 = document.getElementById('ic1');
    if (ic1) { ic1.checked = true; ic1.disabled = false; }
    const imagenCountVal = document.getElementById('imagenCountVal');
    if (imagenCountVal) imagenCountVal.textContent = '1';
  } else {
    document.querySelectorAll('input[name="nImg"]').forEach(r => r.disabled = false);
    document.querySelectorAll('input[name="imagenCount"]').forEach(r => { r.disabled = false; });
  }
  // Imagen Fast: 1K only
  const sz2k = document.getElementById('sz2k');
  if (sz2k) sz2k.disabled = (key === 'i4fast');

  // Live-rewrite @mentions in prompt textarea for new model
  if (typeof rewritePromptForModel === 'function') {
    rewritePromptForModel(prevType, MODELS[key]?.type);
  }
}

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
    // Jeden dbGetAllMeta call — sdílíme pro folders i gallery render
    Promise.all([dbGetAll('folders'), dbGetAllMeta()]).then(([folders, items]) => {
      renderFoldersSync(folders, items);
      renderGalleryWithItems(items);
    });
    setTimeout(initRubberBand, 100);
  }
  if (v === 'assets') { renderAssets(); renderAssetFolders(); setTimeout(initAssetRubberBand, 100); }
  if (v === 'video') { refreshVideoGalleryUI(); }
}


// ── WAN 2.7 Resolution — tier + main aspect → pixel info ──

// Replicate WAN 2.7 whitelist — only these pixel strings are accepted
const _WAN27_PIXELS = {
  '16:9': { '1K': '1280*720',  '2K': '2048*1152', '4K': '4096*2304' },
  '9:16': { '1K': '720*1280',  '2K': '1152*2048', '4K': '2304*4096' },
  '1:1':  { '1K': '1024*1024', '2K': '2048*2048', '4K': '4096*4096' },
  '4:3':  { '1K': '1024*768',  '2K': '2048*1536', '4K': '4096*3072' },
  '3:4':  { '1K': '768*1024',  '2K': '1536*2048', '4K': '3072*4096' },
};

function _wan27GetTier() {
  return document.querySelector('input[name="wan27Tier"]:checked')?.value || '2K';
}

// Get size string for Replicate API — pixel string or tier preset fallback
function _wan27GetSize() {
  const tier = _wan27GetTier();
  const aspect = document.getElementById('aspectRatio')?.value || '16:9';
  const px = _WAN27_PIXELS[aspect]?.[tier];
  return px || tier; // unsupported aspect → send preset (square)
}

// Update the pixel info label next to Resolution heading
function _wan27UpdateRes() {
  const tier = _wan27GetTier();
  const aspect = document.getElementById('aspectRatio')?.value || '16:9';
  const m = typeof currentModel !== 'undefined' ? MODELS[currentModel] : null;
  const isEdit = m?.editModel;
  const px = _WAN27_PIXELS[aspect]?.[tier];
  const info = document.getElementById('wan27ResInfo');
  if (!info) return;
  if (isEdit) {
    info.textContent = tier + ' (aspect from input image)';
  } else if (px) {
    info.textContent = tier + '  ' + px.replace('*', '×');
  } else {
    info.textContent = tier + ' (square — ' + aspect + ' not supported)';
  }
}

// Listen for main aspect ratio changes → update pixel info
document.getElementById('aspectRatio')?.addEventListener('change', () => {
  if (document.getElementById('wan27Params')?.style.display !== 'none') _wan27UpdateRes();
});

// Show/hide aspect ratio options based on WAN 2.7 whitelist
function _wan27FilterAspects(restrict) {
  const sel = document.getElementById('aspectRatio');
  if (!sel) return;
  for (const opt of sel.options) {
    if (restrict) {
      opt.style.display = _WAN27_PIXELS[opt.value] ? '' : 'none';
    } else {
      opt.style.display = '';
    }
  }
  // If current selection is hidden, switch to 16:9
  if (restrict && !_WAN27_PIXELS[sel.value]) {
    sel.value = '16:9';
  }
}

const _GROK_ASPECTS = new Set(['1:1','3:4','4:3','9:16','16:9','2:3','3:2','9:19.5','19.5:9','9:20','20:9','1:2','2:1','auto']);
function _grokFilterAspects(restrict) {
  if (!restrict) return;  // other filters handle restore
  const sel = document.getElementById('aspectRatio');
  if (!sel) return;
  for (const opt of sel.options) {
    opt.style.display = _GROK_ASPECTS.has(opt.value) ? '' : 'none';
  }
  if (!_GROK_ASPECTS.has(sel.value)) sel.value = '16:9';
}
