# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
# ///
"""The homepage's city: a wide aerial panorama the page pans sideways, with a label pinned on each district.

Run: uv run web3d/pixel/gen_city.py blockout [OUT]                  # the code blockout, for a look
     uv run web3d/pixel/gen_city.py paint [--count N] [--start S]   # Draw Things repaints the blockout at dusk (port 7860)
     uv run web3d/pixel/gen_city.py paint --time PHASE [...]        # ... or edits the dusk pick to another hour
     uv run web3d/pixel/gen_city.py build [OUT]                     # OUT/city.webp, city-PHASE.webp for every other
                                                                    # phase in data/phases.json, city.json, city-fx.json
                                                                    # and city-depth.png
     uv run web3d/pixel/gen_city.py json [OUT]                      # only OUT/city.json

The blockout fixes where every district sits; the model paints over it, and the picked painting (PICKS) is box-reduced
to ART_W wide on COLOURS colours, undithered. The other hours are the dusk pick edited by the model, which keeps the
composition, so the labels' anchors (city.json, read by layouts/index.html) hold at every hour.
Paintings go to web3d/pixel/paintings/candidates/city[-PHASE]_SEED.png (not committed); the chosen one is copied to
web3d/pixel/paintings/picks/city[-PHASE].png, the build's input, and its seed noted in PICKS.

The city's animations (web3d/src/city-fx.js) draw from city-fx.json: the lit windows and the bay found in the baked art,
and the walks, lanes and lights below. Their depth map, picks/city-depth.png, is made by depth_map.py (it needs torch)
and copied here as it is, so this script never needs torch.
"""
import argparse
import base64
import io
import json
import math
import shutil
import sys
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint_rooms import OUT as CANDIDATES, call  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PW, H = 3456, 864                # the blockout: 4:1, so every district can be panned to the middle with city either side
PH = H // 64 * 64                # the painting's rows: Draw Things paints whole 64s, and pick 700's last 32 rows are black
ART_W, COLOURS = 1440, 64
SIZE = [ART_W, round(ART_W * PH / PW)]
PICKS = {"dusk": 700, "dawn": 700, "day": 700, "night": 700}   # the seed of each hour's pick, for the record
PICKED = Path(__file__).resolve().parent / "paintings" / "picks"   # picks/city[-PHASE].png: each hour's chosen candidate
SPOTS = {"radio": (1090, 470), "library": (1180, 720), "tower": (1760, 580), "post": (2420, 470), "workshop": (2300, 730)}
LOTS = {"radio": (970, 380, 1210, 490), "post": (2290, 360, 2560, 490), "library": (1010, 560, 1380, 740),
        "workshop": (2080, 610, 2520, 750)}   # x0, y0, x1, y1: kept clear for each landmark
# Where pick 700 painted a landmark's top away from the blockout's, in painting pixels: its mast and clock tower taller.
PAINTED = {"radio": (9, -85), "library": (0, -6), "workshop": (27, -8), "post": (0, -26)}


def box(d, x, y, w, depth, h, top, left, right):
    """An oblique box standing on (x, y): front-left corner at ground, w wide, depth deep (goes up-right), h tall."""
    dx, dy = depth * 0.6, -depth * 0.35
    d.polygon([(x, y), (x + w, y), (x + w, y - h), (x, y - h)], left)
    d.polygon([(x + w, y), (x + w + dx, y + dy), (x + w + dx, y + dy - h), (x + w, y - h)], right)
    d.polygon([(x, y - h), (x + w, y - h), (x + w + dx, y + dy - h), (x + dx, y + dy - h)], top)


def blocks(d):
    """Pack the city: mid-rise blocks inside the ring road, houses and trees outside it. Roads, the plaza, the
    landmarks' lots, the bay and the farmland stay clear. Drawn back to front so nearer blocks overlap farther ones."""
    rng = Random(5)
    for y in range(340, H + 20, 30):
        for gx in range(600 + (y // 30 % 2) * 22, 2720, 44):
            x = gx + rng.randint(-6, 6)
            r = math.hypot((x - 1760) / 880, (y - 580) / 180)
            if abs(r - 1) < 0.1 or ((x - 1760) / 240) ** 2 + ((y - 570) / 90) ** 2 < 1:   # ring road, plaza
                continue
            if (abs(x - 1760) < 40 and y > 740) or (570 < y < 640 and (x < 900 or x > 2620)):   # avenues
                continue
            if any(x0 - 40 < x < x1 and y0 < y < y1 + 30 for x0, y0, x1, y1 in LOTS.values()):
                continue
            if rng.random() < 0.22:
                d.ellipse([x, y - 26, x + 34, y + 4], fill=(70, 115, 55))                            # a tree
            elif r < 1:
                h = rng.choice((36, 48, 60, 76))
                box(d, x, y, 36, 30, h, rng.choice([(150, 140, 130), (170, 80, 60), (120, 110, 105)]),
                    rng.choice([(225, 210, 180), (200, 120, 90), (210, 200, 185)]), (150, 130, 115))  # a mid-rise block
            else:
                box(d, x, y, 30, 24, 20, rng.choice([(190, 90, 70), (170, 75, 60), (130, 110, 100)]),
                    (225, 210, 185), (180, 160, 140))                                                  # a house


def blockout():
    im = Image.new("RGB", (PW, H))
    d = ImageDraw.Draw(im)
    for y in range(230):                                   # dusk sky, purple to peach
        t = y / 230
        d.line([(0, y), (PW, y)], (int(90 + 160 * t), int(60 + 110 * t), int(130 - 10 * t)))
    d.polygon([(0, 205), (500, 165), (900, 210), (1400, 170), (1900, 155), (2400, 200), (2900, 160), (PW, 195), (PW, 235), (0, 235)], (110, 90, 120))
    d.rectangle([0, 225, PW, 250], (240, 170, 110))        # the sea glowing at the horizon
    d.rectangle([0, 250, PW, H], (120, 140, 80))           # land
    for i in range(66):                                    # far suburbs
        box(d, 20 + i * 52, 300 + (i % 3) * 8, 34, 30, 22 + (i * 7) % 20, (200, 190, 170), (150, 130, 120), (120, 100, 100))
    # left edge: a bay with a beach and houses stepping down to it
    d.polygon([(0, 330), (260, 360), (520, 470), (600, 620), (480, 760), (300, H), (0, H)], (230, 210, 160))
    d.polygon([(0, 360), (220, 390), (450, 480), (520, 620), (400, 750), (220, H), (0, H)], (80, 130, 170))
    for row in range(6):
        for i in range(5):
            box(d, 560 + i * 60 + row * 25, 340 + row * 80, 36, 28, 24, (190, 90, 70), (220, 200, 170), (180, 160, 140))
    # right edge: solar fields and greenhouses on farmland
    for row in range(5):
        for i in range(6):
            x, y = 2780 + i * 105 - row * 20, 350 + row * 95
            if row % 2:
                box(d, x, y, 80, 50, 26, (210, 225, 230), (190, 205, 210), (160, 175, 180))   # greenhouses
            else:
                d.polygon([(x, y), (x + 85, y), (x + 100, y - 30), (x + 15, y - 30)], (50, 70, 120))   # solar
    d.ellipse([880, 400, 2640, 760], outline=(90, 90, 95), width=26)    # ring road, avenues, the plaza
    d.line([(1760, 760), (1760, H)], (90, 90, 95), 30)
    d.line([(600, 620), (880, 590)], (90, 90, 95), 20)
    d.line([(2640, 590), (PW, 620)], (90, 90, 95), 20)
    d.ellipse([1550, 500, 1970, 640], fill=(200, 180, 140))
    blocks(d)
    x, y = SPOTS["radio"]                                  # radio station and its lattice mast
    box(d, x - 85, y, 150, 90, 70, (190, 90, 70), (160, 70, 60), (120, 55, 50))
    for k in range(0, 200, 20):
        d.line([(x - k * 0.08, y - 70 - k), (x + k * 0.08, y - 90 - k)], (200, 60, 50), 4)
        d.line([(x + k * 0.08, y - 70 - k), (x - k * 0.08, y - 90 - k)], (200, 60, 50), 4)
    d.line([(x, y - 70), (x, y - 290)], (220, 70, 60), 6)
    x, y = SPOTS["post"]                                   # post office and clock tower
    box(d, x - 85, y, 170, 90, 80, (170, 70, 60), (220, 200, 170), (180, 160, 140))
    box(d, x - 20, y - 80, 40, 30, 90, (60, 90, 110), (220, 200, 170), (180, 160, 140))
    d.ellipse([x - 15, y - 150, x + 15, y - 120], fill=(250, 240, 210), outline=(40, 40, 40), width=3)
    x, y = SPOTS["library"]                                # library, columns and dome
    box(d, x - 130, y, 260, 110, 90, (150, 150, 140), (230, 220, 200), (190, 180, 160))
    for k in range(8):
        d.rectangle([x - 115 + k * 31, y - 70, x - 105 + k * 31, y - 2], (250, 245, 230))
    d.pieslice([x - 60, y - 160, x + 60, y - 40], 180, 360, (110, 140, 130))
    x, y = SPOTS["workshop"]                               # workshops with sawtooth roofs
    for k in range(4):
        bx = x - 180 + k * 80
        box(d, bx, y, 70, 100, 55, (90, 80, 75), (170, 110, 80), (130, 85, 65))
        d.polygon([(bx, y - 55), (bx + 70, y - 55), (bx + 70, y - 90)], (200, 220, 230))
    x, y = SPOTS["tower"]                                  # the career tower and its crane
    box(d, x - 48, y, 96, 60, 420, (200, 120, 70), (190, 110, 80), (140, 80, 60))
    for k in range(9):
        d.rectangle([x - 38, 200 + k * 42, x + 38, 222 + k * 42], (255, 200, 110))
    d.line([(x + 32, 160), (x + 32, 40)], (240, 190, 40), 6)
    d.line([(x - 48, 50), (x + 132, 50)], (240, 190, 40), 6)
    for tx, ty in [(1500, 560), (2000, 560), (1400, 770), (2050, 790), (950, 650), (2580, 660), (1380, 470), (2150, 470)]:
        d.ellipse([tx, ty, tx + 60, ty + 40], fill=(60, 110, 50))
    return im


def anchors():
    """Each label's anchor, in % of the painting (x, top): the top of its landmark in the blockout, where the label's
    bottom sits, moved to where the pick painted it."""
    (tx, _), (rx, ry), (lx, ly), (wx, wy), (px, py) = (SPOTS[k] for k in ("tower", "radio", "library", "workshop", "post"))
    tops = {"tower": (tx + 42, 40),          # the crane: mid-jib, at its mast's top
            "library": (lx, ly - 160),       # the dome
            "workshop": (wx - 25, wy - 90),  # mid-row, at the sawtooth roofs
            "radio": (rx, ry - 290),         # the mast's tip
            "post": (px, py - 150)}          # the clock
    return {k: [round(100 * (x + PAINTED.get(k, (0, 0))[0]) / PW, 1), round(100 * (y + PAINTED.get(k, (0, 0))[1]) / PH)]
            for k, (x, y) in tops.items()}


DUSK = (
    "Edit this picture. Repaint it as a highly detailed wide panoramic aerial bird's-eye view of a small green coastal city at dusk, "
    "rich painterly video game art like a city-builder game, warm golden sunset light, long soft shadows, haze over "
    "the distant hills and the glowing sea. Keep every shape exactly where it is. In the centre a tall brick and glass "
    "office tower with a lit window on every storey and a yellow construction crane on its roof, standing in a round "
    "plaza with trees. Back left: a small red-brick radio station with a tall red and white lattice radio mast. Back "
    "right: a cream stone post office with a clock tower. Front left: a grand public library with stone columns and a "
    "green copper dome. Front right: a row of brick maker workshops with sawtooth glass roofs and open roller doors. "
    "On the far left, a curving sandy bay with calm water and small houses with red roofs stepping down to it. On the "
    "far right, farmland with rows of solar panels and glass greenhouses. A ring road around the centre. Every block is densely built up: detailed mid-rise buildings with rooftop gardens "
    "inside the ring, streets of small houses with red tiled roofs and gardens outside it, tree-lined streets, warm "
    "street lamps coming on. No people, no text, no letters, no logos, no signs and no writing on any building.")
KEEP = ("Keep every building, road, tree, the coastline, the hills and the composition exactly the same, in the same "
        "painterly video game style. No people, no text, no letters, no logos and no writing on any building.")
HOURS = {
    "dawn": "early dawn, just before sunrise: a cool pale blue and soft pink sky, the first pale light on the hills and "
            "the sea, soft long shadows, a few windows and street lamps still lit",
    "day": "a bright clear midday: a clear blue sky, strong high sunlight, crisp short shadows, vivid green parks and "
           "blue sea, no lights on",
    "night": "night: a dark deep blue sky with a few stars, the city lit up, warm yellow light in many windows, every "
             "street lamp glowing along the roads, the tower's windows bright, the sea dark with reflections",
}


def pick(phase):
    path = PICKED / f"city{'' if phase == 'dusk' else '-' + phase}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint {phase} (gen_city.py paint --time {phase}), copy the chosen candidate there and note its seed in PICKS")
    return path


def paint(count, start, host, phase):
    base = blockout().resize((PW, PH), Image.LANCZOS) if phase == "dusk" else Image.open(pick("dusk")).convert("RGB").crop((0, 0, PW, PH))
    buf = io.BytesIO()
    base.save(buf, "PNG")
    prompt = DUSK if phase == "dusk" else f"Edit this picture. Change only the time of day to {HOURS[phase]}. {KEEP}"
    for k in range(count):
        seed = start + 17 * k
        path = CANDIDATES / f"city{'' if phase == 'dusk' else '-' + phase}_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        res = call(host, "/sdapi/v1/img2img", {"prompt": prompt, "width": PW, "height": PH, "seed": seed, "batch_size": 1,
                                               "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        Image.open(io.BytesIO(base64.b64decode(res["images"][0].split(",")[-1]))).save(path)
        print("painted", path.name, flush=True)


def bake(phase):
    """The painting box-reduced to the art's size, on its own COLOURS colours: the pixel look, with no dither to shimmer."""
    im = Image.open(pick(phase)).convert("RGB").crop((0, 0, PW, PH))
    small = im.resize(SIZE, Image.BOX)
    return small.quantize(COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")


# Where the city's animations go, in art pixels (city-fx.js). Only open ground, so nothing that stands in front of a
# mover is drawn behind it; city-depth.png hides them behind trees and lamp posts on the way.
WALKS = [[452, 299, 995, 299],    # x0, y0, x1, y1: the main street's near pavement
         [737, 302, 739, 346]]    # the avenue toward the viewer, walked faster
PLAZAS = [[670, 208, 708, 220], [774, 215, 816, 232]]   # x0, y0, x1, y1: the open paving either side of the tower
LANES = [[[455, 293], [995, 293]], [[995, 296], [455, 296]],   # the main street's two lanes, and the ring road's curve up past Workshop Row
         [[1000, 290], [1030, 280], [1052, 262], [1066, 240], [1080, 218], [1096, 198]]]
LIGHTS = {"beacon": [457, 39], "blinks": [[800, 37], [746, 18]]}   # the radio mast's top, the crane's tips


def spread(seeds, ok, size):
    """Every pixel 4-connected to the seeds through pixels that pass ok."""
    (w, h), seen = size, set(seeds)
    todo = list(seen)
    while todo:
        x, y = todo.pop()
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= q[0] < w and 0 <= q[1] < h and q not in seen and ok(q):
                seen.add(q)
                todo.append(q)
    return seen


def ground(night, day, dusk):
    """Everything but the sky: what the bottom row reaches without crossing it. The sky is what the top row reaches
    through pixels that are sky at every hour: blue or cloud by day, dark at night and bright at dusk (the hazy hills and
    islands are not as blue by day). The stars, warm spots in it like windows, are its holes, so outside this."""
    n, d, u = night.load(), day.load(), dusk.load()

    def blue(q):
        a, b = d[q], n[q]
        return (a[2] > a[0] + 40 or (min(a) > 140 and max(a) - min(a) < 45)) and b[2] >= b[0] - 2 and sum(b) < 150 and sum(u[q]) > 200

    (w, h) = night.size
    sky = spread([(x, 0) for x in range(w) if blue((x, 0))], blue, night.size)
    return spread([(x, h - 1) for x in range(w) if (x, h - 1) not in sky], lambda q: q not in sky, night.size)


def windows(night, day, dusk):
    """The lit windows of the night art: small spots of warm light (4-connected, at most 14 px, inside 5x5), so the
    library's lit facade and the lit roads stay out, and not in the sky, where they are stars. Each goes dark in its
    wall's colour, the darkest pixel around it."""
    (w, h), px, land = night.size, night.load(), ground(night, day, dusk)
    lit = {(x, y) for y in range(h) for x in range(w)
           if (p := px[x, y])[0] > 140 and p[1] > 100 and p[2] < 100 and p[0] - p[2] > 55}
    found = []
    for y in range(h):
        for x in range(w):
            if (x, y) not in lit:
                continue
            comp, todo = [], [(x, y)]
            lit.discard((x, y))
            while todo:
                cx, cy = todo.pop()
                comp.append((cx, cy))
                for q in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if q in lit:
                        lit.discard(q)
                        todo.append(q)
            xs, ys = [c[0] for c in comp], [c[1] for c in comp]
            if len(comp) > 14 or max(xs) - min(xs) > 4 or max(ys) - min(ys) > 4 or comp[0] not in land:
                continue
            ring = {(cx + dx, cy + dy) for cx, cy in comp for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - set(comp)
            wall = min((px[q] for q in sorted(ring) if 0 <= q[0] < w and 0 <= q[1] < h), key=sum)
            found.append({"wall": list(wall), "px": sorted(comp)})
    return found


def sea(night, dusk):
    """The bay, as runs [y, x0, x1] per row: dark blue water at night that glows at dusk, on the left of the art."""
    n, d, runs = night.load(), dusk.load(), []
    for y in range(101, night.size[1]):
        for x in range(300):
            if not ((p := n[x, y])[2] > p[0] + 10 and p[2] >= p[1] and sum(p) < 170 and sum(d[x, y]) > 330):
                continue
            if runs and runs[-1][0] == y and runs[-1][2] == x - 1:
                runs[-1][2] = x
            else:
                runs.append([y, x, x])
    return runs


def write_fx(out, night, day, dusk):
    (out / "city-fx.json").write_text(json.dumps({"windows": windows(night, day, dusk), "sea": sea(night, dusk), "walks": WALKS,
                                                  "plazas": PLAZAS, "lanes": LANES, "lights": LIGHTS}, separators=(",", ":")))
    shutil.copyfile(PICKED / "city-depth.png", out / "city-depth.png")   # depth_map.py's map, as it is


def write_json(out):
    (out / "city.json").write_text(json.dumps({"size": SIZE, "labels": anchors()}))


def build(out):
    phases = json.loads((ROOT / "data" / "phases.json").read_text())
    if set(phases) != set(PICKS):
        sys.exit(f"PICKS has {sorted(PICKS)}, data/phases.json has {sorted(phases)}: give every phase a painting")
    baked = {phase: bake(phase) for phase in phases}
    for phase, im in baked.items():
        path = out / f"city{'' if phase == 'dusk' else '-' + phase}.webp"
        im.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        print("drew", path.name, "from seed", PICKS[phase])
    write_json(out)
    write_fx(out, baked["night"], baked["day"], baked["dusk"])


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["blockout", "paint", "build", "json"])
    ap.add_argument("out", nargs="?", default="static/building/pixel")
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--start", type=int, default=700)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    ap.add_argument("--time", choices=list(PICKS), default="dusk")
    a = ap.parse_args()
    if a.cmd == "blockout":
        blockout().save(Path(a.out) / "city-blockout.png")
        print("wrote", Path(a.out) / "city-blockout.png")
    elif a.cmd == "paint":
        paint(a.count, a.start, a.host, a.time)
    elif a.cmd == "json":
        write_json(Path(a.out))
    else:
        build(Path(a.out))
