import base64
import re
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


workspace = Path(__file__).resolve().parent.parent
source = workspace / 'work' / 'recess'
output = workspace / 'outputs'
output.mkdir(exist_ok=True)

MIME = {'.webp': 'image/webp', '.woff2': 'font/woff2'}


def embed_images(css):
    def embed(match):
        path = source / match.group(1)
        data = base64.b64encode(path.read_bytes()).decode('ascii')
        return f"url('data:{MIME[path.suffix]};base64,{data}')"

    return re.sub(r"url\('([\w/.-]+\.(?:webp|woff2))'\)", embed, css)


html = (source / 'index.html').read_text(encoding='utf-8')
for filename in ('style.css', 'assets.css', 'motion.css', 'wardrobe.css', 'anim.css'):
    css = embed_images((source / filename).read_text(encoding='utf-8'))
    html = html.replace(f'<link rel="stylesheet" href="{filename}">', f'<style>\n{css}\n</style>')
for filename in ('game.js', 'wardrobe.js', 'anim.js', 'meta-ui.js', 'ui.js'):
    code = (source / filename).read_text(encoding='utf-8')
    html = html.replace(f'<script src="{filename}"></script>', f'<script>\n{code}\n</script>')
(output / 'recess-king.html').write_text(html, encoding='utf-8')

with ZipFile(output / 'recess-king-source.zip', 'w', compression=ZIP_DEFLATED) as archive:
    for name in ('index.html', 'style.css', 'assets.css', 'motion.css', 'anim.css', 'game.js', 'wardrobe.js', 'anim.js', 'meta-ui.js', 'ui.js', 'hero.webp', 'README.md'):
        archive.write(source / name, f'recess-king/{name}')
    # Inline canvas inputs so the editable game also works when opened via file://.
    archive.writestr('recess-king/wardrobe.css', embed_images((source / 'wardrobe.css').read_text(encoding='utf-8')))
    for image in sorted((source / 'assets').glob('*.webp')):
        archive.write(image, f'recess-king/assets/{image.name}')
    for font in sorted((source / 'assets' / 'fonts').glob('*.woff2')):
        archive.write(font, f'recess-king/assets/fonts/{font.name}')
