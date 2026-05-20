# Dice & Chat

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Rzut kośćmi online dla sesji RPG. Rzucaj kośćmi, zapisuj wielokrotnego
użytku szablony i dziel się wynikami, historią i czatem z drużyną w
czasie rzeczywistym — wszystko ze statycznej strony bez backendu.

**🎲 Demo na żywo:** https://yamadar.github.io/trpg-dice-online/

## Funkcje

- **Kości (A)** — wybierz liczbę i rodzaj przed każdym rzutem
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` rzuca dwie k10 jako cyfry;
  `00` odczytuje się jako 100.
- **Modyfikator (B)** — dodawanie/odejmowanie liczby całkowitej.
- **Rodzaj (C)** — `obrażenia` lub `próba`.
- **Postacie** — prowadź wiele postaci (imię, publiczne tło, prywatna
  notatka, opcjonalny portret, lista szablonów oraz indywidualne
  ustawienie "uwzględnij notatkę w eksporcie"); przełączaj się i
  eksportuj/importuj jako JSON.
- **Szablony** — łącz A + B + C pod nazwą i zapisuj dla postaci; rzucaj
  z listy jednym dotknięciem.
- **Strumień historii i czatu** — rzuty i czat w jednym chronologicznym
  strumieniu, filtr Wszystko / Rzuty / Czat / Pliki.
- **Historia poprzednich pokoi** — każda sesja jest zapisywana; w lobby
  możesz przeglądać tylko do odczytu i usuwać pojedyncze sesje lub
  wszystkie. Dotknięcie imienia pokazuje migawkę postaci i ostatni znany
  portret.
- **Pokoje online** — osobne ekrany Utwórz / Dołącz z kodem pokoju
  (min. 4 znaki; automatycznie tworzone mają 6). Historia, czat i lista
  graczy są synchronizowane P2P; po odświeżeniu MG ponownie hostuje, a
  gracz automatycznie się łączy.
- **Kontrolki MG** — zmiana nazwy i kodu pokoju ukryte są w zwijanej
  sekcji MG, a przycisk wyjścia to "Zamknij pokój".
- **Ukryte rzuty MG** — MG może ukryć wartość; pozostali widzą tylko, że
  doszło do ukrytego rzutu.
- **Kolory graczy i wskaźnik pisania** — każdy uczestnik ma stały kolor,
  a dyskretny wskaźnik pokazuje, kto pisze.
- **Zdarzenia pokoju** — wejścia/wyjścia trafiają do strumienia, a
  zamknięcie pokoju przez MG poprawnie powiadamia wszystkich.
- **Wielojęzyczność i automatyczne tłumaczenie** — interfejs obsługuje
  19 języków. Opcjonalne automatyczne tłumaczenie pokazuje wiadomości
  innych graczy w języku interfejsu; preferuje API Chrome Translator na
  urządzeniu i przechodzi na REST API
  [MyMemory](https://mymemory.translated.net/) bez klucza, gdy nie jest
  dostępne. Dotknij „Oryginał” na przetłumaczonej wiadomości, aby
  zobaczyć tekst tak, jak został wysłany.

## Jak działa udostępnianie

Aplikacja używa **połączeń WebRTC P2P przez [PeerJS](https://peerjs.com/)**.
Twórca pokoju (MG) działa jako host; pozostali łączą się bezpośrednio z
MG, który przekazuje współdzielony stan. Żadne dane nie trafiają na
serwer należący do projektu. Ponieważ jest to P2P, pokój żyje tylko gdy
strona MG jest otwarta.

## Stos technologiczny

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (testy jednostkowe)
- GitHub Pages + GitHub Actions (hosting)

## Rozwój

```bash
npm install      # instalacja zależności
npm run dev      # serwer dev
npm test         # uruchom testy
npm run lint     # lint
npm run build    # produkcyjny build w dist/
```

## Konfiguracja (przekaźnik TURN)

WebRTC potrzebuje przekaźnika TURN, aby łączyć graczy w sieci blokującej
UDP albo używającej NAT symetrycznego (typowe w publicznym Wi-Fi).
Domyślnie aplikacja używa darmowych publicznych serwerów TURN Open Relay
Project — wystarczających do okazjonalnego użytku, ale „best effort”. Dla
niezawodnego przekaźnika skopiuj `.env.example` do `.env` i ustaw:

- `VITE_TURN_URLS` — adresy TURN oddzielone przecinkami. Dodaj wpis
  `turns:` przez TCP/443, by działało także w sieciach z zablokowanym
  UDP.
- `VITE_TURN_USERNAME` — nazwa użytkownika TURN.
- `VITE_TURN_CREDENTIAL` — dane uwierzytelniające TURN (hasło).

**Uwaga bezpieczeństwa:** Vite wstawia każdą zmienną `VITE_*` bezpośrednio
do produkcyjnego bundle'a, dlatego dane logowania TURN ustawione tutaj
są widoczne dla każdego, kto otworzy stronę. Aby ograniczyć ryzyko
nadużyć, używaj krótkotrwałych / efemerycznych poświadczeń TURN
(np. wzorzec poświadczeń z ograniczonym czasem życia z TURN REST API)
oraz limitów po stronie dostawcy — dozwolone originy, filtrowanie IP,
kwoty miesięczne. Nie używaj tu ponownie długoterminowych poświadczeń
produkcyjnych.

Aby użyć ich we wdrożeniu na GitHub Pages, dodaj je jako sekrety
repozytorium i przekaż w kroku build w `.github/workflows/deploy.yml`.
Darmowe opcje: darmowy plan [Metered](https://www.metered.ca/) lub
samodzielne hostowanie [coturn](https://github.com/coturn/coturn).

## Wdrożenie

Push do `main` uruchamia workflow GitHub Actions
(`.github/workflows/deploy.yml`): lint, testy, build i publikacja na
GitHub Pages. Base path w produkcji to `/trpg-dice-online/`; nadpisz go
zmienną środowiskową `BASE_PATH` przy hostingu gdzie indziej.

## Dokumentacja

- Wymagania i plan: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Badania nad API tłumaczeń: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licencja

[MIT](LICENSE) © 2026 yamadar
