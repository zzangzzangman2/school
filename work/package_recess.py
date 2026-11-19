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
styles = {name: (source / name).read_text(encoding='utf-8')
          for name in ('style.css', 'assets.css', 'motion.css', 'wardrobe.css', 'anim.css')}
asset_paths = {path for css in styles.values() for path in re.findall(r"url\('([^']+\.(?:webp|woff2))'\)", css)}
for filename, original_css in styles.items():
    css = embed_images(original_css)
    html = html.replace(f'<link rel="stylesheet" href="{filename}">', f'<style>\n{css}\n</style>')
scripts = ('season-calendar.js', 'game.js', 'wardrobe.js', 'anim.js', 'meta-ui.js', 'live-ui.js', 'ui.js')
for filename in scripts:
    code = (source / filename).read_text(encoding='utf-8')
    html = html.replace(f'<script src="{filename}"></script>', f'<script>\n{code}\n</script>')
(output / 'recess-king.html').write_text(html, encoding='utf-8')

with ZipFile(output / 'recess-king-source.zip', 'w', compression=ZIP_DEFLATED) as archive:
    for name in ('index.html', 'style.css', 'assets.css', 'motion.css', 'anim.css', *scripts, 'README.md'):
        archive.write(source / name, f'recess-king/{name}')
    # Inline canvas inputs so the editable game also works when opened via file://.
    archive.writestr('recess-king/wardrobe.css', embed_images((source / 'wardrobe.css').read_text(encoding='utf-8')))
    for name in sorted(asset_paths):
        archive.write(source / name, f'recess-king/{name}')
