# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4", "torch==2.8.0", "transformers==4.56.1"]
# ///
"""The city's depth map: how near each art pixel is, so the city's walkers and cars (web3d/src/city-fx.js) hide behind
the trees, lamp posts and walls in front of them. One map serves every hour, as the hours share the dusk pick's geometry.

Run: uv run web3d/pixel/city_depth.py   # writes web3d/pixel/paintings/picks/city-depth.png

Depth Anything V2 (small) on the dusk pick, cropped as the bake crops it, in overlapping tiles so the wide panorama keeps
its detail, then box-reduced to the art's size: 8-bit, brighter = nearer. The map is committed with the picks, so
gen_city.py build (and CI) copies it and never needs torch; rerun this only when the dusk pick changes.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from transformers import pipeline

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_city import PH, PICKED, PW, SIZE, pick  # noqa: E402

TILE, STEP = PH, 640   # the model sees about 518 px, so square tiles the painting's height, overlapping

src = Image.open(pick("dusk")).convert("RGB").crop((0, 0, PW, PH))
est = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf")
acc, cnt = np.zeros((PH, PW)), np.zeros((PH, PW))
for x in [*range(0, PW - TILE, STEP), PW - TILE]:
    d = np.asarray(est(src.crop((x, 0, x + TILE, PH)))["predicted_depth"].squeeze(), dtype=float)
    d = np.asarray(Image.fromarray(d).resize((TILE, PH), Image.BILINEAR))
    acc[:, x:x + TILE] += (d - d.min()) / (d.max() - d.min())   # each tile normalised: the model gives relative depth only
    cnt[:, x:x + TILE] += 1
out = PICKED / "city-depth.png"
Image.fromarray((acc / cnt * 255).astype(np.uint8)).resize(SIZE, Image.BOX).save(out)
print("wrote", out)
