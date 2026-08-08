import React from 'react';
import UserStatusBadge from './UserStatusBadge';

export default function ChatContextPanel({ activeTarget, isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <aside className="w-72 bg-slate-900/60 border-l border-slate-800/80 p-4 flex flex-col justify-between backdrop-blur-xl h-full overflow-hidden shrink-0 hidden xl:flex">
      <div className="space-y-5 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
        
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">ℹ️ Channel Details</h4>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xs font-bold cursor-pointer">✕</button>
        </div>

        {/* Target Profile Card */}
        <div className="flex flex-col items-center text-center space-y-3 pt-2">
          <div className="relative">
            {activeTarget.avatarUrl ? (
              <img src={activeTarget.avatarUrl} alt={activeTarget.name} className="h-16 w-16 rounded-2xl object-cover border border-indigo-500/40 shadow-lg" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                {activeTarget.type === "GLOBAL" ? "🌐" : activeTarget.type === "GROUP" ? "👥" : activeTarget.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            {activeTarget.type === "DIRECT" && (
              <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${activeTarget.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-white">{activeTarget.name}</h3>
            <p className="text-[10px] text-indigo-400 font-mono mt-0.5">
              {activeTarget.type === "GLOBAL" ? "Public Global Lounge" : activeTarget.type === "GROUP" ? "Multi-User Group Room" : "1-on-1 Secure Direct Message"}
            </p>
          </div>
        </div>

        {/* Technical Metadata Box */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Room Type:</span>
            <span className="text-slate-300 font-bold">{activeTarget.type}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Room UUID:</span>
            <span className="text-indigo-300 truncate max-w-[130px]" title={activeTarget.id}>{activeTarget.id}</span>
          </div>
          {activeTarget.type === "DIRECT" && (
            <div className="flex justify-between text-[10px] items-center pt-1 border-t border-slate-900">
              <span className="text-slate-500">Status:</span>
              <UserStatusBadge isOnline={activeTarget.isOnline} />
            </div>
          )}
        </div>

        {/* Shared Media Placeholder */}
        <div className="space-y-2">
          <h5 className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">Shared Files & Media</h5>
          <div className="border border-dashed border-slate-800/80 rounded-xl p-6 text-center bg-slate-950/30 text-[11px] font-mono text-slate-500">
            No media artifacts shared in this channel yet.
          </div>
        </div>

      </div>

      <div className="pt-3 border-t border-slate-800/80 text-[10px] font-mono text-slate-500 text-center">
        Microservice Stream Secure 🔒
      </div>
    </aside>
  );
}