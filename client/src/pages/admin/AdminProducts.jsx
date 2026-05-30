import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { productApi, categoryApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import { formatCurrency } from '../../utils/format.js';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';

const blank = { name: '', categoryId: '', price: '', mrp: '', unit: '', imageUrl: '', quantity: 0, isFeatured: false, isActive: true };

export default function AdminProducts() {
  const [data, setData] = useState({ items: [], totalPages: 1, page: 1 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | product | 'new'
  const [confirmDel, setConfirmDel] = useState(null); // product pending deletion
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    productApi.adminList({ page, limit: 12, search }).then((r) => setData(r.data.data)).finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { categoryApi.list().then((r) => setCategories(r.data.data)); }, []);
  useEffect(() => { load(); }, [load]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await productApi.remove(confirmDel.id);
      toast.success('Product deleted');
      setConfirmDel(null);
      load();
    } catch (e) { showApiError(e); } finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Products</h1>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search..." className="input w-48" />
          <button onClick={() => setModal('new')} className="btn-primary"><Plus className="h-4 w-4" /> Add</button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr><th className="p-3">Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" />
                      <span className="font-medium">{p.name}</span>
                      {p.isFeatured && <Badge className="bg-brand-100 text-brand-700">★</Badge>}
                    </div>
                  </td>
                  <td>{p.category?.name || '—'}</td>
                  <td>{formatCurrency(p.price)}</td>
                  <td>{p.stock}</td>
                  <td>{p.isActive ? <Badge className="bg-green-100 text-green-700">Active</Badge> : <Badge className="bg-gray-200 text-gray-600">Hidden</Badge>}</td>
                  <td className="pr-3 text-right">
                    <button onClick={() => setModal(p)} className="mr-2 text-gray-400 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setConfirmDel(p)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
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

      <ProductModal
        open={!!modal}
        product={modal === 'new' ? null : modal}
        categories={categories}
        onClose={() => setModal(null)}
        onSaved={() => { setModal(null); load(); }}
      />

      <ConfirmDialog
        open={!!confirmDel}
        danger
        title="Delete product?"
        message={confirmDel ? `"${confirmDel.name}" will be permanently removed from the store. Past orders that include it are kept.` : ''}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}

function ProductModal({ open, product, categories, onClose, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) setForm({
      name: product.name, categoryId: product.category?.id || '', price: product.price,
      mrp: product.mrp ?? '', unit: product.unit || '', imageUrl: product.imageUrl || '',
      quantity: product.stock, isFeatured: product.isFeatured, isActive: product.isActive,
    });
    else setForm(blank);
  }, [product, open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        price: Number(form.price),
        quantity: Number(form.quantity),
        isFeatured: form.isFeatured,
        isActive: form.isActive,
      };
      if (form.categoryId) payload.categoryId = form.categoryId;
      if (form.mrp !== '') payload.mrp = Number(form.mrp);
      if (form.unit) payload.unit = form.unit;
      if (form.imageUrl) payload.imageUrl = form.imageUrl;

      if (product) await productApi.update(product.id, payload);
      else await productApi.create(payload);
      toast.success(product ? 'Product updated' : 'Product created');
      onSaved();
    } catch (e2) { showApiError(e2); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={product ? 'Edit Product' : 'Add Product'}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">Name</label><input required value={form.name} onChange={set('name')} className="input" /></div>
        <div><label className="label">Category</label>
          <select value={form.categoryId} onChange={set('categoryId')} className="input">
            <option value="">— none —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Unit (e.g. 1 L)</label><input value={form.unit} onChange={set('unit')} className="input" /></div>
        <div><label className="label">Price (₹)</label><input type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} className="input" /></div>
        <div><label className="label">MRP (₹)</label><input type="number" min="0" step="0.01" value={form.mrp} onChange={set('mrp')} className="input" /></div>
        <div><label className="label">Stock quantity</label><input type="number" min="0" value={form.quantity} onChange={set('quantity')} className="input" /></div>
        <div className="flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} /> Featured on homepage</label></div>
        <div className="col-span-2 rounded-lg bg-gray-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
            Show on store
          </label>
          <p className="mt-1 pl-6 text-xs text-gray-500">Uncheck to hide this product from customers without deleting it.</p>
        </div>
        <div className="col-span-2"><label className="label">Image URL</label><input value={form.imageUrl} onChange={set('imageUrl')} className="input" placeholder="https://... (or upload via Cloudinary)" /></div>
        <div className="col-span-2 flex gap-2">
          <button disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
