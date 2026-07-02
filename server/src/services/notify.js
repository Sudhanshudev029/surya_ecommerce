import { env } from '../config/env.js';

const telegramEnabled = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function buildOrderMessage(order) {
  const items = order.items
    .map((i) => `• ${i.name} x${i.quantity} — ${money(i.lineTotal)}`)
    .join('\n');
  const s = order.shipping;
  const addr = `${s.line1}${s.line2 ? ', ' + s.line2 : ''}, ${s.city}${s.state ? ', ' + s.state : ''} - ${s.pincode}`;
  return (
    `🛒 New Order #${order.orderNumber}\n` +
    `Customer: ${s.recipient} (${s.phone})\n\n` +
    `Items:\n${items}\n\n` +
    `Total: ${money(order.total)} (${String(order.paymentMethod).toUpperCase()})\n` +
    `Deliver to: ${addr}`
  );
}

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Telegram HTTP ${res.status}: ${body.slice(0, 160)}`);
}

/**
 * Notify the store owner about a new order via Telegram.
 * Fire-and-forget: never throws, never blocks the order flow.
 */
export async function notifyNewOrder(order) {
  if (!telegramEnabled) {
    console.warn('ℹ️  Order notify skipped — set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID to enable.');
    return;
  }
  try {
    await sendTelegram(buildOrderMessage(order));
    console.log(`📲 Telegram notification sent for order #${order.orderNumber}`);
  } catch (err) {
    console.error('⚠️  Order notification failed:', err.message);
  }
}
