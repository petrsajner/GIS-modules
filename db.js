// ═══════════════════════════════════════════════════════
// INDEXEDDB — GALLERY STORAGE
// ═══════════════════════════════════════════════════════
let db;
async function initDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('GImageStudio', 7);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      const oldVersion = e.oldVersion;
      if (!d.objectStoreNames.contains('images')) {
        const store = d.createObjectStore('images', { keyPath: 'id' });
        store.createIndex('ts', 'ts');
        store.createIndex('model', 'model');
        store.createIndex('folder', 'folder');
      }
      if (!d.objectStoreNames.contains('folders')) {
        d.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('thumbs')) {
        d.createObjectStore('thumbs', { keyPath: 'id' });
      }
      // v4: asset library — persistentní reference
      if (!d.objectStoreNames.contains('assets')) {
        const aStore = d.createObjectStore('assets', { keyPath: 'id' });
        aStore.createIndex('ts', 'ts');
        aStore.createIndex('folder', 'folder');
      }
      // v4: složky assetů (oddělené od složek galerie)
      if (!d.objectStoreNames.contains('assetFolders')) {
        d.createObjectStore('assetFolders', { keyPath: 'id' });
      }
      // v5: images_meta — metadata bez imageData pro rychlé načítání galerie
      if (!d.objectStoreNames.contains('images_meta')) {
        const metaStore = d.createObjectStore('images_meta', { keyPath: 'id' });
        metaStore.createIndex('ts', 'ts');
        metaStore.createIndex('folder', 'folder');
      }
      // v6: video stores
      if (!d.objectStoreNames.contains('videos')) {
        const vStore = d.createObjectStore('videos', { keyPath: 'id' });
        vStore.createIndex('ts', 'ts');
        vStore.createIndex('folder', 'folder');
      }
      if (!d.objectStoreNames.contains('video_meta')) {
        const vmStore = d.createObjectStore('video_meta', { keyPath: 'id' });
        vmStore.createIndex('ts', 'ts');
        vmStore.createIndex('folder', 'folder');
      }
      if (!d.objectStoreNames.contains('video_thumbs')) {
        d.createObjectStore('video_thumbs', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('videoFolders')) {
        d.createObjectStore('videoFolders', { keyPath: 'id' });
      }
      // v7: assets_meta — metadata bez imageData pro rychlé načítání asset galerie
      if (!d.objectStoreNames.contains('assets_meta')) {
        const amStore = d.createObjectStore('assets_meta', { keyPath: 'id' });
        amStore.createIndex('ts', 'ts');
        amStore.createIndex('folder', 'folder');
      }
    };
    // Po otevření DB: pokud images_meta prázdná ale images má záznamy → migrovat
    req.onsuccess = async e => {
      db = e.target.result;
      // Migrace v4→v5: naplnit images_meta z existujících images
      try {
        const metaCount = await new Promise(res => {
          const tx = db.transaction('images_meta', 'readonly');
          const req2 = tx.objectStore('images_meta').count();
          req2.onsuccess = ev => res(ev.target.result);
          req2.onerror = () => res(0);
        });
        if (metaCount === 0) {
          // Přečíst všechny images a zapsat meta (bez imageData) do images_meta
          const allImages = await new Promise(res2 => {
            const tx2 = db.transaction('images', 'readonly');
            const req3 = tx2.objectStore('images').getAll();
            req3.onsuccess = ev => res2(ev.target.result);
            req3.onerror = () => res2([]);
          });
          if (allImages.length > 0) {
            const tx3 = db.transaction('images_meta', 'readwrite');
            const metaStore2 = tx3.objectStore('images_meta');
            for (const img of allImages) {
              const { imageData, ...meta } = img;
              metaStore2.put(meta);
            }
            await new Promise(res3 => { tx3.oncomplete = res3; tx3.onerror = res3; });
            console.log(`[GIS] Migrace v5: ${allImages.length} záznamů přeneseno do images_meta`);
          }
        }
      } catch(migrErr) {
        console.warn('[GIS] Migrace images_meta selhala (nevadí):', migrErr);
      }
      // Migrace v7: naplnit assets_meta z existujících assets (bez imageData)
      try {
        const amCount = await new Promise(res => {
          const tx = db.transaction('assets_meta', 'readonly');
          const req2 = tx.objectStore('assets_meta').count();
          req2.onsuccess = ev => res(ev.target.result);
          req2.onerror = () => res(0);
        });
        if (amCount === 0) {
          const allAssets = await new Promise(res2 => {
            const tx2 = db.transaction('assets', 'readonly');
            const req3 = tx2.objectStore('assets').getAll();
            req3.onsuccess = ev => res2(ev.target.result);
            req3.onerror = () => res2([]);
          });
          if (allAssets.length > 0) {
            const tx3 = db.transaction('assets_meta', 'readwrite');
            const amStore = tx3.objectStore('assets_meta');
            for (const a of allAssets) {
              const { imageData, ...meta } = a;
              amStore.put(meta);
            }
            await new Promise(res3 => { tx3.oncomplete = res3; tx3.onerror = res3; });
            console.log(`[GIS] Migrace v7: ${allAssets.length} asset meta přeneseno do assets_meta`);
          }
        }
      } catch(migrErr) {
        console.warn('[GIS] Migrace assets_meta selhala (nevadí):', migrErr);
      }
      res();
    };
    req.onerror = e => rej(e);
  }).then(() => {
    // Clear old thumbs if version changed (regenerates lazily as gallery is browsed)
    if (window._clearThumbsOnInit) {
      window._clearThumbsOnInit = false;
      thumbMemCache.clear();
      const tx = db.transaction('thumbs', 'readwrite');
      tx.objectStore('thumbs').clear();
    }
  });
}

// Generuje miniaturu 200×200 JPEG z base64 PNG
function generateThumb(b64data, mimeType) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 5000);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      const SIZE = 200;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      const iw = img.naturalWidth, ih = img.naturalHeight;
      // Landscape (wider than 1.15:1) → center crop to fill square
      // Square or portrait → letterbox: full image on dark gray background
      if (iw > ih * 1.15) {
        // Center crop
        const scale = Math.max(SIZE / iw, SIZE / ih);
        const sw = SIZE / scale, sh = SIZE / scale;
        const sx = (iw - sw) / 2, sy = (ih - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
      } else {
        // Pillarbox / letterbox — dark gray background, full image contained
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, SIZE, SIZE);
        const scale = Math.min(SIZE / iw, SIZE / ih);
        const dw = Math.round(iw * scale), dh = Math.round(ih * scale);
        const dx = Math.round((SIZE - dw) / 2), dy = Math.round((SIZE - dh) / 2);
        ctx.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
      }
      resolve(canvas.toDataURL('image/jpeg', 0.80).split(',')[1]);
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = `data:${mimeType || 'image/png'};base64,` + b64data;
  });
}

// Načte nebo vygeneruje a cachuje thumbnail
async function getThumb(id, imageData) {
  // Zkus načíst z cache
  const cached = await new Promise(res => {
    const tx = db.transaction('thumbs', 'readonly');
    const req = tx.objectStore('thumbs').get(id);
    req.onsuccess = e => res(e.target.result?.data || null);
    req.onerror = () => res(null);
  });
  if (cached) return cached;

  // Generuj a ulož
  const thumb = await generateThumb(imageData, 'image/png');
  if (thumb) {
    const tx = db.transaction('thumbs', 'readwrite');
    tx.objectStore('thumbs').put({ id, data: thumb });
  }
  return thumb || imageData; // fallback na plný obrázek
}

async function dbPut(store, item) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(item).onsuccess = e => res(e.target.result);
    tx.onerror = e => rej(e);
  });
}

async function dbGetAll(store) {
  return new Promise((res) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => res([]);
  });
}

async function dbGet(store, id) {
  return new Promise((res) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror = () => res(null);
  });
}

async function dbDelete(store, id) {
  return new Promise((res) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id).onsuccess = () => res();
  });
}

// Save generated images to DB — vrací galleryId
async function saveToGallery(result, prompt, targetFolder, refsCopy, rawPrompt, batchMeta) {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    throw new Error('Application integrity check failed. Please use the original GIS.');
  }
  const params = {};
  const mKey = result.modelKey || currentModel;
  const mObj = MODELS[mKey] || { name: result.model || 'Unknown' };

  if (result.type === 'gemini') {
    Object.assign(params, { thinking: result.thinkingLevel, refs: result.refs || 0, ratio: result.imageSize, size: result.imageSize });
  } else if (result.type === 'zimage') {
    Object.assign(params, { seed: result.seed, size: result.size, ratio: result.ratio,
      imageSize: result.imageSize,
      steps: result.steps, guidance: result.guidance, negPrompt: result.negPrompt,
      acceleration: result.acceleration });
  } else if (result.type === 'kling') {
    Object.assign(params, { seed: result.seed, size: result.size, ratio: result.ratio,
      klingResolution: result.klingResolution || '1K' });
  } else if (result.type === 'qwen2') {
    Object.assign(params, { seed: result.seed, size: result.size, ratio: result.ratio,
      steps: result.steps, guidance: result.guidance, acceleration: result.acceleration });
  } else {
    Object.assign(params, { seed: result.seed, size: result.size, ratio: result.ratio });
  }

  const imgData = result.type === 'gemini' ? result.finalImage : result.images[0];
  const dims = await getImageDimensions(imgData);
  const id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  // Batch mode: style is in batchStyle metadata — save clean rawPrompt, not styledPrompt
  const isBatch = !!(batchMeta?.batchStyle || batchMeta?.batchCamera);
  const record = {
    id,
    ts: Date.now(),
    model: mObj.name || result.model,
    modelKey: mKey,
    prompt: isBatch ? (rawPrompt || prompt) : prompt,
    rawPrompt: rawPrompt || prompt,
    params,
    imageData: imgData,
    folder: targetFolder || 'all',
    dims: fmtDims(dims),
    usedRefs: (refsCopy || []).map(r => ({
      assetId: r.assetId || null,
      autoName: r.autoName || null,
      userLabel: r.userLabel || '',
      mimeType: r.mimeType || 'image/png',
    })),
  };
  if (batchMeta?.batchStyle)  record.batchStyle  = batchMeta.batchStyle;
  if (batchMeta?.batchCamera) record.batchCamera = batchMeta.batchCamera;
  if (result.thoughtText && result.thoughtText.trim()) {
    record.thoughtText = result.thoughtText.trim();
  }
  await dbPut('images', record);
  await dbPutMeta(record);
  // Aktualizuj galerii na pozadí — i když je skrytá, aby byla ready při přepnutí
  renderGallery();
  generateThumb(imgData, 'image/png').then(thumb => {
    if (thumb) {
      const tx = db.transaction('thumbs', 'readwrite');
      tx.objectStore('thumbs').put({ id, data: thumb });
      thumbMemCache.set(id, thumb);
    }
  });
  return id;
}

// Upload obrázků ze souboru přímo do galerie
async function uploadImagesToGallery(files, inputEl) {
  const arr = Array.from(files);
  if (!arr.length) return;
  let added = 0, errors = 0;
  for (const file of arr) {
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = () => rej(new Error(`Read error: ${file.name}`));
        r.readAsDataURL(file);
      });
      const mimeType = file.type || 'image/png';
      const b64 = dataUrl.split(',')[1];
      if (!b64 || b64.length < 100) { errors++; continue; }
      const dims = await getImageDimensions(b64);
      const id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const record = {
        id,
        ts: Date.now(),
        model: 'Upload',
        modelKey: 'upload',
        prompt: `[Upload] ${file.name}`,
        rawPrompt: file.name,
        params: { filename: file.name, size: file.size },
        imageData: b64,
        mimeType,
        folder: currentFolder !== 'all' ? currentFolder : 'all',
        dims: fmtDims(dims),
        usedRefs: [],
      };
      await dbPut('images', record);
      await dbPutMeta(record);
      generateThumb(b64, mimeType).then(thumb => {
        if (thumb) {
          const tx = db.transaction('thumbs', 'readwrite');
          tx.objectStore('thumbs').put({ id, data: thumb });
          thumbMemCache.set(id, thumb);
        }
      });
      added++;
    } catch(e) {
      errors++;
      console.error('Gallery upload error:', e);
    }
  }
  if (inputEl) inputEl.value = '';
  renderGallery();
  const errNote = errors > 0 ? `, ${errors} selhalo` : '';
  toast(`↑ ${added} images uploaded to gallery${errNote}`, added > 0 ? 'ok' : 'err');
}

let currentFolder = 'all';

// ═══════════════════════════════════════════════════════
// META CACHE — rychlý přístup k metadatům galerie
// images_meta store obsahuje vše kromě imageData (~300B/záznam vs ~2MB)
// ═══════════════════════════════════════════════════════

// In-memory cache metadat — null = dirty (nutno načíst), array = platná data
let metaCache = null;
let metaCachePromise = null; // deduplicate souběžných volání

// Extrahuje metadata z image záznamu (bez imageData)
function metaFromRecord(rec) {
  const { imageData, ...meta } = rec;
  return meta;
}

// Zapíše meta do images_meta store (volat při každé mutaci)
async function dbPutMeta(record) {
  const meta = metaFromRecord(record);
  await new Promise((res, rej) => {
    const tx = db.transaction('images_meta', 'readwrite');
    tx.objectStore('images_meta').put(meta).onsuccess = () => res();
    tx.onerror = e => rej(e);
  });
  // Aktualizuj i cache pokud existuje
  if (metaCache) {
    const idx = metaCache.findIndex(m => m.id === meta.id);
    if (idx >= 0) metaCache[idx] = meta;
    else metaCache.push(meta);
  }
}

// Smaže záznam z images_meta store
async function dbDeleteMeta(id) {
  await new Promise(res => {
    const tx = db.transaction('images_meta', 'readwrite');
    tx.objectStore('images_meta').delete(id).onsuccess = () => res();
    tx.onerror = () => res();
  });
  if (metaCache) metaCache = metaCache.filter(m => m.id !== id);
}

// Invaliduje cache — volat POUZE při bulk operacích (import, deleteFolder)
function invalidateMetaCache() { metaCache = null; }

// ── Patch only images_meta (and cache) — no touch of images store ──────────
// Use for lightweight metadata changes: folder, favorite.
// Reads only ~300B from images_meta, writes back ~300B. Never loads imageData.
async function dbPatchMeta(id, patch) {
  // Read from images_meta (tiny — no imageData)
  const meta = await new Promise((res) => {
    const tx = db.transaction('images_meta', 'readonly');
    const req = tx.objectStore('images_meta').get(id);
    req.onsuccess = e => res(e.target.result || null);
    req.onerror  = () => res(null);
  });
  if (!meta) return; // item not found in meta store — skip
  Object.assign(meta, patch);
  await new Promise((res, rej) => {
    const tx = db.transaction('images_meta', 'readwrite');
    tx.objectStore('images_meta').put(meta).onsuccess = () => res();
    tx.onerror = e => rej(e);
  });
  // Update in-memory cache
  if (metaCache) {
    const idx = metaCache.findIndex(m => m.id === id);
    if (idx >= 0) Object.assign(metaCache[idx], patch);
  }
}

// Patch metadata pro asset — jen 'assets' store (bez imageData)
async function dbPatchAssetMeta(id, patch) {
  const item = await new Promise(res => {
    const tx = db.transaction('assets', 'readonly');
    const req = tx.objectStore('assets').get(id);
    req.onsuccess = e => res(e.target.result || null);
    req.onerror   = () => res(null);
  });
  if (!item) return;
  Object.assign(item, patch);
  await new Promise((res, rej) => {
    const tx = db.transaction(['assets', 'assets_meta'], 'readwrite');
    tx.objectStore('assets').put(item);
    const { imageData, ...meta } = item;
    tx.objectStore('assets_meta').put(meta);
    tx.oncomplete = () => res();
    tx.onerror = e => rej(e);
  });
  assetMetaCache = null;
}


// Načte metadata bez imageData — primárně z cache, jinak z images_meta store
async function dbGetAllMeta() {
  if (metaCache) return metaCache;
  if (metaCachePromise) return metaCachePromise;
  metaCachePromise = new Promise((res, rej) => {
    const tx = db.transaction('images_meta', 'readonly');
    const req = tx.objectStore('images_meta').getAll();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror = () => res([]);
  });
  metaCache = await metaCachePromise;
  metaCachePromise = null;
  return metaCache;
}

// ── Asset meta (v7) — lightweight listing without imageData ──
let assetMetaCache = null;
async function dbGetAllAssetMeta() {
  if (assetMetaCache) return assetMetaCache;
  return new Promise((res) => {
    const tx = db.transaction('assets_meta', 'readonly');
    const req = tx.objectStore('assets_meta').getAll();
    req.onsuccess = e => { assetMetaCache = e.target.result || []; res(assetMetaCache); };
    req.onerror = () => res([]);
  });
}
function dbInvalidateAssetMetaCache() { assetMetaCache = null; }
async function dbPutAssetMeta(asset) {
  const { imageData, ...meta } = asset;
  await dbPut('assets_meta', meta);
  assetMetaCache = null;
}
async function dbDeleteAssetMeta(id) {
  await dbDelete('assets_meta', id);
  assetMetaCache = null;
}
// Cache thumbů v paměti pro aktuální session (vyhne se opakovaným DB čtením)
const thumbMemCache = new Map();

// Thumb version — increment when generateThumb algorithm changes.
// On mismatch, all thumbs are cleared from DB and memory cache (regenerated lazily).
const THUMB_VERSION = 2; // v2: portrait/square images now use letterbox instead of center crop
(function checkThumbVersion() {
  const stored = parseInt(localStorage.getItem('gis_thumb_version') || '1');
  if (stored < THUMB_VERSION) {
    // Clear all thumbs — they'll regenerate as gallery is browsed
    localStorage.setItem('gis_thumb_version', String(THUMB_VERSION));
    // DB clear happens after initDB, schedule it
    window._clearThumbsOnInit = true;
  }
})();

async function getThumbCached(id, fallbackLoader) {
  if (thumbMemCache.has(id)) return thumbMemCache.get(id);
  const tx = db.transaction('thumbs', 'readonly');
  const thumb = await new Promise(res => {
    const req = tx.objectStore('thumbs').get(id);
    req.onsuccess = e => res(e.target.result?.data || null);
    req.onerror = () => res(null);
  });
  if (thumb) { thumbMemCache.set(id, thumb); return thumb; }
  return null; // thumb ještě neexistuje — lazy generate
}

// ═══════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════
async function toggleFavorite(e, id) {
  e.stopPropagation();
  await toggleFavoriteItem(id);

  // Always refresh folder counts in sidebar
  renderFolders();
  // If currently in favorites folder and item was unliked → remove it from view
  if (!newFav && currentFolder === 'fav') {
    if (el) el.remove();
    const remaining = document.querySelectorAll('#galGrid .gal-item').length;
    document.getElementById('galCount').textContent = `${remaining} images`;
  }
}

async function toggleFavoriteItem(id) {
  // Read current state from images_meta (no imageData loaded)
  const metas = metaCache || await dbGetAllMeta();
  const meta = metas.find(m => m.id === id);
  const newFav = !(meta?.favorite);
  await dbPatchMeta(id, { favorite: newFav });

  // ── Sync ALL UI locations showing this image's favorite state ──
  // 1. Gallery card
  const galEl = document.querySelector(`.gal-item[data-id="${id}"]`);
  if (galEl) {
    galEl.classList.toggle('favorited', newFav);
    const heart = galEl.querySelector('.gal-heart');
    if (heart) {
      heart.className = `gal-heart ${newFav ? 'on' : 'off'}`;
      heart.title = newFav ? 'Remove from favorites' : 'Add to favorites';
      heart.textContent = newFav ? '♥' : '♡';
    }
  }
  // 2. Output/render card like button
  const likeBtn = document.querySelector(`.like-btn[data-galid="${id}"]`);
  if (likeBtn) {
    likeBtn.textContent = newFav ? '♥ Liked' : '♡ Like';
    likeBtn.classList.toggle('liked', newFav);
    const likeCard = likeBtn.closest('.img-card');
    if (likeCard) likeCard.classList.toggle('is-liked', newFav);
  }
  // 3. Gallery modal (if open for this image)
  if (typeof currentModalId !== 'undefined' && currentModalId === id) {
    const fb = document.getElementById('mFavBtn');
    if (fb) {
      fb.textContent = newFav ? '♥ Favorites' : '♡ Favorite';
      fb.style.borderColor = newFav ? '#ff4d6d' : 'var(--border)';
      fb.style.color = newFav ? '#ff4d6d' : 'var(--dim)';
    }
  }

  return newFav;
}

// ═══════════════════════════════════════════════════════
// EXPORT VYBRANÝCH
// ═══════════════════════════════════════════════════════
async function exportSelected() {
  if (!selectedGalItems.size) return;
  const ids = [...selectedGalItems];

  // Dialog — vybrat formát
  const fmt = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:400;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = `
      <div style="background:var(--s1);border:1px solid var(--border);padding:24px;min-width:320px;display:flex;flex-direction:column;gap:16px;">
        <div style="font-family:Syne,sans-serif;font-weight:700;font-size:15px;">↓ Exportovat ${ids.length} obrázků</div>
        <div style="font-size:11px;color:var(--dim);line-height:1.8;">
          Vyber formát výstupu:
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="ibtn" id="expPng" style="justify-content:flex-start;padding:10px 14px;gap:10px;">
            <span style="font-size:16px;">🖼</span>
            <span><b>Individual PNG</b><br><span style="font-size:10px;color:var(--dim);">Each image separately via Save As dialog</span></span>
          </button>
          <button class="ibtn" id="expZip" style="justify-content:flex-start;padding:10px 14px;gap:10px;border-color:#4a8a6a;color:#66cc99;">
            <span style="font-size:16px;">📦</span>
            <span><b>ZIP archiv</b><br><span style="font-size:10px;color:var(--dim);">All images in a single ZIP file</span></span>
          </button>
          <button class="ibtn" id="expCancel" style="margin-top:4px;">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#expPng').onclick = () => { document.body.removeChild(ov); resolve('png'); };
    ov.querySelector('#expZip').onclick = () => { document.body.removeChild(ov); resolve('zip'); };
    ov.querySelector('#expCancel').onclick = () => { document.body.removeChild(ov); resolve(null); };
    ov.onclick = e => { if (e.target === ov) { document.body.removeChild(ov); resolve(null); } };
  });
  if (!fmt) return;

  // Načíst obrázky
  const items = [];
  for (const id of ids) {
    const item = await dbGet('images', id);
    if (item) items.push(item);
  }

  if (fmt === 'png') {
    // Individuální PNG — sekvenčně přes showSaveFilePicker
    let saved = 0;
    for (const item of items) {
      const bytes = atob(item.imageData);
      const ab = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) ab[i] = bytes.charCodeAt(i);
      const blob = new Blob([ab], { type: 'image/png' });
      const filename = `${item.model}-${new Date(item.ts).toISOString().slice(0,10)}-${item.id.slice(-6)}.png`;
      if (window.showSaveFilePicker) {
        try {
          const fh = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'PNG', accept: { 'image/png': ['.png'] } }]
          });
          const ws = await fh.createWritable();
          await ws.write(blob);
          await ws.close();
          saved++;
        } catch(e) {
          if (e.name === 'AbortError') break; // uživatel zrušil
        }
      } else {
        const a = document.createElement('a');
        a.href = `data:image/png;base64,${item.imageData}`;
        a.download = filename;
        a.click();
        await new Promise(r => setTimeout(r, 300));
        saved++;
      }
    }
    toast(`Exported ${saved} PNG`, 'ok');
  } else {
    // ZIP přes JSZip
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
    await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });

    const zip = new JSZip();
    for (const item of items) {
      const bytes = atob(item.imageData);
      const ab = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) ab[i] = bytes.charCodeAt(i);
      const filename = `${item.model}-${new Date(item.ts).toISOString().slice(0,10)}-${item.id.slice(-6)}.png`;
      zip.file(filename, ab);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const ts = new Date().toISOString().slice(0,10);
    const zipName = `gis-export-${ts}-${items.length}img.zip`;

    if (window.showSaveFilePicker) {
      try {
        const fh = await window.showSaveFilePicker({
          suggestedName: zipName,
          types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }]
        });
        const ws = await fh.createWritable();
        await ws.write(blob);
        await ws.close();
        toast(`Exported ${items.length} images to ZIP`, 'ok');
      } catch(e) {
        if (e.name !== 'AbortError') toast('Chyba exportu: ' + e.message, 'err');
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = zipName; a.click();
      URL.revokeObjectURL(url);
      toast(`ZIP downloaded: ${zipName}`, 'ok');
    }
  }
}

