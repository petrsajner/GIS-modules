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
      <img src="" data-id="${item.id}" alt="" loading="lazy" style="background:var(--s3);">
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

  // Progress overlay (jen při větším počtu — pod 10 je rychlé, overlay by blikal)
  const showProgress = count >= 10;
  let progressEl = null;
  function setProgress(done) {
    if (!showProgress) return;
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
      progressEl.innerHTML = `<div style="background:var(--s1);border:1px solid var(--border);padding:32px 48px;text-align:center;min-width:320px;">
        <div style="font-family:Syne,sans-serif;font-size:22px;font-weight:700;color:#ff6b6b;margin-bottom:12px;">✕ Deleting images</div>
        <div id="_delL2" style="font-size:28px;font-weight:700;font-family:Syne,sans-serif;color:var(--text);"></div>
      </div>`;
      document.body.appendChild(progressEl);
    }
    const el = document.getElementById('_delL2');
    if (el) el.textContent = `${done} / ${count}`;
  }
  function hideProgress() { if (progressEl) { document.body.removeChild(progressEl); progressEl = null; } }

  setProgress(0);
  let done = 0;
  for (const id of selectedGalItems) {
    await dbDelete('images', id);
    await dbDeleteMeta(id);
    await dbDelete('thumbs', id);
    thumbMemCache.delete(id);
    done++;
    if (done % 5 === 0 || done === count) {
      setProgress(done);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  hideProgress();
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
      <div style="background:var(--s1);border:1px solid var(--border);padding:22px;min-width:360px;max-width:440px;max-height:90vh;overflow-y:auto;">
        <div style="font-family:Syne,sans-serif;font-weight:700;font-size:15px;margin-bottom:14px;color:var(--purple)">⬆ Batch Upscale</div>
        <div style="font-size:11px;color:var(--dim);margin-bottom:16px;">
          Selected: <b style="color:var(--accent);">${ids.length} images</b> — same settings for all
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

        <!-- SeedVR2 options -->
        <div id="upSeedvrOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Target resolution</div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${[['720p','HD'],['1080p','FHD'],['1440p','2K'],['2160p','4K']].map(([v,l],i) => `<label style="flex:1;text-align:center;padding:5px 2px;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);" id="upSvRes_${v}">
              <input type="radio" name="upSvRes" value="${v}" ${i===1?'checked':''} style="display:none;">
              <span style="pointer-events:none;display:block;font-weight:600;">${l}</span><span style="pointer-events:none;font-size:9px;color:var(--dim2);">${v}</span>
            </label>`).join('')}
          </div>
          <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Noise scale <span id="upNoiseVal" style="color:var(--accent);">0.10</span></div>
          <input type="range" id="upNoise" min="0" max="0.5" step="0.05" value="0.1" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upNoiseVal').textContent=parseFloat(this.value).toFixed(2)">
        </div>

        <!-- Clarity options -->
        <div id="upClarityOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Upscale faktor <span style="color:var(--dim2);text-transform:none;letter-spacing:0;font-weight:400;">(max 4×)</span></div>
          <div style="display:flex;gap:6px;margin-bottom:10px;">
            ${['2','4'].map(f => `<label style="flex:1;text-align:center;padding:5px 0;border:1px solid var(--border);cursor:pointer;font-size:11px;color:var(--dim);">
              <input type="radio" name="upFactor" value="${f}" ${f==='2'?'checked':''} style="display:none;"><span style="pointer-events:none;">${f}×</span>
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
              <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Resemblance <span id="upResemblanceVal" style="color:var(--accent);">0.60</span></div>
              <input type="range" id="upResemblance" min="0" max="1" step="0.05" value="0.6" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upResemblanceVal').textContent=parseFloat(this.value).toFixed(2)">
            </div>
          </div>
          <div style="margin-top:10px;">
            <div style="font-size:10px;color:var(--dim);margin-bottom:4px;">Steps <span id="upStepsVal" style="color:var(--accent);">18</span></div>
            <input type="range" id="upSteps" min="10" max="50" step="1" value="18" style="width:100%;accent-color:var(--purple);" oninput="document.getElementById('upStepsVal').textContent=this.value">
          </div>
        </div>

        <!-- Magnific options -->
        <div id="upMagnificOpts" style="display:none;margin-bottom:16px;">
          <div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border);overflow:hidden;">
            <button type="button" id="upMagModeCreative" style="flex:1;padding:8px 0;background:var(--purple);color:#fff;border:none;cursor:pointer;font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:.03em;">Creative</button>
            <button type="button" id="upMagModePrecision" style="flex:1;padding:8px 0;background:var(--s2);color:var(--dim);border:none;border-left:1px solid var(--border);cursor:pointer;font-size:12px;font-family:'IBM Plex Mono',monospace;letter-spacing:.03em;">Precision</button>
          </div>
          <input type="hidden" id="upMagMode" value="creative">
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
          <div id="upMagPrecisionPanel" style="display:none;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Version</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">
              ${[['v2_sublime','V2 Sublime'],['v2_photo','V2 Photo'],['v2_photo_denoiser','V2 Denoise'],['v1_hdr','V1 HDR']].map(([v,l],i) => `<label style="flex:1;min-width:70px;text-align:center;padding:5px 2px;border:1px solid ${i===0?'var(--purple)':'var(--border)'};cursor:pointer;font-size:10px;color:${i===0?'var(--purple)':'var(--dim)'};" id="upMagPrecVer_${i}">
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

        <!-- Topaz Gigapixel options -->
        <div id="upTopazGigaOpts" style="display:none;margin-bottom:16px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--text);margin-bottom:6px;">Model</div>
          <select id="upTGigaModel" style="width:100%;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 9px;outline:none;margin-bottom:10px;">
            <option value="Upscale Standard" selected>Standard — photos, balanced</option>
            <option value="Upscale High Fidelity">High Fidelity — max fidelity</option>
            <option value="Upscale Low Resolution">Low Resolution — blurry/low-res inputs</option>
            <option value="Upscale CGI">CGI — AI art, illustrations</option>
            <option value="Face Recovery Natural">Face Recovery — generative face recovery</option>
            <option value="Text Recovery">Text &amp; Shapes — text, graphics</option>
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

        <!-- Topaz Bloom options -->
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

        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="ibtn" id="confirmUpscale" style="flex:1;justify-content:center;padding:10px;border-color:var(--purple);color:var(--purple);">▶ Run ${ids.length}× upscale</button>
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
      overlay.querySelector('#upMode_crisp_lbl').style.borderColor     = sel === 'crisp'           ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_seedvr_lbl').style.borderColor    = sel === 'seedvr'          ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_clarity_lbl').style.borderColor   = sel === 'clarity'         ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_magnific_lbl').style.borderColor  = sel === 'magnific'        ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_tgigapixel_lbl').style.borderColor = sel === 'topaz_gigapixel' ? 'var(--purple)' : 'var(--border)';
      overlay.querySelector('#upMode_tbloom_lbl').style.borderColor    = sel === 'topaz_bloom'     ? 'var(--purple)' : 'var(--border)';
      seedvrOpts.style.display     = sel === 'seedvr'          ? 'block' : 'none';
      clarityOpts.style.display    = sel === 'clarity'         ? 'block' : 'none';
      magnificOpts.style.display   = sel === 'magnific'        ? 'block' : 'none';
      topazGigaOpts.style.display  = sel === 'topaz_gigapixel' ? 'block' : 'none';
      topazBloomOpts.style.display = sel === 'topaz_bloom'     ? 'block' : 'none';
    };
    modeRadios.forEach(r => r.addEventListener('change', updateModeBorders));
    overlay.querySelectorAll('input[name="upFactor"]').forEach(r => r.addEventListener('change', () => {
      overlay.querySelectorAll('label:has(input[name="upFactor"])').forEach(l => {
        l.style.borderColor = l.querySelector('input').checked ? 'var(--purple)' : 'var(--border)';
        l.style.color = l.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)';
      });
    }));
    overlay.querySelectorAll('input[name="upSvRes"]').forEach(r => r.addEventListener('change', () => {
      ['720p','1080p','1440p','2160p'].forEach(v => {
        const lbl = overlay.querySelector(`#upSvRes_${v}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="upMagFactor"]').forEach(r => r.addEventListener('change', () => {
      ['2x','4x','8x','16x'].forEach(f => {
        const lbl = overlay.querySelector(`#upMagFactor_${f}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="upMagEngine"]').forEach(r => r.addEventListener('change', () => {
      [0,1,2].forEach(i => {
        const lbl = overlay.querySelector(`#upMagEngine_${i}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="upMagOptFor"]').forEach(r => r.addEventListener('change', () => {
      [0,1,2,3,4].forEach(i => {
        const lbl = overlay.querySelector(`#upMagOptFor_${i}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
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
    const updatePrecVersion = () => {
      const ver = overlay.querySelector('input[name="upMagPrecVersion"]:checked')?.value || 'v2_sublime';
      const scaleRow = overlay.querySelector('#upMagPrecScaleRow');
      if (scaleRow) scaleRow.style.display = ver === 'v1_hdr' ? 'none' : 'block';
      [0,1,2,3].forEach(i => {
        const lbl = overlay.querySelector(`#upMagPrecVer_${i}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    };
    overlay.querySelectorAll('input[name="upMagPrecVersion"]').forEach(r => r.addEventListener('change', updatePrecVersion));
    overlay.querySelectorAll('input[name="upMagPrecFactor"]').forEach(r => r.addEventListener('change', () => {
      ['2','4','8','16'].forEach(f => {
        const lbl = overlay.querySelector(`#upMagPrecFactor_${f}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--purple)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="upTGigaFactor"]').forEach(r => r.addEventListener('change', () => {
      ['2','4','6'].forEach(f => {
        const lbl = overlay.querySelector(`#upTGigaFactor_${f}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--accent)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--accent)' : 'var(--dim)'; }
      });
    }));
    overlay.querySelectorAll('input[name="upTBloomFactor"]').forEach(r => r.addEventListener('change', () => {
      ['1','2','4','6','8'].forEach(f => {
        const lbl = overlay.querySelector(`#upTBloomFactor_${f}`);
        if (lbl) { lbl.style.borderColor = lbl.querySelector('input').checked ? 'var(--accent)' : 'var(--border)'; lbl.style.color = lbl.querySelector('input').checked ? 'var(--accent)' : 'var(--dim)'; }
      });
    }));
    updateModeBorders();
    const initSvRes = overlay.querySelector('#upSvRes_1080p');
    if (initSvRes) initSvRes.style.borderColor = 'var(--purple)';

    overlay.querySelector('#confirmUpscale').onclick = () => {
      const mode = overlay.querySelector('input[name="upMode"]:checked')?.value || 'crisp';
      const factor = overlay.querySelector('input[name="upFactor"]:checked')?.value || '2';
      const clarityPrompt = overlay.querySelector('#upClarityPrompt')?.value?.trim() || '';
      const creativity = parseFloat(overlay.querySelector('#upCreativity')?.value || '0.35');
      const resemblance = parseFloat(overlay.querySelector('#upResemblance')?.value || '0.6');
      const seedvrRes = overlay.querySelector('input[name="upSvRes"]:checked')?.value || '1080p';
      const noiseScale = parseFloat(overlay.querySelector('#upNoise')?.value || '0.1');
      const claritySteps = parseInt(overlay.querySelector('#upSteps')?.value || '18');
      const magMode = overlay.querySelector('#upMagMode')?.value || 'creative';
      const magFactor = overlay.querySelector('input[name="upMagFactor"]:checked')?.value || '2x';
      const magEngine = overlay.querySelector('input[name="upMagEngine"]:checked')?.value || 'magnific_sparkle';
      const magOptFor = overlay.querySelector('input[name="upMagOptFor"]:checked')?.value || 'standard';
      const magPrompt = overlay.querySelector('#upMagPrompt')?.value?.trim() || '';
      const magCreativity = parseInt(overlay.querySelector('#upMagCreativity')?.value || '2');
      const magHdr = parseInt(overlay.querySelector('#upMagHdr')?.value || '0');
      const magResemblance = parseInt(overlay.querySelector('#upMagResemblance')?.value || '0');
      const magFractality = parseInt(overlay.querySelector('#upMagFractality')?.value || '-1');
      const magPrecVersion = overlay.querySelector('input[name="upMagPrecVersion"]:checked')?.value || 'v2_sublime';
      const magPrecFactor  = parseInt(overlay.querySelector('input[name="upMagPrecFactor"]:checked')?.value || '2');
      const magPrecSharpen = parseInt(overlay.querySelector('#upMagPrecSharpen')?.value || '7');
      const magPrecGrain   = parseInt(overlay.querySelector('#upMagPrecGrain')?.value || '7');
      const magPrecDetail  = parseInt(overlay.querySelector('#upMagPrecDetail')?.value || '30');
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

  if (result.mode === 'magnific') {
    if (!freepikKey) { toast('Freepik API key missing — enter it in Setup tab', 'err'); return; }
    if (!proxyUrl)   { toast('Proxy URL missing — enter it in Setup tab', 'err'); return; }
  } else if (result.mode === 'topaz_gigapixel' || result.mode === 'topaz_bloom') {
    const topazKey = localStorage.getItem('gis_topaz_apikey') || '';
    if (!topazKey)   { toast('Topaz API key missing — enter it in Setup tab', 'err'); return; }
    if (!proxyUrl)   { toast('Proxy URL missing — enter it in Setup tab', 'err'); return; }
  } else {
    if (!falKey) { toast('fal.ai key missing — enter it in the header', 'err'); return; }
  }

  const { mode, factor, clarityPrompt, creativity, resemblance, seedvrRes, noiseScale, claritySteps,
    magMode, magFactor, magEngine, magOptFor, magPrompt, magCreativity, magHdr, magResemblance, magFractality,
    magPrecVersion, magPrecFactor, magPrecSharpen, magPrecGrain, magPrecDetail,
    tGigaModel, tGigaFactor, tGigaFace, tBloomModel, tBloomFactor, tBloomPrompt, tBloomCreativity } = result;

  const modeLabel = mode === 'crisp'           ? 'Recraft Crisp'
    : mode === 'seedvr'                        ? `SeedVR2 ${seedvrRes}`
    : mode === 'magnific'                      ? (magMode === 'precision' ? `Magnific Prec ${magPrecVersion}` : `Magnific ${magFactor}`)
    : mode === 'topaz_gigapixel'               ? `Topaz Gigapixel ${tGigaFactor}×`
    : mode === 'topaz_bloom'                   ? `Topaz Bloom ${tBloomFactor}× (${tBloomModel})`
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
      magFactor, magEngine, magOptFor, magPrompt,
      magCreativity, magHdr, magResemblance, magFractality,
      magMode,
      magPrecVersion, magPrecFactor, magPrecSharpen, magPrecGrain, magPrecDetail,
      tGigaModel, tGigaFactor, tGigaFace,
      tBloomModel, tBloomFactor, tBloomPrompt, tBloomCreativity,
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
      // createAsset sam provadi findAssetByFingerprint + vraci existujici asset pokud
      // uz je v DB. Nepotrebujeme dvojity check (drive: alreadyExists + createAsset).
      // Misto toho rozpoznat existing asset podle toho, ze ma aktualni `id` (nikoli nove vygenerovane).
      const preCheck = await findAssetByFingerprint(item.imageData);
      let asset;
      if (preCheck) {
        asset = preCheck;
        toast(`Already in Assets as ${asset.autoName}`, 'ok');
      } else {
        asset = await createAsset(item.imageData, 'image/png', 'generated', item.id);
        toast(`Saved to Assets as ${asset.autoName}`, 'ok');
      }
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
  // Read favorite from images_meta (source of truth), not images store
  const metaItem = (typeof metaCache !== 'undefined' && metaCache) ? metaCache.find(m => m.id === id) : null;
  const isFav = metaItem ? !!metaItem.favorite : (item.favorite || false);
  const inpaintRefBtnHtml = (typeof _inpaintRefPendingPick !== 'undefined' && _inpaintRefPendingPick)
    ? `<button class="ibtn" id="mInpaintRefBtn" style="border-color:#ff9966;color:#ff9966;font-weight:600;">⊕ Inpaint Ref</button>` : '';
  actionsEl.innerHTML = `
    <a class="ibtn" href="${src}" download="${item.model}-${item.id}.png">↓ PNG</a>
    <button class="ibtn" id="mFavBtn" style="border-color:${isFav ? '#ff4d6d' : 'var(--border)'};color:${isFav ? '#ff4d6d' : 'var(--dim)'};">${isFav ? '♥ Favorites' : '♡ Favorite'}</button>
    <button class="ibtn upscale-btn" id="mUpscaleBtn">⬆ Upscale</button>
    ${inpaintRefBtnHtml}
    <button class="ibtn" id="mAddRefBtn" style="border-color:#4a5a8a;color:#88aaff" title="Přidat jako ref + uložit do Assets">⊕ Ref &amp; Assets</button>
    <button class="ibtn" id="mSaveAssetBtn" style="border-color:#4a7a4a;color:#aaffaa" title="Uložit pouze do Assets">📎 Assets</button>
    <button class="ibtn" id="mAnnotateBtn" style="border-color:#6a4a3a;color:#ff9966">✏ Annotate</button>
    <button class="ibtn reuse-btn" id="mReuseBtn">↺ Reuse params</button>
    <button class="ibtn danger" id="mDeleteBtn">✕ Delete</button>
  `;
  if (inpaintRefBtnHtml) { actionsEl.querySelector('#mInpaintRefBtn').onclick = () => setInpaintRefFromGallery(id); }  actionsEl.querySelector('#mFavBtn').onclick = async () => {
    await toggleFavoriteItem(id);
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
  resetModalZoom();
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
    document.getElementById(th === 'high' ? 'upTr-high' : 'upTr-min').checked = true;
  }
  if (result.params?.ratio) {
    setAspectRatioSafe(result.params.ratio);
  }
  if (result.type === 'flux' || result.type === 'seedream' || result.type === 'kling' || result.type === 'zimage' || result.type === 'qwen2' || result.type === 'gpt') {
    const seedVal = result.seed;
    const seedEl = document.getElementById('upSeed');
    if (seedEl) seedEl.value = (seedVal && seedVal !== '—') ? seedVal : '';
    if (result.type === 'kling') {
      const resVal = result.klingResolution || '1K';
      const rEl = document.querySelector(`input[name="upRes"][value="${resVal}"]`);
      if (rEl) rEl.checked = true;
    } else if (result.type === 'zimage') {
      if (result.imageSize) {
        const m = MODELS[currentModel];
        const label = m?.resValues ? Object.entries(m.resValues).find(([,v]) => String(v) === String(result.imageSize))?.[0] : null;
        if (label) { const rEl = document.querySelector(`input[name="upRes"][value="${label}"]`); if (rEl) rEl.checked = true; }
      }
      if (result.steps) {
        const el = document.getElementById('upSteps');
        if (el) { el.value = result.steps; document.getElementById('upStepsVal').textContent = result.steps; }
      }
      if (result.guidance) {
        const el = document.getElementById('upGuidance');
        if (el) { el.value = result.guidance; document.getElementById('upGuidanceVal').textContent = parseFloat(result.guidance).toFixed(1); }
      }
    } else if (result.type === 'qwen2') {
      if (result.steps) {
        const el = document.getElementById('upSteps');
        if (el) { el.value = result.steps; document.getElementById('upStepsVal').textContent = result.steps; }
      }
      if (result.guidance) {
        const el = document.getElementById('upGuidance');
        if (el) { el.value = result.guidance; document.getElementById('upGuidanceVal').textContent = parseFloat(result.guidance).toFixed(1); }
      }
      if (result.acceleration) {
        const rEl = document.querySelector(`input[name="upAccel"][value="${result.acceleration}"]`);
        if (rEl) rEl.checked = true;
      }
    } else if (result.type === 'gpt') {
      // Restore quality tier radio
      const q = result.quality || result.params?.quality || 'medium';
      const qEl = document.querySelector(`input[name="upQuality"][value="${q}"]`);
      if (qEl) qEl.checked = true;
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

  if (item.modelKey && typeof selectModel === 'function') selectModel(item.modelKey);
  const model = MODELS[item.modelKey];
  const p = item.params || {};

  // ── Helpers (mirror loadJobParamsToForm, reading from `p`) ──────
  const _setFld = (val) => {
    if (!val) return;
    const el = document.getElementById('targetFolder');
    if (el) el.value = val;
  };
  const _setRadio = (name, value) => {
    if (value == null || value === '') return;
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  };
  const _setSlider = (inputId, labelId, value, fmt) => {
    if (value === undefined || value === null) return;
    const el = document.getElementById(inputId);
    if (el) el.value = value;
    const lbl = document.getElementById(labelId);
    if (lbl) lbl.textContent = fmt ? fmt(value) : value;
  };

  // ── Aspect ratio — universal first step ──
  const aspect = p.aspectRatio || p.ratio || null;
  if (aspect) setAspectRatioSafe(aspect);

  // ── Unified panel — per-type restore (parallel to loadJobParamsToForm) ──
  if (model && isUnifiedModel(model)) {
    const t = model.type;

    if (t === 'gemini') {
      _setRadio('upRes', p.imageSize || '1K');
      _setRadio('upThinkRadio', p.thinkingLevel || p.thinking || 'minimal');
      const se = document.getElementById('upGrounding');
      if (se) se.checked = !!p.useSearch;
      const re = document.getElementById('upRetry');
      if (re) re.checked = !!p.persistentRetry;
    }

    else if (t === 'imagen') {
      _setRadio('upRes', p.imageSize || '1K');
      if (p.seed) { const e = document.getElementById('upSeed'); if (e) e.value = p.seed; }
    }

    else if (t === 'flux') {
      // Reverse-map tier → upRes label
      if (p.tier != null && model.resValues) {
        const label = Object.entries(model.resValues).find(([,v]) => v === p.tier)?.[0];
        if (label) _setRadio('upRes', label);
      }
      const seedEl = document.getElementById('upSeed');
      if (seedEl) seedEl.value = (p.seed && p.seed !== '—') ? p.seed : '';
      _setSlider('upSteps',    'upStepsVal',    p.steps,    v => v);
      _setSlider('upGuidance', 'upGuidanceVal', p.guidance, v => parseFloat(v).toFixed(1));
      const safeEl = document.getElementById('upSafetySlider');
      if (safeEl && p.safetyTolerance !== undefined) {
        safeEl.value = p.safetyTolerance;
        document.getElementById('upSafetySliderVal').textContent = p.safetyTolerance;
      }
    }

    else if (t === 'seedream') {
      _setRadio('upRes', p.resolution || '2K');
      const seedEl = document.getElementById('upSeed');
      if (seedEl) seedEl.value = (p.seed && p.seed !== '—') ? p.seed : '';
      const safeEl = document.getElementById('upSafetyChk');
      if (safeEl) safeEl.checked = p.safety !== false;
    }

    else if (t === 'kling') {
      _setRadio('upRes', p.klingResolution || '1K');
    }

    else if (t === 'zimage') {
      // Reverse-map imageSize (MP value) → upRes label
      if (p.imageSize && model.resValues) {
        const label = Object.entries(model.resValues).find(([,v]) => String(v) === String(p.imageSize))?.[0];
        if (label) _setRadio('upRes', label);
      }
      const seedEl = document.getElementById('upSeed');
      if (seedEl) seedEl.value = (p.seed && p.seed !== '—') ? p.seed : '';
      _setSlider('upSteps',    'upStepsVal',    p.steps,    v => v);
      if (p.guidance != null) _setSlider('upGuidance', 'upGuidanceVal', p.guidance, v => parseFloat(v).toFixed(1));
      const negEl = document.getElementById('upNeg');
      if (negEl && p.negPrompt !== undefined) negEl.value = p.negPrompt;
      _setRadio('upAccel', p.acceleration || 'regular');
      const safeEl = document.getElementById('upSafetyChk');
      if (safeEl) safeEl.checked = p.safety !== false;
      const strEl = document.getElementById('upStrength');
      if (strEl && p.strength !== undefined && p.strength !== null) {
        strEl.value = p.strength;
        document.getElementById('upStrengthVal').textContent = parseFloat(p.strength).toFixed(2);
      }
    }

    else if (t === 'qwen2') {
      _setRadio('upRes', p.resolution || '1K');
      const seedEl = document.getElementById('upSeed');
      if (seedEl) seedEl.value = (p.seed && p.seed !== '—') ? p.seed : '';
      _setSlider('upSteps',    'upStepsVal',    p.steps,    v => v);
      _setSlider('upGuidance', 'upGuidanceVal', p.guidance, v => parseFloat(v).toFixed(1));
      _setRadio('upAccel', p.acceleration || 'regular');
      const safeEl = document.getElementById('upSafetyChk');
      if (safeEl) safeEl.checked = p.safety !== false;
      const negEl = document.getElementById('upNeg');
      if (negEl && p.negPrompt !== undefined) negEl.value = p.negPrompt;
    }

    else if (t === 'wan27r') {
      if (p.sizeTier) _setRadio('upRes', p.sizeTier);
      const thinkEl = document.getElementById('upThinkChk');
      if (thinkEl) thinkEl.checked = !!p.thinking;
      const seedEl = document.getElementById('upSeed');
      if (seedEl) seedEl.value = (p.seed && p.seed !== '—') ? p.seed : '';
      const negEl = document.getElementById('upNeg');
      if (negEl && p.negPrompt) negEl.value = p.negPrompt;
    }

    else if (t === 'proxy_xai') {
      if (p.grokRes) _setRadio('upRes', String(p.grokRes).toUpperCase());
    }

    if (typeof updateUnifiedResInfo === 'function') updateUnifiedResInfo();
  }

  // ── Non-unified panels (Luma) ──
  if (model?.type === 'proxy_luma') {
    const imgWEl = document.getElementById('lumaImgWeight');
    if (imgWEl && p.imgWeight !== undefined) imgWEl.value = p.imgWeight;
    const styleWEl = document.getElementById('lumaStyleWeight');
    if (styleWEl && p.styleWeight !== undefined) styleWEl.value = p.styleWeight;
    const modWEl = document.getElementById('lumaModifyWeight');
    if (modWEl && p.modifyWeight !== undefined) modWEl.value = p.modifyWeight;
  }

  _setFld(item.folder);

  // ── Obnovit reference ze snapshotu ──
  if (item.usedRefs?.length) {
    refs = [];
    for (const snap of item.usedRefs) {
      if (refs.length >= getRefMax()) break;
      let asset = null;
      if (snap.assetId) asset = await dbGet('assets', snap.assetId);
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
    renderRefThumbs();
    if (refs.length) toast(`Restored ${refs.length} references from original job`, 'ok');
  }

  if (!item.usedRefs?.length) toast('Parameters loaded from gallery', 'ok');

  // ── Batch style/camera restore ──
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
        id: 'gis-gallery-archive',
        suggestedName: `gis-archive-${ts}.json`,
        types: [{ description: 'GIS Archive', accept: { 'application/json': ['.json'] } }]
      });
    } catch(e) {
      if (e.name === 'AbortError') return; // uživatel zrušil — nic nedělat
      fileHandle = null; // jiná chyba → fallback na legacy download
    }
  }

  // ── Krok 2: získat seznam IDs přes meta (rychlé, bez imageData) ──
  showProgress('Loading gallery index...');
  await new Promise(r => setTimeout(r, 0));

  const metas = await dbGetAllMeta();
  const folders = await dbGetAll('folders');
  const imageIds = metas.map(m => m.id);

  if (!imageIds.length) { hideProgress(); toast('Gallery is empty', 'err'); return; }

  const filename = `gis-archive-${ts}-${imageIds.length}img.json`;

  // ═══════════════════════════════════════════════════════════════════
  // STREAMING PATH — File System Access API s per-item zápisem
  // Memory peak: ~1 obrázek na iteraci (nikoli celá knihovna).
  // Řeší historický crash na ~320 obrázcích (memory blow-up 1+ GB).
  // ═══════════════════════════════════════════════════════════════════
  if (fileHandle) {
    let writable = null;
    try {
      writable = await fileHandle.createWritable();

      // Header bez uzavírací `}` + otevření `images` pole
      const header = JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        imageCount: imageIds.length,
        folders
      });
      await writable.write(header.slice(0, -1) + ', "images": [');

      // Stream každý obrázek zvlášť. Po awaitu se `img` dostane mimo scope
      // na další iteraci → GC ho sebere. Nikdy nedržíme víc než 1-2 obrázky v paměti.
      let skipped = 0;
      for (let i = 0; i < imageIds.length; i++) {
        const img = await dbGet('images', imageIds[i]);
        if (!img) { skipped++; continue; }
        // Pokud tohle je první úspěšný zápis, žádná čárka. Čárka se dává před každým dalším.
        const prefix = (i - skipped > 0) ? ',' : '';
        await writable.write(prefix + JSON.stringify(img));

        if (i % 10 === 9 || i === imageIds.length - 1) {
          showProgress(`Streaming images… ${i + 1} / ${imageIds.length}`);
          await new Promise(r => setTimeout(r, 0));
        }
      }
      await writable.write(']}');
      await writable.close();

      hideProgress();
      const msg = skipped
        ? `Archived — ${imageIds.length - skipped} images ✓ (${skipped} skipped)`
        : `Archived — ${imageIds.length} images ✓`;
      toast(msg, 'ok');
      return;
    } catch(e) {
      // Streaming selhal v půlce — soubor může být partial. Pokus o abort.
      try { if (writable) await writable.abort(); } catch {}
      hideProgress();
      console.error('[GIS] Gallery streaming export failed:', e);
      toast('Archive failed: ' + (e.message || e), 'err');
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FALLBACK PATH — file:// bez FS API (chunked nebo legacy)
  // ═══════════════════════════════════════════════════════════════════

  // Chunked threshold: nad 100 obrázků rozdělit do více souborů.
  // Důvod: Blob + JSON.stringify u >100 obrázků začne narážet na V8 string
  // limit (~512 MB) a Chrome může silent-truncate velké Blob writes na file://.
  // Chunked path = bezpečné pro libovolně velké knihovny.
  const CHUNK_SIZE = 100;

  if (imageIds.length > CHUNK_SIZE) {
    // MULTI-FILE CHUNKED EXPORT
    const archiveId = `arch-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const totalParts = Math.ceil(imageIds.length / CHUNK_SIZE);
    let totalImported = 0, totalSkipped = 0;

    // Browser prompt při multi-download: Chrome/Firefox se ptá
    // "Allow multiple downloads from this site?" — user musí povolit jednou.
    showProgress(`Preparing chunked archive (${totalParts} parts)…`);
    await new Promise(r => setTimeout(r, 0));

    for (let p = 0; p < totalParts; p++) {
      const partStart = p * CHUNK_SIZE;
      const partEnd = Math.min(partStart + CHUNK_SIZE, imageIds.length);
      const partIds = imageIds.slice(partStart, partEnd);

      showProgress(`Part ${p + 1} / ${totalParts} — loading ${partIds.length} images…`);
      await new Promise(r => setTimeout(r, 0));

      const partImages = [];
      for (let i = 0; i < partIds.length; i++) {
        const img = await dbGet('images', partIds[i]);
        if (!img) { totalSkipped++; continue; }
        partImages.push(img);
        totalImported++;
        if (i % 20 === 19) {
          showProgress(`Part ${p + 1} / ${totalParts} — loading ${i + 1} / ${partIds.length}…`);
          await new Promise(r => setTimeout(r, 0));
        }
      }

      showProgress(`Part ${p + 1} / ${totalParts} — writing file…`);
      await new Promise(r => setTimeout(r, 0));

      const partJson = JSON.stringify({
        version: 1,
        archiveId,
        partNumber: p + 1,
        totalParts,
        exportedAt: new Date().toISOString(),
        imageCount: partImages.length,
        imageCountTotal: imageIds.length,
        folders, // V každém partu — resilience pokud chybí konkrétní část
        images: partImages,
      });

      const blob = new Blob([partJson], { type: 'application/json' });
      const partFilename = `gis-archive-${ts}-part${p + 1}of${totalParts}-${partImages.length}img.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = partFilename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      // Chrome throttling mezi downloady — 500ms pauza aby se první dokončil
      // a dialog "allow multiple downloads" se nezacyklil
      await new Promise(r => setTimeout(r, 500));
    }

    hideProgress();
    const msg = totalSkipped
      ? `Archived — ${totalImported} images v ${totalParts} souborech (${totalSkipped} skipped)`
      : `Archived — ${totalImported} images v ${totalParts} souborech ✓`;
    toast(msg, 'ok');
    return;
  }

  // ═══════════════════════════════════════════════════════════════════
  // LEGACY single-file fallback pro malé knihovny (<= CHUNK_SIZE)
  // ═══════════════════════════════════════════════════════════════════
  showProgress(`Loading all ${imageIds.length} images…`);
  await new Promise(r => setTimeout(r, 0));

  const images = await dbGetAll('images');

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

  showProgress('Writing file…');
  await new Promise(r => setTimeout(r, 0));
  const blob = new Blob(parts, { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  hideProgress();
  toast(`Archive downloaded — ${images.length} images ✓`, 'ok');
}

async function importGallery(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  input.value = '';

  // Sort files: pokud jsou to chunked parts, seřaď podle partNumber v názvu
  // (gis-archive-...-part1of3-..., part2of3-..., part3of3-...)
  // Fallback: alphabetic sort (který stejně dává správné pořadí pro partNoOfM formát)
  files.sort((a, b) => {
    const ma = a.name.match(/part(\d+)of\d+/i);
    const mb = b.name.match(/part(\d+)of\d+/i);
    if (ma && mb) return parseInt(ma[1]) - parseInt(mb[1]);
    return a.name.localeCompare(b.name);
  });

  // ── Progress overlay — velký centered modal, stejný styl jako export ──
  let progressEl = null;
  let _totalCount = 0;   // celkem images napříč všemi soubory (pokud známo)
  let _fileLabel = '';   // např. "part 2 of 3" nebo ""
  function showProg(imported, skipped) {
    const done = imported + skipped;
    const total = _totalCount || '?';
    const pct = _totalCount ? Math.round(done / _totalCount * 100) : '';
    const line1 = _fileLabel ? `Importing images… (${_fileLabel})` : 'Importing images…';
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

  showProgMsg(files.length > 1
    ? `Loading ${files.length} archive parts…`
    : 'Loading archive…');
  await new Promise(r => setTimeout(r, 0));

  // ── Multi-file pre-scan: přečíst header každého souboru, sečíst imageCount ──
  // Pokud je soubor chunked, ma pole imageCount, imageCountTotal, partNumber, totalParts.
  // Taky zkontrolovat že všechny chunked parts patří ke stejnému archiveId a že máme všechny.
  let archiveId = null;
  let expectedTotalParts = null;
  let sumImageCount = 0;
  const partInfos = [];

  async function readHeader(file) {
    // Přečti jen prvních 64 KB — header s folders tam musí být kompletní
    const slice = file.slice(0, 65536);
    const text = await slice.text();
    const m = text.match(/"images"\s*:\s*\[/);
    if (!m) return null;
    try {
      const hRaw = text.slice(0, m.index).replace(/,\s*$/, '') + '}';
      return JSON.parse(hRaw);
    } catch (e) {
      return null;
    }
  }

  for (const file of files) {
    const h = await readHeader(file);
    if (!h) {
      partInfos.push({ file, header: null, valid: false });
      continue;
    }
    partInfos.push({ file, header: h, valid: true });
    sumImageCount += (h.imageCount || 0);
    if (h.archiveId) {
      if (archiveId === null) archiveId = h.archiveId;
      else if (archiveId !== h.archiveId) {
        hideProg();
        toast(`Error: different archive parts selected (${file.name} má jiný archiveId)`, 'err');
        return;
      }
      if (expectedTotalParts === null) expectedTotalParts = h.totalParts;
    }
  }

  const validParts = partInfos.filter(p => p.valid);
  if (!validParts.length) {
    hideProg();
    toast('No valid archive files found', 'err');
    return;
  }

  // Varování pokud chunked archive má chybějící parts
  if (archiveId && expectedTotalParts && validParts.length < expectedTotalParts) {
    const missing = expectedTotalParts - validParts.length;
    const proceed = confirm(`Warning: missing ${missing} of ${expectedTotalParts} chunked archive parts.\n\nProceed anyway? (Only available parts will be imported.)`);
    if (!proceed) { hideProg(); return; }
  }

  _totalCount = sumImageCount;

  // ── Načíst existující IDs a folders pro deduplikaci — JEDNOU pro všechny soubory ──
  const existingIds = new Set((await dbGetAllMeta()).map(i => i.id));
  const existingFolderIds = new Set((await dbGetAll('folders')).map(f => f.id));

  // ── Potvrzení od uživatele — jednou pro celý archiv (ne per-file) ──
  hideProg();
  const confirmMsg = files.length > 1
    ? `Import ${sumImageCount} images from ${validParts.length} archive parts into gallery?`
    : `Import ${sumImageCount || 'archive'} into gallery?`;
  if (!confirm(confirmMsg)) return;

  // ── Worker source — reusable across všech souborů ──
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
        while (!found) {
          var chunk1 = await reader.read();
          if (chunk1.done) break;
          await processStr(dec.decode(chunk1.value, {stream: true}));
        }
        if (!found) { self.postMessage({type:'error', message:'Archiv neobsahuje pole images'}); return; }
        // Auto-continue v multi-file režimu (confirm byl jednou předtím)
        self.postMessage({type:'meta-done'});
        var cmd2 = await waitMsg();
        if (cmd2 && cmd2.type === 'abort') { reader.cancel(); return; }

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

  let imported = 0, skipped = 0;
  showProg(0, 0);

  // ── Loop přes všechny soubory ──
  try {
    for (let fi = 0; fi < validParts.length; fi++) {
      const pinfo = validParts[fi];
      _fileLabel = validParts.length > 1
        ? `file ${fi + 1} / ${validParts.length}`
        : '';

      const worker = new Worker(workerUrl);
      try {
        await new Promise((resolve, reject) => {
          worker.onerror = e => reject(new Error(e.message || 'Worker error'));
          worker.onmessage = async ({data: msg}) => {
            try {
              if (msg.type === 'meta') {
                // Import folders z headeru (dedup)
                for (const f of (msg.folders || [])) {
                  if (!existingFolderIds.has(f.id)) {
                    await dbPut('folders', f);
                    existingFolderIds.add(f.id);
                  }
                }
                // Žádný confirm — už byl udělán jednou pro celý archiv
              } else if (msg.type === 'meta-done') {
                // Signál že header je zparsovaný; pokračuj
                worker.postMessage({type:'continue'});

              } else if (msg.type === 'image') {
                const img = msg.image;
                if (existingIds.has(img.id)) {
                  skipped++;
                } else {
                  await dbPut('images', img);
                  await dbPutMeta(img);
                  existingIds.add(img.id);
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
          worker.postMessage(pinfo.file);
        });
      } finally {
        worker.terminate();
      }
    }
  } catch(e) {
    hideProg();
    URL.revokeObjectURL(workerUrl);
    toast('Import error: ' + (e.message || e), 'err');
    return;
  }

  URL.revokeObjectURL(workerUrl);
  invalidateMetaCache();
  hideProg();

  const note = skipped > 0 ? ` (${skipped} skipped)` : '';
  const filePart = validParts.length > 1 ? ` from ${validParts.length} parts` : '';
  toast(`Imported ${imported} images${filePart} ✓${note}`, imported > 0 ? 'ok' : 'err');
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


// ══════════════════════════════════════════════════════
// MODAL IMAGE ZOOM — mouse wheel + drag to pan
// ══════════════════════════════════════════════════════
let _mzScale = 1;
let _mzTX = 0, _mzTY = 0;
let _mzDragging = false, _mzDragOriginX = 0, _mzDragOriginY = 0;
let _mzDragTX0 = 0, _mzDragTY0 = 0;

function _mzApply() {
  const img = document.getElementById('modalImg');
  if (!img) return;
  img.style.transform = `translate(${_mzTX}px,${_mzTY}px) scale(${_mzScale})`;
  const pct = document.getElementById('modalZoomPct');
  if (pct) pct.textContent = _mzScale === 1 ? 'fit' : Math.round(_mzScale * 100) + '%';
}

function resetModalZoom() {
  _mzScale = 1; _mzTX = 0; _mzTY = 0; _mzApply();
}

function setModal100pct() {
  const img = document.getElementById('modalImg');
  if (!img || !img.naturalWidth) return;
  // Compute scale factor so image renders at natural pixel size
  // img is currently at scale=1, so its rendered width = img.getBoundingClientRect().width / _mzScale
  const renderedW = img.getBoundingClientRect().width / _mzScale;
  if (renderedW > 0) {
    _mzScale = img.naturalWidth / renderedW;
    _mzTX = 0; _mzTY = 0;
    _mzApply();
  }
}

// Initialise zoom listeners once DOM is ready
function _initModalZoom() {
  const vp = document.getElementById('modalImgViewport');
  if (!vp || vp._zoomInited) return;
  vp._zoomInited = true;

  // ── Wheel zoom toward cursor ──
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = vp.getBoundingClientRect();
    // Mouse position relative to viewport center
    const mx = e.clientX - rect.left - rect.width  / 2;
    const my = e.clientY - rect.top  - rect.height / 2;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(12, _mzScale * factor));
    const ratio = newScale / _mzScale;
    // Shift translation so zoom is anchored to cursor
    _mzTX = mx + (_mzTX - mx) * ratio;
    _mzTY = my + (_mzTY - my) * ratio;
    _mzScale = newScale;
    _mzApply();
    vp.style.cursor = _mzScale > 1 ? 'grab' : 'crosshair';
  }, { passive: false });

  // ── Drag to pan ──
  vp.addEventListener('mousedown', e => {
    if (e.button !== 0 || _mzScale <= 1) return;
    _mzDragging = true;
    _mzDragOriginX = e.clientX; _mzDragOriginY = e.clientY;
    _mzDragTX0 = _mzTX; _mzDragTY0 = _mzTY;
    vp.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!_mzDragging) return;
    _mzTX = _mzDragTX0 + (e.clientX - _mzDragOriginX);
    _mzTY = _mzDragTY0 + (e.clientY - _mzDragOriginY);
    _mzApply();
  });
  document.addEventListener('mouseup', () => {
    if (!_mzDragging) return;
    _mzDragging = false;
    const vp2 = document.getElementById('modalImgViewport');
    if (vp2) vp2.style.cursor = _mzScale > 1 ? 'grab' : 'crosshair';
  });

  // Double-click → toggle fit/100%
  vp.addEventListener('dblclick', () => {
    if (_mzScale === 1) setModal100pct();
    else resetModalZoom();
  });
}

// Init on first open (DOM ready)
document.addEventListener('DOMContentLoaded', _initModalZoom);
// Fallback for file:// where DOMContentLoaded may have fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(_initModalZoom, 100);
}
