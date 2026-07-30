/**
 * The single source of truth for how an order may move through the relay.
 *
 * Real-world flow this models:
 *   External delivery partner -> College main gate -> Campus Relay partner
 *   -> Hostel gate -> Student
 *
 * Nothing in the API changes orders.status directly. Every change goes
 * through assertTransition() first, so an invalid jump (say CREATED
 * straight to DELIVERED) is rejected with a 409 no matter which
 * endpoint, client or curl command tried it.
 */

const STATUSES = [
  'CREATED',
  'WAITING_AT_MAIN_GATE',
  'ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'REACHED_HOSTEL_GATE',
  'DELIVERED',
  'CANCELLED',
];

// The happy path, in order. Used by the frontend timeline.
const RELAY_SEQUENCE = [
  'CREATED',
  'WAITING_AT_MAIN_GATE',
  'ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'REACHED_HOSTEL_GATE',
  'DELIVERED',
];

// from -> [allowed next states]
const TRANSITIONS = {
  CREATED: ['WAITING_AT_MAIN_GATE', 'CANCELLED'],
  WAITING_AT_MAIN_GATE: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['REACHED_HOSTEL_GATE', 'CANCELLED'],
  REACHED_HOSTEL_GATE: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [], // terminal
  CANCELLED: [], // terminal
};

// Which roles are allowed to move an order INTO a given state.
const ROLES_ALLOWED_TO_SET = {
  WAITING_AT_MAIN_GATE: ['student', 'admin'], // student confirms the parcel arrived at the gate
  ASSIGNED: ['partner', 'admin'],             // partner accepts, or admin assigns
  PICKED_UP: ['partner', 'admin'],
  OUT_FOR_DELIVERY: ['partner', 'admin'],
  REACHED_HOSTEL_GATE: ['partner', 'admin'],
  DELIVERED: ['partner', 'admin'],
  CANCELLED: ['student', 'admin'],
};

// A student may only cancel while nobody is physically carrying the parcel.
// An admin may cancel at any point before it is delivered.
const STUDENT_CANCELLABLE_FROM = ['CREATED', 'WAITING_AT_MAIN_GATE', 'ASSIGNED'];

const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];
const ACTIVE_STATUSES = STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s));

// Short human labels, shared with the UI through GET /api/meta/statuses.
const STATUS_LABELS = {
  CREATED: 'Request created',
  WAITING_AT_MAIN_GATE: 'Waiting at main gate',
  ASSIGNED: 'Relay partner assigned',
  PICKED_UP: 'Picked up from gate',
  OUT_FOR_DELIVERY: 'Out for delivery',
  REACHED_HOSTEL_GATE: 'Reached hostel gate',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

// Written into tracking_events when the caller does not supply a note.
const DEFAULT_NOTES = {
  CREATED: 'Delivery request created',
  WAITING_AT_MAIN_GATE: 'External delivery partner reached the main gate',
  ASSIGNED: 'A Campus Relay partner took this delivery',
  PICKED_UP: 'Parcel collected from the main gate',
  OUT_FOR_DELIVERY: 'On the way to the hostel',
  REACHED_HOSTEL_GATE: 'Relay partner is waiting at the hostel gate',
  DELIVERED: 'Handed over to the student',
  CANCELLED: 'Order cancelled',
};

function isValidStatus(status) {
  return STATUSES.includes(status);
}

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

function nextStatuses(from) {
  return TRANSITIONS[from] || [];
}

/**
 * Throws a plain object describing the problem when a move is not allowed.
 * The order service converts it into an ApiError, which keeps this file
 * free of Express/HTTP concerns and easy to unit test.
 *
 * @param {string} from  current order status
 * @param {string} to    requested status
 * @param {string} role  'student' | 'partner' | 'admin'
 */
function assertTransition(from, to, role) {
  if (!isValidStatus(to)) {
    throw { code: 'INVALID_STATUS', message: `"${to}" is not a known order status.` };
  }

  if (TERMINAL_STATUSES.includes(from)) {
    throw {
      code: 'ORDER_FINISHED',
      message: `This order is already ${STATUS_LABELS[from].toLowerCase()} and cannot change.`,
    };
  }

  if (!canTransition(from, to)) {
    throw {
      code: 'INVALID_TRANSITION',
      message: `An order that is "${STATUS_LABELS[from]}" cannot move to "${STATUS_LABELS[to]}".`,
      allowed: nextStatuses(from),
    };
  }

  const allowedRoles = ROLES_ALLOWED_TO_SET[to] || [];
  if (!allowedRoles.includes(role)) {
    throw {
      code: 'ROLE_NOT_ALLOWED',
      message: `A ${role} cannot mark an order as "${STATUS_LABELS[to]}".`,
    };
  }

  if (to === 'CANCELLED' && role === 'student' && !STUDENT_CANCELLABLE_FROM.includes(from)) {
    throw {
      code: 'CANCEL_WINDOW_CLOSED',
      message:
        'This order can no longer be cancelled because a relay partner has already picked it up.',
    };
  }

  return true;
}

module.exports = {
  STATUSES,
  RELAY_SEQUENCE,
  TRANSITIONS,
  ROLES_ALLOWED_TO_SET,
  STUDENT_CANCELLABLE_FROM,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  STATUS_LABELS,
  DEFAULT_NOTES,
  isValidStatus,
  canTransition,
  nextStatuses,
  assertTransition,
};
