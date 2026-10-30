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


def lamps(lum, x_min):
    """Hanging lamps: follow each cord down from the ceiling to the bottom of its shade. Returns the mouths
    (y, x0, x1): the row just under the shade and its span."""
    h, w = lum.shape
    dark = lum < 110
    out = []
    for x in range(x_min + 1, w - 1):
        if not (dark[0, x] and dark[1, x]) or dark[0, x - 1]:
            continue
        cx, y = x, 0
        while y < 70:
            step = next((d for d in (0, -1, 1) if 0 <= cx + d < w and dark[y, cx + d]), None)
            if step is None:
                break
            cx, y = cx + step, y + 1
        row = dark[y - 1]
        x0 = x1 = cx
        while x0 > 0 and row[x0 - 1]:
            x0 -= 1
        while x1 < w - 1 and row[x1 + 1]:
            x1 += 1
        if 4 <= x1 - x0 + 1 <= 24 and y > 8:                               # a shade, not a hung screen or a shelf
            out.append((y, x0, x1))
    return out


def relight(px, x_min=110, y_max=124, length=30, keep=(), unlit=()):
    """Redraw the rooms' lamp light in the lobby lamp's style. The painted light pools quantise into ragged blobs
    and, after the colour match, sometimes into pale grey; so every bright patch in a lamp's sweep that is not
    outlined like an object (a plaque, a screen) is erased to plaster, and each lamp gets a cone like the lobby's:
    solid lamp yellow, widening a pixel every second row, fading out in a dither, drawn only over bare wall
    so furniture stays in front of it. A lamp whose cone would reach an `unlit` box (a wall screen) gets none."""
    a = np.asarray(px, dtype=np.int32).copy()
    lum = a @ np.array([299, 587, 114]) // 1000
    h, w = lum.shape
    mouths = lamps(lum, x_min)
    sweep = np.zeros((h, w), dtype=bool)
    for y0, x0, x1 in mouths:
        for r in range(length):
            if y0 + r < y_max:
                sweep[y0 + r, max(0, x0 - 4 - r * 2 // 3):min(w, x1 + 5 + r * 2 // 3)] = True
    bright = (lum > 160) & (a[..., 0] >= a[..., 2])
    for x0, y0, x1, y1 in keep:                                            # things the light pass must not touch
        bright[y0:y1, x0:x1] = False
    seen = np.zeros_like(bright)
    for y in range(y_max):
        for x in range(x_min, w):
            if not bright[y, x] or seen[y, x]:
                continue
            comp, todo = [], [(y, x)]
            seen[y, x] = True
            while todo:                                                    # the patch, 4-connected
                cy, cx = todo.pop()
                comp.append((cy, cx))
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < y_max and x_min <= nx < w and bright[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        todo.append((ny, nx))
            inside = set(comp)
            edge = [(ny, nx) for cy, cx in comp for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1))
                    if (ny, nx) not in inside and 0 <= ny < h and 0 <= nx < w]
            if not any(sweep[p] for p in comp):                            # stray light: a lamp-yellow patch on bare wall
                if not (all(tuple(a[p]) == CONE for p in comp) and sum(tuple(a[p]) == WALL for p in edge) > 0.7 * len(edge)):
                    continue
            ys, xs = zip(*comp)
            if len(comp) > 0.88 * (max(ys) - min(ys) + 1) * (max(xs) - min(xs) + 1):
                continue                                                   # a filled rectangle: a whiteboard, a plaque
            if sum(lum[p] < 110 for p in edge) > 0.6 * len(edge):            # framed all round: a plaque, a screen
                continue
            for p in comp:
                a[p] = WALL
    for y0, x0, x1 in mouths:
        reach = (length - 1) // 2
        if any(x0 - reach < bx1 and x1 + reach >= bx0 and y0 < by1 and y0 + length > by0 for bx0, by0, bx1, by1 in unlit):
            continue
        for r in range(length):
            yy = y0 + r
            if yy >= y_max:
                break
            spread = r // 2
            for xx in range(max(0, x0 - spread), min(w, x1 + spread + 1)):
                if tuple(a[yy, xx]) != WALL:
                    continue
                fade = r / length
                if fade < 0.55 or (fade < 0.8 and (xx + yy) % 2 == 0) or (xx % 2 == 0 and yy % 2 == 0):
                    a[yy, xx] = CONE
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


KEEP = {}       # name: boxes the light pass must not touch
UNLIT = {}      # name: boxes no lamp may cast a cone on
TOUCHUPS = {}   # name: the floor's own fix-up, run after the light pass


# --- Parking ---

# --- Lobby, reception ---

# --- Floor 1, reichman ---
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

# --- Floor 3, nice ---
KEEP["nice"] = [(366, 28, 402, 80)]   # floor 3's whiteboard, which its lamp's light touches

# --- Floor 4, sumup ---

# --- Floor 5, billie_risk ---

# --- Floor 6, billie_orchestrator ---
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
KEEP["writing"] = [(236, 0, 392, 34)]   # the pale lamp shades, which read as light

# --- Roof ---


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
            px = dither_bands(px, 84, 192)                                 # sky
        else:
            px = relight(px, keep=KEEP.get(name, ()), unlit=UNLIT.get(name, ()))   # lamps
        if name in TOUCHUPS:
            px = TOUCHUPS[name](px)
        lift = (0, 0, *LIFT[2:]) if name == "roof" else LIFT              # the roof's lift housing is all lobby plaster
        px.paste(lobby.crop(lift), lift[:2])
    px.save(HERE / "picks" / f"{name}-px.png")
    print("installed", name, "seed", seed, crop.size, "->", px.size)


if __name__ == "__main__":
    for name in sys.argv[1:] or PICKS:
        install(name)
