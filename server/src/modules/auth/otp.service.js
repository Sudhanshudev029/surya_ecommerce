import crypto from 'node:crypto';
import { query } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { sendMail } from '../../services/mailer.js';

const OTP_TTL_SECONDS = 60;   // valid for 1 minute
const WINDOW_HOURS = 8;       // rate-limit window (per email + purpose)
const MAX_ATTEMPTS = 5;       // wrong-code guesses before an OTP is locked

const genCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

function otpEmail(code, purpose) {
  const heading = purpose === 'reset' ? 'Reset your password' : 'Verify your email';
  const line = purpose === 'reset'
    ? 'Use this code to reset your Surya Store password.'
    : 'Use this code to finish creating your Surya Store account.';
  const html = `
    <div style="font-family:sans-serif;max-width:420px;margin:auto">
      <h2 style="color:#16a34a">🛒 Surya Store</h2>
      <p style="font-size:15px">${heading}</p>
      <p style="color:#555">${line}</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f0fdf4;color:#166534;
                  text-align:center;padding:16px;border-radius:10px;margin:16px 0">${code}</div>
      <p style="color:#888;font-size:13px">This code expires in 1 minute. If you didn't request it, ignore this email.</p>
    </div>`;
  return {
    subject: purpose === 'reset' ? 'Reset your Surya Store password' : 'Verify your email — Surya Store',
    html,
    text: `Your Surya Store OTP is ${code}. It expires in 1 minute.`,
  };
}

/** Generate, store (hashed), and email an OTP. Enforces the send rate limit. */
export async function sendOtp(email, purpose) {
  // Rate limit is disabled when OTP_MAX_PER_WINDOW is 0 (default in dev).
  const maxPerWindow = env.OTP_MAX_PER_WINDOW;
  if (maxPerWindow > 0) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM email_otps
       WHERE email = $1 AND purpose = $2 AND created_at > now() - ($3 || ' hours')::interval`,
      [email, purpose, String(WINDOW_HOURS)],
    );
    if (rows[0].c >= maxPerWindow) {
      throw new ApiError(429,
        `Too many OTP requests. You can request up to ${maxPerWindow} codes every ${WINDOW_HOURS} hours. Please try again later.`);
    }
  }

  const code = genCode();
  const codeHash = await hashPassword(code);
  await query(
    `INSERT INTO email_otps (email, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' seconds')::interval)`,
    [email, purpose, codeHash, String(OTP_TTL_SECONDS)],
  );

  const { subject, html, text } = otpEmail(code, purpose);
  await sendMail({ to: email, subject, html, text });
  return { expiresInSeconds: OTP_TTL_SECONDS };
}

/** Validate a submitted OTP. Returns the otp id (call consumeOtp after success). */
export async function verifyOtp(email, purpose, code) {
  const { rows } = await query(
    `SELECT * FROM email_otps
     WHERE email = $1 AND purpose = $2 AND consumed = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose],
  );
  const otp = rows[0];
  if (!otp) throw ApiError.badRequest('Please request an OTP first.');
  if (new Date(otp.expires_at) < new Date()) throw ApiError.badRequest('Your OTP has expired. Please resend it.');
  if (otp.attempts >= MAX_ATTEMPTS) throw ApiError.badRequest('Too many incorrect attempts. Please resend the OTP.');

  const ok = await comparePassword(String(code), otp.code_hash);
  if (!ok) {
    await query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    throw ApiError.badRequest('Incorrect OTP. Please try again.');
  }
  return otp.id;
}

export async function consumeOtp(otpId) {
  await query('UPDATE email_otps SET consumed = TRUE WHERE id = $1', [otpId]);
}
