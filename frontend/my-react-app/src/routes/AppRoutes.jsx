import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import ProtectedRoute from "./ProtectedRoute";
import Navbar from '../components/Navbar';
import Profile from "../pages/profile";
import ChatDashboard from "../pages/ChatDashboard"; // 👈 Day 15 Component

// 🛑 GUEST GUARD: Blocks logged-in operators from viewing Login/Register portals
function PublicRoute({ children }) {
  const hardwareToken = localStorage.getItem('access_token');
  const userId = localStorage.getItem('user_id');

  if (hardwareToken && userId) {
    // Session is active -> Redirect instantly to prevent route slipping
    return <Navigate to="/dashboard" replace />;
  }

  // No session found -> Safe to display the form page
  return children;
}

// Layout wrapper that attaches the premium Navbar to specific views
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
        {/* Auth portals tightly locked down with the PublicRoute Guest Guard */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* Protected layout views with standard Navbar and Auth Guard */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          
          {/* ⚡ Day 15: WebSocket Connection Test Route */}
          <Route path="/chat-test" element={<ChatDashboard />} />
        </Route>

        {/* Global Fallback Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;