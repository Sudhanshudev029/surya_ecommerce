import { useEffect, useState } from 'react';
import { ShoppingBag, Users, Package, IndianRupee, AlertTriangle, Search } from 'lucide-react';
import { adminApi } from '../../api/endpoints.js';
import { formatCurrency, formatDate, STATUS_STYLES } from '../../utils/format.js';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';

const Stat = ({ icon: Icon, label, value, tint }) => (
  <div className="card flex items-center gap-4 p-5">
    <div className={`rounded-lg p-3 ${tint}`}><Icon className="h-6 w-6" /></div>
    <div><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold">{value}</p></div>
  </div>
);

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { adminApi.overview().then((r) => setData(r.data.data)); }, []);

  if (!data) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;

  const q = search.trim().toLowerCase();
  const recent = q
    ? data.recentOrders.filter((o) => o.customer?.toLowerCase().includes(q))
    : data.recentOrders;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ShoppingBag} label="Total Orders" value={data.totalOrders} tint="bg-blue-50 text-blue-600" />
        <Stat icon={Users} label="Customers" value={data.totalCustomers} tint="bg-purple-50 text-purple-600" />
        <Stat icon={Package} label="Products" value={data.totalProducts} tint="bg-amber-50 text-amber-600" />
        <Stat icon={IndianRupee} label="Revenue (delivered)" value={formatCurrency(data.revenue)} tint="bg-brand-50 text-brand-600" />
      </div>

      {data.lowStockCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" /> {data.lowStockCount} product(s) are low on stock.
        </div>
      )}

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Recent Orders</h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name..."
              className="input w-60 pl-9"
            />
          </div>
        </div>
        {data.recentOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No orders yet.</p>
        ) : recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No orders match “{search}”.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr><th className="py-2">Order</th><th>Customer</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="py-2 font-medium">#{o.orderNumber}</td>
                    <td>{o.customer}</td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td><Badge className={STATUS_STYLES[o.status]}>{o.status}</Badge></td>
                    <td className="text-right font-medium">{formatCurrency(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
