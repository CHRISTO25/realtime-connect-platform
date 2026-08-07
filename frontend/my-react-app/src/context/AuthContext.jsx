import React, { createContext, useState, useEffect, useContext } from 'react';
import { useDispatch } from 'react-redux';
import { setUserProfile, logoutUser } from '../store/userSlice';
import { userApi } from '../services/api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();

  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [userId, setUserId] = useState(localStorage.getItem('user_id') || null);
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refresh_token') || null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }, [token]);

  useEffect(() => {
    if (userId) {
      localStorage.setItem('user_id', userId);
    } else {
      localStorage.removeItem('user_id');
    }
  }, [userId]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
  }, [refreshToken]);

  const decodeJwtUserId = (tokenString) => {
    try {
      if (!tokenString) return null;
      const base64Url = tokenString.split('.')[1];
      if (!base64Url) return null;

      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }

      const jsonPayload = decodeURIComponent(
        window.atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const parsed = JSON.parse(jsonPayload);
      return parsed.user_id || parsed.id || null;
    } catch (e) {
      console.error('JWT Parsing Error:', e);
      return null;
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch('http://localhost:8001/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Authentication failure');
      }

      const extractedAccessToken = result?.data?.access_token;
      const extractedRefreshToken = result?.data?.refresh_token;

      if (!extractedAccessToken) {
        throw new Error('Access token absent from response body.');
      }

      const extractedUserId = decodeJwtUserId(extractedAccessToken);

      setToken(extractedAccessToken);
      setUserId(extractedUserId);
      setRefreshToken(extractedRefreshToken || null);

      dispatch(
        setUserProfile({
          id: extractedUserId,
          displayName: result?.data?.user?.display_name || localStorage.getItem('display_name') || 'User',
          avatarUrl: result?.data?.user?.avatar_url || localStorage.getItem('avatar_url') || '',
        })
      );

      // ⚡ Send immediate heartbeat on login to mark IS_ONLINE = TRUE
      try {
        await userApi.post('/heartbeat');
      } catch (err) {}

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ⚡ FIXED LOGOUT: Sends POST /logout BEFORE clearing localStorage!
  const logout = async () => {
    try {
      // Must be called WHILE access_token is still stored!
      await userApi.post('/logout');
    } catch (err) {
      console.warn('Logout API notification skipped:', err);
    } finally {
      setToken(null);
      setUserId(null);
      setRefreshToken(null);
      localStorage.clear();
      dispatch(logoutUser());
    }
  };

  return (
    <AuthContext.Provider value={{ token, userId, refreshToken, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);