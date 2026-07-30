# Deployment (Phase 10)

A numbered walkthrough to put Campus Relay on the public internet, for free, using
**Neon** (PostgreSQL), **Render** (the Express API) and **Vercel** (the React frontend).
None of the three needs a credit card on their free tiers.

Assumes Windows, pgAdmin already installed (see `docs/SETUP-WINDOWS.md` if not), and that
the app already runs locally — deploy a working app, don't debug a broken one in
production.

Do the sections in order. Each one ends with a "check it worked" — do not move on until
it says what it should.

---

## 1. Push to GitHub

### 1.1 Create the repository on GitHub

1. Go to <https://github.com/new>.
2. Name it (e.g. `campus-relay`). Keep it **Public** if you want to link it on a résumé.
3. Do **not** tick "Add a README" or ".gitignore" — this project already has both, and
   GitHub will refuse to push if the histories don't match.
4. Click **Create repository**. Leave the "…or push an existing repository" page open;
   you'll copy the URL from it in step 1.3.

### 1.2 Initialise git locally

From the project root (`campus-relay/`, the folder containing `client/`, `server/` and
this `docs/` folder):

```powershell
git init
git add .
git commit -m "chore: initial commit"
```

**Check it worked:**

```powershell
git status
```

Expect `nothing to commit, working tree clean`.

### 1.3 Confirm `.env` was never staged

Before pushing anywhere, double-check no real secret is about to leave your machine:

```powershell
git ls-files | Select-String ".env"
```

You should see exactly:

```
client/.env.example
server/.env.example
```

If `server/.env` or `client/.env` appears in that list, **stop** — do not push. Run
`git rm --cached server/.env client/.env` (adjust to whichever appeared), confirm
`.gitignore` at the project root lists `.env`, `server/.env` and `client/.env`, then
re-commit.

### 1.4 Push

Copy the URL GitHub showed you in step 1.1 (looks like
`https://github.com/<you>/campus-relay.git`):

```powershell
git remote add origin https://github.com/<you>/campus-relay.git
git branch -M main
git push -u origin main
```

Git will ask you to sign in the first time (a browser window opens — use your GitHub
account).

**Check it worked:** refresh the GitHub page. You should see `client/`, `server/`,
`db/`, `docs/`, `CLAUDE.md` and `README.md` — and if you click into `server/`, there
should be **no `.env` file**, only `.env.example`.

---

## 2. Neon (PostgreSQL)

### 2.1 Create the project

1. Go to <https://neon.tech> and sign up (GitHub sign-in is fastest).
2. **Create a project**. Any name; pick a region close to where Render will run
   (US East is a safe default if unsure — Render's free tier defaults there too).
3. Neon creates a database called `neondb` by default. That's fine — you don't need to
   rename it, the connection string carries the name.

### 2.2 Get the connection string

On the project's **Dashboard**, find **Connection string** (sometimes under
"Connection Details"). Select:

- **Pooled connection** — on
- Role: the default one Neon created

Copy the full string. It looks like:

```
postgresql://<user>:<password>@<host>.neon.tech/<database>?sslmode=require
```

Save it somewhere temporarily (Notepad) — you'll paste it in two places: the Neon SQL
editor doesn't need it, but `psql` (2.3) and Render (section 3) both do.

### 2.3 Load the schema and seed data

**Option A — Neon's own SQL editor (no local tools needed):**

1. In the Neon dashboard, open the **SQL Editor**.
2. Open `db/schema.sql` from this project in a text editor, copy the entire contents,
   paste into the Neon SQL editor, and run it.
3. Repeat with `db/seed.sql`.

**Option B — `psql` from your machine** (same `psql` you installed in
`docs/SETUP-WINDOWS.md`):

```powershell
psql "postgresql://<user>:<password>@<host>.neon.tech/<database>?sslmode=require" -f db/schema.sql
psql "postgresql://<user>:<password>@<host>.neon.tech/<database>?sslmode=require" -f db/seed.sql
```

Use your actual connection string from 2.2, in quotes, in place of both.

### 2.4 Verify

In the Neon SQL editor (or `psql`), run:

```sql
SELECT order_code, status FROM orders ORDER BY id;
```

Expect 4 rows. Then:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

Expect 8 tables: `campuses`, `gates`, `hostels`, `blocks`, `users`, `orders`,
`delivery_assignments`, `tracking_events`.

---

## 3. Render (the Express API)

### 3.1 Create the Web Service

1. Go to <https://render.com>, sign up, and connect your GitHub account when prompted.
2. **New** → **Web Service**.
3. Pick the `campus-relay` repo you pushed in section 1.
4. Fill in:

| Field | Value |
|---|---|
| Name | anything, e.g. `campus-relay-api` |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

**Root Directory: `server` matters.** This repo holds both `client/` and `server/` —
without it, Render tries to run `npm install` at the repo root, where there is no
`package.json`, and the build fails immediately.

### 3.2 Environment variables

Still on the Render setup page (or **Environment** tab after creating the service), add:

| Key | Value |
|---|---|
| `DATABASE_URL` | The full Neon connection string from step 2.2 |
| `JWT_SECRET` | A long random string — generate one locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the output |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `http://localhost:5173` for now — you'll change this in section 5 once Vercel gives you a real domain |

Do **not** set `PORT` — Render assigns one automatically and injects it as the `PORT`
environment variable, which `server/src/config/env.js` already reads.

Do **not** set any `PG*` variable (`PGHOST`, `PGUSER`, etc.) — `server/src/config/db.js`
checks `DATABASE_URL` first and uses it exclusively when present, ignoring the `PG*`
values entirely. Setting both is harmless but pointless; setting `PG*` **instead of**
`DATABASE_URL` will not work, because there is no local Postgres for Render to reach.

**Why TLS matters here:** Neon requires an encrypted connection. `db.js` already sends
`ssl: { rejectUnauthorized: false }` whenever `DATABASE_URL` is set, so you don't need to
add `?sslmode=require` yourself — but it doesn't hurt if the string Neon gave you already
includes it (it usually does).

### 3.3 Deploy

Click **Create Web Service**. Render builds and starts it — this takes 2–5 minutes the
first time. Watch the **Logs** tab.

**Check it worked:** logs should end with:

```
[db]     connected to "neondb"
[server] Campus Relay API listening on http://localhost:<port>
[server] environment: production
```

Then, in a browser, visit `https://<your-service-name>.onrender.com/api/health`. Expect:

```json
{"success":true,"service":"campus-relay-api","time":"..."}
```

If this doesn't come back within 30 seconds or so, see the troubleshooting table in
section 7 before continuing.

---

## 4. Vercel (the React frontend)

### 4.1 Import the project

1. Go to <https://vercel.com>, sign up, connect GitHub.
2. **Add New** → **Project** → pick the `campus-relay` repo.
3. Vercel will ask for a **Root Directory** — set it to `client`. It should then
   auto-detect **Framework Preset: Vite** and fill in:

| Field | Value |
|---|---|
| Root Directory | `client` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Leave these as the auto-detected defaults unless Vercel got the root directory wrong —
double check it says `client`, not the repo root.

### 4.2 Environment variable

Before clicking Deploy, add one environment variable:

| Key | Value |
|---|---|
| `VITE_API_URL` | Your Render URL from section 3, plus `/api` — e.g. `https://campus-relay-api.onrender.com/api` |

**This has to be set before the first build**, not after — see the note at the bottom of
this document about why.

### 4.3 Deploy

Click **Deploy**. Takes about a minute. When it finishes, Vercel gives you a URL like
`https://campus-relay-<random>.vercel.app`.

**Check it worked:** open that URL. The Landing page should load with no visible errors.
Do **not** try to log in yet — CORS isn't closed on the API side until section 5, so
login will fail with a network error until then. That's expected right now.

---

## 5. Close the CORS loop

Right now Render only allows requests from `http://localhost:5173`. Your live Vercel
site is a different origin, so the browser will block every API call from it until you
tell Render about it.

1. Copy your Vercel URL from section 4.3 (the `https://campus-relay-<random>.vercel.app`
   one, not a `-git-main-` preview URL).
2. On Render, open your service → **Environment** → edit `CORS_ORIGIN` → set it to your
   Vercel URL (no trailing slash). If you also want `localhost:5173` to keep working for
   local development against the live API, separate them with a comma:
   `http://localhost:5173,https://campus-relay-<random>.vercel.app`
3. Save. Render redeploys automatically when an environment variable changes — watch the
   **Logs** tab until it says `[server] Campus Relay API listening` again.

### What a CORS misconfiguration actually looks like

If you skip this step, or mistype the URL, you won't see an error message on the page —
Campus Relay's API client treats a browser-blocked request as a network failure and
shows a quiet toast: **"Service unavailable, try again shortly."** That message alone
doesn't tell you it's CORS.

To confirm it *is* CORS: open the browser DevTools (`F12`) → **Console** tab. A CORS
rejection reads like:

```
Access to XMLHttpRequest at 'https://campus-relay-api.onrender.com/api/auth/login'
from origin 'https://campus-relay-xyz.vercel.app' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

That exact origin in the message — `https://campus-relay-xyz.vercel.app` — is what
needs to be in Render's `CORS_ORIGIN`, character for character (no trailing slash, right
`https://`).

---

## 6. Verification

Walk through the whole relay on the live site:

1. `https://<your-api>.onrender.com/api/health` → `{"success":true,...}`.
2. On the Vercel site, log in as the seeded admin (`9000000001` / `Admin@123`). You
   should land on `/admin`.
3. Log out, register a brand-new student account, and create a delivery request.
4. In Neon's SQL editor, confirm it's really there:
   ```sql
   SELECT order_code, status, created_at FROM orders ORDER BY id DESC LIMIT 1;
   ```
   It should be the order you just created, seconds ago.
5. If you have a second account handy (or an incognito window), log in as a seeded
   partner (`9100000001` / `Partner@123`), accept the order from the pool, and walk it
   through to delivered. Confirm the student sees each step update within 10 seconds.

If all five pass, the deployment is done.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Browser console shows "has been blocked by CORS policy" | `CORS_ORIGIN` on Render doesn't include your exact Vercel URL | Section 5 — copy the *exact* origin from the console error into `CORS_ORIGIN`, save, wait for redeploy |
| API returns `503` with `"The database is unreachable"` | `DATABASE_URL` is missing, mistyped, or Neon's compute is asleep (free tier suspends after inactivity) | Check the Render env var for typos; visit the Neon dashboard once to wake it, then retry |
| `relation "users" does not exist` (or similar) in Render logs | `db/schema.sql` was never run against the Neon database | Repeat section 2.3 against the *same* database Render's `DATABASE_URL` points at |
| `401` immediately after a correct login | `JWT_SECRET` differs between when the token was issued and now (e.g. you changed it after someone logged in), or it's missing on Render | Re-set `JWT_SECRET` on Render, log in again to get a fresh token |
| Site is slow or briefly unreachable a few seconds after opening it | Render's free tier spins the service down after ~15 minutes idle, and the first request after that has to cold-start it | Not a bug — wait 30–60 seconds and reload. Upgrading off the free tier removes this |
| Blank white page right after a fresh deploy | Usually `VITE_API_URL` was missing or wrong **at build time** | See the note below — fix the env var on Vercel and trigger a new deploy, not just a restart |

### Why "just restart" doesn't fix a bad `VITE_API_URL`

Vite inlines every `VITE_*` variable directly into the built JavaScript files at
**build time** — there is no server reading `process.env` at request time the way
`server/` does. Once `client/dist/` is built, the value is baked into the bundle
permanently.

That means changing `VITE_API_URL` in the Vercel dashboard does nothing to a site that's
already live. You have to trigger a **new build** (Vercel's **Deployments** tab →
**Redeploy**, or push a new commit) for the change to take effect. A restart alone
reuses the old build and the old (wrong) baked-in URL.
