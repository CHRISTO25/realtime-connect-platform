import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../services/api/client';
import FriendControl from '../components/FriendControl';
import BlockedList from '../components/BlockedList';

// Custom Debounce Hook to avoid API spam on fast typing
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id');

  // Search Inputs
  const [searchName, setSearchName] = useState('');
  const [searchLocation, setSearchLocation] = useState('');

  // Debounced Search Strings
  const debouncedQuery = useDebounce(searchName, 300);
  const debouncedLocation = useDebounce(searchLocation, 300);

  // Core Data States
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());

  // Infinite Scroll & Pagination States
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // UI Control & Refresh Signals
  const [actionUserId, setActionUserId] = useState(null);
  const [toast, setToast] = useState(null);
  const [blockRefreshKey, setBlockRefreshKey] = useState(0);

  // IntersectionObserver Ref for Infinite Scrolling
  const observerTarget = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ⚡ SERVER-SIDE SEARCH ENGINE QUERY (/api/v1/users/search)
  const fetchSearchResults = useCallback(
    async (pageNum, query, location, isReset = false) => {
      if (isFetching && !isReset) return;
      setIsFetching(true);

      try {
        const res = await userApi.get(
          `/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(
            location
          )}&page=${pageNum}&limit=10`
        );

        if (res.data && res.data.success) {
          const payload = res.data.data;
          const freshProfiles = payload.users || [];

          setHasNext(payload.has_next);

          if (isReset) {
            setUsers(freshProfiles);
          } else {
            setUsers((prev) => {
              const existingIds = new Set(prev.map((u) => u.user_id));
              const uniqueNew = freshProfiles.filter((u) => !existingIds.has(u.user_id));
              return [...prev, ...uniqueNew];
            });
          }
        }
      } catch (err) {
        console.error('Search API failure:', err);
      } finally {
        setIsFetching(false);
        setInitialLoading(false);
      }
    },
    [isFetching]
  );

  // ⚡ FAST AUXILIARY DATA SYNC (Friends & Pending Invites)
  const syncFriendsAndPending = useCallback(async () => {
    try {
      const [friendsRes, pendingRes] = await Promise.allSettled([
        userApi.get('/friends/list'),
        userApi.get('/friends/pending'),
      ]);

      if (friendsRes.status === 'fulfilled' && friendsRes.value.data?.success) {
        setFriends(friendsRes.value.data.data || []);
      }
      if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.success) {
        setPendingRequests(pendingRes.value.data.data || []);
      }
    } catch (err) {
      console.warn('Silent sync error:', err);
    }
  }, []);

  // Initial Auth & Polling Setup (Fast 1.5s background polling)
  useEffect(() => {
    if (!localStorage.getItem('access_token') || !userId) {
      navigate('/login');
      return;
    }

    syncFriendsAndPending();

    // Fast polling timer for live 2-way sync across browsers
    const interval = setInterval(() => {
      syncFriendsAndPending();
    }, 1500);

    return () => clearInterval(interval);
  }, [userId, navigate, syncFriendsAndPending]);

  // ⚡ DEBOUNCED SEARCH TRIGGER (Resets feed when typing)
  useEffect(() => {
    setPage(1);
    fetchSearchResults(1, debouncedQuery, debouncedLocation, true);
  }, [debouncedQuery, debouncedLocation]);

  // ⚡ INFINITE SCROLL OBSERVER (Auto-loads page 2, 3...)
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isFetching) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchSearchResults(nextPage, debouncedQuery, debouncedLocation, false);
        }
      },
      { threshold: 0.8 }
    );

    observer.observe(target);
    return () => observer.unobserve(target);
  }, [hasNext, isFetching, page, debouncedQuery, debouncedLocation, fetchSearchResults]);

  // Status Resolvers
  const isFriend = (targetId) => friends.some((f) => String(f.user_id || f.id) === String(targetId));
  const hasInboundRequest = (targetId) => pendingRequests.some((p) => String(p.sender_id) === String(targetId));
  const hasSentRequest = (targetId) => sentRequests.has(String(targetId));

  // ⚡ INSTANT OPTIMISTIC ACTION HANDLERS
  const handleSendRequest = async (targetId, name) => {
    // 0ms Latency: Optimistically mark as sent
    setSentRequests((prev) => new Set(prev).add(String(targetId)));
    setActionUserId(targetId);

    try {
      const res = await userApi.post('/friends/request', { receiver_id: targetId });
      if (res.data && res.data.success) {
        showToast(`Friend request sent to ${name || 'user'}!`, 'success');
      }
    } catch (err) {
      // Rollback on error
      setSentRequests((prev) => {
        const next = new Set(prev);
        next.delete(String(targetId));
        return next;
      });
      showToast(err.response?.data?.message || 'Failed to send request', 'error');
    } finally {
      setActionUserId(null);
    }
  };

  const handleUnfriend = async (friendId, name) => {
    setActionUserId(friendId);
    // 0ms Latency: Optimistic remove from active friends
    setFriends((prev) => prev.filter((f) => String(f.user_id || f.id) !== String(friendId)));
    showToast(`Removed ${name || 'user'} from friends`, 'info');

    try {
      await userApi.post('/friends/unfriend', { friend_id: friendId });
    } catch (err) {
      showToast('Failed to unfriend', 'error');
      syncFriendsAndPending(); // Rollback
    } finally {
      setActionUserId(null);
    }
  };

  const handleBlockUser = async (targetId, name) => {
    if (!window.confirm(`Are you sure you want to block ${name || 'this user'}?`)) return;

    setActionUserId(targetId);

    // 0ms Latency: Instantly remove user from feed, friends, and pending invites
    setUsers((prev) => prev.filter((u) => String(u.user_id) !== String(targetId)));
    setFriends((prev) => prev.filter((f) => String(f.user_id || f.id) !== String(targetId)));
    setPendingRequests((prev) => prev.filter((p) => String(p.sender_id) !== String(targetId)));

    // Instantly refresh the Blocked Users panel
    setBlockRefreshKey((prev) => prev + 1);

    try {
      const res = await userApi.post(`/block/${targetId}`);
      if (res.data && res.data.success) {
        showToast(`Blocked ${name || 'user'}.`, 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to block user', 'error');
      fetchSearchResults(1, debouncedQuery, debouncedLocation, true); // Rollback
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans pb-20 relative selection:bg-indigo-500 selection:text-white">
      
      {/* 🔮 ULTRA-SMOOTH TOAST NOTIFICATIONS */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 text-xs font-bold font-mono tracking-wide ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/50 text-red-300'
                : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-300'
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-current animate-ping" />
            {toast.message}
          </div>
        </div>
      )}

      {/* 🌟 INSTAGRAM-STYLE "ACTIVE FRIENDS" TOP CAROUSEL */}
      {friends.length > 0 && (
        <header className="mx-4 sm:mx-6 pt-6 max-w-7xl lg:mx-auto lg:w-full">
          <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Active Friends ({friends.length})
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">LIVE CONNECTED</span>
            </div>

            <div className="flex items-center gap-5 overflow-x-auto pb-2 scrollbar-none">
              {friends.map((friend) => (
                <div key={friend.user_id || friend.id} className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer">
                  <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-emerald-400 via-indigo-500 to-purple-500 shadow-xl transition-all duration-300 group-hover:scale-110">
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt={friend.display_name} className="h-14 w-14 rounded-full object-cover border-2 border-slate-950" />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center font-bold text-white text-sm">
                        {(friend.display_name || 'F').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300 max-w-[80px] truncate text-center group-hover:text-white transition-colors">
                    {friend.display_name?.split(' ')[0] || 'Friend'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </header>
      )}

      {/* MAIN LAYOUT */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* LEFT COLUMN: REAL-TIME DEBOUNCED SEARCH + CONTROL PANELS */}
        <section className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl p-5 flex flex-col h-fit shadow-2xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200 flex items-center justify-between pb-2 border-b border-slate-800">
              <span>🔍 Real-Time Search Engine</span>
              {isFetching && <span className="text-[10px] text-indigo-400 animate-pulse font-bold">Querying...</span>}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-slate-400">
                  Search Name / Bio
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Type name to query..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
                  />
                  {searchName && (
                    <button onClick={() => setSearchName('')} className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white font-bold">✕</button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 font-mono text-slate-400">
                  Filter By Location
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    placeholder="City, region..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-all"
                  />
                  {searchLocation && (
                    <button onClick={() => setSearchLocation('')} className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white font-bold">✕</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Invites Control Panel */}
          <FriendControl
            pendingRequests={pendingRequests}
            setPendingRequests={setPendingRequests}
            onRequestProcessed={syncFriendsAndPending}
          />

          {/* Blocked List Control Panel */}
          <BlockedList
            refreshKey={blockRefreshKey}
            onUnblocked={() => {
              setBlockRefreshKey((prev) => prev + 1);
              fetchSearchResults(1, debouncedQuery, debouncedLocation, true);
            }}
          />
        </section>

        {/* RIGHT COLUMN: PAGINATED USER DIRECTORY FEED */}
        <section className="lg:col-span-8 flex flex-col space-y-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-xl px-5 py-3.5 flex items-center justify-between shadow-lg">
            <h2 className="text-xs font-black uppercase tracking-wider font-mono text-slate-200">
              Community Feed ({users.length})
            </h2>
            <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              PAGE {page}
            </span>
          </div>

          {/* SKELETON LOADING */}
          {initialLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-60 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse p-5" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {users.length > 0 ? (
                  users.map((user) => {
                    const userIsFriend = isFriend(user.user_id);
                    const userHasInboundReq = hasInboundRequest(user.user_id);
                    const userHasSentReq = hasSentRequest(user.user_id);

                    return (
                      <div
                        key={user.user_id}
                        className={`group rounded-2xl border bg-slate-900/40 backdrop-blur-xl overflow-hidden transition-all duration-300 flex flex-col justify-between hover:shadow-2xl ${
                          userIsFriend ? 'border-emerald-500/40 bg-slate-900/70' : 'border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* COVER BANNER */}
                        <div className="relative h-24 w-full bg-slate-950 overflow-hidden">
                          {user.cover_url ? (
                            <img src={user.cover_url} alt="Cover" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 opacity-90" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                        </div>

                        {/* BODY DETAILS */}
                        <div className="px-5 pb-4 pt-1 relative flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-end justify-between -mt-10 mb-3">
                              <div className="relative">
                                <div
                                  className={`p-0.5 rounded-2xl bg-gradient-to-tr ${
                                    userIsFriend ? 'from-emerald-400 to-indigo-500' : 'from-indigo-500 to-pink-500'
                                  } shadow-xl`}
                                >
                                  {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.display_name} className="h-14 w-14 rounded-2xl object-cover border-2 border-slate-900 bg-slate-950" />
                                  ) : (
                                    <div className="h-14 w-14 rounded-2xl border-2 border-slate-900 bg-slate-950 flex items-center justify-center font-black text-white text-sm">
                                      {(user.display_name || 'U').substring(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border border-slate-800 bg-slate-950/80 text-slate-300">
                                📍 {user.location || 'Worldwide'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-bold tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                                {user.display_name || 'Anonymous User'}
                              </h4>
                              {userIsFriend && (
                                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  ✓ Friend
                                </span>
                              )}
                            </div>

                            <p className="text-xs mt-1.5 leading-relaxed text-slate-400 line-clamp-2">
                              {user.bio || 'No bio provided.'}
                            </p>
                          </div>

                          {/* DYNAMIC ACTION FOOTER */}
                          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                            <button
                              onClick={() => handleBlockUser(user.user_id, user.display_name)}
                              disabled={actionUserId === user.user_id}
                              className="text-[11px] font-bold text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
                            >
                              🚫 Block
                            </button>

                            {userIsFriend ? (
                              <button
                                onClick={() => handleUnfriend(user.user_id, user.display_name)}
                                disabled={actionUserId === user.user_id}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-red-400 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/50 transition-all active:scale-95"
                              >
                                Unfriend
                              </button>
                            ) : userHasSentReq ? (
                              <button disabled className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-indigo-400 border border-indigo-500/30 opacity-90">
                                ⏳ Request Sent
                              </button>
                            ) : userHasInboundReq ? (
                              <span className="text-[11px] font-mono text-amber-400 font-bold bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-500/30">
                                📩 Pending Invite
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSendRequest(user.user_id, user.display_name)}
                                disabled={actionUserId === user.user_id}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                              >
                                {actionUserId === user.user_id ? 'Sending...' : '+ Add Friend'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-16 rounded-2xl border border-dashed border-slate-800 text-center font-mono text-xs text-slate-500 bg-slate-900/20">
                    No members match your search criteria.
                  </div>
                )}
              </div>

              {/* ⚡ INFINITE SCROLL OBSERVER TARGET */}
              <div ref={observerTarget} className="py-6 flex justify-center items-center">
                {isFetching && page > 1 && (
                  <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 animate-pulse">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    Loading next page...
                  </div>
                )}
              </div>
            </>
          )}
        </section>

      </main>
    </div>
  );
}