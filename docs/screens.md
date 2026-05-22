# Screens

A **screen** is a picture of one state of the product plus a manifest that names regions on it, its
**boxes**. Beats only ever refer to screens and boxes by name, so the same storyboard works for any
app layout, and a placeholder can be swapped for a real capture without touching the beats.

## The manifest

`film/shots/<name>.json` sits beside its image.

```json
{
  "name": "home",
  "image": "home.png",
  "width": 1920,
  "height": 1080,
  "scale": 2,
  "radius": 14,
  "boxes": {
    "revenue": [280, 108, 384, 140],
    "send": [1060, 676, 188, 48]
  }
}
```

| Field | Meaning |
|---|---|
| `name` | Lowercase `a-z`, `0-9`, `-` and `_` |
| `image` | The PNG, JPEG or WebP file in `film/shots/` (default `<name>.png`) |
| `width`, `height` | Size in **layout px**: image px divided by `scale` |
| `scale` | Image px per layout px. Use 2 for a 2x browser capture or Retina screenshot, 3 for most phone screenshots, and 1 for a plain screenshot measured in image px. The camera never zooms past about 1.15 x `scale`, so captures stay sharp |
| `radius` | Corner radius of the floating window in layout px: about 14 for desktop, 40 to 48 for phones |
| `boxes` | `"key": [x, y, w, h]` in layout px, from the top-left of the screen |

Wide screens show their first 16:9 as the home view; taller pages can be panned with tour steps.
Portrait screens (phones) are shown whole.

## Where screens come from

### 1. A web app you can run: `tools/capture.py`

Playwright opens each page, sets it up, measures boxes from the DOM, and screenshots it at the device
scale factor you choose.

```bash
python -m pip install -r requirements-capture.txt
python -m playwright install chromium        # or use --channel chrome / --channel msedge
python tools/capture.py capture-plan.json    # add --headed where headless browsers are not allowed
```

Write `capture-plan.json` from `capture-plan.example.json`. It is git-ignored because plans often name
private URLs.

Plan-level fields:

| Field | Meaning |
|---|---|
| `baseUrl` | The app's origin |
| `width`, `height`, `scale`, `colorScheme` | Defaults for every screen |
| `storageState` | Optional path to a Playwright sign-in state file. Never commit it |

Screen fields:

| Field | Meaning |
|---|---|
| `name`, `path` | Screen name and URL path |
| `width`, `height`, `scale` | Per-screen viewport. For a phone: 390 x 844 at scale 3 with `"mobile": true` |
| `actions` | Put the page into the state to film. See below |
| `fullPage` | Capture the whole scrollable height, up to `maxHeight` (default 6000) |
| `wait` | Milliseconds to settle before capture (default 800) |
| `radius` | Window corner radius for the manifest |
| `boxes` | How to find each box. See below |

The `actions` list runs in order. Each action is one of:

- `{ "goto": "/path" }`
- `{ "click": "css" }`
- `{ "fill": ["css", "text"] }`
- `{ "press": ["css", "Enter"] }`
- `{ "hover": "css" }`
- `{ "scroll": 600 }`
- `{ "waitFor": "css" }`
- `{ "wait": 300 }`

Each entry in `boxes` is one of:

| Spec | Meaning |
|---|---|
| `{ "selector": "#total" }` | The element's bounding box |
| `{ "text": "Save" }` | The smallest visible element whose text starts with "Save". Add `"exact": true` to require the whole text, `"card": true` to take the enclosing rounded, bordered or filled panel instead, and `"scope": "css"` to search inside one element |
| `{ "rect": [x, y, w, h] }` | Fixed coordinates |

Missing boxes are reported, and the script exits 1.

Capture each state as its own screen. For example, `compose` is the empty form and `compose-done`
is the same page after submitting. Screens used together in one beat (`after`, `panel`, `typed`) must
share size and layout.

`film/capture/tiled-capture.js` is an alternative for browsers whose device scale factor cannot be
set. It captures scaled tiles over the Chrome DevTools Protocol and stitches them into a 2x image.

### 2. Screenshots of anything: `tools/add_screen.py`

Use this for desktop apps, mobile apps, design mock-ups or a web app you cannot drive.

```bash
python tools/add_screen.py ~/Desktop/home.png --name home --scale 2
python tools/add_screen.py phone.png --name phone-home --scale 3 --radius 44
```

It copies the image into `film/shots/` and writes the manifest. If the manifest already exists its
boxes are kept; `--reset` clears them. Then name the boxes:

- **Box editor.** Run `python server.py` and open `http://127.0.0.1:8020/boxes.html`.
  1. Pick the screen.
  2. Drag to draw a box, then name it. You can draw inside another box.
  3. Click a box to select it; click again to select the box around it. Drag the selected box to move
     it, or its corner to resize it.
  4. Arrow keys nudge the selected box, Enter renames it, Delete removes it and Esc deselects it.
  5. **Save boxes** writes the manifest.
- **By hand.** Open the image, read pixel coordinates, divide them by `scale`, and write `[x, y, w, h]`
  into `boxes`.

Tips for clean screenshots:

- Use the same window size for every screen of one app.
- Hide the cursor, notifications and personal details.
- Use demo data.
- Take each state you will show, such as before and after a click.

### 3. Nothing yet: `placeholder()`

Draw stand-in screens from blocks, so you can build and time the whole film (an animatic) before any
real screen exists.

```js
import { placeholder } from './lib/kit.js';

const home = placeholder({
  name: 'home', theme: 'dark', accent: '#6366F1', blocks: [
    { kind: 'nav', key: 'nav', box: [0, 0, 248, 1080], title: 'Product', items: ['Home', 'Reports'] },
    { kind: 'stat', key: 'metric', box: [280, 108, 520, 160], title: 'Key metric', value: '1,234', delta: '+5%' },
    { kind: 'chart', key: 'trend', box: [824, 108, 1064, 420], title: 'Trend' },
  ],
});
// makeFilm({ screens: [home], ... })
```

Placeholder options:

| Option | Default | Meaning |
|---|---|---|
| `width`, `height` | 1920, 1080 | Size in layout px. For a phone, use 390 x 844 with `scale: 3` and `radius: 44` |
| `scale` | 2 | Image px per layout px |
| `theme` | `'dark'` | `'dark'`, `'light'`, or an object overriding palette colours |
| `accent` | `#6366F1` | The app's accent colour |

Block kinds, and the sub-boxes some of them add as `<key>-<sub>`:

| Kind | Fields | Sub-boxes |
|---|---|---|
| `nav` | `title`, `items`, `active` | `item1..n` |
| `topbar` | `title`, `search`, `action`, `avatar` | `search`, `action`, `avatar` |
| `card` | `title`, `lines` | |
| `stat` | `title`, `value`, `delta`, `tone` | `value`, `delta` |
| `chart` | `title`, `series` | `plot`, `peak` (the highest point of the first line) |
| `bars` | `title`, `values` | `bar1..n` |
| `table` | `title`, `columns`, `rows`, `status` | `row1..n`, `status1..n` |
| `list` | `title`, `items` (count or `{ title, sub, chip, tone }`) | `item1..n` |
| `input` | `label`, `placeholder`, `value` | |
| `button` | `text`, `primary` | |
| `text` | `text`, `size`, `weight`, `color`, `align` | |
| `paragraph` | `lines` | |
| `image` | | |
| `chip` | `text`, `tone`; box is `[x, y]` and the width fits the text | |
| `progress` | `value`, `title` | `fill` |
| `tabs` | `items`, `active` | `tab1..n` |
| `toast` | `text`, `tone` | |
| `drawer` | `title` | |
| `scrim` | `alpha`; covers the page; no box needed | |

Only blocks with a `key` become boxes. When the real screen arrives, give its manifest the same box
names, remove the placeholder from `screens`, and run `check`.

## Naming boxes

- Name by meaning: `revenue`, `overdue-invoices`, `send`, `filter-status`. Avoid `box1` or `top-left`.
- Box what the viewer should look at: the card, button or row, not the whole column.
- For text the camera types into, box the field itself. Its colour is sampled to erase the
  placeholder text.
- For `click`, box the target precisely; the pointer aims at its centre.

## Check the boxes

```bash
python tools/run.py proof     # writes film/out/proof-<screen>.jpg for every screen the storyboard loads
```

Each proof shows the screen with every box outlined and named. Look at them. A box that is off by a
few pixels is visible as a misplaced outline in the film.

## Privacy

Films are often published. Before capturing, check with the user that the account, data and
environment may appear publicly. Prefer seeded demo data. `film/shots/` and `capture-plan.json` are
git-ignored by default.
