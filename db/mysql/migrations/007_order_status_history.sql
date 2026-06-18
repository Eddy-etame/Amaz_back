-- Historique (append-only) des transitions de statut de commande (migration 007). Après 006.

CREATE TABLE IF NOT EXISTS order_status_history (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  order_id VARCHAR(64) NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(16) NOT NULL DEFAULT 'system',
  actor_id VARCHAR(64),
  metadata JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_status_history_order_created (order_id, created_at),
  CONSTRAINT chk_osh_actor_type CHECK (actor_type IN ('system', 'vendor', 'user')),
  CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
