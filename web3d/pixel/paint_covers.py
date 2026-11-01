# /// script
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Paint the blog's covers with the local model in Draw Things (HTTP API, Settings > API Server, port 7860), and install the picks.

Paint candidates: uv run web3d/pixel/paint_covers.py <slug> [--count N] [--start SEED] [--host URL]
Install the picks: uv run web3d/pixel/paint_covers.py --install

Every post's idea shown through nature, in one family: same style, same palette, a different habitat and hour. Candidates go
to web3d/pixel/paintings/candidates/cover-<slug>_<seed>.png (gitignored). They are not kept in git: the model does not
redraw a seed bit for bit, so static/images/blog/covers/<slug>.jpg is the source from here on. An untouched cover's .jpg is
its painting and its PNG comes from pixelate.py's plain hint (layouts/partials/blog-art.html). A cover touched up in code
below has no painting that matches, so its .jpg is a 6x nearest-neighbour upscale of the PNG, and the share card matches
the post; the hint only approximates such a PNG.

The committed PNGs are the final art. The 7 covers with a sky or touch-up below cannot be remade without their gitignored
candidates, and that is accepted: --install needs those local files, and a fresh paint of the same seed will differ.
"""
import argparse
import base64
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixelate as P  # noqa: E402

CANDIDATES = Path(__file__).resolve().parent / "paintings" / "candidates"
COVERS_DIR = Path(__file__).resolve().parents[2] / "static" / "images" / "blog" / "covers"
SIZE = (192, 108)
STYLE = (
    "Flat 2D side-view video game background art, 16-bit adventure game style. Clean cel shading with bold "
    "dark outlines, chunky simple shapes that read well when reduced to pixel art, a limited palette. One big"
    " clear subject filling the middle of the picture, simple uncluttered background. "
)
NO_TEXT = " No people, no text, no letters, no numbers, no logos."

# slug: (the picked seed, what it shows, the prompt, the sky (probe column, rows) to dither or None)
COVERS = {
    "how-hashmap-works-java": (11, "Comb cells are buckets; three bees queue at one cell, a collision.",
     "A warm late-summer evening, amber and rose light through oak leaves. Close cut-away of a wild beehive in a"
     " hollow oak: the comb fills most of the picture, a wall of very large golden hexagon cells, six across and"
     " four high, most holding one drop of honey and one bee each. In the very middle of the comb, three big "
     "bees hover nose to tail in a line, queueing at one single cell. Every bee is well inside the picture.",
     None),
    "break-hashmap-less-than-a-minute": (22, "The marker stone moved, so the squirrel digs under it and finds nothing: the acorn is where the stone was.",
     "An autumn forest floor at dusk, violet and orange sky, falling orange leaves, shown as a cut-away with the"
     " soil below. On the left a red squirrel stands at a deep hole it has just dug, looking down into it: the "
     "hole is empty. Far to the right, under a mossy stone, the cut-away soil shows its acorn safely buried "
     "where it is not looking.",
     (70, 48)),
    "design-patterns-builder": (33, "A beaver lays its dam course by course, step by step.",
     "Blue hour in the mountains, cold violet sky, pink alpenglow on distant snowy peaks, dark spruce on both "
     "sides. A chunky brown beaver in clear side profile with a flat tail, carrying a long stick in its mouth "
     "along the top of a half-finished dam across a stream. The dam is stacked courses of logs: complete on the "
     "left, only the first course on the right, where the water still pours through a gap.",
     None),
    "design-patterns-factory": (22, "One goose, gold or copper eggs: the post's coin alchemist.",
     "A pale misty dawn over a reed pond, lilac and peach sky. A big white goose sits on a reed nest in the "
     "centre, in clear side view. In front of the nest, two neat separate piles of eggs: on the left shining "
     "gold eggs, on the right copper-red eggs.",
     (150, 38)),
    "design-patterns-abstract-factory": (33, "Two habitats, each making its own family: tree, fox and hare in snow or in sand.",
     "The picture is divided into two halves by a straight vertical line, showing the same little scene twice in"
     " two matching families. Left half: a frozen arctic dusk in deep blues and white, a snow-laden fir tree, a "
     "white arctic fox, a white hare. Right half: a hot desert dusk in orange and sand, a tall green saguaro "
     "cactus, a sandy fennec fox, a sand-coloured jackrabbit. Tree, fox and hare stand in the same positions in "
     "both halves.",
     None),
    "design-patterns-prototype": (44, "One sheep repeated (Dolly, in the post), the last copy changed.",
     "A rose and violet evening with big soft clouds over rolling green hills, a stone wall in the distance. In "
     "the foreground on a green meadow, five big identical fluffy white sheep stand side by side in a straight "
     "row in clear side view, the exact same sheep repeated, same pose, same size, each one large, filling the "
     "width of the picture. Only the last one on the right has black wool.",
     None),
    "interview-questions-concurrency-parallelism": (33, "One hummingbird, two flowers: it only seems to feed at both at once.",
     "Deep teal and violet tropical twilight, dark glossy leaves framing the picture. One very large iridescent "
     "hummingbird hovers in the exact centre between two very large trumpet flowers, one red on the left and one"
     " blue on the right, both close to it, both on stems coming in from the sides. Plenty of plain sky around "
     "the bird.",
     None),
    "xkcd-from-tile-to-picture": (22, "A bowerbird places the last square tile of a whole picture.",
     "Shaded rainforest floor in the evening, deep green, warm shafts of low light. A big glossy black bowerbird"
     " stands on the left in clear side profile, holding one square tile in its beak. It is facing a big flat "
     "upright stone slab on the right. On the slab is a mosaic made of big square coloured tiles in a strict "
     "grid, nearly complete: together the tiles show a sun over green hills. One square gap waits for its tile.",
     None),
    "amazon-keyspaces-problematic": (11, "Four ducks look alike above the water; below it, one is a wooden decoy on a cord.",
     "A bright golden evening over a clear pond, pale gold and peach sky, reeds at the edges. Side-on cut-away "
     "at the waterline, with clear blue water filling the lower half of the picture. Four big identical mallard "
     "ducks float in a straight row, each large and clearly separate. Above the waterline all four look exactly "
     "alike. Below the waterline, the first three have orange webbed feet paddling. The fourth duck, on the "
     "right, has no feet at all: under the water it is a flat block of plain wood with a cord running straight "
     "down to a stone on the pond bed.",
     None),
    "fix-misconfigurations-redistemplate": (11, "The fish is right there, but the heron cannot get through the ice: stored, yet null.",
     "A frozen lake at winter dusk, violet and cold blue sky, snowy firs in the distance, shown as a cut-away "
     "through the ice. A tall grey heron stands on thick pale blue ice in the centre, looking straight down, its"
     " beak touching the ice. Directly beneath it, clearly visible in the dark water below the ice, a big bright"
     " orange fish.",
     (60, 36)),
    "inject-multiple-implementations-spring": (11, "One trunk, a different fruit on each branch: add a graft, leave the tree alone.",
     "A golden autumn evening, amber sky, low sun, distant orchard hills. One big apple tree with one thick "
     "trunk in the centre. Each main branch bears a different fruit: red apples, yellow pears, purple plums, "
     "orange peaches, each fruit large and easy to see. A small round bird perches on a branch.",
     None),
    "custom-spring-boot-banner": (11, "At spring sunrise a peacock raises its own display.",
     "Spring sunrise in a garden, pink and gold sky, cherry blossom branches. A big peacock stands in the centre"
     " with its tail fully raised in a huge round fan of teal, green and gold eyes, filling the picture, "
     "displaying itself proudly.",
     None),
    "observability-in-action-opentelemetry": (55, "An owl reads the fireflies' glowing trails: traces.",
     "A dark forest at night, a deep navy blue night sky with stars seen between black tree trunks. A dozen "
     "bright fireflies, each leaving a long glowing yellow dotted trail behind it, the trails big and bright, "
     "curving between the trunks and crossing each other in the middle of the picture. A big owl with large "
     "round eyes perches on a branch on the right, watching them.",
     None),
    "openapi-robust-restful-api": (55, "A web built to one exact plan: spokes first, spiral after.",
     "A misty dawn in pale violet fog with soft layered hills, dark bare branches at the corners. One huge orb "
     "spider web fills the picture, perfectly geometric and unbroken, with very thick bright white straight "
     "spokes and an even spiral, a few round dew drops, a small dark spider at its exact centre.",
     None),
    "build-domain-gateway-openapi": (55, "One guarded nest door, three chambers behind it: a facade.",
     "Late afternoon, warm amber sky over tall grass. Cut-away of an ant nest under a grassy mound, the dark "
     "soil filling the lower two thirds. One single round entrance at the top of the mound with one big guard "
     "ant standing in it, and a line of small ants waiting on the surface outside. From that entrance one wide "
     "dark tunnel runs straight down, then forks into three tunnels, left, middle and right, each ending in a "
     "large round chamber: one full of seeds, one full of white eggs, one full of green leaves. The tunnels "
     "clearly connect everything.",
     None),
    "our-errors-your-gain-a-system-design-cautionary-tale": (88, "A temporary prop the tree has long since grown around.",
     "A bruise-coloured storm sky at dusk, dark grey and violet clouds, slanting rain, a bare brown hill. One "
     "huge old oak with a very thick trunk leans hard to the right. One old grey wooden post braces it: the foot"
     " of the post stands on the ground to the right of the tree and the post rises to the left, and its top end"
     " disappears into the trunk, where the bark has bulged and grown around it like a swollen lip. Clearly the "
     "post was put there long ago and the tree has swallowed it. Moss on the post.",
     None),
    "real-life-problem-solving-engineering-principles": (55, "Migrating cranes change their route around a storm, over a Thai bay.",
     "A tropical bay at sunset, tall green limestone karst islands rising from a teal sea. In the sky, exactly "
     "seven large white cranes with long necks, each big and clearly separate, fly in a wide V from the left, "
     "and the line of birds curves upward to steer around a towering dark thunderstorm cloud with one lightning "
     "bolt on the right.",
     (6, 50)),
    "self-compiling-second-brain": (33, "Mycelium links every tree's roots into one shared memory.",
     "A moonlit forest at night, deep blue sky, a big pale moon, cut-away view. Three old trees above ground. "
     "Below the soil line, filling the lower two thirds of the picture in dark earth, a glowing web of pale gold"
     " mycelium threads with round bright nodes links all their roots into one network.",
     None),
    "build-twitter-bot-kotlin": (33, "A wind-up bird sings on schedule, and real sparrows listen.",
     "A clear sunrise, peach and gold sky. On the left, on a bare branch, a clockwork songbird made of orange "
     "copper plates and rivets, with a big brass wind-up key in its back, beak wide open, singing. White musical"
     " notes stream from its beak across the picture towards a row of six small brown sparrows on a long branch "
     "on the right, all turned to listen.",
     (170, 58)),
}


def sky_dither(img, probe_x, rows):
    """pixelate.dither_bands, but only on sky pixels connected to the top edge, so what shares a band's colour stays."""
    a, done = np.asarray(img), np.asarray(P.dither_bands(img, rows, probe_x))
    colours = {tuple(c) for c in a[:rows, probe_x]}
    seen = np.zeros(a.shape[:2], bool)
    stack = [(0, x) for x in range(a.shape[1]) if tuple(a[0, x]) in colours]
    while stack:
        y, x = stack.pop()
        if seen[y, x]:
            continue
        seen[y, x] = True
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < rows and 0 <= nx < a.shape[1] and not seen[ny, nx] and tuple(a[ny, nx]) in colours:
                stack.append((ny, nx))
    out = a.copy()
    out[seen] = done[seen]
    return Image.fromarray(out, "RGB")


def clones(img):
    """Prototype: the row is literally one sheep repeated; the last copy gets black wool."""
    a = np.asarray(img).astype(int)
    x0, x1, y0, y1 = 7, 56, 60, 106
    crop = a[y0:y1, x0:x1]
    solid = (crop.sum(-1) > 560) | (crop.sum(-1) < 90)                 # wool and outline; the rest is grass or hill
    h, w = solid.shape
    outside = np.zeros_like(solid)
    stack = [(y, x) for y in range(h) for x in (0, w - 1)] + [(h - 1, x) for x in range(w)]
    while stack:
        y, x = stack.pop()
        if outside[y, x] or solid[y, x]:
            continue
        outside[y, x] = True
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w:
                stack.append((ny, nx))
    res = a.copy()
    res[84:] = a[106, 2]                                               # the painted legs go; only grass behind them
    for i, X in enumerate((1, 47, 93, 139)):
        for y, x in zip(*np.nonzero(~outside)):
            c = crop[y, x].copy()
            if i == 3 and c.sum() > 560:
                c = np.array((30, 28, 34) if c.sum() > 640 else (20, 18, 24))
            res[y0 + y, X + x] = c
    return Image.fromarray(res.astype(np.uint8), "RGB")


def trail(img):
    """Concurrency: one bird's path, looping from flower to flower. The painted trail never survives the downscale."""
    d = ImageDraw.Draw(img)
    for x0, x1, y0, peak in ((70, 124, 32, 16), (66, 128, 74, 92)):
        for i in range(0, 37, 3):
            t = i / 36
            x, y = x0 + (x1 - x0) * t, y0 + (peak - y0) * (1 - (2 * t - 1) ** 2)
            d.rectangle((x, y, x + 1, y), fill=(242, 236, 224))
    return img


NOTE = ["...###", "...#..", "...#..", "...#..", "####..", "####..", ".##..."]


def notes(img):
    """Twitter bot: crisp notes in place of the blur the downscale leaves of the painted ones."""
    a = np.asarray(img).copy()
    for y in range(24, 63):
        for x in range(68, 111):
            a[y, x] = a[y, 186 + (x - 186) % 4]                        # the sky further right, in the dither's phase
    for nx, ny in ((74, 42), (85, 28), (92, 47), (103, 34)):
        for j, row in enumerate(NOTE):
            for i, c in enumerate(row):
                if c == "#":
                    a[ny + j, nx + i] = (10, 11, 16)
    return Image.fromarray(a, "RGB")


CREAM = (242, 236, 224)
STONE = [(134, 64), (138, 55), (143, 50), (151, 46), (160, 45), (170, 47), (176, 52), (182, 61), (184, 65), (140, 66)]


def moved_stone(img):
    """break-hashmap: the point is that the key changed, which no painting drew clearly. The stone moves next to the squirrel's
    empty hole, and a dashed ghost of it stays over the acorn, with the path it took."""
    a = np.asarray(img).copy()
    shape = Image.new("L", SIZE)
    ImageDraw.Draw(shape).polygon(STONE, fill=255)
    mask = np.asarray(shape) > 0
    ys, xs = np.nonzero(mask)
    stone = a[ys, xs].copy()
    for y, x in zip(ys, xs):
        a[y, x] = a[y, 124 + (x - 124) % 4] if x < 178 else a[y, 186]  # the sky beside it, in the dither's phase
    a[60:70, 128:188] = a[60:70, 68:128]                               # the leaf litter runs on where the stone sat
    a[ys, xs - 72] = stone
    edge = mask & ~(np.roll(mask, 1, 0) & np.roll(mask, -1, 0) & np.roll(mask, 1, 1) & np.roll(mask, -1, 1))
    for y, x in zip(*np.nonzero(edge)):
        if (x + y) % 4 < 2:
            a[y, x] = CREAM
    for i in range(0, 41, 3):                                          # the way it went, ending in a head at the stone
        t = i / 40
        x, y = int(158 - 66 * t), int(40 - 14 * (1 - (2 * t - 1) ** 2))
        a[y, x:x + 2] = CREAM
    for j in range(4):
        a[37 + j, 89 + j:91 + j] = CREAM
        a[37 + j, 95 - j:97 - j] = CREAM
    return Image.fromarray(a, "RGB")


TOUCH_UPS = {"break-hashmap-less-than-a-minute": moved_stone, "design-patterns-prototype": clones, "interview-questions-concurrency-parallelism": trail,
             "build-twitter-bot-kotlin": notes}


def install():
    COVERS_DIR.joinpath("pixel").mkdir(exist_ok=True)
    for slug, (seed, _, _, sky) in COVERS.items():
        painting = Image.open(CANDIDATES / f"cover-{slug}_{seed}.png").convert("RGB")
        jpg, png = COVERS_DIR / f"{slug}.jpg", COVERS_DIR / "pixel" / f"{slug}.png"
        if sky is None and slug not in TOUCH_UPS:
            painting.save(jpg, quality=90)                             # and the PNG comes from it, as the hint does
            P.pixelate(Image.open(jpg), SIZE, 24).save(png)
            continue
        im = P.pixelate(painting, SIZE, 24)
        if sky:
            im = sky_dither(im, *sky)
        if slug in TOUCH_UPS:
            im = TOUCH_UPS[slug](im)
        im.save(png)
        im.resize((SIZE[0] * 6, SIZE[1] * 6), Image.NEAREST).save(jpg, quality=95)
        print("touched up:", slug)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?", choices=sorted(COVERS))
    ap.add_argument("--install", action="store_true")
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--start", type=int, default=11)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    args = ap.parse_args()
    if args.install:
        return install()
    if not args.slug:
        ap.error("name a slug, or pass --install")
    prompt = STYLE + COVERS[args.slug][2] + NO_TEXT
    for k in range(args.count):
        seed = args.start + 11 * k
        path = CANDIDATES / f"cover-{args.slug}_{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        req = urllib.request.Request(args.host + "/sdapi/v1/txt2img", data=json.dumps(
            {"prompt": prompt, "width": 1024, "height": 576, "seed": seed, "batch_size": 1}).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=900) as r:
            path.write_bytes(base64.b64decode(json.loads(r.read())["images"][0].split(",")[-1]))
        print("painted", path.name, flush=True)


if __name__ == "__main__":
    main()
