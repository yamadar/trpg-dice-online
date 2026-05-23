<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>Der Würfeltisch für die Hosentasche — für eure TRPG-Runde.</strong></p>

<p align="center">
  Öffnet die Seite, teilt einen kurzen Raumcode und die ganze Runde würfelt zusammen —<br/>
  ohne Account, ohne Installation, ohne Spielserver. Nur der Link und die Würfel.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Live-Demo öffnen →</strong></a>
</p>

<p align="center">
  <em><strong>Sprachen:</strong></em>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="Leere Lobby auf einem Smartphone mit dem Dice & Chat-Logo" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Live-Feed mit Würfen und Chat" />
</p>

## Warum ihr es für die nächste Runde wählen solltet

- **Code teilen, würfeln.** Der SL legt einen Raum an und nennt den 4–6-stelligen Code; alle anderen tippen ihn ein. Keine Accounts, keine E-Mail-Bestätigung, keine Anmeldung.
- **Eure Würfe bleiben unter euch.** Reines Peer-to-Peer über WebRTC — Würfe und Chat laufen direkt von Gerät zu Gerät, nicht über irgendeinen unserer Server.
- **Passt aufs Handy am Tisch.** Mobile-First-Layout, installierbar als PWA auf iOS und Android, startet im Vollbild.
- **Spricht 19 Sprachen und übersetzt Chat für euch.** Die deutsche Klerikerin kann mit dem japanischen Schurken plaudern, ohne dass jemand aus der Immersion fällt.
- **Gebaut zum Wiederöffnen.** Charaktere, Vorlagen, Themes, Schriftgrößen und vergangene Runden bleiben lokal — die App fühlt sich an wie *eure* Würfelbox, nicht wie ein Kiosk.

## Eine Runde in 30 Sekunden starten

1. **SL:** Demo öffnen, **Raum → Erstellen** tippen, Code laut vorlesen.
2. **Spieler:innen:** Demo öffnen, **Raum → Beitreten** tippen, Code eintippen.
3. **Alle:** würfeln, chatten, den ersten natürlichen 20er gemeinsam feiern.

Der SL ist der Host: solange sein Tab offen bleibt, lebt der Raum. Tab schließen beendet die Session — vergangene Räume bleiben lokal gespeichert, sodass das Log später noch einmal gelesen werden kann.

## Was in der Würfelbox steckt

### Würfel, die man auf einen Blick liest

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, mit Anzahl, vorzeichenbehaftetem Modifikator und der Art **Schaden / Probe**, die das Ergebnis so formuliert, wie der Tisch es aussprechen würde — *„Ergebnis der Wahrnehmungsprobe: 18"*, *„Großschwert: 11 Schaden"*. Jede gewürfelte Zahl erscheint als kleine Silhouette, die zur Würfelform passt — direkt ablesbar.

### Vorlagen — Lieblingsaktionen auf einen Tap

Speichere `2D6 + 3 — Schaden` unter einem Namen wie *„Großschwert"* und löse es nächste Runde mit einem Tap erneut aus. Vorlagen gehören zu Charakteren — zwei PCs auf demselben Gerät behalten ihre eigenen Sets.

### Charaktere mit Porträt, Notizen und eigenen Vorlagen

Mehrere PCs pro Spieler:in. Jeder hat Name, geteilten Hintergrund, privaten Memo (nur du), optionales Porträt, eine eigene Vorlagenliste und eine pro-Charakter-Einstellung *„Memo in den Export aufnehmen"*. Export als JSON als Backup; Import auf einem anderen Gerät, um den PC zur nächsten Runde mitzunehmen. Wer als PC handelt, wird als `Charakter (Spieler)` angezeigt.

### Ein Feed für Würfe *und* Chat

Würfe und Chat teilen sich eine Zeitleiste, mit Filter **Alle / Würfe / Chat / Dateien**. `@`-Mention-Autocomplete pingt die richtige Person; `@all` erreicht alle. Ein Bild im Chat wird automatisch herunterskaliert, bevor es verschickt wird.

### Vergangene Räume zum Nachlesen

Jede vergangene Session wird lokal als beständiges Log gespeichert. Aus der Lobby können alte Räume im Lesemodus geöffnet werden; ein Tap auf einen Namen im alten Log zeigt das damalige Charakter-Snapshot und das letzte bekannte Porträt. Ein ganzer Raum (Chat, Würfe, Bilder) lässt sich als einzelnes ZIP exportieren.

### Werkzeuge für den SL

Der SL kann **verdeckt würfeln** — andere sehen nur *„ein verdeckter Wurf ist erfolgt"*, nicht die Zahl. Der SL-Bereich bündelt zudem Umbenennen des Raums und Code-Neugenerieren unter einer Disclosure, und der Verlassen-Button heißt **Raum schließen**, damit klar ist: das beendet die Session für alle.

### UI in 19 Sprachen &amp; Chat-Übersetzung

UI in 19 Sprachen. Die optionale automatische Chat-Übersetzung nutzt die On-Device Chrome Translator API, wenn verfügbar, und greift sonst auf die schlüssellose [MyMemory](https://mymemory.translated.net/) REST API zurück. Ein Tap auf **Original** zeigt die unübersetzte Nachricht.

### Kleine Annehmlichkeiten

Stabile Farbe pro Spieler:in, dezenter Tipp-Indikator, Beitritts- / Verlassens-Events im Feed, Theme-Wechsel, anpassbare Schriftgröße und freundliches Verhalten, wenn der SL den Raum schließt.

## Aufs Handy installieren (PWA)

Die Seite ist eine Progressive Web App — sie kann auf iOS und Android zum Homescreen hinzugefügt und im Vollbild gestartet werden, ohne Browser-UI, mit nahezu sofortigem Wiederstart.

- **Android (Chrome):** Demo öffnen, Browser-Menü antippen, **App installieren** (oder *Zum Startbildschirm hinzufügen*) wählen.
- **iOS (Safari):** Demo öffnen, auf Teilen tippen, **Zum Home-Bildschirm** wählen.

Ein Service Worker hält die App-Shell vorgehalten, damit sie sofort startet. Räume bleiben aber Peer-to-Peer über WebRTC und brauchen eine aktive Netzwerkverbindung.

**Bildschirmorientierung:** das Manifest sperrt oder überschreibt die Ausrichtung nicht — die installierte PWA folgt der Geräteeinstellung für Auto-Rotation / Rotationssperre (z. B. auf Android bleibt die App in ihrer aktuellen Ausrichtung, wenn Auto-Rotation deaktiviert ist).

## Wie das Online-Teilen funktioniert

Räume nutzen **WebRTC peer-to-peer** über [PeerJS](https://peerjs.com/). Die SL-Person ist der Host; alle anderen verbinden sich direkt mit dem SL, der den geteilten Zustand weiterreicht. Keine Spieldaten laufen über Server dieses Projekts. Da es P2P ist, bleibt der Raum nur offen, solange der SL den Tab offen hält.

## Tech-Stack

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) für WebRTC-P2P-Räume
- [Vitest](https://vitest.dev/) für Unit-Tests
- GitHub Pages + GitHub Actions als Hosting

## Entwicklung

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Dev-Server starten
npm test         # Unit-Tests ausführen
npm run lint     # Linter
npm run build    # Produktions-Build nach dist/
```

## Konfiguration (TURN-Relay, optional)

WebRTC braucht ein TURN-Relay, um Spieler:innen zu verbinden, deren Netzwerk UDP blockiert oder symmetrisches NAT verwendet (häufig in Café- oder Public-WLANs). Standardmäßig nutzt die App die kostenlosen öffentlichen TURN-Server des Open Relay Project — für gelegentlichen Gebrauch okay, aber Best-Effort.

Für einen verlässlichen Relay `.env.example` zu `.env` kopieren und setzen:

- `VITE_TURN_URLS` — kommagetrennte TURN-URLs. Inkl. einer `turns:`-Adresse auf TCP/443, damit es auch funktioniert, wenn UDP blockiert ist.
- `VITE_TURN_USERNAME` — TURN-Benutzername.
- `VITE_TURN_CREDENTIAL` — TURN-Zugangsdaten / Passwort.

> **Sicherheitshinweis:** Vite inlinet alle `VITE_*`-Variablen in das Produktions-Bundle — TURN-Zugangsdaten, die hier hinterlegt werden, sind für alle sichtbar, die die Seite laden. Verwende kurzlebige / temporäre TURN-Credentials (z. B. das Pattern für zeitlich begrenzte Credentials der TURN-REST-API) und konfiguriere serverseitige Limits — erlaubte Origins, IP-Filter oder Monatskontingente. Keine langlebigen Produktions-Credentials hier wiederverwenden.

Für das GitHub-Pages-Deployment als Repository-Secrets anlegen und im Build-Schritt von `.github/workflows/deploy.yml` durchreichen. Kostenfreie Optionen: das kostenlose Kontingent von [Metered](https://www.metered.ca/) oder Self-Hosting via [coturn](https://github.com/coturn/coturn).

## Deployment

Ein Push auf `main` löst den GitHub-Actions-Workflow (`.github/workflows/deploy.yml`) aus, der lintet, testet, baut und auf GitHub Pages veröffentlicht. Der Produktions-Base-Path ist `/trpg-dice-online/`; mit der Umgebungsvariable `BASE_PATH` überschreibbar.

## Dokumentation

- Anforderungen und Implementierungsplan: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Recherche zu Echtzeit-Übersetzungs-APIs: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Lizenz

[MIT](LICENSE) © 2026 yamadar
