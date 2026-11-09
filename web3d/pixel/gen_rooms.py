# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""The Radio Mast's studio (/podcast/) and the Post Office's counter hall (/contact/): each a room painted across the head
of its page, as the Library is.

Run: uv run web3d/pixel/gen_rooms.py paint [--count N] [--start S]   # Draw Things paints both rooms from text (port 7860)
     uv run web3d/pixel/gen_rooms.py paint --time PHASE [--winter] [--room R] [...]   # ... or a room's view or hour (HOURS)
     uv run web3d/pixel/gen_rooms.py build [OUT]                     # OUT/ROOM[-winter][-PHASE].webp, ROOM-fx.json and
                                                                     # the studio's radio-reels[-winter][-PHASE].webp

Painted from text at the city's size and baked as the Library is (gen_library.py), so the grain matches: box-reduced
to ART_W wide on COLOURS colours, undithered. Paintings go to web3d/pixel/paintings/candidates/ROOM_SEED.png (not
committed); the chosen one is copied to web3d/pixel/paintings/picks/ROOM.png, the build's input, and its seed noted in
PICKS.

Each room follows the hour and the season, as the city does, from its dusk pick (hour()): at another hour the dusk
drawing relit in the light of the model's edit of the whole room to that hour (art_common.relit), so the FX keep their
places, and through its windows (WINDOWS: their glass, art_common.glass) the view at that hour, from an edit of a crop
round the windows alone that names the view to keep, as the lobby's door is painted (paint_rooms.py door); in winter the
view under snow, the dusk one first and each hour that one retimed, so the snow lies the same at every hour. Picks:
picks/ROOM-PHASE.png (the room retimed, ROOM_PICKS) and picks/ROOM-view[-winter][-PHASE].png (VIEW_PICKS).

The rooms' animations (web3d/src/rooms-fx.js) draw from ROOM-fx.json, FX below, and the studio's reels from
radio-reels[-winter][-PHASE].webp (reels()), cut from each hour's art at the same boxes.
"""
import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_common import (ART_W, CANDIDATES, OUT, PH, PICKS as PICKED, PW, ROOT, bake, blur, glass,  # noqa: E402
                        name, paint_candidate, patched, relit, save_lossless)
from install_picks import night_view  # noqa: E402

PHASES = list(json.loads((ROOT / "data" / "phases.json").read_text()))

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


# The rooms at the other hours and in winter (hour()). Their windows, in painting px: the crop round them the model edits
# (whole 64s), the glass (art_common.glass: panes, arches, what stands in front, lamps, mullions and bars), the view to
# keep, and its snow. The studio's frosted upper pane is the room's, so the hour's room lights it.
WINDOWS = {
    "radio": {"crop": (1856, 0, 3392, 704),
              "glass": {"panes": [(1985, 50, 2177, 497), (2727, 68, 2893, 553), (2918, 0, 3276, 622)],
                        "fronts": [(2128, 212, 2440, 704), (2082, 405, 2440, 704)]},
              "view": "the tall red and white lattice radio mast with its round dish, the grey slate rooftops, chimneys and "
                      "gabled white houses of the old town, and the open sky above them with soft clouds"},
    "post": {"crop": (1088, 0, 3392, 640),
             "glass": {"panes": [(1115, 255, 1420, 485), (2855, 160, 2988, 492), (3195, 70, 3328, 552)],
                       "arches": [(2855, 95, 2988, 225), (3195, 4, 3328, 136)],
                       "fronts": [(2740, 320, 2890, 505), (2905, 460, 3010, 505)], "bars": True},
             "view": "through the barred counter window, two hills under the open sky; through the tall arched windows on the "
                     "right, the calm sea of the bay, the low city skyline with a tower on the far shore, a dark green shrub "
                     "and the open sky with soft clouds",
             # the bay stays water, as the city's does: asked only for snow on "the ground", the model snowed it over
             "snow": "fresh white snow lying on the rooftops, the ledges, the far shore, the hills and the shrub, the sea in "
                     "the bay still open, dark rippling water with no snow and no ice on it"},
}
SNOW = "fresh white snow lying on the rooftops, ledges, chimneys and the ground"
# The view's light at each hour, and the room's (its edit whole, which hour() takes only the light from).
LIGHT = {
    "dawn": "early dawn: a cool pale blue and soft pink sky, the first pale golden light low on the rooftops, soft long "
            "shadows, true colours, almost every window dark",
    "day": "a bright clear midday: a clear blue sky with a few white clouds, strong sunlight, true deep colours, nothing "
           "washed out or overexposed, every window dark",
    "night": "night: a dark deep blue night sky with a few stars, the houses and rooftops dark in deep blue shadow with "
             "faint moonlight on their edges, only a few warm lit windows glowing, nothing brightly lit",
}
ROOM_LIGHT = {
    "dawn": "early dawn: a cool pale blue and soft pink sky outside the windows, soft cool first light coming in, the "
            "room dim and cool, its lamps still glowing",
    "day": "a bright clear midday: a clear blue sky outside the windows, bright natural daylight coming in through them "
           "and filling the room with soft even light, true colours, nothing washed out",
    "night": "deep night: a dark blue night sky outside the windows, the room lit only by its own warm lamps, deep "
             "shadows away from them",
}
VIEW = ("Edit this picture. Keep the room exactly as it is: every object, shape and material, the window frames, its own "
        "warm lamps and their light, the same painterly style. Keep the view seen outside through the windows exactly as "
        "it is, the very same place: {}, every one of them in the same place with the same shape. Change only the time "
        "of day out there, to {}. No people, no text, no letters, no numbers, no logos.")
VIEW_WINTER = ("Edit this picture. Keep the room exactly as it is: every object, shape and material, the window frames "
               "clean and dry, its own warm lamps and their light, the same painterly style. Keep the view seen outside "
               "through the windows exactly as it is, the very same place: {}, every one of them in the same place with "
               "the same shape, and keep its golden dusk light and purple-to-peach sunset sky. Change only the season out "
               "there to deep winter: {}. No snow on this side of the glass. No people, no text, no letters, no numbers, "
               "no logos.")
ROOM = ("Edit this picture. Keep everything exactly as it is: every object, shape, material and where it stands, the "
        "same painterly style and the same view. Change only the time of day to {}. No people, no text, no letters, "
        "no numbers, no logos.")
# The seeds of the picks, for the record: the views (winter's at 700 on, as the city's), keyed [-winter][-PHASE], and the
# rooms retimed. The Library's are gen_library.py's.
VIEW_PICKS = {"radio": {"-dawn": 1017, "-day": 1017, "-night": 1000, "-winter": 734, "-winter-dawn": 734, "-winter-day": 700,
                        "-winter-night": 734},
              "post": {"-dawn": 1000, "-day": 1000, "-night": 1017, "-winter": 717, "-winter-dawn": 717, "-winter-day": 717,
                       "-winter-night": 717}}
ROOM_PICKS = {"radio": {"dawn": 1034, "day": 1034, "night": 1034}, "post": {"dawn": 1034, "day": 1034, "night": 1034}}
# The Post Office's dusk sun lies across its wall and pigeonholes in diagonal shafts, drawn into the pick: at these hours
# hour() takes them out (unbeam) and carries the hour's light over broader (WIDE), as the hour's edit painted shafts too.
BEAMS = {"post": ("dawn", "night")}
SIGMA, WIDE = 16, 64   # painting px: how broad relit() carries the hour's light over


def suffix(phase, winter=False):
    """[-winter][-PHASE]: the file suffix of an hour, as art_common.name() names it, html[data-art] at that hour."""
    return name(phase, winter, "")


def unbeam(im):
    """im with the light at the scale of the sun's shafts (between a 24 and a 96 px blur) taken out, its lights kept."""
    import numpy as np
    a = np.asarray(im, float)
    lum = (a[..., :1] * 0.299 + a[..., 1:2] * 0.587 + a[..., 2:] * 0.114) + 4   # ufuncs, not a BLAS product: the same bits on CI
    lit = np.clip((a.max(-1, keepdims=True) - 200) / 40, 0, 1)
    return Image.fromarray(np.clip(a / (1 + (np.maximum(blur(lum, 24) / blur(lum, 96), 1) - 1) * (1 - lit)), 0, 255).round().astype("uint8"))


def hour(stem, spec, phase, winter, patches=()):
    """A room's painting at an hour, and the mends its bake still pastes: at dusk the pick, its glass in winter the winter
    view's; at another hour the mended pick relit in the light of the room retimed (picks/STEM-PHASE.png), the hour's view
    through its glass, at night dulled from the model's royal blue as the lobby's is (install_picks.night_view)."""
    dusk = Image.open(PICKED / f"{stem}.png").convert("RGB")
    mask = glass(dusk, **spec["glass"])
    if phase == "dusk":
        base = dusk
    else:
        base, patches = patched(dusk.copy(), patches), ()
        wide = phase in BEAMS.get(stem, ())
        base = relit(unbeam(base) if wide else base, Image.open(PICKED / f"{stem}-{phase}.png"), mask, WIDE if wide else SIGMA)
        if base.size != dusk.size:
            sys.exit(f"picks/{stem}-{phase}.png is not the size of picks/{stem}.png")
    if phase == "dusk" and not winter:
        return base, patches
    full = base.copy()
    full.paste(Image.open(PICKED / f"{stem}-view{suffix(phase, winter)}.png").convert("RGB"), spec["crop"][:2])
    out = Image.composite(full, base, mask)
    return (night_view(out, None, mask) if phase == "night" else out), patches


def paint_hour(stem, spec, phase, winter, count, start, host):
    """Candidates for a room at an hour: its view (a crop round the windows: at another hour the dusk one retimed, in
    winter the winter dusk one's), and, but in winter, the whole room retimed. Into candidates/STEM-view[-winter][-PHASE]_SEED.png
    and candidates/STEM-PHASE_SEED.png."""
    from paint_rooms import PINNED   # here only: the build needs no model
    dusk = Image.open(PICKED / f"{stem}.png").convert("RGB")
    snow = spec.get("snow", SNOW)
    if winter and phase != "dusk":   # the winter dusk view retimed, so the snow lies the same at every hour
        crop = hour(stem, spec, "dusk", True)[0].crop(spec["crop"])
        prompt = VIEW.format(f"{spec['view']}, all under {snow}", LIGHT[phase] + ", the snow lit by it")
    else:
        crop = dusk.crop(spec["crop"])
        prompt = VIEW_WINTER.format(spec["view"], snow) if winter else VIEW.format(spec["view"], LIGHT[phase])
    jobs = [(CANDIDATES / f"{stem}-view{suffix(phase, winter)}_{s}.png", prompt, crop, s) for s in range(start, start + 17 * count, 17)]
    if not winter:
        whole = patched(dusk, PATCHES.get(stem, ()))   # the on-air lamp unlit before it is relit
        jobs += [(CANDIDATES / f"{stem}-{phase}_{s}.png", ROOM.format(ROOM_LIGHT[phase]), whole, s) for s in range(start, start + 17 * count, 17)]
    for path, text, init, seed in jobs:
        paint_candidate(path, text, init.size, seed, host, init, extra=PINNED)

REEL_DARK = 0.6    # a reel's cutouts and hub holes: darker than this much of its metal
REEL_HOLES = 0.92  # how far out, of the flange's edge, the holes go: past it is the rim's seams


def reels(art, spec, ref=None):
    """The reels' sheet, radio-reels.webp: a column per reel, its box round the hub (half-width and half-height either
    side), the bare reel on top (its cutouts filled from the metal along their ring, so the lamps' light stays where it
    falls) and its cutouts below, on clear, which rooms-fx.js turns about the hub. The cutouts are found in `ref` (the
    dusk art, the same drawing as every hour's, whose dark reels at night hide some) and cut from `art`."""
    rgb, found = art.convert("RGB"), (ref or art).convert("RGB")
    boxes = [(x - rx, y - ry, x + rx + 1, y + ry + 1) for x, y, rx, ry, *_ in spec]
    sheet = Image.new("RGBA", (sum(b[2] - b[0] for b in boxes), 2 * max(b[3] - b[1] for b in boxes)))
    left = 0
    for (_, _, rx, ry, _, hub), box in zip(spec, boxes, strict=True):
        src = rgb.crop(box)
        w, h = src.size
        px, fx = src.load(), found.crop(box).load()
        def ring(X, Y, rx=rx, ry=ry):   # 1 on the flange's edge
            return math.hypot((X - rx) / rx, (Y - ry) / ry)
        lum = {(X, Y): sum(fx[X, Y]) / 3 for Y in range(h) for X in range(w)}
        disc = sorted(v for p, v in lum.items() if ring(*p) < 1)
        metal = disc[len(disc) // 2]   # the reel's middling brightness: its metal, as lit at dusk
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
        ref = bake(*hour(room, WINDOWS[room], "dusk", False, PATCHES.get(room, ())))   # where the reels' cutouts are
        for winter in (False, True):
            for phase in PHASES:
                art = bake(*hour(room, WINDOWS[room], phase, winter, PATCHES.get(room, ())))
                save_lossless(art, out / f"{room}{suffix(phase, winter)}.webp")
                if "reels" in FX[room]:
                    save_lossless(reels(art, FX[room]["reels"], ref), out / f"{room}-reels{suffix(phase, winter)}.webp")
        (out / f"{room}-fx.json").write_text(json.dumps(FX[room], separators=(",", ":")))
        print(f"drew {room}[-winter][-PHASE].webp from seed {seed}, the views {VIEW_PICKS[room]} and the hours {ROOM_PICKS[room]}, at {ART_W} wide")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["paint", "build"])
    ap.add_argument("out", nargs="?", type=Path, default=OUT)
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--start", type=int, help="the first seed (1500; an hour's, 1000; winter's, 700)")
    ap.add_argument("--time", choices=PHASES, help="paint: a room's view and room at this hour (not dusk but in winter)")
    ap.add_argument("--winter", action="store_true", help="paint: the view in winter")
    ap.add_argument("--room", choices=sorted(WINDOWS), action="append", help="paint --time: only this room (again for more)")
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    a = ap.parse_args()
    if a.cmd == "build":
        build(Path(a.out))
    elif a.time or a.winter:
        phase = a.time or "dusk"
        if phase == "dusk" and not a.winter:
            sys.exit("paint --time: dusk is the pick itself; paint --time dawn|day|night, or --winter [--time PHASE]")
        for room in a.room or sorted(WINDOWS):
            paint_hour(room, WINDOWS[room], phase, a.winter, a.count, a.start or (700 if a.winter else 1000), a.host)
    else:
        paint(a.count, a.start or 1500, a.host)
