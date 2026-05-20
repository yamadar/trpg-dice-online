# TRPG Dadi online

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Un lanciatore di dadi online per sessioni di GdR. Tira i dadi, salva
modelli riusabili e condividi risultati, cronologia e chat con il tuo
gruppo in tempo reale — tutto da una pagina statica senza backend.

**🎲 Demo:** https://yamadar.github.io/trpg-dice-online/

## Caratteristiche

- **Dadi (A)** — scegli quantità e tipo a ogni tiro
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` tira due d10 come cifre;
  `00` vale 100.
- **Modificatore (B)** — somma/sottrae un modificatore intero.
- **Categoria (C)** — `danno` o `prova`. Danno: `{modello}: {valore} di
  danno`; prova: `Risultato della prova {modello}: {valore}`.
- **Personaggi** — gestisci più personaggi (nome, background pubblico,
  memo privata, ritratto opzionale, lista dei modelli e preferenza per
  personaggio «includi la memo nell'export»); cambia personaggio ed
  esporta/importa come JSON.
- **Modelli** — combina A + B + C con un nome e salva per personaggio;
  tira un modello salvato con un clic.
- **Feed cronologia e chat** — tiri e chat condividono un unico feed
  con filtro Tutto / Tiri / Chat / File.
- **Cronologia delle stanze passate** — ogni sessione passata viene
  salvata; consulta il feed di sola lettura dalla lobby e cancella per
  sessione o tutto in blocco. Toccare un nome mostra lo snapshot del
  personaggio e l'ultimo ritratto noto.
- **Stanze online** — schermate separate Crea / Unisciti con un codice
  stanza (minimo 4 caratteri; quelli generati ne hanno 6). Cronologia,
  chat e lista giocatori sono condivise P2P; al ricarico il GM ri-ospita
  e il giocatore si riunisce automaticamente.
- **Comandi GM** — il GM raccoglie rinomina stanza e cambio codice
  dentro una sezione collassabile, e il pulsante di uscita è «Chiudi
  stanza».
- **Tiri nascosti del GM** — il GM può nascondere il valore; gli altri
  vedono solo che è avvenuto un tiro nascosto.
- **Colori per giocatore e indicatore di digitazione** — ciascun
  partecipante ha un colore stabile e un indicatore discreto mostra chi
  sta scrivendo.
- **Eventi di stanza** — entrate/uscite appaiono nel feed, e chiudere
  la stanza come GM avvisa tutti correttamente.
- **Multilingue** — l'interfaccia supporta 19 lingue.

## Come funziona la condivisione

L'app usa **connessioni P2P WebRTC tramite [PeerJS](https://peerjs.com/)**.
Il creatore della stanza (GM) fa da host; tutti gli altri si connettono
direttamente al GM, che inoltra lo stato condiviso. Nessun dato passa
per server di proprietà del progetto. Essendo P2P, la stanza resta
aperta solo finché il GM tiene la pagina aperta.

## Stack tecnico

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (test unitari)
- GitHub Pages + GitHub Actions (hosting)

## Sviluppo

```bash
npm install      # installa le dipendenze
npm run dev      # avvia il dev server
npm test         # esegue i test
npm run lint     # lint
npm run build    # build di produzione in dist/
```

## Deploy

Un push su `main` attiva il workflow di GitHub Actions
(`.github/workflows/deploy.yml`): lint, test, build e pubblicazione su
GitHub Pages. Il base path in produzione è `/trpg-dice-online/`; cambialo
con la variabile d'ambiente `BASE_PATH` per altri hosting.

## Documentazione

- Requisiti e piano: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Ricerca sulle API di traduzione: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licenza

[MIT](LICENSE) © 2026 yamadar
