# TRPG 온라인 주사위

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

탁상용 TRPG 세션을 위한 온라인 주사위 굴리기. 주사위를 굴리고, 재사용
가능한 패턴을 저장하고, 결과·기록·채팅을 실시간으로 동료와 공유하세요.
백엔드 서버 없는 정적 사이트입니다.

**🎲 라이브 데모:** https://yamadar.github.io/trpg-dice-online/

## 주요 기능

- **주사위 (A)** — 굴리기 전에 매번 개수와 종류 선택
  (`D4, D6, D8, D10, D12, D20, D100`). `D100`은 d10 두 개를 자릿수로
  굴리며 `00`은 100으로 읽음.
- **보정 (B)** — 결과에 `+/-` 정수 보정 적용.
- **종류 (C)** — `데미지` 또는 `판정`. 데미지는 `{패턴} {값} 데미지`,
  판정은 `{패턴} 판정 결과 {값}`.
- **캐릭터** — 여러 캐릭터(이름·공개 배경·비공개 메모·선택 가능한
  포트레이트·패턴 목록·캐릭터별 「메모도 내보내기에 포함」 설정)를 관리
  하고 전환하며, JSON 파일로 내보내고 가져올 수 있음.
- **패턴** — A + B + C에 이름을 붙여 캐릭터별로 저장하고, 목록에서 한
  번에 굴리기.
- **기록과 채팅 피드** — 굴림과 채팅을 시간 순으로 한 피드에 통합,
  전체 / 굴림 / 채팅 / 파일로 필터.
- **지난 룸 기록** — 모든 과거 세션이 영구 저장되며, 로비에서 읽기 전용
  피드를 열람하고 세션 단위 또는 일괄 삭제 가능. 이름을 탭하면 당시
  캐릭터 스냅샷과 마지막으로 알려진 포트레이트 표시.
- **온라인 룸** — 만들기 / 참여 화면이 분리되어 있으며 4자 이상의 룸
  코드(자동 생성은 6자)로 연결. 기록·채팅·참여자 목록은 P2P로 공유되고,
  리로드 시 GM은 재호스트, 참여자는 자동 재접속.
- **GM 전용 설정** — 룸 이름과 코드 변경은 접힌 GM 섹션에 모이고, 종료
  버튼은 「룸 닫기」.
- **GM의 히든 롤** — GM은 결과를 가린 채 굴릴 수 있고, 다른 사람은 히든
  롤이 있었다는 사실만 봄.
- **참여자 색과 입력 표시** — 각 참여자에게 안정적인 색이 할당되고, 입력
  중 표시가 차분하게 나타남.
- **룸 이벤트** — 입퇴장 이벤트가 피드에 기록되고, GM이 룸을 닫으면 모든
  참여자에게 정확히 통지됨.
- **다국어 & 자동 번역** — UI는 19개 언어 지원. 선택형 자동 번역은 다른
  플레이어의 채팅을 UI 언어로 보여 줍니다. 기기 내 Chrome Translator
  API를 우선 사용하고, 사용할 수 없을 때는 키 없는
  [MyMemory](https://mymemory.translated.net/) REST API로 폴백합니다.
  번역된 메시지의 「원문」을 누르면 보낸 그대로의 내용을 확인할 수
  있습니다.

## 온라인 공유 방식

[PeerJS](https://peerjs.com/)를 통한 **WebRTC P2P 연결**을 사용합니다.
룸을 만든 사람(GM)이 호스트가 되고, 다른 참여자는 GM에 직접 연결됩니다.
프로젝트 소유의 서버를 거치는 데이터는 없습니다. P2P 방식이므로 룸은 GM
이 페이지를 열어 두는 동안에만 유효합니다.

## 기술 스택

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (단위 테스트)
- GitHub Pages + GitHub Actions (호스팅)

## 개발

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버
npm test         # 테스트 실행
npm run lint     # 린트
npm run build    # 프로덕션 빌드 (dist/)
```

## 설정 (TURN 릴레이)

UDP를 차단하거나 대칭형 NAT를 사용하는 네트워크(공공 Wi-Fi 등)에서도
연결하려면 WebRTC에는 TURN 릴레이가 필요합니다. 기본적으로는 Open Relay
Project의 무료 공개 TURN 서버로 폴백합니다 — 가벼운 사용에는 충분하지만
"best effort" 수준입니다. 안정적인 릴레이를 원한다면 `.env.example`을
`.env`로 복사한 뒤 다음을 설정하세요:

- `VITE_TURN_URLS` — 콤마로 구분된 TURN URL. UDP가 차단된 네트워크에서도
  동작하도록 TCP/443의 `turns:` 항목을 포함하세요.
- `VITE_TURN_USERNAME` — TURN 사용자 이름.
- `VITE_TURN_CREDENTIAL` — TURN 자격 증명(비밀번호).

GitHub Pages 배포에서 사용하려면 저장소 Secrets에 추가하고
`.github/workflows/deploy.yml`의 빌드 단계에서 전달하세요. 무료
옵션으로는 [Metered](https://www.metered.ca/) 무료 등급이나
[coturn](https://github.com/coturn/coturn) 자체 호스팅이 있습니다.

## 배포

`main` 브랜치 푸시가 GitHub Actions 워크플로
(`.github/workflows/deploy.yml`)를 실행해 린트·테스트·빌드 후 GitHub
Pages에 배포합니다. 프로덕션 베이스 경로는 `/trpg-dice-online/`이며,
다른 곳에 호스팅할 경우 `BASE_PATH` 환경 변수로 변경하세요.

## 문서

- 요구사항·구현 계획: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- 번역 API 조사: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## 라이선스

[MIT](LICENSE) © 2026 yamadar
