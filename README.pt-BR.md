# Dice & Chat

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Um rolador de dados online para sessões de RPG de mesa. Role dados, salve
padrões reutilizáveis e compartilhe resultados, histórico e chat com seu
grupo em tempo real — tudo a partir de uma página estática, sem servidor.

**🎲 Demo:** https://yamadar.github.io/trpg-dice-online/

## Recursos

- **Dados (A)** — escolha quantidade e tipo a cada rolagem
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` rola dois d10 como dígitos; `00` vira 100.
- **Modificador (B)** — aplica um modificador `+/-` ao resultado.
- **Tipo (C)** — `dano` ou `teste`. Dano mostra `{padrão} {valor} de dano`;
  teste mostra `Resultado do teste {padrão}: {valor}`.
- **Personagens** — mantenha vários personagens (nome, histórico público,
  nota privada, retrato opcional, lista de padrões e a preferência «incluir
  a nota na exportação» por personagem), alterne entre eles e exporte/importe
  como JSON.
- **Padrões** — combine A + B + C com um nome e salve por personagem;
  role um padrão salvo com um clique.
- **Feed de histórico e chat** — rolagens e chat compartilham um único
  feed cronológico com filtro Tudo / Rolagens / Chat / Arquivos.
- **Histórico de salas anteriores** — toda sessão fica salva; veja o feed
  somente leitura no lobby e remova sessões individualmente ou tudo de
  uma vez. Tocar num nome mostra o instantâneo do personagem e o último
  retrato conhecido.
- **Salas online** — telas separadas de Criar / Entrar com um código de
  sala (mínimo 4 caracteres; os gerados automaticamente têm 6).
  Histórico, chat e lista de jogadores são compartilhados P2P; ao recarregar,
  o GM volta a hospedar e o jogador a entrar automaticamente.
- **Controles do mestre** — o mestre agrupa renomear sala e mudar código
  numa seção colapsável, e o botão de saída é «Fechar sala».
- **Rolagens ocultas do mestre** — o mestre pode esconder o valor; os
  outros só veem que uma rolagem oculta aconteceu.
- **Cores de jogador e indicador de digitação** — cada participante tem
  uma cor estável e um indicador discreto mostra quem está digitando.
- **Eventos de sala** — entrada/saída aparecem no feed, e fechar a sala
  como mestre notifica todos corretamente.
- **Multilíngue e tradução automática** — a UI suporta 19 idiomas. A
  tradução automática opcional exibe as mensagens de outras pessoas no seu
  idioma de interface; prefere a API Chrome Translator no dispositivo e
  recorre à API REST sem chave do
  [MyMemory](https://mymemory.translated.net/). Toque em «Original» em uma
  mensagem traduzida para ver o texto como foi enviado.

## Como o compartilhamento funciona

O app usa **conexões P2P WebRTC via [PeerJS](https://peerjs.com/)**. O
criador da sala (mestre) atua como host; os demais conectam diretamente
ao mestre, que retransmite o estado compartilhado. Nenhum dado passa por
servidores próprios do projeto. Por ser P2P, a sala fica aberta apenas
enquanto o mestre mantém a página aberta.

## Stack técnica

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (testes)
- GitHub Pages + GitHub Actions (hospedagem)

## Desenvolvimento

```bash
npm install      # instala dependências
npm run dev      # inicia o dev server
npm test         # roda os testes
npm run lint     # lint
npm run build    # build de produção em dist/
```

## Configuração (relay TURN)

O WebRTC precisa de um relay TURN para conectar quem está em uma rede que
bloqueia UDP ou usa NAT simétrico (comum em Wi-Fi público). Por padrão o
app usa os servidores TURN públicos gratuitos do Open Relay Project —
suficiente para uso ocasional, mas «best effort». Para um relay confiável,
copie `.env.example` para `.env` e defina:

- `VITE_TURN_URLS` — URLs TURN separadas por vírgula. Inclua uma entrada
  `turns:` em TCP/443 para funcionar onde UDP for bloqueado.
- `VITE_TURN_USERNAME` — usuário TURN.
- `VITE_TURN_CREDENTIAL` — credencial/senha TURN.

**Aviso de segurança:** O Vite incorpora todas as variáveis `VITE_*` no
bundle de produção, então qualquer credencial TURN definida aqui fica
visível para quem abrir a página. Para reduzir o risco de abuso, use
credenciais TURN efêmeras / de curta duração (por exemplo o padrão de
credenciais temporárias do TURN REST API) e aplique limites do provedor
— origens permitidas, filtragem por IP ou cotas mensais. Não reutilize
credenciais de produção de longa duração.

Para usá-las na implantação no GitHub Pages, adicione-as como segredos do
repositório e passe-as no passo de build em
`.github/workflows/deploy.yml`. Opções gratuitas: o plano grátis da
[Metered](https://www.metered.ca/) ou auto-hospedar o
[coturn](https://github.com/coturn/coturn).

## Implantação

Push para `main` dispara o workflow do GitHub Actions
(`.github/workflows/deploy.yml`), que faz lint, testa, builda e publica
no GitHub Pages. O base path em produção é `/trpg-dice-online/`;
sobrescreva com a variável `BASE_PATH` em outras hospedagens.

## Documentação

- Requisitos e plano: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Pesquisa sobre APIs de tradução: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licença

[MIT](LICENSE) © 2026 yamadar
