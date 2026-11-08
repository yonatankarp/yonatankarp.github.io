# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Install the picked paintings: bake each to the art standard (the city's: box-reduced, a median cut to 64 colours, no
dither, no palette), with the one lift pasted in.

Run: uv run web3d/pixel/install_picks.py [--out DIR] [NAME ...]   # DIR defaults to paintings/picks (CI: a scratch folder)

PICKS names every painting's candidate (paint_rooms.py; floors 1 and 3 mended by its `wall`). A floor's painting is
the lobby carried on into its room, so its lift is already where the lobby's is; the lobby's own lift (its frame and
doors, and the floor display over them) is pasted over it all the same, so the doors pixel.js slides are one pair on
every floor. Writes <name>-px.png: 928 x 308, the lobby 264 x 308. The lobby is installed first, and the roof's night
before its winter night, as PICKS lists them: the others read them from DIR.
"""
import argparse
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_common import CANDIDATES, PICKS as PICKED, patched  # noqa: E402

LOBBY = ("lobby_1017.png", (7, 7, 684, 761))   # the picked lobby candidate (PICKS["lobby"]) and its crop
LOBBY_PX, FLOOR_PX, CAB_PX, COLOURS = (264, 308), (928, 308), (96, 168), 64   # the cab: gen_floors.DOOR's size
LIFT = (76, 100, 194, 284)   # the lift's frame and doors in the lobby's pixels, down to its sill
SIGN = (117, 79, 152, 96)    # the floor display over them, which gen_floors lights with the floor's number
PANEL, WALL = (196, 146, 218, 199), (219, 231)   # the lift's call panel with its shadow, and the bare wall right of it
PICKS = {  # name: its candidate. The roof's other hours are the dusk pick edited (paint_rooms retime), and each hour's
           # winter is that hour's pick edited (paint_rooms winter); the reception's are crops round its door (DOOR)
    "lobby": "lobby_1017.png",
    "cab": "cab_1000.png",   # the lift's cab, behind its doors as they open (gen_floors)
    "reichman": "reichman_1168-wall.png",
    "inuitive": "inuitive_1134.png",
    "nice": "nice_1270-wall.png",
    "sumup": "sumup_1117.png",
    "billie_risk": "billie_risk_1100.png",
    "billie_orchestrator": "billie_orchestrator_1117.png",
    "billie_payments": "billie_payments_1134.png",
    "reception": "reception_1117.png",
    "reception-dawn": "reception-door-dawn.png",
    "reception-day": "reception-door-day.png",
    "reception-night": "reception-door-night.png",
    "roof": "roof_1100.png",
    "roof-dawn": "roof_1100-dawn_1000.png",
    "roof-day": "roof_1100-day_1000.png",
    "roof-night": "roof_1100-night_1017.png",
    "reception-winter": "reception-door-winter.png",
    "reception-winter-dawn": "reception-door-winter-dawn.png",
    "reception-winter-day": "reception-door-winter-day.png",
    "reception-winter-night": "reception-door-winter-night.png",
    "roof-winter": "roof_1100-winter_717.png",
    "roof-winter-dawn": "roof_1100-dawn_1000-winter_700.png",
    "roof-winter-day": "roof_1100-day_1000-winter_700.png",
    "roof-winter-night": "roof_1100-night_1017-winter_700.png",   # painted before WINTER_NIGHT asked to keep the housing dry
}
# Lettering the model painted though asked not to, in painting pixels, taken from a picture of the same room that has
# none: the reception's three recommendations, from its dawn, which the model painted blank.
BLANK = {"reception": ("reception_1117-dawn_1000.png", [(766, 172, 918, 368), (964, 172, 1118, 368), (1162, 172, 1316, 368)])}


def blank(img, src, boxes):
    clean = Image.open(CANDIDATES / src).convert("RGB")
    for box in boxes:
        img.paste(clean.crop(box), box[:2])
    return img


# The lobby at its other hours and in winter is the dusk room with only its glass door's view changed: each is the model's
# edit of a crop round the door alone (paint_rooms door: an edit of the whole room repainted the street at every hour),
# kept in picks/ as painted, at this box, and only its glass (snowed()) is taken from it.
ENTRANCE_CROP = (1792, 0, 2304, 768)   # painting px: the crop round the lobby's glass door, 512 x 768 (paint_rooms edits it)
DOOR = {"reception": ENTRANCE_CROP}
# Winter's edits snowed on what is indoors too (the roof's lift housing, the lobby door's frame, bars and handles), and
# would not keep the lobby's view: a winter pick is the hour's own picture with only what may be snowy taken from its
# edit. The roof: all but the housing (gen_floors.HOUSING, 265 art px); the lobby: its door's glass panes, but its push
# bars and handles. In painting pixels.
SNOWED = {"roof": [(660, 0, 2304, 768)],
          "reception": [(1993, 106, 2057, 208), (2078, 96, 2232, 178), (2000, 231, 2057, 661), (2090, 221, 2130, 666),
                        (2155, 204, 2230, 693)]}
DRY = {"reception": [(1970, 464, 2252, 488), (2045, 436, 2122, 501)]}


def snowed(room, hour):
    """The mask of what a winter pick takes from its edit over the hour's picture: SNOWED, but in DRY the brass (the
    bars and handles, as the hour has them), its edge softened a pixel."""
    mask = Image.new("L", hour.size)
    d = ImageDraw.Draw(mask)
    for box in SNOWED[room]:
        d.rectangle(box, fill=255)
    m, px = mask.load(), hour.load()
    for x0, y0, x1, y1 in DRY.get(room, []):
        for y in range(y0, y1):
            for x in range(x0, x1):
                r, g, b = px[x, y]
                if r > 50 and r - b > 20 and g >= b - 5:
                    m[x, y] = 0
    return mask.filter(ImageFilter.GaussianBlur(1))


def unsnow(edit, room):
    """The edit with its DRY boxes refilled, each column a blend from the row just above the box to the row just below:
    the snow it laid on the bars and handles gone, the view behind them carried on."""
    px = edit.load()
    for x0, y0, x1, y1 in DRY.get(room, []):
        for x in range(x0, x1):
            top, bottom = px[x, y0 - 1], px[x, y1]
            for y in range(y0, y1):
                t = (y - y0 + 1) / (y1 - y0 + 1)
                px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom, strict=True))
    return edit


PIVOT = (344, 105)   # floor 5's gauge: its needle's pivot, in the room's pixels, about which gen_floors' needle swings


def unneedle(px, _out):
    """Floor 5: the gauge's painted needle is taken down, so gen_floors' can swing (its GAUGE). Each pixel near the
    needle, its tail too, takes the dial's colour a little round the face at the same distance from the pivot."""
    (cx, cy), tip, turn = PIVOT, (364, 78), math.radians(-35)
    src, out = px.load(), px.copy()
    q = out.load()
    tx, ty, n = tip[0] - cx, tip[1] - cy, math.dist((cx, cy), tip)
    for y in range(cy - 32, cy + 32):
        for x in range(cx - 32, cx + 32):
            dx, dy = x - cx, y - cy
            along = (dx * tx + dy * ty) / n                                # along the needle, its tail negative
            if -9 <= along <= n + 2 and abs(dx * ty - dy * tx) / n <= 2.6 and math.hypot(dx, dy) > 2:
                q[x, y] = src[round(cx + dx * math.cos(turn) - dy * math.sin(turn)), round(cy + dx * math.sin(turn) + dy * math.cos(turn))]
    return out


PLAQUES = [(312, 73, 370, 148), (392, 75, 450, 149), (471, 77, 530, 150)]   # the reception's three papers, in its pixels
INK, HEADER, SEAL = (64, 44, 30), (122, 85, 48), (160, 50, 39)


def plaques(px, _out):
    """The lobby: the three recommendations, blank paper in the painting (it painted scrawl, and its dawn none), are
    written in code as the old cel-shaded lobby's were, at 2x: a header bar, four lines of text, a signature and its
    seal. The paper keeps its painted light."""
    d = ImageDraw.Draw(px)
    for x0, y0, x1, y1 in PLAQUES:
        d.rectangle((x0 + 6, y0 + 6, x1 - 6, y0 + 9), HEADER)
        for k in range(4):
            y = y0 + 18 + 8 * k
            d.rectangle((x0 + 6, y, x1 - 6 - (x1 - x0) // 3 * (k == 3), y + 1), INK)
        d.rectangle((x1 - 20, y1 - 10, x1 - 8, y1 - 9), INK)
        d.rectangle((x1 - 7, y1 - 13, x1 - 4, y1 - 10), SEAL)
    return px


def unletter(*boxes):
    """Lettering the model painted on a floor: each row of a box takes its median, so the planks keep their colour."""
    def fix(px, _out):
        for x0, y0, x1, y1 in boxes:
            for y in range(y0, y1):
                row = sorted(px.getpixel((x, y)) for x in range(x0, x1))
                for x in range(x0, x1):
                    px.putpixel((x, y), row[len(row) // 2])
        return px
    return fix


TWINKLE = (380, 176, 760, 202)   # the roof's far city, whose lit windows twinkle at night (gen_floors.roof): x0, y0, x1, y1


def twinkles(col):
    """A lit window of the roof's far city."""
    return col[0] > 200 and col[1] > 150 and col[2] < 140


def night_lights(px, out):
    """The roof at winter night: its snow edit painted the far city's windows dark, and its colours have none that the
    night's twinkle (gen_floors.roof) lights. The plain night's lit pixels there are put on it as they are (a few colours
    past the 64, as the twinkle's own dimmed ones are): roof-night-px.png must be installed first."""
    night = Image.open(out / "roof-night-px.png").convert("RGB").load()
    q = px.load()
    for y in range(TWINKLE[1], TWINKLE[3]):
        for x in range(TWINKLE[0], TWINKLE[2]):
            if twinkles(c := night[x, y]):
                q[x, y] = c
    return px


TOUCHUPS = {"billie_risk": unneedle, "reception": plaques, "roof-day": unletter((136, 278, 164, 286)),   # a room, or one hour of it
            "roof-winter-night": night_lights}
# Mends over a candidate (patch_picks.py): the roof's floating second jib at night, floor 2's ghost second pendant.
PATCHES = {"roof-night": ["roof-night-jib.png"], "inuitive": ["inuitive-pendant.png"]}


def carried(im, box, across):
    """The box filled in code, each row carried across from the pixels just left of it to just right (`across`), or each
    column down from just above it to just below, its edge softened a pixel: a thin line the model drew is gone, and a
    line crossing it the other way (a cable, a pole) runs on."""
    a = np.asarray(im).astype(float).copy()
    x0, y0, x1, y1 = box
    if across:
        t = np.linspace(0, 1, x1 - x0)[None, :, None]
        a[y0:y1, x0:x1] = a[y0:y1, x0 - 3:x0].mean(1)[:, None] * (1 - t) + a[y0:y1, x1:x1 + 3].mean(1)[:, None] * t
        soft = (x0, y0, x1, y1)
    else:
        t = np.linspace(0, 1, y1 - y0)[:, None, None]
        a[y0:y1, x0:x1] = a[y0 - 4:y0, x0:x1].mean(0)[None] * (1 - t) + a[y1:y1 + 4, x0:x1].mean(0)[None] * t
        soft = (x0 + 2, y0 + 2, x1 - 2, y1 - 2)
    mask = Image.new("L", im.size)
    ImageDraw.Draw(mask).rectangle(soft, fill=255)
    return Image.composite(Image.fromarray(a.round().astype(np.uint8)), im, mask if across else mask.filter(ImageFilter.GaussianBlur(2)))


# Lines filled in code (carried()), in painting px: floor 4's two extra lamp cords, down to the shades; and, on the winter
# night's snow edit, the floating jib right of the scaffolding (through it, the columns would drag its icicles down).
FILLS = {"sumup": [((1481, 0, 1492, 170), True), ((1865, 0, 1876, 178), True)],
         "roof-winter-night": [((1150, 256, 1755, 304), False)]}


def mended(name, src):
    src = patched(src, PATCHES.get(name, ()))
    for box, across in FILLS.get(name, ()):
        src = carried(src, box, across)
    return src


def painting(name, dull=True):
    """What a pick is baked from: its candidate; the lobby at another hour or in winter, door_view(); winter on the roof,
    the hour's own picture with what may be snowy (snowed()) from its edit."""
    room = name.split("-")[0]
    if room in DOOR and name != room:
        return door_view(name, room, dull)
    src = mended(name, Image.open(CANDIDATES / PICKS[name]).convert("RGB"))
    if "-winter" in name:
        hour = painting(name.replace("-winter", ""))
        hour.paste(unsnow(src, room), (0, 0), snowed(room, hour))
        return hour
    if room in BLANK:
        src = blank(src, *BLANK[room])
    return src


def door_view(name, room, dull=True):
    """The dusk room with its door's glass from the hour's crop (DOOR), as snowed() takes it; in winter onto the hour's
    room, unsnow() over the brass as on the roof. At night the view is dulled (night_view())."""
    edit = painting(room)
    edit.paste(Image.open(PICKED / PICKS[name]).convert("RGB"), DOOR[room][:2])
    winter = "-winter" in name
    hour = painting(name.replace("-winter", ""), dull=False) if winter else painting(room)
    hour.paste(unsnow(edit, room) if winter else edit, (0, 0), snowed(room, hour))
    return night_view(hour, room) if dull and name.endswith("night") else hour


NIGHT = 0.5   # how much of its blue the lobby's night view keeps: the model paints it a saturated royal blue


def night_view(img, room, mask=None):
    """The night view through the lobby's glass (or `mask`) dulled toward a grey night blue, before the colours are cut:
    each pixel's blue cast (how much bluer than red it is) cut by NIGHT, so the lantern's warm light and what it lights
    keep theirs."""
    a = np.asarray(img).astype(float)
    y = (a @ np.array([0.299, 0.587, 0.114]))[..., None]
    grey = y * np.array([0.92, 0.98, 1.12])                                    # a cool grey: the night blue, dulled
    w = np.clip((a[..., 2] - a[..., 0] - 8) / 40, 0, 1)[..., None]             # how blue; the warm pixels keep theirs
    out = Image.fromarray((a + (grey - a) * w * (1 - NIGHT)).clip(0, 255).round().astype(np.uint8))
    return Image.composite(out, img, snowed(room, img) if mask is None else mask)


def relit(lobby, room, box):
    """The lobby's box lit as the room's wall is (each row scaled, channel by channel, by the room's bare wall, WALL's
    columns, over the lobby's), and the mask of what to take from it: the panel and its shadow, two pixels round, its edge
    softened a pixel before install() cuts it to the room's colours, so the room keeps its own wall about it (the
    lobby's is lit nearer the lift)."""
    x0, y0, x1, y1 = box
    out, mask = lobby.crop(box), Image.new("L", (x1 - x0, y1 - y0))
    px, m = out.load(), mask.load()
    for y in range(y0, y1):
        a, b = (sorted((im.getpixel((x, y)) for x in range(*WALL)), key=sum) for im in (lobby, room))
        a, b = a[len(a) // 2], b[len(b) // 2]
        for x in range(x1 - x0):
            col = px[x, y - y0]
            m[x, y - y0] = 255 * (sum(a) - sum(col) > 36)   # darker than the wall: the panel and its shadow
            px[x, y - y0] = tuple(min(255, round(v * k / max(1, w))) for v, k, w in zip(col, b, a, strict=True))
    return out, mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1))


def install(name, out):
    src, room = painting(name), name.split("-")[0]
    small = {"lobby": lambda: src.crop(LOBBY[1]).resize(LOBBY_PX, Image.BOX), "cab": lambda: src.resize(CAB_PX, Image.BOX)}.get(
        name, lambda: src.resize(FLOOR_PX, Image.BOX))()
    if name not in ("lobby", "cab"):   # before the colours are cut, so the lift has its share of the floor's budget
        lobby = Image.open(out / "lobby-px.png").convert("RGB")
        for box in (LIFT, SIGN):
            small.paste(lobby.crop(box), box[:2])
    px = small.quantize(COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    if room == "roof":   # its hours repainted the call panel (a display by day, a blank box at night): the lobby's, relit,
        panel, mask = relit(lobby, small, PANEL)   # after the cut and on its colours, so the rest of the room keeps its own
        small.paste(panel, PANEL[:2], mask)
        cut = Image.new("P", (1, 1))
        cut.putpalette([v for c in ([c for _, c in px.getcolors()] * 256)[:256] for v in c])
        px.paste(small.crop(PANEL).quantize(palette=cut, dither=Image.Dither.NONE).convert("RGB"), PANEL[:2],
                 mask.point(lambda v: 255 * (v > 0)))
    for key in {room, name, name.replace("-winter", "")} & TOUCHUPS.keys():   # winter keeps its hour's touch-ups
        px = TOUCHUPS[key](px, out)
    px.save(out / f"{name}-px.png")
    print("installed", name, src.size, "->", px.size, "colours:", len(px.getcolors(4096)))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*", metavar="NAME", help=f"of PICKS (all, by default): {', '.join(PICKS)}")
    ap.add_argument("--out", type=Path, default=PICKED, help="where the -px.png files go")
    a = ap.parse_args()
    if unknown := set(a.names) - PICKS.keys():
        ap.error(f"not in PICKS: {', '.join(sorted(unknown))}")
    a.out.mkdir(parents=True, exist_ok=True)
    for name in a.names or PICKS:
        install(name, a.out)
