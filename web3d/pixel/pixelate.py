# /// script
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Turn a room painting into pixel art on the site's palette (no model). Adapted from Before Dark's pixelate.py.

uv run web3d/pixel/pixelate.py SRC.png OUT.png [--size 376x154] [--colours 32]

Pipeline: median (kill painterly grain) -> BOX downscale -> pick this picture's colour budget (k-means in Lab,
snapped to the palette) -> nearest colour in Lab -> the painting's dark ink lines forced to the outline colour ->
lone-pixel cleanup. The palette is gen_floors.R (the rooms' ramps) plus its outline, so painted rooms and
code-drawn props share colours, and gen_floors' lighting pass can shift painted pixels along their ramps.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_floors as G  # noqa: E402  (module level only defines data; main is guarded)


def palette():
    return np.array(sorted({c for ramp in G.R.values() for c in ramp} | {G.INK}), dtype=np.float64)


def lab(rgb):
    """sRGB 0..255 (..., 3) -> CIELAB D65."""
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def nearest(img, pal):
    L = lab(np.asarray(img, dtype=np.float64))
    return ((L[:, :, None, :] - lab(pal)[None, None]) ** 2).sum(-1).argmin(-1)


def budget(small, pal, k, keep=()):
    """The k colours this picture needs: seeded k-means++ in Lab, each centre snapped to the palette, plus the outline
    and the `keep` colours (a floor keeps the lobby's, so the wall and planks match it across the seam)."""
    X = lab(np.asarray(small, dtype=np.float64)).reshape(-1, 3)
    rng = np.random.default_rng(1)
    C = X[rng.choice(len(X), 1)]
    for _ in range(k - 1):
        d = ((X[:, None] - C[None]) ** 2).sum(-1).min(1)
        C = np.vstack([C, X[rng.choice(len(X), 1, p=d / d.sum())]])
    for _ in range(12):
        a = ((X[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([X[a == i].mean(0) if (a == i).any() else C[i] for i in range(k)])
    picked = set(((C[:, None] - lab(pal)[None]) ** 2).sum(-1).argmin(1))
    picked.add(int(np.argmin(((pal - np.array(G.INK)) ** 2).sum(-1))))
    return np.vstack([pal[sorted(picked)], np.array(keep, dtype=np.float64).reshape(-1, 3)])


def ink_mask(src, size):
    """Cells mostly covered by the painting's dark, locally-darker linework."""
    g = np.asarray(src.convert("L"), dtype=np.float64)
    local = np.asarray(src.convert("L").filter(ImageFilter.GaussianBlur(6)), dtype=np.float64)
    dark = ((g < 40) & (g < local - 18)) | (g < 18)
    cover = Image.fromarray((dark * 255).astype(np.uint8)).resize(size, Image.BOX)
    return np.asarray(cover) > 100


def cleanup(idx, pal):
    """A pixel unlike all 8 neighbours takes their most common colour, unless it stands out in lightness (a glint)."""
    P = lab(pal)
    out = idx.copy()
    h, w = idx.shape
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            nb = np.delete(idx[y - 1:y + 2, x - 1:x + 2].ravel(), 4)
            if (nb == idx[y, x]).any():
                continue
            vals, counts = np.unique(nb, return_counts=True)
            top = vals[counts.argmax()]
            if abs(P[top, 0] - P[idx[y, x], 0]) < 14:
                out[y, x] = top
    return out


def pixelate(src, size, colours=32, keep=()):
    src = src.convert("RGB")
    small = src.filter(ImageFilter.MedianFilter(5)).resize(size, Image.BOX)
    pal = budget(small, palette(), colours, keep) if colours else palette()
    idx = nearest(small, pal)
    idx[ink_mask(src, size)] = int(np.argmin(((pal - np.array(G.INK)) ** 2).sum(-1)))
    return Image.fromarray(pal[cleanup(idx, pal)].astype(np.uint8), "RGB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--size", default="376x154")
    ap.add_argument("--colours", type=int, default=32)
    a = ap.parse_args()
    w, h = map(int, a.size.split("x"))
    im = pixelate(Image.open(a.src), (w, h), a.colours)
    im.save(a.out)
    print(a.out, im.size, "colours:", len({tuple(p) for p in np.asarray(im).reshape(-1, 3)}))


BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16


def dither_bands(img, rows, probe_x):
    """Repaint a sky's flat bands as one even gradient through the same colours, in an ordered (Bayer) dither: the
    classic pixel-art sky. The bands are read down one clear column; only pixels of those colours are repainted,
    so whatever stands against the sky (cranes, roofs, flags) stays as it is."""
    a = np.asarray(img).copy()
    runs = []                                                             # (colour, centre row) down the probe column
    y = 0
    while y < rows:
        c, y0 = tuple(a[y, probe_x]), y
        while y < rows and tuple(a[y, probe_x]) == c:
            y += 1
        if y - y0 >= 3 and (not runs or runs[-1][0] != c):
            runs.append((c, (y0 + y - 1) / 2))
    sky = {c for c, _ in runs}
    h, w = a.shape[:2]
    for y in range(rows):
        i = max([k for k, (_, m) in enumerate(runs) if m <= y], default=0)
        if i + 1 < len(runs) and y >= runs[0][1]:
            t = (y - runs[i][1]) / (runs[i + 1][1] - runs[i][1])
        else:
            t = 0
        for x in range(w):
            if tuple(a[y, x]) in sky:
                a[y, x] = runs[i + 1][0] if t > BAYER[y % 4, x % 4] else runs[i][0]
    return Image.fromarray(a, "RGB")
