import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import { store } from "./app/store";
import { AuthProvider } from "./context/AuthContext";       // 👈 Bring Auth here
import { WebSocketProvider } from "./context/WebsocketContext";
import './index.css';

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <AuthProvider>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </AuthProvider>
  </Provider>
);