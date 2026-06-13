# Service IA (AI Service)

**Port :** 3005  
**Rôle :** **Recommandeur de catalogue** de démonstration (Mongo `$regex` sur les champs produit + derniers produits lorsque la requête est vide), scoring d'authentification bot/risque — **pas** un LLM génératif. Journalise les requêtes dans `ai_logs`.

## Dépendances

- MongoDB (collections products, ai_logs)

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| AI_SERVICE_PORT | Non | 3005 | Port HTTP |
| INTERNAL_SHARED_SECRET | Oui | - | Secret partagé pour l'auth interne |
| MONGO_URI, MONGO_DB_NAME | Oui | - | Connexion MongoDB |

## Routes principales

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Vivacité |
| POST | /ai/recommendations | Obtenir des recommandations de produits par requête |
| POST | /bot/auth | Score de risque d'authentification bot (state, action) |

## Appelants internes autorisés

- gateway

## Modèle de données (MongoDB)

- **products** : lecture pour les recommandations
- **ai_logs** : journalise les requêtes de recommandation et d'authentification bot
