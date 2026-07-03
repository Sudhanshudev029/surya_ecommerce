import { query } from '../config/db.js';

// Straight-line distances are ~1.3× shorter than road distances; scale up so the
// charge reflects real travel more closely.
const ROAD_FACTOR = 1.3;

export async function getDeliverySettings() {
  const { rows } = await query('SELECT * FROM delivery_settings WHERE id = 1');
  return rows[0] || { rate_per_km: 0, free_within_km: 0, store_lat: null, store_lng: null, store_address: '' };
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

/**
 * Quote the delivery fee for a destination.
 * Rule: free when distance <= free_within_km; otherwise rate_per_km × distance.
 * (free_within_km = 0 → never free; rate_per_km = 0 → always free.)
 */
export async function quoteDelivery(destLat, destLng) {
  const s = await getDeliverySettings();
  const ratePerKm = Number(s.rate_per_km) || 0;
  const freeWithinKm = Number(s.free_within_km) || 0;

  const haveCoords =
    s.store_lat != null && s.store_lng != null && destLat != null && destLng != null;

  if (!haveCoords || ratePerKm <= 0) {
    // No coordinates (e.g. manually typed address) or no rate configured → free.
    return { distanceKm: haveCoords ? undefined : null, deliveryFee: 0, ratePerKm, freeWithinKm, computed: false };
  }

  const straight = haversineKm(Number(s.store_lat), Number(s.store_lng), Number(destLat), Number(destLng));
  const distanceKm = Math.round(straight * ROAD_FACTOR * 10) / 10; // 1 decimal

  const deliveryFee = (freeWithinKm > 0 && distanceKm <= freeWithinKm)
    ? 0
    : Math.ceil(ratePerKm * distanceKm);

  return { distanceKm, deliveryFee, ratePerKm, freeWithinKm, computed: true };
}
