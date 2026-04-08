// ═══════════════════════════════════════════════════════
// PAINT ENGINE
// ═══════════════════════════════════════════════════════
const paintEngines = {}; // 'p' = Paint tab, 'a' = Paint modal (formerly Annotate)
let paintBgColor = '#000000'; // default black

// ── Inpaint state ──
let _annotateMaskCanvas = null;  // offscreen canvas — white strokes = mask area
let _annotateBaseB64    = null;  // clean original image b64 (no strokes) for inpaint crop + composite
let _annotateBaseName   = null;  // image/model name for gallery label
let _paintDirty            = {};    // { 'a': bool } — true = has unsaved strokes
let _inpaintCropInfo       = null;  // { cropX, cropY, cropW, cropH } for compositeBack
let _inpaintAbort          = null;  // AbortController for cancel support
let _inpaintControlNetB64  = null;  // generated depth/canny image b64
let _inpaintControlNetType = null;  // 'depth' | 'canny'
let _inpaintCtrlMode       = 'none'; // 'none'|'canny'|'depth' — what to send in API call
let _inpaintRefB64         = null;  // optional reference image b64 (max 2K)

function createPaintEngine(prefix, canvas) {
  const state = {
    prefix,
    canvas,
    ctx: canvas.getContext('2d'),
    tool: 'pen',
    color: '#ff4444',
    bgColor: '#000000',
    lineWidth: 4,
    opacity: 1.0,
    fillShapes: false,
    drawing: false,
    startX: 0, startY: 0,
    snapshot: null,
    maskSnapshot: null,   // for shape-preview restore on mask ctx
    history: [],
    maskHistory: [],      // mirrors main history for mask canvas
    textInput: null,
    bgImageData: null,
    maskCtx: null,        // set externally after creation
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
    if (state.maskCtx) {
      state.maskHistory.push(state.maskCtx.getImageData(0, 0, canvas.width, canvas.height));
      if (state.maskHistory.length > 40) state.maskHistory.shift();
    }
  }

  function applyStyle() {
    state.ctx.globalAlpha = state.opacity;
    state.ctx.strokeStyle = state.color;
    state.ctx.fillStyle = state.color;
    state.ctx.lineWidth = state.lineWidth;
    state.ctx.lineCap = 'round';
    state.ctx.lineJoin = 'round';
  }

  // Prepare mask ctx for a drawing operation (always white, ignores display color)
  function maskApply(isErase) {
    if (!state.maskCtx) return;
    state.maskCtx.globalAlpha = 1;
    state.maskCtx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
    state.maskCtx.strokeStyle = '#ffffff';
    state.maskCtx.fillStyle = '#ffffff';
    state.maskCtx.lineWidth = state.lineWidth;
    state.maskCtx.lineCap = 'round';
    state.maskCtx.lineJoin = 'round';
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
    // Mirror to mask — always filled white
    if (state.maskCtx) {
      maskApply(false);
      state.maskCtx.beginPath();
      if (state.tool === 'line') {
        state.maskCtx.moveTo(x1, y1); state.maskCtx.lineTo(x2, y2); state.maskCtx.stroke();
      } else if (state.tool === 'rect') {
        const w = x2 - x1, h = y2 - y1;
        state.maskCtx.fillRect(x1, y1, w, h);
        state.maskCtx.strokeRect(x1, y1, w, h);
      } else if (state.tool === 'ellipse') {
        const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
        const cx2 = (x1 + x2) / 2, cy2 = (y1 + y2) / 2;
        if (rx >= 1 && ry >= 1) {
          state.maskCtx.ellipse(cx2, cy2, rx, ry, 0, 0, Math.PI * 2);
          state.maskCtx.fill();
          state.maskCtx.stroke();
        }
      }
    }
  }

  // ── Bucket flood fill ──
  function floodFill(startX, startY) {
    const w = canvas.width, h = canvas.height;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    // ── Annotate/Paint modal: fill on MASK canvas (ignore original image) ──
    // User draws a closed outline with pen; bucket fills the enclosed transparent area.
    if (state.prefix === 'a' && state.maskCtx) {
      const maskData = state.maskCtx.getImageData(0, 0, w, h);
      const md = maskData.data;
      const si = (startY * w + startX) * 4;
      // If click lands on already-masked pixel, nothing to fill
      if (md[si + 3] > 10) return;

      const visited = new Uint8Array(w * h);
      const stack = [startY * w + startX];
      while (stack.length) {
        const idx = stack.pop();
        if (visited[idx]) continue;
        const x = idx % w, y = (idx / w) | 0;
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const pi = idx * 4;
        if (md[pi + 3] > 10) continue; // hit a drawn stroke — boundary
        visited[idx] = 1;
        md[pi] = 255; md[pi+1] = 255; md[pi+2] = 255; md[pi+3] = 255;
        if (x + 1 < w)  stack.push(idx + 1);
        if (x - 1 >= 0) stack.push(idx - 1);
        if (y + 1 < h)  stack.push(idx + w);
        if (y - 1 >= 0) stack.push(idx - w);
      }
      state.maskCtx.putImageData(maskData, 0, 0);

      // Mirror fill to display canvas with user color
      const imgData = state.ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const tmp2 = document.createElement('canvas'); tmp2.width = tmp2.height = 1;
      const tc2 = tmp2.getContext('2d');
      tc2.fillStyle = state.color; tc2.fillRect(0, 0, 1, 1);
      const fd2 = tc2.getImageData(0, 0, 1, 1).data;
      const fR2 = fd2[0], fG2 = fd2[1], fB2 = fd2[2];
      for (let i = 0; i < w * h; i++) {
        if (visited[i]) { d[i*4] = fR2; d[i*4+1] = fG2; d[i*4+2] = fB2; d[i*4+3] = 255; }
      }
      state.ctx.putImageData(imgData, 0, 0);
      saveHistory();
      _paintDirty['a'] = true;
      return;
    }

    // ── Paint tab: classic color-based flood fill ──
    const imgData = state.ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const si = (startY * w + startX) * 4;
    const tR = data[si], tG = data[si+1], tB = data[si+2], tA = data[si+3];
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 1;
    const tc = tmp.getContext('2d');
    tc.fillStyle = state.color; tc.fillRect(0, 0, 1, 1);
    const fd = tc.getImageData(0, 0, 1, 1).data;
    const fR = fd[0], fG = fd[1], fB = fd[2];
    if (tR === fR && tG === fG && tB === fB && tA === 255) return;
    const tol = 30;
    const matches = i =>
      Math.abs(data[i]   - tR) <= tol && Math.abs(data[i+1] - tG) <= tol &&
      Math.abs(data[i+2] - tB) <= tol && Math.abs(data[i+3] - tA) <= tol;
    const visited = new Uint8Array(w * h);
    const stack = [startY * w + startX];
    while (stack.length) {
      const idx = stack.pop();
      if (visited[idx]) continue;
      const x = idx % w, y = (idx / w) | 0;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const pi = idx * 4;
      if (!matches(pi)) continue;
      visited[idx] = 1;
      data[pi] = fR; data[pi+1] = fG; data[pi+2] = fB; data[pi+3] = 255;
      if (x + 1 < w) stack.push(idx+1); if (x - 1 >= 0) stack.push(idx-1);
      if (y + 1 < h) stack.push(idx+w); if (y - 1 >= 0) stack.push(idx-w);
    }
    state.ctx.putImageData(imgData, 0, 0);
    saveHistory();
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
      if (ev.key === 'Enter' || ev.key === 'Escape') {
        if (ev.key === 'Enter') commitText();
        else { document.body.removeChild(inp); state.textInput = null; }
        ev.stopPropagation();
      }
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
      if (state.maskCtx) {
        maskApply(false);
        state.maskCtx.font = `bold ${fontSize}px 'IBM Plex Mono', monospace`;
        state.maskCtx.fillText(txt, x, y);
      }
      saveHistory();
      if (state.prefix === 'a') _paintDirty['a'] = true;
    }
    if (document.body.contains(el)) document.body.removeChild(el);
    state.textInput = null;
  }

  function onStart(e) {
    // STALE GUARD: if this engine was replaced, ignore all events
    if (paintEngines[prefix] !== state) return;
    e.preventDefault();
    if (state.tool === 'text') { placeText(e); return; }
    const p = getPos(e);
    if (state.tool === 'bucket') { floodFill(Math.round(p.x), Math.round(p.y)); return; }
    state.drawing = true;
    state.startX = p.x; state.startY = p.y;
    // Only capture expensive snapshot for shape tools (pen/eraser use lineTo, never putImageData)
    if (state.tool !== 'pen' && state.tool !== 'eraser') {
      state.snapshot = state.ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (state.maskCtx) state.maskSnapshot = state.maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
      state.snapshot = null;
      state.maskSnapshot = null;
    }
    if (state.tool === 'pen' || state.tool === 'eraser') {
      applyStyle();
      const isErase = state.tool === 'eraser';
      state.ctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
      if (isErase) state.ctx.globalAlpha = 1;
      state.ctx.beginPath();
      state.ctx.moveTo(p.x, p.y);
      if (state.maskCtx) {
        maskApply(isErase);
        state.maskCtx.beginPath();
        state.maskCtx.moveTo(p.x, p.y);
      }
    }
  }

  function onMove(e) {
    if (paintEngines[prefix] !== state) return;
    e.preventDefault();
    if (!state.drawing) return;
    const p = getPos(e);
    if (state.tool === 'pen' || state.tool === 'eraser') {
      state.ctx.lineTo(p.x, p.y);
      state.ctx.stroke();
      if (state.maskCtx) { state.maskCtx.lineTo(p.x, p.y); state.maskCtx.stroke(); }
    } else {
      state.ctx.putImageData(state.snapshot, 0, 0);
      if (state.maskCtx && state.maskSnapshot) state.maskCtx.putImageData(state.maskSnapshot, 0, 0);
      drawShape(state.startX, state.startY, p.x, p.y);
    }
  }

  function onEnd(e) {
    if (paintEngines[prefix] !== state) return;
    if (!state.drawing) return;
    state.drawing = false;
    state.ctx.globalCompositeOperation = 'source-over';
    state.ctx.globalAlpha = 1;
    if (state.maskCtx) {
      state.maskCtx.globalCompositeOperation = 'source-over';
      state.maskCtx.globalAlpha = 1;
    }
    saveHistory();
    if (state.prefix === 'a') _paintDirty['a'] = true;
  }

  canvas.addEventListener('mousedown', onStart);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onEnd);
  canvas.addEventListener('mouseleave', onEnd);
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd);

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
  const curMap = { pen:'cur-pen', eraser:'cur-eraser', line:'cur-line', rect:'cur-rect', ellipse:'cur-ellipse', text:'cur-text', bucket:'cur-bucket' };
  eng.canvas.className = curMap[tool] || 'cur-pen';
  document.querySelectorAll(`#${prefix}Toolbar .ptool`).forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`${prefix}T_${tool}`);
  if (btn) btn.classList.add('active');
}

function setPColor(prefix, color, swatchEl, pickerEl) {
  const eng = paintEngines[prefix];
  if (!eng) return;
  eng.color = color;
  document.querySelectorAll(`#${prefix}Colors .pswatch`).forEach(s => s.classList.remove('active'));
  if (swatchEl) {
    swatchEl.classList.add('active');
    const picker = document.getElementById(`${prefix}CustomColor`);
    if (picker) picker.value = color;
  }
  if (pickerEl) {
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
  if (eng.maskCtx && eng.maskHistory.length > 0) {
    eng.maskHistory.pop();
    if (eng.maskHistory.length > 0) {
      eng.maskCtx.putImageData(eng.maskHistory[eng.maskHistory.length - 1], 0, 0);
    } else {
      eng.maskCtx.clearRect(0, 0, eng.canvas.width, eng.canvas.height);
    }
  }
}

function pClear(prefix) {
  const eng = paintEngines[prefix];
  if (!eng || !eng.history.length) return;
  if (!confirm('Clear canvas?')) return;
  eng.ctx.putImageData(eng.history[0], 0, 0);
  eng.history = [eng.history[0]];
  if (eng.maskCtx) {
    eng.maskCtx.clearRect(0, 0, eng.canvas.width, eng.canvas.height);
    eng.maskHistory = [];
  }
  if (prefix === 'a') _paintDirty['a'] = false;
}

function pExportRef(prefix) {
  const eng = paintEngines[prefix];
  if (!eng) return;
  const tmp = document.createElement('canvas');
  tmp.width = eng.canvas.width; tmp.height = eng.canvas.height;
  const tc = tmp.getContext('2d');
  if (prefix === 'p') {
    tc.fillStyle = paintBgColor;
    tc.fillRect(0, 0, tmp.width, tmp.height);
  }
  tc.drawImage(eng.canvas, 0, 0);
  const b64 = tmp.toDataURL('image/png').split(',')[1];
  addRefFromBase64(b64, `${prefix === 'p' ? 'paint' : 'painted'}-${Date.now()}.png`);
  if (prefix === 'a') closeAnnotateModal();
}

// ── Annotate export mode ──
let annotateExportMode = 'A'; // 'A' = composite, 'B' = separate layers

function setAnnotateExportMode(mode) {
  annotateExportMode = mode;
  document.getElementById('aExportA').classList.toggle('active', mode === 'A');
  document.getElementById('aExportB').classList.toggle('active', mode === 'B');
}

async function pExportAnnotate() {
  const eng = paintEngines['a'];
  if (!eng) return;
  if (eng.textInput) eng.commitText();

  if (annotateExportMode === 'A') {
    const b64 = eng.canvas.toDataURL('image/png').split(',')[1];
    await addRefFromBase64(b64, `painted-composite-${Date.now()}.png`);
    closeAnnotateModal();
  } else {
    if (refs.length >= getRefMax() - 1) { toast(`Not enough room for 2 references (max ${getRefMax()})`, 'err'); return; }
    const origImageData = eng.history[0];
    const origCanvas = document.createElement('canvas');
    origCanvas.width = eng.canvas.width; origCanvas.height = eng.canvas.height;
    origCanvas.getContext('2d').putImageData(origImageData, 0, 0);
    const origB64 = origCanvas.toDataURL('image/png').split(',')[1];

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

    const assetAnnot = await createAsset(annotB64, 'image/png', 'generated');
    const assetOrig  = await createAsset(origB64,  'image/png', 'generated');
    refs.push({ assetId: assetOrig.id, autoName: assetOrig.autoName, userLabel: '', mimeType: 'image/png', thumb: assetOrig.thumb || null, dims: assetOrig.dims || null });
    refs.push({ assetId: assetAnnot.id, autoName: assetAnnot.autoName, userLabel: '', mimeType: 'image/png', thumb: assetAnnot.thumb || null, dims: assetAnnot.dims || null });
    renderRefThumbs();
    document.getElementById('refSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(`Added 2 references (original + strokes) [${refs.length}/14]`, 'ok');
    switchView('gen');
    closeAnnotateModal();
  }
}

async function pSaveToAssets() {
  const isAnnotate = document.getElementById('annotateModal')?.classList.contains('show');
  const prefix = isAnnotate ? 'a' : 'p';
  const eng = paintEngines[prefix];
  if (!eng) return;
  if (eng.textInput) eng.textInput.blur();

  if (isAnnotate && annotateExportMode === 'B') {
    const origImageData = eng.history[0];
    const origCanvas = document.createElement('canvas');
    origCanvas.width = eng.canvas.width; origCanvas.height = eng.canvas.height;
    origCanvas.getContext('2d').putImageData(origImageData, 0, 0);
    const origB64 = origCanvas.toDataURL('image/png').split(',')[1];
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
      const dr = Math.abs(cur[i]-orig[i]), dg = Math.abs(cur[i+1]-orig[i+1]);
      const db = Math.abs(cur[i+2]-orig[i+2]), da = Math.abs(cur[i+3]-orig[i+3]);
      if (dr+dg+db+da > 8) { out[i]=cur[i]; out[i+1]=cur[i+1]; out[i+2]=cur[i+2]; out[i+3]=cur[i+3]; }
      else { out[i]=255; out[i+1]=255; out[i+2]=255; out[i+3]=255; }
    }
    sc.putImageData(outData, 0, 0);
    const annotB64 = strokeCanvas.toDataURL('image/png').split(',')[1];
    const assetAnnot = await createAsset(annotB64, 'image/png', 'generated');
    const assetOrig  = await createAsset(origB64,  'image/png', 'generated');
    closeAnnotateModal();
    toast(`Saved 2 layers to Assets: ${assetOrig.autoName} + ${assetAnnot.autoName}`, 'ok');
    switchView('assets');
    return;
  }

  const tmp = document.createElement('canvas');
  tmp.width = eng.canvas.width; tmp.height = eng.canvas.height;
  const tc = tmp.getContext('2d');
  if (prefix === 'p') { tc.fillStyle = paintBgColor; tc.fillRect(0, 0, tmp.width, tmp.height); }
  tc.drawImage(eng.canvas, 0, 0);
  const b64 = tmp.toDataURL('image/png').split(',')[1];
  const alreadyExists = !!(await findAssetByFingerprint(b64));
  const asset = await createAsset(b64, 'image/png', prefix === 'a' ? 'generated' : 'upload');
  if (isAnnotate) closeAnnotateModal();
  const msg = alreadyExists ? `Already in Assets as ${asset.autoName}` : `Saved to Assets as ${asset.autoName}`;
  toast(msg, 'ok');
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
  resizePaintCanvas();
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
  canvas.width = w; canvas.height = h;
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
  eng.canvas.style.backgroundColor = paintBgColor;
}

// ── Paint modal (entry point, formerly "Annotate") ──
function openAnnotateModal(b64data, modelName) {
  if (paintEngines['a'] && paintEngines['a'].textInput) paintEngines['a'].commitText();
  // Null out immediately — stale guard in event handlers will block old engine
  paintEngines['a'] = null;

  _annotateBaseB64  = b64data;
  _annotateBaseName = modelName || 'image';
  _paintDirty['a']  = false;

  const canvas = document.getElementById('annotateCanvas');
  document.getElementById('annotateTitle').textContent = 'Paint — ' + _annotateBaseName;

  const img = new Image();
  img.onload = () => {
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Init offscreen mask canvas (same dimensions)
    _annotateMaskCanvas = document.createElement('canvas');
    _annotateMaskCanvas.width  = img.naturalWidth;
    _annotateMaskCanvas.height = img.naturalHeight;

    const eng = createPaintEngine('a', canvas);
    eng.maskCtx     = _annotateMaskCanvas.getContext('2d');
    eng.maskHistory = [];
    eng.saveHistory();  // saves image state to history AND empty mask to maskHistory
    paintEngines['a'] = eng;

    setPTool('a', 'pen');
    pUpdateDownloadLink('a');
  };
  img.src = `data:image/png;base64,${b64data}`;
  document.getElementById('annotateModal').classList.add('show');
  closeInpaintPanel();

  const dl = document.getElementById('aDownloadLink');
  if (dl) dl.download = `painted-${Date.now()}.png`;
}

async function pSaveToGallery(prefix) {
  try {
    const eng = paintEngines[prefix];
    if (!eng) { toast('Error: engine not initialized', 'err'); return; }
    if (eng.textInput) eng.commitText();

    // Dirty check: if inpaint just auto-saved and nothing new was drawn, just close
    if (prefix === 'a' && !_paintDirty['a']) {
      closeAnnotateModal();
      return;
    }

    const tmp = document.createElement('canvas');
    tmp.width = eng.canvas.width; tmp.height = eng.canvas.height;
    const tc = tmp.getContext('2d');
    if (prefix === 'p') {
      tc.fillStyle = paintBgColor;
      tc.fillRect(0, 0, tmp.width, tmp.height);
      tc.drawImage(eng.canvas, 0, 0);
    } else {
      tc.drawImage(eng.canvas, 0, 0);
    }

    const b64 = tmp.toDataURL('image/png').split(',')[1];
    const dims = await getImageDimensions(b64);
    const label = 'Paint';

    const psId = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const psRec = {
      id: psId, ts: Date.now(),
      model: label,
      modelKey: prefix === 'p' ? 'paint' : 'paint_annotate',
      prompt: prefix === 'p' ? '[Paint sketch]' : '[Painted image]',
      params: { size: fmtDims(dims) },
      imageData: b64,
      folder: 'all',
      dims: fmtDims(dims),
    };
    await dbPut('images', psRec);
    await dbPutMeta(psRec);
    generateThumb(b64, 'image/png').then(t => {
      if (t) {
        const tx = db.transaction('thumbs','readwrite');
        tx.objectStore('thumbs').put({ id: psId, data: t });
        thumbMemCache.set(psId, t);
      }
    });
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
  closeInpaintPanel();
}

document.addEventListener('mouseup', () => {
  if (paintEngines['p']) pUpdateDownloadLink('p');
  if (paintEngines['a']) pUpdateDownloadLink('a');
});

document.addEventListener('keydown', e => {
  const annotateOpen = document.getElementById('annotateModal').classList.contains('show');
  const paintOpen = document.getElementById('paintView').classList.contains('show');
  if (!annotateOpen && !paintOpen) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const pfx = annotateOpen ? 'a' : 'p';
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); pUndo(pfx); return; }
  const toolKeys = { p:'pen', e:'eraser', l:'line', r:'rect', o:'ellipse', t:'text', b:'bucket' };
  if (toolKeys[e.key.toLowerCase()]) setPTool(pfx, toolKeys[e.key.toLowerCase()]);
});

// ═══════════════════════════════════════════════════════
// INPAINT SYSTEM
// ═══════════════════════════════════════════════════════

function getInpaintResolution() {
  return parseInt(document.getElementById('inpaintResolution')?.value || '1536');
}

function getInpaintMargin() {
  return parseInt(document.getElementById('inpaintMargin')?.value || '200');
}

// Compute crop square from mask bounding box + margin
function _cropForInpaint() {
  const eng = paintEngines['a'];
  if (!eng || !eng.maskCtx) { toast('Paint engine not ready', 'err'); return null; }

  const W = eng.canvas.width, H = eng.canvas.height;
  const resolution = getInpaintResolution();
  const margin = getInpaintMargin();

  // Find bounding box of all painted mask pixels
  const maskData = eng.maskCtx.getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (maskData[(y * W + x) * 4 + 3] > 10) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        found = true;
      }
    }
  }
  if (!found) { toast('Draw a mask first', 'err'); return null; }

  const maskW = maxX - minX + 1;
  const maskH = maxY - minY + 1;
  const needSize = Math.max(maskW, maskH) + 2 * margin;

  if (needSize > resolution) {
    const scale = (resolution - 2 * margin) / Math.max(maskW, maskH);
    return { needsDownscale: true, scale, resolution, margin, origW: W, origH: H };
  }

  // Center crop square on mask bounding box
  const cx = Math.round((minX + maxX) / 2);
  const cy = Math.round((minY + maxY) / 2);
  let cropX = cx - Math.floor(resolution / 2);
  let cropY = cy - Math.floor(resolution / 2);
  cropX = Math.max(0, Math.min(W - resolution, cropX));
  cropY = Math.max(0, Math.min(H - resolution, cropY));
  const cropW = Math.min(resolution, W - cropX);
  const cropH = Math.min(resolution, H - cropY);

  return { needsDownscale: false, cropX, cropY, cropW, cropH, scale: 1, resolution };
}

function openInpaintPanel() {
  const eng = paintEngines['a'];
  if (!eng) { toast('No image loaded', 'err'); return; }

  const cropInfo = _cropForInpaint();
  if (!cropInfo) return;
  _inpaintCropInfo = cropInfo;

  // Reset ControlNet + ref state for fresh panel
  _inpaintControlNetB64  = null;
  _inpaintControlNetType = null;
  _inpaintCtrlMode       = 'none';
  _inpaintRefB64         = null;

  // Hide toolbar + canvas; panel fills the full modal
  document.getElementById('aToolbar').style.display = 'none';
  document.getElementById('annotateCanvasWrap').style.display = 'none';
  document.getElementById('inpaintPanel').style.display = 'flex';
  document.getElementById('inpaintStatus').textContent = '';
  document.getElementById('inpaintGenerateBtn').disabled = false;

  // Snapshot painted canvas (image + mask strokes) → middle column preview
  const snapEng = paintEngines['a'];
  if (snapEng) {
    const preview = document.getElementById('inpaintCanvasPreview');
    if (preview) {
      const sc = Math.min(1, 900 / Math.max(snapEng.canvas.width, snapEng.canvas.height));
      const t = document.createElement('canvas');
      t.width  = Math.round(snapEng.canvas.width  * sc);
      t.height = Math.round(snapEng.canvas.height * sc);
      t.getContext('2d').drawImage(snapEng.canvas, 0, 0, t.width, t.height);
      preview.src = t.toDataURL('image/jpeg', 0.82);
    }
  }

  // Reset right-col previews (canny / depth / ref)
  ['inpaintCannyWrap','inpaintDepthWrap','inpaintRefPreviewWrap'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  // Reset left-col mini previews
  ['inpaintCtrlMiniPreview','inpaintRefMini'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  setInpaintCtrlMode('none');

  if (cropInfo.needsDownscale) {
    const pct = Math.round(cropInfo.scale * 100);
    document.getElementById('inpaintDownscaleMsg').textContent =
      `Mask is too large for ${cropInfo.resolution}px crop with ${cropInfo.margin}px margins. ` +
      `Downscale to ${pct}% → ${Math.round(cropInfo.origW * cropInfo.scale)}×${Math.round(cropInfo.origH * cropInfo.scale)}px.`;
    document.getElementById('inpaintDownscaleSection').style.display = 'flex';
    document.getElementById('inpaintColumns').style.display = 'none';
  } else {
    document.getElementById('inpaintDownscaleSection').style.display = 'none';
    document.getElementById('inpaintColumns').style.display = 'flex';
    _drawInpaintCropPreview(cropInfo);
  }
}

function closeInpaintPanel() {
  // Cancel any running generation
  if (_inpaintAbort) { _inpaintAbort.abort(); _inpaintAbort = null; }
  const panel = document.getElementById('inpaintPanel');
  if (panel) panel.style.display = 'none';
  const tb = document.getElementById('aToolbar');
  if (tb) tb.style.display = '';
  const cw = document.getElementById('annotateCanvasWrap');
  if (cw) cw.style.display = '';
  _inpaintCropInfo       = null;
  _inpaintControlNetB64  = null;
  _inpaintControlNetType = null;
  _inpaintCtrlMode       = 'none';
  _inpaintRefB64         = null;
}

// ── ControlNet mode toggle ──
function setInpaintCtrlMode(mode) {
  _inpaintCtrlMode = mode;
  ['none','canny','depth'].forEach(m => {
    const btn = document.getElementById('inpaintCtrlToggle_' + m);
    if (btn) btn.classList.toggle('active', m === mode);
  });
  // Show/hide mini preview based on mode
  const mini = document.getElementById('inpaintCtrlMiniPreview');
  if (mini) {
    if (mode !== 'none' && _inpaintControlNetB64 &&
        ((mode === 'canny' && _inpaintControlNetType === 'canny') ||
         (mode === 'depth' && _inpaintControlNetType === 'depth'))) {
      mini.src = `data:image/png;base64,${_inpaintControlNetB64}`;
      mini.style.display = 'block';
    } else {
      mini.style.display = 'none';
    }
  }
}

// ── Utility: resize image to max px on longest side ──
async function _resizeToMaxPx(b64, maxPx) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= maxPx && h <= maxPx) { res(b64); return; }
      const scale = maxPx / Math.max(w, h);
      const nw = Math.round(w * scale), nh = Math.round(h * scale);
      const c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      c.getContext('2d').drawImage(img, 0, 0, nw, nh);
      res(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
    };
    img.src = `data:image/png;base64,${b64}`;
  });
}

// ── Shared: show ControlNet in right preview panel ──
function _showCtrlInPanel(b64, type) {
  _inpaintControlNetB64  = b64;
  _inpaintControlNetType = type;
  // Right col: dedicated canny or depth slot
  const wrapId = type === 'canny' ? 'inpaintCannyWrap' : 'inpaintDepthWrap';
  const imgId  = type === 'canny' ? 'inpaintCannyImg'  : 'inpaintDepthImg';
  const wrap = document.getElementById(wrapId);
  const img  = document.getElementById(imgId);
  if (wrap && img) {
    img.src = `data:image/png;base64,${b64}`;
    img.style.display = 'block';
    wrap.style.display = 'flex';
  }
  // Left col mini preview
  const mini = document.getElementById('inpaintCtrlMiniPreview');
  if (mini) { mini.src = `data:image/png;base64,${b64}`; mini.style.display = 'block'; }
  setInpaintCtrlMode(type);
}

// ── ControlNet generation ──
function generateCannyControlNet() {
  if (!_inpaintCropInfo) return;
  const { cropX, cropY, cropW, cropH } = _inpaintCropInfo;
  const eng = paintEngines['a'];
  if (!eng) return;

  // Crop base image
  const tmp = document.createElement('canvas');
  tmp.width = cropW; tmp.height = cropH;
  const bi = new Image();
  bi.onload = () => {
    tmp.getContext('2d').drawImage(bi, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const imgData = tmp.getContext('2d').getImageData(0, 0, cropW, cropH);
    const edgeData = _sobelEdgeDetect(imgData, cropW, cropH);
    const outCanv = document.createElement('canvas');
    outCanv.width = cropW; outCanv.height = cropH;
    outCanv.getContext('2d').putImageData(edgeData, 0, 0);
    _inpaintControlNetB64  = outCanv.toDataURL('image/png').split(',')[1];
    _inpaintControlNetType = 'canny';
    _showControlNetPreview(_inpaintControlNetB64);
    toast('Canny edges generated ✓', 'ok');
  };
  bi.src = `data:image/png;base64,${_annotateBaseB64}`;
}

function _sobelEdgeDetect(imgData, w, h) {
  const src = imgData.data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (0.299 * src[i*4] + 0.587 * src[i*4+1] + 0.114 * src[i*4+2]) / 255;
  }
  // Gaussian blur 3x3
  const blur = new Float32Array(w * h);
  const kg = [1,2,1,2,4,2,1,2,1];
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
    let s = 0, k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += gray[(y+dy)*w+(x+dx)] * kg[k++];
    blur[y*w+x] = s / 16;
  }
  // Sobel
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
    const gx = -blur[(y-1)*w+(x-1)] + blur[(y-1)*w+(x+1)] - 2*blur[y*w+(x-1)] + 2*blur[y*w+(x+1)] - blur[(y+1)*w+(x-1)] + blur[(y+1)*w+(x+1)];
    const gy = -blur[(y-1)*w+(x-1)] - 2*blur[(y-1)*w+x] - blur[(y-1)*w+(x+1)] + blur[(y+1)*w+(x-1)] + 2*blur[(y+1)*w+x] + blur[(y+1)*w+(x+1)];
    const mag = Math.min(255, Math.sqrt(gx*gx + gy*gy) * 300);
    const v = mag > 25 ? 255 : 0;
    const i = (y*w+x)*4;
    out[i] = v; out[i+1] = v; out[i+2] = v; out[i+3] = 255;
  }
  return new ImageData(out, w, h);
}

async function generateDepthControlNet() {
  if (!_inpaintCropInfo) return;
  const { cropX, cropY, cropW, cropH } = _inpaintCropInfo;
  const falKey = document.getElementById('fluxApiKey').value.trim();
  if (!falKey) { toast('fal.ai API key required for depth', 'err'); return; }

  const statusEl = document.getElementById('inpaintStatus');
  statusEl.textContent = '⏳ Generating depth…';
  document.getElementById('inpaintCtrlDepthBtn').disabled = true;

  try {
    // Crop base image
    const cropCanv = document.createElement('canvas');
    cropCanv.width = cropW; cropCanv.height = cropH;
    await new Promise(res => {
      const bi = new Image();
      bi.onload = () => { cropCanv.getContext('2d').drawImage(bi, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH); res(); };
      bi.src = `data:image/png;base64,${_annotateBaseB64}`;
    });
    const cropB64 = cropCanv.toDataURL('image/jpeg', 0.9).split(',')[1];
    const result = await callDepthAnything(falKey, cropB64, msg => { statusEl.textContent = msg; });
    _inpaintControlNetB64  = result.base64;
    _inpaintControlNetType = 'depth';
    _showControlNetPreview(_inpaintControlNetB64);
    statusEl.textContent = '';
    toast('Depth map generated ✓', 'ok');
  } catch(e) {
    statusEl.textContent = '✗ Depth failed: ' + e.message;
    toast('Depth generation failed: ' + e.message, 'err');
  } finally {
    document.getElementById('inpaintCtrlDepthBtn').disabled = false;
  }
}

function _showControlNetPreview(b64) {
  // Legacy bridge — use new panel function
  _showCtrlInPanel(b64, _inpaintControlNetType || 'canny');
}

function handleInpaintRefUpload(file) {
  if (!file || !file.type.startsWith('image/')) { toast('Please select an image', 'err'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    const dataUrl = e.target.result;
    const raw = dataUrl.split(',')[1];
    _inpaintRefB64 = await _resizeToMaxPx(raw, 2048);
    _updateRefPreview(`data:image/jpeg;base64,${_inpaintRefB64}`);
    toast('Reference image set ✓', 'ok');
  };
  reader.readAsDataURL(file);
}

function _updateRefPreview(dataUrl) {
  const mini = document.getElementById('inpaintRefMini');
  if (mini) { mini.src = dataUrl; mini.style.display = 'block'; }
  const wrap  = document.getElementById('inpaintRefPreviewWrap');
  const thumb = document.getElementById('inpaintRefThumb');
  if (wrap && thumb) { thumb.src = dataUrl; thumb.style.display = 'block'; wrap.style.display = 'flex'; }
}

// ── Reference picker (from gallery/assets) ──
async function openInpaintRefPicker() {
  const picker = document.getElementById('inpaintRefPicker');
  if (!picker) return;
  const grid = document.getElementById('inpaintRefGrid');
  grid.innerHTML = '<div style="color:var(--dim);font-size:11px;padding:4px;">Loading…</div>';
  picker.style.display = 'flex';

  try {
    // Load gallery images directly from DB (sorted by newest first)
    const images = await dbGetAll('images');
    images.sort((a, b) => b.ts - a.ts);
    grid.innerHTML = '';
    let shown = 0;

    for (const img of images.slice(0, 80)) {
      // Prefer memory-cached thumbnail, fallback to thumbs store, then skip heavy full imageData
      let thumbSrc = null;
      const memThumb = thumbMemCache.get(img.id);
      if (memThumb) {
        thumbSrc = `data:image/png;base64,${memThumb}`;
      } else {
        // Try loading from thumbs store
        try {
          const dbThumb = await dbGet('thumbs', img.id);
          if (dbThumb?.data) {
            thumbSrc = dbThumb.data;
            thumbMemCache.set(img.id, dbThumb.data.split(',').pop()); // cache it
          }
        } catch(_) {}
      }
      if (!thumbSrc) continue; // skip if no thumbnail available

      const el = document.createElement('img');
      el.src = thumbSrc;
      el.title = img.prompt || img.model || '';
      el.style.cssText = 'width:72px;height:72px;object-fit:cover;cursor:pointer;border:2px solid transparent;border-radius:2px;flex-shrink:0;transition:border-color .12s;';
      el.onclick  = () => _setRefFromGallery(img.id);
      el.onmouseover = () => el.style.borderColor = 'var(--accent)';
      el.onmouseout  = () => el.style.borderColor = 'transparent';
      grid.appendChild(el);
      if (++shown >= 80) break;
    }
    if (!shown) grid.innerHTML = '<div style="color:var(--dim);font-size:11px;padding:4px;">No images in gallery</div>';
  } catch(e) {
    grid.innerHTML = `<div style="color:#e06060;font-size:11px;padding:4px;">Error: ${e.message}</div>`;
  }
}

function closeInpaintRefPicker() {
  const picker = document.getElementById('inpaintRefPicker');
  if (picker) picker.style.display = 'none';
}

async function _setRefFromGallery(id) {
  try {
    const rec = await dbGet('images', id);
    if (!rec?.imageData) { toast('Image not found', 'err'); return; }
    _inpaintRefB64 = await _resizeToMaxPx(rec.imageData, 2048);
    closeInpaintRefPicker();
    // Use correct prefix — _resizeToMaxPx returns JPEG when resized, original format otherwise
    const refDataUrl = rec.imageData.length < 200 ? rec.imageData
      : `data:image/jpeg;base64,${_inpaintRefB64}`;
    _updateRefPreview(refDataUrl);
    toast('Reference set from gallery ✓', 'ok');
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

function clearInpaintRef() {
  _inpaintRefB64 = null;
  const mini  = document.getElementById('inpaintRefMini');
  if (mini)  { mini.src = ''; mini.style.display = 'none'; }
  const wrap  = document.getElementById('inpaintRefPreviewWrap');
  const thumb = document.getElementById('inpaintRefThumb');
  if (thumb) { thumb.src = ''; thumb.style.display = 'none'; }
  if (wrap)  { wrap.style.display = 'none'; }
}

function clearInpaintControlNet() {
  _inpaintControlNetB64 = null; _inpaintControlNetType = null; _inpaintCtrlMode = 'none';
  ['inpaintCannyWrap','inpaintDepthWrap'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const mini = document.getElementById('inpaintCtrlMiniPreview');
  if (mini) { mini.src = ''; mini.style.display = 'none'; }
  setInpaintCtrlMode('none');
}

function _drawInpaintCropPreview(cropInfo) {
  const { cropX, cropY, cropW, cropH } = cropInfo;
  const eng = paintEngines['a'];
  if (!eng) return;

  // Image crop from clean base (no colored strokes)
  const cropCanvas = document.getElementById('inpaintCropCanvas');
  cropCanvas.width = cropW; cropCanvas.height = cropH;
  const cc = cropCanvas.getContext('2d');
  const baseImg = new Image();
  baseImg.onload = () => cc.drawImage(baseImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  baseImg.src = `data:image/png;base64,${_annotateBaseB64}`;

  // B&W mask preview for crop area
  const maskCanvas = document.getElementById('inpaintMaskCanvas');
  maskCanvas.width = cropW; maskCanvas.height = cropH;
  const mc = maskCanvas.getContext('2d');
  mc.fillStyle = '#000';
  mc.fillRect(0, 0, cropW, cropH);
  const maskImgData = eng.maskCtx.getImageData(cropX, cropY, cropW, cropH);
  const outData = mc.createImageData(cropW, cropH);
  const src = maskImgData.data, dst = outData.data;
  for (let i = 0; i < cropW * cropH; i++) {
    const v = src[i*4+3] > 10 ? 255 : 0;
    dst[i*4] = v; dst[i*4+1] = v; dst[i*4+2] = v; dst[i*4+3] = 255;
  }
  mc.putImageData(outData, 0, 0);
}

async function applyInpaintDownscale() {
  const eng = paintEngines['a'];
  if (!eng || !_inpaintCropInfo) return;
  const { scale, origW, origH } = _inpaintCropInfo;
  const newW = Math.round(origW * scale);
  const newH = Math.round(origH * scale);

  // Scale down base image
  const tmp = document.createElement('canvas');
  tmp.width = newW; tmp.height = newH;
  await new Promise(res => {
    const bi = new Image();
    bi.onload = () => { tmp.getContext('2d').drawImage(bi, 0, 0, newW, newH); res(); };
    bi.src = `data:image/png;base64,${_annotateBaseB64}`;
  });
  const scaledBaseB64 = tmp.toDataURL('image/png').split(',')[1];

  // Scale down mask canvas
  const tmpMask = document.createElement('canvas');
  tmpMask.width = newW; tmpMask.height = newH;
  tmpMask.getContext('2d').drawImage(_annotateMaskCanvas, 0, 0, newW, newH);

  // Apply
  _annotateBaseB64 = scaledBaseB64;
  eng.canvas.width = newW; eng.canvas.height = newH;
  eng.ctx.drawImage(tmp, 0, 0);
  _annotateMaskCanvas.width = newW; _annotateMaskCanvas.height = newH;
  eng.maskCtx.drawImage(tmpMask, 0, 0);
  eng.history = []; eng.maskHistory = [];
  eng.saveHistory();

  toast(`Downscaled to ${newW}×${newH} ✓`, 'ok');
  closeInpaintPanel();
  openInpaintPanel();
}

async function runInpaint() {
  const eng = paintEngines['a'];
  if (!eng || !_inpaintCropInfo) { toast('No crop info', 'err'); return; }

  const { cropX, cropY, cropW, cropH } = _inpaintCropInfo;
  const prompt    = (document.getElementById('inpaintPrompt')?.value || '').trim();
  const falKey    = document.getElementById('fluxApiKey').value.trim();
  if (!falKey) { toast('fal.ai API key required', 'err'); return; }

  const steps     = parseInt(document.getElementById('inpaintSteps')?.value || '28');
  const guidance  = parseFloat(document.getElementById('inpaintGuidance')?.value || '3.5');
  const strength  = parseFloat(document.getElementById('inpaintStrength')?.value || '0.85');
  const seedRaw   = (document.getElementById('inpaintSeed')?.value || '').trim();
  const seed      = seedRaw ? parseInt(seedRaw) : null;
  const ctrlScale    = parseFloat(document.getElementById('inpaintCtrlScale')?.value || '0.5');
  const refStrength  = parseFloat(document.getElementById('inpaintRefStrength')?.value || '0.65');

  const statusEl  = document.getElementById('inpaintStatus');
  const genBtn    = document.getElementById('inpaintGenerateBtn');
  const cancelBtn = document.getElementById('inpaintCancelBtn');

  statusEl.textContent = '⏳ Preparing…';
  genBtn.disabled   = true;
  if (cancelBtn) cancelBtn.style.display = '';

  // AbortController for cancel support
  _inpaintAbort = new AbortController();
  const signal = _inpaintAbort.signal;

  try {
    // ── Crop from CLEAN base image (no colored mask strokes) ──
    // Uses _annotateBaseB64 (the original without strokes) so the model
    // sees the correct image, not the red/colored mask overlay.
    const cropCanv = document.createElement('canvas');
    cropCanv.width = cropW; cropCanv.height = cropH;
    if (_annotateBaseB64) {
      await new Promise((res, rej) => {
        const bi = new Image();
        const timer = setTimeout(() => rej(new Error('Image load timeout — try again')), 20000);
        bi.onload  = () => { clearTimeout(timer); cropCanv.getContext('2d').drawImage(bi, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH); res(); };
        bi.onerror = () => { clearTimeout(timer); rej(new Error('Failed to load base image')); };
        bi.src = `data:image/png;base64,${_annotateBaseB64}`;
      });
    } else {
      // Fallback: draw from display canvas (less ideal — may include mask strokes)
      cropCanv.getContext('2d').drawImage(eng.canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    }
    const imageB64 = cropCanv.toDataURL('image/jpeg', 0.92).split(',')[1];

    // ── Extract B&W mask ──
    const maskCanv = document.createElement('canvas');
    maskCanv.width = cropW; maskCanv.height = cropH;
    const mc = maskCanv.getContext('2d');
    mc.fillStyle = '#000'; mc.fillRect(0, 0, cropW, cropH);
    const maskImgData = eng.maskCtx.getImageData(cropX, cropY, cropW, cropH);
    const outData = mc.createImageData(cropW, cropH);
    const src = maskImgData.data, dst = outData.data;
    for (let i = 0; i < cropW * cropH; i++) {
      const v = src[i*4+3] > 10 ? 255 : 0;
      dst[i*4] = v; dst[i*4+1] = v; dst[i*4+2] = v; dst[i*4+3] = 255;
    }
    mc.putImageData(outData, 0, 0);
    const maskB64 = maskCanv.toDataURL('image/png').split(',')[1];

    const modelSel  = document.getElementById('inpaintModelSel')?.value || 'flux_fill';
    const hasCtrlNet = _inpaintCtrlMode !== 'none' && _inpaintControlNetB64 && _inpaintControlNetType === _inpaintCtrlMode;
    const hasRef     = !!_inpaintRefB64;

    let result;
    if (modelSel === 'flux_fill' && !hasCtrlNet && !hasRef) {
      result = await callFluxFill(falKey, imageB64, maskB64, prompt, cropW, cropH,
        (msg) => { statusEl.textContent = msg; }, signal);
    } else {
      result = await callFluxGeneralInpaint(falKey, {
        imageB64, maskB64, prompt, width: cropW, height: cropH,
        steps, guidance, strength, seed,
        controlNetB64: hasCtrlNet ? _inpaintControlNetB64 : null,
        controlNetType: hasCtrlNet ? _inpaintCtrlMode : null,
        ctrlScale,
        refB64: hasRef ? _inpaintRefB64 : null,
        refStrength,
      }, (msg) => { statusEl.textContent = msg; }, signal);
    }

    statusEl.textContent = '✓ Compositing…';
    await _compositeInpaintResult(result.base64, result.mimeType, _inpaintCropInfo);

  } catch(e) {
    if (e.name === 'AbortError' || e.message === 'Cancelled') {
      statusEl.textContent = '— Cancelled';
    } else {
      statusEl.textContent = '✗ ' + (e.message || 'Error');
      toast('Inpaint failed: ' + (e.message || 'Unknown error'), 'err');
    }
    genBtn.disabled = false;
    if (cancelBtn) cancelBtn.style.display = 'none';
  } finally {
    _inpaintAbort = null;
  }
}

function cancelInpaint() {
  if (_inpaintAbort) {
    _inpaintAbort.abort();
    _inpaintAbort = null;
  }
  const cancelBtn = document.getElementById('inpaintCancelBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

async function _compositeInpaintResult(resultB64, mimeType, cropInfo) {
  const eng = paintEngines['a'];
  if (!eng) return;

  const { cropX, cropY, cropW, cropH } = cropInfo;
  const W = eng.canvas.width, H = eng.canvas.height;

  // Build new base: clean original + result pasted at crop position
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = W; compositeCanvas.height = H;
  const cc = compositeCanvas.getContext('2d');

  await new Promise(res => {
    const bi = new Image();
    bi.onload = () => { cc.drawImage(bi, 0, 0); res(); };
    bi.src = `data:image/png;base64,${_annotateBaseB64}`;
  });
  await new Promise(res => {
    const ri = new Image();
    ri.onload = () => { cc.drawImage(ri, cropX, cropY, cropW, cropH); res(); };
    ri.src = `data:${mimeType};base64,${resultB64}`;
  });

  const finalB64 = compositeCanvas.toDataURL('image/png').split(',')[1];
  const promptText = (document.getElementById('inpaintPrompt')?.value || '').trim();

  // Auto-save to gallery
  const dims = await getImageDimensions(finalB64);
  const id   = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  const rec  = {
    id, ts: Date.now(),
    model:    'FLUX Inpaint',
    modelKey: 'flux_inpaint',
    prompt:   promptText || '[Inpainted]',
    params:   { size: fmtDims(dims), source: _annotateBaseName },
    imageData: finalB64,
    folder: 'all',
    dims: fmtDims(dims),
  };
  await dbPut('images', rec);
  await dbPutMeta(rec);
  generateThumb(finalB64, 'image/png').then(t => {
    if (t) {
      const tx = db.transaction('thumbs','readwrite');
      tx.objectStore('thumbs').put({ id, data: t });
      thumbMemCache.set(id, t);
    }
  });
  refreshGalleryUI();

  // New composite becomes the fresh "original" in the modal
  _annotateBaseB64  = finalB64;
  _annotateBaseName = 'Inpainted · ' + _annotateBaseName;
  _paintDirty['a']  = false;  // auto-saved → no duplicate on Gallery+close

  await new Promise(res => {
    const ni = new Image();
    ni.onload = () => {
      eng.canvas.width = W; eng.canvas.height = H;
      eng.ctx.drawImage(ni, 0, 0);
      eng.maskCtx.clearRect(0, 0, W, H);  // clear mask for next iteration
      eng.history = []; eng.maskHistory = [];
      eng.saveHistory();
      res();
    };
    ni.src = `data:image/png;base64,${finalB64}`;
  });

  document.getElementById('annotateTitle').textContent = 'Paint — ' + _annotateBaseName;
  document.getElementById('inpaintStatus').textContent = '✓ Done!';
  document.getElementById('inpaintGenerateBtn').disabled = false;
  const cb = document.getElementById('inpaintCancelBtn');
  if (cb) cb.style.display = 'none';
  closeInpaintPanel();
  toast('Inpainted & saved to gallery ✓', 'ok');
}
