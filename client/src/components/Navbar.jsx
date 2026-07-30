import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LINKS = {
  student: [
    { to: '/orders/new', label: 'New request' },
    { to: '/orders', label: 'My orders' },
  ],
  partner: [{ to: '/partner', label: 'Partner home' }],
  admin: [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/orders', label: 'Orders' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/campus', label: 'Campus' },
  ],
};

function linkClass({ isActive }) {
  return `navbar__link ${isActive ? 'navbar__link--active' : ''}`.trim();
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const links = user ? ROLE_LINKS[user.role] || [] : [];

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <NavLink to="/" className="navbar__brand wordmark">
          Campus Relay
        </NavLink>

        <button
          type="button"
          className="navbar__toggle"
          aria-expanded={open}
          aria-label="Toggle navigation menu"
          onClick={() => setOpen((v) => !v)}
        >
          &#9776;
        </button>

        <nav className={`navbar__links ${open ? 'navbar__links--open' : ''}`.trim()}>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/track" className={linkClass}>
            Track an order
          </NavLink>

          <div className="navbar__user">
            {user ? (
              <>
                <span>{user.name}</span>
                <span className="role-chip">{user.role}</span>
                <button type="button" className="btn btn--ghost" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="btn btn--ghost">
                  Log in
                </NavLink>
                <NavLink to="/register" className="btn btn--primary">
                  Register
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
