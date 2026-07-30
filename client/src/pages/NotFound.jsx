import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Page not found');

  return (
    <div className="page">
      <div className="container">
        <div className="card stack fade-up" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            Page not found
          </h1>
          <p className="text-dim">
            The page you are looking for does not exist or may have moved.
          </p>
          <Link to="/" className="btn btn--primary">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
