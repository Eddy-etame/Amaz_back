-- Correctif de la vue user_accounts (migration 004). Après 002.
-- On évite les doublons d'id (un vendeur présent à la fois comme compte et comme
-- vendeur) en listant vendors puis seulement les users qui ne sont pas vendeurs.

DROP VIEW IF EXISTS user_accounts;

CREATE OR REPLACE VIEW user_accounts AS
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         business_name, siret, address, tax_id, iban
  FROM vendors
  UNION ALL
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         NULL, NULL, NULL, NULL, NULL
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id = u.id);
