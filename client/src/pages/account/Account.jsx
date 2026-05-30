import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Package, MapPin, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../api/endpoints.js';
import { setUser } from '../../features/auth/authSlice.js';
import { showApiError } from '../../api/axios.js';

export default function Account() {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const [form, setForm] = useState({ fullName: user.fullName, phone: user.phone || '' });
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authApi.updateProfile(form);
      dispatch(setUser(data.data.user));
      toast.success('Profile updated');
    } catch (e2) { showApiError(e2); } finally { setSaving(false); }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">My Account</h1>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          <Link to="/account" className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700"><User className="h-4 w-4" /> Profile</Link>
          <Link to="/account/orders" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><Package className="h-4 w-4" /> My Orders</Link>
          <Link to="/account/addresses" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><MapPin className="h-4 w-4" /> Addresses</Link>
        </nav>

        <div className="card max-w-md p-5">
          <h2 className="mb-4 font-semibold">Profile Details</h2>
          <form onSubmit={save} className="space-y-4">
            <div><label className="label">Full name</label><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="input" /></div>
            <div><label className="label">Email</label><input value={user.email} disabled className="input bg-gray-50" /></div>
            <div><label className="label">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></div>
            <button disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
