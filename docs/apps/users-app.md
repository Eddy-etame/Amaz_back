# Application « users » (boutique côté client)

Angular dans le dossier `users/`. C’est la vitrine : catalogue, fiche produit, panier, commandes, compte, etc.

## Comment elle parle au backend

On ne tape **jamais** les microservices en direct sur leurs ports 3001–3006 depuis le navigateur pour le métier. Tout passe par la **gateway** (`environment.apiBaseUrl`, en dev souvent `http://localhost:3000`).

Le fichier `src/app/core/services/gateway-api.service.ts` centralise les URLs : il préfixe juste le chemin (ex. `/api/v1/produits`). Les en-têtes sensibles ne sont pas recopiés partout : l’intercepteur `security-headers.interceptor.ts` ajoute la **preuve de travail (PoW)** et les infos utiles sur les requêtes gateway, ce qui évite d’oublier un header et de se prendre un 403 systématique.

## Logique métier côté client

- **Catalogue** : chargement des produits via l’API produits (agrégation dans des stores type `ProductCatalogStore`), filtres et recherche côté UI + paramètres d’URL pour partager un lien filtré.
- **Auth** : login / register sur les routes `/api/v1/auth/...` ; les tokens sont gérés comme prévu dans le projet (session utilisateur, refresh, etc. — voir `AuthService` et les guards de routes).
- **Commandes** : création et historique via les routes commandes derrière la gateway, avec auth obligatoire.
- **Recommandations** : l’app peut combiner des idées renvoyées par le service AI avec le catalogue déjà chargé (évite une page vide si l’AI répond lentement).

## Ce qu’on aurait fait différemment avec plus de temps

On documenterait chaque écran en capture dans le manuel utilisateur ; pour l’instant le texte suffit pour expliquer le flux à l’oral devant le jury.

## Voir aussi

- `users/DOCUMENTATION.md` (raccourci dans le dossier du projet)
- [MICROSERVICES_FRONTEND_MAP.md](../MICROSERVICES_FRONTEND_MAP.md)
