# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0"]
# ///
"""The Radio Mast's studio (/podcast/) and the Post Office's counter hall (/contact/): each a room painted across the head
of its page, as the Library is.

Run: uv run web3d/pixel/gen_rooms.py paint [--count N] [--start S]   # Draw Things paints both rooms from text (port 7860)
     uv run web3d/pixel/gen_rooms.py build [OUT]                     # OUT/ROOM.webp and ROOM-fx.json for each room

Painted from text at the city's size and baked as the Library is (gen_library.py), so the grain matches: box-reduced
to ART_W wide on COLOURS colours, undithered. One painting each, at dusk: they are interiors. Paintings go to
web3d/pixel/paintings/candidates/ROOM_SEED.png (not committed); the chosen one is copied to
web3d/pixel/paintings/picks/ROOM.png, the build's input, and its seed noted in PICKS.

The rooms' animations (web3d/src/rooms-fx.js) draw from ROOM-fx.json, FX below.
"""
import argparse
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_city import ART_W, PH, PW  # noqa: E402
from gen_library import bake as library_bake  # noqa: E402
from paint_rooms import OUT as CANDIDATES, call  # noqa: E402

PICKS = {"radio": 1500, "post": 1500}   # the seed of each room's pick, for the record
PICKED = Path(__file__).resolve().parent / "paintings" / "picks"
STYLE = ("Wide panoramic interior of one room, seen straight on from the middle of the room, highly detailed painterly "
         "pixel-art-ready video game background, warm golden dusk light through the windows, soft lamp light, rich warm "
         "palette, cosy. No people, no text, no letters, no logos, no writing anywhere. ")
PROMPTS = {
    "radio": STYLE + ("A small vintage radio broadcast studio: in the middle a wooden desk with a large studio microphone on a "
                      "boom arm and a pair of headphones; a wide mixing desk with faders and two round VU meters; on the left a "
                      "big reel-to-reel tape recorder on a stand and shelves of vinyl records; on the wall a red round on-air "
                      "lamp; acoustic foam panels in warm brown; on the right a tall window looking out over rooftops to a red "
                      "and white lattice radio mast against a dusk sky; a warm desk lamp; a rug on the wooden floor."),
    "post": STYLE + ("An old town post office counter hall: a long polished wooden counter across the room with a brass grille "
                     "window in the middle; behind it a tall wall of small wooden pigeonholes holding letters; a large round "
                     "wall clock above; a brown paper parcel tied with string on the counter; a set of brass scales; a red "
                     "post box on the left by the door; tall arched windows on the right with the dusk sky; green-shaded lamps; "
                     "a tiled floor."),
}
# Where each room's animations go, in art pixels (rooms-fx.js).
FX = {
    "radio": {
        "lamp": [238, 70],                                       # the red on-air lamp, which breathes
        "reels": [[90, 119, 19, 1], [148, 119, 19, 1], [914, 131, 21, -1], [972, 131, 21, -1]],   # x, y, radius, turn
        "needles": [[489, 196], [579, 196]],                     # the VU meters' pivots
        "beacon": [1256, 11],                                    # the mast's light, out of the window
    },
    "post": {
        "clock": [523, 52],                                      # the wall clock's middle: its second hand
        "lamps": [[279, 82], [729, 82]],                         # the two lamps, whose warmth breathes
        "dust": [470, 90, 580, 210],                             # x0, y0, x1, y1: the grille window's light
    },
}


def pick(room):
    path = PICKED / f"{room}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint (gen_rooms.py paint), copy the chosen candidate there and note its seed in PICKS")
    return path


def paint(count, start, host):
    for room, prompt in PROMPTS.items():
        for k in range(count):
            seed = start + 17 * k
            path = CANDIDATES / f"{room}_{seed}.png"
            if path.exists():
                print("kept", path.name)
                continue
            res = call(host, "/sdapi/v1/txt2img", {"prompt": prompt, "width": PW, "height": PH, "seed": seed, "batch_size": 1})
            Image.open(io.BytesIO(base64.b64decode(res["images"][0].split(",")[-1]))).save(path)
            print("painted", path.name, flush=True)


def build(out):
    for room, seed in PICKS.items():
        library_bake(pick(room)).save(out / f"{room}.webp", "WEBP", lossless=True, quality=100, method=6, exact=True)
        (out / f"{room}-fx.json").write_text(json.dumps(FX[room], separators=(",", ":")))
        print(f"drew {room}.webp from seed {seed} at {ART_W} wide")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["paint", "build"])
    ap.add_argument("out", nargs="?", default="static/building/pixel")
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--start", type=int, default=1500)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    a = ap.parse_args()
    if a.cmd == "paint":
        paint(a.count, a.start, a.host)
    else:
        build(Path(a.out))
