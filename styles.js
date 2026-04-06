// ═══════════════════════════════════════════════════════
// STYLES SYSTEM
// ═══════════════════════════════════════════════════════

const STYLE_CATS = {
  film_color:   '🎬 Film Colors',
  photo_light:  '💡 Light',
  art:          '🎨 Art Styles',
  animation:    '🌸 Animation & Illus.',
  mood:         '🌙 Mood',
  director:     '🎥 Directors',
  film_ref:     '🎞 Film Patterns',
  photo_stock:  '📷 Film stocks',
};

// Barvy nadpisů kategorií — [bg, text, line]
const STYLE_CAT_COLORS = {
  film_color:  ['rgba(220, 80,  60, .18)', '#e87060', 'rgba(220,80,60,.5)'],
  photo_light: ['rgba(220,180,  0, .18)', '#d4b820', 'rgba(220,180,0,.5)'],
  art:         ['rgba(230,110, 40, .18)', '#e07830', 'rgba(230,110,40,.5)'],
  animation:   ['rgba(220, 80,150, .18)', '#e060a0', 'rgba(220,80,150,.5)'],
  mood:        ['rgba( 90, 80,200, .18)', '#8878d4', 'rgba(90,80,200,.5)'],
  director:    ['rgba( 30,160,200, .18)', '#38b8d8', 'rgba(30,160,200,.5)'],
  film_ref:    ['rgba(130, 60,200, .18)', '#9868d4', 'rgba(130,60,200,.5)'],
  photo_stock: ['rgba( 60,180,120, .18)', '#40c888', 'rgba(60,180,120,.5)'],
};

const STYLES = [
  // ── Filmové barvy & grade ──
  { id:'teal_orange', num:1,    cat:'film_color', name:'Teal & Orange',      desc:'Complementary cinematic contrast — cool shadows, warm orange highlights on subjects',
    visual:'teal and orange color grading, cool teal shadows, warm orange highlights on subjects',
    full:'teal and orange color grading, cool teal shadows, warm orange highlights on subjects, cinematic complementary contrast, blockbuster color palette' },
  { id:'cross_process', num:2,  cat:'film_color', name:'Cross-Process',       desc:'Shifted color channels, oversaturated greens and purples, high contrast — chemical alternative process',
    visual:'cross-processed color shifts, oversaturated greens and magentas, high contrast, chemical color distortion',
    full:'cross-processed film look, shifted color channels, oversaturated greens and magentas, high contrast, unpredictable chemical aesthetic, lo-fi experimental' },
  { id:'faded_film', num:3,     cat:'film_color', name:'Faded Film',          desc:'Faded blacks, lifted shadows, bleached retro palette — like old film after decades',
    visual:'lifted blacks, faded desaturated midtones, vintage washed-out color, soft shadow detail',
    full:'faded film stock look, lifted blacks, desaturated midtones, vintage washed-out color, nostalgic aged quality, soft shadow detail, retro color decay' },
  { id:'bleach_bypass', num:4,  cat:'film_color', name:'Bleach Bypass',       desc:'Silver retention, reduced saturation, high contrast — luminescent highlights over deep blacks',
    visual:'silver retention bleach bypass, reduced saturation, high contrast, luminous highlights, deep blacks',
    full:'bleach bypass chemical process, silver retention, desaturated colors, intense contrast, luminous highlights over rich deep blacks, gritty cinematic texture' },
  { id:'day_for_night', num:5,  cat:'film_color', name:'Day-for-Night',       desc:'Blue tint and underexposure simulating a night shot filmed in daylight — classic film technique',
    visual:'blue-tinted shadows, underexposed moonlight simulation, cool deep shadows, night look',
    full:'day-for-night shooting technique, strong blue tint, underexposed darks, simulated moonlight, cool shadow palette, classic cinematic night simulation' },
  { id:'bronze_skin', num:6,    cat:'film_color', name:'Bronze Skin',         desc:'Warm golden-brown grade — rich amber highlights on skin, cinematic commercial look',
    visual:'warm golden-brown color grade, rich amber highlights, cinematic skin warmth',
    full:'warm bronze color grade, golden-brown tones, rich amber highlights on skin, commercial cinematic warmth, editorial beauty look' },
  { id:'cool_matte', num:7,     cat:'film_color', name:'Cool Matte',          desc:'Flat desaturated grade, gray midtones — modern editorial look without drama',
    visual:'flat desaturated matte grade, grey midtones, muted palette, modern editorial look',
    full:'cool flat matte grade, desaturated colors, grey lifted midtones, contemporary editorial aesthetic, understated cinematic palette' },
  { id:'analog_warmth', num:8,  cat:'film_color', name:'Analog Warmth',       desc:'Subtle film grain, warm shadows, organic film texture — Kodachrome richness',
    visual:'fine film grain, warm lifted shadows, organic film texture, kodachrome richness',
    full:'analog film warmth, fine grain texture, warm lifted shadows, rich Kodachrome-inspired color, organic film aesthetic, nostalgic tactile quality' },
  { id:'hc_bw', num:9,          cat:'film_color', name:'High Contrast B&W',   desc:'Deep blacks, blown highlights, sharp tonal separation — graphic monochromatic power',
    visual:'deep blacks, blown highlights, stark tonal separation, graphic monochrome',
    full:'high contrast black and white, crushed shadows, stark tonal separation, graphic monochrome, dramatic chiaroscuro, bold silver gelatin quality' },
  { id:'infrared', num:10,       cat:'film_color', name:'Infrared',             desc:'White vegetation, dark sky, silver halation — surreal light inversion in nature',
    visual:'white glowing foliage, dark dramatic sky, silver halation, surreal luminous landscape',
    full:'infrared photography aesthetic, white glowing vegetation, very dark sky and water, silver halation on light sources, otherworldly surreal natural light' },

  // ── Světlo ve fotografii ──
  { id:'golden_hour', num:11,    cat:'photo_light', name:'Golden Hour',         desc:'Low sun, warm backlight, long soft shadows, amber atmospheric glow at the edges',
    visual:'low-angle warm backlight, long soft shadows, amber atmospheric haze, rimlit subjects',
    full:'golden hour lighting, warm low-angle backlight, long soft shadows, amber atmospheric haze, rimlit or silhouetted subjects, intimate nostalgic mood' },
  { id:'blue_hour', num:12,      cat:'photo_light', name:'Blue Hour',           desc:'Deep twilight blue, city lights beginning to glow, cool shadows, sky-to-ground transition',
    visual:'deep dusk blue, city lights emerging, cool shadows, sky-to-ground gradient',
    full:'blue hour twilight, deep blue atmospheric dusk, city lights beginning to glow, cool shadows, luminous sky-to-ground gradient, urban magical hour' },
  { id:'rembrandt', num:13,      cat:'photo_light', name:'Rembrandt Light',      desc:'Triangle of light on a shadowed face, dramatic portrait lighting — Dutch Golden Age',
    visual:'triangle catchlight on shadow-side cheek, deep shadow one side, dramatic portrait lighting',
    full:'Rembrandt portrait lighting, triangle of light on shadow cheek, deep dramatic shadows, single warm light source, Dutch master portrait quality' },
  { id:'hard_side', num:14,      cat:'photo_light', name:'Hard Side Light',      desc:'Single hard side source, sharp shadow edges, strong directional drama',
    visual:'single hard light source, razor-sharp shadow edges, strong directional drama',
    full:'hard side lighting, single directional source, razor-sharp shadow edges, strong dramatic contrast, sculptural light revealing form and texture' },
  { id:'soft_box', num:15,       cat:'photo_light', name:'Soft Box',             desc:'Even diffuse studio light, minimal shadows, clean commercial look',
    visual:'even diffused studio light, minimal soft shadows, clean commercial look',
    full:'soft box studio lighting, even diffused illumination, minimal soft shadows, clean commercial photography aesthetic, professional product and portrait light' },
  { id:'chiaroscuro', num:16,    cat:'photo_light', name:'Chiaroscuro',          desc:'Extreme light-dark contrast, Caravaggio style — figures emerging from deep darkness',
    visual:'extreme light-dark contrast, Caravaggio style, subjects emerging from deep black background',
    full:'chiaroscuro lighting, extreme contrast of light and shadow, subjects dramatically emerging from deep darkness, Baroque old master painting quality' },
  { id:'neon_night', num:17,     cat:'photo_light', name:'Neon Night',           desc:'Colored artificial light sources, wet reflective surfaces, multi-colored urban glow at night',
    visual:'colored artificial light sources, wet reflective surfaces, urban multicolor glow',
    full:'neon night photography, multiple colored light sources, wet pavement reflections, urban glow, deep shadows with vivid color pockets, cyberpunk lighting' },
  { id:'backlight_haze', num:18, cat:'photo_light', name:'Backlight Haze',       desc:'Subject rimlit by backlight, atmospheric lens flare, ethereal air translucency',
    visual:'subject haloed by strong backlight, atmospheric lens flare, ethereal translucency',
    full:'backlight with atmospheric haze, glowing halo around subjects, ethereal translucency, lens flare, dreamy backlit quality, light diffusion through atmosphere' },
  { id:'overcast_flat', num:19,  cat:'photo_light', name:'Overcast Flat',        desc:'Diffuse overcast light, no shadows, soft even tones — ideal for texture detail',
    visual:'diffused overcast cloudlight, shadowless soft illumination, gentle even tones',
    full:'overcast diffused daylight, no harsh shadows, soft even illumination, gentle tonal gradients, quiet contemplative quality, photographic clarity' },

  // ── Výtvarné styly ──
  { id:'oil_paint', num:20,      cat:'art', name:'Oil Painting',        desc:'Visible brushstrokes, impasto texture, rich pigment depth — classic painting medium',
    visual:'visible thick brushstrokes, impasto texture, rich pigment depth, classical painting medium',
    full:'oil painting medium, visible thick impasto brushstrokes, rich pigment depth, layered glazes, classical painting quality, canvas texture, old master or impressionist style' },
  { id:'watercolor', num:21,     cat:'art', name:'Watercolor',           desc:'Translucent color layers, wet blooming edges, soft washes, visible paper texture',
    visual:'translucent color layers, wet bloom edges, soft washes, paper texture visible',
    full:'watercolor painting, translucent overlapping washes, wet bloom at edges, soft flowing color, paper grain visible, delicate spontaneous quality' },
  { id:'ink_wash', num:22,       cat:'art', name:'Ink Wash',             desc:'East Asian ink technique, diluted ink gradients, decisive gestural strokes, empty space',
    visual:'East Asian brush technique, diluted ink gradients, decisive gestural strokes, empty negative space',
    full:'East Asian ink wash painting, sumi-e technique, diluted ink gradients, decisive gestural brushwork, meaningful empty space, calligraphic energy, zen simplicity' },
  { id:'gouache', num:23,        cat:'art', name:'Gouache',              desc:'Matte opaque paint, poster flatness, graphic solidity — mid-century illustration',
    visual:'opaque flat color, matte surface, poster-like simplicity, graphic solidity',
    full:'gouache painting, opaque flat color areas, matte finish, graphic poster quality, mid-century illustration aesthetic, bold simplified forms' },
  { id:'pencil_sketch', num:24,  cat:'art', name:'Pencil Sketch',        desc:'Hatching lines, graphite texture, unfinished edges, tonal gradients through line density',
    visual:'cross-hatching lines, graphite texture, unfinished edges, tonal gradients through line density',
    full:'pencil sketch drawing, cross-hatching for shading, graphite texture, sketch-like unfinished quality, visible construction lines, hand-drawn energy' },
  { id:'linocut', num:25,        cat:'art', name:'Linocut',              desc:'Bold carved lines, limited block colors, rough print texture, high contrast',
    visual:'bold carved lines, limited color blocks, rough print texture, high contrast',
    full:'linocut print, bold carved line work, limited flat color palette, rough print texture, graphic contrast, handmade printmaking quality' },
  { id:'risograph', num:26,      cat:'art', name:'Risograph',            desc:'Color overlay misprint, heavy grain, indie print aesthetic, two-color overlap',
    visual:'layered color misregistration, coarse halftone grain, indie print aesthetic, two-tone color overlap',
    full:'risograph printing aesthetic, slightly misregistered colors, coarse halftone grain, limited ink palette, indie zine quality, textured paper feel' },
  { id:'woodblock', num:27,      cat:'art', name:'Woodblock Print',      desc:'Ukiyo-e flat surfaces, decorative line outlines, limited palette, Japanese woodblock print style',
    visual:'Ukiyo-e flat color planes, decorative line outlines, limited palette, Japanese woodblock print style',
    full:'Japanese woodblock print, Ukiyo-e tradition, flat color planes separated by clean outlines, decorative line work, limited bold palette, Hiroshige or Hokusai quality' },
  { id:'charcoal', num:28,       cat:'art', name:'Charcoal',             desc:'Smudged dark tones, rough paper texture, gestural strokes, subtle tonal softness',
    visual:'smudged dark tones, rough paper grain, gestural marks, tonal softness',
    full:'charcoal drawing, smudged dark tones, rough paper texture, gestural expressive marks, soft tonal gradients, raw drawing energy' },
  { id:'matte_paint', num:29,    cat:'art', name:'Digital Matte Painting', desc:'Kinematografická malba prostředí, fotorealistická fantasy pozadí — epická světová scéna',
    visual:'cinematic environment painting, photorealistic fantasy backgrounds, epic scale painted world',
    full:'digital matte painting, cinematic environment art, photorealistic fantasy world, epic scale, seamless blend of photography and painting, film VFX aesthetic' },
  { id:'pastel', num:30,         cat:'art', name:'Pastel Softness',       desc:'Chalky texture, dreamy color gradients, light tonality, softly diffuse edges',
    visual:'chalk texture, dreamy color blends, light tonality, soft diffused edges',
    full:'soft pastel artwork, chalk texture, dreamy blended colors, light airy tonality, soft diffused edges, romantic gentle quality' },
  { id:'stained_glass', num:31,  cat:'art', name:'Stained Glass',         desc:'Bold lead lines separating color fields, oversaturated jewel tones, mosaic geometry',
    visual:'bold leading lines dividing color fields, jewel-toned saturated light, mosaic geometry',
    full:'stained glass aesthetic, bold lead line outlines, jewel-toned saturated colors, luminous light through color, mosaic geometry, Gothic cathedral quality' },

  // ── Animační & ilustrační styly ──
  { id:'ghibli', num:32,         cat:'animation', name:'Studio Ghibli',        desc:'Soft watercolor backgrounds, expressive detailed characters, lush nature, atmospheric motion — Miyazaki',
    visual:'soft watercolor backgrounds, expressive detailed characters, lush natural environments, Miyazaki style',
    full:'Studio Ghibli animation style, soft watercolor background painting, expressive character detail, lush verdant natural environments, warm nostalgic atmosphere, Miyazaki magical realism' },
  { id:'pixar', num:33,          cat:'animation', name:'Pixar 3D',              desc:'Rounded smooth forms, expressive facial animation, warm studio lighting, rich cinematic color',
    visual:'rounded smooth 3D forms, expressive facial performance, warm studio lighting, vibrant color',
    full:'Pixar 3D animation aesthetic, rounded smooth forms, highly expressive facial performance, warm cinematic lighting, vibrant saturated color, appealing character design' },
  { id:'shonen_anime', num:34,   cat:'animation', name:'Anime Shonen',          desc:'Dynamic lines, speed lines, bold flat color, expressive manga energy and motion',
    visual:'dynamic line work, speed lines, bold flat color, expressive manga energy',
    full:'shonen manga anime style, dynamic line work, speed lines, bold flat color, expressive energy, dramatic action poses, shounen visual language' },
  { id:'shinkai', num:35,        cat:'animation', name:'Makoto Shinkai',         desc:'Hyper-realistic light rendering, urban melancholy, detailed sky gradients, cinematic bokeh',
    visual:'hyperrealistic light rendering, urban melancholy, detailed sky gradients, cinematic bokeh',
    full:'Makoto Shinkai animation style, hyperrealistic light and atmospheric detail, urban melancholy, stunning sky gradients, photorealistic backgrounds, emotional visual poetry' },
  { id:'retro_anime', num:36,    cat:'animation', name:'Retro 80s Anime',       desc:'Subtle film grain, limited cel palette, VHS color bleeding, nostalgic cel animation',
    visual:'soft film grain, limited cel color palette, VHS color bleed, nostalgic cel animation style',
    full:'retro 1980s anime aesthetic, limited cel color palette, soft film grain, VHS color bleed, nostalgic hand-drawn quality, vintage Japanese animation look' },
  { id:'franco_belgian', num:37, cat:'animation', name:'Belgian Comic',          desc:'Clean Franco-Belgian lines, Hergé style without texture, solid color fills — Tintin clarity',
    visual:'clean Franco-Belgian ligne claire line art, flat color fills, Hergé-style clarity',
    full:'Franco-Belgian ligne claire comic style, clean precise line work, flat unshaded color fills, Hergé Tintin aesthetic, clear visual storytelling, European album quality' },
  { id:'american_comic', num:38, cat:'animation', name:'American Comic',         desc:'Ben-Day dots, bold ink outlines, dynamic poses, primary color palette — Marvel/DC',
    visual:'Ben-Day dot patterns, bold ink contours, dynamic poses, primary color palette',
    full:'American superhero comic book style, Ben-Day halftone dots, bold ink contours, dynamic heroic poses, primary color palette, Jack Kirby or Neal Adams energy' },
  { id:'flat_illus', num:39,     cat:'animation', name:'Flat Illustration',      desc:'Geometric minimal shapes, solid color fills, no shadows — contemporary vector style',
    visual:'geometric minimal shapes, solid color fills, no shadows, contemporary vector style',
    full:'flat vector illustration style, geometric simplified shapes, solid color fills, no gradients or shadows, contemporary graphic design aesthetic, clean modern look' },
  { id:'surrealist_illus', num:40, cat:'animation', name:'Surrealist Illustration', desc:'Illogical object combinations, dreamlike spatial logic, Dalí-esque hyperreality — physically impossible',
    visual:'impossible object combinations, dreamlike spatial logic, Dalí-esque hyper-rendered unreality',
    full:'surrealist illustration, impossible dreamlike combinations, Dalí-esque hyper-rendered unreality, melting objects, illogical spatial relationships, subconscious visual poetry' },
  { id:'cottagecore_illus', num:41, cat:'animation', name:'Cottagecore Illustration', desc:'Hand-painted botanical detail, warm earthy palette, whimsical fairy-tale book illustration',
    visual:'hand-painted botanical detail, warm earthy palette, whimsical storybook warmth',
    full:'cottagecore illustration style, hand-painted botanical detail, warm earthy natural palette, whimsical storybook quality, folk art charm, cozy domestic nature imagery' },

  // ── Nálada & atmosféra ──
  { id:'noir', num:42,           cat:'mood', name:'Noir',                desc:'Deep shadow pools, venetian blind patterns, smoke, moral ambiguity — wet streets',
    visual:'deep shadow pools, venetian blind light patterns, smoke, moral ambiguity, wet streets',
    full:'film noir aesthetic, deep shadow pools, venetian blind light stripes, cigarette smoke, rain-wet streets, moral ambiguity, urban decay, classic detective atmosphere' },
  { id:'dreamcore', num:43,      cat:'mood', name:'Dreamcore',           desc:'Hazy nostalgic unreality, liminal space, slightly shifted color, quiet uncanny closeness',
    visual:'hazy nostalgic unreality, liminal space, slightly off-color, quiet eerie familiarity',
    full:'dreamcore aesthetic, hazy nostalgic atmosphere, slightly uncanny and familiar, liminal transitional quality, soft eerie unreality, memory-like blurred spaces' },
  { id:'epic_fantasy', num:44,   cat:'mood', name:'Epic Fantasy',        desc:'Dramatic light rays through clouds, majestic scale, heroic light — grandeur and magnificence',
    visual:'dramatic god-rays through clouds, majestic scale, heroic warm light, sweeping grandeur',
    full:'epic fantasy atmosphere, dramatic volumetric god-rays through storm clouds, majestic monumental scale, heroic warm light, sweeping landscape grandeur, mythic awe' },
  { id:'solarpunk', num:45,      cat:'mood', name:'Solarpunk',           desc:'Lush green overgrowth, bright optimistic light, organic solar technology — green utopia',
    visual:'lush green overgrowth, bright optimistic light, organic solar technology, hopeful utopia',
    full:'solarpunk aesthetic, abundant green overgrowth on buildings, bright optimistic sunlight, organic sustainable technology, hopeful cooperative utopia, biomimetic architecture' },
  { id:'melancholic', num:46,    cat:'mood', name:'Melancholic',         desc:'Muted gray palette, empty negative space, overcast silence — quiet solitude',
    visual:'muted grey palette, empty negative space, overcast stillness, quiet loneliness',
    full:'melancholic atmosphere, muted desaturated grey palette, vast empty negative space, overcast diffused light, profound stillness, quiet solitary contemplation' },
  { id:'cozy', num:47,           cat:'mood', name:'Cozy',                desc:'Warm window light, gentle textures, candlelight reflection — intimate and safe atmosphere',
    visual:'warm window light, soft textures, candle glow, intimate safe atmosphere',
    full:'cozy hygge atmosphere, warm soft window light, gentle textured fabrics, candle or firelight glow, intimate safe space, quiet domestic comfort, welcoming warmth' },
  { id:'horror_dread', num:48,   cat:'mood', name:'Horror Dread',        desc:'Cold desaturated shadows, subtle distortion, supernatural silence — creeping unease and dread',
    visual:'cold desaturated shadows, subtle distortion, unnatural silence, creeping unease',
    full:'horror dread atmosphere, cold desaturated shadows, subtle visual distortion, unnatural stillness, creeping psychological unease, something deeply wrong, existential dread' },
  { id:'sublime', num:49,        cat:'mood', name:'Sublime Nature',      desc:'Human figure dwarfed by landscape, overwhelming scale, Turner dramatic sky — the sublime',
    visual:'human figure dwarfed by landscape, overwhelming scale, Turner-esque dramatic sky',
    full:'natural sublime, tiny human figure overwhelmed by vast landscape, dramatic Turner-esque sky, awe-inspiring scale, Romantic era nature worship, elemental power' },
  { id:'cyberpunk', num:50,      cat:'mood', name:'Cyberpunk',           desc:'Neon reflections in rain, vertical light trails, dense urban layers — high tech low life',
    visual:'neon rain reflections, vertical light streaks, dense urban layers, high-tech low-life',
    full:'cyberpunk aesthetic, neon light reflections in rain, dense layered urban environment, holographic advertisements, high-tech low-life contrast, dystopian future city' },
  { id:'brutalist', num:51,      cat:'mood', name:'Brutalist Cold',      desc:'Raw concrete, empty post-Soviet scale, oppressive geometry — cold monumentality',
    visual:'raw concrete texture, grey monolithic forms, empty Soviet-scale space, oppressive geometry',
    full:'brutalist cold atmosphere, raw concrete surfaces, massive monolithic Soviet-scale architecture, oppressive empty geometry, grey dehumanizing scale, Eastern European bleakness' },
  { id:'vaporwave', num:52,      cat:'mood', name:'Vaporwave',           desc:'Pastel neon gradient, retro 80s computer graphics, marble columns — digital nostalgia',
    visual:'pastel neon gradient, retro 80s computer graphics, marble columns, nostalgic digital',
    full:'vaporwave aesthetic, pastel neon pink and purple gradients, retro 80s computer graphics, classical marble elements, glitch effects, nostalgic digital dreamscape' },
  { id:'liminal', num:53,        cat:'mood', name:'Liminal Space',       desc:'Empty transitional spaces, institutional fluorescent light — uncanny empty familiar places',
    visual:'empty transitional space, institutional fluorescent light, uncanny familiar emptiness',
    full:'liminal space aesthetic, empty transitional environments, institutional fluorescent lighting, uncanny familiar emptiness, abandoned schools and hotels, backrooms quality' },
  { id:'apocalyptic', num:54,    cat:'mood', name:'Apocalyptic',         desc:'Ashen gray sky, structural decay, silence after collapse — desaturated desolation',
    visual:'ash-grey sky, structural decay, silence after collapse, desaturated desolation',
    full:'post-apocalyptic atmosphere, ash-grey overcast sky, collapsed structures, overgrown ruins, profound desolate silence, desaturated color, civilization ended' },
  { id:'sacred', num:55,         cat:'mood', name:'Sacred & Mystical',   desc:'Cathedral light through incense smoke, golden iconographic glow — spiritual devoted stillness',
    visual:'cathedral light through incense dust, gold iconographic warmth, devotional stillness',
    full:'sacred mystical atmosphere, cathedral volumetric light through incense smoke, golden iconographic warmth, divine stillness, religious awe, transcendent spiritual quality' },
  { id:'underwater', num:56,     cat:'mood', name:'Underwater',          desc:'Caustic light refraction, blue-green tones, suspended particles, slow floating motion',
    visual:'caustic light refraction, blue-green tones, suspended particles, slow buoyant motion',
    full:'underwater atmosphere, caustic light refraction patterns, blue-green aquatic tones, suspended particulates, slow dreamlike buoyancy, filtered light from above' },
  { id:'harvest_autumn', num:57, cat:'mood', name:'Harvest Autumn',      desc:'Deep orange and ochre palette, dry golden light, dry leaves — warm autumnal melancholy',
    visual:'deep orange and ochre palette, golden dry light, fallen leaves texture, warm melancholy',
    full:'harvest autumn atmosphere, deep orange and ochre palette, low golden dry sunlight, fallen leaves, end-of-season warmth tinged with melancholy, harvest abundance' },

  // ── Filmová estetika — Režiséři ──
  { id:'wes_anderson', num:58,   cat:'director', name:'Wes Anderson',      desc:'Bilateral symmetry, pastel palette, deadpan frontal composition, fairy-tale storybook precision',
    visual:'bilateral symmetry, pastel color palette, deadpan frontal composition, storybook precision',
    full:'Wes Anderson visual style, bilateral symmetry, pastel color palette, deadpan frontal framing, dollhouse production design, whimsical storybook precision, flat graphic staging' },
  { id:'wong_kar_wai', num:59,   cat:'director', name:'Wong Kar-wai',       desc:'Motion blur, neon bokeh, time loops, intimate close-up — green-red nostalgic palette',
    visual:'motion blur, neon bokeh, intimate close-up, nostalgic green-red palette',
    full:'Wong Kar-wai visual style, expressive motion blur, saturated neon bokeh, intimate extreme close-up, repressed emotion, nostalgic Hong Kong color palette, Christopher Doyle cinematography' },
  { id:'kubrick', num:60,        cat:'director', name:'Kubrick',            desc:'Central vanishing-point perspective, cold clinical light, wide-angle distortion — imposing scale',
    visual:'central vanishing point perspective, cold clinical light, wide-angle distortion, imposing scale',
    full:'Kubrick visual style, perfect central one-point perspective, cold clinical lighting, wide-angle lens distortion, imposing symmetric architecture, mechanical precision' },
  { id:'malick', num:61,         cat:'director', name:'Terrence Malick',    desc:'Natural golden light, intimate handheld closeness, nature as spirituality — whispered storytelling',
    visual:'natural golden-hour light, handheld intimacy, nature as spiritual presence',
    full:'Terrence Malick visual style, natural golden-hour light through trees, intimate handheld camera, contemplative spiritual nature connection, lyrical non-narrative flow, Lubezki cinematography' },
  { id:'kurosawa', num:62,       cat:'director', name:'Akira Kurosawa',     desc:'Strong raking lines, wind-driven elements, epic wide compositions — dramatic weather and epicness',
    visual:'strong raking compositional lines, wind-blown elements, epic wide compositions, dramatic weather',
    full:'Akira Kurosawa visual style, strong raking compositional lines, wind and weather as dramatic force, epic wide landscape compositions, samurai period epic scale, bold black and white or vivid color' },
  { id:'deakins', num:63,        cat:'director', name:'Roger Deakins',      desc:'Naturalistic motivated light, subtle contrast, perfect shadow detail — cinematic realism',
    visual:'naturalistic motivated light, subtle contrast, immaculate shadow detail, cinematic realism',
    full:'Roger Deakins cinematography style, naturalistic motivated lighting, beautiful subtle contrast, immaculate shadow detail, photorealistic cinematic quality, quietly stunning realism' },
  { id:'nolan', num:64,          cat:'director', name:'Christopher Nolan',  desc:'IMAX grandeur, desaturated blue-gray, monumental practical sets — temporal tension',
    visual:'IMAX grandeur, desaturated blue-grey, monumental practical sets, time-tension',
    full:'Christopher Nolan visual style, IMAX monumental grandeur, desaturated blue-grey palette, massive practical sets, temporal tension, Hoyte van Hoytema cinematography' },
  { id:'villeneuve', num:65,     cat:'director', name:'Denis Villeneuve',   desc:'Monumental empty space, single figure in a vast environment — restrained color drama',
    visual:'monumental empty space, single figure in vast environment, restrained color drama',
    full:'Denis Villeneuve visual style, monumental negative space, single human figure dwarfed by environment, restrained deliberate color, meditative scale, Roger Deakins or Greig Fraser cinematography' },
  { id:'park_chan_wook', num:66, cat:'director', name:'Park Chan-wook',     desc:'Deeply saturated palette, precise symmetry, tension through stillness — elegant violence',
    visual:'deep saturated palette, precise symmetry, tension through stillness, elegant violence',
    full:'Park Chan-wook visual style, deeply saturated color palette, precise bilateral symmetry, tension through elegant stillness, meticulous composition, Oldboy Korean cinema aesthetic' },
  { id:'tarkovsky', num:67,      cat:'director', name:'Andrei Tarkovsky',   desc:'Slow shots, water and fire as elements, contemplative spiritual time — Soviet poetics',
    visual:'long slow takes, water and fire elements, contemplative spiritual time, Soviet poetry',
    full:'Andrei Tarkovsky visual style, long meditative takes, water rain and fire as elemental poetry, contemplative spiritual time, muted color, Stalker zone atmosphere, Soviet cinematic poetry' },
  { id:'sofia_coppola', num:68,  cat:'director', name:'Sofia Coppola',      desc:'Pastel isolation, dreamy shallow focus, quiet feminine interiority — sun-drenched ennui',
    visual:'pastel isolation, dreamy shallow focus, quiet feminine interiority, sun-drenched ennui',
    full:'Sofia Coppola visual style, pastel isolation, dreamy shallow depth of field, quiet interiority, sun-drenched feminine ennui, Lost in Translation atmosphere, delicate melancholy' },
  { id:'leone', num:69,          cat:'director', name:'Sergio Leone',        desc:'Extreme eye detail, desert heat shimmer, wide desert plains, operatic timing',
    visual:'extreme close-up eyes and faces, heat shimmer, wide desert vistas, operatic pacing',
    full:'Sergio Leone visual style, extreme close-up on eyes, vast desert wide shots, heat shimmer distortion, operatic dramatic timing, spaghetti western dust and tension' },
  { id:'gaspar_noe', num:70,     cat:'director', name:'Gaspar Noé',          desc:'Single-source neon saturation, strobing disorientation — purple and pink, provocative intensity',
    visual:'single-source neon saturation, strobing disorientation, neon pink-purple',
    full:'Gaspar Noé visual style, overwhelming neon saturation, strobing light effects, long unbroken takes, hallucinatory color, provocative visual intensity, Enter the Void aesthetic' },
  { id:'nwr', num:71,            cat:'director', name:'Nicolas Winding Refn', desc:'Ultra-slow pace, neon pink-purple palette, silent protagonist — Drive aesthetic',
    visual:'ultra-slow pacing, neon pink-purple palette, silent protagonist, Drive aesthetic',
    full:'Nicolas Winding Refn visual style, ultra-slow deliberate pacing, neon pink and purple color palette, silent stoic protagonist, Los Angeles noir, Drive and Only God Forgives aesthetic' },
  { id:'tarantino', num:72,      cat:'director', name:'Quentin Tarantino',   desc:'Capitol grindhouse warmth, 70s film grain, saturated primary colors — stylized pop culture',
    visual:'grindhouse warm tones, 70s film grain, saturated primary colors, stylized pop culture',
    full:'Quentin Tarantino visual style, warm grindhouse aesthetic, 70s film grain and color, saturated primary colors, chaptered storytelling, stylized pop culture references' },
  { id:'tim_burton', num:73,     cat:'director', name:'Tim Burton',          desc:'Gothic expressionism, exaggerated silhouettes, black-and-white contrast, dark whimsy — Edward Scissorhands',
    visual:'gothic expressionism, exaggerated silhouettes, black and white contrast, dark whimsy',
    full:'Tim Burton visual style, gothic expressionist design, exaggerated curved silhouettes, stark black and white contrast, dark fairy tale whimsy, Edward Scissorhands aesthetic' },
  { id:'del_toro', num:74,       cat:'director', name:'Guillermo del Toro',  desc:'Amber fairy-tale glow vs. cold institutional gray, golden dust — dark fantasy worlds',
    visual:'amber fairy tale warmth vs. cold institutional grey, dark fantasy, golden dust motes',
    full:'Guillermo del Toro visual style, warm amber fairy tale spaces versus cold grey oppressive real world, golden floating dust, dark fantasy creature design, Pan\'s Labyrinth quality' },
  { id:'roy_andersson', num:75,  cat:'director', name:'Roy Andersson',       desc:'Extreme wide shot, desaturated Swedish gray, static tableau, absurdist tragicomedy',
    visual:'extreme long static shot, desaturated Swedish grey, static tableau, absurdist tragicomedy',
    full:'Roy Andersson visual style, extreme wide static tableaux, desaturated grey-green palette, frozen tableau composition, absurdist human comedy, Swedish existential deadpan' },
  { id:'ridley_scott', num:76,   cat:'director', name:'Ridley Scott',        desc:'Atmospheric fog, dramatic light shafts, gritty production design — epic dramatic scale',
    visual:'atmospheric haze, dramatic shaft lighting, gritty production design, epic scale drama',
    full:'Ridley Scott visual style, atmospheric smoke and haze, dramatic volumetric shaft lighting, gritty detailed production design, epic cinematic scale, Blade Runner and Gladiator quality' },

  // ── Filmové vzory ──
  { id:'matrix', num:77,         cat:'film_ref', name:'The Matrix (1999)',    desc:'Green digital simulation world vs. cold blue reality, chiaroscuro, high-contrast darkness — Wachowski/Pope',
    visual:'sickly green digital tint, chiaroscuro contrast, deep rich blacks, simulation aesthetic',
    full:'The Matrix color palette, sickly green simulation tint, chiaroscuro black shadows, high contrast, digital cold aesthetic, Bill Pope cinematography, machine-world decay' },
  { id:'mad_max', num:78,        cat:'film_ref', name:'Mad Max: Fury Road (2015)', desc:'Hypersaturated orange-blue contrast, kinetic energy, practical desert — George Miller/Eric Whipp',
    visual:'hyper-saturated orange and blue contrast, kinetic energy, harsh desert light',
    full:'Mad Max Fury Road color grade, hyper-saturated orange desert sky, deep blue shadows, extreme color contrast, kinetic chaos, George Miller post-apocalyptic energy' },
  { id:'amelie', num:79,         cat:'film_ref', name:'Amélie (2001)',         desc:'Warm Parisian fairy tale, red-green-yellow, Bruno Delbonnel soft glow — digitally enhanced nostalgia',
    visual:'warm Parisian fairy tale, red-green-yellow palette, soft diffused glow, whimsical nostalgia',
    full:'Amélie color palette, warm golden-red Parisian fairy tale, heightened saturation, Bruno Delbonnel soft diffused glow, whimsical heightened reality, Instagram-defining aesthetic' },
  { id:'lighthouse', num:80,     cat:'film_ref', name:'The Lighthouse (2019)', desc:'B&W 1.19:1 square format, 19th-century photography, brutal contrast, fog — Eggers/Laxton',
    visual:'black and white square 1.19:1 format, 19th century photography texture, brutal contrast, fog',
    full:'The Lighthouse visual style, black and white square 1.19:1 aspect ratio, 19th century photographic quality, brutal high contrast, sea fog, Jarin Blaschke cinematography' },
  { id:'dune', num:81,           cat:'film_ref', name:'Dune (2021)',           desc:'Monumental wasteland, Greig Fraser large format, gold-dust palette, human miniature in landscape',
    visual:'monumental desert wasteland, large format golden dust palette, human miniature in vast landscape',
    full:'Dune color palette, monumental desert landscape, golden dust atmosphere, Greig Fraser large format cinematography, humans dwarfed by immense scale, warm sandstone tones' },
  { id:'pans_labyrinth', num:82, cat:'film_ref', name:"Pan's Labyrinth (2006)", desc:'Warm amber fairy-tale world vs. cold institutional gray of reality — del Toro/Navarro',
    visual:'warm amber fairy tale world vs. cold institutional grey real world, dual palette narrative',
    full:"Pan's Labyrinth dual visual world, warm golden amber of the fantasy realm contrasting with cold desaturated grey of fascist reality, magical golden light, dark fairy tale beauty" },
  { id:'in_the_mood', num:83,    cat:'film_ref', name:'In the Mood for Love (2000)', desc:'Deep crimson and emerald, 60s Hong Kong nostalgia, slow motion mystery — WKW/Doyle',
    visual:'deep crimson and emerald palette, 60s Hong Kong nostalgia, slow motion intimacy',
    full:'In the Mood for Love visual style, deep crimson and emerald saturation, 1960s Hong Kong period detail, Christopher Doyle slow motion, repressed desire, exquisite color poetry' },
  { id:'apocalypse_now', num:84, cat:'film_ref', name:'Apocalypse Now (1979)',  desc:'Vittorio Storaro — color as narrative, orange napalm, green jungle, psychological darkness',
    visual:'Storaro color as narrative, orange napalm fire, dense green jungle, psychological darkness',
    full:'Apocalypse Now cinematography, Vittorio Storaro color theory as narrative, orange napalm and fire, dense green-black jungle, psychological descent, Conrad-esque darkness' },
  { id:'godfather', num:85,      cat:'film_ref', name:'The Godfather (1972)',   desc:'Gordon Willis amber underexposure, faces hidden in shadow, warm amber interiors — Prince of Darkness',
    visual:'amber underexposed cinematography, faces partially in shadow, warm amber interiors',
    full:'The Godfather cinematography, Gordon Willis amber underexposure, faces dramatically half-shadowed, warm golden interior tones, "Prince of Darkness" style, 1940s period richness' },
  { id:'schindler', num:86,      cat:'film_ref', name:"Schindler's List (1993)", desc:'Desaturated B&W with iconic red coat — selective color as emotional focal point',
    visual:'desaturated black and white with selective color accent, emotional color isolation',
    full:"Schindler's List visual style, near black and white desaturated palette, selective color emphasis, Janusz Kaminski cinematography, historical documentary quality, monochrome humanity" },
  { id:'suspiria', num:87,       cat:'film_ref', name:'Suspiria (1977)',         desc:'Argento giallo — extreme primary colors, red/blue/green, horror as abstract painting',
    visual:'extreme primary color lighting, red blue green color horror, giallo painterly intensity',
    full:'Suspiria color palette, extreme primary color horror lighting, Argento giallo aesthetic, vivid red blue and green light, horror as abstract expressionist painting, operatic color' },
  { id:'2001', num:88,           cat:'film_ref', name:'2001: A Space Odyssey (1968)', desc:'Clinical white modernist symmetry → psychedelic Stargate, Kubrick cosmic void',
    visual:'clinical white modernist symmetry, psychedelic stargate color, cosmic void emptiness',
    full:'2001 A Space Odyssey visual style, clinical white interior symmetry, pristine modernist future, psychedelic Stargate sequence color, vast cosmic void, Kubrick spatial precision' },
  { id:'hero', num:89,           cat:'film_ref', name:'Hero (2002)',             desc:'Zhang Yimou — each chapter in a different monochromatic color (red/blue/white/green)',
    visual:'monochromatic chapter color coding, single dominant hue per scene, Chinese epic color',
    full:'Hero Zhang Yimou color palette, monochromatic chapter structure, single dominant hue per sequence, deep red, cool blue, pure white, lush green, wuxia color poetry, Christopher Doyle' },
  { id:'sin_city', num:90,       cat:'film_ref', name:'Sin City (2005)',         desc:'Graphic B&W with iconic color accents — red lips, yellow skin, red dress',
    visual:'graphic black and white with selective color accents, red lips yellow skin, comic panel look',
    full:'Sin City visual style, graphic black and white with selective color accents, Frank Miller comic panel aesthetic, deep blacks, isolated color pops, noir stylization' },
  { id:'barry_lyndon', num:91,   cat:'film_ref', name:'Barry Lyndon (1975)',     desc:'Natural candlelight, 18th-century painting, Kubrick zoom — pastel aristocracy',
    visual:'natural candlelight interior, 18th century painting aesthetic, Kubrick slow zoom, pastel aristocracy',
    full:'Barry Lyndon visual style, natural candlelight cinematography, 18th century Old Master painting quality, Kubrick slow zoom lens, pastel aristocratic palette, John Alcott cinematography' },
  { id:'seven', num:92,          cat:'film_ref', name:'Se7en (1995)',             desc:'Bleach bypass Dark Clarity, queasy desaturated green-brown, underexposed interiors — Fincher/Khondji',
    visual:'bleach bypass desaturated sickly greens and browns, low-key underexposed interiors, rain-soaked urban decay',
    full:'Se7en visual style, bleach bypass silver retention, sickly desaturated greens and browns, deeply underexposed interiors, rain-soaked oppressive urban decay, Darius Khondji Dark Clarity' },
  { id:'blade_runner_2049', num:93, cat:'film_ref', name:'Blade Runner 2049 (2017)', desc:'Monumental minimalist composition, volumetric fog, neon through haze — Deakins/Villeneuve',
    visual:'monumental minimalist composition, volumetric fog beams, neon practicals through haze, muted blues with isolated orange',
    full:'Blade Runner 2049 visual style, monumental empty compositions, volumetric smog light beams, neon practicals through atmospheric haze, muted blue-grey with isolated orange warmth, Roger Deakins' },
  { id:'alien_1979', num:94,     cat:'film_ref', name:'Alien (1979)',             desc:'Metallic industrial cold palette, low-key corridor lighting, H.R. Giger biomechanical texture',
    visual:'metallic industrial cold palette, low-key directional light in corridors, deep shadows, steam and fog',
    full:'Alien 1979 visual style, metallic industrial cold color palette, low-key directional tungsten lighting in dark corridors, impenetrable deep shadows, steam and fog, H.R. Giger biomechanical texture' },

  // ── Fotografická estetika ──
  { id:'kodak_portra', num:95,   cat:'photo_stock', name:'Kodak Portra',     desc:'Warm natural skin tones, subtle grain, pleasant color accuracy — classic 35mm portrait',
    visual:'warm natural skin tones, gentle grain, pleasing color accuracy, classic 35mm portrait film',
    full:'Kodak Portra 400 film look, warm natural skin tones, gentle film grain, accurate pleasing color, classic 35mm portrait photography quality, subtle saturation' },
  { id:'fuji_velvia', num:96,    cat:'photo_stock', name:'Fuji Velvia',       desc:'Hypersaturated greens and blues, strong contrast, slide film richness — landscape intensity',
    visual:'hypersaturated greens and blues, punchy contrast, slide film richness, landscape intensity',
    full:'Fuji Velvia 50 slide film look, hyper-saturated colors, punchy deep contrast, rich slide film quality, landscape photography intensity, vivid nature colors' },
  { id:'ilford_hp5', num:97,     cat:'photo_stock', name:'Ilford HP5',        desc:'Classic B&W film grain, street photography structure, wide exposure latitude',
    visual:'classic B&W film grain, street photography grain structure, wide exposure latitude',
    full:'Ilford HP5 black and white film look, classic film grain structure, wide exposure latitude, street photography quality, gritty urban documentary aesthetic' },
  { id:'lomography', num:98,     cat:'photo_stock', name:'Lomography',        desc:'Vignetting, color cross-process, light leaks, unpredictable oversaturation — lo-fi charm',
    visual:'vignette, color cross-process, light leaks, unpredictable oversaturation, lo-fi charm',
    full:'Lomography aesthetic, strong vignette, unpredictable color cross-processing, light leak artifacts, oversaturated pockets, lo-fi toy camera charm, spontaneous imperfection' },
  { id:'medium_format', num:99,  cat:'photo_stock', name:'Medium Format',     desc:'Micro-contrast in details, creamy smooth bokeh, tonal depth — Hasselblad rendering',
    visual:'micro-contrast detail, creamy smooth bokeh, tonal depth, medium format rendering',
    full:'medium format photography aesthetic, exceptional micro-contrast and detail, creamy smooth bokeh, rich tonal depth, Hasselblad or Mamiya quality, elevated photographic presence' },
];

// State
let selectedStyles = new Map(); // id → styleObj
let styleMode = 'visual';        // 'visual' | 'full'
let stylesCatFilter = 'all';
let stylesOverlayOpen = false;
let stylesBatchMode = 'combine'; // 'combine' | 'batch'
let camerasBatchMode = 'combine'; // 'combine' | 'batch'

// Batch generation internals
let _batchForceSnap   = false;  // forces snap=1 in addToQueue
let _batchCurrentStyle  = null; // active style item during batch loop
let _batchCurrentCamera = null; // active camera item during batch loop

function toggleStylesOverlay() {
  stylesOverlayOpen = !stylesOverlayOpen;
  document.getElementById('stylesOverlay').classList.toggle('show', stylesOverlayOpen);
  document.querySelectorAll('.btn-styles').forEach(btn => btn.classList.toggle('active', stylesOverlayOpen));
  if (stylesOverlayOpen) {
    renderStylesGrid();
    // Bring styles to front, push camera back
    document.getElementById('stylesOverlay').style.zIndex = '201';
    const cam = document.getElementById('cameraOverlay');
    if (cam) cam.style.zIndex = '120';
  }
}

function setStyleMode(mode) {
  styleMode = mode;
  document.getElementById('stypVisual').classList.toggle('active', mode === 'visual');
  document.getElementById('stypFull').classList.toggle('active',   mode === 'full');
  renderStyleTags();
}

function setStylesBatchMode(mode) {
  stylesBatchMode = mode;
  document.getElementById('sovBatchBtn')?.classList.toggle('active',   mode === 'batch');
  document.getElementById('sovCombineBtn')?.classList.toggle('active', mode === 'combine');
  const rb = document.getElementById('sovRunBatch');
  if (rb) rb.style.display = mode === 'batch' ? '' : 'none';
  renderStyleTags();
}

function setCamerasBatchMode(mode) {
  camerasBatchMode = mode;
  document.getElementById('camBatchBtn')?.classList.toggle('active',   mode === 'batch');
  document.getElementById('camCombineBtn')?.classList.toggle('active', mode === 'combine');
  const rb = document.getElementById('camRunBatch');
  if (rb) rb.style.display = mode === 'batch' ? '' : 'none';
  renderCameraTags();
}

function runStyleBatch() {
  const items = Array.from(selectedStyles.values());
  if (!items.length) { toast('No styles selected for batch', 'err'); return; }
  const savedStyles = new Map(selectedStyles);
  _batchForceSnap = true;
  for (const item of items) {
    selectedStyles.clear();
    selectedStyles.set(item.id, item);
    _batchCurrentStyle = item;
    if (typeof generate === 'function') generate();
  }
  selectedStyles = savedStyles;
  _batchForceSnap = false;
  _batchCurrentStyle = null;
  toggleStylesOverlay();
  toast(`▶ Queued ${items.length} style batch jobs`, 'ok');
}

function runCameraBatch() {
  const items = Array.from(selectedCameras.values());
  if (!items.length) { toast('No cameras selected for batch', 'err'); return; }
  const savedCameras = new Map(selectedCameras);
  _batchForceSnap = true;
  for (const item of items) {
    selectedCameras.clear();
    selectedCameras.set(item.id, item);
    _batchCurrentCamera = item;
    if (typeof generate === 'function') generate();
  }
  selectedCameras = savedCameras;
  _batchForceSnap = false;
  _batchCurrentCamera = null;
  toggleCameraOverlay();
  toast(`▶ Queued ${items.length} camera batch jobs`, 'ok');
}

// Tag popup — expandable list of selected items
let _tagPopupType = null;
function toggleTagPopup(type, anchorEl) {
  if (_tagPopupType === type) { closeTagPopup(); return; }
  closeTagPopup();
  _tagPopupType = type;
  const names = type === 'style'
    ? Array.from(selectedStyles.values()).map(s => s.name)
    : Array.from(selectedCameras.values()).map(c => c.name);
  if (!names.length) return;
  const popup = document.createElement('div');
  popup.id = 'batchTagPopup';
  popup.style.cssText = 'position:fixed;z-index:9999;background:var(--s2);border:1px solid var(--border2);' +
    'padding:6px 0;min-width:170px;box-shadow:0 4px 20px rgba(0,0,0,.55);';
  popup.innerHTML = names.map(n =>
    `<div style="padding:4px 13px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:var(--dim);letter-spacing:.03em;">${n}</div>`
  ).join('');
  document.body.appendChild(popup);
  const rect = anchorEl.getBoundingClientRect();
  popup.style.top  = (rect.bottom + 4) + 'px';
  popup.style.left = rect.left + 'px';
  setTimeout(() => document.addEventListener('click', _closeTagPopupOutside), 0);
}
function closeTagPopup() {
  _tagPopupType = null;
  document.getElementById('batchTagPopup')?.remove();
  document.removeEventListener('click', _closeTagPopupOutside);
}
function _closeTagPopupOutside(e) {
  if (!document.getElementById('batchTagPopup')?.contains(e.target)) closeTagPopup();
}

function initStylesCats() {
  const el = document.getElementById('sovCats');
  if (!el) return;
  let html = `<button class="sov-cat active" data-cat="all" onclick="filterStylesCat('all')">All</button>`;
  Object.entries(STYLE_CATS).forEach(([k, v]) => {
    html += `<button class="sov-cat" data-cat="${k}" onclick="filterStylesCat('${k}')">${v}</button>`;
  });
  el.innerHTML = html;
}

function filterStylesCat(cat) {
  stylesCatFilter = cat;
  document.querySelectorAll('.sov-cat').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderStylesGrid();
}

function renderStylesGrid() {
  const grid = document.getElementById('sovGrid');
  if (!grid) return;
  const search = (document.getElementById('sovSearch')?.value || '').toLowerCase();

  // Filter
  const filtered = STYLES.filter(s => {
    const catOk = stylesCatFilter === 'all' || s.cat === stylesCatFilter;
    const searchOk = !search || s.name.toLowerCase().includes(search) || s.desc.toLowerCase().includes(search);
    return catOk && searchOk;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="padding:20px 14px;font-size:11px;color:var(--dim2);">No results.</div>';
    document.getElementById('sovCount').textContent = `${selectedStyles.size} selected`;
    return;
  }

  // Group by category
  const groups = {};
  filtered.forEach(s => {
    if (!groups[s.cat]) groups[s.cat] = [];
    groups[s.cat].push(s);
  });

  let html = '';
  Object.entries(groups).forEach(([cat, items]) => {
    const catLabel = STYLE_CATS[cat] || cat;
    const [bg, fg, line] = STYLE_CAT_COLORS[cat] || ['rgba(144,144,168,.15)', 'var(--dim)', 'rgba(144,144,168,.4)'];
    html += `<div class="sov-group">
      <div class="sov-group-hdr" style="background:${bg};">
        <span class="sov-group-name" style="color:${fg};">${catLabel}</span>
        <span class="sov-group-line" style="background:${line};"></span>
      </div>`;
    items.forEach(s => {
      const sel = selectedStyles.has(s.id);
      html += `<div class="sov-item ${sel ? 'selected' : ''}" onclick="toggleStyleSelect('${s.id}')">
        <div class="sov-item-btn">${s.name}</div>
        <div class="sov-item-desc">${s.desc}</div>
      </div>`;
    });
    html += '</div>';
  });

  grid.innerHTML = html;
  document.getElementById('sovCount').textContent = `${selectedStyles.size} selected`;
}

function toggleStyleSelect(id) {
  const s = STYLES.find(x => x.id === id);
  if (!s) return;
  if (selectedStyles.has(id)) {
    selectedStyles.delete(id);
  } else {
    selectedStyles.set(id, s);
  }
  renderStylesGrid();
  renderStyleTags();
}

function clearAllStyles() {
  selectedStyles.clear();
  renderStylesGrid();
  renderStyleTags();
}

function renderStyleTags() {
  const n = selectedStyles.size;
  let html = '';
  if (n > 0) {
    const modeLabel = styleMode === 'visual' ? 'V' : 'F';
    if (stylesBatchMode === 'batch') {
      // Batch: individuální červené tagy s × + play tlačítko na konci
      html = Array.from(selectedStyles.values()).map(s =>
        `<span class="style-tag batch-tag">` +
        `${s.name}<span class="st-mode">${modeLabel}</span>` +
        `<span class="st-del" onclick="toggleStyleSelect('${s.id}')">×</span></span>`
      ).join('') +
        `<span class="batch-run-inline" onclick="runStyleBatch()" title="Run batch now">▶ RUN</span>`;
    } else {
      html = Array.from(selectedStyles.values()).map(s =>
        `<span class="style-tag">` +
        `${s.name}<span class="st-mode">${modeLabel}</span>` +
        `<span class="st-del" onclick="toggleStyleSelect('${s.id}')">×</span></span>`
      ).join('');
    }
  }
  document.getElementById('styleTags') && (document.getElementById('styleTags').innerHTML = html);
  document.getElementById('videoStyleTags') && (document.getElementById('videoStyleTags').innerHTML = html);
}

// Sestaví style suffix pro aktuálně vybrané styly a mode
function buildStyleSuffix(modelType) {
  // In batch mode, _batchCurrentStyle is set to the single active item
  const items = _batchCurrentStyle
    ? [_batchCurrentStyle]
    : Array.from(selectedStyles.values());
  if (!items.length) return '';
  const parts = items.map(s => styleMode === 'full' ? s.full : s.visual);
  if (modelType === 'gemini') return 'Visual style instructions: ' + parts.join('. ') + '.';
  return parts.join(', ');
}

// ═══════════════════════════════════════════════════════
// CAMERA PICKS
// ═══════════════════════════════════════════════════════

let selectedCameras = new Map();
let currentCameraTab = 'position';

const CAMERA_ITEMS = [
  // Position & Angle
  { id:'ca_eye', num:1,    cat:'position', name:'Eye Level',        desc:'Neutral, natural perspective at subject eye height' },
  { id:'ca_low', num:2,    cat:'position', name:'Low Angle',        desc:'Camera below subject, looking up — powerful, dominant' },
  { id:'ca_hip', num:3,    cat:'position', name:'Hip Level',        desc:'Camera at hip height — dynamic, action-oriented framing' },
  { id:'ca_high', num:4,   cat:'position', name:'High Angle',       desc:'Camera above, looking down — small, vulnerable subject' },
  { id:'ca_bird', num:5,   cat:'position', name:"Bird's Eye",       desc:'Directly overhead, straight down' },
  { id:'ca_worm', num:6,   cat:'position', name:"Worm's Eye",       desc:'Extreme low angle from ground level, looking straight up' },
  { id:'ca_dutch', num:7,  cat:'position', name:'Dutch Angle',      desc:'Camera tilted on axis — unease, tension, disorientation' },
  { id:'ca_profile', num:8,cat:'position', name:'Profile / Side',   desc:'Camera 90° to subject — silhouette, stylized side view' },
  { id:'ca_ots', num:9,    cat:'position', name:'Over Shoulder',    desc:'Behind one subject, facing another — dialogue standard' },
  { id:'ca_pov', num:10,    cat:'position', name:'POV',              desc:'First-person, through character eyes' },
  { id:'ca_aerial', num:11, cat:'position', name:'Aerial',           desc:'High altitude, drone or helicopter perspective' },
  { id:'ca_ecl', num:12,    cat:'position', name:'Extreme Close-Up', desc:'Single detail fills entire frame — eyes, hands, objects' },
  { id:'ca_cu', num:13,     cat:'position', name:'Close-Up',         desc:'Head and shoulders, face dominant' },
  { id:'ca_mcu', num:14,    cat:'position', name:'Medium Close-Up',  desc:'Chest to top of head — most common dramatic framing' },
  { id:'ca_ms', num:15,     cat:'position', name:'Medium Shot',      desc:'Waist up, conversational framing' },
  { id:'ca_cowboy', num:16, cat:'position', name:'Cowboy Shot',      desc:'Mid-thigh to head — iconic western and action framing' },
  { id:'ca_twoshot', num:17,cat:'position', name:'Two Shot',         desc:'Two subjects in frame — dialogue, relationship, tension' },
  { id:'ca_ls', num:18,     cat:'position', name:'Long Shot',        desc:'Full body with surrounding environment' },
  { id:'ca_ews', num:19,    cat:'position', name:'Extreme Wide',     desc:'Vast environment, subjects tiny — epic scale' },
  // Camera Type
  { id:'cam_alexa35', num:20,  cat:'camera', name:'ARRI Alexa 35',      desc:'Industry standard, rich dynamic range, cinematic texture' },
  { id:'cam_alexalf', num:21,  cat:'camera', name:'ARRI Alexa LF',      desc:'Large format, wide depth of field control, epic look' },
  { id:'cam_alexamin', num:22, cat:'camera', name:'ARRI Alexa Mini LF', desc:'Compact large-format — indie and commercial go-to' },
  { id:'cam_venice2', num:23,  cat:'camera', name:'Sony Venice 2',      desc:'Natural color science, full-frame cinematic' },
  { id:'cam_red', num:24,      cat:'camera', name:'RED V-Raptor',       desc:'Ultra-high resolution, sharp and detailed' },
  { id:'cam_pana', num:25,     cat:'camera', name:'Panavision Panaflex',desc:'Legendary film look, unique bokeh signature, classic Hollywood' },
  { id:'cam_imax', num:26,     cat:'camera', name:'IMAX 70mm',          desc:'Extraordinary sharpness, detail and scale' },
  { id:'cam_16mm', num:27,     cat:'camera', name:'16mm Film',          desc:'Visible grain, documentary rawness, indie feel' },
  { id:'cam_35mm', num:28,     cat:'camera', name:'35mm Film',          desc:'Classic cinematic grain, rich tonality, halation' },
  { id:'cam_super8', num:29,   cat:'camera', name:'Super 8mm Film',     desc:'Warm grain, soft halation, intimate nostalgic texture' },
  { id:'cam_dslr', num:30,     cat:'camera', name:'DSLR / Mirrorless',  desc:'Natural handheld quality, accessible cinematic look' },
  { id:'cam_gopro', num:31,    cat:'camera', name:'GoPro / Action Cam', desc:'Wide POV, extreme sports energy, immersive distortion' },
  { id:'cam_phone', num:32,    cat:'camera', name:'iPhone / Phone',     desc:'Modern social cinema — raw, intimate, lo-fi credibility' },
  { id:'cam_vhs', num:33,      cat:'camera', name:'VHS / Camcorder',    desc:'Retro scan lines, color bleed, found footage nostalgia' },
  // Lens
  { id:'lens_14', num:34,    cat:'lens', name:'14mm',              desc:'Ultra-wide, extreme distortion, expansive field' },
  { id:'lens_18', num:35,    cat:'lens', name:'18mm',              desc:'Wide cinema prime — between ultra-wide and environmental' },
  { id:'lens_24', num:36,    cat:'lens', name:'24mm',              desc:'Wide angle, slight perspective, environmental context' },
  { id:'lens_28', num:37,    cat:'lens', name:'28mm',              desc:'Classic photojournalism and street — Leica 28 feel' },
  { id:'lens_35', num:38,    cat:'lens', name:'35mm',              desc:'Slightly wide, close to natural human perspective' },
  { id:'lens_50', num:39,    cat:'lens', name:'50mm',              desc:'Standard, natural eye perspective, no distortion' },
  { id:'lens_85', num:40,    cat:'lens', name:'85mm',              desc:'Portrait, flattering compression, natural background separation' },
  { id:'lens_135', num:41,   cat:'lens', name:'135mm',             desc:'Telephoto, subject isolation, compressed perspective' },
  { id:'lens_200', num:42,   cat:'lens', name:'200mm',             desc:'Extreme compression, flattened planes' },
  { id:'lens_300', num:43,   cat:'lens', name:'300mm+',            desc:'Sports and wildlife compression — dramatic spatial flattening' },
  { id:'lens_anam', num:44,  cat:'lens', name:'Anamorphic',        desc:'Oval bokeh, horizontal blue lens flares, 2.39:1 widescreen' },
  { id:'lens_vintage', num:45,cat:'lens', name:'Vintage / Uncoated',desc:'Glowing highlights, low contrast, veiling flare, organic imperfection' },
  { id:'lens_soft', num:46,  cat:'lens', name:'Soft Diffusion',    desc:'Dreamy haze, Black Pro-Mist filter look, gentle bloom' },
  { id:'lens_fish', num:47,  cat:'lens', name:'Fisheye',           desc:'180° field, extreme barrel distortion' },
  { id:'lens_macro', num:48, cat:'lens', name:'Macro',             desc:'1:1 magnification, extreme close focus on tiny subjects' },
  { id:'lens_tilt', num:49,  cat:'lens', name:'Tilt-Shift',        desc:'Selective focus plane, miniaturization effect' },
  // Movement
  { id:'mv_static', num:50,      cat:'movement', name:'Static',            desc:'Locked-off, no movement, deliberate stillness' },
  { id:'mv_handheld', num:51,    cat:'movement', name:'Handheld',          desc:'Naturalistic shake, documentary immediacy and energy' },
  { id:'mv_steadicam', num:52,   cat:'movement', name:'Steadicam',         desc:'Stabilized fluid handheld, follows action through space' },
  { id:'mv_pan', num:53,         cat:'movement', name:'Pan',               desc:'Horizontal rotation, following action left or right' },
  { id:'mv_whip', num:54,        cat:'movement', name:'Whip Pan',          desc:'Extremely fast pan, motion blur, energetic transition' },
  { id:'mv_tilt_up', num:55,     cat:'movement', name:'Tilt Up',           desc:'Camera rises on fixed axis from boots to face — reveal' },
  { id:'mv_tilt_down', num:56,   cat:'movement', name:'Tilt Down',         desc:'Camera descends on fixed axis from face to ground' },
  { id:'mv_dollyin', num:57,     cat:'movement', name:'Dolly In',          desc:'Smooth forward push on tracks — tension, intimacy' },
  { id:'mv_dollyout', num:58,    cat:'movement', name:'Dolly Out',         desc:'Smooth backward pull — isolation, expanding context' },
  { id:'mv_dolly_rush', num:59,  cat:'movement', name:'Fast Dolly Rush',   desc:'Sudden surge forward — urgency, shock, aggression' },
  { id:'mv_dollyzoom', num:60,   cat:'movement', name:'Dolly Zoom',        desc:'Vertigo effect — dolly back + zoom in, warped perspective' },
  { id:'mv_zoomin', num:61,      cat:'movement', name:'Zoom In',           desc:'Optical zoom in while locked-off — depth compression' },
  { id:'mv_zoomout', num:62,     cat:'movement', name:'Zoom Out',          desc:'Optical zoom out while locked-off — expanding context' },
  { id:'mv_snap_zoom', num:63,   cat:'movement', name:'Snap Zoom',         desc:'Instantaneous aggressive punch zoom — jarring impact' },
  { id:'mv_macro_zoom', num:64,  cat:'movement', name:'Macro Zoom',        desc:'Extreme zoom from portrait into microscopic surface detail' },
  { id:'mv_cosmic_zoom', num:65, cat:'movement', name:'Cosmic Zoom',       desc:'Unbroken zoom from deep space down to street level' },
  { id:'mv_track_fwd', num:66,   cat:'movement', name:'Following Shot',    desc:'Camera advances behind subject at matched pace' },
  { id:'mv_track_back', num:67,  cat:'movement', name:'Backward Tracking', desc:'Camera retreats as subject walks forward — leading shot' },
  { id:'mv_track_side', num:68,  cat:'movement', name:'Side Tracking',     desc:'Camera runs parallel to subject — profile lockstep' },
  { id:'mv_truck', num:69,       cat:'movement', name:'Lateral Truck',     desc:'Sideways dolly slide — strong foreground/background parallax' },
  { id:'mv_crane_up', num:70,    cat:'movement', name:'Crane Up',          desc:'Jib rises from ground to high angle — grand reveal' },
  { id:'mv_crane_down', num:71,  cat:'movement', name:'Crane Down',        desc:'Jib descends from aerial to eye level — landing arrival' },
  { id:'mv_ped_up', num:72,      cat:'movement', name:'Pedestal Up',       desc:'Camera body rises vertically on column — perspective shift' },
  { id:'mv_ped_down', num:73,    cat:'movement', name:'Pedestal Down',     desc:'Camera body lowers vertically — grounding, descending' },
  { id:'mv_arc', num:74,         cat:'movement', name:'Slow Arc',          desc:'Camera glides in gentle wide curve around subject' },
  { id:'mv_orbit_half', num:75,  cat:'movement', name:'Half Orbit 180°',   desc:'Camera sweeps 180° around subject front to back' },
  { id:'mv_orbit_360', num:76,   cat:'movement', name:'Fast 360° Orbit',   desc:'Full circular spin around subject — streaking environment' },
  { id:'mv_aerial_move', num:77, cat:'movement', name:'Aerial Flyover',    desc:'Stable high-altitude drone push forward over landscape' },
  { id:'mv_fpv_dive', num:78,    cat:'movement', name:'FPV Drone Dive',    desc:'Aggressive first-person drone plunge down a facade' },
  { id:'mv_flythrough', num:79,  cat:'movement', name:'Fly-Through',       desc:'Camera glides through narrow opening to reveal scene beyond' },
  { id:'mv_wipe_reveal', num:80, cat:'movement', name:'Lateral Wipe Reveal',desc:'Slides sideways from behind foreground obstruction to unveil subject' },
  { id:'mv_focus_pull', num:81,  cat:'movement', name:'Focus Pull Reveal', desc:'Opens fully defocused in bokeh, lens snaps to crisp clarity' },
  // Focus & Depth of Field
  { id:'dof_wide_open', num:82,  cat:'focus', name:'Wide Open f/1.2',   desc:'Extreme shallow DOF — silky subject isolation, background dissolves' },
  { id:'dof_f18', num:83,        cat:'focus', name:'f/1.8',             desc:'Creamy separation, portrait standard — subject clear, BG soft' },
  { id:'dof_f28', num:84,        cat:'focus', name:'f/2.8',             desc:'Moderate DOF — subject sharp, background visibly softened' },
  { id:'dof_f4', num:85,         cat:'focus', name:'f/4',               desc:'Subject and near foreground sharp, distant background softens' },
  { id:'dof_f56', num:86,        cat:'focus', name:'f/5.6',             desc:'Balanced DOF — street photography, environmental portrait' },
  { id:'dof_f8', num:87,         cat:'focus', name:'f/8',               desc:'Most of scene sharp, only far background softens slightly' },
  { id:'dof_deep', num:88,       cat:'focus', name:'Deep Focus f/11+',  desc:'Everything sharp front to back — landscape, architecture' },
  { id:'dof_bokeh', num:89,      cat:'focus', name:'Bokeh Emphasis',    desc:'Deliberately strong background blur, creamy circular light orbs' },
  { id:'dof_split', num:90,      cat:'focus', name:'Split Diopter',     desc:'Two simultaneous focal planes — De Palma / Kubrick signature' },
  { id:'dof_rack', num:91,       cat:'focus', name:'Rack Focus',        desc:'Focus shifts from foreground to background mid-shot' },
  { id:'dof_soft', num:92,       cat:'focus', name:'Soft Focus',        desc:'Dreamy diffusion, Tiffen Black Pro-Mist filter quality' },
];

function toggleCameraOverlay() {
  const ov = document.getElementById('cameraOverlay');
  const showing = ov.style.display === 'flex';
  ov.style.display = showing ? 'none' : 'flex';
  // Mark all camera buttons active when overlay is open, restore selectedCameras state when closed
  if (!showing) {
    document.querySelectorAll('.btn-camera').forEach(btn => btn.classList.add('active'));
    renderCameraItems();
    // Bring camera to front, push styles back
    ov.style.zIndex = '201';
    const sov = document.getElementById('stylesOverlay');
    if (sov) sov.style.zIndex = '120';
  } else {
    // Overlay closing — restore button state based on actual camera selections
    updateCameraBtn();
  }
}

function setCameraTab(tab) {
  currentCameraTab = tab;
  document.querySelectorAll('.cam-tab').forEach(b => b.classList.remove('active'));
  const tb = document.getElementById('camTab_' + tab);
  if (tb) tb.classList.add('active');
  renderCameraItems();
}

function renderCameraItems() {
  const list = document.getElementById('cameraItemsList');
  if (!list) return;
  const items = CAMERA_ITEMS.filter(c => c.cat === currentCameraTab);
  list.innerHTML = items.map(c => {
    const sel = selectedCameras.has(c.id);
    return `<div class="cam-item ${sel ? 'selected' : ''}" onclick="toggleCameraSelect('${c.id}')">
      <button class="cam-item-btn">${c.name}</button>
      <div class="cam-item-desc">${c.desc}</div>
    </div>`;
  }).join('');
}

function toggleCameraSelect(id) {
  const item = CAMERA_ITEMS.find(c => c.id === id);
  if (!item) return;
  if (selectedCameras.has(id)) selectedCameras.delete(id);
  else selectedCameras.set(id, item);
  renderCameraItems();
  renderCameraTags();
  updateCameraBtn();
  const cc = document.getElementById('camCount');
  if (cc) cc.textContent = `${selectedCameras.size} selected`;
}

function clearAllCameras() {
  selectedCameras.clear();
  renderCameraItems();
  renderCameraTags();
  updateCameraBtn();
  const cc = document.getElementById('camCount');
  if (cc) cc.textContent = '0 selected';
}

function renderCameraTags() {
  const n = selectedCameras.size;
  let html = '';
  if (n > 0) {
    if (camerasBatchMode === 'batch') {
      // Batch: individuální červené tagy s × + play tlačítko na konci
      html = Array.from(selectedCameras.values()).map(c =>
        `<span class="camera-tag batch-tag">` +
        `${c.name}<span class="ct-del" onclick="toggleCameraSelect('${c.id}')">×</span></span>`
      ).join('') +
        `<span class="batch-run-inline cam" onclick="runCameraBatch()" title="Run batch now">▶ RUN</span>`;
    } else {
      html = Array.from(selectedCameras.values()).map(c =>
        `<span class="camera-tag">` +
        `${c.name}<span class="ct-del" onclick="toggleCameraSelect('${c.id}')">×</span></span>`
      ).join('');
    }
  }
  document.getElementById('cameraTags') && (document.getElementById('cameraTags').innerHTML = html);
  document.getElementById('videoCameraTags') && (document.getElementById('videoCameraTags').innerHTML = html);
}

function updateCameraBtn() {
  const active = selectedCameras.size > 0;
  document.querySelectorAll('.btn-camera').forEach(btn => btn.classList.toggle('active', active));
}

function buildCameraSuffix() {
  // In batch mode, _batchCurrentCamera is set to the single active item
  const items = _batchCurrentCamera
    ? [_batchCurrentCamera]
    : Array.from(selectedCameras.values());
  if (!items.length) return '';
  return items.map(c => c.name).join(', ');
}

// ═══════════════════════════════════════════════════════
// API KEY WARNING
// ═══════════════════════════════════════════════════════

function showApiKeyWarning(title, msg) {
  document.getElementById('akwTitle').textContent = title;
  document.getElementById('akwMsg').textContent = msg;
  document.getElementById('apiKeyWarning').classList.add('show');
}

function closeApiKeyWarning(goSetup) {
  document.getElementById('apiKeyWarning').classList.remove('show');
  if (goSetup) switchView('setup');
}



