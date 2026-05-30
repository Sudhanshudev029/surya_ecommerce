import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Attach the JWT (simple MVP: stored in localStorage).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap the { success, data, message } envelope + surface errors.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    let message;
    if (!error.response) {
      // No response at all → network / CORS / server down.
      message = 'Cannot reach the server. Is the backend running on the API URL?';
    } else {
      message = data?.message || `Request failed (${status})`;
      // Surface the first field-level validation error (422).
      const fieldErrors = data?.errors?.body || data?.errors;
      const first = Array.isArray(fieldErrors)
        ? fieldErrors[0]
        : fieldErrors && typeof fieldErrors === 'object'
          ? Object.values(fieldErrors).flat()[0]
          : null;
      if (first) message = `${message}: ${first}`;
    }

    if (status === 401 && !error.config?.url?.includes('/auth/')) {
      localStorage.removeItem('token');
      // hard redirect avoids stale protected state
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    error.normalizedMessage = message;
    return Promise.reject(error);
  },
);

export const showApiError = (error) =>
  toast.error(error.normalizedMessage || error.message || 'Request failed');

export default api;
