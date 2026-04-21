// ═══════════════════════════════════════════════════════
// VIDEO — archive export / import + thumbnail regeneration
// ═══════════════════════════════════════════════════════

// nebo ArrayBuffer — pro JSON serializaci musí být konvertovány na base64.
async function exportVideoArchive() {
  const ts = new Date().toISOString().slice(0,10);

  // Step 1: save picker — musí být v user gesture, před await ops
  let fileHandle = null;
  const suggestedName = `gis-video-archive-${ts}.json`;
  if (_HAS_FS_API) {
    try {
      fileHandle = await window.showSaveFilePicker({
        id: 'gis-video-archive',
        suggestedName,
        types: [{ description: 'GIS Video Archive', accept: { 'application/json': ['.json'] } }]
      });
    } catch (e) {
      if (e.name === 'AbortError') return;
      fileHandle = null; // fallback na legacy download
    }
  }

  // Step 2: načíst meta (jen id + folder pro iteraci)
  dlProgShow('↓ Archiving video library', 'Loading video index…');
  await new Promise(r => setTimeout(r, 30));

  const metas = await dbGetAll('video_meta');
  const folders = await dbGetAll('videoFolders');
  const videoIds = (metas || []).map(m => m.id).filter(Boolean);

  if (!videoIds.length) {
    dlProgHide();
    toast('Video library is empty', 'err');
    return;
  }

  const filename = `gis-video-archive-${ts}-${videoIds.length}vid.json`;

  // Helper: převod ArrayBuffer/Uint8Array na base64 (chunk-by-chunk, bez stack overflow)
  function bytesToBase64(bytes) {
    let bin = '';
    const CHUNK = 8192;
    for (let k = 0; k < bytes.length; k += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(k, k + CHUNK));
    }
    return btoa(bin);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STREAMING PATH — File System Access API, per-video zápis
  // Memory peak: ~1 video naráz (typicky 5-50 MB), nikoli celá knihovna.
  // Staré chování drželo všechna videa v paměti najednou → OOM +
  // writer někdy silently truncated velký Blob → rozbitý JSON.
  // ═══════════════════════════════════════════════════════════════════
  if (fileHandle) {
    let writable = null;
    let totalBytes = 0;
    let skipped = 0;

    try {
      writable = await fileHandle.createWritable();

      const header = JSON.stringify({
        version: 1,
        type: 'video-archive',
        exportedAt: new Date().toISOString(),
        videoCount: videoIds.length,
        folders,
      });
      await writable.write(header.slice(0, -1) + ', "videos": [');

      for (let i = 0; i < videoIds.length; i++) {
        const v = await dbGet('videos', videoIds[i]);
        if (!v) { skipped++; continue; }

        // Binary → base64, per-video (uvolní paměť v další iteraci)
        let videoDataB64 = null;
        if (v.videoData) {
          const bytes = v.videoData instanceof Uint8Array
            ? v.videoData
            : new Uint8Array(v.videoData);
          totalBytes += bytes.length;
          videoDataB64 = bytesToBase64(bytes);
        }
        // Přidat thumbnail do archive entry (pokud v DB existuje)
        const thumbRec = await dbGet('video_thumbs', videoIds[i]).catch(() => null);
        const thumbData = thumbRec?.data || null;
        const serializable = { ...v, videoData: videoDataB64, thumbData };
        const prefix = (i - skipped > 0) ? ',' : '';
        await writable.write(prefix + JSON.stringify(serializable));

        // Yield after each video (videa jsou velká — aktualizovat UI průběžně)
        const mb = (totalBytes / 1024 / 1024).toFixed(1);
        dlProgUpdate(`Streaming videos… ${i + 1} / ${videoIds.length} (${mb} MB)`, i + 1, videoIds.length);
        await new Promise(r => setTimeout(r, 0));
      }

      await writable.write(']}');
      await writable.close();

      const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
      dlProgHide();
      const base = `✓ Archived — ${videoIds.length - skipped} videos (${mbTotal} MB)`;
      toast(skipped ? `${base} (${skipped} skipped)` : base, 'ok');
      return;
    } catch (e) {
      try { if (writable) await writable.abort(); } catch {}
      dlProgHide();
      console.error('[GIS] Video archive streaming failed:', e);
      toast('Archive failed: ' + (e.message || e), 'err');
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FALLBACK PATH — file:// bez FS API (chunked nebo legacy)
  // ═══════════════════════════════════════════════════════════════════

  // Video chunk = 5 per part. Videa jsou větší než obrázky (5-50 MB per video),
  // takže chunk musí být menší než u gallery (100 images).
  // 5 × 30 MB avg = 150 MB per part — bezpečně pod V8 limit.
  const VIDEO_CHUNK_SIZE = 5;

  if (videoIds.length > VIDEO_CHUNK_SIZE) {
    // MULTI-FILE CHUNKED EXPORT
    const archiveId = `varc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const totalParts = Math.ceil(videoIds.length / VIDEO_CHUNK_SIZE);
    let totalImported = 0, totalSkipped = 0, totalBytes = 0;

    try {
      dlProgShow('↓ Archiving video library (chunked)', `Preparing ${totalParts} parts…`);
      await new Promise(r => setTimeout(r, 30));

      for (let p = 0; p < totalParts; p++) {
        const partStart = p * VIDEO_CHUNK_SIZE;
        const partEnd = Math.min(partStart + VIDEO_CHUNK_SIZE, videoIds.length);
        const partIds = videoIds.slice(partStart, partEnd);

        dlProgUpdate(`Part ${p + 1} / ${totalParts} — loading videos…`, p, totalParts);
        await new Promise(r => setTimeout(r, 0));

        const partVideos = [];
        let partBytes = 0;
        for (let i = 0; i < partIds.length; i++) {
          const v = await dbGet('videos', partIds[i]);
          if (!v) { totalSkipped++; continue; }
          let videoDataB64 = null;
          if (v.videoData) {
            const bytes = v.videoData instanceof Uint8Array
              ? v.videoData
              : new Uint8Array(v.videoData);
            partBytes += bytes.length;
            videoDataB64 = bytesToBase64(bytes);
          }
          // Přidat thumbnail (pokud existuje)
          const thumbRec = await dbGet('video_thumbs', partIds[i]).catch(() => null);
          const thumbData = thumbRec?.data || null;
          partVideos.push({ ...v, videoData: videoDataB64, thumbData });
          totalImported++;
          const partMb = (partBytes / 1024 / 1024).toFixed(1);
          dlProgUpdate(`Part ${p + 1} / ${totalParts} — video ${i + 1} / ${partIds.length} (${partMb} MB)`, p, totalParts);
          await new Promise(r => setTimeout(r, 0));
        }
        totalBytes += partBytes;

        dlProgUpdate(`Part ${p + 1} / ${totalParts} — writing file…`, p, totalParts);
        await new Promise(r => setTimeout(r, 0));

        const partJson = JSON.stringify({
          version: 1,
          type: 'video-archive',
          archiveId,
          partNumber: p + 1,
          totalParts,
          exportedAt: new Date().toISOString(),
          videoCount: partVideos.length,
          videoCountTotal: videoIds.length,
          folders,
          videos: partVideos,
        });

        const partMb = (partBytes / 1024 / 1024).toFixed(1);
        const partFilename = `gis-video-archive-${ts}-part${p + 1}of${totalParts}-${partVideos.length}vid.json`;
        const blob = new Blob([partJson], { type: 'application/json' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = partFilename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        // Chrome throttling mezi downloady
        await new Promise(r => setTimeout(r, 700));
      }

      const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
      dlProgHide();
      const msg = totalSkipped
        ? `✓ Archived — ${totalImported} videos v ${totalParts} souborech (${mbTotal} MB, ${totalSkipped} skipped)`
        : `✓ Archived — ${totalImported} videos v ${totalParts} souborech (${mbTotal} MB)`;
      toast(msg, 'ok');
      return;
    } catch (e) {
      dlProgHide();
      console.error('[GIS] Video chunked archive failed:', e);
      toast('Archive failed: ' + e.message, 'err');
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LEGACY single-file fallback pro malé knihovny (<= VIDEO_CHUNK_SIZE)
  // ═══════════════════════════════════════════════════════════════════
  try {
    dlProgUpdate(`Loading ${videoIds.length} videos…`, 0, videoIds.length);
    await new Promise(r => setTimeout(r, 30));

    const videos = await dbGetAll('videos');

    const header = JSON.stringify({
      version: 1,
      type: 'video-archive',
      exportedAt: new Date().toISOString(),
      videoCount: videos.length,
      folders,
    });
    const parts = [header.slice(0, -1) + ', "videos": ['];
    let totalBytes = 0;

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      let videoDataB64 = null;
      if (v.videoData) {
        const bytes = v.videoData instanceof Uint8Array
          ? v.videoData
          : new Uint8Array(v.videoData);
        totalBytes += bytes.length;
        videoDataB64 = bytesToBase64(bytes);
      }
      const thumbRec = await dbGet('video_thumbs', v.id).catch(() => null);
      const thumbData = thumbRec?.data || null;
      const serializable = { ...v, videoData: videoDataB64, thumbData };
      if (i > 0) parts.push(',');
      parts.push(JSON.stringify(serializable));

      if (i % 3 === 2 || i === videos.length - 1) {
        const mb = (totalBytes / 1024 / 1024).toFixed(1);
        dlProgUpdate(`Serializing videos… ${i + 1} / ${videos.length} (${mb} MB)`, i + 1, videos.length);
        await new Promise(r => setTimeout(r, 0));
      }
    }
    parts.push(']}');

    const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
    dlProgUpdate(`Writing archive… (${mbTotal} MB)`, 95, 100);
    await new Promise(r => setTimeout(r, 30));
    const blob = new Blob(parts, { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    dlProgHide();
    toast(`✓ Archive downloaded: ${filename} (${mbTotal} MB)`, 'ok');
  } catch (e) {
    dlProgHide();
    console.error('[GIS] Video archive (legacy) failed:', e);
    toast('Archive failed: ' + e.message, 'err');
  }
}

// ═══════════════════════════════════════════════════════════════════
// Video thumbnail regeneration
// ═══════════════════════════════════════════════════════════════════

/**
 * Regeneruje thumbnails pro videa která je nemají v `video_thumbs` store.
 * Běží asynchronně v pozadí — UI se nezablokuje, karty se aktualizují
 * postupně jak thumby vznikají.
 *
 * @param {Array<{id: string, videoBytes: Uint8Array}>} queue - videa k zpracování
 * @param {Function} [onProgress] - optional callback(done, total)
 */
async function _regenerateThumbsInBackground(queue, onProgress) {
  if (!queue || !queue.length) return;

  // Non-modal toast-like indikátor v rohu (mini progress)
  let ind = document.createElement('div');
  ind.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--s1);border:1px solid var(--border);padding:10px 16px;z-index:800;font-family:IBM Plex Mono,monospace;font-size:11px;color:var(--text);box-shadow:0 4px 16px rgba(0,0,0,.5);';
  document.body.appendChild(ind);
  function setInd(done, total) {
    if (!ind) return;
    ind.innerHTML = `<span style="color:var(--accent);">⟳</span> Generating thumbnails… <b>${done}</b> / ${total}`;
  }
  setInd(0, queue.length);

  let done = 0;
  for (const item of queue) {
    try {
      const blob = new Blob([item.videoBytes], { type: 'video/mp4' });
      const thumbData = await generateVideoThumb(blob);
      if (thumbData) {
        await dbPut('video_thumbs', { id: item.id, data: thumbData });
        // In-place DOM update: najdi kartu a vlož/aktualizuj thumbnail img.
        // Karta může obsahovat buď <img> (pokud thumb už kdy byl), nebo
        // <div>🎬</div> placeholder (pokud ne). Oba případy ošetříme.
        try {
          const card = document.querySelector(`.video-card[data-id="${item.id}"]`);
          if (card) {
            const wrap = card.querySelector('.video-thumb-wrap');
            if (wrap) {
              const existingImg = wrap.querySelector('img');
              if (existingImg) {
                existingImg.src = thumbData;
              } else {
                // Nahradit placeholder div s <img>. Najít první div (emoji placeholder)
                // a vložit před něj nový img, pak ho smazat.
                const placeholder = wrap.querySelector('div[style*="🎬"], div:first-child');
                const img = document.createElement('img');
                img.src = thumbData;
                img.alt = '';
                if (placeholder && placeholder.textContent?.includes('🎬')) {
                  wrap.replaceChild(img, placeholder);
                } else {
                  wrap.insertBefore(img, wrap.firstChild);
                }
              }
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn('[GIS] Thumb regen failed for', item.id, e);
    }
    done++;
    setInd(done, queue.length);
    if (onProgress) onProgress(done, queue.length);
    // Yield často — generateVideoThumb už drží video element, ale CPU pauza nutná
    await new Promise(r => setTimeout(r, 50));
  }

  // Po dokončení: smazat indikátor + full refresh (jistota že se vše zobrazí)
  setTimeout(() => {
    if (ind) { try { document.body.removeChild(ind); } catch {} ind = null; }
    if (typeof renderVideoGallery === 'function') renderVideoGallery();
  }, 1500);
  toast(`✓ Thumbnails generated: ${done}`, 'ok');
}

/**
 * Spustitelné z F12 konzole: `regenerateMissingVideoThumbs()`
 * Projde všechna videa v knihovně, pro každé bez thumbnailu ho vygeneruje.
 * Určeno pro retroaktivní opravu po importu staršího archivu bez thumbů.
 */
async function regenerateMissingVideoThumbs() {
  const allVideos = await dbGetAll('video_meta');
  if (!allVideos.length) {
    toast('No videos in library', 'err');
    return;
  }
  console.log(`[GIS] Scanning ${allVideos.length} videos for missing thumbnails…`);

  const queue = [];
  for (const meta of allVideos) {
    const existingThumb = await dbGet('video_thumbs', meta.id).catch(() => null);
    if (existingThumb && existingThumb.data) continue;
    // Chybí thumb — načíst binární data
    const full = await dbGet('videos', meta.id).catch(() => null);
    if (!full || !full.videoData) continue;
    const videoBytes = full.videoData instanceof Uint8Array
      ? full.videoData
      : new Uint8Array(full.videoData);
    queue.push({ id: meta.id, videoBytes });
  }

  if (!queue.length) {
    toast('All videos already have thumbnails ✓', 'ok');
    return;
  }

  console.log(`[GIS] Will regenerate ${queue.length} missing thumbnails…`);
  toast(`Regenerating ${queue.length} missing thumbnails… (check corner indicator)`, 'ok');
  await _regenerateThumbsInBackground(queue);
}

async function importVideoArchive(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  input.value = '';

  // Fronta videí, která nemají thumbnail v archivu a musíme ho vygenerovat
  // po importu v pozadí (neblokuje UI, user vidí placeholder ikonu dokud thumb nevznikne)
  const thumbRegenQueue = [];

  // Sort: pokud jsou to chunked parts, seřaď podle partNumber
  files.sort((a, b) => {
    const ma = a.name.match(/part(\d+)of\d+/i);
    const mb = b.name.match(/part(\d+)of\d+/i);
    if (ma && mb) return parseInt(ma[1]) - parseInt(mb[1]);
    return a.name.localeCompare(b.name);
  });

  try {
    dlProgShow('↑ Loading video archive', files.length > 1
      ? `Reading ${files.length} archive parts…`
      : 'Reading file…');
    await new Promise(r => setTimeout(r, 30));

    // ── Pre-scan: přečíst každý soubor, validovat, sesbírat videos array ──
    // Pozn: video archive neumí streaming parser (na rozdíl od gallery), takže
    // každý file stejně musí projít JSON.parse. Pro chunked to ale znamená
    // každý part zvlášť (menší V8 string tlak).
    let archiveId = null;
    let expectedTotalParts = null;
    const validParts = [];
    let grandTotal = 0;

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      dlProgUpdate(`Parsing file ${fi + 1} / ${files.length}…`, fi, files.length);
      await new Promise(r => setTimeout(r, 0));

      const text = await file.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('[GIS] Invalid JSON in', file.name, e);
        continue;
      }
      if (!data || data.type !== 'video-archive' || !Array.isArray(data.videos)) {
        console.warn('[GIS] Skipping non-video-archive file:', file.name);
        continue;
      }

      // Chunked archive validation
      if (data.archiveId) {
        if (archiveId === null) archiveId = data.archiveId;
        else if (archiveId !== data.archiveId) {
          dlProgHide();
          toast(`Error: different archive parts selected (${file.name} má jiný archiveId)`, 'err');
          return;
        }
        if (expectedTotalParts === null) expectedTotalParts = data.totalParts;
      }

      validParts.push({ file, data });
      grandTotal += data.videos.length;
    }

    if (!validParts.length) {
      dlProgHide();
      toast('No valid video archive files found', 'err');
      return;
    }

    // Varování při chybějících chunked parts
    if (archiveId && expectedTotalParts && validParts.length < expectedTotalParts) {
      dlProgHide();
      const missing = expectedTotalParts - validParts.length;
      const proceed = confirm(`Warning: missing ${missing} of ${expectedTotalParts} chunked archive parts.\n\nProceed anyway? (Only available parts will be imported.)`);
      if (!proceed) return;
      dlProgShow('↑ Loading video archive', 'Preparing import…');
    }

    if (!grandTotal) {
      dlProgHide();
      toast('Archive is empty', 'err');
      return;
    }

    // Import folders z prvního partu (ostatní části mají stejné folders díky resilient export)
    for (const part of validParts) {
      if (Array.isArray(part.data.folders)) {
        for (const f of part.data.folders) {
          try { await dbPut('videoFolders', f); } catch (_) {}
        }
      }
    }

    // Videos: iterace přes všechny části, convert base64 → Uint8Array
    let imported = 0, skipped = 0, processed = 0;

    for (let pi = 0; pi < validParts.length; pi++) {
      const part = validParts[pi];
      const partLabel = validParts.length > 1 ? ` (part ${pi + 1}/${validParts.length})` : '';

      for (let i = 0; i < part.data.videos.length; i++) {
        const v = part.data.videos[i];
        try {
          const existing = await dbGet('videos', v.id).catch(() => null);
          if (existing) {
            skipped++;
          } else {
            let videoBytes = null;
            if (v.videoData && typeof v.videoData === 'string') {
              const bin = atob(v.videoData);
              videoBytes = new Uint8Array(bin.length);
              for (let k = 0; k < bin.length; k++) videoBytes[k] = bin.charCodeAt(k);
            }
            // videoData se strip z záznamu v videos store (je tam separátní pole)
            // thumbData se strip a uloží do video_thumbs store
            const { thumbData: archivedThumb, ...vRest } = v;
            await dbPut('videos', { ...vRest, videoData: videoBytes });
            try {
              await dbPut('video_meta', {
                id: v.id, ts: v.ts, model: v.model, modelKey: v.modelKey,
                prompt: v.prompt, rawPrompt: v.rawPrompt, folder: v.folder, dims: v.dims,
              });
            } catch (_) {}
            // Thumb handling:
            // - Pokud archive thumbData existuje (nové archivy), uložit přímo → rychlé
            // - Pokud ne (staré archivy z v203en před thumb fixem), zařadit do queue
            //   na regeneraci po importu (generateVideoThumb je pomalé, nebloku import)
            if (archivedThumb) {
              try { await dbPut('video_thumbs', { id: v.id, data: archivedThumb }); } catch (_) {}
            } else if (videoBytes) {
              thumbRegenQueue.push({ id: v.id, videoBytes });
            }
            imported++;
          }
        } catch (e) {
          console.error('[GIS] Failed to import video:', v.id, e);
          skipped++;
        }
        processed++;
        if (i % 2 === 1 || i === part.data.videos.length - 1) {
          dlProgUpdate(`Importing${partLabel}… ${processed} / ${grandTotal}`, processed, grandTotal);
          await new Promise(r => setTimeout(r, 0));
        }
      }

      // Uvolnit paměť mezi party — umožní GC sesbírat předchozí videos array
      part.data = null;
    }

    dlProgHide();
    if (typeof renderVideoGallery === 'function') renderVideoGallery();
    if (typeof renderVideoFolders === 'function') renderVideoFolders();
    const filePart = validParts.length > 1 ? ` from ${validParts.length} parts` : '';
    if (skipped) toast(`✓ Imported ${imported}${filePart}, skipped ${skipped} (already in library)`, 'ok');
    else toast(`✓ Imported ${imported} videos${filePart}`, 'ok');

    // Background thumbnail regeneration pro videa bez archivovaného thumbu
    // (staré archivy před thumb fixem v Session 2.1).
    // Běží async — user může mezitím používat app, UI karty se aktualizují postupně.
    if (thumbRegenQueue.length > 0) {
      _regenerateThumbsInBackground(thumbRegenQueue);
    }
  } catch (e) {
    dlProgHide();
    console.error('[GIS] Video archive import failed:', e);
    toast('Import failed: ' + e.message, 'err');
  }
}
