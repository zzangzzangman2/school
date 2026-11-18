'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const g = require('../recess/game.js');
const configPath = path.join(__dirname, '../recess/season-calendar.js');
const seasons = vm.runInNewContext(fs.readFileSync(configPath, 'utf8') + '\nHAESOL_SEASON_CALENDAR');
const day = '2026-11-18';
const savedAt = Date.parse('2026-11-18T12:00:00+09:00');
Math.random = () => 0.7;
assert(g.setSeasonCalendar(seasons));

function player(date = day) {
  const state = g.newGame();
  state.profile = g.makeProfile('운영 확인', 'boy');
  g.refreshDay(state, date);
  return state;
}

function reload(state) {
  const result = g.restore(JSON.parse(JSON.stringify({ version: 5, when: savedAt, state })));
  assert(result);
  return result;
}

function finish(state) {
  for (let i = 0; i < 840 && state.dungeon; i++) g.simulate(state, 0.05, null);
  assert.equal(state.dungeon, null);
}

const lastNight = '2026-11-17';
const start = Date.parse('2026-11-17T23:58:00+09:00');
const end = start + 240000;
const offline = player(lastNight);
offline.coins = 4500;
offline.autoTrain = true;
const split = structuredClone(offline);
const spent = g.simulateBetween(offline, start, end, null);
const firstSpent = g.simulate(split, 120, null);
g.refreshDay(split, day);
const lastSpent = g.simulate(split, 120, null);
assert.deepEqual(offline, split);
assert.equal(spent, firstSpent + lastSpent);
assert(spent > 0);
assert(offline.daily.baseWins < offline.wins && offline.daily.baseWins > 0);
g.refreshDay(offline, lastNight);
assert.equal(offline.daily.date, day);
const quick = player();
quick.autoTrain = true;
quick.coins = 4500;
const rest = g.quickRest(quick, day);
assert.equal(rest.cost, 0);
assert(rest.spent > 0 && g.trainingTotal(quick) > rest.before.training);
assert.equal(reload(quick).daily.rest, 1);
const manual = player();
g.simulateBetween(manual, start, end, null);
assert.equal(g.trainingTotal(manual), 0);

let boss = player();
boss.cleared[0] = boss.cleared[1] = true;
g.openFight(boss, 2, g.BOSS_WAVE, 0);
boss.bossTime = 0.03;
g.simulate(boss, 2, null);
assert(boss.farm && g.bossRetryReady(boss));
assert.equal(boss.bossFailure.reason, 'timeout');
const autoRetry = structuredClone(boss);
autoRetry.farm.wins = 2;
autoRetry.training.power = 150;
for (let i = 0; i < 12 && autoRetry.wave !== g.BOSS_WAVE; i++) g.simulate(autoRetry, 0.5, null);
assert.equal(autoRetry.wave, g.BOSS_WAVE);
boss = reload(boss);
assert(g.retryFarm(boss));
assert.equal(boss.wave, g.BOSS_WAVE);
assert.equal(boss.farm, null);
assert(!g.retryFarm(boss));

let tower = player();
tower.totalClears = 3;
tower.training.power = 300;
tower.training.health = 100;
tower.companions = { mate1: 1, mate2: 1 };
tower.party[0] = 'mate2';
tower.skillId = 'bell';
assert(g.savePartyPreset(tower, 'challenge'));
tower.party[0] = 'mate1';
tower.skillId = 'rush';
const home = { map: tower.map, wave: tower.wave, hp: tower.hp, foe: tower.enemyHp, party: [...tower.party], skillId: tower.skillId };
assert(!g.enterTower(tower, 2));
assert(g.enterTower(tower));
assert.equal(tower.party[0], 'mate2');
assert.equal(tower.skillId, 'bell');
tower = reload(tower);
assert.equal(tower.dungeon.id, 'tower');
const patches = tower.patches;
finish(tower);
assert.equal(tower.tower.best, 1);
assert.equal(tower.patches, patches + 1);
assert.deepEqual([tower.map, tower.wave, tower.hp, tower.enemyHp, tower.party, tower.skillId], [home.map, home.wave, home.hp, home.foe, home.party, home.skillId]);
assert(g.enterTower(tower, 1));
finish(tower);
assert.equal(tower.patches, patches + 1);
tower.daily.keys.record = 0;
assert(!g.enterRecord(tower));
assert(g.enterRecord(tower, true));
finish(tower);
assert.equal(tower.daily.keys.record, 0);
assert.equal(tower.record.best, 0);
assert(tower.dungeonResult.practice);

const mates = player();
mates.companions = { mate1: 1, mate2: 1, mate3: 1 };
mates.party[0] = 'mate1';
mates.allyLv = { mate1: 5, mate2: 5, mate3: 5 };
assert.equal(g.claimCollection(mates, 'strike').shardPicks, 8);
assert.equal(g.claimCollection(mates, 'strike'), null);
assert(!g.startDispatch(mates, 'mate1', 4, savedAt));
assert(g.startDispatch(mates, 'mate2', 4, savedAt));
assert(!g.setParty(mates, 0, 'mate2'));
const returning = reload(mates);
assert.equal(g.finishDispatch(returning, savedAt + 14399999), null);
assert.equal(g.finishDispatch(returning, savedAt + 14400000).shards, 3);
assert.equal(g.mateShards(returning, 'mate2'), 3);
assert.equal(g.finishDispatch(returning, savedAt + 14400000), null);

let season = player();
season.totalClears = 3;
season.training.power = 300;
season.training.health = 100;
assert.equal(g.activeSeason(season).id, seasons[0].id);
assert(g.enterSeasonFight(season));
finish(season);
assert.equal(g.activeSeason(season).points, 75);
assert(g.enterSeasonFight(season));
finish(season);
const firstId = seasons[0].id;
assert.equal(g.activeSeason(season).points, 75);
const update = structuredClone(seasons);
update[0].version = 2;
update[0].tiers[0].reward = { patches: 4 };
assert(g.setSeasonCalendar(update));
season = reload(season);
assert.equal(g.activeSeason(season).version, 1);
g.refreshDay(season, seasons[1].starts);
assert.equal(g.activeSeason(season).id, seasons[1].id);
assert.equal(g.claimSeason(season, firstId).patches, 12);
assert.equal(g.claimSeason(season, firstId), null);
season.seasons[firstId].points = 500;
g.refreshDay(season, seasons[0].claimUntil);
assert.equal(g.claimSeason(season, firstId), null);
assert.equal(season.seasons[firstId].version, 1);
assert.equal(season.seasons[firstId].claimed.length, 1);

console.log('Passed offline training, KST rollover, boss retry, tower, practice, collection, dispatch, presets and season migration');
