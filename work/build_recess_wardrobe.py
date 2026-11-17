from colorsys import rgb_to_hsv
from pathlib import Path

from PIL import Image, ImageDraw


site = Path(__file__).resolve().parent / 'recess'
assets = site / 'assets'
poses = ('ready', 'step', 'run', 'hit', 'down', 'victory', 'toss-windup', 'toss-strike', 'toss-follow', 'push-windup', 'push-strike', 'push-follow')

# Pose-specific bounds for the jacket, trousers, bag and shoes in a normalized frame.
regions = {
    'boy': (
        ((70,99,208,184), (103,168,187,218), (87,117,163,198), (92,222,194,254)),
        ((60,102,215,194), (92,174,185,222), (83,115,166,208), (69,209,214,254)),
        ((62,104,214,192), (100,170,186,218), (57,121,168,201), (44,198,220,254)),
        ((74,105,207,193), (116,163,204,223), (94,113,159,211), (112,211,215,254)),
        ((67,123,197,223), (84,186,213,243), (51,139,156,244), (106,201,225,254)),
        ((59,93,202,187), (106,146,202,215), (81,111,165,188), (101,182,228,254)),
        ((48,94,213,190), (77,169,194,218), (58,116,169,213), (51,213,197,254)),
        ((62,101,231,196), (75,169,205,224), (51,130,163,215), (50,213,206,254)),
        ((55,94,216,191), (82,162,208,217), (61,114,166,209), (61,211,216,254)),
        ((68,94,220,195), (77,167,208,224), (49,117,159,202), (63,212,211,254)),
        ((73,100,236,192), (60,169,192,225), (43,124,174,200), (27,207,199,254)),
        ((67,96,218,191), (79,161,193,223), (60,114,157,204), (58,211,204,254)),
    ),
    'girl': (
        ((67,104,191,191), (77,165,150,233), (82,116,142,190), (74,220,159,254)),
        ((57,109,212,189), (80,166,185,234), (88,113,167,195), (72,208,207,254)),
        ((70,106,210,187), (62,161,196,239), (50,128,167,198), (48,182,212,254)),
        ((72,93,216,178), (108,150,207,235), (100,102,161,183), (121,214,219,254)),
        ((52,118,185,218), (73,186,190,250), (44,150,132,242), (118,194,207,254)),
        ((59,89,203,179), (76,147,173,232), (67,102,163,182), (48,163,171,254)),
        ((61,99,230,206), (69,175,191,239), (69,125,171,197), (60,221,209,254)),
        ((61,96,227,206), (68,175,208,239), (60,127,173,202), (54,220,212,254)),
        ((65,96,190,190), (45,165,171,239), (49,123,154,196), (33,222,181,254)),
        ((55,101,220,191), (48,173,212,240), (47,126,160,193), (25,220,217,254)),
        ((60,101,238,189), (46,166,188,242), (54,123,169,193), (20,214,189,254)),
        ((64,98,225,192), (62,170,197,241), (53,120,169,195), (58,214,210,254)),
    ),
}

rules = []
for gender, bounds in regions.items():
    for pose, (top, bottom, bag, shoes) in zip(poses, bounds, strict=True):
        prefix = f'motion-{gender}-{pose}'
        image = Image.open(assets / f'{prefix}.webp').convert('RGBA')
        slots = Image.new('RGB', image.size)
        colors = slots.load()
        px = image.load()

        def inside(box, x, y):
            return box[0] <= x <= box[2] and box[1] <= y <= box[3]

        for y in range(image.height):
            for x in range(image.width):
                red, green, blue, alpha = px[x, y]
                if alpha < 32:
                    continue
                hue, sat, val = rgb_to_hsv(red / 255, green / 255, blue / 255)
                hue *= 360
                purple = 245 <= hue <= 325 and sat > 0.17 and val > 0.25
                fabric = sat < 0.20 and val > 0.35
                ivory = 10 <= hue <= 65 and sat <= (0.31 if gender == 'boy' else 0.29) and val > 0.40
                if inside(bag, x, y) and 17 <= hue <= 68 and sat > 0.48 and val > 0.27:
                    colors[x, y] = (0, 0, 255)
                elif inside(shoes, x, y) and (fabric or ivory or (purple and gender == 'boy')):
                    if y < shoes[1] + 9 and gender == 'boy' and pose in ('run', 'follow', 'down', 'victory') and x > 112:
                        continue
                    colors[x, y] = (255, 255, 0)
                elif inside(bottom, x, y) and ((fabric or ivory) if gender == 'boy' else purple):
                    colors[x, y] = (0, 255, 0)
                elif inside(top, x, y) and purple:
                    colors[x, y] = (255, 0, 0)

        if any(sum(n == color for n in slots.get_flattened_data()) < 50 for color in ((255,0,0), (0,255,0), (0,0,255), (255,255,0))):
            raise ValueError(f'Incomplete clothing mask for {gender} {pose}')
        mask = f'wardrobe-{gender}-{pose}.webp'
        slots.save(assets / mask, lossless=True, method=6)
        family, dash, action = pose.partition('-')
        selector = f"[data-sprite='{gender}'][data-pose='{action if dash else pose}']"
        declarations = f"{{ --wardrobe-base: url('assets/{prefix}.webp'); --wardrobe-mask: url('assets/{mask}'); }}"
        if dash:
            rules.append(f".arena[data-motion='{family}'] {selector} {declarations}")
            if family == 'toss':
                rules.append(f'{selector} {declarations}')
        else:
            rules.append(f'{selector} {declarations}')

(site / 'wardrobe.css').write_text('\n'.join(rules) + '\n', encoding='utf-8')
