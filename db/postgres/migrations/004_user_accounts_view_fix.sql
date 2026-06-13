-- Fix user_accounts view to avoid duplicate ids when both users and vendors
-- have the same id (vendor inserted into users first for FK on user_credentials).
-- Run after 002_vendors.sql

DROP VIEW IF EXISTS user_accounts CASCADE;

CREATE OR REPLACE VIEW user_accounts AS
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         business_name, siret, address, tax_id, iban
  FROM vendors
  UNION ALL
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         NULL::VARCHAR(255) AS business_name, NULL::VARCHAR(32) AS siret, NULL::TEXT AS address, NULL::VARCHAR(64) AS tax_id, NULL::VARCHAR(34) AS iban
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id = u.id);
