import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';
import Field from '../components/Field';
import Button from '../components/Button';
import ErrorState from '../components/ErrorState';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Register() {
  usePageTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();

  const [campuses, setCampuses] = useState([]);
  const [campusesLoading, setCampusesLoading] = useState(true);
  const [campusesError, setCampusesError] = useState(null);
  const [hostels, setHostels] = useState([]);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    campusId: '',
    defaultBlockId: '',
    roomNumber: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCampuses = () => {
    setCampusesLoading(true);
    setCampusesError(null);
    api
      .listCampuses()
      .then((data) => setCampuses(data.campuses))
      .catch((err) => setCampusesError(err.message))
      .finally(() => setCampusesLoading(false));
  };

  useEffect(loadCampuses, []);

  useEffect(() => {
    if (!form.campusId) {
      setHostels([]);
      return;
    }
    api
      .listHostels(form.campusId)
      .then((data) => setHostels(data.hostels))
      .catch(() => setHostels([]));
  }, [form.campusId]);

  const setField = (key) => (event) => {
    const value = event.target.value;
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === 'campusId' ? { defaultBlockId: '' } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        password: form.password,
        campusId: Number(form.campusId),
      };
      if (form.defaultBlockId) payload.defaultBlockId = Number(form.defaultBlockId);
      if (form.roomNumber) payload.roomNumber = form.roomNumber;

      await register(payload);
      navigate('/orders', { replace: true });
    } catch (err) {
      if (err.details) setFieldErrors(err.details);
      setFormError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card stack fade-up" style={{ maxWidth: 480, margin: '0 auto' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Create a student account
          </h1>

          <form className="stack" onSubmit={handleSubmit} noValidate>
            {formError && (
              <p className="field__error" role="alert">
                {formError}
              </p>
            )}
            <Field
              id="name"
              label="Full name"
              value={form.name}
              onChange={setField('name')}
              error={fieldErrors.name}
              required
            />
            <Field
              id="phone"
              label="Phone number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={form.phone}
              onChange={setField('phone')}
              error={fieldErrors.phone}
              hint="10-digit Indian mobile number"
              required
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={setField('password')}
              error={fieldErrors.password}
              hint="At least 8 characters, with a letter and a digit"
              required
            />

            {campusesError ? (
              <ErrorState message={campusesError} onRetry={loadCampuses} />
            ) : (
              <Field
                id="campusId"
                label="Campus"
                as="select"
                value={form.campusId}
                onChange={setField('campusId')}
                error={fieldErrors.campusId}
                disabled={campusesLoading}
                hint={campusesLoading ? 'Loading campuses…' : undefined}
                required
              >
                <option value="">Select your campus</option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name} ({campus.city})
                  </option>
                ))}
              </Field>
            )}

            <Field
              id="defaultBlockId"
              label="Hostel block (optional)"
              as="select"
              value={form.defaultBlockId}
              onChange={setField('defaultBlockId')}
              error={fieldErrors.defaultBlockId}
              disabled={!form.campusId}
              hint="You can set this later from your profile too"
            >
              <option value="">Select a block</option>
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

            <Button type="submit" variant="primary" block loading={submitting}>
              Create account
            </Button>
          </form>

          <p className="text-dim">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
