'use strict';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let state;
let openedAt = Date.now();
let lastSavedAt = openedAt;
let currentView = 'battle';
let previousModel = '';
let renderedRound = '';
let toastTimeout;
let storageWorks = true;
let editingProfile = false;
let initialOffline = 0;
let expandedGrades = new Set();
let gearFilter = 'all';
const poses = { player: [], rival: [] };
let audio;
let buyMode = 1;
let holdTimer = null;
let holdRepeat = null;
let lastLevel = null;
let lastPull = null;
const popupQueue = [];

const ICONS = {
  training: { power: '#i-power', health: '#i-heart', speed: '#i-bolt', focus: '#i-target' },
  classes: { gym: '#st-whistle', math: '#i-plus', music: '#i-note' },
  slots: { top: '#i-shirt', bottom: '#i-pants', bag: '#i-bag', shoes: '#i-shoe', accessory: '#i-gem' },
  skills: { rush: '#i-bolt', bell: '#i-bell' },
  missions: { wins: '#i-swords', clears: '#i-flag', closet: '#i-shirt' },
  daily: { wins: '#i-swords', trains: '#i-dumbbell', pulls: '#i-ticket', snacks: '#i-milk', dungeons: '#i-key', all: '#i-star' },
  dungeons: { coin: '#i-milk', ticket: '#st-notebook', badge: '#i-run' },
};
const DAILY_TONES = { wins: 'red', trains: 'blue', pulls: 'pink', snacks: 'yellow', dungeons: 'teal', all: '' };
const DUNGEON_TONES = { coin: 'yellow', ticket: 'pink', badge: 'blue' };

function svgIcon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', id);
  svg.append(use);
  return svg;
}

function setIcon(element, glyph) {
  if (element.dataset.glyph === glyph) return;
  element.dataset.glyph = glyph;
  if (glyph.startsWith('#')) element.replaceChildren(svgIcon(glyph));
  else element.textContent = glyph;
}

function rewardText({ coins = 0, tickets = 0, patches = 0 }) {
  return [coins && `코인 +${fmt(coins)}`, tickets && `뽑기권 +${tickets}`, patches && `천 조각 +${patches}`].filter(Boolean).join(' · ');
}

function anyDialogOpen() { return [...document.querySelectorAll('dialog')].some(dialog => dialog.open); }
function queuePopup(open) {
  if (anyDialogOpen()) popupQueue.push(open);
  else open();
}

const DAON_TEXT = {
  ready: ['반장 다온', '방어 뒤 강한 반격을 준비해요.'],
  guard: ['방어 자세', '보통 동작 효과가 줄어요 · 종소리로 방어 풀기'],
  counter: ['반격 예고', '종소리로 반격을 끊을 수 있어요.'],
  open: ['반격 뒤 빈틈', '쏜살 돌진이 더 강해져요.'],
  broken: ['방어 풀기', '반격 취소 · 빈틈이 커져요'],
};

function message(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 2600);
}

function showDialog(title, paragraphs, icon) {
  $('dialog-title').textContent = title;
  setIcon($('dialog-icon'), icon);
  $('dialog-content').classList.remove('reward-lines');
  $('offline-double').hidden = true;
  $('dialog-content').replaceChildren(...paragraphs.map(text => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));
  if (!$('dialog').open) $('dialog').showModal();
}

function unlockAudio() {
  if (!state?.sound || !window.AudioContext) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}

function playSound(kind) {
  if (!state.sound || audio?.state !== 'running' || document.hidden) return;
  const profiles = {
    hit: [[190, 83, 0, 0.095, 0.08, 'triangle']],
    guard: [[450, 204, 0, 0.15, 0.045, 'square']],
    rush: [[310, 91, 0, 0.18, 0.09, 'triangle'], [530, 190, 0.035, 0.14, 0.03, 'triangle']],
    bell: [[790, 696, 0, 0.29, 0.062, 'sine'], [1224, 1010, 0.047, 0.32, 0.04, 'sine']],
    counter: [[139, 51, 0, 0.21, 0.105, 'triangle']],
    win: [[523, 523, 0, 0.14, 0.038, 'sine'], [659, 659, 0.085, 0.16, 0.038, 'sine'], [784, 784, 0.17, 0.24, 0.04, 'sine']],
  };
  const now = audio.currentTime;
  for (const [from, to, offset, duration, volume, wave] of profiles[kind]) {
    const start = now + offset;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }
}

function setPoses(side, frames) {
  let until = performance.now();
  const rate = state?.speed || 1;
  poses[side] = frames.map(([pose, ms]) => ({ pose, until: (until += ms / rate) }));
}

function flashHit(target, detail) {
  const effect = document.createElement('span');
  const emphasis = detail.move !== 'attack' || detail.breaks;
  const game = contest(state);
  effect.className = `impact fx-${game.fx}${detail.blocked ? ' blocked' : ''}${emphasis || detail.lucky ? ' strong' : ''}${detail.breaks ? ' break' : ''}${detail.lucky ? ' lucky' : ''}`;
  effect.setAttribute('aria-hidden', 'true');
  const number = document.createElement('span');
  number.className = 'damage';
  number.textContent = detail.breaks ? `방어 풀기 · ${fmt(detail.amount)}` : detail.blocked ? `방어 · ${fmt(detail.amount)}` : detail.lucky ? `크리티컬! ${fmt(detail.amount)}` : `−${fmt(detail.amount)}`;
  const sound = document.createElement('span');
  sound.className = 'onomatopoeia';
  sound.textContent = game.sound;
  effect.append(number, sound);
  $(target).append(effect);
  setTimeout(() => effect.remove(), 640);
  if (game.prop) throwProp(game.prop, target);
}

function combatEvent(type, event) {
  if (type === 'enter') {
    poses.player = [];
    poses.rival = [];
    packPoses.clear();
    if (state && !state.dungeon && state.wave > 0 && state.wave <= BOSS_WAVE && !reducedMotion.matches) setPoses('player', [['run', 520]]);
    return;
  }
  if (type === 'windup') {
    const launch = event.side === 'player' ? 'run' : 'launch';
    setPoses(event.side, [['windup', 75], [launch, event.windup * 1000 - 55]]);
  }
  if (type === 'boss' && event.phase === 'counter') setPoses('rival', [['windup', 505], ['launch', 180]]);
  if (type === 'impact') {
    const target = event.side === 'player' ? 'rival' : 'player';
    setPoses(event.side, [['strike', 110], ['follow', 100]]);
    setPoses(target, [[event.blocked ? 'guard' : 'hit', event.breaks ? 240 : 160]]);
    if (!reducedMotion.matches) flashHit(target, event);
    if (event.side === 'rival' && aliveBehind(state)) packAct('strike', 1 + Math.floor(Math.random() * 2), 260);
    if (event.side === 'player' && event.move !== 'attack' && event.move !== 'crit') packAct('hit', 0, 220);
    playSound(event.blocked ? 'guard' : ['rush', 'bell', 'counter'].includes(event.move) ? event.move : 'hit');
  }
  if (type === 'finish' && event.result === 'win' && (event.boss || event.reward)) playSound('win');
  if (type === 'finish' && event.result === 'win') flyCoins(event.boss ? 6 : 2);
  if (type === 'kill') flyCoins(1);
  if (type === 'enter') renderedContest = '';
  if (type === 'ally') onAlly(event);
  if (type === 'active') onActive(event);
  if (type === 'splash' && !reducedMotion.matches) {
    $('pack').classList.remove('hit');
    void $('pack').offsetWidth;
    $('pack').classList.add('hit');
  }
}

function flyCoins(count) {
  if (reducedMotion.matches || document.visibilityState !== 'visible') return;
  const game = $('game');
  const base = game.getBoundingClientRect();
  const from = $('rival').getBoundingClientRect();
  const wallet = document.querySelector('.money .cur.coin');
  const to = wallet.getBoundingClientRect();
  for (let index = 0; index < count; index++) {
    const coin = document.createElement('i');
    coin.className = 'cur coin fly-coin';
    coin.ariaHidden = 'true';
    const startX = from.left + from.width / 2 - base.left + (Math.random() - 0.5) * 60;
    const startY = from.top + from.height * 0.6 - base.top + (Math.random() - 0.5) * 30;
    coin.style.left = `${startX}px`;
    coin.style.top = `${startY}px`;
    game.append(coin);
    const hop = (Math.random() - 0.5) * 50;
    const animation = coin.animate([
      { transform: 'translate(0, 0) scale(.5)', opacity: 0 },
      { transform: `translate(${hop}px, -34px) scale(1.15)`, opacity: 1, offset: 0.28 },
      { transform: `translate(${to.left - base.left - startX}px, ${to.top - base.top - startY}px) scale(.85)`, opacity: 1 },
    ], { duration: 700, delay: index * 70, easing: 'cubic-bezier(.45, 0, .7, .4)', fill: 'backwards' });
    animation.onfinish = () => {
      coin.remove();
      const money = wallet.closest('.money');
      money.classList.remove('bump');
      void money.offsetWidth;
      money.classList.add('bump');
    };
  }
}

function renderMotion() {
  const now = performance.now();
  const phase = isDaon(state) ? state.bossPhase : '';
  for (const side of ['player', 'rival']) {
    const action = poses[side].find(entry => entry.until > now)?.pose;
    let resting = 'ready';
    if (state.roundEnd) {
      const won = state.roundEnd.result === 'win';
      resting = side === 'player' ? (won ? 'victory' : 'down') : (won ? 'down' : 'victory');
    } else if (state.pause > 0) resting = 'step';
    else if (side === 'rival' && phase === 'guard') resting = 'guard';
    else if (side === 'rival' && phase === 'counter') resting = 'windup';
    else if (side === 'rival' && (phase === 'open' || phase === 'broken')) resting = 'open';
    else if (side === 'player' ? state.playerMove : state.enemyMove) resting = 'windup';
    const sprite = $(`${side}-sprite`);
    const next = action || resting;
    if (sprite.dataset.pose !== next) sprite.dataset.pose = next;
  }
}

function bar(fill, parent, amount, total) {
  const progress = clamp(amount / total * 100, 0, 100);
  fill.style.width = `${progress}%`;
  parent.setAttribute('aria-valuenow', Math.round(progress));
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 5, when: openedAt, state }));
    storageWorks = true;
  } catch {
    storageWorks = false;
  }
  lastSavedAt = openedAt;
  $('saved').textContent = storageWorks ? '자동 저장' : '저장 제한됨';
  $('saved').classList.toggle('error', !storageWorks);
}

function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); }
  catch { return null; }
}

function displayOffline(seconds) {
  const limit = offlineLimit(state);
  if (seconds >= limit) return `최대 ${limit / 3600}시간`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}시간 ${Math.floor(seconds % 3600 / 60)}분`;
  return seconds >= 60 ? `${fmt(seconds / 60)}분` : `${fmt(seconds)}초`;
}

function catchUp(seconds) {
  const adjusted = Math.min(seconds, offlineLimit(state));
  const before = { wins: state.wins, coins: state.coins, level: state.level, bag: state.bag.length, tickets: state.tickets };
  const speed = state.speed;
  state.speed = 1;
  simulate(state, adjusted, null);
  state.speed = speed;
  const wins = state.wins - before.wins;
  if (wins === 0 || adjusted < 15) return;
  const details = [`${displayOffline(adjusted)} 동안 ${fmt(wins)}번 이겼어요.`, `코인 +${fmt(state.coins - before.coins)}`];
  if (state.level > before.level) details.push(`레벨 ${before.level} → ${state.level}`);
  if (state.tickets > before.tickets) details.push(`뽑기권 +${state.tickets - before.tickets}`);
  if (state.bag.length > before.bag) details.push(`새 장비 ${state.bag.length - before.bag}개가 가방에 있어요.`);
  const gained = state.coins - before.coins;
  queuePopup(() => {
    showDialog('쉬는 시간 보상', details, '#i-gift');
    $('dialog-content').classList.add('reward-lines');
    offerOfflineDouble(gained);
  });
}

function updateClock(animate = true) {
  if (!state.profile || editingProfile) return;
  const now = Date.now();
  const elapsed = Math.max(0, (now - openedAt) / 1000);
  openedAt = now;
  if (elapsed >= 15) catchUp(elapsed);
  else simulate(state, elapsed * (state.speed || 1), animate ? combatEvent : null);
  if (now - lastSavedAt > 2000) save();
}

let renderedFront = '';
let renderedPack = '';

// 뒤에 선 무리: 가까운 줄 2명 + 먼 줄 3명(작게, 위쪽)
const PACK_SLOTS = [
  { x: 4, y: 0, s: 0.84, z: 3 }, { x: 52, y: 4, s: 0.82, z: 3 },
  { x: 24, y: 34, s: 0.7, z: 1 }, { x: 70, y: 38, s: 0.68, z: 1 }, { x: 114, y: 34, s: 0.68, z: 0 },
];
const packPoses = new Map();

function renderPack() {
  const pack = (state.pack || []).filter(mob => mob.hp > 0);
  const key = pack.map(mob => `${mob.name}:${mob.sprite}`).join('|');
  const box = $('pack');
  if (key !== renderedPack) {
    renderedPack = key;
    box.replaceChildren(...pack.slice(0, PACK_SLOTS.length).map((mob, index) => {
      const place = PACK_SLOTS[index];
      const slot = document.createElement('span');
      slot.className = 'pack-mob';
      slot.style.setProperty('--x', `${place.x}px`);
      slot.style.setProperty('--y', `${place.y}px`);
      slot.style.setProperty('--s', place.s);
      slot.style.zIndex = place.z;
      const meter = document.createElement('span');
      meter.className = 'pack-hp';
      meter.append(document.createElement('i'));
      const sprite = document.createElement('span');
      sprite.className = 'sprite';
      sprite.dataset.sprite = mob.sprite;
      sprite.dataset.pose = 'ready';
      slot.append(meter, sprite);
      return slot;
    }));
  }
  const now = performance.now();
  pack.slice(0, PACK_SLOTS.length).forEach((mob, index) => {
    const slot = box.children[index];
    if (!slot) return;
    slot.querySelector('.pack-hp i').style.width = `${clamp(mob.hp / mob.max, 0, 1) * 100}%`;
    const sprite = slot.querySelector('.sprite');
    const pose = (packPoses.get(index) || []).find(entry => entry.until > now)?.pose || 'ready';
    if (sprite.dataset.pose !== pose) sprite.dataset.pose = pose;
  });
}

function packAct(pose, count, ms) {
  const alive = Math.min(PACK_SLOTS.length, aliveBehind(state));
  if (!alive) return;
  const picks = pose === 'hit' ? [...Array(alive).keys()] : [...Array(alive).keys()].sort(() => Math.random() - 0.5).slice(0, count);
  const now = performance.now();
  const rate = state?.speed || 1;
  for (const index of picks) {
    const delay = pose === 'hit' ? 0 : Math.random() * 120;
    if (pose === 'hit') packPoses.set(index, [{ pose: 'hit', until: now + ms / rate }]);
    else packPoses.set(index, [{ pose: 'ready', until: now + delay }, { pose: 'windup', until: now + delay + 90 / rate }, { pose: 'strike', until: now + delay + ms / rate }]);
  }
}

function renderDungeonTimer() {
  const boss = !state.dungeon && !state.farm && state.wave === BOSS_WAVE;
  const active = (state.dungeon || boss) && !state.roundEnd;
  $('dungeon-timer').hidden = !active;
  if (!active) return;
  const left = Math.max(0, state.dungeon ? state.dungeon.time : state.bossTime);
  const total = state.dungeon ? DUNGEON_TIME : BOSS_TIME;
  setText('dungeon-timer-title', state.dungeon ? `${dungeonInfo(state.dungeon.id).name} Lv.${state.dungeon.level}` : `보스 도전 · ${currentEnemy(state)}`);
  const left2 = Math.ceil(left);
  setText('dungeon-timer-text', state.dungeon
    ? (state.dungeon.id === 'trial' ? `승급 시험 남은 ${left2}초` : `던전 남은 ${left2}초${state.front?.leader ? ' · 보스!' : ` · 참가자 ${aliveBehind(state) + 1}`}`)
    : `보스 도전 · 남은 ${left2}초`);
  $('dungeon-timer-fill').style.width = `${left / total * 100}%`;
  $('dungeon-timer').classList.toggle('hurry', left < 8);
  $('dungeon-timer').classList.toggle('boss-timer', boss);
}

let renderedContest = '';

function renderContest() {
  const id = contestId(state);
  if (id === renderedContest) return;
  renderedContest = id;
  setText('contest-name', CONTESTS[id].name);
  $('contest-chip').dataset.contest = id;
  // 종목별 동작 그림 연결 자리: motion.css에서 .arena[data-motion='toss'] [data-sprite='boy'][data-pose='strike'] 처럼 덮어쓴다
  $('arena').dataset.contest = id;
  $('arena').dataset.motion = CONTESTS[id].motion;
}

// 종목 도구(딱지·지우개·피구공·농구공)가 공격하는 쪽에서 상대 쪽으로 날아간다
function throwProp(prop, target) {
  const fight = document.querySelector('.fight');
  if (!fight) return;
  const item = document.createElement('span');
  item.className = `prop prop-${prop} ${target === 'rival' ? 'to-right' : 'to-left'}`;
  item.setAttribute('aria-hidden', 'true');
  fight.append(item);
  setTimeout(() => item.remove(), 420);
}

function renderKills() {
  const { done, total } = killProgress(state);
  const boss = !state.dungeon && state.wave === BOSS_WAVE;
  $('kill-fill').style.width = `${done / total * 100}%`;
  setText('kill-text', state.dungeon ? `참가자 ${aliveBehind(state) + (state.front?.leader ? 0 : 1)}명` : boss ? '보스 도전!' : `승리 ${done}/${total}`);
  $('kill-bar').classList.toggle('boss', boss);
  $('kill-bar').hidden = Boolean(state.dungeon) || (boss && !state.roundEnd) || Boolean(state.farm || state.roundEnd?.nextFarm);
  const pan = state.dungeon ? 50 : [8, 36, 64, 92][state.wave] ?? 50;
  $('arena').style.setProperty('--pan', `${pan}%`);
}

function renderBattle() {
  const map = MAPS[state.map];
  const gradeNumber = gradeIndex(state.map) + 1;
  const dungeon = state.dungeon ? dungeonInfo(state.dungeon.id) : null;
  setText('stage-number', dungeon ? (state.dungeon.id === 'trial' ? `승급 시험 · ${tierName(state.dungeon.level)}` : `던전 · Lv.${state.dungeon.level}`) : `${schoolName(state.cycle)} ${gradeLabel(state.cycle, state.map)} · ${mapCode(state.map)}`);
  setText('battle-title', dungeon ? dungeon.name : map.place);
  $('arena').dataset.map = dungeon ? (dungeon.background || dungeon.map + 1) : state.map + 1;
  $('arena').classList.toggle('dungeon-round', Boolean(dungeon));
  const status = $('battle-status');
  const resting = state.roundEnd?.result === 'loss';
  setText('battle-status', resting ? '잠깐 쉬는 중' : state.roundEnd ? '승리' : dungeon ? '던전 도전 중' : state.farm ? '반복 수련 중' : '자동 대결 중');
  status.classList.toggle('rest', resting);
  const boss = !dungeon && state.wave === BOSS_WAVE;
  const round = `${state.map}:${state.wave}:${state.farm ? 1 : 0}:${state.dungeon?.id || ''}${state.dungeon?.level || ''}`;
  if (round !== renderedRound) {
    renderedRound = round;
    $('arena').classList.toggle('boss-round', boss);
    Array.from($('rounds').children).forEach((dot, index) => {
      dot.className = index === state.wave ? 'active' : index < state.wave ? 'past' : '';
    });
    $('rounds').ariaLabel = `대결 ${state.wave + 1} / ${BOSS_WAVE + 1}`;
    renderRoster();
  }
  const frontKey = `${round}:${state.front?.name}`;
  if (frontKey !== renderedFront) {
    const stepIn = renderedFront && renderedFront.startsWith(round);
    renderedFront = frontKey;
    const front = state.front;
    const leader = front?.leader;
    const size = (0.87 + (gradeNumber - 1) * 0.026) * (boss || (dungeon && leader) ? 1.1 : leader ? 1 : 0.88);
    $('rival-sprite').dataset.sprite = front?.sprite || rivalSprite(state.map, state.wave);
    $('rival').style.setProperty('--size', size.toFixed(2));
    $('rival').classList.toggle('minion', Boolean(front) && !leader);
    if (stepIn && !reducedMotion.matches) {
      $('rival').classList.remove('step-in');
      void $('rival').offsetWidth;
      $('rival').classList.add('step-in');
      clearTimeout(renderBattle.stepTimer);
      renderBattle.stepTimer = setTimeout(() => $('rival').classList.remove('step-in'), 360);
    }
  }
  const behind = aliveBehind(state);
  const finalBoss = boss && isGradeFinal(state.map);
  setText('round-label', dungeon ? (behind ? `참가자 ${behind + 1}명 남음` : '던전 보스전') : finalBoss ? '학년 대표전' : boss ? '보스 대결' : `대결 ${state.wave + 1}/${BOSS_WAVE + 1} · ${behind + 1}명`);
  renderPack();
  renderDungeonTimer();
  renderKills();
  renderContest();
  $('player-name').textContent = state.profile.name;
  $('player-sprite').dataset.sprite = state.profile.gender;
  $('player-tag').textContent = `LV. ${state.level}`;
  setText('rival-tag', dungeon ? (state.front?.leader ? '던전 보스' : '참가자') : state.farm ? '수련' : boss ? '보스' : state.front?.leader ? '대장' : `${gradeNumber}학년`);
  $('rival-name').textContent = currentEnemy(state);
  const totalHp = maxHp(state);
  const totalEnemy = enemyMaxHp(state);
  $('hp-text').textContent = `${fmt(state.hp)} / ${fmt(totalHp)}`;
  $('enemy-text').textContent = `${fmt(state.enemyHp)} / ${fmt(totalEnemy)}`;
  bar($('hp-fill'), $('hp-bar'), state.hp, totalHp);
  bar($('enemy-fill'), $('enemy-bar'), state.enemyHp, totalEnemy);
  renderMotion();
  renderOutfit($('player-sprite'), state.equipped);
  renderRoundResult();
  renderPattern();
  renderSkill();
  renderFarm();
  const mapGear = MAP_REWARDS[state.map];
  const progress = state.mapWins[state.map] % DROP_WINS;
  $('drop-name').textContent = state.bag.includes(mapGear) ? '천 조각' : GEAR[mapGear].name;
  $('drop-count').textContent = `${progress}/${DROP_WINS}승`;
  $('drop-fill').style.width = `${progress / DROP_WINS * 100}%`;
  $('first-loot').hidden = Boolean(state.dungeon) || !state.bag.includes('wristband') || gearStats(state, state.equipped.accessory).attack >= gearStats(state, 'wristband').attack;
  $('advance').setAttribute('aria-checked', String(state.autoNext));
}

function renderRoster() {
  const map = MAPS[state.map];
  $('roster-note').textContent = `${mapCode(state.map)} ${map.place} · ${state.farm ? '반복 수련 중이에요. 3승하면 다시 도전해요.' : '넷을 모두 이기면 다음 장소가 열려요.'}`;
  $('roster').replaceChildren(...map.names.map((name, wave) => {
    const entry = document.createElement('li');
    const status = state.farm ? 'upcoming' : wave < state.wave ? 'past' : wave === state.wave ? 'current' : 'upcoming';
    entry.className = `rival-card ${status}${wave === BOSS_WAVE ? ' boss' : ''}`;
    const figure = document.createElement('span');
    figure.className = 'rival-figure';
    figure.ariaHidden = 'true';
    const sprite = document.createElement('span');
    sprite.className = 'sprite';
    sprite.dataset.sprite = rivalSprite(state.map, wave);
    figure.append(sprite);
    const tag = document.createElement('small');
    tag.className = 'rival-tag';
    tag.textContent = status === 'current' ? '대결 중' : status === 'past' ? '승리' : wave === BOSS_WAVE ? '보스 1:1' : `팀 ${PACK.length}명`;
    const label = document.createElement('b');
    label.textContent = wave === BOSS_WAVE ? name : `${name} 팀`;
    const hp = document.createElement('span');
    hp.className = 'rival-hp';
    hp.textContent = `체력 ${fmt(map.hp[wave] * GRADE_SCALING[gradeIndex(state.map)].hp * cycleScale(state, 'hp'))}`;
    entry.append(figure, tag, label, hp);
    return entry;
  }));
}

function renderFarm() {
  const afterRound = state.roundEnd ? state.roundEnd.nextFarm : state.farm;
  const farm = afterRound || state.farm;
  $('farm').hidden = !farm;
  if (!farm) return;
  setText('farm-title', `${mapCode(state.map)} 반복 수련`);
  setText('farm-progress', !afterRound ? '완료!' : `${farm.wins}/${FARM_WINS}승`);
  $('farm-fill').style.width = `${(!afterRound ? 1 : farm.wins / FARM_WINS) * 100}%`;
  $('retry-map').disabled = Boolean(state.roundEnd || !state.farm);
}

function renderRoundResult() {
  const result = $('round-result');
  const end = state.roundEnd;
  const show = Boolean(end && end.wait < (end.leaveDungeon ? 1.45 : end.result === 'loss' ? 1.48 : state.wave === BOSS_WAVE ? 1.13 : 0.66));
  result.hidden = !show;
  if (!show) return;
  result.dataset.result = end.result;
  const timeout = state.dungeonResult?.reason === 'timeout';
  setText('round-result', end.leaveDungeon ? (end.result === 'win' ? '던전 클리어!' : timeout ? '시간 초과!' : '던전 실패') : end.result === 'loss' ? '다시 도전!' : state.wave === BOSS_WAVE ? '보스전 승리!' : '팀 승리!');
}

function renderPattern() {
  const active = isDaon(state) && !state.roundEnd;
  $('pattern').hidden = !active;
  $('arena').dataset.bossPhase = active ? state.bossPhase : '';
  if (!active) return;
  const phase = state.bossPhase;
  $('pattern').dataset.phase = phase;
  const [title, hint] = DAON_TEXT[phase];
  $('pattern-title').textContent = title;
  $('pattern-hint').textContent = hint;
  $('pattern').title = hint;
  $('pattern-fill').style.width = `${clamp(state.bossTimer / BOSS_PHASES[phase].duration * 100, 0, 100)}%`;
}

function renderSkill() {
  const move = SKILLS[state.skillId];
  const chargePercent = Math.min(100, Math.round(state.charge / move.cost * 100));
  const ready = canSkill(state);
  $('charge-fill').style.width = `${chargePercent}%`;
  $('skill').classList.toggle('ready', ready);
  $('skill').setAttribute('aria-disabled', String(!ready));
  setIcon($('skill-icon'), ICONS.skills[state.skillId] || move.glyph);
  $('skill-name').textContent = move.name;
  let detail = state.autoSkill ? '스킬 자동 사용 중' : '대결하며 충전';
  if (ready) {
    detail = '탭해서 발동';
    if (state.autoSkill && isDaon(state)) {
      if (state.skillId === 'bell' && !guarding(state)) detail = '방어할 때 자동 발동';
      if (state.skillId === 'rush' && !opening(state)) detail = '빈틈에 자동 발동';
    }
  }
  $('skill-detail').textContent = detail;
  $('charge-text').textContent = ready ? '발동' : `${chargePercent}%`;
}

function costLabel(currency, amount, label = '') {
  const cost = document.createElement('span');
  cost.className = 'cost';
  const icon = document.createElement('i');
  icon.className = `cur ${currency}`;
  icon.ariaHidden = 'true';
  if (label) cost.append(`${label} `);
  cost.append(icon, amount);
  return cost;
}

function row(glyph, name, detail, buttonLabel, action, { selected = false, disabled = false, description = '', map = null, level = null, cost = null, kind = '', tone = '', tile = null, progress = null } = {}) {
  const article = document.createElement('article');
  article.className = `item${selected ? ' selected' : ''}`;
  const icon = document.createElement('span');
  icon.className = map === null ? 'item-icon' : 'map-thumb';
  icon.ariaHidden = 'true';
  if (map === null) {
    setIcon(icon, glyph);
    if (tone) icon.dataset.tone = tone;
    if (tile) {
      icon.style.setProperty('--tile', tile[0]);
      icon.style.setProperty('--tile-hi', tile[1]);
    }
  } else {
    icon.dataset.map = map + 1;
    const code = document.createElement('span');
    code.textContent = glyph;
    icon.append(code);
    article.classList.toggle('locked', !unlocked(state, map));
  }
  const text = document.createElement('div');
  text.className = 'item-body';
  const label = document.createElement('b');
  const title = document.createElement('span');
  title.className = 'item-name';
  title.textContent = name;
  label.append(title);
  if (level !== null) {
    const badge = document.createElement('em');
    badge.className = 'lv';
    badge.textContent = level;
    label.append(badge);
  }
  const caption = document.createElement('p');
  caption.textContent = detail;
  text.append(label, caption);
  if (progress !== null) {
    const meter = document.createElement('div');
    meter.className = `item-progress${progress >= 1 ? ' full' : ''}`;
    const fill = document.createElement('i');
    fill.style.width = `${clamp(progress, 0, 1) * 100}%`;
    meter.append(fill);
    text.append(meter);
  }
  const button = document.createElement('button');
  button.type = 'button';
  if (kind) button.className = kind;
  if (cost) {
    button.classList.add('buy');
    button.classList.toggle('short', cost.short);
    const caption = document.createElement('small');
    caption.textContent = buttonLabel;
    button.append(caption, costLabel(cost.currency, cost.amount));
  } else button.textContent = buttonLabel;
  button.ariaLabel = description || `${name} ${buttonLabel}`;
  button.disabled = disabled;
  button.addEventListener('click', action);
  article.append(icon, text, button);
  return article;
}

function renderSkillChoices() {
  $('skill-choices').replaceChildren(...Object.entries(SKILLS).map(([id, skill]) => {
    const active = state.skillId === id;
    return row(ICONS.skills[id] || skill.glyph, skill.name, skill.detail, active ? '사용 중' : '장착', () => {
      state.skillId = id;
      $('skill-dialog').close();
      message(`${skill.name} 장착`);
      commit();
    }, { selected: active, disabled: active, level: `충전 ${skill.cost}`, kind: active ? 'worn' : 'equip', tone: SKILL_TONES[id] });
  }));
  $('auto-skill').setAttribute('aria-checked', String(state.autoSkill));
}

const TRAINING_TONES = { power: 'red', health: 'pink', speed: 'yellow', focus: 'teal' };
const CLASS_TONES = { gym: 'green', math: 'blue', music: 'pink' };
const SKILL_TONES = { rush: 'yellow', bell: 'blue' };
const MISSION_TONES = { wins: 'red', clears: 'blue', closet: 'pink' };

function trainingPlan(id) {
  const info = TRAINING[id];
  let level = state.training[id];
  let total = 0;
  let count = 0;
  const limit = buyMode === 'max' ? Infinity : buyMode;
  while (count < limit && level < info.cap) {
    const cost = trainingCostAt(id, level);
    if (buyMode === 'max' && count > 0 && total + cost > state.coins) break;
    total += cost;
    level++;
    count++;
    if (buyMode === 'max' && total > state.coins) break;
  }
  return { count, total };
}

function startHold(id) {
  stopHold();
  holdTimer = setTimeout(() => {
    holdRepeat = setInterval(() => { if (!train(id, true)) stopHold(); }, 110);
  }, 380);
}

function stopHold() {
  clearTimeout(holdTimer);
  clearInterval(holdRepeat);
  holdTimer = null;
  holdRepeat = null;
}

function renderTraining() {
  $('training-list').replaceChildren(...Object.entries(TRAINING).map(([id, info]) => {
    const level = state.training[id];
    const capped = level >= info.cap;
    const { count, total } = trainingPlan(id);
    const single = buyMode === 1;
    const milestone = info.milestone ? ` · ${MILESTONE}레벨마다 ×2 (다음까지 ${MILESTONE - level % MILESTONE})` : '';
    const article = row(ICONS.training[id] || info.glyph, info.name, capped ? `최대 레벨 달성 · ${info.bonus}` : `레벨마다 ${info.bonus}${milestone}`, capped ? '최대' : single ? '강화' : `+${count}`, () => train(id), {
      level: info.cap < 99 ? `Lv.${level}/${info.cap}` : `Lv.${level}`,
      tone: TRAINING_TONES[id],
      cost: capped ? null : { currency: 'coin', amount: fmt(total), short: state.coins < total },
      disabled: capped || state.coins < total,
      description: capped ? `${info.name} 최대 레벨` : single ? `${info.name}, 코인 ${fmt(total)}개` : `${info.name} ${count}회, 코인 ${fmt(total)}개`,
    });
    article.querySelector('button').addEventListener('pointerdown', () => startHold(id));
    return article;
  }));
  document.querySelectorAll('#buy-mode button').forEach(button => button.setAttribute('aria-pressed', String(String(buyMode) === button.dataset.buy)));
  $('class-note').textContent = firstGradeWon(state) ? '과목 하나를 골라 다음 대결에 보너스를 받으세요.' : '1-3 교실의 반장에게 이기면 과목을 고를 수 있어요.';
  $('class-list').replaceChildren(...Object.entries(CLASSES).map(([id, info]) => {
    const selected = state.classId === id;
    return row(ICONS.classes[id] || info.glyph, info.name, info.bonus, selected ? '선택 중' : '선택', () => {
      state.classId = id;
      message(`${info.name} 보너스를 받기 시작했어요.`);
      commit();
    }, { selected, disabled: !firstGradeWon(state) || selected, kind: selected ? 'worn' : '', tone: CLASS_TONES[id] });
  }));
}

const SLOT_ICONS = { top: '▰', bottom: '▥', bag: '▣', shoes: '➤', accessory: '✧' };
const SLOT_TONES = { top: '', bottom: 'blue', bag: 'green', shoes: 'yellow', accessory: 'pink' };

function gearTile(id) {
  const fabric = FABRICS[GEAR[id].style];
  if (!fabric) return null;
  const rgb = values => `rgb(${values.join(' ')})`;
  return [`color-mix(in srgb, ${rgb(fabric.light)} 62%, ${rgb(fabric.shade)})`, rgb(fabric.light)];
}

function itemLabel(id) {
  const rank = state.ranks[id] || 0;
  return `${GEAR[id].name}${rank ? ` +${rank}` : ''}`;
}

function renderBag() {
  $('gear-count').textContent = `천 조각 ${fmt(state.patches)}개`;
  $('closet-sprite').dataset.sprite = state.profile.gender;
  renderOutfit($('closet-sprite'), state.equipped);
  $('outfit').replaceChildren(...Object.entries(SLOTS).map(([slot, name]) => {
    const line = document.createElement('div');
    const label = document.createElement('dt');
    const value = document.createElement('dd');
    label.textContent = name;
    value.textContent = itemLabel(state.equipped[slot]);
    line.append(label, value);
    return line;
  }));
  $('gear-tabs').replaceChildren(...Object.entries({ all: '전체', ...SLOTS }).map(([slot, name]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.setAttribute('aria-pressed', String(gearFilter === slot));
    button.addEventListener('click', () => { gearFilter = slot; render(); });
    return button;
  }));
  $('gear-list').replaceChildren(...[...state.bag].reverse().filter(id => gearFilter === 'all' || gearFilter === GEAR[id].slot).map(gearRow));
}

function gearRow(id) {
  const { slot, starter } = GEAR[id];
  const { attack, hp } = gearStats(state, id);
  const rank = state.ranks[id] || 0;
  const detail = [SLOTS[slot], attack && `파워 +${attack}`, hp && `체력 +${hp}`, rank && `착용 시 파워·체력 +${Math.round(rank * RANK_BONUS * 100)}%`].filter(Boolean).join(' · ');
  const equipped = state.equipped[slot] === id;
  const article = row(ICONS.slots[slot] || SLOT_ICONS[slot], itemLabel(id), detail, equipped ? '착용 중' : '장착', () => equip(id), {
    selected: equipped, disabled: equipped, kind: equipped ? 'worn' : 'equip', tone: SLOT_TONES[slot], tile: gearTile(id),
  });
  if (starter) return article;
  const buttons = document.createElement('div');
  buttons.className = 'gear-actions';
  buttons.append(article.lastElementChild);
  const enhance = document.createElement('button');
  enhance.type = 'button';
  const capped = (state.ranks[id] || 0) >= MAX_RANK;
  const cost = upgradeCost(state, id);
  if (capped) enhance.textContent = '최대 강화';
  else {
    enhance.className = 'buy';
    enhance.classList.toggle('short', state.patches < cost);
    enhance.append(costLabel('patch', cost, '강화'));
  }
  enhance.ariaLabel = `${GEAR[id].name} ${capped ? '최대 강화' : `강화, 천 조각 ${cost}개`}`;
  enhance.disabled = capped || state.patches < cost;
  enhance.addEventListener('click', () => upgradeGear(id));
  buttons.append(enhance);
  article.append(buttons);
  return article;
}

function rewardChips(reward, unitCoins = true) {
  const wrap = document.createElement('span');
  wrap.className = 'reward-chips';
  const add = (currency, amount) => {
    const chip = document.createElement('span');
    chip.className = 'reward-chip';
    const icon = document.createElement('i');
    icon.className = `cur ${currency}`;
    icon.ariaHidden = 'true';
    chip.append(icon, fmt(amount));
    wrap.append(chip);
  };
  if (reward.coins) add('coin', unitCoins ? reward.coins * coinUnit(state) : reward.coins);
  if (reward.tickets) add('ticket', reward.tickets);
  if (reward.patches) add('patch', reward.patches);
  if (reward.gems) add('gem', reward.gems);
  if (reward.recruits) add('recruit', reward.recruits);
  if (reward.badges) add('badge', reward.badges);
  return wrap;
}

function attendanceState() {
  const claimedToday = state.attendance.last === todayKey();
  const done = claimedToday ? ((state.attendance.count - 1) % 7) + 1 : state.attendance.count % 7;
  return { claimedToday, done };
}

function renderAttendance(list) {
  const { claimedToday, done } = attendanceState();
  list.replaceChildren(...ATTENDANCE.map((reward, day) => {
    const cell = document.createElement('li');
    const status = day < done ? 'claimed' : day === done && !claimedToday ? 'today' : 'later';
    cell.className = `attend-day ${status}${day === ATTENDANCE.length - 1 ? ' big' : ''}`;
    const label = document.createElement('small');
    label.textContent = status === 'today' ? '오늘' : `${day + 1}일`;
    cell.append(label, rewardChips(reward));
    if (status === 'claimed') {
      const check = document.createElement('span');
      check.className = 'attend-check';
      check.textContent = '받음';
      cell.append(check);
    }
    return cell;
  }));
}

function claimAttendance() {
  if (state.attendance.last === todayKey()) return;
  const given = grant(state, ATTENDANCE[state.attendance.count % ATTENDANCE.length]);
  state.attendance.count++;
  state.attendance.last = todayKey();
  message(`출석 보상 · ${rewardText(given)}`);
  commit();
}

function renderDaily() {
  refreshDay(state, todayKey());
  $('daily-list').replaceChildren(...Object.entries(DAILY_MISSIONS).map(([id, mission]) => {
    const value = Math.max(0, mission.value(state));
    const claimed = state.daily.claimed.includes(id);
    const ready = value >= mission.target && !claimed;
    const article = row(ICONS.daily[id], mission.name, '', claimed ? '완료' : ready ? '받기' : '진행 중', () => {
      if (state.daily.claimed.includes(id) || mission.value(state) < mission.target) return;
      state.daily.claimed.push(id);
      message(`일일 미션 보상 · ${rewardText(grant(state, mission.reward))}`);
      commit();
    }, {
      selected: ready, disabled: !ready, kind: ready ? 'claim' : claimed ? 'worn' : '', tone: DAILY_TONES[id],
      level: `${Math.min(value, mission.target)}/${mission.target}`, progress: claimed ? 1 : value / mission.target,
    });
    article.querySelector('.item-body p').replaceChildren(rewardChips(mission.reward));
    return article;
  }));
}

function dailyReady() {
  if (!state.daily || state.daily.date !== todayKey()) return false;
  return Object.entries(DAILY_MISSIONS).some(([id, mission]) => !state.daily.claimed.includes(id) && mission.value(state) >= mission.target);
}

function renderMissions() {
  $('activity-patches').textContent = `천 조각 ${fmt(state.patches)}개`;
  renderAttendance($('attendance'));
  const { claimedToday } = attendanceState();
  const claim = document.createElement('li');
  claim.className = 'attend-action';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = claimedToday ? 'done' : 'claim';
  button.textContent = claimedToday ? '오늘 출석 완료! 내일 또 만나요' : '오늘 출석 보상 받기';
  button.disabled = claimedToday;
  button.addEventListener('click', claimAttendance);
  claim.append(button);
  $('attendance').append(claim);
  renderDaily();
  $('mission-list').replaceChildren(...Object.entries(MISSIONS).map(([id, mission]) => {
    const { target, coins, patches } = nextMission(state, id);
    const maximum = id === 'clears' ? Infinity : id === 'closet' ? Object.values(GEAR).filter(item => !item.starter).length : Infinity;
    const allDone = target > maximum;
    const value = mission.value(state);
    const ready = value >= target;
    const reward = `${mission.hint} 보상 · 코인 ${fmt(coins)} · 천 조각 ${patches}`;
    return row(ICONS.missions[id] || mission.glyph, mission.name, allDone ? '모든 목표 완료' : reward, allDone ? '완료' : ready ? '보상 받기' : '진행 중', () => {
      if (mission.value(state) < nextMission(state, id).target) return;
      state.missions[id]++;
      state.coins += coins;
      state.patches += patches;
      state.gems += 10;
      message(`코인 +${coins} · 천 조각 +${patches} · 보석 +10`);
      commit();
    }, {
      selected: ready && !allDone, disabled: !ready || allDone, kind: ready && !allDone ? 'claim' : '', tone: MISSION_TONES[id],
      level: allDone ? null : `${fmt(Math.min(target, value))}/${fmt(target)}`, progress: allDone ? 1 : value / target,
    });
  }));
}

const PERK_TONES = { power: 'red', health: 'pink', coin: 'yellow', xp: 'blue', offline: 'teal' };
const PERK_ICONS = { power: '#i-power', health: '#i-heart', coin: '#i-plus', xp: '#st-notebook', offline: '#i-calendar' };

function perkEffect(id) {
  const perk = PERKS[id];
  const level = state.prestige.perks[id];
  if (perk.stat === 'offline') return `오프라인 보상 +1시간씩 · 지금 최대 ${offlineLimit(state) / 3600}시간`;
  const label = STICKER_STATS[perk.stat];
  const now = perk.mult ** level;
  return `${label} ×${perk.mult}씩 곱해져요 · 지금 ×${now >= 1000 ? fmt(now) : now.toFixed(2)}`;
}

function renderPrestige() {
  const gain = prestigeGain(state);
  const reached = progress(state);
  const p = state.prestige;
  setText('badge-count', fmt(p.badges));
  setText('prestige-stats', `전학 ${fmt(p.count)}번 · 최고 기록 ${placeLabel(Math.max(1, Math.max(p.best, reached)) - 1)} · 받은 배지 ${fmt(p.earned)}개`);
  const button = $('prestige-button');
  button.disabled = gain <= 0;
  setText('prestige-gain', gain > 0 ? `지금 전학 가면 명예 배지 +${fmt(gain)}` : `해솔초 2-3까지 깨면 전학할 수 있어요 (지금 ${reached}/${PRESTIGE_UNLOCK})`);
  $('perk-list').replaceChildren(...Object.keys(PERKS).map(id => {
    const perk = PERKS[id];
    const level = p.perks[id];
    const capped = level >= perk.cap;
    const cost = perkCost(state, id);
    return row(PERK_ICONS[id], perk.name, perkEffect(id), capped ? '최대' : '배우기', () => buyPerk(id), {
      level: perk.cap < 1e6 ? `Lv.${level}/${perk.cap}` : `Lv.${level}`, tone: PERK_TONES[id],
      cost: capped ? null : { currency: 'badge', amount: fmt(cost), short: p.badges < cost },
      disabled: capped || p.badges < cost, description: `${perk.name}, 명예 배지 ${fmt(cost)}개`,
    });
  }));
}

function buyPerk(id) {
  const cost = perkCost(state, id);
  if (state.prestige.badges < cost || state.prestige.perks[id] >= PERKS[id].cap) return;
  const ratio = state.hp / maxHp(state);
  state.prestige.badges -= cost;
  state.prestige.perks[id]++;
  if (state.roundEnd?.result !== 'loss') state.hp = clamp(Math.round(ratio * maxHp(state)), 1, maxHp(state));
  message(`${PERKS[id].name} Lv.${state.prestige.perks[id]}`);
  commit();
}

function openTransfer() {
  const gain = prestigeGain(state);
  if (!gain) return;
  $('transfer-gain').textContent = `+${fmt(gain)}`;
  $('transfer-dialog').showModal();
}

function doTransfer() {
  const gain = transfer(state);
  if (!gain) return;
  combatEvent('enter', {});
  renderedRound = '';
  previousObjective = '';
  openView('training:academy');
  showDialog('새 학교 첫날!', [`${state.prestige.count}번째 전학이에요. 해솔초 1-1 신발장 입구부터 다시 시작해요.`, `명예 배지 +${fmt(gain)}`, '아래 방과 후 학원에서 배지로 영구 능력치를 올리세요.'], '#i-star');
  $('dialog-content').classList.add('reward-lines');
  commit();
}

function renderGrades() {
  renderPrestige();
  setText('grades-title', `${schoolName(state.cycle)} 학교 지도`);
  $('grade-count').textContent = `${state.cleared.filter(Boolean).length} / ${MAPS.length} 완료`;
  const groups = Array.from({ length: GRADE_COUNT }, (_, grade) => {
    const firstMap = grade * MAPS_PER_GRADE;
    const end = firstMap + MAPS_PER_GRADE;
    const group = document.createElement('details');
    group.className = 'grade-group';
    group.open = expandedGrades.has(grade);
    group.addEventListener('toggle', () => {
      if (!group.isConnected) return;
      if (group.open) expandedGrades.add(grade);
      else expandedGrades.delete(grade);
    });
    const title = document.createElement('summary');
    title.append(`${grade + 1}학년`);
    const count = document.createElement('small');
    count.textContent = unlocked(state, firstMap) ? `${state.cleared.slice(firstMap, end).filter(Boolean).length} / ${MAPS_PER_GRADE}` : '잠김';
    title.append(count);
    const list = document.createElement('div');
    list.className = 'map-list';
    for (let index = firstMap; index < end; index++) {
      const map = MAPS[index];
      const selected = index === state.map;
      const locked = !unlocked(state, index);
      const buttonLabel = selected ? '현재 위치' : locked ? '잠김' : state.cleared[index] ? '재도전' : '도전';
      const description = `${state.cleared[index] ? '보스 승리' : map.names[BOSS_WAVE]} · ${GEAR[MAP_REWARDS[index]].name}`;
      list.append(row(mapCode(index), map.place, description, buttonLabel, () => {
        if (index === state.map || !unlocked(state, index)) return;
        startMap(index);
        record(state, `${mapCode(index)} ${map.place}에 도착했어요.`);
        selectView('battle');
        commit();
      }, { selected, disabled: selected || locked, map: index, kind: selected ? 'here' : !locked && !state.cleared[index] ? 'equip' : '' }));
    }
    group.append(title, list);
    return group;
  });
  $('grade-list').replaceChildren(...groups);
}

function gachaCoinCost(count) { return count >= 10 ? pullCost(state) * 9 : pullCost(state); }

function stickerCard(id, { compact = false } = {}) {
  const sticker = STICKERS[id];
  const level = stickerLevel(state, id);
  const card = document.createElement(compact ? 'div' : 'article');
  card.className = `sticker-card ${sticker.rarity}${level ? '' : ' unknown'}`;
  const art = document.createElement('span');
  art.className = `sticker ${sticker.rarity}`;
  art.append(svgIcon(`#st-${id}`));
  const rarity = document.createElement('small');
  rarity.className = 'rarity';
  rarity.textContent = RARITIES[sticker.rarity].name;
  const name = document.createElement('b');
  name.textContent = level ? sticker.name : '???';
  card.append(art, rarity, name);
  if (!compact) {
    const effect = document.createElement('span');
    effect.className = 'sticker-effect';
    const per = sticker.stat === 'crit' ? `${(sticker.value * 100).toFixed(1)}%p` : `${Math.round(sticker.value * 100)}%`;
    effect.textContent = level ? `${STICKER_STATS[sticker.stat]} +${sticker.stat === 'crit' ? (sticker.value * level * 100).toFixed(1) + '%p' : Math.round(sticker.value * level * 100) + '%'}` : `${STICKER_STATS[sticker.stat]} +${per}/Lv`;
    const meter = document.createElement('span');
    meter.className = 'sticker-meter';
    const copies = state.stickers[id] || 0;
    const prev = STICKER_LEVELS[level - 1] || 0;
    const next = STICKER_LEVELS[level];
    const fill = document.createElement('i');
    fill.style.width = `${next ? clamp((copies - prev) / (next - prev), 0, 1) * 100 : 100}%`;
    meter.append(fill);
    const count = document.createElement('em');
    count.textContent = level ? (next ? `Lv.${level} · ${copies - prev}/${next - prev}` : `Lv.${level} 최대`) : '미획득';
    card.append(effect, meter, count);
  }
  return card;
}

function renderGacha() {
  setText('ticket-count', fmt(state.tickets));
  const buttons = [
    { count: 1, currency: 'ticket', label: '1회 뽑기', cost: 1 },
    { count: 10, currency: 'ticket', label: '10회 뽑기', cost: 10 },
    { count: 1, currency: 'coin', label: '1회 뽑기', cost: gachaCoinCost(1) },
    { count: 10, currency: 'coin', label: '10회 뽑기', cost: gachaCoinCost(10), tag: '10% 할인' },
  ];
  $('gacha-buttons').replaceChildren(...buttons.map(({ count, currency, label, cost, tag }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `gacha-button ${currency}${count === 10 ? ' ten' : ''}`;
    const balance = currency === 'ticket' ? state.tickets : state.coins;
    button.disabled = balance < cost;
    button.ariaLabel = `${label}, ${currency === 'ticket' ? '뽑기권' : '코인'} ${fmt(cost)}${currency === 'ticket' ? '장' : '개'}`;
    const title = document.createElement('b');
    title.textContent = label;
    button.append(title, costLabel(currency, fmt(cost)));
    if (tag) {
      const badge = document.createElement('small');
      badge.className = 'deal';
      badge.textContent = tag;
      button.append(badge);
    }
    button.addEventListener('click', () => pull(count, currency));
    return button;
  }));
  $('gacha-rates').textContent = `확률 · ${Object.values(RARITIES).map(rarity => `${rarity.name} ${rarity.weight}%`).join(' · ')}`;
  const owned = Object.keys(STICKERS).filter(id => stickerLevel(state, id) > 0).length;
  $('sticker-count').textContent = `${owned} / ${Object.keys(STICKERS).length}`;
  const totals = Object.keys(STICKER_STATS).map(stat => [stat, stickerBonus(state, stat)]).filter(([, value]) => value > 0);
  $('sticker-summary').textContent = totals.length
    ? `도감 효과 · ${totals.map(([stat, value]) => `${STICKER_STATS[stat]} +${stat === 'crit' ? (value * 100).toFixed(1) + '%p' : Math.round(value * 100) + '%'}`).join(' · ')}`
    : '같은 스티커를 또 뽑으면 레벨이 올라 효과가 커져요.';
  $('sticker-grid').replaceChildren(...Object.keys(STICKERS).map(id => stickerCard(id)));
}

function pull(count, currency) {
  const cost = currency === 'ticket' ? count : gachaCoinCost(count);
  if ((currency === 'ticket' ? state.tickets : state.coins) < cost) return;
  if (currency === 'ticket') state.tickets -= cost;
  else state.coins -= cost;
  const ratio = state.hp / maxHp(state);
  const results = pullStickers(state, count);
  if (state.roundEnd?.result !== 'loss') state.hp = clamp(Math.round(ratio * maxHp(state)), 1, maxHp(state));
  refreshDay(state, todayKey());
  state.daily.pulls += count;
  state.stats.pulls += count;
  lastPull = { count, currency };
  showGachaResults(results);
  commit();
}

function showGachaResults(results) {
  const best = Math.max(...results.map(result => RARITY_ORDER.indexOf(result.rarity)));
  const dialog = $('gacha-dialog');
  dialog.dataset.best = RARITY_ORDER[best];
  const fresh = results.filter(result => result.isNew).length;
  const leveled = results.filter(result => result.leveled).length;
  $('gacha-result-note').textContent = [fresh && `새 스티커 ${fresh}장`, leveled && `레벨 업 ${leveled}장`].filter(Boolean).join(' · ') || '모은 스티커가 쌓였어요.';
  $('gacha-results').classList.toggle('single', results.length === 1);
  $('gacha-results').replaceChildren(...results.map((result, index) => {
    const card = stickerCard(result.id, { compact: true });
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
  const cost = lastPull.currency === 'ticket' ? lastPull.count : gachaCoinCost(lastPull.count);
  again.disabled = (lastPull.currency === 'ticket' ? state.tickets : state.coins) < cost;
  again.textContent = `한 번 더 (${lastPull.currency === 'ticket' ? `뽑기권 ${cost}` : `코인 ${fmt(cost)}`})`;
  if (!dialog.open) dialog.showModal();
  if (best >= RARITY_ORDER.indexOf('epic')) playSound('win');
}

function renderSnacks() {
  const box = $('snacks');
  if (!box.childElementCount) {
    box.replaceChildren(...Object.entries(SNACKS).map(([id, snack]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `snack ${id}`;
      button.dataset.snack = id;
      const icon = document.createElement('span');
      icon.className = 'snack-icon';
      icon.append(svgIcon('#i-milk'));
      const time = document.createElement('small');
      button.append(icon, time);
      button.addEventListener('click', () => eatSnack(id));
      return button;
    }));
  }
  for (const button of box.children) {
    const id = button.dataset.snack;
    const left = state.snacks[id];
    const active = left > 0;
    button.classList.toggle('active', active);
    const minutes = Math.ceil(left / 60);
    const text = active ? (left >= 60 ? `${minutes}분` : `${Math.ceil(left)}초`) : '+15분';
    const time = button.lastElementChild;
    if (time.textContent !== text) time.textContent = text;
    const label = `${SNACKS[id].name}, ${SNACKS[id].label}, ${active ? `${minutes}분 남음` : '15분 먹기'}`;
    if (button.ariaLabel !== label) button.ariaLabel = label;
  }
}

function eatSnack(id) {
  if (state.snacks[id] > SNACK_MAX - SNACK_TIME) {
    message('간식은 최대 60분까지 모아 둘 수 있어요.');
    return;
  }
  const ratio = state.hp / maxHp(state);
  state.snacks[id] = Math.min(SNACK_MAX, state.snacks[id] + SNACK_TIME);
  if (state.roundEnd?.result !== 'loss') state.hp = clamp(Math.round(ratio * maxHp(state)), 1, maxHp(state));
  refreshDay(state, todayKey());
  state.daily.snacks++;
  message(`${SNACKS[id].name} 냠! ${SNACKS[id].label} · 15분`);
  commit();
}

function showLevelUp(from, to) {
  const banner = $('levelup');
  $('levelup-text').textContent = `Lv.${from} → Lv.${to}`;
  banner.hidden = false;
  banner.classList.remove('play');
  void banner.offsetWidth;
  banner.classList.add('play');
  clearTimeout(showLevelUp.timer);
  showLevelUp.timer = setTimeout(() => { banner.hidden = true; }, 1500);
}

let shownDungeonResult = null;

function renderDungeons() {
  $('dungeon-list').replaceChildren(...Object.entries(DUNGEONS).map(([id, dungeon]) => {
    const open = dungeonUnlocked(state, id);
    const best = state.dungeons[id] || 0;
    const keys = dungeonKeys(state, id);
    const card = document.createElement('article');
    card.className = `dungeon-card ${id}${open ? '' : ' locked'}`;
    const icon = document.createElement('span');
    icon.className = 'item-icon';
    icon.dataset.tone = DUNGEON_TONES[id];
    setIcon(icon, ICONS.dungeons[id]);
    const body = document.createElement('div');
    body.className = 'dungeon-body';
    const title = document.createElement('b');
    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = dungeon.name;
    const level = document.createElement('em');
    level.className = 'lv';
    level.textContent = best ? `최고 Lv.${best}` : '첫 도전';
    title.append(name, level);
    const info = document.createElement('p');
    if (!open) info.textContent = dungeon.unlock === 'transfer' ? '첫 전학 후 열려요' : '1-3 반장을 이기면 열려요';
    else info.append('보상 ', rewardChips(dungeonReward(state, id, best + 1), false));
    const keyRow = document.createElement('span');
    keyRow.className = 'dungeon-keys';
    keyRow.ariaLabel = `오늘 열쇠 ${keys}개 남음`;
    for (let index = 0; index < DUNGEON_KEYS; index++) {
      const key = document.createElement('i');
      key.className = index < keys ? 'on' : '';
      keyRow.append(key);
    }
    body.append(title, info, keyRow);
    const actions = document.createElement('div');
    actions.className = 'dungeon-actions';
    const enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'enter';
    enter.textContent = `도전 Lv.${best + 1}`;
    enter.ariaLabel = `${dungeon.name} Lv.${best + 1} 도전`;
    enter.disabled = !open || keys <= 0 || Boolean(state.dungeon);
    enter.addEventListener('click', () => {
      refreshDay(state, todayKey());
      if (!enterDungeon(state, id)) return;
      combatEvent('enter', {});
      message(`${dungeon.name} Lv.${state.dungeon.level} 시작! 30초 안에 이기세요.`);
      commit();
    });
    const sweep = document.createElement('button');
    sweep.type = 'button';
    sweep.className = 'sweep';
    sweep.textContent = '소탕';
    sweep.ariaLabel = `${dungeon.name} Lv.${best} 소탕`;
    sweep.disabled = !open || !best || keys <= 0 || Boolean(state.dungeon);
    sweep.addEventListener('click', () => {
      refreshDay(state, todayKey());
      if (!sweepDungeon(state, id)) return;
      flyCoins(id === 'coin' ? 6 : 2);
      commit();
    });
    actions.append(enter, sweep);
    card.append(icon, body, actions);
    return card;
  }));
}

function trainingReady() {
  return Object.keys(TRAINING).some(id => state.training[id] < TRAINING[id].cap && state.coins >= trainingCost(state, id));
}

let previousObjective = '';

function renderObjective() {
  const key = state.cleared.join();
  if (key === previousObjective) return;
  previousObjective = key;
  const next = state.cleared.indexOf(false);
  $('objective-label').textContent = next < 0 ? '18개 맵 완료' : '다음 목표';
  $('objective-title').textContent = next < 0 ? '쉬는 시간의 왕 등극!' : `${mapCode(next)} · ${MAPS[next].names[BOSS_WAVE]}`;
  $('objective-reward').textContent = next < 0 ? '지도에서 어떤 맵이든 다시 대결할 수 있어요.'
    : next === MAPS.length - 1 ? `첫 승리 시 ${schoolName(state.cycle + 1)} 진학` : isGradeFinal(next) ? `첫 승리 장비 · ${GEAR[BOSS_REWARDS[gradeIndex(next)]].name}` : `첫 승리 시 ${MAPS[next + 1].place} 해금`;
}

function setText(id, text) {
  const element = $(id);
  if (element.textContent !== text) element.textContent = text;
}

function render() {
  if (!state.profile || editingProfile) return;
  setText('hero-label', state.profile.name);
  $('sound').setAttribute('aria-pressed', String(state.sound));
  setText('level', fmt(state.level));
  setText('coins', fmt(state.coins));
  setText('patches', fmt(state.patches));
  setText('power', fmt(attack(state) * 5 + maxHp(state) / 2 + state.training.speed * 3));
  bar($('xp-fill'), $('xp-fill').parentElement, state.xp, xpTarget(state));
  const gearScore = id => { const stats = gearStats(state, id); return stats.attack * 5 + stats.hp / 2; };
  $('bag-dot').hidden = !state.bag.some(id => gearScore(id) > gearScore(state.equipped[GEAR[id].slot]));
  const missionReady = Object.entries(MISSIONS).some(([id, mission]) => mission.value(state) >= nextMission(state, id).target);
  $('mission-dot').hidden = !(missionReady || state.attendance.last !== todayKey() || dailyReady());
  $('training-dot').hidden = currentView === 'training' || !(trainingReady() || tierReady(state) || academyReady());
  $('gacha-dot').hidden = state.tickets < 1;
  refreshDay(state, todayKey());
  $('battle-dot').hidden = currentView === 'battle' || !Object.keys(DUNGEONS).some(id => dungeonUnlocked(state, id) && dungeonKeys(state, id) > 0);
  if (state.dungeonResult && state.dungeonResult.serial !== shownDungeonResult) {
    if (shownDungeonResult !== null) {
      const result = state.dungeonResult;
      message(`${dungeonInfo(result.id).name}${result.id === 'trial' ? '' : ` Lv.${result.level}`} ${result.sweep ? '소탕' : result.win ? '클리어' : result.reason === 'timeout' ? '시간 초과' : '실패'} · ${result.text}`);
    }
    shownDungeonResult = state.dungeonResult.serial;
  }
  const perkReady = Object.keys(PERKS).some(id => state.prestige.perks[id] < PERKS[id].cap && state.prestige.badges >= perkCost(state, id));
  void perkReady;
  setText('speed-label', `x${state.speed}`);
  $('speed').classList.toggle('fast', state.speed === 2);
  $('speed').setAttribute('aria-pressed', String(state.speed === 2));
  if (lastLevel !== null && state.level > lastLevel) showLevelUp(lastLevel, state.level);
  lastLevel = state.level;
  renderSnacks();
  renderBattle();
  renderMetaHud();
  renderActives();
  renderAllies();
  const viewModels = {
    battle: [state.log, state.dungeons, state.daily?.keys, Boolean(state.dungeon), state.totalClears, state.prestige.count, state.prestige.perks, state.stickers],
    training: [growthTab, Object.keys(TRAINING).map(id => { const plan = trainingPlan(id); return [plan.count, plan.total, state.coins >= plan.total]; }), state.training, firstGradeWon(state), state.classId, buyMode, state.tier, state.level, state.prestige, state.autoSkills, state.skillId, Boolean(state.dungeon), bestProgress(state)],
    party: [state.companions, state.party, state.tier],
    shop: [state.gems, state.daily?.shop, state.premium],
    bag: [state.bag, state.equipped, state.ranks, state.patches, gearFilter, state.profile.gender],
    gacha: [gachaTab, state.tickets, state.coins >= gachaCoinCost(1), state.coins >= gachaCoinCost(10), state.stickers, state.cleared, state.recruits, state.gems],
    grades: [state.map, state.cleared, state.cycle, state.prestige, state.level],
    activities: [state.missions, state.wins, state.cleared, state.bag, state.patches, state.attendance, state.daily, todayKey(), state.pass, passTiers(state), state.premium.pass],
  };
  const fingerprint = JSON.stringify([currentView, viewModels[currentView]]);
  if (fingerprint === previousModel) return;
  previousModel = fingerprint;
  if (currentView === 'battle') {
    renderDungeons();
    $('log').replaceChildren(...state.log.map(text => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }));
  }
  if (currentView === 'training') renderGrowth();
  if (currentView === 'party') renderParty();
  if (currentView === 'shop') renderShop();
  if (currentView === 'bag') renderBag();
  if (currentView === 'gacha') renderGachaView();
  if (currentView === 'grades') renderGrades();
  if (currentView === 'activities') {
    renderMissions();
    renderPass();
  }
}

function commit() { save(); render(); }

function train(id, repeat = false) {
  const { count, total } = trainingPlan(id);
  if (!count || state.training[id] >= TRAINING[id].cap || state.coins < total) return false;
  const before = maxHp(state);
  state.training[id] += count;
  state.coins -= total;
  if (id === 'health' && state.hp > 0) state.hp += maxHp(state) - before;
  refreshDay(state, todayKey());
  state.daily.trains += count;
  if (!repeat || count > 1) message(`${TRAINING[id].name} Lv. ${state.training[id]}`);
  commit();
  return true;
}

function equip(id) {
  if (!state.bag.includes(id)) return;
  const item = GEAR[id];
  const healthRatio = state.hp / maxHp(state);
  state.equipped[item.slot] = id;
  if (state.roundEnd?.result !== 'loss') state.hp = clamp(Math.floor(healthRatio * maxHp(state)), 1, maxHp(state));
  message(`${item.name} 장착!`);
  commit();
}

function upgradeGear(id) {
  if (!state.bag.includes(id) || GEAR[id].starter || (state.ranks[id] || 0) >= MAX_RANK) return;
  const cost = upgradeCost(state, id);
  if (state.patches < cost) return;
  const before = maxHp(state);
  state.patches -= cost;
  state.ranks[id] = (state.ranks[id] || 0) + 1;
  if (state.hp > 0) state.hp += maxHp(state) - before;
  message(`${itemLabel(id)} 강화 완료`);
  commit();
}

function startMap(index) {
  if (state.dungeon) {
    message('던전이 끝나면 이동할 수 있어요.');
    return;
  }
  state.farm = null;
  openFight(state, index, 0, 0.35);
  combatEvent('enter', {});
  state.hp = maxHp(state);
}

function selectView(view) {
  if (view === 'grades' && currentView !== view) expandedGrades = new Set([gradeIndex(state.map)]);
  currentView = view;
  document.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== `view-${view}`; });
  document.querySelectorAll('[data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('panel').scrollTop = 0;
  render();
}

function showProfileEditor() {
  if (state.profile) {
    updateClock();
    save();
  }
  editingProfile = true;
  $('game').hidden = true;
  $('enrollment').hidden = false;
  $('nickname').value = state.profile?.name || '';
  $('profile-error').hidden = true;
  for (const option of $('profile-form').elements.gender) option.checked = option.value === state.profile?.gender;
  $('enroll-submit').firstChild.textContent = state.profile ? '저장하고 돌아가기 ' : '입학하기 ';
  $('cancel-profile').hidden = !state.profile;
  window.scrollTo(0, 0);
}

function enterGame() {
  openedAt = Date.now();
  editingProfile = false;
  $('enrollment').hidden = true;
  $('game').hidden = false;
  if (initialOffline > 0) {
    catchUp(initialOffline);
    initialOffline = 0;
  }
  refreshDay(state, todayKey());
  if (state.attendance.count > 0 && state.attendance.last !== todayKey()) {
    queuePopup(() => {
      renderAttendance($('attend-dialog-list'));
      $('attend-dialog').showModal();
    });
  }
  commit();
}

function start() {
  const snapshot = readSave();
  const restored = restore(snapshot);
  state = restored || newGame();
  if (!restored) welcomeMail(state);
  if (restored) initialOffline = Math.max(0, (openedAt - snapshot.when) / 1000);
  document.addEventListener('pointerdown', unlockAudio);
  $('profile-form').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profile = makeProfile(data.get('nickname'), data.get('gender'));
    if (!profile) {
      $('profile-error').textContent = '닉네임을 1~12자로 입력해 주세요.';
      $('profile-error').hidden = false;
      $('nickname').focus();
      return;
    }
    state.profile = profile;
    unlockAudio();
    enterGame();
  });
  $('nickname').addEventListener('input', () => { $('profile-error').hidden = true; });
  $('profile-button').addEventListener('click', showProfileEditor);
  $('cancel-profile').addEventListener('click', enterGame);
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => selectView(button.dataset.view)));
  bindMetaUI();
  $('skill').addEventListener('click', () => {
    if (!activateSkill(state, combatEvent)) return;
    commit();
  });
  $('skill-picker').addEventListener('click', () => {
    renderSkillChoices();
    $('skill-dialog').showModal();
  });
  $('auto-skill').addEventListener('click', () => {
    state.autoSkill = !state.autoSkill;
    $('auto-skill').setAttribute('aria-checked', String(state.autoSkill));
    commit();
  });
  $('equip-first').addEventListener('click', () => equip('wristband'));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => {
    const next = popupQueue.shift();
    if (next) setTimeout(next, 160);
  }));
  for (const type of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(type, stopHold);
  document.querySelectorAll('#buy-mode button').forEach(button => button.addEventListener('click', () => {
    buyMode = button.dataset.buy === 'max' ? 'max' : Number(button.dataset.buy);
    render();
  }));
  $('speed').addEventListener('click', () => {
    state.speed = state.speed === 2 ? 1 : 2;
    message(state.speed === 2 ? '2배속으로 대결해요.' : '보통 속도로 대결해요.');
    commit();
  });
  $('attend-dialog-claim').addEventListener('click', claimAttendance);
  $('prestige-button').addEventListener('click', openTransfer);
  $('transfer-confirm').addEventListener('click', doTransfer);
  $('gacha-again').addEventListener('click', () => { if (lastPull) pull(lastPull.count, lastPull.currency); });
  $('retry-map').addEventListener('click', () => {
    if (!state.farm || state.roundEnd) return;
    startMap(state.map);
    record(state, `${mapCode(state.map)} 맵에 다시 도전해요.`);
    commit();
  });
  $('sound').addEventListener('click', () => {
    state.sound = !state.sound;
    if (state.sound) unlockAudio();
    message(state.sound ? '대결 효과음 켜짐' : '대결 효과음 꺼짐');
    commit();
  });
  $('advance').addEventListener('click', () => {
    state.autoNext = !state.autoNext;
    message(state.autoNext ? '보스를 이기면 다음 맵으로 이동해요.' : '같은 맵에서 계속 대결해요.');
    commit();
  });
  $('help').addEventListener('click', () => showDialog('쉬는 시간에 대결!', [
    '1학년 주인공은 자동으로 대결해요. 코인으로 훈련하고 가방에서 더 좋은 장비를 착용하세요.',
    '1-3 반장 다온의 방어는 종소리 반격으로 깰 수 있어요. 쏜살 돌진은 반격 뒤 빈틈에 강해요.',
    '보스를 이기면 다음 장소가 열려요. 자동 진격을 끄면 같은 장소에서 코인을 모아요.',
    '졌을 때는 같은 맵에서 반복 수련을 시작해요. 수련에서 3승을 하면 자동으로 다시 도전해요.',
    `게임을 닫아도 최대 ${offlineLimit(state) / 3600}시간 동안 대결과 보상이 쌓여요. 진행 상황은 이 브라우저에 저장돼요.`,
    '6-3 보스를 이기면 해솔초 → 해솔중 → 해솔고 → 전국 리그로 진학해요. 학년마다 딱지치기·지우개 따먹기·피구 같은 놀이 대결 종목이 바뀌어요. 막히면 지도 탭에서 전학을 가고, 명예 배지로 방과 후 학원을 다녀 영구 능력치를 올리세요.',
  ], '?'));
  document.addEventListener('visibilitychange', () => {
    if (editingProfile || !state.profile) return;
    updateClock(document.visibilityState === 'visible');
    commit();
  });
  window.addEventListener('pagehide', () => {
    if (editingProfile || !state.profile) return;
    updateClock(false);
    save();
  });
  if (state.profile) enterGame();
  else showProfileEditor();
  setInterval(() => {
    if (document.visibilityState !== 'visible' || editingProfile || !state.profile) return;
    updateClock();
    render();
  }, 42);
}

start();
