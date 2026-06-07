const { getMysqlPool } = require('../../../../shared/db/mysql');

/**
 * After requireVendorRole: admins pass; vendors must have approval_status = 'approved' in MySQL.
 */
async function requireApprovedVendor(req, res, next) {
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
    const pool = getMysqlPool();
    const [rows] = await pool.query(
      `SELECT approval_status FROM vendors WHERE id = ? LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    if (!row) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'VENDOR_PROFILE_NOT_FOUND',
          message: 'Profil vendeur introuvable'
        },
        requestId: req.requestId
      });
    }
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
