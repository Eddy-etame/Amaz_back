// Middleware "vendeur approuvé" : protège les écritures du catalogue.
//
// Règle métier : un vendeur ne peut publier/modifier des produits QUE si un admin a
// approuvé son compte. Détail intéressant à expliquer en soutenance : le product-service
// stocke le catalogue dans MongoDB, mais l'état d'approbation du vendeur, lui, vit dans
// PostgreSQL (table `vendors`). Ce middleware franchit donc volontairement la frontière
// entre les deux bases : la donnée "métier transactionnelle" (le statut vendeur) reste
// en SQL, le catalogue (flexible, volumineux) reste en NoSQL.

const { getPostgresPool } = require('../../../../shared/db/postgres');

async function requireApprovedVendor(req, res, next) {
  // Un admin passe toujours (il gère le catalogue sans être un vendeur approuvé).
  const role = String(req.headers['x-auth-role'] || '').trim();
  if (role === 'admin') {
    return next();
  }

  const userId = String(req.headers['x-auth-user-id'] || '').trim();
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentification requise'
      },
      requestId: req.requestId
    });
  }

  try {
    // On va chercher le statut d'approbation dans Postgres (source de vérité vendeur).
    const pool = getPostgresPool();
    const result = await pool.query(
      `SELECT approval_status FROM vendors WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row) {
      // Pas de profil vendeur => pas le droit de toucher au catalogue.
      return res.status(403).json({
        success: false,
        error: {
          code: 'VENDOR_PROFILE_NOT_FOUND',
          message: 'Profil vendeur introuvable'
        },
        requestId: req.requestId
      });
    }
    // Tout statut autre que 'approved' (pending / rejected) bloque, avec un code adapté.
    if (row.approval_status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: {
          code: row.approval_status === 'rejected' ? 'VENDOR_REJECTED' : 'VENDOR_PENDING_APPROVAL',
          message:
            row.approval_status === 'rejected'
              ? 'Compte vendeur refusé — impossible de modifier le catalogue.'
              : 'Compte vendeur en attente d\'approbation — impossible de modifier le catalogue.'
        },
        requestId: req.requestId
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  requireApprovedVendor
};
