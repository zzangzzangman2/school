# 그림자 기사단 v55 APK 분석

휴대폰에 설치된 쿡앱스의 `com.cookapps.ShadowKnightsIdleRPG`를 분석했습니다. 버전 55, 버전 코드 1142, Unity 6000.0.59f2, ARM64 IL2CPP입니다. `base.apk`는 78,153,034바이트이고 `split_config.arm64_v8a.apk`는 37,406,001바이트입니다. 앱 보관 경로는 `C:/Users/godho/Documents/Codex/app-research/shadow-knights-v55`입니다. [공식 Google Play](https://play.google.com/store/apps/details?hl=ko&id=com.cookapps.ShadowKnightsIdleRPG)

## 전투와 동료 배치

`level1` 씬의 `Battle/PlayerSlots`에서 `FormationSlots`의 직렬화된 목록과 상위 오브젝트 기준 좌표를 읽었습니다. `BattleManager.StageStart`는 일반 스테이지 시작 경로에서 `FriendList`의 순번을 슬롯에 매핑하고, 군주 배치 경로에서 0번 슬롯을 참조합니다.

| 월드 슬롯 | X | Y |
|---|---:|---:|
| 0 | 0 | 0 |
| 1 | 3 | +1.5 |
| 2 | 3 | −1.5 |
| 3 | 3 | +0.75 |
| 4 | 3 | −0.75 |
| 5 | 4.5 | 0 |
| 6 | 4.5 | +1 |
| 7 | 4.5 | −1 |

좌표는 Unity 씬 단위입니다. 상위 오브젝트의 초기 위치는 `(-10, -0.5, 0)`이고 스테이지 시작 때 갱신됩니다. X가 큰 쪽이 진행 방향입니다. 같은 열에서는 Y를 양쪽으로 벌려 각 인물이 중앙에 몰리지 않도록 구성합니다.

- **전투 사이 이동**. `Entity.GotoWave_Update`는 자기 슬롯의 월드 좌표를 목표로 이동합니다. 영웅 그림자 초기화에도 월드 슬롯을 선택하는 경로가 있습니다.
- **실제 교전**. `ShadowFriendObject.Run_Update`와 `ShadowSoldierObject.Run_Update`는 RVO 이동과 회피를 사용합니다. 영웅과 병사 모두 목표와 거리에 따라 이동하고, 영웅 데이터에는 전사·탱커·마법사와 개별 공격 거리·이동 속도가 있습니다. 상태에는 이동, 공격, 스킬, 사망이 있습니다.
- **출전과 스킬 입력**. 같은 씬의 `UI_TopShadow` 아래에 영웅 카드 슬롯이 4개 있습니다. 버튼은 교체 모드에서 `ShadowManager.TryChange`로, 평상시에는 해당 영웅의 `TryUseSkill`로 이어집니다. 월드 좌표와 화면의 카드 슬롯은 서로 다른 데이터입니다.
- **전투 중 소환**. `BattleShadowManager.OnMonsterDeath`에서 처치 위치를 받아 병사 소환 코루틴에 넘깁니다. `ShadowFriendObject` 계열의 편성 영웅과 `ShadowSoldierObject` 계열의 전투 병사를 각각 관리합니다.
- **조합 성장**. 인연 데이터는 특정 영웅 묶음과 별 수 단계에 공격·체력 효과를 둡니다. 영웅 성장 화면에는 해금, 진급, 장비 경로가 각각 있습니다.

최대 편성 수와 해금 시점에는 버전·콘텐츠·진행 상태에 따른 조건이 있을 수 있습니다. 위 수치는 v55에 들어 있는 월드 좌표와 기본 HUD 오브젝트를 읽은 결과입니다.

## 해솔에 가져올 순서

1. **출전 번호가 실제 자리를 결정하게 합니다.** 현행 `work/recess/meta-ui.js`의 `renderAllies`는 빈칸을 걸러낸 뒤 순번으로 `ALLY_SLOTS`를 고릅니다. 그래서 1번을 비우면 2번의 그림이 1번 자리로 당겨집니다. 실제 `state.party` 인덱스를 위치에 대응시키고 전열 2칸과 후열 2칸을 동료 탭과 전투 화면에 같은 순서로 표시합니다. 재입학 전후에도 같은 출전 번호는 같은 자리여야 합니다.
2. **슬롯을 대기점으로 쓰고 공격할 때 앞으로 보냅니다.** 가까이 붙는 복싱·유도·레슬링 동료는 자신의 대기점에서 상대 앞쪽의 공격 위치로 이동해서 타격하고, 후퇴 프레임으로 복귀합니다. 후열에서 사용하는 회복·태극 기공은 대기점 근처에서 발동합니다. 새 6차 그림의 `step`, `windup`, `strike`, `follow`, `skill-a`, `skill-b`를 사용할 수 있습니다. 첫 버전에서는 기존 `ally`·`mate` 이벤트로 연출을 구성해 피해량, 스킬 쿨타임, 오프라인 계산을 유지합니다. 한 번에 여러 동료가 움직일 때는 서로 다른 접근 높이로 겹침을 줄입니다.
3. **전투에서 동료의 상태를 바로 보여줍니다.** 출전 카드 4칸에 초상, 전·후열, 남은 고유 스킬 시간과 발동 가능 여부를 표시합니다. 편성 모드에서 카드를 눌러 자리를 고르고, 평상시에는 동료 정보와 스킬 설명에 접근하도록 만듭니다. 수동 발동을 붙일 때는 자동 발동과 같은 쿨타임을 사용합니다.
4. **조각과 모집을 지역 첫 승리와 연결합니다.** 현재 보스 조각 드롭은 출전·보유 동료의 성급업에 사용합니다. 특정 지역을 처음 제패할 때 아직 모집하지 않은 여성 선수의 계약 조각을 고르는 보상을 추가하면 수집 경로가 늘어납니다. 전투 중 임시 지원은 지역 선수가 한 웨이브만 돕는 이벤트로 적용할 수 있습니다.

우선 1·2번을 적용한 뒤 320px와 390px 화면에서 빈 편성 칸, 4명 동시 출전, 동료 교체, 연속 스킬, 배속과 모션 줄이기를 확인합니다. UI의 위치 상태는 저장 데이터의 출전 칸과 따로 중복 저장할 필요가 없습니다.

## 확인한 자료

- 설치된 APK Manifest와 두 패키지의 SHA-256
- `level1`의 `PlayerSlots` Transform과 `FormationSlots` 목록 8개, `UI_TopShadowSlot` 오브젝트 4개
- `StageStart`, `Entity.GotoWave_Update`, `ShadowFriendObject.Run_Update`, `ShadowSoldierObject.Run_Update`, `UI_TopShadowSlot.OnClickSlot`, `BattleShadowManager.OnMonsterDeath`의 호출과 대상 필드
- `TBL_SHADOW`와 `TBL_SHADOWGROUP`의 필드 정의
