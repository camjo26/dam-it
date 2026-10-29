"""
Cuts the board artwork out of the printed component sheets in the project root and writes
it to public/art, which is what the board actually draws.

The sheets are a regular grid, so the tiles come straight off a computed lattice rather
than hand-measured boxes. Icons are lifted from the illustrated rules sheet and have their
cream paper background flooded away so they sit on any panel colour.

Run it from the project root:

    python scripts/extract-art.py

It is idempotent - it overwrites what it wrote last time and touches nothing else.
"""

import os
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'art')

TILE_SHEET = 'River Crossing Tile Sheet.png'
WHIRL_SHEET = 'Whirlpools.png'
MAP_SHEET = 'River Crossing Starter Map.png'
RULES_SHEET = 'DAM IT_ Illustrated River Game Rules.png'

# The tile sheet lattice, read off the sheet itself: ten columns and six rows of tiles,
# every tile the same size, which is the whole point of the printed sheet.
TILE_COL_X = [18, 148, 276, 404, 533, 660, 788, 915, 1042, 1169]
TILE_ROW_Y = [96, 252, 409, 566, 723, 880]
TILE_W = 124
TILE_H = 122

# The whirlpool sheet is a five by three lattice of much larger tiles.
WHIRL_COL_X = [28, 329, 627, 927, 1225]
WHIRL_ROW_Y = [104, 386, 672]
WHIRL_W = 287
WHIRL_H = 264

TILE_PX = 128                 # every tile is written out square at this size
TOKEN_PX = 128                # faction tokens, drawn as circles
ICON_PX = 96                  # resource and equipment icons
ICON_COLOURS = 192            # palette size for the app icon, which is a whole scene

# The component sheets are also shipped whole, for the reference tab, but as JPEGs rather
# than the 2 to 3 MB PNGs they arrive as. At this quality the small print on the rules
# sheet is still readable, which is the only thing that tab is for.
REFERENCE_MAX_PX = 1500
REFERENCE_QUALITY = 88
REFERENCE_SHEETS = {
    'rules': RULES_SHEET,
    'costs': 'Cost Guide.png',
    'power-cards': 'River Power Cards Infographic.png',
    'missions': 'Missions.jpg',
    'market': 'The Market_ River Resource Board.png',
    'starter-map': MAP_SHEET,
    'whirlpools': WHIRL_SHEET,
    'tile-sheet': TILE_SHEET,
}

# Measured off the sheet rather than guessed: the card stock runs from about
# (235, 202, 145) in shadow to (252, 238, 207) in the light, so it is bright, warm and
# always redder than it is blue. Requiring that warmth is what keeps the stone icon's
# light grey highlights, which are bright but neutral.
PAPER_MIN_R = 224
PAPER_MIN_G = 188
PAPER_MIN_B = 120
PAPER_MIN_WARMTH = 25
PAPER_MAX_WARMTH = 115


def sheet(name: str) -> Image.Image:
    return Image.open(os.path.join(ROOT, name)).convert('RGB')


def tile(img: Image.Image, col: int, row: int) -> Image.Image:
    x, y = TILE_COL_X[col], TILE_ROW_Y[row]
    cut = img.crop((x, y, x + TILE_W, y + TILE_H))
    return cut.resize((TILE_PX, TILE_PX), Image.LANCZOS)


def whirl(img: Image.Image, col: int, row: int) -> Image.Image:
    x, y = WHIRL_COL_X[col], WHIRL_ROW_Y[row]
    cut = img.crop((x, y, x + WHIRL_W, y + WHIRL_H))
    return cut.resize((TILE_PX, TILE_PX), Image.LANCZOS)


def is_paper(px) -> bool:
    r, g, b = px[0], px[1], px[2]
    if r < PAPER_MIN_R or g < PAPER_MIN_G or b < PAPER_MIN_B:
        return False
    if not (r >= g >= b):
        return False
    return PAPER_MIN_WARMTH <= r - b <= PAPER_MAX_WARMTH


def drop_paper(img: Image.Image) -> Image.Image:
    """
    Makes the cream paper transparent so an icon sits on any panel colour.

    Flooded in from the border rather than thresholded, because the brightest highlights
    on the wood and rope are the same cream as the card. Every icon on the sheet is drawn
    with a dark outline, so the flood stops at the edge of the art and never reaches those
    highlights. The crops are taken strictly inside each card, so the card's own printed
    border is out of frame and cannot dam the flood either.
    """
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    queue = deque()

    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if not is_paper(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return img


def circle_mask(img: Image.Image) -> Image.Image:
    """Crops an image to a circle, so a faction token sits on a tile without a square."""
    from PIL import ImageDraw

    size = min(img.size)
    img = img.crop((0, 0, size, size)).resize((TOKEN_PX, TOKEN_PX), Image.LANCZOS)
    mask = Image.new('L', (TOKEN_PX * 4, TOKEN_PX * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, TOKEN_PX * 4 - 1, TOKEN_PX * 4 - 1), fill=255)
    mask = mask.resize((TOKEN_PX, TOKEN_PX), Image.LANCZOS)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


def icon(img: Image.Image, box, size: int = ICON_PX) -> Image.Image:
    cut = drop_paper(img.crop(box))
    side = max(cut.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2))
    return square.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, *parts: str) -> None:
    path = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print(f'  {os.path.relpath(path, ROOT)}  {img.width}x{img.height}')


def main() -> None:
    print('Tiles')
    tiles = sheet(TILE_SHEET)
    # Row 0 is plain water, rows 1 to 3 are currents 1 to 3, row 4 holds the four rare
    # current 4 tiles then the small islands, and row 5 is all large islands.
    for n, col in enumerate(('a', 'b', 'c'), start=0):
        save(tile(tiles, n * 3, 0), 'tile', f'plain-{col}.png')
    for strength, row in ((1, 1), (2, 2), (3, 3)):
        for n, letter in enumerate(('a', 'b', 'c')):
            save(tile(tiles, n * 3, row), 'tile', f'current-{strength}-{letter}.png')
    for n, letter in enumerate(('a', 'b')):
        save(tile(tiles, n, 4), 'tile', f'current-4-{letter}.png')
    for n, letter in zip((4, 6, 8), ('a', 'b', 'c')):
        save(tile(tiles, n, 4), 'tile', f'island-small-{letter}.png')
    for n, letter in zip((0, 3, 6), ('a', 'b', 'c')):
        save(tile(tiles, n, 5), 'tile', f'island-large-{letter}.png')

    print('Whirlpools')
    whirls = sheet(WHIRL_SHEET)
    for n, letter in enumerate(('a', 'b', 'c')):
        save(whirl(whirls, n, n), 'tile', f'whirlpool-{letter}.png')

    print('Banks')
    board = sheet(MAP_SHEET)
    # The title cartouche sits over the left of the top bank, so the strip starts past it.
    save(board.crop((440, 4, 1530, 150)), 'bank-top.png')
    save(board.crop((10, 756, 1100, 834)), 'bank-bottom.png')

    print('Factions')
    rules = sheet(RULES_SHEET)
    roundels = {'ducks': 86, 'swans': 186, 'frogs': 284, 'beavers': 379}
    for name, top in roundels.items():
        save(circle_mask(rules.crop((769, top, 769 + 82, top + 82))), 'faction', f'{name}.png')

    print('Resources')
    # The four resource cards sit on an 82 pixel pitch. Each crop is inset so the card's
    # printed border and its label are both out of frame.
    for n, name in enumerate(('wood', 'stone', 'clay', 'reeds')):
        left = 32 + n * 82
        save(icon(rules, (left, 891, left + 70, 957)), 'res', f'{name}.png')

    print('App icon')
    # The hero panel's river scene, cropped below the rules sign. It is 32 pixels short of
    # square, so its own top row of sky is repeated upward to make up the difference
    # rather than stretching the animals.
    scene = rules.crop((24, 232, 352, 528))
    icon_img = Image.new('RGB', (scene.width, scene.width))
    # Sampled a few rows down, clear of the shadow the rules sign casts on the sky.
    sky = scene.crop((0, 10, scene.width, 11)).resize(
        (scene.width, scene.width - scene.height), Image.NEAREST)
    icon_img.paste(sky, (0, 0))
    icon_img.paste(scene, (0, scene.width - scene.height))
    for px_size in (192, 512):
        out = icon_img.resize((px_size, px_size), Image.LANCZOS)
        out = out.quantize(colors=ICON_COLOURS, method=Image.MAXCOVERAGE)
        path = os.path.join(ROOT, 'public', f'icon-{px_size}.png')
        out.save(path, optimize=True)
        print(f'  {os.path.relpath(path, ROOT)}  {px_size}x{px_size}'
              f'  {os.path.getsize(path) // 1024} KB')

    print('Equipment')
    kit = {
        'dam': (769, 601, 873, 698),
        'rope': (772, 716, 867, 789),
        'anchor': (770, 791, 867, 878),
        'raft': (767, 896, 872, 974),
    }
    for name, box in kit.items():
        save(icon(rules, box), 'kit', f'{name}.png')

    print('Reference sheets')
    out_dir = os.path.join(ROOT, 'public', 'rules')
    os.makedirs(out_dir, exist_ok=True)
    for name, source in REFERENCE_SHEETS.items():
        img = sheet(source)
        if max(img.size) > REFERENCE_MAX_PX:
            ratio = REFERENCE_MAX_PX / max(img.size)
            img = img.resize((round(img.width * ratio), round(img.height * ratio)),
                                                                      Image.LANCZOS)
        path = os.path.join(out_dir, f'{name}.jpg')
        img.save(path, quality=REFERENCE_QUALITY, optimize=True, progressive=True)
        print(f'  {os.path.relpath(path, ROOT)}  {img.width}x{img.height}'
              f'  {os.path.getsize(path) // 1024} KB')


if __name__ == '__main__':
    main()
