# API Contract

Every shape below was captured from the running server, not written from memory.
This file is the source of truth for the frontend. **Do not invent endpoints or rename
fields.** If the frontend needs something that is not here, stop and ask.

- Base URL in development: `http://localhost:5000/api`
- The frontend reads it from `import.meta.env.VITE_API_URL`.
- Auth header on protected routes: `Authorization: Bearer <token>`
- All timestamps are ISO 8601 UTC strings.
- Every response has a `success` boolean.

---

## Error format

Errors are always JSON. Status codes carry meaning — handle them by code, not by
matching message text.

```json
{ "success": false, "message": "Human-readable sentence, safe to show in the UI." }
```

Validation failures (`400`) add a `details` object keyed by field name:

```json
{
  "success": false,
  "message": "Please correct the highlighted fields.",
  "details": {
    "name": "Enter your full name.",
    "phone": "Enter a valid 10-digit Indian mobile number.",
    "password": "Password must be at least 8 characters."
  }
}
```

| Status | Meaning | Frontend behaviour |
|---|---|---|
| `400` | Validation failed | Show `details` inline under each field; `message` as a form-level note |
| `401` | Missing/expired/invalid token | Clear token, redirect to `/login` |
| `403` | Logged in, not allowed | Show `message` as a toast; do not log out |
| `404` | Not found, **or** someone else's record | Show `message`; never say "you lack permission" |
| `409` | Business-rule conflict (invalid transition, already taken) | Show `message` as a toast, then refresh the order |
| `429` | Rate limited (auth routes: 20 per 15 min) | Show `message`, disable submit briefly |
| `503` | Database unreachable | Show "Service unavailable, try again shortly" |

---

## Shared object: `Order`

Returned by every order endpoint. `contactPhone`, `student.phone` and `partner.phone`
are **omitted** when the caller should not see them (a partner browsing the pool sees no
phone numbers until they accept the job).

```json
{
  "id": 10,
  "orderCode": "CR001010-7EA0",
  "status": "WAITING_AT_MAIN_GATE",
  "vendor": "Swiggy",
  "itemDescription": "cap test 3",
  "notes": null,
  "cancelReason": null,
  "expectedArrival": "2026-07-30T12:00:56.729Z",
  "createdAt": "2026-07-30T11:30:56.845Z",
  "updatedAt": "2026-07-30T11:30:56.856Z",
  "deliveredAt": null,
  "roomNumber": null,
  "campus":      { "id": 1, "name": "Main Campus" },
  "gate":        { "id": 1, "name": "Main Gate" },
  "destination": { "blockId": 15, "blockName": "E", "hostelName": "Boys Hostel",
                   "gender": "boys", "label": "Boys Hostel - Block E" },
  "student":     { "id": 4, "name": "Arjun Mehta", "phone": "9200000001" },
  "partner":     null,
  "nextStatuses": ["ASSIGNED", "CANCELLED"],
  "contactPhone": "9200000001"
}
```

When a partner is attached:

```json
"partner": { "id": 2, "name": "Ravi Kumar", "assignedAt": "...", "phone": "9100000001" }
```

**`nextStatuses` is how the frontend decides which action buttons to render.** Never
hardcode the transition table in React — read this array and cross-reference the current
user's role.

## Shared object: `TrackingEvent`

Present as `order.tracking` on single-order responses. Ordered oldest → newest.

```json
{
  "status": "WAITING_AT_MAIN_GATE",
  "note": "External delivery partner reached the main gate",
  "at": "2026-07-30T11:30:56.856Z",
  "by": { "name": "Arjun Mehta", "role": "student" }
}
```

`by` is `null` for events whose actor was deleted.

## Shared object: `Pagination`

```json
{ "page": 1, "limit": 10, "total": 8, "pages": 1 }
```

---

## Public endpoints (no token)

### `GET /health`
```json
{ "success": true, "service": "campus-relay-api", "time": "2026-07-30T11:36:32.209Z" }
```

### `GET /meta`
Fetch once on app start and keep in context. Use these labels everywhere instead of
duplicating them in the frontend.
```json
{
  "success": true,
  "statusLabels": {
    "CREATED": "Request created",
    "WAITING_AT_MAIN_GATE": "Waiting at main gate",
    "ASSIGNED": "Relay partner assigned",
    "PICKED_UP": "Picked up from gate",
    "OUT_FOR_DELIVERY": "Out for delivery",
    "REACHED_HOSTEL_GATE": "Reached hostel gate",
    "DELIVERED": "Delivered",
    "CANCELLED": "Cancelled"
  },
  "relaySequence": ["CREATED","WAITING_AT_MAIN_GATE","ASSIGNED","PICKED_UP",
                    "OUT_FOR_DELIVERY","REACHED_HOSTEL_GATE","DELIVERED"],
  "vendors": ["Swiggy","Zomato","Blinkit","Zepto","Amazon","Flipkart","Other"]
}
```

### `GET /campuses`
```json
{ "success": true, "campuses": [ { "id": 1, "name": "Main Campus", "city": "Vellore" } ] }
```

### `GET /campuses/:campusId/gates`
```json
{ "success": true, "gates": [ { "id": 1, "name": "Main Gate" }, { "id": 2, "name": "Gate 1A" } ] }
```

### `GET /campuses/:campusId/hostels`
Blocks arrive nested and ready for a grouped `<select>` with an `<optgroup>` per hostel.
This is what makes Girls Block A and Boys Block A distinct — they have different ids.
```json
{
  "success": true,
  "hostels": [
    { "id": 1, "name": "Girls Hostel", "gender": "girls",
      "blocks": [ { "id": 1, "name": "A" }, { "id": 2, "name": "B" } ] },
    { "id": 2, "name": "Boys Hostel", "gender": "boys",
      "blocks": [ { "id": 11, "name": "A" }, { "id": 12, "name": "B" } ] }
  ]
}
```

### `POST /auth/register` → `201`
Students only. Partners are created by an admin; admins are seeded.

Request:
```json
{ "name": "Arjun Mehta", "phone": "9200000001", "password": "Student@123",
  "campusId": 1, "defaultBlockId": 13, "roomNumber": "312" }
```
`defaultBlockId` and `roomNumber` are optional. Password: min 8 chars, at least one
letter and one digit. Phone: `^[6-9][0-9]{9}$`.

Response: `{ "success": true, "user": User, "token": "..." }`
Errors: `400` validation, `409` phone already registered.

### `POST /auth/login`
Request: `{ "phone": "9200000001", "password": "Student@123" }`
```json
{
  "success": true,
  "user": { "id": 4, "name": "Arjun Mehta", "phone": "9200000001", "role": "student",
            "campusId": 1, "campusName": "Main Campus", "defaultBlockId": 13,
            "blockLabel": "Boys Hostel - Block C", "roomNumber": "312",
            "isActive": true, "createdAt": "..." },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```
Errors: `401` wrong phone or password (same message either way, deliberately),
`403` account deactivated, `429` too many attempts.

### `GET /orders/track/:code`
Public tracking, matching the original "Track My Order" page. Returns progress only —
no student name, no phone numbers, no notes. Order codes carry a random suffix so they
cannot be guessed by counting.
```json
{
  "success": true,
  "order": {
    "orderCode": "CR001010-7EA0",
    "status": "WAITING_AT_MAIN_GATE",
    "vendor": "Swiggy",
    "expectedArrival": "...", "createdAt": "...", "deliveredAt": null,
    "gate": { "name": "Main Gate" },
    "destination": { "label": "Boys Hostel - Block E" },
    "partner": null,
    "tracking": [ TrackingEvent, ... ]
  }
}
```
Errors: `400` malformed code, `404` no such code.

---

## Authenticated — any role

### `GET /auth/me` → `{ "success": true, "user": User }`

### `PATCH /auth/me`
Request (all optional): `{ "name": "...", "defaultBlockId": 13, "roomNumber": "312" }`
Response: `{ "success": true, "user": User }`

### `POST /auth/change-password`
Request: `{ "currentPassword": "...", "newPassword": "..." }`
Response: `{ "success": true, "message": "Password changed." }`
Errors: `400` current password wrong or new password too weak.

### `GET /orders`
**One endpoint, three behaviours** — the backend scopes by role, the client cannot widen it:
- student → only their own orders
- partner → only orders they have ever been assigned (including completed ones)
- admin → all orders

Query parameters (all optional):

| Param | Values | Notes |
|---|---|---|
| `status` | any status | exact match |
| `vendor` | any vendor from `/meta` | exact match |
| `blockId` | integer | |
| `gender` | `girls` \| `boys` | |
| `partnerId` | integer | **admin only**, ignored for others |
| `active` | `true` | only non-terminal orders |
| `q` | text ≤60 chars | case-insensitive match on order code, item description, student name |
| `page` | ≥1 | default 1 |
| `limit` | 1–50 | default 10 |

Response: `{ "success": true, "orders": [Order], "pagination": Pagination }`

### `GET /orders/:id`
Response: `{ "success": true, "order": Order }` — with `order.tracking` attached.
Returns `404` (not `403`) for someone else's order, so the API never confirms that
another user's order exists.

### `PATCH /orders/:id/status`
The single endpoint for advancing an order. The backend validates the transition and the
caller's role, and writes a `tracking_events` row in the same transaction.

`status` cannot be `ASSIGNED` here — `400` — that value is only ever reached through
`POST /orders/:id/accept` (partner) or `POST /admin/orders/:id/assign` (admin), both of
which also create the matching `delivery_assignments` row. This endpoint rejects it as a
validation error before it ever reaches the state machine.

Request: `{ "status": "PICKED_UP", "note": "optional, max 200 chars" }`
Response: `{ "success": true, "order": Order }`
Errors:
- `400` — `status` is `ASSIGNED`, or not a known status
- `409 INVALID_TRANSITION` — e.g. `An order that is "Request created" cannot move to "Delivered".`
- `409` order already terminal — `This order is already delivered and cannot change.`
- `403` — `You are not the relay partner for this order.`
- `409 CANCEL_WINDOW_CLOSED` — student cancelling after pickup

---

## Student only

### `POST /orders` → `201`
```json
{ "gateId": 1, "blockId": 15, "roomNumber": "312", "vendor": "Zomato",
  "itemDescription": "Chicken biryani, 1 large", "contactPhone": "9200000001",
  "expectedArrival": "2026-07-30T12:00:00.000Z", "notes": "Ring twice" }
```
`roomNumber` and `notes` optional. `expectedArrival` must be between 2 hours ago and 48
hours ahead. The gate and block must both belong to the student's campus, or `400`.

Response: `{ "success": true, "order": Order }` — new orders start at `CREATED`.

### `POST /orders/:id/cancel` (student or admin)
Request: `{ "reason": "optional, max 200 chars" }`
Response: `{ "success": true, "order": Order, "message": "Order cancelled." }`
Errors: `409` if already picked up (student) or already terminal.

---

## Partner only

### `GET /orders/available`
The pool: parcels sitting at a gate on this partner's campus with nobody carrying them.
Sorted by `expectedArrival` ascending. Phone numbers are omitted.
Response: `{ "success": true, "orders": [Order] }`

### `POST /orders/:id/accept`
Claims a parcel. Race-safe: a row lock plus a partial unique index mean only one partner
can ever win.
Response: `{ "success": true, "order": Order, "message": "Delivery accepted." }`
Errors:
- `409` — `Another relay partner just took this delivery.`
- `409` — `You are already carrying 3 deliveries. Finish one first.`
- `403` — order is on a different campus

---

## Admin only

All routes below require role `admin`; anything else gets `403`.

### `GET /admin/stats`
```json
{
  "success": true,
  "stats": {
    "orders": { "total": 10, "active": 8, "delivered": 2, "cancelled": 0,
                "waitingAtGate": 1, "deliveredToday": 2, "createdToday": 10 },
    "users":  { "students": 2, "partners": 4, "activePartners": 3 },
    "byStatus": { "CREATED": 2, "WAITING_AT_MAIN_GATE": 1, "ASSIGNED": 4,
                  "PICKED_UP": 0, "OUT_FOR_DELIVERY": 1, "REACHED_HOSTEL_GATE": 0,
                  "DELIVERED": 2, "CANCELLED": 0 }
  }
}
```

### `GET /admin/active-deliveries`
Live board of everything in motion, newest activity first.
```json
{
  "success": true,
  "deliveries": [
    { "id": 9, "orderCode": "CR001009-105A", "status": "ASSIGNED", "vendor": "Swiggy",
      "expectedArrival": "...", "updatedAt": "...", "studentName": "Arjun Mehta",
      "gateName": "Main Gate", "destination": "Boys Hostel - Block E",
      "partner": { "name": "Sneha Rani", "phone": "9100000002" } }
  ]
}
```

### `GET /admin/users`
Query: `role` (`student`\|`partner`\|`admin`), `q`, `page`, `limit` (max 100).
Response: `{ "success": true, "users": [User], "pagination": Pagination }`

### `GET /admin/partners`
Partners with their current workload — use this to populate the assign dropdown.
```json
{ "success": true,
  "partners": [ { "id": 6, "name": "Test Partner", "phone": "9111100011",
                  "isActive": true, "activeDeliveries": 0, "completedDeliveries": 0 } ] }
```

### `POST /admin/partners` → `201`
Request: `{ "name": "...", "phone": "9111100011", "password": "Test@1234", "campusId": 1 }`
Response: `{ "success": true, "user": User }`. `409` if the phone already exists.

### `PATCH /admin/users/:id/active`
Request: `{ "isActive": false }`
Response: `{ "success": true, "user": User }`
`400` if an admin tries to deactivate their own account.

### `POST /admin/orders/:id/assign`
Assigns or reassigns. Note the path is under `/admin`, not `/orders`.
Request: `{ "partnerId": 3 }`
Response: `{ "success": true, "order": Order, "message": "Delivery partner assigned." }`
Reassigning an order that is already `PICKED_UP` keeps its status — progress is never
rewound. Errors: `400` wrong campus or deactivated partner, `409` already finished or
already assigned to that partner.

### Campus configuration
- `POST /admin/campuses` — `{ "name", "city" }`
- `POST /admin/gates` — `{ "campusId", "name" }`
- `POST /admin/hostels` — `{ "campusId", "name", "gender": "girls"|"boys" }`
- `POST /admin/blocks` — `{ "hostelId", "name" }`
- `PATCH /admin/config/:type/:id/active` — `type` ∈ `campuses|gates|hostels|blocks`,
  body `{ "isActive": false }`

Config rows are deactivated, never deleted (see above), so there needs to be a way to
find one again to flip it back on. The three routes below are the admin-only equivalents
of the public `GET /campuses` / `.../gates` / `.../hostels`, with one difference: they
include deactivated rows, each carrying an `isActive` boolean the public versions omit
(every row in the public versions is implicitly active, since inactive ones are filtered
out). The public routes are unchanged and stay active-only — a deactivated gate must
never appear in the student registration or order forms.

- `GET /admin/campuses` → `{ "success": true, "campuses": [ { "id", "name", "city", "isActive" } ] }`
- `GET /admin/campuses/:campusId/gates` → `{ "success": true, "gates": [ { "id", "name", "isActive" } ] }`
- `GET /admin/campuses/:campusId/hostels` → same shape as the public version, with
  `isActive` added on both the hostel and each nested block.

Config rows are **deactivated, never deleted**, because orders reference them.
Response: `{ "success": true, "record": { "id": 3, "name": "North Gate", "is_active": false } }`
