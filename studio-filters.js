/* ══════════════════════════════════════════════════════════
   MANNORR STUDIO v4 — Filter Engine (studio-filters.js)
   104+ presets · canvas FX · color grade · LUT · FX stack
   ══════════════════════════════════════════════════════════ */

'use strict';

// ── DEFAULT FILTER VALUES ────────────────────────────────
const DEFAULT_FILTERS = {
  brightness: 100, contrast: 100, saturate: 100, hue: 0,
  exposure: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  temperature: 0, tint: 0, vibrance: 0, clarity: 0,
  grain: 0, vignette: 0, blur: 0, sharpen: 0,
  sepia: 0, invert: 0, glitch: 0, posterize: 0,
  duotone: 'none',
};

// ── FILTER CATEGORIES ────────────────────────────────────
const FILTER_CATS = {
  'Cinematic':     ['Cinematic','Blockbuster','Hollywood','Arthouse','Epic','Teal & Orange',
                    'Dark Moody','Silver Toning','Film Noir','Neo Noir','Bronze','Copper',
                    'Burnt Sienna','Bleach Bypass','Crushed Blacks'],
  'Film Stock':    ['Fuji Velvia','Fuji Provia','Fuji Superia','Kodak Gold','Kodak Ektar',
                    'Kodak Portra','Kodak Vision','Ilford HP5','Ilford Delta','Polaroid 600',
                    'Lomography','Agfa Vista','Agfa Scala','Cross Process','E6 Slide',
                    'Tungsten','Ektachrome'],
  'Mood':          ['Warm Glow','Cool Fade','Dreamy','Muted','Faded','Hazy','Melancholy',
                    'Euphoric','Nostalgic','Tranquil','Stormy','Hopeful','Lonely','Electric'],
  'Retro':         ['Retro 70s','Retro 80s','Retro 90s','VHS','Super 8','Daguerreotype',
                    'Ambrotype','Pastel Dream','Boho','Bubblegum','Lo-Fi'],
  'Social':        ['Instagram','TikTok Punch','YouTube Crisp','Reels Glow','Story Filter',
                    'Influencer','VSCO A4','VSCO C1','VSCO M5','VSCO P5','VSCO G3',
                    'Presetify','LightLeak','Airy','Clean'],
  'Dramatic':      ['High Drama','Punchy','Over-Exposed','Under-Exposed','Hard Shadow',
                    'Blown Out','Dark Room','Midnight','Eclipse','Apocalypse','Inferno',
                    'Polar','Hellfire','Frozen','Nuclear'],
  'B&W & Tone':   ['B&W Natural','B&W Punchy','B&W Soft','B&W Film','B&W High Key',
                    'B&W Low Key','Sepia Classic','Sepia Faded','Duotone Blue',
                    'Duotone Green','Duotone Red','Duotone Purple','Split Tone'],
  'Sci-Fi':        ['Cyberpunk','Neon City','Digital Glitch','Hologram','Matrix',
                    'Alien World','Deep Space','Vaporwave','Synthwave','Tech Noir',
                    'Tron','Blade Runner'],
  'Nature':        ['Golden Hour','Blue Hour','Forest Light','Ocean Blue','Desert Sand',
                    'Overcast','Crisp Morning','Sunset Fire','Arctic Ice','Tropical',
                    'Storm','Fog','Autumn','Spring'],
  'Effects':       ['Glow','Soft Focus','Tilt Shift','Lomo Vignette','Heavy Grain',
                    'Light Leak','Double Exposure','Infrared','Solarise','Emboss',
                    'Sketch','Pop Art','Neon Outline','Mosaic'],
};

// ── 104+ FILTER PRESET DATABASE ──────────────────────────
// Each entry: { f: {filter overrides}, grade: 'none|cinematic|warm|cool|noir|vintage', canvas: optional }
const FILTER_DB = {
  // ─ Originals ─
  'Original':         { f:{}, grade:'none' },

  // ─ Cinematic ─
  'Cinematic':        { f:{brightness:90,contrast:115,saturate:75,sepia:8,vignette:35}, grade:'cinematic' },
  'Blockbuster':      { f:{brightness:95,contrast:125,saturate:70,hue:5,shadows:-15,highlights:-10,vignette:40}, grade:'cinematic' },
  'Hollywood':        { f:{brightness:88,contrast:120,saturate:65,temperature:-15,vignette:30}, grade:'cinematic' },
  'Arthouse':         { f:{brightness:85,contrast:130,saturate:50,grain:30,vignette:50}, grade:'noir' },
  'Epic':             { f:{brightness:92,contrast:118,saturate:85,hue:-8,clarity:20,vignette:35}, grade:'cinematic' },
  'Teal & Orange':    { f:{brightness:95,contrast:110,saturate:90,temperature:15,tint:-10}, grade:'cinematic' },
  'Dark Moody':       { f:{brightness:80,contrast:125,saturate:60,shadows:-20,blacks:-15,vignette:60}, grade:'noir' },
  'Silver Toning':    { f:{brightness:95,contrast:110,saturate:30,sepia:15,grain:20}, grade:'none' },
  'Film Noir':        { f:{brightness:85,contrast:150,saturate:0,vignette:60}, grade:'noir' },
  'Neo Noir':         { f:{brightness:80,contrast:140,saturate:20,hue:200,vignette:55}, grade:'noir' },
  'Bronze':           { f:{brightness:100,contrast:110,saturate:80,hue:20,temperature:30,sepia:25}, grade:'warm' },
  'Copper':           { f:{brightness:105,contrast:105,saturate:90,hue:15,temperature:25}, grade:'warm' },
  'Burnt Sienna':     { f:{brightness:95,contrast:112,saturate:85,hue:18,sepia:30}, grade:'warm' },
  'Bleach Bypass':    { f:{brightness:100,contrast:145,saturate:40,vignette:20}, grade:'none' },
  'Crushed Blacks':   { f:{brightness:88,contrast:130,saturate:80,blacks:-25,vignette:30}, grade:'cinematic' },

  // ─ Film Stock ─
  'Fuji Velvia':      { f:{brightness:100,contrast:120,saturate:160,vignette:20}, grade:'none' },
  'Fuji Provia':      { f:{brightness:105,contrast:105,saturate:110,grain:5}, grade:'none' },
  'Fuji Superia':     { f:{brightness:108,contrast:108,saturate:115,hue:-3,grain:8,temperature:8}, grade:'warm' },
  'Kodak Gold':       { f:{brightness:105,contrast:105,saturate:110,hue:12,temperature:20,grain:15}, grade:'warm' },
  'Kodak Ektar':      { f:{brightness:100,contrast:115,saturate:140,grain:8}, grade:'none' },
  'Kodak Portra':     { f:{brightness:108,contrast:95,saturate:85,hue:8,temperature:15,grain:12}, grade:'warm' },
  'Kodak Vision':     { f:{brightness:100,contrast:108,saturate:95,hue:5,grain:10,vignette:15}, grade:'cinematic' },
  'Ilford HP5':       { f:{brightness:100,contrast:120,saturate:0,grain:40}, grade:'none' },
  'Ilford Delta':     { f:{brightness:105,contrast:115,saturate:0,grain:25,vignette:20}, grade:'none' },
  'Polaroid 600':     { f:{brightness:110,contrast:90,saturate:80,sepia:20,grain:25,vignette:30}, grade:'warm' },
  'Lomography':       { f:{brightness:95,contrast:130,saturate:140,grain:50,vignette:60}, grade:'none' },
  'Agfa Vista':       { f:{brightness:105,contrast:108,saturate:120,hue:-5,grain:10}, grade:'none' },
  'Agfa Scala':       { f:{brightness:100,contrast:125,saturate:0,grain:20,vignette:25}, grade:'none' },
  'Cross Process':    { f:{brightness:110,contrast:130,saturate:160,hue:30,invert:0}, grade:'cool' },
  'E6 Slide':         { f:{brightness:95,contrast:125,saturate:130,vignette:15}, grade:'none' },
  'Tungsten':         { f:{brightness:90,contrast:110,saturate:80,hue:-30,temperature:-40}, grade:'cool' },
  'Ektachrome':       { f:{brightness:102,contrast:118,saturate:135,hue:-5,vignette:18}, grade:'none' },

  // ─ Mood ─
  'Warm Glow':        { f:{brightness:108,contrast:105,saturate:115,hue:10,temperature:25,vignette:20}, grade:'warm' },
  'Cool Fade':        { f:{brightness:105,contrast:90,saturate:75,hue:-10,temperature:-20,blacks:10}, grade:'cool' },
  'Dreamy':           { f:{brightness:115,contrast:88,saturate:105,blur:1.5,vignette:25,grain:8}, grade:'warm' },
  'Muted':            { f:{brightness:100,contrast:85,saturate:55,blacks:10}, grade:'none' },
  'Faded':            { f:{brightness:112,contrast:82,saturate:65,sepia:10,blacks:12}, grade:'none' },
  'Hazy':             { f:{brightness:118,contrast:80,saturate:70,blur:1,vignette:20}, grade:'warm' },
  'Melancholy':       { f:{brightness:88,contrast:95,saturate:50,temperature:-15,vignette:40}, grade:'cool' },
  'Euphoric':         { f:{brightness:112,contrast:110,saturate:160,hue:5}, grade:'none' },
  'Nostalgic':        { f:{brightness:105,contrast:95,saturate:80,sepia:25,grain:20,vignette:30}, grade:'warm' },
  'Tranquil':         { f:{brightness:106,contrast:92,saturate:88,temperature:-8,blur:0.3}, grade:'cool' },
  'Stormy':           { f:{brightness:82,contrast:120,saturate:60,temperature:-20,vignette:50}, grade:'cool' },
  'Hopeful':          { f:{brightness:110,contrast:100,saturate:110,temperature:12,highlights:10}, grade:'warm' },
  'Lonely':           { f:{brightness:80,contrast:100,saturate:40,temperature:-25,vignette:55}, grade:'cool' },
  'Electric':         { f:{brightness:105,contrast:120,saturate:180,hue:10,clarity:20}, grade:'none' },

  // ─ Retro ─
  'Retro 70s':        { f:{brightness:105,contrast:95,saturate:100,hue:15,sepia:30,grain:20}, grade:'warm' },
  'Retro 80s':        { f:{brightness:110,contrast:115,saturate:120,hue:-5,grain:15}, grade:'none' },
  'Retro 90s':        { f:{brightness:108,contrast:105,saturate:90,sepia:10,grain:10}, grade:'warm' },
  'VHS':              { f:{brightness:95,contrast:112,saturate:80,grain:35,vignette:40}, grade:'none', canvas:'vhs' },
  'Super 8':          { f:{brightness:105,contrast:108,saturate:85,sepia:20,grain:45,vignette:35}, grade:'warm' },
  'Daguerreotype':    { f:{brightness:90,contrast:130,saturate:0,sepia:60,grain:50,vignette:40}, grade:'warm' },
  'Ambrotype':        { f:{brightness:85,contrast:125,saturate:0,sepia:80,grain:40,vignette:50}, grade:'warm' },
  'Pastel Dream':     { f:{brightness:115,contrast:80,saturate:80,temperature:10,blacks:15}, grade:'warm' },
  'Boho':             { f:{brightness:108,contrast:92,saturate:85,hue:8,sepia:20,vignette:25}, grade:'warm' },
  'Bubblegum':        { f:{brightness:115,contrast:88,saturate:130,hue:-5,temperature:10}, grade:'none' },
  'Lo-Fi':            { f:{brightness:100,contrast:105,saturate:70,grain:30,vignette:35,sepia:8}, grade:'none' },

  // ─ Social ─
  'Instagram':        { f:{brightness:108,contrast:108,saturate:115,clarity:10}, grade:'none' },
  'TikTok Punch':     { f:{brightness:105,contrast:118,saturate:140,clarity:15}, grade:'none' },
  'YouTube Crisp':    { f:{brightness:102,contrast:112,saturate:108,clarity:12,sharpen:20}, grade:'none' },
  'Reels Glow':       { f:{brightness:112,contrast:100,saturate:110,blur:0.3,temperature:8}, grade:'warm' },
  'Story Filter':     { f:{brightness:110,contrast:105,saturate:90,sepia:8,grain:15}, grade:'none' },
  'Influencer':       { f:{brightness:114,contrast:98,saturate:95,temperature:12,blacks:8}, grade:'warm' },
  'VSCO A4':          { f:{brightness:108,contrast:88,saturate:75,hue:5,blacks:12}, grade:'none' },
  'VSCO C1':          { f:{brightness:110,contrast:90,saturate:80,temperature:8,blacks:10}, grade:'warm' },
  'VSCO M5':          { f:{brightness:95,contrast:100,saturate:85,sepia:12,grain:18}, grade:'none' },
  'VSCO P5':          { f:{brightness:112,contrast:92,saturate:70,sepia:8,vignette:20}, grade:'none' },
  'VSCO G3':          { f:{brightness:105,contrast:95,saturate:100,hue:-8,temperature:-5}, grade:'cool' },
  'Presetify':        { f:{brightness:106,contrast:105,saturate:88,temperature:5,vignette:15}, grade:'none' },
  'LightLeak':        { f:{brightness:112,contrast:95,saturate:110,temperature:20,highlights:20}, grade:'warm', canvas:'lightleak' },
  'Airy':             { f:{brightness:118,contrast:85,saturate:85,blacks:18,temperature:8}, grade:'none' },
  'Clean':            { f:{brightness:105,contrast:105,saturate:100,clarity:8}, grade:'none' },

  // ─ Dramatic ─
  'High Drama':       { f:{brightness:88,contrast:140,saturate:80,vignette:50}, grade:'cinematic' },
  'Punchy':           { f:{brightness:100,contrast:130,saturate:135,clarity:20}, grade:'none' },
  'Over-Exposed':     { f:{brightness:150,contrast:75,saturate:80,highlights:40}, grade:'none' },
  'Under-Exposed':    { f:{brightness:55,contrast:120,saturate:90,shadows:-30}, grade:'noir' },
  'Hard Shadow':      { f:{brightness:90,contrast:150,saturate:80,clarity:30}, grade:'noir' },
  'Blown Out':        { f:{brightness:160,contrast:70,saturate:60}, grade:'none' },
  'Dark Room':        { f:{brightness:65,contrast:130,saturate:75,vignette:70}, grade:'noir' },
  'Midnight':         { f:{brightness:60,contrast:120,saturate:60,hue:220,temperature:-30}, grade:'cool' },
  'Eclipse':          { f:{brightness:70,contrast:130,saturate:50,vignette:80}, grade:'noir' },
  'Apocalypse':       { f:{brightness:75,contrast:135,saturate:70,hue:10,sepia:15,vignette:55}, grade:'warm' },
  'Inferno':          { f:{brightness:100,contrast:125,saturate:130,hue:15,temperature:40}, grade:'warm' },
  'Polar':            { f:{brightness:115,contrast:105,saturate:50,temperature:-50,vignette:25}, grade:'cool' },
  'Hellfire':         { f:{brightness:95,contrast:140,saturate:120,hue:20,temperature:50,vignette:45}, grade:'warm' },
  'Frozen':           { f:{brightness:110,contrast:110,saturate:40,temperature:-60,vignette:30}, grade:'cool' },
  'Nuclear':          { f:{brightness:130,contrast:120,saturate:200,hue:-15,vignette:20}, grade:'none' },

  // ─ B&W & Tone ─
  'B&W Natural':      { f:{brightness:100,contrast:110,saturate:0}, grade:'none' },
  'B&W Punchy':       { f:{brightness:95,contrast:150,saturate:0,vignette:30}, grade:'none' },
  'B&W Soft':         { f:{brightness:110,contrast:90,saturate:0,blur:0.5}, grade:'none' },
  'B&W Film':         { f:{brightness:100,contrast:120,saturate:0,grain:30}, grade:'none' },
  'B&W High Key':     { f:{brightness:135,contrast:85,saturate:0}, grade:'none' },
  'B&W Low Key':      { f:{brightness:65,contrast:120,saturate:0,vignette:50}, grade:'none' },
  'Sepia Classic':    { f:{brightness:100,contrast:105,saturate:0,sepia:100}, grade:'warm' },
  'Sepia Faded':      { f:{brightness:110,contrast:88,saturate:0,sepia:70,grain:20}, grade:'warm' },
  'Duotone Blue':     { f:{brightness:100,contrast:110,saturate:0,duotone:'blue-orange'}, grade:'cool' },
  'Duotone Green':    { f:{brightness:100,contrast:110,saturate:0,duotone:'lime-black'}, grade:'none' },
  'Duotone Red':      { f:{brightness:100,contrast:110,saturate:0,duotone:'red-cyan'}, grade:'none' },
  'Duotone Purple':   { f:{brightness:100,contrast:110,saturate:0,duotone:'purple-yellow'}, grade:'none' },
  'Split Tone':       { f:{brightness:100,contrast:108,saturate:0,temperature:15,tint:-10}, grade:'none' },

  // ─ Sci-Fi ─
  'Cyberpunk':        { f:{brightness:100,contrast:120,saturate:200,hue:250,posterize:15}, grade:'cool', canvas:'scanlines' },
  'Neon City':        { f:{brightness:95,contrast:130,saturate:220,hue:270}, grade:'cool' },
  'Digital Glitch':   { f:{brightness:100,contrast:115,saturate:120,glitch:60}, grade:'none', canvas:'scanlines' },
  'Hologram':         { f:{brightness:110,contrast:110,saturate:0,hue:170,invert:10}, grade:'cool', canvas:'scanlines' },
  'Matrix':           { f:{brightness:90,contrast:120,saturate:0,hue:120}, grade:'cool', canvas:'scanlines' },
  'Alien World':      { f:{brightness:95,contrast:115,saturate:160,hue:140}, grade:'cool' },
  'Deep Space':       { f:{brightness:70,contrast:130,saturate:80,hue:240,vignette:60}, grade:'cool' },
  'Vaporwave':        { f:{brightness:105,contrast:110,saturate:160,hue:295,temperature:-10}, grade:'cool' },
  'Synthwave':        { f:{brightness:95,contrast:125,saturate:180,hue:300}, grade:'cool', canvas:'scanlines' },
  'Tech Noir':        { f:{brightness:80,contrast:135,saturate:60,hue:240,vignette:50}, grade:'cool' },
  'Tron':             { f:{brightness:85,contrast:130,saturate:0,hue:200,invert:0}, grade:'cool', canvas:'scanlines' },
  'Blade Runner':     { f:{brightness:75,contrast:125,saturate:80,hue:220,temperature:-20,grain:15,vignette:45}, grade:'cool' },

  // ─ Nature ─
  'Golden Hour':      { f:{brightness:108,contrast:105,saturate:120,hue:12,temperature:35,vignette:20}, grade:'warm' },
  'Blue Hour':        { f:{brightness:90,contrast:105,saturate:90,hue:-15,temperature:-30,vignette:30}, grade:'cool' },
  'Forest Light':     { f:{brightness:100,contrast:108,saturate:130,hue:-15,temperature:10}, grade:'none' },
  'Ocean Blue':       { f:{brightness:100,contrast:110,saturate:130,hue:-20,temperature:-25}, grade:'cool' },
  'Desert Sand':      { f:{brightness:108,contrast:108,saturate:95,hue:20,temperature:30,sepia:15}, grade:'warm' },
  'Overcast':         { f:{brightness:102,contrast:95,saturate:70,temperature:-10,blacks:8}, grade:'cool' },
  'Crisp Morning':    { f:{brightness:108,contrast:108,saturate:100,sharpen:15,clarity:12}, grade:'none' },
  'Sunset Fire':      { f:{brightness:105,contrast:112,saturate:140,hue:15,temperature:40}, grade:'warm' },
  'Arctic Ice':       { f:{brightness:112,contrast:105,saturate:60,temperature:-50,vignette:20}, grade:'cool' },
  'Tropical':         { f:{brightness:108,contrast:110,saturate:155,hue:-5,temperature:10}, grade:'none' },
  'Storm':            { f:{brightness:82,contrast:120,saturate:55,temperature:-25,vignette:55}, grade:'cool' },
  'Fog':              { f:{brightness:115,contrast:78,saturate:55,blur:1.2,vignette:15}, grade:'none' },
  'Autumn':           { f:{brightness:105,contrast:108,saturate:110,hue:18,temperature:25,sepia:12}, grade:'warm' },
  'Spring':           { f:{brightness:112,contrast:96,saturate:120,temperature:8,tint:5}, grade:'none' },

  // ─ Effects ─
  'Glow':             { f:{brightness:118,contrast:92,saturate:110,blur:0.8}, grade:'none' },
  'Soft Focus':       { f:{brightness:112,contrast:88,saturate:95,blur:1.2}, grade:'warm' },
  'Tilt Shift':       { f:{brightness:100,contrast:108,saturate:110}, grade:'none', canvas:'tiltshift' },
  'Lomo Vignette':    { f:{brightness:100,contrast:120,saturate:120,vignette:75,grain:35}, grade:'none' },
  'Heavy Grain':      { f:{brightness:100,contrast:112,saturate:90,grain:70}, grade:'none' },
  'Light Leak':       { f:{brightness:112,contrast:95,saturate:105,temperature:20}, grade:'warm', canvas:'lightleak' },
  'Double Exposure':  { f:{brightness:100,contrast:110,saturate:80,invert:0}, grade:'none', canvas:'double_exp' },
  'Infrared':         { f:{brightness:115,contrast:120,saturate:0,hue:90}, grade:'none' },
  'Solarise':         { f:{brightness:100,contrast:130,saturate:60,invert:40}, grade:'none' },
  'Emboss':           { f:{brightness:108,contrast:140,saturate:0,clarity:40}, grade:'none' },
  'Sketch':           { f:{brightness:120,contrast:160,saturate:0,clarity:50}, grade:'none' },
  'Pop Art':          { f:{brightness:108,contrast:130,saturate:250,posterize:25}, grade:'none' },
  'Neon Outline':     { f:{brightness:85,contrast:145,saturate:220,hue:270}, grade:'cool', canvas:'chromabb' },
  'Mosaic':           { f:{brightness:100,contrast:110,saturate:100}, grade:'none', canvas:'pixelate' },
};

// ── LUT PRESETS ──────────────────────────────────────────
const LUT_PRESETS = {
  fuji:      { brightness:102, contrast:108, saturate:130, grain:8 },
  kodak:     { brightness:105, contrast:108, saturate:115, hue:10, temperature:20, grain:12 },
  polaroid:  { brightness:110, contrast:90,  saturate:85,  sepia:20, vignette:30, grain:20 },
  instagram: { brightness:108, contrast:108, saturate:115, clarity:10 },
  drone:     { brightness:100, contrast:112, saturate:108, temperature:-5, clarity:15 },
  sunset:    { brightness:108, contrast:108, saturate:130, hue:12, temperature:30 },
  arctic:    { brightness:112, contrast:105, saturate:60,  temperature:-40, vignette:20 },
  forest:    { brightness:100, contrast:108, saturate:130, hue:-12 },
};

// ── CANVAS FX LIST ───────────────────────────────────────
const CANVAS_FX_LIST = [
  { id:'none',       label:'None' },
  { id:'scanlines',  label:'Scanlines' },
  { id:'vhs',        label:'VHS' },
  { id:'tiltshift',  label:'Tilt Shift' },
  { id:'lightleak',  label:'Light Leak' },
  { id:'chromabb',   label:'Chroma AB' },
  { id:'rgb_split',  label:'RGB Split' },
  { id:'pixelate',   label:'Pixelate' },
  { id:'halftone',   label:'Halftone' },
  { id:'oldtv',      label:'Old TV' },
  { id:'double_exp', label:'Dbl Expo' },
];

// ── STATE ────────────────────────────────────────────────
let activeFxCat = 'Cinematic';
let fxSearchTerm = '';

// ── CSS FILTER STRING (for swatch previews) ──────────────
function buildCSSFilter(f) {
  const bright = Math.max(0, (f.brightness || 100) + (f.exposure || 0));
  return [
    `brightness(${bright / 100})`,
    `contrast(${(f.contrast || 100) / 100})`,
    `saturate(${(f.saturate || 100) / 100})`,
    `hue-rotate(${f.hue || 0}deg)`,
    `blur(${f.blur || 0}px)`,
    `sepia(${(f.sepia || 0) / 100})`,
    `invert(${(f.invert || 0) / 100})`,
  ].join(' ');
}

// ── CANVAS FILTER STRING (for rendering) ─────────────────
function buildFilterString(f, localT, cl) {
  // pull keyframe overrides if available
  const kfBright = (cl && cl.keyframes) ? getKFValue(cl, 'brightness', localT) : null;
  const kfSat    = (cl && cl.keyframes) ? getKFValue(cl, 'saturate',   localT) : null;
  const bright = Math.max(0,
    ((kfBright !== null ? kfBright : (f.brightness || 100)) + (f.exposure || 0) * 0.5)
  );
  const sat      = (kfSat !== null ? kfSat : (f.saturate || 100)) + (f.vibrance || 0) * 0.5;
  const contrast = (f.contrast || 100) + (f.clarity || 0) * 0.3;
  return [
    `brightness(${bright / 100})`,
    `contrast(${contrast / 100})`,
    `saturate(${sat / 100})`,
    `hue-rotate(${f.hue || 0}deg)`,
    `blur(${f.blur || 0}px)`,
    `sepia(${(f.sepia || 0) / 100})`,
    `invert(${(f.invert || 0) / 100})`,
  ].join(' ');
}

// ── PANEL BUILDER ────────────────────────────────────────
function buildFilterPanel() {
  const cats = Object.keys(FILTER_CATS);

  // Category tabs
  const tabsEl = document.getElementById('filterCatTabs');
  if (tabsEl) {
    tabsEl.innerHTML = cats.map(c =>
      `<button class="filter-cat-btn${c === activeFxCat ? ' on' : ''}"
        onclick="setFxCat('${c}')">${c}</button>`
    ).join('');
  }

  // Preset grid
  const grid = document.getElementById('filterGrid');
  if (!grid) return;
  const names = fxSearchTerm
    ? Object.keys(FILTER_DB).filter(n => n.toLowerCase().includes(fxSearchTerm.toLowerCase()))
    : ['Original', ...(FILTER_CATS[activeFxCat] || [])];

  grid.innerHTML = names.map(name => {
    const p = FILTER_DB[name]; if (!p) return '';
    const fs = buildCSSFilter({ ...DEFAULT_FILTERS, ...p.f });
    return `<div class="filter-card" onclick="applyFilterPreset('${name}')" title="${name}">
      <div class="filter-preview" style="
        background: linear-gradient(135deg,#1a1a2e 20%,#16213e 50%,#2d4a2d 80%);
        filter: ${fs};"></div>
      <div class="filter-label">${name}</div>
    </div>`;
  }).join('');

  // Canvas FX grid
  const cfxGrid = document.getElementById('canvasFxGrid');
  if (cfxGrid) {
    cfxGrid.innerHTML = CANVAS_FX_LIST.map(fx =>
      `<div class="filter-card" id="cfx-btn-${fx.id}"
        onclick="applyCanvasFx('${fx.id}')">
        <div class="filter-label" style="padding:8px 0;">${fx.label}</div>
      </div>`
    ).join('');
  }
}

function setFxCat(cat) {
  activeFxCat = cat;
  buildFilterPanel();
}

function runFilterSearch(val) {
  fxSearchTerm = val;
  buildFilterPanel();
}

// ── APPLY PRESET ─────────────────────────────────────────
function applyFilterPreset(name) {
  const cl = getSelectedClip();
  if (!cl) { toast('Select a clip first', 'warn'); return; }
  const p = FILTER_DB[name]; if (!p) return;
  saveUndo();

  // Merge preset into current filters
  cl.filters = Object.assign({ ...DEFAULT_FILTERS }, p.f);
  cl.colorGrade = p.grade || 'none';
  if (p.canvas) cl.canvasFx = p.canvas;

  // Add to FX stack
  if (!cl.fxStack) cl.fxStack = [];
  if (!cl.fxStack.find(fx => fx.name === name)) {
    cl.fxStack.push({ name, enabled: true, intensity: 100 });
    if (cl.fxStack.length > 8) cl.fxStack.shift();
  }

  loadClipInspector();
  renderPreview();
  renderFxStack();
  toast('Filter: ' + name, 'success');
}

// ── CANVAS FX ────────────────────────────────────────────
function applyCanvasFx(fxId) {
  const cl = getSelectedClip();
  if (!cl) { toast('Select a clip first', 'warn'); return; }
  saveUndo();
  cl.canvasFx = (fxId === 'none') ? null : fxId;
  document.querySelectorAll('[id^="cfx-btn-"]').forEach(el => el.classList.remove('on'));
  const btn = document.getElementById('cfx-btn-' + fxId);
  if (btn) btn.classList.add('on');
  renderPreview();
  toast('Canvas FX: ' + fxId, 'success');
}

// ── LUT APPLY ────────────────────────────────────────────
function applyLUT(lutId) {
  if (!lutId) return;
  const cl = getSelectedClip();
  const lut = LUT_PRESETS[lutId];
  if (!cl || !lut) return;
  saveUndo();
  cl.filters = Object.assign({ ...DEFAULT_FILTERS }, lut);
  loadClipInspector();
  renderPreview();
  toast('LUT: ' + lutId, 'success');
}

// ── CLEAR ALL FX ─────────────────────────────────────────
function clearAllFx() {
  const cl = getSelectedClip();
  if (!cl) return;
  saveUndo();
  cl.filters    = { ...DEFAULT_FILTERS };
  cl.colorGrade = 'none';
  cl.canvasFx   = null;
  cl.fxStack    = [];
  loadClipInspector();
  renderPreview();
  renderFxStack();
  document.querySelectorAll('[id^="cfx-btn-"]').forEach(el => el.classList.remove('on'));
  toast('All effects cleared');
}

// ── FX STACK RENDER ──────────────────────────────────────
function renderFxStack() {
  const el = document.getElementById('fxStack'); if (!el) return;
  const cl = getSelectedClip();
  if (!cl || !cl.fxStack || !cl.fxStack.length) {
    el.innerHTML = '<div style="font-size:9px;color:var(--text3);font-family:var(--mono);padding:4px 0;">No effects — click a preset to apply</div>';
    return;
  }
  el.innerHTML = cl.fxStack.map((fx, i) => `
    <div class="fx-stack-item">
      <div class="fx-stack-header">
        <div class="fx-stack-name">${fx.name}</div>
        <div class="fx-toggle${fx.enabled ? '' : ' off'}"
          onclick="toggleFxEnabled(${i})" title="Toggle effect"></div>
        <button class="fx-del" onclick="removeFxFromStack(${i})">×</button>
      </div>
      <div class="fx-intensity-row">
        <label>Intensity</label>
        <input type="range" min="0" max="100" value="${fx.intensity}"
          oninput="setFxIntensity(${i}, +this.value); this.nextElementSibling.textContent = this.value + '%'">
        <span>${fx.intensity}%</span>
      </div>
    </div>`
  ).join('');
}

function toggleFxEnabled(i) {
  const cl = getSelectedClip(); if (!cl || !cl.fxStack) return;
  cl.fxStack[i].enabled = !cl.fxStack[i].enabled;
  applyFxStack(cl);
  renderFxStack();
  renderPreview();
}

function removeFxFromStack(i) {
  const cl = getSelectedClip(); if (!cl || !cl.fxStack) return;
  saveUndo();
  cl.fxStack.splice(i, 1);
  applyFxStack(cl);
  renderFxStack();
  renderPreview();
}

function setFxIntensity(i, val) {
  const cl = getSelectedClip(); if (!cl || !cl.fxStack) return;
  cl.fxStack[i].intensity = val;
  applyFxStack(cl);
  renderPreview();
}

// Blend all active FX in stack by intensity
function applyFxStack(cl) {
  const merged = { ...DEFAULT_FILTERS };
  (cl.fxStack || [])
    .filter(fx => fx.enabled)
    .forEach(fx => {
      const p = FILTER_DB[fx.name]; if (!p) return;
      const t = fx.intensity / 100;
      Object.entries(p.f).forEach(([k, v]) => {
        if (typeof v === 'number') {
          const def = DEFAULT_FILTERS[k] !== undefined ? DEFAULT_FILTERS[k] : 0;
          merged[k] = (merged[k] !== undefined ? merged[k] : def) + (v - def) * t;
        }
      });
      if (p.grade && p.grade !== 'none') cl.colorGrade = p.grade;
      if (p.canvas) cl.canvasFx = p.canvas;
    });
  cl.filters = merged;
}

// ── COLOR GRADE OVERLAY ──────────────────────────────────
// Called after drawing each clip on the main canvas
function applyColorGrade(ctx, grade, f, cw, W, H) {
  if (!f && !grade && !cw) return;
  ctx.save();

  // Temperature tint
  const temp = f ? (f.temperature || 0) : 0;
  if (temp > 0) {
    ctx.fillStyle = `rgba(255,${Math.max(0,140-temp)},0,${temp/700})`;
    ctx.fillRect(0, 0, W, H);
  } else if (temp < 0) {
    ctx.fillStyle = `rgba(0,${Math.max(0,120+temp)},255,${Math.abs(temp)/700})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Green-magenta tint
  const tint = f ? (f.tint || 0) : 0;
  if (tint > 0) {
    ctx.fillStyle = `rgba(255,0,255,${tint/900})`; ctx.fillRect(0,0,W,H);
  } else if (tint < 0) {
    ctx.fillStyle = `rgba(0,255,0,${Math.abs(tint)/900})`; ctx.fillRect(0,0,W,H);
  }

  // Highlights / shadows / whites / blacks
  if (f && f.highlights > 0) {
    ctx.fillStyle = `rgba(255,255,255,${f.highlights/900})`; ctx.fillRect(0,0,W,H);
  }
  if (f && f.shadows < 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.abs(f.shadows)/600})`; ctx.fillRect(0,0,W,H);
  }
  if (f && f.whites > 0) {
    ctx.fillStyle = `rgba(255,255,255,${f.whites/1200})`; ctx.fillRect(0,0,W,H);
  }
  if (f && f.blacks < 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.abs(f.blacks)/700})`; ctx.fillRect(0,0,W,H);
  }

  // Color wheels
  if (cw) {
    const sh = cw.shadows || {};
    const hi = cw.highlights || {};
    const md = cw.mids || {};
    if (sh.s > 2) {
      ctx.fillStyle = `hsla(${sh.h},${sh.s}%,50%,${sh.s/900})`;
      ctx.fillRect(0,0,W,H);
    }
    if (hi.s > 2) {
      ctx.fillStyle = `hsla(${hi.h},${hi.s}%,70%,${hi.s/650})`;
      ctx.fillRect(0,0,W,H);
    }
    if (md.s > 2) {
      ctx.fillStyle = `hsla(${md.h},${md.s}%,60%,${md.s/800})`;
      ctx.fillRect(0,0,W,H);
    }
    if (cw.lift) {
      ctx.fillStyle = `rgba(${cw.lift>0?255:0},${cw.lift>0?255:0},${cw.lift>0?255:0},${Math.abs(cw.lift)/1600})`;
      ctx.fillRect(0,0,W,H);
    }
    if (cw.gamma) {
      ctx.globalAlpha = Math.abs(cw.gamma) / 2000;
      ctx.fillStyle = cw.gamma > 0 ? '#fff' : '#000';
      ctx.fillRect(0,0,W,H);
      ctx.globalAlpha = 1;
    }
    if (cw.gain) {
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0,cw.gain)/1800})`;
      ctx.fillRect(0,0,W,H);
    }
  }

  // Grade color cast
  const fills = {
    cinematic: 'rgba(0,5,30,0.17)',
    warm:      'rgba(45,18,0,0.15)',
    cool:      'rgba(0,12,45,0.15)',
    noir:      'rgba(0,0,0,0.27)',
    vintage:   'rgba(55,28,0,0.13)',
  };
  if (grade && fills[grade]) {
    ctx.fillStyle = fills[grade]; ctx.fillRect(0,0,W,H);
  }

  // Vignette
  const vig = f ? (f.vignette || 0) : 0;
  if (vig > 0) {
    const vg = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${vig / 155})`);
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
  }

  // Film grain
  const grain = f ? (f.grain || 0) : 0;
  if (grain > 0) {
    for (let i = 0; i < grain * 22; i++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() * grain / 480})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
  }

  // Duotone
  if (f && f.duotone && f.duotone !== 'none') {
    const dt = {
      'lime-black':     ['rgba(200,255,0,0.32)',  'rgba(0,0,0,0.52)'],
      'blue-orange':    ['rgba(30,80,255,0.26)',   'rgba(255,120,0,0.26)'],
      'purple-yellow':  ['rgba(120,0,255,0.26)',   'rgba(255,200,0,0.26)'],
      'red-cyan':       ['rgba(255,0,60,0.26)',    'rgba(0,220,200,0.26)'],
      'pink-teal':      ['rgba(255,80,160,0.26)',  'rgba(0,200,180,0.26)'],
    };
    const pair = dt[f.duotone];
    if (pair) {
      ctx.fillStyle = pair[0]; ctx.fillRect(0,0,W,H);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = pair[1]; ctx.fillRect(0,0,W,H);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // Glitch lines
  const glitch = f ? (f.glitch || 0) : 0;
  if (glitch > 0 && Math.random() < glitch / 100 * 0.4) {
    const canvas = ctx.canvas;
    const lines = Math.floor(glitch / 15) + 1;
    for (let i = 0; i < lines; i++) {
      const gy = Math.random() * H;
      const gh = 1 + Math.random() * 5;
      const gx = (Math.random() - 0.5) * glitch * 0.5;
      try { ctx.drawImage(canvas, 0, gy, W, gh, gx, gy, W, gh); } catch(e) {}
      if (Math.random() < 0.3) {
        ctx.fillStyle = `rgba(200,255,0,${Math.random() * 0.4})`;
        ctx.fillRect(0, gy, W, gh);
      }
    }
  }

  // Posterize simulation (discrete brightness stepping)
  if (f && f.posterize > 0) {
    ctx.globalAlpha = f.posterize / 300;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ── CANVAS FX DRAW ───────────────────────────────────────
function applyCanvasFxDraw(ctx, fxId, W, H) {
  if (!fxId || fxId === 'none') return;
  const canvas = ctx.canvas;
  ctx.save();

  switch (fxId) {
    case 'scanlines':
      for (let y = 0; y < H; y += 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, y, W, 1.5);
      }
      break;

    case 'vhs':
      // Horizontal noise lines
      for (let y = 0; y < H; y += 4) {
        if (Math.random() < 0.07) {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(0, y, W, 2);
        }
      }
      // colour fringe
      ctx.fillStyle = 'rgba(200,255,0,0.025)';
      ctx.fillRect(0, 0, W, H);
      // horizontal sync glitch strip
      if (Math.random() < 0.15) {
        const gy = Math.random() * H;
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, gy, W, 3);
      }
      break;

    case 'tiltshift': {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0,    'rgba(0,0,0,0.55)');
      g.addColorStop(0.22, 'rgba(0,0,0,0)');
      g.addColorStop(0.78, 'rgba(0,0,0,0)');
      g.addColorStop(1,    'rgba(0,0,0,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      break;
    }

    case 'lightleak': {
      const g = ctx.createRadialGradient(W*0.82, H*0.12, 0, W*0.82, H*0.12, W*0.62);
      g.addColorStop(0,   'rgba(255,200,50,0.38)');
      g.addColorStop(0.5, 'rgba(255,100,0,0.14)');
      g.addColorStop(1,   'rgba(255,50,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // second leak
      const g2 = ctx.createRadialGradient(W*0.1, H*0.88, 0, W*0.1, H*0.88, W*0.35);
      g2.addColorStop(0,   'rgba(255,150,0,0.22)');
      g2.addColorStop(1,   'rgba(255,50,0,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
      break;
    }

    case 'chromabb':
      try {
        ctx.globalAlpha = 0.45;
        ctx.drawImage(canvas, 3, 0, W, H);
        ctx.globalAlpha = 0.28;
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(canvas, -3, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      } catch(e) {}
      break;

    case 'rgb_split':
      try {
        ctx.globalAlpha = 0.38;
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(canvas, 6, 0, W, H);
        ctx.drawImage(canvas, -6, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      } catch(e) {}
      break;

    case 'pixelate': {
      const ps = Math.max(4, Math.floor(W / 55));
      ctx.imageSmoothingEnabled = false;
      const tmp = document.createElement('canvas');
      tmp.width = Math.ceil(W / ps); tmp.height = Math.ceil(H / ps);
      const t2 = tmp.getContext('2d');
      t2.drawImage(canvas, 0, 0, tmp.width, tmp.height);
      ctx.drawImage(tmp, 0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      break;
    }

    case 'halftone': {
      const gs = 8;
      for (let gy = gs; gy < H; gy += gs * 2) {
        for (let gx = gs; gx < W; gx += gs * 2) {
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.beginPath();
          ctx.arc(gx, gy, gs * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'oldtv':
      // scanlines
      for (let y = 0; y < H; y += 2) {
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.fillRect(0, y, W, 1);
      }
      // noise
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.045})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 2, 1);
      }
      // vignette
      {
        const v = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.82);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.58)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }
      break;

    case 'double_exp':
      try {
        ctx.globalAlpha = 0.38;
        ctx.globalCompositeOperation = 'screen';
        // flip and overlay self
        ctx.translate(W, 0); ctx.scale(-1, 1);
        ctx.drawImage(canvas, 0, 0, W, H);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      } catch(e) {}
      break;
  }

  ctx.restore();
}

// ── COLOR WHEEL RENDERING ────────────────────────────────
function drawColorWheel(canvas, state) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  ctx.clearRect(0, 0, size, size);

  // Hue ring
  for (let a = 0; a < 360; a++) {
    const startA = (a - 1.5) * Math.PI / 180;
    const endA   = (a + 1.5) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startA, endA);
    ctx.closePath();
    ctx.fillStyle = `hsl(${a},100%,50%)`;
    ctx.fill();
  }

  // Saturation gradient (white center)
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0,   'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = grad; ctx.fill();

  // Border
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();

  // Indicator dot
  const s = state || { h: 0, s: 0 };
  if (s.s > 0) {
    const px = cx + Math.cos(s.h * Math.PI / 180) * (s.s / 100 * r);
    const py = cy + Math.sin(s.h * Math.PI / 180) * (s.s / 100 * r);
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI*2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  }
}

function drawAllColorWheels(cw) {
  if (!cw) cw = { shadows:{h:0,s:0}, mids:{h:0,s:0}, highlights:{h:0,s:0} };
  ['shadows','mids','highlights'].forEach(zone => {
    const name  = zone.charAt(0).toUpperCase() + zone.slice(1);
    const el    = document.getElementById('cw' + name);
    if (el) drawColorWheel(el, cw[zone] || { h:0, s:0 });
  });
}

function initColorWheels() {
  ['Shadows','Mids','Highlights'].forEach(name => {
    const canvas = document.getElementById('cw' + name); if (!canvas) return;
    const zone   = name.toLowerCase();

    canvas.addEventListener('mousedown', e => {
      const onMove = ev => {
        const rect = canvas.getBoundingClientRect();
        const size = canvas.width;
        const cx = size / 2, cy = size / 2, r = size / 2 - 4;
        const mx = (ev.clientX - rect.left) * (size / rect.width);
        const my = (ev.clientY - rect.top)  * (size / rect.height);
        const dx = mx - cx, dy = my - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > r + 6) return;
        const h = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        const s = Math.min(dist / r * 100, 100);
        const cl = (typeof getSelectedClip === 'function') ? getSelectedClip() : null;
        if (cl) {
          if (!cl.colorWheels) cl.colorWheels = {};
          if (!cl.colorWheels[zone]) cl.colorWheels[zone] = { h:0, s:0 };
          cl.colorWheels[zone].h = h;
          cl.colorWheels[zone].s = s;
          drawAllColorWheels(cl.colorWheels);
          if (typeof renderPreview === 'function') renderPreview();
        }
      };
      onMove(e);
      const up = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', up);
    });
  });

  drawAllColorWheels({ shadows:{h:0,s:0}, mids:{h:0,s:0}, highlights:{h:0,s:0} });
}

function onWheelSlider(key, val) {
  const cl = (typeof getSelectedClip === 'function') ? getSelectedClip() : null;
  if (!cl) return;
  if (!cl.colorWheels) cl.colorWheels = {};
  cl.colorWheels[key] = val;
  if (typeof renderPreview === 'function') renderPreview();
}

function onWheelMaster(zone, axis, val) {
  const cl = (typeof getSelectedClip === 'function') ? getSelectedClip() : null;
  if (!cl) return;
  if (!cl.colorWheels) cl.colorWheels = {};
  if (!cl.colorWheels[zone]) cl.colorWheels[zone] = { h:0, s:0, l:0 };
  cl.colorWheels[zone].l = val;
  if (typeof renderPreview === 'function') renderPreview();
}

// ── CAPTION STYLE PRESETS ────────────────────────────────
const CAPTION_STYLE_PRESETS = {
  mannorr:  { size:26, color:'#c8ff00', bg:'bar',   pos:'bottom', font:'DM Mono' },
  neon:     { size:30, color:'#c8ff00', bg:'none',  pos:'bottom', font:'Syne', glow:true },
  subtitle: { size:22, color:'#ffffff', bg:'semi',  pos:'bottom', font:'DM Mono' },
  top:      { size:22, color:'#ffffff', bg:'bar',   pos:'top',    font:'DM Mono' },
  big:      { size:42, color:'#ffffff', bg:'box',   pos:'bottom', font:'Syne' },
  word:     { size:34, color:'#c8ff00', bg:'none',  pos:'bottom', font:'Syne', wordPop:true },
};

function applyCaptionPreset(id) {
  const p = CAPTION_STYLE_PRESETS[id]; if (!p) return;
  if (typeof captionStyle !== 'undefined') {
    Object.assign(captionStyle, p);
  }
}

// Render captions on canvas
function renderCaptionOnCanvas(ctx, captions, playhead, style, W, H) {
  const active = captions.filter(c => playhead >= c.start && playhead <= c.end);
  if (!active.length) return;
  const text = active.map(c => c.text).join(' ');
  if (!text) return;

  const sz = Math.round((style.size || 26) * (W / 1280));
  const col = style.color || '#ffffff';
  const pos = style.pos || 'bottom';

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const font = style.font || 'DM Mono';
  ctx.font = `500 ${sz}px '${font}', monospace`;

  const tw = ctx.measureText(text).width;
  const yPos = pos === 'top' ? H * 0.08 : pos === 'mid' ? H * 0.5 : H * 0.88;

  const bg = style.bg;
  if (bg === 'bar') {
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, yPos - sz - 10, W, sz + 24);
    ctx.fillStyle = col;
    ctx.fillRect(0, yPos - sz - 10, 3, sz + 24); // accent bar
  } else if (bg === 'semi') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W/2 - tw/2 - 12, yPos - sz/2 - 6, tw + 24, sz + 16);
  } else if (bg === 'box') {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(W/2 - tw/2 - 16, yPos - sz/2 - 10, tw + 32, sz + 24);
  }

  if (style.glow) {
    ctx.shadowColor = col;
    ctx.shadowBlur  = 18;
  }

  ctx.fillStyle = col;
  ctx.fillText(text, W/2, yPos);
  ctx.shadowBlur = 0;
  ctx.restore();
}

