import { query } from '../config/db.js';

// Straight-line distances are ~1.3× shorter than road distances; scale up so the
// charge reflects real travel more closely.
const ROAD_FACTOR = 1.3;

export async function getDeliverySettings() {
  const { rows } = await query('SELECT * FROM delivery_settings WHERE id = 1');
  return rows[0] || {
    rate_per_km: 0, free_within_km: 0, free_above_amount: 0, free_tiers: [],
    store_lat: null, store_lng: null, store_address: '',
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const cleanTiers = (raw) => (Array.isArray(raw) ? raw : [])
  .map((t) => ({ km: Number(t.km), minAmount: Number(t.minAmount) }))
  .filter((t) => Number.isFinite(t.km) && t.km > 0 && Number.isFinite(t.minAmount) && t.minAmount >= 0);

/**
 * Quote the delivery fee for a destination and order subtotal.
 * Delivery is FREE if ANY of these hold:
 *   - subtotal >= free_above_amount            (any distance)
 *   - distance <= free_within_km               (any amount)
 *   - a tier matches: distance <= km AND subtotal >= minAmount
 * Otherwise: rate_per_km × distance (rounded up).
 */
export async function quoteDelivery(destLat, destLng, subtotal = 0) {
  const s = await getDeliverySettings();
  const ratePerKm = Number(s.rate_per_km) || 0;
  const freeWithinKm = Number(s.free_within_km) || 0;
  const freeAboveAmount = Number(s.free_above_amount) || 0;
  const tiers = cleanTiers(s.free_tiers);
  const amount = Number(subtotal) || 0;

  const haveCoords =
    s.store_lat != null && s.store_lng != null && destLat != null && destLng != null;
  const distanceKm = haveCoords
    ? Math.round(haversineKm(Number(s.store_lat), Number(s.store_lng), Number(destLat), Number(destLng)) * ROAD_FACTOR * 10) / 10
    : null;

  // Figure out whether delivery is free, and why.
  let freeReason = null;
  if (freeAboveAmount > 0 && amount >= freeAboveAmount) freeReason = 'total';
  else if (distanceKm != null && freeWithinKm > 0 && distanceKm <= freeWithinKm) freeReason = 'radius';
  else if (distanceKm != null && tiers.some((t) => distanceKm <= t.km && amount >= t.minAmount)) freeReason = 'tier';

  let deliveryFee = 0;
  let computed = false;
  if (freeReason) {
    computed = true; // known to be free
  } else if (distanceKm != null && ratePerKm > 0) {
    deliveryFee = Math.ceil(ratePerKm * distanceKm);
    computed = true;
  }
  // else: no coords or no rate → free by default (computed = false)

  return { deliveryFee, distanceKm, computed, free: deliveryFee === 0, freeReason, ratePerKm, freeWithinKm, freeAboveAmount };
}
