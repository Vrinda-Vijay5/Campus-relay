# UI Spec

The original HTML/CSS version had a coherent dark navy identity. **Keep it.** The job is
to make it more disciplined and responsive, not to redesign it. Anything that looks like
a default template (white cards on grey, Bootstrap blue, cream + serif) is wrong here.

---

## 1. Design tokens

Put these in `client/src/styles/theme.css` as CSS custom properties on `:root` and
reference them everywhere. No raw hex values in component CSS.

| Token | Value | Taken from | Used for |
|---|---|---|---|
| `--bg` | `#0f1a2a` | original `body` | page background |
| `--surface` | `#152238` | original `.form-card` | cards, navbar, modals |
| `--surface-2` | `#1b2b44` | original inputs | inputs, table stripes, chips |
| `--border` | `#2a3b55` | original `.step` | dividers, table borders |
| `--border-strong` | `#3c4f6c` | original input border | input borders, focus rings |
| `--text` | `#e6ecf5` | original | body text |
| `--text-dim` | `#93a3bd` | new | labels, captions, meta |
| `--accent` | `#4d8eff` | original `.submit-btn` | primary buttons, links, active nav |
| `--accent-soft` | `#7aaaff` | original gradient start | hover, icons |
| `--violet` | `#b492ff` | original gradient end | gradient headings only |
| `--warn` | `#ffd86b` | original `.active-step` | in-progress states |
| `--ok` | `#a8f0b7` | original `.delivered` | delivered, success |
| `--danger` | `#ff7b7b` | new | cancelled, destructive, errors |

Other tokens: `--radius-card: 18px`, `--radius-control: 10px`,
`--shadow-card: 0 12px 26px rgba(0,0,0,0.45)`, `--maxw: 1100px`.
Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48px. Use nothing in between.

**Typography.** Inter, as in the original (`@import` from Google Fonts, with a
`system-ui` fallback so the app still renders offline). Scale: 34 / 26 / 20 / 16 / 14 /
12px. Page titles at 26px, weight 700. Keep the gradient text
(`linear-gradient(90deg, var(--accent-soft), var(--violet))` with
`-webkit-background-clip: text`) for the "Campus Relay" wordmark **only** — it was
overused on the original pages.

Preserve the original `fadeUp` entry animation (`opacity 0 → 1`, `translateY(10px) → 0`,
`0.4s ease-out`) on cards and page content. Wrap all motion in
`@media (prefers-reduced-motion: reduce)` and disable it there.

---

## 2. The signature element: the relay track

This is the one thing the project should be remembered by, and it is the core idea made
visible. Build it as `components/RelayTrack.jsx`.

The original had three grey dots and a flat line. Replace it with a track that shows the
**two legs of the relay** and where the parcel physically is:

```
  ●━━━━━━━●━━━━━━━◉╌╌╌╌╌╌╌○╌╌╌╌╌╌╌○╌╌╌╌╌╌╌○
  │       │       │        │       │       │
Created  At     Partner  Picked   Out for Hostel  Delivered
        gate    assigned   up    delivery  gate
  └─── external rider ───┘└──── relay partner ────┘
```

Requirements:
- Driven by `relaySequence` from `GET /meta` and the order's `status`. Nothing hardcoded.
- Completed steps: filled `--accent`, solid connector. Current step: larger ring in
  `--warn` with a slow pulse. Future steps: hollow `--border`, dashed connector.
- Delivered: whole track turns `--ok`. Cancelled: track dims to 40% opacity, a
  `--danger` chip reads "Cancelled", and the reason is shown if present.
- Two labelled segments under the track: "External rider" (up to the gate) and
  "Relay partner" (gate to hostel). This is the detail that makes the project's idea
  legible in three seconds — do not cut it.
- Horizontal on desktop, **vertical on mobile** (below 640px) with timestamps beside each
  step. A cramped horizontal track at 375px is the main thing to avoid.
- Accessible: the whole track carries `role="list"`, each step `role="listitem"` with an
  `aria-label` like "Picked up from gate, completed 11:34".

---

## 3. Reusable components

Build these first; the pages assemble them.

| Component | Notes |
|---|---|
| `Navbar` | Wordmark left; role-aware links; name + role chip and "Log out" right. Hamburger below 720px. |
| `ProtectedRoute` | Wraps routes; redirects to `/login` preserving intended path; optional `roles` prop. |
| `StatusBadge` | Pill; colour from status group (waiting `--warn`, in-motion `--accent`, delivered `--ok`, cancelled `--danger`). Label from `/meta`. |
| `RelayTrack` | The signature element above. |
| `OrderCard` | Left status bar (as in the original `.order-card`), code, vendor, destination, expected time, actions. |
| `Field` | Label + input/select/textarea + inline error + hint. Every form uses it — do not hand-roll inputs. |
| `Button` | Variants `primary`, `ghost`, `danger`; `loading` prop disables and shows a spinner. |
| `Spinner` | Inline and full-block sizes. |
| `EmptyState` | Icon, one line of explanation, one action. Never a bare "No data". |
| `ErrorState` | Message plus a "Try again" button that re-runs the fetch. |
| `Toast` | Via `ToastContext`; success/error/info; auto-dismiss 4s; stacked bottom-right, bottom-centre on mobile. |
| `Modal` | Focus-trapped, closes on Escape and backdrop click. Used for assign and confirm dialogs. |
| `StatCard` | Big number, small label. Reuse the original PIN-pad tile styling here — that's where the retired keypad's look goes. |
| `Pagination` | Prev/next plus "Page 2 of 5". Hidden when `pages === 1`. |
| `ConfirmDialog` | For cancel and deactivate. Never destroy anything on a single click. |

---

## 4. Routes

| Path | Access | Page |
|---|---|---|
| `/` | public | `Landing` |
| `/login` | public | `Login` |
| `/register` | public | `Register` |
| `/track` | public | `TrackOrder` |
| `/orders/new` | student | `CreateOrder` |
| `/orders` | student, partner, admin | `MyOrders` (role-aware heading and filters) |
| `/orders/:id` | student, partner, admin | `OrderDetail` (role-aware actions) |
| `/partner` | partner | `PartnerHome` |
| `/admin` | admin | `AdminOverview` |
| `/admin/orders` | admin | `AdminOrders` |
| `/admin/users` | admin | `AdminUsers` |
| `/admin/campus` | admin | `AdminCampus` |
| `*` | public | `NotFound` |

After login, redirect by role: student → `/orders`, partner → `/partner`, admin → `/admin`.

---

## 5. Page notes

**Landing.** Hero states the problem in one sentence, then the relay diagram as the visual
thesis (reuse `RelayTrack` in a static illustrative mode). Keep the two role cards from
`home.html` (`assets/student.png`, `assets/delivery.png`) as the entry points, plus a
"Track an order" link. No invented statistics, no fake testimonials.

**Login.** Phone + password. Include a small "Demo accounts" block with tappable chips
that fill the form (admin / partner / student) — invaluable when demoing to an
interviewer. Label it clearly as seeded demo data.

**Register.** Name, phone, password, campus, then a grouped hostel/block `<select>` built
from `/campuses/:id/hostels` with an `<optgroup>` per hostel, and room number. The grouped
select is the visible fix for the original's duplicate-`value="A"` bug.

**CreateOrder.** Pre-fill block and room from the logged-in student's profile. Fields:
pickup gate, delivery app, what the order is, contact phone (pre-filled), expected arrival
(`datetime-local`), hostel/block, room, notes. On success show the original's success
screen — big order code, "Track my order" and "Back to my orders". Show the code in a
copyable monospace pill.

**MyOrders.** Filter chips (`All` / `Active` / `Delivered` / `Cancelled`), search box,
list of `OrderCard`, pagination. Student cards carry the two quick actions:
"Parcel reached the gate" (`CREATED → WAITING_AT_MAIN_GATE`) and "Cancel".

**OrderDetail.** `RelayTrack` at the top, then details, then tracking history as a
timeline with relative times ("4 minutes ago") and absolute on hover. Action buttons
derive from `order.nextStatuses` ∩ what the role may do. Poll every 10s while the order is
non-terminal; stop polling on terminal status or when the tab is hidden
(`document.visibilityState`). Show a quiet "Updated just now" line, not a spinner, on
background refreshes.

**TrackOrder.** Order-code input (accepts lowercase, trims whitespace), then
`RelayTrack` and limited details. State plainly that phone numbers are hidden on the
public page. Deep link `/track?code=CR001010-7EA0` should auto-search.

**PartnerHome.** Three tabs: **Available at gate** (the pool, with "Accept" and a note
that phones appear after accepting), **Carrying now** (with the next-step button, e.g.
"Mark picked up"), **Completed**. Show `3 − activeCount` remaining capacity, and explain
the cap when the API returns that 409. Poll the pool every 10s.

**AdminOverview.** `StatCard` grid from `/admin/stats` (total, active, waiting at gate,
delivered today, students, active partners), then the live board from
`/admin/active-deliveries` as a table on desktop and cards on mobile. Poll every 10s.

**AdminOrders.** Full table: code, student, vendor, destination, status, partner,
created. Filters for status/vendor/gender/partner, search, pagination. Row action
"Assign" opens a modal listing partners from `/admin/partners` with their current load, so
the admin can see who is free.

**AdminUsers.** Role tabs, search, "Add delivery partner" form (name, phone, password,
campus), activate/deactivate with a confirm dialog. Show why self-deactivation fails.

**AdminCampus.** Campuses, gates, hostels, blocks — list plus add form for each, and
deactivate toggles. Make clear that deactivating hides a block from new orders without
touching old ones.

---

## 6. Required states

Every screen that fetches data must handle four states, and none may be skipped:

1. **Loading** — skeleton or spinner, never a blank screen.
2. **Error** — the API's `message`, plus a "Try again" button.
3. **Empty** — a sentence explaining what would appear here and an action.
   Student with no orders: "No delivery requests yet. Create one when your parcel is on
   its way to the gate."
4. **Populated.**

Buttons that trigger a request must disable while in flight, so a double tap cannot
create two orders.

---

## 7. Responsiveness and accessibility floor

- Test at **375px**, 768px and 1280px. 375px is the real target — students will use
  phones at the hostel gate.
- Tap targets at least 44×44px. Tables become stacked cards below 720px.
- Visible focus ring on every interactive element (`outline: 2px solid var(--accent-soft)`).
- Labels tied to inputs with `htmlFor`. Errors linked via `aria-describedby`.
- Colour is never the only signal: pair every status colour with its text label.
- Body text contrast at least 4.5:1 against its background — check `--text-dim` on
  `--surface` and darken the background rather than lightening the text if it fails.
