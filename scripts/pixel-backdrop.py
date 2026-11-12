"""Pixel-art backdrop for Team Tomate HQ: a tomato garden at the foot of soft hills.

Deterministic (no randomness at run time): the same file is produced every time.
Usage: python3 potager.py OUT.png [W H]
"""
import math
import sys
from PIL import Image

W, H = 240, 150
if len(sys.argv) >= 4:
    W, H = int(sys.argv[2]), int(sys.argv[3])

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# Palette — brand colours, softened for a daytime scene.
SKY = [rgb(c) for c in ('#9fd6e6', '#b4e0ea', '#c9e9ee', '#dcf0ee', '#eef4e6', '#fbf1d6')]
SUN, SUN_CORE = rgb('#f9c653'), rgb('#fde7a8')
CLOUD, CLOUD_SHADE = rgb('#ffffff'), rgb('#dcebf0')
HILLS = [  # far → near: (fill, top highlight)
    (rgb('#9ccfc9'), rgb('#b5ddd6')),
    (rgb('#6fb9a6'), rgb('#8bcbb8')),
    (rgb('#4c9f7a'), rgb('#69b58e')),
    (rgb('#3a8660'), rgb('#52a074')),
]
SOIL, SOIL_DARK, SOIL_LIGHT = rgb('#8a5a3a'), rgb('#6f452b'), rgb('#a36e48')
LEAF, LEAF_DARK, LEAF_LIGHT = rgb('#3fa34d'), rgb('#246e34'), rgb('#83d67f')
TOMATO, TOMATO_DARK, TOMATO_LIGHT = rgb('#e63b2b'), rgb('#b42a1e'), rgb('#ff8a75')
STAKE = rgb('#c9a070')

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

img = Image.new('RGB', (W, H))
px = img.load()

def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = c

def rect(x0, y0, w, h, c):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            put(x, y, c)

# ---- sky: banded gradient, ordered dithering between neighbouring bands ----
horizon = int(H * 0.62)
for y in range(H):
    t = min(1.0, y / horizon) * (len(SKY) - 1)
    i = min(len(SKY) - 2, int(t))
    frac = t - i
    for x in range(W):
        px[x, y] = SKY[i + 1] if frac > (BAYER[y % 4][x % 4] + 0.5) / 16 else SKY[i]

# ---- sun: stepped disc with a light core ----
sx, sy, sr = int(W * 0.74), int(H * 0.2), max(7, W // 26)
for y in range(-sr, sr + 1):
    for x in range(-sr, sr + 1):
        d = x * x + y * y
        if d <= sr * sr:
            put(sx + x, sy + y, SUN_CORE if d <= (sr - 3) ** 2 else SUN)

# ---- clouds: stacked slabs, lit from above ----
def cloud(cx, cy, scale=1):
    slabs = [(-9, 0, 20, 3), (-5, -3, 12, 3), (-1, -5, 6, 2), (-12, 3, 26, 2)]
    for (dx, dy, w, h) in slabs:
        rect(cx + dx * scale, cy + dy * scale, w * scale, h * scale, CLOUD)
    rect(cx - 12 * scale, cy + 4 * scale, 26 * scale, scale, CLOUD_SHADE)
    rect(cx - 9 * scale, cy + 2 * scale, 4 * scale, scale, CLOUD_SHADE)

cloud(int(W * 0.2), int(H * 0.17))
cloud(int(W * 0.5), int(H * 0.09))
cloud(int(W * 0.9), int(H * 0.33))
cloud(int(W * 0.06), int(H * 0.4))

# ---- hills: layered stepped silhouettes ----
def ridge(x, base, amp, f1, p1, f2, p2):
    v = math.sin(x * f1 + p1) * 0.62 + math.sin(x * f2 + p2) * 0.38
    return int(round(base + v * amp))

LAYERS = [
    (0.54, 0.070, 0.021, 0.6, 0.047, 2.1),
    (0.61, 0.060, 0.027, 2.4, 0.061, 0.3),
    (0.68, 0.050, 0.019, 4.1, 0.043, 1.2),
    (0.75, 0.035, 0.031, 1.0, 0.072, 3.3),
]
for (fill, top), (base, amp, f1, p1, f2, p2) in zip(HILLS, LAYERS):
    for x in range(W):
        y0 = ridge(x * 240 / W, base * H, amp * H, f1, p1, f2, p2)
        for y in range(y0, H):
            put(x, y, fill)
        put(x, y0, top)
        # sparse texture: a lighter pixel here and there on the slope
        if (x * 7 + y0 * 13) % 11 == 0:
            put(x, y0 + 3, top)
        if (x * 5 + y0 * 3) % 17 == 0:
            put(x, y0 + 7, top)

# ---- a few conifers on the slopes ----
TREE, TREE_DARK, TREE_LIGHT = rgb('#2f7a55'), rgb('#225f44'), rgb('#4c9f7a')

def tree(x, y, tall=False):
    rows = [1, 3, 5, 3, 5, 7] if tall else [1, 3, 5]
    for i, w in enumerate(rows):
        yy = y - (len(rows) - i)
        for dx in range(-(w // 2), w // 2 + 1):
            put(x + dx, yy, TREE_LIGHT if dx == -(w // 2) and w > 1 else (TREE_DARK if dx > 0 else TREE))
    put(x, y, rgb('#5b3d28'))

def slope_y(x, layer):
    base, amp, f1, p1, f2, p2 = LAYERS[layer]
    return ridge(x * 240 / W, base * H, amp * H, f1, p1, f2, p2)

for (x, layer, tall, dy) in [(22, 2, True, 3), (27, 2, False, 4), (33, 2, True, 5), (96, 3, False, 2), (101, 3, True, 3),
                             (150, 2, False, 4), (156, 2, True, 3), (161, 2, False, 5), (205, 3, True, 2), (212, 3, False, 4),
                             (218, 3, True, 3), (68, 3, False, 5)]:
    xx = int(x * W / 240)
    tree(xx, slope_y(xx, layer) + dy, tall)

# ---- garden: a meadow with two planted rows ----
GRASS, GRASS_LIGHT, GRASS_DARK = HILLS[3][0], rgb('#4a9a6e'), rgb('#2f7552')
ground = int(H * 0.855)
for y in range(ground, H):
    for x in range(W):
        band = (y - ground) // 3
        px[x, y] = GRASS_LIGHT if (x + band * 5 + y * 2) % 13 == 0 else (GRASS_DARK if (x * 3 + y * 7) % 29 == 0 else GRASS)
for x in range(W):
    put(x, ground - 1, HILLS[3][1])
    if (x * 3) % 7 < 2:
        put(x, ground - 2, HILLS[3][1])

# The garden starts a quarter of the way in: on a desktop the left of the scene sits behind
# the navigation, and plants cut by the narrow gap beside it would read as noise.
GARDEN_X0 = int(W * 0.26)

def bed(y):
    """A narrow strip of turned soil under a row of plants."""
    for x in range(GARDEN_X0 - 4, W):
        put(x, y, SOIL if (x // 3) % 5 else SOIL_LIGHT)
        put(x, y + 1, SOIL_DARK if x % 4 else SOIL)

def plant(x, y, big=False):
    """A staked tomato plant whose foot is at (x, y)."""
    h = 13 if big else 9
    for i in range(h):
        put(x, y - i, STAKE)
    for (dx, dy, c) in [(-2, 2, LEAF_DARK), (-1, 2, LEAF), (1, 2, LEAF), (2, 2, LEAF_DARK),
                        (-2, 3, LEAF), (-1, 3, LEAF_LIGHT), (1, 3, LEAF), (2, 3, LEAF),
                        (-3, 4, LEAF_DARK), (-2, 4, LEAF), (-1, 4, LEAF), (1, 4, LEAF_LIGHT), (2, 4, LEAF), (3, 4, LEAF_DARK),
                        (-2, 5, LEAF), (-1, 5, LEAF_DARK), (1, 5, LEAF), (2, 5, LEAF),
                        (-3, 6, LEAF), (-2, 6, LEAF_LIGHT), (-1, 6, LEAF), (1, 6, LEAF), (2, 6, LEAF_DARK),
                        (-1, 7, LEAF), (1, 7, LEAF)]:
        if dy < h:
            put(x + dx, y - dy, c)
    if big:
        for (dx, dy, c) in [(-3, 8, LEAF), (-2, 8, LEAF), (-1, 8, LEAF_LIGHT), (1, 8, LEAF), (2, 8, LEAF_DARK), (3, 8, LEAF),
                            (-2, 9, LEAF_DARK), (-1, 9, LEAF), (1, 9, LEAF), (2, 9, LEAF),
                            (-1, 10, LEAF), (1, 10, LEAF_LIGHT), (-2, 10, LEAF)]:
            put(x + dx, y - dy, c)
    # fruit: 2×2 tomatoes with a highlight
    for (dx, dy) in ([(-3, 3), (2, 5)] + ([(-4, 7), (3, 9)] if big else [])):
        rect(x + dx, y - dy - 1, 2, 2, TOMATO)
        put(x + dx, y - dy - 1, TOMATO_LIGHT)
        put(x + dx + 1, y - dy, TOMATO_DARK)

rows = [(ground + 3, 22, 4, False), (ground + 15, 30, 12, True)]
for (y, step, offset, big) in rows:
    bed(y)
    for x in range(GARDEN_X0 + offset, W + step, step):
        plant(x, y, big)

img.save(sys.argv[1], optimize=True)
print('saved', sys.argv[1], img.size)
