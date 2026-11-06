# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
# ///
"""The projects' Workshop Row: four brick workshops along a street, a panorama the page pans sideways, a label on each.

Run: uv run web3d/pixel/gen_workshop.py blockout [OUT]                  # the code blockout, for a look
     uv run web3d/pixel/gen_workshop.py paint [--count N] [--start S]   # Draw Things repaints the blockout at dusk (port 7860)
     uv run web3d/pixel/gen_workshop.py paint --time PHASE [...]        # ... or edits the dusk pick to another hour
     uv run web3d/pixel/gen_workshop.py build [OUT]                     # OUT/workshop[-PHASE].webp, workshop.json,
                                                                        # workshop-fx.json and workshop-depth.png
     uv run web3d/pixel/gen_workshop.py json [OUT]                      # only OUT/workshop.json

The Library's pipeline (gen_library.py) out on the street, so it follows the clock as the city does (gen_city.py): the
blockout fixes where every workshop sits, the model paints it at dusk, the other hours are that pick edited, and each is
box-reduced and quantised undithered; the kerb lamp at x 245, which the model left dark at every hour, is lit after
that but by day (relight). The workshops are numbered, not named: the projects' template
(layouts/projects/list.html) puts the groups in them in order, apps first.
Paintings go to web3d/pixel/paintings/candidates/workshop[-PHASE]_SEED.png (not committed); the chosen one is copied to
web3d/pixel/paintings/picks/workshop[-PHASE].png, the build's input, and its seed noted in PICKS.

The row's animations (web3d/src/workshop-fx.js) draw from workshop-fx.json, the places below, and hide behind what
stands nearer in picks/workshop-depth.png, made by depth_map.py (it needs torch) and copied here as it is.
"""
import argparse
import base64
import io
import json
import math
import sys
import urllib.request
from itertools import pairwise
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_city import ART_W, COLOURS, PH, PW, ROOT, SIZE, H  # noqa: E402
from paint_rooms import OUT as CANDIDATES  # noqa: E402

PICKS = {"dusk": 1000, "dawn": 1000, "day": 1000, "night": 1000}   # the seed of each hour's pick, for the record
PICKED = Path(__file__).resolve().parent / "paintings" / "picks"   # picks/workshop[-PHASE].png
BAYS = [900, 1480, 2060, 2640]   # each workshop's centre, all pannable to the middle of the view
HALF, EAVE, GROUND = 260, 330, 660   # half a workshop's width, its eaves, the pavement's edge
BRICK, MORTAR, GLASS, LIGHT = (150, 62, 45), (120, 50, 38), (170, 200, 215), (255, 190, 100)


def workshop(d, x):
    """A brick workshop centred on x: three sawtooth glass roof teeth, a wide roller door rolled up onto a lit bench."""
    x0, x1 = x - HALF, x + HALF
    for k in range(3):                                                         # the sawtooth roof
        a, b = x0 + k * (2 * HALF) // 3, x0 + (k + 1) * (2 * HALF) // 3
        d.polygon([(a, EAVE), (b, EAVE), (b, EAVE - 110)], (95, 85, 80))
        d.polygon([(b - 14, EAVE - 100), (b, EAVE - 110), (b, EAVE), (b - 14, EAVE)], GLASS)
    d.rectangle([x0, EAVE, x1, GROUND], BRICK)
    for y in range(EAVE + 12, GROUND, 18):                                     # brick courses
        d.line([(x0, y), (x1, y)], MORTAR, 2)
    d.rectangle([x0 - 8, EAVE - 6, x1 + 8, EAVE + 8], (110, 60, 45))           # the parapet
    d.rectangle([x - 150, 430, x + 150, GROUND], (60, 40, 30))                 # the open door, a warm room behind it
    d.rectangle([x - 140, 440, x + 140, GROUND], (230, 150, 80))
    d.rectangle([x - 150, 420, x + 150, 440], (200, 200, 195))                 # the rolled-up door
    d.rectangle([x - 110, 560, x + 110, 580], (110, 70, 40))                   # the workbench, a screen and tools on it
    d.rectangle([x - 100, 580, x - 90, GROUND], (70, 45, 30))
    d.rectangle([x + 90, 580, x + 100, GROUND], (70, 45, 30))
    d.rectangle([x - 40, 500, x + 30, 555], (40, 60, 90))
    d.rectangle([x - 34, 506, x + 24, 549], (120, 200, 230))
    d.rectangle([x - 130, 460, x - 60, 480], (90, 90, 100))                    # a shelf of parts on the back wall
    d.rectangle([x + 60, 460, x + 130, 480], (90, 90, 100))
    d.ellipse([x - 10, 440, x + 10, 456], LIGHT)                               # a hanging lamp
    for wx in (x0 + 30, x1 - 80):                                              # a tall window either side
        d.rectangle([wx, 400, wx + 50, 560], (60, 45, 40))
        d.rectangle([wx + 6, 406, wx + 44, 554], LIGHT)


def blockout():
    im = Image.new("RGB", (PW, H))
    d = ImageDraw.Draw(im)
    for y in range(EAVE):                                                      # dusk sky, purple to peach
        t = y / EAVE
        d.line([(0, y), (PW, y)], (int(90 + 160 * t), int(60 + 110 * t), int(130 - 10 * t)))
    d.polygon([(0, 300), (400, 250), (700, 290), (1100, 240), (3000, 260), (3456, 230), (PW, 330), (0, 330)], (110, 90, 120))
    d.rectangle([0, 330, PW, GROUND], (90, 70, 70))                            # the far side of the street, in shadow
    for x in BAYS:
        workshop(d, x)
    for a, b in pairwise(BAYS):                                             # a narrow alley and a downpipe between workshops
        d.rectangle([a + HALF, 380, b - HALF, GROUND], (50, 40, 45))
        d.line([((a + b) // 2, 340), ((a + b) // 2, GROUND)], (70, 70, 75), 6)
    d.rectangle([0, GROUND, PW, 720], (150, 140, 130))                         # the pavement, the kerb, the cobbled street
    d.rectangle([0, 716, PW, 726], (110, 105, 100))
    d.rectangle([0, 726, PW, H], (80, 75, 80))
    for x in (300, 1190, 1770, 2350, 3150):                                    # street lamps
        d.line([(x, 420), (x, 720)], (40, 40, 45), 8)
        d.ellipse([x - 16, 400, x + 16, 432], LIGHT)
    d.ellipse([60, 380, 300, 640], (60, 100, 55))                              # left: trees and a brick wall
    d.rectangle([0, 520, 620, GROUND], BRICK)
    d.rectangle([2960, 540, 3260, 690], (190, 190, 180))                       # right: a parked van, crates, a tree
    d.rectangle([3260, 590, 3350, 690], (170, 170, 160))
    for wx in (3010, 3240):
        d.ellipse([wx - 30, 660, wx + 30, 720], (30, 30, 30))
    for k in range(3):
        d.rectangle([2920 - k * 40, 620 - k * 30, 2960 - k * 40, 660], (150, 110, 60))
    d.ellipse([3220, 300, 3456, 560], (60, 100, 55))
    return im


def anchors():
    """Each label's anchor, in % of the painting (x, top): the peak of its workshop's middle roof tooth."""
    tops = {f"bay-{i + 1}": (x, EAVE - 110) for i, x in enumerate(BAYS)}
    return {k: [round(100 * x / PW, 1), round(100 * y / H)] for k, (x, y) in tops.items()}


DUSK = (
    "Edit this picture. Repaint it as a highly detailed wide panoramic street view of a row of four separate red-brick "
    "maker workshops at dusk, seen straight on from across a cobbled street, rich painterly video game art like a "
    "city-builder game, warm golden light, soft glowing highlights and deep cosy shadows. Keep every shape exactly where "
    "it is. Each workshop is its own building with a sawtooth roof of slanted glass skylights, a narrow dark alley "
    "between each pair, and a wide roller door rolled up to show a warm-lit workshop inside: a wooden workbench with "
    "tools, small parts and a glowing computer screen, shelves of boxes and parts on the back wall, a hanging lamp. Tall "
    "lit windows either side of each door. Iron street lamps glowing along the pavement. A purple and peach sunset sky "
    "above the roofs. On the far left, leafy trees and a low brick wall; on the far right, a parked white delivery van, "
    "wooden crates and a tree. No people, no text, no letters, no numbers, no logos, no signs and no writing anywhere.")
KEEP = ("Keep every building, door, window, workbench, lamp, the street and the composition exactly the same, in the same "
        "painterly video game style. No people, no text, no letters, no numbers, no logos, no signs and no writing anywhere.")
HOURS = {
    "dawn": "early dawn, just before sunrise: a cool pale blue and soft pink sky, the first pale light on the brick, soft "
            "long shadows, the street lamps and a few workshop lights still lit",
    "day": "a bright clear midday: a clear blue sky, strong high sunlight on the red brick, crisp short shadows, the "
           "skylights reflecting the sky, the street lamps off, the workshops lit by daylight",
    "night": "night: a dark deep blue sky with a few stars, every street lamp glowing on the cobbles, the open workshops "
             "glowing warm yellow from inside, the brick dark and lit only by lamplight",
}


def name(phase):
    return f"workshop{'' if phase == 'dusk' else '-' + phase}"


def pick(phase):
    path = PICKED / f"{name(phase)}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint {phase} (gen_workshop.py paint --time {phase}), copy the chosen candidate there and note its seed in PICKS")
    return path


def call(host, payload):
    """One img2img job. Draw Things paints one job at a time, so a queue of other jobs can hold this one for long."""
    req = urllib.request.Request(host + "/sdapi/v1/img2img", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=4 * 3600) as r:
        return json.loads(r.read())


def paint(count, start, host, phase):
    base = blockout().resize((PW, PH), Image.LANCZOS) if phase == "dusk" else Image.open(pick("dusk")).convert("RGB").crop((0, 0, PW, PH))
    buf = io.BytesIO()
    base.save(buf, "PNG")
    prompt = DUSK if phase == "dusk" else f"Edit this picture. Change only the time of day to {HOURS[phase]}. {KEEP}"
    CANDIDATES.mkdir(parents=True, exist_ok=True)
    for k in range(count):
        seed = start + 17 * k
        path = CANDIDATES / f"{name(phase)}_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        res = call(host, {"prompt": prompt, "width": PW, "height": PH, "seed": seed, "batch_size": 1, "strength": 1.0,
                          "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        Image.open(io.BytesIO(base64.b64decode(res["images"][0].split(",")[-1]))).save(path)
        print("painted", path.name, flush=True)


def bake(phase):
    """The painting box-reduced to the art's size on its own COLOURS colours, undithered, with the Library's k-means
    passes after the median cut so the small lamps keep a colour of their own."""
    im = Image.open(pick(phase)).convert("RGB").crop((0, 0, PW, PH))
    im = im.resize(SIZE, Image.BOX).quantize(COLOURS, method=Image.Quantize.MEDIANCUT, kmeans=3, dither=Image.Dither.NONE).convert("RGB")
    return im if phase == "day" else relight(im)


def relight(im, cx=245, cy=151, glass=(239, 146, 252, 157)):
    """Lights the kerb lamp at x 245, which every hour's painting left dark: its glass glows and five flat warm rings
    spread round it to ~32 px, as the median cut leaves the other lamps' halos, over all but the dark iron."""
    px = im.load()
    for y in range(cy - 36, cy + 36):
        for x in range(cx - 36, cx + 36):
            r, g, b = px[x, y]
            if glass[0] <= x <= glass[2] and glass[1] <= y <= glass[3] and r > 100 and r > b + 20:   # the panes, not the frame
                px[x, y] = (252, 246, 214) if r > 150 else (246, 206, 140)
                continue
            band = 5 - min(5, int(math.hypot(x - cx, (y - cy) * 1.05) // 6.5))
            if band and r + g + b > 150:   # the sky, wall and leaves round it, not the dark iron
                k = (.1, .2, .32, .46, .62)[band - 1]
                px[x, y] = tuple(int(c + (w - c) * k) for c, w in zip((r, g, b), (246, 178, 112), strict=True))
    return im


# Where the row's animations go, in art pixels (workshop-fx.js).
FX = {
    "pavement": [270, 1205],             # x0, x1: where the painted walkers (gen_walkers.py) start, behind the lamp posts at the
                                         # kerb; past x1 the van stands in front of it, so a walker's feet stay at x1's depth
    "edge": [-30, 1470],                 # off the art's ends, where walkers and cats leave and come back
    "lanes": [271, 277],                 # their feet's rows, far then near: the near one 6 rows above the lamp posts' bases
                                         # (row 283), so its walkers pass behind the posts at the kerb as the far one's do
    "wall": [24, 210, 250],              # x0, y, x1: the left brick wall's top, where the cats (cats.js) walk, sit and loaf
    "street": 284,                       # the pavement's front by the kerb, the row the cats trot along when they jump down
    "weld": [615, 225],                  # the second workshop's bench: a welding torch
    "screens": [[368, 209, 390, 223], [400, 223, 409, 229], [848, 206, 869, 219], [1086, 207, 1108, 221]],   # x0, y0, x1, y1
    "lamps": [[126, 164], [245, 144], [497, 166], [739, 166], [981, 166], [1316, 171]],   # the street lamps' heads, for moths
}


def upright(depth):
    """The lamp posts stand upright, so all of one is as near as its foot. The depth model fades a thin pole into the
    wall behind it as it rises, which would let a walker's head show in front of a post its legs pass behind. A post is
    what stands out from both sides of its lamp's column, from the lamp down to the kerb (row 284)."""
    px = depth.load()
    for x0, top in FX["lamps"]:
        post = [(x, y) for y in range(top, 284) for x in range(x0 - 8, x0 + 9) if px[x, y] - max(px[x0 - 10, y], px[x0 + 10, y]) > 4]
        near = max(px[q] for q in post)
        for q in post:
            px[q] = near
    return depth


def write_fx(out):
    (out / "workshop-fx.json").write_text(json.dumps(FX, separators=(",", ":")))
    upright(Image.open(PICKED / "workshop-depth.png").convert("L")).save(out / "workshop-depth.png")   # depth_map.py's map, posts stood up


def write_json(out):
    (out / "workshop.json").write_text(json.dumps({"size": SIZE, "labels": anchors()}))


def build(out):
    phases = json.loads((ROOT / "data" / "phases.json").read_text())
    if set(phases) != set(PICKS):
        sys.exit(f"PICKS has {sorted(PICKS)}, data/phases.json has {sorted(phases)}: give every phase a painting")
    for phase in phases:
        path = out / f"{name(phase)}.webp"
        bake(phase).save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
        print("drew", path.name, "from seed", PICKS[phase], f"at {ART_W} wide")
    write_json(out)
    write_fx(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["blockout", "paint", "build", "json"])
    ap.add_argument("out", nargs="?", default="static/building/pixel")
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--start", type=int, default=1000)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    ap.add_argument("--time", choices=list(PICKS), default="dusk")
    a = ap.parse_args()
    if a.cmd == "blockout":
        blockout().save(Path(a.out) / "workshop-blockout.png")
        print("wrote", Path(a.out) / "workshop-blockout.png")
    elif a.cmd == "paint":
        paint(a.count, a.start, a.host, a.time)
    elif a.cmd == "json":
        write_json(Path(a.out))
    else:
        build(Path(a.out))
