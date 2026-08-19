import React from 'react';

export default function ServiceHealthMonitor({ isDegraded }) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-md">
      <div className="text-[11px] font-mono text-slate-400 mb-2 uppercase tracking-wider">
        Microservice Mesh Diagnostics
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <span className="text-xs text-slate-300">Gateway (:8080)</span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">ONLINE</span>
        </div>
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <span className="text-xs text-slate-300">Chat (:8003)</span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">ONLINE</span>
        </div>
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/60 rounded-lg border border-slate-800/80 col-span-2">
          <span className="text-xs text-slate-300">User Identity (:8002)</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
            isDegraded 
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' 
              : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
          }`}>
            {isDegraded ? 'DEGRADED (FALLBACK)' : 'ONLINE'}
          </span>
        </div>
      </div>
    </div>
  );
}