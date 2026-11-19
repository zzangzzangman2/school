# 쉬는 시간의 왕!

해솔 격투 아카데미의 스무 살 신입생이 여성 동료들과 성장하며 전국 24지역에 도전하는 세로형 방치 RPG입니다. 등장인물은 모두 성인입니다.

## 실행

[실행용 HTML](outputs/recess-king.html)을 내려받아 브라우저로 열면 됩니다. 그림·글꼴·코드가 들어 있는 파일 하나이며 진행은 해당 브라우저에 저장됩니다. 설정에서 저장 파일을 내려받고 새 기기의 첫 화면에서 이어 할 수 있습니다.

![전투 화면](outputs/recess-king-preview.png)

## 현재 기능

- 자동 전투와 반복 수련, 보스 바로 재도전, 장비 장착·강화와 외형 색 적용
- 아카데미 12경기장, 전국 24지역, 전국 제패 후 방어전
- 여성 동료 16명, 최대 4명 편성, 고유 스킬과 무술 계열 시너지
- 방치 보상 기본 12시간·코칭 최대 16시간, 방치 중 자동 훈련, 하루 첫 빠른 휴식 무료
- 일일 목표·출석, 재화 던전·소탕, 주간 대회, 도장 30층, 기록전 무료 연습
- 동료 원정·무술 도감, 편성 저장, 달력형 시즌과 기간별 보상 기록

## 작업 위치

| 폴더 | 내용 |
| --- | --- |
| [work/recess](work/recess/) | 현재 게임 소스 |
| [work/recess/assets](work/recess/assets/) | 게임에서 사용하는 원화·전투 그림·배경·아이콘 |
| [work/gemini-art-brief.md](work/gemini-art-brief.md) | Gemini용 그림 요청 |
| [work/tools/art](work/tools/art/) | 현재 원화와 모션 제작 도구 |
| [work/tests](work/tests/) | 진행·전투·장비·그림·운영 검사 |
| [work/docs/art](work/docs/art/) | 현재 원화·모션의 규격과 인수인계 |
| [work/docs/research](work/docs/research/) | APK 분석과 콘텐츠 조사 |
| [outputs](outputs/) | 실행 파일과 전달용 최신 묶음 |

## 개발

```powershell
py -I work/package_recess.py
node work/tools/check-liveops.cjs
py -X utf8 work/tests/check_recess.py
py -X utf8 work/tests/check_recess_combat.py
py -X utf8 work/tests/check_recess_meta.py
py -X utf8 work/tests/check_recess_longterm.py
py -X utf8 work/tests/check_recess_wardrobe.py
py -X utf8 work/tests/check_recess_art.py
py -X utf8 work/tests/check_recess_play_art.py
```

화면 검사는 Python Playwright와 설치된 Chrome을 사용합니다. 검사 중 만드는 화면과 압축본 테스트 폴더는 운영체제 임시 폴더의 `haesol-qa`에 저장됩니다.

## 그림

여성 캐릭터 제작에는 Nikke DB 원화의 피부·머리카락·의상 질감을 참고하며, 귀여움·예쁨·청순함·섹시함을 인물별로 다양하게 구성합니다. [Nikke DB](https://nikke-db.pages.dev/)

글꼴은 넥슨 메이플스토리체를 사용합니다. 게임의 캐릭터·설정·그림은 이 프로젝트용으로 제작합니다.
