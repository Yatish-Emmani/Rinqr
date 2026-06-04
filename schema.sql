-- ═══════════════════════════════════════════
--   RINQR — Cloudflare D1 Database Schema
--   Run: npx wrangler d1 execute rinqr-db --file=schema.sql
-- ═══════════════════════════════════════════

-- Properties (B2B customers — apartment complexes, offices, etc.)
CREATE TABLE IF NOT EXISTS properties (
  id            TEXT PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,   -- e.g. OAKRID26 — given to residents
  name          TEXT NOT NULL,
  address       TEXT,
  manager_email TEXT NOT NULL,
  units         INTEGER DEFAULT 0,
  plan          TEXT DEFAULT 'standard', -- 'starter' | 'standard' | 'enterprise'
  active        INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Tags (one per vehicle)
CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,
  tag_id        TEXT UNIQUE NOT NULL,   -- e.g. PP-7X4K-9M2R
  owner_name    TEXT NOT NULL,
  owner_phone   TEXT NOT NULL,          -- store encrypted in production
  vehicle_type  TEXT,
  vehicle_desc  TEXT,
  property_id   TEXT REFERENCES properties(id),
  unit_number   TEXT,
  active        INTEGER DEFAULT 1,      -- 1 = active, 0 = paused
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Scan events (every time a QR tag is scanned)
CREATE TABLE IF NOT EXISTS scan_events (
  id            TEXT PRIMARY KEY,
  tag_id        TEXT NOT NULL REFERENCES tags(tag_id),
  property_id   TEXT REFERENCES properties(id),
  reason        TEXT NOT NULL,
  message       TEXT,
  scanner_phone TEXT,                   -- hash before storing in production
  location_city TEXT,
  resolved      INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Property manager accounts
CREATE TABLE IF NOT EXISTS manager_accounts (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  property_id   TEXT REFERENCES properties(id),
  created_at    TEXT DEFAULT (datetime('now'))
);
