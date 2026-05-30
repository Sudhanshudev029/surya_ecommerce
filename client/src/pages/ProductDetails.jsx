import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Minus, Plus, ShoppingCart, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { productApi } from '../api/endpoints.js';
import { addToCart } from '../features/cart/cartSlice.js';
import { showApiError } from '../api/axios.js';
import { formatCurrency } from '../utils/format.js';
import Spinner from '../components/ui/Spinner.jsx';
import Badge from '../components/ui/Badge.jsx';

export default function ProductDetails() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((s) => s.auth.user);

  useEffect(() => {
    setLoading(true);
    productApi.get(slug)
      .then((r) => setProduct(r.data.data))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!product) return <div className="py-20 text-center text-gray-500">Product not found.</div>;

  const discount = product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  const handleAdd = async () => {
    if (!user) { navigate('/login'); return; }
    try {
      await dispatch(addToCart({ productId: product.id, quantity: qty })).unwrap();
      toast.success('Added to cart');
    } catch (e) { showApiError(e); }
  };

  return (
    <div>
      <Link to="/products" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        <ChevronLeft className="h-4 w-4" /> Back to products
      </Link>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="card overflow-hidden">
          <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
        </div>
        <div>
          {product.category && (
            <Link to={`/products?category=${product.category.slug}`} className="text-sm text-brand-700 hover:underline">
              {product.category.name}
            </Link>
          )}
          <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{product.unit}</p>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-3xl font-bold">{formatCurrency(product.price)}</span>
            {discount > 0 && (
              <>
                <span className="text-lg text-gray-400 line-through">{formatCurrency(product.mrp)}</span>
                <Badge className="bg-brand-100 text-brand-700">{discount}% OFF</Badge>
              </>
            )}
          </div>

          <div className="mt-3">
            {product.inStock
              ? <Badge className="bg-green-100 text-green-700">In stock ({product.stock} available)</Badge>
              : <Badge className="bg-red-100 text-red-700">Out of stock</Badge>}
          </div>

          {product.description && <p className="mt-4 text-gray-600">{product.description}</p>}

          {product.inStock && (
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center rounded-lg border border-gray-300">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2"><Minus className="h-4 w-4" /></button>
                <span className="w-10 text-center text-sm font-medium">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} className="px-3 py-2"><Plus className="h-4 w-4" /></button>
              </div>
              <button onClick={handleAdd} className="btn-primary flex-1">
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
