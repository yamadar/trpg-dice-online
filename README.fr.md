# Dice & Chat

**Languages:** [English](README.md) · [日本語](README.ja.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [한국어](README.ko.md) · [Italiano](README.it.md) · [Русский](README.ru.md) · [ไทย](README.th.md) · [Türkçe](README.tr.md) · [Bahasa Indonesia](README.id.md) · [Polski](README.pl.md) · [Tiếng Việt](README.vi.md) · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Українська](README.uk.md)

Un lanceur de dés en ligne pour les parties de JDR sur table. Lancez les
dés, sauvegardez des modèles réutilisables et partagez résultats,
historique et tchat avec votre groupe en temps réel — depuis une page
statique sans serveur.

**🎲 Démo en ligne :** https://yamadar.github.io/trpg-dice-online/

## Fonctionnalités

- **Dés (A)** — choisissez le nombre et le type avant chaque jet
  (`D4, D6, D8, D10, D12, D20, D100`). `D100` lance deux d10 comme
  chiffres ; `00` vaut 100.
- **Modificateur (B)** — applique un modificateur signé `+/-` au résultat.
- **Catégorie (C)** — `dégâts` ou `test`. Dégâts : `{modèle} {valeur} de
  dégâts` ; test : `Résultat du test {modèle} : {valeur}`.
- **Personnages** — conservez plusieurs personnages (nom, contexte
  public, note privée, portrait optionnel, liste de modèles et la
  préférence « inclure la note à l'export » par personnage), changez à
  volonté et exportez/importez en JSON.
- **Modèles** — regroupez A + B + C avec un nom et enregistrez par
  personnage ; relancez en un clic depuis la liste.
- **Fil historique & tchat** — jets et tchat partagent un fil
  chronologique avec filtre Tout / Jets / Tchat / Fichiers.
- **Historique des salles passées** — chaque session est conservée ;
  parcourez le fil en lecture seule depuis le lobby et supprimez par
  session ou en totalité. Toucher un nom affiche l'instantané du
  personnage et son dernier portrait connu.
- **Salles en ligne** — écrans séparés Créer / Rejoindre avec un code de
  salle (au moins 4 caractères ; ceux générés automatiquement font 6).
  Historique, tchat et liste des joueurs sont partagés en P2P ; au
  rechargement, le MJ rehostera et le joueur rejoindra automatiquement.
- **Commandes MJ** — le MJ regroupe le renommage et le changement de
  code derrière un volet replié, et le bouton de sortie est « Fermer la
  salle ».
- **Jets cachés du MJ** — le MJ peut masquer la valeur ; les autres
  voient seulement qu'un jet caché a eu lieu.
- **Couleurs et indicateur de frappe** — chaque participant reçoit une
  couleur stable et un indicateur discret montre qui tape.
- **Événements de salle** — entrées/sorties apparaissent dans le fil ;
  fermer la salle en tant que MJ notifie tout le monde proprement.
- **Multilingue & traduction automatique** — l'interface gère 19 langues.
  La traduction automatique facultative affiche les messages des autres
  joueurs dans la langue de votre interface ; elle privilégie l'API Chrome
  Translator sur l'appareil et bascule sur l'API REST sans clé de
  [MyMemory](https://mymemory.translated.net/). Touchez « Original » sur
  un message traduit pour voir le texte tel qu'il a été envoyé.

## Comment fonctionne le partage

L'application utilise **des connexions P2P WebRTC via [PeerJS](https://peerjs.com/)**.
Le créateur de la salle (MJ) joue le rôle d'hôte ; chaque autre joueur
se connecte directement au MJ qui relaie l'état partagé. Aucune donnée
ne transite par un serveur appartenant à ce projet. Étant en P2P, la
salle ne reste ouverte que tant que le MJ a la page ouverte.

## Stack technique

- [Vite](https://vite.dev/) + [React 19](https://react.dev/) + TypeScript
- [PeerJS](https://peerjs.com/) (WebRTC P2P)
- [Vitest](https://vitest.dev/) (tests unitaires)
- GitHub Pages + GitHub Actions (hébergement)

## Développement

```bash
npm install      # installer les dépendances
npm run dev      # lancer le serveur de dev
npm test         # exécuter les tests
npm run lint     # lint
npm run build    # build de production dans dist/
```

## Configuration (relais TURN)

WebRTC a besoin d'un relais TURN pour connecter les joueurs dont le
réseau bloque UDP ou utilise un NAT symétrique (fréquent sur Wi-Fi
public). Par défaut, l'application utilise les serveurs TURN publics
gratuits de l'Open Relay Project — suffisants pour un usage occasionnel
mais en « best effort ». Pour un relais fiable, copiez `.env.example`
vers `.env` et renseignez :

- `VITE_TURN_URLS` — URLs TURN séparées par des virgules. Incluez une
  entrée `turns:` en TCP/443 pour que cela fonctionne quand UDP est
  bloqué.
- `VITE_TURN_USERNAME` — nom d'utilisateur TURN.
- `VITE_TURN_CREDENTIAL` — identifiant TURN (mot de passe).

**Note de sécurité :** Vite inline toutes les variables `VITE_*` dans le
bundle de production : les identifiants TURN définis ici sont donc
visibles par quiconque charge la page. Pour limiter le risque d'abus,
utilisez des identifiants TURN éphémères / à courte durée de vie (par
exemple le pattern d'identifiants à durée limitée fourni par l'API REST
TURN) et configurez des limites côté fournisseur — origines autorisées,
filtrage IP, quotas mensuels. Ne réutilisez pas d'identifiants de
production à longue durée.

Pour les utiliser dans le déploiement GitHub Pages, ajoutez-les comme
secrets du dépôt et passez-les dans l'étape de build de
`.github/workflows/deploy.yml`. Options gratuites : l'offre gratuite de
[Metered](https://www.metered.ca/) ou l'auto-hébergement de
[coturn](https://github.com/coturn/coturn).

## Déploiement

Un push sur `main` déclenche le workflow GitHub Actions
(`.github/workflows/deploy.yml`) : lint, tests, build et publication sur
GitHub Pages. Le base path en production est `/trpg-dice-online/` ;
remplacez-le via la variable d'environnement `BASE_PATH` pour héberger
ailleurs.

## Documentation

- Spécifications et plan : [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- Journal des modifications : [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- Recherche sur les APIs de traduction : [`docs/TRANSLATION_API_RESEARCH.md`](docs/TRANSLATION_API_RESEARCH.md)

## Licence

[MIT](LICENSE) © 2026 yamadar
