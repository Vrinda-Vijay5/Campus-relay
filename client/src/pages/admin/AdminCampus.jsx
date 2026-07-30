import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import * as api from '../../api/client';
import Field from '../../components/Field';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { usePageTitle } from '../../hooks/usePageTitle';

const emptyForm = (fields) => Object.fromEntries(fields.map((f) => [f, '']));

export default function AdminCampus() {
  usePageTitle('Campus configuration');
  const { showToast } = useToast();

  const [campuses, setCampuses] = useState({ data: [], loading: true, error: null });
  const [selectedCampusId, setSelectedCampusId] = useState('');
  const [gates, setGates] = useState({ data: [], loading: false, error: null });
  const [hostels, setHostels] = useState({ data: [], loading: false, error: null });

  const [campusForm, setCampusForm] = useState(emptyForm(['name', 'city']));
  const [campusFormErrors, setCampusFormErrors] = useState({});
  const [campusFormError, setCampusFormError] = useState('');
  const [campusSubmitting, setCampusSubmitting] = useState(false);

  const [gateForm, setGateForm] = useState(emptyForm(['name']));
  const [gateFormErrors, setGateFormErrors] = useState({});
  const [gateFormError, setGateFormError] = useState('');
  const [gateSubmitting, setGateSubmitting] = useState(false);

  const [hostelForm, setHostelForm] = useState(emptyForm(['name', 'gender']));
  const [hostelFormErrors, setHostelFormErrors] = useState({});
  const [hostelFormError, setHostelFormError] = useState('');
  const [hostelSubmitting, setHostelSubmitting] = useState(false);

  const [blockForms, setBlockForms] = useState({});
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [activatingKey, setActivatingKey] = useState(null);

  const fetchCampuses = useCallback(() => {
    setCampuses((s) => ({ ...s, loading: true, error: null }));
    return api
      .listAllCampuses()
      .then((data) => setCampuses({ data: data.campuses, loading: false, error: null }))
      .catch((err) => setCampuses({ data: [], loading: false, error: err.message }));
  }, []);

  useEffect(() => {
    fetchCampuses();
  }, [fetchCampuses]);

  useEffect(() => {
    if (!selectedCampusId && campuses.data.length > 0) {
      setSelectedCampusId(String(campuses.data[0].id));
    }
    if (selectedCampusId && !campuses.data.some((c) => String(c.id) === selectedCampusId)) {
      setSelectedCampusId(campuses.data.length > 0 ? String(campuses.data[0].id) : '');
    }
  }, [campuses.data, selectedCampusId]);

  const fetchGates = useCallback((campusId) => {
    if (!campusId) {
      setGates({ data: [], loading: false, error: null });
      return Promise.resolve();
    }
    setGates((s) => ({ ...s, loading: true, error: null }));
    return api
      .listAllGates(campusId)
      .then((data) => setGates({ data: data.gates, loading: false, error: null }))
      .catch((err) => setGates({ data: [], loading: false, error: err.message }));
  }, []);

  const fetchHostels = useCallback((campusId) => {
    if (!campusId) {
      setHostels({ data: [], loading: false, error: null });
      return Promise.resolve();
    }
    setHostels((s) => ({ ...s, loading: true, error: null }));
    return api
      .listAllHostels(campusId)
      .then((data) => setHostels({ data: data.hostels, loading: false, error: null }))
      .catch((err) => setHostels({ data: [], loading: false, error: err.message }));
  }, []);

  useEffect(() => {
    fetchGates(selectedCampusId);
    fetchHostels(selectedCampusId);
  }, [selectedCampusId, fetchGates, fetchHostels]);

  // ---------- Add forms ----------

  const handleAddCampus = async (event) => {
    event.preventDefault();
    setCampusFormErrors({});
    setCampusFormError('');
    setCampusSubmitting(true);
    try {
      await api.createCampus(campusForm);
      showToast('Campus added.', 'success');
      setCampusForm(emptyForm(['name', 'city']));
      fetchCampuses();
    } catch (err) {
      if (err.details) setCampusFormErrors(err.details);
      setCampusFormError(err.message || 'Could not add the campus.');
    } finally {
      setCampusSubmitting(false);
    }
  };

  const handleAddGate = async (event) => {
    event.preventDefault();
    setGateFormErrors({});
    setGateFormError('');
    setGateSubmitting(true);
    try {
      await api.createGate({ campusId: Number(selectedCampusId), name: gateForm.name });
      showToast('Gate added.', 'success');
      setGateForm(emptyForm(['name']));
      fetchGates(selectedCampusId);
    } catch (err) {
      if (err.details) setGateFormErrors(err.details);
      setGateFormError(err.message || 'Could not add the gate.');
    } finally {
      setGateSubmitting(false);
    }
  };

  const handleAddHostel = async (event) => {
    event.preventDefault();
    setHostelFormErrors({});
    setHostelFormError('');
    setHostelSubmitting(true);
    try {
      await api.createHostel({
        campusId: Number(selectedCampusId),
        name: hostelForm.name,
        gender: hostelForm.gender,
      });
      showToast('Hostel added.', 'success');
      setHostelForm(emptyForm(['name', 'gender']));
      fetchHostels(selectedCampusId);
    } catch (err) {
      if (err.details) setHostelFormErrors(err.details);
      setHostelFormError(err.message || 'Could not add the hostel.');
    } finally {
      setHostelSubmitting(false);
    }
  };

  const getBlockForm = (hostelId) => blockForms[hostelId] || { name: '', error: '', submitting: false };
  const patchBlockForm = (hostelId, patch) =>
    setBlockForms((prev) => ({ ...prev, [hostelId]: { ...getBlockForm(hostelId), ...patch } }));

  const handleAddBlock = async (event, hostelId) => {
    event.preventDefault();
    const form = getBlockForm(hostelId);
    patchBlockForm(hostelId, { submitting: true, error: '' });
    try {
      await api.createBlock({ hostelId, name: form.name });
      showToast('Block added.', 'success');
      patchBlockForm(hostelId, { name: '', submitting: false, error: '' });
      fetchHostels(selectedCampusId);
    } catch (err) {
      patchBlockForm(hostelId, {
        submitting: false,
        error: err.details?.name || err.message || 'Could not add the block.',
      });
    }
  };

  // ---------- Activate / deactivate ----------

  const refetchForType = (type) => {
    if (type === 'campuses') return fetchCampuses();
    if (type === 'gates') return fetchGates(selectedCampusId);
    return fetchHostels(selectedCampusId);
  };

  const handleActivate = async (type, id) => {
    const key = `${type}:${id}`;
    setActivatingKey(key);
    try {
      await api.setConfigActive(type, id, true);
      showToast('Activated.', 'success');
      refetchForType(type);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActivatingKey(null);
    }
  };

  const confirmDeactivate = async () => {
    setDeactivating(true);
    const { type, id } = deactivateTarget;
    try {
      await api.setConfigActive(type, id, false);
      showToast('Deactivated.', 'success');
      setDeactivateTarget(null);
      refetchForType(type);
    } catch (err) {
      showToast(err.message, 'error');
      setDeactivateTarget(null);
    } finally {
      setDeactivating(false);
    }
  };

  const selectedCampus = campuses.data.find((c) => String(c.id) === selectedCampusId);

  return (
    <div className="page">
      <div className="container stack">
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Campus configuration
        </h1>
        <p className="text-dim">
          Deactivating an item hides it from new requests immediately — orders that
          already reference it are unaffected. Deactivated items stay listed here, dimmed,
          so you can reactivate one later.
        </p>

        {/* ---------- Campuses ---------- */}
        <div className="card stack">
          <h2>Campuses</h2>
          {campuses.loading && <Spinner size="block" />}
          {!campuses.loading && campuses.error && (
            <ErrorState message={campuses.error} onRetry={fetchCampuses} />
          )}
          {!campuses.loading && !campuses.error && campuses.data.length === 0 && (
            <EmptyState message="No campuses yet. Add one below." />
          )}
          {!campuses.loading && !campuses.error && campuses.data.length > 0 && (
            <ul className="stack" style={{ gap: 'var(--space-2)' }}>
              {campuses.data.map((c) => (
                <li
                  key={c.id}
                  className="row-between"
                  style={{ opacity: c.isActive ? 1 : 0.55 }}
                >
                  <span>
                    {c.name} <span className="text-dim">({c.city})</span>
                    {!c.isActive && <span className="text-caption"> &middot; inactive</span>}
                  </span>
                  {c.isActive ? (
                    <Button
                      variant="danger"
                      onClick={() =>
                        setDeactivateTarget({ type: 'campuses', id: c.id, label: c.name })
                      }
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      loading={activatingKey === `campuses:${c.id}`}
                      onClick={() => handleActivate('campuses', c.id)}
                    >
                      Activate
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form className="row" onSubmit={handleAddCampus} noValidate style={{ alignItems: 'flex-end' }}>
            {campusFormError && (
              <p className="field__error" role="alert" style={{ flexBasis: '100%' }}>
                {campusFormError}
              </p>
            )}
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field
                id="campus-name"
                label="Campus name"
                value={campusForm.name}
                onChange={(e) => setCampusForm((f) => ({ ...f, name: e.target.value }))}
                error={campusFormErrors.name}
                required
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Field
                id="campus-city"
                label="City"
                value={campusForm.city}
                onChange={(e) => setCampusForm((f) => ({ ...f, city: e.target.value }))}
                error={campusFormErrors.city}
                required
              />
            </div>
            <Button type="submit" variant="primary" loading={campusSubmitting}>
              Add campus
            </Button>
          </form>
        </div>

        {/* ---------- Campus selector ---------- */}
        {campuses.data.length > 0 && (
          <div style={{ maxWidth: 320 }}>
            <Field
              id="manage-campus"
              label="Manage campus"
              as="select"
              value={selectedCampusId}
              onChange={(e) => setSelectedCampusId(e.target.value)}
            >
              {campuses.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive ? ' (inactive)' : ''}
                </option>
              ))}
            </Field>
          </div>
        )}

        {selectedCampus && (
          <>
            {/* ---------- Gates ---------- */}
            <div className="card stack">
              <h2>Gates — {selectedCampus.name}</h2>
              {gates.loading && <Spinner size="block" />}
              {!gates.loading && gates.error && (
                <ErrorState message={gates.error} onRetry={() => fetchGates(selectedCampusId)} />
              )}
              {!gates.loading && !gates.error && gates.data.length === 0 && (
                <EmptyState message="No gates yet. Add one below." />
              )}
              {!gates.loading && !gates.error && gates.data.length > 0 && (
                <ul className="stack" style={{ gap: 'var(--space-2)' }}>
                  {gates.data.map((g) => (
                    <li
                      key={g.id}
                      className="row-between"
                      style={{ opacity: g.isActive ? 1 : 0.55 }}
                    >
                      <span>
                        {g.name}
                        {!g.isActive && <span className="text-caption"> &middot; inactive</span>}
                      </span>
                      {g.isActive ? (
                        <Button
                          variant="danger"
                          onClick={() =>
                            setDeactivateTarget({ type: 'gates', id: g.id, label: g.name })
                          }
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          loading={activatingKey === `gates:${g.id}`}
                          onClick={() => handleActivate('gates', g.id)}
                        >
                          Activate
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <form className="row" onSubmit={handleAddGate} noValidate style={{ alignItems: 'flex-end' }}>
                {gateFormError && (
                  <p className="field__error" role="alert" style={{ flexBasis: '100%' }}>
                    {gateFormError}
                  </p>
                )}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <Field
                    id="gate-name"
                    label="Gate name"
                    value={gateForm.name}
                    onChange={(e) => setGateForm({ name: e.target.value })}
                    error={gateFormErrors.name}
                    required
                  />
                </div>
                <Button type="submit" variant="primary" loading={gateSubmitting}>
                  Add gate
                </Button>
              </form>
            </div>

            {/* ---------- Hostels & blocks ---------- */}
            <div className="card stack">
              <h2>Hostels &amp; blocks — {selectedCampus.name}</h2>
              {hostels.loading && <Spinner size="block" />}
              {!hostels.loading && hostels.error && (
                <ErrorState
                  message={hostels.error}
                  onRetry={() => fetchHostels(selectedCampusId)}
                />
              )}
              {!hostels.loading && !hostels.error && hostels.data.length === 0 && (
                <EmptyState message="No hostels yet. Add one below." />
              )}

              {!hostels.loading &&
                !hostels.error &&
                hostels.data.map((hostel) => {
                  const blockForm = getBlockForm(hostel.id);
                  return (
                    <div
                      key={hostel.id}
                      className="stack"
                      style={{
                        gap: 'var(--space-2)',
                        borderTop: '1px solid var(--border)',
                        paddingTop: 'var(--space-3)',
                        opacity: hostel.isActive ? 1 : 0.55,
                      }}
                    >
                      <div className="row-between">
                        <span>
                          {hostel.name}{' '}
                          <span className="role-chip" style={{ textTransform: 'capitalize' }}>
                            {hostel.gender}
                          </span>
                          {!hostel.isActive && (
                            <span className="text-caption"> &middot; inactive</span>
                          )}
                        </span>
                        {hostel.isActive ? (
                          <Button
                            variant="danger"
                            onClick={() =>
                              setDeactivateTarget({
                                type: 'hostels',
                                id: hostel.id,
                                label: hostel.name,
                              })
                            }
                          >
                            Deactivate hostel
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            loading={activatingKey === `hostels:${hostel.id}`}
                            onClick={() => handleActivate('hostels', hostel.id)}
                          >
                            Activate hostel
                          </Button>
                        )}
                      </div>

                      {hostel.blocks.length === 0 && (
                        <p className="text-dim text-caption">No blocks yet.</p>
                      )}
                      {hostel.blocks.length > 0 && (
                        <ul className="row" style={{ gap: 'var(--space-2)' }}>
                          {hostel.blocks.map((block) => (
                            <li
                              key={block.id}
                              className="row"
                              style={{
                                gap: 'var(--space-2)',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-control)',
                                padding: 'var(--space-1) var(--space-2)',
                                opacity: block.isActive ? 1 : 0.55,
                              }}
                            >
                              <span>
                                Block {block.name}
                                {!block.isActive && (
                                  <span className="text-caption"> &middot; inactive</span>
                                )}
                              </span>
                              {block.isActive ? (
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  style={{ padding: '0 var(--space-3)' }}
                                  onClick={() =>
                                    setDeactivateTarget({
                                      type: 'blocks',
                                      id: block.id,
                                      label: `Block ${block.name}`,
                                    })
                                  }
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  style={{ padding: '0 var(--space-3)' }}
                                  disabled={activatingKey === `blocks:${block.id}`}
                                  onClick={() => handleActivate('blocks', block.id)}
                                >
                                  Activate
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      <form
                        className="row"
                        onSubmit={(e) => handleAddBlock(e, hostel.id)}
                        noValidate
                        style={{ alignItems: 'flex-end' }}
                      >
                        {blockForm.error && (
                          <p className="field__error" role="alert" style={{ flexBasis: '100%' }}>
                            {blockForm.error}
                          </p>
                        )}
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <Field
                            id={`block-name-${hostel.id}`}
                            label="New block name"
                            value={blockForm.name}
                            onChange={(e) => patchBlockForm(hostel.id, { name: e.target.value })}
                          />
                        </div>
                        <Button type="submit" variant="ghost" loading={blockForm.submitting}>
                          Add block
                        </Button>
                      </form>
                    </div>
                  );
                })}

              <form
                className="row"
                onSubmit={handleAddHostel}
                noValidate
                style={{ alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}
              >
                {hostelFormError && (
                  <p className="field__error" role="alert" style={{ flexBasis: '100%' }}>
                    {hostelFormError}
                  </p>
                )}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <Field
                    id="hostel-name"
                    label="New hostel name"
                    value={hostelForm.name}
                    onChange={(e) => setHostelForm((f) => ({ ...f, name: e.target.value }))}
                    error={hostelFormErrors.name}
                    required
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <Field
                    id="hostel-gender"
                    label="Gender"
                    as="select"
                    value={hostelForm.gender}
                    onChange={(e) => setHostelForm((f) => ({ ...f, gender: e.target.value }))}
                    error={hostelFormErrors.gender}
                    required
                  >
                    <option value="">Select</option>
                    <option value="girls">Girls</option>
                    <option value="boys">Boys</option>
                  </Field>
                </div>
                <Button type="submit" variant="primary" loading={hostelSubmitting}>
                  Add hostel
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate this item?"
        message={
          deactivateTarget
            ? `"${deactivateTarget.label}" will be hidden from new requests. Existing orders that reference it are unaffected.`
            : ''
        }
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
        onConfirm={confirmDeactivate}
        onClose={() => setDeactivateTarget(null)}
      />
    </div>
  );
}
