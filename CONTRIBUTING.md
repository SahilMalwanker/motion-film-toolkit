# Contributing

Useful contributions make films easier to direct, review or render—without coupling the toolkit
to one app or brand. Keep changes small, explain the problem and include evidence of the result.

## Start with the working demo

- Read [AGENTS.md](AGENTS.md), the [beat reference](docs/beats.md) and the [techniques guide](docs/techniques.md).
- Preview the [demo](film/examples/demo.js) before changing shared engine code.
- Keep app-specific colours, fonts, logos, screens and wording in the storyboard, not in the library.
- Core preview and rendering must continue to work with the Python standard library and Chrome or Edge.
- Optional dependencies belong in their own requirements file.

## Show what you verified

```bash
python tools/run.py check --story examples/demo.js
python tools/run.py check
python tools/run.py sheet --story examples/demo.js --transitions
```

Use `py` on Windows if `python` opens the Store. These commands open browser windows;
ask permission when running on someone else's machine and keep the windows visible.

Review every contact sheet rather than only the checker output. For screen changes, run `proof`
and inspect the box overlays. For export or sound changes, render a representative section,
inspect its MP4 and confirm playback. Report exactly what passed and what was not tested.

## Keep contributions safe to share

- Use synthetic screens and data. Every product claim must have a real source.
- Never attach sign-in state, private URLs, environment files, keys or unredacted screenshots.
- Do not work around browser, machine or organisational policies.
- Ensure you have permission to redistribute any fonts, images and other assets.
- Follow [SECURITY.md](SECURITY.md) for suspected vulnerabilities; do not disclose sensitive details in a public issue.

## Documentation and presentation

Update the relevant reference when an API changes. Keep screenshots tied to the included demo,
not to a private app. The [showcase guide](docs/showcase.md) explains how to rebuild public media.
Do not add unverified performance claims, fabricated usage numbers or badges for checks that do not exist.

Contributions to this template are offered under its [MIT licence](LICENSE).