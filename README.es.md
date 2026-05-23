<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>Una sala de dados de bolsillo para tu noche de rol.</strong></p>

<p align="center">
  Abre la página, comparte un código corto de sala y todo el grupo puede tirar dados juntos —<br/>
  sin cuentas, sin instalaciones, sin servidor de juego. Solo el enlace y los dados.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Abrir la demo en vivo →</strong></a>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="Vestíbulo vacío en un teléfono con la marca Dice & Chat" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Un flujo en vivo de tiradas y chat" />
</p>

## Por qué elegirlo para tu próxima partida

- **Comparte un código y empezad a tirar.** El DJ crea una sala y lee el código de 4–6 caracteres en voz alta; los demás lo teclean. Sin cuentas, sin confirmaciones por correo, sin registro.
- **Las tiradas se quedan entre vosotros.** P2P puro sobre WebRTC: tiradas y chat viajan de un dispositivo a otro, no a través de ningún servidor nuestro.
- **A gusto en el móvil de la mesa.** Diseño mobile-first, instalable como PWA en iOS y Android, se abre a pantalla completa.
- **Habla 19 idiomas y traduce el chat por ti.** La clériga alemana puede bromear con el pícaro japonés sin que nadie rompa la inmersión.
- **Pensado para volver a abrirlo.** Personajes, patrones, temas, tipografías y partidas pasadas se guardan en tu dispositivo; la app se siente como *tu* caja de dados, no como un quiosco compartido.

## Empieza una partida en 30 segundos

1. **DJ:** abre la demo, pulsa **Sala → Crear**, lee el código en voz alta.
2. **Jugadores:** abrid la demo, pulsad **Sala → Unirse**, teclead el código.
3. **Todos:** tirad, chatead, celebrad el primer 20 natural juntos.

El DJ es el host: mientras su pestaña esté abierta, la sala estará viva. Al cerrar la pestaña termina la sesión — las salas pasadas quedan guardadas localmente para releer el registro más tarde.

## Lo que hay en la caja de dados

### Dados que se leen de un vistazo

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, con cantidad, modificador con signo y un tipo **daño / chequeo** que redacta el resultado como lo diría la mesa — *"Resultado del chequeo de Percepción: 18"*, *"Espadón: 11 de daño"*. Cada cara aparece como una pequeña silueta del dado, así se interpreta al instante.

### Patrones — tus jugadas habituales, a un toque

Guarda `2D6 + 3 — daño` con un nombre como *"Espadón"* y vuelve a usarlo en el siguiente turno con un toque. Los patrones pertenecen a cada personaje, así que dos PJ en el mismo dispositivo conservan su propio repertorio.

### Personajes con retrato, notas y patrones propios

Varios PJ por jugador. Cada uno tiene nombre, trasfondo compartido, memo privado que solo tú ves, retrato opcional, lista de patrones y una preferencia individual *"incluir la memo en la exportación"*. Exporta a JSON para hacer copia de seguridad; importa en otro dispositivo para llevar el PJ a la próxima sesión. Cuando alguien actúa como personaje, su nombre aparece como `Personaje (Jugador)`.

### Un único flujo para tiradas *y* chat

Las tiradas y el chat comparten una sola línea temporal con un filtro **Todo / Tiradas / Chat / Archivos**. El autocompletado de `@` menciona al jugador correcto; `@all` llega a todos. Adjuntar una imagen a un mensaje la reduce automáticamente antes de enviarla.

### Salas pasadas que puedes releer

Cada partida pasada se guarda localmente como un registro duradero. Abre una sala antigua desde el vestíbulo en modo solo lectura; toca el nombre de un jugador en el registro antiguo para ver la instantánea de su personaje y su último retrato. Exporta una sala completa (chat, tiradas, imágenes) como un único ZIP.

### Herramientas para el DJ

El DJ puede tirar **en oculto**: los demás solo ven *"se hizo una tirada oculta"*, no el número. La sección del DJ agrupa también el renombrado de sala y la regeneración de código bajo un desplegable, y el botón de salida del DJ dice **Cerrar sala** para dejar claro que termina la sesión para todos.

### UI en 19 idiomas y traducción automática de chat

UI en 19 idiomas. La traducción automática de chat opcional usa la Chrome Translator API en el dispositivo cuando está disponible y recurre a la API REST sin claves de [MyMemory](https://mymemory.translated.net/). Toca **Original** en un mensaje traducido para ver exactamente lo que se envió.

### Pequeños detalles de uso

Color fijo por jugador, indicador discreto de escritura, eventos de entrada / salida en el flujo, temas configurables, tamaño de fuente ajustable y comportamiento elegante cuando el DJ cierra la sala.

## Instala en el móvil (PWA)

El sitio es una Progressive Web App, así que puede añadirse a la pantalla de inicio en iOS y Android y abrirse a pantalla completa — sin barra del navegador y con reinicios casi instantáneos.

- **Android (Chrome):** abre la demo, pulsa el menú del navegador y elige **Instalar aplicación** (o *Añadir a pantalla de inicio*).
- **iOS (Safari):** abre la demo, pulsa compartir y elige **Añadir a pantalla de inicio**.

Un service worker precachea el shell de la app para que se abra de inmediato al relanzarla, pero las salas siguen siendo P2P por WebRTC y necesitan red activa.

**Orientación de pantalla:** el manifest no fija ni sobrescribe la orientación, así que la PWA instalada respeta el ajuste de auto-rotación del dispositivo (p. ej. en Android, si desactivas la auto-rotación, la app se queda en su orientación actual).

## Cómo funciona el modo en línea

Las salas usan **WebRTC peer-to-peer** vía [PeerJS](https://peerjs.com/). El creador de la sala (DJ) es el host; cada otro jugador se conecta directamente al DJ, que retransmite el estado compartido. Ningún dato de juego pasa por servidores de este proyecto. Al ser P2P, la sala solo está activa mientras el DJ mantenga su pestaña abierta.

## Stack técnico

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) para salas P2P sobre WebRTC
- [Vitest](https://vitest.dev/) para tests unitarios
- GitHub Pages + GitHub Actions para hosting

## Desarrollo

```bash
npm install      # instalar dependencias
npm run dev      # arrancar el servidor de desarrollo
npm test         # ejecutar los tests unitarios
npm run lint     # linter
npm run build    # build de producción en dist/
```

## Configuración (relay TURN, opcional)

WebRTC necesita un relay TURN para conectar a jugadores cuyas redes bloquean UDP o usan NAT simétrico (común en Wi-Fi de cafetería o pública). Por defecto la app recurre a los servidores TURN públicos gratuitos del Open Relay Project — bien para uso casual, pero best-effort.

Para un relay fiable, copia `.env.example` a `.env` y configura:

- `VITE_TURN_URLS` — URLs TURN separadas por comas. Incluye una entrada `turns:` en TCP/443 para que funcione donde el UDP esté bloqueado.
- `VITE_TURN_USERNAME` — usuario TURN.
- `VITE_TURN_CREDENTIAL` — credencial / contraseña TURN.

> **Nota de seguridad:** Vite incrusta cada variable `VITE_*` en el bundle de producción, así que las credenciales TURN configuradas aquí quedan visibles para cualquiera que cargue la página. Usa credenciales TURN efímeras / de corta vida (p. ej. el patrón de credenciales temporales de la TURN REST API) y configura límites del lado del proveedor: orígenes permitidos, filtrado de IP o cuotas mensuales. No reutilices aquí credenciales de producción duraderas.

Para usarlas en el despliegue de GitHub Pages, añádelas como secretos del repositorio y pásalas al paso de build en `.github/workflows/deploy.yml`. Opciones gratuitas incluyen el plan gratuito de [Metered](https://www.metered.ca/) o autoalojar [coturn](https://github.com/coturn/coturn).

## Despliegue

Cualquier push a `main` dispara el workflow de GitHub Actions (`.github/workflows/deploy.yml`), que ejecuta lint, tests, build y publica en GitHub Pages. La base path de producción es `/trpg-dice-online/`; sobrescríbela con la variable de entorno `BASE_PATH` si lo alojas en otro sitio.

## Documentación

- Requisitos y plan de implementación: [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Investigación sobre APIs de traducción en tiempo real: [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licencia

[MIT](LICENSE) © 2026 yamadar
