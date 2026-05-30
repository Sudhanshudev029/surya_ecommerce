import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok, created } from '../../utils/response.js';
import * as authService from './auth.service.js';

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
