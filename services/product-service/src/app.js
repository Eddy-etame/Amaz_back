const express = require('express');
const { ObjectId } = require('mongodb');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { createRateLimitMiddleware } = require('../../../shared/middleware/rate-limit');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { getMongoDb } = require('../../../shared/db/mongo');
const { randomId } = require('../../../shared/utils/ids');
const { config } = require('./config');
const { requireApprovedVendor } = require('./middlewares/approved-vendor');

async function getProductsCollection() {
  const db = await getMongoDb();
  return db.collection('products');
}

function normalizeProductId(id) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireVendorRole(req, res, next) {
  const role = (req.headers['x-auth-role'] || '').toString().trim();
  if (!['vendor', 'admin'].includes(role)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Rôle vendeur requis'
      },
      requestId: req.requestId
    });
  }
  return next();
}

function requireOrderServiceCaller(req, res, next) {
  if (req.internalCaller !== 'order-service') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Endpoint réservé au service commande'
      },
      requestId: req.requestId
    });
  }
  return next();
}

function mapProduct(product) {
  return {
    id: product.id || product._id?.toString(),
    title: product.title,
    titre: product.title,
    description: product.description || '',
    shortDescription: product.shortDescription || '',
    descriptionCourte: product.shortDescription || '',
    detailedDescription: product.detailedDescription || '',
    descriptionDetaillee: product.detailedDescription || '',
    price: product.price,
    prix: product.price,
    category: product.category || 'Général',
    categorie: product.category || 'Général',
    city: product.city || '',
    ville: product.city || '',
    stock: product.stock ?? 0,
    sku: product.sku || '',
    lowStockThreshold: product.lowStockThreshold ?? 5,
    image: product.image || '',
    imagePrincipale: product.image || '',
    gallery: product.gallery || [],
    galerie: product.gallery || [],
    vendorId: product.vendorId,
    nomVendeur: product.nomVendeur || product.vendorName || '',
    vendorName: product.nomVendeur || product.vendorName || '',
    status: product.status || 'published',
    rating: Number(product.rating || 0),
    note: Number(product.rating || 0),
    reviewCount: Number(product.reviewCount || 0),
    nbAvis: Number(product.reviewCount || 0),
    strikethroughPrice:
      product.strikethroughPrice === null || product.strikethroughPrice === undefined
        ? null
        : Number(product.strikethroughPrice),
    prixBarre:
      product.strikethroughPrice === null || product.strikethroughPrice === undefined
        ? null
        : Number(product.strikethroughPrice),
    freeShipping: Boolean(product.freeShipping),
    livraisonGratuite: Boolean(product.freeShipping),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(requestIdMiddleware);

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'product-service',
        status: 'ok'
      },
      requestId: req.requestId
    });
  });

  app.get('/health/seed', async (req, res) => {
    try {
      const collection = await getProductsCollection();
      const count = await collection.countDocuments({});
      if (count === 0) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'PRODUCTS_NOT_SEEDED',
            message: 'Products collection is empty. Run npm run db:bootstrap in Amaz_back.'
          },
          requestId: req.requestId
        });
      }
      return res.json({
        success: true,
        data: { service: 'product-service', productsCount: count, seeded: true },
        requestId: req.requestId
      });
    } catch (err) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SEED_CHECK_FAILED',
          message: err?.message || 'Unable to check products collection'
        },
        requestId: req.requestId
      });
    }
  });

  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'product-service',
        port: config.port,
        message: 'Internal microservice. Do not call directly from clients.',
        usage: {
          apiCalls: 'Use http://localhost:3000/api/v1/... for client/API requests (via gateway)',
          healthCheck: `Use http://localhost:${config.port}/health for liveness`,
          businessRoutes: 'Direct business routes require x-internal-* signed headers (gateway or order-service only)'
        },
        requestId: req.requestId
      },
      requestId: req.requestId
    });
  });

  app.use(
    createInternalAuthMiddleware({
      secret: config.internalSharedSecret,
      allowedServices: ['gateway', 'order-service']
    })
  );

  app.get('/produits', async (req, res, next) => {
    try {
      const collection = await getProductsCollection();
      const page = Math.max(Number(req.query.page || 1), 1);
      const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 2000);
      const skip = (page - 1) * limit;

      const filter = {};
      const textQuery = String(req.query.q || req.query.titre || '').trim();
      if (textQuery) {
        filter.$or = [
          { title: { $regex: textQuery, $options: 'i' } },
          { description: { $regex: textQuery, $options: 'i' } }
        ];
      }

      const category = String(req.query.category || req.query.categorie || '').trim();
      if (category) {
        filter.category = category;
      }

      const city = String(req.query.city || req.query.ville || '').trim();
      if (city) {
        filter.city = city;
      }

      const priceMin = Number(req.query.priceMin ?? req.query.prixMin);
      if (Number.isFinite(priceMin)) {
        filter.price = { ...(filter.price || {}), $gte: priceMin };
      }
      const priceMax = Number(req.query.priceMax ?? req.query.prixMax);
      if (Number.isFinite(priceMax)) {
        filter.price = { ...(filter.price || {}), $lte: priceMax };
      }

      const statusFilter = String(req.query.status || '').trim();
      if (statusFilter && statusFilter !== 'all') {
        filter.status = statusFilter;
      } else if (!statusFilter) {
        filter.status = { $ne: 'archived' };
      }
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();
      const authRole = String(req.headers['x-auth-role'] || '').trim();
      const qVendorId = String(req.query.vendorId || '').trim();
      const vendorListingSelf =
        qVendorId &&
        ((authRole === 'vendor' && authUserId === qVendorId) || authRole === 'admin');
      if (!vendorListingSelf) {
        filter.stock = { $gt: 0 };
      }
      if (req.query.vendorId) {
        filter.vendorId = String(req.query.vendorId);
      }

      const sortBy = String(req.query.sort || req.query.tri || '').trim();
      let sort = { createdAt: -1 };
      if (sortBy === 'prix' || sortBy === 'price_asc') sort = { price: 1 };
      if (sortBy === 'price_desc') sort = { price: -1 };
      if (sortBy === 'date') sort = { createdAt: -1 };

      const [items, total] = await Promise.all([
        collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
        collection.countDocuments(filter)
      ]);

      return res.status(200).json({
        success: true,
        data: {
          items: items.map(mapProduct),
          pagination: {
            page,
            limit,
            total
          }
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/produits/suggest', async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      const limit = Math.min(Math.max(Number(req.query.limit || 8), 1), 20);
      if (q.length < 2) {
        return res.status(200).json({
          success: true,
          data: { items: [] },
          requestId: req.requestId
        });
      }

      const collection = await getProductsCollection();
      const safe = escapeRegex(q);
      const filter = {
        status: { $ne: 'archived' },
        stock: { $gt: 0 },
        $or: [
          { title: { $regex: safe, $options: 'i' } },
          { category: { $regex: safe, $options: 'i' } }
        ]
      };

      const items = await collection.find(filter).sort({ createdAt: -1 }).limit(limit).toArray();

      return res.status(200).json({
        success: true,
        data: {
          items: items.map(mapProduct)
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/produits/:id', async (req, res, next) => {
    try {
      const collection = await getProductsCollection();
      const id = req.params.id;
      const filter = normalizeProductId(id);
      const product = await collection.findOne(filter);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Produit introuvable'
          },
          requestId: req.requestId
        });
      }

      return res.status(200).json({
        success: true,
        data: mapProduct(product),
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/produits', requireVendorRole, requireApprovedVendor, async (req, res, next) => {
    try {
      const payload = req.body || {};
      const title = String(payload.title || payload.titre || '').trim();
      const price = Number(payload.price ?? payload.prix);
      if (!title || !Number.isFinite(price)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'title et price sont requis'
          },
          requestId: req.requestId
        });
      }

      const now = new Date().toISOString();
      const vendorId = String(req.headers['x-auth-user-id'] || randomId('vendor'));
      const status = String(payload.status || 'draft');
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'status invalide (draft/published/archived)'
          },
          requestId: req.requestId
        });
      }
      const doc = {
        id: randomId('prd'),
        title,
        description: String(
          payload.description ||
            payload.descriptionDetaillee ||
            payload.descriptionCourte ||
            ''
        ).trim(),
        shortDescription: String(payload.shortDescription || payload.descriptionCourte || '').trim(),
        detailedDescription: String(
          payload.detailedDescription || payload.descriptionDetaillee || payload.description || ''
        ).trim(),
        price,
        category: String(payload.category || payload.categorie || 'Général'),
        city: String(payload.city || payload.ville || ''),
        stock: Number(payload.stock || 0),
        sku: String(payload.sku || '').trim(),
        lowStockThreshold: Number(payload.lowStockThreshold || 5),
        image: String(payload.image || ''),
        gallery: Array.isArray(payload.gallery) ? payload.gallery.slice(0, 10) : [],
        vendorId,
        status,
        rating: Number(payload.rating || payload.note || 0),
        reviewCount: Number(payload.reviewCount || payload.nbAvis || 0),
        strikethroughPrice:
          payload.strikethroughPrice === null || payload.prixBarre === null
            ? null
            : payload.strikethroughPrice !== undefined || payload.prixBarre !== undefined
              ? Number(payload.strikethroughPrice ?? payload.prixBarre)
              : null,
        freeShipping: Boolean(payload.freeShipping ?? payload.livraisonGratuite),
        createdAt: now,
        updatedAt: now
      };

      const collection = await getProductsCollection();
      const result = await collection.insertOne(doc);

      return res.status(201).json({
        success: true,
        data: mapProduct({
          ...doc,
          _id: result.insertedId
        }),
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.put('/produits/:id', requireVendorRole, async (req, res, next) => {
    try {
      const collection = await getProductsCollection();
      const id = req.params.id;
      const filter = normalizeProductId(id);
      const current = await collection.findOne(filter);
      if (!current) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Produit introuvable'
          },
          requestId: req.requestId
        });
      }

      const role = String(req.headers['x-auth-role'] || '').trim();
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();
      if (role !== 'admin' && current.vendorId !== authUserId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Produit non autorisé pour ce vendeur'
          },
          requestId: req.requestId
        });
      }

      const patch = { ...req.body, updatedAt: new Date().toISOString() };
      if (patch.titre && !patch.title) patch.title = patch.titre;
      if (patch.prix !== undefined && patch.price === undefined) patch.price = Number(patch.prix);
      if (patch.price !== undefined) patch.price = Number(patch.price);
      if (patch.categorie && !patch.category) patch.category = patch.categorie;
      if (patch.ville && !patch.city) patch.city = patch.ville;
      if (patch.stock !== undefined) patch.stock = Number(patch.stock);
      if (patch.lowStockThreshold !== undefined) patch.lowStockThreshold = Number(patch.lowStockThreshold);
      if (patch.descriptionCourte !== undefined && patch.shortDescription === undefined) {
        patch.shortDescription = String(patch.descriptionCourte || '').trim();
      }
      if (patch.descriptionDetaillee !== undefined && patch.detailedDescription === undefined) {
        patch.detailedDescription = String(patch.descriptionDetaillee || '').trim();
      }
      if (patch.note !== undefined && patch.rating === undefined) patch.rating = Number(patch.note);
      if (patch.nbAvis !== undefined && patch.reviewCount === undefined) patch.reviewCount = Number(patch.nbAvis);
      if (patch.prixBarre !== undefined && patch.strikethroughPrice === undefined) {
        patch.strikethroughPrice =
          patch.prixBarre === null || patch.prixBarre === '' ? null : Number(patch.prixBarre);
      }
      if (patch.livraisonGratuite !== undefined && patch.freeShipping === undefined) {
        patch.freeShipping = Boolean(patch.livraisonGratuite);
      }
      if (patch.status !== undefined) {
        const nextStatus = String(patch.status);
        if (!['draft', 'published', 'archived'].includes(nextStatus)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'status invalide (draft/published/archived)'
            },
            requestId: req.requestId
          });
        }
        patch.status = nextStatus;
      }
      delete patch.id;
      delete patch._id;
      delete patch.titre;
      delete patch.prix;
      delete patch.categorie;
      delete patch.ville;
      delete patch.descriptionCourte;
      delete patch.descriptionDetaillee;
      delete patch.note;
      delete patch.nbAvis;
      delete patch.prixBarre;
      delete patch.livraisonGratuite;

      const result = await collection.findOneAndUpdate(
        filter,
        {
          $set: patch
        },
        { returnDocument: 'after' }
      );
      const updatedDoc = result?.value || result;

      if (!updatedDoc) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Produit introuvable'
          },
          requestId: req.requestId
        });
      }

      return res.status(200).json({
        success: true,
        data: mapProduct(updatedDoc),
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/produits/:id', requireVendorRole, requireApprovedVendor, async (req, res, next) => {
    try {
      const collection = await getProductsCollection();
      const id = req.params.id;
      const filter = normalizeProductId(id);
      const current = await collection.findOne(filter);
      if (!current) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Produit introuvable'
          },
          requestId: req.requestId
        });
      }
      const role = String(req.headers['x-auth-role'] || '').trim();
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();
      if (role !== 'admin' && current.vendorId !== authUserId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Produit non autorisé pour ce vendeur'
          },
          requestId: req.requestId
        });
      }

      const result = await collection.deleteOne(filter);
      if (!result.deletedCount) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Produit introuvable'
          },
          requestId: req.requestId
        });
      }
      return res.status(200).json({
        success: true,
        data: {
          deleted: true
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/internal/produits/:id/reserve', requireOrderServiceCaller, async (req, res, next) => {
    try {
      const quantity = Math.max(1, Number(req.body?.quantity || 0));
      const collection = await getProductsCollection();
      const filter = normalizeProductId(req.params.id);
      const result = await collection.findOneAndUpdate(
        {
          ...filter,
          stock: { $gte: quantity }
        },
        {
          $inc: { stock: -quantity },
          $set: { updatedAt: new Date().toISOString() }
        },
        { returnDocument: 'after' }
      );
      const updatedDoc = result?.value || result;

      if (!updatedDoc) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Stock insuffisant pour réserver le produit'
          },
          requestId: req.requestId
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          productId: req.params.id,
          stock: updatedDoc.stock
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/internal/produits/:id/release', requireOrderServiceCaller, async (req, res, next) => {
    try {
      const quantity = Math.max(1, Number(req.body?.quantity || 0));
      const collection = await getProductsCollection();
      const filter = normalizeProductId(req.params.id);
      const result = await collection.findOneAndUpdate(
        filter,
        {
          $inc: { stock: quantity },
          $set: { updatedAt: new Date().toISOString() }
        },
        { returnDocument: 'after' }
      );
      const updatedDoc = result?.value || result;

      if (!updatedDoc) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Produit introuvable'
          },
          requestId: req.requestId
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          productId: req.params.id,
          stock: updatedDoc.stock
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  const wishlistSharedRateLimit = createRateLimitMiddleware({ windowMs: 60_000, max: 120 });

  let wishlistsIndexesEnsured = false;
  async function getWishlistsCollection() {
    const db = await getMongoDb();
    const coll = db.collection('wishlists');
    if (!wishlistsIndexesEnsured) {
      wishlistsIndexesEnsured = true;
      await coll.createIndex({ ownerUserId: 1 }, { unique: true, sparse: true });
      await coll.createIndex({ shareToken: 1 }, { unique: true, sparse: true });
    }
    return coll;
  }

  async function ensureWishlist(ownerUserId) {
    const coll = await getWishlistsCollection();
    let doc = await coll.findOne({ ownerUserId });
    if (!doc) {
      const shareToken = randomId('wl');
      const now = new Date();
      doc = {
        ownerUserId,
        name: 'Ma liste',
        items: [],
        shareToken,
        createdAt: now,
        updatedAt: now
      };
      await coll.insertOne(doc);
    }
    return doc;
  }

  app.get('/wishlists/shared/:token', wishlistSharedRateLimit, async (req, res, next) => {
    try {
      const token = String(req.params.token || '').trim();
      if (!token) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Token manquant' },
          requestId: req.requestId
        });
      }
      const coll = await getWishlistsCollection();
      const doc = await coll.findOne({ shareToken: token });
      if (!doc || doc.shareDisabledAt) {
        return res.status(404).json({
          success: false,
          error: { code: 'WISHLIST_NOT_FOUND', message: 'Liste introuvable ou lien désactivé' },
          requestId: req.requestId
        });
      }
      return res.status(200).json({
        success: true,
        data: {
          name: doc.name || 'Liste de souhaits',
          productIds: (doc.items || []).map((i) => String(i.productId))
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/wishlists/me', async (req, res, next) => {
    try {
      const ownerUserId = String(req.headers['x-auth-user-id'] || '').trim();
      if (!ownerUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' },
          requestId: req.requestId
        });
      }
      const doc = await ensureWishlist(ownerUserId);
      return res.status(200).json({
        success: true,
        data: {
          name: doc.name,
          shareToken: doc.shareToken,
          shareDisabled: Boolean(doc.shareDisabledAt),
          items: (doc.items || []).map((i) => ({
            productId: String(i.productId),
            addedAt: i.addedAt
          }))
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/wishlists/me', async (req, res, next) => {
    try {
      const ownerUserId = String(req.headers['x-auth-user-id'] || '').trim();
      if (!ownerUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' },
          requestId: req.requestId
        });
      }
      const addProductId = String(req.body?.addProductId || req.body?.productId || '').trim();
      const removeProductId = String(req.body?.removeProductId || '').trim();
      const hasShareToggle = Object.prototype.hasOwnProperty.call(req.body || {}, 'shareDisabled');
      if (!addProductId && !removeProductId && !hasShareToggle) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'addProductId, removeProductId ou shareDisabled requis'
          },
          requestId: req.requestId
        });
      }
      await ensureWishlist(ownerUserId);
      const coll = await getWishlistsCollection();
      const now = new Date();
      let doc = await coll.findOne({ ownerUserId });

      if (hasShareToggle) {
        if (Boolean(req.body.shareDisabled)) {
          await coll.updateOne(
            { ownerUserId },
            {
              $set: {
                shareDisabledAt: now,
                shareDisabledReason:
                  String(req.body.shareDisabledReason || '')
                    .trim()
                    .slice(0, 500) || null,
                updatedAt: now
              }
            }
          );
        } else {
          await coll.updateOne(
            { ownerUserId },
            { $unset: { shareDisabledAt: '', shareDisabledReason: '' }, $set: { updatedAt: now } }
          );
        }
      }

      if (!addProductId && !removeProductId) {
        doc = await coll.findOne({ ownerUserId });
        return res.status(200).json({
          success: true,
          data: {
            name: doc.name,
            shareToken: doc.shareToken,
            shareDisabled: Boolean(doc.shareDisabledAt),
            items: (doc.items || []).map((i) => ({
              productId: String(i.productId),
              addedAt: i.addedAt
            }))
          },
          requestId: req.requestId
        });
      }

      doc = await coll.findOne({ ownerUserId });
      let items = Array.isArray(doc.items) ? [...doc.items] : [];

      if (removeProductId) {
        items = items.filter((i) => String(i.productId) !== removeProductId);
      }

      if (addProductId) {
        const productsCol = await getProductsCollection();
        const filter = normalizeProductId(addProductId);
        const product = await productsCol.findOne(filter);
        if (!product || String(product.status || 'published') === 'archived') {
          return res.status(404).json({
            success: false,
            error: { code: 'PRODUCT_NOT_FOUND', message: 'Produit introuvable ou indisponible' },
            requestId: req.requestId
          });
        }
        const pid = String(product.id || product._id?.toString() || addProductId);
        if (!items.some((i) => String(i.productId) === pid)) {
          items.push({ productId: pid, addedAt: now });
        }
      }

      await coll.updateOne({ ownerUserId }, { $set: { items, updatedAt: now } });
      doc = await coll.findOne({ ownerUserId });
      return res.status(200).json({
        success: true,
        data: {
          name: doc.name,
          shareToken: doc.shareToken,
          shareDisabled: Boolean(doc.shareDisabledAt),
          items: (doc.items || []).map((i) => ({
            productId: String(i.productId),
            addedAt: i.addedAt
          }))
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/wishlists/me/share', async (req, res, next) => {
    try {
      const ownerUserId = String(req.headers['x-auth-user-id'] || '').trim();
      if (!ownerUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' },
          requestId: req.requestId
        });
      }
      const regenerate = Boolean(req.body?.regenerate);
      const coll = await getWishlistsCollection();
      let doc = await ensureWishlist(ownerUserId);
      const now = new Date();
      if (regenerate || !doc.shareToken) {
        const newToken = randomId('wl');
        await coll.updateOne(
          { ownerUserId },
          {
            $set: { shareToken: newToken, updatedAt: now },
            $unset: { shareDisabledAt: '', shareDisabledReason: '' }
          }
        );
        doc = await coll.findOne({ ownerUserId });
      }
      return res.status(200).json({
        success: true,
        data: {
          shareToken: doc.shareToken,
          sharePath: `/liste/${doc.shareToken}`
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = {
  createApp
};
