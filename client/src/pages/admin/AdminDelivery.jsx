import { useEffect, useState } from 'react';
import { Truck, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { deliveryApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import Spinner from '../../components/ui/Spinner.jsx';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';

export default function AdminDelivery() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    deliveryApi.getSettings()
      .then((r) => setForm({
        ratePerKm: r.data.data.ratePerKm,
        freeWithinKm: r.data.data.freeWithinKm,
        storeAddress: r.data.data.storeAddress || '',
        storeLat: r.data.data.storeLat,
        storeLng: r.data.data.storeLng,
      }))
      .catch(showApiError);
  }, []);

  if (!form) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await deliveryApi.saveSettings({
        ratePerKm: Number(form.ratePerKm) || 0,
        freeWithinKm: Number(form.freeWithinKm) || 0,
        storeAddress: form.storeAddress,
        storeLat: form.storeLat,
        storeLng: form.storeLng,
      });
      setForm((f) => ({ ...f, ...data.data }));
      toast.success('Delivery settings saved');
    } catch (e2) { showApiError(e2); } finally { setSaving(false); }
  };

  const rate = Number(form.ratePerKm) || 0;
  const freeKm = Number(form.freeWithinKm) || 0;
  const exampleFee = freeKm >= 5 ? '₹0 (free)' : `₹${Math.ceil(rate * 5)}`;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Manage Delivery</h1>
      <p className="mb-5 text-sm text-gray-500">Charge delivery based on the distance from your store to the customer's address.</p>

      <form onSubmit={save} className="card space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Rate per km (₹)</label>
            <input type="number" min="0" step="0.5" value={form.ratePerKm}
              onChange={(e) => setForm({ ...form, ratePerKm: e.target.value })} className="input" />
            <p className="mt-1 text-xs text-gray-500">Charge per km. Set <b>0</b> to make delivery always free.</p>
          </div>
          <div>
            <label className="label">Free delivery within (km)</label>
            <input type="number" min="0" step="0.5" value={form.freeWithinKm}
              onChange={(e) => setForm({ ...form, freeWithinKm: e.target.value })} className="input" />
            <p className="mt-1 text-xs text-gray-500">Orders within this distance ship free. <b>0</b> = no free radius.</p>
          </div>
        </div>

        <div>
          <label className="label flex items-center gap-1"><MapPin className="h-4 w-4" /> Store location</label>
          <AddressAutocomplete
            value={form.storeAddress}
            onChange={(v) => setForm((f) => ({ ...f, storeAddress: v }))}
            onPick={(addr) => setForm((f) => ({
              ...f,
              storeAddress: [addr.line1, addr.city, addr.pincode].filter(Boolean).join(', ') || f.storeAddress,
              storeLat: addr.lat ?? f.storeLat,
              storeLng: addr.lng ?? f.storeLng,
            }))}
            className="input"
            placeholder="Search your store address"
          />
          <p className="mt-1 text-xs text-gray-500">
            {form.storeLat != null && form.storeLng != null
              ? `📍 Location set (${Number(form.storeLat).toFixed(4)}, ${Number(form.storeLng).toFixed(4)}) — distances are measured from here.`
              : '⚠️ No coordinates yet — search and pick your store above so distances are accurate.'}
          </p>
        </div>

        <div className="rounded-lg bg-brand-50 p-3 text-xs text-brand-800">
          With these settings, a <b>5 km</b> delivery costs <b>{exampleFee}</b>
          {freeKm > 0 && rate > 0 ? ` (free within ${freeKm} km, then ₹${rate}/km).` : '.'}
        </div>

        <button disabled={saving} className="btn-primary"><Truck className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}</button>
      </form>
    </div>
  );
}
