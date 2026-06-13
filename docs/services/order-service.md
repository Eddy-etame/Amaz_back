# Service Commandes (Order Service)

**Port :** 3003  
**Rôle :** Création de commandes, gestion des statuts et flux de checkout. Réserve le stock produit et notifie les utilisateurs.

## Dépendances

- PostgreSQL (orders, order_items, payment_attempts)
- Product service (réservation/libération de stock)
- User service (recherche utilisateur, notifications par email)

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| ORDER_SERVICE_PORT | Non | 3003 | Port HTTP |
| INTERNAL_SHARED_SECRET | Oui | - | Secret partagé pour l'auth interne |
| PRODUCTS_SERVICE_URL | Non | http://localhost:3002 | URL du product-service |
| USERS_SERVICE_URL | Non | http://localhost:3001 | URL du user-service |
| PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE | Oui | - | Connexion PostgreSQL |
| INTERNAL_FETCH_TIMEOUT_MS | Non | 7000 | Timeout des appels HTTP internes |

## Routes principales

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Vivacité |
| POST | /commandes | Créer une commande |
| GET | /commandes | Lister les commandes (utilisateur) |
| GET | /commandes/:id | Obtenir une commande par ID |
| PUT | /commandes/:id/annuler | Annuler une commande |
| PUT | /commandes/:id/statut | Mettre à jour le statut d'une commande |

## Appelants internes autorisés

- gateway

## Problème rencontré pendant l'intégration

Un bug assez piégeux est apparu sur le checkout :

- le front chargeait bien les produits via la gateway,
- mais `POST /api/v1/commandes` renvoyait `422 PRODUCT_NOT_FOUND` sur des ids pourtant visibles dans le catalogue.

En pratique, le souci venait de l'appel signé `order-service -> product-service` pour `GET /produits/:id` :

- le helper partagé `shared/utils/internal-http.js` signait la requête avec un corps `undefined`,
- Express exposait ensuite `req.body = {}` côté service receveur,
- la signature HMAC interne ne matchait plus,
- le `product-service` renvoyait `INTERNAL_AUTH_INVALID`,
- et le `order-service` masquait cette erreur sous `PRODUCT_NOT_FOUND`.

Correctif retenu :

- aligner le corps utilisé pour la signature sur le corps réellement vérifié pour les requêtes sans payload,
- ne plus transformer tout échec amont en faux `PRODUCT_NOT_FOUND`,
- couvrir le scénario avec un vrai test `POST /api/v1/commandes` dans la suite gateway.

## Modèle de données (PostgreSQL)

- **orders** : id, user_id, status, total_amount, currency, estimated_delivery_at, delivered_at, shipping_address, payment_status, payment_method
- **order_items** : id, order_id, product_id, product_title, unit_price, quantity, vendor_id
- **payment_attempts** : id, order_id, provider, amount, currency, status
