# TRPG Online-Würfel

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Ein Online-Würfler für Tabletop-RPG-Runden. Würfle, speichere
wiederverwendbare Muster und teile Ergebnisse, Verlauf und Chat in
Echtzeit mit deiner Gruppe — alles von einer statischen Seite ohne
Backend.

**🎲 Live-Demo:** https://yamadar.github.io/trpg-dice-online/

## Funktionen

- **Würfel (A)** — wähle Anzahl und Typ vor jedem Wurf
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` würfelt zwei d10 als
  Stellen; `00` wird als 100 gelesen.
- **Modifikator (B)** — addiere einen vorzeichenbehafteten `+/-` Wert.
- **Art (C)** — `Schaden` oder `Probe`. Schaden zeigt
  `{Muster} {Wert} Schaden`; Probe zeigt
  `Ergebnis der Probe „{Muster}“: {Wert}`.
- **Charaktere** — verwalte mehrere Charaktere (Name, öffentlicher
  Hintergrund, private Notiz, optionales Porträt, Mustern-Liste sowie
  die pro Charakter gespeicherte Option „Notiz beim Export einschließen“)
  und exportiere/importiere sie als JSON.
- **Muster** — bündle A + B + C unter einem Namen pro Charakter und
  würfle gespeicherte Muster mit einem Klick.
- **Verlauf & Chat-Feed** — Würfe und Chat teilen sich einen
  chronologischen Feed mit Filter Alle / Würfe / Chat / Dateien.
- **Verlauf vergangener Räume** — jede vergangene Sitzung wird
  gespeichert; lies den Read-only-Feed aus der Lobby und lösche einzelne
  oder alle. Ein Tipp auf einen Namen zeigt die Charakter-Momentaufnahme
  und das zuletzt bekannte Porträt.
- **Online-Räume** — getrennte Erstellen-/Beitreten-Bildschirme mit
  einem Raumcode (mindestens 4 Zeichen; automatisch generierte sind 6).
  Verlauf, Chat und Spielerliste werden P2P geteilt; nach einem Reload
  hostet der SL automatisch neu bzw. tritt der Spieler automatisch wieder
  bei.
- **SL-Bedienelemente** — die SL bündelt Raumumbenennung und Code-Wechsel
  hinter einem Aufklapp-Bereich, und der Verlassen-Knopf heißt „Raum
  schließen“.
- **SL-verdeckte Würfe** — die SL kann den Wert verbergen; andere sehen
  nur, dass ein verdeckter Wurf stattfand.
- **Spielerfarben & Tippen-Anzeige** — jeder Teilnehmer bekommt eine
  stabile Farbe, und ein dezenter Indikator zeigt, wer gerade tippt.
- **Raumereignisse** — Beitritte/Austritte erscheinen im Feed, und das
  Schließen des Raums durch die SL wird allen sauber gemeldet.
- **Mehrsprachig & Auto-Übersetzung** — die Oberfläche unterstützt
  19 Sprachen. Die optionale Chat-Auto-Übersetzung zeigt Nachrichten
  anderer Spieler in deiner Oberflächensprache; sie bevorzugt die
  geräteinterne Chrome-Translator-API und fällt auf die schlüssellose
  [MyMemory](https://mymemory.translated.net/)-REST-API zurück. Tippe in
  einer übersetzten Nachricht auf „Original“, um den ursprünglich
  gesendeten Text zu sehen.

## So funktioniert das Teilen online

Die App nutzt **WebRTC-P2P-Verbindungen via [PeerJS](https://peerjs.com/)**.
Der Raum-Ersteller (SL) ist der Host; alle anderen verbinden sich direkt
mit der SL, die den gemeinsamen Zustand weiterleitet. Es laufen keine
Daten über einen eigenen Server. Da P2P, ist der Raum nur offen, solange
die SL die Seite offen hält.

## Tech-Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (Unit-Tests)
- GitHub Pages + GitHub Actions (Hosting)

## Entwicklung

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Dev-Server starten
npm test         # Tests ausführen
npm run lint     # Linting
npm run build    # Produktions-Build nach dist/
```

## Konfiguration (TURN-Relay)

WebRTC benötigt einen TURN-Relay, um Spieler zu verbinden, deren Netz UDP
blockiert oder symmetrisches NAT verwendet (häufig in öffentlichem WLAN).
Standardmäßig nutzt die App die kostenlosen öffentlichen TURN-Server des
Open Relay Project — für gelegentliche Nutzung ausreichend, aber „best
effort“. Für einen zuverlässigen Relay kopiere `.env.example` nach `.env`
und setze:

- `VITE_TURN_URLS` — kommagetrennte TURN-URLs. Nimm einen
  `turns:`-Eintrag über TCP/443 auf, damit es auch in Netzen mit
  blockiertem UDP funktioniert.
- `VITE_TURN_USERNAME` — TURN-Benutzername.
- `VITE_TURN_CREDENTIAL` — TURN-Zugangsdaten (Passwort).

**Sicherheitshinweis:** Vite bettet alle `VITE_*`-Variablen in den
Produktions-Bundle ein, sodass die hier gesetzten TURN-Zugangsdaten für
jeden sichtbar sind, der die Seite lädt. Verwende kurzlebige bzw.
ephemere TURN-Zugangsdaten (z. B. das Pattern der zeitlich begrenzten
Credentials per TURN-REST-API) und konfiguriere anbieterseitige
Beschränkungen – erlaubte Origins, IP-Filter oder monatliche Kontingente
–, um das Missbrauchsrisiko zu reduzieren. Langlebige
Produktions-Zugangsdaten nicht wiederverwenden.

Für den GitHub-Pages-Deploy füge sie als Repository-Secrets hinzu und gib
sie im Build-Schritt von `.github/workflows/deploy.yml` weiter. Kostenlose
Optionen sind der Free-Tarif von [Metered](https://www.metered.ca/) oder
das Selbsthosten von [coturn](https://github.com/coturn/coturn).

## Deployment

Ein Push auf `main` löst den GitHub-Actions-Workflow aus
(`.github/workflows/deploy.yml`): Lint, Tests, Build, Veröffentlichung
auf GitHub Pages. Der Base-Path in Produktion ist `/trpg-dice-online/`;
mit der Umgebungsvariable `BASE_PATH` änderst du ihn für anderes Hosting.

## Dokumentation

- Anforderungen & Plan: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Übersetzungs-API-Recherche: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Lizenz

[MIT](LICENSE) © 2026 yamadar
