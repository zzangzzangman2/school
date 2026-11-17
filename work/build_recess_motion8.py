"""Pack the five sprite corrections against the original 7th art handoff."""

from argparse import ArgumentParser
from io import BytesIO
from pathlib import Path
from subprocess import check_output
from zipfile import ZIP_DEFLATED, ZipFile

import cv2
import numpy as np
from PIL import Image

from build_recess_motion7 import (
    ASSETS, GROUND, HEIGHT, ORIGIN, OUTPUT, WIDTH, WORK, Frame, alpha_bounds,
    clean, equipment_mask, fit_to_ground, pack_name, save_strip,
)


BASELINE = '46530f3'
PREVIEWS = OUTPUT / 'recess-motion-preview-8'
RUN_ATLASES = (
    ((1, 2, 3, 4), '97e57b28-e22e-4aba-a603-e31b66297d70'),
    ((5, 6, 7, 8), 'a0b86f02-7360-481c-b105-c5cc9a369680'),
    ((10, 11, 12, 13), '2b5ebdf4-ad0f-4cd8-9170-858408086f7b'),
    ((14, 15, 16), '201ad82e-2c36-4939-b71c-86324b59e4ab'),
)
HOLD_ATLAS = '1ebcdbb1-7fa8-4cb3-abbf-7572597d827e'
THUGS = tuple(f'thug{i}' for i in range(1, 9)) + tuple(f'thug-boss{i}' for i in range(1, 5))
RESAMPLE = Image.Resampling.LANCZOS


def read_original(name, mode='RGBA'):
    data = check_output(['git', 'show', f'{BASELINE}:work/recess/assets/{name}.webp'], cwd=WORK.parent)
    with Image.open(BytesIO(data)) as source:
        return np.asarray(source.convert(mode)).copy()


def read_strip(name):
    art = read_original(name)
    return [cell.copy() for cell in np.split(art, art.shape[1] // WIDTH, axis=1)]


def atlas_tiles(path, rows, columns):
    """Find painted silhouettes on the source atlas and retain their antialiased edges."""
    with Image.open(path) as image:
        sheet = np.asarray(image.convert('RGBA'))
    alpha = sheet[:, :, 3]
    _, labels, stats, _ = cv2.connectedComponentsWithStats((alpha >= 225).astype('uint8'))
    parts = sorted(range(1, len(stats)), key=lambda part: stats[part, cv2.CC_STAT_AREA], reverse=True)
    parts = parts[: rows * columns]
    if len(parts) != rows * columns or stats[parts[-1], cv2.CC_STAT_AREA] < 5000:
        raise ValueError(f'Unexpected number of characters in {path.name}')
    parts.sort(key=lambda part: stats[part, cv2.CC_STAT_TOP] + stats[part, cv2.CC_STAT_HEIGHT] / 2)
    tiles = []
    for row in range(rows):
        order = sorted(parts[row * columns:(row + 1) * columns], key=lambda part: stats[part, cv2.CC_STAT_LEFT])
        for part in order:
            x0, y0, width, height, _ = stats[part]
            left, top = max(0, x0 - 4), max(0, y0 - 4)
            right, bottom = min(sheet.shape[1], x0 + width + 4), min(sheet.shape[0], y0 + height + 4)
            tile = sheet[top:bottom, left:right].copy()
            keep = cv2.dilate((labels[top:bottom, left:right] == part).astype('uint8'), np.ones((5, 5), np.uint8))
            matte = np.clip((tile[:, :, 3].astype(np.float32) - 168) * (255 / 83), 0, 255).astype('uint8')
            tile[:, :, 3] = matte * keep
            tile[tile[:, :, 3] == 0] = 0
            tiles.append(Image.fromarray(tile).crop(alpha_bounds(tile, cutoff=48)))
    return tiles


def resize_pose(tile, width, height, torso=0.46, torso_scale=None):
    """Resize the legs independently from the upper body, keeping their shared edge continuous."""
    if torso_scale is None:
        torso_scale = width / tile.width
    split = round(tile.height * torso)
    head_rows = round(split * torso_scale)
    if not 1 <= head_rows < height:
        raise ValueError(f'Upper body too tall for the pose: {head_rows} / {height}')
    rows, cols = np.indices((height, width), dtype=np.float32)
    source_x = (cols + 0.5) * tile.width / width - 0.5
    source_y = np.interp(rows + 0.5, [0, head_rows, height], [0, split, tile.height]).astype(np.float32) - 0.5
    return Image.fromarray(cv2.remap(np.asarray(tile), source_x, source_y, cv2.INTER_LINEAR,
                                     borderMode=cv2.BORDER_REPLICATE))


def face_center(tile):
    red, green, blue, alpha = np.moveaxis(np.asarray(tile).astype(np.int16), -1, 0)
    y = np.arange(tile.height)[:, None]
    face = (alpha > 130) & (red - green > 15) & (green - blue > 2)
    face &= (y > tile.height * 0.06) & (y < tile.height * 0.26)
    _, xs = np.where(face)
    if len(xs) < 20:
        _, xs = np.where((alpha > 130) & (y < tile.height * 0.22))
    return round(np.median(xs))


def place(tile, pivot, ground):
    x = max(7, min(WIDTH - tile.width - 7, ORIGIN + 12 - pivot))
    canvas = Image.new('RGBA', (WIDTH, HEIGHT))
    canvas.paste(tile, (x, ground - tile.height))
    return fit_to_ground(Frame(np.asarray(canvas).copy()), flight=GROUND - ground, center_feet=False)


def run_frames(actor, tiles):
    _, reference_top, _, reference_bottom = alpha_bounds(clean(read_original(f'motion-{actor}-step')))
    stature = min(220, reference_bottom - reference_top)
    scale = min(stature / np.mean([tiles[0].height, tiles[2].height]), 250 / max(t.width for t in tiles))
    for index, tile in enumerate(tiles):
        flight = 5 if index in (1, 3) else 0
        # Register the face vertically and let the knees carry the change in height.
        height = stature - (2 if flight else 0)
        image = resize_pose(tile, round(tile.width * scale), height, torso_scale=scale)
        yield place(image, face_center(image), GROUND - flight)


def dasom_frames():
    frames = read_strip('anim-mate9-run')
    if len(frames) != 8:
        raise ValueError('Expected the earlier eight-frame O Dasom redraw')
    contact_bounds = [alpha_bounds(frames[index]) for index in (0, 4)]
    stature = round(np.mean([bottom - top for _, top, _, bottom in contact_bounds]))
    for target, index in enumerate((0, 3, 4, 7)):
        old = frames[index]
        left, top, right, bottom = alpha_bounds(old)
        image = Image.fromarray(old).crop((left, top, right, bottom))
        flight = 5 if target % 2 else 0
        image = resize_pose(image, image.width, stature - (2 if flight else 0))
        canvas = Image.new('RGBA', (WIDTH, HEIGHT))
        canvas.paste(image, (left, GROUND - flight - image.height))
        yield fit_to_ground(Frame(np.asarray(canvas).copy()), flight=flight, center_feet=False)


def restore_down(actor):
    ready = clean(read_original(f'motion-{actor}-ready'))
    _, rt, _, rb = alpha_bounds(ready)
    ready_h = rb - rt
    old = clean(read_original(f'motion-{actor}-down'))
    left, top, right, bottom = alpha_bounds(old)
    kneel = Image.fromarray(old).crop((left, top, right, bottom))
    # Keep the scale of the head/shoulders. Reduce only the folded legs to fit the kneel.
    factor = min(1.88, max(1.54, ready_h / (bottom - top) * 0.87))
    width = round(kneel.width * factor)
    frames = [Frame(art) for art in read_strip(f'anim-{actor}-down')[:2]]
    second = frames[1].art
    x0, y0, x1, y1 = alpha_bounds(second)
    if y0 < 10:
        crop = Image.fromarray(second).crop((x0, y0, x1, y1))
        scale = min(1, (GROUND - 10) / crop.height)
        crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), RESAMPLE)
        frames[1] = place(crop, crop.width // 2 + 12, GROUND)
    for height_ratio, lean in ((0.60, 9), (0.57, 0)):
        image = resize_pose(kneel, width, round(ready_h * height_ratio), torso=0.36, torso_scale=factor)
        frame = place(image, image.width // 2 + 12, GROUND)
        if lean:
            rows, cols = np.indices((HEIGHT, WIDTH), dtype=np.float32)
            top = alpha_bounds(frame.art)[1]
            lean_map = cols - lean * np.clip((GROUND - rows) / (GROUND - top), 0, 1)
            frame = fit_to_ground(Frame(cv2.remap(frame.art, lean_map, rows, cv2.INTER_LINEAR)), center_feet=False)
        frames.append(frame)
    return frames


def fencing_attack():
    frames = [Frame(art) for art in read_strip('anim-mate14-attack')]
    strike = frames[2].art
    # Move only the slender blade from where it emerges from the guard. The fencer and feet stay fixed.
    blade_start, blade_end = 247, 269
    blade = Image.fromarray(strike[:, blade_start:]).resize((blade_end - blade_start, HEIGHT), RESAMPLE)
    strike[:, blade_start:] = 0
    blade = np.asarray(blade).copy()
    blade[:, -4:, 3] = (blade[:, -4:, 3] * np.array([1, .8, .5, .15])).astype('uint8')
    strike[:, blade_start:blade_end] = blade
    return frames


def hold_frames(path):
    old = read_strip('anim-boy-hold')
    layers = np.split(read_original('animmask-boy-hold', 'RGB'), len(old), axis=1)
    frames = [Frame(art, mask.copy()) for art, mask in zip(old, layers, strict=True)]
    tiles = atlas_tiles(path, 1, 2)
    scale = 172 / tiles[0].height
    bridges = []
    for tile in tiles:
        image = tile.resize((round(tile.width * scale), round(tile.height * scale)), RESAMPLE)
        # Both contact points use the same origin as the standing and floor art.
        frame = place(image, image.width // 2 + 12, GROUND)
        frame.mask = np.asarray(equipment_mask(Image.fromarray(frame.art), 'boy', 'hold-transition')).copy()
        bridges.append(frame)
    return [frames[0], *bridges, *frames[1:]]


def main():
    parser = ArgumentParser()
    parser.add_argument('--raw', required=True, type=Path)
    args = parser.parse_args()
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    files = []
    for roster, atlas in RUN_ATLASES:
        tiles = atlas_tiles(args.raw / f'exec-{atlas}.png', len(roster), 4)
        for index, number in enumerate(roster):
            actor = f'mate{number}'
            frames = list(run_frames(actor, tiles[4 * index:4 * index + 4]))
            files += save_strip(actor, 'run', frames, ASSETS, PREVIEWS, frame_ms=80)
    files += save_strip('mate9', 'run', list(dasom_frames()), ASSETS, PREVIEWS, frame_ms=80)
    for actor in THUGS:
        frames = restore_down(actor)
        paths = save_strip(actor, 'down', frames, ASSETS, PREVIEWS)
        files += paths
        with Image.open(paths[0]) as strip:
            fallback = strip.crop((3 * WIDTH, 0, 4 * WIDTH, HEIGHT))
            path = ASSETS / f'motion-{actor}-down.webp'
            fallback.save(path, 'WEBP', lossless=True, exact=True, method=5)
            files.append(path)
    files += save_strip('mate14', 'attack', fencing_attack(), ASSETS, PREVIEWS)
    files += save_strip('boy', 'hold', hold_frames(args.raw / f'exec-{HOLD_ATLAS}.png'), ASSETS, PREVIEWS)
    with ZipFile(OUTPUT / 'recess-motion-pack-8.zip', 'w', ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, pack_name(path))
        handoff = WORK / 'codex-motion-handoff-8.md'
        if handoff.exists():
            archive.write(handoff, handoff.name)


if __name__ == '__main__':
    main()
