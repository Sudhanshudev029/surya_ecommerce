import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { cartApi } from '../../api/endpoints.js';

// ── Guest cart (localStorage) helpers ──────────────────────────
const GUEST_KEY = 'guestCart';
const isAuthed = () => Boolean(localStorage.getItem('token'));
const readGuest = () => {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY)) || []; } catch { return []; }
};
const writeGuest = (items) => localStorage.setItem(GUEST_KEY, JSON.stringify(items));
const clearGuest = () => localStorage.removeItem(GUEST_KEY);

// Shape a guest item list into the same payload the server returns.
const buildGuest = (items) => {
  const withLine = items.map((i) => ({ ...i, lineTotal: i.price * i.quantity }));
  return {
    items: withLine,
    subtotal: withLine.reduce((s, i) => s + i.lineTotal, 0),
    count: withLine.reduce((s, i) => s + i.quantity, 0),
  };
};

// ── Thunks (branch on auth: local guest cart vs server cart) ───
export const loadCart = createAsyncThunk('cart/load', async () => {
  if (!isAuthed()) return buildGuest(readGuest());
  // Logged in: merge any guest items into the server cart, then load it.
  const guest = readGuest();
  if (guest.length) {
    clearGuest(); // clear BEFORE awaiting so a concurrent load can't double-merge
    for (const it of guest) {
      try { await cartApi.add(it.productId, it.quantity); } catch { /* skip unavailable */ }
    }
  }
  const { data } = await cartApi.get();
  return data.data;
});

export const addToCart = createAsyncThunk('cart/add', async ({ product, quantity = 1 }) => {
  if (!isAuthed()) {
    const items = readGuest();
    const existing = items.find((i) => i.productId === product.id);
    if (existing) existing.quantity += quantity;
    else items.push({
      id: product.id, productId: product.id, name: product.name, slug: product.slug,
      price: product.price, unit: product.unit, imageUrl: product.imageUrl,
      stock: product.stock, quantity,
    });
    writeGuest(items);
    return buildGuest(items);
  }
  const { data } = await cartApi.add(product.id, quantity);
  return data.data;
});

export const updateCartItem = createAsyncThunk('cart/update', async ({ id, quantity }) => {
  if (!isAuthed()) {
    const items = readGuest().map((i) => (i.id === id ? { ...i, quantity } : i));
    writeGuest(items);
    return buildGuest(items);
  }
  const { data } = await cartApi.update(id, quantity);
  return data.data;
});

export const removeCartItem = createAsyncThunk('cart/remove', async (id) => {
  if (!isAuthed()) {
    const items = readGuest().filter((i) => i.id !== id);
    writeGuest(items);
    return buildGuest(items);
  }
  const { data } = await cartApi.remove(id);
  return data.data;
});

export const clearCart = createAsyncThunk('cart/clear', async () => {
  if (!isAuthed()) { clearGuest(); return buildGuest([]); }
  const { data } = await cartApi.clear();
  return data.data;
});

const empty = { items: [], subtotal: 0, count: 0 };

const cartSlice = createSlice({
  name: 'cart',
  initialState: { ...empty, status: 'loading' }, // start loading; loadCart runs on mount
  reducers: {
    resetCart: () => ({ ...empty, status: 'idle' }),
  },
  extraReducers: (b) => {
    const set = (s, a) => Object.assign(s, a.payload, { status: 'idle' });
    b.addCase(loadCart.pending, (s) => { s.status = 'loading'; });
    b.addCase(loadCart.fulfilled, set);
    b.addCase(loadCart.rejected, (s) => { s.status = 'idle'; });
    b.addCase(addToCart.fulfilled, set);
    b.addCase(updateCartItem.fulfilled, set);
    b.addCase(removeCartItem.fulfilled, set);
    b.addCase(clearCart.fulfilled, set);
  },
});

export const { resetCart } = cartSlice.actions;
export default cartSlice.reducer;
