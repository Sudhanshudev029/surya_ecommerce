import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { orderApi } from '../../api/endpoints.js';
import { formatCurrency, formatDate, STATUS_STYLES } from '../../utils/format.js';
import Spinner from '../../components/ui/Spinner.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Badge from '../../components/ui/Badge.jsx';

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { orderApi.list().then((r) => setOrders(r.data.data)).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">My Orders</h1>
      {orders.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet"
          action={<Link to="/products" className="btn-primary">Start Shopping</Link>} />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/account/orders/${o.id}`} className="card flex items-center justify-between p-4 hover:shadow-md">
              <div>
                <p className="font-medium">Order #{o.orderNumber}</p>
                <p className="text-sm text-gray-500">{formatDate(o.createdAt)}</p>
              </div>
              <div className="text-right">
                <Badge className={STATUS_STYLES[o.status]}>{o.status}</Badge>
                <p className="mt-1 font-semibold">{formatCurrency(o.total)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
