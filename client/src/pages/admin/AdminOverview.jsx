import { useCallback, useEffect, useState } from 'react';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import Spinner from '../../components/Spinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import * as api from '../../api/client';
import { formatDateTime } from '../../utils/format';
import { usePageTitle } from '../../hooks/usePageTitle';

const POLL_MS = 10000;

export default function AdminOverview() {
  usePageTitle('Admin overview');
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesError, setDeliveriesError] = useState(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);

  const fetchStats = useCallback((quiet = false) => {
    if (!quiet) setStatsLoading(true);
    return api
      .getAdminStats()
      .then((data) => {
        setStats(data.stats);
        setStatsError(null);
      })
      .catch((err) => {
        if (!quiet) setStatsError(err.message);
      })
      .finally(() => {
        if (!quiet) setStatsLoading(false);
      });
  }, []);

  const fetchDeliveries = useCallback((quiet = false) => {
    if (!quiet) setDeliveriesLoading(true);
    return api
      .getActiveDeliveries()
      .then((data) => {
        setDeliveries(data.deliveries);
        setDeliveriesError(null);
      })
      .catch((err) => {
        if (!quiet) setDeliveriesError(err.message);
      })
      .finally(() => {
        if (!quiet) setDeliveriesLoading(false);
      });
  }, []);

  const refetchAll = useCallback(
    (quiet = false) => Promise.all([fetchStats(quiet), fetchDeliveries(quiet)]),
    [fetchStats, fetchDeliveries]
  );

  useEffect(() => {
    refetchAll();
  }, [refetchAll]);

  useEffect(() => {
    let intervalId = null;
    const start = () => {
      if (!intervalId) intervalId = setInterval(() => refetchAll(true), POLL_MS);
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
  }, [refetchAll]);

  return (
    <div className="page">
      <div className="container stack">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Admin overview
        </h1>

        {statsLoading && <Spinner size="block" />}
        {!statsLoading && statsError && <ErrorState message={statsError} onRetry={fetchStats} />}
        {!statsLoading && !statsError && stats && (
          <div className="stat-grid">
            <StatCard value={stats.orders.total} label="Total orders" />
            <StatCard value={stats.orders.active} label="Active orders" />
            <StatCard value={stats.orders.waitingAtGate} label="Waiting at gate" />
            <StatCard value={stats.orders.deliveredToday} label="Delivered today" />
            <StatCard value={stats.users.students} label="Students" />
            <StatCard value={stats.users.activePartners} label="Active partners" />
          </div>
        )}

        <h2>Live board</h2>
        {deliveriesLoading && <Spinner size="block" />}
        {!deliveriesLoading && deliveriesError && (
          <ErrorState message={deliveriesError} onRetry={fetchDeliveries} />
        )}
        {!deliveriesLoading && !deliveriesError && deliveries.length === 0 && (
          <EmptyState message="Nothing is in motion right now." />
        )}
        {!deliveriesLoading && !deliveriesError && deliveries.length > 0 && (
          <div className="table-wrap card">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Status</th>
                  <th scope="col">Vendor</th>
                  <th scope="col">Student</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Partner</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td data-label="Code">{delivery.orderCode}</td>
                    <td data-label="Status">
                      <StatusBadge status={delivery.status} />
                    </td>
                    <td data-label="Vendor">{delivery.vendor}</td>
                    <td data-label="Student">{delivery.studentName}</td>
                    <td data-label="Destination">{delivery.destination}</td>
                    <td data-label="Partner">
                      {delivery.partner ? delivery.partner.name : 'Unassigned'}
                    </td>
                    <td data-label="Updated">{formatDateTime(delivery.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
