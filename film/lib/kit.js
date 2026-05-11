// The kit: assemble a film from beats. A storyboard module does
//
//   import { makeFilm, beats as B, placeholder } from './lib/kit.js';
//   export default makeFilm({ brand, theme, screens, beats: [B.title({ ... }), B.tour({ ... }), ...] });
//
// and film/index.html starts it with start(). The kit lays the beats end to end, overlaps neighbours
// for their transitions, adds motion blur where things move fast, places sound effects on the picture,
// shapes the music from each beat's energy, and checks that every screen and box exists.
import * as core from './core.js';
import * as fx from './effects.js';
import * as beats from './beats.js';
import { placeholder } from './placeholders.js';

export { beats, placeholder, core, fx };

const { E, W, H, seg, clamp } = core;

// Transition lengths in seconds. A beat's `enter` picks one by name or as { type, len }.
export const TRANSITIONS = {
  cut: 0, fade: 0.5, dip: 0.8, blur: 0.6, zoom: 0.7, 'zoom-out': 0.7, flash: 0.3, wipe: 0.7,
  'whip-left': 0.55, 'whip-right': 0.55, 'whip-up': 0.55, 'whip-down': 0.55, 'slide-up': 0.6, 'slide-down': 0.6,
};
// Layer settings [outgoing, incoming] at transition progress p (0..1); see core.layer().
const SIDES = {
  cut: () => [{}, {}],
  fade: p => [{ alpha: 1 - E.inOut(p) }, { alpha: E.inOut(p) }],
  dip: p => [{ alpha: 1 - E.inOut(seg(p, 0, 0.5)) }, { alpha: E.inOut(seg(p, 0.5, 1)) }],
  blur: p => [{ alpha: 1 - E.in(p), blur: 18 * E.in(p), scale: 1 + 0.04 * p }, { alpha: E.out(p), blur: 18 * (1 - E.out(p)), scale: 1.04 - 0.04 * E.out(p) }],
  zoom: p => [{ alpha: 1 - E.in(p), blur: 16 * E.in(p), scale: 1 + 0.6 * E.inExpo(p) }, { alpha: E.out(seg(p, 0.15, 1)), blur: 10 * (1 - E.out(p)), scale: 0.86 + 0.14 * E.outExpo(p) }],
  'zoom-out': p => [{ alpha: 1 - E.in(p), blur: 10 * E.in(p), scale: 1 - 0.25 * E.in(p) }, { alpha: E.out(p), blur: 14 * (1 - E.out(p)), scale: 1.35 - 0.35 * E.outExpo(p) }],
  flash: p => [{ alpha: p < 0.5 ? 1 : 0 }, { alpha: p < 0.5 ? 0 : 1 }],
  wipe: p => [{}, { clip: [0, 0, W * E.inOutQuint(p), H] }],
  // Whips pan the camera across two neighbouring frames: both move together, fast in the middle.
  'whip-left': p => [{ dx: -W * 1.25 * E.inOutExpo(p) }, { dx: W * 1.25 * (1 - E.inOutExpo(p)) }],
  'whip-right': p => [{ dx: W * 1.25 * E.inOutExpo(p) }, { dx: -W * 1.25 * (1 - E.inOutExpo(p)) }],
  'whip-up': p => [{ dy: -H * 1.2 * E.inOutExpo(p) }, { dy: H * 1.2 * (1 - E.inOutExpo(p)) }],
  'whip-down': p => [{ dy: H * 1.2 * E.inOutExpo(p) }, { dy: -H * 1.2 * (1 - E.inOutExpo(p)) }],
  'slide-up': p => [{ alpha: 1 - E.in(p), dy: -H * 0.12 * E.in(p) }, { alpha: E.out(p), dy: H * 0.4 * (1 - E.outQuint(p)) }],
  'slide-down': p => [{ alpha: 1 - E.in(p), dy: H * 0.12 * E.in(p) }, { alpha: E.out(p), dy: -H * 0.4 * (1 - E.outQuint(p)) }],
};
const MOVING = new Set(['zoom', 'zoom-out', 'whip-left', 'whip-right', 'whip-up', 'whip-down', 'slide-up', 'slide-down']);
// Whoosh per transition: true sweeps up in pitch, false sweeps down; missing means silent.
const WHOOSH = { zoom: true, 'zoom-out': false, blur: false, wipe: true, 'whip-left': true, 'whip-right': true, 'whip-up': true, 'whip-down': false, 'slide-up': true, 'slide-down': false };
const DEFAULT_ENTER = { title: 'blur', statement: 'blur', logo: 'zoom', end: 'fade', rise: 'fade', tour: 'whip-left', type: 'slide-up', click: 'whip-left', drawer: 'whip-left', grid: 'zoom', wall: 'blur', custom: 'fade' };
const ENERGY = { title: 0.65, statement: 0.6, logo: 0.75, end: 0.35, rise: 0.8, tour: 0.85, type: 0.6, click: 0.8, drawer: 0.8, grid: 0.9, wall: 1, custom: 0.8 };
const CUE_KINDS = ['impacts', 'whooshes', 'risers', 'clicks', 'typing', 'blips'];

// The storyboard's default export. { brand, theme, screens, beats, music, cues } as in docs/beats.md.
export function makeFilm(film) {
  return film;
}

// ------------------------------------------------------------------ layout
const typeOf = enter => (typeof enter === 'string' ? enter : enter && enter.type);

function layout(list, brand) {
  const L = list.map((b, i) => {
    const prev = list[i - 1];
    // A beat that continues on the screen a rise or a title-over-screen just settled on cuts straight in.
    const continues = prev && b.screen && prev.screen === b.screen && (prev.kind === 'rise' || prev.kind === 'title');
    const enter = b.enter ?? (i === 0 || continues ? 'cut' : DEFAULT_ENTER[b.kind] || 'fade');
    const type = typeOf(enter);
    const len = i === 0 && type === 'cut' ? 0 : typeof enter === 'object' && enter.len != null ? enter.len : TRANSITIONS[type];
    return { b, i, type, inLen: len };
  });
  L.forEach((x, i) => {
    x.outLen = i < L.length - 1 ? L[i + 1].inLen : 0;
    x.next = L[i + 1] || null;
    x.start = i === 0 ? 0 : L[i - 1].start + L[i - 1].inLen + L[i - 1].b.content;
    x.dur = x.inLen + x.b.content + x.outLen;
  });
  const last = L[L.length - 1];
  const duration = last.start + last.inLen + last.b.content;

  const scenes = L.map(x => [x.start, x.start + x.dur, t => drawBeat(x, t, brand)]);
  // Person tags live above the beats so they stay put through transitions between the same person's beats.
  const spans = [];
  for (const x of L) {
    if (!x.b.who) continue;
    const a = x.start + x.inLen * 0.5, b = x.start + x.inLen + x.b.content + x.outLen * 0.5;
    const prev = spans[spans.length - 1];
    if (prev && prev[2].name === x.b.who.name && a - prev[1] < 0.6) prev[1] = b;
    else spans.push([a, b, x.b.who]);
  }
  if (spans.length) scenes.push([0, duration, t => fx.personTag(t, spans)]);

  const cues = Object.fromEntries(CUE_KINDS.map(k => [k, []]));
  const blur = [];
  let lastHit = -10;
  for (const x of L) {
    const t0 = x.start + x.inLen;
    const own = x.b.cues();
    for (const kind of CUE_KINDS) {
      for (const cue of own[kind] || []) cues[kind].push(Array.isArray(cue) ? [cue[0] + t0, ...cue.slice(1)] : cue + t0);
    }
    if (x.i > 0 && x.type in WHOOSH) cues.whooshes.push([Math.max(0, x.start - 0.1), x.inLen + 0.3, WHOOSH[x.type]]);
    if (x.type === 'flash') cues.impacts.push(x.start + x.inLen / 2);
    const hit = x.b.hit !== undefined ? x.b.hit : x.b.kind === 'title' && x.i > 0 ? 'riser' : null;
    if (hit) {
      const at = t0 + x.b.hitAt;
      cues.impacts.push(at);
      const len = Math.min(2, at - lastHit - 0.5, at);
      if (hit === 'riser' && len >= 0.6) cues.risers.push([at - len, len]);
      lastHit = at;
    }
    // Motion blur through moving transitions; whips are fastest, so they get the most samples.
    if (x.i > 0 && MOVING.has(x.type)) blur.push([x.start - 0.02, x.start + x.inLen + 0.02, x.type.startsWith('whip') ? 14 : 8]);
    for (const [a, b, n] of x.b.blur()) blur.push([t0 + a, t0 + b, n]);
  }
  // Web Audio cannot schedule a sound before 0 s.
  for (const kind of CUE_KINDS) cues[kind] = cues[kind].map(cue => (Array.isArray(cue) ? [Math.max(0, cue[0]), ...cue.slice(1)] : Math.max(0, cue)));

  const level = x => x.b.energy ?? (x.i === 0 && x.b.kind === 'title' ? 0.2 : ENERGY[x.b.kind] ?? 0.8);
  const energy = [];
  for (const x of L) energy.push([x.start + x.inLen * 0.5, level(x)], [x.start + x.inLen + x.b.content, level(x)]);
  energy.push([duration, 0]);
  // The soundtrack interpolates between these points, so their times must strictly increase.
  for (let i = 1; i < energy.length; i++) if (energy[i][0] <= energy[i - 1][0]) energy[i][0] = energy[i - 1][0] + 0.01;
  const where = test => {
    const out = [];
    for (const x of L) {
      if (!test(level(x))) continue;
      const a = x.start, b = x.start + x.inLen + x.b.content;
      const prev = out[out.length - 1];
      if (prev && a - prev[1] < 0.05) prev[1] = b;
      else out.push([a, b]);
    }
    return out;
  };
  const sections = { energy, drums: where(e => e >= 0.7), hats: where(e => e >= 0.82), arp: where(e => e >= 0.6), bass: where(e => e >= 0.3) };

  const round = v => Math.round(v * 100) / 100;
  const timeline = L.map(x => ({
    index: x.i + 1, kind: x.b.kind, label: x.b.label, enter: x.type,
    start: round(x.start), content: [round(x.start + x.inLen), round(x.start + x.inLen + x.b.content)],
    marks: x.b.marks().map(m => round(x.start + x.inLen + m)),
  }));
  const transitions = L.filter(x => x.i > 0 && x.inLen > 0).map(x => round(x.start + x.inLen / 2));
  return { duration, scenes, cues, blur, sections, timeline, transitions };
}

// Draw one beat at film time t, through a layer while it is entering or leaving.
function drawBeat(x, t, brand) {
  const u = t - x.start;
  const c = u - x.inLen;
  const info = { content: x.b.content, inLen: x.inLen, outLen: x.outLen, brand, index: x.i };
  let side = -1, p = 0, type = null;
  if (x.inLen > 0 && u < x.inLen) {
    side = 1;
    p = u / x.inLen;
    type = x.type;
  } else if (x.outLen > 0 && c > x.b.content) {
    side = 0;
    p = (c - x.b.content) / x.outLen;
    type = x.next.type;
  }
  if (side < 0) {
    x.b.draw(c, info);
    return;
  }
  const s = SIDES[type](clamp(p))[side];
  const still = (s.alpha ?? 1) >= 0.999 && !(s.blur > 0.2) && !s.dx && !s.dy && (s.scale ?? 1) === 1 && !s.clip;
  if (still) x.b.draw(c, info);
  else if ((s.alpha ?? 1) > 0.001) core.layer(() => x.b.draw(c, info), s);
  if (side === 1 && type === 'flash') overlay(`rgba(255,255,255,${0.8 * Math.sin(clamp(p) * Math.PI)})`);
  if (side === 1 && type === 'wipe') wipeEdge(E.inOutQuint(clamp(p)));
}

function overlay(fill) {
  core.ctx.fillStyle = fill;
  core.ctx.fillRect(0, 0, W, H);
}
function wipeEdge(e) {
  if (e <= 0 || e >= 1) return;
  const ctx = core.ctx;
  const x = W * e;
  const g = ctx.createLinearGradient(x - 70, 0, x + 6, 0);
  g.addColorStop(0, `rgba(${core.rgb(core.C.accent)},0)`);
  g.addColorStop(1, `rgba(${core.rgb(core.C.accent)},0.55)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - 70, 0, 76, H);
}

// ------------------------------------------------------------------ checks
function check(list, duration) {
  const errors = [], warnings = [];
  list.forEach((b, i) => {
    const where = `Beat ${i + 1} (${b.label})`;
    if (!(b.content > 0)) errors.push(`${where}: its duration must be a positive number of seconds`);
    const type = typeOf(b.enter);
    if (b.enter !== undefined && !(type in TRANSITIONS)) errors.push(`${where}: unknown transition "${type}"; use one of ${Object.keys(TRANSITIONS).join(', ')}`);
    for (const name of b.needs.screens) if (!core.shots[name]) errors.push(`${where}: there is no screen "${name}"`);
    for (const [name, key] of b.needs.boxes) {
      const s = core.shots[name];
      if (s && !s.boxes[key]) errors.push(`${where}: screen "${name}" has no box "${key}" (it has: ${Object.keys(s.boxes).join(', ') || 'none'})`);
    }
    for (const { what, text, max } of b.texts) {
      if (text && text.length > max) warnings.push(`${where}: ${what} "${text}" has ${text.length} characters; keep it under ${max} so it fits and can be read in time`);
    }
  });
  if (duration > 150) warnings.push(`The film runs ${duration.toFixed(1)} s; product films usually work best between 30 and 90 s`);
  return { errors, warnings };
}

async function loadImage(path) {
  if (!/^[\w-]+(\/[\w.-]+)*\.(png|jpg|jpeg|webp|svg)$/i.test(path) || path.includes('..')) throw new Error(`brand.image must be a path inside film/, such as assets/logo.png: ${path}`);
  const response = await fetch(path);
  if (!response.ok) throw new Error(`brand.image: missing film/${path}`);
  const blob = await response.blob();
  if (!blob.type.includes('svg')) return createImageBitmap(blob);
  // SVG needs an <img> to rasterise; draw it at a size large enough for the logo beats.
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = 600 / Math.max(img.naturalWidth || 600, img.naturalHeight || 600);
    return await createImageBitmap(img, { resizeWidth: Math.round((img.naturalWidth || 600) * k), resizeHeight: Math.round((img.naturalHeight || 600) * k), resizeQuality: 'high' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ------------------------------------------------------------------ start
// Load the film's screens and fonts, check the storyboard, lay it out and return the film API.
export async function start(film) {
  if (!film || !Array.isArray(film.beats) || !film.beats.length) {
    throw new Error('The storyboard must `export default makeFilm({ beats: [...] })` with at least one beat');
  }
  const { brand: brandSpec = {}, theme = {}, screens = [], beats: list, music = {}, cues: extra = {} } = film;
  core.setTheme(theme);
  const brand = { name: 'Product', tagline: '', url: '', line: '', ...brandSpec };
  const generators = screens.filter(s => s && typeof s === 'object');
  const given = new Set(generators.map(g => g.name));
  const captures = new Set(screens.filter(s => typeof s === 'string'));
  for (const b of list) for (const name of b.needs.screens) if (!given.has(name)) captures.add(name);
  await core.setup({
    screens: [...generators, ...captures],
    textures: [...new Set(list.flatMap(b => b.needs.textures))],
    fontFaces: theme.fontFaces || [],
  });
  if (brand.image) brand.bitmap = await loadImage(brand.image);

  const plan = layout(list, brand);
  const { errors, warnings } = check(list, plan.duration);
  if (errors.length) {
    const also = warnings.length ? `\nWarnings:\n- ${warnings.join('\n- ')}` : '';
    throw new Error(`Storyboard problems:\n- ${errors.join('\n- ')}${also}`);
  }
  const cues = { ...plan.cues };
  for (const kind of CUE_KINDS) cues[kind] = [...plan.cues[kind], ...(extra[kind] || [])];
  core.defineFilm({ duration: plan.duration, scenes: plan.scenes, blur: plan.blur, cues, sections: { ...plan.sections, ...music } });
  core.renderFrame(0);

  const marks = plan.timeline.flatMap(b => b.marks);
  const unique = list2 => [...new Set(list2.map(t => Math.min(plan.duration - 0.05, Math.max(0, t)).toFixed(2)))].map(Number).sort((a, b) => a - b);
  return {
    duration: plan.duration,
    timeline: plan.timeline,
    warnings,
    brand: brand.name,
    // Frames worth checking: every beat's key moments, and with transitions the middle of each one.
    stillTimes: (withTransitions = true) => unique(withTransitions ? [...marks, ...plan.transitions] : marks),
    beatAt: t => plan.timeline.filter(b => t >= b.start).pop() || plan.timeline[0],
    renderFrame: core.renderFrame,
    preview: core.preview,
    renderVideo: core.renderVideo,
    play: core.play,
    stop: core.stop,
  };
}
