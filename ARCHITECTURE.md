# Surya Store — Full-Stack E-Commerce Architecture Guide

> Stack: React + Tailwind + Axios · Node/Express · PostgreSQL · JWT + bcrypt
> Goal: COD-first online store for a local general store, **100% free hosting**, payment-gateway-ready later.
> Audience: you (the freelancer) — this is the blueprint you read *before* writing a line of code.

---

## Table of Contents
1. [High-level system architecture](#1-high-level-system-architecture)
2. [Recommended free deployment platforms](#2-recommended-free-deployment-platforms)
3. [Complete database schema](#3-complete-database-schema)
4. [Backend architecture](#4-backend-architecture)
5. [Frontend architecture](#5-frontend-architecture)
6. [API design](#6-api-design)
7. [Authentication flow](#7-authentication-flow)
8. [Admin dashboard architecture](#8-admin-dashboard-architecture)
9. [Step-by-step development roadmap](#9-step-by-step-development-roadmap)
10. [Deployment guide](#10-deployment-guide)
11. [Future scalability improvements](#11-future-scalability-improvements)
12. [Appendix: best practices, payments, Docker, CI/CD, naming](#12-appendix)

---

## 1. High-level system architecture

```
                          ┌─────────────────────────────┐
                          │         Customers           │
                          │  (browser / mobile web)     │
                          └──────────────┬──────────────┘
                                         │ HTTPS
                        ┌────────────────▼─────────────────┐
                        │   React SPA (Vercel CDN)          │
                        │   - Customer storefront           │
                        │   - Admin dashboard (/admin)       │
                        │   - Axios API layer + JWT in mem   │
                        └────────────────┬─────────────────┘
                                         │ HTTPS  (Bearer JWT)
                        ┌────────────────▼─────────────────┐
                        │  Express REST API (Render)        │
                        │  - Auth / Products / Cart / Orders │
                        │  - JWT + RBAC middleware           │
                        │  - Joi/Zod validation              │
                        │  - Error + rate-limit middleware   │
                        └───────┬───────────────────┬───────┘
                                │ SQL (pg pool)      │ HTTPS upload
                  ┌─────────────▼──────────┐  ┌──────▼───────────┐
                  │ PostgreSQL (Neon)      │  │ Cloudinary       │
                  │ - serverless, branched │  │ - product images │
                  └────────────────────────┘  └──────────────────┘
```

**Why this shape (3-tier + external object storage):**
- The React SPA is a *pure static bundle* — served from a CDN, zero server cost, infinitely cacheable.
- The Express API is the only stateful compute; keep it **stateless** (no in-memory sessions) so it can scale horizontally and survive free-tier cold starts/restarts.
- Images never touch your DB or your API disk — they go straight to Cloudinary. Free-tier servers have ephemeral, tiny disks; storing uploads locally **will** lose data on every redeploy.
- Database is managed (Neon) so you never run/patch Postgres yourself.

**Key architectural decisions:**
| Decision | Choice | Reason |
|---|---|---|
| Monorepo vs split | **Monorepo** (`/client`, `/server`) | One repo, simpler for a solo freelancer; deploy each folder to its own platform. |
| Rendering | **SPA (client-side)** | Simplest; SEO is minor for a local store. Upgrade to Next.js SSR later if SEO matters. |
| State mgmt | **Redux Toolkit** for cart/auth, React Query optional for server data | Cart + auth are cross-cutting global state; product lists are server cache. |
| Token storage | **Access token in memory + refresh token in httpOnly cookie** | Best security/UX balance. (Simpler MVP: access token in `localStorage` — noted trade-offs in §7.) |
| Image upload | **Signed direct-to-Cloudinary** OR via-backend | Keep API thin; sign uploads server-side. |

---

## 2. Recommended free deployment platforms

> ⚠️ Reality check (as of 2026): **Railway removed its free tier** (now a one-time trial credit), and **Render's free Postgres expires after ~30 days**. The combo below avoids both traps.

### Recommended combination (best for long-term freelancing)

| Layer | Platform | Free tier | Watch-outs |
|---|---|---|---|
| **Frontend** | **Vercel** | Unlimited static deploys, global CDN, 100 GB bandwidth/mo, auto HTTPS, preview deploys per PR | Hobby tier is non-commercial in theory — for a paying client, you may eventually need Pro. Netlify is the equal alternative. |
| **Backend** | **Render** (Web Service, free) | 512 MB RAM, auto HTTPS, deploy from Git | **Spins down after 15 min idle → ~30–50s cold start** on first request. Mitigate with a cron pinger (§10). |
| **Database** | **Neon** | Serverless Postgres, **does not expire**, 0.5 GB storage, scales to zero, DB branching | Scale-to-zero adds ~½s wake latency on first query. Generous and durable — best free Postgres. |
| **Images** | **Cloudinary** | 25 credits/mo (~25 GB storage *or* bandwidth), on-the-fly transforms/resizing | Plenty for a local store catalog. |

**Connecting them together:**
1. Push monorepo to **GitHub**.
2. **Vercel** → import repo → root dir `client/` → set `VITE_API_URL=https://your-api.onrender.com/api`.
3. **Render** → New Web Service → root dir `server/` → build `npm install`, start `npm start` → paste env vars (DB URL, JWT secrets, Cloudinary keys, `CLIENT_URL`).
4. **Neon** → create project → copy the **pooled** connection string into Render's `DATABASE_URL`.
5. **Cloudinary** → copy cloud name + API key/secret into Render env.
6. Set CORS on the API to allow only your Vercel domain.

### Alternative: all-in-one with Supabase
**Supabase** gives Postgres + Storage + (optional) Auth in one free project (500 MB DB, 1 GB storage). Trade-off: project **pauses after ~1 week of inactivity** (fine once you have real traffic; annoying during dev). Good if you want fewer dashboards. You can still keep your own Express API and just use Supabase as DB+storage.

### Platform comparison cheat-sheet
- **Frontend:** Vercel ≈ Netlify (both excellent). Pick Vercel.
- **Backend:** Render (free, cold starts) > Fly.io (free allowance, more config) > Railway (no longer free).
- **DB:** Neon (durable, branching) > Supabase (pauses) > Render PG (expires — avoid for prod).
- **Images:** Cloudinary (transforms) > Supabase Storage > ImageKit.

---

## 3. Complete database schema

ER summary: a user has many addresses, many orders, and one cart. A cart has many cart_items → products. An order has many order_items (a *snapshot* of product price/name at purchase time). Products belong to a category and have one inventory row. Roles gate admin access.

```sql
-- ========== EXTENSIONS ==========
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ========== ENUMS ==========
CREATE TYPE order_status AS ENUM
  ('pending','confirmed','processing','shipped','delivered','cancelled');
CREATE TYPE user_role    AS ENUM ('customer','admin','superadmin');

-- ========== USERS ==========
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(120) NOT NULL,
  email          CITEXT UNIQUE NOT NULL,          -- case-insensitive
  phone          VARCHAR(20),
  password_hash  TEXT NOT NULL,                   -- bcrypt
  role           user_role NOT NULL DEFAULT 'customer',
  is_blocked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== CATEGORIES ==========
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(80) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,        -- "cooking-oil"
  image_url   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== PRODUCTS ==========
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name          VARCHAR(160) NOT NULL,
  slug          VARCHAR(180) UNIQUE NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  mrp           NUMERIC(10,2) CHECK (mrp >= 0),     -- for showing discounts
  unit          VARCHAR(30),                        -- "1 L", "500 g", "pack of 6"
  image_url     TEXT,
  image_urls    JSONB DEFAULT '[]',                 -- gallery
  is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== INVENTORY (1:1 with product) ==========
CREATE TABLE inventory (
  product_id        UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  quantity          INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== ADDRESSES ==========
CREATE TABLE addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        VARCHAR(40),                         -- "Home", "Shop"
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

-- ========== CART (1 per user) + CART ITEMS ==========
CREATE TABLE carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (cart_id, product_id)                      -- one row per product
);

-- ========== ORDERS + ORDER ITEMS (price snapshot) ==========
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    BIGSERIAL UNIQUE,                 -- human-friendly #1001
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status          order_status NOT NULL DEFAULT 'pending',
  payment_method  VARCHAR(20) NOT NULL DEFAULT 'cod',
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'unpaid',  -- future gateways
  -- shipping snapshot (do NOT FK to addresses; copy at order time)
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

CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name  VARCHAR(160) NOT NULL,              -- snapshot
  unit_price    NUMERIC(10,2) NOT NULL,             -- snapshot
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  line_total    NUMERIC(10,2) NOT NULL
);

-- ========== REFRESH TOKENS (for rotation/revocation) ==========
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,                        -- store hash, not token
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== INDEXES ==========
CREATE INDEX idx_products_category   ON products(category_id);
CREATE INDEX idx_products_active     ON products(is_active);
CREATE INDEX idx_products_featured   ON products(is_featured) WHERE is_featured;
CREATE INDEX idx_products_name_trgm  ON products USING gin (name gin_trgm_ops); -- needs pg_trgm
CREATE INDEX idx_orders_user         ON orders(user_id);
CREATE INDEX idx_orders_status       ON orders(status);
CREATE INDEX idx_orders_created      ON orders(created_at DESC);
CREATE INDEX idx_cart_items_cart     ON cart_items(cart_id);
CREATE INDEX idx_addresses_user      ON addresses(user_id);
CREATE INDEX idx_refresh_user        ON refresh_tokens(user_id);
```

**Best-practice notes baked into this schema:**
- **UUID primary keys** — safe to expose in URLs, no enumeration; `order_number` BIGSERIAL gives a friendly display number.
- **Price snapshotting** in `order_items`/`orders` — when a product's price changes later, *old orders keep their original price*. Never join orders to live product prices.
- **Address snapshot** on the order — if a customer edits/deletes an address, the shipped order is unaffected.
- **`NUMERIC(10,2)` for money**, never `float` (floating point loses cents).
- **Inventory in its own table** so stock updates don't lock/bloat the products row and you can audit it.
- **`CITEXT` email** so `Foo@x.com` == `foo@x.com`.
- **`ON DELETE` rules** chosen deliberately: orders `RESTRICT` (never lose order history), cart `CASCADE`, product→category `SET NULL`.
- **Trigram GIN index** powers fast `ILIKE '%query%'` product search. (`CREATE EXTENSION pg_trgm;`)

**Stock decrement is transactional** (see §4) — wrap order creation + inventory decrement + cart clear in one `BEGIN…COMMIT` with `SELECT … FOR UPDATE` to prevent overselling.

---

## 4. Backend architecture

### Folder structure (MVC + service layer)
```
server/
├── src/
│   ├── config/
│   │   ├── db.js              # pg Pool, exports query() + getClient()
│   │   ├── env.js             # validated env (zod) — fail fast on boot
│   │   └── cloudinary.js
│   ├── middleware/
│   │   ├── auth.js            # verifyJWT → req.user
│   │   ├── requireRole.js     # RBAC: requireRole('admin')
│   │   ├── validate.js        # validate(schema) using Zod/Joi
│   │   ├── errorHandler.js    # central error → JSON
│   │   ├── notFound.js
│   │   └── rateLimiter.js
│   ├── modules/               # feature-based (better than type-based)
│   │   ├── auth/
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.schema.js
│   │   ├── products/
│   │   ├── categories/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── inventory/
│   │   ├── admin/
│   │   └── users/
│   ├── utils/
│   │   ├── ApiError.js        # class ApiError extends Error {statusCode}
│   │   ├── asyncHandler.js    # wraps async controllers → next(err)
│   │   ├── jwt.js             # sign/verify access+refresh
│   │   └── slugify.js
│   ├── db/
│   │   ├── migrations/        # node-pg-migrate / Knex SQL files
│   │   └── seeds/
│   ├── app.js                 # express app (no listen) — testable
│   └── server.js              # imports app, app.listen()
├── .env.example
├── package.json
└── Dockerfile (optional)
```

### Layer responsibilities
- **Route** → declares path + middleware chain (`validate`, `auth`, `requireRole`) → controller.
- **Controller** → reads `req`, calls service, shapes the HTTP response. No SQL here.
- **Service** → business logic + DB access (via `pg`). Reusable, testable, transaction-aware.
- **Middleware** → cross-cutting concerns.

### Middleware order (in `app.js`)
```
helmet()  →  cors({origin: CLIENT_URL, credentials:true})  →  express.json()
→  cookieParser()  →  rateLimiter (on /auth)  →  morgan logger
→  /api routes  →  notFound  →  errorHandler (last)
```

### Central error handling pattern
```js
// utils/asyncHandler.js
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  const payload = { success: false, message: err.message || 'Server error' };
  if (process.env.NODE_ENV !== 'production') payload.stack = err.stack;
  res.status(status).json(payload);
};
```
Every controller is `asyncHandler(async (req,res)=>{...})` so you never write try/catch in controllers; thrown `ApiError`s land in `errorHandler`.

### Transaction example — place order (prevents overselling)
```js
async function placeOrder(userId, { addressId, items }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // lock the inventory rows we touch
    for (const it of items) {
      const { rows } = await client.query(
        'SELECT quantity FROM inventory WHERE product_id=$1 FOR UPDATE', [it.productId]);
      if (!rows[0] || rows[0].quantity < it.quantity)
        throw new ApiError(409, `Insufficient stock`);
    }
    // insert order + items, decrement inventory, clear cart ...
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
```

### Validation (Zod)
```js
// products.schema.js
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(160),
    price: z.number().positive(),
    categoryId: z.string().uuid(),
    quantity: z.number().int().min(0).default(0),
  }),
});
// validate middleware parses req.body/params/query → 422 on failure
```

### Recommended npm packages (backend)
`express` · `pg` · `bcrypt` · `jsonwebtoken` · `zod` (or `joi`) · `helmet` · `cors` · `express-rate-limit` · `cookie-parser` · `morgan` · `dotenv` · `cloudinary` · `multer` (memory storage for upload passthrough) · `node-pg-migrate` (migrations) · dev: `nodemon`, `eslint`, `prettier`, `vitest`/`jest`, `supertest`.

---

## 5. Frontend architecture

### Folder structure
```
client/
├── src/
│   ├── api/
│   │   ├── axios.js          # instance + interceptors (attach token, refresh on 401)
│   │   ├── auth.api.js
│   │   ├── products.api.js
│   │   ├── cart.api.js
│   │   └── orders.api.js
│   ├── app/
│   │   ├── store.js          # Redux Toolkit store
│   │   └── hooks.js
│   ├── features/
│   │   ├── auth/authSlice.js
│   │   ├── cart/cartSlice.js
│   │   └── products/productsSlice.js
│   ├── components/
│   │   ├── ui/               # Button, Input, Modal, Spinner, Badge
│   │   ├── layout/           # Navbar, Footer, Container
│   │   └── product/          # ProductCard, ProductGrid, PriceTag
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Products.jsx
│   │   ├── ProductDetails.jsx
│   │   ├── Cart.jsx
│   │   ├── Checkout.jsx
│   │   ├── OrderSuccess.jsx
│   │   ├── auth/{Login,Register}.jsx
│   │   ├── dashboard/{Profile,MyOrders,Addresses}.jsx
│   │   └── admin/{Overview,Products,Orders,Users,Inventory}.jsx
│   ├── routes/
│   │   ├── AppRoutes.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── AdminRoute.jsx
│   ├── layouts/
│   │   ├── StoreLayout.jsx
│   │   └── AdminLayout.jsx    # sidebar + topbar
│   ├── hooks/                 # useDebounce, useAuth
│   ├── utils/                 # formatCurrency, constants
│   ├── App.jsx
│   └── main.jsx
├── .env                       # VITE_API_URL=...
├── tailwind.config.js
└── package.json
```

### Axios layer with auto token-refresh
```js
// api/axios.js
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL, withCredentials: true });
api.interceptors.request.use((cfg) => {
  const token = store.getState().auth.accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, async (err) => {
  if (err.response?.status === 401 && !err.config._retry) {
    err.config._retry = true;
    const { data } = await api.post('/auth/refresh');   // cookie-based
    store.dispatch(setAccessToken(data.accessToken));
    err.config.headers.Authorization = `Bearer ${data.accessToken}`;
    return api(err.config);
  }
  return Promise.reject(err);
});
```

### State management split
- **Redux Toolkit slices:** `auth` (user + access token), `cart` (items, totals — persisted to `localStorage` for guests, synced to DB on login).
- **Server data** (product lists, orders): fine to fetch in-component or with **React Query** for caching/pagination. Don't shove paginated product lists into Redux.

### Protected route
```jsx
const ProtectedRoute = () => {
  const user = useSelector(s => s.auth.user);
  return user ? <Outlet/> : <Navigate to="/login" replace/>;
};
const AdminRoute = () => {
  const user = useSelector(s => s.auth.user);
  return user?.role !== 'customer' ? <Outlet/> : <Navigate to="/" replace/>;
};
```

### Recommended npm packages (frontend)
`react` · `react-router-dom` · `@reduxjs/toolkit` `react-redux` · `axios` · `tailwindcss` · `@tanstack/react-query` (optional) · `react-hook-form` + `zod` (forms+validation) · `react-hot-toast` (notifications) · `lucide-react` (icons) · `recharts` (admin charts) · build with **Vite**.

---

## 6. API design

Base URL: `/api`. All responses: `{ success, data, message }`. Errors: `{ success:false, message }`.

| Group | Method & path | Auth | Purpose |
|---|---|---|---|
| **Auth** | `POST /auth/register` | – | create account |
| | `POST /auth/login` | – | returns access token (+ sets refresh cookie) |
| | `POST /auth/refresh` | cookie | new access token |
| | `POST /auth/logout` | cookie | revoke refresh |
| | `GET  /auth/me` | user | current profile |
| **Products** | `GET /products?search=&category=&sort=&page=&limit=` | – | list + filter + sort + paginate |
| | `GET /products/:slug` | – | details |
| | `POST /products` | admin | create |
| | `PATCH /products/:id` | admin | update |
| | `DELETE /products/:id` | admin | soft delete (`is_active=false`) |
| **Categories** | `GET /categories` | – | list |
| | `POST/PATCH/DELETE /categories/:id` | admin | manage |
| **Cart** | `GET /cart` | user | current cart |
| | `POST /cart/items` `{productId, qty}` | user | add/upsert |
| | `PATCH /cart/items/:id` `{qty}` | user | update qty |
| | `DELETE /cart/items/:id` | user | remove |
| **Orders** | `POST /orders` | user | place COD order (transactional) |
| | `GET /orders` | user | my orders |
| | `GET /orders/:id` | user/admin | order detail |
| **Addresses** | `GET/POST /addresses`, `PATCH/DELETE /addresses/:id` | user | manage |
| **Admin** | `GET /admin/overview` | admin | KPI stats |
| | `GET /admin/orders?status=&page=` | admin | all orders |
| | `PATCH /admin/orders/:id/status` | admin | update status |
| | `GET /admin/users`, `PATCH /admin/users/:id/block` | admin | manage users |
| **Inventory** | `PATCH /inventory/:productId` `{quantity}` | admin | set stock |
| | `GET /inventory/low-stock` | admin | low-stock alerts |

### Request/response examples

**Register**
```http
POST /api/auth/register
{ "fullName":"Asha R", "email":"asha@x.com", "phone":"9876543210", "password":"Secret@123" }

201 → { "success":true, "data":{ "user":{ "id":"…","fullName":"Asha R","role":"customer" },
                                 "accessToken":"eyJ…" }, "message":"Registered" }
       (Set-Cookie: refreshToken=…; HttpOnly; Secure; SameSite=None)
```

**List products**
```http
GET /api/products?search=oil&category=cooking-oil&sort=price_asc&page=1&limit=12

200 → { "success":true, "data":{
          "items":[ { "id":"…","name":"Fortune Oil 1L","price":"145.00","unit":"1 L",
                      "imageUrl":"https://res.cloudinary.com/…","inStock":true } ],
          "page":1,"limit":12,"total":48,"totalPages":4 } }
```

**Place COD order**
```http
POST /api/orders                       Authorization: Bearer eyJ…
{ "addressId":"…", "paymentMethod":"cod" }     // items read from server-side cart

201 → { "success":true, "data":{ "orderNumber":1024, "status":"pending",
                                  "total":"312.00" }, "message":"Order placed" }
409 → { "success":false, "message":"Insufficient stock for Fortune Oil 1L" }
```

**API conventions:** plural nouns, kebab-case paths, query params for filtering/sorting/pagination, `PATCH` for partial updates, soft-delete for products, consistent envelope, proper status codes (200/201/400/401/403/404/409/422/500).

---

## 7. Authentication flow

### Tokens
- **Access token (JWT):** short-lived (15 min), holds `{ sub:userId, role }`, sent as `Authorization: Bearer`. Stored **in memory** (Redux) on the client.
- **Refresh token:** long-lived (7 days), random opaque value, stored as **httpOnly, Secure, SameSite=None cookie**; its **hash** is saved in `refresh_tokens`. Enables silent re-login and revocation.

### Flows
```
REGISTER → bcrypt.hash(password,12) → insert user → issue access+refresh → create empty cart
LOGIN    → find by email → bcrypt.compare → if is_blocked reject → issue access+refresh
REQUEST  → client sends Bearer access token → auth middleware verifies → req.user
EXPIRY   → API returns 401 → axios interceptor calls /auth/refresh (cookie)
           → server checks token hash + not revoked + not expired → rotates (new refresh) → new access
LOGOUT   → server marks refresh token revoked + clears cookie
RBAC     → requireRole('admin') checks req.user.role on admin routes
```

### Why this design
- Access token in memory ⇒ **immune to XSS token theft via localStorage**; lost on refresh but silently restored via the refresh cookie.
- Refresh token httpOnly ⇒ **not readable by JS**; rotation + DB revocation ⇒ stolen tokens can be killed.
- Server is **stateless for access tokens** (no session store) but can still revoke via the refresh table.

> **Simpler MVP fallback:** single access token in `localStorage`, no refresh. Faster to ship, but vulnerable to XSS and can't revoke. Acceptable for v1; migrate to the above before heavy traffic.

**Forgot password (optional):** `POST /auth/forgot` → generate random token, store hash + expiry, email a reset link (use a free email API like Resend/Brevo free tier) → `POST /auth/reset` with token + new password.

---

## 8. Admin dashboard architecture

- **Same React app**, routes under `/admin`, wrapped in `AdminLayout` (collapsible sidebar + topbar) and guarded by `AdminRoute` (role ≠ customer).
- **Server is the real gate:** every `/admin/*` and write endpoint runs `auth` + `requireRole('admin')`. Frontend route-guarding is only UX; **never trust the client for authorization**.
- **Overview page** calls `GET /admin/overview` → one query bundle: counts (orders/users/products), revenue (sum of delivered orders), recent orders, low-stock list. Charts via Recharts.
- **Product mgmt:** table with create/edit modal; image upload → Cloudinary (signed); stock field writes to `inventory`.
- **Order mgmt:** filter by status; status dropdown → `PATCH /admin/orders/:id/status` with allowed-transition validation (e.g. can't go `delivered → pending`).
- **User mgmt:** list, block/unblock (`is_blocked`), view a user's order history.
- **Inventory:** low-stock view (`quantity <= low_stock_threshold`), inline quantity edit.
- **Seeding the first admin:** a seed script or a one-off `UPDATE users SET role='superadmin' WHERE email=…`. Never expose a public "make me admin" endpoint.

---

## 9. Step-by-step development roadmap

**Phase 0 — Setup (½ day)**
GitHub monorepo (`/client`,`/server`), Node + Vite scaffolds, ESLint/Prettier, `.env.example`, Tailwind init.

**Phase 1 — Database (1 day)**
Neon project → write migrations for all tables → seed categories + sample products + one admin → verify with a GUI (TablePlus/Beekeeper).

**Phase 2 — Backend core (2–3 days)**
`db.js` pool, env validation, error/asyncHandler/validate middleware, auth (register/login/refresh/me) + JWT + bcrypt, RBAC. Test with curl/Postman.

**Phase 3 — Catalog APIs (2 days)**
Products (list/filter/sort/search/paginate, details), categories, inventory. Cloudinary upload endpoint.

**Phase 4 — Cart & Orders (2 days)**
Cart CRUD, transactional order placement w/ stock check, addresses, order history.

**Phase 5 — Frontend storefront (3–4 days)**
Axios layer + interceptors, Redux store, auth pages + protected routes, Home (hero/featured/categories), product list + filters + search (debounced), product details, cart, checkout, order success, user dashboard.

**Phase 6 — Admin dashboard (3 days)**
AdminLayout + AdminRoute, overview KPIs, product CRUD + image upload, order management, user management, inventory/low-stock.

**Phase 7 — Hardening (1–2 days)**
helmet, CORS lockdown, rate limiting, input validation everywhere, loading/empty/error states, mobile responsiveness pass, basic tests (auth + order placement).

**Phase 8 — Deploy (1 day)**
Neon → Render (backend) → Vercel (frontend) → Cloudinary → smoke test end-to-end → cron pinger.

➡️ ~3 focused weeks solo for a polished v1.

---

## 10. Deployment guide

### 0. Prereqs
Push monorepo to GitHub. Have `.env.example` documenting every variable.

### 1. Database (Neon)
1. neon.tech → new project (region near client).
2. Copy the **pooled** connection string (`...-pooler...`).
3. Run migrations locally against it (`DATABASE_URL=… npm run migrate`).

### 2. Images (Cloudinary)
Create account → Dashboard → note `CLOUD_NAME`, `API_KEY`, `API_SECRET` → create an **unsigned upload preset** or use signed uploads from the API.

### 3. Backend (Render)
1. New → Web Service → connect repo → **Root Directory:** `server`.
2. Build: `npm install` · Start: `npm start` · Health check path: `/api/health`.
3. Env vars: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLOUDINARY_*`, `CLIENT_URL=https://<app>.vercel.app`, `NODE_ENV=production`.
4. Deploy → note the API URL `https://<svc>.onrender.com`.
5. **Cold-start mitigation:** free cron (cron-job.org) hits `/api/health` every 10 min to keep it warm.

### 4. Frontend (Vercel)
1. Import repo → **Root Directory:** `client` → framework Vite.
2. Build: `npm run build` · Output: `dist`.
3. Env: `VITE_API_URL=https://<svc>.onrender.com/api`.
4. Deploy → get `https://<app>.vercel.app`.

### 5. Wire CORS + cookies
- API `cors({ origin: CLIENT_URL, credentials: true })`.
- Refresh cookie: `Secure; SameSite=None` (required for cross-site Vercel↔Render).
- Add the Vercel domain to Neon? No — DB stays private to Render only.

### 6. Smoke test
Register → login → browse → add to cart → checkout COD → see order → admin updates status.

### Environment variables
```
# server/.env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://user:pass@ep-xxx-pooler.neon.tech/db?sslmode=require
JWT_ACCESS_SECRET=<64 random hex>
JWT_REFRESH_SECRET=<different 64 random hex>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
CLIENT_URL=https://surya-store.vercel.app
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# client/.env
VITE_API_URL=https://surya-store-api.onrender.com/api
```
Generate secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. **Never commit `.env`** — only `.env.example`.

---

## 11. Future scalability improvements

- **Payments (see appendix):** schema already has `payment_method`/`payment_status`; add a `payments` table + Razorpay/Stripe webhook handler. No rewrite needed.
- **Caching:** add Redis (Upstash free tier) for product lists, sessions, and rate-limit counters.
- **Search:** move from `ILIKE`/trigram to Postgres full-text or a hosted Meilisearch as catalog grows.
- **Read scaling:** Neon read replicas / connection pooling (PgBouncer — Neon's pooled URL already does this).
- **Media/CDN:** Cloudinary already CDNs images; add responsive `f_auto,q_auto` transforms.
- **Background jobs:** order-confirmation emails/SMS via a queue (BullMQ + Redis) instead of inline.
- **Observability:** Sentry (free) for errors, structured logs (pino), uptime monitor.
- **Horizontal scale:** API is stateless → bump Render instances or migrate to Fly.io/containers behind a load balancer.
- **Multi-store / roles:** `admin_roles` granularity, per-store inventory.
- **Mobile app:** the REST API already serves a React Native client unchanged.
- **SEO:** migrate storefront to Next.js (SSR/ISR) for product pages.

---

## 12. Appendix

### A. Security best practices
- bcrypt cost ≥ 12; never log passwords/tokens.
- helmet, strict CORS allowlist, `express-rate-limit` on `/auth` (e.g. 10/min).
- Validate **every** input (Zod/Joi) — body, params, query.
- Parameterized SQL only (`pg` `$1` placeholders) → no SQL injection. Never string-concat SQL.
- httpOnly+Secure+SameSite cookies; access token in memory.
- Authorize on the **server** for every admin/owner action; check resource ownership (`order.user_id === req.user.id`).
- Don't leak stack traces in production; generic 500 messages.
- Keep secrets in env; rotate JWT secrets if leaked (invalidates tokens).
- HTTPS everywhere (platforms give it free).

### B. Performance optimization
- DB indexes (already in schema); paginate all lists; `SELECT` only needed columns.
- One `pg.Pool`, reused (don't create per request).
- Frontend: code-split routes (`React.lazy`), lazy-load images, Cloudinary `q_auto,f_auto`, debounce search, cache product queries (React Query), gzip/brotli (platform default).
- Avoid N+1 queries — fetch order + items in 1–2 queries, not per-item.

### C. Future payment gateway strategy
1. Keep COD as default. Add `payments` table (`order_id`, `provider`, `provider_ref`, `amount`, `status`).
2. **Razorpay** (best for India) or **Stripe**: client gets an order/intent from your API → completes payment on the gateway widget → gateway calls your **webhook** → you verify signature → set `payment_status='paid'` and `status='confirmed'`.
3. Verify webhooks server-side (signature); never trust client "payment success". Make order placement idempotent (use the gateway ref as an idempotency key).

### D. Image upload strategy (free)
- **Signed direct upload:** client asks API for a Cloudinary signature → uploads file straight to Cloudinary → sends back the returned `secure_url` to save on the product. Keeps large files off your API.
- Or **passthrough:** `multer` memory storage → API streams buffer to Cloudinary. Simpler, fine for low volume.
- Store the `secure_url` (and `public_id` for deletes) in `products.image_url`.

### E. CI/CD (free)
- **GitHub Actions:** on PR → lint + test + build (both apps). Vercel & Render auto-deploy on push to `main` (no extra config). Add a workflow to run migrations on deploy (guarded).
- Branch protection on `main`; preview deploys via Vercel per PR.

### F. Docker (optional)
- `server/Dockerfile` (node:20-alpine, multi-stage), `docker-compose.yml` for local Postgres + API + client. Useful for consistent local dev; **not required** for the free deploy (Render/Vercel build from source).

### G. Naming conventions
- **DB:** snake_case tables (plural) & columns; `id` PK; `<table>_id` FKs; `created_at/updated_at`.
- **JS/Node:** camelCase vars/functions, PascalCase classes/React components, kebab-case filenames for modules (`auth.controller.js`), SCREAMING_SNAKE for env.
- **API:** plural kebab-case resources (`/order-items`), lowercase.
- **React:** components PascalCase files, hooks `useX`, slices `xSlice.js`.

### H. Production-ready architecture checklist
☐ env validated at boot ☐ central error handler ☐ structured logging ☐ health endpoint ☐ migrations (not auto-sync) ☐ rate limiting ☐ CORS allowlist ☐ helmet ☐ input validation everywhere ☐ transactions on money/stock ☐ soft deletes for catalog ☐ backups (Neon auto) ☐ Sentry ☐ uptime ping ☐ no secrets in git.

### I. ER diagram (text)
```
users 1──* addresses
users 1──1 carts 1──* cart_items *──1 products
users 1──* orders 1──* order_items *──1 products(SET NULL)
categories 1──* products 1──1 inventory
users 1──* refresh_tokens
user_role enum gates admin via users.role
```
Render visually at dbdiagram.io by pasting the table definitions.
```
```
```
