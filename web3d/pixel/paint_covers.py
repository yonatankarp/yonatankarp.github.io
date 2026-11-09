# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow==12.1.0", "numpy==2.3.4"]
# ///
"""Paint the blog's covers with the local model in Draw Things (HTTP API, Settings > API Server, port 7860), and install the picks.

Paint candidates: uv run web3d/pixel/paint_covers.py <slug> [--count N] [--start SEED] [--host URL]
Edit a pick (EDITS): uv run web3d/pixel/paint_covers.py <slug> --edit [--count N] [--start SEED]
Install the picks: uv run web3d/pixel/paint_covers.py --install
Art inside a post: the same two steps, with a name from INLINE and --install-inline

Every post's idea shown through nature, in one family: the Library's painterly style (STYLE), on the rooms' model and
settings (paint_rooms.PINNED, sent with every job), a different habitat and hour. Candidates go
to web3d/pixel/paintings/candidates/cover-<slug>_<seed>.png (gitignored). They are not kept in git: the model does not
redraw a seed bit for bit, so static/images/blog/covers/<slug>.jpg is the source from here on. A cover's .jpg is its
painting, after its touch-up below if it has one, and its lossless WebP is pixelate.py's bake of the .jpg at SIZE, the command
layouts/partials/blog-art.html names: --install writes the .jpg only from a candidate on disk, touching it up then, and
rebakes every WebP from its .jpg, so a touch-up is never drawn twice. Art inside a post is baked from its candidate at
INLINE_SIZE, after its touch-up, and kept as it is once the candidate is gone. Both kinds of touch-up work on the painting, in the old 192x108 cover's units.

SIZE is 5x the old 192x108: a post's head shows the cover across the screen, so the finest the 1024x576 paintings allow
(the Library's header has an art pixel per screen pixel on a 1440 screen; a cover's is ~1.5). INLINE_SIZE is 3x, so it
fills the article's 758px column at 1:1 (custom.css).
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pixelate as P  # noqa: E402
from art_common import CANDIDATES, ROOT, paint_candidate, save_lossless  # noqa: E402
from paint_rooms import PINNED  # noqa: E402 (covers and rooms from one model)

COVERS_DIR = ROOT / "static" / "images" / "blog" / "covers"
INLINE_DIR = COVERS_DIR.parent / "pixel"
SIZE, INLINE_SIZE = (960, 540), (576, 324)
STYLE = (
    "Highly detailed painterly video game art like a city-builder game, a wide side-view scene. Soft glowing "
    "highlights and deep cosy shadows, forms modelled by light and shadow with soft painted edges, rich warm colours, "
    "atmospheric depth. The sky is painted with visible brushstrokes, soft clouds and haze. One big clear subject "
    "filling the middle of the picture, large and easy to read, against a calm background. Wild nature only, with no "
    "houses and no buildings anywhere. "
)
NO_TEXT = " No people, no text, no letters, no numbers, no logos."

# slug: (the picked seed, or <seed>-e<edit seed> for a pick edited in EDITS, what it shows, the prompt)
COVERS = {
    "how-hashmap-works-java": (88, "Comb cells are buckets; three bees queue at one cell, a collision.",
     "A warm late-summer evening, amber and rose light through oak leaves. Close cut-away of a wild beehive in a"
     " hollow oak: the comb fills most of the picture, a wall of very large golden hexagon cells, six across and"
     " four high, each holding one drop of honey. Just left of the middle one single cell glows bright gold. "
     "Exactly three big honeybees crawl in single file across the comb from the right, one behind the other, all"
     " three facing left towards that glowing cell, the head of the first bee at its edge, like a queue. No "
     "other bees anywhere. Every bee is well inside the picture."),
    "break-hashmap-less-than-a-minute": (33, "The marker stone moved, so the squirrel digs beside it and finds nothing: the acorn is under the bare patch where the stone was.",
     "An autumn forest floor at dusk, violet and orange sky, falling orange leaves, shown as a cut-away with the"
     " soil below. On the left a red squirrel stands at a deep hole it has just dug right beside a big mossy "
     "stone, looking down into it: the hole is empty. Far to the right, a bare round patch of flattened earth "
     "with no moss and no leaves shows where that stone used to lie, and directly under that patch the "
     "cut-away soil shows its acorn safely buried."),
    "interview-questions-concurrency-parallelism": (11, "One hummingbird, two flowers: it only seems to feed at both at once.",
     "Deep teal and violet tropical twilight, dark glossy leaves framing the picture. One very large iridescent "
     "hummingbird hovers in the exact centre between two very large trumpet flowers, one red on the left and one"
     " blue on the right, both close to it, both on stems coming in from the sides. Plenty of plain sky around "
     "the bird. A bold dotted white line traces its flight path as one closed loop: an arc over the bird from "
     "the red flower to the blue one, and an arc under the bird back again."),
    "xkcd-from-tile-to-picture": (99, "A bowerbird places the last square tile of a whole picture.",
     "Shaded rainforest floor in the evening, deep green, warm shafts of low light. A big glossy black bowerbird"
     " stands on the left in clear side profile, gripping one plain square tile of solid green in its beak. It "
     "is facing a big flat upright stone slab on the right. On the slab is a mosaic made of big equal square "
     "coloured tiles in a strict grid, nearly complete: together the tiles show a sun over green hills. Exactly "
     "one tile is missing: one empty dark square hole in the green hills, exactly one grid square, the same "
     "size and green as the tile in the bird's beak, waiting for it."),
    "amazon-keyspaces-problematic": (11, "Four ducks look alike above the water; below it, one is a wooden decoy on a cord.",
     "A bright golden evening over a clear pond, pale gold and peach sky, reeds at the edges. Side-on cut-away "
     "at the waterline, with clear blue water filling the lower half of the picture. Four big identical mallard "
     "ducks float in a straight row, each large and clearly separate. Above the waterline all four look exactly "
     "alike. Below the waterline, the first three have orange webbed feet paddling. The fourth duck, on the "
     "right, has no feet at all: under the water it is a flat block of plain wood with a cord running straight "
     "down to a stone on the pond bed."),
    "fix-misconfigurations-redistemplate": (66, "The fish is right there, but the heron cannot get through the ice: stored, yet null.",
     "A frozen lake at winter dusk, violet and cold blue sky, snowy firs in the distance. Side-on cut-away at the"
     " ice, like a view through the glass of an aquarium: the upper half of the picture is the snowy ice surface"
     " and the sky, the lower half is the dark water under a thick slab of clear pale blue ice. A tall grey heron"
     " stands on top of the ice in the centre, its long neck bent down, the tip of its beak touching the ice. "
     "Directly beneath it, under the thick ice, a big orange fish swims in the dark water. The ice is solid and "
     "unbroken between the beak and the fish, with no hole anywhere."),
    "inject-multiple-implementations-spring": (132, "One trunk, a different fruit on each branch: add a graft, leave the tree alone.",
     "A golden autumn evening, amber sky, low sun, distant orchard hills. One big fruit tree with one thick "
     "trunk in the centre, its crown split into four clearly separate big branches, each with its own clump of "
     "leaves: the far left branch holds only red apples, the middle left only yellow pears, the middle right "
     "only purple plums, the far right only orange peaches, each fruit large and easy to see."),
    "custom-spring-boot-banner": (88, "At spring sunrise a peacock raises its own display.",
     "Spring sunrise in a garden, pink and gold sky, cherry blossom branches. A big peacock stands in the centre"
     " with its tail fully raised in a huge round fan of teal, green and gold eyes, filling the picture, "
     "displaying itself proudly. The fan is one clean shape with a smooth rounded edge, and the clear sky around "
     "it is empty: no loose feathers, petals or leaves in the air."),
    "observability-in-action-opentelemetry": (33, "An owl reads the fireflies' glowing trails: traces.",
     "A dark forest at night, a deep navy blue night sky with stars seen between black tree trunks. A dozen "
     "bright fireflies, each leaving a long glowing yellow dotted trail behind it, the trails big and bright, "
     "curving between the trunks and crossing each other in the middle of the picture. A big owl with large "
     "round eyes perches on a branch on the right, watching them."),
    "openapi-robust-restful-api": (99, "A web built to one exact plan: spokes first, spiral after.",
     "A misty dawn in pale violet fog with soft layered hills, dark bare branches at the corners. One huge orb "
     "spider web fills the picture, strung between the branches, every outer thread tied to a branch. It is "
     "perfectly geometric and unbroken: bold straight spokes and an even spiral of glistening silver silk that "
     "catches the dawn light, a few round dew drops, a small dark spider at its exact centre."),
    "build-domain-gateway-openapi": (77, "One guarded nest door, three chambers behind it: a facade.",
     "Late afternoon, warm amber sky over tall grass. Cut-away of an ant nest under a grassy mound, the dark "
     "soil filling the lower two thirds. One single round entrance at the top of the mound, one big guard ant "
     "standing in its mouth, half inside it, and a line of small ants waiting on the surface outside. From that entrance one wide "
     "dark tunnel runs straight down, then forks into three tunnels, left, middle and right, each ending in a "
     "large round chamber dug out of the bare soil, with rough earthen walls: one full of seeds, one full of white eggs, one full of green leaves. The tunnels "
     "clearly connect everything."),
    "our-errors-your-gain-a-system-design-cautionary-tale": (11, "A temporary prop the tree has long since grown around.",
     "A bruise-coloured storm sky at dusk, dark grey and violet clouds, slanting rain, a bare brown hill. One "
     "huge old oak with a very thick trunk leans hard to the right. One old grey wooden post braces it: the foot"
     " of the post stands on the ground to the right of the tree and the post rises to the left, and its top end"
     " disappears into the trunk, where the bark has bulged and grown around it like a swollen lip. Clearly the "
     "post was put there long ago and the tree has swallowed it. Moss on the post."),
    "real-life-problem-solving-engineering-principles": ("99-e33", "Migrating cranes change their route around a storm, over a Thai bay.",
     "A tropical bay at sunset, tall green limestone karst islands rising from a teal sea. In the open sky on "
     "the left, a small flock of just five very large white cranes with long necks fly in one single curved line from the lower "
     "left, the line bending upward to steer around a towering dark thunderstorm cloud with one lightning bolt "
     "on the right. The cranes are all the same size and well spaced, with clear sky between every bird and "
     "no bird overlapping another."),
    "self-compiling-second-brain": (99, "Mycelium links every tree's roots into one shared memory.",
     "A forest at night lit by cool moonlight from out of view, a deep blue sky full of soft drifting clouds and "
     "a few stars, no moon in the sky, cut-away view. Exactly three old trees above ground. "
     "Below the soil line, filling the lower two thirds of the picture in dark earth, a glowing web of pale gold"
     " mycelium threads with round bright nodes links all their roots into one network."),
    "build-twitter-bot-kotlin": (55, "A wind-up bird sings on schedule, and real sparrows listen.",
     "A clear sunrise, peach and gold sky. On the left, on a bare branch, a clockwork songbird made of orange "
     "copper plates and rivets, with one big simple brass wind-up key, a butterfly key like a toy's, sticking out "
     "of its back, beak wide open, singing. A few simple white musical notes float from its beak across the "
     "picture, with no staff lines, towards a row of exactly four small brown sparrows on a long branch on the "
     "right, all turned to listen."),
}

# A pick the model then edited (img2img, "Edit this picture."), as no seed painted the idea: slug: (the seed it edits, the
# prompt). --edit paints <kind>-<slug>_<seed>-e<edit seed>.png from <kind>-<slug>_<seed>.png (kind: cover or inline), and
# COVERS or INLINE names the pick.
EDITS = {
    # Twelve seeds, and every flock had the wrong count or overlapping birds; 99 is clean but has one crane too many.
    "real-life-problem-solving-engineering-principles": (99, "Edit this picture. Remove the single small crane flying alone"
     " at the lower left, below the line of birds, and paint the sunset sky and clouds there instead. Keep the line of five"
     " cranes, the storm cloud, the lightning, the islands, the sea, the light and the painterly style exactly the same."
     " No text, no letters."),
    # Twelve seeds, and the model always finished the spiral.
    "openapi-spinning-spiral": (88, "Edit this picture. The web is only half built: take away every turn of the spiral"
     " outside the spider, so the outer half of the web is only the bare straight spokes running out to the edge, with"
     " nothing between them but the sky. Keep the spokes, the tight spiral round the hub out to the spider, the spider, the"
     " branches, the hills, the sky, the light and the painterly style exactly the same. No text, no letters."),
}

# Art inside a post, in its cover's habitat. name: (the picked seed, what it shows, the prompt); shown from static/images/blog/pixel/<name>.webp.
INLINE = {
    "hashmap-same-cell": (11, "equals() and hashCode(): equal objects land in the same bucket.",
     "A warm late-summer evening, amber and rose light through oak leaves. Close view of a wild beehive comb, a "
     "wall of very large golden hexagon cells filling the picture. In the exact middle, one single big empty "
     "cell, and two identical big bees in the same pose, one from the left and one from the right, both landing"
     " on that one cell. No other bees."),
    "hashmap-straight-to-cell": (33, "O(1): straight to the bucket. Is it? A small queue waits at the far end.",
     "A warm late-summer evening, amber and rose light through oak leaves. A wild beehive comb with very large "
     "golden hexagon cells fills the right half of the picture. On the left, one big bee in clear side profile "
     "flies straight towards one big cell in the middle of the comb. At the far right edge of the comb, three "
     "tiny bees queue nose to tail at another cell."),
    # Still the flat painting: in the painterly STYLE twelve seeds and two edits gave no clean comb (bees outside cells, empty or uneven cells, a comb tied on with cord).
    "hashset-one-per-cell": (33, "HashSet: the value is the key, so each bucket holds one bee and no honey.",
     "A warm late-summer evening, amber and rose light through oak leaves. Front view of a beehive comb, a tidy "
     "wall of very large hexagon cells, four across and three high. Every cell is empty and dark amber with no "
     "honey at all, and each cell holds exactly one big bee sitting in its centre, one bee per cell."),
    "break-hashmap-fixed-stone": (11, "Immutable: a marker that cannot move, so the acorn is always under it.",
     "An autumn forest floor at dusk, violet and orange sky, falling orange leaves, shown as a cut-away with the"
     " soil below. In the middle a huge grey boulder sunk deep into the ground, thick tree roots gripping it and"
     " moss on top, far too big to ever move. A red squirrel sits on top of it looking pleased. Directly under "
     "the boulder, the cut-away soil shows one acorn safely in a small round burrow."),
    # Still the flat painting: in the painterly STYLE twelve seeds gave no clean ants (crumbs doubled, an ant with two heads, an ant with no crumb).
    "gateway-digging": (55, "How to build it: the ants dig the fork and the chambers behind the one door.",
     "Late afternoon, warm amber sky over a thin strip of tall grass at the very top. Close cut-away of an ant "
     "nest under construction, the dark soil filling almost all of the picture. One wide horizontal tunnel runs "
     "across the middle, ending on the left in a finished round chamber and on the right in a rough unfinished "
     "wall of crumbling soil. Three very big black ants in clear side profile walk in a row along the tunnel, "
     "each ant as tall as the tunnel, each carrying one big crumb of soil on its back."),
    "openapi-mismatched-webs": (77, "No shared contract: two sides build towards each other and do not meet.",
     "A misty dawn in pale violet fog with soft layered hills, dark bare branches at both sides. Two separate "
     "half-finished spider webs of glistening silver silk that catches the dawn light. The left web hangs high in the "
     "picture, every outer thread tied to the left branch. The right web hangs low in the picture, every outer thread "
     "tied to the right branch. They "
     "are not at the same height and their patterns differ. Nothing joins them: a wide empty gap of plain fog "
     "fills the middle of the picture, with no thread crossing it. One small dark spider on each web."),
    "openapi-spinning-spiral": ("88-e33", "The generator: the plan's spokes are laid, and the spiral follows them on its own (an edit, in EDITS).",
     "A misty dawn in pale violet fog with soft layered hills, dark bare branches at the corners. One huge orb "
     "spider web of glistening silver silk under construction fills the picture, strung between the branches. All"
     " the bold straight spokes are finished, like the spokes of a wheel, but only the centre is spun: a small "
     "tight spiral of a few turns round the hub, and from there out to the frame the spokes are bare straight "
     "threads with nothing at all between them. A small dark spider sits at the outer end of the little spiral, "
     "spinning the next turn."),
    "openapi-first-catch": (11, "Implemented: the finished web does its job.",
     "A clear pale violet morning, one plain even sky colour behind the web, low soft hills at the bottom, dark "
     "bare branches at the corners. One huge orb spider web fills the picture, perfectly geometric and unbroken,"
     " strung between the branches, bold straight spokes and an even spiral of glistening silver silk. One big fat bluebottle fly with clear wings is stuck in the"
     " web, right of centre. One big dark spider walks along a spoke from the left towards the fly. Both are "
     "large and easy to see against the web."),
    "concurrency-parallel": (22, "Parallel: two birds, each feeding at its own flower at the same moment.",
     "Deep teal and violet tropical twilight, dark glossy leaves framing the picture. On the left a very large "
     "red trumpet flower on a stem from the left side, its open mouth facing right. On the right a very large "
     "blue trumpet flower on a stem from the right side, its open mouth facing left. Between them, two very "
     "large iridescent hummingbirds hover back to back at the same moment: the left bird faces left with its "
     "long beak deep inside the red flower's mouth, the right bird faces right with its long beak deep inside "
     "the blue flower's mouth. Every bird and flower is big and well inside the picture."),
    "concurrency-interleaved": (22, "Concurrent: one bird darts between two flowers, a sip at each in turn.",
     "Deep teal and violet tropical twilight, dark glossy leaves framing the picture. A very large red trumpet "
     "flower on the left and a very large blue trumpet flower on the right, on stems coming in from the sides,"
     " with plain sky between them. One very large iridescent hummingbird in clear side profile sips at the red"
     " flower, its long beak deep in its mouth. Behind it, two faint see-through ghost copies of the same bird"
     " show where it just was: one sipping at the blue flower, one in mid-air between the flowers. A bold "
     "dotted white trail weaves back and forth between the two flowers several times. Every bird and flower is"
     " big and well inside the picture."),
    "real-life-grounded-crane": (132, "The incident: one crane is down, and the flock lands to assess it.",
     "A tropical bay at sunset, tall green limestone karst islands rising from a teal sea. On a pale sandbar in "
     "the foreground, one large white crane with a long neck stands in the middle, its left wing drooping limp "
     "to the sand, clean and unhurt-looking but plainly unable to fly. One more large white crane stands on each"
     " side of it, a little apart, both turned towards the drooping wing. Two more cranes glide down from "
     "the coral sky, wings spread. Every crane is big, clearly separate from the others, with two legs and one "
     "head."),
    "real-life-retro": (77, "The retro: the flock stops and talks it over, briefly.",
     "A tropical bay at dusk, deep violet and orange sky, a thin moon, dark green limestone karst islands on a "
     "calm teal sea. Seen from a little above, on a pale sandbar in the foreground, exactly five large white "
     "cranes with long necks stand in a small ring, evenly spaced round an empty patch of sand, every crane's "
     "head turned in towards the middle of the ring, calm, like a meeting. Every crane is big and clearly "
     "separate, with two legs and one head."),
    "real-life-preening": (99, "Review: each checks the other's feathers, and finds what one alone would miss.",
     "A tropical bay in golden afternoon light, green limestone karst islands far away on a teal sea. Two very "
     "large white cranes with long necks stand in shallow water, both facing the same way, to the left, the "
     "second a full body length behind the first, so both bodies and all four legs are clearly separate. The "
     "front crane looks ahead, calm, holding one wing half open out behind it. The crane behind stands still "
     "with its wings neatly folded against its body, bends its long neck down and its beak gently touches one "
     "feather on the front crane's open wing, checking it. Each crane has exactly two thin legs."),
    # Still the flat painting: in the painterly STYLE twelve seeds and three edits gave no clean flock (cranes
    # overlapping or flying backwards, six or nine of them, the edits merging the leaders into one).
    "real-life-new-route": (44, "Requirements change: too hot here, so the flock turns for the cool highlands.",
     "One wide continuous landscape with no dividing line, the sky fading smoothly across the picture from hot "
     "orange on the left to cool pale blue on the right. On the far left a scorching sandy beach with wilted "
     "palm trees under a blazing white sun. The land rises gradually to misty green highlands and blue mountains"
     " on the far right. Seven large white cranes with long necks fly in a single curved line from over the "
     "beach towards the mountains. Every crane is big and clearly separate."),
}


# A cover's touch-up in code, run on its painting before --install writes the .jpg: slug: function(Image) -> Image.
# None now: every pick paints its idea as it is.
TOUCH_UPS = {}


def install():
    COVERS_DIR.joinpath("pixel").mkdir(exist_ok=True)
    for slug, (seed, _, _) in COVERS.items():
        candidate, jpg = CANDIDATES / f"cover-{slug}_{seed}.png", COVERS_DIR / f"{slug}.jpg"
        if candidate.exists():                                                 # touched up once, into the .jpg, the source after
            TOUCH_UPS.get(slug, lambda i: i)(Image.open(candidate).convert("RGB")).save(jpg, quality=90)
    for jpg in sorted(COVERS_DIR.glob("*.jpg")):                               # every committed cover, whatever COVERS lists
        save_lossless(P.bake(Image.open(jpg), SIZE), COVERS_DIR / "pixel" / f"{jpg.stem}.webp")   # as the hint does


# Art inside a post's touch-up in code, as TOUCH_UPS: none now.
INLINE_TOUCH_UPS = {}


def install_inline():
    INLINE_DIR.mkdir(exist_ok=True)
    for name, (seed, _, _) in INLINE.items():
        candidate = CANDIDATES / f"inline-{name}_{seed}.png"
        if not candidate.exists():                                             # its WebP is the source once the candidate is gone
            print("kept, no candidate:", name)
            continue
        painting = Image.open(candidate).convert("RGB")
        save_lossless(P.bake(INLINE_TOUCH_UPS.get(name, lambda i: i)(painting), INLINE_SIZE), INLINE_DIR / f"{name}.webp")


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
    base, init = "", None
    if args.edit:
        if args.slug not in EDITS:
            ap.error(f"no edit for {args.slug} in EDITS")
        base, prompt = f"{EDITS[args.slug][0]}-e", EDITS[args.slug][1]
        init = (CANDIDATES / f"{kind}-{args.slug}_{EDITS[args.slug][0]}.png").read_bytes()   # sent as it is, not re-encoded
    for k in range(args.count):
        seed = args.start + 11 * k
        paint_candidate(CANDIDATES / f"{kind}-{args.slug}_{base}{seed}.png", prompt, (1024, 576), seed, args.host, init, timeout=900, extra=PINNED)


if __name__ == "__main__":
    main()
