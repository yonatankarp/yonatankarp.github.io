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
TOOLS = {  # the pegboard's tools, 1px silhouettes: steel '#', handle 'o'
    "wrench": ["#.#", "###", ".#.", ".#.", ".#.", ".#.", ".#.", ".#.", "###", "#.#"],
    "driver": ["ooo", "ooo", "ooo", ".o.", ".#.", ".#.", ".#.", ".#.", ".#."],
    "hammer": ["#####", "#####", "..o..", "..o..", "..o..", "..o..", "..o..", "..o..", "..o.."],
    "pliers": ["#.#", "#.#", ".#.", ".#.", "o.o", "o.o", "o.o", "o.o"],
}
PEGBOARD = [("wrench", 310), ("driver", 315), ("hammer", 320), ("pliers", 327), ("driver", 332), ("wrench", 336)]


def garage(px):
    """Parking: the far lamp's light is a painted slab, so it is cut down to the lamp's cone; the ceiling's navy
    blotches and the tent of shadow on the beam go flat; the pegboard tools and the bench's tablet, which pixelate
    into smears, are drawn again; and the exit's blown-out daylight becomes a dusk sky with a street lamp."""
    a = np.asarray(px).copy()
    ceiling, beam, steel = (58, 53, 48), (106, 111, 118), G.c("steel", 2)
    box = a[0:20, 360:410]
    box[(box == (48, 54, 62)).all(-1)] = ceiling                           # navy on the ceiling (the ramp's is kept)
    a[18:23, 383:385][(a[18:23, 383:385] == G.INK).all(-1)] = ceiling      # a painted cord beside the stamped one
    tent = a[23:29, 239:268]
    tent[(tent == (93, 86, 77)).all(-1) | (tent == ceiling).all(-1) | (tent == G.INK).all(-1)] = beam
    a[8:60, 352], a[8:60, 353] = G.c("steel", 4), beam                     # the near pillar's edge, one clean line
    x0, x1, y0 = 383, 391, 46                                               # the far lamp's mouth, as relight has it
    for y in range(y0, 92):
        for x in range(374, 389):
            if tuple(a[y, x]) == CONE:
                r, fade = y - y0, (y - y0) / 30
                lit = r >= 2 * max(0, x0 - x, x - x1) and (fade < 0.55 or (fade < 0.8 and (x + y) % 2 == 0)
                                                           or (x % 2 == 0 and y % 2 == 0 and fade < 1))
                a[y, x] = CONE if lit else WALL
    for y in range(62, 78):                                                # the pegboard, past the lantern and the
        for x in range(308, 349):                                          # scooter's mirror
            if not (x >= 339 and y >= 66 or 321 <= x <= 334 and y >= 73):
                a[y, x] = (93, 86, 77) if (x - 308) % 3 == 1 and (y - 62) % 3 == 1 else (173, 163, 149)
    for name, x in PEGBOARD:
        sprite(a, x, 63, [r.replace("o", ".") for r in TOOLS[name]], steel)
        sprite(a, x, 63, [r.replace("#", ".").replace("o", "#") for r in TOOLS[name]], G.c("amber", 3))
    a[84:90, 156:159], a[84:90, 159], a[84:90, 160:162] = CONE, WALL, G.INK   # the lit wall carries on down
    a[90:92, 156:177], a[93, 156:177] = (191, 165, 140), (138, 100, 70)    # the bench: its top and apron, edged
    a[92, 156:177] = a[94, 156:177] = G.INK
    sprite(a, 156, 86, ["#####", "#...#", "#...#", "#####"], G.c("steel", 2))   # the tablet, propped at its end
    a[87:89, 157:160] = G.c("magenta", 4)
    sky, todo = G.R["sky"], [(60, 450)]                                     # the exit, from inside its opening
    while todo:
        y, x = todo.pop()
        if not (0 <= y < a.shape[0] and 0 <= x < a.shape[1]) or tuple(a[y, x]) != (242, 236, 224):
            continue
        level = 1 + 3 * min(1, max(0, (y - 20) / 72))                     # dusk, lighter down to the street
        a[y, x] = sky[int(level) + (level % 1 > BAYER[y % 4, x % 4])]
        if y >= 96:
            a[y, x] = G.c("steel", 1) if y > 96 else G.c("steel", 3)       # the street at the top of the ramp
        todo += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    a[66:96, 452] = G.INK                                                  # a street lamp
    a[65, 449:453] = G.INK
    a[66, 449:451] = G.c("amber", 5)
    return Image.fromarray(a, "RGB")


TOUCHUPS["parking"] = garage

# --- Lobby, reception ---
LAMPS["reception"] = [(161, 0, 31, 19), (189, 0, 30, 11), (226, 0, 30, 11), (258, 0, 30, 11), (292, 0, 31, 19)]
PLAQUES = [(160, 34, 194, 76), (200, 33, 247, 76), (253, 35, 284, 76)]   # the three recommendations, inclusive
DOOR_GLASS = {(35, 42, 77), (93, 90, 134), (74, 82, 92), (48, 54, 62)}
STREET_WINDOWS = [(411, 13, 416, 19, 1), (421, 13, 426, 19, 0), (441, 13, 446, 19, 0), (451, 13, 456, 19, 1),
                  (441, 40, 446, 46, 1), (451, 40, 456, 46, 0), (441, 62, 446, 68, 0), (451, 62, 456, 68, 0)]
# x0, y0, x1, y1, lit: three floors of the facade across the street, the lower two behind the plant on the left


def foyer(px):
    """The lobby: the recommendations pixelate into cream with smudges, so each is drawn again (ink-edged frame, a
    header bar, lines of text, a signature) with the lamps' light stopping short of it; and the street through the
    glass door, which came out as purple blocks and black dashes, is drawn as a dusk street: a facade with lit
    windows over a pavement and a road, behind the door's brass and the plant."""
    a = np.asarray(px).copy()
    for x0, y0, x1, y1 in PLAQUES:
        around = a[y0 - 2:y1 + 1, x0 - 1:x1 + 2]
        around[(around == CONE).all(-1)] = WALL
        for i, col in enumerate((G.INK, G.c("wood", 2), G.c("wood", 2), G.INK)):
            a[y0 + i:y1 + 1 - i, x0 + i:x1 + 1 - i] = col
        x0, y0, x1, y1 = x0 + 4, y0 + 4, x1 - 4, y1 - 4                    # the paper
        a[y0:y1 + 1, x0:x1 + 1] = G.c("cream", 5)
        a[y0 + 3:y0 + 5, x0 + 3:x1 - 2] = G.c("wood", 3)                   # the header
        for k, y in enumerate(range(y0 + 9, y0 + 25, 4)):
            a[y, x0 + 3:x1 - 2 - (x1 - x0) // 3 * (k == 3)] = G.INK
        a[y1 - 4, x1 - 9:x1 - 3] = G.INK                                    # the signature, and its seal
        a[y1 - 5:y1 - 3, x1 - 3:x1 - 1] = G.c("red", 3)
    for x, _, y, _ in LAMPS["reception"][1:4]:                             # the three hung over the plaques: a short
        top = next(y0 for x0, y0, x1, _ in PLAQUES if x0 <= x <= x1)       # pool of light, two rows short of the frame
        a[y:top, x - 9:x + 10] = WALL
        a[y:top - 2, x - 4:x + 5] = CONE
    glass = np.array([[tuple(col) in DOOR_GLASS for col in row] for row in a])
    ink = (a == G.INK).all(-1)
    for y in range(1, 142):                                                # the dashes: ink that only touches glass
        for x in [*range(409, 428), *range(438, 458)]:
            near = a[y - 1:y + 2, x - 1:x + 2].reshape(-1, 3)
            if ink[y, x] and glass[y - 1:y + 2, x - 1:x + 2].any() and all(
                    tuple(n) in DOOR_GLASS or tuple(n) == G.INK for n in near):
                glass[y, x] = True
    for y in range(142):
        for x in range(404, 464):
            if glass[y, x]:
                a[y, x] = G.c("sky", 2) if y < 12 else G.c("sky", 1) if y < 96 else G.c("steel", 2 if y < 99 else 1)
    for x0, y0, x1, y1, lit in STREET_WINDOWS:
        win = a[y0:y1, x0:x1]
        win[glass[y0:y1, x0:x1]] = G.c("amber", 4) if lit else G.c("sky", 2)
    return Image.fromarray(a, "RGB")


TOUCHUPS["reception"] = foyer

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


SPINES = [(154, 27, "plant"), (157, 29, "blue"), (160, 26, "red"), (163, 28, "amber"), (166, 30, "steel")]   # x, top


def certificate(a, x0, y0, x1, y1):
    """A framed certificate (inclusive box): ink frame, a wood moulding, cream paper with a title, two lines of
    text and a red seal, and its shadow on the wall."""
    a[y0 + 1:y1 + 2, x0 + 1:x1 + 2] = (172, 129, 89)
    a[y0:y1 + 1, x0:x1 + 1] = G.INK
    a[y0 + 1:y1, x0 + 1:x1] = G.c("wood", 3)
    a[y0 + 2:y1 - 1, x0 + 2:x1 - 1] = G.c("cream", 4)
    a[y0 + 4, x0 + 5:x1 - 4] = G.INK
    a[y0 + 7, x0 + 4:x1 - 3] = a[y0 + 9, x0 + 4:x1 - 6] = G.c("cream", 2)
    a[y1 - 4:y1 - 2, x1 - 5:x1 - 3] = G.c("red", 3)


def lecture(px):
    """Floor 1, beside the board: the bookcase's top-right corner (lost under a lamp's light) and the books standing
    on it, which melt into speckle, and the two certificates (one bleached to plaster, one a scribble) drawn again;
    the cord left of them, which holds no lamp, taken down."""
    a = np.asarray(px).copy()
    col = a[:49, 400]
    col[(col == G.INK).all(-1)] = WALL
    a[22:38, 150:184] = WALL
    for x, top, ramp in SPINES:                                            # books standing on the case
        a[top:38, x - 1:x + 3] = G.INK
        a[top + 1:38, x:x + 2] = G.c(ramp, 3)
    for y0, x0, x1, ramp in ((31, 172, 183, "plant"), (34, 171, 182, "cream")):   # and a stack lying on it
        a[y0:y0 + 4, x0:x1 + 1] = G.INK
        a[y0 + 1:y0 + 3, x0 + 1:x1] = G.c(ramp, 4)
    a[38:42, 145:190] = G.INK                                              # the case's top, out to its right edge
    a[39:41, 146:189] = G.c("wood", 3)
    a[42:46, 182:190] = a[46, 182:190]
    a[38:100, 189] = G.INK
    a[29:48, 402:428] = a[26:45, 428:457] = WALL                           # clear of the shelf below
    certificate(a, 404, 31, 424, 46)
    certificate(a, 431, 28, 451, 43)
    return Image.fromarray(a, "RGB")


TOUCHUPS["reichman"] = lambda px: lecture(chalk(px))

# --- Floor 2, inuitive ---
LAMPS["inuitive"] = [(159, 0, 30, 19, 16), (192, 0, 30, 19, 16), (258, 0, 30, 19), (323, 0, 30, 19), (369, 0, 30, 19),
                     (430, 0, 30, 19)]   # the first two hang close: short cones, or they merge
CHECKER = (376, 30, 434, 80)   # the calibration board, under the two lamps' shades
KEEP["inuitive"] = [CHECKER]
CAMERA = ["    ######        ",   # seen from behind, aimed at the board: its screen shows it
          "    #4444#        ",
          "##################",
          "#4444444444444444#",
          "#3########3333333#",
          "#3#w.w.w.#3333##3#",
          "#3#.w.w.w#3333##3#",
          "#3########3333333#",
          "#2222222222222222#",
          "##################",
          "       ####       ",
          "       #33#       ",
          "       ####       "]
DRONE = ["444   444", " #bbbbb# ", "  #   #  "]   # its rotors a grey blur on the dark mat
CARD, CARD_SIDE = (160, 100, 15), (106, 63, 12)   # the other boxes' cardboard


def lab(px):
    """Floor 2: the calibration checkerboard comes out irregular, half bleached to plaster, so it is drawn again with
    a clean grid, and the camera on its tripod faces it. The scope's waveform, the drone on the mat and the tools on
    the bench came out as speckle and are drawn again; the boxes' faces, the desk front and the wall under the bench
    are flattened, and the drone rotor on the robot's shoulder and the jog in the skirting behind it painted out."""
    a = np.asarray(px).copy()
    a[25:30, 379:421] = a[80:84, 376:437] = WALL                           # the old board's edges, between the shades
    x0, y0, x1, y1 = CHECKER
    a[y0:y1, x0:x1] = G.INK
    a[y0 + 1:y1 - 1, x0 + 1:x1 - 1] = G.c("cream", 5)
    for j in range(7):
        for i in range(0, 8, 2):
            x = x0 + 5 + 6 * (i + j % 2)
            a[y0 + 4 + 6 * j:y0 + 10 + 6 * j, x:x + 6] = G.INK
    ink = {"#": G.INK, "2": G.c("steel", 1), "3": G.c("steel", 2), "4": G.c("steel", 3), "w": G.c("cream", 5),
           ".": G.c("dark", 1), "b": G.c("blue", 4)}
    for rows, x, y in ((CAMERA, 415, 71), (DRONE, 261, 85)):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != " ":
                    a[y + dy, x + dx] = ink[ch]
    clip = a[84:88, 148:156].copy()                                        # the scope: a waveform and its chips
    a[65:87, 139:178] = G.c("plant", 2)
    a[84:88, 148:156] = clip
    for x in range(149, 166):
        a[69 + abs((x - 149) % 8 - 4), x] = G.GLOW["green"]
    a[67:72, 141:146] = a[75:82, 141:145] = a[66:74, 168:175] = G.INK
    a[92:97, 136:211] = G.c("plant", 5)                                    # the bench: tools with red handles
    for x, y, handle in ((140, 93, 4), (157, 95, 4), (176, 92, 0), (192, 94, 0)):
        a[y, x:x + 6] = G.INK
        a[y, x + handle:x + handle + 2] = G.c("red", 4)
    under = a[105:123, 141:216]                                            # the wall under it, in one shadow
    for col in ((138, 100, 70), (172, 129, 89)):
        under[(under == col).all(-1)] = (158, 116, 65)
    box = a[112:139, 190:215]                                              # and the box under it, with its tape
    for col in ((158, 116, 65), WALL, (122, 85, 48)):
        box[(box == col).all(-1)] = CARD
    a[112:139, 201:203] = G.c("cream", 3)
    for bx0, by0, bx1, by1, col in ((373, 108, 386, 130, CARD), (387, 108, 397, 132, CARD), (407, 106, 437, 150, CARD)):
        face = a[by0:by1, bx0:bx1]                                         # the boxes by the camera
        face[(face == WALL).all(-1)] = col
    front = a[96:123, 234:312]                                             # the desk front, in one tone
    for col in ((158, 116, 65), (138, 100, 70)):
        front[(front == col).all(-1)] = (172, 129, 89)
    a[96, 234:312] = (106, 75, 53)
    a[85:91, 338:361] = WALL                                               # the rotor off the robot's shoulder
    a[80:84, 326:330] = G.c("steel", 3)                                    # its lens, a ring
    a[81:83, 327:329] = G.c("blue", 2)
    a[119:123, 355:372] = WALL                                             # the skirting runs on behind it
    a[123, 355:372], a[124, 355:372] = (106, 75, 53), G.INK
    return Image.fromarray(a, "RGB")


TOUCHUPS["inuitive"] = lambda px: lab(shadows(px, 120))

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
            if col == G.c("coral", 5):                                       # a quarter lit near the core,
                a[y, x] = G.c("violet", 5) if x % 2 == 0 and y % 2 == 0 else WALL
            elif col in (G.c("sky", 5), G.c("sky", 4), G.c("wall", 3), G.c("wall", 4)):   # an eighth further out
                a[y, x] = G.c("violet", 5) if (x + y // 2 * 2) % 4 == 0 and y % 2 == 0 else WALL
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
