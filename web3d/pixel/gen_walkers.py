# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""The painted people: six on Workshop Row's pavement (web3d/src/workshop-fx.js), each an 8-frame walk cycle, and three
of them in the Library (library-fx.js), who also stand at a shelf, reach up, take a book and read it.

Run: uv run web3d/pixel/gen_walkers.py pose                  # the 8 walk poses and 4 browse poses, from a skeleton on magenta
     uv run web3d/pixel/gen_walkers.py paint [NAME...]       # Draw Things repaints each walk pose as that person (port 7860)
     uv run web3d/pixel/gen_walkers.py browse [NAME...]      # ... and each browse pose, for the Library's readers
     uv run web3d/pixel/gen_walkers.py bake [OUT]            # OUT/walkers.webp + .json, and OUT/readers.webp + .json

The poses go to web3d/pixel/paintings/candidates/walkers/walk_K_pose.png and the paintings beside them as NAME_K.png
(not committed); a person's chosen frames are copied to web3d/pixel/paintings/picks/walkers/NAME_K.png, the bake's input,
and the browse poses to NAME_browse_KIND.png.
Every frame of a person is painted with the same seed and prompt, so the eight stay one person. The bake keys the magenta
out, eats its pink fringe, scales the person to PERSON (READER) art px tall (premultiplied, so no halo) on 32 colours, and lays the
people out as rows of one sheet, a frame per column, all standing on the same foot row.
"""
import argparse
import base64
import io
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint_rooms import OUT as CANDIDATES, call  # noqa: E402

PAINTED = CANDIDATES / "walkers"
PICKED = Path(__file__).resolve().parent / "paintings" / "picks" / "walkers"
FRAMES = 8
W, H = 384, 768                 # the painting's size per frame; the figure stands on the line at FOOT
FOOT, U = 700, 17.0             # the ground line, and pixels per skeleton unit (a person is ~36 units tall)
PERSON = 60                     # art px tall on the street: against its roller doors (~100) and lamp posts (~133)
READER = 135                    # art px tall in the Library, in front of its bookcases
BROWSE = ["stand", "reach", "take", "read"]   # a reader at a shelf, in order (library-fx.json times each)
READERS = ["blue", "mustard", "tote"]


def stride(person):
    """Art px of ground one walk cycle covers, so the feet do not slide."""
    return round(person * 0.86)

MAGENTA = (255, 0, 255)
SKIN, HAIR, TOP, BOTTOM, SHOE, BOOK = (225, 180, 145), (60, 40, 28), (40, 90, 150), (45, 52, 70), (30, 22, 18), (120, 40, 30)
PEOPLE = {   # name: (seed, how they look)
    "blue": (1300, "a man with short dark brown hair, a blue jacket, dark grey trousers and dark shoes"),
    "red": (1317, "a woman with long auburn hair in a red wool coat, black trousers and dark ankle boots"),
    "trench": (1334, "an older man with short grey hair, a beige trench coat, a brown scarf, brown trousers and brown shoes"),
    "hoodie": (1351, "a young man with curly black hair, a green hoodie, a small grey backpack, blue jeans and white sneakers"),
    "mustard": (1368, "a woman with dark brown skin and short black hair, a mustard yellow jacket, blue jeans and dark shoes"),
    "tote": (1385, "a woman with a blonde ponytail, a white shirt, black trousers, black shoes and a canvas tote bag on her shoulder"),
}
PROMPT = ("Edit this picture. Repaint the figure as one ordinary adult pedestrian walking to the right, seen exactly from "
          "the side, in highly detailed painterly video game art: {look}, natural proportions, warm golden dusk light from "
          "the left, soft shading. Keep the exact pose, "
          "the exact position and size of every limb and of the head. Keep the background perfectly flat solid magenta. "
          "One person only, no text, no shadow on the ground.")


def limb(d, a, b, w, col):
    d.line([a, b], fill=col, width=int(w * U))
    r = w * U / 2
    for x, y in (a, b):
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)


def pose(ph):
    """One phase of the gait, facing right: the legs and arms swing against each other, the body bobs, and the far arm
    and leg are darker, behind the body."""
    im = Image.new("RGB", (W, H), MAGENTA)
    d = ImageDraw.Draw(im)
    x, g = W / 2, FOOT
    bob = -abs(math.sin(ph)) * 1.2 * U
    hip = (x, g - 17.5 * U + bob)
    sh = (x + .8 * U, hip[1] - 11 * U)

    def dark(c):
        return tuple(int(v * .7) for v in c)

    def leg(a, col):
        th = .42 * math.sin(a)
        s = th - .75 * max(0, math.cos(a)) * (1 if math.sin(a) < .3 else .2)
        k = (hip[0] + math.sin(th) * 8.5 * U, hip[1] + math.cos(th) * 8.5 * U)
        f = (k[0] + math.sin(s) * 9 * U, min(g, k[1] + math.cos(s) * 9 * U))
        limb(d, hip, k, 3.2, col)
        limb(d, k, f, 3, col)
        limb(d, (f[0] - .5 * U, f[1] - U), (f[0] + 3 * U, f[1] - U), 2, SHOE)

    def arm(a, col, hand):
        sw = -.38 * math.sin(a)
        e = (sh[0] + math.sin(sw) * 6.5 * U, sh[1] + U + math.cos(sw) * 6.5 * U)
        fa = sw - .35
        hnd = (e[0] + math.sin(fa) * 5.5 * U, e[1] + math.cos(fa) * 5.5 * U)
        limb(d, (sh[0], sh[1] + U), e, 3, col)
        limb(d, e, hnd, 2.6, col)
        limb(d, hnd, (hnd[0], hnd[1] + U), 2.4, hand)

    leg(ph + math.pi, dark(BOTTOM))
    arm(ph + math.pi, dark(TOP), dark(SKIN))
    limb(d, hip, sh, 6.5, TOP)
    leg(ph, BOTTOM)
    hx, hy, r = sh[0] + .5 * U, sh[1] - 4.2 * U, 3.4 * U
    d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=SKIN)
    d.pieslice([hx - r - 2, hy - r - 2, hx + r + 2, hy + r + 2], 150, 360, fill=HAIR)   # hair over the crown and back
    arm(ph, TOP, SKIN)
    return im


def browse_pose(kind):
    """Standing still, facing right: the near arm does the work (hangs, reaches above the head, holds the book at the
    chest, holds it open), and the head bows to read."""
    im = Image.new("RGB", (W, H), MAGENTA)
    d = ImageDraw.Draw(im)
    x, g = W / 2, FOOT
    hip = (x, g - 17.5 * U)
    sh = (x + .5 * U, hip[1] - 11 * U)

    def dark(c):
        return tuple(int(v * .7) for v in c)

    def arm(e, h, col, hand):
        s = (sh[0], sh[1] + U)
        limb(d, s, e, 3, col)
        limb(d, e, h, 2.6, col)
        limb(d, h, (h[0], h[1] + U), 2.4, hand)

    for dx, col in ((-1.2, dark(BOTTOM)), (1.2, BOTTOM)):   # legs straight, a little apart
        k = (x + dx * U * .6, hip[1] + 8.5 * U)
        f = (x + dx * U, g)
        limb(d, hip, k, 3.2, col)
        limb(d, k, f, 3, col)
        limb(d, (f[0] - .5 * U, f[1] - U), (f[0] + 3 * U, f[1] - U), 2, SHOE)
    down = kind == "read"
    if down:   # the far arm helps hold the book, or hangs
        arm((sh[0] + 2.5 * U, sh[1] + 6 * U), (sh[0] + 6 * U, sh[1] + 5 * U), dark(TOP), dark(SKIN))
    else:
        arm((sh[0] - .5 * U, sh[1] + 7 * U), (sh[0], sh[1] + 12.5 * U), dark(TOP), dark(SKIN))
    limb(d, hip, sh, 6.5, TOP)
    hx, hy, r = sh[0] + (1.4 if down else .5) * U, sh[1] - (3.6 if down else 4.2) * U, 3.4 * U
    d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=SKIN)
    d.pieslice([hx - r - 2, hy - r - 2, hx + r + 2, hy + r + 2], 170 if down else 150, 380 if down else 360, fill=HAIR)
    if kind == "stand":
        arm((sh[0] + .5 * U, sh[1] + 7 * U), (sh[0] + 1 * U, sh[1] + 12.5 * U), TOP, SKIN)
    elif kind == "reach":   # up to a shelf above the head
        h = (sh[0] + 7.5 * U, sh[1] - 6.5 * U)
        arm((sh[0] + 4.5 * U, sh[1] - 3 * U), h, TOP, SKIN)
        d.rectangle([h[0] - .3 * U, h[1] - 3.5 * U, h[0] + 1.2 * U, h[1] + .5 * U], fill=BOOK)
    elif kind == "take":    # the book down at chest height
        h = (sh[0] + 6.5 * U, sh[1] + 2 * U)
        arm((sh[0] + 3 * U, sh[1] + 5 * U), h, TOP, SKIN)
        d.rectangle([h[0] - .2 * U, h[1] - 3 * U, h[0] + 1.3 * U, h[1] + 1.5 * U], fill=BOOK)
    else:                   # reading: the book open in both hands
        h = (sh[0] + 6.5 * U, sh[1] + 4.5 * U)
        arm((sh[0] + 3 * U, sh[1] + 6 * U), h, TOP, SKIN)
        d.polygon([(h[0] - 2.5 * U, h[1] - 2.5 * U), (h[0] + 2 * U, h[1] - 3.5 * U), (h[0] + 2.5 * U, h[1] + .5 * U),
                   (h[0] - 2 * U, h[1] + 1 * U)], fill=(235, 225, 200))
    return im


ACTION = {"stand": "standing still and looking ahead, arms relaxed at the sides",
          "reach": "reaching up high with one raised arm, holding a small red book above the head",
          "take": "holding a red book at chest height, just taken from the shelf",
          "read": "standing and reading an open book held in both hands, head bowed"}
# No shelf in the prompt: asked for a library, the model painted bookcases into the frames.
BROWSE_PROMPT = ("Edit this picture. Repaint the figure as one ordinary adult in a library, {action}, seen exactly from the "
                 "side facing right, in highly detailed painterly video game art: {look}, natural proportions, warm golden "
                 "lamp light, soft shading. Keep the exact pose, the exact position and size of every limb, of the head and "
                 "of the book. Keep the background perfectly flat solid magenta. One person only, no shelves, no text, no "
                 "shadow on the ground.")


def paint_browse(name, host):
    seed, look = PEOPLE[name]
    for kind in BROWSE:
        out = PAINTED / f"{name}_browse_{kind}.png"
        if out.exists():
            print("kept", out.name)
            continue
        buf = io.BytesIO()
        Image.open(PAINTED / f"browse_{kind}_pose.png").save(buf, "PNG")
        res = call(host, "/sdapi/v1/img2img", {"prompt": BROWSE_PROMPT.format(action=ACTION[kind], look=look), "width": W, "height": H,
                                               "seed": seed + (17 if kind in ("stand", "reach") else 0),   # the picked stand and reach were repainted on a fresh seed
                                               "batch_size": 1, "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        out.write_bytes(base64.b64decode(res["images"][0].split(",")[-1]))
        print("painted", out.name, flush=True)


def paint(name, host):
    seed, look = PEOPLE[name]
    for k in range(FRAMES):
        out = PAINTED / f"{name}_{k}.png"
        if out.exists():
            print("kept", out.name)
            continue
        buf = io.BytesIO()
        Image.open(PAINTED / f"walk_{k}_pose.png").save(buf, "PNG")
        res = call(host, "/sdapi/v1/img2img", {"prompt": PROMPT.format(look=look), "width": W, "height": H, "seed": seed, "batch_size": 1,
                                               "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        out.write_bytes(base64.b64decode(res["images"][0].split(",")[-1]))
        print("painted", out.name, flush=True)


def frame(pick, person):
    """One picked frame: the magenta out, its pink fringe eaten, the person `person` art px tall on 32 colours."""
    path = PICKED / f"{pick}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint it (gen_walkers.py paint or browse) and copy the chosen frame there")
    a = np.asarray(Image.open(path).convert("RGB").resize((W, H))).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (g < 0.55 * np.minimum(r, b)) & (r > 60) & (b > 60)   # the painted backdrop is a magenta gradient: green far under red and blue
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))
    im = Image.fromarray(a.astype(np.uint8), "RGB")
    im.putalpha(alpha)
    s = person / (36 * U)
    small = im.convert("RGBa").resize((round(W * s), round(H * s)), Image.BOX).convert("RGBA")   # premultiplied: no halo
    rgb = small.convert("RGB").quantize(32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    rgb.putalpha(small.getchannel("A").point(lambda v: 255 if v > 150 else 0))
    return rgb


def sheet(out, stem, names, columns, person, **more):
    """OUT/STEM.webp, a row per person and a column per frame, and STEM.json with the frame's size, the stride and each
    frame's foot: the row of its lowest painted pixel, the sole of the shoe that is down, which stands on the floor line.
    The skeleton's ground line will not do: the painted shoes end above it in some frames and below it in others."""
    rows = [[frame(f"{n}_{c}", person) for c in columns] for n in names]
    fw, fh = rows[0][0].size
    im = Image.new("RGBA", (fw * len(columns), fh * len(rows)))
    for j, row in enumerate(rows):
        for k, f in enumerate(row):
            im.paste(f, (k * fw, j * fh))
    im.save(out / f"{stem}.webp", "WEBP", lossless=True, quality=100, method=6, exact=True)
    foot = [[max(y for y in range(fh) for x in range(fw) if f.getpixel((x, y))[3]) for f in row] for row in rows]
    (out / f"{stem}.json").write_text(json.dumps({"people": names, "frames": len(columns), "w": fw, "h": fh,
                                                  "foot": foot, "stride": stride(person), **more}))
    print(f"baked {stem}.webp:", len(names), "people of", len(columns), "frames,", fw, "x", fh)


def bake(out):
    walk = list(range(FRAMES))
    sheet(out, "walkers", list(PEOPLE), walk, PERSON)
    sheet(out, "readers", READERS, walk + [f"browse_{k}" for k in BROWSE], READER, walk=FRAMES, browse=BROWSE)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["pose", "paint", "browse", "bake"])
    ap.add_argument("args", nargs="*", help="paint, browse: the people to paint (all, or the readers, by default); bake: OUT")
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    a = ap.parse_args()
    if a.cmd == "pose":
        PAINTED.mkdir(parents=True, exist_ok=True)
        for k in range(FRAMES):
            pose(2 * math.pi * k / FRAMES).save(PAINTED / f"walk_{k}_pose.png")
        for kind in BROWSE:
            browse_pose(kind).save(PAINTED / f"browse_{kind}_pose.png")
        print("posed", FRAMES, "walk and", len(BROWSE), "browse frames in", PAINTED)
    elif a.cmd == "paint":
        for n in a.args or PEOPLE:
            paint(n, a.host)
    elif a.cmd == "browse":
        for n in a.args or READERS:
            paint_browse(n, a.host)
    else:
        bake(Path(a.args[0] if a.args else "static/building/pixel"))
