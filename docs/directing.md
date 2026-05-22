# Directing the film

The craft knowledge behind the beats: how to structure a product film, pace it, word it and review
it. The kit handles the mechanics. These are the decisions it cannot make for you.

## Principles

1. **One idea per beat.** Each beat proves one thing. If a caption needs "and", split the beat.
2. **Show the real product.** Every claim is followed by the screen that backs it up. Titles promise;
   screens prove.
3. **The camera is the narrator.**
   - Start wide so viewers know where they are.
   - Move in on what matters.
   - Hold long enough to read.
   - Move on with purpose.
4. **Contrast drives rhythm.** Alternate slow, readable beats (tour, statement) with quick ones
   (whip, click, grid). Never run three beats of the same kind in a row.
5. **Sound is half the film.** Visual hits (logo, chapter titles, the wall) land on impacts; moves
   carry whooshes. The kit places these for you, so give big moments their own beat.
6. **Restraint.**
   - Use one accent colour, one serif accent word per chapter and one callout per stop.
   - Leave empty space around titles.

## Structures

Content durations, before transitions. Pick the closest one and adapt it.

### 30 seconds: a single promise

| # | Beat | Content | Purpose |
|---|---|---|---|
| 1 | `title` | 2.5 s | Hook: the outcome in five words |
| 2 | `logo` | 2.4 s | Who |
| 3 | `rise` | 2.8 s | The product appears |
| 4 | `tour`, two steps | 5.5 s | The core proof |
| 5 | `type` or `click` | 4.5 s | It is easy |
| 6 | `statement` | 2.4 s | The promise restated |
| 7 | `end` | 3.6 s | Where to go |

### 45 seconds: three proofs

Hook, logo, rise, then:

1. a tour (overview);
2. a tour (an insight, ending with `end: { dive }`);
3. a type or click beat (the action);
4. a grid of screens.

Close with the end card.

### 60 seconds: two chapters

This is the shape of `film/examples/demo.js`:

1. **Opening.** Hook, logo, rise.
2. **Chapter one, "see".**
   1. A tour of the overview, ending on a dive.
   2. A tour of the problem or insight, with an arrow or a value card.
3. **Chapter two, "act".**
   1. `title({ over })` as a chapter card.
   2. `type`.
   3. `click` on another device.
   4. `drawer` for the details.
4. **Finale.** Statement, grid by role, wall, end.

### 90 seconds: a day in the life

Use `who` person tags to follow two or three roles through a workflow. Each role gets a chapter
title over its main screen and two or three beats; the roles' work connects through `arrow` steps
or before-and-after screens. Finish with the grid, the wall and the end card.

### Story arcs that work

| Arc | Shape |
|---|---|
| **Problem, product, proof, promise** | Name the pain in the hook, then show the product removing it |
| **Feature trio** | Three capabilities, each a chapter title plus one or two beats |
| **Before and after** | The same task, slow then fast: a `wipe` transition between two states, or a `value` card rolling |
| **Zoom out** | Start on one detail (`tour` with `start: box`), pull back to the whole screen, then to the wall |

## Pacing

- **Reading time.** About 0.3 s per word plus 1 s. A six-word caption needs at least 2.8 s.
  Tour steps hold 1.5 s by default and at least 1.2 s with a callout.
- **Beat length.** 2.5 to 6 s. Longer than 7 s feels stuck; split it. Shorter than 2 s cannot be read.
- **Density.** 8 to 14 beats per minute.
- **The first three seconds** decide whether people keep watching: open on the outcome, not the logo.
- **The end card** gets at least 3.5 s. Viewers need time to read the URL.
- **Repetition.** If the film feels long, cut a beat rather than shortening every beat.

## Words

| Text | Length | How |
|---|---|---|
| Hook title | 3 to 5 words | The outcome, not the feature: "Invoices, sorted." rather than "Automated invoicing module" |
| Caption title | 6 words or fewer | An outcome or a verb: "See what's slipping, and why." |
| Caption subtitle | 12 words or fewer | How it is true: "Forecasts update from each task's progress." |
| Callout | 2 to 5 words | Names what the viewer is looking at: "12 invoices overdue" |
| Statement | 2 or 3 short lines | Rhythm and parallel structure: "Clear data. Fast answers. Better decisions." |

Rules for every line:

- **Truth.** Every number, name and claim must come from the product or the user. Leave out what
  you cannot source.
- **Case.** Use sentence case; reserve full stops for titles and statements.
- **Plain words.** Avoid jargon and internal names unless the audience uses them.
- **Accents.** Use at most one accent word per title, set with `{ text, accent: true }` or
  `{ text, serif: true, accent: true }` for an elegant italic.

## Camera

- **Wide, then close.** Every screen beat opens on the home view and moves in. A rise or
  title-over-screen followed by a beat on the same screen cuts seamlessly.
- **`fill` sets the intimacy.** 0.4 shows context, 0.62 (the default) shows a card in its
  surroundings, 0.8 makes one element fill the frame. Zoom is capped so captures stay sharp.
- **One move per idea.** If two boxes belong together, frame them together: an `arrow` step does
  this automatically.
- **Pushes and dives.** The slow push during holds keeps stills alive. A `dive` into a data point is a
  strong chapter exit.
- **Safe areas.** Framing keeps boxes clear of the caption (bottom left) and the person tag (top
  left). Callouts pick a side with room; force one with `side` if needed.

## Highlights

| You want to say | Use |
|---|---|
| "Look here" | `look: 'outline'` (default) plus `say` |
| "Only this matters" | `look: 'spotlight'` |
| "This exact point" | `ripple: true` on a small box |
| "This arrives" | `reveal: 'wipe'` |
| "Scanning a list" | `reveal: 'scan'` |
| "Working on it" | `reveal: 'shimmer'` |
| "This changes" | `value: { from, to, badge }` |
| "This causes that" | `arrow: { to, label }`; use `style: 'bracket'` for items in a list |
| "Someone is doing this" | `who` person tags |

## Transitions

| Transition | Feels like | Use for |
|---|---|---|
| `cut` | Continuity | Same screen, next moment |
| `whip-*` | Energy, "and also" | Moving to the next feature or device |
| `slide-up` | A new context | Forms, composing, a new task |
| `zoom` | Punch | Into a logo, title or grid |
| `blur` | Breath, a chapter change | Into titles, statements, the wall; after a dive |
| `fade`, `dip` | Calm | Rise, end card |
| `flash` | A moment of change | Confirmations and switches |
| `wipe` | Comparison | Before and after |

Vary transitions, but keep one grammar: the same kind of change uses the same transition throughout
the film.

## Colour and type

- **Accent.** The brand's colour is `accent`, used for outlines, the caption bar, the logo tile and
  accent words. `accent2` and `accent3` support it in glows and statements.
- **Meaning.** Keep colours semantic across the film: `red` for problems, `amber` for warnings or
  change, `green` for success, `teal` for insight, `accent` for the neutral "look here".
- **Fonts.** Set brand fonts with `theme.fonts` (and `theme.fontFaces` for files in `film/assets/`).
  The display font carries titles; the serif italic is the emotional accent.
- **Contrast.** Light app screens look great on the dark stage. Behind titles they are dimmed and
  blurred, and captions sit on a scrim.

## Sound

The music follows energy:

| Moment | Energy |
|---|---|
| Hook | Quiet |
| Logo | Lifts |
| Tours | Drive |
| Typing and statements | Breathe |
| Grid and wall | Peak |
| End card | Resolves |

Set `energy` on a beat to change its place in that curve. If a beat feels flat, give it a `hit`; if
the film feels noisy, lower `energy` on reading-heavy beats.

## Reviewing contact sheets

For every frame in `film/out/sheet-*.jpg`, check the following:

1. There is one obvious focus. If the eye wanders, tighten `fill` or use the spotlight.
2. Every callout points at something visible and highlighted.
3. No text is cut off by the frame edge, and none overlaps a caption, tag or other text.
4. Captions are readable: short, not over a busy area, and on screen long enough.
5. Screens are large enough to read (zoom in) and never blurry (lower `fill` if a capture is too small).
6. Sheets taken with `--transitions` show no stray fragments of the previous scene in the middle of
   a transition.
7. Across the whole sheet there is variety of scale (wide, close, wide) and of beat type, and the
   colours keep their meaning.

Then watch the full render once at normal speed with sound, the way a viewer would.
