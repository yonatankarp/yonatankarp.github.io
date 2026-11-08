# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
# ///
"""The blog's Library: the reading room painted across the head of the blog's index (layouts/blog/list.html).

Run: uv run web3d/pixel/gen_library.py blockout [OUT]                  # the code blockout, for a look
     uv run web3d/pixel/gen_library.py paint [--count N] [--start S]   # Draw Things repaints the blockout (port 7860)
     uv run web3d/pixel/gen_library.py build [OUT]                     # OUT/library.webp, library-fx.json, library-depth.png

The city's pipeline (gen_city.py) at the city's colours: the blockout fixes where every shelf sits, the model paints
over it, and the pick is box-reduced and quantised undithered, to half the city's width (LIB), so that a 1440 screen
shows the whole room at 2 device px an art px rather than a crop of it (custom.css snaps the head to whole ones). One painting, at dusk: the
room is lit by its own lamps, and the window's dusk is the city's. No shelf stands for a topic, so a new tag never
needs new art.
Paintings go to web3d/pixel/paintings/candidates/library_SEED.png (not committed); the chosen one is copied to
web3d/pixel/paintings/picks/library.png, the build's input, and its seed noted in PICK.

The room's animations (web3d/src/library-fx.js) draw from library-fx.json: the fire, the dust in the window's light,
clouds passing only over the window's sky, which is read off the baked art, and readers browsing the shelves, who hide
behind the reading tables by picks/library-depth.png, made by depth_map.py (it needs torch); the build pushes its back
wall back (backdrop).
"""
import argparse
import base64
import io
import json
import sys
from pathlib import Path
from itertools import pairwise
from random import Random

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_city import ART_W, COLOURS, PH, PW, SIZE, H  # noqa: E402
from paint_rooms import OUT as CANDIDATES, call  # noqa: E402

PICK = 900                       # the seed of the pick, for the record
PICKED = Path(__file__).resolve().parent / "paintings" / "picks" / "library.png"
SHELVES = [858, 1148, 1438, 2018, 2308, 2598]   # each bookcase's centre: three either side of the window
CATALOGUE = 1728                 # the window and the card catalogue under it
TOP, FLOOR, BAY = 120, 640, 200  # a shelf's cornice, the floor line, a shelf's width
LIB = [ART_W // 2, round(ART_W // 2 * PH / PW)]   # the baked room, 720x173: the city's aspect, coarser pixels

WOOD, DARK, GOLD = (120, 72, 40), (70, 40, 22), (230, 170, 80)


def shelf(d, x, rng):
    """A tall bookcase centred on x: a dark frame, a cornice, and rows of books of every colour."""
    x0, x1 = x - BAY // 2, x + BAY // 2
    d.rectangle([x0 - 10, TOP - 20, x1 + 10, TOP + 6], (100, 58, 30))            # the cornice
    d.rectangle([x0, TOP, x1, FLOOR], DARK)
    for y in range(TOP + 20, FLOOR - 40, 74):
        bx = x0 + 8
        while bx < x1 - 14:
            w, h = rng.randint(9, 18), rng.randint(46, 64)
            d.rectangle([bx, y + 64 - h, bx + w, y + 64], rng.choice(
                [(150, 40, 35), (40, 70, 120), (50, 100, 60), (190, 150, 70), (110, 50, 90), (170, 100, 50), (200, 190, 160)]))
            bx += w + 2
        d.rectangle([x0, y + 64, x1, y + 72], (110, 66, 34))                    # the plank under them
    d.rectangle([x0, FLOOR - 40, x1, FLOOR], (95, 55, 28))                      # the plinth


def blockout():
    im = Image.new("RGB", (PW, H), WOOD)
    d = ImageDraw.Draw(im)
    rng = Random(7)
    d.rectangle([0, 0, PW, 90], (60, 36, 20))                                   # the ceiling and its beams
    for x in range(0, PW, 216):
        d.rectangle([x, 0, x + 40, 100], (45, 26, 14))
    d.rectangle([0, FLOOR, PW, H], (150, 95, 55))                               # parquet, and a long red runner on it
    d.polygon([(300, 760), (PW - 300, 760), (PW - 200, H), (200, H)], (140, 40, 35))
    for a, b in pairwise(SHELVES):                                              # pilasters between the bays
        if b - a < 400:
            d.rectangle([(a + b) // 2 - 18, 100, (a + b) // 2 + 18, FLOOR], (150, 100, 60))
    for x in SHELVES:
        shelf(d, x, rng)
    w = 160                                                                     # the arched window, the city at dusk
    for y in range(110, 560):
        t = (y - 110) / 450
        d.line([(CATALOGUE - w, y), (CATALOGUE + w, y)], (int(90 + 160 * t), int(60 + 110 * t), int(130 - 10 * t)))
    d.pieslice([CATALOGUE - w, 0, CATALOGUE + w, 220], 180, 360, (90, 60, 130))
    for k in range(11):                                                         # rooftops with lit windows
        bx, bh = CATALOGUE - w + k * 30, rng.randint(40, 130)
        d.rectangle([bx, 470 - bh, bx + 26, 470], (70, 50, 70))
        d.rectangle([bx + 8, 470 - bh + 12, bx + 14, 470 - bh + 20], (255, 200, 110))
    d.line([(CATALOGUE, 0), (CATALOGUE, 560)], DARK, 10)                        # the mullions and the frame
    d.line([(CATALOGUE - w, 330), (CATALOGUE + w, 330)], DARK, 10)
    d.arc([CATALOGUE - w, 0, CATALOGUE + w, 220], 180, 360, DARK, 14)
    d.rectangle([CATALOGUE - w, 110, CATALOGUE + w, 560], outline=DARK, width=14)
    d.rectangle([CATALOGUE - 170, 470, CATALOGUE + 170, FLOOR], (130, 80, 42))  # the card catalogue, all small drawers
    for y in range(480, FLOOR - 10, 30):
        for x in range(CATALOGUE - 160, CATALOGUE + 160, 40):
            d.rectangle([x, y, x + 34, y + 24], (165, 105, 60))
            d.rectangle([x + 13, y + 10, x + 21, y + 14], GOLD)
    d.rectangle([60, 180, 420, FLOOR], DARK)                                    # left: a tall arched doorway and a globe
    d.pieslice([60, 0, 420, 360], 180, 360, DARK)
    d.ellipse([520, 470, 640, 590], (60, 110, 140))
    d.line([(580, 590), (580, FLOOR + 40)], DARK, 8)
    d.rectangle([2900, 360, 3300, FLOOR], (170, 160, 150))                      # right: a stone fireplace, a fire, armchairs
    d.rectangle([2980, 460, 3220, FLOOR], (40, 25, 20))
    d.ellipse([3040, 540, 3160, 630], (240, 140, 50))
    d.rectangle([2870, 340, 3330, 370], (150, 140, 130))
    for x in (2820, 3380):
        d.rectangle([x - 60, 600, x + 60, 720], (120, 50, 35))
    for x in (1003, 1293, 2163, 2453):                                          # reading tables with green lamps
        d.rectangle([x - 110, 680, x + 110, 700], (100, 60, 30))
        d.rectangle([x - 100, 700, x - 90, 780], DARK)
        d.rectangle([x + 90, 700, x + 100, 780], DARK)
        d.pieslice([x - 30, 620, x + 30, 680], 180, 360, (40, 120, 70))
        d.line([(x, 650), (x, 680)], GOLD, 4)
    for x in range(324, PW, 648):                                               # brass chandeliers
        d.line([(x, 90), (x, 150)], GOLD, 3)
        d.ellipse([x - 50, 150, x + 50, 180], GOLD)
    return im


PROMPT = (
    "Edit this picture. Repaint it as a highly detailed wide panoramic view inside a grand old public library reading "
    "room at dusk, seen straight on, rich painterly video game art like a city-builder game, warm golden lamp light, "
    "soft glowing highlights and deep cosy shadows. Keep every shape exactly where it is. Six tall separate dark "
    "wooden bookcases stand against the warm wood-panelled wall, three on each side, each one packed with rows of "
    "colourful leather book spines and crowned with a carved cornice, between carved wooden pilasters. In the centre "
    "a big arched window with dark wooden mullions shows the city outside at dusk: a purple and peach sunset sky, "
    "rooftops and warm lit windows. Under the window an old wooden card catalogue cabinet with many small drawers and "
    "brass handles. Reading tables with glowing green glass banker's lamps stand on a polished parquet floor with a "
    "long red rug. Brass chandeliers hang from a coffered wooden ceiling. On the far left a tall dark arched doorway "
    "and a globe on a stand; on the far right a stone fireplace with a warm fire and two red leather armchairs. "
    "No people, no text, no letters, no numbers, no labels and no writing on any book spine, sign or drawer.")


def paint(count, start, host):
    buf = io.BytesIO()
    blockout().resize((PW, PH), Image.LANCZOS).save(buf, "PNG")
    for k in range(count):
        seed = start + 17 * k
        path = CANDIDATES / f"library_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        res = call(host, "/sdapi/v1/img2img", {"prompt": PROMPT, "width": PW, "height": PH, "seed": seed, "batch_size": 1,
                                               "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        Image.open(io.BytesIO(base64.b64decode(res["images"][0].split(",")[-1]))).save(path)
        print("painted", path.name, flush=True)


def bake(path=PICKED, size=SIZE):
    """The painting box-reduced to the art's size, on its own COLOURS colours: the city's pixel look, undithered. A few
    k-means passes after the median cut, as plain median cut spends no colour on the small green lamps. gen_rooms.py
    bakes its rooms with it too, at the city's SIZE; the Library is LIB."""
    if not path.exists():
        sys.exit(f"no {path}: paint (gen_library.py paint), copy the chosen candidate there and note its seed in PICK")
    im = Image.open(path).convert("RGB").crop((0, 0, PW, PH))
    return im.resize(size, Image.BOX).quantize(COLOURS, method=Image.Quantize.MEDIANCUT, kmeans=3, dither=Image.Dither.NONE).convert("RGB")


# Where the room's animations go, in art pixels (library-fx.js): x0, y0, x1, y1.
FX = {
    "fire": [638, 107, 655, 129],                        # the flames, above the logs
    "glow": [[620, 125, 675, 140], [627, 140, 672, 150]],   # the hearth and the floor before it
    "dust": [327, 20, 397, 150],                         # the window's shaft of light
    "clouds": [310, 20, 410, 55],                        # where clouds drift past outside, left to right
    # The readers (gen_walkers.py's readers.webp; their routine is web3d/src/readers.js). Where: their soles' row, on the lit
    # parquet between the bookcases' plinths (which end at row 131) and the reading tables' tops (from row 135), which hide
    # their feet as they pass behind; each bookcase's middle and how far either side a reader may stop; the room they walk,
    # past the art's edges to leave it; and the gap, in px, no reader stops within of another, about a reader's width and a
    # margin. How: walking speed in px/s; each reader's own pace, a factor on every time; what to do next, by weight (walk
    # past, stop and look, take a book); and times in ms: stand, reach and take, then a read short or long ([min, max,
    # weight]), a look, an idle pause between, and a while out of the room. Chances: a walk past leaves the room, a read
    # goes on to the shelf next door, a stop keeps the walking direction (else either way).
    "readers": {"floor": 138, "shelves": [180, 239, 300, 423, 482, 543], "spread": 10, "room": [-30, 750], "gap": 35,
                "speed": [22, 30], "pace": [0.7, 1.4], "choose": {"pass": 2, "look": 3, "browse": 4},
                "browse": [[600, 900], [900, 1300], [700, 900]], "read": [[2500, 8000, 3], [10000, 20000, 1]],
                "look": [2000, 5000], "idle": [800, 4000], "away": [3000, 9000], "leave": 0.4, "nearby": 0.4, "keep": 0.3},
}
LAMPS = 111                                              # the armchairs' tops, above the globe's and the lamps': above them, nothing stands in front of the readers
REACH = 32                                               # px either side: past half a reading table or an armchair, to the floor beside it
TABLES, GROW = 135, 2                                    # the reading tables' tops, and how far up their back edges grow
SHADOW = 2                                               # the soles' row and the one under it, which the readers' shadows reach
WINDOW = (327, 10, 397, 87)                              # x0, y0, x1, y1: where the sky shows through the window


def sky(im):
    """The window's sky, as runs [y, x0, x1] per row: its bright, bluish pixels, so clouds pass behind the frames and
    the rooftops outside."""
    px, (x0, y0, x1, y1), runs = im.load(), WINDOW, []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not (sum(p := px[x, y]) > 470 and p[2] > p[1] - 10):
                continue
            if runs and runs[-1][0] == y and runs[-1][2] == x - 1:
                runs[-1][2] = x
            else:
                runs.append([y, x, x])
    return runs


def backdrop(depth):
    """Nothing behind the readers may hide them, and nothing in front may fail to. The depth model barely parts this
    straight-on room's back wall from its floor: books on the shelves and the seams between the wall's sections read as
    nearer than a reader's feet, and would punch holes in a reader browsing the shelves. So above the tops of the
    armchairs, the globe and the lamps (LAMPS) the wall is pushed back, and from there down to the readers' contact
    shadows, a few rows under their soles, only what stands in front of the floor under them, more than 15 nearer,
    keeps its depth: the lamps, the tables, the armchairs and the globe at the left edge. The rest goes to 0, so
    library-fx.js tests the readers from depth 0. The floor under a reader is its column's depth on the floor row, or,
    where a table or a chair crosses that row (40 nearer than the farthest floor within REACH), that farthest floor;
    the model paints its own floor in bands that differ by up to 35. Over the tables' tops (TABLES) what is kept grows
    GROW rows up, as the model softens their back edges into the floor behind them, and a reader's raised toe would
    show on the table there."""
    px, (w, _), floor = depth.load(), depth.size, FX["readers"]["floor"]
    row = [px[x, floor] for x in range(w)]
    for x in range(w):
        far = min(row[max(0, x - REACH):x + REACH + 1])
        foot = row[x] if row[x] <= far + 40 else far
        for y in range(floor + SHADOW):
            if y < LAMPS or px[x, y] <= foot + 15:
                px[x, y] = 0
        for y in range(TABLES - GROW, floor + SHADOW):   # top down, so each row grows from the rows under it as they were
            px[x, y] = max(px[x, yy] for yy in range(y, min(y + GROW + 1, floor + SHADOW)))
    return depth


def build(out):
    im = bake(size=LIB)
    im.save(out / "library.webp", "WEBP", lossless=True, quality=100, method=6, exact=True)
    (out / "library-fx.json").write_text(json.dumps({**FX, "sky": sky(im)}, separators=(",", ":")))
    depth = Image.open(PICKED.with_name("library-depth.png")).convert("L").resize(LIB, Image.BOX)   # depth_map.py's map, at the room's size
    backdrop(depth).save(out / "library-depth.png")   # the wall pushed back
    print("drew library.webp from seed", PICK, f"at {LIB[0]} wide")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["blockout", "paint", "build"])
    ap.add_argument("out", nargs="?", default="static/building/pixel")
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--start", type=int, default=900)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    a = ap.parse_args()
    if a.cmd == "blockout":
        blockout().save(Path(a.out) / "library-blockout.png")
        print("wrote", Path(a.out) / "library-blockout.png")
    elif a.cmd == "paint":
        paint(a.count, a.start, a.host)
    else:
        build(Path(a.out))
