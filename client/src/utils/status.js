// Buckets the fixed backend status codes into the four colour groups from
// docs/UI-SPEC.md. These are enum-like status codes from the API contract,
// not display labels — display text always comes from MetaContext.
const STATUS_GROUP = {
  CREATED: 'waiting',
  WAITING_AT_MAIN_GATE: 'waiting',
  ASSIGNED: 'motion',
  PICKED_UP: 'motion',
  OUT_FOR_DELIVERY: 'motion',
  REACHED_HOSTEL_GATE: 'motion',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export function getStatusGroup(status) {
  return STATUS_GROUP[status] || 'waiting';
}
