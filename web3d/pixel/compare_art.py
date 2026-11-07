# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
# ///
"""Compare a fresh build of the art with the committed files, pixel by pixel: the bytes of a lossless WebP can differ
between encoder runs while every pixel is the same, so a byte compare would fail for nothing.

Run: uv run web3d/pixel/compare_art.py NEW [OLD]   # OLD defaults to static/building/pixel

Fails when a picture in OLD (WebP, or the city's depth map, a PNG) is missing from NEW or differs in size or in any pixel,
or when one of its JSON files is missing from NEW or differs. OLD can be any folder of baked art (CI compares the blog
covers' and the icons' this way too); one with no JSON compares only its pictures.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops


def differ(a, b):
    """Where two RGBA pictures differ in any channel, or None. getbbox() alone looks only at alpha for an RGBA image,
    so it would pass any change of colour in opaque art."""
    return ImageChops.difference(a, b).getbbox(alpha_only=False)


def main(new, old):
    a = Image.new("RGBA", (3, 3), (10, 20, 30, 255))
    b = a.copy()
    b.putpixel((1, 1), (11, 20, 30, 255))
    assert differ(a, b) == (1, 1, 2, 2) and differ(a, a) is None, "the compare misses a one-pixel change of colour"
    problems, count = [], 0
    for path in sorted([*old.glob("*.webp"), *old.glob("*.png")]):
        fresh = new / path.name
        if not fresh.exists():
            problems.append(f"{path.name}: not rebuilt")
            continue
        with Image.open(path) as committed, Image.open(fresh) as rebuilt:
            a, b = committed.convert("RGBA"), rebuilt.convert("RGBA")
            if a.size != b.size:
                problems.append(f"{path.name}: {b.size} rebuilt, {a.size} committed")
            elif box := differ(a, b):
                pixels = sum(map(any, ImageChops.difference(a, b).get_flattened_data()))
                problems.append(f"{path.name}: {pixels} pixels differ in {box}")
        count += 1
    jsons = sorted(path.name for path in old.glob("*.json"))
    for name in jsons:
        if not (new / name).exists():
            problems.append(f"{name}: not rebuilt")
        elif json.loads((new / name).read_text()) != json.loads((old / name).read_text()):
            problems.append(f"{name}: differs")
    if problems:
        sys.exit("The art does not rebuild as committed:\n" + "\n".join(f"- {p}" for p in problems))
    print(f"The art rebuilds pixel for pixel: {count} pictures and {', '.join(jsons) or 'no JSON'}.")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2] if len(sys.argv) > 2 else "static/building/pixel"))
