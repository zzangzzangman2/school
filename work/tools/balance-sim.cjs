'use strict';
// 쉬는 시간의 왕 — 장기 진행 시뮬레이터
// 실제 game.js 공식(공격력·체력·적 체력·적 공격·보상·비용)을 불러와,
// 하루 HOURS시간(접속 + 오프라인 보상) 플레이하는 유저가 훈련·장비 강화·스티커·전학을 자동으로 할 때
// 날짜별로 어디까지 가는지 계산한다. 전투는 평균값으로 근사한다(초당 20틱 엔진을 2년치 돌리지 않음).
// 사용법: node tools/balance-sim.cjs [일수=730] [하루시간=16] [시드=1]

const path = require('path');
const fs = require('fs');
const vm = require('vm');

// 5번째 인자로 상수 덮어쓰기: '{"GROWTH":"{ hp: 1.23, hit: 1.22, coin: 1.3, xp: 1.03 }"}'
const overrides = JSON.parse(process.argv[5] || '{}');
let source = fs.readFileSync(path.join(__dirname, '..', 'recess', 'game.js'), 'utf8');
for (const [name, value] of Object.entries(overrides)) {
  const pattern = new RegExp(`^const ${name} = .*;$`, 'm');
  if (!pattern.test(source)) throw new Error(`no const ${name}`);
  source = source.replace(pattern, `const ${name} = ${value};`);
}
const sandbox = { module: { exports: {} }, Math, Date, console };
vm.runInNewContext(source, sandbox);
const g = sandbox.module.exports;

const DAYS = Number(process.argv[2] || 730);
const HOURS = Number(process.argv[3] || 16);
let seed = Number(process.argv[4] || 1);
const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const CHECKPOINTS = [0.25, 1, 2, 3, 7, 14, 30, 60, 90, 180, 270, 365, 545, 730].filter(day => day <= DAYS);
const DAY = HOURS * 3600;
const state = g.newGame();
state.profile = { name: 'sim', gender: 'boy' };
state.tickets = 10;
state.gems = 300;
state.recruits = 5;
state.stats.pulls = 0;

let time = 0;
let lastClearAt = 0;
let nextCheckpoint = 0;
let dayIndex = 0;
let maxNumber = 0;
const rows = [];

function withFight(map, wave, fn) {
  // 무리 전투의 앞 상대 값을 비워 두면 enemyMaxHp·enemyHit가 대결 전체(1:1 환산) 기준이 된다
  const saved = [state.map, state.wave, state.farm, state.front, state.pack];
  state.map = map; state.wave = wave; state.front = null; state.pack = [];
  try { return fn(); } finally { [state.map, state.wave, state.farm, state.front, state.pack] = saved; }
}

function snacksActive(on) {
  for (const id of ['choco', 'banana', 'berry']) state.snacks[id] = on ? 600 : 0;
}

function dps(crowd = false) {
  const crit = g.critChance(state);
  const avg = (3 * (1 + crit * (g.critPower(state) - 1)) + 2.2) / 4;
  const tier = state.tier;
  const cheer = tier >= 2 ? 1 + (g.cheerMult(state) - 1) * 6 / 15 : 1;
  const sprint = tier >= 4 ? 1 + (g.sprintMult(state) - 1) * 6 / 18 : 1;
  const attackNow = g.attack(state);
  const player = attackNow * avg / g.interval(state) * sprint;
  let allies = 0;
  for (let slot = 0; slot < g.partySlots(state); slot++) if (state.party[slot]) allies += attackNow * g.allyPower(state, state.party[slot]) / g.ALLY_INTERVAL;
  const pencil = tier >= 1 ? attackNow * g.skillPower(state) / 8 * (crowd ? 3 : 1) : 0;
  return (player + allies + pencil) * cheer;
}
function effectiveHp(ttk = 0) { return g.maxHp(state) * ((state.tier >= 3 ? 1.35 : 1) + g.regenRate(state) * ttk); }

function fight(map, wave, hpNow, easy = 0) {
  return withFight(map, wave, () => {
    state.farm = easy ? { cap: 0, easy, wins: 0 } : null;
    const hp = g.enemyMaxHp(state);
    const ttk = hp / dps(wave < g.BOSS_WAVE);
    const grade = Math.floor(map / g.MAPS_PER_GRADE);
    const every = 1.65 - grade * 0.06 + 0.25;
    const hits = ttk <= 1.35 ? 0 : Math.floor((ttk - 1.35) / every) + 1;
    // 무리 대결(1~3번째, 6명): 체력 합은 같고, 협공 포함 평균 공격은 대장 기준의 약 0.73배, 교대 대기로 0.9초 더 걸린다
    // 보스(4번째)는 제한시간 안에 쓰러뜨려야 한다
    const crowd = wave < g.BOSS_WAVE;
    const damage = hits * baseHit(map, wave) * 0.64 ** easy * (crowd ? 0.73 : 1);
    const inTime = crowd || easy || ttk <= g.BOSS_TIME;
    return { win: damage < hpNow * (state.tier >= 3 ? 1.35 : 1) + g.maxHp(state) * g.regenRate(state) * ttk && inTime, time: Math.min(ttk, crowd ? Infinity : g.BOSS_TIME) + 1.35 + (crowd ? 0.9 : 0), damage };
  });
}

function baseHit() { return g.enemyHit(state); }

function canClearDungeon(id, level) {
  const dungeon = g.DUNGEONS[id];
  const reached = g.dungeonProgress(level);
  const total = g.atProgress(reached, 'hp') * dungeon.hp;
  const ttk = total / dps() + 4 * 0.3 + 1;
  const damage = (ttk / 1.9) * g.atProgress(reached, 'hit') * dungeon.hit * 0.75;
  return ttk <= g.DUNGEON_TIME && damage < effectiveHp(ttk);
}

function tryPromote() {
  while (g.tierReady(state)) {
    const reach = g.tierReq(state.tier + 1);
    const total = g.atProgress(reach, 'hp') * 2.6;
    const ttk = total / dps() + 1;
    const damage = (ttk / 1.9) * g.atProgress(reach, 'hit') * 1.15;
    if (ttk > g.DUNGEON_TIME || damage >= effectiveHp(ttk)) return;
    state.tier++;
  }
}

function spendGems() {
  while (true) {
    const done = g.questState(state);
    if (!done.done) break;
    g.claimQuest(state);
  }
  g.claimPass(state);
  while (state.gems >= 900) { state.gems -= 900; state.recruits += 10; }
  while (state.recruits >= 10) { state.recruits -= 10; g.recruit(state, 10, rng); }
  const owned = Object.keys(state.companions).sort((a, b) => g.allyPower(state, b) - g.allyPower(state, a));
  state.party = [0, 1, 2].map(slot => (slot < g.partySlots(state) ? owned[slot] || null : null));
}

function runDungeons() {
  for (const id of Object.keys(g.DUNGEONS)) {
    if (!g.dungeonUnlocked(state, id)) continue;
    for (let key = 0; key < g.DUNGEON_KEYS; key++) {
      const next = state.dungeons[id] + 1;
      let level = state.dungeons[id];
      if (canClearDungeon(id, next)) { state.dungeons[id] = next; level = next; }
      if (!level) continue;
      const reward = g.dungeonReward(state, id, level);
      state.coins += reward.coins || 0;
      state.tickets += reward.tickets || 0;
      if (reward.badges) { state.prestige.badges += reward.badges; state.prestige.earned += reward.badges; }
    }
  }
}

function reward(map, wave, firstBoss) {
  withFight(map, wave, () => {
    state.coins += g.winCoins(state, firstBoss);
    state.xp += g.winXp(state);
  });
  state.wins++;
  state.mapWins[map]++;
  const gear = g.MAP_REWARDS[map];
  if (state.mapWins[map] % g.DROP_WINS === 0) {
    if (state.bag.includes(gear)) state.patches++;
    else { state.bag.push(gear); equipBest(); }
  }
  while (state.xp >= g.xpTarget(state)) { state.xp -= g.xpTarget(state); state.level++; }
}

function equipBest() {
  for (const id of state.bag) {
    const item = g.GEAR[id];
    const current = g.GEAR[state.equipped[item.slot]];
    const score = gear => (gear.attack || 0) * 5 + (gear.hp || 0) / 2;
    if (!item.starter && (current.starter || score(item) >= score(current))) state.equipped[item.slot] = id;
  }
}

function attemptMap() {
  const map = state.map;
  let hp = g.maxHp(state);
  let spent = 0;
  for (let wave = 0; wave <= g.BOSS_WAVE; wave++) {
    const result = fight(map, wave, hp);
    spent += result.time;
    if (!result.win) return { ok: false, time: spent + 1.65 };
    const firstBoss = wave === g.BOSS_WAVE && !state.cleared[map];
    reward(map, wave, firstBoss);
    hp -= result.damage;
    hp = wave === g.BOSS_WAVE ? g.maxHp(state) : Math.min(g.maxHp(state), hp + Math.ceil(g.maxHp(state) * 0.16));
  }
  // 첫 보스 처리(실제 win()과 같은 규칙)
  if (!state.cleared[map]) {
    if (g.progress(state) + 1 > state.prestige.best) state.tickets += (map + 1) % g.MAPS_PER_GRADE === 0 ? 5 : 2;
    state.totalClears++;
    lastClearAt = time;
    if (map === g.MAPS.length - 1) {
      state.cycle++;
      state.cleared = g.MAPS.map(() => false);
      state.map = 0;
      return { ok: true, time: spent + 1.6 };
    }
    state.cleared[map] = true;
  }
  if (map < g.MAPS.length - 1) state.map = map + 1;
  return { ok: true, time: spent + 1.3 };
}

function farm(seconds) {
  // 진 뒤 같은 맵 쉬운 상대와 반복 수련(easy 1~3), 코인·경험치는 그대로
  let used = 0;
  let easy = 1;
  while (used < seconds) {
    const result = fight(state.map, 0, g.maxHp(state), easy);
    if (!result.win && easy < 5) { easy++; continue; }
    used += result.time + 0.83;
    reward(state.map, 0, false);
  }
  return used;
}

function buyTraining() {
  for (let guard = 0; guard < 10000; guard++) {
    const cost = id => g.trainingCost(state, id);
    const options = [];
    for (const id of ['speed', 'focus', 'critDmg', 'recover']) if (state.training[id] < g.TRAINING[id].cap && cost(id) <= state.coins * 0.4) options.push([id, cost(id)]);
    const power = cost('power');
    const health = cost('health');
    options.push(power <= health * 1.4 ? ['power', power] : ['health', health]);
    const [id, price] = options[0];
    if (price > state.coins) return;
    state.coins -= price;
    state.training[id]++;
  }
}

function buyLevels() {
  for (let guard = 0; guard < 5000; guard++) {
    const options = [];
    for (const id of state.party) if (id && g.allyTrainLevel(state, id) < g.allyTrainCap(state, id)) options.push(['ally', id, g.allyTrainCost(state, id)]);
    for (const id of Object.keys(g.ACTIVE)) if (g.skillUnlocked(state, id) && g.skillLevel(state, id) < g.ACTIVE[id].lvCap) options.push(['skill', id, g.skillCost(state, id)]);
    if (!options.length) return;
    options.sort((a, b) => a[2] - b[2]);
    const [kind, id, price] = options[0];
    if (price > state.coins * 0.4) return;
    if (kind === 'ally') g.trainAlly(state, id); else g.trainSkill(state, id);
  }
}

function upgradeGear() {
  for (let guard = 0; guard < 1000; guard++) {
    const items = Object.values(state.equipped).filter(id => !g.GEAR[id].starter && (state.ranks[id] || 0) < g.MAX_RANK);
    if (!items.length) return;
    items.sort((a, b) => (state.ranks[a] || 0) - (state.ranks[b] || 0));
    const id = items[0];
    const price = 1 + (state.ranks[id] || 0);
    if (state.patches < price) return;
    state.patches -= price;
    state.ranks[id] = (state.ranks[id] || 0) + 1;
  }
}

function pullAll() {
  while (state.tickets >= 10) { state.tickets -= 10; g.pullStickers(state, 10, rng); state.stats.pulls += 10; }
}

function buyPerks() {
  for (let guard = 0; guard < 100000; guard++) {
    const p = state.prestige;
    if (p.perks.offline < g.PERKS.offline.cap && g.perkCost(state, 'offline') <= p.badges) { p.badges -= g.perkCost(state, 'offline'); p.perks.offline++; continue; }
    const options = ['power', 'health', 'coin', 'xp'].map(id => [id, g.perkCost(state, id) * (id === 'xp' ? 2 : id === 'coin' ? 1.1 : 1)]);
    options.sort((a, b) => a[1] - b[1]);
    const id = options[0][0];
    const price = g.perkCost(state, id);
    if (price > p.badges) return;
    p.badges -= price;
    p.perks[id]++;
  }
}

function maybeTransfer() {
  const gain = g.prestigeGain(state);
  if (!gain) return;
  const stall = time - lastClearAt;
  const earned = state.prestige.earned;
  if ((stall > 3 * 3600 && gain >= Math.max(3, earned * 0.3)) || (stall > 24 * 3600 && gain >= earned * 0.05)
      || (earned > 0 && gain >= earned * 1.5 && stall > 1800)) {
    g.transfer(state);
    lastClearAt = time;
    buyPerks();
  }
}

function daily() {
  // 출석(7일 평균) + 일일 미션 보상 + 매일 무료 상점
  state.gems += 36;
  state.tickets += 1;
  state.recruits += 1;
  state.tickets += 18 / 7 + 9;
  state.patches += 2 + 6 / 7;
  state.tickets = Math.floor(state.tickets);
  state.patches = Math.floor(state.patches);
  runDungeons();
  buyPerks();
}

function record(day) {
  const stickerLevels = Object.keys(g.STICKERS).map(id => Math.min(100, Math.floor((Math.sqrt(8 * (state.stickers[id] || 0) + 1) - 1) / 2)));
  rows.push({
    day,
    '년차': state.cycle + 1,
    '맵': `${Math.floor(state.map / 3) + 1}-${state.map % 3 + 1}`,
    '최고진행': Math.max(state.prestige.best, g.progress(state)),
    '레벨': state.level,
    '힘훈련': state.training.power,
    '공격력': g.fmt(g.attack(state)),
    '전학': state.prestige.count,
    '누적배지': state.prestige.earned,
    '스티커평균Lv': (stickerLevels.reduce((a, b) => a + b, 0) / stickerLevels.length).toFixed(1),
    '던전Lv': Object.values(state.dungeons).join('/'),
    '승급': state.tier,
    '동료Lv': state.party.filter(Boolean).map(id => g.companionLevel(state, id)).join('/'),
    '코인': g.fmt(state.coins),
  });
}

const total = DAYS * DAY;
while (time < total) {
  const hour = Math.floor(time / 3600) % 24;
  snacksActive(hour % 10 < 6);
  buyTraining();
  buyLevels();
  upgradeGear();
  pullAll();
  spendGems();
  tryPromote();
  const result = attemptMap();
  time += result.time;
  if (!result.ok) {
    time += farm(120);
    maybeTransfer();
  }
  maxNumber = Math.max(maxNumber, state.coins, g.attack(state));
  while (time >= (dayIndex + 1) * DAY) { dayIndex++; daily(); }
  while (nextCheckpoint < CHECKPOINTS.length && time >= CHECKPOINTS[nextCheckpoint] * DAY) record(CHECKPOINTS[nextCheckpoint++]);
}
console.table(rows);
console.log(`가장 큰 수: ${g.fmt(maxNumber)} (${maxNumber.toExponential(2)}) · 하루 ${HOURS}시간 기준`);
