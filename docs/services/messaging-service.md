# Messaging Service

**Port:** 3004  
**Purpose:** User-vendor messaging (conversations and messages) and Socket.IO real-time updates.

## Dependencies

- MongoDB (conversations, messages collections)

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| MESSAGING_SERVICE_PORT | No | 3004 | HTTP port |
| INTERNAL_SHARED_SECRET | Yes | - | Shared secret for internal auth |
| MONGO_URI, MONGO_DB_NAME | Yes | - | MongoDB connection |
| SOCKET_NAMESPACE | No | /messages | Socket.IO namespace |

## Main Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /messages/conversations | List conversations |
| GET | /messages/:produitId | Messages for product context |
| POST | /messages | Send message |

## Socket.IO

- **Namespace:** /messages
- **Events:** connection, message, etc.

## Allowed Internal Callers

- gateway

## Data Model (MongoDB)

- **conversations**: id, userId, vendorId, productId, orderId, subject, unreadByUser, unreadByVendor, lastMessageAt
- **messages**: id, conversationId, senderId, content, userId, vendorId, productId, orderId, sentAt, readByUser, readByVendor
