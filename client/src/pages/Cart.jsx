import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { updateCartItem, removeCartItem } from '../features/cart/cartSlice.js';
import { showApiError } from '../api/axios.js';
import { formatCurrency } from '../utils/format.js';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function Cart() {
  const { items, subtotal } = useSelector((s) => s.cart);
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  if (items.length === 0) {
    return <EmptyState icon={ShoppingCart} title="Your cart is empty"
      subtitle="Browse products and add items to your cart."
      action={<Link to="/products" className="btn-primary">Start Shopping</Link>} />;
  }

  const change = async (thunk) => { try { await dispatch(thunk).unwrap(); } catch (e) { showApiError(e); } };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Your Cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="card flex items-center gap-3 p-3">
              <img src={it.imageUrl} alt={it.name} className="h-16 w-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <Link to={`/product/${it.slug}`} className="line-clamp-1 font-medium hover:text-brand-700">{it.name}</Link>
                <p className="text-sm text-gray-500">{it.unit} · {formatCurrency(it.price)}</p>
              </div>
              <div className="flex items-center rounded-lg border border-gray-300">
                <button onClick={() => change(updateCartItem({ id: it.id, quantity: Math.max(1, it.quantity - 1) }))} className="px-2 py-1.5"><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-8 text-center text-sm">{it.quantity}</span>
                <button onClick={() => change(updateCartItem({ id: it.id, quantity: it.quantity + 1 }))} className="px-2 py-1.5"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <div className="w-20 text-right font-medium">{formatCurrency(it.lineTotal)}</div>
              <button onClick={() => change(removeCartItem(it.id))} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-3 font-semibold">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span className="text-green-600">Free</span></div>
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span>{formatCurrency(subtotal)}</span></div>
          </div>
          <button
            onClick={() => (user ? navigate('/checkout') : navigate('/login', { state: { from: { pathname: '/checkout' } } }))}
            className="btn-primary mt-4 w-full"
          >
            {user ? 'Proceed to Checkout' : 'Login to Checkout'}
          </button>
          {!user && (
            <p className="mt-2 text-center text-xs text-gray-500">Your cart will be saved when you log in.</p>
          )}
        </div>
      </div>
    </div>
  );
}
