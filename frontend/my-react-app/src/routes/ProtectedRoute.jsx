import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { token, isInitializing } = useAuth();

  // 1. Wait for auth initialization before running checks
  if (isInitializing) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-xs">
        <span className="animate-pulse">Verifying session...</span>
      </div>
    );
  }

  // 2. Validate token from state or localStorage
  const activeToken = token || localStorage.getItem('access_token');

  if (!activeToken) {
    console.warn("Guard Blocked: No active token detected. Redirecting to login.");
    return <Navigate to="/login" replace />;
  }

  // 3. Render children if passed, otherwise fall back to React Router Outlet
  return children ? children : <Outlet />;
};

export default ProtectedRoute;