# 그림자 기사단 전진 방식 분석

해솔은 **기존 정문과 복도 배경으로 먼저 고칠 수 있다.** 승리할 때 파티 전체를 다음 교전 지점으로 옮기고, 카메라가 뒤따라가게 만든다. 보스를 잡으면 화면 오른쪽 출구를 통해 다음 장소로 들어간다. 패배한 순간에만 진격을 멈추고, 현재 맵의 반복 수련으로 전환한다.

## 그림자 기사단에서 확인한 것

- 추출한 안드로이드 v55 APK의 Unity `level1` 씬에는 시작점과 적 무리 다섯 곳, 출구가 각각 있다. 스테이지 내부의 X 좌표는 시작 `-10` → 무리 `1, 10, 19, 28, 37` → 출구 `45`다. 출구에는 `FX_Gate` 오브젝트가 연결돼 있다.
- 적 목록이 비면 `OnMonsterRemoved`가 다음 웨이브를 시작한다. `BattleManager.Update`는 대형의 기준점 `FormationSlots`를 다음 무리까지 옮긴다. 주인공과 동료는 그 기준점에 붙은 자기 자리를 따라 뛰어간다. 마지막 무리를 이기면 일반 전투 경로에서 출구로 이동한다.
- 카메라는 추적 대상의 X 좌표와 화면 오프셋을 사용한다. 배경은 캐릭터 위치에 맞춰 텍스처 오프셋을 바꾸고, 월드가 바뀌면 대응하는 배경을 선택한다. 캐릭터가 화면 왼쪽에 비슷하게 보여도, 바닥과 배경이 왼쪽으로 흘러 앞으로 간다는 느낌이 난다.
- 새 스테이지를 여는 `StageStart`에는 대형과 카메라를 시작점 기준으로 다시 잡는 경로가 있다. 패배 처리도 `StageStart`를 부르며 스테이지 재시작으로 이어진다. 이번 확인 범위는 APK의 씬과 네이티브 코드다. 원본 게임에서 스테이지 경계의 화면 전환이 어떻게 보이는지는 실기기로 재생해 확인하지 않았다.

## 해솔이 돌아와 보이는 원인

전투 엔진은 이미 승리하면 다음 무리로, 자동 진격이 켜져 있으면 보스 다음 맵으로 넘어간다. 실패하면 같은 맵의 쉬운 무리를 상대로 수련하고 3승 후 다시 도전한다. 별도 브라우저 세션에서 1-1을 통과시킨 뒤 1-2 보스의 제한시간을 짧게 강제해 이 순서를 확인했다. [전투 처리](recess/game.js#L810)

화면은 고정된 좌우 전투 배치 위에 배경 한 장을 깔고, 현재 무리 번호로 배경을 자르는 위치를 정한다. 1-1에서 1-2로 넘어갈 때 세로 브라우저 두 크기에서 아래 결과가 같았다. 달리기 포즈가 끝나면 스프라이트가 고정 배치의 대기점으로 복귀한다. [전투 입장과 포즈](recess/ui.js#L150) · [배경 선택과 위치](recess/ui.js#L414) · [전투 배치](recess/style.css#L115)

| 진행 | 1-1 무리 1 | 1-1 무리 2 | 1-1 무리 3 | 1-1 보스 | 1-2 무리 1 |
| --- | --- | --- | --- | --- | --- |
| 배경 | 정문 | 정문 | 정문 | 정문 | 기숙사 복도 |
| 배경 가로 위치 | 8% | 36% | 64% | 92% | 8% |
| 입장 포즈 | 대기 | 달리기 | 달리기 | 달리기 | 대기 |

동료도 평타나 스킬을 쓰면 상대에게 접근하고 자기 출전 칸으로 돌아오는 연출이 있다. 이 복귀는 전투 중 대형을 읽기 쉽게 해 준다. 다음 무리로 갈 때는 네 출전 칸의 기준점을 주인공과 함께 앞으로 옮기면 된다. [동료 접근과 복귀](recess/meta-ui.js#L210)

## 전진을 구현하는 순서

1. **전투 공간과 HUD를 분리한다.** 주인공·동료·적·그림자를 공통 좌표계에 놓고, 체력바·승리 카운터·스킬 버튼은 제자리에 둔다. 파티의 이동 위치와 스프라이트의 공격·피격 위치를 별도로 적용한다. 공격이 끝나면 각자 이번 교전 지점의 대형으로 돌아온다.
2. **무리 하나를 정리하면 다음 교전 지점까지 뛴다.** 마지막 적이 쓰러지면 남아 있는 타격·승리 연출을 보여 준 뒤 파티가 오른쪽으로 이동한다. 카메라가 따라가면서 바닥과 배경은 왼쪽으로 흐른다. 새 무리는 오른쪽에서 드러나고, 파티가 사거리에 도착하면 다음 전투를 시작한다. 한 무리 안에서 앞의 적만 바뀔 때는 뒤에 있던 적이 빈자리로 나온다. 현재 승리 후 대기와 입장 유예 시간에 이동을 배치하면 진행 속도도 유지할 수 있다.
3. **보스 뒤에도 같은 방향을 유지한다.** 정문 오른쪽으로 달릴 때 다음 복도 배경을 미리 준비한다. 문틀, 화면 가장자리 가림, 짧은 장면 전환을 써서 다음 배경이 오른쪽에서 이어지게 한다. 다음 무리 번호가 0이 되거나 졸업으로 `cycle`이 바뀌어도 카메라의 진행 거리는 유지한다. 졸업 직전 화면은 출발 장소를 캡처해 두면 승리 포즈 도중 다음 지역 배경으로 바뀌는 현상을 피할 수 있다. [맵·시즌 전환](recess/game.js#L895) · [다음 대결 입장](recess/game.js#L1017)
4. **실패한 자리에서 멈춘다.** 체력 0 또는 보스 제한시간 초과 시, 그 위치에서 쓰러짐·휴식을 보여 준 뒤 짧게 전환해 같은 맵의 수련 위치를 연다. 쉬운 무리를 3번 이기면 현재 규칙대로 재도전한다. 수련 위치를 재사용할 때는 카메라를 뒤로 감는 애니메이션 대신 짧은 화면 전환으로 위치를 잡는다. 자동 진격 끄기, 수동 맵 선택, 던전 진입, 재입학은 별도의 장소 전환으로 취급한다. [보스 시간 초과](recess/game.js#L775) · [수련 승리 처리](recess/game.js#L884)

저장에는 지금처럼 맵·무리·수련 상태를 사용한다. 앱을 다시 열거나 오프라인 정산이 끝나면 그 결과에서 교전 지점을 복원한다. 2배속과 모션 줄이기에서도 엔진의 다음 전투 입장과 화면 도착이 맞아야 한다. 보상 지급은 기존 전투 엔진에 둔다.

## 맵 그림을 추가해야 하는 범위

| 범위 | 배경 작업 |
| --- | --- |
| 1차 확인용 1-1 정문 → 1-2 기숙사 복도 | 기존 WebP 두 장을 사용한다. 한 장에서 가로 이동 범위를 나눠 4번의 교전을 배치하고, 정문 보스 뒤에 출구 전환을 붙인다. |
| 한 장소에서 더 긴 거리를 달리는 지역 | 기존 그림을 입구·교전 구역의 대표 이미지로 쓰고, 바닥과 벽이 가로로 이어지는 중간 구간과 출구를 보강한다. 이어 붙일 그림은 바닥 높이와 원근선을 맞춘다. |
| 빠른 배경 이동에서도 깊이감이 필요한 장소 | 바닥과 가까운 벽을 앞 레이어로, 건물·하늘 등 먼 배경을 뒤 레이어로 제작한다. 앞쪽을 더 빠르게 움직인다. |

정문과 복도 원본은 각각 `535×302`다. 현재 `cover` 크기에서 8%에서 92%까지 자르는 위치를 움직일 수 있는 거리는 `390×844` 뷰포트에서 약 **345 CSS 픽셀**, `320×640`에서 약 **204 CSS 픽셀**이다. 짧은 전진 연출에 쓸 범위는 있다. 한 웨이브마다 화면 한 장만큼 이동시키려면 이어지는 배경이 필요하다. [정문·복도 배경 연결](recess/assets.css#L32) · [현재 배경 표시 방식](recess/style.css#L53)

## 1차 완료 기준

- 자동 진격으로 정문 세 무리와 보스를 이기고 기숙사 복도 첫 무리에 도착한다. 승리할 때마다 교전 지점이 오른쪽에 있고, 화면 전환에서 배경이 뒤로 스크롤되지 않는다.
- 동료를 1명과 4명으로 바꿔도 배치 순서가 유지된다. 동료가 때리고 복귀한 후 다음 무리로 달릴 때, 그 무리의 교전 위치에 맞춰 새 대형을 잡는다.
- 1-2에서 체력 0과 보스 시간 초과를 각각 재현한다. 실패 위치에서 멈춘 뒤 같은 맵 수련 3승과 재도전이 이어진다.
- 320×640과 390×844에서 승리할 때 머리와 달릴 때 발이 잘리지 않는다. 2배속·모션 줄이기·새로고침·첫 장비 바로 장착 후에도 현재 무리와 화면 위치가 일치하고 보상은 한 번 들어온다.

## 1-1 → 1-2 반영 결과

- 정문과 기숙사 복도의 색과 재질을 참고해 내장 이미지 생성 도구로 3:1 배경을 제작했다. 정문, 열린 유리문, 복도 바닥을 같은 높이로 그렸다. [전진 배경 WebP](recess/assets/map-academy-entry.webp)
- 두 맵은 같은 이미지를 쓰고 카메라 위치를 `1 → 11 → 22 → 34 → 52 → 66 → 80 → 97%`로 이동한다. 정문 보스 직후에도 배경을 교체하거나 되감지 않는다. [카메라 위치](recess/ui.js#L429)
- 390×844 기본 속도, 320×640 2배속, 모션 줄이기에서 정문부터 복도 보스까지 확인했다. 복도 보스 시간 초과 시 그 자리에서 멈춘 뒤 수련 위치로 전환한다. [실행본](../outputs/recess-king.html)

<details>
<summary>배경 생성 프롬프트</summary>

Create one extremely wide horizontal raster environment for a polished Korean martial arts academy mobile game's rightward side-scrolling battle route. This is one continuous view of a single traversable place with a level floor, intended to be viewed through a narrow viewport that pans from its extreme left edge to its extreme right edge. Aim for a 3:1 panoramic canvas, around 3072×1024.

Input 1 is a color/material reference for Haesol academy exterior. Input 2 is a color/material reference for its interior. Redesign both together in a single continuous side view. Use the references' pale stone and peach accents, black window frames, midnight navy lockers with small brushed bronze hardware, muted purple plants, and warm gold light. Render with crisp high-end hand-painted anime game environment art and atmospheric materials.

Across the image from left to right, use the first ~30% for the front gate courtyard, plum foliage, and brick-and-stone front facade. Use the next ~25% for a single wide open glass doorway and covered walk, showing the actual physical connection between outside and inside, with decorative plants kept behind the path. Use the remaining ~45% for a long dormitory hallway seen from the side, with indigo lockers, warm inset wall lights, doors and a few editorial details. Make the door threshold prominent enough to register when panning. Keep the composition orthographic-like and side-on, looking directly across the running lane at the long background wall. Build one uninterrupted walkable stone-to-tile floor across the lower 36% exactly aligned at the same elevation. Let the horizontal joints, floor reflections, baseboards, columns and window sill motion cues tell a story as the camera moves. The wall-floor seam is stable at around 65% from the top; use subtle horizontal perspective depth with consistent scale. Place enough variety of architectural details every quarter of the image so a narrow crop is identifiable and stays legible behind SD fighting sprites. Use lighter warm daylight outdoors and progressively deeper warm indoor tones. Populate the full width including both ends. No steps, incline, turn in the path, walls blocking the path, center vanishing point, wide-angle curving, split panels, cuts, borders, people, characters, signage text, symbols, UI, watermark, or logos. This is original level art, not concept art or a screenshot.

</details>
