# /// script
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]   # numpy: pixelate
# ///
"""The street view: the whole building at dusk, its windows showing the live rooms. The landing view.

Run: uv run web3d/pixel/gen_exterior.py blockout            # the code blockout, for a look
     uv run web3d/pixel/gen_exterior.py paint [--count N]   # Draw Things repaints the blockout (port 7860)
     uv run web3d/pixel/gen_exterior.py build OUT           # OUT/exterior.png (12 frames) + exterior.json,
                                                            # and backdrop.png: the street without the tower

The blockout fixes what the model must not move: the number of storeys, the window grid, the entrance, the garage
and the crane. The model repaints it into the rooms' style; the picked painting is pixelated with the floors'
palette and colour match, then the blockout's windows are pasted back and filled with 1:1 crops of each floor's
strip, frame by frame, so the street view animates in step with the floors. Build the floors first.
"""
import argparse
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_floors as G  # noqa: E402
from paint_rooms import OUT as CANDIDATES, call  # noqa: E402
from pixelate import dither_bands, pixelate  # noqa: E402

HERE = Path(__file__).resolve().parent / "paintings"
EW, EH = 480, 336               # art pixels: 2x on a 1440x900 screen, 1x on a phone (cropped to the building)
PAINT = 4                        # painting pixels per art pixel
PICK = 634                       # the picked candidate's seed, or None to build from the blockout; it was painted
                                 # with nine storeys, and street() cuts the top one (the newsroom's) out
GROUND = 310                     # the pavement line
BX0, BX1 = 170, 310              # the building, in the middle of the street
STOREY = 28
STOREYS = ["L", "1", "2", "3", "4", "5", "6", "7"]   # bottom to top above ground; P is below the street
WIN_X0, WIN_X1 = 180, 300        # each storey's ribbon window
c, INK = G.c, G.INK
GLOW_WIN = G.GLOW["amber"]

# Where each window looks into its floor's strip (x, y of the slice's top-left, in strip pixels): the room's
# signature props. The window's size decides the slice's size.
LOOK = {"1": (322, 76), "2": (328, 82), "3": (266, 56), "4": (250, 64), "5": (222, 54), "6": (230, 96),
        "7": (205, 86), "R": (0, 0), "L": (246, 122), "P": (166, 78)}
NEIGHBOURS = ((0, 30, 200), (30, 74, 170), (74, 118, 214), (118, 166, 176),
              (314, 348, 196), (348, 398, 160), (398, 440, 206), (440, 480, 172))   # x0, x1, roof
LAMPS = (40, 142, 338, 440)
INFILL = ((166, 216, 6), (216, 274, 5), (274, 314, 3))   # the backdrop's blocks in the tower's lot: x0, x1, the
                                                          # neighbour each copies, a window column (8 px) wider or narrower;
                                                          # the last drops the column under the lamp at 142, drawn into it


def windows():
    """Window rectangles (x0, y0, x1, y1) on the street view, by floor key."""
    out = {}
    for i, key in enumerate(STOREYS):
        y0 = GROUND - STOREY * (i + 1)
        out[key] = (WIN_X0, y0 + 5, WIN_X1, y0 + 25)
    out["L"] = (216, GROUND - 24, 302, GROUND - 4)   # the lobby's shop front, beside the garage
    out["P"] = (178, GROUND - 20, 210, GROUND)          # the garage door: the ramp down to the parking
    out["R"] = (BX0, 8, BX1, GROUND - STOREY * len(STOREYS) - 4)   # the roof deck and its crane
    return out


def blockout():
    img = Image.new("RGB", (EW, EH))
    cv = G.Layer(img)
    roof = Image.open(HERE / "picks" / "roof-px.png").convert("RGB")
    smooth = Image.open(CANDIDATES / "roof_400.png").convert("RGB").resize(roof.size, Image.BOX)   # undithered
    for y in range(GROUND):                                          # the roof's own sky, stretched to fit
        cv.rect(0, y, EW, y + 1, smooth.getpixel((192, min(84, y * 85 // 250))))   # a clear column, above the skyline
    sky = roof.crop((140, 84, 464, 104))                             # its skyline, behind the street
    for x in range(0, EW, sky.width):
        img.paste(sky, (x, GROUND - 36))
    for x0, x1, top in NEIGHBOURS:
        cv.rect(x0, top, x1, GROUND, c("sky", 1))
        cv.rect(x0, top, x1, top + 2, c("sky", 2))
        for y in range(top + 8, GROUND - 6, 10):
            for x in range(x0 + 4, x1 - 4, 8):
                cv.rect(x, y, x + 4, y + 5, GLOW_WIN if (x * 3 + y) % 7 < 3 else c("sky", 0))
    top = GROUND - STOREY * len(STOREYS)
    cv.rect(BX0, top, BX1, GROUND, c("wall", 3))                     # the facade
    cv.rect(BX0, top - 4, BX1, top, c("wall", 5))                    # parapet
    cv.rect(BX0 - 2, top - 5, BX1 + 2, top - 4, INK)
    cv.rect(BX0, GROUND - STOREY, BX1, GROUND, c("wall", 2))             # the ground floor's darker base
    for i, key in enumerate(STOREYS):
        y0 = GROUND - STOREY * (i + 1)
        cv.rect(BX0, y0, BX1, y0 + 3, c("wall", 4))                  # floor slab band
        cv.rect(BX0, y0 + 3, BX1, y0 + 4, c("wall", 2))
        for gy, row in enumerate(G.FONT[key]):                       # the floor number beside its window
            for gx, ch in enumerate(row):
                if ch == "#":
                    cv.put(BX0 + 3 + gx, y0 + 11 + gy, c("cream", 5))
    cv.rect(212, GROUND - STOREY, 306, GROUND - STOREY + 3, c("amber", 3))       # the lobby's brass awning
    for x in range(284, 287):                                        # the crane on the roof
        cv.rect(x, 12, x + 1, top - 4, c("amber", 4) if x != 285 else c("amber", 2))
    cv.rect(200, 13, 316, 14, c("amber", 5))                         # the jib: a light top chord,
    cv.rect(200, 16, 316, 17, c("amber", 3))                         # a dark bottom chord, diagonals between
    for x in range(200, 316):
        cv.put(x, 14 if x % 4 in (0, 3) else 15, c("amber", 3))
    cv.rect(306, 17, 316, 22, c("steel", 2))
    cv.rect(240, 17, 241, 34, INK)
    cv.rect(238, 34, 243, 37, c("amber", 3))
    cv.rect(178, GROUND - 27, 210, GROUND - 22, c("grey", 4))          # the garage's sign band, above its frame
    for gy, row in enumerate(G.FONT["P"]):
        for gx, ch in enumerate(row):
            if ch == "#":
                cv.put(192 + gx, GROUND - 27 + gy, c("blue", 4))
    cv.rect(0, GROUND, EW, GROUND + 6, c("grey", 3))                 # pavement, kerb, road
    cv.rect(0, GROUND + 6, EW, GROUND + 7, c("grey", 1))
    cv.rect(0, GROUND + 7, EW, EH, c("dark", 2))
    for x in range(6, EW, 24):
        cv.rect(x, GROUND + 17, x + 10, GROUND + 18, c("grey", 4))
    for x in LAMPS:                                                  # street lamps
        cv.rect(x, GROUND - 40, x + 1, GROUND, c("steel", 1))
        cv.rect(x - 1, GROUND - 45, x + 2, GROUND - 44, INK)            # a lantern with a bright core
        cv.rect(x - 1, GROUND - 44, x + 2, GROUND - 40, c("amber", 4))
        cv.rect(x, GROUND - 43, x + 1, GROUND - 41, c("cream", 5))
    for key, (x0, y0, x1, y1) in windows().items():                  # frames; the glass is filled at build time
        if key != "R":
            cv.rect(x0 - 2, y0 - 2, x1 + 2, y1 + (2 if key != "P" else 0), INK)
            cv.rect(x0, y0, x1, y1, c("amber", 5))
    return img



def paint(count, start, host):
    base = blockout().resize((EW * PAINT, EH * PAINT), Image.NEAREST)
    buf = io.BytesIO()
    base.save(buf, "PNG")
    prompt = ("Edit this picture. Repaint it as a detailed flat 2D side-view video game background in clean cel "
              "shading with bold dark outlines: an eight-storey brick and plaster city building at dusk in the middle "
              "of a street of older neighbouring buildings. Keep every shape exactly where it is: the same storeys, the same long window on every storey, "
              "the same lobby shop front with its awning, the same garage door, the same crane on the roof, the same "
              "neighbouring buildings, street lamps, pavement and road, and the same sunset sky. Add brick texture, "
              "cornices, window sills, a few balcony plants, glowing lamp light on the pavement. No people, no cars, "
              "no text, no letters, no logos.")
    for k in range(count):
        seed = start + 17 * k
        path = CANDIDATES / f"street{len(STOREYS)}_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        res = call(host, "/sdapi/v1/img2img", {"prompt": prompt, "width": base.width, "height": base.height, "seed": seed,
                                               "batch_size": 1, "strength": 1.0, "init_images": [base64.b64encode(buf.getvalue()).decode()]})
        path.write_bytes(base64.b64decode(res["images"][0].split(",")[-1]))
        print("painted", path.name, flush=True)


def street(tower=True):
    """The street without its windows' rooms; without the tower, its lot is built up with the neighbours' blocks."""
    blk = blockout()
    if PICK is None:
        art = blk.copy()
    else:
        art = pixelate(Image.open(CANDIDATES / f"street9_{PICK}.png").convert("RGB"), (EW, EH), 40)
        art = dither_bands(art, 150, 4)                                  # the sky above the neighbours
        px, top = art.load(), GROUND - STOREY * len(STOREYS)
        for x in range(BX0 - 4, BX1 + 4):                                # the painting's top storey goes: its cornice
            for y in range(top + 3, -1, -1):                             # comes down a storey, sky where it stood
                px[x, y] = px[x, y - STOREY] if y >= top - 5 else px[76 + x % 4, y]
        boxes = [(x0 - 2, y0 - 2, x1 + 2, y1 + 2) for key, (x0, y0, x1, y1) in windows().items() if key != "R"]
        boxes += [(BX0 + 2, GROUND - STOREY * (i + 1) + 10, BX0 + 7, GROUND - STOREY * (i + 1) + 17)
                  for i in range(len(STOREYS))]                          # and the floor numbers beside them
        boxes += [(212, GROUND - 31, 306, GROUND - 24), (178, GROUND - 27, 211, GROUND - 22)]   # awning, P sign
        px = art.load()
        for x0, x1, top in NEIGHBOURS:                                   # flat walls under the cornice (wiping the
            wall = max(art.crop((x0, top + 8, x1, GROUND)).getcolors(1 << 16))[1]   # painted halo blobs), a window grid
            for y in range(top + 7, GROUND):
                for x in range(x0, x1):
                    if px[x, y] != INK or x0 + 2 <= x < x1 - 2:          # keeping the outlines
                        px[x, y] = wall
            boxes += [(x, y, x + 4, y + 5) for y in range(top + 8, GROUND - 6, 10) for x in range(x0 + 4, x1 - 4, 8)]
        for box in boxes:                                                # the blockout's frames stay exactly put
            art.paste(blk.crop(box), box[:2])
    px = art.load()
    infill = () if tower else tuple((x0, x1, NEIGHBOURS[n][2]) for x0, x1, n in INFILL)
    for x0, x1, n in () if tower else INFILL:
        sx0, sx1, top = NEIGHBOURS[n]
        seam = x0 + (x1 - x0) // 16 * 8                                  # on a wall column, so the window grid runs on
        for x in range(x0, x1):
            sx = sx0 + x - x0 if x < seam else sx1 - x1 + x
            for y in range(GROUND + 1):
                if y >= top - 3:
                    px[x, y] = px[sx, y]
                elif BX0 - 2 <= x < BX1 + 2 or y < 150:                  # sky where the tower stood, from a clear
                    px[x, y] = px[76 + x % 4, y]                         # column down to the lowest roof
    if PICK is not None:
        def glow(x, y, col, cy, r):                                      # a 3-step Bayer ramp toward the lamp light
            d = min(((x - lx) ** 2 + (y - cy) ** 2) ** 0.5 for lx in LAMPS)
            lv = min(3, int((1 - d / r) * 3 + G.BAYER[y % 4][x % 4] / 16))
            return col if lv <= 0 else tuple(round(v + (g - v) * (0, 0.35, 0.65, 0.95)[lv]) for v, g in zip(col, c("amber", 5)))

        for x0, x1, top in NEIGHBOURS + infill:                          # the lamps' halos, on wall pixels only
            for y in range(top + 3, GROUND):
                for x in range(x0, x1):
                    if px[x, y] not in (INK, GLOW_WIN, c("sky", 0)):
                        px[x, y] = glow(x, y, px[x, y], GROUND - 43, 32)
        for x in LAMPS:                                                  # the blockout's lamps, over their light
            art.paste(blk.crop((x, GROUND - 40, x + 1, GROUND)), (x, GROUND - 40))
            art.paste(blk.crop((x - 1, GROUND - 45, x + 2, GROUND - 40)), (x - 1, GROUND - 45))
        for x in range(196, 322):                                        # the crane, on the painting's own sky
            for y in range(6, GROUND - STOREY * len(STOREYS) - 5):       # (its dither repeats every 4 px)
                col = blk.getpixel((x, y))
                px[x, y] = col if tower and col != blk.getpixel((0, y)) else px[x % 4, y]
        for x0, y0 in ((166, 272), (311, 280)) if tower else ():         # the slots beside the ground floor
            for y in range(y0 + 1, GROUND):
                for x in range(x0, x0 + 3):
                    px[x, y] = px[x, y0]
        for x in range(EW):                                              # pavement, kerb, road: flat rows, so the
            for y in range(GROUND + 1, EH):                              # street tiles sideways and fills below
                d = min(abs(x - lx) for lx in LAMPS)
                b = G.BAYER[y % 4][x % 4] / 16
                if y < GROUND + 6:                                       # slabs, lit under the lamps
                    col = glow(x, y, c("wall", 4), y, 30)
                    col = c("cream", 1) if x % 24 == 0 else col
                elif y < GROUND + 8:
                    col = c("cream", 2) if y == GROUND + 6 else c("wall", 3)
                elif y == GROUND + 8:
                    col = INK
                elif y < GROUND + 16 and (1 - d / 7) * (1 - (y - GROUND - 9) / 7) > b:
                    col = c("amber", 2)                                  # the lamps' reflections
                elif y == GROUND + 17 and (x - 6) % 24 < 10:
                    col = c("grey", 4)
                else:
                    col = c("dark", 2)
                px[x, y] = col
    return art


def build(out):
    art = street()
    wins = windows()
    strip = Image.new("RGB", (EW * G.FRAMES, EH))
    missing = [f"floor-{k}.png" for k in LOOK if k != "R" and not (out / f"floor-{k}.png").exists()]
    if missing:
        sys.exit(f"missing floor strips in {out}: {', '.join(missing)} (build the floors first: gen_floors.py)")
    floors = {k: Image.open(out / f"floor-{k}.png").convert("RGB") for k in LOOK if k != "R"}
    for f in range(G.FRAMES):
        img = art.copy()
        for key, (x0, y0, x1, y1) in wins.items():
            if key == "R":
                continue
            sx, sy = LOOK[key]
            img.paste(floors[key].crop((f * G.W + sx, sy, f * G.W + sx + x1 - x0, sy + y1 - y0)), (x0, y0))
        strip.paste(img, (f * EW, 0))
    strip.save(out / "exterior.png")
    (out / "exterior.json").write_text(json.dumps({"size": [EW, EH], "windows": wins}))
    street(tower=False).save(out / "backdrop.png")                       # the other pages' scene: one still frame
    print("drew exterior", "from blockout" if PICK is None else f"from seed {PICK}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["blockout", "paint", "build"])
    ap.add_argument("out", nargs="?", default="static/building/pixel")
    ap.add_argument("--count", type=int, default=4)
    ap.add_argument("--start", type=int, default=400)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    a = ap.parse_args()
    if a.cmd == "blockout":
        blockout().resize((EW * 3, EH * 3), Image.NEAREST).save(Path(a.out) / "exterior-blockout.png")
        print("wrote", Path(a.out) / "exterior-blockout.png")
    elif a.cmd == "paint":
        paint(a.count, a.start, a.host)
    else:
        build(Path(a.out))
