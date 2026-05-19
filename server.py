"""Serve the film locally and save what the browser sends back. Listens on 127.0.0.1 only.

GET serves the files under film/. POST /save/<folder>/<name> writes the request body to
film/<folder>/<name> for the two folders below, so rendered videos, stills, reports and box
manifests land on disk. Uses only the Python standard library.

Usage: python server.py [--port 8020]   (tools/run.py starts it for you when it is not running)
"""

from __future__ import annotations

import argparse
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

FILM = Path(__file__).resolve().parent / "film"
FOLDERS = {"shots", "out"}
NAME = re.compile(r"[a-z0-9][a-z0-9._-]{0,80}\.(?:png|webp|jpg|json|mp4|wav)")
MAX_BYTES = 4 * 1024**3


class FilmHandler(SimpleHTTPRequestHandler):
    """Static files plus a narrow save endpoint, for this machine's browser only."""

    # Module scripts need a JavaScript MIME type; some Windows registries map .js to text/plain.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript"}

    def __init__(self, *args, port: int, **kwargs) -> None:
        self.allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        super().__init__(*args, **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        if not getattr(self.server, "quiet", False):
            super().log_message(format, *args)

    def host_allowed(self) -> bool:
        """Refuse other host names, so a web page cannot reach this server through DNS rebinding."""
        if self.headers.get("Host", "") in self.allowed_hosts:
            return True
        self.send_error(403, "Unknown host")
        return False

    def do_GET(self) -> None:  # noqa: N802
        if self.host_allowed():
            super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802
        if self.host_allowed():
            super().do_HEAD()

    def do_POST(self) -> None:  # noqa: N802
        if not self.host_allowed():
            return
        origin = self.headers.get("Origin")
        if origin is not None and origin != f"http://{self.headers['Host']}":
            self.send_error(403, "Cross-origin save refused")
            return
        parts = self.path.strip("/").split("/")
        if len(parts) != 3 or parts[0] != "save" or parts[1] not in FOLDERS or not NAME.fullmatch(parts[2]):
            self.send_error(400, "Unsupported save path")
            return
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self.send_error(411, "Content-Length required")
            return
        if not 0 <= length <= MAX_BYTES:
            self.send_error(413, "Body too large")
            return
        target = FILM / parts[1] / parts[2]
        target.parent.mkdir(parents=True, exist_ok=True)
        remaining = length
        with target.open("wb") as output:
            while remaining:
                block = self.rfile.read(min(remaining, 1 << 20))
                if not block:
                    break
                output.write(block)
                remaining -= len(block)
        self.send_response(400 if remaining else 200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(f"{target.name} {length - remaining}".encode())


def make_server(port: int, quiet: bool = False) -> ThreadingHTTPServer:
    """A server for film/ on 127.0.0.1:port; tools/run.py starts one in a thread when none is running."""
    handler = partial(FilmHandler, directory=str(FILM), port=port)
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.quiet = quiet
    return server


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the motion film on 127.0.0.1.")
    parser.add_argument("--port", type=int, default=8020)
    args = parser.parse_args()
    server = make_server(args.port)
    print(f"Serving {FILM} at http://127.0.0.1:{args.port}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
