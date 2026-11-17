from pathlib import Path
import base64
import re

from PIL import Image
from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parent.parent
site = root / 'work' / 'recess'
assets = site / 'assets'
url = (root / 'outputs' / 'recess-king.html').as_uri()


def from_asset(style_value, name):
    payload = re.search(r'data:image/webp;base64,([A-Za-z0-9+/=]+)', style_value)
    return bool(payload and base64.b64decode(payload[1]) == (assets / f'{name}.webp').read_bytes())


for gender in ('boy', 'girl'):
    for family in ('toss', 'push', 'spar'):
        for pose in ('windup', 'strike', 'follow'):
            assert Image.open(assets / f'motion-{gender}-{family}-{pose}.webp').size == (280, 255)
    for school in ('middle', 'high'):
        assert Image.open(assets / f'{gender}-{school}.webp').height == 255
for name in ('dust', 'cloud'):
    strip = Image.open(assets / f'fx-{name}.webp')
    assert strip.size == (960, 120) and strip.mode == 'RGBA'
    for index in range(6):
        assert strip.getchannel('A').crop((160 * index, 0, 160 * (index + 1), 120)).getbbox()
for name in ('ddakji', 'eraser', 'dodgeball', 'basketball', 'satba', 'headgear', 'glove'):
    icon = Image.open(assets / f'prop-{name}.webp')
    assert icon.size == ((48, 28) if name == 'eraser' else (48, 48)) and icon.mode == 'RGBA'
for id in ('m01', 'm02', 'h01', 'h02', 'h03', 'h04'):
    assert Image.open(assets / f'map-{id}.webp').size == (535, 302)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.on('requestfailed', lambda req: failures.append(req.url))
    page.clock.install()
    page.goto(url)
    assert from_asset(page.locator('.enrollment-cover').evaluate('e => getComputedStyle(e).backgroundImage'), 'cover')
    page.screenshot(path=str(root / 'work' / 'play-art-cover.png'))
    page.get_by_role('radio', name='남학생').check()
    page.get_by_role('textbox', name='닉네임').fill('하루')
    page.get_by_role('button', name='입학하기').click()

    for cycle, map, contest, motion in [(0, 0, 'boxing', 'strike'), (0, 6, 'wrestling', 'push'), (0, 7, 'jiujitsu', 'push'),
                                      (1, 0, 'ssireum', 'push'), (2, 0, 'taekwondo', 'spar'), (3, 9, 'mma', 'strike')]:
        page.evaluate('''([cycle, map]) => {
          state.cycle = cycle;
          state.equipped.top = 'mintHood';
          if (!state.bag.includes('mintHood')) state.bag.push('mintHood');
          openFight(state, map, 0, 500);
          setPoses('player', [['strike', 30000]]);
          setPoses('rival', [['hit', 30000]]);
          commit();
        }''', [cycle, map])
        expect(page.locator('#arena')).to_have_attribute('data-contest', contest)
        expect(page.locator('#arena')).to_have_attribute('data-motion', motion)
        path = page.locator('#player-sprite').evaluate("e => getComputedStyle(e).getPropertyValue('--pose-image')")
        assert from_asset(path, 'motion-boy-strike' if motion == 'strike' else f'motion-boy-{motion}-strike')
        if motion == 'spar':
            assert 'wardrobe-rendered' not in (page.locator('#player-sprite').get_attribute('class') or '')
            color = page.locator('#rival-sprite').get_attribute('data-spar')
            path = page.locator('#rival-sprite').evaluate("e => getComputedStyle(e).getPropertyValue('--pose-image')")
            assert from_asset(path, f'motion-{color}-hit'), color
        else:
            expect(page.locator('#player-sprite canvas')).to_have_attribute('data-frame', re.compile(f':{motion}$'))

        page.evaluate("flashHit('rival', { amount: 4, move: 'attack' })")
        effect = page.evaluate('contest(state).fx')
        if effect in ('dust', 'cloud'):
            value = page.locator(f'.impact.fx-{effect}').last.evaluate("e => getComputedStyle(e, '::before').backgroundImage")
            assert from_asset(value, f'fx-{effect}')
            assert page.locator(f'.impact.fx-{effect}').last.evaluate("e => getComputedStyle(e, '::before').animationTimingFunction") == 'steps(6)'
        assert page.locator('.prop').count() == 0
        if contest in ('boxing', 'wrestling', 'taekwondo'):
            page.clock.run_for(130)
            page.screenshot(path=str(root / 'work' / f'play-art-{contest}.png'))
        page.clock.run_for(750)

    page.evaluate('''() => {
      state.profile.gender = 'girl';
      state.cycle = 0;
      openFight(state, 0, 0, 500);
      setPoses('player', [['victory', 30000]]);
      commit();
    }''')
    assert from_asset(page.locator('#player-sprite').evaluate("e => getComputedStyle(e).getPropertyValue('--pose-image')"), 'motion-girl-victory')
    assert not failures, failures
    browser.close()

print('Cover, pose families, fighting-contest mapping (strike/grapple), protective rivals, six-frame effects and art assets verified.')
