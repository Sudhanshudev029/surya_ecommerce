import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Tag } from 'lucide-react';
import { productApi, categoryApi } from '../api/endpoints.js';
import { formatCurrency } from '../utils/format.js';

export default function SearchAutocomplete({ placeholder = 'Search for oil, vegetables, snacks...' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [allCats, setAllCats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1); // highlighted suggestion index (-1 = none)
  const ref = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Categories are few — load once and filter client-side.
  useEffect(() => { categoryApi.list().then((r) => setAllCats(r.data.data)).catch(() => {}); }, []);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Debounced product suggestions + category filter.
  useEffect(() => {
    const term = q.trim();
    setActive(-1);
    if (!term) { setProducts([]); setCats([]); return; }
    setCats(allCats.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())).slice(0, 4));
    setLoading(true);
    const t = setTimeout(() => {
      productApi.list({ search: term, limit: 6 })
        .then((r) => setProducts(r.data.data.items))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, allCats]);

  const hasResults = cats.length > 0 || products.length > 0;

  // Flat, ordered list of navigable items (categories → products → "see all").
  const items = [
    ...cats.map((c) => ({ type: 'category', slug: c.slug })),
    ...products.map((p) => ({ type: 'product', slug: p.slug })),
    ...(hasResults ? [{ type: 'all' }] : []),
  ];

  const go = (path) => { setOpen(false); setQ(''); setActive(-1); navigate(path); };
  const selectItem = (item) => {
    if (!item) return;
    if (item.type === 'category') go(`/products?category=${item.slug}`);
    else if (item.type === 'product') go(`/product/${item.slug}`);
    else go(`/products?search=${encodeURIComponent(q.trim())}`);
  };
  const submit = (e) => { e.preventDefault(); if (q.trim()) go(`/products?search=${encodeURIComponent(q.trim())}`); };

  const onKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter') {
      if (active >= 0 && items[active]) { e.preventDefault(); selectItem(items[active]); }
    } else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };

  // Keep the highlighted item visible while arrowing.
  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    listRef.current.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const rowClass = (idx) =>
    `flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${active === idx ? 'bg-gray-100' : 'hover:bg-gray-50'}`;
  const prodBase = cats.length;
  const allIdx = cats.length + products.length;

  return (
    <div ref={ref} className="relative w-full">
      <form onSubmit={submit}>
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => q.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls="search-suggestions"
          placeholder={placeholder}
          className="input pl-9"
        />
      </form>

      {open && q.trim() && (
        <div ref={listRef} id="search-suggestions" className="absolute z-40 max-h-96 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg" style={{ marginTop: '0.25rem' }}>
          {cats.length > 0 && (
            <div className="border-b py-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Categories</p>
              {cats.map((c, i) => (
                <button key={c.id} type="button" data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(`/products?category=${c.slug}`)}
                  className={rowClass(i)}>
                  <Tag className="h-4 w-4 text-brand-600" />
                  <span>{c.name}</span>
                  <span className="ml-auto text-xs text-gray-400">{c.product_count} items</span>
                </button>
              ))}
            </div>
          )}

          {products.length > 0 && (
            <div className="py-1">
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Products</p>
              {products.map((p, i) => (
                <button key={p.id} type="button" data-idx={prodBase + i}
                  onMouseEnter={() => setActive(prodBase + i)}
                  onClick={() => go(`/product/${p.slug}`)}
                  className={rowClass(prodBase + i)}>
                  <img src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                  <span className="line-clamp-1">{p.name}</span>
                  <span className="ml-auto shrink-0 font-medium">{formatCurrency(p.price)}</span>
                </button>
              ))}
            </div>
          )}

          {!hasResults && !loading && (
            <p className="px-3 py-3 text-sm text-gray-500">No matches. Press Enter to search “{q.trim()}”.</p>
          )}

          {hasResults && (
            <button type="button" data-idx={allIdx}
              onMouseEnter={() => setActive(allIdx)}
              onClick={() => go(`/products?search=${encodeURIComponent(q.trim())}`)}
              className={`w-full border-t px-3 py-2 text-left text-sm font-medium text-brand-700 ${active === allIdx ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
              See all results for “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
