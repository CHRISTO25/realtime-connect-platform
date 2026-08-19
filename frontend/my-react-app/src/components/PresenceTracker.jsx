import React, { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebsocketContext";
import { userApi } from "../services/api/client";

export default function PresenceTracker() {
  const { user } = useAuth();
  const { isConnected, sendMessage } = useWebSocket();
  const heartbeatIntervalRef = useRef(null);

  useEffect(() => {
    const userId = user?.id || localStorage.getItem("user_id");
    const token = localStorage.getItem("access_token");

    if (!token || !userId) return;

    // Pulse heartbeat to both user-service (HTTP) & chat-service (WS)
    const sendPresencePulse = async () => {
      // 1. Notify user-service (Port 8002) so /friends/list updates DB
      try {
        await userApi.post('/heartbeat');
      } catch (err) {
        // Silently swallow background heartbeat errors
      }

      // 2. Notify chat-service (Port 8003) over WebSocket
      if (isConnected) {
        sendMessage({
          type: "USER_PRESENCE_PING",
          user_id: userId,
          status: document.hidden ? "AWAY" : "ONLINE",
          timestamp: new Date().toISOString(),
        });
      }
    };

    // Immediate ping on mount
    sendPresencePulse();

    // Heartbeat pulse every 5 seconds
    heartbeatIntervalRef.current = setInterval(sendPresencePulse, 5000);

    const handleVisibilityChange = () => {
      sendPresencePulse();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isConnected, user, sendMessage]);

  return null;
}