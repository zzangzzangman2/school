import re
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


workspace = Path(__file__).resolve().parent.parent
url = (workspace / 'outputs' / 'recess-king.html').as_uri()


def run_until(page, condition, max_ms=15000):
    for _ in range(max_ms // 70):
        if page.evaluate(condition):
            return
        page.clock.run_for(70)
    raise AssertionError(f'Waiting for {condition}')


with sync_playwright() as playwright:
    chrome = playwright.chromium.launch(
        executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True,
    )
    phone = chrome.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errors = []
    phone.on('pageerror', lambda error: errors.append(str(error)))
    phone.clock.install()
    phone.goto(url)
    # 실제 시간이 흐르지 않게 멈추고, 게임 시간은 run_for로만 넘긴다(스크린숏·대기 중에 무리가 지나가지 않게)
    phone.clock.pause_at(datetime.now() + timedelta(seconds=1))
    phone.get_by_role('radio', name='여학생').check()
    phone.get_by_role('textbox', name='닉네임').fill('별하늘')
    phone.get_by_role('button', name='입학하기').click()
    expect(phone.get_by_role('heading', name='신발장 입구')).to_be_visible()
    # 1~3번째 대결은 무리: 친구 다섯이 먼저, 무리 대장(민준)이 마지막. 뒤에 선 상대가 화면에 보인다.
    expect(phone.locator('#rival-name')).to_have_text('하준')
    expect(phone.locator('#pack .pack-mob')).to_have_count(5)
    expect(phone.locator('#kill-text')).to_have_text('처치 0/18')
    run_until(phone, "document.querySelector('#player-sprite').dataset.pose === 'strike'")
    expect(phone.locator('#rival-sprite')).to_have_attribute('data-pose', 'hit')
    assert phone.locator('#player-sprite').evaluate("e => getComputedStyle(e).getPropertyValue('--pose-image').includes('data:image/webp')")
    assert phone.locator('#rival-sprite').evaluate("e => getComputedStyle(e).getPropertyValue('--pose-image').includes('data:image/webp')")
    run_until(phone, "state.front.leader || state.roundEnd")
    expect(phone.locator('#rival-name')).to_have_text('민준')
    expect(phone.locator('#enemy-text')).to_have_text(re.compile(r'/ 12$'))
    expect(phone.locator('#pack .pack-mob')).to_have_count(0)
    phone.screenshot(path=str(workspace / 'work' / 'combat-impact.png'))
    run_until(phone, "state.roundEnd && state.roundEnd.result === 'win'")
    phone.clock.run_for(300)
    expect(phone.locator('#rival-name')).to_have_text('민준')
    expect(phone.locator('#rival-sprite')).to_have_attribute('data-pose', 'down')
    expect(phone.locator('#enemy-text')).to_have_text('0 / 12')
    expect(phone.locator('#log')).to_contain_text('민준 무리에게 승리')
    phone.screenshot(path=str(workspace / 'work' / 'combat-win.png'))
    run_until(phone, "document.querySelector('#rival-name').textContent === '소민'")
    expect(phone.locator('#enemy-text')).to_have_text(re.compile(r'/ 15$'))

    run_until(phone, "!document.querySelector('#first-loot').hidden")
    expect(phone.get_by_text('첫 장비 획득')).to_be_visible()
    power = int(phone.locator('#power').inner_text().replace(',', ''))
    phone.screenshot(path=str(workspace / 'work' / 'combat-first-gear.png'))
    phone.get_by_role('button', name='바로 장착').click()
    expect(phone.locator('#first-loot')).to_be_hidden()
    assert int(phone.locator('#power').inner_text().replace(',', '')) >= power + 20
    phone.get_by_role('button', name='가방', exact=True).click()
    expect(phone.get_by_role('button', name='별무늬 손목띠 착용 중')).to_be_visible()
    phone.get_by_role('button', name='대결', exact=True).click()
    run_until(phone, "document.querySelector('#arena').dataset.map === '2'")
    run_until(phone, "document.querySelector('#arena').dataset.map === '3'", 28000)
    phone.get_by_role('button', name='성장', exact=True).click()
    phone.get_by_role('tab', name='스킬').click()
    phone.get_by_role('button', name='스킬 변경').click()
    expect(phone.get_by_role('dialog', name='전투 스킬')).to_be_visible()
    phone.get_by_role('button', name='종소리 반격 장착').click()
    expect(phone.locator('#skill-name')).to_have_text('종소리 반격')
    phone.get_by_role('button', name='설정', exact=True).click()
    phone.get_by_role('button', name='전투 효과음').click()
    expect(phone.get_by_role('button', name='전투 효과음')).to_have_attribute('aria-pressed', 'false')
    phone.reload()
    expect(phone.locator('#skill-name')).to_have_text('종소리 반격')
    assert phone.evaluate("JSON.parse(localStorage.getItem('haesol-recess-king-v1')).state.equipped.accessory === 'wristband'")
    seed = phone.evaluate("localStorage.getItem('haesol-recess-king-v1')")

    duel = chrome.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    duel.on('pageerror', lambda error: errors.append(str(error)))
    duel.clock.install()
    duel.goto(url)
    duel.add_init_script('''(() => {
      const saved = sessionStorage.getItem('combat-qa');
      if (saved) localStorage.setItem('haesol-recess-king-v1', saved);
    })()''')
    for skill in ['bell', 'rush']:
        duel.evaluate('''([seed, skill]) => {
          const snapshot = JSON.parse(seed);
          const s = snapshot.state;
          snapshot.when = Date.now();
          Object.assign(s, { map: 2, wave: 3, nextAttack: .55, nextEnemy: .85, phase: 'ready',
            pause: 0, skillId: skill, autoSkill: true, charge: 90, playerMove: null, enemyMove: null,
            roundEnd: null, bossPhase: 'ready', bossTimer: 1.4, enemyHp: 245 });
          s.cleared[0] = s.cleared[1] = true;
          sessionStorage.setItem('combat-qa', JSON.stringify(snapshot));
        }''', [seed, skill])
        duel.reload()
        run_until(duel, "document.querySelector('#pattern').dataset.phase === 'guard' && document.querySelector('#rival-sprite').dataset.pose === 'guard'")
        expect(duel.locator('#pattern-title')).to_have_text('방어 자세')
        if skill == 'bell':
            duel.screenshot(path=str(workspace / 'work' / 'combat-boss.png'))
            run_until(duel, "document.querySelector('#pattern').dataset.phase === 'broken'")
            expect(duel.locator('#pattern-title')).to_have_text('방어 파괴')
            expect(duel.locator('#log')).to_contain_text('다온의 방어를 깼어요')
        else:
            run_until(duel, "document.querySelector('#pattern').dataset.phase === 'counter'")
            expect(duel.locator('#pattern-title')).to_have_text('반격 예고')
            run_until(duel, "document.querySelector('#pattern').dataset.phase === 'open'")
            expect(duel.locator('#pattern-title')).to_have_text('반격 뒤 빈틈')
            run_until(duel, "state.bossPhase === 'open' && state.enemyHp < 155")

    assert not errors, errors
    chrome.close()

print('Attack and hit sprites, knockout sequence, first quick equip, playable 1-1 through 1-3, both Daon strategies, and reload verified.')
