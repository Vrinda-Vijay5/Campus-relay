# CLAUDE.md — Campus Relay

Read this file fully before writing any code. It is the contract for this repository.

---

## 1. What this project is

Campus Relay solves a real problem on large college campuses: external delivery
partners (Swiggy, Zomato, Blinkit, Amazon…) are not allowed into hostel/residential
areas because of security restrictions.

```
External delivery partner → College main gate → Campus Relay partner → Hostel gate → Student
```

A student raises a request, the external rider drops the parcel at the main gate, and a
Campus Relay delivery partner carries it the last leg to the student's hostel gate.

**This core idea must not change.** Every feature exists to serve it.

It is a final-year B.Tech CSE portfolio project. The owner is a competent programmer but
new to running full-stack apps, and must be able to explain every line in an interview.

---

## 2. Stack — fixed, do not add to it

| Layer    | Choice |
|----------|--------|
| Frontend | React 18 + Vite, React Router, axios, plain CSS |
| Backend  | Node + Express 4 (CommonJS), `pg` (node-postgres) |
| Database | PostgreSQL 16, raw parameterised SQL — **no ORM** |
| Auth     | JWT access token + bcryptjs |

Permitted frontend dependencies: `react`, `react-dom`, `react-router-dom`, `axios`.
Permitted backend dependencies: already listed in `server/package.json`.

**Do not introduce** an ORM, Prisma, TypeScript, Tailwind, Redux, a component library,
Docker, WebSockets, Next.js, a chart library, or a test framework. If you believe
something is genuinely needed, stop and ask first. Buzzword additions are a failure.

Live updates use **polling every 10 seconds**, not WebSockets. This is a deliberate
decision: cheaper to host, trivial to explain, and 10s is fine for this domain.

---

## 3. Current state of the repo

| Path | Status |
|------|--------|
| `db/schema.sql`, `db/seed.sql` | **Done and verified** against PostgreSQL 16 |
| `server/` | **Done and verified** — 40+ passing API assertions |
| `client/` | **Not started** — this is your main job |
| `README.md`, `docs/DEPLOYMENT.md`, `docs/INTERVIEW.md` | Not started |

Start at Phase 3 in `docs/BUILD-PLAN.md`.

Treat `db/` and `server/` as working code. Read them before writing the frontend — they
define the exact data shapes you must consume. Change them only when a phase explicitly
says so, or when you find a genuine bug (report it before fixing).

---

## 4. Non-negotiable rules

1. **No placeholders.** Never write `// TODO`, `// implement later`, `// add your logic
   here`, or a stub that returns fake data. Every file you finish must actually work.
2. **No hardcoded data where the API has it.** Campuses, gates, hostels, blocks, vendors
   and status labels all come from the backend. No arrays of block letters in JSX.
3. **The API contract is fixed.** `docs/API-CONTRACT.md` is the source of truth. Do not
   invent endpoints or rename fields. If the frontend needs something the API does not
   expose, say so and wait — do not silently add a backend route.
4. **Never commit secrets.** `.env` is gitignored. Only `.env.example` is committed, with
   placeholder values.
5. **One phase at a time.** Finish a phase, run its acceptance checks, commit, then stop
   and report. Do not run ahead into the next phase.
6. **Explain as you go.** Comment the *why*, not the *what*. `// LEFT JOIN because an
   order has no partner until someone accepts it` is useful; `// loop over orders` is noise.
7. **Ask before deleting** anything that already works.

---

## 5. Order state machine

The backend owns this. The frontend must never assume a transition is legal — it reads
`order.nextStatuses` from the API response and renders buttons from that.

```
CREATED → WAITING_AT_MAIN_GATE → ASSIGNED → PICKED_UP
        → OUT_FOR_DELIVERY → REACHED_HOSTEL_GATE → DELIVERED
```

`CANCELLED` is reachable from any non-terminal state. `DELIVERED` and `CANCELLED` are terminal.

Who may do what:

| Transition | Who |
|---|---|
| → `WAITING_AT_MAIN_GATE` | student (their own order), admin |
| → `ASSIGNED` | partner (self-accept from pool), admin (assign/reassign) |
| → `PICKED_UP` / `OUT_FOR_DELIVERY` / `REACHED_HOSTEL_GATE` / `DELIVERED` | the assigned partner, admin |
| → `CANCELLED` | student **only before `PICKED_UP`**; admin any time before `DELIVERED` |

Source of truth: `server/src/utils/orderState.js`.

---

## 6. What the app deliberately does NOT have

Do not build these. They were considered and cut:

- **No payments, no fees, no wallet, no "cash collected", no amount displayed anywhere.**
  The service is free in this model. There is no `delivery_fee` column — do not add one.
- No handover OTP or PIN pad. The partner taps "Delivered" directly.
  (The old PIN pad from the original HTML version is retired.)
- No email, SMS or OTP verification. Registration is phone + password only.
- No light theme. Dark navy only.
- No charts. Admin statistics are counters.
- No partner self-registration. An admin creates partner accounts.

---

## 7. Roles

- **student** — self-registers, creates requests, confirms the parcel reached the gate,
  tracks, cancels (before pickup), sees own history. Sees only their own orders.
- **partner** — created by an admin. Sees a pool of parcels waiting at gates on their
  campus, accepts one, advances its status, sees their own completed deliveries.
  Capped at 3 concurrent deliveries (`MAX_ACTIVE_PER_PARTNER`).
- **admin** — seeded. Counters, live board of active deliveries, all orders with
  search/filter/pagination, assign & reassign partners, create partners, activate and
  deactivate users, manage campuses/gates/hostels/blocks.

---

## 8. Security expectations for frontend work

- Store the JWT in `localStorage` under `campus_relay_token`; attach it via a single axios
  request interceptor. A response interceptor catches `401`, clears the token, and
  redirects to `/login`.
- Never render HTML from user input. Use JSX text interpolation only — no
  `dangerouslySetInnerHTML`, no `innerHTML`. (The original project had an XSS hole here.)
- Route guards are UX, not security. The backend enforces every rule; guards just avoid
  showing a page that will 403.
- Never log tokens, passwords or phone numbers to the console.

---

## 9. How to verify your work

```bash
# Terminal 1 — backend (from the server/ folder)
npm run dev            # expect: [db] connected to "campus_relay"

# Terminal 2 — frontend (from the client/ folder)
npm run dev            # expect: Local: http://localhost:5173

# Sanity check the API is reachable
curl http://localhost:5000/api/health
```

Seeded logins (from `db/seed.sql`):

| Role | Phone | Password |
|---|---|---|
| Admin | `9000000001` | `Admin@123` |
| Partner (Ravi Kumar) | `9100000001` | `Partner@123` |
| Partner (Sneha Rani) | `9100000002` | `Partner@123` |
| Student (Arjun Mehta) | `9200000001` | `Student@123` |
| Student (Divya Nair) | `9200000002` | `Student@123` |

A phase is done when **every** acceptance check in `docs/BUILD-PLAN.md` passes in a real
browser — not when the code merely compiles. Check the browser console for errors and
resize to 375px width before declaring a phase complete.

---

## 10. Code style

- Backend: CommonJS (`require`), 2-space indent, single quotes, semicolons.
- Frontend: ESM, function components with hooks, one component per file, PascalCase
  filenames for components.
- Layering on the backend is `route → validator → controller → service → db`.
  Controllers stay thin; business rules live in services. Follow the existing pattern.
- Error messages are for humans: "Enter a valid 10-digit mobile number", not "Invalid input".
- Keep files under ~300 lines. Split when they grow past that.
