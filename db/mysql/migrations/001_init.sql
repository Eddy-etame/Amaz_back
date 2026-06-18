-- Amaz backend — schéma MySQL (migration 001, socle).
--
-- Ce fichier est la traduction 1:1 du schéma PostgreSQL d'origine vers MySQL, pour
-- garantir la PARITÉ : tout ce qui existait sous Postgres existe ici. Les choix de
-- portage (types, index, identifiants) sont documentés dans docs/JOURNAL_DECISIONS.md.
--
-- Notes de portage PG -> MySQL :
--   * TIMESTAMPTZ        -> DATETIME (on stocke en UTC côté application).
--   * BOOLEAN ... false  -> BOOLEAN (TINYINT(1)) DEFAULT FALSE.
--   * UUID gen_random_uuid() -> CHAR(36) DEFAULT (UUID())  [MySQL 8.0.13+].
--   * JSONB              -> JSON.
--   * index sur lower(email) -> UNIQUE simple : la collation MySQL par défaut
--     (utf8mb4_0900_ai_ci) est déjà insensible à la casse, donc l'unicité l'est aussi.
--   * index partiel "WHERE phone IS NOT NULL" -> index simple (MySQL n'a pas d'index
--     partiel ; indexer les NULL est sans effet néfaste ici).
--   * Moteur InnoDB obligatoire : on utilise des transactions (checkout order-service).

-- Rôles (optionnel, pour un futur RBAC)
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(32) NOT NULL,
  name VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Utilisateurs (table de base)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32),
  username VARCHAR(128),
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  sms_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Identifiants (hash du mot de passe)
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_salt VARCHAR(64) NOT NULL,
  password_algo VARCHAR(64) NOT NULL DEFAULT 'pbkdf2-sha256+pepper',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  access_token_hash VARCHAR(128) NOT NULL,
  refresh_token_hash VARCHAR(128) NOT NULL,
  fingerprint_hash VARCHAR(128),
  ip_address VARCHAR(64),
  user_agent TEXT,
  access_expires_at DATETIME NOT NULL,
  refresh_expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  revoked_reason VARCHAR(128),
  revoked_by VARCHAR(64),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_user_id (user_id),
  KEY idx_sessions_access_hash (access_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Révocations de tokens
CREATE TABLE IF NOT EXISTS token_revocations (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  token_type VARCHAR(32) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  session_id VARCHAR(64),
  user_id VARCHAR(64),
  reason VARCHAR(128),
  revoked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_revocations_hash (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Demandes OTP
CREATE TABLE IF NOT EXISTS otp_requests (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  channel VARCHAR(16) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  code_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  request_meta JSON,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_requests_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tentatives OTP (audit)
CREATE TABLE IF NOT EXISTS otp_attempts (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  otp_request_id VARCHAR(64) NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address VARCHAR(64),
  fingerprint_hash VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Réinitialisations de mot de passe
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  otp_request_id VARCHAR(64) NOT NULL,
  reset_token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_token (reset_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Événements de sécurité (audit)
CREATE TABLE IF NOT EXISTS security_events (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  user_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'info',
  request_id VARCHAR(64),
  ip_address VARCHAR(64),
  fingerprint_hash VARCHAR(128),
  metadata JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Commandes
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
  total_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'EUR',
  estimated_delivery_at DATETIME,
  shipping_address JSON,
  payment_status VARCHAR(32) NOT NULL DEFAULT 'authorized',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lignes de commande
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_title VARCHAR(255) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity INT NOT NULL,
  vendor_id VARCHAR(64) NOT NULL,
  image_url VARCHAR(512),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_vendor_id (vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tentatives de paiement
CREATE TABLE IF NOT EXISTS payment_attempts (
  id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  status VARCHAR(32) NOT NULL,
  provider_ref VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_attempts_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
