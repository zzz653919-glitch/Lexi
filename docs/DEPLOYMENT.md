# Deploying Lexi Learn (public URL)

## Why a shared link did not open
Lexi Learn is a **Node.js server** (Express + a SQLite database file), not a static site. A link only works while that server runs somewhere reachable from the internet. Running `npm start` on a personal computer exposes it only at `http://127.0.0.1:3000` (the default bind address), which nobody else can open, and the repository contained no hosting configuration. Static-only hosts (GitHub Pages, plain Vercel/Netlify static deploys) cannot run the server. Vercel *can* run it as a serverless function, but only with a hosted database (Turso) because functions have no persistent disk – see "Vercel + Turso" below.

## What you need
* A host that runs a long-lived **Node ≥ 22.5** process **and** keeps a **persistent disk/volume** (the SQLite database and uploaded audio live there). Examples: Render (paid instance + disk), Railway or Fly.io (volume), any VPS, or any Docker host.
* Do **not** use serverless/ephemeral file systems for the database: data would disappear.

## Settings
| Item | Value |
|---|---|
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Health check path | `/healthz` |
| Persistent disk mount | any path, e.g. `/var/data` (set `LEXI_DATA_DIR` to it) |

Environment variables (set them in the host dashboard, never commit them):

| Variable | Purpose |
|---|---|
| `NODE_ENV=production` | enables production defaults (binds `0.0.0.0`, trusts the HTTPS proxy) |
| `PORT` | set by most hosts automatically |
| `LEXI_DATA_DIR` | directory of the database and uploads (persistent disk) |
| `PUBLIC_URL` | public address, used in password-reset links |
| `COOKIE_SECURE=1`, `TRUST_PROXY=1`, `HOST` | optional overrides; cookies are marked `Secure` automatically when the request arrives over HTTPS |
| `LEXI_NO_SEED=1` | skip creating the sample course |

No API keys or database credentials are needed; there is no external database.

## Ready-made files
* `Dockerfile` – `docker build -t lexi . && docker run -p 3000:3000 -v lexi-data:/data lexi`
* `render.yaml` – Render blueprint (web service + 1 GB disk + health check).

## First start
1. Deploy; the database is migrated and the sample course is created automatically.
2. Create the administrator once from the host's shell: `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong password>' npm run create-admin`.
3. Open `https://<your-host>/` and `https://<your-host>/admin/login`.

## Routing behaviour
* Client routes (`/`, `/login`, `/register`, `/forgot`, `/reset`, `/learn`, `/attempt/:id`, `/practice`, `/vocabulary`, `/review`, `/leaderboard`, `/achievements`, `/profile`) serve the app shell with status 200 when opened directly or reloaded; unknown paths get the app's "page not found" screen **with HTTP 404**.
* Protected pages redirect guests to `/login?next=<page>` and return there after sign-in.
* `/admin/*` pages and assets are only served to signed-in staff (others are redirected to `/admin/login`); every admin API call is authorised on the server.
* Missing assets and uploads return real 404s.

## Domain and HTTPS
Point the domain's DNS (CNAME/A record as the host instructs) at the host and enable its managed HTTPS certificate. Set `PUBLIC_URL` to the final `https://` address. All assets use root-relative paths, so there is no mixed content.

## Vercel + Turso (serverless)
The app can run on Vercel when the database is a hosted **Turso** (libSQL, SQLite-compatible) database. The code supports both: a local SQLite file (`LEXI_DATA_DIR` / `LEXI_DB`, used by Render/Docker/VPS and the tests) and `DATABASE_URL` (a `libsql://…` address) for Vercel. Audio uploads are stored in the database, rate limits too, so nothing needs a disk.

### One-time setup
1. **Turso** (https://turso.tech, free tier available): install the CLI, then
   `turso db create lexi` → `turso db show lexi --url` (this is `DATABASE_URL`, looks like `libsql://lexi-<you>.turso.io`) → `turso db tokens create lexi` (this is `DATABASE_AUTH_TOKEN`). Pick the region closest to your Vercel region.
2. **Vercel**: *Add New → Project → import the GitHub repository*. Framework preset: **Other**. Leave the commands as they are (they come from `vercel.json`).
3. **Environment variables** (Project → Settings → Environment Variables, for *Production* and *Preview*): `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, and `PUBLIC_URL` (your final `https://…` address). Mark the token as *Sensitive*. Never commit these values.
4. **Deploy.** The build (`scripts/vercel-build.js`) creates/updates the database schema, creates the sample course on an empty database (skip with `LEXI_NO_SEED=1`), and copies the static files to the CDN. The app shell, `/admin/*` and the API are served by the function `api/index.js`.
5. **Create the administrator** from your own computer (there is no shell on Vercel), once, with the same two values:
   `DATABASE_URL='libsql://…' DATABASE_AUTH_TOKEN='…' ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<strong password>' npm run create-admin`
6. Open `https://<project>.vercel.app/`, register a learner, then sign in at `/admin/login` and check **Users**.

### Things to know
* Settings, translations edited in the admin panel and other shared data are read from the database on each request (cached for 2 s), so every function instance agrees.
* Password-reset links cannot be e-mailed (no mail server is configured); they are written to the function log (Vercel → Logs). Connect a mailer before opening registration to the public.
* The first request after a quiet period is slower (cold start + a network round trip per query). Use a Turso region near your Vercel functions.
* `npm run backup` with `DATABASE_URL` set writes a JSON dump of all tables (except sessions) to `backups/`; Turso also offers its own backups.
* Request bodies are limited by Vercel to about 4.5 MB (the app's own limits are lower: audio 2 MB, imports 2 MB).
