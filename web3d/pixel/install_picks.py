# /// script
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Install the picked paintings: crop each candidate and pixelate it onto the palette.

Run: uv run web3d/pixel/install_picks.py [NAME ...]

PICKS records how every painting is made (candidate seed, crop box in painting pixels, colour budget), so it can
always be rebuilt from its tracked candidate. A floor is pixelated whole (lobby and room in one pass, so the
wall and floor colours carry across), then the picked lobby's lift is pasted back over the model's copy of it:
the lift and its doors stay identical on every floor, while the floor, the wall corners and anything standing
beside the lift stay the room's own, so its planks and furniture run unbroken up to the doors. Writes paintings/picks/<name>.png (the crop)
and <name>-px.png (464 x 154; the lobby is 132 x 154). Install the lobby before the floors.
"""
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint_rooms import LOBBY_W, floor_base  # noqa: E402
import gen_floors as G  # noqa: E402
from pixelate import BAYER, dither_bands, pixelate  # noqa: E402

HERE = Path(__file__).resolve().parent / "paintings"
LOBBY_PX = (132, 154)
FLOOR_PX = (464, 154)
LIFT = (27, 0, 107, 142)   # the lift, its lamp and glow in the lobby pixels, down to the door sill (not the floor)
WHOLE = (0, 0, 1920, 640)
PICKS = {  # name: (seed, crop (left, top, right, bottom), colours)
    "lobby": (100, (6, 6, 570, 634), 24),
    "sumup": (451, WHOLE, 40),
    "nice": (400, WHOLE, 40),
    "billie_risk": (400, WHOLE, 40),
    "inuitive": (400, WHOLE, 40),
    "reichman": (400, WHOLE, 40),
    "billie_orchestrator": (417, WHOLE, 40),
    "billie_payments": (417, WHOLE, 40),
    "roof": (400, WHOLE, 40),
    "reception": (400, WHOLE, 40),
    "parking": (400, WHOLE, 40),
    "writing": (400, WHOLE, 40),
}


def match_base(edit):
    """Undo the model's colour drift: map each channel so the edited lobby has the base lobby's mean and spread."""
    e = np.asarray(edit, dtype=np.float64)
    b = np.asarray(floor_base(), dtype=np.float64)[:, :LOBBY_W]
    el = e[:, :LOBBY_W]
    gain = b.std((0, 1)) / el.std((0, 1))
    out = (e - el.mean((0, 1))) * gain + b.mean((0, 1))
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGB")


WALL, CONE = (195, 154, 92), (255, 215, 122)   # the lobby's plaster and its lamp's light


LIGHT = {CONE, (191, 165, 140)}                                        # painted light, and its pale halo
RIM, FILL = G.c("cream", 5), (G.c("wood", 2), G.c("wood", 1))           # the lamp's bulb seen under the shade; its two tones


def shade(w):
    """The shared pendant shade, w (odd) px wide at the rim: each row's half-width, from the cap down to the rim. A bell:
    a neck, sides flaring a pixel a row, then straight down to the rim."""
    return [1, 1, *range(2, w // 2 + 1), w // 2, w // 2]


def paint_out(a, box):
    """Paint a box over with the room beside it, row by row, from a side that is bare wall on that row if there is
    one: a painted lamp taken down, so the stamped one (or none) hangs there instead."""
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        a[y, x0:x1] = a[y, x1] if tuple(a[y, x0 - 1]) != WALL and tuple(a[y, x1]) == WALL else a[y, x0 - 1]


def relight(px, lamps=(), gone=(), y_max=124, keep=(), unlit=()):
    """Redraw the rooms' lamps and their light in the lobby lamp's style. The painted lamps come out five different
    ways and their light pools quantise into ragged blobs, so each lamp in `lamps` (x, top, y, w[, length]: its cord
    column, the row the cord hangs from, the row under its shade, the shade's width) is painted out and stamped
    again as the one shared lamp, and the boxes in `gone` (doubled lamps) are painted out. Every bright patch in a
    lamp's sweep that is not outlined like an object (a plaque, a screen) is erased to plaster, and so is any
    lamp-yellow patch on bare wall that no lamp casts. Each lamp gets a cone like the lobby's: solid lamp yellow,
    widening a pixel every second row, fading out in a dither, drawn only over bare wall and stopping short of
    whatever stands under it. A lamp whose cone would reach an `unlit` box (a wall screen) gets none."""
    a = np.asarray(px, dtype=np.int32).copy()
    h, w = a.shape[:2]
    lamps = [(x, top, y, wd, *rest, 30)[:5] for x, top, y, wd, *rest in lamps]
    for x, top, y, wd, _ in lamps:
        paint_out(a, (x - wd // 2 - 3, top, x + wd // 2 + 4, y + 2))
    for box in gone:
        paint_out(a, box)
    lum = a @ np.array([299, 587, 114]) // 1000
    mouths = [(y, x - shade(wd)[-1] + 1, x + shade(wd)[-1] - 1, length) for x, top, y, wd, length in lamps]
    sweep = np.zeros((h, w), dtype=bool)
    for y0, x0, x1, length in mouths:
        for r in range(length):
            if y0 + r < y_max:
                sweep[y0 + r, max(0, x0 - 4 - r * 2 // 3):min(w, x1 + 5 + r * 2 // 3)] = True
    bright = (lum > 160) & (a[..., 0] >= a[..., 2])
    for x0, y0, x1, y1 in keep:                                            # things the light pass must not touch
        bright[y0:y1, x0:x1] = False
    seen = np.zeros_like(bright)
    for y in range(y_max):
        for x in range(w):
            if not bright[y, x] or seen[y, x]:
                continue
            comp, todo = [], [(y, x)]
            seen[y, x] = True
            while todo:                                                    # the patch, 4-connected
                cy, cx = todo.pop()
                comp.append((cy, cx))
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < y_max and 0 <= nx < w and bright[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        todo.append((ny, nx))
            inside = set(comp)
            edge = [(ny, nx) for cy, cx in comp for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1))
                    if (ny, nx) not in inside and 0 <= ny < h and 0 <= nx < w]
            if not any(sweep[p] for p in comp):                            # stray light: a lamp-yellow patch on bare wall
                if all(tuple(a[p]) in LIGHT for p in comp) and sum(tuple(a[p]) == WALL for p in edge) > 0.5 * len(edge):
                    for p in comp:
                        a[p] = WALL
                continue
            ys, xs = zip(*comp)
            if len(comp) >= 12 and len(comp) > 0.88 * (max(ys) - min(ys) + 1) * (max(xs) - min(xs) + 1):
                continue                                                   # a filled rectangle: a whiteboard, a plaque
            if sum(lum[p] < 110 for p in edge) > 0.6 * len(edge):            # framed all round: a plaque, a screen
                continue
            for p in comp:
                a[p] = WALL
    bare = (a == WALL).all(-1)                                             # what the cones may light, before any is drawn
    for x0, y0, x1, y1 in keep:
        bare[y0:y1, x0:x1] = False
    for y0, x0, x1, length in mouths:
        reach = (length - 1) // 2
        if any(x0 - reach < bx1 and x1 + reach >= bx0 and y0 < by1 and y0 + length > by0 for bx0, by0, bx1, by1 in unlit):
            continue
        for xx in range(max(0, x0 - reach), min(w, x1 + reach + 1)):
            for r in range(2 * max(0, x0 - xx, xx - x1), length):         # down the column, from where the cone reaches it
                yy = y0 + r
                if yy + 3 > y_max or not bare[yy:yy + 3, xx].all():        # stop short of whatever stands below
                    break
                fade = r / length
                if fade < 0.55 or (fade < 0.8 and (xx + yy) % 2 == 0) or (xx % 2 == 0 and yy % 2 == 0):
                    a[yy, xx] = CONE
    for x, top, y, wd, _ in lamps:                                         # the lamps, over their light
        rows = shade(wd)
        y0 = y - len(rows)
        a[top:y0, x] = G.INK                                               # the cord
        for r, k in enumerate(rows):
            for xx in range(x - k, x + k + 1):
                d = abs(xx - x)
                if r == len(rows) - 1:
                    a[y0 + r, xx] = G.INK if d == k else RIM
                else:
                    a[y0 + r, xx] = G.INK if d == k or r < 2 or d >= rows[r - 1] else FILL[xx > x]
    return Image.fromarray(a.astype(np.uint8), "RGB")


STEEL = G.R["steel"]


def lift_doors(px):
    """The lobby's lift doors, redrawn: brushed steel lit from the lamp above with one dithered step, a sheen line and
    an edge shadow on each panel, a kick plate. The lamp's stray light beside the frame goes back to plaster."""
    a = np.asarray(px).copy()
    for x0, x1 in ((43, 65), (66, 88)):                                    # the two panels, either side of the seam
        for y in range(58, 139):
            level = 4 - min(1, max(0, (y - 84) / 28))                      # lit steel at the top, one dithered step down
            for x in range(x0, x1):
                step = int(level) + (level % 1 > BAYER[y % 4, x % 4])
                a[y, x] = STEEL[min(5, step)]
            if y < 130:
                a[y, x0 + 3] = STEEL[5]                                    # sheen
            a[y, x1 - 1] = STEEL[1]                                        # edge shadow
        a[131, x0:x1] = STEEL[1]
        a[132:139, x0:x1] = STEEL[2]                                       # kick plate
    for y in range(52, 134):
        for x in list(range(26, 43)) + list(range(90, 108)):
            if tuple(a[y, x]) == CONE:
                a[y, x] = WALL
    return Image.fromarray(a, "RGB")


def sprite(a, x, y, rows, col):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == "#":
                a[y + dy, x + dx] = col


PLANK = {(160, 100, 15), (106, 63, 12)}                                # the floors' planks
SHADE = {(127, 44, 36): (106, 63, 12), (82, 27, 24): (58, 34, 8), (160, 50, 39): (106, 63, 12)}   # skirting maroons


def shadows(px, top):
    """The shadows on the floor quantise to the skirting's maroons. Grow the planks back over them from below `top`,
    from the planks inwards, so maroon things outlined in ink (a desk, a box) keep their colour."""
    a = np.asarray(px).copy()
    h, w = a.shape[:2]
    todo = [(y, x) for y in range(top, h) for x in range(w) if tuple(a[y, x]) in PLANK]
    while todo:
        y, x = todo.pop()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if top <= ny < h and 0 <= nx < w and tuple(a[ny, nx]) in SHADE:
                a[ny, nx] = SHADE[tuple(a[ny, nx])]
                todo.append((ny, nx))
    return Image.fromarray(a, "RGB")


LAMPS = {}      # name: its hanging lamps, (x, top, y, w[, length]) as relight takes them
GONE = {}       # name: boxes of painted lamps to take down (doubled, fused, hung over a screen)
KEEP = {}       # name: boxes the light pass must not touch
UNLIT = {}      # name: boxes no lamp may cast a cone on
TOUCHUPS = {}   # name: the floor's own fix-up, run after the light pass


# --- Parking ---
LAMPS["parking"] = [(207, 37, 51, 9), (243, 34, 50, 15), (319, 36, 48, 15, 12), (343, 36, 46, 13, 12),
                    (387, 23, 46, 11)]   # hung from the ducts; the two over the pegboard short of it

# --- Lobby, reception ---
LAMPS["reception"] = [(161, 0, 31, 19), (189, 0, 30, 11), (226, 0, 30, 11), (258, 0, 30, 11), (292, 0, 31, 19)]

# --- Floor 1, reichman ---
LAMPS["reichman"] = [(190, 0, 29, 15), (203, 0, 29, 11), (254, 0, 27, 13), (323, 0, 27, 13), (364, 0, 29, 15),
                     (387, 0, 29, 13)]   # the two over the board hang clear of its frame
GONE["reichman"] = [(372, 0, 378, 31), (244, 27, 266, 34), (313, 27, 335, 34)]   # a third shade fused between the
# right-hand pair; the painted rims of the two over the board, so its frame runs on under them
GLYPHS = {  # floor 1's chalk drawings, 1px strokes
    "tree": ["....###.###....",
             "..##...#...##..",
             ".#...........#.",
             "#.............#",
             "#.............#",
             ".#...#...#...#.",
             "#.....#.#.....#",
             "#......#......#",
             ".##....#....##.",
             "...#########...",
             ".......#.......",
             ".......#.......",
             ".......#.......",
             "......###......",
             ".....#...#....."],
    "sapling": ["...#####...",
                ".##.....##.",
                "#.........#",
                "#..#...#..#",
                ".#..#.#..#.",
                "..##.#.##..",
                ".....#.....",
                ".....#.....",
                "....###...."],
    "chart": ["#.................###",
              "#..................##",
              "#.................#.#",
              "#.......#........#...",
              "#......#.#......#....",
              "#.....#...#....#.....",
              "#....#.....#..#......",
              "#...#.......##.......",
              "#..#.................",
              "#.#..................",
              "##...................",
              "#####################"],
    "box": ["###########",
            "#.........#",
            "#.......#.#",
            "#......#..#",
            "#..#..#...#",
            "#.#.##....#",
            "#.........#",
            "###########"],
    "doc": ["###########",
            "#.........#",
            "#.#####...#",
            "#.........#",
            "#.######..#",
            "#.........#",
            "#.####....#",
            "###########"],
    "tick": ["###########",
             "#.........#",
             "#.......#.#",
             "#......#..#",
             "#.#...#...#",
             "#..#.#....#",
             "#...#.....#",
             "###########"],
    "graph": [".........###.........",
              ".........#.#.........",
              ".........###.........",
              "........#...#........",
              ".......#.....#.......",
              "......#.......#......",
              "....###.......###....",
              "....#.#.......#.#....",
              "....###.......###....",
              "...#...#.....#...#...",
              "..#.....#...#.....#..",
              ".###...###.###...###.",
              ".#.#...#.#.#.#...#.#.",
              ".###...###.###...###."],
    "right": ["...#..",
              "....#.",
              "######",
              "....#.",
              "...#.."],
    "down": ["..#..",
             "..#..",
             "#.#.#",
             ".###.",
             "..#.."],
    "bars": ["...........##",
             "........##.##",
             "........##.##",
             ".....##.##.##",
             "..##.##.##.##",
             "..##.##.##.##",
             "#############"],
}
BOARD = [("tree", 216, 38), ("sapling", 233, 44), ("tree", 246, 38), ("sapling", 263, 44), ("tree", 276, 38),
         ("bars", 306, 45), ("box", 337, 44), ("down", 340, 53), ("graph", 332, 60),
         ("doc", 216, 65), ("right", 229, 66), ("box", 237, 65), ("right", 250, 66), ("tick", 258, 65),
         ("chart", 288, 62)]


def chalk(px):
    """Floor 1: the board's tree and chart diagrams pixelate into speckle, so the board is wiped to one flat green
    and they are drawn again by hand, as the painting has them: trees along the top, charts and a flow of boxes."""
    a = np.asarray(px).copy()
    board = (209, 34, 367, 83)                                             # the green inside the frame
    green = {G.c("plant", i) for i in (1, 2, 3)}
    for y in range(board[1], board[3]):
        for x in range(board[0], board[2]):
            on_ledge = 234 <= x < 247 and y >= 77 or x >= 360 and y >= 76   # the eraser; the lectern's laptop
            if not on_ledge or tuple(a[y, x]) in green:
                a[y, x] = G.c("chalk", 1 if y == board[1] else 2)       # the frame's shadow along the top
    for name, x, y in BOARD:
        sprite(a, x, y, GLYPHS[name], G.c("cream", 4))
    return Image.fromarray(a, "RGB")


TOUCHUPS["reichman"] = chalk

# --- Floor 2, inuitive ---
LAMPS["inuitive"] = [(159, 0, 30, 19, 16), (192, 0, 30, 19, 16), (258, 0, 30, 19), (323, 0, 30, 19), (369, 0, 30, 19),
                     (430, 0, 30, 19)]   # the first two hang close: short cones, or they merge
TOUCHUPS["inuitive"] = lambda px: shadows(px, 120)

# --- Floor 3, nice ---
LAMPS["nice"] = [(193, 0, 29, 17), (254, 0, 29, 15), (291, 0, 29, 15), (322, 0, 29, 15), (364, 0, 29, 15), (395, 0, 29, 15)]
# hung a little higher, so the shades clear the wall screen's top
GONE["nice"] = [(167, 0, 171, 49), (207, 0, 210, 89),   # two bare cords with no lamp, down to the cabinet and a chair;
                (183, 29, 204, 34), (245, 29, 258, 34), (398, 29, 405, 34)]   # the painted rims left under the shades
KEEP["nice"] = [(366, 28, 402, 80), (144, 49, 191, 144)]   # floor 3's whiteboard, which its lamp's light touches; the
# wall-coloured cabinet, which its cone would dither into
NAVY, BLUE_LED = G.c("dark", 2), G.c("blue", 5)


def ops_room(px):
    """Floor 3: the cabinet's right frame came out as lamp glare, the stats panel and the rack front as scribble, the
    printer as a white shard, the chairs as one black mass. Each is drawn again plainly; the parts that move (the
    stats bars, the printed sheet, the rack LEDs' blinking) are gen_floors.nice()'s."""
    a = np.asarray(px).copy()
    side = a[77, 178:190].copy()                                           # the cabinet's right side, inside to out,
    a[49, 178:190] = G.INK                                                 # from the clean lower shelf: the top,
    a[50:52, 178:189], a[50:52, 189] = G.c("wood", 2), G.INK
    a[52:55, 178:182] = a[52:55, 172:173]
    a[55:61, 163:178] = (191, 165, 140)                                   # the top shelf's back, glare off
    a[55:61, 178:190] = side
    a[61, 176:182] = G.INK
    a[52:73, 182:190] = side[4:]                                           # and the frame down to the shelf
    a[33:75, 338:367] = NAVY                                               # the queue-stats panel: a title,
    a[36, 340:351] = G.c("steel", 3)
    for i, h in enumerate((3, 5, 4, 7, 6, 8)):                             # a bar chart, the bars below (gen_floors)
        a[47 - h:47, 340 + 3 * i:342 + 3 * i] = G.c("plant", 5) if i % 2 == 0 else G.c("amber", 4)
    a[49, 339:366] = G.c("dark", 4)
    a[29, 258:398], a[30, 258:398], a[31:33, 258:398] = WALL, (172, 129, 89), G.INK   # the screen's top, clear of
    a[33, 260:337], a[33, [337, 367]] = G.c("dark", 3), G.INK              # the lamps, and its top-left corner
    a[33:35, 258], a[33:35, 259] = (106, 75, 53), (58, 53, 48)
    a[34:37, 262:337] = G.c("dark", 3)                                     # the map's header, a title bar not text
    a[35, 263:277] = a[35, 279:285] = G.c("steel", 3)
    a[31:33, 368:398] = a[31:77, 396:398] = G.INK                          # the white panel's top and right frame
    a[33:35, 368:396] = G.c("cream", 5)
    for k in range(6):                                                     # the rack: six units, blue LEDs
        y = 104 + 6 * k
        a[y, 414:433], a[y + 1:y + 6, 414:433] = G.c("steel", 2), G.c("dark", 1)
        a[y + 3, 424:431] = G.c("dark", 3)
        for x in (416, 418, 420)[:2 + k % 2]:
            a[y + 3, x] = BLUE_LED
    x0, x1 = 412, 455                                                      # the printer on it: a flat lid, a body
    a[85:90, x0:x1 + 1] = WALL
    a[90:104, x0:x1 + 1] = G.INK
    a[91:93, x0 + 1:x1] = G.c("grey", 5)
    a[94:103, x0 + 1:x1] = G.c("grey", 4)
    slot = G.PRINTER[0] + 132
    a[91, slot:slot + 8] = G.c("dark", 1)                                  # the slot the sheet comes out of
    a[96:100, 416:422] = G.c("cream", 3)                                   # paper in the tray,
    a[96:98, 444:452], a[96, 450] = G.c("dark", 1), G.c("plant", 5)        # the panel
    for y in range(95, 104):                                               # the right-hand desk's edge, one line
        for x in range(384, 409):
            if tuple(a[y, x]) in ((158, 116, 65), (122, 85, 48)):
                a[y, x] = WALL
    for t in range(25):
        a[95 + round(t / 3), 384 + t] = G.INK
    for x0, y0, x1, y1 in ((187, 81, 237, 144), (258, 81, 288, 144), (316, 81, 345, 144), (372, 81, 392, 144)):
        chair = a[y0:y1, x0:x1]                                            # the chairs, a step lighter than ink
        for was, now in (((31, 22, 16), G.c("dark", 3)), ((36, 23, 15), G.c("dark", 4))):
            chair[(chair == was).all(-1)] = now
    a[130:142, 124:144] = a[130:142, 117:118]                              # the skirting runs on past the lobby
    pool = a[129:154, 404:464]                                             # a light pool by the rack with no light:
    lit = (pool == (242, 177, 59)).all(-1) | (pool == CONE).all(-1)
    for y in range(pool.shape[0]):                                         # back to planks, its seams dark again
        for x in range(1, pool.shape[1] - 2):
            for n in (1, 2):
                if lit[y, x - 1] and lit[y, x + n] and not lit[y, x:x + n].any():
                    pool[y, x:x + n] = (106, 63, 12)
    pool[lit] = (160, 100, 15)
    return Image.fromarray(a, "RGB")


TOUCHUPS["nice"] = lambda px: ops_room(shadows(px, 142))   # above, the maroon is its skirting and cabinet

# --- Floor 4, sumup ---
LAMPS["sumup"] = [(177, 0, 34, 13), (236, 0, 33, 13, 0), (268, 0, 33, 13), (304, 0, 35, 13)]   # the copper one is off
GONE["sumup"] = [(158, 0, 168, 36)]   # the doubled pendant beside the first
SKY = [((116, 34, 138), 22), ((142, 120, 160), 33), ((215, 154, 156), 43), ((255, 176, 162), 56)]   # dusk: colour,
# the row it is pure at
CITY = {(116, 34, 138), (142, 120, 160), (215, 154, 156), (255, 176, 162), (71, 48, 122), (44, 28, 79), (255, 210, 138)}
SKYLINE = [  # Berlin's roofs in two flat tones: (x0, x1, top), behind and in front
    [(373, 378, 60), (378, 384, 56), (384, 389, 62), (389, 395, 58), (395, 401, 61), (401, 407, 61), (407, 412, 57),
     (412, 418, 63), (418, 423, 59), (423, 447, 61)],
    [(373, 377, 72), (377, 383, 68), (383, 388, 74), (388, 395, 70), (395, 401, 73), (401, 406, 71), (406, 413, 67),
     (413, 417, 73), (417, 423, 69), (423, 447, 72)]]
CUBE = G.c("cyan", 5), G.c("cyan", 4)


def cube(a, x, y):
    """An 8 x 5 service block, outlined: lit top, cyan face."""
    a[y:y + 5, x:x + 8] = G.INK
    a[y + 1, x + 1:x + 7], a[y + 2:y + 4, x + 1:x + 7] = CUBE


def cafe(px):
    """Floor 4: the window's sky came out in hard bands behind a stair-stepped frame, with a mushy city and two TV
    towers; the press's label, middle and legs melted; the bistro table lost its shape; the menu board is a smear;
    the rack lost its rows. Each is drawn again plainly. The press's ram, the card and the city's lit windows move in
    gen_floors.sumup()."""
    a = np.asarray(px).copy()

    def rack(x, y):                                                        # the rack stands in front of the window
        return x >= 423 and y >= 46 or x >= 438 and y >= 45

    a[4:12, 366:454] = WALL                                                # the window: the old slanted top off,
    for y in range(19, 95):                                                # the panes: an even dusk, two rows of roofs
        for x in range(373, 447):
            if rack(x, y) or x >= 404 and y >= 80 and tuple(a[y, x]) not in CITY:   # nor the plant on the table
                continue
            i = max([k for k, (_, m) in enumerate(SKY) if m <= y], default=0)
            t = 0 if i + 1 == len(SKY) or y < SKY[0][1] else (y - SKY[i][1]) / (SKY[i + 1][1] - SKY[i][1])
            a[y, x] = SKY[i + 1][0] if t > BAYER[y % 4, x % 4] else SKY[i][0]
            for tone, row in zip(((71, 48, 122), (44, 28, 79)), SKYLINE):
                if any(x0 <= x < x1 and y >= top for x0, x1, top in row):
                    a[y, x] = tone
    a[24:34, 411], a[39:59, 411:413] = (71, 48, 122), (71, 48, 122)        # one Fernsehturm
    for y, k in zip(range(34, 39), (1, 2, 2, 2, 1)):
        a[y, 411 - k:412 + k] = (71, 48, 122)
    assert all(tuple(a[y, x + 132]) in ((71, 48, 122), (44, 28, 79)) for x, y in G.LIGHTS), "a lit window off the roofs"
    wood, maroon, ink = ((106, 63, 12), (160, 100, 15)), (127, 44, 36), G.INK
    frame = [  # square bars, (box, colours across the bar): the frame, the casement, the mullion and the transom
        (366, 12, 370, 100, (ink, *wood, ink)), (450, 12, 454, 45, (ink, *wood[::-1], ink)),
        (366, 12, 454, 16, (ink, wood[1], wood[0], ink)),
        (370, 16, 373, 95, (maroon, maroon, ink)), (447, 16, 450, 45, (ink, maroon, maroon)),
        (370, 16, 450, 19, (maroon, maroon, ink)),
        (396, 19, 401, 95, (ink, maroon, maroon, maroon, ink)), (373, 48, 447, 53, (ink, maroon, maroon, maroon, ink))]
    for x0, y0, x1, y1, section in frame:
        across_x = x1 - x0 == len(section)
        for y in range(y0, y1):
            for x in range(x0, x1):
                if not rack(x, y):
                    a[y, x] = section[x - x0] if across_x else section[y - y0]
    a[37:70, 166:221] = (23, 50, 34)                                      # the menu board: one green, menu lines
    for i, n in enumerate((18, 13, 20, 11, 15)):
        a[42 + 5 * i, 170:170 + n], a[42 + 5 * i, 216] = G.c("cream", 3), G.c("amber", 4)
    a[57:65, 332:345] = G.INK                                              # the press: a plain label,
    a[60, [336, 339]] = G.c("amber", 5)
    a[69:82, 323:337] = G.c("amber", 2)                                    # the ram's bay (the ram is gen_floors'),
    cube(a, 326, 77)                                                       # the block under it,
    belt = a[83:105, 340:358]                                              # the belt out and down, its smear cleared,
    keep = np.zeros(belt.shape[:2], dtype=bool)
    for col in (G.INK, (58, 53, 48), WALL, G.c("amber", 4), G.c("amber", 3)):
        keep |= (belt == col).all(-1)
    belt[~keep] = G.INK
    a[84:87, 321:348], a[87, 321:348] = (58, 53, 48), G.INK
    a[88:104, 321:340] = WALL                                              # two finished blocks on the shelf below
    a[84:104, 318:320], a[84:104, 320] = G.c("amber", 4), G.INK            # beside the post's clean inner edge
    cube(a, 322, 99)
    cube(a, 331, 99)
    a[122:138, 312:347] = a[116, 312:347]                                  # its posts straight down to two feet
    for x0, x1 in ((309, 326), (333, 350)):
        a[138, x0:x1] = a[141, x0:x1] = G.INK
        a[139:141, x0:x1], a[139:141, [x0, x1 - 1]] = G.c("amber", 4), G.INK
    a[138:142, 326:333] = WALL
    for k in range(10):                                                    # the rack: a steel line between LED rows
        y = 50 + 7 * k
        a[y, 427:450], a[y + 1:y + 7, 426:450] = G.c("steel", 2), G.INK
        a[y + 3, [437, 442]], a[y + 3, 446] = G.c("plant", 5), G.c("plant", 3)
    a[120, 427:450] = G.c("steel", 2)
    a[100:111, 370:423] = a[99, 411:423] = WALL                            # the bistro table: the old one off,
    a[111:132, 388:423] = WALL
    floor = a[132:144, 388:423]
    for was in ((127, 44, 36), (82, 27, 24), (58, 34, 8), G.INK):
        floor[(floor == was).all(-1)] = (106, 63, 12)
    a[105, 392:419], a[105, [391, 419]] = G.c("wood", 4), G.INK             # an oval top over an ink underline,
    a[106, 391:420], a[106, [390, 420]] = G.c("wood", 3), G.INK
    a[107, 391:420] = G.INK
    a[108:141, [404, 406]], a[108:141, 405] = G.INK, G.c("wood", 2)        # one pedestal leg and its foot
    a[141, 401:410], a[143, 399:412] = G.INK, G.INK
    a[142, 400:411], a[142, [399, 411]] = G.c("wood", 2), G.INK
    for x in (392, 401):                                                   # two cups, handles out
        a[101, x:x + 6], a[102:105, [x, x + 5]], a[102:105, x + 1:x + 5] = G.INK, G.INK, G.c("cream", 5)
        a[[102, 104], x + 6], a[103, x + 7] = G.INK, G.INK
    a[101, 411:417], a[102:105, [411, 416]] = G.INK, G.INK                 # and the plant's terracotta pot
    a[102:104, 412:416], a[104, 412:416] = G.c("red", 4), G.c("red", 3)
    a[98:101, 413:415] = G.c("plant", 3)
    return Image.fromarray(a, "RGB")


TOUCHUPS["sumup"] = lambda px: cafe(shadows(px, 120))

# --- Floor 5, billie_risk ---
LAMPS["billie_risk"] = [(150, 0, 28, 19), (191, 0, 30, 15), (258, 0, 32, 17), (296, 0, 32, 15), (324, 0, 32, 15)]
GONE["billie_risk"] = [(424, 0, 433, 25), (434, 22, 442, 35)]   # a lamp fused behind the screen's corner

# --- Floor 6, billie_orchestrator ---
LAMPS["billie_orchestrator"] = [(190, 0, 42, 19), (384, 0, 44, 19)]   # down over their painted bulbs
GONE["billie_orchestrator"] = [(219, 0, 251, 29), (316, 0, 346, 29), (369, 0, 373, 26)]   # the two hung in front of
# the screen, and a cord with no lamp
KEEP["billie_orchestrator"] = [(220, 30, 355, 95)]    # the wall screen: its invoice cards are bright
UNLIT["billie_orchestrator"] = [(220, 30, 355, 95)]   # the two lamps hung in front of that screen cast no cone on it


def screen(px):
    """Floor 6: the wall screen's bezel came out lamp-lit brown where the two lamps hang in front of it, and its
    right-hand panel came out as wall colour. Its frame is redrawn from an intact column, its sides as dark steel,
    and the panel as more of the screen's blue, so the invoice crossing it (gen_floors) stays on the screen."""
    a = np.asarray(px).copy()
    x0, x1, intact = 218, 346, (250, 316)                                  # outer ink columns; the unlit stretch of top
    ref = a[29:37, 300].copy()                                             # ink, ink, trim, ink, title bar, ink, lip
    for x in [*range(x0 + 1, intact[0]), *range(intact[1], x1)]:
        a[29:37, x] = ref
    a[29:74, [x0, x1]] = G.INK
    a[29:74, x1 + 1] = a[29:74, x0 - 1]                                   # its soft edge, as on the left
    a[31:72, x0 + 1:x0 + 5] = a[31:72, x1 - 4:x1] = G.c("steel", 1)        # the sides
    a[37:68, x0 + 5] = a[37:68, x1 - 5] = G.c("steel", 3)                  # their inner lip
    panel = a[37:68, intact[1]:x1 - 5]                                     # right of the trays, whose rims are wall-tan
    for col in (WALL, G.c("wall", 5), G.c("plank", 5)):
        panel[(panel == col).all(-1)] = G.c("blue", 5)
    return Image.fromarray(a, "RGB")


GLASS = {G.c("violet", 5), G.c("violet", 4), G.c("wall", 5), G.c("grey", 5), G.c("steel", 4),   # the painted cabinet,
         G.c("cream", 5), G.c("sky", 5), G.c("sky", 4), G.c("coral", 5), CONE}               # its glints and halo


def ghost(px):
    """Floor 6: the stand-in vendor's see-through cabinet. The painted one quantises into a lavender blob with wall
    holes and a pale halo, so it is drawn again: the wall and skirting behind it, then glass as a 50% lavender
    dither, a dashed violet outline and door (there, but not quite), its shelves seen through it."""
    a = np.asarray(px).copy()
    x0, y0, x1, y1 = 386, 48, 434, 139                                     # inclusive
    for y in range(44, 142):                                               # the halo and stray glass around it
        for x in range(377, 439):
            if not (x0 <= x <= x1 and y0 <= y <= y1) and tuple(a[y, x]) in GLASS - {CONE}:
                a[y, x] = WALL
    for y in range(y0, y1 + 1):                                            # behind it: the room as it is to its right
        for x in range(x0, x1 + 1):
            if tuple(a[y, x]) in GLASS:
                a[y, x] = a[y, x1 + 6]
    edge, glass = G.c("violet", 4), G.c("violet", 5)
    for y in range(y0 + 1, y1):
        for x in range(x0 + 1, x1):
            if (x + y) % 2 == 0:
                a[y, x] = glass
    door = x1 - 13
    for y in (y0 + 24, y0 + 48, y0 + 70):                                  # shelves
        a[y, x0 + 1:x1] = edge
    a[y0 + 36:y0 + 41, door - 3] = edge                                    # the handle
    for x in range(x0, x1 + 1):
        if x % 4 < 2:
            a[y0, x] = a[y1, x] = edge
    for y in range(y0, y1 + 1):
        if y % 4 < 2:
            a[y, x0] = a[y, x1] = a[y, door] = edge
    for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1), (door, y0), (door, y1)):
        a[y, x] = edge
    return Image.fromarray(a, "RGB")


TOUCHUPS["billie_orchestrator"] = lambda px: ghost(screen(px))


# --- Floor 7, billie_payments ---
LAMPS["billie_payments"] = [(188, 21, 36, 19, 16), (240, 21, 40, 17, 16), (287, 21, 43, 17, 16), (308, 21, 43, 17, 16),
                            (341, 21, 40, 17, 16), (363, 21, 45, 15, 16), (384, 21, 37, 17, 16),
                            (414, 21, 41, 19, 16)]   # hung from the pipe, close together: short cones
GONE["billie_payments"] = [(160, 21, 179, 42), (424, 21, 440, 44)]   # the second of two fused pairs


def planks(px):
    """Floor 7: the red tray's reflection turned whole planks red; grow the plank colours back over them, from the
    planks inwards, so the tray and the box (outlined in ink) keep theirs."""
    a = np.asarray(px).copy()
    plank = {(160, 100, 15), (106, 63, 12)}
    swap = {(160, 50, 39): (160, 100, 15), (127, 44, 36): (106, 63, 12)}
    for _ in range(40):
        changed = False
        for y in range(128, a.shape[0]):
            for x in range(a.shape[1]):
                col = tuple(a[y, x])
                if col not in swap or (col == (127, 44, 36) and y < 138):   # the skirting is that red too
                    continue
                if any(tuple(a[ny, nx]) in plank for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1))
                       if 0 <= ny < a.shape[0] and 0 <= nx < a.shape[1]):
                    a[y, x] = swap[col]
                    changed = True
        if not changed:
            break
    return Image.fromarray(a, "RGB")


TOUCHUPS["billie_payments"] = planks

# --- Floor 8, writing ---
LAMPS["writing"] = [(252, 0, 34, 19, 3), (292, 0, 34, 19, 3), (320, 0, 34, 17), (366, 0, 31, 17)]   # the board under
# the first two takes no light, and their sweep would wipe its clippings
GONE["writing"] = [(397, 0, 402, 33), (304, 0, 309, 34)]   # a cord with no lamp on it; a painted shade's edge
TOUCHUPS["writing"] = lambda px: shadows(px, 142)   # its bookcase and press stand on maroon feet
KEEP["writing"] = [(236, 0, 392, 34)]   # the pale lamp shades, which read as light


# --- Roof ---
def sky(px):
    """The roof's dusk as an even dither. A cloud streak came out a grey the bands don't have, so it takes the band
    above first; and the painted lobby wall ran on past the lift housing's corner, so sky and deck carry on there."""
    a = np.asarray(px).copy()
    for y in range(40, 47):
        row, grey = a[y, 107:256], (a[y, 107:256] == G.c("sky", 4)).all(-1)
        row[grey] = a[y - 1, 107:256][grey]
    a[:, 109:117] = a[:, 117:125]                                          # the dither repeats every 4
    return dither_bands(Image.fromarray(a, "RGB"), 84, 192)


def mode(row):
    return Counter(map(tuple, row)).most_common(1)[0][0]


def install(name):
    seed, box, colours = PICKS[name]
    crop = Image.open(HERE / "candidates" / f"{name}_{seed}.png").convert("RGB").crop(box)
    crop.save(HERE / "picks" / f"{name}.png")
    if name == "lobby":
        px = lift_doors(pixelate(crop, LOBBY_PX, colours))
    else:
        crop = match_base(crop)
        lobby = Image.open(HERE / "picks" / "lobby-px.png").convert("RGB")
        px = pixelate(crop, FLOOR_PX, colours, keep=sorted({c for _, c in lobby.getcolors()}))
        if name == "roof":
            px = sky(px)
        else:
            px = relight(px, LAMPS.get(name, ()), GONE.get(name, ()), keep=KEEP.get(name, ()), unlit=UNLIT.get(name, ()))
        if name in TOUCHUPS:
            px = TOUCHUPS[name](px)
        side = np.asarray(px)[:, :LIFT[0]].copy()                          # the room's skirting beside the lift
        lift = (0, 0, LIFT[2], LOBBY_PX[1]) if name == "roof" else LIFT   # the roof's lift housing is all lobby, floor too
        px.paste(lobby.crop(lift), lift[:2])
        if name != "roof":                                                 # under the lift, the skirting is the room's
            a, ref = np.asarray(px).copy(), np.asarray(lobby)
            for y in range(134, LIFT[3]):
                run, was = a[y, LIFT[0]:LIFT[2]], mode(ref[y, :LIFT[0]])
                if was != G.INK:                                           # its ink lines run through the door frame
                    run[(run == was).all(-1)] = mode(side[y])
            px = Image.fromarray(a, "RGB")
    px.save(HERE / "picks" / f"{name}-px.png")
    print("installed", name, "seed", seed, crop.size, "->", px.size)


if __name__ == "__main__":
    for name in sys.argv[1:] or PICKS:
        install(name)
