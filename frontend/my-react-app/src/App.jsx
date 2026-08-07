import React from "react";
import { AuthProvider } from "./context/AuthContext"; 
import { ToastProvider } from "./context/ToastContext";
import AppRoutes from "./routes/AppRoutes";
import PresenceTracker from "./components/PresenceTracker"; // 👈 IMPORT HERE

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <PresenceTracker /> {/* ⚡ AUTOMATIC REAL-TIME PRESENCE ENGINE */}
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;