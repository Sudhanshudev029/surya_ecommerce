import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import * as ctrl from './auth.controller.js';
import {
  registerSchema, loginSchema, updateProfileSchema, changePasswordSchema,
  sendOtpSchema, resetPasswordSchema,
} from './auth.schema.js';

const router = Router();

router.post('/register/send-otp', authLimiter, validate(sendOtpSchema), ctrl.sendRegisterOtp);
router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/forgot-password/send-otp', authLimiter, validate(sendOtpSchema), ctrl.sendForgotOtp);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), ctrl.resetPassword);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.get('/me', requireAuth, ctrl.me);
router.patch('/profile', requireAuth, validate(updateProfileSchema), ctrl.updateProfile);
router.post('/change-password', requireAuth, validate(changePasswordSchema), ctrl.changePassword);

export default router;
