import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, X, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import { useCountdown } from '../../hooks/useCountdown.js';

const passwordRules = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a–z)', test: (v) => /[a-z]/.test(v) },
  { label: 'One number (0–9)', test: (v) => /[0-9]/.test(v) },
  { label: 'One special character (!@#$…)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [pwTouched, setPwTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { seconds, start } = useCountdown();
  const navigate = useNavigate();

  const sendOtp = async () => {
    if (!isEmail(email)) { setEmailErr('Enter a valid email address'); return; }
    setEmailErr('');
    setSending(true);
    try {
      await authApi.forgotPasswordOtp(email.trim());
      start(60);
      setStep('reset');
      toast.success('If an account exists, an OTP has been sent');
    } catch (e) { showApiError(e); } finally { setSending(false); }
  };

  const onReset = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) { toast.error('Enter the 6-digit code'); return; }
    if (!passwordRules.every((r) => r.test(password))) { setPwTouched(true); toast.error('Password does not meet all requirements'); return; }
    setResetting(true);
    try {
      await authApi.resetPassword({ email: email.trim(), otp, newPassword: password });
      toast.success('Password reset. Please log in.');
      navigate('/login');
    } catch (e2) { showApiError(e2); } finally { setResetting(false); }
  };

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="card p-6">
        {step === 'email' ? (
          <>
            <h1 className="mb-1 text-xl font-bold">Forgot password</h1>
            <p className="mb-5 text-sm text-gray-500">Enter your email and we'll send you a reset code.</p>
            <form onSubmit={(e) => { e.preventDefault(); sendOtp(); }} noValidate className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className={`input ${emailErr ? 'border-red-400' : ''}`} />
                {emailErr && <p className="mt-1 text-xs text-red-600">{emailErr}</p>}
              </div>
              <button disabled={sending} className="btn-primary w-full">{sending ? 'Sending…' : 'Send OTP'}</button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-500">
              Remembered it? <Link to="/login" className="font-medium text-brand-700 hover:underline">Login</Link>
            </p>
          </>
        ) : (
          <>
            <button onClick={() => setStep('email')} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
              <ChevronLeft className="h-4 w-4" /> Change email
            </button>
            <h1 className="mb-1 text-xl font-bold">Reset password</h1>
            <p className="mb-4 text-sm text-gray-500">
              If <strong>{email.trim()}</strong> is registered, we've sent a 6-digit OTP to it. Enter the code and your new password below.
            </p>
            <form onSubmit={onReset} noValidate className="space-y-4">
              <div>
                <label className="label">OTP</label>
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" maxLength={6} placeholder="______"
                  className="input text-center text-lg tracking-[0.5em]" autoFocus />
              </div>
              <div>
                <label className="label">New password</label>
                <input type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} onBlur={() => setPwTouched(true)} className="input" />
                {(pwTouched || password) && (
                  <ul className="mt-2 space-y-1">
                    {passwordRules.map((r) => {
                      const ok = r.test(password);
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
              <button disabled={resetting} className="btn-primary w-full">{resetting ? 'Resetting…' : 'Reset Password'}</button>
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
