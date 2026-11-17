from hashlib import sha256
from pathlib import Path
import re

from PIL import Image
from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parent.parent
site = root / 'work' / 'recess'
assets = site / 'assets'
roster = [f'mob{i}' for i in range(1, 9)]
dungeons = {
    'coin': ('매점 줄서기 대회', 'store', ['mob1', 'mob2', 'mob3']),
    'ticket': ('도서실 퀴즈왕', 'quiz', ['mob4', 'mob5', 'mob8']),
    'badge': ('전국 체력장', 'sports', ['mob3', 'mob6', 'mob7']),
}


def check_character(id, poses):
    files = [assets / f'{id}.webp', *(assets / f'motion-{id}-{pose}.webp' for pose in poses)]
    assert len({sha256(path.read_bytes()).hexdigest() for path in files[1:]}) == len(poses), id
    for index, path in enumerate(files):
        image = Image.open(path)
        assert image.height == 255 and image.mode == 'RGBA', path
        assert (155 <= image.width <= 190 if index == 0 else image.width == 280), path
        alpha = image.getchannel('A')
        assert alpha.getextrema() == (0, 255), path
        left, top, right, bottom = alpha.point(lambda pixel: 255 if pixel >= 36 else 0).getbbox()
        assert 0 < left < right < image.width and 0 < top < bottom < image.height, path


for id in roster:
    check_character(id, ('windup', 'strike', 'hit', 'down'))
assert len({sha256((assets / f'{id}.webp').read_bytes()).hexdigest() for id in roster}) == 8
for _, dungeon, _ in dungeons.values():
    check_character(f'dboss-{dungeon}', ('ready', 'step', 'windup', 'strike', 'follow', 'hit', 'down', 'guard', 'open'))
    assert Image.open(assets / f'dungeon-{dungeon}.webp').size == (535, 302)

for stylesheet in ('assets.css', 'motion.css'):
    css = (site / stylesheet).read_text(encoding='utf-8')
    assert all((site / path).is_file() for path in re.findall(r"url\('([^']+)'\)", css))

url = (root / 'outputs' / 'recess-king.html').as_uri()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    phone = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    failures = []
    phone.on('pageerror', lambda error: failures.append(str(error)))
    phone.on('requestfailed', lambda request: failures.append(request.url))
    phone.clock.install()
    phone.goto(url)
    phone.get_by_role('radio', name='남학생').check()
    phone.get_by_role('textbox', name='닉네임').fill('하루')
    phone.get_by_role('button', name='입학하기').click()
    expect(phone.locator('#rival-sprite')).to_have_attribute('data-sprite', 'mob1')
    expect(phone.locator('#pack .sprite').first).to_have_attribute('data-sprite', 'mob2')
    assert phone.locator('#rival-sprite').evaluate("e => !getComputedStyle(e).filter.includes('hue-rotate')")

    phone.evaluate('''() => {
      state.totalClears = 3;
      state.prestige.count = 1;
      state.training.power = 300;
      state.training.health = 300;
      state.autoSkill = false;
      state.hp = maxHp(state);
      commit();
    }''')

    for id, (title, dungeon, minions) in dungeons.items():
        phone.get_by_role('button', name='대결', exact=True).click()
        phone.get_by_role('button', name=f'{title} Lv.1 도전').click()
        expect(phone.locator('#arena')).to_have_attribute('data-map', f'd-{id}')
        expect(phone.locator('#battle-title')).to_have_text(title)
        expect(phone.locator('#rival-sprite')).to_have_attribute('data-sprite', minions[0])
        expect(phone.locator('#pack .sprite').last).to_have_attribute('data-sprite', f'dboss-{dungeon}')
        assert phone.locator('.arena-art').evaluate("e => getComputedStyle(e).backgroundImage.includes('data:image/webp')")
        for _ in range(120):
            if phone.locator('#rival-sprite').get_attribute('data-sprite') == f'dboss-{dungeon}':
                break
            phone.clock.run_for(70)
        expect(phone.locator('#rival-sprite')).to_have_attribute('data-sprite', f'dboss-{dungeon}')
        assert phone.locator('#rival-sprite').evaluate("e => getComputedStyle(e).backgroundImage.includes('data:image/webp')")
        phone.screenshot(path=str(root / 'work' / f'dungeon-{dungeon}-qa.png'))
        phone.clock.run_for(6000)
        assert phone.evaluate(f'state.dungeons.{id}') == 1

    # A previous version can restore the already wounded enemy with the new sprite.
    preserved = phone.evaluate('''() => {
      enterDungeon(state, 'coin');
      state.front.sprite = 'rival1';
      state.pack.at(-1).sprite = 'boss2';
      state.enemyHp = 7;
      state.pack[0].hp = 3;
      const saved = restore({ version: 5, when: Date.now(), state: structuredClone(state) });
      return [saved.front.sprite, saved.pack.at(-1).sprite, saved.enemyHp, saved.pack[0].hp];
    }''')
    assert preserved == ['mob1', 'dboss-store', 7, 3], preserved
    assert not failures, failures
    browser.close()

print('8 classmates, 3 new dungeon bosses, 59 unique pose files, 3 dungeon backgrounds, and existing-save artwork verified.')
