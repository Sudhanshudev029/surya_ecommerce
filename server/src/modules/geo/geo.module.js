import { Router } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ok } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { requireAuth } from '../../middleware/auth.js';

// India-accurate geocoding proxied through Ola Maps (Krutrim). The API key
// stays server-side; the browser only ever talks to our own /api/geo/* routes.
// Docs: https://maps.olakrutrim.com/docs
const OLA_BASE = 'https://api.olamaps.io/places/v1';

const router = Router();
router.use(requireAuth);

// 503 upfront if the store hasn't configured a key, so the client can fall back
// to plain manual entry instead of getting an opaque upstream error.
router.use((req, res, next) => {
  if (!env.OLA_MAPS_API_KEY) throw new ApiError(503, 'Address lookup is not configured');
  next();
});

async function olaGet(path, params) {
  const qs = new URLSearchParams({ ...params, api_key: env.OLA_MAPS_API_KEY });
  const res = await fetch(`${OLA_BASE}${path}?${qs}`, { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(502, data?.message || 'Address lookup failed');
  return data;
}

// Ola returns Google-style address_components; pull one out by type.
const pick = (components = [], ...types) => {
  for (const type of types) {
    const c = components.find((x) => (x.types || []).includes(type));
    if (c?.long_name) return c.long_name;
  }
  return '';
};

// The specific street/area component types, ordered how an address reads.
// Ola uses `street_address` for the road (not Google's `route`).
const LINE1_TYPES = [
  'point_of_interest', 'establishment', 'premise', 'building', 'street_number',
  'street_address', 'route', 'sublocality_level_1', 'sublocality_level_2',
  'sublocality', 'sublocality_level_3', 'neighborhood',
];

// Turn an Ola place/geocode result into our address-form fields.
function normalize(result = {}) {
  const components = result.address_components || [];
  const state = pick(components, 'administrative_area_level_1');
  // City = the town/village, not the (district-level) admin areas.
  const city = pick(components, 'locality', 'postal_town', 'administrative_area_level_3', 'administrative_area_level_2');
  const pincode = pick(components, 'postal_code');

  // Values we never want inside line1 (they live in their own fields).
  const exclude = new Set(
    [
      city, state, pincode, 'India',
      pick(components, 'country'),
      pick(components, 'administrative_area_level_2'),
      pick(components, 'administrative_area_level_3'),
      pick(components, 'postal_town'),
      pick(components, 'locality'),
    ].filter(Boolean).map((s) => s.toLowerCase()),
  );

  // Build line1 from the specific components (POI → street → area), plus the
  // POI name up front. Dedup, drop admin values, and skip parts already
  // contained in an earlier one.
  const parts = [];
  const push = (v) => {
    const t = (v || '').trim();
    if (!t || exclude.has(t.toLowerCase())) return;
    const low = t.toLowerCase();
    if (parts.some((p) => p.toLowerCase() === low || p.toLowerCase().includes(low))) return;
    parts.push(t);
  };
  push((result.name || '').split(/[|,]/)[0]); // POI name, minus SEO tail / trailing ", City"
  for (const type of LINE1_TYPES) push(pick(components, type));

  let line1 = parts.slice(0, 4).join(', ');
  if (!line1) {
    // Fallback: strip the "… <pincode> India" tail off the flat address string.
    line1 = String(result.formatted_address || '')
      .replace(new RegExp(`\\s*${pincode}.*$`), '')
      .replace(/,\s*India\s*$/i, '')
      .trim();
  }

  const loc = result.geometry?.location || {};
  return { line1: line1 || result.formatted_address || '', city, state, pincode, lat: loc.lat, lng: loc.lng };
}

// Type-ahead suggestions. Returns lightweight predictions; the full address is
// fetched on selection via /details (keeps each keystroke cheap).
router.get('/autocomplete', asyncHandler(async (req, res) => {
  const input = String(req.query.q || '').trim();
  if (input.length < 3) return ok(res, []);
  const params = { input };
  if (req.query.lat && req.query.lng) params.location = `${req.query.lat},${req.query.lng}`;
  const data = await olaGet('/autocomplete', params);
  const items = (data.predictions || []).map((p) => ({
    placeId: p.place_id,
    label: p.structured_formatting?.main_text || p.description || '',
    sublabel: p.structured_formatting?.secondary_text || '',
  })).filter((p) => p.placeId && p.label);
  ok(res, items);
}));

// Full address for a selected prediction.
router.get('/details', asyncHandler(async (req, res) => {
  const placeId = String(req.query.placeId || '').trim();
  if (!placeId) throw ApiError.badRequest('placeId is required');
  const data = await olaGet('/details', { place_id: placeId });
  const result = data.result || (Array.isArray(data.results) ? data.results[0] : null);
  if (!result) throw ApiError.notFound('Place not found');
  ok(res, normalize(result));
}));

// Reverse-geocode the browser's current coordinates.
router.get('/reverse', asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw ApiError.badRequest('lat/lng are required');
  const data = await olaGet('/reverse-geocode', { latlng: `${lat},${lng}` });
  const result = Array.isArray(data.results) ? data.results[0] : data.result;
  if (!result) throw ApiError.notFound('Could not resolve location');
  ok(res, normalize(result));
}));

export default router;
