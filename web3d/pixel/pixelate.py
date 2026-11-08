# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Turn a painting into the blog's pixel art (no model): its covers and the art inside a post.

uv run web3d/pixel/pixelate.py SRC OUT [--size 960x540] [--colours 64] [--line-art]

bake() is the city's and the Library's bake (gen_library.bake): BOX downscale, then this picture's own colours by median
cut with a few k-means passes, undithered. A 3px median first takes the cover JPEGs' block noise out, which a near 1:1
reduction would otherwise keep as speckle. --line-art swaps the median for a 3px min filter, so a diagram's thin lines
thicken instead of vanishing in the box.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_common import save_lossless  # noqa: E402


def bake(src, size, colours=64, line_art=False):
    src = src.convert("RGB").filter(ImageFilter.MinFilter(3) if line_art else ImageFilter.MedianFilter(3))
    return src.resize(size, Image.BOX).quantize(colours, method=Image.Quantize.MEDIANCUT, kmeans=3,
                                                 dither=Image.Dither.NONE).convert("RGB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--size", default="960x540")
    ap.add_argument("--colours", type=int, default=64)
    ap.add_argument("--line-art", action="store_true", help="thin-line diagrams: thicken lines, no median")
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    im = bake(Image.open(a.src), (w, h), a.colours, a.line_art)
    save_lossless(im, a.out)
    print(a.out, im.size, "colours:", len({tuple(p) for p in np.asarray(im).reshape(-1, 3)}))
