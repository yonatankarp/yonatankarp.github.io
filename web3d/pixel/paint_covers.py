# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Paint the blog's covers with the local model in Draw Things (HTTP API, Settings > API Server, port 7860), and install the picks.

Paint candidates: uv run web3d/pixel/paint_covers.py <slug> [--count N] [--start SEED] [--host URL]
Install the picks: uv run web3d/pixel/paint_covers.py --install
Art inside a post: the same two steps, with a name from INLINE and --install-inline

Every post's idea shown through nature, in one family: same style, same palette, a different habitat and hour. Candidates go
to web3d/pixel/paintings/candidates/cover-<slug>_<seed>.png (gitignored). They are not kept in git: the model does not
redraw a seed bit for bit, so static/images/blog/covers/<slug>.jpg is the source from here on. An untouched cover's .jpg is
its painting and its PNG is pixelate.py's bake of it at SIZE, the command layouts/partials/blog-art.html names: --install
rebakes them from the .jpg when the candidate is gone. A cover touched up in code below has no painting that matches: it
is baked the old, coarse way at OLD (pixelate.pixelate), touched up there, and its PNG is a nearest-neighbour upscale to
SIZE, its .jpg one to 6x OLD (the share card). Their candidates are gone too, so --install keeps their PNGs as they are,
and only a repaint makes them as fine as the rest. Art inside a post is baked from its candidate at INLINE_SIZE, after
its touch-up, which works on the painting.

SIZE is 5x the old 192x108: a post's head shows the cover across the screen, so the finest the 1024x576 paintings allow
(the Library's header has an art pixel per screen pixel on a 1440 screen; a cover's is ~1.5), and a whole multiple keeps
the touched-up covers crisp. INLINE_SIZE is 3x, so it fills the article's 758px column at 1:1 (custom.css).
"""
import argparse
import base64
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixelate as P  # noqa: E402

CANDIDATES = Path(__file__).resolve().parent / "paintings" / "candidates"
COVERS_DIR = Path(__file__).resolve().parents[2] / "static" / "images" / "blog" / "covers"
INLINE_DIR = COVERS_DIR.parent / "pixel"
OLD, SIZE, INLINE_SIZE = (192, 108), (960, 540), (576, 324)
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

# Art inside a post, in its cover's habitat. name: (the picked seed, what it shows, the prompt); shown from static/images/blog/pixel/<name>.png.
INLINE = {
    "hashmap-same-cell": (11, "equals() and hashCode(): equal objects land in the same bucket.",
     "A warm late-summer evening, amber and rose light through oak leaves. Close view of a wild beehive comb, a "
     "wall of very large golden hexagon cells filling the picture. In the exact middle, one single big empty "
     "cell, and two identical big bees in the same pose, one from the left and one from the right, both landing"
     " on that one cell. No other bees."),
    "hashmap-straight-to-cell": (11, "O(1): straight to the bucket. Is it? A small queue waits at the far end.",
     "A warm late-summer evening, amber and rose light through oak leaves. A wild beehive comb with very large "
     "golden hexagon cells fills the right half of the picture. On the left, one big bee in clear side profile "
     "flies straight towards one big cell in the middle of the comb. At the far right edge of the comb, three "
     "tiny bees queue nose to tail at another cell."),
    "hashset-one-per-cell": (33, "HashSet: the value is the key, so each bucket holds one bee and no honey.",
     "A warm late-summer evening, amber and rose light through oak leaves. Front view of a beehive comb, a tidy "
     "wall of very large hexagon cells, four across and three high. Every cell is empty and dark amber with no "
     "honey at all, and each cell holds exactly one big bee sitting in its centre, one bee per cell."),
    "break-hashmap-fixed-stone": (11, "Immutable: a marker that cannot move, so the acorn is always under it.",
     "An autumn forest floor at dusk, violet and orange sky, falling orange leaves, shown as a cut-away with the"
     " soil below. In the middle a huge grey boulder sunk deep into the ground, thick tree roots gripping it and"
     " moss on top, far too big to ever move. A red squirrel sits on top of it looking pleased. Directly under "
     "the boulder, the cut-away soil shows one acorn safely in a small round burrow."),
    "gateway-digging": (55, "How to build it: the ants dig the fork and the chambers behind the one door.",
     "Late afternoon, warm amber sky over a thin strip of tall grass at the very top. Close cut-away of an ant "
     "nest under construction, the dark soil filling almost all of the picture. One wide horizontal tunnel runs "
     "across the middle, ending on the left in a finished round chamber and on the right in a rough unfinished "
     "wall of crumbling soil. Three very big black ants in clear side profile walk in a row along the tunnel, "
     "each ant as tall as the tunnel, each carrying one big crumb of soil on its back."),
    "openapi-mismatched-webs": (66, "No shared contract: two sides build towards each other and do not meet.",
     "A misty dawn in pale violet fog with soft layered hills, dark bare branches at both sides. Two separate "
     "half-finished spider webs with thick bright white threads. The left web hangs high in the picture, built "
     "out from the left branch. The right web hangs low in the picture, built out from the right branch. They "
     "are not at the same height and their patterns differ. Nothing joins them: a wide empty gap of plain fog "
     "fills the middle of the picture, with no thread crossing it. One small dark spider on each web."),
    "openapi-spinning-spiral": (22, "The generator: the plan's spokes are laid, and the spiral follows them on its own (touched up below).",
     "A misty dawn in pale violet fog with soft layered hills, dark bare branches at the corners. One huge orb "
     "spider web under construction fills the picture: all the very thick bright white straight spokes are "
     "finished, but the even spiral is only done in the inner half, so the outer half is bare spokes. A small "
     "dark spider sits at the end of the spiral, spinning the next turn."),
    "openapi-first-catch": (55, "Implemented: the finished web does its job.",
     "A clear pale violet morning, one plain even sky colour behind the web, low soft hills at the bottom, dark "
     "bare branches at the corners. One huge orb spider web fills the picture, perfectly geometric and unbroken,"
     " thick bright white spokes and an even spiral. One big fat bluebottle fly with clear wings is stuck in the"
     " web, right of centre. One big dark spider walks along a spoke from the left towards the fly. Both are "
     "large and easy to see against the web."),
    "real-life-grounded-crane": (33, "The incident: one crane is down, and the flock lands to assess it.",
     "A tropical bay at sunset, tall green limestone karst islands rising from a teal sea. On a pale sandbar in "
     "the foreground, one large white crane with a long neck stands with one wing hanging down, hurt. Around it,"
     " four more large white cranes have landed and look at the hurt wing, and two more glide down from the "
     "coral sky. Every crane is big and clearly separate."),
    "real-life-retro": (11, "The retro: the flock stops and talks it over, briefly.",
     "A tropical bay at dusk, deep violet and orange sky, a thin moon, dark green limestone karst islands on a "
     "calm teal sea. On a pale sandbar in the foreground, five large white cranes with long necks stand in a "
     "neat circle, all facing the middle, calm. Every crane is big and clearly separate."),
    "real-life-preening": (66, "Review: each checks the other's feathers, and finds what one alone would miss.",
     "A tropical bay in golden afternoon light, green limestone karst islands far away on a teal sea. Two very "
     "large white cranes with long necks stand in shallow water, both facing the same way, to the left, one just"
     " behind the other. The front crane looks ahead, calm, its wing held half open. The crane behind bends its "
     "long neck down and its beak gently touches one feather on the front crane's open wing, checking it."),
    "real-life-new-route": (44, "Requirements change: too hot here, so the flock turns for the cool highlands.",
     "One wide continuous landscape with no dividing line, the sky fading smoothly across the picture from hot "
     "orange on the left to cool pale blue on the right. On the far left a scorching sandy beach with wilted "
     "palm trees under a blazing white sun. The land rises gradually to misty green highlands and blue mountains"
     " on the far right. Seven large white cranes with long necks fly in a single curved line from over the "
     "beach towards the mountains. Every crane is big and clearly separate."),
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
    shape = Image.new("L", OLD)
    ImageDraw.Draw(shape).polygon(STONE, fill=255)
    mask = np.asarray(shape) > 0
    ys, xs = np.nonzero(mask)
    stone = a[ys, xs].copy()
    for y, x in zip(ys, xs, strict=True):
        a[y, x] = a[y, 124 + (x - 124) % 4] if x < 178 else a[y, 186]  # the sky beside it, in the dither's phase
    a[60:70, 128:188] = a[60:70, 68:128]                               # the leaf litter runs on where the stone sat
    a[ys, xs - 72] = stone
    edge = mask & ~(np.roll(mask, 1, 0) & np.roll(mask, -1, 0) & np.roll(mask, 1, 1) & np.roll(mask, -1, 1))
    for y, x in zip(*np.nonzero(edge), strict=True):
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


TOUCH_UPS = {"break-hashmap-less-than-a-minute": moved_stone, "interview-questions-concurrency-parallelism": trail,
             "build-twitter-bot-kotlin": notes}


def install():
    COVERS_DIR.joinpath("pixel").mkdir(exist_ok=True)
    for slug, (seed, _, _, sky) in COVERS.items():
        candidate = CANDIDATES / f"cover-{slug}_{seed}.png"
        jpg, png = COVERS_DIR / f"{slug}.jpg", COVERS_DIR / "pixel" / f"{slug}.png"
        if sky is None and slug not in TOUCH_UPS:
            if candidate.exists():
                Image.open(candidate).convert("RGB").save(jpg, quality=90)
            P.G.save_lossless(P.bake(Image.open(jpg), SIZE), png)       # from the .jpg, as the hint does
            continue
        if not candidate.exists():
            print("kept, no painting:", slug)
            continue
        im = P.pixelate(Image.open(candidate), OLD, 24)
        if sky:
            im = sky_dither(im, *sky)
        if slug in TOUCH_UPS:
            im = TOUCH_UPS[slug](im)
        P.G.save_lossless(im.resize(SIZE, Image.NEAREST), png)
        im.resize((OLD[0] * 6, OLD[1] * 6), Image.NEAREST).save(jpg, quality=95)
        print("touched up:", slug)


def fill(a, mask, passes=400):
    """Paint over the masked pixels from their surroundings: each pass gives every one the mean of its four neighbours."""
    a = a.astype(np.float64)
    for _ in range(passes):
        a[mask] = ((np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 4)[mask]
    return a.astype(np.uint8)


def unspun(img):
    """The painted web is finished: take the spiral off its upper right, leave bare spokes, and put a bigger spider where
    it stops. Works on the painting, before the bake, in the old 192x108 cover's units (k painting px each)."""
    a = np.array(img)
    k = a.shape[1] / 192
    cx, cy = 96 * k, 53 * k
    yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]
    r, angle = np.hypot(xx - cx, yy - cy), np.degrees(np.arctan2(yy - cy, xx - cx))
    strand = np.asarray(Image.fromarray((a.min(2) > 225).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    gone = strand & (r > 9 * k) & (r < 75 * k) & (xx > cx) & (angle > -89) & (angle < 36)
    box = np.zeros_like(gone)
    box[int(62 * k):int(76 * k), int(108 * k):int(123 * k)] = True                   # the painted spider, too small to read
    gone |= box & np.asarray(Image.fromarray((a.max(2) < 120).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    out = Image.fromarray(fill(a, gone), "RGB")
    d = ImageDraw.Draw(out)
    white, ink = tuple(int(v) for v in np.median(a[a.min(2) > 240], 0)), (10, 11, 16)   # the painted strands' white
    for ex, ey in ((127, 6), (141, 24), (153, 53), (141, 81)):
        d.line(((cx, cy), (ex * k, ey * k)), fill=white, width=round(2.5 * k))
    x, y = 129 * k, 73 * k
    for dy, reach in ((-4, 6), (-2, 7), (1, 7), (3, 6)):                             # eight legs, bent at the knee
        for side in (-1, 1):
            d.line(((x, y), (x + side * reach * k, y + dy * k), (x + side * (reach + 2) * k, y + (dy + 3) * k)),
                   fill=ink, width=round(k), joint="curve")
    d.ellipse((x - 3 * k, y - 2 * k, x + 3 * k, y + 4 * k), fill=ink)
    d.ellipse((x - 2 * k, y - 5 * k, x + 2 * k, y - k), fill=ink)
    return out


INLINE_TOUCH_UPS = {"openapi-spinning-spiral": unspun}


def install_inline():
    INLINE_DIR.mkdir(exist_ok=True)
    for name, (seed, _, _) in INLINE.items():
        painting = Image.open(CANDIDATES / f"inline-{name}_{seed}.png").convert("RGB")
        P.G.save_lossless(P.bake(INLINE_TOUCH_UPS.get(name, lambda i: i)(painting), INLINE_SIZE), INLINE_DIR / f"{name}.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?", choices=sorted(COVERS | INLINE))
    ap.add_argument("--install", action="store_true")
    ap.add_argument("--install-inline", action="store_true")
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--start", type=int, default=11)
    ap.add_argument("--host", default="http://127.0.0.1:7860")
    args = ap.parse_args()
    if args.install:
        return install()
    if args.install_inline:
        return install_inline()
    if not args.slug:
        ap.error("name a slug, or pass --install")
    prompt = STYLE + (COVERS | INLINE)[args.slug][2] + NO_TEXT
    kind = "inline" if args.slug in INLINE else "cover"
    for k in range(args.count):
        seed = args.start + 11 * k
        path = CANDIDATES / f"{kind}-{args.slug}_{seed}.png"
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
