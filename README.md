# 🛒 Surya Store

A COD-first e-commerce web app for a local general store — browse products, manage a cart, place Cash-on-Delivery orders, and run the whole shop from an admin dashboard.

**Stack:** React + Vite + Tailwind + Redux Toolkit · Node + Express · PostgreSQL · JWT auth (bcrypt)
**Payment:** Cash on Delivery now; architecture is gateway-ready (see [ARCHITECTURE.md](ARCHITECTURE.md) §12C).

> 📐 The full system design, free-deployment guide, and scalability notes live in **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## Quick start (local, with Docker Postgres)

Prereqs: Node 18+, Docker.

```bash
# 1. Start PostgreSQL (host port 5433 to avoid clashing with a local 5432)
docker compose up -d

# 2. Backend
cd server
cp .env.example .env        # defaults already point at the Docker DB
npm install
npm run migrate             # create tables
npm run seed                # categories, 15 products, admin user
npm run dev                 # → http://localhost:4000

# 3. Frontend (new terminal)
cd client
cp .env.example .env        # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                 # → http://localhost:5173
```

Open http://localhost:5173.

### Demo credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@suryastore.com` | `Admin@123` |
| Customer | *register your own* | — |

Admins land on `/admin`; customers shop the storefront.

---

## Project structure

```
surya_store/
├── docker-compose.yml      # local PostgreSQL
├── ARCHITECTURE.md         # full design + deployment guide
├── server/                 # Express REST API (MVC + service layer)
│   ├── src/
│   │   ├── config/         # env (zod-validated), db pool, cloudinary
│   │   ├── middleware/     # auth, requireRole, validate, errorHandler, rateLimiter
│   │   ├── modules/        # auth, products, categories, cart, orders,
│   │   │                   #   addresses, inventory, admin, upload
│   │   ├── db/             # schema.sql, migrate.js, seed.js
│   │   ├── utils/          # ApiError, asyncHandler, jwt, password, slugify
│   │   ├── app.js          # express app (testable)
│   │   └── server.js       # listen + graceful shutdown
└── client/                 # React SPA
    └── src/
        ├── api/            # axios instance + endpoint functions
        ├── app/            # redux store
        ├── features/       # auth + cart slices
        ├── components/     # ui/, layout/, product/, AddressForm
        ├── layouts/        # StoreLayout, AdminLayout
        ├── pages/          # storefront, account/, admin/
        └── routes/         # ProtectedRoute, AdminRoute
```

---

## Features

**Customer:** register/login (JWT), browse + search + filter + sort products, category pages,
product details with stock, cart (add/update/remove, server-persisted), COD checkout with
saved addresses, order success + tracking, profile & order history.

**Admin (`/admin`):** dashboard KPIs (orders, customers, products, revenue, low-stock),
product CRUD + stock, order management with status workflow, inventory editor + low-stock
alerts, user management (block/unblock + order history).

---

## API overview

Base URL `/api`. Envelope: `{ success, data, message }`. Auth via `Authorization: Bearer <token>`.

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/profile`, `POST /auth/change-password` |
| Products | `GET /products`, `GET /products/:slug`, *(admin)* `GET /products/admin`, `POST/PATCH/DELETE /products/:id` |
| Categories | `GET /categories`, *(admin)* `POST/PATCH/DELETE` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/:id`, `DELETE /cart` |
| Addresses | `GET/POST /addresses`, `PATCH/DELETE /addresses/:id` |
| Orders | `POST /orders`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel` |
| Inventory *(admin)* | `GET /inventory/low-stock`, `PATCH /inventory/:productId` |
| Admin | `GET /admin/overview`, `GET /admin/orders`, `PATCH /admin/orders/:id/status`, `GET /admin/users`, `PATCH /admin/users/:id/block` |
| Upload *(admin)* | `POST /upload` (multipart `image`, needs Cloudinary env) |

Order placement is transactional: it locks inventory rows (`FOR UPDATE`), checks stock,
snapshots prices into `order_items`, decrements inventory, and clears the cart — all atomically.

---

## Image uploads

Product images accept any URL out of the box (seed data uses placeholders). To enable real
uploads, set `CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET` in `server/.env` — then
`POST /api/upload` returns a `secure_url` you save on the product.

---

## Deployment (free)

Recommended combo — full walkthrough in [ARCHITECTURE.md](ARCHITECTURE.md) §10:

| Layer | Platform |
|-------|----------|
| Frontend | **Vercel** (root dir `client`, `VITE_API_URL` → your API) |
| Backend | **Render** web service (root dir `server`) |
| Database | **Neon** (paste pooled URL into `DATABASE_URL`) |
| Images | **Cloudinary** |

The DB layer auto-enables SSL for Neon/Render connection strings.

---

## NPM scripts (root)

```bash
npm run db:up          # docker compose up -d
npm run db:down        # stop DB
npm run migrate        # server migrations
npm run seed           # seed data
npm run dev:server     # run API
npm run dev:client     # run React
```
