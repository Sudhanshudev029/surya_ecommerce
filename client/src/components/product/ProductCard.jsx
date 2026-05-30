import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ShoppingCart, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { addToCart } from '../../features/cart/cartSlice.js';
import { showApiError } from '../../api/axios.js';
import { formatCurrency } from '../../utils/format.js';
import Badge from '../ui/Badge.jsx';

export default function ProductCard({ product }) {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const discount = product.mrp && product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  const handleAdd = async () => {
    if (!user) { toast('Please log in to add items'); return; }
    try {
      await dispatch(addToCart({ productId: product.id, quantity: 1 })).unwrap();
      toast.success(`${product.name} added to cart`);
    } catch (e) { showApiError(e); }
  };

  return (
    <div className="card group flex flex-col overflow-hidden transition hover:shadow-md">
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        {discount > 0 && (
          <Badge className="absolute left-2 top-2 bg-brand-600 text-white">{discount}% OFF</Badge>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Badge className="bg-gray-800 text-white">Out of stock</Badge>
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-3">
        <Link to={`/product/${product.slug}`} className="line-clamp-2 text-sm font-medium hover:text-brand-700">
          {product.name}
        </Link>
        <p className="mt-0.5 text-xs text-gray-500">{product.unit}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <div>
            <span className="font-semibold">{formatCurrency(product.price)}</span>
            {discount > 0 && (
              <span className="ml-1 text-xs text-gray-400 line-through">{formatCurrency(product.mrp)}</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={!product.inStock}
            className="btn-primary !px-2.5 !py-1.5"
            aria-label="Add to cart"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
