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
CORAL, CYAN = G.R["coral"], G.R["cyan"]


def risk(px):
    """Floor 5: the pipe hung on two rods and run on into the graph's frame, its glow smear gone; the graph's one
    flagged node left red; the console's warning lamp and side panel; the desk drawn again, with a keyboard."""
    a = np.asarray(px).copy()
    smear = a[50:75, 130:320]
    smear[(smear == G.c("mint", 5)).all(-1)] = WALL                     # the pipe's glow, above and below it
    a[67, 134], a[67, 135:145], a[68, 145] = WALL, G.INK, WALL          # the end cap's bottom edge
    a[55:58, 308:354][(a[55:58, 308:354] == CONE).all(-1)] = WALL       # the light stops short of the pipe, as elsewhere
    a[58:69, 308:354] = a[58:69, 242:243]                               # the pipe runs on into the graph's frame
    for x in (224, 346):                                                # hung from the ceiling on two rods, clamped
        a[0:58, x], a[0:58, x + 1] = G.INK, G.c("steel", 3)
        a[58:69, x - 1:x + 3] = G.INK
        a[59:68, x:x + 2] = G.c("steel", 4)
    screen = a[30:83, 354:438]                                          # the graph: only the flagged node stays red
    red = {CORAL[i]: i for i in (1, 2, 4, 5)}
    nodes = G.blobs(lambda x, y: tuple(screen[y, x]), (0, 0, 84, 53), lambda col: col in red)
    for node in nodes[1:]:
        for x, y in node:
            screen[y, x] = CYAN[red[tuple(screen[y, x])]]
    around = lambda y, x, r: {tuple(screen[j, i]) for j in range(max(0, y - r), y + r + 1)
                              for i in range(max(0, x - r), x + r + 1)}
    glass, lit = {*CYAN, *CORAL, G.INK}, {*CYAN[3:], *CORAL}
    edges = [(y, x) for y in range(2, 51) for x in range(2, 76) if tuple(screen[y, x]) == G.INK
             and not around(y, x, 1) & lit and around(y, x, 2) <= glass]   # inside the frame, clear of the nodes
    for y, x in edges:                                                  # its edges, a step lighter than ink
        screen[y, x] = CYAN[2]
    for pot in (a[120:147, 314:322], a[120:148, 432:445]):              # the pots' cyan glints
        for i in (1, 3, 4, 5):
            pot[(pot == CYAN[i]).all(-1)] = G.c("cream", 1)
    a[83:87, 169:174] = G.INK                                           # the console's warning lamp, rimmed in ink
    a[84:86, 170:173] = CORAL[4]
    a[84, 170] = CORAL[5]
    side = a[87:143, 178:190]                                           # its side panel, one flat tone
    for col in (G.c("wood", 1), G.c("plank", 0)):
        side[(side == col).all(-1)] = G.c("cream", 0)
    sliver = a[116:135, 334:341]
    sliver[(sliver == CONE).all(-1)] = WALL
    a[106:114, 338:436] = G.INK                                         # the desk: an even grey top, lit along its back
    a[107, 339:435] = G.c("steel", 5)
    a[108:112, 339:435] = G.c("steel", 4)
    a[112, 339:435] = G.c("steel", 3)
    a[108:112, 364:384] = G.INK                                         # a keyboard
    for y in (109, 110):
        for x in range(365, 383):
            a[y, x] = G.c("steel", 4 if (x + y) % 2 else 2)
    for x0, x1, front, side_col in ((339, 369, 10, G.c("grey", 2)), (404, 435, 9, G.c("grey", 3))):   # level pedestals
        a[114:149, x0:x1 + 1] = G.INK
        a[114:148, x0 + 1:x0 + front] = G.c("steel", 5)
        a[114:148, x0 + front] = G.c("steel", 4)
        a[114:148, x0 + front + 2:x1] = side_col
    a[149, 404:436] = a[149, 370:402]                                   # the floor under the right one's old foot
    return Image.fromarray(a, "RGB")


TOUCHUPS["billie_risk"] = risk

# --- Floor 6, billie_orchestrator ---
LAMPS["billie_orchestrator"] = [(190, 0, 42, 19), (384, 0, 44, 19)]   # down over their painted bulbs
GONE["billie_orchestrator"] = [(219, 0, 251, 29), (316, 0, 346, 29), (369, 0, 373, 26), (174, 0, 177, 75)]   # the two
# hung in front of the screen, a cord with no lamp, and one run down into the terminal
KEEP["billie_orchestrator"] = [(220, 30, 355, 95)]    # the wall screen: its invoice cards are bright


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
    for box, col, to in (((33, 35, x0, x1), (G.c("red", 2), G.c("coral", 1)), G.c("steel", 0)),   # a red dash on the
                         ((68, 69, x0, x1), (G.c("coral", 1),), G.c("magenta", 1)),               # title bar and bezel
                         ((58, 60, x0, x1), (WALL,), G.c("amber", 4))):                           # the trays' rims
        part = a[box[0]:box[1], box[2]:box[3]]
        for c in col:
            part[(part == c).all(-1)] = to
    return Image.fromarray(a, "RGB")


GLASS = {G.c("violet", 5), G.c("violet", 4), G.c("wall", 5), G.c("grey", 5), G.c("steel", 4),   # the painted cabinet,
         G.c("cream", 5), G.c("cream", 4), G.c("sky", 5), G.c("sky", 4), G.c("coral", 5), CONE}   # its glints, halo


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


def glow(px):
    """Floor 6: the core's glow on the wall came out salmon, and its pool on the floor ends in a hard edge. The wall
    glow becomes a two-step violet dither, the pool's edge dithers into the planks, and the terminal beside the core
    gets back its lit screen, bezel and buttons."""
    a = np.asarray(px).copy()
    for y in range(72, 119):                                               # the wall glow behind the core
        for x in range(220, 355):
            col = tuple(a[y, x])
            if col == G.c("coral", 5):
                a[y, x] = G.c("violet", 5) if (x + y) % 2 == 0 else WALL
            elif col in (G.c("sky", 5), G.c("sky", 4), G.c("wall", 3), G.c("wall", 4)):
                a[y, x] = G.c("violet", 5) if x % 2 == 0 and y % 2 == 0 else WALL
    pool = {G.c("magenta", 1), G.c("magenta", 2)}                         # its dark floor, not the lit cables
    was = a.copy()
    for y in range(129, a.shape[0]):                                       # the pool's edge, two pixels deep
        for x in range(197, 365):
            if tuple(was[y, x]) not in pool or (x + y) % 2:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2)):
                ny, nx = y + dy, x + dx
                if ny < a.shape[0] and tuple(was[ny, nx]) not in {*G.R["magenta"], G.INK, *G.R["violet"]}:
                    a[y, x] = was[ny, nx]
                    break
    halo = a[72:132, 147:157]                                              # the terminal: its tan halo goes
    for col in (G.c("plank", 5), G.c("plank", 4), G.c("plank", 3)):
        halo[(halo == col).all(-1)] = WALL
    a[75:93, 156:182] = G.INK                                              # its screen, in a violet bezel
    a[76:92, 157:181] = G.c("violet", 2)
    for y in range(77, 91):
        a[y, 158:180] = G.c("blue", 3 if y % 2 else 2)
    for y, n in ((79, 12), (81, 8), (83, 14), (85, 6)):                    # a few lines of text
        a[y, 160:160 + n] = G.c("cyan", 4)
    a[87, 160:162] = G.c("cyan", 5)                                        # the cursor
    for x, col in ((160, G.c("cyan", 4)), (162, G.c("amber", 4)), (164, G.c("red", 4))):
        a[97, x] = col                                                     # and its buttons
    return Image.fromarray(a, "RGB")


TOUCHUPS["billie_orchestrator"] = lambda px: glow(ghost(screen(px)))


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
