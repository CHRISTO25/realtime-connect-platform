import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import { store } from "./app/store";
import { WebSocketProvider } from "./context/WebSocketContext";
import './index.css';

ReactDOM.createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <WebSocketProvider>
      <App />
    </WebSocketProvider>
  </Provider>
);