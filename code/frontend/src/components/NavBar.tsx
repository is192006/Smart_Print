import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        SmartPrint
      </Link>
      <nav className="navbar-links">
        {user?.role === 'STUDENT' && (
          <>
            <Link to="/student">New Order</Link>
            <Link to="/student/orders">My Orders</Link>
          </>
        )}
        {user?.role === 'SHOP_STAFF' && (
          <>
            <Link to="/staff">Queue</Link>
            <Link to="/staff/pricing">Pricing</Link>
            <Link to="/staff/finishing">Finishing</Link>
          </>
        )}
        {user?.role === 'ADMIN' && (
          <>
            <Link to="/admin/shops">Shops</Link>
            <Link to="/admin/users">Users</Link>
          </>
        )}
      </nav>
      <div className="navbar-user">
        {user ? (
          <>
            <span>
              {user.email} <em>({user.role})</em>
            </span>
            <button onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </div>
    </header>
  );
}
