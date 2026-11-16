from pathlib import Path
import json
import re
from zipfile import ZipFile

from playwright.sync_api import expect, sync_playwright


root = Path(__file__).resolve().parent.parent
entry = (root / 'outputs' / 'recess-king.html').as_uri()


def until(page, predicate, seconds=18):
    for _ in range(seconds * 10):
        if page.evaluate(predicate):
            return
        page.clock.run_for(100)
    raise AssertionError(predicate)


with sync_playwright() as playwright:
    chrome = playwright.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    page = chrome.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install()
    page.goto(entry)
    page.get_by_role('radio', name='남학생').check()
    page.get_by_role('textbox', name='닉네임').fill('새봄')
    page.get_by_role('button', name='입학하기').click()
    until(page, "state.roundEnd?.result === 'win' && document.querySelector('#player-sprite').dataset.pose === 'victory'")
    expect(page.locator('#rival-name')).to_have_text('민준')
    page.screenshot(path=str(root / 'work' / 'wardrobe-victory-clear.png'))
    until(page, "state.bag.includes('mintHood')")
    assert page.evaluate('state.mapWins[0] === 4')
    page.get_by_role('button', name='가방', exact=True).click()
    page.get_by_role('button', name='민트 후드 장착').click()
    expect(page.locator('#closet-sprite canvas')).to_be_visible()
    expect(page.locator('#closet-sprite')).to_have_attribute('data-outfit', 'mint basic basic basic')

    page.add_init_script('''(() => {
      const snapshot = sessionStorage.getItem('wardrobe-test');
      if (snapshot) localStorage.setItem('haesol-recess-king-v1', snapshot);
    })()''')
    page.evaluate('''() => {
      const snapshot = { version: 4, when: Date.now(), state: JSON.parse(JSON.stringify(state)) };
      Object.assign(snapshot.state, { wins: 24, patches: 3, pause: 600, roundEnd: null,
        bag: Array.from(new Set([...state.bag, 'hallPants', 'classBag', 'stairShoes'])) });
      sessionStorage.setItem('wardrobe-test', JSON.stringify(snapshot));
    }''')
    page.reload()
    page.get_by_role('button', name='가방', exact=True).click()
    for label in ['복도 트레이닝 바지', '새싹 책가방', '귤빛 운동화']:
        page.get_by_role('button', name=f'{label} 장착').click()
        expect(page.get_by_role('button', name=f'{label} 착용 중')).to_be_visible()
    expect(page.locator('#closet-sprite')).to_have_attribute('data-outfit', 'mint indigo mint orange')
    expect(page.locator('#closet-sprite canvas')).to_have_attribute('data-frame', 'boy:ready:mint:indigo:mint:orange')
    page.get_by_role('button', name='민트 후드 강화, 천 조각 1개').click()
    expect(page.locator('#outfit')).to_contain_text('민트 후드 +1')
    page.evaluate('window.scrollTo(0, 0)')
    page.screenshot(path=str(root / 'work' / 'wardrobe-gear-final.png'))
    page.get_by_role('button', name='목표', exact=True).click()
    page.get_by_role('button', name='쉬는 시간 단골 보상 받기').click()
    expect(page.locator('#activity-patches')).to_have_text('천 조각 3개')

    snapshot = page.evaluate('''() => {
      const snapshot = { version: 4, when: Date.now(), state: JSON.parse(JSON.stringify(state)) };
      Object.assign(snapshot.state, { map: 2, wave: 3, pause: 0, hp: 1, enemyHp: 245, skillId: 'rush',
        nextAttack: 9, nextEnemy: 0.1, roundEnd: null, enemyMove: null, playerMove: null,
        bossPhase: 'ready', bossTimer: 1.4, farm: null });
      snapshot.state.cleared[0] = snapshot.state.cleared[1] = true;
      snapshot.state.mapWins[2] = 3;
      sessionStorage.setItem('wardrobe-test', JSON.stringify(snapshot));
      return JSON.stringify(snapshot);
    }''')
    page.reload()
    until(page, 'state.farm !== null && state.wave === 0')
    expect(page.locator('#farm-title')).to_have_text('1-3 반복 수련')
    initial = page.evaluate('state.coins')
    page.screenshot(path=str(root / 'work' / 'wardrobe-farm.png'))
    until(page, 'state.farm === null && state.mapWins[2] === 6 && state.wave === 0', 27)
    assert page.evaluate('state.coins') > initial
    assert page.evaluate('state.map') == 2
    assert page.evaluate('state.patches') == 4
    expect(page.locator('#farm')).to_be_hidden()
    assert not errors, errors

    # Verify the source archive entry works as a local file, including its canvas layers.
    folder = root / 'work' / 'wardrobe-zip-qa'
    folder.mkdir(exist_ok=True)
    with ZipFile(root / 'outputs' / 'recess-king-source.zip') as archive:
        archive.extractall(folder)
    source_page = chrome.new_page(viewport={'width': 320, 'height': 568}, is_mobile=True, has_touch=True)
    source_page.add_init_script(f"localStorage.setItem('haesol-recess-king-v1', {json.dumps(snapshot)});")
    source_page.goto((folder / 'recess-king' / 'index.html').as_uri())
    expect(source_page.locator('#player-sprite canvas')).to_be_visible()
    assert source_page.evaluate('document.documentElement.scrollWidth === innerWidth')
    source_page.get_by_role('button', name='캐릭터 설정').click()
    source_page.get_by_role('radio', name='여학생').check()
    source_page.get_by_role('button', name='저장하고 돌아가기').click()
    expect(source_page.locator('#player-sprite canvas')).to_have_attribute('data-frame', re.compile('^girl:'))
    expect(source_page.locator('#player-sprite')).to_have_attribute('data-outfit', 'mint indigo mint orange')
    chrome.close()

print('Uncropped victory, all four equipped layers, upgrades, missions, same-map farming/retry, and offline source archive verified.')
