# Beats reference

A film is `makeFilm({ ... })` exported from a storyboard module (default `film/storyboard.js`).
Beats come from `beats` (imported as `B`). `film/examples/demo.js` uses every beat.

```js
import { makeFilm, beats as B, placeholder } from './lib/kit.js';
export default makeFilm({ brand, theme, screens, beats: [ ... ], music, cues });
```

## Film options

| Option | Meaning |
|---|---|
| `brand` | `{ name, tagline, url, line, image, icon, wordmark }`. See below. Used by `logo` and `end` |
| `theme` | `{ accent, accent2, accent3, bg, ink, dim, fonts, fontFaces, grid, grain }`. See below |
| `screens` | `placeholder()` screens, plus any capture names you want loaded. Captures used by beats load automatically from `film/shots/` |
| `beats` | The beats, in order |
| `music` | Optional override of the generated music: `{ energy: [[t, 0..1], ...], drums, hats, bass, arp: [[from, to], ...] }` in film seconds |
| `cues` | Extra sounds at film times: `{ impacts: [t], whooshes: [[t, len, up]], risers: [[t, len]], clicks: [t], typing: [t], blips: [t] }` |

### `brand` fields

| Field | Meaning |
|---|---|
| `name` | Wordmark text |
| `tagline` | Text under the logo; the end card can override it with word parts |
| `url` | Shown on the end card |
| `line` | Small closing line on the end card |
| `image` | Logo file inside `film/`, such as `assets/logo.png` (PNG, JPEG, WebP or SVG). Replaces the tile and icon |
| `icon` | 24x24 SVG path strings drawn stroke by stroke in the logo tile, such as a Lucide icon's `d` values. `false` hides the mark |
| `wordmark` | `false` hides the name, for logos that already contain it |

### `theme` fields

| Field | Meaning |
|---|---|
| `accent` | Leads: outlines, caption bars, the logo tile, accent words and the background glow |
| `accent2`, `accent3` | Support the accent |
| `bg`, `ink`, `dim` | Stage background, main text and secondary text |
| `fonts` | `{ display, text, app, serif }` as CSS font-family lists. `app` is used for typed text |
| `fontFaces` | `[{ family, src: 'assets/fonts/Brand.woff2', weight, style }]` for fonts that are not installed |
| `grid`, `grain` | `false` turns off the background grid or the film grain |

The stage is dark by design. Light or dark app screens both float well on it.

## Timing

- Each beat has a **content** duration: the time it is fully on screen. Set it with `dur`; every recipe
  has a sensible default worked out from its steps, text and targets.
- Its **enter** transition overlaps the end of the previous beat. Film length is the sum of content
  durations plus the sum of transition lengths. `python tools/run.py check` prints every beat's start time.
- Inside a beat, time `c` runs from 0 (entrance finished) to `dur` (exit starts).

## Options every beat takes

| Option | Meaning |
|---|---|
| `enter` | Transition into this beat: a name below, or `{ type, len }` |
| `caption` | `'Title.'`, `['Title.', 'Subtitle.']` or `[[word parts], 'Subtitle.']`. A lower-third caption |
| `captionAt` | When the caption starts, in seconds of content time (default 0.15) |
| `captionStyle` | `{ x, y, size, from, scrimW }` to move or resize the caption |
| `who` | `{ role, name, initials, color }`. A person tag, top left; it stays in place across consecutive beats with the same `name` |
| `energy` | 0..1, how much the music drives here. See [Sound](#sound) for the defaults |
| `hit` | `'riser'` (a rising sweep into an impact), `'impact'`, or `null`, at the beat's start |
| `label` | Name shown in reports and the preview bar |

Word parts are used by titles, captions, headlines and taglines. A part is a plain string or
`{ text, color, accent, serif, weight, font }`:

```js
['Told in', { text: 'motion.', serif: true, accent: true }]
```

Colours anywhere accept palette names (`accent`, `accent2`, `accent3`, `ink`, `dim`, `blue`,
`indigo`, `teal`, `red`, `amber`, `green`, `pink`, `silver`) or CSS colours.

## Transitions

| `enter` | Length | Look | Sound |
|---|---|---|---|
| `cut` | 0 | Hard cut | none |
| `fade` | 0.5 | Cross-fade | none |
| `dip` | 0.8 | Fade through the stage | none |
| `blur` | 0.6 | Out of focus out, into focus in | soft whoosh down |
| `zoom` | 0.7 | Old scene pushes past the camera, new one settles from slightly small | whoosh up |
| `zoom-out` | 0.7 | Old scene shrinks away, new one arrives from large | whoosh down |
| `whip-left`, `whip-right` | 0.55 | Fast camera pan across both scenes, with motion blur | whoosh up |
| `whip-up`, `whip-down` | 0.55 | Vertical whip | whoosh |
| `slide-up`, `slide-down` | 0.6 | New scene glides in from below or above as the old one fades | whoosh |
| `flash` | 0.3 | Cut on a white flash | impact |
| `wipe` | 0.7 | New scene wipes in from the left behind a line of light | whoosh up |

Defaults:

- The first beat cuts in.
- A beat that continues on the screen a `rise` or a `title({ over })` just showed also cuts in, so
  the camera move is seamless.
- Otherwise each beat has its own default:

| Beat | Default `enter` |
|---|---|
| `title` | `blur` |
| `statement` | `blur` |
| `logo` | `zoom` |
| `end` | `fade` |
| `rise` | `fade` |
| `tour` | `whip-left` |
| `type` | `slide-up` |
| `click` | `whip-left` |
| `drawer` | `whip-left` |
| `grid` | `zoom` |
| `wall` | `blur` |
| `custom` | `fade` |

## Type beats

### `title`

Big kinetic type: words rise, sharpen and settle, then a hairline of light opens under them.

```js
B.title({ lines: ['Your product.', ['Told in', { text: 'motion.', serif: true, accent: true }]] })
B.title({ lines: [['Just', { text: 'ask.', accent: true }]], sub: 'Plain requests. The right team.', over: 'compose', sparkle: true })
```

| Option | Default | Meaning |
|---|---|---|
| `lines` | required | One to three lines, each a string or word parts |
| `sub` | none | Smaller line underneath |
| `size` | 124 | Type size in px |
| `over` | none | A screen shown blurred behind the title. It sharpens as the title leaves, so the next beat on that screen cuts in seamlessly |
| `sweep` | true | The line of light under the title |
| `sparkle` | false | A small sparkle before the first word |
| `dur` | from the line count | Content seconds |

### `statement`

Short lines landing one after another, for a manifesto moment. Default colours are ink, accent,
then accent3.

```js
B.statement({ lines: ['Clear data.', 'Fast answers.', 'Better decisions.'], over: 'dashboard' })
```

| Option | Default | Meaning |
|---|---|---|
| `lines` | required | Each a string or word parts |
| `over` | none | Screen blurred and dimmed behind the lines |
| `size` | 76 | Type size in px |
| `dur` | 1.5 + 0.3 per line | Content seconds |

### `logo`

Logo lockup with a bloom of light: the mark pops and its icon draws in, the wordmark sharpens letter
by letter, and the tagline fades up. It is preceded by a riser and lands on an impact.

```js
B.logo()
B.logo({ tagline: 'Built for field teams' })
```

| Option | Default | Meaning |
|---|---|---|
| `name` | `brand.name` | Wordmark text |
| `tagline` | `brand.tagline` | Line under the lockup |
| `dur` | 2.6 | Content seconds |

### `end`

End card: mark, wordmark, tagline (word parts allowed), URL and a small closing line. It lands on an
impact; the film fades to black over its last 0.75 s.

```js
B.end({ tagline: ['Your product. Told in', { text: 'motion.', serif: true, accent: true }] })
```

| Option | Default | Meaning |
|---|---|---|
| `tagline` | `brand.tagline` | Line under the lockup |
| `url` | `brand.url` | URL line |
| `line` | `brand.line` | Small closing line |
| `dur` | 3.8 | Content seconds |

## Screen beats

### `rise`

The screen rises out of perspective into its home view: the first 16:9 of a wide screen, or all of a
phone, at 84% of the frame. It runs under an optional headline. A beat on the same screen after it
cuts in seamlessly.

```js
B.rise({ screen: 'dashboard', headline: ['One clear view of', { text: 'everything that matters.', accent: true }] })
```

| Option | Default | Meaning |
|---|---|---|
| `screen` | required | Screen name |
| `headline` | none | Text across the top |
| `dur` | 2.9 | Content seconds |

### `tour`

The workhorse. The camera opens on the screen's home view, then moves from box to box. Each stop is
outlined and labelled, and the camera keeps a slow push while it holds. With no steps it simply holds
the screen under its caption.

```js
B.tour({
  screen: 'dashboard',
  caption: ['See where everything stands.', 'Every number comes straight from your data.'],
  steps: [
    { box: 'users', say: 'Live from your data', look: 'spotlight' },
    { box: 'activity', say: 'Trends at a glance', color: 'teal' },
    { box: 'row-3', say: 'Blocked work stands out', color: 'red', value: { label: 'Launch', from: '12 Mar', to: '30 Apr', badge: '+49 days' } },
    { box: 'status-1', arrow: { to: 'status-3', style: 'bracket' }, say: 'Status at a glance', side: 'left' },
  ],
  end: { dive: 'activity-peak' },
})
```

Beat options:

| Option | Default | Meaning |
|---|---|---|
| `screen` | required | Screen name |
| `steps` | `[]` | Stops, in order. A step may be just a box name |
| `start` | home view | A box to open on instead of the home view |
| `end` | none | `'home'` returns to the home view; `{ dive: box }` zooms into a point and blurs away (pair it with a `blur` or `fade` entrance on the next beat) |
| `fill` | 0.62 | Default framing for every step |
| `clampEdges` | false | Keep the screen's edges at the frame's edges when zoomed in |
| `dur` | from the steps | Content seconds. A larger value extends the last hold |

Step options:

| Option | Default | Meaning |
|---|---|---|
| `box` | required | Box name or `[x, y, w, h]` |
| `say` | none | Callout text. It goes where there is room, clear of the caption |
| `color` | `accent` | Outline and callout colour |
| `look` | `'outline'` | `'spotlight'` also dims everything else; `'none'` moves the camera only |
| `fill` | the tour's `fill` | How much of the frame the box fills: 0.4 is wide, 0.8 is tight. Zoom never enlarges a capture past about 115% of its pixels |
| `hold` | 1.5 | Seconds on this stop; at least 1.2 when there is a callout |
| `move` | 0.8 | Seconds to travel to this stop |
| `side` | `'auto'` | Force the callout to `'top'`, `'bottom'`, `'left'` or `'right'` |
| `pad`, `radius` | 8, 12 | Outline padding and corner radius in px |
| `ripple` | false | A ring pulses from the box centre |
| `reveal` | none | How content arrives. See below |
| `arrow` | none | `{ to: box, label, color, style: 'arc' or 'bracket' }`. An arc with an optional label, or a bracket for stacked items. The camera frames both boxes |
| `value` | none | `{ label, from, to, badge, color, at: [x, y, w, h] }`. A card whose value rolls from `from` to `to`, top right |
| `view` | none | `'stay'` keeps the previous framing |

`reveal` values:

| Value | Effect |
|---|---|
| `'wipe'` | Hides the box until this step, then wipes it in. Use it for an answer arriving |
| `'scan'` | A band of colour scans down the box |
| `'shimmer'` | A loading shimmer |

### `type`

Typing into a field, with a caret and keyboard sounds. Then, optionally, the pointer clicks a send
button and the next screen appears. On wide screens the camera opens on the home view, pushes in to
the field while typing, then widens to show the button. Phones are shown whole.

```js
B.type({ screen: 'compose', field: 'title', text: 'Onboarding checklist for new hires', send: 'submit', after: 'compose-done' })
```

| Option | Default | Meaning |
|---|---|---|
| `screen`, `field` | required | The empty field's box. Its placeholder is erased as typing starts |
| `text` | required | What is typed. Long text scrolls in single-line fields and wraps in tall ones |
| `send` | none | A button box the pointer clicks after typing |
| `after` | none | Screen shown after the click: the same page in its next state. It needs the same layout so the camera stays put |
| `typed` | none | A screen with the text already in the field, cut to when typing ends, for pixel-exact app fonts |
| `cps` | 24 | Characters per second |
| `size`, `color` | from the field | Typed text size in layout px, and its colour. By default the colour contrasts with the field's colour |
| `fill` | 0.62 | Field framing |
| `dur` | from the text | Content seconds |

### `click`

The pointer travels on gentle arcs and clicks each target. Each click rings the target and can drop a
callout; then the next screen can appear. Phones are shown whole; on wide screens the camera frames
the targets.

```js
B.click({ screen: 'phone', targets: [{ box: 'task-2', say: 'Pick up where you left off' }, 'start'], after: 'phone-next' })
```

| Option | Default | Meaning |
|---|---|---|
| `screen`, `targets` | required | Box names, or `{ box, say, color, side }` |
| `after` | none | Screen shown after the last click |
| `view` | `'targets'` (wide) or `'home'` (phones) | `'home'` shows the whole screen |
| `fill` | 0.75 | Framing of the targets |
| `dur` | from the targets | Content seconds |

### `drawer`

A side panel slides in over the page it opened from, the page dims, and the camera moves closer.
Then the panel's fields are pointed out, with callouts to their left.

```js
B.drawer({ screen: 'list', panel: 'list-details', steps: [{ box: 'progress', say: '60% complete', color: 'teal' }, 'save'] })
```

| Option | Default | Meaning |
|---|---|---|
| `screen` | required | The page before the drawer opens |
| `panel` | required | The same page with the drawer open, same size and layout |
| `region` | box `drawer` on the panel, else its right 30% | The drawer's box on `panel` |
| `steps` | `[]` | `{ box, say, color, side }` on the panel |
| `backdrop` | `rgba(0,5,15,0.6)` | Dimming over the page while it slides |
| `zoom` | 1.45 x the home view | How close the camera moves |
| `dur` | from the steps | Content seconds |

Drawers open from the right.

## Montage beats

### `grid`

Screens as labelled tiles under a title, rising one after another. Each tile can ring a box. Phones
appear whole inside their tile.

```js
B.grid({ title: ['Every team,', { text: 'the right view.', accent: true }], sub: 'Each role sees what it needs.', tiles: [
  { screen: 'dashboard', label: 'Managers', sub: 'the big picture', color: 'accent', ring: 'avatar' },
  { screen: 'phone', label: 'Field teams', sub: 'on the go', color: 'amber' },
] })
```

| Option | Default | Meaning |
|---|---|---|
| `tiles` | required | `{ screen, label, sub, color, ring }`. Two to eight tiles work best |
| `title`, `sub` | none | Heading above the tiles |
| `cols` | from the count | Columns |
| `dur` | 3.4 | Content seconds |

### `wall`

The camera pulls back from one screen to reveal many as a floating 3D wall, then a headline lands.
Eight to twelve screens look best; repeats are fine.

```js
B.wall({ screens: ['a', 'b', 'c', 'dashboard', 'd', 'e', 'f', 'g'], focus: 'dashboard', title: ['One workspace.', 'Every connection.'] })
```

| Option | Default | Meaning |
|---|---|---|
| `screens` | required | Screens in reading order |
| `focus` | first screen | The screen the camera starts on |
| `title` | none | Up to two lines. The second line is in the accent colour |
| `sub` | none | Line under the title |
| `cols` | 4 | Columns |
| `dur` | 4.6 | Content seconds |

## `custom`

For anything the recipes do not cover. `draw(c, info)` runs every frame with content time `c` and
`info = { content, inLen, outLen, brand, index }`. Draw with the functions in
[techniques.md](techniques.md).

```js
import * as core from './lib/core.js';
import * as fx from './lib/effects.js';

B.custom({
  dur: 3, screens: ['pricing'], label: 'price drop',
  draw(c) {
    const v = core.shot('pricing', core.fitView('pricing'));
    const plan = v.map(core.shots.pricing.boxes.pro);
    fx.outline(plan, core.seg(c, 0.3, 0.7), core.C.green);
    fx.pill('Now 20% less', plan[0], plan[1] - 36, core.seg(c, 0.5, 0.9), { color: core.C.green });
  },
  cues: { blips: [0.3] },
  marks: [1.2],
})
```

| Option | Meaning |
|---|---|
| `dur` | Required: content seconds |
| `screens`, `textures`, `boxes` | Screens to load, screens needing 3D textures, and `[screen, box]` pairs to check |
| `cues` | Sounds in content time, same kinds as the film's `cues` |
| `blur` | `[[from, to, samples]]` motion-blur windows in content time |
| `marks` | Content times worth a still in contact sheets |

## Sound

Sound is automatic:

- whooshes on moving transitions;
- risers into hits;
- impacts on the logo, chapter titles, the wall and the end card;
- clicks on pointer clicks;
- key ticks while typing;
- soft blips when highlights appear.

The music is a 120 BPM bed whose energy follows each beat's `energy`. Drums play above 0.7, hats
above 0.82, the arpeggio above 0.6, and bass above 0.3.

Default energy by beat:

| Beat | Default `energy` |
|---|---|
| `title` | 0.2 as the opening beat, 0.65 elsewhere |
| `statement` | 0.6 |
| `logo` | 0.75 |
| `end` | 0.35 |
| `rise` | 0.8 |
| `tour` | 0.85 |
| `type` | 0.6 |
| `click` | 0.8 |
| `drawer` | 0.8 |
| `grid` | 0.9 |
| `wall` | 1 |
| `custom` | 0.8 |

Override per beat with `energy`, or for the whole film with `music`.
