import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/client';
import Field from '../../components/Field';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import { usePageTitle } from '../../hooks/usePageTitle';

const ROLE_TABS = [
  { key: '', label: 'All' },
  { key: 'student', label: 'Students' },
  { key: 'partner', label: 'Partners' },
  { key: 'admin', label: 'Admins' },
];

const LIMIT = 10;

const emptyPartnerForm = { name: '', phone: '', password: '', campusId: '' };

export default function AdminUsers() {
  usePageTitle('Users');
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [role, setRole] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMIT, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [campuses, setCampuses] = useState([]);
  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [toggleTarget, setToggleTarget] = useState(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    api.listCampuses().then((data) => setCampuses(data.campuses)).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit: LIMIT };
    if (role) params.role = role;
    if (search) params.q = search;

    return api
      .listAdminUsers(params)
      .then((data) => {
        setUsers(data.users);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [role, search, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const setField = (key) => (event) => {
    setPartnerForm((f) => ({ ...f, [key]: event.target.value }));
  };

  const handleCreatePartner = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSubmitting(true);
    try {
      await api.createPartner({
        name: partnerForm.name,
        phone: partnerForm.phone,
        password: partnerForm.password,
        campusId: Number(partnerForm.campusId),
      });
      showToast('Delivery partner created.', 'success');
      setPartnerForm(emptyPartnerForm);
      if (!role || role === 'partner') fetchUsers();
    } catch (err) {
      if (err.details) setFieldErrors(err.details);
      setFormError(err.message || 'Could not create the partner. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setRole('');
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const confirmToggle = async () => {
    setToggling(true);
    const { user: target, nextActive } = toggleTarget;
    try {
      await api.setUserActive(target.id, nextActive);
      showToast(nextActive ? 'Account activated.' : 'Account deactivated.', 'success');
      setToggleTarget(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message, 'error');
      setToggleTarget(null);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="page">
      <div className="container stack">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Users
        </h1>

        <div className="card stack">
          <h2>Add delivery partner</h2>
          <form className="stack" onSubmit={handleCreatePartner} noValidate>
            {formError && (
              <p className="field__error" role="alert">
                {formError}
              </p>
            )}
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field
                  id="partner-name"
                  label="Name"
                  value={partnerForm.name}
                  onChange={setField('name')}
                  error={fieldErrors.name}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field
                  id="partner-phone"
                  label="Phone number"
                  type="tel"
                  inputMode="numeric"
                  value={partnerForm.phone}
                  onChange={setField('phone')}
                  error={fieldErrors.phone}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field
                  id="partner-password"
                  label="Temporary password"
                  type="password"
                  value={partnerForm.password}
                  onChange={setField('password')}
                  error={fieldErrors.password}
                  required
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <Field
                  id="partner-campus"
                  label="Campus"
                  as="select"
                  value={partnerForm.campusId}
                  onChange={setField('campusId')}
                  error={fieldErrors.campusId}
                  required
                >
                  <option value="">Select a campus</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Field>
              </div>
            </div>
            <Button type="submit" variant="primary" loading={submitting}>
              Add partner
            </Button>
          </form>
        </div>

        <div className="row-between">
          <div className="row" role="group" aria-label="Filter by role">
            {ROLE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`btn ${role === t.key ? 'btn--primary' : 'btn--ghost'}`}
                aria-pressed={role === t.key}
                onClick={() => {
                  setRole(t.key);
                  setPage(1);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ minWidth: 220 }}>
            <Field
              id="user-search"
              label="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              hint="Name or phone number"
            />
          </div>
        </div>

        {loading && <Spinner size="block" />}
        {!loading && error && <ErrorState message={error} onRetry={fetchUsers} />}
        {!loading && !error && users.length === 0 && (
          <EmptyState
            message="No users match the current filters."
            actionLabel="Clear filters"
            onAction={clearFilters}
          />
        )}

        {!loading && !error && users.length > 0 && (
          <div className="table-wrap card">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Role</th>
                  <th scope="col">Campus</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Name">
                      {u.name}
                      {u.id === currentUser.id && <span className="text-caption"> (you)</span>}
                    </td>
                    <td data-label="Phone">{u.phone}</td>
                    <td data-label="Role" style={{ textTransform: 'capitalize' }}>
                      {u.role}
                    </td>
                    <td data-label="Campus">{u.campusName || '—'}</td>
                    <td data-label="Status">{u.isActive ? 'Active' : 'Deactivated'}</td>
                    <td data-label="Actions">
                      <Button
                        variant={u.isActive ? 'danger' : 'ghost'}
                        onClick={() => setToggleTarget({ user: u, nextActive: !u.isActive })}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={pagination.page} pages={pagination.pages} onPageChange={setPage} />
      </div>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={toggleTarget?.nextActive ? 'Activate this account?' : 'Deactivate this account?'}
        message={
          toggleTarget?.nextActive
            ? `${toggleTarget.user.name} will be able to log in again.`
            : `${toggleTarget?.user.name} will no longer be able to log in.`
        }
        confirmLabel={toggleTarget?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!toggleTarget?.nextActive}
        loading={toggling}
        onConfirm={confirmToggle}
        onClose={() => setToggleTarget(null)}
      />
    </div>
  );
}
