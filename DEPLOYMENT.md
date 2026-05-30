# 🚀 Deploying Surya Store for Free

Complete, click-by-click procedure. Stack:

| Layer | Platform | Cost |
|-------|----------|------|
| Database | **Neon** (PostgreSQL) | Free, durable |
| Backend API | **Render** (web service) | Free (sleeps when idle) |
| Frontend | **Vercel** | Free |
| Images (optional) | **Cloudinary** | Free |

**Total time:** ~30–40 minutes. You need a **GitHub account** (all three platforms deploy from GitHub).

> ⚠️ Deploy order matters because of a chicken-and-egg with URLs:
> **DB → Backend → Frontend → update Backend's CLIENT_URL.** Follow the steps in order.

---

## Step 0 — Push the code to GitHub

The project isn't a git repo yet. From the project root:

```bash
cd /home/qss/Downloads/surya_store
git init
git add .
git commit -m "Surya Store: initial commit"
```

`.env` files are gitignored, so your local secrets are **not** uploaded — good.

Create an empty repo on GitHub (github.com → New repository → name it `surya-store`, **don't** add a README), then:

```bash
git remote add origin https://github.com/<your-username>/surya-store.git
git branch -M main
git push -u origin main
```

---

## Step 1 — Database on Neon

1. Go to **https://neon.tech** → sign up (GitHub login is easiest).
2. **Create project** → name `surya-store` → pick the region closest to your client → Create.
3. On the dashboard, find **Connection string** → copy the **Pooled connection** string. It looks like:
   ```
   postgresql://user:password@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep this — it's your `DATABASE_URL`. (Our backend auto-enables SSL when it sees `neon.tech`.)

> The schema/tables get created automatically in Step 2 (the build runs migrations).

---

## Step 2 — Backend API on Render

1. Go to **https://render.com** → sign up with GitHub.
2. **New + → Web Service** → connect your `surya-store` repo.
3. Configure:
   | Field | Value |
   |-------|-------|
   | Name | `surya-store-api` |
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install && npm run deploy:setup` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
4. **Advanced → Health Check Path:** `/api/health`
5. **Environment Variables** — add these (click "Add Environment Variable" for each):

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(the Neon pooled string from Step 1)* |
   | `JWT_SECRET` | *(generate — see below)* |
   | `JWT_EXPIRES_IN` | `7d` |
   | `BCRYPT_ROUNDS` | `12` |
   | `CLIENT_URL` | `https://placeholder.vercel.app` *(temporary — fix in Step 4)* |
   | `ADMIN_EMAIL` | `admin@yourstore.com` *(your choice)* |
   | `ADMIN_PASSWORD` | *(a strong password)* |

   Generate a strong `JWT_SECRET` locally:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

6. **Create Web Service.** Render installs deps, runs `deploy:setup` (creates tables + admin user), and starts the API.
7. When it's live, copy the URL, e.g. `https://surya-store-api.onrender.com`.
8. Test it: open `https://surya-store-api.onrender.com/api/health` → you should see `{"success":true,"status":"ok",...}`.

> **Cloudinary (optional, for image uploads):** also add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` from your Cloudinary dashboard. Without these, products still work with image **URLs**, just no file upload.

---

## Step 3 — Frontend on Vercel

1. Go to **https://vercel.com** → sign up with GitHub.
2. **Add New → Project** → import your `surya-store` repo.
3. Configure:
   | Field | Value |
   |-------|-------|
   | Root Directory | `client` |
   | Framework Preset | Vite *(auto-detected)* |
   | Build Command | `npm run build` *(default)* |
   | Output Directory | `dist` *(default)* |
4. **Environment Variables** — add one:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://surya-store-api.onrender.com/api` *(your Render URL + `/api`)* |
5. **Deploy.** When done, copy your frontend URL, e.g. `https://surya-store.vercel.app`.

> The included `client/vercel.json` makes client-side routes (e.g. `/admin`) work on refresh.

---

## Step 4 — Connect them (fix CORS)

The backend only allows requests from its configured `CLIENT_URL`. Update it to your real Vercel URL:

1. Render dashboard → your service → **Environment** → edit `CLIENT_URL`:
   ```
   CLIENT_URL = https://surya-store.vercel.app
   ```
   *(your exact Vercel URL, no trailing slash)*
2. Save → Render redeploys automatically.

---

## Step 5 — Verify the live app

1. Open your Vercel URL.
2. **Log in as admin** with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in Step 2.
3. Admin → **Products → Add** a real product (paste an image URL).
4. Log out → register a **customer** account → add to cart → checkout (COD) → place order.
5. Back in admin → **Orders** → see the order, update its status.

🎉 You're live.

---

## Step 6 — Keep the backend awake (optional but recommended)

Render's free service **sleeps after ~15 min idle**, so the first request after a nap takes ~30–50s. To keep it warm:

1. Go to **https://cron-job.org** (free) → sign up.
2. Create a cron job: URL `https://surya-store-api.onrender.com/api/health`, every **10 minutes**.

This pings your API so it rarely sleeps during the day.

---

## Updating the app later

Just push to GitHub — both Render and Vercel **auto-deploy** on every push to `main`:

```bash
git add .
git commit -m "your change"
git push
```

Migrations run automatically on each backend deploy (they're idempotent — safe to re-run).

---

## Free-tier limits to know

| Platform | Limit | Impact |
|----------|-------|--------|
| Neon | 0.5 GB storage, scales to zero | Fine for thousands of orders; ~½s wake on first query |
| Render | Sleeps when idle, 512 MB RAM | Cold start ~30–50s (mitigate with Step 6) |
| Vercel | 100 GB bandwidth/mo | Plenty for a local store |
| Cloudinary | 25 GB/mo | Plenty for a product catalog |

---

## Troubleshooting

- **CORS error in browser console** → `CLIENT_URL` on Render doesn't exactly match your Vercel URL (check for `https://`, no trailing slash). Redeploy after fixing.
- **"Cannot reach the server"** → backend is asleep (wait ~40s and retry) or `VITE_API_URL` is wrong on Vercel.
- **500 on first load** → check Render **Logs**; usually a missing/incorrect `DATABASE_URL`.
- **Can't log in** → confirm `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars were set before the build ran; trigger a "Manual Deploy → Clear build cache & deploy" so `deploy:setup` re-runs.
- **Tables missing** → the build command must be `npm install && npm run deploy:setup` (runs migrations).
