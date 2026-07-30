# Screenshots

Exactly the screens the `README.md` image slots expect, in order, with the width to
capture at and what state to put the app in first. Save each file under
`docs/screenshots/` with the exact filename below — the README already links to these
paths, so no other edits are needed once they exist.

Browser dev tools → responsive mode → set the exact width → full-page screenshot (not
just the visible viewport) for each one, unless noted otherwise.

| # | Filename | Screen | Width | Setup |
|---|---|---|---|---|
| 1 | `landing.png` | `/` — Landing page | 1280px | Logged out. Capture the hero and the relay-flow section together. |
| 2 | `create-order.png` | `/orders/new` — Create a delivery request | 1280px | Logged in as a student (`9200000001` / `Student@123`). Fill in a couple of fields first so the form doesn't look empty. |
| 3 | `order-detail.png` | `/orders/:id` — Order detail | 1280px | Logged in as the same student, viewing an order that is partway through the relay (e.g. `ASSIGNED` or `OUT_FOR_DELIVERY`) so the relay track shows a mix of completed, current and future steps. |
| 4 | `partner-available.png` | `/partner` — Partner home, "Available at gate" tab | 1280px | Logged in as a partner (`9100000001` / `Partner@123`) with at least one parcel waiting in the pool. |
| 5 | `admin-overview.png` | `/admin` — Admin overview | 1280px | Logged in as admin (`9000000001` / `Admin@123`). Make sure the live board has at least one in-motion order so it isn't showing the empty state. |
| 6 | `relay-track-mobile.png` | `/orders/:id` — Order detail, relay track only | 375px | Same order as #3, at mobile width. Crop to just the relay track card so the vertical layout and per-step timestamps are visible. |

## Optional extras

Not linked from the README yet, but useful if you want a fuller set later — same
naming pattern (`docs/screenshots/<name>.png`):

| Filename | Screen | Width |
|---|---|---|
| `login.png` | `/login`, showing the demo-account chips | 768px |
| `track-order.png` | `/track`, public tracking result | 768px |
| `admin-orders.png` | `/admin/orders`, filtered table with the assign modal open | 1280px |
| `navbar-mobile.png` | Any page, navbar hamburger menu open | 375px |

## Notes

- Use the seeded demo accounts from the README — don't invent data, and don't put a
  real phone number or password in a screenshot.
- Dark navy theme only; there's no light mode to worry about matching.
- If a screen is mid-request (a toast visible, a button showing its loading spinner),
  that's fine and often more informative than a static idle state — just don't capture
  a half-loaded skeleton by accident.
