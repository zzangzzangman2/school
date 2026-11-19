"""Build motion strips, equipment masks, and review GIFs for the 7th art handoff."""

from argparse import ArgumentParser
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

import cv2
import numpy as np
from PIL import Image, ImageDraw

from build_recess_pose5 import GeneratedAtlas, equipment_mask


WORK = Path(__file__).resolve().parents[2]
ASSETS = WORK / 'recess' / 'assets'
OUTPUT = WORK.parent / 'outputs'
PREVIEWS = OUTPUT / 'recess-motion-preview-7'
PACK = OUTPUT / 'recess-motion-pack-7.zip'
HANDOFF = WORK / 'docs' / 'art' / 'codex-motion-handoff-7.md'
WIDTH, HEIGHT = 280, 255
GROUND, ORIGIN = 249, 140
MASK_COLORS = np.array([
    (0, 0, 0), (255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0),
], dtype=np.uint8)
ROW, COL = np.indices((HEIGHT, WIDTH), dtype=np.float32)


@dataclass
class Frame:
    art: np.ndarray
    mask: np.ndarray | None = None


def alpha_bounds(art, cutoff=105):
    ys, xs = np.where(art[:, :, 3] >= cutoff)
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def clean(art):
    art = art.copy()
    alpha = art[:, :, 3]
    _, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 105).astype('uint8'))
    main = stats[1:, cv2.CC_STAT_AREA].argmax() + 1
    edge = cv2.dilate((labels == main).astype('uint8'), np.ones((3, 3), np.uint8))
    alpha[:] = np.clip((alpha.astype(np.float32) - 32) * 255 / 219, 0, 255).astype('uint8') * edge
    art[alpha == 0] = 0
    return art


def translate(frame, dx, dy):
    matrix = np.float32([[1, 0, dx], [0, 1, dy]])
    art = cv2.warpAffine(frame.art, matrix, (WIDTH, HEIGHT), flags=cv2.INTER_NEAREST)
    mask = None if frame.mask is None else cv2.warpAffine(
        frame.mask, matrix, (WIDTH, HEIGHT), flags=cv2.INTER_NEAREST,
    )
    return Frame(art, mask)


def fit_to_ground(frame, *, flight=0, center_feet=True):
    left, top, right, bottom = alpha_bounds(frame.art)
    dx = 0
    if center_feet:
        contact = np.where(np.any(frame.art[max(top, bottom - 15):bottom, :, 3] >= 105, axis=0))[0]
        dx = round(ORIGIN - (contact[0] + contact[-1]) / 2)
    dx = max(4 - left, min(WIDTH - 4 - right, dx))
    return translate(frame, dx, GROUND - bottom - flight)


def read_pose(actor, pose):
    source = ASSETS / f'motion-{actor}-{pose}.webp'
    art = clean(np.asarray(Image.open(source).convert('RGBA')))
    mask = None
    if actor == 'boy':
        mask_path = ASSETS / f'wardrobe-boy-{pose}.webp'
        if mask_path.exists():
            mask = np.asarray(Image.open(mask_path).convert('RGB'), dtype=np.uint8).copy()
            distances = np.abs(mask.astype(np.int16)[:, :, None, :] - MASK_COLORS).sum(axis=3)
            mask = MASK_COLORS[distances.argmin(axis=2)]
        else:
            mask = np.asarray(equipment_mask(Image.fromarray(art), 'boy', pose)).copy()
        mask[art[:, :, 3] < 35] = 0
    return fit_to_ground(Frame(art, mask))


def remap(frame, mx, my):
    mx, my = mx.astype(np.float32, copy=False), my.astype(np.float32, copy=False)
    art = cv2.remap(frame.art, mx, my, cv2.INTER_LINEAR)
    mask = None if frame.mask is None else cv2.remap(frame.mask, mx, my, cv2.INTER_NEAREST)
    return Frame(art, mask)


def flex(frame, lean=0, chest=0, bend=0, stride=0, lift=0):
    """Animate the torso and limbs around the same ground plane."""
    left, top, right, _ = alpha_bounds(frame.art)
    pivot = (left + right) / 2
    body = np.clip((GROUND - ROW) / (GROUND - top), 0, 1.2)
    torso = np.sin(np.pi * np.clip(body, 0, 1))
    legs = np.clip((0.51 - body) / 0.51, 0, 1)
    side = np.tanh((COL - pivot) / 17)
    horizontal = lean * body + stride * legs * side
    vertical = -chest * torso - bend * body + np.maximum(0, lift * side) * legs
    return fit_to_ground(
        remap(frame, COL - horizontal, ROW + vertical),
        center_feet=False,
    )


def breathing(ready, length):
    return [
        flex(ready, lean=1.8 * np.sin(phase), chest=2.8 * (1 - np.cos(phase)) / 2,
             bend=1.4 * np.sin(phase))
        for phase in np.arange(length) * 2 * np.pi / length
    ]


def generated_mask(art, action, index):
    """Separate outfit regions while retaining skin, hair, gloves and the undershirt."""
    left, top, right, bottom = alpha_bounds(art)
    x = (COL - left) / (right - left)
    y = (ROW - top) / (bottom - top)
    hue, sat, value = np.moveaxis(cv2.cvtColor(art[:, :, :3], cv2.COLOR_RGB2HSV), 2, 0)
    skin = (2 <= hue) & (hue <= 33) & (sat > 32)
    dark = (value < 69) | ((hue > 121) & (hue < 165) & (sat > 62) & (value < 151))
    material = (art[:, :, 3] >= 44) & ~skin & ~dark
    waist = {'run': (0.48, 0.47, 0.50, 0.48, 0.47, 0.50),
             'down': (0.47, 0.51, 0.48, 0.55, 0.55),
             'victory': (0.43, 0.43, 0.43, 0.47, 0.46, 0.45)}[action][index]
    shoe = y > 0.86
    if action == 'run' and index in (1, 4):
        shoe |= (x < 0.28) & (y > 0.66)
    if action == 'run' and index in (2, 5):
        shoe |= (x > 0.52) & (y > 0.77)
    if action == 'down' and index >= 2:
        near_shoe, far_shoe = ((101, 181) if index == 2 else (129, 188))
        shoe = (ROW >= 218) & ((abs(COL - near_shoe) < 22) | (abs(COL - far_shoe) < 24))
    shirt = (y > 0.18) | ((abs(x - 0.5) > 0.23) & (y > 0.08) & (action == 'victory'))
    mask = np.zeros((HEIGHT, WIDTH), dtype='uint8')
    mask[material & shirt & (y <= waist)] = 1
    mask[material & (y > waist)] = 2
    mask[material & shoe] = 4
    gold = (art[:, :, 3] >= 80) & (hue >= 7) & (hue <= 24) & (sat > 63) & (value > 123)
    gold &= (y > waist - 0.06) & (y < (0.92 if action == 'down' else waist + 0.17))
    _, labels, stats, _ = cv2.connectedComponentsWithStats(gold.astype('uint8'))
    if len(stats) > 1:
        largest = 1 + stats[1:, cv2.CC_STAT_AREA].argmax()
        if stats[largest, cv2.CC_STAT_AREA] >= 5:
            mask[labels == largest] = 3
    if action == 'down':
        # The forearm can occlude the leggings, and the bracing glove touches the floor.
        glove_regions = (
            ((132, 73, 19, 14),),
            ((144, 99, 14, 14), (183, 164, 13, 19)),
            ((132, 171, 18, 17), (155, 237, 18, 16)),
            ((142, 183, 16, 20), (160, 177, 14, 15)),
            ((134, 193, 17, 20), (157, 185, 15, 18)),
        )
        for gx, gy, rx, ry in glove_regions[index]:
            gloves = ((COL - gx) / rx)**2 + ((ROW - gy) / ry)**2 < 1
            mask[gloves] = 0
    return MASK_COLORS[mask]


def generated_motion(path, columns, rows, action, indices):
    tiles = GeneratedAtlas(path, columns, rows).tiles()
    tiles = [tiles[index] for index in indices]
    scale = min(227 / max(tile.height for tile in tiles), 243 / max(tile.width for tile in tiles))
    frames = []
    for i, tile in enumerate(tiles):
        tile = tile.resize((round(tile.width * scale), round(tile.height * scale)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (WIDTH, HEIGHT))
        canvas.paste(tile, ((WIDTH - tile.width) // 2, GROUND - tile.height))
        flight = 6 if action == 'run' and i in (2, 5) else 0
        art = clean(np.asarray(canvas))
        if action == 'run':
            left, top, right, bottom = alpha_bounds(art)
            torso_y = slice(round(top + 0.32 * (bottom - top)), round(top + 0.50 * (bottom - top)))
            _, torso_x = np.where(art[torso_y, :, 3] >= 128)
            dx = max(4 - left, min(WIDTH - 4 - right, round(ORIGIN - np.median(torso_x))))
            art = translate(Frame(art), dx, 0).art
        art = fit_to_ground(Frame(art), flight=flight, center_feet=action != 'run').art
        mask = generated_mask(art, action, i)
        frames.append(Frame(art, mask))
    return frames


def dasom_run(path):
    """Pack eight separate drawings using the belt as the horizontal pivot."""
    with Image.open(path) as source:
        sheet = np.asarray(source.convert('RGBA'))
    tiles = []
    for row in np.array_split(sheet, 2, axis=0):
        for cell in np.array_split(row, 4, axis=1):
            # The generated atlas has a low-chroma halo around the colored art.
            tile = cell.copy()
            chroma = np.ptp(tile[:, :, :3], axis=2)
            opacity = tile[:, :, 3].astype(np.float32)
            colored = ((opacity >= 247) & (chroma >= 9)).astype('uint8')
            colored = cv2.morphologyEx(colored, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
            _, labels, stats, _ = cv2.connectedComponentsWithStats(colored)
            main = 1 + stats[1:, cv2.CC_STAT_AREA].argmax()
            body = cv2.morphologyEx((labels == main).astype('uint8'), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
            fringe = cv2.dilate(body, np.ones((3, 3), np.uint8))
            edge = np.clip((opacity - 212) / 36, 0, 1) * np.clip((chroma.astype(np.float32) - 6) / 10, 0, 1)
            tile[:, :, 3] = (np.maximum(body * 0.99, edge * fringe) * 255).astype('uint8')
            tile[tile[:, :, 3] == 0] = 0
            tiles.append(Image.fromarray(tile).crop(alpha_bounds(tile, cutoff=40)))

    scale = 216 / max(tile.height for tile in tiles)
    frames = []
    for index, tile in enumerate(tiles):
        tile = tile.resize((round(tile.width * scale), round(tile.height * scale)), Image.Resampling.LANCZOS)
        red, green, blue, alpha = np.moveaxis(np.asarray(tile).astype(np.int16), -1, 0)
        cy = np.arange(tile.height)[:, None]
        belt = (alpha > 140) & (red - green > 34) & (red - blue > 19)
        belt &= (cy >= tile.height * 0.35) & (cy < tile.height * 0.49)
        _, sash_x = np.where(belt)
        if len(sash_x) < 20:
            raise ValueError(f'O Dasom run frame {index + 1} is missing the red belt anchor')
        flight = 9 if index in (3, 7) else 0
        canvas = Image.new('RGBA', (WIDTH, HEIGHT))
        canvas.paste(tile, (ORIGIN - round(np.median(sash_x)), GROUND - flight - tile.height))
        frame = fit_to_ground(Frame(np.asarray(canvas).copy()), flight=flight, center_feet=False)
        frames.append(frame)
    return frames


def hero_basic(run, down, victory):
    pose = lambda name: read_pose('boy', name)
    ready, windup, strike, follow, hit = map(pose, ('ready', 'windup', 'strike', 'follow', 'hit'))
    yield 'idle', breathing(ready, 6)
    yield 'run', generated_motion(run, 6, 1, 'run', [0, 1, 2, 3, 4, 5])
    yield 'punch', [flex(ready, lean=-7, bend=-4), windup, strike,
                    flex(strike, lean=-8, bend=-5), follow, ready]
    yield 'hit', [flex(hit, lean=-5, bend=-4), hit, flex(hit, lean=5, bend=2)]
    yield 'down', generated_motion(down, 3, 2, 'down', [1, 2, 3, 4, 5])
    yield 'victory', generated_motion(victory, 3, 2, 'victory', [0, 1, 2, 3, 4, 5])


def hero_specials():
    pose = lambda name: read_pose('boy', name)
    ready = pose('ready')
    wind, hit, end = map(pose, ('kick-windup', 'kick-strike', 'kick-follow'))
    yield 'kick', [ready, wind, hit, flex(hit, lean=5, bend=-1), end, ready]
    knee = pose('knee-strike')
    yield 'knee', [ready, flex(ready, lean=9, bend=-7), knee, flex(knee, lean=4, bend=-8), ready]
    wind, hit, end = map(pose, ('throw-windup', 'throw-strike', 'throw-follow'))
    yield 'throw', [ready, flex(wind, lean=-7), wind, hit, flex(end, lean=7, bend=-11), end, ready]
    hold = pose('hold-strike')
    yield 'hold', [ready, flex(hold, lean=-7, bend=6), hold, flex(hold, lean=2, chest=3), flex(hold, lean=5)]
    guard = pose('guard')
    yield 'guard', [flex(ready, lean=-5), guard, flex(guard, lean=-3, chest=3)]
    for action, p, q in (
        ('rush', 'skill-rush-windup', 'skill-rush-strike'),
        ('counter', 'skill-counter-guard', 'skill-counter-strike'),
        ('combo', 'skill-combo-windup', 'skill-combo-strike'),
    ):
        wind, strike = pose(p), pose(q)
        yield action, [ready, wind, strike, flex(strike, lean=4), flex(strike, lean=-7, bend=-4), ready]
    for action in ('cheer', 'drink'):
        act = pose(f'skill-{action}')
        yield action, [ready, flex(act, lean=-5, bend=-7), act, flex(act, lean=3, chest=3), ready]
    step, end = map(pose, ('skill-step-windup', 'skill-step-follow'))
    yield 'step', [step, flex(step, lean=8, stride=-13), end, ready]


def enemy_motions(actor):
    ready, windup, attack, follow, hit, down = (
        read_pose(actor, name) for name in ('ready', 'windup', 'strike', 'follow', 'hit', 'down')
    )
    yield 'idle', breathing(ready, 4)
    yield 'attack', [windup, attack, follow, ready]
    yield 'hit', [hit, flex(hit, lean=6, bend=3)]
    yield 'down', [hit, flex(hit, lean=-8, bend=-23), flex(down, lean=6, bend=17), down]


def companion_motions(actor, run_source):
    ready, step, windup, attack, follow, skill_a, skill_b = (
        read_pose(actor, name) for name in ('ready', 'step', 'windup', 'strike', 'follow', 'skill-a', 'skill-b')
    )
    yield 'idle', breathing(ready, 4)
    if actor == 'mate9':
        yield 'run', dasom_run(run_source)
    else:
        yield 'run', [flex(step, lean=lead, bend=bend, stride=stride, lift=lift)
                      for lead, bend, stride, lift in ((3, 0, 14, -4), (1, -5, 3, -17),
                                                      (-3, 0, -15, 4), (0, 5, -2, 17))]
    yield 'attack', [windup, flex(windup, lean=8, bend=-6), attack, follow, ready]
    yield 'skill', [flex(skill_a, lean=-5, bend=-4), skill_a, flex(skill_a, lean=8, bend=-9),
                    skill_b, flex(skill_b, lean=3, chest=3), flex(skill_b, lean=-3, bend=-5)]


def save_strip(actor, action, frames, output, preview_dir=PREVIEWS, *, frame_ms=None):
    name = f'anim-{actor}-{action}'
    for frame in frames:
        left, top, right, bottom = alpha_bounds(frame.art)
        if not (3 <= left < right <= WIDTH - 3 and 2 <= top < bottom <= GROUND):
            raise ValueError(f'{name} has a clipped or ungrounded frame: {(left, top, right, bottom)}')
        if frame.mask is not None:
            frame.mask[frame.art[:, :, 3] < 35] = 0
    if any(np.array_equal(first.art, second.art) for first, second in zip(frames, frames[1:])):
        raise ValueError(f'{name} has identical consecutive frames')
    if not all(frame.mask is not None for frame in frames) and actor == 'boy':
        raise ValueError(f'{name} is missing a wardrobe frame')
    art_path = output / f'{name}.webp'
    Image.fromarray(np.concatenate([frame.art for frame in frames], axis=1)).save(
        art_path, 'WEBP', quality=91, method=5,
    )
    paths = [art_path]
    if actor == 'boy':
        mask_path = output / f'animmask-{actor}-{action}.webp'
        Image.fromarray(np.concatenate([frame.mask for frame in frames], axis=1)).save(
            mask_path, 'WEBP', lossless=True, method=5,
        )
        paths.append(mask_path)
    gif_path = preview_dir / f'{name}.gif'
    images = []
    floor = Image.new('RGBA', (WIDTH, HEIGHT), '#231e32')
    draw = ImageDraw.Draw(floor)
    draw.line((6, GROUND, WIDTH - 6, GROUND), '#807394')
    draw.line((ORIGIN, GROUND, ORIGIN, HEIGHT - 1), '#d1ae83')
    for frame in frames:
        images.append(Image.alpha_composite(floor, Image.fromarray(frame.art)).convert('RGB'))
    delay = frame_ms if frame_ms is not None else (115 if action == 'idle' else 70)
    delays = [delay] * len(images)
    if action not in ('idle', 'run'):
        delays[-1] += 320
    images[0].save(gif_path, save_all=True, append_images=images[1:], loop=0,
                   duration=delays, disposal=2, optimize=True)
    with Image.open(gif_path) as preview:
        assert preview.n_frames == len(frames) and preview.info['loop'] == 0, gif_path
    print(name, len(frames), flush=True)
    return [*paths, gif_path]


def pack_name(path):
    prefix = 'previews' if path.suffix == '.gif' else 'assets'
    return f'{prefix}/{path.name}'


def replace_dasom_run(output, source):
    if not PACK.is_file():
        raise FileNotFoundError('Build the full motion pack before replacing a single run.')
    changed = {pack_name(path): path for path in save_strip('mate9', 'run', dasom_run(source), output)}
    changed[HANDOFF.name] = HANDOFF
    with NamedTemporaryFile(dir=PACK.parent, suffix='.zip', delete=False) as scratch:
        temporary_pack = Path(scratch.name)
    try:
        with ZipFile(PACK) as previous, ZipFile(temporary_pack, 'w', ZIP_DEFLATED) as updated:
            for entry in previous.infolist():
                if entry.filename not in changed:
                    updated.writestr(entry, previous.read(entry))
            for archive_name, path in changed.items():
                updated.write(path, archive_name)
        temporary_pack.replace(PACK)
    finally:
        temporary_pack.unlink(missing_ok=True)


def main():
    parser = ArgumentParser()
    parser.add_argument('--run', type=Path)
    parser.add_argument('--down', type=Path)
    parser.add_argument('--victory', type=Path)
    parser.add_argument('--mate9-run', required=True, type=Path)
    parser.add_argument('--output', default=ASSETS, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    hero_sources = (args.run, args.down, args.victory)
    if not any(hero_sources):
        replace_dasom_run(args.output, args.mate9_run)
        return
    if not all(hero_sources):
        parser.error('--run, --down and --victory must be supplied together for a full build')
    actors = [
        ('boy', hero_basic(args.run, args.down, args.victory)),
        *((f'thug{i}', enemy_motions(f'thug{i}')) for i in range(1, 9)),
        *((f'thug-boss{i}', enemy_motions(f'thug-boss{i}')) for i in range(1, 5)),
        *((f'mate{i}', companion_motions(f'mate{i}', args.mate9_run)) for i in range(1, 17)),
        ('boy', hero_specials()),
    ]
    files = [path for actor, moves in actors for action, frames in moves
             for path in save_strip(actor, action, frames, args.output)]
    with ZipFile(PACK, 'w', ZIP_DEFLATED) as pack:
        for path in files:
            pack.write(path, pack_name(path))
        pack.write(HANDOFF, HANDOFF.name)


if __name__ == '__main__':
    main()
