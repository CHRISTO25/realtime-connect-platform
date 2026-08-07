import React from 'react';

export default function UserStatusBadge({ isOnline, lastSeen }) {
  const isRecentlyActive = () => {
    // If no lastSeen timestamp is returned from DB yet, fallback to isOnline flag
    if (!lastSeen) return true; 

    const lastSeenTime = new Date(lastSeen).getTime();
    const now = new Date().getTime();
    
    // Active if heartbeat occurred within the last 60 seconds
    return now - lastSeenTime <= 60000;
  };

  const active = Boolean(isOnline) && isRecentlyActive();

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
        active
          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
          : 'bg-slate-900 text-slate-500 border-slate-800'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
        }`}
      />
      {active ? 'ONLINE' : 'OFFLINE'}
    </span>
  );
}