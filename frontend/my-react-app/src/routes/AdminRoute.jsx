import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { token, userRole } = useAuth();
  
  // Fallback to localStorage if context is hydrating
  const activeToken = token || localStorage.getItem('access_token');
  const activeRole = userRole || localStorage.getItem('user_role');

  if (!activeToken) {
    return <Navigate to="/login" replace />;
  }

  if (activeRole !== 'admin') {
    // Non-admin trying to access admin panel -> redirect to user dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // Render children if passed directly, otherwise render nested Outlet
  return children ? children : <Outlet />;
}