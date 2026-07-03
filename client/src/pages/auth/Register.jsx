import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Check, X, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { register } from '../../features/auth/authSlice.js';
import { authApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import { useCountdown } from '../../hooks/useCountdown.js';

const validators = {
  fullName: (v) => {
    const s = v.trim();
    if (!s) return 'Name is required';
    if (s.length < 5) return 'Name must be at least 5 characters';
    if (s.length > 30) return 'Name must be at most 30 characters';
    return '';
  },
  email: (v) => {
    if (!v.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address';
    return '';
  },
  phone: (v) => {
    const s = v.replace(/[\s-]/g, '');
    if (!s) return 'Phone number is required';
    if (!/^(?:\+?91)?[6-9]\d{9}$/.test(s)) return 'Enter a valid 10-digit mobile number';
    return '';
  },
  password: (v) => (passwordRules.every((r) => r.test(v)) ? '' : 'Password does not meet all requirements'),
};

const passwordRules = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a–z)', test: (v) => /[a-z]/.test(v) },
  { label: 'One number (0–9)', test: (v) => /[0-9]/.test(v) },
  { label: 'One special character (!@#$…)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const { seconds, start } = useCountdown();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const setField = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (touched[k]) setErrors((er) => ({ ...er, [k]: validators[k](value) }));
  };
  const onBlur = (k) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors((er) => ({ ...er, [k]: validators[k](form[k]) }));
  };

  const validateAll = () => {
    const next = {};
    for (const k of Object.keys(validators)) { const m = validators[k](form[k]); if (m) next[k] = m; }
    setErrors(next);
    setTouched({ fullName: true, email: true, phone: true, password: true });
    return Object.keys(next).length === 0;
  };

  const sendOtp = async () => {
    setSending(true);
    try {
      await authApi.sendRegisterOtp(form.email.trim());
      start(60);
      setStep('otp');
      toast.success('OTP sent to your email');
    } catch (e) { showApiError(e); } finally { setSending(false); }
  };

  const onContinue = (e) => { e.preventDefault(); if (validateAll()) sendOtp(); };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast.error('Enter the 6-digit code'); return; }
    setCreating(true);
    try {
      await dispatch(register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.replace(/[\s-]/g, ''),
        password: form.password,
        otp,
      })).unwrap();
      navigate('/');
    } catch (e2) { showApiError(e2); } finally { setCreating(false); }
  };

  const inputClass = (k) => `input ${errors[k] ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`;
  const showChecklist = touched.password || form.password.length > 0;

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card p-6">
        {step === 'form' ? (
          <>
            <h1 className="mb-1 text-xl font-bold">Create account</h1>
            <p className="mb-5 text-sm text-gray-500">Join Surya Store to start ordering</p>
            <form onSubmit={onContinue} noValidate className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input value={form.fullName} onChange={setField('fullName')} onBlur={onBlur('fullName')} className={inputClass('fullName')} />
                {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={setField('email')} onBlur={onBlur('email')} className={inputClass('email')} />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
              <div>
                <label className="label">Phone number</label>
                <input type="tel" value={form.phone} onChange={setField('phone')} onBlur={onBlur('phone')} className={inputClass('phone')} />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" value={form.password} onChange={setField('password')} onBlur={onBlur('password')} className={inputClass('password')} />
                {showChecklist && (
                  <ul className="mt-2 space-y-1">
                    {passwordRules.map((r) => {
                      const ok = r.test(form.password);
                      return (
                        <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-500'}`}>
                          {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 text-gray-300" />}
                          {r.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <button disabled={sending} className="btn-primary w-full">{sending ? 'Sending OTP…' : 'Continue'}</button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
              Already have an account? <Link to="/login" className="font-medium text-brand-700 hover:underline">Login</Link>
            </p>
          </>
        ) : (
          <>
            <button onClick={() => setStep('form')} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
              <ChevronLeft className="h-4 w-4" /> Edit details
            </button>
            <h1 className="mb-1 text-xl font-bold">Verify your email</h1>
            <p className="mb-5 text-sm text-gray-500">Enter the 6-digit code sent to <strong>{form.email.trim()}</strong></p>
            <form onSubmit={onCreate} noValidate className="space-y-4">
              <div>
                <label className="label">OTP</label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="______"
                  className="input text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>
              <button disabled={creating} className="btn-primary w-full">{creating ? 'Creating account…' : 'Verify & Create Account'}</button>
            </form>
            <div className="mt-4 text-center text-sm text-gray-500">
              {seconds > 0 ? (
                <span>Resend code in <strong>{seconds}s</strong></span>
              ) : (
                <button onClick={sendOtp} disabled={sending} className="font-medium text-brand-700 hover:underline disabled:opacity-50">
                  {sending ? 'Sending…' : 'Resend OTP'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
