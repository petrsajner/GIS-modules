# HANDOFF — Video Prompt Generator: Remaining Models

**Session context:** First session covered Kling V3+O3, Seedance 2.0, Veo 3.1 in `VIDEO_PROMPT_GENERATOR.md`. This handoff is for the next session(s) to complete coverage of remaining models in GIS.

---

## Status

### ✅ Completed (in VIDEO_PROMPT_GENERATOR.md)
- Kling V3 (Standard, Pro) + Kling O3 (Omni)
- Seedance 2.0 (Standard + Fast, all three endpoints)
- Veo 3.1 (all endpoints)
- Cross-model principles (PART A global rules, PART B cross-model gramatika)
- Character Library + Voice Library asset architecture
- Task routing, payload contracts, error handling

### ⏳ Remaining models to cover
In rough priority order (based on GIS integration breadth):

1. **Luma** (Photon for images, Ray for video — Ray 2 / Ray Flash 2)
2. **Grok Imagine** (xAI video)
3. **PixVerse** (C1 generation)
4. **WAN 2.7** (and WAN 2.7e — enhanced)
5. **Vidu**
6. **Hailuo 2.3** (on backlog per userMemories)
7. **Runway Gen-4** (on backlog per userMemories)

### 🔒 Do not cover (per user directive)
- **Kling Effects** presets (samostatný model for avatar — not relevant for main generator)
- **Kling Motion Brush** (non-functional since V1.6)

---

## Non-negotiable rules carried forward

Before starting any new model, re-read these from the main document (PART A):

1. **Rule 1** — No technical parameters (resolution, tier, duration, aspect, CFG, seed). User's UI only.
2. **Rule 2** — No audio mood injection unless user explicitly requests. Clean voice tracks for filmmaking.
3. **Rule 3** — No model switching suggestions for cost/quality reasons.
4. **Rule 4** — Hybrid mode: max ONE question per response, only on genuine ambiguity.
5. **Rule 5** — Transformation is the point. No before/after display.

These apply universally. New model sections must NOT weaken them.

---

## Coverage template per model

For each new model, produce the following structured section (modeled on PART C of main doc):

### Required subsections

1. **Architecture**
   - Available endpoints (fal.ai, Replicate, direct API — whatever GIS uses)
   - Variants (Standard/Pro/Fast/etc. — informational, user's UI choice)
   - What the model's design emphasizes (interpolation? motion? photorealism? stylization?)

2. **Personality**
   - What makes this model different from the three already covered
   - Biases (smoothness, chaos, specific camera feel, etc.)
   - Strengths worth leveraging in prompting
   - Weaknesses worth routing around

3. **Hard constraints for generator**
   - Reference slot limits
   - Supported reference types (subject only? style? video? audio?)
   - Duration limits
   - Language support for dialogue
   - API quirks / known mismatches

4. **Task taxonomy** (table form)
   - Which tasks from master list does this model support?
     - T2V, I2V, I2V+bind, Elements, Start/End, Multi-ref, Motion Transfer, V2V, Video Edit, Extend, Lipsync
   - For each supported task: which endpoint, what inputs

5. **Syntax specifics**
   - Reference mention format (`@Image1`, `[Image1]`, etc.)
   - Camera terminology preferences (3D vectors? cinematic grammar? natural language?)
   - Multi-shot support and how it's expressed
   - Any special markers or tokens

6. **Task-by-task templates**
   - Positive prompt template for each supported task
   - Continuity anchor rules
   - What generator adds automatically vs leaves to user

7. **Negative prompt approach**
   - Does model support negative prompt?
   - If yes: baseline + task-specific additions
   - If no: how to handle exclusions (positive reformulation like Veo?)

8. **Dialogue handling**
   - Native audio? If yes: how to structure in prompt
   - If not: does it need to route through post-generation Lipsync?
   - Voice binding mechanism if any

9. **Cross-model differences summary**
   - Bullet list: "Key things that make this model behave differently from Kling/Seedance/Veo for generator purposes"

---

## Research workflow for each new model

### Step 1 — API reality check (mandatory)

Search web for current API documentation. Model features change monthly; training data is unreliable. Sources to prioritize:

- Official model provider documentation (xAI, Luma, BytePlus, Alibaba for WAN, etc.)
- fal.ai / Replicate / aimlapi model pages (primary backend for GIS)
- Provider's own prompt guide / best practices blog
- GitHub official API repos if they exist

Record findings in `/mnt/project/API_MODELS.md` during research — this is the GIS project's API knowledge base.

### Step 2 — Empirical testing (if possible)

If GIS can run the model, do a smoke test with:
- Simple T2V prompt
- Simple I2V with reference
- Start/End frame if supported
- Dialogue prompt (audio handling test)

This reveals actual behavior vs documented behavior. Especially important for Luma and Grok which have rapid iteration.

### Step 3 — Draft personality & gramatika

Identify what makes this model unique vs the three already covered. The big differentiators to watch for:

- **Luma**: historically strong on photorealism and natural motion, weaker on complex scenes. Ray 2 added strong keyframes support. Check current state.
- **Grok Imagine**: xAI's video model, tight integration with Grok text model. Prompt interpretation style is Grok-flavored. Different defaults than Google/Chinese models.
- **PixVerse**: C1 is their flagship as of writing. Stylization and anime-adjacent content often stronger. Character consistency features worth checking.
- **WAN 2.7**: open-weights roots, Alibaba productized. Strong on longer durations historically. Check 2.7e enhancements.
- **Vidu**: Chinese origin, specific multi-reference character consistency features in Vidu 2.0+. Check current state.
- **Hailuo 2.3**: MiniMax's model. Known for specific camera movement controls and physical realism. Check what 2.3 adds.
- **Runway Gen-4**: Gen-4 introduced strong reference mechanics and motion controls. Check current state vs Gen-3 Alpha.

### Step 4 — Write section

Follow coverage template above. Integrate into main document as new PART C.X subsection.

### Step 5 — Update cross-references

- Add model to task taxonomy comparison table (PART D.1)
- Add any new error/fallback rows to PART D.6
- Add to implementation checklist (PART F) if new asset types or UI needed

---

## Open questions to resolve in next session(s)

### Q1 — Character Library cross-model compatibility
Kling has formal Elements with `element_id`. Seedance, Veo, others use ad-hoc image references. Does GIS Character Library store:
- (a) One record per model (same character has separate records for Kling-element vs Seedance-refs)?
- (b) One unified character record with per-model mappings?

Option (b) is cleaner UX but requires more engineering. Option (a) is simpler but fragments user's mental model.

### Q2 — Voice Library cross-model compatibility
Same question for voices. Kling has `voice_id`. Seedance has native audio from prompt (no voice asset). Veo same.

If voice assets only work with Kling, the UI should be clear about that — otherwise user expects their voice to work with Veo.

### Q3 — Hybrid mode scope per model
Some models have more idiosyncrasies than others. Should hybrid-mode question frequency be model-aware? E.g., Veo requires more questions (single-action enforcement, style-ref rejection) than Kling.

### Q4 — User-visible model capability comparison
Should GIS surface a "model capability matrix" UI so users know which features work where? E.g., Veo doesn't do V2V, Seedance doesn't do bind_subject, Kling has formal Elements. Users switching between models hit walls without this.

### Q5 — Audio toggle UI placement
Per Rule 2, "Add background audio/mood" toggle is needed. Where in GIS UI?
- Global setting per session?
- Per-generation toggle next to model selector?
- Inside prompt composer as a chip?

### Q6 — Negative prompt per model
Some models don't expose negative_prompt parameter. Does GIS adapt:
- (a) Always show negative prompt input, silently skip when model doesn't support?
- (b) Hide negative prompt input when model doesn't support?
- (c) Translate intended exclusions into positive reformulation in main prompt for unsupported models?

Veo specifically benefits from (c).

---

## Watch-outs for next session

### A — Don't re-drift on Rule 2 (audio)
During Kling/Seedance/Veo coverage, we drifted into auto-audio injection ("Audio: tense drone...") and had to correct. For each new model, be disciplined from the start. Audio only flows from:
1. User's explicit dialogue
2. Diegetic sound user described
3. User toggled "Add background audio/mood" ON

### B — Don't re-drift on Rule 1 (technical params)
Similar risk with every new model. Seedance drift was "cost-aware defaults", "fast tier recommendations", "resolution pairing". Each time a new model's documentation shows pricing/tiers, filter it OUT from generator scope. It's implementation info only.

### C — Video-model-specific vs image-model-specific
GIS has both image and video models. This document is strictly video. Don't absorb image-model features into video generator. If a model straddles (Luma: Photon for images, Ray for video), cover only the video side.

### D — fal.ai API path stability
fal.ai endpoints move between `/v3/standard/`, `/v3/pro/`, `/fast/` variants. Cite actual paths from current fal.ai pages, not from memory. Paths documented at time of writing may be moved by the time next session runs.

### E — Chinese-origin model dialogue quirks
Kling, Seedance, Vidu, Hailuo, WAN — all Chinese-origin. Dialogue handling for these models often has EN/ZH primary support with other languages translated through. This affects Czech users (Petr's primary language for dialogue). Always check and warn in hybrid mode.

---

## Document structure recommendation

Keep `VIDEO_PROMPT_GENERATOR.md` as the primary reference. Add new models as new subsections under PART C:

```
PART C — Per-model knowledge base
├── C.1 Kling (V3 + O3)              [DONE]
├── C.2 Seedance 2.0                 [DONE]
├── C.3 Veo 3.1                      [DONE]
├── C.4 Luma Ray                     [NEXT SESSION]
├── C.5 Grok Imagine                 [NEXT SESSION]
├── C.6 PixVerse C1                  [FUTURE]
├── C.7 WAN 2.7 / 2.7e               [FUTURE]
├── C.8 Vidu                         [FUTURE]
├── C.9 Hailuo 2.3                   [FUTURE]
└── C.10 Runway Gen-4                [FUTURE]
```

PARTs A, B, D, E, F remain stable. Only PART C grows.

---

## Handoff metadata

- **Current version of main doc:** initial draft, Kling+Seedance+Veo coverage complete
- **Next session should:** pick 1–2 models from remaining list, not all at once (context space + research depth)
- **Recommended first target:** Luma Ray 2 (most user-relevant, well-documented, likely clean extension)
- **Secondary target:** Grok Imagine (if Luma goes fast, xAI integration is important for GIS)
- **Research references:** use `API_MODELS.md` in project knowledge for any prior notes on these models; extend it with new findings

---

**Ready for next session. Start by re-reading PART A, PART B of main document, then proceed with Luma Ray (or user's chosen priority).**
