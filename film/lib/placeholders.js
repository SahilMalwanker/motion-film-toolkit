// Placeholder screens drawn from a list of blocks, for animatics before real screens exist and for the
// demo film. Every block with a key becomes a named box; some blocks add sub-boxes such as
// "list-item2" or "table-row3". Write the storyboard against these names, then replace the placeholder
// with a real capture that uses the same box names and the storyboard keeps working.
//
//   placeholder({ name: 'home', width: 1920, height: 1080, theme: 'dark', accent: '#6366F1', blocks: [
//     { kind: 'nav', key: 'nav', box: [0, 0, 240, 1080], title: 'Acme', items: ['Home', 'Reports'] },
//     { kind: 'stat', key: 'revenue', box: [280, 120, 300, 140], title: 'Revenue', value: '$84k', delta: '+12%' },
//   ] })
//
// Kinds: nav, topbar, card, stat, chart, bars, table, list, input, button, text, paragraph, image, chip,
// progress, tabs, toast, drawer, scrim. Boxes are [x, y, w, h] in layout px.
import { rrPath, APP } from './core.js';

const THEMES = {
  dark: { page: '#0B1120', side: '#0D1426', panel: '#111A2E', raised: '#18233A', border: '#22304A', text: '#E6EAF2', muted: '#8A97AD', faint: '#26324A', field: '#0E1627', onAccent: '#FFFFFF' },
  light: { page: '#F4F6FA', side: '#FFFFFF', panel: '#FFFFFF', raised: '#EEF2F7', border: '#E2E8F0', text: '#0F172A', muted: '#64748B', faint: '#E5EAF1', field: '#FFFFFF', onAccent: '#FFFFFF' },
};
const TONES = { red: '#EF4444', amber: '#F59E0B', green: '#10B981', blue: '#3B82F6', indigo: '#6366F1', teal: '#14B8A6', pink: '#EC4899', slate: '#64748B' };
const tone = name => TONES[name] || name || TONES.slate;

// A placeholder screen generator for setup(): { name, draw }.
// theme: 'dark' | 'light' | an object overriding any palette colour above. scale: image px per layout px.
export function placeholder({ name, width = 1920, height = 1080, theme = 'dark', accent = '#6366F1', radius, scale = 2, blocks = [] }) {
  return { name, draw: () => paint({ name, width, height, theme, accent, radius, scale, blocks }) };
}

function paint({ name, width, height, theme, accent, radius, scale, blocks }) {
  const base = typeof theme === 'string' ? THEMES[theme] || THEMES.dark : { ...THEMES.dark, ...theme };
  const P = { ...base, accent };
  const canvas = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale));
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = P.page;
  g.fillRect(0, 0, width, height);
  const boxes = {};
  const S = { width, height, rand: random(hash(name)) };
  for (const block of blocks) {
    const painter = PAINT[block.kind];
    if (!painter) throw new Error(`placeholder "${name}": unknown block kind "${block.kind}"`);
    if (!block.box && block.kind !== 'scrim') throw new Error(`placeholder "${name}": a ${block.kind} block needs box: [x, y, w, h]`);
    const sub = painter(g, P, block, S) || {};
    if (!block.key) continue;
    const { self, ...rest } = sub;
    boxes[block.key] = (self || block.box || [0, 0, width, height]).map(Math.round);
    for (const [k, b] of Object.entries(rest)) boxes[`${block.key}-${k}`] = b.map(Math.round);
  }
  return { canvas, width, height, scale, radius, boxes };
}

// ------------------------------------------------------------------ painting kit
function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
// Deterministic pseudo-random numbers, so every render of a screen is identical.
function random(seed) {
  let s = seed || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function tintOf(color, alpha) {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
function shape(g, [x, y, w, h], { fill = null, stroke = null, r = 12, width = 1 } = {}) {
  g.beginPath();
  rrPath(g, x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.lineWidth = width; g.strokeStyle = stroke; g.stroke(); }
}
function text(g, s, x, y, { size = 14, weight = 400, color = '#E6EAF2', align = 'left' } = {}) {
  g.font = `${weight} ${size}px ${APP}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(s, x, y);
  return g.measureText(s).width;
}
function textWidth(g, s, size, weight) {
  g.font = `${weight} ${size}px ${APP}`;
  return g.measureText(s).width;
}
// Skeleton text: rounded bars standing in for copy.
function bars(g, x, y, widths, { h = 9, gap = 20, color }) {
  widths.forEach((w, i) => shape(g, [x, y + i * gap, w, h], { fill: color, r: h / 2 }));
}
function chip(g, x, y, label, color, { h = 24, size = 12, pad = 11 } = {}) {
  const w = textWidth(g, label, size, 600) + pad * 2;
  shape(g, [x, y, w, h], { fill: tintOf(color, 0.16), stroke: tintOf(color, 0.4), r: h / 2 });
  text(g, label, x + w / 2, y + h / 2 + size * 0.36, { size, weight: 600, color, align: 'center' });
  return [x, y, w, h];
}
function avatar(g, cx, cy, r, initials, color) {
  const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, TONES.indigo);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  text(g, initials, cx, cy + r * 0.34, { size: r * 0.78, weight: 700, color: '#FFFFFF', align: 'center' });
}
function panel(g, P, box, title) {
  shape(g, box, { fill: P.panel, stroke: P.border, r: 14 });
  if (title) text(g, title, box[0] + 24, box[1] + 38, { size: 16, weight: 650, color: P.text });
}
function button(g, P, box, label, primary) {
  shape(g, box, { fill: primary ? P.accent : P.raised, stroke: primary ? null : P.border, r: Math.min(10, box[3] / 2) });
  text(g, label, box[0] + box[2] / 2, box[1] + box[3] / 2 + 5, { size: 14, weight: 600, color: primary ? P.onAccent : P.text, align: 'center' });
}
function field(g, P, box, hint, value) {
  shape(g, box, { fill: P.field, stroke: P.border, r: 10 });
  const [x, y, , h] = box;
  const single = h < 64;
  text(g, value || hint || '', x + 14, single ? y + h / 2 + 5 : y + 26, { size: 15, color: value ? P.text : P.muted });
}

const NAMES = ['Avery Cole', 'Jordan Lee', 'Sam Rivera', 'Riley Chen', 'Morgan Blake', 'Casey Patel', 'Drew Kim', 'Quinn Adams'];
const initialsOf = n => n.split(' ').map(p => p[0]).join('').slice(0, 2);

// ------------------------------------------------------------------ blocks
const PAINT = {
  // Sidebar: { title, items: ['Home', ...], active: 0 }. Sub-boxes: item1..n.
  nav(g, P, b) {
    const [x, y, w, h] = b.box;
    g.fillStyle = P.side;
    g.fillRect(x, y, w, h);
    g.fillStyle = P.border;
    g.fillRect(x + w - 1, y, 1, h);
    shape(g, [x + 24, y + 24, 30, 30], { fill: P.accent, r: 9 });
    text(g, b.title || 'App', x + 66, y + 45, { size: 18, weight: 700, color: P.text });
    const sub = {};
    (b.items || []).forEach((label, i) => {
      const iy = y + 92 + i * 46;
      const active = i === (b.active ?? 0);
      if (active) shape(g, [x + 14, iy, w - 28, 38], { fill: tintOf(P.accent, 0.16), r: 10 });
      shape(g, [x + 28, iy + 12, 14, 14], { fill: active ? P.accent : P.faint, r: 4 });
      text(g, label, x + 54, iy + 25, { size: 15, weight: active ? 600 : 500, color: active ? P.text : P.muted });
      sub[`item${i + 1}`] = [x + 14, iy, w - 28, 38];
    });
    return sub;
  },

  // Header: { title, search: 'Search', action: 'New', avatar: 'AB' }. Sub-boxes: search, action, avatar.
  topbar(g, P, b) {
    const [x, y, w, h] = b.box;
    g.fillStyle = P.border;
    g.fillRect(x, y + h - 1, w, 1);
    text(g, b.title || '', x + 32, y + h / 2 + 9, { size: 24, weight: 700, color: P.text });
    const sub = {};
    let right = x + w - 32;
    if (b.avatar !== false) {
      avatar(g, right - 18, y + h / 2, 18, b.avatar || 'AC', P.accent);
      sub.avatar = [right - 36, y + h / 2 - 18, 36, 36];
      right -= 56;
    }
    if (b.action) {
      const bw = textWidth(g, b.action, 14, 600) + 36;
      sub.action = [right - bw, y + h / 2 - 19, bw, 38];
      button(g, P, sub.action, b.action, true);
      right -= bw + 16;
    }
    if (b.search !== false) {
      sub.search = [right - 320, y + h / 2 - 20, 320, 40];
      field(g, P, sub.search, b.search || 'Search');
    }
    return sub;
  },

  // Panel with a title and skeleton copy: { title, lines }.
  card(g, P, b, S) {
    panel(g, P, b.box, b.title);
    const [x, y, w, h] = b.box;
    const top = b.title ? 62 : 26;
    const n = b.lines ?? Math.max(1, Math.floor((h - top - 16) / 22));
    bars(g, x + 24, y + top, Array.from({ length: n }, () => (w - 48) * (0.45 + S.rand() * 0.5)), { color: P.faint });
  },

  // Metric: { title, value, delta: '+12%', tone: 'green' }. Sub-boxes: value, delta.
  stat(g, P, b) {
    panel(g, P, b.box);
    const [x, y, , h] = b.box;
    text(g, b.title || 'Metric', x + 24, y + 38, { size: 14, weight: 600, color: P.muted });
    const vw = text(g, String(b.value ?? '0'), x + 24, y + 88, { size: 36, weight: 700, color: P.text });
    const sub = { value: [x + 20, y + 52, vw + 8, 46] };
    if (b.delta) sub.delta = chip(g, x + 24, y + h - 42, b.delta, tone(b.tone || 'green'));
    return sub;
  },

  // Line chart: { title, series: 2 }. Sub-boxes: plot, peak (a small box on the first series' maximum).
  chart(g, P, b, S) {
    panel(g, P, b.box, b.title);
    const [x, y, w, h] = b.box;
    const plot = [x + 24, y + (b.title ? 64 : 24), w - 48, h - (b.title ? 64 : 24) - 28];
    const [px, py, pw, ph] = plot;
    g.strokeStyle = P.border;
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(px, py + (ph * i) / 4); g.lineTo(px + pw, py + (ph * i) / 4); g.stroke(); }
    const colors = [P.accent, TONES.teal, TONES.amber];
    let peak = null;
    for (let s = 0; s < (b.series ?? 2); s++) {
      let v = 0.3 + S.rand() * 0.2;
      const values = Array.from({ length: 12 }, () => (v = Math.min(0.92, Math.max(0.08, v + (S.rand() - 0.42) * 0.22))));
      const pts = values.map((val, i) => [px + (pw * i) / (values.length - 1), py + ph - val * ph]);
      const fill = g.createLinearGradient(0, py, 0, py + ph);
      fill.addColorStop(0, tintOf(colors[s % 3], 0.22));
      fill.addColorStop(1, tintOf(colors[s % 3], 0));
      g.beginPath();
      pts.forEach(([cx, cy], i) => (i ? g.lineTo(cx, cy) : g.moveTo(cx, cy)));
      g.lineTo(px + pw, py + ph);
      g.lineTo(px, py + ph);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.beginPath();
      pts.forEach(([cx, cy], i) => (i ? g.lineTo(cx, cy) : g.moveTo(cx, cy)));
      g.strokeStyle = colors[s % 3];
      g.lineWidth = 2.5;
      g.stroke();
      if (s === 0) {
        const top = pts.reduce((a, p) => (p[1] < a[1] ? p : a));
        g.fillStyle = colors[0];
        g.beginPath();
        g.arc(top[0], top[1], 5, 0, Math.PI * 2);
        g.fill();
        peak = [top[0] - 8, top[1] - 8, 16, 16];
      }
    }
    return { plot, peak };
  },

  // Bar chart: { title, values: [0..1, ...] }. Sub-boxes: bar1..n.
  bars(g, P, b, S) {
    panel(g, P, b.box, b.title);
    const [x, y, w, h] = b.box;
    const values = b.values || Array.from({ length: 8 }, () => 0.25 + S.rand() * 0.7);
    const top = y + (b.title ? 64 : 24), bottom = y + h - 28;
    const gap = 14, bw = (w - 48 - gap * (values.length - 1)) / values.length;
    const sub = {};
    values.forEach((v, i) => {
      const bh = (bottom - top) * v;
      const box = [x + 24 + i * (bw + gap), bottom - bh, bw, bh];
      shape(g, box, { fill: i === values.indexOf(Math.max(...values)) ? P.accent : tintOf(P.accent, 0.45), r: 6 });
      sub[`bar${i + 1}`] = box;
    });
    return sub;
  },

  // Table: { title, columns: ['Name', 'Owner', 'Status'], rows: 5, status: ['Done', 'Open', ...] }.
  // Sub-boxes: row1..n, status1..n.
  table(g, P, b, S) {
    panel(g, P, b.box, b.title);
    const [x, y, w, h] = b.box;
    const columns = b.columns || ['Name', 'Owner', 'Updated', 'Status'];
    const head = y + (b.title ? 60 : 16);
    const colW = (w - 48) / columns.length;
    columns.forEach((c, i) => text(g, c.toUpperCase(), x + 24 + i * colW, head + 22, { size: 11, weight: 700, color: P.muted }));
    g.fillStyle = P.border;
    g.fillRect(x + 16, head + 36, w - 32, 1);
    const rows = b.rows ?? Math.max(1, Math.floor((y + h - head - 52) / 52));
    const status = b.status || ['Done', 'In progress', 'Blocked', 'Review', 'Open'];
    const tones = { Done: 'green', 'In progress': 'blue', Blocked: 'red', Review: 'amber', Open: 'slate' };
    const sub = {};
    for (let r = 0; r < rows; r++) {
      const ry = head + 44 + r * 52;
      sub[`row${r + 1}`] = [x + 12, ry, w - 24, 46];
      columns.forEach((_, i) => {
        const cx = x + 24 + i * colW;
        if (i === columns.length - 1) {
          const label = status[r % status.length];
          sub[`status${r + 1}`] = chip(g, cx, ry + 11, label, tone(tones[label] || 'slate'));
        } else if (i === 1) {
          const person = NAMES[(r * 3 + 1) % NAMES.length];
          avatar(g, cx + 12, ry + 23, 12, initialsOf(person), P.accent);
          text(g, person, cx + 32, ry + 28, { size: 14, color: P.text });
        } else {
          shape(g, [cx, ry + 18, colW * (0.4 + S.rand() * 0.4), 10], { fill: P.faint, r: 5 });
        }
      });
      if (r < rows - 1) { g.fillStyle = P.border; g.fillRect(x + 16, ry + 49, w - 32, 1); }
    }
    return sub;
  },

  // List: { title, items: [{ title, sub, chip, tone }] or a count }. Sub-boxes: item1..n.
  list(g, P, b) {
    panel(g, P, b.box, b.title);
    const [x, y, w, h] = b.box;
    const top = y + (b.title ? 58 : 14);
    const count = Array.isArray(b.items) ? b.items.length : b.items ?? Math.max(1, Math.floor((y + h - top - 8) / 64));
    const sub = {};
    for (let i = 0; i < count; i++) {
      const item = Array.isArray(b.items) ? b.items[i] : {};
      const person = NAMES[i % NAMES.length];
      const iy = top + i * 64;
      sub[`item${i + 1}`] = [x + 12, iy, w - 24, 58];
      avatar(g, x + 44, iy + 29, 18, initialsOf(person), [P.accent, TONES.teal, TONES.amber, TONES.pink][i % 4]);
      text(g, item.title || person, x + 74, iy + 25, { size: 15, weight: 600, color: P.text });
      text(g, item.sub || 'Updated just now', x + 74, iy + 46, { size: 13, color: P.muted });
      if (item.chip) chip(g, x + w - 24 - textWidth(g, item.chip, 12, 600) - 22, iy + 17, item.chip, tone(item.tone || 'blue'));
    }
    return sub;
  },

  // Text field: { label, placeholder, value }. The key names the field itself; a label sits above it.
  input(g, P, b) {
    if (b.label) text(g, b.label, b.box[0], b.box[1] - 10, { size: 13, weight: 600, color: P.muted });
    field(g, P, b.box, b.placeholder, b.value);
  },

  // Button: { text, primary: true }.
  button(g, P, b) {
    button(g, P, b.box, b.text || 'Continue', b.primary !== false);
  },

  // A line of text: { text, size, weight, color: 'text' | 'muted' | 'accent' | '#hex', align }.
  text(g, P, b) {
    const [x, y, w, h] = b.box;
    const color = b.color === 'muted' ? P.muted : b.color === 'accent' ? P.accent : b.color && b.color !== 'text' ? b.color : P.text;
    const size = b.size || Math.round(h * 0.7);
    const ax = b.align === 'center' ? x + w / 2 : b.align === 'right' ? x + w : x;
    text(g, b.text || '', ax, y + h / 2 + size * 0.35, { size, weight: b.weight || 700, color, align: b.align || 'left' });
  },

  // Skeleton paragraph: { lines }.
  paragraph(g, P, b, S) {
    const [x, y, w, h] = b.box;
    const n = b.lines ?? Math.max(1, Math.floor(h / 22));
    bars(g, x, y + 6, Array.from({ length: n }, (_, i) => w * (i === n - 1 ? 0.55 : 0.85 + S.rand() * 0.15)), { color: P.faint });
  },

  // Media block: a soft gradient with a simple landscape mark.
  image(g, P, b) {
    const [x, y, w, h] = b.box;
    const grad = g.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, tintOf(P.accent, 0.55));
    grad.addColorStop(1, tintOf(TONES.teal, 0.35));
    shape(g, b.box, { fill: grad, r: b.radius ?? 14 });
    const s = Math.min(w, h) * 0.22, cx = x + w / 2, cy = y + h / 2;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath();
    g.moveTo(cx - s, cy + s * 0.6);
    g.lineTo(cx - s * 0.2, cy - s * 0.4);
    g.lineTo(cx + s * 0.3, cy + s * 0.2);
    g.lineTo(cx + s * 0.6, cy - s * 0.1);
    g.lineTo(cx + s, cy + s * 0.6);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(cx + s * 0.55, cy - s * 0.6, s * 0.2, 0, Math.PI * 2);
    g.fill();
  },

  // Status chip at box x, y (width fits the text): { text, tone }.
  chip(g, P, b) {
    return { self: chip(g, b.box[0], b.box[1], b.text || 'Status', tone(b.tone || 'blue')) };
  },

  // Progress bar: { value: 0..1, title }. Sub-boxes: fill.
  progress(g, P, b) {
    const [x, y, w, h] = b.box;
    if (b.title) text(g, b.title, x, y - 10, { size: 13, weight: 600, color: P.muted });
    shape(g, b.box, { fill: P.raised, r: h / 2 });
    const fill = [x, y, w * (b.value ?? 0.6), h];
    shape(g, fill, { fill: P.accent, r: h / 2 });
    return { fill };
  },

  // Bottom tab bar for phone screens: { items: ['Home', ...], active }. Sub-boxes: tab1..n.
  tabs(g, P, b) {
    const [x, y, w, h] = b.box;
    g.fillStyle = P.side;
    g.fillRect(x, y, w, h);
    g.fillStyle = P.border;
    g.fillRect(x, y, w, 1);
    const items = b.items || ['Home', 'Search', 'Activity', 'Profile'];
    const tw = w / items.length;
    const sub = {};
    items.forEach((label, i) => {
      const active = i === (b.active ?? 0);
      const cx = x + tw * i + tw / 2;
      shape(g, [cx - 11, y + 14, 22, 22], { fill: active ? P.accent : P.faint, r: 7 });
      text(g, label, cx, y + 54, { size: 11, weight: 600, color: active ? P.accent : P.muted, align: 'center' });
      sub[`tab${i + 1}`] = [x + tw * i, y, tw, h];
    });
    return sub;
  },

  // Confirmation toast: { text, tone }.
  toast(g, P, b) {
    const [x, y, , h] = b.box;
    const color = tone(b.tone || 'green');
    shape(g, b.box, { fill: P.panel, stroke: tintOf(color, 0.6), r: 12, width: 1.5 });
    g.fillStyle = color;
    g.beginPath();
    g.arc(x + 30, y + h / 2, 12, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#FFFFFF';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(x + 24, y + h / 2);
    g.lineTo(x + 29, y + h / 2 + 5);
    g.lineTo(x + 37, y + h / 2 - 5);
    g.stroke();
    text(g, b.text || 'Saved', x + 54, y + h / 2 + 5, { size: 15, weight: 600, color: P.text });
  },

  // Side panel over the page (pair it with a scrim block before it): { title }.
  drawer(g, P, b) {
    const [x, y, w, h] = b.box;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 40;
    g.fillStyle = P.panel;
    g.fillRect(x, y, w, h);
    g.restore();
    g.fillStyle = P.border;
    g.fillRect(x, y, 1, h);
    if (b.title) text(g, b.title, x + 28, y + 52, { size: 20, weight: 700, color: P.text });
  },

  // Dim the whole page, as behind a drawer or dialog: { alpha }.
  scrim(g, P, b, S) {
    g.fillStyle = `rgba(0,5,15,${b.alpha ?? 0.6})`;
    g.fillRect(0, 0, S.width, S.height);
  },
};
