# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
# ///
"""The homepage's city: a wide aerial panorama the page pans sideways, with a label pinned on each district.

Run: uv run web3d/pixel/gen_city.py blockout [OUT]                  # the code blockout, for a look
     uv run web3d/pixel/gen_city.py paint [--count N] [--start S]   # Draw Things repaints the blockout at dusk (port 7860)
     uv run web3d/pixel/gen_city.py door [--count N] [--start S]    # Draw Things paints the tower's entrance doors
     uv run web3d/pixel/gen_city.py door --pick SEED                # ... and one goes into the dusk pick
     uv run web3d/pixel/gen_city.py door --open PAINTING [--time PHASE]  # the hour's whole painting with its doors open:
                                                                    # its crop at DOOR goes to picks/city-open[-PHASE].png
     uv run web3d/pixel/gen_city.py door --winter --time PHASE [--count N] [--start S]  # that crop under snow
     uv run web3d/pixel/gen_city.py door --winter --time PHASE --pick SEED  # ... its doorway on the winter pick's crop
     uv run web3d/pixel/gen_city.py paint --time PHASE [...]        # ... or edits the dusk pick to another hour
     uv run web3d/pixel/gen_city.py paint --winter --time PHASE     # ... or edits an hour's pick to winter
     uv run web3d/pixel/gen_city.py build [OUT]                     # OUT/city[-winter].webp, city[-winter]-PHASE.webp
                                                                    # for every other phase in data/phases.json,
                                                                    # backdrop[-winter][-PHASE].webp (BACKDROP of
                                                                    # each), door-open[-winter][-PHASE].webp,
                                                                    # city.json, city[-winter]-fx.json,
                                                                    # city[-winter]-windows.json and
                                                                    # city-depth.png
     uv run web3d/pixel/gen_city.py json [OUT]                      # only OUT/city.json

The blockout fixes where every district sits; the model paints over it, and the picked painting (PICKS) is box-reduced
to ART_W wide on COLOURS colours, undithered. The other hours are the dusk pick edited by the model, which keeps the
composition, so the labels' anchors (city.json, read by layouts/index.html) hold at every hour.
The dusk pick is painting 700 with one more edit, the tower's entrance (door, seed DOOR_SEED), painted after it was
picked; the other hours were then edited from the pick with its door.
Winter is each hour's pick edited to snow (WINTER), the hour's light kept, at seed 700: other seeds moved the tower,
the districts, the plaza or the lamps.
Paintings go to web3d/pixel/paintings/candidates/city[-winter][-PHASE]_SEED.png (not committed); the chosen one is copied
to web3d/pixel/paintings/picks/city[-winter][-PHASE].png, the build's input, and its seed noted in PICKS or WINTER_PICKS.

The city's animations (web3d/src/city-fx.js) draw from city-fx.json: the bay found in the baked art, and the walks,
lanes and lights below; and at night from city-windows.json, the lit windows found in it. Their depth map,
picks/city-depth.png, is made by depth_map.py (it needs torch) and copied here with its lamp posts and trees stood up
(POSTS, TREES), so this script never needs torch.
"""
import argparse
import base64
import functools
import io
import json
import math
import sys
from collections import Counter
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint_rooms import OUT as CANDIDATES, call  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PW, H = 3456, 864                # the blockout: 4:1, so every district can be panned to the middle with city either side
PH = H // 64 * 64                # the painting's rows: Draw Things paints whole 64s, and pick 700's last 32 rows are black
ART_W, COLOURS = 1440, 64
SIZE = [ART_W, round(ART_W * PH / PW)]
# The seed of each hour's pick, for the record. Dusk is 700 plus the door edit (DOOR_SEED); the other hours were
# remade from that pick, each at seed 700.
PICKS = {"dusk": 700, "dawn": 700, "day": 700, "night": 700}
WINTER_PICKS = {"dusk": 700, "dawn": 700, "day": 700, "night": 700}   # each hour's winter, an edit of that hour's pick
PICKED = Path(__file__).resolve().parent / "paintings" / "picks"   # picks/city[-PHASE].png: each hour's chosen candidate
SPOTS = {"radio": (1090, 470), "library": (1180, 720), "tower": (1760, 580), "post": (2420, 470), "workshop": (2300, 730)}
LOTS = {"radio": (970, 380, 1210, 490), "post": (2290, 360, 2560, 490), "library": (1010, 560, 1380, 740),
        "workshop": (2080, 610, 2520, 750)}   # x0, y0, x1, y1: kept clear for each landmark
# Where picking a district zooms (city.js): its building's middle, in % of the art (x, y), and how far to zoom so it fills
# the free view (the tall tower and mast zoom less).
ZOOM = {"tower": [51.4, 36, 1.2], "library": [35.3, 75, 2.4], "workshop": [66.5, 79, 2.4], "radio": [31.8, 33, 1.7],
        "post": [70, 44, 2.4]}
MAX_PX = 4   # but never so far that an art pixel grows past this many screen px: a big screen's overview is already ~3
# city.js applies both on the screen: the zoom is the whole city's device px an art px times ZOOM, to the nearest whole
# device px, and the cap is MAX_PX's whole device px.
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


# Winter: the hour's own pick under snow, its light kept and named (LIGHT; asked only to keep "the light", or for a "cold"
# dusk, the model painted an overcast grey day, #304), at night its windows and lamps kept too; each followed by KEEP.
# These made WINTER_PICKS.
SNOW = ("fresh white snow lying on every roof, on the parks, the plaza and the hills, snow banked along the roads and "
        "pavements, the trees bare and dusted with snow")
LIGHT = {
    "dawn": "early dawn, just before sunrise: a cool pale blue and soft pink sky, the first pale light on the hills and the "
            "sea, soft long shadows, a few windows and street lamps still lit",
    "day": "a bright clear midday: a clear blue sky, strong high sunlight, crisp short shadows, the blue sea",
    "dusk": "golden dusk: a purple-to-peach sunset sky, warm golden sunset light, long soft shadows, the sea glowing at the "
            "horizon, warm street lamps coming on",
}
WINTER = {**{ph: f"Edit this picture. Keep the time of day exactly as it is, {light}, with the same sky and the same light, "
                 f"and change only the season to deep winter: {SNOW}. " for ph, light in LIGHT.items()},
          "night": f"Edit this picture. Keep it night and change only the season to deep winter: {SNOW}, the snow lit warm "
                   "under the street lamps and blue in the moonlight. Keep every lit window and lamp. "}


def name(phase, winter=False, stem="city"):
    """city, city-night, city-winter, city-winter-night: the season, then the hour, each left out at its default. Workshop
    Row's (stem "workshop", painted by gen_workshop.py) are named the same way."""
    return f"{stem}{'-winter' if winter else ''}{'' if phase == 'dusk' else '-' + phase}"


def pick(phase, winter=False, stem="city"):
    path = PICKED / f"{name(phase, winter, stem)}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint it (gen_{stem}.py paint --time {phase}{' --winter' if winter else ''}), copy the chosen candidate there and note its seed in {'WINTER_PICKS' if winter else 'PICKS'}")
    return path


def paint(count, start, host, phase, winter=False):
    if winter:
        base = Image.open(pick(phase)).convert("RGB").crop((0, 0, PW, PH))
        prompt = WINTER[phase] + KEEP
    else:
        base = blockout().resize((PW, PH), Image.LANCZOS) if phase == "dusk" else Image.open(pick("dusk")).convert("RGB").crop((0, 0, PW, PH))
        prompt = DUSK if phase == "dusk" else f"Edit this picture. Change only the time of day to {HOURS[phase]}. {KEEP}"
    buf = io.BytesIO()
    base.save(buf, "PNG")
    for k in range(count):
        seed = start + 17 * k
        path = CANDIDATES / f"{name(phase, winter)}_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        res = call(host, "/sdapi/v1/img2img", {"prompt": prompt, "width": PW, "height": PH, "seed": seed, "batch_size": 1,
                                               "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        Image.open(io.BytesIO(base64.b64decode(res["images"][0].split(",")[-1]))).save(path)
        print("painted", path.name, flush=True)


# The Career Tower's entrance: a glass double door in a bronze frame, painted into the dusk painting after it was picked.
# The model repaints a crop round the tower's foot with the doors blocked out, and the chosen seed goes back in under a
# tight mask on the ground floor, so the tower's copper frame stays the painting's own.
DOOR = (1503, 286, 2015, 798)              # painting px: the 512 px crop, the tower's foot (art 733, 226) in its middle
DOOR_MASK, DOOR_FEATHER = (219, 228, 297, 282), 2   # crop px: the ground floor the edit keeps, and its soft edge
DOOR_SEED = 28
DOOR_PROMPT = (
    "Edit this picture. In the lowest storey of the tall glass tower, where the dark bronze rectangle is, paint the "
    "tower's main entrance: a pair of tall glass double doors in a dark bronze frame, set flush into the tower's glass "
    "ground floor, closed, warm lobby light glowing through their glass, in the same rich painterly city-builder video "
    "game style and the same warm golden dusk light. Do not add a porch, a canopy or any new building, and do not change "
    "the small houses in front. Keep everything else in the picture exactly the same: the tower, its windows, the plaza, "
    "the houses, the light and the shadows. No people, no text, no letters, no signs.")


def before_door():
    """The dusk painting without its door: paint's candidate of PICKS["dusk"], the pick as it was before the edit."""
    path = CANDIDATES / f"city_{PICKS['dusk']}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint it (gen_city.py paint --start {PICKS['dusk']} --count 1)")
    return Image.open(path).convert("RGB").crop((0, 0, PW, PH))


def paint_door(count, start, host):
    crop = before_door().crop(DOOR)
    d, a = ImageDraw.Draw(crop), lambda x, y: (round(x * PW / ART_W) - DOOR[0], round(y * PW / ART_W) - DOOR[1])
    d.rectangle([*a(727, 216), *a(739, 229)], fill=(58, 36, 22))   # the doors' blockout (art 727-739 x 216-229), so the
    d.rectangle([*a(728, 217), *a(738, 229)], fill=(150, 105, 55))  # model paints them there and nowhere else
    d.line([*a(733, 217), *a(733, 229)], fill=(58, 36, 22), width=3)
    buf = io.BytesIO()
    crop.save(buf, "PNG")
    for k in range(count):
        seed = start + 17 * k
        path = CANDIDATES / f"city-door_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        res = call(host, "/sdapi/v1/img2img", {"prompt": DOOR_PROMPT, "width": crop.width, "height": crop.height, "seed": seed,
                                               "batch_size": 1, "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        Image.open(io.BytesIO(base64.b64decode(res["images"][0].split(",")[-1]))).convert("RGB").save(path)
        print("painted", path.name, flush=True)


def install_door(seed):
    """The dusk pick: the painting with the chosen door candidate composited in under the ground floor's soft mask."""
    city = before_door()
    mask = Image.new("L", (DOOR[2] - DOOR[0], DOOR[3] - DOOR[1]))
    ImageDraw.Draw(mask).rectangle(DOOR_MASK, fill=255)
    door = Image.open(CANDIDATES / f"city-door_{seed}.png").convert("RGB")
    city.paste(Image.composite(door, city.crop(DOOR), mask.filter(ImageFilter.GaussianBlur(DOOR_FEATHER / 2))), DOOR[:2])
    city.save(PICKED / "city.png")
    print("wrote", PICKED / "city.png", "with door", seed, "(note it in DOOR_SEED, then repaint the other hours)")


# Going into the tower from the city (city.js), its entrance's doors open: the same hour's painting with them open, edited
# from the pick at that hour, of which only the crop at DOOR is kept (picks/city-open[-PHASE].png, ample for DOOR_OPEN at
# the box filter's 2.4:1). It is pasted back on the pick, baked on the pick's own colours and cut at DOOR_OPEN, in art px.
# In winter, that crop edited to snow as winter is (WINTER, at its seed), of which only the doorway is kept (DOORWAY,
# painting px: what the open edit changed), on the winter pick's crop: picks/city-open-winter[-PHASE].png.
DOOR_OPEN = (710, 196, 756, 240)
DOORWAY = (1725, 516, 1797, 568)


def shrunk(phase, winter=False):
    return Image.open(pick(phase, winter)).convert("RGB").crop((0, 0, PW, PH)).resize(SIZE, Image.BOX)


def bake(phase, winter=False):
    """The painting box-reduced to the art's size, on its own COLOURS colours: the pixel look, with no dither to shimmer;
    then the crane in one yellow (yellow_crane). Paletted, so the open doors can be baked on the same colours."""
    im = shrunk(phase, winter)
    return yellow_crane(im, im.quantize(COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))


# The tower's crane, which each hour's edit painted its own colour (olive by day, orange at dusk, grey-pink in winter) and
# the cut folded into the sky's and the brick's, is one yellow at every hour, the roof's (gen_floors), keeping its shape
# (city-depth.png is shared): its pixels, found in the plain dusk art, take CRANE_HUE at their own brightness, on
# CRANE_COLOURS colours of their own past the city's COLOURS, so every other pixel stays as the cut has it. In art px.
CRANE = (700, 6, 822, 62)
CRANE_HUE, CRANE_SAT, CRANE_LIFT, CRANE_COLOURS = 0.115, 0.8, 1.12, 4
CRANE_OUT = [(15, 10, 27, 31)]                    # in the box: the white counterweight
CRANE_TREES, CRANE_MAST = 44, (55, 63)            # the roof's trees from this row down, but for the lattice mast between them


@functools.cache
def crane_mask():
    """How much each pixel of CRANE is crane, 0 to 1: yellow in the plain dusk art (where it is plainly a yellow crane on
    a pink sky) and apart from the sky round it (a 9 px median), softly for the thin lattice."""
    import colorsys
    d = shrunk("dusk").crop(CRANE)
    sky, px, (w, h) = d.filter(ImageFilter.MedianFilter(9)).load(), d.load(), d.size
    m = {}
    for y in range(h):
        for x in range(w):
            hue, sat, _ = colorsys.rgb_to_hsv(*(v / 255 for v in px[x, y]))
            diff = sum(abs(a - b) for a, b in zip(px[x, y], sky[x, y], strict=True)) / 255
            out = (y >= CRANE_TREES and not CRANE_MAST[0] <= x < CRANE_MAST[1]) or any(
                x0 <= x < x1 and y0 <= y < y1 for x0, y0, x1, y1 in CRANE_OUT)
            m[x, y] = 0 if out or not (0.07 < hue < 0.17 and sat > 0.2) else min(1, max(0, (diff - 0.03) / 0.12))
    return m


def yellow_crane(im, cut):
    """The cut with the crane's pixels (crane_mask() over half) recoloured from im, on CRANE_COLOURS colours appended."""
    import colorsys
    mask = crane_mask()
    px, x0, y0 = im.load(), CRANE[0], CRANE[1]
    crane = {}
    for (x, y), k in mask.items():
        if k > 0.5:
            hue, sat, val = colorsys.rgb_to_hsv(*(v / 255 for v in px[x0 + x, y0 + y]))
            new = colorsys.hsv_to_rgb(CRANE_HUE, max(sat, CRANE_SAT), min(1, val * CRANE_LIFT))
            crane[x0 + x, y0 + y] = tuple(round(255 * (o / 255 * (1 - k) + n * k)) for o, n in zip(px[x0 + x, y0 + y], new, strict=True))
    side = math.isqrt(len(crane)) + 1
    sample = Image.new("RGB", (side, side))
    cols = [crane[q] for q in sorted(crane, key=lambda q: (q[1], q[0]))]
    sample.putdata(cols + cols[:1] * (side * side - len(cols)))
    ramp = sample.quantize(CRANE_COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).getpalette()[:3 * CRANE_COLOURS]
    ramp = [tuple(ramp[i:i + 3]) for i in range(0, len(ramp), 3)]
    out = cut.copy()
    out.putpalette(cut.getpalette()[:3 * COLOURS] + [v for c in ramp for v in c])
    q = out.load()
    for xy, col in crane.items():
        q[xy] = COLOURS + min(range(CRANE_COLOURS), key=lambda i: sum((a - b) ** 2 for a, b in zip(col, ramp[i], strict=True)))
    return out


def open_crop(phase, winter=False):
    return PICKED / f"city-open{'-winter' if winter else ''}{'' if phase == 'dusk' else '-' + phase}.png"


def cut_open(painting, phase):
    """Keep the crop of a whole painting with the doors open that the bake needs."""
    Image.open(painting).convert("RGB").crop(DOOR).save(open_crop(phase))
    print("wrote", open_crop(phase))


def paint_open_winter(count, start, host, phase):
    """The hour's open doors' crop edited to winter, as the hour's pick was (WINTER[phase]): city-open-winter[-PHASE]_SEED.png."""
    buf = io.BytesIO()
    Image.open(open_crop(phase)).convert("RGB").save(buf, "PNG")
    for k in range(count):
        seed = start + 17 * k
        path = CANDIDATES / f"{open_crop(phase, True).stem}_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        res = call(host, "/sdapi/v1/img2img", {"prompt": WINTER[phase] + KEEP, "width": DOOR[2] - DOOR[0], "height": DOOR[3] - DOOR[1],
                                               "seed": seed, "batch_size": 1, "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        Image.open(io.BytesIO(base64.b64decode(res["images"][0].split(",")[-1]))).convert("RGB").save(path)
        print("painted", path.name, flush=True)


def keep_open_winter(phase, seed):
    """The winter pick's crop at DOOR with only its doorway (DOORWAY, its edge softened a pixel) from the picked candidate."""
    crop = Image.open(pick(phase, True)).convert("RGB").crop(DOOR)
    mask = Image.new("L", crop.size)
    ImageDraw.Draw(mask).rectangle([v - o for v, o in zip(DOORWAY, DOOR[:2] * 2, strict=True)], fill=255)
    painted = Image.open(CANDIDATES / f"{open_crop(phase, True).stem}_{seed}.png").convert("RGB")
    Image.composite(painted, crop, mask.filter(ImageFilter.GaussianBlur(1))).save(open_crop(phase, True))
    print("wrote", open_crop(phase, True))


def bake_open(phase, art, winter=False):
    """The tower's entrance at this hour (and season) with its doors open, on its own colours (art, bake's), cut at DOOR_OPEN."""
    if not open_crop(phase, winter).exists():
        how = f"door --winter --time {phase}" if winter else f"door --open PAINTING --time {phase}"
        sys.exit(f"no {open_crop(phase, winter)}: make it (gen_city.py {how})")
    im = Image.open(pick(phase, winter)).convert("RGB").crop((0, 0, PW, PH))
    im.paste(Image.open(open_crop(phase, winter)).convert("RGB"), DOOR[:2])
    city = Image.new("P", (1, 1))
    city.putpalette(art.getpalette()[:3 * COLOURS])   # the city's colours, not the crane's
    opened = im.resize(SIZE, Image.BOX).quantize(palette=city, dither=Image.Dither.NONE).convert("RGB").crop(DOOR_OPEN)
    if not winter:
        return opened
    # In winter only the doorway changes: round it the shut art's own pixels, which the palette's nearest colours would
    # not all keep. The doorway in art px, a pixel wider each side for the box filter.
    x0, y0 = (math.floor(v * SIZE[i % 2] / (PW, PH)[i % 2]) - 1 for i, v in enumerate(DOORWAY[:2]))
    x1, y1 = (math.ceil(v * SIZE[i % 2] / (PW, PH)[i % 2]) + 1 for i, v in enumerate(DOORWAY[2:]))
    shut, box = art.convert("RGB").crop(DOOR_OPEN), (x0 - DOOR_OPEN[0], y0 - DOOR_OPEN[1], x1 - DOOR_OPEN[0], y1 - DOOR_OPEN[1])
    shut.paste(opened.crop(box), box[:2])
    return shut


# Where the city's animations go, in art pixels (city-fx.js). Only open ground, so nothing that stands in front of a
# mover is drawn behind it; city-depth.png hides them behind trees and lamp posts on the way.
WALKS = [[452, 301, 540, 301, 600, 302, 630, 305, 660, 305, 690, 307, 735, 308, 765, 309, 800, 309, 840, 307,   # x0, y0,
          880, 306, 900, 305, 935, 305],   # x1, y1, ...: the main street's near pavement, along its kerb, onto the apron
         [737, 307, 739, 346]]             # the avenue toward the viewer, walked faster
PLAZAS = [[670, 208, 708, 220], [774, 215, 816, 232]]   # x0, y0, x1, y1: the open paving either side of the tower
# The roads the cars take, each as its middle in art px, traced on the painted tarmac. The main street runs from behind
# the tree by the Library to behind the round tree on Workshop Row's apron (its tarmac ends at the apron by the fir, too
# thin to hide a car). The ring road comes out from behind the sheds and curves up to a junction: on up past the
# library's side to behind the houses there (UP), or right along the greenhouses to the edge (RIGHT). The diagonal street
# runs from behind the house where it meets that road down to the bottom edge (DIAG): its corner is hidden, between the
# house and the hedge. On the left, a road from behind a tree (LEFT) meets the curve
# that runs from behind the trees above the Library up to behind the brick block (CURVE).
MAIN = [[500, 294.5], [540, 295], [580, 296.5], [640, 299.5], [720, 302], [760, 302.5], [840, 301], [880, 300.5], [958, 300.5]]
RING = [[1031, 270], [1045, 268.5], [1063, 262.5], [1073, 258], [1080, 254], [1086, 247], [1088, 243]]
UP = [[1088, 238], [1088, 230], [1082, 221], [1073.5, 214], [1067.5, 207], [1062.5, 200], [1063, 193], [1064.5, 183],
      [1068, 176], [1073, 171], [1078, 168]]
RIGHT = [[1092, 240.5], [1100, 240.5], [1430, 247.3], [1446, 247.6]]
DIAG = [[1132, 252], [1138, 261], [1142, 266], [1149, 274], [1156, 281], [1169, 289], [1176, 295], [1184, 306],
        [1193, 315], [1201, 322], [1209, 330], [1217, 339], [1225, 347], [1230, 353]]
LEFT = [[246, 243.5], [280, 243.5], [330, 242], [366, 242]]
CURVE = [[420, 197.5], [408, 202.8], [396, 209], [383, 216], [374, 224], [372, 234], [372.5, 243], [378, 253], [390, 265]]


def lane(road, off=2.0):
    """A one-way lane along a road's middle (a list of points, in the way it runs): cars keep right, off px from the
    middle. A car at a lane point (x, y) covers x-2..x+1 and y-1..y, so the point is half a pixel past its middle."""
    out = []
    for i, (x, y) in enumerate(road):
        (ax, ay), (bx, by) = road[max(0, i - 1)], road[min(len(road) - 1, i + 1)]
        n = math.hypot(bx - ax, by - ay)
        p = [round(x - (by - ay) / n * off + 0.5), round(y + (bx - ax) / n * off + 0.5)]
        if not out or p != out[-1]:
            out.append(p)
    return out


# Each lane is a whole route, from where it comes out from behind something (or in off the art) to where it goes behind
# something again: city-fx.js fades a car in and out over a lane's last 8 px, and reads the ground under each point but
# the ends from the depth map, so every other point must be on open road.
LANES = [lane(MAIN, 1.75), lane(MAIN[::-1], 1.75),
         lane(RING + UP, 1.5), lane(UP[::-1] + RING[::-1], 1.5),                        # the sheds and the top (narrow)
         lane(RING + RIGHT), lane(RIGHT[::-1] + RING[::-1]),                            # the sheds and the right edge
         lane(UP[::-1] + RIGHT, 1.5), lane(RIGHT[::-1] + UP, 1.5),                      # the top and the right edge
         lane(DIAG), lane(DIAG[::-1]),                                                  # behind the house and the bottom edge
         lane(LEFT + CURVE[5::-1], 1.5), lane(CURVE[:6] + LEFT[::-1], 1.5),             # the left road and the brick block
         lane(CURVE[::-1]), lane(CURVE)]                                                # the curve's two ends
# Lamp posts in front of a lane, a column each, as x, top (the lamp) and foot, in art px: the depth model fades a thin
# post into the road behind it, so a car would show over it. Where a post is two pixels wide, both columns.
POSTS = [(648, 286, 305), (716, 287, 307), (730, 302, 308), (731, 293, 308), (1077, 253, 266), (1169, 290, 301),
         (1170, 290, 301)]
# Trees standing nearer than a lane or the walk, whose crowns reach over it, as their crown's box (x0, y0, x1, y1) and
# their trunk's foot (x, y), in art px. The depth model gives such a crown the road's depth, so a car would drive over
# it: the crown (what is foliage in the day art, in its box) goes at least as near as the ground at the foot. A tree
# behind the road keeps its foot's lesser depth, so it hides nothing on the road.
TREES = [(238, 239, 264, 258, 251, 259),     # by the left road's west end
         (343, 238, 367, 256, 355, 257),     # on the left road, before the curve
         (376, 244, 404, 266, 392, 267),     # at the curve's foot
         (393, 206, 416, 236, 404, 234),     # inside the curve, by its top
         (499, 282, 522, 302, 512, 306),     # the round tree by the Library, where the main street's lanes start
         (523, 290, 536, 315, 530, 316),     # the fir beside it
         (578, 300, 588, 306, 583, 312),     # a crown over the main street's near pavement, by x 583
         (590, 298, 609, 313, 600, 318),     # on the main street's near side, by x 600
         (819, 305, 829, 314, 824, 318),     # a crown over the near pavement, by x 824
         (862, 293, 881, 330, 871, 332),     # the fir by Workshop Row's apron
         (916, 284, 937, 316, 952, 318)]     # the left of the round tree on the apron (its middle is near enough)
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


def windows(night, day, dusk, among=None):
    """The lit windows of the night art, each a whole pane, so it goes dark as one. A pane is found from its warm rim
    (small spots of saturated warm light, 4-connected, at most 14 px, inside 5x5, so the library's lit facade and the lit
    roads stay out, and not in the sky, where they are stars), grown through the paler warm light inside it (`pane`), and
    kept when the whole window (a room's panes, as one) is still small and fills at least half its box. Each goes dark in its wall's colour, the darkest pixel around it.
    `among`: only spots touching these pixels (winter's lamplight pools on the snow look like windows; its windows are
    where the plain art's are)."""
    (w, h), px, land = night.size, night.load(), ground(night, day, dusk)
    lit = {(x, y) for y in range(h) for x in range(w)
           if (p := px[x, y])[0] > 140 and p[1] > 100 and p[2] < 100 and p[0] - p[2] > 55}
    pane = lambda q: (p := px[q])[0] > 130 and p[0] - p[2] > 40 and sum(p) > 300
    found, taken = [], set()
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
            if not small(comp) or comp[0] not in land or comp[0] in taken:
                continue
            if among is not None and not any((cx + dx, cy + dy) in among for cx, cy in comp for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                continue
            whole = spread(comp, pane, night.size)
            taken |= whole
            xs, ys = [c[0] for c in whole], [c[1] for c in whole]
            if not small(whole, 48, 10, 8) or 2 * len(whole) < (max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1):
                continue   # too big, or too ragged to be panes: lamplight on a pavement or a roof
            ring = {(cx + dx, cy + dy) for cx, cy in whole for dx in (-1, 0, 1) for dy in (-1, 0, 1)} - whole
            seen = Counter(px[q] for q in ring if 0 <= q[0] < w and 0 <= q[1] < h)
            wall = min(seen, key=lambda c: (-seen[c], sum(c), c))   # the commonest colour round it, then the darkest
            found.append({"wall": list(wall), "px": sorted(whole)})
    return found


def small(spot, most=14, w=4, h=4):
    """At most `most` px, inside (w + 1) x (h + 1): a rim's spot, or a whole window (a room's panes, as one)."""
    xs, ys = [c[0] for c in spot], [c[1] for c in spot]
    return len(spot) <= most and max(xs) - min(xs) <= w and max(ys) - min(ys) <= h


# The open bay's water, in art px, from which bay() floods it.
BAY_SEED = (40, 210)


def bay(day):
    """The bay's water: what the blue of the day art reaches from BAY_SEED, each row filled across, so the grey
    reflections inside it count too. Its beach and the grass behind it part it from the far shore's buildings and the
    open sea beyond them, which sea()'s test alone would let in."""
    d = day.load()
    blue = lambda q: (p := d[q])[2] > p[0] + 30
    assert blue(BAY_SEED), f"BAY_SEED {BAY_SEED} is not water in the day art"
    rows = {}
    for x, y in spread([BAY_SEED], blue, day.size):
        lo, hi = rows.get(y, (x, x))
        rows[y] = (min(lo, x), max(hi, x))
    return {(x, y) for y, (lo, hi) in rows.items() for x in range(lo, hi + 1)}


def sea(night, dusk, water):
    """The bay, as runs [y, x0, x1] per row: dark blue water at night that glows at dusk, within the bay's water."""
    n, d, runs = night.load(), dusk.load(), []
    for y in range(101, night.size[1]):
        for x in range(300):
            if (x, y) not in water or not ((p := n[x, y])[2] > p[0] + 10 and p[2] >= p[1] and sum(p) < 170 and sum(d[x, y]) > 330):
                continue
            if runs and runs[-1][0] == y and runs[-1][2] == x - 1:
                runs[-1][2] = x
            else:
                runs.append([y, x, x])
    return runs


def write_fx(out, night, day, dusk, plain=None):
    """city-fx.json and the night's windows, city-windows.json (city-fx.js fetches them only at night); or, given the
    plain art's (its windows, its dusk and its bay), city-winter-fx.json and city-winter-windows.json, found in the winter
    art: windows only where the plain art has them, the bay where the plain dusk glows (winter's is grey) in the plain
    day's water. Returns what winter needs."""
    lit = plain and {tuple(p) for w in plain[0] for p in w["px"]}
    water = plain[2] if plain else bay(day)
    found = windows(night, day, dusk, lit)
    fx = {"sea": sea(night, plain[1] if plain else dusk, water), "walks": WALKS, "plazas": PLAZAS, "lanes": LANES, "lights": LIGHTS}
    stem = name("dusk", bool(plain))
    (out / f"{stem}-fx.json").write_text(json.dumps(fx, separators=(",", ":")))
    (out / f"{stem}-windows.json").write_text(json.dumps(found, separators=(",", ":")))
    if not plain:   # one map for every season, its trees found in the plain day art
        upright(Image.open(PICKED / "city-depth.png").convert("L"), day).save(out / "city-depth.png")
    return found, dusk, water


def upright(depth, day):
    """depth_map.py's map with each of POSTS stood up: all of a post as near as its nearest pixel, and 2 nearer still, so
    a car passing a few rows behind it, which TOL (scene-fx.js) would count as level with it, goes behind. And each of
    TREES stood up: its crown's foliage (greener than red and blue in the day art) as near as the ground at its foot
    (the farthest within 3 px of it), unless it already is nearer."""
    px, art = depth.load(), day.load()
    for x0, y0, x1, y1, fx, fy in TREES:
        foot = min(px[x, fy] for x in range(fx - 3, fx + 4))
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                r, g, b = art[x, y]
                if g > r + 6 and g > b + 8:
                    px[x, y] = max(px[x, y], foot)
    for x, top, foot in POSTS:
        near = max(px[x, y] for y in range(top, foot + 1)) + 2
        for y in range(top, foot + 1):
            px[x, y] = near
    return depth


# The doors going in pushes through (city.js): the tower's entrance and the Apps workshop's roller door, in art px (their
# middle x, y and their width), which the push-in lays on the next view's door.
DOORS = {"tower": [733, 224, 12], "workshop": [900, 287, 16]}


def write_json(out):
    x0, y0, x1, y1 = DOOR_OPEN
    (out / "city.json").write_text(json.dumps({"size": SIZE, "labels": anchors(), "zoom": ZOOM, "maxPx": MAX_PX,
                                               "doors": DOORS, "doorOpen": [x0, y0, x1 - x0, y1 - y0]}))


# The other pages' backdrop (custom.css, under html[data-time]): the middle of the city round the tower, about as tall
# as wide (1.43:1), so it fills a screen's lower part behind the sheet.
BACKDROP = (492, 0, 988, 347)


def build(out):
    phases = json.loads((ROOT / "data" / "phases.json").read_text())
    for picks in (PICKS, WINTER_PICKS):
        if set(phases) != set(picks):
            sys.exit(f"PICKS and WINTER_PICKS must each have data/phases.json's {sorted(phases)}: give every phase a painting")
    plain = None
    for winter, picks in ((False, PICKS), (True, WINTER_PICKS)):
        paletted = {phase: bake(phase, winter) for phase in phases}
        baked = {phase: im.convert("RGB") for phase, im in paletted.items()}
        for phase, im in baked.items():
            path = out / f"{name(phase, winter)}.webp"
            im.save(path, "WEBP", lossless=True, quality=100, method=6, exact=True)
            im.crop(BACKDROP).save(out / f"backdrop{path.name[4:]}", "WEBP", lossless=True, quality=100, method=6, exact=True)
            bake_open(phase, paletted[phase], winter).save(out / f"door-open{path.name[4:]}", "WEBP", lossless=True, quality=100, method=6, exact=True)
            print("drew", path.name, "its backdrop and its open door, from seed", picks[phase])
        plain = write_fx(out, baked["night"], baked["day"], baked["dusk"], plain)
    write_json(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["blockout", "paint", "door", "build", "json"])
    ap.add_argument("out", nargs="?", default="static/building/pixel")
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--start", type=int, default=700)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    ap.add_argument("--time", choices=list(PICKS), default="dusk")
    ap.add_argument("--pick", type=int, help="door: put this candidate into the dusk pick")
    ap.add_argument("--open", type=Path, help="door: keep this whole painting's crop with the doors open, for --time")
    ap.add_argument("--winter", action="store_true", help="paint: edit the hour's pick to winter; door: paint (or with --pick, keep) the hour's open doors in winter")
    a = ap.parse_args()
    if a.cmd == "blockout":
        blockout().save(Path(a.out) / "city-blockout.png")
        print("wrote", Path(a.out) / "city-blockout.png")
    elif a.cmd == "paint":
        paint(a.count, a.start, a.host, a.time, a.winter)
    elif a.cmd == "door":
        if a.winter:
            keep_open_winter(a.time, a.pick) if a.pick is not None else paint_open_winter(a.count, a.start, a.host, a.time)
        elif a.open:
            cut_open(a.open, a.time)
        elif a.pick is not None:
            install_door(a.pick)
        else:
            paint_door(a.count, a.start, a.host)
    elif a.cmd == "json":
        write_json(Path(a.out))
    else:
        build(Path(a.out))
