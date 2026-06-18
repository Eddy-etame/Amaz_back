-- IP bloquées par l'admin (migration 006). Après 005.

CREATE TABLE IF NOT EXISTS blocked_ips (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  ip_address VARCHAR(64) NOT NULL,
  reason VARCHAR(255),
  blocked_by VARCHAR(64),
  blocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blocked_ips_ip (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
