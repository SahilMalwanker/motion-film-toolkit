// Motion-design effects drawn over screens: highlights, callouts, kinetic type, cursor and typing,
// transitions and small set pieces. Every function draws into the shared frame context from core.js.
// Colours default to the theme (C.accent, C.accent2); pass any CSS colour to override.
import { ctx, W, H, C, SANS, TEXT, APP, SERIF, E, clamp, seg, rr, rrPath, shots, shot, colorOf, rgb as rgbOf } from './core.js';

// 'r,g,b' moved towards white by amount 0..1.
const mixWhite = (rgbText, amount) => rgbText.split(',').map(v => Math.round(Number(v) + (255 - Number(v)) * amount)).join(',');

// ------------------------------------------------------------------ attention
// Darken everything except a rounded window around rect.
export function spotlight(rect, amount, pad = 10, radius = 12) {
  if (amount <= 0) return;
  const [x, y, w, h] = [rect[0] - pad, rect[1] - pad, rect[2] + pad * 2, rect[3] + pad * 2];
  ctx.save();
  ctx.fillStyle = `rgba(2,5,10,${0.62 * amount})`;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  rrPath(ctx, x, y, w, h, radius);
  ctx.fill('evenodd');
  ctx.restore();
}

// A glowing rounded outline that draws itself around rect as p goes 0..1.
export function outline(rect, p, color = C.accent, { pad = 8, radius = 12, width = 2.5, fade = 1 } = {}) {
  if (p <= 0 || fade <= 0) return;
  const [x, y, w, h] = [rect[0] - pad, rect[1] - pad, rect[2] + pad * 2, rect[3] + pad * 2];
  const perimeter = 2 * (w + h);
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.globalAlpha = base * fade;
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.setLineDash([perimeter * E.out(clamp(p)), perimeter]);
  rr(ctx, x, y, w, h, radius);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = base * fade * 0.10 * E.out(clamp(p));
  ctx.fillStyle = color;
  rr(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();
}

// A callout label with a glowing dot that rises into place.
export function pill(text, x, y, p, { color = C.accent, align = 'left', size = 24, fade = 1 } = {}) {
  const a = E.out(clamp(p)) * fade * ctx.globalAlpha;
  if (a <= 0.001) return;
  ctx.save();
  ctx.font = `600 ${size}px ${TEXT}`;
  const tw = ctx.measureText(text).width;
  const hgt = size + 22, wid = tw + 58;
  const lx = align === 'right' ? x - wid : align === 'center' ? x - wid / 2 : x;
  const ly = y - hgt / 2 + (1 - E.out(clamp(p))) * 14;
  ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = 'rgba(9,14,26,0.92)';
  rr(ctx, lx, ly, wid, hgt, hgt / 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.globalAlpha = a * 0.7;
  rr(ctx, lx + 0.75, ly + 0.75, wid - 1.5, hgt - 1.5, hgt / 2);
  ctx.stroke();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(lx + 24, ly + hgt / 2, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + 40, ly + hgt / 2 + 1);
  ctx.restore();
}

// A dark gradient rising from the bottom so captions stay readable over busy screens.
export function scrim(amount, from = 0.5, width = W) {
  if (amount <= 0) return;
  const g = ctx.createLinearGradient(0, H * from, 0, H);
  g.addColorStop(0, 'rgba(2,5,10,0)');
  g.addColorStop(0.55, `rgba(2,5,10,${0.72 * amount})`);
  g.addColorStop(1, `rgba(2,5,10,${0.92 * amount})`);
  const base = ctx.globalAlpha;
  ctx.save();
  ctx.fillStyle = g;
  if (width >= W) {
    ctx.fillRect(0, H * from, W, H * (1 - from));
  } else {
    // Feather the right edge so a drawer on that side stays clear.
    const feather = 260, strips = 26;
    ctx.fillRect(0, H * from, width - feather, H * (1 - from));
    for (let i = 0; i < strips; i++) {
      ctx.globalAlpha = base * (1 - (i + 0.5) / strips);
      ctx.fillRect(width - feather + (i * feather) / strips, H * from, feather / strips + 0.5, H * (1 - from));
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ kinetic type
// Words rise, sharpen and settle one after another. parts: [{ text, color, serif, weight, font }].
export function words(t, parts, x, y, { size = 72, weight = 650, align = 'left', stagger = 0.07, dur = 0.55, tracking = -0.02, fade = 1 } = {}) {
  ctx.save();
  // A blur or fade set by the caller (a zoom-and-blur exit) still applies to every word.
  const base = ctx.filter;
  const alpha = ctx.globalAlpha;
  const items = [];
  let total = 0;
  for (const part of parts) {
    const font = part.serif ? `italic 400 ${size * 1.08}px ${SERIF}` : `${part.weight || weight} ${size}px ${part.font || SANS}`;
    ctx.font = font;
    ctx.letterSpacing = `${(part.serif ? -0.01 : tracking) * size}px`;
    for (const word of part.text.split(' ').filter(Boolean)) {
      const w = ctx.measureText(word).width;
      items.push({ word, font, color: (part.accent ? C.accent : colorOf(part.color)) || C.ink, w, tracking: part.serif ? -0.01 : tracking });
      total += w;
    }
  }
  const space = size * 0.26;
  total += space * (items.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  items.forEach((item, i) => {
    const p = clamp((t - i * stagger) / dur);
    const e = E.outQuint(p);
    if (e > 0) {
      ctx.font = item.font;
      ctx.letterSpacing = `${item.tracking * size}px`;
      ctx.globalAlpha = alpha * e * fade;
      ctx.fillStyle = item.color;
      ctx.textBaseline = 'alphabetic';
      if (p < 1) ctx.filter = `${base === 'none' ? '' : base + ' '}blur(${(1 - e) * 14}px)`;
      ctx.fillText(item.word, cx, y + (1 - e) * size * 0.55);
      ctx.filter = base;
    }
    cx += item.w + space;
  });
  ctx.restore();
  return total;
}

// A single line that fades up.
export function line(t, text, x, y, { size = 30, color = C.dim, weight = 450, align = 'left', dur = 0.7, fade = 1 } = {}) {
  const e = E.outQuint(clamp(t / dur));
  if (e <= 0) return;
  ctx.save();
  ctx.font = `${weight} ${size}px ${TEXT}`;
  ctx.textAlign = align;
  ctx.globalAlpha *= e * fade;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + (1 - e) * 16);
  ctx.restore();
}

// Lower-third caption between film times t0 and t1: scrim, local shade, kinetic title, subtitle and an
// accent bar. title may be a string or word parts as for words().
export function caption(t, t0, t1, title, sub, opt = {}) {
  const { x = 118, y = 928, size = 62, from = 0.52, scrimW = W } = opt;
  const fade = 1 - E.in(seg(t, t1 - 0.4, t1));
  const inP = seg(t, t0 - 0.2, t0 + 0.5);
  if (inP <= 0 || fade <= 0) return;
  scrim(E.out(inP) * fade, from, scrimW);
  const titleParts = Array.isArray(title) ? title : [{ text: title }];
  // A local shade behind the words keeps busy interface text from reading through them.
  ctx.save();
  ctx.font = `650 ${size}px ${SANS}`;
  const tw = Math.min(W - x, ctx.measureText(titleParts.map(p => p.text).join(' ')).width + 40);
  const rad = tw * 0.72;
  ctx.translate(x + tw / 2, y - size * 0.1 + (sub ? 20 : 0));
  ctx.scale(1, 0.26);
  const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
  shade.addColorStop(0, `rgba(2,5,10,${0.55 * E.out(inP) * fade})`);
  shade.addColorStop(0.6, `rgba(2,5,10,${0.35 * E.out(inP) * fade})`);
  shade.addColorStop(1, 'rgba(2,5,10,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
  ctx.restore();
  words(t - t0, titleParts, x, y, { size, fade });
  if (sub) line(t - t0 - 0.35, sub, x + 2, y + 56, { size: 28, fade });
  const bar = E.outExpo(seg(t, t0, t0 + 0.6)) * fade;
  ctx.save();
  const g = ctx.createLinearGradient(x, 0, x + 96, 0);
  g.addColorStop(0, C.accent);
  g.addColorStop(1, C.accent2);
  ctx.fillStyle = g;
  ctx.globalAlpha *= bar;
  rr(ctx, x + 2, y - size - 26, 96 * bar, 5, 2.5);
  ctx.fill();
  ctx.restore();
}

// A hairline of light that opens outward from the centre, as p goes 0..1.
export function lightSweep(p, y, { x = W / 2, half = 420, fade = 1 } = {}) {
  if (p <= 0 || fade <= 0) return;
  ctx.save();
  const g = ctx.createLinearGradient(x - half, 0, x + half, 0);
  const a = rgbOf(C.accent);
  g.addColorStop(0, `rgba(${a},0)`);
  g.addColorStop(0.5, `rgba(${rgbOf(C.accent2)},0.9)`);
  g.addColorStop(1, `rgba(${a},0)`);
  ctx.fillStyle = g;
  ctx.globalAlpha *= fade;
  ctx.fillRect(x - half * p, y, half * 2 * p, 2);
  ctx.restore();
}

// ------------------------------------------------------------------ cursor and typing
// Arrow cursor with a soft shadow; press squashes it slightly.
export function cursor(x, y, press = 0, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  const s = 1.55 * (1 - 0.12 * press);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 21); ctx.lineTo(5.2, 16.2); ctx.lineTo(8.9, 24.6); ctx.lineTo(12.4, 23.1); ctx.lineTo(8.8, 14.9); ctx.lineTo(15.6, 14.9); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#0B1220';
  ctx.stroke();
  ctx.restore();
}

// An expanding ring where something was clicked.
export function ripple(x, y, p, color = C.accent) {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.globalAlpha *= (1 - p) * 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(x, y, 10 + E.out(p) * 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Cursor path: [[t, x, y], ...] in screen px, moving on gentle arcs; clicks: [t, ...].
export function pointer(t, path, clicks = [], alpha = 1) {
  let x = path[0][1], y = path[0][2];
  for (let i = 1; i < path.length; i++) {
    const [t0, x0, y0] = path[i - 1], [t1, x1, y1] = path[i];
    if (t >= t0) {
      const p = E.inOut(seg(t, t0, t1));
      const arc = Math.sin(p * Math.PI) * Math.min(60, Math.hypot(x1 - x0, y1 - y0) * 0.12);
      x = x0 + (x1 - x0) * p;
      y = y0 + (y1 - y0) * p - arc;
    }
  }
  let press = 0;
  for (const c of clicks) {
    const d = t - c;
    if (d > -0.08 && d < 0.12) press = Math.max(press, 1 - Math.abs(d - 0.02) / 0.1);
    ripple(x + 2, y + 2, seg(t, c, c + 0.55));
  }
  cursor(x, y, clamp(press), alpha);
}

// Type text into a field on a screen, with a blinking caret; cover blanks the field first.
export function typing(view, box, text, count, { size = 14, color = '#F8FAFC', bg = 'rgb(17,24,39)', caret = true, t = 0, cover = true } = {}) {
  const [x, y, w, h] = view.map(box);
  const k = view.k;
  ctx.save();
  if (cover) { ctx.fillStyle = bg; ctx.fillRect(x + 3 * k, y + 3 * k, w - 6 * k, h - 6 * k); }
  ctx.font = `400 ${size * k}px ${APP}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const shown = text.slice(0, Math.floor(count));
  const tx = x + 8 * k, ty = y + 7 * k + 17 * k;
  ctx.fillText(shown, tx, ty);
  if (caret && (count < text.length || Math.floor(t * 2) % 2 === 0)) {
    const cx = tx + ctx.measureText(shown).width + 1.5 * k;
    ctx.fillStyle = C.accent;
    ctx.fillRect(cx, ty - 14 * k, 1.6 * k, 18 * k);
  }
  ctx.restore();
}

// Reveal a screen's real typed text progressively by masking what is not yet typed. The text must be
// drawn in the screen at textBox with `400 ${size}px` in the APP font for the mask to line up.
export function revealTyped(view, textBox, text, count, { size = 14, bg = 'rgb(17,24,39)', t = 0 } = {}) {
  const [x, y, w, h] = view.map(textBox);
  const k = view.k;
  ctx.save();
  ctx.font = `400 ${size}px ${APP}`;
  const typedWidth = ctx.measureText(text.slice(0, Math.floor(count))).width * k;
  ctx.fillStyle = bg;
  ctx.fillRect(x + typedWidth, y, w - typedWidth, h);
  if (count < text.length || Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(x + typedWidth + 1.5 * k, y + 2 * k, 1.6 * k, h - 4 * k);
  }
  ctx.restore();
}

// How many characters are typed at time t when typing runs from a to b.
export const typedCount = (t, [a, b], text) => clamp((t - a) / (b - a)) * text.length;
// Keystroke times for the soundtrack's typing cue, skipping most spaces.
export function typingTimes([a, b], text) {
  return Array.from({ length: text.length }, (_, i) => a + ((b - a) * i) / text.length).filter((_, i) => text[i] !== ' ' || i % 3 === 0);
}

// Blank a screen's text field that has not been typed yet; dx follows a sliding drawer.
export function maskText(view, box, dx = 0, bg = 'rgb(17,24,39)') {
  const [x, y, w, h] = view.map(box);
  ctx.fillStyle = bg;
  ctx.fillRect(x + dx, y, w, h);
}

// Redraw a screen's "n/max" character counter so it follows synthetic typing. x and baseline are the
// counter's left edge and text baseline in layout px. Give width to stretch the text to a captured
// counter drawn in a different font.
export function counterPatch(view, n, { x, baseline, max = 1000, hint = '', size = 12, width = 0, bg = 'rgb(17,24,39)', color = 'rgb(128,141,161)' }) {
  ctx.save();
  ctx.font = `400 ${size * view.k}px ${TEXT}`;
  const fit = width ? (width * view.k) / ctx.measureText(`0/${max}${hint}`).width : 1;
  ctx.font = `400 ${size * view.k * fit}px ${TEXT}`;
  const cover = ctx.measureText(`${max}/${max}${hint}`).width / view.k + 13;
  const [rx, ry, rw, rh] = view.map([x - 4, baseline - size - 3, cover, size + 8]);
  ctx.fillStyle = bg;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const [tx, ty] = view.pt(x, baseline);
  ctx.fillText(`${Math.floor(n)}/${max}${hint}`, tx, ty);
  ctx.restore();
}

// ------------------------------------------------------------------ loading, reveals and light
// A light band sweeping across rect, for "working on it" states.
export function shimmer(rect, t, color = `rgba(${mixWhite(rgbOf(C.accent), 0.35)},0.55)`) {
  const [x, y, w, h] = rect;
  const p = (t * 0.9) % 1;
  const cx = x - w * 0.3 + p * w * 1.6;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 6, y - 6, w + 12, h + 12);
  ctx.clip();
  const g = ctx.createLinearGradient(cx - 90, 0, cx + 90, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.restore();
}

// Reveal rect from the top down: w is the eased progress 0..1; below the line stays covered.
export function wipeReveal(rect, w, { cover = '#0B1220', glow = `rgba(${rgbOf(C.accent)},0.35)` } = {}) {
  if (w >= 1) return;
  ctx.save();
  ctx.fillStyle = cover;
  ctx.fillRect(rect[0] - 4, rect[1] + rect[3] * w, rect[2] + 8, rect[3] * (1 - w) + 4);
  if (glow) {
    const edge = rect[1] + rect[3] * w;
    const g = ctx.createLinearGradient(0, edge - 60, 0, edge);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, glow);
    ctx.fillStyle = g;
    ctx.fillRect(rect[0], edge - 60, rect[2], 60);
  }
  ctx.restore();
}

// A soft band of colour scanning down rect as p goes 0..1. rgb: 'r,g,b'.
export function scanLine(rect, p, { rgb = '248,113,113', band = 26, alpha = 0.28 } = {}) {
  if (p <= 0 || p >= 1) return;
  const y = rect[1] + rect[3] * E.inOut(p);
  ctx.save();
  const g = ctx.createLinearGradient(0, y - band, 0, y + band);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(0.5, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(rect[0] - 10, y - band, rect[2] + 20, band * 2);
  ctx.restore();
}

// A quick full-frame pulse of light between film times a and b, for confirmations.
export function flashAt(t, a, b, rgb = rgbOf(C.accent)) {
  const p = seg(t, a, b);
  if (p <= 0 || p >= 1) return;
  ctx.fillStyle = `rgba(${rgb},${0.2 * Math.sin(p * Math.PI)})`;
  ctx.fillRect(0, 0, W, H);
}

// A flat tint over the frame; amount 0..1.
export function tint(amount, rgb = rgbOf(C.accent), strength = 0.18) {
  if (amount <= 0) return;
  ctx.fillStyle = `rgba(${rgb},${strength * amount})`;
  ctx.fillRect(0, 0, W, H);
}

// A radial bloom of light, for logo hits.
export function radialFlash(amount, { x = W / 2, y = H / 2, r = 900, rgb = rgbOf(C.accent), strength = 0.45 } = {}) {
  if (amount <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${strength * amount})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Draw inside a zoom (and optional blur) about a point, e.g. to push a title towards the viewer as it leaves.
export function withZoom(scale, blur, draw, x = W / 2, y = H / 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);
  if (blur > 0.2) ctx.filter = `blur(${blur}px)`;
  draw();
  ctx.restore();
}

// ------------------------------------------------------------------ connectors
// A curved arrow that draws from `from` to `to`, with an optional label at its peak.
export function arrow(from, to, p, color = C.amber, label = null) {
  if (p <= 0) return;
  const [x0, y0] = from, [x1, y1] = to;
  const e = E.outQuint(clamp(p));
  const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 60;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  const steps = 40;
  let px = x0, py = y0;
  ctx.moveTo(x0, y0);
  for (let i = 1; i <= steps * e; i++) {
    const s = i / steps;
    px = (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * mx + s * s * x1;
    py = (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * my + s * s * y1;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  if (e > 0.95) {
    const s = 0.97;
    const bx = (1 - s) * (1 - s) * x0 + 2 * (1 - s) * s * mx + s * s * x1;
    const by = (1 - s) * (1 - s) * y0 + 2 * (1 - s) * s * my + s * s * y1;
    const ang = Math.atan2(y1 - by, x1 - bx);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 16 * Math.cos(ang - 0.45), y1 - 16 * Math.sin(ang - 0.45));
    ctx.lineTo(x1 - 16 * Math.cos(ang + 0.45), y1 - 16 * Math.sin(ang + 0.45));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
  if (label) pill(label, mx, my - 30, seg(p, 0.5, 1), { color, align: 'center' });
}

// A bracket-shaped arrow bowing out to the right, linking two items stacked in a list.
export function bracketArrow(from, to, p, { color = C.accent, fade = 1, bulge = 90 } = {}) {
  if (p <= 0 || fade <= 0) return;
  const [x0, y0] = from, [x1, y1] = to;
  const qx = Math.max(x0, x1) + bulge, qy = (y0 + y1) / 2;
  const q = u => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * qx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * qy + u * u * y1];
  const e = E.outQuint(clamp(p));
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const [px, py] = q((e * i) / 40);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.stroke();
  if (e > 0.85) {
    const [ax, ay] = q(1), [bx, by] = q(0.9);
    const ang = Math.atan2(ay - by, ax - bx);
    ctx.globalAlpha *= seg(e, 0.85, 1);
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(ang) * 4, ay + Math.sin(ang) * 4);
    ctx.lineTo(ax - Math.cos(ang - 0.5) * 16, ay - Math.sin(ang - 0.5) * 16);
    ctx.lineTo(ax - Math.cos(ang + 0.5) * 16, ay - Math.sin(ang + 0.5) * 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ set pieces
// A card whose value rolls from `from` to `to`, e.g. a date or number that a change moves.
// box: [x, y, w, h] in screen px; appearAt, swapAt and badgeAt are [start, end] film times.
export function swapCard(t, { box, label, from, to, appearAt, swapAt, badge = null, badgeAt = null, color = C.red, fade = 1 }) {
  const [bx, by, bw, bh] = box;
  const appear = E.out(seg(t, appearAt[0], appearAt[1]));
  if (appear <= 0 || fade <= 0) return;
  const k = ctx.globalAlpha * fade;
  ctx.save();
  ctx.globalAlpha = k * appear;
  ctx.translate(0, (1 - appear) * 24);
  ctx.fillStyle = 'rgba(9,14,26,0.95)';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 40;
  rr(ctx, bx, by, bw, bh, 20);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = k * appear * 0.55;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  rr(ctx, bx, by, bw, bh, 20);
  ctx.stroke();
  ctx.globalAlpha = k * appear;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 22px ${SANS}`;
  ctx.fillStyle = C.dim;
  ctx.fillText(label, bx + 30, by + 46);
  const swap = E.inOutQuint(seg(t, swapAt[0], swapAt[1]));
  ctx.beginPath();
  ctx.rect(bx, by + 60, bw, bh - 64);
  ctx.clip();
  ctx.font = `650 54px ${SANS}`;
  ctx.globalAlpha = k * appear * (1 - swap);
  ctx.fillStyle = '#9AA8BD';
  ctx.fillText(from, bx + 30, by + 128 - swap * 70);
  ctx.globalAlpha = k * appear * swap;
  ctx.fillStyle = C.ink;
  ctx.fillText(to, bx + 30, by + 128 + (1 - swap) * 70);
  ctx.restore();
  if (badge && badgeAt) pill(badge, bx + bw - 26, by + 38, seg(t, badgeAt[0], badgeAt[1]), { color, align: 'right', fade });
}

// Who is acting: avatar initials, role and name, top left. spans: [[from, to, { role, name, initials, color }], ...]
export function personTag(t, spans) {
  for (const [a, b, who] of spans) {
    const inP = E.outQuint(seg(t, a, a + 0.4));
    const alpha = ctx.globalAlpha * inP * (1 - E.in(seg(t, b - 0.25, b)));
    if (alpha <= 0.001) continue;
    const x = 96, y = 60, h = 76;
    const roleText = who.role.toUpperCase();
    const tagColor = colorOf(who.color) || C.accent;
    ctx.save();
    ctx.font = `700 15px ${TEXT}`;
    ctx.letterSpacing = '2.4px';
    const rw = ctx.measureText(roleText).width;
    ctx.letterSpacing = '0px';
    ctx.font = `600 24px ${TEXT}`;
    const w = 76 + Math.max(rw, ctx.measureText(who.name).width) + 34;
    ctx.translate((1 - inP) * -30, 0);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(9,14,26,0.9)';
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = tagColor;
    ctx.lineWidth = 1.5;
    rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, h / 2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    const ax = x + 38, ay = y + h / 2;
    const g = ctx.createLinearGradient(ax - 26, ay - 26, ax + 26, ay + 26);
    g.addColorStop(0, tagColor);
    g.addColorStop(1, C.accent2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ax, ay, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#04070D';
    ctx.font = `700 19px ${TEXT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(who.initials, ax, ay + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = tagColor;
    ctx.font = `700 15px ${TEXT}`;
    ctx.letterSpacing = '2.4px';
    ctx.fillText(roleText, x + 76, y + 31);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = C.ink;
    ctx.font = `600 24px ${TEXT}`;
    ctx.fillText(who.name, x + 76, y + 60);
    ctx.restore();
  }
}

// A side drawer from a second screen slides in over the page it opened from, with the page dimmed.
// Once p reaches 1, cut to the drawer screen itself. Returns the page view and the drawer's offset.
export function drawerIn(baseName, drawerName, camera, p, { box = [1344, 0, 576, 1080], backdrop = 'rgba(0,5,15,0.67)' } = {}) {
  const e = E.outQuint(clamp(p));
  const v = shot(baseName, camera, { clampEdges: true });
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const [x, y, w, h] = v.map(box);
  const off = (1 - e) * (w + 60);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 50;
  ctx.imageSmoothingQuality = 'high';
  const q = shots[drawerName].scale;
  ctx.drawImage(shots[drawerName].bmp, box[0] * q, box[1] * q, box[2] * q, box[3] * q, x + off, y, w, h);
  ctx.restore();
  return { v, off };
}

// A screen as a card in rect [x, y, w, h], for grids of screens. Landscape screens show their top,
// cropped to the rect; portrait screens (phones) are shown whole, centred on the card. Returns a mapper
// like shot().
export function thumbnail(name, [x, y, w, h], { alpha = 1, radius = 11 } = {}) {
  const s = shots[name];
  const portrait = s.H > s.W * 1.1;
  const k = portrait ? Math.min((h * 0.92) / s.H, w / s.W) : w / s.W;
  const ox = portrait ? x + (w - s.W * k) / 2 : x;
  const oy = portrait ? y + (h - s.H * k) / 2 : y;
  const map = b => [ox + b[0] * k, oy + b[1] * k, b[2] * k, b[3] * k];
  const pt = (px, py) => [ox + px * k, oy + py * k];
  if (alpha <= 0.001) return { map, pt, k };
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#0B1220';
  rr(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  rr(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  if (portrait) {
    rr(ctx, ox, oy, s.W * k, s.H * k, (s.radius ?? 14) * k);
    ctx.clip();
    ctx.drawImage(s.bmp, 0, 0, s.W * s.scale, s.H * s.scale, ox, oy, s.W * k, s.H * k);
  } else {
    const visible = Math.min(s.H, h / k);
    ctx.drawImage(s.bmp, 0, 0, s.W * s.scale, visible * s.scale, x, y, w, visible * k);
  }
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(148,163,184,0.25)';
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
  ctx.stroke();
  ctx.restore();
  return { map, pt, k };
}

// ------------------------------------------------------------------ brand
// A generic stacked mark; replace with your own 24x24 SVG path data.
export const STACK_ICON = ['M12 3 21 8 12 13 3 8Z', 'M3 12 12 17 21 12', 'M3 16 12 21 21 16'];

// A rounded, glowing logo tile whose icon strokes draw in one after another.
export function logoMark(x, y, size, p, { draw = 1, glow = 1, icon = STACK_ICON } = {}) {
  if (p <= 0) return;
  const s = size * E.outBack(clamp(p));
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= clamp(p * 2);
  const accentRgb = rgbOf(C.accent);
  ctx.shadowColor = `rgba(${accentRgb},0.75)`;
  ctx.shadowBlur = 50 * glow;
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, `rgb(${mixWhite(accentRgb, 0.3)})`);
  g.addColorStop(1, C.accent);
  ctx.fillStyle = g;
  rr(ctx, -s / 2, -s / 2, s, s, s * 0.31);
  ctx.fill();
  ctx.shadowBlur = 0;
  const unit = s * 0.66 / 24;
  ctx.translate(-12 * unit, -12 * unit);
  ctx.scale(unit, unit);
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0B1220';
  icon.forEach((d, i) => {
    const q = clamp((draw - i * 0.22) / 0.5);
    if (q <= 0) return;
    ctx.setLineDash([70 * E.out(q), 80]);
    ctx.stroke(new Path2D(d));
  });
  ctx.restore();
}

// A wordmark whose letters slide in and sharpen one by one.
export function wordmark(x, y, p, { text = 'Product', size = 118, align = 'left' } = {}) {
  if (p <= 0) return;
  ctx.save();
  const base = ctx.filter;
  const alpha = ctx.globalAlpha;
  ctx.font = `700 ${size}px ${SANS}`;
  ctx.letterSpacing = `${size * 0.01}px`;
  const total = ctx.measureText(text).width;
  let cx = align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < text.length; i++) {
    const q = E.outQuint(clamp((p - i * 0.08) / 0.5));
    const ch = text[i];
    const w = ctx.measureText(ch).width + size * 0.01;
    ctx.globalAlpha = alpha * q;
    ctx.fillStyle = C.ink;
    if (q < 1) ctx.filter = `${base === 'none' ? '' : base + ' '}blur(${(1 - q) * 10}px)`;
    ctx.fillText(ch, cx + (1 - q) * 40, y);
    ctx.filter = base;
    cx += w;
  }
  ctx.restore();
  return total;
}

// A four-point sparkle with a small companion, gently rocking.
export function sparkle(x, y, r, t) {
  if (r <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2) * 0.1);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, `rgb(${mixWhite(rgbOf(C.accent), 0.35)})`);
  g.addColorStop(1, C.accent2);
  ctx.fillStyle = g;
  ctx.shadowColor = `rgba(${rgbOf(C.accent2)},0.8)`;
  ctx.shadowBlur = 30;
  const star = (cx, cy, s) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.quadraticCurveTo(cx, cy, cx + s, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + s);
    ctx.quadraticCurveTo(cx, cy, cx - s, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - s);
    ctx.fill();
  };
  star(0, 0, r);
  star(r * 0.95, -r * 0.8, r * 0.38);
  ctx.restore();
}
