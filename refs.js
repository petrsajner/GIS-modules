// ═══════════════════════════════════════════════════════
// REFERENCES — NOVÝ SYSTÉM (ref panel C)
// ═══════════════════════════════════════════════════════

const REF_MAX_PX = 2048;

function resizeImageToCanvas(dataUrl, maxPx) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const longSide = Math.max(img.naturalWidth, img.naturalHeight);
      if (longSide <= maxPx) { resolve(dataUrl); return; }
      const scale = maxPx / longSide;
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl); // fallback: vrátit originál
    img.src = dataUrl;
  });
}

// Vrátí base64 dat referencí pro API call — aplikuje resize pouze v okamžiku odeslání.
// maxPx: null = bez omezení, číslo = hard limit (Z-Image), 'setting' = dle checkboxu refLimit
// Načítá imageData z assets DB (v102+ architektura — refs neobsahují data inline)
async function getRefDataForApi(ref, maxPx) {
  const limit = maxPx === 'setting'
    ? (document.getElementById('refLimit')?.checked ? REF_MAX_PX : null)
    : maxPx;

  // Načti plná data z assets DB
  const asset = await dbGet('assets', ref.assetId);
  if (!asset?.imageData) throw new Error(`Asset ${ref.assetId} not found in DB`);
  const imageData = asset.imageData;
  const mimeType  = asset.mimeType || ref.mimeType || 'image/png';

  if (!limit) return { data: imageData, mimeType };

  const dataUrl = `data:${mimeType};base64,${imageData}`;
  const resized = await resizeImageToCanvas(dataUrl, limit);
  const resizedB64 = resized.split(',')[1];
  const resizedMime = resized !== dataUrl ? 'image/jpeg' : mimeType;
  return { data: resizedB64, mimeType: resizedMime };
}

function addRefs(files) {
  const max = getRefMax();
  const remaining = max - refs.length;
  if (remaining <= 0) { toast(`Max ${max} references for this model`, 'err'); return; }
  const toAdd = Array.from(files).slice(0, remaining);
  let loaded = 0;
  toAdd.forEach(file => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const originalDataUrl = ev.target.result;
      const b64 = originalDataUrl.split(',')[1];
      const mimeType = file.type || 'image/png';
      if (!b64 || b64.length < 100) { toast(`Error: ${file.name} — empty data`, 'err'); loaded++; return; }
      // Duplicate check před uložením
      const alreadyExists = !!(await findAssetByFingerprint(b64));
      const asset = await createAsset(b64, mimeType, 'upload');
      // Nekombinovat duplikát v refs pokud tam je
      if (!refs.some(r => r.assetId === asset.id)) {
        refs.push({
          assetId: asset.id,
          autoName: asset.autoName,
          userLabel: asset.userLabel || '',
          mimeType: asset.mimeType || mimeType,
          thumb: asset.thumb || null,
          dims: asset.dims || null,
        });
      }
      loaded++;
      if (loaded === toAdd.length) {
        renderRefThumbs();
        renderAssets();
        if (alreadyExists) {
          toast(`Image already in Assets (${asset.autoName}) — added as reference`, 'ok');
        } else {
          toast(`${toAdd.length} ${toAdd.length === 1 ? 'image saved' : 'images saved'} → ${asset.autoName}${toAdd.length > 1 ? '…' : ''}`, 'ok');
        }
      }
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('refInput').value = '';
}

function removeRef(i) {
  refs.splice(i, 1);
  renderRefThumbs();
}

// Vždy uloží do Assets — bez ohledu na aktuální model.
// Do aktivních refs přidá dle kontextu: video mód → videoRefs[], image mód → refs[].
async function addRefFromBase64(b64data, name) {
  // Duplicate check
  const alreadyExists = !!(await findAssetByFingerprint(b64data));
  const asset = await createAsset(b64data, 'image/png', 'generated');

  const refEntry = {
    assetId: asset.id,
    autoName: asset.autoName,
    userLabel: asset.userLabel || '',
    mimeType: asset.mimeType || 'image/png',
    thumb: asset.thumb || null,
    dims: asset.dims || null,
  };

  const assetMsg = alreadyExists ? `Already in Assets (${asset.autoName})` : `→ Assets (${asset.autoName})`;

  if (window.aiPromptContext === 'video') {
    // ── Video mód: přidat do videoRefs[] ──
    const alreadyInVideoRefs = videoRefs.some(r => r.assetId === asset.id);
    if (alreadyInVideoRefs) {
      toast(`${asset.autoName} is already a video reference`, 'ok');
    } else {
      addVideoRef(asset);
      toast(`Saved ${assetMsg} + added as video ref`, 'ok');
    }
  } else {
    // ── Image mód: přidat do refs[] ──
    const m = MODELS[currentModel];
    const max = getRefMax();
    const alreadyInRefs = refs.some(r => r.assetId === asset.id);
    if (alreadyInRefs) {
      toast(`${asset.autoName} is already an active reference`, 'ok');
    } else if (m && m.refs && refs.length < max) {
      refs.push(refEntry);
      renderRefThumbs();
      document.getElementById('refSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      toast(`Saved ${assetMsg} + added as ref [${refs.length}/${max}]`, 'ok');
    } else if (!m || !m.refs) {
      toast(`Saved ${assetMsg} · current model doesn't support references`, 'ok');
    } else {
      toast(`Saved ${assetMsg} · reference limit reached (${max})`, 'ok');
    }
  }

  // Refresh assets tabu pokud je otevřen
  if (document.getElementById('assetsView').classList.contains('show')) {
    renderAssets();
    renderAssetFolders();
  }

  // Přepnout na gen panel — respektuj aktuální mód (image vs video)
  switchView('gen');
  if (typeof setGenMode === 'function') setGenMode(window.aiPromptContext === 'video' ? 'video' : 'image');
}

// Renderování ref panelu (Varianta C — expanded inline scroll)
function renderRefThumbs() {
  const scroll = document.getElementById('refPanelScroll');
  if (!scroll) return;

  const countEl = document.getElementById('refCount');
  const maxEl = document.getElementById('refMax');
  const max = getRefMax();
  const activeCount = Math.min(refs.length, max);
  if (countEl) countEl.textContent = activeCount;
  if (maxEl) maxEl.textContent = max;

  // Rebuild obsahu (zachovat ref-add-tile na konci)
  const activeM = MODELS[currentModel];
  const gptEditActive = activeM?.type === 'gpt' && activeM?.editModel;
  const tiles = refs.map((r, i) => {
    const label = r.userLabel || r.autoName || `ref ${i + 1}`;
    const hasName = !!(r.userLabel);
    const dimmed = i >= max;
    const isMask = r.role === 'mask';
    const maskBadge = isMask
      ? `<div class="rth2-mask-badge" onclick="event.stopPropagation();toggleRefMaskRole(${i})" title="Mask role — click to remove">🎭 MASK</div>`
      : (gptEditActive
          ? `<div class="rth2-mask-badge mask-off" onclick="event.stopPropagation();toggleRefMaskRole(${i})" title="Use as mask for GPT edit">🎭</div>`
          : '');
    return `
    <div class="rth2${dimmed ? ' ref-dimmed' : ''}${isMask ? ' ref-is-mask' : ''}" data-idx="${i}" draggable="true"
         ondragstart="refDragStart(event,${i})"
         ondragend="refDragEnd(event)"
         ondragover="refDragOver(event,${i})"
         ondrop="refDrop(event,${i})"
         ondragleave="refDragLeave(event)">
      <img class="rth2-img" src="data:${r.mimeType||'image/png'};base64,${r.thumb}" alt="${label}" onclick="openRefLightbox2(event,${i})" title="${dimmed ? 'Over limit — not sent to model' : 'Preview'}">
      <div class="del-ref2" onclick="event.stopPropagation();removeRef(${i})" title="Remove">×</div>
      ${!dimmed ? `<div class="rth2-describe" onclick="event.stopPropagation();describeRefImage(${i})" title="Describe image">✦ Describe</div>` : ''}
      ${maskBadge}
      <div class="rth2-label ${hasName ? 'has-name' : ''}" title="${dimmed ? '⊘ Over limit' : label}" ondblclick="startImageRefRename(${i}, this)">${escHtml(label)}</div>
    </div>`;
  }).join('');

  const addTile = `
    <div class="ref-add-tile" id="refAddTile" onclick="document.getElementById('refInput').click()" title="Upload files">
      <span>＋</span>
      <div style="font-size:9px;color:var(--dim2);text-align:center;line-height:1.4;margin-top:2px;">Upload<br>file</div>
    </div>`;

  scroll.innerHTML = tiles + addTile;

  // Re-apply model-specific @mention names in prompt (refs may have shifted)
  const m = MODELS[currentModel];
  if (typeof rewritePromptForModel === 'function' && m) {
    rewritePromptForModel(m.type, m.type);  // same model, but refs changed
  }
}

// ── Toggle mask role on a ref (GPT Edit models) ──
// Click on 🎭 badge → flip role=mask vs role=undefined.
// Only one ref can have role=mask at a time (OpenAI applies mask to image #1).
function toggleRefMaskRole(idx) {
  const r = refs[idx];
  if (!r) return;
  if (r.role === 'mask') {
    delete r.role;
    toast(`Ref ${idx + 1}: mask role removed`, 'ok');
  } else {
    // Clear any existing mask role first
    for (const other of refs) {
      if (other.role === 'mask') delete other.role;
    }
    r.role = 'mask';
    toast(`Ref ${idx + 1}: now mask (edit region)`, 'ok');
  }
  renderRefThumbs();
}

// ── Drag & drop reordering v ref panelu ──
// Používá HTML5 Drag API s gap-indikátorem (svislá čára mezi itemy)
let refDragIdx = null;
let refDragOverTarget = null; // { el, side: 'before'|'after' }

function refDragStart(e, idx) {
  refDragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(idx)); // zabránit browser file-drop chování
  // Lehké zmenšení táhnutého prvku
  setTimeout(() => { if (e.target) e.target.style.opacity = '0.5'; }, 0);
}

function refDragEnd(e) {
  if (e.target) e.target.style.opacity = '';
  clearRefDropIndicators();
  refDragIdx = null;
  refDragOverTarget = null;
}

function refDragOver(e, idx) {
  e.preventDefault();
  e.stopPropagation(); // zabránit bubblování na refPanelDrop
  if (refDragIdx === null) return;
  e.dataTransfer.dropEffect = 'move';

  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';

  clearRefDropIndicators();
  el.classList.add(side === 'before' ? 'drag-before' : 'drag-after');
  refDragOverTarget = { idx, side };
}

function refDragLeave(e) {
  // Jen smazat pokud opravdu opouštíme element (ne jeho child)
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-before', 'drag-after');
  }
}

function refDrop(e, idx) {
  e.preventDefault();
  e.stopPropagation();
  clearRefDropIndicators();
  if (refDragIdx === null) return;

  const from = refDragIdx;
  const target = refDragOverTarget || { idx, side: 'after' };
  refDragIdx = null;
  refDragOverTarget = null;

  if (from === target.idx) return;

  // Vypočítat cílový index
  let to = target.idx;
  if (target.side === 'after') to = target.idx + 1;
  // Kompenzace pro případ kdy táhneme zleva doprava
  if (from < to) to--;

  const moved = refs.splice(from, 1)[0];
  refs.splice(to, 0, moved);
  renderRefThumbs();
}

function clearRefDropIndicators() {
  document.querySelectorAll('.rth2.drag-before, .rth2.drag-after')
    .forEach(el => el.classList.remove('drag-before', 'drag-after'));
}

// Drag & drop na celý ref scroll panel (upload ze systému)
function refPanelDragOver(e) {
  e.preventDefault();
  document.getElementById('refPanelScroll').classList.add('drag-over');
}
function refPanelDragLeave(e) {
  if (!document.getElementById('refPanelScroll').contains(e.relatedTarget))
    document.getElementById('refPanelScroll').classList.remove('drag-over');
}
function refPanelDrop(e) {
  e.preventDefault();
  document.getElementById('refPanelScroll').classList.remove('drag-over');
  // Pouze zpracovat skutečné soubory z OS — ignorovat interní přesuny
  if (refDragIdx !== null) return; // interní drag, refDrop ho zpracuje
  if (e.dataTransfer.files.length) addRefs(e.dataTransfer.files);
}

// Ref lightbox (nový — pro ref panel)
async function openRefLightbox2(e, idx) {
  e.stopPropagation();
  const r = refs[idx];
  if (!r) return;
  const asset = await dbGet('assets', r.assetId);
  const imgSrc = asset?.imageData
    ? `data:${asset.mimeType||'image/png'};base64,${asset.imageData}`
    : `data:${r.mimeType||'image/png'};base64,${r.thumb}`;
  document.getElementById('refLightboxImg').src = imgSrc;
  const dimsInfo = r.dims ? ` · ${r.dims.w}×${r.dims.h}` : '';
  document.getElementById('refLightboxLabel').textContent =
    `${r.userLabel || r.autoName || 'ref ' + (idx+1)}${dimsInfo}  ·  klikni pro zavření`;
  document.getElementById('refLightbox').classList.add('show');
}

function closeRefLightbox() {
  document.getElementById('refLightbox').classList.remove('show');
}

// ── Inline rename image ref label (dblclick) ─────────────
// Zrcadlí startVideoRefRename — stejná logika, jiné pole
async function startImageRefRename(idx, labelEl) {
  if (labelEl.querySelector('input')) return;
  const r = refs[idx];
  if (!r) return;
  const current = r.userLabel || r.autoName || `ref ${idx + 1}`;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = current;
  input.placeholder = 'Ref name…';
  input.style.cssText = 'width:84px;font-size:9px;padding:1px 2px;background:var(--s2);border:1px solid var(--accent);color:var(--text);outline:none;font-family:inherit;';
  labelEl.textContent = '';
  labelEl.appendChild(input);
  input.focus(); input.select();
  const commit = async () => {
    input.remove();
    const val = input.value.trim();
    refs[idx].userLabel = val;
    // Pokud ref pochází z assetu — aktualizuj asset v DB
    if (r.assetId) {
      const asset = await dbGet('assets', r.assetId);
      if (asset) {
        asset.userLabel = val === asset.autoName ? '' : val;
        await dbPut('assets', asset);
        await dbPutAssetMeta(asset);
        // Synchronizuj zpět do všech refs a videoRefs se stejným assetem
        refs.forEach(imgRef => { if (imgRef.assetId === r.assetId) imgRef.userLabel = asset.userLabel; });
        videoRefs?.forEach(vRef => { if (vRef.assetId === r.assetId) vRef.userLabel = asset.userLabel; });
      }
    }
    renderRefThumbs();
    renderVideoRefPanel?.();
    renderAssets?.();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { refs[idx].userLabel = r.userLabel; input.blur(); }
  });
}

// ═══════════════════════════════════════════════════════
// @MENTION AUTOCOMPLETE V PROMPTU
// ═══════════════════════════════════════════════════════

let mentionOpen = false;
let mentionFilter = '';
let mentionAssets = [];
let mentionActiveIdx = -1;

function initMentionSystem() {
  const ta = document.getElementById('prompt');
  if (!ta) return;
  ta.addEventListener('input', handleMentionInput);
  ta.addEventListener('keydown', handleMentionKeydown);
  document.addEventListener('click', e => {
    if (!e.target.closest('#mentionDropdown') && !e.target.closest('#prompt')) closeMention();
  });
}

async function handleMentionInput(e) {
  const ta = e.target;
  const val = ta.value;
  const pos = ta.selectionStart;
  const before = val.slice(0, pos);
  const match = before.match(/@(\w*)$/);
  if (!match) { closeMention(); return; }
  mentionFilter = match[1].toLowerCase();
  await showMentionDropdown(ta, match.index, pos);
}

// \u2500\u2500 Model-specific ref label for display & insertion \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _refModelLabel(refIdx, modelType) {
  if (modelType === 'kling' || modelType === 'flux') return `@Image${refIdx + 1}`;
  if (modelType === 'seedream') return `Figure ${refIdx + 1}`;
  if (modelType === 'gemini' || modelType === 'proxy_xai') return `image ${refIdx + 1}`;
  return null; // other models: use user label
}

async function showMentionDropdown(ta, atStart, curPos) {
  const modelType = MODELS[currentModel]?.type;

  mentionAssets = refs.filter(r => {
    const label = (r.userLabel || r.autoName || '').toLowerCase();
    return !mentionFilter || label.startsWith(mentionFilter) || label.includes(mentionFilter);
  });

  const dd = document.getElementById('mentionDropdown');

  if (!mentionAssets.length) {
    dd.innerHTML = '<div style="padding:10px 14px;font-size:11px;color:var(--dim2);font-style:italic;">No refs added \u2014 add reference images below the prompt first</div>';
  } else {
    dd.innerHTML = mentionAssets.map((r, i) => {
      const userLabel = r.userLabel || r.autoName || `ref ${i + 1}`;
      const refIdx = refs.indexOf(r);
      const modelLabel = _refModelLabel(refIdx, modelType);
      const thumbSrc = `data:${r.mimeType||'image/png'};base64,${r.thumb}`;
      return `
      <div class="mention-item ${i === mentionActiveIdx ? 'mi-active' : ''}" data-idx="${i}" onmousedown="insertMention(event,${i})">
        <img class="mi-thumb" src="${thumbSrc}" alt="${escHtml(userLabel)}">
        <div class="mi-info">
          <div class="mi-name">${modelLabel ? escHtml(modelLabel) : escHtml(userLabel)}</div>
          <div class="mi-sub">${modelLabel ? escHtml(userLabel) : (r.userLabel ? r.autoName : 'no custom name')}</div>
        </div>
        <span class="mi-insert">\u21b5</span>
      </div>`;
    }).join('');
  }

  const coords = getTextareaCaretCoords(ta, atStart);
  const taRect = ta.getBoundingClientRect();
  let x = taRect.left + coords.left;
  let y = taRect.top + coords.top + 18;
  const ddW = 320;
  if (x + ddW > window.innerWidth) x = window.innerWidth - ddW - 8;
  dd.style.left = x + 'px';
  dd.style.top = y + 'px';
  dd.classList.add('show');
  mentionOpen = true;
  mentionActiveIdx = -1;
}

function getTextareaCaretCoords(ta, pos) {
  return { left: 10, top: ta.scrollTop + 16 };
}

function handleMentionKeydown(e) {
  if (!mentionOpen) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    mentionActiveIdx = Math.min(mentionActiveIdx + 1, mentionAssets.length - 1);
    updateMentionActive();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    mentionActiveIdx = Math.max(mentionActiveIdx - 1, 0);
    updateMentionActive();
  } else if (e.key === 'Enter' && mentionActiveIdx >= 0) {
    e.preventDefault();
    insertMentionByIdx(mentionActiveIdx);
  } else if (e.key === 'Escape') {
    closeMention();
  }
}

function updateMentionActive() {
  document.querySelectorAll('.mention-item').forEach((el, i) => {
    el.classList.toggle('mi-active', i === mentionActiveIdx);
  });
}

function insertMention(e, idx) {
  e.preventDefault();
  insertMentionByIdx(idx);
}

function insertMentionByIdx(idx) {
  if (idx < 0 || idx >= mentionAssets.length) return;
  const r = mentionAssets[idx];
  const refIdx = refs.indexOf(r);
  const modelType = MODELS[currentModel]?.type;
  const modelLabel = _refModelLabel(refIdx, modelType);
  const userLabel = (r.userLabel || r.autoName || `ref_${refIdx + 1}`).replace(/\s+/g, '_');
  const insertText = modelLabel || ('@' + userLabel);

  const ta = document.getElementById('prompt');
  const val = ta.value;
  const pos = ta.selectionStart;
  const before = val.slice(0, pos);
  const after = val.slice(pos);
  const newBefore = before.replace(/@(\w*)$/, insertText);
  ta.value = newBefore + after;
  ta.selectionStart = ta.selectionEnd = newBefore.length;
  ta.focus();
  updateCharCount();
  closeMention();
}

function closeMention() {
  document.getElementById('mentionDropdown').classList.remove('show');
  mentionOpen = false;
  mentionActiveIdx = -1;
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// LIVE PROMPT REWRITING
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

// Reverse-map model-specific names back to @UserLabel form
function promptModelToUserLabels(prompt, activeRefs, modelType) {
  if (!prompt || !activeRefs.length) return prompt;

  if (modelType === 'kling' || modelType === 'flux') {
    return prompt.replace(/@Image(\d+)/gi, (full, n) => {
      const idx = parseInt(n) - 1;
      const ref = activeRefs[idx];
      if (!ref) return full;
      const label = (ref.userLabel || ref.autoName || `Ref_${idx + 1}`).replace(/\s+/g, '_');
      return '@' + label;
    });
  }

  if (modelType === 'seedream') {
    return prompt.replace(/\bFigure\s+(\d+)\b/gi, (full, n) => {
      const idx = parseInt(n) - 1;
      const ref = activeRefs[idx];
      if (!ref) return full;
      const label = (ref.userLabel || ref.autoName || `Ref_${idx + 1}`).replace(/\s+/g, '_');
      return '@' + label;
    });
  }

  if (modelType === 'gemini' || modelType === 'proxy_xai') {
    let p = prompt.replace(/^\[Reference images:[^\]]*\]\s*/i, '');
    p = p.replace(/\bimage\s+\d+\s*\(([^)]+)\)/gi, (full, label) => {
      return '@' + label.trim().replace(/\s+/g, '_');
    });
    p = p.replace(/\bimage\s+(\d+)\b/gi, (full, n) => {
      const idx = parseInt(n) - 1;
      const ref = activeRefs[idx];
      if (!ref) return full;
      const label = (ref.userLabel || ref.autoName || `Ref_${idx + 1}`).replace(/\s+/g, '_');
      return '@' + label;
    });
    return p;
  }

  return prompt;
}

// Called on model switch and after refs change
function rewritePromptForModel(prevType, newType) {
  const ta = document.getElementById('prompt');
  if (!ta || !ta.value.trim()) return;

  // Always clean up any legacy [Reference images: ...] prefix first
  const cleaned = ta.value.replace(/^\[Reference images:[^\]]*\]\s*/gi, '');
  if (cleaned !== ta.value) ta.value = cleaned;

  if (!refs.length) {
    if (typeof updateCharCount === 'function') updateCharCount();
    return;
  }

  // Step 1: convert current text back to canonical @UserLabel form
  const canonical = prevType
    ? promptModelToUserLabels(ta.value, refs, prevType)
    : ta.value;

  // Step 2: apply new model's format
  const newPrompt = preprocessPromptForModel(canonical, refs, newType);

  if (newPrompt !== ta.value) {
    const pos = ta.selectionStart;
    ta.value = newPrompt;
    ta.selectionStart = ta.selectionEnd = Math.min(pos, newPrompt.length);
    if (typeof updateCharCount === 'function') updateCharCount();
  }
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// PROMPT PREPROCESSING \u2014 @mention \u2192 model-specific format
// (safety net at generate-time; live rewriting happens above)
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

function preprocessPromptForModel(prompt, activeRefs, modelType) {
  if (!prompt) return prompt;
  // Always strip any legacy [Reference images: ...] prefix — it's no longer used
  prompt = prompt.replace(/^\[Reference images:[^\]]*\]\s*/gi, '');
  if (!activeRefs.length) return prompt;

  const labelMap = new Map();
  activeRefs.forEach((r, i) => {
    const key = (r.userLabel || r.autoName || '').replace(/_/g, ' ').toLowerCase();
    if (key) labelMap.set(key, i);
    const keyU = (r.userLabel || r.autoName || '').toLowerCase();
    if (keyU) labelMap.set(keyU, i);
    const an = (r.autoName || '').toLowerCase();
    if (an) labelMap.set(an, i);
  });

  function findIdx(mention) {
    const m = mention.replace(/_/g, ' ').toLowerCase();
    if (labelMap.has(m)) return labelMap.get(m);
    const mu = mention.toLowerCase();
    if (labelMap.has(mu)) return labelMap.get(mu);
    return -1;
  }

  if (modelType === 'flux' || modelType === 'seedream' || modelType === 'kling') {
    const tmpl = modelType === 'seedream'
      ? (i) => `Figure ${i + 1}`
      : (i) => `@Image${i + 1}`;
    return prompt.replace(/@([\w]+)/g, (full, mention) => {
      const idx = findIdx(mention);
      return idx >= 0 ? tmpl(idx) : full;
    });
  }

  if (modelType === 'gemini' || modelType === 'proxy_xai') {
    // Strip any legacy prefix (from older versions or old conversations)
    const strippedPrompt = prompt.replace(/^\[Reference images:[^\]]*\]\s*/gi, '');
    // Convert @mentions to "image N" format — no prefix added
    return strippedPrompt.replace(/@([\w]+)/g, (full, mention) => {
      const idx = findIdx(mention);
      return idx >= 0 ? `image ${idx + 1}` : full;
    });
  }

  return prompt;
}




// ═══════════════════════════════════════════════════════
// DESCRIBE IMAGE — popis obrázku z ref panelu přes Gemini
// Funkce sdíleny s video.js (describeVideoRef volá _runDescribe + setDescribeTab)
// ═══════════════════════════════════════════════════════

let _describeCurrentIdx  = null;
let _describeCurrentData = null; // { imageData, mimeType } — sdíleno s video describe
let _describeSource      = 'image'; // 'image' | 'video' — nastavuje volající
let _describeAbortCtrl   = null;    // AbortController — cancel při přepnutí tabu

async function describeRefImage(idx) {
  const ref = refs[idx];
  if (!ref) return;

  const apiKey = document.getElementById('apiKey')?.value?.trim() || '';
  if (!apiKey) { toast('Enter Google API key in Setup', 'err'); return; }

  _describeSource     = 'image';
  _describeCurrentIdx = idx;

  let imageData = null, mimeType = 'image/jpeg';
  if (ref.assetId) {
    const asset = await dbGet('assets', ref.assetId);
    if (asset?.imageData) { imageData = asset.imageData; mimeType = asset.mimeType || 'image/jpeg'; }
  }
  if (!imageData && ref.data) { imageData = ref.data; mimeType = ref.mimeType || 'image/jpeg'; }
  if (!imageData) { toast('Image data not available — try re-adding the reference', 'err'); return; }

  document.getElementById('dmPreview').src = `data:${mimeType};base64,${imageData}`;
  document.getElementById('dmResult').value = '';
  document.getElementById('describeModal').classList.add('show');
  setDescribeTab('prompt');
  await _runDescribe(apiKey, imageData, mimeType, 'prompt');
}

// Volána také z video.js: _runDescribe(apiKey, imageData, mimeType, mode)
async function _runDescribe(apiKey, imageData, mimeType, mode) {
  // Zruš případně běžící generování
  if (_describeAbortCtrl) { _describeAbortCtrl.abort(); }
  _describeAbortCtrl = new AbortController();
  const signal = _describeAbortCtrl.signal;

  _describeCurrentData = { imageData, mimeType };
  const resultEl = document.getElementById('dmResult');
  const statusEl = document.getElementById('dmStatus');
  if (resultEl) resultEl.value = '';
  if (statusEl) { statusEl.textContent = '⟳ Generating…'; statusEl.classList.add('generating'); }

  // Compress to 1024px max — VLMs don't need full resolution, reduces payload ~10-100×
  const DESCRIBE_MAX_PX = 1024;
  let sendData = imageData, sendMime = mimeType;
  try {
    const resized = await resizeImageToCanvas(`data:${mimeType};base64,${imageData}`, DESCRIBE_MAX_PX);
    const comma = resized.indexOf(',');
    if (comma !== -1) { sendMime = resized.slice(5, resized.indexOf(';')); sendData = resized.slice(comma + 1); }
  } catch (_) { /* fallback: send original */ }

  try {
    const result = await callGeminiDescribe(apiKey, sendData, sendMime, mode, _describeSource, signal);
    if (signal.aborted) return; // tab byl přepnut — výsledek zahod
    if (resultEl) resultEl.value = result.trim();
    if (statusEl) {
      statusEl.classList.remove('generating');
      statusEl.textContent = mode === 'prompt'
        ? (_describeSource === 'video' ? 'Video prompt — edit or use directly.' : 'AI Prompt — edit or use directly.')
        : 'Brief description — edit or add to prompt.';
    }
  } catch(e) {
    if (signal.aborted) return;
    if (statusEl) { statusEl.classList.remove('generating'); statusEl.textContent = '⚠ Error: ' + e.message; }
  } finally {
    if (_describeAbortCtrl?.signal === signal) _describeAbortCtrl = null;
  }
}

// Volána z tab tlačítek v describeModal + z video.js
function setDescribeTab(mode) {
  document.getElementById('dmTab_prompt')?.classList.toggle('active', mode === 'prompt');
  document.getElementById('dmTab_desc')?.classList.toggle('active',   mode === 'desc');
  const modeEl = document.getElementById('dmModeActive');
  if (modeEl) modeEl.value = mode;
  if (!_describeCurrentData) return;
  const apiKey = document.getElementById('apiKey')?.value?.trim() || '';
  if (!apiKey) return;
  _runDescribe(apiKey, _describeCurrentData.imageData, _describeCurrentData.mimeType, mode);
}

// Describe fallback chain: Gemini 2.5 Flash → OpenRouter Qwen2.5-VL-72B
// OpenRouter is a completely separate cloud — immune to Google outages.
const OR_DESCRIBE_MODEL      = 'anthropic/claude-sonnet-4-6';  // primary: vision + creative
const GEMINI_DESCRIBE_MODEL  = 'gemini-3.1-pro-preview';        // fallback if no OR key

async function callGeminiDescribe(apiKey, imageData, mimeType, mode, source, signal) {
  let instruction;
  if (source === 'video' && mode === 'prompt') {
    instruction = 'This image is the starting frame for an AI video generation. Write a concise video generation prompt in English. Focus on: what specific action or movement the subject will perform, camera motion (pan, zoom, tilt, dolly, static, handheld, etc.), and how the scene atmosphere or light evolves during the shot. Do NOT re-describe the static visual appearance — the model already sees the image. Be specific about motion and dynamics. Output ONLY the motion/action prompt, no explanations, no quotes, no markdown.';
  } else if (mode === 'desc') {
    instruction = 'Describe this image briefly and clearly in 2–4 sentences in English. Cover: what is shown, setting/context, and any notable visual details. Output ONLY the description, no lists, no markdown, no explanations.';
  } else {
    instruction = 'Describe this image as a detailed image generation prompt in English. Think like a photographer seeing this shot for the first time — what is the most distinctive element? Include: subject with specific detail, composition and framing, quality and direction of light, mood/atmosphere, color palette, material textures, camera/lens feel if apparent. Avoid generic phrases like \"cinematic lighting\" or \"beautiful scene\" — be specific and evocative. Output ONLY the prompt text, no explanations, no quotes, no markdown.';
  }
  const statusEl = document.getElementById('dmStatus');
  const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();

  if (orKey) {
    // ── Primary: Claude Sonnet via OpenRouter (vision) ──────────────────
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const result = await _callOpenRouterVision(orKey, imageData, mimeType, instruction, signal);
    trackSpend('openrouter', '_or_describe', 1);
    return result;
  }

  // ── Fallback: Gemini 3.1 Pro ─────────────────────────────────────
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DESCRIBE_MODEL}:generateContent?key=${apiKey}`;
  for (let i = 0; i < 2; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (i > 0) {
      if (statusEl) statusEl.textContent = `⟳ Retrying…`;
      await new Promise(r => setTimeout(r, 1500));
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    }
    const resp = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: imageData } },
          { text: instruction }
        ]}],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
      signal,
    });
    const data = await resp.json();
    if (resp.ok) return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const err = new Error(`API ${resp.status}: ${data.error?.message || JSON.stringify(data.error)}`);
    if (resp.status !== 503 && resp.status !== 429 && resp.status !== 500) throw err;
    if (i === 1) throw err;
  }
}

// OpenRouter vision call — Claude Sonnet with base64 image
async function _callOpenRouterVision(orKey, imageData, mimeType, instruction, signal) {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gis.local',
      'X-Title': 'Generative Image Studio',
    },
    body: JSON.stringify({
      model: OR_DESCRIBE_MODEL,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}` } },
        { type: 'text', text: instruction },
      ]}],
      max_tokens: 1024,
      temperature: 0.7,
    }),
    signal,
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${data.error?.message || JSON.stringify(data.error)}`);
  return data.choices?.[0]?.message?.content || '';
}
function closeDescribeModal() {
  if (_describeAbortCtrl) { _describeAbortCtrl.abort(); _describeAbortCtrl = null; }
  document.getElementById('describeModal')?.classList.remove('show');
  _describeCurrentIdx  = null;
  _describeCurrentData = null;
  _describeSource      = 'image';
  document.getElementById('dmStatus')?.classList.remove('generating');
}

function describeModalBgClick(e) {
  if (e.target === document.getElementById('describeModal')) closeDescribeModal();
}

function describeUseAsPrompt() {
  const text = document.getElementById('dmResult')?.value.trim();
  if (!text) return;
  const isVideo = _describeSource === 'video';
  const promptEl = document.getElementById(isVideo ? 'videoPrompt' : 'prompt');
  if (promptEl) promptEl.value = text;
  if (!isVideo && typeof updateCharCount === 'function') updateCharCount();
  closeDescribeModal();
  if (isVideo) {
    if (typeof setGenMode === 'function') setGenMode('video');
    setTimeout(() => document.getElementById('videoPrompt')?.focus(), 50);
  } else {
    if (typeof switchView === 'function') switchView('gen');
  }
  toast('Prompt set', 'ok');
}

function describeAppendToPrompt() {
  const text = document.getElementById('dmResult')?.value.trim();
  if (!text) return;
  const isVideo = _describeSource === 'video';
  const promptEl = document.getElementById(isVideo ? 'videoPrompt' : 'prompt');
  if (promptEl) {
    const existing = promptEl.value.trim();
    promptEl.value = existing ? existing + '\n\n' + text : text;
  }
  if (!isVideo && typeof updateCharCount === 'function') updateCharCount();
  closeDescribeModal();
  if (isVideo) {
    if (typeof setGenMode === 'function') setGenMode('video');
    setTimeout(() => document.getElementById('videoPrompt')?.focus(), 50);
  } else {
    if (typeof switchView === 'function') switchView('gen');
  }
  toast('Appended to prompt', 'ok');
}
