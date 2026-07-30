# Setup on Windows (Phase 0)

Do all of this before you open Claude Code. Every step tells you what to run, where to run
it, and how to know it worked.

Throughout, "PowerShell" means: press `Win`, type `powershell`, press Enter.
`cd` means "change folder".

---

## 1. Node.js

Node runs both the backend and the frontend build tools. npm is its package manager and
arrives with it.

1. Go to <https://nodejs.org> and download the **LTS** installer (the left-hand button).
2. Run it. Accept the defaults. Tick "Automatically install the necessary tools" if
   offered.
3. Close every PowerShell window and open a new one (the installer changes your PATH, and
   old windows do not see the change).

**Check it worked** — in PowerShell, anywhere:

```powershell
node -v
npm -v
```

Expect something like `v20.11.1` and `10.2.4`. Any Node version 18 or higher is fine.
If you get "not recognized", the PATH did not update — restart your computer and retry.

---

## 2. PostgreSQL and pgAdmin

PostgreSQL is the database. pgAdmin is the graphical tool for looking inside it, and it
ships with the same installer.

1. Go to <https://www.postgresql.org/download/windows/> → "Download the installer".
2. Choose **version 16**.
3. During installation:
   - Keep pgAdmin 4 and Command Line Tools ticked.
   - **You will be asked for a password for the `postgres` user. Write it down.** You
     cannot recover it later, and you will need it in a moment.
   - Leave the port as **5432**.
   - Skip Stack Builder at the end.

**Check it worked:** press `Win`, type `pgAdmin`, open it. It asks for a master password
(this is pgAdmin's own, separate from the `postgres` one — set anything you will remember).
In the left tree you should see `Servers → PostgreSQL 16`. Click it and enter the
`postgres` password you wrote down.

If PostgreSQL is not running: press `Win`, type `services.msc`, find
`postgresql-x64-16`, right-click → Start.

---

## 3. Create the database and load the schema

In pgAdmin:

1. Right-click **Databases** → **Create** → **Database…**
2. Name it exactly `campus_relay`. Save.
3. Click `campus_relay` to select it, then **Tools** → **Query Tool**.
4. Click the folder icon in the Query Tool toolbar, open `db/schema.sql` from this
   project, and press **F5** to run it.
   **Expect:** messages ending in `Query returned successfully`. Some `NOTICE: table
   "..." does not exist, skipping` lines are normal on a fresh database — the file starts
   by dropping tables that are not there yet.
5. Open `db/seed.sql` the same way and press **F5**.

**Check it worked:** in the Query Tool, run:

```sql
SELECT order_code, status FROM orders ORDER BY id;
```

Expect 4 rows with codes like `CR001001-111F`. Then:

```sql
SELECT h.gender, count(b.*) FROM hostels h JOIN blocks b ON b.hostel_id = h.id GROUP BY 1;
```

Expect `girls | 10` and `boys | 20`.

In the left tree, expand `campus_relay → Schemas → public → Tables` — you should see 8
tables.

---

## 4. Git

Git tracks your code history; GitHub stores it online.

1. Download from <https://git-scm.com/download/win> and install with the defaults.
2. Open a **new** PowerShell and set your identity (this appears on every commit):

```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Check it worked:**

```powershell
git --version
```

Also create a free account at <https://github.com> if you do not have one.

---

## 5. Start the backend

Open PowerShell and go to the `server` folder inside this project. Adjust the path to
wherever you unzipped it:

```powershell
cd C:\Users\YourName\Downloads\campus-relay\server
```

Copy the environment template:

```powershell
copy .env.example .env
```

Generate a JWT secret and copy the long string it prints:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Open `.env` in Notepad (`notepad .env`) and set two values:

- `PGPASSWORD=` the `postgres` password you wrote down in step 2
- `JWT_SECRET=` the long random string you just generated

Save and close. Then install the dependencies and start the server:

```powershell
npm install
npm run dev
```

**Expect to see:**

```
[db]     connected to "campus_relay"
[server] Campus Relay API listening on http://localhost:5000
[server] environment: development
[server] allowed frontends: http://localhost:5173
```

**Check it worked:** leave that window running and open a **second** PowerShell:

```powershell
curl http://localhost:5000/api/health
```

Expect `{"success":true,"service":"campus-relay-api","time":"..."}`.

Then check a real login:

```powershell
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"phone\":\"9000000001\",\"password\":\"Admin@123\"}"
```

Expect a long `"token":"eyJ..."` in the response. **That token proves the whole stack
works** — Express is running, PostgreSQL is connected, bcrypt verified the seeded
password, and JWT signed a token.

To stop the server: click its window and press `Ctrl+C`.

### If it does not start

| What you see | What it means | Fix |
|---|---|---|
| `ECONNREFUSED ... 5432` | PostgreSQL is not running | `services.msc` → start `postgresql-x64-16` |
| `password authentication failed` | Wrong `PGPASSWORD` | Fix it in `server\.env` |
| `database "campus_relay" does not exist` | Step 3 not done | Create the database in pgAdmin |
| `relation "users" does not exist` | Schema not loaded | Run `db/schema.sql` then `db/seed.sql` |
| `JWT_SECRET is missing or too short` | `.env` not filled in | Paste the generated string |
| `EADDRINUSE ... 5000` | An old server is still running | Close the other PowerShell, or set `PORT=5001` |

---

## 6. Commit what you have

From the project root (one level up from `server`):

```powershell
cd ..
git init
git add .
git commit -m "chore: project spec, verified database schema and Express API"
```

**Check it worked:**

```powershell
git status
```

It should say `nothing to commit, working tree clean`. Then confirm your secrets stayed
out:

```powershell
git ls-files | Select-String ".env"
```

You should see `server/.env.example` and `client/.env.example` **only**. If real `.env`
appears, stop and fix `.gitignore` before pushing anywhere.

---

## 7. Install Claude Code

```powershell
npm install -g @anthropic-ai/claude-code
```

**Check it worked:**

```powershell
claude --version
```

Then start it from the project root:

```powershell
cd C:\Users\YourName\Downloads\campus-relay
claude
```

It will ask you to sign in the first time. Once it is running, open
`docs/BUILD-PLAN.md` and begin at Phase 3.

Two things worth knowing before you start:

- Press `Shift+Tab` twice to enter **plan mode**, where Claude Code describes what it
  intends to do before editing files. Use it at the start of every phase.
- Type `/clear` between phases to reset the conversation. Each phase is self-contained,
  and a fresh context produces better work.
