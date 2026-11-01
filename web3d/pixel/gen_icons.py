# /// script
# dependencies = ["pillow==12.1.0"]
# ///
"""The favicon and touch icon: the career building at dusk, a tiny lit tower under its crane.

Run: uv run web3d/pixel/gen_icons.py [static]

Every size is placed by hand on the site's palette, because a shrunken tower turns to mud. head.html gives browsers the
96 png and they scale it for the tab, so it is the 16 at x6: exact at 16, crisp at 32. favicon.ico carries the 16 and the
32. The touch icon is a 36 grid at x5, opaque (iOS fills transparency with black) and full bleed, since iOS rounds it.
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_floors as G  # noqa: E402  (module level only defines data; main is guarded)

R, INK = G.R, G.INK
SKY = [R["magenta"][2], R["violet"][3], R["sky"][4], R["sky"][5]]   # top to horizon, as on exterior.png
BRIGHT, LIT, DIM = R["amber"][5], R["amber"][4], R["amber"][2]
CRANE, CRANE_HI, CRANE_LO = R["amber"][4], R["amber"][5], R["amber"][3]
KEY = {".": None, "k": INK, "A": BRIGHT, "a": LIT, "e": DIM, "d": CRANE_LO, "t": R["steel"][4],
       "m": SKY[0], "v": SKY[1], "s": SKY[2], "p": SKY[3]}
MARK16 = [
    ".mmmmmmmmammmmm.",
    "mmaaaaaaaaaaaaam",
    "mmmtmmmmmaddmmmm",
    "mmmAmmmmmammmmmm",
    "vvvkkkkkkkkkkvvv",
    "vvvkAAkaakaakvvv",
    "vvvkkkkkkkkkkvvv",
    "vvvkaakeekAAkvvv",
    "ssskkkkkkkkkksss",
    "ssskeekaakaaksss",
    "pppkkkkkkkkkkppp",
    "pppkaakAAkeekppp",
    "pppkkkkkkkkkkppp",
    "pppkaakaakAAkppp",
    "pppkkkkkkkkkkppp",
    ".kkkkkkkkkkkkkk.",
]
WINDOWS = ["baa", "aeb", "eaa", "abe", "aab", "aea"]    # storeys 7 to 2 of the big tower: bright, lit or dark


def from_map(rows):
    im = Image.new("RGBA", (len(rows[0]), len(rows)))
    im.putdata([(*KEY[c], 255) if KEY[c] else (0, 0, 0, 0) for row in rows for c in row])
    return im


def fill(im, x0, y0, x1, y1, c):
    im.paste((*c, 255), (x0, y0, x1 + 1, y1 + 1))


def tower(size):
    """The 32 and 36 grids: the same tower standing on the bottom edge, the bigger one with more sky around it."""
    im = Image.new("RGBA", (size, size))
    o, top = (size - 32) // 2, size - 32
    for y in range(size):                               # the sky's bands in an ordered dither, as on exterior.png
        t = max(0, y - top) / 24 * (len(SKY) - 1)
        i = min(int(t), len(SKY) - 2)
        for x in range(size):
            im.putpixel((x, y), (*SKY[i + (t - i > G.BAYER[y % 4][x % 4] / 16)], 255))
    x, y = o, top
    fill(im, x + 22, y + 0, x + 23, y + 9, CRANE_LO)    # mast
    fill(im, x + 22, y + 0, x + 22, y + 9, CRANE)
    fill(im, x + 3, y + 3, x + 28, y + 3, CRANE_HI)     # jib
    fill(im, x + 3, y + 4, x + 28, y + 4, CRANE)
    for k in range(4, 28, 3):                           # its lattice
        fill(im, x + k, y + 4, x + k, y + 4, CRANE_LO)
    fill(im, x + 25, y + 5, x + 28, y + 6, R["steel"][2])   # counterweight
    fill(im, x + 6, y + 5, x + 6, y + 7, INK)           # cable and hook
    fill(im, x + 5, y + 8, x + 7, y + 9, CRANE_LO)
    fill(im, x + 7, y + 10, x + 24, y + 31, INK)        # the tower, its brick inside an outline
    fill(im, x + 8, y + 11, x + 23, y + 29, R["red"][1])
    fill(im, x + 6, y + 10, x + 25, y + 10, R["steel"][4])  # roof
    fill(im, 0, y + 30, size - 1, y + 31, INK)          # street
    for row, lit in enumerate(WINDOWS):
        wy = y + 12 + row * 3
        for col, kind in enumerate(lit):
            wx = x + 9 + col * 5
            fill(im, wx, wy, wx + 3, wy + 1, {"b": BRIGHT, "a": LIT, "e": DIM}[kind])
            if kind == "a":
                fill(im, wx, wy + 1, wx + 3, wy + 1, CRANE_LO)
    return im


def build(root):
    m16, m32, m36 = from_map(MARK16), tower(32), tower(36)
    m16.resize((96, 96), Image.NEAREST).save(root / "images/favicon.png")
    m36.convert("RGB").resize((180, 180), Image.NEAREST).save(root / "images/apple-touch-icon.png")
    ico = root / "favicon.ico"
    m32.save(ico, sizes=[(16, 16), (32, 32)], append_images=[m16])   # append_images keeps the 16 from being resampled
    with Image.open(ico) as got:
        assert got.info["sizes"] == {(16, 16), (32, 32)}, got.info["sizes"]
        for size, want in ((16, m16), (32, m32)):
            got.size = (size, size)
            got.load()
            assert got.convert("RGBA").tobytes() == want.tobytes(), f"the {size} frame is not the drawn one"
    assert Image.open(root / "images/apple-touch-icon.png").mode == "RGB", "the touch icon must be opaque"


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "static")
