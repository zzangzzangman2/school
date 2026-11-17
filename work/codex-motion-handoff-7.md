# 해솔 격투 아카데미 7차 모션 인수인계

대결용 가로 띠 129장, 주인공 장비 마스크 띠 17장, 반복 재생 GIF 129개를 제공한다. 총 566프레임이고 장비 마스크 90프레임이 주인공 그림에 대응한다.

- 게임 소스에는 `work/recess/assets/anim-*.webp`, `animmask-boy-*.webp`로 배치했다.
- 확인용 GIF는 `outputs/recess-motion-preview-7/`에 모았다.
- `outputs/recess-motion-pack-7.zip`에 WebP, GIF와 이 문서를 넣었다.

## 재생에 필요한 규격

한 칸은 280×255px이다. 첫 프레임부터 가로로 배치했고 모든 인물은 오른쪽을 본다. 지면은 높이 249px, 가로 기준점은 140px이다. 주인공 달리기에서 두 발이 뜨는 3·6번째 프레임은 접지 높이보다 6px 위다. GIF 하단의 얇은 선과 중심 표시로 착지와 좌우 이동을 확인할 수 있다.

장비 마스크는 같은 이름의 그림과 동일한 칸 수와 순서다. 검정은 원래 색, 빨강은 상의, 초록은 하의, 파랑은 태그·참, 노랑은 신발이다. 프레임 번호와 같은 칸을 잘라 기존 장비 합성에 넘기면 된다. 특정 자세에서 태그가 가려지면 파란 영역이 작거나 비어 있다.

| 대상 | 파일과 프레임 수 | 타격 기준 |
| --- | --- | --- |
| 주인공 | `idle` 6, `run` 6, `punch` 6, `hit` 3, `down` 5, `victory` 6 | `punch` 3번째가 최대 뻗음. `victory` 5번째에서 뻗은 주먹을 6번째에서 조금 내려 마무리한다. |
| 건달 12명 | `thug1`–`thug8`, `thug-boss1`–`thug-boss4`의 `idle` 4, `attack` 4, `hit` 2, `down` 4 | `attack` 2번째에서 타격. |
| 동료 16명 | `mate1`–`mate16`의 `idle` 4, `run` 4(오다솜 `mate9` 8), `attack` 5, `skill` 6 | `attack` 3번째에서 타격. `skill` 4번째가 기존 `skill-b` 자세. |
| 주인공 종목·스킬 | `kick` 6, `knee` 5, `throw` 7, `hold` 5, `guard` 3, `rush` 6, `counter` 6, `combo` 6, `cheer` 5, `drink` 5, `step` 4 | 발차기·무릎·돌진·카운터·연타는 3번째, 메치기는 4번째를 타격과 맞출 수 있다. |

게임에서 대기와 달리기는 반복하고, 공격·피격·승리·패배는 한 번 재생해 다음 상태에 넘긴다. 검수 GIF에는 차이를 반복 확인할 수 있도록 나머지 동작에도 마지막 포즈 유지 시간을 넣고 반복 재생을 켰다. 코드의 상태 연결과 재생 속도 설정은 요청서대로 Claude가 담당한다.

## 오다솜 달리기 교체

`anim-mate9-run.webp`는 8칸, 총 2240×255px이다. 착지 → 발 교차 → 밀어내기 → 공중 동작을 반대쪽 팔·다리로 한 번 더 반복한다. 붉은 허리띠를 가로 140px에 맞췄다. 디딤 장면의 지면은 249px이고 4·8번째는 두 발이 9px 뜬다. 검수 GIF는 프레임당 70ms, 한 바퀴 560ms다. 재생 코드에서 이 파일은 프레임 수를 8로 읽는다.

투명 원본에서 회색 후광을 제거하고 프레임을 정렬했다. 현재 7차 ZIP에서 오다솜의 GIF와 WebP가 교체됐다. 전체를 다시 만들 때도 빌드 스크립트에 `--mate9-run`으로 같은 생성 원본을 넘긴다.

<details>
<summary>오다솜 달리기 생성 프롬프트</summary>

Repaint this EXACT adult martial-arts game character as a professional drawn 2D right-facing sprint cycle for a side-scrolling game. Use image 1 as her exact facial identity, palette, hair and outfit. Image 2 shows her proportions in forward movement. Preserve the same face, dark braided side bun with small gold ornament and blue ties, navy high-collar sleeveless long split tunic with pale gold embroidered lining, red waist sash, fitted navy trousers, forearm bracers and dark open-toe martial-arts sandals. Carry over the soft painted anime lighting, facial design and costume construction; do not redesign her.

Output a single transparent atlas with exactly EIGHT complete full-body sprites, evenly spaced in a STRICT 4-column × 2-row grid. Top row left-to-right is the first stride, bottom row left-to-right is the opposite stride. Generous margins in every cell on all sides, no parts overlap other cells. Position the red sash knot over the same center mark in each cell. Keep a steady right-facing near-profile angle, same scale, same forward-leaning head and neck, a level imaginary ground across each row. Feet and hands stay clear of the coat tails. Draw distinctly different knee, ankle and elbow placements that can be read at 100 px height. Her arms swing at her sides with elbows bent and loose hands, opposite to the forward leg. The near leg is lit and fully readable; the far leg is lightly shaded. Coattails and ribbons sweep behind her, clear of both ankles.

Top left step 1: near-side leg reaches forward with its sandal about to strike the ground, far-side leg extends back and pushes off, near arm back and far arm forward. Top second step 2: near-side sandal supports her almost directly below her hips, near knee flexes under weight, far-side heel tucks up behind her with a sharply bent knee. Top third step 3: near-side leg pushes back, far-side knee rises and passes under the hips, opposite elbows swap. Top fourth step 4: small airborne stride, far knee leading, near leg trailing. Bottom left step 5: far-side sandal reaches forward for contact, near leg pushes visibly behind her, near arm forward, far arm back. Bottom second step 6: far-side sandal fully supports her beneath the hips, near-side heel clearly curls up behind her. Bottom third step 7: far-side leg pushes back, near-side knee rises and passes under her hips. Bottom fourth step 8: brief airborne stride with near knee leading, far leg behind, ready to loop to step 1. Preserve the anatomical near-vs-far leg swap; the top and bottom contact frames cannot be duplicates. Do not slide the whole character sideways between frames. No floor drawing, no props, no external shadows, no checkerboard, no lines, no text or grid labels. Art only.

</details>

## 제작과 검수

- 주인공 달리기·쓰러짐·승리는 내장 이미지 생성 도구로 같은 얼굴과 운동복을 기준으로 연결 포즈를 제작했다.
- 그 외 동작은 기존 대결용 자세를 기준으로 같은 얼굴과 장비를 보여 준다. 무게 이동과 대기 호흡, 동료 달리기의 발 교대는 기존 그림을 변형해 만들었다. 동료·건달 전체의 재생 체감은 게임 연결 후 확인할 수 있다.
- `work/build_recess_motion7.py`로 가로 띠와 반복 GIF를 제작했다. 프레임 수, 칸 크기, 가장자리 여백과 장비 마스크 규격을 검사한다.

[원 요청서](codex-motion-request-7.md)

<details>
<summary>주인공 신규 포즈 생성 프롬프트</summary>

**달리기**

Paint a single 3:1 transparent game sprite sheet with exactly six drawn sequential RIGHT-facing running poses of the SAME adult male martial arts game protagonist. It is one evenly spaced horizontal row of six cells with generous transparent gutters, every figure fully visible with no overlaps. Reference 1 is the existing idle character for identity and costume. Reference 2 is his current running pose for rendering, proportions and perspective. Keep his angular adult face, purple black side-swept hair, lavender jacket with violet cuffs, dark T-shirt, purple padded fingerless gloves, lavender joggers with violet side stripes, lilac high top trainers, and a single small gold circular tag at his left hip. Match the existing painted anime finish; retain the same face, hair, clothes and palette in all six drawings. The head stays at the same scale, looking right, hips centered at the same X in each cell. A coherent running cycle across the six panels at the same ground level (foot contact, leg folds under, push-off, opposite-foot contact, opposite leg folds under, opposite push-off so the sixth connects to the first). Visible coherent leg swings and arm counter-swings, compact enough to fit each cell. Hands stay clenched in the same gloves. Use a strict side-view silhouette with a slight three-quarter torso matching the references. The character's grounded shoe aligns to a level invisible baseline across the row, and the airborne steps rise only slightly. Frame 1 and frame 4 show opposite legs in front. True transparent background under every figure, no scene or cast shadow, no checkerboard marks, no text, no dividers, no arrows, no graphics, no numbers and no border.

**쓰러짐**

Paint a transparent sprite atlas for a premium adult Korean martial arts video game. Exactly 6 full-body drawings in a strict 3-columns × 2-rows uniform grid, ordered left to right top row then left to right bottom row. Every cell has at least 12% clear margin on all edges, including the hands, feet and head. Reference 1 is the existing male player identity and sportswear, reference 2 is his final seated defeat. Keep one exact adult man's face, purple-black layered hair, lavender training jacket, purple padded gloves, lavender joggers with violet side stripe, small gold hip tag and lilac high tops across all poses, rendered with the same high quality painted anime texture. Time order: first frame guarding with staggered feet, second frame rocked back arms close to chest, third frame knees buckling and left hand dropping, fourth frame low crouch one gloved hand touches floor, fifth frame sitting with knees tucked and forearms on them, sixth frame holds seated with head slightly lowered. Same right-facing side-three-quarter view and model scale across frames, pelvis lowers with pose naturally. Ground line horizontal and held fixed in each tile. The near planted shoe and hips stay close to same X relative to cell center as the character settles onto his seat; no jump or translation. True transparent background, character-only, no shadow, blood, impact effects, text, numbers, arrows, dividers or marks.

**승리**

Paint a transparent sprite atlas for a premium adult Korean martial arts video game. Exactly 6 full-body drawings in a strict 3-columns × 2-rows uniform grid, ordered left to right top row then left to right bottom row. Every cell has at least 12% margin on all edges and every part of the body stays fully inside its cell, especially raised fists above the head and boots below. Use existing reference 1 for the exact adult male facial identity, purple-black hair, lavender training jacket, violet side-stripe joggers, purple padded gloves, violet-white high-top shoes and single small gold hip tag. Reference 2 is the final victory pose to interpolate toward. Grounded victory sequence, right-facing three-quarter view. Pose 1 still in boxing guard and looking right, pose 2 opens chest and lowers elbows, pose 3 brings fists up to shoulder height, pose 4 raises both fists almost straight up with face looking a little upward to the right, pose 5 final triumphant both-fists-raised celebration with a subtle adult smile, pose 6 settles holding fists up a little lower. Keep BOTH boots on the same marks relative to the cell center throughout; all cells show the boots at the same height and about the same shoulder-width distance apart. Do not jump, rotate or shuffle feet. Maintain the exact same face proportions, model size, lavender outfit, glove style, side stripes, palette and materials across all drawings. High quality clean hand-painted anime sprite illumination matching the references. True transparent background, no shadow, character-only, no text, separators, tile borders, flashes, particles, motion streaks, extra items or cropped extremities.

</details>
