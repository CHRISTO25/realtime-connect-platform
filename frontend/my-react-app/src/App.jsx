import React from "react";
import { AuthProvider } from "./context/AuthContext"; 
import AppRoutes from "./routes/AppRoutes"; // Aligned to your exact directory tree!

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;