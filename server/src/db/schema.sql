-- ========================================================
-- Surya Store schema (idempotent)
-- ========================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy product search

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM
    ('pending','confirmed','processing','shipped','delivered','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer','admin','superadmin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── USERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(120) NOT NULL,
  email          CITEXT UNIQUE NOT NULL,
  phone          VARCHAR(20),
  password_hash  TEXT NOT NULL,
  role           user_role NOT NULL DEFAULT 'customer',
  is_blocked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CATEGORIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(80) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  image_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PRODUCTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name          VARCHAR(160) NOT NULL,
  slug          VARCHAR(180) UNIQUE NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  mrp           NUMERIC(10,2) CHECK (mrp >= 0),
  unit          VARCHAR(30),
  image_url     TEXT,
  image_urls    JSONB NOT NULL DEFAULT '[]',
  is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── INVENTORY (1:1 with product) ───────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  product_id          UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ADDRESSES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        VARCHAR(40),
  recipient    VARCHAR(120) NOT NULL,
  phone        VARCHAR(20) NOT NULL,
  line1        VARCHAR(200) NOT NULL,
  line2        VARCHAR(200),
  city         VARCHAR(80) NOT NULL,
  state        VARCHAR(80),
  pincode      VARCHAR(12) NOT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── CART + CART ITEMS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (cart_id, product_id)
);

-- ── ORDERS + ORDER ITEMS ───────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    BIGSERIAL UNIQUE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status          order_status NOT NULL DEFAULT 'pending',
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'cod',
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  ship_recipient  VARCHAR(120) NOT NULL,
  ship_phone      VARCHAR(20)  NOT NULL,
  ship_line1      VARCHAR(200) NOT NULL,
  ship_line2      VARCHAR(200),
  ship_city       VARCHAR(80)  NOT NULL,
  ship_state      VARCHAR(80),
  ship_pincode    VARCHAR(12)  NOT NULL,
  subtotal        NUMERIC(10,2) NOT NULL,
  delivery_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name  VARCHAR(160) NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  line_total    NUMERIC(10,2) NOT NULL
);

-- ── EMAIL OTPs (registration + password reset) ─────────
CREATE TABLE IF NOT EXISTS email_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       CITEXT NOT NULL,
  purpose     VARCHAR(20) NOT NULL,           -- 'register' | 'reset'
  code_hash   TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed    BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_otps_lookup ON email_otps(email, purpose, created_at DESC);

-- ── INDEXES ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active     ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured   ON products(is_featured) WHERE is_featured;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm  ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_user         ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created      ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart     ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user      ON addresses(user_id);

-- Phone is a login identifier → normalize existing values to 10 digits,
-- then enforce uniqueness (partial: NULL phones, e.g. old admin, are allowed).
UPDATE users
   SET phone = RIGHT(regexp_replace(phone, '\D', '', 'g'), 10)
 WHERE phone IS NOT NULL
   AND length(regexp_replace(phone, '\D', '', 'g')) >= 10
   AND phone !~ '^[6-9][0-9]{9}$';

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_phone ON users(phone) WHERE phone IS NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Skipped unique phone index (duplicate phones exist): %', SQLERRM;
END $$;
