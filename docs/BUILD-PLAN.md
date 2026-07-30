# Build Plan

This is the execution plan for Claude Code. Phases 1 and 2 are already finished and
verified; you start at Phase 3.

**Read `CLAUDE.md`, `docs/API-CONTRACT.md` and `docs/UI-SPEC.md` before Phase 3.**

---

## How to work through this

Install Claude Code once (needs Node 18+):

```bash
npm install -g @anthropic-ai/claude-code
```

Then, from the project root (`campus-relay/`):

```bash
claude
```

For each phase:

1. Paste the phase's **prompt** verbatim.
2. Let Claude Code plan first — press `Shift+Tab` twice to enter plan mode so it shows its
   approach before touching files. Approve, then let it build.
3. Run the **acceptance checks** yourself in a browser. Do not take "done" on trust.
4. If something fails, paste the exact error plus the file it came from. Do not move on.
5. Commit with the given message.
6. Run `/clear` to reset the context, then start the next phase.

One phase per session. A fresh context per phase keeps quality high and cost low.

**Ground rules to repeat if Claude Code drifts:** no new dependencies, no placeholder
comments, no invented API endpoints, no fees or payment anywhere, dark theme only.

---

## Phase 0 — Prerequisites and repo bootstrap

Do this yourself before opening Claude Code. Full Windows instructions are in
`docs/SETUP-WINDOWS.md`.

You need working: Node 18+, PostgreSQL 16 with pgAdmin, Git, and a GitHub account.

```bash
# from campus-relay/
git init
git add .
git commit -m "chore: project spec, verified database schema and Express API"
```

Then confirm the backend runs:

```bash
cd server
copy .env.example .env      # macOS/Linux: cp .env.example .env
# edit .env: set PGPASSWORD and generate JWT_SECRET with the command in the file
npm install
npm run dev
```

**Acceptance:** `curl http://localhost:5000/api/health` returns
`{"success":true,"service":"campus-relay-api",...}` and the console shows
`[db] connected to "campus_relay"`.

If it does not, fix this before writing a single line of frontend. A broken backend makes
every later phase impossible to debug.

---

## Phase 1 — Database ✅ done

`db/schema.sql` and `db/seed.sql`, verified against PostgreSQL 16.

8 tables (`campuses`, `gates`, `hostels`, `blocks`, `users`, `orders`,
`delivery_assignments`, `tracking_events`), primary and foreign keys, CHECK constraints,
an `updated_at` trigger, 10 indexes, and a partial unique index that makes a double
assignment impossible. Seed data covers one campus, two gates, 30 blocks, five users and
four orders spanning different states.

**Verify only:**
```bash
psql -U postgres -d campus_relay -c "\dt"
psql -U postgres -d campus_relay -c "SELECT order_code, status FROM orders ORDER BY id;"
```
Expect 8 tables and 4 orders with codes like `CR001001-111F`.

---

## Phase 2 — Backend API ✅ done

`server/` — 25 endpoints across auth, orders, admin and campus config. Layered as
`route → validator → controller → service → db`.

Verified with 40+ assertions, including: role-based access, ownership checks (404 not 403
for other people's orders), every invalid state transition, two partners racing to accept
the same order, the 3-delivery cap, SQL injection through the search parameter, JWT
tampering, deactivated accounts, and cross-campus gate rejection.

**Verify only:** log in as each seeded role and confirm you get a token:
```bash
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"phone\":\"9000000001\",\"password\":\"Admin@123\"}"
```

---

## Phase 3 — Frontend foundation

**Goal:** a running React app with the design system, API layer, auth and routing. No
feature pages yet beyond auth.

> **Prompt:**
>
> Read CLAUDE.md, docs/API-CONTRACT.md and docs/UI-SPEC.md in full first.
>
> Scaffold the React frontend in `client/` using Vite (`react` template, JavaScript not
> TypeScript). Install only `react-router-dom` and `axios` on top of the template.
>
> Build:
> 1. `client/.env.example` with `VITE_API_URL=http://localhost:5000/api`, and a real
>    `.env` with the same value. Confirm `.env` is gitignored.
> 2. `src/styles/theme.css` — every design token from docs/UI-SPEC.md section 1 as CSS
>    custom properties, plus reset, typography scale, and the `fadeUp` animation wrapped
>    in a `prefers-reduced-motion` guard.
> 3. `src/styles/app.css` — styles for the shared components below.
> 4. `src/api/client.js` — one axios instance reading `VITE_API_URL`. A request
>    interceptor attaching `Authorization: Bearer <token>` from
>    `localStorage.campus_relay_token`. A response interceptor that, on 401, clears the
>    token and redirects to `/login`, and that normalises every error into
>    `{ status, message, details }` so callers never touch `err.response.data` directly.
>    Export named functions per endpoint (`login`, `register`, `getMe`, `listOrders`,
>    `getOrder`, `createOrder`, `updateOrderStatus`, `cancelOrder`, `listAvailable`,
>    `acceptOrder`, `trackByCode`, `getMeta`, `listCampuses`, `listGates`, `listHostels`,
>    and the admin ones) — no raw axios calls in components.
> 5. `src/context/AuthContext.jsx` — holds `user`, `token`, `loading`; on mount, if a
>    token exists, calls `GET /auth/me` to revalidate it and logs out if it fails; exposes
>    `login`, `register`, `logout`.
> 6. `src/context/MetaContext.jsx` — fetches `GET /meta` once and exposes `statusLabels`,
>    `relaySequence`, `vendors`. Nothing in the app may hardcode a status label.
> 7. `src/context/ToastContext.jsx` plus the `Toast` component.
> 8. Shared components from docs/UI-SPEC.md section 3: `Navbar`, `ProtectedRoute`,
>    `StatusBadge`, `Field`, `Button`, `Spinner`, `EmptyState`, `ErrorState`, `Modal`,
>    `ConfirmDialog`, `StatCard`, `Pagination`. `RelayTrack` and `OrderCard` come in
>    Phase 4.
> 9. Routing per docs/UI-SPEC.md section 4, with placeholder page components for routes
>    that later phases fill in — a placeholder page may render a heading and nothing else,
>    but it must be a real component, not a TODO comment.
> 10. Real pages now: `Landing`, `Login`, `Register`, `NotFound`.
>
> `Login` uses phone + password, shows per-field errors from the 400 `details` object, and
> includes the tappable demo-account chips described in docs/UI-SPEC.md section 5.
> `Register` builds its hostel/block dropdown from `GET /campuses/:id/hostels` with an
> `<optgroup>` per hostel. After login, redirect by role: student → `/orders`, partner →
> `/partner`, admin → `/admin`.
>
> Then run `npm run build` and fix every warning before you report back.

**Acceptance checks:**
- `npm run dev` in `client/` serves on `http://localhost:5173` with no console errors.
- Logging in as `9200000001` / `Student@123` lands on `/orders`; as `9000000001` /
  `Admin@123` lands on `/admin`.
- A wrong password shows "Incorrect phone number or password." and does not log you in.
- Submitting an empty register form highlights each field with the API's message.
- Register a brand-new student with a fresh phone number and it works.
- Refreshing the page keeps you logged in; `localStorage` holds `campus_relay_token`.
- Log out clears the token and redirects to `/login`.
- Manually visiting `/admin` as a student redirects rather than showing the page.
- Corrupt the token in devtools, refresh → you are logged out cleanly, not stuck on a
  broken screen.
- At 375px the navbar collapses and nothing overflows horizontally.

**Commit:** `feat(client): scaffold React app with design system, auth and routing`

---

## Phase 4 — Student experience

**Goal:** a student can raise a request, watch it move, and cancel it.

> **Prompt:**
>
> Read docs/UI-SPEC.md sections 2, 5 and 6 again.
>
> Build the student experience:
> 1. `components/RelayTrack.jsx` — the signature element from docs/UI-SPEC.md section 2.
>    Driven entirely by `relaySequence` from MetaContext and the order's `status`.
>    Horizontal on desktop, vertical below 640px. Include the two labelled segments
>    ("External rider", "Relay partner"). Handle delivered and cancelled appearances.
> 2. `components/OrderCard.jsx` — per docs/UI-SPEC.md, with the coloured left status bar
>    from the original design.
> 3. `pages/CreateOrder.jsx` — the full form, pre-filled from the student's profile
>    (`defaultBlockId`, `roomNumber`, `phone`). Gates from `GET /campuses/:id/gates`,
>    vendors from MetaContext, blocks grouped by hostel. `expectedArrival` is a
>    `datetime-local` input converted to an ISO string on submit; default it to 30 minutes
>    from now. On success show the success screen with the big copyable order code.
> 4. `pages/MyOrders.jsx` — filter chips, search, `OrderCard` list, pagination, and the
>    four required states. Student quick actions on each card: "Parcel reached the gate"
>    and "Cancel" (through `ConfirmDialog`, with an optional reason).
> 5. `pages/OrderDetail.jsx` — `RelayTrack`, full details, tracking history with relative
>    times, and role-aware action buttons derived from `order.nextStatuses`. Poll every
>    10s while non-terminal; stop when terminal or when `document.visibilityState` is
>    `hidden`; clean up the interval on unmount.
>
> Buttons disable while their request is in flight. A 409 shows the API's message as a
> toast and then refetches the order, so the UI never argues with the server.
>
> Do not hardcode any status label, vendor or block letter.

**Acceptance checks:**
- Create an order end to end. It appears in `/orders` and in pgAdmin
  (`SELECT * FROM orders ORDER BY id DESC LIMIT 1;`).
- The success screen shows a code like `CR001011-A3F2`; the code is selectable/copyable.
- Set expected arrival to next year → the form shows "Please pick a time within the next
  48 hours." and nothing is created.
- Boys Block A and Girls Block A are separately selectable and the correct one is stored.
- "Parcel reached the gate" moves the order to `WAITING_AT_MAIN_GATE`; the relay track
  advances one step.
- Cancel an order → status `CANCELLED`, track dims, reason shown.
- Open the same order in two browser tabs; advance it in one; the other catches up within
  10 seconds without a reload.
- Switch to another tab for a minute and come back — the network tab shows polling paused
  while hidden.
- Log in as the other student and try `/orders/<the first student's order id>` → a
  not-found message, not the order.
- Create an order whose description is `<img src=x onerror=alert(1)>` → the text renders
  literally on screen and no alert fires.
- The relay track is readable and vertical at 375px.

**Commit:** `feat(client): student order creation, history, tracking and cancellation`

---

## Phase 5 — Public tracking

**Goal:** the original "Track My Order" link, working against the real API.

> **Prompt:**
>
> Build `pages/TrackOrder.jsx` per docs/UI-SPEC.md section 5. It calls
> `GET /orders/track/:code`, needs no login, and reuses `RelayTrack`.
>
> Accept a code typed in any case with stray whitespace and normalise it before calling.
> Support the deep link `/track?code=CR001010-7EA0`, which searches automatically on load.
> Show a clear not-found message for an unknown code — never a blank panel or a raw error
> object. State on the page that phone numbers and personal details are hidden here.

**Acceptance checks:**
- A valid code shows status, relay track and history.
- `cr001010-7ea0` (lowercase, with leading spaces) still works.
- `CR999999-ZZZZ` shows "No order found with that code. Check it and try again."
- The response body in devtools contains no phone number and no student name.
- The deep link auto-searches.
- Works while logged out entirely.

**Commit:** `feat(client): public order tracking by code`

---

## Phase 6 — Delivery partner experience

**Goal:** a partner can claim a parcel at the gate and walk it to the student.

> **Prompt:**
>
> Build `pages/PartnerHome.jsx` per docs/UI-SPEC.md section 5, with three tabs:
> Available at gate, Carrying now, Completed.
>
> Available comes from `GET /orders/available` (polled every 10s) and shows an "Accept"
> button plus a note that contact numbers appear after accepting. Carrying now and
> Completed come from `GET /orders` (`?active=true` and `?status=DELIVERED`) — the backend
> already scopes these to the logged-in partner.
>
> Each carried order gets one primary button for its single legal next step, labelled as
> an action: "Mark picked up", "Start delivery", "Reached hostel gate", "Mark delivered".
> Derive it from `order.nextStatuses`, never from a hardcoded chain.
>
> Show remaining capacity as "2 of 3 slots free". When the API returns the 409 about
> carrying 3 deliveries, surface that message and explain the cap rather than failing
> silently. When accepting an order someone else just took, show the API's message and
> remove the card from the list.

**Acceptance checks:**
- Log in as Ravi (`9100000001` / `Partner@123`). The pool lists orders waiting at a gate,
  with no phone numbers visible.
- Accept one → it moves to Carrying now, and the student's phone number is now shown.
- Walk it through all four steps to Delivered. Each step appears in the student's tracking
  history with Ravi as the actor.
- It then shows under Completed and no longer under Carrying now.
- Open two browser profiles as Ravi and Sneha on the same pool order. Accept in both
  quickly. One succeeds; the other sees "Another relay partner just took this delivery."
  and the card disappears. Confirm in pgAdmin:
  `SELECT count(*) FROM delivery_assignments WHERE order_id = <id> AND is_active;` → `1`.
- Accept a 4th order → the cap message appears.
- A partner cannot see or advance an order assigned to someone else.
- Usable one-handed at 375px — this is the screen used while standing at a gate.

**Commit:** `feat(client): delivery partner pool, acceptance and status progression`

---

## Phase 7 — Admin experience

**Goal:** oversight and configuration.

> **Prompt:**
>
> Build the four admin pages per docs/UI-SPEC.md section 5: `AdminOverview`,
> `AdminOrders`, `AdminUsers`, `AdminCampus`.
>
> Overview: `StatCard` grid from `GET /admin/stats` plus the live board from
> `GET /admin/active-deliveries`, both polled every 10s. Table on desktop, cards below
> 720px.
>
> Orders: full table with filters (status, vendor, gender, partner), search and
> pagination, all driven by query parameters — read the supported list in
> docs/API-CONTRACT.md and do not filter client-side. Row action "Assign" opens a modal
> listing partners from `GET /admin/partners` with their active and completed counts, so
> the admin can pick someone who is free. Assign posts to
> `POST /admin/orders/:id/assign`.
>
> Users: role tabs, search, an "Add delivery partner" form, and activate/deactivate behind
> `ConfirmDialog`. Show the API's message when an admin tries to deactivate their own
> account.
>
> Campus: campuses, gates, hostels and blocks, each with a list, an add form and a
> deactivate toggle. Make clear in the copy that deactivating hides an item from new
> orders without affecting existing ones.

**Acceptance checks:**
- Counters match reality: create an order as a student, refresh the overview, `total` and
  `createdToday` each increase by one.
- The live board shows in-motion orders and updates within 10s of a partner acting.
- Assign a waiting order to Sneha → the student sees "Relay partner assigned" and Sneha
  sees it under Carrying now.
- Reassign an order that is already `PICKED_UP` → the partner changes, the status does
  **not** rewind, and the tracking history records the reassignment.
- Filter by status, then vendor, then search a partial order code — the URL query string
  changes and the result count matches.
- Pagination: set the page size low, walk to page 2, confirm no duplicated rows.
- Add a delivery partner, log out, log in as them successfully.
- Deactivate that partner, try to log in → "This account has been deactivated."
- Try to deactivate your own admin account → the API's 400 message is shown.
- Add a new block, then create a student order into it.
- Deactivate a gate → it disappears from the new-order form while old orders still
  display it correctly.

**Commit:** `feat(client): admin dashboard, order assignment, user and campus management`

---

## Phase 8 — Polish pass

**Goal:** make it feel finished. This is the phase that separates a project that looks
built from one that looks shipped.

> **Prompt:**
>
> Audit the whole client against docs/UI-SPEC.md sections 6 and 7 and fix what falls
> short. Do not add features.
>
> 1. Every data-fetching screen handles loading, error, empty and populated. Replace any
>    bare "No data" with a real `EmptyState` including an action.
> 2. Every submit button disables while its request is in flight.
> 3. Walk every page at 375px, 768px and 1280px. Fix overflow, cramped tap targets
>    (minimum 44×44px) and any table that should become cards below 720px.
> 4. Keyboard pass: tab through every page. Visible focus everywhere, modals trap focus
>    and close on Escape, no element reachable but unusable.
> 5. Labels tied to inputs with `htmlFor`; errors linked with `aria-describedby`.
> 6. Check contrast of `--text-dim` on `--surface`; if it is below 4.5:1, darken the
>    surface rather than lightening the text.
> 7. Confirm no status label, vendor or block letter is hardcoded anywhere — grep for
>    string literals like `'Delivered'` and `'Swiggy'` in `src/`.
> 8. Remove every `console.log`. Confirm no token, password or phone number is ever
>    logged.
> 9. Set the page `<title>` per route and add a favicon.
> 10. `npm run build` must finish with zero warnings.
>
> Report a short list of what you changed and anything you deliberately left alone.

**Acceptance checks:**
- Devtools console is clean across every page and role.
- Keyboard-only, you can create an order start to finish.
- Throttle the network to Slow 3G: loading states appear, nothing flashes blank.
- Stop the backend, then click around: every screen shows a real error message with a
  working "Try again", and nothing crashes to a white page.
- `npm run build` then `npm run preview` — the production build works identically.

**Commit:** `polish(client): loading and error states, mobile layout, accessibility`

---

## Phase 9 — README and documentation

> **Prompt:**
>
> Write `README.md` at the project root, for a GitHub visitor who has 60 seconds. Sections:
> project overview; the problem statement (external riders cannot enter hostel areas);
> the relay flow as a diagram; features by role; tech stack; architecture (request path
> from React through Express to PostgreSQL and back); the database schema with the 8
> tables and their relationships; an API overview table; local setup; environment
> variables (names and purpose only, never values); a Screenshots section with placeholder
> image links under `docs/screenshots/`; and future improvements.
>
> State plainly that the service charges nothing and has no payment integration — that is
> a deliberate scope decision, not a missing feature.
>
> Also write `docs/SCREENSHOTS.md` listing exactly which screens to capture and at which
> width, so the README's image slots can be filled in.
>
> Do not overstate. Every claim must match code that actually exists. No badges for tools
> the project does not use, no "enterprise-grade", no invented performance numbers.

**Acceptance checks:**
- Every setup command in the README works on a clean clone.
- No real secret appears anywhere in the repo: `git grep -i "password" -- . ":(exclude)*.md"`
  turns up only variable names and seeded demo values.
- The API table matches `docs/API-CONTRACT.md`.
- `.env` files are absent from `git status` and from GitHub after you push.

**Commit:** `docs: project README and screenshot guide`

---

## Phase 10 — Deployment

**Goal:** a public URL you can put on a résumé.

Hosting: **Neon** for PostgreSQL, **Render** for the Express API, **Vercel** for the React
frontend. All three have free tiers and none needs a card.

> **Prompt:**
>
> Write `docs/DEPLOYMENT.md` as a numbered walkthrough for someone who has never deployed
> anything. Assume Windows and pgAdmin. Cover, in order:
>
> 1. Push to GitHub: `git init` through `git push -u origin main`, including creating the
>    repo and confirming `.env` was not committed.
> 2. Neon: create a project, get the connection string, run `db/schema.sql` and
>    `db/seed.sql` against it (both via the Neon SQL editor and via `psql`), and verify
>    the tables exist.
> 3. Render: new Web Service from the repo, root directory `server`, build command
>    `npm install`, start command `npm start`, and every environment variable it needs —
>    `DATABASE_URL` (the Neon string), `JWT_SECRET`, `NODE_ENV=production`,
>    `CORS_ORIGIN`. Explain that `DATABASE_URL` takes priority over the `PG*` variables
>    and that TLS is required for Neon.
> 4. Vercel: import the repo, root directory `client`, framework Vite, build command
>    `npm run build`, output `dist`, and `VITE_API_URL` pointing at the Render URL plus
>    `/api`.
> 5. Close the CORS loop: set `CORS_ORIGIN` on Render to the Vercel domain and redeploy.
>    Explain what the browser error looks like when this is wrong and how to read it.
> 6. Verification: hit `/api/health` on Render, log in on the Vercel site, create an
>    order, confirm the row exists in Neon.
> 7. A troubleshooting table: CORS error, 503 from the API, "relation does not exist",
>    401 immediately after login, Render cold-start delay on the free tier, blank page
>    after deploy (usually a missing `VITE_API_URL` at build time).
>
> Note that Vite inlines `VITE_*` variables at build time, so changing one requires a
> redeploy, not just a restart.

**Acceptance checks:**
- `https://<your-app>.vercel.app` loads.
- `https://<your-api>.onrender.com/api/health` returns success.
- You can register a new student on the live site and see the row in Neon.
- The full relay works live: student creates, partner accepts and delivers, admin sees it.
- Public tracking works from a phone on mobile data, logged out.

**Commit:** `docs: deployment guide for Neon, Render and Vercel`

---

## Phase 11 — Interview preparation

> **Prompt:**
>
> Write `docs/INTERVIEW.md` based strictly on what this repository actually contains.
> Read the real code first — especially `server/src/utils/orderState.js`,
> `server/src/services/order.service.js`, `server/src/middleware/auth.js` and
> `db/schema.sql`.
>
> Include:
>
> 1. Explanations at three lengths: 30 seconds, 1 minute, 3 minutes. The 3-minute version
>    should walk the relay flow and name the two or three decisions worth defending.
> 2. A request walkthrough for one concrete action ("partner marks an order delivered"),
>    from the React click through axios, Express routing, middleware, validator,
>    controller, service, the state machine, the SQL transaction, and back to the UI.
> 3. Two or three résumé bullets. Only features that exist. Include real numbers pulled
>    from the code — table count, endpoint count, distinct order states, role count. No
>    invented user counts or latency figures.
> 4. Questions and answers grouped by topic: React, Node, Express, PostgreSQL, SQL, REST,
>    JWT, authentication vs authorisation, DBMS, OOP, OS, computer networks, system design,
>    security. Answers should be short and in plain language, and where possible point at
>    a specific file in this project.
> 5. A "decisions and trade-offs" section covering, honestly: raw SQL instead of an ORM;
>    polling instead of WebSockets; JWT in `localStorage` and its XSS exposure; a partial
>    unique index for the accept race; 404 instead of 403 for other people's records; no
>    payments at all; enforcing the state machine in the service layer rather than in
>    database triggers.
> 6. A "what I would do next" list — the honest version of future work, including the
>    known limitations.
>
> Do not inflate anything. An interviewer who opens the repo must find exactly what this
> document claims.

**Acceptance checks:**
- You can deliver the 1-minute version from memory without notes.
- Every résumé bullet maps to code you can point at.
- Pick five Q&A entries at random and find the answer in the codebase.
- Nothing in the document describes a feature that does not exist.

**Commit:** `docs: interview preparation and design decision notes`

---

## If something goes wrong

When you hit an error, give Claude Code all four of these:

1. The exact error text, complete, from the terminal or browser console.
2. Which command you ran and which folder you ran it in.
3. What you expected instead.
4. The file you believe is involved, if you know.

Ask it to explain the cause before changing anything. A fix you do not understand is a
fix you cannot defend in an interview — and this project's whole purpose is being able to
defend it.
