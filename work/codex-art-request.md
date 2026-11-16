# Codex 그림 작업 요청 — 쉬는 시간의 왕 (무리 전투·던전)

작성 2026-11-16 · Claude · 받는 쪽 Codex

## 배경

사용자 요청으로 전투를 기존 방치형 방식으로 바꿨습니다.

- 1~3번째 대결은 **무리 전투**입니다. 친구 둘이 먼저 나오고, 무리 대장(맵에 이름이 정해진 상대)이 마지막에 나옵니다. 앞에 선 상대 뒤로 남은 상대가 줄 서 있습니다.
- 4번째 대결은 1:1 **보스전**입니다.
- **방과 후 던전** 3종(매점 쟁탈전·도서실 퀴즈왕·전국 체력장)이 추가됐습니다. 졸개 셋 → 던전 보스 순서입니다.

코드와 화면은 끝났습니다. 지금은 **기존 그림을 다시 쓰고 있어서** 친구 역할이 rival1~3 세 명뿐이고, 던전 보스·배경도 본편 그림(boss2·boss3·boss6, map-06·map-10·map-18)을 빌려 씁니다. 아래 그림만 새로 만들어 주세요. 코드는 이름만 더하면 바로 씁니다.

## 공통 규칙 (기존 그림과 똑같이)

- 화풍: `recess/assets/boy.webp`, `rival1~4.webp`, `boss1~6.webp`와 같은 **치비 픽셀 아트**로, 같은 외곽선 두께와 팔레트를 써 주세요. 배경은 투명입니다.
- 서 있는 그림: 높이 **255px**, 폭 155~190px, 발이 아래 가운데에 닿게. **오른쪽을 보는 자세**로 그려 주세요(상대 쪽은 코드가 좌우를 뒤집습니다).
- 동작 프레임: 280×255px, 기존 `motion-rival1-*.webp`처럼 `windup`, `strike`, `hit`, `down` 4장. 보스는 `motion-boss1-*`처럼 9장(ready·step·windup·strike·follow·hit·down·guard·open)이면 더 좋습니다.
- 동작 시트는 지금처럼 한 장에 그려 `work/build_recess_motion.py` 방식으로 잘라도 됩니다.
- 사람 얼굴·이름은 모두 창작으로 해 주세요(실존 인물·기존 게임 캐릭터 금지).

## 1. 같은 반 친구(무리 졸개) 8종 — 가장 중요

| id | 느낌 |
|---|---|
| mob1 | 1학년 남자, 노란 모자, 작은 키 |
| mob2 | 1학년 여자, 양갈래, 분홍 원피스 |
| mob3 | 3학년 남자, 축구 유니폼 |
| mob4 | 3학년 여자, 단발, 줄넘기 |
| mob5 | 4학년 남자, 안경, 리코더 |
| mob6 | 5학년 여자, 포니테일, 체육복 |
| mob7 | 6학년 남자, 큰 키, 농구공 |
| mob8 | 6학년 여자, 머리띠, 학급 임원 배지 |

- 파일: `recess/assets/mob1.webp` … `mob8.webp`, `recess/assets/motion-mob1-{windup,strike,hit,down}.webp` …
- 연결:
  1. `recess/assets.css`에 `[data-sprite='mob1'] { --sprite-image: url('assets/mob1.webp'); }`를 8줄 추가합니다.
  2. `recess/motion.css`에 rival1과 같은 형식으로 4줄씩 추가합니다(strike는 launch·follow와 공유).
  3. `recess/game.js`의 `const MOB_SPRITES = ['rival1', 'rival2', 'rival3'];`에 `'mob1'…'mob8'`을 더합니다. 그러면 친구 역할과 던전 졸개가 자동으로 섞여 나옵니다.

## 2. 던전 보스 3종

| 던전 | 보스 이름(게임 안) | id | 느낌 |
|---|---|---|---|
| 매점 쟁탈전 | 매점 줄서기 대장 | dboss-store | 덩치 큰 6학년, 빵 봉지와 우유를 양손에, 앞치마 |
| 도서실 퀴즈왕 | 퀴즈 대장 책벌레 | dboss-quiz | 두꺼운 안경, 책 더미를 안고, 퀴즈 버저 |
| 전국 체력장 | 체력장 1등 선배 | dboss-sports | 머리띠, 운동복, 목에 초시계, 근육 포즈 |

- 파일: `recess/assets/dboss-store.webp` 등과 동작 프레임(최소 4장, 가능하면 9장).
- 연결: assets.css·motion.css에 같은 형식으로 추가하고, `game.js`의 `DUNGEONS`에서 `sprite: 'boss2'`, `'boss3'`, `'boss6'`를 새 id로 바꿉니다.

## 3. 던전 배경 3종

- 크기: 535×302px, 기존 `map-01~18.webp`와 같은 화풍입니다.
  - `dungeon-store.webp`: 매점 앞, 쉬는 시간에 길게 늘어선 줄, 빵·우유 진열대
  - `dungeon-quiz.webp`: 도서실 안 퀴즈 대회 무대, 점수판, 버저
  - `dungeon-sports.webp`: 운동장 체력장, 트랙·출발선·현수막·초시계 시계탑
- 연결:
  1. `assets.css`에 `[data-map='d-coin'] { --map-image: url('assets/dungeon-store.webp'); }`처럼 `d-coin`·`d-ticket`·`d-badge` 세 줄을 추가합니다.
  2. `game.js`의 `DUNGEONS` 각 항목에 `background: 'd-coin'`처럼 한 칸을 더합니다. 화면은 이미 `background`가 있으면 그것을 씁니다(`ui.js`의 `dungeon.background`).

## 확인

`work`에서 아래를 차례로 실행해 모두 통과해야 합니다. `check_recess.py`는 실패한 요청이 하나라도 있으면 실패하므로, CSS에 연결한 파일은 반드시 있어야 합니다.

```
py -I package_recess.py
py -I check_recess.py
py -I check_recess_combat.py
py -I check_recess_wardrobe.py
py -I check_recess_longterm.py
```

`package_recess.py`는 `assets/*.webp`를 자동으로 HTML에 넣습니다. 새 그림을 추가해도 스크립트를 고칠 필요가 없습니다.
