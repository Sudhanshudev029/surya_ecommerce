import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login } from '../../features/auth/authSlice.js';
import { showApiError } from '../../api/axios.js';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await dispatch(login(form)).unwrap();
      navigate(['admin', 'superadmin'].includes(user.role) ? '/admin' : from, { replace: true });
    } catch (e2) { showApiError(e2); } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card p-6">
        <h1 className="mb-1 text-xl font-bold">Welcome back</h1>
        <p className="mb-5 text-sm text-gray-500">Log in to your Surya Store account</p>
        <form onSubmit={submit} className="space-y-4">
          <div><label className="label">Email</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></div>
          <div><label className="label">Password</label><input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" /></div>
          <button disabled={loading} className="btn-primary w-full">{loading ? 'Logging in...' : 'Login'}</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          No account? <Link to="/register" className="font-medium text-brand-700 hover:underline">Register</Link>
        </p>
        <p className="mt-3 rounded-lg bg-gray-50 p-2 text-center text-xs text-gray-400">
          Demo admin: admin@suryastore.com / Admin@123
        </p>
      </div>
    </div>
  );
}
