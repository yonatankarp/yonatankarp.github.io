# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
# ///
"""Install the picked paintings: bake each to the art standard (the city's: box-reduced, a median cut to 64 colours, no
dither, no palette), with the one lift pasted in.

Run: uv run web3d/pixel/install_picks.py [NAME ...]

PICKS names every painting's candidate (paint_rooms.py; floors 1 and 3 mended by its `wall`). A floor's painting is
the lobby carried on into its room, so its lift is already where the lobby's is; the lobby's own lift (its frame and
doors, and the floor display over them) is pasted over it all the same, so the doors pixel.js slides are one pair on
every floor. Writes paintings/picks/<name>-px.png: 928 x 308, the lobby 264 x 308. Install the lobby first.
"""
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint_rooms import LOBBY  # noqa: E402

HERE = Path(__file__).resolve().parent / "paintings"
LOBBY_PX, FLOOR_PX, CAB_PX, COLOURS = (264, 308), (928, 308), (96, 168), 64   # the cab: gen_floors.DOOR's size
LIFT = (76, 100, 194, 284)   # the lift's frame and doors in the lobby's pixels, down to its sill
SIGN = (117, 79, 152, 96)    # the floor display over them, which gen_floors lights with the floor's number
PICKS = {  # name: its candidate. The roof's and the reception's other hours are the dusk pick edited (paint_rooms retime),
           # and each hour's winter is that hour's pick edited (paint_rooms winter)
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
    "reception-dawn": "reception_1117-dawn_1000.png",
    "reception-day": "reception_1117-day_1000.png",
    "reception-night": "reception_1117-night_1000.png",
    "roof": "roof_1100.png",
    "roof-dawn": "roof_1100-dawn_1000.png",
    "roof-day": "roof_1100-day_1000.png",
    "roof-night": "roof_1100-night_1017.png",
    "reception-winter": "reception_1117-winter_717.png",
    "reception-winter-dawn": "reception_1117-dawn_1000-winter_700.png",
    "reception-winter-day": "reception_1117-day_1000-winter_700.png",
    "reception-winter-night": "reception_1117-night_1000-winter_717.png",
    "roof-winter": "roof_1100-winter_717.png",
    "roof-winter-dawn": "roof_1100-dawn_1000-winter_700.png",
    "roof-winter-day": "roof_1100-day_1000-winter_700.png",
    "roof-winter-night": "roof_1100-night_1017-winter_700.png",
}
# Lettering the model painted though asked not to, in painting pixels, taken from a picture of the same room that has
# none: the reception's three recommendations, from its dawn, which the model painted blank.
BLANK = {"reception": ("reception_1117-dawn_1000.png", [(766, 172, 918, 368), (964, 172, 1118, 368), (1162, 172, 1316, 368)])}


def blank(img, src, boxes):
    clean = Image.open(HERE / "candidates" / src).convert("RGB")
    for box in boxes:
        img.paste(clean.crop(box), box[:2])
    return img


# Indoors, an hour's edit relit the whole room (sun across the wall, the bench recoloured): only what is seen outside is
# taken from it, onto the dusk room. The reception's glass door with its frame, in painting pixels.
VIEW = {"reception": (1970, 96, 2252, 724)}
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


def unneedle(px):
    """Floor 5: the gauge's painted needle is taken down, so gen_floors' can swing (its GAUGE). Each pixel near the
    needle, its tail too, takes the dial's colour a little round the face at the same distance from the pivot."""
    (cx, cy), tip, turn = (344, 105), (364, 78), math.radians(-35)
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


def plaques(px):
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
    def fix(px):
        for x0, y0, x1, y1 in boxes:
            for y in range(y0, y1):
                row = sorted(px.getpixel((x, y)) for x in range(x0, x1))
                for x in range(x0, x1):
                    px.putpixel((x, y), row[len(row) // 2])
        return px
    return fix


TOUCHUPS = {"billie_risk": unneedle, "reception": plaques, "roof-day": unletter((136, 278, 164, 286))}   # a room, or one hour of it


def painting(name):
    """What a pick is baked from: its candidate; an hour of a room, its view pasted on the dusk room; winter, the hour's
    own picture with what may be snowy (snowed()) from its edit."""
    src = Image.open(HERE / "candidates" / PICKS[name]).convert("RGB")
    room = name.split("-")[0]
    if "-winter" in name:
        hour = painting(name.replace("-winter", ""))
        hour.paste(unsnow(src, room), (0, 0), snowed(room, hour))
        return hour
    if room in VIEW and room != name:
        hour, src = src, Image.open(HERE / "candidates" / PICKS[room]).convert("RGB")
        src.paste(hour.crop(VIEW[room]), VIEW[room][:2])
    if room in BLANK:
        src = blank(src, *BLANK[room])
    return src


def install(name):
    src, room = painting(name), name.split("-")[0]
    small = {"lobby": lambda: src.crop(LOBBY[1]).resize(LOBBY_PX, Image.BOX), "cab": lambda: src.resize(CAB_PX, Image.BOX)}.get(
        name, lambda: src.resize(FLOOR_PX, Image.BOX))()
    if name not in ("lobby", "cab"):   # before the colours are cut, so the lift has its share of the floor's budget
        lobby = Image.open(HERE / "picks" / "lobby-px.png").convert("RGB")
        for box in (LIFT, SIGN):
            small.paste(lobby.crop(box), box[:2])
    px = small.quantize(COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    for key in {room, name, name.replace("-winter", "")} & TOUCHUPS.keys():   # winter keeps its hour's touch-ups
        px = TOUCHUPS[key](px)
    px.save(HERE / "picks" / f"{name}-px.png")
    print("installed", name, src.size, "->", px.size, "colours:", len(px.getcolors(4096)))


if __name__ == "__main__":
    for name in sys.argv[1:] or PICKS:
        install(name)
