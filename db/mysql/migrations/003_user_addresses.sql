-- Adresses client + colonnes de commande (migration 003). Après 001 et 002.

CREATE TABLE IF NOT EXISTS user_addresses (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  street TEXT NOT NULL,
  city VARCHAR(120) NOT NULL,
  postal_code VARCHAR(32),
  country VARCHAR(120) NOT NULL,
  phone VARCHAR(32),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  -- Remplace l'index unique PARTIEL de Postgres (UNIQUE ... WHERE is_default = true),
  -- que MySQL n'a pas : une colonne générée qui vaut user_id quand l'adresse est par
  -- défaut, NULL sinon. L'unicité dessus garantit "au plus une adresse par défaut par
  -- utilisateur" (plusieurs NULL sont autorisés).
  default_user_id VARCHAR(64) GENERATED ALWAYS AS (IF(is_default, user_id, NULL)) STORED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_addresses_user_id (user_id),
  UNIQUE KEY uq_user_addresses_default_per_user (default_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Colonnes commande ajoutées à cette étape (mode de paiement + date de livraison).
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(32) NOT NULL DEFAULT 'card';
ALTER TABLE orders ADD COLUMN delivered_at DATETIME;
