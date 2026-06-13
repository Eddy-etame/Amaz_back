# Mapping microservices et vitrine (users)

**Récit / mémoire :** voir [`PLAN_MEMOIRE_DOCUMENTATION.md`](PLAN_MEMOIRE_DOCUMENTATION.md). **Bundle PDF :** lancer `npm run docs:pdf` depuis `Amaz_back` → fichiers dans [`docs/pdf/`](../../docs/pdf/) à la racine du dépôt.

Point d'entrée unique depuis Angular : [`users/src/app/core/services/service-api-gateway.ts`](../../users/src/app/core/services/service-api-gateway.ts) (URL de base + chemin). Les en-têtes **Proof-of-Work** et d'authentification sont ajoutés par [`users/src/app/core/http/intercepteur-entetes-securite.ts`](../../users/src/app/core/http/intercepteur-entetes-securite.ts) pour les appels gateway.

Fiches détaillées par service : [`docs/services/README.md`](services/README.md).

## Vue d'ensemble des services

| Service | Responsabilité | Persistance | Routes HTTP principales (derrière la gateway) | Points de contact frontend |
|---------|---------------|-------------|------------------------------------------------|---------------------------|
| **gateway** | Porte PoW, routage, transmission auth, `X-Request-Id` | — | `/api/v1/*` | Tous les appels `HttpClient` vers `environment.apiBaseUrl` |
| **user-service** | Inscription, connexion, **tokens opaques signés** (HMAC + DB), profils | PostgreSQL | `/auth/*`, adresses, routes admin (proxiées) | `ServiceAuth`, routes login/register, `DepotSessionUtilisateur` |
| **product-service** | CRUD catalogue, listings, wishlists | MongoDB `products`, collections wishlist | `/produits`, `/produits/suggest`, `/produits/:id`, `/wishlists/*` | `ServiceProduits`, `DepotCatalogueProduits`, PLP/PDP, `DepotFavoris`, suggestion top-bar |
| **order-service** | Cycle de vie des commandes, coordination stock | PostgreSQL | `/commandes/*` | `ServiceCommandes`, `DepotEtatCommandes`, checkout, historique commandes |
| **messaging-service** | Fils vendeur/client | MongoDB | `/messages/*` | Interface de messagerie (surfaces de chat vendeur) |
| **returns-service** | Flux de retours avec portée vendeur/acheteur | PostgreSQL | `/retours/*`, `/returns/*` | Espace retours vendeur, flux retours acheteur |
| **ai-service** | Recommandations textuelles de produits, scoring de risque auth | MongoDB (logs + lecture produit pour les recs) | `/ai/recommendations`, `/bot/auth` | `ServiceIa` ; recommandations accueil via `DepotEtatCommandes` (fusionnées avec le catalogue) |
| **pepper-service** | Peppering HMAC interne pour le hachage de mots de passe/tokens (user-service uniquement) | En mémoire (secret maître depuis env) | `/internal/pepper/hash` (interne uniquement) | Non exposé aux frontends ; appelé exclusivement par le user-service |
| **admin-service** | CRUD AdminJS / UI d'opérations | PostgreSQL | Pas sur le port gateway 3000 ; direct `http://localhost:3010/admin` (dev) | Opérateurs ; voir `docs/ADMIN_RUNBOOK.md` |

## Séquence : soumission de recherche vers la PLP

```mermaid
sequenceDiagram
  participant Utilisateur
  participant Angular as Angular_users
  participant Interceptor as Intercepteur_PoW
  participant Gateway
  participant ProductSvc as product_service

  Utilisateur->>Angular: Soumet le formulaire de recherche (top bar)
  Angular->>Angular: Navigation Router vers /produits?q=...
  Note over Angular: La PLP lit les query params ; DepotCatalogueProduits éventuellement déjà chargé
  Utilisateur->>Angular: Saisie dans la barre de recherche (suggestions)
  Angular->>Interceptor: GET /produits/suggest?q=
  Interceptor->>Gateway: En-têtes PoW + requête
  Gateway->>ProductSvc: Forward GET /produits/suggest
  ProductSvc-->>Gateway: JSON items (title, image, price, ...)
  Gateway-->>Angular: 200 + corps
  Angular->>Utilisateur: Lignes déroulantes avec image et prix
  Utilisateur->>Angular: Soumet ou ouvre la PLP
  Angular->>Interceptor: GET /produits?limit=... (chargement catalogue)
  Interceptor->>Gateway: En-têtes PoW + requête
  Gateway->>ProductSvc: Forward GET /produits
  ProductSvc-->>Gateway: items + pagination
  Gateway-->>Angular: Catalogue dans DepotCatalogueProduits
  Angular->>Utilisateur: Grille PLP + filtres client (catégorie, prix, q)
```

## Seed et volumétrie du catalogue

- Seed Mongo : `npm run db:mongo:init` (depuis `Amaz_back`) — produits legacy plus lignes générées (`db/mongo/init.js`).
- La vitrine pagine 250 produits par page, jusqu'à 40 pages (voir la boucle de pages dans `DepotCatalogueProduits`). Le product-service plafonne `limit` à 2000 par requête.
