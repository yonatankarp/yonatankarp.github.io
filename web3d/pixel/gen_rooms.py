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

The rooms' animations (web3d/src/rooms-fx.js) draw from ROOM-fx.json, FX below, and the studio's reels from
radio-reels.webp (reels()).
"""
import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_common import ART_W, CANDIDATES, OUT, PH, PICKS as PICKED, PW, bake, paint_candidate, save_lossless  # noqa: E402

PICKS = {"radio": 1500, "post": 1500}   # the seed of each room's pick, for the record
# Mends over a room's pick (patch_picks.py): the studio's on-air lamp unlit, as the show is off air (data/rooms.yaml).
PATCHES = {"radio": ["radio-off-air.png"]}
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
        "lamp": [238, 70],                                       # the on-air lamp, painted unlit (PATCHES): no glow while off air
        # The tape decks' reels, left deck then right: the hub's x, y, the painted flange's half-width and half-height (a
        # disc seen at a slant), its turn (1 clockwise), and how far out its plain painted hub goes, which need not turn: on
        # the left deck the hub's ring of holes turns. Their cutouts turn about the hub over the bare metal (reels()).
        "reels": [[97, 128, 25, 35, 1, 0], [150, 131, 20, 32, 1, 0], [912, 132, 24, 30, -1, 0.34], [976, 130, 27, 33, -1, 0.34]],
        "needles": [[491, 196], [576, 196]],                     # the VU meters' pivots
        "beacon": [1260, 11],                                    # the mast's light, out of the window
    },
    "post": {
        "clock": [523, 52],                                      # the wall clock's middle: its second hand
        "lamps": [[279, 82], [729, 82]],                         # the two lamps, whose warmth breathes
        "dust": [470, 90, 580, 210],                             # x0, y0, x1, y1: the grille window's light
    },
}


REEL_DARK = 0.6    # a reel's cutouts and hub holes: darker than this much of its metal
REEL_HOLES = 0.92  # how far out, of the flange's edge, the holes go: past it is the rim's seams


def reels(art, spec):
    """The reels' sheet, radio-reels.webp: a column per reel, its box round the hub (half-width and half-height either
    side), the bare reel on top (its cutouts filled from the metal along their ring, so the lamps' light stays where it
    falls) and its cutouts below, on clear, which rooms-fx.js turns about the hub."""
    rgb = art.convert("RGB")
    boxes = [(x - rx, y - ry, x + rx + 1, y + ry + 1) for x, y, rx, ry, *_ in spec]
    sheet = Image.new("RGBA", (sum(b[2] - b[0] for b in boxes), 2 * max(b[3] - b[1] for b in boxes)))
    left = 0
    for (_, _, rx, ry, _, hub), box in zip(spec, boxes, strict=True):
        src = rgb.crop(box)
        w, h = src.size
        px = src.load()
        def ring(X, Y, rx=rx, ry=ry):   # 1 on the flange's edge
            return math.hypot((X - rx) / rx, (Y - ry) / ry)
        lum = {(X, Y): sum(px[X, Y]) / 3 for Y in range(h) for X in range(w)}
        disc = sorted(v for p, v in lum.items() if ring(*p) < 1)
        metal = disc[len(disc) // 2]   # the reel's middling brightness: its metal, as lit
        dark = {p for p, v in lum.items() if v < REEL_DARK * metal}
        # The holes are the dark the metal rings round; dark that reaches the box's edge is the deck, its shadows and the rim.
        out, todo = set(), [(X, Y) for X, Y in dark if X in (0, w - 1) or Y in (0, h - 1)]
        while todo:
            p = todo.pop()
            if p in out:
                continue
            out.add(p)
            todo += [q for q in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)) if q in dark]
        holes = {p for p in dark - out if hub <= ring(*p) < REEL_HOLES}
        holes |= {(X + dx, Y + dy) for X, Y in holes for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))}   # their soft edge
        bare, cut = src.convert("RGBA"), Image.new("RGBA", (w, h))
        for X, Y in holes:
            cut.putpixel((X, Y), px[X, Y] + (255,))
            n, t = ring(X, Y), math.atan2((Y - ry) / ry, (X - rx) / rx)
            step = 1 / max(1, n * max(rx, ry))   # about a pixel along the ring
            for k in range(1, 1000):   # the nearest metal along the same ring, either way round
                at = [(round(rx + n * math.cos(t + s * k * step) * rx), round(ry + n * math.sin(t + s * k * step) * ry)) for s in (1, -1)]
                if metal := [q for q in at if 0 <= q[0] < w and 0 <= q[1] < h and q not in holes]:
                    bare.putpixel((X, Y), px[metal[0]] + (255,))
                    break
        sheet.paste(bare, (left, 0))
        sheet.paste(cut, (left, sheet.height // 2))
        left += w
    return sheet


def pick(room):
    path = PICKED / f"{room}.png"
    if not path.exists():
        sys.exit(f"no {path}: paint (gen_rooms.py paint), copy the chosen candidate there and note its seed in PICKS")
    return path


def paint(count, start, host):
    for room, prompt in PROMPTS.items():
        for k in range(count):
            seed = start + 17 * k
            paint_candidate(CANDIDATES / f"{room}_{seed}.png", prompt, (PW, PH), seed, host)


def build(out):
    for room, seed in PICKS.items():
        art = bake(pick(room), PATCHES.get(room, ()))
        save_lossless(art, out / f"{room}.webp")
        if "reels" in FX[room]:
            save_lossless(reels(art, FX[room]["reels"]), out / f"{room}-reels.webp")
        (out / f"{room}-fx.json").write_text(json.dumps(FX[room], separators=(",", ":")))
        print(f"drew {room}.webp from seed {seed} at {ART_W} wide")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["paint", "build"])
    ap.add_argument("out", nargs="?", type=Path, default=OUT)
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--start", type=int, default=1500)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    a = ap.parse_args()
    if a.cmd == "paint":
        paint(a.count, a.start, a.host)
    else:
        build(Path(a.out))
