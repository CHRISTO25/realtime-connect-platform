import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED'); // CONNECTED | CONNECTING | DISCONNECTED
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setConnectionStatus('DISCONNECTED');
      return;
    }

    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setConnectionStatus('CONNECTING');
    const wsUrl = `ws://localhost:8003/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🟢 [WebSocket] Connected to Chat Service Hub');
      setConnectionStatus('CONNECTED');
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('💬 [WebSocket Frame Received]:', data);
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        console.warn('⚠️ Raw socket payload received:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ [WebSocket Error]:', error);
      setConnectionStatus('DISCONNECTED');
    };

    ws.onclose = (event) => {
      console.log(`🔌 [WebSocket Closed] Code: ${event.code}`);
      setConnectionStatus('DISCONNECTED');
      socketRef.current = null;

      // Auto reconnect
      if (localStorage.getItem('access_token')) {
        reconnectTimerRef.current = setTimeout(() => {
          console.log('🔄 Attempting WebSocket auto-reconnect...');
          connect();
        }, 3000);
      }
    };

    socketRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnectionStatus('DISCONNECTED');
  }, []);

  const sendMessage = useCallback((payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const msgString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      socketRef.current.send(msgString);
      return true;
    }
    console.warn('⚠️ Cannot send message: WebSocket is not in OPEN state.');
    return false;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <WebSocketContext.Provider
      value={{
        connectionStatus,
        isConnected: connectionStatus === 'CONNECTED', // 🟢 CRITICAL: Export boolean flag
        messages,
        sendMessage,
        connect,
        disconnect,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};