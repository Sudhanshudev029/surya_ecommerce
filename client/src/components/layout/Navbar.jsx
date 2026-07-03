import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ShoppingCart, User, LogOut, LayoutDashboard } from 'lucide-react';
import { logout, selectIsAdmin } from '../../features/auth/authSlice.js';
import { resetCart } from '../../features/cart/cartSlice.js';
import SearchAutocomplete from '../SearchAutocomplete.jsx';

export default function Navbar() {
  const { user } = useSelector((s) => s.auth);
  const isAdmin = useSelector(selectIsAdmin);
  const count = useSelector((s) => s.cart.count);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    dispatch(resetCart());
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Surya Store home">
          <img src="/logo.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-extrabold tracking-tight">
            <span className="text-amber-500">Surya</span>{' '}
            <span className="text-gray-800">Store</span>
          </span>
        </Link>

        <div className="hidden flex-1 md:block">
          <SearchAutocomplete />
        </div>

        <nav className="ml-auto flex items-center gap-1">
          <Link to="/products" className="btn-ghost hidden sm:inline-flex">Shop</Link>
          {isAdmin && (
            <Link to="/admin" className="btn-ghost hidden items-center gap-1 sm:inline-flex">
              <LayoutDashboard className="h-4 w-4" /> Admin
            </Link>
          )}
          <Link to="/cart" className="btn-ghost relative">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="relative">
              <button onClick={() => setOpen((o) => !o)} className="btn-ghost">
                <User className="h-5 w-5" />
              </button>
              {open && (
                <div
                  className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
                  onMouseLeave={() => setOpen(false)}
                >
                  <div className="border-b px-4 py-2 text-sm">
                    <p className="font-medium">{user.fullName}</p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Link to="/account" className="block px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>My Account</Link>
                  <Link to="/account/orders" className="block px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setOpen(false)}>My Orders</Link>
                  <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50">
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-primary">Login</Link>
          )}
        </nav>
      </div>

      {/* mobile search */}
      <div className="px-4 pb-3 md:hidden">
        <SearchAutocomplete placeholder="Search products..." />
      </div>
    </header>
  );
}
