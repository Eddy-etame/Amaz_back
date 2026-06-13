# Service Retours (Returns Service)

**Port :** 3008  
**Rôle :** Flux de retours dédié pour les demandes de retour créées par les acheteurs et le traitement côté vendeur/admin.

## Dépendances

- PostgreSQL (`orders`, `order_items`, `return_requests`, `return_items`, `return_status_history`)
- Middleware d'auth interne partagé (`INTERNAL_SHARED_SECRET`)

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| RETURNS_SERVICE_PORT | Non | 3008 | Port HTTP |
| RETURNS_SERVICE_HOST | Non | 0.0.0.0 | Adresse d'écoute |
| INTERNAL_SHARED_SECRET | Oui | - | Secret partagé pour les requêtes internes signées |
| PG_HOST | Oui | - | Hôte PostgreSQL |
| PG_PORT | Oui | 5432 | Port PostgreSQL |
| PG_USER | Oui | - | Utilisateur PostgreSQL |
| PG_PASSWORD | Oui | - | Mot de passe PostgreSQL |
| PG_DATABASE | Oui | - | Base de données PostgreSQL |

## Routes directes

Ces routes sont **internes uniquement** et nécessitent les en-têtes signés `x-internal-*` provenant de la gateway.

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Vivacité du service |
| GET | /retours | Lister les retours (portée vendeur/acheteur/admin) |
| GET | /retours/:returnId | Détail d'un retour |
| POST | /retours | Créer une demande de retour (rôle acheteur uniquement) |
| PUT | /retours/:returnId/statut | Mettre à jour le statut d'un retour (vendeur/admin uniquement) |

## Règles métier

- Un acheteur ne peut créer un retour que pour une commande qui lui appartient.
- Une demande de retour ne peut cibler que des articles d'**un seul vendeur**.
- Les lectures et mises à jour de statut par un vendeur sont restreintes aux demandes correspondant à son identifiant vendeur.
- La gateway alias les chemins `/api/v1/retours/*` et `/api/v1/returns/*` vers ce service.
