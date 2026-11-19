from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageOps

WORK = Path(__file__).resolve().parents[2]
SITE = WORK / 'recess'
ASSETS = SITE / 'assets'
RAW = Path.home() / '.codex' / 'generated_images' / '01a1e2a8-e772-73d2-86ae-3ae035e7719e'
SOURCE = {
    'academy-a': 'exec-9ca4bb07-1ff1-4334-9474-72610397a2e5.png',
    'academy-b': 'exec-44bcefd9-8e1d-4f7d-a18d-37add18ea4f3.png',
    'zone-r': 'exec-12997989-297a-48b9-a097-cf87e44cb4de.png',
    'zone-c': 'exec-fd7b3298-b647-4d2a-91c4-e64ff26b1a6c.png',
    'dungeons': 'exec-f6fb5de8-61e4-4889-b616-717eda41a20a.png',
    'chips': 'exec-0716c48d-4788-4963-baae-71a2cc49c9b4.png',
    'stickers': 'exec-93a36701-4573-4cab-8aa0-9e63b3dc342d.png',
    'skills': 'exec-bd6d0148-85ee-481c-8d5c-9f8f373e6ee3.png',
    'boy': 'exec-472dc561-4e93-41a5-bdb4-d6d072606eb5.png',
    'girl': 'exec-297c9a4e-f785-4089-95d5-1f59224d42f4.png',
    'girl-strike': 'exec-c8b12d14-4b99-48b8-9729-dd0b607c14c8.png',
    'girl-other': 'exec-fa4678c9-ee7e-443b-8c75-a0a3e81c0b40.png',
    'boy-other': 'exec-70c8e54e-e677-473a-8853-bdf49032bad1.png',
    'boy-strike': 'exec-09d94284-6d59-4bdf-9731-8a3108f8db08.png',
    'roster-a': 'exec-e85ad731-1cb3-4519-922b-d804f8795afe.png',
    'roster-b': 'exec-8e8a2307-457f-4424-bb7b-6323bbebe03d.png',
    'roster-boss': 'exec-fb21c791-ff70-49bb-9b99-e1b03c266e07.png',
    'npc-a': 'exec-0359e3bd-ade0-4a3e-a4c6-e99208d34632.png',
    'npc-boss': 'exec-67ccbcfe-2288-4147-9575-41894be6c6aa.png',
    'cover': 'exec-c6bfc015-2956-4625-bd1c-2b6eddfdd547.png',
    'npc-dungeon': 'exec-0e8423c3-1af0-45eb-92fb-7dbad03ca254.png',
    'npc-sport': 'exec-68035f87-a89d-4f38-bb7e-c162578d4b58.png',
    'npc-b': 'exec-cd29299b-2dcc-478d-ac15-91678d7e4b27.png',
    'npc-rivals': 'exec-ae879edc-40f6-4b45-962d-e4c5bd59a10a.png',
    'npc-regional': 'exec-cef6e4f3-4665-4352-aa82-44fdfaab6b43.png',
}
RESAMPLE = Image.Resampling.LANCZOS


def open_source(name):
    return Image.open(RAW / SOURCE[name])


def save(image, filename, quality=92):
    image.save(ASSETS / f'{filename}.webp', quality=quality, alpha_quality=100, method=5)


def split_map(name, ids, columns, rows):
    source = open_source(name).convert('RGB')
    for index, id in enumerate(ids):
        row, col = divmod(index, columns)
        box = (round(col * source.width / columns) + 4, round(row * source.height / rows) + 4,
               round((col + 1) * source.width / columns) - 4, round((row + 1) * source.height / rows) - 4)
        save(ImageOps.fit(source.crop(box), (535, 302), method=RESAMPLE, centering=(0.5, 0.68)), id)


def cuts(length, n, signal):
    half_window = max(1, round(length / n * 0.16))
    result = [0]
    for i in range(1, n):
        center = round(length * i / n)
        result.append(min(range(center - half_window, center + half_window + 1),
                          key=lambda pos: (signal(pos), abs(pos - center))))
    return result + [length]


def alpha_tiles(source, columns, rows, clean=False):
    source = source.convert('RGBA')
    mask = source.getchannel('A').point(lambda value: int(value >= 36))
    y_edges = cuts(source.height, rows, lambda y: sum(mask.crop((0, y, source.width, y + 1)).get_flattened_data()))
    frames = []
    for y0, y1 in zip(y_edges, y_edges[1:]):
        x_edges = cuts(source.width, columns, lambda x: sum(mask.crop((x, y0, x + 1, y1)).get_flattened_data()))
        for x0, x1 in zip(x_edges, x_edges[1:]):
            tile = source.crop((x0, y0, x1, y1))
            if clean:
                alpha = np.asarray(tile.getchannel('A'))
                _, labels, stats, _ = cv2.connectedComponentsWithStats((alpha >= 28).astype('uint8'))
                if len(stats) > 1:
                    primary = 1 + stats[1:, cv2.CC_STAT_AREA].argmax()
                    keep = cv2.dilate((labels == primary).astype('uint8'), np.ones((5, 5), dtype='uint8'))
                    tile.putalpha(Image.fromarray(alpha * keep))
            bounds = tile.getchannel('A').point(lambda value: 255 if value >= 28 else 0).getbbox()
            if not bounds:
                raise ValueError(f'Empty transparent atlas tile at {(x0, y0)}')
            frames.append(tile.crop(bounds))
    return frames


def fit_cutout(tile, size, inner):
    tile = ImageOps.contain(tile, inner, method=RESAMPLE)
    canvas = Image.new('RGBA', size)
    canvas.paste(tile, ((size[0] - tile.width) // 2, (size[1] - tile.height) // 2))
    return canvas


def write_icons(name, ids, columns, rows, size):
    for id, tile in zip(ids, alpha_tiles(open_source(name), columns, rows), strict=True):
        save(fit_cutout(tile, (size, size), (size - 6, size - 6)), id, 94)


def write_portrait(id, tile):
    save(fit_cutout(tile, (720, 1280), (668, 1212)), f'stand-{id}', 93)


def frame_at(tile, scale, width=280):
    size = (round(tile.width * scale), round(tile.height * scale))
    sprite = tile.resize(size, RESAMPLE)
    canvas = Image.new('RGBA', (width, 255))
    canvas.paste(sprite, ((width - sprite.width) // 2, 250 - sprite.height))
    return canvas


def scale_for(tiles, ready):
    return min(230 / max(tile.height for tile in tiles), 260 / max(tile.width for tile in tiles), 174 / ready.width)


def wardrobe_mask(frame, gender, pose, file):
    from colorsys import rgb_to_hsv

    mask = Image.new('RGB', frame.size)
    left, top, right, bottom = frame.getchannel('A').getbbox()
    span = bottom - top
    px, slots = frame.load(), mask.load()
    knees = 0.67 if pose == 'down' else 0.56
    for y in range(top, bottom):
        level = (y - top) / span
        for x in range(left, right):
            r, g, b, alpha = px[x, y]
            if alpha < 46:
                continue
            hue, sat, value = rgb_to_hsv(r / 255, g / 255, b / 255)
            hue *= 360
            warm = 6 <= hue <= 68 and sat >= 0.20
            if warm:
                # The small gold timing tag or bag charm uses its own equipment slot.
                if 24 <= hue <= 65 and sat > 0.44 and value > 0.59 and 0.28 < level < 0.69:
                    slots[x, y] = (0, 0, 255)
                continue
            if value < 0.19:
                continue
            if level > (0.76 if pose == 'run' else 0.86):
                slots[x, y] = (255, 255, 0)
            elif level > knees:
                slots[x, y] = (0, 255, 0)
            elif level > (0.40 if pose == 'victory' else 0.31):
                # Navy ponytail pixels and the slate undershirt retain their original color.
                if gender == 'girl' and value < 0.47 and (160 <= hue <= 250 or sat < 0.30):
                    continue
                slots[x, y] = (255, 0, 0)
    mask.save(ASSETS / f'wardrobe-{file}.webp', lossless=True, method=6)


BASE_POSES = ('ready', 'step', 'windup', 'strike', 'follow', 'hit', 'down', 'victory', 'run')
EXTRA_POSES = ('push-windup', 'push-strike', 'push-follow', 'spar-ready', 'spar-windup', 'spar-strike',
               'spar-hit', 'spar-down', 'spar-victory')


def write_player(gender, primary, extra):
    tiles = alpha_tiles(primary, 3, 3)
    extras = alpha_tiles(extra, 3, 3)
    scale = scale_for(tiles + extras, tiles[0])
    save(frame_at(tiles[0], scale, 190), gender)
    for pose, tile in zip(BASE_POSES + EXTRA_POSES, tiles + extras, strict=True):
        if pose.endswith('down'):
            use_scale = min(scale, 177 / tile.height)
        else:
            use_scale = scale
        frame = frame_at(tile, use_scale)
        name = f'{gender}-{pose}'
        save(frame, f'motion-{name}')
        if not pose.startswith('spar-'):
            mask_pose = pose.split('-')[-1]
            wardrobe_mask(frame, gender, mask_pose, name)
            if pose in ('windup', 'strike', 'follow'):
                # Keep the old toss paths valid for archived views and the original CSS mapping.
                save(frame, f'motion-{gender}-toss-{pose}')
                wardrobe_mask(frame, gender, pose, f'{gender}-toss-{pose}')
    recovery = transformed(frame_at(extras[4], scale), -7, 7, 0)
    save(recovery, f'motion-{gender}-spar-follow')


def transformed(frame, angle, x=0, y=0, shrink=1.0):
    crop = frame.crop(frame.getchannel('A').getbbox())
    sprite = crop.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    sprite = sprite.crop(sprite.getchannel('A').getbbox())
    size = min(shrink, 257 / sprite.width, 228 / sprite.height)
    sprite = sprite.resize((round(sprite.width * size), round(sprite.height * size)), RESAMPLE)
    output = Image.new('RGBA', frame.size)
    output.paste(sprite, ((output.width - sprite.width) // 2 + x, 249 - sprite.height + y))
    return output


def write_npcs(image, ids):
    image = image.convert('RGBA')
    alpha = image.getchannel('A')
    # Normalize the atlas matte before finding sprite cells and their padded bounds.
    low, high = (177, 213) if alpha.getextrema()[0] > 0 else (14, 245)
    image.putalpha(alpha.point(lambda value: max(0, min(255, round((value - low) * 255 / (high - low))))))
    all_tiles = alpha_tiles(image, 3, len(ids), clean=True)
    for index, id in enumerate(ids):
        ready, strike, hit = all_tiles[index * 3:(index + 1) * 3]
        scale = scale_for([ready, strike, hit], ready)
        still = frame_at(ready, scale, 190)
        save(still, id)
        neutral, action, recoil = [frame_at(tile, scale) for tile in (ready, strike, hit)]
        poses = {
            'ready': neutral, 'strike': action, 'hit': recoil,
            'step': transformed(neutral, -2, 5, -3), 'windup': transformed(neutral, 5, -4, 0),
            'follow': transformed(action, -5, 6, 1), 'down': transformed(recoil, 9, -7, 2, 0.76),
            'guard': transformed(neutral, 2, -8), 'open': transformed(recoil, -3, -4),
        }
        for pose, frame in poses.items():
            save(frame, f'motion-{id}-{pose}')


def write_cover(image):
    cover = ImageOps.contain(image.convert('RGB'), (1040, 740), method=RESAMPLE)
    save(cover, 'cover', 93)
    hero = ImageOps.fit(cover, (1140, 380), method=RESAMPLE, centering=(0.5, 0.32))
    hero.save(SITE / 'hero.webp', quality=90, method=5)


if __name__ == '__main__':
    for id in ('boy', 'girl'):
        write_portrait(id, alpha_tiles(open_source(id), 1, 1)[0])
        write_player(id, open_source(f'{id}-strike'), open_source(f'{id}-other'))
    for key, prefix, start in (('roster-a', 'mob', 1), ('roster-b', 'mob', 5), ('roster-boss', 'boss', 1)):
        for index, tile in enumerate(alpha_tiles(open_source(key), 2, 2), start):
            write_portrait(f'{prefix}{index}', tile)
    npcs = {
        'npc-a': ['mob1', 'mob2', 'mob3', 'mob4'],
        'npc-b': ['mob5', 'mob6', 'mob7', 'mob8'],
        'npc-boss': ['boss1', 'boss2', 'boss3', 'boss4'],
        'npc-regional': ['boss5', 'boss6'],
        'npc-rivals': ['rival1', 'rival2', 'rival3', 'rival4'],
        'npc-dungeon': ['dboss-store', 'dboss-quiz', 'dboss-sports'],
        'npc-sport': ['sport-blue', 'sport-red', 'sport-green'],
    }
    for key, ids in npcs.items():
        write_npcs(open_source(key), ids)
    write_cover(open_source('cover'))
    split_map('academy-a', [f'map-a{i:02d}' for i in range(1, 7)], 2, 3)
    split_map('academy-b', [f'map-a{i:02d}' for i in range(7, 13)], 2, 3)
    for suffix in ('r', 'c'):
        split_map(f'zone-{suffix}', [f'map-z{i:02d}{suffix}' for i in range(1, 5)], 2, 2)
    split_map('dungeons', ['dungeon-store', 'dungeon-quiz', 'dungeon-sports', 'exam-hall'], 2, 2)
    write_icons('chips', [f'icon-{id}' for id in ('boxing', 'kickboxing', 'muaythai', 'taekwondo', 'wrestling', 'judo', 'ssireum', 'jiujitsu', 'mma')], 3, 3, 48)
    write_icons('stickers', [f'sticker-{id}' for id in ('eraser', 'ruler', 'clip', 'notebook', 'crayon', 'stamp', 'goldpen', 'bandage', 'marble', 'slime', 'whistle', 'captain')], 4, 3, 96)
    write_icons('skills', [f'skill-{id}' for id in ('pencil', 'cheer', 'lunch', 'sprint')], 2, 2, 96)
