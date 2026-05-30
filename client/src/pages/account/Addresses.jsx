import { useEffect, useState } from 'react';
import { MapPin, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { addressApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import Spinner from '../../components/ui/Spinner.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import AddressForm from '../../components/AddressForm.jsx';

export default function Addresses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // address or 'new'

  const load = () => addressApi.list().then((r) => setList(r.data.data));
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const remove = async (id) => {
    try { await addressApi.remove(id); await load(); toast.success('Address deleted'); }
    catch (e) { showApiError(e); }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Saved Addresses</h1>
        {!editing && <button onClick={() => setEditing('new')} className="btn-primary">+ Add Address</button>}
      </div>

      {editing && (
        <div className="card mb-4 p-5">
          <AddressForm
            initial={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => { await load(); setEditing(null); toast.success('Address saved'); }}
          />
        </div>
      )}

      {list.length === 0 && !editing ? (
        <EmptyState icon={MapPin} title="No saved addresses" />
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="card flex items-start justify-between p-4">
              <div className="text-sm">
                <p className="font-medium">
                  {a.recipient} · {a.phone}
                  {a.isDefault && <Badge className="ml-2 bg-brand-100 text-brand-700">Default</Badge>}
                </p>
                <p className="text-gray-600">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}{a.state ? `, ${a.state}` : ''} - {a.pincode}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(a)} className="text-gray-400 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(a.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
