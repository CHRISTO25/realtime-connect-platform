import React, { useState } from 'react';
import { userApi } from '../services/api/client';

export default function FriendControl({ pendingRequests = [], setPendingRequests, onRequestProcessed }) {
  const [processingId, setActionId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const handleAccept = async (requestId) => {
    setActionId(requestId);

    // 0ms Latency: Filter out request immediately
    setPendingRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    setFeedback('Friend request accepted!');

    try {
      const res = await userApi.post('/friends/accept', { request_id: requestId });
      if (res.data && res.data.success && onRequestProcessed) {
        onRequestProcessed();
      }
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Failed to accept request');
    } finally {
      setActionId(null);
      setTimeout(() => setFeedback(''), 2500);
    }
  };

  const handleReject = async (requestId) => {
    setActionId(requestId);

    // 0ms Latency: Filter out request immediately
    setPendingRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    setFeedback('Friend request declined.');

    try {
      const res = await userApi.post('/friends/reject', { request_id: requestId });
      if (res.data && res.data.success && onRequestProcessed) {
        onRequestProcessed();
      }
    } catch (err) {
      setFeedback(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setActionId(null);
      setTimeout(() => setFeedback(''), 2500);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-xl shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-xs font-bold text-white tracking-wide font-mono flex items-center gap-2">
          <span>👥</span> Pending Invites
        </h3>
        <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          {pendingRequests.length}
        </span>
      </div>

      {feedback && (
        <p className="text-[11px] font-mono text-indigo-400 bg-indigo-950/40 p-2 rounded-xl border border-indigo-500/20">
          {feedback}
        </p>
      )}

      {pendingRequests.length === 0 ? (
        <p className="text-xs text-slate-500 font-mono py-2 text-center">No pending invitations.</p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-none">
          {pendingRequests.map((req) => (
            <div
              key={req.request_id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-800 overflow-hidden border border-slate-700 shrink-0">
                  {req.avatar_url ? (
                    <img src={req.avatar_url} alt={req.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xs text-indigo-400">
                      {(req.display_name || 'U').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="truncate max-w-[110px]">
                  <h4 className="text-xs font-bold text-white truncate">{req.display_name || 'User'}</h4>
                  <span className="text-[9px] font-mono text-slate-500">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAccept(req.request_id)}
                  disabled={processingId === req.request_id}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-all active:scale-95 shadow-md"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleReject(req.request_id)}
                  disabled={processingId === req.request_id}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-[10px] transition-all active:scale-95"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}