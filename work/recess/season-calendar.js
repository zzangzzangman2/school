'use strict';

const HAESOL_SEASON_CALENDAR = [
  {
    id: 'academy-open-2026', version: 1, name: '해솔 오픈 시즌',
    starts: '2026-11-16', ends: '2026-12-14', claimUntil: '2026-12-21',
    matches: ['guard', 'barrage', 'endure', 'guard'],
    tiers: [
      { points: 60, reward: { patches: 12 } },
      { points: 150, reward: { shardPicks: 12 } },
      { points: 300, reward: { recruits: 5 } },
      { points: 480, reward: { shardPicks: 25, title: '해솔 오픈 챔피언' } },
    ],
  },
  {
    id: 'winter-classic-2026', version: 1, name: '겨울 도장 클래식',
    starts: '2026-12-14', ends: '2027-01-11', claimUntil: '2027-01-18',
    matches: ['endure', 'guard', 'barrage', 'endure'],
    tiers: [
      { points: 60, reward: { recruits: 3 } },
      { points: 140, reward: { patches: 20 } },
      { points: 260, reward: { shardPicks: 18 } },
      { points: 430, reward: { shardPicks: 25, title: '겨울 도장 챔피언' } },
    ],
  },
];
