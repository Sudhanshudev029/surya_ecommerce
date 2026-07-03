import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Pencil } from 'lucide-react';
import { addressApi, orderApi } from '../api/endpoints.js';
import { loadCart } from '../features/cart/cartSlice.js';
import { showApiError } from '../api/axios.js';
import { formatCurrency } from '../utils/format.js';
import Spinner from '../components/ui/Spinner.jsx';
import AddressForm from '../components/AddressForm.jsx';

export default function Checkout() {
  const { items, subtotal, status: cartStatus } = useSelector((s) => s.cart);
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // address being edited, or null
  const [placing, setPlacing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const loadAddresses = () =>
    addressApi.list().then((r) => {
      setAddresses(r.data.data);
      setSelected((cur) => cur || r.data.data.find((a) => a.isDefault)?.id || r.data.data[0]?.id || null);
      setAdding(r.data.data.length === 0);
    });

  useEffect(() => { loadAddresses().finally(() => setLoading(false)); }, []);

  // Redirect to the cart only once the cart is settled (avoids a race where a
  // just-logged-in guest's merged cart hasn't loaded yet).
  useEffect(() => {
    if (cartStatus !== 'loading' && items.length === 0) navigate('/cart', { replace: true });
  }, [cartStatus, items.length, navigate]);

  if (loading || cartStatus === 'loading') return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (items.length === 0) return null; // the effect above will redirect

  const placeOrder = async () => {
    if (!selected) { toast.error('Please select a delivery address'); return; }
    setPlacing(true);
    try {
      const { data } = await orderApi.place({ addressId: selected, paymentMethod: 'cod', notes });
      toast.success('Order placed!');
      navigate(`/order-success/${data.data.id}`);
      dispatch(loadCart()); // refresh the now-empty cart in the background
    } catch (e) { showApiError(e); } finally { setPlacing(false); }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Delivery Address</h2>
              {!adding && !editing && <button onClick={() => setAdding(true)} className="text-sm font-medium text-brand-700 hover:underline">+ Add new</button>}
            </div>

            {adding || editing ? (
              <AddressForm
                initial={editing || undefined}
                onCancel={(addresses.length || editing) ? () => { setAdding(false); setEditing(null); } : undefined}
                onSaved={async (addr) => { await loadAddresses(); setSelected(addr.id); setAdding(false); setEditing(null); }}
              />
            ) : (
              <div className="space-y-2">
                {addresses.map((a) => (
                  <div key={a.id} className={`flex items-start gap-3 rounded-lg border p-3 ${selected === a.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                    <label className="flex flex-1 cursor-pointer gap-3">
                      <input type="radio" name="addr" checked={selected === a.id} onChange={() => setSelected(a.id)} className="mt-1" />
                      <div className="text-sm">
                        <p className="font-medium">
                          {a.recipient} · {a.phone}
                          {a.label && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">{a.label}</span>}
                        </p>
                        <p className="text-gray-600">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}{a.state ? `, ${a.state}` : ''} - {a.pincode}</p>
                      </div>
                    </label>
                    <button type="button" onClick={() => setEditing(a)} className="text-gray-400 hover:text-brand-700" aria-label="Edit address">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Payment Method</h2>
            <label className="flex items-center gap-3 rounded-lg border border-brand-500 bg-brand-50 p-3">
              <input type="radio" checked readOnly />
              <span className="text-sm font-medium">Cash on Delivery (COD)</span>
            </label>
            <p className="mt-2 text-xs text-gray-500">Online payment coming soon.</p>
          </section>

          <section className="card p-5">
            <label className="label">Order notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" placeholder="Any delivery instructions..." />
          </section>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-3 font-semibold">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span className="text-gray-600">{it.name} × {it.quantity}</span>
                <span>{formatCurrency(it.lineTotal)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2"><span className="text-gray-500">Delivery</span><span className="text-green-600">Free</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatCurrency(subtotal)}</span></div>
          </div>
          <button onClick={placeOrder} disabled={placing || adding} className="btn-primary mt-4 w-full">
            {placing ? 'Placing...' : 'Place Order (COD)'}
          </button>
        </div>
      </div>
    </div>
  );
}
