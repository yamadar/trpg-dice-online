# TRPG Dados en línea

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Un lanzador de dados en línea para partidas de rol de mesa. Tira dados,
guarda patrones reutilizables y comparte resultados, historial y chat con
tu grupo en tiempo real — todo desde una página estática sin servidor.

**🎲 Demo en vivo:** https://yamadar.github.io/trpg-dice-online/

## Características

- **Dados (A)** — elige la cantidad y el tipo en cada tirada
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` tira dos d10 como dígitos; `00` se lee como 100.
- **Modificador (B)** — aplica un modificador `+/-` al resultado.
- **Tipo (C)** — `daño` o `prueba`. El daño muestra `{patrón} {valor} de daño`;
  la prueba muestra `Resultado de la prueba {patrón}: {valor}`.
- **Personajes** — guarda varios personajes (nombre, trasfondo público,
  nota privada, retrato opcional, lista de patrones y la preferencia de
  «incluir nota al exportar» por personaje), cambia entre ellos y
  expórtalos/impórtalos como JSON.
- **Patrones** — agrupa A + B + C con un nombre y guárdalos por personaje;
  tira un patrón guardado con un solo clic.
- **Feed de historial y chat** — las tiradas y el chat se combinan en un
  único feed cronológico con filtro Todo / Tiradas / Chat / Archivos.
- **Historial de salas pasadas** — cada sesión pasada se guarda; consulta
  el feed de solo lectura desde el lobby y borra sesiones individual o
  totalmente. Tocar un nombre muestra la instantánea del personaje y el
  último retrato conocido.
- **Salas en línea** — pantallas separadas de Crear / Unirse con un código
  de sala (mínimo 4 caracteres; los autogenerados son de 6). Historial,
  chat y lista de jugadores se comparten P2P; al recargar se vuelve a
  hospedar (GM) o a unir (jugador) automáticamente.
- **Controles de GM** — el GM agrupa los cambios de nombre y código tras
  un desplegable colapsado, y su salida se llama «Cerrar sala».
- **Tiradas ocultas del GM** — el GM puede ocultar el valor; los demás
  solo ven que se hizo una tirada oculta.
- **Colores de jugador y aviso de escritura** — cada participante recibe
  un color estable y un indicador discreto muestra quién está escribiendo.
- **Conciencia de sala** — los eventos de entrada/salida aparecen en el
  feed y, al cerrarla, el GM lo notifica correctamente a todos.
- **Multilingüe y traducción automática** — la UI soporta 19 idiomas. La
  traducción automática opcional muestra los mensajes de otras personas en
  tu idioma de interfaz; prefiere la API Chrome Translator del dispositivo
  y vuelve a la API REST sin clave de
  [MyMemory](https://mymemory.translated.net/). Toca «Original» en un
  mensaje traducido para ver lo que se envió.

## Cómo funciona la sincronización

La app usa **conexiones WebRTC P2P mediante [PeerJS](https://peerjs.com/)**.
El creador de la sala (GM) actúa como host; los demás se conectan
directamente a él, que retransmite el estado compartido. Ningún dato
pasa por servidores propios del proyecto. Al ser P2P, la sala permanece
abierta solo mientras el GM tenga la página abierta.

## Stack técnico

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (pruebas unitarias)
- GitHub Pages + GitHub Actions (hosting)

## Desarrollo

```bash
npm install      # instala dependencias
npm run dev      # arranca el dev server
npm test         # ejecuta las pruebas
npm run lint     # lint
npm run build    # build de producción a dist/
```

## Configuración (relé TURN)

WebRTC necesita un relé TURN para conectar a quienes están en una red que
bloquea UDP o usa NAT simétrica (común en Wi-Fi públicas). De forma
predeterminada la app usa los servidores TURN públicos gratuitos del Open
Relay Project — suficiente para uso ocasional pero «best effort». Para un
relé fiable, copia `.env.example` a `.env` y define:

- `VITE_TURN_URLS` — URLs TURN separadas por comas. Incluye una entrada
  `turns:` por TCP/443 para que funcione donde UDP esté bloqueado.
- `VITE_TURN_USERNAME` — usuario TURN.
- `VITE_TURN_CREDENTIAL` — credencial/contraseña TURN.

Para usarlas en el despliegue de GitHub Pages, agrégalas como secretos del
repositorio y pásalas en el paso de build de
`.github/workflows/deploy.yml`. Opciones gratuitas: el plan gratuito de
[Metered](https://www.metered.ca/) o autoalojar
[coturn](https://github.com/coturn/coturn).

## Despliegue

Empujar a `main` activa el workflow de GitHub Actions
(`.github/workflows/deploy.yml`), que pasa lint, pruebas, build y publica
en GitHub Pages. La base path es `/trpg-dice-online/`; cámbiala con la
variable de entorno `BASE_PATH` al hospedar en otro sitio.

## Documentación

- Requisitos y plan de implementación: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Investigación de APIs de traducción: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licencia

[MIT](LICENSE) © 2026 yamadar
