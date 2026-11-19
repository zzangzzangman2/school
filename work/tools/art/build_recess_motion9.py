"""Build original key frames and garment masks for the ninth art handoff."""

from argparse import ArgumentParser
from io import BytesIO
from pathlib import Path
from subprocess import check_output
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile

import cv2
import numpy as np
from PIL import Image, ImageDraw

from build_recess_motion7 import Frame, save_strip
from build_recess_motion8 import atlas_tiles


WORK = Path(__file__).resolve().parents[2]
ASSETS = WORK / 'recess' / 'assets'
OUTPUT = WORK.parent / 'outputs'
BASE = '878e870'
W, H, GROUND = 280, 255, 249
Y, X = np.indices((H, W), dtype=np.float32)
RESAMPLE = Image.Resampling.LANCZOS
COLORS = np.array([(0, 0, 0), (255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0)], dtype=np.uint8)
CLIPS = ('idle', 'run', 'punch', 'hit', 'down', 'victory', 'kick', 'knee', 'throw',
         'hold', 'guard', 'rush', 'counter', 'combo', 'cheer', 'drink', 'step')
ATLASES = {
    'legs': ('b3350d74-42dd-4aa7-a103-f40ea948f499', 2, 2),
    'hands': ('e73a70fb-804f-4dda-81d6-a19f8c6dc131', 2, 3),
    'grapple': ('8592c776-74eb-4989-a221-7aeb25f1dccd', 2, 3),
    'hit': ('4e7d39d9-a372-4630-a977-8de82f60029f', 2, 2),
    'getup': ('541520a9-a424-4ed3-b58a-c6fc490b79ae', 1, 3),
}
TWEENS = {
    'kick': {2: ('legs', 0), 4: ('legs', 1)},
    'knee': {2: ('legs', 2), 4: ('legs', 3)},
    'combo': {2: ('hands', 0)},
    'rush': {1: ('hands', 1), 2: ('hands', 2), 5: ('hands', 3)},
    'counter': {2: ('hands', 4), 5: ('hands', 5)},
    'hold': {1: ('grapple', 0), 3: ('grapple', 1)},
    'throw': {3: ('grapple', 2), 4: ('grapple', 3)},
    'down': {2: ('grapple', 4)},
}
HIT_FRAME = {'punch': 3, 'kick': 4, 'knee': 4, 'throw': 5, 'hold': 6,
             'rush': 5, 'counter': 4, 'combo': 4, 'step': 3}
# Registration adjustments for generated drawings, measured against both adjacent keys.
REGISTRATION = {
    'knee +2': (-8, -10, .89),
    'knee +4': (0, -10, .89),
    'rush +5': (17, -10, 1),
    'hold +3': (-8, -10, 1),
    'throw +3': (8, -10, 1),
    'throw +4': (0, 10, .89),
    'down +2': (17, 0, .89),
}
# Coat hems traced in frame coordinates. The lowered jacket and sleeves overlap the pants
# on different sides in the turning and kneeling poses.
HEMS = {
    'throw 2': ((100, 126), (112, 139), (128, 134), (147, 129), (164, 129)),
    'throw 3': ((100, 126), (112, 139), (128, 134), (147, 129), (164, 129)),
    'throw +3': ((91, 127), (105, 132), (130, 123), (143, 112), (155, 129), (170, 147)),
    'throw 4': ((85, 128), (99, 144), (113, 142), (126, 134), (141, 125), (151, 141), (164, 154)),
    'throw +4': ((76, 120), (97, 136), (110, 139), (125, 128), (140, 124), (158, 132), (181, 125)),
    'throw 5': ((94, 109), (109, 117), (125, 126), (147, 121), (174, 106)),
    'throw 6': ((95, 120), (107, 130), (126, 138), (148, 134), (170, 119)),
    'hold +1': ((96, 133), (111, 150), (125, 144), (137, 139), (156, 148)),
    'hold 2': ((73, 148), (82, 161), (98, 164), (113, 154), (130, 146), (154, 153)),
    'hold 3': ((83, 170), (94, 183), (111, 184), (126, 174), (139, 169), (166, 179)),
    'hold +3': ((96, 186), (104, 199), (117, 200), (129, 190), (140, 188), (155, 190)),
    'hold 4': ((77, 199), (87, 211), (106, 213), (121, 205), (135, 196), (153, 198)),
    'hold 5': ((78, 194), (88, 206), (107, 209), (123, 203), (137, 192), (155, 195)),
    'hold 6': ((79, 194), (89, 208), (108, 210), (124, 201), (139, 192), (152, 194)),
    'hold 7': ((80, 196), (90, 209), (111, 211), (125, 204), (141, 193), (157, 195)),
    'down +2': ((69, 157), (83, 165), (101, 154), (118, 151), (134, 165), (151, 162)),
    'down 3': ((70, 172), (86, 178), (105, 170), (125, 167), (145, 174), (165, 168)),
    'down 4': ((68, 224), (77, 212), (93, 182), (107, 174), (128, 173), (151, 177)),
    'down 5': ((60, 225), (72, 213), (88, 185), (105, 174), (128, 177), (157, 181)),
    'getup +1': ((74, 216), (90, 215), (105, 200), (121, 188), (149, 179), (169, 180)),
    'getup +2': ((85, 183), (96, 188), (110, 180), (126, 172), (142, 170), (164, 159)),
    'getup +3': ((77, 146), (91, 160), (107, 163), (125, 158), (145, 149), (161, 140)),
}
SLEEVES = {
    'kick 3': (((78, 85), (109, 88), (131, 111), (113, 133), (87, 129), (71, 109)),),
    'kick 4': (((75, 85), (107, 88), (126, 111), (109, 132), (85, 129), (70, 109)),),
    'rush +2': (((102, 84), (113, 70), (144, 59), (168, 64), (179, 80), (163, 102), (130, 111)),),
    'throw 2': (((145, 72), (169, 75), (209, 86), (216, 103), (186, 113), (147, 117)),),
    'throw 3': (((145, 72), (169, 75), (209, 86), (216, 103), (186, 113), (147, 117)),),
    'throw +3': (
        ((92, 60), (112, 56), (152, 69), (158, 93), (131, 95), (108, 76), (92, 76)),
        ((162, 101), (183, 108), (210, 133), (228, 137), (230, 152), (204, 152), (173, 130)),
    ),
    'throw 4': (
        ((84, 65), (114, 67), (140, 90), (127, 113), (108, 105), (98, 88), (83, 85)),
        ((146, 117), (167, 125), (184, 148), (207, 169), (206, 186), (188, 184), (166, 158)),
    ),
    'throw +4': (
        ((58, 81), (110, 68), (122, 91), (83, 108), (65, 122), (50, 114)),
        ((150, 79), (173, 88), (188, 110), (208, 109), (213, 126), (188, 135), (165, 123)),
    ),
    'throw 5': (((109, 70), (151, 70), (178, 114), (184, 128), (170, 135), (138, 110), (112, 111)),),
    'throw 6': (((100, 79), (146, 75), (172, 113), (193, 128), (192, 142), (168, 142), (124, 116)),),
    'hold 2': (
        ((114, 112), (148, 114), (174, 151), (190, 167), (192, 175), (182, 181), (154, 168), (129, 145)),
        ((80, 115), (110, 100), (136, 100), (151, 118), (130, 126), (106, 153), (92, 166), (69, 167)),
    ),
    'hold 3': (((124, 140), (157, 136), (183, 176), (198, 188), (190, 205), (161, 194), (139, 171)),),
    'hold +3': (((113, 157), (150, 157), (172, 182), (182, 201), (177, 216), (152, 208), (129, 184)),),
    'hold 4': (((108, 183), (145, 176), (171, 200), (190, 219), (189, 233), (159, 228), (134, 207)),),
    'hold 5': (((108, 183), (145, 173), (174, 197), (192, 220), (188, 234), (157, 226), (134, 202)),),
    'hold 6': (((108, 181), (146, 174), (174, 197), (194, 221), (189, 233), (157, 225), (135, 203)),),
    'hold 7': (((110, 184), (147, 176), (176, 199), (196, 223), (191, 234), (158, 228), (137, 205)),),
    'down +2': (
        ((117, 112), (146, 120), (171, 165), (165, 212), (147, 222), (132, 200), (135, 164)),
        ((83, 98), (105, 88), (129, 81), (147, 93), (144, 108), (134, 124), (96, 145), (75, 132)),
    ),
    'down 3': (((125, 132), (157, 137), (167, 169), (165, 217), (149, 225), (135, 210), (140, 173)),),
    'getup +1': (((102, 147), (121, 157), (98, 193), (92, 223), (81, 234), (69, 224), (77, 199)),),
}
RAISED_PANTS = {
    'kick 3': (((139, 131), (148, 112), (160, 90), (193, 77), (226, 65), (279, 45), (279, 99), (220, 119), (167, 139), (133, 169)),),
    'kick 4': (((136, 130), (146, 112), (157, 90), (190, 77), (223, 65), (279, 45), (279, 98), (217, 119), (165, 139), (130, 169)),),
    'rush +2': (((109, 130), (126, 131), (153, 136), (176, 139), (201, 145), (217, 157), (216, 185), (156, 184), (107, 170)),),
}
BRACING_GLOVES = {
    'down +2': (((148, 224), (161, 222), (179, 228), (182, 255), (131, 255), (132, 242)),),
    'getup +1': (((72, 219), (85, 225), (86, 248), (55, 255), (49, 243)),),
}
NEW_BOOTS = {
    'kick +2': (((225, 87), (265, 87), (271, 115), (252, 127), (225, 112)),),
    'kick +4': (((150, 167), (179, 162), (190, 200), (176, 205), (152, 190)),),
    'knee +2': (((159, 151), (198, 148), (205, 181), (178, 188)),),
    'knee +4': (((153, 177), (186, 168), (203, 218), (183, 227)),),
}
GROUNDED_BOOTS = {
    'getup +1': (
        ((137, 224), (151, 222), (171, 239), (166, 254), (132, 253), (133, 233)),
        ((177, 222), (193, 219), (214, 240), (214, 254), (169, 254), (169, 235)),
    ),
    'getup +2': (
        ((69, 209), (84, 213), (93, 230), (92, 247), (62, 251), (64, 226)),
        ((150, 224), (168, 218), (190, 238), (191, 254), (145, 254), (146, 237)),
    ),
}


def original(name, mode):
    raw = check_output(['git', 'show', f'{BASE}:work/recess/assets/{name}.webp'], cwd=WORK.parent)
    with Image.open(BytesIO(raw)) as image:
        strip = np.asarray(image.convert(mode))
    return [tile.copy() for tile in np.split(strip, strip.shape[1] // W, axis=1)]


def bounds(frame, cutoff=100):
    y, x = np.where(frame[:, :, 3] >= cutoff)
    return int(x.min()), int(y.min()), int(x.max()) + 1, int(y.max()) + 1


def face_position(art):
    """Use the largest patch of skin in the upper half as the registration point."""
    left, top, right, bottom = bounds(art)
    red, green, blue, alpha = np.moveaxis(art.astype(np.int16), -1, 0)
    face = (alpha > 145) & (red - green > 19) & (green - blue > 6)
    face &= (Y <= top + (bottom - top) * .36) & (X >= left + (right - left) * .16)
    _, _, stats, centers = cv2.connectedComponentsWithStats(face.astype('uint8'))
    if len(stats) > 1:
        selected = 1 + stats[1:, cv2.CC_STAT_AREA].argmax()
        if stats[selected, cv2.CC_STAT_AREA] >= 20:
            return centers[selected]
    return np.array([(left + right) / 2, top + 18])


def place_pose(tile, height, floor, face_x, *, x_scale=1):
    scale = min(height / tile.height, 258 / tile.width)
    width = min(260, round(tile.width * scale * x_scale))
    image = tile.resize((width, round(tile.height * scale)), RESAMPLE)
    trial = Image.new('RGBA', (W, H))
    trial.paste(image, (8, floor - image.height))
    estimate = face_position(np.asarray(trial))[0] - 8
    x = max(7, min(W - image.width - 7, round(face_x - estimate)))
    canvas = Image.new('RGBA', (W, H))
    canvas.paste(image, (x, floor - image.height))
    return np.asarray(canvas).copy()


def place_intermediate(tile, older, later, label):
    a, b = bounds(older), bounds(later)
    y = round((a[3] + b[3]) / 2)
    height = round((a[3] - a[1] + b[3] - b[1]) / 2)
    x = np.mean([face_position(older)[0], face_position(later)[0]])
    dx, dh, x_scale = REGISTRATION.get(label, (0, 0, 1))
    return place_pose(tile, height + dh, y, x + dx, x_scale=x_scale)


def breathing(ready):
    _, top, _, _ = bounds(ready)
    weight = np.interp(Y, [top, 136, 184, 221, GROUND], [1, 1, .75, .06, 0]).astype('float32')
    for index in range(6):
        phase = np.pi * index / 3
        drop = 5.6 * (.5 - .5 * np.cos(phase))
        sway = 2.3 * np.sin(phase)
        map_x, map_y = (X - sway * weight).astype('float32'), (Y - drop * weight).astype('float32')
        yield cv2.remap(ready, map_x, map_y, cv2.INTER_LINEAR), map_x, map_y


def collect(raw):
    atlases = {
        name: atlas_tiles(raw / f'exec-{identifier}.png', rows, columns)
        for name, (identifier, rows, columns) in ATLASES.items()
    }
    strips = {clip: original(f'anim-boy-{clip}', 'RGBA') for clip in CLIPS}
    masks = {clip: original(f'animmask-boy-{clip}', 'RGB') for clip in CLIPS}
    keyframes = {}
    for clip in CLIPS:
        frames = []
        for index, (art, mask) in enumerate(zip(strips[clip], masks[clip], strict=True), start=1):
            frames.append((art, mask, f'{clip} {index}'))
            if index in TWEENS.get(clip, {}):
                group, slot = TWEENS[clip][index]
                label = f'{clip} +{index}'
                art = place_intermediate(atlases[group][slot], art, strips[clip][index], label)
                frames.append((art, None, label))
        keyframes[clip] = frames
    ready, ready_mask = keyframes['idle'][0][:2]
    keyframes['idle'] = [
        (art, cv2.remap(ready_mask, mx, my, cv2.INTER_NEAREST), f'idle {index + 1}')
        for index, (art, mx, my) in enumerate(breathing(ready))
    ]
    # During recoil the head moves back while the boots stay on the same ground plane.
    keyframes['hit'] = [
        (place_pose(tile, height, GROUND, x), None, f'hit +{index}')
        for index, (tile, height, x) in enumerate(zip(atlases['hit'], (211, 205, 188, 207),
                                                     (133, 113, 150, 149), strict=True), start=1)
    ] + [(ready, ready_mask, 'idle 1')]
    keyframes['getup'] = [keyframes['down'][-1]] + [
        (place_pose(tile, height, GROUND, x), None, f'getup +{index}')
        for index, (tile, height, x) in enumerate(zip(atlases['getup'], (126, 155, 192),
                                                     (143, 148, 146), strict=True), start=1)
    ] + [(ready, ready_mask, 'idle 1')]
    return keyframes


def trace_sheet(frames, path):
    canvas = Image.new('RGBA', (W * 4, (H + 25) * ((len(frames) + 3) // 4)), '#231e32')
    draw = ImageDraw.Draw(canvas)
    for index, (art, _, name) in enumerate(frames):
        x, y = index % 4 * W, index // 4 * (H + 25)
        draw.text((x + 5, y + 5), name, fill='#ffdfa9')
        y += 24
        canvas.alpha_composite(Image.fromarray(art), (x, y))
        for row in range(20, H, 20):
            draw.text((x + 2, y + row - 7), str(row), fill='#e7dccf')
            for col in range(40, W, 20):
                draw.point((x + col, y + row), '#ffdea5')
        for col in range(40, W, 20):
            draw.text((x + col, y + 3), str(col), fill='#e7dccf')
    canvas.save(path)


def regions(polygons):
    ink = np.zeros((H, W), dtype=np.uint8)
    for polygon in polygons:
        cv2.fillPoly(ink, [np.array(polygon, dtype=np.int32)], 1)
    return ink.astype(bool)


def garment_mask(art, prior, label):
    left, top, right, bottom = bounds(art)
    height = bottom - top
    red, green, blue, alpha = np.moveaxis(art.astype(np.int16), -1, 0)
    hue, saturation, value = np.moveaxis(cv2.cvtColor(art[:, :, :3], cv2.COLOR_RGB2HSV), -1, 0)
    skin = (red - green >= 18) & (green - blue >= 7) & (hue < 30)
    figure = alpha >= 35
    bracing = regions(BRACING_GLOVES.get(label, ()))
    old_top = old_bottom = np.zeros((H, W), dtype=bool)
    if prior is not None:
        old_top = (prior == COLORS[1]).all(axis=-1)
        old_bottom = (prior == COLORS[2]).all(axis=-1)
        tag = (prior == COLORS[3]).all(axis=-1)
        shoe = (prior == COLORS[4]).all(axis=-1)
    else:
        gold = figure & (red - green > 24) & (green - blue > 17) & (hue > 5)
        gold &= (Y >= top + height * .35) & (Y <= top + height * .77)
        _, labels, stats, _ = cv2.connectedComponentsWithStats(gold.astype('uint8'))
        tag = ((labels == (1 + stats[1:, cv2.CC_STAT_AREA].argmax())) if len(stats) > 1
               else np.zeros((H, W), dtype=bool))
        if label in GROUNDED_BOOTS:
            shoe = figure & regions(GROUNDED_BOOTS[label])
        else:
            shoe = figure & ((Y >= bottom - min(29, height * .145)) | regions(NEW_BOOTS.get(label, ())))
        shoe &= ~bracing
    tag_y, tag_x = np.where(tag)
    face_x, face_y = face_position(art)
    if len(tag_x) >= 4:
        belt_x, belt_y = float(np.median(tag_x)), float(np.median(tag_y))
    else:
        belt_x, belt_y = float(face_x + 5), top + height * .54
    line = HEMS.get(label, (
        (belt_x - 72, belt_y - 20), (belt_x - 49, belt_y - 17),
        (belt_x - 36, belt_y - 5), (belt_x - 22, belt_y - 7),
        (belt_x - 12, belt_y - 16), (belt_x + 1, belt_y - 13),
        (belt_x + 10, belt_y - 6), (belt_x + 24, belt_y - 14),
        (belt_x + 51, belt_y - 18),
    ))
    seam = np.interp(np.arange(W), [x for x, _ in line], [y for _, y in line])
    below = Y > seam
    sleeves = regions(SLEEVES.get(label, ()))
    raised_pants = regions(RAISED_PANTS.get(label, ()))
    fabric = figure & ~skin & ((value >= 101) | old_top | old_bottom | sleeves)
    glove = (hue > 121) & (hue < 164) & (saturation > 61) & (value < 158)
    fabric &= ~(glove | bracing)
    collar = (Y > face_y + 9) | old_top | sleeves
    # Near a lifted knee or an extended leg, the original pants can rise above the belt.
    lifted = label.startswith(('kick ', 'knee ')) & ((X > belt_x + 20) & (Y > belt_y - 35))
    if prior is not None:
        lifted &= old_bottom
    jacket = fabric & collar & ((~below & ~lifted) | sleeves) & ~raised_pants
    pants = fabric & (below | lifted | raised_pants) & ~jacket
    if prior is not None:
        pants &= old_bottom | old_top | raised_pants
    else:
        pants &= Y > top + height * .25
    slots = np.zeros((H, W), dtype=np.uint8)
    slots[jacket] = 1
    slots[pants] = 2
    slots[shoe] = 4
    slots[tag] = 3
    slots[~figure] = 0
    return COLORS[slots]


def build(keyframes):
    previews = OUTPUT / 'recess-motion-preview-9'
    previews.mkdir(parents=True, exist_ok=True)
    changed_art = set(TWEENS) | {'hit', 'idle', 'getup'}
    files = []
    with TemporaryDirectory() as staging:
        for action, entries in keyframes.items():
            frames = [Frame(art, garment_mask(art, prior, label)) for art, prior, label in entries]
            paths = save_strip('boy', action, frames, Path(staging), previews)
            for path in paths:
                if path.suffix == '.gif':
                    files.append(path)
                elif action in changed_art or path.name.startswith('animmask'):
                    asset = ASSETS / path.name
                    asset.write_bytes(path.read_bytes())
                    files.append(asset)
    with ZipFile(OUTPUT / 'recess-motion-pack-9.zip', 'w', ZIP_DEFLATED) as archive:
        for path in files:
            directory = 'previews' if path.suffix == '.gif' else 'assets'
            archive.write(path, f'{directory}/{path.name}')
        handoff = WORK / 'docs' / 'art' / 'codex-motion-handoff-9.md'
        if handoff.exists():
            archive.write(handoff, handoff.name)


def main():
    parser = ArgumentParser()
    parser.add_argument('--raw', required=True, type=Path)
    parser.add_argument('--trace', type=Path)
    args = parser.parse_args()
    keyframes = collect(args.raw)
    if args.trace:
        args.trace.mkdir(parents=True, exist_ok=True)
        for action, frames in keyframes.items():
            trace_sheet(frames, args.trace / f'{action}.png')
        return
    build(keyframes)


if __name__ == '__main__':
    main()
