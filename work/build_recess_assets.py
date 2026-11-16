from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageOps


parser = ArgumentParser()
for name in ('early', 'late', 'sprites', 'cover'):
    parser.add_argument(f'--{name}', required=True, type=Path)
parser.add_argument('--bosses', type=Path)
args = parser.parse_args()

site = Path(__file__).resolve().parent / 'recess'
assets = site / 'assets'
assets.mkdir(exist_ok=True)


def sheet_cells(path, rows, inset=0):
    sheet = Image.open(path)
    for row in range(rows):
        for column in range(3):
            yield sheet.crop((
                round(column * sheet.width / 3) + inset,
                round(row * sheet.height / rows) + inset,
                round((column + 1) * sheet.width / 3) - inset,
                round((row + 1) * sheet.height / rows) - inset,
            ))


cover = Image.open(args.cover).convert('RGB')
cover.thumbnail((900, 700), Image.Resampling.LANCZOS)
cover.save(assets / 'cover.webp', quality=89, method=6)
rules = [":root { --cover-image: url('assets/cover.webp'); }"]

maps = [*sheet_cells(args.early, 3, inset=3), *sheet_cells(args.late, 3, inset=3)]
for index, cell in enumerate(maps, 1):
    path = f'map-{index:02}.webp'
    cell = ImageOps.fit(cell.convert('RGB'), (535, 302), method=Image.Resampling.LANCZOS)
    cell.save(assets / path, quality=88, method=6)
    rules.append(f"[data-map='{index}'] {{ --map-image: url('assets/{path}'); }}")


def write_sprites(path, names):
    for name, sprite in zip(names, sheet_cells(path, 2), strict=True):
        sprite = sprite.convert('RGBA')
        visible = sprite.getchannel('A').point(lambda value: 255 if value > 38 else 0).getbbox()
        if not visible:
            raise ValueError(f'Missing visible art for {name}')
        sprite = sprite.crop(visible)
        sprite.thumbnail((236, 255), Image.Resampling.LANCZOS)
        sprite.save(assets / f'{name}.webp', quality=93, alpha_quality=100, method=6)
        rules.append(f"[data-sprite='{name}'] {{ --sprite-image: url('assets/{name}.webp'); }}")


write_sprites(args.sprites, ['boy', 'girl', 'rival1', 'rival2', 'rival3', 'rival4'])
if args.bosses:
    write_sprites(args.bosses, [f'boss{index}' for index in range(1, 7)])
(site / 'assets.css').write_text('\n'.join(rules) + '\n', encoding='utf-8')
