import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import { query } from '../../config/db.js';
import * as authService from './auth.service.js';
import { sendOtp } from './otp.service.js';

// Send an OTP to verify an email during registration.
export const sendRegisterOtp = asyncHandler(async (req, res) => {
  await sendOtp(req.body.email, 'register');
  ok(res, { expiresInSeconds: 60 }, 'OTP sent to your email');
});

// Send a password-reset OTP. Responds generically to avoid revealing whether
// the email is registered (only actually emails a code if the account exists).
export const sendForgotOtp = asyncHandler(async (req, res) => {
  const { rowCount } = await query('SELECT 1 FROM users WHERE email = $1', [req.body.email]);
  if (rowCount) await sendOtp(req.body.email, 'reset');
  ok(res, { expiresInSeconds: 60 }, 'If an account exists for this email, an OTP has been sent.');
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  ok(res, null, 'Password reset successfully. Please log in.');
});

export const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  created(res, data, 'Registered successfully');
});

export const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  ok(res, data, 'Logged in');
});

export const me = asyncHandler(async (req, res) => {
  ok(res, {
    user: {
      id: req.user.id,
      fullName: req.user.full_name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
    },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body);
  ok(res, { user }, 'Profile updated');
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.id, req.body);
  ok(res, null, 'Password changed');
});
