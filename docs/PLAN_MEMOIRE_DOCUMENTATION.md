# Plan et rÃ©cit technique â€” projet Amaz (mÃ©moire)

On aurait dÃ» rÃ©diger cette documentation au fil des sprints ; on lâ€™a regroupÃ©e Ã  la fin, mais on a essayÃ© de la structurer comme si on racontait le projet semaine par semaine. DÃ©solÃ© si certains passages sonnent un peu Â« bricolage de fin de session Â» â€” câ€™est un peu la vÃ©ritÃ©.

## 1. Contexte et contraintes du cours

Le sujet imposait une architecture **microservices** avec **Node.js + Express**, accÃ¨s base via **drivers natifs** (MySQL et MongoDB selon les services), et une partie sÃ©curitÃ© **faite maison** dans lâ€™esprit du cours : pas de solution clÃ© en main type Passport pour tout, pas de bcrypt toute faite si le cahier des charges disait autrement, etc. En parallÃ¨le on devait avoir au moins un client **Angular** qui consomme lâ€™API.

Notre idÃ©e : une **marketplace** type petit Amazon â€” acheteurs, vendeurs, catalogue, commandes, messagerie, et une couche Â« bonus Â» recommandations / bot pour montrer quâ€™on sait brancher un service dÃ©diÃ©.

## 2. DÃ©coupage des dossiers dans le dÃ©pÃ´t

- **`Amaz_back/`** â€” tout le backend : `gateway/`, `services/*`, `admin-service/`, `shared/` (middlewares communs), scripts DB, Docker Ã©ventuel.
- **`users/`** â€” Angular storefront (clients).
- **`vendors/`** â€” Angular espace vendeur.
- **`qa-lab/`** â€” Angular pour tests / dÃ©mos API.
- **`admin/`** â€” peut exister pour dâ€™autres essais UI ; lâ€™admin Â« officiel Â» du projet cÃ´tÃ© serveur est surtout **AdminJS** dans `admin-service`.
- **`docs/`** Ã  la racine â€” surtout les **PDF gÃ©nÃ©rÃ©s** (`docs/pdf/`) + README dâ€™orientation.
- **`Amaz_back/docs/`** â€” la doc **Markdown** quâ€™on Ã©dite : une fiche par microservice, cartographie front/back, manuel utilisateur, ce plan-ci.

## 3. Principe du passage par la gateway

Toutes les apps front passent par **`http://localhost:3000/api/v1/...`** en dÃ©veloppement (ou lâ€™URL dÃ©ployÃ©e Ã©quivalente). La gateway :

1. Applique une **preuve de travail (PoW)** sur `/api/v1` pour limiter le spam de requÃªtes automatisÃ©es.
2. Applique du **rate limiting** et une **validation** basique des entrÃ©es.
3. VÃ©rifie si la route auth a besoin dâ€™un **Bearer** (login, register, refresh, etc. sont sur une liste de chemins publics).
4. **Proxifie** vers le bon service en ajoutant les en-tÃªtes **internes** signÃ©s avec `INTERNAL_SHARED_SECRET` pour que le microservice sache que lâ€™appel vient de la gateway et non dâ€™un client qui taperait directement le port 3002.

Les services eux-mÃªmes rÃ©pondent souvent **`INTERNAL_AUTH_REQUIRED`** si on les appelle sans ces en-tÃªtes â€” câ€™est voulu.

**Ce quâ€™on nâ€™avait pas vu en TD sous cet angle :** une vraie **terminaison de sÃ©curitÃ©** au bord du systÃ¨me (PoW + throttle) avant mÃªme de toucher la logique mÃ©tier.

## 4. Microservices â€” rÃ´le et logique (rÃ©sumÃ© honnÃªte)

### 4.1 Gateway (port 3000)

Fichier central : `gateway/src/app.js`. On y voit les blocs `app.use('/api/v1/auth', ...)`, `/produits`, `/commandes`, `/messages`, `/ai`, `/bot`, etc. Chaque bloc choisit **authMiddleware** ou **optionalAuthMiddleware** selon que la route doit identitÃ© obligatoire ou pas (ex. GET catalogue en lecture peut Ãªtre optionnel pour personnaliser plus tard).

Le **health agrÃ©gÃ©** (`/health/aggregate`) interroge pÃ©riodiquement les services ; si un service est down, le proxy peut rÃ©pondre **503** avec un message clair au lieu de timeout bÃªte.

### 4.2 User service (3001)

Auth, profils, adresses, notifications, sessions, listes dâ€™IPs bloquÃ©es cÃ´tÃ© donnÃ©es â€” **MySQL**. Il parle au **pepper-service** pour ne pas stocker des secrets Â« en clair Â» dans notre logique de mots de passe (HMAC / pepper â€” dÃ©tail dans la fiche pepper).

### 4.3 Product service (3002)

Catalogue **MongoDB** (produits, wishlists, etc.). Point important quâ€™on a documentÃ© dans le code : certaines Ã©critures vÃ©rifient que le **vendeur est approuvÃ©** (middleware `approved-vendor` + lecture MySQL pour lâ€™Ã©tat vendeur). Ã‡a mÃ©lange deux bases mais Ã§a colle au mÃ©tier Â« un admin doit valider le vendeur avant publication Â».

### 4.4 Order service (3003)

Cycle de vie des **commandes** en **MySQL** ; coordination avec le stock cÃ´tÃ© produit (rÃ©servation / libÃ©ration selon ce quâ€™on a implÃ©mentÃ© â€” voir `order-service` et `product-service` pour le dÃ©tail exact des endpoints internes).

### 4.5 Messaging service (3004)

Threads **acheteur â†” vendeur** uniquement (pas de chat arbitraire entre inconnus), stockage **MongoDB**, temps rÃ©el possible avec **Socket.IO**. Câ€™Ã©tait plus large que lâ€™exemple de cours sur un simple CRUD HTTP.

### 4.6 AI service (3005)

Recommandations de dÃ©mo, Ã©ventuellement journalisation ; certaines routes **bot** nâ€™exigent que le PoW (contrat indiquÃ© dans la gateway pour `POST` bot auth). Ã‡a nous a permis de montrer une **surface API sÃ©parÃ©e** pour lâ€™Â« intelligence Â» sans mÃ©langer tout dans le product-service.

### 4.7 Pepper service (3006)

Service minimaliste dÃ©diÃ© au **peppering** â€” rÃ©duit la surface dâ€™attaque si une fuite a lieu cÃ´tÃ© user-service (le secret maÃ®tre nâ€™est pas dans le mÃªme process).

### 4.8 Admin service (3010)

**AdminJS** sur MySQL pour que lâ€™Ã©quipe ou le prof puisse corriger des donnÃ©es sans Ã©crire du SQL Ã  la main. Ce nâ€™est pas exposÃ© comme lâ€™API publique ; voir `docs/ADMIN_RUNBOOK.md`.

## 5. Frontends Angular â€” logique commune

Les trois apps (users, vendors, qa-lab) partagent lâ€™idÃ©e : **`HttpClient`** + une **base URL gateway** + **intercepteur** pour PoW et en-tÃªtes. Le fichier `GatewayApiService` dans users encapsule `get/post/...` pour ne pas concatÃ©ner les URLs nâ€™importe comment.

CÃ´tÃ© **Ã©tat**, on utilise des **stores** (signals ou services selon les parties du code) pour le catalogue et les commandes afin dâ€™Ã©viter de recharger bÃªtement Ã  chaque clic.

## 6. DonnÃ©es de dÃ©mo et piÃ¨ges quâ€™on a eus

- **Seed Mongo** avec beaucoup de produits pour stresser la liste et la pagination.
- **Prix** : mÃ©lange ancien mock en centimes vs euros â€” on a dÃ» normaliser cÃ´tÃ© client ou seed pour ne pas afficher des milliers dâ€™euros par erreur.
- **Budgets Angular SCSS** : au-delÃ  dâ€™une taille de styles par composant, le build rÃ¢le ; on a rÃ©duit ou ajustÃ© `angular.json` selon les semaines.

## 7. Comment lire le reste de la doc

- Fiches dÃ©taillÃ©es par service : `Amaz_back/docs/services/*.md`
- Apps : `Amaz_back/docs/apps/*.md`
- Cartographie prÃ©cise front â†” routes : `MICROSERVICES_FRONTEND_MAP.md`
- VÃ©rifications locales : `VERIFY.md`
- Manuel non technique : `MANUEL_UTILISATEUR.md`
- **PDF** : tout regÃ©nÃ©rer avec `npm run docs:pdf` depuis `Amaz_back` â†’ sortie dans `docs/pdf/` Ã  la racine du dÃ©pÃ´t.

## 8. Conclusion pour le jury

On a essayÃ© de respecter une vraie sÃ©paration des responsabilitÃ©s : sÃ©curitÃ© et routing au bord (gateway), mÃ©tier rÃ©parti, deux perspectives Angular, et un outil dâ€™admin pour la donnÃ©e. Ce nâ€™est pas Â« production ready Â» (TLS partout, observabilitÃ©, CI complÃ¨te, etc.), mais pour un projet annuel Ã§a montre quâ€™on a compris le flux bout en bout â€” des requÃªtes HTTP jusquâ€™aux collections Mongo et aux tables MySQL.

