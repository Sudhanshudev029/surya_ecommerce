import { useState } from 'react';
import { useSelector } from 'react-redux';
import { addressApi } from '../api/endpoints.js';
import { showApiError } from '../api/axios.js';
import SearchableSelect from './ui/SearchableSelect.jsx';
import AddressAutocomplete from './AddressAutocomplete.jsx';

const LABELS = ['Home', 'Shop', 'Office', 'Other'];

const INDIAN_STATES = [
  // States
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
  // Union Territories (names match the Ola Maps geocoder output)
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const PINCODE_RE = /^[1-9][0-9]{5}$/;

const validators = {
  recipient: (v) => (!v.trim() ? 'Recipient name is required' : v.trim().length < 2 ? 'Enter a valid name' : ''),
  phone: (v) => (!v ? 'Phone number is required' : ''),
  label: (v) => (!v ? 'Please select a label' : ''),
  line1: (v) => (!v.trim() ? 'Address is required' : v.trim().length < 5 ? 'Address is too short' : ''),
  state: (v) => (!v ? 'State is required' : ''),
  city: (v) => (!v.trim() ? 'City is required' : ''),
  pincode: (v) => (!v.trim() ? 'Pincode is required' : !PINCODE_RE.test(v.trim()) ? 'Enter a valid 6-digit pincode' : ''),
};

export default function AddressForm({ initial, onSaved, onCancel }) {
  const user = useSelector((s) => s.auth.user);
  const [form, setForm] = useState(() => ({
    label: initial?.label && LABELS.includes(initial.label) ? initial.label : 'Home',
    recipient: initial?.recipient ?? user?.fullName ?? '',
    phone: user?.phone ?? initial?.phone ?? '',   // account phone, read-only
    line1: initial?.line1 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
    isDefault: initial?.isDefault ?? false,
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setField = (k, value) => {
    setForm((f) => ({ ...f, [k]: value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: validators[k] ? validators[k](value) : '' }));
  };
  const onText = (k) => (e) => setField(k, e.target.value);

  // Fill fields from a chosen suggestion / detected location. State is only
  // applied when it matches our supported list (keeps the dropdown valid);
  // city/pincode fill only when they came back empty-or-usable.
  const applyPicked = (addr) => {
    setForm((f) => {
      const next = { ...f, line1: addr.line1 || f.line1 };
      if (addr.city) next.city = addr.city;
      if (addr.pincode && PINCODE_RE.test(addr.pincode)) next.pincode = addr.pincode;
      if (addr.state && INDIAN_STATES.includes(addr.state)) next.state = addr.state;
      return next;
    });
    setErrors((er) => {
      const cleared = { ...er };
      for (const k of ['line1', 'city', 'state', 'pincode']) delete cleared[k];
      return cleared;
    });
  };
  const errClass = (k) => `input ${errors[k] ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`;
  const Err = ({ k }) => (errors[k] ? <p className="mt-1 text-xs text-red-600">{errors[k]}</p> : null);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    for (const k of Object.keys(validators)) {
      const msg = validators[k](form[k]);
      if (msg) next[k] = msg;
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const payload = {
        label: form.label,
        recipient: form.recipient.trim(),
        phone: form.phone,
        line1: form.line1.trim(),
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode.trim(),
        isDefault: form.isDefault,
      };
      const { data } = initial?.id
        ? await addressApi.update(initial.id, payload)
        : await addressApi.create(payload);
      onSaved?.(data.data);
    } catch (e2) {
      showApiError(e2);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-2 gap-3">
      {/* Recipient */}
      <div className="col-span-2">
        <label className="label">Recipient name</label>
        <input value={form.recipient} onChange={onText('recipient')} className={errClass('recipient')} />
        <Err k="recipient" />
      </div>

      {/* Phone (read-only, from account) + Label dropdown */}
      <div>
        <label className="label">Phone</label>
        <input value={form.phone} readOnly className="input cursor-not-allowed bg-gray-50 text-gray-600" />
        <Err k="phone" />
      </div>
      <div>
        <label className="label">Label</label>
        <select value={form.label} onChange={onText('label')} className={errClass('label')}>
          {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <Err k="label" />
      </div>

      {/* Address (single line) */}
      <div className="col-span-2">
        <label className="label">Address</label>
        <AddressAutocomplete
          value={form.line1}
          onChange={(v) => setField('line1', v)}
          onPick={applyPicked}
          className={errClass('line1')}
          placeholder="House / flat, street, area"
        />
        <Err k="line1" />
      </div>

      {/* State (searchable) then City */}
      <div>
        <label className="label">State</label>
        <SearchableSelect
          options={INDIAN_STATES}
          value={form.state}
          onChange={(v) => setField('state', v)}
          placeholder="Select state"
          error={errors.state}
        />
        <Err k="state" />
      </div>
      <div>
        <label className="label">City</label>
        <input value={form.city} onChange={onText('city')} className={errClass('city')} />
        <Err k="city" />
      </div>

      {/* Pincode */}
      <div>
        <label className="label">Pincode</label>
        <input value={form.pincode} onChange={onText('pincode')} inputMode="numeric" maxLength={6} className={errClass('pincode')} />
        <Err k="pincode" />
      </div>

      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setField('isDefault', e.target.checked)} /> Set as default
      </label>

      <div className="col-span-2 flex gap-2">
        <button disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Address'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-outline">Cancel</button>}
      </div>
    </form>
  );
}
