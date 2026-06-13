-- Vendor approval workflow
-- Run after 004_user_accounts_view_fix.sql

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'pending';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS approved_by VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_vendors_approval_status ON vendors(approval_status);

-- Update view to include approval_status (vendors have it, users get NULL)
DROP VIEW IF EXISTS user_accounts CASCADE;

CREATE OR REPLACE VIEW user_accounts AS
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         business_name, siret, address, tax_id, iban,
         approval_status, approved_at, approved_by
  FROM vendors
  UNION ALL
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         NULL::VARCHAR(255) AS business_name, NULL::VARCHAR(32) AS siret, NULL::TEXT AS address, NULL::VARCHAR(64) AS tax_id, NULL::VARCHAR(34) AS iban,
         NULL::VARCHAR(32) AS approval_status, NULL::TIMESTAMPTZ AS approved_at, NULL::VARCHAR(64) AS approved_by
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id = u.id);
