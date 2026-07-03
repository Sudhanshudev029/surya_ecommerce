import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  ADMIN_EMAIL: z.string().email().default('admin@suryastore.com'),
  ADMIN_PASSWORD: z.string().min(6).default('Admin@123'),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  // Order notifications — Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_CHAT_ID: z.string().optional().default(''),
  // Email — Brevo HTTP API (works locally and on cloud hosts that block SMTP)
  BREVO_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default(''),   // "Surya Store <no-reply@x.com>" — a verified Brevo sender
  SMTP_FROM: z.string().optional().default(''),   // legacy alias for MAIL_FROM
  // Address autocomplete / geocoding — Ola Maps (India-accurate, POI support)
  OLA_MAPS_API_KEY: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
