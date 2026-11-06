# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Paint floor candidates with the local model in Draw Things (HTTP API, Settings > API Server, port 7860).

Run: uv run web3d/pixel/paint_rooms.py <room> [--count N] [--start SEED] [--host URL]
     uv run web3d/pixel/paint_rooms.py retime --src <pick>.png --time dawn|day|night

Every floor continues the lift lobby: the base image is the picked lobby painting on the left with its plain wall,
skirting and plank floor carried across the whole width, and the model *edits* it, keeping all of that and
furnishing the space right of the lift with the room's objects. The lobby is an edit of the old one, so its lift stays
where it was. retime paints a dusk pick (the roof, or the lobby's view) at another hour.

Writes web3d/pixel/paintings/candidates/<room>_<seed>.png (retime: <pick>-<time>_<seed>.png). Existing candidates are
kept, never repainted: the model does not redraw a seed bit for bit, so a picked candidate is the input of later steps.
The model runs at guidance 1, so prompts say what to show; negative prompts do nothing. Draw Things runs one job at a
time.
"""
import argparse
import base64
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent / "paintings"
OUT = HERE / "candidates"
# The art standard (the city's): painterly, art 928 x 308 at about 2.5 painting pixels each. Every room is painted from
# the lobby, an edit of the first one (OLD_LOBBY, cel-shaded), so the lift stayed where the floors' code has it.
FLOOR_SIZE = (2304, 768)
LOBBY_SIZE = (704, 768)       # the lobby alone: art 264 x 308 px
LOBBY = ("lobby_1017.png", (7, 7, 684, 761))   # the picked lobby candidate and its crop (install_picks.py)
OLD_LOBBY = "lobby_100.png"

EDIT = (
    "Edit this picture. Repaint it as highly detailed painterly city-builder video game art of a single room seen "
    "straight on like a dollhouse cutaway: orthographic side view, no perspective, no side walls, the back wall "
    "parallel to the picture. Warm golden dusk light, soft shadows, rich texture and fine detail. Keep the elevator on "
    "the left exactly where it is and the same size, and keep the warm plaster wall, the skirting board and the wooden "
    "plank floor where they are across the whole picture. The back wall is one flat continuous wall running straight "
    "from the elevator to the right edge of the picture: no corner, no step, no pillar, no side wall and no change of "
    "colour where the elevator's wall ends. In the space to the right of the elevator, furnish the room with: "
)
TAIL = (" Every object stands on the floor, detailed and clearly readable, spaced apart. A few hanging pendant "
             "lamps cast warm soft pools of light, lit warm. No people. No text, no letters, no numbers, no logos and "
             "no labels on anything: every surface is plain.")
PAINTERLY = ("highly detailed painterly city-builder video game art, warm golden dusk light, soft shadows, rich "
             "texture and fine detail")
# The lift's cab, seen through its open doors on every floor (gen_floors draws it behind the sliding doors): painted on its
# own, as tall as the doorway.
CAB_SIZE = (448, 768)
CAB = (
    "A " + PAINTERLY + " picture of the inside of an empty elevator cab seen straight on through its open doorway, "
    "filling the whole picture edge to edge: a brushed-steel back wall with soft vertical highlights, a polished brass "
    "handrail across it at waist height, a warm glowing ceiling light panel along the top, a dark polished floor along "
    "the bottom, narrow steel side walls in perspective. Nothing else. No people, no text, no buttons, no numbers, no logos."
)
LOBBY_EDIT = (
    "Edit this picture. Repaint it as " + PAINTERLY + ", a single lift lobby seen straight on: orthographic side view, "
    "no perspective, no side walls. Keep the elevator exactly where it is and the same size: a closed brushed-steel "
    "elevator with two sliding door panels meeting in one straight vertical seam in the middle, in a dark steel frame, "
    "a small black floor-number display above the doors with a plain amber glow, and a call button panel beside the "
    "doors. Keep the plain warm-beige plaster wall, the wooden skirting board and the warm wooden plank floor along the "
    "bottom, running straight out of both sides of the picture. One hanging pendant lamp near the top casts a warm soft "
    "pool of light on the doors. Nothing else. No people, no text, no letters, no numbers, no logos."
)
ROOF = (
    "Edit this picture. Repaint it as " + PAINTERLY + ", seen straight on: orthographic side view, no perspective. Keep "
    "the elevator on the left exactly where it is, with its wall around it, as a small rooftop lift housing. Replace "
    "everything to the right of the housing with an open flat rooftop at dusk: a low parapet wall along the bottom, a "
    "big yellow tower crane lifting a steel beam on its hook, steel scaffolding framing the bare columns of an "
    "unfinished next storey, a stack of steel beams and planks, a flagpole with a small plain amber flag, and behind it "
    "a purple-to-peach sunset sky over a distant low city skyline on a coast, the sea glowing at the horizon. "
    "No people, no text, no letters, no numbers, no logos."
)
# The other hours: an edit of the dusk pick that changes only the light. On the roof the whole picture; in the lobby
# only what is seen through its glass door.
HOURS = {
    "dawn": "early dawn: a pale pearl-mauve sky going to cream at the horizon with thin pink streaks, the sun just rising, "
            "soft cool morning light, street lamps off, almost every window dark",
    "day": "bright noon: a clear deep blue sky fading pale at the horizon, a few fat white clouds, strong warm sunlight "
           "on every wall, street lamps off, windows dark",
    "night": "deep night: a dark blue night sky with stars and a thin crescent moon, cool blue moonlight on the walls, "
             "warm lit windows here and there, street lamps glowing warm",
}
OUTDOOR = ("Edit this picture. Keep everything exactly as it is: every building, object, shape, material and where it "
           "stands, the same painterly style and the same view. Change only the time of day, to {}. "
           "No people, no text, no letters, no numbers, no logos.")
VIEW = ("Edit this picture. Keep the room exactly as it is: every object, shape and material, its own warm lamps and "
        "their light, the same painterly style. Change only what is seen outside through the {}, to {}. "
        "No people, no text, no letters, no numbers, no logos.")
WINDOWS = {"reception": "glass entrance door"}

ROOMS = {  # what furnishes each floor, right of the lift; walls and floor come from the lobby
    "sumup": (
        "an indoor market hall of small independent shops that take card payments, side by side: a coffee cart with a "
        "striped awning and a chrome espresso machine, a flower stall with zinc buckets of colourful flowers, a small "
        "bakery counter with a basket of bread loaves; on each counter a small white card payment terminal with a "
        "glowing green screen; the upper wall in the middle of the room is bare plaster; warm amber accents."
    ),
    "nice": (
        "a contact centre operations room with no alcove and no recess, all of it in one shallow row along the flat back "
        "wall: a single row of desks side "
        "by side with monitors and headsets resting on them, empty office "
        "chairs, a large wall screen showing call queue bar charts and a world map with glowing dots, a glass-fronted "
        "cabinet holding neatly stacked coloured cubes, an office printer with paper coming out, a small server rack "
        "with blue lights. The wall behind the desks is the very same flat wall as beside the elevator, in one plane."
    ),
    "billie_risk": (
        "a credit risk office where business purchases on invoice are checked, from left to right: a big brass balance "
        "scale on a wooden side table weighing a stack of paper invoices against a pile of gold coins; a large round "
        "wall gauge with a green, amber and red arc and a black needle; a wide wooden desk with a tall stack of paper "
        "invoices, a big rubber stamp, a green ink pad and a desk lamp; a tall grey filing cabinet with an open drawer "
        "of folders, two of them marked with small red flags, a magnifying glass on top; the upper wall in the middle "
        "of the room is bare warm beige plaster."
    ),
    "billie_orchestrator": (
        "an automated decision room for business orders, from left to right: a waist-high conveyor belt carrying "
        "cardboard parcels with paper invoices on top into a big grey steel sorting machine with a large traffic light "
        "on top (red, amber and green lamps); out of the machine two short slides, one into a green crate of accepted "
        "parcels and one into a red crate of rejected parcels; on the wall at the right a large dark screen showing a "
        "network graph of connected circles with one circle glowing red; the upper wall in the middle of the room is "
        "bare warm beige plaster."
    ),
    "billie_payments": (
        "a payments vault room where money moves between businesses: a big round polished steel bank vault door set "
        "into the wall with a spoked wheel handle; shiny brass pneumatic tubes running along the ceiling and down into a "
        "desk-high banknote counting machine with stacks of green banknotes and gold coins beside it; a plain red metal "
        "bin for returned payments with a curved chute leading back up into the tubes; the upper wall in the middle of "
        "the room is bare plaster; coral-red paint accents."
    ),
    "inuitive": (
        "a hardware and robotics test lab: a long workbench with green circuit boards, small black chips and soldering "
        "tools, an oscilloscope with a glowing green waveform, a small wheeled delivery robot with a stereo depth camera "
        "on its head standing on the floor, a quadcopter drone resting on a landing pad, a camera on a tripod pointed at "
        "a black-and-white checkerboard calibration board on the wall, cardboard shipping crates, green accents."
    ),
    "reception": (
        "a building's ground-floor reception: a long curved honey-wood reception desk with a small brass bell and an "
        "open guest book, three large framed cream-paper testimonial plaques hanging in a row on the wall, a tall "
        "dark-wood building directory board with rows of small blank brass name plates, a green leather bench beside "
        "a big potted palm, and on the far right a tall glass entrance door showing the dusky street outside, brass "
        "accents."
    ),
    "reichman": (
        "a university lecture room, all of it in one shallow row along the back wall: a single row of wooden benches "
        "with fold-down desks side by side, a large dark green chalkboard covered "
        "in white chalk diagrams of trees, graphs and boxes joined by arrows, a wooden lectern with an open laptop, a "
        "tall bookshelf full of thick textbooks, a globe, a framed diploma, deep green accents. The wall behind the "
        "chalkboard is the very same flat wall as beside the elevator, in one plane, with no corner."
    ),
}


def floor_base(size=FLOOR_SIZE):
    """The lobby on the left, its plain wall, skirting and floor (a strip from its edge) carried rightwards."""
    name, box = LOBBY
    lobby_w = round(size[1] * 132 / 154)
    lobby = Image.open(OUT / name).convert("RGB").crop(box).resize((lobby_w, size[1]), Image.LANCZOS)
    # a painterly wall tiled reads as stripes, and as a corner at the lobby's edge: carry each row's colour on
    plain = lobby.crop((lobby_w - 40, 0, lobby_w, size[1])).resize((1, size[1]), Image.BOX)
    base = Image.new("RGB", size)
    for x in range(lobby_w, size[0], plain.width):
        base.paste(plain, (x, 0))
    base.paste(lobby, (0, 0))
    return base


def call(host, path, payload):
    req = urllib.request.Request(host + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        return json.loads(r.read())


def band(size, x1, y1, feather=40):
    """The mask of the wall next to the lift: full from the lobby's edge to x1 - 40 and down to y1 - 20, fading out
    over 40 px to the right and 20 below, and in over `feather` px of the lobby's wall on the left."""
    x0 = round(size[1] * 132 / 154)
    mask = Image.new("L", size)
    px = mask.load()
    for y in range(y1):
        for x in range(x0 - feather // 2, x1):
            px[x, y] = round(255 * min(1, (x - x0 + feather // 2) / feather, (x1 - x) / 40, (y1 - y) / 20))
    return mask


def mended(src, x1, y1, side="lobby"):
    """The lobby's wall carried on over a corner the model painted beside the lift, faded in over band()'s feather. The
    model would not paint the wall flat: asked to, it painted the corner again. From the lobby's side, the strip left
    of its edge, mirrored again and again, so its plaster, light and skirting run on with no seam. From the room's
    (where that would mirror the lobby lamp's light into a V), each row goes over from the lobby's edge colour to the
    back wall's past x1, and the plaster's grain (the fine detail of the wall left of the edge) is mirrored across it."""
    x0 = round(src.height * 132 / 154)
    fill = src.copy()
    if side == "lobby":
        strip = src.crop((x0 - 100, 0, x0, src.height))
        for i, x in enumerate(range(x0, x1, 100)):
            fill.paste(strip.transpose(Image.FLIP_LEFT_RIGHT) if i % 2 == 0 else strip, (x, 0))
        return Image.composite(fill, src, band(src.size, x1, y1))
    import numpy as np   # here only: gen_city, gen_library and gen_workshop import this module without numpy
    a = np.asarray(src, dtype=np.float64)
    smooth = np.asarray(src.filter(ImageFilter.GaussianBlur(12)), dtype=np.float64)
    t = np.linspace(0, 1, x1 - x0)[None, :, None]
    strip = (a - smooth)[:, x0 - 100:x0]                                   # the plain wall left of the edge, clear
    tiles = [strip[:, ::-1] if i % 2 == 0 else strip for i in range((x1 - x0) // 100 + 1)]   # of the call buttons
    grain = np.concatenate(tiles, axis=1)[:, :x1 - x0]
    out = a.copy()
    out[:, x0:x1] = smooth[:, x0 - 8, None] * (1 - t) + smooth[:, x1 + 8, None] * t + grain
    fill = Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGB")
    return Image.composite(fill, src, band(src.size, x1, y1, 120))


def ceiling(src, x1, y1):
    """A lowered ceiling the model hung over the room (floor 3's alcove): the wall under it, mirrored up over it from the
    lobby's edge to x1, so the plaster and the lamps' cords run on to the top; faded in over 20 px below and at x1."""
    x0, fill = round(src.height * 132 / 154), src.copy()
    fill.paste(src.crop((0, y1, src.width, 2 * y1)).transpose(Image.FLIP_TOP_BOTTOM), (0, 0))
    mask = Image.new("L", src.size)
    px = mask.load()
    for y in range(y1 + 20):
        for x in range(x0, x1):
            px[x, y] = round(255 * min(1, (y1 + 20 - y) / 20, (x1 - x) / 20))
    return Image.composite(fill, src, mask)


def paint(path, prompt, size, seed, host, init=None):
    """One candidate, kept if painted already (the model does not redraw a seed bit for bit)."""
    if path.exists():
        print("kept", path.name)
        return
    job = {"prompt": prompt, "width": size[0], "height": size[1], "seed": seed, "batch_size": 1}
    if init is not None:
        buf = io.BytesIO()
        init.save(buf, "PNG")
        job |= {"strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]}
    res = call(host, "/sdapi/v1/img2img" if init is not None else "/sdapi/v1/txt2img", job)
    path.write_bytes(base64.b64decode(res["images"][0].split(",")[-1]))
    print("painted", path.name, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("room", choices=["lobby", "cab", "roof", "retime", "wall", *sorted(ROOMS)])
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--start", type=int, default=1000)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    ap.add_argument("--src", help="retime: the dusk pick, a candidate's file name (roof_1017.png)")
    ap.add_argument("--time", choices=sorted(HOURS), help="retime: the hour to paint it at")
    ap.add_argument("--band", action="append", help="wall: X,Y[,room], how far right and down the wall beside the lift "
                    "is mended, and from which side; again for another band over the first")
    ap.add_argument("--ceiling", help="wall: X,Y, a lowered ceiling over the room to take down, to x X and row Y")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.room == "wall":   # a pick whose room turned a corner beside the lift: <src>-wall.png, the rest kept as is
        src = Image.open(OUT / args.src).convert("RGB")
        out = src
        for b in args.band:
            x1, y1, *side = b.split(",")
            out = mended(out, int(x1), int(y1), *side)
        if args.ceiling:
            out = ceiling(out, *map(int, args.ceiling.split(",")))
        out.save(OUT / f"{Path(args.src).stem}-wall.png")
        return
    if args.room == "retime":   # the same picture at another hour: <src>-<time>_<seed>.png
        init = Image.open(OUT / args.src).convert("RGB")
        kind = args.src.split("_")[0]
        prompt = VIEW.format(WINDOWS[kind], HOURS[args.time]) if kind in WINDOWS else OUTDOOR.format(HOURS[args.time])
        stem = Path(args.src).stem
        jobs = [(OUT / f"{stem}-{args.time}_{args.start + 17 * k}.png", prompt, init.size, args.start + 17 * k, init)
                for k in range(args.count)]
    elif args.room == "cab":
        jobs = [(OUT / f"cab_{args.start + 17 * k}.png", CAB, CAB_SIZE, args.start + 17 * k, None) for k in range(args.count)]
    elif args.room == "lobby":   # an edit of the old lobby, so its lift stays where the floors' code has it
        init = Image.open(OUT / OLD_LOBBY).convert("RGB").resize(LOBBY_SIZE, Image.LANCZOS)
        jobs = [(OUT / f"lobby_{args.start + 17 * k}.png", LOBBY_EDIT, LOBBY_SIZE, args.start + 17 * k, init)
                for k in range(args.count)]
    else:
        prompt = ROOF if args.room == "roof" else EDIT + ROOMS[args.room] + TAIL
        init = floor_base(FLOOR_SIZE)
        jobs = [(OUT / f"{args.room}_{args.start + 17 * k}.png", prompt, FLOOR_SIZE, args.start + 17 * k, init)
                for k in range(args.count)]
    for path, prompt, size, seed, init in jobs:
        paint(path, prompt, size, seed, args.host, init)


if __name__ == "__main__":
    main()
