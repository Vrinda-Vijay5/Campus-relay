import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as api from '../api/client';
import RelayTrack from '../components/RelayTrack';
import Field from '../components/Field';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { formatDateTime } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const normalizeCode = (raw) => raw.trim().toUpperCase();

export default function TrackOrder() {
  usePageTitle('Track an order');
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState(searchParams.get('code') || '');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const autoSearched = useRef(false);

  const runSearch = useCallback((rawCode) => {
    const code = normalizeCode(rawCode);
    if (!code) return;

    setLoading(true);
    setError(null);
    setSearched(true);
    api
      .trackByCode(code)
      .then((data) => setOrder(data.order))
      .catch((err) => {
        setOrder(null);
        setError(err.message || 'Could not look up that order.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const deepLinkCode = searchParams.get('code');
    if (deepLinkCode && !autoSearched.current) {
      autoSearched.current = true;
      setInput(deepLinkCode);
      runSearch(deepLinkCode);
    }
  }, [searchParams, runSearch]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const code = normalizeCode(input);
    setSearchParams(code ? { code } : {});
    runSearch(code);
  };

  return (
    <div className="page">
      <div className="container stack">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Track an order
        </h1>
        <p className="text-dim">
          Enter your order code to see live progress. Phone numbers and other personal
          details are hidden on this public page.
        </p>

        <form
          className="card row"
          onSubmit={handleSubmit}
          noValidate
          style={{ alignItems: 'flex-end' }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field
              id="track-code"
              label="Order code"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              hint="e.g. CR001010-7EA0"
              required
            />
          </div>
          <Button type="submit" variant="primary" loading={loading}>
            Track
          </Button>
        </form>

        {loading && <Spinner size="block" />}

        {!loading && error && <ErrorState message={error} onRetry={() => runSearch(input)} />}

        {!loading && !error && !searched && (
          <EmptyState
            icon="📦"
            message="Enter an order code above to see its live status."
          />
        )}

        {!loading && !error && searched && order && (
          <div className="stack">
            <div className="card fade-up">
              <RelayTrack status={order.status} tracking={order.tracking} />
            </div>

            <div className="card stack fade-up">
              <h2>Details</h2>
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <DetailRow label="Order code" value={order.orderCode} />
                <DetailRow label="Vendor" value={order.vendor} />
                <DetailRow label="Destination" value={order.destination?.label} />
                <DetailRow label="Pickup gate" value={order.gate?.name} />
                <DetailRow label="Expected arrival" value={formatDateTime(order.expectedArrival)} />
                <DetailRow label="Requested" value={formatDateTime(order.createdAt)} />
                {order.deliveredAt && (
                  <DetailRow label="Delivered" value={formatDateTime(order.deliveredAt)} />
                )}
                {order.partner?.name && (
                  <DetailRow label="Relay partner" value={order.partner.name} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
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
