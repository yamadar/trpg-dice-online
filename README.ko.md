<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>TRPG의 밤에 어울리는, 주머니 속 주사위 방.</strong></p>

<p align="center">
  페이지를 열고 짧은 룸 코드를 공유하면 파티 전원이 함께 굴릴 수 있습니다 —<br/>
  계정도, 설치도, 게임 서버도 필요 없습니다. 링크와 주사위, 그것이면 충분합니다.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>라이브 데모 열기 →</strong></a>
</p>

<p align="center">
  <em><strong>언어:</strong></em>
  <a href="README.md">English</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.hi.md">हिन्दी</a> ·
  <a href="README.ar.md">العربية</a> ·
  <a href="README.uk.md">Українська</a>
</p>

<p align="center">
  <img src="public/images/lobby-mobile.png" width="280" alt="Dice & Chat 브랜드 마크가 보이는 스마트폰의 빈 로비" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="굴림과 채팅이 함께 흐르는 실시간 피드" />
</p>

## 다음 세션에 이것을 고를 이유

- **코드만 알려주면 굴리기 시작.** GM이 방을 만들고 4–6자 룸 코드를 읽어주면, 나머지는 입력만 하면 됩니다. 계정도 메일 인증도 가입 절차도 없습니다.
- **굴림은 너희들끼리.** 완전한 WebRTC P2P — 굴림과 채팅이 기기에서 기기로 직접 전달되며, 우리가 운영하는 어떤 서버도 거치지 않습니다.
- **테이블 위 스마트폰에 딱 맞습니다.** 모바일 우선 레이아웃, iOS와 Android에서 PWA로 설치 가능하고 전체화면으로 실행됩니다.
- **19개 언어를 지원하고 채팅을 자동 번역.** 독일어 클레릭이 일본어 로그와 농담을 주고받아도 누구의 몰입도 깨지지 않습니다.
- **다시 열고 싶어지도록 설계.** 캐릭터, 패턴, 테마, 글꼴 크기, 지난 세션까지 모두 기기에 저장됩니다. 공용 키오스크가 아니라 *내* 주사위 통처럼 느껴집니다.

## 30초 만에 세션 시작

1. **GM:** 데모를 열고 **룸 → 만들기**를 탭한 뒤 코드를 읽어주세요.
2. **플레이어:** 데모를 열고 **룸 → 입장**을 탭한 뒤 코드를 입력하세요.
3. **모두:** 굴리고, 떠들고, 첫 내추럴 20을 함께 환호하세요.

GM이 호스트입니다 — 그의 탭이 열려 있는 동안만 룸이 살아 있습니다. 탭을 닫으면 세션 종료 — 지난 룸은 로컬에 저장되어 있어 나중에 로그를 다시 읽을 수 있습니다.

## 주사위 통 속

### 한눈에 읽히는 주사위

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, 개수와 부호 있는 보정값, 그리고 **피해 / 판정** 종류를 선택하면 테이블에서 말하는 그대로 표시됩니다 — *"감지 판정 결과: 18"*, *"대검: 11 피해"*. 굴린 눈은 해당 주사위의 윤곽에 맞춘 작은 실루엣으로 보여 한눈에 읽힙니다.

### 패턴 — 단골 굴림은 원-탭으로

`2D6 + 3 — 피해`를 *"대검"* 같은 이름으로 저장하고, 다음 라운드에 한 번 탭으로 다시 굴리세요. 패턴은 캐릭터별로 관리되므로 같은 기기의 두 PC가 각자의 레퍼토리를 유지합니다.

### 초상화, 메모, 전용 패턴이 있는 캐릭터

한 플레이어가 여러 PC를 가질 수 있습니다. 각 캐릭터는 이름, 모두에게 공유되는 배경, 본인만 보는 비공개 메모, 선택적 초상화, 전용 패턴 목록, 그리고 *"내보낼 때 메모 포함"* 캐릭터별 설정을 가집니다. JSON으로 내보내 백업하고 다른 기기에서 불러와 다음 세션으로 PC를 가져갈 수 있습니다. 캐릭터로 행동 중일 때 이름은 `캐릭터명 (플레이어명)`으로 표시됩니다.

### 굴림과 채팅을 *한 줄*에서

굴림과 채팅이 하나의 타임라인에 시간순으로 모입니다. **전체 / 굴림 / 채팅 / 파일** 필터가 있고, `@` 멘션 자동완성은 대상 플레이어를 정확히 호출하며 `@all`은 전원에게 닿습니다. 채팅에 이미지를 첨부하면 보내기 전에 자동으로 축소됩니다.

### 다시 읽을 수 있는 지난 룸

지난 세션은 세션 단위로 영구 로그로 로컬에 보관됩니다. 로비에서 옛 룸을 읽기 전용으로 열 수 있고, 옛 로그의 플레이어 이름을 탭하면 당시 캐릭터 스냅샷과 마지막 초상화를 볼 수 있습니다. 룸 전체(채팅, 굴림, 이미지)를 단일 ZIP으로 내보낼 수 있습니다.

### GM 도구

GM은 **숨김 굴림**을 할 수 있습니다 — 다른 사람은 *"숨김 굴림이 있었다"*만 보고 숫자는 보지 못합니다. GM 섹션은 룸 이름 변경과 코드 재발급을 디스클로저 안에 모았고, GM의 퇴장 버튼은 **룸 닫기**로 표기되어 모두에게 세션이 끝남을 분명히 전달합니다.

### 19개 언어 UI &amp; 채팅 자동 번역

UI가 19개 언어로 제공됩니다. 선택형 채팅 자동 번역은 가능한 경우 디바이스의 Chrome Translator API를 우선 사용하고, 없으면 키 없이 사용할 수 있는 [MyMemory](https://mymemory.translated.net/) REST API로 폴백합니다. 번역된 메시지에서 **원문**을 탭하면 보낸 그대로의 문장을 볼 수 있습니다.

### 작지만 친절한 마무리

플레이어별 고정 색상, 은은한 타이핑 인디케이터, 입장 / 퇴장 이벤트가 피드에 표시, 테마 전환, 글꼴 크기 조절, GM이 룸을 닫을 때의 정중한 안내.

## 휴대폰에 설치 (PWA)

이 사이트는 Progressive Web App이라 iOS와 Android의 홈 화면에 추가해 전체화면 — 브라우저 UI 없이 — 으로 실행할 수 있습니다.

- **Android (Chrome):** 데모를 열고 브라우저 메뉴에서 **앱 설치** (또는 *홈 화면에 추가*) 선택.
- **iOS (Safari):** 데모를 열고 공유 버튼에서 **홈 화면에 추가** 선택.

서비스 워커가 앱 셸을 사전 캐시하므로 재실행이 매우 빠릅니다. 다만 룸 자체는 WebRTC P2P이므로 라이브 네트워크 연결이 필요합니다.

**화면 방향:** 매니페스트가 방향을 고정하거나 덮어쓰지 않으므로, 설치된 PWA는 기기의 자동 회전 / 회전 잠금 설정을 그대로 따릅니다(예: Android에서 자동 회전을 끄면 기기를 기울여도 앱은 현재 방향을 유지).

## 온라인 공유는 어떻게 동작하나요

룸은 [PeerJS](https://peerjs.com/)를 통해 **WebRTC P2P** 연결을 사용합니다. 룸 생성자(GM)가 호스트가 되고, 다른 플레이어들은 GM에 직접 연결합니다. GM이 공유 상태를 중계합니다. 이 프로젝트가 운영하는 서버를 거치는 게임 데이터는 없습니다. P2P이므로 룸은 GM이 탭을 열어 두는 동안에만 유지됩니다.

## 기술 스택

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P 룸)
- [Vitest](https://vitest.dev/) (단위 테스트)
- GitHub Pages + GitHub Actions (호스팅)

## 개발

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 시작
npm test         # 단위 테스트 실행
npm run lint     # 소스 lint
npm run build    # dist/ 로 프로덕션 빌드
```

## 설정 (TURN 릴레이, 선택)

WebRTC는 UDP가 차단되어 있거나 대칭형 NAT(카페·공공 Wi-Fi에서 흔함)인 네트워크에서 플레이어를 연결하기 위해 TURN 릴레이가 필요합니다. 기본값으로 Open Relay Project의 무료 공개 TURN 서버에 폴백합니다 — 가벼운 사용에는 충분하지만 best-effort입니다.

신뢰성 있는 릴레이를 사용하려면 `.env.example`을 `.env`로 복사하고 다음을 설정하세요:

- `VITE_TURN_URLS` — 쉼표로 구분된 TURN URL 목록. UDP가 차단된 환경에서도 닿도록 TCP/443의 `turns:` 항목을 포함하세요.
- `VITE_TURN_USERNAME` — TURN 사용자명.
- `VITE_TURN_CREDENTIAL` — TURN 자격증명 / 비밀번호.

> **보안 주의:** Vite는 모든 `VITE_*` 변수를 프로덕션 번들에 인라인하므로 여기 설정한 TURN 자격은 페이지를 여는 누구나 열람할 수 있는 상태가 됩니다. 단명 / 임시 TURN 자격(예: TURN REST API의 시간 제한 자격 패턴)을 사용하고, 공급자 측 제한(허용 오리진, IP 필터, 월 쿼터)을 함께 설정하세요. 장기 유효한 프로덕션 자격을 여기 재사용하지 마세요.

GitHub Pages 배포에서 사용하려면 위 값을 리포지토리 Secrets로 추가하고 `.github/workflows/deploy.yml` 빌드 단계에 전달하세요. 무료 옵션으로는 [Metered](https://www.metered.ca/)의 무료 플랜이나 [coturn](https://github.com/coturn/coturn) 셀프 호스팅이 있습니다.

## 배포

`main`에 푸시하면 GitHub Actions 워크플로우(`.github/workflows/deploy.yml`)가 실행되어 lint·테스트·빌드 후 GitHub Pages에 게시됩니다. 프로덕션 base path는 `/trpg-dice-online/`이며, 다른 곳에 호스팅한다면 `BASE_PATH` 환경변수로 덮어쓸 수 있습니다.

## 문서

- 요구사항·구현 계획: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- 실시간 번역 API 조사: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## 라이선스

[MIT](LICENSE) © 2026 yamadar
