// ══════════════════════════════════════════════════════════
// GEMINI SSE STREAMING
// ══════════════════════════════════════════════════════════

async function callGeminiStream(apiKey, prompt, model, refsOverride, snap, onThinking, jobRef = null) {
  const aspectRatio   = snap?.aspectRatio   || document.getElementById('aspectRatio').value;
  const imageSize     = snap?.imageSize     || (document.querySelector('input[name="upRes"]:checked')?.value || '1K');
  const thinkingLevel = snap?.thinkingLevel || (document.querySelector('input[name="upThinkRadio"]:checked')?.value || 'minimal');
  const useSearch     = snap?.useSearch     ?? (document.getElementById('upGrounding')?.checked || false);

  const refsToUse = refsOverride !== undefined ? refsOverride : refs;
  const parts = [{ text: prompt }];
  for (const r of refsToUse) {
    const apiRef = await getRefDataForApi(r, 'setting');
    parts.push({ inlineData: { mimeType: apiRef.mimeType, data: apiRef.data } });
  }

  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: { aspectRatio, imageSize },
  };
  if (model.thinking) {
    generationConfig.thinkingConfig = {
      thinkingLevel: thinkingLevel.toUpperCase(),
      includeThoughts: thinkingLevel === 'high',
    };
  }

  const body = { contents: [{ role: 'user', parts }], generationConfig };
  if (useSearch) body.tools = [{ google_search: {} }];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  if (!resp.ok) {
    // Přečteme error z SSE streamu
    const errText = await resp.text().catch(() => '');
    let errMsg = `API ${resp.status}`;
    try {
      const m = errText.match(/"message"\s*:\s*"([^"]+)"/);
      if (m) errMsg += ': ' + m[1];
    } catch {}
    throw new Error(errMsg);
  }

  // Mark job as accepted — withRetry will not retry errors from this point
  if (jobRef) jobRef.streamAccepted = true;

  const STREAM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes for active generation
  const streamDeadline = Date.now() + STREAM_TIMEOUT_MS;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accThoughtText = '';
  const thoughtImages = [];
  let finalImage = null;

  while (true) {
    if (Date.now() > streamDeadline) { reader.cancel(); throw new Error('Generation timeout after 10 minutes. Click Rerun to retry.'); }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop(); // ponechat nedokončený řádek

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      let chunk;
      try { chunk = JSON.parse(jsonStr); } catch { continue; }

      const chunkParts = chunk.candidates?.[0]?.content?.parts || [];
      const getImg = p => p.inlineData?.data || p.inline_data?.data || null;

      for (const p of chunkParts) {
        if (p.thought && p.text) {
          accThoughtText += p.text;
          if (onThinking) onThinking(accThoughtText);
        } else if (p.thought && getImg(p)) {
          thoughtImages.push(getImg(p));
        } else if (!p.thought && getImg(p)) {
          finalImage = getImg(p);
        }
      }
    }
  }

  if (!finalImage) throw new Error('Model returned no image. Check API key and prompt.');

  const modelKey = getModelKey(model);
  const effectiveThinkingLevel = model.thinking ? thinkingLevel : 'n/a';
  return { type: 'gemini', finalImage, thoughtImages, thoughtText: accThoughtText, thinkingLevel: effectiveThinkingLevel, imageSize, model: model.name, modelKey, refs: refsToUse.length };
}

