# Guide de lecture — backend `Amaz_back`

Ce guide explique **comment lire le code backend** : par où commencer, à quoi sert
chaque dossier, et comment une requête voyage du navigateur jusqu'à la base. Il se
lit avant de plonger dans les fiches détaillées de `docs/services/`.

## 1. L'idée en une image

```
Navigateur (Angular)
   │  HTTP + en-têtes PoW + Bearer
   ▼
GATEWAY (:3000)  ──►  vérifie PoW, rate-limit, IP/VPN, validation, auth
   │  ajoute la signature interne (x-internal-*)
   ▼
MICROSERVICE (:3001..:3008)  ──►  logique métier
   │
   ▼
BASE (PostgreSQL ou MongoDB selon le service)
```

Règle d'or : **le front ne parle qu'à la gateway**. Les microservices refusent tout
appel direct non signé (`INTERNAL_AUTH_REQUIRED`).

## 2. Le chemin d'une requête (à connaître pour la soutenance)

1. Le front calcule une **preuve de travail** et envoie la requête à `:3000/api/v1/...`.
2. La gateway applique, dans l'ordre, sa chaîne de middlewares (voir `gateway/src/app.js`) :
   **PoW → rate-limit → blocage IP/VPN → validation des entrées → auth Bearer**.
3. La gateway **proxifie** vers le bon service (`gateway/src/proxy.js`) en **signant**
   l'appel interne (HMAC) via `shared/utils/internal-http.js`.
4. Le service vérifie la signature (`shared/middleware/internal-auth.js`), exécute la
   logique, lit/écrit en base, et répond.
5. La gateway renvoie la réponse normalisée au front.

## 3. Carte des dossiers

### `gateway/` — le point d'entrée (port 3000)
| Fichier | Rôle |
|---------|------|
| `src/index.js` | Démarre le serveur. |
| `src/app.js` | **Cœur** : monte la chaîne de middlewares et les routes `/api/v1/*`. À lire en premier. |
| `src/config.js` | Lecture des variables d'env (ports, secrets, CORS, difficulté PoW). |
| `src/proxy.js` | Relaie la requête vers le bon microservice en signant l'appel interne. |
| `src/health-monitor.js` | Interroge la santé des services pour `/health/aggregate`. |
| `src/middlewares/auth.js` | Vérifie le token Bearer (obligatoire ou optionnel selon la route). |
| `src/middlewares/blocked-ip-check.js` | Refuse les IP présentes dans `blocked_ips`. |
| `src/middlewares/verifierVPN.js` | Bloque les accès via VPN/proxy connus. |
| `src/middlewares/input-validation.js` | Valide la forme des entrées (anti-injection). |

### `services/<nom>-service/` — un microservice métier
Tous suivent **la même structure en couches** (à comprendre une fois, valable partout) :
| Couche | Dossier | Rôle |
|--------|---------|------|
| Entrée | `src/index.js`, `src/app.js` | Démarrage + montage des routes et de l'auth interne. |
| Config | `src/config.js` | Variables d'env du service. |
| Routes | `src/routes/*.js` | Définissent les endpoints (HTTP) et appellent les services. |
| Métier | `src/services/*.js` | La **logique** (règles, validations, orchestration). |
| Données | `src/repositories/*.js` | Les requêtes SQL/Mongo (accès base isolé ici). |

Les 7 services : **user** (3001, Postgres), **product** (3002, Mongo), **order**
(3003, Postgres), **messaging** (3004, Mongo + Socket.IO), **ai** (3005, Mongo),
**pepper** (3006, sans base), **returns** (3008, Postgres). Détails dans `docs/services/`.

### `shared/` — code commun à tous les services
| Dossier | Contenu |
|---------|---------|
| `utils/` | Briques crypto (`crypto.js`), PoW (`pow.js`), signature interne (`internal-signature.js`), client HTTP interne (`internal-http.js`), empreinte (`fingerprint.js`), ids, validateurs. |
| `middleware/` | PoW (`pow-required.js`), auth interne (`internal-auth.js`), rate-limit, gestion d'erreurs, request-id. |
| `db/` | Connexions PostgreSQL (`postgres.js`) et MongoDB (`mongo.js`). |

> C'est ici que vit la **sécurité maison**. Ces fichiers sont commentés en détail —
> commence par `shared/utils/pow.js` et `shared/utils/crypto.js`.

### `admin-service/` — back-office AdminJS (port 3010)
Interface CRUD prête à l'emploi sur les tables Postgres (et catalogue Mongo en lecture).
`src/index.js` (serveur) + `src/admin-resources.cjs` (ressources exposées). Voir `docs/ADMIN_RUNBOOK.md`.

### `db/` — initialisation des bases
| Élément | Rôle |
|---------|------|
| `postgres/migrations/001..009_*.sql` | Création/évolution des tables (lues dans l'ordre). |
| `postgres/seed.js` | Données de démo (comptes de test, etc.). |
| `mongo/init.js` | Initialisation des collections Mongo (produits…). |

### `scripts/` — outillage (tests, bootstrap, docs)
`db-bootstrap.js` (migrations + seed), `generate-docs-pdf.js` (docs → PDF),
`run-gateway-api-suite.js` (régression API complète via la gateway), `run-qa-campaign.js`
(santé des services), `run-smoke-tests.js`, `run-e2e-auth.js`, `run-verify-local.js`.

## 4. « Où je regarde si… »

| Question | Fichier de départ |
|----------|-------------------|
| Comment marche la PoW ? | `shared/utils/pow.js`, puis `shared/middleware/pow-required.js` |
| Comment un mot de passe est haché ? | `shared/utils/crypto.js` (`hashPassword`) + `pepper-service` |
| Comment la gateway route vers un service ? | `gateway/src/app.js` puis `gateway/src/proxy.js` |
| Pourquoi un service refuse un appel direct ? | `shared/middleware/internal-auth.js` |
| Où sont les tables ? | `db/postgres/migrations/` + `docs/CDC_DB_CROSSCHECK.md` |
| Le flux de connexion (login) ? | `services/user-service/src/services/auth.service.js` + `token.service.js` |
| Le checkout / création de commande ? | `services/order-service/` + le contrat `docs/contrat-api.md` |
