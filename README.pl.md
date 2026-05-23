<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>Kieszonkowy pokój z kośćmi na wasz wieczór RPG.</strong></p>

<p align="center">
  Otwórzcie stronę, podajcie krótki kod pokoju — i cała drużyna rzuca kośćmi razem.<br/>
  Bez konta, bez instalacji, bez serwera gry. Tylko link i kości.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Otwórz demo na żywo →</strong></a>
</p>

<p align="center">
  <em><strong>Języki:</strong></em>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="Pusty lobby na telefonie z logotypem Dice & Chat" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Strumień na żywo z rzutami i czatem" />
</p>

## Dlaczego wybrać go na kolejną sesję

- **Podaj kod i rzucajcie.** MG tworzy pokój i czyta na głos 4–6-znakowy kod; reszta wpisuje. Bez konta, bez maila, bez rejestracji.
- **Wasze rzuty zostają między wami.** Czysty P2P po WebRTC — rzuty i czat idą bezpośrednio z urządzenia na urządzenie, nie przez żaden nasz serwer.
- **Pasuje do telefonu leżącego na stole.** Layout mobile-first, instalowalny jako PWA na iOS i Androidzie, otwiera się na pełen ekran.
- **Zna 19 języków i tłumaczy czat za was.** Niemiecka kapłanka może żartować z japońskim łotrzykiem, nikt nie wypada z klimatu.
- **Zaprojektowany, żebyście chcieli wrócić.** Postacie, szablony, motywy, rozmiar czcionki i poprzednie sesje zostają lokalnie — aplikacja czuje się jak *wasze* pudełko z kostkami, a nie wspólny kiosk.

## Sesja w 30 sekund

1. **MG:** otwórzcie demo, dotknijcie **Pokój → Utwórz**, odczytajcie kod.
2. **Gracze:** otwórzcie demo, dotknijcie **Pokój → Dołącz**, wpiszcie kod.
3. **Wszyscy:** rzucajcie, piszcie, wspólnie świętujcie pierwszą naturalną dwudziestkę.

MG jest hostem: dopóki jego karta jest otwarta, pokój żyje. Zamknięcie karty kończy sesję — minione pokoje zostają lokalnie, można potem przejrzeć log.

## W pudełku z kostkami

### Kości czytelne od pierwszego spojrzenia

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, z liczbą, modyfikatorem ze znakiem i typem **obrażenia / test**, który formułuje wynik tak, jak powiedziałby to stół — *„Wynik testu Spostrzegawczości: 18"*, *„Dwuręczny: 11 obrażeń"*. Każda wyrzucona ścianka wygląda jak mała sylwetka odpowiadająca kształtowi kości — czyta się ją od ręki.

### Szablony — ulubione zagrywki na jedno dotknięcie

Zapisz `2D6 + 3 — obrażenia` pod nazwą w stylu *„Dwuręczny"* i powtórz rzut w kolejnej rundzie jednym dotknięciem. Szablony należą do postaci, więc dwie BG na tym samym urządzeniu mają osobne zestawy.

### Postacie z portretem, notatkami i własnymi szablonami

Wielu BG na gracza. Każda ma imię, tło dzielone z pokojem, prywatną notatkę, którą widzicie tylko wy, opcjonalny portret, własną listę szablonów i preferencję *„dołącz notatkę do eksportu"* per postać. Eksport do JSON jako backup; import na innym urządzeniu, by zabrać BG na kolejną sesję. Gdy gracie postacią, imię pojawia się jako `Postać (Gracz)`.

### Jeden strumień na rzuty *i* czat

Rzuty i czat dzielą jedną linię czasu z filtrem **Wszystko / Rzuty / Czat / Pliki**. Autouzupełnianie `@` wskazuje właściwego gracza; `@all` dociera do wszystkich. Dodanie obrazu do wiadomości automatycznie zmniejszy go przed wysyłką.

### Minione pokoje do ponownej lektury

Każda przeszła sesja jest zapisywana lokalnie jako trwały log. Otwórzcie stary pokój z lobby w trybie tylko do odczytu; dotknięcie imienia w starym logu pokaże ówczesny snapshot postaci i ostatni znany portret. Cały pokój (czat, rzuty, obrazy) można wyeksportować jako jeden ZIP.

### Narzędzia MG

MG może rzucać **w ukryciu** — inni widzą tylko *„dokonano ukrytego rzutu"*, bez liczby. Sekcja MG zbiera też zmianę nazwy pokoju i regenerację kodu pod jednym rozwijaczem, a przycisk wyjścia MG nazywa się **Zamknij pokój** — jasno mówi, że to koniec sesji dla wszystkich.

### UI w 19 językach &amp; automatyczne tłumaczenie czatu

UI w 19 językach. Opcjonalne automatyczne tłumaczenie czatu używa Chrome Translator API na urządzeniu, jeśli jest, a w przeciwnym razie spada na bezkluczowe REST API [MyMemory](https://mymemory.translated.net/). Dotknij **Oryginał** na przetłumaczonej wiadomości, by zobaczyć, co dokładnie wysłano.

### Drobne usprawnienia

Stały kolor per gracz, dyskretny wskaźnik pisania, zdarzenia wejścia / wyjścia w strumieniu, wymienne motywy, regulowany rozmiar czcionki i uprzejme zachowanie, gdy MG zamyka pokój.

## Zainstaluj na telefonie (PWA)

Strona jest Progressive Web App — można dodać ją do ekranu głównego iOS i Androida i uruchamiać na pełnym ekranie, bez interfejsu przeglądarki, ze niemal natychmiastowym ponownym startem.

- **Android (Chrome):** otwórzcie demo, dotknijcie menu przeglądarki, wybierzcie **Zainstaluj aplikację** (lub *Dodaj do ekranu głównego*).
- **iOS (Safari):** otwórzcie demo, dotknijcie udostępniania, wybierzcie **Dodaj do ekranu głównego**.

Service worker pre-cache'uje powłokę aplikacji, więc kolejne uruchomienie jest niemal natychmiastowe. Same pokoje to jednak WebRTC P2P i wymagają aktywnej sieci.

**Orientacja ekranu:** manifest nie blokuje ani nie nadpisuje orientacji — zainstalowana PWA słucha ustawienia auto-obrotu / blokady obrotu urządzenia (np. na Androidzie z wyłączonym auto-obrotem aplikacja zostaje w obecnej orientacji nawet po przechyleniu telefonu).

## Jak działa współdzielenie online

Pokoje używają **WebRTC peer-to-peer** przez [PeerJS](https://peerjs.com/). Twórca pokoju (MG) jest hostem; każdy inny gracz łączy się bezpośrednio z MG, który przekazuje wspólny stan. Żadne dane gry nie przechodzą przez serwery tego projektu. Ponieważ jest to P2P, pokój jest otwarty tylko dopóki MG ma otwartą kartę.

## Stos technologiczny

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) do pokoi P2P na WebRTC
- [Vitest](https://vitest.dev/) do testów jednostkowych
- GitHub Pages + GitHub Actions jako hosting

## Rozwój

```bash
npm install      # zainstaluj zależności
npm run dev      # uruchom serwer deweloperski
npm test         # uruchom testy jednostkowe
npm run lint     # lint źródeł
npm run build    # build produkcyjny do dist/
```

## Konfiguracja (przekaźnik TURN, opcjonalnie)

WebRTC potrzebuje przekaźnika TURN do łączenia graczy, których sieć blokuje UDP lub używa symetrycznego NAT (typowe dla kawiarni / publicznego Wi-Fi). Domyślnie aplikacja spada na darmowe publiczne serwery TURN Open Relay Project — wystarczą do okazjonalnego użycia, ale best-effort.

Dla pewnego przekaźnika skopiuj `.env.example` do `.env` i ustaw:

- `VITE_TURN_URLS` — URL-e TURN oddzielone przecinkami. Dołącz wpis `turns:` na TCP/443, żeby działał tam, gdzie UDP jest zablokowany.
- `VITE_TURN_USERNAME` — użytkownik TURN.
- `VITE_TURN_CREDENTIAL` — dane uwierzytelniające / hasło TURN.

> **Uwaga o bezpieczeństwie:** Vite wstawia każdą zmienną `VITE_*` do bundla produkcyjnego, więc dane TURN ustawione tutaj są widoczne dla każdego, kto otworzy stronę. Używaj krótkotrwałych / efemerycznych danych TURN (np. wzorzec time-limited credential z TURN REST API) i skonfiguruj ograniczenia po stronie dostawcy — dozwolone originy, filtrowanie IP, miesięczne limity. Nie używaj tutaj długotrwałych produkcyjnych danych logowania.

Aby użyć ich w deploy na GitHub Pages, dodaj jako sekrety repozytorium i przekaż w kroku build w `.github/workflows/deploy.yml`. Darmowe opcje: darmowy plan [Metered](https://www.metered.ca/) lub self-hosting [coturn](https://github.com/coturn/coturn).

## Deploy

Push do `main` uruchamia workflow GitHub Actions (`.github/workflows/deploy.yml`), który robi lint, testy, build i publikuje na GitHub Pages. Produkcyjny base path to `/trpg-dice-online/`; nadpisz go zmienną środowiskową `BASE_PATH`, jeśli hostujesz gdzie indziej.

## Dokumentacja

- Wymagania i plan implementacji: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Lista zmian: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- Badania nad API tłumaczeń w czasie rzeczywistym: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licencja

[MIT](LICENSE) © 2026 yamadar
