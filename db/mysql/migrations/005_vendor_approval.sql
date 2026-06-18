-- Workflow d'approbation vendeur (migration 005). Après 004.

ALTER TABLE vendors ADD COLUMN approval_status VARCHAR(32) NOT NULL DEFAULT 'pending';
ALTER TABLE vendors ADD COLUMN approved_at DATETIME;
ALTER TABLE vendors ADD COLUMN approved_by VARCHAR(64);
CREATE INDEX idx_vendors_approval_status ON vendors (approval_status);

-- Vue mise à jour pour exposer l'état d'approbation (NULL pour les users non-vendeurs).
DROP VIEW IF EXISTS user_accounts;

CREATE OR REPLACE VIEW user_accounts AS
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         business_name, siret, address, tax_id, iban,
         approval_status, approved_at, approved_by
  FROM vendors
  UNION ALL
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         NULL, NULL, NULL, NULL, NULL,
         NULL, NULL, NULL
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id = u.id);
