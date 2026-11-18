'use strict';

function liveText(tag, text, className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}
function liveButton(label, action, disabled = false, className = '') {
  const button = liveText('button', label, className);
  button.type = 'button';
  button.disabled = disabled;
  button.addEventListener('click', action);
  return button;
}
function liveCard(id, name, subtitle) {
  const card = liveText('article', '', 'live-card');
  card.id = id;
  card.append(liveText('h3', name), liveText('p', subtitle));
  return card;
}
function liveActions(...buttons) {
  const actions = liveText('div', '', 'live-actions');
  actions.append(...buttons);
  return actions;
}
function launchChallenge(start, label) {
  refreshDay(state, gameDay(state));
  if (!start()) return;
  combatEvent('enter', {});
  $('panel').scrollTop = 0;
  message(label);
  commit();
}
function specialStageLabel(state) {
  const { id, level, practice } = state.dungeon;
  if (id === 'trial') return `승급 심사 · ${tierName(level)}`;
  if (id === 'cup') return `주간 전국대회 · ${cupInfo(state).rule.name}`;
  if (id === 'tower') return `도장 ${level}층 · ${challengeRule(state).name}`;
  if (id === 'season') return `시즌 ${level}주 · ${challengeRule(state).name}`;
  return practice ? '30초 기록 연습' : `던전 · Lv.${level}`;
}

let chosenTowerFloor = 0;
function towerCard() {
  const open = towerUnlocked(state);
  const best = state.tower.best;
  const next = Math.min(best + 1, TOWER.floors);
  const card = liveCard('tower-card', TOWER.name, open ? `${best}/${TOWER.floors}층 클리어 · 열쇠 없이 도전` : '1-3 학년 대표를 이기면 열려요.');
  if (!open) return card;
  const select = liveText('select', '', 'live-select');
  select.ariaLabel = '도장 도전층 고르기';
  for (let level = next; level >= 1; level--) {
    const label = level > best ? '첫 도전' : '클리어';
    select.add(new Option(`${level}층 · ${label}`, level));
  }
  select.value = Math.min(chosenTowerFloor || next, next);
  const tip = liveText('p', '', 'live-rule');
  const reward = liveText('p', '');
  const button = liveButton('도전', () => {
    const level = Number(select.value);
    chosenTowerFloor = 0;
    launchChallenge(() => enterTower(state, level), `도장 ${level}층 시작 · ${CHALLENGE_RULES[towerRule(level)].name}`);
  }, Boolean(state.dungeon), 'primary');
  const showRule = () => {
    const level = Number(select.value);
    const rule = CHALLENGE_RULES[towerRule(level)];
    tip.textContent = `${rule.name} · ${rule.tip}`;
    reward.replaceChildren(level <= best ? '첫 승리 보상 수령 완료' : '첫 승리 보상');
    if (level > best) reward.append(' ', rewardChips(towerReward(level), false));
    button.textContent = `${level}층 도전`;
  };
  select.addEventListener('change', () => {
    chosenTowerFloor = Number(select.value);
    showRule();
  });
  showRule();
  card.append(tip, reward, liveActions(select, button));
  return card;
}

function shortGameDate(day) {
  const date = day.split('-').slice(1).map(Number);
  return date.join('/');
}
function seasonCard() {
  const day = gameDay(state);
  const calendar = seasonList(state);
  if (!calendar.length) return null;
  const active = activeSeason(state, day);
  const upcoming = calendar.find(entry => day < entry.starts);
  const claiming = Object.values(state.seasons).filter(entry => entry.ends <= day && day < entry.claimUntil);
  const card = liveCard('season-card', active?.name || '전국 격투 시즌', active
    ? `대결 ~${shortGameDate(active.ends)} 0시 · 수령 ~${shortGameDate(active.claimUntil)} 0시`
    : upcoming ? `다음 시즌 ${upcoming.name} · ${shortGameDate(upcoming.starts)} 개막` : '지난 시즌 기록을 볼 수 있어요.');
  if (active) {
    const match = seasonMatch(active, day);
    const rule = CHALLENGE_RULES[active.matches[match]];
    const points = active.points || 0;
    const progress = liveText('progress', '', 'live-progress');
    progress.max = active.tiers.at(-1).points;
    progress.value = Math.min(points, progress.max);
    progress.ariaLabel = '시즌 점수';
    card.append(liveText('p', `${points}/${progress.max}점 · ${match + 1}주 차 ${rule.name}`), progress, liveText('p', rule.tip, 'live-rule'));
    const tiers = liveText('ul', '', 'live-tiers');
    for (const [index, tier] of active.tiers.entries()) {
      const item = liveText('li', `${tier.points}점${active.claimed?.includes(index) ? ' · 수령 완료' : ''}`);
      item.append(rewardChips(tier.reward, false));
      tiers.append(item);
    }
    card.append(tiers);
    const entry = liveButton(cupUnlocked(state) ? '이번 주 챔피언 도전' : '1-3 승리 후 해금', () => {
      launchChallenge(() => enterSeasonFight(state), `${rule.name} 챔피언 도전!`);
    }, !cupUnlocked(state) || Boolean(state.dungeon), 'primary');
    card.append(liveActions(entry, seasonClaimButton(active)));
  }
  for (const entry of claiming) card.append(liveActions(liveText('span', `${entry.name} · ${entry.points}점`), seasonClaimButton(entry)));
  const history = Object.values(state.seasons).filter(entry => day >= entry.claimUntil).reverse();
  if (history.length) {
    const details = liveText('details', '', 'live-history');
    details.append(liveText('summary', '지난 시즌 기록'));
    for (const entry of history) details.append(liveText('p', `${entry.name} · ${entry.points}점 · 보상 ${entry.claimed.length}/${entry.tiers.length}개`));
    card.append(details);
  }
  return card;
}
function seasonClaimButton(entry) {
  const ready = entry.tiers.some((tier, index) => (entry.points || 0) >= tier.points && !entry.claimed?.includes(index));
  return liveButton('시즌 보상 받기', () => {
    refreshDay(state, gameDay(state));
    const reward = claimSeason(state, entry.id);
    if (!reward) return;
    message(`${entry.name} · ${giftLine(reward)}`);
    commit();
  }, !ready);
}
function renderLiveBattle() {
  const list = $('challenge-list');
  const fingerprint = JSON.stringify([towerUnlocked(state), state.tower.best, state.daily?.date, Boolean(state.dungeon), cupUnlocked(state), state.seasons, activeSeason(state)?.version]);
  if (list.dataset.model === fingerprint) return;
  list.dataset.model = fingerprint;
  list.replaceChildren(towerCard());
  const season = seasonCard();
  if (season) list.append(season);
}

function presetCard() {
  const card = liveCard('preset-card', '편성 저장', '도장·시즌·기록전 연습에는 저장한 도전 편성을 불러와요.');
  for (const [id, label] of Object.entries(PARTY_PRESETS)) {
    const preset = state.presets[id];
    card.append(liveActions(
      liveText('span', label),
      liveButton(`${label} 저장`, () => {
        savePartyPreset(state, id);
        message(`${label} 편성을 저장했어요.`);
        commit();
      }, id === 'main' && Boolean(state.dungeon)),
      liveButton(`${label} 불러오기`, () => {
        if (!applyPartyPreset(state, id)) return;
        message(`${label} 편성을 불러왔어요.`);
        commit();
      }, !preset),
    ));
    if (preset) {
      const names = preset.party.filter(Boolean).map(mate => COMPANIONS[mate].name);
      card.append(liveText('p', [...names, SKILLS[preset.skillId].name].join(' · ')));
    }
  }
  return card;
}
let dispatchSelection = { mate: '', hours: 8 };
function dispatchCard() {
  const task = state.dispatch;
  const available = dispatchMates(state);
  const card = liveCard('dispatch-card', '동료 원정', '비출전 동료를 보내면 그 동료의 조각을 모아 와요.');
  if (task) {
    const name = COMPANIONS[task.mate].name;
    const minutes = Math.ceil(Math.max(0, task.ready - Date.now()) / 60000);
    card.append(liveText('p', minutes ? `${name} · 완료까지 ${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${name} · 원정 완료`));
    card.append(liveActions(liveButton('원정 보상 받기', () => {
      const result = finishDispatch(state);
      if (!result) return;
      message(`원정 완료 · ${result.picks ? '조각 선택권' : COMPANIONS[result.id].name + ' 조각'} +${result.shards}`);
      commit();
    }, minutes > 0, 'primary')));
    return card;
  }
  if (!available.length) {
    card.append(liveText('p', '원정에 보낼 비출전 동료가 필요해요.'));
    return card;
  }
  const mate = liveText('select', '', 'live-select');
  mate.ariaLabel = '원정에 보낼 동료';
  for (const id of available) mate.add(new Option(COMPANIONS[id].name, id));
  mate.value = available.includes(dispatchSelection.mate) ? dispatchSelection.mate : available[0];
  const hours = liveText('select', '', 'live-select');
  hours.ariaLabel = '원정 시간';
  for (const value of DISPATCH_HOURS) hours.add(new Option(`${value}시간 · 조각 ${DISPATCH_SHARDS[value]}개`, value));
  hours.value = dispatchSelection.hours;
  const remember = () => { dispatchSelection = { mate: mate.value, hours: Number(hours.value) }; };
  mate.addEventListener('change', remember);
  hours.addEventListener('change', remember);
  card.append(liveActions(mate, hours, liveButton('원정 보내기', () => {
    remember();
    if (!startDispatch(state, dispatchSelection.mate, dispatchSelection.hours)) return;
    message(`${COMPANIONS[dispatchSelection.mate].name} 원정 출발!`);
    commit();
  }, Boolean(state.dungeon), 'primary')));
  return card;
}
function collectionCard() {
  const card = liveCard('collection-card', '무술 동료 도감', '같은 계열의 동료를 영입하고 코인으로 Lv.5까지 훈련하세요.');
  for (const [family, info] of Object.entries(MATE_FAMILIES)) {
    const { owned, trained, needed } = collectionProgress(state, family);
    const claimed = state.collection.includes(family);
    const button = liveButton(claimed ? '수령 완료' : `${info.name} 보상 받기`, () => {
      const reward = claimCollection(state, family);
      if (!reward) return;
      message(giftLine(reward));
      commit();
    }, claimed || trained < needed);
    card.append(liveActions(liveText('span', `${info.name} · 영입 ${owned}/${info.mates.length} · Lv.5 ${trained}/${needed}`), button));
  }
  return card;
}
function renderLiveParty() {
  const list = $('roster-projects');
  const minutes = state.dispatch ? Math.max(0, Math.ceil((state.dispatch.ready - Date.now()) / 60000)) : null;
  const fingerprint = JSON.stringify([state.party, state.presets, state.companions, state.allyLv, state.dispatch, minutes, state.collection, Boolean(state.dungeon)]);
  if (list.dataset.model === fingerprint) return;
  list.dataset.model = fingerprint;
  list.replaceChildren(presetCard(), dispatchCard(), collectionCard());
}

function backupDownload() {
  const time = Date.now();
  const file = new Blob([JSON.stringify({ version: 5, when: time, state })], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `haesol-save-${todayKey(new Date(time))}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function restoreBackup(file) {
  if (!file) return;
  try {
    const snapshot = JSON.parse(await file.text());
    const restored = restore(snapshot);
    if (!restored?.profile) throw new Error('Invalid save');
    const when = Math.min(Date.now(), snapshot.when);
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 5, when, state: restored }));
    editingProfile = true;
    location.reload();
  } catch {
    window.alert('해솔 저장 파일을 불러올 수 없어요.');
  }
}
function bindLiveUI() {
  $('save-export').addEventListener('click', backupDownload);
  for (const id of ['save-import', 'enroll-import']) $(id)?.addEventListener('click', () => $('save-file').click());
  $('save-file').addEventListener('change', event => {
    const file = event.currentTarget.files[0];
    event.currentTarget.value = '';
    void restoreBackup(file);
  });
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    fetch('season-calendar.json', { cache: 'no-cache' }).then(response => response.ok ? response.json() : null)
      .then(entries => {
        if (setSeasonCalendar(entries)) {
          $('challenge-list').dataset.model = '';
          render();
        }
      }).catch(() => {});
  }
}
