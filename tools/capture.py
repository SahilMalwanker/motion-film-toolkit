"""Capture screens of a running web app for the film, with named element boxes.

Reads a capture plan (JSON), opens each page with Playwright at a device scale factor (2 by default),
puts it into the state to film with optional actions, measures the named boxes with
film/capture/capture-helpers.js, and writes film/shots/<name>.png plus film/shots/<name>.json with the
layout size, scale and boxes in CSS pixels. See capture-plan.example.json and docs/screens.md.

Usage:
    python -m pip install -r requirements-capture.txt
    python -m playwright install chromium          (or use --channel chrome / msedge)
    python tools/capture.py capture-plan.json [--channel msedge] [--headed] [--only home,settings]

Only capture apps and data you are allowed to publish. Keep sign-in state files out of version control.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "film" / "shots"
HELPERS = ROOT / "film" / "capture" / "capture-helpers.js"
NAME = re.compile(r"[a-z0-9][a-z0-9_-]{0,60}")
HIDE = (
    "*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}"
    " *{scrollbar-width:none!important;caret-color:transparent!important}"
)
BOX_OPTIONS = ("scope", "selector", "exact", "card", "minHeight", "minWidth")


def measure(page, spec: dict) -> list[int] | None:
    """[x, y, w, h] for {"selector": css}, {"text": "Save", ...options} or {"rect": [x, y, w, h]}."""
    if "rect" in spec:
        return [round(v) for v in spec["rect"]]
    if "text" in spec:
        options = {key: spec[key] for key in BOX_OPTIONS if key in spec}
        return page.evaluate("([text, options]) => window.captureBox(text, options)", [spec["text"], options])
    return page.evaluate("selector => window.captureRect(selector)", spec["selector"])


def run_actions(page, base: str, actions: list[dict]) -> None:
    """Put the page into the state to film. Each action is one of:
    {"goto": "/path"}, {"click": css}, {"fill": [css, text]}, {"press": [css, key]}, {"hover": css},
    {"scroll": y}, {"waitFor": css}, {"wait": ms}."""
    for action in actions:
        if "goto" in action:
            page.goto(base + action["goto"], wait_until="networkidle")
        elif "click" in action:
            page.click(action["click"])
        elif "fill" in action:
            page.fill(*action["fill"])
        elif "press" in action:
            page.press(*action["press"])
        elif "hover" in action:
            page.hover(action["hover"])
        elif "scroll" in action:
            page.evaluate("y => window.scrollTo(0, y)", int(action["scroll"]))
        elif "waitFor" in action:
            page.wait_for_selector(action["waitFor"])
        elif "wait" in action:
            page.wait_for_timeout(int(action["wait"]))
        else:
            raise SystemExit(f"Unknown action: {action}")


def capture(plan: dict, channel: str | None, headed: bool, only: set[str] | None) -> int:
    """Capture every screen in the plan; returns how many boxes could not be found."""
    from playwright.sync_api import sync_playwright

    base = plan["baseUrl"].rstrip("/")
    SHOTS.mkdir(parents=True, exist_ok=True)
    helpers = HELPERS.read_text(encoding="utf-8")
    missing = 0
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel=channel, headless=not headed)
        for screen in plan["screens"]:
            name = screen["name"]
            if not NAME.fullmatch(name):
                raise SystemExit(f"Screen names use a-z, 0-9, '-' and '_': {name!r}")
            if only and name not in only:
                continue
            width = int(screen.get("width", plan.get("width", 1920)))
            height = int(screen.get("height", plan.get("height", 1080)))
            scale = float(screen.get("scale", plan.get("scale", 2)))
            mobile = bool(screen.get("mobile", False))
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=scale,
                color_scheme=screen.get("colorScheme", plan.get("colorScheme", "light")),
                is_mobile=mobile,
                has_touch=mobile,
                storage_state=plan.get("storageState"),
                bypass_csp=True,
            )
            context.add_init_script(helpers)
            page = context.new_page()
            page.goto(base + screen.get("path", "/"), wait_until="networkidle")
            page.add_style_tag(content=HIDE)
            run_actions(page, base, screen.get("actions", []))
            if screen.get("fullPage"):
                page.evaluate("window.scrollTo(0, 0)")
                height = min(int(page.evaluate("document.scrollingElement.scrollHeight")), int(screen.get("maxHeight", 6000)))
                page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(int(screen.get("wait", 800)))
            boxes = {}
            for key, spec in screen.get("boxes", {}).items():
                found = measure(page, spec)
                if found is None:
                    missing += 1
                    print(f"  {name}: box {key!r} not found", file=sys.stderr)
                else:
                    boxes[key] = found
            page.screenshot(path=str(SHOTS / f"{name}.png"), animations="disabled")
            manifest = {"name": name, "image": f"{name}.png", "width": width, "height": height, "scale": scale, "boxes": boxes}
            if "radius" in screen:
                manifest["radius"] = screen["radius"]
            (SHOTS / f"{name}.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            print(f"{name}: {width}x{height} layout px at {scale:g}x, {len(boxes)} boxes")
            context.close()
        browser.close()
    return missing


def main() -> int:
    parser = argparse.ArgumentParser(description="Capture screens and named boxes of a web app for the film.")
    parser.add_argument("plan", type=Path, help="capture plan JSON")
    parser.add_argument("--channel", choices=("chromium", "chrome", "msedge"), default="chromium", help="browser to drive (default: Playwright's own Chromium)")
    parser.add_argument("--headed", action="store_true", help="show the browser window, for machines where headless browsers are disabled")
    parser.add_argument("--only", help="comma-separated screen names to capture again")
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    only = set(args.only.split(",")) if args.only else None
    missing = capture(plan, None if args.channel == "chromium" else args.channel, args.headed, only)
    if missing:
        print(f"{missing} box(es) not found: fix the plan, or mark them in http://127.0.0.1:8020/boxes.html", file=sys.stderr)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
