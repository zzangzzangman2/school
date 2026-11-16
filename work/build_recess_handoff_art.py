from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


parser = ArgumentParser()
for name in ('mob12', 'mob34', 'mob56', 'mob78', 'store', 'quiz', 'sports', 'dungeons'):
    parser.add_argument(f'--{name}', required=True, type=Path)
args = parser.parse_args()

workspace = Path(__file__).resolve().parent.parent
site = workspace / 'work' / 'recess'
assets = site / 'assets'
asset_rules = []
motion_rules = []
marker = '/* Classmates and after-school dungeons */'


def cuts(length, count, line):
    result = [0]
    margin = round(length / count * 0.17)
    for index in range(1, count):
        center = round(length * index / count)
        candidate = min(range(center - margin, center + margin + 1), key=lambda position: (line(position), abs(position - center)))
        result.append(candidate)
    return [*result, length]


def sprite_rows(path, columns, rows):
    sheet = Image.open(path).convert('RGBA')
    occupied = sheet.getchannel('A').point(lambda alpha: 1 if alpha >= 36 else 0)
    ys = cuts(sheet.height, rows, lambda y: sum(occupied.crop((0, y, sheet.width, y + 1)).get_flattened_data()))
    frames = []
    for top, bottom in zip(ys, ys[1:]):
        xs = cuts(sheet.width, columns, lambda x: sum(occupied.crop((x, top, x + 1, bottom)).get_flattened_data()))
        row = []
        for left, right in zip(xs, xs[1:]):
            tile = sheet.crop((left, top, right, bottom))
            bounds = tile.getchannel('A').point(lambda alpha: 255 if alpha >= 36 else 0).getbbox()
            if not bounds:
                raise ValueError(f'Missing character in {path.name} at {left}, {top}')
            row.append(tile.crop(bounds))
        frames.append(row)
    return frames


def write_sprite(frame, scale, filename, width):
    sprite = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (width, 255))
    result.paste(sprite, ((width - sprite.width) // 2, 253 - sprite.height))
    result.save(assets / filename, quality=92, alpha_quality=100, method=5)


def write_character(character, poses):
    ready = poses['ready']
    max_height = max(frame.height for frame in poses.values())
    max_width = max(frame.width for frame in poses.values())
    scale = min(245 / max_height, 272 / max_width, 182 / ready.width)
    width = max(155, min(190, round(ready.width * scale) + 8))
    base = f'{character}.webp'
    write_sprite(ready, scale, base, width)
    asset_rules.append(f"[data-sprite='{character}'] {{ --sprite-image: url('assets/{base}'); }}")

    for pose, frame in poses.items():
        if character.startswith('mob') and pose == 'ready':
            continue
        filename = f'motion-{character}-{pose}.webp'
        write_sprite(frame, scale, filename, 280)
        aliases = [pose]
        if pose == 'strike':
            aliases.append('launch')
            if character.startswith('mob'):
                aliases.append('follow')
        selectors = ', '.join(f"[data-sprite='{character}'][data-pose='{alias}']" for alias in aliases)
        motion_rules.append(f"{selectors} {{ --pose-image: url('assets/{filename}'); }}")


def update_css(name, rules):
    stylesheet = site / name
    previous = stylesheet.read_text(encoding='utf-8').split(marker, 1)[0].rstrip()
    stylesheet.write_text(f"{previous}\n\n{marker}\n" + '\n'.join(rules) + '\n', encoding='utf-8')


for start in (1, 3, 5, 7):
    path = getattr(args, f'mob{start}{start + 1}')
    for index, frames in enumerate(sprite_rows(path, 5, 2), start):
        write_character(f'mob{index}', dict(zip(('ready', 'windup', 'strike', 'hit', 'down'), frames, strict=True)))

boss_poses = ('ready', 'step', 'windup', 'strike', 'follow', 'hit', 'down', 'guard', 'open')
for dungeon in ('store', 'quiz', 'sports'):
    frames = [frame for row in sprite_rows(getattr(args, dungeon), 3, 3) for frame in row]
    write_character(f'dboss-{dungeon}', dict(zip(boss_poses, frames, strict=True)))

sheet = Image.open(args.dungeons).convert('RGB')
for index, (dungeon, key) in enumerate((('store', 'coin'), ('quiz', 'ticket'), ('sports', 'badge'))):
    top = round(sheet.height * index / 3) + 3
    bottom = round(sheet.height * (index + 1) / 3) - 3
    tile = sheet.crop((0, top, sheet.width, bottom))
    image = ImageOps.fit(tile, (535, 302), method=Image.Resampling.LANCZOS)
    filename = f'dungeon-{dungeon}.webp'
    image.save(assets / filename, quality=90, method=5)
    asset_rules.append(f"[data-map='d-{key}'] {{ --map-image: url('assets/{filename}'); }}")

update_css('assets.css', asset_rules)
update_css('motion.css', motion_rules)


def preview():
    image = Image.new('RGB', (1120, 880), '#f6f0e7')
    draw = ImageDraw.Draw(image)
    fonts = Path('C:/Windows/Fonts')
    title = ImageFont.truetype(str(fonts / 'malgunbd.ttf'), 39)
    heading = ImageFont.truetype(str(fonts / 'malgunbd.ttf'), 22)
    label = ImageFont.truetype(str(fonts / 'malgun.ttf'), 15)
    draw.text((36, 26), '쉬는 시간의 왕!', font=title, fill='#292346')
    draw.text((38, 85), '친구 캐릭터', font=heading, fill='#6942a3')
    props = ('노란 모자', '분홍 원피스', '축구 유니폼', '단발과 줄넘기', '안경과 리코더', '포니테일과\n체육복', '농구공', '머리띠와\n임원 배지')
    grades = ('1학년', '1학년', '3학년', '3학년', '4학년', '5학년', '6학년', '6학년')
    for index, (prop, grade) in enumerate(zip(props, grades, strict=True)):
        x, y = 36 + (index % 4) * 265, 125 + (index // 4) * 186
        draw.rounded_rectangle((x, y, x + 253, y + 172), radius=16, fill='#eee4f6', outline='#e0d3ec')
        sprite = Image.open(assets / f'mob{index + 1}.webp').convert('RGBA')
        sprite.thumbnail((98, 145), Image.Resampling.LANCZOS)
        image.paste(sprite, (x + 20, y + 14), sprite.getchannel('A'))
        draw.text((x + 128, y + 61), grade, font=heading, fill='#49366d')
        draw.multiline_text((x + 128, y + 94), prop, font=label, fill='#63596f', spacing=3)

    draw.text((38, 501), '방과 후 던전', font=heading, fill='#6942a3')
    labels = ('매점 쟁탈전', '도서실 퀴즈왕', '전국 체력장')
    bosses = ('매점 줄서기 대장', '퀴즈 대장 책벌레', '체력장 1등 선배')
    for index, dungeon in enumerate(('store', 'quiz', 'sports')):
        x, y = 36 + 353 * index, 547
        draw.rounded_rectangle((x, y, x + 341, y + 276), radius=15, fill='#fffdfa', outline='#e1d7df')
        background = Image.open(assets / f'dungeon-{dungeon}.webp').convert('RGB')
        background = background.resize((327, 184), Image.Resampling.LANCZOS)
        image.paste(background, (x + 7, y + 7))
        sprite = Image.open(assets / f'dboss-{dungeon}.webp').convert('RGBA')
        sprite = ImageOps.mirror(sprite)
        sprite.thumbnail((99, 135), Image.Resampling.LANCZOS)
        image.paste(sprite, (x + 213, y + 193 - sprite.height), sprite.getchannel('A'))
        draw.text((x + 13, y + 202), labels[index], font=heading, fill='#34254d')
        draw.text((x + 14, y + 238), bosses[index], font=label, fill='#63596f')
    image.save(workspace / 'outputs' / 'recess-king-art-preview.png', optimize=True)


preview()
print(f'Added {len(asset_rules)} standing/background asset rules and {len(motion_rules)} motion frames.')
