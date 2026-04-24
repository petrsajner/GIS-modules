# Video Prompt Generator — Implementation Guide

**Scope:** Kling V3 + O3, Seedance 2.0, Veo 3.1
**Target architecture:** OpenRouter (Claude Sonnet 4.6) as primary LLM, Gemini Flash as fallback
**Integration point:** GIS video generation flow, between user input and model payload construction

---

## PART A — Global rules (apply to all models, non-negotiable)

### Rule 1 — Scope boundary: prompt-only
Generator transforms user intent into an optimal prompt for the selected model. It does **not** touch:
- Resolution
- Quality tier / model variant (Standard/Fast/Pro/Lite)
- Duration
- Aspect ratio
- CFG scale, seed, or any sampler parameter
- `generate_audio` toggle

All technical parameters belong to the user via GIS UI. Generator works with whatever configuration the user selected and never proposes, suggests, or silently adjusts any of it.

### Rule 2 — Audio scope: never inject without explicit request
The single most important rule. For filmmaking, clean voice tracks without unreplaceable scoring are critical.

Generator **never** adds:
- Background mood / underscore ("Audio: tense drone, heartbeat rhythm...")
- Music suggestions ("with cinematic orchestration")
- Atmospheric sound design unless it is diegetic and obvious from the scene

Generator **may** include in prompt:
- Dialogue — only if user wrote dialogue; generator translates it into model syntax
- Diegetic sounds logically required by the scene (footsteps from running, door slam from closing a door) — only if user described the action that produces them
- Voice physiology coating (breathing, tone) around existing user-written dialogue

Generator **respects** a user-controlled UI toggle "Add background audio/mood" (or similar). When OFF (default), no atmospheric audio layers. When ON, generator may add mood-matched audio per model rules.

### Rule 3 — Model switching: user choice only
Generator never suggests switching to a different model for cost or quality reasons. Model selection is user's UI action. Generator works with the active model.

Generator **may** inform user about capability limits of active model (e.g., "Veo 3.1 doesn't accept style references; I can translate the style into text, or you can switch to Kling/Seedance for style-ref support"), but it does not make the switch autonomously.

### Rule 4 — Hybrid mode: ask only when necessary
Generator operates in hybrid mode: transforms without asking when confident, asks exactly one focused question when encountering genuine ambiguity.

Valid questions:
- Task type ambiguity ("continue previous motion, or start new beat?")
- Reference role ambiguity ("which image is subject, which is style?")
- Scope ambiguity ("this scene has 3 dominant actions, split into separate clips or pick primary?")
- Character consistency scope ("will this character appear in other clips? If yes, I'll create a reusable Element.")

Invalid questions (never ask):
- Anything about technical parameters (Rule 1)
- Anything about audio mood (Rule 2 — audio toggle is UI, not conversation)
- Style preferences the user already implied
- Confirmation of work already in progress

### Rule 5 — Transformation is the point
Generator does not simply enrich the user's text by 20%. It transforms. User writes "muž zaútočí", generator produces kinetic weight transfer description. User writes "napjatá scéna", generator produces micro-action rhythm. This is the entire value proposition.

Generator does not show the user a before/after. User knows what they wrote. The transformed prompt is the output.

---

## PART B — Cross-model prompt engineering principles

These apply universally across all supported video models.

### B.1 — Kinetic translation (replaces action verbs)

Action verbs → weight transfer and motion arc descriptions.

| User writes | Generator produces |
|---|---|
| runs / běží | kinetic transfer from rear foot to forward foot, driving weight through leading hip |
| reaches / sáhne | extends arm with scapular retraction, fingertips leading, elbow trailing |
| falls / padá | loss of vertical structure at knees, weight collapses through hip line, torso rotates backward |
| attacks / zaútočí | kinetic weight transfer from rear foot forward, torso rotation leading shoulder drive |
| jumps / skočí | explosive extension from both ankles, hip drive upward, core locking to carry airborne rotation |
| turns / otočí se | weight shift to pivot foot, hip rotation leading, head following torso by quarter-beat |
| stops / zastaví | deceleration force absorbed through bent knees, heel-first contact arresting momentum |
| sits / sedne si | controlled descent through hip flexion, weight transfer rearward onto contact surface |

Rule: never use a plain action verb for any kinetically meaningful motion. Translate every time.

### B.2 — Reference prompting rule (universal)

When any reference image/video is provided, the prompt must NOT re-describe what is visible in the reference.

**Wrong:**
```
Reference shows a man in a black suit. The man in the black suit walks across the room.
```

**Right:**
```
Continuing from reference frame: subject walks across the room with deliberate weight 
transfer, shoulders angled forward. Maintain identity and wardrobe from reference.
```

The model sees the reference. The prompt describes what happens in time — action, camera, environmental evolution, continuity anchors at end.

### B.3 — Vision pass requirement

Before generating any prompt that involves reference inputs, generator performs vision pass on each reference via OpenRouter Claude Sonnet 4.6 (with image input) to extract:

- Subject identity markers (face structure, age range, hair, distinctive features)
- Pose and body position
- Wardrobe / materials / textures
- Lighting direction, quality, color temperature
- Framing, shot size, implied focal length
- Environment and spatial context
- Mood and atmosphere

Vision extraction is **internal state** — it is not written into the prompt. It is used for:
- Delta computation (start/end frame tasks)
- Continuity anchor construction
- Validation (does user's described action make sense given reference pose?)
- Reference role assignment (is this subject, style, or environment?)

### B.4 — Hybrid mode decision tree

```
User input arrives
  ↓
Vision pass on any references
  ↓
Task classification (T2V / I2V / Start-End / Multi-ref / V2V / Extend / Lipsync)
  ↓
Ambiguity check:
  - Is task type clear? → if no, ONE question
  - Are reference roles clear? → if no, ONE question  
  - Is action scope OK for active model? → if no, ONE question
  ↓
Silent transformation
  ↓
Output: positive prompt + negative prompt + payload structure
```

Generator never asks more than ONE question per response. If multiple ambiguities exist, pick the most blocking one.

### B.5 — Negative prompt universal baseline

Applied to all tasks on all models that support negative prompts (Kling, Seedance; Veo handles negatives in-prompt with positive reformulation — see Veo section):

```
blurry, distorted anatomy, warped hands, extra limbs, flickering, 
low quality, compression artifacts, washed out colors
```

Task-specific additions layered on top (see per-model sections).

### B.6 — Dialogue handling (when user wrote dialogue)

All three models handle dialogue natively. Generator transforms user's dialogue line into model-specific syntax (see per-model sections) and optionally adds **physiological coating** around it when emotional context is detectable.

Physiological coating rules:
- Only if emotion is detectable in surrounding text (angry, scared, exhausted, grieving, triumphant, etc.)
- Placed BEFORE the line or as an emotional wrapper, never after
- Short (3–8 words) for natural integration
- Examples: "voice tightening", "with constrained breathing", "a tremor in her voice", "jaw clenched, each word measured"

Generator does NOT invent dialogue. If user wrote no dialogue, no dialogue appears in output prompt.

### B.7 — Multilingual context

All three models have their quirks with non-English dialogue:
- Kling: best with EN/ZH; other languages may be accepted but quality varies
- Seedance: explicitly stated — EN/ZH native, other languages translated to EN internally
- Veo: best with EN; multilingual support exists but is weaker

Generator rule: if user writes dialogue in a non-EN/ZH language (e.g., Czech), generator warns in hybrid mode: "This dialogue will likely be translated to English by the model. For native Czech dialogue, generate video without dialogue first, then use Kling Lipsync task with a Czech voice asset."

---

## PART C — Per-model knowledge base

---

## C.1 — Kling (V3 + O3)

### Architecture

Kling has multiple specialized endpoints on fal.ai:
- `fal-ai/kling-video/v3/standard/text-to-video`
- `fal-ai/kling-video/v3/standard/image-to-video`
- `fal-ai/kling-video/v3/pro/image-to-video`
- `fal-ai/kling-video/o1/*` — Omni (3D spacetime) endpoints
- `fal-ai/kling-video/create-voice` — voice asset creation
- `fal-ai/kling-video/create-element` (if exposed) — element asset creation
- Lipsync endpoint for post-generation dialogue sync

### V3 personality
- Multi-shot native: engine designed for 4–15s sequences with internal cuts
- Audio-visual coupling strong: dialogue prompts drive facial micro-expressions
- Single-source reference adequate for identity, Bind Subject toggle strengthens it
- Up to 4 Element slots in Elements mode

### O3 personality
- 3D Spacetime Joint Attention: perceives scene as 3D volume over time, not 2D frames
- Ray-traced lighting responds to explicit physics prompts
- Handles 10+ multimodal references as layered composition
- V2V with semantic occlusion (no rotoscoping needed)

### Task taxonomy

| Task | Endpoint | Inputs |
|---|---|---|
| T2V | `text-to-video` | prompt |
| I2V basic | `image-to-video` | image_url + prompt |
| I2V + Bind Subject | `image-to-video` | image_url + prompt + bind_subject flag |
| Elements | `image-to-video` (V3) or O1 | elements[] + prompt with @mentions |
| Start/End | start-frame endpoint | image_url + tail_image_url + prompt |
| V2V | O1 (O3) only | video_url + transformation prompt |
| Extend | extend endpoint | previous video + continuation prompt |
| Lipsync | lipsync endpoint | video_url + audio OR (text + voice_id) |

### V3 syntax specifics

**Multi-shot bracket syntax (V3 default):**
```
[Shot 1: 0-Xs, <shot size> <angle>, <camera motion>, <subject> <kinetic action>, <environment>]
[Shot 2: Xs-Ys, <shot size> <angle>, <camera motion>, <kinetic continuation or reaction>]
```

Generator detects natural beats in user input and proposes multi-shot split when:
- Action has ≥2 distinct phases (setup → execution → reaction)
- Duration in UI allows (≥8s typically supports 2 shots)
- User hasn't explicitly requested a single continuous shot

Single-shot when uncertain or user's scene is clearly one moment.

### O3 syntax specifics

**3D camera vectors replace 2D camera terminology:**

| 2D term | O3 3D translation |
|---|---|
| pan right | Y-axis rotation around subject centroid |
| tilt up | X-axis rotation pivoting on horizon plane |
| dolly in | Z-axis translation forward relative to subject |
| tracking shot | X-axis translation parallel to subject, Z-axis depth locked |
| orbital move | rotation around subject Y-axis maintaining radial distance |
| rack focus | depth plane shift along Z-axis with focal distance transition |

Generator always translates camera moves to 3D vector language when model is O3.

**Ray-traced lighting prompting:**

Estetic lighting descriptions → physical simulation language:
- "moody lighting" → "low-key three-point setup, key at 30° elevation frame-right, minimal fill ratio, hard rim from behind-left"
- "lit from below" → "low-angle key light source at 15° elevation, casting physically accurate upward shadow gradients"
- "candlelit" → "warm point source ~2200K at subject chest level, inverse square falloff, subtle flicker frequency"
- "moving light" → "dynamic volumetric light intersection from moving source, casting time-accurate hard shadows warping across geometry"

### Elements mechanism (character consistency)

Two levels, both important:

**Level 1 — Bind Subject toggle (I2V only):**
- Single reference image + flag
- Locks facial structure, wardrobe, hair
- No separate asset, just a flag on existing I2V call
- Generator auto-enables when scene has complex motion (orbit, rotation, extreme expression) and identity would otherwise drift

**Level 2 — Elements (named reusable assets):**
- Element created from 1–4 multi-angle images OR from 8s video clip
- Returns `element_id`, stored in GIS Character Library
- Referenced in prompts as `@Character1`, `@Character2`, etc. (generator uses `@` syntax, not `[...]`)
- Up to 3 elements in V3 start-frame generation; more in O3

**When to use Level 1 vs Level 2:**
- Single clip, character appears once: Level 1 (Bind Subject)
- Character appears across multiple clips or project: Level 2 (Element)
- Multi-character scene with interaction: Level 2 (multiple elements)

**Element creation description:**
Generator builds element description from vision pass — strictly identity, no action:
```
Element name: <user-provided name or auto-generated slug>
Element description:
<physical identity: face shape, age range, ethnicity, hair color/style, eye color>
<wardrobe: garments, colors, distinctive details>
<distinctive features: scars, tattoos, accessories, posture>
```

Description describes what IS on references, never what character does or where they are.

### Voice binding (part of Elements)

Voice is bound to Element, not standalone (per user directive: "hlas musíme bindovat s charakterem").

**Voice asset creation:**
- Endpoint: `fal-ai/kling-video/create-voice`
- Input: audio sample (ideally 10–30s clean speech)
- Returns: `voice_id`
- Stored in GIS Voice Library

**Binding to Element:**
- Element record gets `bound_voice_id` field
- When element is referenced in prompt with dialogue, voice is automatically used
- Kling V3 Omni architecture supports voice binding at element level

**Prompt syntax with bound voice:**
```
@Character1 walks to the window, turns to face @Character2.
@Character1 says: "I didn't expect you to come back."
@Character2 steps forward.
@Character2 says: "Neither did I."
```

Voice is inherent to element — no `<<<voice_1>>>` tokens needed when voices are bound.

**Max 2 voice_ids per task.** If prompt involves dialogue for 3+ characters, generator in hybrid mode asks: narrow to 2 primary speakers (others non-verbal), or split scene into multiple generations?

### Task-by-task templates (Kling)

#### T2V (V3)
```
[Shot 1: 0-Xs, <shot size> <angle>, <camera motion>, 
 <subject> <kinetic action with weight transfer>, <environment>]
[Shot 2: Xs-Ys, <continuation or reaction>]
```

Single shot variant (when scene is one beat):
```
<shot size> <angle> of <subject> <kinetic action>, <environment>.
<camera behavior>.
<lighting in cinematic or physical terms>.
```

#### T2V (O3)
```
<scene description in spatial terms>.
Camera: <3D vector motion relative to subject>.
Lighting: <physical simulation language>.
<subject> <kinetic action with weight transfer>.
```

#### I2V basic (V3 or O3)
```
Continuing from reference frame:
<kinetic action description with weight transfer>.
<camera behavior — V3 or O3 specific>.
<environmental evolution if any>.
Maintain: identity anchor, wardrobe, lighting continuity from reference.
```

#### I2V + Bind Subject
Same as I2V basic. Bind Subject is a payload flag, not a prompt change. Generator may add:
```
Strict identity preservation across motion and rotation.
```
at the end when scene has complex motion.

#### Elements generation (single or multi-character)

Single-character:
```
@Character1 <kinetic action with weight transfer>.
Environment: <scene description, NO subject re-description>.
Camera: <motion per V3 or O3 rules>.
Maintain @Character1 identity integrity throughout.
```

Multi-character:
```
@Character1 <action>, reacting to @Character2 <action>.
Spatial relationship: @Character1 at <position>, @Character2 at <position>.
Interaction: <eye contact, physical contact, dialogue beat>.
Camera: <motion>.
Maintain strict identity anchors on both elements.
```

With dialogue (voices bound to elements):
```
@Character1 <action>, then says: "<line>".
@Character2 <reaction>, replies: "<line>".
```

#### Start/End Frame

Process (5 steps):
1. Vision pass on both frames
2. Compute DELTAs: pose, spatial, camera, lighting, environmental
3. Classify transition: kinetic / camera / temporal / morph / combined
4. Build prompt per type (see below)
5. Validate delta magnitude — warn in hybrid if extreme

Kinetic transition:
```
Subject transitions from [pose A summary 3-4 words] to [pose B summary 3-4 words] 
via <kinetic description with weight transfer and motion arc>.
Motion duration <Xs>, peak energy at <Ys>.
Camera <holds / subtle follow / matches energy>.
```

Camera transition:
```
Camera executes <specific move> from frame A framing to frame B framing 
over <Xs>, <easing profile>.
Subject <maintains position / subtle weight shift>.
Lighting consistent throughout.
```

Temporal transition:
```
Time transition from [state A] to [state B] over <Xs>.
Lighting shift: <direction and color temperature change>.
Environmental change: <what appears, disappears, transforms>.
Subject <static anchor / subtle response>.
```

Combined (most complex):
```
<combined kinetic + environmental + lighting description>.
<camera behavior through transformation>.
Motion peak at <Xs>.
```

Rule: prompt never describes what's IN frame A or frame B. Model sees both. Prompt describes the CHARACTER of interpolation only.

#### V2V (O3 only)

Replace + Preserve + Integration triad (all three required):

```
Source video transformation:
Replace: <specific element> with <new element>.
Preserve: <explicit list — identity, occlusion, shadow direction, 
camera motion, environmental framing, original duration timing>.
Integration: <new element> must respect original <lighting direction, 
scale, perspective, contact shadows, specular behavior>.
```

#### Extend

Hybrid mode question: "Continue previous motion (inertia) or start new beat?"

Inertia continuation:
```
Subject completes the <action> initiated in previous segment, 
settling into <pose>. Camera <decelerates to match / holds>.
Lighting continuity maintained.
```

New beat with transition:
```
Brief moment of stillness (0.5s), then subject shifts attention to <new focus>. 
Camera <new behavior>. Emotional transition: <state change>.
```

#### Lipsync (separate task)

Generator does NOT produce a positive or negative prompt for lipsync. Output is payload only:

Audio-driven:
```
video_url: <source video>
audio_url: <user-provided audio>
face_id: <from identify_face if multiple faces>
sound_start_time / sound_end_time: <optional crop>
```

Text-driven:
```
video_url: <source video>
text: <user text, preprocessed for TTS>
voice_id: <bound voice_id or user-selected>
face_id: <from identify_face if multiple faces>
```

Text preprocessing: timing estimation (~150 wpm), pronunciation normalization (FBI → F B I, numbers written out when needed), language-voice match check.

Validation before submit:
- Face visibility in source video (≥15% frame height, not heavily motion-blurred)
- Multi-face handling: call `identify_face`, ask user if >1 face, auto-pick if one dominates
- Audio duration vs video duration check

### Kling negative prompts

Base:
```
blurry, distorted anatomy, warped hands, extra limbs, flickering, 
low quality, compression artifacts
```

Task-specific additions:

| Task | Additions |
|---|---|
| T2V | identity drift, morphing face |
| I2V | face morph, clothing change, background swap, lighting discontinuity, identity drift from reference |
| I2V + Bind | (above) + rotation-induced face melt, angle-dependent identity shift |
| Elements | reference role confusion, @Character1 bleed into @Character2, identity cross-contamination |
| Start/End | frame A content drift, frame B content drift, mid-transition identity morph, abrupt cut, ghosting |
| V2V | source motion deviation, camera path drift, lighting inconsistency with source |
| Extend | abrupt motion change, subject teleport, lighting jump, continuity break, scene reset |

---

## C.2 — Seedance 2.0

### Architecture

Three endpoints on fal.ai:
- `bytedance/seedance-2.0/text-to-video` (+ fast variant)
- `bytedance/seedance-2.0/image-to-video` (+ fast variant) — also handles Start/End via `end_image_url`
- `bytedance/seedance-2.0/reference-to-video` (+ fast variant) — the "omni" endpoint

Reference-to-video is the powerhouse: handles style transfer, motion transfer, character consistency, scene composition, video editing, and video extension all through reference combinations.

### Personality
- Unified multimodal: up to 9 images + 3 videos + 3 audio files in single omni generation
- Multi-shot via natural language + timestamps (NOT bracket syntax)
- Native audio-visual coupling (like Veo)
- Smoothness bias: needs explicit raw-dynamics prompting for handheld/action feel
- Strongest interpolation: handles dramatic start/end deltas better than Kling or Veo

### Reference syntax quirk

Primary syntax: `@Image1`, `@Video1`, `@Audio1` (per fal.ai official GitHub repo).

Some fal.ai model-page docs show `[Image1]` variant — generator uses `@` as primary; if empirically fails in implementation, fallback to `[...]`. Verify in live testing.

### Mode exclusion

Seedance 2.0 has two **incompatible** visual input modes:
- **Frame-guided**: start_image + end_image (via image-to-video endpoint with `end_image_url`)
- **Omni reference**: multiple images/videos/audio (via reference-to-video endpoint)

Cannot combine — generator enforces this in task classification. If user wants both (start/end + multi-reference), generator asks which takes priority or offers to split into two generations.

### Task taxonomy

| Task | Endpoint | Payload logic |
|---|---|---|
| T2V | text-to-video | prompt only |
| I2V | image-to-video | image_url + prompt |
| Start/End | image-to-video | image_url + end_image_url + prompt |
| Multi-reference | reference-to-video | image_urls[] + prompt with @mentions |
| Motion transfer | reference-to-video | image_urls[] + video_urls[] + prompt |
| Audio-driven | reference-to-video | audio_urls[] + image_urls[] + prompt |
| Video editing | reference-to-video | video_urls[] + prompt (+ optional image_urls[] for replacement refs) |
| Video extension | reference-to-video | video_urls[] + continuation prompt |

All tasks 4–8 share the reference-to-video endpoint. Task is determined by input composition and prompt structure, not endpoint choice.

### Syntax specifics

#### Multi-shot via timestamps (NOT brackets)

User intent: "man walks to car, starts engine, drives away, crashes into tree"

Kling V3 would produce: `[Shot 1: 0-3s, ...] [Shot 2: 3-6s, ...] [Shot 3: 6-10s, ...]`

Seedance produces:
```
A man walks toward his car in urgency, keys in hand. 
Cut scene to interior as he starts the engine, tension on his face. 
At 5 seconds, cut to a wide tracking shot of the car speeding down the road. 
At 8 seconds, sudden violent impact with a roadside tree — crumpling metal, 
shattering glass.
```

Generator:
- Uses natural language transitions: "Cut scene to...", "At Xs, ...", "The camera then..."
- Never uses bracket syntax (confuses Seedance)
- Lets engine distribute timing organically when not critical
- Pins specific beats with "At Xs, ..." only when precise timing matters

#### Anti-smoothness injection

Seedance outputs smooth by default. For action/documentary/verité content, inject raw-dynamics explicitly.

Detection triggers in user input:
- Action: fight, chase, explosion, impact, running, falling, combat → inject raw-dynamics
- Documentary: realistic, raw, handheld, found footage, verité, docu-style → inject operator-organic
- Cinematic: beautiful, smooth, glossy, polished → no injection (default is wanted)

Injection templates:

Action:
```
shot on 12-14mm ultra-wide with edge distortion, aggressive handheld camera 
micro-jitters, rolling shutter artifacts on fast pan
```

Documentary:
```
handheld operator breathing rhythm, organic zoom corrections, 
natural focus hunt, imperfect framing
```

### Task-by-task templates (Seedance)

#### T2V
```
<scene-establishing sentence with camera + subject + environment>.
<kinetic action description with weight transfer>.
<atmospheric / lighting / mood details>.
[anti-smoothness injection if genre warrants]
```

#### I2V basic
```
Continuing from reference frame:
<action with kinetic language — weight transfer, motion arc>.
<camera behavior>.
<environmental changes over time, if any>.
Maintain reference lighting, identity, and composition anchors.
```

#### Start/End Frame

Same DELTA analysis as Kling. Seedance handles more extreme deltas — generator is less conservative in hybrid warnings.

Kinetic:
```
Subject transitions from [start pose descriptor] to [end pose descriptor] 
via <kinetic description with weight transfer and motion arc>.
<camera behavior — hold, subtle follow, or match energy>.
```

Temporal:
```
Time and environment shift over the duration:
<lighting change direction and color temperature>.
<environmental change — what appears, disappears, transforms>.
Subject remains <anchor position / reacts subtly>.
```

Combined (Seedance strength):
```
Dramatic transformation sequence:
<combined kinetic + environmental + lighting changes over duration>.
<camera behavior through transformation>.
Motion peak at <Xs>.
```

#### Multi-reference composition (omni)

Reference role assignment is critical — generator actively directs:

- Subject references (1–3 images): primary + additional angles for identity
- Style/aesthetic references (1–2 images): mood, color, lighting style
- Environment references (1–2 images): location, spatial layout
- Wardrobe/material references (optional): specific materials, clothing
- Video motion reference (optional, 1 slot): motion style
- Audio reference (optional, 1–3 slots): rhythm, ambient (only when user requests)

Template:
```
Scene: <environment description anchored to @Image3>.
@Image1 enters <direction>, wearing garments matching @Image4's texture.
@Image1 performs <kinetic action>.
Visual style and color grading follow @Image2.
Motion dynamics inspired by @Video1.
```

Hybrid mode — if reference roles unclear, ask ONE question with thumbnails: "Which image is primary subject, which is style reference, which is environment?"

#### Motion transfer

```
@Image1 performs the exact motion and kinetic dynamics from @Video1, 
now <emotional/contextual modifier>.
Environment: <scene description>.
Camera <matches @Video1's framing / establishes new framing>.
Preserve @Image1's identity and wardrobe from reference.
Preserve @Video1's motion timing, weight shifts, and kinetic energy.
```

#### Audio-driven generation (only when user provides audio reference)

```
Scene: <description>.
Visual rhythm and cuts synchronized to @Audio1's beat structure.
Energy and motion intensity match @Audio1's dynamics.
<kinetic description aligning with music character>.
```

#### Video editing

```
Edit @Video1:
Replace: <specific element> with <new element>.
Preserve: original motion, camera work, duration, and framing from @Video1.
Integration: <new element> must match scale, lighting direction, 
and perspective of the source.
```

#### Video extension

```
Continue from @Video1's final moment.
<what happens next — kinetic continuation or new beat>.
Preserve established characters, environment, lighting continuity, 
and camera language.
```

Hybrid mode question (same as Kling Extend): inertia vs new beat.

### Seedance negative prompts

Base (same as global):
```
blurry, distorted anatomy, warped hands, extra limbs, flickering, 
low quality, compression artifacts
```

Task-specific additions:

| Task | Additions |
|---|---|
| I2V | identity drift from reference, lighting discontinuity |
| Start/End | frame A content leak mid-transition, frame B premature bleed |
| Multi-reference | reference role confusion, style inconsistency, cross-reference bleed |
| Motion transfer | character drift from @Image1, motion deviation from @Video1 |
| Video editing | motion change from source, duration change, camera path drift |
| Video extension | scene reset, abrupt cut, character teleport |

### Seedance dialogue syntax

User's dialogue goes directly in prompt with natural attribution:
```
@Character1 walks to the window and says in a low voice: "I didn't expect you to come back."
```

Seedance's native audio-visual coupling handles lip-sync automatically. No separate voice_id binding (unlike Kling).

Physiological coating (Rule B.6) is lighter than Veo — Seedance derives emotion but less precisely. "low voice", "shaky", "forcefully" is enough; don't pile on Veo-level physiology.

---

## C.3 — Veo 3.1

### Architecture

Endpoints (via Google Gemini API, Vertex AI, or fal.ai/aimlapi wrappers):
- `veo-3.1-generate-preview` — T2V and I2V
- `veo-3.1-first-last-image-to-video` — first/last frame interpolation
- `veo-3.1-reference-to-video` — up to 3 asset reference images
- `veo-3.1-extend-video` — continuation

### Personality
- Strongest prompt adherence of all three models — writes exactly what you ask
- Strongest audio-visual coupling — every audio cue affects visual (micro-expressions, lighting, pupil behavior)
- Single dominant action bias — physics engine struggles with simultaneous conflicting actions
- Short clips only (4, 6, 8 seconds — user UI choice, not generator business)
- Cinematic grammar fluent — understands filmmaking terminology natively
- No V2V / edit mode — only Extend for continuation

### Hard constraints for generator

1. **Max 3 reference images.** Veo 3.1 accepts 1–3 refs. If user provides 4+, warn in hybrid mode.

2. **Asset references only.** `referenceImages.style` is NOT supported in Veo 3.1 (style is veo-2.0-generate-exp only). If user provides what appears to be a style/mood reference, generator must:
   - Warn in hybrid mode: "Veo 3.1 accepts only asset references (character, product, scene-subject). Style reference can't be attached as image — I can translate style into prompt text, or you can switch to Kling/Seedance for style-ref support."
   - If user confirms translation: describe the style textually in prompt rather than attaching as reference

3. **Single dominant action.** Generator detects multiple simultaneous actions and asks: "This scene has 3 major actions happening at once — Veo renders best with one dominant action per clip. Pick the primary, or split into separate clips?"

4. **Known docs/API mismatch.** Reference images documented but sometimes API returns 400 "not supported". Generator implements fallback: if reference-to-video fails, retry as I2V using first reference as start frame, warn user.

### Task taxonomy

| Task | Endpoint | Inputs |
|---|---|---|
| T2V | veo-3.1-generate-preview | prompt |
| I2V | veo-3.1-generate-preview | image (start frame) + prompt |
| First/Last Frame | first-last-image-to-video | first_image + last_image + prompt |
| Reference-to-Video | reference-to-video | 1–3 asset refs + prompt |
| Extend | extend-video | source Veo video + continuation prompt |

No V2V, no Lipsync (lip-sync is native in every Veo generation, not a separate task).

### Syntax specifics

#### Cinematic grammar

Veo reads filmmaking terminology correctly. Generator translates casual descriptions into cinematic language when context warrants (user mentions "cinematic", "film", "cinema", or uses camera terms).

| Casual | Cinematic translation |
|---|---|
| close-up of face | MCU, 50mm equivalent, shallow depth of field, focal plane on eyes |
| zoom in | dolly in / push in on subject |
| zoom and adjust focus | push-pull / contra-zoom (Hitchcock zoom) with simultaneous rack |
| wide shot of landscape | EWS, 24mm wide-angle, deep focus throughout |
| from above | high-angle shot, 45° elevation, subject center-frame |
| from below | low-angle shot, worm's eye approaching 10° elevation |
| side lighting | key light at 90° frame-right, strong shadow sculpting |
| soft pretty light | diffused key with 2:1 fill ratio, golden hour warm color temperature |

#### Micro-actions rhythm (Veo specialty)

For emotional beats, break down into staccato micro-actions with ellipsis rhythm:

User: "tense moment, they look at each other"

Generator:
```
A beat of silence. She lifts her gaze. He notices — a half-second hesitation. 
Her breath catches. Their eyes lock.
```

Rules:
- Trigger: emotional context + interpersonal beat in user input
- Format: 3–5 short micro-actions separated by periods or ellipses
- Each micro-action describes a physiological or observational beat
- Works only for Veo — over-formalizes other models

#### Physiological dialogue coating (stronger than other models)

Veo's audio-visual coupling is tightest of all. Physiological coating is not decoration — it's a tool for shaping the image via audio.

User writes dialogue with emotional context:

Plain dialogue in prompt:
```
She says: "I'm fine."
```

Coated dialogue:
```
She says with constrained breathing, voice barely holding steady: "I'm fine."
```

Veo reads the physiology and produces:
- Micro-tremor in lip corners
- Slight pupil dilation
- Rigid jawline
- Shoulder tension in frame

This is why Rule 2 (no audio injection) matters doubly for Veo: every unintended audio descriptor warps the visual away from user's intent.

#### Reference weight distribution (Veo 3.1 novelty)

When 2 or 3 reference images are provided, explicit priority assignment is mandatory — otherwise Veo picks defaults and often assigns wrong.

Template:
```
<main scene prompt>.

Reference priority:
- Reference 1: character identity, geometry, and wardrobe (strict anchor).
- Reference 2: <secondary role — e.g., product details, prop geometry, co-character>.
- Reference 3: <tertiary role if present>.

Maintain strict fidelity to reference geometry and identity throughout.
```

When only 1 reference: no weight distribution needed.

When 2 references without clear roles: generator asks in hybrid mode.

### Task-by-task templates (Veo)

#### T2V

```
<shot size + angle>: <subject> <kinetic dominant action with weight transfer>.
<environment descriptor in 1-2 phrases>.
<lighting description in cinematic terms>.
[micro-actions rhythm if emotional interpersonal context]
```

Rules:
- One dominant action per clip — generator enforces
- Cinematic grammar when context fits
- Minimalism: Veo penalizes over-stuffed prompts more than other models
- No audio line unless user provided dialogue or described diegetic sound

#### I2V

```
Continuing from reference frame:
<kinetic action with weight transfer — describe MOTION, not the image>.
<camera behavior in cinematic terms>.
<environmental or lighting evolution, if any>.
Maintain established geometry, wardrobe, and lighting direction from reference.
```

Veo-specific: continuity anchor goes at END of prompt, not mid-prompt. Veo reads prompt sequentially with strong adherence — final anchor carries most weight.

#### First/Last Frame

Same DELTA analysis as Kling/Seedance. Veo handles dramatic but not extreme deltas — generator is moderately conservative.

Kinetic template:
```
Transition from opening frame to closing frame:
<kinetic description of motion arc with weight transfer>.
<camera behavior — match energy or hold>.
<lighting continuity or shift>.
```

Pro-tip generator proactively offers: if user describes "dramatic reveal", and deltas suggest it works (e.g., wide start → close end of same subject), Veo treats this as cinematic camera move and nails it.

#### Reference-to-Video

```
<scene description with kinetic dominant action>.
<camera and lighting in cinematic terms>.

Reference priority:
- Reference 1: <role>.
- Reference 2: <role>.
- Reference 3: <role>.

Maintain strict fidelity to reference identity and geometry throughout.
```

Style-as-text fallback (when user wanted style ref but Veo 3.1 rejects it):
```
<main scene prompt>.

Style direction: <translated from vision pass of user's style reference — 
color palette, lighting quality, grain, grading, era/medium cues>.

Reference priority:
- Reference 1: <character/asset role>.
```

#### Extend

```
Continuing from previous segment's final moment:
<what happens next — kinetic continuation or new beat>.
Preserve established characters, environment, camera language, and lighting.
```

Hybrid mode question same as other models.

### Veo negative prompt approach

Veo 3.1 handles exclusions best via **positive reformulation** in-prompt. Instead of `no buildings`, write `a desolate landscape with no buildings or roads`.

Generator rule:
- Exclusion as positive formulation when possible, in main prompt
- Classical negative prompt only for artifact-level issues

Classical negative prompt baseline (when needed):
```
blurry, distorted anatomy, warped hands, extra limbs, flickering,
low quality, compression artifacts, subtitles, captions, watermark, text overlays
```

`subtitles, captions, watermark, text overlays` is almost always needed for Veo — it hallucinates text overlays in dialogue clips.

Task-specific additions:

| Task | Additions |
|---|---|
| I2V | identity drift from reference, lighting discontinuity |
| Reference-to-Video | reference role confusion, unintended reference bleed |
| First/Last | mid-transition identity morph, content leak between frames |
| Extend | abrupt motion change, scene reset, character teleport |

---

## C.4 — Luma Ray

### Architecture

Luma Ray family is accessed via direct Luma API (`api.lumalabs.ai/dream-machine/v1/generations`), not fal.ai. GIS integrates six variants through a single endpoint — task type is determined by payload composition (`keyframes.frame0`, `keyframes.frame1`, `type: image | generation`):

- `ray_2` — base quality
- `ray_2_flash` — fast/cheap tier
- `ray_3` — character reference support
- `ray_3_hdr` — character reference + HDR
- `ray_3_14` — fastest default, native 1080p output
- `ray_3_14_hdr` — 1080p + HDR

### Personality

- Positive-only model — negative prompts degrade output quality
- No native audio across all variants (silent model)
- Character reference support only on Ray 3 and Ray 3 HDR
- Native 1080p output on Ray 3.14 variants
- Tight word budget (~100 words) — denser prose than Kling/Seedance

### Prompt template

Single coherent prose, approximately 100 words maximum. Structure:

```
[Subject + mid-action verb] + [primary motion mechanics] + [camera move in canonical term] 
+ [environmental secondary consequences] + [lighting/mood].
```

### Forbidden words — contextual substitution

Luma degrades when these words appear. Generator rewrites them based on context, never deletes blindly:

| Forbidden | Context-aware rewrite pattern |
|---|---|
| `vibrant` | Replace with specific color observation (e.g., "saturated crimson", "deep emerald tones") |
| `whimsical` | Replace with concrete visual detail driving the feel ("playful uneven angles", "soft rounded forms") |
| `hyper-realistic` | Replace with photographic specifier ("shot on 50mm lens", "grainy 35mm film stock", "documentary handheld") |
| `beautiful` | Replace with the physical element that creates beauty ("soft morning backlight", "symmetric framing") |
| `amazing` / `stunning` | Remove — they add no information, replace with observable detail |

### Mid-action verbs required

Luma responds to ongoing present-tense motion. Generator converts initiation language to mid-action:

| User writes | Generator produces |
|---|---|
| begins to run | running |
| starts falling | falling |
| is about to jump | jumping |
| ready to attack | attacking |

### Camera translator

User describes camera freely; generator maps to Luma's canonical vocabulary:

```
camera orbit left / camera orbit right
push in / pull out
tracking shot (left/right/forward/backward)
pedestal up / pedestal down
tilt up / tilt down
pan left / pan right
crane up / crane down
bolt cam (whip/hyper-fast)
aerial / overhead
handheld
static / locked-off
```

Vague user camera language ("dynamic", "impressive", "cinematic") → generator picks a canonical move that fits the action.

### Reference handling

**Ray 3 / Ray 3 HDR** — character reference slot.
- Max 1 character ref per generation
- User dialogue or single-subject focus → generator treats image as character identity anchor
- Multi-character scene + 1 character ref → hybrid-mode question: "Anchor one character to this reference, or split into separate clips?"

**Ray 2 / Ray 2 Flash / Ray 3.14 / Ray 3.14 HDR** — keyframe slots only (`frame0` start, `frame1` end). No character ref support.

### Multi-shot

Default OFF per platform master switch (all models). Luma has no explicit multi-shot syntax; sequential actions stay in single flowing prose when switch is ON with user-described beats.

### Audio — NONE

Luma generates silent video. Generator:
- Strips any dialogue from user input
- Omits SFX, ambient, BGM descriptions
- No `AUDIO:` block
- Hybrid-mode note when user wrote dialogue: *"Luma generates silent video. For dialogue, generate visually first, then use Kling Lipsync task to sync a voice track."*

### Secondary consequences default ON

Generator expands user's primary action with physics-consistent ripples that enrich the frame but never override user intent:

| User primary | Generator adds |
|---|---|
| runs through forest | "dust kicking up from footfalls, low branches stirring in her wake" |
| dives into water | "water displacing outward in radial ripples, droplets catching the light" |
| draws sword | "cloak shifting from the motion, scabbard angle changing at the hip" |

Consequences stay physics-derived. No emotional or aesthetic overlay.

### Modify Video (Ray 2 / Ray Flash 2) — not in GIS

Future-ready. Luma supports V2V via `modes: adhere_1..3 | flex_1..3 | reimagine_1..3`. Prompt register = **end-state description**, NOT commands:

```
❌ "Change the lighting to sunset"
✅ "The scene is bathed in orange-red sunset light, long shadows cast forward"

❌ "Make the character wear a red coat"  
✅ "The character is wearing a red wool coat buttoned to the collar"
```

This is opposite to Grok/WAN 2.7e Edit (command-based). If/when GIS integrates Luma Modify Video, generator switches register for this task.

### Negative prompt

`negative_prompt: null` for all Luma variants (positive-only model).

---

## C.5 — Grok Imagine Video (xAI)

### Architecture

Grok uses direct xAI API (`api.x.ai/v1`). Five task modes share request/poll pattern — submit returns `request_id`, poll `/v1/videos/{id}` until status `done` / `failed` / `expired`. Output URLs are temporary.

- T2V / I2V — `/v1/videos/generations` (image optional first-frame)
- Ref2V — `/v1/videos/generations` with 1-7 reference images (do not combine with main `image` field)
- V2V Edit — `/v1/videos/edits` (source video max 8.7s in, cap 720p out)
- Extend — `/v1/videos/extensions` (2-10s additional, source video max)

Base model is **Aurora** (autoregressive mixture-of-experts, native audio-visual).

### Personality

- Positive-only model (third-party behavior confirmed — no forbidden-words filter like Luma; Grok tolerates all words but ignores negative-framed phrasing)
- Native audio-visual generation
- Sweet spot 5-8 seconds; 15s exhibits more artifacts
- One main subject + one primary action + one camera move preferred (weaker on complex multi-action than Kling/Seedance)

### Prompt template

Natural sentences, NOT keyword lists:

```
[Subject with specific detail] [doing primary action] [in setting with atmosphere]. 
[Camera move or framing]. [Lighting/mood qualifier].
```

### Intensity calibration

Grok tends to amplify vague intensity toward maximum. Generator preserves user-specified intensity, only uplevels vagueness:

- User: *"car drives past"* → Generator: *"a sedan passes at steady city speed"* (not racing)
- User: *"car races past"* → Generator: *"a sports car tears past at high speed, tires screaming"* (preserve racing intensity)
- User: *"muž zaútočí"* (attacks, no intensity marker) → Generator produces measured single strike, not berserker fury

### Reference syntax

Angle brackets, uppercase: `<IMAGE_1>`, `<IMAGE_2>`, up to `<IMAGE_7>` in Ref2V mode.

```
<IMAGE_1> walks through the rain while <IMAGE_2> watches from under an awning.
The camera tracks <IMAGE_1>'s movement, low angle, dim golden streetlight.
```

Positional — order matches `image_references` array upload order.

### Multi-shot

Default OFF per platform master switch. Grok has no explicit multi-shot syntax; when switch is ON and user describes beats, generator concatenates them as continuous sentences with soft connectives ("then", "moments later", "as the scene shifts").

### Audio — `AUDIO:` block universal

Grok reliably parses a terminal `AUDIO:` block. Generator places it as the last line of every prompt (regardless of whether dialogue or audio was mentioned — this is the safest pattern for Grok):

**User dialogue + toggle ON:**
```
AUDIO: 'Konečně jsi tady.' she whispers, voice tight. Rain hissing on metal roof, distant thunder.
```

**No dialogue + toggle ON:**
```
AUDIO: Footsteps on wet pavement, distant traffic hum, wind through empty street.
```

**Toggle OFF (explicit suppression):**
```
AUDIO: no music, no dialogue, ambient only.
```

### Dialogue syntax

`'single quotes'` for Grok (NOT double quotes like Kling/Veo/Seedance). Generator translates user dialogue accordingly.

### V2V Edit prompting

Command-based register:

```
Add / Remove / Swap / Restyle / Scene change / Color change
```

Model preserves everything not mentioned. Short, specific commands:

```
"Restyle the scene in film noir black-and-white, preserving the actor's movement."
"Remove the background crowd, keep the subject and foreground."
"Swap the subject's jacket for a red wool coat."
```

### Extend prompting

Describes **continuation beat**, not total scene. Generator anchors to last observed state ("continuing from the final frame...") then adds the new motion.

### Negative prompt

`negative_prompt: null` (positive-only model).

---

## C.6 — PixVerse

PixVerse has two generations — **C1** and **V6** — that are **fundamentally different products**, not version iterations. They share infrastructure (endpoints, async pattern) but diverge on personality and prompting rules. Generator treats them as separate models with distinct rulebooks.

Common architecture:
- PixVerse Platform API (`app-api.pixverse.ai/openapi/v2`)
- Per-task endpoints: `/video/text/generate`, `/video/img/generate`, `/video/transition/generate`, `/video/fusion/generate`
- Async pattern: `video_id` → status (1=done, 5=waiting, 7=moderation, 8=failed)

### C.6.1 — PixVerse C1

#### Personality

Film production specialist. Design intent: physics-level action, fight choreography, storyboard-to-video workflow. C1 performs automatic shot segmentation internally on longer prompts (splits into implicit beats).

GIS tasks: T2V, I2V, Transition (start/end frame), Fusion (9-panel storyboard-to-video).

#### Prompt template

25-200 words. Front-load important details (model parses sequentially):

```
[Subject with identity detail] [primary action] [in environment with atmospheric cue]. 
[Camera move in prose]. [Mood/lighting/style cues].
```

Natural sentences, not keyword lists.

#### Kinetic / physics emphasis

C1 is the only model in this family where **explicit physics language helps rather than feels contrived**. Generator can lean harder into weight transfer, momentum, impact description for action scenes — C1 renders it.

#### Reference syntax (Fusion only)

`@ref_name` alphanumeric, must match `image_references` array key. Naming rules:

- Use GIS existing internal names (`@ref101`) or user-renamed visual labels
- Generator does NOT invent new reference names
- Sanitization required: strip diacritics, spaces, special characters (PixVerse accepts alphanumeric only)
- Duplicate names → hybrid-mode question
- Empty label → hybrid-mode prompt user for name

```
@ref101 enters the courtyard as @villain steps out from the shadows.
Camera tracks left, keeping both in frame. Rain drumming on cobblestones.
```

#### Multi-shot

Default OFF per platform master switch.

- **T2V / I2V:** C1 automatic shot segmentation is internal — `generate_multi_clip_switch` is NOT supported for these modes (returns 400017 error)
- **Transition:** `generate_multi_clip_switch` is **INVERTED** in C1: `true` = single shot, `false` = multi. Generator does not set this field; it is a GIS payload-level concern (Rule 1), but documented here because the inversion is non-obvious.

When master switch is ON + user described shot breakdown, generator sequences beats in flowing prose. C1 does not use explicit `Shot 1, Shot 2` markers.

#### Camera — prose only

`camera_movement` API field is legacy V5-only and non-functional in C1 (verified). Generator writes camera direction as prose text:

```
"the camera slowly pans left as she walks"
"dolly in to close-up on the clenched fist"
"handheld tracking, shoulder-height, following behind"
```

#### Audio

Native audio via `generate_audio_switch: true/false` (explicit, always set — never implicit default).

- Dialogue in `"double quotes"` (like Kling, Veo, Seedance, WAN — NOT like Grok/Vidu single quotes)
- Inline prose, no `AUDIO:` block
- Diegetic sounds added per Rule 2 when user described producing action

```
"You finally came," he whispers, voice hoarse. Rain hissing on the roof, boots scraping on wet stone.
```

#### Negative prompt

Standard scaffolding (PART B.5 baseline) + task-specific additions.

---

### C.6.2 — PixVerse V6

#### Personality

General cinematic model. Character-consistent, multi-shot native via explicit switch, style presets, native in-frame text rendering, first-person POV specialty.

GIS tasks: T2V, I2V, Transition.

#### Prompt template

Same structure as C1 (25-200 words, front-loaded, natural sentences).

#### Reference syntax

V6 does not have Fusion mode in GIS. References via I2V (single image) or Transition (start + end). No `@ref_name` tagging in V6 — identity is carried by the reference images themselves.

#### Multi-shot

Default OFF per platform master switch. V6 has explicit multi-shot toggle (`generateMultiClipSwitch`). When switch is ON + user described beats:

```
Shot 1, [description of first beat].
Shot 2, [description of second beat].
Shot 3, [description of third beat].
```

`Shot N,` markers are V6 native syntax.

#### Style preset

V6 supports 5 presets: `anime`, `3d_animation`, `clay`, `comic`, `cyberpunk`. One preset per scenario (user UI choice, Rule 1).

Generator **silent-adapts** conflicting style words in the prompt:
- User: *"anime style girl in photorealistic detail"* + preset `anime` → generator drops "photorealistic", keeps anime language
- User sees final prompt in UI and can veto

No warning issued for silent adaptation — user controls the final output.

#### Camera

Same as C1 — `camera_movement` field is deprecated V5-only. Camera direction always in prose text.

#### Text rendering

V6 can render text in-frame. If user requested text (sign, title, subtitle), generator includes it in prompt with quotes:

```
A neon sign flickers above the door reading "RAVEN'S BAR", the letters buzzing in pink and cyan.
```

#### Audio

Same as C1 — `generate_audio_switch` explicit, `"double quotes"` dialogue, inline prose.

#### First-person POV specialty

V6 handles first-person POV better than most models in this family. If user explicitly requests POV shot, generator leans into it:

```
First-person POV: my hands grip the steering wheel, knuckles white. 
The road rushes toward me, wipers slashing across the windshield.
```

#### Negative prompt

Standard scaffolding (PART B.5 baseline) + task-specific additions.

---

## C.7 — WAN (Alibaba)

WAN 2.6 and WAN 2.7 / 2.7e are **fundamentally different models**, not version iterations. They share Alibaba DNA and the "multi-shot storytelling" design orientation but diverge on architecture, audio handling, and reference syntax.

### C.7.1 — WAN 2.6

#### Architecture

Via GIS proxy (`wan/v2.6/*`). Four modes:
- `wan26_t2v` — T2V multi-shot (default `multi_shots: true`)
- `wan26_t2v_single` — T2V single shot (`multi_shots: false`)
- `wan26_i2v` — I2V start frame
- `wan26_r2v_flash` — R2V Flash, 1-5 character refs, native audio (`enable_audio`)

Durations: 5 / 10 / 15 seconds (string). Prompt 2-5000 characters.

#### Personality

- Native audio with automatic lip-sync (EN/ZH optimal; other languages auto-translated)
- Multi-shot storytelling native to the model
- Character consistency across shots
- Chinese + English primary

#### Prompt template

Detailed descriptions encouraged — WAN 2.6 has generous word budget and responds well to rich prose:

```
[Scene setup with atmosphere]. [Subject with identity detail] [primary action in present tense]. 
[Secondary character or environmental motion]. [Camera movement]. [Lighting, mood, style].
```

#### Reference syntax

Inline character tags, no `@`, no brackets:

```
Character1 walks into the tavern. Character2 looks up from the table. 
Character1 and Character2 exchange a look before Character1 sits across from her.
```

Per `wan26_r2v_flash` model — up to 5 refs, label `Character1` through `Character5`.

#### Multi-shot

Default OFF per platform master switch — even for `wan26_t2v` where model default is ON.

- Master switch OFF → generator uses `wan26_t2v_single` (or sets `multi_shots: false` at payload level — GIS concern per Rule 1)
- Master switch ON + user beats → generator writes sequence in flowing prose, model splits internally
- Master switch ON + no user breakdown → fallback to model default auto-split (flagged in hybrid mode)

#### Audio

`enable_audio: true/false` (explicit).

- Dialogue in `"double quotes"` (standard pattern)
- Native lip-sync automatic for EN/ZH; non-EN/ZH dialogue auto-translated by model
- Inline prose audio, no `AUDIO:` block

```
"You came back for me," she says softly, tears welling. Wind whispers through the empty hall.
```

#### Dialogue language warning (Czech users)

When user writes dialogue in non-EN/ZH language (e.g., Czech), generator flags in hybrid mode:

*"Wan 2.6 will auto-translate this dialogue to English or Chinese for lip-sync. For native Czech dialogue, generate silently and use Kling Lipsync with a Czech voice track."*

#### Negative prompt

Standard scaffolding (PART B.5 baseline). WAN 2.6 accepts negative prompts normally.

---

### C.7.2 — WAN 2.7 / 2.7e

#### Architecture

Via fal.ai direct queue (`fal-ai/wan/v2.7/*`). Four modes:
- `wan27_t2v` — T2V, 2-15s, no audio
- `wan27_i2v` — I2V with FLF2V support (start image required, optional end image for first-last-frame video)
- `wan27_r2v` — R2V up to 5 refs (images + videos mixed), no duration field (model chooses)
- `wan27e_v2v` — V2V instruction edit / style transfer

Duration is integer (not string like 2.6). Built on **Diffusion Transformer (DiT) + Full Attention** — processes spatial and temporal relationships across entire sequence, not frame-by-frame.

#### Personality

- No native audio for T2V/I2V (silent unless audio URL provided)
- R2V unique: voice timbre extraction from reference videos
- FLF2V (first-last-frame) native in I2V mode
- Unified editing surface via V2V Edit

#### Prompt template

Same structural approach as WAN 2.6 — generous word budget, rich detail welcomed:

```
[Scene with atmosphere]. [Subject motion in present tense]. [Camera movement]. [Lighting, mood].
```

No multi-shot markers (see below).

#### Reference syntax

Positional, prose form with space (different from Runway `image_1` underscore):

```
The character in Video 1 walks through the garden while Video 2 watches from the bench.
Using Image 1's lighting style, the figure turns toward the camera.
```

Max 5 refs total — up to 3 videos + up to 5 images, but combined ≤ 5 slots.

#### Multi-shot

Default OFF per platform master switch. WAN 2.7 has no explicit `multi_shots` field like 2.6. When master switch is ON + user described beats, generator writes sequential prose — the DiT architecture handles temporal coherence.

#### Audio

- **T2V / I2V:** silent. Generator strips dialogue and audio instructions from prompt. Hybrid mode note: *"Wan 2.7 T2V/I2V generates silent video. For audio, upload separately or use Wan 2.6 / Vidu / Kling variants."*
- **R2V:** voice extraction from reference video. Generator keeps dialogue in prompt (`"double quotes"`) and flags in hybrid mode: *"Wan 2.7 R2V will extract voice timbre from the reference video for this dialogue. To use a different voice, remove the reference video or use Kling Lipsync post-generation."*
- **V2V Edit:** audio is preserved or regenerated per model — user UI choice, generator silent.

#### V2V Edit (2.7e) prompting

Command-based register (like Grok/PixVerse/Runway Aleph Edit):

```
"Change the outfit from blue to red wool coat."
"Replace the sky with a cyberpunk cityscape, preserving character lighting."
"Apply noir black-and-white film grain, keep subject pacing natural."
"Remove the background crowd, keep the foreground intact."
```

Model preserves everything not mentioned. Generator may add explicit preservation directives for elements that must stay ("preserving X", "keeping Y natural") — borrowed from Runway Aleph pattern, safer than relying on implicit preservation.

#### `enable_prompt_expansion` flag

WAN 2.7 (and 2.6) have this flag — when true, model auto-enriches short prompts. Since our generator already produces full-expansion prompts, **this flag should be set to `false` at GIS submit time**. This is GIS payload-level (Rule 1), but documented here because double-expansion degrades output.

#### Negative prompt

Standard scaffolding (PART B.5 baseline). WAN 2.7 accepts negative prompts normally.

---

## C.8 — Vidu Q3 (Shengshu)

### Architecture

Via fal.ai (`fal-ai/vidu/q3/*`). GIS integrates three modes:
- `vidu_q3_t2v` — T2V
- `vidu_q3_i2v` — I2V start frame
- `vidu_q3_frames` — Start + End frame interpolation

Duration integer (`durationInt: true`), audio field `audio`, resolution 720p fixed in GIS. Built on proprietary **U-ViT (Universal Vision Transformer)** architecture engineered for multi-entity consistency.

### Personality — audio-first, multi-shot-native

Vidu has the most distinctive design identity in this family:

- **Audio-first model** — "industry's first long-form AI video model to deliver synchronized audio and video in a single pass". Audio is a core component, not an add-on.
- **16-second single-pass** — longest max duration among all covered models
- **Smart Cuts** — native multi-shot via inline cinematic cues in prompt (no explicit shot markers)
- **Built-in text rendering** — can generate in-frame subtitles, titles, signage
- **Motion Amplitude Control** — API field `motion_amplitude: auto | small | medium | large` (unique tuning, user UI per Rule 1)

### Prompt template — audio is 6th mandatory component

```
Style + Scene + Subject + Motion + Camera + Audio + Text (optional)
```

Unlike other models where audio is situational (generator adds per Rule 2), Vidu **always** has an audio component in the output prompt — even in silent-intent cases (see audio handling below).

### Reference syntax — implicit binding

Vidu does not use positional tags like WAN (`Video 1`) or explicit `@` mentions like Runway/PixVerse Fusion. Model maps identity from references to natural-language subject descriptions in the prompt.

**If GIS integrates Vidu Q3 Reference-to-Video Mix (currently not integrated)**, prompt describes scene in natural language — model auto-distributes identity from 1-4 refs to described subjects. No syntax conversion needed; reference role clarity comes from prose description.

### Multi-shot (Smart Cuts)

Default OFF per platform master switch. When master switch is ON:

- **User described cuts** (hard scene change):
  ```
  A cyber-detective crouches in the alley (wide shot). Cut to close-up of his eyes 
  widening as he finds the data chip. Cut back to wide as he stands and runs.
  ```

- **User described transitions** (continuous camera through spaces):
  ```
  A cyber-detective crouches in the alley, camera slowly pushes in to close-up 
  of his eyes widening. Camera tilts up to reveal the neon skyline above.
  ```

Generator picks `cut to` vs `camera pushes through to` based on user's language — whether they described discrete beats or flowing camera.

### Audio handling

Dialogue in `'single quotes'` (like Grok, NOT double quotes). Specific vocabulary keywords:

- `SFX` — explicit prefix for sound effects
- `BGM` — explicit prefix for background music
- Everything inline in prose (no `AUDIO:` block like Grok)

```
He says, 'This changes everything.' Rain SFX, distant sirens. Tense electronic BGM. 
Cinematic noir lighting, high contrast.
```

### Silent-intent default

When user provided no audio instruction, generator **adds a light ambient layer** — not silence. Vidu's audio-first nature makes total silence unnatural. Add minimal context-appropriate ambient:

- Indoor scene → `faint room tone, soft breath sounds`
- Outdoor scene → `gentle wind through leaves, distant bird calls`
- Night scene → `quiet ambient hum, faint breeze`
- Action scene → `sound of movement, clothing rustle`

No music, no dialog, no loud SFX — just a subtle atmospheric bed that matches Rule 2 spirit (clean voice track preservable) while respecting Vidu's audio-first design.

### Dialogue → action binding

Vidu-specific rule. When user wrote dialogue, generator ensures the speaking character has a concurrent natural physical beat. Static dialogue is a Vidu anti-pattern (degrades lip-sync quality):

- User: *"Žena říká: 'Konečně jsi tady.'"*
- Generator (Vidu):
  ```
  She turns her head, eyes meeting his, and says, 'You're finally here.' 
  Quiet room tone, soft breath before speaking.
  ```

Minimum natural beats: head turn, eyes moving, subtle hand gesture, weight shift. Small movement — not a full action.

### Dialogue language warning

Same as WAN 2.6 — non-EN/ZH dialogue likely translated. Hybrid mode note when user writes Czech dialogue.

### Motion Amplitude awareness

`motion_amplitude` is a user UI field (Rule 1), but generator is aware:
- Setting `small` + generator writing "dramatic weight transfer with explosive force" = conflict
- Setting `large` + generator writing "subtle breathing" = conflict

Generator silent-adapts kinetic intensity to match active `motion_amplitude` when GIS exposes this setting. User sees final prompt in UI and can veto.

### Negative prompt

Standard scaffolding (PART B.5 baseline). Vidu accepts negative prompts.

---

## C.9 — Runway (Gen-4.5, Gen-4 Aleph)

**GIS status: BACKLOG — not integrated.** This section documents the prompting rules so that when integration happens, generator is ready.

### Architecture

Runway has five video models in the Gen-4 family. Recommended GIS integration scope (priority order):

- **Gen-4.5** (primary) — T2V + I2V, 2-10s duration. State-of-the-art motion quality, excels at complex sequenced instructions.
- **Gen-4 Aleph** — V2V Edit (relight, reframe, scene modification).
- **Gen-4 Turbo** (optional) — fast/cheap I2V tier, 10s video in 30s.
- **Gen-4** — legacy I2V flagship, being superseded by 4.5.
- **Act Two** — specialized character performance transfer (niche, skip for initial integration).

API: official `docs.dev.runwayml.com`, alternative wrappers via Replicate (`runwayml/gen4-image`), Scenario, or ComfyUI.

### Personality — MINIMALIST philosophy

Runway is **fundamentally different from every other model in this document**. All other models reward rich detailed prose (Kling 60-80 words, Luma ~100, PixVerse 25-200, WAN 2-5000). Runway rewards **simplicity**:

Runway official guide (verbatim):
- *"Gen-4 thrives on prompt simplicity."*
- *"Use positive phrasing and avoid negative prompts."*
- *"Refer to subjects in general terms, like 'the subject'."*

Anti-pattern vs good pattern from Runway docs:
- ❌ *"The tall man with black hair wearing a blue business suit and red tie reaches out his hand for a handshake"*
- ✅ *"The man extends his arm to shake hands, then nods politely."*

**Generator for Runway DOWNSCALES** instead of expanding. Word budget: **30-60 words typical**, not 100+.

### Positive-only model

Third positive-only model in this family (after Luma and Grok). Generator emits `negative_prompt: null`. Unlike Luma, Runway has no forbidden-words filter — it is positive-only in structure (no negative framing), not specific vocabulary.

### Prompt template — 4 components

```
[Subject motion]. [Camera motion]. [Scene motion]. [Style descriptor].
```

Keep each component short. Build on success — if a simple prompt works, user iterates by adding one element at a time.

### Reference syntax

Two variants, both work in prompt:

1. **Saved references** (Runway Reference Library): `@name`
   - User-assigned names in Runway UI
   - Example: `@hero`, `@villain`, `@forest_location`

2. **Positional references**: `image_1`, `image_2`, `image_3`
   - **Underscore notation** (different from WAN `Image 1` with space)
   - Per upload order

**Max 3 references** (less than PixVerse 7, WAN 2.7 5, Grok 7).

Mixed example:
```
@hero walks through @forest_location. Camera tracks from behind. 
Mist drifts between the trees. Cinematic, shallow depth of field.
```

### I2V specific — motion-only prompt

When reference image is provided (I2V mode), prompt describes **motion only**, NOT subject description. Image carries visual; prompt carries time.

- ❌ *"The tall woman with red hair and black dress walks through the door"* (subject already in image)
- ✅ *"The woman walks through the door, then turns her head toward the camera"*

Generator omits subject appearance details entirely for Runway I2V — only motion beats.

### Camera motion — structural priority

Gen-4.5 has excellent prompt adherence on camera choreography. Format from Runway docs:

```
"The camera [motion] as the subject [action]"
```

Generator places camera description **first or second** in prompt (not at the end like other models). Examples from official Runway guide:

```
"A horizontal pan, from a fixed point, sweeps left to right across pine trees and 
over a lake to end on a single rowboat docked nearby"

"A tilt up shot begins on the weathered cobblestones of an ancient city street, 
slowly rising to showcase the intricate architectural details of centuries-old buildings, 
then continues upward to reveal a vast, clear blue sky"

"A dolly backward shot smoothly follows a lone figure walking down a dimly lit, narrow alleyway"
```

### Sequential instructions — native multi-shot

Gen-4.5 excels at temporal ordering. When master switch is ON + user described beats:

```
First, the subject walks to the window. Then, they pick up a book. 
Finally, the camera pushes in as they begin to read.
```

`first... then... finally...` syntax is native. No explicit cut markers needed — Gen-4.5 handles temporal coherence.

When master switch is OFF (platform default), generator writes single-action prompt without temporal markers.

### No command-based prompts

Official: *"command-based prompts that request changes often lack the descriptions needed to convey how an element should behave."*

- ❌ *"add fog to the scene"*
- ✅ *"Fog rolls in slowly from the edges of the frame"*

- ❌ *"remove the person"*
- ✅ *"The person walks out of frame to the left"*

For T2V / I2V, generator **never issues commands** — always describes behavior.

### No conversational elements

*"Conversational elements waste valuable prompt space."* No "please", no "can you", no "I'd like to see". Direct descriptive prose only.

### Audio — SEPARATE TOOL (not in video generation)

Runway video models **do not generate audio**. Runway has a separate "Audio" tab that generates SFX / ambient music from text descriptions — this is a post-process, not in-generation.

Generator for Runway video:
- **Strips all audio instructions** from user input (dialogue, SFX, BGM, ambient)
- Emits `negative_prompt: null`
- No `'quotes'` for dialogue
- No `SFX:`, no `BGM:`, no `AUDIO:` block

Hybrid mode note when user wrote dialogue or audio intent:

*"Runway video models don't generate audio. Your audio mentions will be omitted from the prompt. Generate video first, then use Runway's separate Audio feature or add audio in post-production."*

Exception: **Lip Sync & Audio Integration** is a Runway UI feature that syncs pre-generated video with uploaded audio (TTS or file). This is separate workflow, out of generator scope.

### V2V Edit (Gen-4 Aleph) prompting

Command-based register with **explicit preservation directives**. Official Runway example:

```
Change the camera to a wider angle that reveals the full body.
Re-light the scene with colder blue tones and stronger reflections on the glass.
Keep the subject's movement natural and preserve the original pacing.
```

Pattern:
- `Change X to Y` — specific transformation
- `Re-light / Re-frame / Re-color` — task-specific verbs
- **`Keep X natural`** / **`Preserve Y`** — explicit preservation directives (unique to Runway, safer than implicit preservation)

Generator adds at least one preservation directive when the edit is substantial. This is a Runway best practice — other V2V Edit models (Grok, PixVerse, WAN 2.7e) use implicit preservation; Runway codifies it.

### Unique UI features (out of generator scope, per Rule 1)

- **Motion Brush 3.0** — paint areas to direct movement (vector-based)
- **Director Mode** — node-based dynamic camera choreography (zoom/pan/tilt/truck over time)
- **Lip Sync & Audio Integration** — sync pre-generated video with audio
- **Motion Bucket** — intensity tuning setting

These are UI tools. Generator does not interact with them. Informational for user education only.

### Negative prompt

`negative_prompt: null` (positive-only model).

---

## PART D — Task routing and payload structures

### D.1 — Task classification logic

```
Input signals → Task classification

Only text, no references:
  └→ T2V

One image, no end image, no multi-ref:
  └→ I2V
      └ Bind Subject toggle applicable when: complex motion detected
      
One image + end image:
  └→ Start/End Frame
  
Multiple images (2-4 for Kling, 2-9 for Seedance, 2-3 for Veo):
  └→ Multi-reference / Elements / Reference-to-Video
      └ Assign roles via vision pass + hybrid question if ambiguous
      
Video reference as input:
  └→ V2V (Kling O3) / Motion Transfer / Video Edit / Video Extend (Seedance)
  └→ Extend only (Veo 3.1, Kling)
  
Audio input + video:
  └→ Lipsync (Kling)
  
Audio reference in generation:
  └→ Audio-driven (Seedance omni — only if user requested audio-synced content)
```

### D.2 — Generator output contract

For every generation task (except Lipsync), generator returns three artifacts:

```
{
  positive_prompt: "<transformed prompt text>",
  negative_prompt: "<auto-filled per task rules>",  // null for Veo if using positive reformulation
  payload_elements: {
    // Task-specific payload hints for GIS code
    task_type: "t2v" | "i2v" | "i2v_bind" | "elements" | "start_end" | "v2v" | "motion_transfer" | "video_edit" | "video_extend" | "reference_to_video" | "extend",
    references: [
      {
        slot: "subject" | "style" | "environment" | "material" | "motion" | "audio",
        source: "image" | "video" | "audio",
        url: "<asset url>",
        role_description: "<for Veo weight distribution or Seedance role assignment>"
      }
    ],
    elements_to_use: [<element_id>],  // Kling elements only
    voice_ids_needed: [<voice_id>]    // Kling only
  }
}
```

For Lipsync:
```
{
  positive_prompt: null,
  negative_prompt: null,
  payload_elements: {
    task_type: "lipsync",
    video_url: "<source>",
    audio_url: "<user audio>" | null,
    text: "<preprocessed>" | null,
    voice_id: "<id>" | null,
    face_id: "<from identify_face>" | null,
    sound_start_time: <ms> | null,
    sound_end_time: <ms> | null
  }
}
```

### D.3 — Asset management requirements for GIS

Two new asset stores needed in GIS:

**Character Library (Elements)**
```
{
  element_id: "elem_xxx",
  name: "<user-provided>",
  description: "<auto-generated from vision pass>",
  reference_thumbnails: [<image urls>],
  source_type: "images" | "video",
  bound_voice_id: "voice_xxx" | null,
  created_at: ISO_timestamp,
  last_used_at: ISO_timestamp,
  model_compatibility: ["kling-v3", "kling-o1"]  // which models the element works with
}
```

**Voice Library**
```
{
  voice_id: "voice_xxx",
  name: "<user-provided>",
  source_audio_url: "<reference>",
  language: "en" | "cs" | "zh" | ...,
  bound_to_element_id: "elem_xxx" | null,
  created_at: ISO_timestamp
}
```

Recommended GIS UI section: "Character Library" accessible from main toolbar, listing all elements with thumbnails and bound voices. Separate "Voice Library" or integrated sub-view.

### D.4 — Vision pass integration

When references are present, generator calls OpenRouter (primary) or Gemini Flash (fallback) with:

**Request structure:**
```
System: "You are a reference analyzer for video generation. Extract structured metadata 
from the provided image. Return JSON with: subject_identity, pose, wardrobe, 
lighting_direction, lighting_quality, color_temperature, framing_shot_size, 
environment, mood, distinctive_features."

User: [image] + "Analyze this reference for video generation prompt."
```

Return: structured JSON used internally by generator for:
- Continuity anchor construction
- Reference role assignment
- Delta computation (start/end)
- Validation of user's described action against reference pose

### D.5 — System prompt structure for OpenRouter call

The OpenRouter Claude Sonnet 4.6 instance operates with a dynamic system prompt that has three layers:

```
Layer 1 (constant): PART A — Global rules + PART B — Cross-model principles

Layer 2 (model-dependent): PART C for active model only 
  — injected based on current GIS model selection

Layer 3 (task-dependent): specific templates from PART C for detected task
  — injected based on classification

User message: <user's raw input> + <vision pass results as structured context>

Assistant output: {positive_prompt, negative_prompt, payload_elements}
```

This keeps context window efficient — no need to load all three models' rules when only one is active.

### D.6 — Error handling and fallbacks

| Condition | Fallback |
|---|---|
| Vision pass fails | Proceed without vision context, warn in hybrid mode |
| OpenRouter unreachable | Gemini Flash fallback (loses some quality on cinematic grammar) |
| Veo reference-to-video returns 400 | Retry as I2V with first reference as start frame |
| User provides style ref for Veo 3.1 | Translate to text, warn user |
| User provides 4+ refs for Veo | Use first 3, warn user, ask which to drop |
| User provides 5+ refs for Kling Elements | Use first 4, warn |
| Seedance cannot combine frame-guided + omni | Ask user which mode takes priority |
| Kling lipsync: multiple faces, no face_id | Call identify_face, show UI picker |
| Non-EN/ZH dialogue on Seedance | Warn about translation, offer Kling Lipsync path |

---

## PART E — Maintenance and iteration notes

### E.1 — When model APIs change

All three models evolve fast. Generator should be robust to:
- Parameter renames (`end_image_url` vs `tail_image_url` vs `last_image`)
- Reference syntax changes (`@Image1` vs `[Image1]` — test both)
- New reference types (Veo may add style back in 3.2+)
- Endpoint path changes (fal.ai and provider updates)

Isolate API-specific mappings in a per-model adapter layer. PART C rules should remain stable even when PART D mappings change.

### E.2 — Testing after changes

When modifying generator rules:
1. Smoke test each task per model (T2V, I2V, Start/End minimum)
2. Verify negative prompt layering still correct
3. Verify no audio injection crept back in (Rule 2)
4. Verify no technical parameter suggestions (Rule 1)
5. Verify @mention syntax resolves correctly in Kling/Seedance

### E.3 — Hybrid mode calibration

Monitor user frustration signals:
- Do users frequently override generator's transformations? → transformation rules may be over-aggressive
- Do users frequently edit prompts post-generation? → extraction rules may be missing intent
- Do users complain about unexpected audio/music? → Rule 2 is leaking somewhere
- Do users get too many questions? → hybrid mode triggers too loose

Calibrate thresholds based on signals. Start conservative (more questions), loosen as patterns stabilize.

---

## PART F — Implementation checklist for GIS

- [ ] Create `ai-video-prompt.js` module (alongside existing `ai-prompt.js`)
- [ ] Add per-model system prompt assembly (PART A + PART B + active model's PART C)
- [ ] Wire OpenRouter call with vision pass for references
- [ ] Implement task classification logic (PART D.1)
- [ ] Build Character Library UI and asset store (PART D.3)
- [ ] Build Voice Library UI and asset store (PART D.3)
- [ ] Integrate generator output into existing video generation payload flow
- [ ] Add "Add background audio/mood" UI toggle (default OFF) — exposes Rule 2 control
- [ ] Add fallback chains per PART D.6
- [ ] Document in STAV.md and API_MODELS.md
- [ ] Smoke test per model, per task type

---

**End of document. Scope: Kling V3+O3, Seedance 2.0, Veo 3.1.**
**Next session: extend with Luma, Grok Imagine, PixVerse, WAN 2.7, Vidu, Hailuo, Runway Gen-4.**
