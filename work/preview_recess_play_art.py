from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


workspace = Path(__file__).resolve().parent.parent
assets = workspace / 'work' / 'recess' / 'assets'
output = workspace / 'outputs' / 'recess-king-art-preview.png'
paper = Image.new('RGB', (1088, 817), '#f7f0e8')
draw = ImageDraw.Draw(paper)
fonts = Path('C:/Windows/Fonts')
heading = ImageFont.truetype(str(fonts / 'malgunbd.ttf'), 35)
label = ImageFont.truetype(str(fonts / 'malgunbd.ttf'), 20)
small = ImageFont.truetype(str(fonts / 'malgun.ttf'), 15)
draw.text((32, 20), '쉬는 시간의 왕!', font=heading, fill='#302046')
draw.text((34, 71), '딱지치기 표지와 놀이 대결 동작', font=small, fill='#685571')

cover = Image.open(assets / 'cover.webp').convert('RGB')
paper.paste(ImageOps.fit(cover, (572, 429), method=Image.Resampling.LANCZOS), (32, 110))


def paste_sprite(name, left, top, max_size):
    image = Image.open(assets / f'{name}.webp').convert('RGBA')
    bounds = image.getchannel('A').getbbox()
    if bounds:
        image = image.crop(bounds)
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    x = left + (max_size[0] - image.width) // 2
    y = top + max_size[1] - image.height
    paper.paste(image, (x, y), image.getchannel('A'))


for index, (family, title, names) in enumerate((
        ('toss', '던지기', ('딱지 · 지우개 · 공', 'motion-boy-toss-strike', 'motion-dboss-quiz-strike')),
        ('push', '밀기', ('편 손바닥과 중심 이동', 'motion-girl-push-strike', 'motion-mob2-hit')),
        ('spar', '겨루기', ('헤드기어와 몸통 보호대', 'motion-boy-spar-strike', 'motion-sport-red-ready')))):
    y = 110 + index * 147
    draw.rounded_rectangle((624, y, 1055, y + 135), radius=17, fill='#eee3f4', outline='#dfcee9')
    draw.text((644, y + 38), title, font=label, fill='#432b63')
    draw.text((645, y + 71), names[0], font=small, fill='#62536b')
    paste_sprite(names[1], 827, y + 11, (107, 113))
    paste_sprite(names[2], 936, y + 11, (107, 113))

draw.text((33, 566), '종목 도구와 효과', font=label, fill='#432b63')
names = ('ddakji', 'eraser', 'dodgeball', 'basketball', 'satba', 'headgear', 'glove')
labels = ('딱지', '지우개', '피구공', '농구공', '샅바', '헤드기어', '글러브')
for index, (name, caption) in enumerate(zip(names, labels, strict=True)):
    x = 30 + index * 90
    paste_sprite(f'prop-{name}', x, 606, (79, 63))
    box = small.getbbox(caption)
    draw.text((x + (79 - (box[2]-box[0])) // 2, 689), caption, font=small, fill='#5b4b6a')

for index, (effect, title) in enumerate((('dust', '먼지 구름'), ('cloud', '코믹 구름'))):
    x = 683 + index * 184
    sheet = Image.open(assets / f'fx-{effect}.webp').convert('RGBA')
    image = sheet.crop((320, 0, 480, 120))
    image.thumbnail((132, 99), Image.Resampling.LANCZOS)
    paper.paste(image, (x, 589), image.getchannel('A'))
    draw.text((x + 31, 689), title, font=small, fill='#5b4b6a')

paper.save(output, optimize=True)
