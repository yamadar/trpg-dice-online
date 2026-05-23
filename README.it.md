<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>Una stanza dei dadi tascabile per la tua serata di GdR.</strong></p>

<p align="center">
  Apri la pagina, condividi un breve codice della stanza e tutto il gruppo tira insieme —<br/>
  niente account, niente installazioni, niente server di gioco. Solo il link e i dadi.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Apri la demo live →</strong></a>
</p>

<p align="center">
  <em><strong>Lingue:</strong></em>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="Atrio vuoto su uno smartphone con il marchio Dice & Chat" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Un flusso in tempo reale di tiri e chat" />
</p>

## Perché sceglierlo per la prossima sessione

- **Condividi un codice e si tira.** Il GM crea una stanza e legge il codice di 4–6 caratteri ad alta voce; gli altri lo digitano. Niente account, niente conferme via email, niente da registrare.
- **I tiri restano tra voi.** P2P puro su WebRTC: tiri e chat viaggiano direttamente da un dispositivo all'altro, senza passare da alcun nostro server.
- **A suo agio sul telefono al tavolo.** Layout mobile-first, installabile come PWA su iOS e Android, parte a schermo intero.
- **Parla 19 lingue e traduce la chat per voi.** La chierica tedesca può scherzare con il ladro giapponese senza che nessuno esca dall'immersione.
- **Pensato per essere riaperto.** Personaggi, pattern, temi, dimensioni font e sessioni passate restano in locale: l'app sembra *la tua* scatola dei dadi, non un chiosco condiviso.

## Avvia una sessione in 30 secondi

1. **GM:** apri la demo, tocca **Stanza → Crea**, leggi il codice ad alta voce.
2. **Giocatori:** aprite la demo, toccate **Stanza → Entra**, digitate il codice.
3. **Tutti:** tirate, chattate, festeggiate insieme il primo 20 naturale.

Il GM è l'host: finché la sua scheda resta aperta, la stanza è viva. Chiudere la scheda termina la sessione — le stanze passate restano salvate in locale per rileggere il log più avanti.

## Cosa c'è nella scatola dei dadi

### Dadi che si leggono al volo

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, con quantità, modificatore con segno e un tipo **danno / prova** che esprime il risultato come direbbe il tavolo — *"Risultato della prova di Percezione: 18"*, *"Spadone: 11 danni"*. Ogni faccia appare come una piccola silhouette del dado corrispondente, leggibile a colpo d'occhio.

### Pattern — le tue mosse preferite in un tap

Salva `2D6 + 3 — danno` con un nome come *"Spadone"* e rigiocalo al turno dopo con un tap. I pattern appartengono ai personaggi, quindi due PG sullo stesso dispositivo mantengono ognuno i propri.

### Personaggi con ritratto, memo e pattern dedicati

Più PG per giocatore. Ognuno ha nome, background condiviso, memo privato che vede solo tu, ritratto opzionale, lista di pattern e preferenza individuale *"includi il memo nell'export"*. Esporta in JSON per backup; importa su un altro dispositivo per portare il PG alla prossima sessione. Quando si interpreta un personaggio, il nome appare come `Personaggio (Giocatore)`.

### Un solo flusso per tiri *e* chat

Tiri e chat condividono un'unica timeline con un filtro **Tutto / Tiri / Chat / File**. L'autocomplete `@` cita il giocatore giusto; `@all` raggiunge tutti. Allegare un'immagine alla chat la ridimensiona automaticamente prima dell'invio.

### Stanze passate da rileggere

Ogni sessione passata viene salvata in locale come log permanente. Apri una stanza vecchia dall'atrio in sola lettura; tocca un nome nel vecchio log per vedere lo snapshot del personaggio e l'ultimo ritratto conosciuto. Esporta un'intera stanza (chat, tiri, immagini) come un singolo ZIP.

### Strumenti per il GM

Il GM può tirare **nascosto**: gli altri vedono solo *"è stato fatto un tiro nascosto"*, non il numero. La sezione GM raccoglie anche rinomina stanza e rigenerazione codice dietro una disclosure, e il pulsante di uscita del GM si chiama **Chiudi stanza** per chiarire che termina la sessione per tutti.

### UI in 19 lingue &amp; chat auto-tradotta

UI in 19 lingue. La traduzione automatica della chat (opzionale) usa la Chrome Translator API sul dispositivo quando disponibile e ricade sulla REST API senza chiave di [MyMemory](https://mymemory.translated.net/). Tocca **Originale** su un messaggio tradotto per vedere esattamente cos'è stato inviato.

### Piccoli tocchi di qualità della vita

Colore stabile per ogni giocatore, indicatore di digitazione discreto, eventi di ingresso / uscita nel flusso, temi configurabili, dimensione font regolabile e gestione cordiale quando il GM chiude la stanza.

## Installa sul telefono (PWA)

Il sito è una Progressive Web App, quindi può essere aggiunto alla schermata Home su iOS e Android e avviato a schermo intero — senza barra del browser, con riavvii quasi istantanei.

- **Android (Chrome):** apri la demo, tocca il menu del browser, scegli **Installa app** (o *Aggiungi alla schermata Home*).
- **iOS (Safari):** apri la demo, tocca condividi, scegli **Aggiungi a Home**.

Un service worker pre-carica lo shell dell'app per un riavvio istantaneo, ma le stanze restano P2P via WebRTC e richiedono una connessione attiva.

**Orientamento schermo:** il manifest non blocca né sovrascrive l'orientamento — la PWA installata segue le impostazioni di rotazione automatica / blocco del dispositivo (es. su Android, se disattivi la rotazione automatica, l'app resta nell'orientamento attuale).

## Come funziona la condivisione online

Le stanze usano **WebRTC peer-to-peer** tramite [PeerJS](https://peerjs.com/). Il creatore della stanza (GM) è l'host; ogni altro giocatore si connette direttamente al GM, che inoltra lo stato condiviso. Nessun dato di gioco passa da server gestiti da questo progetto. Essendo P2P, la stanza resta aperta solo finché il GM tiene la sua scheda aperta.

## Stack tecnico

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) per stanze P2P su WebRTC
- [Vitest](https://vitest.dev/) per i test unitari
- GitHub Pages + GitHub Actions per l'hosting

## Sviluppo

```bash
npm install      # installa le dipendenze
npm run dev      # avvia il dev server
npm test         # esegue i test unitari
npm run lint     # lint del sorgente
npm run build    # build di produzione in dist/
```

## Configurazione (relay TURN, opzionale)

WebRTC ha bisogno di un relay TURN per collegare giocatori la cui rete blocca UDP o usa NAT simmetrico (comune sul Wi-Fi di bar / pubblico). Di default l'app ricade sui server TURN pubblici gratuiti di Open Relay Project — vanno bene per uso casuale ma sono best-effort.

Per un relay affidabile, copia `.env.example` in `.env` e imposta:

- `VITE_TURN_URLS` — URL TURN separati da virgola. Includi una voce `turns:` su TCP/443 per funzionare dove UDP è bloccato.
- `VITE_TURN_USERNAME` — username TURN.
- `VITE_TURN_CREDENTIAL` — credenziale / password TURN.

> **Nota di sicurezza:** Vite inlinea ogni variabile `VITE_*` nel bundle di produzione, quindi le credenziali TURN configurate qui sono visibili a chiunque carichi la pagina. Usa credenziali TURN effimere / a breve durata (es. il pattern di credenziali a tempo della TURN REST API) e configura limiti lato provider — origini consentite, filtro IP o quote mensili. Non riutilizzare qui credenziali di produzione di lunga durata.

Per usarle nel deploy GitHub Pages, aggiungile come secret del repository e passale allo step di build in `.github/workflows/deploy.yml`. Opzioni gratuite includono il piano free di [Metered](https://www.metered.ca/) o il self-host di [coturn](https://github.com/coturn/coturn).

## Deploy

Un push su `main` attiva il workflow GitHub Actions (`.github/workflows/deploy.yml`), che fa lint, test, build e pubblica su GitHub Pages. Il base path di produzione è `/trpg-dice-online/`; sovrascrivilo con la variabile d'ambiente `BASE_PATH` per ospitarlo altrove.

## Documentazione

- Requisiti e piano d'implementazione: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Ricerca su API di traduzione real-time: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licenza

[MIT](LICENSE) © 2026 yamadar
