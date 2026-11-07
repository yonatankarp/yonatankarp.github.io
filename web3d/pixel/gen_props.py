# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""The holidays' props on the city's tower plaza (web3d/src/props.js): a hanukkiah and a Christmas tree, painted on
magenta, keyed, and baked the city's way.

Run: uv run web3d/pixel/gen_props.py pose                     # the shapes the model paints over, on magenta
     uv run web3d/pixel/gen_props.py paint NAME SEED...       # Draw Things paints them (port 7860): hanukkiah, tree,
                                                              # or tree-plain (the snowy tree's pick with its snow taken off)
     uv run web3d/pixel/gen_props.py unflame SEED             # the hanukkiah's candidate with the candles' painted flames erased
     uv run web3d/pixel/gen_props.py key NAME FILE            # a candidate keyed off its magenta into picks/props/NAME.png
     uv run web3d/pixel/gen_props.py bake [OUT]               # OUT/props.webp and OUT/props.json

The picks are hanukkiah 11 (unflamed: the model lit the candles anyway, and the page lights the right ones in code), tree
11 (snowy, for winter) and tree-plain 11 (that tree with the snow painted off, for Christmas in a southern summer). Each
is box-reduced to its height in art px on 32 colours, its edge hard (alpha over 80), as the city is. props.json has where
each stands (its foot's middle, in the city's art px), the sprites' boxes in props.webp, the hanukkiah's candle tops
(flames, left to right as you face it, the shamash in the middle) and the tree's bulbs and star.
"""
import base64
import io
import json
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint_rooms import OUT as CANDIDATES, call  # noqa: E402

PICKED = Path(__file__).resolve().parent / "paintings" / "picks" / "props"
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


def pose():
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
    h.save(CANDIDATES / "hanukkiah_pose.png")
    t = Image.new("RGB", (W, H), MAG)
    d = ImageDraw.Draw(t)
    d.ellipse([196, 440, 316, 470], fill=(90, 70, 50))
    d.rectangle([244, 400, 268, 455], fill=(80, 55, 35))
    for y0, y1, w in [(70, 200, 70), (150, 300, 110), (240, 420, 150)]:
        d.polygon([(256, y0), (256 - w, y1), (256 + w, y1)], fill=(36, 82, 50))
    d.regular_polygon((256, 64, 22), 5, fill=(240, 200, 80))
    t.save(CANDIDATES / "tree_pose.png")


def paint(name, seeds, host="http://127.0.0.1:7860"):
    buf = io.BytesIO()
    Image.open(INIT.get(name, CANDIDATES / f"{name}_pose.png")).convert("RGB").save(buf, "PNG")
    for seed in seeds:
        out = CANDIDATES / f"{name}_{seed}.png"
        if out.exists():
            print("kept", out.name)
            continue
        res = call(host, "/sdapi/v1/img2img", {"prompt": PROMPTS[name], "width": W, "height": H, "seed": seed, "batch_size": 1,
                                               "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        out.write_bytes(base64.b64decode(res["images"][0].split(",")[-1]))
        print("painted", out.name, flush=True)


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
    """Magenta (and the model's pinkish fringe of it) to clear, shrunk a pixel so no fringe is left: picks/props/NAME.png."""
    a = np.asarray(Image.open(CANDIDATES / file).convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = ((g < 0.55 * np.minimum(r, b)) | ((r > 200) & (b > 150) & (g < 0.6 * r))) & (r > 60) & (b > 60)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    im = Image.fromarray(a.astype(np.uint8), "RGB")
    im.putalpha(alpha)
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
    sm = im.convert("RGBa").resize((max(1, round(im.width * s)), height), Image.BOX).convert("RGBA")
    rgb = sm.convert("RGB").quantize(32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    rgb.putalpha(sm.getchannel("A").point(lambda v: 255 if v > 80 else 0))
    return rgb, box, s


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
    sheet.save(out / "props.webp", "WEBP", lossless=True, quality=100, method=6, exact=True)
    (out / "props.json").write_text(json.dumps(data, separators=(",", ":")))
    print("drew props.webp", sheet.size)


if __name__ == "__main__":
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == "pose":
        pose()
    elif cmd == "paint":
        paint(args[0], [int(a) for a in args[1:]])
    elif cmd == "unflame":
        unflame(int(args[0]))
    elif cmd == "key":
        key(args[0], args[1])
    else:
        bake(Path(args[0] if args else "static/building/pixel"))
