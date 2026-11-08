# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Mend a fault in a picked painting without repainting it: the model edits a crop round the fault, and only the fault,
under a feathered mask, goes back on the painting (#304).

Run: uv run web3d/pixel/patch_picks.py paint NAME [--count N] [--start S]   # crop candidates (Draw Things, port 7860)
     uv run web3d/pixel/patch_picks.py pick NAME [--seed S]                 # the chosen one into picks/NAME.png

A patch is an RGBA crop, picks/NAME.png: the candidate's pixels, toned to the painting round the mask (the model shifts a
crop's tone as a whole), with the feathered mask as its alpha, and the place it was cut from as its PNG's "at" text. The
bakes that list it paste it there over their painting (art_common.patched): install_picks.PATCHES, gen_rooms.PATCHES,
gen_workshop.PATCHES. Candidates go to paintings/candidates/<stem>_<seed>.png, kept, never repainted, as paint_rooms' are.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from PIL.PngImagePlugin import PngInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_common import CANDIDATES, PICKS, paint_candidate  # noqa: E402

STYLE = "in the same painterly video game style and the same light. No people, no text, no letters, no numbers, no logos."
JIB = ("Edit this picture. Below the crane's jib and the moon, a second long thin horizontal steel lattice truss floats "
       "across the night sky with nothing holding it: take that floating truss away completely and paint open dark blue "
       "night sky with small stars where it was. Keep the tower crane's own jib above it, its hook and cable, the moon, the "
       "scaffolding and its poles exactly as they are, " + STYLE)
PENDANT = ("Edit this picture. Two pendant lamps hang side by side here, and the second, fainter one behind and to the right "
           "of the first is a mistake: take away that second lamp, its shade and its cord completely, so only the first lamp "
           "hangs there, and paint the plain warm plaster wall where the second was, with the first lamp's warm glow. Keep "
           "the first lamp exactly as it is, " + STYLE)
OFF_AIR = ("Edit this picture. The round on-air lamp on the wall is switched off: its round glass is dark, unlit deep maroon "
           "red with only a soft dull reflection, in its dark metal rim, and it gives no light at all, so the wall round it "
           "is plain warm plaster with no red or orange glow, lit only by the room's lamps. Keep the standing lamp below it, "
           "the shelves, the tape recorder and the acoustic panels exactly as they are, " + STYLE)
TREE = ("Edit this picture. A tall snowy tree stands in the sky behind the roofs between the second and third workshops, "
        "where no tree grows: take that tree away completely, trunk and branches, and continue the {} sky and the snowy "
        "hills behind the roofs across where it was. Keep the workshops, their sawtooth glass roofs, the alley, the lamp "
        "posts and the snow on the roofs exactly as they are, " + STYLE)
VAN = ("Edit this picture. Deep winter, {}: fresh white snow lying on the parked white delivery van's roof and bonnet, snow "
       "on the crates and banked along the kerb. Keep the van exactly its shape, its size and where it stands, its wheels on "
       "the street, the crates, the tree and the brick wall where they are, " + STYLE)
ROW_LIGHT = {   # gen_workshop's hours, as the van's prompt names them
    "dusk": "golden dusk: a purple and peach sunset sky, warm golden light, the street lamps and the workshops glowing",
    "dawn": "early dawn, just before sunrise: a cool pale blue and soft pink sky, the first pale light on the brick, soft "
            "long shadows, the street lamps and a few workshop lights still lit",
    "day": "a bright clear midday: a clear blue sky, strong high sunlight on the red brick, crisp short shadows",
    "night": "night: a dark deep blue sky with a few stars, every street lamp glowing on the cobbles, the brick dark and lit only by lamplight",
}


def boxes(*bs, feather, ellipse=False):
    def mask(size):
        m = Image.new("L", size)
        d = ImageDraw.Draw(m)
        for b in bs:
            (d.ellipse if ellipse else d.rectangle)(b, fill=255)
        return m.filter(ImageFilter.GaussianBlur(feather))
    return mask


def row(phase, winter=False):
    return PICKS / f"workshop{'-winter' if winter else ''}{'' if phase == 'dusk' else '-' + phase}.png"


def van_mask(size, grow=2):
    """The van as the shared depth map has it (nearer than 145 in its box, grown by `grow` art px), at the painting's size."""
    d = Image.open(PICKS / "workshop-depth.png").convert("L")
    m = d.crop((1200, 205, 1400, 289)).point(lambda v: 255 * (v >= 145))
    full = Image.new("L", d.size)
    full.paste(m, (1200, 205))
    return full.filter(ImageFilter.MaxFilter(2 * grow + 1)).resize(size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(2))


def van_base(phase):
    """The winter pick with the hour's plain van pasted in under the depth map's van, which the model then snows on: the
    winter edit had painted the van longer than the depth map has it."""
    winter = Image.open(row(phase, True)).convert("RGB")
    winter.paste(Image.open(row(phase)).convert("RGB"), (0, 0), van_mask(winter.size))
    return winter


# NAME (its picks/NAME.png): the painting it lands on, the candidates' stem, the crop the model sees, the prompt, the
# picked seed, the mask (a function of the painting's size), what the model starts from if not the painting (`init`),
# and whether the patch is toned to what it replaces (`inside`: the van keeps the hour's light) or to what is round it.
# Painting px.
TREE_BOX, VAN_BOX = (1408, 0, 2112, 448), (2816, 384, 3392, 768)


def tag(ph):
    return "" if ph == "dusk" else "-" + ph


PATCH = {
    "roof-night-jib": dict(src=CANDIDATES / "roof_1100-night_1017.png", stem="roof_1100-night_1017-jib", box=(896, 0, 1792, 576),
                           prompt=JIB, seed=1017, mask=boxes((1020, 256, 1755, 304), feather=3)),
    "inuitive-pendant": dict(src=CANDIDATES / "inuitive_1134.png", stem="inuitive_1134-pendant", box=(704, 0, 1088, 384),
                             prompt=PENDANT, seed=1017, mask=boxes((836, 0, 908, 140), (830, 125, 1000, 360), feather=10)),
    "radio-off-air": dict(src=PICKS / "radio.png", stem="radio-off", box=(320, 0, 832, 384), prompt=OFF_AIR, seed=1500,
                          mask=boxes((462, 60, 690, 268), feather=10, ellipse=True)),
    **{f"workshop-winter{tag(ph)}-tree": dict(src=row(ph, True), stem=f"workshop-winter{tag(ph)}-tree", box=TREE_BOX,
                                              prompt=TREE.format(ph), seed=717, mask=boxes((1530, 0, 1990, 330), feather=6))
       for ph in ("dusk", "dawn")},
    **{f"workshop-winter{tag(ph)}-van": dict(src=row(ph, True), stem=f"workshop-winter{tag(ph)}-van", box=VAN_BOX,
                                             prompt=VAN.format(ROW_LIGHT[ph]), seed=700, mask=van_mask, init=lambda ph=ph: van_base(ph),
                                             inside=True)
       for ph in ("dusk", "dawn", "day", "night")},
}


def paint(name, count, start, host):
    p = PATCH[name]
    init, box = (p["init"]() if "init" in p else Image.open(p["src"]).convert("RGB")).crop(p["box"]), p["box"]
    for k in range(count):
        seed = start + 17 * k
        paint_candidate(CANDIDATES / f"{p['stem']}_{seed}.png", p["prompt"], (box[2] - box[0], box[3] - box[1]), seed, host, init)


def toned(cand, orig, keep):
    """Each channel of cand fitted (mean and spread) to orig's over `keep` (a bool array)."""
    a, b = np.asarray(cand).astype(float), np.asarray(orig).astype(float)
    for c in range(3):
        x, y = a[..., c][keep], b[..., c][keep]
        a[..., c] = (a[..., c] - x.mean()) * (y.std() / max(x.std(), 1e-3)) + y.mean()
    return Image.fromarray(a.clip(0, 255).round().astype(np.uint8))


def pick(name, seed):
    """picks/NAME.png: the candidate, toned, with the mask as alpha, cut to where the mask is, and where it goes."""
    p = PATCH[name]
    base, box = Image.open(p["src"]).convert("RGB"), p["box"]
    m = p["mask"](base.size).crop(box)
    cand = Image.open(CANDIDATES / f"{p['stem']}_{seed or p['seed']}.png").convert("RGB")
    patch = toned(cand, base.crop(box), np.asarray(m) >= 248 if p.get("inside") else np.asarray(m) < 8)
    patch.putalpha(m)
    bbox = m.getbbox()
    meta = PngInfo()
    meta.add_text("at", f"{box[0] + bbox[0]},{box[1] + bbox[1]}")   # what art_common.patched reads
    patch.crop(bbox).save(PICKS / f"{name}.png", pnginfo=meta)
    print("wrote", PICKS / f"{name}.png", "at", (box[0] + bbox[0], box[1] + bbox[1]))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["paint", "pick"])
    ap.add_argument("name", choices=sorted(PATCH))
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--start", type=int, default=1000)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    a = ap.parse_args()
    if a.cmd == "paint":
        paint(a.name, a.count, a.start, a.host)
    else:
        pick(a.name, a.seed)
