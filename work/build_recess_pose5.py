from argparse import ArgumentParser
from colorsys import rgb_to_hsv
from dataclasses import dataclass
from hashlib import sha256
import json
from pathlib import Path
from statistics import median
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image

from build_recess_academy_art import ASSETS, RAW, RESAMPLE, alpha_tiles, fit_cutout


WORK = Path(__file__).resolve().parent
OUT = WORK.parent / 'outputs'
STAGING = WORK / 'pose5' / 'assets'
BASELINE = 249
FOOT_CENTER = 140

SPORT = ('kick-windup', 'kick-strike', 'kick-follow', 'knee-strike',
         'throw-windup', 'throw-strike', 'throw-follow', 'hold-strike')
SKILLS = ('skill-rush-windup', 'skill-rush-strike', 'skill-counter-guard',
          'skill-counter-strike', 'skill-combo-windup', 'skill-combo-strike')
STATES = ('skill-cheer', 'skill-drink', 'skill-step-windup', 'skill-step-follow',
          'guard', 'ready-b', 'lose')
RIVALS = tuple(f'rival{n}' for n in range(1, 5))
MOBS = tuple(f'mob{n}' for n in range(1, 9))
BOSSES = tuple(f'boss{n}' for n in range(1, 7))
DUNGEONS = ('dboss-store', 'dboss-quiz', 'dboss-sports')
SPORTS = ('sport-blue', 'sport-red', 'sport-green')


@dataclass
class GeneratedAtlas:
    path: Path
    columns: int
    rows: int
    clean: bool = True

    def tiles(self):
        image = Image.open(self.path).convert('RGBA')
        alpha = image.getchannel('A')
        total = image.width * image.height
        histogram = alpha.histogram()
        if sum(histogram[:18]) / total < 0.19:
            # A few atlas outputs have a partially opaque matte underneath their figures.
            if sum(histogram[-30:]) / total > 0.82:
                raise ValueError(f'No usable transparent matte in {self.path}')
            below = 0
            for median, count in enumerate(histogram):
                below += count
                if below >= total / 2:
                    break
            cutoff = min(229, max(165, median + 15))
            alpha = alpha.point(lambda a: min(255, max(0, round((a - cutoff) * 255 / (244 - cutoff)))))
        else:
            alpha = alpha.point(lambda a: 0 if a < 14 else min(255, round((a - 14) * 255 / 232)))
        image.putalpha(alpha)
        return alpha_tiles(image, self.columns, self.rows, clean=self.clean)


def load_atlas(sources, name, columns, rows, clean=True):
    entry = sources[name]
    if isinstance(entry, str):
        entry = {'file': entry}
    return GeneratedAtlas(RAW / entry['file'], entry.get('columns', columns),
                          entry.get('rows', rows), clean).tiles()


def bounds(image, threshold=32):
    return image.getchannel('A').point(lambda a: (255 if a >= threshold else 0)).getbbox()


def feet(image):
    x0, y0, x1, y1 = bounds(image)
    bottom = image.getchannel('A').crop((x0, max(y0, y1 - 7), x1, y1))
    a, _, b, _ = bottom.point(lambda v: (255 if v >= 32 else 0)).getbbox()
    return x0 + (a + b) / 2


def battle_frame(tile, scale, *, airborne=False, low=False, origin=FOOT_CENTER):
    max_width, max_height = (252, 105) if low else (253, 204 if airborne else 231)
    scale = min(scale, max_width / tile.width, max_height / tile.height)
    sprite = tile.resize((round(tile.width * scale), round(tile.height * scale)), RESAMPLE)
    canvas = Image.new('RGBA', (280, 255))
    pivot = sprite.width / 2 if low or airborne else feet(sprite)
    left = max(7, min(273 - sprite.width, round(origin - pivot)))
    canvas.paste(sprite, (left, BASELINE - sprite.height - (29 if airborne else 0)))
    return canvas


def equipment_mask(frame, actor, pose):
    matte = Image.new('RGB', frame.size)
    left, top, right, bottom = bounds(frame)
    span = bottom - top
    width = right - left
    pixels = frame.load()
    face_row = top + round(span * (0.39 if pose == 'skill-cheer' else 0.28))
    face = []
    for y in range(top, face_row):
        for x in range(left, right):
            r, g, b, a = pixels[x, y]
            if a > 110 and r > 135 and 14 < r - g < 87 and 4 < g - b < 55:
                face.append((x, y))
    face_x = median(x for x, _ in face) if face else left + width * 0.52
    face_y = median(y for _, y in face) if face else top + span * 0.12
    collar = max((y for _, y in face), default=top + span * 0.21) - span * 0.018
    if actor == 'boy' and pose == 'throw-strike':
        # This leaning pose puts the trailing hand above the head.
        face_x, face_y = left + width * 0.64, top + span * 0.34
        collar = top + span * 0.29
    lowered = pose in ('hold-strike', 'lose')
    has_high_kick = pose == 'kick-strike'
    waist_level = 0.60 if lowered else 0.56
    for y in range(top, bottom):
        vertical = (y - top) / span
        for x in range(left, right):
            r, g, b, a = pixels[x, y]
            if a < 35:
                continue
            if abs(x - face_x) < span * 0.052 and abs(y - face_y) < span * 0.075:
                continue
            hue, sat, val = rgb_to_hsv(r / 255, g / 255, b / 255)
            hue *= 360
            hip = 0.39 < vertical < 0.67 and face_x - 0.32 * width < x < face_x + 0.25 * width
            charm = (7 < hue < 30 and 0.25 < sat < 0.51) if actor == 'boy' else (52 < hue < 108 and 0.13 < sat < 0.47)
            if hip and charm and val > 0.51:
                matte.putpixel((x, y), (0, 0, 255))
                continue
            if 4 <= hue <= 56 and sat >= 0.15:
                continue
            if val < 0.19:
                continue
            if lowered and x > face_x + width * 0.06:
                continue
            if pose == 'throw-strike' and 0.54 < vertical < 0.79 and x > face_x + width * 0.10:
                continue
            elevated_toe = has_high_kick and x >= right - 19 and 0.09 < vertical < 0.62
            if vertical > (0.88 if lowered else 0.85) or elevated_toe:
                matte.putpixel((x, y), (255, 255, 0))
            elif vertical > waist_level or (has_high_kick and x > face_x + width * 0.17 and vertical > 0.15):
                matte.putpixel((x, y), (0, 255, 0))
            elif y >= collar and abs(x - face_x) < width * 0.34:
                if actor == 'girl':
                    if x < face_x - min(30, width * 0.22) or (155 <= hue <= 260 and val < 0.52):
                        continue
                elif 248 < hue < 325 and sat > 0.24 and val < 0.47:
                    continue
                matte.putpixel((x, y), (255, 0, 0))
    return matte


def save_frame(image, name, written, mask=None):
    left, top, right, bottom = bounds(image)
    assert image.mode == 'RGBA' and image.size == (280, 255), name
    assert 3 <= left < right <= 277 and 9 <= top < bottom <= 251, (name, bounds(image))
    assert image.getchannel('A').getextrema()[0] == 0, name
    path = STAGING / f'motion-{name}.webp'
    image.save(path, quality=93, alpha_quality=100, method=5)
    written.add(path.name)
    if mask is not None:
        assert set(mask.get_flattened_data()) <= {(0, 0, 0), (255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0)}
        assert len(set(mask.get_flattened_data())) > 1, name
        path = STAGING / f'wardrobe-{name}.webp'
        mask.save(path, lossless=True)
        written.add(path.name)


def ready_height(actor):
    with Image.open(ASSETS / f'motion-{actor}-ready.webp') as frame:
        _, top, _, bottom = bounds(frame)
        return bottom - top


def player_atlas(sources, actor, key, names, columns, rows, anchors, written):
    tiles = load_atlas(sources, f'{actor}-{key}', columns, rows, clean=False)
    if len(tiles) < len(names):
        raise ValueError(f'Incomplete {actor}-{key} atlas')
    scale = min(1.4, ready_height(actor) / max(tiles[i].height for i in anchors))
    for pose, tile in zip(names, tiles):
        low = pose in ('hold-strike', 'lose')
        image = battle_frame(tile, scale, low=low, airborne=pose == 'knee-strike')
        save_frame(image, f'{actor}-{pose}', written, equipment_mask(image, actor, pose))


def opponent_atlas(sources, key, actors, extra, written):
    tiles = load_atlas(sources, f'npc-{key}', 4 if extra else 3, len(actors))
    columns = len(tiles) // len(actors)
    if columns not in (3, 4) or columns * len(actors) != len(tiles):
        raise ValueError(f'Unexpected opponent grid {key}')
    for i, actor in enumerate(actors):
        thrown, pinned, *remaining = tiles[i * columns:(i + 1) * columns]
        ready = ready_height(actor)
        for pose, tile in (('thrown', thrown), ('pinned', pinned)):
            scale = ready * (0.77 if pose == 'thrown' else 1.03) / max(tile.size)
            frame = battle_frame(tile, scale, airborne=pose == 'thrown', low=pose == 'pinned')
            save_frame(frame, f'{actor}-{pose}', written)
        if extra:
            victory = remaining[-1]
            frame = battle_frame(victory, min(231, ready + 8) / victory.height)
            save_frame(frame, f'{actor}-victory', written)


def ready_atlas(sources, key, actors, written):
    for actor, tile in zip(actors, load_atlas(sources, key, 4, 3), strict=True):
        with Image.open(ASSETS / f'motion-{actor}-ready.webp') as original:
            foot = feet(original)
        frame = battle_frame(tile, ready_height(actor) / tile.height, origin=foot)
        save_frame(frame, f'{actor}-ready-b', written)


def save_portraits(sources, key, names, written):
    for id, tile in zip(names, load_atlas(sources, key, len(names), 1, clean=False), strict=True):
        path = STAGING / f'stand-{id}.webp'
        canvas = fit_cutout(tile, (720, 1280), (668, 1212))
        x0, y0, x1, y1 = bounds(canvas)
        assert 18 < x0 < x1 < 702 and 22 < y0 < y1 < 1258, (id, bounds(canvas))
        canvas.save(path, quality=93, alpha_quality=100, method=5)
        written.add(path.name)


def build(sources):
    written = set()
    for actor in ('boy', 'girl'):
        for key, names, columns, rows, anchors in (
            ('sport', SPORT, 4, 2, (0, 1, 2, 4, 6)),
            ('skills', SKILLS, 3, 2, (1, 2, 3, 5)),
            ('states', STATES, 3, 3, (0, 1, 4, 5)),
        ):
            if f'{actor}-{key}' in sources:
                player_atlas(sources, actor, key, names, columns, rows, anchors, written)
    if 'hero-ready' in sources:
        for actor, tile in zip(('boy', 'girl'), load_atlas(sources, 'hero-ready', 2, 1), strict=True):
            with Image.open(ASSETS / f'motion-{actor}-ready.webp') as original:
                foot = feet(original)
            frame = battle_frame(tile, ready_height(actor) / tile.height, origin=foot)
            save_frame(frame, f'{actor}-ready-b', written, equipment_mask(frame, actor, 'ready-b'))
    if 'boy-counter' in sources:
        tile, = load_atlas(sources, 'boy-counter', 1, 1)
        frame = battle_frame(tile, ready_height('boy') * 0.94 / tile.height)
        save_frame(frame, 'boy-skill-counter-strike', written, equipment_mask(frame, 'boy', 'skill-counter-strike'))
    for key, actors in (
        ('rivals', RIVALS), ('mob-a', MOBS[:4]), ('mob-b', MOBS[4:]),
        ('boss-a', BOSSES[:3]), ('boss-b', BOSSES[3:]), ('dungeons', DUNGEONS),
        ('sport', SPORTS),
    ):
        if f'npc-{key}' in sources:
            opponent_atlas(sources, key, actors, key in ('boss-a', 'boss-b', 'dungeons'), written)
    for key, actors in (('ready-roster-a', RIVALS + MOBS), ('ready-roster-b', BOSSES + DUNGEONS + SPORTS)):
        if key in sources:
            ready_atlas(sources, key, actors, written)
    for key, names in (
        ('stand-boy-win', ('boy-win',)), ('stand-girl-win', ('girl-win',)),
        ('stand-boy-expressions', ('boy-smile', 'boy-serious', 'boy-tired')),
        ('stand-girl-expressions', ('girl-smile', 'girl-serious', 'girl-tired')),
        ('stand-mob-a-smile', tuple(f'{id}-smile' for id in MOBS[:4])),
        ('stand-mob-b-smile', tuple(f'{id}-smile' for id in MOBS[4:])),
        ('stand-regional', BOSSES[4:]), ('stand-dungeons', DUNGEONS),
    ):
        if key in sources:
            save_portraits(sources, key, names, written)
    if 'replace-mob-strike' in sources:
        for id, tile in zip(('mob2', 'mob4', 'mob5'), load_atlas(sources, 'replace-mob-strike', 3, 1), strict=True):
            scale = ready_height(id) * 1.05 / max(tile.size)
            frame = battle_frame(tile, scale, low=id == 'mob4')
            save_frame(frame, f'{id}-strike', written)
    if 'mob-grapple' in sources:
        for id, tile in zip(('mob4', 'mob5'), load_atlas(sources, 'mob-grapple', 2, 1), strict=True):
            scale = ready_height(id) * 1.10 / max(tile.size)
            frame = battle_frame(tile, scale, low=id == 'mob4')
            save_frame(frame, f'{id}-strike', written)
    return written


def publish(written):
    expected = {
        *(f'motion-{actor}-{pose}.webp' for actor in ('boy', 'girl') for pose in SPORT + SKILLS + STATES),
        *(f'wardrobe-{actor}-{pose}.webp' for actor in ('boy', 'girl') for pose in SPORT + SKILLS + STATES),
        *(f'motion-{actor}-{pose}.webp' for actor in RIVALS + MOBS + BOSSES + DUNGEONS + SPORTS
          for pose in ('thrown', 'pinned', 'ready-b')),
        *(f'motion-{actor}-victory.webp' for actor in BOSSES + DUNGEONS),
        *(f'stand-{actor}.webp' for actor in BOSSES[4:] + DUNGEONS),
        *(f'stand-{actor}-{pose}.webp' for actor in ('boy', 'girl') for pose in ('smile', 'serious', 'tired', 'win')),
        *(f'stand-{actor}-smile.webp' for actor in MOBS),
        *(f'motion-{actor}-strike.webp' for actor in ('mob2', 'mob4', 'mob5')),
    }
    if written != expected:
        raise ValueError(f'Missing: {sorted(expected - written)}. Unexpected: {sorted(written - expected)}')
    art = [name for name in written if not name.startswith('wardrobe-')]
    if len({sha256((STAGING / name).read_bytes()).digest() for name in art}) != len(art):
        raise ValueError('Duplicate art in the 5th pose pack')
    OUT.mkdir(exist_ok=True)
    with ZipFile(OUT / 'recess-king-pose-pack-5.zip', 'w', compression=ZIP_DEFLATED) as pack:
        for name in sorted(written):
            data = (STAGING / name).read_bytes()
            (ASSETS / name).write_bytes(data)
            pack.writestr(f'assets/{name}', data)
        pack.write(WORK / 'codex-pose-handoff-5.md', 'codex-pose-handoff-5.md')


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--sources', type=Path, default=WORK / 'recess-pose5-sources.json')
    options = parser.parse_args()
    STAGING.mkdir(parents=True, exist_ok=True)
    files = build(json.loads(options.sources.read_text(encoding='utf-8-sig')))
    print(f'{len(files)} assets staged', flush=True)
    if options.publish:
        publish(files)
