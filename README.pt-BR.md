<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>Uma sala de dados de bolso para a sua noite de RPG.</strong></p>

<p align="center">
  Abra a página, compartilhe um código curto de sala e o grupo todo pode rolar dados junto —<br/>
  sem contas, sem instalações, sem servidor de jogo. Só o link e os dados.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Abrir a demo ao vivo →</strong></a>
</p>

<p align="center">
  <em><strong>Idiomas:</strong></em>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="Tela inicial vazia em um celular com a marca Dice & Chat" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Feed ao vivo de rolagens e chat" />
</p>

## Por que escolher para a sua próxima sessão

- **Compartilhe um código e comece a rolar.** O Mestre cria uma sala e fala o código de 4–6 caracteres em voz alta; o resto digita. Sem contas, sem confirmação por e-mail, sem cadastro.
- **As suas rolagens ficam entre vocês.** P2P puro via WebRTC: rolagens e chat trafegam de um dispositivo a outro, não por nenhum servidor nosso.
- **Cabe no celular da mesa.** Layout mobile-first, instalável como PWA no iOS e no Android, abre em tela cheia.
- **Fala 19 idiomas e traduz o chat por você.** O clérigo alemão pode trocar piadas com o ladino japonês sem ninguém perder a imersão.
- **Feito para ser reaberto.** Personagens, padrões, temas, fontes e sessões passadas ficam salvos no seu dispositivo. O app se sente como *o seu* estojo de dados — não como um quiosque compartilhado.

## Comece uma sessão em 30 segundos

1. **Mestre:** abra a demo, toque em **Sala → Criar**, leia o código em voz alta.
2. **Jogadores:** abram a demo, toquem em **Sala → Entrar**, digitem o código.
3. **Todo mundo:** rolem, conversem, comemorem o primeiro 20 natural juntos.

O Mestre é o host: enquanto a aba dele estiver aberta, a sala fica viva. Fechando a aba a sessão termina — as salas passadas continuam salvas localmente para reler o log depois.

## O que vem no estojo

### Dados que se leem de um relance

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, com quantidade, modificador com sinal e um tipo **dano / teste** que apresenta o resultado como a mesa falaria — *"Resultado do teste de Percepção: 18"*, *"Espadão: 11 de dano"*. Cada face aparece como uma silhueta pequena do dado correspondente, então se lê na hora.

### Padrões — suas jogadas favoritas a um toque

Salve `2D6 + 3 — dano` sob um nome tipo *"Espadão"* e use de novo no turno seguinte com um toque. Padrões pertencem aos personagens, então dois PJs no mesmo dispositivo mantêm seus próprios repertórios.

### Personagens com retrato, anotações e padrões próprios

Vários PJs por jogador. Cada um tem nome, antecedente compartilhado, memo privado só seu, retrato opcional, lista de padrões e preferência *"incluir a memo na exportação"* individual. Exporte para JSON como backup; importe em outro dispositivo para levar o PJ à próxima sessão. Quando alguém está jogando um personagem, o nome aparece como `Personagem (Jogador)`.

### Um feed só para rolagens *e* chat

Rolagens e chat compartilham uma única linha do tempo com filtro **Tudo / Rolagens / Chat / Arquivos**. O autocomplete de `@` menciona o jogador certo; `@all` chega a todos. Anexar uma imagem no chat reduz automaticamente o tamanho antes de enviar.

### Salas antigas para reler

Toda sessão passada é guardada localmente como log permanente. Abra uma sala antiga pelo lobby em modo somente leitura; toque no nome de um jogador no log antigo para ver o snapshot do personagem e o último retrato conhecido. Exporte uma sala inteira (chat, rolagens, imagens) como um único ZIP.

### Ferramentas do Mestre

O Mestre pode rolar **às escondidas**: os outros só veem *"uma rolagem oculta aconteceu"*, não o número. A seção do Mestre também agrupa o renome da sala e a regeneração do código sob um disclosure, e o botão de saída do Mestre diz **Fechar sala** para deixar claro que termina a sessão para todo mundo.

### UI em 19 idiomas e tradução automática de chat

UI em 19 idiomas. A tradução automática de chat opcional usa a Chrome Translator API no dispositivo quando disponível e recorre à API REST sem chave do [MyMemory](https://mymemory.translated.net/). Toque em **Original** numa mensagem traduzida para ver exatamente o que foi enviado.

### Pequenos detalhes de uso

Cor fixa por jogador, indicador discreto de digitação, eventos de entrada / saída no feed, temas configuráveis, tamanho de fonte ajustável e comportamento gentil quando o Mestre fecha a sala.

## Instale no celular (PWA)

O site é um Progressive Web App, então pode ser adicionado à tela inicial no iOS e Android e aberto em tela cheia — sem barra do navegador e com reinicializações quase instantâneas.

- **Android (Chrome):** abra a demo, toque no menu do navegador e escolha **Instalar app** (ou *Adicionar à tela inicial*).
- **iOS (Safari):** abra a demo, toque em compartilhar e escolha **Adicionar à tela inicial**.

Um service worker faz pre-cache do shell do app para abrir na hora ao relançar, mas as salas continuam P2P por WebRTC e precisam de rede ativa.

**Orientação da tela:** o manifest não fixa nem sobrescreve a orientação, então o PWA instalado segue o ajuste de auto-rotação do dispositivo (por ex. no Android, se desativar o auto-rotação, o app fica na orientação atual).

## Como o modo online funciona

As salas usam **WebRTC peer-to-peer** via [PeerJS](https://peerjs.com/). O criador da sala (Mestre) é o host; cada outro jogador conecta direto no Mestre, que retransmite o estado compartilhado. Nenhum dado de jogo passa por servidores deste projeto. Por ser P2P, a sala só fica viva enquanto o Mestre mantiver a aba aberta.

## Stack técnica

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) para salas P2P sobre WebRTC
- [Vitest](https://vitest.dev/) para testes unitários
- GitHub Pages + GitHub Actions para hosting

## Desenvolvimento

```bash
npm install      # instala dependências
npm run dev      # sobe o dev server
npm test         # roda os testes unitários
npm run lint     # linter
npm run build    # build de produção em dist/
```

## Configuração (relay TURN, opcional)

WebRTC precisa de um relay TURN para conectar jogadores cujas redes bloqueiam UDP ou usam NAT simétrico (comum em Wi-Fi de cafeteria ou público). Por padrão o app usa os servidores TURN públicos gratuitos do Open Relay Project — bons para uso casual, mas best-effort.

Para um relay confiável, copie `.env.example` para `.env` e configure:

- `VITE_TURN_URLS` — URLs TURN separadas por vírgula. Inclua uma entrada `turns:` em TCP/443 para funcionar onde UDP está bloqueado.
- `VITE_TURN_USERNAME` — usuário TURN.
- `VITE_TURN_CREDENTIAL` — credencial / senha TURN.

> **Nota de segurança:** o Vite embute toda variável `VITE_*` no bundle de produção, então credenciais TURN configuradas aqui ficam visíveis para qualquer um que carregar a página. Use credenciais TURN efêmeras / de curta duração (por ex. o padrão de credenciais temporárias da TURN REST API) e configure limites do lado do provedor — origens permitidas, filtro de IP ou cotas mensais. Não reutilize aqui credenciais de produção duradouras.

Para usar isso no deploy do GitHub Pages, adicione como secrets do repositório e passe na etapa de build em `.github/workflows/deploy.yml`. Opções gratuitas incluem o plano grátis do [Metered](https://www.metered.ca/) ou auto-hospedar o [coturn](https://github.com/coturn/coturn).

## Deploy

Push para `main` dispara o workflow do GitHub Actions (`.github/workflows/deploy.yml`), que roda lint, testes, build e publica no GitHub Pages. O base path de produção é `/trpg-dice-online/`; sobrescreva com a variável de ambiente `BASE_PATH` se hospedar em outro lugar.

## Documentação

- Requisitos e plano de implementação: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Histórico de mudanças: [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- Pesquisa sobre APIs de tradução em tempo real: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licença

[MIT](LICENSE) © 2026 yamadar
