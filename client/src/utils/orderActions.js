// Which PATCH /orders/:id/status transitions this app exposes as a button,
// and their action-phrased labels. ASSIGNED is deliberately excluded: it is
// only ever reached through POST /orders/:id/accept (partner) or
// POST /admin/orders/:id/assign (admin), never through the generic status
// endpoint — see CLAUDE.md section 5.
export const STATUS_ACTION_LABELS = {
  WAITING_AT_MAIN_GATE: 'Parcel reached the gate',
  PICKED_UP: 'Mark picked up',
  OUT_FOR_DELIVERY: 'Start delivery',
  REACHED_HOSTEL_GATE: 'Reached hostel gate',
  DELIVERED: 'Mark delivered',
};

/**
 * order.nextStatuses lists every transition the state machine allows from
 * the current status, regardless of who is asking. This cross-references it
 * against CLAUDE.md's "who may do what" table so the UI never offers a
 * button the API would reject.
 */
export function getStatusActions(order, user) {
  if (!order || !user) return [];
  const isAssignedPartner = user.role === 'partner' && order.partner?.id === user.id;

  return order.nextStatuses
    .filter((status) => status in STATUS_ACTION_LABELS)
    .filter((status) => {
      if (status === 'WAITING_AT_MAIN_GATE') {
        return user.role === 'student' || user.role === 'admin';
      }
      return isAssignedPartner || user.role === 'admin';
    })
    .map((status) => ({ status, label: STATUS_ACTION_LABELS[status] }));
}

export function canCancel(order, user) {
  if (!order || !user) return false;
  return order.nextStatuses.includes('CANCELLED') && (user.role === 'student' || user.role === 'admin');
}
