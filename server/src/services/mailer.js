import { env, isProd } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const brevoEnabled = Boolean(env.BREVO_API_KEY);

// Parse "Surya Store <no-reply@x.com>" into { name, email }.
function parseFrom() {
  const from = env.MAIL_FROM || env.SMTP_FROM || 'Surya Store <no-reply@example.com>';
  const m = from.match(/^(.*?)\s*<(.+?)>$/);
  if (m) return { name: (m[1] || 'Surya Store').trim(), email: m[2].trim() };
  return { name: 'Surya Store', email: from.trim() };
}

// Send via Brevo's HTTP API (HTTPS :443 — reliable locally and on cloud hosts).
async function sendViaBrevo({ to, subject, html, text }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseFrom(),
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Brevo send failed ${res.status}: ${body.slice(0, 400)}`);
    throw new ApiError(502, 'Could not send the email. Please try again shortly.', {
      reason: `Brevo ${res.status}: ${body.slice(0, 200)}`,
    });
  }
}

/**
 * Send an email via Brevo. In development, if BREVO_API_KEY isn't set, the
 * message is logged to the server console so you can grab OTPs without a
 * provider. In production, an unconfigured mailer is a hard error.
 */
export async function sendMail({ to, subject, html, text }) {
  if (brevoEnabled) return sendViaBrevo({ to, subject, html, text });
  if (!isProd) {
    console.log(`\n📧 [DEV EMAIL] To: ${to}\n   Subject: ${subject}\n   ${text}\n`);
    return;
  }
  throw new ApiError(503, 'Email service is not configured (set BREVO_API_KEY).');
}
