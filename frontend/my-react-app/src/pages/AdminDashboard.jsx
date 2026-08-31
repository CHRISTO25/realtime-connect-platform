import React, { useState, useEffect, useCallback } from 'react';
import { userApi } from '../services/api/client';
import { ShieldCheck, UserX, UserCheck, Search, RefreshCw, AlertTriangle, Terminal, Activity, Lock } from 'lucide-react';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, banned: 0 });

  const fetchUsers = useCallback(async (query = '') => {
    try {
      setLoading(true);
      setError('');
      const response = await userApi.get(`/api/v1/admin/users?query=${encodeURIComponent(query)}`);
      
      const responseData = response.data?.data || response.data || [];
      const userList = Array.isArray(responseData) ? responseData : (responseData.users || []);

      setUsers(userList);

      const total = userList.length;
      const banned = userList.filter(u => u.is_banned).length;
      setStats({
        total,
        active: total - banned,
        banned
      });

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to synchronize user directory matrix.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleBanToggle = async (userId, currentBanStatus) => {
    try {
      setActionLoading(userId);
      const newBanStatus = !currentBanStatus;

      // Optimistic UI state update
      setUsers(prevUsers =>
        prevUsers.map(u => {
          const uId = u.id || u.user_id;
          if (uId === userId) {
            return { ...u, is_banned: newBanStatus };
          }
          return u;
        })
      );

      // Update stats instantly
      setStats(prev => ({
        ...prev,
        active: newBanStatus ? prev.active - 1 : prev.active + 1,
        banned: newBanStatus ? prev.banned + 1 : prev.banned - 1
      }));

      // Patch backend API
      await userApi.patch(`/api/v1/admin/users/${userId}/ban`, {
        is_banned: newBanStatus,
        ban_expires_at: null,
      });

      // Background consistency check
      fetchUsers(search);
    } catch (err) {
      alert(err.response?.data?.error || 'Authorization command failed: Could not alter account status.');
      fetchUsers(search);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-64px)] w-full bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-10 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-7xl w-full mx-auto space-y-6 sm:space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5 sm:pb-6">
          <div>
            <div className="flex items-center space-x-3">
              <span className="p-2 sm:p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl shadow-inner shrink-0">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent truncate">
                Admin Command Matrix
              </h1>
            </div>
            <p className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-slate-400 mt-1.5 sm:mt-2">
              Enterprise Identity Control & Security Governance Grid
            </p>
          </div>

          <button 
            onClick={() => fetchUsers(search)}
            disabled={loading}
            className="inline-flex items-center justify-center space-x-2 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono font-bold tracking-wider text-slate-300 transition cursor-pointer disabled:opacity-50 self-start sm:self-auto shrink-0 shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC NODES</span>
          </button>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between opacity-60 text-[10px] sm:text-xs font-mono uppercase">
              <span>Total Registry</span>
              <Terminal className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black mt-1.5 sm:mt-2 tracking-tight text-white">{stats.total}</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between opacity-60 text-[10px] sm:text-xs font-mono uppercase">
              <span>Active Operators</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black mt-1.5 sm:mt-2 tracking-tight text-emerald-400">{stats.active}</div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between opacity-60 text-[10px] sm:text-xs font-mono uppercase">
              <span>Suspended Nodes</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black mt-1.5 sm:mt-2 tracking-tight text-rose-400">{stats.banned}</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between bg-slate-900/40 p-3 sm:p-4 border border-slate-800/80 rounded-2xl backdrop-blur-md">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchUsers(search)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500 transition shadow-inner"
            />
          </div>
          <button 
            onClick={() => fetchUsers(search)}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer text-center shrink-0"
          >
            Query Directory
          </button>
        </div>

        {error && (
          <div className="p-3.5 sm:p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-center space-x-3 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Directory Content: Mobile Cards & Desktop Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Mobile Card List (visible on screens < 768px) */}
          <div className="md:hidden divide-y divide-slate-800/80">
            {loading && users.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs uppercase tracking-wider flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Loading directory...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs uppercase tracking-wider">
                No active registry records matched.
              </div>
            ) : (
              users.map((u) => {
                const isAdmin = u.role === 'admin';
                const targetId = u.id || u.user_id;
                return (
                  <div key={targetId} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 truncate mr-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono text-xs text-indigo-400 shrink-0">
                          {u.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="font-bold text-white text-xs sm:text-sm truncate">
                          {u.username || u.display_name}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                        isAdmin 
                          ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' 
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {u.role || 'user'}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-slate-400 truncate opacity-80">{u.email}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                      <div className="flex items-center gap-3 text-[11px]">
                        {u.is_verified ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            <span>Pending</span>
                          </span>
                        )}

                        {u.is_banned ? (
                          <span className="inline-flex items-center space-x-1 text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                            <span>Suspended</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Active</span>
                          </span>
                        )}
                      </div>

                      <div>
                        {isAdmin ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-500/5 border border-purple-500/20 rounded-lg text-[10px] font-mono text-purple-400">
                            <Lock className="w-3 h-3" />
                            <span>Protected</span>
                          </span>
                        ) : (
                          <button 
                            onClick={() => handleBanToggle(targetId, u.is_banned)}
                            disabled={actionLoading === targetId}
                            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 ${
                              u.is_banned 
                                ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-rose-600/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {actionLoading === targetId ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : u.is_banned ? (
                              <>
                                <UserCheck className="w-3 h-3" />
                                <span>Restore</span>
                              </>
                            ) : (
                              <>
                                <UserX className="w-3 h-3" />
                                <span>Suspend</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View (visible on screens ≥ 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-mono uppercase tracking-widest">
                  <th className="p-4 font-semibold">Identity Node</th>
                  <th className="p-4 font-semibold">Email Coordinate</th>
                  <th className="p-4 font-semibold">Privilege</th>
                  <th className="p-4 font-semibold">Verification</th>
                  <th className="p-4 font-semibold">Security State</th>
                  <th className="p-4 font-semibold text-right">Direct Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-slate-500 font-mono text-xs uppercase tracking-wider">
                      <div className="inline-flex items-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Querying system directory matrices...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-slate-500 font-mono text-xs uppercase tracking-wider">
                      No active registry records matched your search query.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isAdmin = u.role === 'admin';
                    const targetId = u.id || u.user_id;
                    return (
                      <tr key={targetId} className="hover:bg-slate-850/40 transition-colors group">
                        <td className="p-4 font-semibold text-white flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-mono text-xs text-indigo-400">
                            {u.username?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <span>{u.username || u.display_name}</span>
                        </td>
                        <td className="p-4 text-slate-300 font-mono text-xs opacity-80">{u.email}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                            isAdmin 
                              ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-sm' 
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td className="p-4">
                          {u.is_verified ? (
                            <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 text-xs text-amber-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {u.is_banned ? (
                            <span className="inline-flex items-center space-x-1.5 text-xs text-rose-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                              <span>Suspended</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>Active Node</span>
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {isAdmin ? (
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1 bg-purple-500/5 border border-purple-500/20 rounded-xl text-[11px] font-mono text-purple-400 opacity-75">
                              <Lock className="w-3 h-3" />
                              <span>Protected Node</span>
                            </span>
                          ) : (
                            <button 
                              onClick={() => handleBanToggle(targetId, u.is_banned)}
                              disabled={actionLoading === targetId}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 ${
                                u.is_banned 
                                  ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                                  : 'bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {actionLoading === targetId ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : u.is_banned ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Restore</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Suspend</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}