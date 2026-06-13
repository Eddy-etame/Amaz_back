-- Returns / retours workflow (vendor-scoped)
CREATE TABLE IF NOT EXISTS return_requests (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  vendor_id VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  qr_reference VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_vendor_id ON return_requests (vendor_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user_id ON return_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests (order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests (status);

CREATE TABLE IF NOT EXISTS return_items (
  id VARCHAR(64) PRIMARY KEY,
  return_id VARCHAR(64) NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items (return_id);

CREATE TABLE IF NOT EXISTS return_status_history (
  id BIGSERIAL PRIMARY KEY,
  return_id VARCHAR(64) NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(32),
  actor_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_status_history_return_id ON return_status_history (return_id);
