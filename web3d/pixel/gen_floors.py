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
import sys
from pathlib import Path

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

    def twinkle(self, box, f, count=9, dark_below=330, col=GLOW["city"]):
        """A few dark pixels light up for a while: city windows, stars."""
        x0, y0, x1, y1 = box
        for k in range(count):
            x, y = x0 + (k * 37 + 11) % (x1 - x0), y0 + (k * 13) % (y1 - y0)
            if sum(self.get(x, y)) < dark_below and (k + f // 3) % 3:
                self.put(x, y, col)


def greenish(col):
    r, g, b = col
    return g > 110 and g > r + 30


def bluish(col):
    r, g, b = col
    return b > 150 and b > r + 40


def cyanish(col):
    r, g, b = col
    return g > 150 and b > 150 and r < 120


def reddish(col):
    r, g, b = col
    return r > 180 and g < 130


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
                for y in range(CEIL, H - 12):
                    cv.put(x, y, painting.getpixel((x - LOBBY_X - 8, y - CEIL)))   # the dither repeats every 4
    cv.rect(LOBBY_X + 58, CEIL + 41, LOBBY_X + 73, CEIL + 46, (26, 18, 8))          # the lift's floor display, bezel to bezel
    for y, row in enumerate(FONT[key]):
        for x, ch in enumerate(row):
            if ch == "#":
                cv.put(LOBBY_X + 64 + x, CEIL + 41 + y, GLOW["amber"])
    return img


# --- SumUp, floor 4: a Berlin café that takes cards; the template press stamps out new services for prod ---------
LIGHTS = [(244, 74), (248, 71), (254, 77), (259, 73), (261, 64), (249, 62), (271, 75), (277, 70), (283, 76),
          (287, 72), (272, 65), (288, 66)]   # windows in the skyline install_picks draws
RAM = (193, 70)       # the press's ram, its top-left: it hangs in a bay install_picks leaves empty
CARD = [None, -32, -25, -18, -12, -10, -10, -10, -12, -18, -25, None]   # the card's height over the terminal, by frame
WAVES = ([(-1, 1), (0, 0), (1, 1)], [(-2, 1), (-1, 0), (0, 0), (1, 0), (2, 1)],
         [(-3, 2), (-2, 1), (-1, 0), (0, 0), (1, 0), (2, 1), (3, 2)])   # contactless arcs, 3, 5 and 7 px


def sumup(room, f):
    x, y = RAM                                                      # the press stamps a new service
    y += 2 if f in (5, 6) else 0
    room.rect(x + 4, RAM[1] - 1, x + 6, y, c("steel", 3))
    room.rect(x, y, x + 10, y + 5, INK)
    room.rect(x + 1, y + 1, x + 9, y + 4, c("steel", 4))
    room.rect(x + 1, y + 1, x + 9, y + 2, c("steel", 5))
    room.blink((291, 50, 330, 146), greenish, c("plant", 1), f)     # rack LEDs
    for k, (x, y) in enumerate(LIGHTS):                             # Berlin's windows light up
        if (f + 4 * k) % 6 < 3:
            room.put(x, y, GLOW["city"])
    if CARD[f] is None:                                             # the card taps the terminal
        return
    tx, cy = 152, 78 + CARD[f]
    for y in range(cy, cy + 10):
        for x in range(tx, tx + 16):
            room.put(x, y, INK if y in (cy, cy + 9) or x in (tx, tx + 15) else c("blue", 5 if y < cy + 3 else 4))
    room.rect(tx + 3, cy + 4, tx + 7, cy + 7, c("amber", 5))
    if 5 <= f <= 7:                                                 # approved: green screen, tick, contactless waves
        room.rect(157, 81, 163, 84, GLOW["green"])
        for x, y in ((158, 82), (159, 83), (160, 82), (161, 81)):
            room.put(x, y, INK)
        for i, arc in enumerate(WAVES):
            for dx, dy in arc:
                room.put(tx + 8 + dx, cy - 2 - 2 * i + dy, GLOW["wave"])


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


# --- Billie, floor 5 (Senior, Risk): real-time fraud signals flow through the Flink pipe; the graph flags one -----
def blobs(get, box, pick):
    """The 8-connected patches of pixels in a box that pick(col) takes, largest first, as lists of (x, y)."""
    x0, y0, x1, y1 = box
    seen, out = set(), []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if (x, y) in seen or not pick(get(x, y)):
                continue
            blob, todo = [], [(x, y)]
            seen.add((x, y))
            while todo:
                cx, cy = todo.pop()
                blob.append((cx, cy))
                for nx in (cx - 1, cx, cx + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if x0 <= nx < x1 and y0 <= ny < y1 and (nx, ny) not in seen and pick(get(nx, ny)):
                            seen.add((nx, ny))
                            todo.append((nx, ny))
            out.append(blob)
    return sorted(out, key=len, reverse=True)


THROB = "001100110000"   # the flagged node, pale on a '1': twice, then it rests saturated
WARN = "100110011001"    # the console's warning lamp, lit on a '1'
PIPE_CORE = {  # the pipe's glowing core, row by row: '#' is a lit event; every period divides the loop's 48 px
    61: "#...........#...",
    62: "##.....###......#.......",
    63: "#######.#####..#########",
    64: "........##..............#.......#.......#...##..",
}
assert all(48 % len(row) == 0 for row in PIPE_CORE.values())


def billie_risk(room, f):
    core = (c("cyan", 4), c("cyan", 5))                                        # events stream through the pipe's core
    for y, row in PIPE_CORE.items():
        for x in range(27, 222):
            if room.get(x, y) in core:                                          # the flanges and the clamps stay put
                room.put(x, y, core[row[(x - 4 * f) % len(row)] == "#"])
    lit = {R["cyan"][i]: R["cyan"][i - 2] for i in (3, 4, 5)}
    for k, node in enumerate(blobs(room.get, (223, 30, 301, 81), lambda col: col in lit)):
        if f and (f + 5 * k) % 6 == 0:                                          # each node dims in its turn
            for x, y in node:
                room.put(x, y, lit[room.get(x, y)])
    if THROB[f] == "1":                                                         # the flagged node throbs
        for y in range(52, 76):
            for x in range(255, 281):
                if reddish(room.get(x, y)):
                    room.put(x, y, (255, 150, 128))
    if WARN[f] == "0":
        room.rect(38, 84, 41, 86, c("coral", 1))                                # the console's warning lamp


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


TOWERS = [(100, 84, 116, 126), (182, 84, 196, 126)]   # the two server towers behind the core, trimmed in its magenta
PULSE = "011100111000"   # the core's throb: on a '1' its body is a step brighter, and in the middle of each, its pool
LED = {"green": (GLOW["green"], c("plant", 1)), "amber": (GLOW["amber"], c("amber", 1)), "red": (GLOW["red"], c("red", 1))}
LEDS = [  # the services' status lights on the towers' faces: x, y, colour, lit on a '1'
    (59, 99, "green", "110111011101"), (61, 99, "amber", "111110011111"), (87, 97, "green", "101101101111"),
    (89, 97, "green", "111011110111"), (108, 101, "green", "110110111011"), (110, 101, "red", "111111000111"),
    (185, 97, "green", "101110111011"), (187, 97, "amber", "111101111001"), (205, 96, "green", "110111101101"),
    (207, 96, "green", "111011011011"), (209, 96, "red", "111111100011"), (226, 98, "green", "101111011101"),
    (228, 98, "amber", "111001111111"),
]


def billie_orchestrator(room, f):
    if PULSE[f] == "1":                                                    # the core throbs twice, easing in and out:
        hide = lambda x, y: None if any(x0 <= x < x1 and y0 <= y < y1 for x0, y0, x1, y1 in TOWERS) else room.get(x, y)
        glow = [p for b in blobs(hide, (0, 0, room.img.width, room.img.height), lambda col: col in R["magenta"])
                if any(117 <= x < 182 and y >= 80 for x, y in b) for p in b]  # its whole glow, cut off at the towers
        up = {R["magenta"][i]: R["magenta"][i + 1] for i in range(1, 5)}
        for x, y in glow:
            if y < 125 or PULSE[f - 1:f + 2] == "111":                     # the body, then the plinth and pool too
                room.put(x, y, up.get(room.get(x, y), room.get(x, y)))
    if f < 10:                                                             # an invoice climbs the screen's green lane,
        x, y = 104 + 3 * f, 55 - f                                         # then is filed
        room.rect(x, y, x + 8, y + 9, INK)
        room.rect(x + 1, y + 1, x + 7, y + 8, c("cream", 5))
        room.rect(x + 1, y + 1, x + 7, y + 3, c("violet", 4))
        for yy in (y + 4, y + 6):
            room.rect(x + 2, yy, x + 6, yy + 1, c("cream", 2))
    for x, y, col, on in LEDS:
        room.put(x, y, LED[col][on[f] == "0"])


BELT = {  # the belt's top, row by row, as a 24 px tile riding 2 px a frame: an envelope (flap up), a gap, a stamped one
    98: "wWWWWWWw###GGGGGssG#####",
    99: "WvWWWWvW###GGGGGssG#####",
    100: "WWvWWvWW###GgggGGGG#####",
    101: "wwwvvwww###gggggggg#####",
    102: "########################",
    103: "########################",
    104: "------##------##------##",
}
BELT_INK = {"#": INK, "W": c("cream", 5), "w": c("cream", 4), "v": c("cream", 2), "G": c("steel", 5),
            "g": c("steel", 4), "s": c("amber", 4), "-": c("steel", 2)}


SCREENING = [(283 + 9 * i, 55 + 6 * j, (i, j) in {(2, 0), (0, 2), (3, 3), (1, 5)}) for j in range(6) for i in range(4)]
# the screening board's tiles, 7 x 4 in room pixels, as (x, y, flagged): payments passed in green, a few flagged in red


def billie_payments(room, f):
    for x in range(104, 198):                                              # lift the painted envelopes off the belt:
        room.rect(x, 96, x + 1, 98, room.get(x, 95))                       # the arch post and wall carry on down to it,
    for y, row in BELT.items():                                            # then the belt runs from the feed to the pile
        for x in range(102, 198):
            room.put(x, y, BELT_INK[row[(x - 2 * f) % len(row)]])
    x = 60 + f * 22                                                        # a message travels the ceiling pipe
    if f:
        room.rect(x - 12, 15, x, 16, c("coral", 2))                        # its trail
    room.rect(x, 13, x + 10, 18, INK)
    room.rect(x + 1, 14, x + 9, 17, c("coral", 4))
    for k, (x, y, flagged) in enumerate(SCREENING):                       # the board re-screens two tiles a frame
        if f and (k * 5 + f) % 12 == 0:
            room.rect(x, y, x + 7, y + 4, GLOW["green" if flagged else "red"])


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


# --- Writing, floor 8: the newsroom; a post being typed, then printed -------------------------------------------
POST = (12, 12, 12, 6)   # the laptop's paragraph, line by line
PLASTER = (195, 154, 92)   # the painted rooms' wall (install_picks.WALL)


def writing(room, f):
    n = sum(POST) if f == 0 else (f - 1) * sum(POST) // 10                # the room rests on a finished paragraph;
    for i, w in enumerate(POST):                                           # then a fresh page, typed out by f11
        room.rect(142, 86 + 3 * i, 142 + max(0, min(w, n - sum(POST[:i]))), 87 + 3 * i, c("cream", 4))
    room.nudge((164, 80, 199, 89), [0, 0, 1, 1, 2, 2, 3, 3, 2, 1, 0, 0][f], 0,   # the typewriter's carriage, its
               mask=lambda col: col != PLASTER, bg=PLASTER)                          # sheet and roller, not the wall
    room.nudge((256, 115, 280, 124), 0, [0, 0, 0, 1, 1, 2, 2, 3, 3, 2, 1, 0][f],  # a page eases out of the press
               mask=lambda col: col in R["cream"], bg=c("cream", 5))


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
    "8": ("writing", "red", writing),
    "R": ("roof", "amber", roof),
}


def build(key, out):
    name, accent, animate = FLOORS[key]
    base = frame_base(key, name, accent)
    strip = Image.new("RGBA", (W * FRAMES, H))
    for f in range(FRAMES):
        img = base.copy()
        room = Layer(img.crop((ROOM_X, CEIL, W - 8, H - 12)))
        animate(room, f)
        img.paste(room.img, (ROOM_X, CEIL))
        strip.paste(img, (f * W, 0))
    strip.save(out / f"floor-{key}.png")
    print("drew floor", key)


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    for key in sys.argv[2:] or FLOORS:
        build(key, out)
