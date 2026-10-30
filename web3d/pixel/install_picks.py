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
import math
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
LAMPS["nice"] = [(193, 0, 32, 17), (254, 0, 32, 15), (291, 0, 32, 15), (322, 0, 32, 15), (364, 0, 32, 15), (395, 0, 32, 15)]
TOUCHUPS["nice"] = lambda px: shadows(px, 142)   # above, the maroon is its skirting and cabinet
KEEP["nice"] = [(366, 28, 402, 80)]   # floor 3's whiteboard, which its lamp's light touches

# --- Floor 4, sumup ---
LAMPS["sumup"] = [(177, 0, 34, 13), (236, 0, 33, 13, 0), (268, 0, 33, 13), (304, 0, 35, 13)]   # the copper one is off
GONE["sumup"] = [(158, 0, 168, 36)]   # the doubled pendant beside the first
TOUCHUPS["sumup"] = lambda px: shadows(px, 120)

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
LAMPS["billie_payments"] = [(188, 21, 36, 19, 16), (240, 21, 40, 17, 0), (287, 21, 43, 17, 16), (308, 21, 43, 17, 16),
                            (341, 21, 40, 17, 16), (363, 21, 45, 15, 16), (384, 21, 37, 17, 16),
                            (414, 21, 41, 19, 16)]   # hung from the pipe, close together: short cones; the one over
# the scanner arch is off
KEEP["billie_payments"] = [(400, 46, 456, 94)]   # the screening board, redrawn below; its lamp's cone stops evenly above it
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


def mailroom(px):
    """Floor 7, after planks: the screening board comes out wall-coloured with garbled tiles, so it is drawn again as
    a dark panel in an ink frame with flat tiles (gen_floors.SCREENING, which flips them). The scanner arch was fused
    with a door frame and a ghost arch: one steel arch now. The post box's envelope read as a "B"; the red tray
    melted into the skirting. The floor is planked again, as on floor 5, across the lobby too."""
    a = np.asarray(px).copy()
    a[46:96, 400:456] = WALL                                               # the board, and painted light beside it
    a[48:92, 412:452] = G.INK
    a[49:91, 413:451] = G.c("steel", 1)
    a[50:90, 414:450] = G.c("dark", 1)
    a[52, 415:431] = G.c("cream", 3)                                       # its title
    for x, y, flagged in G.SCREENING:
        a[y:y + 4, x + 132:x + 139] = G.GLOW["red" if flagged else "green"]
    a[34:98, 206:272] = WALL                                               # the arch: a steel tube, ink either side,
    a[29:40, 231:250] = np.asarray(px)[29:40, 231:250]                     # under the lamp
    cx, cy, r = 238.5, 72, 28.5
    for y in range(41, 98):
        for x in range(206, 272):
            t = math.floor(r + 0.5 - np.hypot(x - cx, y - cy)) if y <= cy else x - 210 if x < cx else 267 - x
            if 0 <= t <= 5:                                                # its depth into the tube, from outside
                a[y, x] = G.INK if t in (0, 5) else G.c("steel", 4 if t < 3 else 3)
    for y in range(118, 142):                                              # the tray: the wall and skirting behind
        for x in range(152, 207):                                          # it first, but not the conveyor's feed
            if not (x >= 193 and y < 128):
                a[y, x] = a[y, 130]
    a[124:142, 156:207] = G.INK
    a[125:128, 157:206] = G.c("red", 1)                                    # inside
    a[128, 157:206] = G.c("red", 5)                                        # the front's lit lip
    a[129:141, 157:206] = G.c("red", 3)
    a[129:141, 203:206] = G.c("red", 2)                                    # its side in shadow
    a[133:136, 175:188] = G.INK                                            # the handle slot
    floor = {G.c("amber", 1), G.c("amber", 2)}
    h, w = a.shape[:2]
    on = lambda y, x: y >= 142 or y >= 128 and x >= 216                    # behind the conveyor it shows from row 128
    for _ in range(2):                                                     # specks and stray shadow strokes go first
        for y in range(128, h):
            for x in range(w):
                if on(y, x) and tuple(a[y, x]) not in floor and sum(
                        tuple(a[ny, nx]) in floor for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1))
                        if 0 <= ny < h and 0 <= nx < w) >= 3:
                    a[y, x] = G.c("amber", 2)
    for y in range(128, h):                                                # then the planks, on the floor between things
        for x in range(w):
            if on(y, x) and tuple(a[y, x]) in floor:
                a[y, x] = G.c("amber", 1 if (x + y + 5 * (y >= 148)) % 11 == 0 else 2)
    a[80:89, 170:181] = G.c("coral", 4)                                    # the post box's envelope: flap down
    a[81:86, 172:179] = G.c("cream", 5)
    for i in range(4):
        a[81 + i, 172 + i] = a[81 + i, 178 - i] = G.INK
    return Image.fromarray(a, "RGB")


TOUCHUPS["billie_payments"] = lambda px: mailroom(planks(px))

# --- Floor 8, writing ---
LAMPS["writing"] = [(252, 0, 34, 19, 3), (292, 0, 34, 19, 3), (320, 0, 34, 17, 3), (366, 0, 31, 17)]   # the board under
# the first two takes no light, and their sweep would wipe its clippings
GONE["writing"] = [(397, 0, 402, 33), (304, 0, 309, 34)]   # a cord with no lamp on it; a painted shade's edge
KEEP["writing"] = [(236, 0, 392, 34), (224, 38, 321, 80), (296, 78, 331, 100), (140, 17, 191, 140),
                   (334, 26, 402, 135)]   # the pale lamp shades, which read as light; the corkboard and its
# clippings, the typewriter's sheet, the two bookcases


def paper(a, y, bundles, skip=(0, 0, 0, 0)):
    """A stack of tied bundles of paper standing on row y, listed from the bottom as (x0, x1, rows), each sharing its
    outline row with the one below: an ink outline, a page line every second row, the right side in shadow, the
    twine down the middle. Pixels in `skip` (a box, half-open) are left alone: something standing in front."""
    for x0, x1, rows in bundles:
        for yy in range(y - rows + 1, y + 1):
            for x in range(x0, x1 + 1):
                if skip[0] <= x < skip[2] and skip[1] <= yy < skip[3]:
                    continue
                if x in (x0, x1) or yy in (y - rows + 1, y):
                    a[yy, x] = G.INK
                elif x == (x0 + x1) // 2:
                    a[yy, x] = G.c("wood", 3)
                else:
                    a[yy, x] = G.c("cream", 2 if x >= x1 - 2 else 3 if (y - yy) % 2 else 5)
        y -= rows - 1


def newsroom(px):
    """Floor 8: the paper stacks pixelate into black and white static, so they are drawn again as stacks of pages.
    The cork's lamp-lit band and painted light go back to cork, as does the light pillar beside the typewriter. The
    desk lamp's painted glow is a blob, so it gets a small cone of its own onto the press. The press's shadow is
    a maroon wedge over the skirting, which runs on straight under it; the seam's skirting carries the room's band
    on to the bookcase, and the halo on the bookcase's cornice goes."""
    a = np.asarray(px).copy()
    wall = np.array(WALL)
    cork = a[41:78, 227:318]
    for col in (G.c("amber", 3), CONE, WALL):
        cork[(cork == col).all(-1)] = G.c("amber", 2)
    a[80:100, 225:265] = WALL                                              # the desk's two stacks
    paper(a, 99, [(225, 243, 7), (226, 242, 6), (225, 242, 6)])
    paper(a, 99, [(244, 264, 8), (245, 263, 7), (244, 262, 7)])
    for y in range(108, 142):                                              # the floor stack, behind the bin
        for x in range(190, 222):
            if y >= 112 and not (193 <= x < 203 and y >= 133) or tuple(a[y, x]) == G.c("plank", 5):
                a[y, x] = WALL
    paper(a, 141, [(191, 220, 9), (192, 219, 8), (191, 218, 8), (193, 219, 7)], skip=(193, 133, 203, 142))
    for x0, y0, x1, y1 in ((190, 17, 192, 112), (400, 26, 403, 92), (132, 14, 162, 25)):   # pale halos by the
        halo = a[y0:y1, x0:x1]                                                             # bookcases
        for col in (G.c("plank", 4), G.c("plank", 5)):
            halo[(halo == col).all(-1)] = WALL
    side = a[77:100, 282:334]
    side[(side == CONE).all(-1)] = WALL                                    # the light pillar around the typewriter
    glow = a[79:98, 400:440]
    glow[(glow == CONE).all(-1)] = WALL
    for r in range(12):                                                    # the desk lamp's cone, down to the paper
        y = 80 + r
        for x in range(410 - r * 2 // 3, 421 + r // 3):
            if (a[y, x] == wall).all() and (r < 5 or (r < 9 and (x + y) % 2 == 0) or (x % 2 == 0 and y % 2 == 0)):
                a[y, x] = CONE
    a[133:135, 442:464] = WALL                                             # the skirting behind the press
    a[135:143, 442:464] = a[135:143, 460:461]
    a[134:142, 122:140] = a[134:142, 112:113]                              # the seam's skirting
    return Image.fromarray(a, "RGB")


TOUCHUPS["writing"] = lambda px: newsroom(shadows(px, 142))   # its bookcase and press stand on maroon feet


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
