import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import * as api from '../api/client';
import Field from '../components/Field';
import Button from '../components/Button';
import ErrorState from '../components/ErrorState';
import Spinner from '../components/Spinner';
import { toDateTimeLocalValue } from '../utils/format';
import { usePageTitle } from '../hooks/usePageTitle';

const defaultArrival = () => toDateTimeLocalValue(new Date(Date.now() + 30 * 60 * 1000));

export default function CreateOrder() {
  usePageTitle('New request');
  const { user } = useAuth();
  const { vendors } = useMeta();
  const { showToast } = useToast();

  const [gates, setGates] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [form, setForm] = useState({
    gateId: '',
    blockId: user.defaultBlockId ? String(user.defaultBlockId) : '',
    roomNumber: user.roomNumber || '',
    vendor: '',
    itemDescription: '',
    contactPhone: user.phone || '',
    expectedArrival: defaultArrival(),
    notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  const loadOptions = () => {
    setOptionsLoading(true);
    setLoadError(null);
    Promise.all([api.listGates(user.campusId), api.listHostels(user.campusId)])
      .then(([gatesData, hostelsData]) => {
        setGates(gatesData.gates);
        setHostels(hostelsData.hostels);
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setOptionsLoading(false));
  };

  useEffect(loadOptions, [user.campusId]);

  const setField = (key) => (event) => {
    const value = event.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        gateId: Number(form.gateId),
        blockId: Number(form.blockId),
        vendor: form.vendor,
        itemDescription: form.itemDescription,
        contactPhone: form.contactPhone,
        expectedArrival: new Date(form.expectedArrival).toISOString(),
      };
      if (form.roomNumber) payload.roomNumber = form.roomNumber;
      if (form.notes) payload.notes = form.notes;

      const data = await api.createOrder(payload);
      setCreatedOrder(data.order);
    } catch (err) {
      if (err.details) setFieldErrors(err.details);
      setFormError(err.message || 'Could not create the request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(createdOrder.orderCode).then(() => {
      showToast('Order code copied.', 'success');
    });
  };

  if (createdOrder) {
    return (
      <div className="page">
        <div className="container">
          <div
            className="card stack fade-up"
            style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}
          >
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              Request created
            </h1>
            <p className="text-dim">
              Show this code to the relay partner, or use it to track your parcel.
            </p>
            <button
              type="button"
              className="order-code-display"
              onClick={copyCode}
              title="Click to copy"
            >
              {createdOrder.orderCode}
            </button>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link
                to={`/track?code=${encodeURIComponent(createdOrder.orderCode)}`}
                className="btn btn--ghost"
              >
                Track my order
              </Link>
              <Link to="/orders" className="btn btn--primary">
                Back to my orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="card stack fade-up" style={{ maxWidth: 560, margin: '0 auto' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Create a delivery request
          </h1>

          {optionsLoading && <Spinner size="block" />}
          {!optionsLoading && loadError && (
            <ErrorState message={loadError} onRetry={loadOptions} />
          )}
          {!optionsLoading && !loadError && (
            <form className="stack" onSubmit={handleSubmit} noValidate>
              {formError && (
                <p className="field__error" role="alert">
                  {formError}
                </p>
              )}

              <Field
                id="gateId"
                label="Pickup gate"
                as="select"
                value={form.gateId}
                onChange={setField('gateId')}
                error={fieldErrors.gateId}
                required
              >
                <option value="">Select the gate the rider will use</option>
                {gates.map((gate) => (
                  <option key={gate.id} value={gate.id}>
                    {gate.name}
                  </option>
                ))}
              </Field>

              <Field
                id="vendor"
                label="Delivery app"
                as="select"
                value={form.vendor}
                onChange={setField('vendor')}
                error={fieldErrors.vendor}
                required
              >
                <option value="">Select a vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </Field>

              <Field
                id="itemDescription"
                label="What is it?"
                as="textarea"
                value={form.itemDescription}
                onChange={setField('itemDescription')}
                error={fieldErrors.itemDescription}
                hint="2 to 200 characters"
                required
              />

              <Field
                id="contactPhone"
                label="Contact phone"
                type="tel"
                inputMode="numeric"
                value={form.contactPhone}
                onChange={setField('contactPhone')}
                error={fieldErrors.contactPhone}
                hint="The relay partner may call this number"
                required
              />

              <Field
                id="expectedArrival"
                label="Expected arrival at the gate"
                type="datetime-local"
                value={form.expectedArrival}
                onChange={setField('expectedArrival')}
                error={fieldErrors.expectedArrival}
                required
              />

              <Field
                id="blockId"
                label="Hostel block"
                as="select"
                value={form.blockId}
                onChange={setField('blockId')}
                error={fieldErrors.blockId}
                required
              >
                <option value="">Select your block</option>
                {hostels.map((hostel) => (
                  <optgroup key={hostel.id} label={hostel.name}>
                    {hostel.blocks.map((block) => (
                      <option key={block.id} value={block.id}>
                        Block {block.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Field>

              <Field
                id="roomNumber"
                label="Room number (optional)"
                value={form.roomNumber}
                onChange={setField('roomNumber')}
                error={fieldErrors.roomNumber}
              />

              <Field
                id="notes"
                label="Notes for the relay partner (optional)"
                as="textarea"
                value={form.notes}
                onChange={setField('notes')}
                error={fieldErrors.notes}
                hint="Up to 300 characters"
              />

              <Button type="submit" variant="primary" block loading={submitting}>
                Create request
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
