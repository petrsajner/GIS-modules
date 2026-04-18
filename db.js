// ═══════════════════════════════════════════════════════
// INDEXEDDB — GALLERY STORAGE
// ═══════════════════════════════════════════════════════
let db;
async function initDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('GImageStudio', 8);
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
      // v8: prefs — key/value store pro perzistenci FileSystemDirectoryHandle a dalších preferencí
      if (!d.objectStoreNames.contains('prefs')) {
        d.createObjectStore('prefs', { keyPath: 'id' });
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

// ═══════════════════════════════════════════════════════
// PREFS — key/value store pro FileSystemDirectoryHandle + další preference
// ═══════════════════════════════════════════════════════
async function prefsGet(key) {
  const rec = await dbGet('prefs', key);
  return rec?.value ?? null;
}
async function prefsPut(key, value) {
  return dbPut('prefs', { id: key, value });
}
async function prefsDelete(key) {
  return dbDelete('prefs', key);
}

// ═══════════════════════════════════════════════════════
// DOWNLOAD DIRECTORY — persistent FileSystemDirectoryHandle
// ═══════════════════════════════════════════════════════
// Kinds: 'images' (gallery), 'videos' (video library), 'zip' (ZIP archive folder)
// Chrome ukládá FileSystemDirectoryHandle přes structured clone do IDB.
// Permission lifecycle:
//   - První pick: user vybere folder + grant permission (v rámci showDirectoryPicker dialogu)
//   - Další runs: handle persistovaný → queryPermission
//       'granted'  → silent reuse
//       'prompt'   → requestPermission (1-klik dialog) — musí být v user gesture
//       'denied'   → re-pick přes showDirectoryPicker
//
// Flow "jako normální programy": showDirectoryPicker({ startIn: handle }) —
// dialog se otevře předvyplněný posledním použitým folderem. User OK → pokračuje.
// Moderní a silent override = ensurePermissionSilent (pro případy bez user gesture).

async function ensurePermission(handle, mode = 'readwrite') {
  if (!handle || typeof handle.queryPermission !== 'function') return false;
  try {
    let p = await handle.queryPermission({ mode });
    if (p === 'granted') return true;
    if (p === 'prompt') {
      p = await handle.requestPermission({ mode });
      return p === 'granted';
    }
    return false;
  } catch (e) {
    console.warn('[GIS] permission query failed:', e);
    return false;
  }
}

// Získá handle pro danou kind. Pokud existuje persistovaný a je stále platný,
// pokusí se ho reusovat. Jinak/vždycky otevře showDirectoryPicker s startIn=lastHandle.
// Vrací handle (nebo null pokud user cancelne).
async function pickDownloadDir(kind, { forceDialog = true } = {}) {
  if (!window.showDirectoryPicker) {
    throw new Error('Directory picker not supported in this browser. Please use Chrome 86+.');
  }
  const prefKey = `downloadDir_${kind}`;
  const saved = await prefsGet(prefKey); // FileSystemDirectoryHandle nebo null

  // forceDialog=false → silent reuse pokud granted (používá se v batch loopech)
  if (!forceDialog && saved) {
    const ok = await ensurePermission(saved, 'readwrite');
    if (ok) return saved;
  }

  // Normal flow: dialog s předvyplněným last handle (nebo default Downloads)
  const opts = { id: `gis-${kind}`, mode: 'readwrite' };
  if (saved) {
    try {
      // Chrome respektuje startIn s handle. Pokud handle invalid (smazaný folder),
      // Chrome graceful fallne na default — žádný throw.
      opts.startIn = saved;
    } catch (_) { /* ignore */ }
  } else {
    opts.startIn = 'downloads';
  }
  let handle;
  try {
    handle = await window.showDirectoryPicker(opts);
  } catch (e) {
    if (e.name === 'AbortError') return null; // user cancelled
    throw e;
  }
  // Po úspěšném pick je permission automaticky granted pro tuto session.
  // Uložit handle pro příště.
  try { await prefsPut(prefKey, handle); } catch (e) {
    console.warn('[GIS] failed to persist download dir handle:', e);
  }
  return handle;
}

// Zapíše blob jako soubor do adresáře (FileSystemDirectoryHandle).
async function writeFileToDir(dirHandle, filename, blob) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const ws = await fileHandle.createWritable();
  await ws.write(blob);
  await ws.close();
}

// ═══════════════════════════════════════════════════════
// INLINE ZIP WRITER — store-only (no compression, no external deps)
// ═══════════════════════════════════════════════════════
// ZIP formát: LFH per entry → file data → Central Directory entries → EOCD.
// Store-only (method=0) je ideální pro PNG/MP4 (už komprimované).
// Nic z CDN — všechno lokální, jak Petr výslovně požaduje.

const _GIS_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function _gisCrc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = (c >>> 8) ^ _GIS_CRC_TABLE[(c ^ bytes[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

// Vyrobí ZIP blob ze souborů. files = [{ name: string, data: Uint8Array }]
function buildStoreOnlyZip(files) {
  const te = new TextEncoder();
  const chunks = [];           // pro file part (LFHs + data)
  const central = [];          // Central Directory entries
  let offset = 0;              // byte offset každé LFH od začátku archivu

  // DOS date/time pro "not set" → 0
  for (const f of files) {
    const nameBytes = te.encode(f.name);
    const crc = _gisCrc32(f.data);
    const size = f.data.length >>> 0;

    // Local File Header (30 bytes fixed + name)
    const lfh = new ArrayBuffer(30 + nameBytes.length);
    const dv = new DataView(lfh);
    dv.setUint32(0,  0x04034b50, true); // signature
    dv.setUint16(4,  20, true);         // version needed (2.0)
    dv.setUint16(6,  0x0800, true);     // flags: bit 11 = UTF-8 filename
    dv.setUint16(8,  0, true);          // method = 0 (store)
    dv.setUint16(10, 0, true);          // mod time
    dv.setUint16(12, 0x0021, true);     // mod date (1980-01-01)
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);       // compressed size
    dv.setUint32(22, size, true);       // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);          // extra field length
    new Uint8Array(lfh, 30).set(nameBytes);
    chunks.push(new Uint8Array(lfh));
    chunks.push(f.data);

    // Central Directory File Header (46 bytes fixed + name)
    const cdfh = new ArrayBuffer(46 + nameBytes.length);
    const dv2 = new DataView(cdfh);
    dv2.setUint32(0,  0x02014b50, true);
    dv2.setUint16(4,  20, true);         // version made by
    dv2.setUint16(6,  20, true);         // version needed
    dv2.setUint16(8,  0x0800, true);     // flags
    dv2.setUint16(10, 0, true);          // method
    dv2.setUint16(12, 0, true);          // mod time
    dv2.setUint16(14, 0x0021, true);     // mod date
    dv2.setUint32(16, crc, true);
    dv2.setUint32(20, size, true);
    dv2.setUint32(24, size, true);
    dv2.setUint16(28, nameBytes.length, true);
    dv2.setUint16(30, 0, true);          // extra length
    dv2.setUint16(32, 0, true);          // comment length
    dv2.setUint16(34, 0, true);          // disk number
    dv2.setUint16(36, 0, true);          // internal attrs
    dv2.setUint32(38, 0, true);          // external attrs
    dv2.setUint32(42, offset, true);     // offset of local header
    new Uint8Array(cdfh, 46).set(nameBytes);
    central.push(new Uint8Array(cdfh));

    offset += lfh.byteLength + size;
  }

  // End of Central Directory
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const centralOffset = offset;

  const eocd = new ArrayBuffer(22);
  const dv3 = new DataView(eocd);
  dv3.setUint32(0,  0x06054b50, true);
  dv3.setUint16(4,  0, true);                    // disk number
  dv3.setUint16(6,  0, true);                    // central dir disk
  dv3.setUint16(8,  files.length, true);         // entries this disk
  dv3.setUint16(10, files.length, true);         // total entries
  dv3.setUint32(12, centralSize, true);          // central dir size
  dv3.setUint32(16, centralOffset, true);        // central dir offset
  dv3.setUint16(20, 0, true);                    // comment length

  return new Blob([...chunks, ...central, new Uint8Array(eocd)], { type: 'application/zip' });
}

// ═══════════════════════════════════════════════════════
// DOWNLOAD PROGRESS OVERLAY — reusable UI pro gallery/video export
// ═══════════════════════════════════════════════════════
// Shared singleton overlay. Každá download operace by měla volat
// dlProgShow() na začátku a dlProgHide() v finally bloku.
// User VŽDY vidí co se děje — žádné "tiché" downloady bez feedbacku.
let _dlProgEl = null;
function dlProgShow(title, body) {
  if (!_dlProgEl) {
    _dlProgEl = document.createElement('div');
    _dlProgEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;';
    _dlProgEl.innerHTML = `
      <div style="background:var(--s1);border:1px solid var(--border);padding:28px 42px;text-align:center;min-width:340px;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.6);">
        <div id="_dlProgTitle" style="font-family:Syne,sans-serif;font-size:20px;font-weight:700;color:var(--accent);margin-bottom:10px;"></div>
        <div id="_dlProgBody" style="font-size:14px;color:var(--text);line-height:1.5;"></div>
        <div style="margin-top:16px;height:2px;background:var(--s2);overflow:hidden;border-radius:1px;">
          <div id="_dlProgBar" style="height:100%;width:0%;background:var(--accent);transition:width .3s;"></div>
        </div>
      </div>`;
    document.body.appendChild(_dlProgEl);
  }
  document.getElementById('_dlProgTitle').textContent = title;
  document.getElementById('_dlProgBody').textContent = body;
}
function dlProgUpdate(body, pctOrDone, total) {
  if (!_dlProgEl) return;
  const bodyEl = document.getElementById('_dlProgBody');
  const barEl  = document.getElementById('_dlProgBar');
  if (bodyEl) bodyEl.textContent = body;
  if (barEl) {
    let pct = 0;
    if (total != null) pct = Math.max(0, Math.min(100, Math.round((pctOrDone / total) * 100)));
    else if (pctOrDone != null) pct = Math.max(0, Math.min(100, pctOrDone));
    barEl.style.width = pct + '%';
  }
}
function dlProgHide() {
  if (_dlProgEl && document.body.contains(_dlProgEl)) {
    document.body.removeChild(_dlProgEl);
  }
  _dlProgEl = null;
}

// ═══════════════════════════════════════════════════════
// PROTOCOL DETECTION
// ═══════════════════════════════════════════════════════
// Na file:// protokolu jsou showSaveFilePicker + showDirectoryPicker
// nepredikovatelné: někdy tiše selžou bez zobrazení dialogu, v jiných
// verzích Chromu vyhodí SecurityError v rámci user gesture. Spolehlivé
// řešení je API úplně nevolat a jít na a.click() blob fallback, který
// na file:// funguje deterministicky (vše jde do Chrome Downloads).
const _IS_FILE_PROTOCOL = (typeof location !== 'undefined' && location.protocol === 'file:');
const _HAS_FS_API = !_IS_FILE_PROTOCOL
  && typeof window.showSaveFilePicker === 'function'
  && typeof window.showDirectoryPicker === 'function';



// Save generated images to DB — vrací galleryId
async function saveToGallery(result, prompt, targetFolder, refsCopy, rawPrompt, batchMeta) {
  if (typeof _GIS_SIG === 'undefined' || typeof GIS_COPYRIGHT === 'undefined' ||
      _GIS_SIG !== btoa(unescape(encodeURIComponent(GIS_COPYRIGHT))).slice(0, 20)) {
    throw new Error('Application integrity check failed. Please use the original GIS.');
  }
  const params = {};
  const mKey = result.modelKey || currentModel;
  const mObj = MODELS[mKey] || { name: result.model || 'Unknown' };

  // Snap = complete UI state captured at submit time (generate.js buildParams).
  // Result object contains only returned fields (seed/size/ratio); snap has the rest.
  const snap = batchMeta?.geminiSnap || batchMeta?.imagenSnap || batchMeta?.fluxSnap
            || batchMeta?.sdSnap     || batchMeta?.klingSnap  || batchMeta?.zimageSnap
            || batchMeta?.qwen2Snap  || batchMeta?.wan27Snap  || batchMeta?.xaiSnap
            || batchMeta?.lumaSnap   || {};

  // ── Per-type param storage — save EVERYTHING needed for full reuse ──
  // reuseJobFromGallery reads this map; one record = one image so count isn't stored
  // (user adjusts count before re-running).
  if (result.type === 'gemini') {
    Object.assign(params, {
      ratio:           result.imageSize,               // kept for legacy display chips
      size:            result.imageSize,
      imageSize:       result.imageSize || snap.imageSize || null,
      aspectRatio:     snap.aspectRatio || null,
      thinking:        result.thinkingLevel || snap.thinkingLevel || 'minimal',
      thinkingLevel:   result.thinkingLevel || snap.thinkingLevel || 'minimal',
      useSearch:       !!snap.useSearch,
      persistentRetry: !!snap.persistentRetry,
      refs:            result.refs || 0,
    });
  } else if (result.type === 'imagen') {
    Object.assign(params, {
      seed:        result.seed,
      size:        result.size,
      ratio:       result.ratio,
      aspectRatio: snap.aspectRatio || result.ratio || null,
      imageSize:   snap.imageSize   || null,
    });
  } else if (result.type === 'flux') {
    Object.assign(params, {
      seed:            result.seed,
      size:            result.size,
      ratio:           result.ratio,
      aspectRatio:     snap.ratio || result.ratio || null,
      tier:            snap.tier || null,
      steps:           snap.steps,
      guidance:        snap.guidance,
      safetyTolerance: snap.safetyTolerance,
    });
  } else if (result.type === 'seedream') {
    Object.assign(params, {
      seed:        result.seed,
      size:        result.size,
      ratio:       result.ratio,
      aspectRatio: snap.aspectRatio || result.ratio || null,
      resolution:  snap.resolution  || null,
      safety:      snap.safety !== false,
    });
  } else if (result.type === 'kling') {
    Object.assign(params, {
      seed:            result.seed,
      size:            result.size,
      ratio:           result.ratio,
      klingResolution: snap.resolution || '1K',
    });
  } else if (result.type === 'zimage') {
    Object.assign(params, {
      seed:         result.seed,
      size:         result.size,
      ratio:        result.ratio,
      imageSize:    snap.imageSize,
      steps:        snap.steps,
      guidance:     snap.guidance,
      negPrompt:    snap.negPrompt,
      acceleration: snap.acceleration,
      safety:       snap.safety !== false,
      strength:     snap.strength != null ? snap.strength : null,
    });
  } else if (result.type === 'qwen2') {
    Object.assign(params, {
      seed:         result.seed,
      size:         result.size,
      ratio:        result.ratio,
      resolution:   snap.resolution  || null,
      steps:        snap.steps,
      guidance:     snap.guidance,
      acceleration: snap.acceleration,
      negPrompt:    snap.negPrompt || '',
      safety:       snap.safety !== false,
    });
  } else if (result.type === 'wan27r') {
    Object.assign(params, {
      seed:      result.seed,
      size:      result.size,
      ratio:     result.ratio,
      sizeTier:  snap.sizeTier || null,
      thinking:  !!snap.thinking,
      negPrompt: snap.negPrompt || '',
    });
  } else if (result.type === 'proxy_xai') {
    Object.assign(params, {
      seed:        result.seed,
      size:        result.size,
      ratio:       result.ratio,
      aspectRatio: snap.aspectRatio || result.ratio || null,
      grokRes:     snap.grokRes || null,
    });
  } else if (result.type === 'proxy_luma') {
    Object.assign(params, {
      seed:         result.seed,
      size:         result.size,
      ratio:        result.ratio,
      aspectRatio:  snap.aspectRatio || result.ratio || null,
      imgWeight:    snap.imgWeight,
      styleWeight:  snap.styleWeight,
      modifyWeight: snap.modifyWeight,
    });
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
// EXPORT VYBRANÝCH — Individual PNG nebo ZIP archive
// ═══════════════════════════════════════════════════════
// Flow strategie:
//   - file:// protokol (Petrův typický setup): FS Access API je nespolehlivé.
//     ZIP i Individual jdou přes a.click() blob URL do Chrome Downloads.
//     PROGRESS OVERLAY je viditelný během každé fáze (build, compress, save).
//   - http(s):// protokol: FS Access API funguje → directory picker s persistencí
//     (handle uložen v IDB store 'prefs' pod downloadDir_images).
//
// Pro Petrův use-case: ZIP je doporučený na file:// — Chrome seskupí bulk a.click()
// downloads do auto-pojmenovaného subfolderu, což je špatný UX pro vybírání cesty.
async function exportSelected() {
  if (!selectedGalItems.size) return;
  const ids = [...selectedGalItems];

  // Dialog — vybrat formát
  const fmt = await new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:400;display:flex;align-items:center;justify-content:center;';
    const zipRec = _IS_FILE_PROTOCOL ? ' <span style="color:var(--accent);font-size:10px;">(recommended)</span>' : '';
    const pngNote = _IS_FILE_PROTOCOL
      ? 'All files go to Chrome Downloads folder (folder picker unavailable on file://)'
      : 'Choose a folder — all files save there';
    ov.innerHTML = `
      <div style="background:var(--s1);border:1px solid var(--border);padding:24px;min-width:340px;display:flex;flex-direction:column;gap:16px;">
        <div style="font-family:Syne,sans-serif;font-weight:700;font-size:15px;">↓ Export ${ids.length} image${ids.length > 1 ? 's' : ''}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button class="ibtn" id="expZip" style="justify-content:flex-start;padding:10px 14px;gap:10px;border-color:#4a8a6a;color:#66cc99;">
            <span style="font-size:16px;">📦</span>
            <span><b>ZIP archive</b>${zipRec}<br><span style="font-size:10px;color:var(--dim);">Single .zip file with all images</span></span>
          </button>
          <button class="ibtn" id="expPng" style="justify-content:flex-start;padding:10px 14px;gap:10px;">
            <span style="font-size:16px;">🖼</span>
            <span><b>Individual PNG files</b><br><span style="font-size:10px;color:var(--dim);">${pngNote}</span></span>
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

  // ── Load images (pod progress overlay) ──
  dlProgShow(`↓ Export ${ids.length} image${ids.length > 1 ? 's' : ''}`, 'Loading images from library…');
  dlProgUpdate('Loading images from library…', 0, 100);
  await new Promise(r => setTimeout(r, 30)); // yield pro UI paint

  const items = [];
  for (let i = 0; i < ids.length; i++) {
    const item = await dbGet('images', ids[i]);
    if (item) items.push(item);
    if (i % 5 === 4 || i === ids.length - 1) {
      dlProgUpdate(`Loading… ${i + 1} / ${ids.length}`, i + 1, ids.length);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  if (!items.length) {
    dlProgHide();
    toast('No images to export', 'err');
    return;
  }

  const makeFilename = (item) => `${(item.model || 'image').replace(/[^\w-]/g, '_')}-${new Date(item.ts).toISOString().slice(0,10)}-${item.id.slice(-6)}.png`;
  const base64ToBytes = (b64) => {
    const bin = atob(b64);
    const ab = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) ab[i] = bin.charCodeAt(i);
    return ab;
  };

  try {
    if (fmt === 'zip') {
      await _exportAsZip(items, makeFilename, base64ToBytes);
    } else {
      await _exportAsIndividualPng(items, makeFilename, base64ToBytes);
    }
  } catch (e) {
    console.error('[GIS] Export failed:', e);
    toast('Export failed: ' + e.message, 'err');
  } finally {
    dlProgHide();
  }
}

// ── ZIP flow — inline ZIP writer, viditelný progress přes celou cestu ──
async function _exportAsZip(items, makeFilename, base64ToBytes) {
  // Fáze 1: decode base64 + collect files (rychlé ale ne instant)
  dlProgShow(`📦 Building ZIP archive`, `Preparing ${items.length} images…`);
  dlProgUpdate(`Preparing images… 0 / ${items.length}`, 0, items.length);
  await new Promise(r => setTimeout(r, 30));

  const files = [];
  let totalBytes = 0;
  for (let i = 0; i < items.length; i++) {
    const data = base64ToBytes(items[i].imageData);
    files.push({ name: makeFilename(items[i]), data });
    totalBytes += data.length;
    if (i % 3 === 2 || i === items.length - 1) {
      dlProgUpdate(`Preparing images… ${i + 1} / ${items.length}`, i + 1, items.length);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Fáze 2: build ZIP (store-only, fast even for large archives)
  const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
  dlProgUpdate(`Assembling ZIP… (${mbTotal} MB)`, 95, 100);
  await new Promise(r => setTimeout(r, 30));
  console.log(`[GIS] Building ZIP: ${files.length} files, ${mbTotal} MB`);

  const blob = buildStoreOnlyZip(files);
  const ts = new Date().toISOString().slice(0,10);
  const zipName = `gis-export-${ts}-${items.length}img.zip`;

  // Fáze 3: save
  dlProgUpdate(`Saving ${zipName} (${mbTotal} MB)…`, 100, 100);
  await new Promise(r => setTimeout(r, 30));

  // Na file:// protocol: přímo a.click() do Downloads (FS API je nespolehlivé)
  if (!_HAS_FS_API) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke po delay — Chrome potřebuje URL držet do zahájení downloadu
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    console.log(`[GIS] ZIP saved to Downloads: ${zipName}`);
    dlProgHide();
    toast(`✓ ZIP downloaded: ${zipName}`, 'ok');
    return;
  }

  // Na http(s):// protocol: showSaveFilePicker s perzistencí (Chrome si pamatuje přes id)
  try {
    const lastDir = await prefsGet('downloadDir_images');
    const opts = {
      id: 'gis-zip',
      suggestedName: zipName,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    };
    if (lastDir) { try { opts.startIn = lastDir; } catch (_) {} }
    const fileHandle = await window.showSaveFilePicker(opts);
    const ws = await fileHandle.createWritable();
    await ws.write(blob);
    await ws.close();
    dlProgHide();
    toast(`✓ Saved: ${fileHandle.name} (${items.length} images)`, 'ok');
  } catch (e) {
    if (e.name === 'AbortError') { dlProgHide(); return; } // user cancelled
    // FS API selhalo → fallback na a.click()
    console.warn('[GIS] showSaveFilePicker failed, falling back to a.click():', e);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = zipName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    dlProgHide();
    toast(`✓ ZIP downloaded to Downloads folder: ${zipName}`, 'ok');
  }
}

// ── Individual PNG flow — directory picker (http) nebo sekvenční a.click (file://) ──
async function _exportAsIndividualPng(items, makeFilename, base64ToBytes) {
  // Pokud FS API funguje (http/https), zkus directory picker
  if (_HAS_FS_API) {
    let dir = null;
    dlProgHide(); // skryj během picker dialogu
    try {
      dir = await pickDownloadDir('images', { forceDialog: true });
    } catch (e) {
      console.warn('[GIS] pickDownloadDir failed:', e);
    }
    if (dir) {
      dlProgShow(`🖼 Saving to "${dir.name}"`, `0 / ${items.length}`);
      let saved = 0, failed = 0;
      const failures = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          const blob = new Blob([base64ToBytes(item.imageData)], { type: 'image/png' });
          await writeFileToDir(dir, makeFilename(item), blob);
          saved++;
        } catch (e) {
          failed++;
          failures.push(makeFilename(item) + ': ' + e.message);
        }
        dlProgUpdate(`${saved + failed} / ${items.length}`, saved + failed, items.length);
      }
      dlProgHide();
      if (failed === 0) {
        console.log(`[GIS] Saved ${saved} PNG to folder "${dir.name}"`);
        toast(`✓ Saved ${saved} PNG to "${dir.name}"`, 'ok');
      } else {
        console.error('[GIS] PNG save failures:', failures);
        toast(`Saved ${saved}, ${failed} failed — see console`, 'err');
      }
      return;
    }
    // Picker failed/cancelled → pokračovat na fallback
  }

  // Fallback flow: sekvenční a.click() do Chrome Downloads
  // Chrome v některých verzích seskupí bulk downloads do auto-subfolderu
  // (např. "gis-export"). Pro předvídatelnější výsledek doporučujeme ZIP.
  dlProgShow(`🖼 Downloading PNG files`, `0 / ${items.length} — files go to Chrome Downloads`);
  let saved = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const blob = new Blob([base64ToBytes(item.imageData)], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = makeFilename(item);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      saved++;
    } catch (e) {
      console.error('[GIS] PNG download failed:', e);
    }
    dlProgUpdate(`${saved} / ${items.length} — files go to Chrome Downloads`, saved, items.length);
    // Delay je kritický — Chrome jinak blokuje dávkové downloads
    await new Promise(r => setTimeout(r, 250));
  }
  dlProgHide();
  console.log(`[GIS] Downloaded ${saved} PNG to Downloads folder`);
  toast(`✓ Downloaded ${saved} PNG to Chrome Downloads`, 'ok');
}

