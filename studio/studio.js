/* ══════════════════════════════════════════════════════════
   MANNORR STUDIO v4 — Main Engine (studio.js)
   State · Timeline · Playback · Canvas · Clips · Audio
   Export · Captions · Keyframes · Autosave · Shortcuts
   ══════════════════════════════════════════════════════════ */

'use strict';

// ── UTILS ────────────────────────────────────────────────
function id(x) { return document.getElementById(x); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2,'0')}:${sec}`;
}
function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

let _toastTimer = null;
function toast(msg, type = '') {
  const el = id('toast'); if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── STATE ────────────────────────────────────────────────
let tracks = [
  { id: 'v1', type: 'video', label: 'Video 1', clips: [], muted: false, locked: false },
  { id: 'v2', type: 'video', label: 'Video 2', clips: [], muted: false, locked: false },
  { id: 'a1', type: 'audio', label: 'Audio 1', clips: [], muted: false, locked: false },
];
let mediaItems   = [];
let captions     = [];
let markers      = [];
let textClips    = [];   // managed separately, placed on text track
let captionStyle = { size: 26, color: '#ffffff', bg: 'semi', pos: 'bottom', font: 'DM Mono' };

let playhead       = 0;
let playing        = false;
let playTimer      = null;
let selectedClipId = null;
let multiSelected  = new Set();
let pxPerSec       = 100;
let snapToGrid     = true;
let snapToClips    = true;
let undoStack      = [];
let redoStack      = [];
let previewW       = 640;
let previewH       = 360;
let volume         = 1;
let canvasAspect   = { w: 16, h: 9 };
let globalFitMode  = 'contain';
let scaleLinkOn    = true;
let selectedMarkerId = null;
let projectName    = 'Untitled Project';
let isDirty        = false;
let autosaveTimer  = null;
let speechRec      = null;
let captionStartT  = 0;

// Canvas elements
const previewCanvas = id('previewCanvas');
const ctx2d         = previewCanvas.getContext('2d');
const handleCanvas  = id('handleCanvas');
const hctx          = handleCanvas.getContext('2d');

// Audio context
let AC = null, masterGain = null;
function initAudio() {
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(AC.destination);
  } catch(e) { AC = null; }
}

// ── ASPECT RATIO & CANVAS SIZE ───────────────────────────
function changeAspect(val) {
  const [w, h] = val.split(':').map(Number);
  canvasAspect = { w, h };
  resizePreviewCanvas();
  toast('Canvas: ' + val, 'success');
}

function toggleFitMode() {
  globalFitMode = globalFitMode === 'contain' ? 'cover' : 'contain';
  id('fitModeBtn').textContent = globalFitMode === 'contain' ? '⬜ Fit' : '⬛ Fill';
  renderPreview();
}

function resizePreviewCanvas() {
  const center = id('centerPane'); if (!center) return;
  const maxW = center.offsetWidth  - 40;
  const maxH = center.offsetHeight - 108;
  if (maxW <= 0 || maxH <= 0) return;
  const ratio = canvasAspect.w / canvasAspect.h;
  let cw = Math.min(maxW, maxH * ratio);
  let ch = cw / ratio;
  if (ch > maxH) { ch = maxH; cw = ch * ratio; }
  cw = Math.round(cw); ch = Math.round(ch);
  [previewCanvas, handleCanvas].forEach(c => {
    if (!c) return;
    c.width  = cw; c.height = ch;
    c.style.width  = cw + 'px';
    c.style.height = ch + 'px';
  });
  const ov = id('dragOverlay');
  if (ov) { ov.style.width = cw + 'px'; ov.style.height = ch + 'px'; }
  previewW = cw; previewH = ch;
  renderPreview();
}

function calcDrawRect(srcW, srcH, dstW, dstH, mode, offX, offY, scale) {
  const s  = scale || 1;
  const ar = srcW / srcH;
  const dr = dstW / dstH;
  let dw, dh;
  if (mode === 'cover') {
    if (ar < dr) { dw = dstW * s; dh = dw / ar; }
    else         { dh = dstH * s; dw = dh * ar; }
  } else {
    if (ar > dr) { dw = dstW * s; dh = dw / ar; }
    else         { dh = dstH * s; dw = dh * ar; }
  }
  return { dx: dstW/2 - dw/2 + (offX||0), dy: dstH/2 - dh/2 + (offY||0), dw, dh };
}

// ── IMPORT ───────────────────────────────────────────────
function triggerImport() { id('fileInput').click(); }

function handleDrop(e) {
  e.preventDefault();
  id('mediaDrop').classList.remove('drag-over');
  [...e.dataTransfer.files].forEach(processFile);
}

function importFiles(input) {
  [...input.files].forEach(processFile);
  input.value = '';
}

function processFile(file) {
  if (AC) AC.resume().catch(() => {});
  const url  = URL.createObjectURL(file);
  const type = file.type.startsWith('video') ? 'video'
             : file.type.startsWith('audio') ? 'audio'
             : 'image';
  const item = {
    id: 'm' + Date.now() + Math.random().toString(36).slice(2),
    name: file.name, url, type, file,
    duration: 0, thumbUrl: null, naturalW: 0, naturalH: 0,
    waveformData: null,
  };

  if (type === 'video') {
    const el = document.createElement('video');
    el.src = url; el.preload = 'metadata';
    el.addEventListener('loadedmetadata', () => {
      item.duration = el.duration;
      item.naturalW = el.videoWidth;
      item.naturalH = el.videoHeight;
      makeThumbnail(el, item);
      renderMediaList();
    });
  } else if (type === 'audio') {
    const el = document.createElement('audio');
    el.src = url;
    el.addEventListener('loadedmetadata', () => {
      item.duration = el.duration;
      generateWaveform(item);
      renderMediaList();
    });
  } else {
    const img = new Image(); img.src = url;
    img.onload = () => {
      item.naturalW = img.naturalWidth;
      item.naturalH = img.naturalHeight;
      item.duration = 5;
      renderMediaList();
    };
  }
  mediaItems.push(item);
  renderMediaList();
  toast('Imported: ' + file.name, 'success');
}

function makeThumbnail(videoEl, item) {
  const c = document.createElement('canvas');
  c.width = 58; c.height = 36;
  const ctx = c.getContext('2d');
  videoEl.currentTime = 0.1;
  videoEl.addEventListener('seeked', () => {
    try {
      const r = calcDrawRect(item.naturalW || videoEl.videoWidth, item.naturalH || videoEl.videoHeight, 58, 36, 'contain', 0, 0, 1);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 58, 36);
      ctx.drawImage(videoEl, r.dx, r.dy, r.dw, r.dh);
      item.thumbUrl = c.toDataURL();
    } catch(e) {}
    renderMediaList();
  }, { once: true });
}

// Waveform data generation via Web Audio AnalyserNode
function generateWaveform(item) {
  if (!AC || !item.url) return;
  fetch(item.url)
    .then(r => r.arrayBuffer())
    .then(buf => AC.decodeAudioData(buf))
    .then(decoded => {
      const raw = decoded.getChannelData(0);
      const samples = 200;
      const blockSize = Math.floor(raw.length / samples);
      const data = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(raw[i * blockSize + j] || 0);
        }
        data[i] = sum / blockSize;
      }
      // normalise
      const max = Math.max(...data, 0.001);
      item.waveformData = data.map(v => v / max);
      renderMediaList();
      renderTL();
    })
    .catch(() => {});
}

function renderMediaList() {
  const list = id('mediaList'); if (!list) return;
  list.innerHTML = mediaItems.map(item => `
    <div class="media-item" onclick="selectMediaItem('${item.id}')">
      <div class="media-thumb">
        ${item.thumbUrl
          ? `<img src="${item.thumbUrl}" alt="${item.name}">`
          : `<div class="media-thumb-icon">${item.type==='video'?'🎬':item.type==='audio'?'🎵':'🖼'}</div>`}
      </div>
      <div class="media-info">
        <div class="media-name">${item.name}</div>
        <div class="media-meta">${item.type}${item.naturalW ? ` · ${item.naturalW}×${item.naturalH}` : ''} · ${fmtTime(item.duration || 0)}</div>
      </div>
      <button class="media-add" onclick="addToTimeline('${item.id}', event)" title="Add to timeline">+</button>
    </div>`
  ).join('');
}

function selectMediaItem(itemId) {
  renderMediaList();
}

// ── CLIP FACTORY ─────────────────────────────────────────
function makeClip(item, trackId, trackStart) {
  return {
    id:         'c' + Date.now() + Math.random().toString(36).slice(2),
    mediaId:    item.id,
    name:       item.name.replace(/\.[^/.]+$/, ''),
    type:       'media',
    trackId,    trackStart,
    trimIn:     0, trimOut: item.duration || 5,
    speed:      1, volume: 1, mute: false,
    offsetX:    0, offsetY: 0,
    scaleX:     100, scaleY: 100,
    rotation:   0, opacity: 100,
    fitMode:    'contain', flipH: false, flipV: false,
    kenBurns: false, kbStartScale: 100, kbEndScale: 120, kbDir: 'tl-br',
    maskType: 'none', maskFeather: 0, maskInvert: false,
    cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0,
    chromaKey: false, chromaColor: '#00ff00', chromaTol: 30, chromaFeather: 5,
    motionBlur: 0,
    transIn: 'none', transInDur: 15,
    filters:     { ...DEFAULT_FILTERS },
    colorGrade:  'none', canvasFx: null,
    colorWheels: { shadows:{h:0,s:0}, mids:{h:0,s:0}, highlights:{h:0,s:0}, lift:0, gamma:0, gain:0 },
    fxStack:    [],
    keyframes:  {},
  };
}

function makeTitleClip(tmpl, trackId, trackStart) {
  return {
    id:         'tc' + Date.now() + Math.random().toString(36).slice(2),
    type:       'title',
    templateId: tmpl.id, name: tmpl.name,
    trackId,    trackStart,
    trimIn:     0, trimOut: 4, speed: 1,
    text:       'YOUR TITLE',
    font:       tmpl.font, fontWeight: tmpl.weight,
    fontSize:   tmpl.size, color: tmpl.color,
    align:      tmpl.align, anim: tmpl.anim,
    bg:         tmpl.bg, yPos: 50,
    opacity:    100, offsetX: 0, offsetY: 0,
    stroke:     '#000000', strokeWidth: 0, shadowBlur: 8,
    keyframes:  {},
  };
}

function makeTextClip(trackId, trackStart) {
  return {
    id:         'xt' + Date.now() + Math.random().toString(36).slice(2),
    type:       'text',
    name:       'Text',
    trackId,    trackStart,
    trimIn:     0, trimOut: 3, speed: 1,
    text:       'YOUR TEXT',
    font:       'Syne', fontWeight: 700,
    fontSize:   64, color: '#c8ff00',
    align:      'center', yPos: 50,
    opacity:    100, offsetX: 0, offsetY: 0,
    anim:       'fade',
    stroke:     '#000000', strokeWidth: 0, shadowBlur: 8,
    keyframes:  {},
  };
}

// ── ADD TO TIMELINE ──────────────────────────────────────
function addToTimeline(itemId, e) {
  if (e) e.stopPropagation();
  const item = mediaItems.find(m => m.id === itemId); if (!item) return;
  saveUndo();
  const track = tracks.find(t =>
    t.type === (item.type === 'audio' ? 'audio' : 'video')
  ) || tracks[0];
  if (track.locked) { toast('Track is locked', 'warn'); return; }
  const endTime = track.clips.reduce(
    (mx, c) => Math.max(mx, c.trackStart + (c.trimOut - c.trimIn) / c.speed), 0
  );
  const clip = makeClip(item, track.id, endTime);
  track.clips.push(clip);
  selectedClipId = clip.id;
  multiSelected.clear();
  renderTL(); loadClipInspector(); renderPreview(); drawHandles();
  markDirty();
  toast('Added: ' + item.name, 'success');
}

// ── TITLE TEMPLATES ──────────────────────────────────────
const TITLE_TEMPLATES = [
  { id:'big_center',  name:'Big Center',   font:'Syne',             weight:800, size:80, color:'#e8e4df', align:'center', anim:'fade',   bg:'none'      },
  { id:'accent_lower',name:'Accent Lower', font:'DM Mono',          weight:400, size:30, color:'#c8ff00', align:'left',   anim:'slide_l', bg:'bar'       },
  { id:'cinematic',   name:'Cinematic',    font:'Syne',             weight:700, size:56, color:'#ffffff', align:'center', anim:'zoom',   bg:'letterbox'  },
  { id:'minimal',     name:'Minimal',      font:'DM Mono',          weight:300, size:26, color:'rgba(232,228,223,0.72)', align:'right', anim:'fade', bg:'none' },
  { id:'neon_glow',   name:'Neon Glow',    font:'Syne',             weight:800, size:64, color:'#c8ff00', align:'center', anim:'zoom',   bg:'none'      },
  { id:'editorial',   name:'Editorial',    font:'Instrument Serif', weight:400, size:72, color:'#e8e4df', align:'center', anim:'fade',   bg:'none'      },
  { id:'bold_left',   name:'Bold Left',    font:'Syne',             weight:800, size:52, color:'#ffffff', align:'left',   anim:'slide_l', bg:'none'      },
  { id:'typewriter',  name:'Typewriter',   font:'DM Mono',          weight:400, size:36, color:'#c8ff00', align:'center', anim:'typewriter', bg:'none'   },
];

function buildTitlePanel() {
  const list = id('titleTemplateList'); if (!list) return;
  list.innerHTML = TITLE_TEMPLATES.map(t => {
    const italic = t.font === 'Instrument Serif' ? 'italic ' : '';
    return `<div class="title-card" onclick="addTitleClip('${t.id}')">
      <div class="title-card-preview" style="background:${t.bg==='letterbox'?'#000':'var(--bg3)'}">
        <span style="font-family:'${t.font}',serif;font-weight:${t.weight};font-size:${Math.round(t.size*0.22)}px;color:${t.color};font-style:${italic?'italic':'normal'};letter-spacing:${t.weight>=700?.06:0}em;">${t.name.toUpperCase()}</span>
      </div>
      <div class="title-card-name">${t.name}</div>
    </div>`;
  }).join('');
}

function addTitleClip(templateId) {
  saveUndo();
  const tmpl = TITLE_TEMPLATES.find(t => t.id === templateId); if (!tmpl) return;
  let track = ensureTitleTrack();
  if (track.locked) { toast('Track is locked', 'warn'); return; }
  const clip = makeTitleClip(tmpl, track.id, playhead);
  track.clips.push(clip);
  selectedClipId = clip.id;
  multiSelected.clear();
  renderTL(); loadClipInspector(); renderPreview();
  markDirty();
  toast('Title added: ' + tmpl.name, 'success');
}

function ensureTitleTrack() {
  let t = tracks.find(tr => tr.type === 'title');
  if (!t) {
    t = { id:'title_'+Date.now(), type:'title', label:'Titles', clips:[], muted:false, locked:false };
    tracks.push(t);
    renderTL();
  }
  return t;
}

function addTextClip() {
  saveUndo();
  let track = ensureTextTrack();
  if (track.locked) { toast('Track is locked', 'warn'); return; }
  const clip = makeTextClip(track.id, playhead);
  track.clips.push(clip);
  selectedClipId = clip.id;
  multiSelected.clear();
  renderTL(); loadClipInspector(); renderPreview();
  markDirty();
  toast('Text clip added', 'success');
}

function ensureTextTrack() {
  let t = tracks.find(tr => tr.type === 'text');
  if (!t) {
    t = { id:'text_'+Date.now(), type:'text', label:'Text', clips:[], muted:false, locked:false };
    tracks.push(t);
    renderTL();
  }
  return t;
}

// ── CLIP OPERATIONS ──────────────────────────────────────
function getAllClips() {
  return tracks.flatMap(t => t.clips);
}

function getSelectedClip() {
  for (const tr of tracks)
    for (const cl of tr.clips)
      if (cl.id === selectedClipId) return cl;
  return null;
}

function getClipTrack(clipId) {
  return tracks.find(t => t.clips.some(c => c.id === clipId));
}

function selectClip(clipId, addToMulti = false) {
  if (addToMulti) {
    multiSelected.has(clipId) ? multiSelected.delete(clipId) : multiSelected.add(clipId);
  } else {
    selectedClipId = clipId;
    multiSelected.clear();
  }
  renderTL(); loadClipInspector(); renderPreview(); drawHandles();
}

function deleteSelectedClip() {
  if (!selectedClipId && multiSelected.size === 0) return;
  saveUndo();
  const toDelete = new Set([selectedClipId, ...multiSelected]);
  tracks.forEach(t => { t.clips = t.clips.filter(c => !toDelete.has(c.id)); });
  selectedClipId = null; multiSelected.clear();
  renderTL(); loadClipInspector(); renderPreview(); clearHandles();
  markDirty();
  toast('Deleted');
}

function rippleDelete() {
  const cl = getSelectedClip(); if (!cl) return;
  saveUndo();
  const tr = getClipTrack(cl.id); if (!tr) return;
  const dur = (cl.trimOut - cl.trimIn) / cl.speed;
  const start = cl.trackStart;
  tr.clips = tr.clips.filter(c => c.id !== cl.id);
  tracks.forEach(track => {
    track.clips.forEach(c => {
      if (c.trackStart >= start + dur)
        c.trackStart = Math.max(0, c.trackStart - dur);
      else if (c.trackStart > start)
        c.trackStart = start;
    });
  });
  selectedClipId = null; multiSelected.clear();
  renderTL(); loadClipInspector(); renderPreview(); clearHandles();
  markDirty();
  toast('Ripple deleted');
}

function duplicateClip() {
  const cl = getSelectedClip(); if (!cl) return;
  saveUndo();
  const tr = getClipTrack(cl.id);
  const nc  = deepCopy(cl);
  nc.id = 'c' + Date.now() + Math.random().toString(36).slice(2);
  nc.trackStart = cl.trackStart + (cl.trimOut - cl.trimIn) / cl.speed;
  tr.clips.push(nc);
  selectedClipId = nc.id;
  renderTL(); loadClipInspector();
  markDirty();
  toast('Duplicated');
}

function cutClip() {
  const cl = getSelectedClip(); if (!cl) return;
  const tr = getClipTrack(cl.id); if (!tr) return;
  const relTime  = playhead - cl.trackStart;
  const srcDur   = (cl.trimOut - cl.trimIn) / cl.speed;
  if (relTime <= 0.02 || relTime >= srcDur - 0.02) {
    toast('Playhead must be inside clip', 'warn'); return;
  }
  saveUndo();
  const cutSrc = cl.trimIn + relTime * cl.speed;
  const right  = deepCopy(cl);
  right.id = 'c' + Date.now() + Math.random().toString(36).slice(2);
  right.trackStart = playhead;
  right.trimIn     = cutSrc;
  cl.trimOut       = cutSrc;
  tr.clips.push(right);
  selectedClipId = right.id;
  renderTL(); loadClipInspector();
  markDirty();
  toast('Cut at ' + fmtTime(playhead));
}

function updateClipProp(key, val) {
  const cl = getSelectedClip(); if (!cl) return;
  // Scale link
  if (key === 'scaleX' && scaleLinkOn) {
    cl.scaleX = val; cl.scaleY = val;
    id('clipScaleY').value = val;
    id('clipScaleYV').textContent = val + '%';
  } else if (key === 'scaleY' && scaleLinkOn) {
    cl.scaleY = val; cl.scaleX = val;
    id('clipScaleX').value = val;
    id('clipScaleXV').textContent = val + '%';
  } else {
    cl[key] = val;
  }
  if (key === 'trackStart') renderTL();
  renderPreview(); drawHandles(); markDirty();
}

function updateClipFilter(key, val) {
  const cl = getSelectedClip(); if (!cl) return;
  if (!cl.filters) cl.filters = { ...DEFAULT_FILTERS };
  cl.filters[key] = val;
  renderPreview(); markDirty();
}

function scaleLinkToggle() {
  scaleLinkOn = id('scaleLink').checked;
}

// ── SNAP ─────────────────────────────────────────────────
function getSnapTargets(excludeId) {
  const ts = [0];
  tracks.forEach(tr =>
    tr.clips.forEach(cl => {
      if (cl.id === excludeId) return;
      ts.push(cl.trackStart);
      ts.push(cl.trackStart + (cl.trimOut - cl.trimIn) / cl.speed);
    })
  );
  markers.forEach(m => ts.push(m.time));
  return ts;
}

function snapValue(val, snapTs, px = 8) {
  for (const t of snapTs) {
    if (Math.abs(val - t) * pxPerSec < px) {
      showSnapFlash(t * pxPerSec + 70);
      return t;
    }
  }
  return val;
}

function showSnapFlash(left) {
  const el = id('snapFlash'); if (!el) return;
  el.style.left = left + 'px';
  el.style.display = 'block';
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'snapFlash .3s ease-out forwards';
  setTimeout(() => { el.style.display = 'none'; }, 320);
}

// ── MARKERS ──────────────────────────────────────────────
function addMarker() {
  markers.push({ id: 'mk' + Date.now(), time: playhead, label: 'M' + (markers.length + 1) });
  renderMarkers();
  toast('Marker at ' + fmtTime(playhead));
  markDirty();
}

function clearSelectedMarker() {
  if (!selectedMarkerId) return;
  markers = markers.filter(m => m.id !== selectedMarkerId);
  selectedMarkerId = null;
  id('markerDelBtn').style.display = 'none';
  renderMarkers();
  markDirty();
}

function renderMarkers() {
  const layer = id('markersLayer'); if (!layer) return;
  layer.innerHTML = markers.map(m => `
    <div class="tl-marker${m.id === selectedMarkerId ? ' selected' : ''}"
      style="left:${m.time * pxPerSec}px;"
      onclick="selectMarker('${m.id}')"
      title="${m.label}">
      <div class="tl-marker-label">${m.label}</div>
    </div>`
  ).join('');
}

function selectMarker(mid) {
  selectedMarkerId = mid;
  id('markerDelBtn').style.display = '';
  renderMarkers();
}

// ── CLIP INSPECTOR ───────────────────────────────────────
function loadClipInspector() {
  const cl = getSelectedClip();
  const noSel = id('noClipMsg');
  const insp  = id('clipInspector');
  const kfNoCl = id('kfNoClip');

  if (!cl) {
    if (noSel) noSel.style.display = '';
    if (insp)  insp.style.display  = 'none';
    if (kfNoCl) kfNoCl.style.display = '';
    id('kfPropList').innerHTML = '';
    const kfTL = id('kfTimeline');
    if (kfTL) kfTL.style.display = 'none';
    return;
  }
  if (noSel) noSel.style.display = 'none';
  if (insp)  insp.style.display  = '';
  if (kfNoCl) kfNoCl.style.display = 'none';

  // Show/hide title-specific props
  const titleBlock = id('titlePropsBlock');
  const trimBlock  = id('trimBlock');
  const kbBlock    = id('kenBurnsBlock');
  const isTitle = cl.type === 'title' || cl.type === 'text';
  if (titleBlock) titleBlock.style.display = isTitle ? '' : 'none';
  if (trimBlock)  trimBlock.style.display  = isTitle ? 'none' : '';

  // Ken Burns only for image clips
  if (kbBlock) {
    const media = mediaItems.find(m => m.id === cl.mediaId);
    kbBlock.style.display = (media && media.type === 'image') ? '' : 'none';
  }

  const sv = (eid, val) => { const el = id(eid); if (el) el.value = val; };
  const st = (eid, txt) => { const el = id(eid); if (el) el.textContent = txt; };

  sv('clipName',  cl.name || '');
  sv('clipStart', (cl.trackStart || 0).toFixed(2));
  st('clipDurShow', ((cl.trimOut - cl.trimIn) / (cl.speed || 1)).toFixed(2) + 's');
  sv('clipTrimIn',  (cl.trimIn  || 0).toFixed(2));
  sv('clipTrimOut', (cl.trimOut || 0).toFixed(2));

  if (!isTitle) {
    sv('clipScaleX',  cl.scaleX || 100); st('clipScaleXV', (cl.scaleX||100)+'%');
    sv('clipScaleY',  cl.scaleY || 100); st('clipScaleYV', (cl.scaleY||100)+'%');
    sv('clipX', Math.round(cl.offsetX||0)); st('clipXV', Math.round(cl.offsetX||0));
    sv('clipY', Math.round(cl.offsetY||0)); st('clipYV', Math.round(cl.offsetY||0));
    sv('clipRot',     cl.rotation||0); st('clipRotV',     (cl.rotation||0)+'°');
    sv('clipOpacity', cl.opacity||100); st('clipOpacityV', (cl.opacity||100)+'%');
    sv('clipFitMode', cl.fitMode||'contain');
    sv('clipFlipH',   cl.flipH ? 'true' : 'false');
    sv('clipFlipV',   cl.flipV ? 'true' : 'false');

    if (kbBlock.style.display !== 'none') {
      const kbEl = id('kbEnable');
      if (kbEl) kbEl.checked = !!cl.kenBurns;
      sv('kbStart', cl.kbStartScale||100); st('kbStartV', (cl.kbStartScale||100)+'%');
      sv('kbEnd',   cl.kbEndScale||120);   st('kbEndV',   (cl.kbEndScale||120)+'%');
      sv('kbDir',   cl.kbDir||'tl-br');
    }

    sv('maskType',    cl.maskType||'none');
    sv('maskFeather', cl.maskFeather||0); st('maskFeatherV', (cl.maskFeather||0)+'px');
    const miEl = id('maskInvert'); if (miEl) miEl.checked = !!cl.maskInvert;

    ['Top','Bottom','Left','Right'].forEach(s => {
      sv('crop'+s, cl['crop'+s]||0); st('crop'+s+'V', (cl['crop'+s]||0)+'%');
    });
    const ceEl = id('chromaEnable'); if (ceEl) ceEl.checked = !!cl.chromaKey;
    sv('chromaColor',   cl.chromaColor||'#00ff00');
    sv('chromaTol',     cl.chromaTol||30);    st('chromaTolV',     cl.chromaTol||30);
    sv('chromaFeather', cl.chromaFeather||5);
    sv('clipSpeed', (cl.speed||1)*100); st('clipSpeedV', (cl.speed||1).toFixed(2)+'×');
    sv('clipVol',   (cl.volume||1)*100); st('clipVolV',  Math.round((cl.volume||1)*100)+'%');
    const muEl = id('clipMute'); if (muEl) muEl.checked = !!cl.mute;
    sv('motionBlur',   cl.motionBlur||0); st('motionBlurV', (cl.motionBlur||0)+'%');
    sv('clipTransIn',   cl.transIn||'none');
    sv('clipTransInDur',cl.transInDur||15);
    st('clipTransInDurV', ((cl.transInDur||15)/30).toFixed(1)+'s');

    // Grade
    const f = cl.filters || {};
    const sf = (eid, key, def, sfx='') => { sv(eid, f[key]??def); st(eid+'V', (f[key]??def)+sfx); };
    sf('fBright','brightness',100); sf('fContrast','contrast',100); sf('fSat','saturate',100);
    sf('fHue','hue',0,'°'); sf('fExposure','exposure',0);
    sf('fHighlights','highlights',0); sf('fShadows','shadows',0);
    sf('fWhites','whites',0); sf('fBlacks','blacks',0);
    sf('fTemp','temperature',0); sf('fTint','tint',0);
    sf('fVibrance','vibrance',0); sf('fClarity','clarity',0);
    sf('fGrain','grain',0,'%'); sf('fVignette','vignette',0,'%');
    sf('fBlur','blur',0,'px'); sf('fSepia','sepia',0,'%');
    sf('fGlitch','glitch',0,'%');
    sv('fDuotone', f.duotone||'none');

    // Color wheels
    if (cl.colorWheels) {
      const cw = cl.colorWheels;
      sv('cwLift',  cw.lift||0);  st('cwLiftV',  cw.lift||0);
      sv('cwGamma', cw.gamma||0); st('cwGammaV', cw.gamma||0);
      sv('cwGain',  cw.gain||0);  st('cwGainV',  cw.gain||0);
      if (typeof drawAllColorWheels === 'function') drawAllColorWheels(cw);
    }

    if (typeof renderFxStack === 'function') renderFxStack();
  }

  if (isTitle) {
    sv('titleText',   cl.text||'');
    sv('titleFont',   cl.font||'Syne');
    sv('titleSize',   cl.fontSize||64); st('titleSizeV',  (cl.fontSize||64)+'px');
    sv('titleWeight', cl.fontWeight||700);
    sv('titleColor',  cl.color||'#e8e4df');
    sv('titleAlign',  cl.align||'center');
    sv('titleYPos',   cl.yPos||50); st('titleYPosV', (cl.yPos||50)+'%');
    sv('titleBg',     cl.bg||'none');
    sv('titleStroke', cl.stroke||'#000000');
    sv('titleStrokeW',cl.strokeWidth||0); st('titleStrokeWV',(cl.strokeWidth||0)+'px');
    sv('titleShadow', cl.shadowBlur||8); st('titleShadowV', (cl.shadowBlur||8)+'px');
    sv('titleAnim',   cl.anim||'fade');
  }

  // Keyframe panel
  buildKFPanel(cl);
  buildSpeedRamp(cl);
}

// ── KEYFRAMES ────────────────────────────────────────────
const KF_PROPS = ['opacity','scaleX','offsetX','offsetY','rotation','brightness','saturate'];

function getKFValue(cl, prop, localT) {
  if (!cl.keyframes || !cl.keyframes[prop] || !cl.keyframes[prop].length) return null;
  const kfs = cl.keyframes[prop];
  if (kfs.length === 1) return kfs[0].value;
  if (localT <= kfs[0].time) return kfs[0].value;
  if (localT >= kfs[kfs.length-1].time) return kfs[kfs.length-1].value;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (localT >= kfs[i].time && localT <= kfs[i+1].time) {
      const t = (localT - kfs[i].time) / (kfs[i+1].time - kfs[i].time);
      return lerp(kfs[i].value, kfs[i+1].value, easeOut(t));
    }
  }
  return null;
}

function buildKFPanel(cl) {
  const propList = id('kfPropList');
  const kfTL     = id('kfTimeline');
  if (!propList) return;
  if (!cl) { propList.innerHTML = ''; if(kfTL) kfTL.style.display = 'none'; return; }
  if (!cl.keyframes) cl.keyframes = {};
  if (kfTL) kfTL.style.display = '';
  const localT  = clamp(playhead - cl.trackStart, 0, (cl.trimOut - cl.trimIn) / cl.speed);
  const clipDur = (cl.trimOut - cl.trimIn) / cl.speed;

  propList.innerHTML = KF_PROPS.map(prop => {
    const kfs = cl.keyframes[prop] || [];
    const atPH = kfs.some(k => Math.abs(k.time - localT) < 0.05);
    return `<div class="kf-prop-row">
      <div class="kf-prop-name">${prop}</div>
      <div class="kf-diamond${atPH ? '' : ' inactive'}"
        title="${atPH ? 'Remove' : 'Add'} keyframe"
        onclick="toggleKeyframe('${prop}')"></div>
    </div>`;
  }).join('');

  // KF timeline tracks
  const tracks_el = id('kfTracks'); if (!tracks_el) return;
  tracks_el.innerHTML = '';
  KF_PROPS.forEach(prop => {
    const kfs = cl.keyframes[prop] || [];
    const row  = document.createElement('div'); row.className = 'kf-track';
    const lbl  = document.createElement('div'); lbl.className = 'kf-track-label';
    lbl.textContent = prop.slice(0, 5);
    row.appendChild(lbl);
    const area = document.createElement('div'); area.className = 'kf-track-area';

    // lines between dots
    for (let i = 0; i < kfs.length - 1; i++) {
      const line = document.createElement('div'); line.className = 'kf-line';
      const x1 = kfs[i].time   / Math.max(clipDur, 1) * 100;
      const x2 = kfs[i+1].time / Math.max(clipDur, 1) * 100;
      line.style.left  = x1 + '%';
      line.style.width = (x2 - x1) + '%';
      area.appendChild(line);
    }
    kfs.forEach(kf => {
      const dot = document.createElement('div'); dot.className = 'kf-dot';
      dot.style.left = (kf.time / Math.max(clipDur, 1) * 100) + '%';
      dot.title = `${prop}: ${kf.value.toFixed(1)} @ ${kf.time.toFixed(2)}s`;
      dot.onclick = ev => { ev.stopPropagation(); removeKeyframe(prop, kf.time); };
      area.appendChild(dot);
    });
    row.appendChild(area);
    tracks_el.appendChild(row);
  });

  // KF playhead
  const pct = clamp(localT / Math.max(clipDur, 1) * 100, 0, 100);
  const kfPH = id('kfPlayheadLine');
  if (kfPH) kfPH.style.left = `calc(${pct}% + 52px)`;
}

function toggleKeyframe(prop) {
  const cl = getSelectedClip(); if (!cl) return;
  if (!cl.keyframes) cl.keyframes = {};
  const localT   = clamp(playhead - cl.trackStart, 0, (cl.trimOut - cl.trimIn) / cl.speed);
  if (!cl.keyframes[prop]) cl.keyframes[prop] = [];
  const idx = cl.keyframes[prop].findIndex(k => Math.abs(k.time - localT) < 0.05);
  if (idx >= 0) {
    cl.keyframes[prop].splice(idx, 1);
    toast('Keyframe removed');
  } else {
    let val = (prop in cl) ? cl[prop]
            : (cl.filters && prop in cl.filters) ? cl.filters[prop]
            : 100;
    cl.keyframes[prop].push({ time: localT, value: val });
    cl.keyframes[prop].sort((a, b) => a.time - b.time);
    toast('KF: ' + prop + ' = ' + val.toFixed(1));
  }
  buildKFPanel(cl); renderPreview(); markDirty();
}

function removeKeyframe(prop, time) {
  const cl = getSelectedClip(); if (!cl || !cl.keyframes[prop]) return;
  cl.keyframes[prop] = cl.keyframes[prop].filter(k => Math.abs(k.time - time) > 0.01);
  buildKFPanel(cl); renderPreview(); markDirty();
}

// ── SPEED RAMP ───────────────────────────────────────────
function buildSpeedRamp(cl) {
  const canvas = id('speedRampCanvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'var(--bg2, #141414)';
  ctx.fillRect(0, 0, W, H);

  if (!cl) return;
  const speed = cl.speed || 1;
  const midY  = H / 2;
  const speed_y = midY - (speed - 1) * H * 0.3;

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  [0.25, 0.5, 1, 1.5, 2].forEach(s => {
    const y = midY - (s - 1) * H * 0.3;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  });

  // 1x baseline
  ctx.strokeStyle = 'rgba(200,255,0,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke();
  ctx.setLineDash([]);

  // Speed line
  ctx.strokeStyle = '#c8ff00';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, speed_y); ctx.lineTo(W, speed_y); ctx.stroke();

  // Label
  ctx.fillStyle = '#c8ff00';
  ctx.font = '500 10px DM Mono, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(speed.toFixed(2) + '×', 4, speed_y - 10);
}

// ── TIMELINE RENDER ──────────────────────────────────────
function getTotalDuration() {
  let max = 0;
  tracks.forEach(tr =>
    tr.clips.forEach(cl => {
      const end = cl.trackStart + (cl.trimOut - cl.trimIn) / (cl.speed || 1);
      if (end > max) max = end;
    })
  );
  return Math.max(max, 10);
}

const TL_COLORS = ['#378add','#22c55e','#a855f7','#f59e0b','#ef4444','#ec4899','#06b6d4','#c8ff00'];
const TL_TYPE_COLORS = { title: '#7c3aed', text: '#0891b2' };

function renderTL() {
  const totalDur = getTotalDuration();
  const totalW   = totalDur * pxPerSec;
  const clipCount = tracks.reduce((s, t) => s + t.clips.length, 0);
  id('tlStatus').textContent = `${clipCount} clip${clipCount!==1?'s':''} · ${fmtTime(totalDur)}`;

  // Ruler
  const ruler = id('tlRuler'); if (!ruler) return;
  ruler.style.width = (totalW + 120) + 'px';
  const step = pxPerSec >= 240 ? 0.25
             : pxPerSec >= 100 ? 0.5
             : pxPerSec >= 50  ? 1
             : 2;
  let rHTML = '<div class="tl-ruler-inner">';
  for (let t = 0; t <= totalDur + step; t += step) {
    const x     = t * pxPerSec;
    const major = Math.abs(t / step - Math.round(t / step)) < 0.001;
    rHTML += `<div class="tl-tick" style="left:${x}px">
      <div class="tl-tick-line" style="height:${major?10:5}px;"></div>
      ${major ? `<div class="tl-tick-label">${fmtTime(t)}</div>` : ''}
    </div>`;
  }
  rHTML += '</div>';
  ruler.innerHTML = rHTML;

  // Track rows
  const rows = id('tlRows'); if (!rows) return;
  rows.innerHTML = tracks.map((tr, ti) => {
    const trackColor = TL_TYPE_COLORS[tr.type] || TL_COLORS[ti % TL_COLORS.length];
    const clips = tr.clips.map((cl, ci) => {
      const left  = cl.trackStart * pxPerSec;
      const dur   = (cl.trimOut - cl.trimIn) / (cl.speed || 1);
      const w     = Math.max(dur * pxPerSec, 14);
      const col   = TL_TYPE_COLORS[tr.type] || TL_COLORS[(ti * 3 + ci) % TL_COLORS.length];
      const isSel = cl.id === selectedClipId;
      const isMulti = multiSelected.has(cl.id);
      const badge = (tr.type === 'title') ? '<span class="tl-title-badge">T</span>'
                  : (tr.type === 'text')  ? '<span class="tl-title-badge" style="background:rgba(8,145,178,.3);border-color:rgba(8,145,178,.5);color:#67e8f9;">X</span>'
                  : '';
      const clipName = cl.text ? cl.text.slice(0, 16) : (cl.name || 'Clip');
      return `<div class="tl-clip${isSel?' on':isMulti?' multi-on':''}"
        id="clip-${cl.id}"
        style="left:${left}px;width:${w}px;background:${col}18;color:${col}"
        onclick="onClipClick(event,'${cl.id}')"
        onmousedown="startClipDrag(event,'${cl.id}')">
        <div class="handle left"  onmousedown="startTrimDrag(event,'${cl.id}','left')"></div>
        <div class="tl-clip-inner">
          ${badge}
          <span class="tl-clip-name">${clipName}</span>
          <span class="tl-clip-dur">${dur.toFixed(1)}s</span>
        </div>
        <div class="handle right" onmousedown="startTrimDrag(event,'${cl.id}','right')"></div>
      </div>`;
    }).join('');

    return `<div class="tl-track-row">
      <div class="tl-track-label" style="border-left:2px solid ${trackColor}30;padding-left:5px;">
        <button class="tl-track-mute${tr.muted?' on':''}" onclick="toggleTrackMute('${tr.id}')" title="Mute">M</button>
        <button class="tl-track-lock${tr.locked?' on':''}" onclick="toggleTrackLock('${tr.id}')" title="Lock">🔒</button>
        <span class="tl-track-label-text" title="${tr.label}">${tr.label}</span>
      </div>
      <div class="tl-track${tr.locked?' locked':''}" id="track-${tr.id}"
        style="width:${totalW+120}px">
        ${clips}
      </div>
    </div>`;
  }).join('');

  updatePlayheadUI();
  renderMarkers();
  updateMinimap();
}

function toggleTrackMute(trackId) {
  const tr = tracks.find(t => t.id === trackId); if (!tr) return;
  tr.muted = !tr.muted; renderTL();
}

function toggleTrackLock(trackId) {
  const tr = tracks.find(t => t.id === trackId); if (!tr) return;
  tr.locked = !tr.locked; renderTL();
  toast(tr.label + (tr.locked ? ' locked' : ' unlocked'));
}

function addTrack(type) {
  const n = tracks.filter(t => t.type === type).length + 1;
  tracks.push({
    id:     type + n + '_' + Date.now(),
    type,   label: `${type === 'video' ? 'Video' : 'Audio'} ${n + 1}`,
    clips:  [], muted: false, locked: false,
  });
  renderTL(); toast(`${type} track added`, 'success');
}

function setZoom(val) {
  pxPerSec = clamp(val, 20, 600);
  id('zoomSlider').value = pxPerSec;
  id('zoomVal').textContent = pxPerSec;
  renderTL();
}

function zoomToFit() {
  const dur = getTotalDuration();
  const body = id('tlBody'); if (!body) return;
  const w = body.offsetWidth - 80;
  setZoom(Math.max(20, Math.floor(w / dur)));
}

function updatePlayheadUI() {
  const ph = id('tlPlayhead'); if (!ph) return;
  ph.style.left = (70 + playhead * pxPerSec) + 'px';
  id('timeLbl').textContent = fmtTime(playhead) + ' / ' + fmtTime(getTotalDuration());
  // KF panel update if clip selected
  const cl = getSelectedClip(); if (cl) buildKFPanel(cl);
}

function handleTimelineClick(e) {
  const body = id('tlBody'); if (!body) return;
  if (e.target.closest('.tl-clip') || e.target.closest('.tl-track-label')) return;
  const rect  = body.getBoundingClientRect();
  const localX = e.clientX - rect.left + body.scrollLeft;
  seekTo(Math.max(0, (localX - 70) / pxPerSec));
}

// ── TIMELINE DRAG (clip move / trim) ─────────────────────
let dragState = null;

function startClipDrag(e, clipId) {
  if (e.target.classList.contains('handle')) return;
  e.stopPropagation(); e.preventDefault();
  const cl = getAllClips().find(c => c.id === clipId); if (!cl) return;
  const tr = getClipTrack(cl.id); if (tr && tr.locked) return;
  selectClip(clipId, e.shiftKey);
  dragState = { type: 'move', clipId, startX: e.clientX, origStart: cl.trackStart, lastDt: 0 };
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragUp);
}

function startTrimDrag(e, clipId, side) {
  e.stopPropagation(); e.preventDefault();
  const cl    = getAllClips().find(c => c.id === clipId); if (!cl) return;
  const media = mediaItems.find(m => m.id === cl.mediaId);
  dragState = {
    type: 'trim', clipId, side,
    startX: e.clientX,
    origTrimIn: cl.trimIn, origTrimOut: cl.trimOut,
    origTrackStart: cl.trackStart,
    mediaDur: media ? media.duration : 9999,
  };
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragUp);
}

function onDragMove(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dt = dx / pxPerSec;
  const cl = getAllClips().find(c => c.id === dragState.clipId); if (!cl) return;
  const snapTs = getSnapTargets(cl.id);

  if (dragState.type === 'move') {
    let ns = Math.max(0, dragState.origStart + dt);
    if (snapToGrid)  ns = Math.round(ns * 20) / 20;
    if (snapToClips) ns = snapValue(ns, snapTs);
    const delta = ns - cl.trackStart;
    cl.trackStart = ns;
    // move multi-selected together
    multiSelected.forEach(mid => {
      if (mid === cl.id) return;
      const mcl = getAllClips().find(c => c.id === mid);
      if (mcl) mcl.trackStart = Math.max(0, mcl.trackStart + delta);
    });
  } else if (dragState.side === 'left') {
    const ni = clamp(dragState.origTrimIn + dt * cl.speed, 0, cl.trimOut - 0.05);
    cl.trimIn = ni;
    cl.trackStart = Math.max(0, dragState.origTrackStart + (ni - dragState.origTrimIn) / cl.speed);
  } else {
    cl.trimOut = clamp(dragState.origTrimOut + dt * cl.speed, cl.trimIn + 0.05, dragState.mediaDur);
  }
  renderTL(); renderPreview(); drawHandles();
}

function onDragUp() {
  if (dragState) { saveUndo(); dragState = null; markDirty(); }
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragUp);
}

function onClipClick(e, clipId) {
  if (e.target.classList.contains('handle')) return;
  if (e.detail === 2) { onClipDoubleClick(clipId); return; }
  selectClip(clipId, e.shiftKey);
}

function onClipDoubleClick(clipId) {
  const cl = getAllClips().find(c => c.id === clipId); if (!cl) return;
  if (cl.type === 'title' || cl.type === 'text') {
    openInlineTitleEditor(cl);
  }
}

// ── INLINE TITLE EDITOR ──────────────────────────────────
let editingClipId = null;

function openInlineTitleEditor(cl) {
  const editor = id('inlineTitleEditor'); if (!editor) return;
  editingClipId = cl.id;
  editor.textContent = cl.text || '';
  editor.style.display = 'flex';
  editor.style.fontFamily = `'${cl.font || 'Syne'}', sans-serif`;
  editor.style.fontSize   = Math.round((cl.fontSize || 64) * (previewW / 1280)) + 'px';
  editor.style.fontWeight = cl.fontWeight || 700;
  editor.style.color      = cl.color || '#e8e4df';
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
}

function commitInlineTitleEdit() {
  const editor = id('inlineTitleEditor'); if (!editor) return;
  const cl = getAllClips().find(c => c.id === editingClipId);
  if (cl) {
    cl.text = editor.textContent.trim() || 'YOUR TITLE';
    cl.name = cl.text.slice(0, 20);
    renderTL(); loadClipInspector(); renderPreview(); markDirty();
  }
  editor.style.display = 'none';
  editingClipId = null;
}

function onInlineTitleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitInlineTitleEdit(); }
  if (e.key === 'Escape') { id('inlineTitleEditor').style.display = 'none'; editingClipId = null; }
}

// ── MULTI-SELECT BOX ─────────────────────────────────────
let selBoxStart = null;

function initSelectionBox() {
  const body = id('tlBody'); if (!body) return;
  body.addEventListener('mousedown', e => {
    if (e.target.closest('.tl-clip') || e.target.closest('.tl-track-label')) return;
    const rect = body.getBoundingClientRect();
    selBoxStart = {
      x: e.clientX - rect.left + body.scrollLeft,
      y: e.clientY - rect.top  + body.scrollTop,
    };
    const box = id('selBox'); if (box) box.style.display = '';

    const mm = ev => {
      if (!selBoxStart) return;
      const cx = ev.clientX - rect.left + body.scrollLeft;
      const cy = ev.clientY - rect.top  + body.scrollTop;
      const sx = Math.min(selBoxStart.x, cx), sw = Math.abs(cx - selBoxStart.x);
      const sy = Math.min(selBoxStart.y, cy), sh = Math.abs(cy - selBoxStart.y);
      if (box) box.style.cssText = `display:block;left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px;`;

      const newSel = new Set();
      tracks.forEach(tr => tr.clips.forEach(cl => {
        const clipLeft  = cl.trackStart * pxPerSec + 70;
        const clipRight = clipLeft + (cl.trimOut - cl.trimIn) / (cl.speed||1) * pxPerSec;
        if (clipRight > sx && clipLeft < sx + sw) newSel.add(cl.id);
      }));
      multiSelected = newSel;
      renderTL();
    };
    const mu = () => {
      if (box) box.style.display = 'none';
      selBoxStart = null;
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
    };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });
  body.addEventListener('click', handleTimelineClick);
}

// ── CANVAS DRAG (preview handles) ────────────────────────
const dragOverlay = id('dragOverlay');
let canvasDrag = null;

function getClipScreenRect(cl) {
  const media = mediaItems.find(m => m.id === cl.mediaId);
  const srcW  = (media && media.naturalW) ? media.naturalW : 640;
  const srcH  = (media && media.naturalH) ? media.naturalH : 360;
  return calcDrawRect(srcW, srcH, previewW, previewH, cl.fitMode || globalFitMode,
    cl.offsetX || 0, cl.offsetY || 0, (cl.scaleX || 100) / 100);
}

function drawHandles() {
  hctx.clearRect(0, 0, previewW, previewH);
  const cl = getSelectedClip();
  if (!cl || cl.type === 'title' || cl.type === 'text') return;
  const dur = (cl.trimOut - cl.trimIn) / (cl.speed || 1);
  if (playhead < cl.trackStart || playhead >= cl.trackStart + dur) return;
  const { dx, dy, dw, dh } = getClipScreenRect(cl);

  hctx.save();
  hctx.strokeStyle = '#c8ff00'; hctx.lineWidth = 1.5;
  hctx.setLineDash([4, 3]);
  hctx.strokeRect(dx, dy, dw, dh);
  hctx.setLineDash([]);
  hctx.fillStyle = 'rgba(200,255,0,0.04)';
  hctx.fillRect(dx, dy, dw, dh);

  const hs = 7;
  [[dx,dy],[dx+dw,dy],[dx,dy+dh],[dx+dw,dy+dh],
   [dx+dw/2,dy],[dx+dw/2,dy+dh],[dx,dy+dh/2],[dx+dw,dy+dh/2]
  ].forEach(([cx, cy]) => {
    hctx.fillStyle = '#c8ff00'; hctx.fillRect(cx-hs/2, cy-hs/2, hs, hs);
    hctx.strokeStyle = '#0a0a0a'; hctx.lineWidth = 1;
    hctx.strokeRect(cx-hs/2, cy-hs/2, hs, hs);
  });
  hctx.restore();
}

function clearHandles() { hctx.clearRect(0, 0, previewW, previewH); }

function getHandleAt(x, y, dx, dy, dw, dh) {
  const hs = 10;
  const pts = [
    [dx,dy,'tl'],[dx+dw,dy,'tr'],[dx,dy+dh,'bl'],[dx+dw,dy+dh,'br'],
    [dx+dw/2,dy,'tm'],[dx+dw/2,dy+dh,'bm'],[dx,dy+dh/2,'ml'],[dx+dw,dy+dh/2,'mr'],
  ];
  for (const [cx, cy, hid] of pts)
    if (Math.abs(x-cx) < hs && Math.abs(y-cy) < hs) return hid;
  if (x > dx && x < dx+dw && y > dy && y < dy+dh) return 'move';
  return null;
}

function getCanvasXY(e) {
  const rect = handleCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (previewW / rect.width),
    y: (e.clientY - rect.top)  * (previewH / rect.height),
  };
}

if (dragOverlay) {
  dragOverlay.addEventListener('mousemove', e => {
    const cl = getSelectedClip();
    if (!cl || cl.type === 'title' || cl.type === 'text') { dragOverlay.style.cursor = 'default'; return; }
    const dur = (cl.trimOut - cl.trimIn) / (cl.speed || 1);
    if (playhead < cl.trackStart || playhead >= cl.trackStart + dur) { dragOverlay.style.cursor = 'default'; return; }
    const { x, y } = getCanvasXY(e);
    const { dx, dy, dw, dh } = getClipScreenRect(cl);
    const h = getHandleAt(x, y, dx, dy, dw, dh);
    const cMap = { tl:'nw-resize',tr:'ne-resize',bl:'sw-resize',br:'se-resize',
                   tm:'n-resize',bm:'s-resize',ml:'w-resize',mr:'e-resize',move:'grab' };
    dragOverlay.style.cursor = h ? (cMap[h] || 'default') : 'default';
  });

  dragOverlay.addEventListener('mousedown', e => {
    const cl = getSelectedClip();
    if (!cl || cl.type === 'title' || cl.type === 'text') return;
    const dur = (cl.trimOut - cl.trimIn) / (cl.speed || 1);
    if (playhead < cl.trackStart || playhead >= cl.trackStart + dur) return;
    const { x, y } = getCanvasXY(e);
    const { dx, dy, dw, dh } = getClipScreenRect(cl);
    const h = getHandleAt(x, y, dx, dy, dw, dh); if (!h) return;
    e.preventDefault(); e.stopPropagation();
    canvasDrag = {
      type: h === 'move' ? 'move' : 'resize', corner: h, clipId: cl.id,
      startX: x, startY: y,
      origOffX: cl.offsetX || 0, origOffY: cl.offsetY || 0,
      origSX: cl.scaleX || 100, origSY: cl.scaleY || 100,
      origDW: dw,
    };
    document.addEventListener('mousemove', onCanvasDragMove);
    document.addEventListener('mouseup',   onCanvasDragUp);
  });
}

function onCanvasDragMove(e) {
  if (!canvasDrag) return;
  const cl = getAllClips().find(c => c.id === canvasDrag.clipId); if (!cl) return;
  const { x, y } = getCanvasXY(e);
  const dx = x - canvasDrag.startX;
  const dy = y - canvasDrag.startY;

  if (canvasDrag.type === 'move') {
    cl.offsetX = canvasDrag.origOffX + dx;
    cl.offsetY = canvasDrag.origOffY + dy;
  } else {
    const h = canvasDrag.corner;
    let delta;
    if (h==='br'||h==='mr'||h==='bm'||h==='tr') delta =  dx / canvasDrag.origDW;
    else                                          delta = -dx / canvasDrag.origDW;
    const ns = clamp(canvasDrag.origSX * (1 + delta), 5, 500);
    cl.scaleX = ns;
    if (scaleLinkOn) cl.scaleY = ns; else cl.scaleY = canvasDrag.origSY;
  }
  renderPreview(); drawHandles(); loadClipInspector();
}

function onCanvasDragUp() {
  if (canvasDrag) { saveUndo(); canvasDrag = null; markDirty(); }
  dragOverlay.style.cursor = 'default';
  document.removeEventListener('mousemove', onCanvasDragMove);
  document.removeEventListener('mouseup',   onCanvasDragUp);
}

// ── PLAYBACK ─────────────────────────────────────────────
function togglePlay() { playing ? stopPlay() : startPlay(); }

function startPlay() {
  playing = true;
  const btn = id('playBtn');
  if (btn) { btn.innerHTML = '⏸'; btn.classList.add('playing'); }
  if (AC) AC.resume().catch(() => {});
  const dur = getTotalDuration();
  if (playhead >= dur) seekTo(0);
  playTimer = setInterval(() => {
    playhead += 1 / 30;
    if (playhead >= dur) { stopPlay(); playhead = dur; renderPreview(); clearHandles(); return; }
    updatePlayheadUI();
    renderPreview();
    drawHandles();
    // Auto-scroll timeline to follow playhead
    autoScrollTimeline();
    // Render active captions
    renderActiveCaptionDisplay();
  }, 1000 / 30);
  syncAllVideoElements();
}

function stopPlay() {
  playing = false;
  clearInterval(playTimer);
  const btn = id('playBtn');
  if (btn) { btn.innerHTML = '▶'; btn.classList.remove('playing'); }
  pauseAllVideoElements();
}

function seekTo(t) {
  playhead = clamp(t, 0, getTotalDuration());
  updatePlayheadUI();
  renderPreview();
  drawHandles();
  renderActiveCaptionDisplay();
}

function seekRel(dt) { seekTo(playhead + dt); }
function setVolume(v) {
  volume = v / 100;
  if (masterGain) masterGain.gain.value = volume;
  id('volVal').textContent = v + '%';
}

function autoScrollTimeline() {
  const body = id('tlBody'); if (!body) return;
  const phLeft  = playhead * pxPerSec + 70;
  const scrollL = body.scrollLeft;
  const viewW   = body.offsetWidth;
  if (phLeft > scrollL + viewW - 60) {
    body.scrollLeft = phLeft - viewW * 0.3;
  } else if (phLeft < scrollL + 60) {
    body.scrollLeft = Math.max(0, phLeft - 80);
  }
}

// ── VIDEO ELEMENT MANAGEMENT ─────────────────────────────
function getVideoEl(mediaId) {
  let vel = document.getElementById('vid-' + mediaId);
  if (!vel) {
    vel = document.createElement('video');
    vel.id     = 'vid-' + mediaId;
    vel.preload = 'auto';
    vel.style.display = 'none';
    vel.crossOrigin   = 'anonymous';
    const item = mediaItems.find(m => m.id === mediaId);
    if (item) vel.src = item.url;
    document.body.appendChild(vel);
  }
  return vel;
}

function syncAllVideoElements() {
  tracks.forEach(tr => {
    if (tr.muted || tr.type === 'audio') return;
    tr.clips.forEach(cl => {
      if (!cl.mediaId) return;
      const item = mediaItems.find(m => m.id === cl.mediaId);
      if (!item || item.type !== 'video') return;
      const dur = (cl.trimOut - cl.trimIn) / cl.speed;
      if (playhead >= cl.trackStart && playhead < cl.trackStart + dur) {
        const vel = getVideoEl(cl.mediaId);
        const srcT = cl.trimIn + (playhead - cl.trackStart) * cl.speed;
        if (!cl.mute && !tr.muted) {
          vel.volume = clamp((cl.volume || 1) * volume, 0, 1);
          vel.muted  = false;
        } else { vel.muted = true; }
        vel.playbackRate = cl.speed || 1;
        if (vel.paused && playing) vel.play().catch(() => {});
      }
    });
  });
}

function pauseAllVideoElements() {
  document.querySelectorAll('[id^="vid-"]').forEach(v => { if (!v.paused) v.pause(); });
}

// ── PREVIEW RENDER ───────────────────────────────────────
function renderPreview() {
  ctx2d.clearRect(0, 0, previewW, previewH);
  ctx2d.fillStyle = '#000';
  ctx2d.fillRect(0, 0, previewW, previewH);

  // Collect active clips sorted by z-order (track index, low = back)
  const active = [];
  tracks.forEach((tr, ti) => {
    if (tr.muted) return;
    tr.clips.forEach(cl => {
      const dur = (cl.trimOut - cl.trimIn) / (cl.speed || 1);
      if (playhead >= cl.trackStart && playhead < cl.trackStart + dur)
        active.push({ cl, tr, ti });
    });
  });

  // Render each active clip
  active.forEach(({ cl, tr }) => {
    if (tr.type === 'audio') return;
    if (cl.type === 'title' || tr.type === 'title') { renderTitleClip(cl); return; }
    if (cl.type === 'text'  || tr.type === 'text')  { renderTextClip(cl);  return; }
    renderMediaClip(cl);
  });

  // Caption overlay
  if (typeof renderCaptionOnCanvas === 'function') {
    renderCaptionOnCanvas(ctx2d, captions, playhead, captionStyle, previewW, previewH);
  }

  // Empty state hint
  if (active.length === 0 && tracks.reduce((s,t)=>s+t.clips.length,0) === 0) {
    ctx2d.fillStyle  = 'rgba(232,228,223,0.07)';
    ctx2d.font       = '500 13px DM Mono,monospace';
    ctx2d.textAlign  = 'center'; ctx2d.textBaseline = 'middle';
    ctx2d.fillText('Import media · drag to timeline', previewW/2, previewH/2);
    ctx2d.font       = '300 10px DM Mono,monospace';
    ctx2d.fillStyle  = 'rgba(232,228,223,0.03)';
    ctx2d.fillText('MANNORR STUDIO v4', previewW/2, previewH/2 + 22);
  }
}

// ── MEDIA CLIP RENDER ────────────────────────────────────
function renderMediaClip(cl) {
  const media  = mediaItems.find(m => m.id === cl.mediaId); if (!media) return;
  const localT = playhead - cl.trackStart;
  const srcT   = cl.trimIn + localT * (cl.speed || 1);

  // Ken Burns
  let kbScale = 1, kbOffX = 0, kbOffY = 0;
  if (cl.kenBurns && media.type === 'image') {
    const prog = localT / Math.max((cl.trimOut - cl.trimIn) / (cl.speed||1), 0.01);
    kbScale = lerp((cl.kbStartScale||100)/100, (cl.kbEndScale||120)/100, prog);
    const d = prog * 0.12;
    const dir = cl.kbDir || 'tl-br';
    if      (dir==='tl-br') { kbOffX=-previewW*d/2; kbOffY=-previewH*d/2; }
    else if (dir==='tr-bl') { kbOffX= previewW*d/2; kbOffY=-previewH*d/2; }
    else if (dir==='br-tl') { kbOffX= previewW*d/2; kbOffY= previewH*d/2; }
  }

  // Keyframe overrides
  const kfOpacity = getKFValue(cl, 'opacity', localT);
  const kfScaleX  = getKFValue(cl, 'scaleX',  localT);
  const kfOffX    = getKFValue(cl, 'offsetX', localT);
  const kfOffY    = getKFValue(cl, 'offsetY', localT);
  const kfRot     = getKFValue(cl, 'rotation', localT);

  const effScaleX = ((kfScaleX !== null ? kfScaleX : (cl.scaleX||100)) / 100) * kbScale;
  const effScaleY = ((cl.scaleY||100) / 100) * kbScale;
  const effOffX   = (kfOffX !== null ? kfOffX : (cl.offsetX||0)) + kbOffX;
  const effOffY   = (kfOffY !== null ? kfOffY : (cl.offsetY||0)) + kbOffY;
  const effOpacity = (kfOpacity !== null ? kfOpacity : (cl.opacity||100)) / 100;
  const effRot    = ((kfRot !== null ? kfRot : (cl.rotation||0)) * Math.PI) / 180;

  const srcW = media.naturalW || 640;
  const srcH = media.naturalH || 360;

  // Use average scale for calcDrawRect (scaleX handles non-uniform after)
  const avgScale = (effScaleX + effScaleY) / 2;
  const { dx, dy, dw, dh } = calcDrawRect(srcW, srcH, previewW, previewH,
    cl.fitMode || globalFitMode, effOffX, effOffY, avgScale);

  ctx2d.save();
  ctx2d.globalAlpha = clamp(effOpacity, 0, 1);
  ctx2d.filter = buildFilterString(cl.filters || {}, localT, cl);
  ctx2d.translate(dx + dw/2, dy + dh/2);
  ctx2d.rotate(effRot);
  if (cl.flipH) ctx2d.scale(-1, 1);
  if (cl.flipV) ctx2d.scale(1, -1);
  // Non-uniform scale
  const nsx = effScaleX / avgScale;
  const nsy = effScaleY / avgScale;
  if (Math.abs(nsx - 1) > 0.001 || Math.abs(nsy - 1) > 0.001) ctx2d.scale(nsx, nsy);

  if (media.type === 'video') {
    const vel = getVideoEl(media.id);
    if (Math.abs(vel.currentTime - srcT) > 0.12) vel.currentTime = srcT;
    if (playing && vel.paused) vel.play().catch(() => {});
    else if (!playing && !vel.paused) vel.pause();
    try { ctx2d.drawImage(vel, -dw/2, -dh/2, dw, dh); } catch(e) {}
  } else if (media.type === 'image') {
    let img = document.getElementById('img-' + media.id);
    if (!img) {
      img = new Image(); img.id = 'img-' + media.id;
      img.src = media.url; img.style.display = 'none';
      document.body.appendChild(img);
      img.onload = () => { media.naturalW = img.naturalWidth; media.naturalH = img.naturalHeight; renderPreview(); };
    }
    if (img.complete && img.naturalWidth)
      try { ctx2d.drawImage(img, -dw/2, -dh/2, dw, dh); } catch(e) {}
  }
  ctx2d.restore();

  // Color grade + canvas FX
  if (typeof applyColorGrade === 'function')
    applyColorGrade(ctx2d, cl.colorGrade, cl.filters, cl.colorWheels, previewW, previewH);
  if (typeof applyCanvasFxDraw === 'function')
    applyCanvasFxDraw(ctx2d, cl.canvasFx, previewW, previewH);

  // Mask
  applyMask(ctx2d, cl, dx, dy, dw, dh);

  // Transition in
  renderTransitionIn(cl, localT);
}

// ── TRANSITION IN ────────────────────────────────────────
function renderTransitionIn(cl, localT) {
  if (!cl.transIn || cl.transIn === 'none') return;
  const tS = (cl.transInDur || 15) / 30;
  if (localT >= tS) return;
  const tp = localT / tS;
  ctx2d.save();
  switch (cl.transIn) {
    case 'fade':
      ctx2d.globalAlpha = 1 - tp;
      ctx2d.fillStyle = '#000'; ctx2d.fillRect(0, 0, previewW, previewH); break;
    case 'flash':
      ctx2d.globalAlpha = Math.max(0, 1 - tp * 2);
      ctx2d.fillStyle = '#fff'; ctx2d.fillRect(0, 0, previewW, previewH); break;
    case 'wipe_l':
      ctx2d.fillStyle = '#000'; ctx2d.fillRect(0, 0, previewW * (1 - tp), previewH); break;
    case 'wipe_r':
      ctx2d.fillStyle = '#000'; ctx2d.fillRect(previewW * tp, 0, previewW * (1 - tp), previewH); break;
    case 'wipe_u':
      ctx2d.fillStyle = '#000'; ctx2d.fillRect(0, 0, previewW, previewH * (1 - tp)); break;
    case 'slide_l':
      ctx2d.fillStyle = '#000'; ctx2d.fillRect(0, 0, previewW * (1 - tp), previewH); break;
    case 'slide_r':
      ctx2d.fillStyle = '#000'; ctx2d.fillRect(previewW * tp, 0, previewW, previewH); break;
    case 'zoom':
      ctx2d.globalAlpha = 1 - tp * 0.8; break;
    case 'zoom_out':
      ctx2d.globalAlpha = tp < 0.5 ? 0 : (tp - 0.5) * 2; break;
    case 'dissolve': {
      const n = 180;
      for (let i = 0; i < n; i++) {
        ctx2d.globalAlpha = Math.max(0, 1 - tp) * 0.75;
        ctx2d.fillStyle = '#000';
        ctx2d.fillRect(Math.random()*previewW, Math.random()*previewH, previewW/14, previewH/20);
      }
      break;
    }
    case 'glitch':
      if (tp < 0.5) {
        for (let i = 0; i < 5; i++) {
          const gy = Math.random()*previewH, gh = 6+Math.random()*12;
          try { ctx2d.drawImage(previewCanvas, 0, gy, previewW, gh, (Math.random()-.5)*18, gy, previewW, gh); } catch(e) {}
        }
        ctx2d.globalAlpha = (1-tp) * 0.5;
        ctx2d.fillStyle = '#c8ff00'; ctx2d.fillRect(0, 0, previewW, previewH);
      }
      break;
  }
  ctx2d.restore();
}

// ── MASK RENDER ──────────────────────────────────────────
function applyMask(ctx, cl, dx, dy, dw, dh) {
  const mt = cl.maskType; if (!mt || mt === 'none') return;
  const feather = cl.maskFeather || 0;
  ctx.save();
  ctx.globalCompositeOperation = cl.maskInvert ? 'source-over' : 'destination-in';
  ctx.beginPath();
  if (mt === 'circle') {
    ctx.arc(dx+dw/2, dy+dh/2, Math.min(dw, dh)/2, 0, Math.PI*2);
  } else if (mt === 'oval') {
    ctx.ellipse(dx+dw/2, dy+dh/2, dw/2, dh*0.42, 0, 0, Math.PI*2);
  } else if (mt === 'rect') {
    ctx.rect(dx, dy, dw, dh);
  } else if (mt === 'rounded') {
    const r = Math.min(dw, dh) * 0.15;
    ctx.roundRect(dx, dy, dw, dh, r);
  }
  if (feather > 0) {
    const g = ctx.createRadialGradient(dx+dw/2, dy+dh/2, Math.max(dw,dh)*0.4, dx+dw/2, dy+dh/2, Math.max(dw,dh)*0.5+feather);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = 'rgba(0,0,0,1)';
  }
  ctx.fill();
  ctx.restore();
}

// ── TITLE CLIP RENDER ────────────────────────────────────
function renderTitleClip(cl) {
  const localT = playhead - cl.trackStart;
  const dur    = (cl.trimOut - cl.trimIn) / (cl.speed || 1);
  const t      = easeOut(localT / Math.max(dur * 0.28, 0.2));
  const kfOp   = getKFValue(cl, 'opacity', localT);
  const opacity = ((kfOp !== null ? kfOp : (cl.opacity||100)) / 100) * t;
  ctx2d.save();

  // Background
  const bg = cl.bg;
  if (bg === 'letterbox') {
    ctx2d.fillStyle = 'rgba(0,0,0,0.88)';
    ctx2d.fillRect(0, previewH*0.3, previewW, previewH*0.4);
  } else if (bg === 'bar') {
    ctx2d.fillStyle = 'rgba(0,0,0,0.78)';
    ctx2d.fillRect(0, previewH*0.68, previewW, previewH*0.26);
    ctx2d.fillStyle = cl.color || '#c8ff00';
    ctx2d.fillRect(0, previewH*0.68, 4, previewH*0.26);
  } else if (bg === 'box') {
    ctx2d.fillStyle = 'rgba(0,0,0,0.78)';
    ctx2d.fillRect(0, 0, previewW, previewH);
  } else if (bg === 'full') {
    ctx2d.fillStyle = 'rgba(10,10,10,0.95)';
    ctx2d.fillRect(0, 0, previewW, previewH);
  }

  ctx2d.globalAlpha = clamp(opacity, 0, 1);
  const yPos = previewH * ((cl.yPos || 50) / 100);
  const fs   = Math.round((cl.fontSize || 60) * (previewW / 1280));
  const italic = (cl.font || 'Syne') === 'Instrument Serif' ? 'italic ' : '';
  ctx2d.font = `${italic}${cl.fontWeight||700} ${fs}px '${cl.font||'Syne'}',serif`;
  ctx2d.textAlign     = cl.align || 'center';
  ctx2d.textBaseline  = 'middle';

  const align = cl.align || 'center';
  const xPos  = align === 'left' ? previewW*0.08 : align === 'right' ? previewW*0.92 : previewW/2;

  // Animation transform
  let tx = cl.offsetX || 0, ty = cl.offsetY || 0;
  const anim = cl.anim || 'fade';
  if (anim === 'slide_l') { tx -= (1-t)*previewW*0.14; }
  else if (anim === 'slide_u') { ty += (1-t)*previewH*0.12; }
  else if (anim === 'zoom') { ctx2d.translate(xPos, yPos); ctx2d.scale(0.8+t*0.2, 0.8+t*0.2); ctx2d.translate(-xPos, -yPos); }

  ctx2d.translate(tx, ty);

  // Stroke
  if (cl.strokeWidth > 0) {
    ctx2d.strokeStyle  = cl.stroke || '#000';
    ctx2d.lineWidth    = cl.strokeWidth * 2;
    ctx2d.lineJoin     = 'round';
    let drawText = (anim === 'typewriter')
      ? (cl.text||'').slice(0, Math.floor(t * (cl.text||'').length))
      : (cl.text || 'TITLE');
    ctx2d.strokeText(drawText, xPos, yPos);
  }

  // Shadow
  ctx2d.shadowColor  = 'rgba(0,0,0,0.85)';
  ctx2d.shadowBlur   = cl.shadowBlur ?? 8;

  // Text
  ctx2d.fillStyle = cl.color || '#e8e4df';
  let drawText = (anim === 'typewriter')
    ? (cl.text||'').slice(0, Math.floor(t * (cl.text||'').length))
    : (cl.text || 'TITLE');

  ctx2d.fillText(drawText, xPos, yPos);
  ctx2d.shadowBlur = 0;
  ctx2d.restore();
}

function renderTextClip(cl) {
  // Text clips render exactly like title clips
  renderTitleClip(cl);
}

// ── CAPTION DISPLAY ──────────────────────────────────────
function renderActiveCaptionDisplay() {
  const disp = id('captionDisplay'); if (!disp) return;
  const active = captions.filter(c => playhead >= c.start && playhead <= c.end);
  if (!active.length) { disp.innerHTML = ''; return; }
  const text = active.map(c => c.text).join(' ');
  const sz   = captionStyle.size || 26;
  const col  = captionStyle.color || '#fff';
  const pos  = captionStyle.pos || 'bottom';
  const posCSS = pos === 'top' ? 'top:6%' : pos === 'mid' ? 'top:44%' : 'bottom:7%';
  const bg   = captionStyle.bg === 'semi' ? 'rgba(0,0,0,0.55)'
             : captionStyle.bg === 'bar'  ? 'rgba(0,0,0,0.82)'
             : 'transparent';
  disp.style.cssText = `position:absolute;left:0;right:0;${posCSS};text-align:center;pointer-events:none;z-index:10;`;
  disp.innerHTML = `<span style="font-size:${sz}px;color:${col};background:${bg};padding:3px 12px;border-radius:4px;font-family:'DM Mono',monospace;font-weight:500;display:inline-block;">${text}</span>`;
}

// ── AUTO CAPTIONS ────────────────────────────────────────
function startAutoCaption() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Speech API requires Chrome', 'warn'); return; }
  speechRec = new SR();
  speechRec.continuous = true;
  speechRec.interimResults = false;
  captionStartT = playhead;
  id('captionStatus').textContent = '🔴 Listening…';
  speechRec.onresult = ev => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) {
        const text = ev.results[i][0].transcript.trim();
        const now  = playhead;
        captions.push({ id:'cap'+Date.now(), start: captionStartT, end: now + 1.5, text });
        captionStartT = now;
        renderCaptionList(); markDirty();
      }
    }
  };
  speechRec.onerror = () => { id('captionStatus').textContent = ''; };
  speechRec.start();
  toast('Auto-caption started — speak!', 'success');
}

function stopAutoCaption() {
  if (speechRec) speechRec.stop(); speechRec = null;
  id('captionStatus').textContent = '';
  toast('Captions stopped');
}

function renderCaptionList() {
  const list = id('captionList'); if (!list) return;
  list.innerHTML = captions.map((c, i) => `
    <div class="caption-item">
      <div class="caption-time">${fmtTime(c.start)}<br>→${fmtTime(c.end)}</div>
      <textarea class="caption-text" rows="2"
        onblur="captions[${i}].text=this.value;renderActiveCaptionDisplay()">${c.text}</textarea>
      <button class="media-add" style="color:var(--danger)" onclick="captions.splice(${i},1);renderCaptionList()">×</button>
    </div>`
  ).join('');
}

function exportSRT() {
  if (!captions.length) { toast('No captions yet', 'warn'); return; }
  const toSRT = s => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
    const sec = Math.floor(s%60), ms = Math.round((s%1)*1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
  };
  const srt = captions.map((c,i) => `${i+1}\n${toSRT(c.start)} --> ${toSRT(c.end)}\n${c.text}`).join('\n\n');
  const blob = new Blob([srt], { type: 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'mannorr-captions.srt'; a.click();
  toast('SRT exported!', 'success');
}

// ── MINIMAP ──────────────────────────────────────────────
function updateMinimap() {
  const canvas = id('minimapCanvas'); if (!canvas) return;
  const vp     = id('minimapViewport'); if (!vp) return;
  const body   = id('tlBody'); if (!body) return;
  const W = canvas.parentElement.offsetWidth || 400;
  canvas.width = W;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, 18);
  ctx.fillStyle = 'var(--bg2,#141414)';
  ctx.fillRect(0, 0, W, 18);

  const totalDur = getTotalDuration();
  const scaleX   = W / Math.max(totalDur * pxPerSec, 1);

  tracks.forEach((tr, ti) => {
    tr.clips.forEach((cl, ci) => {
      const dur  = (cl.trimOut - cl.trimIn) / (cl.speed || 1);
      const x    = cl.trackStart * pxPerSec * scaleX;
      const w    = Math.max(dur * pxPerSec * scaleX, 1);
      const col  = TL_TYPE_COLORS[tr.type] || TL_COLORS[(ti * 3 + ci) % TL_COLORS.length];
      ctx.fillStyle = col + '90';
      ctx.fillRect(x, 3 + ti * 2, w, 2);
    });
  });

  // Playhead
  const phX = playhead * pxPerSec * scaleX;
  ctx.fillStyle = '#c8ff00';
  ctx.fillRect(phX - 0.5, 0, 1.5, 18);

  // Viewport indicator
  const visW  = body.offsetWidth;
  const vpX   = body.scrollLeft * scaleX;
  const vpW   = visW * scaleX;
  vp.style.left  = vpX + 'px';
  vp.style.width = Math.min(vpW, W - vpX) + 'px';
}

// ── UNDO / REDO ──────────────────────────────────────────
function saveUndo() {
  const state = deepCopy({ tracks, captions, markers });
  undoStack.push(state);
  redoStack = [];
  if (undoStack.length > 50) undoStack.shift();
  id('undoBtn').disabled = false;
  id('redoBtn').disabled = true;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(deepCopy({ tracks, captions, markers }));
  const s = undoStack.pop();
  tracks   = s.tracks; captions = s.captions; markers = s.markers || [];
  renderTL(); renderPreview(); loadClipInspector(); renderCaptionList();
  id('undoBtn').disabled = undoStack.length === 0;
  id('redoBtn').disabled = false;
  toast('Undo');
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(deepCopy({ tracks, captions, markers }));
  const s = redoStack.pop();
  tracks   = s.tracks; captions = s.captions; markers = s.markers || [];
  renderTL(); renderPreview(); loadClipInspector(); renderCaptionList();
  id('undoBtn').disabled = false;
  id('redoBtn').disabled = redoStack.length === 0;
  toast('Redo');
}

// ── PROJECT SAVE / LOAD ──────────────────────────────────
function markDirty() {
  isDirty = true;
  const ss = id('saveStatus'); if (ss) { ss.textContent = '●'; ss.className = 'save-status unsaved'; }
}

function markSaved() {
  isDirty = false;
  const ss = id('saveStatus'); if (ss) { ss.textContent = '●'; ss.className = 'save-status saved'; }
}

function serializeProject() {
  return JSON.stringify({ version:4, projectName, tracks, captions, markers, captionStyle });
}

function saveProject() {
  try {
    localStorage.setItem('mannorr_project', serializeProject());
    localStorage.setItem('mannorr_project_time', Date.now());
    markSaved();
    toast('Project saved ✓', 'success');
  } catch(e) { toast('Save failed: ' + e.message, 'error'); }
}

function loadProjectDialog() { id('projectFileInput').click(); }

function loadProjectFile(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      applyProjectData(data);
      toast('Project loaded: ' + (data.projectName||'Untitled'), 'success');
    } catch(err) { toast('Load failed: invalid file', 'error'); }
  };
  reader.readAsText(file);
  input.value = '';
}

function applyProjectData(data) {
  if (data.tracks)       tracks        = data.tracks;
  if (data.captions)     captions      = data.captions;
  if (data.markers)      markers       = data.markers;
  if (data.captionStyle) captionStyle  = data.captionStyle;
  if (data.projectName)  projectName   = data.projectName;
  renderTL(); renderPreview(); loadClipInspector(); renderCaptionList();
  markSaved();
}

function newProject() {
  if (isDirty && !confirm('Unsaved changes. Start new project?')) return;
  tracks = [
    { id:'v1', type:'video', label:'Video 1', clips:[], muted:false, locked:false },
    { id:'v2', type:'video', label:'Video 2', clips:[], muted:false, locked:false },
    { id:'a1', type:'audio', label:'Audio 1', clips:[], muted:false, locked:false },
  ];
  captions=[]; markers=[]; undoStack=[]; redoStack=[];
  selectedClipId=null; multiSelected.clear(); playhead=0;
  renderTL(); renderPreview(); loadClipInspector(); renderCaptionList();
  markSaved();
  toast('New project', 'success');
}

// ── AUTOSAVE ─────────────────────────────────────────────
function startAutosave() {
  autosaveTimer = setInterval(() => {
    if (isDirty) { saveProject(); }
  }, 30000); // every 30s
}

function tryRestoreProject() {
  try {
    const raw = localStorage.getItem('mannorr_project');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.tracks) return false;
    applyProjectData(data);
    toast('Project restored from autosave', 'success');
    return true;
  } catch(e) { return false; }
}

// ── PANEL TABS ────────────────────────────────────────────
function switchPTab(el, name) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  ['media','filters','titles','text','audio'].forEach(n => {
    const p = id('ptab-' + n);
    if (p) p.style.display = n === name ? '' : 'none';
  });
}

function switchRTab(el, name) {
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  document.querySelectorAll('.rpane').forEach(p => p.classList.remove('on'));
  const pane = id('rpane-' + name);
  if (pane) pane.classList.add('on');
}

// ── TEXT CLIP LIST ────────────────────────────────────────
function renderTextClipList() {
  const list = id('textClipList'); if (!list) return;
  const textTrack = tracks.find(t => t.type === 'text');
  if (!textTrack || !textTrack.clips.length) {
    list.innerHTML = '<div class="pane-hint">No text clips yet</div>'; return;
  }
  list.innerHTML = textTrack.clips.map((cl, i) => `
    <div class="text-overlay-item${cl.id===selectedClipId?' on':''}" onclick="selectClip('${cl.id}')">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
        <span style="font-family:var(--display);font-size:11px;font-weight:700;color:${cl.color||'#c8ff00'};flex:1;">${(cl.text||'Text').slice(0,20)}</span>
        <button class="tb-btn-xs" style="color:var(--danger)" onclick="event.stopPropagation();deleteTextClip('${cl.id}')">×</button>
      </div>
      <div style="font-size:9px;color:var(--text3);font-family:var(--mono);">${fmtTime(cl.trackStart)} · ${((cl.trimOut-cl.trimIn)/(cl.speed||1)).toFixed(1)}s</div>
    </div>`
  ).join('');
}

function deleteTextClip(clipId) {
  saveUndo();
  tracks.forEach(t => { t.clips = t.clips.filter(c => c.id !== clipId); });
  renderTL(); renderTextClipList(); renderPreview(); markDirty();
}

// ── SFX PANEL ────────────────────────────────────────────
const SFX_LIB = [
  { cat:'Transitions', items:[{id:'whoosh',n:'Whoosh'},{id:'whoosh_fast',n:'Fast Whoosh'},{id:'swoosh_up',n:'Swoosh Up'},{id:'swoosh_dn',n:'Swoosh Down'}] },
  { cat:'Hits',        items:[{id:'impact',n:'Impact'},{id:'kick',n:'Kick'},{id:'snare',n:'Snare'},{id:'glitch_hit',n:'Glitch Hit'}] },
  { cat:'UI',          items:[{id:'click',n:'Click'},{id:'notify',n:'Notify'},{id:'success',n:'Success'},{id:'coin',n:'Coin'}] },
  { cat:'Atmosphere',  items:[{id:'wind',n:'Wind'},{id:'chime',n:'Chime'},{id:'bell',n:'Bell'},{id:'laser',n:'Laser'}] },
];

function buildSfxPanel() {
  const list = id('sfxList'); if (!list) return;
  list.innerHTML = SFX_LIB.map(cat => `
    <div class="sfx-cat-label">${cat.cat}</div>
    <div class="sfx-grid">
      ${cat.items.map(s => `<div class="sfx-btn" onclick="playSfx('${s.id}')">${s.n}</div>`).join('')}
    </div>`
  ).join('');
}

function playSfx(type) {
  if (!AC) return;
  AC.resume();
  const sr = AC.sampleRate;
  const durs = {
    whoosh:.5, whoosh_fast:.25, swoosh_up:.4, swoosh_dn:.4,
    impact:.3, kick:.4, snare:.3, glitch_hit:.15,
    click:.05, notify:.4, success:.6, coin:.4,
    wind:.8, chime:.8, bell:1.2, laser:.3,
  };
  const dur = durs[type] || .3;
  const frames = Math.ceil(sr * dur);
  const buf = AC.createBuffer(1, frames, sr);
  const d = buf.getChannelData(0);
  const t = i => i / sr;
  const fill = fn => { for (let i=0;i<frames;i++) d[i]=fn(i); };

  if (type.startsWith('whoosh')||type.startsWith('swoosh')) {
    const up=type==='swoosh_up', fast=type==='whoosh_fast';
    fill(i=>{const T=t(i),env=Math.sin(Math.PI*T/dur)*Math.exp(-T*(fast?4:2));
      const freq=up?(100+T*3000):(type==='swoosh_dn'?3000-T*2800:200+T*2400);
      return(Math.random()*2-1)*env*.55+Math.sin(2*Math.PI*freq*T)*env*.2;});
  } else if (type==='impact') {
    fill(i=>{const T=t(i),env=Math.exp(-T*15);return(Math.random()*2-1)*env*.9+Math.sin(2*Math.PI*80*T)*env*.5;});
  } else if (type==='kick') {
    fill(i=>{const T=t(i),env=Math.exp(-T*12);return Math.sin(2*Math.PI*60*Math.exp(-T*20)*T)*env*.9+(Math.random()*2-1)*Math.exp(-T*30)*.4;});
  } else if (type==='snare') {
    fill(i=>{const T=t(i),env=Math.exp(-T*20);return(Math.random()*2-1)*env*.8+Math.sin(2*Math.PI*200*T)*env*.3;});
  } else if (type==='glitch_hit') {
    fill(i=>{const T=t(i),env=Math.exp(-T*20);return(Math.random()>.5?Math.random()*2-1:Math.sin(2*Math.PI*(300+Math.random()*400)*T))*env*.7;});
  } else if (type==='click') {
    fill(i=>{const T=t(i),env=Math.exp(-T*80);return Math.sin(2*Math.PI*1400*T)*env;});
  } else if (type==='notify') {
    fill(i=>{const T=t(i),env=Math.exp(-T*5);return Math.sin(2*Math.PI*(880+440*Math.floor(T*4))*T)*env*.6;});
  } else if (type==='success') {
    fill(i=>{const T=t(i),env=Math.exp(-T*3);return(Math.sin(2*Math.PI*523*T)+Math.sin(2*Math.PI*659*T)+Math.sin(2*Math.PI*784*T))*env*.3;});
  } else if (type==='coin') {
    fill(i=>{const T=t(i),env=Math.exp(-T*8);return(Math.sin(2*Math.PI*1047*T)+Math.sin(2*Math.PI*1319*T))*env*.4;});
  } else if (type==='wind') {
    fill(i=>{const T=t(i),env=Math.sin(Math.PI*T/dur);return(Math.random()*2-1)*env*.4;});
  } else if (type==='chime'||type==='bell') {
    const freqs=type==='bell'?[523,1047,1568]:[784,1047,1568];
    fill(i=>{const T=t(i),env=Math.exp(-T*(type==='bell'?1.5:3));return freqs.reduce((s,f)=>s+Math.sin(2*Math.PI*f*T)*env,0)/freqs.length;});
  } else if (type==='laser') {
    fill(i=>{const T=t(i),env=Math.exp(-T*6);return Math.sin(2*Math.PI*(1200-T*800)*T)*env*.6;});
  } else {
    fill(i => (Math.random()*2-1)*Math.exp(-t(i)*5));
  }
  const src = AC.createBufferSource(); src.buffer = buf;
  const g   = AC.createGain(); g.gain.value = 0.7;
  src.connect(g); g.connect(masterGain || AC.destination);
  src.start();
}

// ── EXPORT (WebM) ────────────────────────────────────────
function showExport() {
  const modal = document.createElement('div'); modal.className = 'modal-bg';
  modal.innerHTML = `<div class="modal">
    <h3>Export — WebM (VP9)</h3>
    <p>Fast browser export. For MP4 with properly muxed audio, use ⬇ MP4 button.<br>Open WebM in VLC or convert with Handbrake (free).</p>
    <div class="modal-row"><label>Resolution</label>
      <select class="prop-inp" id="expRes">
        <option value="640x360">640×360 (Draft)</option>
        <option value="1280x720" selected>1280×720 (HD)</option>
        <option value="1920x1080">1920×1080 (Full HD)</option>
      </select>
    </div>
    <div class="modal-row"><label>FPS</label>
      <select class="prop-inp" id="expFps">
        <option value="24">24 fps (Film)</option>
        <option value="30" selected>30 fps</option>
        <option value="60">60 fps</option>
      </select>
    </div>
    <div class="prog"><div class="prog-fill" id="xProg" style="width:0%"></div></div>
    <div class="stxt" id="xStatus">Ready · ${fmtTime(getTotalDuration())} total</div>
    <div class="modal-btns">
      <button class="tb-btn" onclick="this.closest('.modal-bg').remove()">Cancel</button>
      <button class="tb-btn tb-accent" onclick="doExport(this.closest('.modal-bg'))">Export WebM</button>
    </div></div>`;
  document.body.appendChild(modal);
}

async function doExport(modalEl) {
  const btn = modalEl.querySelector('.tb-btn.tb-accent');
  btn.disabled = true; btn.textContent = 'Exporting…';
  stopPlay();
  const [ew, eh] = id('expRes').value.split('x').map(Number);
  const expFps   = +id('expFps').value;
  const savedW = previewW, savedH = previewH;
  previewCanvas.width = ew; previewCanvas.height = eh;
  previewW = ew; previewH = eh;
  handleCanvas.width = ew; handleCanvas.height = eh;

  const stream = previewCanvas.captureStream(expFps);
  const rec    = new MediaRecorder(stream, { mimeType:'video/webm;codecs=vp9', videoBitsPerSecond:16000000 });
  const chunks = [];
  rec.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type:'video/webm' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'mannorr-export.webm'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 6000);
    modalEl.remove(); toast('Export complete!', 'success');
    resizePreviewCanvas();
  };
  rec.start(100);
  const totalDur = getTotalDuration(); const totalF = Math.ceil(totalDur * expFps); let f = 0;
  await new Promise(res => {
    const tmr = setInterval(() => {
      playhead = f / expFps; renderPreview();
      const pct = Math.round(f / totalF * 100);
      id('xProg').style.width = pct + '%';
      id('xStatus').textContent = `Exporting… ${pct}% · ${fmtTime(playhead)}`;
      f++; if (f > totalF) { clearInterval(tmr); setTimeout(() => { rec.stop(); res(); }, 400); }
    }, 1000 / expFps);
  });
  playhead = 0;
}

// ── FFMPEG.WASM EXPORT ───────────────────────────────────
function showFFmpegExport() {
  const modal = document.createElement('div'); modal.className = 'modal-bg';
  modal.innerHTML = `<div class="modal">
    <h3>Export MP4 via FFmpeg.wasm</h3>
    <p>Enables real MP4 with audio. <strong>First load ~30MB</strong> (cached after).<br>Renders each frame then encodes with libx264.</p>
    <div class="modal-row"><label>Resolution</label>
      <select class="prop-inp" id="ffRes">
        <option value="640x360">640×360 (Draft)</option>
        <option value="1280x720" selected>1280×720 (HD)</option>
        <option value="1920x1080">1920×1080 (Full HD)</option>
      </select>
    </div>
    <div class="modal-row"><label>FPS</label>
      <select class="prop-inp" id="ffFps">
        <option value="24">24 fps</option><option value="30" selected>30 fps</option><option value="60">60 fps</option>
      </select>
    </div>
    <div class="modal-row"><label>Quality</label>
      <select class="prop-inp" id="ffCrf">
        <option value="18">High (slow)</option><option value="23" selected>Medium</option><option value="28">Draft (fast)</option>
      </select>
    </div>
    <div class="prog"><div class="prog-fill" id="ffProg" style="width:0%"></div></div>
    <div class="stxt" id="ffStatus">Ready · ${fmtTime(getTotalDuration())} total</div>
    <div class="modal-btns">
      <button class="tb-btn" onclick="this.closest('.modal-bg').remove()">Cancel</button>
      <button class="tb-btn tb-warn" onclick="doFFmpegExport(this.closest('.modal-bg'))">⬇ Load FFmpeg & Export</button>
    </div></div>`;
  document.body.appendChild(modal);
}

async function doFFmpegExport(modalEl) {
  const btn = modalEl.querySelector('.tb-btn.tb-warn');
  btn.disabled = true; btn.textContent = 'Loading FFmpeg…';
  id('ffStatus').textContent = 'Loading FFmpeg.wasm (~30MB first time)…';
  try {
    if (!window.FFmpegWASM) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const { FFmpeg } = window.FFmpeg || window.FFmpegWASM || {};
    if (!FFmpeg) throw new Error('FFmpeg class not found');
    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      id('ffProg').style.width = Math.round(progress * 100) + '%';
      id('ffStatus').textContent = `Encoding… ${Math.round(progress*100)}%`;
    });
    await ffmpeg.load({ coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js' });
    id('ffStatus').textContent = 'Rendering frames…'; btn.textContent = 'Rendering…';

    const [ew, eh] = id('ffRes').value.split('x').map(Number);
    const expFps = +id('ffFps').value; const crf = id('ffCrf').value;
    stopPlay();
    const savedW = previewW, savedH = previewH;
    previewCanvas.width = ew; previewCanvas.height = eh; previewW = ew; previewH = eh;
    const totalDur = getTotalDuration(); const totalF = Math.ceil(totalDur * expFps);

    for (let f = 0; f < totalF; f++) {
      playhead = f / expFps; renderPreview();
      const blob = await new Promise(r => previewCanvas.toBlob(r, 'image/jpeg', 0.92));
      const arr  = await blob.arrayBuffer();
      await ffmpeg.writeFile(`f${String(f).padStart(5,'0')}.jpg`, new Uint8Array(arr));
      if (f % 20 === 0) {
        id('ffProg').style.width = (f/totalF*50) + '%';
        id('ffStatus').textContent = `Frame ${f}/${totalF}…`;
      }
    }
    id('ffStatus').textContent = 'Encoding video…';
    await ffmpeg.exec(['-framerate', String(expFps), '-i', 'f%05d.jpg', '-c:v', 'libx264', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'out.mp4']);
    const data = await ffmpeg.readFile('out.mp4');
    const blob  = new Blob([data.buffer], { type:'video/mp4' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a'); a.href = url; a.download = 'mannorr-export.mp4'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    modalEl.remove(); toast('MP4 exported!', 'success');
    resizePreviewCanvas(); playhead = 0;
  } catch(err) {
    id('ffStatus').textContent = 'Error: ' + err.message + ' — try WebM instead';
    btn.disabled = false; btn.textContent = 'Retry';
  }
}

// ── KEYBOARD SHORTCUTS ───────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag==='INPUT'||tag==='TEXTAREA'||e.target.contentEditable==='true') return;

  if (e.code==='Space')               { e.preventDefault(); togglePlay(); }
  else if (e.code==='KeyC' && !e.metaKey && !e.ctrlKey) { cutClip(); }
  else if (e.code==='KeyM' && !e.metaKey && !e.ctrlKey) { addMarker(); }
  else if (e.code==='KeyD' && (e.metaKey||e.ctrlKey))  { e.preventDefault(); duplicateClip(); }
  else if (e.code==='KeyZ' && (e.metaKey||e.ctrlKey) && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (e.code==='KeyZ' && (e.metaKey||e.ctrlKey) && e.shiftKey)  { e.preventDefault(); redo(); }
  else if (e.code==='KeyS' && (e.metaKey||e.ctrlKey)) { e.preventDefault(); saveProject(); }
  else if (e.code==='KeyN' && (e.metaKey||e.ctrlKey)) { e.preventDefault(); newProject(); }
  else if (e.code==='Delete'||e.code==='Backspace') {
    e.shiftKey ? rippleDelete() : deleteSelectedClip();
  }
  else if (e.code==='ArrowLeft')  { e.preventDefault(); seekRel(e.shiftKey ? -1 : -1/30); }
  else if (e.code==='ArrowRight') { e.preventDefault(); seekRel(e.shiftKey ?  1 :  1/30); }
  else if (e.code==='Home')       { e.preventDefault(); seekTo(0); }
  else if (e.code==='End')        { e.preventDefault(); seekTo(getTotalDuration()); }
  else if (e.code==='Escape')     { selectedClipId=null; multiSelected.clear(); renderTL(); clearHandles(); }
  else if (e.code==='BracketLeft')  { setZoom(clamp(pxPerSec - 20, 20, 600)); }
  else if (e.code==='BracketRight') { setZoom(clamp(pxPerSec + 20, 20, 600)); }
});

// Alt + scroll to zoom timeline
const tlBody = id('tlBody');
if (tlBody) {
  tlBody.addEventListener('wheel', e => {
    if (!e.altKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 20 : -20;
    setZoom(clamp(pxPerSec + delta, 20, 600));
  }, { passive: false });
}

// ── INITIALISE ───────────────────────────────────────────
function init() {
  const loader    = id('loader');
  const loaderBar = id('loaderBar');
  const loaderSt  = id('loaderStatus');
  const app       = id('app');

  const steps = [
    [10,  'Initialising audio…',    () => initAudio()],
    [25,  'Building filters…',      () => { if (typeof buildFilterPanel==='function') buildFilterPanel(); }],
    [40,  'Building title panel…',  () => buildTitlePanel()],
    [55,  'Building SFX panel…',    () => buildSfxPanel()],
    [65,  'Initialising color wheels…', () => { if (typeof initColorWheels==='function') initColorWheels(); }],
    [75,  'Restoring project…',     () => tryRestoreProject()],
    [88,  'Rendering timeline…',    () => renderTL()],
    [95,  'Setting up canvas…',     () => { resizePreviewCanvas(); renderPreview(); }],
    [100, 'Ready.',                 () => {}],
  ];

  let i = 0;
  const run = () => {
    if (i >= steps.length) {
      loader.classList.add('hidden');
      app.style.opacity = '1';
      initSelectionBox();
      startAutosave();
      return;
    }
    const [pct, msg, fn] = steps[i++];
    loaderBar.style.width = pct + '%';
    if (loaderSt) loaderSt.textContent = msg;
    setTimeout(() => { try { fn(); } catch(e) { console.warn(e); } run(); }, 80);
  };
  run();
}

// Listen for resize
window.addEventListener('resize', () => {
  resizePreviewCanvas();
  updateMinimap();
});

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
