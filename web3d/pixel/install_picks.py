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

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paint_rooms import LOBBY  # noqa: E402

HERE = Path(__file__).resolve().parent / "paintings"
LOBBY_PX, FLOOR_PX, COLOURS = (264, 308), (928, 308), 64
LIFT = (76, 100, 194, 284)   # the lift's frame and doors in the lobby's pixels, down to its sill
SIGN = (117, 79, 152, 96)    # the floor display over them, which gen_floors lights with the floor's number
PICKS = {  # name: its candidate. The roof's and the reception's other hours are the dusk pick edited (paint_rooms retime)
    "lobby": "lobby_1017.png",
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


TOUCHUPS = {"billie_risk": unneedle}


def install(name):
    src = Image.open(HERE / "candidates" / PICKS[name]).convert("RGB")
    room = name.split("-")[0]
    if room in VIEW and room != name:
        hour, src = src, Image.open(HERE / "candidates" / PICKS[room]).convert("RGB")
        src.paste(hour.crop(VIEW[room]), VIEW[room][:2])
    if room in BLANK:
        src = blank(src, *BLANK[room])
    small = src.crop(LOBBY[1]).resize(LOBBY_PX, Image.BOX) if name == "lobby" else src.resize(FLOOR_PX, Image.BOX)
    if name != "lobby":   # before the colours are cut, so the lift has its share of the floor's budget
        lobby = Image.open(HERE / "picks" / "lobby-px.png").convert("RGB")
        for box in (LIFT, SIGN):
            small.paste(lobby.crop(box), box[:2])
    px = small.quantize(COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    if room in TOUCHUPS:
        px = TOUCHUPS[room](px)
    px.save(HERE / "picks" / f"{name}-px.png")
    print("installed", name, src.size, "->", px.size, "colours:", len(px.getcolors(4096)))


if __name__ == "__main__":
    for name in sys.argv[1:] or PICKS:
        install(name)
