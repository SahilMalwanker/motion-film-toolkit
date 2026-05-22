# Public graphics and presentation

The README is the GitHub front page. [index.html](index.html) is a standalone, responsive project
landing page using the same local assets; it can be opened directly or served by any static host.
No build step, analytics, external fonts or account is required to view it.

## What the public media contains

All screenshots and animated frames come from [the bundled demo](../film/examples/demo.js),
which uses generated screens and synthetic data. They are not real customers, endorsements or
evidence that an app has the fictional capabilities shown in the demo.

| Asset | Purpose |
|---|---|
| [Hero banner](media/hero.svg) | Self-contained README header with an embedded demo image |
| [Feature badges](media/badges.svg) | Accurate toolkit counts and output specifications, not CI badges |
| [Motion preview](media/demo-preview.gif) | A shortened, silent loop: title, tour and 3D wall |
| [Static poster](media/poster.jpg) | Reduced-motion alternative |
| [Overview](media/overview.jpg), [tour](media/tour.jpg), [type](media/typography.jpg), [interaction](media/interaction.jpg), [wall](media/wall.jpg) | Still gallery |
| [Workflow graphic](media/workflow.svg) | Screens → beats → review → export |
| [Social preview](media/social-preview.png) | A 1280×640 image suitable for GitHub's repository social-preview setting |

The full-resolution MP4 and source stills stay in the local, ignored output directory.
Do not add the large film to the repository merely to make the README look active.

## Rebuild from the demo

Only this maintenance step needs Pillow. It is not a film-rendering dependency.

```bash
python -m pip install -r requirements-showcase.txt
python tools/build_showcase.py --capture
```

The second command opens a visible Chrome or Edge window, captures the selected demo frames,
then rebuilds the public assets. Keep the window visible. Use `py` instead of `python` on Windows
when needed. If policy requires a particular browser, pass `--browser edge` or `--browser chrome`.
Without `--capture`, the script reuses existing source stills.

Review the GIF, every gallery image and both wide SVGs after rebuilding. Keep the assets compact
and clearly labelled as demo material. The social-preview typography can vary with installed fonts.

## If you choose to publish later

Nothing here creates a repository, a commit, a remote or a deployment. Publication is a separate action.

- Include the source, guides, licence, public media and contribution templates.
- Exclude local outputs, screenshots, capture plans, session state, briefs, environment files and keys.
- Check image metadata and the actual content of every file; ignore rules do not protect a manually made ZIP.
- For a social preview, choose the provided PNG in the repository's settings manually.
- For static GitHub Pages hosting, the project page lives in the documentation directory. Configure
  hosting only when you intend to publish. This publishes the presentation, not the local film renderer.
- Keep verification statements tied to real runs. No hosted CI pass is claimed by the README.