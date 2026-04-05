// ═══════════════════════════════════════════════════════
// PAINT ENGINE
// ═══════════════════════════════════════════════════════
const paintEngines = {}; // 'p' = Paint tab, 'a' = Annotate modal
let paintBgColor = '#000000'; // default black

function createPaintEngine(prefix, canvas) {
  const state = {
    prefix,
    canvas,
    ctx: canvas.getContext('2d'),
    tool: 'pen',
    color: '#ff4444',
    bgColor: '#000000',  // barva pozadí pro gumu
    lineWidth: 4,
    opacity: 1.0,
    fillShapes: false,
    drawing: false,
    startX: 0, startY: 0,
    snapshot: null,
    history: [],
    textInput: null,
    bgImageData: null,
  };

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy };
  }

  function saveHistory() {
    state.history.push(state.ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (state.history.length > 40) state.history.shift();
  }

  function applyStyle() {
    state.ctx.globalAlpha = state.opacity;
    state.ctx.strokeStyle = state.color;
    state.ctx.fillStyle = state.color;
    state.ctx.lineWidth = state.lineWidth;
    state.ctx.lineCap = 'round';
    state.ctx.lineJoin = 'round';
  }

  function drawShape(x1, y1, x2, y2) {
    applyStyle();
    state.ctx.globalCompositeOperation = 'source-over';
    state.ctx.beginPath();
    if (state.tool === 'line') {
      state.ctx.moveTo(x1, y1); state.ctx.lineTo(x2, y2); state.ctx.stroke();
    } else if (state.tool === 'rect') {
      const w = x2 - x1, h = y2 - y1;
      if (state.fillShapes) state.ctx.fillRect(x1, y1, w, h);
      state.ctx.strokeRect(x1, y1, w, h);
    } else if (state.tool === 'ellipse') {
      const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
      if (rx < 1 || ry < 1) return;
      state.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (state.fillShapes) state.ctx.fill();
      state.ctx.stroke();
    }
  }

  function placeText(e) {
    if (state.textInput) commitText();
    const pos = getPos(e);
    const fontSize = Math.max(14, state.lineWidth * 5);
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const screenX = rect.left + pos.x * scaleX;
    const screenY = rect.top + pos.y * scaleY - fontSize * 0.8;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'paint-text-input';
    inp.style.cssText = `left:${screenX}px;top:${screenY}px;font-size:${fontSize * scaleY}px;color:${state.color};`;
    document.body.appendChild(inp);
    inp.focus();
    state.textInput = { el: inp, x: pos.x, y: pos.y, fontSize };
    inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === 'Escape') { if (ev.key === 'Enter') commitText(); else { document.body.removeChild(inp); state.textInput = null; } ev.stopPropagation(); }
    });
    inp.addEventListener('blur', () => setTimeout(() => { if (state.textInput && state.textInput.el === inp) commitText(); }, 120));
  }

  function commitText() {
    if (!state.textInput) return;
    const { el, x, y, fontSize } = state.textInput;
    const txt = el.value.trim();
    if (txt) {
      applyStyle();
      state.ctx.globalCompositeOperation = 'source-over';
      state.ctx.font = `bold ${fontSize}px 'IBM Plex Mono', monospace`;
      state.ctx.fillText(txt, x, y);
      saveHistory();
    }
    if (document.body.contains(el)) document.body.removeChild(el);
    state.textInput = null;
  }

  // Event handlers
  function onStart(e) {
    e.preventDefault();
    if (state.tool === 'text') { placeText(e); return; }
    state.drawing = true;
    const p = getPos(e);
    state.startX = p.x; state.startY = p.y;
    state.snapshot = state.ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (state.tool === 'pen' || state.tool === 'eraser') {
      applyStyle();
      if (state.tool === 'eraser') {
        state.ctx.globalCompositeOperation = 'destination-out';
        state.ctx.globalAlpha = 1;
      } else {
        state.ctx.globalCompositeOperation = 'source-over';
      }
      state.ctx.beginPath();
      state.ctx.moveTo(p.x, p.y);
    }
  }

  function onMove(e) {
    e.preventDefault();
    if (!state.drawing) return;
    const p = getPos(e);
    if (state.tool === 'pen' || state.tool === 'eraser') {
      state.ctx.lineTo(p.x, p.y);
      state.ctx.stroke();
    } else {
      state.ctx.putImageData(state.snapshot, 0, 0);
      drawShape(state.startX, state.startY, p.x, p.y);
    }
  }

  function onEnd(e) {
    if (!state.drawing) return;
    state.drawing = false;
    state.ctx.globalCompositeOperation = 'source-over';
    state.ctx.globalAlpha = 1;
    saveHistory();
  }

  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onEnd);
  canvas.addEventListener('mouseleave', onEnd);
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd);

  // Public interface
  state.saveHistory = saveHistory;
  state.commitText = commitText;
  return state;
}

// ── Toolbar controls (shared for both paint/annotate) ──
function setPTool(prefix, tool) {
  const eng = paintEngines[prefix];
  if (!eng) return;
  if (eng.textInput) eng.commitText();
  eng.tool = tool;
  const curMap = { pen:'cur-pen', eraser:'cur-eraser', line:'cur-line', rect:'cur-rect', ellipse:'cur-ellipse', text:'cur-text' };
  eng.canvas.className = curMap[tool] || 'cur-pen';
  document.querySelectorAll(`#${prefix}Toolbar .ptool`).forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`${prefix}T_${tool}`);
  if (btn) btn.classList.add('active');
}

function setPColor(prefix, color, swatchEl, pickerEl) {
  const eng = paintEngines[prefix];
  if (!eng) return;
  eng.color = color;
  // Update swatch highlights
  document.querySelectorAll(`#${prefix}Colors .pswatch`).forEach(s => s.classList.remove('active'));
  if (swatchEl) {
    swatchEl.classList.add('active');
    const picker = document.getElementById(`${prefix}CustomColor`);
    if (picker) picker.value = color;
  }
  if (pickerEl) {
    // custom picker — deselect all swatches
    document.querySelectorAll(`#${prefix}Colors .pswatch`).forEach(s => s.classList.remove('active'));
  }
}

function setPSize(prefix, val) {
  const eng = paintEngines[prefix];
  if (eng) eng.lineWidth = parseInt(val);
  const el = document.getElementById(`${prefix}SizeVal`);
  if (el) el.textContent = val;
}

function setPOpacity(prefix, val) {
  const eng = paintEngines[prefix];
  if (eng) eng.opacity = parseInt(val) / 100;
  const el = document.getElementById(`${prefix}OpacityVal`);
  if (el) el.textContent = val + '%';
}

function setPFill(prefix, checked) {
  const eng = paintEngines[prefix];
  if (eng) eng.fillShapes = checked;
}

function pUndo(prefix) {
  const eng = paintEngines[prefix];
  if (!eng || eng.history.length <= 1) return;
  eng.history.pop();
  eng.ctx.putImageData(eng.history[eng.history.length - 1], 0, 0);
}

function pClear(prefix) {
  const eng = paintEngines[prefix];
  if (!eng || !eng.history.length) return;
  if (!confirm('Clear canvas?')) return;
  eng.ctx.putImageData(eng.history[0], 0, 0);
  eng.history = [eng.history[0]];
}

function pExportRef(prefix) {
  const eng = paintEngines[prefix];
  if (!eng) return;
  // Flatten onto opaque bg for paint tab; annotate has image bg already
  const tmp = document.createElement('canvas');
  tmp.width = eng.canvas.width; tmp.height = eng.canvas.height;
  const tc = tmp.getContext('2d');
  if (prefix === 'p') {
    tc.fillStyle = paintBgColor;
    tc.fillRect(0, 0, tmp.width, tmp.height);
  }
  tc.drawImage(eng.canvas, 0, 0);
  const b64 = tmp.toDataURL('image/png').split(',')[1];
  addRefFromBase64(b64, `${prefix === 'p' ? 'paint' : 'annotated'}-${Date.now()}.png`);
  if (prefix === 'a') closeAnnotateModal();
}

// ── Annotate export mode ──
let annotateExportMode = 'A'; // 'A' = kompozit, 'B' = separátní vrstvy

function setAnnotateExportMode(mode) {
  annotateExportMode = mode;
  document.getElementById('aExportA').classList.toggle('active', mode === 'A');
  document.getElementById('aExportB').classList.toggle('active', mode === 'B');
}

// Exportuje anotovaný obrázek jako referenci — metoda B nebo A
async function pExportAnnotate() {
  const eng = paintEngines['a'];
  if (!eng) return;
  if (eng.textInput) eng.commitText();

  if (annotateExportMode === 'A') {
    // Metoda A: kompozit — originál + anotace sloučené v jednom obrázku
    const b64 = eng.canvas.toDataURL('image/png').split(',')[1];
    await addRefFromBase64(b64, `annotate-composite-${Date.now()}.png`);
    closeAnnotateModal();
  } else {
    // Metoda B: vrstvy — 2 separátní reference
    //   Ref 1: čistý originál
    //   Ref 2: čisté tahy (anotace) na bílém pozadí — BEZ originálu
    if (refs.length >= getRefMax() - 1) { toast(`Not enough room for 2 references (max ${getRefMax()})`, 'err'); return; }

    // Ref 1: originál — z prvního history framu (před jakýmikoli tahy)
    const origImageData = eng.history[0];
    const origCanvas = document.createElement('canvas');
    origCanvas.width = eng.canvas.width; origCanvas.height = eng.canvas.height;
    origCanvas.getContext('2d').putImageData(origImageData, 0, 0);
    const origB64 = origCanvas.toDataURL('image/png').split(',')[1];

    // Ref 2: čisté tahy na bílém pozadí — pixel diff
    // Porovnáme aktuální stav s originálem pixel po pixelu.
    // Pixely které se lišší = tahy. Nezměněné pixely = bílé pozadí.
    const w = eng.canvas.width, h = eng.canvas.height;
    const currentData = eng.ctx.getImageData(0, 0, w, h);
    const cur = currentData.data;
    const orig = origImageData.data;

    const strokeCanvas = document.createElement('canvas');
    strokeCanvas.width = w; strokeCanvas.height = h;
    const sc = strokeCanvas.getContext('2d');
    const outData = sc.createImageData(w, h);
    const out = outData.data;

    for (let i = 0; i < cur.length; i += 4) {
      const dr = Math.abs(cur[i]   - orig[i]);
      const dg = Math.abs(cur[i+1] - orig[i+1]);
      const db = Math.abs(cur[i+2] - orig[i+2]);
      const da = Math.abs(cur[i+3] - orig[i+3]);
      if (dr + dg + db + da > 8) {
        // Pixel se změnil — je to tah, zachováme barvu
        out[i]   = cur[i];
        out[i+1] = cur[i+1];
        out[i+2] = cur[i+2];
        out[i+3] = cur[i+3];
      } else {
        // Pixel nezměněn — bílé pozadí
        out[i]   = 255;
        out[i+1] = 255;
        out[i+2] = 255;
        out[i+3] = 255;
      }
    }
    sc.putImageData(outData, 0, 0);
    const annotB64 = strokeCanvas.toDataURL('image/png').split(',')[1];

    // Uložit obě vrstvy jako assety a přidat jako refs (v102+ formát)
    // Pořadí: nejprve kresba, pak originál → originál je novější → v assetech vlevo (matches refs order)
    const assetAnnot = await createAsset(annotB64, 'image/png', 'generated');
    const assetOrig  = await createAsset(origB64,  'image/png', 'generated');
    refs.push({
      assetId: assetOrig.id, autoName: assetOrig.autoName, userLabel: '',
      mimeType: 'image/png', thumb: assetOrig.thumb || null, dims: assetOrig.dims || null,
    });
    refs.push({
      assetId: assetAnnot.id, autoName: assetAnnot.autoName, userLabel: '',
      mimeType: 'image/png', thumb: assetAnnot.thumb || null, dims: assetAnnot.dims || null,
    });
    renderRefThumbs();
    document.getElementById('refSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(`Added 2 references (original + strokes) [${refs.length}/14]`, 'ok');
    switchView('gen');
    closeAnnotateModal();
  }
}

// ── Uložit plátno/anotaci do Assets (bez přidání do aktivních refs) ──
async function pSaveToAssets() {
  const isAnnotate = document.getElementById('annotateModal')?.classList.contains('show');
  const prefix = isAnnotate ? 'a' : 'p';
  const eng = paintEngines[prefix];
  if (!eng) return;
  if (eng.textInput) eng.textInput.blur();

  // Method B (layers) — only available in annotate mode
  if (isAnnotate && annotateExportMode === 'B') {
    // Layer 1: clean original (from history[0])
    const origImageData = eng.history[0];
    const origCanvas = document.createElement('canvas');
    origCanvas.width = eng.canvas.width; origCanvas.height = eng.canvas.height;
    origCanvas.getContext('2d').putImageData(origImageData, 0, 0);
    const origB64 = origCanvas.toDataURL('image/png').split(',')[1];

    // Layer 2: strokes only on white background (pixel diff)
    const w = eng.canvas.width, h = eng.canvas.height;
    const currentData = eng.ctx.getImageData(0, 0, w, h);
    const cur = currentData.data;
    const orig = origImageData.data;
    const strokeCanvas = document.createElement('canvas');
    strokeCanvas.width = w; strokeCanvas.height = h;
    const sc = strokeCanvas.getContext('2d');
    const outData = sc.createImageData(w, h);
    const out = outData.data;
    for (let i = 0; i < cur.length; i += 4) {
      const dr = Math.abs(cur[i]   - orig[i]);
      const dg = Math.abs(cur[i+1] - orig[i+1]);
      const db = Math.abs(cur[i+2] - orig[i+2]);
      const da = Math.abs(cur[i+3] - orig[i+3]);
      if (dr + dg + db + da > 8) {
        out[i] = cur[i]; out[i+1] = cur[i+1]; out[i+2] = cur[i+2]; out[i+3] = cur[i+3];
      } else {
        out[i] = 255; out[i+1] = 255; out[i+2] = 255; out[i+3] = 255;
      }
    }
    sc.putImageData(outData, 0, 0);
    const annotB64 = strokeCanvas.toDataURL('image/png').split(',')[1];

    // Save both layers to Assets — annot first, orig second → orig newest = leftmost in assets
    const assetAnnot = await createAsset(annotB64, 'image/png', 'generated');
    const assetOrig  = await createAsset(origB64,  'image/png', 'generated');
    closeAnnotateModal();
    toast(`Saved 2 layers to Assets: ${assetOrig.autoName} + ${assetAnnot.autoName}`, 'ok');
    switchView('assets');
    return;
  }

  // Method A (composite) — or paint mode
  const tmp = document.createElement('canvas');
  tmp.width = eng.canvas.width; tmp.height = eng.canvas.height;
  const tc = tmp.getContext('2d');
  if (prefix === 'p') { tc.fillStyle = paintBgColor; tc.fillRect(0, 0, tmp.width, tmp.height); }
  tc.drawImage(eng.canvas, 0, 0);
  const b64 = tmp.toDataURL('image/png').split(',')[1];

  // Pouze uloží do Assets DB — duplikát check se postará o zbytek
  const alreadyExists = !!(await findAssetByFingerprint(b64));
  const asset = await createAsset(b64, 'image/png', prefix === 'a' ? 'generated' : 'upload');

  if (isAnnotate) closeAnnotateModal();

  const msg = alreadyExists
    ? `Already in Assets as ${asset.autoName}`
    : `Saved to Assets as ${asset.autoName}`;
  toast(msg, 'ok');
  // Přepnout na Assets tab aby uživatel viděl výsledek
  switchView('assets');
}

function pUpdateDownloadLink(prefix) {
  const eng = paintEngines[prefix];
  if (!eng) return;
  const linkId = prefix === 'p' ? 'pDownloadLink' : 'aDownloadLink';
  const link = document.getElementById(linkId);
  if (!link) return;
  const tmp = document.createElement('canvas');
  tmp.width = eng.canvas.width; tmp.height = eng.canvas.height;
  const tc = tmp.getContext('2d');
  if (prefix === 'p') { tc.fillStyle = paintBgColor; tc.fillRect(0, 0, tmp.width, tmp.height); }
  tc.drawImage(eng.canvas, 0, 0);
  link.href = tmp.toDataURL('image/png');
}

// ── Paint tab ──
function initPaintTab() {
  const canvas = document.getElementById('paintCanvas');
  resizePaintCanvas();  // default: 1920, 16:9
}

function resizePaintCanvas(existingCanvas) {
  const canvas = (existingCanvas instanceof HTMLCanvasElement) ? existingCanvas : document.getElementById('paintCanvas');
  const prevTool = paintEngines['p'] ? paintEngines['p'].tool : 'pen';

  const longSide = parseInt(document.getElementById('pCanvasLong')?.value || '1920');
  const ratioStr  = document.getElementById('pCanvasRatio')?.value || '16:9';
  const [ra, rb]  = ratioStr.split(':').map(Number);

  let w, h;
  if (ra >= rb) { w = longSide; h = Math.round(longSide * rb / ra); }
  else          { h = longSide; w = Math.round(longSide * ra / rb); }

  canvas.width  = w;
  canvas.height = h;
  canvas.style.backgroundColor = paintBgColor;
  const eng = createPaintEngine('p', canvas);
  eng.bgColor = paintBgColor;
  eng.tool    = prevTool;
  eng.saveHistory();
  paintEngines['p'] = eng;
  pUpdateDownloadLink('p');
}

function setPBg(mode) {
  paintBgColor = mode === 'dark' ? '#000000' : '#ffffff';
  document.getElementById('pBgDark').classList.toggle('active', mode === 'dark');
  document.getElementById('pBgWhite').classList.toggle('active', mode === 'white');
  const eng = paintEngines['p'];
  if (!eng) return;
  eng.bgColor = paintBgColor;
  // Pouze CSS background — canvas samotný je průhledný, tahy zůstanou
  eng.canvas.style.backgroundColor = paintBgColor;
}

// ── Annotate modal ──
function openAnnotateModal(b64data, modelName) {
  if (paintEngines['a'] && paintEngines['a'].textInput) paintEngines['a'].commitText();
  const canvas = document.getElementById('annotateCanvas');
  document.getElementById('annotateTitle').textContent = 'Annotate — ' + (modelName || 'image');
  const img = new Image();
  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const eng = createPaintEngine('a', canvas);
    eng.saveHistory();
    paintEngines['a'] = eng;
    // Reset annotate toolbar to defaults
    setPTool('a', 'pen');
    pUpdateDownloadLink('a');
  };
  img.src = `data:image/png;base64,${b64data}`;
  document.getElementById('annotateModal').classList.add('show');
  // Update download name
  const dl = document.getElementById('aDownloadLink');
  if (dl) dl.download = `annotated-${Date.now()}.png`;
}

async function pSaveToGallery(prefix) {
  try {
    const eng = paintEngines[prefix];
    if (!eng) { toast('Error: engine not initialized', 'err'); return; }
    if (eng.textInput) eng.commitText();

    // Pro annotate: složíme originální obrázek + anotace do tmp canvasu
    const tmp = document.createElement('canvas');
    tmp.width = eng.canvas.width; tmp.height = eng.canvas.height;
    const tc = tmp.getContext('2d');

    if (prefix === 'p') {
      // Paint: plné pozadí + tahy
      tc.fillStyle = paintBgColor;
      tc.fillRect(0, 0, tmp.width, tmp.height);
      tc.drawImage(eng.canvas, 0, 0);
    } else {
      // Annotate: eng.canvas obsahuje originál + anotace (vše nakresleno přímo)
      tc.drawImage(eng.canvas, 0, 0);
    }

    const b64 = tmp.toDataURL('image/png').split(',')[1];
    const dims = await getImageDimensions(b64);
    const label = prefix === 'p' ? 'Paint' : 'Annotate';

    const psId = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const psRec = {
      id: psId,
      ts: Date.now(),
      model: label,
      modelKey: prefix === 'p' ? 'paint' : 'annotate',
      prompt: prefix === 'p' ? '[Paint sketch]' : '[Annotated image]',
      params: { size: fmtDims(dims) },
      imageData: b64,
      folder: 'all',
      dims: fmtDims(dims),
    };
    await dbPut('images', psRec);
    await dbPutMeta(psRec);
    // Thumb na pozadí
    generateThumb(b64, 'image/png').then(t => {
      if (t) {
        const tx = db.transaction('thumbs','readwrite');
        tx.objectStore('thumbs').put({id:psId,data:t});
        thumbMemCache.set(psId, t);
      }
    });

    // Obnovit galerii (folder počty + grid)
    refreshGalleryUI();

    toast('Saved to gallery ✓', 'ok');
    if (prefix === 'a') closeAnnotateModal();
  } catch(e) {
    toast('Save error: ' + e.message, 'err');
    console.error('pSaveToGallery error:', e);
  }
}

function closeAnnotateModal() {
  if (paintEngines['a'] && paintEngines['a'].textInput) paintEngines['a'].commitText();
  document.getElementById('annotateModal').classList.remove('show');
}

// Update download link when mouse lifts (after each stroke on paint tab)
document.addEventListener('mouseup', () => {
  if (paintEngines['p']) pUpdateDownloadLink('p');
  if (paintEngines['a']) pUpdateDownloadLink('a');
});

// Keyboard shortcuts for paint/annotate
document.addEventListener('keydown', e => {
  // Determine active prefix
  const annotateOpen = document.getElementById('annotateModal').classList.contains('show');
  const paintOpen = document.getElementById('paintView').classList.contains('show');
  if (!annotateOpen && !paintOpen) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const pfx = annotateOpen ? 'a' : 'p';
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); pUndo(pfx); return; }
  const toolKeys = { p:'pen', e:'eraser', l:'line', r:'rect', o:'ellipse', t:'text' };
  if (toolKeys[e.key.toLowerCase()]) setPTool(pfx, toolKeys[e.key.toLowerCase()]);
});

