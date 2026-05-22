---
name: product-film
description: 'Make a cinematic product film, demo video, launch video, promo or feature walkthrough of any app (web, desktop or mobile) and render it to MP4. Use when asked to make, storyboard, edit, re-time, restyle or render a video of a product from its screens: capture or import screenshots, name boxes, write beats, review contact sheets, render and verify.'
argument-hint: 'What the film is about, its audience and length, e.g. "45 s launch film for the billing app, for finance teams"'
---

# Make a product film

You direct; the toolkit animates. A film is a list of beats in `film/storyboard.js`. Each beat is a
scene recipe that works on any screen:

- point the camera at named boxes;
- type into fields;
- click through a flow;
- open a drawer;
- show screens as a grid or a 3D wall;
- land titles and an end card.

The kit adds transitions, motion blur, sound effects and music, and checks everything it can.

Read [AGENTS.md](../../../AGENTS.md) first for the rules: truth, data, policy, scope and evidence.

## 1. Brief

1. Copy [docs/brief-template.md](../../../docs/brief-template.md) to `film/brief.md`.
2. Fill it in from the product's own README, docs and UI. Ask the user only for what you cannot find:
   - audience, and the one thing the film must make them feel or do;
   - three to five moments that prove it, each tied to a screen;
   - length (30, 45, 60 or 90 s);
   - brand: name, tagline, URL, colours, logo file, fonts;
   - facts that must not appear, and which data may be shown.
3. Write the beat sheet in the brief using a structure from [docs/directing.md](../../../docs/directing.md).
   - Keep one idea per beat.
   - Write every caption and callout now, and check each against the product.

## 2. Screens

You need one screen per state you show, for example "form empty" and "form submitted". Each screen
needs named boxes for everything the camera or a callout points at. See
[docs/screens.md](../../../docs/screens.md).

| Source | Do this |
|---|---|
| A web app you can run | Write `capture-plan.json` (see `capture-plan.example.json`), then `python tools/capture.py capture-plan.json` (add `--channel msedge --headed` where headless browsers are blocked) |
| Screenshots of anything | `python tools/add_screen.py shot.png --name home --scale 2`, then draw boxes at `http://127.0.0.1:8020/boxes.html` or write them into `film/shots/home.json` |
| Nothing yet | Use `placeholder({ name, blocks })` screens in the storyboard and keep the same box names for the real screens later |

Then run `python tools/run.py proof` and look at every `film/out/proof-*.jpg`. Each box must sit
exactly on the thing it names. Fix the boxes before writing beats.

## 3. Storyboard

Edit `film/storyboard.js`. Copy patterns from [film/examples/demo.js](../../../film/examples/demo.js)
and look up options in [docs/beats.md](../../../docs/beats.md).

```js
import { makeFilm, beats as B } from './lib/kit.js';

export default makeFilm({
  brand: { name: 'Northwind', tagline: 'Invoices that chase themselves', url: 'northwind.example', image: 'assets/logo.png' },
  theme: { accent: '#22C55E', accent2: '#3B82F6', accent3: '#F59E0B' },
  beats: [
    B.title({ lines: ['Invoices, sorted.', ['Before', { text: 'lunch.', serif: true, accent: true }]] }),
    B.logo(),
    B.rise({ screen: 'dashboard', headline: 'Everything owed to you, on one screen' }),
    B.tour({ screen: 'dashboard', caption: ['See who owes what.', 'Totals update as payments land.'], steps: [
      { box: 'overdue', say: '12 invoices overdue', color: 'red' },
      { box: 'forecast', say: 'Cash expected this month' },
    ] }),
    B.type({ screen: 'new-invoice', field: 'customer', text: 'Acme Corp', send: 'create', after: 'invoice-created' }),
    B.end(),
  ],
});
```

Rules of thumb:

- **Beats.** Use 8 to 14 beats for 45 to 60 s.
- **Tours.** Give a tour two or three steps; more is a lecture.
- **Captions.**
  - Title: up to 6 words.
  - Subtitle: up to 12 words.
  - Callout: up to 5 words.
- **Pace.** Vary it: a fast beat (whip, click) after a slow one (tour, statement).
- **Hits.** Put the logo after a two- to four-second hook. End on the end card.

## 4. Check, review and iterate

Repeat until everything is clean:

1. `python tools/run.py check`
   - Fix every error, such as an unknown screen or box, or a bad transition.
   - Treat each warning, such as text that runs long, as a request to rewrite.
2. `python tools/run.py sheet`. Open every `film/out/sheet-*.jpg` and look hard:
   - Is the thing each callout names visible and highlighted?
   - Is any text cut off, overlapping or unreadable?
   - Does every frame have one clear focus?
   - Do captions cover what the beat is about?
   - Is a screen too small or too blurred?
3. Inspect details with `python tools/run.py stills --times 12.4,12.9` and open those files.
4. Fix in the storyboard. Adjust in this order:
   1. words;
   2. boxes;
   3. `fill`, `hold`, `dur` and `side`;
   4. transitions.

   Write a `custom` beat only when no recipe fits ([docs/techniques.md](../../../docs/techniques.md)).
5. `python tools/run.py sheet --transitions` checks the middle of every transition.

To check sound and timing on a part of the film, render that part on its own:
`python tools/run.py render --from 20 --to 32 --name part`.

## 5. Render and verify

1. `python tools/run.py render`. This writes `film/out/film.mp4` and `film/out/film-soundtrack.wav`.
   - A minute of film takes several minutes to render.
   - Keep the browser window visible.
2. `python tools/inspect_mp4.py film/out/film.mp4`. Expect an `avc1` track at 1920x1080 and 60 fps,
   and an `mp4a` track.
   - Without an AAC encoder (common on Linux) the MP4 is silent. The report says so, and the WAV
     holds the sound.
3. On Windows, `powershell -File tools/check_media.ps1 -Path film/out/film.mp4` confirms the system
   player opens it.

## 6. Report

Tell the user:

- the film's length and beats;
- where the files are;
- what you verified (`check`, the sheets you looked at, the render and the inspection);
- what you could not verify;
- any facts that still need their confirmation.

## When something goes wrong

See [docs/rendering.md](../../../docs/rendering.md#troubleshooting). Common fixes:

- **No report arrives.**
  - The browser window must be visible and allowed to run.
  - `--browser none` prints the URL to open by hand.
- **A box is wrong.** Run `proof`, then fix the box in `boxes.html` or in the JSON.
- **The camera is too close or too far.** Change the step's `fill` (0.4 is wide, 0.8 is tight).
- **A callout covers something.** Set `side: 'left' | 'right' | 'top' | 'bottom'`.
- **The film feels rushed.** Raise `hold` on tour steps or `dur` on beats; cut a beat rather than speed everything up.
