"""Print the box structure and track facts of an MP4 written by film/lib/mp4.js."""

from __future__ import annotations

import struct
import sys
from pathlib import Path

CONTAINERS = {b"moov", b"trak", b"mdia", b"minf", b"stbl", b"dinf", b"edts"}


def boxes(data: bytes, start: int, end: int):
    """Yield (type, payload_start, box_end) for each box in data[start:end]."""
    pos = start
    while pos + 8 <= end:
        size, kind = struct.unpack(">I4s", data[pos : pos + 8])
        header = 8
        if size == 1:
            size = struct.unpack(">Q", data[pos + 8 : pos + 16])[0]
            header = 16
        elif size == 0:
            size = end - pos
        if size < header or pos + size > end:
            raise ValueError(f"bad box {kind!r} at {pos}: size {size}")
        yield kind, pos + header, pos + size
        pos += size
    if pos != end:
        raise ValueError(f"trailing bytes at {pos} (end {end})")


def walk(data: bytes, start: int, end: int, depth: int, track: dict, tracks: list) -> None:
    for kind, body, stop in boxes(data, start, end):
        name = kind.decode("latin-1")
        print("  " * depth + f"{name} {stop - body + 8}")
        if kind == b"trak":
            track = {}
            tracks.append(track)
        if kind in CONTAINERS:
            walk(data, body, stop, depth + 1, track, tracks)
        elif kind == b"mvhd":
            version = data[body]
            if version == 0:
                timescale, duration = struct.unpack(">II", data[body + 12 : body + 20])
            else:
                timescale, duration = struct.unpack(">IQ", data[body + 20 : body + 32])
            print("  " * depth + f"  movie timescale={timescale} duration={duration / timescale:.3f}s")
        elif kind == b"mdhd":
            version = data[body]
            if version == 0:
                timescale, duration = struct.unpack(">II", data[body + 12 : body + 20])
            else:
                timescale, duration = struct.unpack(">IQ", data[body + 20 : body + 32])
            track["timescale"] = timescale
            track["duration"] = duration / timescale
        elif kind == b"hdlr":
            track["handler"] = data[body + 8 : body + 12].decode("latin-1")
        elif kind == b"stsd":
            count = struct.unpack(">I", data[body + 4 : body + 8])[0]
            entry = body + 8
            size, fmt = struct.unpack(">I4s", data[entry : entry + 8])
            track["format"] = fmt.decode("latin-1")
            print("  " * depth + f"  entries={count} format={track['format']}")
            if fmt == b"avc1":
                width, height = struct.unpack(">HH", data[entry + 32 : entry + 36])
                track["size"] = (width, height)
                inner = entry + 8 + 78
            elif fmt == b"mp4a":
                channels, bits = struct.unpack(">HH", data[entry + 24 : entry + 28])
                rate = struct.unpack(">I", data[entry + 32 : entry + 36])[0] >> 16
                track["audio"] = (channels, bits, rate)
                inner = entry + 8 + 28
            else:
                inner = entry + size
            for sub, sub_body, sub_end in boxes(data, inner, entry + size):
                print("  " * depth + f"    {sub.decode('latin-1')} {data[sub_body:sub_end].hex()[:120]}")
        elif kind == b"stts":
            count = struct.unpack(">I", data[body + 4 : body + 8])[0]
            runs = [struct.unpack(">II", data[body + 8 + i * 8 : body + 16 + i * 8]) for i in range(count)]
            track["samples"] = sum(n for n, _ in runs)
            track["stts"] = runs[:4]
        elif kind == b"stss":
            track["sync"] = struct.unpack(">I", data[body + 4 : body + 8])[0]
        elif kind == b"stsz":
            fixed, count = struct.unpack(">II", data[body + 4 : body + 12])
            sizes = [fixed] * count if fixed else list(struct.unpack(f">{count}I", data[body + 12 : body + 12 + 4 * count]))
            track["bytes"] = sum(sizes)
            track["stsz_count"] = count
        elif kind == b"stco":
            count = struct.unpack(">I", data[body + 4 : body + 8])[0]
            offsets = struct.unpack(f">{count}I", data[body + 8 : body + 8 + 4 * count])
            track["chunks"] = count
            track["first_offset"] = offsets[0] if offsets else None
            track["last_offset"] = offsets[-1] if offsets else None


def main() -> None:
    path = Path(sys.argv[1])
    data = path.read_bytes()
    print(f"{path.name}: {len(data):,} bytes")
    tracks: list[dict] = []
    walk(data, 0, len(data), 0, {}, tracks)
    mdat = next((body, stop) for kind, body, stop in boxes(data, 0, len(data)) if kind == b"mdat")
    for track in tracks:
        inside = mdat[0] <= track.get("first_offset", -1) < mdat[1] and mdat[0] <= track.get("last_offset", -1) < mdat[1]
        print({key: value for key, value in track.items()}, "offsets inside mdat:", inside)


if __name__ == "__main__":
    main()
