import React from 'react';
import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
  const token = localStorage.getItem('access_token');
  const userRole = localStorage.getItem('user_role'); // Saved during login

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (userRole !== 'admin') {
    // Non-admin trying to access admin panel -> redirect to normal dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}