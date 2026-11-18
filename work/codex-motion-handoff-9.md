# 주인공 모션 9차 인수인계

원본 그림 띠 11개와 장비 마스크 18개를 `work/recess/assets/`에 반영했다. `outputs/recess-motion-preview-9/`에 동작별 반복 GIF 18개를 넣었다. `outputs/recess-motion-pack-9.zip`에도 변경된 에셋, GIF, 이 문서가 들어 있다.

## 칸 수와 타격 시점

| 동작 | 파일 이름의 동작명 | 원본 칸 수 | 타격 칸(1부터) | `ANIM_IMPACT`(0부터) |
| --- | --- | ---: | ---: | ---: |
| 대기 | idle | 6 | | |
| 달리기 | run | 6 | | |
| 주먹 | punch | 6 | 3 | 2 |
| 맞음 | hit | 5 | | |
| 쓰러짐 | down | 6 | | |
| 승리 | victory | 6 | | |
| 발차기 | kick | 8 | 4 | 3 |
| 무릎 | knee | 7 | 4 | 3 |
| 메치기 | throw | 9 | 5 | 4 |
| 굳히기 | hold | 9 | 6 | 5 |
| 방어 | guard | 3 | | |
| 돌진 | rush | 9 | 5 | 4 |
| 반격 | counter | 8 | 4 | 3 |
| 연타 | combo | 7 | 4 | 3 |
| 기뻐하기 | cheer | 5 | | |
| 마시기 | drink | 5 | | |
| 스텝 | step | 4 | 3 | 2 |
| 일어나기 | getup | 5 | | |

## 원본 그림 확인

추가한 중간 자세 15장을 전후 원본 칸에 맞춰 배치했다. `smooth_strip.py`의 광학 흐름으로 불투명한 부분의 픽셀 이동 거리 95퍼센타일을 쟀다. 아래 표의 오른쪽 값은 하나의 구간을 두 칸 사이로 나눈 뒤의 각각의 거리다.

| 동작 | 기존 칸 사이 | 수정 전 | 수정 후 |
| --- | --- | ---: | ---: |
| 발차기 | 2→3 | 52.0px | 27.9 + 28.1px |
| 발차기 | 4→5 | 44.5px | 27.9 + 29.1px |
| 무릎 | 2→3 | 43.9px | 35.4 + 33.7px |
| 무릎 | 4→5 | 50.0px | 29.9 + 30.1px |
| 연타 | 2→3 | 51.2px | 27.9 + 24.5px |
| 돌진 | 1→2 | 41.6px | 35.7 + 35.3px |
| 돌진 | 2→3 | 47.4px | 28.0 + 31.8px |
| 돌진 | 5→6 | 48.1px | 28.0 + 30.4px |
| 반격 | 2→3 | 32.1px | 27.0 + 24.4px |
| 반격 | 5→6 | 35.7px | 29.9 + 17.8px |
| 굳히기 | 1→2 | 44.2px | 34.0 + 35.0px |
| 굳히기 | 3→4 | 44.5px | 30.9 + 29.1px |
| 메치기 | 3→4 | 36.7px | 28.1 + 32.3px |
| 메치기 | 4→5 | 38.0px | 30.0 + 31.6px |
| 쓰러짐 | 2→3 | 60.7px | 35.2 + 29.0px |

- 대기의 머리 꼭대기는 34→36→38→40→38→36px로 움직인다. 여섯 칸 모두 지면 기준은 249px이다.
- 맞음은 초기 충격, 몸을 크게 젖힘, 버팀, 가드 올리기, 대기 자세의 5칸이다.
- 일어나기는 쓰러짐 마지막 자세에서 시작해 손을 짚고, 한쪽 무릎을 세우고, 일어선 뒤 대기 첫 자세에 닿는다. 시작과 끝은 연결되는 동작과 실루엣이 같다.
- 마스크는 원본 그림과 같은 280×255px 칸으로 맞췄다. 메치기·굳히기의 재킷 자락과 몸을 가로지르는 소매, 발차기의 들린 바짓단을 따로 따라갔다. 기존 칸의 태그와 신발은 이전 분류를 사용했다.

## 게임 연결

1. 기존 띠를 포함한 원본 띠 18개와 대응 마스크를 `work/tools/smooth_strip.py`에 함께 넘겨 5칸씩 보간한다. 대기와 달리기에는 `--loop`를 쓴다. 나머지에는 끝에서 시작으로 돌아가는 보간이 필요 없다.
2. `work/recess/anim.js`의 `ANIM_IMPACT`를 표의 0부터 시작하는 값으로 갱신한다. 기존 `SMOOTH_K = 5`에서는 0부터 세는 원본 칸에 6을 곱해 보간 띠에서의 위치를 얻는다.
3. `getup`은 `wardrobe.css`에 원본·보간 띠와 마스크를 등록하고, 쓰러진 뒤 재도전할 때 대기로 넘어가기 전에 한 번 재생한다. TEST 동작 확인에 추가하면 첫 칸과 끝 칸을 쉽게 비교할 수 있다.

```powershell
$assets = 'work/recess/assets'
py work/tools/smooth_strip.py "$assets/anim-boy-throw.webp" "$assets/anim-boy-throw-smooth.webp" --k 5 --mask "$assets/animmask-boy-throw.webp" "$assets/animmask-boy-throw-smooth.webp"
```

## 생성 기록

ImageGen에서 기존 성인 남성 주인공 띠를 참조해 중간 자세·피격·일어나기 그림을 생성했다. `work/build_recess_motion9.py`에서 투명 칸에 배치하고 대기 루프와 장비 마스크, 확인용 GIF를 만들었다.

<details>
<summary>발차기 · 무릎</summary>

```text
Draw production sprite art for the SAME 20-year-old adult male Haesol martial arts game character shown in the reference sprites. Lock his adult face shape, dark purple swept hair, short lavender zip-up training jacket with broad hood and visible violet side stripes, dark tight undershirt, purple padded fingerless gloves, light lavender track pants with darker violet side stripes, pale lavender high-top boots, and a single small orange-gold circular tag at the waist. Match the original clean painted anime finish, palette, proportions, waist height and outer costume. Preserve gloves and shoes. Right-facing side-three-quarter perspective, same focal length and model scale. Every sprite is full body, truly transparent around the figure, with generous empty gutters, no hair, feet, limbs or motion streaks crossing a cell boundary. Ground foot, pelvis, and head match the pose reference, using physical articulated poses. No background, text, grids, shadow, external opponents, illustration frame, or glow. The first reference is a 2x2 board; every numbered cell shows two existing key poses, left early and right late. Output exactly FOUR new separate full-body sprites in one 2 columns × 2 rows atlas, one intermediate pose per numbered pair, in the same order. Output only the new sprite in each cell. Top left: between chambered right kick and fully horizontal right kick, support shoe planted, right thigh raises ahead then the knee begins to open, shin at a diagonal to the floor and foot between its start and farthest X; hands guard his chest. Top right: the same high kicking leg is withdrawing, knee bends halfway and boot is halfway back under the hip, no different kick. Bottom left: from tall bent-knee guard into jumping high knee, boxing gloves guarding chin, the driving thigh is halfway up and forward; trailing shoe's toes just push off and the same upper body moves slightly forward. Bottom right: from high-knee attack into grounded guard, driving knee lowers halfway and reaches for the mat, leading foot still slightly airborne, rear boot about to plant. Deliberate distinct step timing and same recognizable guard.
```

</details>

<details>
<summary>연타 · 돌진 · 반격</summary>

```text
Draw production sprite art for the SAME 20-year-old adult male Haesol martial arts game character shown in the reference sprites. Lock his adult face shape, dark purple swept hair, short lavender zip-up training jacket with broad hood and visible violet side stripes, dark tight undershirt, purple padded fingerless gloves, light lavender track pants with darker violet side stripes, pale lavender high-top boots, and a single small orange-gold circular tag at the waist. Match the original clean painted anime finish, palette, proportions, waist height and outer costume. Preserve gloves and shoes. Right-facing side-three-quarter perspective, same focal length and model scale. Every sprite is full body, truly transparent around the figure, with generous empty gutters, no hair, feet, limbs or motion streaks crossing a cell boundary. Ground foot, pelvis, and head match the pose reference, using physical articulated poses. No background, text, grids, shadow, external opponents, illustration frame, or glow. The first reference shows SIX numbered pairs of early and late keyframes; for each pair invent just one carefully observed halfway pose. Output exactly SIX new sprites in a strict 3 columns × 2 rows atlas ordered row-major by number 1–6. 1 at top left: second punch halfway between leading jab and fully extended straight; front hand is at about three-quarters reach with elbow still bent, shoes between the two positions. 2 top middle: guard lowering on the way to a forward sprint-powered stance, planted front shoe, trunk leans 20 degrees while rear leg pushes back. 3 top right: between compressed sprint stance and the straight lunge punch, weight shifts to the front thigh and fist is half extended to the right, retain same stance foot orientation. 4 bottom left: recover from full extended lunge, fist retracts halfway and front knee relaxes toward guard, rear foot slides in half its final distance. 5 bottom middle: counter guard opens into a short punching drive, front fist halfway out with bent elbow and rear glove tight at cheek, feet between positions. 6 bottom right: recover from counter lunge, bring the front glove back halfway as the lead knee straightens slightly and base narrows. These frames must be actual in-betweens of the pictured poses, not another complete wind-up or impact.
```

</details>

<details>
<summary>굳히기 · 메치기 · 쓰러짐</summary>

```text
Draw production sprite art for the SAME 20-year-old adult male Haesol martial arts game character shown in the reference sprites. Lock his adult face shape, dark purple swept hair, short lavender zip-up training jacket with broad hood and visible violet side stripes, dark tight undershirt, purple padded fingerless gloves, light lavender track pants with darker violet side stripes, pale lavender high-top boots, and a single small orange-gold circular tag at the waist. Match the original clean painted anime finish, palette, proportions, waist height and outer costume. Preserve gloves and shoes. Right-facing side-three-quarter perspective, same focal length and model scale. Every sprite is full body, truly transparent around the figure, with generous empty gutters, no hair, feet, limbs or motion streaks crossing a cell boundary. Ground foot, pelvis, and head match the pose reference, using physical articulated poses. No background, text, grids, shadow, external opponents, illustration frame, or glow. The first reference is a board of five numbered left-and-right keyframe pairs. Output six sprites of THIS character in strict 3 columns × 2 rows order. Sprite 1 is midway between tall standing guard and the squat: he starts bending both knees and reaches halfway downward with both arms, hips still high, shoulders lower than standing. Sprite 2 midway from one-knee contact into low floor grapple: one knee stays planted, other knee is starting to touch, both arms extend down, face and shoulders halfway down from the reference knee pose. Sprite 3 midway from forward grasping lunge to deep throwing lunge: front knee folds, torso leans forward 35 degrees, lead glove reaches shoulder/chest height while rear elbow starts to swing up and back. Sprite 4 midway from deep split-leg throw to rising recovery: front knee still deeply bent, hips rise a little, rear arm is lowering and lead hand retracts a short distance. Sprite 5 midway from defeat bent standing knees to deep crouch: knees collapse and hips go halfway to the floor, one gloved wrist reaches down to brace, both shoes still at ground level. Sprite 6 is a second adjacent variation of the defeat, hips a little lower and hand nearly to the ground. Match head scale and joint angles in each reference pair. No visible opponent.
```

</details>

<details>
<summary>피격</summary>

```text
Draw production sprite art for the SAME 20-year-old adult male Haesol martial arts game character shown in the reference sprites. Lock his adult face shape, dark purple swept hair, short lavender zip-up training jacket with broad hood and visible violet side stripes, dark tight undershirt, purple padded fingerless gloves, light lavender track pants with darker violet side stripes, pale lavender high-top boots, and a single small orange-gold circular tag at the waist. Match the original clean painted anime finish, palette, proportions, waist height and outer costume. Preserve gloves and shoes. Right-facing side-three-quarter perspective, same focal length and model scale. Every sprite is full body, truly transparent around the figure, with generous empty gutters, no hair, feet, limbs or motion streaks crossing a cell boundary. Ground foot, pelvis, and head match the pose reference, using physical articulated poses. No background, text, grids, shadow, external opponents, illustration frame, or glow. Output exactly FOUR distinct consecutive key drawings on a 2×2 atlas. The final fifth guard frame will be taken from reference 2, so draw only the four frames before it. Top left: moment of non-graphic sparring impact, chin recoils up and back and torso leans backward about 12 degrees, both shoes stay on mat, hands jerk slightly away from a tight guard. Top right: strongest backward recoil about 25 degrees, most weight goes onto visibly flexed rear knee, facing right, lead heel light or just lifted, shoulders clearly displaced back by the hit. Bottom left: bracing and catching himself after recoil, body low with knees bent, front shoe planted and chest beginning to lean forward again, gloves below guard. Bottom right: pushing back up from that stance and returning both gloves to his face, head nearly at guard height and centered. Make all four physically distinct yet measured on the same mat anchor, frame 1 to 2 follows backward momentum; 2 to 3 catches balance; 3 to 4 visibly raises both shoulders and hands. Use the exact violet outfit. Controlled sport facial expression, no wounds or blood.
```

</details>

<details>
<summary>일어나기</summary>

```text
Draw production sprite art for the SAME 20-year-old adult male Haesol martial arts game character shown in the reference sprites. Lock his adult face shape, dark purple swept hair, short lavender zip-up training jacket with broad hood and visible violet side stripes, dark tight undershirt, purple padded fingerless gloves, light lavender track pants with darker violet side stripes, pale lavender high-top boots, and a single small orange-gold circular tag at the waist. Match the original clean painted anime finish, palette, proportions, waist height and outer costume. Preserve gloves and shoes. Right-facing side-three-quarter perspective, same focal length and model scale. Every sprite is full body, truly transparent around the figure, with generous empty gutters, no hair, feet, limbs or motion streaks crossing a cell boundary. Ground foot, pelvis, and head match the pose reference, using physical articulated poses. No background, text, grids, shadow, external opponents, illustration frame, or glow. Create three new sequential rising poses inside one 3-column × 1-row atlas. Reference 1 is the exact start seated with knees tucked after being knocked down; reference 2 is the exact ending standing guard. Do not re-draw the endpoint poses. Left sprite: seated athlete plants the rear glove on mat beside his hip and shifts torso forward, left knee raised ready to load the foot. Middle sprite: rises onto one knee, other foot planted firmly in front, knee-to-chest angle reduced, off hand moving from support to guard. Right sprite: pushes up from the low lunge into a three-quarter raised stance, both feet under him, knees still slightly bent, both gloves halfway raised. Match foot height and shared scale; the body's rising motion must come from articulated lower body, not floating or overall size. Match face, jacket and clothing exactly.
```

</details>
