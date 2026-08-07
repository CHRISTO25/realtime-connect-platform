import React from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function WsStatusBadge() {
  const { connectionStatus, connect } = useWebSocket();

  if (connectionStatus === 'CONNECTED') {
    return (
      <div 
        className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        title="WebSocket Persistent Stream Online"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>Online</span>
      </div>
    );
  }

  if (connectionStatus === 'CONNECTING') {
    return (
      <div 
        className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border bg-amber-500/10 text-amber-400 border-amber-500/20"
        title="Establishing WebSocket Handshake..."
      >
        <svg className="animate-spin h-3 w-3 text-amber-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <span>Connecting...</span>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20 transition-colors"
      title="Socket Disconnected - Click to Reconnect"
    >
      <span className="h-2 w-2 rounded-full bg-slate-500"></span>
      <span>Offline (Retry)</span>
    </button>
  );
}