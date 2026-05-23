<p align="center">
  <img src="public/brand-icon.svg" width="120" alt="Dice & Chat" />
</p>

<h1 align="center">Dice &amp; Chat</h1>

<p align="center"><strong>Une salle de dés de poche pour votre soirée JdR.</strong></p>

<p align="center">
  Ouvrez la page, partagez un court code de salle et toute la tablée lance les dés ensemble —<br/>
  pas de compte, pas d'installation, pas de serveur de jeu. Juste le lien et les dés.
</p>

<p align="center">
  <a href="https://yamadar.github.io/trpg-dice-online/"><strong>Ouvrir la démo en ligne →</strong></a>
</p>

<p align="center">
  <em><strong>Langues :</strong></em>
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
  <img src="public/images/lobby-mobile.png" width="280" alt="Lobby vide sur un téléphone avec la marque Dice & Chat" />
  &nbsp;
  <img src="public/images/feed-mobile.png" width="280" alt="Un flux en direct des jets de dés et du chat" />
</p>

## Pourquoi le choisir pour votre prochaine partie

- **Partagez un code, lancez les dés.** Le MJ crée une salle et lit le code 4–6 caractères à voix haute ; les autres le saisissent. Aucun compte, aucune confirmation par e-mail, rien à signer.
- **Vos jets restent entre vous.** P2P pur via WebRTC : jets et chat passent directement d'un appareil à l'autre, jamais par un serveur que l'on opère.
- **À l'aise dans le téléphone posé sur la table.** Mise en page mobile-first, installable en PWA sur iOS et Android, lancement en plein écran.
- **Parle 19 langues et traduit le chat pour vous.** La cléresse allemande peut taquiner le roublard japonais sans que personne ne sorte de l'immersion.
- **Conçu pour être rouvert.** Personnages, modèles, thèmes, polices et anciennes parties restent en local — l'appli a l'air de *votre* boîte à dés, pas d'un kiosque partagé.

## Lancez une partie en 30 secondes

1. **MJ :** ouvrez la démo, touchez **Salle → Créer**, lisez le code à voix haute.
2. **Joueurs :** ouvrez la démo, touchez **Salle → Rejoindre**, tapez le code.
3. **Tout le monde :** lancez les dés, chattez, fêtez le premier 20 naturel ensemble.

Le MJ est l'hôte : tant que son onglet reste ouvert, la salle est vivante. Fermer l'onglet termine la session — les anciennes salles restent en local pour relire le journal plus tard.

## Dans la boîte à dés

### Des dés qui se lisent au premier coup d'œil

`d4 · d6 · d8 · d10 · d12 · d20 · d100`, avec nombre, modificateur signé et un type **dégâts / test** qui formule le résultat comme la tablée le dirait — *« Résultat du test de Perception : 18 »*, *« Espadon : 11 de dégâts »*. Chaque face apparaît sous forme d'une petite silhouette correspondant au dé, lisible d'un regard.

### Modèles — vos manœuvres préférées en un tap

Enregistrez `2D6 + 3 — dégâts` sous un nom comme *« Espadon »* et rejouez-le au tour suivant d'un tap. Les modèles appartiennent aux personnages : deux PJ sur le même appareil gardent leurs propres listes.

### Personnages avec portrait, mémo et modèles propres

Plusieurs PJ par joueur. Chacun a un nom, un historique partagé, un mémo privé que vous seul voyez, un portrait optionnel, une liste de modèles et une préférence *« inclure le mémo à l'export »* propre. Export en JSON pour sauvegarde ; import sur un autre appareil pour amener le PJ à la prochaine partie. Quand on incarne un personnage, son nom apparaît comme `Personnage (Joueur)`.

### Un seul fil pour les jets *et* le chat

Jets et chat partagent une seule timeline avec un filtre **Tout / Jets / Chat / Fichiers**. L'autocomplétion `@` mentionne le bon joueur ; `@all` parle à tout le monde. Joindre une image dans le chat la redimensionne automatiquement avant l'envoi.

### Anciennes salles à relire

Chaque ancienne session est conservée localement comme journal durable. Ouvrez une ancienne salle depuis le lobby en lecture seule ; tapez le nom d'un joueur dans le vieux journal pour voir son instantané de personnage et son dernier portrait connu. Exportez une salle complète (chat, jets, images) en un seul ZIP.

### Outils du MJ

Le MJ peut lancer **en caché** : les autres voient seulement *« un jet caché a été effectué »* et pas le nombre. La section MJ regroupe également le renommage de la salle et la régénération du code derrière un disclosure, et le bouton de sortie du MJ s'intitule **Fermer la salle** pour bien indiquer que cela met fin à la session pour tout le monde.

### UI en 19 langues &amp; chat auto-traduit

UI en 19 langues. La traduction automatique du chat, optionnelle, utilise l'API Chrome Translator sur l'appareil si disponible et bascule sur l'API REST sans clé de [MyMemory](https://mymemory.translated.net/). Touchez **Original** sur un message traduit pour voir exactement ce qui a été envoyé.

### Quelques attentions

Couleur stable par joueur, indicateur de saisie discret, événements d'arrivée / de départ dans le fil, thèmes ajustables, taille de police modifiable et fermeture de salle en douceur quand le MJ part.

## Installer sur le téléphone (PWA)

Le site est une Progressive Web App : il peut être ajouté à l'écran d'accueil sur iOS et Android et lancé en plein écran — sans interface de navigateur, avec un redémarrage quasi instantané.

- **Android (Chrome) :** ouvrez la démo, touchez le menu du navigateur, choisissez **Installer l'application** (ou *Ajouter à l'écran d'accueil*).
- **iOS (Safari) :** ouvrez la démo, touchez Partager, choisissez **Sur l'écran d'accueil**.

Un service worker met en cache la coquille de l'appli pour qu'elle se lance instantanément. Les salles, elles, restent P2P via WebRTC et requièrent une connexion réseau active.

**Orientation de l'écran :** le manifest ne verrouille pas l'orientation — la PWA installée suit le réglage rotation automatique / verrouillage de l'appareil (par ex. sur Android, si l'auto-rotation est désactivée, l'appli reste dans son orientation actuelle).

## Comment fonctionne le partage en ligne

Les salles utilisent du **WebRTC peer-to-peer** via [PeerJS](https://peerjs.com/). Le créateur de la salle (MJ) est l'hôte ; chaque autre joueur se connecte directement au MJ, qui relaie l'état partagé. Aucune donnée de jeu ne transite par un serveur de ce projet. Comme c'est du P2P, la salle reste ouverte tant que le MJ garde son onglet ouvert.

## Stack technique

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) pour les salles P2P en WebRTC
- [Vitest](https://vitest.dev/) pour les tests unitaires
- GitHub Pages + GitHub Actions pour l'hébergement

## Développement

```bash
npm install      # installer les dépendances
npm run dev      # démarrer le serveur de dev
npm test         # lancer les tests unitaires
npm run lint     # linter
npm run build    # build de production dans dist/
```

## Configuration (relais TURN, optionnel)

WebRTC a besoin d'un relais TURN pour connecter les joueurs dont le réseau bloque UDP ou utilise du NAT symétrique (courant en Wi-Fi café / public). Par défaut l'appli bascule sur les serveurs TURN publics gratuits d'Open Relay Project — corrects pour un usage occasionnel, mais best-effort.

Pour un relais fiable, copiez `.env.example` en `.env` et renseignez :

- `VITE_TURN_URLS` — URLs TURN séparées par des virgules. Incluez une entrée `turns:` sur TCP/443 pour fonctionner quand UDP est bloqué.
- `VITE_TURN_USERNAME` — nom d'utilisateur TURN.
- `VITE_TURN_CREDENTIAL` — identifiant / mot de passe TURN.

> **Note de sécurité :** Vite inline chaque variable `VITE_*` dans le bundle de production — les identifiants TURN configurés ici sont visibles par toute personne ouvrant la page. Utilisez des identifiants TURN éphémères / à durée limitée (par ex. le pattern « time-limited credential » de la TURN REST API) et configurez côté fournisseur des limites (origines autorisées, filtrage IP, quotas mensuels). Ne réutilisez pas ici des identifiants de production durables.

Pour les utiliser dans le déploiement GitHub Pages, ajoutez-les comme secrets du dépôt et passez-les à l'étape de build dans `.github/workflows/deploy.yml`. Options gratuites : le plan gratuit de [Metered](https://www.metered.ca/) ou l'auto-hébergement de [coturn](https://github.com/coturn/coturn).

## Déploiement

Un push sur `main` déclenche le workflow GitHub Actions (`.github/workflows/deploy.yml`) qui lint, teste, build et publie sur GitHub Pages. Le base path de production est `/trpg-dice-online/` ; surchargez-le avec la variable d'environnement `BASE_PATH` pour héberger ailleurs.

## Documentation

- Cahier des charges et plan d'implémentation : [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Recherche sur les API de traduction en temps réel : [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licence

[MIT](LICENSE) © 2026 yamadar
