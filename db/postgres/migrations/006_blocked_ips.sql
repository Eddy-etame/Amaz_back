-- Blocked IPs for admin-managed IP blocking
-- Run after 005_vendor_approval.sql

CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(64) NOT NULL UNIQUE,
  reason VARCHAR(255),
  blocked_by VARCHAR(64),
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
