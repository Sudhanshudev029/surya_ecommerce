import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { orderApi } from '../api/endpoints.js';
import { formatCurrency } from '../utils/format.js';
import Spinner from '../components/ui/Spinner.jsx';

export default function OrderSuccess() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => { orderApi.get(id).then((r) => setOrder(r.data.data)).catch(() => {}); }, [id]);

  if (!order) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="mx-auto max-w-lg py-8 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-brand-600" />
      <h1 className="mt-4 text-2xl font-bold">Order Placed!</h1>
      <p className="mt-1 text-gray-600">Thank you. Your order <strong>#{order.orderNumber}</strong> has been received.</p>

      <div className="card mt-6 p-5 text-left text-sm">
        <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Order Number</span><span className="font-medium">#{order.orderNumber}</span></div>
        <div className="flex justify-between border-b py-2"><span className="text-gray-500">Payment</span><span>Cash on Delivery</span></div>
        <div className="flex justify-between border-b py-2"><span className="text-gray-500">Status</span><span className="capitalize">{order.status}</span></div>
        <div className="flex justify-between pt-2 font-semibold"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Link to="/account/orders" className="btn-outline">View My Orders</Link>
        <Link to="/products" className="btn-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}
