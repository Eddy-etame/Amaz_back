# Vérification locale (Amaz_back)

## Prérequis

1. **PostgreSQL + MongoDB** en cours d'exécution (`docker compose up -d` depuis `Amaz_back`).
2. **Migrations + seed** : `npm run db:bootstrap` (utilise `PG_*` depuis `.env` — doit correspondre aux services).
3. **Stack API complète** sur les ports localhost **3000–3008** (ex. `docker compose -f docker-compose.full.yml up -d --build`).
4. **`.env`** dans `Amaz_back` avec les secrets documentés dans [README.md](../README.md).

## Vérification backend en une commande

Depuis `Amaz_back` :

```bash
npm run verify:local
```

Cela exécute dans l'ordre :

1. `npm test` — tests statiques de structure / câblage (pas de réseau).
2. `npm run test:contract-smoke` — santé par service + contrat PoW minimal via la gateway.
3. `npm run qa:campaign` — `/health` sur la gateway et chaque port de service.
4. `npm run test:gateway-suite` — PoW + register/login + produits + commandes + wishlist + IA + messages + bot auth.
5. `npm run test:e2e-auth` — login + `/auth/me` avec des identifiants de type seed.

**Échecs :** Si les étapes 2+ échouent avec des erreurs de connexion, la stack n'est pas démarrée ou les ports sont incorrects. Si l'auth échoue avec `42703`, exécuter `npm run db:bootstrap` contre la même base de données que celle utilisée par le user-service.

## Sauter des étapes (CI ou exécutions partielles)

| Variable | Effet |
|----------|-------|
| `VERIFY_SKIP_SMOKE=1` | Sauter le `npm test` statique |
| `VERIFY_SKIP_CONTRACT=1` | Sauter le smoke de contrat |
| `VERIFY_SKIP_HEALTH=1` | Sauter la campagne de santé QA |
| `VERIFY_SKIP_GATEWAY=1` | Sauter la suite API gateway |
| `VERIFY_SKIP_E2E_AUTH=1` | Sauter l'auth e2e |
| `VERIFY_NETWORK_ONLY=1` | Uniquement les étapes réseau (sauter le smoke statique) |

Exemple : smoke statique uniquement (pas de Docker) :

```bash
VERIFY_SKIP_CONTRACT=1 VERIFY_SKIP_HEALTH=1 VERIFY_SKIP_GATEWAY=1 VERIFY_SKIP_E2E_AUTH=1 npm run verify:local
```

## Builds frontend (séparés)

Les applications Angular ne sont pas exécutées par `verify:local`. Après que le backend est au vert (depuis la racine du dépôt) :

```bash
cd users && npx ng build
cd ../vendors && npx ng build
cd ../qa-lab && npx ng build
```

Depuis `Amaz_back` on peut utiliser `cd ../users && npx ng build` si `users` se trouve à côté de `Amaz_back`.

**Tests unitaires (users) :**

- `cd users && npx ng test` — Karma/Jasmine (peut ouvrir un navigateur sauf si configuré en headless).
- `cd users && npm run test:unit` — Vitest pour les utilitaires purs / `ShareService.absoluteUrl` (headless).

## PWA (vitrine users)

L'application `users` embarque uniquement un **Web App Manifest** (`manifest.webmanifest`) : nom de raccourci installable, couleurs du thème, `start_url`. Il n'y a **pas de service worker** et **pas de mise en cache des réponses API** par conception (évite le panier, stock et prix périmés pendant les démonstrations). Ajouter un SW plus tard nécessiterait une stratégie de cache explicite documentée ici.

## PoW

Tous les appels gateway depuis `users` continuent d'utiliser les en-têtes **Proof-of-Work** existants via `securityHeadersInterceptor` ; les scripts de vérification (`test:gateway-suite`, `test:contract-smoke`) exercent ce contrat.

## Catalogue, filtres PLP et suggestions de recherche (manuel)

Après le démarrage de Mongo :

1. **Re-seeder le catalogue** (depuis `Amaz_back`) : `npm run db:mongo:init`
   - On s'attend à **plus de 400** produits au total (legacy + générés).

2. **Smoke API** (avec gateway + PoW comme dans `test:gateway-suite`, ou authentifié selon l'environnement) :
   - `GET /api/v1/produits?limit=500` — `data.pagination.total` devrait être **> 400** après le reseed.
   - `GET /api/v1/produits/suggest?q=bu&limit=8` — `data.items` non vide quand le catalogue matche ; chaque élément devrait inclure les champs image et prix.

3. **Vitrine users** (`cd ../users && npx ng serve` ou la commande habituelle) :
   - **PLP :** Définir un prix min (ex. 100), cliquer **Appliquer** — aucun produit en dessous du min ; l'URL contient `minPrix` (et `maxPrix` si défini). Le rafraîchissement conserve les filtres.
   - **Barre de recherche :** Taper au moins 2 caractères — le menu déroulant affiche **miniature + titre + prix** (suggestion serveur quand en ligne ; repli sur le catalogue en mémoire si la requête échoue).

Voir aussi [MICROSERVICES_FRONTEND_MAP.md](./MICROSERVICES_FRONTEND_MAP.md) pour le mapping services → Angular.
