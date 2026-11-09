"""What the art scripts share, with Pillow alone at import (numpy, where a helper needs it, inside that helper): the paths,
the panoramas' size, the palette of what is drawn in code, the Draw Things call, the magenta key and the reduce of a
sprite, the mends pasted over a pick, a painting's glass and its relighting at another hour, and the lossless save.

New keys in the JSON the pages read give a box as [x0, y0, x1, y1] in art px, as the scenes' FX do.
"""
import base64
import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

PIXEL = Path(__file__).resolve().parent
ROOT = PIXEL.parents[1]                       # the repository
PAINTINGS = PIXEL / "paintings"
CANDIDATES = PAINTINGS / "candidates"         # what Draw Things painted (only the picks' inputs are committed)
PICKS = PAINTINGS / "picks"                   # what the bakes read
OUT = ROOT / "static" / "building" / "pixel"  # where every bake writes unless told otherwise

# The panoramas (the city, Workshop Row, the Library and the rooms): painted PW x PH, a 4:1 blockout of H rows; Draw Things
# paints whole 64s, and the city's pick 700's last 32 rows are black. Baked ART_W wide on COLOURS colours.
PW, H = 3456, 864
PH = H // 64 * 64
ART_W, COLOURS = 1440, 64
SIZE = [ART_W, round(ART_W * PH / PW)]


def ramp(*hexes):
    return [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in hexes]


# The palette of what is drawn in code (the floors' slabs, lights, screens), the accents and the icons (gen_icons.py). The
# paintings, and the covers baked from them, keep their own colours.
R = {
    "wall": ramp("#2a2226", "#3d3034", "#574447", "#77605c", "#9a8072", "#bfa58c"),
    "wood": ramp("#24170f", "#3b2618", "#583a22", "#7a5530", "#9e7441", "#c39a5c"),
    "plank": ramp("#1f1610", "#33231a", "#4c3526", "#6a4b35", "#8a6446", "#ac8159"),
    "dark": ramp("#0d0f14", "#151923", "#1f2532", "#2b3344", "#3b4559", "#505d74"),
    "amber": ramp("#3a2208", "#6a3f0c", "#a0640f", "#d38f1b", "#f2b13b", "#ffd77a"),
    "steel": ramp("#1c2026", "#30363e", "#4a525c", "#6d7782", "#97a2ac", "#c9d1d7"),
    "chalk": ramp("#141c18", "#1e2a24", "#2b3a32", "#3d5046", "#5a7064", "#8aa294"),
    "plant": ramp("#0f1f16", "#173222", "#22482f", "#2f613e", "#43804f", "#68a466"),
    "cream": ramp("#3a3530", "#5d564d", "#857c70", "#ada395", "#d3cabb", "#f2ece0"),
    "sky": ramp("#141a33", "#232a4d", "#3b3f6a", "#5d5a86", "#8e78a0", "#d79a9c"),
    "red": ramp("#2a0d0f", "#4a1418", "#73201f", "#a03227", "#c94f33", "#e7794a"),
    "blue": ramp("#0f1a2e", "#17284a", "#21406f", "#2f5c96", "#4f86c0", "#86b6e0"),
    "cyan": ramp("#08262c", "#0d3f49", "#126470", "#1c94a0", "#3fc6cf", "#9cf0f2"),
    "violet": ramp("#1b1230", "#2c1c4f", "#47307a", "#6a4fa8", "#9b7bff", "#cdbcff"),
    "magenta": ramp("#2a0f33", "#4a1757", "#74228a", "#a332b8", "#d04ee0", "#f09af5"),
    "coral": ramp("#2c0f0e", "#521b18", "#7f2c24", "#b44434", "#ff6b5a", "#ffb0a2"),
    "mint": ramp("#0e211b", "#183b30", "#24594a", "#3a8068", "#62b08e", "#a9dcc2"),
    "grey": ramp("#1a1c1f", "#2e3136", "#484c52", "#6a6f76", "#9499a0", "#c8ccd1"),
}
assert len({c for r in R.values() for c in r}) == sum(len(r) for r in R.values()), "two ramps share a colour"
INK = (10, 11, 16)                                  # outlines
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def name(phase, winter=False, stem="city"):
    """city, city-night, city-winter, city-winter-night: the season, then the hour, each left out at its default. Workshop
    Row's (stem "workshop", painted by gen_workshop.py) are named the same way."""
    return f"{stem}{'-winter' if winter else ''}{'' if phase == 'dusk' else '-' + phase}"


def pick(phase, winter=False, stem="city"):
    path = PICKS / f"{name(phase, winter, stem)}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint it (gen_{stem}.py paint --time {phase}{' --winter' if winter else ''}), copy the chosen candidate there and note its seed in {'WINTER_PICKS' if winter else 'PICKS'}")
    return path


def call(host, path, payload, timeout=4 * 3600):   # a shared queue can hold a job long
    req = urllib.request.Request(host + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def paint_candidate(path, prompt, size, seed, host, init=None, timeout=4 * 3600, extra=None):
    """One candidate from Draw Things, kept if painted already (the model does not redraw a seed bit for bit): txt2img,
    or with `init` (a picture, or a PNG's bytes as they are) an img2img edit of it; `extra`, more of the job's settings
    (paint_rooms.PINNED). Written as the model sent it."""
    if path.exists():
        print("kept", path.name)
        return
    job = {"prompt": prompt, "width": size[0], "height": size[1], "seed": seed, "batch_size": 1} | (extra or {})
    if init is not None:
        if isinstance(init, Image.Image):
            buf = io.BytesIO()
            init.save(buf, "PNG")
            init = buf.getvalue()
        job |= {"strength": 1.0, "init_images": [base64.b64encode(init).decode()]}
    res = call(host, "/sdapi/v1/img2img" if init is not None else "/sdapi/v1/txt2img", job, timeout)
    path.write_bytes(base64.b64decode(res["images"][0].split(",")[-1]))
    print("painted", path.name, flush=True)


def magenta(a, also=False):
    """Where a painting on magenta (an int RGB array) shows its backdrop, a magenta gradient: green far under red and
    blue, both bright. `also` adds a subject's own fringe (lamp-lit pinks and corals), under the same brightness test."""
    import numpy as np   # here only: the Pillow-only scripts import this module
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return ((g < 0.55 * np.minimum(r, b)) | also) & (r > 60) & (b > 60)


def key(a, bg, shrink):
    """An int RGB array as an RGBA picture, clear where bg (a bool array: its backdrop, as magenta() finds it) is, the
    clear grown `shrink` px across (a min filter) so none of the backdrop's fringe is left."""
    im = Image.fromarray(a.astype("uint8"), "RGB")
    im.putalpha(Image.fromarray(((~bg) * 255).astype("uint8")).filter(ImageFilter.MinFilter(shrink)))
    return im


def reduce(im, size, colours=32, cut=80):
    """An RGBA picture box-reduced to `size` (premultiplied, so no halo) on `colours` colours, its edge hard at alpha `cut`."""
    sm = im.convert("RGBa").resize(size, Image.BOX).convert("RGBA")
    rgb = sm.convert("RGB").quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    rgb.putalpha(sm.getchannel("A").point(lambda v: 255 if v > cut else 0))
    return rgb


def patched(im, names):
    """im with each patch (patch_picks.py) pasted: its file in picks/, an RGBA crop whose alpha is its feathered mask, at
    the place it was cut from, which its PNG keeps as its "at" text ("x,y")."""
    for patch in names:
        with Image.open(PICKS / patch) as png:
            at, crop = tuple(int(v) for v in png.info["at"].split(",")), png.convert("RGBA")
        im.paste(crop, at, crop)
    return im


def bake(src, patches=(), size=SIZE, keep=(), kept=6):
    """A panorama's painting (a path, or a picture) box-reduced to `size`, on its own COLOURS colours: the city's pixel
    look, undithered. A few k-means passes after the median cut, as plain median cut spends no colour on small lamps (the
    Library's green ones). `keep`, boxes in painting px whose own `kept` colours are cut first and kept, the rest of the
    palette cut from the whole: under snow, the median cut spent the Library's lamp greens on the white."""
    im = patched((src.copy() if isinstance(src, Image.Image) else Image.open(src)).convert("RGB"), patches).crop((0, 0, PW, PH))
    small = im.resize(size, Image.BOX)
    cut = {"method": Image.Quantize.MEDIANCUT, "dither": Image.Dither.NONE}
    if not keep:
        return small.quantize(COLOURS, kmeans=3, **cut).convert("RGB")
    k = size[0] / PW
    boxes = [small.crop(tuple(round(v * k) for v in box)) for box in keep]
    strip = Image.new("RGB", (sum(b.width for b in boxes), max(b.height for b in boxes)))
    x = 0
    for b in boxes:
        strip.paste(b, (x, 0))
        x += b.width
    colours = lambda q: [tuple(q.getpalette()[3 * i:3 * i + 3]) for _, i in sorted(q.getcolors())]
    own = colours(strip.quantize(kept, kmeans=3, **cut))
    rest = colours(small.quantize(COLOURS - len(own), kmeans=3, **cut))
    pal = Image.new("P", (1, 1))
    pal.putpalette([v for c in own + rest for v in c] + [0, 0, 0] * (256 - len(own) - len(rest)))
    return small.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB")


def glass(im, panes=(), arches=(), fronts=(), lamps=(), bars=False):
    """The mask of a painting's window glass, softened a pixel: its panes (boxes) and arches (ellipses), but what stands
    in front of them (boxes), the dark wood of its mullions and bars where it has them, grown 2 px so none of an edit's
    frame shows, and in front of a lamp's box only the lamp (its brass, glow and chain), not the sky round it. In
    painting px."""
    import numpy as np
    mask = Image.new("L", im.size)
    d = ImageDraw.Draw(mask)
    for box in panes:
        d.rectangle(box, fill=255)
    for box in arches:
        d.ellipse(box, fill=255)
    for box in fronts:
        d.rectangle(box, fill=0)
    a = np.asarray(im.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.asarray(mask) > 0
    if bars:
        wood = Image.fromarray(((r - b > 30) & (r + g + b < 290) & (r >= g)).astype(np.uint8) * 255)
        m &= ~(np.asarray(wood.filter(ImageFilter.MaxFilter(5))) > 0)
    lamp = (r - b > 70) | (r + g + b < 200)
    for x0, y0, x1, y1 in lamps:
        m[y0:y1, x0:x1] &= ~lamp[y0:y1, x0:x1]
    return Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))


def blur(a, sigma):
    """A float array (height, width, channels) blurred by about a gaussian of `sigma`: three box passes each way."""
    import numpy as np
    k = round((4 * sigma ** 2 + 1) ** 0.5) | 1
    for axis in (0, 1):
        for _ in range(3):
            pad = np.pad(a, [(k // 2 + 1, k // 2) if ax == axis else (0, 0) for ax in range(a.ndim)], mode="edge")
            c = np.cumsum(pad, axis=axis)
            a = (np.take(c, range(k, c.shape[axis]), axis=axis) - np.take(c, range(c.shape[axis] - k), axis=axis)) / k
    return a


def relit(dusk, retimed, glass, sigma=16, gain=(0.1, 4.0)):
    """The dusk painting in the light of `retimed`, the model's edit of it to another hour: each pixel scaled by the ratio
    of the two blurred (sigma, painting px: the light, not the shapes), the glass (a mask) left out of both, as another
    view goes there. The drawing stays the dusk one to the pixel, so what is drawn over it (FX, depth maps, a sheet cut from
    it) keeps its place: the model moves shapes when it relights a room. The gain is capped as a whole, one factor for all
    three channels, so the hour's colour holds (capped one by one, dark warm wood in daylight went orange), and the
    lights (the lamps, a fire) keep theirs."""
    import numpy as np
    D, B = np.asarray(dusk.convert("RGB"), float), np.asarray(retimed.convert("RGB"), float)
    w = 1 - np.asarray(glass, float)[..., None] / 255
    g = (blur(B * w, sigma) + 4) / (blur(D * w, sigma) + 4)
    g = g * np.minimum(1, gain[1] / g.max(-1, keepdims=True))
    g = g * np.maximum(1, gain[0] / g.min(-1, keepdims=True))
    lit = np.clip((D.max(-1, keepdims=True) - 200) / 40, 0, 1)
    g = g + (np.maximum(g, 1) - g) * lit
    return Image.fromarray(np.clip(D * g, 0, 255).round().astype(np.uint8))


def save_lossless(im, path):
    """Write the art as small as it goes without changing a pixel (#184): lossless WebP for a .webp path, else a PNG
    indexed on the picture's own colours (the art has well under 256). Read back and checked before it returns."""
    path = Path(path)
    ref = im.convert("RGBA" if "A" in im.getbands() or "transparency" in im.info else "RGB")
    if path.suffix == ".webp":
        ref.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)   # exact: keeps a clear pixel's colour
    elif colours := ref.getcolors(256):
        pal = [c for _, c in colours]
        index = {c: i for i, c in enumerate(pal)}
        p = Image.new("P", ref.size)
        p.putdata([index[c] for c in ref.get_flattened_data()])
        p.putpalette([v for c in pal for v in c], rawmode=ref.mode)
        p.save(path, optimize=True)
    else:
        ref.save(path, optimize=True)
    with Image.open(path) as back:
        assert back.convert("RGBA").tobytes() == ref.convert("RGBA").tobytes(), f"{path} does not read back as drawn"
