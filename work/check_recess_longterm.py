from pathlib import Path

from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parent.parent
target = (root / 'outputs' / 'recess-king.html').as_uri()

with sync_playwright() as playwright:
    chrome = playwright.chromium.launch(
        executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True
    )
    issues = []
    page = chrome.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    page.on('pageerror', lambda issue: issues.append(str(issue)))
    page.clock.install()
    page.goto(target)
    page.get_by_role('radio', name='남학생').check()
    page.get_by_role('textbox', name='닉네임').fill('장기')
    page.get_by_role('button', name='입학하기').click()
    page.clock.run_for(3000)

    # 6-3 보스 직전 상태로 만들고 이기면 2년차로 넘어가는지
    page.evaluate('''() => {
      const save = JSON.parse(localStorage.getItem('haesol-recess-king-v1'));
      save.when = Date.now();
      Object.assign(save.state, { map: 17, wave: 3, enemyHp: 1, pause: 0, nextAttack: 0.05, nextEnemy: 3, roundEnd: null, playerMove: null, enemyMove: null });
      save.state.training.health = 300;
      save.state.training.power = 400;
      save.state.cleared.fill(true, 0, 17);
      sessionStorage.setItem('qa-snapshot', JSON.stringify(save));
    }''')
    page.add_init_script('''(() => {
      const snapshot = sessionStorage.getItem('qa-snapshot');
      if (snapshot) { localStorage.setItem('haesol-recess-king-v1', snapshot); sessionStorage.removeItem('qa-snapshot'); }
    })()''')
    page.reload()
    page.clock.run_for(4000)
    expect(page.locator('#stage-number')).to_contain_text('2년차')
    assert page.evaluate('state.cycle') == 1 and page.evaluate('state.cleared.every(done => !done) || state.cleared[0]')

    # 던전: 열쇠로 매점 쟁탈전 Lv.1에 들어가 졸개+던전 보스를 이기면 단계·보상·열쇠가 바뀌는지
    coins = page.evaluate('state.coins')
    page.get_by_role('button', name='대결', exact=True).click()
    page.get_by_role('button', name='매점 쟁탈전 Lv.1 도전').click()
    expect(page.locator('#battle-title')).to_have_text('매점 쟁탈전')
    expect(page.locator('#dungeon-timer')).to_be_visible()
    page.clock.run_for(8000)
    assert page.evaluate('state.dungeons.coin') == 1 and page.evaluate('state.daily.keys.coin') == 1
    assert page.evaluate('state.coins') > coins
    page.get_by_role('button', name='매점 쟁탈전 Lv.1 소탕').click()
    assert page.evaluate('state.daily.keys.coin') == 0
    expect(page.get_by_role('button', name='매점 쟁탈전 Lv.2 도전')).to_be_disabled()

    # 전학: 배지를 받고 1년차 Lv.1로 돌아가며, 방과 후 학원을 배울 수 있는지
    page.get_by_role('button', name='지도', exact=True).click()
    expect(page.locator('#prestige-gain')).to_contain_text('명예 배지 +')
    page.get_by_role('button', name='전학', exact=True).click()
    page.get_by_role('button', name='전학 가기').click()
    expect(page.get_by_role('heading', name='새 학교 첫날!')).to_be_visible()
    page.get_by_role('button', name='좋아요').click()
    expect(page.locator('#level')).to_have_text('1')
    expect(page.locator('#stage-number')).to_contain_text('1년차')
    assert int(page.locator('#badge-count').inner_text().replace(',', '')) > 0
    page.locator('#perk-list button').first.click()
    expect(page.locator('#perk-list .item').first).to_contain_text('Lv.1')

    # 큰 수 표기
    assert page.evaluate('fmt(123456)') == '12.3만'
    assert page.evaluate('fmt(1.5e12)') == '1.5조'
    assert not issues, issues
    chrome.close()

print('New school year after 6-3, coin dungeon clear/sweep/keys, transfer (prestige) with badges, perk purchase, and Korean big-number format verified.')
