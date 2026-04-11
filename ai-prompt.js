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
// ── Init chips ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#aiRandomChips .aipm-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('active'));
  });
});
