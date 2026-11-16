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
const QUEST_TEXT = {
  best: n => `${Math.floor((n - 1) / MAPS.length) + 1}년차 ${mapCode((n - 1) % MAPS.length)} 클리어`,
  power: n => `힘 훈련 Lv.${n}`,
  health: n => `체력 훈련 Lv.${n}`,
  level: n => `레벨 ${n} 달성`,
  pulls: n => `스티커 ${n}번 뽑기`,
  recruits: n => `동료 ${n}번 모집`,
  dungeons: n => `던전 ${n}번 하기`,
  tier: n => `${tierName(n)} 승급`,
  transfer: n => `전학 ${n}번 가기`,
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
      icon.append(svgIcon(ACTIVE_ICONS[id]));
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
  if (event.id === 'pencil' && !reducedMotion.matches) {
    flashHit('rival', { move: 'rush', amount: event.amount, lucky: false });
    packAct('hit', 0, 260);
  }
  playSound(event.id === 'lunch' ? 'win' : 'bell');
}

// ── 동료 표시(주인공 뒤) ──
const ALLY_SLOTS = [{ x: 0, y: 0, s: 0.82 }, { x: 34, y: 30, s: 0.7 }, { x: 0, y: 46, s: 0.66 }];

function renderAllies() {
  const ids = state.party.slice(0, partySlots(state)).map((id, slot) => (id ? `${slot}:${id}` : '')).filter(Boolean);
  const key = ids.join('|');
  const box = $('allies');
  if (key !== renderedAllies) {
    renderedAllies = key;
    box.replaceChildren(...ids.map((entry, index) => {
      const [slot, id] = entry.split(':');
      const place = ALLY_SLOTS[index];
      const ally = document.createElement('span');
      ally.className = 'ally';
      ally.dataset.slot = slot;
      ally.style.setProperty('--x', `${place.x}px`);
      ally.style.setProperty('--y', `${place.y}px`);
      ally.style.setProperty('--s', place.s);
      ally.style.zIndex = 3 - index;
      const sprite = document.createElement('span');
      sprite.className = 'sprite';
      sprite.dataset.sprite = id;
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

function onAlly(event) {
  const now = performance.now();
  const rate = state?.speed || 1;
  allyPoses.set(String(event.slot), [{ pose: 'windup', until: now + 80 / rate }, { pose: 'strike', until: now + 260 / rate }]);
  if (!reducedMotion.matches) {
    const effect = document.createElement('span');
    effect.className = 'impact ally-hit';
    effect.setAttribute('aria-hidden', 'true');
    const number = document.createElement('span');
    number.className = 'damage';
    number.textContent = fmt(event.amount);
    effect.append(number);
    $('rival').append(effect);
    setTimeout(() => effect.remove(), 590);
  }
}

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
    return row(ACTIVE_ICONS[id], skill.name, `${skill.desc} · 쿨타임 ${skill.cd}초`, open ? '사용' : '잠김', () => {
      if (castSkill(state, id, combatEvent)) commit();
    }, { tone: ACTIVE_TONES[id], level: open ? '해금' : `${tierName(skill.tier)} 승급`, kind: open ? 'equip' : '', disabled: !open, description: `${skill.name} ${open ? '사용' : '잠김'}` });
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
  now.textContent = `지금 ${tierName(state.tier)} · 공격력·체력 ×${mult >= 1000 ? fmt(mult) : mult.toFixed(2)}`;
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
  button.textContent = '승급 시험';
  button.ariaLabel = `${tierName(next)} 승급 시험 도전`;
  button.disabled = !tierReady(state) || Boolean(state.dungeon);
  button.addEventListener('click', () => {
    if (!enterTrial(state)) return;
    combatEvent('enter', {});
    message(`${tierName(next)} 승급 시험 시작! 30초 안에 이기세요.`);
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
    if (tier === 2 || tier === 4) unlocks.push('동료 칸 +1');
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
  card.className = `mate-card ${mate.rarity}${level ? '' : ' unknown'}`;
  const figure = document.createElement('span');
  figure.className = 'mate-figure';
  const sprite = document.createElement('span');
  sprite.className = 'sprite';
  sprite.dataset.sprite = id;
  figure.append(sprite);
  const rarity = document.createElement('small');
  rarity.className = 'rarity';
  rarity.textContent = RARITIES[mate.rarity].name;
  const name = document.createElement('b');
  name.textContent = level ? mate.name : '???';
  card.append(figure, rarity, name);
  return card;
}

function renderParty() {
  const slots = partySlots(state);
  setText('party-owned', `${Object.keys(state.companions).length} / ${Object.keys(COMPANIONS).length}명`);
  setText('party-summary', `보유 효과 공격력 +${Math.round(companionOwned(state) * 100)}% · 출전한 동료는 ${ALLY_INTERVAL}초마다 공격해요.`);
  $('party-slots').replaceChildren(...[0, 1, 2].map(slot => {
    const box = document.createElement('div');
    const id = state.party[slot];
    const open = slot < slots;
    box.className = `party-slot${open ? '' : ' locked'}${id ? ' filled' : ''}`;
    if (!open) {
      box.textContent = `${tierName(slot === 1 ? 2 : 4)} 승급 때 열림`;
      return box;
    }
    if (!id) {
      box.textContent = '빈 자리';
      return box;
    }
    const card = mateCard(id);
    const power = document.createElement('em');
    power.textContent = `Lv.${companionLevel(state, id)} · 공격력의 ${Math.round(allyPower(state, id) * 100)}%`;
    const out = document.createElement('button');
    out.type = 'button';
    out.textContent = '빼기';
    out.ariaLabel = `${COMPANIONS[id].name} 출전 빼기`;
    out.addEventListener('click', () => { setParty(state, slot, null); commit(); });
    card.append(power, out);
    box.append(card);
    return box;
  }));
  $('mate-grid').replaceChildren(...Object.keys(COMPANIONS).map(id => {
    const mate = COMPANIONS[id];
    const level = companionLevel(state, id);
    const card = mateCard(id);
    const copies = state.companions[id] || 0;
    const prev = level ? level * (level + 1) / 2 : 0;
    const nextNeed = (level + 1) * (level + 2) / 2;
    const meter = document.createElement('span');
    meter.className = 'sticker-meter';
    const fill = document.createElement('i');
    fill.style.width = `${level ? clamp((copies - prev) / (nextNeed - prev), 0, 1) * 100 : 0}%`;
    meter.append(fill);
    const info = document.createElement('em');
    info.textContent = level ? `Lv.${level} · 보유 공격력 +${(ALLY_OWNED[mate.rarity] * level * 100).toFixed(1)}%` : '미보유';
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
    card.append(meter, info, button);
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
  setText('recruit-rates', `확률 · ${Object.values(RARITIES).map(rarity => `${rarity.name} ${rarity.weight}%`).join(' · ')}`);
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
  const best = Math.max(...results.map(result => RARITY_ORDER.indexOf(result.rarity)));
  dialog.dataset.best = RARITY_ORDER[best];
  setText('gacha-result-title', '동료 모집 결과');
  const fresh = results.filter(result => result.isNew).length;
  setText('gacha-result-note', [fresh && `새 동료 ${fresh}명`, results.some(result => result.leveled) && '레벨 업!'].filter(Boolean).join(' · ') || '친구들과 더 친해졌어요.');
  $('gacha-results').classList.toggle('single', results.length === 1);
  $('gacha-results').replaceChildren(...results.map((result, index) => {
    const card = mateCard(result.id);
    card.classList.add('sticker-card');
    card.style.animationDelay = `${index * 70}ms`;
    if (result.isNew || result.leveled) {
      const tag = document.createElement('span');
      tag.className = 'new-tag';
      tag.textContent = result.isNew ? 'NEW' : `Lv.${result.level}`;
      card.append(tag);
    }
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
  $('auto-actives').addEventListener('click', () => {
    state.autoSkills = !state.autoSkills;
    message(state.autoSkills ? '액티브 스킬을 자동으로 써요.' : '액티브 스킬을 직접 눌러 써요.');
    commit();
  });
  $('go-recruit').addEventListener('click', () => openView('gacha:recruit'));
  $('offline-double').addEventListener('click', takeOfflineDouble);
  for (const id of ['profile-button', 'help']) $(id).addEventListener('click', () => $('settings-dialog').close());
}
