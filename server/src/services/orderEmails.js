import { env } from '../config/env.js';
import { sendMail } from './mailer.js';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const ordersUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/account/orders`;

// Friendly phrasing per status.
const STATUS_LINE = {
  pending: 'has been received and is awaiting confirmation',
  confirmed: 'has been confirmed',
  processing: 'is being prepared',
  shipped: 'is out for delivery',
  delivered: 'has been delivered',
  cancelled: 'has been cancelled',
};

function shell(title, inner) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222">
    <h2 style="color:#16a34a;margin:0 0 4px">🛒 Surya Store</h2>
    <h3 style="margin:12px 0">${title}</h3>
    ${inner}
    <p style="margin-top:20px">
      <a href="${ordersUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px">View my orders</a>
    </p>
    <p style="color:#888;font-size:12px;margin-top:18px">Thank you for shopping with Surya Store.</p>
  </div>`;
}

/** Order confirmation email to the customer when a new order is placed. */
export async function sendOrderConfirmationEmail(order, customer) {
  if (!customer?.email) return;
  try {
    const rows = order.items
      .map((i) => `<tr>
        <td style="padding:4px 0;border-bottom:1px solid #f0f0f0">${i.name} × ${i.quantity}</td>
        <td align="right" style="padding:4px 0;border-bottom:1px solid #f0f0f0">${money(i.lineTotal)}</td></tr>`)
      .join('');
    const s = order.shipping;
    const html = shell(`Order #${order.orderNumber} confirmed 🎉`, `
      <p>Hi ${customer.fullName || 'there'}, thank you for your order! We've received it and will process it shortly.</p>
      <table width="100%" style="border-collapse:collapse;font-size:14px;margin:12px 0">
        ${rows}
        <tr><td style="padding-top:8px"><b>Total (${String(order.paymentMethod).toUpperCase()})</b></td>
            <td align="right" style="padding-top:8px"><b>${money(order.total)}</b></td></tr>
      </table>
      <p style="font-size:13px;color:#555">Deliver to: ${s.recipient} · ${s.phone}<br>
        ${s.line1}${s.line2 ? ', ' + s.line2 : ''}, ${s.city}${s.state ? ', ' + s.state : ''} - ${s.pincode}</p>`);
    await sendMail({
      to: customer.email,
      subject: `Order #${order.orderNumber} confirmed — Surya Store`,
      html,
      text: `Your order #${order.orderNumber} (${money(order.total)}) has been placed and is being processed.`,
    });
  } catch (err) {
    console.error('Order confirmation email failed:', err.message);
  }
}

/** Status-update email to the customer when an admin changes the order status. */
export async function sendOrderStatusEmail(order, customer) {
  if (!customer?.email) return;
  try {
    const line = STATUS_LINE[order.status] || `is now ${order.status}`;
    const html = shell(`Update on order #${order.orderNumber}`, `
      <p>Hi ${customer.fullName || 'there'}, your order <b>#${order.orderNumber}</b> ${line}.</p>
      <p style="font-size:14px">Current status: <b style="color:#16a34a;text-transform:capitalize">${order.status}</b></p>
      <p style="font-size:13px;color:#555">Order total: ${money(order.total)}</p>`);
    await sendMail({
      to: customer.email,
      subject: `Order #${order.orderNumber} is ${order.status} — Surya Store`,
      html,
      text: `Your order #${order.orderNumber} ${line}.`,
    });
  } catch (err) {
    console.error('Order status email failed:', err.message);
  }
}
