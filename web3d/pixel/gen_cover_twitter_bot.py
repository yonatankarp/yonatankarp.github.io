# /// script
# dependencies = ["pillow==12.1.0"]
# ///
"""The cover of "Build your own Twitter Bot with Kotlin": the bot reads tweets.txt a line at a time, lets each go, and
its chest counts the 30 minutes to the next one. Generic birds, no Twitter or Kotlin marks.

Run: uv run web3d/pixel/gen_cover_twitter_bot.py [static/images/blog/covers]

Writes pixel/build-twitter-bot-kotlin.png straight from the grid (pixelate.py's lone-pixel cleanup would eat the sky's
dither) and build-twitter-bot-kotlin.jpg, the same picture in whole cells, for share cards.
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_floors as G  # noqa: E402  (module level only defines data; main is guarded)

W, H, JPG_SCALE = 192, 108, 8
R, INK = G.R, G.INK
SKY = [R["violet"][1], R["violet"][2], R["sky"][3], R["sky"][4], R["sky"][5]]
HORIZON = 80
GLYPHS = {
    "T": ["###", ".#.", ".#.", ".#.", ".#."], "W": ["#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
    "E": ["###", "#..", "##.", "#..", "###"], "S": ["###", "#..", "###", "..#", "###"],
    "X": ["#.#", "#.#", ".#.", "#.#", "#.#"], ".": [".", ".", ".", ".", "#"],
    "3": ["###", "..#", ".##", "..#", "###"], "0": ["###", "#.#", "#.#", "#.#", "###"],
    "M": ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
}
BIRD_UP = [           # flying right, wing raised
    "...kkk..........",
    "..kBBBk.........",
    "..kBBBBk........",
    "...kBBBBk..kkk..",
    "....kBBBBkkbbbk.",
    "kkk..kBBbbbkbbkaa",
    "kbbkkkbbbbbbbbk.",
    ".kkbbbbbbWWWWk..",
    "...kkkWWWWWkk...",
    "......kkkkk.....",
]
BIRD_DOWN = [         # wing lowered
    "................",
    "...........kkk..",
    "..........kbbbk.",
    "kkk..kkkkkkbkbkaa",
    "kbbkkbbbbbbbbbk.",
    ".kkbbbBBBBbWWk..",
    "...kkBBBBBWWWk..",
    "....kBBBBkkkk...",
    "....kBBBk.......",
    ".....kkk........",
]
BIRD = {"k": INK, "b": R["blue"][4], "B": R["blue"][5], "W": R["cream"][5], "a": R["amber"][4]}

im = Image.new("RGB", (W, H), SKY[0])
px = im.load()


def rect(x0, y0, x1, y1, c):
    im.paste(c, (x0, y0, x1 + 1, y1 + 1))


def box(x0, y0, x1, y1, fill, hi=None, lo=None):
    """An ink-outlined block, lit along its top and left, shaded along its bottom and right."""
    rect(x0, y0, x1, y1, INK)
    rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)
    if lo:
        rect(x1 - 1, y0 + 1, x1 - 1, y1 - 1, lo)
        rect(x0 + 1, y1 - 1, x1 - 1, y1 - 1, lo)
    if hi:
        rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, hi)
        rect(x0 + 1, y0 + 1, x0 + 1, y1 - 1, hi)


def text(x, y, s, c):
    for ch in s:
        glyph = GLYPHS[ch]
        for j, row in enumerate(glyph):
            for i, on in enumerate(row):
                if on == "#":
                    px[x + i, y + j] = c
        x += len(glyph[0]) + 1


def sprite(x, y, rows, colours):
    for j, row in enumerate(rows):
        for i, k in enumerate(row):
            if k in colours:
                px[x + i, y + j] = colours[k]


def sky():
    span = (HORIZON - 1) / (len(SKY) - 1)
    for y in range(HORIZON):
        t = y / span
        i = min(int(t), len(SKY) - 2)
        for x in range(W):
            px[x, y] = SKY[i + 1] if t - i > G.BAYER[y % 4][x % 4] / 16 else SKY[i]
    rect(0, HORIZON, W - 1, 92, SKY[-1])


def skyline():
    x = 0
    for w, top in ((14, 70), (18, 62), (11, 74), (20, 66), (13, 72), (16, 60), (22, 68), (12, 75), (19, 64), (14, 71), (18, 66), (15, 72)):
        rect(x, top, x + w - 1, 92, R["sky"][1])
        rect(x, top, x + w - 1, top, R["sky"][2])
        for wy in range(top + 3, 90, 4):
            for wx in range(x + 2, x + w - 2, 3):
                if (wx * 7 + wy * 3 + w) % 5 < 2:
                    px[wx, wy] = R["amber"][4]
        x += w


def roof():
    rect(0, 92, W - 1, H - 1, R["plank"][2])
    rect(0, 92, W - 1, 92, INK)
    rect(0, 93, W - 1, 94, R["steel"][3])          # the parapet's coping
    rect(0, 95, W - 1, 95, R["steel"][1])
    for y in range(96, H, 4):                      # brick courses
        rect(0, y + 3, W - 1, y + 3, R["plank"][1])
        for x in range((y // 4 % 2) * 4, W, 8):
            rect(x, y, x, y + 2, R["plank"][1])


def page():
    """tweets.txt on its stand: sent lines dimmed, the current one lit, the rest waiting."""
    for x in (10, 40):
        rect(x, 86, x + 2, 92, R["wood"][1])
    sky_strip = im.crop((42, 20, 49, 27))          # the dog-ear: sky outside the fold, the paper's back inside
    box(4, 20, 48, 88, R["cream"][5], lo=R["cream"][3])
    for i in range(7):
        rect(42, 20 + i, 42 + i, 20 + i, R["cream"][3])
        px[42 + i, 20 + i] = INK
        im.paste(sky_strip.crop((i + 1, i, 7, i + 1)), (43 + i, 20 + i))
    rect(42, 20, 42, 26, INK)
    rect(42, 26, 48, 26, INK)
    text(7, 29, "TWEETS.TXT", R["dark"][2])
    rect(7, 35, 45, 35, R["cream"][2])
    for i, n in enumerate((31, 25, 35, 28, 33, 20, 35, 26)):
        y = 39 + i * 6
        if i == 3:                                 # the line being read
            rect(5, y - 2, 47, y + 2, R["amber"][4])
            rect(7, y - 1, 7 + n, y, R["dark"][1])
        elif i < 3:
            rect(7, y - 1, 7 + n, y, R["cream"][3])
        else:
            rect(7, y - 1, 7 + n, y, R["dark"][3])


def feed():
    """The line runs off the page and into the bot."""
    y = 39 + 3 * 6
    rect(47, y - 3, 60, y + 3, INK)
    rect(47, y - 2, 60, y + 2, R["amber"][4])
    for x in (49, 53, 57):
        rect(x, y - 1, x + 2, y, R["amber"][1])


def robot():
    S = R["steel"]
    for x in (64, 80):                             # legs and feet
        box(x + 1, 80, x + 7, 88, S[2], lo=S[1])
        box(x - 1, 86, x + 9, 91, S[3], hi=S[5], lo=S[1])
    box(58, 50, 94, 82, S[4], hi=S[5], lo=S[2])    # body
    # chest timer: 30 minutes to the next tweet
    box(65, 56, 87, 76, R["dark"][0])
    rect(66, 57, 86, 57, R["dark"][2])
    text(69, 60, "30M", R["cyan"][5])
    rect(68, 69, 84, 72, R["dark"][2])             # the wait, half gone
    rect(68, 69, 76, 72, R["cyan"][4])
    rect(71, 46, 81, 50, INK)                      # neck
    rect(72, 46, 80, 50, S[2])
    box(60, 24, 92, 47, S[4], hi=S[5], lo=S[2])    # head
    box(55, 30, 60, 40, S[3], hi=S[5], lo=S[1])    # ears
    box(92, 30, 97, 40, S[3], hi=S[5], lo=S[1])
    for x in (65, 78):                             # eyes
        box(x, 29, x + 9, 38, R["dark"][0])
        rect(x + 2, 31, x + 7, 36, R["cyan"][4])
        rect(x + 2, 31, x + 4, 33, R["cyan"][5])
    rect(68, 41, 84, 44, INK)                      # mouth grille
    for x in range(70, 84, 3):
        rect(x, 42, x + 1, 43, S[3])
    rect(75, 15, 77, 24, INK)                      # antenna
    rect(76, 15, 76, 23, S[5])
    rect(73, 7, 79, 15, INK)
    rect(72, 8, 80, 14, INK)
    rect(73, 8, 79, 14, R["amber"][4])
    rect(74, 9, 75, 10, R["amber"][5])
    rect(73, 13, 79, 14, R["amber"][2])
    # raised arm, the gripper just opened on a tweet
    rect(94, 60, 106, 66, INK)
    rect(94, 61, 105, 65, S[3])
    rect(94, 61, 105, 61, S[5])
    box(100, 46, 107, 66, S[3], hi=S[5], lo=S[1])
    box(97, 42, 110, 48, S[4], hi=S[5], lo=S[2])
    box(97, 35, 101, 43, S[4], hi=S[5], lo=S[2])
    box(106, 35, 110, 43, S[4], hi=S[5], lo=S[2])
    box(50, 62, 58, 78, S[3], hi=S[5], lo=S[1])    # the other arm, at its side


def tweet(x, y, flap):
    """A bird carrying a tweet: a speech bubble, up and to the right."""
    w, h = 25, 14
    sprite(x + 4, y - 11, BIRD_UP if flap else BIRD_DOWN, BIRD)
    rect(x + 11, y - 1, x + 11, y, INK)            # legs
    rect(x + 15, y - 1, x + 15, y, INK)
    rect(x + 1, y, x + w - 2, y + h - 1, INK)
    rect(x, y + 1, x + w - 1, y + h - 2, INK)
    rect(x + 1, y + 1, x + w - 2, y + h - 2, R["cream"][5])
    rect(x + 1, y + h - 2, x + w - 2, y + h - 2, R["cream"][3])
    rect(x + 4, y + 3, x + w - 5, y + 4, R["dark"][3])
    rect(x + 4, y + 7, x + w - 9, y + 8, R["dark"][3])
    sprite(x + 1, y + h - 2, ["kwwwk", "kwwk.", "kwk..", "kk..."], {"k": INK, "w": R["cream"][5]})


def draw():
    sky()
    skyline()
    roof()
    page()
    feed()
    robot()
    for i, (x, y) in enumerate(((114, 50), (140, 33), (166, 16))):   # evenly spaced: the bot sleeps between tweets
        tweet(x, y, i % 2 == 0)
    assert im.size == (W, H)
    return im


if __name__ == "__main__":
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "static/images/blog/covers")
    art = draw()
    palette = {c for ramp in R.values() for c in ramp} | {INK}
    assert {c for _, c in art.getcolors()} <= palette, "off-palette colour"
    art.save(root / "pixel/build-twitter-bot-kotlin.png")
    art.resize((W * JPG_SCALE, H * JPG_SCALE), Image.NEAREST).save(root / "build-twitter-bot-kotlin.jpg", quality=95, subsampling=0)
    print(len(art.getcolors()), "colours")
