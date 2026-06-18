-- Workflow de retours (migration 009). Après 008.
--
-- IMPORTANT (parité) : la migration MySQL d'origine s'arrêtait à 008 — il n'y avait donc
-- AUCUNE table de retours côté MySQL alors qu'elle existait sous Postgres. On rétablit
-- ici la parité : returns-service ne peut pas fonctionner sans ces tables.

CREATE TABLE IF NOT EXISTS return_requests (
  id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  vendor_id VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  qr_reference VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_return_requests_vendor_id (vendor_id),
  KEY idx_return_requests_user_id (user_id),
  KEY idx_return_requests_order_id (order_id),
  KEY idx_return_requests_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS return_items (
  id VARCHAR(64) NOT NULL,
  return_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_return_items_return_id (return_id),
  CONSTRAINT fk_return_items_request FOREIGN KEY (return_id) REFERENCES return_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sous Postgres : BIGSERIAL -> sous MySQL : BIGINT AUTO_INCREMENT.
CREATE TABLE IF NOT EXISTS return_status_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  return_id VARCHAR(64) NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(32),
  actor_id VARCHAR(64),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_return_status_history_return_id (return_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
