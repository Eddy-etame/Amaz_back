-- Customer addresses and order metadata
-- Run after 001_init.sql and 002_vendors.sql

CREATE TABLE IF NOT EXISTS user_addresses (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  street TEXT NOT NULL,
  city VARCHAR(120) NOT NULL,
  postal_code VARCHAR(32),
  country VARCHAR(120) NOT NULL,
  phone VARCHAR(32),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
  ON user_addresses (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_addresses_default_per_user
  ON user_addresses (user_id)
  WHERE is_default = true;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NOT NULL DEFAULT 'card';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
