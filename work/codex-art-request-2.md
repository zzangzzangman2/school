# Codex 그림 작업 요청 2차 — 승급·스킬·상점·패스

작성 2026-11-16 · Claude · 받는 쪽 Codex

## 배경

방치형 기본 시스템을 추가했습니다. 지금은 기존 그림과 선 아이콘으로 돌아가고 있고, 아래 그림이 들어오면 더 게임다워집니다.

- 승급(시험 1:1)
- 동료 출전
- 액티브 스킬 4종
- 보석·상점·캐시 상품 자리
- 우편
- 퀘스트 가이드
- 성장 패스

공통 규칙(화풍, 255px 높이, 투명 배경, 오른쪽 보기, 동작 프레임 280×255)은 [1차 요청서](codex-art-request.md)와 같습니다. 그림을 연결한 뒤에는 `work`에서 검사 6종을 모두 통과해야 합니다.

```
py -I package_recess.py
py -I check_recess.py
py -I check_recess_combat.py
py -I check_recess_wardrobe.py
py -I check_recess_art.py
py -I check_recess_longterm.py
py -I check_recess_meta.py
```

## 1. 승급 시험관 8종 (우선순위 높음)

지금은 본편 보스(boss1~6)와 던전 보스 그림을 다시 씁니다.

| 순서 | 이름(게임 안) | id | 느낌 |
|---|---|---|---|
| 1 | 선도부장 선배 | exam1 | 완장, 호루라기, 팔짱 |
| 2 | 반장 회의 의장 | exam2 | 안경, 서류철, 의사봉 |
| 3 | 학년 대표 선배 | exam3 | 어깨띠, 트로피 |
| 4 | 학생회 총무 | exam4 | 계산기, 장부 |
| 5 | 학생회 부회장 | exam5 | 망토처럼 두른 학생회 점퍼 |
| 6 | 학생회장 선배 | exam6 | 왕관 모양 배지, 당당한 포즈 |
| 7 | 전교 회장 선배 | exam7 | 금색 어깨띠, 마이크 |
| 8 | 졸업생 대표 | exam8 | 학사모, 졸업장 두루마리 |

- 서 있는 그림과 동작 9장(ready·step·windup·strike·follow·hit·down·guard·open)을 만들어 주세요.
- 연결: `assets.css`·`motion.css`에 추가하고, `game.js`의 `EXAMINERS` 배열에서 두 번째 값(그림 id)을 `exam1`~`exam8`로 바꿉니다.
- 배경: `exam-hall.webp`(535×302, 강당 무대에 "승급 시험" 현수막). `assets.css`에 `[data-map='d-exam']`를 추가하고, `TRIAL.background`를 `'d-exam'`으로 바꿉니다.

## 2. 액티브 스킬 아이콘·연출 4종

지금은 선 아이콘(`meta-ui.js`의 `ACTIVE_ICONS`)과 글자 연출을 씁니다.

- 아이콘: 96×96 투명 PNG→webp, 둥근 사각 안에 들어갈 그림입니다.
  - `skill-pencil.webp`: 필통 던지기(날아가는 필통과 연필)
  - `skill-cheer.webp`: 응원 함성(메가폰과 음표)
  - `skill-lunch.webp`: 급식 충전(식판과 하트)
  - `skill-sprint.webp`: 체육 대장(운동화와 바람)
- 연출(선택): 가로 6프레임 시트(각 160×160). `fx-pencil`(필통이 날아가 터짐), `fx-cheer`(동그란 파동), `fx-lunch`(초록 반짝임), `fx-sprint`(속도선).
- 연결: CSS에서 `.active-skill.pencil .active-icon`의 배경으로 넣거나, `ACTIVE_ICONS`를 그림용으로 바꿉니다. 연출은 `meta-ui.js`의 `onActive()`에서 `.skill-pop` 옆에 띄우면 됩니다.

## 3. 상점·캐시 상품 그림

- 상품 아이콘(120×120): `shop-daily`(선물 상자), `shop-tickets`(뽑기권 묶음), `shop-recruit`(모집 전단지), `shop-keys`(열쇠 꾸러미), `shop-coinbox`(코인 가득한 도시락통), `shop-patches`(천 조각 바구니), `shop-snacks`(우유 세 개 세트)
  - 연결: `meta-ui.js`의 `SHOP_ICONS`
- 캐시 상품 배너(320×120): 입학 축하 패키지, 급식 월정액, 프리미엄 성장 패스, 간식 무제한, 보석 주머니, 보석 상자
  - 연결: `renderShop()`의 캐시 목록
- 보석 아이콘(64×64): 지금은 CSS 도형(`.cur.gem`)입니다. 하늘색 다이아 모양 그림이 있으면 교체합니다.

## 4. 배너

- 동료 모집 배너(360×140): 반 친구들이 손을 흔드는 단체 그림. `.recruit-banner`의 배경으로 씁니다.
- 성장 패스 배너(360×100): 계단을 오르는 주인공과 보상 상자.

## 5. 동료 추가(다음 업데이트용)

친구 8명 외에 영웅·전설 동료를 더 늘리면 모집이 덜 단조로워집니다.

- 예: 방송부 아나운서, 미술부 화가, 과학부 발명가, 육상부 에이스
- `mob9`부터 같은 방식으로 만들고 `game.js`의 `COMPANIONS`에 `{ name, rarity }`를 더하면 됩니다.
