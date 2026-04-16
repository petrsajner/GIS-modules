// ═══════════════════════════════════════════════════════
// ASSET LIBRARY — DATABÁZE REFERENCÍ (v73)
// ═══════════════════════════════════════════════════════

// refs[] = aktivní reference pro aktuální generaci
// Každý prvek: { assetId, autoName, userLabel, mimeType, data, url, wasResized }
// assetId může být null (dočasná reference bez assetu v DB)

let currentAssetFolder = 'all';
let selectedAssets = new Set();

// Asset filter state
const assetFilters = {
  dateFrom: null,
  dateTo:   null,
};

function isAssetFilterActive() {
  return assetFilters.dateFrom != null || assetFilters.dateTo != null;
}

function toggleAssetFilterPanel() {
  const panel = document.getElementById('assetFilterPanel');
  const btn   = document.getElementById('assetFilterBtn');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  if (btn) btn.classList.toggle('filter-on', open);
}

function applyAssetFilters() {
  const dFrom = document.getElementById('assetFdFrom')?.value;
  const dTo   = document.getElementById('assetFdTo')?.value;
  assetFilters.dateFrom = dFrom ? new Date(dFrom).getTime() : null;
  assetFilters.dateTo   = dTo   ? new Date(dTo + 'T23:59:59').getTime() : null;
  renderAssets();
}

function clearAssetFilters() {
  assetFilters.dateFrom = null;
  assetFilters.dateTo   = null;
  const df = document.getElementById('assetFdFrom');
  const dt = document.getElementById('assetFdTo');
  if (df) df.value = '';
  if (dt) dt.value = '';
  const panel = document.getElementById('assetFilterPanel');
  if (panel) panel.classList.remove('open');
  renderAssets();
}

// Smart ref add: if clicked asset is in selection → add all selected; else add just this one
function assetAddRef(id) {
  if (selectedAssets.size > 0 && selectedAssets.has(id)) {
    addSelectedAssetsToRefs();
  } else {
    addAssetToRefs(id);
  }
}

// ── Generátor Ref_XXX čísel — první volné jméno (1–999) ──
async function nextRefAutoName() {
  const all = await dbGetAllAssetMeta();
  const used = new Set(all.map(a => a.autoName));
  for (let n = 1; n <= 999; n++) {
    const name = 'Ref_' + String(n).padStart(3, '0');
    if (!used.has(name)) return name;
  }
  return 'Ref_' + Date.now(); // fallback pokud je všech 999 obsazeno
}

// ── Fingerprint pro detekci duplikátů ──
// Kombinuje délku + vzorky ze začátku, středu a konce → odolné vůči JPEG hlavičkám
function assetFingerprint(imageData) {
  if (!imageData) return '';
  const len = imageData.length;
  const mid = Math.floor(len / 2);
  // délka + 200 znaků ze začátku + 200 ze středu + 200 z konce
  return len + '|' +
    imageData.slice(0, 200) + '|' +
    imageData.slice(mid, mid + 200) + '|' +
    imageData.slice(-200);
}

// ── Hledá existující asset dle fingerprintu ──
async function findAssetByFingerprint(imageData) {
  const fp = assetFingerprint(imageData);
  const all = await dbGetAll('assets');
  return all.find(a => assetFingerprint(a.imageData) === fp) || null;
}

// ── Přidání assetu do DB (s duplicate check) ──
async function createAsset(imageData, mimeType, sourceType, sourceJobId) {
  // Duplicate check — pokud stejný obrázek už existuje, vrátit ho
  const existing = await findAssetByFingerprint(imageData);
  if (existing) return existing; // tiché vrácení existujícího assetu

  const autoName = await nextRefAutoName();
  const id = Date.now() + '_a_' + Math.random().toString(36).substr(2, 5);
  const thumb = await generateThumb(imageData, mimeType);
  const dims = await getImageDimensions(imageData);
  const asset = {
    id, autoName, userLabel: '', imageData, mimeType: mimeType || 'image/png',
    thumb: thumb || null, ts: Date.now(), folder: 'all',
    sourceType: sourceType || 'upload', sourceJobId: sourceJobId || null, usedInJobs: [],
    dims: dims || null,
  };
  await dbPut('assets', asset);
  await dbPutAssetMeta(asset);
  return asset;
}

// ── Upload obrázků do asset library ──
async function uploadAssetsFromFile(files) {
  const arr = Array.from(files);
  if (!arr.length) return;
  toast(`Uploading ${arr.length} ${arr.length === 1 ? 'file' : 'files'}…`, 'ok');
  let newCount = 0, dupCount = 0, errCount = 0;
  for (const file of arr) {
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = () => rej(new Error(`Read error: ${file.name}`));
        r.readAsDataURL(file);
      });
      const b64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/png';
      if (!b64 || b64.length < 100) { errCount++; toast(`Error: ${file.name} — empty data`, 'err'); continue; }
      const isNew = !(await findAssetByFingerprint(b64));
      const asset = await createAsset(b64, mimeType, 'upload');
      // Ověř že se skutečně uložilo do DB
      const verify = await dbGet('assets', asset.id);
      if (!verify) { errCount++; toast(`DB error: ${file.name}`, 'err'); continue; }
      if (isNew) newCount++; else dupCount++;
    } catch(e) {
      errCount++;
      console.error('Asset upload error:', e);
      toast(`Chyba: ${e.message}`, 'err');
    }
  }
  document.getElementById('assetUploadInput').value = '';
  await renderAssets();
  await renderAssetFolders();
  const parts = [];
  if (newCount) parts.push(`${newCount} new`);
  if (dupCount) parts.push(`${dupCount} duplicate${dupCount > 1 ? 's' : ''} skipped`);
  if (errCount) parts.push(`${errCount} error${errCount > 1 ? 's' : ''}`);
  toast(`Assets: ${parts.join(', ') || 'done'}`, errCount ? 'err' : 'ok');
}

// ── Přidat vygenerovaný obrázek jako asset ──
async function addGeneratedAsAsset(b64data, jobId) {
  const asset = await createAsset(b64data, 'image/png', 'generated', jobId || null);
  toast(`Saved to Assets as ${asset.autoName}`, 'ok');
  return asset;
}

// ── Přidat asset do aktivních refs ──
async function addAssetToRefs(assetId) {
  // If in video mode — route to video frame ref picker instead
  if (window.aiPromptContext === 'video') {
    if (typeof videoAssetPickConfirm === 'function' && window._videoAssetPickMode) {
      videoAssetPickConfirm(assetId);
      return;
    }
    // No slot selected — ask which frame slot
    window._videoAssetPickMode = true;
    window._videoAssetPickSlot = 'start';
    videoAssetPickConfirm(assetId);
    return;
  }
  const modelMax = getRefMax();
  const modelSupportsRefs = !!(MODELS[currentModel]?.refs);
  const storageMax = (modelMax > 0) ? modelMax : REF_GLOBAL_MAX;
  if (refs.length >= storageMax) { toast(`Reference limit reached (${storageMax})`, 'err'); return; }
  const asset = await dbGet('assets', assetId);
  if (!asset) { toast('Asset nenalezen', 'err'); return; }
  // Dedup — stejný asset nesmí být 2× v aktivních refs
  if (refs.some(r => r.assetId === assetId)) {
    toast(`${asset.userLabel || asset.autoName} is already an active reference`, 'err'); return;
  }
  refs.push({
    assetId: asset.id,
    autoName: asset.autoName,
    userLabel: asset.userLabel || '',
    mimeType: asset.mimeType || 'image/png',
    thumb: asset.thumb || null,
    dims: asset.dims || null,
  });
  renderRefThumbs();
  switchView('gen');
  if (modelSupportsRefs) {
    toast(`${asset.userLabel || asset.autoName} added as reference [${refs.length}/${modelMax}]`, 'ok');
  } else {
    toast(`${asset.userLabel || asset.autoName} added as reference — switch model to use it`, 'ok');
  }
}

// ── Přidat vybrané assety do refs ──
async function addSelectedAssetsToRefs() {
  const modelMax = getRefMax();
  const storageMax = (modelMax > 0) ? modelMax : REF_GLOBAL_MAX;
  for (const id of selectedAssets) {
    if (refs.length >= storageMax) { toast(`Reference limit of ${storageMax} reached`, 'err'); break; }
    await addAssetToRefs(id);
  }
  clearAssetSelection();
}

// ── Renderování assetů — galerie-style ──
async function renderAssets() {
  const all = await dbGetAllAssetMeta();
  const q = (document.getElementById('assetSearch')?.value || '').toLowerCase();
  const sort = document.getElementById('assetSort')?.value || 'newest';

  let items = all;
  if (currentAssetFolder === 'fav') {
    items = items.filter(a => a.favorite);
  } else if (currentAssetFolder !== 'all') {
    items = items.filter(a => a.folder === currentAssetFolder);
  }

  // Apply asset filters
  if (q) items = items.filter(a => {
    const hay = [a.userLabel, a.autoName, a.sourceType,
      a.dims ? `${a.dims.w}×${a.dims.h}` : '',
      new Date(a.ts).toLocaleDateString('en')
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
  if (assetFilters.dateFrom) items = items.filter(a => a.ts >= assetFilters.dateFrom);
  if (assetFilters.dateTo)   items = items.filter(a => a.ts <= assetFilters.dateTo);

  if (sort === 'newest') items.sort((a,b) => b.ts - a.ts);
  else if (sort === 'oldest') items.sort((a,b) => a.ts - b.ts);
  else items.sort((a,b) => (a.userLabel || a.autoName).localeCompare(b.userLabel || b.autoName));

  const totalInFolder = all.filter(a =>
    currentAssetFolder === 'fav' ? a.favorite :
    currentAssetFolder === 'all' ? true : a.folder === currentAssetFolder
  ).length;
  const countEl = document.getElementById('assetCount');
  if (countEl) countEl.textContent = isAssetFilterActive()
    ? `${items.length} / ${totalInFolder} assets`
    : `${items.length} assets`;

  // Filter banner
  const banner = document.getElementById('assetFilterActive');
  const bannerLabel = document.getElementById('assetFilterActiveLabel');
  const filterOn = isAssetFilterActive();
  if (banner) banner.classList.toggle('show', filterOn);
  if (document.getElementById('assetFilterBtn'))
    document.getElementById('assetFilterBtn').classList.toggle('filter-on',
      filterOn || document.getElementById('assetFilterPanel')?.classList.contains('open'));

  const grid = document.getElementById('assetCards');
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = '<div class="asset-gal-empty" id="assetEmpty" style="grid-column:1/-1">No assets.<br>Upload images or add generated images as references.</div>';
    return;
  }

  grid.innerHTML = items.map(a => {
    const label = a.userLabel || a.autoName;
    const hasLabel = !!a.userLabel;
    const isActive = refs.some(r => r.assetId === a.id)
                  || (typeof videoRefs !== 'undefined' && videoRefs.some(r => r.assetId === a.id));
    const isSel = selectedAssets.has(a.id);
    const inFolder = a.folder && a.folder !== 'all';
    const isFav = !!a.favorite;
    const date = new Date(a.ts).toLocaleDateString('en', {day:'2-digit', month:'2-digit'});
    const dimsStr = a.dims ? `${a.dims.w}×${a.dims.h}` : '';
    // Pillarbox for square/portrait images
    const isPortrait = a.dims && (a.dims.w <= a.dims.h * 1.15);
    const thumbClass = isPortrait ? 'ai-thumb pillarbox' : 'ai-thumb';
    const src = a.thumb ? `data:${a.mimeType||'image/png'};base64,${a.thumb}` : '';
    const refTag = isActive ? `<span style="font-size:9px;background:rgba(136,170,255,.9);color:#000;padding:1px 5px;font-weight:700;margin-right:5px;flex-shrink:0;">REF</span>` : '';
    const srcTag = a.sourceType === 'upload' ? `<span style="font-size:9px;color:var(--dim2);margin-left:auto;flex-shrink:0;">↑</span>` : '';
    return `
    <div class="asset-item ${isSel?'selected':''} ${inFolder?'in-folder':''} ${isFav?'favorited':''}" data-id="${a.id}" draggable="true" ondragstart="assetDragStart(event,'${a.id}')">
      ${src ? `<img class="${thumbClass}" src="${src}" alt="${escHtml(label)}" data-needs-regen="${isPortrait && a.thumbVersion !== 2 ? '1' : '0'}">` : `<div class="${thumbClass}" style="background:#222;display:flex;align-items:center;justify-content:center;color:#555;font-size:20px;">⊞</div>`}
      <div class="ai-badge ${hasLabel?'':'auto-name'}">${refTag}${escHtml(label)}${srcTag}</div>
      <div class="ai-sel" onclick="event.stopPropagation();toggleAssetSel('${a.id}')"></div>
      <div class="gal-heart ${isFav?'on':'off'}" onclick="event.stopPropagation();toggleAssetFavorite(event,'${a.id}')" title="${isFav?'Remove from favorites':'Add to favorites'}">${isFav?'♥':'♡'}</div>
      <div class="ai-hover-overlay">
        <button class="ai-ov-btn zoom" onclick="event.stopPropagation();openAssetLightbox('${a.id}')">⤢ Preview</button>
        <button class="ai-ov-btn ref" onclick="event.stopPropagation();assetAddRef('${a.id}')">⊕ Ref</button>
        <button class="ai-ov-btn" onclick="event.stopPropagation();startAssetRenameById('${a.id}')" style="color:#ffe066;">✎ Rename</button>
        <button class="ai-ov-btn" onclick="event.stopPropagation();openAssetAnnotate('${a.id}')" style="color:#ff9966;">✎ Annot.</button>
        <button class="ai-ov-btn" onclick="event.stopPropagation();downloadAsset('${a.id}')">↓</button>
        <button class="ai-ov-btn del" onclick="event.stopPropagation();deleteAsset('${a.id}')">✕</button>
      </div>
      <div class="ai-bottom">
        <span class="ai-date">${date}</span>
        ${dimsStr ? `<span class="ai-dims">${dimsStr}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  // Lazy regen: portrait/square assets with old center-crop thumbs
  const toRegen = items.filter(a => a.dims && (a.dims.w <= a.dims.h * 1.15) && a.thumbVersion !== 2);
  if (toRegen.length > 0) {
    for (const meta of toRegen) {
      dbGet('assets', meta.id).then(fullAsset => {
        if (!fullAsset?.imageData) return;
        generateThumb(fullAsset.imageData, fullAsset.mimeType || 'image/png').then(newThumb => {
          if (!newThumb) return;
          fullAsset.thumb = newThumb;
          fullAsset.thumbVersion = 2;
          dbPut('assets', fullAsset);
          dbPutAssetMeta(fullAsset);
          const imgEl = grid.querySelector(`.asset-item[data-id="${meta.id}"] img.ai-thumb`);
          if (imgEl) imgEl.src = `data:${fullAsset.mimeType||'image/png'};base64,${newThumb}`;
        });
      });
    }
  }

  // Klik na kartu → přidat do refs
  // Vybraná karta: přidat VŠECHNY vybrané jako refs
  // Nevybraná karta: přidat jen tuto kartu (ignoruje výběr)
  grid.querySelectorAll('.asset-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.ai-sel,.ai-ov-btn,.ai-bottom')) return;
      if (e.shiftKey || e.altKey) return;
      assetAddRef(el.dataset.id);
    });
    // Dvojklik → rename
    el.addEventListener('dblclick', e => {
      if (e.target.closest('.ai-sel,.ai-ov-btn,.ai-bottom,.ai-hover-overlay')) return;
      e.stopPropagation();
      startAssetRename(el.dataset.id, el);
    });
  });
}

// ── Rename by ID (voláno z hover overlay) ──
function startAssetRenameById(assetId) {
  const cardEl = document.querySelector(`.asset-item[data-id="${assetId}"]`);
  if (cardEl) startAssetRename(assetId, cardEl);
}

// ── Inline rename — dvojklik na kartu ──
function startAssetRename(assetId, cardEl) {
  // Pokud už existuje input, ignoruj
  if (cardEl.querySelector('.ai-rename-input')) return;
  const badgeEl = cardEl.querySelector('.ai-badge');
  const currentVal = badgeEl ? badgeEl.textContent.trim() : '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'ai-rename-input';
  input.value = currentVal;
  input.placeholder = 'Asset name…';
  cardEl.appendChild(input);
  input.focus();
  input.select();

  const commit = async () => {
    input.remove();
    const newVal = input.value.trim();
    if (!newVal) return;
    const asset = await dbGet('assets', assetId);
    if (!asset) return;
    asset.userLabel = newVal === asset.autoName ? '' : newVal;
    await dbPut('assets', asset);
    await dbPutAssetMeta(asset);
    // Aktualizovat label v aktivních refs
    refs.forEach(r => { if (r.assetId === assetId) r.userLabel = asset.userLabel; });
    renderRefThumbs();
    renderAssets();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.remove(); }
  });
}

// ── Asset lightbox ──
let currentLightboxAssetId = null;

async function openAssetLightbox(assetId) {
  const asset = await dbGet('assets', assetId);
  if (!asset) return;
  currentLightboxAssetId = assetId;
  const lb = document.getElementById('assetLightbox');
  const img = document.getElementById('assetLightboxImg');
  img.src = `data:${asset.mimeType||'image/png'};base64,${asset.imageData}`;
  document.getElementById('assetLbName').textContent = asset.userLabel || asset.autoName;
  const dimsLabel = asset.dims ? ` · ${asset.dims.w}×${asset.dims.h}` : '';
  document.getElementById('assetLbSub').textContent =
    `${asset.autoName}${asset.userLabel?' · '+asset.autoName:''}${dimsLabel} · ${asset.sourceType==='generated'?'generated':'uploaded'} · ${new Date(asset.ts).toLocaleString('cs')}`;
  document.getElementById('assetLbRef').onclick = () => { addAssetToRefs(assetId); closeAssetLightbox(); };
  document.getElementById('assetLbRename').onclick = () => { closeAssetLightbox(); setTimeout(() => startAssetRenameById(assetId), 50); };
  document.getElementById('assetLbAnnotate').onclick = () => { closeAssetLightbox(); openAssetAnnotate(assetId); };
  const dlLink = document.getElementById('assetLbDownload');
  dlLink.onclick = () => downloadAsset(assetId);
  lb.classList.add('show');
}

function closeAssetLightbox(e) {
  if (e && e.target !== document.getElementById('assetLightbox') && e.target !== document.getElementById('assetLightboxImg')) return;
  document.getElementById('assetLightbox').classList.remove('show');
  currentLightboxAssetId = null;
}

// ── Select all assets ──
async function selectAllAssets() {
  const all = await dbGetAllAssetMeta();
  const q = (document.getElementById('assetSearch')?.value || '').toLowerCase();
  let items = all;
  if (currentAssetFolder !== 'all') items = items.filter(a => a.folder === currentAssetFolder);
  if (q) items = items.filter(a => (a.userLabel + a.autoName).toLowerCase().includes(q));
  items.forEach(a => selectedAssets.add(a.id));
  updateAssetBulkBar();
  renderAssets();
}

function updateAssetBulkBar() {
  const bulk = document.getElementById('assetBulk');
  const cnt = document.getElementById('assetSelCount');
  bulk.classList.toggle('show', selectedAssets.size > 0);
  if (cnt) cnt.textContent = selectedAssets.size;
}

// ── Export vybraných assetů ──
async function exportSelectedAssets() {
  const ids = selectedAssets.size > 0 ? [...selectedAssets] : null;
  if (!ids) { toast('Select assets first', 'err'); return; }
  for (const id of ids) await downloadAsset(id);
}

// ── Přesunout vybrané do složky ──
async function moveSelectedAssetsToFolder() {
  const folders = await dbGetAll('assetFolders');
  if (!folders.length) { toast('Create an asset folder first', 'err'); return; }
  const folderId = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);padding:20px;min-width:280px;display:flex;flex-direction:column;gap:12px;">
      <div style="font-family:Syne,sans-serif;font-weight:700;font-size:14px;">Move to folder</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${folders.map(f=>`<button class="ibtn" data-fid="${f.id}" style="justify-content:flex-start;padding:8px 12px;">${f.name}</button>`).join('')}
        <button class="ibtn" data-fid="all" style="justify-content:flex-start;padding:8px 12px;opacity:.7;">◈ All (no folder)</button>
      </div>
      <button class="ibtn" id="_cancelMove" style="margin-top:4px;">Cancel</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-fid]').forEach(btn => btn.onclick = () => { document.body.removeChild(ov); resolve(btn.dataset.fid); });
    ov.querySelector('#_cancelMove').onclick = () => { document.body.removeChild(ov); resolve(null); };
  });
  if (!folderId) return;
  await Promise.all([...selectedAssets].map(id => dbPatchAssetMeta(id, { folder: folderId })));
  clearAssetSelection();
  renderAssets(); renderAssetFolders();
  toast('Moved ✓', 'ok');
}

function toggleAssetSel(id) {
  if (selectedAssets.has(id)) selectedAssets.delete(id);
  else selectedAssets.add(id);
  updateAssetBulkBar();
  const el = document.querySelector(`.asset-item[data-id="${id}"]`);
  if (el) el.classList.toggle('selected', selectedAssets.has(id));
}

function clearAssetSelection() {
  selectedAssets.clear();
  updateAssetBulkBar();
  document.querySelectorAll('.asset-item.selected').forEach(el => el.classList.remove('selected'));
}

// ── Asset smazat ──
async function deleteAsset(id) {
  if (!confirm('Delete asset?')) return;
  await dbDelete('assets', id);
  await dbDeleteAssetMeta(id);
  // Odebrat z aktivních refs
  const idx = refs.findIndex(r => r.assetId === id);
  if (idx !== -1) { refs.splice(idx, 1); renderRefThumbs(); }
  selectedAssets.delete(id);
  renderAssets(); renderAssetFolders();
  toast('Asset deleted', 'ok');
}

async function deleteSelectedAssets() {
  if (!selectedAssets.size) return;
  if (!confirm(`Delete ${selectedAssets.size} assets?`)) return;
  for (const id of selectedAssets) {
    await dbDelete('assets', id);
    await dbDeleteAssetMeta(id);
    const idx = refs.findIndex(r => r.assetId === id);
    if (idx !== -1) refs.splice(idx, 1);
  }
  clearAssetSelection();
  renderRefThumbs();
  renderAssets(); renderAssetFolders();
  toast('Assets deleted', 'ok');
}

// ── Asset favorite ──
async function toggleAssetFavorite(e, id) {
  e.stopPropagation();
  const asset = await dbGet('assets', id);
  if (!asset) return;
  asset.favorite = !asset.favorite;
  await dbPut('assets', asset);
  await dbPutAssetMeta(asset);

  // Update card DOM directly
  const el = document.querySelector(`.asset-item[data-id="${id}"]`);
  if (el) {
    el.classList.toggle('favorited', asset.favorite);
    const heart = el.querySelector('.gal-heart');
    if (heart) { heart.className = `gal-heart ${asset.favorite?'on':'off'}`; heart.textContent = asset.favorite?'♥':'♡'; }
  }

  // Always refresh folder counts in sidebar
  renderAssetFolders();
  // If in favorites folder and item was unliked → remove it from view immediately
  if (!asset.favorite && currentAssetFolder === 'fav') {
    if (el) el.remove();
    const remaining = document.querySelectorAll('#assetCards .asset-item').length;
    const countEl = document.getElementById('assetCount');
    if (countEl) countEl.textContent = `${remaining} assets`;
  }
}

// ── Asset download ──
async function downloadAsset(id) {
  const asset = await dbGet('assets', id);
  if (!asset) return;
  const a = document.createElement('a');
  a.href = `data:${asset.mimeType || 'image/png'};base64,${asset.imageData}`;
  a.download = (asset.userLabel || asset.autoName) + '.png';
  a.click();
}

// ── Asset annotate ──
async function openAssetAnnotate(id) {
  const asset = await dbGet('assets', id);
  if (!asset) return;
  openAnnotateModal(asset.imageData, asset.userLabel || asset.autoName);
}

// ── Asset složky ──
async function renderAssetFolders() {
  const folders = await dbGetAll('assetFolders');
  const all = await dbGetAllAssetMeta();
  const list = document.getElementById('assetFolderList');
  const allActive = currentAssetFolder === 'all';
  const favActive = currentAssetFolder === 'fav';
  const favCount  = all.filter(a => a.favorite).length;
  const dA = (fid) => `ondragover="assetFolderDragOver(event)" ondragenter="assetFolderDragEnter(event,this)" ondragleave="assetFolderDragLeave(event,this)" ondrop="assetFolderDrop(event,'${fid}')"`;
  let html = `<div class="folder-item ${allActive ? 'active' : ''}" onclick="setAssetFolder('all')" ${dA('all')}>
    <span class="fi">◈</span> All <span class="fc">${all.length}</span></div>`;
  html += `<div class="folder-item ${favActive ? 'active' : ''}" onclick="setAssetFolder('fav')" style="color:${favActive ? 'var(--accent)' : ''};">
    <span class="fi">♥</span> Favorites <span class="fc">${favCount}</span></div>`;
  for (const f of folders) {
    const cnt = all.filter(a => a.folder === f.id).length;
    const active = currentAssetFolder === f.id;
    html += `<div class="folder-item ${active ? 'active' : ''}" onclick="setAssetFolder('${f.id}')" ${dA(f.id)}>
      <span class="fi">▷</span> ${f.name} <span class="fc">${cnt}</span>
      <button class="folder-del" onclick="deleteAssetFolder(event,'${f.id}')">×</button>
    </div>`;
  }
  list.innerHTML = html;
}

function setAssetFolder(id) {
  currentAssetFolder = id;
  renderAssetFolders();
  renderAssets();
}

async function addAssetFolder() {
  const name = prompt('New asset folder name:');
  if (!name?.trim()) return;
  const id = 'af_' + Date.now();
  await dbPut('assetFolders', { id, name: name.trim() });
  renderAssetFolders();
}

async function deleteAssetFolder(e, id) {
  e.stopPropagation();

  // Immediately red-highlight the folder row — no confirm dialog
  const folderEl = e.target.closest('.folder-item');
  if (folderEl) {
    folderEl.style.background = 'rgba(200,60,60,.18)';
    folderEl.style.color = '#e07070';
    folderEl.style.pointerEvents = 'none';
  }

  const items = await dbGetAllAssetMeta();
  await Promise.all(
    items.filter(a => a.folder === id).map(a => dbPatchAssetMeta(a.id, { folder: 'all' }))
  );
  await dbDelete('assetFolders', id);
  if (currentAssetFolder === id) currentAssetFolder = 'all';
  renderAssetFolders();
  renderAssets();
}

