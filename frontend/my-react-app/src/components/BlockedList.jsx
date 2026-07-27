import React, { useState, useEffect } from 'react';
import { userApi } from '../services/api/client';

export default function BlockedList({ refreshKey, onUnblocked }) {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState(null);

  useEffect(() => {
    fetchBlockedUsers();
  }, [refreshKey]);

  const fetchBlockedUsers = async () => {
    try {
      const res = await userApi.get('/block/list');
      if (res.data && res.data.success) {
        setBlockedUsers(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load blocked users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (blockedId) => {
    setUnblockingId(blockedId);

    // 0ms Latency: Instantly remove user from list
    setBlockedUsers((prev) => prev.filter((u) => String(u.user_id || u.id) !== String(blockedId)));

    try {
      const res = await userApi.delete(`/block/${blockedId}`);
      if (res.data && res.data.success && onUnblocked) {
        onUnblocked();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unblock user');
      fetchBlockedUsers(); // Rollback
    } finally {
      setUnblockingId(null);
    }
  };

  if (loading) {
    return <div className="text-xs text-slate-500 font-mono">Syncing block registry...</div>;
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-xl shadow-xl space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="text-xs font-bold text-slate-300 tracking-wide font-mono flex items-center gap-2">
          🚫 Blocked Users ({blockedUsers.length})
        </h3>
      </div>

      {blockedUsers.length === 0 ? (
        <p className="text-xs text-slate-500 font-mono py-2 text-center">No blocked users.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-none">
          {blockedUsers.map((user) => (
            <div
              key={user.user_id || user.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-slate-800 overflow-hidden shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-[10px] text-slate-400">
                      {(user.display_name || 'U').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-200 truncate max-w-[100px]">
                  {user.display_name || 'User'}
                </span>
              </div>

              <button
                onClick={() => handleUnblock(user.user_id || user.id)}
                disabled={unblockingId === (user.user_id || user.id)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/50 text-slate-300 text-[10px] font-bold transition-all active:scale-95"
              >
                {unblockingId === (user.user_id || user.id) ? '...' : 'Unblock'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}