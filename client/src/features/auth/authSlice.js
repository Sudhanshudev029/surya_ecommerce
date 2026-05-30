import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '../../api/endpoints.js';

const tokenFromStorage = localStorage.getItem('token');

export const login = createAsyncThunk('auth/login', async (creds) => {
  const { data } = await authApi.login(creds);
  localStorage.setItem('token', data.data.token);
  return data.data.user;
});

export const register = createAsyncThunk('auth/register', async (body) => {
  const { data } = await authApi.register(body);
  localStorage.setItem('token', data.data.token);
  return data.data.user;
});

export const loadMe = createAsyncThunk('auth/loadMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authApi.me();
    return data.data.user;
  } catch (e) {
    localStorage.removeItem('token');
    return rejectWithValue(null);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    status: tokenFromStorage ? 'loading' : 'idle', // loading while we verify token
  },
  reducers: {
    logout(state) {
      localStorage.removeItem('token');
      state.user = null;
      state.status = 'idle';
    },
    setUser(state, action) {
      state.user = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(login.fulfilled, (s, a) => { s.user = a.payload; s.status = 'authenticated'; });
    b.addCase(register.fulfilled, (s, a) => { s.user = a.payload; s.status = 'authenticated'; });
    b.addCase(loadMe.pending, (s) => { s.status = 'loading'; });
    b.addCase(loadMe.fulfilled, (s, a) => { s.user = a.payload; s.status = 'authenticated'; });
    b.addCase(loadMe.rejected, (s) => { s.user = null; s.status = 'idle'; });
  },
});

export const { logout, setUser } = authSlice.actions;
export const selectIsAdmin = (s) => ['admin', 'superadmin'].includes(s.auth.user?.role);
export default authSlice.reducer;
