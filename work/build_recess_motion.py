from argparse import ArgumentParser
from pathlib import Path

from PIL import Image


parser = ArgumentParser()
for name in ('boy', 'girl', 'boss1', 'rivals'):
    parser.add_argument(f'--{name}', required=True, type=Path)
paths = parser.parse_args()
site = Path(__file__).resolve().parent / 'recess'
rules = []


def cells(path, size):
    image = Image.open(path).convert('RGBA')
    occupied = image.getchannel('A').point(lambda alpha: 1 if alpha >= 36 else 0)

    def edges(length, line_count):
        cuts = [0]
        margin = max(2, round(length / size * 0.11))
        for cell in range(1, size):
            center = round(length * cell / size)
            cuts.append(min(range(center - margin, center + margin + 1), key=lambda pos: (line_count(pos), abs(pos - center))))
        return [*cuts, length]

    xs = edges(image.width, lambda x: sum(occupied.crop((x, 0, x + 1, image.height)).get_flattened_data()))
    ys = edges(image.height, lambda y: sum(occupied.crop((0, y, image.width, y + 1)).get_flattened_data()))
    for y1, y2 in zip(ys, ys[1:]):
        for x1, x2 in zip(xs, xs[1:]):
            frame = image.crop((x1 + 1, y1 + 1, x2 - 1, y2 - 1))
            bounds = frame.getchannel('A').point(lambda alpha: 255 if alpha >= 36 else 0).getbbox()
            if not bounds:
                raise ValueError(f'Empty {path.name} frame at row {row + 1}, column {column + 1}')
            yield frame.crop(bounds)


def make_animation(character, names, images):
    max_height = max(image.height for image in images)
    max_width = max(image.width for image in images)
    scale = min(241 / max_height, 266 / max_width)
    for name, image in zip(names, images, strict=True):
        sprite = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (280, 255))
        frame.paste(sprite, ((frame.width - sprite.width) // 2, frame.height - sprite.height - 2))
        file = f'motion-{character}-{name}.webp'
        frame.save(site / 'assets' / file, quality=92, alpha_quality=100, method=6)
        selectors = [f"[data-sprite='{character}'][data-pose='{name}']"]
        if name == 'strike' and (character.startswith('rival') or character == 'boss1'):
            selectors.append(f"[data-sprite='{character}'][data-pose='launch']")
        if character.startswith('rival') and name == 'strike':
            selectors.append(f"[data-sprite='{character}'][data-pose='follow']")
        rules.append(f"{', '.join(selectors)} {{ --pose-image: url('assets/{file}'); }}")


main_poses = ['ready', 'step', 'windup', 'strike', 'follow', 'hit', 'down', 'victory', 'run']
for name in ('boy', 'girl'):
    make_animation(name, main_poses, list(cells(getattr(paths, name), 3)))
make_animation('boss1', [*main_poses[:7], 'guard', 'open'], list(cells(paths.boss1, 3)))

rivals = list(cells(paths.rivals, 4))
for index in range(4):
    make_animation(f'rival{index + 1}', ['windup', 'strike', 'hit', 'down'], rivals[index * 4:index * 4 + 4])

(site / 'motion.css').write_text('\n'.join(rules) + '\n', encoding='utf-8')
