// ═══════════════════════════════════════════════════════
// GALLERY FILTERS
// ═══════════════════════════════════════════════════════

// Gallery selection state — chybí od modularizace v90
let selectedGalItems = new Set();

// Aktivní filtry — null/undefined = filtr není nastaven
const galFilters = {
  q: '',           // fulltext v metadatech
  models: new Set(), // prázdná = vše
  wMin: null, wMax: null, // šířka px
  dateFrom: null, dateTo: null, // timestamp ms
};

function toggleFilterPanel() {
  const panel = document.getElementById('galFilterPanel');
  const btn = document.getElementById('galFilterBtn');
  const open = panel.classList.toggle('open');
  btn.classList.toggle('filter-on', open);
  if (open) buildModelChips();
}

// Dynamicky vytvoří chipsy modelů z aktuálních metadat
async function buildModelChips() {
  const allItems = await dbGetAllMeta();
  const models = [...new Set(allItems.map(i => i.model).filter(Boolean))].sort();
  const container = document.getElementById('galFilterModels');
  container.innerHTML = models.map(m => `
    <div class="gal-filter-chip ${galFilters.models.has(m) ? 'on' : ''}"
         onclick="toggleModelChip(this, '${m.replace(/'/g,"\\'")}')">
      ${m}
    </div>`).join('');
}

function toggleModelChip(el, model) {
  if (galFilters.models.has(model)) { galFilters.models.delete(model); el.classList.remove('on'); }
  else { galFilters.models.add(model); el.classList.add('on'); }
  applyFilters();
}

function applyFilters() {
  galFilters.q = document.getElementById('galSearch').value.toLowerCase().trim();
  const wMin = document.getElementById('galFwMin').value;
  const wMax = document.getElementById('galFwMax').value;
  const dFrom = document.getElementById('galFdFrom').value;
  const dTo = document.getElementById('galFdTo').value;
  galFilters.wMin = wMin ? parseInt(wMin) : null;
  galFilters.wMax = wMax ? parseInt(wMax) : null;
  galFilters.dateFrom = dFrom ? new Date(dFrom).getTime() : null;
  galFilters.dateTo = dTo ? new Date(dTo + 'T23:59:59').getTime() : null;
  renderGallery();
}

function clearFilters() {
  galFilters.q = '';
  galFilters.models.clear();
  galFilters.wMin = null; galFilters.wMax = null;
  galFilters.dateFrom = null; galFilters.dateTo = null;
  document.getElementById('galSearch').value = '';
  document.getElementById('galFwMin').value = '';
  document.getElementById('galFwMax').value = '';
  document.getElementById('galFdFrom').value = '';
  document.getElementById('galFdTo').value = '';
  document.querySelectorAll('.gal-filter-chip.on').forEach(c => c.classList.remove('on'));
  renderGallery();
}

function isFilterActive() {
  return galFilters.q || galFilters.models.size > 0 ||
    galFilters.wMin != null || galFilters.wMax != null ||
    galFilters.dateFrom != null || galFilters.dateTo != null;
}

function filterItems(items) {
  let result = items;

  // Fulltext — prohledá veškerá metadata
  if (galFilters.q) {
    const q = galFilters.q;
    result = result.filter(i => {
      const ts = new Date(i.ts);
      const dateStr = ts.toLocaleDateString('en') + ' ' + ts.toLocaleTimeString('cs', {hour:'2-digit', minute:'2-digit'});
      const haystack = [
        i.prompt, i.rawPrompt, i.model, i.modelKey, i.dims,
        i.folder, dateStr,
        JSON.stringify(i.params || {}),
        JSON.stringify(i.usedRefs || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  // Model filter
  if (galFilters.models.size > 0) {
    result = result.filter(i => galFilters.models.has(i.model));
  }

  // Rozlišení — parsuj dims "1920 × 1080" nebo "1920x1080"
  if (galFilters.wMin != null || galFilters.wMax != null) {
    result = result.filter(i => {
      if (!i.dims) return false;
      const m = i.dims.match(/(\d+)\s*[x×]\s*(\d+)/i);
      if (!m) return false;
      const w = parseInt(m[1]);
      if (galFilters.wMin != null && w < galFilters.wMin) return false;
      if (galFilters.wMax != null && w > galFilters.wMax) return false;
      return true;
    });
  }

  // Datum
  if (galFilters.dateFrom != null) result = result.filter(i => i.ts >= galFilters.dateFrom);
  if (galFilters.dateTo != null) result = result.filter(i => i.ts <= galFilters.dateTo);

  return result;
}

function updateFilterBanner(filteredCount, totalCount) {
  const banner = document.getElementById('galFilterActive');
  const label = document.getElementById('galFilterActiveLabel');
  const active = isFilterActive();
  banner.classList.toggle('show', active);
  document.getElementById('galFilterBtn').classList.toggle('filter-on',
    active || document.getElementById('galFilterPanel').classList.contains('open'));

  if (!active) return;
  const parts = [];
  if (galFilters.q) parts.push(`hledání: "${galFilters.q}"`);
  if (galFilters.models.size > 0) parts.push(`model: ${[...galFilters.models].join(', ')}`);
  if (galFilters.wMin != null || galFilters.wMax != null) {
    parts.push(`šířka: ${galFilters.wMin ?? '—'}–${galFilters.wMax ?? '—'} px`);
  }
  if (galFilters.dateFrom != null || galFilters.dateTo != null) {
    const f = galFilters.dateFrom ? new Date(galFilters.dateFrom).toLocaleDateString('en') : '—';
    const t = galFilters.dateTo ? new Date(galFilters.dateTo).toLocaleDateString('en') : '—';
    parts.push(`datum: ${f} – ${t}`);
  }
  label.textContent = `Filter active — ${filteredCount} of ${totalCount} images  ·  ${parts.join('  ·  ')}`;
}

// Debounce pro galSearch — zabrání re-renderu na každý stisk klávesy
let _galSearchTimer = null;
function galSearchDebounced() {
  clearTimeout(_galSearchTimer);
  _galSearchTimer = setTimeout(() => {
    galFilters.q = document.getElementById('galSearch').value.toLowerCase().trim();
    renderGallery();
  }, 150);
}

// Veřejná funkce — načte meta z cache a deleguje
async function renderGallery() {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    document.getElementById('galGrid')?.insertAdjacentHTML('afterbegin',
      '<div style="grid-column:1/-1;padding:40px;text-align:center;color:#c05050;font-family:\'IBM Plex Mono\',monospace;font-size:11px;">Application integrity check failed. Please use the original GIS.</div>');
    return;
  }
  const items = await dbGetAllMeta();
  await renderGalleryWithItems(items);
}

// Jádro rendereru — přijme již načtená meta, žádný DB call na metadata
async function renderGalleryWithItems(allItems) {
  let items = allItems.slice(); // kopie pro filtrování

  // Složka
  if (currentFolder === 'fav') items = items.filter(i => i.favorite);
  else if (currentFolder !== 'all') items = items.filter(i => i.folder === currentFolder);

  // Aplikuj všechny filtry (fulltext + model + rozlišení + datum)
  const totalInFolder = items.length;
  items = filterItems(items);
  updateFilterBanner(items.length, totalInFolder);

  const sort = document.getElementById('galSort').value;

  // Pro sort by folder načteme folder names (malá tabulka, rychlé)
  let folderMap = {};
  if (sort === 'folder') {
    const folders = await dbGetAll('folders');
    folderMap = Object.fromEntries(folders.map(f => [f.id, f.name]));
  }
  if (sort === 'favorites') items = items.filter(i => i.favorite);
  if (sort === 'newest' || sort === 'favorites') items.sort((a,b) => b.ts - a.ts);
  else if (sort === 'oldest') items.sort((a,b) => a.ts - b.ts);
  else if (sort === 'folder') items.sort((a,b) => {
    const fa = folderMap[a.folder] || (a.folder === 'all' ? '~All' : a.folder);
    const fb = folderMap[b.folder] || (b.folder === 'all' ? '~All' : b.folder);
    return fa.localeCompare(fb) || b.ts - a.ts;
  });
  else items.sort((a,b) => a.model.localeCompare(b.model));

  document.getElementById('galCount').textContent = isFilterActive()
    ? `${items.length} / ${totalInFolder} images`
    : `${items.length} images`;

  const grid = document.getElementById('galGrid');
  if (!items.length) {
    grid.innerHTML = `<div class="gal-empty" style="grid-column:1/-1">No images${currentFolder !== 'all' ? ' in this folder' : ''}.<br>Generate images in the Generate tab.</div>`;
    return;
  }

  // Render okamžitě s placeholdery, thumbnaily načíst asynchronně
  grid.innerHTML = items.map(item => {
    const batchName = item.batchStyle?.name || item.batchCamera?.name || '';
    const batchIcon = item.batchStyle ? '◈' : item.batchCamera ? '⊙' : '';
    const batchClass = item.batchStyle ? 'gal-batch-style' : item.batchCamera ? 'gal-batch-camera' : '';
    const bottomContent = batchName
      ? `<span class="gal-batch-name ${batchClass}">${batchIcon} ${batchName}</span><span class="gal-res">${item.dims || '—'}</span>`
      : `<span class="gal-time">${new Date(item.ts).toLocaleDateString('en')} ${new Date(item.ts).toLocaleTimeString('cs', {hour:'2-digit',minute:'2-digit'})}</span><span class="gal-res">${item.dims || '—'}</span>`;
    return `
    <div class="gal-item ${selectedGalItems.has(item.id) ? 'selected' : ''} ${currentFolder === 'all' && item.folder && item.folder !== 'all' ? 'in-folder' : ''} ${item.favorite ? 'favorited' : ''}" data-id="${item.id}" onclick="galItemClick(event, '${item.id}')" oncontextmenu="showCtxMenu(event, '${item.id}')" draggable="true" ondragstart="galDragStart(event, '${item.id}')">
      <img src="" data-id="${item.id}" alt="" loading="lazy" style="background:var(--s3);min-height:150px;">
      <div class="gal-model">${item.model}</div>
      <div class="gal-bottom">${bottomContent}</div>
      <div class="gal-sel" onclick="galSelClick(event, '${item.id}')"></div>
      <div class="gal-heart ${item.favorite ? 'on' : 'off'}" onclick="toggleFavorite(event,'${item.id}')" title="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}">
        ${item.favorite ? '♥' : '♡'}
      </div>
    </div>`;
  }).join('');

  // Načíst thumbnaily — všechny najednou (paměťová cache je primární, DB thumbs je sekundární)
  const imgs = Array.from(grid.querySelectorAll('img[data-id]'));
  // Načíst všechny thumby z DB najednou v jedné transakci
  const idsToLoad = imgs.map(img => img.dataset.id).filter(id => !thumbMemCache.has(id));
  if (idsToLoad.length > 0) {
    const dbThumbs = await new Promise(res => {
      const result = {};
      const tx = db.transaction('thumbs', 'readonly');
      const store = tx.objectStore('thumbs');
      let remaining = idsToLoad.length;
      idsToLoad.forEach(id => {
        const req = store.get(id);
        req.onsuccess = e => {
          if (e.target.result?.data) result[id] = e.target.result.data;
          if (--remaining === 0) res(result);
        };
        req.onerror = () => { if (--remaining === 0) res(result); };
      });
    });
    // Přidej do memory cache
    for (const [id, data] of Object.entries(dbThumbs)) thumbMemCache.set(id, data);
  }

  // Aplikuj thumbnaile — vše co je v cache (po DB loadu) dostane src okamžitě
  const missingIds = [];
  for (const img of imgs) {
    const id = img.dataset.id;
    const thumb = thumbMemCache.get(id);
    if (thumb) {
      img.src = 'data:image/jpeg;base64,' + thumb;
    } else {
      missingIds.push(id);
    }
  }

  // Chybějící thumbnaile: vygeneruj na pozadí (neblokuj render)
  if (missingIds.length > 0) {
    for (const id of missingIds) {
      dbGet('images', id).then(full => {
        if (!full?.imageData) return;
        // Zobraz plný obrázek okamžitě
        const imgEl = grid.querySelector(`img[data-id="${id}"]`);
        if (imgEl) imgEl.src = 'data:image/png;base64,' + full.imageData;
        // Vygeneruj a cachuj thumb
        generateThumb(full.imageData, full.mimeType || 'image/png').then(t => {
          if (!t) return;
          thumbMemCache.set(id, t);
          const tx = db.transaction('thumbs', 'readwrite');
          tx.objectStore('thumbs').put({ id, data: t });
          // Aktualizuj src na thumbnail (menší soubor)
          const el = grid.querySelector(`img[data-id="${id}"]`);
          if (el) el.src = 'data:image/jpeg;base64,' + t;
        });
      });
    }
  }
}

function galItemClick(e, id) {
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    // Selekce — aktualizuj DOM přímo, žádný full re-render
    if (selectedGalItems.has(id)) selectedGalItems.delete(id);
    else selectedGalItems.add(id);
    const hasSelection = selectedGalItems.size > 0;
    document.getElementById('galBulk').classList.toggle('show', hasSelection);
    document.getElementById('selCount').textContent = selectedGalItems.size;
    if (hasSelection) updateBulkFolderSelect();
    const el = document.querySelector(`.gal-item[data-id="${id}"]`);
    if (el) el.classList.toggle('selected', selectedGalItems.has(id));
  } else {
    openGalleryModal(id);
  }
}

function clearSelection() {
  selectedGalItems.forEach(id => {
    const el = document.querySelector(`.gal-item[data-id="${id}"]`);
    if (el) el.classList.remove('selected');
  });
  selectedGalItems.clear();
  document.getElementById('galBulk').classList.remove('show');
}


function selectAllVisible() {
  document.querySelectorAll('#galGrid .gal-item').forEach(el => {
    const id = el.dataset.id;
    if (id) { selectedGalItems.add(id); el.classList.add('selected'); }
  });
  const count = selectedGalItems.size;
  if (count > 0) {
    document.getElementById('galBulk').classList.add('show');
    document.getElementById('selCount').textContent = count;
    updateBulkFolderSelect();
  }
}

async function deleteSelected() {
  if (!selectedGalItems.size) return;
  const count = selectedGalItems.size;
  if (!confirm(`Delete ${count} images?`)) return;
  for (const id of selectedGalItems) {
    await dbDelete('images', id);
    await dbDeleteMeta(id);
    await dbDelete('thumbs', id);
    thumbMemCache.delete(id);
  }
  selectedGalItems.clear();
  document.getElementById('galBulk').classList.remove('show');
  refreshGalleryUI();
  toast(`${count} images deleted`, 'ok');
}

// Aktualizovat bulk folder select při zobrazení (stale, kept for compat)
async function updateBulkFolderSelect() {}

async function moveSelectedGalleryToFolder() {
  const folders = await dbGetAll('folders');
  if (!folders.length) { toast('Create a folder first', 'err'); return; }
  const folderId = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);padding:20px;min-width:280px;display:flex;flex-direction:column;gap:8px;">
      <div style="font-family:Syne,sans-serif;font-weight:700;font-size:14px;margin-bottom:4px;">▷ Move ${selectedGalItems.size} images</div>
      ${folders.map(f=>`<button class="ibtn" data-fid="${f.id}" style="justify-content:flex-start;padding:8px 12px;">${f.name}</button>`).join('')}
      <button class="ibtn" data-fid="all" style="justify-content:flex-start;padding:8px 12px;opacity:.7;">◈ All (no folder)</button>
      <button class="ibtn" id="_cancelMoveGal" style="margin-top:4px;">Cancel</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-fid]').forEach(btn => btn.onclick = () => { document.body.removeChild(ov); resolve(btn.dataset.fid); });
    ov.querySelector('#_cancelMoveGal').onclick = () => { document.body.removeChild(ov); resolve(null); };
    ov.onclick = e => { if (e.target === ov) { document.body.removeChild(ov); resolve(null); } };
  });
  if (!folderId) return;
  let count = 0;
  await Promise.all([...selectedGalItems].map(id => dbPatchMeta(id, { folder: folderId })));
  count = selectedGalItems.size;
  clearSelection();
  refreshGalleryUI();
  toast(`Moved ${count} images ✓`, 'ok');
}

async function moveSelectedToFolder(folderId) {
  if (!folderId || !selectedGalItems.size) return;
  await Promise.all([...selectedGalItems].map(id => dbPatchMeta(id, { folder: folderId })));
  clearSelection();
  refreshGalleryUI();
  toast(`Moved ✓`, 'ok');
}

async function batchUpscaleSelected() {
  const ids = [...selectedGalItems];
  if (!ids.length) return;

  const falKey = document.getElementById('fluxApiKey')?.value?.trim() || '';
  const freepikKey = (localStorage.getItem('gis_freepik_apikey') || '').trim();
  const proxyUrl = (localStorage.getItem('gis_proxy_url') || '').trim().replace(/\/$/, '');

  // Zobraz dialog jednou — uživatel nastaví parametry pro všechny
  const result = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:400;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:var(--s1);border:1px solid var(--border);padding:20px;width:340px;max-height:90vh;overflow-y:auto;">
        <div style="font-family:Syne,sans-serif;font-weight:700;font-size:15px;margin-bottom:4px;">⬆ Batch Upscale</div>
        <div style="font-size:11px;color:var(--dim);margin-bottom:16px;">Selected images: <b style="color:var(--accent);">${ids.length}</b> — same settings for all</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:8px;">Mode</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--purple);cursor:pointer;font-size:11px;color:var(--purple);" id="bupMode_crisp_lbl">
            <input type="radio" name="bupMode" value="crisp" checked style="margin-top:2px;accent-color:var(--purple);">
            <div><div style="font-weight:600;">Recraft Crisp <span style="color:var(--dim2);font-weight:400;">— $0.004/img</span></div>
            <div style="color:var(--dim2);margin-top:2px;">Fast, faithful — ideal for photos</div></div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);" id="bupMode_seedvr_lbl">
            <input type="radio" name="bupMode" value="seedvr" style="margin-top:2px;accent-color:var(--purple);">
            <div><div style="font-weight:600;color:var(--text);">SeedVR2 <span style="color:var(--dim2);font-weight:400;">— $0.001/MP</span></div>
            <div style="color:var(--dim2);margin-top:2px;">Target output resolution</div></div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);" id="bupMode_clarity_lbl">
            <input type="radio" name="bupMode" value="clarity" style="margin-top:2px;accent-color:var(--purple);">
            <div><div style="font-weight:600;color:var(--text);">Clarity Upscaler <span style="color:var(--dim2);font-weight:400;">— compute</span></div>
            <div style="color:var(--dim2);margin-top:2px;">AI detail enhancement</div></div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);" id="bupMode_magnific_lbl">
            <input type="radio" name="bupMode" value="magnific" style="margin-top:2px;accent-color:var(--purple);">
            <div><div style="font-weight:600;color:var(--text);">Magnific Creative <span style="color:var(--dim2);font-weight:400;">— €0.10–0.50/img · proxy ✦</span></div>
            <div style="color:var(--dim2);margin-top:2px;">Prompt-guided, 3 engines, creative detail</div></div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);" id="bupMode_magnific_prec_lbl">
            <input type="radio" name="bupMode" value="magnific_prec" style="margin-top:2px;accent-color:var(--purple);">
            <div><div style="font-weight:600;color:var(--text);">Magnific Precision <span style="color:var(--dim2);font-weight:400;">— proxy ✦</span></div>
            <div style="color:var(--dim2);margin-top:2px;">Faithful upscaling — no hallucinations, faithful to original</div></div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);" id="bupMode_topaz_gigapixel_lbl">
            <input type="radio" name="bupMode" value="topaz_gigapixel" style="margin-top:2px;accent-color:var(--purple);">
            <div><div style="font-weight:600;color:var(--text);">Topaz Gigapixel <span style="color:var(--dim2);font-weight:400;">— $0.005/img · proxy ✦</span></div>
            <div style="color:var(--dim2);margin-top:2px;">Best for photography, max fidelity</div></div>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);" id="bupMode_topaz_bloom_lbl">
            <input type="radio" name="bupMode" value="topaz_bloom" style="margin-top:2px;accent-color:var(--purple);">
            <div><div style="font-weight:600;color:var(--text);">Topaz Bloom / Wonder 2 <span style="color:var(--dim2);font-weight:400;">— $0.005/img · proxy ✦</span></div>
            <div style="color:var(--dim2);margin-top:2px;">Creative generative upscaling, AI-generated detail</div></div>
          </label>
        </div>
        <!-- SeedVR options -->
        <div id="bupSeedvrOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Target resolution</div>
          <div style="display:flex;gap:6px;">
            ${['720p','1080p','1440p','2160p'].map(v=>`<label id="bupSvRes_${v}" style="flex:1;text-align:center;padding:5px 0;border:1px solid ${v==='1080p'?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${v==='1080p'?'var(--purple)':'var(--dim)'};">
              <input type="radio" name="bupSvRes" value="${v}" ${v==='1080p'?'checked':''} style="display:none;">${v}
            </label>`).join('')}
          </div>
        </div>
        <!-- Clarity options -->
        <div id="bupClarityOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Factor <span style="color:var(--dim2);text-transform:none;letter-spacing:0;font-weight:400;">(max 4× — fal.ai limit)</span></div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${['2','4'].map(f=>`<label style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);">
              <input type="radio" name="bupFactor" value="${f}" ${f==='2'?'checked':''} style="display:none;">${f}×
            </label>`).join('')}
          </div>
          <div style="display:flex;gap:12px;">
            <div style="flex:1;"><div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Creativity <span id="bupCreativityVal" style="color:var(--accent);">0.35</span></div>
              <input type="range" id="bupCreativity" min="0" max="1" step="0.05" value="0.35" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupCreativityVal').textContent=parseFloat(this.value).toFixed(2)"></div>
            <div style="flex:1;"><div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Resemblance <span id="bupResemblanceVal" style="color:var(--accent);">0.6</span></div>
              <input type="range" id="bupResemblance" min="0" max="1" step="0.05" value="0.6" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupResemblanceVal').textContent=parseFloat(this.value).toFixed(2)"></div>
          </div>
          <div style="margin-top:10px;"><div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Steps <span id="bupStepsVal" style="color:var(--accent);">18</span></div>
            <input type="range" id="bupSteps" min="10" max="50" step="1" value="18" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupStepsVal').textContent=this.value"></div>
        </div>
        <!-- Magnific options -->
        <div id="bupMagnificOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Scale factor</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${['2x','4x','8x','16x'].map((f,i)=>`<label id="bupMagFactor_${f}" style="flex:1;text-align:center;padding:5px 0;border:1px solid ${i===1?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===1?'var(--purple)':'var(--dim)'};">
              <input type="radio" name="bupMagFactor" value="${f}" ${i===1?'checked':''} style="display:none;">${f}
            </label>`).join('')}
          </div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Engine</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${[['magnific_sparkle','Sparkle'],['magnific_sharpy','Sharpy'],['magnific_illusio','Illusio']].map(([v,l],i)=>`<label id="bupMagEngine_${i}" style="flex:1;text-align:center;padding:5px 2px;border:1px solid ${i===0?'var(--purple)':'var(--border)'};cursor:pointer;font-size:11px;color:${i===0?'var(--purple)':'var(--dim)'};">
              <input type="radio" name="bupMagEngine" value="${v}" ${i===0?'checked':''} style="display:none;">${l}
            </label>`).join('')}
          </div>
          <select id="bupMagOptFor" style="width:100%;background:var(--bg2);color:var(--fg);border:1px solid var(--border);padding:6px 8px;font-family:'IBM Plex Mono',monospace;font-size:11px;outline:none;margin-bottom:8px;">
            <option value="standard" selected>Standard</option>
            <option value="portrait">Portrait</option>
            <option value="3d">3D</option>
            <option value="game-assets">Game Assets</option>
            <option value="illustration">Illustration</option>
          </select>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Creativity <span id="bupMagCreativityVal" style="color:var(--accent);">2</span></div>
              <input type="range" id="bupMagCreativity" min="-3" max="3" step="1" value="2" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupMagCreativityVal').textContent=this.value"></div>
            <div><div style="font-size:10px;color:var(--dim);margin-bottom:3px;">HDR <span id="bupMagHdrVal" style="color:var(--accent);">0</span></div>
              <input type="range" id="bupMagHdr" min="-3" max="3" step="1" value="0" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupMagHdrVal').textContent=this.value"></div>
            <div><div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Resemblance <span id="bupMagResemblanceVal" style="color:var(--accent);">0</span></div>
              <input type="range" id="bupMagResemblance" min="-3" max="3" step="1" value="0" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupMagResemblanceVal').textContent=this.value"></div>
            <div><div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Fractality <span id="bupMagFractalityVal" style="color:var(--accent);">-1</span></div>
              <input type="range" id="bupMagFractality" min="-3" max="3" step="1" value="-1" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupMagFractalityVal').textContent=this.value"></div>
          </div>
        </div>
        <!-- Magnific Precision options -->
        <div id="bupMagnificPrecOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Version</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
            <label id="bupMagPrecV_v2_sublime" style="flex:1;min-width:70px;text-align:center;padding:5px 2px;border:1px solid var(--purple);cursor:pointer;font-size:10px;color:var(--purple);">
              <input type="radio" name="bupMagPrecV" value="v2_sublime" checked style="display:none">V2 Sublime</label>
            <label id="bupMagPrecV_v2_photo" style="flex:1;min-width:70px;text-align:center;padding:5px 2px;border:1px solid var(--border);cursor:pointer;font-size:10px;color:var(--dim);">
              <input type="radio" name="bupMagPrecV" value="v2_photo" style="display:none">V2 Photo</label>
            <label id="bupMagPrecV_v2_photo_denoiser" style="flex:1;min-width:70px;text-align:center;padding:5px 2px;border:1px solid var(--border);cursor:pointer;font-size:10px;color:var(--dim);">
              <input type="radio" name="bupMagPrecV" value="v2_photo_denoiser" style="display:none">V2 Denoise</label>
            <label id="bupMagPrecV_v1_hdr" style="flex:1;min-width:70px;text-align:center;padding:5px 2px;border:1px solid var(--border);cursor:pointer;font-size:10px;color:var(--dim);">
              <input type="radio" name="bupMagPrecV" value="v1_hdr" style="display:none">V1 HDR</label>
          </div>
          <div id="bupMagPrecScaleWrap" style="margin-bottom:8px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Scale</div>
            <div style="display:flex;gap:6px;">
              <label id="bupMagPrecScale_2" style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--purple);cursor:pointer;font-size:11px;color:var(--purple);">
                <input type="radio" name="bupMagPrecScale" value="2" checked style="display:none">2×</label>
              <label id="bupMagPrecScale_4" style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);">
                <input type="radio" name="bupMagPrecScale" value="4" style="display:none">4×</label>
              <label id="bupMagPrecScale_8" style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);">
                <input type="radio" name="bupMagPrecScale" value="8" style="display:none">8×</label>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div><div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Sharpen <span id="bupMagPrecSharpenVal" style="color:var(--accent);">7</span></div>
              <input type="range" id="bupMagPrecSharpen" min="0" max="100" step="1" value="7" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupMagPrecSharpenVal').textContent=this.value"></div>
            <div><div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Grain <span id="bupMagPrecGrainVal" style="color:var(--accent);">7</span></div>
              <input type="range" id="bupMagPrecGrain" min="0" max="100" step="1" value="7" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupMagPrecGrainVal').textContent=this.value"></div>
            <div><div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Detail <span id="bupMagPrecDetailVal" style="color:var(--accent);">30</span></div>
              <input type="range" id="bupMagPrecDetail" min="0" max="100" step="1" value="30" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupMagPrecDetailVal').textContent=this.value"></div>
          </div>
        </div>
        <!-- Topaz options -->
        <div id="bupTopazOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Scale factor</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            <label id="bupTopazFactor_2" style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--purple);cursor:pointer;font-size:11px;color:var(--purple);">
              <input type="radio" name="bupTopazFactor" value="2" checked style="display:none">2×</label>
            <label id="bupTopazFactor_4" style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);">
              <input type="radio" name="bupTopazFactor" value="4" style="display:none">4×</label>
            <label id="bupTopazFactor_6" style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);">
              <input type="radio" name="bupTopazFactor" value="6" style="display:none">6×</label>
          </div>
          <div><div style="font-size:10px;color:var(--dim);margin-bottom:3px;">Creativity <span id="bupTopazCreativityVal" style="color:var(--accent);">50</span> <span style="color:var(--dim2);">(Bloom/Wonder 2 only)</span></div>
            <input type="range" id="bupTopazCreativity" min="0" max="100" step="1" value="50" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('bupTopazCreativityVal').textContent=this.value">
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="ibtn" id="bupConfirm" style="flex:1;justify-content:center;padding:10px;border-color:var(--purple);color:var(--purple);">▶ Run ${ids.length}× upscale</button>
          <button class="ibtn" id="bupCancel" style="justify-content:center;padding:10px;">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Mode toggle
    overlay.querySelectorAll('input[name="bupMode"]').forEach(r => r.addEventListener('change', () => {
      const sel = overlay.querySelector('input[name="bupMode"]:checked')?.value;
      ['crisp','seedvr','clarity','magnific','magnific_prec','topaz_gigapixel','topaz_bloom'].forEach(m => {
        const lbl = overlay.querySelector(`#bupMode_${m}_lbl`);
        if (lbl) { lbl.style.borderColor = sel===m ? 'var(--purple)' : 'var(--border)'; lbl.style.color = sel===m ? 'var(--purple)' : 'var(--dim)'; }
      });
      overlay.querySelector('#bupSeedvrOpts').style.display       = sel==='seedvr'          ? 'block' : 'none';
      overlay.querySelector('#bupClarityOpts').style.display      = sel==='clarity'         ? 'block' : 'none';
      overlay.querySelector('#bupMagnificOpts').style.display     = sel==='magnific'        ? 'block' : 'none';
      overlay.querySelector('#bupMagnificPrecOpts').style.display = sel==='magnific_prec'   ? 'block' : 'none';
      overlay.querySelector('#bupTopazOpts').style.display        = (sel==='topaz_gigapixel'||sel==='topaz_bloom') ? 'block' : 'none';
      // V1 HDR has no scale factor
      if (sel === 'magnific_prec') {
        const precV = overlay.querySelector('input[name="bupMagPrecV"]:checked')?.value || 'v2_sublime';
        const scaleWrap = overlay.querySelector('#bupMagPrecScaleWrap');
        if (scaleWrap) scaleWrap.style.display = precV === 'v1_hdr' ? 'none' : '';
      }
    }));
    // Precision version toggle — hide scale for V1
    overlay.querySelectorAll('input[name="bupMagPrecV"]').forEach(r => r.addEventListener('change', () => {
      ['v2_sublime','v2_photo','v2_photo_denoiser','v1_hdr'].forEach(v => {
        const lbl = overlay.querySelector(`#bupMagPrecV_${v}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
      const scaleWrap = overlay.querySelector('#bupMagPrecScaleWrap');
      const isV1 = overlay.querySelector('input[name="bupMagPrecV"]:checked')?.value === 'v1_hdr';
      if (scaleWrap) scaleWrap.style.display = isV1 ? 'none' : '';
    }));
    overlay.querySelectorAll('input[name="bupMagPrecScale"]').forEach(r => r.addEventListener('change', () => {
      [2,4,8].forEach(f => {
        const lbl = overlay.querySelector(`#bupMagPrecScale_${f}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="bupTopazFactor"]').forEach(r => r.addEventListener('change', () => {
      [2,4,6].forEach(f => {
        const lbl = overlay.querySelector(`#bupTopazFactor_${f}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="bupSvRes"]').forEach(r => r.addEventListener('change', () => {
      ['720p','1080p','1440p','2160p'].forEach(v => {
        const lbl = overlay.querySelector(`#bupSvRes_${v}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="bupMagFactor"]').forEach(r => r.addEventListener('change', () => {
      ['2x','4x','8x','16x'].forEach(f => {
        const lbl = overlay.querySelector(`#bupMagFactor_${f}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="bupMagEngine"]').forEach(r => r.addEventListener('change', () => {
      [0,1,2].forEach(i => {
        const lbl = overlay.querySelector(`#bupMagEngine_${i}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));

    overlay.querySelector('#bupConfirm').onclick = () => {
      const mode        = overlay.querySelector('input[name="bupMode"]:checked')?.value || 'crisp';
      const factor      = parseInt(overlay.querySelector('input[name="bupFactor"]:checked')?.value || '2');
      const seedvrRes   = overlay.querySelector('input[name="bupSvRes"]:checked')?.value || '1080p';
      const creativity  = parseFloat(overlay.querySelector('#bupCreativity')?.value || '0.35');
      const resemblance = parseFloat(overlay.querySelector('#bupResemblance')?.value || '0.6');
      const claritySteps = parseInt(overlay.querySelector('#bupSteps')?.value || '18');
      const magFactor   = overlay.querySelector('input[name="bupMagFactor"]:checked')?.value || '2x';
      const magEngine   = overlay.querySelector('input[name="bupMagEngine"]:checked')?.value || 'magnific_sparkle';
      const magOptFor   = overlay.querySelector('#bupMagOptFor')?.value || 'standard';
      const magCreativity  = parseInt(overlay.querySelector('#bupMagCreativity')?.value || '2');
      const magHdr         = parseInt(overlay.querySelector('#bupMagHdr')?.value || '0');
      const magResemblance = parseInt(overlay.querySelector('#bupMagResemblance')?.value || '0');
      const magFractality  = parseInt(overlay.querySelector('#bupMagFractality')?.value || '-1');
      // Precision
      const magPrecVersion = overlay.querySelector('input[name="bupMagPrecV"]:checked')?.value || 'v2_sublime';
      const magPrecScale   = parseInt(overlay.querySelector('input[name="bupMagPrecScale"]:checked')?.value || '2');
      const magPrecSharpen = parseInt(overlay.querySelector('#bupMagPrecSharpen')?.value || '7');
      const magPrecGrain   = parseInt(overlay.querySelector('#bupMagPrecGrain')?.value || '7');
      const magPrecDetail  = parseInt(overlay.querySelector('#bupMagPrecDetail')?.value || '30');
      // Topaz
      const topazFactor    = parseInt(overlay.querySelector('input[name="bupTopazFactor"]:checked')?.value || '2');
      const topazCreativity= parseInt(overlay.querySelector('#bupTopazCreativity')?.value || '50');
      document.body.removeChild(overlay);
      resolve({ confirmed: true, mode, factor, seedvrRes, creativity, resemblance, claritySteps,
        magFactor, magEngine, magOptFor, magCreativity, magHdr, magResemblance, magFractality,
        magPrecVersion, magPrecScale, magPrecSharpen, magPrecGrain, magPrecDetail,
        topazFactor, topazCreativity });
    };
    overlay.querySelector('#bupCancel').onclick = () => { document.body.removeChild(overlay); resolve({ confirmed: false }); };
    overlay.onclick = e => { if (e.target === overlay) { document.body.removeChild(overlay); resolve({ confirmed: false }); } };
  });

  if (!result.confirmed) return;

  if (result.mode === 'magnific' || result.mode === 'magnific_prec') {
    if (!freepikKey) { toast('Freepik API key missing — enter it in Setup tab', 'err'); return; }
    if (!proxyUrl)   { toast('Proxy URL missing — enter it in Setup tab', 'err'); return; }
  } else if (result.mode === 'topaz_gigapixel' || result.mode === 'topaz_bloom') {
    const topazKey = localStorage.getItem('gis_topaz_apikey') || '';
    if (!topazKey)   { toast('Topaz API key missing — enter it in Setup tab', 'err'); return; }
    if (!proxyUrl)   { toast('Proxy URL missing — enter it in Setup tab', 'err'); return; }
  } else {
    if (!falKey) { toast('fal.ai key missing — enter it in the header', 'err'); return; }
  }

  const { mode, factor, seedvrRes, creativity, resemblance, claritySteps,
    magFactor, magEngine, magOptFor, magCreativity, magHdr, magResemblance, magFractality,
    magPrecVersion, magPrecScale, magPrecSharpen, magPrecGrain, magPrecDetail,
    topazFactor, topazCreativity } = result;

  const modeLabel = mode === 'crisp'           ? 'Recraft Crisp'
    : mode === 'seedvr'                        ? `SeedVR2 ${seedvrRes}`
    : mode === 'magnific'                      ? `Magnific ${magFactor}`
    : mode === 'magnific_prec'                 ? `Magnific Prec ${magPrecVersion}`
    : mode === 'topaz_gigapixel'               ? `Topaz Gigapixel ${topazFactor}×`
    : mode === 'topaz_bloom'                   ? `Topaz Bloom ${topazFactor}×`
    : `Clarity ${factor}×`;

  let queued = 0;
  let skipped = 0;
  for (const id of ids) {
    const item = await dbGet('images', id);
    if (!item?.imageData) continue;
    const dims = item.dims ? parseDimsStr(item.dims) : { w: 0, h: 0 };
    const upscaleLabel = `[Batch ⬆ ${modeLabel}] ${item.dims || ''}`;
    const job = {
      id: Date.now() + '_bup_' + Math.random().toString(36).substr(2,6),
      status: 'pending',
      label: upscaleLabel,
      modelId: 'fal_upscale',
      isUpscale: true,
      upscaleMode: mode,
      upscaleFactor: factor,
      upscalePrompt: 'masterpiece, best quality, highres',
      upscaleCreativity: creativity,
      upscaleResemblance: resemblance,
      upscaleSeedvrRes: seedvrRes,
      upscaleNoiseScale: 0.1,
      upscaleSteps: claritySteps,
      magFactor, magEngine, magOptFor, magPrompt: '',
      magCreativity, magHdr, magResemblance, magFractality,
      magMode: mode === 'magnific_prec' ? 'precision' : 'creative',
      magPrecVersion, magPrecScale, magPrecSharpen, magPrecGrain, magPrecDetail,
      tGigaFactor: topazFactor, tBloomFactor: topazFactor,
      tGigaCreativity: topazCreativity, tBloomCreativity: topazCreativity,
      freepikKey, proxyUrl,
      b64data: item.imageData,
      currentDims: dims,
      falKey,
      prompt: upscaleLabel,
    };
    jobQueue.push(job);
    queued++;
  }

  clearSelection();
  renderQueue();
  tryStartJobs();
  toast(`${queued} upscale jobs added to queue ✓`, queued > 0 ? 'ok' : 'err');
}


// ── Context menu ──
let ctxTargetId = null;

async function showCtxMenu(e, id) {
  e.preventDefault();
  e.stopPropagation();
  ctxTargetId = id;
  const folders = await dbGetAll('folders');
  const menu = document.getElementById('ctxMenu');

  // Složky
  const folderItems = document.getElementById('ctxFolderItems');
  if (folders.length) {
    folderItems.innerHTML = folders.map(f =>
      `<div class="ctx-item" data-fid="${f.id}">▷ ${f.name}</div>`
    ).join('') + '<div class="ctx-item" data-fid="all">◈ All (no folder)</div>';
    folderItems.querySelectorAll('.ctx-item').forEach(el => {
      el.onclick = async () => {
        await dbPatchMeta(ctxTargetId, { folder: el.dataset.fid });
        closeCtxMenu();
        refreshGalleryUI();
        toast('Moved', 'ok');
      };
    });
  } else {
    folderItems.innerHTML = '<div class="ctx-item" style="opacity:.4;cursor:default">No folders — create the first one</div>';
  }

  // Akce
  document.getElementById('ctxAnnotate').onclick = () => {
    closeCtxMenu();
    dbGet('images', ctxTargetId).then(item => {
      if (item) openAnnotateModal(item.imageData, item.model);
    });
  };
  document.getElementById('ctxAddRef').onclick = () => {
    closeCtxMenu();
    dbGet('images', ctxTargetId).then(item => {
      if (item) addRefFromBase64(item.imageData, `${item.model}-${item.id}.png`);
    });
  };
  document.getElementById('ctxSaveAsset').onclick = () => {
    closeCtxMenu();
    dbGet('images', ctxTargetId).then(async item => {
      if (!item) return;
      const alreadyExists = !!(await findAssetByFingerprint(item.imageData));
      const asset = await createAsset(item.imageData, 'image/png', 'generated', item.id);
      const msg = alreadyExists ? `Already in Assets as ${asset.autoName}` : `Saved to Assets as ${asset.autoName}`;
      toast(msg, 'ok');
    });
  };
  document.getElementById('ctxDelete').onclick = async () => {
    closeCtxMenu();
    if (!confirm('Delete image?')) return;
    const delId = ctxTargetId;
    await dbDelete('images', delId);
    await dbDeleteMeta(delId);
    await dbDelete('thumbs', delId);
    thumbMemCache.delete(delId);
    refreshGalleryUI();
    toast('Deleted', 'ok');
  };

  // Pozice — zabránit přetečení z obrazovky
  menu.classList.add('show');
  const mr = menu.getBoundingClientRect();
  let x = e.clientX, y = e.clientY;
  if (x + mr.width > window.innerWidth) x = window.innerWidth - mr.width - 8;
  if (y + mr.height > window.innerHeight) y = window.innerHeight - mr.height - 8;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function closeCtxMenu() {
  document.getElementById('ctxMenu').classList.remove('show');
  ctxTargetId = null;
}

// ═══════════════════════════════════════════════════════
// FOLDERS
// ═══════════════════════════════════════════════════════

// Sync render — přijme již načtená data, žádný DB call
function renderFoldersSync(folders, allItems) {
  const allCount = allItems.length;
  const favCount = allItems.filter(i => i.favorite).length;
  const list = document.getElementById('folderList');
  const allActive = currentFolder === 'all';
  const favActive = currentFolder === 'fav';
  const dragAttrs = (fid) => `ondragover="folderDragOver(event)" ondragenter="folderDragEnter(event,this)" ondragleave="folderDragLeave(event,this)" ondrop="folderDrop(event,'${fid}')"`;
  let html = `<div class="folder-item ${allActive ? 'active' : ''}" onclick="setFolder('all')" ${dragAttrs('all')}><span class="fi">◈</span> All <span class="fc">${allCount}</span></div>`;
  html += `<div class="folder-item ${favActive ? 'active' : ''}" onclick="setFolder('fav')" style="color:${favActive ? 'var(--accent)' : ''};"><span class="fi">♥</span> Favorites <span class="fc">${favCount}</span></div>`;
  for (const f of folders) {
    const count = allItems.filter(i => i.folder === f.id).length;
    const active = currentFolder === f.id;
    html += `<div class="folder-item ${active ? 'active' : ''}" onclick="setFolder('${f.id}')" ${dragAttrs(f.id)}>
      <span class="fi">▷</span> ${f.name} <span class="fc">${count}</span>
      <button class="folder-del" onclick="deleteFolder(event,'${f.id}')">×</button>
    </div>`;
  }
  list.innerHTML = html;
}

// Async wrapper — použij jen pokud nemáš data po ruce
async function renderFolders() {
  const [folders, allItems] = await Promise.all([dbGetAll('folders'), dbGetAllMeta()]);
  renderFoldersSync(folders, allItems);
}

async function updateTargetFolderSelect() {
  const folders = await dbGetAll('folders');
  const sel = document.getElementById('targetFolder');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="all">◈ All (no folder)</option>' +
    folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  // Zachovat výběr pokud složka stále existuje
  if (current && [...sel.options].some(o => o.value === current)) sel.value = current;
}

async function addFolder() {
  const name = prompt('New folder name:');
  if (!name || !name.trim()) return;
  const id = 'f_' + Date.now();
  await dbPut('folders', { id, name: name.trim() });
  renderFolders(); // async wrapper — jen folder list, galerie se nemění
  updateTargetFolderSelect();
}

async function deleteFolder(e, id) {
  e.stopPropagation();

  // Immediately red-highlight the folder row so user knows deletion started
  const folderEl = e.target.closest('.folder-item');
  if (folderEl) {
    folderEl.style.background = 'rgba(200,60,60,.18)';
    folderEl.style.color = '#e07070';
    folderEl.style.pointerEvents = 'none';
  }

  const metas = await dbGetAllMeta();
  const toReset = metas.filter(m => m.folder === id);
  await Promise.all(toReset.map(m => dbPatchMeta(m.id, { folder: 'all' })));
  await dbDelete('folders', id);
  if (currentFolder === id) currentFolder = 'all';
  invalidateMetaCache();
  updateTargetFolderSelect();
  refreshGalleryUI();
}

// Přepnutí složky — jeden dbGetAllMeta call, sdílený pro folders i gallery
async function setFolder(id) {
  currentFolder = id;
  const [folders, allItems] = await Promise.all([dbGetAll('folders'), dbGetAllMeta()]);
  renderFoldersSync(folders, allItems);
  await renderGalleryWithItems(allItems);
}

// Helper: obnov folders + gallery jedním společným DB read
// Používat místo dvojice renderFolders() + renderGallery()
async function refreshGalleryUI() {
  const [folders, allItems] = await Promise.all([dbGetAll('folders'), dbGetAllMeta()]);
  renderFoldersSync(folders, allItems);
  await renderGalleryWithItems(allItems);
}

// ═══════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════
async function openGalleryModal(id) {
  const item = await dbGet('images', id);
  if (!item) return;
  currentModalId = id;

  const src = `data:image/png;base64,${item.imageData}`;
  document.getElementById('modalImg').src = src;
  document.getElementById('mModel').textContent = item.model;
  document.getElementById('mDate').textContent = new Date(item.ts).toLocaleString('cs');
  document.getElementById('mPrompt').textContent = item.prompt;
  const paramsText = JSON.stringify(item.params, null, 1).replace(/[{}"]/g, '').trim();
  document.getElementById('mParams').textContent = (item.dims ? `resolution: ${item.dims}\n` : '') + paramsText;

  // Thinking log
  const thinkRow = document.getElementById('mThinkRow');
  const thinkEl = document.getElementById('mThink');
  if (item.thoughtText) {
    thinkEl.textContent = item.thoughtText;
    thinkRow.style.display = '';
  } else {
    thinkRow.style.display = 'none';
  }

  // Folder select
  const folders = await dbGetAll('folders');
  const fs = document.getElementById('mFolder');
  fs.innerHTML = `<option value="all">— All —</option>` + folders.map(f => `<option value="${f.id}" ${item.folder === f.id ? 'selected' : ''}>${f.name}</option>`).join('');

  // Actions — use proper event delegation, no inline attributes
  const actionsEl = document.getElementById('modalActions');
  const isFav = item.favorite || false;
  actionsEl.innerHTML = `
    <a class="ibtn" href="${src}" download="${item.model}-${item.id}.png">↓ PNG</a>
    <button class="ibtn" id="mFavBtn" style="border-color:${isFav ? '#ff4d6d' : 'var(--border)'};color:${isFav ? '#ff4d6d' : 'var(--dim)'};">${isFav ? '♥ Favorites' : '♡ Favorite'}</button>
    <button class="ibtn upscale-btn" id="mUpscaleBtn">⬆ Upscale</button>
    <button class="ibtn" id="mAddRefBtn" style="border-color:#4a5a8a;color:#88aaff" title="Přidat jako ref + uložit do Assets">⊕ Ref &amp; Assets</button>
    <button class="ibtn" id="mSaveAssetBtn" style="border-color:#4a7a4a;color:#aaffaa" title="Uložit pouze do Assets">📎 Assets</button>
    <button class="ibtn" id="mAnnotateBtn" style="border-color:#6a4a3a;color:#ff9966">✏ Annotate</button>
    <button class="ibtn reuse-btn" id="mReuseBtn">↺ Reuse params</button>
    <button class="ibtn danger" id="mDeleteBtn">✕ Delete</button>
  `;
  actionsEl.querySelector('#mFavBtn').onclick = async () => {
    await toggleFavoriteItem(id);
    openGalleryModal(id);
  };
  actionsEl.querySelector('#mDeleteBtn').onclick = () => deleteGalItem(id);
  actionsEl.querySelector('#mAddRefBtn').onclick = () => {
    addRefFromBase64(item.imageData, `${item.model}-${item.id}.png`);
    closeModal();
  };
  actionsEl.querySelector('#mSaveAssetBtn').onclick = async () => {
    const alreadyExists = !!(await findAssetByFingerprint(item.imageData));
    const asset = await createAsset(item.imageData, 'image/png', 'generated', item.id);
    closeModal();
    toast(alreadyExists ? `Already in Assets as ${asset.autoName}` : `Saved to Assets as ${asset.autoName}`, 'ok');
  };
  actionsEl.querySelector('#mAnnotateBtn').onclick = () => {
    closeModal();
    openAnnotateModal(item.imageData, item.model);
  };
  actionsEl.querySelector('#mReuseBtn').onclick = () => {
    closeModal();
    reuseJobFromGallery(item);
  };
  actionsEl.querySelector('#mUpscaleBtn').onclick = async () => {
    const dims = await getImageDimensions(item.imageData);
    closeModal();
    upscaleWithFactor(item.imageData, dims);
  };

  await updateGalleryIds();
  updateModalNavButtons();
  modalOpenedAt = Date.now();
  document.getElementById('modal').classList.add('show');
}

// Aktuální seznam ID v galerii pro navigaci
let currentGalleryIds = [];

async function updateGalleryIds() {
  let items = await dbGetAllMeta();
  const q = document.getElementById('galSearch')?.value?.toLowerCase() || '';
  const sort = document.getElementById('galSort')?.value || 'newest';
  if (currentFolder === 'fav') items = items.filter(i => i.favorite);
  else if (currentFolder !== 'all') items = items.filter(i => i.folder === currentFolder);
  if (q) items = items.filter(i => i.prompt.toLowerCase().includes(q));
  // Pro sort by folder načteme folder names
  let folderMap = {};
  if (sort === 'folder') {
    const folders = await dbGetAll('folders');
    folderMap = Object.fromEntries(folders.map(f => [f.id, f.name]));
  }
  if (sort === 'favorites') items = items.filter(i => i.favorite);
  if (sort === 'newest' || sort === 'favorites') items.sort((a,b) => b.ts - a.ts);
  else if (sort === 'oldest') items.sort((a,b) => a.ts - b.ts);
  else if (sort === 'folder') items.sort((a,b) => {
    const fa = folderMap[a.folder] || (a.folder === 'all' ? '~All' : a.folder);
    const fb = folderMap[b.folder] || (b.folder === 'all' ? '~All' : b.folder);
    return fa.localeCompare(fb) || b.ts - a.ts;
  });
  else items.sort((a,b) => a.model.localeCompare(b.model));
  currentGalleryIds = items.map(i => i.id);
}

async function navigateModal(dir) {
  if (!currentModalId || !currentGalleryIds.length) return;
  const idx = currentGalleryIds.indexOf(currentModalId);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= currentGalleryIds.length) return;
  await openGalleryModal(currentGalleryIds[newIdx]);
}

function updateModalNavButtons() {
  const idx = currentGalleryIds.indexOf(currentModalId);
  const total = currentGalleryIds.length;
  const prev = document.getElementById('modalPrev');
  const next = document.getElementById('modalNext');
  const hint = document.getElementById('modalNavHint');
  if (prev) prev.disabled = idx <= 0;
  if (next) next.disabled = idx >= total - 1;
  if (hint && total > 0) hint.textContent = `${idx + 1} / ${total} · arrow keys ← → to navigate`;
}

function openModal(src) {
  document.getElementById('modalImg').src = src;
  document.getElementById('mModel').textContent = '—';
  document.getElementById('mDate').textContent = '—';
  document.getElementById('mPrompt').textContent = '—';
  document.getElementById('mParams').textContent = '—';
  document.getElementById('modalActions').innerHTML = `<a class="ibtn" href="${src}" download="image.png">↓ Download</a>`;
  document.getElementById('modal').classList.add('show');
}

let modalOpenedAt = 0;
const MODAL_GRACE_MS = 400; // ignoruj zavírání prvních 400ms po otevření

function closeModal(e) {
  if (Date.now() - modalOpenedAt < MODAL_GRACE_MS) return; // grace period
  if (!e || e.target === document.getElementById('modal') || e.target.classList.contains('modal-close')) {
    document.getElementById('modal').classList.remove('show');
    currentModalId = null;
  }
}

async function moveItemToFolder() {
  if (!currentModalId) return;
  const newFolder = document.getElementById('mFolder').value;
  await dbPatchMeta(currentModalId, { folder: newFolder });
  refreshGalleryUI();
  toast('Moved', 'ok');
}

async function deleteGalItem(id) {
  if (!confirm('Delete image?')) return;
  await dbDelete('images', id);
  await dbDeleteMeta(id);
  await dbDelete('thumbs', id);
  thumbMemCache.delete(id);
  closeModal();
  refreshGalleryUI();
  toast('Deleted', 'ok');
}

// ═══════════════════════════════════════════════════════
// REUSE JOB
// ═══════════════════════════════════════════════════════
// Nastaví aspectRatio select pouze pro platné hodnoty (ne pixel ratia jako 1472:832)
function setAspectRatioSafe(val) {
  const sel = document.getElementById('aspectRatio');
  if (!sel) return;
  const valid = Array.from(sel.options).some(o => o.value === val);
  sel.value = valid ? val : '16:9';
}

function reuseJob(result, prompt) {
  // Použít rawPrompt pokud existuje (s @mentions), jinak processed prompt
  document.getElementById('prompt').value = result.rawPrompt || prompt;
  updateCharCount();

  if (result.modelKey) selectModel(result.modelKey);

  if (result.type === 'gemini') {
    const th = result.thinkingLevel || 'minimal';
    document.getElementById(th === 'high' ? 'th-high' : 'th-min').checked = true;
  }
  if (result.params?.ratio) {
    setAspectRatioSafe(result.params.ratio);
  }
  if (result.type === 'flux' || result.type === 'seedream' || result.type === 'kling' || result.type === 'zimage' || result.type === 'qwen2') {
    const seedVal = result.seed;
    if (result.type === 'kling') {
      const resVal = result.klingResolution || '1K';
      const kResMap = { '1K': 'kr_1k', '2K': 'kr_2k', '4K': 'kr_4k' };
      const el = document.getElementById(kResMap[resVal] || 'kr_1k');
      if (el) el.checked = true;
    } else if (result.type === 'zimage') {
      const seedEl = document.getElementById('zimageSeed');
      if (seedEl) seedEl.value = (seedVal && seedVal !== '—') ? seedVal : '';
      // Obnovit MP resolution radio
      if (result.imageSize) {
        const mpMap = { '1': 'zr_1mp', '2': 'zr_2mp', '4': 'zr_4mp' };
        const mpEl = document.getElementById(mpMap[String(result.imageSize)] || 'zr_1mp');
        if (mpEl) mpEl.checked = true;
      }
      if (result.steps) {
        const el = document.getElementById('zimageSteps');
        if (el) { el.value = result.steps; document.getElementById('zimageStepsVal').textContent = result.steps; }
      }
      if (result.guidance) {
        const el = document.getElementById('zimageGuidance');
        if (el) { el.value = result.guidance; document.getElementById('zimageGuidanceVal').textContent = parseFloat(result.guidance).toFixed(1); }
      }
    } else if (result.type === 'qwen2') {
      const seedEl = document.getElementById('qwen2Seed');
      if (seedEl) seedEl.value = (seedVal && seedVal !== '—') ? seedVal : '';
      if (result.steps) {
        const el = document.getElementById('qwen2Steps');
        if (el) { el.value = result.steps; document.getElementById('qwen2StepsVal').textContent = result.steps; }
      }
      if (result.guidance) {
        const el = document.getElementById('qwen2Guidance');
        if (el) { el.value = result.guidance; document.getElementById('qwen2GuidanceVal').textContent = parseFloat(result.guidance).toFixed(1); }
      }
      if (result.acceleration) {
        const accMap = { none: 'qwa_none', regular: 'qwa_reg', high: 'qwa_high' };
        const accEl = document.getElementById(accMap[result.acceleration] || 'qwa_reg');
        if (accEl) accEl.checked = true;
      }
    } else {
      const seedEl = document.getElementById(result.type === 'seedream' ? 'sdSeed' : 'fluxSeed');
      if (seedEl) seedEl.value = (seedVal && seedVal !== '—') ? seedVal : '';
    }
  }

  switchView('gen');
  setGenMode('image');
  toast('Parameters loaded — edit prompt and generate', 'ok');
}

async function reuseJobFromGallery(item) {
  switchView('gen');
  setGenMode('image');
  document.getElementById('prompt').value = item.rawPrompt || item.prompt || '';
  updateCharCount();

  // Vždy vymazat styl a kameru — obnoví se jen pokud zdrojový obrázek je batch
  selectedStyles.clear();
  selectedCameras.clear();
  renderStyleTags();
  renderCameraTags();
  updateCameraBtn();
  if (item.modelKey) selectModel(item.modelKey);
  if (item.params?.ratio) setAspectRatioSafe(item.params.ratio);
  if (item.params?.thinking) {
    document.getElementById(item.params.thinking === 'high' ? 'th-high' : 'th-min').checked = true;
  }
  const model = MODELS[item.modelKey];
  if (model?.type === 'kling') {
    const resVal = item.params?.klingResolution || '1K';
    const kResMap = { '1K': 'kr_1k', '2K': 'kr_2k', '4K': 'kr_4k' };
    const el = document.getElementById(kResMap[resVal] || 'kr_1k');
    if (el) el.checked = true;
  }
  if (model?.type === 'flux' || model?.type === 'seedream') {
    const seedEl = document.getElementById(model.type === 'seedream' ? 'sdSeed' : 'fluxSeed');
    const seedVal = item.params?.seed;
    if (seedEl) seedEl.value = (seedVal && seedVal !== '—') ? seedVal : '';
  }
  // Obnovit Z-Image parametry
  if (model?.type === 'zimage') {
    const p = item.params || {};
    // Obnovit MP resolution radio (hodnoty '1','2','4')
    if (p.imageSize) {
      const mpMap = { '1': 'zr_1mp', '2': 'zr_2mp', '4': 'zr_4mp' };
      const el = document.getElementById(mpMap[String(p.imageSize)] || 'zr_1mp');
      if (el) el.checked = true;
    }
    if (p.seed) { const el = document.getElementById('zimageSeed'); if (el) el.value = p.seed !== '—' ? p.seed : ''; }
    if (p.steps) {
      const el = document.getElementById('zimageSteps');
      if (el) { el.value = p.steps; document.getElementById('zimageStepsVal').textContent = p.steps; }
    }
    if (p.guidance && model.guidance) {
      const el = document.getElementById('zimageGuidance');
      if (el) { el.value = p.guidance; document.getElementById('zimageGuidanceVal').textContent = parseFloat(p.guidance).toFixed(1); }
    }
    if (p.negPrompt !== undefined && model.negPrompt) {
      const el = document.getElementById('zimageNeg');
      if (el) el.value = p.negPrompt;
    }
    if (p.acceleration) {
      const accelMap = { none: 'za_none', regular: 'za_reg', high: 'za_high' };
      const accelEl = document.getElementById(accelMap[p.acceleration] || 'za_reg');
      if (accelEl) accelEl.checked = true;
    }
  }

  // Obnovit Qwen Image 2 parametry
  if (model?.type === 'qwen2') {
    const p = item.params || {};
    if (p.seed) { const el = document.getElementById('qwen2Seed'); if (el) el.value = p.seed !== '—' ? p.seed : ''; }
    if (p.steps) {
      const el = document.getElementById('qwen2Steps');
      if (el) { el.value = p.steps; document.getElementById('qwen2StepsVal').textContent = p.steps; }
    }
    if (p.guidance) {
      const el = document.getElementById('qwen2Guidance');
      if (el) { el.value = p.guidance; document.getElementById('qwen2GuidanceVal').textContent = parseFloat(p.guidance).toFixed(1); }
    }
    if (p.acceleration) {
      const accMap = { none: 'qwa_none', regular: 'qwa_reg', high: 'qwa_high' };
      const accEl = document.getElementById(accMap[p.acceleration] || 'qwa_reg');
      if (accEl) accEl.checked = true;
    }
  }

  // Obnovit reference ze snapshotu
  if (item.usedRefs?.length) {
    refs = [];
    for (const snap of item.usedRefs) {
      if (refs.length >= getRefMax()) break;
      // Načíst asset z DB (v102+ snap má assetId, starší může mít imageData inline)
      let asset = null;
      if (snap.assetId) {
        asset = await dbGet('assets', snap.assetId);
      }
      // Pokud asset v DB neexistuje ale máme inline data (starší snapshot) — uložit do DB
      if (!asset && snap.imageData) {
        asset = await createAsset(snap.imageData, snap.mimeType || 'image/png', 'generated');
      }
      if (!asset?.imageData) continue;
      refs.push({
        assetId: asset.id,
        autoName: snap.autoName || asset.autoName || null,
        userLabel: snap.userLabel || '',
        mimeType: asset.mimeType || snap.mimeType || 'image/png',
        thumb: asset.thumb || null,
        dims: asset.dims || null,
      });
    }
    renderRefThumbs();
    if (refs.length) toast(`Restored ${refs.length} references from original job`, 'ok');
  }

  if (!item.usedRefs?.length) toast('Parameters loaded from gallery', 'ok');

  // Obnovit batch styl nebo kameru — přepnout zpět na Combine pro normální použití
  if (item.batchStyle) {
    const s = STYLES.find(x => x.id === item.batchStyle.id);
    if (s) {
      selectedStyles.clear();
      selectedStyles.set(s.id, s);
      styleMode = item.batchStyle.mode || 'visual';
      document.getElementById('stypVisual')?.classList.toggle('active', styleMode === 'visual');
      document.getElementById('stypFull')?.classList.toggle('active',   styleMode === 'full');
      setStylesBatchMode('combine');
    }
  } else if (item.batchCamera) {
    const c = CAMERA_ITEMS.find(x => x.id === item.batchCamera.id);
    if (c) {
      selectedCameras.clear();
      selectedCameras.set(c.id, c);
      setCamerasBatchMode('combine');
      renderCameraTags();
      updateCameraBtn();
    }
  }
}

// Reuse directly from a gallery ID — looks up full item (with usedRefs) and calls reuseJobFromGallery.
// Used by the Reuse button on live output cards so refs are always restored.
async function reuseJobById(galId) {
  if (!galId) { toast('Cannot reuse — no gallery ID', 'err'); return; }
  const item = await dbGet('images', galId).catch(() => null);
  if (!item) { toast('Cannot reuse — gallery item not found', 'err'); return; }
  reuseJobFromGallery(item);
}

// ═══════════════════════════════════════════════════════
// GALLERY ARCHIVE — EXPORT / IMPORT
// ═══════════════════════════════════════════════════════

async function exportGallery() {
  const ts = new Date().toISOString().slice(0,10);

  // ── Pomocná funkce: velký centered progress overlay ──
  let progressEl = null;
  function showProgress(text) {
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
      progressEl.innerHTML = '<div id="_archProg" style="background:var(--s1);border:1px solid var(--border);padding:32px 48px;text-align:center;min-width:320px;"><div style="font-family:Syne,sans-serif;font-size:22px;font-weight:700;color:var(--accent);margin-bottom:8px;">↓ Archivace</div><div id="_archProgTxt" style="font-size:16px;color:var(--text);"></div></div>';
      document.body.appendChild(progressEl);
    }
    document.getElementById('_archProgTxt').textContent = text;
  }
  function hideProgress() {
    if (progressEl) { document.body.removeChild(progressEl); progressEl = null; }
  }

  // ── Krok 1: otevřít save dialog HNED — musí být volaný synchronně při user gesture ──
  let fileHandle = null;
  if (window.showSaveFilePicker) {
    try {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: `gis-archive-${ts}.json`,
        types: [{ description: 'GIS Archive', accept: { 'application/json': ['.json'] } }]
      });
    } catch(e) {
      if (e.name === 'AbortError') return; // uživatel zrušil — nic nedělat
      fileHandle = null; // jiná chyba → fallback na download
    }
  }

  // ── Krok 2: načíst data (teď může await bez problémů) ──
  showProgress('Loading gallery...');
  await new Promise(r => setTimeout(r, 0));

  const images = await dbGetAll('images');
  const folders = await dbGetAll('folders');

  if (!images.length) { hideProgress(); toast('Gallery is empty', 'err'); return; }

  const filename = `gis-archive-${ts}-${images.length}img.json`;

  // ── Krok 3: stavět JSON po kouscích (vyhne se blokování threadu) ──
  const header = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), imageCount: images.length, folders });
  const parts = [header.slice(0, -1) + ', "images": ['];

  for (let i = 0; i < images.length; i++) {
    if (i > 0) parts.push(',');
    parts.push(JSON.stringify(images[i]));
    if (i % 20 === 19 || i === images.length - 1) {
      showProgress(`Serializing images… ${i + 1} / ${images.length}`);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  parts.push(']}');

  showProgress('Zapisuji soubor…');
  await new Promise(r => setTimeout(r, 0));
  const blob = new Blob(parts, { type: 'application/json' });

  // ── Krok 4: uložit ──
  if (fileHandle) {
    try {
      const ws = await fileHandle.createWritable();
      await ws.write(blob);
      await ws.close();
      hideProgress();
      toast(`Archived — ${images.length} images ✓`, 'ok');
      return;
    } catch(e) {
      // zápis selhal → fallback
    }
  }

  // Fallback: přímé stažení do Downloads
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  hideProgress();
  toast(`Archive downloaded — ${images.length} images ✓`, 'ok');
}

async function importGallery(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  // ── Progress overlay — velký centered modal, stejný styl jako export ──
  let progressEl = null;
  let _totalCount = 0;
  function showProg(imported, skipped) {
    const done = imported + skipped;
    const total = _totalCount || '?';
    const pct = _totalCount ? Math.round(done / _totalCount * 100) : '';
    const line1 = `Importing images…`;
    const line2 = `${done} / ${total}${pct !== '' ? '  (' + pct + '%)' : ''}`;
    const line3 = skipped > 0 ? `(${skipped} skipped — duplicity)` : '';
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
      progressEl.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);padding:32px 48px;text-align:center;min-width:340px;">
        <div style="font-family:Syne,sans-serif;font-size:22px;font-weight:700;color:var(--accent);margin-bottom:12px;">↑ Import archive</div>
        <div id="_impL1" style="font-size:16px;color:var(--text);margin-bottom:6px;"></div>
        <div id="_impL2" style="font-size:28px;font-weight:700;font-family:Syne,sans-serif;color:var(--text);margin-bottom:6px;"></div>
        <div id="_impL3" style="font-size:12px;color:var(--dim);min-height:16px;"></div>
      </div>`;
      document.body.appendChild(progressEl);
    }
    document.getElementById('_impL1').textContent = line1;
    document.getElementById('_impL2').textContent = line2;
    document.getElementById('_impL3').textContent = line3;
  }
  function showProgMsg(msg) {
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
      progressEl.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);padding:32px 48px;text-align:center;min-width:340px;">
        <div style="font-family:Syne,sans-serif;font-size:22px;font-weight:700;color:var(--accent);margin-bottom:12px;">↑ Import archive</div>
        <div id="_impMsg" style="font-size:16px;color:var(--text);"></div>
      </div>`;
      document.body.appendChild(progressEl);
    }
    const el = document.getElementById('_impMsg');
    if (el) el.textContent = msg;
  }
  function hideProg() { if (progressEl) { document.body.removeChild(progressEl); progressEl = null; } }

  showProgMsg('Loading archive…');
  await new Promise(r => setTimeout(r, 0));

  // ── Worker: streaming JSON parser — NIKDY nenačítá celý archiv najednou ──
  // Klíčová oprava: MARKER hledá "images" + libovolné mezery + "[" (regex místo indexOf)
  const workerSrc = `
    let _resolve = null;
    self.onmessage = function(e) {
      if (_resolve) { var r = _resolve; _resolve = null; r(e.data); return; }
      runImport(e.data);
    };
    function waitMsg() { return new Promise(function(r) { _resolve = r; }); }

    async function runImport(file) {
      var reader = file.stream().getReader();
      var dec = new TextDecoder();
      var found = false, headerBuf = '';
      var depth = 0, inStr = false, esc = false;
      var parts = [], segStart = 0;

      // Najde "images"\\s*[ v bufferu — robustní vůči mezerám v JSON
      function findImagesMarker(buf) {
        var re = /"images"\\s*:\\s*\\[/;
        var m = re.exec(buf);
        return m ? { idx: m.index, end: m.index + m[0].length } : null;
      }

      var processStr = async function(str) {
        if (!found) {
          headerBuf += str;
          var m = findImagesMarker(headerBuf);
          if (!m) {
            // Ořez buffer ale zachovej dost pro marker
            if (headerBuf.length > 65536) headerBuf = headerBuf.slice(-200);
            return;
          }
          try {
            var hRaw = headerBuf.slice(0, m.idx).replace(/,\\s*$/, '') + '}';
            var h = JSON.parse(hRaw);
            self.postMessage({type:'meta', folders: h.folders||[], imageCount: h.imageCount||0});
          } catch(e2) {
            self.postMessage({type:'meta', folders:[], imageCount:0});
          }
          str = headerBuf.slice(m.end);
          found = true; parts = []; depth = 0; inStr = false; esc = false; segStart = 0;
        }

        for (var i = 0; i < str.length; i++) {
          var c = str[i];
          if (depth === 0) {
            if (c === '{') { depth = 1; segStart = i; }
          } else {
            if (esc) { esc = false; }
            else if (c === '\\\\' && inStr) { esc = true; }
            else if (c === '"') { inStr = !inStr; }
            else if (!inStr) {
              if (c === '{') { depth++; }
              else if (c === '}') {
                depth--;
                if (depth === 0) {
                  parts.push(str.slice(segStart, i + 1));
                  var json = parts.join('');
                  parts = []; segStart = i + 1;
                  try {
                    var img = JSON.parse(json);
                    if (img && img.id) {
                      self.postMessage({type:'image', image: img});
                      var cmd = await waitMsg();
                      if (cmd && cmd.type === 'abort') return;
                    }
                  } catch(e3) {}
                }
              }
            }
          }
        }
        if (depth > 0) { parts.push(str.slice(segStart)); segStart = 0; }
      };

      try {
        // Fáze 1: načti header (pošli meta, čekej na continue/abort)
        while (!found) {
          var chunk1 = await reader.read();
          if (chunk1.done) break;
          await processStr(dec.decode(chunk1.value, {stream: true}));
        }
        if (!found) { self.postMessage({type:'error', message:'Archiv neobsahuje pole images'}); return; }

        // Čekej na potvrzení od uživatele
        var cmd2 = await waitMsg();
        if (cmd2 && cmd2.type === 'abort') { reader.cancel(); return; }

        // Fáze 2: stream zbytku souboru
        while (true) {
          var chunk2 = await reader.read();
          if (chunk2.done) break;
          await processStr(dec.decode(chunk2.value, {stream: true}));
        }
        await processStr(dec.decode());
        self.postMessage({type:'done'});
      } catch(e4) {
        self.postMessage({type:'error', message: e4.message});
      }
    }
  `;

  const workerBlob = new Blob([workerSrc], {type: 'application/javascript'});
  const workerUrl = URL.createObjectURL(workerBlob);
  const worker = new Worker(workerUrl);

  // Existující IDs a složky pro deduplikaci
  const existingIds = new Set((await dbGetAll('images')).map(i => i.id));
  const existingFolderIds = new Set((await dbGetAll('folders')).map(f => f.id));

  let imported = 0, skipped = 0;

  try {
    await new Promise((resolve, reject) => {
      worker.onerror = e => reject(new Error(e.message || 'Worker error'));
      worker.onmessage = async ({data: msg}) => {
        try {
          if (msg.type === 'meta') {
            _totalCount = msg.imageCount || 0;
            hideProg(); // skryj "načítám" overlay před confirm dialogem
            const ok = confirm(`Import ${_totalCount ? _totalCount + ' images' : 'archive'} into gallery?`);
            if (!ok) {
              worker.postMessage({type:'abort'});
              resolve();
              return;
            }
            // Importuj složky
            for (const f of (msg.folders || [])) {
              if (!existingFolderIds.has(f.id)) await dbPut('folders', f);
            }
            showProg(0, 0);
            worker.postMessage({type:'continue'});

          } else if (msg.type === 'image') {
            const img = msg.image;
            if (existingIds.has(img.id)) {
              skipped++;
            } else {
              await dbPut('images', img);
              await dbPutMeta(img);
              if (img.imageData) {
                generateThumb(img.imageData, img.mimeType || 'image/png').then(t => {
                  if (t) {
                    const tx = db.transaction('thumbs', 'readwrite');
                    tx.objectStore('thumbs').put({id: img.id, data: t});
                    thumbMemCache.set(img.id, t);
                  }
                });
              }
              imported++;
            }
            showProg(imported, skipped);
            worker.postMessage({type:'ack'});

          } else if (msg.type === 'done') {
            resolve();
          } else if (msg.type === 'error') {
            reject(new Error(msg.message));
          }
        } catch(e) { reject(e); }
      };
      worker.postMessage(file);
    });
  } catch(e) {
    hideProg();
    toast('Import error: ' + (e.message || e), 'err');
  } finally {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
  }

  invalidateMetaCache();
  hideProg();
  const note = skipped > 0 ? ` (${skipped} skipped)` : '';
  toast(`Imported ${imported} images ✓${note}`, imported > 0 ? 'ok' : 'err');
  if (imported > 0) refreshGalleryUI();
}

function galSelClick(e, id) {
  e.stopPropagation(); // nezavírat modal / neotvírat detail
  if (selectedGalItems.has(id)) selectedGalItems.delete(id);
  else selectedGalItems.add(id);
  const hasSelection = selectedGalItems.size > 0;
  document.getElementById('galBulk').classList.toggle('show', hasSelection);
  document.getElementById('selCount').textContent = selectedGalItems.size;
  if (hasSelection) updateBulkFolderSelect();
  // Aktualizovat jen konkrétní item (nerender celé galerie)
  const el = document.querySelector(`.gal-item[data-id="${id}"]`);
  if (el) el.classList.toggle('selected', selectedGalItems.has(id));
}

// ── Shared rubber-band helper ──────────────────────────────
// mode: 'select' | 'deselect'
// onRect(selBox, mode): callback with final selection rectangle
function _startRubberBand(e, rbId, mode, onRect) {
  const startX = e.clientX, startY = e.clientY;
  let rbActive = false;
  const rb = document.getElementById(rbId);

  function onMove(ev) {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!rbActive && Math.abs(dx) + Math.abs(dy) > 6) rbActive = true;
    if (!rbActive || !rb) return;
    rb.style.display = 'block';
    rb.style.borderColor = mode === 'deselect' ? '#e04444' : 'var(--accent)';
    rb.style.background  = mode === 'deselect' ? 'rgba(220,50,50,.08)' : 'rgba(212,160,23,.06)';
    rb.style.left   = Math.min(ev.clientX, startX) + 'px';
    rb.style.top    = Math.min(ev.clientY, startY) + 'px';
    rb.style.width  = Math.abs(dx) + 'px';
    rb.style.height = Math.abs(dy) + 'px';
  }
  function onUp(ev) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (rb) rb.style.display = 'none';
    if (!rbActive) return;
    onRect({
      left:   Math.min(ev.clientX, startX),
      right:  Math.max(ev.clientX, startX),
      top:    Math.min(ev.clientY, startY),
      bottom: Math.max(ev.clientY, startY),
    }, mode);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  return { isActive: () => rbActive };
}

function initRubberBand() {
  const grid = document.getElementById('galGrid');
  if (!grid) return;

  grid.addEventListener('dragend', () => { isDragging = false; });

  const galGridWrap = document.getElementById('galleryGrid');
  if (!galGridWrap) return;

  galGridWrap.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target.classList.contains('gal-sel') ||
        target.classList.contains('gal-heart') ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'LABEL' ||
        target.closest('.gal-bulk') ||
        target.closest('.gal-toolbar') ||
        target.closest('#ctxMenu')) return;

    // Shift = rubber-band select; Alt = rubber-band deselect; plain = let card drag handle it
    if (!e.shiftKey && !e.altKey) return;

    e.preventDefault();
    const mode = e.altKey ? 'deselect' : 'select';
    _startRubberBand(e, 'rubberBand', mode, (selBox, m) => {
      let changed = false;
      document.querySelectorAll('.gal-item').forEach(el => {
        const r = el.getBoundingClientRect();
        const overlaps = r.left < selBox.right && r.right > selBox.left &&
                         r.top  < selBox.bottom && r.bottom > selBox.top;
        if (!overlaps) return;
        if (m === 'deselect') {
          selectedGalItems.delete(el.dataset.id);
          el.classList.remove('selected');
        } else {
          selectedGalItems.add(el.dataset.id);
          el.classList.add('selected');
        }
        changed = true;
      });
      if (changed) {
        const has = selectedGalItems.size > 0;
        document.getElementById('galBulk').classList.toggle('show', has);
        document.getElementById('selCount').textContent = selectedGalItems.size;
        if (has) updateBulkFolderSelect();
      }
    });
  });
}

let draggedIds = new Set();
let isDragging = false;

// ── Rubber-band selection pro Assets ──────────────────────
function initAssetRubberBand() {
  const wrap = document.getElementById('assetGrid');
  if (!wrap || wrap._rbInit) return;
  wrap._rbInit = true;

  wrap.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target.classList.contains('ai-sel') ||
        target.classList.contains('gal-heart') ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.closest('.gal-bulk') ||
        target.closest('.gal-toolbar')) return;

    // Shift = rubber-band select; Alt = deselect; both start anywhere on card
    if (!e.shiftKey && !e.altKey) return;

    e.preventDefault();
    const mode = e.altKey ? 'deselect' : 'select';
    _startRubberBand(e, 'rubberBand', mode, (selBox, m) => {
      document.querySelectorAll('.asset-item').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.left < selBox.right && r.right > selBox.left &&
            r.top  < selBox.bottom && r.bottom > selBox.top) {
          if (m === 'deselect') { selectedAssets.delete(el.dataset.id); el.classList.remove('selected'); }
          else { selectedAssets.add(el.dataset.id); el.classList.add('selected'); }
        }
      });
      updateAssetBulkBar();
    });
  });
}

// ── Asset drag-to-folder ───────────────────────────────────
let assetDraggedIds = new Set();

function assetDragStart(e, id) {
  if (selectedAssets.has(id)) {
    assetDraggedIds = new Set(selectedAssets);
  } else {
    assetDraggedIds = new Set([id]);
  }
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', [...assetDraggedIds].join(','));
}

function assetFolderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function assetFolderDragEnter(e, el) { el.classList.add('drag-over'); }
function assetFolderDragLeave(e, el) { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over'); }

async function assetFolderDrop(e, folderId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!assetDraggedIds.size) return;
  await Promise.all([...assetDraggedIds].map(id => dbPatchAssetMeta(id, { folder: folderId })));
  if (assetDraggedIds.size > 1 || selectedAssets.has([...assetDraggedIds][0])) clearAssetSelection();
  assetDraggedIds = new Set();
  renderAssets(); renderAssetFolders();
  toast('Moved ✓', 'ok');
}

function galDragStart(e, id) {
  isDragging = true;
  // Táhnout vybrané, nebo jen tento obrázek
  if (selectedGalItems.has(id)) {
    draggedIds = new Set(selectedGalItems);
  } else {
    draggedIds = new Set([id]);
  }
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', [...draggedIds].join(','));
}

function folderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function folderDragEnter(e, el) {
  el.classList.add('drag-over');
}

function folderDragLeave(e, el) {
  if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over');
}

async function folderDrop(e, folderId) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!draggedIds.size) return;

  await Promise.all([...draggedIds].map(id => dbPatchMeta(id, { folder: folderId })));
  // Pokud jsme táhli vybrané, zrušit výběr
  if (draggedIds.size > 1 || selectedGalItems.has([...draggedIds][0])) clearSelection();
  draggedIds = new Set();
  isDragging = false;
  refreshGalleryUI();
  toast('Moved ✓', 'ok');
}

