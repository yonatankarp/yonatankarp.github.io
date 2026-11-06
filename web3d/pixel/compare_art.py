# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
# ///
"""Compare a fresh build of the art with the committed files, pixel by pixel: the bytes of a lossless WebP can differ
between encoder runs while every pixel is the same, so a byte compare would fail for nothing.

Run: uv run web3d/pixel/compare_art.py NEW [OLD]   # OLD defaults to static/building/pixel

Fails when a picture in OLD is missing from NEW or differs in size or in any pixel, or when exterior.json, city.json or workshop.json differs.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops


def main(new, old):
    problems, count = [], 0
    for path in sorted(old.glob("*.webp")):
        fresh = new / path.name
        if not fresh.exists():
            problems.append(f"{path.name}: not rebuilt")
            continue
        with Image.open(path) as committed, Image.open(fresh) as rebuilt:
            a, b = committed.convert("RGBA"), rebuilt.convert("RGBA")
            if a.size != b.size:
                problems.append(f"{path.name}: {b.size} rebuilt, {a.size} committed")
            elif box := ImageChops.difference(a, b).getbbox():
                problems.append(f"{path.name}: pixels differ in {box}")
        count += 1
    for name in ("exterior.json", "city.json", "workshop.json"):
        if json.loads((new / name).read_text()) != json.loads((old / name).read_text()):
            problems.append(f"{name}: differs")
    if problems:
        sys.exit("The art does not rebuild as committed:\n" + "\n".join(f"- {p}" for p in problems))
    print(f"The art rebuilds pixel for pixel: {count} pictures, exterior.json, city.json and workshop.json.")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2] if len(sys.argv) > 2 else "static/building/pixel"))
