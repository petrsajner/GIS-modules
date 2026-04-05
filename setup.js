// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
window.onload = () => {
  const saved = localStorage.getItem('gis_apikey');
  if (saved) { document.getElementById('apiKey').value = saved; updateApiDot(saved.length > 10); }
  document.getElementById('apiKey').addEventListener('input', e => {
    localStorage.setItem('gis_apikey', e.target.value);
    updateApiDot(e.target.value.length > 10);
  });

  // FLUX API klíč (Together AI)
  const savedFlux = localStorage.getItem('gis_flux_apikey');
  if (savedFlux) { document.getElementById('fluxApiKey').value = savedFlux; updateFluxApiDot(savedFlux.length > 10); }
  document.getElementById('fluxApiKey').addEventListener('input', e => {
    localStorage.setItem('gis_flux_apikey', e.target.value);
    updateFluxApiDot(e.target.value.length > 10);
  });
  // Load keys into Setup view
  const savedGoogle = localStorage.getItem('gis_apikey');
  if (savedGoogle) { document.getElementById('setupGoogleKey').value = savedGoogle; document.getElementById('apiKey').value = savedGoogle; updateSetupDot('setupGoogleDot', savedGoogle.length > 10); }
  const savedFluxS = localStorage.getItem('gis_flux_apikey');
  if (savedFluxS) { document.getElementById('setupFalKey').value = savedFluxS; updateSetupDot('setupFalDot', savedFluxS.length > 10); }
  const savedXai = localStorage.getItem('gis_xai_apikey');
  if (savedXai) { document.getElementById('setupXaiKey').value = savedXai; updateSetupDot('setupXaiDot', savedXai.length > 10); }
  const savedLuma = localStorage.getItem('gis_luma_apikey');
  if (savedLuma) { document.getElementById('setupLumaKey').value = savedLuma; updateSetupDot('setupLumaDot', savedLuma.length > 10); }
  const savedFreepik = localStorage.getItem('gis_freepik_apikey');
  if (savedFreepik) { document.getElementById('setupFreepikKey').value = savedFreepik; updateSetupDot('setupFreepikDot', savedFreepik.length > 10); }
  const savedTopaz = localStorage.getItem('gis_topaz_apikey');
  if (savedTopaz) { document.getElementById('setupTopazKey').value = savedTopaz; updateSetupDot('setupTopazDot', savedTopaz.length > 10); }
  const savedReplicate = localStorage.getItem('gis_replicate_apikey');
  if (savedReplicate) { document.getElementById('setupReplicateKey').value = savedReplicate; updateSetupDot('setupReplicateDot', savedReplicate.length > 10); }
  const savedOpenRouter = localStorage.getItem('gis_openrouter_apikey');
  if (savedOpenRouter) { document.getElementById('setupOpenRouterKey').value = savedOpenRouter; updateSetupDot('setupOpenRouterDot', savedOpenRouter.length > 10); }
  const DEFAULT_PROXY = 'https://gis-proxy.petr-gis.workers.dev';
  const savedProxy = localStorage.getItem('gis_proxy_url') || DEFAULT_PROXY;
  if (!localStorage.getItem('gis_proxy_url')) localStorage.setItem('gis_proxy_url', DEFAULT_PROXY);
  const proxyInput = document.getElementById('setupProxyUrl');
  if (proxyInput) { proxyInput.value = savedProxy; updateSetupDot('setupProxyDot', savedProxy.length > 10); }
  initSpendingUI();
  document.addEventListener('click', e => {
    if (!document.getElementById('ctxMenu').contains(e.target)) closeCtxMenu();
  });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate();
    if (e.key === 'Escape') { closeModal(); closeRefLightbox(); closeAnnotateModal(); closeAiPromptModal(); closeDescribeModal(); closeMention(); document.getElementById('assetLightbox')?.classList.remove('show'); }
    if (document.getElementById('modal').classList.contains('show')) {
      if (e.key === 'ArrowLeft') navigateModal(-1);
      if (e.key === 'ArrowRight') navigateModal(1);
    }
  });
  document.querySelectorAll('input[name="nImg"]').forEach(r => r.addEventListener('change', () => {
    document.getElementById('nImgVal').textContent = r.value;
  }));
  document.querySelectorAll('input[name="nbCount"]').forEach(r => r.addEventListener('change', () => {
    document.getElementById('nbCountVal').textContent = r.value;
  }));
  document.querySelectorAll('input[name="imagenCount"]').forEach(r => r.addEventListener('change', () => {
    document.getElementById('imagenCountVal').textContent = r.value;
  }));
  document.querySelectorAll('input[name="fluxCount"]').forEach(r => r.addEventListener('change', () => {
    document.getElementById('fluxCountVal').textContent = r.value;
  }));
  document.querySelectorAll('input[name="sdCount"]').forEach(r => r.addEventListener('change', () => {
    document.getElementById('sdCountVal').textContent = r.value;
  }));
  document.querySelectorAll('input[name="klingCount"]').forEach(r => r.addEventListener('change', () => {
    document.getElementById('klingCountVal').textContent = r.value;
  }));
  document.querySelectorAll('input[name="zimageCount"]').forEach(r => r.addEventListener('change', () => {
    document.getElementById('zimageCountVal').textContent = r.value;
  }));
  document.querySelectorAll('input[name="qwen2Count"]').forEach(r => r.addEventListener('change', () => {
    document.getElementById('qwen2CountVal').textContent = r.value;
  }));
  // FLUX quality tier + aspect ratio → aktualizovat pixel info
  document.querySelectorAll('input[name="fluxQuality"]').forEach(r => r.addEventListener('change', updateFluxQualityInfo));
  // Z-Image resolution tier + aspect ratio → aktualizovat pixel info
  document.querySelectorAll('input[name="zimageRes"]').forEach(r => r.addEventListener('change', updateZImageQualityInfo));
  document.getElementById('aspectRatio').addEventListener('change', () => { updateFluxQualityInfo(); updateZImageQualityInfo(); });
  initDB().then(async () => {
    refreshGalleryUI();
    updateTargetFolderSelect();
    renderAssetFolders();
  });
  selectModel('nb2');
  // Zajistit platný aspect ratio po init (browser může obnovit neplatnou hodnotu)
  const arSel = document.getElementById('aspectRatio');
  if (!arSel.value) arSel.value = '16:9';
  initStylesCats();
  initPaintTab();
  initMentionSystem();
  initVideoMentionSystem();

  // Refresh video queue UI when tab becomes visible (browser throttles background tabs)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof renderVideoQueue === 'function') renderVideoQueue();
  });
};

function updateApiDot(ok) {
  document.getElementById('apiDot').className = 'dot ' + (ok ? 'ok' : 'err');
  updateSetupDot('setupGoogleDot', ok);
}

function updateFluxApiDot(ok) {
  updateSetupDot('setupFalDot', ok);  // fluxApiDot removed from header
}

function updateSetupDot(id, ok) {
  const el = document.getElementById(id); if (el) el.className = 'dot ' + (ok ? 'ok' : 'err');
}

function onSetupGoogleKey(val) {
  localStorage.setItem('gis_apikey', val);
  const main = document.getElementById('apiKey');
  if (main) main.value = val;
  updateApiDot(val.length > 10);
  updateSetupDot('setupGoogleDot', val.length > 10);
}

function onSetupFalKey(val) {
  localStorage.setItem('gis_flux_apikey', val);
  const main = document.getElementById('fluxApiKey');
  if (main) main.value = val;
  updateFluxApiDot(val.length > 10);
  updateSetupDot('setupFalDot', val.length > 10);
}

function onSetupXaiKey(val) {
  localStorage.setItem('gis_xai_apikey', val);
  updateSetupDot('setupXaiDot', val.length > 10);
}

function onSetupLumaKey(val) {
  localStorage.setItem('gis_luma_apikey', val);
  updateSetupDot('setupLumaDot', val.length > 10);
}

function onSetupFreepikKey(val) {
  localStorage.setItem('gis_freepik_apikey', val);
  updateSetupDot('setupFreepikDot', val.length > 10);
}

function onSetupTopazKey(val) {
  localStorage.setItem('gis_topaz_apikey', val);
  updateSetupDot('setupTopazDot', val.length > 10);
}

function onSetupReplicateKey(val) {
  localStorage.setItem('gis_replicate_apikey', val);
  updateSetupDot('setupReplicateDot', val.length > 10);
}

function onSetupOpenRouterKey(val) {
  localStorage.setItem('gis_openrouter_apikey', val);
  updateSetupDot('setupOpenRouterDot', val.length > 10);
}

function onSetupProxyUrl(val) {
  localStorage.setItem('gis_proxy_url', val.trim());
  updateSetupDot('setupProxyDot', val.trim().length > 10);
}

function resetProxyUrl() {
  const def = 'https://gis-proxy.petr-gis.workers.dev';
  document.getElementById('setupProxyUrl').value = def;
  localStorage.setItem('gis_proxy_url', def);
  updateSetupDot('setupProxyDot', true);
  toast('Proxy URL reset to default', 'ok');
}

function updateXaiApiDot(ok) { updateSetupDot('setupXaiDot', ok); }
function onXaiKeyInput(val) { onSetupXaiKey(val); }
function updateLumaApiDot(ok) { updateSetupDot('setupLumaDot', ok); }
function onLumaKeyInput(val) { onSetupLumaKey(val); }
function updateProxyUrlDot(ok) { updateSetupDot('setupProxyDot', ok); }
function onProxyUrlInput(val) { onSetupProxyUrl(val); }

// ── API Keys Export / Import ──────────────────────────────────
const API_KEY_FIELDS = [
  { key: 'gis_apikey',        label: 'Google API Key',    inputId: 'setupGoogleKey',  dotId: 'setupGoogleDot'  },
  { key: 'gis_flux_apikey',   label: 'fal.ai API Key',    inputId: 'setupFalKey',     dotId: 'setupFalDot'     },
  { key: 'gis_xai_apikey',    label: 'xAI API Key',       inputId: 'setupXaiKey',     dotId: 'setupXaiDot'     },
  { key: 'gis_luma_apikey',   label: 'Luma API Key',      inputId: 'setupLumaKey',    dotId: 'setupLumaDot'    },
  { key: 'gis_freepik_apikey',label: 'Freepik API Key',   inputId: 'setupFreepikKey', dotId: 'setupFreepikDot' },
  { key: 'gis_topaz_apikey',       label: 'Topaz API Key',       inputId: 'setupTopazKey',       dotId: 'setupTopazDot'       },
  { key: 'gis_replicate_apikey',   label: 'Replicate API Key',   inputId: 'setupReplicateKey',   dotId: 'setupReplicateDot'   },
  { key: 'gis_openrouter_apikey',  label: 'OpenRouter API Key',  inputId: 'setupOpenRouterKey',  dotId: 'setupOpenRouterDot'  },
  { key: 'gis_proxy_url',          label: 'Proxy URL',           inputId: 'setupProxyUrl',       dotId: 'setupProxyDot'       },
];

function exportApiKeys() {
  const data = { version: 1, exported: new Date().toISOString(), keys: {} };
  API_KEY_FIELDS.forEach(f => {
    const val = localStorage.getItem(f.key) || '';
    if (val) data.keys[f.key] = val;
  });
  if (!Object.keys(data.keys).length) { toast('No keys to export', 'err'); return; }
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gis-keys-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('API keys exported ✓', 'ok');
}

async function importApiKeys(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const statusEl = document.getElementById('keysImportStatus');
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.version !== 1 || typeof data.keys !== 'object') throw new Error('Invalid format');
    let count = 0;
    API_KEY_FIELDS.forEach(f => {
      const val = data.keys[f.key];
      if (!val) return;
      localStorage.setItem(f.key, val);
      const input = document.getElementById(f.inputId);
      if (input) input.value = val;
      updateSetupDot(f.dotId, val.length > 10);
      // also sync hidden inputs
      if (f.key === 'gis_apikey') {
        const h = document.getElementById('apiKey'); if (h) h.value = val;
      }
      if (f.key === 'gis_flux_apikey') {
        const h = document.getElementById('fluxApiKey'); if (h) h.value = val;
      }
      count++;
    });
    statusEl.textContent = `✓ ${count} key${count !== 1 ? 's' : ''} imported successfully`;
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--accent)';
    toast(`${count} keys imported ✓`, 'ok');
    setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
  } catch (e) {
    statusEl.textContent = `✗ Import failed: ${e.message}`;
    statusEl.style.display = 'block';
    statusEl.style.color = '#e06060';
    setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
    toast('Import failed', 'err');
  }
  event.target.value = ''; // reset file input
}

function onFluxKeyInput(val) {
  localStorage.setItem('gis_flux_apikey', val);
  updateFluxApiDot(val.length > 10);
}

function updateCharCount() {
  const n = document.getElementById('prompt').value.length;
  document.getElementById('charCount').textContent = n + ' ch.';
}

