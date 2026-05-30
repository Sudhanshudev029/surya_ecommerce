import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { productApi, adminApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';

export default function AdminInventory() {
  const [products, setProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([productApi.adminList({ limit: 48 }), adminApi.lowStock()])
      .then(([p, l]) => { setProducts(p.data.data.items); setLowStock(l.data.data); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const lowIds = new Set(lowStock.map((l) => l.productId));

  const save = async (id) => {
    const qty = drafts[id];
    if (qty === undefined) return;
    try {
      await adminApi.setStock(id, { quantity: Number(qty) });
      toast.success('Stock updated');
      setDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
      load();
    } catch (e) { showApiError(e); }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Inventory</h1>

      {lowStock.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-medium text-amber-800"><AlertTriangle className="h-4 w-4" /> Low stock ({lowStock.length})</p>
          <p className="mt-1 text-sm text-amber-700">{lowStock.map((l) => `${l.name} (${l.quantity})`).join(', ')}</p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr><th className="p-3">Product</th><th>Unit</th><th>Current</th><th>Set new quantity</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}{lowIds.has(p.id) && <Badge className="ml-2 bg-amber-100 text-amber-700">Low</Badge>}</td>
                <td>{p.unit}</td>
                <td>{p.stock}</td>
                <td className="pr-3">
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" defaultValue={p.stock}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      className="input w-28 py-1" />
                    <button onClick={() => save(p.id)} disabled={drafts[p.id] === undefined} className="btn-primary !py-1.5"><Check className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
