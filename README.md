# Backend Amaz

Backend microservices pour la marketplace Amaz :

- `gateway` (point d'entrée API + middleware de sécurité)
- `services/user-service`
- `services/product-service`
- `services/order-service`
- `services/messaging-service`
- `services/returns-service`
- `services/ai-service`
- `services/pepper-service`

## URLs recommandées

| Objectif | URL | Notes |
|----------|-----|-------|
| **Appels API (clients, Postman, frontend)** | `http://localhost:3000/api/v1/...` | Utiliser la gateway. Nécessite les en-têtes PoW pour `/api/v1/*` (les apps users/vendors les ajoutent automatiquement). |
| **Santé gateway** | `http://localhost:3000/health` | Public. |
| **Santé agrégée (tous les services)** | `http://localhost:3000/health/aggregate` | Public. |
| **Panneau admin (AdminJS)** | `http://localhost:3010/admin` | Service séparé ; voir `docs/ADMIN_RUNBOOK.md`. |
| **Vivacité directe des services** | `http://localhost:3001/health` … `http://localhost:3008/health` | Public. Pour les health checks Docker/QA. |
| **Info service (racine)** | `http://localhost:3001/` … `http://localhost:3008/` | Public. Retourne des indications d'utilisation. |
| **Routes métier directes** | `http://localhost:3002/produits`, etc. | **Ne pas utiliser depuis le navigateur.** Retourne `INTERNAL_AUTH_REQUIRED` sauf si les en-têtes signés `x-internal-*` sont présents (gateway et appelants internes uniquement). |

## Vue d'ensemble des services

| Service | Port | Rôle | Appelants directs autorisés |
|---------|------|------|-----------------------------|
| gateway | 3000 | Point d'entrée API, PoW, rate limit, auth, proxy | Clients (avec PoW) |
| user-service | 3001 | Auth, utilisateurs, adresses, notifications | gateway, order-service |
| product-service | 3002 | Produits, stock, réservation/libération | gateway, order-service |
| order-service | 3003 | Commandes, checkout | gateway |
| messaging-service | 3004 | Messagerie acheteur-vendeur, Socket.IO | gateway |
| returns-service | 3008 | Flux de retours vendeur/acheteur | gateway |
| ai-service | 3005 | Recommandations IA, auth bot | gateway |
| pepper-service | 3006 | Peppering de mots de passe/tokens (HMAC) | user-service |

## Contraintes respectées

- Node.js + Express uniquement
- PostgreSQL + driver natif MongoDB
- Primitives de sécurité manuelles (pas de libs JWT, pas de bcrypt, pas de passport)
- Messagerie acheteur-vendeur uniquement

## Environnement

Copier `.env.example` vers `.env` et renseigner les secrets.

**Bootstrap vs redémarrage :** `npm run db:bootstrap` (et `db:seed`) sont des étapes de configuration **manuelles, ponctuelles** lors du premier clone du projet ou après une réinitialisation volontaire des données. **Redémarrer Docker ou Node ne supprime pas la base de données** et ne re-seede pas automatiquement. Les seeds de démo sont réservés au **développement** — ils remplacent les lignes de seed lors de l'exécution de `npm run db:postgres:seed`, pas à chaque redémarrage de la DB.

Requis pour un fonctionnement minimal :

- **Gateway :** `INTERNAL_SHARED_SECRET`
- **User service :** `INTERNAL_SHARED_SECRET`, `ACCESS_HMAC_SECRET`, `REFRESH_HMAC_SECRET` ; optionnel en dev quand Pepper est indisponible : `PEPPER_CLIENT_SECRET`
- **Pepper service :** `INTERNAL_SHARED_SECRET`, `PEPPER_MASTER_SECRET`
- **PostgreSQL :** `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` (pour user-service et order-service)
- **MongoDB :** `MONGO_URI`, `MONGO_DB_NAME` (pour product, messaging, ai services)
- **Product-service** lit aussi **PostgreSQL** (`PG_*`) pour appliquer l'**approbation vendeur** sur les mutations catalogue.
- **Admin-service :** `INTERNAL_SHARED_SECRET`, `USER_SERVICE_URL`, `PG_*` (ou `DATABASE_URL`), optionnel `ADMIN_SESSION_SECRET` — voir `docs/ADMIN_RUNBOOK.md`.

Laisser `CORS_ALLOWED_ORIGINS` vide pour autoriser toutes les origines (ex. QA lab sur le port 4202).

## Ordre de démarrage

Démarrer les services dans cet ordre pour que les dépendances soient prêtes :

1. **Bases de données :** `docker compose up -d` (Postgres + Mongo).
2. **Pepper** (port 3006) — pas de DB ; d'autres services l'appellent pour le hachage.
3. **User** (3001) — nécessite Postgres et Pepper (ou `PEPPER_CLIENT_SECRET` en dev).
4. **Product** (3002), **Order** (3003), **Messaging** (3004), **AI** (3005), **Returns** (3008) — l'ordre entre eux n'a pas d'importance une fois les dépendances prêtes.
5. **Gateway** (3000) — en dernier ; elle proxie vers tous les services ci-dessus.

Health checks : utiliser `GET http://localhost:3000/health/aggregate` pour voir le statut gateway + tous les services (ex. depuis le QA lab ou `scripts/run-qa-campaign.js`).

**Vérification locale complète** (stack + DB requis) : depuis `Amaz_back` lancer `npm run verify:local`. Voir [docs/VERIFY.md](docs/VERIFY.md) pour les prérequis, les flags de skip et les commandes de build Angular.

**Contrat API (brouillon) :** [docs/openapi/gateway-v1.yaml](docs/openapi/gateway-v1.yaml)

## Démarrage rapide

**Important :** Exécuter `npm run db:bootstrap` avant la première utilisation. Sans cela, la collection products est vide et la confirmation de commande échouera avec 400.

Depuis `Amaz_back` :

```bash
# 1. Démarrer les bases de données
docker compose up -d

# 2. Bootstrap DB (migrations + seed)
npm run db:bootstrap

# 3. Démarrer la stack complète (avec docker-compose.full.yml)
docker compose -f docker-compose.full.yml up -d --build
```

Utilisateurs de seed (voir `db/postgres/seed.js`) : **`test@amaz.com` / `AmazQA2026!`** (défaut QA lab ; modifiable via `SEED_QA_TEST_PASSWORD`), et `eddy.etame@enkoschools.com` / `Amaz@2026!`.

## Orchestration locale des DB (Docker)

Exécuter ces commandes depuis `Amaz_back` :

- Démarrer PostgreSQL + MongoDB : `docker compose up -d`
- Vérifier l'état des conteneurs : `docker compose ps`
- Consulter les logs de santé si besoin : `docker compose logs postgres mongo`
- Arrêter les conteneurs : `docker compose down`
- Arrêter et supprimer les volumes nommés : `docker compose down -v`

## Bootstrap de la base de données

**Une seule commande (recommandé sur l'hôte) :**

```bash
npm run db:bootstrap
```

Exécute toutes les migrations Postgres dans `db/postgres/migrations`, puis le seed Postgres et l'init Mongo.

**Stack Docker complète :** `npm run db:bootstrap` utilise `PG_HOST` depuis `.env` (souvent `localhost:5432`). Ce doit être la **même** instance Postgres que celle utilisée par les conteneurs (port publié depuis `amaz-postgres`). Si une autre instance PostgreSQL tourne sur `5432`, le bootstrap peut mettre à jour la mauvaise base et l'app continuera d'échouer (ex. PostgreSQL `42703`). Dans ce cas, exécuter les migrations **à l'intérieur** de Compose :

```bash
npm run db:bootstrap:docker
```

(nécessite la stack active : `docker compose -f docker-compose.full.yml up -d` ; utilise le service `bootstrap` sous `--profile tools`.)

**Dev multi-frontend (ports 4200 / 4201 / 4202) et catalogue vide :**

1. Après `docker compose -f docker-compose.full.yml up -d`, lancer **`npm run db:bootstrap:docker`** pour que **Mongo** (produits) et Postgres correspondent aux conteneurs.
2. **Reconstruire ou redémarrer la gateway** après modification de `CORS_ALLOWED_ORIGINS` ou des valeurs par défaut de [`gateway/src/config.js`](gateway/src/config.js).
3. Utiliser **une seule** famille de hostname dans le navigateur pour toutes les apps (`localhost` *ou* `127.0.0.1`) ; CORS liste les deux en dev.
4. Vérifier API + PoW : **`npm run test:gateway-suite`** (attend `GET /api/v1/produits` avec des éléments).

**Étapes manuelles :**

- PostgreSQL : exécuter tous les fichiers dans `db/postgres/migrations/` dans l'ordre lexical (ou utiliser `npm run db:bootstrap`)
- Seed Postgres : `npm run db:postgres:seed`
- Init Mongo : `npm run db:mongo:init`

## Tests

**Prérequis :** Docker (Postgres + Mongo), ou stack complète en cours d'exécution.

| Commande | Description |
|----------|-------------|
| `npm test` | Tests smoke (vérifications statiques de fichiers/snippets, pas de services requis) |
| `npm run qa:campaign` | `/health` direct sur chaque service avec **retries** (env : `QA_HEALTH_RETRIES`, `QA_HEALTH_RETRY_MS` ; stack sur localhost requise) |
| `npm run test:contract-smoke` | Santé par port + GET `/api/v1/produits` + POST `/api/v1/bot/auth` avec PoW (`SKIP_CONTRACT=1` = ignorer les appels PoW) |
| `npm run test:gateway-suite` | **Régression API complète** via la gateway : PoW + register/login/me + produits + commandes + messages + bot/auth (exécuter sur l'**hôte** où Docker publie `3000–3008`). Attend jusqu'à 60s le user-service en agrégé (surcharger avec `GATEWAY_SUITE_WAIT_USER_MS`, ou `GATEWAY_SUITE_SKIP_WAIT=1` pour désactiver) |
| `npm run test:e2e-auth` | Auth E2E : login + GET /auth/me avec PoW (gateway, user-service, pepper, Postgres) |

**QA Lab (navigateur) :** `cd qa-lab && npm install && ng serve` (port **4202**). Utiliser **Run all** pour reproduire `test:gateway-suite`. Le CORS de la gateway inclut `http://localhost:4202` dans `docker-compose.full.yml` par défaut.

**Postman :** `postman/amaz-backend-e2e.postman_collection.json` (nécessite les variables PoW).

**Documentation :** Markdown sous `docs/` (services, apps, plan mémoire, manuel). **PDFs :** depuis `Amaz_back` lancer `npm run docs:pdf` → sortie **`../docs/pdf/*.pdf`** (racine du dépôt).

## Documentation

- **Admin et sécurité :** [docs/ADMIN_RUNBOOK.md](docs/ADMIN_RUNBOOK.md)
- **Backlog UX / marketplace :** [docs/UX_BACKLOG.md](docs/UX_BACKLOG.md)
- **Entités DB (CDC vs implémentation) :** [docs/CDC_ENTITES_DB.md](docs/CDC_ENTITES_DB.md), [docs/CDC_DB_CROSSCHECK.md](docs/CDC_DB_CROSSCHECK.md)

## Défis rencontrés

### Checkout bloqué alors que les produits étaient visibles

On a eu un cas assez trompeur pendant l'intégration front/back : le catalogue chargeait bien via `GET /api/v1/produits`, mais la confirmation de commande échouait avec `POST /api/v1/commandes -> 422 PRODUCT_NOT_FOUND` sur des produits pourtant visibles dans l'UI.

La vraie cause n'était pas le panier Angular. Le problème venait de l'appel **inter-service** `order-service -> product-service` :

- le client interne partagé signait certains `GET` avec un corps `undefined`,
- Express normalisait ensuite le corps reçu côté service en `{}`,
- la vérification HMAC interne comparait donc deux signatures différentes,
- le `product-service` répondait `INTERNAL_AUTH_INVALID`,
- puis le `order-service` transformait trop vite cet échec en `PRODUCT_NOT_FOUND`, ce qui envoyait l'équipe sur une fausse piste.

Correctif appliqué :

- normalisation du corps signé dans `shared/utils/internal-http.js` pour les requêtes sans payload,
- conservation d'une erreur plus fidèle côté `order-service` quand l'amont échoue pour une autre raison qu'un vrai `404 produit`,
- ajout d'un vrai test `POST /api/v1/commandes` dans `npm run test:gateway-suite`.

Leçon projet : quand un produit est visible dans le catalogue mais « introuvable » au checkout, il faut vérifier aussi les **signatures inter-services** et pas seulement la base ou le front.

## Pack QA

- Smoke checks : `npm test`
- Collection Postman : `postman/amaz-backend-e2e.postman_collection.json`
- Checklist revue de sécurité : `docs/security-risk-review.md`

## Notes

- La preuve de travail et le rate limiting sont appliqués via un middleware partagé.
- La gestion des tokens/sessions utilise des tokens opaques signés avec révocation en base de données.
- Le serveur Socket.IO tourne sur le messaging-service (`MESSAGING_SERVICE_PORT`, namespace `/messages`).
- Les retours fonctionnent dans un service dédié PostgreSQL exposé via les routes gateway `/api/v1/retours` et `/api/v1/returns`.
