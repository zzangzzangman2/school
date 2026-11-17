from pathlib import Path

from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parent.parent
target = (root / 'outputs' / 'recess-king.html').as_uri()


def choose(page, gender, name):
    page.get_by_role('radio', name=gender).check()
    page.get_by_role('textbox', name='닉네임').fill(name)
    page.get_by_role('button', name='입학하기').click()


with sync_playwright() as playwright:
    chrome = playwright.chromium.launch(
        executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True
    )
    issues = []
    phone = chrome.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    phone.on('pageerror', lambda issue: issues.append(str(issue)))
    phone.on('requestfailed', lambda req: issues.append(req.url))
    phone.clock.install()
    phone.goto(target)
    expect(phone.get_by_role('heading', name='해솔 격투 아카데미 입학')).to_be_visible()
    assert phone.evaluate('document.documentElement.scrollWidth === innerWidth')
    assert phone.locator('.enrollment').bounding_box()['width'] == 390
    assert phone.locator('.enrollment-cover').evaluate("e => getComputedStyle(e).backgroundImage.includes('data:image/webp')")
    assert phone.locator('.character-preview').first.evaluate("e => getComputedStyle(e).backgroundImage.includes('data:image/webp')")
    phone.clock.run_for(25000)
    assert phone.evaluate("localStorage.getItem('haesol-recess-king-v1') === null")
    choose(phone, '남학생', '   ')
    expect(phone.get_by_role('alert')).to_have_text('닉네임을 1~12자로 입력해 주세요.')
    phone.get_by_role('textbox', name='닉네임').fill('별하늘')
    phone.screenshot(path=str(root / 'work' / 'recess-v2-enrollment.png'))
    phone.get_by_role('button', name='입학하기').click()
    expect(phone.get_by_role('heading', name='아카데미 정문')).to_be_visible()
    expect(phone.locator('#player-name')).to_have_text('별하늘')
    expect(phone.locator('#player-sprite')).to_have_attribute('data-sprite', 'boy')
    expect(phone.locator('#level')).to_have_text('1')
    expect(phone.locator('#coins')).to_have_text('12')
    assert phone.locator('.bottom-nav').bounding_box()['y'] < 844
    first_art = phone.locator('.arena-art').evaluate('e => getComputedStyle(e).backgroundImage')
    assert 'data:image/webp' in first_art
    phone.screenshot(path=str(root / 'work' / 'recess-v2-battle.png'))

    phone.get_by_role('button', name='성장', exact=True).click()
    expect(phone.get_by_role('button', name='힘 훈련, 코인 22개')).to_be_disabled()
    phone.clock.run_for(7500)
    phone.get_by_role('button', name='힘 훈련, 코인 22개').click()
    expect(phone.locator('#training-list .item').first).to_contain_text('힘 훈련Lv.1')
    phone.get_by_role('button', name='가방', exact=True).click()
    phone.get_by_role('button', name='별무늬 손목띠 장착').click()
    expect(phone.get_by_role('button', name='별무늬 손목띠 착용 중')).to_be_disabled()
    phone.get_by_role('button', name='대결', exact=True).click()
    phone.clock.run_for(9500)
    expect(phone.get_by_role('heading', name='기숙사 복도')).to_be_visible()
    assert phone.locator('.arena-art').evaluate('e => getComputedStyle(e).backgroundImage') != first_art
    phone.get_by_role('button', name='대결 지도', exact=True).click()
    expect(phone.get_by_text('1 / 12 완료')).to_be_visible()
    assert phone.locator('.map-thumb').count() == 12
    assert phone.locator('.map-thumb').evaluate_all("items => new Set(items.map(e => getComputedStyle(e).getPropertyValue('--map-image'))).size") == 12
    phone.locator('summary').last.click()
    expect(phone.get_by_role('button', name='아카데미 결승 링 잠김')).to_be_disabled()
    phone.screenshot(path=str(root / 'work' / 'recess-v2-map.png'))
    phone.get_by_role('button', name='아카데미 정문 재도전').click()
    expect(phone.get_by_role('heading', name='아카데미 정문')).to_be_visible()
    phone.get_by_role('switch', name='자동 진격').click()
    expect(phone.get_by_role('switch', name='자동 진격')).to_have_attribute('aria-checked', 'false')

    phone.get_by_role('button', name='설정', exact=True).click()
    phone.get_by_role('button', name='캐릭터 설정').click()
    expect(phone.get_by_role('radio', name='남학생')).to_be_checked()
    phone.get_by_role('radio', name='남학생').check()
    phone.get_by_role('textbox', name='닉네임').fill('봄달')
    phone.get_by_role('button', name='저장하고 돌아가기').click()
    expect(phone.locator('#player-name')).to_have_text('봄달')
    expect(phone.locator('#player-sprite')).to_have_attribute('data-sprite', 'boy')
    phone.reload()
    expect(phone.locator('#player-name')).to_have_text('봄달')
    expect(phone.locator('#player-sprite')).to_have_attribute('data-sprite', 'boy')
    expect(phone.get_by_role('switch', name='자동 진격')).to_have_attribute('aria-checked', 'false')
    phone.add_init_script('''(() => {
      const key = 'haesol-recess-king-v1';
      const save = JSON.parse(localStorage.getItem(key));
      save.when = Date.now() - 120000;
      localStorage.setItem(key, JSON.stringify(save));
    })()''')
    phone.reload()
    expect(phone.get_by_role('heading', name='쉬는 시간 보상')).to_be_visible()
    phone.get_by_role('button', name='좋아요').click()
    assert not issues, issues

    desktop = chrome.new_page(viewport={'width': 1440, 'height': 900})
    desktop.goto(target)
    choose(desktop, '남학생', '솔')
    box = desktop.locator('.game').bounding_box()
    assert box['width'] == 484 and box['x'] > 400, box
    seed = desktop.evaluate("localStorage.getItem('haesol-recess-king-v1')")

    seeded = chrome.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    seeded.goto(target)
    seeded.add_init_script('''(() => {
      const snapshot = sessionStorage.getItem('qa-snapshot');
      if (snapshot) localStorage.setItem('haesol-recess-king-v1', snapshot);
    })()''')
    for number in range(1, 5):
        seeded.evaluate('''([seed, grade]) => {
          const game = JSON.parse(seed);
          const map = grade * 3 - 1;
          game.when = Date.now();
          Object.assign(game.state, { map, wave: 3, enemyHp: 150, pause: 600 });
          game.state.cleared.fill(true, 0, map);
          sessionStorage.setItem('qa-snapshot', JSON.stringify(game));
        }''', [seed, number])
        seeded.reload()
        expect(seeded.locator('#rival-sprite')).to_have_attribute('data-sprite', ['boss2', 'boss4', 'boss5', 'boss6'][number - 1])
        assert seeded.locator('#rival-sprite').evaluate("e => getComputedStyle(e).backgroundImage.includes('data:image/webp')")
    seeded.evaluate('''seed => {
      const legacy = JSON.parse(seed);
      legacy.version = 1;
      legacy.when = Date.now();
      Object.assign(legacy.state, { profile: null, level: 15, coins: 311, wins: 75, grade: 2, cleared: [true, true, false, false, false, false] });
      sessionStorage.setItem('qa-snapshot', JSON.stringify(legacy));
    }''', seed)
    seeded.reload()
    choose(seeded, '남학생', '복학생')
    expect(seeded.get_by_role('heading', name='레슬링 매트장')).to_be_visible()
    expect(seeded.locator('#level')).to_have_text('15')
    expect(seeded.locator('#coins')).to_have_text('311')

    small = chrome.new_page(viewport={'width': 320, 'height': 568}, is_mobile=True, has_touch=True)
    small.goto(target)
    assert small.evaluate('document.documentElement.scrollWidth === innerWidth')
    choose(small, '남학생', '봄달봄달봄달봄달봄달봄달')
    small.get_by_role('button', name='대결 지도', exact=True).click()
    assert small.evaluate('document.documentElement.scrollWidth === innerWidth')
    expect(small.locator('.grade-group')).to_have_count(4)
    chrome.close()

print('Portrait layouts, both player sprites, 12 distinct academy maps, all four grade bosses, progress, replay, and offline saves passed.')
