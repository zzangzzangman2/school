# 해솔 격투 아카데미 5차 포즈 인수인계

게임 소스의 `assets/` 폴더와 `recess-king-pose-pack-5.zip`에 같은 WebP 파일을 넣었습니다. 새 포즈의 선택 조건과 재생 순서는 게임 코드와 CSS에서 연결합니다. 기존 `motion-mob{2,4,5}-strike.webp`는 같은 이름으로 교체했습니다.

- 주인공 포즈 42장과 장비 마스크 42장
- 상대 24종의 `thrown`·`pinned`·`ready-b` 72장, 보스 9종의 `victory` 9장
- 전신 21장과 동료 공격 교체 3장

## 주인공 경기와 스킬

모든 파일에 `motion-{boy,girl}-`가 붙습니다. 대응하는 마스크는 같은 접미사에 `wardrobe-{boy,girl}-`를 붙입니다.

| 동작 | 등장 순서 |
|---|---|
| 발차기 | `kick-windup` → `kick-strike` → `kick-follow` |
| 무에타이 무릎 | `knee-strike` |
| 메치기 | `throw-windup` → `throw-strike` → `throw-follow` |
| 주짓수 누르기 | `hold-strike` |
| 돌진 스트레이트 | `skill-rush-windup` → `skill-rush-strike` |
| 공 울림 카운터 | `skill-counter-guard` → `skill-counter-strike` |
| 연타 러시 | `skill-combo-windup` → `skill-combo-strike` |
| 관중 함성 | `skill-cheer` |
| 프로틴 충전 | `skill-drink` |
| 풋워크 | `skill-step-windup` → `skill-step-follow` |
| 기본 | `guard`, `ready-b`, `lose` |

대결용은 오른쪽을 보는 280×255 RGBA입니다. 지면에 닿는 포즈는 아래쪽 249px을 기준으로 맞췄고, `knee-strike`와 상대 `thrown`은 매트에서 떠 보이도록 위쪽에 배치했습니다. 넓게 뻗은 포즈는 발 기준점을 중심으로 배치하되 캔버스 좌우 여백을 확보했습니다. `ready-b`는 기존 `ready`의 지면 높이와 지지 발 위치에 맞춰 배치했습니다.

마스크는 기존 장비 합성의 RGB 슬롯 값과 같습니다. 검정은 원래 채색을 쓰고, 빨강은 상의, 초록은 하의, 파랑은 허리 태그·참, 노랑은 신발입니다. 자세 때문에 가린 태그와 참은 프레임마다 보이는 면적이 다릅니다.

## 상대와 동료

현재 소스에 정의된 ID 24종 전부에 `motion-{id}-{thrown,pinned,ready-b}.webp`가 있습니다. `rival1`–`rival4`, `mob1`–`mob8`, `boss1`–`boss6`, `dboss-store`, `dboss-quiz`, `dboss-sports`, `sport-blue`, `sport-red`, `sport-green`입니다.

6개 본편 보스와 특별 대회 보스 3명에는 `motion-{id}-victory.webp`를 추가했습니다. 동료의 기존 공격에서는 서아의 레슬링 진입, 지유의 주짓수 누르기, 시온의 유도 메치기를 교체했습니다.

## 전신

전부 720×1280 투명 WebP입니다.

- `stand-boss5.webp`, `stand-boss6.webp`, `stand-dboss-{store,quiz,sports}.webp`
- `stand-{boy,girl}-win.webp`
- `stand-{boy,girl}-{smile,serious,tired}.webp`
- `stand-mob1-smile.webp`부터 `stand-mob8-smile.webp`

ImageGen으로 기존 캐릭터의 얼굴과 경기복을 기준으로 그렸습니다. 여성 캐릭터는 원화의 피부 반사광과 따뜻한 음영, 맑은 눈 하이라이트, 머리카락과 의상 소재별 광택까지 대조했습니다. [Nikke-DB 갤러리](https://nikke-db.pages.dev/gallery)
