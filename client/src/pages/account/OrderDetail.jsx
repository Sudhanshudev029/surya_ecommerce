import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { orderApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import { formatCurrency, formatDate, STATUS_STYLES } from '../../utils/format.js';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';

const STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => orderApi.get(id).then((r) => setOrder(r.data.data));
  useEffect(() => { load().finally(() => setLoading(false)); }, [id]);

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;
  if (!order) return <p className="py-16 text-center text-gray-500">Order not found.</p>;

  const cancel = async () => {
    try { await orderApi.cancel(id); await load(); toast.success('Order cancelled'); }
    catch (e) { showApiError(e); }
  };

  const stepIdx = STEPS.indexOf(order.status);
  const cancelled = order.status === 'cancelled';

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/account/orders" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        <ChevronLeft className="h-4 w-4" /> Back to orders
      </Link>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Order #{order.orderNumber}</h1>
            <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
          </div>
          <Badge className={STATUS_STYLES[order.status]}>{order.status}</Badge>
        </div>

        {/* tracker */}
        {!cancelled && (
          <div className="mt-5 flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 flex-col items-center">
                <div className={`h-3 w-3 rounded-full ${i <= stepIdx ? 'bg-brand-600' : 'bg-gray-300'}`} />
                <span className="mt-1 text-[10px] capitalize text-gray-500">{s}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t pt-4 text-sm">
          <p className="font-medium">Delivery Address</p>
          <p className="text-gray-600">{order.shipping.recipient} · {order.shipping.phone}</p>
          <p className="text-gray-600">{order.shipping.line1}{order.shipping.line2 ? `, ${order.shipping.line2}` : ''}, {order.shipping.city} - {order.shipping.pincode}</p>
        </div>

        <div className="mt-4 border-t pt-4">
          <p className="mb-2 text-sm font-medium">Items</p>
          {order.items.map((it) => (
            <div key={it.productId || it.name} className="flex justify-between py-1 text-sm">
              <span className="text-gray-600">{it.name} × {it.quantity}</span>
              <span>{formatCurrency(it.lineTotal)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
        </div>

        {['pending', 'confirmed'].includes(order.status) && (
          <button onClick={cancel} className="btn-outline mt-4 text-red-600">Cancel Order</button>
        )}
      </div>
    </div>
  );
}
