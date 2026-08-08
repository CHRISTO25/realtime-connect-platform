import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED'); // CONNECTED | CONNECTING | DISCONNECTED | RECONNECTING
  const [messages, setMessages] = useState([]);
  
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0); // ⚡ Track progressive retry count

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
      reconnectAttemptsRef.current = 0; // ⚡ Reset backoff counter on successful handshake
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

      // ⚡ EXPONENTIAL BACKOFF RECONNECTION LOGIC
      if (localStorage.getItem('access_token')) {
        const attempts = reconnectAttemptsRef.current;
        // Formula: min(30000, 1000 * 2^attempts) -> 1s, 2s, 4s, 8s, 16s, capped at 30s
        const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
        reconnectAttemptsRef.current += 1;

        console.log(`🔄 [WebSocket] Reconnecting in ${delay}ms (Attempt #${reconnectAttemptsRef.current})...`);
        setConnectionStatus(`RECONNECTING (${reconnectAttemptsRef.current})`);

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    socketRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnectionStatus('DISCONNECTED');
    reconnectAttemptsRef.current = 0;
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
        isConnected: connectionStatus === 'CONNECTED',
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