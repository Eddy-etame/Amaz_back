const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { getMongoDb } = require('../../../shared/db/mongo');
const { randomId } = require('../../../shared/utils/ids');
const { config } = require('./config');

async function getCollections() {
  const db = await getMongoDb();
  return {
    conversations: db.collection('conversations'),
    messages: db.collection('messages')
  };
}

function deriveConversationData(payload, auth) {
  const role = String(auth.role || '');
  const senderId = String(auth.userId || '');
  const senderName = String(payload.senderName || (role === 'vendor' ? 'Vendeur' : 'Client'));
  const content = String(payload.content || payload.contenu || '').trim();
  const productId = String(payload.productId || payload.produitId || '').trim() || undefined;
  const productTitle = String(payload.productTitle || '').trim() || undefined;
  const orderId = String(payload.orderId || '').trim() || undefined;
  const subject = String(payload.subject || 'Message').trim();

  let userId = String(payload.userId || '').trim();
  let vendorId = String(payload.vendorId || payload.destinataireId || '').trim();

  if (role === 'user') userId = senderId;
  if (role === 'vendor') {
    vendorId = senderId;
    if (!userId) userId = String(payload.destinataireId || '').trim();
  }

  return {
    role,
    senderId,
    senderName,
    content,
    userId,
    vendorId,
    productId,
    productTitle,
    orderId,
    subject
  };
}

function assertUserVendorOnly(data) {
  if (!data.userId || !data.vendorId) return 'userId et vendorId sont requis';
  if (!['user', 'vendor'].includes(data.role)) return 'Rôle expéditeur invalide';
  if (data.role === 'user' && data.senderId !== data.userId) return 'Un user ne peut envoyer que pour lui-même';
  if (data.role === 'vendor' && data.senderId !== data.vendorId) return 'Un vendeur ne peut envoyer que pour lui-même';
  return null;
}

async function appendMessage({ payload, auth }) {
  const parsed = deriveConversationData(payload, auth);
  const validationError = assertUserVendorOnly(parsed);
  if (validationError) throw new Error(validationError);
  if (!parsed.content) throw new Error('Message vide');

  const now = new Date().toISOString();
  const { conversations, messages } = await getCollections();
  const conversationFilter = {
    userId: parsed.userId,
    vendorId: parsed.vendorId,
    productId: parsed.productId || null,
    orderId: parsed.orderId || null
  };

  let conversation = await conversations.findOne(conversationFilter);
  if (!conversation) {
    conversation = {
      id: randomId('conv'),
      userId: parsed.userId,
      userName: String(payload.userName || 'Client'),
      vendorId: parsed.vendorId,
      vendorName: String(payload.vendorName || 'Vendeur'),
      subject: parsed.subject,
      productId: parsed.productId || null,
      productTitle: parsed.productTitle || null,
      orderId: parsed.orderId || null,
      unreadByVendor: parsed.role === 'user' ? 1 : 0,
      unreadByUser: parsed.role === 'vendor' ? 1 : 0,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now
    };
    await conversations.insertOne(conversation);
  } else {
    await conversations.updateOne(
      { id: conversation.id },
      {
        $set: {
          updatedAt: now,
          lastMessageAt: now,
          unreadByVendor: parsed.role === 'user' ? Number(conversation.unreadByVendor || 0) + 1 : 0,
          unreadByUser: parsed.role === 'vendor' ? Number(conversation.unreadByUser || 0) + 1 : 0
        }
      }
    );
  }

  const message = {
    id: randomId('msg'),
    conversationId: conversation.id,
    senderId: parsed.senderId,
    senderName: parsed.senderName,
    senderRole: parsed.role,
    content: parsed.content,
    userId: parsed.userId,
    vendorId: parsed.vendorId,
    productId: parsed.productId || null,
    productTitle: parsed.productTitle || null,
    orderId: parsed.orderId || null,
    sentAt: now,
    readByVendor: parsed.role === 'vendor',
    readByUser: parsed.role === 'user'
  };

  await messages.insertOne(message);
  return message;
}

function createMessagingServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(requestIdMiddleware);

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: { service: 'messaging-service', status: 'ok' },
      requestId: req.requestId
    });
  });

  app.use(
    createInternalAuthMiddleware({
      secret: config.internalSharedSecret,
      allowedServices: ['gateway']
    })
  );

  app.get('/messages/conversations', async (req, res, next) => {
    try {
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();
      const role = String(req.headers['x-auth-role'] || '').trim();
      const { conversations } = await getCollections();

      if (!authUserId || !['user', 'vendor', 'admin'].includes(role)) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentification requise'
          },
          requestId: req.requestId
        });
      }

      const filter = {};
      if (role === 'vendor') filter.vendorId = authUserId;
      if (role === 'user') filter.userId = authUserId;
      if (req.query.productId) filter.productId = String(req.query.productId);
      if (req.query.orderId) filter.orderId = String(req.query.orderId);

      const items = await conversations.find(filter).sort({ lastMessageAt: -1 }).limit(200).toArray();
      return res.status(200).json({
        success: true,
        data: { items },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/messages/:produitId', async (req, res, next) => {
    try {
      const productId = String(req.params.produitId || '').trim();
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();
      const role = String(req.headers['x-auth-role'] || '').trim();
      const { messages } = await getCollections();

      const filter = { productId };
      if (role === 'vendor') filter.vendorId = authUserId;
      if (role === 'user') filter.userId = authUserId;

      const items = await messages.find(filter).sort({ sentAt: 1 }).limit(300).toArray();
      return res.status(200).json({
        success: true,
        data: { items },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/messages', async (req, res) => {
    try {
      const auth = {
        userId: String(req.headers['x-auth-user-id'] || '').trim(),
        role: String(req.headers['x-auth-role'] || '').trim()
      };
      const message = await appendMessage({ payload: req.body, auth });
      return res.status(201).json({
        success: true,
        data: message,
        requestId: req.requestId
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MESSAGE_INVALID',
          message: error.message
        },
        requestId: req.requestId
      });
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: true, credentials: true }
  });

  const namespace = io.of(config.socketNamespace);
  namespace.use((socket, next) => {
    const userId = String(socket.handshake.auth?.userId || socket.handshake.auth?.vendorId || '').trim();
    const role = String(socket.handshake.auth?.role || '').trim();
    if (!userId || !['user', 'vendor'].includes(role)) {
      return next(new Error('Socket auth invalid'));
    }
    socket.data.auth = {
      userId,
      role
    };
    return next();
  });

  namespace.on('connection', (socket) => {
    const auth = socket.data.auth;
    socket.join(`${auth.role}:${auth.userId}`);

    socket.on('message.new', async (payload) => {
      try {
        const stored = await appendMessage({
          payload,
          auth: {
            userId: auth.userId,
            role: auth.role
          }
        });
        namespace.to(`user:${stored.userId}`).emit('message.new', stored);
        namespace.to(`vendor:${stored.vendorId}`).emit('message.new', stored);
      } catch (error) {
        socket.emit('message.error', {
          code: 'MESSAGE_INVALID',
          message: error.message
        });
      }
    });
  });

  return { app, server, io };
}

module.exports = {
  createMessagingServer
};
