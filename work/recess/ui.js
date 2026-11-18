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
  training: { power: '#i-power', health: '#i-heart', speed: '#i-bolt', focus: '#i-target', critDmg: '#i-star', recover: '#i-plus' },
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
  ready: ['1학년 대표 다온', '방어 뒤 강한 반격을 준비해요.'],
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

// 화면 연출 속도: 배속 × 빠른 복귀(엔진이 그만큼 빨리 돌기 때문에 포즈도 맞춘다)
function motionRate() { return (state?.speed || 1) * (state && rushing(state) ? RUSH_SPEED : 1); }

function setPoses(side, frames) {
  let until = performance.now();
  const rate = motionRate();
  poses[side] = frames.map(([pose, ms]) => ({ pose, from: until, until: (until += ms / rate) }));
}

// 시간표(poses·packPoses·allyPoses)에서 지금 항목과 그 시작·끝·바로 앞 상태(띠 재생이 이어 붙일 때 쓴다)
function activePose(list, now) {
  const index = (list || []).findIndex(entry => entry.until > now);
  if (index < 0) return null;
  const entry = list[index];
  return { pose: entry.pose, from: entry.from ?? (index ? list[index - 1].until : now), until: entry.until, prev: index ? list[index - 1].pose : null };
}

function flashHit(target, detail) {
  const effect = document.createElement('span');
  const emphasis = detail.move !== 'attack' || detail.breaks;
  const game = contest(state);
  effect.className = `impact fx-${game.fx}${detail.blocked ? ' blocked' : ''}${emphasis || detail.lucky ? ' strong' : ''}${detail.breaks ? ' break' : ''}${detail.lucky ? ' lucky' : ''}`;
  effect.setAttribute('aria-hidden', 'true');
  const number = document.createElement('span');
  number.className = 'damage';
  number.textContent = detail.dodged ? '회피!' : detail.shielded && !detail.amount ? '보호막' : detail.breaks ? `방어 풀기 · ${fmt(detail.amount)}` : detail.blocked ? `방어 · ${fmt(detail.amount)}` : detail.lucky ? `크리티컬! ${fmt(detail.amount)}` : `−${fmt(detail.amount)}`;
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
    const special = event.side === 'player' && heroSkillPose(event.move);
    setPoses(event.side, special ? [[special[0], event.windup * 1000 + 20]] : [['windup', 75], [launch, event.windup * 1000 - 55]]);
  }
  if (type === 'boss' && event.phase === 'counter') setPoses('rival', [['windup', 505], ['launch', 180]]);
  if (type === 'impact') {
    const target = event.side === 'player' ? 'rival' : 'player';
    const special = event.side === 'player' && heroSkillPose(event.move);
    setPoses(event.side, special ? [[special[1], 180], ['follow', 170]] : [['strike', 110], ['follow', 170]]);
    animImpact(event.breaks || event.lucky || (event.move !== 'attack' && event.move !== 'crit') || (event.side === 'rival' && isDaon(state) && state.bossPhase === 'counter'));
    setPoses(target, [[event.blocked ? 'guard' : 'hit', event.breaks ? 240 : 160]]);
    if (!reducedMotion.matches) flashHit(target, event);
    if (event.side === 'rival' && aliveBehind(state)) packAct('strike', 1 + Math.floor(Math.random() * 2), 260);
    if (event.side === 'player' && event.move !== 'attack' && event.move !== 'crit') packAct('hit', 0, 220);
    playSound(event.blocked ? 'guard' : ['rush', 'bell', 'counter'].includes(event.move) ? event.move : 'hit');
  }
  if (type === 'finish' && event.result === 'win' && (event.boss || event.reward)) playSound('win');
  if (type === 'finish' && event.result === 'win') flyCoins(event.boss ? 6 : 2);
  if (type === 'finish') lastFinish = { result: event.result, boss: event.boss };
  if (type === 'kill') flyCoins(1);
  if (type === 'enter') renderedContest = '';
  if (type === 'ally') onAlly(event);
  if (type === 'mate') onMate(event);
  if (type === 'shard') onShard(event);
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
    const timed = activePose(poses[side], now);
    const action = timed?.pose;
    let resting = 'ready';
    if (state.roundEnd) {
      const won = state.roundEnd.result === 'win';
      resting = side === 'player' ? (won ? 'victory' : 'lose') : (won ? 'down' : 'victory');
    } else if (state.pause > 0) resting = 'step';
    else if (side === 'rival' && phase === 'guard') resting = 'guard';
    else if (side === 'rival' && phase === 'counter') resting = 'windup';
    else if (side === 'rival' && (phase === 'open' || phase === 'broken')) resting = 'open';
    else if (side === 'player' ? state.playerMove : state.enemyMove) resting = 'windup';
    const sprite = $(`${side}-sprite`);
    let next = action || resting;
    // 띠 그림이 있으면 대기 숨 고르기는 띠가 맡는다(정지 그림 두 장을 0.7초마다 바꾸던 깜빡임 없음)
    if (next === 'ready' && side === 'player' && $('arena').dataset.motion !== 'spar' && !sprite.classList.contains('anim-on') && Math.floor(now / 700) % 2) next = 'ready-b';
    if (side === 'player' && /(^|-)strike$/.test(next) && !/(^|-)strike$/.test(sprite.dataset.pose || '')) heroTrail(sprite);
    if (sprite.dataset.pose !== next) sprite.dataset.pose = next;
    animate(sprite, next, action ? timed : null);
  }
}

// 주인공 잔상: 타격 순간에 바로 앞 자세(아직 캔버스에 남은 그림)를 반투명하게 남겨 앞으로 확 뻗는 느낌을 준다(0.18초)
function heroTrail(sprite) {
  if (reducedMotion.matches || !sprite.classList.contains('anim-on') || $('arena').dataset.motion === 'spar') return;
  const source = sprite.querySelector('canvas.anim');
  const fighter = sprite.parentElement;
  if (!source || !fighter) return;
  const box = source.getBoundingClientRect();
  const base = fighter.getBoundingClientRect();
  if (!box.width) return;
  const ghost = document.createElement('canvas');
  ghost.width = source.width;
  ghost.height = source.height;
  ghost.getContext('2d').drawImage(source, 0, 0);
  ghost.className = 'hero-trail';
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, { left: `${box.left - base.left}px`, top: `${box.top - base.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  fighter.append(ghost);
  setTimeout(() => ghost.remove(), 220);
}

// 필살기(돌진 스트레이트·공 울림 카운터)는 전용 포즈. 태권도(보호구)에서는 기본 동작
const HERO_SKILL_POSES = { rush: ['skill-rush-windup', 'skill-rush-strike'], bell: ['skill-counter-guard', 'skill-counter-strike'], counter: ['skill-counter-guard', 'skill-counter-strike'] };
function heroSkillPose(move) { return $('arena').dataset.motion !== 'spar' && HERO_SKILL_POSES[move]; }

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

// 쉬는 시간 보상·빠른 휴식 결과 줄: 이긴 횟수, 코인, 레벨, 뽑기권, 새 장비, 나아간 곳
function restLines(before, label) {
  const lines = [`${label} 동안 ${fmt(state.wins - before.wins)}번 이겼어요.`, `코인 +${fmt(state.coins - before.coins)}`];
  if (state.level > before.level) lines.push(`레벨 ${before.level} → ${state.level}`);
  if (state.tickets > before.tickets) lines.push(`뽑기권 +${state.tickets - before.tickets}`);
  if (state.bag.length > before.bag) lines.push(`새 장비 ${state.bag.length - before.bag}개가 가방에 있어요.`);
  if (before.progress !== undefined && progress(state) > before.progress) lines.push(`${placeLabel(progress(state))}까지 나아갔어요.`);
  return lines;
}

function catchUp(seconds) {
  const adjusted = Math.min(seconds, offlineLimit(state));
  const before = { wins: state.wins, coins: state.coins, level: state.level, bag: state.bag.length, tickets: state.tickets, progress: progress(state) };
  const speed = state.speed;
  const dayBefore = state.daily?.date;
  state.speed = 1;
  simulate(state, adjusted, null);
  state.speed = speed;
  const wins = state.wins - before.wins;
  // 방치 구간이 운영 날짜를 넘겼으면 오늘 0시 이후에 해당하는 몫만 오늘 목표(대결 이기기)에 넣는다.
  // 계산한 방치 시간은 지금까지의 마지막 구간으로 본다(최대 시간을 넘긴 앞부분은 계산하지 않음)
  const today = gameDay(state);
  if (dayBefore && dayBefore < today) {
    const share = clamp((Date.now() - dayStart(today)) / 1000 / Math.max(1, adjusted), 0, 1);
    refreshDay(state, today, Math.round(wins * share));
  }
  if (wins === 0 || adjusted < 15) return;
  const details = restLines(before, displayOffline(adjusted));
  const gained = state.coins - before.coins;
  queuePopup(() => {
    showDialog('쉬는 시간 보상', details, '#i-gift');
    $('dialog-content').classList.add('reward-lines');
    offerOfflineDouble(gained, adjusted);
  });
}

// 빠른 휴식(대결 탭 카드·오늘 화면 바로 가기): 2시간 동안의 대결을 바로 받고 결과 창을 띄운다
function onQuickRest() {
  const result = quickRest(state, gameDay(state));
  if (!result) return;
  showDialog('빠른 휴식 보상', [...restLines(result.before, '2시간'), result.cost ? `보석 ${result.cost}개를 썼어요.` : '오늘 무료 휴식을 썼어요.'], '#i-moon');
  $('dialog-content').classList.add('reward-lines');
  flyCoins(6);
  commit();
}

function helpButton(title, lines) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'help-btn';
  button.textContent = '?';
  button.ariaLabel = `${title} 도움말`;
  button.addEventListener('click', event => {
    event.stopPropagation();
    showDialog(title, typeof lines === 'function' ? lines() : lines, '#i-help');
  });
  return button;
}

// 제목 옆 '?': 제목 아래 설명 줄(.keep 제외)은 숨기고 누르면 그때 내용을 보여 준다
function bindSectionHelp() {
  document.querySelectorAll('.section-head > div > p:not(.keep)').forEach(note => {
    const heading = note.parentElement.querySelector('h2, h3');
    if (!heading || heading.nextElementSibling?.classList.contains('help-btn')) return;
    note.classList.add('help-note');
    heading.after(helpButton(heading.textContent.trim(), () => [note.textContent.trim()].filter(Boolean)));
  });
}

function restCard() {
  refreshDay(state, gameDay(state));
  const used = restUsed(state);
  const total = QUICK_REST.costs.length;
  const cost = restCost(state);
  const blocked = restBlocked(state);
  const card = document.createElement('article');
  card.className = `rest-card${cost === 0 && !blocked ? ' free' : ''}`;
  card.id = 'rest-card';
  const icon = document.createElement('span');
  icon.className = 'item-icon';
  icon.dataset.tone = 'blue';
  setIcon(icon, '#i-moon');
  const body = document.createElement('div');
  body.className = 'rest-body';
  const title = document.createElement('b');
  title.append(Object.assign(document.createElement('span'), { className: 'item-name', textContent: '빠른 휴식' }),
    Object.assign(document.createElement('em'), { className: 'lv', textContent: `오늘 ${used}/${total}번` }));
  title.append(helpButton('빠른 휴식', ['2시간 동안의 대결(코인·경험치·장비·진행)을 바로 받아요.', `하루 ${total}번 · 첫 번 무료, 다음은 보석 ${QUICK_REST.costs.slice(1).join('·')} · 한국 시간 0시에 다시 채워져요.`]));
  const pips = document.createElement('span');
  pips.className = 'rest-pips';
  pips.ariaLabel = `오늘 ${total - used}번 남음`;
  for (let index = 0; index < total; index++) pips.append(Object.assign(document.createElement('i'), { className: index < used ? '' : 'on' }));
  const time = Object.assign(document.createElement('small'), { className: 'rest-time', textContent: '⏱ 2시간' });
  const meta = document.createElement('div');
  meta.className = 'rest-meta';
  meta.append(time, pips);
  body.append(title, meta);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rest-go';
  button.textContent = blocked === 'used' ? '내일 다시' : blocked === 'dungeon' ? '대회 끝나고' : cost === 0 ? '무료로 쉬기' : `보석 ${cost}으로 쉬기`;
  button.ariaLabel = cost === null ? '빠른 휴식 오늘 다 씀' : `빠른 휴식 2시간 받기, ${cost ? `보석 ${cost}` : '무료'}`;
  button.disabled = Boolean(blocked);
  button.addEventListener('click', onQuickRest);
  card.append(icon, body, button);
  return card;
}
// 오늘 무료 휴식이 남았는지(날짜가 바뀌었으면 아직 안 쓴 것으로 본다) · 대결 탭 빨간 점, 오늘 화면 바로 가기
function freeRestReady() {
  if (state.dungeon || state.roundEnd?.leaveDungeon) return false;
  return !state.daily || state.daily.date < gameDay(state) || restUsed(state) === 0;
}

function updateClock(animate = true) {
  if (!state.profile || editingProfile) return;
  const now = Date.now();
  const elapsed = Math.max(0, (now - openedAt) / 1000);
  openedAt = now;
  if (elapsed >= 15) catchUp(elapsed);
  else simulate(state, elapsed * (state.speed || 1), animate ? combatEvent : null);
  runAutoTrain();
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

function protectiveSprite(id) {
  if (/^(mate|thug)/.test(id)) return '';
  const seed = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ['sport-blue', 'sport-red', 'sport-green'][seed % 3];
}

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
      sprite.dataset.spar = protectiveSprite(mob.sprite);
      sprite.dataset.pose = 'ready';
      slot.append(meter, sprite);
      return slot;
    }));
  }
  pack.slice(0, PACK_SLOTS.length).forEach((mob, index) => {
    const slot = box.children[index];
    if (slot) slot.querySelector('.pack-hp i').style.width = `${clamp(mob.hp / mob.max, 0, 1) * 100}%`;
  });
  renderPackPoses();
}

function renderPackPoses(now = performance.now()) {
  for (const [index, slot] of Array.from($('pack').children).entries()) {
    const sprite = slot.querySelector('.sprite');
    const timed = activePose(packPoses.get(index), now);
    const pose = timed?.pose || 'ready';
    if (sprite.dataset.pose !== pose) sprite.dataset.pose = pose;
    animate(sprite, pose, timed);
  }
}

// 화면 주사율(초당 약 60번)로 상태 → 포즈만 갱신한다. 나머지 화면(render)은 그대로 42ms마다
function renderPoses(now) {
  if (document.visibilityState !== 'visible' || editingProfile || !state?.profile) return;
  renderMotion();
  renderPackPoses(now);
  renderAllyPoses(now);
}

function packAct(pose, count, ms) {
  const alive = Math.min(PACK_SLOTS.length, aliveBehind(state));
  if (!alive) return;
  const picks = pose === 'hit' ? [...Array(alive).keys()] : [...Array(alive).keys()].sort(() => Math.random() - 0.5).slice(0, count);
  const now = performance.now();
  const rate = motionRate();
  for (const index of picks) {
    const delay = pose === 'hit' ? 0 : Math.random() * 120;
    if (pose === 'hit') packPoses.set(index, [{ pose: 'hit', from: now, until: now + ms / rate }]);
    else packPoses.set(index, [{ pose: 'ready', from: now, until: now + delay }, { pose: 'windup', until: now + delay + 90 / rate }, { pose: 'strike', until: now + delay + ms / rate }]);
  }
}

function renderDungeonTimer() {
  const boss = !state.dungeon && !state.farm && state.wave === BOSS_WAVE;
  const active = (state.dungeon || boss) && !state.roundEnd;
  $('dungeon-timer').hidden = !active;
  if (!active) return;
  const left = Math.max(0, state.dungeon ? state.dungeon.time : state.bossTime);
  const total = state.dungeon ? DUNGEON_TIME : BOSS_TIME;
  setText('dungeon-timer-title', state.dungeon ? (state.dungeon.id === 'cup' ? `${CUP.name} ${cupStep(state)}단계 · ${cupInfo(state).rule.name}` : `${dungeonInfo(state.dungeon.id).name} Lv.${state.dungeon.level}`) : `보스 도전 · ${currentEnemy(state)}`);
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
  const rule = ruleId(state);
  const key = `${id}|${rule}`;
  if (key === renderedContest) return;
  renderedContest = key;
  setText('contest-name', rule ? `${CONTESTS[id].name} · ${RULES[rule].name}` : CONTESTS[id].name);
  $('contest-chip').dataset.rule = rule || '';
  $('contest-chip').dataset.contest = id;
  $('arena').dataset.contest = id;
  $('arena').dataset.motion = CONTESTS[id].motion;
}

// 종목 도구는 해당 놀이의 높이와 방향을 따라 움직인다.
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
  renderTravel();
}

// ── 전진 연출: 승리하면 파티가 다음 교전 지점으로 뛰고 배경이 왼쪽으로 흐른다 ──
// forward = 같은 장소에서 다음 무리로(배경을 앞으로 흘림), exit = 보스를 이기고 다음 장소로(옛 배경은 왼쪽으로 빠지고 새 배경이 오른쪽에서 들어옴),
// cut = 패배 뒤 수련·지도 선택·던전·재입학처럼 다른 자리로 옮길 때(짧은 장면 전환, 뒤로 감지 않음).
// 승리·패배 포즈가 끝날 때까지(roundEnd) 출발 장소를 그대로 둔다. 진행·보상은 엔진 그대로이고 화면만 맞춘다.
const PAN = [8, 36, 64, 92];
// 정문과 기숙사 복도는 한 장의 배경에서 왼쪽부터 차례로 진행한다.
const ACADEMY_ENTRY_PAN = [
  [1, 11, 22, 34],
  [52, 66, 80, 97],
];
let travel = null;
let lastFinish = null;
function travelTarget() {
  const dungeon = state.dungeon ? dungeonInfo(state.dungeon.id) : null;
  const art = String(dungeon ? (dungeon.background || dungeon.map + 1) : venueMap(state) || state.map + 1);
  const entryPan = !dungeon && !state.cycle ? ACADEMY_ENTRY_PAN[state.map]?.[state.wave] : undefined;
  return {
    art,
    track: entryPan === undefined ? art : 'academy-entry',
    pan: entryPan ?? (dungeon ? 50 : PAN[state.wave] ?? 50),
    dungeon: Boolean(dungeon),
  };
}
function renderTravel() {
  if (travel && state.roundEnd) return;
  const next = travelTarget();
  const finish = lastFinish;
  lastFinish = null;
  const sameTrack = travel?.track === next.track;
  if (sameTrack && travel.art === next.art && travel.pan === next.pan) return;
  const won = travel && finish?.result === 'win' && !next.dungeon && !travel.dungeon;
  const mode = !travel ? 'set' : reducedMotion.matches ? 'cut'
    : won && sameTrack && next.pan > travel.pan ? 'forward'
      : won && finish.boss && !sameTrack ? 'exit' : 'cut';
  const arena = $('arena');
  const art = arena.querySelector('.arena-art:not(.leaving)');
  const rate = motionRate();
  if (mode === 'exit') {
    const ghost = art.cloneNode();
    ghost.classList.remove('entering', 'cut');
    ghost.classList.add('leaving');
    ghost.style.setProperty('--map-image', getComputedStyle(arena).getPropertyValue('--map-image'));
    ghost.style.setProperty('--pan', `${travel.pan}%`);
    ghost.style.transition = 'none';
    ghost.style.animationDuration = `${720 / rate}ms`;
    art.after(ghost);
    setTimeout(() => ghost.remove(), 760 / rate);
  }
  art.classList.remove('entering', 'cut');
  art.style.transition = mode === 'forward' ? `background-position ${820 / rate}ms cubic-bezier(.35, 0, .25, 1)` : 'none';
  arena.dataset.map = next.art;
  arena.dataset.track = next.track;
  arena.style.setProperty('--pan', `${next.pan}%`);
  arena.dataset.travel = mode;
  if (mode === 'exit' || mode === 'cut') {
    void art.offsetWidth;
    art.style.animationDuration = `${(mode === 'exit' ? 720 : 320) / rate}ms`;
    art.classList.add(mode === 'exit' ? 'entering' : 'cut');
  }
  if (mode === 'forward' || mode === 'exit') travelRun(mode === 'exit' ? 720 : 620);
  travel = next;
}
// 이동하는 동안 주인공·동료는 달리고, 새 상대는 오른쪽에서 드러난다
function travelRun(ms) {
  const rate = motionRate();
  setPoses('player', [['run', ms]]);
  const now = performance.now();
  for (let slot = 0; slot < PARTY_MAX; slot++) allyPoses.set(String(slot), [{ pose: 'step', from: now, until: now + ms / rate }]);
  for (const id of ['allies', 'rival', 'pack']) {
    const box = $(id);
    box.classList.remove('traveling');
    void box.offsetWidth;
    box.style.setProperty('--travel-ms', `${ms / rate}ms`);
    box.classList.add('traveling');
  }
  clearTimeout(travelRun.timer);
  travelRun.timer = setTimeout(() => ['allies', 'rival', 'pack'].forEach(id => $(id).classList.remove('traveling')), ms / rate + 40);
}

function renderBattle() {
  const map = MAPS[state.map];
  const gradeNumber = gradeIndex(state.map) + 1;
  const dungeon = state.dungeon ? dungeonInfo(state.dungeon.id) : null;
  if (!(travel && state.roundEnd)) setText('stage-number', dungeon ? (state.dungeon.id === 'trial' ? `승급 심사 · ${tierName(state.dungeon.level)}` : state.dungeon.id === 'cup' ? `주간 전국대회 · ${cupInfo(state).rule.name}` : `던전 · Lv.${state.dungeon.level}`) : stageLabel(state.cycle || 0, state.map));
  if (!(travel && state.roundEnd)) setText('battle-title', dungeon ? dungeon.name : stagePlace(state.cycle || 0, state.map));
  $('arena').classList.toggle('dungeon-round', Boolean(dungeon));
  const status = $('battle-status');
  const resting = state.roundEnd?.result === 'loss';
  setText('battle-status', resting ? '잠깐 쉬는 중' : state.roundEnd ? '승리' : state.dungeon?.id === 'record' ? '기록 측정 중' : state.dungeonChain ? `연속 도전 ${state.dungeonChain.wins}승` : dungeon ? '던전 도전 중' : rushing(state) ? `빠른 복귀 ×${RUSH_SPEED}` : state.farm ? '반복 수련 중' : '자동 대결 중');
  status.classList.toggle('rush', !dungeon && rushing(state));
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
    const sprite = $('rival-sprite');
    sprite.dataset.sprite = front?.sprite || rivalSprite(state.map, state.wave, state.cycle || 0);
    sprite.dataset.spar = protectiveSprite(sprite.dataset.sprite);
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
  setText('round-label', dungeon ? (behind ? `참가자 ${behind + 1}명 남음` : '던전 보스전') : finalBoss ? (state.cycle ? (gradeIndex(state.map) === GRADE_COUNT - 1 ? '지역 챔피언전' : '관장전') : '학년 대표전') : boss ? '보스 대결' : `대결 ${state.wave + 1}/${BOSS_WAVE + 1} · ${behind + 1}명`);
  renderPack();
  renderDungeonTimer();
  renderKills();
  renderContest();
  $('player-name').textContent = state.profile.name;
  $('player-sprite').dataset.sprite = state.profile.gender;
  $('player-tag').textContent = `LV. ${state.level}`;
  setText('rival-tag', dungeon ? (state.front?.leader ? '던전 보스' : '참가자') : state.farm ? '수련' : boss ? '보스' : state.front?.leader ? '대장' : state.cycle ? '도전자' : `${gradeNumber}학년`);
  $('rival-name').textContent = currentEnemy(state);
  const totalHp = maxHp(state);
  const totalEnemy = enemyMaxHp(state);
  $('hp-text').textContent = `${fmt(state.hp)} / ${fmt(totalHp)}`;
  $('enemy-text').textContent = state.dungeon?.id === 'record' ? `누적 피해 ${fmt(Math.max(0, totalEnemy - state.enemyHp))}` : `${fmt(state.enemyHp)} / ${fmt(totalEnemy)}`;
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
  $('roster-note').textContent = `${mapCode(state.map)} ${stagePlace(state.cycle || 0, state.map)} · ${state.farm ? '반복 수련 중이에요. 3승하면 다시 도전해요.' : '넷을 모두 이기면 다음 장소가 열려요.'}`;
  $('roster').replaceChildren(...stageNames(state.cycle || 0, state.map).map((name, wave) => {
    const entry = document.createElement('li');
    const status = state.farm ? 'upcoming' : wave < state.wave ? 'past' : wave === state.wave ? 'current' : 'upcoming';
    entry.className = `rival-card ${status}${wave === BOSS_WAVE ? ' boss' : ''}`;
    const figure = document.createElement('span');
    figure.className = 'rival-figure';
    figure.ariaHidden = 'true';
    const sprite = document.createElement('span');
    sprite.className = 'sprite';
    sprite.dataset.sprite = rivalSprite(state.map, wave, state.cycle || 0);
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
    icon.dataset.map = stageArt(state.cycle || 0, map);
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

const TRAINING_TONES = { power: 'red', health: 'pink', speed: 'yellow', focus: 'teal', critDmg: 'blue', recover: 'green' };
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
    const milestone = info.milestone ? ` · ×2까지 ${MILESTONE - level % MILESTONE}` : '';
    const article = row(ICONS.training[id] || info.glyph, info.name, capped ? `최대 · ${info.bonus}` : `${info.bonus}${milestone}`, capped ? '최대' : single ? '강화' : `+${count}`, () => train(id), {
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
  $('auto-train').setAttribute('aria-checked', String(state.autoTrain));
  $('class-note').textContent = firstGradeWon(state) ? '전공 하나를 골라 대결 보너스를 받으세요.' : '1-3 신입생 체육관의 1학년 대표를 이기면 전공을 고를 수 있어요.';
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
  if (reward.keys) add('key', reward.keys);
  if (reward.shardPicks) add('shard-pick', reward.shardPicks);
  if (reward.title) {
    const chip = document.createElement('span');
    chip.className = 'reward-chip title-chip';
    chip.textContent = '칭호';
    wrap.append(chip);
  }
  return wrap;
}

function attendanceState() {
  const claimedToday = state.attendance.last >= gameDay(state);
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

function onClaimAttendance() {
  const given = claimAttendance(state);
  if (!given) return;
  message(`출석 보상 · ${rewardText(given)}`);
  commit();
}

// 출석 + 다 채운 오늘 목표 + 모두 완료 보너스를 한 번에
function onClaimToday() {
  const result = claimToday(state);
  if (!result) return;
  message(`오늘 보상 ${result.count}개 · ${rewardText(result.given)}`);
  commit();
}

function todayReadyCount() {
  return (attendanceState().claimedToday ? 0 : 1) + dailyReadyIds(state).length;
}

function renderDaily() {
  refreshDay(state, gameDay(state));
  const ready = todayReadyCount();
  const claimAll = $('daily-claim-all');
  claimAll.disabled = !ready;
  claimAll.textContent = ready ? `한 번에 받기 ${ready}` : '받을 보상 없음';
  $('daily-list').replaceChildren(...[...dailyPicks(state), 'all'].map(id => {
    const mission = DAILY_MISSIONS[id];
    const value = Math.max(0, mission.value(state));
    const claimed = state.daily.claimed.includes(id);
    const ready = value >= mission.target && !claimed;
    const article = row(ICONS.daily[id], mission.name, '', claimed ? '완료' : ready ? '받기' : '진행 중', () => {
      const given = claimDaily(state, id);
      if (!given) return;
      message(`오늘 목표 보상 · ${rewardText(given)}`);
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
  if (!state.daily || state.daily.date !== gameDay(state)) return false;
  return dailyReadyIds(state).length > 0;
}

// ── 오늘 화면: 새 날 첫 접속에 출석·오늘 목표 3개·바로 가기를 한 화면에. 목표 탭의 '오늘 한눈에'로도 연다 ──
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function todayLinks() {
  const links = [];
  if (freeRestReady()) links.push(['rest', `빠른 휴식 · 2시간치 무료로 받기`]);
  if (state.farm && !state.roundEnd && !state.dungeon) {
    links.push(['retry', `막힌 보스 재도전 · ${mapCode(state.map)}`]);
  }
  const keys = Object.keys(DUNGEONS).filter(id => dungeonUnlocked(state, id)).reduce((sum, id) => sum + (state.daily.keys[id] || 0), 0);
  if (keys > 0) links.push(['dungeon', `오늘 열린 특별 대회 · 열쇠 ${keys}개`]);
  if (recordUnlocked(state) && recordKeys(state) > 0) links.push(['record', `30초 기록전 · ${recordKeys(state)}번 남음`]);
  refreshWeek(state, gameDay(state));
  const cupLeft = cupUnlocked(state) ? cupKeys(state) : 0;
  links.push(['weekly', `주간 전국대회 · ${fmt(state.weekly.points)}/${WEEKLY.tiers.at(-1).points}점${cupLeft ? ` · 챔피언전 ${cupLeft}번` : ''}`]);
  return links;
}

function renderToday() {
  const today = gameDay(state);
  refreshDay(state, today);
  const date = new Date(dayStart(today) + 12 * 3600 * 1000);
  setText('today-date', `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 ${WEEKDAYS[date.getUTCDay()]}요일 · 한국 시간 0시에 바뀌어요`);
  const { claimedToday, done } = attendanceState();
  setText('today-attend-note', claimedToday ? `${done}/7일 받음` : `오늘 ${done + 1}일째`);
  // 7칸 점 줄(받음 ✓ · 오늘 · 남은 날, 7일째는 큰 보상)과 오늘 받을(받은) 보상
  $('today-attend').replaceChildren(...ATTENDANCE.map((_, day) => {
    const cell = document.createElement('li');
    const status = day < done ? 'claimed' : day === done && !claimedToday ? 'today' : 'later';
    cell.className = `today-day ${status}${day === ATTENDANCE.length - 1 ? ' big' : ''}`;
    cell.textContent = status === 'claimed' ? '✓' : String(day + 1);
    cell.ariaLabel = `${day + 1}일째${status === 'claimed' ? ' 받음' : status === 'today' ? ' 오늘' : ''}`;
    return cell;
  }));
  const todayReward = ATTENDANCE[(claimedToday ? state.attendance.count - 1 : state.attendance.count) % ATTENDANCE.length];
  const rewardLine = $('today-attend-reward');
  rewardLine.replaceChildren(Object.assign(document.createElement('small'), { textContent: claimedToday ? '오늘 받은 출석 보상' : '오늘 출석 보상' }), rewardChips(todayReward));
  rewardLine.classList.toggle('done', claimedToday);
  const picks = dailyPicks(state);
  setText('today-goals-note', `${picks.filter(id => state.daily.claimed.includes(id)).length}/${picks.length} 완료`);
  $('today-goals').replaceChildren(...[...picks, 'all'].map(id => {
    const mission = DAILY_MISSIONS[id];
    const value = Math.max(0, Math.min(mission.value(state), mission.target));
    const claimed = state.daily.claimed.includes(id);
    const ready = !claimed && value >= mission.target;
    const item = document.createElement('li');
    item.className = `today-goal${claimed ? ' claimed' : ready ? ' ready' : ''}${id === 'all' ? ' bonus' : ''}`;
    item.dataset.goal = id;
    const name = document.createElement('b');
    name.textContent = mission.name;
    const meter = document.createElement('span');
    meter.className = 'today-meter';
    const fill = document.createElement('i');
    fill.style.width = `${(claimed ? 1 : value / mission.target) * 100}%`;
    meter.append(fill);
    const count = document.createElement('small');
    count.className = 'today-count';
    count.textContent = claimed ? '받음' : ready ? '받기 가능' : `${value}/${mission.target}`;
    const reward = rewardChips(mission.reward);
    reward.classList.add('today-reward');
    item.append(name, reward, meter, count);
    return item;
  }));
  $('today-links').replaceChildren(...todayLinks().map(([kind, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.link = kind;
    button.textContent = label;
    return button;
  }));
  const ready = todayReadyCount();
  const claim = $('today-claim');
  claim.disabled = !ready;
  claim.textContent = ready ? `한 번에 받기 (${ready}개)` : '오늘 받을 보상을 다 받았어요';
}

function openToday() {
  renderToday();
  if (!$('today-dialog').open) $('today-dialog').showModal();
}

function onTodayLink(kind) {
  $('today-dialog').close();
  selectView('battle');
  if (kind === 'retry') $('retry-map').click();
  else if (kind === 'rest') onQuickRest();
  else document.querySelector(kind === 'record' ? '#dungeon-list .dungeon-card.record' : kind === 'weekly' ? '#weekly-card' : '#dungeon-list')?.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
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
  button.addEventListener('click', onClaimAttendance);
  claim.append(button);
  $('attendance').append(claim);
  renderDaily();
  $('mission-list').replaceChildren(...Object.entries(MISSIONS).map(([id, mission]) => {
    const { target, coins, patches } = nextMission(state, id);
    const maximum = id === 'clears' ? Infinity : id === 'closet' ? Object.values(GEAR).filter(item => !item.starter).length : Infinity;
    const allDone = target > maximum;
    const value = mission.value(state);
    const ready = value >= target;
    const reward = `코인 ${fmt(coins)} · 천 조각 ${patches}`;
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
  setText('prestige-stats', `재입학 ${fmt(p.count)}번 · 최고 기록 ${placeLabel(Math.max(1, Math.max(p.best, reached)) - 1)} · 받은 배지 ${fmt(p.earned)}개`);
  const button = $('prestige-button');
  button.disabled = gain <= 0;
  setText('prestige-gain', gain > 0 ? `지금 재입학하면 명예 배지 +${fmt(gain)}` : `아카데미 2-3까지 이기면 재입학할 수 있어요 (지금 ${reached}/${PRESTIGE_UNLOCK})`);
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
  const until = rushEnd(Math.max(state.prestige.best, progress(state)));
  $('transfer-rush').hidden = !until;
  setText('transfer-rush', until ? `빠른 복귀: 아카데미 정문부터 ${placeLabel(until)}까지 ${RUSH_SPEED}배 속도로 달려요. 지면 그 자리부터 보통 속도예요.` : '');
  $('transfer-dialog').showModal();
}

function doTransfer() {
  const gain = transfer(state);
  if (!gain) return;
  combatEvent('enter', {});
  renderedRound = '';
  previousObjective = '';
  openView('training:academy');
  showDialog('다시 입학!', [`${state.prestige.count}번째 재입학이에요. 아카데미 1학년 정문부터 다시 시작해요.`, `명예 배지 +${fmt(gain)}`, '아래 명예 코칭에서 배지로 영구 능력치를 올리세요.'], '#i-star');
  $('dialog-content').classList.add('reward-lines');
  commit();
}

// 전국 제패 목록: 최고 기록 기준으로 제패한 지역을 칠하고, 지금 도전 중인 지역을 표시한다
function renderRegions() {
  const done = REGIONS.filter((_, index) => regionConquered(state, index)).length;
  setText('region-count', `${done} / ${REGIONS.length}`);
  $('region-list').replaceChildren(...REGIONS.map((name, index) => {
    const item = document.createElement('li');
    const now = regionIndex(state.cycle) === index;
    item.className = `region${regionConquered(state, index) ? ' done' : ''}${now ? ' now' : ''}`;
    item.textContent = now && roundTag(state.cycle) ? `${name} ${roundTag(state.cycle)}` : name;
    if (now) item.setAttribute('aria-current', 'step');
    return item;
  }));
}

function renderGrades() {
  renderPrestige();
  setText('grades-title', state.cycle ? `${schoolName(state.cycle)} 제패 지도` : '아카데미 지도');
  $('grade-count').textContent = `${state.cleared.filter(Boolean).length} / ${MAPS.length} 완료`;
  renderRegions();
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
    title.append(gradeLabel(state.cycle || 0, grade * MAPS_PER_GRADE));
    const count = document.createElement('small');
    count.textContent = unlocked(state, firstMap) ? `${state.cleared.slice(firstMap, end).filter(Boolean).length} / ${MAPS_PER_GRADE}` : '잠김';
    title.append(count);
    const list = document.createElement('div');
    list.className = 'map-list';
    for (let index = firstMap; index < end; index++) {
      const map = { place: stagePlace(state.cycle || 0, index), names: stageNames(state.cycle || 0, index) };
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
  art.dataset.sticker = id;
  art.ariaHidden = 'true';
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
    : '';
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
  refreshDay(state, gameDay(state));
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
  refreshDay(state, gameDay(state));
  state.daily.snacks++;
  message(`${SNACKS[id].name} 냠! ${SNACKS[id].label} · 15분`);
  commit();
}

// 졸업·지역 제패 축하
let lastCycle = null;
function showSchool() {
  const dialog = $('school-dialog');
  if (!dialog || dialog.open) return;
  // 쉬는 시간 보상·빠른 휴식 결과 창이 열려 있으면 닫지 않고, 그 창을 닫은 다음에 축하 창을 띄운다
  if (anyDialogOpen()) { popupQueue.push(showSchool); return; }
  $('school-sprite').dataset.portrait = state.profile.gender === 'boy' ? 'boy-win' : state.profile.gender;
  const cycle = state.cycle;
  setText('school-title', cycle === 1 ? '아카데미 졸업!' : `${schoolName(cycle - 1)} 제패!`);
  const conquered = Math.min(regionIndex(cycle), REGIONS.length);
  setText('school-text', cycle === 1
    ? `4학년 과정을 마쳤어요. 이제 ${schoolName(1)}부터 한국 곳곳의 격투 대회를 제패해요.`
    : `${schoolName(cycle - 1)} 챔피언이 됐어요. 전국 제패 ${conquered}/${REGIONS.length} · 다음 목표는 ${schoolName(cycle)}. 상대도 상금도 커져요.`);
  document.querySelectorAll('dialog[open]').forEach(open => open.close());
  dialog.showModal();
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
    if (!open) info.textContent = dungeon.unlock === 'transfer' ? '첫 재입학 후 열려요' : '1-3 1학년 대표를 이기면 열려요';
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
      refreshDay(state, gameDay(state));
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
      refreshDay(state, gameDay(state));
      if (!sweepDungeon(state, id)) return;
      flyCoins(id === 'coin' ? 6 : 2);
      commit();
    });
    actions.append(enter, sweep);
    const auto = document.createElement('button');
    auto.type = 'button';
    auto.className = 'dungeon-auto';
    auto.setAttribute('role', 'switch');
    auto.setAttribute('aria-checked', String(state.dungeonAuto?.[id] === true));
    auto.textContent = '승리하면 다음 단계';
    auto.ariaLabel = `${dungeon.name} 승리하면 다음 단계로 이어서 도전`;
    auto.disabled = !open;
    auto.addEventListener('click', () => {
      state.dungeonAuto = { ...state.dungeonAuto, [id]: !state.dungeonAuto?.[id] };
      message(state.dungeonAuto[id] ? `${dungeon.name}: 이기고 열쇠가 남으면 바로 다음 단계로 이어가요.` : `${dungeon.name}: 한 단계씩 도전해요.`);
      commit();
    });
    body.append(auto);
    card.append(icon, body, actions);
    return card;
  }).flatMap(card => (card.classList.contains('coin') ? [card, recordCard()] : [card])));
  $('dungeon-list').prepend(restCard(), weeklyCard());
}

// ── 주간 전국대회 카드(대결 탭 '오늘의 특별 대회' 맨 위) ──
// 이번 주 규칙과 추천 계열(동료를 바꿀 이유), 주간 점수와 구간 보상, 챔피언전 입장, 달성 기간·지난주 기록
function weeklyCard() {
  refreshWeek(state, gameDay(state));
  const weekly = state.weekly;
  const rule = cupRule(weekly.week);
  const family = MATE_FAMILIES[rule.family];
  const deployed = weeklyFamilyCount(state);
  const reached = weeklyTier(weekly.points);
  const maxPoints = WEEKLY.tiers.at(-1).points;
  const card = document.createElement('article');
  card.className = 'weekly-card';
  card.id = 'weekly-card';
  const head = document.createElement('div');
  head.className = 'weekly-head';
  const title = document.createElement('b');
  title.textContent = `주간 전국대회 · ${weekLabel(weekly.week)}`;
  const score = document.createElement('em');
  score.className = 'weekly-score';
  score.textContent = `${fmt(weekly.points)} / ${maxPoints}점`;
  const left = Math.max(1, 7 - daysBetween(weekly.week, gameDay(state)));
  const dday = Object.assign(document.createElement('small'), { className: 'weekly-dday', textContent: `D-${left}` });
  head.append(title, dday, score);
  const ruleLine = document.createElement('p');
  ruleLine.className = `weekly-rule fam-${rule.family}`;
  ruleLine.append(Object.assign(document.createElement('strong'), { textContent: `이번 주 ${rule.name}` }),
    Object.assign(document.createElement('span'), { className: 'weekly-fam', textContent: `추천 ${family.name} ${deployed}명` }),
    Object.assign(document.createElement('small'), { textContent: `+${Math.round(WEEKLY.familyPoint * 100)}%/명` }));
  const bar = document.createElement('div');
  bar.className = 'weekly-bar';
  bar.ariaLabel = `주간 점수 ${weekly.points}점, ${reached}구간 도달`;
  const fill = document.createElement('i');
  fill.style.width = `${Math.min(1, weekly.points / maxPoints) * 100}%`;
  bar.append(fill);
  const tiers = document.createElement('ol');
  tiers.className = 'weekly-tiers';
  tiers.append(...WEEKLY.tiers.map((tier, index) => {
    const item = document.createElement('li');
    const claimed = weekly.claimed.includes(index);
    const ready = index < reached && !claimed;
    item.className = `weekly-tier${claimed ? ' claimed' : ready ? ' ready' : ''}`;
    item.dataset.tier = index;
    item.append(Object.assign(document.createElement('small'), { textContent: claimed ? '받음' : `${tier.points}점` }), rewardChips(weeklyReward(weekly.week, index), false));
    return item;
  }));
  const actions = document.createElement('div');
  actions.className = 'weekly-actions';
  const claim = document.createElement('button');
  claim.type = 'button';
  claim.className = 'weekly-claim';
  const ready = Array.from({ length: reached }, (_, index) => index).filter(index => !weekly.claimed.includes(index)).length;
  claim.textContent = ready ? `구간 보상 받기 ${ready}` : '구간 보상';
  claim.disabled = !ready;
  claim.addEventListener('click', () => {
    const given = claimWeeklyAll(state);
    if (!given) return;
    message(`주간 전국대회 보상 · ${giftLine(given)}`);
    commit();
  });
  const open = cupUnlocked(state);
  const keys = cupKeys(state);
  const weekend = weekendDay(state.daily?.date || gameDay(state));
  const enter = document.createElement('button');
  enter.type = 'button';
  enter.className = 'weekly-enter';
  enter.textContent = open ? `챔피언전 ${cupStep(state)}단계 · ${keys}번` : '챔피언전 잠김';
  enter.ariaLabel = `${CUP.name} 도전, 오늘 ${keys}번 남음`;
  enter.disabled = !open || keys <= 0 || Boolean(state.dungeon);
  enter.addEventListener('click', () => {
    refreshDay(state, gameDay(state));
    if (!enterCup(state)) return;
    combatEvent('enter', {});
    message(`${CUP.name} 시작! 30초 안에 참가자와 ${rule.champion}을 이기세요.`);
    commit();
  });
  const team = document.createElement('button');
  team.type = 'button';
  team.className = 'weekly-team';
  team.textContent = '편성 바꾸기';
  team.addEventListener('click', () => selectView('party'));
  actions.append(claim, enter, team);
  const how = document.createElement('p');
  how.className = 'weekly-how';
  const p = WEEKLY.points;
  how.textContent = !open ? '챔피언전은 1-3 1학년 대표를 이기면 열려요. 오늘 목표로도 점수가 쌓여요.'
    : `점수 · 오늘 목표 ${p.goal}(모두 완료 +${p.allDone}) · 던전 ${p.dungeon} · 기록전 ${p.record} · 챔피언전 우승 ${p.cupWin}${weekend ? '(오늘은 주말 2배)' : '(토·일 2배)'}, 탈락 ${p.cupTry}. 챔피언전은 하루 1번, 토·일 2번 · 이길 때마다 다음 단계 챔피언이 세져요`;
  const period = document.createElement('p');
  period.className = 'weekly-period';
  const last = state.weeklyLog?.[0];
  period.textContent = `달성 기간 ${weekLabel(weekly.week).replace(' 주간', '')}(월) 0시 ~ ${weekEndLabel(weekly.week)} 24시 · 받지 않은 구간은 다음 주 첫 접속 때 우편으로${last ? ` · 지난주 ${fmt(last.points)}점 ${last.tiers}구간` : ''}${state.titles?.[0] ? ` · 칭호 ${state.titles[0]}` : ''}`;
  title.after(helpButton('주간 전국대회', [
    `이번 주 ${rule.name}: ${rule.champion} · ${rule.desc}.`,
    `추천 ${family.name} 계열(${family.mates.map(id => COMPANIONS[id].style).join('·')}) 1명당 주간 점수 +${Math.round(WEEKLY.familyPoint * 100)}% · 챔피언전 피해 +${Math.round(WEEKLY.familyDamage * 100)}%.`,
    how.textContent, period.textContent]));
  card.append(head, ruleLine, bar, tiers, actions);
  return card;
}


// 상금 토너먼트 30초 기록전 카드: 개인 최고, 보상 구간, 다음 구간까지 남은 피해
function recordCard() {
  const open = recordUnlocked(state);
  const keys = recordKeys(state);
  const best = state.record?.best || 0;
  const reach = recordTier(best);
  const card = document.createElement('article');
  card.className = `dungeon-card record${open ? '' : ' locked'}`;
  const icon = document.createElement('span');
  icon.className = 'item-icon';
  icon.dataset.tone = DUNGEON_TONES.coin;
  setIcon(icon, ICONS.dungeons.coin);
  const body = document.createElement('div');
  body.className = 'dungeon-body';
  const title = document.createElement('b');
  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = `상금 토너먼트 · ${RECORD.name}`;
  const level = document.createElement('em');
  level.className = 'lv';
  level.textContent = best ? `최고 ${fmt(best)}` : '첫 도전';
  title.append(name, level);
  const info = document.createElement('p');
  info.textContent = !open ? '1-3 1학년 대표를 이기면 열려요'
    : best ? `${reach.tier}구간 · 다음까지 ${fmt(reach.next)}` : '30초 피해량으로 보상';
  const keyRow = document.createElement('span');
  keyRow.className = 'dungeon-keys';
  keyRow.ariaLabel = `오늘 입장권 ${keys}장 남음`;
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
  enter.textContent = '기록 도전';
  enter.ariaLabel = `${RECORD.name} 도전`;
  enter.disabled = !open || keys <= 0 || Boolean(state.dungeon);
  enter.addEventListener('click', () => {
    refreshDay(state, gameDay(state));
    if (!enterRecord(state)) return;
    combatEvent('enter', {});
    message(`${RECORD.name} 시작! 30초 동안 최대한 많이 때리세요.`);
    commit();
  });
  const sweep = document.createElement('button');
  sweep.type = 'button';
  sweep.className = 'sweep';
  sweep.textContent = '소탕';
  sweep.ariaLabel = `${RECORD.name} 최고 기록 구간으로 소탕`;
  sweep.disabled = !open || !reach.tier || keys <= 0 || Boolean(state.dungeon);
  sweep.addEventListener('click', () => {
    refreshDay(state, gameDay(state));
    if (!sweepRecord(state)) return;
    flyCoins(6);
    commit();
  });
  actions.append(enter, sweep);
  card.append(icon, body, actions);
  return card;
}

// 경기 규칙 안내: 새 구역(도장)에 들어설 때 규칙·추천 동료·이유를 한 줄씩 보여 준다
let renderedRule = '';
function ruleLine(state) {
  const rule = ruleId(state);
  if (!rule) return null;
  const owned = ruleMates(state, rule).filter(id => companionLevel(state, id));
  const picks = (owned.length ? owned : ruleMates(state, rule)).slice(0, 3).map(id => COMPANIONS[id].name);
  const deployed = state.party.slice(0, partySlots(state)).filter(id => id && ruleFit(id, rule)).length;
  return { rule, title: `경기 규칙 · ${RULES[rule].name}`, desc: RULES[rule].desc, picks: `추천 동료 · ${picks.join('·')}`, why: `이유 · ${RULES[rule].tip}. 출전한 추천 동료마다 팀 피해 +${Math.round(RULE_BONUS * 100)}%(지금 ${Math.min(3, deployed)}명)` };
}
function renderRule() {
  const key = state.dungeon || !state.cycle ? '' : `${state.cycle}:${gradeIndex(state.map)}`;
  if (key === renderedRule || (travel && state.roundEnd)) return;
  renderedRule = key;
  const info = key && ruleLine(state);
  const banner = $('rule-banner');
  if (!info) {
    banner.hidden = true;
    return;
  }
  banner.replaceChildren(...[info.title, info.desc, info.picks, info.why].map((text, index) => {
    const line = document.createElement(index ? 'span' : 'b');
    line.textContent = text;
    return line;
  }));
  banner.dataset.rule = info.rule;
  banner.hidden = false;
  banner.classList.remove('show');
  void banner.offsetWidth;
  banner.classList.add('show');
  clearTimeout(renderRule.timer);
  renderRule.timer = setTimeout(() => { banner.hidden = true; }, 4200);
}

// 기록전·연속 도전 결과 창
function showRunResult(result) {
  const lines = [];
  if (result.id === 'record') {
    setText('run-result-title', `${RECORD.name} 결과`);
    lines.push(['이번 기록', `${fmt(result.record)}${result.newBest ? ' · 최고 기록 갱신!' : ''}`]);
    lines.push(['개인 최고', fmt(result.best)]);
    lines.push(['도달한 보상 구간', `${result.level}구간`]);
    lines.push(['다음 보상까지 남은 피해', fmt(result.next)]);
    lines.push(['보상', result.text]);
  } else {
    const chain = result.chain;
    setText('run-result-title', `${dungeonInfo(result.id).name} 연속 도전`);
    lines.push(['연승', `Lv.${chain.from} → Lv.${chain.to} · ${chain.wins}연승`]);
    lines.push(['보상 합계', chain.text]);
    lines.push(['마지막', result.win ? `Lv.${result.level} 통과 · ${dungeonKeys(state, result.id) > 0 ? '연속 도전을 멈췄어요' : '열쇠를 다 썼어요'}` : `Lv.${result.level} ${result.reason === 'timeout' ? '시간 초과' : '실패'} · 열쇠는 그대로예요`]);
  }
  $('run-result-list').replaceChildren(...lines.map(([label, value]) => {
    const row = document.createElement('div');
    const name = document.createElement('dt');
    name.textContent = label;
    const text = document.createElement('dd');
    text.textContent = value;
    row.append(name, text);
    return row;
  }));
  if (!$('run-result').open) $('run-result').showModal();
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
  $('objective-title').textContent = next < 0 ? '쉬는 시간의 왕 등극!' : `${mapCode(next)} · ${stageNames(state.cycle || 0, next)[BOSS_WAVE]}`;
  $('objective-reward').textContent = next < 0 ? '지도에서 어떤 맵이든 다시 대결할 수 있어요.'
    : next === MAPS.length - 1 ? (!state.cycle ? '첫 승리 시 아카데미 졸업' : lastRound(state.cycle) ? `첫 승리 시 ${schoolName(state.cycle)} 제패` : `첫 승리 시 ${roundTag(state.cycle)} 바퀴 완료`) : isGradeFinal(next) ? `첫 승리 장비 · ${GEAR[BOSS_REWARDS[gradeIndex(next)]].name}` : `첫 승리 시 ${MAPS[next + 1].place} 해금`;
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
  const power = powerScore();
  setText('power', fmt(power));
  notePowerGain(power);
  bar($('xp-fill'), $('xp-fill').parentElement, state.xp, xpTarget(state));
  const gearScore = id => { const stats = gearStats(state, id); return stats.attack * 5 + stats.hp / 2; };
  $('bag-dot').hidden = !state.bag.some(id => gearScore(id) > gearScore(state.equipped[GEAR[id].slot]));
  const missionReady = Object.entries(MISSIONS).some(([id, mission]) => mission.value(state) >= nextMission(state, id).target);
  $('mission-dot').hidden = !(missionReady || !attendanceState().claimedToday || dailyReady());
  $('training-dot').hidden = currentView === 'training' || !(trainingReady() || tierReady(state) || academyReady());
  $('gacha-dot').hidden = state.tickets < 1;
  refreshDay(state, gameDay(state));
  $('battle-dot').hidden = currentView === 'battle' || !(freeRestReady() || Object.keys(DUNGEONS).some(id => dungeonUnlocked(state, id) && dungeonKeys(state, id) > 0));
  // 처음 그릴 때 이미 있던 결과(지난번 것)는 다시 띄우지 않고, 그 뒤에 생긴 결과부터 보여 준다
  if (shownDungeonResult === null) shownDungeonResult = state.dungeonResult?.serial ?? 0;
  if (state.dungeonResult && state.dungeonResult.serial !== shownDungeonResult) {
    {
      const result = state.dungeonResult;
      if (result.id === 'record' && !result.sweep) showRunResult(result);
      else if (result.chain) showRunResult(result);
      else if (result.id === 'record') message(`${RECORD.name} 소탕 · 최고 기록 구간 ${result.level} · ${result.text}`);
      else if (result.id === 'cup') message(`${CUP.name} ${result.win ? '우승!' : result.reason === 'timeout' ? '시간 초과' : '탈락'} · ${result.text}`);
      else message(`${dungeonInfo(result.id).name}${result.id === 'trial' ? '' : ` Lv.${result.level}`} ${result.sweep ? '소탕' : result.win ? '클리어' : result.reason === 'timeout' ? '시간 초과' : '실패'} · ${result.text}`);
    }
    shownDungeonResult = state.dungeonResult.serial;
  }
  const perkReady = Object.keys(PERKS).some(id => state.prestige.perks[id] < PERKS[id].cap && state.prestige.badges >= perkCost(state, id));
  void perkReady;
  setText('speed-label', `x${state.speed}`);
  $('speed').classList.toggle('fast', state.speed === 2);
  $('speed').setAttribute('aria-pressed', String(state.speed === 2));
  if (lastLevel !== null && state.level > lastLevel) showLevelUp(lastLevel, state.level);
  if (lastCycle !== null && state.cycle > lastCycle && (state.cycle === 1 || lastRound(state.cycle - 1))) showSchool();
  lastCycle = state.cycle;
  lastLevel = state.level;
  renderSnacks();
  renderBattle();
  renderMetaHud();
  renderActives();
  renderAllies();
  renderPartyBar();
  renderRule();
  const viewModels = {
    battle: [state.log, state.dungeons, state.daily?.keys, state.daily?.date, state.daily?.rest, state.gems >= (restCost(state) ?? Infinity), Boolean(state.roundEnd?.leaveDungeon), Boolean(state.dungeon), state.totalClears, state.prestige.count, state.prestige.perks, state.stickers, state.weekly, state.party, state.weeklyLog?.[0], state.titles?.[0]],
    training: [growthTab, Object.keys(TRAINING).map(id => { const plan = trainingPlan(id); return [plan.count, plan.total, state.coins >= plan.total]; }), state.training, firstGradeWon(state), state.classId, buyMode, state.tier, state.level, state.prestige, state.autoSkills, state.autoTrain, state.skillLv, Object.keys(ACTIVE).map(id => state.coins >= skillCost(state, id)), state.skillId, Boolean(state.dungeon), bestProgress(state)],
    party: [state.companions, state.party, state.tier, state.allyLv, state.party.map(id => (id ? state.coins >= allyTrainCost(state, id) : null)), state.shardPicks, state.mateShards],
    shop: [state.gems, state.daily?.shop, state.premium],
    bag: [state.bag, state.equipped, state.ranks, state.patches, gearFilter, state.profile.gender],
    gacha: [gachaTab, state.tickets, state.coins >= gachaCoinCost(1), state.coins >= gachaCoinCost(10), state.stickers, state.cleared, state.recruits, state.gems],
    grades: [state.map, state.cleared, state.cycle, state.prestige, state.level],
    activities: [state.missions, state.wins, state.cleared, state.bag, state.patches, state.attendance, state.daily, gameDay(state), state.pass, passTiers(state), state.premium.pass],
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

// 실력(전투력) 숫자와 오를 때 뜨는 '+N' 표시: 성장하는 맛
function powerScore() { return attack(state) * 5 + maxHp(state) / 2 + state.training.speed * 3; }
let lastPower = null;
let powerGain = 0;
let powerGainTimer = null;
function notePowerGain(power) {
  if (lastPower !== null && power > lastPower * 1.0005) {
    powerGain += power - lastPower;
    if (!powerGainTimer) powerGainTimer = setTimeout(flushPowerGain, 260);
  }
  lastPower = power;
}
function flushPowerGain() {
  powerGainTimer = null;
  const box = document.querySelector('.hud-power');
  if (!box || powerGain <= 0) return;
  box.querySelectorAll('.power-gain').forEach(old => old.remove());
  const pop = document.createElement('span');
  pop.className = 'power-gain';
  pop.setAttribute('aria-hidden', 'true');
  pop.textContent = `▲ ${fmt(powerGain)}`;
  box.append(pop);
  powerGain = 0;
  setTimeout(() => pop.remove(), 1100);
}

let lastAutoTrain = 0;
function runAutoTrain(force = false) {
  if (!state.autoTrain || !state.profile) return;
  const now = Date.now();
  if (!force && now - lastAutoTrain < 900) return;
  lastAutoTrain = now;
  const bought = autoTrain(state);
  if (!bought) return;
  refreshDay(state, gameDay(state));
  state.daily.trains += bought;
}

function train(id, repeat = false) {
  const { count, total } = trainingPlan(id);
  if (!count || state.training[id] >= TRAINING[id].cap || state.coins < total) return false;
  const before = maxHp(state);
  state.training[id] += count;
  state.coins -= total;
  if (id === 'health' && state.hp > 0) state.hp += maxHp(state) - before;
  refreshDay(state, gameDay(state));
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

const PORTRAIT_TITLES = { lobby: '선수 로비', skins: '스킨 미리보기', chat: 'AI 대화' };
function openPortrait(view) {
  const dialog = $('portrait-dialog');
  $('lobby-figure').dataset.portrait = state.profile.gender;
  setText('portrait-title', PORTRAIT_TITLES[view]);
  setText('lobby-name', state.profile.name);
  setText('lobby-rank', `Lv.${state.level} · ${tierName(state.tier)}${state.titles?.[0] ? ` · ${state.titles[0]}` : ''}`);
  dialog.querySelectorAll('[data-portrait-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.portraitView === view));
  });
  dialog.querySelectorAll('[data-portrait-panel]').forEach(panel => {
    panel.hidden = panel.dataset.portraitPanel !== view;
  });
  if (!dialog.open) dialog.showModal();
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
  // 주인공은 남자로 고정(선택지 하나). 선택지가 하나면 RadioNodeList가 아니라 input 하나가 돌아온다
  $('profile-form').querySelectorAll('input[name="gender"]').forEach(option => { option.checked = option.value === 'boy'; });
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
  refreshDay(state, gameDay(state));
  // 새 날 첫 접속: 방치 보상 창 다음에 오늘 화면(출석·오늘 목표·바로 가기)
  if (state.attendance.count > 0 && !attendanceState().claimedToday) queuePopup(openToday);
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
    const profile = makeProfile(data.get('nickname'), 'boy');
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
  document.querySelectorAll('[data-open-portrait]').forEach(button => button.addEventListener('click', () => {
    $('settings-dialog').close();
    openPortrait(button.dataset.openPortrait);
  }));
  document.querySelectorAll('[data-portrait-view]').forEach(button => button.addEventListener('click', () => {
    openPortrait(button.dataset.portraitView);
  }));
  $('cancel-profile').addEventListener('click', enterGame);
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => selectView(button.dataset.view)));
  bindMetaUI();
  bindSectionHelp();
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
  $('today-claim').addEventListener('click', () => {
    onClaimToday();
    renderToday();
  });
  $('today-links').addEventListener('click', event => {
    const link = event.target.closest('[data-link]');
    if (link) onTodayLink(link.dataset.link);
  });
  $('today-open').addEventListener('click', openToday);
  $('daily-claim-all').addEventListener('click', onClaimToday);
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
    '아카데미 신입생인 주인공은 자동으로 대결해요. 코인으로 훈련하고 가방에서 더 좋은 장비를 착용하세요.',
    '1-3 1학년 대표 다온의 방어는 공 울림 카운터로 풀 수 있어요. 돌진 스트레이트는 반격 뒤 빈틈에 강해요.',
    '보스를 이기면 다음 장소가 열려요. 자동 진격을 끄면 같은 장소에서 코인을 모아요.',
    '졌을 때는 같은 맵에서 반복 수련을 시작해요. 수련에서 3승을 하면 자동으로 다시 도전해요.',
    `게임을 닫아도 최대 ${offlineLimit(state) / 3600}시간 동안 대결과 보상이 쌓여요. 진행 상황은 이 브라우저에 저장돼요.`,
    '4-3 보스를 이기면 아카데미를 졸업하고, 정선 산골 마을부터 서울 강남까지 지역 격투 대회를 하나씩 제패해요. 지역마다 동네 도장 → 상가 체육관 → 시민 체육관 → 챔피언전(1-1~4-3)을 시골은 3바퀴, 지방 도시는 2바퀴, 광역시는 1바퀴, 서울은 2바퀴 돌면 제패예요. 막히면 지도 탭에서 재입학하고, 명예 배지로 명예 코칭을 받아 영구 능력치를 올리세요.',
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
  startAnim(renderPoses);
  setInterval(() => {
    if (document.visibilityState !== 'visible' || editingProfile || !state.profile) return;
    // 테스트 모드 동작 확인 중에는 대결 시간을 멈춘다(멈춘 시간은 나중에 몰아서 돌리지 않음)
    if (testHold) openedAt = Date.now();
    else updateClock();
    render();
  }, 42);
}

start();
