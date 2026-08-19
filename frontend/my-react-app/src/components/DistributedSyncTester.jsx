import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export default function DistributedSyncTester({ activeRoomId }) {
  const { messages, sendMessage, isConnected, connectionStatus } = useWebSocket();
  const [syncedEvents, setSyncedEvents] = useState([]);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState(null);
  
  const currentUserId = localStorage.getItem('user_id');
  const pingTimestampRef = useRef(null);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const latest = messages[messages.length - 1];

    // Measure latency if this was a Ping initiated by this tab
    if (latest.type === 'NEW_MESSAGE' && latest.content?.includes('Ping') && pingTimestampRef.current) {
      const diff = Date.now() - pingTimestampRef.current;
      setLastLatencyMs(diff);
      pingTimestampRef.current = null;
    }

    setSyncedEvents((prev) => [
      {
        id: latest.id || Date.now() + Math.random(),
        type: latest.type || 'RAW_FRAME',
        sender: String(latest.sender_id) === String(currentUserId) ? 'Local Tab (Self)' : 'Remote Tab/Node',
        content: latest.content || '',
        time: new Date().toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit', 
          fractionalSecondDigits: 3 
        }),
      },
      ...prev.slice(0, 5),
    ]);
  }, [messages, currentUserId]);

  // Dispatch single test ping
  const handleSinglePing = () => {
    if (!isConnected) return;
    pingTimestampRef.current = Date.now();
    sendMessage({
      type: 'SEND_MESSAGE',
      room_id: activeRoomId || '00000000-0000-0000-0000-000000000001',
      content: `⚡ Mesh Ping [${Date.now().toString().slice(-4)}]`,
    });
  };

  // Run automated multi-packet blast test (5 packets across cluster)
  const handleRunStressRoutine = async () => {
    if (!isConnected || isStressTesting) return;
    setIsStressTesting(true);

    const roomId = activeRoomId || '00000000-0000-0000-0000-000000000001';

    for (let i = 1; i <= 5; i++) {
      sendMessage({
        type: 'SEND_MESSAGE',
        room_id: roomId,
        content: `🚀 [Multi-Node Sync Test #${i}/5] [${Date.now().toString().slice(-4)}]`,
      });
      // 200ms delay between packets
      await new Promise((r) => setTimeout(r, 200));
    }

    setIsStressTesting(false);
  };

  const getBadgeColor = (type) => {
    switch (type) {
      case 'NEW_MESSAGE':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'TYPING_START':
      case 'TYPING_STOP':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'DELIVERED_ACK':
      case 'READ_ACK':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  return (
    <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl backdrop-blur-xl space-y-3 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isConnected ? 'bg-emerald-400' : 'bg-rose-400'
            }`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`} />
          </span>
          <span className="text-[11px] font-mono font-bold uppercase text-slate-200 tracking-wider">
            Redis Mesh Sync Tester
          </span>
        </div>

        {lastLatencyMs !== null && (
          <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
            ~{lastLatencyMs}ms loop
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleSinglePing}
          disabled={!isConnected || isStressTesting}
          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 border border-slate-700 cursor-pointer"
        >
          Single Ping ⚡
        </button>
        <button
          onClick={handleRunStressRoutine}
          disabled={!isConnected || isStressTesting}
          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-mono text-[10px] font-bold transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-indigo-500/20 cursor-pointer"
        >
          {isStressTesting ? 'Blasting...' : 'Blast Test (5x) 🚀'}
        </button>
      </div>

      {/* Real-time Inbound Logs */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-[10px] uppercase font-mono text-slate-400">
          <span>Live Inbound Broadcasts</span>
          <span className="text-[9px] text-slate-500">{connectionStatus}</span>
        </div>

        <div className="space-y-1">
          {syncedEvents.length === 0 ? (
            <p className="text-[10px] text-slate-500 font-mono py-2 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              Awaiting cross-node broadcast frames...
            </p>
          ) : (
            syncedEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center justify-between text-[10px] font-mono bg-slate-950/70 px-2.5 py-1.5 rounded-xl border border-slate-800/80"
              >
                <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] border font-bold ${getBadgeColor(evt.type)}`}>
                    {evt.type.replace('_ACK', '').replace('_MESSAGE', '')}
                  </span>
                  <span className="text-slate-300 truncate">
                    {evt.content ? evt.content.substring(0, 20) : evt.sender}
                  </span>
                </div>
                <span className="text-slate-500 text-[9px] shrink-0">{evt.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}