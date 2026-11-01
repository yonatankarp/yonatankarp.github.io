# /// script
# dependencies = ["pillow==12.1.0"]
# ///
"""Pixel-art floors for the career building (same approach as Before Dark's gen_art.py).

Run: uv run web3d/pixel/gen_floors.py <out_dir> [KEY ...]

Every floor is a 480x180 side-on cutaway: slab, room, slab. Between the slabs is one Draw Things painting
(paint_rooms.py: the lift lobby carried on into that floor's room) pixelated onto this palette (install_picks.py);
the slabs, the floor number and everything that moves are drawn here, in the painting's own colours. Each floor writes
floor-<key>.png, a horizontal strip of FRAMES animation frames. The browser (web3d/src/pixel.js) slides the
lift doors itself, using DOOR below.
"""
import math
import sys
from itertools import product
from pathlib import Path
from random import Random

from PIL import Image

W, H = 480, 180
CEIL = 14                     # slab above the room: rows 0..CEIL; slab below: rows H - 12..H
FRAMES = 12                   # 12 frames at 8 fps, then the room rests (pixel.js)
LOBBY_X, ROOM_X = 8, 140      # the lobby painting spans 8..140 (under the text card), the room 140..472
HOUSING_X = LOBBY_X + 107   # on the roof, the lift housing ends with the pasted lift (install_picks.LIFT)
DOOR = dict(x0=51, x1=96, mid=74, y0=72, y1=153)   # lift doors in floor pixels; pixel.js mirrors these numbers
PICKS = Path(__file__).resolve().parent / "paintings" / "picks"


def ramp(*hexes):
    return [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in hexes]


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
    # the painted rooms' own light: Billie's cyan and violet, the screening room's coral, the lab's mint
    "cyan": ramp("#08262c", "#0d3f49", "#126470", "#1c94a0", "#3fc6cf", "#9cf0f2"),
    "violet": ramp("#1b1230", "#2c1c4f", "#47307a", "#6a4fa8", "#9b7bff", "#cdbcff"),
    "magenta": ramp("#2a0f33", "#4a1757", "#74228a", "#a332b8", "#d04ee0", "#f09af5"),   # the orchestrator core's glow
    "coral": ramp("#2c0f0e", "#521b18", "#7f2c24", "#b44434", "#ff6b5a", "#ffb0a2"),
    "mint": ramp("#0e211b", "#183b30", "#24594a", "#3a8068", "#62b08e", "#a9dcc2"),
    "grey": ramp("#1a1c1f", "#2e3136", "#484c52", "#6a6f76", "#9499a0", "#c8ccd1"),
}
assert len({c for r in R.values() for c in r}) == sum(len(r) for r in R.values()), "two ramps share a colour"
INK = (10, 11, 16)                                  # outlines
GLOW = {"amber": (255, 181, 71), "green": (124, 242, 176), "city": (255, 210, 138), "wave": (191, 230, 255),
        "red": (255, 80, 64), "cyan": (156, 240, 242)}
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
FONT = {  # 3x5 glyphs for the lift display
    "L": ["#..", "#..", "#..", "#..", "###"], "R": ["##.", "#.#", "##.", "#.#", "#.#"],
    "1": [".#.", "##.", ".#.", ".#.", "###"], "2": ["##.", "..#", ".#.", "#..", "###"],
    "3": ["###", "..#", ".##", "..#", "###"], "4": ["#.#", "#.#", "###", "..#", "..#"],
    "5": ["###", "#..", "##.", "..#", "##."], "6": [".##", "#..", "###", "#.#", "###"],
    "7": ["###", "..#", ".#.", ".#.", ".#."], "8": ["###", "#.#", "###", "#.#", "###"],
    "P": ["##.", "#.#", "##.", "#..", "#.."],
}

# --- Company signs: each storey's logo on a cream plaque, lit in its street window (gen_exterior.lit_sign) ---------
# Traced from the companies' own artwork, box-filtered to the plaque's height and cleaned by hand (baked like FONT):
# Inuitive, inuitive-tech.com's 2017 logo; NiCE, nice.com's header; SumUp, Wikimedia Commons File:SumUp Logo.svg;
# Billie, billie.io's header; Reichman University, en.wikipedia File:Reichman University.svg (its wordmark lettered at
# this size, without the arc of stars, which reads as dots).
# 'k' is INK, 'b' the brand's blue, 'B' its lit top, 'd' its shade, '.' the plaque.
LOGOS = {
    "reichman": [
        "bbbb.............b........................b...b.....................................",
        "b...b......b.....b........................b...b......b....................b..b......",
        "b...b..bb.....bb.bbb..bbbb...bb..bbb......b...b.bbb....b...b..bb..b.b..bb...bbb.b..b",
        "bbbb..b..b.b.b...b..b.b.b.b....b.b..b.....b...b.b..b.b.b...b.b..b.bb..b...b..b..b..b",
        "b.b...bbbb.b.b...b..b.b.b.b..bbb.b..b.....b...b.b..b.b..b.b..bbbb.b....b..b..b..b..b",
        "b..b..b....b.b...b..b.b.b.b.b..b.b..b.....b...b.b..b.b..b.b..b....b.....b.b..b...bbb",
        "b...b..bbb.b..bb.b..b.b.b.b..bbb.b..b......bbb..b..b.b...b....bbb.b...bb..b...b....b",
        "................................................................................b..b",
        ".................................................................................bb.",
    ],
    "inuitive": [
        "...............bBBBBBBBb...............",
        ".............bbbbbbbbbbbbb.............",
        "............bbbbbbbbbbbbbbb............",
        "...........bbbbbbbbbbbbbbbbd...........",
        "............bbbbbbbbbbbbbbd............",
        "..............ddddddddddd..............",
        ".......................................",
        ".......................................",
        "k..k..k..k..k..k..kkkkk..k..k...k..kkkk",
        "k..kk.k..k..k..k....k....k..k...k..k...",
        "k..k.kk..k..k..k....k....k...k.k...kkk.",
        "k..k..k..k..k..k....k....k...k.k...k...",
        "k..k..k...kk...k....k....k....k....kkkk",
    ],
    "nice": [
        ".........BB...............",
        "kkk...kk.Bb...kkkk..kkkkkk",
        "kkk...kk.....kkkkkk.kkkkkk",
        "kkkk..kk.kk.kkk..kk.kk....",
        "kk.k..kk.kk.kk......kk....",
        "kk.kk.kk.kk.kk......kkkkk.",
        "kk..k.kk.kk.kk......kk....",
        "kk..kkkk.kk.kkk..kk.kk....",
        "kk...kkk.kk..kkkkkk.kkkkkk",
        "kk...kkk.kk...kkkk..kkkkkk",
    ],
    "sumup": [
        ".kkkkkkkkkkkkk....................................",
        "kkkkkkkkkkkkkkk...................................",
        "kkkkkk..kkkkkkk...................................",
        "kkkk....kkkkkkk...................................",
        "kkkk...kkkkkkkk.....kk...k..k...kk.kk...k..k...kk.",
        "kkk...kkkkkkkkk....k..k..k..k..k..k..k..k..k..k..k",
        "kkk...kkkkkkkkk....k.....k..k..k..k..k..k..k..k..k",
        "kkkk.kkkkk.kkkk.....kk...k..k..k..k..k..k..k..k..k",
        "kkkkkkkkk...kkk.......k..k..k..k..k..k..k..k..k..k",
        "kkkkkkkkk...kkk....k..k..k..k..k..k..k..k..k..k..k",
        "kkkkkkkk...kkkk.....kk....kk...k..k..k...kk...kkk.",
        "kkkkkkk....kkkk...............................k...",
        "kkkkkkk..kkkkkk...............................k...",
        "kkkkkkkkkkkkkkk...............................k...",
        ".kkkkkkkkkkkkk....................................",
    ],
    "billie": [
        "..kkkk......kk..kk...kk...kk.........",
        ".kkkkkk.....kk..kk...kk...kk.........",
        "kkk..kkk........kk...kk..............",
        "kk....kk........kk...kk..............",
        "kk....kk....kk..kk...kk...kk....kkk..",
        "kkkkkkkk....kk..kk...kk...kk...kk.kk.",
        "kk....kkkk..kk..kk...kk...kk..kk...kk",
        "kk...k..kk..kk..kk...kk...kk..kk...kk",
        "kk..k...kk..kk..kk...kk...kk..kkkkkkk",
        "kk.k....kk..kk..kk...kk...kk..kk.....",
        "kkk.....kk..kk..kk...kk...kk..kk.....",
        "kkkkkkkkk...kk..kkk..kkk..kk...kkkkkk",
        "kkkkkkkk....kk...kkk..kkk.kk....kkkk.",
    ],
}
LETTERS = {  # 5x7 caps for the Billie plates
    "A": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "C": [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
    "D": ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
    "E": ["####", "#...", "#...", "###.", "#...", "#...", "####"],
    "F": ["####", "#...", "#...", "###.", "#...", "#...", "#..."],
    "I": ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
    "K": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "M": ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
    "N": ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
    "O": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "P": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "R": ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
    "S": [".###.", "#...#", "#....", ".###.", "....#", "#...#", ".###."],
    "T": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "Y": ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
    " ": ["..", "..", "..", "..", "..", "..", ".."],
}
# key: (logo, its plate or None). Billie's three floors share its logo, so each names the title and team in the floor's
# accent: 5 and 6 are one Risk team, a storey apart for the promotion. Short, as "STAFF PAYMENTS" overflows its window.
SIGNS = {"1": ("reichman", None), "2": ("inuitive", None), "3": ("nice", None), "4": ("sumup", None),
         "5": ("billie", "SR RISK"), "6": ("billie", "STAFF RISK"), "7": ("billie", "STAFF PAY")}


def c(name, i):
    return R[name][i]


class Layer:
    """A room's pixels with the small edits the animations need, in the room's own coordinates."""

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

    def lift(self, box, mask=None, bg=None):
        """A box's pixels as (x, y, col). With a mask (col -> bool) only the ones it picks out, and those are lifted
        off: their place shows bg, a colour or (x, y) -> colour, so a moving thing leaves no copy of itself behind."""
        x0, y0, x1, y1 = box
        out = [(x, y, self.px[x, y]) for y in range(y0, y1) for x in range(x0, x1)
               if mask is None or mask(self.get(x, y))]
        if mask is not None:
            for x, y, _ in out:
                self.put(x, y, bg(x, y) if callable(bg) else bg)
        return out

    def roll(self, box, shift, mask=None, bg=None):
        """Rotate a strip sideways by whole pixels, wrapping: things riding a belt or a pipe. With a mask, only those
        pixels ride and the strip behind them shows bg (see lift)."""
        x0, x1 = box[0], box[2]
        for x, y, col in self.lift(box, mask, bg):
            self.px[x0 + (x - x0 + shift) % (x1 - x0), y] = col

    def nudge(self, box, dx, dy, mask=None, bg=None):
        """Move a block of pixels by (dx, dy): a press ram, a needle, a lid. With a mask, only those pixels move and
        the place they leave shows bg (see lift)."""
        for x, y, col in self.lift(box, mask, bg):
            self.put(x + dx, y + dy, col)

    def swap(self, a, b):
        """Exchange two equally sized blocks: things trading places on a shelf."""
        w, h = a[2] - a[0], a[3] - a[1]
        ra = [[self.px[a[0] + i, a[1] + j] for i in range(w)] for j in range(h)]
        rb = [[self.px[b[0] + i, b[1] + j] for i in range(w)] for j in range(h)]
        for j in range(h):
            for i in range(w):
                self.px[a[0] + i, a[1] + j], self.px[b[0] + i, b[1] + j] = rb[j][i], ra[j][i]

    def blink(self, box, is_light, off, f, every=11, lit=3):
        """Switch some of the lit pixels in a box off on this frame: LEDs, status lights. Never on frame 0, which the
        room rests on."""
        if f == 0:
            return
        x0, y0, x1, y1 = box
        for y in range(y0, y1):
            for x in range(x0, x1):
                if is_light(self.get(x, y)) and (x * 7 + y * 3 + f * 5) % every < lit:
                    self.put(x, y, off)

    def twinkle(self, box, f, count=9, dark_below=330, col=GLOW["city"], on=None):
        """A few dark pixels (or only pixels of the colours in on) light up for a while: city windows, stars."""
        x0, y0, x1, y1 = box
        for k in range(count):
            x, y = x0 + (k * 37 + 11) % (x1 - x0), y0 + (k * 13) % (y1 - y0)
            if (self.get(x, y) in on if on else sum(self.get(x, y)) < dark_below) and (k + f // 3) % 3:
                self.put(x, y, col)


def bluish(col):
    r, g, b = col
    return b > 150 and b > r + 40


# --- The edges: the room runs on past the strip (#64), and the lobby's planks run the room's way (#75) ----------------
# On a wide screen pixel.js tiles a run of EDGE columns out from art x 8 to the screen's left edge and another from 472
# to its right, over the facade posts; build() appends both after the frames. A run is a stack of row bands, each
# repeating a block of the strip's own columns, (top, bottom, block x, block width[, rise]), so every row carries on
# as the strip leaves it: plain wall and skirting from one bare column, dithered sky from a 4 px block (the dither's
# period), the planks from a block one to three boards wide that starts where a board does. A band with a rise reads
# its row from that many rows down and as many columns left: the "/" boards' top row, where the room's own is its
# skirting's ink (or, rising by a negative number, bare wall from higher up, past a shadow).
# The lobby's planks are the left run's: they fanned "\" and met the room's "/" in a V that read as a crack. So the
# left run's floor bands are laid over the lobby up to x, and the right run's over the room from x, both stopping at
# anything standing on the floor, and each meets the room's own boards where a board starts.
EDGE = 240
FLOOR = H - 24   # the floor's top row; the slab's ink is H - 12
PLANKS = {c("amber", 1), c("amber", 2), c("amber", 3), c("coral", 2), INK}   # boards, seams, red flecks, inked seams
WALL_L = [(0, FLOOR, 22, 1), (H - 12, H, 22, 1)]   # the lobby's wall and skirting: a column free of specks


def wall(x):
    return [(0, FLOOR, x, 4), (H - 12, H, x, 4)]


def boards(x, w):
    return [(FLOOR, H - 12, x, w)]


EDGES = {  # key: (left bands, the lobby re-laid up to x), (right bands, the room re-laid from x)
    "P": ((WALL_L + boards(149, 23), 149),   # outside the ramp the street: the ramp's wall and the beam run on level
          ([(0, 36, W - 9, 1), (36, 110, 468, 4), (110, 142, W - 9, 1), (142, FLOOR, 468, 4), (H - 12, H, 468, 4)]
           + boards(259, 35), 466)),
    "L": ((WALL_L + boards(340, 23), 160), (wall(468) + boards(340, 23), 472)),
    "1": ((WALL_L + boards(167, 11), 150), (WALL_L + boards(341, 12), 472)),
    "2": ((WALL_L + boards(146, 23), 146), (WALL_L + boards(146, 23), 472)),
    "3": ((WALL_L + boards(142, 11), 142), (wall(468) + boards(414, 11), 472)),
    "4": ((WALL_L + [(FLOOR, FLOOR + 1, 150, 24, 1), (FLOOR + 1, H - 12, 150, 24)], 150),
          (WALL_L + [(FLOOR, FLOOR + 1, 150, 24, 1), (FLOOR + 1, H - 12, 150, 24)], 472)),
    "5": ((WALL_L + boards(226, 23), 150), (WALL_L + boards(226, 23), 472)),
    "6": ((WALL_L + boards(191, 23), 145), (wall(468) + boards(191, 23), 466)),
    "7": ((WALL_L + boards(130, 11), 130), (wall(468) + boards(130, 11), 472)),
    "R": ((WALL_L + boards(130, 11), HOUSING_X),   # sky and roof; the railing levels off at the edge
          ([(0, 121, 468, 4), (121, 138, W - 9, 1), (138, H, 468, 4)], 472)),
}
RECOLOUR = {"L": {c("amber", i): c("amber", i - 1) for i in (1, 2, 3)}}   # the lobby's boards from the reception's,
# which its door lights a step brighter
CLOSE = {  # key: things standing at the room's right edge end at x, outlined: the right run's rows y0..y1 are laid from
    # x on, and column x - 1 is inked down to row ink where it is not that run's (a bookcase, desk, rack, leaf, plinth);
    # from row slant on, a pixel further left each row: a shadow on the floor ends along the boards
    "1": (464, 58, H - 12, 156),
    "2": (469, 100, H - 12, 156, 164),
    "4": (461, 147, FLOOR, 147),
    "5": (463, 100, H - 12, 156),
    "L": (466, 157, H - 12, 157),
}


def band_at(bands, y):
    return next(b for b in bands if b[0] <= y < b[1])


def edge_px(src, band, x, y, recolour=None):
    """The colour a band puts at (x, y), read from src (x, y) -> colour."""
    _, _, bx, bw, *rise = band
    rise = rise[0] if rise else 0
    col = src(bx + (x - rise - bx) % bw, y + rise)
    return (recolour or {}).get(col, col)


def standing(get, y, xs):
    """The x in xs where something stands on the floor in row y: anything off the planks, 5 or more dark pixels in a
    row (a shadow; a seam is at most 2 wide), and ink touching either (an outline)."""
    off, run = set(), []
    for x in [*xs, None]:
        if x is not None and get(x, y) != c("amber", 2):
            run.append(x)
            continue
        off |= {r for r in run if len(run) >= 5 or get(r, y) not in PLANKS}
        run = []
    return off | {x for x in xs if get(x, y) == INK and {x - 1, x + 1} & off}


def relay(img, key):
    """Lay the lobby's planks and the room's last boards before its right edge from the edge bands (see EDGES)."""
    px, orig = img.load(), img.copy()
    o = orig.load()
    get = lambda x, y: o[x, y][:3]
    src = get
    if key == "R":   # the lift housing's floor is floor 7's lobby, so the ride up keeps the boards' direction
        seven = Image.open(PICKS / f"{FLOORS['7'][0]}-px.png").convert("RGB")
        src = lambda x, y: seven.getpixel((x - LOBBY_X, y - CEIL))
    for x, y in product(range(LOBBY_X, 35), range(140, FLOOR)):   # the lobby's skirting up to the lift, free of the
        px[x, y] = o[22, y]                                         # painting's specks where the left run meets it
    (left, lx), (right, rx) = EDGES[key]
    for bands, xs in ((left, range(LOBBY_X, lx)), (right, range(rx, W - 8))):
        for y in range(FLOOR, H - 12):
            band = band_at(bands, y)
            off = standing(get, y, range(max(xs.start, 100), xs.stop)) if key != "R" else set()
            for x in xs:
                if x not in off:
                    px[x, y] = (*edge_px(src, band, x, y, RECOLOUR.get(key) if bands is left else None), 255)
    if key in CLOSE:
        x0, y0, y1, ink, *slant = CLOSE[key]
        for y in range(y0, y1):
            band = band_at(right, y)
            for x in range(x0 - max(0, y - slant[0] + 1) if slant else x0, W - 8):
                px[x, y] = (*edge_px(get, band, x, y), 255)
            if y < ink and get(x0 - 1, y) not in (edge_px(get, band, x0 - 1, y), INK):
                px[x0 - 1, y] = (*INK, 255)


def margins(img, key):
    """The two runs build() appends: EDGE columns left of art x 8, then EDGE columns from 472."""
    o = img.load()
    get = lambda x, y: o[x, y][:3]
    out = Image.new("RGBA", (2 * EDGE, H))
    q = out.load()
    (left, _), (right, _) = EDGES[key]
    left = [(b[0], b[1], LOBBY_X, b[3]) if b[0] >= FLOOR else b for b in left]   # read the lobby's boards, as laid
    for i in range(EDGE):
        for y in range(H):
            q[i, y] = (*edge_px(get, band_at(left, y), LOBBY_X - EDGE + i, y), 255)
            q[EDGE + i, y] = (*edge_px(get, band_at(right, y), W - 8 + i, y), 255)
    return out


def panel(cv, x, y, w, h, face, shade):
    """An inked board, lit from above: its bottom row in shade."""
    cv.rect(x, y, x + w, y + h, INK)
    cv.rect(x + 1, y + 1, x + w - 1, y + h - 1, face)
    cv.rect(x + 1, y + h - 2, x + w - 1, y + h - 1, shade)


def sign(cv, key, x, y):
    """A floor's sign with its top-left at (x, y): the logo's plaque, and its team's plate beside it in the floor's
    accent. Returns its box (x0, y0, x1, y1)."""
    logo, team = SIGNS[key]
    rows, accent = LOGOS[logo], FLOORS[key][1]
    w, h = len(rows[0]) + 6, len(rows) + 4
    panel(cv, x, y, w, h, c("cream", 5), c("cream", 4))
    ink = {"k": INK, "b": c("blue", 3), "B": c("blue", 4), "d": c("blue", 2)}
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch in ink:
                cv.put(x + 3 + dx, y + 2 + dy, ink[ch])
    if not team:
        return x, y, x + w, y + h
    word = ["".join(("." if i else "") + LETTERS[ch][r] for i, ch in enumerate(team)) for r in range(7)]
    px, py, pw = x + w + 3, y + (h - 11) // 2, len(word[0]) + 6
    panel(cv, px, py, pw, 11, c(accent, 4), c(accent, 3))
    cv.rect(px + 1, py + 1, px + pw - 1, py + 2, c(accent, 5))                # its lit top row
    for dy, row in enumerate(word):
        for dx, ch in enumerate(row):
            if ch == "#":
                cv.put(px + 3 + dx, py + 2 + dy, INK)
    return x, y, px + pw, y + h


def frame_base(key, room_name, accent):
    """The static floor: slabs with the floor's colour band, facade edges, the lobby (with its number), the room."""
    img = Image.new("RGBA", (W, H), (*INK, 255))
    cv = Layer(img)
    cv.rect(0, 0, W, CEIL, c("dark", 1))
    cv.rect(0, CEIL - 4, W, CEIL - 2, c(accent, 4))
    cv.rect(0, H - 12, W, H, c("dark", 1))
    cv.rect(0, H - 12, W, H - 11, INK)
    for x0 in (0, W - 8):
        cv.rect(x0, CEIL, x0 + 8, H - 12, c("dark", 2))
    painting = Image.open(PICKS / f"{room_name}-px.png").convert("RGB")
    img.paste(painting, (LOBBY_X, CEIL))                                    # lobby + room, 464 wide
    if key == "R":   # open sky: only the lift housing keeps a roof; the sky runs up and out to the right edge
        for x in range(HOUSING_X, W):
            col = painting.getpixel((min(x - LOBBY_X, painting.width - 1), 0))
            cv.rect(x, 0, x + 1, CEIL, col)
            if x < HOUSING_X + 2:                                            # the lift housing's corner
                cv.rect(x, 0, x + 1, H - 12, c("dark", 2) if x == HOUSING_X else INK)
                continue
            if x >= W - 8:
                for y in range(CEIL, H - 12):                                # the dither repeats every 4; the railing
                    sy = max(121, y - 2) if 121 <= y < 142 else y            # (rows 121-141) falls 2 rows in those 8
                    cv.put(x, y, painting.getpixel((x - LOBBY_X - 8, sy - CEIL)))
    relay(img, key)
    cv.rect(LOBBY_X + 58, CEIL + 41, LOBBY_X + 73, CEIL + 46, (26, 18, 8))          # the lift's floor display, bezel to bezel
    for y, row in enumerate(FONT[key]):
        for x, ch in enumerate(row):
            if ch == "#":
                cv.put(LOBBY_X + 64 + x, CEIL + 41 + y, GLOW["amber"])
    return img


# --- SumUp, floor 4: a market hall of small shops, each taking cards on its own reader -------------------------------
TERMINALS = [90, 194, 226, 305]   # the card readers' left columns, screen top at row 90 (install_picks draws them)
CARD = [None, -22, -17, -13, -11, -9, -9, -9, -11, -13, -17, None]   # the card's top over the coffee cart's reader, by frame
WAVES = ([(-1, 1), (0, 0), (1, 1)], [(-2, 1), (-1, 0), (0, 0), (1, 0), (2, 1)],
         [(-3, 2), (-2, 1), (-1, 0), (0, 0), (1, 0), (2, 1), (3, 2)])   # contactless arcs, 3, 5 and 7 px
PAID = {0: (2, 3), 2: (8, 9), 3: (10, 11), 1: (5, 6, 7)}   # reader: the frames its screen shows approved


def approved(room, x):
    room.rect(x + 1, 90, x + 7, 93, GLOW["green"])
    for dx, dy in ((2, 1), (3, 2), (4, 1), (5, 0)):                        # a tick
        room.put(x + dx, 90 + dy, INK)


def sumup(room, f):
    for k, frames in PAID.items():                                         # one shop after another takes a payment
        if f in frames:
            approved(room, TERMINALS[k])
    if CARD[f] is None:                                                    # the card taps the coffee cart's reader
        return
    tx, cy = TERMINALS[1] - 2, 89 + CARD[f]
    for y in range(cy, cy + 8):
        for x in range(tx, tx + 12):
            room.put(x, y, INK if y in (cy, cy + 7) or x in (tx, tx + 11) else c("blue", 5 if y < cy + 3 else 4))
    room.rect(tx + 2, cy + 3, tx + 5, cy + 5, c("amber", 5))              # its chip
    if 5 <= f <= 7:                                                        # contactless waves over it
        for i, arc in enumerate(WAVES):
            for dx, dy in arc:
                room.put(tx + 6 + dx, cy - 2 - 2 * i + dy, GLOW["wave"])


# --- NICE, floor 3: a contact-centre operations room; the cache cabinet reshuffles (the cache refactor) -------
CITIES = [(137, 43), (145, 48), (141, 53), (149, 63), (165, 48), (169, 58), (178, 46), (186, 52), (194, 49),
          (190, 64)]   # cities on the wall map
STATS = [(53, 14), (56, 9), (59, 18), (62, 6), (65, 12), (68, 16)]   # the queue-stats bars: row, length from x 208
PRINTER = (294, 90)   # the printer's 8 px output slot: its left end and the lid's top row (install_picks draws the lid)
SHEET = [9, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]   # how far the sheet is out, by frame: taken (fading) at f1, printed by f11


def nice(room, f):
    for i, (x, y) in enumerate(CITIES):                                                 # calls light up on the map
        k = (f + 5 * i) % 6
        if k < 2:
            room.put(x, y, GLOW["amber"])
        if k == 1:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                room.put(x + dx, y + dy, c("amber", 3))
    for i, (y, n) in enumerate(STATS):                                                  # queue stats tick
        room.rect(208, y, 208 + n + [0, 1, 2, 1][(f + i) % 4], y + 1, c("plant", 5))
    if 4 <= f <= 9:
        room.swap((21, 56, 50, 73), (21, 76, 50, 93))                                   # the cache reshuffles
    x, y = PRINTER                                                                      # release notes print
    top = y - SHEET[f]
    for py in range(top, y):
        for px in range(x, x + 8):
            if f == 1 and (px + py) % 2:
                continue
            line = x + 2 <= px < x + 6 and py > top and (py - top) % 2 == 0
            room.put(px, py, INK if py == top or px in (x, x + 7) else c("cream", 3 if line else 5))
    room.blink((281, 100, 301, 143), bluish, c("blue", 2), f)                           # rack lights


# --- Billie, floor 5 (Senior, Risk): a credit desk; the scale weighs an order's invoices against its limit ------
GAUGE = (108, 50)    # the credit gauge's pivot (install_picks draws its face)
NEEDLE = [140, 132, 118, 100, 84, 72, 70, 80, 98, 118, 134, 140]   # the needle's angle, degrees from the right, by frame
SCALE = (30, 70)     # the balance's pivot, on its post (install_picks draws the post and foot)
TILT = [0, 0, 1, 2, 3, 3, 2, 1, 0, -1, -1, 0]   # the beam's left end, rows below level, by frame: the invoices weigh in
STAMP = [0, 0, 0, -1, -2, -3, -3, 0, 0, 0, 0, 0]   # the stamp's lift, by frame: up, then down on the invoices
PLASTER = (195, 154, 92)   # the painted rooms' wall (install_picks.WALL)


def segment(room, x0, y0, x1, y1, col):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        room.put(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), col)


def billie_risk(room, f):
    gx, gy = GAUGE                                                         # the gauge swings toward red, then settles
    a = math.radians(NEEDLE[f])
    segment(room, gx, gy, round(gx + 12 * math.cos(a)), round(gy - 12 * math.sin(a)), INK)
    room.rect(gx - 1, gy - 1, gx + 2, gy + 2, INK)
    room.put(gx, gy, c("steel", 4))
    px, py = SCALE                                                         # the balance: a beam, two pans on chains
    for side, t in ((-1, TILT[f]), (1, -TILT[f])):
        ex, ey = px + 15 * side, py + t
        segment(room, px, py, ex, ey, c("amber", 4))
        segment(room, px, py - 1, ex, ey - 1, INK)
        segment(room, px, py + 1, ex, ey + 1, INK)
        yp = ey + 20                                                       # the pan's rim
        segment(room, ex, ey + 2, ex - 6, yp - 1, c("amber", 2))
        segment(room, ex, ey + 2, ex + 6, yp - 1, c("amber", 2))
        room.rect(ex - 7, yp, ex + 8, yp + 1, INK)
        room.rect(ex - 6, yp + 1, ex + 7, yp + 2, c("amber", 4))
        room.rect(ex - 4, yp + 2, ex + 5, yp + 3, c("amber", 3))
        for dx, dy in ((-7, 1), (7, 1), (-5, 2), (5, 2)):                   # its ink sides
            room.put(ex + dx, yp + dy, INK)
        room.rect(ex - 4, yp + 3, ex + 5, yp + 4, INK)
        if side < 0:                                                       # invoices on the left pan
            room.rect(ex - 5, yp - 6, ex + 6, yp, INK)
            room.rect(ex - 4, yp - 5, ex + 5, yp, c("cream", 5))
            room.rect(ex - 3, yp - 3, ex + 4, yp - 2, c("cream", 2))
        else:                                                              # coins on the right
            for cx0, n in ((ex - 4, 3), (ex + 1, 2)):
                for k in range(n):
                    room.rect(cx0, yp - 2 - 2 * k, cx0 + 4, yp - 2 * k, INK)
                    room.rect(cx0 + 1, yp - 2 - 2 * k, cx0 + 3, yp - 1 - 2 * k, c("amber", 5))
    room.rect(px - 1, py - 1, px + 2, py + 2, INK)                         # the pivot pin
    room.put(px, py, c("amber", 5))
    if STAMP[f]:                                                           # the stamp lifts, then comes down
        room.nudge((156, 78, 170, 99), 0, STAMP[f], mask=lambda col: col != PLASTER, bg=PLASTER)


# --- Inuitive, floor 2: the 3D-vision lab; a calibration scan sweeps the checkerboard -------------------------
BOARD_LEDS = ("110100110100", "011011000110", "100110101001", "001001110011")   # on/off over the 12 frames


def inuitive(room, f):
    room.put(31, 80, GLOW["red"])                                          # the board's power LED, and its activity LEDs
    for i, on in enumerate(BOARD_LEDS):
        room.put(34 + 2 * i, 80, GLOW["green"] if on[f] == "1" else c("plant", 1))
    if f:                                                                  # the calibration line sweeps the grid
        y = 30 + 4 * f
        for x in range(249, 297):
            if not (x >= 283 and y >= 71):                                 # behind the camera, not over it
                room.put(x, y, GLOW["cyan"])
    if f % 6 < 4:
        room.rect(293, 74, 295, 75, GLOW["red"])                            # the camera is recording
    if f % 4 < 2:
        room.rect(195, 81, 197, 83, GLOW["cyan"])                           # the robot's depth lens


# --- Billie, floor 6 (Staff, Risk): the orchestrator sorts each order to a verdict; the graph finds a fraud ring ----
NODES = [(242, 38, 0), (258, 32, 0), (250, 56, 0), (240, 74, 0), (262, 82, 0), (282, 86, 0), (298, 78, 0),
         (306, 62, 0), (302, 40, 0), (268, 46, 1), (286, 40, 1), (280, 62, 1)]   # the graph: x, y, in the flagged ring
LINKS = [(0, 1), (0, 2), (1, 9), (2, 9), (2, 3), (3, 4), (4, 11), (4, 5), (5, 6), (6, 7), (7, 8), (8, 10), (6, 11),
         (9, 10), (10, 11), (11, 9)]
LINKED = 4                    # the node found linked to the ring, flagged from frame 6
STACK = {"R": (40, "red"), "A": (48, "amber"), "G": (56, "plant")}   # the stack light's lamps: top row, ramp
STACK_GLOW = {"R": GLOW["red"], "A": GLOW["amber"], "G": GLOW["green"]}
VERDICT = "GGGGGGAARRRG"      # the lamp lit, by frame: orders pass, then one linked to the ring is held and declined
RING = "010010010000"         # the ring's nodes, pale on a '1'


def billie_orchestrator(room, f):
    room.roll((18, 88, 136, 109), f * 9 // 11, mask=lambda col: col != PLASTER, bg=PLASTER)   # parcels ride
    # toward the sorter, the last stopping short of it
    y, _ = STACK[VERDICT[f]]
    room.rect(166, y, 174, y + 7, STACK_GLOW[VERDICT[f]])
    room.rect(166, y, 168, y + 2, c("cream", 5))                           # its glint
    for x, y, flagged in NODES:
        if flagged and RING[f] == "1":
            room.rect(x - 1, y - 1, x + 2, y + 2, c("coral", 5))
    if f >= 6:                                                             # the linked node joins the ring
        (x0, y0, _), (x1, y1, _) = NODES[LINKED], NODES[11]
        segment(room, x0, y0, x1, y1, c("coral", 2))
        room.rect(x0 - 1, y0 - 1, x0 + 2, y0 + 2, c("coral", 4))
        room.put(x1 - 1, y1 - 1, c("coral", 5))


# --- Billie, floor 7 (Staff, Payments): money moves through the tubes to the counter; the vault's wheel turns ------
VAULT = (106, 81)    # the vault door's middle (install_picks draws the door; the wheel is drawn here)
TUBE = (210, 24, 262)   # a capsule's way: along the lower pipe from x 210 on row 24, then down the pipe at x 262
NOTES = (238, 76, 310, 102)   # the counting machine and the cash on it


def billie_payments(room, f):
    cx, cy = VAULT                                                         # the wheel: six spokes with knobs, a turn
    for k in range(6):                                                     # of 5 degrees a frame (60 deg a loop)
        t = math.radians(5 * f + 60 * k)
        dx, dy = math.cos(t), -math.sin(t)
        for r in range(4, 17):
            x, y = round(cx + r * dx), round(cy + r * dy)
            room.put(x + 1, y, INK)
            room.put(x, y + 1, INK)
        for r in range(4, 17):
            room.put(round(cx + r * dx), round(cy + r * dy), c("steel", 5))
        x, y = round(cx + 18 * dx), round(cy + 18 * dy)
        room.rect(x - 1, y - 1, x + 2, y + 2, INK)
        room.put(x, y, c("steel", 4))
    room.rect(cx - 3, cy - 3, cx + 4, cy + 4, INK)                         # the hub
    room.rect(cx - 2, cy - 2, cx + 3, cy + 3, c("steel", 4))
    room.rect(cx - 1, cy - 1, cx + 1, cy + 1, c("steel", 5))
    if 1 <= f <= 8:                                                        # a payment rides the tube down to the counter
        d, (x0, y0, xd) = (f - 1) * 96 // 7, TUBE
        if x0 + d < xd - 4:
            x, y = x0 + d, y0
            room.rect(x - 4, y - 2, x + 5, y + 2, INK)
            room.rect(x - 3, y - 1, x + 4, y + 1, c("coral", 4))
            room.rect(x - 3, y - 1, x + 4, y, c("coral", 5))
        else:
            x, y = xd, y0 + x0 + d - xd + 4
            room.rect(x - 2, y - 4, x + 2, y + 5, INK)
            room.rect(x - 1, y - 3, x + 1, y + 4, c("coral", 4))
            room.rect(x - 1, y - 3, x, y + 4, c("coral", 5))
    if f >= 8:                                                             # and the machine counts it out
        room.blink(NOTES, lambda col: col in (c("mint", 4), c("mint", 5)), c("mint", 2), f, every=5, lit=2)


CITY_LIGHTS = [(57, 99), (68, 99), (79, 99), (90, 100), (101, 100), (112, 100), (123, 100), (134, 101), (236, 100),
               (247, 97), (258, 100), (269, 100), (280, 100), (304, 97), (315, 100), (326, 97)]   # windows, clear of
# the scaffolds, each a 2 x 1 pair


def roof(room, f):
    dy = [0, 0, 1, 1, 2, 2, 3, 3, 2, 2, 1, 0][f]                           # the crane lowers its load and lifts it again:
    room.rect(182, 33, 188, 35, INK)                                       # the trolley, its cable paying out,
    room.rect(185, 35, 186, 45 + dy, INK)
    room.rect(184, 45 + dy, 187, 48 + dy, INK)                             # the hook block,
    room.put(185, 46 + dy, c("amber", 4))
    for i in range(1, 6):                                                  # two slings
        room.put(185 - i, 47 + dy + i * 4 // 5, INK)
        room.put(185 + i, 47 + dy + i * 4 // 5, INK)
    room.rect(178, 52 + dy, 193, 55 + dy, INK)                             # and a steel beam
    room.rect(179, 53 + dy, 192, 54 + dy, c("steel", 3))
    for i, x in enumerate(range(278, 295)):                                # the flag ripples
        if (i // 3 + f) % 4 == 0:
            for y in range(55, 71):
                room.put(x, y, room.get(x, y + 1))
    for k, (x, y) in enumerate(CITY_LIGHTS):                               # the city switches on, window by window
        if (k + f // 3) % 3:
            room.rect(x, y, x + 2, y + 1, GLOW["amber"])
    if f % 4 < 2:
        room.rect(225, 3, 227, 5, GLOW["red"])                              # the warning light on the cat head


# --- Parking: the side projects parked below the street; the games live in the arcade cabinet ----------------
INVADER = ([".###.", "#.#.#", "#####", "#...#"], [".###.", "#.#.#", "#####", ".#.#."])   # legs out, legs in


def parking(room, f):
    bezel = (c("wood", 5), c("amber", 5))                                  # the arcade: its painted glow becomes a dark
    for y in range(65, 86):                                                # face around a clean portrait CRT
        for x in range(30, 44):
            if 33 <= x <= 41 and 65 <= y <= 84:
                room.put(x, y, INK if x in (33, 41) and y in (65, 84) else c("blue", 1))
            elif room.get(x, y) not in bezel:
                room.put(x, y, INK)
    for x in (34, 35, 36, 38, 39, 40):
        room.put(x, 66, c("cream", 3))                                     # the high score
    dx = [0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0][f]                           # attract mode: the invader marches,
    for y, row in enumerate(INVADER[f // 2 % 2]):
        for x, ch in enumerate(row):
            if ch == "#":
                room.put(34 + dx + x, 69 + y, GLOW["green"])
    if f % 6 < 4:
        room.put(37, 79 - 2 * (f % 6), GLOW["amber"])                      # the ship fires,
    room.rect(37, 81, 38, 82, GLOW["cyan"])
    room.rect(36, 82, 39, 83, GLOW["cyan"])
    room.rect(34, 83, 41, 84, c("plant", 3))                               # and the ground line
    if f in (3, 4, 9):                                                     # one tired fluorescent tube flickers: the
        for y in range(15, 29):                                            # diagonal one, not the long ceiling bar
            for x in range(28, 48):
                if min(room.get(x, y)) > 215:
                    room.put(x, y, c("grey", 3))


# --- Lobby: reception, the three recommendations framed on the wall, the building directory --------------------
HEADLIGHT = (255, 236, 170)
PLATES = {  # the directory's name plates that light up, (x, y, rows): on/off over the 12 frames, all off at rest
    (179, 84, 2): "011110000000", (201, 49, 1): "001111000000", (190, 63, 1): "000001111000",
    (212, 84, 2): "000000111100", (223, 42, 1): "000000000110",
}


def reception(room, f):
    for (x, y, rows), on in PLATES.items():
        if on[f] == "1":
            room.rect(x, y, x + 7, y + rows, HEADLIGHT)
    if 0 < f < 11:                                                         # a car's lights pass along the street
        x = 266 + f * 6                                                    # through the glass door, behind its brass
        for dx, col in ((-1, c("amber", 4)), (0, HEADLIGHT), (1, HEADLIGHT)):
            for y in (112, 113):
                if room.get(x + dx, y) == c("steel", 1):
                    room.put(x + dx, y, col)


LAND = ["........................",   # the globe's map, one turn: 24 px, 2 px a frame
        "...##.........###.......",
        "..####.......#####......",
        ".######.....#######.....",
        ".#######....######......",
        "..######.....####.......",
        "...####.......###.......",
        "....###........#........",
        ".....##...........##....",
        ".....###.........####...",
        "......####......######..",
        "......#####.....######..",
        ".......####......####...",
        ".......###........##....",
        "........##..............",
        "........#.........###...",
        ".................#####..",
        "..................###...",
        "........................",
        "........................",
        "........................"]


def reichman(room, f):
    gx, gy, r = 281, 73, 10                                                # the globe turns under fixed shading
    disc = {(dx, dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dx * dx + dy * dy <= r * r + r}
    for dx, dy in disc:
        edge = any(p not in disc for p in ((dx + 1, dy), (dx - 1, dy), (dx, dy + 1), (dx, dy - 1)))
        land = LAND[dy + r][(dx - 2 * f) % 24] == "#"
        lit = 5 if (dx, dy) == (-4, -5) else 4 if 2 * dx + dy < 9 else 3   # a glint; the night side
        room.put(gx + dx, gy + dy, INK if edge else c("plant" if land else "blue", min(lit, 4) if land else lit))
    if f:                                                                  # the hierarchy is drawn again on the board
        room.rect(200, 60 + min(14, 3 + (f - 1) * 3 // 2), 221, 74, c("chalk", 2))
    for i, (y, n) in enumerate(((69, 10), (71, 10), (73, 7))):            # a note typed on the lectern laptop
        n = n if f == 0 else max(0, min(n, (f - 1 - 3 * i) * 4))
        room.rect(247, y, 247 + n, y + 1, c("dark", 3))


FLOORS = {  # key: (painting, accent ramp, animation), bottom to top
    "P": ("parking", "grey", parking),
    "L": ("reception", "wood", reception),
    "1": ("reichman", "mint", reichman),
    "2": ("inuitive", "mint", inuitive),
    "3": ("nice", "blue", nice),
    "4": ("sumup", "amber", sumup),
    "5": ("billie_risk", "cyan", billie_risk),
    "6": ("billie_orchestrator", "violet", billie_orchestrator),
    "7": ("billie_payments", "coral", billie_payments),
    "R": ("roof", "amber", roof),
}


# --- The time of day (#151): baked variants, never a filter or a runtime recolour --------------------------------------
# Dusk is the plain files. Each entry of PHASES bakes exterior-<name>.png, floor-R-<name>.png and floor-P-<name>.png (and
# floor-L-<name>.png with a "door"), so one more entry is one more variant; pixel.js lists the phases it picks from.
# "sky": the dusk bands, top to horizon (the street's end at sky 5, the roof's run on to amber 5), shared by every picture,
# so their dissolve shows no seam. "skyline": the roof's far city, under SKYLINE. "down": the steps down every ramp takes;
# "tone": what stands against the sky, after that. "lit": how many sevenths of the neighbours' windows are on; "lamp": the
# street lamps' light, (amber step, reach) or None for off. Rooms stay as they are: they are lit indoors, and only two
# have an outside view, the garage's ramp ("sky" again) and the lobby's glass door ("door": the street it looks at).
SKYLINE = 103   # the roof strip's row where the far city starts
_BANDS = (c("magenta", 2), c("violet", 3), c("magenta", 5), c("sky", 4), c("sky", 5), c("coral", 5), c("wood", 5), c("amber", 5))
_CITY = (c("sky", 4), c("sky", 5), c("coral", 5), c("violet", 3), c("violet", 2), c("sky", 2), c("magenta", 2))


def _names(*to):
    return [c(*t) for t in to]


def _phase(sky, city, **rest):
    return {"sky": dict(zip(_BANDS, _names(*sky))), "skyline": dict(zip(_CITY, _names(*city))), "tone": {}} | rest


_B, _S, _ST, _CR = "blue", "sky", "steel", "cream"
_WARM = {c("wall", 3): c("wall", 4), c("coral", 2): c("coral", 3), c("coral", 1): c("coral", 2)}   # the sun on brick and plaster
PHASES = {
    "night": _phase(   # cold: blue walls under a moon, the windows the only warm thing left
        ((_S, 1), (_S, 1), (_B, 2), (_B, 2), (_B, 2), (_B, 2), (_B, 3), (_B, 3)),
        ((_B, 2), (_B, 2), (_B, 2), (_B, 1), (_B, 1), (_B, 1), ("dark", 2)), down=2, lit=4, lamp=(3, 1), stars=True, moon=True, spill=True,
        tone={c("wall", 3): c("dark", 3), c("wall", 2): c("dark", 2), c("wall", 4): c("dark", 4), c("wall", 5): c("dark", 5),
              c("plank", 5): c("dark", 4), c("plank", 4): c("dark", 3), c("plank", 3): c("dark", 3), c("cream", 0): c("dark", 2)}),
    "dawn": _phase(    # pearl: a pale mauve going to cream, the sun just up behind the far city, thin pink streaks
        ((_S, 3), (_S, 4), (_ST, 4), (_ST, 4), (_ST, 5), (_CR, 4), (_CR, 5), ("coral", 5)),
        ((_S, 3), (_S, 3), (_S, 4), (_S, 2), (_S, 2), (_S, 2), (_S, 1)), down=1, lit=1, lamp=(4, 0.55), sun=True, morning_star=True,
        streaks=(c("coral", 5), c("sky", 5), 0.3), city_off=True, glint=c("sky", 4),
        door=dict(sky=c("cream", 4), facade=c("sky", 2), unlit=c("sky", 1), lit=c("amber", 3), kerb=c("steel", 2), road=c("steel", 1))),
    "dawn-mist": _phase(   # colder: blue-grey with no sun yet, the lamps still on, the horizon just warming
        ((_B, 3), (_B, 4), (_B, 5), (_B, 5), (_ST, 5), (_ST, 5), (_CR, 4), (_CR, 5)),
        ((_ST, 3), (_ST, 3), (_ST, 4), (_B, 2), (_B, 2), (_B, 2), (_B, 1)), down=1, lit=2, lamp=(4, 0.8), morning_star=True,
        city_off=True, glint=c("blue", 4), tone={c("wall", 3): c("dark", 4), c("plank", 5): c("wall", 3)},
        door=dict(sky=c("steel", 5), facade=c("dark", 3), unlit=c("dark", 2), lit=c("amber", 3), kerb=c("steel", 2), road=c("steel", 1))),
    "day": _phase(     # noon: a clear deep blue fading to pale at the horizon, fat white clouds, the sun on the walls
        ((_B, 3), (_B, 4), (_B, 4), (_B, 5), (_B, 5), (_ST, 5), (_ST, 5), (_CR, 5)),
        ((_ST, 4), (_ST, 4), (_ST, 4), (_ST, 3), (_ST, 3), (_ST, 3), (_ST, 2)), down=0, lit=0, lamp=None, city_off=True, daylit=True,
        clouds=(c("cream", 5), c("steel", 5), 1), glint=c("blue", 5), road=c("grey", 2), tone=_WARM | {c("cream", 0): c("grey", 2), c("plank", 1): c("plank", 3)},
        door=dict(sky=c("blue", 5), facade=c("wall", 4), unlit=c("dark", 3), lit=c("dark", 3), kerb=c("grey", 4), road=c("grey", 2), car=c("red", 3))),
    "day-haze": _phase(    # a hot afternoon: paler all over, a few high wisps, softer shadow
        ((_B, 4), (_B, 5), (_B, 5), (_ST, 5), (_ST, 5), (_CR, 5), (_CR, 5), (_CR, 5)),
        ((_ST, 5), (_ST, 5), (_ST, 4), (_ST, 4), (_ST, 4), (_ST, 4), (_ST, 3)), down=0, lit=0, lamp=None, city_off=True, daylit=True,
        streaks=(c("cream", 5), c("steel", 5), 0.45), glint=c("cream", 4), road=c("grey", 3), tone=_WARM | {c("cream", 0): c("grey", 3), c("plank", 1): c("plank", 3)},
        door=dict(sky=c("steel", 5), facade=c("wall", 5), unlit=c("dark", 3), lit=c("dark", 3), kerb=c("grey", 4), road=c("grey", 3), car=c("red", 3))),
}
ROOF_CLOUDS = ((150, 32, 46), (232, 12, 30), (250, 66, 34), (398, 22, 52), (430, 66, 26))   # x, y, width, on open sky
EDGE_CLOUDS = ((50, 20, 44), (150, 44, 60))                                                 # in the sky past the strip
DOOR_VIEW = (412, 14, 472, 156)      # the lobby's glass door, in strip pixels: its sky down to row 26, the facade, then
DOOR_ROWS = (26, 110)                # the kerb and road (install_picks.foyer)
DOOR_WINDOWS = ((419, 27, 424, 33), (459, 27, 464, 33), (449, 54, 454, 60))   # its lit ones: install_picks.STREET_WINDOWS
RAMP = (458, 74, 80, (457, 459))     # the garage's exit: a point of its sky; the lamp's row and columns (install_picks.garage)


def phase_tone(scheme):
    """Everything on the palette, "down" steps down its ramp, then the scheme's own. INK and the GLOW lights have no ramp."""
    tone = {col: ramp[max(0, i - scheme["down"])] for ramp in R.values() for i, col in enumerate(ramp)}
    return tone | scheme["tone"] | scheme["sky"]


def recolour(img, table, box):
    q, (x0, y0, x1, y1) = img.load(), box
    for y in range(y0, y1):
        for x in range(x0, x1):
            q[x, y] = table.get(q[x, y][:3], q[x, y])


def open_sky(scheme):
    return frozenset(scheme["sky"].values())


def scatter(layer, box, count, seed, on):
    """The still stars: mostly the sky ramp's own dim points, thinning toward the horizon, a few bright."""
    rnd, (x0, y0, x1, y1) = Random(seed), box
    for k in range(count):
        x, y = rnd.randrange(x0, x1), min(rnd.randrange(y0, y1), rnd.randrange(y0, y1))
        if layer.get(x, y) in on:
            layer.put(x, y, c("cream", 5) if k % 7 == 0 else c("sky", 4) if k % 3 else c("sky", 3))


def big_star(layer, x, y, on):
    """A hand-placed star with four dim points; only ever on open sky."""
    if all(layer.get(x + dx, y + dy) in on for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            layer.put(x + dx, y + dy, c("sky", 3))
        layer.put(x, y, c("cream", 5))


def moon(layer, x, y, on):
    """The crescent in two dithered rings of haze, painted where the sky shows."""
    for j in range(-9, 18):
        for i in range(-9, 18):
            d = ((i - 4) ** 2 + (j - 4) ** 2) ** 0.5
            if layer.get(x + i, y + j) in on and d < 13 and BAYER[(y + j) % 4][(x + i) % 4] < 16 - d:
                layer.put(x + i, y + j, c("blue", 3) if layer.get(x + i, y + j) == c("blue", 2) else c("blue", 2))
    for j in range(-3, 12):
        for i in range(-3, 12):
            d, bite = ((i - 4) ** 2 + (j - 4) ** 2) ** 0.5, ((i - 7) ** 2 + (j - 3) ** 2) ** 0.5
            if d < 6.6 and bite > 5.6:
                layer.put(x + i, y + j, c("cream", 4) if d > 5.6 else c("cream", 5))


def sun(layer, x, y, on):
    """The sun just up behind the far city: a disc in a dither of its own light. Its upper half hides what the painting
    left there; below the horizon, only open sky shows it."""
    for j in range(-22, 12):
        for i in range(-30, 31):
            r, col = (i * i + j * j) ** 0.5, layer.get(x + i, y + j)
            haze = (i * i + 4 * j * j) ** 0.5 / 2
            if r < 8 and (j <= 0 or col in on):
                layer.put(x + i, y + j, c("cream", 5) if r < 6 else c("amber", 5))
            elif r >= 8 and y + j < SKYLINE and col in on and haze < 18 and BAYER[(y + j) % 4][(x + i) % 4] < 17 - haze:
                layer.put(x + i, y + j, c("coral", 5))


def cloud(layer, x, y, w, on, look, seed=0):
    """A flat-bottomed heap of round puffs, bright on top and shaded under; "look" flattens it to a streak."""
    top, under, tall = look
    rnd = Random(seed + x)
    puffs = [(x + rnd.randrange(w), (w / 6 + rnd.randrange(max(1, w // 7))) * tall) for _ in range(5)]
    for i in range(x, x + w):
        edge = min(1, min(i - x + 1, x + w - i) / (w / 5))                   # it tapers to its ends
        h = max(0, *[r ** 2 - (i - px) ** 2 * tall ** 2 for px, r in puffs])
        h = int(h ** 0.5 * edge) + 1
        for j in range(h):
            if layer.get(i, y - j) in on or layer.get(i, y - j) in (top, under):
                shade = j < max(1, h // 3) or (j < h // 2 and BAYER[(y - j) % 4][i % 4] < 8)
                layer.put(i, y - j, under if shade else top)


def clouds(layer, spots, scheme, on):
    look = scheme.get("clouds") or scheme.get("streaks")
    for x, y, w in spots if look else ():
        cloud(layer, x, y, w, on, look)


def phase_roof(base, scheme):
    """The roof's dusk baked to another hour, before the crane and the city lights go on: the lift housing stays lit."""
    tone = phase_tone(scheme)
    recolour(base, tone, (HOUSING_X + 2, 0, W, SKYLINE))
    recolour(base, tone | scheme["skyline"], (HOUSING_X + 2, SKYLINE, W, H - 12))
    cv, sky = Layer(base), open_sky(scheme)
    if scheme.get("sun"):
        sun(cv, 250, SKYLINE + 4, sky)
    if scheme.get("morning_star"):
        big_star(cv, 416, 22, sky)
    clouds(cv, ROOF_CLOUDS, scheme, sky)
    if scheme.get("city_off") and scheme["lit"]:                            # the last few still up
        for x, y in CITY_LIGHTS[::5]:
            cv.rect(ROOM_X + x, CEIL + y, ROOM_X + x + 2, CEIL + y + 1, GLOW["city"])
    if scheme.get("stars"):
        for y in (108, 112):                                                # more of the far city is home
            for x in range(HOUSING_X + 5, 466, 7):
                if (x * 5 + y * 3) % 11 < 3 and cv.get(x, y) in scheme["skyline"].values():
                    cv.rect(x, y, x + 2, y + 1, GLOW["amber"])
        cv.rect(365, 49, 369, 54, GLOW["amber"])                            # someone's still up in the crane's cab
        for x in range(296, 356, 9):                                        # and a string of work lights on the scaffold
            cv.rect(x, 78, x + 1, 80, GLOW["city"])
        scatter(cv, (HOUSING_X + 4, 1, 466, 16), 10, 150, sky)              # as sparse as the rows pixel.js tiles above the strip
        scatter(cv, (HOUSING_X + 4, 16, 466, 96), 130, 151, sky)
        for x, y in ((150, 12), (204, 40), (262, 9), (300, 44), (433, 15), (412, 52)):
            big_star(cv, x, y, sky)
    if scheme.get("moon"):
        moon(cv, 164, 20, sky)


def roof_after(img, scheme):
    """What roof() just drew in its dusk colours: the crane's load, and the far city's lights where they are off."""
    tone = phase_tone(scheme)
    recolour(img, {c("amber", 4): tone[c("amber", 4)], c("steel", 3): tone[c("steel", 3)]}, (ROOM_X + 178, CEIL + 33, ROOM_X + 193, CEIL + 60))
    off = {GLOW["amber"]: scheme["skyline"][c("violet", 3)]} if scheme.get("city_off") else {}
    if not scheme["lamp"]:
        off[GLOW["red"]] = c("red", 2)                                      # no warning light at noon
    recolour(img, off, (HOUSING_X + 2, 0, W, H - 12))


def phase_door(img, scheme):
    """The lobby's glass door looks at this hour's street, kept to the door's own glass colours; a passing car's lights too."""
    door, (x0, y0, x1, y1), (sky_to, kerb) = scheme["door"], DOOR_VIEW, DOOR_ROWS
    recolour(img, {c("sky", 2): door["sky"]}, (x0, y0, x1, sky_to))
    for box in DOOR_WINDOWS:
        recolour(img, {c("amber", 4): door["lit"]}, box)
    recolour(img, {c("sky", 1): door["facade"], c("sky", 2): door["unlit"]}, (x0, sky_to, x1, kerb))
    car = door.get("car")
    recolour(img, {c("steel", 2): door["kerb"], c("steel", 1): door["road"]} | ({HEADLIGHT: car, c("amber", 4): car} if car else {}), (x0, kerb, x1, y1))


def phase_ramp(img, scheme):
    """The garage's exit: its dither of sky 1-4 takes the street's bands; the street lamp beyond it goes off with theirs."""
    x, y, lamp_y, lamp_xs = RAMP
    bands = dict(zip(R["sky"][1:5], (scheme["sky"][b] for b in (c("magenta", 2), c("violet", 3), c("sky", 4), c("sky", 5)))))
    road = {c("steel", 1): scheme.get("road", c("steel", 1)), c("steel", 3): c("steel", 3)}
    q, seen, todo = img.load(), set(), [(x, y)]
    while todo:                                                             # the opening, from inside it
        x, y = todo.pop()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H) or q[x, y][:3] not in bands.keys() | road.keys():
            continue
        seen.add((x, y))
        todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for x, y in seen:
        col = q[x, y][:3]
        q[x, y] = bands.get(col) or road[col]
    if not scheme["lamp"]:
        Layer(img).rect(lamp_xs[0], lamp_y, lamp_xs[1], lamp_y + 1, c("steel", 2))
    if scheme.get("stars"):
        scatter(Layer(img), (430, 40, 466, 96), 26, 154, {bands[R["sky"][1]], bands[R["sky"][2]]})


def build(key, out, phase=None):
    name, accent, animate = FLOORS[key]
    scheme = PHASES.get(phase)
    base = frame_base(key, name, accent)
    if scheme and key == "R":
        phase_roof(base, scheme)
    strip = Image.new("RGBA", (W * FRAMES + 2 * EDGE, H))
    for f in range(FRAMES):
        img = base.copy()
        room = Layer(img.crop((ROOM_X, CEIL, W - 8, H - 12)))
        animate(room, f)
        img.paste(room.img, (ROOM_X, CEIL))
        if scheme and key == "R":
            roof_after(img, scheme)
            if scheme.get("stars"):                                         # off the columns the edge runs read
                Layer(img).twinkle((HOUSING_X + 6, 2, 466, 96), f, 21, col=c("cream", 5), on=open_sky(scheme))
        elif scheme and key == "P":
            phase_ramp(img, scheme)
        elif scheme and key == "L":
            phase_door(img, scheme)
        strip.paste(img, (f * W, 0))
    edges = margins(strip.crop((0, 0, W, H)), key)    # from the rest frame: the runs carry on from every frame alike,
    (left, _), (right, _) = EDGES[key]                 # as nothing they read from, or meet, moves
    for y0, y1, bx, bw, *_ in left + right + [(0, H, LOBBY_X, 1), (0, H, W - 9, 1)]:
        for f, x, y in product(range(1, FRAMES), range(bx, bx + bw), range(y0, y1)):
            assert strip.getpixel((x, y)) == strip.getpixel((f * W + x, y)), (key, f, x, y)
    if scheme and key == "R":
        if scheme.get("stars"):
            scatter(Layer(edges), (EDGE, 1, 2 * EDGE, 16), 14, 152, open_sky(scheme))   # the sky past the strip has stars too,
            scatter(Layer(edges), (EDGE, 16, 2 * EDGE, 96), 80, 153, open_sky(scheme))   # its top rows also the sky above it
        clouds(Layer(edges), [(EDGE + x, y, w) for x, y, w in EDGE_CLOUDS], scheme, open_sky(scheme))
    strip.paste(edges, (W * FRAMES, 0))
    strip.save(out / f"floor-{key}{'-' + phase if phase else ''}.png")
    print("drew floor", key, phase or "")


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    for key in sys.argv[2:] or FLOORS:
        build(key, out)
