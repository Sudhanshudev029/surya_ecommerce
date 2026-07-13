import { useEffect, useState } from 'react';
import { Truck, MapPin, Plus, Trash2 } from 'lucide-react';
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
      .then((r) => {
        const d = r.data.data;
        setForm({
          ratePerKm: d.ratePerKm,
          freeWithinKm: d.freeWithinKm,
          freeAboveAmount: d.freeAboveAmount ?? 0,
          freeTiers: (d.freeTiers || []).map((t) => ({ km: t.km, minAmount: t.minAmount })),
          storeAddress: d.storeAddress || '',
          storeLat: d.storeLat,
          storeLng: d.storeLng,
        });
      })
      .catch(showApiError);
  }, []);

  if (!form) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;

  const addTier = () => setForm((f) => ({ ...f, freeTiers: [...f.freeTiers, { km: '', minAmount: '' }] }));
  const removeTier = (i) => setForm((f) => ({ ...f, freeTiers: f.freeTiers.filter((_, idx) => idx !== i) }));
  const setTier = (i, key, val) =>
    setForm((f) => ({ ...f, freeTiers: f.freeTiers.map((t, idx) => (idx === i ? { ...t, [key]: val } : t)) }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const freeTiers = form.freeTiers
        .map((t) => ({ km: Number(t.km), minAmount: Number(t.minAmount) }))
        .filter((t) => t.km > 0 && t.minAmount >= 0);
      const { data } = await deliveryApi.saveSettings({
        ratePerKm: Number(form.ratePerKm) || 0,
        freeWithinKm: Number(form.freeWithinKm) || 0,
        freeAboveAmount: Number(form.freeAboveAmount) || 0,
        freeTiers,
        storeAddress: form.storeAddress,
        storeLat: form.storeLat,
        storeLng: form.storeLng,
      });
      setForm((f) => ({ ...f, ...data.data }));
      toast.success('Delivery settings saved');
    } catch (e2) { showApiError(e2); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">Manage Delivery</h1>
      <p className="mb-5 text-sm text-gray-500">Charge delivery by distance, with flexible free-delivery rules.</p>

      <form onSubmit={save} className="card space-y-6 p-5">
        {/* Base rate + unconditional free radius */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Rate per km (₹)</label>
            <input type="number" min="0" step="0.5" value={form.ratePerKm}
              onChange={(e) => setForm({ ...form, ratePerKm: e.target.value })} className="input" />
            <p className="mt-1 text-xs text-gray-500">Charge per km. Set <b>0</b> for always-free delivery.</p>
          </div>
          <div>
            <label className="label">Free delivery within (km)</label>
            <input type="number" min="0" step="0.5" value={form.freeWithinKm}
              onChange={(e) => setForm({ ...form, freeWithinKm: e.target.value })} className="input" />
            <p className="mt-1 text-xs text-gray-500">Free within this distance (any order value). <b>0</b> = off.</p>
          </div>
        </div>

        {/* Free above amount (any distance) */}
        <div>
          <label className="label">Free delivery for orders above (₹)</label>
          <input type="number" min="0" step="50" value={form.freeAboveAmount}
            onChange={(e) => setForm({ ...form, freeAboveAmount: e.target.value })} className="input sm:w-64" />
          <p className="mt-1 text-xs text-gray-500">Orders at or above this value ship free from <b>any</b> distance. <b>0</b> = off.</p>
        </div>

        {/* Distance + amount rules */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">Free-delivery rules (distance + order value)</label>
            <button type="button" onClick={addTier} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              <Plus className="h-4 w-4" /> Add rule
            </button>
          </div>
          <p className="mb-2 text-xs text-gray-500">Delivery is free when the address is within the km <b>and</b> the order value is at least ₹.</p>

          {form.freeTiers.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-400">
              No rules yet. e.g. within 5 km &amp; ≥ ₹1000, within 7 km &amp; ≥ ₹1200.
            </p>
          )}

          <div className="space-y-2">
            {form.freeTiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Within</span>
                <input type="number" min="0" step="0.5" value={t.km} onChange={(e) => setTier(i, 'km', e.target.value)}
                  className="input w-24" placeholder="km" />
                <span className="text-sm text-gray-500">km &amp; order ≥ ₹</span>
                <input type="number" min="0" step="50" value={t.minAmount} onChange={(e) => setTier(i, 'minAmount', e.target.value)}
                  className="input w-28" placeholder="amount" />
                <button type="button" onClick={() => removeTier(i)} className="text-gray-400 hover:text-red-600" aria-label="Remove rule">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Store location */}
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

        <button disabled={saving} className="btn-primary"><Truck className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}</button>
      </form>
    </div>
  );
}
