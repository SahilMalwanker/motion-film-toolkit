"""Build public README graphics from the bundled demo, not from private captures.

Install requirements-showcase.txt, then run with --capture to make the source
stills in a visible Chrome or Edge window. Without --capture, reuse those stills.
"""

from __future__ import annotations

import argparse
import base64
import io
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "film" / "out"
MEDIA = ROOT / "docs" / "media"
STILLS = {
    "poster": 2.2,
    "overview": 9.2,
    "tour": 13.3,
    "typography": 25.6,
    "interaction": 33.95,
    "wall": 53.68,
}
CLIPS = [(0.4, 24), (10.1, 37), (49.9, 38)]


def clip_times() -> list[float]:
    return [round(start + i / 10, 2) for start, count in CLIPS for i in range(count)]


def source(time: float) -> Path:
    return OUT / f"showcase-{round(time * 100):05d}.jpg"


def still(time: float, width: int) -> Image.Image:
    with Image.open(source(time)) as image:
        image = image.convert("RGB")
        return image.resize((width, round(width * 9 / 16)), Image.Resampling.LANCZOS)


def image_uri(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=88, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")


def banner() -> str:
    overview = image_uri(still(STILLS["overview"], 900))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1600 680" role="img" aria-labelledby="title desc">
<title id="title">Motion Film — your screens, a story, a film.</title>
<desc id="desc">A cinematic toolkit for turning software screenshots into product films. Code-directed. Browser-rendered.</desc>
<defs>
  <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#090D17"/><stop offset="1" stop-color="#151A31"/></linearGradient>
  <radialGradient id="glow"><stop stop-color="#7061FF" stop-opacity=".3"/><stop offset="1" stop-color="#7061FF" stop-opacity="0"/></radialGradient>
  <linearGradient id="accent"><stop stop-color="#BDADFF"/><stop offset="1" stop-color="#7EADFF"/></linearGradient>
  <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#D8E0FF" stroke-opacity=".035"/></pattern>
  <clipPath id="screen"><rect x="796" y="136" width="702" height="395" rx="14"/></clipPath>
</defs>
<rect width="1600" height="680" rx="24" fill="url(#bg)"/>
<rect width="1600" height="680" rx="24" fill="url(#grid)"/>
<ellipse cx="1140" cy="290" rx="570" ry="400" fill="url(#glow)"/>
<g font-family="Segoe UI,Arial,sans-serif">
  <g transform="translate(64 48)"><rect width="36" height="36" rx="10" fill="url(#accent)"/><path d="M14 10L26 18L14 26Z" fill="#121626"/><text x="52" y="24" font-weight="700" font-size="21" letter-spacing="2.5" fill="#F4F5FA">MOTION FILM</text></g>
  <text x="64" y="157" fill="#A89DDA" font-size="15" letter-spacing="3">THE CODE-DIRECTED FILM TOOLKIT</text>
  <text x="60" y="255" fill="#F4F5FA" font-size="88" font-weight="750" letter-spacing="-4">Your screens.</text>
  <text x="60" y="350" fill="#F4F5FA" font-size="88" font-weight="750" letter-spacing="-4">A story.</text>
  <text x="62" y="443" fill="url(#accent)" font-size="90" font-family="Georgia,serif" font-style="italic" letter-spacing="-4">A film.</text>
  <text x="65" y="495" fill="#A8B2C7" font-size="20">Cinematic product videos, rendered in your browser.</text>
  <text x="65" y="526" fill="#A8B2C7" font-size="20">You direct. The toolkit handles the motion.</text>
    <rect x="64" y="583" width="326" height="40" rx="20" fill="#C0B0FF"/>
    <text x="86" y="609" fill="#191627" font-size="14" font-weight="700">CODE-DIRECTED · BROWSER-RENDERED</text>
    <text x="420" y="609" fill="#8E99B2" font-size="14">OPEN SOURCE / MIT</text>
  <g transform="rotate(-4 1147 334)">
    <rect x="780" y="82" width="734" height="488" rx="20" fill="#070B14" stroke="#383B58"/>
    <circle cx="810" cy="107" r="4" fill="#7C6CF0"/><circle cx="824" cy="107" r="4" fill="#4A4B62"/><circle cx="838" cy="107" r="4" fill="#4A4B62"/>
    <text x="872" y="112" fill="#8F98B1" font-size="12" letter-spacing="2">THE BUNDLED DEMO · SYNTHETIC DATA</text>
    <image x="796" y="136" width="702" height="395" xlink:href="{overview}" clip-path="url(#screen)"/>
    <text x="810" y="554" fill="#AAB4CF" font-size="12" letter-spacing="1">CAMERA / TYPE / INTERACTION / SOUND</text>
  </g>
  <rect x="1130" y="504" width="358" height="100" rx="16" fill="#151B2B" stroke="#464568"/>
  <path d="M1157 541L1178 553L1157 565Z" fill="#BBA8FF"/>
  <text x="1200" y="544" fill="#F1F2F8" font-size="20" font-weight="650">Screens in. Story out.</text>
  <text x="1200" y="576" fill="#9DA9C3" font-size="14">1920 × 1080 · 60 fps · MP4</text>
</g>
</svg>'''


def workflow() -> str:
    steps = [
        ("01", "Bring your screens", "Screenshots, captures or placeholders"),
        ("02", "Direct the beats", "Camera, captions and interactions"),
        ("03", "Review the frames", "Check, contact sheets and box proofs"),
        ("04", "Render the film", "MP4 and a generated soundtrack"),
    ]
    body = []
    for i, (number, title, subtitle) in enumerate(steps):
        x = 24 + i * 394
        body.append(f'''<g transform="translate({x} 24)"><rect width="370" height="152" rx="18" fill="#141A29" stroke="#2A3349"/>
<text x="24" y="37" fill="#AF9FFF" font-size="15" font-weight="700" letter-spacing="2">{number}</text>
<text x="24" y="78" fill="#F0F3FC" font-size="24" font-weight="650">{title}</text>
<text x="24" y="111" fill="#A8B4CC" font-size="15">{subtitle}</text></g>''')
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 200" role="img" aria-labelledby="title">
<title id="title">Workflow: bring your screens, direct the beats, review the frames, render the film.</title>
<rect width="1600" height="200" rx="22" fill="#0A0E18"/>
<g font-family="Segoe UI,Arial,sans-serif">''' + "".join(body) + "</g></svg>"


def badges() -> str:
    labels = ["12 scene recipes", "14 transitions", "1080p / 60 fps", "H.264 + AAC", "MIT licensed"]
    body = []
    for i, label in enumerate(labels):
        x = 8 + i * 204
        body.append(f'<rect x="{x}" y="8" width="192" height="44" rx="22" fill="#151B2B" stroke="#303A54"/><text x="{x + 96}" y="36" fill="#CED6ED" text-anchor="middle" font-size="16">{label}</text>')
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1032 60" role="img" aria-label="12 scene recipes, 14 transitions, 1080p at 60 fps, H.264 and AAC, MIT licensed"><g font-family="Segoe UI,Arial,sans-serif">' + "".join(body) + "</g></svg>"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    filename = "segoeuib.ttf" if bold else "segoeui.ttf"
    candidates = [
        Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts" / filename,
        Path("/usr/share/fonts/truetype/dejavu") / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"),
        Path("/System/Library/Fonts/Supplemental") / ("Arial Bold.ttf" if bold else "Arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default(size=size)


def social_preview() -> None:
    canvas = Image.new("RGB", (1280, 640), "#0A0E18")
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((48, 42, 92, 86), radius=12, fill="#B7A4FF")
    draw.polygon([(65, 53), (65, 75), (80, 64)], fill="#19172A")
    draw.text((110, 43), "MOTION FILM", font=font(27, True), fill="#EFF2FC")
    draw.text((54, 152), "THE CODE-DIRECTED PRODUCT FILM TOOLKIT", font=font(14, True), fill="#AC9EDE")
    draw.text((49, 204), "Screens in.", font=font(78, True), fill="#F1F3FA")
    draw.text((49, 296), "Story out.", font=font(78, True), fill="#B9A7FF")
    draw.text((54, 429), "Camera. Type. Transitions. Sound.", font=font(21), fill="#A9B5CC")
    draw.text((54, 465), "Rendered in your browser. Directed by you.", font=font(18), fill="#A9B5CC")
    draw.line((54, 530, 580, 530), fill="#30384F", width=1)
    draw.text((54, 551), "1080p / 60 fps     ·     MP4 + audio     ·     MIT", font=font(17, True), fill="#D4DDF0")
    for name, x, y, width in [("overview", 690, 127, 526), ("tour", 816, 369, 420)]:
        image = still(STILLS[name], width)
        draw.rounded_rectangle((x - 12, y - 32, x + width + 12, y + image.height + 12), radius=14, fill="#12182A", outline="#394060", width=2)
        draw.text((x + 8, y - 26), "DEMO / SYNTHETIC DATA", font=font(12), fill="#ADB7D0")
        canvas.paste(image, (x, y))
    canvas.save(MEDIA / "social-preview.png", optimize=True)


def build() -> None:
    MEDIA.mkdir(parents=True, exist_ok=True)
    for name, time in STILLS.items():
        still(time, 1280).save(MEDIA / f"{name}.jpg", quality=88, optimize=True)
    frames = [still(time, 640) for time in clip_times()]
    palette_source = Image.new("RGB", (180, 101 * len(frames)))
    for i, frame in enumerate(frames):
        palette_source.paste(frame.resize((180, 101)), (0, 101 * i))
    palette = palette_source.quantize(colors=96, method=Image.Quantize.MEDIANCUT)
    indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    indexed[0].save(
        MEDIA / "demo-preview.gif", save_all=True, append_images=indexed[1:],
        duration=100, loop=0, optimize=True, disposal=2,
    )
    (MEDIA / "hero.svg").write_text(banner(), encoding="utf-8")
    (MEDIA / "workflow.svg").write_text(workflow(), encoding="utf-8")
    (MEDIA / "badges.svg").write_text(badges(), encoding="utf-8")
    social_preview()
    for path in sorted(MEDIA.iterdir()):
        if path.is_file():
            print(f"{path.relative_to(ROOT).as_posix()}: {path.stat().st_size / 1024:.0f} KB")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", help="open a visible browser and capture demo source stills")
    parser.add_argument("--browser", choices=("auto", "chrome", "edge", "none"), default="auto")
    args = parser.parse_args()
    times = sorted(set(STILLS.values()) | set(clip_times()))
    if args.capture:
        result = subprocess.run([
            sys.executable, "tools/run.py", "stills", "--story", "examples/demo.js",
            "--name", "showcase", "--times", ",".join(map(str, times)), "--browser", args.browser,
        ], cwd=ROOT, check=False)
        if result.returncode:
            return result.returncode
    missing = [path.name for time in times if not (path := source(time)).is_file()]
    if missing:
        parser.error("Demo source stills are missing. Run again with --capture and keep the browser visible.")
    build()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())