# 🛍️ ModoShop API

E-commerce REST API for **ModoShop S.A.**, a fashion retailer. Built with **Node.js, Express and strict TypeScript**, it combines three data stores, each used for what it does best:

| Store | Used for | Why |
|-------|----------|-----|
| **MySQL 8** (Sequelize ORM) | Catalog, stock, orders, coupons, payments | Relational data, ACID transactions, row-level locks |
| **Redis 7** (ioredis) | Active shopping carts | Sub-millisecond reads/writes, automatic expiry (TTL) |
| **MongoDB** (Mongoose) | Activity logs | Flexible, append-only event documents |

![Node](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-logs-47A248?logo=mongodb&logoColor=white)
![Tests](https://img.shields.io/badge/tests-43_passing-brightgreen)

> **Production URL:** _pending deploy — see [Deployment](#-deployment-railway--upstash)_
> Once deployed, the base URL will be `https://<your-app>.up.railway.app/api/v1`.

---

## 📑 Table of contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Data model (ERD)](#-data-model-erd)
- [Checkout flow](#-checkout-flow)
- [Order state machine](#-order-state-machine)
- [Getting started](#-getting-started)
- [Environment variables](#-environment-variables)
- [API endpoints](#-api-endpoints)
- [Testing](#-testing)
- [Deployment (Railway + Upstash)](#-deployment-railway--upstash)
- [Design decisions](#-design-decisions)
- [Roadmap v2.0](#-roadmap-v20)

---

## ✨ Features

- **Product catalog** with categories (nested), variants (size/color/SKU), price modifiers, filters, text search, sorting and pagination.
- **Shopping cart in Redis** stored as a Hash (`cart:{userId}`), with a 24 h TTL renewed on every change.
- **Stock with optimistic reservation**: units are reserved while the payment is processed and released if it fails — no overselling, even with concurrent buyers.
- **Checkout** that validates the coupon, re-prices the cart from the database, reserves stock, creates the order and simulates the payment.
- **Coupon system**: percentage or fixed amount, expiry date, minimum order amount and usage limit.
- **Order state machine** (`PENDING → PROCESSING → PAID / FAILED / CANCELLED → SHIPPED → DELIVERED`) with guarded transitions and side effects (restock, refunds).
- **Reports**: sales by day/week/month and top-selling products.
- **Security**: JWT auth, bcrypt, roles (`CUSTOMER` / `ADMIN`), ownership checks, Helmet, CORS, rate limiting (auth, checkout and global).
- **Validation** of every input with **Zod** and a **centralized error handler** with consistent JSON responses.
- **Activity logs** in MongoDB (logins, orders, product and stock changes). If MongoDB is down the API keeps selling.
- **43 automated tests** (Jest + Supertest + ioredis-mock) and a **Postman collection** with the 3 business flows.

## 🏗 Architecture

```
src/
├── config/        # env, MySQL (Sequelize), Redis (ioredis), MongoDB (Mongoose)
├── controllers/   # HTTP layer: read request, call service, send response
├── middlewares/   # auth & roles, Zod validation, rate limiting, error handler
├── models/
│   ├── mysql/     # Sequelize models + associations
│   └── mongo/     # ActivityLog schema
├── routes/        # one router per resource, mounted under /api/v1
├── schemas/       # Zod schemas (body, query and params)
├── services/      # business logic: cart, checkout, coupons, payments, orders, reports
├── types/         # shared TypeScript types
└── utils/         # jwt, logger, pagination, money helpers
database/          # schema.sql (tables, view, stored procedure) + seed.sql
docs/postman/      # Postman collection + environment
tests/             # unit and integration tests
```

Request lifecycle: `route → rate limiter → auth → Zod validation → controller → service → models → centralized error handler`.

The **`services/` layer** keeps controllers thin: the cart and checkout logic is complex and lives in testable services (the cart service receives its Redis client by injection, so tests run against `ioredis-mock`).

## 🗂 Data model (ERD)

![ERD](docs/images/erd.png)

Source: [`docs/erd.mmd`](docs/erd.mmd) (Mermaid). The SQL script also creates:

- **`vw_available_products`** – view of active variants with `final_price` and `available_stock` (`quantity - reserved_quantity`).
- **`sp_reserve_stock`** – stored procedure that reserves stock with `SELECT … FOR UPDATE`.

## 🛒 Checkout flow

`POST /api/v1/checkout` runs in **three phases** so that database locks are never held while waiting for the payment gateway:

```
 Redis cart ──► PHASE 1 · Reserve (MySQL transaction)
                 ├─ re-price items with current DB prices (cart prices are only a reference)
                 ├─ validate coupon (row lock) and reserve one use
                 ├─ SELECT … FOR UPDATE on each stock row (ordered by variantId → no deadlocks)
                 ├─ reserved_quantity += qty   (fails with 409 if not enough stock)
                 └─ create order (PENDING → PROCESSING), order items and payment (PROCESSING)
               ──► PHASE 2 · Charge (outside any transaction)
                 └─ payment simulator (90 % success by default, configurable)
               ──► PHASE 3 · Finalize (MySQL transaction)
                 ├─ PAID   → quantity -= qty, reserved -= qty, order & payment PAID
                 └─ FAILED → reserved -= qty, coupon use returned, order & payment FAILED
               ──► Clear Redis cart (only if PAID) → log ORDER_PAID / ORDER_FAILED in MongoDB
```

**Concurrency guarantee:** if two customers try to buy the last unit at the same time, the second transaction waits for the row lock, then sees `available = 0` and gets `409 Stock insuficiente`. This was verified with two simultaneous requests (one `201 PAID`, one `409`).

Response (`201 Created`):

```json
{
  "success": true,
  "message": "Pedido confirmado y pagado",
  "data": {
    "order": {
      "id": 1, "status": "PAID", "subtotal": 32400, "discountAmount": 3240, "total": 29160,
      "items": [{ "variantId": 102, "quantity": 3, "unitPrice": 4500, "variant": { "sku": "REM-OVS-M-NEG" } }],
      "payment": { "status": "PAID", "method": "CREDIT_CARD", "externalRef": "SIM-CREDIT_CARD-…" },
      "coupon": { "code": "WELCOME10", "type": "PERCENTAGE", "value": 10 }
    },
    "paymentStatus": "PAID"
  }
}
```

## 🔁 Order state machine

```
PENDING ──► PROCESSING ──► PAID ──► SHIPPED ──► DELIVERED
   │            │   │        │
   ▼            ▼   ▼        ▼
CANCELLED   FAILED CANCELLED CANCELLED
```

| Transition (admin, `PATCH /orders/:id/status`) | Side effect |
|---|---|
| `PROCESSING → CANCELLED` | Releases reserved stock, returns the coupon use, payment `FAILED` |
| `PAID → CANCELLED` | Restocks sold units, payment `REFUNDED` |
| Any invalid transition (e.g. `PAID → DELIVERED`) | `409` with the allowed transitions |

`FAILED`, `CANCELLED` and `DELIVERED` are final states.

## 🚀 Getting started

### Option A — Docker (everything in one command)

```bash
git clone https://github.com/ujeisson-alt/modoshop-api.git
cd modoshop-api
docker compose up --build
# API → http://localhost:3000   (DB schema and seed data are loaded automatically)
```

### Option B — Local services

Requirements: Node.js 20+, MySQL 8, Redis 7 (on Windows use Memurai or WSL2) and optionally MongoDB.

```bash
git clone https://github.com/ujeisson-alt/modoshop-api.git
cd modoshop-api
npm install
cp .env.example .env          # fill in your MySQL password and a JWT secret
redis-cli ping                # must answer PONG
npm run db:setup              # creates modoshop_db, tables, view, stored procedure and seed data
npm run dev                   # http://localhost:3000
```

Test users (from `database/seed.sql`):

| Role | Email | Password |
|------|-------|----------|
| ADMIN | `admin@modoshop.com` | `Admin1234` |
| CUSTOMER | `lucia@modoshop.com` | `Cliente1234` |
| CUSTOMER | `martin@modoshop.com` | `Cliente1234` |

Seed coupons: `WELCOME10` (10 %), `ENVIO5000` ($5,000 off, min $30,000), `VERANO25` (usage limit reached), `EXPIRADO` (expired), `INACTIVO` (inactive).

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server with hot reload (nodemon + ts-node) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run db:setup` | Create schema + seed data (`-- --no-seed` for schema only) |
| `npm test` | Run Jest tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run typecheck` | Type-check without emitting |

## 🔐 Environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | `development` / `production` / `test` | `development` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection | `localhost`, `3306`, `root`, `…`, `modoshop_db` |
| `MYSQL_URL` / `DATABASE_URL` | Full MySQL URL (Railway). Overrides the `DB_*` values | `mysql://user:pass@host:port/db` |
| `DB_AUTO_SETUP` | Create schema + seed on startup when the database is empty | `true` on Railway |
| `DB_AUTO_SEED` | Load seed data during auto setup | `true` |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Local Redis | `localhost`, `6379` |
| `REDIS_URL` | Full Redis URL (Upstash, TLS with `rediss://`). Overrides host/port | `rediss://default:pass@host:6379` |
| `REDIS_TTL_CART` | Cart TTL in seconds | `86400` (24 h) |
| `MONGODB_URI` | MongoDB for activity logs (optional) | `mongodb+srv://…` |
| `MONGODB_DB` | Database name for the logs | `modoshop_logs` |
| `JWT_SECRET` | JWT signing secret (**≥ 32 chars, required in production**) | — |
| `JWT_EXPIRES_IN` | Token lifetime | `24h` |
| `PAYMENT_SUCCESS_RATE` | Payment simulator success probability (0–1) | `0.9` |
| `PAYMENT_LATENCY_MS` | Simulated gateway latency | `500` |
| `CORS_ORIGIN` | Allowed origins (comma separated) or `*` | `*` |

No secrets are hard-coded; `.env` is git-ignored.

## 📡 API endpoints

Base URL: `/api/v1` · Auth: `Authorization: Bearer <token>`

| Method | Route | Description | Access |
|--------|-------|-------------|--------|
| POST | `/auth/register` | Register a new customer | Public |
| POST | `/auth/login` | Log in and get a JWT | Public |
| GET | `/users/me` | Authenticated user profile | Auth |
| PUT | `/users/me` | Update own profile (name, phone, address, password) | Auth |
| GET | `/users` | List users (pagination, `role`, `search`) | Admin |
| GET | `/users/:id` | User by id | Owner / Admin |
| GET | `/products` | Catalog with filters and pagination | Public |
| GET | `/products/:id` | Product detail with variants and available stock | Public |
| POST | `/products` | Create product with variants and initial stock | Admin |
| PUT | `/products/:id` | Update product | Admin |
| DELETE | `/products/:id` | Deactivate product (soft delete) | Admin |
| GET | `/products/:id/stock` | Stock per variant (quantity, reserved, available) | Admin |
| PATCH | `/products/:id/stock` | Adjust stock (`quantity` absolute or `delta` relative) | Admin |
| GET | `/cart` | Active cart with subtotal, item count and TTL | Auth |
| POST | `/cart/items` | Add item (checks available stock) | Auth |
| PATCH | `/cart/items/:variantId` | Update quantity (`0` removes the item) | Auth |
| DELETE | `/cart/items/:variantId` | Remove an item | Auth |
| DELETE | `/cart` | Empty the cart | Auth |
| POST | `/checkout/validate-coupon` | Validate a coupon and preview the discount | Auth |
| POST | `/checkout` | Create the order and process the payment | Auth (5 req/min) |
| GET | `/orders` | Own order history (admin: all, `status`/`userId` filters) | Auth |
| GET | `/orders/:id` | Order detail (customers only see their own) | Auth |
| PATCH | `/orders/:id/status` | Change order status (state machine) | Admin |
| GET | `/coupons` | List active coupons (`includeInactive=true`) | Admin |
| POST | `/coupons` | Create coupon | Admin |
| DELETE | `/coupons/:id` | Deactivate coupon | Admin |
| GET | `/reports/sales` | Sales by period (`from`, `to`, `groupBy=day\|week\|month`) | Admin |
| GET | `/reports/top-products` | Best-selling products (`limit`, `days`) | Admin |
| GET | `/health` | MySQL / Redis / MongoDB status | Public |

**Catalog filters** (`GET /products`): `search`, `category` (id or slug, includes subcategories), `brand`, `size`, `color`, `minPrice`, `maxPrice`, `inStock=true`, `sort=newest|price_asc|price_desc|name`, `page`, `limit`.

**Error format** (all errors):

```json
{ "success": false, "message": "Datos de entrada inválidos", "errors": [{ "field": "email", "message": "Email inválido" }] }
```

| Code | When |
|------|------|
| 400 | Validation error, invalid coupon, empty cart |
| 401 | Missing / invalid / expired token |
| 403 | Insufficient role or not the owner |
| 404 | Resource not found (also used for other users' orders, to avoid leaking their existence) |
| 409 | Not enough stock, duplicate resource, invalid order transition |
| 429 | Rate limit exceeded |

## 🧪 Testing

### Automated tests (Jest)

```bash
npm test
```

- **Unit** — coupon rules and discount math, order state machine, Redis cart service (with `ioredis-mock`).
- **Integration** (Supertest) — routing, Helmet headers, 401/403/404 handling, Zod validation, malformed JSON.

### Postman collection

Import [`docs/postman/ModoShop.postman_collection.json`](docs/postman/ModoShop.postman_collection.json) (and the local environment file) and run it with the Collection Runner or Newman:

```bash
npx newman run docs/postman/ModoShop.postman_collection.json
```

| Flow | What it proves |
|------|----------------|
| **1 — Successful purchase** | login → catalog → add to cart (stock check) → `WELCOME10` → checkout → order appears as `PAID` |
| **2 — Stock control** | stock set to 1, two customers try to buy it: one gets `PAID`, the other `409` with the stock message; no reservation is left behind |
| **3 — Coupon validation** | expired coupon → 400, minimum amount not reached → 400, usage limit → 400, valid coupon → correct `discountAmount` in the order |

All 85 assertions pass against a fresh seed (run with `PAYMENT_SUCCESS_RATE=1` for deterministic results).

## ☁️ Deployment (Railway + Upstash)

The repo is ready for Railway (`railway.json`: build `npm run build`, start `npm start`, health check `/health`).
With `DB_AUTO_SETUP=true` the API creates the tables, view, stored procedure and seed data on the first start if the database is empty — no manual SQL step is needed.

1. **API + MySQL** — in Railway: *New Project → Deploy from GitHub repo → `modoshop-api`*, then *+ New → Database → MySQL*.
2. **Redis** — create a free database at [upstash.com](https://upstash.com) (region `us-east-1` or `sa-east-1`) and copy the `rediss://…` URL (free tier: 10,000 commands/day). Alternatively add Railway's own Redis service.
3. **MongoDB** — MongoDB Atlas free cluster: create a database user, allow access from `0.0.0.0/0` (Railway has no fixed IPs) and copy the `mongodb+srv://…` string.
4. **Variables** of the API service:

   | Variable | Value |
   |----------|-------|
   | `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` (Railway reference) |
   | `REDIS_URL` | Upstash `rediss://…` URL (or `${{Redis.REDIS_URL}}`) |
   | `MONGODB_URI` | Atlas connection string |
   | `JWT_SECRET` | random string, 32+ characters |
   | `NODE_ENV` | `production` |
   | `DB_AUTO_SETUP` | `true` |

5. *Settings → Networking → Generate Domain*, point the Postman `baseUrl` to `https://<domain>/api/v1` and run the three flows. Every push to `main` redeploys automatically.

## 🧠 Design decisions

- **Cart in Redis, orders in MySQL.** The cart is temporary, read/written constantly and does not need relations, so it lives in memory with a TTL. When the order is paid it becomes permanent, auditable data in MySQL and the Redis key is deleted. In production enable AOF (`appendonly yes`) so carts survive a Redis restart.
- **Prices are recalculated at checkout.** The price stored in the cart is only for display; the order always uses the current database price, so a stale cart cannot buy at an old price.
- **Reservation instead of direct decrement.** `reserved_quantity` blocks units while the payment is in progress; `available = quantity - reserved_quantity` is what customers can buy.
- **Short transactions + ordered locks.** Locks are taken in ascending `variantId` order and released before calling the gateway, which avoids deadlocks and long waits under load.
- **Coupon uses are reserved too.** The coupon row is locked and its use counted in phase 1, then returned if the payment fails, so a limited coupon can never be over-used by concurrent checkouts.
- **Logging never breaks a sale.** MongoDB writes are best-effort; a logging failure is reported but does not fail the request.
- **Soft deletes** for products and coupons keep historical orders consistent.

## 🗺 Roadmap v2.0

- Real payment integration (MercadoPago SDK) and `POST /webhooks/payment` for asynchronous confirmations.
- Background job that expires orders stuck in `PROCESSING` and releases their reservations.
- Full-text search (MySQL `FULLTEXT` index or Elasticsearch).
- Wishlist persisted in Redis.
- Catalog cache (`GET /products` in Redis, invalidated on stock/product updates).
- End-to-end checkout tests with Testcontainers (MySQL + Redis).

---

Built by **Jeisson Uribe** · [GitHub](https://github.com/ujeisson-alt) · [LinkedIn](https://linkedin.com/in/jeisson-uribe-qa-data)
Project 3 of the *Back-End Projects Guide* (Talently Lab).
