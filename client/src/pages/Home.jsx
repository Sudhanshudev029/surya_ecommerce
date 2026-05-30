import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Truck, ShieldCheck, Wallet } from 'lucide-react';
import { productApi, categoryApi } from '../api/endpoints.js';
import ProductCard from '../components/product/ProductCard.jsx';
import Spinner from '../components/ui/Spinner.jsx';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productApi.list({ featured: true, limit: 8 }),
      categoryApi.list(),
    ])
      .then(([p, c]) => {
        setFeatured(p.data.data.items);
        setCategories(c.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="max-w-xl">
          <h1 className="text-3xl font-bold sm:text-4xl">Daily essentials, delivered to your door</h1>
          <p className="mt-3 text-brand-50">
            Cooking oil, fresh vegetables, snacks, groceries & household items —
            order online and pay on delivery.
          </p>
          <Link to="/products" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-50">
            Shop Now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Trust badges */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          [Truck, 'Fast Local Delivery', 'Same-day delivery in your area'],
          [Wallet, 'Cash on Delivery', 'Pay when your order arrives'],
          [ShieldCheck, 'Quality Guaranteed', 'Fresh stock, fair prices'],
        ].map(([Icon, title, sub]) => (
          <div key={title} className="card flex items-center gap-3 p-4">
            <div className="rounded-lg bg-brand-50 p-2 text-brand-600"><Icon className="h-6 w-6" /></div>
            <div><p className="font-medium">{title}</p><p className="text-sm text-gray-500">{sub}</p></div>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">Shop by Category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((c) => (
            <Link key={c.id} to={`/products?category=${c.slug}`}
              className="card group overflow-hidden text-center transition hover:shadow-md">
              <div className="aspect-video overflow-hidden bg-gray-100">
                <img src={c.image_url} alt={c.name} className="h-full w-full object-cover transition group-hover:scale-105" />
              </div>
              <p className="px-2 py-2 text-sm font-medium">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Featured Products</h2>
          <Link to="/products" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="h-8 w-8" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
