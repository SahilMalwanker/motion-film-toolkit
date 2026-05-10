# Agent guide

This repository makes short, cinematic product films of any software: web, desktop or mobile.
Films are 1920x1080, 60 fps, H.264 with AAC, with a generated soundtrack. Every frame is drawn in
code on a canvas in Chrome or Edge, encoded with WebCodecs and saved by a small local Python server.
There is no video editor, ffmpeg, Node.js or npm involved.

You direct the film. The toolkit already provides:

- the camera
- motion and transitions
- typography
- callouts
- sound effects and music
- rendering

You supply:

- the story
- the screens of the product
- the words

The full procedure is in [the product-film skill](.claude/skills/product-film/SKILL.md). Read it
before starting a film.

## Rules

1. **Truth.** Every caption, callout, number and claim must be true of the product.
   - Take facts from the product itself, its documentation or the user.
   - Ask when unsure.
   - Never invent features, metrics, customers, quotes or prices.
2. **Data.** Film only apps and data the user may publish, and prefer demo or synthetic data.
   - Do not capture secrets, personal data or internal systems without the user's permission.
   - Keep sign-in state files and capture plans that name private URLs out of version control.
3. **Policy.** Never work around browser, machine or organisational policies.
   - For example, if headless browsers are disabled, use a visible window.
   - If the user has not agreed to browser windows opening, ask first.
4. **Scope.** Your film lives in `film/storyboard.js`, with helper files beside it if needed.
   - Change `film/lib/` only to fix a bug or add a reusable technique.
   - Keep the demo working: `python tools/run.py check --story examples/demo.js`.
5. **Evidence.** Never say the film works or looks right until you have done both:
   - run `check`;
   - looked at the contact sheets.

   Report exactly what you verified and what you did not.

## Workflow

| Step | Do | Output |
|---|---|---|
| 1. Brief | Copy [docs/brief-template.md](docs/brief-template.md) to `film/brief.md` and fill it in with the user | Product, audience, promise, moments, brand, length |
| 2. Beat sheet | Pick a structure from [docs/directing.md](docs/directing.md); list the beats in the brief | One idea per beat, 2.5 to 6 s each |
| 3. Screens | Capture or import one screen per state you need, and name the boxes you will point at ([docs/screens.md](docs/screens.md)) | `film/shots/<name>.png` and `<name>.json` |
| 4. Storyboard | Write `film/storyboard.js` with `makeFilm()` and beats ([docs/beats.md](docs/beats.md)) | The film definition |
| 5. Check | `python tools/run.py check`; fix every error and warning | A clean report |
| 6. Review | `python tools/run.py sheet`; look at `film/out/sheet-*.jpg`, fix and repeat | Frames that read well |
| 7. Render | `python tools/run.py render` | `film/out/film.mp4` and the soundtrack WAV |
| 8. Verify and report | `python tools/inspect_mp4.py film/out/film.mp4`; summarise for the user | Length, beats, files, open questions |

If no screens exist yet, build the film on `placeholder()` screens first (an animatic). Later, swap in
real captures that use the same box names.

## Commands

```text
python server.py                                  serve film/ on http://127.0.0.1:8020 (run.py starts it when needed)
python tools/run.py check  [--story FILE]         load the storyboard; check screens, boxes, text lengths and encoders
python tools/run.py sheet  [--transitions]        contact sheets of every beat's key moments -> film/out/sheet-*.jpg
python tools/run.py stills --times 3.2,8.75       full-size stills at chosen times -> film/out/still-*.jpg
python tools/run.py proof                         each screen with its named boxes drawn on -> film/out/proof-*.jpg
python tools/run.py render [--from S --to S]      the MP4 -> film/out/film.mp4 (+ film-soundtrack.wav)
python tools/add_screen.py IMAGE --name N --scale S   import any screenshot as a screen
python tools/capture.py capture-plan.json         capture a running web app with Playwright (optional)
python tools/inspect_mp4.py film/out/film.mp4     check the MP4 structure
```

On Windows, if `python` opens the Microsoft Store or is not found, run the same commands with `py`.

`run.py` opens Chrome or Edge in a new window and waits for `film/out/report.json`.

- It exits with 0 when the action succeeded, 1 when it failed and 2 when no report arrived.
- Keep the window visible while it works.
- Use `--browser none` to print the URL instead, for a person to open.
- Use `--story examples/demo.js` to run any storyboard.

The report lists errors with file and line, warnings, beat start times and the files written.

## Map

| Path | What it is |
|---|---|
| `film/storyboard.js` | **The film you write.** Starts as a short skeleton on a placeholder screen |
| `film/examples/demo.js` | Every beat in use; copy patterns from it |
| `film/examples/demo-screens.js` | Placeholder screens: desktop, form, drawer, phone |
| `film/lib/beats.js` | Scene recipes: `title`, `logo`, `rise`, `tour`, `type`, `click`, `drawer`, `statement`, `grid`, `wall`, `end`, `custom` |
| `film/lib/kit.js` | `makeFilm()` and `start()`, which handle timing, transitions, motion blur, sound cues, music and checks |
| `film/lib/core.js` | Stage, theme, camera, screens, layers, 3D cards, rendering and encoding |
| `film/lib/effects.js` | Low-level effects for `custom` beats: outlines, callouts, kinetic type, cursor, typing, reveals and arrows |
| `film/lib/placeholders.js` | `placeholder()` wireframe screens built from blocks |
| `film/lib/audio.js`, `mp4.js`, `gl.js` | Soundtrack synthesis, MP4 muxer and WebGL card renderer |
| `film/lib/runner.js` | The `?run=` automation behind `tools/run.py` |
| `film/boxes.html` | Box editor: draw and name boxes on any screenshot |
| `film/shots/` | Screens: images plus JSON manifests (git-ignored) |
| `film/assets/` | Logo image and font files referenced by the storyboard |
| `film/out/` | Stills, sheets, proofs, report and renders (git-ignored) |
| `docs/` | Beats, screens, directing, techniques and rendering guides |

## Conventions

- Screen names and output names use `a-z`, `0-9`, `-` and `_`.
- Name boxes by meaning (`revenue`, `send`, `invoice-row`), not position.
- Boxes are `[x, y, w, h]` in layout pixels of their screen.
- Times are seconds. A beat's `dur` is its content time; transitions overlap neighbouring beats and are added automatically.
- Colours are palette names (`accent`, `accent2`, `accent3`, `teal`, `red`, `amber`, `green`, `pink`, `silver`) or any CSS colour.
- Caption titles stay within about 6 words and subtitles within 12 words. Callouts stay within about 5 words.
  - `check` warns when text runs long.
- Leave `film/lib/` theme-neutral: brand colours, fonts and logos belong in the storyboard's `brand` and `theme`.
