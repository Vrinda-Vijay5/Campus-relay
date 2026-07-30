-- ============================================================
-- Campus Relay - PostgreSQL schema
-- Run this ONCE against an empty database named campus_relay:
--   psql -U postgres -d campus_relay -f db/schema.sql
-- Re-running it is safe: it drops and recreates everything.
-- ============================================================

DROP TABLE IF EXISTS tracking_events CASCADE;
DROP TABLE IF EXISTS delivery_assignments CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS hostels CASCADE;
DROP TABLE IF EXISTS gates CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS campuses CASCADE;
DROP SEQUENCE IF EXISTS order_code_seq;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- Keeps updated_at honest without the application having to remember.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Campus configuration
-- ------------------------------------------------------------
CREATE TABLE campuses (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  city        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The gate(s) where external delivery partners must stop.
CREATE TABLE gates (
  id          SERIAL PRIMARY KEY,
  campus_id   INTEGER NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campus_id, name)
);

-- Residential areas. gender is what separates "Girls Block A" from
-- "Boys Block A" - the original localStorage version could not tell
-- them apart because both <option> tags had value="A".
CREATE TABLE hostels (
  id          SERIAL PRIMARY KEY,
  campus_id   INTEGER NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  gender      TEXT NOT NULL CHECK (gender IN ('girls', 'boys')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campus_id, name)
);

CREATE TABLE blocks (
  id          SERIAL PRIMARY KEY,
  hostel_id   INTEGER NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hostel_id, name)
);

-- ------------------------------------------------------------
-- Users: one table, three roles
-- ------------------------------------------------------------
CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL CHECK (length(trim(name)) > 0),
  -- Login identity. Indian mobile format enforced in the database itself,
  -- so bad data cannot get in even if a bug bypasses the API validator.
  phone             CHAR(10) NOT NULL UNIQUE CHECK (phone ~ '^[6-9][0-9]{9}$'),
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('student', 'partner', 'admin')),
  campus_id         INTEGER REFERENCES campuses(id) ON DELETE SET NULL,
  -- Optional convenience for students: pre-fills the order form.
  default_block_id  INTEGER REFERENCES blocks(id) ON DELETE SET NULL,
  room_number       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Orders
-- ------------------------------------------------------------
-- Human-friendly, non-guessable order code. The sequential part keeps
-- codes unique (fixing the Math.random() collision bug in the old
-- script.js); the random suffix stops anyone from enumerating other
-- people's orders on the public tracking page.
CREATE SEQUENCE order_code_seq START 1001;

CREATE TABLE orders (
  id                SERIAL PRIMARY KEY,
  order_code        TEXT NOT NULL UNIQUE
                      DEFAULT ('CR' || to_char(nextval('order_code_seq'), 'FM000000')
                               || '-' || upper(substr(md5(random()::text), 1, 4))),
  student_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  campus_id         INTEGER NOT NULL REFERENCES campuses(id) ON DELETE RESTRICT,
  gate_id           INTEGER NOT NULL REFERENCES gates(id) ON DELETE RESTRICT,
  block_id          INTEGER NOT NULL REFERENCES blocks(id) ON DELETE RESTRICT,
  room_number       TEXT,
  vendor            TEXT NOT NULL CHECK (vendor IN
                      ('Swiggy', 'Zomato', 'Blinkit', 'Zepto', 'Amazon', 'Flipkart', 'Other')),
  item_description  TEXT NOT NULL CHECK (length(trim(item_description)) > 0),
  contact_phone     CHAR(10) NOT NULL CHECK (contact_phone ~ '^[6-9][0-9]{9}$'),
  expected_arrival  TIMESTAMPTZ NOT NULL,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN (
                      'CREATED',
                      'WAITING_AT_MAIN_GATE',
                      'ASSIGNED',
                      'PICKED_UP',
                      'OUT_FOR_DELIVERY',
                      'REACHED_HOSTEL_GATE',
                      'DELIVERED',
                      'CANCELLED')),
  cancel_reason     TEXT,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A delivered order must carry its delivery timestamp, and only a
  -- delivered order may carry one.
  CONSTRAINT delivered_at_matches_status CHECK (
    (status = 'DELIVERED' AND delivered_at IS NOT NULL) OR
    (status <> 'DELIVERED' AND delivered_at IS NULL)
  )
);

CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Which Campus Relay partner is carrying which order
-- ------------------------------------------------------------
CREATE TABLE delivery_assignments (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  partner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- NULL when the partner accepted the job themselves,
  -- set to the admin's id when an admin assigned it.
  assigned_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at  TIMESTAMPTZ
);

-- Partial unique index: an order may have a HISTORY of assignments
-- (partner accepts, admin reassigns), but only ONE active at a time.
-- This is the database-level guarantee that two partners cannot both
-- accept the same order.
CREATE UNIQUE INDEX one_active_assignment_per_order
  ON delivery_assignments (order_id) WHERE is_active;

-- ------------------------------------------------------------
-- Append-only audit trail of every status change
-- ------------------------------------------------------------
CREATE TABLE tracking_events (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Indexes for the queries this app actually runs
-- ------------------------------------------------------------
CREATE INDEX idx_users_role          ON users (role);
CREATE INDEX idx_gates_campus        ON gates (campus_id);
CREATE INDEX idx_hostels_campus      ON hostels (campus_id);
CREATE INDEX idx_blocks_hostel       ON blocks (hostel_id);
CREATE INDEX idx_orders_student      ON orders (student_id, created_at DESC);
CREATE INDEX idx_orders_status       ON orders (status);
-- Serves the partner "available at main gate" pool query.
CREATE INDEX idx_orders_pool         ON orders (campus_id, status, created_at);
CREATE INDEX idx_orders_created_at   ON orders (created_at DESC);
CREATE INDEX idx_assignments_partner ON delivery_assignments (partner_id, is_active);
CREATE INDEX idx_tracking_order      ON tracking_events (order_id, created_at);
