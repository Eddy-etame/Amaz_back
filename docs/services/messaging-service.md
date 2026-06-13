# Service Messagerie (Messaging Service)

**Port :** 3004  
**Rôle :** Messagerie acheteur-vendeur (conversations et messages) et mises à jour en temps réel via Socket.IO.

## Dépendances

- MongoDB (collections conversations, messages)

## Variables d'environnement

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| MESSAGING_SERVICE_PORT | Non | 3004 | Port HTTP |
| INTERNAL_SHARED_SECRET | Oui | - | Secret partagé pour l'auth interne |
| MONGO_URI, MONGO_DB_NAME | Oui | - | Connexion MongoDB |
| SOCKET_NAMESPACE | Non | /messages | Namespace Socket.IO |

## Routes principales

| Méthode | Chemin | Description |
|---------|--------|-------------|
| GET | /health | Vivacité |
| GET | /messages/conversations | Lister les conversations |
| GET | /messages/:produitId | Messages dans le contexte d'un produit |
| POST | /messages | Envoyer un message |

## Socket.IO

- **Namespace :** /messages
- **Authentification :** payload `{ userId, role }` lors de la connexion (`role: 'user'` ou `role: 'vendor'`)
- **Événements :** `connection`, `message` (réception d'un nouveau message en temps réel)
- **Règle serveur :** seuls les échanges acheteur-vendeur sont autorisés (pas de canal acheteur-acheteur)

## Appelants internes autorisés

- gateway

## Modèle de données (MongoDB)

- **conversations** : id, userId, vendorId, productId, orderId, subject, unreadByUser, unreadByVendor, lastMessageAt
- **messages** : id, conversationId, senderId, content, userId, vendorId, productId, orderId, sentAt, readByUser, readByVendor
