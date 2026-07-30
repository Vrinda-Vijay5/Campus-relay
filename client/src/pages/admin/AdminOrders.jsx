import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMeta } from '../../context/MetaContext';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import Field from '../../components/Field';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { formatDateTime } from '../../utils/format';
import { usePageTitle } from '../../hooks/usePageTitle';

const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];

export default function AdminOrders() {
  usePageTitle('All orders');
  const { statusLabels, vendors } = useMeta();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') || '';
  const vendor = searchParams.get('vendor') || '';
  const gender = searchParams.get('gender') || '';
  const partnerId = searchParams.get('partnerId') || '';
  const q = searchParams.get('q') || '';
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 10;

  const [searchInput, setSearchInput] = useState(q);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterPartners, setFilterPartners] = useState([]);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignPartners, setAssignPartners] = useState({ data: [], loading: false, error: null });
  const [assigningId, setAssigningId] = useState(null);

  useEffect(() => {
    api.listPartners().then((data) => setFilterPartners(data.partners)).catch(() => {});
  }, []);

  const setFilter = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete('page');
        return next;
      });
    },
    [setSearchParams]
  );

  const setPage = useCallback(
    (nextPage) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (nextPage > 1) next.set('page', String(nextPage));
        else next.delete('page');
        return next;
      });
    },
    [setSearchParams]
  );

  // Debounce the search box into the URL so we don't hit the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== q) setFilter('q', searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, q, setFilter]);

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit };
    if (status) params.status = status;
    if (vendor) params.vendor = vendor;
    if (gender) params.gender = gender;
    if (partnerId) params.partnerId = partnerId;
    if (q) params.q = q;

    return api
      .listOrders(params)
      .then((data) => {
        setOrders(data.orders);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status, vendor, gender, partnerId, q, page, limit]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openAssign = (order) => {
    setAssignTarget(order);
    setAssignPartners({ data: [], loading: true, error: null });
    api
      .listPartners({ campusId: order.campus.id })
      .then((data) => setAssignPartners({ data: data.partners, loading: false, error: null }))
      .catch((err) => setAssignPartners({ data: [], loading: false, error: err.message }));
  };

  const confirmAssign = (partner) => {
    setAssigningId(partner.id);
    api
      .assignOrder(assignTarget.id, partner.id)
      .then(() => {
        showToast(`Delivery partner assigned to ${partner.name}.`, 'success');
        setAssignTarget(null);
        fetchOrders();
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setAssigningId(null));
  };

  return (
    <div className="page">
      <div className="container stack">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          All orders
        </h1>

        <div className="row-between">
          <div className="row">
            <Field
              id="filter-status"
              label="Status"
              as="select"
              value={status}
              onChange={(e) => setFilter('status', e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.keys(statusLabels).map((key) => (
                <option key={key} value={key}>
                  {statusLabels[key]}
                </option>
              ))}
            </Field>

            <Field
              id="filter-vendor"
              label="Vendor"
              as="select"
              value={vendor}
              onChange={(e) => setFilter('vendor', e.target.value)}
            >
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Field>

            <Field
              id="filter-gender"
              label="Gender"
              as="select"
              value={gender}
              onChange={(e) => setFilter('gender', e.target.value)}
            >
              <option value="">All</option>
              <option value="girls">Girls</option>
              <option value="boys">Boys</option>
            </Field>

            <Field
              id="filter-partner"
              label="Partner"
              as="select"
              value={partnerId}
              onChange={(e) => setFilter('partnerId', e.target.value)}
            >
              <option value="">All partners</option>
              {filterPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Field>
          </div>

          <div style={{ minWidth: 220 }}>
            <Field
              id="filter-search"
              label="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              hint="Order code, item or student name"
            />
          </div>
        </div>

        {loading && <Spinner size="block" />}
        {!loading && error && <ErrorState message={error} onRetry={fetchOrders} />}
        {!loading && !error && orders.length === 0 && (
          <EmptyState
            message="No orders match the current filters."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="table-wrap card">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Student</th>
                  <th scope="col">Vendor</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Status</th>
                  <th scope="col">Partner</th>
                  <th scope="col">Created</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Code">{order.orderCode}</td>
                    <td data-label="Student">{order.student?.name}</td>
                    <td data-label="Vendor">{order.vendor}</td>
                    <td data-label="Destination">{order.destination?.label}</td>
                    <td data-label="Status">
                      <StatusBadge status={order.status} />
                    </td>
                    <td data-label="Partner">{order.partner ? order.partner.name : '—'}</td>
                    <td data-label="Created">{formatDateTime(order.createdAt)}</td>
                    <td data-label="Actions">
                      {!TERMINAL_STATUSES.includes(order.status) && (
                        <Button variant="ghost" onClick={() => openAssign(order)}>
                          {order.partner ? 'Reassign' : 'Assign'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />
      </div>

      <Modal
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title={assignTarget ? `Assign ${assignTarget.orderCode}` : 'Assign'}
      >
        {assignPartners.loading && <Spinner size="block" />}
        {!assignPartners.loading && assignPartners.error && (
          <ErrorState
            message={assignPartners.error}
            onRetry={() => openAssign(assignTarget)}
          />
        )}
        {!assignPartners.loading && !assignPartners.error && assignPartners.data.length === 0 && (
          <EmptyState message="No delivery partners on this campus yet." />
        )}
        {!assignPartners.loading && !assignPartners.error && assignPartners.data.length > 0 && (
          <ul className="stack" style={{ gap: 'var(--space-2)' }}>
            {assignPartners.data.map((partner) => (
              <li key={partner.id} className="row-between" style={{ gap: 'var(--space-3)' }}>
                <div>
                  <div>
                    {partner.name}
                    {!partner.isActive && (
                      <span className="text-caption"> &middot; deactivated</span>
                    )}
                  </div>
                  <div className="text-caption">
                    {partner.activeDeliveries} active &middot; {partner.completedDeliveries} completed
                  </div>
                </div>
                <Button
                  variant="ghost"
                  disabled={!partner.isActive}
                  loading={assigningId === partner.id}
                  onClick={() => confirmAssign(partner)}
                >
                  Assign
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
