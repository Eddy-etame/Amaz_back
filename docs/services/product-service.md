# Service Produit (Product Service)

**Port :** 3002  
**Rôle :** Catalogue de produits, gestion du stock et réservation/libération de stock pour les commandes.

## Dépendances

- MongoDB (collection products)
- PostgreSQL (lecture seule — vérification de l'approbation vendeur pour les mutations catalogue)

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| PRODUCT_SERVICE_PORT | Non | 3002 | Port HTTP |
| INTERNAL_SHARED_SECRET | Oui | - | Secret partagé pour l'auth interne |
| MONGO_URI, MONGO_DB_NAME | Oui | - | Connexion MongoDB |
| PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE | Oui | - | Connexion PostgreSQL (approbation vendeur) |

## Routes principales

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Vivacité |
| GET | /produits | Lister les produits (paginé, filtrable) |
| GET | /produits/:id | Obtenir un produit par ID |
| POST | /produits | Créer un produit (rôle vendeur) |
| PUT | /produits/:id | Modifier un produit (rôle vendeur) |
| DELETE | /produits/:id | Supprimer un produit (rôle vendeur) |
| POST | /internal/produits/:id/reserve | Réserver du stock (order-service uniquement) |
| POST | /internal/produits/:id/release | Libérer du stock (order-service uniquement) |

## Appelants internes autorisés

- gateway
- order-service

## Modèle de données (MongoDB)

- **products** : id, title, description, price, category, city, stock, vendorId, status, sku, image, gallery, rating, reviewCount, createdAt, updatedAt
