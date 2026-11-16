from colorsys import rgb_to_hsv
from pathlib import Path

from PIL import Image, ImageDraw


site = Path(__file__).resolve().parent / 'recess'
assets = site / 'assets'
poses = ('ready', 'step', 'windup', 'strike', 'follow', 'hit', 'down', 'victory', 'run')

# Pose-specific bounds for the jacket, trousers, bag and shoes in a normalized frame.
regions = {
    'boy': (
        ((70,94,209,190), (85,170,194,219), (65,105,174,204), (55,214,225,254)),
        ((65,104,201,190), (91,170,187,222), (77,111,162,209), (69,201,212,254)),
        ((48,106,181,222), (90,172,191,242), (58,159,149,210), (70,213,170,254)),
        ((63,99,235,200), (67,168,186,227), (54,120,163,218), (27,213,218,254)),
        ((72,100,216,235), (61,170,165,226), (49,143,164,201), (26,206,178,254)),
        ((83,108,200,191), (119,168,219,222), (96,110,162,225), (116,215,226,254)),
        ((67,136,172,233), (113,191,206,253), (50,162,157,237), (121,192,231,254)),
        ((76,66,218,168), (115,156,200,217), (58,108,166,194), (81,198,186,254)),
        ((56,86,228,187), (77,155,207,237), (64,117,178,191), (26,179,255,254)),
    ),
    'girl': (
        ((79,102,216,192), (72,166,200,234), (76,112,169,199), (50,214,220,254)),
        ((86,106,208,194), (108,165,188,222), (87,112,172,201), (91,199,224,254)),
        ((64,109,205,210), (91,171,204,230), (65,151,162,203), (71,213,230,254)),
        ((55,103,242,204), (20,171,205,238), (32,123,157,216), (0,216,218,254)),
        ((71,106,204,241), (50,173,216,232), (50,151,164,198), (26,214,238,254)),
        ((103,111,221,206), (146,162,245,235), (116,119,193,215), (128,215,244,254)),
        ((51,140,191,233), (80,189,220,249), (27,157,163,239), (109,195,241,254)),
        ((101,70,236,178), (121,160,214,226), (84,111,184,193), (83,202,191,254)),
        ((69,94,236,183), (68,165,223,245), (85,111,187,190), (19,182,254,254)),
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
        rules.append(f"[data-sprite='{gender}'][data-pose='{pose}'] {{ --wardrobe-base: url('assets/{prefix}.webp'); --wardrobe-mask: url('assets/{mask}'); }}")

(site / 'wardrobe.css').write_text('\n'.join(rules) + '\n', encoding='utf-8')
