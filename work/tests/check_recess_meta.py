import re
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

from tempfile import gettempdir
qa_dir = Path(gettempdir()) / 'haesol-qa'
qa_dir.mkdir(exist_ok=True)


root = Path(__file__).resolve().parents[2]
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

    # 동료 칸: 처음 1칸 → 아카데미 졸업 2칸 → 시골 4곳 제패 3칸 → 8곳 제패 4칸(최고 기록 기준)
    assert page.evaluate('partySlots(state)') == 1
    assert page.evaluate("state.prestige.best = MAPS.length; partySlots(state)") == 2
    assert page.evaluate("state.prestige.best = REGION_START[4] * MAPS.length; partySlots(state)") == 3
    assert page.evaluate("state.prestige.best = REGION_START[8] * MAPS.length; partySlots(state)") == 4
    # 여성 동료 16명, 무술이 모두 다르고, 출전하면 각자 스킬을 알아서 쓴다
    assert page.evaluate("new Set(Object.values(COMPANIONS).map(mate => mate.style)).size") == 16
    casts = page.evaluate('''() => {
      const backup = structuredClone(state);
      for (const id of Object.keys(COMPANIONS)) state.companions[id] = 1;
      state.party = ['mate2', 'mate6', 'mate8', 'mate16'];
      state.cooldowns = {};
      const names = new Set();
      simulate(state, 6, (type, event) => { if (type === 'mate' && event.id) names.add(event.id); });
      Object.assign(state, backup);
      commit();
      return names.size;
    }''')
    assert casts == 4, casts

    # 등급: 16명 모두 S급. 조각으로 별 5개까지 성급업, 없는 동료는 조각으로 영입, 학년·구역 마지막 보스는 조각 2개
    expect(page.locator('#party-slots .grade-badge').first).to_have_text('S')
    grade = page.evaluate('''() => {
      const backup = structuredClone(state);
      const out = { allS: Object.values(COMPANIONS).every(mate => mate.grade === 'S') };
      state.companions = { mate1: 1 };
      state.mateShards = { mate1: 150, mate9: 40 };
      while (starUp(state, 'mate1'));
      out.max = [companionLevel(state, 'mate1'), mateShards(state, 'mate1'), starCost(state, 'mate1')];
      out.unlock = [starUp(state, 'mate9'), companionLevel(state, 'mate9')];
      state.party = ['mate9', null, null, null];
      out.drop = dropShard(state, true, null)?.amount;
      out.rates = GRADE_ORDER.map(id => GRADES[id].weight).reduce((sum, weight) => sum + weight, 0);
      Object.assign(state, backup);
      commit();
      return out;
    }''')
    assert grade == {'allS': True, 'max': [5, 0, 0], 'unlock': [True, 1], 'drop': 2, 'rates': 100}, grade

    # 출전 번호 = 자리: 1번을 비우면 2번 동료는 2번 자리(전열 왼쪽)에 그대로 선다. 공격하면 상대 앞으로 달려갔다 돌아온다
    page.evaluate("state.test = { slots: true }; for (const id of Object.keys(COMPANIONS)) state.companions[id] = state.companions[id] || 1; state.party = [null, 'mate1', null, 'mate8']; commit()")
    page.clock.run_for(100)
    assert page.evaluate("[...document.querySelectorAll('#allies .ally')].map(a => [a.dataset.slot, a.style.getPropertyValue('--slot-depth')])") == [['1', '-0.75'], ['3', '1.5']]
    expect(page.locator('#party-slots .party-slot').nth(1).locator('.slot-tag')).to_have_text('2번 · 전열')
    page.evaluate("state.allyTimers = [99, 99, 99, 99]; for (let i = 0; i < 4; i++) state.cooldowns['mate' + i] = 99; onAlly({ slot: 1, amount: 5 })")
    page.clock.run_for(200)
    dash = page.evaluate("(() => { const a = document.querySelector('#allies .ally[data-slot=\"1\"]'); return [a.style.translate, a.classList.contains('running')]; })()")
    assert dash[0] not in ('', '0px', '0px 0px') and dash[1], dash
    page.clock.run_for(1200)
    back = page.evaluate("(() => { const a = document.querySelector('#allies .ally[data-slot=\"1\"]'); return [a.style.translate, a.classList.contains('running'), a.firstElementChild.dataset.pose]; })()")
    assert back[0] in ('0px', '0px 0px') and not back[1] and back[2] == 'ready', back

    # 대결 화면 출전 카드 4칸: 전열·후열 표시, 남은 스킬 시간, 편성 모드로 자리 바꾸기(쿨타임도 함께), 정보 창, 자동 끄고 직접 발동
    page.evaluate('window.partyBackup = structuredClone(state)')
    page.clock.run_for(100)
    expect(page.locator('#party-bar .party-card')).to_have_count(4)
    assert page.evaluate("[...document.querySelectorAll('#party-bar .pc-tag')].map(e => e.textContent)") == ['1전', '2전', '3후', '4후']
    expect(page.locator('#party-bar .party-card').nth(0)).to_have_class(re.compile('empty'))
    page.evaluate("state.cooldowns = { mate3: 6 }; state.allyTimers = [1.1, 1.5, 1.9, 2.3]; commit()")
    page.clock.run_for(100)
    expect(page.locator('#party-bar .party-card').nth(3).locator('.pc-cd')).to_have_text(re.compile(r'^[56]$'))
    page.get_by_role('button', name='출전 자리 편성').click()
    page.locator('#party-bar .party-card').nth(3).click()
    page.locator('#party-bar .party-card').nth(0).click()
    swapped = page.evaluate("[state.party[0], state.party[3], state.cooldowns.mate0, state.cooldowns.mate3 || 0]")
    assert swapped[:2] == ["mate8", None] and swapped[2] > 4 and swapped[3] == 0, swapped
    page.get_by_role('button', name='출전 자리 편성').click()
    page.locator('#party-bar .party-card').nth(1).click()
    expect(page.locator('#mate-dialog')).to_be_visible()
    expect(page.locator('#mate-dialog-name')).to_have_text('정하린')
    expect(page.locator('#mate-dialog-meta')).to_contain_text('2번 · 전열')
    page.locator('#mate-dialog').get_by_role('button', name='닫기').click()
    page.get_by_role('switch', name='동료 스킬 자동 사용').click()
    assert page.evaluate('state.autoMates') is False
    page.evaluate("state.cooldowns.mate1 = 0; state.hp = maxHp(state); commit()")
    page.clock.run_for(1500)
    assert page.evaluate('state.cooldowns.mate1 || 0') == 0
    cast = page.evaluate("(() => { for (let i = 0; i < 80 && (state.roundEnd || state.pause > 0 || state.enemyHp <= 0); i++) simulate(state, 0.05, combatEvent); document.querySelector('#party-bar .party-card[data-slot=\"1\"]').click(); return state.cooldowns.mate1; })()")
    assert cast > 10, cast
    page.get_by_role('switch', name='동료 스킬 자동 사용').click()
    assert page.evaluate('state.autoMates') is True
    # 위 대결 진행으로 2승째 '첫 장비 획득' 안내가 퀘스트 줄을 가리지 않게 승수를 넘겨 둔다
    page.evaluate('Object.assign(state, window.partyBackup); state.wins = Math.max(state.wins, 3); commit()')
    # 전진 연출: 무리를 이기면 앞으로(forward), 보스를 이기면 출구로 다음 장소(exit), 승리 포즈 동안 출발 장소 유지, 패배 뒤엔 짧은 전환(cut)
    # (아카데미 1-1·1-2는 Codex의 이어진 배경 구간이라, 여기서는 지역 맵 1-1 → 2-1로 확인)
    travel = page.evaluate('''() => {
      const backup = structuredClone(state);
      const arena = document.getElementById('arena');
      const look = () => [arena.dataset.travel, arena.dataset.map === travelTarget().art, arena.style.getPropertyValue('--pan')];
      const out = {};
      state.dungeon = null; state.roundEnd = null; state.farm = null; state.cycle = REGION_START[0]; state.map = 0; state.wave = 0;
      travel = null; renderTravel();
      const first = arena.dataset.map;
      lastFinish = { result: 'win', boss: false }; state.wave = 1; renderTravel(); out.forward = look();
      state.roundEnd = { result: 'win', nextMap: 3, nextWave: 0, wait: 1, nextFarm: null }; state.map = 3; state.wave = 0; renderTravel(); out.frozen = [arena.dataset.map === first, arena.style.getPropertyValue('--pan')];
      lastFinish = { result: 'win', boss: true }; state.roundEnd = null; renderTravel(); out.exit = look(); out.ghost = document.querySelectorAll('.arena-art.leaving').length; out.moved = arena.dataset.map !== first;
      state.wave = 2; lastFinish = { result: 'win', boss: false }; renderTravel(); lastFinish = { result: 'loss', boss: false }; state.wave = 0; renderTravel(); out.cut = look();
      Object.assign(state, backup); travel = null; commit();
      return out;
    }''')
    assert travel == {'forward': ['forward', True, '36%'], 'frozen': [True, '36%'], 'exit': ['exit', True, '8%'], 'ghost': 1, 'moved': True, 'cut': ['cut', True, '8%']}, travel
    # 팀 시너지: 같은 계열 2·3·4명이면 계열 효과, 서로 다른 계열 3개 이상이면 균형(크리티컬). 피해·받는 피해·코인·쿨타임에 실제로 붙는다
    synergy = page.evaluate('''() => {
      const backup = structuredClone(state);
      state.test = { slots: true };
      for (const id of Object.keys(COMPANIONS)) state.companions[id] = state.companions[id] || 1;
      const look = party => { state.party = party; const s = teamSynergy(state); return [s.power, s.weaken, s.cdr, s.coin, s.crit]; };
      const out = {};
      out.strike3 = look(['mate1', 'mate2', 'mate3', null]);
      out.special2 = look(['mate10', 'mate11', null, null]);
      out.cd = +mateCooldown(state, 'mate10').toFixed(2);
      out.mixed = look(['mate1', 'mate6', 'mate10', 'mate15']);
      out.farm2 = look(['mate15', 'mate16', 'mate6', null]);
      state.cycle = 0; state.dungeon = null; // 경기 규칙(추천 동료 보너스)이 없는 곳에서 비교
      state.party = [null, null, null, null]; const base = [buffMult(state), enemyHit(state), winCoins(state, false)];
      state.party = ['mate1', 'mate2', 'mate6', 'mate7']; const both = [buffMult(state), enemyHit(state)];
      state.party = ['mate15', 'mate16', null, null]; const coin = winCoins(state, false);
      out.applied = [Math.round(both[0] / base[0] * 100), Math.round(both[1] / base[1] * 100), coin > base[2]];
      Object.assign(state, backup); state.test = { slots: true };
      state.party = ['mate1', 'mate2', 'mate6', 'mate10']; commit(); renderParty();
      out.line = document.getElementById('party-synergy').textContent;
      out.on = document.querySelectorAll('#party-bar .party-card.fam-on').length;
      out.cards = [...document.querySelectorAll('#synergy-panel .syn-card')].map(card => card.querySelector('b').textContent);
      out.tag = document.querySelector('#mate-grid .syn-tag')?.textContent;
      Object.assign(state, backup); commit();
      return out;
    }''')
    assert synergy['strike3'] == [0.12, 0, 0, 0, 0], synergy
    assert synergy['special2'] == [0, 0, 0.08, 0, 0] and synergy['cd'] == 12.88, synergy
    assert synergy['mixed'] == [0, 0, 0, 0, 0.07], synergy
    assert synergy['farm2'] == [0, 0, 0, 0.2, 0], synergy
    assert synergy['applied'] == [106, 94, True], synergy
    assert '타격 2명 · 팀 피해 +6%' in synergy['line'] and '균형 3계열 · 크리티컬 +4%' in synergy['line'], synergy
    assert synergy['on'] == 2 and synergy['cards'] == ['타격 2명', '잡기 1명', '기공 1명', '파밍 0명', '균형 3계열'] and synergy['tag'] == '타격', synergy
    page.evaluate("delete state.test; state.party = ['mate1', null, null, null]; state.allyTimers = [1.1, 1.5, 1.9, 2.3]; state.cooldowns = {}; commit()")

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

    # 승급 심사: 조건을 채우면 심사 → 통과하면 선수 등급·스킬 칸
    page.evaluate('''() => {
      state.level = 12; state.cleared.fill(true, 0, 9); state.map = 9; state.wave = 0; state.farm = null;
      state.training.power = 80; state.training.health = 60; openFight(state, 9, 0, 0.2); commit();
    }''')
    page.get_by_role('button', name='성장', exact=True).click()
    page.get_by_role('tab', name='승급').click()
    page.get_by_role('button', name='아마추어 승급 심사 도전').click()
    expect(page.locator('#battle-title')).to_have_text('승급 심사')
    for _ in range(40):
        if page.evaluate('state.tier') >= 1:
            break
        page.clock.run_for(500)
    assert page.evaluate('state.tier') == 1
    expect(page.locator('#hud-tier')).to_have_text('아마추어')
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
    assert page.evaluate('[offlineLimit(state) / 3600, offlineDoubleCost(9 * 3600)]') == [12, 150]

    # 빠른 휴식(대결 탭 맨 위): 2시간 동안의 대결을 바로 받기. 하루 4번, 첫 번 무료 → 보석 50·100·150
    page.locator('#dialog').get_by_role('button', name='좋아요').click()
    page.evaluate("document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); state.dungeon = null; state.roundEnd = null; selectView('battle'); commit()")
    rest = page.locator('#rest-card')
    expect(rest.locator('.lv')).to_have_text('오늘 0/4번')
    expect(rest).to_have_class(re.compile('free'))
    wins, gems = page.evaluate('[state.wins, state.gems]')
    rest.locator('.rest-go').click()
    expect(page.get_by_role('heading', name='빠른 휴식 보상')).to_be_visible()
    expect(page.locator('#dialog-content')).to_contain_text('2시간 동안')
    expect(page.locator('#offline-double')).to_be_hidden()
    rested = page.evaluate('[state.wins, state.daily.rest]')
    assert rested[0] - wins > 300 and rested[1] == 1, (wins, rested)
    page.locator('#dialog').get_by_role('button', name='좋아요').click()
    page.evaluate('state.gems = 60; commit()')
    expect(rest.locator('.rest-go')).to_have_text('보석 50으로 쉬기')
    rest.locator('.rest-go').click()
    expect(page.locator('#dialog-content')).to_contain_text('보석 50개를 썼어요.')
    assert page.evaluate('state.daily.rest') == 2
    page.locator('#dialog').get_by_role('button', name='좋아요').click()
    page.evaluate('state.gems = Math.min(state.gems, 99); commit()')
    expect(rest.locator('.rest-go')).to_have_text('보석 100으로 쉬기')
    expect(rest.locator('.rest-go')).to_be_disabled()
    page.evaluate('state.gems = 1000; state.daily.rest = 4; commit()')
    expect(rest.locator('.rest-go')).to_have_text('내일 다시')
    expect(rest.locator('.rest-go')).to_be_disabled()

    # ── 운영 날짜(KST)·오늘 화면 ──
    # 한국 시간 2026-12-01 00:30에 복귀했을 때 전날 승리는 오늘 목표에 들어가지 않는다
    today = chrome.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    today.on('pageerror', lambda issue: issues.append(str(issue)))
    kst_0030 = datetime.fromisoformat('2026-11-30T15:30:00+00:00')
    today.clock.install(time=kst_0030)
    today.goto(target)
    today.clock.pause_at(kst_0030 + timedelta(seconds=2))
    today.get_by_role('radio', name='남학생').check()
    today.get_by_role('textbox', name='닉네임').fill('오늘')
    today.get_by_role('button', name='입학하기').click()
    today.evaluate('''() => {
      document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
      state.daily.date = '2026-11-30'; state.daily.claimed = []; state.attendance = { count: 2, last: '2026-11-30' };
      state.totalClears = 0; state.premium.monthly = 10; state.premium.monthlyDay = '2026-11-27';
      const when = Date.parse('2026-11-30T22:30:02+09:00');
      sessionStorage.setItem('midnight-snapshot', JSON.stringify({ version: 5, when, state }));
    }''')
    wins_before = today.evaluate('state.wins')
    today.add_init_script('''(() => {
      const key = 'haesol-recess-king-v1';
      const snapshot = sessionStorage.getItem('midnight-snapshot');
      if (snapshot) {
        localStorage.setItem(key, snapshot);
        sessionStorage.removeItem('midnight-snapshot');
      }
    })()''')
    today.reload()
    expect(today.get_by_role('heading', name='쉬는 시간 보상')).to_be_visible()
    midnight = today.evaluate(f'''() => ({{ date: state.daily.date, total: state.wins - {wins_before}, counted: state.wins - state.daily.baseWins,
      picks: state.daily.picks, monthly: [state.premium.monthly, state.premium.monthlyDay, state.mail.find(mail => mail.title === '식단 월정액 보석')?.reward.gems] }})''')
    assert midnight['date'] == '2026-12-01' and midnight['total'] > 40, midnight
    assert 0 < midnight['counted'] < midnight['total'], midnight
    assert len(midnight['picks']) == 3 and midnight['picks'][0] == 'wins' and 'dungeons' not in midnight['picks'], midnight
    assert midnight['monthly'] == [6, '2026-12-01', 400], midnight  # 11-27 → 12-01: 4일치 한 번에
    today.locator('#dialog').get_by_role('button', name='좋아요').click()
    today.clock.run_for(400)  # 다음 창은 0.16초 뒤에 열린다(시계 멈춤 상태)
    # 방치 보상 창 다음에 오늘 화면: 출석 3일째, 오늘 목표 3개 + 모두 완료, 한 번에 받기
    expect(today.locator('#today-dialog')).to_be_visible()
    expect(today.locator('#today-links [data-link="rest"]')).to_have_text('빠른 휴식 · 2시간치 무료로 받기')
    expect(today.locator('#today-attend .today-day.today')).to_have_text('3')
    expect(today.locator('#today-goals .today-goal')).to_have_count(4)
    expect(today.locator('#today-goals .today-goal[data-goal="wins"]')).to_have_class(re.compile('ready'))
    today.locator('#today-claim').click()
    expect(today.locator('#today-claim')).to_be_disabled()
    claimed = today.evaluate('[state.attendance.count, state.attendance.last, state.daily.claimed.slice()]')
    assert claimed == [3, '2026-12-01', ['wins']], claimed
    today.locator('#today-claim').click(force=True)
    assert today.evaluate('state.attendance.count') == 3
    today.locator('#today-dialog').get_by_role('button', name='닫기').click()
    # 기기 시계를 하루 되돌려도 받은 보상·쓴 열쇠가 되살아나지 않는다(운영 날짜는 뒤로 가지 않음)
    rollback = today.evaluate('''() => {
      state.daily.keys.coin = 0;
      const day = gameDay(state, new Date('2026-11-30T12:00:00+09:00'));
      refreshDay(state, day);
      return [day, state.daily.claimed.slice(), state.daily.keys.coin, claimAttendance(state, day)];
    }''')
    assert rollback == ['2026-12-01', ['wins'], 0, None], rollback
    # 큰 명예 배지 누계(안전 정수 범위 밖)도 저장·복구 뒤 그대로
    badges = today.evaluate('''() => {
      state.prestige.earned = 3.44e16; state.prestige.badges = 2e17;
      const back = restore(JSON.parse(JSON.stringify({ version: 5, when: Date.now(), state })));
      return [back.prestige.earned, back.prestige.badges];
    }''')
    assert badges == [3.44e16, 2e17], badges

    # ── 주간 전국대회(12/1 화요일 → 11/30 주간, 잡기형: 추천 기공 계열) ──
    today.evaluate("state.prestige.earned = 0; state.prestige.badges = 0; state.totalClears = 0; selectView('battle'); commit()")  # 방치 2시간에 1-3을 넘겼을 수 있어 잠금 상태로
    card = today.locator('#weekly-card')
    expect(card).to_be_visible()
    expect(card.locator('.weekly-head b')).to_have_text('주간 전국대회 · 11월 30일 주간')
    expect(card.locator('.weekly-rule')).to_contain_text('이번 주 잡기형')
    assert today.evaluate('state.weekly.points') == 10  # 위에서 받은 오늘 목표 하나
    expect(card.get_by_role('button', name=re.compile('챔피언전'))).to_be_disabled()  # 1-3 전이라 잠김
    before = today.evaluate('[state.gems, state.recruits, state.shardPicks]')
    today.evaluate("state.weekly.points = 170; commit()")
    card.get_by_role('button', name='구간 보상 받기 2').click()
    after = today.evaluate('[state.gems, state.recruits, state.shardPicks]')
    assert [after[0] - before[0], after[1] - before[1], after[2] - before[2]] == [50, 2, 10], (before, after)
    expect(card.locator('.weekly-tier.claimed')).to_have_count(2)
    # 조각 선택권: 동료 탭에서 원하는 동료에게
    today.get_by_role('button', name='동료', exact=True).click()
    expect(today.locator('#shard-pick-note')).to_contain_text('조각 선택권 10개')
    today.locator('#mate-grid .shard-pick').first.click()
    assert today.evaluate('state.shardPicks') == 0 and today.evaluate('Object.values(state.mateShards).includes(10)')
    # 챔피언전: 이번 주 첫 단계, 우승하면 30점·입장권 차감·다음 단계
    today.evaluate("state.totalClears = 5; state.companions.mate10 = 1; state.companions.mate11 = 1; state.test = { slots: true }; state.party = ['mate10', 'mate11', null, null]; selectView('battle'); commit()")
    assert today.evaluate('weeklyFamilyCount(state)') == 2
    enter = card.get_by_role('button', name=re.compile('챔피언전'))
    expect(enter).to_have_text('챔피언전 1단계 · 1번')
    enter.click()
    cup = today.evaluate("[state.dungeon.id, state.dungeon.level === Math.max(2, progress(state) - 12), document.getElementById('stage-number').textContent, Math.round(cupDamage(state) * 100)]")
    assert cup == ['cup', True, '주간 전국대회 · 잡기형', 130], cup
    today.evaluate('leaveDungeon(state, true, null); commit()')
    weekly = today.evaluate('[state.weekly.points, state.weekly.cupWins, cupKeys(state), cupStep(state)]')
    assert weekly == [170 + 36, 1, 0, 2], weekly  # 30 × (1 + 0.1 × 2)
    expect(card.get_by_role('button', name=re.compile('챔피언전'))).to_be_disabled()
    # 다음 주 첫 접속: 받지 않은 구간은 우편 한 통, 지난주 기록
    rollover = today.evaluate('''() => {
      state.weekly.points = 250;
      refreshDay(state, '2026-12-08');
      const mail = state.mail.find(item => item.title === '11월 30일 주간 전국대회 보상');
      return [state.weekly.week, state.weekly.points, mail && mail.reward, state.weeklyLog[0].tiers, state.weeklyLog[0].rule, cupRule(state.weekly.week).id];
    }''')
    assert rollover == ['2026-12-07', 0, {'keys': 1, 'gems': 100}, 3, 'grapple', 'attack'], rollover
    today.close()
    assert not issues, issues
    chrome.close()

print('Mail, recruit/party/allies, party slot unlocks, team synergy, 16 companion skills, quest reward, daily shop, promotion trial, pass + premium grant, offline double, KST day rollover (midnight offline split, rollback, monthly catch-up, big badges), today screen, weekly tournament (rules, tiers, shard picks, champion ladder, rollover mail), 12-hour offline cap and quick rest verified.')
