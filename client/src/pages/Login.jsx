import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Field from '../components/Field';
import Button from '../components/Button';
import { usePageTitle } from '../hooks/usePageTitle';

const DEMO_ACCOUNTS = [
  { label: 'Admin', phone: '9000000001', password: 'Admin@123' },
  { label: 'Partner (Ravi)', phone: '9100000001', password: 'Partner@123' },
  { label: 'Student (Arjun)', phone: '9200000001', password: 'Student@123' },
];

const ROLE_HOME = { student: '/orders', partner: '/partner', admin: '/admin' };

export default function Login() {
  usePageTitle('Log in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fillDemo = (account) => {
    setPhone(account.phone);
    setPassword(account.password);
    setFieldErrors({});
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSubmitting(true);
    try {
      const user = await login(phone, password);
      const destination = location.state?.from || ROLE_HOME[user.role] || '/';
      navigate(destination, { replace: true });
    } catch (err) {
      if (err.details) setFieldErrors(err.details);
      setFormError(err.message || 'Could not log in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="card stack fade-up" style={{ maxWidth: 420, margin: '0 auto' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Log in
          </h1>

          <form className="stack" onSubmit={handleSubmit} noValidate>
            {formError && (
              <p className="field__error" role="alert">
                {formError}
              </p>
            )}
            <Field
              id="login-phone"
              label="Phone number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={fieldErrors.phone}
              required
            />
            <Field
              id="login-password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              required
            />
            <Button type="submit" variant="primary" block loading={submitting}>
              Log in
            </Button>
          </form>

          <p className="text-dim">
            New here? <Link to="/register">Create a student account</Link>
          </p>

          <div className="stack" style={{ gap: 'var(--space-2)' }}>
            <span className="text-caption">Demo accounts (seeded data)</span>
            <div className="row">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.phone}
                  type="button"
                  className="role-chip"
                  style={{ cursor: 'pointer', minHeight: 44 }}
                  onClick={() => fillDemo(account)}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
