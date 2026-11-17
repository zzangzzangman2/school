from argparse import ArgumentParser
from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageOps


parser = ArgumentParser()
parser.add_argument('inputs', type=Path)
parser.add_argument('--players-only', action='store_true')
args = parser.parse_args()
sources = {key: Path(value) for key, value in json.loads(args.inputs.read_text(encoding='utf-8-sig')).items()}
site = Path(__file__).resolve().parent / 'recess'
assets = site / 'assets'
motion_rules = []
MARKER = '/* Playground contest poses */'
NPC_GROUPS = (
    ('rival1', 'rival2', 'rival3'), ('rival4', 'mob1', 'mob2'),
    ('mob3', 'mob4', 'mob5'), ('mob6', 'mob7', 'mob8'),
    ('boss1', 'boss2', 'boss3'), ('boss4', 'boss5', 'boss6'),
    ('dboss-store', 'dboss-quiz', 'dboss-sports'),
)
NEUTRAL = ('ready', 'step', 'run', 'hit', 'down', 'victory')
ACTIONS = ('windup', 'strike', 'follow')
NPC_POSES = ('ready', 'windup', 'strike', 'hit', 'down')
COLORS = ('blue', 'red', 'green')


def transparent_edges(length, cells, measure):
    margin = round(length / cells * 0.16)
    edges = [0]
    for i in range(1, cells):
        middle = round(length * i / cells)
        edges.append(min(range(middle - margin, middle + margin + 1), key=lambda pos: (measure(pos), abs(pos-middle))))
    return [*edges, length]


def atlas(name, columns, rows):
    image = Image.open(sources[name]).convert('RGBA')
    opaque = image.getchannel('A').point(lambda value: int(value >= 27))
    ys = transparent_edges(image.height, rows, lambda y: sum(opaque.crop((0, y, image.width, y + 1)).get_flattened_data()))
    result = []
    for top, bottom in zip(ys, ys[1:]):
        xs = transparent_edges(image.width, columns, lambda x: sum(opaque.crop((x, top, x + 1, bottom)).get_flattened_data()))
        row = []
        for left, right in zip(xs, xs[1:]):
            tile = image.crop((left, top, right, bottom))
            bounds = tile.getchannel('A').point(lambda value: 255 if value >= 24 else 0).getbbox()
            if not bounds:
                raise ValueError(f'Empty cell in {name} at x={left}, y={top}')
            row.append(tile.crop(bounds))
        result.append(row)
    return result


def flat(rows):
    return [tile for row in rows for tile in row]


def pixel_file(frame, name):
    frame.save(assets / f'{name}.webp', quality=92, alpha_quality=100, method=5)


def render_frame(image, factor, width=280, heel=253):
    sprite = image.resize((round(image.width * factor), round(image.height * factor)), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', (width, 255))
    frame.paste(sprite, ((width - sprite.width) // 2, heel - sprite.height))
    return frame


def character_scale(ready, sprites):
    return min(244 / max(sprite.height for sprite in sprites), 266 / max(sprite.width for sprite in sprites), 182 / ready.width)


def write_still(name, ready, scale):
    width = max(155, min(190, round(ready.width * scale) + 8))
    pixel_file(render_frame(ready, scale, width), name)


def sprite_rule(subject, pose, name, *, mode='', attribute='data-sprite'):
    prefix = f".arena[data-motion='{mode}'] " if mode else ''
    selectors = ', '.join(f"{prefix}[{attribute}='{subject}'][data-pose='{item}']" for item in pose)
    motion_rules.append(f"{selectors} {{ --pose-image: url('assets/{name}.webp'); }}")


def write_player(sex):
    neutral = dict(zip(NEUTRAL, flat(atlas(f'{sex}-neutral', 3, 2)), strict=True))
    toss, push, spar = (dict(zip(ACTIONS, row, strict=True)) for row in atlas(f'{sex}-contest', 3, 3))
    for family, poses in (('', neutral), ('-toss', toss), ('-push', push), ('-spar', spar)):
        scale = character_scale(next(iter(poses.values())), list(poses.values()))
        if not family:
            write_still(sex, neutral['ready'], scale)
        for pose, frame in poses.items():
            name = f'motion-{sex}{family}-{pose}'
            image = render_frame(frame, scale)
            pixel_file(image, name)
            if family == '-toss':
                pixel_file(image, f'motion-{sex}-{pose}')
            if family:
                sprite_rule(sex, (pose,), name, mode=family[1:])


def derive_pose(frame, angle, nudge):
    turn = frame.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    turn = turn.crop(turn.getchannel('A').getbbox())
    turn.thumbnail((265, 244), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', frame.size)
    result.paste(turn, ((result.width - turn.width) // 2 + nudge[0], 252 - turn.height + nudge[1]))
    return result


def write_npc(id, poses):
    scale = character_scale(poses['ready'], list(poses.values()))
    write_still(id, poses['ready'], scale)
    frames = {pose: render_frame(tile, scale) for pose, tile in poses.items()}
    frames['step'] = derive_pose(frames['ready'], -2, (5, -3))
    frames['follow'] = derive_pose(frames['strike'], -4, (-5, 1))
    frames['guard'] = derive_pose(frames['windup'], 4, (-3, 0))
    frames['open'] = derive_pose(frames['ready'], -6, (-5, 0))
    for pose, frame in frames.items():
        filename = f'motion-{id}-{pose}'
        pixel_file(frame, filename)
        sprite_rule(id, (pose, 'launch') if pose == 'strike' else (pose,), filename)


def write_protection():
    rows = atlas('spar-neutral', 4, 2)
    for sex, row in zip(('boy', 'girl'), rows, strict=True):
        scale = character_scale(row[0], row)
        for pose, image in zip(('ready', 'hit', 'down', 'victory'), row, strict=True):
            name = f'motion-{sex}-spar-{pose}'
            pixel_file(render_frame(image, scale), name)
            aliases = (pose, 'step', 'run', 'guard') if pose == 'ready' else (pose,)
            sprite_rule(sex, aliases, name, mode='spar')
        motion_rules.append(f".arena[data-motion='spar'] [data-sprite='{sex}'] {{ --wardrobe-base: none; --wardrobe-mask: none; }}")

    for color, row in zip(COLORS, atlas('spar-rivals', 5, 3), strict=True):
        scale = character_scale(row[0], row)
        id = f'sport-{color}'
        for pose, image in zip(NPC_POSES, row, strict=True):
            name = f'motion-{id}-{pose}'
            pixel_file(render_frame(image, scale), name)
            aliases = (pose, 'step', 'open', 'victory') if pose == 'ready' else (pose, 'launch', 'follow') if pose == 'strike' else (pose, 'guard') if pose == 'windup' else (pose,)
            sprite_rule(id, aliases, name, mode='spar', attribute='data-spar')


def write_scene_art():
    cover = Image.open(sources['cover']).convert('RGB')
    cover.thumbnail((920, 690), Image.Resampling.LANCZOS)
    cover.save(assets / 'cover.webp', quality=92, method=6)
    ImageOps.fit(cover, (1140, 380), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42)).save(site / 'hero.webp', quality=90)

    props = ('ddakji', 'eraser', 'dodgeball', 'basketball', 'satba', 'headgear', 'glove')
    for name, image in zip(props, flat(atlas('props', 4, 2))[:7], strict=True):
        width, height = (48, 28) if name == 'eraser' else (48, 48)
        icon = Image.new('RGBA', (width, height))
        image.thumbnail((width - 2, height - 2), Image.Resampling.LANCZOS)
        icon.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
        pixel_file(icon, f'prop-{name}')

    for effect, cells in zip(('dust', 'cloud'), atlas('fx', 6, 2), strict=True):
        strip = Image.new('RGBA', (6 * 160, 120))
        factor = min(145 / max(cell.width for cell in cells), 108 / max(cell.height for cell in cells))
        for index, cell in enumerate(cells):
            tile = cell.resize((round(cell.width * factor), round(cell.height * factor)), Image.Resampling.LANCZOS)
            strip.paste(tile, (index * 160 + (160 - tile.width) // 2, (112 - tile.height) // 2))
        pixel_file(strip, f'fx-{effect}')

    for name, tile in zip(('boy-middle', 'girl-middle', 'boy-high', 'girl-high'), flat(atlas('uniforms', 2, 2)), strict=True):
        write_still(name, tile, character_scale(tile, [tile]))
    schools = Image.open(sources['schools']).convert('RGB')
    for index, name in enumerate(('m01', 'm02', 'h01', 'h02', 'h03', 'h04')):
        row, col = divmod(index, 2)
        area = (round(col * schools.width / 2) + 3, round(row * schools.height / 3) + 3,
                round((col + 1) * schools.width / 2) - 3, round((row + 1) * schools.height / 3) - 3)
        tile = ImageOps.fit(schools.crop(area), (535, 302), method=Image.Resampling.LANCZOS)
        tile.save(assets / f'map-{name}.webp', quality=91, method=5)


def update_rules():
    css = site / 'motion.css'
    previous = css.read_text(encoding='utf-8').split(MARKER, 1)[0].rstrip()
    css.write_text(f'{previous}\n\n{MARKER}\n' + '\n'.join(motion_rules) + '\n', encoding='utf-8')


for sex in ('boy', 'girl'):
    write_player(sex)
if not args.players_only:
    for index, group in enumerate(NPC_GROUPS, 1):
        for id, row in zip(group, atlas(f'npc{index}', 5, 3), strict=True):
            write_npc(id, dict(zip(NPC_POSES, row, strict=True)))
    write_protection()
    write_scene_art()
    update_rules()
