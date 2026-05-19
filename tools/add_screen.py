"""Add screenshots of any app (desktop, web, mobile, design mock-ups) to the film. Standard library only.

    python tools/add_screen.py path/to/home.png --name home
    python tools/add_screen.py phone-home.png --name phone-home --scale 3 --radius 44
    python tools/add_screen.py exports/*.png --scale 2

Copies each image to film/shots/<name>.<ext> and writes film/shots/<name>.json:
    {"name", "image", "width", "height", "scale", "radius", "boxes"}
width and height are layout px: image px divided by --scale (1 for a plain screenshot measured in image
px, 2 for a Retina or 200% capture, 3 for most phone screenshots). Boxes already in the manifest are
kept unless --reset. Then name the regions the film points at: draw them in
http://127.0.0.1:8020/boxes.html, or write them as "key": [x, y, w, h] in layout px, and check them with
python tools/run.py proof.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "film" / "shots"
NAME = re.compile(r"[a-z0-9][a-z0-9_-]{0,60}")
SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def image_size(path: Path) -> tuple[int, int]:
    """Width and height in pixels of a PNG, JPEG or WebP file."""
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker == 0xFF or marker == 0x01 or 0xD0 <= marker <= 0xD8:
                i += 1 if marker == 0xFF else 2
                continue
            if marker in SOF:
                height, width = struct.unpack(">HH", data[i + 5 : i + 9])
                return width, height
            i += 2 + struct.unpack(">H", data[i + 2 : i + 4])[0]
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        chunk = data[12:16]
        if chunk == b"VP8 ":
            width, height = struct.unpack("<HH", data[26:30])
            return width & 0x3FFF, height & 0x3FFF
        if chunk == b"VP8L":
            bits = int.from_bytes(data[21:25], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        if chunk == b"VP8X":
            return int.from_bytes(data[24:27], "little") + 1, int.from_bytes(data[27:30], "little") + 1
    raise SystemExit(f"{path}: not a PNG, JPEG or WebP image")


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", text.lower()).strip("-_") or "screen"


def add(image: Path, name: str, scale: float, radius: float | None, reset: bool) -> None:
    if not image.is_file():
        raise SystemExit(f"No such file: {image}")
    if not NAME.fullmatch(name):
        raise SystemExit(f"Screen names use a-z, 0-9, '-' and '_', starting with a letter or digit: {name!r}")
    ext = image.suffix.lower().replace(".jpeg", ".jpg")
    if ext not in (".png", ".jpg", ".webp"):
        raise SystemExit(f"{image}: use a PNG, JPEG or WebP image")
    width, height = image_size(image)
    SHOTS.mkdir(parents=True, exist_ok=True)
    target = SHOTS / f"{name}{ext}"
    if image.resolve() != target.resolve():
        shutil.copyfile(image, target)
    manifest_path = SHOTS / f"{name}.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    tidy = lambda value: int(value) if float(value).is_integer() else round(value, 2)  # noqa: E731
    manifest = {
        "name": name,
        "image": target.name,
        "width": tidy(width / scale),
        "height": tidy(height / scale),
        "scale": tidy(scale),
        "boxes": {} if reset else old.get("boxes", {}),
    }
    if radius is not None or "radius" in old:
        manifest["radius"] = radius if radius is not None else old["radius"]
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{name}: {width}x{height} image px = {manifest['width']}x{manifest['height']} layout px at {scale}x, {len(manifest['boxes'])} boxes")


def main() -> None:
    parser = argparse.ArgumentParser(description="Add screenshots to film/shots/ with a manifest.")
    parser.add_argument("images", nargs="+", type=Path)
    parser.add_argument("--name", help="screen name for a single image (default: from its file name)")
    parser.add_argument("--scale", type=float, default=1.0, help="image px per layout px (default 1)")
    parser.add_argument("--radius", type=float, help="corner radius in layout px, about 44 for a phone screen")
    parser.add_argument("--reset", action="store_true", help="drop boxes already in the manifest")
    args = parser.parse_args()
    if args.name and len(args.images) > 1:
        raise SystemExit("--name works with one image at a time")
    if args.scale <= 0:
        raise SystemExit("--scale must be positive")
    for image in args.images:
        add(image, args.name or slug(image.stem), args.scale, args.radius, args.reset)


if __name__ == "__main__":
    main()
