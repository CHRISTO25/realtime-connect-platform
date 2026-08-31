import React, { createContext, useState, useEffect, useContext } from 'react';
import { useDispatch } from 'react-redux';
import { setUserProfile, logoutUser } from '../store/userSlice';
import { userApi } from '../services/api/client';

const AuthContext = createContext(null);

// ✅ Correct (clean string, no brackets, no markdown)
const API_BASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_GATEWAY_URL) || 
  'https://realtime-connect-platform.onrender.com';

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();

  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [userId, setUserId] = useState(localStorage.getItem('user_id') || null);
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || 'user');
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
    if (userRole) {
      localStorage.setItem('user_role', userRole);
    } else {
      localStorage.removeItem('user_role');
    }
  }, [userRole]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
  }, [refreshToken]);

  // ⚡ Robust JWT Decoder extracting both ID and Role claims
  const decodeJwtPayload = (tokenString) => {
    try {
      if (!tokenString) return { userId: null, role: 'user' };
      const base64Url = tokenString.split('.')[1];
      if (!base64Url) return { userId: null, role: 'user' };

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
      return {
        userId: parsed.user_id || parsed.id || null,
        role: parsed.role || 'user', // 👈 Extracts role from backend JWT token
      };
    } catch (e) {
      console.error('JWT Parsing Error:', e);
      return { userId: null, role: 'user' };
    }
  };

  const login = async (email, password) => {
    try {
      //await fetch('http://localhost:8001/api/v1/auth/login'
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
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

      // ⚡ Decode claims securely from the token
      const { userId: extractedUserId, role: extractedRole } = decodeJwtPayload(extractedAccessToken);

      setToken(extractedAccessToken);
      setUserId(extractedUserId);
      setUserRole(extractedRole);
      setRefreshToken(extractedRefreshToken || null);

      dispatch(
        setUserProfile({
          id: extractedUserId,
          role: extractedRole,
          displayName: result?.data?.user?.display_name || localStorage.getItem('display_name') || 'User',
          avatarUrl: result?.data?.user?.avatar_url || localStorage.getItem('avatar_url') || '',
        })
      );

      try {
        await userApi.post('/heartbeat');
      } catch (err) {}

      return { success: true, role: extractedRole }; // 👈 Returns role so login navigation handles it smoothly
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await userApi.post('/logout');
    } catch (err) {
      console.warn('Logout API notification skipped:', err);
    } finally {
      setToken(null);
      setUserId(null);
      setUserRole('user');
      setRefreshToken(null);
      localStorage.clear();
      dispatch(logoutUser());
    }
  };

  return (
    <AuthContext.Provider value={{ token, userId, userRole, refreshToken, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);