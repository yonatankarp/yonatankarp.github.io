# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""The painted people: six on Workshop Row's pavement (web3d/src/workshop-fx.js), each an 8-frame walk cycle, and three
of them in the Library (library-fx.js), who also stand at a shelf, reach up, take a book and read it. And Yonatan's two
cats on Workshop Row's wall and pavement (cats.js): an 8-frame walk, a sit, a loaf, a crouch and a leap each.

Run: uv run web3d/pixel/gen_walkers.py pose                  # the 8 walk poses and 4 browse poses, from a skeleton on magenta,
                                                             # and each cat's 12 poses
     uv run web3d/pixel/gen_walkers.py paint [NAME...]       # Draw Things repaints each walk pose as that person (port 7860)
     uv run web3d/pixel/gen_walkers.py browse [NAME...]      # ... and each browse pose, for the Library's readers
     uv run web3d/pixel/gen_walkers.py cats [NAME...]        # ... and each cat pose as that cat
     uv run web3d/pixel/gen_walkers.py bake [OUT]            # OUT/walkers.webp + .json, OUT/readers.webp + .json and
                                                             # OUT/cats.webp + .json, and the lobby's, cats-lobby.webp + .json

The poses go to web3d/pixel/paintings/candidates/walkers/walk_K_pose.png and the paintings beside them as NAME_K.png
(not committed); a person's chosen frames are copied to web3d/pixel/paintings/picks/walkers/NAME_K.png, the bake's input,
and the browse poses to NAME_browse_KIND.png. The cats' go to candidates/cats/NAME_POSE_pose.png and NAME_POSE.png, and
their picks to picks/cats/NAME_POSE.png.
Every frame of a person (a cat) is painted with the same seed and prompt, so the frames stay one person. The bake keys the
magenta out, eats its pink fringe, scales the person to PERSON (READER) art px tall (premultiplied, so no halo) on 32 colours, and lays the
people out as rows of one sheet, a frame per column, all standing on the same foot row. A cat is CAT art px tall walking
(the black one smaller) on 24 colours.
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
from paint_rooms import OUT as CANDIDATES, call, magenta  # noqa: E402

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


def limb(d, a, b, w, col, u=U):
    d.line([a, b], fill=col, width=int(w * u))
    r = w * u / 2
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


CAT_PAINTED, CAT_PICKED = CANDIDATES / "cats", PICKED.parent / "cats"
CW, CH, CAT_FOOT, CU = 768, 384, 330, 12.0   # a cat's painting, its ground line and pixels per skeleton unit
CAT = 14                                     # art px from paw to ear tip of the ginger's walk, on the wall's top
CAT_LOBBY = 26                               # ... and in the tower's lobby (cats-lobby.webp), against its bench and desk
CAT_POSES = [f"walk_{k}" for k in range(FRAMES)] + ["sit", "loaf", "crouch", "leap"]
CATS = {   # name: (seed, coat colour for the skeleton, how it looks, size against the ginger)
    "ginger": (2100, (214, 128, 58), "a big stocky ginger tabby cat with a round face, bold orange mackerel tabby stripes "
               "on the back, legs and tail, a cream chin, muzzle and chest, pale green eyes and a pink nose", 1.0),
    "black": (2117, (34, 30, 30), "a small slender black cat with a soft warm brown sheen in its short coat, a narrow "
              "face, large upright pointed ears, pale yellow-green eyes and a dark nose", 0.88),
}
RELATIVE = {"sit": 1.15, "loaf": 0.78, "crouch": 0.72, "leap": 0.78}   # each pose's height against the walk's, as a real cat stands; the paintings vary
CAT_PROMPT = ("Edit this picture. Repaint the shape as one real domestic cat, {action}, seen exactly from the side facing "
              "right, in highly detailed painterly video game art: {look}, natural proportions, warm golden dusk light from "
              "the left, soft shading, fur texture. Keep the exact pose, the exact position and size of the body, every "
              "leg, the head, the ears and the tail. Keep the background perfectly flat solid magenta. One cat only, no "
              "text, no shadow.")
CAT_ACTION = {"walk": "walking calmly", "sit": "sitting upright with its tail wrapped round its front paws",
              "loaf": "lying in a loaf with its paws tucked under its chest and its head up",
              "crouch": "crouched low on all four paws, hind legs bunched under it, about to spring",
              "leap": "leaping through the air, body stretched long, front legs reaching forward, hind legs stretched "
                      "back, tail straight out behind"}


def cat_head(d, hx, hy, col):
    r = 3.4 * CU
    d.ellipse([hx - r, hy - r * .9, hx + r, hy + r * .9], fill=col)
    d.ellipse([hx + r * .5, hy - r * .1, hx + r * 1.45, hy + r * .75], fill=col)   # muzzle
    for ex in (-.55, .35):   # ears: the far one a little back
        d.polygon([(hx + ex * r - 1.3 * CU, hy - .55 * r), (hx + ex * r + .2 * CU, hy - r - 2.6 * CU),
                   (hx + ex * r + 1.5 * CU, hy - .6 * r)], fill=col)


def cat_tail(d, pts, col, w=1.5):
    for a, b in zip(pts, pts[1:], strict=False):
        limb(d, a, b, w, col, CU)


def cat_pose(kind, col):
    """A cat's skeleton facing right on magenta: walk_K (a lateral-sequence walk, the far legs another shade), sit, loaf,
    crouch (about to spring) or leap (stretched long in the air)."""
    im = Image.new("RGB", (CW, CH), MAGENTA)
    d = ImageDraw.Draw(im)
    x, g = CW / 2, CAT_FOOT

    def lb(a, b, w):
        limb(d, a, b, w, col, CU)

    if kind.startswith("walk"):
        ph = 2 * math.pi * int(kind[5:]) / FRAMES
        dark = tuple(int(v * .65) for v in col) if sum(col) > 200 else tuple(min(255, int(v * 1.6) + 8) for v in col)
        bob = -abs(math.sin(2 * ph)) * .4 * CU
        hip, sh = (x - 8 * CU, g - 11.5 * CU + bob), (x + 7 * CU, g - 11.8 * CU + bob)

        def leg(top, a, c, front):   # a: this leg's phase; it swings forward while lifted
            sw = .38 * math.sin(a)
            lift = max(0, math.cos(a)) * (1.2 if front else 1.6) * CU
            k = (top[0] + math.sin(sw) * 5.5 * CU + (0 if front else -1.2 * CU), top[1] + 5.5 * CU)
            f = (top[0] + math.sin(sw) * 10 * CU, g - lift)
            limb(d, top, k, 2.4, c, CU)
            limb(d, k, f, 1.8, c, CU)
            limb(d, f, (f[0] + 1.3 * CU, f[1]), 1.6, c, CU)

        leg(hip, ph + math.pi, dark, False)
        leg(sh, ph + 1.5 * math.pi, dark, True)
        cat_tail(d, [hip, (hip[0] - 4 * CU, hip[1] - 1 * CU), (hip[0] - 7.5 * CU, hip[1] - 3.5 * CU - math.sin(ph) * CU),
                     (hip[0] - 9 * CU, hip[1] - 7 * CU - math.sin(ph) * 1.5 * CU)], col)
        d.ellipse([hip[0] - 4 * CU, hip[1] - 4.5 * CU, sh[0] + 4 * CU, sh[1] + 4.5 * CU], fill=col)   # body
        leg(hip, ph, col, False)
        leg(sh, ph + .5 * math.pi, col, True)
        lb((sh[0] + 1 * CU, sh[1] - 1 * CU), (sh[0] + 3.5 * CU, sh[1] - 2.5 * CU), 4.8)   # neck
        cat_head(d, sh[0] + 5 * CU, sh[1] - 4.2 * CU + bob * .3, col)
    elif kind == "sit":
        d.ellipse([x - 8 * CU, g - 9 * CU, x + 1 * CU, g], fill=col)   # haunch on the ground
        d.polygon([(x - 6 * CU, g - 7 * CU), (x + 1 * CU, g - 16.5 * CU), (x + 6.5 * CU, g - 14 * CU), (x + 4 * CU, g - 2 * CU),
                   (x - 2 * CU, g)], fill=col)   # chest up
        lb((x + 3.5 * CU, g - 12 * CU), (x + 4.5 * CU, g - .8 * CU), 2.2)   # front leg
        lb((x + 4.5 * CU, g - .8 * CU), (x + 6 * CU, g - .8 * CU), 1.6)
        cat_tail(d, [(x - 7.5 * CU, g - 1 * CU), (x - 3 * CU, g - .8 * CU), (x + 2 * CU, g - .8 * CU), (x + 7 * CU, g - 1.4 * CU)], col, 1.4)
        cat_head(d, x + 4.5 * CU, g - 18 * CU, col)
    elif kind == "loaf":
        d.ellipse([x - 11 * CU, g - 9 * CU, x + 6 * CU, g + .3 * CU], fill=col)
        cat_tail(d, [(x - 10 * CU, g - 1.2 * CU), (x - 5 * CU, g - .6 * CU), (x + 1 * CU, g - .6 * CU)], col, 1.6)
        cat_head(d, x + 6 * CU, g - 10.5 * CU, col)
    elif kind == "crouch":
        d.ellipse([x - 11 * CU, g - 8 * CU, x + 6 * CU, g - .5 * CU], fill=col)   # the body pressed low
        lb((x - 7 * CU, g - 3 * CU), (x - 4 * CU, g - .4 * CU), 2.6)            # haunch folded, hind paw
        lb((x + 4 * CU, g - 4 * CU), (x + 7 * CU, g - .4 * CU), 1.8)            # front leg, paw forward
        lb((x + 7 * CU, g - .4 * CU), (x + 8.5 * CU, g - .4 * CU), 1.6)
        cat_tail(d, [(x - 10 * CU, g - 4 * CU), (x - 14 * CU, g - 3 * CU), (x - 17 * CU, g - 2 * CU)], col)
        cat_head(d, x + 7.5 * CU, g - 8.5 * CU, col)
    else:   # leap
        y = g - 10 * CU
        d.ellipse([x - 11 * CU, y - 4 * CU, x + 8 * CU, y + 3.5 * CU], fill=col)   # stretched long
        for dx in (0, -1.2):                                                       # hind legs straight back
            limb(d, (x - 8 * CU + dx * CU, y + 1 * CU), (x - 15 * CU + dx * CU, y + 6 * CU), 2, col, CU)
        for dx in (0, 1.2):                                                        # front legs reaching ahead
            limb(d, (x + 6 * CU + dx * CU, y + 1 * CU), (x + 13 * CU + dx * CU, y + 5 * CU), 1.8, col, CU)
        cat_tail(d, [(x - 10 * CU, y - 1 * CU), (x - 15 * CU, y - 2 * CU), (x - 20 * CU, y - 2.5 * CU)], col)
        cat_head(d, x + 10 * CU, y - 3 * CU, col)
    return im


def paint_cat(name, host):
    seed, _, look, _ = CATS[name]
    for p in CAT_POSES:
        out = CAT_PAINTED / f"{name}_{p}.png"
        if out.exists():
            print("kept", out.name)
            continue
        buf = io.BytesIO()
        Image.open(CAT_PAINTED / f"{name}_{p}_pose.png").save(buf, "PNG")
        res = call(host, "/sdapi/v1/img2img", {"prompt": CAT_PROMPT.format(action=CAT_ACTION[p.split("_")[0]], look=look), "width": CW,
                                               "height": CH, "seed": seed, "batch_size": 1, "strength": 1.0,
                                               "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        out.write_bytes(base64.b64decode(res["images"][0].split(",")[-1]))
        print("painted", out.name, flush=True)


def cat_keyed(pick, black=False):
    """A picked cat painting with its magenta keyed out: its pixels, its alpha and its height from paw to ear tip. The
    model paints the black cat brown, so it is pulled towards black, keeping a little of the warm sheen."""
    path = CAT_PICKED / f"{pick}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint it (gen_walkers.py cats) and copy the chosen frame there")
    a = np.asarray(Image.open(path).convert("RGB").resize((CW, CH))).astype(int)
    bg = magenta(a)
    if black:
        lum = (a * [.3, .59, .11]).sum(-1, keepdims=True)
        a = np.clip((lum + (a - lum) * .35) * .7, 0, 255).astype(int)
    alpha = np.asarray(Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)))
    ys = np.nonzero(alpha.max(1))[0]
    return a, alpha, ys[-1] - ys[0]


def cat_frame(pick, s, black):
    """One picked cat painting scaled by s (premultiplied, so no halo) on 24 colours."""
    a, alpha, _ = cat_keyed(pick, black)
    im = Image.fromarray(a.astype(np.uint8), "RGB")
    im.putalpha(Image.fromarray(alpha))
    small = im.convert("RGBa").resize((round(CW * s), round(CH * s)), Image.BOX).convert("RGBA")
    rgb = small.convert("RGB").quantize(24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    rgb.putalpha(small.getchannel("A").point(lambda v: 255 if v > 140 else 0))
    return rgb


def cat_sheet(out, height=CAT, stem="cats"):
    """OUT/STEM.webp, a row per cat and a column per pose (CAT_POSES), every frame on one canvas, centred across and
    standing on its bottom; and STEM.json with the frame's size, each frame's foot and each cat's stride. A cat's walk is
    height art px tall times its size; the other poses are scaled from their own painted height by RELATIVE."""
    rows, strides = [], []
    for n, (*_, size) in CATS.items():
        walk_h = cat_keyed(f"{n}_walk_0")[2]
        s = height * size / walk_h
        rows.append([cat_frame(f"{n}_{p}", s * RELATIVE.get(p, 1) * walk_h / (cat_keyed(f"{n}_{p}")[2] if p in RELATIVE else walk_h), n == "black")
                     for p in CAT_POSES])
        strides.append(round(15 * CU * s))   # the skeleton's stride, 15 units
    fw, fh = max(f.width for r in rows for f in r), max(f.height for r in rows for f in r)
    im = Image.new("RGBA", (fw * len(CAT_POSES), fh * len(rows)))
    for j, row in enumerate(rows):
        for k, f in enumerate(row):
            im.paste(f, (k * fw + (fw - f.width) // 2, j * fh + fh - f.height))
    im.save(out / f"{stem}.webp", "WEBP", lossless=True, quality=100, method=6, exact=True)
    frames = [[im.crop((k * fw, j * fh, (k + 1) * fw, (j + 1) * fh)) for k in range(len(CAT_POSES))] for j in range(len(rows))]
    foot = [[max(y for y in range(fh) for x in range(fw) if f.getpixel((x, y))[3]) for f in row] for row in frames]
    (out / f"{stem}.json").write_text(json.dumps({"people": list(CATS), "frames": len(CAT_POSES), "poses": CAT_POSES, "w": fw, "h": fh,
                                               "foot": foot, "stride": strides}))
    print(f"baked {stem}.webp:", len(CATS), "cats of", len(CAT_POSES), "frames,", fw, "x", fh)


def frame(pick, person):
    """One picked frame: the magenta out, its pink fringe eaten, the person `person` art px tall on 32 colours."""
    path = PICKED / f"{pick}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint it (gen_walkers.py paint or browse) and copy the chosen frame there")
    a = np.asarray(Image.open(path).convert("RGB").resize((W, H))).astype(int)
    bg = magenta(a)
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
    cat_sheet(out)
    cat_sheet(out, CAT_LOBBY, "cats-lobby")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["pose", "paint", "browse", "cats", "bake"])
    ap.add_argument("args", nargs="*", help="paint, browse, cats: the people (cats) to paint (all, or the readers, by default); bake: OUT")
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    a = ap.parse_args()
    if a.cmd == "pose":
        PAINTED.mkdir(parents=True, exist_ok=True)
        for k in range(FRAMES):
            pose(2 * math.pi * k / FRAMES).save(PAINTED / f"walk_{k}_pose.png")
        for kind in BROWSE:
            browse_pose(kind).save(PAINTED / f"browse_{kind}_pose.png")
        CAT_PAINTED.mkdir(parents=True, exist_ok=True)
        for n, (_, coat, *_) in CATS.items():
            for p in CAT_POSES:
                cat_pose(p, coat).save(CAT_PAINTED / f"{n}_{p}_pose.png")
        print("posed", FRAMES, "walk and", len(BROWSE), "browse frames in", PAINTED, "and", len(CAT_POSES), "per cat in", CAT_PAINTED)
    elif a.cmd == "paint":
        for n in a.args or PEOPLE:
            paint(n, a.host)
    elif a.cmd == "browse":
        for n in a.args or READERS:
            paint_browse(n, a.host)
    elif a.cmd == "cats":
        for n in a.args or CATS:
            paint_cat(n, a.host)
    else:
        bake(Path(a.args[0] if a.args else "static/building/pixel"))
