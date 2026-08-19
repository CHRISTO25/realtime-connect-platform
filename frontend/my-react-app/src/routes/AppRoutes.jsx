import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Login from "../pages/Login";
import Register from "../pages/Register";
import VerifyEmail from "../pages/VerifyEmail"; // 👈 OTP Verification Page
import Dashboard from "../pages/Dashboard";
import AdminDashboard from "../pages/AdminDashboard"; // 👈 Admin Control Panel Component
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute"; // 👈 Role-Based Admin Guard
import Navbar from '../components/Navbar';
import Profile from "../pages/Profile";
import ChatDashboard from "../pages/ChatDashboard";

// 🛑 GUEST GUARD: Blocks logged-in operators from viewing Login/Register portals
function PublicRoute({ children }) {
  const hardwareToken = localStorage.getItem('access_token');
  const userId = localStorage.getItem('user_id');

  if (hardwareToken && userId) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Layout wrapper that attaches the premium Navbar to standard views
function DashboardLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Portals */}
        <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        
        {/* ⚡ OTP Email Confirmation Route */}
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Protected Core User Dashboard Layout */}
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat-test" element={<ChatDashboard />} />
        </Route>

        {/* ⚡ Role-Protected Admin Panel Workspace */}
        <Route element={<AdminRoute><DashboardLayout /></AdminRoute>}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>

        {/* Global Fallback Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;