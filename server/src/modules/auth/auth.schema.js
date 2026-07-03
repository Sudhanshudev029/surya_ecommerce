import { z } from 'zod';

// Normalize any phone input to a canonical 10-digit number (strips +91 / spaces).
const normalizePhone = (v) => {
  if (typeof v !== 'string') return v;
  const d = v.replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};
const tenDigitMobile = /^[6-9]\d{9}$/; // Indian mobile after normalization

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().trim()
      .min(5, 'Name must be at least 5 characters')
      .max(30, 'Name must be at most 30 characters'),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.preprocess(
      normalizePhone,
      z.string().regex(tenDigitMobile, 'Enter a valid 10-digit mobile number'),
    ),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password is too long')
      .regex(/[a-z]/, 'Password must include a lowercase letter')
      .regex(/[A-Z]/, 'Password must include an uppercase letter')
      .regex(/[0-9]/, 'Password must include a number')
      .regex(/[^A-Za-z0-9]/, 'Password must include a special character'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(1, 'Phone number is required'), // phone (or admin email)
    password: z.string().min(1, 'Password is required'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(120).optional(),
    // phone is intentionally NOT updatable — it's a login credential.
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6).max(72),
  }),
});
