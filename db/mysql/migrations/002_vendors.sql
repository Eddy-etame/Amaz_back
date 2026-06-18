-- Vendeurs (migration 002). À exécuter après 001_init.sql.
--
-- Sous PostgreSQL, vendors héritait de users (INHERITS). MySQL n'a pas d'héritage de
-- table : on crée donc vendors comme une table COMPLÈTE reprenant les colonnes de users
-- + les colonnes propres au vendeur. La vue user_accounts unifie les deux en lecture.

CREATE TABLE IF NOT EXISTS vendors (
  id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  username VARCHAR(128),
  role VARCHAR(32) NOT NULL DEFAULT 'vendor',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  sms_verified BOOLEAN NOT NULL DEFAULT FALSE,
  business_name VARCHAR(255),
  siret VARCHAR(32),
  address TEXT,
  tax_id VARCHAR(64),
  iban VARCHAR(34),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vue unifiée users + vendors (lecture). On liste vendors puis les users qui ne sont
-- pas aussi vendeurs, pour éviter tout doublon d'id. La version avec approval_status
-- est posée en 005.
CREATE OR REPLACE VIEW user_accounts AS
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         business_name, siret, address, tax_id, iban
  FROM vendors
  UNION ALL
  SELECT id, email, phone, username, role, email_verified, sms_verified, created_at, updated_at,
         NULL, NULL, NULL, NULL, NULL
  FROM users u
  WHERE NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id = u.id);
