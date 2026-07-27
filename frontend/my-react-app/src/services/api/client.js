import axios from 'axios';

export const authApi = axios.create({
  baseURL: 'http://localhost:8001/api/v1/auth',
  headers: { 'Content-Type': 'application/json' },
});

export const userApi = axios.create({
  baseURL: 'http://localhost:8002/api/v1/users',
});

// Auto-attach Bearer Token
userApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Refresh Token on 401
userApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const response = await authApi.post('/refresh', {
          refresh_token: refreshToken,
        });

        if (response.data && response.data.success) {
          const newAccessToken = response.data.data.access_token;
          const newRefreshToken = response.data.data.refresh_token;

          localStorage.setItem('access_token', newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
          }

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return userApi(originalRequest);
        }
      } catch (refreshErr) {
        localStorage.clear();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);