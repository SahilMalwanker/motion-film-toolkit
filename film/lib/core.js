// Stage, timing, camera, screens, rendering and export for a 1920x1080, 60 fps canvas film.
import { writeMp4 } from './mp4.js';
import { createCardRenderer, perspective, lookAt, model } from './gl.js';
import { renderSoundtrack, encodeAac, wavBlob } from './audio.js';

export { model };

// ------------------------------------------------------------------ stage and theme
export const W = 1920, H = 1080, FPS = 60;
// Fonts are live bindings: setTheme() changes them for every module that imports them.
export let SANS = '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
export let TEXT = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
export let APP = '"Segoe UI", system-ui, sans-serif';
export let SERIF = '"Palatino Linotype", "Book Antiqua", Georgia, serif';
export const C = {
  bg: '#04070D', ink: '#F1F5F9', dim: '#94A3B8', blue: '#60A5FA', indigo: '#818CF8', teal: '#2DD4BF',
  red: '#F87171', amber: '#FBBF24', green: '#34D399', pink: '#F472B6', silver: '#CBD5E1',
  // Brand roles: accent leads (outlines, caption bars, the logo tile), accent2 and accent3 support it.
  accent: '#60A5FA', accent2: '#818CF8', accent3: '#2DD4BF',
};
const LOOK = { grid: true, grain: true };

// A colour by palette name ('accent', 'red') or any CSS colour.
export const colorOf = c => (c && C[c]) || c;

// 'r,g,b' for a #rgb, #rrggbb or rgb() colour, for building rgba() strings.
export function rgb(color) {
  const value = String(colorOf(color));
  const m = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return `${m[1]},${m[2]},${m[3]}`;
  let hex = value.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
  const n = parseInt(hex.slice(0, 6), 16);
  return Number.isNaN(n) ? '96,165,250' : `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// theme: { accent, accent2, accent3, bg, ink, dim or any palette colour as a CSS colour,
//          fonts: { display, text, app, serif } as CSS font-family lists, grid: true, grain: true }
export function setTheme(theme = {}) {
  const { fonts = {}, grid, grain, fontFaces, ...colors } = theme;
  for (const [key, value] of Object.entries(colors)) if (typeof value === 'string') C[key] = value;
  if (fonts.display) SANS = fonts.display;
  if (fonts.text) TEXT = fonts.text;
  if (fonts.app) APP = fonts.app;
  if (fonts.serif) SERIF = fonts.serif;
  if (grid !== undefined) LOOK.grid = grid;
  if (grain !== undefined) LOOK.grain = grain;
}

// The finished frame is composed offscreen, so encoding never depends on the page being on screen,
// and then copied to the page's canvas for preview.
const stage = document.getElementById('stage');
const stageCtx = stage.getContext('2d', { alpha: false });
export const out = new OffscreenCanvas(W, H);
const octx = out.getContext('2d', { alpha: false });
const frameCanvas = new OffscreenCanvas(W, H);
const mainCtx = frameCanvas.getContext('2d', { alpha: false });
// The context every drawing function uses; layer() points it at an offscreen layer for a moment.
export let ctx = mainCtx;

// Draw into a transparent layer, then composite the layer with opacity, blur, offset, scale about
// (ox, oy) and an optional clip rect [x, y, w, h]. Transitions use this so a whole scene moves as one.
const layers = [];
let depth = 0;
export function layer(draw, { alpha = 1, blur = 0, dx = 0, dy = 0, scale = 1, ox = W / 2, oy = H / 2, clip = null } = {}) {
  if (!layers[depth]) {
    const canvas = new OffscreenCanvas(W, H);
    layers[depth] = { canvas, ctx: canvas.getContext('2d') };
  }
  const L = layers[depth];
  const target = ctx;
  L.ctx.setTransform(1, 0, 0, 1, 0, 0);
  L.ctx.globalAlpha = 1;
  L.ctx.filter = 'none';
  L.ctx.globalCompositeOperation = 'source-over';
  L.ctx.clearRect(0, 0, W, H);
  depth++;
  ctx = L.ctx;
  try {
    draw();
  } finally {
    ctx = target;
    depth--;
  }
  if (alpha <= 0.001) return;
  target.save();
  target.globalAlpha *= alpha;
  if (blur > 0.2) target.filter = `blur(${blur}px)`;
  if (clip) {
    target.beginPath();
    target.rect(clip[0], clip[1], clip[2], clip[3]);
    target.clip();
  }
  target.translate(ox + dx, oy + dy);
  target.scale(scale, scale);
  target.translate(-ox, -oy);
  target.drawImage(L.canvas, 0, 0);
  target.restore();
}

// ------------------------------------------------------------------ maths
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const E = {
  lin: t => t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outQuint: t => 1 - Math.pow(1 - t, 5),
};

// Camera keys: { t, cx, cy, k, e }. cx, cy is the layout point at screen centre; k is pixels per CSS px.
// Zoom interpolates in log space so it feels even at every scale; e eases the move into that key.
export function cam(t, keys) {
  if (t <= keys[0].t) return { ...keys[0] };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const p = (b.e || E.inOutQuint)((t - a.t) / (b.t - a.t));
      return { cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), k: Math.exp(lerp(Math.log(a.k), Math.log(b.k), p)) };
    }
  }
  return { ...keys[keys.length - 1] };
}
// Frame a layout box so it fills `fill` of the screen; shift nudges it in screen pixels.
export function frame(box, fill = 0.85, shift = [0, 0]) {
  const k = Math.min((fill * W) / box[2], (fill * H) / box[3]);
  return { cx: box[0] + box[2] / 2 - shift[0] / k, cy: box[1] + box[3] / 2 - shift[1] / k, k };
}
export const at = (t, c, e) => ({ t, ...c, e });
// Keep a capture's right edge on the frame's right edge, where drawers open; needs clampEdges.
export const pinRight = (k, cy) => ({ cx: 1e4, cy, k });

// Slow a chapter down without redesigning it. knots: [[played, designed], ...], both ascending from
// [0, 0]; reading moments can be held longer while fast moves keep their designed pace.
export function retime(knots) {
  const map = (x, from, to) => {
    if (x <= knots[0][from]) return knots[0][to];
    for (let i = 1; i < knots.length; i++) {
      if (x <= knots[i][from]) {
        const a = knots[i - 1], b = knots[i];
        return a[to] + ((x - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
      }
    }
    return knots[knots.length - 1][to];
  };
  const last = knots[knots.length - 1];
  return { designedAt: played => map(played, 0, 1), playedAt: designed => map(designed, 1, 0), played: last[0], designed: last[1] };
}

// ------------------------------------------------------------------ screens
// A screen is an image of an app plus a manifest in layout pixels:
// { name, bmp, W, H, scale, radius, boxes } where W, H and boxes are layout px and the image holds
// scale image px per layout px (2 for a 2x browser capture, 3 for many phone screenshots, 1 for a plain
// screenshot measured in image px). Boxes are [x, y, w, h] in layout px.
export const shots = {};
let cards = null;
let grain = null;

async function loadScreen(entry) {
  if (typeof entry === 'string') {
    const fetchOk = async (path, as) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Screen "${entry}": missing film/${path}`);
      return response[as]();
    };
    const meta = await fetchOk(`shots/${entry}.json`, 'json');
    const image = meta.image || `${entry}.png`;
    if (!/^[\w.-]+$/.test(image)) throw new Error(`Screen "${entry}": image must be a file name in film/shots/`);
    const bmp = await createImageBitmap(await fetchOk(`shots/${image}`, 'blob'));
    const scale = meta.scale || 2;
    return { name: entry, bmp, W: meta.width || bmp.width / scale, H: meta.height || bmp.height / scale, scale, radius: meta.radius, boxes: meta.boxes || {} };
  }
  const drawn = await entry.draw();
  return { name: entry.name, bmp: await createImageBitmap(drawn.canvas), W: drawn.width, H: drawn.height, scale: drawn.scale || 2, radius: drawn.radius, boxes: drawn.boxes || {} };
}

// The colour of a screen pixel at layout point (x, y), so masks and typed text blend into any app.
const probe = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
const sampled = new Map();
export function colorAt(name, x, y) {
  const key = `${name}:${Math.round(x)}:${Math.round(y)}`;
  if (!sampled.has(key)) {
    const s = shots[name];
    probe.clearRect(0, 0, 1, 1);
    probe.drawImage(s.bmp, Math.round(x * s.scale), Math.round(y * s.scale), 1, 1, 0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    sampled.set(key, `rgb(${r},${g},${b})`);
  }
  return sampled.get(key);
}

// The part of a screen its home view shows: the first 16:9 of a landscape screen, all of a portrait one.
export function viewRegion(name) {
  const s = shots[name];
  return [0, 0, s.W, s.W >= s.H ? Math.min(s.H, (s.W * 9) / 16) : s.H];
}
// The camera that shows a screen's view region at `fill` of the frame; beats start and settle here.
export function fitView(name, fill = 0.84) {
  return frame(viewRegion(name), fill);
}

// Screens uploaded for the 3D card renderer, with the layout size of the region each one shows.
export const textureSize = {};
function uploadTexture(name) {
  const s = shots[name];
  const [, , rw, rh] = viewRegion(name);
  const k = Math.min(s.scale, 2048 / Math.max(rw, rh));
  const canvas = new OffscreenCanvas(Math.round(rw * k), Math.round(rh * k));
  const g = canvas.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(s.bmp, 0, 0, rw * s.scale, rh * s.scale, 0, 0, canvas.width, canvas.height);
  cards.addTexture(name, canvas);
  textureSize[name] = [rw, rh];
}

// screens: names of captures in film/shots/ (name.json plus its image), or { name, draw } generators.
// textures: screen names the 3D card renderer needs (rise and wall beats).
// fontFaces: [{ family, src, weight, style }] with src relative to film/, for fonts that are not installed.
export async function setup({ screens = [], textures = [], fontFaces = [] } = {}) {
  for (const face of fontFaces) {
    const font = new FontFace(face.family, `url(${face.src})`, { weight: String(face.weight || 'normal'), style: face.style || 'normal' });
    document.fonts.add(await font.load());
  }
  await document.fonts.load(`600 64px ${SANS}`);
  await document.fonts.load(`400 32px ${TEXT}`);
  await document.fonts.load(`italic 400 64px ${SERIF}`);
  for (const screen of await Promise.all(screens.map(loadScreen))) shots[screen.name] = screen;
  cards = cards || createCardRenderer(W, H);
  for (const name of textures) if (shots[name] && !textureSize[name]) uploadTexture(name);
  if (grain) return;
  grain = new OffscreenCanvas(256, 256);
  const g = grain.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ drawing primitives
export function rrPath(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
export function rr(c, x, y, w, h, r) { c.beginPath(); rrPath(c, x, y, w, h, r); }

export let DURATION = 60;

// Drifting glows in the theme's accent colours over a faint receding grid.
function background(t) {
  const bg = rgb(C.bg);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = (x, y, r, color, alpha) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb(color)},${alpha})`);
    g.addColorStop(1, `rgba(${bg},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W * 0.18 + Math.sin(t * 0.23) * 140, H * 0.22 + Math.cos(t * 0.17) * 90, 1000, C.accent, 0.2);
  glow(W * 0.86 + Math.cos(t * 0.14) * 160, H * 0.82 + Math.sin(t * 0.21) * 100, 1100, C.accent2, 0.17);
  glow(W * 0.55 + Math.sin(t * 0.11) * 220, H * 0.05, 800, C.accent3, 0.07);
  if (LOOK.grid) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 1;
    const drift = (t * 18) % 96;
    ctx.beginPath();
    for (let x = -96 + drift; x < W + 96; x += 96) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -96 + drift * 0.5; y < H + 96; y += 96) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    ctx.restore();
  }
  const fade = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 1150);
  fade.addColorStop(0, `rgba(${bg},0)`);
  fade.addColorStop(1, `rgba(${bg},0.9)`);
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);
}

// Vignette, moving film grain, and a fade from and to black at the ends.
function finish(t) {
  const v = ctx.createRadialGradient(W / 2, H / 2, 520, W / 2, H / 2, 1250);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  if (LOOK.grain) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.07;
    const pattern = ctx.createPattern(grain, 'repeat');
    const ox = Math.floor((Math.sin(t * 91.7) * 0.5 + 0.5) * 256), oy = Math.floor((Math.cos(t * 57.3) * 0.5 + 0.5) * 256);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  }
  const black = Math.max(1 - seg(t, 0, 0.5), seg(t, DURATION - 0.75, DURATION));
  if (black > 0) { ctx.fillStyle = `rgba(0,0,0,${black})`; ctx.fillRect(0, 0, W, H); }
}

// Draw a screen as a floating window through a camera; returns a mapper from layout boxes to the frame.
// dx, dy slide the window (whip pans, slide-ins), blur and bright soften it behind titles.
export function shot(name, camera, opt = {}) {
  const s = shots[name];
  if (!s) throw new Error(`Unknown screen "${name}"`);
  const { alpha = 1, radius = s.radius ?? 14, blur = 0, bright = 1, dx = 0, dy = 0, clampEdges = false } = opt;
  const k = camera.k;
  // Keep a screen larger than the frame from revealing the void beyond its edges.
  const cx = clampEdges && k * s.W >= W ? clamp(camera.cx, W / 2 / k, s.W - W / 2 / k) : camera.cx;
  const cy = clampEdges && k * s.H >= H ? clamp(camera.cy, H / 2 / k, s.H - H / 2 / k) : camera.cy;
  const x0 = W / 2 - cx * k + dx, y0 = H / 2 - cy * k + dy;
  const w = s.W * k, h = s.H * k;
  const map = b => [x0 + b[0] * k, y0 + b[1] * k, b[2] * k, b[3] * k];
  const pt = (x, y) => [x0 + x * k, y0 + y * k];
  if (alpha <= 0.001) return { map, pt, k, x0, y0 };
  const r = radius * Math.min(k, 1.4);
  const covers = x0 <= 0 && y0 <= 0 && x0 + w >= W && y0 + h >= H;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (!covers) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 30;
    ctx.fillStyle = '#0B1220';
    rr(ctx, x0, y0, w, h, r);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  rr(ctx, x0, y0, w, h, r);
  ctx.clip();
  if (blur > 0.2) ctx.filter = `blur(${blur}px)`;
  const pad = blur > 0.2 ? blur * 3 : 0;
  const vx0 = Math.max(-pad, x0), vy0 = Math.max(-pad, y0), vx1 = Math.min(W + pad, x0 + w), vy1 = Math.min(H + pad, y0 + h);
  if (vx1 > vx0 && vy1 > vy0) {
    ctx.imageSmoothingQuality = 'high';
    const q = s.scale;
    ctx.drawImage(s.bmp, ((vx0 - x0) / k) * q, ((vy0 - y0) / k) * q, ((vx1 - vx0) / k) * q, ((vy1 - vy0) / k) * q, vx0, vy0, vx1 - vx0, vy1 - vy0);
  }
  ctx.filter = 'none';
  if (bright < 1) { ctx.fillStyle = `rgba(4,7,13,${1 - bright})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  if (!covers) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    rr(ctx, x0 + 0.5, y0 + 0.5, w - 1, h - 1, r);
    ctx.stroke();
  }
  ctx.restore();
  return { map, pt, k, x0, y0 };
}

// Copy a region of one screen onto another view, e.g. an enabled button over a disabled one.
export function patch(fromName, fromBox, view, toBox, alpha = 1) {
  const s = shots[fromName];
  const [x, y, w, h] = view.map(toBox);
  const q = s.scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(s.bmp, fromBox[0] * q, fromBox[1] * q, fromBox[2] * q, fromBox[3] * q, x, y, w, h);
  ctx.restore();
}

// ------------------------------------------------------------------ 3D
export const FOV = (30 * Math.PI) / 180;
// Camera distance at which a 1920x1080 card at z = 0 exactly fills the frame.
export const DIST = (H / 2) / Math.tan(FOV / 2);
export function glCamera(eye, target = [0, 0, 0], up = [0, 1, 0]) {
  return { projection: perspective(FOV, W / H, 10, 40000), view: lookAt(eye, target, up) };
}
// list: [{ texture, matrix: model({...}), w, h, radius, alpha, bright, shadowBlur }]
export function drawCards(camera, list, alpha = 1) {
  const canvas = cards.render(camera, list);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
}

// ------------------------------------------------------------------ film definition and rendering
let film = { duration: 60, scenes: [], blur: [], cues: {}, sections: {} };

// scenes: [[from, to, draw(t)], ...] in film seconds, drawn in order; overlaps make transitions.
// blur: [[from, to, samples], ...] windows rendered with motion blur.
// cues and sections drive the soundtrack; see audio.js.
export function defineFilm(definition) {
  film = { blur: [], cues: {}, sections: {}, ...definition };
  DURATION = film.duration;
}

function renderScene(t) {
  ctx = mainCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  background(t);
  for (const [a, b, draw] of film.scenes) if (t >= a && t < b) draw(t);
  finish(t);
}

// Inside a blur window the frame averages several renders across half a frame of shutter.
export function renderFrame(t) {
  const blur = film.blur.find(([a, b]) => t >= a && t < b);
  if (!blur) {
    renderScene(t);
    octx.drawImage(frameCanvas, 0, 0);
  } else {
    const n = blur[2];
    const shutter = 0.5 / FPS;
    for (let i = 0; i < n; i++) {
      renderScene(t + (i / (n - 1) - 0.5) * shutter);
      octx.globalAlpha = 1 / (i + 1);
      octx.drawImage(frameCanvas, 0, 0);
    }
    octx.globalAlpha = 1;
  }
  stageCtx.drawImage(out, 0, 0);
}

// ------------------------------------------------------------------ soundtrack
// The whole film's soundtrack, or the [from, to] slice of it, so a partial render sounds exactly like
// the same moment in the full film.
export async function soundtrack(from = 0, to = DURATION) {
  const full = await renderSoundtrack(DURATION, film.cues, 48000, film.sections);
  if (from <= 0 && to >= DURATION) return full;
  const rate = full.sampleRate;
  const a = Math.max(0, Math.round(from * rate)), b = Math.min(full.length, Math.round(to * rate));
  const part = new AudioBuffer({ length: Math.max(1, b - a), numberOfChannels: full.numberOfChannels, sampleRate: rate });
  for (let c = 0; c < full.numberOfChannels; c++) part.copyToChannel(full.getChannelData(c).subarray(a, b), c);
  return part;
}

// ------------------------------------------------------------------ live preview
let playing = null, audioContext = null, audioSource = null, soundBuffer = null;

// Real-time preview with sound. Motion-blur windows cost several renders per frame, so playback may
// drop frames there; the exported file never does.
export async function play(from = 0, onTime = () => {}) {
  stop();
  soundBuffer = soundBuffer || await soundtrack();
  audioContext = audioContext || new AudioContext();
  await audioContext.resume();
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = soundBuffer;
  audioSource.connect(audioContext.destination);
  const startedAt = audioContext.currentTime - from;
  audioSource.start(0, from);
  const tick = () => {
    const t = audioContext.currentTime - startedAt;
    if (t >= DURATION) { stop(); onTime(DURATION); return; }
    renderFrame(t);
    onTime(t);
    playing = requestAnimationFrame(tick);
  };
  playing = requestAnimationFrame(tick);
}

export function stop() {
  if (playing) cancelAnimationFrame(playing);
  playing = null;
  if (audioSource) { try { audioSource.stop(); } catch { /* already stopped */ } }
  audioSource = null;
}

// ------------------------------------------------------------------ export
// Save a blob through server.py: path is /save/<shots|out>/<file name>.
export async function post(path, blob) {
  const response = await fetch(path, { method: 'POST', body: blob });
  if (!response.ok) throw new Error(`save failed ${response.status}`);
  return response.text();
}

// Renders every frame, encodes H.264 and AAC with WebCodecs, muxes an MP4 and saves it to film/out/.
// Without an AAC encoder (common on Linux) the MP4 has no audio track; the WAV is always saved beside it.
export async function renderVideo({ from = 0, to = DURATION, name = 'film', bitrate = 14_000_000, onProgress } = {}) {
  const t0 = performance.now();
  const codec = await pickVideoCodec(bitrate);
  if (!codec) throw new Error('This browser has no H.264 VideoEncoder for 1920x1080 at 60 fps; use Chrome or Edge.');
  let failure = null;
  const samples = [];
  let avcC = null, colorSpace = null;
  const encoder = new VideoEncoder({
    output(chunk, meta) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push({ data, timestamp: chunk.timestamp, key: chunk.type === 'key' });
      if (meta && meta.decoderConfig) {
        if (meta.decoderConfig.description && !avcC) {
          const d = meta.decoderConfig.description;
          avcC = new Uint8Array(d instanceof ArrayBuffer ? d.slice(0) : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength));
        }
        if (meta.decoderConfig.colorSpace) colorSpace = meta.decoderConfig.colorSpace;
      }
    },
    error(e) { failure = e; },
  });
  encoder.configure({ codec, width: W, height: H, bitrate, bitrateMode: 'variable', framerate: FPS, latencyMode: 'quality', avc: { format: 'avc' } });
  const first = Math.round(from * FPS), last = Math.round(to * FPS);
  for (let i = first; i < last; i++) {
    renderFrame(i / FPS);
    const vf = new VideoFrame(out, { timestamp: Math.round(((i - first) * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    encoder.encode(vf, { keyFrame: (i - first) % (FPS * 2) === 0 });
    vf.close();
    // Wait while the encoder catches up; fail with a clear message rather than hang if it stops.
    while (encoder.encodeQueueSize > 4) {
      const moved = await Promise.race([
        new Promise(r => encoder.addEventListener('dequeue', () => r(true), { once: true })),
        new Promise(r => setTimeout(() => r(false), 20000)),
      ]);
      if (failure) throw failure;
      if (!moved && encoder.encodeQueueSize > 4) {
        throw new Error(`The video encoder stopped responding at ${(i / FPS).toFixed(2)} s (state ${encoder.state}). Keep the browser window visible and in front, then render again.`);
      }
    }
    if (failure) throw failure;
    if (onProgress && i % 60 === 0) onProgress(i / FPS);
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  const videoSeconds = (performance.now() - t0) / 1000;

  // Frames arrive in decode order; composition offsets cover any reordering.
  const frameIndex = s => Math.round((s.timestamp * FPS) / 1e6);
  const video = {
    width: W, height: H, timescale: FPS * 1000, avcC, colorSpace,
    samples: samples.map((s, i) => ({ data: s.data, key: s.key, duration: 1000, offset: (frameIndex(s) - i) * 1000 })),
  };
  const shift = Math.min(0, ...video.samples.map(s => s.offset));
  video.samples.forEach(s => { s.offset -= shift; });

  const sound = await soundtrack(from, to);
  let audio = null;
  if (await aacSupported()) {
    const aac = await encodeAac(sound, 192000);
    audio = {
      sampleRate: aac.sampleRate, channels: 2, bitrate: aac.bitrate, asc: aac.asc, timescale: aac.sampleRate,
      samples: aac.chunks.map(c => ({ data: c.data, duration: Math.round((c.duration * aac.sampleRate) / 1e6) || 1024, key: true })),
    };
  }
  const mp4 = writeMp4(video, audio);
  await post(`/save/out/${name}.mp4`, mp4);
  await post(`/save/out/${name}-soundtrack.wav`, wavBlob(sound));
  return {
    file: `film/out/${name}.mp4`, frames: samples.length, bytes: mp4.size, videoSeconds: Math.round(videoSeconds), codec, colorSpace,
    reordered: shift !== 0 || video.samples.some(s => s.offset), audio: Boolean(audio), audioChunks: audio ? audio.samples.length : 0,
  };
}

// H.264 High, then Main, then Baseline at level 5.0: the first one this browser can encode.
export async function pickVideoCodec(bitrate = 14_000_000) {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of ['avc1.640032', 'avc1.4d0032', 'avc1.420032']) {
    const { supported } = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate, framerate: FPS, avc: { format: 'avc' } });
    if (supported) return codec;
  }
  return null;
}

export async function aacSupported() {
  if (typeof AudioEncoder === 'undefined') return false;
  const { supported } = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
  return Boolean(supported);
}

// Save stills at chosen film times to film/out/, for checking composition without a full render.
export async function preview(times, prefix = 'preview') {
  const saved = [];
  for (const t of times) {
    renderFrame(t);
    const blob = await out.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    const name = `${prefix}-${String(Math.round(t * 100)).padStart(5, '0')}.jpg`;
    await post(`/save/out/${name}`, blob);
    saved.push(name);
  }
  return saved;
}
