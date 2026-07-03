import nodemailer from 'nodemailer';
import { env, isProd } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const mailEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transporter = mailEnabled
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

/**
 * Send an email. In development, if SMTP isn't configured, the message is
 * logged to the server console (so you can grab OTPs without a mail provider).
 * In production, an unconfigured mailer is a hard error.
 */
export async function sendMail({ to, subject, html, text }) {
  if (!mailEnabled) {
    if (!isProd) {
      console.log(`\n📧 [DEV EMAIL] To: ${to}\n   Subject: ${subject}\n   ${text}\n`);
      return;
    }
    throw new ApiError(503, 'Email service is not configured (set SMTP_* env vars).');
  }
  await transporter.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
}
