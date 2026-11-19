from pathlib import Path
import base64
import re

from PIL import Image
from playwright.sync_api import expect, sync_playwright

from tempfile import gettempdir
qa_dir = Path(gettempdir()) / 'haesol-qa'
qa_dir.mkdir(exist_ok=True)


root = Path(__file__).resolve().parents[2]
site = root / 'work' / 'recess'
assets = site / 'assets'
url = (root / 'outputs' / 'recess-king.html').as_uri()


def from_asset(style_value, name):
    payload = re.search(r'data:image/webp;base64,([A-Za-z0-9+/=]+)', style_value)
    return bool(payload and base64.b64decode(payload[1]) == (assets / f'{name}.webp').read_bytes())


for pose in ('windup', 'strike', 'follow'):
    assert Image.open(assets / f'motion-boy-spar-{pose}.webp').size == (280, 255)
for name in ('dust', 'cloud'):
    strip = Image.open(assets / f'fx-{name}.webp')
    assert strip.size == (960, 120) and strip.mode == 'RGBA'
    for index in range(6):
        assert strip.getchannel('A').crop((160 * index, 0, 160 * (index + 1), 120)).getbbox()
# 5차: 주인공 종목별 공격·스킬 포즈, 6차: 동료 16명(대결 9장 + 스킬 2장 + 스탠딩)·건달 12명(9장)
for gender in ('boy',):
    for pose in ('kick-windup', 'kick-strike', 'kick-follow', 'knee-strike', 'throw-windup', 'throw-strike', 'throw-follow', 'hold-strike', 'guard', 'lose', 'ready-b',
                 'skill-rush-windup', 'skill-rush-strike', 'skill-counter-guard', 'skill-counter-strike'):
        assert Image.open(assets / f'motion-{gender}-{pose}.webp').size == (280, 255)
        assert Image.open(assets / f'wardrobe-{gender}-{pose}.webp').size == (280, 255)
for n in range(1, 17):
    for pose in ('ready', 'step', 'windup', 'strike', 'follow', 'hit', 'down', 'guard', 'open', 'skill-a', 'skill-b'):
        assert Image.open(assets / f'motion-mate{n}-{pose}.webp').size == (280, 255)
    assert Image.open(assets / f'stand-mate{n}.webp').size == (720, 1280)
for id in [f'thug{n}' for n in range(1, 9)] + [f'thug-boss{n}' for n in range(1, 5)]:
    for pose in ('ready', 'step', 'windup', 'strike', 'follow', 'hit', 'down', 'guard', 'open'):
        assert Image.open(assets / f'motion-{id}-{pose}.webp').size == (280, 255)
# 7차 모션 띠: 한 칸 280×255, 칸 수 = 띠 폭 ÷ 280(타격 칸 뒤에 마무리 칸이 남을 만큼). 주인공 띠는 같은 크기의 장비 마스크 띠가 있다
STRIP_MIN = {
    'boy': {'idle': 2, 'run': 2, 'punch': 4, 'hit': 2, 'down': 2, 'victory': 2, 'kick': 4, 'knee': 4, 'throw': 5, 'hold': 5, 'guard': 2,
            'rush': 4, 'counter': 4, 'combo': 4, 'cheer': 2, 'drink': 2, 'step': 4},
    'thug': {'idle': 2, 'attack': 4, 'hit': 2, 'down': 2},
    'mate': {'idle': 2, 'run': 2, 'attack': 5, 'skill': 4},
}
strip_css = (site / 'anim.css').read_text(encoding='utf-8') + (site / 'wardrobe.css').read_text(encoding='utf-8')
for strip_id, family in [('boy', 'boy')] + [(f'thug{n}', 'thug') for n in range(1, 9)] + [(f'thug-boss{n}', 'thug') for n in range(1, 5)] + [(f'mate{n}', 'mate') for n in range(1, 17)]:
    for clip, least in STRIP_MIN[family].items():
        strip = Image.open(assets / f'anim-{strip_id}-{clip}.webp')
        assert strip.height == 255 and strip.width % 280 == 0 and strip.width // 280 >= least, (strip_id, clip, strip.size)
        assert f"--anim-{clip}: url('assets/anim-{strip_id}-{clip}.webp')" in strip_css, (strip_id, clip)
        if strip_id == 'boy':
            assert Image.open(assets / f'animmask-boy-{clip}.webp').size == strip.size, clip
# 아카데미 경기장 12곳과 지역 구역 배경(시골·도시 4구역씩)
for id in [f'a{n:02d}' for n in range(1, 13)] + [f'z0{n}{kind}' for n in range(1, 5) for kind in 'rc']:
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
    page.screenshot(path=str(qa_dir / 'play-art-cover.png'))
    page.get_by_role('radio', name='남학생').check()
    page.get_by_role('textbox', name='닉네임').fill('하루')
    page.get_by_role('button', name='입학하기').click()

    for cycle, map, contest, motion in [(0, 0, 'boxing', 'strike'), (0, 3, 'kickboxing', 'kick'), (0, 4, 'muaythai', 'knee'), (0, 6, 'wrestling', 'throw'),
                                      (0, 7, 'jiujitsu', 'hold'), (1, 0, 'ssireum', 'throw'), (2, 0, 'taekwondo', 'spar'), (3, 9, 'mma', 'strike')]:
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
            # 태권도는 보호구 정지 그림이라 7차 모션 띠를 쓰지 않는다
            assert 'anim-on' not in (page.locator('#player-sprite').get_attribute('class') or '')
            # 지역의 건달은 보호구로 바꾸지 않고 자기 그림 그대로
            rival = page.locator('#rival-sprite').get_attribute('data-sprite')
            color = page.locator('#rival-sprite').get_attribute('data-spar') or rival
            path = page.locator('#rival-sprite').evaluate("e => getComputedStyle(e).getPropertyValue('--pose-image')")
            assert from_asset(path, f'motion-{color}-hit'), color
            assert rival.startswith('thug') == (not page.locator('#rival-sprite').get_attribute('data-spar')), rival
        else:
            expect(page.locator('#player-sprite canvas:not(.anim)')).to_have_attribute('data-frame', re.compile(f':{motion}$'))
            # 7차 모션 띠: 타격 상태에서는 그 종목 띠의 타격 칸(주먹·발차기·무릎 3번째, 메치기 4번째, 굳히기 2번째)을 장비 색으로 그린다
            clip = 'punch' if motion == 'strike' else motion
            impact = {'punch': 2, 'kick': 3, 'knee': 3, 'throw': 4, 'hold': 5}[clip]  # Codex 9차 중간 칸 반영
            expect(page.locator('#player-sprite')).to_have_class(re.compile('(^| )anim-on( |$)'))
            expect(page.locator('#player-sprite canvas.anim')).to_have_attribute('data-frame', f'boy:{clip}:{impact}')
            # 잡기 종목: 맞는 쪽은 메쳐져 뜨거나(throw) 눌린다(hold). 그 그림이 있는 상대(아카데미 선수)만
            rival = page.locator('#rival-sprite').get_attribute('data-sprite')
            if rival.startswith('thug'):
                expect(page.locator('#rival-sprite canvas.anim')).to_have_attribute('data-frame', re.compile(f'^{rival}:hit:[01]$'))
            if motion in ('throw', 'hold') and (assets / f'motion-{rival}-thrown.webp').exists():
                path = page.locator('#rival-sprite').evaluate("e => getComputedStyle(e).getPropertyValue('--pose-image')")
                assert from_asset(path, f"motion-{rival}-{'thrown' if motion == 'throw' else 'pinned'}"), rival

        page.evaluate("flashHit('rival', { amount: 4, move: 'attack' })")
        effect = page.evaluate('contest(state).fx')
        if effect in ('dust', 'cloud'):
            value = page.locator(f'.impact.fx-{effect}').last.evaluate("e => getComputedStyle(e, '::before').backgroundImage")
            assert from_asset(value, f'fx-{effect}')
            assert page.locator(f'.impact.fx-{effect}').last.evaluate("e => getComputedStyle(e, '::before').animationTimingFunction") == 'steps(6)'
        assert page.locator('.prop').count() == 0
        if contest in ('boxing', 'wrestling', 'taekwondo'):
            page.clock.run_for(130)
            page.screenshot(path=str(qa_dir / f'play-art-{contest}.png'))
        page.clock.run_for(750)

    page.evaluate('''() => {
      state.profile.gender = 'boy';
      state.cycle = 0;
      openFight(state, 0, 0, 500);
      setPoses('player', [['victory', 30000]]);
      commit();
    }''')
    assert from_asset(page.locator('#player-sprite').evaluate("e => getComputedStyle(e).getPropertyValue('--pose-image')"), 'motion-boy-victory')

    # 테스트 모드 · 동작 확인: 대결을 멈추고 동작을 하나씩 재생하며 지금 몇 번째 칸인지 보여 준다
    lab = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    lab.on('pageerror', lambda error: failures.append(str(error)))
    lab.goto(url + '?test')
    lab.get_by_role('radio', name='남학생').check()
    lab.get_by_role('textbox', name='닉네임').fill('검사')
    lab.get_by_role('button', name='입학하기').click()
    lab.locator('#test-badge').click()
    lab.get_by_role('button', name='동작 확인(모션 띠)').click()
    expect(lab.locator('#motion-lab')).to_be_visible()
    lab.locator('#ml-actions').get_by_role('button', name='주먹').click()
    expect(lab.locator('#ml-note')).to_contain_text('띠 punch')
    lab.locator('#ml-actions').get_by_role('button', name='승리').click()
    expect(lab.locator('#ml-note')).to_contain_text('띠 victory')
    wins = lab.evaluate('state.wins')
    lab.wait_for_timeout(1500)
    assert lab.evaluate('state.wins') == wins
    # 띠 보기: 대결과 상관없이 아무 띠나 골라 한 칸씩 넘기고, 타격 칸과 발 위치를 본다
    lab.get_by_role('tab', name='띠 보기').click()
    expect(lab.locator('#ml-strip')).to_be_visible()
    expect(lab.locator('#ml-fight')).to_be_hidden()
    assert lab.locator('#mv-who option').count() == 2 + 16 + 8 + 4
    lab.locator('#mv-who').select_option('mate1')
    lab.locator('#mv-clip').select_option('run')
    expect(lab.locator('#mv-film .mv-thumb')).to_have_count(4)
    lab.get_by_role('button', name='다음 칸').click()
    expect(lab.locator('#mv-play')).to_have_text('재생')
    frame = lab.locator('#mv-canvas').get_attribute('data-frame')
    lab.get_by_role('button', name='다음 칸').click()
    expect(lab.locator('#mv-canvas')).not_to_have_attribute('data-frame', frame)
    expect(lab.locator('#mv-note')).to_contain_text(re.compile(r'run [1-4]/4칸 · 발 24[4-9]px'))
    lab.locator('#mv-who').select_option('boy:plain')
    lab.locator('#mv-clip').select_option('hold')
    expect(lab.locator('#mv-film .mv-thumb')).to_have_count(9)
    expect(lab.locator('#mv-film .mv-thumb.mv-hit')).to_have_text('6 타격')
    lab.locator('#mv-film .mv-thumb.mv-hit').click()
    expect(lab.locator('#mv-canvas')).to_have_attribute('data-frame', 'boy:hold:5')
    expect(lab.locator('#mv-note')).to_contain_text(re.compile(r'hold 6/9칸 · 타격 칸 · 발 24[89]px'))
    # 일어나기(Codex 9차): 띠 보기에 나오고 5칸
    lab.locator('#mv-clip').select_option('getup')
    expect(lab.locator('#mv-film .mv-thumb')).to_have_count(5)
    lab.get_by_role('tab', name='대결에서').click()
    expect(lab.locator('#ml-actions')).to_be_visible()
    lab.get_by_role('button', name='끝내기').click()
    expect(lab.locator('#motion-lab')).to_be_hidden()
    lab.close()
    assert not failures, failures
    browser.close()

print('Cover, pose families, fighting-contest mapping (strike/grapple), protective rivals, six-frame effects, motion strips (hero/thugs/mates, tinted hero), motion lab with strip viewer and art assets verified.')
