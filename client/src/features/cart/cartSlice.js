import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { cartApi } from '../../api/endpoints.js';

export const fetchCart = createAsyncThunk('cart/fetch', async () => {
  const { data } = await cartApi.get();
  return data.data;
});
export const addToCart = createAsyncThunk('cart/add', async ({ productId, quantity = 1 }) => {
  const { data } = await cartApi.add(productId, quantity);
  return data.data;
});
export const updateCartItem = createAsyncThunk('cart/update', async ({ id, quantity }) => {
  const { data } = await cartApi.update(id, quantity);
  return data.data;
});
export const removeCartItem = createAsyncThunk('cart/remove', async (id) => {
  const { data } = await cartApi.remove(id);
  return data.data;
});
export const clearCart = createAsyncThunk('cart/clear', async () => {
  const { data } = await cartApi.clear();
  return data.data;
});

const empty = { items: [], subtotal: 0, count: 0 };

const cartSlice = createSlice({
  name: 'cart',
  initialState: { ...empty, status: 'idle' },
  reducers: {
    resetCart: () => ({ ...empty, status: 'idle' }),
  },
  extraReducers: (b) => {
    const set = (s, a) => Object.assign(s, a.payload, { status: 'idle' });
    b.addCase(fetchCart.fulfilled, set);
    b.addCase(addToCart.fulfilled, set);
    b.addCase(updateCartItem.fulfilled, set);
    b.addCase(removeCartItem.fulfilled, set);
    b.addCase(clearCart.fulfilled, set);
  },
});

export const { resetCart } = cartSlice.actions;
export default cartSlice.reducer;
