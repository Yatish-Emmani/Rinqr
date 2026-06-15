-- ═══════════════════════════════════════════
--   RINQR — Cloudflare D1 Database Schema
--   Run: npx wrangler d1 execute rinqr-db --file=schema.sql --remote
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
  owner_phone   TEXT NOT NULL,          -- AES-256 encrypted in production
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
  scanner_phone TEXT,                   -- hashed before storing
  location_city TEXT,
  resolved      INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Property manager accounts (with hashed password for real auth)
CREATE TABLE IF NOT EXISTS manager_accounts (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,                   -- bcrypt hash; NULL = social-only account
  property_id   TEXT REFERENCES properties(id),
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Driver accounts (regular tag owners)
CREATE TABLE IF NOT EXISTS driver_accounts (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  phone         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ── Indexes for common query patterns ──────────────────────────────────────

-- Tags: look up by tag_id on every scan (hot path)
CREATE INDEX IF NOT EXISTS idx_tags_tag_id         ON tags(tag_id);
-- Tags: list all tags for a property
CREATE INDEX IF NOT EXISTS idx_tags_property_id    ON tags(property_id);
-- Tags: active-only queries
CREATE INDEX IF NOT EXISTS idx_tags_active         ON tags(active);

-- Scan events: feed for a specific tag
CREATE INDEX IF NOT EXISTS idx_scans_tag_id        ON scan_events(tag_id);
-- Scan events: property dashboard queries
CREATE INDEX IF NOT EXISTS idx_scans_property_id   ON scan_events(property_id);
-- Scan events: date-range queries (monthly/weekly stats)
CREATE INDEX IF NOT EXISTS idx_scans_created_at    ON scan_events(created_at);
-- Scan events: combined property + date (most common dashboard query)
CREATE INDEX IF NOT EXISTS idx_scans_prop_date     ON scan_events(property_id, created_at);

-- Manager accounts: email login lookup
CREATE INDEX IF NOT EXISTS idx_managers_email      ON manager_accounts(email);
-- Manager accounts: reverse-lookup by property
CREATE INDEX IF NOT EXISTS idx_managers_property   ON manager_accounts(property_id);

-- Driver accounts: email login lookup
CREATE INDEX IF NOT EXISTS idx_drivers_email       ON driver_accounts(email);

-- Properties: code lookup (called on every resident activation)
CREATE INDEX IF NOT EXISTS idx_properties_code     ON properties(code);
