from datetime import datetime, timedelta
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
    page.clock.pause_at(datetime.now() + timedelta(seconds=1))
    page.get_by_role('radio', name='남학생').check()
    page.get_by_role('textbox', name='닉네임').fill('메타')
    page.get_by_role('button', name='입학하기').click()
    page.clock.run_for(500)

    # 우편: 입학 선물(보석 300, 모집권 5)
    expect(page.locator('#mail-dot')).to_have_text('1')
    page.get_by_role('button', name='우편함', exact=True).click()
    page.get_by_role('button', name='모두 받기').click()
    assert page.evaluate('state.gems') == 300 and page.evaluate('state.recruits') == 5
    page.locator('#mail-dialog').evaluate('dialog => dialog.close()')

    # 동료 모집 → 자동 출전 → 전투 화면에 동료가 보인다
    page.get_by_role('button', name='뽑기', exact=True).click()
    page.get_by_role('tab', name='동료 모집').click()
    page.get_by_role('button', name='동료 1회 모집, 모집권 1').click()
    page.locator('#gacha-dialog').evaluate('dialog => dialog.close()')
    assert page.evaluate('state.party[0]') is not None
    page.clock.run_for(300)
    expect(page.locator('#allies .ally')).to_have_count(1)
    page.get_by_role('button', name='동료', exact=True).click()
    expect(page.locator('#party-slots .party-slot.filled')).to_have_count(1)

    # 퀘스트: 힘 훈련 Lv.3 → 받기 → 보석
    expect(page.locator('#objective-title')).to_contain_text('힘 훈련 Lv.3')
    page.evaluate('state.coins = 5000; state.training.power = 3; commit()')
    page.clock.run_for(100)
    gems = page.evaluate('state.gems')
    page.get_by_role('button', name='퀘스트 보상 받기').click()
    assert page.evaluate('state.gems') == gems + 20 and page.evaluate('state.quest') == 1

    # 상점: 매일 무료 선물은 하루 한 번
    page.get_by_role('button', name='상점', exact=True).click()
    tickets = page.evaluate('state.tickets')
    page.get_by_role('button', name='매일 무료 선물 무료').click()
    assert page.evaluate('state.tickets') == tickets + 1
    expect(page.get_by_role('button', name='매일 무료 선물 무료')).to_be_disabled()
    expect(page.locator('#cash-list button').first).to_be_disabled()

    # 승급 시험: 조건을 채우면 시험 → 통과하면 칭호·스킬 칸
    page.evaluate('''() => {
      state.level = 12; state.cleared.fill(true, 0, 9); state.map = 9; state.wave = 0; state.farm = null;
      state.training.power = 80; state.training.health = 60; openFight(state, 9, 0, 0.2); commit();
    }''')
    page.get_by_role('button', name='성장', exact=True).click()
    page.get_by_role('tab', name='승급').click()
    page.get_by_role('button', name='모범생 승급 시험 도전').click()
    expect(page.locator('#battle-title')).to_have_text('승급 시험')
    for _ in range(40):
        if page.evaluate('state.tier') >= 1:
            break
        page.clock.run_for(500)
    assert page.evaluate('state.tier') == 1
    expect(page.locator('#hud-tier')).to_have_text('모범생')
    expect(page.locator('#actives .active-skill.pencil')).not_to_have_class('active-skill pencil locked')

    # 성장 패스 + 프리미엄(결제 연결 전 grantPurchase로 지급 확인)
    page.get_by_role('button', name='목표', exact=True).click()
    before = page.evaluate('state.gems')
    page.get_by_role('button', name='모두 받기').click()
    assert page.evaluate('state.gems') > before
    page.evaluate("grantPurchase(state, 'pass'); claimMail(state); commit()")
    assert page.evaluate('state.premium.pass') is True
    assert page.evaluate("grantPurchase(state, 'pass')") is None

    # 오프라인 보상 2배(보석 50)
    page.evaluate('state.gems = 100; save()')
    page.add_init_script('''(() => {
      const key = 'haesol-recess-king-v1';
      const save = JSON.parse(localStorage.getItem(key) || 'null');
      if (save && !sessionStorage.getItem('offline-done')) {
        save.when = Date.now() - 600000;
        localStorage.setItem(key, JSON.stringify(save));
        sessionStorage.setItem('offline-done', '1');
      }
    })()''')
    page.reload()
    expect(page.get_by_role('heading', name='쉬는 시간 보상')).to_be_visible()
    coins, gems = page.evaluate('[state.coins, state.gems]')
    page.locator('#offline-double').click()
    assert page.evaluate('state.gems') == gems - 50 and page.evaluate('state.coins') > coins
    assert not issues, issues
    chrome.close()

print('Mail, recruit/party/allies, quest reward, daily shop, promotion trial, pass + premium grant, and offline double verified.')
