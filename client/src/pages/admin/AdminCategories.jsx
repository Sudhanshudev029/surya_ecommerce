import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import toast from 'react-hot-toast';
import { categoryApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import Spinner from '../../components/ui/Spinner.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';

const blank = { name: '', imageUrl: '' };

export default function AdminCategories() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);       // 'new' | category | null
  const [confirmDel, setConfirmDel] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    categoryApi.list().then((r) => setList(r.data.data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await categoryApi.remove(confirmDel.id);
      toast.success('Category deleted');
      setConfirmDel(null);
      load();
    } catch (e) { showApiError(e); } finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Categories</h1>
        <button onClick={() => setModal('new')} className="btn-primary"><Plus className="h-4 w-4" /> Add</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : list.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet"
          subtitle="Add categories so products can be grouped and shown on the storefront."
          action={<button onClick={() => setModal('new')} className="btn-primary">+ Add Category</button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <div className="aspect-video bg-gray-100">
                {c.image_url
                  ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                  : <div className="flex h-full items-center justify-center text-gray-300"><FolderTree className="h-8 w-8" /></div>}
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.product_count} product(s)</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setModal(c)} className="text-gray-400 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setConfirmDel(c)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryModal
        open={!!modal}
        category={modal === 'new' ? null : modal}
        onClose={() => setModal(null)}
        onSaved={() => { setModal(null); load(); }}
      />

      <ConfirmDialog
        open={!!confirmDel}
        danger
        title="Delete category?"
        message={confirmDel
          ? `"${confirmDel.name}" will be removed. Its ${confirmDel.product_count} product(s) are kept but become uncategorized.`
          : ''}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}

function CategoryModal({ open, category, onClose, onSaved }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) setForm({ name: category.name, imageUrl: category.image_url || '' });
    else setForm(blank);
  }, [category, open]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name };
      if (form.imageUrl) payload.imageUrl = form.imageUrl;
      if (category) await categoryApi.update(category.id, payload);
      else await categoryApi.create(payload);
      toast.success(category ? 'Category updated' : 'Category created');
      onSaved();
    } catch (e2) { showApiError(e2); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Edit Category' : 'Add Category'}>
      <form onSubmit={submit} className="space-y-3">
        <div><label className="label">Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Cooking Oil" /></div>
        <div>
          <label className="label">Image URL</label>
          <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} className="input" placeholder="https://... (optional)" />
        </div>
        {form.imageUrl && <img src={form.imageUrl} alt="" className="h-28 w-full rounded-lg object-cover" />}
        <div className="flex gap-2 pt-1">
          <button disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
