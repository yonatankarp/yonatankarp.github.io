# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Paint floor candidates with the local model in Draw Things (HTTP API, Settings > API Server, port 7860).

Run: uv run web3d/pixel/paint_rooms.py <room> [--count N] [--start SEED] [--host URL]
     uv run web3d/pixel/paint_rooms.py capsule [--count N] [--start SEED]   # floor 7's payment, on magenta (gen_floors keys it)
     uv run web3d/pixel/paint_rooms.py receptionists   # the lobby's two, each pose at its person's seed (gen_floors bakes them)
     uv run web3d/pixel/paint_rooms.py retime --src <pick>.png --time dawn|day|night   # the roof at another hour
     uv run web3d/pixel/paint_rooms.py winter --src <pick>.png [--start 700]   # the roof's pick under snow, its hour kept
     uv run web3d/pixel/paint_rooms.py door --time dawn|day|night | --winter [--time PHASE]   # the lobby's door view (DOOR)
     uv run web3d/pixel/paint_rooms.py door --time PHASE [--winter] --pick SEED          # ... the pick, into picks/
     uv run web3d/pixel/paint_rooms.py entrance [--time PHASE] [--winter] [--count N] [--start S]   # the lobby's glass doors, open
     uv run web3d/pixel/paint_rooms.py entrance --time PHASE [--winter] --pick SEED     # ... the pick, into picks/

Every floor continues the lift lobby: the base image is the picked lobby painting on the left with its plain wall,
skirting and plank floor carried across the whole width, and the model *edits* it, keeping all of that and
furnishing the space right of the lift with the room's objects. The lobby is an edit of the old one, so its lift stays
where it was. retime paints the roof's dusk pick at another hour, and winter paints any hour's roof in deep winter; door
paints the lobby's view through its glass door at another hour, or in winter, from a crop round the door alone.

Writes web3d/pixel/paintings/candidates/<room>_<seed>.png (retime: <pick>-<time>_<seed>.png, winter: <pick>-winter_<seed>.png, door: reception-door[-winter][-<time>]_<seed>.png). Existing candidates are
kept, never repainted: the model does not redraw a seed bit for bit, so a picked candidate is the input of later steps.
The model runs at guidance 1, so prompts say what to show; negative prompts do nothing. Draw Things runs one job at a
time.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from art_common import CANDIDATES as OUT, PAINTINGS as HERE, paint_candidate
from install_picks import ENTRANCE_CROP, LOBBY, painting, snowed

# The art standard (the city's): painterly, art 928 x 308 at about 2.5 painting pixels each. Every room is painted from
# the lobby, an edit of the first one (OLD_LOBBY, cel-shaded), so the lift stayed where the floors' code has it.
FLOOR_SIZE = (2304, 768)
LOBBY_SIZE = (704, 768)       # the lobby alone: art 264 x 308 px
OLD_LOBBY = "lobby_100.png"


def lobby_edge(h):
    """Where the lobby ends and its room begins in a floor's painting h px tall: the lobby is 264 x 308 art px."""
    return round(h * 132 / 154)

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
# The other hours: an edit of the dusk pick that changes only the light, on the roof the whole picture (the lobby's
# door is edited on its own: DOOR).
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
# Winter: an edit of an hour's pick that keeps its light and adds only snow; at night its lamps and windows kept too. On
# the roof the whole picture (the lobby's door: DOOR_WINTER).
SNOW = {"roof": "fresh white snow lying on the rooftop, along the top of the parapet, on the stacked steel beams and "
                "planks, the scaffolding's boards and the crane's jib, and on the roofs of the distant city, a cold blue-grey sea"}
# Asked only to keep "the time of day", the model painted winter as an overcast day: so each hour's sky and light is named.
LIGHT = HOURS | {"dusk": "golden dusk: a purple-to-peach sunset sky with soft clouds, the low sun glowing on the sea at the "
                         "horizon, warm golden light on everything"}
WINTER = ("Edit this picture. Keep everything exactly as it is: every building, object, shape, material and where it "
          "stands, the same painterly style and the same view. Keep the time of day exactly as it is, {1}, with the same "
          "sky and the same light, and change only the season to deep winter: {0}. Keep the lift housing on the left "
          "exactly as it is, dry, with no snow: it is indoors. No people, no text, no letters, no numbers, no logos.")
WINTER_NIGHT = ("Edit this picture. Keep everything exactly as it is: every building, object, shape, material and where it "
                "stands, the same painterly style and the same view. Keep it night and change only the season to deep "
                "winter: {0}, the snow blue in the moonlight and warm under the lamps. Keep every lit window and lamp. Keep "
                "the lift housing on the left exactly as it is, dry, with no snow: it is indoors. "
                "No people, no text, no letters, no numbers, no logos.")
# The lobby's other hours and its winter: an edit of only the crop round its glass door (ENTRANCE_CROP), which names the
# street seen through it so the model keeps it (asked to change only the light in the whole room, it painted another
# street at every hour). It runs at strength 1.0: lower, this model barely changes the picture. install_picks takes only
# the glass from it. Winter is the dusk crop under snow, then each hour that winter retimed, so the snow lies the same at
# every hour. Candidates: candidates/reception-door[-winter][-PHASE]_SEED.png; the pick: picks/reception-door[-winter][-PHASE].png.
STREET = ("the brick building across the street with its dark shop window, its hanging sign and the lettering over the "
          "shop, the street lamp on the corner, the road with its painted line and the paved pavement")
DOOR_SNOW = ", all under fresh white snow lying on the road, the pavement and the ledges"
DOOR_LIGHT = {
    "dawn": "early dawn: a soft pink and gold first light on the brick facade, cool lilac shadows, true colours, the street "
            "lamp and the sign unlit, the shop window dark",
    "day": "a clear sunny afternoon: warm sunlight and soft shadows on the red brick facade, true deep colours, nothing "
           "washed out or overexposed, the street lamp and the sign unlit, the shop window dark",
    "night": "night: the street lit by the warm street lamp and the glowing hanging sign, their warm light pooling on the "
             "brick facade and the pavement, the rest in deep blue moonlight with the brickwork, windows and shop front still "
             "clearly visible, a warm lit window upstairs",
}
DOOR = ("Edit this picture. Keep the room exactly as it is: every object, shape and material, the bronze door frame, its "
        "handles and bars, its own warm lamps and their light, the same painterly style. Keep the street seen outside "
        "through the glass entrance door exactly as it is, the very same place: {}, every one of them in the same place "
        "with the same shape. Change only the time of day out there, to {}. No people, no text, no letters, no numbers, "
        "no logos.")
DOOR_WINTER = ("Edit this picture. Keep the room exactly as it is: every object, shape and material, the bronze door frame, "
               "its handles and bars clean and dry, its own warm lamps and their light, the same painterly style. Keep the "
               "street seen outside through the glass entrance door exactly as it is, the very same place: " + STREET +
               ", every one of them in the same place with the same shape, and keep its dusk light, the street lamp and the "
               "hanging sign glowing warm. Change only the season out there to deep winter: fresh white snow lying on the "
               "road, the pavement, the shop's ledge and sills and the top of the sign, the snow lit warm by the lamps. No "
               "snow on this side of the glass. No people, no text, no letters, no numbers, no logos.")


def door_prompt(phase, winter):
    if phase == "dusk":
        return DOOR_WINTER if winter else None
    if winter:
        return DOOR.format(STREET + DOOR_SNOW, DOOR_LIGHT[phase] + ", the snow lit by it")
    return DOOR.format(STREET, DOOR_LIGHT[phase])


# Floor 7's payment, which gen_floors.py keys off its magenta and pixel.js draws riding the room's copper pipe: painted from a
# flat 10:3 capsule on magenta (capsule_pose), at the picked seed 3100.
CAPSULE_SIZE = (768, 384)
CAPSULE = (
    "Edit this picture. Repaint the shape as one brass pneumatic tube post capsule lying horizontally, seen exactly from the "
    "side: a polished brass cylinder with rounded domed brass end caps and one coral red band round its middle, highly "
    "detailed painterly video game art, warm golden lamp light from above, soft shading, a bright specular highlight along "
    "its top. Keep the exact shape, position and size. Keep the background perfectly flat solid magenta. One object only, "
    "no text, no shadow."
)


def capsule_pose():
    im = Image.new("RGB", CAPSULE_SIZE, (255, 0, 255))
    d = ImageDraw.Draw(im)
    x0, x1, y0, y1 = 184, 584, 132, 252                                  # a 400 x 120 capsule, 10:3
    d.rounded_rectangle([x0, y0, x1, y1], radius=56, fill=(196, 150, 70))
    d.rectangle([360, y0, 408, y1], fill=(214, 96, 80))                  # the coral band
    d.rectangle([x0 + 50, y0 + 14, x1 - 50, y0 + 26], fill=(246, 222, 160))   # its highlight
    return im


# The lobby's two receptionists, behind its desk (gen_floors.py bakes them, pixel.js draws them): upper bodies seen from the
# front, in each of DESK_POSES, painted from a skeleton on magenta (desk_pose), one seed per person, into
# candidates/reception/NAME_POSE.png; the picks are picks/reception/NAME_POSE.png.
DESK_SIZE, DESK_U = (512, 768), 20.0   # a frame; pixels per skeleton unit (a person ~36 units; the top 22 are drawn)
DESK_TOP = 600                         # the desk's top edge in the frame
DESK_POSES = ["idle", "write", "left", "right"]
RECEPTIONISTS = {   # name: (seed, top colour, how they look)
    "ana": (4100, (40, 52, 90), "a woman in her thirties with dark brown hair in a neat low bun, a navy blazer over a "
            "white blouse, small gold earrings"),
    "ben": (4117, (120, 52, 48), "a man in his forties with short greying hair, a trimmed beard and round glasses, a "
            "burgundy cardigan over a light blue shirt"),
}
DESK_ACTION = {
    "idle": "standing behind a reception desk facing the viewer, hands resting on the desk, a friendly look",
    "write": "standing behind a reception desk, head bowed, writing with a pen in an open ledger on the desk",
    "left": "standing behind a reception desk, head and shoulders turned to their left (the viewer's left), looking that way",
    "right": "standing behind a reception desk, head turned to their right (the viewer's right), looking that way",
}
DESK_PROMPT = (
    "Edit this picture. Repaint the figure as one hotel lobby receptionist, upper body, {action}, seen from the front, "
    "in highly detailed painterly video game art: {look}, natural proportions, warm golden light from the left, soft "
    "shading. Keep the exact pose, the exact position and size of the head, shoulders and arms, and the desk's top edge "
    "exactly where it is. Keep the background perfectly flat solid magenta above the desk. One person only. No lamp, no "
    "ceiling, no light fixture: flat magenta all round and above the head. No text."
)


def desk_pose(kind, top):
    """A receptionist's skeleton in one pose: torso, neck, head and hair, the arms down to the hands on the desk."""
    (w, h), u = DESK_SIZE, DESK_U
    im = Image.new("RGB", (w, h), (255, 0, 255))
    d = ImageDraw.Draw(im)

    def limb(a, b, width, col):
        d.line([a, b], fill=col, width=int(width * u))
        r = width * u / 2
        for x, y in (a, b):
            d.ellipse([x - r, y - r, x + r, y + r], fill=col)

    cx, y0 = w / 2, 3 * u                                        # the crown at unit 0 (+ a margin)
    turn = {"left": -1, "right": 1}.get(kind, 0)
    hx, hy = cx + turn * 1.2 * u, y0 + (4.2 if kind == "write" else 3.4) * u
    sh_y = y0 + 9.5 * u
    half = (5.2 if turn == 0 else 4.4) * u                       # the torso, narrower when turned
    d.polygon([(cx - half, sh_y), (cx + half, sh_y), (cx + half * .82, DESK_TOP + 2 * u), (cx - half * .82, DESK_TOP + 2 * u)], fill=top)
    skin, hair = (225, 180, 145), (60, 40, 28)
    d.rectangle([cx - 1.2 * u, sh_y - 1.6 * u, cx + 1.2 * u, sh_y + .5 * u], fill=skin)      # the neck
    d.ellipse([hx - 3.1 * u, hy - 3.6 * u, hx + 3.1 * u, hy + 3.6 * u], fill=skin)            # the head
    d.chord([hx - 3.3 * u, hy - 3.9 * u, hx + 3.3 * u, hy + 3.2 * u], 180, 360, fill=hair)   # hair over the crown
    dark = tuple(int(v * .8) for v in top)
    for side in (-1, 1):
        s = (cx + side * (half - .8 * u), sh_y + 1 * u)
        if kind == "write" and side == 1:                     # the writing hand on the ledger, in front
            e, hand = (cx + 5 * u, DESK_TOP - 4 * u), (cx + 1.5 * u, DESK_TOP - .3 * u)
        else:                                                  # resting on the desk
            e, hand = (cx + side * (half + .6 * u), DESK_TOP - 7 * u), (cx + side * (half + 1.4 * u), DESK_TOP - .3 * u)
        limb(s, e, 2.6, dark if turn and side == -turn else top)
        limb(e, hand, 2.2, top)
        limb(hand, (hand[0], hand[1] + .4 * u), 2, skin)
    d.rectangle([0, DESK_TOP, w, h], fill=(110, 70, 40))           # the desk, so the hands rest on it
    d.rectangle([0, DESK_TOP, w, DESK_TOP + .6 * u], fill=(150, 100, 60))
    return im


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


# The lobby's glass entrance standing open: the way in from the city (city.js, pixel.js). Each hour's (and each winter
# hour's) is an edit of the crop round the doors of that hour's shut lobby (install_picks.painting()), asked to slide the
# leaves aside and keep the street seen through them (ENTRANCE_PROMPT). The pick goes back under a tight mask on the
# doorway, and only the doorway and a margin are kept: picks/reception-open[-winter][-PHASE].png, which gen_floors.py bakes
# into floor-L-open[-winter][-PHASE].webp.
ENTRANCE = (1990, 212, 2232, 735)        # painting px: the doorway, under the transom and between the frame's posts
ENTRANCE_SILL = 36                       # painting px: how much higher the doorway's sill is at its left than its right
ENTRANCE_KEEP = (1976, 200, 2248, 748)   # painting px: what is kept, the doorway and a margin for the box filter
ENTRANCE_PROMPT = (
    "Edit this picture. The tall glass entrance doors on the right slide wide open: their two glass leaves slide sideways "
    "into the bronze frame, one to the left edge and one to the right edge of the doorway, leaving an empty opening between "
    "them with no glass, no handles and no bars. Keep everything seen through the doorway exactly as it is, the very same "
    "place: {}, every one in the same place with the same shape and the same light. Keep the bronze door frame, the "
    "transom window above it, the wall, the palm, the skirting board and the wooden floor exactly as they are, in the same "
    "painterly style and the same warm lamp light inside. No people, no text, no letters, no numbers, no signs, no logos.")


def tag(phase, winter=False):
    """A lobby hour's file suffix: -winter, -dawn, -winter-night, or none at dusk."""
    return f"{'-winter' if winter else ''}{'' if phase == 'dusk' else '-' + phase}"


def shut_lobby(phase, winter=False):
    """The lobby's painting at an hour, as install_picks bakes it."""
    return painting(f"reception{tag(phase, winter)}")


def entrance_pick(phase, seed, winter=False):
    """The picked candidate back into the shut crop under a tight mask on the doorway; the doorway and a margin kept."""
    shut = shut_lobby(phase, winter)
    crop = shut.crop(ENTRANCE_CROP)
    x0, y0, x1, y1 = (v - o for v, o in zip(ENTRANCE, ENTRANCE_CROP[:2] * 2, strict=True))
    mask = Image.new("L", crop.size)
    ImageDraw.Draw(mask).polygon([(x0, y0), (x1, y0), (x1, y1), (x0, y1 - ENTRANCE_SILL)], fill=255)   # the sill falls to the right
    painted = Image.open(OUT / f"reception-open{tag(phase, winter)}_{seed}.png").convert("RGB")
    if phase == "night":   # the model lights it brighter and bluer than the shut view: put it in that view's light
        painted = lit_as(painted, crop, snowed("reception", shut).crop(ENTRANCE_CROP))
    out = Image.composite(painted, crop, mask.filter(ImageFilter.GaussianBlur(1)))
    keep = [v - o for v, o in zip(ENTRANCE_KEEP, ENTRANCE_CROP[:2] * 2, strict=True)]
    path = HERE / "picks" / f"reception-open{tag(phase, winter)}.png"
    out.crop(keep).save(path)
    print("wrote", path)


def lit_as(img, ref, mask):
    """img in ref's light: an affine colour map from img to ref, fitted by least squares over the mask (the shut glass,
    which shows the same street), applied to all of img."""
    a, b = np.asarray(img, dtype=np.float64), np.asarray(ref, dtype=np.float64)
    m = np.asarray(mask) > 200
    feats = lambda x: np.concatenate([x.reshape(-1, 3), np.ones((x.size // 3, 1))], 1)
    M, *_ = np.linalg.lstsq(feats(a[m]), b[m], rcond=None)
    return Image.fromarray((feats(a) @ M).reshape(a.shape).clip(0, 255).round().astype(np.uint8))


def floor_base(size=FLOOR_SIZE):
    """The lobby on the left, its plain wall, skirting and floor (a strip from its edge) carried rightwards."""
    name, box = LOBBY
    lobby_w = lobby_edge(size[1])
    lobby = Image.open(OUT / name).convert("RGB").crop(box).resize((lobby_w, size[1]), Image.LANCZOS)
    # a painterly wall tiled reads as stripes, and as a corner at the lobby's edge: carry each row's colour on
    plain = lobby.crop((lobby_w - 40, 0, lobby_w, size[1])).resize((1, size[1]), Image.BOX)
    base = Image.new("RGB", size)
    for x in range(lobby_w, size[0], plain.width):
        base.paste(plain, (x, 0))
    base.paste(lobby, (0, 0))
    return base


# What every painting was made with, sent with each job: Draw Things otherwise paints with whatever is loaded.
PINNED = {"model": "flux_2_klein_9b_q6p.ckpt", "steps": 4, "sampler": "UniPC Trailing", "shift": 3.124163866043091,
          "guidance_scale": 1, "seed_mode": "Scale Alike", "loras": [], "controls": [], "hires_fix": False,
          "tiled_decoding": False, "tiled_diffusion": False}


def band(size, x1, y1, feather=40):
    """The mask of the wall next to the lift: full from the lobby's edge to x1 - 40 and down to y1 - 20, fading out
    over 40 px to the right and 20 below, and in over `feather` px of the lobby's wall on the left."""
    x0 = lobby_edge(size[1])
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
    x0 = lobby_edge(src.height)
    fill = src.copy()
    if side == "lobby":
        strip = src.crop((x0 - 100, 0, x0, src.height))
        for i, x in enumerate(range(x0, x1, 100)):
            fill.paste(strip.transpose(Image.FLIP_LEFT_RIGHT) if i % 2 == 0 else strip, (x, 0))
        return Image.composite(fill, src, band(src.size, x1, y1))
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
    x0, fill = lobby_edge(src.height), src.copy()
    fill.paste(src.crop((0, y1, src.width, 2 * y1)).transpose(Image.FLIP_TOP_BOTTOM), (0, 0))
    mask = Image.new("L", src.size)
    px = mask.load()
    for y in range(y1 + 20):
        for x in range(x0, x1):
            px[x, y] = round(255 * min(1, (y1 + 20 - y) / 20, (x1 - x) / 20))
    return Image.composite(fill, src, mask)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("room", choices=["lobby", "cab", "capsule", "receptionists", "roof", "retime", "winter", "wall", "entrance", "door", *sorted(ROOMS)])
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--start", type=int, default=1000)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    ap.add_argument("--src", help="retime: the dusk pick, a candidate's file name (roof_1017.png); winter: any hour's")
    ap.add_argument("--time", choices=sorted(HOURS) + ["dusk"], help="retime, entrance, door: the hour to paint it at")
    ap.add_argument("--winter", action="store_true", help="entrance, door: the lobby's hour in winter")
    ap.add_argument("--pick", type=int, help="entrance, door: the candidate to keep")
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
    if args.room == "entrance":   # reception-open[-winter][-<time>]_<seed>.png, or the pick into picks/
        phase = args.time or "dusk"
        if args.pick is not None:
            return entrance_pick(phase, args.pick, args.winter)
        base, t = shut_lobby(phase, args.winter).crop(ENTRANCE_CROP), tag(phase, args.winter)
        prompt = ENTRANCE_PROMPT.format(STREET + (DOOR_SNOW if args.winter else ""))
        jobs = [(OUT / f"reception-open{t}_{args.start + 17 * k}.png", prompt, base.size, args.start + 17 * k, base)
                for k in range(args.count)]
    elif args.room == "door":   # the lobby's door crop at an hour, or under snow: reception-door[-winter][-<time>]_<seed>.png
        phase, t = args.time or "dusk", tag(args.time or "dusk", args.winter)
        if args.pick is not None:   # the pick, as it was painted, into picks/ (install_picks takes its glass)
            Image.open(OUT / f"reception-door{t}_{args.pick}.png").convert("RGB").save(HERE / "picks" / f"reception-door{t}.png")
            return print("wrote", HERE / "picks" / f"reception-door{t}.png")
        if phase == "dusk" and not args.winter:
            raise SystemExit("door: dusk is the lobby's own painting; paint --time dawn|day|night, or --winter")
        # an hour is the dusk room's crop retimed; a winter hour, the winter dusk's (install it first)
        base = shut_lobby("dusk", args.winter and phase != "dusk").crop(ENTRANCE_CROP)
        jobs = [(OUT / f"reception-door{t}_{args.start + 17 * k}.png", door_prompt(phase, args.winter), base.size,
                 args.start + 17 * k, base) for k in range(args.count)]
    elif args.room == "retime":   # the roof at another hour: <src>-<time>_<seed>.png
        init = Image.open(OUT / args.src).convert("RGB")
        stem = Path(args.src).stem
        jobs = [(OUT / f"{stem}-{args.time}_{args.start + 17 * k}.png", OUTDOOR.format(HOURS[args.time]), init.size,
                 args.start + 17 * k, init) for k in range(args.count)]
    elif args.room == "winter":   # the roof under snow: <src>-winter_<seed>.png
        init = Image.open(OUT / args.src).convert("RGB")
        kind, stem = args.src.split("_")[0], Path(args.src).stem
        if kind not in SNOW:   # the lobby's winter is only what its glass door shows (#346)
            raise SystemExit(f"winter: no snow for {kind} (SNOW has {', '.join(SNOW)}); the lobby's winter is its door's view: "
                             "paint_rooms.py door --winter [--time PHASE]")
        hour = next((h for h in HOURS if f"-{h}_" in args.src), "dusk")
        prompt = (WINTER_NIGHT if hour == "night" else WINTER).format(SNOW[kind], LIGHT[hour])
        jobs = [(OUT / f"{stem}-winter_{args.start + 17 * k}.png", prompt, init.size, args.start + 17 * k, init)
                for k in range(args.count)]
    elif args.room == "cab":
        jobs = [(OUT / f"cab_{args.start + 17 * k}.png", CAB, CAB_SIZE, args.start + 17 * k, None) for k in range(args.count)]
    elif args.room == "capsule":
        jobs = [(OUT / f"capsule_{args.start + 17 * k}.png", CAPSULE, CAPSULE_SIZE, args.start + 17 * k, capsule_pose())
                for k in range(args.count)]
    elif args.room == "receptionists":
        (OUT / "reception").mkdir(exist_ok=True)
        jobs = [(OUT / "reception" / f"{name}_{kind}.png", DESK_PROMPT.format(action=DESK_ACTION[kind], look=look), DESK_SIZE, seed,
                 desk_pose(kind, top)) for name, (seed, top, look) in RECEPTIONISTS.items() for kind in DESK_POSES]
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
        paint_candidate(path, prompt, size, seed, args.host, init, extra=PINNED)


if __name__ == "__main__":
    main()
