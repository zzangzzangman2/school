'use strict';
// 새 시스템 화면: 퀘스트 띠, 액티브 스킬 바, 동료 표시, 성장 하위 탭(스킬·승급·학원), 동료·모집, 상점, 우편, 성장 패스, 설정.
// ui.js보다 먼저 읽히고, ui.js의 함수($, row, setText, message, commit, selectView …)는 실행할 때 쓴다.

let growthTab = 'train';
let gachaTab = 'stickers';
let offlineGain = 0;
let renderedAllies = '';
const allyPoses = new Map();
const ACTIVE_ICONS = { pencil: '#st-goldpen', cheer: '#i-megaphone', lunch: '#i-tray', sprint: '#i-run' };
const ACTIVE_TONES = { pencil: 'yellow', cheer: 'pink', lunch: 'green', sprint: 'blue' };
const ACTIVE_POSES = { pencil: [['skill-combo-windup', 120], ['skill-combo-strike', 300]], cheer: [['skill-cheer', 700]], lunch: [['skill-drink', 700]], sprint: [['skill-step-windup', 160], ['skill-step-follow', 300]] };
const QUEST_TEXT = {
  best: n => `${placeLabel(n - 1)} 클리어`,
  power: n => `힘 훈련 Lv.${n}`,
  health: n => `체력 훈련 Lv.${n}`,
  level: n => `레벨 ${n} 달성`,
  pulls: n => `스티커 ${n}번 뽑기`,
  recruits: n => `동료 ${n}번 모집`,
  dungeons: n => `던전 ${n}번 하기`,
  tier: n => `${tierName(n)} 승급`,
  transfer: n => `재입학 ${n}번 하기`,
  party: n => `동료 ${n}명 출전`,
};
const QUEST_GO = {
  best: 'battle', power: 'training:train', health: 'training:train', level: 'battle', pulls: 'gacha:stickers', recruits: 'gacha:recruit',
  dungeons: 'battle', tier: 'training:tier', transfer: 'training:academy', party: 'party',
};
const SHOP_ICONS = { daily: '#i-gift', tickets10: '#i-ticket', recruit1: '#i-users', recruit10: '#i-users', keys: '#i-key', coinbox: '#i-gift', patches: '#i-shirt', snacks: '#i-milk' };
const SHOP_TONES = { daily: 'green', tickets10: 'pink', recruit1: 'blue', recruit10: 'blue', keys: 'teal', coinbox: 'yellow', patches: 'red', snacks: 'yellow' };

function openView(target) {
  const [view, sub] = target.split(':');
  if (view === 'training' && sub) growthTab = sub;
  if (view === 'gacha' && sub) gachaTab = sub;
  selectView(view);
}

function showSubtabs(boxId, current, sectionId) {
  document.querySelectorAll(`#${boxId} [data-sub]`).forEach(button => button.setAttribute('aria-selected', String(button.dataset.sub === current)));
  document.querySelectorAll(`#${sectionId} .subpanel`).forEach(panel => { panel.hidden = panel.dataset.panel !== current; });
}

function partyReady() {
  const free = state.party.slice(0, partySlots(state)).some(id => !id);
  return free && Object.keys(state.companions).some(id => !state.party.includes(id));
}

function academyReady() {
  const perkReady = Object.keys(PERKS).some(id => state.prestige.perks[id] < PERKS[id].cap && state.prestige.badges >= perkCost(state, id));
  return perkReady || (state.prestige.count === 0 && prestigeGain(state) > 0);
}

// ── 매 프레임: 보석·칭호·퀘스트 띠·알림 점 ──
function renderMetaHud() {
  setText('gems', fmt(state.gems));
  setText('hud-tier', tierName(state.tier));
  const quest = questState(state);
  setText('objective-label', `퀘스트 ${state.quest + 1}`);
  setText('objective-title', `${QUEST_TEXT[quest.kind](quest.target)} (${fmt(Math.min(quest.value, quest.target))}/${fmt(quest.target)})`);
  setText('objective-reward', `보상 보석 ${quest.gems}`);
  const button = $('objective-button');
  setText('objective-button', quest.done ? '받기' : '›');
  const label = quest.done ? '퀘스트 보상 받기' : '퀘스트 하러 가기';
  if (button.ariaLabel !== label) button.ariaLabel = label;
  document.querySelector('.objective').classList.toggle('done', quest.done);
  const mails = state.mail.length;
  $('mail-dot').hidden = !mails;
  setText('mail-dot', mails > 9 ? '9+' : String(mails || ''));
  $('shop-dot').hidden = shopLeft(state, 'daily') <= 0;
  $('party-dot').hidden = currentView === 'party' || !partyReady();
  $('tier-dot').hidden = !tierReady(state);
  $('academy-dot').hidden = !academyReady();
  $('recruit-dot').hidden = state.recruits < 1;
}

function questTap() {
  const quest = claimQuest(state);
  if (quest) {
    message(`퀘스트 완료! 보석 +${quest.gems}`);
    flyCoins(2);
    commit();
    return;
  }
  openView(QUEST_GO[questState(state).kind]);
}

// ── 액티브 스킬 바 ──
function renderActives() {
  const box = $('actives');
  if (!box.childElementCount) {
    box.replaceChildren(...Object.keys(ACTIVE).map(id => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `active-skill ${id}`;
      button.dataset.skill = id;
      const icon = document.createElement('span');
      icon.className = 'active-icon';
      icon.dataset.activeArt = id;
      icon.ariaHidden = 'true';
      const cd = document.createElement('small');
      button.append(icon, cd);
      button.addEventListener('click', () => {
        if (castSkill(state, id, combatEvent)) commit();
        else if (!skillUnlocked(state, id)) message(`${ACTIVE[id].name}: ${tierName(ACTIVE[id].tier)} 승급 때 열려요.`);
      });
      return button;
    }));
  }
  for (const button of box.children) {
    const id = button.dataset.skill;
    const open = skillUnlocked(state, id);
    const left = state.cooldowns[id] || 0;
    const active = (state.buffs[id] || 0) > 0;
    button.classList.toggle('locked', !open);
    button.classList.toggle('cooling', open && left > 0);
    button.classList.toggle('buffing', active);
    button.style.setProperty('--cd', `${open ? left / ACTIVE[id].cd * 360 : 0}deg`);
    const text = !open ? '잠김' : left > 0 ? `${Math.ceil(left)}` : active ? `${Math.ceil(state.buffs[id])}` : '';
    if (button.lastElementChild.textContent !== text) button.lastElementChild.textContent = text;
    const label = `${ACTIVE[id].name}${open ? (left > 0 ? `, ${Math.ceil(left)}초 남음` : ', 사용 가능') : `, ${tierName(ACTIVE[id].tier)} 승급 때 열림`}`;
    if (button.ariaLabel !== label) button.ariaLabel = label;
  }
}

function onActive(event) {
  const pop = document.createElement('span');
  pop.className = `skill-pop ${event.id}`;
  pop.textContent = `${ACTIVE[event.id].name}!${event.amount && event.id !== 'lunch' ? ` ${fmt(event.amount)}` : event.id === 'lunch' ? ` +${fmt(event.amount)}` : ''}`;
  $('arena').append(pop);
  setTimeout(() => pop.remove(), 1000);
  const frames = ACTIVE_POSES[event.id];
  if (frames && $('arena').dataset.motion !== 'spar') setPoses('player', frames);
  if (event.id === 'pencil' && !reducedMotion.matches) {
    flashHit('rival', { move: 'rush', amount: event.amount, lucky: false });
    packAct('hit', 0, 260);
  }
  playSound(event.id === 'lunch' ? 'win' : 'bell');
}

// ── 동료 표시: 주인공과 같은 크기(--unit)로 2줄 대형, 몸이 서로 겹치지 않게 ──
// d = 주인공 몸 중심에서 왼쪽으로 떨어진 거리, y = 바닥에서 띄운 높이(둘 다 --unit 배수), s = 크기
// 출전 번호가 곧 자리: 1·2번 = 전열(주인공 옆), 3·4번 = 후열(앞줄 머리 높이 0.8에서 사이사이). 빈 번호는 자리를 비워 둔다
const ALLY_SLOTS = [{ d: 0.52, y: 0, s: 1 }, { d: 1.04, y: 0, s: 1 }, { d: 0.26, y: 0.8, s: 0.85 }, { d: 0.78, y: 0.8, s: 0.85 }];

function renderAllies() {
  const entries = state.party.slice(0, partySlots(state)).map((id, slot) => [slot, id]).filter(([, id]) => id);
  const key = entries.map(([slot, id]) => `${slot}:${id}`).join('|');
  const box = $('allies');
  if (key !== renderedAllies) {
    renderedAllies = key;
    box.replaceChildren(...entries.map(([slot, id]) => {
      const place = ALLY_SLOTS[slot];
      const ally = document.createElement('span');
      ally.className = 'ally';
      ally.dataset.slot = slot;
      ally.style.setProperty('--d', place.d);
      ally.style.setProperty('--y', place.y);
      ally.style.setProperty('--s', place.s);
      ally.style.zIndex = 4 - slot;
      const sprite = document.createElement('span');
      sprite.className = 'sprite';
      sprite.dataset.sprite = COMPANIONS[id].sprite;
      sprite.dataset.spar = protectiveSprite(COMPANIONS[id].sprite);
      sprite.dataset.pose = 'ready';
      ally.append(sprite);
      return ally;
    }));
  }
  const now = performance.now();
  for (const ally of box.children) {
    const pose = (allyPoses.get(ally.dataset.slot) || []).find(entry => entry.until > now)?.pose || 'ready';
    const sprite = ally.firstElementChild;
    if (sprite.dataset.pose !== pose) sprite.dataset.pose = pose;
  }
}

function floatText(target, text, kind) {
  if (reducedMotion.matches) return;
  const effect = document.createElement('span');
  effect.className = `impact ally-hit float-${kind}`;
  effect.setAttribute('aria-hidden', 'true');
  const number = document.createElement('span');
  number.className = 'damage';
  number.textContent = text;
  effect.append(number);
  $(target).append(effect);
  setTimeout(() => effect.remove(), 700);
}

// ── 동료 공격 연출: 출전 자리(대기점)에서 상대 앞까지 달려가 치고, 뒷걸음으로 돌아온다 ──
// 화면 연출만 바꾼다. 피해·쿨타임·오프라인 계산은 엔진(allyStrike·castMate) 그대로이고, 피해 숫자만 타격 순간에 띄운다.
// 여럿이 한꺼번에 달려와도 겹치지 않게 출전 번호마다 접근 지점을 다르게 둔다(x: 앞뒤, y: 높이, px)
const ALLY_APPROACH = [{ x: 0, y: 0 }, { x: -46, y: 10 }, { x: -22, y: -26 }, { x: -68, y: -14 }];
const ALLY_RUN = { out: 170, back: 210 };
const allyRuns = new Map();

function allyApproach(ally, slot) {
  const from = ally.getBoundingClientRect();
  const target = $('rival-sprite').getBoundingClientRect();
  if (!from.width || !target.width) return null;
  const lane = ALLY_APPROACH[slot] || ALLY_APPROACH[0];
  // 동료 몸 앞쪽(그림 폭의 0.68)이 상대 몸 앞쪽(상대 그림 폭의 0.36)에 닿을 만큼
  const x = target.left + target.width * 0.36 - (from.left + from.width * 0.68) + lane.x;
  const y = target.bottom - from.bottom + lane.y;
  return { x: Math.round(Math.max(0, x)), y: Math.round(y) };
}

// poses: [[pose, ms], ...] 제자리 동작. dash면 앞뒤로 달리기(step)를 붙인다. hitAt = 제자리 동작 시작부터 타격까지(ms)
function allyRun(slot, poses, { dash = true, hitAt = 0, onHit = () => {}, skill = false } = {}) {
  const key = String(slot);
  const now = performance.now();
  const rate = state?.speed || 1;
  const prev = allyRuns.get(key);
  if (prev && prev.skill && !skill && prev.until > now) { onHit(); return; } // 스킬 연출 중에는 평타 숫자만
  prev?.timers.forEach(clearTimeout);
  const ally = document.querySelector(`#allies .ally[data-slot="${key}"]`);
  const move = dash && ally && !reducedMotion.matches ? allyApproach(ally, slot) : null;
  const out = move ? ALLY_RUN.out : 0;
  const back = move ? ALLY_RUN.back : 0;
  const body = poses.reduce((sum, [, ms]) => sum + ms, 0);
  const frames = [...(move ? [['step', out]] : []), ...poses, ...(move ? [['step', back]] : [])];
  let until = now;
  allyPoses.set(key, frames.map(([pose, ms]) => ({ pose, until: (until += ms / rate) })));
  const timers = [setTimeout(onHit, (out + hitAt) / rate)];
  if (move) {
    ally.classList.add('running');
    ally.style.transition = `translate ${out / rate}ms cubic-bezier(.2, .8, .3, 1)`;
    ally.style.translate = `${move.x}px ${move.y}px`;
    timers.push(setTimeout(() => {
      ally.style.transition = `translate ${back / rate}ms ease-in-out`;
      ally.style.translate = '0px 0px';
    }, (out + body) / rate));
    timers.push(setTimeout(() => ally.classList.remove('running'), (out + body + back) / rate));
  } else if (ally) {
    ally.style.translate = '';
    ally.classList.remove('running');
  }
  allyRuns.set(key, { timers, until, skill });
}

function onAlly(event) {
  allyRun(event.slot, [['windup', 80], ['strike', 150], ['follow', 110]], { hitAt: 80, onHit: () => allyHit(event) });
}

function allyHit(event) {
  if (!reducedMotion.matches && state) {
    const effect = document.createElement('span');
    effect.className = `impact ally-hit fx-${contest(state).fx}`;
    effect.setAttribute('aria-hidden', 'true');
    const number = document.createElement('span');
    number.className = 'damage';
    number.textContent = fmt(event.amount);
    effect.append(number);
    $('rival').append(effect);
    setTimeout(() => effect.remove(), 590);
  }
}

// 동료 스킬: 공격 동작 + 이름 컷인 + 숫자
function mateFace(id) {
  const mate = COMPANIONS[id];
  const face = document.createElement('span');
  face.setAttribute('aria-hidden', 'true');
  if (mate.portrait) {
    face.className = 'portrait-figure';
    face.dataset.portrait = mate.portrait;
  } else {
    face.className = 'sprite';
    face.dataset.sprite = mate.sprite;
  }
  return face;
}

function onMate(event) {
  if (event.reflect) {
    floatText('rival', `반사 ${fmt(event.amount)}`, 'reflect');
    return;
  }
  const mate = COMPANIONS[event.id];
  const now = performance.now();
  const rate = state?.speed || 1;
  const inPlace = ['buff', 'heal'].includes(mate.skill.kind);
  const hit = () => {
    if (event.amount) floatText('rival', `${event.crit ? '크리티컬 ' : ''}${event.hits > 1 ? `${event.hits}연타 ` : ''}${fmt(event.amount)}`, 'skill');
  };
  allyRun(event.slot, [['skill-a', 180], ['skill-b', 500]], { dash: !inPlace, hitAt: 180, onHit: hit, skill: true });
  const arena = $('arena');
  arena.querySelectorAll('.mate-cutin').forEach((old, index, all) => { if (all.length - index > 1) old.remove(); });
  const cut = document.createElement('div');
  cut.className = `mate-cutin ${GRADES[mate.grade].tone} grade-${mate.grade}`;
  cut.setAttribute('role', 'status');
  const text = document.createElement('div');
  const style = document.createElement('small');
  style.textContent = `${mate.style} · ${mate.name}`;
  const name = document.createElement('b');
  name.textContent = mate.skill.name;
  text.append(style, name);
  cut.append(mateFace(event.id), text);
  arena.append(cut);
  setTimeout(() => cut.remove(), 1150);
  if (event.heal) floatText('player', `+${fmt(event.heal)}`, 'heal');
}

function onShard(event) { floatText('allies', `${COMPANIONS[event.id].name} 조각 +${event.amount}`, 'shard'); }

// ── 성장 탭 ──
function renderGrowth() {
  showSubtabs('growth-tabs', growthTab, 'view-training');
  if (growthTab === 'train') renderTraining();
  if (growthTab === 'skills') renderSkillsPanel();
  if (growthTab === 'tier') renderTierPanel();
  if (growthTab === 'academy') renderPrestige();
}

function renderSkillsPanel() {
  $('auto-actives').setAttribute('aria-checked', String(state.autoSkills));
  $('active-list').replaceChildren(...Object.entries(ACTIVE).map(([id, skill]) => {
    const open = skillUnlocked(state, id);
    const level = skillLevel(state, id);
    const maxed = level >= skill.lvCap;
    const cost = skillCost(state, id);
    const now = { pencil: `피해 ×${skillPower(state).toFixed(1)}`, cheer: `파워 ×${cheerMult(state).toFixed(2)}`, lunch: `회복 ${Math.round(lunchHeal(state) * 100)}%`, sprint: `속도 ×${sprintMult(state).toFixed(2)}` }[id];
    const detail = open ? `${skill.desc} · 지금 ${now} · 쿨타임 ${skill.cd}초${maxed ? '' : ` · 레벨마다 ${skill.lvBonus}`}` : `${skill.desc} · 쿨타임 ${skill.cd}초`;
    return row(ACTIVE_ICONS[id], skill.name, detail, !open ? '잠김' : maxed ? '최대' : '레벨업', () => {
      if (!trainSkill(state, id)) return;
      message(`${skill.name} Lv.${skillLevel(state, id)}`);
      commit();
    }, {
      tone: ACTIVE_TONES[id], level: open ? `Lv.${level}/${skill.lvCap}` : `${tierName(skill.tier)} 승급`,
      cost: open && !maxed ? { currency: 'coin', amount: fmt(cost), short: state.coins < cost } : null,
      disabled: !open || maxed || state.coins < cost,
      description: !open ? `${skill.name} 잠김` : maxed ? `${skill.name} 최대 레벨` : `${skill.name} 레벨업, 코인 ${fmt(cost)}개`,
    });
  }));
  const move = SKILLS[state.skillId];
  $('ultimate-card').replaceChildren(row(ICONS.skills[state.skillId] || move.glyph, move.name, move.detail, '사용 중', () => {}, {
    level: `기력 ${move.cost}`, tone: SKILL_TONES[state.skillId], kind: 'worn', disabled: true, description: `${move.name} 사용 중`,
  }));
}

function renderTierPanel() {
  const next = state.tier + 1;
  const best = bestProgress(state);
  const card = $('tier-card');
  const art = document.createElement('div');
  art.className = 'tier-art';
  art.append(svgIcon('#i-crown'));
  const copy = document.createElement('div');
  copy.className = 'tier-copy';
  const now = document.createElement('small');
  const mult = TIER_MULT ** state.tier;
  now.textContent = `지금 ${tierName(state.tier)} · 파워·체력 ×${mult >= 1000 ? fmt(mult) : mult.toFixed(2)}`;
  const title = document.createElement('b');
  title.textContent = `다음: ${tierName(next)}`;
  const needs = document.createElement('ul');
  needs.className = 'tier-needs';
  const need = (ok, text) => {
    const item = document.createElement('li');
    item.className = ok ? 'ok' : '';
    item.textContent = `${ok ? '✓' : '·'} ${text}`;
    needs.append(item);
  };
  need(best >= tierReq(next), `${QUEST_TEXT.best(tierReq(next))} (최고 기록)`);
  need(state.level >= tierLevel(next), `레벨 ${tierLevel(next)} (지금 ${state.level})`);
  copy.append(now, title, needs);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tier-button';
  button.textContent = '승급 심사';
  button.ariaLabel = `${tierName(next)} 승급 심사 도전`;
  button.disabled = !tierReady(state) || Boolean(state.dungeon);
  button.addEventListener('click', () => {
    if (!enterTrial(state)) return;
    combatEvent('enter', {});
    message(`${tierName(next)} 승급 심사 시작! 30초 안에 이기세요.`);
    selectView('battle');
    commit();
  });
  card.replaceChildren(art, copy, button);
  const list = [];
  for (let tier = Math.max(1, state.tier - 1); tier <= state.tier + 6; tier++) {
    const item = document.createElement('li');
    item.className = tier <= state.tier ? 'done' : tier === next ? 'next' : '';
    const name = document.createElement('b');
    name.textContent = tierName(tier);
    const info = document.createElement('small');
    const unlocks = [];
    const skill = Object.values(ACTIVE).find(entry => entry.tier === tier);
    if (skill) unlocks.push(`스킬 ${skill.name}`);
    info.textContent = `${QUEST_TEXT.best(tierReq(tier))} · Lv.${tierLevel(tier)}${unlocks.length ? ` · ${unlocks.join(' · ')}` : ''}`;
    item.append(name, info);
    list.push(item);
  }
  $('tier-list').replaceChildren(...list);
}

// ── 동료 ──
function mateCard(id) {
  const mate = COMPANIONS[id];
  const level = companionLevel(state, id);
  const card = document.createElement('article');
  card.className = `mate-card ${GRADES[mate.grade].tone} grade-${mate.grade}${level ? '' : ' unknown'}`;
  const figure = document.createElement('span');
  figure.className = 'mate-figure';
  figure.append(mateFace(id));
  const style = document.createElement('small');
  style.className = 'mate-style';
  style.textContent = mate.style;
  figure.append(style);
  const grade = document.createElement('small');
  grade.className = 'grade-badge';
  grade.textContent = mate.grade;
  grade.ariaLabel = GRADES[mate.grade].name;
  figure.append(grade);
  const name = document.createElement('b');
  name.textContent = level ? mate.name : '???';
  card.append(figure, name);
  if (level) card.append(starLine(id));
  return card;
}

// ★★★☆☆: S·A는 5칸, B 이하는 별 1개 고정
function starLine(id) {
  const max = GRADES[COMPANIONS[id].grade].maxStar;
  const level = companionLevel(state, id);
  const line = document.createElement('span');
  line.className = 'mate-stars';
  line.ariaLabel = `별 ${level}개`;
  line.textContent = '★'.repeat(level) + '☆'.repeat(max - level);
  return line;
}

function renderParty() {
  const slots = partySlots(state);
  setText('party-owned', `${Object.keys(state.companions).length} / ${Object.keys(COMPANIONS).length}명`);
  setText('party-summary', `출전 ${partySlots(state)}/${PARTY_MAX}칸 · 보유 효과 파워 +${Math.round(companionOwned(state) * 100)}% · 출전한 동료는 함께 싸우고 자기 무술 스킬을 쿨타임마다 써요. 코인으로 레벨업하면 레벨마다 +5%.`);
  $('party-slots').replaceChildren(...Array.from({ length: PARTY_MAX }, (_, slot) => slot).map(slot => {
    const box = document.createElement('div');
    const id = state.party[slot];
    const open = slot < slots;
    box.className = `party-slot${open ? '' : ' locked'}${id ? ' filled' : ''}`;
    box.dataset.slot = slot;
    const tag = document.createElement('small');
    tag.className = 'slot-tag';
    tag.textContent = `${slot + 1}번 · ${slot < 2 ? '전열' : '후열'}`;
    box.append(tag);
    if (!open || !id) {
      const note = document.createElement('span');
      note.textContent = open ? '빈 자리' : PARTY_UNLOCK_TEXT[slot];
      box.append(note);
      return box;
    }
    const card = mateCard(id);
    const power = document.createElement('em');
    const trained = allyTrainLevel(state, id);
    const cap = allyTrainCap(state, id);
    power.textContent = `Lv.${trained}/${cap} · 내 파워의 ${fmt(Math.round(allyPower(state, id) * 100))}%`;
    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'buy lvup';
    const upCost = allyTrainCost(state, id);
    if (trained >= cap) {
      up.textContent = '최대';
      up.disabled = true;
      up.ariaLabel = `${COMPANIONS[id].name} 최대 레벨`;
    } else {
      const caption = document.createElement('small');
      caption.textContent = '레벨업';
      up.append(caption, costLabel('coin', fmt(upCost)));
      up.classList.toggle('short', state.coins < upCost);
      up.disabled = state.coins < upCost;
      up.ariaLabel = `${COMPANIONS[id].name} 레벨업, 코인 ${fmt(upCost)}개`;
    }
    up.addEventListener('click', () => {
      if (!trainAlly(state, id)) return;
      message(`${COMPANIONS[id].name} Lv.${allyTrainLevel(state, id)}`);
      commit();
    });
    const out = document.createElement('button');
    out.type = 'button';
    out.textContent = '빼기';
    out.ariaLabel = `${COMPANIONS[id].name} 출전 빼기`;
    out.addEventListener('click', () => { setParty(state, slot, null); commit(); });
    const skill = document.createElement('p');
    skill.className = 'mate-skill';
    skill.textContent = `${COMPANIONS[id].skill.name} · ${COMPANIONS[id].skill.desc}`;
    card.append(power, skill, up, out);
    box.append(card);
    return box;
  }));
  $('mate-grid').replaceChildren(...Object.keys(COMPANIONS).map(id => {
    const mate = COMPANIONS[id];
    const level = companionLevel(state, id);
    const card = mateCard(id);
    const shards = mateShards(state, id);
    const need = starCost(state, id);
    const meter = document.createElement('span');
    meter.className = 'sticker-meter shard-meter';
    const fill = document.createElement('i');
    fill.style.width = `${need ? clamp(shards / need, 0, 1) * 100 : 100}%`;
    meter.append(fill);
    const count = document.createElement('small');
    count.className = 'shard-count';
    count.textContent = need ? `조각 ${fmt(shards)}/${fmt(need)}` : '최대 별';
    meter.append(count);
    const info = document.createElement('em');
    info.textContent = level ? `Lv.${allyTrainLevel(state, id)} · 보유 파워 +${(GRADES[mate.grade].owned * level * 100).toFixed(1)}%` : `조각 ${fmt(need)}개 모으면 영입`;
    const star = document.createElement('button');
    star.type = 'button';
    star.className = 'star-up';
    star.textContent = level ? '성급업' : '영입';
    star.hidden = !need || shards < need;
    star.ariaLabel = `${mate.name} ${level ? '성급업' : '영입'}, 조각 ${need}개`;
    star.addEventListener('click', () => {
      if (!starUp(state, id)) return;
      if (!state.party.some(Boolean)) state.party[0] = id;
      message(level ? `${mate.name} ★${companionLevel(state, id)}!` : `${mate.name} 영입!`);
      commit();
    });
    const button = document.createElement('button');
    button.type = 'button';
    const inParty = state.party.includes(id);
    button.textContent = inParty ? '출전 중' : '출전';
    button.disabled = !level || inParty;
    button.ariaLabel = `${mate.name} ${inParty ? '출전 중' : '출전'}`;
    button.addEventListener('click', () => {
      const free = state.party.slice(0, slots).findIndex(other => !other);
      setParty(state, free >= 0 ? free : slots - 1, id);
      message(`${mate.name} 출전!`);
      commit();
    });
    const skillLine = document.createElement('p');
    skillLine.className = 'mate-skill';
    skillLine.textContent = level ? `${mate.skill.name} · ${mate.skill.desc}` : `${mate.style} · ${mate.skill.name}`;
    card.append(meter, info, skillLine, star, button);
    return card;
  }));
}

function renderRecruitPanel() {
  setText('recruit-count', fmt(state.recruits));
  const buttons = [
    { count: 1, currency: 'recruit', label: '1회 모집', cost: 1 },
    { count: 10, currency: 'recruit', label: '10회 모집', cost: 10 },
    { count: 1, currency: 'gem', label: '1회 모집', cost: SHOP.recruit1.price },
    { count: 10, currency: 'gem', label: '10회 모집', cost: SHOP.recruit10.price, tag: '10% 할인' },
  ];
  $('recruit-buttons').replaceChildren(...buttons.map(({ count, currency, label, cost, tag }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `gacha-button ${currency === 'gem' ? 'gem' : 'ticket'}${count === 10 ? ' ten' : ''}`;
    const balance = currency === 'gem' ? state.gems : state.recruits;
    button.disabled = balance < cost;
    button.ariaLabel = `동료 ${label}, ${currency === 'gem' ? '보석' : '모집권'} ${fmt(cost)}`;
    const title = document.createElement('b');
    title.textContent = label;
    button.append(title, costLabel(currency, fmt(cost)));
    if (tag) {
      const badge = document.createElement('small');
      badge.className = 'deal';
      badge.textContent = tag;
      button.append(badge);
    }
    button.addEventListener('click', () => doRecruit(count, currency));
    return button;
  }));
  const empty = GRADE_ORDER.filter(grade => !Object.values(COMPANIONS).some(mate => mate.grade === grade));
  setText('recruit-rates', `확률 · ${GRADE_ORDER.map(grade => `${grade} ${GRADES[grade].weight}%`).join(' · ')} · 첫 모집 S급 확정 · 10회 모집 A급 이상 1번`
    + (empty.length ? ` · 아직 ${empty.join('·')}급 동료가 없어서 그 자리는 S 동료 조각으로 나와요` : ''));
}

function doRecruit(count, currency) {
  if (currency === 'gem') {
    const cost = count >= 10 ? SHOP.recruit10.price : SHOP.recruit1.price;
    if (state.gems < cost) return;
    state.gems -= cost;
  } else {
    if (state.recruits < count) return;
    state.recruits -= count;
  }
  const results = recruit(state, count);
  showRecruitResults(results, count, currency);
  commit();
}

function showRecruitResults(results, count, currency) {
  const dialog = $('gacha-dialog');
  const best = Math.min(...results.map(result => GRADE_ORDER.indexOf(result.fill ? 'C' : result.grade)));
  dialog.dataset.best = GRADES[GRADE_ORDER[best]].tone;
  setText('gacha-result-title', '동료 모집 결과');
  const fresh = results.filter(result => result.isNew).length;
  const shards = results.reduce((sum, result) => sum + (result.shards || 0), 0);
  const gems = results.reduce((sum, result) => sum + (result.gems || 0), 0);
  setText('gacha-result-note', [fresh && `새 동료 ${fresh}명`, shards && `조각 +${shards}`, gems && `보석 +${gems}`].filter(Boolean).join(' · '));
  $('gacha-results').classList.toggle('single', results.length === 1);
  $('gacha-results').replaceChildren(...results.map((result, index) => {
    const card = mateCard(result.id);
    card.classList.add('sticker-card');
    card.style.animationDelay = `${index * 70}ms`;
    const tag = document.createElement('span');
    tag.className = `new-tag${result.isNew ? '' : ' shard-tag'}`;
    tag.textContent = result.isNew ? 'NEW' : result.shards ? `조각 +${result.shards}` : `보석 +${result.gems}`;
    card.append(tag);
    if (result.fill) card.classList.add('fill');
    return card;
  }));
  const again = $('gacha-again');
  const cost = currency === 'gem' ? (count >= 10 ? SHOP.recruit10.price : SHOP.recruit1.price) : count;
  again.disabled = (currency === 'gem' ? state.gems : state.recruits) < cost;
  again.textContent = `한 번 더 (${currency === 'gem' ? `보석 ${fmt(cost)}` : `모집권 ${cost}`})`;
  again.onclick = () => doRecruit(count, currency);
  if (!dialog.open) dialog.showModal();
}

function renderGachaView() {
  showSubtabs('gacha-tabs', gachaTab, 'view-gacha');
  if (gachaTab === 'stickers') {
    setText('gacha-result-title', '뽑기 결과');
    $('gacha-again').onclick = null;
    renderGacha();
  } else renderRecruitPanel();
}

// ── 상점 ──
function renderShop() {
  setText('shop-gems', fmt(state.gems));
  $('shop-list').replaceChildren(...Object.entries(SHOP).map(([id, item]) => {
    const card = document.createElement('article');
    card.className = `shop-card ${id}`;
    const icon = document.createElement('span');
    icon.className = 'item-icon';
    icon.dataset.tone = SHOP_TONES[id];
    setIcon(icon, SHOP_ICONS[id]);
    const name = document.createElement('b');
    name.textContent = item.name;
    const desc = document.createElement('small');
    const left = shopLeft(state, id);
    desc.textContent = [item.desc, item.limit ? `오늘 ${Math.max(0, left)}/${item.limit}` : ''].filter(Boolean).join(' · ');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = item.price ? 'buy' : 'claim';
    button.disabled = left <= 0 || state.gems < item.price;
    button.ariaLabel = `${item.name} ${item.price ? `보석 ${item.price}` : '무료'}`;
    if (item.price) button.append(costLabel('gem', fmt(item.price)));
    else button.textContent = left > 0 ? '무료 받기' : '내일 다시';
    button.addEventListener('click', () => {
      const given = buyShop(state, id);
      if (!given) return;
      message(`${item.name} · ${giftLine(given)}`);
      commit();
    });
    if (item.tag) {
      const badge = document.createElement('em');
      badge.className = 'deal';
      badge.textContent = item.tag;
      card.append(badge);
    }
    card.append(icon, name, desc, button);
    return card;
  }));
  $('cash-list').replaceChildren(...Object.entries(CASH).map(([id, item]) => {
    const owned = !cashAvailable(state, id) || (id === 'pass' && state.premium.pass) || (id === 'adfree' && state.premium.adFree);
    const article = row('#i-gem', item.name, item.desc, owned ? '보유 중' : item.price, () => {}, {
      tone: 'purple', kind: owned ? 'worn' : 'cash', disabled: true, description: `${item.name} ${owned ? '보유 중' : `${item.price} 준비 중`}`,
      level: id === 'monthly' && state.premium.monthly ? `남은 ${state.premium.monthly}일` : null,
    });
    if (!owned) article.querySelector('button').append(Object.assign(document.createElement('small'), { textContent: '준비 중' }));
    return article;
  }));
}

// ── 우편 ──
function openMail() {
  renderMail();
  $('mail-dialog').showModal();
}

function renderMail() {
  setText('mail-note', state.mail.length ? `받을 우편 ${state.mail.length}통` : '받을 우편이 없어요.');
  $('mail-claim-all').disabled = !state.mail.length;
  $('mail-list').replaceChildren(...state.mail.map(mail => {
    const item = document.createElement('li');
    const copy = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = mail.title;
    const body = document.createElement('small');
    body.textContent = mail.body;
    copy.append(title, body, rewardChips(mail.reward, false));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'claim';
    button.textContent = '받기';
    button.ariaLabel = `${mail.title} 받기`;
    button.addEventListener('click', () => {
      message(`${mail.title} · ${giftLine(claimMail(state, mail.id))}`);
      renderMail();
      commit();
    });
    item.append(copy, button);
    return item;
  }));
}

// ── 성장 패스 ──
function renderPass() {
  const tiers = passTiers(state);
  setText('pass-note', `최고 기록 맵 ${PASS_STEP}개마다 한 칸 · 지금 ${tiers}칸${state.premium.pass ? ' · 프리미엄 보유' : ''}`);
  const ready = state.pass.free < tiers || (state.premium.pass && state.pass.premium < tiers);
  $('pass-claim').disabled = !ready;
  const start = Math.max(1, Math.min(state.pass.free, tiers) - 1);
  const items = [];
  for (let step = start; step < start + 7; step++) {
    const item = document.createElement('li');
    const open = step <= tiers;
    item.className = `pass-step${open ? ' open' : ''}${step <= state.pass.free ? ' claimed' : ''}`;
    const head = document.createElement('small');
    head.textContent = `${step}칸 · 맵 ${step * PASS_STEP}`;
    const free = document.createElement('div');
    free.className = 'pass-free';
    free.append(rewardChips(passReward(step, false), false));
    const premium = document.createElement('div');
    premium.className = `pass-premium${state.premium.pass ? '' : ' locked'}${step <= state.pass.premium ? ' claimed' : ''}`;
    premium.append(rewardChips(passReward(step, true), false));
    item.append(head, free, premium);
    items.push(item);
  }
  $('pass-track').replaceChildren(...items);
}

// ── 오프라인 보상 2배 ──
function offerOfflineDouble(coins) {
  offlineGain = coins;
  const button = $('offline-double');
  button.hidden = coins <= 0;
  button.disabled = state.gems < OFFLINE_DOUBLE_GEMS;
  button.textContent = `보석 ${OFFLINE_DOUBLE_GEMS}으로 코인 2배 (+${fmt(coins)})`;
}

function takeOfflineDouble() {
  if (!offlineGain || state.gems < OFFLINE_DOUBLE_GEMS) return;
  state.gems -= OFFLINE_DOUBLE_GEMS;
  state.coins += offlineGain;
  message(`코인 2배! +${fmt(offlineGain)}`);
  offlineGain = 0;
  $('offline-double').hidden = true;
  commit();
}

function bindMetaUI() {
  document.querySelectorAll('#growth-tabs [data-sub]').forEach(button => button.addEventListener('click', () => { growthTab = button.dataset.sub; render(); }));
  document.querySelectorAll('#gacha-tabs [data-sub]').forEach(button => button.addEventListener('click', () => { gachaTab = button.dataset.sub; render(); }));
  $('objective-button').addEventListener('click', questTap);
  $('map-button').addEventListener('click', () => selectView('grades'));
  $('shop-button').addEventListener('click', () => selectView('shop'));
  $('gem-button').addEventListener('click', () => selectView('shop'));
  $('mail-button').addEventListener('click', openMail);
  $('menu-button').addEventListener('click', () => $('settings-dialog').showModal());
  $('mail-claim-all').addEventListener('click', () => {
    const given = claimMail(state);
    message(`우편 모두 받기 · ${giftLine(given)}`);
    renderMail();
    commit();
  });
  $('pass-claim').addEventListener('click', () => {
    const given = claimPass(state);
    if (Object.keys(given).length) message(`성장 패스 · ${giftLine(given)}`);
    commit();
  });
  $('auto-train').addEventListener('click', () => {
    state.autoTrain = !state.autoTrain;
    message(state.autoTrain ? '자동 훈련을 켰어요. 코인이 모이면 알아서 올려요.' : '자동 훈련을 껐어요.');
    if (state.autoTrain) runAutoTrain(true);
    commit();
  });
  $('auto-actives').addEventListener('click', () => {
    state.autoSkills = !state.autoSkills;
    message(state.autoSkills ? '액티브 스킬을 자동으로 써요.' : '액티브 스킬을 직접 눌러 써요.');
    commit();
  });
  $('go-recruit').addEventListener('click', () => openView('gacha:recruit'));
  $('offline-double').addEventListener('click', takeOfflineDouble);
  for (const id of ['profile-button', 'help']) $(id).addEventListener('click', () => $('settings-dialog').close());
  bindTestTools();
}

// ── 테스트 도구: 주소에 ?test를 붙여 열면(설정 → 테스트 모드) 진짜 저장과 따로 놀면서 기능을 바로 확인한다 ──
function testPlaces() {
  const places = [['아카데미', 0]];
  REGIONS.forEach((name, index) => places.push([name, REGION_START[index]]));
  return places;
}

function testAct(action) {
  const ids = Object.keys(COMPANIONS);
  const acts = {
    mates: () => { for (const id of ids) state.companions[id] = Math.max(1, companionLevel(state, id)); return '동료 16명을 모두 받았어요'; },
    shards: () => { for (const id of ids) addShards(state, id, 100); return '모든 동료 조각 +100'; },
    stars: () => { for (const id of ids) state.companions[id] = GRADES[COMPANIONS[id].grade].maxStar; return '모든 동료 최대 별'; },
    slots: () => { state.test = { ...state.test, slots: !state.test?.slots }; return state.test.slots ? '출전 4칸 열림' : '출전 칸을 진행도 기준으로 되돌렸어요'; },
    party: () => {
      const owned = ids.filter(id => companionLevel(state, id)).sort((a, b) => allyPower(state, b) - allyPower(state, a));
      state.party = Array.from({ length: PARTY_MAX }, (_, slot) => (slot < partySlots(state) ? owned[slot] || null : null));
      return '센 동료부터 출전 칸을 채웠어요';
    },
    cast: () => { for (let slot = 0; slot < PARTY_MAX; slot++) state.cooldowns[`mate${slot}`] = 0; for (const id of Object.keys(ACTIVE)) state.cooldowns[id] = 0; return '동료·액티브 스킬 쿨타임 초기화'; },
    coins: () => { state.coins = Math.max(1e6, state.coins * 10); return `코인 ${fmt(state.coins)}`; },
    gems: () => { state.gems += 10000; state.recruits += 100; state.tickets += 100; state.keys = (state.keys || 0) + 10; return '보석 +10,000 · 모집권 +100 · 뽑기권 +100'; },
    level: () => { state.level += 10; state.hp = maxHp(state); return `레벨 ${state.level}`; },
    tier: () => { state.tier = Math.min(TIERS.length - 1, state.tier + 1); state.hp = maxHp(state); return `승급 · ${TIERS[state.tier]}`; },
    heal: () => { state.hp = maxHp(state); return '체력 회복'; },
    finish: () => { if (state.roundEnd || state.enemyHp <= 1) return '지금은 쓰러뜨릴 상대가 없어요'; state.enemyHp = 1; return '앞 상대 체력 1'; },
    boss: () => { state.roundEnd = null; state.farm = null; openFight(state, state.map, BOSS_WAVE, 0.4); return '이 경기장 보스로'; },
  };
  return acts[action]?.();
}

function testMove() {
  const cycle = Number($('test-place').value);
  const map = Number($('test-map').value);
  state.dungeon = null;
  state.roundEnd = null;
  state.farm = null;
  state.cycle = cycle;
  state.cleared = MAPS.map((_, index) => index < map);
  state.prestige.best = Math.max(state.prestige.best, cycle * MAPS.length + map);
  state.hp = maxHp(state);
  openFight(state, map, 0, 0.4);
  lastCycle = cycle; // 이동은 제패 축하 창 없이
  return `${stageLabel(cycle, map)}로 이동`;
}

function bindTestTools() {
  $('test-mode').addEventListener('click', () => {
    const url = new URL(location.href);
    if (TEST_MODE) url.searchParams.delete('test');
    else url.searchParams.set('test', '1');
    location.href = url.href;
  });
  setText('test-mode-label', TEST_MODE ? '테스트 모드 끝내기(진짜 저장으로)' : '테스트 모드(진짜 저장과 따로)');
  $('test-open').hidden = !TEST_MODE;
  $('test-badge').hidden = !TEST_MODE;
  if (!TEST_MODE) return;
  $('test-place').replaceChildren(...testPlaces().map(([name, cycle]) => new Option(name, cycle)));
  $('test-map').replaceChildren(...MAPS.map((_, map) => new Option(mapCode(map), map)));
  $('test-contest').replaceChildren(new Option('경기장대로', ''), ...Object.entries(CONTESTS).map(([id, game]) => new Option(game.name, id)));
  const open = () => {
    $('test-place').value = String(testPlaces().filter(([, cycle]) => cycle <= (state.cycle || 0)).at(-1)[1]);
    $('test-map').value = String(state.map);
    $('test-contest').value = state.test?.contest || '';
    $('settings-dialog').close();
    $('test-dialog').showModal();
  };
  $('test-open').addEventListener('click', open);
  $('test-badge').addEventListener('click', open);
  $('test-dialog').addEventListener('click', event => {
    const button = event.target.closest('[data-test]');
    if (!button) return;
    const note = button.dataset.test === 'move' ? testMove() : testAct(button.dataset.test);
    if (note) message(`테스트 · ${note}`);
    setText('test-note', note || '');
    commit();
  });
  $('test-contest').addEventListener('change', () => {
    state.test = { ...state.test, contest: $('test-contest').value || undefined };
    renderedContest = '';
    message(state.test.contest ? `테스트 · 종목 고정: ${CONTESTS[state.test.contest].name}` : '테스트 · 종목을 경기장대로');
    commit();
  });
}
