# Plan et récit technique — projet Amaz (mémoire)

On aurait dû rédiger cette documentation au fil des sprints ; on l’a regroupée à la fin, mais on a essayé de la structurer comme si on racontait le projet semaine par semaine. Désolé si certains passages sonnent un peu « bricolage de fin de session » — c’est un peu la vérité.

## 1. Contexte et contraintes du cours

Le sujet imposait une architecture **microservices** avec **Node.js + Express**, accès base via **drivers natifs** (PostgreSQL et MongoDB selon les services), et une partie sécurité **faite maison** dans l’esprit du cours : pas de solution clé en main type Passport pour tout, pas de bcrypt toute faite si le cahier des charges disait autrement, etc. En parallèle on devait avoir au moins un client **Angular** qui consomme l’API.

Notre idée : une **marketplace** type petit Amazon — acheteurs, vendeurs, catalogue, commandes, messagerie, et une couche « bonus » recommandations / bot pour montrer qu’on sait brancher un service dédié.

## 2. Découpage des dossiers dans le dépôt

- **`Amaz_back/`** — tout le backend : `gateway/`, `services/*`, `admin-service/`, `shared/` (middlewares communs), scripts DB, Docker éventuel.
- **`users/`** — Angular storefront (clients).
- **`vendors/`** — Angular espace vendeur.
- **`qa-lab/`** — Angular pour tests / démos API.
- **`admin/`** — peut exister pour d’autres essais UI ; l’admin « officiel » du projet côté serveur est surtout **AdminJS** dans `admin-service`.
- **`docs/`** à la racine — surtout les **PDF générés** (`docs/pdf/`) + README d’orientation.
- **`Amaz_back/docs/`** — la doc **Markdown** qu’on édite : une fiche par microservice, cartographie front/back, manuel utilisateur, ce plan-ci.

## 3. Principe du passage par la gateway

Toutes les apps front passent par **`http://localhost:3000/api/v1/...`** en développement (ou l’URL déployée équivalente). La gateway :

1. Applique une **preuve de travail (PoW)** sur `/api/v1` pour limiter le spam de requêtes automatisées.
2. Applique du **rate limiting** et une **validation** basique des entrées.
3. Vérifie si la route auth a besoin d’un **Bearer** (login, register, refresh, etc. sont sur une liste de chemins publics).
4. **Proxifie** vers le bon service en ajoutant les en-têtes **internes** signés avec `INTERNAL_SHARED_SECRET` pour que le microservice sache que l’appel vient de la gateway et non d’un client qui taperait directement le port 3002.

Les services eux-mêmes répondent souvent **`INTERNAL_AUTH_REQUIRED`** si on les appelle sans ces en-têtes — c’est voulu.

**Ce qu’on n’avait pas vu en TD sous cet angle :** une vraie **terminaison de sécurité** au bord du système (PoW + throttle) avant même de toucher la logique métier.

## 4. Microservices — rôle et logique (résumé honnête)

### 4.1 Gateway (port 3000)

Fichier central : `gateway/src/app.js`. On y voit les blocs `app.use('/api/v1/auth', ...)`, `/produits`, `/commandes`, `/messages`, `/ai`, `/bot`, etc. Chaque bloc choisit **authMiddleware** ou **optionalAuthMiddleware** selon que la route doit identité obligatoire ou pas (ex. GET catalogue en lecture peut être optionnel pour personnaliser plus tard).

Le **health agrégé** (`/health/aggregate`) interroge périodiquement les services ; si un service est down, le proxy peut répondre **503** avec un message clair au lieu de timeout bête.

### 4.2 User service (3001)

Auth, profils, adresses, notifications, sessions, listes d’IPs bloquées côté données — **PostgreSQL**. Il parle au **pepper-service** pour ne pas stocker des secrets « en clair » dans notre logique de mots de passe (HMAC / pepper — détail dans la fiche pepper).

### 4.3 Product service (3002)

Catalogue **MongoDB** (produits, wishlists, etc.). Point important qu’on a documenté dans le code : certaines écritures vérifient que le **vendeur est approuvé** (middleware `approved-vendor` + lecture Postgres pour l’état vendeur). Ça mélange deux bases mais ça colle au métier « un admin doit valider le vendeur avant publication ».

### 4.4 Order service (3003)

Cycle de vie des **commandes** en **PostgreSQL** ; coordination avec le stock côté produit (réservation / libération selon ce qu’on a implémenté — voir `order-service` et `product-service` pour le détail exact des endpoints internes).

### 4.5 Messaging service (3004)

Threads **acheteur ↔ vendeur** uniquement (pas de chat arbitraire entre inconnus), stockage **MongoDB**, temps réel possible avec **Socket.IO**. C’était plus large que l’exemple de cours sur un simple CRUD HTTP.

### 4.6 AI service (3005)

Recommandations de démo, éventuellement journalisation ; certaines routes **bot** n’exigent que le PoW (contrat indiqué dans la gateway pour `POST` bot auth). Ça nous a permis de montrer une **surface API séparée** pour l’« intelligence » sans mélanger tout dans le product-service.

### 4.7 Pepper service (3006)

Service minimaliste dédié au **peppering** — réduit la surface d’attaque si une fuite a lieu côté user-service (le secret maître n’est pas dans le même process).

### 4.8 Admin service (3010)

**AdminJS** sur Postgres pour que l’équipe ou le prof puisse corriger des données sans écrire du SQL à la main. Ce n’est pas exposé comme l’API publique ; voir `docs/ADMIN_RUNBOOK.md`.

## 5. Frontends Angular — logique commune

Les trois apps (users, vendors, qa-lab) partagent l’idée : **`HttpClient`** + une **base URL gateway** + **intercepteur** pour PoW et en-têtes. Le fichier `GatewayApiService` dans users encapsule `get/post/...` pour ne pas concaténer les URLs n’importe comment.

Côté **état**, on utilise des **stores** (signals ou services selon les parties du code) pour le catalogue et les commandes afin d’éviter de recharger bêtement à chaque clic.

## 6. Données de démo et pièges qu’on a eus

- **Seed Mongo** avec beaucoup de produits pour stresser la liste et la pagination.
- **Prix** : mélange ancien mock en centimes vs euros — on a dû normaliser côté client ou seed pour ne pas afficher des milliers d’euros par erreur.
- **Budgets Angular SCSS** : au-delà d’une taille de styles par composant, le build râle ; on a réduit ou ajusté `angular.json` selon les semaines.

## 7. Comment lire le reste de la doc

- Fiches détaillées par service : `Amaz_back/docs/services/*.md`
- Apps : `Amaz_back/docs/apps/*.md`
- Cartographie précise front ↔ routes : `MICROSERVICES_FRONTEND_MAP.md`
- Vérifications locales : `VERIFY.md`
- Manuel non technique : `MANUEL_UTILISATEUR.md`
- **PDF** : tout regénérer avec `npm run docs:pdf` depuis `Amaz_back` → sortie dans `docs/pdf/` à la racine du dépôt.

## 8. Conclusion pour le jury

On a essayé de respecter une vraie séparation des responsabilités : sécurité et routing au bord (gateway), métier réparti, deux perspectives Angular, et un outil d’admin pour la donnée. Ce n’est pas « production ready » (TLS partout, observabilité, CI complète, etc.), mais pour un projet annuel ça montre qu’on a compris le flux bout en bout — des requêtes HTTP jusqu’aux collections Mongo et aux tables Postgres.
