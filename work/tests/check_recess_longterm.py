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
    page.get_by_role('radio', name='남학생').check()
    page.get_by_role('textbox', name='닉네임').fill('장기')
    page.get_by_role('button', name='입학하기').click()
    page.clock.run_for(3000)

    # 아카데미 길이: 학년이 오를수록 상대 체력 배율(1-1 ×12 → 3-1 ×20 → 4-3 ×15), 졸업 뒤 첫 지역 3바퀴(36맵) 동안 ×1로 돌아온다
    pace = page.evaluate('''() => {
      const at = (cycle, map) => Math.round(paceMult({ cycle, map }) * 100) / 100;
      const first = { ...state, cycle: 0, map: 0, wave: 0, farm: null, dungeon: null };
      return [at(0, 0), at(0, 3), at(0, 6), at(0, 9), at(0, 11), at(1, 0) < 15 && at(1, 0) > 13, at(3, 11), at(5, 0), Math.round(waveHp(first))];
    }''')
    assert pace == [12, 14, 20, 14, 15, True, 1, 1, 24 * 12], pace

    # 아카데미 4-3 보스 직전 상태로 만들고 이기면 졸업해 첫 지역(정선)으로 넘어가는지
    page.evaluate('''() => {
      const save = JSON.parse(localStorage.getItem('haesol-recess-king-v1'));
      save.when = Date.now();
      Object.assign(save.state, { map: 11, wave: 3, enemyHp: 1, pause: 0, nextAttack: 0.05, nextEnemy: 3, roundEnd: null, playerMove: null, enemyMove: null });
      save.state.training.health = 300;
      save.state.training.power = 400;
      save.state.cleared.fill(true, 0, 11);
      sessionStorage.setItem('qa-snapshot', JSON.stringify(save));
    }''')
    page.add_init_script('''(() => {
      const snapshot = sessionStorage.getItem('qa-snapshot');
      if (snapshot) { localStorage.setItem('haesol-recess-king-v1', snapshot); sessionStorage.removeItem('qa-snapshot'); }
    })()''')
    page.reload()
    page.clock.run_for(4000)
    expect(page.locator('#stage-number')).to_contain_text('정선')
    assert page.evaluate('state.cycle') == 1 and page.evaluate('state.cleared.every(done => !done) || state.cleared[0]')

    # 던전: 열쇠로 상금 토너먼트 Lv.1에 들어가 졸개+던전 보스를 이기면 단계·보상·열쇠가 바뀌는지
    coins = page.evaluate('state.coins')
    page.get_by_role('button', name='대결', exact=True).click()
    page.get_by_role('button', name='상금 토너먼트 Lv.1 도전').click()
    expect(page.locator('#battle-title')).to_have_text('상금 토너먼트')
    expect(page.locator('#dungeon-timer')).to_be_visible()
    page.clock.run_for(8000)
    assert page.evaluate('state.dungeons.coin') == 1 and page.evaluate('state.daily.keys.coin') == 1
    assert page.evaluate('state.coins') > coins
    page.get_by_role('button', name='상금 토너먼트 Lv.1 소탕').click()
    assert page.evaluate('state.daily.keys.coin') == 0
    expect(page.get_by_role('button', name='상금 토너먼트 Lv.2 도전')).to_be_disabled()

    # 재입학: 배지를 받고 아카데미 Lv.1로 돌아가며, 명예 코칭을 배울 수 있는지
    page.get_by_role('button', name='성장', exact=True).click()
    page.get_by_role('tab', name='코칭').click()
    expect(page.locator('#prestige-gain')).to_contain_text('명예 배지 +')
    page.get_by_role('button', name='재입학', exact=True).click()
    page.get_by_role('button', name='재입학하기').click()
    expect(page.get_by_role('heading', name='다시 입학!')).to_be_visible()
    page.get_by_role('button', name='좋아요').click()
    expect(page.locator('#level')).to_have_text('1')
    expect(page.locator('#stage-number')).to_contain_text('해솔 아카데미')
    assert int(page.locator('#badge-count').inner_text().replace(',', '')) > 0
    page.locator('#perk-list button').first.click()
    expect(page.locator('#perk-list .item').first).to_contain_text('Lv.1')

    # 큰 수 표기
    assert page.evaluate('fmt(123456)') == '12.3만'
    assert page.evaluate('fmt(1.5e12)') == '1.5조'
    # 추가 기능: 30초 기록전, 재입학 빠른 복귀, 경기 규칙·추천 동료, 던전 승리하면 다음 단계
    extra = page.evaluate('''() => {
      const backup = structuredClone(state);
      const out = {};
      state.daily = null; refreshDay(state, todayKey());
      state.dungeon = null; state.roundEnd = null; state.dungeonResult = null; state.totalClears = Math.max(3, state.totalClears);
      state.training.power = 6000; state.training.health = 4000; state.hp = maxHp(state);
      out.recordEnter = enterRecord(state);
      simulate(state, 33, null);
      out.record = [state.dungeonResult?.id, state.dungeonResult?.record > 0, state.record.best > 0, recordKeys(state), state.dungeon];
      out.recordSweep = Boolean(sweepRecord(state)) && recordKeys(state) === 0;
      state.dungeonAuto = { coin: true }; state.dungeons.coin = 0; state.daily.keys.coin = 2; state.hp = maxHp(state);
      enterDungeon(state, 'coin');
      for (let i = 0; i < 150 && (state.dungeon || state.roundEnd); i++) simulate(state, 1, null);
      out.chain = [state.dungeons.coin, dungeonKeys(state, 'coin'), state.dungeonResult?.chain?.wins, state.dungeonChain];
      out.rushEnd = [rushEnd(5), rushEnd(30), rushEnd(REGION_START[5] * MAPS.length + 3) === REGION_START[4] * MAPS.length];
      const rushState = structuredClone(state);
      rushState.dungeon = null; rushState.roundEnd = null; rushState.farm = null; rushState.cycle = 0; rushState.cleared = MAPS.map(() => false); rushState.map = 0; rushState.wave = 0;
      const normal = structuredClone(rushState);
      rushState.rush = { until: 120 };
      simulate(rushState, 20, null); simulate(normal, 20, null);
      out.rushFaster = progress(rushState) > progress(normal);
      const regional = structuredClone(state); regional.dungeon = null; regional.cycle = REGION_START[2]; regional.map = 3;
      const rule = ruleId(regional);
      regional.party = [ruleMates(regional, rule)[0], null, null, null];
      regional.companions[regional.party[0]] = 1;
      out.rule = [ruleId({ ...regional, cycle: 0 }), RULE_ORDER.includes(rule), ruleBonus(regional) > 0];
      Object.assign(state, backup);
      commit();
      return out;
    }''')
    assert extra == {
        'recordEnter': True, 'record': ['record', True, True, 1, None], 'recordSweep': True,
        'chain': [2, 0, 2, None], 'rushEnd': [0, 12, True], 'rushFaster': True, 'rule': [None, True, True],
    }, extra
    assert not issues, issues
    chrome.close()

print('Academy pacing multipliers, graduation after 4-3 into the first region, coin dungeon clear/sweep/keys, transfer (prestige) with badges, perk purchase, and Korean big-number format verified.')
