import axios from 'axios';

// ⚡ Dynamic Environment Resolution (Vite / Production Fallback)
const API_GATEWAY_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_GATEWAY_URL) || 
  'https://realtime-connect-platform.onrender.com';

// 1. Universal API instance for User, Friend, Profile, and Chat actions
export const userApi = axios.create({
  baseURL: API_GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 15000, // 15-second request timeout safeguard
});

// 2. Universal API instance for Authentication actions (login, register, refresh)
export const authApi = axios.create({
  baseURL: API_GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000,
});

// --- CONCURRENCY LOCKING FOR TOKEN REFRESH ROTATION ---
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 3. Request Interceptor: Auto-attach Bearer Token & normalize shorthand paths
userApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Auto-normalize shorthand endpoints to match backend microservice prefixes
    if (config.url) {
      const shorthandRoutes = ['/friends', '/search', '/allProfile', '/heartbeat', '/block'];
      const matchesShorthand = shorthandRoutes.some(route => config.url.startsWith(route));

      if (matchesShorthand) {
        config.url = `/api/v1/users${config.url}`;
      } else if (config.url.startsWith('/profile') && !config.url.startsWith('/api/v1/users/profile')) {
        config.url = `/api/v1/users${config.url}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 4. Response Interceptor for authApi: Track authentication endpoint errors uniformly
authApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data;
    let formattedMsg =
      errorData?.message || errorData?.error || error.message || 'Authentication service error';

    window.dispatchEvent(
      new CustomEvent('api_error', {
        detail: { message: formattedMsg, type: 'error', status: error.response?.status },
      })
    );

    return Promise.reject(error);
  }
);

// 5. Response Interceptor for userApi: Thread-Safe 401 Auto-Refresh, 403 Ban Enforcement, & Error Event Dispatching
userApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ⚡ 1. CATCH ACCOUNT SUSPENSION / BAN (403 Forbidden)
    if (error.response && error.response.status === 403) {
      const errorData = error.response.data;
      const errorMsg = JSON.stringify(errorData || '').toLowerCase();
      
      if (errorMsg.includes('suspended') || errorMsg.includes('banned') || errorMsg.includes('administrator')) {
        alert('🚨 Your account has been suspended by an administrator.');
        localStorage.clear();
        window.dispatchEvent(
          new CustomEvent('session_expired', { detail: { message: 'Account suspended. Session terminated.' } })
        );
        
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    // 2. Handle 401 Unauthorized (Refresh Token Flow with Concurrency Lock)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return userApi(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token found');

        const response = await authApi.post('/api/v1/auth/refresh', {
          refresh_token: refreshToken,
        });

        if (response.data && (response.data.success || response.data.data)) {
          const resData = response.data.data || response.data;
          const newAccessToken = resData.access_token || resData.token;
          const newRefreshToken = resData.refresh_token;

          localStorage.setItem('access_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
          }

          userApi.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          isRefreshing = false;

          return userApi(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;

        // Clean storage and trigger clean session termination
        localStorage.clear();
        window.dispatchEvent(
          new CustomEvent('session_expired', { detail: { message: 'Session expired. Please log in again.' } })
        );
        
        // Redirect safeguard
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }

        return Promise.reject(refreshErr);
      }
    }

    // Parse and dispatch robust error messages for UI toasts/alerts
    const errorData = error.response?.data;
    let formattedMsg =
      errorData?.message || errorData?.error || error.message || 'An unexpected system error occurred';

    if (errorData?.errors && typeof errorData.errors === 'object') {
      formattedMsg = Object.entries(errorData.errors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(' | ');
    }

    window.dispatchEvent(
      new CustomEvent('api_error', {
        detail: { message: formattedMsg, type: 'error', status: error.response?.status },
      })
    );

    return Promise.reject(error);
  }
);

export default userApi;