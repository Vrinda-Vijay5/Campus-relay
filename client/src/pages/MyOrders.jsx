import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import * as api from '../api/client';
import OrderCard from '../components/OrderCard';
import Button from '../components/Button';
import Field from '../components/Field';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import { getStatusActions, canCancel } from '../utils/orderActions';
import { usePageTitle } from '../hooks/usePageTitle';

// "All" and "Active" aren't single API statuses (Active spans several), so
// they stay as UI copy. Delivered/Cancelled read their text from MetaContext
// instead of repeating the label here.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'delivered', status: 'DELIVERED' },
  { key: 'cancelled', status: 'CANCELLED' },
];

const HEADING_BY_ROLE = {
  student: 'My orders',
  partner: 'My deliveries',
  admin: 'All orders',
};

const LIMIT = 10;

export default function MyOrders() {
  const { user } = useAuth();
  const { statusLabels } = useMeta();
  const { showToast } = useToast();
  const navigate = useNavigate();
  usePageTitle(HEADING_BY_ROLE[user.role] || 'Orders');

  const [filter, setFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit: LIMIT };
    if (filter === 'active') params.active = 'true';
    if (filter === 'delivered') params.status = 'DELIVERED';
    if (filter === 'cancelled') params.status = 'CANCELLED';
    if (search) params.q = search;

    return api
      .listOrders(params)
      .then((data) => {
        setOrders(data.orders);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filter, search, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  const handleStatusAction = (order, status) => {
    const key = `${order.id}:${status}`;
    withBusy(key, () =>
      api
        .updateOrderStatus(order.id, { status })
        .then(() => {
          showToast('Order updated.', 'success');
          fetchOrders();
        })
        .catch((err) => {
          showToast(err.message, 'error');
          fetchOrders();
        })
    );
  };

  const openCancel = (order) => {
    setCancelTarget(order);
    setCancelReason('');
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await api.cancelOrder(cancelTarget.id, cancelReason ? { reason: cancelReason } : {});
      showToast('Order cancelled.', 'success');
      setCancelTarget(null);
      fetchOrders();
    } catch (err) {
      showToast(err.message, 'error');
      fetchOrders();
    } finally {
      setCancelling(false);
    }
  };

  const clearFilters = () => {
    setFilter('all');
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = filter !== 'all' || Boolean(search);

  return (
    <div className="page">
      <div className="container stack">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          {HEADING_BY_ROLE[user.role] || 'Orders'}
        </h1>

        <div className="row-between">
          <div className="row" role="group" aria-label="Filter orders">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`btn ${filter === f.key ? 'btn--primary' : 'btn--ghost'}`}
                aria-pressed={filter === f.key}
                onClick={() => {
                  setFilter(f.key);
                  setPage(1);
                }}
              >
                {f.label || statusLabels[f.status] || f.status}
              </button>
            ))}
          </div>

          <div style={{ minWidth: 220 }}>
            <Field
              id="order-search"
              label="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              hint="Order code, item or student name"
            />
          </div>
        </div>

        {loading && <Spinner size="block" />}

        {!loading && error && <ErrorState message={error} onRetry={fetchOrders} />}

        {!loading && !error && orders.length === 0 && !hasActiveFilters && (
          <EmptyState
            message={
              user.role === 'student'
                ? 'No delivery requests yet. Create one when your parcel is on its way to the gate.'
                : 'No orders yet.'
            }
            actionLabel={user.role === 'student' ? 'Create a request' : undefined}
            onAction={user.role === 'student' ? () => navigate('/orders/new') : undefined}
          />
        )}

        {!loading && !error && orders.length === 0 && hasActiveFilters && (
          <EmptyState
            message="No orders match the current filters."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="stack">
            {orders.map((order) => {
              const statusActions = getStatusActions(order, user);
              const showCancel = canCancel(order, user);

              return (
                <OrderCard key={order.id} order={order}>
                  {statusActions.map((action) => (
                    <Button
                      key={action.status}
                      variant="ghost"
                      loading={busyKeys.has(`${order.id}:${action.status}`)}
                      onClick={() => handleStatusAction(order, action.status)}
                    >
                      {action.label}
                    </Button>
                  ))}
                  {showCancel && (
                    <Button variant="danger" onClick={() => openCancel(order)}>
                      Cancel
                    </Button>
                  )}
                </OrderCard>
              );
            })}
          </div>
        )}

        <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel this order?"
        confirmLabel="Cancel order"
        danger
        loading={cancelling}
        onConfirm={confirmCancel}
        onClose={() => setCancelTarget(null)}
      >
        <p className="text-dim">
          {cancelTarget?.orderCode} will be cancelled. This cannot be undone.
        </p>
        <Field
          id="cancel-reason"
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
