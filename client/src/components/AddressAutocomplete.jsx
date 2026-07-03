import { useState, useEffect, useRef } from 'react';
import { MapPin, LocateFixed, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { geoApi } from '../api/endpoints.js';

/**
 * Address line input with India-only type-ahead suggestions (Ola Maps, proxied
 * through our server) plus a "use my current location" action. Free typing is
 * always allowed; suggestions are optional aids.
 *
 * - value/onChange: the line1 text (controlled).
 * - onPick(addr): called when a suggestion or current location is chosen,
 *   with { line1, city, state, pincode } so the parent can fill related fields.
 *
 * Suggestions stay lightweight (place id + label); the full address is fetched
 * only on selection, so each keystroke is one cheap call.
 */
export default function AddressAutocomplete({ value, onChange, onPick, className, placeholder }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [resolving, setResolving] = useState(false); // fetching details / location
  const ref = useRef(null);
  const listRef = useRef(null);
  const abortRef = useRef(null);
  const pickedRef = useRef(''); // last text we filled from a pick — skips re-searching it

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Debounced suggestions. Aborts any in-flight request and skips the exact
  // text we just filled from a pick (so choosing a place doesn't re-open it).
  useEffect(() => {
    const term = (value || '').trim();
    setActive(-1);
    if (term.length < 3 || term === pickedRef.current) { setItems([]); return; }
    setLoading(true);
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      geoApi.autocomplete(term, ctrl.signal)
        .then((r) => { setItems(r.data.data); setOpen(true); })
        .catch((e) => { if (e.code !== 'ERR_CANCELED') setItems([]); })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [value]);

  const applyAddr = (addr) => {
    pickedRef.current = addr.line1 || '';
    setOpen(false);
    setActive(-1);
    setItems([]);
    onPick?.(addr);
  };

  // Resolve a selected prediction to a full address (city/state/pincode).
  const choose = async (item) => {
    if (!item) return;
    setResolving(true);
    setOpen(false);
    try {
      const { data } = await geoApi.details(item.placeId);
      applyAddr(data.data);
    } catch {
      // Fall back to at least the label text so the user isn't stuck.
      applyAddr({ line1: item.label });
      toast.error('Could not load full address details. Please check the fields.');
    } finally { setResolving(false); }
  };

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) { toast.error('Location is not supported on this device'); return; }
    setResolving(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data } = await geoApi.reverse(pos.coords.latitude, pos.coords.longitude);
          applyAddr(data.data);
          toast.success('Location detected');
        } catch {
          toast.error('Could not detect your address. Please enter it manually.');
        } finally { setResolving(false); }
      },
      (err) => {
        setResolving(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Please enter your address manually.'
            : 'Could not get your location. Please enter your address manually.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const onKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') { if (active >= 0 && items[active]) { e.preventDefault(); choose(items[active]); } }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };

  // Keep the highlighted row visible while arrowing.
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    listRef.current.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => { pickedRef.current = ''; onChange(e.target.value); setOpen(true); }}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder={placeholder}
        className={className}
      />

      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={resolving}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 disabled:opacity-60"
      >
        {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
        {resolving ? 'Fetching address…' : 'Use my current location'}
      </button>

      {open && (loading || items.length > 0) && (
        <div
          ref={listRef}
          className="absolute z-40 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{ marginTop: '0.25rem' }}
        >
          {loading && items.length === 0 && (
            <p className="px-3 py-3 text-sm text-gray-500">Searching addresses…</p>
          )}
          {items.map((it, i) => (
            <button
              key={it.placeId}
              type="button"
              data-idx={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(it)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${active === i ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <span className="min-w-0">
                <span className="block font-medium text-gray-800 line-clamp-1">{it.label}</span>
                {it.sublabel && <span className="block text-xs text-gray-500 line-clamp-1">{it.sublabel}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
