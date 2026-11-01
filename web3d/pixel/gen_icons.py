# /// script
# dependencies = ["pillow==12.1.0"]
# ///
"""The favicon and touch icon: the career building as a tiny mark, with its crane and the six job floors' accents.

Run: uv run web3d/pixel/gen_icons.py [static]

16 and 32 are drawn on their own grids, because a downscaled 32 turns to mud at 16. favicon.ico carries both. head.html
gives browsers only the 96 png, which they scale for the tab, so it is the 16 at x6: exact at 16, crisp at 32. 180 is
the 32 with a 2-cell margin (iOS rounds the corners) at x5, so no pixel is resampled. The tile is opaque: a dark mark on
nothing would vanish on a dark tab strip.
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_floors as G  # noqa: E402  (module level only defines data; main is guarded)

BG = (0x0c, 0x0e, 0x14)                                 # .px-skin, theme-color and the manifest
FLOORS = ["coral", "violet", "cyan", "amber", "blue", "mint"]   # storeys 7 to 2, data/floor_accents.yaml
LIT, DIM = 4, 3                                         # the accent is step 4 of each ramp
CRANE = G.R["amber"][4]


def tile(size):
    return Image.new("RGB", (size, size), BG)


def fill(img, x0, y0, x1, y1, c):
    img.paste(c, (x0, y0, x1 + 1, y1 + 1))


def mark16():
    im = tile(16)
    fill(im, 2, 2, 12, 2, CRANE)                        # jib
    fill(im, 7, 1, 7, 4, CRANE)                         # mast
    fill(im, 3, 3, 3, 3, G.R["steel"][4])               # hook
    for i, ramp in enumerate(FLOORS):
        y = 5 + i * 2
        fill(im, 4, y, 11, y, G.R[ramp][LIT])
        fill(im, 4, y + 1, 11, y + 1, G.R["dark"][2])
    return im


def mark32():
    im = tile(32)
    fill(im, 4, 3, 26, 4, CRANE)                        # jib
    fill(im, 14, 1, 15, 6, CRANE)                       # mast
    fill(im, 22, 2, 26, 2, G.R["amber"][2])             # counterweight
    fill(im, 6, 5, 6, 7, G.R["steel"][4])               # hook
    fill(im, 5, 8, 7, 8, G.R["steel"][3])
    fill(im, 8, 7, 23, 31, G.R["dark"][2])              # the tower's frame
    for i, ramp in enumerate(FLOORS):
        y = 8 + i * 4
        fill(im, 9, y, 22, y + 2, G.R[ramp][DIM])
        fill(im, 9, y, 22, y, G.R[ramp][LIT])
        for x in (11, 15, 19):                          # windows
            fill(im, x, y + 1, x + 1, y + 2, G.R["dark"][0])
    return im


def build(root):
    m16, m32 = mark16(), mark32()
    m16.resize((96, 96), Image.NEAREST).save(root / "images/favicon.png")
    framed = tile(36)
    framed.paste(m32, (2, 2))
    framed.resize((180, 180), Image.NEAREST).save(root / "images/apple-touch-icon.png")
    ico = root / "favicon.ico"
    m32.save(ico, sizes=[(16, 16), (32, 32)], append_images=[m16])   # append_images keeps the 16 from being downsampled
    with Image.open(ico) as got:
        assert got.info["sizes"] == {(16, 16), (32, 32)}, got.info["sizes"]
        got.size = (16, 16)
        got.load()
        assert got.convert("RGB").tobytes() == m16.tobytes(), "the 16 frame is not the drawn one"


if __name__ == "__main__":
    build(Path(sys.argv[1] if len(sys.argv) > 1 else "static"))
