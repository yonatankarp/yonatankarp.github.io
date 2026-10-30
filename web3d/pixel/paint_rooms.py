# /// script
# dependencies = ["pillow==12.1.0"]
# ///
"""Paint floor candidates with the local model in Draw Things (HTTP API, Settings > API Server, port 7860).

Run: uv run web3d/pixel/paint_rooms.py <room> [--count N] [--start SEED] [--host URL]

Every floor continues the lift lobby: the base image is the picked lobby painting on the left with its plain wall,
skirting and plank floor carried across the whole width, and the model *edits* it, keeping all of that and
furnishing the space right of the lift with the room's objects. The lobby itself is painted from text.

Writes web3d/pixel/paintings/candidates/<room>_<seed>.png. Existing candidates are kept, never repainted: the model
does not redraw a seed bit for bit, so a picked candidate is the input of later steps. The model runs at guidance 1,
so prompts say what to show; negative prompts do nothing. Draw Things runs one job at a time.
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
LOBBY_SIZE = (576, 640)       # the lobby alone: art 132 x 154 px
LOBBY_PICK = ("lobby_100.png", (6, 6, 570, 634))   # the picked lobby candidate and its crop (install_picks.py)
LOBBY_W = round(FLOOR_SIZE[1] * 132 / 154)          # the lobby's width inside a floor base, in painting pixels

STYLE = (
    "Flat 2D side-view video game background art of a single room, seen straight on like a dollhouse cutaway: "
    "orthographic, no perspective, the back wall parallel to the picture, the floor a thin strip along the bottom. "
    "Clean cel shading with bold dark outlines, chunky simple shapes that read well when reduced to pixel art, "
    "a limited warm palette, cosy dusk lighting from hanging pendant lamps casting soft cones of light. "
    "No people, no text, no letters, no logos. "
)
EDIT = (
    "Edit this picture. Keep the elevator on the left exactly as it is, and keep the warm plaster wall, the skirting "
    "board and the wooden plank floor exactly as they are across the whole picture: same colours, same flat "
    "cel-shaded style with bold dark outlines. Keep it a straight-on side view with no perspective and no side walls. "
    "In the empty space to the right of the elevator, furnish the room with: "
)
TAIL = (" Make every object large and chunky, standing on the floor and reaching up to near the ceiling, spaced apart "
        "so each one reads clearly on its own. Add a few hanging pendant lamps with soft cones of light. "
        "No people, no text, no letters, no logos.")

LOBBY = (
    "A lift lobby: in the middle of a plain warm-beige plaster wall, a closed brushed-steel elevator with two "
    "sliding door panels in a dark steel frame, a small black floor-number display above the doors with an "
    "amber glow, and a call button panel beside the doors; a wooden skirting board and the same warm wooden "
    "plank floor along the bottom; one hanging pendant lamp near the top casting a soft cone of light on the doors. "
    "Simple and uncluttered, nothing else in the picture."
)
ROOMS = {  # what furnishes each floor, right of the lift; walls and floor come from the lobby
    "sumup": (
        "a small Berlin café that takes card payments: a long honey-wood counter with a chrome espresso machine, a "
        "glass pastry case with golden croissants, a small black card payment terminal with a glowing green screen; a "
        "dark green chalkboard menu on the wall; a big yellow industrial stamping press standing on the floor, as "
        "tall as a person, feeding small pale-blue boxes onto a black conveyor belt that runs into a separate tall dark "
        "server rack with rows of green status lights; a large wooden-framed window showing a dusky purple-to-peach Berlin skyline with the TV tower; a "
        "small round café table with two cups and a potted plant."
    ),
    "nice": (
        "a contact centre operations room: a row of desks with monitors and headsets resting on them, empty office "
        "chairs, a large wall screen showing call queue bar charts and a world map with glowing dots, a glass-fronted "
        "cabinet holding neatly stacked coloured cubes, an office printer with paper coming out, a small server rack "
        "with blue lights."
    ),
    "billie_risk": (
        "a real-time data signal room for fraud detection: a long horizontal glass pipe running across the wall with "
        "glowing cyan light pulses flowing inside it, a control panel with round analogue gauges and dials, a large "
        "wall screen showing a network graph of connected circles with one circle glowing red, a desk with two "
        "monitors and a desk lamp, a potted plant, cool cyan accents."
    ),
    "billie_orchestrator": (
        "a control room built around a large glowing violet hexagonal console standing on the floor, thick cables "
        "running from it to four smaller dark server cabinets, a wall screen showing paper invoices moving into a green "
        "lane and an amber lane, one ghostly translucent cabinet with a dashed outline standing apart, violet accents."
    ),
    "billie_payments": (
        "a compliance screening room: a conveyor belt carrying envelopes and paper invoices through a large "
        "airport-style security scanner arch with a glowing frame, a red review tray beside the belt for flagged "
        "envelopes, thick pipes running along the ceiling with glowing joints, a red post box on the wall for returned "
        "letters, a wall dashboard of small status tiles in green and red, coral accents."
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
    "writing": (
        "a writer's newsroom: a big wooden desk with a vintage typewriter and an open laptop, tall stacks of printed "
        "articles and newspapers, a cork board on the wall covered in pinned pages joined by red string, a tall "
        "bookshelf of technical books, a small hand-cranked printing press in the corner with fresh pages coming out, "
        "a green banker's lamp, a coffee mug."
    ),
    "reichman": (
        "a university lecture room: rows of wooden benches with fold-down desks, a large dark green chalkboard covered "
        "in white chalk diagrams of trees, graphs and boxes joined by arrows, a wooden lectern with an open laptop, a "
        "tall bookshelf full of thick textbooks, a globe, a framed diploma, deep green accents."
    ),
}


# The roof is where the ride ends: the lift becomes a small rooftop housing and the rest opens to the sky.
ROOF = (
    "Edit this picture. Keep the elevator on the left exactly as it is, with its wall around it, as a small rooftop "
    "lift housing; keep the same flat cel-shaded style with bold dark outlines and a straight-on side view. Replace "
    "everything to the right of the housing with an open flat rooftop at dusk: a low parapet wall along the bottom, "
    "a big yellow tower crane lifting a steel beam on its hook, steel scaffolding framing the bare columns of an "
    "unfinished next storey, a stack of steel beams and planks, a flagpole with a small amber flag, and behind it a "
    "purple-to-peach sunset sky over a distant low city skyline on a coast, the sea glowing at the horizon. "
    "No people, no text, no letters, no logos."
)


def floor_base():
    """The lobby on the left, its plain wall, skirting and floor (a strip from its left edge) carried rightwards."""
    name, box = LOBBY_PICK
    lobby = Image.open(OUT / name).convert("RGB").crop(box).resize((LOBBY_W, FLOOR_SIZE[1]), Image.LANCZOS)
    plain = lobby.crop((0, 0, 48, FLOOR_SIZE[1]))
    base = Image.new("RGB", FLOOR_SIZE)
    for x in range(LOBBY_W, FLOOR_SIZE[0], plain.width):
        base.paste(plain, (x, 0))
    base.paste(lobby, (0, 0))
    return base


def call(host, path, payload):
    req = urllib.request.Request(host + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("room", choices=["lobby", "roof", *sorted(ROOMS)])
    ap.add_argument("--count", type=int, default=4)
    ap.add_argument("--start", type=int, default=300)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.room != "lobby":
        buf = io.BytesIO()
        floor_base().save(buf, "PNG")
        init = base64.b64encode(buf.getvalue()).decode()
    for k in range(args.count):
        seed = args.start + 17 * k
        path = OUT / f"{args.room}_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        if args.room == "lobby":
            w, h = LOBBY_SIZE
            res = call(args.host, "/sdapi/v1/txt2img", {"prompt": STYLE + LOBBY, "width": w, "height": h, "seed": seed, "batch_size": 1})
        else:
            w, h = FLOOR_SIZE
            prompt = ROOF if args.room == "roof" else EDIT + ROOMS[args.room] + TAIL
            res = call(args.host, "/sdapi/v1/img2img", {"prompt": prompt, "width": w, "height": h,
                                                        "seed": seed, "batch_size": 1, "strength": 1.0, "init_images": [init]})
        path.write_bytes(base64.b64decode(res["images"][0].split(",")[-1]))
        print("painted", path.name, flush=True)


if __name__ == "__main__":
    main()
