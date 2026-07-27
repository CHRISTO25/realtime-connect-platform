import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  
  // Read directly from the browser's local storage hardware synchronously
  const hardwareToken = localStorage.getItem('access_token');
  const userId = localStorage.getItem('user_id');

  // Verify critical fields exist accurately
  if (!token && (!hardwareToken || !userId)) {
    console.log("Guard Blocked: No active token profile detected. Routing to gateway base.");
    return <Navigate to="/login" replace />;
  }

  // Session verified! Let the dashboard mount safely.
  return children;
};

export default ProtectedRoute;