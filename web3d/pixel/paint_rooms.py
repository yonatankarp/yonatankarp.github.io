# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
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

from PIL import Image

HERE = Path(__file__).resolve().parent / "paintings"
OUT = HERE / "candidates"
FLOOR_SIZE = (1920, 640)      # the whole floor, lobby + room: art 464 x 154 px at about 4.15x
LOBBY_PICK = ("lobby_100.png", (6, 6, 570, 634))   # the picked lobby candidate and its crop (install_picks.py)
# The new art standard (the city's): painterly, and twice the old floors' pixels, art 928 x 308 at about 2.5 painting
# pixels each. Every room is painted at it, from the new lobby, whose lift stays where the old one was.
FINE_SIZE = (2304, 768)
LOBBY_FINE_SIZE = (704, 768)  # the lobby alone: art 264 x 308 px
LOBBY_FINE = ("lobby_1017.png", (7, 7, 684, 761))   # the old LOBBY_PICK's crop, at this size

EDIT_FINE = (
    "Edit this picture. Repaint it as highly detailed painterly city-builder video game art of a single room seen "
    "straight on like a dollhouse cutaway: orthographic side view, no perspective, no side walls, the back wall "
    "parallel to the picture. Warm golden dusk light, soft shadows, rich texture and fine detail. Keep the elevator on "
    "the left exactly where it is and the same size, and keep the warm plaster wall, the skirting board and the wooden "
    "plank floor where they are across the whole picture. The back wall is one flat continuous wall running straight "
    "from the elevator to the right edge of the picture: no corner, no step, no pillar, no side wall and no change of "
    "colour where the elevator's wall ends. In the space to the right of the elevator, furnish the room with: "
)
TAIL_FINE = (" Every object stands on the floor, detailed and clearly readable, spaced apart. A few hanging pendant "
             "lamps cast warm soft pools of light, lit warm. No people. No text, no letters, no numbers, no logos and "
             "no labels on anything: every surface is plain.")
PAINTERLY = ("highly detailed painterly city-builder video game art, warm golden dusk light, soft shadows, rich "
             "texture and fine detail")
LOBBY_EDIT = (
    "Edit this picture. Repaint it as " + PAINTERLY + ", a single lift lobby seen straight on: orthographic side view, "
    "no perspective, no side walls. Keep the elevator exactly where it is and the same size: a closed brushed-steel "
    "elevator with two sliding door panels meeting in one straight vertical seam in the middle, in a dark steel frame, "
    "a small black floor-number display above the doors with a plain amber glow, and a call button panel beside the "
    "doors. Keep the plain warm-beige plaster wall, the wooden skirting board and the warm wooden plank floor along the "
    "bottom, running straight out of both sides of the picture. One hanging pendant lamp near the top casts a warm soft "
    "pool of light on the doors. Nothing else. No people, no text, no letters, no numbers, no logos."
)
ROOF_FINE = (
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
    "parking": (
        "an underground parking level lit by long fluorescent tube lights: thick concrete pillars with yellow and black "
        "hazard stripes, white parking bay lines painted on the floor, three parked vehicles side by side: a small "
        "vintage camper van, a compact hatchback car and a scooter, an arcade game cabinet with a glowing screen "
        "against the wall, a workbench under a pegboard of tools, and on the far right a ramp rising toward daylight."
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
    name, box = LOBBY_PICK if size == FLOOR_SIZE else LOBBY_FINE
    lobby_w = round(size[1] * 132 / 154)
    lobby = Image.open(OUT / name).convert("RGB").crop(box).resize((lobby_w, size[1]), Image.LANCZOS)
    if size == FLOOR_SIZE:
        plain = lobby.crop((0, 0, 48, size[1]))
    else:   # a painterly wall tiled reads as stripes, and as a corner at the lobby's edge: carry each row's colour on
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
    ap.add_argument("room", choices=["lobby", "roof", "retime", *sorted(ROOMS)])
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--start", type=int, default=1000)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    ap.add_argument("--src", help="retime: the dusk pick, a candidate's file name (roof_1017.png)")
    ap.add_argument("--time", choices=sorted(HOURS), help="retime: the hour to paint it at")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.room == "retime":   # the same picture at another hour: <src>-<time>_<seed>.png
        init = Image.open(OUT / args.src).convert("RGB")
        kind = args.src.split("_")[0]
        prompt = VIEW.format(WINDOWS[kind], HOURS[args.time]) if kind in WINDOWS else OUTDOOR.format(HOURS[args.time])
        stem = Path(args.src).stem
        jobs = [(OUT / f"{stem}-{args.time}_{args.start + 17 * k}.png", prompt, init.size, args.start + 17 * k, init)
                for k in range(args.count)]
    elif args.room == "lobby":   # an edit of the old lobby, so its lift stays where the floors' code has it
        init = Image.open(OUT / LOBBY_PICK[0]).convert("RGB").resize(LOBBY_FINE_SIZE, Image.LANCZOS)
        jobs = [(OUT / f"lobby_{args.start + 17 * k}.png", LOBBY_EDIT, LOBBY_FINE_SIZE, args.start + 17 * k, init)
                for k in range(args.count)]
    else:
        prompt = ROOF_FINE if args.room == "roof" else EDIT_FINE + ROOMS[args.room] + TAIL_FINE
        init = floor_base(FINE_SIZE)
        jobs = [(OUT / f"{args.room}_{args.start + 17 * k}.png", prompt, FINE_SIZE, args.start + 17 * k, init)
                for k in range(args.count)]
    for path, prompt, size, seed, init in jobs:
        paint(path, prompt, size, seed, args.host, init)


if __name__ == "__main__":
    main()
