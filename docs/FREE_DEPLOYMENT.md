# Deploying PolySignal for $0 — Fully Free, No Sleep

This guide deploys PolySignal on a **100% free stack with no credit card
anywhere**, and wires it so **nothing sleeps**: the backend is pinged every
10 minutes, and the backend's own background jobs keep the database active.

| Layer | Service | Plan | Cost |
|---|---|---|---|
| Frontend (React SPA) | Cloudflare Pages | Free — unlimited bandwidth, 500 builds/mo | $0 |
| Backend (FastAPI) | Render | Free web service — 750 hrs/mo (≈24/7), spins down after ~15 min idle | $0 |
| Database (PostgreSQL) | Supabase | Free — 500 MB, pauses after ~7 days of zero activity | $0 |
| Keep-alive | GitHub Actions cron **or** cron-job.org | Free | $0 |

> **Honest expectations** — "never sleeps" here means *kept awake
> automatically*, not *guaranteed by an SLA*. If the keep-alive stops
> running, things will sleep again until the next visit. No SLA, no
> automatic backups, 500 MB database cap. For a portfolio/demo that is
> always reachable and snappy, this is exactly right; for real users and
> money, use the existing DigitalOcean deployment.

---

## Architecture

```
Browser
   │  https://polysignal.pages.dev        (Cloudflare Pages, static build)
   │         │  /api/*  +  /ws/*          (VITE_API_BASE_URL / VITE_WS_URL
   │         ▼                              baked in at build time)
   │  https://polysignal-api.onrender.com (Render, free web service)
   │         │  asyncpg  (?sslmode=require)
   │         ▼
   │  Supabase Postgres (session pooler, port 5432)
   │
Keep-alive (every 10 min):
   ├─ GET  <backend>/health      → keeps Render awake (runs SELECT 1 internally)
   └─ (optional) psql SELECT 1   → keeps the Supabase project from pausing
```

Two code-level notes:

- **REST/WebSocket endpoints**: the frontend calls the API with relative URLs
  in production (same-origin assumption). This repo now honors
  `VITE_API_BASE_URL` / `VITE_WS_URL` at build time (see
  `frontend/src/services/api.js`), which is what allows hosting the frontend
  on a different domain than the backend.
- **SPA routing**: `frontend/public/_redirects` (`/* /index.html 200`) makes
  deep links like `/markets/123` work on Cloudflare Pages. Already committed.

---

## Part 1 — Supabase (database)

1. Go to <https://supabase.com> → **Start your project** (GitHub login works).
   No credit card required.
2. **New project** → pick a name (e.g. `polysignal`), set a **database
   password** (save it in a password manager — you'll need it in Part 2),
   choose any region close to you (e.g. `eu-central-1` for Frankfurt).
3. Wait ~1 minute for the project to provision, then open **Project Settings
   → Database → Connection string**.
4. Copy the **Session pooler** connection string (the one for **port 5432**,
   labeled *Session mode*). It looks like:

   ```
   postgresql://postgres.abc123xyz:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```

   - ✅ Use the **session pooler (5432)** or the direct connection — not the
     transaction pooler (6543).
   - Append `?sslmode=require` to the end. Keep this string handy; it goes
     into Render in Part 2 and into the keep-alive in Part 4.

> Supabase pauses free projects after ~7 days with **no database activity**.
> PolySignal's background jobs (market refresh runs every 5 minutes) write to
> the DB constantly, and the optional keep-alive `SELECT 1` covers the rest.
> In practice the pause never triggers while the backend is awake.

---

## Part 2 — Render (backend)

1. Create an account at <https://render.com> (GitHub login works). **No card
   needed.**
2. Dashboard → **New** → **Blueprint** → connect
   `evansmakori/PolySignal-Polymarket-Analytics-Platform`.
3. Render reads `render.yaml` (repo root). It will show one service:
   `polysignal-api` on the **Free** plan.
4. For the **`DATABASE_URL`** prompt, paste the Supabase session-pooler
   string **with `?sslmode=require` appended**.
5. Click **Apply** → deploy. Watch the build log: it installs
   `requirements.txt` (Python is pinned to **3.13.5** — see note below) and
   starts uvicorn.
6. When done, copy the service URL: `https://polysignal-api.onrender.com`.
   - Verify: open `https://polysignal-api.onrender.com/health` →
     `{"status":"ok","database":"healthy"}`.
   - The interactive docs live at `/docs`.

> **Why Python 3.13.5 is pinned:** Render's current default Python is
> 3.14.x, which has no prebuilt wheels for `numpy==2.2.1` /
> `pandas==2.2.3` from `requirements.txt` — the build would fail.
> `render.yaml` pins `PYTHON_VERSION=3.13.5` to match the versions that
> have wheels.
>
> **Why not Render's free Postgres?** It is deleted after 30 days. Supabase's
> free tier is permanent.
>
> **Why 512 MB RAM is enough:** free instance; uvicorn runs with 1 worker,
> the ML models in this repo are lightweight (no torch/tensorflow in
> `requirements.txt`), and the DB pool is capped at 3 connections.

---

## Part 3 — Cloudflare Pages (frontend)

Use Cloudflare's **direct Git integration** — it builds and deploys on every
push to `main` with no GitHub Actions workflow needed.

1. Create a free account at <https://dash.cloudflare.com/sign-up> (no card).
2. **Workers & Pages → Create → Pages → Connect to Git** → authorize your
   GitHub account → select `evansmakori/PolySignal-Polymarket-Analytics-Platform`.
3. Configure the build:
   - **Project name:** `polysignal`
   - **Production branch:** `main`
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `frontend`
4. Add environment variables (build time — they're baked into the bundle):
   - `VITE_API_BASE_URL` = `https://polysignal-api.onrender.com`
   - `VITE_WS_URL` = `wss://polysignal-api.onrender.com`
5. **Save and Deploy.** Cloudflare installs its GitHub App, builds the
   `frontend/` directory, and serves it at `https://polysignal.pages.dev`.
   Every push to `main` redeploys automatically.

Verify the dashboard loads, markets appear, and a market's orderbook/
websocket updates live.

> The repo also contains `.github/workflows/deploy-frontend.yaml` — an
> Actions-based alternative that deploys via `wrangler` using
> `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets. Prefer the
> direct Git integration above: fewer moving parts.
>
> If you'd rather use **GitHub Pages** for the frontend, it also works — but
> GitHub Pages has no SPA fallback support, so you'd need the `404.html`
> single-file-route hack, and bandwidth is ~100 GB/mo soft. Cloudflare Pages
> is recommended (unlimited bandwidth, native `_redirects` support).
> Either way, the backend setup in Parts 1–2 is identical.

---

## Part 4 — Keep-alive (activate in 2 minutes)

The goal: hit the backend at least once every ~10 minutes so Render never
reaches its 15-minute idle timeout, and make sure Supabase sees activity.
The workflow is ready as a template at
**[`docs/workflows/keep-alive.yaml`](../workflows/keep-alive.yaml)**. It runs
every 10 minutes and:

1. `GET <backend>/health` — keeps the Render service awake. The `/health`
   endpoint itself executes `SELECT 1` against Postgres, so it keeps the DB
   warm too.
2. `psql SELECT 1` directly on Supabase — even if the backend is down, the
   7-day inactivity pause can never trigger.

GitHub only runs files that live in `.github/workflows/`, so copy the
template there — pick either option:

### Option A — GitHub web editor (no terminal)

1. Open [`docs/workflows/keep-alive.yaml`](../workflows/keep-alive.yaml) in
   your repo → **Edit this file** (pencil icon) → copy all content.
2. **Add file → Create new file** → name it `.github/workflows/keep-alive.yaml`
   → paste → **Commit** directly to `main`.

### Option B — local CLI (you already have a token)

```bash
git clone https://github.com/evansmakori/PolySignal-Polymarket-Analytics-Platform.git
cd PolySignal-Polymarket-Analytics-Platform
mkdir -p .github/workflows
cp docs/workflows/keep-alive.yaml .github/workflows/keep-alive.yaml
git add .github/workflows/keep-alive.yaml
git commit -m "Add free-tier keep-alive workflow"
git push origin main
```

*(This step must be done by you: GitHub blocks third-party app tokens from
creating workflow files in your repos — that's why it's not pushed directly
from this repo's automation.)*

### Then, add two secrets

GitHub repo → **Settings → Secrets and variables → Actions → Secrets** →
**New repository secret**:

- `RENDER_SERVICE_URL` → `https://polysignal-api.onrender.com`
- `SUPABASE_DATABASE_URL` → your pooler string (with `?sslmode=require`)

Confirm it runs: **Actions → Keep Free Tier Alive → Run workflow**, or wait
for the next 10-minute tick.

The chain effect: backend awake → its in-process background jobs run
(`ENABLE_BACKGROUND_JOBS=true`) → jobs write to Postgres every ~5 minutes →
Supabase sees constant activity. One workflow keeps all three layers alive.

### Option C — no GitHub Actions at all

A free <https://cron-job.org> monitor hitting
`https://polysignal-api.onrender.com/health` every 10 minutes keeps the
backend awake the same way (the backend's own jobs then keep Supabase
active). Fewer moving parts, but skips the direct Supabase `SELECT 1`.

> **Known limits** — GitHub suspends *scheduled* workflows in repos with no
> activity for 60 days (any commit re-enables; the manual `workflow_dispatch`
> always works). cron-job.org free accounts have a 10-minute minimum
> interval, which fits the 15-minute Render sleep window.

---

## Verification checklist

- [ ] `https://polysignal-api.onrender.com/health` → `database: healthy`
- [ ] `https://polysignal.pages.dev` loads, markets list populates
- [ ] Open a market → price chart, orderbook, and live updates (WebSocket)
      work
- [ ] AI endpoints respond (`/api/ai/*`)
- [ ] Keep-alive runs every 10 min (Actions tab, or cron-job.org history)
- [ ] Revisit the site after 1–2 hours of no browsing → loads instantly
      (no 30–50 s cold start), proving the keep-alive is working

---

## Ongoing care (5 minutes/month)

- **Backups**: free tiers have no automated backups. Run occasionally:

  ```bash
  pg_dump "$SUPABASE_DATABASE_URL" --no-owner | gzip > polysignal-backup-$(date +%F).sql.gz
  ```

- **Quota watch**: Supabase free = 500 MB DB / 5 GB egress. PolySignal's
  tables (orderbook snapshots, price history, trades) grow over time —
  check the dashboard monthly; prune old snapshots if needed.
- **Recovery from sleep**: if the backend ever sleeps (keep-alive down), it
  self-restarts on the next visit — just takes ~30–50 s. No action needed.
- **Render policy change**: free-tier terms can change. If the free service
  is discontinued, the fallback is Hugging Face Spaces (free Docker, 2 vCPU /
  16 GB, sleeps when idle) — just switch `render.yaml` to a Docker runtime.

## Undoing / migrating back

The prior DigitalOcean deployment (`.do/app.yaml` + App Platform/Droplet
workflows) was removed from this repo when we moved to the free stack. If you
ever want to switch back, restore `.do/app.yaml` and the deploy workflows from
git history and re-point `VITE_API_BASE_URL`/`VITE_WS_URL` in Cloudflare to
the DO URL. Render and Supabase can be deleted from their dashboards anytime —
the only data to migrate is Postgres (pg_dump / pg_restore both ways).

## Costs

| Item | Amount |
|---|---|
| Cloudflare Pages | $0 — no card |
| Render free web service | $0 — no card |
| Supabase free project | $0 — no card |
| cron-job.org / GitHub Actions (public repo) | $0 |
| **Total** | **$0 forever, nothing can charge you** |

---

## Appendix — Secrets & variables reference

| Where | Key | Value |
|---|---|---|
| GitHub → Actions → **Secrets** | `RENDER_SERVICE_URL` | `https://polysignal-api.onrender.com` |
| GitHub → Actions → **Secrets** | `SUPABASE_DATABASE_URL` | pooler string + `?sslmode=require` |

Infrastructure files shipped in this repo:

- `render.yaml` — Render Blueprint (backend, free plan, Python 3.13.5 pinned)
- `docs/workflows/keep-alive.yaml` — keep-alive template to copy into
  `.github/workflows/` (Part 4)
- `frontend/public/_redirects` — SPA fallback for Cloudflare Pages

The frontend deploy itself needs **no workflow**: Cloudflare's Git
integration (Part 3) builds and publishes `frontend/` on every push to
`main`.
