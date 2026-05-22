# Techniques: the low-level kit

Everything the beats are built from, for `custom` beats and for new recipes. Import from
`./lib/core.js` and `./lib/effects.js`, or use the `core` and `fx` namespaces exported by
`./lib/kit.js`.

Conventions:

- **Frame px.** Everything draws into the 1920x1080 frame through the shared context `ctx`.
- **Layout px.** Screens and boxes are in layout px; a **view** returned by `shot()` maps them into
  frame px.
- **Progress.** Most effects take a progress `p` from 0 to 1. Build it from time with
  `seg(t, start, end)` and shape it with an easing `E.*`.

## Time and easing (core)

| Function | Meaning |
|---|---|
| `seg(t, a, b)` | Progress 0..1 of `t` between `a` and `b`, clamped |
| `clamp(v, a = 0, b = 1)` | Clamp a value |
| `lerp(a, b, t)` | Linear blend |

Easings:

| Easing | Feel |
|---|---|
| `E.lin` | Linear |
| `E.in`, `E.out`, `E.inOut` | Cubic |
| `E.outQuint`, `E.inOutQuint` | Smooth, confident moves; the camera default |
| `E.inExpo`, `E.outExpo`, `E.inOutExpo` | Whips and pushes |
| `E.outBack` | A small overshoot, for pops |

`retime(knots)` slows a sequence without redesigning it. `knots` is `[[played, designed], ...]`,
increasing from `[0, 0]`. It returns `{ designedAt(played), playedAt(designed), played, designed }`.
Hold the reading moments longer and keep the moves at their designed speed.

## Camera and screens (core)

| Function | Meaning |
|---|---|
| `shots[name]` | `{ name, bmp, W, H, scale, radius, boxes }` for every loaded screen |
| `fitView(name, fill = 0.84)` | Camera showing the screen's home view: the first 16:9 of wide screens, the whole of portrait ones |
| `frame(box, fill = 0.85, shift = [0, 0])` | Camera framing a layout box |
| `at(t, camera, ease)` and `cam(t, keys)` | Keyframed camera. `cam` interpolates centre linearly and zoom in log space; each key's `ease` shapes the move into it |
| `pinRight(k, cy)` | Camera with the screen's right edge on the frame's right edge (use with `clampEdges`) |
| `shot(name, camera, opts)` | Draw a screen as a floating window and return its view. See below |
| `view.map(box)` | Layout box to a frame rect |
| `view.pt(x, y)` | Layout point to a frame point |
| `patch(fromName, fromBox, view, toBox, alpha)` | Copy a region of one screen onto a view, such as an enabled button over a disabled one |
| `colorAt(name, x, y)` | A screen's pixel colour at a layout point (cached), for masks that blend in |
| `layer(draw, opts)` | Draw into a transparent layer, then composite it. See below |

`shot()` options:

| Option | Meaning |
|---|---|
| `alpha` | Opacity |
| `radius` | Window corner radius |
| `blur`, `bright` | Soften or dim the window, behind titles |
| `dx`, `dy` | Slide the window: whips and slide-ins |
| `clampEdges` | Never show beyond the screen's edges |

`layer()` options are `{ alpha, blur, dx, dy, scale, ox, oy, clip: [x, y, w, h] }`. Transitions use
it so a whole scene moves as one.

## 3D cards (core)

| Function | Meaning |
|---|---|
| `drawCards(camera, cards, alpha)` | Render cards with soft shadows and rounded corners |
| `glCamera(eye, target, up)` | Perspective camera |
| `model({ x, y, z, rx, ry, rz, s })` | Card transform; y is up and angles are in radians |
| `DIST` | Camera distance at which a 1920x1080 card at z = 0 fills the frame exactly |
| `textureSize[name]` | `[w, h]` in layout px of the region uploaded for a screen. Declare screens in a beat's `textures` to upload them |

A card is `{ texture, matrix: model(...), w, h, radius, alpha, bright, shadowBlur }`.

## Theme (core)

| Function | Meaning |
|---|---|
| `C` | The palette: `bg`, `ink`, `dim`, `accent`, `accent2`, `accent3`, `blue`, `indigo`, `teal`, `red`, `amber`, `green`, `pink`, `silver` |
| `colorOf(nameOrCss)` | Resolve a palette name |
| `rgb(color)` | `'r,g,b'` for building `rgba()` strings |
| `SANS`, `TEXT`, `APP`, `SERIF` | Font families, set by the theme |
| `rr(ctx, x, y, w, h, r)` | Rounded-rectangle path |

## Attention (effects)

| Function | Meaning |
|---|---|
| `outline(rect, p, color, { pad, radius, width, fade })` | A glowing outline that draws itself around a rect |
| `spotlight(rect, amount, pad, radius)` | Dims everything except a rounded window |
| `pill(text, x, y, p, { color, align, size, fade })` | Callout label with a glowing dot. `y` is its vertical centre; `align` is `left`, `right` or `center` |
| `ripple(x, y, p, color)` | Expanding ring |
| `scrim(amount, from, width)` | Dark gradient from the bottom, for captions |
| `tint(amount, rgb, strength)` | Flat colour wash |
| `flashAt(t, a, b, rgb)` | Quick pulse of light between times `a` and `b` |
| `radialFlash(amount, { x, y, r, rgb, strength })` | Bloom of light, as at the logo hit |

## Type (effects)

| Function | Meaning |
|---|---|
| `words(t, parts, x, y, { size, weight, align, stagger, dur, tracking, fade })` | Kinetic words: each rises, sharpens and settles in turn. `t` is seconds since the line started. Returns the line's width |
| `line(t, text, x, y, { size, color, weight, align, dur, fade })` | A single line fading up |
| `caption(t, t0, t1, title, sub, { x, y, size, from, scrimW })` | Lower-third caption with scrim, accent bar and kinetic title, between `t0` and `t1` |
| `lightSweep(p, y, { x, half, fade })` | Hairline of light opening from the centre |
| `wordmark(x, y, p, { text, size, align })` | Letters slide in and sharpen one by one |
| `logoMark(x, y, size, p, { draw, glow, icon })` | Glowing tile whose icon strokes draw in |
| `sparkle(x, y, r, t)` | Gently rocking four-point star |
| `withZoom(scale, blur, draw, x, y)` | Draw inside a zoom and blur about a point, such as a title pushing past the camera |

## Cursor and typing (effects)

| Function | Meaning |
|---|---|
| `pointer(t, path, clicks, alpha)` | Cursor moving on gentle arcs through `path = [[t, x, y], ...]`, pressing and rippling at `clicks = [t, ...]` |
| `cursor(x, y, press, alpha)` | Draw the cursor directly |
| `typedCount(t, [a, b], text)` | Characters typed by time `t` when typing runs from `a` to `b` |
| `typingTimes([a, b], text)` | Keystroke times, for the `typing` sound cue |
| `typing(view, box, text, count, { size, color, bg, caret, t, cover })` | Draw text into a field |
| `revealTyped(view, textBox, text, count, { size, bg, t })` | Reveal a capture's real typed text by masking what is not yet typed. It needs the capture's font metrics |
| `maskText(view, box, dx, bg)` | Blank a field |
| `counterPatch(view, n, { x, baseline, max, hint, size, width, bg, color })` | Redraw an "n/max" character counter |

## Reveals and connectors (effects)

| Function | Meaning |
|---|---|
| `wipeReveal(rect, w, { cover, glow })` | Content wipes in from the top as `w` goes from 0 to 1 |
| `scanLine(rect, p, { rgb, band, alpha })` | A band of colour scanning down |
| `shimmer(rect, t, color)` | Loading shimmer |
| `arrow(from, to, p, color, label)` | Curved arrow between frame points, with a label at its peak |
| `bracketArrow(from, to, p, { color, fade, bulge })` | Bracket bowing out to the right, linking stacked items |

## Set pieces (effects)

| Function | Meaning |
|---|---|
| `swapCard(t, { box, label, from, to, appearAt, swapAt, badge, badgeAt, color, fade })` | A card whose value rolls from `from` to `to` |
| `personTag(t, spans)` | "Who is acting" pill, top left. `spans = [[from, to, { role, name, initials, color }]]` |
| `drawerIn(base, panel, camera, p, { box, backdrop })` | Drawer from `panel` slides over `base`; returns `{ v, off }` |
| `thumbnail(name, rect, { alpha, radius })` | A screen as a card in a rect; returns a view |

## Sound cues

Cues are times when sounds play, relative to the beat in `custom({ cues })`, or absolute in the
film's `cues`:

| Kind | Form | Sound |
|---|---|---|
| `impacts` | `[t]` | Low boom with a noise tail |
| `whooshes` | `[[t, len, up]]` | Filtered noise sweep; `up: true` rises in pitch |
| `risers` | `[[t, len]]` | Build-up ending at `t + len` |
| `clicks` | `[t]` | UI click |
| `typing` | `[t]` | Key tick |
| `blips` | `[t]` | Soft chime |

## Example: before and after with a wipe

```js
import { beats as B, core, fx } from './lib/kit.js';
const { shot, fitView, seg, E, W, H } = core;

B.custom({
  dur: 3.2, label: 'before and after', screens: ['report-old', 'report-new'],
  draw(c) {
    const camera = fitView('report-old');
    shot('report-old', camera);
    const p = E.inOutQuint(seg(c, 0.8, 1.8));
    core.layer(() => shot('report-new', camera), { clip: [0, 0, W * p, H] });
    fx.pill('Before', 160, 120, seg(c, 0.2, 0.5), { color: core.C.red, fade: 1 - seg(c, 1.2, 1.5) });
    fx.pill('After', W - 160, 120, seg(c, 1.6, 1.9), { color: core.C.green, align: 'right' });
  },
  cues: { whooshes: [[0.75, 1.1, true]], blips: [1.6] },
  blur: [[0.8, 1.8, 6]],
  marks: [0.5, 2.6],
})
```

## Example: a counter that rolls up

```js
B.custom({
  dur: 2.6, screens: ['dashboard'],
  draw(c) {
    const box = core.shots.dashboard.boxes.revenue;
    const v = core.shot('dashboard', core.fitView('dashboard'));
    const [x, y] = v.pt(box[0], box[1]), k = v.k;
    const n = Math.round(84200 * core.E.outQuint(core.seg(c, 0.3, 1.6)));
    const ctx = core.ctx;
    ctx.fillStyle = core.colorAt('dashboard', box[0] + 6, box[1] + 6);
    ctx.fillRect(x + 16 * k, y + 50 * k, (box[2] - 32) * k, 48 * k);
    ctx.font = `700 ${36 * k}px ${core.APP}`;
    ctx.fillStyle = core.C.ink;
    ctx.fillText(`$${n.toLocaleString('en-US')}`, x + 24 * k, y + 88 * k);
  },
})
```

Read `core.ctx` at draw time rather than storing it: it points at a transition layer while a beat
is entering or leaving.
