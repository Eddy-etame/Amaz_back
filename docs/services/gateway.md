# Service Gateway

**Port :** 3000  
**Rôle :** Point d'entrée API pour toutes les requêtes client. Applique la preuve de travail (PoW), le rate limiting et l'authentification avant de relayer vers les services en aval.

## Dépendances

- Aucune (pas de base de données). Proxie vers tous les autres services.

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| GATEWAY_PORT | Non | 3000 | Port HTTP |
| GATEWAY_HOST | Non | 0.0.0.0 | Adresse d'écoute |
| INTERNAL_SHARED_SECRET | Oui | - | Secret partagé pour signer les requêtes internes |
| INTERNAL_TRUST_MODE | Non | `shared_secret` | **Développement :** `shared_secret` (défaut) — le proxy signe avec `INTERNAL_SHARED_SECRET`. **Cible production (contrat v1.2) :** `mtls` — confiance mutuelle TLS entre Gateway et microservices ; les en-têtes `X-User-Id` / `X-User-Role` (ou équivalents `x-auth-user-id` / `x-auth-role` côté proxy actuel) complètent l'identité après terminaison mTLS. La valeur `mtls` est **documentaire** pour l'instant : l'implémentation reste `shared_secret` tant que l'infra réseau (Proxmox/VLAN/certificats) n'est pas branchée. |
| POW_DIFFICULTY | Non | 3 | Nombre de zéros en tête requis dans le hash PoW |
| POW_WINDOW_MS | Non | 120000 | Fenêtre de validité PoW (ms) |
| RATE_LIMIT_WINDOW_MS | Non | 60000 | Fenêtre du rate limit (ms) |
| RATE_LIMIT_MAX | Non | 120 | Nombre max de requêtes par fenêtre |
| CORS_ALLOWED_ORIGINS | Non | (toutes) | Origines autorisées, séparées par des virgules |
| USERS_SERVICE_URL | Non | http://localhost:3001 | URL du user-service |
| PRODUCTS_SERVICE_URL | Non | http://localhost:3002 | URL du product-service |
| ORDERS_SERVICE_URL | Non | http://localhost:3003 | URL de l'order-service |
| MESSAGING_SERVICE_URL | Non | http://localhost:3004 | URL du messaging-service |
| RETURNS_SERVICE_URL | Non | http://localhost:3008 | URL du returns-service |
| AI_SERVICE_URL | Non | http://localhost:3005 | URL de l'ai-service |
| PEPPER_SERVICE_URL | Non | http://localhost:3006 | URL du pepper-service |

## Routes publiques

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Vivacité de la gateway |
| GET | /health/aggregate | Statut gateway + tous les services |

## Routes API (en-têtes PoW requis)

| Chemin | Proxie vers | Auth requise |
|--------|-------------|--------------|
| /api/v1/auth/* | user-service | Chemins publics : login, register, signup, vérification, réinitialisation mot de passe, refresh |
| /api/v1/addresses | user-service | Oui |
| /api/v1/produits, /api/v1/products | product-service | **GET :** PoW + **auth optionnelle** (Bearer → en-têtes `x-auth-*` vers le service). **Mutation :** Bearer obligatoire. |
| /api/v1/commandes, /api/v1/orders | order-service | Oui |
| /api/v1/messages | messaging-service | Oui |
| /api/v1/retours, /api/v1/returns | returns-service | Oui |
| /api/v1/ai/* | ai-service | Oui (Bearer) |
| /api/v1/bot/* | ai-service | **POST /api/v1/bot/auth :** PoW uniquement (contrat v1.2). Autres routes bot : Bearer requis. |

### Erreurs PoW (contrat v1.2)

Toutes les réponses d'échec de preuve de travail côté gateway utilisent le **HTTP 403** et le message générique **« Preuve invalide »** (code métier `POW_*` conservé dans le corps JSON pour le diagnostic, sans fuite d'information sur la cause exacte).

### Appels internes Gateway → microservices

- **Aujourd'hui :** requêtes HTTP signées (`x-internal-signature`, etc.) avec `INTERNAL_SHARED_SECRET`.
- **Cible documentée :** mTLS entre nœuds + propagation d'identité ; variable `INTERNAL_TRUST_MODE=mtls` décrit l'intention ; pas de suppression du mode `shared_secret` sans validation ops.

## Appelants autorisés

Clients (avec des en-têtes PoW valides et un token Bearer optionnel pour les routes protégées).
