import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { token, userId } = useAuth();
  
  // Check auth state from context, fallback to localStorage synchronously
  const activeToken = token || localStorage.getItem('access_token');
  const activeUserId = userId || localStorage.getItem('user_id');

  // If no token exists, route to login
  if (!activeToken) {
    console.warn("Guard Blocked: No active token detected. Redirecting to login.");
    return <Navigate to="/login" replace />;
  }

  // Render children if passed, otherwise fall back to React Router Outlet
  return children ? children : <Outlet />;
};

export default ProtectedRoute;