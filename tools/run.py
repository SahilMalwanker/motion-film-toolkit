"""Drive the film page in Chrome or Edge and wait for its report. Standard library only.

    python tools/run.py check                   load the storyboard; check screens, boxes and encoders
    python tools/run.py sheet                   contact sheets of every beat's key moments
    python tools/run.py stills --times 2.5,7    full-size stills at chosen film times
    python tools/run.py proof                   every screen with its named boxes drawn on it
    python tools/run.py render                  the MP4 (add --from 10 --to 20 for a part)

Add --story examples/demo.js to use another storyboard. Starts server.py on 127.0.0.1 when it is not
already running, opens the page in a new browser window, waits for film/out/report.json and prints
it. Exits 0 when the action succeeded, 1 when it failed and 2 when no report arrived.

Keep the window visible while it works: browsers slow hidden tabs down. --headless runs Chrome or
Edge without a window where your environment allows it; never work around a policy that blocks it.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORT = ROOT / "film" / "out" / "report.json"
ACTIONS = ("check", "stills", "sheet", "proof", "render")
sys.path.insert(0, str(ROOT))

import server  # noqa: E402


def server_running(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/index.html", timeout=2) as response:
            return response.status == 200
    except OSError:
        return False


def find_browser(kind: str) -> str | None:
    """The path of Chrome or Edge, in the usual install locations for this operating system."""
    if os.name == "nt":
        roots = [os.environ.get(key) for key in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA")]
        chrome = [Path(root) / "Google/Chrome/Application/chrome.exe" for root in roots if root]
        edge = [Path(root) / "Microsoft/Edge/Application/msedge.exe" for root in roots if root]
    elif sys.platform == "darwin":
        chrome = [Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"), Path("/Applications/Chromium.app/Contents/MacOS/Chromium")]
        edge = [Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")]
    else:
        names = ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")
        chrome = [Path(found) for found in map(shutil.which, names) if found]
        edge = [Path(found) for found in map(shutil.which, ("microsoft-edge", "microsoft-edge-stable")) if found]
    for path in {"chrome": chrome, "edge": edge, "auto": chrome + edge}[kind]:
        if path.is_file():
            return str(path)
    return None


def launch(url: str, browser: str, headless: bool) -> tuple[subprocess.Popen | None, str | None]:
    """Open url; returns the browser process and profile folder when this script owns them (headless)."""
    if browser == "none":
        print(f"Open this URL in Chrome or Edge and keep the window visible:\n  {url}")
        return None, None
    if browser == "default":
        webbrowser.open(url, new=1)
        return None, None
    exe = find_browser(browser)
    if not exe:
        raise SystemExit("Could not find Chrome or Edge. Use --browser default, or --browser none and open the URL yourself.")
    if headless:
        profile = tempfile.mkdtemp(prefix="film-browser-")
        args = [exe, "--headless=new", f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", url]
        return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL), profile
    subprocess.Popen([exe, "--new-window", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return None, None


def wait(token: str, timeout: float) -> dict | None:
    """Poll film/out/report.json until the page with this token reports that it is done."""
    deadline = time.monotonic() + timeout
    shown = None
    while time.monotonic() < deadline:
        time.sleep(1)
        try:
            report = json.loads(REPORT.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if report.get("token") != token:
            continue
        progress = report.get("progress")
        if progress and progress != shown:
            print(f"  rendering {progress}", flush=True)
            shown = progress
        if report.get("done"):
            return report
    return None


def summarize(report: dict) -> None:
    print(f"{'OK' if report.get('ok') else 'FAILED'}: {report.get('action')} {report.get('story', '')} in {report.get('seconds', '?')} s")
    if "duration" in report:
        print(f"  film: {report['duration']} s, {len(report.get('beats', []))} beats")
    if report.get("action") == "check":
        for beat in report.get("beats", []):
            print(f"  {beat['index']:>3}  {beat['start']:>7.2f} s  {beat['enter']:<10} {beat['label']}")
        support = report.get("support")
        if support:
            print(f"  encoders: video {support.get('video') or 'none'}, audio {'AAC' if support.get('audio') else 'none'}; about {report.get('frameMs', '?')} ms per frame")
    for step in report.get("steps", []):
        print(f"  {step}")
    render = report.get("render")
    if render:
        print(f"  video: {render.get('file')} ({render.get('bytes', 0) / 1048576:.1f} MB, {render.get('frames')} frames, {render.get('codec')}, audio {'AAC' if render.get('audio') else 'none'})")
    for path in report.get("files", [])[:60]:
        print(f"  file: {path}")
    for warning in report.get("warnings", []):
        print(f"  warning: {warning}")
    for error in report.get("errors", []):
        print(f"  error: {error}")
    print(f"  report: {REPORT.relative_to(ROOT).as_posix()}")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    parser = argparse.ArgumentParser(description="Run one film action in Chrome or Edge and print its report.")
    parser.add_argument("action", choices=ACTIONS)
    parser.add_argument("--story", default="storyboard.js", help="storyboard module inside film/, such as examples/demo.js")
    parser.add_argument("--times", help="comma-separated film times in seconds, for stills and sheet")
    parser.add_argument("--transitions", action="store_true", help="sheet: also show the middle of every transition")
    parser.add_argument("--from", dest="start", type=float, help="render: start time in seconds")
    parser.add_argument("--to", dest="end", type=float, help="render: end time in seconds")
    parser.add_argument("--name", help="output name, such as film for film/out/film.mp4 (a-z, 0-9, - and _)")
    parser.add_argument("--port", type=int, default=8020)
    parser.add_argument("--browser", choices=("auto", "chrome", "edge", "default", "none"), default="auto")
    parser.add_argument("--headless", action="store_true", help="no window; only where your browser policy allows it")
    parser.add_argument("--timeout", type=float, help="seconds to wait for the report (default 3600 for render, else 600)")
    parser.add_argument("--keep-open", action="store_true", help="leave the browser window open afterwards")
    args = parser.parse_args()

    httpd = None
    if not server_running(args.port):
        httpd = server.make_server(args.port, quiet=True)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        print(f"Started server.py on http://127.0.0.1:{args.port}/ for this run")
    token = secrets.token_hex(8)
    query = {"run": args.action, "story": args.story, "token": token}
    optional = {"times": args.times, "from": args.start, "to": args.end, "name": args.name, "transitions": "1" if args.transitions else None, "close": None if args.keep_open else "1"}
    query.update({key: str(value) for key, value in optional.items() if value is not None})
    url = f"http://127.0.0.1:{args.port}/index.html?{urllib.parse.urlencode(query)}"
    REPORT.unlink(missing_ok=True)
    process, profile = launch(url, args.browser, args.headless)
    timeout = args.timeout or (3600 if args.action == "render" else 600)
    print(f"{args.action}: waiting for the page (up to {timeout:.0f} s; keep its window visible)", flush=True)
    try:
        report = wait(token, timeout)
    finally:
        if process:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        if profile:
            shutil.rmtree(profile, ignore_errors=True)
        if httpd:
            httpd.shutdown()
            httpd.server_close()
    if report is None:
        print(f"No report after {timeout:.0f} s. Is the page open, visible and allowed to run? Open it yourself:\n  {url}", file=sys.stderr)
        return 2
    summarize(report)
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
