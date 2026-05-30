import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ShoppingCart, User, LogOut, Search, Menu, LayoutDashboard } from 'lucide-react';
import { logout, selectIsAdmin } from '../../features/auth/authSlice.js';
import { resetCart } from '../../features/cart/cartSlice.js';

export default function Navbar() {
  const { user } = useSelector((s) => s.auth);
  const isAdmin = useSelector(selectIsAdmin);
  const count = useSelector((s) => s.cart.count);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/products?search=${encodeURIComponent(q)}`);
  };
  const handleLogout = () => {
    dispatch(logout());
    dispatch(resetCart());
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-700">
          🛒 <span>Surya Store</span>
        </Link>

        <form onSubmit={submitSearch} className="relative hidden flex-1 md:block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for oil, vegetables, snacks..."
            className="input pl-9"
          />
        </form>

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
      <form onSubmit={submitSearch} className="relative px-4 pb-3 md:hidden">
        <Search className="absolute left-7 top-2.5 h-4 w-4 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." className="input pl-9" />
      </form>
    </header>
  );
}
