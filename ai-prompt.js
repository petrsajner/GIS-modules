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

// OpenRouter multi-turn call — sends full conversation history
// history: [{ role: 'user'|'model', parts: [{text: '...'}] }] (Gemini format)
async function _callOpenRouterMultiTurn(systemPrompt, history, temperature, maxTokens) {
  const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
  if (!orKey) return null;
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  // Convert Gemini-format history to OpenAI-format messages
  for (const turn of history) {
    const role = turn.role === 'model' ? 'assistant' : 'user';
    const content = (turn.parts || []).map(p => p.text || '').join('\n').trim();
    if (content) messages.push({ role, content });
  }
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
    const result = await _callOpenRouterMultiTurn(systemPrompt, history, 0.85, 2048);
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
  if (m.type === 'gemini')     return 'gemini';
  if (m.type === 'flux')       return 'flux';
  if (m.type === 'seedream')   return 'seedream';
  if (m.type === 'kling')      return 'kling';
  if (m.type === 'qwen2')      return 'qwen2';
  if (m.type === 'proxy_xai')  return 'grok';
  if (m.type === 'wan27r')     return 'wan';
  return 'gemini';
}

// ── Comprehensive system prompts per model type ────────
// Shared rules for Keep section — identical across all models
const ETM_KEEP_RULES = `
KEEP SECTION RULES (critical — same for ALL models):
- List elements by SIMPLE NEUTRAL NAMES: "lighting", "sky", "snow", "mountains", "building".
- NEVER characterize or interpret elements: NOT "golden hour lighting", NOT "dramatic sky", NOT "fresh powder snow".
- The model sees the reference image — it knows what the lighting looks like. You just name the element.
- Use the same neutral language regardless of which model the prompt is for.
- ALWAYS include "camera angle, framing, shot size" in the Keep section — unless the user explicitly asks to change the camera.`;

// Model-specific element edit rules
const ETM_ELEMENT_GEMINI = `
=== ELEMENT EDIT MODE (Gemini NB2 / NB Pro) ===
- The reference image does the heavy lifting. The model SEES it. Less text = less deviation.
- Keep the prompt SHORT — under 60 words. Every extra word risks unwanted changes.
- NEVER use compass directions or numeric angles.
- Position elements using visible objects: "between the desk and the window".

PROMPT STRUCTURE:
Keep [simple neutral element names], camera angle, framing identical.
Change only this: [minimal description of ONLY the requested change].
Photorealistic, cinematic, 35mm, film grain.`;

const ETM_ELEMENT_FLUX = `
=== ELEMENT EDIT MODE (Flux 2) ===
- Flux takes prompts literally. Describe the full scene factually but don't embellish.
- The "Preserve exactly" section must be comprehensive.
- The "Change" section must be MINIMAL — only the user's request.

PROMPT STRUCTURE:
Original scene: [factual description from analysis — simple names, no adjective embellishment].
Preserve exactly: [comprehensive list using simple neutral element names], camera angle, framing.
Change: [ONLY the user's requested change].
Photorealistic, cinematic, 35mm, film grain.

Negative prompt: CGI, 3D render, cartoon, illustration, anime, watermark, bad anatomy, extra limbs, blurry`;

const ETM_ELEMENT_SEEDREAM = `
=== ELEMENT EDIT MODE (Seedream) ===
- Concise and precise. Every word must earn its place.
- Do NOT invent details. Use the user's exact words for the change.

PROMPT STRUCTURE:
Keep [simple neutral element names], camera angle, framing unchanged.
Change: [ONLY user's requested change — their words].
Photorealistic, cinematic, 35mm, film grain.

Negative prompt: cartoon, CGI, 3D render, blurry, bad anatomy, watermark`;

const ETM_ELEMENT_KLING = `
=== ELEMENT EDIT MODE (Kling) ===
- Kling uses @Image1, @Image2 notation for reference images.
- Use explicit action verbs: "swap", "replace", "add", "remove", "restyle".
- Be specific about WHAT element changes and WHERE.
- Kling handles structured, direct instructions best.

PROMPT STRUCTURE:
Keep @Image1 scene, camera angle, framing, [element names] identical.
[Action verb] [target element]: [specific change description].
Photorealistic, cinematic, 35mm, film grain.

Negative prompt: CGI, cartoon, illustration, blurry, bad anatomy, watermark`;

const ETM_ELEMENT_QWEN = `
=== ELEMENT EDIT MODE (Qwen 2) ===
- Qwen 2 Edit supports up to 3 input images for compositing.
- Instructions-based: describe the edit as a clear instruction.
- Qwen follows literal instructions — be explicit about what to keep and what to change.
- Supports negative prompt for quality control.

PROMPT STRUCTURE:
Keep [element names], camera angle, framing from image 1 unchanged.
[Clear instruction: what to add/remove/change, referencing image numbers].
Photorealistic, cinematic, high detail.

Negative prompt: blurry, low quality, distorted, deformed, watermark, bad anatomy, extra fingers`;

const ETM_ELEMENT_GROK = `
=== ELEMENT EDIT MODE (Grok Imagine) ===
- Grok supports multi-image editing (up to 5 images for Standard, 1 for Pro).
- Natural language instructions — describe the desired result clearly.
- Reference images by number: "scene from image 1", "person from image 2".
- Grok is permissive and follows instructions closely. Keep prompts direct and action-oriented.
- Do NOT use negative prompts (not supported).

PROMPT STRUCTURE:
Keep [element names], camera angle, framing from image 1 identical.
[Direct description of the edit — what changes, what comes from which image].
Photorealistic, cinematic, 35mm, film grain.`;

const ETM_ELEMENT_WAN = `
=== ELEMENT EDIT MODE (WAN 2.7) ===
- WAN 2.7 Edit uses natural language instructions.
- SHORT prompts work best — under 40 words. Model is sensitive to over-description.
- Reference image is the base. Prompt describes ONLY the change.
- Supports negative prompt.

PROMPT STRUCTURE:
Keep [simple element names], camera, framing unchanged.
[Minimal edit instruction — user's words only].
Photorealistic, cinematic.

Negative prompt: blurry, low quality, distorted, deformed, ugly, watermark`;

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
  // Use the Edit Tool's target model maxRefs — may differ from main model
  const etmMax = MODELS[_etmCurrentModel]?.maxRefs ?? 14;
  const activeRefs = refs.slice(0, etmMax);
  const refCount = activeRefs.length;
  const hasMultiRef = refCount >= 2;

  let elementRules;
  if (type === 'flux')         elementRules = ETM_ELEMENT_FLUX;
  else if (type === 'seedream') elementRules = ETM_ELEMENT_SEEDREAM;
  else if (type === 'kling')    elementRules = ETM_ELEMENT_KLING;
  else if (type === 'qwen2')    elementRules = ETM_ELEMENT_QWEN;
  else if (type === 'grok')     elementRules = ETM_ELEMENT_GROK;
  else if (type === 'wan')      elementRules = ETM_ELEMENT_WAN;
  else                          elementRules = ETM_ELEMENT_GEMINI;

  const negPromptNote = (type === 'flux' || type === 'seedream' || type === 'kling' || type === 'qwen2' || type === 'wan')
    ? '- For this model: always include a Negative prompt line at the end of each variant.'
    : '- For this model: do NOT include a Negative prompt line.';

  // Build analysis section from array
  let analysisSection = 'REFERENCE IMAGE ANALYSES (your internal context — never show to user):';
  for (let i = 0; i < Math.min(refCount, _etmRefAnalyses.length); i++) {
    const refName = activeRefs[i]?.userLabel;
    const label = refName ? `Image ${i + 1} ("${refName}")` : `Image ${i + 1}`;
    analysisSection += `\n\n${label}:
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

  // Multi-ref awareness for element edits — ALL refs are content sources
  const multiRefNote = hasMultiRef ? `
MULTI-REFERENCE RULES FOR ELEMENT EDITS (TYPE A):
In TYPE A, ALL ${refCount} reference images are CONTENT SOURCES for the final image.
- Image 1 is typically the background/scene. Images 2–${refCount} contribute additional elements (people, objects, styles).
- Your prompt MUST explicitly state what comes from EACH image, by number:
  "Take the scene from image 1. Place the person from image 2 and the person from image 3 into the scene."
- EVERY image must be referenced by number. If you have 4 images, the prompt must mention image 1, image 2, image 3, AND image 4.
- NEVER say "add three people" without specifying "from image 2", "from image 3", "from image 4".
- Keep ALL properties of image 1 (lighting, mood, color, atmosphere) UNCHANGED unless user explicitly asks to change them.
- Do NOT transfer mood/style/grading from other images to image 1 unless the user asks for it.` : '';

  return `You are an intelligent image edit prompt engineer. You analyze what the user wants and choose the correct editing strategy.

${analysisSection}

TOTAL REFERENCES LOADED: ${refCount}

=== STEP 1: CLASSIFY THE REQUEST ===

Read the user's message and decide which type of edit they want:

TYPE A — ELEMENT EDIT (content change):
  Adding, removing, replacing, or modifying objects, people, colors, lighting, style, mood.
  Also includes: camera/framing adjustments COMBINED with content changes.
  Keywords: add, remove, replace, change color, make brighter, put X into scene, combine.
  CRITICAL: If the user asks to ADD PEOPLE or OBJECTS from reference images into a scene → this is ALWAYS TYPE A.
  CRITICAL: If the user changes content AND adjusts camera (e.g. "closer shot with new lighting") → this is TYPE A.
  In TYPE A, ALL loaded references are content sources for the final output.

TYPE B — CAMERA REFRAME (viewpoint change ONLY):
  ONLY changing camera angle, position, distance, perspective, framing, shot size — with NO content changes.
  The scene content stays identical. Only the viewpoint changes.
  Keywords: show from above, closer shot, wider angle, different perspective, behind, bird's eye.
  IMPORTANT: If the user ALSO changes any content (adds/removes/modifies anything) → it becomes TYPE A, not TYPE B.
  In TYPE B, image 1 is the target scene. Other images (if any) help understand spatial layout.

HOW TO DECIDE:
- "Add three people from references" → TYPE A (adding content)
- "Show this scene from a different angle" → TYPE B (ONLY viewpoint changes, no content change)
- "Make it warmer / change lighting" → TYPE A (modifying content)
- "Wide shot of this" → TYPE B (ONLY framing change)
- "Closer shot and add a dog" → TYPE A (camera + content = TYPE A)
- "Make it a close-up with warmer tones" → TYPE A (camera + content = TYPE A)
If the request is genuinely ambiguous, ask. But most requests clearly belong to one type.

=== TYPE A RULES ===

ABSOLUTE RULES FOR ELEMENT EDITS:
1. ONLY change what the user explicitly asked for. Do NOT invent details.
2. If the user didn't specify a detail, do NOT add it.
3. NEVER invent mood changes, color grading, lighting shifts, or atmospheric effects that the user didn't ask for. If user says "add people" → add people. Do NOT also change mood/lighting/grading.
4. "change X to Y" → prompt says "Change X to Y." Period.
5. When multiple images are loaded, the prompt MUST mention EVERY image BY NUMBER.
   BAD:  "Add three people standing around the women." (which images??)
   GOOD: "Take the scene from image 1. Place the person from image 2, the person from image 3, and the person from image 4 standing around the women."
6. Output ONE single prompt — no variants, no alternatives.
7. The Keep section preserves EVERYTHING from image 1 — lighting, mood, colors, atmosphere, EVERYTHING. Do not transfer mood/style from other images unless the user explicitly asks.
${ETM_KEEP_RULES}
${elementRules}
${multiRefNote}

=== TYPE B RULES ===
${reframeKnowledge}
${negPromptNote}

=== GENERAL RULES (both types) ===
- For TYPE A: respond with ONE prompt only. ALL loaded references must appear in the prompt.
- For TYPE B: follow the step 1 logic above, then generate 4 VARIANT prompts in ===VARIANT N=== format.
- No explanations, no markdown formatting.
- When generating a prompt, output ONLY the prompt text ready to paste.
- NEVER include classification lines like "This is TYPE A" or "Žádost je TYPE A" — those are internal thinking.
- NEVER echo or repeat the user's original request.
- Reference ALL loaded images correctly: you have ${refCount} image(s). Use "image 1" through "image ${refCount}" when referring to specific references.`;
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
    } else if (m.type === 'proxy_xai') {
      etmKey = (key === 'grok_imagine_pro') ? 'grok_imagine_pro' : 'grok_imagine';
    } else if (m.type === 'kling') {
      etmKey = (key === 'kling_o3') ? 'kling_o3' : 'kling_v3';
    } else if (m.type === 'wan27r') {
      etmKey = 'wan27_edit';
    } else if (m.type === 'qwen2') {
      etmKey = (key === 'qwen2_pro_edit') ? 'qwen2_pro_edit' : 'qwen2_edit';
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
                  seedream5lite:'Seedream 5', seedream45:'Seedream 4.5',
                  grok_imagine:'Grok', grok_imagine_pro:'Grok Pro',
                  wan27_edit:'WAN 2.7', qwen2_edit:'Qwen 2', qwen2_pro_edit:'Qwen 2 Pro',
                  kling_v3:'Kling V3', kling_o3:'Kling O3' };
  badge.textContent = names[_etmCurrentModel] || _etmCurrentModel;
  const colors = {
    gemini:  { border:'rgba(212,160,23,.4)',  text:'var(--accent)', bg:'rgba(212,160,23,.06)' },
    flux:    { border:'rgba(74,144,217,.4)',  text:'#4a90d9',       bg:'rgba(74,144,217,.06)' },
    seedream:{ border:'rgba(60,190,100,.4)',  text:'#3cbe64',       bg:'rgba(60,190,100,.06)' },
    kling:   { border:'rgba(160,100,220,.4)', text:'#a064dc',       bg:'rgba(160,100,220,.06)' },
    qwen2:   { border:'rgba(60,180,200,.4)',  text:'#3cb4c8',       bg:'rgba(60,180,200,.06)' },
    grok:    { border:'rgba(220,80,60,.4)',   text:'#dc5040',       bg:'rgba(220,80,60,.06)' },
    wan:     { border:'rgba(220,160,60,.4)',  text:'#dca040',       bg:'rgba(220,160,60,.06)' },
  };
  const c = colors[type] || colors.gemini;
  badge.style.borderColor = c.border; badge.style.color = c.text; badge.style.background = c.bg;
}

function etmSwitchModel(key) {
  const prevType = _etmModelType(_etmCurrentModel);
  const prevMax = MODELS[_etmCurrentModel]?.maxRefs ?? 14;
  _etmCurrentModel = key;
  _etmUpdateBadge();
  _etmRefreshRefPreviews();  // Update ref dimming for new model's maxRefs

  const newType = _etmModelType(key);
  const newMax = MODELS[key]?.maxRefs ?? 14;
  // If we have a prompt and model type changed, re-adapt it
  if (_etmLastPrompt && prevType !== newType) {
    _etmReadaptPrompt(prevType, newType, prevMax, newMax);
  }
}

async function _etmReadaptPrompt(fromType, toType, prevMax, newMax) {
  const apiKey = document.getElementById('apiKey')?.value?.trim();
  if (!apiKey || !_etmLastPrompt) return;

  const sendBtn = document.getElementById('etmChatSendBtn');
  sendBtn.disabled = true;
  _etmSetStatus('thinking');
  const typeNames = { gemini: 'Gemini NB2/NB Pro', flux: 'Flux 2', seedream: 'Seedream',
                      kling: 'Kling', qwen2: 'Qwen 2', grok: 'Grok Imagine', wan: 'WAN 2.7' };
  document.getElementById('etmFooterStatus').textContent = 'Adapting prompt for ' + (typeNames[toType] || toType) + '…';

  const formatHints = {
    gemini: 'SHORT prompt under 60 words. No negative prompt. "Keep [...] identical. Change: [...]." End: Photorealistic, cinematic, 35mm, film grain.',
    flux: '"Original scene / Preserve exactly / Change" structure. Include Negative prompt line.',
    seedream: '"Keep [...] unchanged. Change: [...]." Concise. Include Negative prompt line.',
    kling: 'Use @Image1, @Image2 for refs. Explicit action verbs. Include Negative prompt line.',
    qwen2: 'Instruction-based. Reference images by number. Include Negative prompt line.',
    grok: 'Natural language. Reference images by number (image 1, image 2). No negative prompt. Direct and action-oriented.',
    wan: 'Very SHORT, under 40 words. Minimal instruction. Include Negative prompt line.',
  };

  // Check if ref count decreased — need to trim references in prompt
  const totalRefs = (typeof refs !== 'undefined') ? refs.length : 0;
  const activeRefs = Math.min(totalRefs, newMax);
  const refTrimNote = (totalRefs > newMax)
    ? `\nCRITICAL: The target model only accepts ${newMax} reference images. The original prompt may reference up to ${totalRefs} images. You MUST remove ALL references to images beyond image ${newMax}. Redistribute or merge the content from dropped images into the remaining ${newMax} image references, or simply drop elements that came from excess images. Do NOT mention image ${newMax + 1} or higher.`
    : '';

  const adaptSystem = `You are a prompt format adapter. Convert this image edit prompt from ${typeNames[fromType] || fromType} format to ${typeNames[toType] || toType} format.

RULES:
- Keep the SAME edit intent — do not change what is being edited or reframed.
- Use simple neutral element names in Keep sections.
- Do NOT add or invent any details not in the original prompt.
- ${formatHints[toType] || formatHints.gemini}${refTrimNote}

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
  const totalCount = (typeof refs !== 'undefined') ? refs.length : 0;
  const etmMax = MODELS[_etmCurrentModel]?.maxRefs ?? 14;
  const activeCount = Math.min(totalCount, etmMax);
  const label = document.getElementById('etmRefLabel');
  if (label) {
    if (totalCount > activeCount) {
      label.textContent = `References (${activeCount} of ${totalCount} active)`;
    } else {
      label.textContent = totalCount > 1 ? `References (${totalCount})` : 'Reference';
    }
  }

  // Render all ref thumbnails dynamically — dim excess refs
  const container = document.getElementById('etmRefContainer');
  if (container) {
    container.innerHTML = '';
    for (let i = 0; i < totalCount; i++) {
      const refName = refs[i]?.userLabel || '';
      const dimmed = i >= etmMax;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-bottom:6px;' + (dimmed ? 'opacity:0.35;filter:grayscale(0.6);' : '');
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:9px;color:var(--dim2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.05em;';
      lbl.textContent = dimmed
        ? `Image ${i + 1}: ⊘ over limit${refName ? ' — ' + refName : ''}`
        : (refName ? `Image ${i + 1}: ${refName}` : `Image ${i + 1}`);
      wrap.appendChild(lbl);
      const img = document.createElement('img');
      img.style.cssText = 'display:none;width:100%;border-radius:4px;border:1px solid var(--border);';
      img.onerror = () => { img.style.display = 'none'; };
      wrap.appendChild(img);
      container.appendChild(wrap);
      _etmShowRefImgEl(img, refs[i]);
    }
  }

  // Analyze only active refs
  for (let i = _etmRefAnalyses.length; i < activeCount; i++) {
    _etmAnalyzeRefAt(i);
  }

  // Detect ref count change mid-conversation — inject system note
  if (activeCount > _etmLastRefCount && _etmLastRefCount > 0 && _etmChatHistory.length > 0) {
    const note = `[System: Reference image ${activeCount} was added. ${activeCount} references now loaded.]`;
    _etmChatHistory.push({ role: 'user', parts: [{ text: note }] });
    _etmAppendMsg('system', `Reference ${activeCount} added ✓`);
  }
  _etmLastRefCount = activeCount;
}

async function _etmShowRefImgEl(img, ref) {
  if (!img || !ref) return;
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

// ── Clean prompt — strip reasoning/classification from AI output ──
function _etmCleanPrompt(text) {
  if (!text) return text;
  const lines = text.split('\n');
  const cleaned = lines.filter(line => {
    const t = line.trim();
    // Strip TYPE classification lines (EN + CZ)
    if (/^(The |This |Žádost |Request )?(request |žádost )?(is |je )?TYPE\s+[AB]/i.test(t)) return false;
    // Strip lines that are pure reasoning markers
    if (/^(Here'?s? the|Tady je|Výsledný|Resulting|Generated) (edit )?(prompt|výstup)/i.test(t)) return false;
    // Strip "I'll" reasoning lines
    if (/^I('ll| will) (keep|add|change|remove|modify)/i.test(t)) return false;
    return true;
  });
  return cleaned.join('\n').trim();
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
    const etmMax = MODELS[_etmCurrentModel]?.maxRefs ?? 14;
    const refCount = Math.min((typeof refs !== 'undefined') ? refs.length : 0, etmMax);
    if (variants.length > 1) {
      _etmAppendVariants(variants);
      _etmLastPrompt = _etmCleanPrompt(variants[0].prompt); // Default to first variant
      // Footer tip set by variant click handler
      const v0 = variants[0];
      let tip = 'Variant 1 selected';
      if (v0.refsNeeded.length === 1 && refCount > 1) {
        tip += ' · ⚠ Remove extra references before generating — only ref 1 is used.';
      }
      document.getElementById('etmFooterStatus').textContent = tip;
    } else {
      _etmAppendMsg('model', text);
      _etmLastPrompt = _etmCleanPrompt(text);
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
  const etmMax = MODELS[_etmCurrentModel]?.maxRefs ?? 14;
  const refCount = Math.min((typeof refs !== 'undefined') ? refs.length : 0, etmMax);

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
      _etmLastPrompt = _etmCleanPrompt(v.prompt);
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
// SPECIAL TOOL — Character Sheet
// ═══════════════════════════════════════════════════════

let _csCharDesc = '';
let _csPromptA = '';
let _csPromptB = '';
let _csHasSession = false;

function openSpecialTool() {
  // Always show tool list first
  document.getElementById('spmToolList').style.display = '';
  document.getElementById('csView')?.classList.remove('show');
  document.getElementById('ccView')?.classList.remove('show');
  document.getElementById('ecView')?.classList.remove('show');
  document.getElementById('spmTitle').textContent = '◆ Special Tools';
  document.getElementById('spmTitle').style.fontSize = '18px';
  document.getElementById('csResetBtn').style.display = 'none';
  document.getElementById('specialToolModal')?.classList.add('show');
}

function closeSpecialTool() {
  document.getElementById('specialToolModal')?.classList.remove('show');
}

function specialToolBgClick(e) {
  if (e.target.id === 'specialToolModal') closeSpecialTool();
}

function resetActiveSpmTool() {
  if (_ccActiveTool === 'cc') resetCharacterCoverage();
  else if (_ccActiveTool === 'ec') resetEnvCoverage();
  else resetCharacterSheet();
}

async function openCharacterSheet() {
  // Switch to character sheet sub-view
  document.getElementById('spmToolList').style.display = 'none';
  document.getElementById('ccView')?.classList.remove('show');
  document.getElementById('ecView')?.classList.remove('show');
  document.getElementById('spmTitle').textContent = '◆ Character Sheet';
  document.getElementById('csResetBtn').style.display = '';
  _ccActiveTool = 'cs';
  const csView = document.getElementById('csView');
  csView.classList.add('show');

  // If session already exists, just show it (don't re-analyze)
  if (_csHasSession) return;

  await _csRunAnalysis();
}

async function resetCharacterSheet() {
  _csHasSession = false;
  _csCharDesc = '';
  _csPromptA = '';
  _csPromptB = '';
  document.getElementById('csPrompts').style.display = 'none';
  document.getElementById('csPromptA').textContent = '';
  document.getElementById('csPromptB').textContent = '';
  await _csRunAnalysis();
}

async function _csRunAnalysis() {
  // Reset state
  document.getElementById('csPrompts').style.display = 'none';

  // Check refs
  const hasRef = typeof refs !== 'undefined' && refs.length > 0;
  document.getElementById('csNoRef').style.display = hasRef ? 'none' : 'block';
  document.getElementById('csRefRow').style.display = hasRef ? 'flex' : 'none';
  if (!hasRef) return;

  _csHasSession = true;

  // Show ref thumbnail
  const ref = refs[0];
  const thumbEl = document.getElementById('csRefThumb');
  const statusEl = document.getElementById('csRefStatus');
  statusEl.className = 'cs-ref-status analyzing';
  statusEl.textContent = 'Analyzing character…';

  // Load thumbnail
  let thumbSrc = '';
  if (ref.thumb) thumbSrc = `data:${ref.mimeType || 'image/jpeg'};base64,${ref.thumb}`;
  if (!thumbSrc && ref.assetId) {
    try { const meta = await dbGet('assets_meta', ref.assetId); if (meta?.thumb) thumbSrc = `data:${meta.mimeType || 'image/jpeg'};base64,${meta.thumb}`; } catch(_) {}
  }
  if (thumbSrc) { thumbEl.src = thumbSrc; thumbEl.style.display = 'block'; }
  else thumbEl.style.display = 'none';

  // Load full image data for analysis
  let imageData = null, mimeType = 'image/jpeg';
  if (ref.assetId) {
    try { const asset = await dbGet('assets', ref.assetId); if (asset?.imageData) { imageData = asset.imageData; mimeType = asset.mimeType || 'image/jpeg'; } } catch(_) {}
  }
  if (!imageData) { statusEl.className = 'cs-ref-status'; statusEl.textContent = 'Could not load image data.'; return; }

  // Resize for analysis
  try {
    const resized = await resizeImageToCanvas(`data:${mimeType};base64,${imageData}`, 1024);
    const comma = resized.indexOf(',');
    if (comma !== -1) { mimeType = resized.slice(5, resized.indexOf(';')); imageData = resized.slice(comma + 1); }
  } catch (_) {}

  // Analyze character via OpenRouter (primary) or Gemini (fallback)
  const instruction = `Describe this person for use in an AI image generation character sheet prompt.
Focus ONLY on physical appearance:
1) Gender, approximate age, ethnicity
2) Face: shape, features, skin texture, any asymmetry or distinctive marks
3) Hair: color, length, style, texture
4) Build: height impression, body type
5) Clothing: what they're wearing in detail
6) Expression and posture

Be precise and factual. Use plain English. 100-150 words. Do NOT describe the background or scene.`;

  try {
    const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
    if (orKey) {
      _csCharDesc = await _callOpenRouterVision(orKey, imageData, mimeType, instruction);
      trackSpend('openrouter', '_or_describe', 1);
    } else {
      const apiKey = document.getElementById('apiKey')?.value?.trim();
      if (!apiKey) { statusEl.className = 'cs-ref-status'; statusEl.textContent = 'No OpenRouter or Google API key found.'; return; }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DESCRIBE_MODEL}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: imageData } }, { text: instruction }
        ]}], generationConfig: { temperature: 0.5, maxOutputTokens: 512 } }) });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || resp.status);
      _csCharDesc = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      trackSpend('google', '_gemini_describe', 1);
    }
  } catch (err) {
    statusEl.className = 'cs-ref-status';
    statusEl.textContent = 'Analysis failed: ' + (err.message || err);
    return;
  }

  if (!_csCharDesc) { statusEl.className = 'cs-ref-status'; statusEl.textContent = 'No description returned.'; return; }

  // Show description
  statusEl.className = 'cs-ref-status';
  statusEl.textContent = _csCharDesc;

  // Generate prompts
  _csGeneratePrompts(_csCharDesc);
}

function _csGeneratePrompts(charDesc) {
  const profileRule = `CRITICAL PROFILE RULE: In each row, portrait 2 and portrait 3 MUST face OPPOSITE directions — portrait 2 faces right, portrait 3 faces left. Never two profiles facing the same direction next to each other.`;

  const layoutBlock = `LAYOUT — two-column contact sheet:
LEFT COLUMN — one full-body photograph spanning the full height of the sheet:
  Subject standing, facing the camera, natural relaxed posture

RIGHT COLUMN — two rows of close-up portraits:
  Top row (3 portraits):
    1. Front face, looking directly at camera
    2. Right-facing profile (subject faces RIGHT)
    3. Left-facing profile (subject faces LEFT)
  Bottom row (3 portraits):
    1. Front face, looking directly at camera
    2. Right-facing profile (subject faces RIGHT)
    3. Left-facing profile (subject faces LEFT)

${profileRule}`;

  const technicals = `POSE — natural stance, relaxed posture, arms at sides, subtle weight distribution. Not a T-pose, not a rigid stance.

LIGHTING — soft neutral studio light, no dramatic cinematic grade, consistent across all panels.

BACKGROUND — clean neutral studio backdrop, no distracting elements.

FORMAT — single-image contact sheet, all panels in one frame, no borders between panels.
Photorealistic, studio photography, 35mm, no CGI, no illustration.`;

  // Method A — with reference
  _csPromptA = `Create a photorealistic photographic identity sheet based strictly on the uploaded reference image.

Match the exact appearance: facial structure, proportions, skin texture, age, asymmetry, and natural imperfections. Real photography of a real human — not CGI, not a digital character.

${layoutBlock}

${technicals}`;

  // Method B — description only, no reference
  _csPromptB = `Create a photorealistic photographic identity sheet of the following character:

${charDesc}

${layoutBlock}

${technicals}`;

  document.getElementById('csPromptA').textContent = _csPromptA;
  document.getElementById('csPromptB').textContent = _csPromptB;
  document.getElementById('csPrompts').style.display = 'flex';
}

function csUsePrompt(method) {
  const prompt = method === 'a' ? _csPromptA : _csPromptB;
  if (!prompt) return;
  const isVideo = window.aiPromptContext === 'video';
  const ta = document.getElementById(isVideo ? 'videoPrompt' : 'prompt');
  if (ta) { ta.value = prompt; ta.dispatchEvent(new Event('input')); }

  // Method B = remove refs (prompt is self-contained)
  if (method === 'b' && typeof refs !== 'undefined' && refs.length > 0) {
    toast('Method B — remove references before generating (description only, no ref needed)', 'info');
  }

  closeSpecialTool();
  if (!isVideo && typeof switchView === 'function') switchView('gen');
  toast('Character sheet prompt set', 'ok');
}

// ═══════════════════════════════════════════════════════
// SPECIAL TOOL — Character Coverage (10 shots)
// ═══════════════════════════════════════════════════════

let _ccCharDesc = '';
let _ccPrompts = [];
let _ccHasSession = false;
let _ccActiveTool = ''; // 'cs' or 'cc' — tracks which reset button targets

const CC_SHOTS = [
  { num: 1, size: 'Wide Shot',   label: 'Frontal — establish',
    tpl: `Wide shot, frontal view: the subject stands facing the camera, full body visible from head to feet, arms relaxed at sides. Camera at standing eye level, looking straight ahead. Clean neutral studio backdrop.` },
  { num: 2, size: 'Medium Shot', label: '3/4 front right',
    tpl: `Medium shot, three-quarter front view from the right: the subject is slightly turned, their right shoulder closer to camera, left side partially visible. Framed from head to mid-thigh. Camera at eye level. Clean neutral studio backdrop.` },
  { num: 3, size: 'Medium Shot', label: '3/4 front left',
    tpl: `Medium shot, three-quarter front view from the left: the subject is slightly turned, their left shoulder closer to camera, right side partially visible. Framed from head to mid-thigh. Camera at eye level. Clean neutral studio backdrop.` },
  { num: 4, size: 'MCU',         label: 'Right profile',
    tpl: `Medium close-up, clean right profile: the subject faces directly to the left of frame, showing only the right side of their face. Framed from chest up. Camera at eye level. Clean neutral studio backdrop.` },
  { num: 5, size: 'MCU',         label: 'Left profile',
    tpl: `Medium close-up, clean left profile: the subject faces directly to the right of frame, showing only the left side of their face. Framed from chest up. Camera at eye level. Clean neutral studio backdrop.` },
  { num: 6, size: 'Medium Shot', label: '3/4 back right',
    tpl: `Medium shot, three-quarter rear view from the right: the subject's back is mostly toward camera, head turned slightly so a sliver of cheek and jawline is visible on the right. Framed from head to mid-thigh. Camera at eye level. Clean neutral studio backdrop.` },
  { num: 7, size: 'Wide Shot',   label: 'Directly behind',
    tpl: `Wide shot, rear view: the subject faces directly away from camera, full body visible from head to feet, back of head and shoulders prominent. Camera at eye level. Clean neutral studio backdrop.` },
  { num: 8, size: 'Medium Shot', label: '3/4 front right — low angle',
    tpl: `Medium shot, three-quarter front from the right, low angle: camera positioned low near the ground, looking upward at the subject. The subject appears above center of frame, chin and jawline prominent. Framed from knees up. Clean neutral studio backdrop.` },
  { num: 9, size: 'Close-Up',    label: '3/4 front right — high angle',
    tpl: `Close-up, three-quarter front from the right, high angle: camera positioned above the subject, looking down. The face fills the frame, top of head and forehead prominent, eyes looking up toward camera. Framed from shoulders up. Clean neutral studio backdrop.` },
  { num: 10, size: 'Wide Shot',  label: 'Overhead — top down',
    tpl: `Wide shot, overhead view: camera positioned directly above, looking straight down at the subject. Full body visible from head to feet, foreshortened perspective. Arms slightly away from body for clear silhouette separation. Clean neutral studio backdrop visible around the figure.` },
];

async function openCharacterCoverage() {
  document.getElementById('spmToolList').style.display = 'none';
  document.getElementById('csView')?.classList.remove('show');
  document.getElementById('ecView')?.classList.remove('show');
  document.getElementById('spmTitle').textContent = '◆ Character Coverage';
  document.getElementById('csResetBtn').style.display = '';
  _ccActiveTool = 'cc';
  const ccView = document.getElementById('ccView');
  ccView.classList.add('show');

  if (_ccHasSession) {
    // Refresh prompts with current model mentions + batch info
    if (_ccCharDesc) ccRegeneratePrompts();
    return;
  }
  await _ccRunAnalysis();
}

async function resetCharacterCoverage() {
  _ccHasSession = false;
  _ccCharDesc = '';
  _ccPrompts = [];
  document.getElementById('ccPromptsWrap').innerHTML = '';
  document.getElementById('ccPromptsWrap').style.display = 'none';
  document.getElementById('ccBatchBar').style.display = 'none';
  await _ccRunAnalysis();
}

async function _ccRunAnalysis() {
  const hasRef = typeof refs !== 'undefined' && refs.length > 0;
  document.getElementById('ccNoRef').style.display = hasRef ? 'none' : 'block';
  document.getElementById('ccRefRow').style.display = hasRef ? 'flex' : 'none';
  document.getElementById('ccStatusRow').style.display = hasRef ? 'flex' : 'none';
  document.getElementById('ccToggleRow').style.display = 'none';
  document.getElementById('ccPromptsWrap').style.display = 'none';
  document.getElementById('ccBatchBar').style.display = 'none';
  if (!hasRef) return;

  _ccHasSession = true;

  // Show all ref thumbnails
  const thumbsWrap = document.getElementById('ccRefThumbs');
  thumbsWrap.innerHTML = '';
  for (let i = 0; i < refs.length; i++) {
    const img = document.createElement('img');
    img.className = 'cc-ref-thumb';
    let src = '';
    if (refs[i].thumb) src = `data:${refs[i].mimeType || 'image/jpeg'};base64,${refs[i].thumb}`;
    if (!src && refs[i].assetId) {
      try { const meta = await dbGet('assets_meta', refs[i].assetId); if (meta?.thumb) src = `data:${meta.mimeType || 'image/jpeg'};base64,${meta.thumb}`; } catch(_) {}
    }
    if (src) { img.src = src; thumbsWrap.appendChild(img); }
  }

  // Analyze first ref
  const statusEl = document.getElementById('ccStatusText');
  statusEl.className = 'cc-status-text analyzing';
  statusEl.textContent = 'Analyzing character…';

  const ref = refs[0];
  let imageData = null, mimeType = 'image/jpeg';
  if (ref.assetId) {
    try { const asset = await dbGet('assets', ref.assetId); if (asset?.imageData) { imageData = asset.imageData; mimeType = asset.mimeType || 'image/jpeg'; } } catch(_) {}
  }
  if (!imageData) { statusEl.className = 'cc-status-text'; statusEl.textContent = 'Could not load image data.'; return; }

  try {
    const resized = await resizeImageToCanvas(`data:${mimeType};base64,${imageData}`, 1024);
    const comma = resized.indexOf(',');
    if (comma !== -1) { mimeType = resized.slice(5, resized.indexOf(';')); imageData = resized.slice(comma + 1); }
  } catch (_) {}

  const instruction = `Describe this person for use in AI image generation prompts.
Focus ONLY on physical appearance:
1) Gender, approximate age, ethnicity
2) Face: shape, features, skin texture, distinctive marks
3) Hair: color, length, style
4) Build: body type, height impression
5) Clothing: what they're wearing
Be precise and factual. Plain English. 80-120 words. Do NOT describe the background.`;

  try {
    const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
    if (orKey) {
      _ccCharDesc = await _callOpenRouterVision(orKey, imageData, mimeType, instruction);
      trackSpend('openrouter', '_or_describe', 1);
    } else {
      const apiKey = document.getElementById('apiKey')?.value?.trim();
      if (!apiKey) { statusEl.className = 'cc-status-text'; statusEl.textContent = 'No OpenRouter or Google API key found.'; return; }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DESCRIBE_MODEL}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: imageData } }, { text: instruction }
        ]}], generationConfig: { temperature: 0.5, maxOutputTokens: 512 } }) });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || resp.status);
      _ccCharDesc = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      trackSpend('google', '_gemini_describe', 1);
    }
  } catch (err) {
    statusEl.className = 'cc-status-text';
    statusEl.textContent = 'Analysis failed: ' + (err.message || err);
    return;
  }

  if (!_ccCharDesc) { statusEl.className = 'cc-status-text'; statusEl.textContent = 'No description returned.'; return; }

  statusEl.className = 'cc-status-text';
  statusEl.textContent = _ccCharDesc;

  document.getElementById('ccToggleRow').style.display = 'flex';
  ccRegeneratePrompts();
}

function _ccRefLabel(idx) {
  // Return the ref mention format for the current image model
  const m = typeof MODELS !== 'undefined' && typeof currentModel !== 'undefined' ? MODELS[currentModel] : null;
  const t = m?.type || '';
  if (t === 'seedream') return `Figure ${idx + 1}`;
  if (t === 'gemini') return `image ${idx + 1}`;
  return `@Image${idx + 1}`; // flux, kling, zimage, proxy_xai, proxy_luma, etc.
}

function ccRegeneratePrompts() {
  const useDesc = document.getElementById('ccUseDesc')?.checked;
  const refCount = getActiveRefs().length;
  const hasSheet = refCount >= 2;

  const ref1 = _ccRefLabel(0);
  const ref2 = hasSheet ? _ccRefLabel(1) : null;

  _ccPrompts = CC_SHOTS.map(shot => {
    let lines = [];
    if (useDesc && _ccCharDesc) {
      lines.push(`The reference ${ref1} shows: ${_ccCharDesc}`);
    } else {
      lines.push(`The reference ${ref1} shows the character.`);
    }
    if (ref2) lines.push(`Reference ${ref2} is a character sheet — use it for identity consistency.`);
    lines.push('Keep the character\'s appearance, clothing, and proportions identical to the reference.');
    lines.push('');
    lines.push(shot.tpl);
    lines.push('Photorealistic, cinematic, 35mm, film grain.');
    return { ...shot, prompt: lines.join('\n') };
  });

  // Render prompt cards
  const wrap = document.getElementById('ccPromptsWrap');
  wrap.innerHTML = '';
  _ccPrompts.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'cc-shot-card';
    card.innerHTML = `<div class="cc-shot-hdr"><span class="cc-shot-num">#${s.num}</span><span class="cc-shot-label">${s.size} — ${s.label}</span><button class="cc-shot-btn" onclick="ccUsePrompt(${i})">↗ Use</button></div><div class="cc-shot-prompt">${s.prompt.replace(/</g,'&lt;')}</div>`;
    wrap.appendChild(card);
  });
  wrap.style.display = 'flex';

  // Update batch bar
  _ccUpdateBatchInfo();
  document.getElementById('ccBatchBar').style.display = 'flex';
}

function _ccUpdateBatchInfo() {
  const m = typeof MODELS !== 'undefined' && typeof currentModel !== 'undefined' ? MODELS[currentModel] : null;
  const ar = document.getElementById('aspectRatio')?.value || '—';
  const info = document.getElementById('ccBatchInfo');
  if (!info) return;
  const modelName = m ? m.name : '—';
  info.innerHTML = `Batch will use current settings: <span>${modelName}</span> · aspect <span>${ar}</span> · <span>1 snap each</span>`;
}

function ccUsePrompt(idx) {
  const p = _ccPrompts[idx];
  if (!p) return;
  const isVideo = window.aiPromptContext === 'video';
  const ta = document.getElementById(isVideo ? 'videoPrompt' : 'prompt');
  if (ta) { ta.value = p.prompt; ta.dispatchEvent(new Event('input')); }
  closeSpecialTool();
  if (!isVideo && typeof switchView === 'function') switchView('gen');
  toast(`Shot #${p.num} prompt set`, 'ok');
}

function ccBatchRender() {
  if (!_ccPrompts.length) return;
  const ta = document.getElementById('prompt');
  if (!ta) return;
  closeSpecialTool();
  if (typeof switchView === 'function') switchView('gen');

  // Queue all 10 prompts with current settings
  let queued = 0;
  for (const shot of _ccPrompts) {
    ta.value = shot.prompt;
    ta.dispatchEvent(new Event('input'));
    try {
      generate();
      queued++;
    } catch (e) {
      console.warn('CC batch: shot #' + shot.num + ' failed to queue:', e);
    }
  }
  toast(`Batch: ${queued} shots queued`, 'ok');
}

// ═══════════════════════════════════════════════════════
// SPECIAL TOOL — Environment Coverage (10 views, AI-generated)
// ═══════════════════════════════════════════════════════

let _ecEnvDesc = '';
let _ecPrompts = []; // [{num, label, prompt}]
let _ecHasSession = false;

const EC_SYSTEM_PROMPT = `You are an expert cinematographer creating 10 camera positions for comprehensive environment coverage.

RULES:
- You receive an environment analysis. Based on it, create 10 camera setups that cover the ENTIRE space with NO blind spots.
- Shots 1↔2, 3↔4, 5↔6 must be COUNTER-VIEWS (camera at opposite ends, looking back at each other).
- Shot 7: center of space, focusing on a dominant feature (window, fireplace, table, etc.)
- Shot 8: low angle from floor level
- Shot 9: overhead/bird's-eye looking straight down
- Shot 10: from outside looking in (through window, doorway, from threshold)
- Describe camera position using VISIBLE OBJECTS as landmarks ("with the bookshelf on the left and door in the background"), NEVER compass directions or numeric angles.
- Each prompt must reference the environment from the analysis.
- No people in any shot.
- Keep each prompt 40-60 words.

OUTPUT FORMAT — exactly 10 shots, each in this format:
=== SHOT 1: [Shot Size] — [short label] ===
[prompt text]

=== SHOT 2: [Shot Size] — [short label] ===
[prompt text]

...continue through SHOT 10.

Shot sizes to use: Wide Shot, Medium Shot, MCU (medium close-up), or EWS (extreme wide shot).
End each prompt with: No people. Photorealistic, cinematic, 35mm, film grain.`;

async function openEnvCoverage() {
  document.getElementById('spmToolList').style.display = 'none';
  document.getElementById('csView')?.classList.remove('show');
  document.getElementById('ccView')?.classList.remove('show');
  document.getElementById('spmTitle').textContent = '◆ Environment Coverage';
  document.getElementById('csResetBtn').style.display = '';
  _ccActiveTool = 'ec';
  const ecView = document.getElementById('ecView');
  ecView.classList.add('show');

  if (_ecHasSession) {
    _ecUpdateBatchInfo();
    return;
  }
  await _ecRunAnalysis();
}

async function resetEnvCoverage() {
  _ecHasSession = false;
  _ecEnvDesc = '';
  _ecPrompts = [];
  document.getElementById('ecPromptsWrap').innerHTML = '';
  document.getElementById('ecPromptsWrap').style.display = 'none';
  document.getElementById('ecBatchBar').style.display = 'none';
  await _ecRunAnalysis();
}

async function _ecRunAnalysis() {
  const hasRef = typeof refs !== 'undefined' && refs.length > 0;
  document.getElementById('ecNoRef').style.display = hasRef ? 'none' : 'block';
  document.getElementById('ecRefRow').style.display = hasRef ? 'flex' : 'none';
  document.getElementById('ecStatusRow').style.display = hasRef ? 'flex' : 'none';
  document.getElementById('ecPromptsWrap').style.display = 'none';
  document.getElementById('ecBatchBar').style.display = 'none';
  if (!hasRef) return;

  _ecHasSession = true;

  // Show all ref thumbnails
  const thumbsWrap = document.getElementById('ecRefThumbs');
  thumbsWrap.innerHTML = '';
  for (let i = 0; i < refs.length; i++) {
    const img = document.createElement('img');
    img.className = 'cc-ref-thumb';
    let src = '';
    if (refs[i].thumb) src = `data:${refs[i].mimeType || 'image/jpeg'};base64,${refs[i].thumb}`;
    if (!src && refs[i].assetId) {
      try { const meta = await dbGet('assets_meta', refs[i].assetId); if (meta?.thumb) src = `data:${meta.mimeType || 'image/jpeg'};base64,${meta.thumb}`; } catch(_) {}
    }
    if (src) { img.src = src; thumbsWrap.appendChild(img); }
  }

  // Step 1: Analyze environment via vision
  const statusEl = document.getElementById('ecStatusText');
  statusEl.className = 'cc-status-text analyzing';
  statusEl.textContent = 'Analyzing environment…';

  const ref = refs[0];
  let imageData = null, mimeType = 'image/jpeg';
  if (ref.assetId) {
    try { const asset = await dbGet('assets', ref.assetId); if (asset?.imageData) { imageData = asset.imageData; mimeType = asset.mimeType || 'image/jpeg'; } } catch(_) {}
  }
  if (!imageData) { statusEl.className = 'cc-status-text'; statusEl.textContent = 'Could not load image data.'; return; }

  try {
    const resized = await resizeImageToCanvas(`data:${mimeType};base64,${imageData}`, 1024);
    const comma = resized.indexOf(',');
    if (comma !== -1) { mimeType = resized.slice(5, resized.indexOf(';')); imageData = resized.slice(comma + 1); }
  } catch (_) {}

  const analyzeInstruction = `Analyze this environment image for a cinematographer planning 10 camera positions.
Describe precisely:
1) Type of space (interior/exterior, room type, setting, era/style)
2) ALL visible objects and their positions (left/right/center/foreground/background)
3) Walls, corners, doorways, windows — potential camera positions
4) Lighting: sources, direction, quality, shadows
5) Floor/ceiling materials and textures
6) Overall dimensions impression (small/medium/large space)

Be precise and factual. Use positional language (left, right, center, foreground, background). 150-200 words.`;

  try {
    const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
    if (orKey) {
      _ecEnvDesc = await _callOpenRouterVision(orKey, imageData, mimeType, analyzeInstruction);
      trackSpend('openrouter', '_or_describe', 1);
    } else {
      const apiKey = document.getElementById('apiKey')?.value?.trim();
      if (!apiKey) { statusEl.className = 'cc-status-text'; statusEl.textContent = 'No OpenRouter or Google API key found.'; return; }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DESCRIBE_MODEL}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: imageData } }, { text: analyzeInstruction }
        ]}], generationConfig: { temperature: 0.5, maxOutputTokens: 1024 } }) });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || resp.status);
      _ecEnvDesc = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      trackSpend('google', '_gemini_describe', 1);
    }
  } catch (err) {
    statusEl.className = 'cc-status-text';
    statusEl.textContent = 'Analysis failed: ' + (err.message || err);
    return;
  }

  if (!_ecEnvDesc) { statusEl.className = 'cc-status-text'; statusEl.textContent = 'No description returned.'; return; }

  statusEl.className = 'cc-status-text';
  statusEl.textContent = _ecEnvDesc;

  // Step 2: Generate 10 prompts via text AI
  statusEl.textContent += '\n\nGenerating 10 camera positions…';
  statusEl.className = 'cc-status-text analyzing';

  const refLabel = _ccRefLabel(0);
  const userMsg = `Environment analysis:\n${_ecEnvDesc}\n\nGenerate 10 camera positions covering this space. Each prompt must start with: "The reference ${refLabel} shows [brief env description]. Keep all furniture, objects, lighting, and materials identical.\\nChange only this: reframe the shot to show..."`;

  try {
    const orKey = localStorage.getItem('gis_openrouter_apikey')?.trim();
    let aiResult;
    if (orKey) {
      aiResult = await _callOpenRouterText(EC_SYSTEM_PROMPT, userMsg, 0.8, 4096);
      trackSpend('openrouter', '_or_prompt', 1);
    } else {
      const apiKey = document.getElementById('apiKey')?.value?.trim();
      aiResult = await _callGeminiTextFallback(apiKey, EC_SYSTEM_PROMPT, userMsg, 0.8, 4096);
      trackSpend('google', '_gemini_prompt', 1);
    }

    if (!aiResult) { statusEl.className = 'cc-status-text'; statusEl.textContent = _ecEnvDesc + '\n\nPrompt generation returned empty.'; return; }

    // Parse shots
    _ecPrompts = _ecParseShots(aiResult);
    if (!_ecPrompts.length) {
      statusEl.className = 'cc-status-text';
      statusEl.textContent = _ecEnvDesc + '\n\nCould not parse prompts from AI output.';
      return;
    }

    statusEl.className = 'cc-status-text';
    statusEl.textContent = _ecEnvDesc;

    _ecRenderPrompts();
  } catch (err) {
    statusEl.className = 'cc-status-text';
    statusEl.textContent = _ecEnvDesc + '\n\nPrompt generation failed: ' + (err.message || err);
  }
}

function _ecParseShots(text) {
  const shots = [];
  const regex = /===\s*SHOT\s*(\d+)\s*:\s*(.+?)\s*===\s*\n([\s\S]*?)(?=\n===\s*SHOT|\s*$)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    shots.push({
      num: parseInt(match[1]),
      label: match[2].trim(),
      prompt: match[3].trim(),
    });
  }
  return shots;
}

function _ecRenderPrompts() {
  const wrap = document.getElementById('ecPromptsWrap');
  wrap.innerHTML = '';
  _ecPrompts.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'cc-shot-card';
    card.innerHTML = `<div class="cc-shot-hdr"><span class="cc-shot-num">#${s.num}</span><span class="cc-shot-label">${s.label}</span><button class="cc-shot-btn" onclick="ecUsePrompt(${i})">↗ Use</button></div><div class="cc-shot-prompt">${s.prompt.replace(/</g,'&lt;')}</div>`;
    wrap.appendChild(card);
  });
  wrap.style.display = 'flex';
  _ecUpdateBatchInfo();
  document.getElementById('ecBatchBar').style.display = 'flex';
}

function _ecUpdateBatchInfo() {
  const m = typeof MODELS !== 'undefined' && typeof currentModel !== 'undefined' ? MODELS[currentModel] : null;
  const ar = document.getElementById('aspectRatio')?.value || '—';
  const info = document.getElementById('ecBatchInfo');
  if (!info) return;
  info.innerHTML = `Batch will use current settings: <span>${m ? m.name : '—'}</span> · aspect <span>${ar}</span> · <span>1 snap each</span>`;
}

function ecUsePrompt(idx) {
  const p = _ecPrompts[idx];
  if (!p) return;
  const isVideo = window.aiPromptContext === 'video';
  const ta = document.getElementById(isVideo ? 'videoPrompt' : 'prompt');
  if (ta) { ta.value = p.prompt; ta.dispatchEvent(new Event('input')); }
  closeSpecialTool();
  if (!isVideo && typeof switchView === 'function') switchView('gen');
  toast(`View #${p.num} prompt set`, 'ok');
}

function ecBatchRender() {
  if (!_ecPrompts.length) return;
  const ta = document.getElementById('prompt');
  if (!ta) return;
  closeSpecialTool();
  if (typeof switchView === 'function') switchView('gen');

  let queued = 0;
  for (const shot of _ecPrompts) {
    ta.value = shot.prompt;
    ta.dispatchEvent(new Event('input'));
    try {
      generate();
      queued++;
    } catch (e) {
      console.warn('EC batch: view #' + shot.num + ' failed to queue:', e);
    }
  }
  toast(`Batch: ${queued} views queued`, 'ok');
}

// ── Init chips ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#aiRandomChips .aipm-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });
});
