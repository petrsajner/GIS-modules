// ═══════════════════════════════════════════════════════
// AI PROMPT TOOL
// ═══════════════════════════════════════════════════════

let aiCurrentTab = 'improve';
let aiChatHistory = [];
let aiBuffer = '';      // Shared buffer across all tabs

// Per-tab output textarea IDs
const AI_OUTPUT_IDS = {
  improve:   'aiImproveOutput',
  variants:  'aiVariantsOutput',
  translate: 'aiTranslateOutput',
  random:    'aiRandomOutput',
};

// Per-tab input textarea IDs
const AI_INPUT_IDS = {
  improve:   'aiImproveInput',
  variants:  'aiVariantsInput',
  translate: 'aiTranslateInput',
};

// ── Buffer ───────────────────────────────────────────
function setAiBuffer(text) {
  aiBuffer = (text || '').trim();
  // Write to current tab's output textarea
  const outId = AI_OUTPUT_IDS[aiCurrentTab];
  if (outId) {
    const el = document.getElementById(outId);
    if (el) {
      el.value = aiBuffer;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 280) + 'px';
    }
  }
}

function getActivePrompt() {
  if (window.aiPromptContext === 'video') {
    return document.getElementById('videoPrompt')?.value?.trim() || '';
  }
  return document.getElementById('prompt')?.value?.trim() || '';
}

// ── Open / Close ──────────────────────────────────────
function openAiPromptModal() {
  if (!aiBuffer) {
    setAiBuffer(getActivePrompt());  // Fresh open — load current prompt
    _clearTabOutput(aiCurrentTab);   // Clear any stale output from previous session
  }
  _syncBufferToTabInput(aiCurrentTab);
  const isVideo = window.aiPromptContext === 'video';
  const badge = document.getElementById('aiContextBadge');
  if (badge) {
    badge.textContent = isVideo ? 'VIDEO' : 'IMAGE';
    badge.className = 'aipm-badge ' + (isVideo ? 'aipm-badge-video' : 'aipm-badge-image');
  }
  if (aiCurrentTab === 'chat') _prepChatInput();
  document.getElementById('aiPromptModal').classList.add('show');
}

function closeAiPromptModal() {
  document.getElementById('aiPromptModal').classList.remove('show');
}

function aiPromptModalBgClick(e) {
  if (e.target === document.getElementById('aiPromptModal')) closeAiPromptModal();
}

// ── Tab switching ─────────────────────────────────────
function setAiTab(tab) {
  aiCurrentTab = tab;
  document.querySelectorAll('.aipm-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('aiTab_' + tab)?.classList.add('active');
  ['improve','variants','translate','random','chat'].forEach(t => {
    const el = document.getElementById('aiSection_' + t);
    if (el) el.style.display = (t === tab) ? (t === 'chat' ? 'flex' : '') : 'none';
  });
  const runBtn = document.getElementById('aiRunBtn');
  if (runBtn) runBtn.style.display = tab === 'chat' ? 'none' : '';
  // Fill input from buffer, clear output
  _syncBufferToTabInput(tab);
  _clearTabOutput(tab);
  document.getElementById('aiStatus').textContent = '';
  const labels = { improve: '▶ Enhance', variants: '▶ Generate variants', translate: '▶ Translate', random: '▶ Generate' };
  const lbl = document.getElementById('aiRunLabel');
  if (lbl) lbl.textContent = labels[tab] || '▶ Run';
  if (tab === 'chat') _prepChatInput();
}

function _syncBufferToTabInput(tab) {
  const id = AI_INPUT_IDS[tab];
  if (!id || !aiBuffer) return;
  const el = document.getElementById(id);
  if (el) {
    el.value = aiBuffer;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }
}

function _clearTabOutput(tab) {
  const id = AI_OUTPUT_IDS[tab];
  if (!id) return;
  const el = document.getElementById(id);
  if (el) { el.value = ''; el.style.height = 'auto'; }
}

// Copy input textarea content to output (use original prompt as result)
function aiUseInputAsResult(tab) {
  const inputId = AI_INPUT_IDS[tab];
  if (!inputId) return;
  const el = document.getElementById(inputId);
  if (el) setAiBuffer(el.value.trim());
}

function _prepChatInput() {
  const input = document.getElementById('aiChatInput');
  if (input) { input.value = ''; input.style.height = 'auto'; }
  // If no history yet and buffer has content, show it as initial context bubble
  if (!aiChatHistory.length && aiBuffer) {
    const history = document.getElementById('aiChatHistory');
    if (history && !history.querySelector('.aipm-msg-context')) {
      const div = document.createElement('div');
      div.className = 'aipm-msg aipm-msg-context';
      div.innerHTML = '<span style="font-size:9px;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;">Working with prompt:</span>'
        + (typeof escHtml === 'function' ? escHtml(aiBuffer) : aiBuffer);
      history.appendChild(div);
    }
  }
}

// ── Use as Prompt ─────────────────────────────────────
function _resetAiModal() {
  aiBuffer = '';
  aiChatHistory = [];
  // Clear all tab output textareas
  Object.values(AI_OUTPUT_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.style.height = 'auto'; }
  });
  // Clear all tab input textareas
  Object.values(AI_INPUT_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.style.height = 'auto'; }
  });
  // Clear chat history DOM
  const hist = document.getElementById('aiChatHistory');
  if (hist) hist.innerHTML = '';
  const chatInput = document.getElementById('aiChatInput');
  if (chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }
  document.getElementById('aiStatus').textContent = '';
}

function useAiBuffer() {
  if (!aiBuffer) { toast('No prompt in buffer', 'err'); return; }
  const ta = window.aiPromptContext === 'video'
    ? document.getElementById('videoPrompt')
    : document.getElementById('prompt');
  if (ta) {
    ta.value = aiBuffer;
    ta.dispatchEvent(new Event('input'));
    const cc = document.getElementById('charCount');
    if (cc) cc.textContent = aiBuffer.length + ' ch.';
  }
  _resetAiModal();  // Full reset — next open loads fresh prompt from textarea
  closeAiPromptModal();
}

// ── Run dispatcher ────────────────────────────────────
async function runAiPrompt() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) { toast('Enter API key (Gemini)', 'err'); return; }
  const btn = document.getElementById('aiRunBtn');
  btn.disabled = true;
  btn.classList.add('loading');
  document.getElementById('aiStatus').textContent = 'Generating…';
  try {
    if      (aiCurrentTab === 'improve')   await runAiImprove(apiKey);
    else if (aiCurrentTab === 'translate') await runAiTranslate(apiKey);
    else if (aiCurrentTab === 'random')    await runAiRandom(apiKey);
    else if (aiCurrentTab === 'variants')  await runAiVariants(apiKey);
    document.getElementById('aiStatus').textContent = 'Done — edit below or use ↗';
  } catch(e) {
    document.getElementById('aiStatus').textContent = '⚠ ' + e.message;
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

// ── Enhance ───────────────────────────────────────────
async function runAiImprove(apiKey) {
  const input = document.getElementById('aiImproveInput').value.trim();
  if (!input) { toast('Enter a description to enhance', 'err'); return; }
  const isVideo = window.aiPromptContext === 'video';
  const camCtx = buildCameraContext();
  const system = isVideo
    ? `You are an expert cinematographer writing prompts for AI video generation.
Take the rough scene description and expand it into a detailed ready-to-use video prompt.
Include: subject + specific action/movement, camera motion (tracking/dolly/static/pan/zoom), environment, lighting, cinematic style.
Think in shots — how does the scene begin, what moves, where does the camera go.
Color unless creatively justified. Real or fantastical — grounded in physical motion.${camCtx}
Output ONLY the prompt text. No labels, no explanations, no markdown.`
    : `You are an expert photographer writing prompts for AI image generation.
Take the rough description and expand it into a detailed vivid ready-to-use image prompt.
Think like a photographer: what lens, what light, what exact moment, what composition?
Include: subject with specific detail, composition/framing, lighting quality, mood, color palette, camera/lens feel.
Color unless creatively justified. Wider shots preferred over extreme close-ups.${camCtx}
Output ONLY the prompt text. No labels, no explanations, no markdown.`;
  const result = await callGeminiText(apiKey, system, input);
  setAiBuffer(result.trim());
}

// ── Translate ─────────────────────────────────────────
async function runAiTranslate(apiKey) {
  const input = document.getElementById('aiTranslateInput').value.trim();
  if (!input) { toast('Enter text to translate', 'err'); return; }
  const lang = document.getElementById('aiTranslateLang').value;
  const src = lang === 'auto' ? 'auto-detected language' : lang;
  const system = `You are a precise translator. Translate the following ${src} text to English.
Preserve meaning, style, and all descriptive content exactly.
If already in English, return it unchanged.
Output ONLY the translated text. No explanations, no labels.`;
  const result = await callGeminiText(apiKey, system, input);
  setAiBuffer(result.trim());
}

// ── Variants ──────────────────────────────────────────
async function runAiVariants(apiKey) {
  const input = document.getElementById('aiVariantsInput').value.trim();
  if (!input) { toast('Enter a prompt to vary', 'err'); return; }
  const n = parseInt(document.getElementById('aiVariantsN').value) || 3;
  const isVideo = window.aiPromptContext === 'video';
  const camCtx = buildCameraContext();
  const system = isVideo
    ? `You are an expert cinematographer. Generate ${n} distinct video prompt variations based on the given prompt.
Each variation explores a different camera approach, time of day, mood, or action dynamic.
Keep the core subject/scene but make each feel like a genuinely different shot or sequence.${camCtx}
Output ONLY the ${n} prompts, one per line, numbered: "1. ...", "2. ...", etc. No extra text.`
    : `You are an expert photographer. Generate ${n} distinct image prompt variations based on the given prompt.
Each variation explores a different composition, lighting, mood, or visual approach.
Keep the core subject/scene but make each feel genuinely different.${camCtx}
Output ONLY the ${n} prompts, one per line, numbered: "1. ...", "2. ...", etc. No extra text.`;
  const result = await callGeminiText(apiKey, system, input);
  const lines = result.split('\n').map(l => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(l => l.length > 20);
  renderAiVariants(lines);
}

function renderAiVariants(items) {
  const container = document.getElementById('aiVariantsCards');
  if (!container) { if (items[0]) setAiBuffer(items[0]); return; }
  container.innerHTML = '';
  items.forEach((text, i) => {
    const card = document.createElement('div');
    card.className = 'aipm-variant-card';
    card.innerHTML = `<div class="aipm-variant-text">${escHtml(text)}</div>`;
    card.onclick = () => {
      container.querySelectorAll('.aipm-variant-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      setAiBuffer(text);
    };
    container.appendChild(card);
    if (i === 0) { card.classList.add('selected'); setAiBuffer(text); }
  });
}

// ── Random ────────────────────────────────────────────
function buildCameraContext() {
  if (typeof selectedCameras === 'undefined' || selectedCameras.size === 0) return '';
  const names = Array.from(selectedCameras.values()).map(c => c.name).join(', ');
  return `\nThe user has selected camera parameters: ${names}. Incorporate them naturally.`;
}

async function runAiRandom(apiKey) {
  const activeChips = [...document.querySelectorAll('#aiRandomChips .aipm-chip.active')].map(c => c.dataset.val);
  const genreHint = activeChips.length > 0
    ? `Genre/mood direction: ${activeChips.join(', ')}.`
    : 'No genre constraint — be surprising and varied.';

  const subjects = [
    'person in a specific candid moment','two people in conversation or interaction',
    'small group of people','lone figure in a vast environment',
    'animal in its natural habitat','crowd scene with energy',
    'working person or craftsperson','child at play',
    'architectural space with human presence','street scene with passersby',
    'vehicle or machine in use','athlete or performer in motion',
    'traveller in an unfamiliar place','natural landscape (no people)'
  ];
  const contexts = [
    'documentary moment','environmental portrait',
    'travel photography','urban street','wildlife',
    'reportage or photojournalism','staged cinematic scene',
    'fantasy world','science fiction environment',
    'historical period','near future city','underwater world'
  ];
  const compositions = [
    'wide establishing shot','medium shot',
    'medium-wide with environment','environmental portrait — full context',
    'over-the-shoulder perspective','aerial wide view',
    'low angle looking up','through-frame composition',
    'two-shot with relationship','silhouette against sky'
  ];
  const lights = [
    'golden hour warmth','blue hour twilight',
    'overcast diffused light','dramatic storm light',
    'warm interior artificial light','harsh midday sun',
    'soft morning haze','neon night reflections on wet pavement',
    'firelight or candlelight','dappled forest shade'
  ];
  const moods = [
    'quietly intimate','energetic and alive','mysterious',
    'melancholic','epic scale','tender moment',
    'tense or uncertain','serene and peaceful','gritty and raw','playful'
  ];

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const axes = `Subject: ${pick(subjects)} | Context: ${pick(contexts)} | Composition: ${pick(compositions)} | Light: ${pick(lights)} | Mood: ${pick(moods)}`;
  const isVideo = window.aiPromptContext === 'video';
  const camCtx = buildCameraContext();

  const system = isVideo
    ? `You are an expert cinematographer generating creative video prompts.
Think like a working director of photography — what would you actually shoot?

Creative axes (interpret freely, combine unexpectedly):
${axes}
${genreHint}

RULES:
- Subject + specific ACTION or MOVEMENT (what happens during the shot)
- Camera motion: tracking / static / slow zoom / dolly / handheld / crane
- Environment, light, atmosphere
- Realistic film aesthetic — color unless noir/historical specifically justifies B&W
- Medium or wide shots preferred over extreme close-ups
- Real or fantastical world — grounded in physical motion
- 1-2 dense sentences
${camCtx}
Output ONLY the prompt text. No explanations, no labels, no markdown.`
    : `You are an expert photographer generating creative AI image prompts.
Think like a working photographer — what would you actually shoot and how?

Creative axes (interpret freely, combine unexpectedly):
${axes}
${genreHint}

RULES:
- Realistic photography or cinematic film frame — COLOR unless noir/historical specifically justifies B&W
- Wider shots preferred: wide / medium-wide / establishing
- Include living subjects (people or animals) unless purely landscape or architecture
- Real or fantastical world — grounded in physical reality and light
- Camera/lens feel natural: "35mm f/1.8", "anamorphic", "telephoto" — NOT "ultra-detailed 8K render"
- One unexpected specific detail that makes the image memorable
- Photo or film only — NO illustration, NO sculpture, NO charcoal, NO painting styles
${camCtx}
Output ONLY the prompt text. No explanations, no labels, no markdown.`;

  const userMsg = isVideo
    ? 'Generate a unique cinematic video prompt with clear action, camera motion, and atmosphere.'
    : 'Generate a unique unexpected photographic or cinematic image prompt. Be specific and surprising.';

  const result = await callGeminiText(apiKey, system, userMsg);
  setAiBuffer(result.trim());
}

// ── Chat ──────────────────────────────────────────────
const AI_CHAT_SYSTEM_IMAGE = `You are an expert photographer and prompt editor for AI image generation, working in a multi-turn conversation.

HOW TO EDIT:
- Understand the user's INTENT, not just their literal words. "Make the light warmer" means rewriting the lighting description naturally into the prompt — not appending "warm light" at the end.
- Integrate every change into the existing prose. Find the relevant part of the sentence and rewrite it. Do not append keywords or phrases at the end.
- Preserve the style, voice, and structure of the existing prompt for everything not affected by the change.
- If the user wants something added that has no existing counterpart, weave it in at the natural place in the sentence — not bolted on at the end.

TECHNICAL:
- Your previous response IS the current prompt. Always start from it.
- Respond ONLY with the complete revised prompt. No explanations, no labels, no markdown.

If this is the first message, start from the provided starting prompt and apply the user's request.`;

const AI_CHAT_SYSTEM_VIDEO = `You are an expert cinematographer and prompt editor for AI video generation, working in a multi-turn conversation.

A strong video prompt describes: subject + specific action/movement, camera motion, atmosphere/light, and how things change or evolve during the shot.

HOW TO EDIT:
- Understand the user's INTENT, not just their literal words. "The sun turns red during the shot" means rewriting the lighting/atmosphere section to describe this transition as it unfolds — not appending "Red sun" at the end.
- Integrate every change into the existing prose. Find the relevant phrase and rewrite it to carry the new meaning naturally. Use language like "as the shot progresses...", "while the camera holds...", "the light shifts to..." for temporal changes.
- Temporal events (light changing, subject reacting, weather shifting) must be described as things that HAPPEN DURING the shot — woven into the flow of the action, not listed separately.
- Preserve the style, voice, and structure of everything not affected by the change.

TECHNICAL:
- Your previous response IS the current prompt. Always start from it.
- Respond ONLY with the complete revised prompt. No explanations, no labels, no markdown.

If this is the first message, start from the provided starting prompt and apply the user's request.`;

function clearAiChat() {
  aiChatHistory = [];
  const hist = document.getElementById('aiChatHistory');
  if (hist) hist.innerHTML = '';
  const input = document.getElementById('aiChatInput');
  if (input) { input.value = ''; input.style.height = 'auto'; }
  // Re-show context bubble with current buffer after clear
  setTimeout(() => _prepChatInput(), 50);
}

async function aiChatRandomStart() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) { toast('Enter API key (Gemini)', 'err'); return; }
  clearAiChat();
  const isVideo = window.aiPromptContext === 'video';
  const system = isVideo
    ? 'Generate one short evocative video scene idea — 1-2 sentences, raw concept with interesting movement. Be surprising. Output only the concept text.'
    : 'Generate one short evocative visual concept for an image — 1-2 sentences, raw idea. Be surprising. Output only the concept text.';
  try {
    const concept = await callGeminiText(apiKey, system, 'Give me a random visual concept.');
    const input = document.getElementById('aiChatInput');
    if (input) {
      input.value = concept.trim();
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      input.focus();
    }
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function sendAiChat() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) { toast('Enter API key (Gemini)', 'err'); return; }
  const inputEl = document.getElementById('aiChatInput');
  const input = inputEl.value.trim();
  if (!input) return;

  const sendBtn = document.getElementById('aiChatSendBtn');
  sendBtn.disabled = true;

  _appendChatMsg('user', input);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  aiChatHistory.push({ role: 'user', parts: [{ text: input }] });
  const typingEl = _appendChatTyping();

  try {
    const isVideo = window.aiPromptContext === 'video';
    let fullSystem = isVideo ? AI_CHAT_SYSTEM_VIDEO : AI_CHAT_SYSTEM_IMAGE;
    // First turn: inject buffer as explicit starting point
    if (aiChatHistory.length === 1 && aiBuffer) {
      fullSystem += `\n\nSTARTING PROMPT (preserve all of this, only modify what the user requests):\n${aiBuffer}`;
    }
    const response = await callGeminiTextMultiTurn(apiKey, fullSystem, aiChatHistory);
    aiChatHistory.push({ role: 'model', parts: [{ text: response }] });
    typingEl.remove();
    const text = response.trim();
    _appendChatMsg('model', text);
    setAiBuffer(text);
  } catch(e) {
    typingEl.remove();
    _appendChatMsg('model', '⚠ Error: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function _appendChatMsg(role, text) {
  const history = document.getElementById('aiChatHistory');
  if (!history) return;
  const div = document.createElement('div');
  div.className = 'aipm-msg aipm-msg-' + role;
  div.textContent = text;
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
  return div;
}

function _appendChatTyping() {
  const history = document.getElementById('aiChatHistory');
  const div = document.createElement('div');
  div.className = 'aipm-msg aipm-msg-model aipm-msg-typing';
  div.textContent = '…';
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
  return div;
}

// ── AI Prompt API — Claude (OR) primary, Gemini 3.1 Pro fallback ─────
const OR_AI_PROMPT_MODEL    = 'anthropic/claude-sonnet-4-6';  // primary: best creative writing
const GEMINI_FALLBACK_MODEL = 'gemini-3.1-pro-preview';       // fallback if no OR key

// OpenRouter call — Claude Sonnet
async function _callOpenRouterText(systemPrompt, userMsg, temperature, maxTokens) {
  const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
  if (!orKey) return null;
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMsg });
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${orKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gis.local',
      'X-Title': 'Generative Image Studio',
    },
    body: JSON.stringify({ model: OR_AI_PROMPT_MODEL, messages, max_tokens: maxTokens, temperature }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${data.error?.message || JSON.stringify(data.error)}`);
  return data.choices?.[0]?.message?.content || '';
}

// Gemini 3.1 Pro — fallback when no OR key
async function _callGeminiTextFallback(apiKey, systemPrompt, userMsg, temperature, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FALLBACK_MODEL}:generateContent?key=${apiKey}`;
  for (let i = 0; i < 2; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1500));
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const data = await resp.json();
    if (resp.ok) return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const err = new Error(`API ${resp.status}: ${data.error?.message || JSON.stringify(data.error)}`);
    if (resp.status !== 503 && resp.status !== 429 && resp.status !== 500) throw err;
    if (i === 1) throw err;
  }
}

async function _callGeminiMultiTurnFallback(apiKey, systemPrompt, history, temperature, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FALLBACK_MODEL}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: history,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: -1 } },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`API ${resp.status}: ${data.error?.message || JSON.stringify(data.error)}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGeminiTextMultiTurn(apiKey, systemPrompt, history) {
  const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
  if (orKey) {
    const lastUserMsg = [...history].reverse().find(m => m.role === 'user')?.parts?.[0]?.text || '';
    const result = await _callOpenRouterText(systemPrompt, lastUserMsg, 0.85, 2048);
    trackSpend('openrouter', '_or_prompt', 1);
    return result;
  }
  return await _callGeminiMultiTurnFallback(apiKey, systemPrompt, history, 0.85, 2048);
}

async function callGeminiText(apiKey, systemPrompt, userMsg) {
  const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
  if (orKey) {
    const result = await _callOpenRouterText(systemPrompt, userMsg, 0.9, 8192);
    trackSpend('openrouter', '_or_prompt', 1);
    return result;
  }
  return await _callGeminiTextFallback(apiKey, systemPrompt, userMsg, 0.9, 8192);
}
// ═══════════════════════════════════════════════════════
// EDIT TOOL
// ═══════════════════════════════════════════════════════

let _etmChatHistory = [];
let _etmRefAnalyses = [];    // Array of analyses for each reference image
let _etmLastPrompt = '';     // Last AI-generated edit prompt
let _etmCurrentModel = '';   // Model key selected in Edit Tool
let _etmLastRefCount = 0;    // Track ref count to detect changes
let _etmAnalyzing = false;

// ── Status line management ─────────────────────────────
function _etmSetStatus(state) {
  const analyzing = document.getElementById('etmAnalyzing');
  const statusLine = document.getElementById('etmStatusLine');
  if (!analyzing || !statusLine) return;
  if (state === 'analyzing') {
    analyzing.style.display = 'block';
    statusLine.className = 'etm-status-line etm-status-hidden';
  } else if (state === 'ready') {
    analyzing.style.display = 'none';
    statusLine.textContent = '● READY';
    statusLine.className = 'etm-status-line';
  } else if (state === 'thinking') {
    analyzing.style.display = 'none';
    statusLine.textContent = '● thinking…';
    statusLine.className = 'etm-status-line etm-status-thinking';
  } else {
    analyzing.style.display = 'none';
    statusLine.className = 'etm-status-line etm-status-hidden';
  }
}

// ── Model-type mapping ─────────────────────────────────
function _etmModelType(key) {
  const m = MODELS[key];
  if (!m) return 'gemini';
  if (m.type === 'gemini') return 'gemini';
  if (m.type === 'flux')   return 'flux';
  if (m.type === 'seedream') return 'seedream';
  return 'gemini';
}

// ── Comprehensive system prompts per model type ────────
// Shared rules for Keep section — identical across all models
const ETM_KEEP_RULES = `
KEEP SECTION RULES (critical — same for ALL models):
- List elements by SIMPLE NEUTRAL NAMES: "lighting", "sky", "snow", "mountains", "building".
- NEVER characterize or interpret elements: NOT "golden hour lighting", NOT "dramatic sky", NOT "fresh powder snow".
- The model sees the reference image — it knows what the lighting looks like. You just name the element.
- Use the same neutral language regardless of which model the prompt is for.`;

// Model-specific element edit rules
const ETM_ELEMENT_GEMINI = `
=== ELEMENT EDIT MODE (Gemini NB2 / NB Pro) ===
- The reference image does the heavy lifting. The model SEES it. Less text = less deviation.
- Keep the prompt SHORT — under 60 words. Every extra word risks unwanted changes.
- NEVER use compass directions or numeric angles.
- Position elements using visible objects: "between the desk and the window".

PROMPT STRUCTURE:
Keep [simple neutral element names] identical.
Change only this: [minimal description of ONLY the requested change].
Photorealistic, cinematic, 35mm, film grain.`;

const ETM_ELEMENT_FLUX = `
=== ELEMENT EDIT MODE (Flux 2) ===
- Flux takes prompts literally. Describe the full scene factually but don't embellish.
- The "Preserve exactly" section must be comprehensive.
- The "Change" section must be MINIMAL — only the user's request.

PROMPT STRUCTURE:
Original scene: [factual description from analysis — simple names, no adjective embellishment].
Preserve exactly: [comprehensive list using simple neutral element names].
Change: [ONLY the user's requested change].
Photorealistic, cinematic, 35mm, film grain.

Negative prompt: CGI, 3D render, cartoon, illustration, anime, watermark, bad anatomy, extra limbs, blurry`;

const ETM_ELEMENT_SEEDREAM = `
=== ELEMENT EDIT MODE (Seedream) ===
- Concise and precise. Every word must earn its place.
- Do NOT invent details. Use the user's exact words for the change.

PROMPT STRUCTURE:
Keep [simple neutral element names] unchanged.
Change: [ONLY user's requested change — their words].
Photorealistic, cinematic, 35mm, film grain.

Negative prompt: cartoon, CGI, 3D render, blurry, bad anatomy, watermark`;

// Shared camera reframe knowledge — same for all models
const ETM_REFRAME_KNOWLEDGE = `
=== CAMERA REFRAME MODE ===

When the user asks to change camera angle, position, distance, or perspective:

{REFRAME_STEP1}

Generate 4 VARIANT PROMPTS using different strategies. Output them in this EXACT format:

===VARIANT 1: [strategy name]===
[prompt text]
===VARIANT 2: [strategy name]===
[prompt text]
===VARIANT 3: [strategy name]===
[prompt text]
===VARIANT 4: [strategy name]===
[prompt text]

VARIANT STRATEGIES (ranked by proven success — use the best ones first):

STRATEGY A — PHYSICAL POSITION (most reliable):
"Show me this scene from the view of camera standing [physical location in the scene]"
Example: "Show me this scene from the view of camera standing between the benches"
WHY IT WORKS: Describes WHERE the camera IS, not where it MOVED. Simple, concrete.

STRATEGY B — CHARACTER POV (very reliable):
"Show me this scene from the perspective of [specific person and their location]"
Example: "Show me this scene from the perspective of the man sitting on the right bench"
WHY IT WORKS: Model understands POV as a concept. Anchors to a visible person.

STRATEGY C — LANDMARK-TO-TARGET (reliable):
"Show me this scene from [landmark/object] looking toward [target]"
Example: "Show me this scene from doors in the middle of right wall — right across the court desk"
WHY IT WORKS: Two anchor points define a line of sight. Concrete, spatial.

STRATEGY D — SUBJECT REFRAME (moderate):
"Same [location], [shot type] of [subject] from [their side/direction]"
Example: "Same courtroom, close-up profile shot of the man in grey from his left side"
WHY IT WORKS: Standard cinematic language. Works for closer shots and profiles.

STRATEGY E — MULTI-REFERENCE (when 2 refs available):
"Show me the scene from image 1 in the view and camera angle of image 2"
Only use when 2 reference images are loaded. Very effective — one of the best strategies.

STRATEGY F — TEMPORAL ORBIT (creative fallback):
"camera is orbiting around the room. Show me this scene [X] seconds later"
WHY IT WORKS: Implies continuous camera motion. Model fills in a plausible new angle.

RULES FOR ALL VARIANTS:
- Each variant MUST use a DIFFERENT strategy from the list above
- Keep each variant prompt under 40 words — shorter = better for reframe
- Start with "Show me" or "Same scene" — proven openers
- NEVER use numeric angles, compass directions, or technical camera jargon
- NEVER explain what the model should do — just describe what you want to SEE
- The reference image prefix [Reference images: ...] will be added automatically — do NOT include it
- For Flux/Seedream: add "Negative prompt: different room, CGI, cartoon, blurry" to each variant
- CRITICAL — at the very end of each variant, on a new line, add a refs tag:
  [REFS:1] if the prompt only needs the main scene image (most variants)
  [REFS:1,2] if the prompt explicitly references image 2 (only STRATEGY E)
  This tells the system which reference images to send to the generative model.`;

// No per-model reframe structures needed — variants are universal
// Element edit structures remain model-specific

function _etmGetSystemPrompt() {
  const type = _etmModelType(_etmCurrentModel);
  const refCount = (typeof refs !== 'undefined') ? refs.length : 0;
  const hasMultiRef = refCount >= 2;

  let elementRules;
  if (type === 'flux')         elementRules = ETM_ELEMENT_FLUX;
  else if (type === 'seedream') elementRules = ETM_ELEMENT_SEEDREAM;
  else                          elementRules = ETM_ELEMENT_GEMINI;

  const negPromptNote = (type === 'flux' || type === 'seedream')
    ? '- For this model: always include a Negative prompt line at the end of each variant.'
    : '- For this model: do NOT include a Negative prompt line.';

  // Build analysis section from array
  let analysisSection = 'REFERENCE IMAGE ANALYSES (your internal context — never show to user):';
  for (let i = 0; i < Math.min(refCount, _etmRefAnalyses.length); i++) {
    const refName = refs[i]?.userLabel || refs[i]?.autoName || `Ref ${i + 1}`;
    analysisSection += `\n\nImage ${i + 1} ("${refName}"):
${_etmRefAnalyses[i] || '(analyzing...)'}`;
  }
  if (refCount === 0) analysisSection += '\n(No references loaded)';

  // Dynamic reframe step 1 based on ref count
  let reframeStep1;
  if (hasMultiRef) {
    reframeStep1 = `${refCount} reference images are loaded.
Use the analyses above to understand spatial relationships between different angles.
IMPORTANT: Include STRATEGY E (multi-reference) as one of your 4 variants.
Generate the 4 variant prompts IMMEDIATELY — do not ask any questions.`;
  } else {
    reframeStep1 = `Only 1 reference image is loaded. Ask the user ONE short question:
"🎬 Camera reframe — do you have a second reference showing this scene from a different angle? If yes, add it as reference 2 and say 'ready'. If not, just say 'go'."
After user responds — generate the 4 variant prompts.`;
  }

  const reframeKnowledge = ETM_REFRAME_KNOWLEDGE.replace('{REFRAME_STEP1}', reframeStep1);

  // Multi-ref awareness for element edits
  const multiRefNote = hasMultiRef ? `
MULTI-REFERENCE AWARENESS:
${refCount} reference images are loaded. The user may refer to any of them:
- "use the color from image 2" → reference image 2 in your prompt
- "apply the mask from image 3" → reference image 3 marks the edit area
- Use "image N" notation to reference specific images in the generated prompt.
The [Reference images: ...] prefix is added automatically — just use "image 1", "image 2" etc. in the prompt body.` : '';

  return `You are an intelligent image edit prompt engineer. You analyze what the user wants and choose the correct editing strategy.

${analysisSection}

TOTAL REFERENCES LOADED: ${refCount}

=== STEP 1: CLASSIFY THE REQUEST ===

Read the user's message and decide which type of edit they want:

TYPE A — ELEMENT EDIT: Adding, removing, replacing, or modifying an object, person, color, lighting, style, or any visual element.

TYPE B — CAMERA REFRAME: Changing the camera angle, position, distance, perspective, framing, or shot size.

If the request is ambiguous, ask: "Are you changing what's in the scene (edit), or changing where the camera is (reframe)?"

=== TYPE A RULES ===

ABSOLUTE RULES FOR ELEMENT EDITS:
1. ONLY change what the user explicitly asked for. Do NOT invent details.
2. If the user didn't specify a detail, do NOT add it.
3. "change X to Y" → prompt says "Change X to Y." Period.
4. When the user references a specific image ("use color from image 2", "area marked in image 3"), include that reference in the prompt using "image N (RefName)" notation.
${ETM_KEEP_RULES}
${elementRules}
${multiRefNote}

=== TYPE B RULES ===
${reframeKnowledge}
${negPromptNote}

=== GENERAL RULES (both types) ===
- For TYPE A: respond with ONE prompt only.
- For TYPE B: follow the step 1 logic above, then generate 4 VARIANT prompts in ===VARIANT N=== format.
- No explanations, no markdown formatting.
- When generating a prompt, output ONLY the prompt text ready to paste.`;
}


// ── Open / Close ───────────────────────────────────────
function openEditTool() {
  const modal = document.getElementById('editToolModal');
  if (!modal) return;

  // If session exists, just reopen (user may have left to add refs)
  const hasExistingSession = _etmChatHistory.length > 0;

  if (!hasExistingSession) {
    // Fresh session — reset state
    _etmChatHistory = [];
    _etmLastPrompt = '';
    _etmRefAnalyses = [];
    _etmAnalyzing = false;
    _etmLastRefCount = 0;
    document.getElementById('etmChatHistory').innerHTML = '';
    document.getElementById('etmChatInput').value = '';
    document.getElementById('etmUseBtn').disabled = true;
    document.getElementById('etmFooterStatus').textContent = '';
    _etmSetStatus('hidden');

    // Detect current model
    _etmCurrentModel = currentModel || 'nb2';
    _etmPreselectModel(_etmCurrentModel);
  }

  // Check for reference image (always refresh — user may have added refs)
  const hasRef = refs && refs.length > 0;
  document.getElementById('etmNoRef').style.display = hasRef ? 'none' : 'flex';
  document.getElementById('etmChatCol').style.display = hasRef ? 'flex' : 'none';
  document.getElementById('etmRefCol').style.display = hasRef ? 'flex' : 'none';
  document.getElementById('etmInputRow').classList.toggle('etm-disabled', !hasRef);

  modal.classList.add('show');

  if (hasRef) {
    _etmRefreshRefPreviews();
    if (!hasExistingSession) {
      _etmAppendMsg('system', 'What do you want to change? I can edit elements (replace, add, remove) or reframe the camera angle.');
    }
  }
}

function resetEditTool() {
  _etmChatHistory = [];
  _etmLastPrompt = '';
  _etmRefAnalyses = [];
  _etmLastRefCount = 0;
  _etmAnalyzing = false;
  document.getElementById('etmChatHistory').innerHTML = '';
  document.getElementById('etmChatInput').value = '';
  document.getElementById('etmUseBtn').disabled = true;
  document.getElementById('etmFooterStatus').textContent = '';

  // Re-check refs and re-analyze
  const hasRef = refs && refs.length > 0;
  document.getElementById('etmNoRef').style.display = hasRef ? 'none' : 'flex';
  document.getElementById('etmChatCol').style.display = hasRef ? 'flex' : 'none';
  document.getElementById('etmRefCol').style.display = hasRef ? 'flex' : 'none';
  document.getElementById('etmInputRow').classList.toggle('etm-disabled', !hasRef);

  if (hasRef) {
    _etmRefreshRefPreviews();
    _etmAppendMsg('system', 'What do you want to change? I can edit elements (replace, add, remove) or reframe the camera angle.');
  } else {
    _etmSetStatus('hidden');
  }
}

function closeEditTool() {
  document.getElementById('editToolModal')?.classList.remove('show');
}

function editToolBgClick(e) {
  if (e.target.id === 'editToolModal') closeEditTool();
}

// ── Model preselect ────────────────────────────────────
function _etmPreselectModel(key) {
  const sel = document.getElementById('etmModelSelect');
  if (!sel) return;
  // Map current model to closest Edit Tool model
  const m = MODELS[key];
  let etmKey = 'nb2';
  if (m) {
    if (m.type === 'gemini') {
      etmKey = (key === 'nbpro') ? 'nbpro' : 'nb2';
    } else if (m.type === 'flux') {
      etmKey = (key === 'flux2_dev') ? 'flux2_dev' : 'flux2_pro';
    } else if (m.type === 'seedream') {
      etmKey = (key === 'seedream45') ? 'seedream45' : 'seedream5lite';
    } else {
      etmKey = 'nb2'; // fallback for non-edit models
    }
  }
  sel.value = etmKey;
  _etmCurrentModel = etmKey;
  _etmUpdateBadge();
}

function _etmUpdateBadge() {
  const badge = document.getElementById('etmModelBadge');
  if (!badge) return;
  const type = _etmModelType(_etmCurrentModel);
  const names = { nb2:'NB2', nbpro:'NB Pro', flux2_pro:'Flux 2 Pro', flux2_dev:'Flux 2 Dev',
                  seedream5lite:'Seedream 5', seedream45:'Seedream 4.5' };
  badge.textContent = names[_etmCurrentModel] || _etmCurrentModel;
  if (type === 'gemini') {
    badge.style.borderColor = 'rgba(212,160,23,.4)'; badge.style.color = 'var(--accent)'; badge.style.background = 'rgba(212,160,23,.06)';
  } else if (type === 'flux') {
    badge.style.borderColor = 'rgba(74,144,217,.4)'; badge.style.color = '#4a90d9'; badge.style.background = 'rgba(74,144,217,.06)';
  } else {
    badge.style.borderColor = 'rgba(60,190,100,.4)'; badge.style.color = '#3cbe64'; badge.style.background = 'rgba(60,190,100,.06)';
  }
}

function etmSwitchModel(key) {
  const prevType = _etmModelType(_etmCurrentModel);
  _etmCurrentModel = key;
  _etmUpdateBadge();

  const newType = _etmModelType(key);
  // If we have a prompt and model type changed, re-adapt it
  if (_etmLastPrompt && prevType !== newType) {
    _etmReadaptPrompt(prevType, newType);
  }
}

async function _etmReadaptPrompt(fromType, toType) {
  const apiKey = document.getElementById('apiKey')?.value?.trim();
  if (!apiKey || !_etmLastPrompt) return;

  const sendBtn = document.getElementById('etmChatSendBtn');
  sendBtn.disabled = true;
  _etmSetStatus('thinking');
  const typeNames = { gemini: 'Gemini NB2/NB Pro', flux: 'Flux 2', seedream: 'Seedream' };
  document.getElementById('etmFooterStatus').textContent = 'Adapting prompt for ' + (typeNames[toType] || toType) + '…';

  const adaptSystem = `You are a prompt format adapter. Convert this image edit prompt from ${typeNames[fromType] || fromType} format to ${typeNames[toType] || toType} format.

RULES:
- Keep the SAME edit intent — do not change what is being edited or reframed.
- Use simple neutral element names in Keep sections.
- Do NOT add or invent any details not in the original prompt.
${toType === 'gemini' ? '- SHORT prompt, under 60 words. No negative prompt. End with: Photorealistic, cinematic, 35mm, film grain.' : ''}${toType === 'flux' ? '- Use Original scene / Preserve exactly / Change structure. Include Negative prompt line.' : ''}${toType === 'seedream' ? '- Concise: Keep [...] unchanged. Change: [...]. Include Negative prompt line.' : ''}

Respond ONLY with the adapted prompt. No explanations.`;

  try {
    const adapted = await callGeminiText(apiKey, adaptSystem, _etmLastPrompt);
    const text = adapted.trim();
    _etmLastPrompt = text;
    _etmAppendMsg('model', text);
    _etmChatHistory.push({ role: 'model', parts: [{ text }] });
    document.getElementById('etmUseBtn').disabled = false;
    document.getElementById('etmFooterStatus').textContent = 'Prompt adapted for ' + (typeNames[toType] || toType);
  } catch(e) {
    _etmAppendMsg('system', '⚠ Adaptation error: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    _etmSetStatus('ready');
  }
}

// ── Reference preview ──────────────────────────────────
function _etmRefreshRefPreviews() {
  const count = (typeof refs !== 'undefined') ? refs.length : 0;
  const label = document.getElementById('etmRefLabel');
  if (label) label.textContent = count > 1 ? `References (${count})` : 'Reference';

  // Show first ref
  if (count >= 1) _etmShowRefImg('etmRefPreview', refs[0]);
  else { const img = document.getElementById('etmRefPreview'); if (img) img.style.display = 'none'; }

  // Show second ref preview (if exists)
  const wrap2 = document.getElementById('etmRef2Wrap');
  if (count >= 2) {
    if (wrap2) wrap2.style.display = 'block';
    _etmShowRefImg('etmRefPreview2', refs[1]);
  } else {
    if (wrap2) wrap2.style.display = 'none';
  }

  // Analyze any new refs that don't have analysis yet
  for (let i = _etmRefAnalyses.length; i < count; i++) {
    _etmAnalyzeRefAt(i);
  }

  // Detect ref count change mid-conversation — inject system note
  if (count > _etmLastRefCount && _etmLastRefCount > 0 && _etmChatHistory.length > 0) {
    const note = `[System: Reference image ${count} was added. ${count} references now loaded.]`;
    _etmChatHistory.push({ role: 'user', parts: [{ text: note }] });
    _etmAppendMsg('system', `Reference ${count} added ✓`);
  }
  _etmLastRefCount = count;
}

async function _etmShowRefImg(imgId, ref) {
  const img = document.getElementById(imgId);
  if (!img || !ref) return;
  img.style.display = 'none';
  let src = '';
  if (ref.thumb) src = `data:${ref.mimeType || 'image/jpeg'};base64,${ref.thumb}`;
  if (!src && ref.assetId) {
    try { const meta = await dbGet('assets_meta', ref.assetId); if (meta?.thumb) src = `data:${meta.mimeType || 'image/jpeg'};base64,${meta.thumb}`; } catch(_) {}
  }
  if (!src && ref.assetId) {
    try { const asset = await dbGet('assets', ref.assetId); if (asset?.imageData) src = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.imageData}`; } catch(_) {}
  }
  if (src) { img.onload = () => { img.style.display = 'block'; }; img.src = src; }
}

// ── Reference analysis (per-ref, stored in array) ──────
async function _etmAnalyzeRefAt(idx) {
  const ref = refs[idx];
  if (!ref) return;
  const apiKey = document.getElementById('apiKey')?.value?.trim();
  if (!apiKey) { _etmRefAnalyses[idx] = '(No API key)'; return; }

  // Mark as analyzing
  _etmRefAnalyses[idx] = '(analyzing...)';
  if (idx === 0) { _etmAnalyzing = true; _etmSetStatus('analyzing'); }

  let imageData = null, mimeType = 'image/jpeg';
  if (ref.assetId) {
    const asset = await dbGet('assets', ref.assetId);
    if (asset?.imageData) { imageData = asset.imageData; mimeType = asset.mimeType || 'image/jpeg'; }
  }
  if (!imageData && ref.data) { imageData = ref.data; mimeType = ref.mimeType || 'image/jpeg'; }
  if (!imageData) { _etmRefAnalyses[idx] = '(Could not load image data)'; if (idx === 0) { _etmAnalyzing = false; _etmSetStatus('ready'); } return; }

  try {
    const resized = await resizeImageToCanvas(`data:${mimeType};base64,${imageData}`, 1024);
    const comma = resized.indexOf(',');
    if (comma !== -1) { mimeType = resized.slice(5, resized.indexOf(';')); imageData = resized.slice(comma + 1); }
  } catch (_) {}

  // Different instruction for first ref vs additional refs
  const instruction = idx === 0
    ? `Describe this image in detail for use as context in an edit prompt generator.
Describe: 1) Scene type (interior/exterior, style, mood) 2) ALL visible objects and positions (left/right/center/foreground/background) 3) People (appearance, clothing, position, facing) 4) Lighting (direction, quality, shadows) 5) Camera angle and framing. Be precise and factual. 150-250 words.`
    : `This is reference image ${idx + 1} in an image editing workflow. Describe what this image contains and what role it likely plays as a reference:
- Is it a photo of the same scene from a different angle? If so, describe the camera position.
- Is it a color palette, texture, or style reference? Describe the colors/style.
- Is it a sketch, drawing, or mask? Describe what it outlines or marks.
- Is it a close-up detail? Describe what it shows.
Be concise — under 80 words. Focus on what makes this useful as a reference for editing image 1.`;

  try {
    const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
    if (orKey) {
      _etmRefAnalyses[idx] = await _callOpenRouterVision(orKey, imageData, mimeType, instruction);
      trackSpend('openrouter', '_or_describe', 1);
    } else {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DESCRIBE_MODEL}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType, data: imageData } },
            { text: instruction }
          ]}],
          generationConfig: { temperature: 0.3, maxOutputTokens: idx === 0 ? 1024 : 512 },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(`API ${resp.status}: ${data.error?.message || JSON.stringify(data.error)}`);
      _etmRefAnalyses[idx] = data.candidates?.[0]?.content?.parts?.[0]?.text || '(Analysis failed)';
    }
  } catch(e) {
    _etmRefAnalyses[idx] = '(Analysis error: ' + e.message + ')';
  } finally {
    if (idx === 0) { _etmAnalyzing = false; _etmSetStatus('ready'); }
  }
}

// ── Chat ───────────────────────────────────────────────
async function sendEditChat() {
  const apiKey = document.getElementById('apiKey')?.value?.trim();
  if (!apiKey) { toast('Enter API key (Gemini) in Setup', 'err'); return; }

  // Refresh refs state (user may have added second ref)
  _etmRefreshRefPreviews();

  const inputEl = document.getElementById('etmChatInput');
  const input = inputEl.value.trim();
  if (!input) return;
  if (_etmAnalyzing) { toast('Wait for reference analysis to complete…', 'warn'); return; }

  const sendBtn = document.getElementById('etmChatSendBtn');
  sendBtn.disabled = true;

  _etmAppendMsg('user', input);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  _etmChatHistory.push({ role: 'user', parts: [{ text: input }] });
  const typingEl = _etmAppendTyping();
  _etmSetStatus('thinking');

  try {
    const systemPrompt = _etmGetSystemPrompt();

    // Build context for first turn
    let fullSystem = systemPrompt;
    if (_etmChatHistory.length === 1 && _etmLastPrompt) {
      fullSystem += `\n\nPREVIOUS EDIT PROMPT (modify this based on user request):\n${_etmLastPrompt}`;
    }

    const response = await callGeminiTextMultiTurn(apiKey, fullSystem, _etmChatHistory);
    _etmChatHistory.push({ role: 'model', parts: [{ text: response }] });
    typingEl.remove();
    const text = response.trim();

    // Check if response contains variants (===VARIANT N===)
    const variants = _etmParseVariants(text);
    const refCount = (typeof refs !== 'undefined') ? refs.length : 0;
    if (variants.length > 1) {
      _etmAppendVariants(variants);
      _etmLastPrompt = variants[0].prompt; // Default to first variant
      // Footer tip set by variant click handler
      const v0 = variants[0];
      let tip = 'Variant 1 selected';
      if (v0.refsNeeded.length === 1 && refCount > 1) {
        tip += ' · ⚠ Remove extra references before generating — only ref 1 is used.';
      }
      document.getElementById('etmFooterStatus').textContent = tip;
    } else {
      _etmAppendMsg('model', text);
      _etmLastPrompt = text;
      // Check which refs the prompt references
      const usesMultiRef = /image\s*2|image\s*3|ref\s*2|ref\s*3/i.test(text);
      let tip = 'Prompt ready — click "Use as Prompt" to apply';
      if (!usesMultiRef && refCount > 1) {
        tip += ' · ⚠ This prompt uses only ref 1. Remove extra references before generating.';
      }
      document.getElementById('etmFooterStatus').textContent = tip;
    }
    document.getElementById('etmUseBtn').disabled = false;
  } catch(e) {
    typingEl.remove();
    _etmAppendMsg('system', '⚠ Error: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    _etmSetStatus('ready');
    inputEl.focus();
  }
}

function _etmAppendMsg(role, text) {
  const history = document.getElementById('etmChatHistory');
  if (!history) return;
  const div = document.createElement('div');
  div.className = 'etm-msg etm-msg-' + role;
  div.textContent = text;
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
  return div;
}

function _etmAppendTyping() {
  const history = document.getElementById('etmChatHistory');
  const div = document.createElement('div');
  div.className = 'etm-msg etm-msg-model etm-msg-typing';
  div.textContent = '…';
  history.appendChild(div);
  history.scrollTop = history.scrollHeight;
  return div;
}

// ── Variant parsing and display ────────────────────────
function _etmParseVariants(text) {
  const variants = [];
  const regex = /===\s*VARIANT\s*(\d+)\s*:\s*(.+?)\s*===\s*\n([\s\S]*?)(?=\n===\s*VARIANT|\s*$)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    let prompt = match[3].trim();
    // Extract [REFS:1] or [REFS:1,2] tag
    let refsNeeded = [1]; // default: only ref 1
    const refsMatch = prompt.match(/\[REFS:\s*([\d,\s]+)\]\s*$/i);
    if (refsMatch) {
      refsNeeded = refsMatch[1].split(',').map(n => parseInt(n.trim())).filter(n => n > 0);
      prompt = prompt.replace(/\[REFS:[^\]]*\]\s*$/i, '').trim();
    }
    variants.push({
      num: parseInt(match[1]),
      strategy: match[2].trim(),
      prompt,
      refsNeeded,
    });
  }
  return variants;
}

function _etmAppendVariants(variants) {
  const history = document.getElementById('etmChatHistory');
  if (!history) return;
  const refCount = (typeof refs !== 'undefined') ? refs.length : 0;

  const wrap = document.createElement('div');
  wrap.className = 'etm-variants-wrap';

  const label = document.createElement('div');
  label.className = 'etm-variants-label';
  label.textContent = '🎬 ' + variants.length + ' prompt variants — click to select:';
  wrap.appendChild(label);

  variants.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'etm-variant-card' + (i === 0 ? ' etm-variant-selected' : '');
    const refsLabel = v.refsNeeded.length > 1 ? `refs ${v.refsNeeded.join('+')}` : 'ref 1 only';
    const refsClass = v.refsNeeded.length > 1 ? 'etm-refs-multi' : 'etm-refs-single';
    card.innerHTML = `<div class="etm-variant-hdr"><span class="etm-variant-num">${v.num}</span> <span class="etm-variant-strategy">${v.strategy}</span><span class="etm-variant-refs ${refsClass}">${refsLabel}</span></div><div class="etm-variant-prompt">${v.prompt.replace(/</g,'&lt;')}</div>`;
    card.onclick = () => {
      wrap.querySelectorAll('.etm-variant-card').forEach(c => c.classList.remove('etm-variant-selected'));
      card.classList.add('etm-variant-selected');
      _etmLastPrompt = v.prompt;
      // Show ref tip if variant uses fewer refs than loaded
      let tip = 'Variant ' + v.num + ' selected';
      if (v.refsNeeded.length === 1 && refCount > 1) {
        tip += ' · ⚠ Remove extra references before generating — only ref 1 is used. Extra refs confuse the model.';
      }
      document.getElementById('etmFooterStatus').textContent = tip;
    };
    wrap.appendChild(card);
  });

  history.appendChild(wrap);
  history.scrollTop = history.scrollHeight;
}

// ── Use as Prompt ──────────────────────────────────────
function useEditPrompt() {
  if (!_etmLastPrompt) return;
  const isVideo = window.aiPromptContext === 'video';
  const ta = document.getElementById(isVideo ? 'videoPrompt' : 'prompt');
  if (ta) {
    ta.value = _etmLastPrompt;
    ta.dispatchEvent(new Event('input'));
  }
  closeEditTool();
}

// ═══════════════════════════════════════════════════════
// SPECIAL TOOL (placeholder)
// ═══════════════════════════════════════════════════════

function openSpecialTool() {
  document.getElementById('specialToolModal')?.classList.add('show');
}

function closeSpecialTool() {
  document.getElementById('specialToolModal')?.classList.remove('show');
}

function specialToolBgClick(e) {
  if (e.target.id === 'specialToolModal') closeSpecialTool();
}

// ── Init chips ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#aiRandomChips .aipm-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });
});
