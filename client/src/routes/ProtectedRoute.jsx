import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { selectIsAdmin } from '../features/auth/authSlice.js';
import Spinner from '../components/ui/Spinner.jsx';

export function ProtectedRoute() {
  const { user, status } = useSelector((s) => s.auth);
  const location = useLocation();
  if (status === 'loading') return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { status } = useSelector((s) => s.auth);
  const isAdmin = useSelector(selectIsAdmin);
  const user = useSelector((s) => s.auth.user);
  if (status === 'loading') return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
