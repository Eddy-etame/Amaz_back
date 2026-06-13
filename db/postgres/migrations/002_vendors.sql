-- Vendors table inheriting from users
-- Run after 001_init.sql

CREATE TABLE IF NOT EXISTS vendors (
  business_name VARCHAR(255),
  siret VARCHAR(32),
  address TEXT,
  tax_id VARCHAR(64),
  iban VARCHAR(34)
) INHERITS (users);

-- Idempotent bootstrap: OR REPLACE cannot remove columns if a later migration widened the view.
DROP VIEW IF EXISTS user_accounts CASCADE;

-- View for unified user lookup (users + vendors)
CREATE OR REPLACE VIEW user_accounts AS
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         NULL::VARCHAR(255) AS business_name, NULL::VARCHAR(32) AS siret, NULL::TEXT AS address, NULL::VARCHAR(64) AS tax_id, NULL::VARCHAR(34) AS iban
  FROM users
  UNION ALL
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         business_name, siret, address, tax_id, iban
  FROM vendors;
