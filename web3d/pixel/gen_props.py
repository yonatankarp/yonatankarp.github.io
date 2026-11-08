# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""The holidays' art in the city (web3d/src/props.js, city-fx.js): on the tower plaza a hanukkiah, a Christmas tree and
Halloween's jack-o'-lanterns; Halloween's ghosts and bats; and the new year's fireworks over the city. Painted on magenta
(the bursts on black, as light is, and as magenta keying would eat a red one), keyed, and baked the city's way.

Run: uv run web3d/pixel/gen_props.py pose [OUT]               # the shapes the model paints over, on magenta (bursts on black),
                                                              # into OUT (paintings/candidates, where paint reads them)
     uv run web3d/pixel/gen_props.py paint NAME SEED...       # Draw Things paints them (port 7860): hanukkiah, tree,
                                                              # tree-plain (the snowy tree's pick with its snow taken off),
                                                              # a pumpkin, a burst, or every frame of ghost-a, ghost-b or bat
     uv run web3d/pixel/gen_props.py unflame SEED             # the hanukkiah's candidate with the candles' painted flames erased
     uv run web3d/pixel/gen_props.py key NAME FILE            # a candidate keyed off its magenta (a burst off its black) into
                                                              # picks/props/NAME.png; for ghost-a, ghost-b or bat, FILE is the
                                                              # seed and every frame goes to NAME_K.png ("pose" keys the poses)
     uv run web3d/pixel/gen_props.py bake [OUT]               # OUT/props.webp and OUT/props.json, and halloween, fireworks,
                                                              # ghosts and bats (.webp and .json each) once their picks are in

The picks are hanukkiah 11 (unflamed: the model lit the candles anyway, and the page lights the right ones in code), tree
11 (snowy, for winter) and tree-plain 11 (that tree with the snow painted off, for Christmas in a southern summer). Each
is box-reduced to its height in art px on 32 colours, its edge hard (alpha over 80), as the city is. props.json has where
each stands (its foot's middle, in the city's art px), the sprites' boxes in props.webp, the hanukkiah's candle tops
(flames, left to right as you face it, the shamash in the middle) and the tree's bulbs and star.

Halloween (PUMPKINS, placed at HALLOWEEN): each lantern painted unlit, box-reduced to its height, its carved face found
in the painting (face()) and painted dark in the sprite, so the page lights it at dusk and night only; halloween.json
has each one's box, its face's pixels (glow) and where each stands. The ghosts (GHOSTS, GHOST art px tall) and the bat
(BAT art px across) are painted frames, every frame of one with the same seed, and baked as the walkers are (a row each,
a frame per column, scene-fx.js's people()); ghosts.json has each ghost's path and the depth it hides from. The bursts
(BURSTS) are each painted once and grown and faded in BURST_FRAMES from that one painting, so every frame is on the
same art pixels; fireworks.json has their boxes, the sky box their middles fall in (SKY), what stands in front of
the sky there (the tower and the crane, which hide them) and the crane's lights their middles keep off. Each of those four is baked only once all its picks are in, so the bake keeps the committed art.
"""
import argparse
import json
import math
import os
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_common import CANDIDATES, OUT, PICKS, key as keyed, magenta, paint_candidate, reduce, save_lossless  # noqa: E402
from gen_city import DOOR_OPEN, LIGHTS, PLAZAS  # noqa: E402

PICKED = Path(os.environ.get("PROPS_PICKS") or PICKS / "props")   # PROPS_PICKS: a mock's
DEPTH = PICKS / "city-depth.png"
W, H, MAG = 512, 512, (255, 0, 255)
GOLD, DARK = (196, 150, 70), (120, 88, 40)
# The hanukkiah's pose: a base, a stem, four arms each side curving up, cups level at y 150 and the shamash's raised, at 105.
XS = [76, 116, 156, 196, 256, 316, 356, 396, 436]
CUPS = [(x, 105 if i == 4 else 150) for i, x in enumerate(XS)]
# Where each stands on the plaza, either side of the tower: its foot's middle in the city's art px, and its height.
PLACE = {"hanukkiah": (694, 233, 30), "tree": (800, 236, 34)}
BULBS = 34
PROMPTS = {
    "hanukkiah": ("Edit this picture. Repaint the shape as one large public outdoor hanukkiah, a nine-branched Hanukkah "
                  "menorah standing on a city square, polished gold metal with eight arms in curves and the raised middle "
                  "branch, an unlit white candle in each of its nine cups, highly detailed painterly video game art, warm "
                  "golden dusk light, soft shading, seen from slightly above. Keep the exact shape, position and size. Keep "
                  "the background perfectly flat solid magenta. One object only, no flames, no text, no shadow."),
    "tree": ("Edit this picture. Repaint the shape as one tall Christmas tree standing on a city square, a dark green fir "
             "dusted with snow, with strings of small unlit bulbs, red and gold baubles and a gold star on top, on a small "
             "round base, highly detailed painterly video game art, warm golden dusk light, soft shading, seen from slightly "
             "above. Keep the exact shape, position and size. Keep the background perfectly flat solid magenta. One object "
             "only, no text, no shadow."),
    "tree-plain": ("Edit this picture. Keep the Christmas tree exactly as it is: its shape, size and place, its dark green "
                   "fir branches, its strings of small unlit bulbs, its red and gold baubles, its gold star and its round "
                   "base, the same painterly video game style and the same warm light. Change only one thing: take all the "
                   "snow off it, so its branches are plain dark green with no white anywhere. Keep the background perfectly "
                   "flat solid magenta. One object only, no text, no shadow."),
}
INIT = {"tree-plain": CANDIDATES / "tree_11.png"}   # an edit of the snowy pick, so it keeps its silhouette, foot and size

# Halloween's lanterns, 24 to 31 October: name: (art px tall, the pose's body box, how it looks). Seeds to try: 11 12 13 14.
PUMPKINS = {
    "pumpkin-tall": (9, (146, 130, 366, 452), "a tall, slightly narrow pumpkin with deep ribs"),
    "pumpkin-round": (8, (96, 190, 416, 452), "a big round pumpkin with broad ribs"),
    "pumpkin-small": (6, (126, 262, 386, 452), "a small squat pumpkin"),
}
# Where each stands, its foot's middle in the city's art px: a loose row on the paving right of the tower, clear of the
# open door's crop (gen_city.py's DOOR_OPEN, which the push-in lays over the city), the walkers' plazas (PLAZAS, with
# their heads) and the hanukkiah's and the tree's boxes; halloween() checks it against the baked sprites.
HALLOWEEN = [("pumpkin-tall", 762, 240), ("pumpkin-small", 768, 241), ("pumpkin-round", 775, 243), ("pumpkin-small", 782, 242)]
PUMPKIN_PROMPT = ("Edit this picture. Repaint the shape as one carved Halloween jack-o'-lantern standing on a city square, "
                  "{look}, deep orange skin, a short curled green-brown stem, a carved face with two triangle eyes, a "
                  "triangle nose and a wide toothy grin, the carved holes dark and hollow, unlit, highly detailed painterly "
                  "video game art, warm golden dusk light, soft shading, seen from slightly above. Keep the exact shape, "
                  "position and size, and the face where it is. Keep the background perfectly flat solid magenta. One object "
                  "only, no candle, no glow, no text, no shadow.")

# The new year's bursts, name: (art px across, the pose's colour, how it looks). Seeds to try: 11 12 13 14.
BURSTS = {
    "burst-gold": (34, (255, 196, 90), "a golden willow firework, long gold sparks that arc out and droop at their ends"),
    "burst-red": (30, (255, 72, 64), "a red peony firework, a round ball of bright red stars with white-hot tips"),
    "burst-green": (30, (96, 250, 140), "a green chrysanthemum firework, thin green spark trails radiating evenly"),
    "burst-blue": (26, (120, 168, 255), "a blue ring firework, a crisp ring of blue stars round a few white sparks"),
}
BURST_PROMPT = ("Edit this picture. Repaint the shape as one single firework burst far away in the night sky, {look}, "
                "glowing sparks streaking out from its centre, highly detailed painterly video game art. Keep the exact "
                "shape, position and size. Keep the background perfectly flat solid black. One burst only, no smoke, no "
                "rocket trail, no city, no text.")
# Each frame from the one painting: its scale about the middle, brightness, droop (painting px) and the share of its
# pixels gone. GROW of them grow (props.js's BURST.grow ms each), the rest fade (BURST.fade).
BURST_FRAMES = [(.3, 1, 0, 0), (.55, 1, 0, 0), (.78, 1, 0, 0), (.93, 1, 0, 0), (1, 1, 0, 0),
                (1.04, .8, 6, .15), (1.07, .6, 14, .3), (1.09, .42, 26, .5), (1.1, .26, 40, .7)]
GROW = 5
LIT, GAIN = 0.4, 1.6
# x0, y0, x1, y1: where a burst's middle may fall, the sky just left of the tower (x 713), clear of the top bar at the
# opening view: a burst is whole below a phone's bar (art rows 0-28, x 653-848 shown at 390 px), and left of a desktop's
# Download CV and social row (from x 737 at 1440 px; 690 at 1280 x 720 reaches a burst's top corner). What the depth map
# has nearer than the sky at the top of its column (14-22 here, not 0), the tower and the crane, hides a burst and its
# spark, which climbs RISE px (props.js's SPARK.rise). A burst's middle keeps CORE px off the crane's two lights.
SKY = [640, 46, 712, 56]
RISE = 30
CORE = 6

# Halloween's ghosts, name: (seed, how it looks), GHOST art px tall (the city's walkers are 4), and their four sway
# frames, facing right (the page mirrors them). Each drifts along a path: x0, x1, its bottom row and the row whose depth
# it hides from (the street or the roofs under it). Seeds to try: 2300 2317 2334 (ghost-a), 2351 2368 2385 (ghost-b).
GHOST, GHOST_FRAMES = 10, 4
GHOSTS = {
    "ghost-a": (2300, "a small round friendly ghost with a soft rounded head"),
    "ghost-b": (2351, "a slimmer ghost with a long wispy tail trailing behind it"),
}
GHOST_PATHS = [(480, 680, 289, 298), (800, 980, 288, 298), (250, 420, 172, 178), (880, 1060, 196, 200)]   # main street; roofs
GHOST_PROMPT = ("Edit this picture. Repaint the shape as {look}, floating in the air facing right, a soft white sheet-like "
                "body, two dark oval eyes, its hem rippling in wavy folds, faintly glowing pale blue-white, highly detailed "
                "painterly video game art, cool moonlight, soft shading. Keep the exact shape, position and size. Keep the "
                "background perfectly flat solid magenta. One ghost only, no text, no shadow.")
# The bat that stands in for the birds on Halloween nights: BAT art px across, four wingbeat frames. Seeds: 2400 2417 2434.
BAT, BAT_FRAMES, BAT_SEED = 9, 4, 2400
BAT_WINGS = ["its wings raised high above its body", "its wings spread level", "its wings swept down below its body",
             "its wings spread level"]
BAT_PROMPT = ("Edit this picture. Repaint the shape as one small bat flying toward the viewer, {wings}, dark brown-black "
              "leathery wings with thin finger bones, a small furry body and pointed ears, highly detailed painterly video "
              "game art, dusk light, soft shading. Keep the exact shape, position and size of the body and both wings. Keep "
              "the background perfectly flat solid magenta. One bat only, no text, no shadow.")
FRAMED = {"ghost-a": ("ghost", GHOST_FRAMES), "ghost-b": ("ghost", GHOST_FRAMES), "bat": ("bat", BAT_FRAMES)}   # name: (its poses, frames)


def prompt(name, k=None):
    if name in PUMPKINS:
        return PUMPKIN_PROMPT.format(look=PUMPKINS[name][2])
    if name in BURSTS:
        return BURST_PROMPT.format(look=BURSTS[name][2])
    if name in GHOSTS:
        return GHOST_PROMPT.format(look=GHOSTS[name][1])
    if name == "bat":
        return BAT_PROMPT.format(wings=BAT_WINGS[k])
    return PROMPTS[name]


def pose(out=CANDIDATES):
    h = Image.new("RGB", (W, H), MAG)
    d = ImageDraw.Draw(h)
    d.rectangle([206, 420, 306, 444], fill=DARK)
    d.rectangle([248, 150, 264, 420], fill=GOLD)   # base and stem
    for i, x in enumerate(XS):
        if i == 4:
            continue
        r = abs(x - 256)   # the lower half of an ellipse, from one cup down through the stem and up to its pair
        d.arc([256 - r, 150 - r * .95, 256 + r, 150 + r * .95], 0, 180, fill=GOLD, width=10)
    for x, y in CUPS:
        d.rectangle([x - 12, y, x + 12, y + 12], fill=GOLD)
        d.rectangle([x - 5, y - 40, x + 5, y], fill=(240, 236, 220))
    h.save(out / "hanukkiah_pose.png")
    t = Image.new("RGB", (W, H), MAG)
    d = ImageDraw.Draw(t)
    d.ellipse([196, 440, 316, 470], fill=(90, 70, 50))
    d.rectangle([244, 400, 268, 455], fill=(80, 55, 35))
    for y0, y1, w in [(70, 200, 70), (150, 300, 110), (240, 420, 150)]:
        d.polygon([(256, y0), (256 - w, y1), (256 + w, y1)], fill=(36, 82, 50))
    d.regular_polygon((256, 64, 22), 5, fill=(240, 200, 80))
    t.save(out / "tree_pose.png")
    for name, (_, box, _) in PUMPKINS.items():
        pumpkin_pose(box).save(out / f"{name}_pose.png")
    for name, (_, colour, _) in BURSTS.items():
        burst_pose(name, colour).save(out / f"{name}_pose.png")
    for k in range(GHOST_FRAMES):
        ghost_pose(k).save(out / f"ghost_{k}_pose.png")
    for k in range(BAT_FRAMES):
        bat_pose(k).save(out / f"bat_{k}_pose.png")


def pumpkin_pose(box):
    """A lantern on magenta: its ribbed orange body in `box` (standing on row 452), a stem, and a dark carved face."""
    im = Image.new("RGB", (W, H), MAG)
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = box
    cx, w, h = (x0 + x1) / 2, x1 - x0, y1 - y0
    d.ellipse(box, fill=(226, 116, 30))
    for f in (.22, .4, .6, .78):   # the ribs
        d.arc([x0 + w * f - w * .14, y0, x0 + w * f + w * .14, y1], 100 if f < .5 else -80, 260 if f < .5 else 80, fill=(170, 74, 18), width=5)
    d.rectangle([cx - 10, y0 - 34, cx + 10, y0 + 8], fill=(96, 92, 40))
    dark, ey, s = (34, 18, 10), y0 + h * .34, w * .11
    for ex in (cx - w * .2, cx + w * .2):
        d.polygon([(ex - s, ey + s), (ex + s, ey + s), (ex, ey - s * .8)], fill=dark)
    d.polygon([(cx - s * .5, y0 + h * .58), (cx + s * .5, y0 + h * .58), (cx, y0 + h * .48)], fill=dark)
    my, teeth = y0 + h * .68, [cx - w * .3 + i * w * .6 / 6 for i in range(7)]
    d.polygon([(teeth[0], my)] + [(x, my + (8 if i % 2 else 0)) for i, x in enumerate(teeth)] + [(teeth[-1], my), (cx + w * .22, my + h * .14),
              (cx - w * .22, my + h * .14)], fill=dark)
    return im


def burst_pose(name, colour):
    """A burst on black: rays from the middle in its colour, each ending in a bright star (a ring's stars only)."""
    im = Image.new("RGB", (W, H), (0, 0, 0))
    d, rnd = ImageDraw.Draw(im), random.Random(name)
    tip = tuple(min(255, c + 90) for c in colour)
    for i in range(44):
        a, r = 2 * math.pi * i / 44 + rnd.uniform(-.04, .04), rnd.uniform(.82, 1) * 200
        x, y = 256 + math.cos(a) * r, 256 + math.sin(a) * r + (r / 200) ** 2 * (34 if "gold" in name else 0)
        if "blue" not in name:
            d.line([(256 + math.cos(a) * 30, 256 + math.sin(a) * 30), (x, y)], fill=tuple(c // 2 for c in colour), width=4)
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=tip)
    return im


def ghost_pose(k):
    """Frame k of a ghost's sway, facing right on magenta: a dome and a body that leans and ripples, two dark eyes."""
    im = Image.new("RGB", (384, 384), MAG)
    d, ph = ImageDraw.Draw(im), 2 * math.pi * k / GHOST_FRAMES
    lean = math.sin(ph) * 14
    d.ellipse([122, 50, 262, 190], fill=(234, 236, 246))
    hem = [(112 - 12 + lean + i * 180 / 8, 330 + math.sin(ph + i * 1.6) * 14 + (i % 2) * 18) for i in range(9)]
    d.polygon([(122, 120), (262, 120), hem[-1], *reversed(hem)], fill=(234, 236, 246))
    for ex in (196, 236):
        d.ellipse([ex - 11, 96, ex + 11, 128], fill=(40, 40, 56))
    return im


def bat_pose(k):
    """Frame k of a bat's wingbeat, seen from the front on magenta: its body and ears, and its two wings at that beat."""
    im = Image.new("RGB", (384, 256), MAG)
    d, col = ImageDraw.Draw(im), (44, 32, 38)
    tip = [-70, 0, 60, 0][k]   # the wingtips' height against the shoulders
    for side in (-1, 1):
        sx, tx = 192 + side * 18, 192 + side * 170
        d.polygon([(sx, 118), (tx, 118 + tip), (192 + side * 130, 150 + tip * .5), (192 + side * 80, 140 + tip * .3),
                   (192 + side * 40, 158)], fill=col)
    d.ellipse([170, 104, 214, 176], fill=col)
    d.polygon([(176, 112), (172, 84), (190, 106), (194, 106), (212, 84), (208, 112)], fill=col)
    return im


def paint(name, seeds, host="http://127.0.0.1:7860"):
    """Each seed's candidate of NAME, or of every one of its frames (FRAMED), all with that seed, so they stay one ghost."""
    poses, n = FRAMED.get(name, (None, 0))
    jobs = [(k, CANDIDATES / f"{poses}_{k}_pose.png", f"{name}_{k}") for k in range(n)] or \
        [(None, INIT.get(name, CANDIDATES / f"{name}_pose.png"), name)]
    for seed in seeds:
        for k, init, stem in jobs:
            im = Image.open(init).convert("RGB")
            paint_candidate(CANDIDATES / f"{stem}_{seed}.png", prompt(name, k), im.size, seed, host, im)


def unflame(seed):
    """The model lights the candles anyway: everything above each candle's white top goes back to magenta, and the tops
    are written to picks/props/hanukkiah.json (x, the candle's top y, in the painting), so the page lights the right ones."""
    a = np.asarray(Image.open(CANDIDATES / f"hanukkiah_{seed}.png").convert("RGB")).astype(int)
    white = (a.min(axis=2) > 185) & (a.max(axis=2) - a.min(axis=2) < 60)
    cups = []
    for x in XS:
        cols = [c for c in range(x - 25, x + 26) if white[60:200, c].sum() > 15]
        cx = round(sum(cols) / len(cols)) if cols else x
        rows = np.nonzero(white[:, cx - 9:cx + 10].sum(axis=1) >= 8)[0]   # the candle's body, not the flame's narrow core
        top = int(rows[rows > 20].min())
        a[:top, cx - 14:cx + 15] = MAG
        cups.append((cx, top))
    Image.fromarray(a.astype(np.uint8)).save(CANDIDATES / f"hanukkiah_{seed}-plain.png")
    (PICKED / "hanukkiah.json").write_text(json.dumps({"cups": cups}) + "\n")
    print("cups", cups)


def key(name, file):
    """Magenta (and the model's pinkish fringe of it) to clear, shrunk a pixel so no fringe is left: picks/props/NAME.png.
    A burst's black instead: only its light is kept. A framed one (FRAMED) keys each frame of seed FILE (or its poses)."""
    if name in FRAMED:
        poses, n = FRAMED[name]
        for k in range(n):
            key(f"{name}_{k}", f"{poses}_{k}_pose.png" if file == "pose" else f"{name}_{k}_{file}.png")
        return
    a = np.asarray(Image.open(CANDIDATES / file).convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if name in BURSTS:
        im = Image.fromarray(a.astype(np.uint8), "RGB")
        im.putalpha(Image.fromarray(np.where(a.max(axis=2) > 40, 255, 0).astype(np.uint8)))
    else:
        im = keyed(a, magenta(a, (r > 200) & (b > 150) & (g < 0.6 * r)), 3)
    PICKED.mkdir(parents=True, exist_ok=True)
    im.save(PICKED / f"{name}.png")
    print("keyed", name)


def small(name, height):
    """The keyed painting cut to itself, box-reduced to `height` art px on 32 colours, its edge hard: the pixel look.
    Returns it, the box it was cut from and the scale."""
    im = Image.open(PICKED / f"{name}.png").convert("RGBA")
    box = im.getchannel("A").getbbox()
    im = im.crop(box)
    s = height / im.height
    return reduce(im, (max(1, round(im.width * s)), height)), box, s


def flames(sprite, box, s):
    """Each candle's top in the sprite: the highest opaque pixel within a pixel of where the painting's top falls."""
    a, out = np.asarray(sprite.getchannel("A")) > 0, []
    for cx, cy in json.loads((PICKED / "hanukkiah.json").read_text())["cups"]:
        x, y0, best = round((cx - box[0]) * s), round((cy - box[1]) * s), None
        for xx in range(max(0, x - 1), min(a.shape[1], x + 2)):
            col = np.nonzero(a[max(0, y0 - 3):y0 + 4, xx])[0]
            if len(col) and (best is None or col[0] + max(0, y0 - 3) < best[1]):
                best = (xx, int(col[0]) + max(0, y0 - 3))
        out.append(list(best or (x, y0)))
    return out


def lights(tree):
    """The tree's bulbs, BULBS of them on its inside, none within 2 px of another (seeded), and its star, its top row."""
    a = np.asarray(tree.getchannel("A")) > 0
    inner = [(x, y) for y in range(5, tree.height - 5) for x in range(1, tree.width - 1)
             if a[y, x] and a[y, x - 1] and a[y, x + 1] and a[y - 1, x] and a[y + 1, x]]
    rnd, bulbs = random.Random(7), []
    for p in rnd.sample(inner, len(inner)):
        if all(abs(p[0] - q[0]) + abs(p[1] - q[1]) > 2 for q in bulbs):
            bulbs.append(list(p))
        if len(bulbs) == BULBS:
            break
    top = min(y for y in range(tree.height) if a[y].any())
    return bulbs, [[int(x), top] for x in np.nonzero(a[top])[0]]


def bake(out):
    """props.webp, the three sprites side by side (hanukkiah, tree, plain tree), and props.json."""
    h, box, s = small("hanukkiah", PLACE["hanukkiah"][2])
    t, _, _ = small("tree", PLACE["tree"][2])
    p, _, _ = small("tree-plain", PLACE["tree"][2])
    sheet = Image.new("RGBA", (h.width + t.width + p.width, max(h.height, t.height, p.height)), (0, 0, 0, 0))
    data, x = {}, 0
    for name, sprite in (("hanukkiah", h), ("tree", t), ("tree-plain", p)):
        sheet.alpha_composite(sprite, (x, 0))
        data[name] = {"sx": x, "w": sprite.width, "h": sprite.height}
        x += sprite.width
    data["hanukkiah"] |= {"at": PLACE["hanukkiah"][:2], "flames": flames(h, box, s)}
    for name, sprite in (("tree", t), ("tree-plain", p)):
        bulbs, star = lights(sprite)
        data[name] |= {"at": PLACE["tree"][:2], "bulbs": bulbs, "star": star}
    save_lossless(sheet, out / "props.webp")
    (out / "props.json").write_text(json.dumps(data, separators=(",", ":")))
    print("drew props.webp", sheet.size)
    if ready(PUMPKINS):
        halloween(out)
    if ready(BURSTS):
        fireworks(out)
    if ready([f"{n}_{k}" for n in GHOSTS for k in range(GHOST_FRAMES)]):
        framed(out, "ghosts", list(GHOSTS), GHOST_FRAMES, GHOST, paths=ghost_paths())
    if ready([f"bat_{k}" for k in range(BAT_FRAMES)]):
        framed(out, "bats", ["bat"], BAT_FRAMES, BAT, across=True)


def ready(names):
    """Whether all these picks are in: none is a set not painted yet (skipped, so the bake keeps the committed art), some a mistake."""
    have = [(PICKED / f"{n}.png").exists() for n in names]
    if any(have) and not all(have):
        sys.exit(f"missing picks: {[n for n, h in zip(names, have, strict=True) if not h]}")
    return all(have)


def face(name, sprite, box):
    """A lantern's carved face in its sprite: in the painting, what is inside its body (below the stem) and not its orange
    skin, dark holes or lit ones, box-reduced as the sprite was. Those pixels are painted the sprite's darkest colour, so
    it is unlit by day whatever the model did; returns them, the page's to light."""
    a = np.asarray(Image.open(PICKED / f"{name}.png").convert("RGBA")).astype(int)
    inside = np.asarray(Image.fromarray((a[..., 3] > 0).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(9))) > 0
    inside[:box[1] + (box[3] - box[1]) // 4] = False
    r, g = a[..., 0], a[..., 1]
    hole = inside & ((a[..., :3].max(axis=2) < 90) | ((r > 200) & (g > 0.7 * r)))
    m = Image.fromarray(hole.astype(np.uint8) * 255).crop(box).resize(sprite.size, Image.BOX)
    px, alpha = sprite.load(), np.asarray(sprite.getchannel("A")) > 0
    opaque = [px[x, y] for y in range(sprite.height) for x in range(sprite.width) if alpha[y, x]]
    dark = min(opaque, key=lambda c: sum(c[:3]))
    glow = [[x, y] for y in range(sprite.height) for x in range(sprite.width) if alpha[y, x] and m.getpixel((x, y)) > 90]
    for x, y in glow:
        px[x, y] = dark
    return glow


def halloween(out):
    """halloween.webp, the lanterns side by side, and halloween.json: each one's box and face, and where each stands."""
    sprites = {n: small(n, h) for n, (h, _, _) in PUMPKINS.items()}
    keep_out = [DOOR_OPEN, *[(x0, y0 - 4, x1, y1) for x0, y0, x1, y1 in PLAZAS]]   # a walker stands 4 px tall
    for name, (x, y, h) in PLACE.items():
        w = small(name, h)[0].width
        keep_out.append((x - w // 2, y - h, x - w // 2 + w - 1, y))
    for name, x, y in HALLOWEEN:
        sp = sprites[name][0]
        box = (x - sp.width // 2, y - sp.height, x - sp.width // 2 + sp.width - 1, y - 1)
        hit = [k for k in keep_out if box[0] <= k[2] and k[0] <= box[2] and box[1] <= k[3] and k[1] <= box[3]]
        assert not hit, f"{name} at {x, y} overlaps {hit}: move it in HALLOWEEN"
    sheet = Image.new("RGBA", (sum(s.width for s, _, _ in sprites.values()), max(s.height for s, _, _ in sprites.values())))
    data, x = {}, 0
    for n, (sprite, box, _) in sprites.items():
        glow = face(n, sprite, box)
        sheet.alpha_composite(sprite, (x, 0))
        data[n] = {"sx": x, "w": sprite.width, "h": sprite.height, "glow": glow}
        x += sprite.width
    save_lossless(sheet, out / "halloween.webp")
    (out / "halloween.json").write_text(json.dumps({"pumpkins": data, "places": HALLOWEEN}, separators=(",", ":")))
    print("drew halloween.webp", sheet.size)


def fireworks(out):
    """fireworks.webp, each burst's frames side by side (BURST_FRAMES from its one painting), and fireworks.json."""
    big = max(d for d, _, _ in BURSTS.values()) // 2
    depth = np.asarray(Image.open(DEPTH).convert("L")).astype(int)
    box = [SKY[0] - big, max(0, SKY[1] - big), SKY[2] + big, max(SKY[3] + big, SKY[3] + RISE)]   # every burst and spark
    x0, y0, x1, y1 = box
    sky = depth[0, x0:x1 + 1] + 5   # the depth map's sky, each column's top row, and its tolerance as scene-fx.js's TOL
    front = depth[y0:y1 + 1, x0:x1 + 1] > sky
    assert x1 < depth.shape[1], "the fireworks' box must be in the art"
    assert front.mean() < 0.25, "the tower and the crane would hide most bursts: move SKY into more open sky"
    fronts = []   # rows of [y, x0, x1], what stands in front of the sky
    for y, row in enumerate(front):
        xs = np.flatnonzero(row)
        for run in np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1) if len(xs) else []:
            fronts.append([y0 + y, x0 + int(run[0]), x0 + int(run[-1])])
    room = sum(all(math.dist((x, y), b) > CORE for b in LIGHTS["blinks"]) for x in range(SKY[0], SKY[2] + 1) for y in range(SKY[1], SKY[3] + 1))
    assert room > 0.8 * (SKY[2] - SKY[0] + 1) * (SKY[3] - SKY[1] + 1), "the crane's lights leave the bursts too little room"
    rows = []
    for name, (size, _, _) in BURSTS.items():
        src = Image.open(PICKED / f"{name}.png").convert("RGB")   # light on black: its brightness is its coverage
        light = []
        for scale, _, droop, _ in BURST_FRAMES:
            c = W / 2   # the pose's middle: x, y = c + (x', y' - c - droop) / scale
            f = src.transform(src.size, Image.AFFINE, (1 / scale, 0, c - c / scale, 0, 1 / scale, c - (c + droop) / scale), Image.BILINEAR)
            light.append(np.asarray(f.crop((16, 16, W - 16, H - 16)).resize((size, size), Image.BOX)).astype(float))
        # A pixel is lit where the box-reduced light passes LIT of the full bloom's brightest (its 95th percentile), so a
        # burst's own streaks decide, not one cut for all; kept at GAIN, as a reduced streak is dimmer than the spark.
        ref = np.percentile(light[BURST_FRAMES.index(next(f for f in BURST_FRAMES if f[0] == 1))].max(axis=2), 95)
        frames = []
        for k, ((_, bright, _, gone), a) in enumerate(zip(BURST_FRAMES, light, strict=True)):
            rnd = random.Random(f"{name}{k}")
            keep = (a.max(axis=2) > LIT * ref) & np.array([[rnd.random() >= gone for _ in range(size)] for _ in range(size)])
            rgb = Image.fromarray(np.clip(a * GAIN * bright, 0, 255).astype(np.uint8)).quantize(32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
            rgb.putalpha(Image.fromarray(keep.astype(np.uint8) * 255))
            frames.append(rgb)
        rows.append(frames)
    sheet = Image.new("RGBA", (sum(len(r) * r[0].width for r in rows), max(r[0].height for r in rows)))
    data, x = [], 0
    for frames in rows:
        data.append({"sx": x, "w": frames[0].width, "h": frames[0].height})
        for f in frames:
            sheet.alpha_composite(f, (x, 0))
            x += f.width
    save_lossless(sheet, out / "fireworks.webp")
    (out / "fireworks.json").write_text(json.dumps({"bursts": data, "frames": len(BURST_FRAMES), "grow": GROW, "sky": SKY, "box": box,
                                                    "fronts": fronts, "avoid": LIGHTS["blinks"], "core": CORE}, separators=(",", ":")))
    print("drew fireworks.webp", sheet.size)


def ghost_paths():
    """Each ghost's path, x0, x1, its bottom row and the depth it hides from: the ground under it at its row (the farthest
    within 8 px, as scene-fx.js's footAt), its middle along the path."""
    d = np.asarray(Image.open(DEPTH).convert("L")).astype(int)
    return [[x0, x1, y, int(np.median([d[g, max(0, x - 8):x + 9].min() for x in range(x0, x1 + 1)]))] for x0, x1, y, g in GHOST_PATHS]


def framed(out, stem, names, n, size, across=False, **more):
    """OUT/STEM.webp, a row per name and a column per frame (picks NAME_K.png), each row cut to its frames' union and
    scaled to `size` art px tall (across: wide) on 24 colours; and STEM.json, as scene-fx.js's people() reads it. Its
    foot is the frame's bottom row (across: its middle row, a bat's body), the same in every frame, so nothing jumps."""
    rows = []
    for name in names:
        ims = [Image.open(PICKED / f"{name}_{k}.png").convert("RGBA") for k in range(n)]
        boxes = [im.getchannel("A").getbbox() for im in ims]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        s = size / (box[2] - box[0] if across else box[3] - box[1])
        dims = (max(1, round((box[2] - box[0]) * s)), max(1, round((box[3] - box[1]) * s)))
        rows.append([reduce(im.crop(box), dims, 24, 110) for im in ims])
    fw, fh = max(r[0].width for r in rows), max(r[0].height for r in rows)
    sheet = Image.new("RGBA", (fw * n, fh * len(rows)))
    for j, row in enumerate(rows):
        for k, f in enumerate(row):
            sheet.paste(f, (k * fw + (fw - f.width) // 2, j * fh + fh - f.height))
    save_lossless(sheet, out / f"{stem}.webp")
    foot = [[fh // 2 if across else fh - 1] * n for _ in names]
    (out / f"{stem}.json").write_text(json.dumps({"people": names, "frames": n, "w": fw, "h": fh, "foot": foot, **more}))
    print(f"drew {stem}.webp", sheet.size)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    cmd = ap.add_subparsers(dest="cmd", required=True)
    cmd.add_parser("pose").add_argument("out", nargs="?", type=Path, default=CANDIDATES)
    sp = cmd.add_parser("paint")
    sp.add_argument("name", choices=sorted([*PROMPTS, *PUMPKINS, *BURSTS, *GHOSTS, "bat"]))
    sp.add_argument("seeds", nargs="+", type=int)
    sp.add_argument("--host", default="http://127.0.0.1:7860")
    cmd.add_parser("unflame").add_argument("seed", type=int)
    sp = cmd.add_parser("key")
    sp.add_argument("name")
    sp.add_argument("file", help="a candidate's file name; for a framed one (ghost-a, ghost-b, bat), its seed, or pose")
    cmd.add_parser("bake").add_argument("out", nargs="?", type=Path, default=OUT)
    a = ap.parse_args()
    if a.cmd == "pose":
        a.out.mkdir(parents=True, exist_ok=True)
        pose(a.out)
    elif a.cmd == "paint":
        paint(a.name, a.seeds, a.host)
    elif a.cmd == "unflame":
        unflame(a.seed)
    elif a.cmd == "key":
        key(a.name, a.file)
    else:
        bake(a.out)
