import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../api/client';
import OrderCard from '../components/OrderCard';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { getStatusActions } from '../utils/orderActions';
import { usePageTitle } from '../hooks/usePageTitle';

// Documented in CLAUDE.md section 7 — there is no endpoint for this, it is
// a fixed business rule the API also enforces (order.service.js).
const MAX_ACTIVE_PER_PARTNER = 3;
const POLL_MS = 10000;

const TABS = [
  { key: 'available', label: 'Available at gate' },
  { key: 'carrying', label: 'Carrying now' },
  { key: 'completed', label: 'Completed' },
];

const emptyList = () => ({ data: [], loading: true, error: null });

export default function PartnerHome() {
  usePageTitle('Partner home');
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState('available');
  const [available, setAvailable] = useState(emptyList);
  const [carrying, setCarrying] = useState(emptyList);
  const [completed, setCompleted] = useState(emptyList);
  const [busyKeys, setBusyKeys] = useState(new Set());

  const fetchAvailable = useCallback((quiet = false) => {
    if (!quiet) setAvailable((s) => ({ ...s, loading: true, error: null }));
    return api
      .listAvailable()
      .then((data) => setAvailable({ data: data.orders, loading: false, error: null }))
      .catch((err) => {
        if (quiet) return;
        setAvailable({ data: [], loading: false, error: err.message });
      });
  }, []);

  const fetchCarrying = useCallback(() => {
    setCarrying((s) => ({ ...s, loading: true, error: null }));
    return api
      .listOrders({ active: 'true', limit: 50 })
      .then((data) => setCarrying({ data: data.orders, loading: false, error: null }))
      .catch((err) => setCarrying({ data: [], loading: false, error: err.message }));
  }, []);

  const fetchCompleted = useCallback(() => {
    setCompleted((s) => ({ ...s, loading: true, error: null }));
    return api
      .listOrders({ status: 'DELIVERED', limit: 50 })
      .then((data) => setCompleted({ data: data.orders, loading: false, error: null }))
      .catch((err) => setCompleted({ data: [], loading: false, error: err.message }));
  }, []);

  useEffect(() => {
    fetchAvailable();
    fetchCarrying();
    fetchCompleted();
  }, [fetchAvailable, fetchCarrying, fetchCompleted]);

  // The pool changes whenever any partner on campus acts, so it polls
  // regardless of which tab is open — pausing only while the tab is hidden.
  useEffect(() => {
    let intervalId = null;
    const start = () => {
      if (!intervalId) intervalId = setInterval(() => fetchAvailable(true), POLL_MS);
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
  }, [fetchAvailable]);

  const withBusy = async (key, task) => {
    setBusyKeys((prev) => new Set(prev).add(key));
    try {
      await task();
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const activeCount = carrying.data.length;
  const remaining = Math.max(MAX_ACTIVE_PER_PARTNER - activeCount, 0);
  const atCapacity = remaining <= 0;

  const handleAccept = (order) => {
    const key = `accept:${order.id}`;
    withBusy(key, () =>
      api
        .acceptOrder(order.id)
        .then(() => {
          showToast('Delivery accepted.', 'success');
          return Promise.all([fetchAvailable(), fetchCarrying()]);
        })
        .catch((err) => {
          showToast(err.message, 'error');
          return fetchAvailable();
        })
    );
  };

  const handleStatusAction = (order, status) => {
    const key = `${order.id}:${status}`;
    withBusy(key, () =>
      api
        .updateOrderStatus(order.id, { status })
        .then(() => {
          showToast('Order updated.', 'success');
          return Promise.all([fetchCarrying(), fetchCompleted()]);
        })
        .catch((err) => {
          showToast(err.message, 'error');
          return fetchCarrying();
        })
    );
  };

  return (
    <div className="page">
      <div className="container stack">
        <div className="row-between">
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Partner home
          </h1>
          <span className="role-chip">
            {remaining} of {MAX_ACTIVE_PER_PARTNER} slots free
          </span>
        </div>

        <div className="row" role="group" aria-label="Partner sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn ${tab === t.key ? 'btn--primary' : 'btn--ghost'}`}
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'available' && (
          <div className="stack">
            <p className="text-dim">
              Contact numbers are hidden until you accept a delivery.
            </p>
            {atCapacity && (
              <div className="card" style={{ borderColor: 'var(--warn)' }}>
                <p style={{ margin: 0 }}>
                  You&apos;re carrying the maximum of {MAX_ACTIVE_PER_PARTNER} deliveries.
                  Finish one before accepting another.
                </p>
              </div>
            )}

            {available.loading && <Spinner size="block" />}
            {!available.loading && available.error && (
              <ErrorState message={available.error} onRetry={fetchAvailable} />
            )}
            {!available.loading && !available.error && available.data.length === 0 && (
              <EmptyState message="No parcels are waiting at the gate right now." />
            )}
            {!available.loading &&
              !available.error &&
              available.data.map((order) => (
                <OrderCard key={order.id} order={order}>
                  <Button
                    variant="primary"
                    loading={busyKeys.has(`accept:${order.id}`)}
                    disabled={atCapacity}
                    onClick={() => handleAccept(order)}
                  >
                    Accept
                  </Button>
                </OrderCard>
              ))}
          </div>
        )}

        {tab === 'carrying' && (
          <div className="stack">
            {carrying.loading && <Spinner size="block" />}
            {!carrying.loading && carrying.error && (
              <ErrorState message={carrying.error} onRetry={fetchCarrying} />
            )}
            {!carrying.loading && !carrying.error && carrying.data.length === 0 && (
              <EmptyState
                message="You aren't carrying any deliveries right now."
                actionLabel="View available parcels"
                onAction={() => setTab('available')}
              />
            )}
            {!carrying.loading &&
              !carrying.error &&
              carrying.data.map((order) => (
                <PartnerOrderRow key={order.id} order={order}>
                  {getStatusActions(order, user).map((action) => (
                    <Button
                      key={action.status}
                      variant="primary"
                      loading={busyKeys.has(`${order.id}:${action.status}`)}
                      onClick={() => handleStatusAction(order, action.status)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </PartnerOrderRow>
              ))}
          </div>
        )}

        {tab === 'completed' && (
          <div className="stack">
            {completed.loading && <Spinner size="block" />}
            {!completed.loading && completed.error && (
              <ErrorState message={completed.error} onRetry={fetchCompleted} />
            )}
            {!completed.loading && !completed.error && completed.data.length === 0 && (
              <EmptyState message="Deliveries you complete will show up here." />
            )}
            {!completed.loading &&
              !completed.error &&
              completed.data.map((order) => <PartnerOrderRow key={order.id} order={order} />)}
            {completed.data.length === 50 && (
              <p className="text-caption">Showing the most recent 50 deliveries.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PartnerOrderRow({ order, children }) {
  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      <OrderCard order={order}>{children}</OrderCard>
      {order.student?.phone && (
        <p className="text-caption" style={{ paddingLeft: 'var(--space-2)' }}>
          Contact: {order.student.name} &middot; {order.student.phone}
        </p>
      )}
    </div>
  );
}
