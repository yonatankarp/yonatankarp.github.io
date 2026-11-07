# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Pixel-art floors for the career tower (same approach as Before Dark's gen_art.py).

Run: uv run web3d/pixel/gen_floors.py <out_dir> [KEY ...]
     uv run web3d/pixel/gen_floors.py --data       # only data/floor_accents.yaml, and the check of data/phases.json

Every floor is a 960x360 side-on cutaway: slab, room, slab. Between the slabs is one Draw Things painting (paint_rooms.py:
the lift lobby carried on into that floor's room) baked by install_picks.py; the slabs, the floor number and everything
that moves are drawn here. Each floor writes floor-<key>.webp: its rest frame, then the two runs pixel.js tiles past the
strip on a wide screen, the lift's cab (a painting of its own, shown as the doors open), then the box that moves (the
same box in all FRAMES - 1 other frames), side by side. The rooms
with another picture at another hour (data/phases.json "baked") also write floor-<key>-<phase>.webp. floors.json is what
web3d/src/ draws by: the frame, the runs, each strip's moving box, the lift doors (pixel.js slides them), the lamps, and
floor 7's capsule (capsule.webp), the lobby's receptionists (receptionists.webp) and its cats (cats-lobby.webp, from
gen_walkers.py), which pixel.js draws live, and the lobby's glass entrance standing open at each hour
(floor-L-open[-PHASE].webp), the way in from the city.

Every run also writes data/floor_accents.yaml from FLOORS (accents()) and checks data/phases.json (check_phases()).
"""
import json
import math
import sys
from pathlib import Path
from random import Random

from PIL import Image, ImageChops, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint_rooms import ENTRANCE_KEEP, FLOOR_SIZE  # noqa: E402

W, H = 960, 360
CEIL, SLAB = 28, 24           # the slab above the room (rows 0..CEIL), and below it (H - SLAB..H)
LOBBY_X = 16                  # the painting spans 16..944, between the facade posts
FRAMES = 12                   # 12 frames at 8 fps, then the room rests (pixel.js)
EDGE, BLOCK = 240, 24         # each run's columns; on the roof, a BLOCK of its sky's edge mirrored for its stars
DOOR = dict(x0=102, x1=198, mid=150, y0=138, y1=306)   # the lift's door panels in strip pixels; pixel.js slides them
SCREEN = (122, 83, 146, 95)   # the floor display over the lift, in the painting's pixels (install_picks.SIGN)
HOUSING = 265                 # on the roof, the lift housing ends here, in the painting's pixels: open sky right of it
CAB = W + 2 * EDGE            # in a strip, where its cab is, after the runs; the moving box's frames follow it
BOXES = CAB + DOOR["x1"] - DOOR["x0"]
PICKS = Path(__file__).resolve().parent / "paintings" / "picks"
ROOT = Path(__file__).resolve().parents[2]   # the repository


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
        p.putdata([index[c] for c in ref.getdata()])
        p.putpalette([v for c in pal for v in c], rawmode=ref.mode)
        p.save(path, optimize=True)
    else:
        ref.save(path, optimize=True)
    with Image.open(path) as back:
        assert back.convert("RGBA").tobytes() == ref.convert("RGBA").tobytes(), f"{path} does not read back as drawn"


def ramp(*hexes):
    return [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in hexes]


# The palette of what is drawn in code (slabs, lights, screens), the accents and the icons (gen_icons.py). The paintings,
# and the covers baked from them, keep their own colours.
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
GLOW = {"amber": (255, 181, 71), "green": (124, 242, 176), "city": (255, 210, 138), "red": (255, 80, 64),
        "cyan": (156, 240, 242), "white": (255, 244, 220)}
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
FONT = {  # 3x5 glyphs for the lift display, drawn at 2x
    "L": ["#..", "#..", "#..", "#..", "###"], "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
    "3": ["###", "..#", ".##", "..#", "###"], "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "##.", "..#", "##."], "6": [".##", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"],
    "9": ["###", "#.#", "###", "..#", "##."],
}


def c(name, i):
    return R[name][i]


class Layer:
    """A room's pixels with the small edits the animations need, in the painting's own coordinates."""

    def __init__(self, img):
        self.img = img
        self.px = img.load()

    def put(self, x, y, col):
        if 0 <= x < self.img.width and 0 <= y < self.img.height:
            self.px[x, y] = col

    def get(self, x, y):
        return self.px[x, y][:3]

    def rect(self, x0, y0, x1, y1, col):  # half-open
        for y in range(y0, y1):
            for x in range(x0, x1):
                self.put(x, y, col)

    def lit(self, box, is_light, f, every=7, on=3, seed=0):
        """Some of the lit pixels in a box (is_light: col -> bool) go out on this frame, each on its own beat: LEDs,
        city lights, a graph's nodes. Never on frame 0, which the room rests on."""
        if f == 0:
            return
        x0, y0, x1, y1 = box
        for y in range(y0, y1):
            for x in range(x0, x1):
                col = self.get(x, y)
                if is_light(col) and (x // 2 * 7 + y // 2 * 3 + seed + f * 5) % every >= on:
                    self.put(x, y, tuple(v * 3 // 5 for v in col))

    def brighten(self, x, y, k):
        """Toward white by k (0..1): a glint passing over the painting."""
        self.put(x, y, tuple(round(v + (255 - v) * k) for v in self.get(x, y)))


def lum(col):
    return (col[0] * 299 + col[1] * 587 + col[2] * 114) // 1000


def line(room, x0, y0, x1, y1, col, w=1):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        x, y = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
        room.rect(x, y, x + w, y + w, col)


def sprite(room, x, y, rows, col, scale=2, upto=None, k=1.0):
    """1px strokes drawn at scale; upto: only the bottom that many rows, a drawing still being made; k: how much of the
    colour goes over what is there (chalk lets the board show through)."""
    for dy, row in enumerate(rows):
        if upto is not None and dy < len(rows) - upto:
            continue
        for dx, ch in enumerate(row):
            if ch == "#":
                for py in range(y + dy * scale, y + (dy + 1) * scale):
                    for px in range(x + dx * scale, x + (dx + 1) * scale):
                        room.put(px, py, tuple(round(b + (v - b) * k) for v, b in zip(col, room.get(px, py), strict=True)))


# --- The rooms' animations, in the painting's pixels (928 x 308). Each one only paints over what is there: lights,
# screens, chalk, a glint, a flag's folds. Moving a painted object would show what it hides. ------

# Lobby: names on the building's directory light up one after another.
PLATES = [(566, 95, 584, 98), (598, 105, 609, 108), (612, 125, 623, 128), (638, 140, 654, 143), (587, 155, 596, 158),
          (625, 170, 636, 173)]   # x0, y0, x1, y1


def reception(room, f, phase):
    for i, (x0, y0, x1, y1) in enumerate(PLATES):
        if f and (f + 2 * i) % 6 < 2:                                     # lit from behind: its own brass, brighter
            for y in range(y0, y1):
                for x in range(x0, x1):
                    room.brighten(x, y, 0.3)


# Floor 1, Reichman: a tree is drawn in chalk on the board's clean panel, row by row from its root.
TREE = ["....###.###....", "..##...#...##..", ".#...........#.", "#.............#", "#.............#",
        ".#...#...#...#.", "#.....#.#.....#", "#......#......#", ".##....#....##.", "...#########...",
        ".......#.......", ".......#.......", ".......#.......", "......###......", ".....#...#....."]


def reichman(room, f, phase):
    if f:
        sprite(room, 400, 105, TREE, (226, 214, 176), upto=min(len(TREE), f * 2), k=0.7)


# Floor 2, Inuitive: the scope's trace runs on, a calibration line sweeps the checkerboard, the robot's lamp blinks.
SCOPE = (512, 164, 546, 182)


def inuitive(room, f, phase):
    if f:
        x0, y0, x1, y1 = SCOPE
        src = room.img.crop(SCOPE)
        for x in range(x0, x1):
            for y in range(y0, y1):
                room.put(x, y, src.getpixel(((x - x0 + 3 * f) % (x1 - x0), y - y0)))
        y = 94 + 6 * f
        room.rect(579, y, 706, y + 1, GLOW["cyan"])
    if f % 4 < 2:
        room.rect(699, 199, 702, 202, GLOW["red"])


# Floor 3, NICE: calls light up and drop across the world map.
def nice(room, f, phase):
    room.lit((476, 64, 632, 159), lambda col: col[0] > 200 and col[1] > 160 and col[2] < 150, f, every=5, on=2)


# Floor 4, SumUp: one stall after another takes a card payment, its reader's screen going green with a tick.
TERMINALS = [(451, 179, 462, 188), (645, 174, 655, 187), (775, 173, 786, 186)]
PAID = {0: (2, 3, 4), 1: (5, 6, 7), 2: (8, 9, 10)}


def sumup(room, f, phase):
    for k, frames in PAID.items():
        if f in frames:
            x0, y0, x1, y1 = TERMINALS[k]
            room.rect(x0, y0, x1, y1, GLOW["green"])
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            for dx, dy in ((-3, 0), (-2, 1), (-1, 2), (0, 1), (1, 0), (2, -1), (3, -2)):
                room.rect(cx + dx, cy + dy, cx + dx + 1, cy + dy + 2, INK)


# Floor 5, Billie risk: the credit gauge's needle swings toward red and settles (install_picks.unneedle took the
# painted one down).
GAUGE = (344, 105, 26)        # the pivot, and the needle's length
NEEDLE = [52, 52, 40, 22, 4, -10, -16, -12, 2, 22, 40, 52]   # its angle, degrees up from the right, by frame


def billie_risk(room, f, phase):
    cx, cy, n = GAUGE
    a = math.radians(NEEDLE[f])
    line(room, cx, cy, round(cx + n * math.cos(a)), round(cy - n * math.sin(a)), (40, 26, 18), 2)
    line(room, cx, cy, round(cx - 6 * math.cos(a)), round(cy + 6 * math.sin(a)), (40, 26, 18), 2)
    room.rect(cx - 2, cy - 2, cx + 3, cy + 3, (40, 26, 18))
    room.put(cx, cy, c("amber", 4))


# Floor 6, Billie orchestrator: the stack light gives each order its verdict; the fraud ring's nodes pulse on the graph.
STACK = {"R": ((582, 112), GLOW["red"]), "A": ((582, 121), GLOW["amber"]), "G": ((582, 130), GLOW["green"])}
VERDICT = "GGGGGGAARRRG"


def billie_orchestrator(room, f, phase):
    (x, y), col = STACK[VERDICT[f]]
    room.rect(x - 3, y - 3, x + 4, y + 4, col)
    room.rect(x - 2, y - 2, x, y, GLOW["white"])
    room.lit((730, 55, 902, 190), lambda col: col[0] > 200 and col[0] > col[2] + 60, f, every=3, on=1, seed=2)


# Floor 7, Billie payments: a payment rides the pipe down to the counter, and a glint goes round the vault's door. The
# payment is a painted capsule (capsule.webp, from picks/capsule.png: paint_rooms.py capsule) that pixel.js draws live, at the
# screen's frame rate, turned to the pipe and smoothed into the room's own pixels: CAPSULE, in the painting's pixels.
CAPSULE = dict(
    path=[(700, 49), (597, 49), (591, 56), (591, 129), (619, 171), (619, 206)],   # the feed pipe, down, the bend, into the counter
    size=(24, 8), bend=8,          # its length and depth; it turns over this far either side of a bend
    ride=2100, hold=150,           # ms from the room's loop's start, eased in and out, then held at the end
    clip=[(0, 0, 928, 188), (618, 188, 310, 10)],   # where it shows: down to the counter, then only right of the coin stack
)
CAPSULE_SCALE = 4                  # capsule.webp is this many times its size, for the page to smooth down
VAULT = (415, 160, 56)


def billie_payments(room, f, phase):
    cx, cy, r = VAULT
    band = -r + 2 * r * f / (FRAMES - 1)                                   # a diagonal band crossing the door
    for y in range(cy - r, cy + r):
        for x in range(cx - r, cx + r):
            d = (x - cx + y - cy) / 1.4 - band
            if f and abs(d) < 5 and (x - cx) ** 2 + (y - cy) ** 2 < r * r and lum(room.get(x, y)) > 70:
                room.brighten(x, y, 0.35 * (1 - abs(d) / 5))


def capsule(out):
    """capsule.webp: the picked painting with its magenta keyed out (as gen_walkers keys the cats), cropped to the capsule and
    scaled to CAPSULE_SCALE times its size in art pixels. Returns CAPSULE in strip pixels, for floors.json."""
    im = Image.open(PICKS / "capsule.png").convert("RGB")
    bg = [0 if g < 0.55 * min(r, b) and r > 60 and b > 60 else 255 for r, g, b in im.getdata()]
    alpha = Image.new("L", im.size)
    alpha.putdata(bg)
    alpha = alpha.filter(ImageFilter.MinFilter(5))                        # eats the pink fringe
    im.putalpha(alpha)
    w, h = CAPSULE["size"]
    save_lossless(im.crop(alpha.getbbox()).resize((w * CAPSULE_SCALE, h * CAPSULE_SCALE), Image.LANCZOS), out / "capsule.webp")
    return CAPSULE | {"path": [[x + LOBBY_X, y + CEIL] for x, y in CAPSULE["path"]],
                      "clip": [[x + LOBBY_X, y + CEIL, w, h] for x, y, w, h in CAPSULE["clip"]], "size": [w, h]}


# The lobby's receptionist behind its desk, whose top edge (DESK_Y) hides them below the hands: one of two painted people
# (picks/reception/NAME_POSE.png: paint_rooms.py receptionists), picked per visit, baked into receptionists.webp, a row per
# person and a column per pose, which pixel.js draws live (web3d/src/reception.js picks the person and the poses). They rest
# most of the time, and now and then write in the ledger or look toward the lift (left) or the door (right), by their own
# weights, resting in between. spot is their middle, right of the ledger and bell, in the painting's pixels; the times are
# ms, from-to.
RECEPTION = dict(
    spot=458,
    weights={"ana": {"idle": 5, "write": 3, "left": 1.2, "right": 1.2}, "ben": {"idle": 5, "write": 1.2, "left": 1.5, "right": 1.5}},
    times={"start": [1000, 4000], "idle": [2500, 7000], "write": [3000, 6500], "left": [1500, 3200], "right": [1500, 3200]},
)
DESK_Y = 196                  # the desk's top edge, in the painting's pixels
HEAD = 17                     # a receptionist's head, crown to chin, in art pixels: the skeleton's is 7.2 units


def largest(alpha):
    """Only the biggest connected shape stays: the person, not a stray ring of the painted lamp's glow."""
    import numpy as np

    a = np.asarray(alpha) > 0
    h, w = a.shape
    seen = np.zeros_like(a)
    best = []
    for y0 in range(h):
        for x0 in range(w):
            if a[y0, x0] and not seen[y0, x0]:
                part, todo = [], [(y0, x0)]
                seen[y0, x0] = True
                while todo:
                    y, x = todo.pop()
                    part.append((y, x))
                    for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= yy < h and 0 <= xx < w and a[yy, xx] and not seen[yy, xx]:
                            seen[yy, xx] = True
                            todo.append((yy, xx))
                if len(part) > len(best):
                    best = part
    out = np.zeros((h, w), np.uint8)
    for y, x in best:
        out[y, x] = 255
    return Image.fromarray(out)


def receptionists(out):
    """receptionists.webp: each pick with its magenta (and the model's lamp-lit pinks) keyed out, cut at the desk's top and
    above the hair, scaled premultiplied (no halo) so the head is HEAD art px, on 32 colours of its own, only its largest
    shape kept. Returns RECEPTION for floors.json, in strip pixels, with the frame's size and its row on the desk's edge."""
    import numpy as np  # here, not at the top: gen_icons and pixelate import this module with pillow alone

    from paint_rooms import DESK_POSES, DESK_SIZE, DESK_TOP, DESK_U, RECEPTIONISTS

    (W0, H0), s = DESK_SIZE, HEAD / (7.2 * DESK_U)
    rows = []
    for name in RECEPTIONISTS:
        row = []
        for kind in DESK_POSES:
            a = np.asarray(Image.open(PICKS / "reception" / f"{name}_{kind}.png").convert("RGB").resize((W0, H0))).astype(int)
            r, g, b = a[..., 0], a[..., 1], a[..., 2]
            bg = ((g < 0.55 * np.minimum(r, b)) | ((np.minimum(r, b) - g > 45) & (abs(r - b) < 90))
                  | ((r > 200) & (g < 0.6 * r) & (b > g + 15))) & (r > 60) & (b > 60)   # magenta, and its lamp-lit pinks and corals
            bg[DESK_TOP + 4:] = True   # below the desk's top: the room's own desk stands in front
            bg[:40] = True             # the model hangs a lamp over every head: cut above the hair
            alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))
            im = Image.fromarray(a.astype(np.uint8), "RGB")
            im.putalpha(alpha)
            small = im.convert("RGBa").resize((round(W0 * s), round(H0 * s)), Image.BOX).convert("RGBA")
            rgb = small.convert("RGB").quantize(32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
            rgb.putalpha(largest(small.getchannel("A").point(lambda v: 255 if v > 140 else 0)))
            row.append(rgb)
        rows.append(row)
    fw, fh = rows[0][0].size
    sheet = Image.new("RGBA", (fw * len(DESK_POSES), fh * len(rows)))
    for j, row in enumerate(rows):
        for k, f in enumerate(row):
            sheet.paste(f, (k * fw, j * fh))
    save_lossless(sheet, out / "receptionists.webp")
    return RECEPTION | {"people": list(RECEPTIONISTS), "poses": DESK_POSES, "w": fw, "h": fh, "desk": round(DESK_TOP * s),
                        "deskY": DESK_Y + CEIL, "spot": RECEPTION["spot"] + LOBBY_X}


# Yonatan's two cats in the lobby, as on Workshop Row (web3d/src/cats.js), at the lobby's scale (cats-lobby.webp:
# gen_walkers.py bake). Their perches are the bench's seat and the reception counter's top, right of the ledger and bell,
# in front of the receptionist; their street is the floor in front of the desk, off either end of the room and back. Each
# perch is [x0, feet's row, x1], in the painting's pixels; start is where each starts, [x, perch] (None: the floor); still
# is how they are drawn held (reduced motion, the plain page): [pose, x, perch, dir].
LOBBY_CATS = dict(
    perches=[[578, 238, 680], [405, 200, 528]],
    street=302,
    edge=[-50, 978],
    start=[[594, 0], [250, None]],
    still=[["loaf", 640, 0, 1], ["sit", 515, 1, -1]],
)


def lobby_cats():
    """LOBBY_CATS for floors.json, in strip pixels, with k, the cats' size against Workshop Row's, and the room they are
    clipped to."""
    from gen_walkers import CAT, CAT_LOBBY  # here, not at the top: it needs numpy (see receptionists)

    perches = [[x0 + LOBBY_X, y + CEIL, x1 + LOBBY_X] for x0, y, x1 in LOBBY_CATS["perches"]]
    return {"street": LOBBY_CATS["street"] + CEIL, "edge": [x + LOBBY_X for x in LOBBY_CATS["edge"]], "perches": perches,
            "start": [[x + LOBBY_X, p] for x, p in LOBBY_CATS["start"]], "k": CAT_LOBBY / CAT,
            "still": [[pose, x + LOBBY_X, perches[p][1], d] for pose, x, p, d in LOBBY_CATS["still"]],
            "clip": [LOBBY_X, CEIL, W - 2 * LOBBY_X, H - CEIL - SLAB]}


# Roof: the flag's folds run along it, the crane's warning light blinks, and at night the far city's windows twinkle.
FLAG = (812, 94, 845, 127)


def roof(room, f, phase):
    x0, y0, x1, y1 = FLAG
    src = room.img.crop((x0, y0 - 2, x1, y1 + 2))
    for x in range(x0, x1):
        dy = round(2 * math.sin((x - x0) / 5 - f * math.pi / 3) * (x - x0) / (x1 - x0))   # still at the pole
        for y in range(y0, y1):
            room.put(x, y, src.getpixel((x - x0, y - y0 + 2 - dy)))
    if f % 4 < 2 and phase != "day":
        room.rect(708, 4, 711, 7, GLOW["red"])
    if phase == "night":
        room.lit((380, 176, 760, 202), lambda col: col[0] > 200 and col[1] > 150 and col[2] < 140, f, every=4, on=2)


FLOORS = {  # key: (painting, accent ramp, animation, its hanging lamps' x in the painting), bottom to top
    "L": ("reception", "wood", reception, [364, 562, 677]),
    "1": ("reichman", "mint", reichman, [442, 620, 740]),
    "2": ("inuitive", "mint", inuitive, [334, 515, 570, 648, 719, 775]),
    "3": ("nice", "blue", nice, [396, 565, 676, 761]),
    "4": ("sumup", "amber", sumup, [516, 591, 677, 742, 813]),
    "5": ("billie_risk", "cyan", billie_risk, [662, 710]),
    "6": ("billie_orchestrator", "violet", billie_orchestrator, [363, 515, 599, 678]),
    "7": ("billie_payments", "coral", billie_payments, [565, 660, 780]),
    "R": ("roof", "amber", roof, []),
}


def frame_base(key, painting, accent):
    """The static floor: slabs with the floor's colour band, the facade posts, the painting, the floor's number. The roof
    is open sky right of its lift housing, up to the top and over the right post."""
    img = Image.new("RGB", (W, H), INK)
    cv = Layer(img)
    cv.rect(0, 0, W, CEIL, c("dark", 1))
    cv.rect(0, CEIL - 8, W, CEIL - 4, c(accent, 4))
    cv.rect(0, H - SLAB, W, H, c("dark", 1))
    cv.rect(0, H - SLAB, W, H - SLAB + 2, INK)
    for x0 in (0, W - LOBBY_X):
        cv.rect(x0, CEIL, x0 + LOBBY_X, H - SLAB, c("dark", 2))
    img.paste(painting, (LOBBY_X, CEIL))
    if key == "R":
        for x in range(LOBBY_X + HOUSING, W):
            px = min(x - LOBBY_X, painting.width - 1)
            for y in range(CEIL):                                          # the sky's top rows, mirrored up: a
                cv.put(x, y, painting.getpixel((px, CEIL - 1 - y)))        # copied row would streak at every star
            if x >= W - LOBBY_X:
                for y in range(CEIL, H - SLAB):
                    cv.put(x, y, painting.getpixel((px, y - CEIL)))
    x0, y0, x1, y1 = (v + d for v, d in zip(SCREEN, (LOBBY_X, CEIL, LOBBY_X, CEIL), strict=True))
    cv.rect(x0, y0, x1, y1, (26, 18, 8))                                   # the floor display, and its number
    for y, row in enumerate(FONT[key]):
        for x, ch in enumerate(row):
            if ch == "#":
                gx, gy = (x0 + x1) // 2 - 3 + 2 * x, y0 + 1 + 2 * y
                cv.rect(gx, gy, gx + 2, gy + 2, GLOW["amber"])
    return img


def runs(rest, key):
    """The two runs pixel.js tiles past the strip on a wide screen, EDGE columns each: every row goes on as the room's edge
    leaves it, so the run meets the strip, and the next run, with no seam and no pattern (a mirrored block of a painterly
    wall repeated its light in arches). The roof's sky keeps its stars, scattered afresh (scatter)."""
    out = Image.new("RGB", (2 * EDGE, H))
    for y in range(H):
        out.paste(rest.getpixel((LOBBY_X, y)), (0, y, EDGE, y + 1))
        out.paste(rest.getpixel((W - LOBBY_X - 1, y)), (EDGE, y, 2 * EDGE, y + 1))
    if key == "R":   # the right run only: the left one is the lift housing's wall
        block = rest.crop((W - LOBBY_X - BLOCK, 0, W - LOBBY_X, H))
        for i in range(EDGE // BLOCK):
            out.paste(block.transpose(Image.FLIP_LEFT_RIGHT) if i % 2 == 0 else block, (EDGE + i * BLOCK, 0))
        out.paste(scatter(out.crop((EDGE, 0, 2 * EDGE, H))), (EDGE, 0))
    return out


SKY_ROWS, HORIZON = CEIL + 168, CEIL + 194   # the roof's open sky; the far city under it, down to the sea


def scatter(run):
    """Each row of the sky and the far city to its median, and what stood out of the sky (stars, a cloud's edge) put
    back at its own seeded random place in the same row band: the same light, no pattern. The far city, mirrored, read
    as battlements: past the strip it is just the dusk over the sea. Below that, every row goes on as the edge leaves it."""
    px, rnd = run.load(), Random(7)
    lit, rows = [], SKY_ROWS
    for y in range(HORIZON):
        row = [px[x, y] for x in range(run.width)]
        m = sorted(row, key=lum)[len(row) // 2]
        for x, col in enumerate(row):
            if abs(lum(col) - lum(m)) > 24 and y < rows:
                lit.append((y, col))
            px[x, y] = m
    for y, col in lit:
        px[rnd.randrange(run.width), min(rows - 1, max(0, y + rnd.randrange(-6, 7)))] = col
    for y in range(HORIZON, run.height):   # the sea and the parapet, whose slope mirrored into a zigzag: the edge's rows
        for x in range(run.width):
            px[x, y] = px[0, y]
    return run


def frames(key, phase):
    """The floor's FRAMES pictures at an hour (its own painting there, else dusk's)."""
    name, accent, animate, _ = FLOORS[key]
    pick = PICKS / f"{name}-{phase}-px.png"
    painting = Image.open(pick if pick.exists() else PICKS / f"{name}-px.png").convert("RGB")
    base = frame_base(key, painting, accent)
    out = []
    for f in range(FRAMES):
        img = base.copy()
        room = Layer(img.crop((LOBBY_X, CEIL, W - LOBBY_X, H - SLAB)))
        animate(room, f, phase)
        img.paste(room.img, (LOBBY_X, CEIL))
        out.append(img)
    return out


# The lobby's glass entrance standing open, which pixel.js lays over the lobby when the city's push-in comes through it,
# then slides the shut doors' two leaves in over it, as it slides the lift's apart: the doorway, in strip pixels.
ENTRANCE = dict(x0=818, x1=914, mid=866, y0=114, y1=322)


def entrance(out, hours):
    """floor-L-open[-PHASE].webp: each hour's open doorway, cut at ENTRANCE. Its painting is kept only as a crop
    (picks/reception-open[-PHASE].png, at paint_rooms.ENTRANCE_KEEP), box-reduced exactly as install_picks reduces the
    whole painting (the same box filter at the same offset), and put on the colours of that hour's lobby."""
    sx, sy = FLOOR_SIZE[0] / (W - 2 * LOBBY_X), FLOOR_SIZE[1] / (H - CEIL - SLAB)
    x0, x1, y0, y1 = (ENTRANCE[k] - d for k, d in (("x0", LOBBY_X), ("x1", LOBBY_X), ("y0", CEIL), ("y1", CEIL)))
    kx, ky = ENTRANCE_KEEP[:2]
    for hour in ["dusk", *hours]:
        tag = "" if hour == "dusk" else f"-{hour}"
        crop = Image.open(PICKS / f"reception-open{tag}.png").convert("RGB")
        small = crop.resize((x1 - x0, y1 - y0), Image.BOX, box=(x0 * sx - kx, y0 * sy - ky, x1 * sx - kx, y1 * sy - ky))
        pick = PICKS / f"reception{tag}-px.png"
        colours = [c for _, c in Image.open(pick if pick.exists() else PICKS / "reception-px.png").convert("RGB").getcolors(4096)]
        palette = Image.new("P", (1, 1))
        palette.putpalette([v for c in (colours * 256)[:256] for v in c])
        save_lossless(small.quantize(palette=palette, dither=Image.Dither.NONE).convert("RGB"), out / f"floor-L-open{tag}.webp")
    print("drew the lobby's open entrance", *hours)


def build(key, out, hours):
    """floor-<key>.webp, and floor-<key>-<hour>.webp for each hour given: rest frame, runs, the moving box's other frames.
    Every hour's strip has the same box: where any of them moves. Returns it, (x, y, w, h) in strip pixels."""
    pictures = {hour: frames(key, hour) for hour in ["dusk", *hours]}
    boxes = [ImageChops.difference(fs[0], f).getbbox() for fs in pictures.values() for f in fs[1:]]
    boxes = [b for b in boxes if b]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    assert x0 >= LOBBY_X + BLOCK and x1 <= W - LOBBY_X - BLOCK, (key, "moves over what its runs are read from")
    for hour, fs in pictures.items():
        cab = Image.open(PICKS / "cab-px.png").convert("RGB")
        assert cab.size == (DOOR["x1"] - DOOR["x0"], DOOR["y1"] - DOOR["y0"]), "the cab is not the doorway's size"
        strip = Image.new("RGB", (BOXES + (FRAMES - 1) * (x1 - x0), H))
        strip.paste(fs[0], (0, 0))
        strip.paste(runs(fs[0], key), (W, 0))
        strip.paste(cab, (CAB, 0))
        for f in range(1, FRAMES):
            strip.paste(fs[f].crop((x0, y0, x1, y1)), (BOXES + (f - 1) * (x1 - x0), 0))
        save_lossless(strip, out / f"floor-{key}{'' if hour == 'dusk' else '-' + hour}.webp")
    print("drew floor", key, *hours)
    return [x0, y0, x1 - x0, y1 - y0]


# --- What the site reads of the art -------------------------------------------------------------------------------------
# Each storey's accent band, top to bottom, the step of its ramp the band is painted in, ramp[4], but for the lobby's,
# whose #9E7441 was muddy on the button and under AA as link text. P is no storey now: it is the CV's colour for open
# source and courses (layouts/_default/cv.html), the garage's grey it had.
ACCENT_STEP = {"L": 5}
ACCENT_NOTE = {"L": "the wood ramp's top step: its #9E7441 was muddy on the button, under AA as link text",
               "P": "not a storey: the CV's open source and courses, in the old garage's grey"}
EXTRA = {"P": "grey"}


def accents():
    """data/floor_accents.yaml as text: read by the tower and the CV, so a role keeps its colour in both."""
    lines = ["# The colour of each storey's accent band, as painted: written by web3d/pixel/gen_floors.py (accents()) from",
             "# FLOORS. Read by the tower and the CV, so a role keeps its colour in both. Do not edit by hand."]
    for key, accent in [*((k, v[1]) for k, v in reversed(FLOORS.items())), *EXTRA.items()]:
        hexed = "#{:02X}{:02X}{:02X}".format(*R[accent][ACCENT_STEP.get(key, 4)])
        name = f'"{key}"' if key.isdigit() else key
        lines.append(f'{name}: "{hexed}"' + (f"   # {ACCENT_NOTE[key]}" if key in ACCENT_NOTE else ""))
    return "\n".join(lines) + "\n"


def phases(path=ROOT / "data" / "phases.json"):
    """data/phases.json, which the site reads (the time pick, pixel.js, the backdrops' CSS and the scripts), checked
    against the art: each hour bakes exactly the rooms that have a painting at that hour (picks/<room>-<hour>-px.png),
    and dusk, the plain files, none. Returns {hour: its baked keys}."""
    site = json.loads(path.read_text())
    want = {hour: "".join(k for k, (name, *_) in FLOORS.items() if (PICKS / f"{name}-{hour}-px.png").exists())
            for hour in site}
    have = {hour: p["baked"] for hour, p in site.items()}
    assert have == want, f"{path}'s baked rooms disagree with the paintings in {PICKS}: {have} != {want}"
    return want


def sky(out, path=ROOT / "data" / "phases.json"):
    """Each hour's sky in phases.json is the colour pixel.js paints above the roof until its strip arrives: the roof
    strip's own top row (pixel.js reads it at x 600 once it has)."""
    site = json.loads(path.read_text())
    for hour, p in site.items():
        with Image.open(out / f"floor-R{'' if hour == 'dusk' else '-' + hour}.webp") as strip:
            got = "#{:02x}{:02x}{:02x}".format(*strip.convert("RGB").getpixel((600, 0)))
        assert p["sky"] == got, f"{path}: {hour}'s sky is {p['sky']}, its roof strip's top is {got}"


def write_data():
    (ROOT / "data" / "floor_accents.yaml").write_text(accents())
    return phases()


if __name__ == "__main__":
    baked = write_data()
    if sys.argv[1:] == ["--data"]:
        sys.exit()
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    anim = {}
    for key in sys.argv[2:] or FLOORS:
        anim[key] = build(key, out, [hour for hour, keys in baked.items() if key in keys])
        if key == "L":
            entrance(out, [hour for hour, keys in baked.items() if key in keys])
    if not sys.argv[2:]:
        sky(out)
        lamps = {key: [DOOR["mid"], *(x + LOBBY_X for x in v[3])] for key, v in FLOORS.items() if v[3]}
        art = {"frame": [W, H], "frames": FRAMES, "edge": EDGE, "room": [LOBBY_X, W - LOBBY_X], "door": DOOR, "cab": CAB, "boxes": BOXES,
               "entrance": ENTRANCE, "bayer": BAYER, "lamps": lamps, "order": list(FLOORS), "anim": anim, "capsule": {"floor": "7", **capsule(out)},
               "reception": {"floor": "L", **receptionists(out)}, "cats": {"floor": "L", **lobby_cats()}}
        (out / "floors.json").write_text(json.dumps(art))
