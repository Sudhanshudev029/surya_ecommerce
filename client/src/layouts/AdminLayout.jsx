import { NavLink, Outlet, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingBag, Users, Boxes, Store, LogOut,
} from 'lucide-react';
import { logout } from '../features/auth/authSlice.js';

const links = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="hidden w-60 flex-col border-r border-gray-200 bg-white sm:flex">
        <div className="border-b px-5 py-4 text-lg font-bold text-brand-700">🛒 Admin</div>
        <nav className="flex-1 space-y-1 p-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t p-3">
          <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <Store className="h-4 w-4" /> View Store
          </Link>
          <button
            onClick={() => { dispatch(logout()); navigate('/login'); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* mobile top nav */}
        <div className="flex gap-1 overflow-x-auto border-b bg-white p-2 sm:hidden">
          {links.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`}>
              {label}
            </NavLink>
          ))}
        </div>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
