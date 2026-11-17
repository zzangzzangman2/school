from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image, ImageOps

from build_recess_academy_art import ASSETS, RAW, RESAMPLE, alpha_tiles, transformed
from build_recess_pose5 import GeneratedAtlas, battle_frame, bounds, feet


WORK = Path(__file__).resolve().parent
OUT = WORK.parent / 'outputs'
STAGING = WORK / 'pose6' / 'assets'
PAIR_IDS = ((1, 2), (5, 6), (8, 9), (11, 3), (4, 7), (12, 13), (10, 14), (15, 16))
BASE = ('ready', 'step', 'windup', 'strike', 'follow', 'hit', 'down', 'guard', 'open')
COMPANION = BASE + ('skill-a', 'skill-b')
THUG_ANCHORS = ('ready', 'windup', 'strike', 'hit', 'down')
THUG_GROUPS = {
    'thug-a': tuple(f'thug{i}' for i in range(1, 5)),
    'thug-b': tuple(f'thug{i}' for i in range(5, 9)),
    'thug-boss': tuple(f'thug-boss{i}' for i in range(1, 5)),
}


def read_tiles(sources, key, columns, rows, clean=True):
    entry = sources[key]
    if isinstance(entry, str):
        entry = {'file': entry}
    file = RAW / entry['file']
    columns, rows = entry.get('columns', columns), entry.get('rows', rows)
    cutoff = entry.get('alpha_cutoff')
    if cutoff is None:
        return GeneratedAtlas(file, columns, rows, clean).tiles()
    image = Image.open(file).convert('RGBA')
    image.putalpha(image.getchannel('A').point(lambda a: max(0, min(255, round((a - cutoff) * 255 / (246 - cutoff))))))
    return alpha_tiles(image, columns, rows, clean=clean)


def save_webp(image, name, produced):
    path = STAGING / f'{name}.webp'
    image.save(path, quality=93, alpha_quality=100, method=5)
    produced.add(path.name)


def portrait(tile, head_x=None):
    width, height = 720, 1280
    sprite = ImageOps.contain(tile, (650, 1155), method=RESAMPLE)
    canvas = Image.new('RGBA', (width, height))
    # Position the face, not the extremities of the pose, under the cut-in's upper center.
    px = (width - sprite.width) / 2
    if head_x is None:
        head = sprite.getchannel('A').crop((0, 0, sprite.width, round(sprite.height * 0.15))).getbbox()
        if head:
            head_x = (head[0] + head[2]) / (2 * sprite.width)
    if head_x is not None:
        px = max(16, min(width - sprite.width - 16, width / 2 - sprite.width * head_x))
    canvas.paste(sprite, (round(px), 88))
    return canvas


def extract_portraits(sources, produced):
    for left, right in PAIR_IDS:
        key = f'stand-{left}-{right}'
        if key not in sources:
            continue
        tiles = read_tiles(sources, key, 2, 1, clean=False)
        for n, tile in zip((left, right), tiles, strict=True):
            save_webp(portrait(tile), f'stand-mate{n}', produced)


def motion_sprite(tile, name, scale):
    airborne = name in ('skill-b-jump',)
    low = name in ('down',)
    if low:
        scale = min(scale, 118 / tile.height)
    return battle_frame(tile, scale, airborne=airborne)


def save_motion(frames, id, produced):
    ready = frames['ready']
    # The standing fallback shares the motion canvas and its foot anchor.
    save_webp(ready, id, produced)
    for pose, frame in frames.items():
        save_webp(frame, f'motion-{id}-{pose}', produced)


def extract_companion(sources, n, produced):
    key = f'mate{n}-atlas'
    tiles = read_tiles(sources, key, 4, 3)
    entry = sources[key]
    indices = entry.get('indices') if isinstance(entry, dict) else None
    if indices:
        tiles = [tiles[i] for i in indices]
    if len(tiles) < len(COMPANION):
        raise ValueError(f'Companion atlas {n} is incomplete')
    scale = min(220 / tiles[0].height, 1.6)
    frames = {}
    for pose, tile in zip(COMPANION, tiles):
        name = 'skill-b-jump' if pose == 'skill-b' and n == 2 else pose
        frames[pose] = motion_sprite(tile, name, scale)
    special_key = f'mate{n}-special'
    if special_key in sources:
        for pose, tile in zip(('skill-a', 'skill-b'), read_tiles(sources, special_key, 2, 1), strict=True):
            special_scale = min(218 / tile.height, 245 / tile.width)
            frames[pose] = motion_sprite(tile, pose, special_scale)
    save_motion(frames, f'mate{n}', produced)


def extract_thugs(sources, key, ids, produced):
    tiles = read_tiles(sources, key, 5, 4)
    extra_poses = ('step', 'follow', 'guard', 'open')
    extra = read_tiles(sources, f'{key}-extra', 4, 4) if f'{key}-extra' in sources else None
    for i, id in enumerate(ids):
        chunk = tiles[i * len(THUG_ANCHORS):(i + 1) * len(THUG_ANCHORS)]
        scale = min(225 / chunk[0].height, 1.6)
        frames = {pose: motion_sprite(tile, pose, scale)
                  for pose, tile in zip(THUG_ANCHORS, chunk, strict=True)}
        if extra:
            frames.update({pose: motion_sprite(tile, pose, scale)
                           for pose, tile in zip(extra_poses, extra[4 * i:4 * i + 4], strict=True)})
        else:
            derived = (
                transformed(frames['ready'], -2, 4),
                transformed(frames['strike'], -4, 5),
                transformed(frames['windup'], 3, -4),
                transformed(frames['hit'], -3, -3),
            )
            frames.update(dict(zip(extra_poses, derived, strict=True)))
        save_motion(frames, id, produced)


def validate(produced, complete):
    actors = [f'mate{i}' for i in range(1, 17)]
    thugs = [id for ids in THUG_GROUPS.values() for id in ids]
    expected = {
        *(f'{id}.webp' for id in actors + thugs),
        *(f'stand-{id}.webp' for id in actors),
        *(f'motion-{id}-{pose}.webp' for id in actors for pose in COMPANION),
        *(f'motion-{id}-{pose}.webp' for id in thugs for pose in BASE),
    }
    if complete and expected != produced:
        raise ValueError(f'Missing {sorted(expected - produced)} and unexpected {sorted(produced - expected)}')
    for name in produced:
        with Image.open(STAGING / name) as im:
            is_portrait = name.startswith('stand-')
            assert im.mode == 'RGBA' and im.size == ((720, 1280) if is_portrait else (280, 255)), name
            left, top, right, bottom = bounds(im)
            assert 4 <= left < right <= im.width - 4 and 9 <= top < bottom <= im.height - 4, (name, bounds(im))
            if not is_portrait:
                assert 216 <= bottom <= 252, (name, bottom)
    for id in actors + thugs:
        frames = [STAGING / name for name in produced if name.startswith(f'motion-{id}-')]
        if len({sha256(path.read_bytes()).digest() for path in frames}) != len(frames):
            raise ValueError(f'Duplicate motion in {id}')


def publish(produced):
    OUT.mkdir(exist_ok=True)
    with ZipFile(OUT / 'recess-king-pose-pack-6.zip', 'w', compression=ZIP_DEFLATED) as pack:
        for name in sorted(produced):
            data = (STAGING / name).read_bytes()
            (ASSETS / name).write_bytes(data)
            pack.writestr(f'assets/{name}', data)
        pack.write(WORK / 'codex-pose-handoff-6.md', 'codex-pose-handoff-6.md')


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--sources', type=Path, default=WORK / 'recess-pose6-sources.json')
    options = parser.parse_args()
    STAGING.mkdir(parents=True, exist_ok=True)
    sources = json.loads(options.sources.read_text(encoding='utf-8-sig'))
    written = set()
    extract_portraits(sources, written)
    for n in range(1, 17):
        if f'mate{n}-atlas' in sources:
            extract_companion(sources, n, written)
    for key, ids in THUG_GROUPS.items():
        if key in sources:
            extract_thugs(sources, key, ids, written)
    validate(written, options.publish)
    print(f'{len(written)} assets staged and verified', flush=True)
    if options.publish:
        publish(written)
