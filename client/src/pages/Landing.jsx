import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

const RELAY_STEPS = [
  'External delivery partner',
  'College main gate',
  'Campus Relay partner',
  'Hostel gate',
  'Student',
];

export default function Landing() {
  usePageTitle();

  return (
    <div className="page">
      <div className="container stack" style={{ gap: 'var(--space-6)' }}>
        <div className="landing-hero fade-up">
          <h1 className="text-display wordmark">Campus Relay</h1>
          <p className="landing-hero__lede text-dim">
            External delivery partners aren&apos;t allowed past the main gate on most
            campuses — Campus Relay carries your parcel the last leg, from the gate to
            your hostel door.
          </p>
          <div className="row">
            <Link to="/register" className="btn btn--primary">
              Get started as a student
            </Link>
            <Link to="/login" className="btn btn--ghost">
              Log in
            </Link>
          </div>
        </div>

        <div className="card fade-up">
          <h2>How the relay works</h2>
          <ol className="relay-steps" aria-label="Relay flow">
            {RELAY_STEPS.map((step, index) => (
              <li key={step} className="row" style={{ gap: 'var(--space-2)' }}>
                <span className="relay-steps__step">{step}</span>
                {index < RELAY_STEPS.length - 1 && (
                  <span className="relay-steps__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>

        <div className="role-cards">
          <div className="card fade-up stack">
            <h2>I&apos;m a student</h2>
            <p className="text-dim">
              Raise a request when your parcel reaches the main gate and track it all
              the way to your hostel.
            </p>
            <Link to="/register" className="btn btn--primary">
              Create a student account
            </Link>
          </div>
          <div className="card fade-up stack">
            <h2>I&apos;m a delivery partner</h2>
            <p className="text-dim">
              Partner accounts are created by an admin. Log in with the credentials you
              were given to see parcels waiting at the gate.
            </p>
            <Link to="/login" className="btn btn--ghost">
              Log in
            </Link>
          </div>
        </div>

        <div className="card fade-up" style={{ textAlign: 'center' }}>
          <p>
            Already have an order code? <Link to="/track">Track an order</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
