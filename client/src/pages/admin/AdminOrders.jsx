import { useEffect, useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import { formatCurrency, formatDate, STATUS_STYLES } from '../../utils/format.js';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [data, setData] = useState({ items: [], totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.orders({ status: filter || undefined, search: search || undefined, page, limit: 15 })
      .then((r) => setData(r.data.data)).finally(() => setLoading(false));
  }, [filter, search, page]);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    try { const { data } = await adminApi.order(id); setDetail(data.data); }
    catch (e) { showApiError(e); }
  };

  const updateStatus = async (id, status) => {
    try {
      await adminApi.updateOrderStatus(id, status);
      toast.success('Status updated');
      load();
      if (detail?.id === id) setDetail((d) => ({ ...d, status }));
    } catch (e) { showApiError(e); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Orders</h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by customer name or email..."
              className="input w-64 pl-9"
            />
          </div>
          <select value={filter} onChange={(e) => { setPage(1); setFilter(e.target.value); }} className="input w-auto">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr><th className="p-3">Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th>Update</th></tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3"><button onClick={() => openDetail(o.id)} className="font-medium text-brand-700 hover:underline">#{o.orderNumber}</button></td>
                  <td>{o.customer?.name}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{formatCurrency(o.total)}</td>
                  <td><Badge className={STATUS_STYLES[o.status]}>{o.status}</Badge></td>
                  <td className="pr-3">
                    <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} className="input w-auto py-1 text-xs">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">No orders.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-outline">Prev</button>
          <span className="text-sm">Page {page} of {data.totalPages}</span>
          <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="btn-outline">Next</button>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Order #${detail.orderNumber}` : ''}>
        {detail && (
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">Customer: </span>{detail.customer?.name} ({detail.customer?.email})</div>
            <div>
              <p className="font-medium">Ship to</p>
              <p className="text-gray-600">{detail.shipping.recipient} · {detail.shipping.phone}</p>
              <p className="text-gray-600">{detail.shipping.line1}{detail.shipping.line2 ? `, ${detail.shipping.line2}` : ''}, {detail.shipping.city} - {detail.shipping.pincode}</p>
            </div>
            <div className="border-t pt-2">
              {detail.items?.map((it) => (
                <div key={it.productId || it.name} className="flex justify-between py-1">
                  <span className="text-gray-600">{it.name} × {it.quantity}</span><span>{formatCurrency(it.lineTotal)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{formatCurrency(detail.total)}</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
