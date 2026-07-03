import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login } from '../../features/auth/authSlice.js';
import { loadCart } from '../../features/cart/cartSlice.js';
import { showApiError } from '../../api/axios.js';

// Validate as a 10-digit mobile. An email is also accepted so the store
// owner/admin (who signs in with email) isn't locked out of the dashboard.
const validateIdentifier = (v) => {
  const s = v.trim();
  if (!s) return 'Phone number is required';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return '';
  const phone = s.replace(/[\s-]/g, '');
  if (!/^(?:\+?91)?[6-9]\d{9}$/.test(phone)) return 'Enter a valid 10-digit mobile number';
  return '';
};

export default function Login() {
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const setField = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (k === 'identifier' && touched.identifier) {
      setErrors((er) => ({ ...er, identifier: validateIdentifier(value) }));
    }
  };
  const onBlurId = () => {
    setTouched((t) => ({ ...t, identifier: true }));
    setErrors((er) => ({ ...er, identifier: validateIdentifier(form.identifier) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const idErr = validateIdentifier(form.identifier);
    const pwErr = form.password ? '' : 'Password is required';
    if (idErr || pwErr) {
      setErrors({ identifier: idErr, password: pwErr });
      setTouched({ identifier: true, password: true });
      return;
    }
    setLoading(true);
    try {
      const user = await dispatch(login({ identifier: form.identifier.trim(), password: form.password })).unwrap();
      await dispatch(loadCart()); // merge the guest cart into their account before continuing
      navigate(['admin', 'superadmin'].includes(user.role) ? '/admin' : from, { replace: true });
    } catch (e2) {
      showApiError(e2);
    } finally {
      setLoading(false);
    }
  };

  const cls = (k) => `input ${errors[k] ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`;

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card p-6">
        <h1 className="mb-1 text-xl font-bold">Welcome back</h1>
        <p className="mb-5 text-sm text-gray-500">Log in to your Surya Store account</p>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label className="label">Phone number</label>
            <input type="text" value={form.identifier} onChange={setField('identifier')} onBlur={onBlurId} className={cls('identifier')} />
            {errors.identifier && <p className="mt-1 text-xs text-red-600">{errors.identifier}</p>}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              <Link to="/forgot-password" className="mb-1 text-xs font-medium text-brand-700 hover:underline">Forgot password?</Link>
            </div>
            <input type="password" value={form.password} onChange={setField('password')} className={cls('password')} />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>
          <button disabled={loading} className="btn-primary w-full">{loading ? 'Logging in...' : 'Login'}</button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          No account? <Link to="/register" className="font-medium text-brand-700 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
