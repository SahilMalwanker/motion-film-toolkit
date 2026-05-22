# Rendering, review and troubleshooting

## How it works

`film/index.html` loads a storyboard module (`?story=`, default `storyboard.js`) and starts it.

| Stage | What happens |
|---|---|
| Frames | Drawn with Canvas 2D, plus WebGL2 for the 3D cards, into an offscreen 1920x1080 canvas |
| Video | Encoded with WebCodecs `VideoEncoder`: H.264 High at 14 Mbps VBR, a keyframe every 2 s |
| Sound | Synthesised with an `OfflineAudioContext` and encoded with `AudioEncoder` (AAC-LC, 192 kbps, 48 kHz) |
| File | Muxed by `film/lib/mp4.js` into a fast-start MP4, then posted to `server.py` |

`server.py` only listens on 127.0.0.1. It writes only into `film/out/` and `film/shots/`, and refuses
other host names and cross-origin posts.

## The preview page

Run `python server.py` and open:

- `http://127.0.0.1:8020/` for your storyboard;
- `http://127.0.0.1:8020/?story=examples/demo.js` for the demo.

| Control | Action |
|---|---|
| **Play** or Space | Real-time playback with sound. Motion-blur sections may drop frames; renders never do |
| Scrub bar, arrow keys | Seek. Arrows step one frame; Shift steps one second |
| **Stills** | Saves every beat's key moments and the middle of each transition to `film/out/still-*.jpg` |
| **Contact sheet** | Saves `film/out/sheet-*.jpg` |
| **Render MP4** | Saves `film/out/film.mp4` and `film/out/film-soundtrack.wav` |
| `?bare` | Hides the bar, for screen recording or presenting |

The page shows the current beat's number and label next to the time.

## Automation: `tools/run.py`

```text
python tools/run.py ACTION [--story FILE] [--times T1,T2] [--transitions] [--from S] [--to S]
                           [--name NAME] [--port 8020] [--browser auto|chrome|edge|default|none]
                           [--headless] [--timeout SECONDS] [--keep-open]
```

| Action | Writes | Use it to |
|---|---|---|
| `check` | Report only | Validate screens, boxes, transitions and text lengths, and check for H.264 and AAC encoders. Prints the beat timeline |
| `sheet` | `sheet-1.jpg`, ... | Review the whole film at a glance: 20 labelled frames per sheet. `--transitions` adds the middle of every transition |
| `stills` | `still-<time>.jpg` | Look closely at chosen moments (`--times 12.5,14`) or at every key moment |
| `proof` | `proof-<screen>.jpg` | Check that every box sits on what it names |
| `render` | `film.mp4`, `film-soundtrack.wav` | Make the film. `--from` and `--to` render a part; `--name` changes the file name |

`run.py` goes through these steps:

1. It starts `server.py` in-process if nothing is listening on the port.
2. It opens the page in a new Chrome or Edge window.
3. It waits for `film/out/report.json` with a matching token.
4. It prints a summary and exits with 0 (ok), 1 (failed) or 2 (no report).
5. The window closes itself afterwards unless you pass `--keep-open`.

`--browser none` prints the URL to open by hand; `--browser default` uses the system browser.

The report (`film/out/report.json`) holds these fields:

| Field | Contents |
|---|---|
| `ok`, `errors`, `warnings` | The outcome. Errors include file and line where the browser provides them |
| `duration`, `beats` | Film length, and each beat's kind, label, transition, start, content window and marks |
| `files` | Every file written |
| `support`, `frameMs` | Encoders found and render cost (`check`) |
| `render` | Frames, bytes, codec, audio and time (`render`) |

## Rendering

- A full render draws every frame. Motion-blur windows draw several sub-frames each.
- Expect a few frames per second, so a minute of film takes several minutes.
- A partial render (`--from`, `--to`) uses the same soundtrack slice as the full film, so sound lines
  up exactly.
- Keep the browser window visible while it works. Browsers slow down hidden windows. The encoder
  watchdog fails the render with a clear message rather than hanging.

## Verifying the result

```bash
python tools/inspect_mp4.py film/out/film.mp4
powershell -File tools/check_media.ps1 -Path film/out/film.mp4      # Windows only
```

`inspect_mp4.py` (standard library) lists the MP4 boxes and checks the tracks. Expect:

- an `avc1` track at 1920x1080 with 60 samples per second;
- an `mp4a` track at 48 kHz;
- the `moov` box before `mdat`, which makes the file fast-start.

`check_media.ps1` opens the file with the Windows media stack and reports `HasAudio`, `HasVideo`,
the size and the duration.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `run.py` exits 2 (no report) | The page never finished. Is the window open, visible and not blocked by a policy prompt? Run with `--keep-open` and look at the page's status bar, or `--browser none` and open the URL yourself |
| Headless mode does nothing | Your browser policy disables headless mode. Run without `--headless`; never work around the policy |
| "No H.264 VideoEncoder" | Use a current Chrome or Edge. Firefox and Safari lack parts of WebCodecs or canvas features used here |
| "No AAC AudioEncoder" (Linux) | Chrome on Linux usually cannot encode AAC. The MP4 is silent and the soundtrack is saved as a WAV beside it. If ffmpeg is available: `ffmpeg -i film.mp4 -i film-soundtrack.wav -c:v copy -c:a aac -shortest film-with-sound.mp4` |
| "The video encoder stopped responding" | The window was hidden or minimised, or the GPU process reset. Bring the window to the front and render again |
| `Storyboard problems: ... has no box ...` | A typo, or the box is missing from the manifest. The message lists the boxes that exist. Run `proof` |
| `missing film/shots/x.json` | The screen was never captured or imported, or its name differs |
| `SyntaxError` | The report names the file and line where the browser provides them |
| Fonts look different | Set `theme.fonts` to fonts installed on the rendering machine, or ship font files with `theme.fontFaces` |
| A screen looks soft | The camera is close to the capture's resolution limit. Lower the step's `fill`, or capture at a higher `scale` |
| Text overlaps a caption or tag | Lower `fill`, set the callout's `side`, or shorten the caption |
| Opening `index.html` from disk fails | Modules and saving need the server. Use `python server.py` or `tools/run.py`, never `file://` |
| Port 8020 is busy | Pass `--port 8030` to `server.py` and `run.py` |
| `python` opens the Microsoft Store (Windows) | That `python` is the Store's placeholder. Use the `py` launcher instead, such as `py tools/run.py check` |
| `check_media.ps1 cannot be loaded` or `is not digitally signed` | Windows PowerShell's execution policy blocks the script. Do not bypass it. Run it with PowerShell 7 (`pwsh -File ...`) where that shell's policy allows local scripts, or open the MP4 in Media Player; `inspect_mp4.py` already checks the structure |

## Requirements

| Need | Version |
|---|---|
| Python | 3.9 or newer. Serving, importing screens, checking, reviewing, rendering and inspecting MP4s use only the standard library |
| Browser | Chrome or Edge with WebCodecs H.264 and AAC, WebGL2 in OffscreenCanvas, and canvas `filter` and `letterSpacing`. A current Chrome or Edge on Windows or macOS has all of these |
| Capture (optional) | `python -m pip install -r requirements-capture.txt` for Playwright |
| Public graphics (optional) | `python -m pip install -r requirements-showcase.txt` for Pillow; only needed to rebuild the README visuals |
| Media check (optional) | Windows PowerShell with .NET WPF |
