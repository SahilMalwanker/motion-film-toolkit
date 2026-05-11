// Beats: reusable scene recipes that work on any app's screens. A beat takes screen names, box names and
// words, and returns an object that kit.js places on the timeline with transitions, sound and music.
//
// Timing: each beat draws in content time c. c = 0 when its entrance transition has finished and
// c = content when its exit transition starts; c is negative during the entrance and greater than
// content during the exit, so every beat holds a sensible frame outside [0, content].
//
// Options every beat accepts:
//   enter     transition into this beat: 'cut' 'fade' 'dip' 'blur' 'zoom' 'zoom-out' 'whip-left'
//             'whip-right' 'whip-up' 'whip-down' 'slide-up' 'slide-down' 'flash' 'wipe', or { type, len }
//   caption   'Title.' or ['Title.', 'Subtitle.'] or [[parts...], 'Subtitle.'], a lower-third caption
//   who       { role, name, initials, color }: a person tag, top left, kept across consecutive beats
//   energy    0..1, how much the music drives under this beat
//   hit       'impact' or 'riser' (riser into an impact) at the start of the beat, or null
//   label     a name for reports and the preview bar
// See docs/beats.md for each beat's own options.
import { ctx, W, H, C, E, SANS, TEXT, APP, clamp, lerp, seg, cam, at, shots, shot, colorAt, fitView, textureSize, model, DIST, glCamera, drawCards, colorOf, rgb } from './core.js';
import * as fx from './effects.js';

// ------------------------------------------------------------------ helpers
const isRect = b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite);
const col = c => colorOf(c) || C.accent;
const centre = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];
const union = (a, b) => {
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
  return [x, y, Math.max(a[0] + a[2], b[0] + b[2]) - x, Math.max(a[1] + a[3], b[1] + b[3]) - y];
};
const pad = (b, p) => [b[0] - p, b[1] - p, b[2] + p * 2, b[3] + p * 2];

// A box on a screen by name, or a literal [x, y, w, h] in layout px.
export function boxOf(screen, key) {
  if (isRect(key)) return key;
  const s = shots[screen];
  const b = s && s.boxes[key];
  if (!b) throw new Error(`Screen "${screen}" has no box "${key}"`);
  return b;
}

// Words for effects.words(): 'Plain text', or an array of strings and { text, color, accent, serif, weight }.
export function toParts(x, color) {
  const list = Array.isArray(x) ? x : [x];
  return list.map(p => (typeof p === 'string' ? { text: p, color } : { color, ...p }));
}
const plain = x => toParts(x).map(p => p.text).join(' ');

// A camera framing box at `fill` of the frame, centred in band [top, bottom] (frame px) so it clears a
// caption or person tag. Zoom is capped so a capture is never enlarged more than about 15% past its
// native resolution, and never zoomed out past the screen's home view.
export function focus(screen, box, { fill = 0.62, band = [0, H], maxZoom } = {}) {
  const s = shots[screen];
  const b = boxOf(screen, box);
  const kMax = maxZoom ?? s.scale * 1.15;
  const [top, bottom] = band;
  const k = clamp(Math.min((fill * W) / b[2], (fill * (bottom - top)) / b[3]), Math.min(fitView(screen).k, kMax), kMax);
  return { cx: b[0] + b[2] / 2, cy: b[1] + b[3] / 2 + (H / 2 - (top + bottom) / 2) / k, k };
}
// The band content should sit in: below a person tag, above a caption.
const safeBand = spec => [spec.who ? 150 : 40, spec.caption ? H - 250 : H - 40];
const portrait = screen => shots[screen].H > shots[screen].W * 1.1;

// Layout box to frame rect for a camera, without drawing.
function mapper(c) {
  const x0 = W / 2 - c.cx * c.k, y0 = H / 2 - c.cy * c.k;
  return b => [x0 + b[0] * c.k, y0 + b[1] * c.k, b[2] * c.k, b[3] * c.k];
}

// The background colour inside a box: the most common of three samples near its edges.
function surfaceOf(screen, b) {
  const picks = [colorAt(screen, b[0] + 4, b[1] + b[3] / 2), colorAt(screen, b[0] + b[2] - 4, b[1] + b[3] / 2), colorAt(screen, b[0] + b[2] / 2, b[1] + b[3] - 4)];
  return picks.find((p, i) => picks.indexOf(p) !== i) || picks[0];
}
function luminance(color) {
  const [r, g, b] = rgb(color).split(',').map(v => Number(v) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Callouts: pick a side with room once (from the settled framing), then draw relative to the live box.
const CALLOUT = { size: 24, h: 46, gap: 16, edge: 36 };
function calloutWidth(text) {
  ctx.save();
  ctx.font = `600 ${CALLOUT.size}px ${TEXT}`;
  const w = ctx.measureText(text).width + 58;
  ctx.restore();
  return w;
}
function calloutSide(text, r, want = 'auto', avoidCaption = false) {
  const { h, gap, edge } = CALLOUT;
  const pw = calloutWidth(text);
  const floor = avoidCaption ? H - 260 : H - edge;
  const fits = {
    top: r[1] - h - gap > edge,
    bottom: r[1] + r[3] + h + gap < floor,
    right: r[0] + r[2] + 24 + pw < W - edge,
    left: r[0] - 24 - pw > edge,
  };
  if (want !== 'auto' && fits[want]) return want;
  return ['top', 'bottom', 'right', 'left'].find(s => fits[s]) || 'inside';
}
function callout(text, r, p, { color, fade = 1, side = 'top' }) {
  const { h, gap, edge } = CALLOUT;
  const pw = calloutWidth(text);
  let x, y, align;
  if (side === 'left' || side === 'right') {
    y = clamp(r[1] + r[3] / 2, edge + h / 2, H - edge - h / 2);
    align = side === 'right' ? 'left' : 'right';
    x = side === 'right' ? r[0] + r[2] + 24 : r[0] - 24;
  } else {
    y = side === 'top' ? r[1] - h / 2 - gap : side === 'bottom' ? r[1] + r[3] + h / 2 + gap : Math.max(edge + h / 2, r[1] + h / 2 + gap);
    const inset = side === 'inside' ? gap : 4;
    if (r[0] + r[2] / 2 < W / 2) {
      align = 'left';
      x = clamp(r[0] + inset, edge, W - edge - pw);
    } else {
      align = 'right';
      x = clamp(r[0] + r[2] - inset, edge + pw, W - edge);
    }
  }
  fx.pill(text, x, y, p, { color, align, fade });
}

// The brand's mark: its image if one was given, otherwise the glowing tile with an icon.
function brandMark(brand, x, y, size, p, draw) {
  if (p <= 0) return;
  if (brand.bitmap) {
    const bmp = brand.bitmap;
    const k = (size * E.outBack(clamp(p))) / Math.max(bmp.width, bmp.height);
    ctx.save();
    ctx.globalAlpha *= clamp(p * 2);
    ctx.shadowColor = `rgba(${rgb(C.accent)},0.55)`;
    ctx.shadowBlur = 40;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, x - (bmp.width * k) / 2, y - (bmp.height * k) / 2, bmp.width * k, bmp.height * k);
    ctx.restore();
    return;
  }
  fx.logoMark(x, y, size, p, { draw, icon: brand.icon || fx.STACK_ICON });
}
function lockupWidth(brand, size, markSize, gap) {
  ctx.save();
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.letterSpacing = `${size * 0.01}px`;
  const name = ctx.measureText(brand.name).width;
  ctx.restore();
  const mark = brand.icon === false && !brand.bitmap ? 0 : markSize + gap;
  return { total: mark + name, mark };
}

// Shared shape of every beat; body supplies content, draw, needs and optionally cues, blur and marks.
function beat(kind, spec, body) {
  let caption = null;
  if (spec.caption) caption = typeof spec.caption === 'string' ? [spec.caption, null] : [spec.caption[0], spec.caption[1] ?? null];
  const texts = [...(body.texts || [])];
  if (caption) {
    texts.push({ what: 'caption', text: plain(caption[0]), max: 44 });
    if (caption[1]) texts.push({ what: 'caption subtitle', text: caption[1], max: 90 });
  }
  return {
    kind,
    label: spec.label || body.label || kind,
    screen: body.screen || null,
    content: body.content,
    enter: spec.enter,
    energy: spec.energy,
    hit: spec.hit !== undefined ? spec.hit : body.hit,
    hitAt: body.hitAt || 0,
    who: spec.who || null,
    needs: { screens: [], boxes: [], textures: [], ...body.needs },
    texts,
    draw(c, info) {
      body.draw(c, info);
      if (caption) fx.caption(c, spec.captionAt ?? 0.15, body.content - 0.05, caption[0], caption[1], { ...body.captionStyle, ...spec.captionStyle });
    },
    cues: body.cues || (() => ({})),
    blur: body.blur || (() => []),
    marks: body.marks || (() => [body.content / 2]),
  };
}
const boxNeeds = (screen, keys) => keys.filter(k => k != null && !isRect(k)).map(k => [screen, k]);

// ------------------------------------------------------------------ type beats
// Big kinetic title on the stage, or over a blurred screen that sharpens as the title leaves.
// { lines: ['Line one.', ['Line', { text: 'two.', serif: true, accent: true }]], sub, size: 124,
//   over: 'screen', sweep: true, sparkle: false, dur }
export function title(spec) {
  const { lines, sub = null, size = 124, over = null, sweep = true, sparkle = false } = spec;
  const L = lines.map(l => toParts(l));
  const n = L.length;
  const landed = 0.25 + n * 0.55 + 0.35;
  const content = spec.dur ?? landed + 1.0 + (sub ? 0.35 : 0) + (over ? 0.5 : 0);
  return beat('title', spec, {
    label: `title "${plain(lines[0])}"`,
    screen: over,
    content,
    needs: { screens: over ? [over] : [] },
    texts: lines.map(l => ({ what: 'title line', text: plain(l), max: Math.round((28 * 124) / size) })),
    draw(c) {
      const lineH = size * 1.2;
      const top = H / 2 - ((n - 1) * lineH) / 2 + size * 0.35 - (sub ? 34 : 0);
      let fade = 1;
      if (over) {
        const clear = E.inOutQuint(seg(c, content - 0.6, content));
        shot(over, fitView(over), { blur: 22 * (1 - clear), bright: lerp(0.3, 1, clear) });
        fade = 1 - E.in(seg(c, content - 0.75, content - 0.35));
        // A soft shade behind the words keeps them readable over light screens.
        const shade = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 900);
        shade.addColorStop(0, `rgba(2,5,10,${0.62 * fade})`);
        shade.addColorStop(1, 'rgba(2,5,10,0)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, W, H);
      }
      L.forEach((parts, i) => {
        const width = fx.words(c - 0.25 - i * 0.55, parts, W / 2, top + i * lineH, { size, align: 'center', stagger: 0.12, dur: 0.75, weight: 700, fade });
        if (sparkle && i === 0) fx.sparkle(W / 2 - width / 2 - size * 0.4, top - size * 0.55, size * 0.32 * E.outBack(seg(c, 0.2, 0.7)), c);
      });
      const base = top + (n - 1) * lineH;
      if (sweep) fx.lightSweep(E.inOutExpo(seg(c, landed, landed + 0.8)), base + size * 0.42, { fade });
      if (sub) fx.line(c - landed + 0.1, sub, W / 2, base + size * 0.42 + 64, { size: 34, align: 'center', color: '#A5B4CB', fade });
    },
    marks: () => [landed + 0.5],
  });
}

// Three or so short lines that land one after another, over the stage or a blurred screen.
// { lines: ['Clear data.', 'Fast answers.', 'Better decisions.'], over: 'screen', size: 76, dur }
export function statement(spec) {
  const { lines, over = null, size = 76 } = spec;
  // Palette names resolve when drawn, after the film's theme is applied.
  const palette = ['ink', 'accent', 'accent3'];
  const L = lines.map((l, i) => toParts(l, palette[i % 3]));
  const content = spec.dur ?? 1.5 + 0.3 * L.length;
  return beat('statement', spec, {
    label: `statement "${plain(lines[0])}"`,
    content,
    needs: { screens: over ? [over] : [] },
    texts: lines.map(l => ({ what: 'statement line', text: plain(l), max: 40 })),
    draw(c) {
      if (over) shot(over, fitView(over), { blur: 14, bright: 0.3 });
      const gap = size * 1.18;
      const top = H / 2 - ((L.length - 1) * gap) / 2 + size * 0.35;
      L.forEach((parts, i) => fx.words(c - 0.05 - i * 0.22, parts, W / 2, top + i * gap, { size, align: 'center', stagger: 0.05 }));
    },
    marks: () => [content - 0.4],
  });
}

// Logo lockup: brand mark, wordmark and tagline, with a bloom of light. { name, tagline, dur }
export function logo(spec = {}) {
  const content = spec.dur ?? 2.6;
  return beat('logo', spec, {
    label: 'logo',
    content,
    hit: 'riser',
    texts: spec.tagline ? [{ what: 'tagline', text: spec.tagline, max: 70 }] : [],
    draw(c, info) {
      const brand = { ...info.brand, ...(spec.name ? { name: spec.name } : {}) };
      fx.radialFlash(Math.max(0, 1 - (c + 0.1) / 0.45));
      const size = 132, markSize = 150, gap = 44;
      const { total, mark } = lockupWidth(brand, size, markSize, gap);
      const left = W / 2 - total / 2;
      if (mark) brandMark(brand, left + markSize / 2, H / 2 - 30, markSize, seg(c, -0.1, 0.45), seg(c, 0.1, 1.2) * 1.5);
      if (brand.wordmark !== false) fx.wordmark(left + mark, H / 2 + 16, seg(c, 0.15, 1.0), { text: brand.name, size });
      const tagline = spec.tagline ?? brand.tagline;
      if (tagline) fx.line(c - 0.8, tagline, W / 2, H / 2 + 110, { size: 34, align: 'center', color: '#A5B4CB' });
    },
    marks: () => [1.6],
  });
}

// End card: mark, wordmark, a tagline that may use parts, the URL and a small closing line.
// { tagline, url, line, dur } (defaults come from the film's brand)
export function end(spec = {}) {
  const content = spec.dur ?? 3.8;
  return beat('end', spec, {
    label: 'end card',
    content,
    hit: 'impact',
    hitAt: 0.25,
    draw(c, info) {
      const brand = info.brand;
      const size = 110, markSize = 120, gap = 36;
      const { total, mark } = lockupWidth(brand, size, markSize, gap);
      const left = W / 2 - total / 2;
      const cy = H / 2 - 70;
      const glow = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, 700);
      glow.addColorStop(0, `rgba(${rgb(C.accent)},${0.18 * seg(c, 0.2, 1.4)})`);
      glow.addColorStop(1, `rgba(${rgb(C.accent)},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      if (mark) brandMark(brand, left + markSize / 2, cy, markSize, seg(c, 0.2, 0.9), seg(c, 0.35, 1.4) * 1.5);
      if (brand.wordmark !== false) fx.wordmark(left + mark, cy + 38, seg(c, 0.45, 1.2), { text: brand.name, size });
      const tagline = spec.tagline ?? brand.tagline;
      if (tagline) fx.words(c - 1.05, toParts(tagline), W / 2, cy + 150, { size: 50, align: 'center', stagger: 0.05, weight: 600 });
      const url = spec.url ?? brand.url;
      if (url) fx.line(c - 1.7, url, W / 2, cy + 232, { size: 34, align: 'center', color: C.accent, weight: 600 });
      const closing = spec.line ?? brand.line;
      if (closing) fx.line(c - 2.1, closing, W / 2, H - 90, { size: 24, align: 'center', color: '#7C8BA3' });
    },
    marks: () => [content - 1.2],
  });
}

// ------------------------------------------------------------------ screen beats
// A screen rises in perspective and settles into its home view, under an optional headline.
// { screen, headline: 'Words' or parts, dur }
export function rise(spec) {
  const { screen, headline = null } = spec;
  const content = spec.dur ?? 2.9;
  return beat('rise', spec, {
    label: `rise ${screen}`,
    screen,
    content,
    needs: { screens: [screen], textures: [screen] },
    texts: headline ? [{ what: 'headline', text: plain(headline), max: 60 }] : [],
    draw(c) {
      const v = fitView(screen);
      const [rw, rh] = textureSize[screen];
      const r = seg(c, -0.3, 2.1);
      const p = E.outQuint(r);
      const settle = seg(c, 2.0, 2.35);
      if (settle < 1) {
        const m = model({ x: 0, y: lerp(-1150, 0, p), z: lerp(-900, 0, p), rx: lerp(-1.02, 0, p), s: 1 });
        drawCards(glCamera([0, 0, DIST]), [{ texture: screen, matrix: m, w: rw * v.k, h: rh * v.k, radius: (shots[screen].radius ?? 14) * v.k, alpha: clamp(r * 3), shadowBlur: 70 }]);
      }
      if (settle > 0) shot(screen, v, { alpha: E.inOut(settle) });
      if (headline) {
        const fade = (1 - E.in(seg(c, content - 0.35, content))) * seg(c, 0.3, 0.6);
        const g = ctx.createLinearGradient(0, 0, 0, 170);
        g.addColorStop(0, `rgba(2,5,10,${0.85 * fade})`);
        g.addColorStop(1, 'rgba(2,5,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, 170);
        fx.words(c - 0.35, toParts(headline), W / 2, 70, { size: 40, align: 'center', stagger: 0.05, weight: 600, fade: 1 - E.in(seg(c, content - 0.35, content)) });
      }
    },
    cues: () => ({ whooshes: [[-0.1, 0.9, true]] }),
    marks: () => [1.0, content - 0.2],
  });
}

// Guided tour of one screen: the camera moves from box to box and each stop is highlighted and
// labelled. With no steps it simply holds the screen (with a slow push) under its caption.
// { screen, steps: [{ box, say, color, look: 'outline' | 'spotlight' | 'none', fill: 0.62, hold: 1.5,
//   move: 0.8, side: 'auto' | 'top' | 'bottom' | 'left' | 'right', pad, radius, ripple: true,
//   reveal: 'wipe' | 'scan' | 'shimmer', arrow: { to, label, color, style: 'arc' | 'bracket' },
//   value: { label, from, to, badge, color } }], start: box, end: 'home' | { dive: box }, dur }
export function tour(spec) {
  const { screen, steps = [], start = null, end = null } = spec;
  const band = safeBand(spec);
  const plan = [];
  let t = 0.3;
  for (const raw of steps) {
    const st = { look: 'outline', fill: spec.fill ?? 0.62, hold: 1.5, move: 0.8, side: 'auto', ...(typeof raw === 'string' ? { box: raw } : raw) };
    if (st.say && st.hold < 1.2) st.hold = 1.2;
    plan.push({ ...st, t0: t, t1: t + st.move, t2: t + st.move + st.hold });
    t += st.move + st.hold;
  }
  let body = plan.length ? t + 0.3 : spec.dur ?? 2.6;
  if (plan.length && spec.dur > body) {
    plan[plan.length - 1].t2 += spec.dur - body;
    body = spec.dur;
  }
  const back = end === 'home' ? 0.9 : 0;
  const diveBox = end && end.dive;
  const diveStart = body + back;
  const content = diveStart + (diveBox ? 0.65 : 0);

  let keys = null, sides = null;
  function prepare() {
    const home = start ? focus(screen, start, { fill: 0.8, band }) : fitView(screen);
    keys = [at(0, home)];
    sides = [];
    let prev = home;
    for (const st of plan) {
      let target = st.box;
      if (st.arrow) target = union(boxOf(screen, st.box), boxOf(screen, st.arrow.to));
      const v = st.view === 'stay' ? prev : focus(screen, target, { fill: st.fill, band });
      if (st.t0 > keys[keys.length - 1].t + 1e-6) keys.push(at(st.t0, prev));
      keys.push(at(st.t1, v, E.inOutQuint));
      const drift = { ...v, k: v.k * 1.035 };
      keys.push(at(st.t2, drift, E.inOut));
      prev = drift;
      sides.push(st.say ? calloutSide(st.say, mapper(v)(boxOf(screen, st.box)), st.side, Boolean(spec.caption)) : null);
    }
    if (!plan.length) keys.push(at(body, { ...home, k: home.k * 1.04 }, E.inOut));
    if (back) keys.push(at(body + back, home, E.inOutQuint));
    if (diveBox) {
      const [x, y] = centre(boxOf(screen, diveBox));
      keys.push(at(content, { cx: x, cy: y, k: prev.k * 6 }, E.inExpo));
    }
  }

  return beat('tour', spec, {
    label: `tour ${screen}`,
    screen,
    content,
    needs: {
      screens: [screen],
      boxes: boxNeeds(screen, [start, diveBox, ...plan.flatMap(st => [st.box, st.arrow && st.arrow.to])]),
    },
    texts: plan.filter(st => st.say).map(st => ({ what: 'callout', text: st.say, max: 46 })),
    draw(c) {
      if (!keys) prepare();
      const d = diveBox ? seg(c, diveStart, content) : 0;
      const v = shot(screen, cam(c, keys), { alpha: 1 - E.in(d) * 0.9, blur: E.in(d) * 10, clampEdges: spec.clampEdges });
      plan.forEach((st, i) => {
        const r = v.map(boxOf(screen, st.box));
        const color = col(st.color);
        const appear = seg(c, st.t1 - st.move * 0.25, st.t1 + 0.15);
        const until = i === plan.length - 1 ? diveStart - 0.05 : st.t2 + 0.1;
        const fade = 1 - seg(c, until - 0.3, until);
        if (st.reveal === 'wipe') fx.wipeReveal(r, E.inOutQuint(seg(c, st.t1, st.t1 + 0.7)), { cover: surfaceOf(screen, boxOf(screen, st.box)) });
        if (appear <= 0 || fade <= 0) return;
        if (st.look === 'spotlight') fx.spotlight(r, E.out(appear) * fade * 0.85, st.pad ?? 10, st.radius ?? 12);
        if (st.look !== 'none') fx.outline(r, appear, color, { fade, pad: st.pad ?? 8, radius: st.radius ?? 12 });
        if (st.reveal === 'scan') fx.scanLine(r, seg(c, st.t1 + 0.2, st.t2 - 0.1), { rgb: rgb(color) });
        if (st.reveal === 'shimmer' && c < st.t2) {
          ctx.save();
          ctx.globalAlpha *= fade;
          fx.shimmer(r, c);
          ctx.restore();
        }
        if (st.ripple) {
          const [x, y] = centre(r);
          fx.ripple(x, y, seg(c, st.t1 + 0.1, st.t1 + 0.65), color);
        }
        if (st.arrow) {
          const r2 = v.map(boxOf(screen, st.arrow.to));
          const ac = col(st.arrow.color || st.color);
          const p = seg(c, st.t1 + 0.25, st.t1 + 0.85);
          ctx.save();
          ctx.globalAlpha *= fade;
          if (st.arrow.style === 'bracket') fx.bracketArrow([r[0] + r[2] + 12, r[1] + r[3] / 2], [r2[0] + r2[2] + 16, r2[1] + r2[3] / 2], p, { color: ac });
          else fx.arrow([r[0] + r[2] / 2, r[1]], [r2[0] + r2[2] / 2, r2[1]], p, ac, st.arrow.label || null);
          ctx.restore();
          fx.outline(r2, seg(c, st.t1 + 0.7, st.t1 + 1.0), ac, { fade, pad: 6 });
        }
        if (st.value) {
          const val = st.value;
          fx.swapCard(c, {
            box: val.at || [W - 590, 150, 470, 160], label: val.label || '', from: val.from, to: val.to,
            appearAt: [st.t1, st.t1 + 0.35], swapAt: [st.t1 + 0.45, st.t1 + 0.9], badge: val.badge || null,
            badgeAt: [st.t1 + 0.85, st.t1 + 1.15], color: col(val.color || 'red'), fade,
          });
        }
        if (st.say) callout(st.say, r, seg(c, st.t1, st.t1 + 0.4), { color, fade, side: sides[i] });
      });
    },
    cues: () => ({
      blips: plan.flatMap(st => [st.t1 - 0.05, ...(st.value ? [st.t1 + 0.85] : [])]),
      whooshes: diveBox ? [[diveStart - 0.1, 0.75, true]] : [],
    }),
    blur: () => (diveBox ? [[diveStart, content, 6]] : []),
    marks: () => (plan.length ? plan.map(st => st.t1 + 0.5) : [body / 2]),
  });
}

// Typing into a field, then optionally clicking a send button and showing the screen that follows.
// { screen, field, text, send: box, after: 'screen', typed: 'screen with the text already in it',
//   cps: 24, size, color, fill: 0.8, dur }
export function type(spec) {
  const { screen, field, text, send = null, after = null, typed = null, cps = 24 } = spec;
  const tType = [0.85, 0.85 + clamp(text.length / cps, 0.8, 4.5)];
  const tClick = send ? tType[1] + 0.75 : null;
  const tAfter = after ? (tClick ?? tType[1]) + 0.25 : null;
  const content = spec.dur ?? (tAfter ?? tClick ?? tType[1]) + (after ? 1.4 : 0.8);
  let keys = null, F = null, look = null;
  function prepare() {
    F = boxOf(screen, field);
    const band = safeBand(spec);
    const whole = portrait(screen);
    // Open on the home view, push in to the field while typing, then widen to show the send button.
    const fieldView = whole ? fitView(screen) : focus(screen, pad(F, 16), { fill: spec.fill ?? 0.62, band });
    const sendView = send && !whole ? focus(screen, pad(union(F, boxOf(screen, send)), 24), { fill: 0.8, band }) : fieldView;
    keys = [at(0, fitView(screen)), at(0.75, fieldView, E.inOutQuint), at(tType[1] + 0.05, { ...fieldView, k: fieldView.k * 1.02 }, E.inOut)];
    if (send) keys.push(at(tClick - 0.15, sendView, E.inOutQuint));
    keys.push(at(content, { ...sendView, k: sendView.k * 1.02 }, E.inOut));
    const bg = surfaceOf(screen, F);
    look = { bg, ink: spec.color || (luminance(bg) > 0.55 ? '#0F172A' : '#F1F5F9'), size: spec.size || clamp(F[3] * 0.42, 12, 18) };
  }
  return beat('type', spec, {
    label: `type on ${screen}`,
    screen,
    content,
    needs: { screens: [screen, after, typed].filter(Boolean), boxes: boxNeeds(screen, [field, send]) },
    draw(c) {
      if (!keys) prepare();
      const camera = cam(c, keys);
      const swapped = typed && c >= tType[1] + 0.05;
      const v = shot(swapped ? typed : screen, camera);
      if (!swapped && c >= tType[0]) typeInto(v, F, text, fx.typedCount(c, tType, text), { ...look, t: c });
      if (after && c >= tAfter) shot(after, camera, { alpha: E.out(seg(c, tAfter, tAfter + 0.3)) });
      if (send) {
        const s = v.map(boxOf(screen, send));
        const [sx, sy] = centre(s);
        const rest = [W * 0.8, H * 0.93];
        fx.outline(s, seg(c, tClick - 0.02, tClick + 0.15), C.accent, { pad: 4, radius: 10, fade: 1 - seg(c, tClick + 0.3, tClick + 0.5) });
        fx.pointer(c, [[0.5, W * 0.74, H * 1.04], [1.0, ...rest], [tType[1] + 0.1, ...rest], [tClick - 0.05, sx, sy]], [tClick], seg(c, 0.5, 0.8) * (1 - seg(c, tClick + 0.35, tClick + 0.5)));
        if (after) fx.flashAt(c, tClick + 0.02, tClick + 0.3);
      }
    },
    cues: () => ({ typing: fx.typingTimes(tType, text), clicks: send ? [tClick] : [], blips: after ? [tAfter + 0.05] : [] }),
    marks: () => [(tType[0] + tType[1]) / 2, after ? tAfter + 0.6 : content - 0.3],
  });
}

// Draw typed text into field box F (layout px) through view v, erasing its placeholder first.
function typeInto(v, F, text, count, { bg, ink, size, t }) {
  const [x, y, w, h] = v.map(F);
  const k = v.k;
  const inset = Math.min(14, F[3] * 0.32) * k;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3 * k, y + 3 * k, w - 6 * k, h - 6 * k);
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.font = `400 ${size * k}px ${APP}`;
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  const shown = text.slice(0, Math.floor(count));
  let cx, cy;
  if (F[3] >= size * 2.8) {
    const lineH = size * 1.45 * k;
    const lines = wrap(shown, w - inset * 2);
    const top = y + inset + lineH / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, x + inset, top + i * lineH));
    cx = x + inset + ctx.measureText(lines[lines.length - 1] || '').width + 1.5 * k;
    cy = top + (lines.length - 1) * lineH;
  } else {
    const width = ctx.measureText(shown).width;
    const scroll = Math.max(0, width - (w - inset * 2 - 4 * k));
    cy = y + h / 2;
    ctx.fillText(shown, x + inset - scroll, cy);
    cx = x + inset + width - scroll + 1.5 * k;
  }
  if (count < text.length || Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(cx, cy - size * 0.62 * k, 1.6 * k, size * 1.24 * k);
  }
  ctx.restore();
}
function wrap(text, width) {
  const lines = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > width) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  lines.push(current);
  return lines;
}

// The pointer clicks through targets on a screen, optionally revealing the screen that follows.
// { screen, targets: ['box', { box, say, color, side }], after: 'screen', view: 'targets' | 'home',
//   fill: 0.75, dur }
export function click(spec) {
  const { screen, after = null } = spec;
  const targets = spec.targets.map(tg => (typeof tg === 'string' || isRect(tg) ? { box: tg } : tg));
  let t = 0.75;
  const times = targets.map((tg, i) => {
    const arrive = t + (i === 0 ? 0.7 : 0.6);
    const press = arrive + 0.08;
    t = press + 0.45 + (tg.say ? 0.55 : 0);
    return { arrive, press, leave: t };
  });
  const last = times[times.length - 1].press;
  const tAfter = after ? last + 0.3 : null;
  const content = spec.dur ?? (after ? tAfter + 1.3 : t + 0.35);
  let keys = null, sides = null;
  function prepare() {
    const region = targets.map(tg => boxOf(screen, tg.box)).reduce(union);
    // Phones are shown whole; on wider screens the camera frames the targets.
    const view = spec.view || (portrait(screen) ? 'home' : 'targets');
    const home = view === 'home' ? fitView(screen) : focus(screen, pad(region, 40), { fill: spec.fill ?? 0.75, band: safeBand(spec) });
    keys = [at(0, fitView(screen)), at(0.75, home, E.inOutQuint), at(content, { ...home, k: home.k * 1.03 }, E.inOut)];
    sides = targets.map(tg => (tg.say ? calloutSide(tg.say, mapper(home)(boxOf(screen, tg.box)), tg.side || 'auto', Boolean(spec.caption)) : null));
  }
  return beat('click', spec, {
    label: `click on ${screen}`,
    screen,
    content,
    needs: { screens: [screen, after].filter(Boolean), boxes: boxNeeds(screen, targets.map(tg => tg.box)) },
    texts: targets.filter(tg => tg.say).map(tg => ({ what: 'callout', text: tg.say, max: 46 })),
    draw(c) {
      if (!keys) prepare();
      const camera = cam(c, keys);
      const v = shot(screen, camera);
      if (after && c >= tAfter) shot(after, camera, { alpha: E.out(seg(c, tAfter, tAfter + 0.3)) });
      const path = [[0.55, W * 0.74, H * 1.04]];
      targets.forEach((tg, i) => {
        const r = v.map(boxOf(screen, tg.box));
        const [x, y] = centre(r);
        const { arrive, press, leave } = times[i];
        path.push([arrive, x, y], [leave - 0.05, x, y]);
        const color = col(tg.color);
        const fade = 1 - seg(c, press + 0.7, press + 1.0 + (tg.say ? 0.4 : 0));
        fx.outline(r, seg(c, press - 0.05, press + 0.2), color, { pad: 5, radius: 10, fade });
        if (tg.say) callout(tg.say, r, seg(c, press, press + 0.35), { color, fade, side: sides[i] });
      });
      fx.pointer(c, path, times.map(x => x.press), seg(c, 0.55, 0.8) * (1 - seg(c, last + 0.5, last + 0.7)));
      if (after) fx.flashAt(c, last + 0.02, last + 0.3);
    },
    cues: () => ({ clicks: times.map(x => x.press), blips: after ? [tAfter + 0.05] : [] }),
    marks: () => [...times.map(x => x.press + 0.25), ...(after ? [tAfter + 0.6] : [])],
  });
}

// A side panel slides in over the page it opened from; then boxes on the panel are highlighted.
// panel is a screen of the same page with the drawer open; region is the drawer's box on it (default:
// the panel's box "drawer", else its right 30%). { screen, panel, region, steps: [{ box, say, color }],
// backdrop, dur }
export function drawer(spec) {
  const { screen, panel, region = null, steps = [], backdrop = 'rgba(0,5,15,0.6)' } = spec;
  const tSlide = [0.45, 1.1], tZoom = [1.1, 1.75];
  const plan = steps.map((raw, i) => ({ side: 'left', ...(typeof raw === 'string' ? { box: raw } : raw), t: 1.85 + i * 0.95 }));
  const content = spec.dur ?? 1.85 + plan.length * 0.95 + 0.7;
  let R = null, keys = null;
  function prepare() {
    const s = shots[panel];
    R = region ? boxOf(panel, region) : s.boxes.drawer || [s.W * 0.7, 0, s.W * 0.3, s.H];
    const home = fitView(screen);
    // Then move closer: the screen's right edge on the frame's right edge, centred on the highlighted fields.
    const k = clamp(spec.zoom ?? home.k * 1.45, home.k, s.scale * 1.15);
    const focusBox = plan.length ? plan.map(st => boxOf(panel, st.box)).reduce(union) : R;
    const near = { cx: s.W - W / 2 / k, cy: clamp(focusBox[1] + focusBox[3] / 2, H / 2 / k, Math.max(H / 2 / k, s.H - H / 2 / k)), k };
    keys = [at(0, home), at(tZoom[0], home), at(tZoom[1], near, E.inOutQuint), at(content, { ...near, cx: s.W - W / 2 / (k * 1.02), k: k * 1.02 }, E.inOut)];
  }
  return beat('drawer', spec, {
    label: `drawer ${panel}`,
    screen,
    content,
    captionStyle: { scrimW: 1100 },
    needs: { screens: [screen, panel], boxes: [...boxNeeds(panel, [region]), ...boxNeeds(panel, plan.map(st => st.box))] },
    texts: plan.filter(st => st.say).map(st => ({ what: 'callout', text: st.say, max: 40 })),
    draw(c) {
      if (!keys) prepare();
      const camera = cam(c, keys);
      const p = seg(c, tSlide[0], tSlide[1]);
      const v = p < 1 ? fx.drawerIn(screen, panel, camera, p, { box: R, backdrop }).v : shot(panel, camera);
      plan.forEach((st, i) => {
        const r = v.map(boxOf(panel, st.box));
        const color = col(st.color);
        const until = i === plan.length - 1 ? content - 0.05 : plan[i + 1].t + 0.3;
        const fade = 1 - seg(c, until - 0.3, until);
        fx.outline(r, seg(c, st.t, st.t + 0.3), color, { pad: 5, radius: 10, fade });
        if (st.say) callout(st.say, r, seg(c, st.t + 0.05, st.t + 0.4), { color, fade, side: st.side });
      });
    },
    cues: () => ({ whooshes: [[tSlide[0] - 0.05, 0.5, false]], blips: plan.map(st => st.t) }),
    blur: () => [[tSlide[0], tSlide[1], 5]],
    marks: () => [tSlide[1] + 0.1, ...plan.map(st => st.t + 0.45)],
  });
}

// ------------------------------------------------------------------ montage beats
// Several screens as labelled tiles under a title.
// { title: lines, sub, tiles: [{ screen, label, sub, color, ring: box }], cols, dur }
export function grid(spec) {
  const { tiles, title: lines = null, sub = null } = spec;
  const n = tiles.length;
  const cols = spec.cols ?? (n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4);
  const rows = Math.ceil(n / cols);
  const content = spec.dur ?? 3.4;
  const gap = 36, labelH = 52, top = lines ? 292 : 150;
  const tw = Math.min(520, (W - 240 - (cols - 1) * gap) / cols, ((H - top - 60 - (rows - 1) * gap) / rows - labelH) * (16 / 9));
  const th = (tw * 9) / 16;
  const x0 = (W - (tw * cols + gap * (cols - 1))) / 2;
  return beat('grid', spec, {
    label: 'grid',
    content,
    needs: { screens: tiles.map(tl => tl.screen), boxes: tiles.flatMap(tl => boxNeeds(tl.screen, [tl.ring])) },
    texts: lines ? [{ what: 'grid title', text: plain(lines), max: 40 }] : [],
    draw(c) {
      if (lines) fx.words(c + 0.1, toParts(lines), W / 2, 150, { size: 72, align: 'center', stagger: 0.06 });
      if (sub) fx.line(c - 0.25, sub, W / 2, 214, { size: 28, align: 'center' });
      tiles.forEach((tile, i) => {
        const p = E.outQuint(seg(c, 0.05 + i * 0.09, 0.65 + i * 0.09));
        if (p <= 0) return;
        const tx = x0 + (i % cols) * (tw + gap), ty = top + Math.floor(i / cols) * (th + labelH + gap) + (1 - p) * 70;
        const v = fx.thumbnail(tile.screen, [tx, ty, tw, th], { alpha: p });
        const color = col(tile.color);
        if (tile.ring) fx.outline(v.map(boxOf(tile.screen, tile.ring)), seg(c, 0.8 + i * 0.12, 1.1 + i * 0.12), color, { pad: 3, radius: 8, width: 2 });
        ctx.save();
        ctx.globalAlpha *= p;
        ctx.textBaseline = 'alphabetic';
        ctx.font = `700 24px ${TEXT}`;
        ctx.fillStyle = color;
        ctx.fillText(tile.label || '', tx + 4, ty + th + 36);
        const lw = ctx.measureText(tile.label || '').width;
        if (tile.sub) {
          ctx.font = `450 22px ${TEXT}`;
          ctx.fillStyle = C.dim;
          ctx.fillText(`· ${tile.sub}`, tx + 4 + lw + 10, ty + th + 36);
        }
        ctx.restore();
      });
    },
    cues: () => ({ blips: tiles.map((tl, i) => (tl.ring ? 0.8 + i * 0.12 : null)).filter(x => x !== null) }),
    marks: () => [content - 0.4],
  });
}

// Pull back from one screen to reveal many as a floating 3D wall, with a headline.
// { screens: [...], focus: 'screen', title: lines, sub, cols: 4, dur }. 8 to 12 screens look best;
// repeating screens is fine.
export function wall(spec) {
  const { screens, title: lines = null, sub = null, cols = 4 } = spec;
  const centreName = spec.focus || screens[0];
  const content = spec.dur ?? 4.6;
  const rows = Math.ceil(screens.length / cols);
  return beat('wall', spec, {
    label: 'wall',
    content,
    hit: 'riser',
    needs: { screens: [...new Set(screens)], textures: [...new Set(screens)] },
    texts: lines ? lines.map(l => ({ what: 'wall title', text: plain(l), max: 30 })) : [],
    draw(c) {
      const p = E.inOutQuint(seg(c, -0.2, 3.4));
      const gapX = 2080, gapY = 1180;
      const centre = screens.indexOf(centreName);
      const cc = centre % cols, cr = Math.floor(centre / cols);
      const list = screens.map((name, i) => {
        const [rw, rh] = textureSize[name];
        const s = Math.min(1920 / rw, 1080 / rh);
        const gx = i % cols, gy = Math.floor(i / cols);
        const float = Math.sin(c * 1.3 + i * 1.7) * 40 * p;
        return {
          texture: name,
          matrix: model({ x: (gx - cc) * gapX, y: -(gy - cr) * gapY, z: (i === centre ? 0 : -60 * p) + float, s: 1 }),
          w: rw * s, h: rh * s, radius: (shots[name].radius ?? 14) * s, shadowBlur: 90, bright: i === centre ? 1 : lerp(1, 0.78, p),
        };
      });
      const dist = lerp(DIST, DIST * Math.max(2, 0.85 * cols), p);
      const yaw = lerp(0, -0.2, p), pitch = lerp(0, 0.3, p);
      const target = [lerp(0, ((cols - 1) / 2 - cc) * gapX, p), lerp(0, -((rows - 1) / 2 - cr) * gapY, p), 0];
      const eye = [target[0] + dist * Math.sin(yaw) * Math.cos(pitch), target[1] - dist * Math.sin(pitch), dist * Math.cos(yaw) * Math.cos(pitch)];
      drawCards(glCamera(eye, target, [0, 1, 0]), list);
      const tp = seg(c, 1.9, 2.4);
      if (lines && tp > 0) {
        const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 900);
        g.addColorStop(0, `rgba(2,5,10,${0.78 * E.out(tp)})`);
        g.addColorStop(1, 'rgba(2,5,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const gapY2 = 110, top = H / 2 - ((lines.length - 1) * gapY2) / 2 + 30;
        lines.forEach((l, i) => fx.words(c - 1.9 - i * 0.4, toParts(l, i ? 'accent' : 'ink'), W / 2, top + i * gapY2, { size: 96, align: 'center', stagger: 0.08 }));
        if (sub) fx.line(c - 2.9, sub, W / 2, top + (lines.length - 1) * gapY2 + 80, { size: 30, align: 'center' });
      }
    },
    blur: () => [[0, 2.5, 5]],
    marks: () => [1.0, content - 0.6],
  });
}

// ------------------------------------------------------------------ escape hatch
// Anything else: draw(c, info) with the low-level kit in core.js and effects.js.
// { dur, draw(c, info), screens: [...], textures: [...], cues: { blips: [c, ...] }, blur: [[c0, c1, n]],
//   marks: [c, ...] }. info: { content, inLen, outLen, brand, index }.
export function custom(spec) {
  return beat('custom', spec, {
    label: spec.label || 'custom',
    screen: spec.screen || null,
    content: spec.dur,
    needs: { screens: spec.screens || [], textures: spec.textures || [], boxes: spec.boxes || [] },
    draw: spec.draw,
    cues: () => spec.cues || {},
    blur: () => spec.blur || [],
    marks: () => spec.marks || [spec.dur / 2],
  });
}
