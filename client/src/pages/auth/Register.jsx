import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { register } from '../../features/auth/authSlice.js';
import { showApiError } from '../../api/axios.js';

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.phone) delete payload.phone;
      await dispatch(register(payload)).unwrap();
      navigate('/');
    } catch (e2) { showApiError(e2); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card p-6">
        <h1 className="mb-1 text-xl font-bold">Create account</h1>
        <p className="mb-5 text-sm text-gray-500">Join Surya Store to start ordering</p>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Full name</label><input required value={form.fullName} onChange={set('fullName')} className="input" /></div>
          <div><label className="label">Email</label><input type="email" required value={form.email} onChange={set('email')} className="input" /></div>
          <div><label className="label">Phone (optional)</label><input value={form.phone} onChange={set('phone')} className="input" /></div>
          <div><label className="label">Password</label><input type="password" required minLength={6} value={form.password} onChange={set('password')} className="input" /></div>
          <button disabled={loading} className="btn-primary w-full">{loading ? 'Creating...' : 'Register'}</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account? <Link to="/login" className="font-medium text-brand-700 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
