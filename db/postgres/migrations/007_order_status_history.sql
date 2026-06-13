-- Audit trail for order status transitions (append-only).
-- Applied after 006_blocked_ips.sql via db-bootstrap.

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(64) NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(16) NOT NULL DEFAULT 'system',
  actor_id VARCHAR(64),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_order_status_history_actor_type CHECK (actor_type IN ('system', 'vendor', 'user'))
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
  ON order_status_history (order_id, created_at DESC);
