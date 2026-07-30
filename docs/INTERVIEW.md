# Interview Preparation

Everything below is checked against the code as it actually exists in this repository —
not against the plan, not against memory. File paths are given so you (or an
interviewer) can open the exact line being discussed.

---

## 1. Explain the project

### 30 seconds

Campus Relay solves a real problem on large college campuses: external delivery riders
(Swiggy, Zomato, etc.) aren't allowed into hostel areas for security reasons. It adds a
second, campus-only delivery leg — a student requests a relay, and a Campus Relay
partner carries the parcel from the main gate to the hostel gate. It's a full-stack app:
React frontend, Express API, PostgreSQL database, three user roles, no payments.

### 1 minute

Same as above, plus: there are three roles — students raise requests and track them,
delivery partners (created by an admin, not self-registered) pick parcels up from a pool
at their campus gate and carry them, and admins oversee everything and manage the campus
configuration (gates, hostels, blocks). Every order moves through a fixed 8-state
lifecycle — created, waiting at gate, assigned, picked up, out for delivery, reached
hostel gate, delivered, or cancelled — and the backend, not the frontend, is the only
thing that decides which transitions are legal. It's free to use; there's no payment
integration anywhere in the schema or API.

### 3 minutes

Walk the flow: a student creates a request specifying their campus gate, vendor, and
hostel block — that order starts at `CREATED`. Once the external rider actually drops
the parcel at the gate, the student (or an admin) marks it `WAITING_AT_MAIN_GATE`. A
partner on that campus sees it in a pool (`GET /orders/available`) and accepts it, which
atomically creates a `delivery_assignments` row and moves the order to `ASSIGNED`. The
partner then walks it through `PICKED_UP` → `OUT_FOR_DELIVERY` → `REACHED_HOSTEL_GATE` →
`DELIVERED`. `CANCELLED` is reachable from any non-terminal state, with different rules
for who can trigger it and when.

Three decisions worth defending if asked:

1. **The state machine lives in `server/src/utils/orderState.js`, in one place, and every
   write path goes through `assertTransition()`.** The frontend never encodes "what comes
   next" — it reads `order.nextStatuses` from the API and only renders buttons for
   transitions the server has already said are legal, cross-referenced against who's
   allowed to do what.
2. **The accept-race (two partners tapping "Accept" on the same order at once) is closed
   at the database level**, not just in application code: a partial unique index
   (`one_active_assignment_per_order` in `db/schema.sql`) makes a second active
   assignment physically impossible to insert, backed by a `SELECT ... FOR UPDATE` row
   lock in the same transaction.
3. **A 404, not a 403, is returned for another student's order.** A 403 would confirm the
   order exists; returning identical 404s for "doesn't exist" and "exists but isn't
   yours" avoids leaking which order IDs are real on a system where IDs are sequential.

---

## 2. Request walkthrough: "partner marks an order delivered"

Concrete path for one click, top to bottom:

1. **React** — the partner is on `OrderDetail` (`client/src/pages/OrderDetail.jsx`) and
   clicks the one button `getStatusActions()` produced for this order (label "Mark
   delivered" — `client/src/utils/orderActions.js`). `handleStatusAction('DELIVERED')`
   runs, sets a `busyAction` state so the button shows a spinner and everything else
   disables.
2. **Axios** — calls `api.updateOrderStatus(order.id, { status: 'DELIVERED' })`
   (`client/src/api/client.js`), which is `client.patch('/orders/:id/status', payload)`.
   A request interceptor on the shared axios instance attaches
   `Authorization: Bearer <token>` from `localStorage`.
3. **Express routing** — `server/src/routes/order.routes.js` matches
   `PATCH /:id/status`. Everything below `router.use(requireAuth)` in that file requires
   a token, so `requireAuth` (`server/src/middleware/auth.js`) runs first: verifies the
   JWT signature, then re-reads the user fresh from `users` by id (not from the token
   payload) and checks `is_active`, attaching the result as `req.user`.
4. **Validator** — `rules.updateStatusRules` (`server/src/validators/order.validators.js`)
   checks the `:id` param is a positive integer and `status` is one of the 8 known
   values. `validate` middleware (`server/src/middleware/validate.js`) turns any
   `express-validator` failures into one `400` with a `details` object; here there are
   none, so it calls `next()`.
5. **Controller** — `updateStatus` in `server/src/controllers/order.controller.js` is a
   thin wrapper: pulls `req.params.id`, `req.body.status`, `req.body.note`, `req.user`,
   calls the service, and later responds `res.json({ success: true, order })`. It
   contains no business logic itself.
6. **Service** — `updateStatus` in `server/src/services/order.service.js` runs inside
   `db.withTransaction`:
   - `lockOrder()` does `SELECT ... FOR UPDATE` on the order row, so no concurrent write
     can interleave.
   - Ownership check: for a partner, `order.partner_id !== user.id` throws a `403`
     ("You are not the relay partner for this order.") — this is the authorisation step,
     separate from the authentication `requireAuth` already did.
   - `guardTransition(order.status, 'DELIVERED', 'partner')` calls into the state
     machine (next step).
   - On success: `UPDATE orders SET status = 'DELIVERED', delivered_at = now()`, **and**
     `UPDATE delivery_assignments SET is_active = FALSE, released_at = now()` in the same
     transaction — the assignment is released in the same atomic step the order is
     closed, so the partner's active-delivery count drops immediately.
   - A row is inserted into `tracking_events` recording who did it and when.
   - The full order is re-selected and mapped back to JSON.
7. **State machine** — `assertTransition('REACHED_HOSTEL_GATE', 'DELIVERED', 'partner')`
   in `server/src/utils/orderState.js` checks: is `DELIVERED` a known status; is the
   order already terminal (no); is `REACHED_HOSTEL_GATE → DELIVERED` a listed transition
   (yes); is `partner` in `ROLES_ALLOWED_TO_SET.DELIVERED` (yes, partner or admin). If any
   check fails it throws a plain object with a `code` and a human message, which the
   service turns into the right HTTP status (`409` for an illegal transition, `403` for a
   role that isn't allowed).
8. **SQL transaction** — `db.withTransaction` (`server/src/config/db.js`) wraps the two
   `UPDATE`s and the `INSERT` in `BEGIN` / `COMMIT`, with `ROLLBACK` on any thrown error —
   so a crash between "close the order" and "release the assignment" can never happen;
   either both happen or neither does.
9. **Back up** — the controller sends `{ success: true, order }`; axios's response
   interceptor passes 2xx responses through untouched; `api.updateOrderStatus(...)`
   resolves with `data.order`.
10. **Back in React** — `OrderDetail` calls `setOrder(data.order)`, which re-renders
    `StatusBadge` and `RelayTrack` (now fully filled, coloured `--ok`), shows a success
    toast, and the "Mark delivered" button is gone on the next render because
    `getStatusActions()` re-evaluates against the new `order.nextStatuses`, which is now
    empty — `DELIVERED` is terminal.

---

## 3. Résumé bullets

Numbers below are pulled directly from the code, not estimated:

- Built a full-stack delivery-relay platform (React 19, Express 4, PostgreSQL 16) with 3
  distinct user roles, an 8-state order lifecycle enforced entirely server-side, and 33
  REST endpoints, deployed on Render, Vercel and Neon.
- Designed a normalised PostgreSQL schema (8 tables, 10 indexes) and used a partial
  unique index to make a delivery-acceptance race condition impossible to represent in
  the data — not just guarded against in application code.
- Implemented JWT authentication that re-validates the user's active status against the
  database on every request (not just the token payload), so deactivating an account or
  changing a role takes effect on the next request instead of waiting for a 7-day token
  to expire.

---

## 4. Questions and answers by topic

### React

**Q: How does the app know if someone is logged in, across a page refresh?**
`AuthContext` (`client/src/context/AuthContext.jsx`) reads a JWT from `localStorage` on
mount and calls `GET /auth/me` to revalidate it before trusting it; if that fails, it
logs out cleanly instead of leaving the UI in a half-authenticated state.

**Q: How is shared state (current user, meta, toasts) passed around without prop
drilling?**
React Context — three providers (`AuthContext`, `MetaContext`, `ToastContext`) wrap the
whole app in `client/src/App.jsx`; any component calls `useAuth()`/`useMeta()`/
`useToast()` directly.

**Q: How does the live-updating order page avoid leaking a timer?**
`OrderDetail.jsx`'s polling `useEffect` returns a cleanup function that clears the
`setInterval`, and a `visibilitychange` listener stops polling while the tab is hidden —
both are torn down on unmount.

### Node.js

**Q: What does Node's single-threaded event loop mean for this app in practice?**
One process handles many concurrent requests by never blocking on I/O — every database
call and every `bcrypt` call in this codebase is `await`ed, not synchronous, so one slow
password hash doesn't stall other users' requests.

### Express

**Q: How is the backend organised?**
A fixed layering, the same in every feature: **route → validator → controller → service
→ db** (e.g. `order.routes.js` → `order.validators.js` → `order.controller.js` →
`order.service.js` → `config/db.js`). Controllers stay thin; business rules live in
services.

**Q: How is error handling centralised?**
`server/src/utils/asyncHandler.js` wraps every async route handler so a rejected promise
calls `next(err)` automatically. One `errorHandler` middleware
(`server/src/middleware/errorHandler.js`) at the end of the chain is the only place that
turns an error into a JSON response — no controller repeats that logic.

### PostgreSQL

**Q: How does the schema prevent two partners accepting the same order?**
`db/schema.sql`'s `one_active_assignment_per_order` — a unique index on
`delivery_assignments(order_id)` filtered `WHERE is_active` — makes a second active
assignment impossible to insert, regardless of application-level bugs.

**Q: Why not just delete an old assignment when an order is reassigned?**
So the history survives. `delivery_assignments` rows are marked `is_active = false`
instead of deleted, which is also why `orders` keeps a `cancel_reason` rather than losing
data on cancellation.

### SQL

**Q: How is SQL injection prevented?**
Every query is parameterised (`$1, $2, ...`) through `pg`'s `query(text, params)` — see
the comment directly above `query()` in `server/src/config/db.js`. User input is never
concatenated into a query string.

**Q: What's the most complex query in the project?**
`ORDER_SELECT` in `order.service.js` — joins `orders` to `users`, `campuses`, `gates`,
`blocks`, `hostels`, and a `LEFT JOIN LATERAL` that picks the current (or most recent
past) `delivery_assignments` row, ordered `is_active DESC, assigned_at DESC LIMIT 1`.
One shared fragment, reused by every function that reads an order, so a field added
there appears everywhere at once.

### REST

**Q: Is this a strictly RESTful API?**
Mostly resource-oriented, with a couple of deliberate exceptions: `POST /orders/:id/
accept` and `POST /orders/:id/cancel` are action endpoints rather than plain `PATCH`es,
because each has its own distinct side effects (creating an assignment row, releasing
one) beyond a simple field update.

**Q: Why `PATCH`, not `PUT`, for `/orders/:id/status`?**
`PATCH` is a partial update — only `status` (and an optional `note`) changes, not the
whole order resource, which is what `PUT` would imply.

### JWT

**Q: What's actually inside the token?**
Just `{ sub: userId, role }`, signed with `JWT_SECRET` (`auth.service.js`'s
`signToken`) — no name, phone, or anything else that could go stale.

**Q: Why re-fetch the user from the database on every authenticated request instead of
trusting the token?**
So a deactivated account or a role change takes effect immediately. The comment in
`server/src/middleware/auth.js` says it directly: a token can stay valid for
`JWT_EXPIRES_IN` (7 days by default), and trusting it blindly would mean a deactivated
partner could keep working for up to 7 days.

### Authentication vs. authorisation

**Q: Where does each happen in this codebase?**
Authentication (proving who you are) is `requireAuth` — it verifies the JWT and loads
the user. Authorisation (proving what you're allowed to do) is `requireRole(...)` at the
route level, plus per-resource ownership checks inside the service functions themselves
— e.g. `order.service.js`'s `updateStatus` checks `order.partner_id !== user.id`, which
`requireRole('partner')` alone could never express, since it doesn't know whose order it
is.

### DBMS

**Q: What's a foreign key actually protecting here?**
Referential integrity — e.g. `orders.student_id REFERENCES users(id) ON DELETE
RESTRICT` means a student row can't be deleted while they still have orders, so an order
can never end up pointing at a student that no longer exists.

**Q: What does a transaction guarantee in this app?**
Atomicity across multiple statements that must succeed or fail together — e.g.
`withTransaction` (`server/src/config/db.js`) wraps "update `orders.status`" and "insert
a `tracking_events` row" so a crash between the two is impossible; the database never
ends up with a status change nobody logged.

### OOP

**Q: This codebase is mostly plain functions — where does it actually use OOP?**
Deliberately, in one place: `server/src/utils/ApiError.js` defines
`class ApiError extends Error` with static factory methods (`badRequest`, `notFound`,
`conflict`, ...). Extending `Error` means it works with Node's normal error handling
(`instanceof Error`, stack traces) while carrying an HTTP status and structured details.
Most business logic elsewhere is plain functions and modules rather than classes,
because the domain doesn't need mutable object identity.

### OS

**Q: What OS-level concept shows up directly in the code?**
Signal handling. `server/src/index.js` listens for `SIGTERM`/`SIGINT` and closes the
HTTP server and the PostgreSQL pool cleanly before exiting — because a host like Render
sends `SIGTERM` to stop a container, and an abrupt kill could leave in-flight requests or
open DB connections dangling.

### Computer networks

**Q: What is CORS, and how is it configured here?**
A browser-enforced restriction on which origins may call an API from client-side JS.
`server/src/app.js`'s `cors()` middleware checks the request's `Origin` header against a
whitelist built from the `CORS_ORIGIN` env var; anything not listed is rejected before
the browser will expose the response to the page's JavaScript.

### System design

**Q: Why polling every 10 seconds instead of WebSockets?**
Cheaper and simpler to host (no persistent connections to manage on a free-tier
platform), degrades gracefully (a missed poll is just slightly stale data, not a broken
connection to recover), and 10 seconds is genuinely fine for a person standing at a
gate. See the trade-offs section below for the honest cost.

**Q: How would this scale to multiple campuses at once?**
The schema already supports it — every relevant table carries a `campus_id`, and
`admin.service.js`'s `listPartnersWithLoad` already accepts an optional `campusId`
filter. What's incomplete: `AdminOrders`/`AdminUsers` on the frontend don't yet let an
admin filter by campus the way `AdminCampus` does.

### Security

**Q: Name a concrete authentication-security decision in this codebase.**
`auth.service.js`'s login returns the identical `401` message — "Incorrect phone number
or password." — whether the phone number doesn't exist or the password is wrong, with
the reasoning given directly in a comment: so the endpoint can't be used to discover
which phone numbers are registered. Auth routes are also rate-limited (20 attempts per
15 minutes, `auth.routes.js`).

**Q: How is XSS prevented on the frontend?**
`dangerouslySetInnerHTML` is never used anywhere in `client/src` — every piece of
user-supplied text (item descriptions, notes, names) goes through normal JSX
interpolation, which React escapes automatically.

---

## 5. Decisions and trade-offs

**Raw SQL instead of an ORM.** Full control over every query — the `ORDER_SELECT`
`LATERAL` join (current-or-most-recent partner) would be awkward to express through most
ORMs' relation-loading APIs — and nothing hidden: every query in a service file is the
actual query that runs. The cost is real, though: no compile-time checking of column
names, and every service hand-writes a `mapOrder`/`publicUser`-style function to turn
snake_case rows into camelCase JSON, which an ORM would generate for free.

**Polling instead of WebSockets.** Simpler to host on a free tier, no persistent
connection state to manage or reconnect, and a missed poll just means data up to 10
seconds stale rather than a broken socket to recover from. The honest cost: it is
strictly less real-time, and at meaningful scale it issues far more HTTP requests than a
push model would for the same freshness.

**JWT kept in `localStorage`.** Simple, and readable synchronously by the axios request
interceptor. The cost is real and known: unlike an `httpOnly` cookie, anything JS can
read, an XSS bug can read too — so a successful script injection could steal a session
token directly. This is mitigated (never using `dangerouslySetInnerHTML`, escaping all
user text) but not eliminated. A cookie + CSRF-token scheme would close this specific gap
at the cost of more moving parts (CSRF token issuance, cookie domain/`SameSite`
configuration).

**A partial unique index for the accept race**, rather than relying on application-level
locking alone. The guarantee this way lives in the data itself — it holds even against a
bug in the application code, a second server instance, or someone querying the database
directly — which a `SELECT`-then-check-then-`INSERT` pattern in JavaScript alone cannot
promise. It's paired with a `SELECT ... FOR UPDATE` row lock in the same transaction so
the common case fails fast with a clear message rather than hitting the constraint.

**404 instead of 403 for someone else's order.** A `403` on its own confirms a resource
exists, which is itself a leak on a system with sequential order IDs — an attacker could
enumerate real order IDs by checking which return `403` versus `404`. Returning identical
`404`s costs a small amount of clarity for an honest user who mistypes their own order's
URL (they can't tell "doesn't exist" from "not yours" from the message alone); that
trade felt worth it for the privacy property.

**No payments anywhere.** Not a missing feature — a scope decision made before writing
any code (see `CLAUDE.md`). There is no `delivery_fee` column, no gateway integration,
and the service is modelled as free. This kept the project small enough for one person to
finish and defend, and avoided an entire category of compliance/security concerns (PCI,
storing financial data) that would otherwise dominate it.

**The state machine lives in the service layer, not database triggers.**
`assertTransition()` (`server/src/utils/orderState.js`) is called before every status
`UPDATE`; the database's own `CHECK` constraint on `orders.status` only guarantees the
value is one of the 8 known strings, not that a given transition from the *current*
status is legal. Keeping the rules in JavaScript makes them easy to read, unit-test in
isolation, and raise rich errors (a friendly message plus an HTTP status) — something a
Postgres trigger raising an exception can't do as naturally. The honest cost: this
guarantee only holds because every write path in this codebase happens to go through the
service layer. A trigger would enforce it even against a rogue direct SQL `UPDATE`; this
design does not defend against that.

---

## 6. What I would do next

Honest list, including real known limitations found while building this:

- **An automated test suite.** The backend was verified thoroughly by hand during
  development (role checks, the accept race, invalid transitions, SQL injection
  attempts); none of that is captured as a repeatable, automated suite. The frontend has
  none either.
- **Real-time updates (WebSockets/SSE)** if the deployment ever grew to a size where 10
  seconds of staleness genuinely mattered — see the trade-offs section for why polling
  was the right starting choice, not a mistake to fix immediately.
- **Rate limit more than just `/auth/*`.** Currently only registration and login are
  rate-limited; nothing stops a logged-in account from hammering other endpoints.
- **`httpOnly` cookie-based sessions instead of a `localStorage` JWT**, to close the
  XSS-token-theft exposure discussed above, if this were heading toward handling
  anything more sensitive than it does today.
- **Multi-campus admin views.** `AdminCampus` already lets an admin pick a campus to
  manage; `AdminOrders` and `AdminUsers` don't yet filter by campus, even though the data
  model already supports more than one.
