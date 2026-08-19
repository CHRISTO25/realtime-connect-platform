import React from 'react';

export default function DegradedStatusBanner({ isDegraded, serviceName = "User Identity Service" }) {
  if (!isDegraded) return null;

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between transition-all duration-300">
      <div className="flex items-center space-x-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </span>
        <div>
          <p className="text-xs font-semibold text-amber-300">
            Degraded Performance Mode Active
          </p>
          <p className="text-[11px] text-amber-200/80">
            {serviceName} is temporarily unreachable. Using cached/fallback identities. Messaging remains active.
          </p>
        </div>
      </div>

      <span className="text-[10px] uppercase font-mono tracking-wider bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded border border-amber-500/40">
        Fallback Mode
      </span>
    </div>
  );
}