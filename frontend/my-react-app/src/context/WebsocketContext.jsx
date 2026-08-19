import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED'); // CONNECTED | CONNECTING | DISCONNECTED | RECONNECTING
  const [messages, setMessages] = useState([]);
  
  // ⚡ Global Call Notification States
  const [incomingCall, setIncomingCall] = useState(null); // { callerId, roomID, type, content }

  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isManuallyClosedRef = useRef(false);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    const currentUserId = localStorage.getItem('user_id');

    if (!token) {
      setConnectionStatus('DISCONNECTED');
      return;
    }

    // Prevent redundant handshakes if already open or connecting
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    isManuallyClosedRef.current = false;
    setConnectionStatus('CONNECTING');
    
    // ⚡ DAY 38: Routes through API Gateway (:8080) which load-balances to healthy chat nodes
    const wsUrl = `ws://localhost:8080/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🟢 [WebSocket] Connected to Load-Balanced Gateway Mesh');
      setConnectionStatus('CONNECTED');
      reconnectAttemptsRef.current = 0; // Reset retry count upon successful link
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // ⚡ WebRTC Incoming Call Signaling Interception
        if (
          data.type === 'CALL_OFFER' ||
          data.type === 'CALL_ANSWER' ||
          data.type === 'ICE_CANDIDATE' ||
          data.type === 'CALL_END'
        ) {
          if (String(data.sender_id) !== String(currentUserId)) {
            if (data.type === 'CALL_OFFER') {
              setIncomingCall({
                callerId: data.sender_id,
                roomID: data.room_id,
                type: data.content && data.content.includes('video') ? 'video' : 'audio',
                content: data.content,
              });
            } else if (data.type === 'CALL_END') {
              setIncomingCall(null);
            }
          }
        }

        // Keep rolling message buffer to avoid memory leaks
        setMessages((prev) => [...prev.slice(-150), data]);
      } catch (err) {
        console.warn('⚠️ Raw socket payload received:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ [WebSocket Gateway Link Warning]: Node failover in progress...');
    };

    ws.onclose = (event) => {
      socketRef.current = null;

      // Don't auto-reconnect if cleanly logged out
      if (isManuallyClosedRef.current || event.code === 1000) {
        setConnectionStatus('DISCONNECTED');
        return;
      }

      setConnectionStatus('RECONNECTING');

      const tokenAvailable = localStorage.getItem('access_token');
      if (tokenAvailable) {
        const attempts = reconnectAttemptsRef.current;
        // ⚡ Exponential backoff with random jitter (prevents thundering herd on failover)
        const baseDelay = Math.min(10000, 1000 * Math.pow(1.5, attempts));
        const jitter = Math.random() * 400;
        const delay = Math.round(baseDelay + jitter);

        reconnectAttemptsRef.current += 1;
        console.log(`🔄 [WebSocket Failover] Re-routing to available cluster node in ${delay}ms (Attempt #${reconnectAttemptsRef.current})...`);

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        setConnectionStatus('DISCONNECTED');
      }
    };

    socketRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close(1000, 'Client closed connection cleanly');
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

  // Lifecycle listeners
  useEffect(() => {
    connect();

    const handleFocus = () => {
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', connect);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', connect);
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
        incomingCall,
        setIncomingCall,
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