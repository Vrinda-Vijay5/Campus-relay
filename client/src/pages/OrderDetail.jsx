import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../api/client';
import RelayTrack from '../components/RelayTrack';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import Field from '../components/Field';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatDateTime, formatRelativeTime } from '../utils/format';
import { getStatusActions, canCancel } from '../utils/orderActions';
import { usePageTitle } from '../hooks/usePageTitle';

const POLL_MS = 10000;
const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  usePageTitle(order ? `Order ${order.orderCode}` : 'Order');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = useCallback(
    ({ quiet = false } = {}) => {
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      return api
        .getOrder(id)
        .then((data) => {
          setOrder(data.order);
          setLastUpdated(new Date());
        })
        .catch((err) => {
          if (!quiet) setError(err.message);
        })
        .finally(() => {
          if (!quiet) setLoading(false);
        });
    },
    [id]
  );

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const orderStatus = order?.status;

  // Poll every 10s while the order is still moving, and pause the moment
  // the tab is hidden — a background tab has no reason to hit the API.
  useEffect(() => {
    if (!orderStatus || TERMINAL_STATUSES.includes(orderStatus)) return undefined;

    let intervalId = null;
    const start = () => {
      if (!intervalId) intervalId = setInterval(() => fetchOrder({ quiet: true }), POLL_MS);
    };
    const stop = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [orderStatus, fetchOrder]);

  const handleStatusAction = async (status) => {
    setBusyAction(status);
    try {
      const data = await api.updateOrderStatus(order.id, { status });
      setOrder(data.order);
      setLastUpdated(new Date());
      showToast('Order updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      fetchOrder();
    } finally {
      setBusyAction(null);
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      const data = await api.cancelOrder(order.id, cancelReason ? { reason: cancelReason } : {});
      setOrder(data.order);
      setLastUpdated(new Date());
      showToast('Order cancelled.', 'success');
      setCancelOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
      fetchOrder();
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <Spinner size="block" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page">
        <div className="container">
          <ErrorState message={error || 'That order does not exist.'} onRetry={fetchOrder} />
          <p style={{ textAlign: 'center' }}>
            <Link to="/orders">Back to my orders</Link>
          </p>
        </div>
      </div>
    );
  }

  const statusActions = getStatusActions(order, user);
  const showCancel = canCancel(order, user);

  return (
    <div className="page">
      <div className="container stack">
        <div className="row-between">
          <div>
            <h1 className="page-title" style={{ marginBottom: 'var(--space-1)' }}>
              {order.orderCode}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          {lastUpdated && (
            <span className="text-caption">Updated {formatRelativeTime(lastUpdated.toISOString())}</span>
          )}
        </div>

        <div className="card fade-up">
          <RelayTrack status={order.status} tracking={order.tracking} cancelReason={order.cancelReason} />
        </div>

        {(statusActions.length > 0 || showCancel) && (
          <div className="card row">
            {statusActions.map((action) => (
              <Button
                key={action.status}
                variant="primary"
                loading={busyAction === action.status}
                disabled={busyAction !== null && busyAction !== action.status}
                onClick={() => handleStatusAction(action.status)}
              >
                {action.label}
              </Button>
            ))}
            {showCancel && (
              <Button
                variant="danger"
                disabled={busyAction !== null}
                onClick={() => setCancelOpen(true)}
              >
                Cancel order
              </Button>
            )}
          </div>
        )}

        <div className="card stack fade-up">
          <h2>Details</h2>
          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <DetailRow label="Vendor" value={order.vendor} />
            <DetailRow label="Item" value={order.itemDescription} />
            <DetailRow label="Destination" value={order.destination?.label} />
            <DetailRow label="Pickup gate" value={order.gate?.name} />
            <DetailRow label="Room number" value={order.roomNumber} />
            <DetailRow label="Expected arrival" value={formatDateTime(order.expectedArrival)} />
            <DetailRow label="Requested" value={formatDateTime(order.createdAt)} />
            {order.deliveredAt && (
              <DetailRow label="Delivered" value={formatDateTime(order.deliveredAt)} />
            )}
            {order.notes && <DetailRow label="Notes" value={order.notes} />}
            {order.contactPhone && <DetailRow label="Contact phone" value={order.contactPhone} />}
            {order.student?.name && (
              <DetailRow
                label="Student"
                value={
                  order.student.phone ? `${order.student.name} (${order.student.phone})` : order.student.name
                }
              />
            )}
            {order.partner?.name && (
              <DetailRow
                label="Relay partner"
                value={
                  order.partner.phone ? `${order.partner.name} (${order.partner.phone})` : order.partner.name
                }
              />
            )}
          </div>
        </div>

        <div className="card fade-up">
          <h2 style={{ marginBottom: 'var(--space-3)' }}>Tracking history</h2>
          <ol className="stack" style={{ gap: 'var(--space-3)' }}>
            {order.tracking?.map((event, index) => (
              <li key={`${event.status}-${event.at}-${index}`} className="row-between">
                <div>
                  <div>{event.note}</div>
                  <div className="text-caption">
                    {event.by ? `${event.by.name} (${event.by.role})` : 'System'}
                  </div>
                </div>
                <time
                  className="text-caption"
                  dateTime={event.at}
                  title={formatDateTime(event.at)}
                >
                  {formatRelativeTime(event.at)}
                </time>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        confirmLabel="Cancel order"
        danger
        loading={cancelling}
        onConfirm={confirmCancel}
        onClose={() => setCancelOpen(false)}
      >
        <p className="text-dim">This cannot be undone.</p>
        <Field
          id="detail-cancel-reason"
          label="Reason (optional)"
          as="textarea"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          hint="Up to 200 characters"
        />
      </ConfirmDialog>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="row-between">
      <span className="text-dim">{label}</span>
      <span>{value}</span>
    </div>
  );
}
