# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Paint the blog's covers with the local model in Draw Things (HTTP API, Settings > API Server, port 7860), and install the picks.

Paint candidates: uv run web3d/pixel/paint_covers.py <slug> [--count N] [--start SEED] [--host URL]
Edit a pick (EDITS): uv run web3d/pixel/paint_covers.py <slug> --edit [--count N] [--start SEED]
Install the picks: uv run web3d/pixel/paint_covers.py --install
Art inside a post: the same two steps, with a name from INLINE and --install-inline

Every post's idea shown through nature, in one family: same style, same palette, a different habitat and hour. Candidates go
to web3d/pixel/paintings/candidates/cover-<slug>_<seed>.png (gitignored). They are not kept in git: the model does not
redraw a seed bit for bit, so static/images/blog/covers/<slug>.jpg is the source from here on. A cover's .jpg is its
painting, after its touch-up below if it has one, and its PNG is pixelate.py's bake of the .jpg at SIZE, the command
layouts/partials/blog-art.html names: --install writes the .jpg only from a candidate on disk, touching it up then, and
rebakes every PNG from its .jpg, so a touch-up is never drawn twice. Art inside a post is baked from its candidate at
INLINE_SIZE, after its touch-up, and kept as it is once the candidate is gone. Both kinds of touch-up work on the painting, in the old 192x108 cover's units.

SIZE is 5x the old 192x108: a post's head shows the cover across the screen, so the finest the 1024x576 paintings allow
(the Library's header has an art pixel per screen pixel on a 1440 screen; a cover's is ~1.5). INLINE_SIZE is 3x, so it
fills the article's 758px column at 1:1 (custom.css).
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
SIZE, INLINE_SIZE = (960, 540), (576, 324)
STYLE = (
    "Flat 2D side-view video game background art, 16-bit adventure game style. Clean cel shading with bold "
    "dark outlines, chunky simple shapes that read well when reduced to pixel art, a limited palette. One big"
    " clear subject filling the middle of the picture, simple uncluttered background. "
)
NO_TEXT = " No people, no text, no letters, no numbers, no logos."

# slug: (the picked seed, or <seed>-e<edit seed> for a pick edited in EDITS, what it shows, the prompt)
COVERS = {
    "how-hashmap-works-java": (11, "Comb cells are buckets; three bees queue at one cell, a collision.",
     "A warm late-summer evening, amber and rose light through oak leaves. Close cut-away of a wild beehive in a"
     " hollow oak: the comb fills most of the picture, a wall of very large golden hexagon cells, six across and"
     " four high, most holding one drop of honey and one bee each. In the very middle of the comb, three big "
     "bees hover nose to tail in a line, queueing at one single cell. Every bee is well inside the picture."),
    "break-hashmap-less-than-a-minute": (33, "The marker stone moved, so the squirrel digs under it and finds nothing: the acorn is where the stone was (touched up below).",
     "An autumn forest floor at dusk, violet and orange sky, falling orange leaves, shown as a cut-away with the"
     " soil below. On the left a red squirrel stands at a deep hole it has just dug, looking down into it: the "
     "hole is empty. Far to the right, under a mossy stone, the cut-away soil shows its acorn safely buried "
     "where it is not looking."),
    "interview-questions-concurrency-parallelism": (33, "One hummingbird, two flowers: it only seems to feed at both at once.",
     "Deep teal and violet tropical twilight, dark glossy leaves framing the picture. One very large iridescent "
     "hummingbird hovers in the exact centre between two very large trumpet flowers, one red on the left and one"
     " blue on the right, both close to it, both on stems coming in from the sides. Plenty of plain sky around "
     "the bird. A bold dotted white line traces its flight path as one closed loop: an arc over the bird from "
     "the red flower to the blue one, and an arc under the bird back again."),
    "xkcd-from-tile-to-picture": (22, "A bowerbird places the last square tile of a whole picture.",
     "Shaded rainforest floor in the evening, deep green, warm shafts of low light. A big glossy black bowerbird"
     " stands on the left in clear side profile, holding one square tile in its beak. It is facing a big flat "
     "upright stone slab on the right. On the slab is a mosaic made of big square coloured tiles in a strict "
     "grid, nearly complete: together the tiles show a sun over green hills. One square gap waits for its tile."),
    "amazon-keyspaces-problematic": (11, "Four ducks look alike above the water; below it, one is a wooden decoy on a cord.",
     "A bright golden evening over a clear pond, pale gold and peach sky, reeds at the edges. Side-on cut-away "
     "at the waterline, with clear blue water filling the lower half of the picture. Four big identical mallard "
     "ducks float in a straight row, each large and clearly separate. Above the waterline all four look exactly "
     "alike. Below the waterline, the first three have orange webbed feet paddling. The fourth duck, on the "
     "right, has no feet at all: under the water it is a flat block of plain wood with a cord running straight "
     "down to a stone on the pond bed."),
    "fix-misconfigurations-redistemplate": ("11-e1", "The fish is right there, but the heron cannot get through the ice: stored, yet null.",
     "A frozen lake at winter dusk, violet and cold blue sky, snowy firs in the distance, shown as a cut-away "
     "through the ice. A tall grey heron stands on thick pale blue ice in the centre, looking straight down, its"
     " beak touching the ice. Directly beneath it, clearly visible in the dark water below the ice, a big bright"
     " orange fish."),
    "inject-multiple-implementations-spring": (11, "One trunk, a different fruit on each branch: add a graft, leave the tree alone.",
     "A golden autumn evening, amber sky, low sun, distant orchard hills. One big apple tree with one thick "
     "trunk in the centre. Each main branch bears a different fruit: red apples, yellow pears, purple plums, "
     "orange peaches, each fruit large and easy to see. A small round bird perches on a branch."),
    "custom-spring-boot-banner": (11, "At spring sunrise a peacock raises its own display.",
     "Spring sunrise in a garden, pink and gold sky, cherry blossom branches. A big peacock stands in the centre"
     " with its tail fully raised in a huge round fan of teal, green and gold eyes, filling the picture, "
     "displaying itself proudly."),
    "observability-in-action-opentelemetry": (55, "An owl reads the fireflies' glowing trails: traces.",
     "A dark forest at night, a deep navy blue night sky with stars seen between black tree trunks. A dozen "
     "bright fireflies, each leaving a long glowing yellow dotted trail behind it, the trails big and bright, "
     "curving between the trunks and crossing each other in the middle of the picture. A big owl with large "
     "round eyes perches on a branch on the right, watching them."),
    "openapi-robust-restful-api": (55, "A web built to one exact plan: spokes first, spiral after.",
     "A misty dawn in pale violet fog with soft layered hills, dark bare branches at the corners. One huge orb "
     "spider web fills the picture, perfectly geometric and unbroken, with very thick bright white straight "
     "spokes and an even spiral, a few round dew drops, a small dark spider at its exact centre."),
    "build-domain-gateway-openapi": (55, "One guarded nest door, three chambers behind it: a facade.",
     "Late afternoon, warm amber sky over tall grass. Cut-away of an ant nest under a grassy mound, the dark "
     "soil filling the lower two thirds. One single round entrance at the top of the mound with one big guard "
     "ant standing in it, and a line of small ants waiting on the surface outside. From that entrance one wide "
     "dark tunnel runs straight down, then forks into three tunnels, left, middle and right, each ending in a "
     "large round chamber: one full of seeds, one full of white eggs, one full of green leaves. The tunnels "
     "clearly connect everything."),
    "our-errors-your-gain-a-system-design-cautionary-tale": (88, "A temporary prop the tree has long since grown around.",
     "A bruise-coloured storm sky at dusk, dark grey and violet clouds, slanting rain, a bare brown hill. One "
     "huge old oak with a very thick trunk leans hard to the right. One old grey wooden post braces it: the foot"
     " of the post stands on the ground to the right of the tree and the post rises to the left, and its top end"
     " disappears into the trunk, where the bark has bulged and grown around it like a swollen lip. Clearly the "
     "post was put there long ago and the tree has swallowed it. Moss on the post."),
    "real-life-problem-solving-engineering-principles": (55, "Migrating cranes change their route around a storm, over a Thai bay.",
     "A tropical bay at sunset, tall green limestone karst islands rising from a teal sea. In the sky, exactly "
     "seven large white cranes with long necks, each big and clearly separate, fly in a wide V from the left, "
     "and the line of birds curves upward to steer around a towering dark thunderstorm cloud with one lightning "
     "bolt on the right."),
    "self-compiling-second-brain": (33, "Mycelium links every tree's roots into one shared memory.",
     "A moonlit forest at night, deep blue sky, a big pale moon, cut-away view. Three old trees above ground. "
     "Below the soil line, filling the lower two thirds of the picture in dark earth, a glowing web of pale gold"
     " mycelium threads with round bright nodes links all their roots into one network."),
    "build-twitter-bot-kotlin": (11, "A wind-up bird sings on schedule, and real sparrows listen.",
     "A clear sunrise, peach and gold sky. On the left, on a bare branch, a clockwork songbird made of orange "
     "copper plates and rivets, with a big brass wind-up key in its back, beak wide open, singing. White musical"
     " notes stream from its beak across the picture towards a row of six small brown sparrows on a long branch "
     "on the right, all turned to listen."),
}

# A pick the model then edited (img2img, "Edit this picture."), as no seed painted the idea: slug: (the seed it edits, the
# prompt). --edit paints cover-<slug>_<seed>-e<edit seed>.png from cover-<slug>_<seed>.png, and COVERS names the pick.
EDITS = {
    "fix-misconfigurations-redistemplate": (11, "Edit this picture. The heron bends its long neck down and looks straight down at"
     " the big orange fish under the ice, the tip of its beak touching the top of the ice right above the fish. Keep the heron's"
     " body, legs and feet, the ice, the fish, the dark water, the snowy firs, the sky and the style exactly the same. No text,"
     " no letters."),
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
    "concurrency-parallel": (111, "Parallel: two birds, each feeding at its own flower at the same moment.",
     "Deep teal and violet tropical twilight, dark glossy leaves framing the picture. On the left a very large "
     "red trumpet flower on a stem from the left side, its open mouth facing right. On the right a very large "
     "blue trumpet flower on a stem from the right side, its open mouth facing left. Between them, two very "
     "large iridescent hummingbirds hover back to back at the same moment: the left bird faces left with its "
     "long beak deep inside the red flower's mouth, the right bird faces right with its long beak deep inside "
     "the blue flower's mouth. Every bird and flower is big and well inside the picture."),
    "concurrency-interleaved": (100, "Concurrent: one bird darts between two flowers, a sip at each in turn.",
     "Deep teal and violet tropical twilight, dark glossy leaves framing the picture. A very large red trumpet "
     "flower on the left and a very large blue trumpet flower on the right, on stems coming in from the sides,"
     " with plain sky between them. One very large iridescent hummingbird in clear side profile sips at the red"
     " flower, its long beak deep in its mouth. Behind it, two faint see-through ghost copies of the same bird"
     " show where it just was: one sipping at the blue flower, one in mid-air between the flowers. A bold "
     "dotted white trail weaves back and forth between the two flowers several times. Every bird and flower is"
     " big and well inside the picture."),
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


CREAM = (242, 236, 224)


def moved_stone(img):
    """break-hashmap: no painting moves the marker, the post's point (the key changed). Lift the painted stone off the
    acorn, set it down beside the squirrel's empty hole, and leave a dashed ghost of it and the way it went. Works on the
    painting, before the bake, in the old 192x108 cover's units (k painting px each)."""
    a = np.array(img)
    k = a.shape[1] / 192
    dark = Image.fromarray(((a.max(2) < 60) * 255).astype(np.uint8)).copy()   # a copy: floodfill cannot write to fromarray's
    ImageDraw.floodfill(dark, (round(157 * k), round(60 * k)), 128)            # the stone's inside, up to its outline
    inside = np.asarray(dark) == 128
    assert inside.sum() < 0.08 * inside.size, "the fill leaked out of the stone: is this the picked painting?"
    stone = np.asarray(Image.fromarray(inside.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 0
    ys, xs = np.nonzero(stone)
    out = a.copy()
    out[ys, xs] = a[ys, xs - round(47 * k)]                                    # the sky and ground from its left run on
    out[ys, xs - round(67 * k)] = a[ys, xs]                                    # beside the empty hole
    ghost = stone & ~(np.asarray(Image.fromarray(stone.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(11))) > 0)
    gy, gx = np.nonzero(ghost)
    dash = (gx // round(2 * k) + gy // round(2 * k)) % 2 == 0
    out[gy[dash], gx[dash]] = CREAM
    im = Image.fromarray(out, "RGB")
    d = ImageDraw.Draw(im)
    x0, x1, y0, peak = 157 * k, 90 * k, 43 * k, 25 * k                         # the way it went, an arc ending in a head
    pts = [(x0 + (x1 - x0) * t, y0 + (peak - y0) * (1 - (2 * t - 1) ** 2)) for t in np.linspace(0, 1, 25)]
    for i in range(0, 24, 2):
        d.line((pts[i], pts[i + 1]), fill=CREAM, width=round(k))
    (px, py), (hx, hy) = pts[-2], pts[-1]
    back = np.arctan2(py - hy, px - hx)
    arms = [(hx + 3 * k * np.cos(back + s), hy + 3 * k * np.sin(back + s)) for s in (-0.6, 0.6)]
    d.line((arms[0], (hx, hy), arms[1]), fill=CREAM, width=round(k), joint="curve")
    return im


TOUCH_UPS = {"break-hashmap-less-than-a-minute": moved_stone}


def install():
    COVERS_DIR.joinpath("pixel").mkdir(exist_ok=True)
    for slug, (seed, _, _) in COVERS.items():
        candidate, jpg = CANDIDATES / f"cover-{slug}_{seed}.png", COVERS_DIR / f"{slug}.jpg"
        if candidate.exists():                                                 # touched up once, into the .jpg, the source after
            TOUCH_UPS.get(slug, lambda i: i)(Image.open(candidate).convert("RGB")).save(jpg, quality=90)
        P.G.save_lossless(P.bake(Image.open(jpg), SIZE), COVERS_DIR / "pixel" / f"{slug}.png")   # from the .jpg, as the hint does


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
        candidate = CANDIDATES / f"inline-{name}_{seed}.png"
        if not candidate.exists():                                             # its PNG is the source once the candidate is gone
            print("kept, no candidate:", name)
            continue
        painting = Image.open(candidate).convert("RGB")
        P.G.save_lossless(P.bake(INLINE_TOUCH_UPS.get(name, lambda i: i)(painting), INLINE_SIZE), INLINE_DIR / f"{name}.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?", choices=sorted(COVERS | INLINE))
    ap.add_argument("--install", action="store_true")
    ap.add_argument("--install-inline", action="store_true")
    ap.add_argument("--edit", action="store_true", help="repaint the slug's EDITS candidate with its edit prompt")
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
    base, job = "", {}
    if args.edit:
        if args.slug not in EDITS:
            ap.error(f"no edit for {args.slug} in EDITS")
        base, prompt = f"{EDITS[args.slug][0]}-e", EDITS[args.slug][1]
        init = CANDIDATES / f"{kind}-{args.slug}_{EDITS[args.slug][0]}.png"
        job = {"strength": 1.0, "init_images": [base64.b64encode(init.read_bytes()).decode()]}
    for k in range(args.count):
        seed = args.start + 11 * k
        path = CANDIDATES / f"{kind}-{args.slug}_{base}{seed}.png"
        if path.exists():
            print("kept", path.name)
            continue
        req = urllib.request.Request(args.host + ("/sdapi/v1/img2img" if job else "/sdapi/v1/txt2img"), data=json.dumps(
            {"prompt": prompt, "width": 1024, "height": 576, "seed": seed, "batch_size": 1, **job}).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=900) as r:
            path.write_bytes(base64.b64decode(json.loads(r.read())["images"][0].split(",")[-1]))
        print("painted", path.name, flush=True)


if __name__ == "__main__":
    main()
