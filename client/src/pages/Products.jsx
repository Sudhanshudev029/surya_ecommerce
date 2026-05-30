import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PackageSearch } from 'lucide-react';
import { productApi, categoryApi } from '../api/endpoints.js';
import ProductCard from '../components/product/ProductCard.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const SORTS = [
  ['newest', 'Newest'],
  ['price_asc', 'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
  ['name_asc', 'Name: A–Z'],
];

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1, page: 1 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);

  useEffect(() => { categoryApi.list().then((r) => setCategories(r.data.data)); }, []);

  useEffect(() => {
    setLoading(true);
    productApi.list({ search, category, sort, page, limit: 12 })
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [search, category, sort, page]);

  const setParam = (key, val) => {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      {/* Sidebar filters */}
      <aside className="space-y-4">
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Categories</p>
          <button onClick={() => setParam('category', '')}
            className={`block w-full rounded px-2 py-1.5 text-left text-sm ${!category ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'}`}>
            All Products
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setParam('category', c.slug)}
              className={`block w-full rounded px-2 py-1.5 text-left text-sm ${category === c.slug ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'}`}>
              {c.name} <span className="text-xs text-gray-400">({c.product_count})</span>
            </button>
          ))}
        </div>
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">
            {search ? `Results for "${search}"` : category ? categories.find((c) => c.slug === category)?.name || 'Products' : 'All Products'}
            <span className="ml-2 text-sm font-normal text-gray-500">({data.total})</span>
          </h1>
          <select value={sort} onChange={(e) => setParam('sort', e.target.value)} className="input w-auto">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No products found" subtitle="Try a different search or category." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {data.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button disabled={page <= 1} onClick={() => setParam('page', page - 1)} className="btn-outline">Prev</button>
                <span className="text-sm text-gray-600">Page {page} of {data.totalPages}</span>
                <button disabled={page >= data.totalPages} onClick={() => setParam('page', page + 1)} className="btn-outline">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
