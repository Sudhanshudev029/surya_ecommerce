import { useState } from 'react';
import { addressApi } from '../api/endpoints.js';
import { showApiError } from '../api/axios.js';

const blank = {
  label: '', recipient: '', phone: '', line1: '', line2: '',
  city: '', state: '', pincode: '', isDefault: false,
};

export default function AddressForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...blank, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      const { data } = initial?.id
        ? await addressApi.update(initial.id, payload)
        : await addressApi.create(payload);
      onSaved?.(data.data);
    } catch (e2) { showApiError(e2); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><label className="label">Recipient name</label><input required value={form.recipient} onChange={set('recipient')} className="input" /></div>
      <div><label className="label">Phone</label><input required value={form.phone} onChange={set('phone')} className="input" /></div>
      <div><label className="label">Label (Home/Shop)</label><input value={form.label} onChange={set('label')} className="input" /></div>
      <div className="col-span-2"><label className="label">Address line 1</label><input required value={form.line1} onChange={set('line1')} className="input" /></div>
      <div className="col-span-2"><label className="label">Address line 2</label><input value={form.line2} onChange={set('line2')} className="input" /></div>
      <div><label className="label">City</label><input required value={form.city} onChange={set('city')} className="input" /></div>
      <div><label className="label">State</label><input value={form.state} onChange={set('state')} className="input" /></div>
      <div><label className="label">Pincode</label><input required value={form.pincode} onChange={set('pincode')} className="input" /></div>
      <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={set('isDefault')} /> Set as default</label>
      <div className="col-span-2 flex gap-2">
        <button disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Address'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>}
      </div>
    </form>
  );
}
