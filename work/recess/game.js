'use strict';

const MAPS_PER_GRADE = 3;
const GRADE_COUNT = 4;
const LEGACY_GRADES = 6; // 저장 버전 1(학년 6칸) 이전용
const MAPS = [
  { place: '아카데미 정문', names: ['민준', '태호', '건우', '정문 깡패 선배 강솔'], hp: [24, 30, 38, 61], hit: [3, 3, 4, 6] },
  { place: '기숙사 복도', names: ['가온', '시우', '도현', '복도 행동대장 민서'], hp: [40, 48, 58, 87], hit: [4, 5, 6, 8] },
  { place: '신입생 체육관', names: ['해준', '우빈', '로운', '1학년 대표 다온'], hp: [54, 64, 80, 245], hit: [5, 6, 8, 13] },
  { place: '웨이트 트레이닝장', names: ['준서', '승현', '재민', '웨이트장 터줏대감 준영'], hp: [80, 99, 118, 167], hit: [8, 10, 12, 15] },
  { place: '학생식당 앞', names: ['은재', '도율', '현수', '식당 앞 단골 이솔'], hp: [115, 134, 158, 215], hit: [11, 12, 15, 19] },
  { place: '복싱장', names: ['수호', '우주', '윤성', '2학년 대표 유찬'], hp: [145, 172, 200, 275], hit: [13, 15, 18, 23] },
  { place: '레슬링 매트장', names: ['지한', '이준', '태민', '매트장 주장 강별'], hp: [190, 226, 261, 342], hit: [17, 19, 21, 26] },
  { place: '야외 코트', names: ['태인', '한결', '동하', '코트 에이스 온유'], hp: [246, 284, 330, 425], hit: [20, 22, 25, 31] },
  { place: '모래판 씨름장', names: ['유민', '민재', '상우', '3학년 대표 성원'], hp: [300, 349, 399, 515], hit: [23, 26, 29, 39] },
  { place: '운동장 트랙', names: ['주원', '지호', '성민', '트랙 에이스 리우'], hp: [380, 432, 490, 630], hit: [28, 31, 35, 43] },
  { place: '졸업 시험장', names: ['서준', '현준', '동건', '시험 감독 조교 진혁'], hp: [467, 530, 595, 755], hit: [33, 36, 40, 49] },
  { place: '아카데미 결승 링', names: ['희수', '시온', '준혁', '수석 졸업 후보 은우'], hp: [560, 630, 710, 895], hit: [38, 41, 47, 57] },
];

const GEAR = {
  basicTop: { name: '신입생 후드', slot: 'top', starter: true },
  basicBottom: { name: '신입생 트레이닝 바지', slot: 'bottom', starter: true },
  bag: { name: '신입생 짐가방', slot: 'bag', hp: 4, starter: true },
  basicShoes: { name: '신입생 운동화', slot: 'shoes', starter: true },
  pencil: { name: '새 핸드랩', slot: 'accessory', attack: 1, starter: true },
  wristband: { name: '별무늬 손목띠', slot: 'accessory', attack: 5 },
  shoes: { name: '보라색 링 슈즈', slot: 'shoes', hp: 18, style: 'violet' },
  jersey: { name: '1학년 챔피언 띠', slot: 'accessory', attack: 13 },
  jumper: { name: '줄무늬 점퍼', slot: 'top', hp: 43, style: 'crimson' },
  gloves: { name: '별무늬 스파링 글러브', slot: 'accessory', attack: 29 },
  vest: { name: '체육관 팀 조끼', slot: 'top', hp: 79, style: 'indigo' },
  badge: { name: '아카데미 수석 배지', slot: 'accessory', attack: 54 },
  mintHood: { name: '민트 후드', slot: 'top', hp: 10, attack: 2, style: 'mint' },
  hallPants: { name: '기숙사 트레이닝 바지', slot: 'bottom', hp: 12, attack: 1, style: 'indigo' },
  classBag: { name: '새싹 짐가방', slot: 'bag', hp: 12, attack: 3, style: 'mint' },
  stairShoes: { name: '귤빛 운동화', slot: 'shoes', hp: 20, attack: 2, style: 'orange' },
  lunchTop: { name: '학생식당 줄무늬 후드', slot: 'top', hp: 25, attack: 4, style: 'orange' },
  lunchPants: { name: '자수 조거 바지', slot: 'bottom', hp: 25, attack: 4, style: 'graphite' },
  gardenBag: { name: '숲길 러닝 가방', slot: 'bag', hp: 29, attack: 6, style: 'forest' },
  bridgeShoes: { name: '하늘빛 러닝화', slot: 'shoes', hp: 29, attack: 6, style: 'sky' },
  libraryPants: { name: '남색 트레이닝 바지', slot: 'bottom', hp: 33, attack: 7, style: 'violet' },
  musicBag: { name: '음표 스포츠백', slot: 'bag', hp: 38, attack: 9, style: 'pink' },
  artTop: { name: '분필빛 훈련복', slot: 'top', hp: 49, attack: 8, style: 'pink' },
  labShoes: { name: '숲색 훈련화', slot: 'shoes', hp: 41, attack: 11, style: 'forest' },
  gymPants: { name: '체육관 바지', slot: 'bottom', hp: 47, attack: 13, style: 'forest' },
  gymBag: { name: '체육관 더플백', slot: 'bag', hp: 48, attack: 13, style: 'sky' },
  courtShoes: { name: '코트 농구화', slot: 'shoes', hp: 49, attack: 15, style: 'crimson' },
  playTop: { name: '레이싱 후드', slot: 'top', hp: 75, attack: 17, style: 'sky' },
  trackPants: { name: '트랙 스프린트 바지', slot: 'bottom', hp: 59, attack: 18, style: 'crimson' },
  finishBag: { name: '결승선 우승 가방', slot: 'bag', hp: 68, attack: 20, style: 'crimson' },
};
const SLOTS = { top: '상의', bottom: '하의', bag: '가방', shoes: '신발', accessory: '장신구' };
const STARTER_GEAR = { top: 'basicTop', bottom: 'basicBottom', bag: 'bag', shoes: 'basicShoes', accessory: 'pencil' };
const MAP_REWARDS = ['mintHood', 'hallPants', 'classBag', 'stairShoes', 'lunchTop', 'lunchPants', 'gardenBag', 'bridgeShoes', 'libraryPants', 'musicBag', 'artTop', 'labShoes'];
const DROP_WINS = 4;
const FARM_WINS = 3;
const MAX_RANK = 30;
const RANK_BONUS = 0.03;
// ── 장기 성장: 아카데미 4-3을 깨면 졸업, 그 뒤로 지역을 하나씩 제패하며 적·보상이 지수적으로 커진다 ──
// 지역부터는 맵 하나 넘어갈 때마다 아래 비율로 이어서 커진다(아카데미 마지막 보스 기준).
const GROWTH = { hp: 1.243, hit: 1.233, coin: 1.25, xp: 1.03 };
const MILESTONE = 25;
const COST_TAIL = 1.05;
const GRADE_SCALING = [
  { hp: 1, attack: 1 }, { hp: 1.14, attack: 1.08 }, { hp: 1.24, attack: 1.20 }, { hp: 1.38, attack: 1.28 },
];
const MISSIONS = {
  wins: { name: '쉬는 시간 단골', hint: '대결 승리', glyph: '✷', step: 8, value: state => state.wins },
  clears: { name: '경기장 탐방', hint: '맵 첫 클리어', glyph: '⚑', step: 2, value: state => state.totalClears ?? state.cleared.filter(Boolean).length },
  closet: { name: '옷장 채우기', hint: '새 장비 수집', glyph: '✧', step: 3, value: state => state.bag.filter(id => !GEAR[id].starter).length },
};
const BOSS_REWARDS = ['shoes', 'jersey', 'jumper', 'gloves'];
const TRAINING = {
  power: { name: '힘 훈련', glyph: '✧', bonus: '파워 +4', base: 22, cap: 1e9, scale: 1.16, milestone: true },
  health: { name: '체력 훈련', glyph: '♥', bonus: '최대 체력 +15', base: 18, cap: 1e9, scale: 1.13, milestone: true },
  speed: { name: '순발력 훈련', glyph: 'ϟ', bonus: '동작 간격 −0.04초', base: 31, cap: 11, scale: 1.31 },
  focus: { name: '집중력 훈련', glyph: '◎', bonus: '크리티컬 확률 +1%', base: 45, cap: 30, scale: 1.2 },
  critDmg: { name: '크리티컬 파워 훈련', glyph: '✹', bonus: '크리티컬 피해 +5%', base: 80, cap: 60, scale: 1.25 },
  recover: { name: '회복 훈련', glyph: '✚', bonus: '대결 중 초당 체력 회복 +0.1%', base: 50, cap: 30, scale: 1.3 },
};
const CLASSES = {
  gym: { name: '스피드 전공', glyph: '↗', bonus: '동작 간격 18% 단축' },
  math: { name: '스폰서 관리', glyph: '+', bonus: '대결 코인 보상 25% 증가' },
  music: { name: '멘탈 코칭', glyph: '♪', bonus: '필살기 충전량 50% 증가' },
};
const SKILLS = {
  rush: { name: '돌진 스트레이트', glyph: '➤', cost: 54, multiplier: 2.2, windup: 0.15, detail: '빠르게 충전돼요. 다온이 반격 뒤 빈틈을 보일 때 사용해 큰 피해를 줘요.' },
  bell: { name: '공 울림 카운터', glyph: '✷', cost: 72, multiplier: 2.7, windup: 0.2, detail: '다온의 방어를 풀고 반격을 끊어요. 자동 사용은 방어할 때까지 기다려요.' },
};
// ── 방치형 기본 기능: 스티커 뽑기·도감, 매점 간식 버프, 출석, 일일 미션 ──
const RARITIES = {
  common: { name: '일반', weight: 58 },
  uncommon: { name: '고급', weight: 27 },
  rare: { name: '희귀', weight: 10.5 },
  epic: { name: '영웅', weight: 3.8 },
  legend: { name: '전설', weight: 0.7 },
};
const RARITY_ORDER = Object.keys(RARITIES);
const STICKERS = {
  eraser: { name: '스포츠 테이프', rarity: 'common', stat: 'hp', value: 0.02 },
  ruler: { name: '줄넘기', rarity: 'common', stat: 'attack', value: 0.02 },
  clip: { name: '에너지바', rarity: 'common', stat: 'coin', value: 0.03 },
  notebook: { name: '훈련 일지', rarity: 'common', stat: 'xp', value: 0.03 },
  crayon: { name: '땀 수건', rarity: 'uncommon', stat: 'attack', value: 0.03 },
  stamp: { name: '스폰서 계약 도장', rarity: 'uncommon', stat: 'coin', value: 0.05 },
  bandage: { name: '테이핑 밴드', rarity: 'uncommon', stat: 'hp', value: 0.04 },
  marble: { name: '행운의 메달', rarity: 'rare', stat: 'crit', value: 0.015 },
  slime: { name: '아령', rarity: 'rare', stat: 'attack', value: 0.05 },
  whistle: { name: '심판 호루라기', rarity: 'epic', stat: 'attack', value: 0.07 },
  captain: { name: '주장 완장', rarity: 'epic', stat: 'coin', value: 0.1 },
  goldpen: { name: '황금 글러브', rarity: 'legend', stat: 'attack', value: 0.12 },
};
const STICKER_STATS = { attack: '파워', hp: '체력', coin: '코인', xp: '경험치', crit: '크리티컬' };
const STICKER_LEVELS = Array.from({ length: 100 }, (_, index) => (index + 1) * (index + 2) / 2);
const SNACKS = {
  choco: { name: '프로틴 쉐이크', stat: 'attack', bonus: 0.5, label: '파워 +50%' },
  banana: { name: '바나나우유', stat: 'coin', bonus: 1, label: '코인 2배' },
  berry: { name: '에너지 드링크', stat: 'xp', bonus: 1, label: '경험치 2배' },
};
const SNACK_TIME = 15 * 60;
const SNACK_MAX = 60 * 60;
const WELCOME_TICKETS = 10;
const ATTENDANCE = [{ tickets: 3, gems: 20 }, { coins: 20, gems: 20 }, { patches: 2, gems: 20 }, { tickets: 5, gems: 30 }, { coins: 40, gems: 30 }, { patches: 4, gems: 30 }, { tickets: 10, coins: 60, gems: 100 }];
const DAILY_MISSIONS = {
  wins: { name: '대결 20번 이기기', target: 20, value: state => state.wins - state.daily.baseWins, reward: { tickets: 2 } },
  trains: { name: '훈련 10번 하기', target: 10, value: state => state.daily.trains, reward: { coins: 12 } },
  pulls: { name: '스티커 5번 뽑기', target: 5, value: state => state.daily.pulls, reward: { patches: 2 } },
  snacks: { name: '간식 2번 먹기', target: 2, value: state => state.daily.snacks, reward: { tickets: 2 } },
  dungeons: { name: '던전 3번 하기', target: 3, value: state => state.daily.dungeons || 0, reward: { tickets: 2 } },
  all: { name: '일일 미션 모두 완료', target: 5, value: state => state.daily.claimed.filter(id => id !== 'all').length, reward: { tickets: 5, gems: 30 } },
};

// ── 무리 전투: 1~3번째 대결은 친구 둘 + 무리 대장, 4번째는 1:1 보스전 ──
// 무리 전체 체력·보상 합은 예전 1:1 상대와 같다(share 합 1). 뒤에 선 상대 수만큼 앞 상대의 공격이 세진다(협공).
// 무리 하나 = 친구 다섯(체력·보상 10%씩) + 대장(50%). 맵마다 무리 3개(18명)를 치우면 보스 도전.
const PACK = [
  { share: 0.1, hit: 0.35 }, { share: 0.1, hit: 0.35 }, { share: 0.1, hit: 0.35 }, { share: 0.1, hit: 0.35 }, { share: 0.1, hit: 0.35 },
  { share: 0.5, hit: 1, leader: true },
];
const GANG_UP = 0.12;
const SPLASH = 0.6;
const BOSS_TIME = 40;
// 무리 졸개는 별명으로 부르는 남자 건달들
const CLASSMATES = ['빡빡이', '문신', '깍두기', '덩치', '금목걸이', '반삭', '짝눈', '어깨', '츄리닝', '선글라스', '콧수염', '대머리', '삼선 슬리퍼', '배불뚝이', '흉터', '꽁지머리', '쫄티', '구레나룻'];
// 적 그림(남자). 무리 졸개는 어디서나 건달 8종(Codex 6차). 아카데미의 대장·학년 대표는 기존 남자 선수 그림,
// 지역에서는 대장도 건달, 구역 마지막 보스는 건달 두목 4명(동네 건달 두목 → 시장 건달 두목 → 번화가 큰형님 → 지역 보스)
const MOB_SPRITES = ['thug1', 'thug2', 'thug3', 'thug4', 'thug5', 'thug6', 'thug7', 'thug8'];
const LEADER_SPRITES = ['rival1', 'rival3', 'mob3'];
const BOSS_SPRITES = ['boss2', 'boss4', 'boss5', 'boss6'];
const THUG_LEADERS = ['thug4', 'thug3', 'thug7'];
const THUG_BOSSES = ['thug-boss1', 'thug-boss2', 'thug-boss3', 'thug-boss4'];

// ── 일일 던전: 하루 열쇠 2개, 30초 안에 졸개 셋과 던전 보스를 이기면 다음 단계 ──
const DUNGEONS = {
  coin: { name: '상금 토너먼트', boss: '토너먼트 우승 후보', minion: '토너먼트 참가자', reward: 'coin', hp: 4, hit: 0.6, sprite: 'dboss-store', background: 'd-coin', minionSprites: ['rival1', 'mob1', 'mob3'], map: 5, unlock: 'clear' },
  ticket: { name: '팬 미팅 이벤트전', boss: '인기 스타 선수', minion: '이벤트전 선수', reward: 'ticket', hp: 2.4, hit: 1.5, sprite: 'boss6', background: 'd-ticket', minionSprites: ['rival3', 'mob5', 'mob1'], map: 9, unlock: 'clear' },
  badge: { name: '국가대표 선발전', boss: '국가대표 코치', minion: '선발전 선수', reward: 'badge', hp: 3, hit: 1.3, sprite: 'dboss-sports', background: 'd-badge', minionSprites: ['mob3', 'rival1', 'mob5'], map: 11, unlock: 'transfer' },
};
const DUNGEON_PACK = [
  { share: 0.08, hit: 0.3 }, { share: 0.08, hit: 0.3 }, { share: 0.08, hit: 0.3 }, { share: 0.08, hit: 0.3 }, { share: 0.08, hit: 0.3 },
  { share: 0.6, hit: 1, leader: true },
];
const DUNGEON_KEYS = 2;
const DUNGEON_TIME = 30;
// 상금 토너먼트 30초 기록전: 쓰러지지 않는 스파링 파트너에게 30초 동안 준 유효 피해(주인공+동료)를 잰다.
// 보상 구간 k의 체력 = 진행 3k-1 맵 보스 체력 × tierHp. 기록은 1구간부터 차례로 깎아 도달한 구간까지 코인을 더한다.
// 체력이 아주 커서 넘친 피해는 없고, 체력 비례 기술은 원래 상한(파워 ×20)을 쓴다. 상대 공격은 1이라 지지 않는다.
// 입장권은 하루 2장(던전 열쇠와 따로). 끝날 때 입장권 차감과 보상 지급을 한 번에 한다. 소탕은 최고 기록 구간으로.
const RECORD = { name: '30초 기록전', boss: '기록 측정 스파링 파트너', sprite: 'dboss-sports', background: 'd-coin', hit: 0, map: 5, tierHp: 1.5, tierCoin: 100, hpMult: 1e7 };

// ── 격투 아카데미(4학년) → 졸업 후 시골부터 한국 지역을 하나씩 제패(스포츠 격투 대회) ──
// 회차(cycle) 0 = 아카데미, 1부터 = REGIONS 순서. 지역마다 4구역(동네 도장 → 상가 체육관 → 시민 체육관 → 챔피언전) × 경기장 3곳.
// motion: 주인공 동작 그림 묶음(장비 외형 합성). strike = 주먹, kick = 발차기, knee = 무릎(무에타이), throw = 잡아 메치기(상대는 thrown·pinned),
//         hold = 누르기·조르기(상대는 pinned), spar = 보호구를 갖춘 태권도 겨루기
const ACADEMY = { name: '해솔 격투 아카데미', short: '해솔 아카데미' };
const REGIONS = [
  '정선 산골 마을', '신안 섬마을', '청송 시골 장터', '괴산 읍내', '남원 소도시', '통영 항구', '공주 옛 도읍', '춘천 호반',
  '제주', '전주', '포항', '청주', '창원', '천안', '광주광역시', '대전광역시',
  '울산광역시', '대구광역시', '인천광역시', '부산광역시', '수원', '성남', '서울 강북', '서울 강남',
];
// 지역마다 1-1~4-3을 몇 바퀴 돌아야 제패하는지. 시골은 길게(3), 지방 도시 2, 광역시 1, 서울은 마지막이라 2.
// 바퀴마다 회차(cycle)가 하나씩 늘어 상대·보상이 계속 커진다. 시뮬 기준 시골 1주, 지방 도시 3달, 서울 2년.
const REGION_ROUNDS = REGIONS.map((_, index) => (index < 8 ? 3 : index < 14 ? 2 : index < 22 ? 1 : 2));
const REGION_START = REGION_ROUNDS.reduce((starts, rounds, index) => [...starts, starts[index] + rounds], [1]);
const ZONES = ['동네 도장', '상가 체육관', '시민 체육관', '지역 챔피언전'];
const ZONE_PLACES = [
  ['마을 회관 앞', '장터 공터', '동네 도장'],
  ['상가 체육관 입구', '상가 체육관', '체육관 관장실 앞'],
  ['시민 체육관 연습장', '시민 체육관 관중석', '시민 체육관 메인 링'],
  ['챔피언전 예선', '챔피언전 준결승', '챔피언전 결승'],
];
const ZONE_LEADERS = ['골목 행동대장', '시장 깡패 대장', '번화가 해결사', '두목 오른팔'];
const ZONE_BOSSES = ['동네 건달 두목', '시장 건달 두목', '번화가 큰형님'];
const FIGHTERS = ['강훈', '서진', '태호', '민혁', '지성', '현우', '도겸', '승철', '용팔', '만수', '덕배', '창식', '병철', '두식', '상철', '봉구', '건우', '시혁', '재윤', '칠성', '무진', '대길', '철민', '광수'];
const CONTESTS = {
  boxing: { name: '복싱', prop: null, sound: '퍽!', fx: 'spark', motion: 'strike' },
  kickboxing: { name: '킥복싱', prop: null, sound: '팡!', fx: 'spark', motion: 'kick' },
  muaythai: { name: '무에타이', prop: null, sound: '쾅!', fx: 'spark', motion: 'knee' },
  taekwondo: { name: '태권도', prop: null, sound: '얍!', fx: 'spark', motion: 'spar' },
  wrestling: { name: '레슬링', prop: null, sound: '쿵!', fx: 'cloud', motion: 'throw' },
  judo: { name: '유도', prop: null, sound: '한판!', fx: 'cloud', motion: 'throw' },
  ssireum: { name: '씨름', prop: null, sound: '영차!', fx: 'cloud', motion: 'throw' },
  jiujitsu: { name: '주짓수', prop: null, sound: '꽉!', fx: 'dust', motion: 'hold' },
  mma: { name: '종합격투', prop: null, sound: '쾅!', fx: 'spark', motion: 'strike' },
};
// 아카데미는 경기장마다, 지역은 구역마다 종목이 정해져 있다
const ACADEMY_PLAN = ['boxing', 'boxing', 'boxing', 'kickboxing', 'muaythai', 'boxing', 'wrestling', 'jiujitsu', 'ssireum', 'taekwondo', 'judo', 'mma'];
const REGION_PLANS = [
  ['ssireum', 'boxing', 'judo', 'mma'],
  ['taekwondo', 'kickboxing', 'wrestling', 'mma'],
  ['judo', 'muaythai', 'jiujitsu', 'mma'],
];
const DUNGEON_CONTESTS = { coin: 'boxing', ticket: 'kickboxing', badge: 'mma', trial: 'mma', record: 'boxing' };

// ── 승급(선수 등급): 심사(1:1, 30초)를 통과하면 파워·체력 ×1.3, 스킬 칸·동료 칸이 열린다. 재입학해도 유지 ──
const TIERS = ['연습생', '아마추어', '세미프로', '프로 데뷔', '랭커', '타이틀 도전자', '챔피언', '통합 챔피언', '전설'];
const TIER_MULT = 1.3;
const EXAMINERS = [
  ['기초반 수석 코치', 'rival1'], ['심판 위원장', 'boss2'], ['아마추어 대회 우승자', 'rival3'], ['세미프로 랭킹 1위', 'boss4'],
  ['프로 심사 위원', 'boss5'], ['랭킹 1위 선배', 'boss6'], ['현역 챔피언', 'dboss-sports'], ['전설의 챔피언', 'dboss-store'],
];
const TRIAL = { name: '승급 심사', minion: '심사 위원', reward: 'tier', hp: 2.6, hit: 1.15, background: 'd-exam', map: 9, solo: true };

// ── 동료: 전원 여성 파이터(성인). 모집권으로 모집, 등급(S~F)별로 성급업, 보유 효과. 각자 고유 스킬을 쿨타임마다 알아서 쓴다 ──
// sprite = 대결 그림(mate{n}.webp, motion-mate{n}-*), portrait = 스탠딩 일러스트(stand-mate{n}.webp). 둘 다 Codex 6차 그림.
// 지금 16명은 전부 S급. A~F급 동료는 나중에 추가한다(GRADES 참고).
// 동료마다 무술(style) 하나. skill.kind: hit(앞 상대) · aoe(앞 상대 + 뒤 무리) · buff · heal. 피해 = 내 파워 × mult × 동료 배율
//   한 번에: stun(적 공격 지연 초) boss(대장·보스 배율) pierce(방어 무시) sure(크리티컬 확정) hpPct(남은 체력 비례) execute(졸개 즉시 처치 기준)
//            randMin~randMax(무작위 배율) heal/shield(최대 체력 비율) cdr(다른 쿨타임 감소 초) charge(필살기 기력) reset(동료 쿨타임 초기화) hits(연타 표시)
//   지속(dur초): crit critDmg power speed dodge weaken reflect coin bleed(출혈: 파워 × bleed를 dur초에 나눠서)
const COMPANIONS = {
  // 타격·스피드형
  mate1: { name: '정하린', style: '복싱', grade: 'S', sprite: 'mate1', portrait: 'mate1', skill: { name: '잽 러시', kind: 'hit', mult: 1.5, hits: 3, speed: 0.4, dodge: 0.25, dur: 6, cd: 12, desc: '잽 3연타(파워 ×1.5), 6초 동안 동작 속도 +40%·회피 25%' } },
  mate2: { name: '강아린', style: '태권도', grade: 'S', sprite: 'mate2', portrait: 'mate2', skill: { name: '회오리 연속 차기', kind: 'aoe', mult: 2.4, hits: 3, critDmg: 0.5, dur: 6, cd: 12, desc: '무리 전체 3연타(파워 ×2.4), 6초 동안 크리티컬 피해 +50%' } },
  mate3: { name: '송미루', style: '절권도', grade: 'S', sprite: 'mate3', portrait: 'mate3', skill: { name: '촌경 일격', kind: 'hit', mult: 4, boss: 2.5, pierce: true, cd: 11, desc: '방어를 뚫는 한 방(파워 ×4), 대장·보스에게 2.5배' } },
  mate4: { name: '최유나', style: '무에타이', grade: 'S', sprite: 'mate4', portrait: 'mate4', skill: { name: '팔꿈치·무릎 난타', kind: 'hit', mult: 2, hits: 2, hpPct: 0.04, bleed: 3, dur: 5, cd: 13, desc: '파워 ×2 + 남은 체력 4%, 5초 동안 출혈(파워 ×3)' } },
  mate5: { name: '한가비', style: '카포에라', grade: 'S', sprite: 'mate5', portrait: 'mate5', skill: { name: '징가 회전차기', kind: 'aoe', mult: 2.2, dodge: 0.3, dur: 6, cd: 12, desc: '무리 전체 파워 ×2.2, 6초 동안 회피 30%' } },
  // 잡기·제압형
  mate6: { name: '윤지유', style: '주짓수', grade: 'S', sprite: 'mate6', portrait: 'mate6', skill: { name: '암바 조르기', kind: 'hit', mult: 1.5, stun: 2.5, weaken: 0.3, dur: 5, cd: 12, desc: '파워 ×1.5, 2.5초 행동 불가, 5초 동안 적 공격 −30%' } },
  mate7: { name: '서리나', style: '유도', grade: 'S', sprite: 'mate7', portrait: 'mate7', skill: { name: '업어치기', kind: 'hit', mult: 5, boss: 2, stun: 1, cd: 12, desc: '파워 ×5(대장·보스 2배), 1초 기절' } },
  mate8: { name: '한서아', style: '프로레슬링', grade: 'S', sprite: 'mate8', portrait: 'mate8', skill: { name: '파워 슬램', kind: 'hit', mult: 3, shield: 0.3, cd: 13, desc: '파워 ×3, 최대 체력 30% 보호막' } },
  mate9: { name: '오다솜', style: '씨름', grade: 'S', sprite: 'mate9', portrait: 'mate9', skill: { name: '들배지기', kind: 'hit', mult: 2.5, weaken: 0.35, dur: 6, cd: 12, desc: '파워 ×2.5, 6초 동안 받는 피해 −35%' } },
  // 기공·특수전형
  mate10: { name: '진소라', style: '쿵푸', grade: 'S', sprite: 'mate10', portrait: 'mate10', skill: { name: '태극 기공', kind: 'buff', cdr: 4, charge: 40, cd: 14, desc: '다른 동료·액티브 스킬 쿨타임 −4초, 필살기 기력 +40' } },
  mate11: { name: '임가은', style: '가라데', grade: 'S', sprite: 'mate11', portrait: 'mate11', skill: { name: '정권 일격', kind: 'hit', mult: 3, sure: true, execute: 0.15, cd: 12, desc: '크리티컬 확정(파워 ×3), 남은 체력 15% 이하 졸개는 즉시 처치' } },
  mate12: { name: '이수안', style: '합기도', grade: 'S', sprite: 'mate12', portrait: 'mate12', skill: { name: '역관절 반사', kind: 'heal', heal: 0.2, reflect: 0.6, dur: 6, cd: 14, desc: '체력 20% 회복, 6초 동안 받은 피해의 60% 반사' } },
  mate13: { name: '차예진', style: '크라브 마가', grade: 'S', sprite: 'mate13', portrait: 'mate13', skill: { name: '급소 타격', kind: 'hit', mult: 2, crit: 0.3, power: 0.25, dur: 6, cd: 13, desc: '파워 ×2, 6초 동안 크리티컬 확률 +30%·팀 피해 +25%' } },
  mate14: { name: '유세린', style: '펜싱', grade: 'S', sprite: 'mate14', portrait: 'mate14', skill: { name: '플레슈 찌르기', kind: 'aoe', mult: 3.5, pierce: true, cd: 12, desc: '방어를 무시하고 무리 끝까지 찌르기(파워 ×3.5)' } },
  // 파밍·버프형
  mate15: { name: '주희', style: '취권', grade: 'S', sprite: 'mate15', portrait: 'mate15', skill: { name: '취팔선', kind: 'hit', randMin: 1, randMax: 10, coin: 1, dur: 10, cd: 14, desc: '예측 불가 한 방(파워 ×1~10), 10초 동안 코인 2배' } },
  mate16: { name: '한별', style: '종합격투', grade: 'S', sprite: 'mate16', portrait: 'mate16', skill: { name: '챔피언 러시', kind: 'hit', mult: 6, reset: true, cd: 20, desc: '파워 ×6, 다른 동료 스킬 쿨타임 초기화' } },
};
// 예전 저장의 동료 id(mob1~8, 남녀 섞인 동기)를 새 여성 동료로 옮긴다
const LEGACY_MATES = { mob1: 'mate1', mob2: 'mate8', mob3: 'mate5', mob4: 'mate6', mob5: 'mate7', mob6: 'mate2', mob7: 'mate4', mob8: 'mate16' };
// 출전 칸: 처음 1칸, 아카데미 졸업·시골 4곳 제패·시골 8곳 제패 때마다 1칸(최대 4). 최고 기록 기준이라 재입학해도 유지
const PARTY_MAX = 4;
const PARTY_UNLOCKS = [1, REGION_START[4], REGION_START[8]];
const PARTY_UNLOCK_TEXT = ['', '아카데미 졸업 때 열림', `${REGIONS[3]} 제패 때 열림`, `${REGIONS[7]} 제패 때 열림`];
// ── 동료 등급: S·A·B·C·D·F ──
// S·A는 그 동료의 조각을 모아 별 5개까지 성급업(starCost = 1→2, 2→3, 3→4, 4→5에 드는 조각). B 이하는 별 1개 고정.
// 아직 없는 동료도 조각을 unlock만큼 모으면 영입된다. 처음 모집하는 1번째는 S급 확정.
// 겹쳐 뽑히면 S·A는 그 동료 조각(dupShards), B 이하는 보석(dupGems)으로 바뀐다.
// 아직 그 등급 동료가 없으면(지금은 A~F) 그 자리는 무작위 S 동료 조각(fill)으로 나온다.
// power = 동료 공격(내 파워 대비), owned = 별 하나당 보유 효과(파워), trainCost = 코인 레벨업 비용 배율, tone = 카드 색
const GRADES = {
  S: { name: 'S급', weight: 3, maxStar: 5, unlock: 40, starCost: [10, 20, 40, 80], dupShards: 10, fill: 0, power: 0.5, owned: 0.02, trainCost: 6, tone: 'legend' },
  A: { name: 'A급', weight: 9, maxStar: 5, unlock: 30, starCost: [8, 16, 30, 50], dupShards: 6, fill: 5, power: 0.34, owned: 0.012, trainCost: 4, tone: 'epic' },
  B: { name: 'B급', weight: 16, maxStar: 1, unlock: 20, dupGems: 8, fill: 3, power: 0.24, owned: 0.008, trainCost: 2.5, tone: 'rare' },
  C: { name: 'C급', weight: 24, maxStar: 1, unlock: 15, dupGems: 4, fill: 2, power: 0.17, owned: 0.006, trainCost: 1.6, tone: 'uncommon' },
  D: { name: 'D급', weight: 28, maxStar: 1, unlock: 10, dupGems: 2, fill: 1, power: 0.12, owned: 0.004, trainCost: 1.2, tone: 'common' },
  F: { name: 'F급', weight: 20, maxStar: 1, unlock: 10, dupGems: 1, fill: 1, power: 0.08, owned: 0.003, trainCost: 1, tone: 'common' },
};
const GRADE_ORDER = Object.keys(GRADES);
const STAR_STEP = 0.25; // 별 하나당 동료 공격·스킬 +25%
// 조각작: 보스를 이기면 출전 중인 동료 조각. 학년·구역 마지막 보스는 확정 2개, 그 밖의 보스는 30% 확률로 1개
const SHARD_DROP = { chance: 0.3, normal: 1, final: 2 };
const ALLY_INTERVAL = 1.6;
const ALLY_TRAIN = { base: 40, scale: 1.14, step: 0.05, capBase: 20, capPerStar: 20 };
const CRIT_BASE = 1.8;

// ── 액티브 스킬: 승급할 때마다 한 칸씩 열리고, 쿨타임이 돌면 자동으로 쓴다 ──
const ACTIVE = {
  pencil: { name: '연타 러시', tier: 1, cd: 8, desc: '빠른 연타로 앞 상대와 뒤의 팀 모두를 몰아붙여요', lvBonus: '피해 +5%', lvBase: 120, lvScale: 1.2, lvCap: 60 },
  cheer: { name: '관중 함성', tier: 2, cd: 15, dur: 6, desc: '6초 동안 나와 동료 파워 배율 증가', lvBonus: '배율 +0.01', lvBase: 300, lvScale: 1.2, lvCap: 50 },
  lunch: { name: '프로틴 충전', tier: 3, cd: 12, desc: '체력을 크게 회복', lvBonus: '회복 +1%p', lvBase: 600, lvScale: 1.2, lvCap: 40 },
  sprint: { name: '풋워크', tier: 4, cd: 18, dur: 6, desc: '6초 동안 동작 속도 배율 증가', lvBonus: '배율 +0.01', lvBase: 1200, lvScale: 1.2, lvCap: 50 },
};

// ── 보석(유료 재화 자리)·상점·우편·퀘스트·성장 패스 ──
const SHOP = {
  daily: { name: '매일 무료 선물', desc: '뽑기권 1 · 동료 모집권 1', price: 0, limit: 1, reward: { tickets: 1, recruits: 1 } },
  tickets10: { name: '스티커 뽑기권 10장', price: 300, reward: { tickets: 10 } },
  recruit1: { name: '동료 모집권 1장', price: 100, reward: { recruits: 1 } },
  recruit10: { name: '동료 모집권 10장', price: 900, reward: { recruits: 10 }, tag: '10% 할인' },
  keys: { name: '던전 열쇠 세트', desc: '모든 던전 열쇠 +1', price: 100, limit: 2, reward: { keys: 1 } },
  coinbox: { name: '코인 상자', desc: '대결 약 600번 분량', price: 150, reward: { coinUnits: 600 } },
  patches: { name: '천 조각 꾸러미', price: 80, reward: { patches: 20 } },
  snacks: { name: '간식 세트', desc: '세 가지 간식 15분씩', price: 60, reward: { snacks: 1 } },
};
// 캐시 상품: 결제 연결 전까지 '준비 중'. 결제가 끝나면 grantPurchase(state, id)만 부르면 된다.
const CASH = {
  starter: { name: '입학 축하 패키지', price: '₩1,100', desc: '보석 300 · 동료 모집권 10 · 뽑기권 20', reward: { gems: 300, recruits: 10, tickets: 20 }, once: true },
  monthly: { name: '식단 월정액 30일', price: '₩5,500', desc: '즉시 보석 300 + 30일 동안 매일 보석 100', reward: { gems: 300, monthly: 30 } },
  pass: { name: '프리미엄 성장 패스', price: '₩9,900', desc: '성장 패스 프리미엄 칸 보상 열기', reward: { premiumPass: true }, once: true },
  adfree: { name: '간식 무제한', price: '₩6,600', desc: '간식 버프를 최대 3시간까지 쌓기', reward: { adFree: true }, once: true },
  gems1: { name: '보석 주머니', price: '₩3,300', desc: '보석 330', reward: { gems: 330 } },
  gems2: { name: '보석 상자', price: '₩33,000', desc: '보석 3,800', reward: { gems: 3800 } },
};
const OFFLINE_DOUBLE_GEMS = 50;
const PASS_STEP = 3;
const QUEST_VALUE = {
  best: state => Math.max(state.prestige.best, progress(state)),
  power: state => state.training.power,
  health: state => state.training.health,
  level: state => state.level,
  pulls: state => state.stats.pulls,
  recruits: state => state.stats.recruits,
  dungeons: state => state.stats.dungeons,
  tier: state => state.tier,
  transfer: state => state.prestige.count,
  party: state => state.party.filter(Boolean).length,
};
const QUEST_SCRIPT = [
  ['power', 3, 20], ['best', 1, 20], ['health', 3, 20], ['pulls', 10, 30], ['recruits', 1, 30], ['party', 1, 30],
  ['best', 3, 30], ['level', 5, 30], ['power', 10, 40], ['dungeons', 1, 40], ['best', 4, 40], ['tier', 1, 60],
  ['health', 10, 40], ['best', 6, 50], ['recruits', 5, 50], ['tier', 2, 60], ['transfer', 1, 80], ['party', 2, 50],
  ['best', 9, 60], ['dungeons', 5, 60], ['power', 25, 60], ['tier', 3, 80], ['best', 12, 60], ['pulls', 50, 60],
];
const QUEST_LOOP = ['best', 'power', 'health', 'level', 'pulls', 'dungeons', 'recruits'];

// ── 환생: 재입학 → 명예 배지 → 명예 코칭(영구 강화) ──
const PRESTIGE_UNLOCK = 6;
const PRESTIGE = { base: 3, growth: 1.05 };
// 코칭 효과는 레벨마다 곱해진다(×mult^레벨). 비용은 base × growth^레벨.
const PERKS = {
  power: { name: '전설 코치 특훈', stat: 'attack', mult: 1.1, base: 3, growth: 1.15, cap: 1e9 },
  health: { name: '체력 캠프', stat: 'hp', mult: 1.1, base: 3, growth: 1.15, cap: 1e9 },
  coin: { name: '스폰서 계약', stat: 'coin', mult: 1.12, base: 4, growth: 1.16, cap: 1e9 },
  xp: { name: '경기 영상 분석', stat: 'xp', mult: 1.1, base: 4, growth: 1.18, cap: 1e9 },
  offline: { name: '숙소 휴식', stat: 'offline', value: 3600, base: 10, growth: 3, cap: 4 },
};
const freshPrestige = () => ({ count: 0, badges: 0, earned: 0, best: 0, perks: Object.fromEntries(Object.keys(PERKS).map(id => [id, 0])) });

const DAON_MAP = 2;
const BOSS_PHASES = {
  ready: { duration: 1.4, next: 'guard' },
  guard: { duration: 2.3, next: 'counter' },
  counter: { duration: 0.65, next: 'open' },
  open: { duration: 1.85, next: 'ready' },
  broken: { duration: 2.25, next: 'ready' },
};

const STEP = 0.05;
const OFFLINE_LIMIT = 4 * 3600;
// 주소 끝에 ?test를 붙이면 테스트 모드: 저장을 따로 쓰고 테스트 도구가 열린다(진짜 저장은 그대로)
const TEST_MODE = typeof location !== 'undefined' && /(^|[?&#])test\b/.test(`${location.search}${location.hash}`);
const SAVE_KEY = TEST_MODE ? 'haesol-recess-king-test' : 'haesol-recess-king-v1';
const BOSS_WAVE = 3;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const NUMBER_UNITS = ['', '만', '억', '조', '경', '해', '자', '양', '구', '간', '정', '재', '극', '항하사', '아승기', '나유타', '불가사의', '무량대수'];
function fmt(value) {
  const number = Math.floor(value);
  if (!Number.isFinite(number)) return '∞';
  if (Math.abs(number) < 100000) return number.toLocaleString('ko-KR');
  const tier = Math.floor(Math.log10(Math.abs(number)) / 4);
  const scaled = number / 10 ** (tier * 4);
  const shown = scaled >= 1000 ? Math.floor(scaled).toLocaleString('ko-KR') : scaled >= 100 ? String(Math.floor(scaled)) : String(Math.floor(scaled * (scaled >= 10 ? 10 : 100)) / (scaled >= 10 ? 10 : 100));
  return `${shown}${numberUnit(tier)}`;
}
// 무량대수(10^68) 다음은 A(10^72), B, … Z, AA, AB … 로 4자리씩 이어 간다
function numberUnit(tier) {
  if (tier < NUMBER_UNITS.length) return NUMBER_UNITS[tier];
  let index = tier - NUMBER_UNITS.length;
  let name = '';
  do { name = String.fromCharCode(65 + (index % 26)) + name; index = Math.floor(index / 26) - 1; } while (index >= 0);
  return name;
}

function newGame() {
  const state = freshState();
  const mobs = makeMobs(state);
  state.front = mobs[0];
  state.pack = mobs.slice(1).map(mob => ({ ...mob, hp: mob.max }));
  state.enemyHp = state.front.max;
  return state;
}

function freshState() {
  return {
    dungeons: Object.fromEntries(Object.keys(DUNGEONS).map(id => [id, 0])), dungeon: null, dungeonResult: null, front: null, pack: [],
    gems: 0, recruits: 0, companions: {}, mateShards: {}, mateGrade: 1, autoMates: true, record: { best: 0, tier: 0 }, dungeonAuto: {}, dungeonChain: null, rush: null, party: [null, null, null, null], allyTimers: [1.1, 1.5, 1.9, 2.3], mateBuffs: {}, shield: 0, tier: 0,
    cooldowns: {}, buffs: {}, autoSkills: true, quest: 0, stats: { pulls: 0, recruits: 0, dungeons: 0 },
    pass: { free: 0, premium: 0 }, premium: { pass: false, adFree: false, monthly: 0, bought: {} }, mail: [], mailSeq: 0,
    profile: null, level: 1, xp: 0, coins: 12, map: 0, wave: 0, wins: 0,
    cleared: MAPS.map(() => false), training: Object.fromEntries(Object.keys(TRAINING).map(id => [id, 0])), allyLv: {}, skillLv: {}, autoTrain: false,
    tickets: WELCOME_TICKETS, stickers: {}, snacks: { choco: 0, banana: 0, berry: 0 }, speed: 1,
    attendance: { count: 0, last: '' }, daily: null, prestige: freshPrestige(), cycle: 0, totalClears: 0,
    bag: Object.values(STARTER_GEAR), equipped: { ...STARTER_GEAR }, ranks: {}, patches: 0,
    mapWins: MAPS.map(() => 0), missions: { wins: 0, clears: 0, closet: 0 }, farm: null,
    classId: null, autoNext: true, autoSkill: true, skillId: 'rush', sound: true, charge: 0, hp: 84, enemyHp: MAPS[0].hp[0],
    nextAttack: 0.65, nextEnemy: 1.5, pause: 0.2, tickRemainder: 0,
    playerMove: null, enemyMove: null, roundEnd: null, bossPhase: 'ready', bossTimer: BOSS_PHASES.ready.duration,
    log: ['격투 아카데미 입학 첫날. 정문에서 첫 스파링이 시작됐어요.'],
  };
}

function xpTarget(state) { return Math.round((24 + (state.level - 1) * 14) * 1.045 ** Math.max(0, state.level - 40)); }
function gearStats(state, id) {
  const item = GEAR[id];
  const rank = state.ranks[id] || 0;
  return { attack: item.attack ? item.attack + rank : 0, hp: item.hp ? item.hp + rank * 5 : 0 };
}
function outfitStat(state, key) { return Object.values(state.equipped).reduce((sum, id) => sum + gearStats(state, id)[key], 0); }
function rankBonus(state) { return Object.values(state.equipped).reduce((sum, id) => sum + (state.ranks[id] || 0), 0) * RANK_BONUS; }
function stickerLevel(state, id) {
  const copies = state.stickers?.[id] || 0;
  return Math.min(STICKER_LEVELS.length, Math.floor((Math.sqrt(8 * copies + 1) - 1) / 2));
}
function milestoneMultiplier(level) { return 2 ** Math.floor(level / MILESTONE); }
function trainingCostAt(id, level) {
  const info = TRAINING[id];
  if (!info.milestone) return Math.ceil(info.base * info.scale ** level);
  return Math.ceil(info.base * info.scale ** Math.min(level, MILESTONE) * COST_TAIL ** Math.max(0, level - MILESTONE));
}
function baseValue(map, kind) {
  const grade = gradeIndex(map);
  if (kind === 'hp') return MAPS[map].hp[BOSS_WAVE] * GRADE_SCALING[grade].hp;
  if (kind === 'hit') return MAPS[map].hit[BOSS_WAVE] * GRADE_SCALING[grade].attack;
  if (kind === 'coin') return 8 + 6 * grade + 2 * (map % MAPS_PER_GRADE);
  return 8 + grade * 5;
}
function cycleScale(state, kind) {
  const cycle = state.cycle || 0;
  if (!cycle) return 1;
  const last = MAPS.length - 1;
  return baseValue(last, kind) * GROWTH[kind] ** (cycle * MAPS.length + state.map - last) / baseValue(state.map, kind);
}
function stickerBonus(state, stat) {
  return Object.entries(STICKERS).reduce((sum, [id, sticker]) => sum + (sticker.stat === stat ? sticker.value * stickerLevel(state, id) : 0), 0);
}
function snackBonus(state, stat) {
  return Object.entries(SNACKS).reduce((sum, [id, snack]) => sum + (snack.stat === stat && state.snacks?.[id] > 0 ? snack.bonus : 0), 0);
}
function perkBonus(state, stat) {
  return Object.entries(PERKS).reduce((sum, [id, perk]) => sum + (perk.stat === stat && perk.value ? perk.value * (state.prestige?.perks[id] || 0) : 0), 0);
}
function perkMultiplier(state, stat) {
  return Object.entries(PERKS).reduce((product, [id, perk]) => product * (perk.stat === stat && perk.mult ? perk.mult ** (state.prestige?.perks[id] || 0) : 1), 1);
}
function perkCost(state, id) { return Math.ceil(PERKS[id].base * PERKS[id].growth ** state.prestige.perks[id]); }
function offlineLimit(state) { return OFFLINE_LIMIT + perkBonus(state, 'offline'); }
function clearedCount(state) { return state.cleared.filter(Boolean).length; }
function progress(state) { return (state.cycle || 0) * MAPS.length + clearedCount(state); }
function prestigeGain(state) {
  const reached = progress(state);
  if (reached < PRESTIGE_UNLOCK) return 0;
  return Math.floor(PRESTIGE.base * PRESTIGE.growth ** reached);
}
function transfer(state) {
  const gain = prestigeGain(state);
  if (!gain) return 0;
  const reached = progress(state);
  const keep = {};
  for (const key of ['profile', 'wins', 'bag', 'equipped', 'ranks', 'patches', 'missions', 'classId', 'autoNext', 'autoSkill', 'skillId', 'sound',
    'tickets', 'stickers', 'snacks', 'speed', 'attendance', 'daily', 'totalClears', 'dungeons', 'dungeonResult',
    'gems', 'recruits', 'companions', 'mateShards', 'mateGrade', 'autoMates', 'record', 'dungeonAuto', 'test', 'party', 'tier', 'autoSkills', 'quest', 'stats', 'pass', 'premium', 'mail', 'mailSeq', 'autoTrain']) keep[key] = state[key];
  const before = state.prestige;
  Object.assign(state, newGame(), keep);
  state.prestige = { ...before, count: before.count + 1, badges: before.badges + gain, earned: before.earned + gain, best: Math.max(before.best, reached) };
  state.hp = maxHp(state);
  const until = rushEnd(state.prestige.best);
  state.rush = until > 0 ? { until } : null;
  state.log = [`${state.prestige.count}번째 재입학! 아카데미 1학년 정문에서 다시 시작해요.${until ? ` ${placeLabel(until)}까지 빠른 복귀 ×${RUSH_SPEED}.` : ''}`];
  return gain;
}
function critPower(state) { return CRIT_BASE + 0.05 * (state.training.critDmg || 0) + mateBuff(state, 'critDmg'); }
function regenRate(state) { return 0.001 * (state.training.recover || 0); }
function critChance(state) { return Math.min(0.6, (state.training.focus || 0) * 0.01 + stickerBonus(state, 'crit')) + mateBuff(state, 'crit') + teamSynergy(state).crit; }
function coinUnit(state) { return Math.round((8 + 6 * gradeIndex(state.map) + 2 * (state.map % MAPS_PER_GRADE)) * cycleScale(state, 'coin')); }
function pullCost(state) { return Math.round(30 * 1.22 ** clearedCount(state) * cycleScale(state, 'coin')); }
function statBonus(state, stat) {
  const body = stat === 'attack' || stat === 'hp';
  const additive = 1 + stickerBonus(state, stat) + (body ? rankBonus(state) : 0) + (stat === 'attack' ? companionOwned(state) : 0);
  return additive * perkMultiplier(state, stat) * (body ? TIER_MULT ** (state.tier || 0) : 1);
}
function maxHp(state) {
  const health = state.training.health;
  const base = 80 + (state.level - 1) * 11 + health * 15 * milestoneMultiplier(health) + outfitStat(state, 'hp');
  return Math.round(base * statBonus(state, 'hp'));
}
function attack(state) {
  const power = state.training.power;
  const base = 8 + (state.level - 1) * 3 + power * 4 * milestoneMultiplier(power) + outfitStat(state, 'attack');
  return Math.round(base * statBonus(state, 'attack') * (1 + snackBonus(state, 'attack')));
}
function enemyHit(state) {
  const base = state.dungeon
    ? atProgress(dungeonReach(state), 'hit') * dungeonInfo(state.dungeon.id).hit
    : MAPS[state.map].hit[state.wave] * GRADE_SCALING[gradeIndex(state.map)].attack * cycleScale(state, 'hit');
  const rule = ruleId(state);
  return base * (state.front?.hit ?? 1) * (1 + GANG_UP * aliveBehind(state)) * (1 - mateBuff(state, 'weaken')) * (1 - teamSynergy(state).weaken) * ((rule && RULES[rule].hit) || 1);
}
function winCoins(state, firstBoss) {
  const grade = gradeIndex(state.map);
  const boss = state.wave === BOSS_WAVE;
  const baseCoins = (8 + 6 * grade + 2 * (state.map % MAPS_PER_GRADE) + 2 * state.wave) * (boss ? 2 : 1);
  const coinBonus = state.classId === 'math' ? 1.25 : 1;
  const extra = statBonus(state, 'coin') * (1 + snackBonus(state, 'coin')) * (1 + mateBuff(state, 'coin')) * (1 + teamSynergy(state).coin);
  return Math.round((baseCoins + (firstBoss ? 15 + 5 * grade : 0)) * coinBonus * extra * cycleScale(state, 'coin'));
}
function winXp(state) {
  const grade = gradeIndex(state.map);
  const boss = state.wave === BOSS_WAVE;
  return Math.round((8 + grade * 5 + state.wave * 2) * (boss ? 2 : 1) * statBonus(state, 'xp') * (1 + snackBonus(state, 'xp')) * cycleScale(state, 'xp'));
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function refreshDay(state, today) {
  if (!state.daily || state.daily.date !== today) {
    const first = !state.daily;
    state.daily = { date: today, baseWins: state.wins, trains: 0, pulls: 0, snacks: 0, dungeons: 0, claimed: [], shop: {},
      keys: { ...Object.fromEntries(Object.keys(DUNGEONS).map(id => [id, DUNGEON_KEYS])), record: DUNGEON_KEYS } };
    if (!first && state.premium?.monthly > 0) {
      state.premium.monthly--;
      sendMail(state, '식단 월정액 오늘의 보석', { gems: 100 }, `남은 기간 ${state.premium.monthly}일`);
    }
  }
}
function grant(state, reward) {
  const given = { coins: (reward.coins || 0) * coinUnit(state), tickets: reward.tickets || 0, patches: reward.patches || 0, gems: reward.gems || 0 };
  state.coins += given.coins;
  state.tickets += given.tickets;
  state.patches += given.patches;
  state.gems = (state.gems || 0) + given.gems;
  return given;
}
function rollRarity(rng) {
  const total = Object.values(RARITIES).reduce((sum, rarity) => sum + rarity.weight, 0);
  let roll = rng() * total;
  for (const [id, rarity] of Object.entries(RARITIES)) {
    roll -= rarity.weight;
    if (roll < 0) return id;
  }
  return 'common';
}
function pullStickers(state, count, rng = Math.random) {
  const results = [];
  const rank = rarity => RARITY_ORDER.indexOf(rarity);
  for (let index = 0; index < count; index++) {
    let rarity = rollRarity(rng);
    const lastOfTen = count >= 10 && index === count - 1;
    if (lastOfTen && rank(rarity) < rank('rare') && !results.some(result => rank(result.rarity) >= rank('rare'))) rarity = 'rare';
    const pool = Object.keys(STICKERS).filter(id => STICKERS[id].rarity === rarity);
    const id = pool[Math.floor(rng() * pool.length)];
    const before = stickerLevel(state, id);
    state.stickers[id] = (state.stickers[id] || 0) + 1;
    const after = stickerLevel(state, id);
    results.push({ id, rarity, isNew: before === 0, leveled: before > 0 && after > before, level: after });
  }
  return results;
}
function waveHp(state) {
  if (state.dungeon) return atProgress(dungeonReach(state), 'hp') * dungeonInfo(state.dungeon.id).hp;
  const hp = MAPS[state.map].hp[state.wave] * GRADE_SCALING[gradeIndex(state.map)].hp * cycleScale(state, 'hp');
  return hp * 0.64 ** (state.farm?.easy || 0);
}
function enemyMaxHp(state) { return state.front?.max ?? Math.max(1, Math.round(waveHp(state))); }
function rivalSprite(map, wave, cycle = 0) {
  const boss = wave === BOSS_WAVE;
  if (cycle) {
    if (boss && isGradeFinal(map)) return THUG_BOSSES[gradeIndex(map)];
    return THUG_LEADERS[(map + wave) % THUG_LEADERS.length];
  }
  if (boss && isGradeFinal(map)) return BOSS_SPRITES[gradeIndex(map) % BOSS_SPRITES.length];
  return boss ? 'mob5' : LEADER_SPRITES[(map + wave) % LEADER_SPRITES.length];
}
function mobKey(state) {
  return state.dungeon ? `d:${state.dungeon.id}:${state.dungeon.level}` : `${state.cycle || 0}:${state.map}:${state.wave}:${state.farm?.easy || 0}`;
}
function makeMobs(state) {
  const full = waveHp(state);
  const key = mobKey(state);
  const make = (slot, name, sprite) => ({ name, share: slot.share, hit: slot.hit, sprite, leader: Boolean(slot.leader), key, max: Math.max(1, Math.round(full * slot.share * ruleHp(state, slot.leader))) });
  if (state.dungeon?.id === 'trial') {
    const [name, sprite] = EXAMINERS[(state.dungeon.level - 1) % EXAMINERS.length];
    return [make({ share: 1, hit: 1, leader: true }, name, sprite)];
  }
  if (state.dungeon?.id === 'record') {
    return [{ name: RECORD.boss, share: 1, hit: 1, sprite: RECORD.sprite, leader: true, key, max: Math.max(1, Math.round(attack(state) * RECORD.hpMult)) }];
  }
  if (state.dungeon) {
    const dungeon = DUNGEONS[state.dungeon.id];
    return DUNGEON_PACK.map((slot, index) => make(slot, slot.leader ? dungeon.boss : `${dungeon.minion} ${index + 1}`, slot.leader ? dungeon.sprite : dungeon.minionSprites[index % dungeon.minionSprites.length]));
  }
  const { map, wave } = state;
  const cycle = state.cycle || 0;
  const leader = rivalSprite(map, wave, cycle);
  const names = stageNames(cycle, map);
  if (wave === BOSS_WAVE) return [make({ share: 1, hit: 1, leader: true }, names[wave], leader)];
  return PACK.map((slot, index) => make(slot,
    slot.leader ? names[wave] : CLASSMATES[(cycle * 5 + map * 7 + wave * 3 + index) % CLASSMATES.length],
    slot.leader ? leader : MOB_SPRITES[(map + wave * 2 + index) % MOB_SPRITES.length]));
}
function aliveBehind(state) { return state.pack?.filter(mob => mob.hp > 0).length || 0; }
function atProgress(reached, kind) {
  const map = reached % MAPS.length;
  return baseValue(map, kind) * cycleScale({ cycle: Math.floor(reached / MAPS.length), map }, kind);
}
function dungeonProgress(level) { return 3 * level - 1; }
function regionIndex(cycle) {
  if (!cycle) return -1;
  const index = REGION_START.findIndex(start => start > cycle) - 1;
  return index < 0 ? REGIONS.length : index;
}
function regionRound(cycle) {
  const index = regionIndex(cycle);
  return index >= 0 && index < REGIONS.length ? cycle - REGION_START[index] : 0;
}
function lastRound(cycle) {
  const index = regionIndex(cycle);
  return index >= REGIONS.length || (index >= 0 && regionRound(cycle) === REGION_ROUNDS[index] - 1);
}
function roundTag(cycle) {
  const index = regionIndex(cycle);
  return index >= 0 && index < REGIONS.length && REGION_ROUNDS[index] > 1 ? `${regionRound(cycle) + 1}/${REGION_ROUNDS[index]}` : '';
}
function schoolName(cycle) {
  if (!cycle) return ACADEMY.short;
  const index = regionIndex(cycle);
  return index < REGIONS.length ? REGIONS[index] : `전국 챔피언 방어전 ${cycle - REGION_START[REGIONS.length] + 1}시즌`;
}
function stageLabel(cycle, map) {
  const tag = roundTag(cycle);
  // 지역은 큰 제목(장소)이 구역을 말해 주므로 지역 이름·바퀴·번호만 쓴다(위쪽 버튼과 겹치지 않게)
  return cycle ? `${schoolName(cycle)}${tag ? ` ${tag}` : ''} · ${mapCode(map)}` : `${schoolName(cycle)} ${gradeLabel(cycle, map)} · ${mapCode(map)}`;
}
function gradeLabel(cycle, map) {
  const block = gradeIndex(map);
  return cycle ? ZONES[block] : `${block + 1}학년`;
}
function stagePlace(cycle, map) { return cycle ? ZONE_PLACES[gradeIndex(map)][map % MAPS_PER_GRADE] : MAPS[map].place; }
function stageNames(cycle, map) {
  if (!cycle) return MAPS[map].names;
  const block = gradeIndex(map);
  const pick = k => FIGHTERS[(cycle * 31 + map * 7 + k * 13) % FIGHTERS.length];
  const region = schoolName(cycle).split(' ')[0];
  const title = !isGradeFinal(map) ? ZONE_LEADERS[block] : block < GRADE_COUNT - 1 ? `${region} ${ZONE_BOSSES[block]}` : lastRound(cycle) ? `${region} 보스` : `${region} 부두목`;
  return [pick(0), pick(1), pick(2), `${title} ${pick(3)}`];
}
function placeLabel(reached) {
  const cycle = Math.floor(reached / MAPS.length);
  const map = reached % MAPS.length;
  return `${schoolName(cycle)} ${mapCode(map)}`;
}
function contestId(state) {
  if (state.test?.contest && Object.hasOwn(CONTESTS, state.test.contest)) return state.test.contest;
  if (state.dungeon) return DUNGEON_CONTESTS[state.dungeon.id] || 'boxing';
  const cycle = state.cycle || 0;
  if (!cycle) return ACADEMY_PLAN[state.map] || 'boxing';
  return REGION_PLANS[(cycle - 1) % REGION_PLANS.length][gradeIndex(state.map)];
}
function contest(state) { return CONTESTS[contestId(state)]; }
const ACADEMY_ART = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10', 'a11', 'a12'];
const ZONE_ART = {
  rural: ['z01r', 'z02r', 'z03r', 'z04r'],
  city: ['z01c', 'z02c', 'z03c', 'z04c'],
};
function stageArt(cycle, map) {
  if (!cycle) return ACADEMY_ART[map];
  return ZONE_ART[regionIndex(cycle) < 8 ? 'rural' : 'city'][gradeIndex(map)];
}
function venueMap(state) {
  if (state.dungeon) return null;
  const cycle = state.cycle || 0;
  if (cycle && contestId(state) === 'ssireum') return 'a09';
  return stageArt(cycle, state.map);
}
function regionConquered(state, index) { return bestProgress(state) >= REGION_START[index + 1] * MAPS.length; }
function dungeonInfo(id) { return id === 'trial' ? TRIAL : id === 'record' ? RECORD : DUNGEONS[id]; }
function dungeonReach(state) { return state.dungeon.id === 'trial' ? tierReq(state.dungeon.level) : state.dungeon.id === 'record' ? progress(state) : dungeonProgress(state.dungeon.level); }
function recordTierHp(tier) { return atProgress(dungeonProgress(tier), 'hp') * RECORD.tierHp; }
// 피해량으로 도달한 보상 구간과 다음 구간까지 남은 피해
function recordTier(damage) {
  let left = damage;
  for (let tier = 0; tier < 2000; tier++) {
    const hp = recordTierHp(tier + 1);
    if (left < hp) return { tier, next: Math.ceil(hp - left) };
    left -= hp;
  }
  return { tier: 2000, next: 0 };
}
function recordReward(state, tier) {
  let coins = 0;
  for (let k = 1; k <= tier; k++) coins += atProgress(dungeonProgress(k), 'coin') * RECORD.tierCoin;
  return { coins: Math.round(coins * statBonus(state, 'coin')) };
}
function recordKeys(state) { return state.daily?.keys?.record ?? DUNGEON_KEYS; }
function recordUnlocked(state) { return dungeonUnlocked(state, 'coin'); }
function enterRecord(state) {
  if (!recordUnlocked(state) || state.dungeon || state.roundEnd?.leaveDungeon || recordKeys(state) <= 0) return false;
  if (state.roundEnd) {
    const end = state.roundEnd;
    state.farm = end.nextFarm;
    state.map = end.nextMap;
    state.wave = end.nextWave;
    state.roundEnd = null;
  }
  state.dungeon = { id: 'record', level: 1, time: DUNGEON_TIME };
  state.hp = maxHp(state);
  openFight(state, state.map, state.wave, 0.6);
  return true;
}
function useRecordKey(state) {
  state.daily.keys = { ...state.daily.keys, record: recordKeys(state) - 1 };
  state.daily.dungeons = (state.daily.dungeons || 0) + 1;
  state.stats.dungeons++;
}
function sweepRecord(state) {
  const best = state.record?.tier || 0;
  if (!best || state.dungeon || recordKeys(state) <= 0) return null;
  useRecordKey(state);
  const reward = grantDungeon(state, 'record', best);
  state.dungeonResult = { id: 'record', level: best, win: true, sweep: true, record: state.record.best, best: state.record.best, next: recordTier(state.record.best).next, text: rewardLine(reward), serial: (state.dungeonResult?.serial || 0) + 1 };
  return reward;
}
function dungeonUnlocked(state, id) {
  return DUNGEONS[id].unlock === 'transfer' ? state.prestige.count > 0 : (state.totalClears >= 3 || state.prestige.count > 0);
}
function dungeonReward(state, id, level) {
  if (id === 'record') return recordReward(state, level);
  const reached = dungeonProgress(level);
  if (id === 'coin') return { coins: Math.round(atProgress(reached, 'coin') * 300 * statBonus(state, 'coin')) };
  if (id === 'ticket') return { tickets: 1 + Math.floor(level / 10) };
  return { badges: Math.max(1, Math.floor(PRESTIGE.base * PRESTIGE.growth ** reached * 0.05)) };
}
function rewardLine(reward) {
  return [reward.coins && `코인 +${fmt(reward.coins)}`, reward.tickets && `뽑기권 +${reward.tickets}`, reward.badges && `명예 배지 +${fmt(reward.badges)}`].filter(Boolean).join(' · ');
}
function grantDungeon(state, id, level) {
  const reward = dungeonReward(state, id, level);
  state.coins += reward.coins || 0;
  state.tickets += reward.tickets || 0;
  if (reward.badges) {
    state.prestige.badges += reward.badges;
    state.prestige.earned += reward.badges;
  }
  return reward;
}
function dungeonKeys(state, id) { return state.daily?.keys?.[id] ?? 0; }
function enterDungeon(state, id) {
  if (!dungeonUnlocked(state, id) || state.dungeon || state.roundEnd?.leaveDungeon || dungeonKeys(state, id) <= 0) return false;
  if (state.roundEnd) {
    // 끝난 대결의 다음 위치(다음 맵·년차·수련)를 먼저 확정하고 던전에 들어간다
    const end = state.roundEnd;
    state.farm = end.nextFarm;
    state.map = end.nextMap;
    state.wave = end.nextWave;
    state.roundEnd = null;
  }
  state.dungeon = { id, level: (state.dungeons[id] || 0) + 1, time: DUNGEON_TIME };
  state.hp = maxHp(state);
  openFight(state, state.map, state.wave, 0.6);
  return true;
}
function sweepDungeon(state, id) {
  const best = state.dungeons[id] || 0;
  if (!best || state.dungeon || dungeonKeys(state, id) <= 0) return null;
  state.daily.keys[id]--;
  state.daily.dungeons = (state.daily.dungeons || 0) + 1;
  state.stats.dungeons++;
  const reward = grantDungeon(state, id, best);
  state.dungeonResult = { id, level: best, win: true, sweep: true, text: rewardLine(reward), serial: (state.dungeonResult?.serial || 0) + 1 };
  return reward;
}
function leaveDungeon(state, win, emit, reason = '') {
  const { id, level } = state.dungeon;
  if (id === 'record') {
    const dealt = Math.max(0, Math.round((state.front?.max || 0) - Math.max(0, state.enemyHp)));
    const best = Math.max(state.record?.best || 0, dealt);
    const reach = recordTier(dealt);
    state.record = { best, tier: recordTier(best).tier };
    useRecordKey(state);
    const reward = grantDungeon(state, 'record', reach.tier);
    const text = reach.tier ? rewardLine(reward) : '보상 구간에 못 미쳤어요';
    state.dungeonResult = { id, level: reach.tier, win: true, record: dealt, best, next: reach.next, newBest: dealt >= best && dealt > 0, text, serial: (state.dungeonResult?.serial || 0) + 1 };
    record(state, `${RECORD.name} · 피해 ${fmt(dealt)} (최고 ${fmt(best)}) · ${text}`);
    finishRound(state, 'win', state.map, state.wave, 1.5, emit, null, state.farm);
    state.roundEnd.leaveDungeon = true;
    return;
  }
  let text = '열쇠는 그대로예요.';
  if (id === 'trial') {
    text = '레벨을 더 올리고 다시 도전해요.';
    if (win) {
      state.tier = Math.max(state.tier, level);
      text = `${tierName(state.tier)} 승급! 파워·체력 ×${TIER_MULT}`;
    }
  } else if (win) {
    state.stats.dungeons++;
    state.daily.keys[id]--;
    state.daily.dungeons = (state.daily.dungeons || 0) + 1;
    state.dungeons[id] = Math.max(state.dungeons[id] || 0, level);
    text = rewardLine(grantDungeon(state, id, level));
  }
  const chaining = id !== 'trial' && (state.dungeonChain?.id === id || (win && state.dungeonAuto?.[id]));
  let chain = null;
  if (chaining) {
    const before = state.dungeonChain?.id === id ? state.dungeonChain : { id, from: level, to: level - 1, wins: 0, coins: 0, tickets: 0, badges: 0 };
    const reward = win ? dungeonReward(state, id, level) : {};
    chain = { ...before, to: win ? level : before.to, wins: before.wins + (win ? 1 : 0), coins: before.coins + (reward.coins || 0), tickets: before.tickets + (reward.tickets || 0), badges: before.badges + (reward.badges || 0) };
  }
  const more = Boolean(chain) && win && state.dungeonAuto?.[id] && dungeonKeys(state, id) > 0;
  state.dungeonChain = more ? chain : null;
  if (!more) {
    const summary = chain && chain.wins > 1 ? { from: chain.from, to: chain.to, wins: chain.wins, text: rewardLine(chain) || '보상 없음' } : null;
    state.dungeonResult = { id, level, win, reason, text, chain: summary, serial: (state.dungeonResult?.serial || 0) + 1 };
  }
  record(state, `${dungeonInfo(id).name} ${id === 'trial' ? '' : `Lv.${level} `}${win ? '통과!' : reason === 'timeout' ? '시간 초과' : '실패'} · ${text}`);
  finishRound(state, win ? 'win' : 'loss', state.map, state.wave, more ? 0.9 : 1.5, emit, null, state.farm);
  state.roundEnd.leaveDungeon = true;
  if (more) state.roundEnd.chain = id;
}
function mobReward(state, mob, emit) {
  const coins = Math.round(winCoins(state, false) * mob.share);
  state.coins += coins;
  state.xp += Math.round(winXp(state) * mob.share);
  levelUps(state);
  emit?.('kill', { coins, name: mob.name });
}
function levelUps(state) {
  while (state.xp >= xpTarget(state)) {
    state.xp -= xpTarget(state);
    state.level++;
    record(state, `레벨 ${state.level} 달성!`);
  }
}
function nextMob(state, emit) {
  if (!state.dungeon) mobReward(state, state.front, emit);
  else emit?.('kill', { coins: 0, name: state.front.name });
  const index = state.pack.findIndex(mob => mob.hp > 0);
  const next = state.pack.splice(0, index + 1).pop();
  const { hp, ...front } = next;
  state.front = front;
  state.enemyHp = hp;
  state.enemyMove = null;
  state.nextEnemy = front.leader ? 0.75 : 0.55;
  state.pause = front.leader ? 0.3 : 0.12;
}
function killProgress(state) {
  const total = (BOSS_WAVE) * PACK.length;
  if (state.dungeon) return { done: 0, total };
  if (state.wave >= BOSS_WAVE) return { done: total, total };
  const left = aliveBehind(state) + (state.enemyHp > 0 ? 1 : 0);
  return { done: state.wave * PACK.length + PACK.length - left, total };
}
function bossTimeout(state, emit) {
  record(state, `${currentEnemy(state)} 보스전 시간 초과! 같은 맵에서 반복 수련해요.`);
  finishRound(state, 'loss', state.map, 0, 1.65, emit, null, { cap: Math.min(1, Math.max(0, state.wave - 1)), easy: 0, wins: 0 });
  state.roundEnd.timeout = true;
}
function nextMission(state, id) {
  const tier = state.missions[id] + 1;
  return { target: MISSIONS[id].step * tier, coins: 20 + 10 * tier, patches: 1 + Math.floor(tier / 4) };
}
function upgradeCost(state, id) { return 1 + (state.ranks[id] || 0); }
function interval(state) { return (0.98 - state.training.speed * 0.04) * (state.classId === 'gym' ? 0.82 : 1); }
function trainingCost(state, id) { return trainingCostAt(id, state.training[id]); }
function gradeIndex(map) { return Math.floor(map / MAPS_PER_GRADE); }
function mapCode(map) { return `${gradeIndex(map) + 1}-${map % MAPS_PER_GRADE + 1}`; }
function isGradeFinal(map) { return (map + 1) % MAPS_PER_GRADE === 0; }
function firstGradeWon(state) { return state.cleared[MAPS_PER_GRADE - 1]; }
function unlocked(state, map) { return map === 0 || state.cleared[map - 1]; }
function currentEnemy(state) { return state.front?.name ?? stageNames(state.cycle || 0, state.map)[state.wave]; }
function isDaon(state) { return !state.dungeon && state.map === DAON_MAP && state.wave === BOSS_WAVE; }
function guarding(state) { return isDaon(state) && ['guard', 'counter'].includes(state.bossPhase); }
function opening(state) { return isDaon(state) && ['open', 'broken'].includes(state.bossPhase); }
function canSkill(state) { return !state.roundEnd && state.pause <= 0 && !state.playerMove && state.charge >= SKILLS[state.skillId].cost; }

function makeProfile(name, gender) {
  if (typeof name !== 'string' || !['boy', 'girl'].includes(gender)) return null;
  const nickname = name.trim();
  if (!nickname || nickname.length > 12 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(nickname)) return null;
  return { name: nickname, gender };
}

function record(state, message) {
  state.log.unshift(message);
  state.log.length = Math.min(3, state.log.length);
}

function openFight(state, map, wave, delay) {
  state.map = map;
  state.wave = wave;
  const mobs = makeMobs(state);
  state.front = mobs[0];
  state.pack = mobs.slice(1).map(mob => ({ ...mob, hp: mob.max }));
  state.enemyHp = state.front.max;
  state.bossTime = BOSS_TIME;
  state.nextAttack = 0.55;
  state.nextEnemy = isDaon(state) ? 0.85 : 1.35;
  state.pause = delay;
  state.playerMove = null;
  state.enemyMove = null;
  state.roundEnd = null;
  state.bossPhase = 'ready';
  state.bossTimer = BOSS_PHASES.ready.duration;
}

function finishRound(state, result, nextMap, nextWave, wait, emit, reward = null, nextFarm = state.farm) {
  if (result === 'loss' && state.rush && !state.dungeon) {
    state.rush = null;
    record(state, '빠른 복귀 중에 졌어요. 여기부터는 보통 속도예요.');
  }
  state.playerMove = null;
  state.enemyMove = null;
  state.roundEnd = { result, nextMap, nextWave, wait, nextFarm };
  emit?.('finish', { result, wait, reward, boss: state.wave === BOSS_WAVE });
}

function win(state, emit) {
  if (state.dungeon) {
    leaveDungeon(state, true, emit);
    return;
  }
  const map = state.map;
  const grade = gradeIndex(map);
  const boss = state.wave === BOSS_WAVE;
  const firstBoss = boss && !state.cleared[map];
  const share = state.front?.share ?? 1;
  const coins = Math.round(winCoins(state, firstBoss) * share);
  state.wins++;
  state.mapWins[map]++;
  state.coins += coins;
  state.xp += Math.round(winXp(state) * share);
  emit?.('kill', { coins, name: currentEnemy(state) });
  record(state, `${boss ? currentEnemy(state) : `${currentEnemy(state)} 팀`}에게 승리 · 코인 +${fmt(coins)}`);
  if (boss) dropShard(state, isGradeFinal(map), emit);
  if (firstBoss) {
    state.totalClears = (state.totalClears || 0) + 1;
    if (progress(state) + 1 > (state.prestige?.best || 0)) {
      const tickets = isGradeFinal(map) ? 5 : 2;
      state.tickets += tickets;
      if (isGradeFinal(map)) state.gems = (state.gems || 0) + 20;
      record(state, `최고 기록 보스 승리 · 뽑기권 +${tickets}`);
    }
  }

  let reward = null;
  const bossGear = firstBoss && isGradeFinal(map) ? BOSS_REWARDS[grade] : null;
  const mapGear = state.mapWins[map] % DROP_WINS === 0 ? MAP_REWARDS[map] : null;
  for (const id of [state.wins === 2 ? 'wristband' : null, bossGear, mapGear]) {
    if (!id) continue;
    if (state.bag.includes(id)) {
      state.patches++;
      record(state, '중복 장비 분해 · 강화 천 조각 +1');
    } else {
      state.bag.push(id);
      reward = id;
      record(state, `장비 획득 · ${GEAR[id].name}`);
    }
  }
  while (state.xp >= xpTarget(state)) {
    state.xp -= xpTarget(state);
    state.level++;
    state.hp = maxHp(state);
    record(state, `레벨 ${state.level} 달성!`);
  }

  if (state.farm) {
    const { wins, cap } = state.farm;
    const retry = wins + 1 >= FARM_WINS;
    const nextFarm = retry ? null : { ...state.farm, wins: wins + 1 };
    const nextWave = retry ? 0 : (state.wave + 1) % (cap + 1);
    state.hp = maxHp(state);
    if (retry) record(state, '같은 맵에서 수련 3승. 다시 도전해요!');
    finishRound(state, 'win', map, nextWave, 0.83, emit, reward, nextFarm);
    return;
  }

  if (firstBoss && map === MAPS.length - 1) {
    state.cycle = (state.cycle || 0) + 1;
    state.cleared = MAPS.map(() => false);
    state.hp = maxHp(state);
    const done = state.cycle - 1;
    record(state, !done ? `아카데미 졸업! 이제 ${schoolName(1)}부터 지역을 제패하러 가요.`
      : lastRound(done) ? `${schoolName(done)} 제패! 다음 목표는 ${schoolName(state.cycle)}.`
      : `${schoolName(done)} ${roundTag(done)} 바퀴 완료! 다음 바퀴는 상대가 더 강해져요.`);
    finishRound(state, 'win', 0, 0, 1.6, emit, reward);
    return;
  }
  if (firstBoss) {
    state.cleared[map] = true;
    record(state, `${mapCode(map + 1)} ${stagePlace(state.cycle || 0, map + 1)} 해금!`);
  }
  if (boss) {
    const next = state.autoNext && map < MAPS.length - 1 ? map + 1 : map;
    state.hp = maxHp(state);
    finishRound(state, 'win', next, 0, 1.3, emit, reward);
    return;
  }
  state.hp = Math.min(maxHp(state), state.hp + Math.ceil(maxHp(state) * 0.16));
  finishRound(state, 'win', map, state.wave + 1, 0.83, emit, reward);
}

function changeBossPhase(state, phase, emit) {
  state.bossPhase = phase;
  state.bossTimer = BOSS_PHASES[phase].duration;
  state.enemyMove = null;
  if (phase === 'ready') state.nextEnemy = 0.7;
  emit?.('boss', { phase });
}

function strike(state, move, emit) {
  const blocked = guarding(state) && move !== 'bell';
  const breaks = guarding(state) && move === 'bell';
  let multiplier = SKILLS[move]?.multiplier ?? (move === 'crit' ? 1.55 : 1);
  if (blocked) multiplier *= 0.23;
  if (opening(state)) multiplier *= move === 'rush' ? 1.7 : 1.35;
  const chance = move === 'attack' && !blocked ? critChance(state) : 0;
  const lucky = chance > 0 && Math.random() < chance;
  if (lucky) multiplier *= critPower(state);
  const damage = Math.round(attack(state) * multiplier * buffMult(state));
  const amount = Math.min(state.enemyHp, Math.max(1, damage));
  let overflow = Math.max(0, damage - state.enemyHp);
  state.enemyHp -= amount;
  if (breaks) {
    changeBossPhase(state, 'broken', emit);
    record(state, '공 울림 카운터로 다온의 방어를 풀었어요!');
  }
  emit?.('impact', { side: 'player', move, amount, blocked, breaks, lucky });
  // 필살기는 뒤에 선 상대까지 맞힌다
  if (SKILLS[move]) sweepPack(state, Math.max(1, Math.round(damage * SPLASH)), emit);
  if (!SKILLS[move]) state.charge = Math.min(100, state.charge + (state.classId === 'music' ? 27 : 18));
  // 넘친 피해는 다음 상대에게 이어진다(관통). 약한 친구 여럿을 한 번에 쓰러뜨릴 수 있다.
  resolveKills(state, overflow, emit);
}

function rivalStrike(state, move, emit) {
  const multiplier = move === 'counter' ? 2.65 : 1;
  const easier = state.dungeon ? 1 : 0.64 ** (state.farm?.easy || 0);
  const hit = enemyHit(state);
  if (Math.random() < mateBuff(state, 'dodge')) {
    emit?.('impact', { side: 'rival', move, amount: 0, dodged: true });
    return;
  }
  let amount = Math.max(1, Math.round(hit * multiplier * easier));
  const reflect = Math.round(amount * mateBuff(state, 'reflect'));
  const blocked = Math.min(state.shield || 0, amount);
  if (blocked) { state.shield -= blocked; amount -= blocked; }
  amount = Math.min(state.hp, amount);
  state.hp -= amount;
  emit?.('impact', { side: 'rival', move, amount, shielded: blocked });
  if (reflect > 0 && state.hp > 0 && state.enemyHp > 0) {
    state.enemyHp = Math.max(0, state.enemyHp - reflect);
    emit?.('mate', { slot: -1, id: null, amount: reflect, heal: 0, reflect: true });
    if (state.enemyHp <= 0) { resolveKills(state, 0, emit); return; }
  }
  if (state.hp <= 0 && state.dungeon) {
    leaveDungeon(state, false, emit);
    return;
  }
  if (state.hp <= 0) {
    const farm = state.farm ? { ...state.farm, easy: Math.min(5, state.farm.easy + 1) }
      : { cap: Math.min(1, Math.max(0, state.wave - 1)), easy: state.wave === 0 ? 1 : 0, wins: 0 };
    record(state, `${currentEnemy(state)}에게 졌어요. 같은 맵에서 반복 수련을 시작해요.`);
    finishRound(state, 'loss', state.map, 0, 1.65, emit, null, farm);
  }
}

function queuePlayer(state, move, emit) {
  const skill = SKILLS[move];
  const windup = skill?.windup ?? 0.2;
  if (skill) state.charge -= skill.cost;
  state.nextAttack = interval(state) / (state.buffs?.sprint > 0 ? sprintMult(state) : 1) / (1 + mateBuff(state, 'speed'));
  state.playerMove = { move, left: windup };
  emit?.('windup', { side: 'player', move, windup });
}

function activateSkill(state, emit) {
  if (!canSkill(state)) return false;
  queuePlayer(state, state.skillId, emit);
  return true;
}

function autoSkillTarget(state) {
  if (!isDaon(state)) return true;
  if (state.skillId === 'rush') return opening(state) && state.bossTimer >= SKILLS.rush.windup;
  if (!guarding(state)) return false;
  return state.bossPhase === 'guard' || state.bossTimer > SKILLS.bell.windup + STEP;
}

function step(state, emit) {
  if (state.cooldowns) {
    for (const id of Object.keys(state.cooldowns)) if (state.cooldowns[id] > 0) state.cooldowns[id] = Math.max(0, state.cooldowns[id] - STEP);
    for (const id of Object.keys(state.buffs)) if (state.buffs[id] > 0) state.buffs[id] = Math.max(0, state.buffs[id] - STEP);
    for (const buff of Object.values(state.mateBuffs || {})) if (buff.t > 0) buff.t = Math.max(0, buff.t - STEP);
  }
  if (state.snacks) {
    const used = STEP / (state.speed || 1);
    for (const id of Object.keys(SNACKS)) if (state.snacks[id] > 0) state.snacks[id] = Math.max(0, state.snacks[id] - used);
  }
  if (state.roundEnd) {
    const end = state.roundEnd;
    end.wait -= STEP;
    if (end.wait <= 1e-8) {
      if (end.result === 'loss' || end.leaveDungeon) state.hp = maxHp(state);
      if (end.leaveDungeon) state.dungeon = null;
      if (end.chain) {
        state.roundEnd = null;
        state.farm = end.nextFarm;
        state.map = end.nextMap;
        state.wave = end.nextWave;
        if (enterDungeon(state, end.chain)) {
          emit?.('enter', {});
          return;
        }
        state.dungeonChain = null;
      }
      state.farm = end.nextFarm;
      openFight(state, end.nextMap, end.nextWave, 0.19);
      emit?.('enter', {});
    }
    return;
  }
  if (state.pause > 0) {
    state.pause = Math.max(0, state.pause - STEP);
    return;
  }
  const regen = regenRate(state);
  if (regen > 0 && state.hp > 0) state.hp = Math.min(maxHp(state), state.hp + maxHp(state) * regen * STEP);
  if (state.dungeon) {
    state.dungeon.time -= STEP;
    if (state.dungeon.time <= 0) {
      leaveDungeon(state, false, emit, 'timeout');
      return;
    }
  } else if (!state.farm && state.wave === BOSS_WAVE) {
    state.bossTime = (Number.isFinite(state.bossTime) ? state.bossTime : BOSS_TIME) - STEP;
    if (state.bossTime <= 0) {
      bossTimeout(state, emit);
      return;
    }
  }
  state.nextAttack -= STEP;
  if (state.playerMove) {
    state.playerMove.left -= STEP;
    if (state.playerMove.left <= 1e-8) {
      const { move } = state.playerMove;
      state.playerMove = null;
      strike(state, move, emit);
      if (state.roundEnd) return;
    }
  }

  // 동료가 각자 박자에 맞춰 공격한다
  if (state.party) {
    for (let slot = 0; slot < partySlots(state); slot++) {
      if (!state.party[slot]) continue;
      state.allyTimers[slot] = (state.allyTimers[slot] ?? ALLY_INTERVAL) - STEP;
      if (state.allyTimers[slot] > 0) continue;
      state.allyTimers[slot] = ALLY_INTERVAL;
      allyStrike(state, slot, emit);
      if (state.roundEnd || state.pause > 0) return;
    }
    tickBleed(state, emit);
    if (state.roundEnd || state.pause > 0) return;
    for (let slot = 0; slot < partySlots(state); slot++) {
      if (state.autoMates === false || !state.party[slot] || (state.cooldowns[`mate${slot}`] || 0) > 0) continue;
      if (castMate(state, slot, emit) && (state.roundEnd || state.pause > 0)) return;
    }
    autoCast(state, emit);
    if (state.roundEnd || state.pause > 0) return;
  }

  const daon = isDaon(state);
  if (daon) {
    state.bossTimer -= STEP;
    if (state.bossTimer <= 1e-8) {
      const phase = state.bossPhase;
      if (phase === 'counter') {
        rivalStrike(state, 'counter', emit);
        if (state.roundEnd) return;
      }
      changeBossPhase(state, BOSS_PHASES[phase].next, emit);
    }
  }

  if (!daon || state.bossPhase === 'ready') {
    state.nextEnemy -= STEP;
    if (state.enemyMove) {
      state.enemyMove.left -= STEP;
      if (state.enemyMove.left <= 1e-8) {
        state.enemyMove = null;
        rivalStrike(state, 'attack', emit);
        if (state.roundEnd) return;
      }
    } else if (state.nextEnemy <= 0) {
      state.nextEnemy = 1.65 - gradeIndex(state.map) * 0.06;
      state.enemyMove = { move: 'attack', left: 0.25 };
      emit?.('windup', { side: 'rival', move: 'attack', windup: 0.25 });
    }
  }

  if (state.nextAttack <= 0 && !state.playerMove) {
    if (state.autoSkill && autoSkillTarget(state) && activateSkill(state, emit)) return;
    queuePlayer(state, state.charge === 72 ? 'crit' : 'attack', emit);
  }
}

// ── 재입학 빠른 복귀: 재입학 전 최고 기록의 한 지역 앞까지는 이미 지나온 곳이라 RUSH_SPEED배로 달린다 ──
// 진 순간이나 종료 지점에 닿으면 보통 속도. 이긴 맵은 정상 진행이고 첫 제패 보상은 원래대로 최고 기록 기준. 오프라인에서도 같다
const RUSH_SPEED = 3;
function rushEnd(best) {
  const cycle = Math.floor(best / MAPS.length);
  if (cycle < 2) return 0;
  const index = Math.min(regionIndex(cycle), REGIONS.length - 1);
  return REGION_START[Math.max(0, index - 1)] * MAPS.length;
}
function rushing(state) { return Boolean(state.rush) && !state.dungeon && progress(state) < state.rush.until; }
function simulate(state, seconds, emit) {
  const elapsed = seconds + state.tickRemainder;
  const ticks = Math.floor((elapsed + 1e-8) / STEP);
  state.tickRemainder = Math.max(0, elapsed - ticks * STEP);
  for (let index = 0; index < ticks; index++) {
    const times = rushing(state) ? RUSH_SPEED : 1;
    for (let repeat = 0; repeat < times; repeat++) step(state, emit);
    if (state.rush && !state.dungeon && progress(state) >= state.rush.until) {
      state.rush = null;
      record(state, '빠른 복귀 끝! 여기부터는 보통 속도로 겨뤄요.');
    }
  }
}

// ── 승급 ──
function tierName(tier) { return tier < TIERS.length ? TIERS[tier] : `${TIERS[TIERS.length - 1]} ${tier - TIERS.length + 2}성`; }
function tierReq(tier) { return tier <= 6 ? Math.round(8 * 1.7 ** (tier - 1)) : 114 + 40 * (tier - 6); }
function tierLevel(tier) { return 10 * tier; }
function bestProgress(state) { return Math.max(state.prestige.best, progress(state)); }
function tierReady(state) {
  const next = state.tier + 1;
  return bestProgress(state) >= tierReq(next) && state.level >= tierLevel(next);
}
function enterTrial(state) {
  if (!tierReady(state) || state.dungeon || state.roundEnd?.leaveDungeon) return false;
  if (state.roundEnd) {
    const end = state.roundEnd;
    state.farm = end.nextFarm;
    state.map = end.nextMap;
    state.wave = end.nextWave;
    state.roundEnd = null;
  }
  state.dungeon = { id: 'trial', level: state.tier + 1, time: DUNGEON_TIME };
  state.hp = maxHp(state);
  openFight(state, state.map, state.wave, 0.6);
  return true;
}

// ── 동료 ──
// state.companions[id] = 별 수(0이면 미보유). state.mateShards[id] = 그 동료 조각
function mateGrade(id) { return GRADES[COMPANIONS[id].grade]; }
function companionLevel(state, id) { return Math.min(mateGrade(id).maxStar, state.companions?.[id] || 0); }
function companionOwned(state) {
  return Object.keys(COMPANIONS).reduce((sum, id) => sum + mateGrade(id).owned * companionLevel(state, id), 0);
}
function mateShards(state, id) { return state.mateShards?.[id] || 0; }
function addShards(state, id, amount) { state.mateShards = { ...state.mateShards, [id]: mateShards(state, id) + amount }; }
// 다음 별에 드는 조각. 미보유면 영입 조각(unlock), 최대 별이면 0
function starCost(state, id) {
  const star = companionLevel(state, id);
  const grade = mateGrade(id);
  if (!star) return grade.unlock;
  return star < grade.maxStar ? grade.starCost[star - 1] : 0;
}
function starUp(state, id) {
  const cost = starCost(state, id);
  if (!cost || mateShards(state, id) < cost) return false;
  addShards(state, id, -cost);
  state.companions[id] = companionLevel(state, id) + 1;
  return true;
}
// 보스 승리 때 조각: 출전 중이고 별이 남은 동료 우선, 없으면 성급업이 남은 보유 동료
function dropShard(state, final, emit, rng = Math.random) {
  if (!final && rng() >= SHARD_DROP.chance) return null;
  const open = state.party.slice(0, partySlots(state)).filter(id => id && starCost(state, id));
  const pool = open.length ? open : Object.keys(state.companions).filter(id => companionLevel(state, id) && starCost(state, id));
  if (!pool.length) return null;
  const id = pool[Math.floor(rng() * pool.length)];
  const amount = final ? SHARD_DROP.final : SHARD_DROP.normal;
  addShards(state, id, amount);
  record(state, `${COMPANIONS[id].name} 조각 +${amount}`);
  emit?.('shard', { id, amount });
  return { id, amount };
}
function partySlots(state) {
  if (state.test?.slots) return PARTY_MAX;
  const best = bestProgress(state);
  return Math.min(PARTY_MAX, 1 + PARTY_UNLOCKS.filter(cycle => best >= cycle * MAPS.length).length);
}
function allyPower(state, id) { return mateGrade(id).power * (1 + STAR_STEP * (companionLevel(state, id) - 1)) * (1 + ALLY_TRAIN.step * allyTrainLevel(state, id)); }
// 동료 레벨업(코인): 레벨마다 +5%, 최대 레벨은 별(겹친 수)마다 20씩 늘어난다. 동료 공격은 내 파워에 비례하므로 무한히 곱하지 않는다
function allyTrainLevel(state, id) { return state.allyLv?.[id] || 0; }
function allyTrainCap(state, id) { return companionLevel(state, id) ? ALLY_TRAIN.capBase + ALLY_TRAIN.capPerStar * companionLevel(state, id) : 0; }
function allyTrainCost(state, id) { return Math.ceil(ALLY_TRAIN.base * mateGrade(id).trainCost * ALLY_TRAIN.scale ** allyTrainLevel(state, id)); }
function trainAlly(state, id) {
  if (!state.companions[id] || allyTrainLevel(state, id) >= allyTrainCap(state, id)) return false;
  const cost = allyTrainCost(state, id);
  if (state.coins < cost) return false;
  state.coins -= cost;
  state.allyLv = { ...state.allyLv, [id]: allyTrainLevel(state, id) + 1 };
  return true;
}
function allyDamage(state, id) { return attack(state) * allyPower(state, id); }
function rollGrade(rng) {
  let roll = rng() * GRADE_ORDER.reduce((sum, grade) => sum + GRADES[grade].weight, 0);
  for (const grade of GRADE_ORDER) {
    roll -= GRADES[grade].weight;
    if (roll < 0) return grade;
  }
  return GRADE_ORDER.at(-1);
}
// 결과: { id, grade(뽑힌 등급), isNew, shards(조각), gems(보석), fill(빈 등급이라 S 조각으로 대신) }. 10회 모집은 A급 이상 1번 보장
function recruit(state, count, rng = Math.random) {
  const results = [];
  const rank = grade => GRADE_ORDER.indexOf(grade);
  const pools = Object.fromEntries(GRADE_ORDER.map(grade => [grade, Object.keys(COMPANIONS).filter(id => COMPANIONS[id].grade === grade)]));
  for (let index = 0; index < count; index++) {
    let grade = rollGrade(rng);
    if (!state.stats.recruits && !index && !Object.keys(state.companions).length) grade = 'S';
    if (count >= 10 && index === count - 1 && rank(grade) > rank('A') && !results.some(result => rank(result.grade) <= rank('A'))) grade = 'A';
    const pool = pools[grade];
    if (!pool.length) {
      const id = pools.S[Math.floor(rng() * pools.S.length)];
      addShards(state, id, GRADES[grade].fill);
      results.push({ id, grade, shards: GRADES[grade].fill, fill: true });
      continue;
    }
    const id = pool[Math.floor(rng() * pool.length)];
    if (!companionLevel(state, id)) {
      state.companions[id] = 1;
      results.push({ id, grade, isNew: true });
    } else if (GRADES[grade].maxStar > 1) {
      addShards(state, id, GRADES[grade].dupShards);
      results.push({ id, grade, shards: GRADES[grade].dupShards });
    } else {
      state.gems = (state.gems || 0) + GRADES[grade].dupGems;
      results.push({ id, grade, gems: GRADES[grade].dupGems });
    }
  }
  state.stats.recruits += count;
  if (!state.party.some(Boolean)) {
    const best = Object.keys(state.companions).sort((a, b) => allyPower(state, b) - allyPower(state, a))[0];
    if (best) state.party[0] = best;
  }
  return results;
}
function setParty(state, slot, id) {
  if (slot < 0 || slot >= partySlots(state)) return false;
  if (id && !companionLevel(state, id)) return false;
  state.party = state.party.map(other => (other === id ? null : other));
  state.party[slot] = id;
  return true;
}
// ── 경기 규칙: 지역 구역마다 규칙 하나(지역·바퀴·구역에 따라 돌아감). 추천 동료가 출전하면 한 명당 팀 피해 +10%(최대 3명) ──
const RULES = {
  crowd: { name: '난전', desc: '졸개 체력 +25%', tip: '여럿을 한꺼번에 치는 광역 스킬', minion: 1.25, fit: skill => skill.kind === 'aoe' },
  boss: { name: '강적전', desc: '대장·보스 체력 +25%', tip: '대장·보스 추가 피해·방어 무시·체력 비례 피해', leader: 1.25, fit: skill => Boolean(skill.boss || skill.pierce || skill.hpPct) },
  heavy: { name: '난타전', desc: '상대 공격 +25%', tip: '보호막·회복·약화·회피·반사', hit: 1.25, fit: skill => Boolean(skill.shield || skill.heal || skill.weaken || skill.dodge || skill.reflect) },
};
const RULE_ORDER = ['crowd', 'boss', 'heavy'];
const RULE_BONUS = 0.1;
function ruleId(state, cycle = state.cycle || 0, map = state.map) {
  if (state.dungeon || !cycle) return null;
  const index = Math.min(regionIndex(cycle), REGIONS.length);
  return RULE_ORDER[(index + regionRound(cycle) + gradeIndex(map)) % RULE_ORDER.length];
}
function ruleFit(id, rule) { return Boolean(rule) && RULES[rule].fit(COMPANIONS[id].skill); }
function ruleMates(state, rule = ruleId(state)) { return rule ? Object.keys(COMPANIONS).filter(id => ruleFit(id, rule)) : []; }
function ruleBonus(state) {
  const rule = ruleId(state);
  if (!rule) return 0;
  return Math.min(3, state.party.slice(0, partySlots(state)).filter(id => id && ruleFit(id, rule)).length) * RULE_BONUS;
}
function ruleHp(state, leader) { const rule = ruleId(state); return rule ? (leader ? RULES[rule].leader : RULES[rule].minion) || 1 : 1; }
function buffMult(state) { return (state.buffs?.cheer > 0 ? cheerMult(state) : 1) * (1 + mateBuff(state, 'power')) * (1 + ruleBonus(state)) * (1 + teamSynergy(state).power); }

// ── 팀 시너지: 출전 칸에 있는 동료의 무술 계열 조합 ──
// 같은 계열 2·3·4명이면 그 계열 효과(steps[명수]), 서로 다른 계열이 3개 이상이면 '균형'(크리티컬 확률). 두 가지는 함께 붙는다.
// power = 팀 피해(나·동료 모두), weaken = 받는 피해 감소, cdr = 동료 스킬 쿨타임 감소(비율), coin = 승리 코인
const MATE_FAMILIES = {
  strike: { name: '타격', mates: ['mate1', 'mate2', 'mate3', 'mate4', 'mate5'], stat: 'power', steps: [0, 0, 0.06, 0.12, 0.2], text: '팀 피해 +' },
  grapple: { name: '잡기', mates: ['mate6', 'mate7', 'mate8', 'mate9'], stat: 'weaken', steps: [0, 0, 0.06, 0.12, 0.18], text: '받는 피해 −' },
  special: { name: '기공', mates: ['mate10', 'mate11', 'mate12', 'mate13', 'mate14'], stat: 'cdr', steps: [0, 0, 0.08, 0.15, 0.22], text: '동료 쿨타임 −' },
  farm: { name: '파밍', mates: ['mate15', 'mate16'], stat: 'coin', steps: [0, 0, 0.2], text: '코인 +' },
};
const FAMILY_ORDER = Object.keys(MATE_FAMILIES);
const BALANCE_SYNERGY = { 3: 0.04, 4: 0.07 }; // 서로 다른 계열 수 → 크리티컬 확률
function mateFamily(id) { return FAMILY_ORDER.find(family => MATE_FAMILIES[family].mates.includes(id)) || null; }
let synergyMemo = { key: '', value: null };
function teamSynergy(state) {
  const ids = (state.party || []).slice(0, partySlots(state)).filter(Boolean);
  const key = ids.join(',');
  if (synergyMemo.key === key && synergyMemo.value) return synergyMemo.value;
  const counts = {};
  for (const id of ids) {
    const family = mateFamily(id);
    if (family) counts[family] = (counts[family] || 0) + 1;
  }
  const value = { power: 0, weaken: 0, cdr: 0, coin: 0, crit: 0, counts, active: [] };
  for (const family of FAMILY_ORDER) {
    const info = MATE_FAMILIES[family];
    const count = counts[family] || 0;
    const amount = info.steps[Math.min(count, info.steps.length - 1)] || 0;
    if (!amount) continue;
    value[info.stat] += amount;
    value.active.push({ family, count, amount, text: `${info.name} ${count}명 · ${info.text}${Math.round(amount * 100)}%` });
  }
  const kinds = Object.keys(counts).length;
  if (BALANCE_SYNERGY[Math.min(kinds, 4)]) {
    value.crit = BALANCE_SYNERGY[Math.min(kinds, 4)];
    value.active.push({ family: 'balance', count: kinds, amount: value.crit, text: `균형 ${kinds}계열 · 크리티컬 +${Math.round(value.crit * 100)}%` });
  }
  synergyMemo = { key, value };
  return value;
}
// 다음 단계 안내: 이 계열을 한 명 더 넣으면 어떻게 되는지
function synergyNext(family, count) {
  const info = MATE_FAMILIES[family];
  const now = info.steps[Math.min(count, info.steps.length - 1)] || 0;
  const more = info.steps.findIndex((amount, need) => need > count && amount > now);
  return more > 0 ? `${more}명이면 ${info.text}${Math.round(info.steps[more] * 100)}%` : '최대';
}

// 앞 상대가 쓰러지면 다음 상대로, 넘친 피해는 이어서(관통). 무리가 다 쓰러지면 승리.
function resolveKills(state, overflow, emit) {
  while (state.enemyHp <= 0) {
    if (!aliveBehind(state)) {
      win(state, emit);
      return;
    }
    nextMob(state, emit);
    if (overflow <= 0) return;
    const pierce = Math.min(state.enemyHp, overflow);
    state.enemyHp -= pierce;
    overflow -= pierce;
    emit?.('pierce', { amount: pierce });
  }
}
function sweepPack(state, amount, emit) {
  if (!state.pack?.length) return;
  for (const mob of state.pack) if (mob.hp > 0) mob.hp = Math.max(0, mob.hp - amount);
  emit?.('splash', { amount });
  state.pack = state.pack.filter(mob => {
    if (mob.hp > 0) return true;
    if (!state.dungeon) mobReward(state, mob, emit);
    return false;
  });
}
function allyStrike(state, slot, emit) {
  const id = state.party[slot];
  let damage = Math.round(allyDamage(state, id) * buffMult(state));
  if (guarding(state)) damage = Math.round(damage * 0.23);
  damage = Math.max(1, damage);
  const amount = Math.min(state.enemyHp, damage);
  const overflow = Math.max(0, damage - state.enemyHp);
  state.enemyHp -= amount;
  emit?.('ally', { slot, id, amount });
  resolveKills(state, overflow, emit);
}

// ── 동료 스킬: 출전한 동료가 각자 쿨타임마다 자동으로 쓴다(state.autoMates를 끄면 출전 카드를 눌러 직접) ──
function mateScale(state, id) { return (1 + STAR_STEP * (companionLevel(state, id) - 1)) * (1 + ALLY_TRAIN.step * allyTrainLevel(state, id)); }
// 직접 쓰기: 자동과 같은 쿨타임. 대결 중일 때만(다음 상대가 들어오는 중이거나 판이 끝났으면 안 됨)
function useMate(state, slot, emit) {
  if (slot < 0 || slot >= partySlots(state) || !state.party[slot] || (state.cooldowns[`mate${slot}`] || 0) > 0 || state.roundEnd || state.pause > 0 || state.enemyHp <= 0) return false;
  return castMate(state, slot, emit);
}
// 출전 자리 바꾸기: 동료와 함께 스킬 쿨타임·공격 박자도 옮긴다(자리를 바꿔 쿨타임을 지우지 못하게)
function swapParty(state, a, b) {
  const open = partySlots(state);
  if (a === b || a < 0 || b < 0 || a >= open || b >= open || (!state.party[a] && !state.party[b])) return false;
  [state.party[a], state.party[b]] = [state.party[b], state.party[a]];
  const left = state.cooldowns[`mate${a}`] || 0;
  state.cooldowns[`mate${a}`] = state.cooldowns[`mate${b}`] || 0;
  state.cooldowns[`mate${b}`] = left;
  [state.allyTimers[a], state.allyTimers[b]] = [state.allyTimers[b] ?? ALLY_INTERVAL, state.allyTimers[a] ?? ALLY_INTERVAL];
  return true;
}
// 동료 스킬 쿨타임(초): 기공 계열 시너지만큼 짧아진다
function mateCooldown(state, id) { return COMPANIONS[id].skill.cd * (1 - teamSynergy(state).cdr); }
function mateBuff(state, key) { const buff = state.mateBuffs?.[key]; return buff && buff.t > 0 ? buff.v : 0; }
function castMate(state, slot, emit) {
  const id = state.party[slot];
  const skill = COMPANIONS[id].skill;
  if (skill.kind === 'heal' && state.hp > maxHp(state) * 0.75) return false;
  state.cooldowns[`mate${slot}`] = mateCooldown(state, id);
  const event = { slot, id, amount: 0, heal: 0, hits: skill.hits || 1, crit: Boolean(skill.sure) };
  let overflow = 0;
  let damage = 0;
  const power = attack(state);
  const leader = Boolean(state.dungeon) || state.wave === BOSS_WAVE || Boolean(state.front?.leader);
  if (skill.mult || skill.randMax) {
    const mult = skill.randMax ? skill.randMin + Math.random() * (skill.randMax - skill.randMin) : skill.mult;
    damage = power * mult * mateScale(state, id) * buffMult(state) * (skill.boss && leader ? skill.boss : 1);
    if (skill.sure) damage *= critPower(state);
    if (!skill.pierce && guarding(state)) damage *= 0.23;
    if (skill.hpPct) damage += Math.min(state.enemyHp * skill.hpPct, power * 20);
    damage = Math.max(1, Math.round(damage));
    if (skill.execute && !leader && state.enemyHp - damage > 0 && state.enemyHp - damage < enemyMaxHp(state) * skill.execute) damage = state.enemyHp;
    event.amount = Math.min(state.enemyHp, damage);
    overflow = Math.max(0, damage - state.enemyHp);
    state.enemyHp -= event.amount;
  }
  if (skill.stun) state.nextEnemy += skill.stun;
  for (const key of ['crit', 'critDmg', 'power', 'speed', 'dodge', 'weaken', 'reflect', 'coin']) if (skill[key]) state.mateBuffs = { ...state.mateBuffs, [key]: { t: skill.dur, v: skill[key] } };
  if (skill.bleed) state.mateBuffs = { ...state.mateBuffs, bleed: { t: skill.dur, v: power * skill.bleed * mateScale(state, id) / skill.dur } };
  if (skill.heal) {
    event.heal = Math.max(0, Math.min(maxHp(state) - state.hp, Math.round(maxHp(state) * skill.heal)));
    state.hp += event.heal;
  }
  if (skill.shield) state.shield = Math.max(state.shield || 0, Math.round(maxHp(state) * skill.shield));
  if (skill.charge) state.charge = Math.min(100, state.charge + skill.charge);
  if (skill.cdr || skill.reset) {
    state.party.forEach((other, index) => {
      const key = `mate${index}`;
      if (other && index !== slot) state.cooldowns[key] = skill.reset ? 0 : Math.max(0, (state.cooldowns[key] || 0) - skill.cdr);
    });
    if (skill.cdr) for (const active of Object.keys(ACTIVE)) state.cooldowns[active] = Math.max(0, (state.cooldowns[active] || 0) - skill.cdr);
  }
  emit?.('mate', event);
  if (skill.kind === 'aoe') sweepPack(state, damage, emit);
  if (damage) resolveKills(state, overflow, emit);
  return true;
}
// 출혈: 앞 상대의 체력을 조금씩 깎는다
function tickBleed(state, emit) {
  const bleed = state.mateBuffs?.bleed;
  if (!bleed || bleed.t <= 0 || state.enemyHp <= 0) return;
  state.enemyHp = Math.max(0, state.enemyHp - bleed.v * STEP);
  if (state.enemyHp <= 0) resolveKills(state, 0, emit);
}
// 시뮬레이터용: 동료 스킬 피해를 '초당 내 파워의 몇 배'로 어림
function mateSkillDps(state, crowd = false) {
  let total = 0;
  for (let slot = 0; slot < partySlots(state); slot++) {
    const id = state.party[slot];
    const skill = id && COMPANIONS[id].skill;
    if (!skill) continue;
    const mult = skill.randMax ? (skill.randMin + skill.randMax) / 2 : skill.mult || 0;
    const hit = mult * (skill.sure ? critPower(state) : 1) * (skill.kind === 'aoe' && crowd ? 3 : 1) * (skill.boss && !crowd ? skill.boss : 1);
    total += (hit + (skill.bleed || 0)) * mateScale(state, id) / mateCooldown(state, id);
  }
  return total;
}

function skillUnlocked(state, id) { return state.tier >= ACTIVE[id].tier; }
function skillPower(state) { return 2 * (1 + 0.15 * Math.max(0, state.tier - 1)) * (1 + 0.05 * skillLevel(state, 'pencil')); }
// 스킬 레벨업(코인): 딱지 연타 피해 +5%, 응원 함성·체육 대장 배율 +0.01, 급식 충전 회복 +1%p
function skillLevel(state, id) { return state.skillLv?.[id] || 0; }
function skillCost(state, id) { return Math.ceil(ACTIVE[id].lvBase * ACTIVE[id].lvScale ** skillLevel(state, id)); }
function cheerMult(state) { return 1.5 + 0.01 * skillLevel(state, 'cheer'); }
function sprintMult(state) { return 1.5 + 0.01 * skillLevel(state, 'sprint'); }
function lunchHeal(state) { return 0.35 + 0.01 * skillLevel(state, 'lunch'); }
// 자동 훈련: 코인이 모이면 가장 싼 훈련부터 올린다(방치형 '자동 강화')
function autoTrain(state, limit = 200) {
  let bought = 0;
  for (let guard = 0; guard < limit; guard++) {
    let pick = null;
    for (const id of Object.keys(TRAINING)) {
      if (state.training[id] >= TRAINING[id].cap) continue;
      const cost = trainingCost(state, id);
      if (!pick || cost < pick[1]) pick = [id, cost];
    }
    if (!pick || pick[1] > state.coins) break;
    const before = maxHp(state);
    state.coins -= pick[1];
    state.training[pick[0]]++;
    if (pick[0] === 'health' && state.hp > 0) state.hp += maxHp(state) - before;
    bought++;
  }
  return bought;
}
function trainSkill(state, id) {
  if (!skillUnlocked(state, id) || skillLevel(state, id) >= ACTIVE[id].lvCap) return false;
  const cost = skillCost(state, id);
  if (state.coins < cost) return false;
  state.coins -= cost;
  state.skillLv = { ...state.skillLv, [id]: skillLevel(state, id) + 1 };
  return true;
}
function castSkill(state, id, emit) {
  if (!skillUnlocked(state, id) || (state.cooldowns[id] || 0) > 0 || state.roundEnd || state.pause > 0) return false;
  state.cooldowns[id] = ACTIVE[id].cd;
  if (id === 'pencil') {
    const damage = Math.max(1, Math.round(attack(state) * skillPower(state) * buffMult(state) * (guarding(state) ? 0.23 : 1)));
    const amount = Math.min(state.enemyHp, damage);
    const overflow = Math.max(0, damage - state.enemyHp);
    state.enemyHp -= amount;
    emit?.('active', { id, amount });
    sweepPack(state, damage, emit);
    resolveKills(state, overflow, emit);
  } else if (id === 'lunch') {
    const heal = Math.round(maxHp(state) * lunchHeal(state));
    state.hp = Math.min(maxHp(state), state.hp + heal);
    emit?.('active', { id, amount: heal });
  } else {
    state.buffs[id] = ACTIVE[id].dur;
    emit?.('active', { id });
  }
  return true;
}
function autoCast(state, emit) {
  if (!state.autoSkills || state.roundEnd || state.pause > 0) return;
  for (const id of Object.keys(ACTIVE)) {
    if (!skillUnlocked(state, id) || (state.cooldowns[id] || 0) > 0) continue;
    if (id === 'lunch' && state.hp > maxHp(state) * 0.6) continue;
    if (castSkill(state, id, emit)) return;
  }
}

// ── 보상 지급 공통 ──
function grantAny(state, reward) {
  const given = {};
  const add = (key, value) => { if (value) given[key] = (given[key] || 0) + value; };
  if (reward.coins) { state.coins += reward.coins; add('coins', reward.coins); }
  if (reward.coinUnits) { const coins = reward.coinUnits * coinUnit(state); state.coins += coins; add('coins', coins); }
  if (reward.gems) { state.gems += reward.gems; add('gems', reward.gems); }
  if (reward.tickets) { state.tickets += reward.tickets; add('tickets', reward.tickets); }
  if (reward.recruits) { state.recruits += reward.recruits; add('recruits', reward.recruits); }
  if (reward.patches) { state.patches += reward.patches; add('patches', reward.patches); }
  if (reward.badges) { state.prestige.badges += reward.badges; state.prestige.earned += reward.badges; add('badges', reward.badges); }
  if (reward.keys && state.daily?.keys) { for (const id of Object.keys(state.daily.keys)) state.daily.keys[id] += reward.keys; add('keys', reward.keys); }
  if (reward.snacks) { for (const id of Object.keys(SNACKS)) state.snacks[id] = Math.min(snackMax(state), state.snacks[id] + SNACK_TIME); add('snacks', 1); }
  if (reward.premiumPass) state.premium.pass = true;
  if (reward.adFree) state.premium.adFree = true;
  if (reward.monthly) state.premium.monthly += reward.monthly;
  return given;
}
function snackMax(state) { return state.premium?.adFree ? 3 * SNACK_MAX : SNACK_MAX; }
function giftLine(given) {
  const names = { coins: '코인', gems: '보석', tickets: '뽑기권', recruits: '동료 모집권', patches: '천 조각', badges: '명예 배지', keys: '던전 열쇠', snacks: '간식 세트' };
  return Object.entries(given).map(([key, value]) => `${names[key]} +${fmt(value)}`).join(' · ');
}

// ── 우편 ──
function sendMail(state, title, reward, body = '') {
  state.mailSeq = (state.mailSeq || 0) + 1;
  state.mail.unshift({ id: state.mailSeq, title, body, reward, at: Date.now() });
  state.mail.length = Math.min(60, state.mail.length);
}
function welcomeMail(state) {
  sendMail(state, '입학 축하 선물', { gems: 300, recruits: 5 }, '해솔 격투 아카데미 입학을 환영해요! 동료 모집권으로 동기를 불러 보세요.');
}
function claimMail(state, id = null) {
  const picked = state.mail.filter(mail => id === null || mail.id === id);
  const total = {};
  for (const mail of picked) for (const [key, value] of Object.entries(grantAny(state, mail.reward))) total[key] = (total[key] || 0) + value;
  state.mail = state.mail.filter(mail => !picked.includes(mail));
  return total;
}

// ── 상점·캐시 ──
function shopLeft(state, id) {
  const item = SHOP[id];
  if (!item.limit) return Infinity;
  return item.limit - (state.daily?.shop?.[id] || 0);
}
function buyShop(state, id) {
  const item = SHOP[id];
  if (!item || shopLeft(state, id) <= 0 || state.gems < item.price) return null;
  state.gems -= item.price;
  if (item.limit) state.daily.shop[id] = (state.daily.shop[id] || 0) + 1;
  return grantAny(state, item.reward);
}
function cashAvailable(state, id) { return !(CASH[id].once && state.premium.bought[id]); }
function grantPurchase(state, id) {
  const item = CASH[id];
  if (!item || !cashAvailable(state, id)) return null;
  state.premium.bought[id] = (state.premium.bought[id] || 0) + 1;
  sendMail(state, `${item.name} 구매 보상`, item.reward, '구매해 주셔서 고마워요!');
  return true;
}

// ── 퀘스트 가이드 ──
function questAt(index) {
  if (index < QUEST_SCRIPT.length) {
    const [kind, target, gems] = QUEST_SCRIPT[index];
    return { kind, target, gems };
  }
  const step = index - QUEST_SCRIPT.length;
  const round = Math.floor(step / QUEST_LOOP.length) + 1;
  const kind = QUEST_LOOP[step % QUEST_LOOP.length];
  const target = {
    best: 12 + round * 4, power: 25 + round * 10, health: 20 + round * 10, level: 20 + round * 8,
    pulls: 50 + round * 30, dungeons: 5 + round * 4, recruits: 5 + round * 5,
  }[kind];
  return { kind, target, gems: Math.min(150, 50 + round * 5) };
}
function questState(state) {
  const quest = questAt(state.quest);
  const value = QUEST_VALUE[quest.kind](state);
  return { ...quest, value, done: value >= quest.target };
}
function claimQuest(state) {
  const quest = questState(state);
  if (!quest.done) return null;
  state.gems += quest.gems;
  state.quest++;
  return quest;
}

// ── 성장 패스: 최고 기록 맵 3개마다 한 칸 ──
function passTiers(state) { return Math.floor(bestProgress(state) / PASS_STEP); }
function passReward(step, premium) {
  if (premium) return step % 5 === 0 ? { gems: 120, recruits: 3 } : { gems: 60, recruits: 1 };
  return step % 5 === 0 ? { gems: 40, tickets: 5 } : { gems: 20 };
}
function claimPass(state) {
  const tiers = passTiers(state);
  const total = {};
  const merge = given => { for (const [key, value] of Object.entries(given)) total[key] = (total[key] || 0) + value; };
  while (state.pass.free < tiers) merge(grantAny(state, passReward(++state.pass.free, false)));
  while (state.premium.pass && state.pass.premium < tiers) merge(grantAny(state, passReward(++state.pass.premium, true)));
  return total;
}

function migrateFeatures(s) {
  const count = value => Number.isSafeInteger(value) && value >= 0;
  if (s.training && typeof s.training === 'object') for (const id of Object.keys(TRAINING)) if (s.training[id] === undefined) s.training[id] = 0;
  for (const key of ['allyLv', 'skillLv']) {
    const raw = s[key] && typeof s[key] === 'object' && !Array.isArray(s[key]) ? s[key] : {};
    const levels = key === 'allyLv' ? Object.fromEntries(Object.entries(raw).map(([id, level]) => [LEGACY_MATES[id] || id, level])) : raw;
    const ids = key === 'allyLv' ? COMPANIONS : ACTIVE;
    s[key] = Object.fromEntries(Object.keys(ids).filter(id => count(levels[id]) && levels[id] > 0).map(id => [id, levels[id]]));
  }
  if (typeof s.autoTrain !== 'boolean') s.autoTrain = false;
  if (!count(s.tickets)) s.tickets = WELCOME_TICKETS;
  const stickers = s.stickers && typeof s.stickers === 'object' ? s.stickers : {};
  s.stickers = Object.fromEntries(Object.keys(STICKERS).filter(id => count(stickers[id]) && stickers[id] > 0).map(id => [id, stickers[id]]));
  const snacks = s.snacks && typeof s.snacks === 'object' ? s.snacks : {};
  s.snacks = Object.fromEntries(Object.keys(SNACKS).map(id => [id, clamp(Number.isFinite(snacks[id]) ? snacks[id] : 0, 0, SNACK_MAX)]));
  if (![1, 2].includes(s.speed)) s.speed = 1;
  if (!s.attendance || !count(s.attendance.count) || typeof s.attendance.last !== 'string') s.attendance = { count: 0, last: '' };
  const daily = s.daily;
  const validDaily = daily && typeof daily.date === 'string' && count(daily.baseWins) && count(daily.trains) && count(daily.pulls)
    && count(daily.snacks) && Array.isArray(daily.claimed) && daily.claimed.every(id => Object.hasOwn(DAILY_MISSIONS, id));
  if (!validDaily) s.daily = null;
  if (s.daily) {
    if (!count(s.daily.dungeons)) s.daily.dungeons = 0;
    const keys = s.daily.keys && typeof s.daily.keys === 'object' ? s.daily.keys : {};
    s.daily.keys = Object.fromEntries(Object.keys(DUNGEONS).map(id => [id, count(keys[id]) ? Math.min(keys[id], DUNGEON_KEYS) : DUNGEON_KEYS]));
  }
  const dungeons = s.dungeons && typeof s.dungeons === 'object' ? s.dungeons : {};
  s.dungeons = Object.fromEntries(Object.keys(DUNGEONS).map(id => [id, count(dungeons[id]) ? dungeons[id] : 0]));
  const active = s.dungeon;
  if (!(active && (Object.hasOwn(DUNGEONS, active.id) || active.id === 'trial' || active.id === 'record') && count(active.level) && active.level >= 1 && Number.isFinite(active.time))) s.dungeon = null;
  if (!s.dungeonResult || typeof s.dungeonResult !== 'object' || !(Object.hasOwn(DUNGEONS, s.dungeonResult.id) || s.dungeonResult.id === 'trial' || s.dungeonResult.id === 'record')) s.dungeonResult = null;
  if (!count(s.cycle)) s.cycle = 0;
  const fresh = freshState();
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const hadMail = Array.isArray(s.mail);
  for (const key of ['gems', 'recruits', 'tier', 'quest', 'mailSeq']) if (!count(s[key])) s[key] = fresh[key];
  for (const key of ['companions', 'cooldowns', 'buffs']) if (!isObject(s[key])) s[key] = {};
  const renamed = id => LEGACY_MATES[id] || id;
  s.companions = Object.fromEntries(Object.entries(s.companions).map(([id, copies]) => [renamed(id), copies]).filter(([id, copies]) => Object.hasOwn(COMPANIONS, id) && count(copies) && copies > 0));
  if (Array.isArray(s.party)) s.party = s.party.map(renamed);
  if (!isObject(s.mateShards)) s.mateShards = {};
  if (s.mateGrade !== 1) {
    for (const [id, copies] of Object.entries(s.companions)) {
      const stars = Math.floor((Math.sqrt(8 * copies + 1) - 1) / 2);
      const max = GRADES[COMPANIONS[id].grade].maxStar;
      s.companions[id] = clamp(stars, 1, max);
      if (stars > max) s.mateShards[id] = (s.mateShards[id] || 0) + (stars - max) * 10;
    }
    s.mateGrade = 1;
  }
  s.companions = Object.fromEntries(Object.entries(s.companions).map(([id, stars]) => [id, Math.min(stars, GRADES[COMPANIONS[id].grade].maxStar)]));
  s.mateShards = Object.fromEntries(Object.entries(s.mateShards).filter(([id, shards]) => Object.hasOwn(COMPANIONS, id) && count(shards) && shards > 0));
  if (s.test !== undefined && !isObject(s.test)) delete s.test;
  if (s.allyLv && typeof s.allyLv === 'object') s.allyLv = Object.fromEntries(Object.entries(s.allyLv).map(([id, level]) => [renamed(id), level]));
  s.party = Array.isArray(s.party) ? Array.from({ length: PARTY_MAX }, (_, index) => (Object.hasOwn(s.companions, s.party[index]) ? s.party[index] : null)) : Array(PARTY_MAX).fill(null);
  s.allyTimers = [1.1, 1.5, 1.9, 2.3];
  s.mateBuffs = {};
  if (!Number.isFinite(s.shield) || s.shield < 0) s.shield = 0;
  if (s.profile && typeof s.profile === 'object') s.profile.gender = 'boy'; // 주인공은 남자로 고정(사용자 결정)
  if (typeof s.autoSkills !== 'boolean') s.autoSkills = true;
  if (typeof s.autoMates !== 'boolean') s.autoMates = true;
  s.record = isObject(s.record) && count(s.record.best) ? { best: s.record.best, tier: count(s.record.tier) ? s.record.tier : 0 } : { best: 0, tier: 0 };
  s.dungeonAuto = isObject(s.dungeonAuto) ? Object.fromEntries(Object.keys(DUNGEONS).map(id => [id, s.dungeonAuto[id] === true])) : {};
  if (!isObject(s.dungeonChain) || !Object.hasOwn(DUNGEONS, s.dungeonChain.id)) s.dungeonChain = null;
  s.rush = isObject(s.rush) && count(s.rush.until) && s.rush.until > 0 ? { until: s.rush.until } : null;
  s.stats = isObject(s.stats) ? s.stats : {};
  for (const key of ['pulls', 'recruits', 'dungeons']) if (!count(s.stats[key])) s.stats[key] = 0;
  s.pass = isObject(s.pass) ? { free: count(s.pass.free) ? s.pass.free : 0, premium: count(s.pass.premium) ? s.pass.premium : 0 } : { free: 0, premium: 0 };
  const premium = isObject(s.premium) ? s.premium : {};
  s.premium = { pass: premium.pass === true, adFree: premium.adFree === true, monthly: count(premium.monthly) ? premium.monthly : 0, bought: isObject(premium.bought) ? premium.bought : {} };
  s.mail = hadMail ? s.mail.filter(mail => mail && count(mail.id) && typeof mail.title === 'string' && isObject(mail.reward)).slice(0, 60) : [];
  if (s.daily && !isObject(s.daily.shop)) s.daily.shop = {};
  if (!hadMail) sendMail(s, '새 기능 업데이트 선물', { gems: 500, recruits: 10 }, '승급·동료·스킬·상점이 생겼어요. 동료 모집권으로 동기를 불러 보세요!');
  if (!Number.isFinite(s.bossTime) || s.bossTime > BOSS_TIME) s.bossTime = BOSS_TIME;
  if (!count(s.totalClears)) s.totalClears = Array.isArray(s.cleared) ? s.cleared.filter(Boolean).length : 0;
  const prestige = s.prestige && typeof s.prestige === 'object' ? s.prestige : {};
  const perks = prestige.perks && typeof prestige.perks === 'object' ? prestige.perks : {};
  s.prestige = {
    count: count(prestige.count) ? prestige.count : 0,
    badges: count(prestige.badges) ? prestige.badges : 0,
    earned: count(prestige.earned) ? prestige.earned : 0,
    best: count(prestige.best) ? prestige.best : 0,
    perks: Object.fromEntries(Object.keys(PERKS).map(id => [id, count(perks[id]) ? Math.min(perks[id], PERKS[id].cap) : 0])),
  };
}

function restore(snapshot) {
  if (!snapshot || ![1, 2, 3, 4, 5].includes(snapshot.version) || !Number.isFinite(snapshot.when)) return null;
  const s = snapshot.state;
  if (!s || !Array.isArray(s.cleared) || !Array.isArray(s.bag) || !Array.isArray(s.log)) return null;
  migrateFeatures(s);
  if (s.cleared.some(entry => typeof entry !== 'boolean') || s.bag.some(id => !Object.hasOwn(GEAR, id))) return null;
  if (snapshot.version === 1) {
    if (s.cleared.length !== LEGACY_GRADES || !Number.isInteger(s.grade) || s.grade < 0 || s.grade >= LEGACY_GRADES) return null;
    const gradesCleared = s.cleared;
    s.grade = Math.min(s.grade, GRADE_COUNT - 1);
    s.cleared = MAPS.map((_, index) => gradesCleared[gradeIndex(index)]);
    s.profile = null;
    openFight(s, s.grade * MAPS_PER_GRADE, 0, 0);
    delete s.grade;
  } else if (s.profile !== null) {
    s.profile = makeProfile(s.profile?.name, s.profile?.gender);
    if (!s.profile) return null;
  }
  if (s.cleared.length === 18 && MAPS.length === 12) {
    // 6학년(18맵) 시절 저장: 진행 비율대로 12맵에 옮기고 지금 맵의 처음부터 다시 연다
    const done = Math.min(MAPS.length - 1, Math.floor(s.cleared.filter(Boolean).length * 2 / 3));
    s.cleared = MAPS.map((_, index) => index < done);
    s.map = Math.min(done, Math.floor(s.map * 2 / 3));
    s.mapWins = MAPS.map((_, index) => (Array.isArray(s.mapWins) && Number.isSafeInteger(s.mapWins[Math.floor(index * 3 / 2)]) ? s.mapWins[Math.floor(index * 3 / 2)] : 0));
    if (s.prestige) s.prestige.best = Math.floor((s.prestige.best || 0) * 2 / 3);
    s.farm = null; s.front = null; s.pack = []; s.roundEnd = null; s.dungeon = null;
    openFight(s, s.map, 0, 0.3);
  }
  if (s.cleared.length !== MAPS.length) return null;
  if (!s.equipped || !s.training || ![null, ...Object.keys(CLASSES)].includes(s.classId) || typeof s.autoNext !== 'boolean') return null;
  const fields = ['level', 'xp', 'coins', 'map', 'wave', 'wins', 'charge', 'hp', 'enemyHp', 'nextAttack', 'nextEnemy', 'pause', 'tickRemainder'];
  if (fields.some(key => !Number.isFinite(s[key]))) return null;
  if (!Number.isInteger(s.map) || !Number.isInteger(s.wave) || s.map < 0 || s.map >= MAPS.length || s.wave < 0 || s.wave > BOSS_WAVE) return null;
  if (s.level < 1 || s.xp < 0 || s.coins < 0 || s.wins < 0 || !unlocked(s, s.map)) return null;
  if (snapshot.version < 4) {
    const old = s.equipped;
    s.equipped = { ...STARTER_GEAR };
    for (const id of [old.power, old.health]) if (s.bag.includes(id)) s.equipped[GEAR[id].slot] = id;
    s.bag = [...new Set([...Object.values(STARTER_GEAR), ...s.bag])];
    Object.assign(s, { ranks: {}, patches: 0, mapWins: MAPS.map(() => 0), missions: { wins: 0, clears: 0, closet: 0 }, farm: null });
    if (snapshot.version > 1) s.enemyHp = Math.round(s.enemyHp / MAPS[s.map].hp[s.wave] * enemyMaxHp(s));
  }
  for (const slot of Object.keys(SLOTS)) {
    if (!s.bag.includes(s.equipped[slot]) || GEAR[s.equipped[slot]]?.slot !== slot) return null;
  }
  s.equipped = Object.fromEntries(Object.keys(SLOTS).map(slot => [slot, s.equipped[slot]]));
  const count = value => Number.isSafeInteger(value) && value >= 0;
  if (!count(s.patches) || !Array.isArray(s.mapWins) || s.mapWins.length !== MAPS.length || !s.mapWins.every(count)
      || !s.missions || !Object.keys(MISSIONS).every(id => count(s.missions[id])) || !s.ranks || typeof s.ranks !== 'object'
      || Object.entries(s.ranks).some(([id, rank]) => !s.bag.includes(id) || !count(rank) || rank > MAX_RANK)) return null;
  for (const id of Object.keys(TRAINING)) {
    if (!Number.isInteger(s.training[id]) || s.training[id] < 0 || s.training[id] > TRAINING[id].cap) return null;
  }
  if (snapshot.version < 3) {
    Object.assign(s, {
      skillId: 'rush', autoSkill: true, sound: true, playerMove: null, enemyMove: null,
      roundEnd: null, bossPhase: 'ready', bossTimer: BOSS_PHASES.ready.duration,
    });
  }
  if (!Object.hasOwn(SKILLS, s.skillId) || !Object.hasOwn(BOSS_PHASES, s.bossPhase) || !Number.isFinite(s.bossTimer)) return null;
  if (typeof s.autoSkill !== 'boolean' || typeof s.sound !== 'boolean') return null;
  const validMove = move => move === null || (move && ['attack', 'crit', ...Object.keys(SKILLS)].includes(move.move) && Number.isFinite(move.left) && move.left > 0 && move.left <= 1);
  if (!validMove(s.playerMove) || !validMove(s.enemyMove)) return null;
  const end = s.roundEnd;
  const validFarm = farm => farm === null || (farm && [0, 1].includes(farm.cap) && count(farm.easy) && farm.easy <= 5 && count(farm.wins) && farm.wins < FARM_WINS);
  if (snapshot.version < 4 && end) end.nextFarm = null;
  if (!validFarm(s.farm)) return null;
  if (end !== null && (!end || !['win', 'loss'].includes(end.result) || !Number.isFinite(end.wait) || end.wait < 0 || end.wait > 2
      || !Number.isInteger(end.nextMap) || end.nextMap < 0 || end.nextMap >= MAPS.length || !unlocked(s, end.nextMap)
      || !Number.isInteger(end.nextWave) || end.nextWave < 0 || end.nextWave > BOSS_WAVE || !validFarm(end.nextFarm))) return null;
  s.hp = clamp(s.hp, end?.result === 'loss' ? 0 : 1, maxHp(s));
  // 무리 전투 이전: 앞 상대·뒤 상대 형식이 맞지 않으면 지금 상대를 혼자 남은 상대로 둔다
  const validMob = mob => mob && typeof mob.name === 'string' && Number.isFinite(mob.share) && Number.isFinite(mob.hit) && Number.isFinite(mob.max) && mob.max >= 1;
  if (!validMob(s.front) || s.front.key !== mobKey(s) || !Array.isArray(s.pack) || !s.pack.every(mob => validMob(mob) && Number.isFinite(mob.hp))) {
    const mobs = makeMobs(s);
    s.front = mobs[0];
    s.pack = mobs.slice(1).map(mob => ({ ...mob, hp: mob.max }));
  } else {
    const roster = makeMobs(s);
    for (const mob of [s.front, ...s.pack]) {
      const art = roster.find(entry => entry.name === mob.name && entry.leader === mob.leader);
      if (art) mob.sprite = art.sprite;
    }
  }
  s.enemyHp = clamp(s.enemyHp, end?.result === 'win' ? 0 : 1, enemyMaxHp(s));
  s.charge = clamp(s.charge, 0, 100);
  s.tickRemainder = clamp(s.tickRemainder, 0, STEP);
  s.log = s.log.filter(entry => typeof entry === 'string').slice(0, 3);
  return s;
}

if (typeof module !== 'undefined') {
  module.exports = {
    MATE_FAMILIES, FAMILY_ORDER, BALANCE_SYNERGY, mateFamily, teamSynergy, synergyNext, mateCooldown,
    castMate, useMate, swapParty, RECORD, recordTier, recordTierHp, recordReward, recordKeys, enterRecord, sweepRecord, RUSH_SPEED, rushEnd, rushing, RULES, RULE_ORDER, RULE_BONUS, ruleId, ruleFit, ruleMates, ruleBonus, leaveDungeon, dungeonKeys, mateScale, mateBuff, mateSkillDps, PARTY_MAX, PARTY_UNLOCKS, PARTY_UNLOCK_TEXT, LEGACY_MATES, BOSS_SPRITES, REGION_ROUNDS, REGION_START, regionIndex, regionRound, lastRound, roundTag, stageLabel, skillPower, skillUnlocked, venueMap, stagePlace, stageNames, stageArt, regionConquered, REGIONS, ZONES, ACADEMY, autoTrain, critPower, regenRate, allyTrainLevel, allyTrainCap, allyTrainCost, trainAlly, skillLevel, skillCost, cheerMult, sprintMult, lunchHeal, trainSkill, ALLY_TRAIN, CRIT_BASE,
    CONTESTS, schoolName, gradeLabel, placeLabel, contestId, contest,
    newGame, simulate, restore, trainingCost, maxHp, attack, enemyMaxHp, openFight, activateSkill, gearStats, nextMission, MAPS, GEAR, SLOTS, MAP_REWARDS, BOSS_REWARDS, TRAINING, SKILLS, makeProfile,
    trainingCostAt, enemyHit, winCoins, winXp, interval, critChance, prestigeGain, transfer, perkCost, PERKS, pullStickers, pullCost, progress, xpTarget,
    GROWTH, MAX_RANK, BOSS_WAVE, MAPS_PER_GRADE, fmt, STICKERS, DROP_WINS,
    DUNGEONS, DUNGEON_PACK, PACK, SPLASH, GANG_UP, BOSS_TIME, killProgress,
    TIERS, TIER_MULT, tierReq, tierLevel, tierReady, enterTrial, COMPANIONS, GRADES, GRADE_ORDER, STAR_STEP, SHARD_DROP, mateGrade, mateShards, addShards, starCost, starUp, dropShard, rollGrade, THUG_BOSSES, THUG_LEADERS, MOB_SPRITES, ALLY_INTERVAL, companionLevel, allyPower, partySlots, recruit, setParty,
    ACTIVE, castSkill, SHOP, CASH, buyShop, grantPurchase, claimMail, sendMail, welcomeMail, questState, claimQuest, passTiers, claimPass, grantAny, bestProgress, DUNGEON_TIME, DUNGEON_KEYS, dungeonReward, dungeonProgress, atProgress, dungeonUnlocked, refreshDay, enterDungeon, sweepDungeon, makeMobs,
  };
}
