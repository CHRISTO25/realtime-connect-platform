import React from "react";
import { ToastProvider } from "./context/ToastContext";
import AppRoutes from "./routes/AppRoutes";
import PresenceTracker from "./components/PresenceTracker";
import GlobalCallHandler from "./components/GlobalCallHandler";

export default function App() {
  return (
    <ToastProvider>
      <PresenceTracker /> 
      <GlobalCallHandler />
      <AppRoutes />
    </ToastProvider>
  );
}